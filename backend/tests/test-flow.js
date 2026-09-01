const mongoose = require('mongoose');
const Request = require('./backend/models/Request');
const User = require('./backend/models/User');
const Department = require('./backend/models/Department');
const Hostel = require('./backend/models/Hostel');
const Notification = require('./backend/models/Notification');
const Block = require('./backend/models/Block');
const Room = require('./backend/models/Room');

const studentController = require('./backend/controllers/studentController');
const departmentController = require('./backend/controllers/departmentController');
const wardenController = require('./backend/controllers/wardenController');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-hostel');
  
  const student = await User.findOne({ role: 'Student' });
  const department = await Department.findById(student.department).populate('advisors').populate('hod');
  const advisor = department.advisors[0];
  const hod = department.hod;
  
  const hostel = await Hostel.findById(student.hostel);
  const warden = await User.findById(hostel.warden);

  console.log('--- TEST 1: ADVISOR APPROVES ---');
  let resStatus, resJson;
  let mockRes = () => ({ status: (s) => { resStatus = s; return { json: (j) => { resJson = j; }}; } });
  
  // 1. Create Outpass
  await studentController.createRequest({
    user: { id: student._id },
    body: { type: 'Outpass', reason: 'Home', destination: 'Chennai', outTime: '10:00', expectedReturnTime: '18:00', fromDate: new Date(), toDate: new Date() }
  }, mockRes());
  let reqId = resJson.data._id;
  
  // 2. Advisor Approves
  await departmentController.updateRequestDepartment({
    user: { id: advisor._id, role: advisor.role },
    params: { id: reqId },
    body: { status: 'Approved' }
  }, mockRes());
  
  let updatedReq = await Request.findById(reqId);
  if (updatedReq.status === 'Pending Warden' && updatedReq.departmentStatus === 'Approved') {
    console.log('PASS: Advisor approval transitioned correctly');
  } else {
    console.error('FAIL: Advisor approval failed');
  }
  
  // 3. HOD tries to approve
  await departmentController.updateRequestDepartment({
    user: { id: hod._id, role: hod.role },
    params: { id: reqId },
    body: { status: 'Approved' }
  }, mockRes());
  if (resStatus === 400 && resJson.message.includes('completed')) {
    console.log('PASS: HOD blocked from duplicate approval');
  } else {
    console.error('FAIL: HOD not blocked', resStatus, resJson);
  }

  // 4. Warden Approves
  await wardenController.updateRequestWarden({
    user: { id: warden._id },
    params: { id: reqId },
    body: { status: 'Approved' }
  }, mockRes());
  
  let finalReq = await Request.findById(reqId);
  if (finalReq.status === 'Approved' && finalReq.wardenStatus === 'Approved') {
    console.log('PASS: Warden approval saved successfully');
  } else {
    console.error('FAIL: Warden approval failed');
  }

  const notif = await Notification.findOne({ user: student._id }).sort('-createdAt');
  if (notif && notif.message.includes('Warden Approval:')) {
    console.log('PASS: Student received detailed email');
  } else {
    console.error('FAIL: Student did not receive email', notif);
  }

  console.log('\n--- TEST 2: HOD APPROVES ---');
  // 1. Create Outpass
  await studentController.createRequest({
    user: { id: student._id },
    body: { type: 'Outpass', reason: 'Home', destination: 'Madurai', outTime: '08:00', expectedReturnTime: '20:00', fromDate: new Date(), toDate: new Date() }
  }, mockRes());
  reqId = resJson.data._id;
  
  // 2. HOD Approves directly
  await departmentController.updateRequestDepartment({
    user: { id: hod._id, role: hod.role },
    params: { id: reqId },
    body: { status: 'Approved' }
  }, mockRes());
  
  updatedReq = await Request.findById(reqId);
  if (updatedReq.status === 'Pending Warden' && updatedReq.departmentStatus === 'Approved') {
    console.log('PASS: HOD direct approval transitioned correctly');
  } else {
    console.error('FAIL: HOD direct approval failed');
  }
  
  console.log('Done.');
  process.exit(0);
}
test();
