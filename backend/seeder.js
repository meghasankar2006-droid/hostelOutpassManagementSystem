const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('./models/User');
const Hostel = require('./models/Hostel');
const Block = require('./models/Block');
const Room = require('./models/Room');
const Department = require('./models/Department');
const Request = require('./models/Request');
const Complaint = require('./models/Complaint');
const Notification = require('./models/Notification');

const PASSWORD = 'password123';

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  await Promise.all([
    User.deleteMany(), Hostel.deleteMany(), Block.deleteMany(), Room.deleteMany(),
    Department.deleteMany(), Request.deleteMany(), Complaint.deleteMany(),
    Notification.deleteMany()
  ]);

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(PASSWORD, salt);

  // Super Admin
  const admin = await User.create({ name: 'Super Admin', email: 'admin@hostel.com', password: hash, role: 'SuperAdmin' });

  // Department + staff
  const dept = await Department.create({ name: 'Computer Science' });
  const hod = await User.create({ name: 'Dr. Meena Krishnan', email: 'hod.cs@hostel.com', password: hash, role: 'HOD', department: dept._id });
  const advisor = await User.create({ name: 'Prof. Arjun Rao', email: 'advisor.cs@hostel.com', password: hash, role: 'Advisor', department: dept._id });
  dept.hod = hod._id;
  dept.advisors = [advisor._id];
  await dept.save();

  // Hostel -> Block -> Room
  const hostel = await Hostel.create({ name: 'Boys Hostel A' });
  const warden = await User.create({ name: 'Mr. Suresh Babu', email: 'warden.a@hostel.com', password: hash, role: 'Warden', hostel: hostel._id });
  hostel.warden = warden._id;
  await hostel.save();

  const block = await Block.create({ name: 'Block 1', hostel: hostel._id });
  hostel.blocks = [block._id];
  await hostel.save();

  const room1 = await Room.create({ roomNumber: 'A-101', block: block._id, capacity: 2, occupants: [] });
  const room2 = await Room.create({ roomNumber: 'A-102', block: block._id, capacity: 2, occupants: [] });

  // Students
  const student1 = await User.create({
    name: 'Sanjay Kumar', email: 'student1@hostel.com', password: hash, role: 'Student',
    department: dept._id, year: 2, hostel: hostel._id, block: block._id, room: room1._id,
    roomNumber: room1.roomNumber, parentName: 'Ravi Kumar', parentPhone: '9000000001', studentPhone: '9000000011'
  });
  const student2 = await User.create({
    name: 'Divya Prakash', email: 'student2@hostel.com', password: hash, role: 'Student',
    department: dept._id, year: 2, hostel: hostel._id, block: block._id, room: room1._id,
    roomNumber: room1.roomNumber, parentName: 'Prakash S', parentPhone: '9000000002', studentPhone: '9000000012'
  });
  room1.occupants = [student1._id, student2._id];
  await room1.save();

  console.log('----------------------------------------');
  console.log('Seed complete. All passwords:', PASSWORD);
  console.log('SuperAdmin :', admin.email);
  console.log('HOD        :', hod.email);
  console.log('Advisor    :', advisor.email);
  console.log('Warden     :', warden.email);
  console.log('Student 1  :', student1.email, '(has a roommate, room A-101)');
  console.log('Student 2  :', student2.email);
  console.log('Spare room :', room2.roomNumber, '(unallocated, for testing admin room allocation)');
  console.log('----------------------------------------');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
