// ================== ADMIN.JS (Firebase v11 Modular, Final) ==================
// Full Admin Panel Logic + System Maintenance (Modular API + Role-based Navigation)

// ---------- MODULAR FIREBASE IMPORTS (v11.6.1) ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  addDoc,
  writeBatch,
  Timestamp,
  serverTimestamp,
  limit,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

console.log("Admin panel JS loaded – modular build v11");

// ---------- FIREBASE INIT & GLOBAL VARIABLE SETUP ----------
const firebaseConfig =
  typeof __firebase_config !== "undefined" ? JSON.parse(__firebase_config) : {};
const initialAuthToken =
  typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;

if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.warn(
    "[ADMIN] Firebase config missing or incomplete. Set __firebase_config before loading admin.js."
  );
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// Reserved in case we add callable functions later
const functions = getFunctions(app, "asia-south1");

let currentUserId = null;
let currentRole = null;

// ---------- DOM REFERENCES ----------
const navLinks = document.querySelectorAll(".nav-link");
const contentArea = document.getElementById("contentArea");
const pageTitle = document.getElementById("pageTitle");
const logoutBtn = document.getElementById("logoutBtn");
const noticeBoard = document.getElementById("noticeBoard");
const topNotice = document.getElementById("topNotice");
const adminEmailEl = document.getElementById("adminEmail");
const adminRoleEl = document.getElementById("adminRole");
const adminEmailTop = document.getElementById("adminEmailTop");
const adminRoleTop = document.getElementById("adminRoleTop");

// Maintenance modal
const purgeModal = document.getElementById("purgeModal");
const cancelPurgeBtn = document.getElementById("cancelPurgeBtn");
const confirmPurgeBtn = document.getElementById("confirmPurgeBtn");

// ---------- UTILS ----------
function setTextSafe(el, text) {
  if (el) el.textContent = text;
}

function safeTimestampMillis(ts, fallback) {
  if (!ts || typeof ts.toMillis !== "function") return fallback;
  try {
    return ts.toMillis();
  } catch (err) {
    console.warn("[ADMIN] Invalid Timestamp:", err);
    return fallback;
  }
}

// Simple role-based navigation map (extensible)
const NAV_BY_ROLE = {
  ADMIN: [
    "overview",
    "students",
    "faculty",
    "subjects",
    "assignments",
    "marks",
    "roles",
    "notices",
    "maintenance",
  ],
  FACULTY: ["overview", "marks", "notices"],
  STUDENT: ["overview", "marks", "notices"],
};

function applyRoleNavigation(role) {
  const allowed = NAV_BY_ROLE[role] || [];
  navLinks.forEach((link) => {
    const page = link.dataset.page;
    if (!page) return;
    if (!allowed.length || allowed.includes(page)) {
      link.classList.remove("hidden");
    } else {
      link.classList.add("hidden");
    }
  });
}

// ======================================================
// AUTH GUARD + ROLE CHECK
// ======================================================

// 1) Initial sign-in (custom token preferred, else anonymous)
(async () => {
  try {
    if (initialAuthToken) {
      await signInWithCustomToken(auth, initialAuthToken);
    } else {
      await signInAnonymously(auth);
    }
  } catch (err) {
    console.error("Initial sign-in failed:", err);
    setTextSafe(
      topNotice,
      "Initial sign-in failed. Please contact Exam Branch or try again."
    );
  }
})();

// 2) Auth state listener + role check
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUserId = user.uid;
  setTextSafe(adminEmailEl, user.email || "(no email)");
  setTextSafe(adminEmailTop, user.email || "");

  try {
    const roleDocRef = doc(db, "roles", user.uid);
    const roleSnap = await getDoc(roleDocRef);

    if (!roleSnap.exists()) {
      console.warn("No role document for user – treating as NON-ADMIN.");
      window.location.href = "unauthorized.html";
      return;
    }

    const role = (roleSnap.data().role || "").toUpperCase();
    currentRole = role;
    setTextSafe(adminRoleEl, "Role: " + role);
    setTextSafe(adminRoleTop, "Role: " + role);

    if (role !== "ADMIN") {
      // For this dedicated admin panel, block non-admins.
      window.location.href = "unauthorized.html";
      return;
    }

    // Role-based navigation (mostly redundant for pure ADMIN-only, but helps future-proofing)
    applyRoleNavigation(role);

    // Enable UI
    attachNavHandlers();
    loadNoticeTicker();
    loadPage("overview");
  } catch (err) {
    console.error("Error checking admin role:", err);
    setTextSafe(
      topNotice,
      "Error verifying admin access. Please contact Exam Branch."
    );
  }
});

// LOGOUT
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth)
      .then(() => {
        window.location.href = "index.html";
      })
      .catch((err) => {
        console.error(err);
        setTextSafe(topNotice, "Logout failed. Check console.");
      });
  });
}

