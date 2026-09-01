const mongoose = require('mongoose');
const Request = require('./backend/models/Request');

async function fixDB() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-hostel');
  const result = await Request.deleteMany({ status: 'Pending Advisor' });
  console.log('Deleted old requests:', result);
  process.exit(0);
}
fixDB();
