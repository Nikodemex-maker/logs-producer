const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'super_secret_key';

app.use(express.json());
app.use(express.static('public'));
app.use(express.static(__dirname));

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "log.html"));
});

// --- MySQL connection
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

connection.connect(err => {
  if (err) {
    console.error('MySQL connection error:', err);
    process.exit(1);
  }
  console.log('✅ Connected to MySQL!');
});

// --- JWT middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

// --- Register
app.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  connection.query(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    [email, password], // <-- zapisujemy hasło wprost
    (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already exists' });
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ message: 'User registered successfully' });
    }
  );
});


// --- Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(401).json({ message: 'Invalid email or password' });

    const user = results[0];
    if (password !== user.password_hash) { // <-- zwykłe porównanie
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ email: user.email, id: user.id }, SECRET, { expiresIn: '1h' });
    res.json({ token });
  });
});

// --- Refresh password
app.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ message: 'Missing data' });

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });

    const email = decoded.email;
    connection.query('UPDATE users SET password_hash=? WHERE email=?', [newPassword, email], (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
      res.json({ message: 'Password updated successfully' });
    });
  });
});

// --- Tasks CRUD (protected)
app.get('/api/tasks', authenticateToken, (req, res) => {
  connection.query('SELECT * FROM tasks', (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(results);
  });
});

app.post('/api/tasks', authenticateToken, (req, res) => {
  const { task, status, deadline } = req.body;
  if (!task || !status || !deadline) return res.status(400).json({ message: 'Missing task data' });

  connection.query(
    'INSERT INTO tasks (task, status, deadline) VALUES (?, ?, ?)',
    [task, status, deadline],
    (err) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json({ message: 'Task saved successfully' });
    }
  );
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { task, status, deadline } = req.body;
  if (!task || !status || !deadline) return res.status(400).json({ message: 'Missing task data' });

  connection.query(
    'UPDATE tasks SET task=?, status=?, deadline=? WHERE id=?',
    [task, status, deadline, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Task not found' });
      res.json({ message: 'Task updated successfully' });
    }
  );
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  connection.query('DELETE FROM tasks WHERE id=?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task deleted successfully' });
  });
});

// --- Nodemailer config
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// --- CRON: co 5 minut statystyki błędów
cron.schedule('0 */5 * * *', () => {
  console.log('⏰ CRON: counting error stats...');
  const queries = {
    last30m: "SELECT COUNT(*) AS count FROM logs WHERE level='ERROR' AND timestamp >= NOW() - INTERVAL 30 MINUTE",
    last1h: "SELECT COUNT(*) AS count FROM logs WHERE level='ERROR' AND timestamp >= NOW() - INTERVAL 1 HOUR",
    last2h: "SELECT COUNT(*) AS count FROM logs WHERE level='ERROR' AND timestamp >= NOW() - INTERVAL 2 HOUR",
    last6h: "SELECT COUNT(*) AS count FROM logs WHERE level='ERROR' AND timestamp >= NOW() - INTERVAL 6 HOUR",
    today: "SELECT COUNT(*) AS count FROM logs WHERE level='ERROR' AND DATE(timestamp) = CURDATE()",
    yesterday: "SELECT COUNT(*) AS count FROM logs WHERE level='ERROR' AND DATE(timestamp) = CURDATE() - INTERVAL 1 DAY",
    thisWeek: "SELECT COUNT(*) AS count FROM logs WHERE level='ERROR' AND YEARWEEK(timestamp, 1) = YEARWEEK(CURDATE(), 1)",
    lastWeek: "SELECT COUNT(*) AS count FROM logs WHERE level='ERROR' AND YEARWEEK(timestamp, 1) = YEARWEEK(CURDATE() - INTERVAL 1 WEEK, 1)"
  };
  const stats = {};
  let completed = 0;
  const keys = Object.keys(queries);

  keys.forEach(key => {
    connection.query(queries[key], (err, rows) => {
      stats[key] = err ? 'Error' : rows[0].count;
      completed++;
      if (completed === keys.length) {
        const statsText = Object.entries(stats).map(([label, count]) => `${label}: ${count}`).join('\n');
        const mailOptions = {
          from: process.env.MAIL_USER,
          to: process.env.MAIL_TO,
          subject: '📊 Error statistics',
          text: statsText
        };
        transporter.sendMail(mailOptions, (error) => {
          if (error) console.error('❌ Mail error:', error);
          else console.log('✅ Stats mail sent');
        });
      }
    });
  });
});

// --- CRON: codziennie o 8:00 wysyłka zadań
cron.schedule('0 8 * * 1-5', () => {
  console.log('⏰ CRON: sending tasks...');
  const sql = "SELECT task, status, deadline FROM tasks";
  connection.query(sql, (err, rows) => {
    if (err) {
      console.error('❌ Error fetching tasks:', err.message);
      return;
    }
    if (rows.length === 0) {
      console.log('No tasks to send.');
      return;
    }
    const tasksText = rows.map(row => `📝 ${row.task} | 📌 ${row.status} | ⏰ ${row.deadline}`).join('\n');
    const mailOptions = {
      from: process.env.MAIL_USER,
      to: process.env.MAIL_TO,
      subject: '📋 Tasks to do',
      text: tasksText
    };
    transporter.sendMail(mailOptions, (error) => {
      if (error) console.error('❌ Mail error:', error);
      else console.log('✅ Tasks mail sent!');
    });
  });
});

app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });

  connection.query('SELECT * FROM users WHERE email=?', [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(404).json({ message: 'User not found' });

    const token = jwt.sign({ email }, SECRET, { expiresIn: '15m' }); // ważny 15 minut
    const resetLink = `http://localhost:${PORT}/reset-password?token=${token}`;
    const mailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: '🔑 Reset your password',
      text: `Click here to reset your password: ${resetLink}`
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) return res.status(500).json({ message: 'Mail error' });
      res.json({ message: 'Reset link sent to email' });
    });
  });
});

//--- Reset password
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'reset.html'));
});

// --- Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
