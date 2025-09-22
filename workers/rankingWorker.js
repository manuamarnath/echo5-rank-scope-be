// Use BullMQ (modern) for production-quality queues. Fall back to in-process queue if not available.
let rankingQueue = null; // exported wrapper
const { updateAllRankings, updatePageRankings } = require('../services/rankingService');

const { createQueue, connection: sharedConnection, normalizeQueueName, isNoEvictionPolicy, getEvictionPolicy } = require('../lib/queues');

// Internal refs (will be swapped when Redis becomes ready)
let internalQueue = null;
let internalWorker = null;

// Fallback add implementation (in-process immediate processing)
async function fallbackAdd(data) {
  const fakeJob = { id: Date.now().toString(), data };
  try {
    console.log('rankingWorker (fallback) processing job', fakeJob.id, data);
    if (data && data.pageId) await updatePageRankings(data.pageId);
    else await updateAllRankings();
    console.log('rankingWorker (fallback) job completed', fakeJob.id);
    return { id: fakeJob.id };
  } catch (e) {
    console.error('rankingWorker (fallback) job failed', fakeJob.id, e && e.message ? e.message : e);
    throw e;
  }
}

// Exported wrapper that delegates to internal queue when available, otherwise uses fallback
rankingQueue = {
  async add(data, opts = {}) {
    if (internalQueue && typeof internalQueue.add === 'function') {
      // BullMQ queue expects (name, data, opts)
      return internalQueue.add('ranking-job', data, opts);
    }
    return fallbackAdd(data);
  },
  __queue: () => internalQueue,
  __worker: () => internalWorker
};

// Initialize BullMQ queue and worker when Redis is ready
function initBullmq() {
  try {
    const { Worker } = require('bullmq');
    const queueName = normalizeQueueName('ranking-updates');
    internalQueue = createQueue(queueName);

    // Check policy before starting worker
    try {
      if (!isNoEvictionPolicy()) {
        const policy = getEvictionPolicy() || 'unknown';
        console.error(`REFUSING to start ranking worker: Redis maxmemory-policy is '${policy}'. Set to 'noeviction' to ensure queue reliability.`);
        return;
      }
    } catch (e) {
      console.warn('Could not determine Redis eviction policy; proceeding cautiously');
    }

    if (!sharedConnection || sharedConnection.status !== 'ready') {
      console.warn('Shared Redis connection not ready; delaying worker start');
      return;
    }

    internalWorker = new Worker(queueName, async (job) => {
      console.log('rankingWorker processing job', job.id, job.name || JSON.stringify(job.data));
      if (job.data && job.data.pageId) return updatePageRankings(job.data.pageId);
      return updateAllRankings();
    }, { connection: sharedConnection, concurrency: 1 });

    internalWorker.on('completed', (job) => console.log('rankingWorker job completed', job.id));
    internalWorker.on('failed', (job, err) => console.error('rankingWorker job failed', job.id, err && err.message));

    console.log('rankingWorker: BullMQ worker started');
  } catch (err) {
    console.warn('Failed to initialize BullMQ worker:', err && err.message ? err.message : err);
    // keep fallback behavior
  }
}

// If Redis is ready now, init immediately; otherwise listen for ready
if (sharedConnection && sharedConnection.status === 'ready') {
  initBullmq();
} else if (sharedConnection) {
  let started = false;
  const onReady = () => {
    if (!started) {
      started = true;
      console.log('Redis ready — initializing rankingWorker BullMQ');
      initBullmq();
    }
  };
  sharedConnection.once('ready', onReady);

  // If Redis never becomes ready, we'll continue using fallback
  setTimeout(() => {
    if (!internalWorker) console.warn('Redis did not become ready — rankingWorker will use fallback queue');
  }, 10000);
}

module.exports = rankingQueue;
