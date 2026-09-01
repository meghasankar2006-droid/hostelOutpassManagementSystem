const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/smart-hostel').then(async () => {
  await mongoose.connection.collection('users').updateOne(
    { email: 'e23cs021@shanmugha.edu.in' },
    { $set: { password: '$2b$10$bhkq.ZV5CKwsiOKPdSUITuMv15pKwIIaX8Imgjy3Pn1zwhAlxeGnO' } }
  );
  console.log('Updated password');
  process.exit(0);
});
