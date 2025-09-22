// Worker runner - load processors and start BullMQ workers
const path = require('path');
const { Worker } = require('bullmq');
const { connection, normalizeQueueName } = require('../lib/queues');

// map queueName -> processor module
const processors = [
  { queue: 'local-opportunities:generate', handler: require('./generateLocalOpportunitiesWorker') },
  { queue: 'local-opportunities:accept', handler: require('./acceptLocalOpportunityWorker') },
  { queue: 'keyword-suggestions:generate', handler: require('./keywordSuggestionsWorker') },
  { queue: 'blog-ideas:generate', handler: require('./blogIdeasWorker') }
];

function startWorkers() {
  processors.forEach(p => {
    const qName = normalizeQueueName(p.queue);
    try {
      const worker = new Worker(qName, async job => {
        try {
          return await p.handler(job);
        } catch (err) {
          console.error(`Worker ${p.queue} job ${job.id} failed:`, err);
          throw err;
        }
      }, { connection });

      worker.on('completed', job => console.log(`Job ${job.id} completed on ${p.queue}`));
      worker.on('failed', (job, err) => console.error(`Job ${job.id} failed on ${p.queue}:`, err));
    } catch (err) {
      console.warn(`Failed to start worker for ${p.queue}:`, err && err.message ? err.message : err);
    }
  });

  console.log('Workers started (attempted)');
}

// If Redis is ready, start immediately; otherwise listen for ready then start
if (connection && connection.status === 'ready') {
  startWorkers();
} else if (connection) {
  let started = false;
  const onReady = () => {
    if (!started) {
      started = true;
      console.log('Redis ready — starting workers');
      startWorkers();
    }
  };
  connection.once('ready', onReady);

  // If Redis never becomes ready, after a timeout log and skip starting workers
  setTimeout(() => {
    if (!started) console.warn('Redis did not become ready within timeout — workers not started');
  }, 5000);
}

// If run directly, keep process alive
if (require.main === module) {
  console.log('Worker runner started directly.');
}
