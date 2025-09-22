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
connection.on('ready', () => console.log('Redis client ready'));
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
    return new Queue(qName, { connection });
  } catch (err) {
    console.warn('Failed to create Queue, returning fallback queue:', err && err.message ? err.message : err);
    return createFallbackQueue(qName);
  }
}

module.exports = { createQueue, connection, normalizeQueueName };
