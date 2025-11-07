// Importuje bibliotekę Express — służy do tworzenia serwera HTTP
    const express = require('express');

// Importuje moduł 'path' — pomaga tworzyć ścieżki do plików
    const path = require('path');

// Tworzy aplikację Express
    const app = express();

// Obsługuje żądanie GET na ścieżkę główną ('/')
    app.use(express.static('public'));

// Ustawia port — domyślnie 3000
    const PORT = process.env.PORT || 3000;

// Uruchamia serwer i wypisuje komunikat w konsoli
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

// Serwowanie pliku log.html pod /log
    app.get('/log', (req, res) => {
        res.sendFile(path.join(__dirname, 'log.html'));
    });

// Serwowanie plików statycznych (np. logo.png)
    app.use(express.static(__dirname));

//Obsługuje żądanie GET na ścieżkę /api/data i zwraca tablicę Users
app.get('/api/tasks', (req, res) => { 
    res.json(Tasks); 
});

//Middleware do parsowania JSON — musi być przed POST
 app.use(express.json());
//Tworzy przykładową tablicę użytkowników
    let Tasks = [
      {
        task: "Finish homework", 
        status: "In progress",
        deadline: "Before evening"  
      }  
    ]
//GET /api/tasks — zwraca dane użytkowników
app.get('/api/tasks', (req, res) => {
    res.json(Tasks);
});
//POST /api/tasks — odbiera dane z formularza i wysyła do bazy danych
app.post('/api/tasks', (req, res) => {
    const { task, status, deadline } = req.body;
//Sprawdza poprawność danych w formularzu
    if (!task || !status || !deadline) {
        return res.status(400).json({ message: 'Brakuje danych zadania' });
    }

    // Zapisz do lokalnej tablicy (opcjonalnie)
    //Tasks.push({ task, status, deadline });

    // Zapisz do bazy danych
    const sql = 'INSERT INTO tasks (task, status, deadline) VALUES (?, ?, ?)';
    connection.query(sql, [task, status, deadline], (err, result) => {
        if (err) {
            console.error('Error saving to the database:', err);
            return res.status(500).json({ message: 'Database error' });//500 wystąpił błąd po stronie serwera.
        }
        console.log('Task saved to the database');
        res.json({ message: 'Task saved successfully' });
    });
});

const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // lub 'admin' jeśli ustawiłeś hasło
  database: 'logs' // nazwij bazę jak chcesz
});

connection.connect(err => {
  if (err) {
    console.error('MySQL connection error:', err);
    return;
  }
  console.log('Connected to MySQL!');
});



