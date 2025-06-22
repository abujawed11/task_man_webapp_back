const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');
const { generateId } = require('../utils/idGenerator');


// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'application/pdf',
    'image/jpeg',
    'image/png',
  ];
  cb(null, allowed.includes(file.mimetype));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: 'audio', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);


// Get dashboard statistics
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const userName = req.user.username;
    // console.log(userId)
    const [[{ assignedToMe }]] = await pool.query(
      'SELECT COUNT(*) AS assignedToMe FROM tasks WHERE assigned_to = ?',
      [userName]
    );

    const [[{ assignedByMe }]] = await pool.query(
      'SELECT COUNT(*) AS assignedByMe FROM tasks WHERE created_by = ?',
      [userName]
    );

    const [[{ pending }]] = await pool.query(
      'SELECT COUNT(*) AS pending FROM tasks WHERE assigned_to = ? AND status = "Pending"',
      [userName]
    );

    const [[{ inProgress }]] = await pool.query(
      'SELECT COUNT(*) AS inProgress FROM tasks WHERE assigned_to = ? AND status = "In Progress"',
      [userName]
    );

    const [[{ completed }]] = await pool.query(
      'SELECT COUNT(*) AS completed FROM tasks WHERE assigned_to = ? AND status = "Completed"',
      [userName]
    );

    res.json({
      stats: { assignedToMe, assignedByMe, pending, inProgress, completed },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


router.get('/list', authMiddleware, async (req, res) => {
  try {
    console.log("list fetched");
    const currentUserId = req.user.id;
    // console.log(currentUserId)
    const [rows] = await pool.query(
      'SELECT username FROM users WHERE account_type != "Super Admin" AND user_id != ?', [currentUserId]
    );

    // Extract usernames only
    const usernames = rows.map(user => user.username);

    res.json(usernames);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create Task with `due_date`
router.post('/create', authMiddleware, upload, async (req, res) => {
  const { title, description, priority, assigned_to, due_date } = req.body;
  const created_by = req.user.username;

  if (!title || !assigned_to) {
    return res.status(400).json({ message: 'Title and assigned user are required' });
  }

  try {
    const taskId = await generateId('TASK', 'tasks', 'task_id');

    const audioPath = req.files?.audio ? 'uploads/' + req.files.audio[0].filename : null;
    const filePath = req.files?.file ? 'uploads/' + req.files.file[0].filename : null;

    await pool.query(
      `INSERT INTO tasks (task_id, title, description, priority, status, assigned_to, created_by, audio_path, file_path, due_date)
       VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?)`,
      [
        taskId,
        title,
        description || null,
        priority || 'Medium',
        assigned_to,
        created_by,
        audioPath,
        filePath,
        due_date || null,
      ]
    );

    res.status(201).json({ message: 'Task created successfully', taskId }); // Send custom taskId back
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tasks assigned to the logged-in user
router.get('/assigned', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username;
    console.log('Fetching tasks for user:', username);
    const [rows] = await pool.query(
      `SELECT task_id, title, description, priority, status, due_date, created_by, audio_path, file_path, created_at
       FROM tasks WHERE assigned_to = ?`,
      [username]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching assigned tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tasks created by the logged-in user (i.e., assigned by them)
router.get('/created-by-me', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username;
    const [rows] = await pool.query(
      `SELECT task_id, title, description, priority, status, due_date, assigned_to, audio_path, file_path, created_at
       FROM tasks WHERE created_by = ?`,
      [username]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching assigned tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET a single task by ID
router.get('/:taskId', authMiddleware, async (req, res) => {
  const taskId = req.params.taskId;

  try {
    const [rows] = await pool.query(
      `SELECT task_id, title, description, priority, status, due_date, created_by, assigned_to, audio_path, file_path, created_at
       FROM tasks WHERE task_id = ?`,
      [taskId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching task by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

router.put('/:taskId/update', authMiddleware, upload, async (req, res) => {
  const taskId = req.params.taskId;
  const username = req.user.username;
  const { status, title, description, due_date, priority, comment, assigned_to} = req.body;

  // Clean path generation
  
  const audioPath = req.files?.audio ? 'uploads/' + req.files.audio[0].filename : null;
  const filePath = req.files?.file ? 'uploads/' + req.files.file[0].filename : null;

  try {
    // 1. Update only status in tasks table
    await pool.query(`UPDATE tasks SET status = ? WHERE task_id = ?`, [status, taskId]);

    // 2. Insert update history into task_updates
    await pool.query(
      `INSERT INTO task_updates (task_id, updated_by, status, audio_path, file_path, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [taskId, username, status, audioPath, filePath, comment || null]
    );

    // 3. If updater is creator, update metadata
    const [[creatorCheck]] = await pool.query(`SELECT created_by FROM tasks WHERE task_id = ?`, [taskId]);
    if (creatorCheck.created_by === username) {
      await pool.query(
        `UPDATE tasks SET title = ?, description = ?, assigned_to = ?, due_date = ?, priority = ? WHERE task_id = ?`,
        [title, description, assigned_to, due_date, priority, taskId]
      );
    }

    res.json({ message: 'Task updated and progress saved' });
  } catch (err) {
    console.error('Update failed:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
