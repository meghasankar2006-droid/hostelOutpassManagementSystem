const mongoose = require('mongoose');
const User = require('./backend/models/User');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb://127.0.0.1:27017/smart-hostel').then(async () => {
  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash('password123', salt);
  await User.updateOne({email: 'test4@shanmugha.edu.in'}, {password: password, requirePasswordChange: false});
  console.log('Password reset');
  process.exit(0);
});
