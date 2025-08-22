// server.js
import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // serve frontend files

// Database file (simple JSON store)
const DB_FILE = "./db.json";

// Initialize db.json if missing
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify({ classes: [], dorms: [], posts: [], candidates: [], students: [], votes: {} }, null, 2)
  );
}

// Helper: read + write DB
function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ✅ API Routes

// Get all data
app.get("/api/data", (req, res) => {
  res.json(readDB());
});

// Add class
app.post("/api/class", (req, res) => {
  const db = readDB();
  if (!db.classes.includes(req.body.name)) {
    db.classes.push(req.body.name);
    writeDB(db);
  }
  res.json(db.classes);
});

// Add dorm
app.post("/api/dorm", (req, res) => {
  const db = readDB();
  if (!db.dorms.includes(req.body.name)) {
    db.dorms.push(req.body.name);
    writeDB(db);
  }
  res.json(db.dorms);
});

// Add post
app.post("/api/post", (req, res) => {
  const db = readDB();
  if (!db.posts.includes(req.body.name)) {
    db.posts.push(req.body.name);
    writeDB(db);
  }
  res.json(db.posts);
});

// Add candidate
app.post("/api/candidate", (req, res) => {
  const db = readDB();
  db.candidates.push(req.body);
  writeDB(db);
  res.json(db.candidates);
});

// Register student
app.post("/api/register", (req, res) => {
  const db = readDB();
  const exists = db.students.find(s => s.adm === req.body.adm);
  if (!exists) {
    db.students.push(req.body);
    writeDB(db);
    res.json({ success: true });
  } else {
    res.json({ success: false, msg: "Student already registered" });
  }
});

// Cast vote
app.post("/api/vote", (req, res) => {
  const db = readDB();
  const { adm, post, candidate } = req.body;
  if (!db.votes[adm]) db.votes[adm] = {};
  db.votes[adm][post] = candidate;
  writeDB(db);
  res.json({ success: true });
});

// Get results
app.get("/api/results", (req, res) => {
  const db = readDB();
  res.json(db.votes);
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
