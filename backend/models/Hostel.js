const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  warden: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  blocks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Block'
  }]
}, { timestamps: true });

module.exports = mongoose.model('Hostel', hostelSchema);