// ======================================================
// NAVIGATION
// ======================================================
function attachNavHandlers() {
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const page = link.dataset.page;
      loadPage(page);
    });
  });
}

function loadPage(page) {
  if (!contentArea) return;

  // Active styling
  navLinks.forEach((link) => {
    link.classList.remove("bg-sky-700", "text-white");
    link.classList.add(
      "p-2",
      "text-slate-300",
      "hover:bg-slate-800",
      "rounded-lg"
    );
  });
  const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (activeLink) {
    activeLink.classList.add("bg-sky-700", "text-white");
    activeLink.classList.remove("hover:bg-slate-800", "text-slate-300");
  }

  setTextSafe(pageTitle, formatTitle(page));
  contentArea.innerHTML =
    "<div class='text-slate-300 panel-card'>Loading " +
    formatTitle(page) +
    "...</div>";

  try {
    switch (page) {
      case "overview":
        renderOverview();
        break;
      case "students":
        renderStudentsPage();
        break;
      case "faculty":
        renderFacultyPage();
        break;
      case "subjects":
        renderSubjectsPage();
        break;
      case "assignments":
        renderAssignmentsPage();
        break;
      case "marks":
        renderMarksPage();
        break;
      case "roles":
        renderRolesPage();
        break;
      case "notices":
        renderNoticesPage();
        break;
      case "maintenance":
        renderMaintenancePage();
        break;
      default:
        contentArea.innerHTML =
          "<div class='panel-card text-red-400 text-sm'>Unknown page: " +
          String(page) +
          "</div>";
    }
  } catch (err) {
    console.error("Error loading page", page, err);
    contentArea.innerHTML =
      '<div class="panel-card border border-red-500/40 bg-red-900/30 text-sm text-red-100">' +
      "Error loading <b>" +
      String(page) +
      "</b>. Check console." +
      "</div>";
  }
}

function formatTitle(page) {
  if (!page) return "";
  const cleaned = String(page).replace(/[-_]+/g, " ");
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ======================================================
// FOOTER NOTICE TICKER
// ======================================================
function loadNoticeTicker() {
  if (!noticeBoard) return;
  noticeBoard.innerHTML = "Loading notices...";

  const now = Timestamp.now();
  const noticesColRef = collection(db, "notices");
  const qNotices = query(
    noticesColRef,
    where("active", "==", true),
    where("expiresAt", ">", now),
    limit(5)
  );

  getDocs(qNotices)
    .then((snap) => {
      if (snap.empty) {
        noticeBoard.textContent = "No active notices.";
        return;
      }

      const sortedDocs = snap.docs.sort((a, b) => {
        const ad = a.data();
        const bd = b.data();
        const aTs = safeTimestampMillis(ad.expiresAt, Number.MAX_SAFE_INTEGER);
        const bTs = safeTimestampMillis(bd.expiresAt, Number.MAX_SAFE_INTEGER);
        return aTs - bTs;
      });

      let html = "";
      sortedDocs.forEach((docSnap) => {
        const n = docSnap.data();
        const text = n.title || n.message || "Notice";
        html += "<span class='mr-6 text-sky-300'>• " + text + "</span>";
      });
      noticeBoard.innerHTML = html;
    })
    .catch((err) => {
      console.error("Notice ticker error", err);
      noticeBoard.textContent = "Unable to load notices.";
    });
}

// ======================================================
// CSV HELPERS
// ======================================================
function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] || "").trim();
    });
    records.push(obj);
  }
  return records;
}

function handleCsvUpload(opts) {
  const fileInput = opts.fileInput;
  const msgEl = opts.msgEl;
  const collectionName = opts.collection;
  const transform = opts.transform;
  const docId = opts.docId;

  const file = fileInput.files[0];
  if (!file) {
    msgEl.textContent = "Please choose a CSV file.";
    msgEl.className = "text-xs text-red-300 mt-2";
    return;
  }
  msgEl.className = "text-xs text-slate-200 mt-2";
  msgEl.textContent = "Reading file...";

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const records = parseCsv(text);
      if (!records.length) {
        msgEl.textContent = "No valid rows found.";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        msgEl.textContent = "File is large; upload may take time...";
      } else {
        msgEl.textContent = "Uploading " + records.length + " rows...";
      }

      const batchSize = 300;
      let processed = 0;

      function runBatch() {
        if (processed >= records.length) {
          msgEl.textContent =
            'Done. Uploaded ' +
            records.length +
            ' rows into "' +
            collectionName +
            '".';
          fileInput.value = "";
          return;
        }
        const batch = writeBatch(db);
        const slice = records.slice(processed, processed + batchSize);
        slice.forEach((r) => {
          const data = transform(r);
          const id = docId(r);
          if (!id) return;
          const ref = doc(db, collectionName, id);
          batch.set(ref, data, { merge: true });
        });
        batch
          .commit()
          .then(() => {
            processed += slice.length;
            msgEl.textContent =
              "Uploaded " + processed + "/" + records.length + " rows...";
            runBatch();
          })
          .catch((err) => {
            console.error(err);
            msgEl.textContent = "Error uploading CSV. Check console.";
            msgEl.className = "text-xs text-red-300 mt-2";
          });
      }

      runBatch();
    } catch (err) {
      console.error(err);
      msgEl.textContent = "Error uploading CSV. Check console.";
      msgEl.className = "text-xs text-red-300 mt-2";
    }
  };
  reader.readAsText(file);
}

