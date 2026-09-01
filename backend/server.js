const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Basic route for API check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running' });
});

// API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/student', require('./routes/studentRoutes'));
app.use('/api/department', require('./routes/departmentRoutes'));
app.use('/api/warden', require('./routes/wardenRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Serve frontend (single static mount, resolved from this file's location
// so it works no matter what directory the process is started from)
app.use(express.static(path.join(__dirname, '../frontend')));

// Any non-API GET that doesn't match a static file falls back to the login page
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
