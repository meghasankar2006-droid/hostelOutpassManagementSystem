const express = require('express');
const {
  getRequests, updateRequestDepartment,
  getStudents, getAdvisors,
  getAnalytics, getMyRole
} = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('Advisor', 'HOD'));

router.get('/me', getMyRole);
router.get('/requests', getRequests);
router.put('/requests/:id/department', updateRequestDepartment);

router.get('/students', getStudents);
router.get('/advisors', authorize('HOD'), getAdvisors);

router.get('/analytics', getAnalytics);

module.exports = router;
