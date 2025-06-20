const express = require('express');
const pool = require('../config/db');
const router = express.Router();

// Middleware to verify JWT
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Get dashboard statistics
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [[{ assignedToMe }]] = await pool.query(
      'SELECT COUNT(*) AS assignedToMe FROM tasks WHERE assigned_to = ?',
      [userId]
    );

    const [[{ assignedByMe }]] = await pool.query(
      'SELECT COUNT(*) AS assignedByMe FROM tasks WHERE created_by = ?',
      [userId]
    );

    const [[{ pending }]] = await pool.query(
      'SELECT COUNT(*) AS pending FROM tasks WHERE assigned_to = ? AND status = "Pending"',
      [userId]
    );

    const [[{ inProgress }]] = await pool.query(
      'SELECT COUNT(*) AS inProgress FROM tasks WHERE assigned_to = ? AND status = "In Progress"',
      [userId]
    );

    const [[{ completed }]] = await pool.query(
      'SELECT COUNT(*) AS completed FROM tasks WHERE assigned_to = ? AND status = "Completed"',
      [userId]
    );

    res.json({
      stats: { assignedToMe, assignedByMe, pending, inProgress, completed },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;