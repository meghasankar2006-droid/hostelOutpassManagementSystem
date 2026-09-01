require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const users = await User.find({});
  console.log(users.map(u => `${u.email} : ${u.role} (pwd: ${u.password})`));
  process.exit(0);
}
check();
