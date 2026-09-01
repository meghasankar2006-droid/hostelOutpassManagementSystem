const fs = require('fs');
const file = './backend/controllers/departmentController.js';
let content = fs.readFileSync(file, 'utf8');

// Combine updateRequestAdvisor and updateRequestHOD into updateRequestDepartment
const startIdx = content.indexOf('exports.updateRequestAdvisor');
const endIdx = content.indexOf('exports.getStudents'); // Next function
if (startIdx !== -1 && endIdx !== -1) {
  const newFunc = 
// @desc  Advisor or HOD approves/rejects a request
// @route PUT /api/department/requests/:id/department
exports.updateRequestDepartment = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    
    if (request.status !== 'Pending Department' || request.departmentStatus !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Department approval is already completed or not required.' });
    }

    if (status === 'Approved') {
      request.departmentStatus = 'Approved';
      request.departmentApprovedBy = req.user.id;
      request.departmentApprovedByRole = req.user.role;
      request.departmentApprovedAt = new Date();

      if (request.type === 'Outpass') {
        request.status = 'Pending Warden';
        if (request.assignedWarden) {
          await request.populate('student', 'name email roomNumber department');
          const studentName = request.student ? request.student.name : 'Unknown';
          const studentId = request.student ? request.student.email : 'Unknown';
          const roomNo = request.student ? request.student.roomNumber : 'Unknown';
          
          const msg = \Outpass Request Pending Warden Approval — \\\n\\nStudent Name: \\\nStudent ID: \\\nRoom: \\\nDestination: \\\n\\nPlease login to the Smart Hostel Management System to review this request.\\n\\nThis email is only a notification.\\nApproval must be completed through the website.\;
          
          await notify(request.assignedWarden, msg, request.type);
        }
      } else {
        request.status = 'Approved';
      }
    } else if (status === 'Rejected') {
      request.departmentStatus = 'Rejected';
      request.status = 'Rejected';
      request.rejectionReason = rejectionReason || 'Rejected by Department';
    } else {
      return res.status(400).json({ success: false, message: 'status must be Approved or Rejected' });
    }

    await request.save();
    await notify(request.student, \Your \ request was \ by Department.\, request.type);
    res.status(200).json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

;
  content = content.substring(0, startIdx) + newFunc + content.substring(endIdx);
  fs.writeFileSync(file, content);
  console.log('departmentController updated.');
} else {
  console.log('Indices not found.', startIdx, endIdx);
}
