const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// Create ioredis connection with options compatible with BullMQ
// BullMQ requires `maxRetriesPerRequest` to be null.
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });

// avoid crashing on unhandled redis errors; log them instead
connection.on('error', (err) => {
  try {
    console.warn('Redis connection error:', err && err.message ? err.message : err);
  } catch (e) {
    // ignore
  }
});

connection.on('connect', () => console.log('Redis client connecting...'));

// Track eviction policy state so callers can decide whether to start workers
let evictionPolicy = null; // string or null
let evictionPolicyChecked = false;
// Allow operator override when provider blocks CONFIG GET or you have validated the policy externally
const assumeNoEviction = String(process.env.REDIS_ASSUME_NOEVICTION || '').toLowerCase() === 'true';

async function checkEvictionPolicy() {
  try {
    // CONFIG GET returns an array: [ 'maxmemory-policy', '<value>' ]
    const res = await connection.config('GET', 'maxmemory-policy');
    if (Array.isArray(res) && res.length >= 2) {
      evictionPolicy = String(res[1]).toLowerCase();
      evictionPolicyChecked = true;
      if (evictionPolicy !== 'noeviction') {
        console.error(`IMPORTANT! Eviction policy is ${evictionPolicy}. It should be 'noeviction'`);
        if (assumeNoEviction) {
          console.warn('Environment override REDIS_ASSUME_NOEVICTION=true is set — proceeding despite non-noeviction policy. Use with caution.');
        }
      } else {
        console.log("Redis maxmemory-policy is 'noeviction'");
      }
      return evictionPolicy;
    }
  } catch (e) {
    console.warn('Unable to read Redis maxmemory-policy via CONFIG GET:', e && e.message ? e.message : e);
  }
  evictionPolicyChecked = true;
  return evictionPolicy;
}

connection.on('ready', () => {
  console.log('Redis client ready');
  // check and log eviction policy immediately when ready
  checkEvictionPolicy().catch(() => {});
});

connection.on('end', () => console.log('Redis client disconnected'));

function normalizeQueueName(name) {
  // BullMQ may reject some characters in queue names in certain envs; replace colons with dashes
  return String(name).replace(/:/g, '-');
}

function createFallbackQueue(name) {
  const qName = normalizeQueueName(name);
  return {
    // minimal add() signature used by our routes: returns a fake job object
    async add(jobName, data) {
      console.warn(`[fallback-queue] enqueue called for ${qName} (${jobName}) — Redis unavailable. Data:`, data);
      return { id: `fallback-${Date.now()}` };
    }
  };
}

function createQueue(name) {
  const qName = normalizeQueueName(name);
  try {
    // If Redis connection is not ready, return a fallback queue to avoid throwing
    if (!connection || connection.status !== 'ready') {
      console.warn(`Redis not ready — returning fallback queue for ${qName}`);
      return createFallbackQueue(qName);
    }
    // If we were able to check policy and it is not 'noeviction', do not create real queues
    if (evictionPolicyChecked && evictionPolicy && evictionPolicy !== 'noeviction') {
      console.error(`Refusing to create queue ${qName} because Redis maxmemory-policy is ${evictionPolicy} (must be 'noeviction')`);
      return createFallbackQueue(qName);
    }
    return new Queue(qName, { connection });
  } catch (err) {
    console.warn('Failed to create Queue, returning fallback queue:', err && err.message ? err.message : err);
    return createFallbackQueue(qName);
  }
}

function isNoEvictionPolicy() {
  // If we haven't checked yet, be conservative and return false only if we explicitly know it's bad
  if (assumeNoEviction) return true; // operator override
  if (!evictionPolicyChecked) return true;
  return evictionPolicy === 'noeviction';
}

function getEvictionPolicy() {
  return evictionPolicy;
}

module.exports = { createQueue, connection, normalizeQueueName, isNoEvictionPolicy, getEvictionPolicy };
