const mongoose = require('mongoose');
const User = require('./backend/models/User');

mongoose.connect('mongodb://127.0.0.1:27017/smart-hostel').then(async () => {
  const user = await User.findOne({email: 'adv.cse4@shanmugha.edu.in'});
  console.log(user);
  process.exit(0);
});
