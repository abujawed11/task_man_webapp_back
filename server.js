const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notification');
const path = require('path');

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: 'http://localhost:5173' })); // Allow frontend
app.use(express.json()); // Parse JSON bodies


// 🔽 Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes); // ✅ updated path


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});