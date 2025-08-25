/***********************
 * CONFIG & UTILITIES  *
 ***********************/
const ADMIN_PASSWORD = "admin123"; // NOTE: front-end only; not secure

// Year-scoped storage
function getYearKey(base) {
  const year = localStorage.getItem("currentYear") || "default";
  return `${base}_${year}`;
}
function load(key) {
  return JSON.parse(localStorage.getItem(getYearKey(key))) || [];
}
function save(key, data) {
  localStorage.setItem(getYearKey(key), JSON.stringify(data));
}

// Generic logs (newest first)
function addLog(type, message, extra = {}) {
  const logs = load("logs");
  logs.unshift({
    type,
    message,
    time: new Date().toLocaleString(),
    device: navigator.userAgent,
    ...extra
  });
  save("logs", logs);
  renderLogs();
}
function renderLogs() {
  const el = document.getElementById("logsList");
  if (!el) return;
  const logs = load("logs");
  el.innerHTML = logs.map(l =>
    `<li>[${l.time}] (${l.type}) ${l.message}</li>`
  ).join("");
}

// Populate dropdowns from localStorage
function populateOptions(id, storageKey, placeholder = "Select") {
  const list = load(storageKey);
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = `<option disabled selected>${placeholder}</option>` +
    list.map(item => `<option>${item}</option>`).join("");
}

// Logged-in user helpers - FIXED to use consistent key
function getLoggedInUser() {
  return JSON.parse(localStorage.getItem("loggedInStudent"));
}
function setLoggedInUser(u) {
  localStorage.setItem("loggedInStudent", JSON.stringify(u));
}
function requireLogin() {
  const u = getLoggedInUser();
  if (!u) { alert("Please log in first."); location.href = "login.html"; }
  return u;
}
function logout() {
  localStorage.removeItem("loggedInStudent");
  location.href = "index.html";
}

/***********************
 * AUTH: REGISTER/LOGIN*
 ***********************/
function register() {
  const adm = document.getElementById("adm").value.trim();
  const name = document.getElementById("name").value.trim();
  const cls = document.getElementById("class").value;
  const dorm = document.getElementById("dorm").value;
  const photoInput = document.getElementById("photo");

  if (!adm || !name || !cls || !dorm || cls === "Select Class" || dorm === "Select Dorm") {
    alert("⚠️ Please fill in all fields!"); return;
  }

  const students = load("students");
  if (students.find(s => s.adm === adm)) {
    alert("⚠️ A student with this Admission Number is already registered.");
    return;
  }

  const saveStudent = (photo) => {
    students.push({ adm, name, class: cls, dorm, photo });
    save("students", students);
    addLog("register", `Student registered: ${name} (${adm})`, { adm, name });
    alert("✅ Registration successful! Please log in.");
    location.href = "login.html";
  };

  if (photoInput && photoInput.files && photoInput.files.length > 0) {
    const reader = new FileReader();
    reader.onload = e => saveStudent(e.target.result);
    reader.readAsDataURL(photoInput.files[0]);
  } else {
    saveStudent("");
  }
}

function login() {
  const adm = document.getElementById("admission").value.trim();
  const name = document.getElementById("fullname").value.trim();
  const cls = document.getElementById("class").value;
  const dorm = document.getElementById("dorm").value;

  const students = load("students");
  const user = students.find(s =>
    s.adm === adm &&
    s.name.toLowerCase() === name.toLowerCase() &&
    s.class === cls &&
    s.dorm === dorm
  );

  if (!user) { alert("❌ Invalid login. Please check your details."); return; }
  setLoggedInUser(user);
  addLog("login", `Student logged in: ${user.name} (${user.adm})`, { adm: user.adm });
  alert("✅ Login successful");
  location.href = "dashboard.html";
}

/***********************
 * PROFILE & DASHBOARD *
 ***********************/
function loadProfile() {
  const user = requireLogin();
  document.getElementById("profileAdm").innerText = user.adm;
  document.getElementById("profileName").innerText = user.name;
  document.getElementById("profileClass").innerText = user.class;
  document.getElementById("profileDorm").innerText = user.dorm;
  if (user.photo) {
    const img = document.getElementById("profilePhoto");
    if (img) img.src = user.photo;
  }
}

