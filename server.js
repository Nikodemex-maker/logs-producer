const express = require('express');
const app = express();  
app.use(express.static('apps'));
app.listen(3000, ()=>console.log('The server is running on http://localhost:3000'));
