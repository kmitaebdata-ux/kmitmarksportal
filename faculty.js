/* ======================================================
   FACULTY.JS – Premium UI (Theme A) + Firestore Logic
   ====================================================== */

// FIREBASE CONFIG (same project as admin & student)
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
   AUTH GUARD
   ====================================================== */

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    const roleRef = db.collection("roles").doc(user.uid);
    const roleSnap = await roleRef.get();

    if (!roleSnap.exists || roleSnap.data().role !== "FACULTY") {
      alert("Access Denied – Only faculty can access this dashboard.");
      await auth.signOut();
      window.location.href = "index.html";
      return;
    }

    loadFacultyProfile(user);
    loadAssignedSubjects(user.uid);
    loadNotices();
  } catch (err) {
    console.error("Faculty auth error:", err);
    alert("Error loading dashboard.");
  }
});

/* ======================================================
   LOAD FACULTY PROFILE
   ====================================================== */
async function loadFacultyProfile(user) {
  document.getElementById("facultyEmail").textContent = user.email || "-";

  // fetch extra profile from faculty collection if needed
  const facRef = db.collection("faculty").doc(user.uid);
  const facSnap = await facRef.get();

  if (facSnap.exists()) {
    document.getElementById("facultyName").textContent = facSnap.data().name;
  } else {
    document.getElementById("facultyName").textContent = user.email;
  }
}

document.getElementById("facultyLogout").addEventListener("click", () => {
  auth.signOut();
  window.location.href = "index.html";
});

/* ======================================================
   LOAD SUBJECTS ASSIGNED TO THIS FACULTY
   Collection: facultyAssignments
   ====================================================== */

let selectedSubject = null;
let marksBuffer = {}; // store temporary mark edits

async function loadAssignedSubjects(facultyId) {
  const facSubjectList = document.getElementById("facSubjectList");
  facSubjectList.innerHTML = "Loading...";

  const snap = await db.collection("facultyAssignments")
    .where("facultyId", "==", facultyId)
    .orderBy("semester", "asc")
    .get();

  if (snap.empty) {
    facSubjectList.innerHTML = `
      <div class="text-slate-300 text-xs">No subjects assigned.</div>`;
    return;
  }

  let html = "";
  snap.forEach(doc => {
    const s = doc.data();
    const id = `${s.subjectCode}__${s.branch}__${s.section}`;

    html += `
      <button onclick="selectSubject('${encodeURIComponent(JSON.stringify(s))}')"
              class="w-full text-left px-3 py-2 rounded-xl bg-slate-800/40 hover:bg-indigo-600/40">
        <div class="font-semibold text-xs">${s.subjectCode} – ${s.subjectName}</div>
        <div class="text-[10px] text-slate-300">
          ${s.branch} • Sem ${s.semester} • Sec ${s.section}
        </div>
      </button>
    `;
  });

  facSubjectList.innerHTML = html;

  document.getElementById("facTotalSubjects").textContent = snap.size;
}

/* ======================================================
   SUBJECT SELECTED → Load Students
   ====================================================== */

async function selectSubject(encoded) {
  selectedSubject = JSON.parse(decodeURIComponent(encoded));

  const title = `${selectedSubject.subjectCode} – ${selectedSubject.subjectName}`;
  document.getElementById("facSelectedSubjectTitle").textContent = title;
  document.getElementById("facSelectedSubjectMeta").textContent =
    `${selectedSubject.branch} • Semester ${selectedSubject.semester} • Section ${selectedSubject.section}`;

  document.getElementById("facMarksArea").innerHTML = `
    <div class="p-4 text-slate-300">Loading students...</div>
  `;
  document.getElementById("facSaveMarks").disabled = true;

  loadStudentListForSubject();
}

/* ======================================================
   LOAD STUDENTS FOR SELECTED SUBJECT
   ====================================================== */