// ======================================================
// STUDENTS PAGE
// ======================================================
function renderStudentsPage() {
  contentArea.innerHTML =
    '<div class="panel-card mb-4">' +
    '  <h3 class="font-semibold mb-2">Add Single Student</h3>' +
    '  <form id="studentForm" class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">' +
    '    <input required name="roll" class="input" placeholder="Roll (e.g., 21BD1A0501)">' +
    '    <input required name="name" class="input" placeholder="Name">' +
    '    <input required name="branch" class="input" placeholder="Branch (e.g., CSE)">' +
    '    <input required name="semester" class="input" placeholder="Semester (e.g., 3)">' +
    '    <input required name="section" class="input" placeholder="Section (e.g., A)">' +
    '    <input name="phone" class="input" placeholder="Phone">' +
    '    <input name="email" class="input md:col-span-2" placeholder="Email">' +
    '    <button class="btn-primary mt-1 md:col-span-1 px-3 py-1.5">Save Student</button>' +
    "  </form>" +
    '  <div id="studentFormMsg" class="text-xs mt-2 text-slate-200"></div>' +
    "</div>" +
    '<div class="panel-card">' +
    '  <h3 class="font-semibold mb-2">Bulk Upload Students (CSV)</h3>' +
    '  <p class="text-xs text-slate-300 mb-2">' +
    "    Headers required: <code>roll,name,branch,semester,section,phone,email</code>" +
    "  </p>" +
    '  <input id="studentCsv" type="file" accept=".csv" class="text-xs mb-2 text-slate-200">' +
    '  <button id="uploadStudentsBtn" class="btn-upload text-xs disabled:opacity-40" disabled>Upload</button>' +
    '  <div id="studentCsvMsg" class="text-xs mt-2 text-slate-200"></div>' +
    "</div>";

  const form = document.getElementById("studentForm");
  const formMsg = document.getElementById("studentFormMsg");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    formMsg.textContent = "Saving...";
    const data = Object.fromEntries(new FormData(form).entries());
    setDoc(doc(db, "students", data.roll), {
      roll: data.roll,
      name: data.name,
      branch: data.branch,
      semester: data.semester,
      section: data.section,
      phone: data.phone || "",
      email: data.email || "",
      createdAt: serverTimestamp(),
    })
      .then(() => {
        formMsg.textContent = "Student saved.";
        form.reset();
      })
      .catch((err) => {
        console.error(err);
        formMsg.textContent = "Error saving student.";
      });
  });

  const fileInput = document.getElementById("studentCsv");
  const uploadBtn = document.getElementById("uploadStudentsBtn");
  const csvMsg = document.getElementById("studentCsvMsg");

  fileInput.addEventListener("change", () => {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", () => {
    handleCsvUpload({
      fileInput,
      msgEl: csvMsg,
      collection: "students",
      transform: (r) => ({
        roll: r.roll,
        name: r.name,
        branch: r.branch,
        semester: r.semester,
        section: r.section,
        phone: r.phone || "",
        email: r.email || "",
        createdAt: serverTimestamp(),
      }),
      docId: (r) => r.roll,
    });
  });
}

