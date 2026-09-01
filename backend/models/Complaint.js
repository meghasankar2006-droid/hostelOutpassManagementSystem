const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedWarden: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  type: {
    type: String,
    enum: ['Hostel', 'Room', 'Mess', 'Other'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Resolved', 'Dismissed', 'UNASSIGNED'],
    default: 'Pending'
  },
  resolution: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);