async function loadStudentListForSubject() {
  const { branch, section, semester } = selectedSubject;

  const snap = await db.collection("students")
    .where("branch", "==", branch)
    .where("section", "==", section)
    .where("semester", "==", semester)
    .orderBy("roll")
    .get();

  if (snap.empty) {
    document.getElementById("facMarksArea").innerHTML =
      `<div class="p-4 text-slate-300">No students found.</div>`;
    return;
  }

  marksBuffer = {}; // reset buffer for new subject

  // Load previously saved marks for this subject
  const marksSnap = await db.collection("marks")
    .where("subjectCode", "==", selectedSubject.subjectCode)
    .where("branch", "==", branch)
    .where("semester", "==", semester)
    .where("section", "==", section)
    .get();

  marksSnap.forEach(doc => {
    marksBuffer[doc.data().roll] = {
      internal: doc.data().internalMarks,
      external: doc.data().externalMarks,
      total: doc.data().totalMarks,
      examType: doc.data().examType || "REGULAR"
    };
  });

  renderMarksTable(snap.docs);
}

/* ======================================================
   RENDER EXCEL-STYLE MARKS ENTRY GRID
   ====================================================== */

function renderMarksTable(studentDocs) {
  let html = `
    <table class="min-w-full text-left">
      <thead class="bg-slate-800/70 text-[11px] text-slate-300 sticky top-0">
        <tr>
          <th class="px-3 py-2">Roll</th>
          <th class="px-3 py-2">Name</th>
          <th class="px-3 py-2 text-center">Internal</th>
          <th class="px-3 py-2 text-center">External</th>
          <th class="px-3 py-2 text-center">Total</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-800">
  `;

  studentDocs.forEach(d => {
    const s = d.data();
    const m = marksBuffer[s.roll] || {};

    html += `
      <tr>
        <td class="px-3 py-2">${s.roll}</td>
        <td class="px-3 py-2">${s.name}</td>
        <td class="px-3 py-2 text-center">
          <input type="number" min="0" max="30"
                 class="w-16 text-center bg-slate-900/40 border border-slate-700 rounded p-1 text-xs"
                 value="${m.internal ?? ''}"
                 onchange="updateMark('${s.roll}', 'internal', this.value)">
        </td>
        <td class="px-3 py-2 text-center">
          <input type="number" min="0" max="70"
                 class="w-16 text-center bg-slate-900/40 border border-slate-700 rounded p-1 text-xs"
                 value="${m.external ?? ''}"
                 onchange="updateMark('${s.roll}', 'external', this.value)">
        </td>
        <td class="px-3 py-2 text-center text-emerald-300">
          ${m.total ?? '—'}
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;

  document.getElementById("facMarksArea").innerHTML = html;
  document.getElementById("facSaveMarks").disabled = false;
}

/* ======================================================
   UPDATE MARKS BUFFER ON EDIT
   ====================================================== */
function updateMark(roll, field, value) {
  if (!marksBuffer[roll]) marksBuffer[roll] = {};

  marksBuffer[roll][field] = Number(value || 0);

  // auto-calc total
  const internal = marksBuffer[roll].internal || 0;
  const external = marksBuffer[roll].external || 0;
  marksBuffer[roll].total = internal + external;

  // re-render totals only
  loadStudentListForSubject();
}

/* ======================================================
   SAVE MARKS TO FIRESTORE
   ====================================================== */
document.getElementById("facSaveMarks").addEventListener("click", async () => {
  if (!selectedSubject) return;

  const btn = document.getElementById("facSaveMarks");
  btn.textContent = "Saving...";
  btn.disabled = true;

  const batch = db.batch();

  Object.keys(marksBuffer).forEach(roll => {
    const m = marksBuffer[roll];

    const docId = `${roll}_${selectedSubject.subjectCode}_REGULAR`;

    const ref = db.collection("marks").doc(docId);
    batch.set(ref, {
      roll,
      subjectCode: selectedSubject.subjectCode,
      subjectName: selectedSubject.subjectName,
      branch: selectedSubject.branch,
      semester: selectedSubject.semester,
      section: selectedSubject.section,
      internalMarks: m.internal || 0,
      externalMarks: m.external || 0,
      totalMarks: m.total || 0,
      examType: m.examType || "REGULAR",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();

  btn.textContent = "Saved ✔";
  setTimeout(() => {
    btn.textContent = "Save Marks";
    btn.disabled = false;
  }, 1500);
});

/* ======================================================
   NOTICE TICKER (Footer)
   ====================================================== */
async function loadNotices() {
  const bar = document.getElementById("facNoticeBar");
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
  snap.forEach(doc => html += `• ${doc.data().title}   `);
  bar.innerHTML = html;
}