// ======================================================
// FACULTY PAGE
// ======================================================
function renderFacultyPage() {
  contentArea.innerHTML =
    '<div class="panel-card mb-4">' +
    '  <h3 class="font-semibold mb-2">Add Single Faculty</h3>' +
    '  <form id="facultyForm" class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">' +
    '    <input required name="facultyId" class="input" placeholder="Faculty ID (use UID or custom)">' +
    '    <input required name="name" class="input" placeholder="Name">' +
    '    <input required name="branch" class="input" placeholder="Branch">' +
    '    <input name="phone" class="input" placeholder="Phone">' +
    '    <input name="email" class="input md:col-span-2" placeholder="Email">' +
    '    <button class="btn-primary mt-1 md:col-span-1 px-3 py-1.5">Save Faculty</button>' +
    "  </form>" +
    '  <div id="facultyFormMsg" class="text-xs mt-2 text-slate-200"></div>' +
    "</div>" +
    '<div class="panel-card">' +
    '  <h3 class="font-semibold mb-2">Bulk Upload Faculty (CSV)</h3>' +
    '  <p class="text-xs text-slate-300 mb-2">Headers: <code>facultyId,name,branch,phone,email</code></p>' +
    '  <input id="facultyCsv" type="file" accept=".csv" class="text-xs mb-2 text-slate-200">' +
    '  <button id="uploadFacultyBtn" class="btn-upload text-xs disabled:opacity-40" disabled>Upload</button>' +
    '  <div id="facultyCsvMsg" class="text-xs mt-2 text-slate-200"></div>' +
    "</div>";

  const form = document.getElementById("facultyForm");
  const formMsg = document.getElementById("facultyFormMsg");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    formMsg.textContent = "Saving...";
    const data = Object.fromEntries(new FormData(form).entries());
    setDoc(doc(db, "faculty", data.facultyId), {
      facultyId: data.facultyId,
      name: data.name,
      branch: data.branch,
      phone: data.phone || "",
      email: data.email || "",
      createdAt: serverTimestamp(),
    })
      .then(() => {
        formMsg.textContent = "Faculty saved.";
        form.reset();
      })
      .catch((err) => {
        console.error(err);
        formMsg.textContent = "Error saving faculty.";
      });
  });

  const fileInput = document.getElementById("facultyCsv");
  const uploadBtn = document.getElementById("uploadFacultyBtn");
  const csvMsg = document.getElementById("facultyCsvMsg");

  fileInput.addEventListener("change", () => {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", () => {
    handleCsvUpload({
      fileInput,
      msgEl: csvMsg,
      collection: "faculty",
      transform: (r) => ({
        facultyId: r.facultyId,
        name: r.name,
        branch: r.branch,
        phone: r.phone || "",
        email: r.email || "",
        createdAt: serverTimestamp(),
      }),
      docId: (r) => r.facultyId,
    });
  });
}

// ======================================================
// SUBJECTS PAGE
// ======================================================
function renderSubjectsPage() {
  contentArea.innerHTML =
    '<div class="panel-card">' +
    '  <h3 class="font-semibold mb-2">Bulk Upload Subjects</h3>' +
    '  <p class="text-xs text-slate-300 mb-2">' +
    "    Headers: <code>subjectCode,subjectName,semester,branch,credits,subjectType</code>" +
    "  </p>" +
    '  <input id="subjectCsv" type="file" accept=".csv" class="text-xs mb-2 text-slate-200">' +
    '  <button id="uploadSubjectsBtn" class="btn-upload text-xs disabled:opacity-40" disabled>Upload</button>' +
    '  <div id="subjectCsvMsg" class="text-xs mt-2 text-slate-200"></div>' +
    "</div>";

  const fileInput = document.getElementById("subjectCsv");
  const uploadBtn = document.getElementById("uploadSubjectsBtn");
  const csvMsg = document.getElementById("subjectCsvMsg");

  fileInput.addEventListener("change", () => {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", () => {
    handleCsvUpload({
      fileInput,
      msgEl: csvMsg,
      collection: "subjects",
      transform: (r) => ({
        subjectCode: r.subjectCode,
        subjectName: r.subjectName,
        semester: r.semester,
        branch: r.branch,
        credits: r.credits,
        subjectType: r.subjectType,
        createdAt: serverTimestamp(),
      }),
      docId: (r) => r.subjectCode,
    });
  });
}

// ======================================================
// FACULTY–SUBJECT ASSIGNMENTS PAGE
// ======================================================
function renderAssignmentsPage() {
  contentArea.innerHTML =
    '<div class="panel-card">' +
    '  <h3 class="font-semibold mb-2">Bulk Upload Faculty–Subject Assignments</h3>' +
    '  <p class="text-xs text-slate-300 mb-2">' +
    "    Headers: <code>facultyId,facultyName,subjectCode,subjectName,semester,branch,section</code>" +
    "  </p>" +
    '  <input id="assignCsv" type="file" accept=".csv" class="text-xs mb-2 text-slate-200">' +
    '  <button id="uploadAssignBtn" class="btn-upload text-xs disabled:opacity-40" disabled>Upload</button>' +
    '  <div id="assignCsvMsg" class="text-xs mt-2 text-slate-200"></div>' +
    "</div>";

  const fileInput = document.getElementById("assignCsv");
  const uploadBtn = document.getElementById("uploadAssignBtn");
  const csvMsg = document.getElementById("assignCsvMsg");

  fileInput.addEventListener("change", () => {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", () => {
    handleCsvUpload({
      fileInput,
      msgEl: csvMsg,
      collection: "facultyAssignments",
      transform: (r) => ({
        facultyId: r.facultyId,
        facultyName: r.facultyName,
        subjectCode: r.subjectCode,
        subjectName: r.subjectName,
        semester: r.semester,
        branch: r.branch,
        section: r.section,
        createdAt: serverTimestamp(),
      }),
      docId: (r) => r.facultyId + "_" + r.subjectCode + "_" + r.section,
    });
  });
}

