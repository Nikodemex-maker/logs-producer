<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>CodeMaster Academy</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      text-align: center;
    }

    header {
      background-color: #222;
      padding: 20px;
    }

    .logo {
      width: 150px;
      height: auto;
    }

    h1 {
      color: #333;
      margin-top: 40px;
    }

    p {
      color: #666;
    }
  </style>
</head>
<body>
  <header>
    <img src="logo.png" alt="Logo CodeMaster Academy" class="logo" id="logo">
  </header>

  <main>
    <h1>Witaj w CodeMaster Academy!</h1>
    <p>Rozpocznij swoją przygodę z programowaniem już dziś.</p>
  </main>

  <script>
    // Prosty log do konsoli
    console.log("Strona została załadowana.");

    // Sprawdzenie, czy logo istnieje
    const logo = document.getElementById("logo");
    if (logo.complete && logo.naturalHeight !== 0) {
      console.log("Logo zostało poprawnie załadowane.");
    } else {
      console.log("Błąd: logo się nie załadowało.");
    }
  </script>
</body>
</html>
