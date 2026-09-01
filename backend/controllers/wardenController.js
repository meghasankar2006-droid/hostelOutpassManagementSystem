const Request = require('../models/Request');
const Complaint = require('../models/Complaint');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const User = require('../models/User');
const notify = require('../utils/notify');

async function getMyHostel(userId) {
  return Hostel.findOne({ warden: userId }).populate('blocks');
}

// @desc  All requests pending Warden action, plus history for this hostel
// @route GET /api/warden/requests
exports.getWardenRequests = async (req, res) => {
  try {
    const requests = await Request.find({ assignedWarden: req.user.id })
      .populate('student', 'name email roomNumber room')
      .populate('departmentApprovedBy', 'name')
      .populate('wardenApprovedBy', 'name')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Warden approves/rejects the final request stage
// @route PUT /api/warden/requests/:id
exports.updateRequestWarden = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    
    if (String(request.assignedWarden) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to approve this request' });
    }

    if (request.status !== 'Pending Warden') {
      return res.status(400).json({ success: false, message: 'Request is not pending warden approval' });
    }

    // Populate needed fields first
    await request.populate({ path: 'student', populate: { path: 'department' } });
    await request.populate('departmentApprovedBy', 'name');

    const me = await User.findById(req.user.id);
    const studentName = request.student ? request.student.name : 'Unknown';
    const studentId = request.student && request.student.studentId ? request.student.studentId : 'Unknown';
    const studentYear = request.student && request.student.year ? request.student.year : 'Unknown';
    const deptName = request.student && request.student.department ? request.student.department.name : 'Unknown';
    const reqDate = request.fromDate ? request.fromDate.toLocaleDateString('en-GB') : 'Unknown';
    const reqTime = request.outTime || '00:00';
    const reason = request.reason || 'Personal Work';
    const isOutpass = request.type === 'Outpass';
    const destOrType = isOutpass ? request.destination : 'Leave Request';

    if (status === 'Approved') {
      request.wardenStatus = 'Approved';
      request.wardenApprovedBy = req.user.id;
      request.wardenApprovedByName = me.name;
      request.wardenApprovedAt = new Date();
      request.status = 'Approved';

      const deptApprover = request.departmentApprovedByName || (request.departmentApprovedBy ? request.departmentApprovedBy.name : 'Unknown');
      const deptRole = request.departmentApprovedByRole || 'Department';
      const deptDate = request.departmentApprovedAt ? request.departmentApprovedAt.toLocaleDateString('en-GB') : 'Unknown';
      const deptTime = request.departmentApprovedAt ? request.departmentApprovedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Unknown';

      const wardenDate = request.wardenApprovedAt.toLocaleDateString('en-GB');
      const wardenTime = request.wardenApprovedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const subject = `${request.type} Approved — ${studentName}`;
      const msg = `Hello ${studentName},\n\nYour ${request.type} has been approved successfully.\n\nStudent Name: ${studentName}\nStudent ID: ${studentId}\nDepartment: ${deptName}\nYear: ${studentYear}\n\n${request.type} Date: ${reqDate}\n${isOutpass ? `Outpass Time: ${reqTime}\nDestination: ${destOrType}\n` : ''}Reason: ${reason}\n\nDepartment Approval\n\nApproved By: ${deptApprover}\nRole: ${deptRole}\nApproved Date: ${deptDate}\nApproved Time: ${deptTime}\n\nWarden Approval\n\nApproved By: ${me.name}\nRole: Warden\nApproved Date: ${wardenDate}\nApproved Time: ${wardenTime}\n\nFINAL STATUS: APPROVED\n\nYou can view the complete details in your Student Dashboard.\n\nSmart Hostel Management System`;


      await request.save();
      await notify(request.student._id || request.student, `${request.type} Approved — ${studentName} | ${deptName}\n\n${msg}`, request.type);

    } else if (status === 'Rejected') {
      request.wardenStatus = 'Rejected';
      request.status = 'Rejected';
      request.rejectionReason = rejectionReason || 'Rejected by Warden';

      const rejDate = new Date().toLocaleDateString('en-GB');
      const rejTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const subject = `${request.type} Rejected — ${studentName}`;
      const msg = `Hello ${studentName},\n\nYour ${request.type} has been REJECTED.\n\nStudent Name: ${studentName}\nStudent ID: ${studentId}\nDepartment: ${deptName}\nYear: ${studentYear}\n\n${request.type} Date: ${reqDate}\n${isOutpass ? `Outpass Time: ${reqTime}\nDestination: ${destOrType}\n` : ''}Reason: ${reason}\n\nRejected By: ${me.name}\nRole: Warden\nRejected Date: ${rejDate}\nRejected Time: ${rejTime}\nReason for Rejection: ${request.rejectionReason}\n\nFINAL STATUS: REJECTED\n\nSmart Hostel Management System`;


      await request.save();
      await notify(request.student._id || request.student, `Your Outpass request was rejected by the Warden.`, 'Outpass');

    } else {
      return res.status(400).json({ success: false, message: 'status must be Approved or Rejected' });
    }

    res.status(200).json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Complaints for this hostel (Hostel/Room/Mess)
// @route GET /api/warden/complaints
exports.getWardenComplaints = async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = { assignedWarden: req.user.id };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const complaints = await Complaint.find(filter).populate('student', 'name email roomNumber').sort('-createdAt');
    res.status(200).json({ success: true, count: complaints.length, data: complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Update complaint status (Pending -> In Progress -> Resolved)
// @route PUT /api/warden/complaints/:id
exports.updateComplaint = async (req, res) => {
  try {
    const { status, resolution } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
    if (String(complaint.assignedWarden) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this complaint' });
    }

    complaint.status = status;
    if (resolution) complaint.resolution = resolution;
    await complaint.save();

    await notify(complaint.student, `Your ${complaint.type} complaint "${complaint.title}" is now ${status}.`, 'Complaint');
    res.status(200).json({ success: true, data: complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



// @desc  Room occupancy overview for the warden's hostel
// @route GET /api/warden/rooms
exports.getRooms = async (req, res) => {
  try {
    const hostel = await getMyHostel(req.user.id);
    if (!hostel) return res.status(404).json({ success: false, message: 'No hostel is assigned to you' });

    const blockIds = hostel.blocks.map(b => b._id);
    const rooms = await Room.find({ block: { $in: blockIds } }).populate('block', 'name').populate('occupants', 'name year');

    res.status(200).json({ success: true, count: rooms.length, data: rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Warden dashboard overview + analytics for their hostel
// @route GET /api/warden/analytics
exports.getAnalytics = async (req, res) => {
  try {
    const hostel = await getMyHostel(req.user.id);
    if (!hostel) return res.status(404).json({ success: false, message: 'No hostel is assigned to you' });

    const blockIds = hostel.blocks.map(b => b._id);
    const [rooms, students] = await Promise.all([
      Room.find({ block: { $in: blockIds } }),
      User.countDocuments({ hostel: hostel._id, role: 'Student' })
    ]);

    const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
    const occupied = rooms.reduce((sum, r) => sum + r.occupants.length, 0);
    const occupiedRooms = rooms.filter(r => r.occupants.length >= r.capacity).length;
    const availableRooms = rooms.length - occupiedRooms;

    const studentIds = (await User.find({ hostel: hostel._id, role: 'Student' }).select('_id')).map(s => s._id);

    const [pendingOutpass, approvedOutpass, rejectedOutpass, pendingComplaints, resolvedComplaints,
      hostelComplaints, roomComplaints, messComplaints] = await Promise.all([
      Request.countDocuments({ student: { $in: studentIds }, type: 'Outpass', status: { $in: ['Pending Department', 'Pending Warden'] } }),
      Request.countDocuments({ student: { $in: studentIds }, type: 'Outpass', status: 'Approved' }),
      Request.countDocuments({ student: { $in: studentIds }, type: 'Outpass', status: 'Rejected' }),
      Complaint.countDocuments({ student: { $in: studentIds }, status: { $in: ['Pending', 'In Progress'] } }),
      Complaint.countDocuments({ student: { $in: studentIds }, status: 'Resolved' }),
      Complaint.countDocuments({ student: { $in: studentIds }, type: 'Hostel' }),
      Complaint.countDocuments({ student: { $in: studentIds }, type: 'Room' }),
      Complaint.countDocuments({ student: { $in: studentIds }, type: 'Mess' })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalStudents: students,
        totalRooms: rooms.length,
        occupiedRooms,
        availableRooms,
        totalCapacity,
        occupiedBeds: occupied,
        occupancyPercentage: totalCapacity ? Math.round((occupied / totalCapacity) * 100) : 0,
        pendingOutpass, approvedOutpass, rejectedOutpass,
        pendingComplaints, resolvedComplaints,
        hostelComplaints, roomComplaints, messComplaints
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
