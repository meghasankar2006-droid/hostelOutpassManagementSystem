const express = require('express');
const {
  getUsers, createUser, updateUser, toggleUserActive, deleteUser, resetPassword,
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getHostels, createHostel, updateHostel, deleteHostel,
  createBlock, getBlocks, updateBlock, deleteBlock,
  createRoom, getRooms, updateRoom, deleteRoom,
  allocateRoom, deallocateRoom, getAnalytics
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('SuperAdmin'));

router.route('/users').get(getUsers).post(createUser);
router.route('/users/:id').put(updateUser).delete(deleteUser);
router.put('/users/:id/toggle-active', toggleUserActive);
router.put('/users/:id/reset-password', resetPassword);

router.route('/departments').get(getDepartments).post(createDepartment);
router.route('/departments/:id').put(updateDepartment).delete(deleteDepartment);

router.route('/hostels').get(getHostels).post(createHostel);
router.route('/hostels/:id').put(updateHostel).delete(deleteHostel);

router.route('/blocks').get(getBlocks).post(createBlock);
router.route('/blocks/:id').put(updateBlock).delete(deleteBlock);

router.route('/rooms').get(getRooms).post(createRoom);
router.route('/rooms/:id').put(updateRoom).delete(deleteRoom);

router.post('/allocate', allocateRoom);
router.post('/deallocate', deallocateRoom);
router.get('/analytics', getAnalytics);

module.exports = router;
