// Importy – wczytujemy potrzebne biblioteki
const express = require('express');
const path = require('path');
const mysql = require('mysql2');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Start serwera
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.get('/log', (req, res) => {
  res.sendFile(path.join(__dirname, 'log.html'));
});


// Middleware – obsługa JSON i plików statycznych
app.use(express.json());
app.use(express.static('public'));
app.use(express.static(__dirname));

// --- DB connection (połączenie z bazą MySQL)
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // ustaw swoje hasło
  database: 'logs' // baza z tabelami tasks i logs
});

connection.connect(err => {
  if (err) {
    console.error('MySQL connection error:', err);
    process.exit(1); // zatrzymuje serwer jeśli brak połączenia
  }
  console.log('Connected to MySQL!');
});

// --- Helper: zapisuje WYŁĄCZNIE błędy
function logError(message, req) {
  console.log('Trying to save error log:', message); // debug w CMD
  const sql = 'INSERT INTO logs (level, message, user_ip, user_agent) VALUES (?, ?, ?, ?)';
  connection.query(sql, [
    'ERROR',
    String(message),
    req?.ip || null,
    req?.headers?.['user-agent'] || null
  ], (err) => {
    if (err) {
      console.error('Failed to save error log:', err.sqlMessage || err.message);
    } else {
      console.log('Error log saved to DB');
    }
  });
}

// --- ROUTES

// Pobieranie wszystkich zadań
app.get('/api/tasks', (req, res) => {
  const sql = 'SELECT * FROM tasks';
  connection.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching tasks:', err);
      logError('Error fetching tasks: ' + (err.sqlMessage || err.message), req);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(results);
  });
});

// Dodawanie zadania
app.post('/api/tasks', (req, res) => {
// Celowy błąd – żeby sprawdzić globalny logger -> throw new Error("Missing database")
  const { task, status, deadline } = req.body;

  if (!task || !status || !deadline) {
    logError('Missing task data', req);
    return res.status(400).json({ message: 'Missing task data' });
  }

  const sql = 'INSERT INTO tasks (task, status, deadline) VALUES (?, ?, ?)';
  connection.query(sql, [task, status, deadline], (err) => {
    if (err) {
      console.error('Error saving task:', err);
      logError('Error saving task: ' + (err.sqlMessage || err.message), req);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json({ message: 'Task saved successfully' });
  });
});

// Usuwanie zadania
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM tasks WHERE id = ?';

  connection.query(sql, [id], (err, result) => {
    if (err) {
      console.error('Error deleting task:', err);
      logError('Error deleting task: ' + (err.sqlMessage || err.message), req);
      return res.status(500).json({ message: 'Database error' });
    }
    if (result.affectedRows === 0) {
      logError(`Task not found for id=${id}`, req);
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  });
});

// --- Global error handler – łapie wszystkie nieobsłużone wyjątki
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  logError('Unhandled error: ' + (err.message || err), req);
  res.status(500).json({ message: 'Server error' });
});
