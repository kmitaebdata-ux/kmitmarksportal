/* ======================================================
   STUDENT.JS — Premium Portal UI (Theme A)
   ====================================================== */

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyC1Aa_mnq_0g7ZEuLbYVjN62iCMWemlKUc",
  authDomain: "kmit-marks-portal-9db76.firebaseapp.com",
  projectId: "kmit-marks-portal-9db76",
  storageBucket: "kmit-marks-portal-9db76.firebasestorage.app",
  messagingSenderId: "264909025742",
  appId: "1:264909025742:web:84de5216860219e6bc3b9f"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

/* ======================================================
   AUTH CHECK
   ====================================================== */
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const roleRef = db.collection("roles").doc(user.uid);
  const roleSnap = await roleRef.get();

  if (!roleSnap.exists || roleSnap.data().role !== "STUDENT") {
    alert("Access denied — only students can view this dashboard.");
    await auth.signOut();
    window.location.href = "index.html";
    return;
  }

  loadStudentProfile(user.uid);
  loadMarks(user.uid);
  loadNotices();

  document.getElementById("stdLogout").addEventListener("click", () => {
    auth.signOut();
    window.location.href = "index.html";
  });
});

/* ======================================================
   LOAD STUDENT PROFILE
   ====================================================== */
async function loadStudentProfile(uid) {
  const snap = await db.collection("students").doc(uid).get();

  if (!snap.exists()) {
    document.getElementById("stdName").textContent = "Unknown Student";
    return;
  }

  const s = snap.data();

  document.getElementById("stdName").textContent = s.name;
  document.getElementById("stdRoll").textContent = s.roll;
  document.getElementById("stdBranch").textContent = `${s.branch} – Sem ${s.semester}`;
  document.getElementById("stdSection").textContent = `Section ${s.section}`;
}

/* ======================================================
   LOAD STUDENT MARKS
   Collection: marks
   ====================================================== */
async function loadMarks(uid) {
  const marksArea = document.getElementById("stdMarksArea");
  marksArea.innerHTML = `
    <div class="p-4 text-slate-300">Loading marks...</div>
  `;

  const snap = await db.collection("marks")
    .where("roll", "==", uid)
    .orderBy("semester", "asc")
    .get();

  if (snap.empty) {
    marksArea.innerHTML = `
      <div class="p-4 text-slate-300">No marks available.</div>
    `;
    return;
  }

  let subjects = [];
  let html = `
    <table class="min-w-full text-left">
      <thead class="bg-slate-800/60 text-[11px] text-slate-300">
        <tr>
          <th class="px-3 py-2">Subject</th>
          <th class="px-3 py-2 text-center">Internal</th>
          <th class="px-3 py-2 text-center">External</th>
          <th class="px-3 py-2 text-center">Total</th>
          <th class="px-3 py-2 text-center">Grade</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-800">
  `;

  let totalForSGPA = 0;
  let totalCredits = 0;

  snap.forEach(doc => {
    const m = doc.data();
    subjects.push(m);

    const credit = 3; // you can store "credits" in subject document later
    const grade = calculateGrade(m.totalMarks);

    totalForSGPA += gradeToPoints(grade) * credit;
    totalCredits += credit;

    html += `
      <tr>
        <td class="px-3 py-2">${m.subjectCode} – ${m.subjectName}</td>
        <td class="px-3 py-2 text-center">${m.internalMarks}</td>
        <td class="px-3 py-2 text-center">${m.externalMarks}</td>
        <td class="px-3 py-2 text-center text-emerald-300">${m.totalMarks}</td>
        <td class="px-3 py-2 text-center font-semibold">${grade}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  marksArea.innerHTML = html;

  // Show SGPA
  const sgpa = (totalForSGPA / totalCredits).toFixed(2);
  document.getElementById("stdSGPA").textContent = sgpa;

  // Show chart
  renderMarksChart(subjects);
}

/* ======================================================
   GRADE CALCULATOR
   ====================================================== */
function calculateGrade(total) {
  if (total >= 90) return "A+";
  if (total >= 80) return "A";
  if (total >= 70) return "B+";
  if (total >= 60) return "B";
  if (total >= 50) return "C";
  return "F";
}

function gradeToPoints(g) {
  return {
    "A+": 10,
    "A": 9,
    "B+": 8,
    "B": 7,
    "C": 6,
    "F": 0
  }[g] || 0;
}

/* ======================================================
   RENDER BAR CHART (Canvas)
   ====================================================== */
function renderMarksChart(subjects) {
  const canvas = document.getElementById("stdChart");
  const ctx = canvas.getContext("2d");

  const labels = subjects.map(s => s.subjectCode);
  const totals = subjects.map(s => s.totalMarks);

  // Clear previous chart
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const max = Math.max(...totals, 100);

  const barWidth = 40;
  const gap = 30;
  const startX = 50;
  const baseY = canvas.height - 30;

  totals.forEach((val, i) => {
    const x = startX + i * (barWidth + gap);
    const barHeight = (val / max) * 200;

    ctx.fillStyle = "rgba(99,102,241,0.8)";
    ctx.fillRect(x, baseY - barHeight, barWidth, barHeight);

    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    ctx.fillText(val, x + 8, baseY - barHeight - 5);

    ctx.fillText(labels[i], x, baseY + 15);
  });
}

/* ======================================================
   NOTICE TICKER
   ====================================================== */
async function loadNotices() {
  const bar = document.getElementById("stdNoticeBar");
  bar.textContent = "Loading...";

  const snap = await db.collection("notices")
    .where("active", "==", true)
    .orderBy("createdAt", "desc")
    .limit(6)
    .get();

  if (snap.empty) {
    bar.textContent = "No active notices.";
    return;
  }

  let html = "";
  snap.forEach(n => html += `• ${n.data().title}   `);
  bar.innerHTML = html;
}

/* ======================================================
   PDF DOWNLOAD (Simple HTML → window.print)
   ====================================================== */
document.getElementById("stdDownloadPDF").addEventListener("click", () => {
  window.print();
});
