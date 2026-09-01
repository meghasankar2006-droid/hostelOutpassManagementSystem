const mongoose = require('mongoose');
const Request = require('./backend/models/Request');

async function fixDB() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-hostel');
  const result1 = await Request.deleteMany({ status: 'Pending HOD' });
  const result2 = await Request.deleteMany({ status: 'Pending Advisor' });
  console.log('Deleted HOD:', result1, 'Advisor:', result2);
  process.exit(0);
}
fixDB();
