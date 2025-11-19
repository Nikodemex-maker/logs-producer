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

// Create task
app.get('/api/tasks', (req, res) => {
  connection.query('SELECT * FROM tasks', (err, results) => {
    if (err) {
      logError('Error fetching tasks: ' + err.message, req);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(results);
  });
});

// Read Task
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

// Delete Task
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
// Update Task
app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { task, status, deadline } = req.body;

  if (!task || !status || !deadline) {
    logError('Missing task data for update', req);
    return res.status(400).json({ message: 'Missing task data' });
  }

  const sql = 'UPDATE tasks SET task = ?, status = ?, deadline = ? WHERE id = ?';
  connection.query(sql, [task, status, deadline, id], (err, result) => {
    if (err) {
      logError('Error updating task: ' + err.message, req);
      return res.status(500).json({ message: 'Database error' });
    }
    if (result.affectedRows === 0) {
      logError(`Task not found for update id=${id}`, req);
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json({ message: 'Task updated successfully' });
  });
});


// --- Reset form
function resetForm() {
  document.querySelector("#task").value = "";
  document.querySelector("#status").value = "";
  document.querySelector("#deadline").value = "";
  editingTaskId = null;
  document.querySelector("#save-btn").style.display = "inline-block";
  document.querySelector("#update-btn").style.display = "none";
}


// Połączenie z MySQL
const connection = mysql.createConnection({
  host: process.env.DB_HOST, //wykorzystanie .env
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME
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

// --- Konfiguracja maila
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS // ← tutaj wklej App Password z Gmaila
  }
});

// --- CRON: co 5 minut liczenie statystyk i wysyłka
cron.schedule('*/15 * * * *', () => {
  console.log('⏰ CRON: liczenie statystyk błędów...');

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
  const stats = {};
  let completed = 0;

  keys.forEach(key => {
    connection.query(queries[key], (err, rows) => {
      stats[key] = err ? 'Błąd' : rows[0].count;
      completed++;

      if (completed === keys.length) {
        // --- Wyświetlenie w konsoli
        console.log("📊 Statystyki błędów:");
        console.log(stats);

        // --- Treść maila
        const statsText = Object.entries(stats)
          .map(([label, count]) => `${label}: ${count}`)
          .join('\n');

        const mailOptions = {
          from: process.env.MAIL_USER,
          to: process.env.MAIL_TO,
          subject: '📊 Statystyki błędów z systemu',
          text: statsText
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('❌ Błąd przy wysyłce maila:', error.message);
          } else {
            console.log('✅ Statystyki wysłane na maila:');
          }
        });
      }
    });
  });
});

// --- CRON: codziennie o 8:00 wysyłka zadań do zrobienia
cron.schedule('0 8 * * 1-5', () => {
  console.log('⏰ CRON: wysyłka zadań do zrobienia...');

  const sql = "SELECT task, status, deadline FROM tasks";

  connection.query(sql, (err, rows) => {
    if (err) {
      console.error('❌ Błąd przy pobieraniu zadań:', err.message);
      return;
    }

    if (rows.length === 0) {
      console.log('Brak zadań do wysłania.');
      return;
    }

    // --- Treść maila
    const tasksText = rows.map(row => {
      return `📝 ${row.task} | 📌 ${row.status} | ⏰ ${row.deadline}`;
    }).join('\n');

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: process.env.MAIL_TO,
      subject: '📋 Zadania do zrobienia',
      text: tasksText
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('❌ Błąd przy wysyłce maila:', error.message);
      } else {
        console.log('✅ Zadania wysłane na maila!');
      }
    });
  });
});


// --- Start serwera
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
