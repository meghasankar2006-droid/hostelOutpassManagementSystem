const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
require('dotenv').config();

async function createStudent() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-hostel');
  const dept = await Department.findOne({ name: 'CSE' });
  if (!dept) { console.log('NO DEPT'); process.exit(); }
  
  const room = await Room.findOne();
  if (!room) { console.log('NO ROOM'); process.exit(); }

  const hostel = await Hostel.findOne();
  if (!hostel) { console.log('NO HOSTEL'); process.exit(); }

  await User.deleteOne({ email: 'e23cs021@shanmugha.edu.in' });
  
  await User.create({
    name: 'E23cs021',
    studentId: 'E23cs021',
    email: 'e23cs021@shanmugha.edu.in',
    password: await require('bcryptjs').hash('password123', await require('bcryptjs').genSalt(10)),
    role: 'Student',
    department: dept._id,
    year: 4,
    hostel: hostel._id,
    room: room._id,
    roomNumber: room.roomNumber,
    isActive: true
  });
  console.log('Created student e23cs021');
  process.exit();
}
createStudent();
