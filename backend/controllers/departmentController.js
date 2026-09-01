const Request = require('../models/Request');
const Department = require('../models/Department');
const User = require('../models/User');
const notify = require('../utils/notify');

// Helper: find the department this staff member belongs to, and their role in it
async function getMyDepartment(userId) {
  const asHod = await Department.findOne({ hod: userId });
  if (asHod) return { department: asHod, staffRole: 'HOD' };
  const asAdvisor = await Department.findOne({ advisors: userId });
  if (asAdvisor) return { department: asAdvisor, staffRole: 'Advisor' };
  return { department: null, staffRole: null };
}

// @desc  Get all requests relevant to the logged-in Advisor/HOD (queue + history)
// @route GET /api/department/requests
exports.getRequests = async (req, res) => {
  try {
    const { department, staffRole } = await getMyDepartment(req.user.id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'You are not linked to any department yet' });
    }

    const me = await User.findById(req.user.id);
    const filter = { department: department._id, role: 'Student' };
    if (staffRole === 'Advisor' && me.year) {
      filter.year = me.year;
    }

    const students = await User.find(filter).select('_id');
    const studentIds = students.map(s => s._id);

    const requests = await Request.find({ student: { $in: studentIds } })
      .populate('student', 'name email year roomNumber room role')
      .populate('departmentApprovedBy', 'name')
      .populate('wardenApprovedBy', 'name')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Advisor or HOD approves/rejects a request at their stage
// @route PUT /api/department/requests/:id/department
exports.updateRequestDepartment = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    
    const { department, staffRole } = await getMyDepartment(req.user.id);
    if (!department) return res.status(403).json({ success: false, message: 'Not authorized' });

    if (request.status !== 'Pending Department') {
      return res.status(400).json({ success: false, message: 'Request is not pending Department approval.' });
    }

    const me = await User.findById(req.user.id);
    await request.populate({ path: 'student', populate: { path: 'department' } });
    const studentName = request.student ? request.student.name : 'Unknown';
    const studentId = request.student && request.student.studentId ? request.student.studentId : 'Unknown';
    const studentYear = request.student && request.student.year ? request.student.year : 'Unknown';
    const deptName = request.student && request.student.department ? request.student.department.name : 'Unknown';
    const destOrReason = request.type === 'Outpass' ? request.destination : request.reason;
    const roomNo = request.student ? request.student.roomNumber : 'Unknown';

    if (status === 'Approved') {
      request.status = 'Pending Warden';
      request.departmentStatus = 'Approved';
      request.departmentApprovalType = staffRole === 'Advisor' ? 'ADVISOR' : 'HOD';
      request.departmentApprovedBy = req.user.id;
      request.departmentApprovedByName = me.name;
      request.departmentApprovedByRole = staffRole === 'Advisor' && me.year ? `Year ${me.year} Advisor` : staffRole;
      request.departmentApprovedAt = new Date();
      
      if (request.assignedWarden) {
        const msg = `${request.type} Request Pending Warden Approval — ${studentName}\n\nStudent Name: ${studentName}\nStudent ID: ${studentId}\nRoom: ${roomNo}\n${request.type === 'Outpass' ? 'Destination' : 'Reason'}: ${destOrReason}\n\nPlease login to the Smart Hostel Management System to review this request.`;
        await notify(request.assignedWarden, msg, request.type);
      }
    } else if (status === 'Rejected') {
      request.status = 'Rejected';
      request.departmentStatus = 'Rejected';
      request.rejectionReason = rejectionReason || `Rejected by ${staffRole}`;
      request.departmentApprovalType = staffRole === 'Advisor' ? 'ADVISOR' : 'HOD';

      const reqDate = request.fromDate ? request.fromDate.toLocaleDateString('en-GB') : 'Unknown';
      const reqTime = request.outTime || '00:00';
      const reason = request.reason || 'Personal Work';
      const destOrType = request.type === 'Outpass' ? request.destination : 'Leave Request';
      const staffRoleName = staffRole === 'Advisor' && me.year ? `Year ${me.year} Advisor` : staffRole;
      const rejDate = new Date().toLocaleDateString('en-GB');
      const rejTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const subject = `${request.type} Rejected — ${studentName}`;
      const msg = `Hello ${studentName},\n\nYour ${request.type} has been REJECTED.\n\nStudent Name: ${studentName}\nStudent ID: ${studentId}\nDepartment: ${deptName}\nYear: ${studentYear}\n\n${request.type} Date: ${reqDate}\n${request.type === 'Outpass' ? `Outpass Time: ${reqTime}\nDestination: ${destOrType}\n` : ''}Reason: ${reason}\n\nRejected By: ${me.name}\nRole: ${staffRoleName}\nRejected Date: ${rejDate}\nRejected Time: ${rejTime}\nReason for Rejection: ${request.rejectionReason}\n\nFINAL STATUS: REJECTED\n\nSmart Hostel Management System`;
      
    } else {
      return res.status(400).json({ success: false, message: 'status must be Approved or Rejected' });
    }

    await request.save();
    await notify(request.student._id || request.student, `Your ${request.type} request was ${status.toLowerCase()} by ${staffRole}.`, request.type);
    res.status(200).json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  List students in the department (Advisor: assigned only via department link, HOD: all)
