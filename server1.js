// Importuje bibliotekę Express — służy do tworzenia serwera HTTP
    const express = require('express');

// Importuje moduł 'path' — pomaga tworzyć ścieżki do plików
    const path = require('path');

// Tworzy aplikację Express
    const app = express();

// Obsługuje żądanie GET na ścieżkę główną ('/')
    app.use(express.static('public'));{
    };

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

app.get('/api/data', (req, res) => { 
    const sampleData = { 
        name: "Jan Kowalski", 
        age: 30, 
        occupation: "Software Developer" 
    }; 
    res.json(sampleData); 
}); 
app.use(express.json());