let studentChartInstance = null;
function loadStudentDashboard() {
  requireLogin();
  disableVotingIfPastDeadline();

  const published = localStorage.getItem("resultsPublished") === "true";
  const holder = document.getElementById("studentResults");
  if (!holder) return;
  if (!published) { holder.style.display = "none"; return; }

  holder.style.display = "block";
  const votes = load("votes");
  const tally = {};
  votes.forEach(v => { tally[v.votedFor] = (tally[v.votedFor] || 0) + 1; });

  const ctx = document.getElementById("studentChart");
  if (!ctx) return;

  if (studentChartInstance) studentChartInstance.destroy();
  studentChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(tally),
      datasets: [{ label: "Votes", data: Object.values(tally), backgroundColor: "rgba(54, 162, 235, 0.6)" }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

/***********************
 * NOMINATIONS         *
 ***********************/
function loadNominationOptions() {
  const user = getLoggedInUser();
  if (!user) {
    alert("Please log in first!");
    window.location.href = "login.html";
    return;
  }

  // Pre-fill name with logged-in user's name
  const nameInput = document.getElementById("name");
  if (nameInput) nameInput.value = user.name || "";
  
  // Populate dropdowns
  populateOptions("position", "posts", "Select Position");
  populateOptions("class", "classes", "Select Class");
  populateOptions("dorm", "dorms", "Select Dorm");
}

function nominate() {
  const user = requireLogin();
  const name = document.getElementById("name").value.trim();
  const position = document.getElementById("position").value;
  const cls = document.getElementById("class").value;
  const dorm = document.getElementById("dorm").value;
  const manifesto = document.getElementById("manifesto").value.trim();
  const photoInput = document.getElementById("photo");

  if (!name || !position || !cls || !dorm || !manifesto ||
      position === "Select Position" || cls === "Select Class" || dorm === "Select Dorm") {
    alert("Please fill in all fields."); return;
  }

  const nominations = load("nominations");
  const nominationId = `${user.adm}-${Date.now()}`;

  const pushNomination = (photo) => {
    nominations.push({
      id: nominationId,
      name, position, class: cls, dorm, manifesto, photo,
      approved: false
    });
    save("nominations", nominations);
    addLog("nominate", `Nomination submitted by ${name} for ${position}`, { adm: user.adm });
    alert("Nomination submitted. Awaiting admin approval.");
    location.href = "dashboard.html";
  };

  if (photoInput && photoInput.files && photoInput.files.length > 0) {
    const reader = new FileReader();
    reader.onload = e => pushNomination(e.target.result);
    reader.readAsDataURL(photoInput.files[0]);
  } else {
    pushNomination("");
  }
}

/***********************
 * VOTING              *
 ***********************/
function buildVotingUI(containerId = "voteForms") {
  const user = requireLogin();
  const posts = load("posts");
  const candidates = load("candidates").filter(c => c.approved);
  const votes = load("votes");
  const votedPosts = votes.filter(v => v.adm === user.adm).map(v => v.position);

  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  let html = "";
  posts.forEach(post => {
    if (votedPosts.includes(post)) return;

    const options = candidates.filter(c => {
      if (post.includes("Class Prefect")) return c.class === user.class && c.position === post;
      if (post.includes("Dorm Captain") || post.includes("Dorm Representative")) return c.dorm === user.dorm && c.position === post;
      return c.position === post;
    });

    if (!options.length) return;

    const safeId = `select-${post.replace(/\s+/g,'_')}`;
    html += `<div class="voteBox">
      <h3>${post}</h3>
      <select id="${safeId}">
        <option value="">-- Select Candidate --</option>
        ${options.map(o => `<option value="${o.name}">${o.name} (${o.class}, ${o.dorm})</option>`).join("")}
      </select>
    </div>`;
  });

  if (!html) html = `<p>You have already voted for all available positions.</p>`;
  container.innerHTML = html;
}

function submitSelectedVotes() {
  const user = requireLogin();
  const posts = load("posts");
  const votes = load("votes");
  let newVotes = 0;

  posts.forEach(post => {
    const select = document.getElementById(`select-${post.replace(/\s+/g,'_')}`);
    if (select && select.value) {
      const already = votes.some(v => v.adm === user.adm && v.position === post);
      if (!already) {
        votes.push({
          adm: user.adm,
          name: user.name,
          position: post,
          votedFor: select.value,
          time: new Date().toISOString()
        });
        newVotes++;
      }
    }
  });

  if (newVotes > 0) {
    save("votes", votes);
    addLog("vote", `Votes recorded: ${newVotes} for ${user.name}`, { adm: user.adm, count: newVotes });
    alert("Your votes have been recorded.");
    location.reload();
  } else {
    alert("No new votes selected or you have already voted for these posts.");
  }
}

/************************
 * DEADLINE / COUNTDOWN *
 ************************/
function setVotingDeadline() {
  const deadline = document.getElementById("deadlineInput").value;
  if (!deadline) return alert("Please select a date and time.");
  localStorage.setItem("votingDeadline", deadline);
  addLog("deadline", `Voting deadline set to ${deadline}`);
  alert("Voting deadline set.");
  disableVotingIfPastDeadline();
}

function disableVotingIfPastDeadline() {
  const deadline = localStorage.getItem("votingDeadline");
  const countdown = document.getElementById("deadlineCountdown");
  const voteBtn = document.getElementById("submitVoteBtn");
  if (!deadline) { if (countdown) countdown.textContent = ""; return; }

  const now = new Date();
  const end = new Date(deadline);

  if (now >= end) {
    if (voteBtn) { voteBtn.disabled = true; voteBtn.innerText = "Voting Closed"; }
    if (countdown) countdown.innerText = "Voting closed.";
    return;
  }

  const tick = () => {
    const now2 = new Date();
    if (now2 >= end) { disableVotingIfPastDeadline(); return; }
    const diff = Math.floor((end - now2) / 1000);
    const hrs = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    if (countdown) countdown.innerText = `Voting ends in ${hrs}h ${mins}m ${secs}s`;
    setTimeout(tick, 1000);
  };
  tick();
}

/***********************
 * RESULTS             *
 ***********************/
let adminChartInstance = null;

function loadResults() {
  loadResultsInto("results", "resultsChart", "resultsWrapper", "noResults");
}

function loadResultsInto(resultsDivId, chartCanvasId, wrapperId, noResultsId) {
  const published = localStorage.getItem("resultsPublished") === "true";
  const votes = load("votes");
  const candidates = load("candidates");

  const wrapper = document.getElementById(wrapperId);
  const noRes = document.getElementById(noResultsId);
  const resDiv = document.getElementById(resultsDivId);
  const chartCanvas = document.getElementById(chartCanvasId);

  if (!published) {
    if (wrapper) wrapper.style.display = "none";
    if (noRes) noRes.style.display = "block";
    return;
  }

  if (noRes) noRes.style.display = "none";
  if (wrapper) wrapper.style.display = "block";

  const tally = {};
  candidates.forEach(c => { tally[c.name] = 0; });
  votes.forEach(v => { if (tally[v.votedFor] !== undefined) tally[v.votedFor]++; });

  const byPosition = {};
  candidates.forEach(c => {
    byPosition[c.position] = byPosition[c.position] || [];
    byPosition[c.position].push({ name: c.name, count: tally[c.name] || 0 });
  });

  const sectionHTML = Object.entries(byPosition).map(([pos, list]) => {
    const max = Math.max(...list.map(i => i.count));
    const rows = list
      .sort((a,b) => b.count - a.count)
      .map(i => `<li${i.count === max ? ' style="background:#eaf9ea;border:1px solid #b4e2b4;"' : ''}>
        <span><b>${i.name}</b></span><span>${i.count} votes</span>
      </li>`).join("");
    return `<h3>${pos}</h3><ul>${rows}</ul>`;
  }).join("");

  if (resDiv) resDiv.innerHTML = sectionHTML || "<p>No candidates available.</p>";

  if (chartCanvas) {
    if (adminChartInstance) adminChartInstance.destroy();
    adminChartInstance = new Chart(chartCanvas, {
      type: "bar",
      data: {
        labels: Object.keys(tally),
        datasets: [{ label: "Votes", data: Object.values(tally), backgroundColor: "rgba(255, 99, 132, 0.6)" }]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  }
}

/***********************
 * ADMIN PANEL         *
 ***********************/
function checkAdmin() {
  const pass = document.getElementById("adminPass").value;
  const storedPass = localStorage.getItem("adminPassword") || ADMIN_PASSWORD;
  if (pass === storedPass) {
    sessionStorage.setItem("isAdmin", "true");
    document.getElementById("adminLogin").style.display = "none";
    document.getElementById("adminPanel").style.display = "block";
    addLog("admin", "Admin logged in");
    renderAdminData();
  } else {
    alert("Wrong password.");
  }
}

function logoutAdmin() {
  sessionStorage.removeItem("isAdmin");
  addLog("admin", "Admin logged out");
  location.href = "index.html";
}

function renderAdminData() {
  if (!sessionStorage.getItem("isAdmin")) return;

  const year = localStorage.getItem("currentYear") || "Not Set";
  const yearDisplay = document.getElementById("yearDisplay");
  if (yearDisplay) yearDisplay.innerText = year;

  const classes = load("classes");
  const dorms = load("dorms");
  const posts = load("posts");

  const classList = document.getElementById("classList");
  const dormList = document.getElementById("dormList");
  const postList = document.getElementById("postList");

  if (classList) classList.innerHTML = classes.map((c, i) =>
    `<li>${c}<button onclick="deleteClass(${i})">🗑️</button></li>`).join("");
  if (dormList) dormList.innerHTML = dorms.map((d, i) =>
    `<li>${d}<button onclick="deleteDorm(${i})">🗑️</button></li>`).join("");
  if (postList) postList.innerHTML = posts.map((p, i) =>
    `<li>${p}<button onclick="deletePost(${i})">🗑️</button></li>`).join("");

  const candSel = document.getElementById("newCandPosition");
  const classSel = document.getElementById("newCandClass");
  const dormSel = document.getElementById("newCandDorm");
  if (candSel) candSel.innerHTML = posts.map(p => `<option>${p}</option>`).join("");
  if (classSel) classSel.innerHTML = classes.map(p => `<option>${p}</option>`).join("");
  if (dormSel) dormSel.innerHTML = dorms.map(p => `<option>${p}</option>`).join("");

  const candidates = load("candidates");
  const candListEl = document.getElementById("candidatesList");
  if (candListEl) {
    candListEl.innerHTML = candidates.map((c, i) =>
      `<li><b>${c.name}</b> for <b>${c.position}</b> (${c.class}, ${c.dorm})
       <button onclick="deleteCandidate(${i})">🗑️</button></li>`).join("");
  }

  const pendingAll = load("nominations");
  const pending = pendingAll.filter(n => !n.approved);
  const pendingDiv = document.getElementById("pendingNominations");
  if (pendingDiv) {
    pendingDiv.innerHTML = pending.length ? pending.map(n =>
      `<div>
        <b>${n.name}</b> for <b>${n.position}</b> (${n.class}, ${n.dorm})<br>
        ${n.photo ? `<img src="${n.photo}" class="avatar" alt="photo">` : ""}
        <i>${n.manifesto}</i><br>
        <button onclick="approveNomination('${n.id}')">✅ Approve</button>
        <button onclick="rejectNomination('${n.id}')">❎ Reject</button>
      </div><hr>`
    ).join("") : "<p>No pending nominations.</p>";
  }

  renderLogs();
  renderAdminChart();
}

let adminLiveChartInstance = null;
function renderAdminChart() {
  const votes = load("votes");
  const ctx = document.getElementById("adminChart");
  if (!ctx) return;

  const tally = {};
  votes.forEach(v => { tally[v.votedFor] = (tally[v.votedFor] || 0) + 1; });

  if (adminLiveChartInstance) adminLiveChartInstance.destroy();
  adminLiveChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(tally),
      datasets: [{ label: "Votes", data: Object.values(tally), backgroundColor: "rgba(255, 159, 64, 0.6)" }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

/***************
 * Admin CRUD  *
 ***************/
function addClass() {
  const newClass = document.getElementById("newClass").value.trim();
  if (!newClass) return alert("Class name is required.");
  const classes = load("classes");
  if (classes.includes(newClass)) return alert("Class already exists.");
  classes.push(newClass);
  save("classes", classes);
  addLog("class", `Added class: ${newClass}`);
  document.getElementById("newClass").value = "";
  renderAdminData();
}

function addDorm() {
  const newDorm = document.getElementById("newDorm").value.trim();
  if (!newDorm) return alert("Dorm name is required.");
  const dorms = load("dorms");
  if (dorms.includes(newDorm)) return alert("Dorm already exists.");
  dorms.push(newDorm);
  save("dorms", dorms);
  addLog("dorm", `Added dorm: ${newDorm}`);
  document.getElementById("newDorm").value = "";
  renderAdminData();
}

function addPost() {
  const newPost = document.getElementById("newPost").value.trim();
  if (!newPost) return alert("Post name is required.");
  const posts = load("posts");
  if (posts.includes(newPost)) return alert("Post already exists.");
  posts.push(newPost);
  save("posts", posts);
  addLog("post", `Added post: ${newPost}`);
  document.getElementById("newPost").value = "";
  renderAdminData();
}

function deleteClass(index) {
  const classes = load("classes");
  if (index < 0 || index >= classes.length) return;
  const removed = classes[index];
  if (!confirm(`Delete class "${removed}"? This may affect candidates.`)) return;

  classes.splice(index, 1);
  save("classes", classes);

  const cands = load("candidates").filter(c => c.class !== removed);
  save("candidates", cands);
  const noms = load("nominations").filter(n => n.class !== removed);
  save("nominations", noms);

  addLog("class", `Deleted class: ${removed}`);
  renderAdminData();
}

function deleteDorm(index) {
  const dorms = load("dorms");
  if (index < 0 || index >= dorms.length) return;
  const removed = dorms[index];
  if (!confirm(`Delete dorm "${removed}"? This may affect candidates.`)) return;

  dorms.splice(index, 1);
  save("dorms", dorms);

  const cands = load("candidates").filter(c => c.dorm !== removed);
  save("candidates", cands);
  const noms = load("nominations").filter(n => n.dorm !== removed);
  save("nominations", noms);

  addLog("dorm", `Deleted dorm: ${removed}`);
  renderAdminData();
}

function deletePost(index) {
  const posts = load("posts");
  if (index < 0 || index >= posts.length) return;
  const removed = posts[index];
  if (!confirm(`Delete post "${removed}"? Related candidates and votes will be removed.`)) return;

  posts.splice(index, 1);
  save("posts", posts);

  const cands = load("candidates").filter(c => c.position !== removed);
  save("candidates", cands);
  const noms = load("nominations").filter(n => n.position !== removed);
  save("nominations", noms);
  const votes = load("votes").filter(v => v.position !== removed);
  save("votes", votes);

  addLog("post", `Deleted post: ${removed} (removed related candidates, nominations & votes)`);
  renderAdminData();
}

function addCandidate() {
  const name = document.getElementById("newCandName").value.trim();
  const position = document.getElementById("newCandPosition").value;
  const cls = document.getElementById("newCandClass").value;
  const dorm = document.getElementById("newCandDorm").value;
  if (!name || !position || !cls || !dorm) return alert("Fill all fields");

  const candidates = load("candidates");
  candidates.push({ name, position, class: cls, dorm, manifesto: "Added by admin", photo: "", approved: true });
  save("candidates", candidates);
  addLog("candidate", `Admin added candidate ${name} for ${position}`);
  document.getElementById("newCandName").value = "";
  renderAdminData();
}

function approveNomination(id) {
  const pending = load("nominations");
  const idx = pending.findIndex(n => n.id === id);
  if (idx === -1) return;

  const approvedNom = pending.splice(idx, 1)[0];
  approvedNom.approved = true;

  const candidates = load("candidates");
  candidates.push(approvedNom);
  save("candidates", candidates);
  save("nominations", pending);
  addLog("nomination", `Approved: ${approvedNom.name} for ${approvedNom.position}`);
  alert("Nomination approved.");
  renderAdminData();
}

function rejectNomination(id) {
  const pending = load("nominations");
  const idx = pending.findIndex(n => n.id === id);
  if (idx === -1) return;
  const rejected = pending.splice(idx, 1)[0];
  save("nominations", pending);
  addLog("nomination", `Rejected: ${rejected.name} for ${rejected.position}`);
  renderAdminData();
}

function deleteCandidate(index) {
  const candidates = load("candidates");
  if (index < 0 || index >= candidates.length) return;
  if (!confirm("Are you sure you want to delete this candidate?")) return;
  const removed = candidates.splice(index, 1)[0];
  save("candidates", candidates);
  addLog("candidate", `Deleted candidate ${removed.name} (${removed.position})`);
  renderAdminData();
}

function setAcademicYear() {
  const year = document.getElementById("academicYear").value.trim();
  if (!year) return alert("Enter academic year.");
  localStorage.setItem("currentYear", year);
  addLog("year", `Academic year set to ${year}`);
  alert("Academic year updated.");
  renderAdminData();
}

function publishResults() {
  localStorage.setItem("resultsPublished", "true");
  addLog("results", "Results published");
  alert("Results have been published.");
}

function unpublishResults() {
  localStorage.setItem("resultsPublished", "false");
  addLog("results", "Results unpublished");
  alert("Results have been hidden.");
}

/***********************
 * CHANGE ADMIN PASSWORD
 ***********************/
function changeAdminPassword() {
  const oldPass = document.getElementById("oldAdminPass").value;
  const newPass = document.getElementById("newAdminPass").value;
  if (!oldPass || !newPass) {
    alert("Please fill in both fields.");
    return;
  }
  const storedPass = localStorage.getItem("adminPassword") || ADMIN_PASSWORD;
  if (oldPass !== storedPass) {
    alert("Current password is incorrect.");
    return;
  }
  if (newPass.length < 5) {
    alert("New password must be at least 5 characters.");
    return;
  }
  localStorage.setItem("adminPassword", newPass);
  alert("Admin password changed successfully.");
  addLog("admin", "Admin password changed");
  document.getElementById("oldAdminPass").value = "";
  document.getElementById("newAdminPass").value = "";
}

/***********************
 * EXPORTS             *
 ***********************/
function exportFilteredCSV() {
  const type = document.getElementById("exportFilterType").value;
  const value = document.getElementById("exportFilterValue").value.trim().toLowerCase();
  const votes = load("votes");
  const students = load("students");

  const filtered = votes.filter(v => {
    const student = students.find(s => s.adm === v.adm);
    if (!student) return false;
    return (type === "class" && student.class.toLowerCase() === value) ||
           (type === "dorm" && student.dorm.toLowerCase() === value) ||
           (type === "post" && v.position.toLowerCase() === value);
  });

  if (!filtered.length) { alert("No data found for this filter."); return; }

  let csv = "Admission,Name,Position,VotedFor,Time\n";
  filtered.forEach(v => {
    csv += `${v.adm},${v.name},${v.position},${v.votedFor},${v.time}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "votes_export.csv";
  link.click();

  addLog("export", `CSV export: ${type}=${value} (${filtered.length} rows)`);
}

function exportFilteredPDF() {
  const type = document.getElementById("exportFilterType").value;
  const value = document.getElementById("exportFilterValue").value.trim().toLowerCase();
  const votes = load("votes");
  const students = load("students");

  const filtered = votes.filter(v => {
    const student = students.find(s => s.adm === v.adm);
    if (!student) return false;
    return (type === "class" && student.class.toLowerCase() === value) ||
           (type === "dorm" && student.dorm.toLowerCase() === value) ||
           (type === "post" && v.position.toLowerCase() === value);
  });

  if (!filtered.length) { alert("No data found for this filter."); return; }

  const win = window.open("", "_blank");
  win.document.write(`
    <h2>Vote Results</h2>
    <p>Filter: ${type} = ${value}</p>
    <table border='1' cellpadding='6' cellspacing='0'>
      <tr><th>Adm</th><th>Name</th><th>Position</th><th>VotedFor</th><th>Time</th></tr>
      ${filtered.map(v => `<tr><td>${v.adm}</td><td>${v.name}</td><td>${v.position}</td><td>${v.votedFor}</td><td>${v.time}</td></tr>`).join("")}
    </table>
  `);
  win.document.close();
  win.print();

  addLog("export", `PDF export: ${type}=${value} (${filtered.length} rows)`);
}

// --- Ensure dropdowns are populated on register/login pages ---
window.onload = function() {
  populateOptions("class", "classes", "Select Class");
  populateOptions("dorm", "dorms", "Select Dorm");
};

/***********************
 * VOTING PAGE LOADER  *
 ***********************/
function loadVotingPage() {
  const user = requireLogin(); // ensure logged in
  buildVotingUI("voteForms");

  // Add submit button if not already present
  const existingBtn = document.getElementById("submitVoteBtn");
  if (!existingBtn) {
    const btn = document.createElement("button");
    btn.id = "submitVoteBtn";
    btn.textContent = "Submit Votes";
    btn.onclick = submitSelectedVotes;
    document.getElementById("voteSection").appendChild(btn);
  }

  // Disable if deadline passed
  disableVotingIfPastDeadline();
}

function populateLoginDropdowns() {
  let classes = JSON.parse(localStorage.getItem("classes")) || [];
  let dorms = JSON.parse(localStorage.getItem("dorms")) || [];

  let classSelect = document.getElementById("loginClass");
  let dormSelect = document.getElementById("loginDorm");

  if (classSelect) {
    classSelect.innerHTML = '<option value="">--Select Class--</option>';
    classes.forEach(c => {
      classSelect.innerHTML += `<option value="${c}">${c}</option>`;
    });
  }

  if (dormSelect) {
    dormSelect.innerHTML = '<option value="">--Select Dorm--</option>';
    dorms.forEach(d => {
      dormSelect.innerHTML += `<option value="${d}">${d}</option>`;
    });
  }
}
