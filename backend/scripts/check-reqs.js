const mongoose = require('mongoose');
const Request = require('./backend/models/Request');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-hostel');
  const reqs = await Request.find().sort('-createdAt').limit(5);
  console.log(reqs.map(r => ({ type: r.type, status: r.status, createdAt: r.createdAt })));
  process.exit(0);
}
test();
