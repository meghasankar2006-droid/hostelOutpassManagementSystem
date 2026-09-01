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
  const hod = await User.findOne({ role: 'HOD', department: student.department });
  const hostel = await Hostel.findById(student.hostel);
  const warden = await User.findById(hostel.warden);

  console.log('Testing outpass creation...');
  let resStatus, resJson;
  const mockRes = () => ({ status: (s) => { resStatus = s; return { json: (j) => { resJson = j; }}; } });
  
  // 1. Create Outpass
  await studentController.createRequest({
    user: { id: student._id },
    body: { type: 'Outpass', reason: 'Home', destination: 'Chennai', outTime: '10:00', expectedReturnTime: '18:00', fromDate: new Date(), toDate: new Date(), viaHOD: true }
  }, mockRes());
  
  const reqId = resJson.data._id;
  const createdReq = await Request.findById(reqId);
  if (String(createdReq.assignedWarden) === String(warden._id)) {
    console.log('PASS: assignedWarden properly set');
  } else {
    console.error('FAIL: assignedWarden not set', createdReq.assignedWarden, warden._id);
  }

  // 2. HOD Approves
  await departmentController.updateRequestHOD({
    user: { id: hod._id },
    params: { id: reqId },
    body: { status: 'Approved' }
  }, mockRes());
  
  const updatedReq = await Request.findById(reqId);
  if (updatedReq.status === 'Pending Warden') {
    console.log('PASS: Status transitioned to Pending Warden');
  } else {
    console.error('FAIL: Status not transitioned correctly', updatedReq.status);
  }

  // 3. Warden Views
  await wardenController.getWardenRequests({
    user: { id: warden._id }
  }, mockRes());
  
  if (resJson.data.find(r => String(r._id) === String(reqId))) {
    console.log('PASS: Warden can view the request');
  } else {
    console.error('FAIL: Warden cannot view the request');
  }

  // 4. Warden Approves
  await wardenController.updateRequestWarden({
    user: { id: warden._id },
    params: { id: reqId },
    body: { status: 'Approved' }
  }, mockRes());
  
  const finalReq = await Request.findById(reqId);
  if (finalReq.status === 'Approved' && String(finalReq.wardenApprovedBy) === String(warden._id)) {
    console.log('PASS: Warden approval saved successfully');
  } else {
    console.error('FAIL: Warden approval failed');
  }

  // Verify Notification
  const notif = await Notification.findOne({ user: warden._id }).sort('-createdAt');
  if (notif.message.includes('Pending Warden Approval')) {
    console.log('PASS: Notification sent to warden');
  } else {
    console.error('FAIL: Notification not sent', notif);
  }

  console.log('Done.');
  process.exit(0);
}
test();
