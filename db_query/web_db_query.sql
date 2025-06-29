

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(10) UNIQUE, -- USER0001, USER0002, ...
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone_number VARCHAR(15) NOT NULL,
  role VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL DEFAULT 'User',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id VARCHAR(10) UNIQUE, -- TASK0001, TASK0002, ...
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'Medium',
  status VARCHAR(50) DEFAULT 'Pending',
  due_date DATE,
  assigned_to VARCHAR(50) NOT NULL,  -- references username
  created_by VARCHAR(50) NOT NULL,   -- references username
  audio_path VARCHAR(255) DEFAULT NULL,
  file_path VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(username),
  FOREIGN KEY (created_by) REFERENCES users(username)
);

CREATE TABLE task_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id VARCHAR(10) NOT NULL,             -- references tasks.task_id
  updated_by VARCHAR(50) NOT NULL,          -- references users.username
  status VARCHAR(50),
  title VARCHAR(255),
  description TEXT,
  assigned_to VARCHAR(50),
  assigned_by VARCHAR(50),                  -- NEW: who assigned the task
  due_date DATE,
  priority VARCHAR(50),
  audio_path VARCHAR(255),
  file_path VARCHAR(255),
  comment TEXT,
  is_system_generated BOOLEAN DEFAULT FALSE, -- NEW: for system-generated logs
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(username),
  FOREIGN KEY (assigned_to) REFERENCES users(username),
  FOREIGN KEY (assigned_by) REFERENCES users(username)
);



CREATE TABLE otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  INDEX idx_email (email)
);

CREATE TABLE invite_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO invite_codes (code) VALUES ('SUPERADMIN2026');


CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receiver VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notification_id VARCHAR(10) UNIQUE,
  task_id VARCHAR(10),
  sender VARCHAR(50),
  receiver VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  message TEXT NULL,           -- Now optional
  updates TEXT,                -- New: JSON string of updated fields
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE SET NULL,
  FOREIGN KEY (receiver) REFERENCES users(username),
  FOREIGN KEY (sender) REFERENCES users(username)
);




