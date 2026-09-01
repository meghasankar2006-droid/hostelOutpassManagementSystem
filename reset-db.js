const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./backend/models/User');
const Department = require('./backend/models/Department');
const Request = require('./backend/models/Request');
const Complaint = require('./backend/models/Complaint');
const Hostel = require('./backend/models/Hostel');
const Room = require('./backend/models/Room');

const Block = require('./backend/models/Block');

async function resetAndSeed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    console.log('Wiping database...');
    // Delete all users except SuperAdmin
    const resUsers = await User.deleteMany({ role: { $ne: 'SuperAdmin' } });
    console.log(`Deleted ${resUsers.deletedCount} non-SuperAdmin users.`);
    
    // Check SuperAdmin
    const superAdmin = await User.findOne({ role: 'SuperAdmin' });
    if (!superAdmin) {
      const salt = await bcrypt.genSalt(10);
      const password = await bcrypt.hash('password123', salt);
      await User.create({
        name: 'Super Admin',
        email: 'admin@hostel.com',
        password,
        role: 'SuperAdmin'
      });
      console.log('Created missing SuperAdmin account.');
    }

    const resReqs = await Request.deleteMany({});
    console.log(`Deleted ${resReqs.deletedCount} requests.`);
    
    const resComps = await Complaint.deleteMany({});
    console.log(`Deleted ${resComps.deletedCount} complaints.`);

    const resDepts = await Department.deleteMany({});
    console.log(`Deleted ${resDepts.deletedCount} departments.`);

    const resHostels = await Hostel.deleteMany({});
    console.log(`Deleted ${resHostels.deletedCount} hostels.`);
    
    const resBlocks = await Block.deleteMany({});
    console.log(`Deleted ${resBlocks.deletedCount} blocks.`);

    const resRooms = await Room.deleteMany({});
    console.log(`Deleted ${resRooms.deletedCount} rooms.`);

    console.log('\n--- Seeding Base Structure ---');
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('password123', salt);

    // Create HOD
    const hod = await User.create({
      name: 'Dr. Srinivasan',
      email: 'hod.cse@shanmugha.edu.in',
      password: defaultPassword,
      role: 'HOD',
      mustChangePassword: true
    });

    // Create Department
    const dept = await Department.create({
      name: 'CSE',
      hod: hod._id,
      advisors: []
    });

    hod.assignedDepartment = dept._id;
    await hod.save();

    // Create 4 Advisors
    const advisors = [];
    for (let i = 1; i <= 4; i++) {
      const adv = await User.create({
        name: `Advisor Year ${i}`,
        email: `adv.y${i}@shanmugha.edu.in`,
        password: defaultPassword,
        role: 'Advisor',
        mustChangePassword: true,
        department: dept._id,
        year: i
      });
      adv.assignedDepartment = dept._id;
      await adv.save();
      advisors.push(adv._id);
    }
    
    dept.advisors = advisors;
    await dept.save();
    console.log('Created CSE Department with 1 HOD and 4 Year Advisors.');

    // Create Warden
    const warden = await User.create({
      name: 'Warden Arun',
      email: 'warden.a@shanmugha.edu.in',
      password: defaultPassword,
      role: 'Warden',
      mustChangePassword: true
    });

    // Create Hostel
    const hostel = await Hostel.create({
      name: 'Boys Hostel A',
      warden: warden._id
    });
    
    // Create Block
    const block = await Block.create({
      name: 'Main Block',
      hostel: hostel._id
    });
    console.log('Created Boys Hostel A and Main Block, assigned Warden Arun.');

    // Create a Room
    await Room.create({
      roomNumber: 'A-101',
      hostel: hostel._id,
      block: block._id,
      capacity: 4,
      occupants: []
    });
    console.log('Created Room A-101.');

    console.log('\nReset and seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error during reset:', err);
    process.exit(1);
  }
}

resetAndSeed();
