// const express = require('express');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const authRoutes = require('./routes/auth');
// const taskRoutes = require('./routes/tasks');
// const notificationRoutes = require('./routes/notification');
// const path = require('path');

// dotenv.config();

// const app = express();

// // Middleware
// app.use(cors({ origin: 'http://localhost:5173' })); // Allow frontend
// app.use(express.json()); // Parse JSON bodies


// // 🔽 Serve uploaded files statically
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/tasks', taskRoutes);
// app.use('/api/notifications', notificationRoutes); // ✅ updated path


// // Start server
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notification');
const path = require('path');

dotenv.config();

const app = express();

// ✅ Allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://134.209.149.12',
  'http://task.sun-rack.com/' // ✅ Replace with your actual domain
];

// ✅ CORS middleware with dynamic origin check
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed for this origin: ' + origin));
    }
  },
  credentials: true
}));

// Body parser
app.use(express.json());

// 🔽 Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// Start server
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
});