// @route GET /api/department/students
exports.getStudents = async (req, res) => {
  try {
    const { department, staffRole } = await getMyDepartment(req.user.id);
    if (!department) return res.status(404).json({ success: false, message: 'You are not linked to any department yet' });

    const me = await User.findById(req.user.id);
    const filter = { department: department._id, role: 'Student' };
    if (staffRole === 'Advisor' && me.year) {
      filter.year = me.year;
    }

    const students = await User.find(filter)
      .select('-password')
      .populate('hostel', 'name')
      .populate('room', 'roomNumber');

    res.status(200).json({ success: true, count: students.length, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  HOD-only: list advisors in the department
// @route GET /api/department/advisors
exports.getAdvisors = async (req, res) => {
  try {
    const { department, staffRole } = await getMyDepartment(req.user.id);
    if (!department) return res.status(404).json({ success: false, message: 'You are not linked to any department yet' });
    if (staffRole !== 'HOD') return res.status(403).json({ success: false, message: 'Only HOD can view advisor list' });

    const dept = await Department.findById(department._id).populate('advisors', 'name email');
    res.status(200).json({ success: true, data: dept.advisors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



// @desc  Department analytics (HOD view, and useful for Advisor too)
// @route GET /api/department/analytics
exports.getAnalytics = async (req, res) => {
  try {
    const { department, staffRole } = await getMyDepartment(req.user.id);
    if (!department) return res.status(404).json({ success: false, message: 'You are not linked to any department yet' });

    const me = await User.findById(req.user.id);
    const stuFilter = { department: department._id, role: 'Student' };
    if (staffRole === 'Advisor' && me.year) {
      stuFilter.year = me.year;
    }

    const students = await User.find(stuFilter).select('_id');
    const studentIds = students.map(s => s._id);

    const [totalStudents, pendingLeave, pendingOutpass, approvedLeave, approvedOutpass, rejected] = await Promise.all([
      User.countDocuments(stuFilter),
      Request.countDocuments({ student: { $in: studentIds }, type: 'Leave', status: 'Pending Department' }),
      Request.countDocuments({ student: { $in: studentIds }, type: 'Outpass', status: 'Pending Department' }),
      Request.countDocuments({ student: { $in: studentIds }, type: 'Leave', status: 'Approved' }),
      Request.countDocuments({ student: { $in: studentIds }, type: 'Outpass', status: 'Approved' }),
      Request.countDocuments({ student: { $in: studentIds }, status: 'Rejected' })
    ]);

    res.status(200).json({
      success: true,
      data: { totalStudents, pendingLeave, pendingOutpass, approvedLeave, approvedOutpass, rejected }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Which role (HOD/Advisor) the logged-in department user has, for frontend UI gating
// @route GET /api/department/me
exports.getMyRole = async (req, res) => {
  try {
    const { department, staffRole } = await getMyDepartment(req.user.id);
    if (!department) return res.status(404).json({ success: false, message: 'You are not linked to any department yet' });
    res.status(200).json({ success: true, data: { staffRole, department: { id: department._id, name: department.name } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
