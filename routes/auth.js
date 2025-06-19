const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const dotenv = require('dotenv');

dotenv.config();

const router = express.Router();

// Signup
router.post('/signup', async (req, res) => {
  console.log('Received signup request:', req.body); // Add log
  const { username, email, phoneNumber, role, password } = req.body;

  // Input validation
  if (!username || !email || !phoneNumber || !role || !password) {
    console.log('Validation failed: Missing fields');
    return res.status(400).json({ message: 'All fields are required' });
  }
  if (!/\S+@\S+\.\S+/.test(email)) {
    console.log('Validation failed: Invalid email');
    return res.status(400).json({ message: 'Invalid email format' });
  }
  if (!/^\d{10}$/.test(phoneNumber)) {
    console.log('Validation failed: Invalid phone number');
    return res.status(400).json({ message: 'Phone number must be 10 digits' });
  }
  if (password.length < 6) {
    console.log('Validation failed: Password too short');
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  const validRoles = [
    'Software Developer', 'UI/UX Designer', 'Product Designer', 'Marketing Specialist',
    'Content Writer', 'Project Manager', 'Business Analyst', 'Quality Assurance',
    'DevOps Engineer', 'Data Analyst', 'Digital Marketing', 'Sales Executive', 'HR Professional',
  ];
  if (!validRoles.includes(role)) {
    console.log('Validation failed: Invalid role');
    return res.status(400).json({ message: 'Invalid role' });
  }

  try {
    // Check for existing user
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existingUsers.length > 0) {
      console.log('User already exists:', { username, email });
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (username, email, phone_number, role, password) VALUES (?, ?, ?, ?, ?)',
      [username, email, phoneNumber, role, hashedPassword]
    );

    // Generate JWT
    const user = { id: result.insertId, username, email, phoneNumber, role };
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    console.log('Signup successful:', { userId: user.id, username }); // Add log
    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  console.log('Received login request:', req.body); // Add log
  const { username, password } = req.body;

  // Input validation
  if (!username || !password) {
    console.log('Validation failed: Missing fields');
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    // Find user
    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      console.log('Login failed: User not found:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Login failed: Invalid password for user:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      phoneNumber: user.phone_number,
      role: user.role,
    };

    console.log('Login successful:', { userId: user.id, username }); // Add log
    res.status(200).json({ user: userData, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