// ======================================================
// MARKS PAGE
// ======================================================
function renderMarksPage() {
  contentArea.innerHTML =
    '<div class="panel-card">' +
    '  <h3 class="font-semibold mb-2">Bulk Upload Marks</h3>' +
    '  <p class="text-xs text-slate-300 mb-2">' +
    "    Headers: <code>roll,subjectCode,subjectName,internalMarks,externalMarks,totalMarks,semester,branch,section,examType</code>" +
    "  </p>" +
    '  <input id="marksCsv" type="file" accept=".csv" class="text-xs mb-2 text-slate-200">' +
    '  <button id="uploadMarksBtn" class="btn-upload text-xs disabled:opacity-40" disabled>Upload</button>' +
    '  <div id="marksCsvMsg" class="text-xs mt-2 text-slate-200'></div>" +
    "</div>";

  const fileInput = document.getElementById("marksCsv");
  const uploadBtn = document.getElementById("uploadMarksBtn");
  const csvMsg = document.getElementById("marksCsvMsg");

  fileInput.addEventListener("change", () => {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", () => {
    handleCsvUpload({
      fileInput,
      msgEl: csvMsg,
      collection: "marks",
      transform: (r) => ({
        roll: r.roll,
        subjectCode: r.subjectCode,
        subjectName: r.subjectName,
        internalMarks: Number(r.internalMarks || 0),
        externalMarks: Number(r.externalMarks || 0),
        totalMarks: Number(r.totalMarks || 0),
        semester: r.semester,
        branch: r.branch,
        section: r.section,
        examType: r.examType || "REGULAR",
        createdAt: serverTimestamp(),
      }),
      docId: (r) =>
        r.roll + "_" + r.subjectCode + "_" + (r.examType || "REGULAR"),
    });
  });
}

// ======================================================
// ROLES PAGE
// ======================================================
function renderRolesPage() {
  contentArea.innerHTML =
    '<div class="panel-card mb-4">' +
    '  <h3 class="font-semibold mb-2">Assign Role to User</h3>' +
    '  <form id="roleForm" class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">' +
    '    <input required name="uid" class="input" placeholder="Firebase UID">' +
    '    <input required name="email" class="input" placeholder="User Email (info only)">' +
    '    <select required name="role" class="input">' +
    '      <option value="ADMIN">ADMIN</option>' +
    '      <option value="FACULTY">FACULTY</option>' +
    '      <option value="STUDENT">STUDENT</option>' +
    "    </select>" +
    '    <button class="btn-primary mt-1 md:col-span-1 px-3 py-1.5">Save Role</button>' +
    "  </form>" +
    '  <div id="roleFormMsg" class="text-xs mt-2 text-slate-200'></div>" +
    '  <p class="text-[11px] text-slate-400 mt-2">This writes into <code>roles</code> collection.</p>' +
    "</div>" +
    '<div class="panel-card">' +
    '  <h3 class="font-semibold mb-2">Bulk Upload Roles (CSV)</h3>' +
    '  <p class="text-xs text-slate-300 mb-2">Headers: <code>uid,role</code></p>' +
    '  <input id="rolesCsv" type="file" accept=".csv" class="text-xs mb-2 text-slate-200">' +
    '  <button id="uploadRolesBtn" class="btn-upload text-xs disabled:opacity-40" disabled>Upload</button>' +
    '  <div id="rolesCsvMsg" class="text-xs mt-2 text-slate-200'></div>" +
    "</div>";

  const form = document.getElementById("roleForm");
  const formMsg = document.getElementById("roleFormMsg");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    formMsg.textContent = "Saving role...";
    const data = Object.fromEntries(new FormData(form).entries());
    const role = (data.role || "").toUpperCase();
    setDoc(doc(db, "roles", data.uid), {
      role,
      email: data.email,
      updatedAt: serverTimestamp(),
    })
      .then(() => {
        formMsg.textContent = "Role saved.";
        form.reset();
      })
      .catch((err) => {
        console.error(err);
        formMsg.textContent = "Error saving role.";
      });
  });

  const fileInput = document.getElementById("rolesCsv");
  const uploadBtn = document.getElementById("uploadRolesBtn");
  const csvMsg = document.getElementById("rolesCsvMsg");

  fileInput.addEventListener("change", () => {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", () => {
    handleCsvUpload({
      fileInput,
      msgEl: csvMsg,
      collection: "roles",
      transform: (r) => ({
        role: (r.role || "").toUpperCase(),
        updatedAt: serverTimestamp(),
      }),
      docId: (r) => r.uid,
    });
  });
}

