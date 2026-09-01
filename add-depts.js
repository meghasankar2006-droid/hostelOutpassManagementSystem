const mongoose = require('mongoose');
const Department = require('./backend/models/Department');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-hostel');
  
  const depts = [
    { name: 'Electrical & Electronics Engineering (EEE)' },
    { name: 'Electronics & Communication (ECE)' },
    { name: 'Mechanical Engineering' },
    { name: 'Civil Engineering' },
    { name: 'Information Technology' }
  ];
  
  for (const d of depts) {
    const exists = await Department.findOne({ name: d.name });
    if (!exists) {
      await Department.create(d);
      console.log('Added: ' + d.name);
    }
  }
  console.log('Done');
  process.exit(0);
}
run();
