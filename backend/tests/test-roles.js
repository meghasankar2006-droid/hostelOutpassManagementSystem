const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./backend/models/User');
const Department = require('./backend/models/Department');
const Request = require('./backend/models/Request');

const adminController = require('./backend/controllers/adminController');
const studentController = require('./backend/controllers/studentController');

async function testRoles() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const dept = await Department.findOne();

  // Test 1: Duplicate HOD block
  const reqHod = {
    body: { email: 'hodtest2@college.edu.in', role: 'HOD', department: dept._id }
  };
  const resHod = {
    status: (code) => { console.log('Duplicate HOD test status:', code); return { json: (data) => console.log('Duplicate HOD res:', data) }; }
  };
  await adminController.createUser(reqHod, resHod);
  
  // Test 2: Duplicate Advisor Block
  const reqAdv = {
    body: { email: 'advtest2@college.edu.in', role: 'Advisor', department: dept._id, year: 1 }
  };
  const resAdv = {
    status: (code) => { console.log('Duplicate Advisor test status:', code); return { json: (data) => console.log('Duplicate Advisor res:', data) }; }
  };
  await adminController.createUser(reqAdv, resAdv);

  console.log('Done testing.');
  process.exit();
}

testRoles();
