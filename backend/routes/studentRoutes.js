const express = require('express');
const {
  getProfile,
  createRequest, getMyRequests,
  createComplaint, getMyComplaints
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('Student'));

router.get('/profile', getProfile);
router.route('/requests').get(getMyRequests).post(createRequest);
router.route('/complaints').get(getMyComplaints).post(createComplaint);


module.exports = router;