// ======================================================
// NOTICES PAGE
// ======================================================
function renderNoticesPage() {
  contentArea.innerHTML =
    '<div class="panel-card mb-4">' +
    '  <h3 class="font-semibold mb-2">Create Notice</h3>' +
    '  <form id="noticeForm" class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">' +
    '    <input required name="title" class="input md:col-span-2" placeholder="Title">' +
    '    <select name="active" class="input">' +
    '      <option value="true">Active</option>' +
    '      <option value="false">Inactive</option>' +
    "    </select>" +
    '    <textarea name="message" rows="3" class="input md:col-span-3" placeholder="Full notice text (optional)"></textarea>' +
    '    <input name="expiresAt" type="date" class="input md:col-span-1" placeholder="Expiry date (YYYY-MM-DD) optional">' +
    '    <label class="text-[11px] text-slate-400 md:col-span-2 flex items-center">' +
    '      <input type="checkbox" name="pinned" class="mr-2">Pinned / High Priority' +
    "    </label>" +
    '    <button class="btn-primary mt-1 md:col-span-1 px-3 py-1.5">Save Notice</button>' +
    "  </form>" +
    '  <div id="noticeFormMsg" class="text-xs mt-2 text-slate-200'></div>" +
    "</div>" +
    '<div class="panel-card">' +
    '  <h3 class="font-semibold mb-2">Recent Notices</h3>' +
    '  <div id="noticesList" class="text-xs text-slate-200">Loading...</div>' +
    "</div>";

  const form = document.getElementById("noticeForm");
  const formMsg = document.getElementById("noticeFormMsg");
  const listEl = document.getElementById("noticesList");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    formMsg.textContent = "Saving notice...";
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());

    let expiresAtTs = null;
    if (data.expiresAt) {
      const d = new Date(data.expiresAt + "T23:59:59");
      if (!isNaN(d.getTime())) {
        expiresAtTs = Timestamp.fromDate(d);
      }
    }

    addDoc(collection(db, "notices"), {
      title: data.title,
      message: data.message || "",
      active: data.active === "true",
      pinned: fd.get("pinned") === "on",
      createdAt: serverTimestamp(),
      expiresAt: expiresAtTs,
    })
      .then(() => {
        formMsg.textContent = "Notice saved.";
        form.reset();
        loadNoticesList(listEl);
        loadNoticeTicker();
      })
      .catch((err) => {
        console.error(err);
        formMsg.textContent = "Error saving notice.";
      });
  });

  loadNoticesList(listEl);
}

function loadNoticesList(listEl) {
  const noticesColRef = collection(db, "notices");
  const qNotices = query(noticesColRef, limit(20));

  getDocs(qNotices)
    .then((snap) => {
      if (snap.empty) {
        listEl.textContent = "No notices yet.";
        return;
      }

      const sortedDocs = snap.docs.sort((a, b) => {
        const ad = a.data();
        const bd = b.data();
        const aTs = safeTimestampMillis(ad.createdAt, 0);
        const bTs = safeTimestampMillis(bd.createdAt, 0);
        return bTs - aTs;
      });

      let html = "<ul class='space-y-1'>";
      sortedDocs.forEach((docSnap) => {
        const n = docSnap.data();
        const active = n.active ? "ACTIVE" : "INACTIVE";
        const pinned = n.pinned ? "⭐ " : "";
        html +=
          "<li class='border-b border-slate-700/60 py-1 flex justify-between'>" +
          "<div>" +
          "<div class='font-semibold'>" +
          pinned +
          (n.title || "(no title)") +
          "</div>" +
          "<div class='text-[11px] text-slate-400'>" +
          (n.message || "") +
          "</div>" +
          "</div>" +
          "<div class='text-[10px] mt-1 " +
          (n.active ? "text-emerald-300" : "text-slate-500") +
          "'>" +
          active +
          "</div>" +
          "</li>";
      });
      html += "</ul>";
      listEl.innerHTML = html;
    })
    .catch((err) => {
      console.error("Notices list error", err);
      listEl.textContent = "Unable to load notices.";
    });
}

