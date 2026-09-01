const express = require('express');
const {
  getWardenRequests, updateRequestWarden,
  getWardenComplaints, updateComplaint,
  getRooms, getAnalytics
} = require('../controllers/wardenController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('Warden'));

router.get('/requests', getWardenRequests);
router.put('/requests/:id', updateRequestWarden);

router.get('/complaints', getWardenComplaints);
router.put('/complaints/:id', updateComplaint);


router.get('/rooms', getRooms);
router.get('/analytics', getAnalytics);

module.exports = router;
