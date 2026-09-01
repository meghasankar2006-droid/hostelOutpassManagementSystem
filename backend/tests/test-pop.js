const mongoose = require('mongoose');
const Request = require('./backend/models/Request');
const User = require('./backend/models/User'); const Department = require('./backend/models/Department');

mongoose.connect('mongodb://127.0.0.1:27017/smart-hostel').then(async () => {
  try {
    let req = await Request.findOne().sort('-createdAt');
    console.log('Before populate, student is:', req.student);
    
    await req.populate({
      path: 'student',
      populate: { path: 'department' }
    });
    
    console.log('After populate, student email is:', req.student ? req.student.email : 'UNDEFINED');
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
});
