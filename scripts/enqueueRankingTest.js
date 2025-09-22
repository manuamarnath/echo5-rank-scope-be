require('dotenv').config();
const rankingQueue = require('../workers/rankingWorker');

(async function(){
  console.log('Adding test ranking job...');
  const job = await rankingQueue.add({ test: true });
  console.log('Added job id', job.id);
  // wait a short time then exit
  setTimeout(()=> process.exit(0), 3000);
})();