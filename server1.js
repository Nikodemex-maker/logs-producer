const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const nodemailer = require('nodemailer');   // <-- dodane

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'super_secret_key';

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(express.static(__dirname));

// Połączenie z MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',    // wpisz swoje hasło
  database: 'logs'
});

connection.connect(err => {
  if (err) {
    console.error('MySQL connection error:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL!');
});

// Helper – zapis błędów backendowych
function logError(message, req, source = 'BACKEND') {
  const sql = 'INSERT INTO logs (level, source, message, user_ip, user_agent) VALUES (?, ?, ?, ?, ?)';
  connection.query(sql, [
    'ERROR',
    source,
    String(message),
    req?.ip || null,
    req?.headers?.['user-agent'] || null
  ], (err) => {
    if (err) {
      console.error('Failed to save error log:', err.message);
    }
  });
}

// --- Auth middleware
function auth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ message: 'Missing token' });
  const token = header.split(' ')[1];
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

// --- Rejestracja
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Missing data' });

    const hashed = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
    connection.query(sql, [username, hashed], (err) => {
      if (err) {
        logError('REGISTER DB ERROR: ' + err.message, req);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ message: 'User registered successfully' });
    });
  } catch (e) {
    logError('REGISTER SERVER ERROR: ' + e.message, req);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Logowanie
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing data' });

  const sql = 'SELECT * FROM users WHERE username = ?';
  connection.query(sql, [username], async (err, results) => {
    if (err) {
      logError('LOGIN DB ERROR: ' + err.message, req);
      return res.status(500).json({ message: 'Database error' });
    }
    if (results.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful', token });
  });
});

// --- Profile
app.get('/api/profile', auth, (req, res) => {
  res.json({ message: `Hello ${req.user.username}, this is your profile.` });
});

// --- Zadania
app.get('/api/tasks', (req, res) => {
  connection.query('SELECT * FROM tasks', (err, results) => {
    if (err) {
      logError('Error fetching tasks: ' + err.message, req);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(results);
  });
});

app.post('/api/tasks', (req, res) => {
  const { task, status, deadline } = req.body;
  if (!task || !status || !deadline) {
    logError('Missing task data', req);
    return res.status(400).json({ message: 'Missing task data' });
  }
  const sql = 'INSERT INTO tasks (task, status, deadline) VALUES (?, ?, ?)';
  connection.query(sql, [task, status, deadline], (err) => {
    if (err) {
      logError('Error saving task: ' + err.message, req);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json({ message: 'Task saved successfully' });
  });
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM tasks WHERE id = ?';
  connection.query(sql, [id], (err, result) => {
    if (err) {
      logError('Error deleting task: ' + err.message, req);
      return res.status(500).json({ message: 'Database error' });
    }
    if (result.affectedRows === 0) {
      logError(`Task not found for id=${id}`, req);
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  });
});

// --- Logi
app.get('/api/logs', (req, res) => {
  connection.query('SELECT * FROM logs ORDER BY timestamp DESC', (err, results) => {
    if (err) {
      logError('Error fetching logs: ' + err.message, req);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(results);
  });
});

app.post('/api/logs', (req, res) => {
  const { level, message, user_agent, source } = req.body;
  if (!message) return res.status(400).json({ message: 'Missing log message' });

  const sql = 'INSERT INTO logs (level, source, message, user_ip, user_agent) VALUES (?, ?, ?, ?, ?)';
  connection.query(sql, [
    level || 'ERROR',
    source ,
    message,
    req.ip,
    user_agent || req.headers['user-agent']
  ], (err) => {
    if (err) {
      logError('Error saving frontend log: ' + err.message, req);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json({ message: 'Log saved successfully' });
  });
});

// --- Wysyłanie logów na maila
app.get('/api/send-logs', (req, res) => {
  connection.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 10', async (err, results) => {
    if (err) {
      logError('Error fetching logs for email: ' + err.message, req);
      return res.status(500).json({ message: 'Database error' });
    }

    try {
      await transporter.sendMail(mailOptions);
      res.json({ message: 'Logs sent via email!' });
    } catch (e) {
      logError('Error sending  logs via email: ' + e.message, req);
      res.status(500).json({ message: 'Email send error' });
    }
  });
});

// --- Serwowanie strony (przykładowy widok)
app.get('/log', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'log.html'));
});

// --- Globalny handler błędów
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  logError('Unhandled error: ' + err.message, req);
  res.status(500).json({ message: 'Server error' });
});

// --- CRON: odświeżanie co 10 sekund
cron.schedule('*/10 * * * * *', () => {
  console.log('⏰ CRON: odświeżanie listy zadań...');

  // Podgląd zadań
  connection.query('SELECT * FROM logs', (err, results) => {
    if (err) {
      console.error('Błąd przy pobieraniu zadań:', err.message);
      return;
    }
    console.log('Aktualne zadania:', results);
  });

  // --- Agregacja błędów
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

  const keys = Object.keys(queries);
  let done = 0;
  const stats = {};

  keys.forEach(key => {
    connection.query(queries[key], (err, rows) => {
      if (err) {
        console.error(`❌ Błąd przy liczeniu ${key}:`, err.message);
        stats[key] = null;
      } else {
        stats[key] = rows[0].count;
      }
      done++;
      if (done === keys.length) {
        console.log("📊 Statystyki błędów (CRON):");
        console.log(stats);
      }
    });
  });
});

// Start serwera
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});



// Wyświetlanie w cmd powyższego kodu
  app.get('/api/error-aggregate', (req, res) => {
  const sql = "SELECT COUNT(*) AS count FROM logs WHERE level='ERROR' AND timestamp >= NOW() - INTERVAL 30 MINUTE";
  connection.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json({ last30m: rows[0].count });
  });
});
