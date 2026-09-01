const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models
const User = require('./backend/models/User');
const Hostel = require('./backend/models/Hostel');
const Block = require('./backend/models/Block');
const Room = require('./backend/models/Room');
const Department = require('./backend/models/Department');

// Controller
const adminController = require('./backend/controllers/adminController');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/hostel_db');
  
  // Clean DB
  await User.deleteMany();
  await Hostel.deleteMany();
  await Block.deleteMany();
  await Room.deleteMany();
  await Department.deleteMany();

  // Create environment
  const hostel = await Hostel.create({ name: 'Hostel A', code: 'HA', type: 'Boys' });
  const block = await Block.create({ name: 'Block A', hostel: hostel._id });
  const room = await Room.create({ roomNumber: 'A-101', block: block._id, capacity: 2, occupants: [] });
  const dept = await Department.create({ name: 'Computer Science' });

  let resStatus = null; let resJson = null;
  const res = { status: (s) => { resStatus = s; return res; }, json: (j) => { resJson = j; } };

  console.log('--- TEST 1: Fail on invalid domain ---');
  await adminController.createUser({
    body: { email: 'student@gmail.com', role: 'Student' }
  }, res);
  if (resStatus === 400 && resJson.message.includes('college.edu.in')) console.log('PASS: Domain validation works');
  else console.error('FAIL: Domain validation failed', resStatus, resJson);

  console.log('--- TEST 2: Success on Warden creation ---');
  await adminController.createUser({
    body: { email: 'warden.hostela@college.edu.in', role: 'Warden', hostel: hostel._id }
  }, res);
  if (resStatus === 201 && resJson.data.name === 'Warden Hostela') console.log('PASS: Warden created and name generated');
  else console.error('FAIL: Warden creation failed', resStatus, resJson);

  console.log('--- TEST 3: Success on Student creation with Room Number ---');
  await adminController.createUser({
    body: { email: 'student1@college.edu.in', role: 'Student', roomNumber: 'A-101', department: dept._id }
  }, res);
  if (resStatus === 201 && String(resJson.data.room) === String(room._id) && String(resJson.data.hostel) === String(hostel._id)) 
    console.log('PASS: Student created and assigned to Room/Block/Hostel automatically');
  else console.error('FAIL: Student room assignment failed', resStatus, resJson);

  console.log('--- TEST 4: Duplicate Email rejection ---');
  await adminController.createUser({
    body: { email: 'student1@college.edu.in', role: 'Student', roomNumber: 'A-101', department: dept._id }
  }, res);
  if (resStatus === 400) console.log('PASS: Duplicate rejected');
  else console.error('FAIL: Duplicate allowed');

  console.log('Done.');
  process.exit(0);
}

test();
