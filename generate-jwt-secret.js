const crypto = require('crypto');

// Generate a secure random JWT secret
const jwtSecret = crypto.randomBytes(64).toString('hex');

console.log('='.repeat(50));
console.log('SECURE JWT SECRET FOR RENDER BACKEND:');
console.log('='.repeat(50));
console.log(jwtSecret);
console.log('='.repeat(50));
console.log('');
console.log('Steps to update in Render:');
console.log('1. Go to https://render.com');
console.log('2. Find your "echo5-rank-scope-be" service');
console.log('3. Go to Environment tab');
console.log('4. Add/Update JWT_SECRET with the value above');
console.log('5. Save and redeploy');