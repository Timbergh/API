var mysql = require("mysql");
var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "restapi", //här ska namnet på din databas stå
  multipleStatements: true,
});

con.connect(function (err) {
  // anslut till databasen
  if (err) throw err;
  console.log("Connected");
});

var express = require("express");
var app = express();
var http = require("http").Server(app);
var port = 5000;
app.use(express.json());

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/dokumentation.html");
});

const crypto = require("crypto"); //INSTALLERA MED "npm install crypto" I KOMMANDOTOLKEN
function hash(data) {
  const hash = crypto.createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

const COLUMNS = ["firstname", "lastname", "userId", "passwd"]; // ÄNDRA TILL NAMN PÅ KOLUMNER I ER EGEN TABELL

function verifieraToken(req, res) {
  let authHeader = req.headers["authorization"];
  if (authHeader === undefined) {
    // skicka lämplig HTTP-status om auth-header saknas, en “400 någonting”
    res.sendStatus(400); // "Bad request"
    return;
  }
  let token = authHeader.slice(7); // tar bort "BEARER " från headern.
  // nu finns den inskickade token i variabeln token
  console.log(token);

  // avkoda token
  let decoded;
  try {
    decoded = jwt.verify(token, "EnHemlighetSomIngenKanGissaXyz123%&/");
  } catch (err) {
    console.log(err); //Logga felet, för felsökning på servern.
    res.status(401).send("Invalid auth token");
    return false;
  }
  return true;
}

// route-parameter, dvs. filtrera efter ID i URL:en
app.get("/users/:id", function (req, res) {
  if (!verifieraToken(req, res)) return;
  // Värdet på id ligger i req.params
  let sql = "SELECT * FROM users WHERE id=" + req.params.id;
  console.log(sql);
  // skicka query till databasen
  con.query(sql, function (err, result, fields) {
    if (result.length > 0) {
      res.send(result);
    } else {
      res.sendStatus(404); // 404=not found
    }
  });
});

app.post("/users", function (req, res) {
  if (!verifieraToken(req, res)) return;
  // kod för att validera input
  if (!req.body.userId) {
    res.status(400).send("userId required!");
    return; // avslutar metoden
  }
  let fields = ["firstname", "lastname", "userId", "passwd"]; // ändra eventuellt till namn på er egen databastabells kolumner
  for (let key in req.body) {
    if (!fields.includes(key)) {
      res.status(400).send("Unknown field: " + key);
      return; // avslutar metoden
    }
  }
  // kod för att hantera anrop
  let sql = `INSERT INTO users (firstname, lastname, userId, passwd)
    VALUES ('${req.body.firstname}', 
    '${req.body.lastname}',
    '${req.body.userId}',
    '${hash(req.body.passwd)}');
    SELECT LAST_INSERT_ID();`; // OBS: innehåller två query: ett insert och ett select
  console.log(sql);

  con.query(sql, function (err, result, fields) {
    if (err) throw err;
    // kod för att hantera retur av data
    console.log(result);
    let output = {
      id: result[0].insertId,
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      userId: req.body.userId,
      passwd: req.body.passwd,
    };
    res.send(output);
  });
});

const jwt = require("jsonwebtoken"); // installera med "npm install jsonwebtoken"
app.post("/login", function (req, res) {
  console.log(req.body);
  let sql = `SELECT * FROM users WHERE userId='${req.body.userId}'`;

  con.query(sql, function (err, result, fields) {
    if (err) throw err;
    let passwordHash = hash(req.body.passwd);
    if (result[0].passwd == passwordHash) {
      //Denna kod skapar en token att returnera till anroparen.
      let payload = {
        sub: result[0].userId, //sub är obligatorisk
        name: result[0].firstname, //Valbar information om användaren
        lastname: result[0].lastname,
      };
      let token = jwt.sign(payload, "EnHemlighetSomIngenKanGissaXyz123%&/", {
        expiresIn: "2h",
      });
      res.json(token);
    } else {
      res.sendStatus(401);
    }
  });
});

app.get("/users", function (req, res) {
  if (!verifieraToken(req, res)) return;
  let sql = "SELECT * FROM users"; // ÄNDRA TILL NAMN PÅ ER EGEN TABELL (om den heter något annat än "users")
  console.log(sql);
  // skicka query till databasen
  con.query(sql, function (err, result, fields) {
    res.send(result);
  });
});

app.get("/me", function (req, res) {
  if (!verifieraToken(req, res)) return;
  let token = req.headers["authorization"].slice(7);
  let decoded = jwt.verify(token, "EnHemlighetSomIngenKanGissaXyz123%&/");
  let sql = `SELECT firstname, lastname, userId FROM users WHERE userId='${decoded.sub}'`;
  console.log(sql);
  con.query(sql, function (err, result, fields) {
    if (result.length > 0) {
      let me = result[0];
      res.send(me);
    } else {
      res.sendStatus(404);
    }
  });
});

http.listen(port, function () {
  console.log("Server started. Listening on localhost:" + port);
});
