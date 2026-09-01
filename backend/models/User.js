const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['Student', 'Advisor', 'HOD', 'Warden', 'SuperAdmin'],
    required: true
  },
  // Specific to Student
  studentId: {
    type: String, // e.g. 23CSE001
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  year: {
    type: Number, // e.g., 1, 2, 3, 4
  },
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel'
  },
  roomNumber: {
    type: String
  },
  parentName: {
    type: String
  },
  parentPhone: {
    type: String
  },
  studentPhone: {
    type: String
  },
  // Assigned to Advisor/HOD/Warden
  assignedDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  assignedHostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel'
  },
  // Room allocation for students
  block: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Block'
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  },
  bed: {
    type: Number
  },
  mustChangePassword: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