// ======================================================
// OVERVIEW PAGE
// ======================================================
function renderOverview() {
  const html =
    "<div class='grid grid-cols-1 md:grid-cols-3 gap-4 mb-5'>" +
    "  <div class='panel-card'>" +
    "    <div class='text-[11px] text-slate-300'>Total Students</div>" +
    "    <div id='ovStudents' class='text-2xl font-bold mt-1'>–</div>" +
    "  </div>" +
    "  <div class='panel-card'>" +
    "    <div class='text-[11px] text-slate-300'>Total Faculty</div>" +
    "    <div id='ovFaculty' class='text-2xl font-bold mt-1'>–</div>" +
    "  </div>" +
    "  <div class='panel-card'>" +
    "    <div class='text-[11px] text-slate-300'>Subjects Offered</div>" +
    "    <div id='ovSubjects' class='text-2xl font-bold mt-1'>–</div>" +
    "  </div>" +
    "</div>" +
    "<div class='grid grid-cols-1 md:grid-cols-2 gap-4'>" +
    "  <div class='panel-card'>" +
    "    <div class='text-sm font-semibold mb-2'>Marks Summary</div>" +
    "    <div id='ovMarks' class='text-slate-300 text-sm'>Loading...</div>" +
    "  </div>" +
    "  <div class='panel-card'>" +
    "    <div class='text-sm font-semibold mb-2'>Latest Notices</div>" +
    "    <ul id='ovNotices' class='text-xs text-slate-300 space-y-1'></ul>" +
    "  </div>" +
    "</div>";

  contentArea.innerHTML = html;

  Promise.all([
    getDocs(collection(db, "students")),
    getDocs(collection(db, "faculty")),
    getDocs(collection(db, "subjects")),
    getDocs(query(collection(db, "marks"), limit(5))),
    getDocs(query(collection(db, "notices"), limit(5))),
  ])
    .then((res) => {
      const [studSnap, facSnap, subSnap, marksSnap, noticesSnap] = res;

      setTextSafe(
        document.getElementById("ovStudents"),
        String(studSnap.size)
      );
      setTextSafe(document.getElementById("ovFaculty"), String(facSnap.size));
      setTextSafe(
        document.getElementById("ovSubjects"),
        String(subSnap.size)
      );

      const ovMarks = document.getElementById("ovMarks");
      if (marksSnap.empty) {
        ovMarks.textContent = "No marks uploaded yet.";
      } else {
        ovMarks.textContent =
          "Recent marks entries: " +
          marksSnap.size +
          " (showing last " +
          marksSnap.size +
          ").";
      }

      const ovNotices = document.getElementById("ovNotices");
      if (noticesSnap.empty) {
        ovNotices.innerHTML = "<li>No active notices.</li>";
      } else {
        const sortedDocs = noticesSnap.docs.sort((a, b) => {
          const ad = a.data();
          const bd = b.data();
          const aTs = safeTimestampMillis(ad.createdAt, 0);
          const bTs = safeTimestampMillis(bd.createdAt, 0);
          return bTs - aTs;
        });

        let listHtml = "";
        sortedDocs.forEach((docSnap) => {
          const n = docSnap.data();
          const text = n.title || n.message || "(no title)";
          listHtml += "<li>• " + text + "</li>";
        });
        ovNotices.innerHTML = listHtml;
      }
    })
    .catch((err) => {
      console.error("Overview load error", err);
    });
}

// ======================================================
// SYSTEM MAINTENANCE PAGE
// ======================================================
function renderMaintenancePage() {
  contentArea.innerHTML =
    "<div class='panel-card mb-4'>" +
    "  <h3 class='font-semibold mb-2'>System Maintenance</h3>" +
    "  <p class='text-xs text-slate-300 mb-3'>" +
    "    Notices auto-expire logically after 30 days or when <code>expiresAt</code> is past." +
    "  </p>" +
    "  <div id='maintSummary' class='text-xs mb-3'>Loading summary...</div>" +
    "  <button id='purgeNowBtn' class='btn-primary mt-2 px-3 py-1.5'>🗑 Purge Expired Notices Now</button>" +
    "</div>" +
    "<div class='panel-card'>" +
    "  <h3 class='font-semibold mb-2'>Purge Logs</h3>" +
    "  <div id='purgeLogs' class='text-xs text-slate-300'>Loading logs...</div>" +
    "</div>";

  const purgeNowBtn = document.getElementById("purgeNowBtn");
  if (purgeNowBtn) {
    purgeNowBtn.onclick = () => {
      if (purgeModal) purgeModal.classList.remove("hidden");
    };
  }
  if (cancelPurgeBtn) {
    cancelPurgeBtn.onclick = () => {
      purgeModal.classList.add("hidden");
    };
  }
  if (confirmPurgeBtn) {
    confirmPurgeBtn.onclick = runManualPurge;
  }

  loadMaintenanceSummary();
  loadPurgeLogs();
}

