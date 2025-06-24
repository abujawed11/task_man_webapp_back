const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');
const { generateId } = require('../utils/idGenerator');
const { createNotification } = require('../utils/notify');


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


// router.get('/all', async (req, res) => {
//   console.log('✅ /all route hit');
//   res.json([]);
// });

// router.get('/all', authMiddleware, async (req, res) => {
//   try {
//     console.log("Getting All Tasks")
//     const [rows] = await pool.query(
//       // `SELECT id, title, description, priority, status, due_date, assigned_to, created_by, audio_path, file_path, created_at
//       //  FROM tasks`
//       `SELECT * FROM tasks`
//     );
//     res.json(rows);
//   } catch (error) {
//     console.error('Error fetching all tasks:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

//fetch all Task for Admin
router.get('/all', authMiddleware, async (req, res) => {
  try {
    console.log("Getting All Tasks");

    const [rows] = await pool.query(
      `SELECT t.task_id, t.title, t.description, t.priority, t.status, t.due_date,
              COALESCE(tu.assigned_to, t.assigned_to) AS assigned_to,
              t.created_by,
              COALESCE(tu.updated_by, t.created_by) AS assigned_by,
              COALESCE(tu.updated_at, t.created_at) AS last_updated_at,
              t.audio_path, t.file_path, t.created_at
       FROM tasks t
       LEFT JOIN (
         SELECT u1.task_id, u1.assigned_to, u1.updated_by, u1.updated_at
         FROM task_updates u1
         JOIN (
           SELECT task_id, MAX(updated_at) as max_time
           FROM task_updates
           WHERE assigned_to IS NOT NULL
           GROUP BY task_id
         ) u2 ON u1.task_id = u2.task_id AND u1.updated_at = u2.max_time
       ) tu ON t.task_id = tu.task_id`
    );

    res.json(rows);
  } catch (error) {
    console.error('Error fetching all tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



//All users in My Task Filter
router.get('/users/all', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT username from users`);

    res.json(rows); // returns array of { username: '...' }
  } catch (error) {
    console.error('Error fetching all task users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard statistics
// router.get('/dashboard', authMiddleware, async (req, res) => {
//   try {
//     const userName = req.user.username;
//     // console.log(userId)
//     const [[{ assignedToMe }]] = await pool.query(
//       'SELECT COUNT(*) AS assignedToMe FROM tasks WHERE assigned_to = ?',
//       [userName]
//     );

//     const [[{ assignedByMe }]] = await pool.query(
//       'SELECT COUNT(*) AS assignedByMe FROM tasks WHERE created_by = ?',
//       [userName]
//     );

//     const [[{ pending }]] = await pool.query(
//       'SELECT COUNT(*) AS pending FROM tasks WHERE assigned_to = ? AND status = "Pending"',
//       [userName]
//     );

//     const [[{ inProgress }]] = await pool.query(
//       'SELECT COUNT(*) AS inProgress FROM tasks WHERE assigned_to = ? AND status = "In Progress"',
//       [userName]
//     );

//     const [[{ completed }]] = await pool.query(
//       'SELECT COUNT(*) AS completed FROM tasks WHERE assigned_to = ? AND status = "Completed"',
//       [userName]
//     );

//     res.json({
//       stats: { assignedToMe, assignedByMe, pending, inProgress, completed },
//     });
//   } catch (error) {
//     console.error('Error fetching dashboard stats:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const userName = req.user.username;

    // Subquery to get latest assigned_to from task_updates
    const [assignedToMeRow] = await pool.query(`
      SELECT COUNT(DISTINCT t.task_id) AS assignedToMe
      FROM tasks t
      LEFT JOIN (
        SELECT tu.task_id, tu.assigned_to
        FROM task_updates tu
        JOIN (
          SELECT task_id, MAX(updated_at) AS latest
          FROM task_updates
          WHERE assigned_to IS NOT NULL
          GROUP BY task_id
        ) latest_update ON tu.task_id = latest_update.task_id AND tu.updated_at = latest_update.latest
      ) AS latest_assign ON t.task_id = latest_assign.task_id
      WHERE COALESCE(latest_assign.assigned_to, t.assigned_to) = ?
    `, [userName]);

    const [[{ assignedByMe }]] = await pool.query(
      'SELECT COUNT(*) AS assignedByMe FROM tasks WHERE created_by = ?',
      [userName]
    );

    const [statusCounts] = await pool.query(`
      SELECT 
        SUM(CASE WHEN COALESCE(la.assigned_to, t.assigned_to) = ? AND t.status = 'Pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN COALESCE(la.assigned_to, t.assigned_to) = ? AND t.status = 'In Progress' THEN 1 ELSE 0 END) AS inProgress,
        SUM(CASE WHEN COALESCE(la.assigned_to, t.assigned_to) = ? AND t.status = 'Completed' THEN 1 ELSE 0 END) AS completed
      FROM tasks t
      LEFT JOIN (
        SELECT tu.task_id, tu.assigned_to
        FROM task_updates tu
        JOIN (
          SELECT task_id, MAX(updated_at) AS latest
          FROM task_updates
          WHERE assigned_to IS NOT NULL
          GROUP BY task_id
        ) latest_update
        ON tu.task_id = latest_update.task_id AND tu.updated_at = latest_update.latest
      ) la ON t.task_id = la.task_id
    `, [userName, userName, userName]);

    res.json({
      stats: {
        assignedToMe: assignedToMeRow[0].assignedToMe,
        assignedByMe,
        ...statusCounts[0],
      },
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
      'SELECT username FROM users WHERE user_id != ?', [currentUserId]
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

    // ...after task insertion
    await createNotification(assigned_to, `New task "${title}" has been assigned to you by ${created_by}`);

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
    // const [rows] = await pool.query(
    //   `SELECT task_id, title, description, priority, status, due_date, created_by, audio_path, file_path, created_at
    //    FROM tasks WHERE assigned_to = ?`,
    //   [username]
    // );
    const [rows] = await pool.query(
      `SELECT t.*, 
          COALESCE(tu.updated_by, t.created_by) AS assigned_by,
          COALESCE(tu.updated_at, t.created_at) AS last_updated_at
          FROM tasks t
          LEFT JOIN (
              SELECT u1.task_id, u1.assigned_to, u1.updated_by, u1.updated_at
              FROM task_updates u1
              JOIN (
                  SELECT task_id, MAX(updated_at) as max_time
                  FROM task_updates
                  WHERE assigned_to IS NOT NULL
                  GROUP BY task_id
              ) u2 ON u1.task_id = u2.task_id AND u1.updated_at = u2.max_time
          ) tu ON t.task_id = tu.task_id
          WHERE COALESCE(tu.assigned_to, t.assigned_to) = ?`,
      //   `SELECT t.*
      //  FROM tasks t
      //  LEFT JOIN (
      //      SELECT u1.task_id, u1.assigned_to
      //      FROM task_updates u1
      //      JOIN (
      //          SELECT task_id, MAX(updated_at) as max_time
      //          FROM task_updates
      //          WHERE assigned_to IS NOT NULL
      //          GROUP BY task_id
      //      ) u2 ON u1.task_id = u2.task_id AND u1.updated_at = u2.max_time
      //  ) tu ON t.task_id = tu.task_id
      //  WHERE COALESCE(tu.assigned_to, t.assigned_to) = ?`,
      [username]
    );


    res.json(rows);
  } catch (error) {
    console.error('Error fetching assigned tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tasks created by the logged-in user (i.e., assigned by them)
// router.get('/created-by-me', authMiddleware, async (req, res) => {
//   try {
//     const username = req.user.username;
//     const [rows] = await pool.query(
//       `SELECT task_id, title, description, priority, status, due_date, assigned_to, audio_path, file_path, created_at
//        FROM tasks WHERE created_by = ?`,
//       [username]
//     );
//     res.json(rows);
//   } catch (error) {
//     console.error('Error fetching assigned tasks:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

router.get('/created-by-me', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username;

    const [rows] = await pool.query(
      `SELECT t.task_id, t.title, t.description, t.priority, t.status, t.due_date,
              COALESCE(tu.assigned_to, t.assigned_to) AS assigned_to,
              COALESCE(tu.updated_at, t.created_at) AS last_updated_at,
              t.audio_path, t.file_path, t.created_at
       FROM tasks t
       LEFT JOIN (
         SELECT u1.task_id, u1.assigned_to, u1.updated_at
         FROM task_updates u1
         JOIN (
           SELECT task_id, MAX(updated_at) as max_time
           FROM task_updates
           WHERE assigned_to IS NOT NULL
           GROUP BY task_id
         ) u2 ON u1.task_id = u2.task_id AND u1.updated_at = u2.max_time
       ) tu ON t.task_id = tu.task_id
       WHERE t.created_by = ?`,
      [username]
    );

    res.json(rows);
  } catch (error) {
    console.error('Error fetching tasks created by user:', error);
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

// router.put('/:taskId/update', authMiddleware, upload, async (req, res) => {
//   const taskId = req.params.taskId;
//   const username = req.user.username;
//   const { status, title, description, due_date, priority, comment, assigned_to} = req.body;

//   // Clean path generation

//   const audioPath = req.files?.audio ? 'uploads/' + req.files.audio[0].filename : null;
//   const filePath = req.files?.file ? 'uploads/' + req.files.file[0].filename : null;

//   try {
//     // 1. Update only status in tasks table
//     await pool.query(`UPDATE tasks SET status = ? WHERE task_id = ?`, [status, taskId]);

//     // 2. Insert update history into task_updates
//     await pool.query(
//       `INSERT INTO task_updates (task_id, updated_by, status, audio_path, file_path, comment)
//        VALUES (?, ?, ?, ?, ?, ?)`,
//       [taskId, username, status, audioPath, filePath, comment || null]
//     );

//     // 3. If updater is creator, update metadata
//     const [[creatorCheck]] = await pool.query(`SELECT created_by FROM tasks WHERE task_id = ?`, [taskId]);
//     if (creatorCheck.created_by === username) {
//       await pool.query(
//         `UPDATE tasks SET title = ?, description = ?, assigned_to = ?, due_date = ?, priority = ? WHERE task_id = ?`,
//         [title, description, assigned_to, due_date, priority, taskId]
//       );
//     }

//     res.json({ message: 'Task updated and progress saved' });
//   } catch (err) {
//     console.error('Update failed:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

//Update task progress
router.put('/:taskId/update', authMiddleware, upload, async (req, res) => {
  const taskId = req.params.taskId;
  const username = req.user.username;
  const { status, title, description, due_date, priority, comment, assigned_to } = req.body;

  const audioPath = req.files?.audio ? 'uploads/' + req.files.audio[0].filename : null;
  const filePath = req.files?.file ? 'uploads/' + req.files.file[0].filename : null;

  try {
    // 1. Update only status in tasks table
    await pool.query(`UPDATE tasks SET status = ? WHERE task_id = ?`, [status, taskId]);

    // 2. Insert everything else in task_updates table (full version snapshot)
    await pool.query(
      `INSERT INTO task_updates 
        (task_id, updated_by, status, title, description, assigned_to, due_date, priority, audio_path, file_path, comment) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [taskId, username, status, title || null, description || null, assigned_to || null, due_date || null, priority || null, audioPath, filePath, comment || null]
    );

    const [taskRow] = await pool.query(`SELECT created_by FROM tasks WHERE task_id = ?`, [taskId]);
    const creator = taskRow[0]?.created_by;

    // Notify only if updater is not the creator
    if (creator && creator !== username) {
      await createNotification(creator, `Task "${title}" has been updated by ${username}`);
    }

    res.json({ message: 'Task update recorded successfully' });
  } catch (err) {
    console.error('Update failed:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get task progress timeline
// router.get('/:taskId/progress', authMiddleware, async (req, res) => {
//   const { taskId } = req.params;

//   try {
//     const [updates] = await pool.query(
//       `SELECT 
//          updated_by, 
//          status, 
//          comment, 
//          audio_path, 
//          file_path, 
//          updated_at 
//        FROM task_updates 
//        WHERE task_id = ? 
//        ORDER BY updated_at ASC`,
//       [taskId]
//     );

//     res.status(200).json(updates);
//   } catch (error) {
//     console.error('Error fetching task progress:', error);
//     res.status(500).json({ message: 'Failed to fetch task progress' });
//   }
// });

// In tasks.js
router.get('/:taskId/progress', authMiddleware, async (req, res) => {
  const { taskId } = req.params;

  try {
    // 1. Fetch original task
    const [taskRows] = await pool.query(
      `SELECT title, description, created_by, assigned_to, status, priority, due_date, created_at, audio_path, file_path
       FROM tasks WHERE task_id = ?`,
      [taskId]
    );
    if (taskRows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const originalTask = taskRows[0];

    // 2. Fetch updates
    const [updates] = await pool.query(
      `SELECT updated_by, status, assigned_to, comment, audio_path, file_path, updated_at
       FROM task_updates WHERE task_id = ? ORDER BY updated_at ASC`,
      [taskId]
    );

    res.json({ task: originalTask, updates });
  } catch (err) {
    console.error('Error fetching task progress:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get all tasks (Super Admin only)
// router.get('/all', authMiddleware, superAdminMiddleware, async (req, res) => {
//   try {
//     const [rows] = await pool.query(
//       `SELECT id, title, description, priority, status, due_date, assigned_to, created_by, audio_path, file_path, created_at
//        FROM tasks`
//     );
//     res.json(rows);
//   } catch (error) {
//     console.error('Error fetching all tasks:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });









module.exports = router;
