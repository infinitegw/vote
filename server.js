// server.js
import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Database file (simple JSON store for now)
const DB_FILE = "./db.json";

// Initialize db.json if missing
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify({ students: [], classes: [], dorms: [], votes: [] }, null, 2)
  );
}

// Helper to load/save database
const loadDB = () => JSON.parse(fs.readFileSync(DB_FILE));
const saveDB = (db) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

// Register student
app.post("/register", (req, res) => {
  const db = loadDB();
  const { admission, name, className, dorm } = req.body;

  if (db.students.find((s) => s.admission === admission)) {
    return res.status(400).json({ message: "Student already registered" });
  }

  db.students.push({ admission, name, className, dorm });
  saveDB(db);
  res.json({ message: "Registered successfully" });
});

// Login
app.post("/login", (req, res) => {
  const db = loadDB();
  const { admission, name, className, dorm } = req.body;

  const student = db.students.find(
    (s) =>
      s.admission === admission &&
      s.name === name &&
      s.className === className &&
      s.dorm === dorm
  );

  if (!student) {
    return res.status(401).json({ message: "Invalid login" });
  }

  res.json({ message: "Login successful", student });
});

// Add class
app.post("/add-class", (req, res) => {
  const db = loadDB();
  const { className } = req.body;

  if (!db.classes.includes(className)) {
    db.classes.push(className);
    saveDB(db);
  }

  res.json({ message: "Class added", classes: db.classes });
});

// Get classes/dorms/students
app.get("/classes", (req, res) => res.json(loadDB().classes));
app.get("/dorms", (req, res) => res.json(loadDB().dorms));
app.get("/students", (req, res) => res.json(loadDB().students));

// Vote
app.post("/vote", (req, res) => {
  const db = loadDB();
  const { admission, post, candidate } = req.body;

  if (db.votes.find((v) => v.admission === admission && v.post === post)) {
    return res.status(400).json({ message: "Already voted for this post" });
  }

  db.votes.push({ admission, post, candidate });
  saveDB(db);

  res.json({ message: "Vote cast successfully" });
});

// Get votes (for admin/results)
app.get("/votes", (req, res) => res.json(loadDB().votes));

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
