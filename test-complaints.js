const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models
const User = require('./backend/models/User');
const Hostel = require('./backend/models/Hostel');
const Block = require('./backend/models/Block');
const Room = require('./backend/models/Room');
const Complaint = require('./backend/models/Complaint');

// We simulate the API controllers
const studentController = require('./backend/controllers/studentController');
const wardenController = require('./backend/controllers/wardenController');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/hostel_db', );
  
  // Clean DB
  await User.deleteMany();
  await Hostel.deleteMany();
  await Block.deleteMany();
  await Room.deleteMany();
  await Complaint.deleteMany();

  const hash = await bcrypt.hash('password123', 10);
  
  // Create Wardens
  const wardenA = await User.create({ name: 'Warden A', email: 'wardena@test.com', password: hash, role: 'Warden' });
  const wardenB = await User.create({ name: 'Warden B', email: 'wardenb@test.com', password: hash, role: 'Warden' });
  
  // Create Hostels
  const hostelA = await Hostel.create({ name: 'Hostel A', code: 'HA', type: 'Boys', warden: wardenA._id });
  const hostelB = await Hostel.create({ name: 'Hostel B', code: 'HB', type: 'Girls', warden: wardenB._id });
  
  // Create Students
  const studentA = await User.create({ name: 'Student A', email: 'studenta@test.com', password: hash, role: 'Student', hostel: hostelA._id });
  const studentB = await User.create({ name: 'Student B', email: 'studentb@test.com', password: hash, role: 'Student', hostel: hostelB._id });
  const studentC = await User.create({ name: 'Student C', email: 'studentc@test.com', password: hash, role: 'Student' }); // Unassigned

  console.log('--- TEST 1: Student A submits complaint ---');
  let resStatus = null; let resJson = null;
  const res = { status: (s) => { resStatus = s; return res; }, json: (j) => { resJson = j; } };
  
  await studentController.createComplaint({
    user: { id: studentA._id },
    body: { type: 'Hostel', title: 'Test A', description: 'Desc A' }
  }, res);
  
  console.log('Status:', resStatus);
  const complaintA_id = resJson.data._id;
  if (String(resJson.data.assignedWarden) === String(wardenA._id)) console.log('PASS: Complaint A assigned to Warden A');
  else console.error('FAIL: Complaint A not assigned to Warden A');
  
  console.log('--- TEST 2: Warden A views complaints ---');
  await wardenController.getWardenComplaints({
    user: { id: wardenA._id },
    query: {}
  }, res);
  if (resJson.data.length === 1 && String(resJson.data[0]._id) === String(complaintA_id)) console.log('PASS: Warden A sees Complaint A');
  else console.error('FAIL: Warden A does not see Complaint A correctly', resJson.data);

  console.log('--- TEST 3: Warden B views complaints ---');
  await wardenController.getWardenComplaints({
    user: { id: wardenB._id },
    query: {}
  }, res);
  if (resJson.data.length === 0) console.log('PASS: Warden B does NOT see Complaint A');
  else console.error('FAIL: Warden B sees Complaint A!', resJson.data);

  console.log('--- TEST 4: Student B submits complaint ---');
  await studentController.createComplaint({
    user: { id: studentB._id },
    body: { type: 'Room', title: 'Test B', description: 'Desc B' }
  }, res);
  const complaintB_id = resJson.data._id;
  if (String(resJson.data.assignedWarden) === String(wardenB._id)) console.log('PASS: Complaint B assigned to Warden B');
  else console.error('FAIL: Complaint B not assigned to Warden B');

  console.log('--- TEST 5: Warden B updates complaint ---');
  await wardenController.updateComplaint({
    user: { id: wardenB._id },
    params: { id: complaintB_id },
    body: { status: 'In Progress', resolution: 'Working on it' }
  }, res);
  if (resStatus === 200 && resJson.data.status === 'In Progress') console.log('PASS: Warden B updated Complaint B');
  else console.error('FAIL: Warden B failed to update Complaint B', resStatus, resJson);

  console.log('--- TEST 6: Warden A tries to update Complaint B ---');
  await wardenController.updateComplaint({
    user: { id: wardenA._id },
    params: { id: complaintB_id },
    body: { status: 'Resolved' }
  }, res);
  if (resStatus === 403) console.log('PASS: Warden A blocked from updating Complaint B');
  else console.error('FAIL: Warden A allowed to update Complaint B!', resStatus);
  
  console.log('--- TEST 7: Unassigned Student C submits complaint ---');
  await studentController.createComplaint({
    user: { id: studentC._id },
    body: { type: 'Mess', title: 'Test C', description: 'Desc C' }
  }, res);
  if (resJson.data.assignedWarden === null && resJson.data.status === 'UNASSIGNED') console.log('PASS: Complaint C has no warden and status UNASSIGNED');
  else console.error('FAIL: Complaint C not properly handled', resJson.data);

  console.log('--- TEST 8: Student gets their own complaints ---');
  await studentController.getMyComplaints({
    user: { id: studentA._id },
    query: {}
  }, res);
  if (resJson.data.length === 1 && String(resJson.data[0]._id) === String(complaintA_id)) console.log('PASS: Student A only sees their own complaints');
  else console.error('FAIL: Student A sees wrong complaints', resJson.data);
  
  console.log('Done.');
  process.exit(0);
}

test();
