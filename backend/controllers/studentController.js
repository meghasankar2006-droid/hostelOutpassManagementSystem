const Request = require('../models/Request');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const Department = require('../models/Department');
const Room = require('../models/Room');
const Hostel = require('../models/Hostel');
const notify = require('../utils/notify');

// --- Profile ---

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('department', 'name')
      .populate('hostel', 'name')
      .populate('block', 'name')
      .populate('room', 'roomNumber capacity occupants');

    let roommates = [];
    if (user.room) {
      const room = await Room.findById(user.room).populate('occupants', 'name year');
      roommates = room.occupants.filter(o => String(o._id) !== String(user._id));
    }

    res.status(200).json({ success: true, data: { ...user.toObject(), roommates } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// --- Requests (Outpass & Leave) ---

exports.createRequest = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student.department) {
      return res.status(400).json({ success: false, message: 'You are not assigned to a department yet. Contact Super Admin.' });
    }
    const department = await Department.findById(student.department);

    const { type, reason, destination, outTime, expectedReturnTime, fromDate, toDate } = req.body;

    if (type === 'Outpass' && (!destination || !outTime || !expectedReturnTime)) {
      return res.status(400).json({ success: false, message: 'Destination, out time and expected return time are required for an outpass' });
    }

    let assignedWarden = null;
    if (student.hostel) {
      const hostel = await Hostel.findById(student.hostel);
      if (hostel) assignedWarden = hostel.warden;
    }

    const targetAdvisor = await User.findOne({ 
      role: 'Advisor', 
      assignedDepartment: student.department, 
      year: student.year,
      isActive: true 
    });

    const request = await Request.create({
      student: req.user.id,
      assignedWarden,
      type, reason, destination, outTime, expectedReturnTime, fromDate, toDate,
      status: 'Pending Department'
    });

    if (targetAdvisor) {
      await notify(targetAdvisor._id, `New ${type} request from ${student.name} needs your review.`, type);
    }
    if (department.hod) {
      await notify(department.hod, `New ${type} request from ${student.name} needs your review.`, type);
    }

    res.status(201).json({ success: true, data: request });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { student: req.user.id };
    if (type) filter.type = type;

    const requests = await Request.find(filter)
      .populate('departmentApprovedBy', 'name')
      .populate('wardenApprovedBy', 'name')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// --- Complaints ---

exports.createComplaint = async (req, res) => {
  try {
    req.body.student = req.user.id;
    
    // Find the student's assigned warden
    const student = await User.findById(req.user.id);
    let assignedWarden = null;
    let status = 'Pending';

    if (student.hostel) {
      const hostel = await Hostel.findById(student.hostel);
      if (hostel && hostel.warden) {
        assignedWarden = hostel.warden;
      }
    }

    if (assignedWarden) {
      req.body.assignedWarden = assignedWarden;
    } else {
      req.body.assignedWarden = null;
      req.body.status = 'UNASSIGNED';
    }

    const complaint = await Complaint.create(req.body);

    if (assignedWarden) {
      await notify(assignedWarden, `New ${complaint.type} complaint: "${complaint.title}" from ${student.name}.`, 'Complaint');
    }

    res.status(201).json({ success: true, data: complaint });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getMyComplaints = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { student: req.user.id };
    if (type) filter.type = type;
    const complaints = await Complaint.find(filter).sort('-createdAt');
    res.status(200).json({ success: true, count: complaints.length, data: complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



