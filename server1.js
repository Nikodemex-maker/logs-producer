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
//POST /api/tasks — odbiera dane z formularza
app.post('/api/tasks', (req, res) => {
    Tasks.push(req.body);
    console.log("Received tasks:", req.body);
    res.json({message: "Tasks received"});
})
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