async function loadMaintenanceSummary() {
  const summaryEl = document.getElementById("maintSummary");
  if (!summaryEl) return;

  const now = Timestamp.now();
  const ageLimit = Date.now() - 30 * 24 * 3600 * 1000;
  const ageTs = Timestamp.fromMillis(ageLimit);
  const purgeBtn = document.getElementById("purgeNowBtn");
  if (purgeBtn) purgeBtn.disabled = true;

  const noticesColRef = collection(db, "notices");

  try {
    const oldNoticesQuery = query(noticesColRef, where("createdAt", "<", ageTs));
    const expiredNoticesQuery = query(
      noticesColRef,
      where("expiresAt", "<", now)
    );
    const activeNoticesQuery = query(
      noticesColRef,
      where("active", "==", true)
    );

    const [oldSnap, expSnap, activeSnap] = await Promise.all([
      getDocs(oldNoticesQuery),
      getDocs(expiredNoticesQuery),
      getDocs(activeNoticesQuery),
    ]);

    const docRefMap = new Map();
    oldSnap.forEach((docSnap) => docRefMap.set(docSnap.id, docSnap.ref));
    expSnap.forEach((docSnap) => docRefMap.set(docSnap.id, docSnap.ref));
    const purgeCandidateCount = docRefMap.size;

    summaryEl.innerHTML =
      "<div>Expired by age (&gt;30 days): <b>" +
      oldSnap.size +
      "</b></div>" +
      "<div>Expired by explicit date: <b>" +
      expSnap.size +
      "</b></div>" +
      "<div>Total notices to purge: <b class='text-red-400'>" +
      purgeCandidateCount +
      "</b></div>" +
      "<div>Currently active notices: <b>" +
      activeSnap.size +
      "</b></div>";

    if (purgeBtn) {
      if (purgeCandidateCount > 0) {
        purgeBtn.disabled = false;
        purgeBtn.textContent =
          "🗑 Purge Expired Notices Now (" + purgeCandidateCount + ")";
      } else {
        purgeBtn.textContent = "✅ No Expired Notices to Purge";
      }
    }
  } catch (err) {
    console.error("Summary load error", err);
    summaryEl.innerHTML =
      "<div class='text-red-400'>Error loading summary. Check security rules or console.</div>";
    if (purgeBtn) purgeBtn.disabled = true;
  }
}

async function runManualPurge() {
  if (purgeModal) purgeModal.classList.add("hidden");
  const logEl = document.getElementById("purgeLogs");
  if (!logEl) return;
  logEl.innerHTML =
    "<div class='text-yellow-400'>Starting purge process...</div>";

  const now = Timestamp.now();
  const ageLimit = Date.now() - 30 * 24 * 3600 * 1000;
  const ageTs = Timestamp.fromMillis(ageLimit);
  const noticesColRef = collection(db, "notices");

  try {
    const oldNoticesQuery = query(noticesColRef, where("createdAt", "<", ageTs));
    const expiredNoticesQuery = query(
      noticesColRef,
      where("expiresAt", "<", now)
    );

    const [oldSnap, expSnap] = await Promise.all([
      getDocs(oldNoticesQuery),
      getDocs(expiredNoticesQuery),
    ]);

    const docRefMap = new Map();
    oldSnap.forEach((docSnap) => docRefMap.set(docSnap.id, docSnap.ref));
    expSnap.forEach((docSnap) => docRefMap.set(docSnap.id, docSnap.ref));

    const docRefs = Array.from(docRefMap.values());
    const deleteCount = docRefs.length;

    if (deleteCount === 0) {
      logEl.innerHTML +=
        "<div class='text-emerald-400'>No documents to delete. Purge complete.</div>";
      loadMaintenanceSummary();
      return;
    }

    logEl.innerHTML +=
      "<div>Found <b class='text-red-400'>" +
      deleteCount +
      "</b> unique notices to delete.</div>";

    const batchSize = 499;
    let processed = 0;

    async function executeBatch() {
      if (processed >= deleteCount) {
        logEl.innerHTML +=
          "<div class='text-emerald-400'>✅ Purge Complete. Deleted " +
          deleteCount +
          " notices.</div>";
        loadMaintenanceSummary();
        return;
      }

      const currentBatch = writeBatch(db);
      const slice = docRefs.slice(processed, processed + batchSize);
      slice.forEach((ref) => currentBatch.delete(ref));

      await currentBatch.commit();
      processed += slice.length;
      logEl.innerHTML +=
        "<div>Successfully deleted batch. Total deleted: " +
        processed +
        "/" +
        deleteCount +
        "</div>";
      await executeBatch();
    }

    await executeBatch();
  } catch (err) {
    console.error("Purge query or batch error:", err);
    logEl.innerHTML =
      "<div class='text-red-400'>❌ Error during purge. Check console.</div>";
  }
}

function loadPurgeLogs() {
  const logEl = document.getElementById("purgeLogs");
  if (!logEl) return;
  logEl.innerHTML =
    "<div class='text-slate-400'>Purge logs are typically stored server-side. Showing runtime status only.</div>";
}
