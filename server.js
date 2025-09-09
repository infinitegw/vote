import express from "express";
import cors from "cors";
import fs from "fs";
import multer from "multer";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
app.use(express.static(".")); // Serve all frontend files from root

// Database file
const DB_FILE = "./db.json";

// Initialize db.json if missing
const initializeDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      adminPassword: "admin123",
      academicYear: "",
      deadline: "",
      classes: ["Form 1", "Form 2", "Form 3", "Form 4"],
      dorms: ["Dorm A", "Dorm B", "Dorm C", "Dorm D"],
      posts: ["President", "Secretary", "Treasurer"],
      candidates: [],
      students: [],
      votes: [],
      nominations: [],
      logs: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    console.log("Created new database file with initial data");
  }
};

// Helpers
function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (error) {
    console.error("Error reading database:", error);
    return {
      adminPassword: "admin123",
      academicYear: "",
      deadline: "",
      classes: [],
      dorms: [],
      posts: [],
      candidates: [],
      students: [],
      votes: [],
      nominations: [],
      logs: []
    };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error writing to database:", error);
    return false;
  }
}

// Initialize database on server start
initializeDB();

/* ---------------------- TEST ENDPOINT ---------------------- */
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "Backend is working!",
    timestamp: new Date().toISOString(),
    status: "OK"
  });
});

/* ---------------------- ADMIN ROUTES ---------------------- */
app.post("/api/admin/login", (req, res) => {
  const db = readDB();
  if (req.body.password === db.adminPassword) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Invalid admin password" });
  }
});

app.post("/api/admin/change-password", (req, res) => {
  const db = readDB();
  const { oldPass, newPass } = req.body;

  if (oldPass !== db.adminPassword) {
    return res.json({ success: false, message: "Current password is incorrect" });
  }

  db.adminPassword = newPass;
  if (writeDB(db)) {
    res.json({ success: true, message: "Password changed successfully" });
  } else {
    res.json({ success: false, message: "Failed to change password" });
  }
});

/* ---------------------- STUDENT ROUTES ---------------------- */
// Student registration
app.post("/api/register", upload.single('photo'), (req, res) => {
  const db = readDB();
  const { adm, name, class: studentClass, dorm } = req.body;
  
  // Validate required fields
  if (!adm || !name || !studentClass || !dorm) {
    return res.json({ success: false, message: "All fields are required" });
  }

  // Check if student already exists
  const exists = db.students.find((s) => s.adm === adm);
  if (exists) {
    return res.json({ success: false, message: "Student already registered" });
  }

  // Handle photo upload
  let photoBase64 = "";
  if (req.file) {
    photoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  }

  // Add student to database
  db.students.push({
    adm,
    name,
    class: studentClass,
    dorm,
    photo: photoBase64
  });

  if (writeDB(db)) {
    res.json({ success: true, message: "Registration successful" });
  } else {
    res.json({ success: false, message: "Registration failed" });
  }
});

// Student login
app.post("/api/login", (req, res) => {
  const db = readDB();
  const { admission, fullname, class: studentClass, dorm } = req.body;

  // Validate required fields
  if (!admission || !fullname || !studentClass || !dorm) {
    return res.json({ success: false, message: "All fields are required" });
  }

  // Find student
  const student = db.students.find(s => 
    s.adm === admission && 
    s.name.toLowerCase() === fullname.toLowerCase() &&
    s.class === studentClass &&
    s.dorm === dorm
  );

  if (student) {
    res.json({ success: true, student });
  } else {
    res.json({ success: false, message: "Invalid login details" });
  }
});

// Get classes and dorms for dropdowns
app.get("/api/options", (req, res) => {
  const db = readDB();
  res.json({
    classes: db.classes,
    dorms: db.dorms,
    posts: db.posts
  });
});

/* ---------------------- START SERVER ---------------------- */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Open http://localhost:${PORT} in your browser`);
});
