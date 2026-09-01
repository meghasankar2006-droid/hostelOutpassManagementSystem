const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedWarden: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['Outpass', 'Leave'],
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  destination: {
    type: String,
    required: function () { return this.type === 'Outpass'; }
  },
  outTime: { type: String }, // for Outpass
  expectedReturnTime: { type: String }, // for Outpass
  fromDate: {
    type: Date,
    required: true
  },
  toDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending Department', 'Pending Advisor', 'Pending HOD', 'Pending Warden', 'Approved', 'Rejected'],
    default: 'Pending Department'
  },
  // Audit trail - who acted, and when, with real names captured at approval time
  departmentStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  departmentApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  departmentApprovedByName: { type: String },
  departmentApprovedByRole: { type: String },
  departmentApprovedAt: { type: Date },
  departmentApprovalType: { type: String, enum: ['ADVISOR', 'HOD'] },
  advisorApproval: {
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Not Required'], default: 'Pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedByName: { type: String },
    approvedAt: { type: Date }
  },
  hodApproval: {
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedByName: { type: String },
    approvedAt: { type: Date }
  },
  wardenStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Not Required'],
    default: 'Pending'
  },
  wardenApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  wardenApprovedByName: { type: String },
  wardenApprovedAt: { type: Date },

  rejectionReason: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Request', requestSchema);
