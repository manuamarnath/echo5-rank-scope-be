const cron = require('node-cron');

// Use the rankingQueue worker module which already wires a processor
const rankingQueue = require('./workers/rankingWorker');

// Schedule daily job at 03:00 server time
cron.schedule('0 3 * * *', async () => {
  console.log('Triggering daily ranking update via rankingQueue...');
  await rankingQueue.add({});
});

// Optional: schedule hourly light updates (commented out by default)
// cron.schedule('0 * * * *', async () => {
//   console.log('Triggering hourly ranking update...');
//   await rankingQueue.add({ light: true });
// });

console.log('Ranking scheduling started.');