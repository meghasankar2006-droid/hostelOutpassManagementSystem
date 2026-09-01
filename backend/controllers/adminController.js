const User = require('../models/User');
const Department = require('../models/Department');
const Hostel = require('../models/Hostel');
const Block = require('../models/Block');
const Room = require('../models/Room');
const Request = require('../models/Request');
const Complaint = require('../models/Complaint');
const bcrypt = require('bcryptjs');
const notify = require('../utils/notify');

// --- Users ---
exports.getUsers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    const users = await User.find(filter).select('-password')
      .populate('department', 'name').populate('hostel', 'name')
      .populate('block', 'name').populate('room', 'roomNumber');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { email, role, ...rest } = req.body;
    if (!email || !role) {
      return res.status(400).json({ success: false, message: 'email and role are required' });
    }

    // Domain validation
    const domain = process.env.COLLEGE_DOMAIN || '@college.edu.in';
    if (!email.endsWith(domain)) {
      return res.status(400).json({ success: false, message: `Email must be an official college email ending with ${domain}` });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'A user with this official email already exists' });

    // Enforce duplicate checks for HOD and Advisor
    if (role === 'HOD' && rest.department) {
      const existingHod = await User.findOne({ role: 'HOD', department: rest.department, isActive: true });
      if (existingHod) {
        return res.status(400).json({ success: false, message: 'This department already has an active HOD.' });
      }
    }

    if (role === 'Advisor' && rest.department && rest.year) {
      const existingAdvisor = await User.findOne({ role: 'Advisor', department: rest.department, year: rest.year, isActive: true });
      if (existingAdvisor) {
        return res.status(400).json({ success: false, message: `This department already has an active Year ${rest.year} Advisor.` });
      }
    }

    // Derive name from email
    const emailPrefix = email.split('@')[0];
    const generatedName = emailPrefix.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

    const defaultPassword = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    // Student room lookup
    if (role === 'Student' && rest.roomNumber) {
      const room = await Room.findOne({ roomNumber: rest.roomNumber }).populate('block');
      if (!room) {
        return res.status(400).json({ success: false, message: 'Invalid Room Number' });
      }
      rest.room = room._id;
      rest.block = room.block._id;
      rest.hostel = room.block.hostel;
    }

    const user = await User.create({ name: generatedName, email, password: hashedPassword, role, ...rest });

    if (role === 'Student' && rest.room) {
      await Room.findByIdAndUpdate(rest.room, { $addToSet: { occupants: user._id } });
    }

    // Keep Department.hod / Department.advisors in sync
    if (role === 'HOD' && rest.department) {
      await Department.findByIdAndUpdate(rest.department, { hod: user._id });
    }
    if (role === 'Advisor' && rest.department) {
      await Department.findByIdAndUpdate(rest.department, { $addToSet: { advisors: user._id } });
    }
    if (role === 'Warden' && rest.hostel) {
      await Hostel.findByIdAndUpdate(rest.hostel, { warden: user._id });
    }

    const safeUser = user.toObject();
    delete safeUser.password;
    res.status(201).json({ success: true, data: safeUser });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.password; // password changes not allowed via this generic endpoint
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc  SuperAdmin resets any user's password directly (no old password needed)
// @route PUT /api/admin/users/:id/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({ success: true, message: `Password reset for ${user.email}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.toggleUserActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = !user.isActive;
    await user.save();
    res.status(200).json({ success: true, data: { id: user._id, isActive: user.isActive } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    // Clean up references
    if (user.room) await Room.findByIdAndUpdate(user.room, { $pull: { occupants: user._id } });
    await Department.updateMany({}, { $pull: { advisors: user._id } });
    await Department.updateMany({ hod: user._id }, { $unset: { hod: 1 } });
    await Hostel.updateMany({ warden: user._id }, { $unset: { warden: 1 } });
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// --- Departments ---
exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().populate('hod', 'name email').populate('advisors', 'name email');
    res.status(200).json({ success: true, count: departments.length, data: departments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const department = await Department.create(req.body);
    res.status(201).json({ success: true, data: department });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const department = await Department.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true, runValidators: true });
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });
    res.status(200).json({ success: true, data: department });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const inUse = await User.countDocuments({ department: req.params.id });
    if (inUse > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete: ${inUse} user(s) are linked to this department` });
    }
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// --- Hostels ---
exports.getHostels = async (req, res) => {
  try {
    const hostels = await Hostel.find().populate('warden', 'name email').populate('blocks');
    res.status(200).json({ success: true, count: hostels.length, data: hostels });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createHostel = async (req, res) => {
  try {
    const hostel = await Hostel.create(req.body);
    res.status(201).json({ success: true, data: hostel });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateHostel = async (req, res) => {
  try {
    const hostel = await Hostel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });
    if (req.body.warden) await User.findByIdAndUpdate(req.body.warden, { hostel: hostel._id, assignedHostel: hostel._id });
    res.status(200).json({ success: true, data: hostel });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteHostel = async (req, res) => {
  try {
    const blockCount = await Block.countDocuments({ hostel: req.params.id });
    if (blockCount > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete: ${blockCount} block(s) belong to this hostel` });
    }
    const hostel = await Hostel.findByIdAndDelete(req.params.id);
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// --- Blocks & Rooms ---
exports.createBlock = async (req, res) => {
  try {
    const block = await Block.create(req.body);
    await Hostel.findByIdAndUpdate(req.body.hostel, { $push: { blocks: block._id } });
    res.status(201).json({ success: true, data: block });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getBlocks = async (req, res) => {
  try {
    const filter = {};
    if (req.query.hostel) filter.hostel = req.query.hostel;
    const blocks = await Block.find(filter).populate('hostel', 'name');
    res.status(200).json({ success: true, count: blocks.length, data: blocks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateBlock = async (req, res) => {
  try {
    const block = await Block.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true, runValidators: true });
    if (!block) return res.status(404).json({ success: false, message: 'Block not found' });
    res.status(200).json({ success: true, data: block });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteBlock = async (req, res) => {
  try {
    const roomCount = await Room.countDocuments({ block: req.params.id });
    if (roomCount > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete: ${roomCount} room(s) belong to this block` });
    }
    const block = await Block.findByIdAndDelete(req.params.id);
    if (!block) return res.status(404).json({ success: false, message: 'Block not found' });
    await Hostel.findByIdAndUpdate(block.hostel, { $pull: { blocks: block._id } });
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const room = await Room.create(req.body);
    res.status(201).json({ success: true, data: room });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getRooms = async (req, res) => {
  try {
    const filter = {};
    if (req.query.block) filter.block = req.query.block;
    const rooms = await Room.find(filter).populate({ path: 'block', populate: { path: 'hostel', select: 'name' } }).populate('occupants', 'name year');
    res.status(200).json({ success: true, count: rooms.length, data: rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const { roomNumber, capacity } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (capacity !== undefined && capacity < room.occupants.length) {
      return res.status(400).json({ success: false, message: `Cannot set capacity below current occupancy (${room.occupants.length})` });
    }
    if (roomNumber !== undefined) room.roomNumber = roomNumber;
    if (capacity !== undefined) room.capacity = capacity;
    await room.save();
    res.status(200).json({ success: true, data: room });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.occupants.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete a room with students still allocated to it' });
    }
    await room.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Remove a student from their current room
// @route POST /api/admin/deallocate
exports.deallocateRoom = async (req, res) => {
  try {
    const { studentId } = req.body;
    const student = await User.findById(studentId);
    if (!student || student.role !== 'Student') {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    if (student.room) {
      await Room.findByIdAndUpdate(student.room, { $pull: { occupants: student._id } });
    }
    student.room = undefined;
    student.block = undefined;
    student.roomNumber = undefined;
    await student.save();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc  Allocate a student to a room (keeps Room.occupants and User.room/block/hostel in sync)
// @route POST /api/admin/allocate
exports.allocateRoom = async (req, res) => {
  try {
    const { studentId, roomId } = req.body;
    const student = await User.findById(studentId);
    if (!student || student.role !== 'Student') {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    const room = await Room.findById(roomId).populate('block');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.occupants.length >= room.capacity) {
      return res.status(400).json({ success: false, message: 'Room is already at full capacity' });
    }

    // Remove from any previous room first
    if (student.room) {
      await Room.findByIdAndUpdate(student.room, { $pull: { occupants: student._id } });
    }

    room.occupants.push(student._id);
    await room.save();

    student.room = room._id;
    student.block = room.block._id;
    student.hostel = room.block.hostel;
    student.roomNumber = room.roomNumber;
    await student.save();

    await notify(student._id, `You have been allocated to Room ${room.roomNumber}.`, 'General');
    res.status(200).json({ success: true, data: { student: student._id, room: room._id } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc  Super Admin dashboard analytics
// @route GET /api/admin/analytics
exports.getAnalytics = async (req, res) => {
  try {
    const [departments, students, hods, advisors, wardens, hostels, rooms, pendingRequests, pendingComplaints] = await Promise.all([
      Department.countDocuments(),
      User.countDocuments({ role: 'Student' }),
      User.countDocuments({ role: 'HOD' }),
      User.countDocuments({ role: 'Advisor' }),
      User.countDocuments({ role: 'Warden' }),
      Hostel.countDocuments(),
      Room.countDocuments(),
      Request.countDocuments({ status: { $in: ['Pending Department', 'Pending Warden'] } }),
      Complaint.countDocuments({ status: { $in: ['Pending', 'In Progress'] } })
    ]);

    const allRooms = await Room.find();
    const totalCapacity = allRooms.reduce((s, r) => s + r.capacity, 0);
    const occupiedBeds = allRooms.reduce((s, r) => s + r.occupants.length, 0);
    const occupiedRooms = allRooms.filter(r => r.occupants.length >= r.capacity).length;

    res.status(200).json({
      success: true,
      data: {
        totalDepartments: departments,
        totalStudents: students,
        totalHODs: hods,
        totalAdvisors: advisors,
        totalWardens: wardens,
        totalHostels: hostels,
        totalRooms: rooms,
        occupiedRooms,
        availableRooms: rooms - occupiedRooms,
        occupancyPercentage: totalCapacity ? Math.round((occupiedBeds / totalCapacity) * 100) : 0,
        pendingRequests,
        pendingComplaints
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
