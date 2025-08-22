// server.js
import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // serve frontend files

// Database file
const DB_FILE = "./db.json";

// Initialize db.json if missing
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      {
        adminPassword: "admin123", // ✅ default admin password
        academicYear: "",
        deadline: "",
        classes: [],
        dorms: [],
        posts: [],
        candidates: [],
        students: [],
        votes: {}
      },
      null,
      2
    )
  );
}

// Helpers
function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/* ---------------------- ADMIN ROUTES ---------------------- */

// ✅ Admin login
app.post("/api/admin/login", (req, res) => {
  const db = readDB();
  if (req.body.password === db.adminPassword) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// ✅ Change admin password
app.post("/api/admin/change-password", (req, res) => {
  const db = readDB();
  const { oldPass, newPass } = req.body;

  if (oldPass !== db.adminPassword) {
    return res.json({ success: false, msg: "Old password is incorrect" });
  }

  db.adminPassword = newPass;
  writeDB(db);
  res.json({ success: true, msg: "Password changed successfully" });
});

// ✅ Set academic year
app.post("/api/admin/year", (req, res) => {
  const db = readDB();
  db.academicYear = req.body.year;
  writeDB(db);
  res.json({ success: true, year: db.academicYear });
});

// ✅ Set deadline
app.post("/api/admin/deadline", (req, res) => {
  const db = readDB();
  db.deadline = req.body.deadline;
  writeDB(db);
  res.json({ success: true, deadline: db.deadline });
});

/* ---------------------- DATA ROUTES ---------------------- */

// ✅ Get all data
app.get("/api/data", (req, res) => {
  res.json(readDB());
});

// ✅ Add class
app.post("/api/class", (req, res) => {
  const db = readDB();
  if (!db.classes.includes(req.body.name)) {
    db.classes.push(req.body.name);
    writeDB(db);
  }
  res.json(db.classes);
});

// ✅ Add dorm
app.post("/api/dorm", (req, res) => {
  const db = readDB();
  if (!db.dorms.includes(req.body.name)) {
    db.dorms.push(req.body.name);
    writeDB(db);
  }
  res.json(db.dorms);
});

// ✅ Add post
app.post("/api/post", (req, res) => {
  const db = readDB();
  if (!db.posts.includes(req.body.name)) {
    db.posts.push(req.body.name);
    writeDB(db);
  }
  res.json(db.posts);
});

// ✅ Add candidate
app.post("/api/candidate", (req, res) => {
  const db = readDB();
  const { name, post, className, dorm } = req.body;

  // prevent duplicate candidates
  const exists = db.candidates.find(
    (c) =>
      c.name === name &&
      c.post === post &&
      c.className === className &&
      c.dorm === dorm
  );

  if (!exists) {
    db.candidates.push(req.body);
    writeDB(db);
    return res.json({ success: true, candidates: db.candidates });
  }

  res.json({ success: false, msg: "Candidate already exists" });
});

/* ---------------------- STUDENT ROUTES ---------------------- */

// ✅ Register student
app.post("/api/register", (req, res) => {
  const db = readDB();
  const exists = db.students.find((s) => s.adm === req.body.adm);
  if (!exists) {
    db.students.push(req.body);
    writeDB(db);
    res.json({ success: true });
  } else {
    res.json({ success: false, msg: "Student already registered" });
  }
});

// ✅ Cast vote
app.post("/api/vote", (req, res) => {
  const db = readDB();
  const { adm, post, candidate } = req.body;

  if (!db.votes[adm]) db.votes[adm] = {};
  db.votes[adm][post] = candidate;

  writeDB(db);
  res.json({ success: true });
});

// ✅ Get results
app.get("/api/results", (req, res) => {
  const db = readDB();
  res.json(db.votes);
});

/* ---------------------- START SERVER ---------------------- */
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
