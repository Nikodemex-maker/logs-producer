const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'super_secret_key';

app.use(express.json());
app.use(express.static('public'));
app.use(express.static(__dirname));

// Połączenie z MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // wpisz swoje hasło
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

// --- Konfiguracja maila
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'nikodemexfortnitelaptop@gmail.com',
    pass: 'mehl qidz pyho uzdd' // ← tutaj wklej App Password z Gmaila
  }
});

// --- CRON: co 5 minut liczenie statystyk i wysyłka
cron.schedule('*/5 * * * *', () => {
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
          from: 'nikodemexfortnitelaptop@gmail.com',
          to: 'nikodemfullcontrol@gmail.com',
          subject: '📊 Statystyki błędów z systemu',
          text: statsText
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('❌ Błąd przy wysyłce maila:', error.message);
          } else {
            console.log('✅ Statystyki wysłane na maila:', info.response);
          }
        });
      }
    });
  });
});

// --- Start serwera
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
