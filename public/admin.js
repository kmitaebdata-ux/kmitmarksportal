// ================== ADMIN.JS (Firebase v11 Modular) ==================
// Full Admin Panel Logic + System Maintenance (Modular API)

// ---------- MODULAR FIREBASE IMPORTS (v11.6.1) ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, setDoc, addDoc, writeBatch, Timestamp, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

console.log("Admin panel JS loaded – modular build");

// ---------- FIREBASE INIT & GLOBAL VARIABLE SETUP (Mandatory) ----------
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
// const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; // Not strictly needed here but good practice

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
// Re-initializing functions with the original region 'asia-south1'
const functions = getFunctions(app, "asia-south1"); 
let currentUserId = null; // Store authenticated user's ID

// ---------- DOM REFERENCES ----------
var navLinks    = document.querySelectorAll('.nav-link');
var contentArea = document.getElementById('contentArea');
var pageTitle   = document.getElementById('pageTitle');
var logoutBtn   = document.getElementById('logoutBtn');
var noticeBoard = document.getElementById('noticeBoard');
var topNotice   = document.getElementById('topNotice');
var adminEmail  = document.getElementById('adminEmail');
var adminRoleEl = document.getElementById('adminRole');

// Maintenance modal
var purgeModal      = document.getElementById('purgeModal');
var cancelPurgeBtn  = document.getElementById('cancelPurgeBtn');
var confirmPurgeBtn = document.getElementById('confirmPurgeBtn');

// ======================================================
// AUTH GUARD + ROLE CHECK (SECURE)
// ======================================================

// 1. Run initial sign-in logic immediately
(async () => {
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }
    } catch (err) {
        console.error("Initial sign-in failed:", err);
    }
})();


// 2. Listen for auth state change and perform role check
onAuthStateChanged(auth, async function(user) {
  if (!user) {
    // Not logged in -> go to login page
    window.location.href = "login.html";
    return;
  }

  currentUserId = user.uid;
  adminEmail.textContent = user.email || "(no email)";

  try {
        // Modular Firestore call: doc() and getDoc()
        const roleDocRef = doc(db, "roles", user.uid);
        const roleSnap = await getDoc(roleDocRef);

      if (!roleSnap.exists()) {
        console.warn("No role document for user – treating as NON-ADMIN.");
        window.location.href = "unauthorized.html";
        return;
      }

      var role = (roleSnap.data().role || "").toUpperCase();
      adminRoleEl.textContent = "Role: " + role;

      if (role !== "ADMIN") {
        // Logged in but not ADMIN → block access
        window.location.href = "unauthorized.html";
        return;
      }

      // ✅ Admin confirmed – enable panel
      attachNavHandlers();
      loadNoticeTicker();
      loadPage("overview");
    }
    catch(err) {
      console.error("Error checking admin role:", err);
      topNotice.textContent = "Error verifying admin access. Please contact Exam Branch.";
    }
});


// ---------- LOGOUT (Modular) ----------
if (logoutBtn) {
  logoutBtn.addEventListener('click', function() {
    // Modular Auth call: signOut()
    signOut(auth).then(function() {
      window.location.href = "index.html";
    }).catch(function(err) {
      console.error(err);
      topNotice.textContent = "Logout failed. Check console."; 
    });
  });
}

// ======================================================
// NAVIGATION
// ======================================================
function attachNavHandlers() {
  navLinks.forEach(function(link) {
    link.addEventListener('click', function() {
      var page = link.dataset.page;
      loadPage(page);
    });
  });
}

function loadPage(page) {
  if (!contentArea) return;
  
  // Style the active nav link
  navLinks.forEach(link => {
    link.classList.remove('bg-sky-700', 'text-white');
    link.classList.add('p-2', 'text-slate-300', 'hover:bg-slate-700', 'rounded-lg');
  });
  const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (activeLink) {
    activeLink.classList.add('bg-sky-700', 'text-white');
    activeLink.classList.remove('hover:bg-slate-700', 'text-slate-300');
  }

  pageTitle.textContent = formatTitle(page);
  contentArea.innerHTML = "<div class='text-slate-300 panel-card'>Loading " + page + "...</div>";

  try {
    switch(page) {
      case "overview": renderOverview(); break;
      case "students": renderStudentsPage(); break;
      case "faculty": renderFacultyPage(); break;
      case "subjects": renderSubjectsPage(); break;
      case "assignments": renderAssignmentsPage(); break;
      case "marks": renderMarksPage(); break;
      case "roles": renderRolesPage(); break;
      case "notices": renderNoticesPage(); break;
      case "maintenance": renderMaintenancePage(); break;
      default:
        contentArea.innerHTML = "<div class='text-red-400 panel-card'>Unknown page: " + page + "</div>";
    }
  } catch (e) {
    console.error("Error loading page", page, e);
    contentArea.innerHTML = "" +
      "<div class=\"panel-card border border-red-500/40 bg-red-900/30 text-sm text-red-100\">" +
      "Error loading <b>" + page + "</b>. Check console." +
      "</div>";
  }
}

function formatTitle(page) {
  if (!page) return "";
  var cleaned = page.toString().replace(/[-_]+/g, " ");
  return cleaned.replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

// ======================================================
// FOOTER NOTICE TICKER (Modular)
// ======================================================
function loadNoticeTicker() {
  if (!noticeBoard) return;
  noticeBoard.innerHTML = "Loading notices...";

  const now = Timestamp.now();

  // Modular Firestore call: collection(), query(), where(), limit(), getDocs()
  const noticesColRef = collection(db, "notices");
  const q = query(
        noticesColRef,
        where("active", "==", true),
        where("expiresAt", ">", now),
        limit(5)
    );

  getDocs(q)
    .then(function(snap) {
      if (snap.empty) {
        noticeBoard.textContent = "No active notices.";
        return;
      }
      // Sort client-side to adhere to no-orderBy instruction, using the requested sort logic (closest expiry first)
      const sortedDocs = snap.docs.sort((a, b) => a.data().expiresAt.toMillis() - b.data().expiresAt.toMillis());

      var html = "";
      sortedDocs.forEach(function(doc) {
        var n = doc.data();
        var text = n.title || n.message || "Notice";
        html += "<span class='mr-6 text-sky-300'>• " + text + "</span>";
      });
      noticeBoard.innerHTML = html;
    }).catch(function(err) {
      console.error("Notice ticker error", err);
      noticeBoard.textContent = "Unable to load notices.";
    });
}

// ======================================================
// CSV HELPERS (Modular Batching)
// ======================================================
function parseCsv(text) {
  var lines = text.split(/\r?\n/).filter(function(l) { return l.trim() !== ""; });
  if (lines.length < 2) return [];
  var headers = lines[0].split(",").map(function(h) { return h.trim(); });
  var records = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = lines[i].split(",");
    var obj = {};
    headers.forEach(function(h, idx) {
      obj[h] = (cols[idx] || "").trim();
    });
    records.push(obj);
  }
  return records;
}

function handleCsvUpload(opts) {
  var fileInput = opts.fileInput;
  var msgEl = opts.msgEl;
  var collectionName = opts.collection; // Renamed to avoid shadowing imported function
  var transform = opts.transform;
  var docId = opts.docId;

  var file = fileInput.files[0];
  if (!file) {
    msgEl.textContent = "Please choose a CSV file.";
    msgEl.className = "text-xs text-red-300 mt-2";
    return;
  }
  msgEl.className = "text-xs text-slate-200 mt-2";
  msgEl.textContent = "Reading file...";

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var text = e.target.result;
      var records = parseCsv(text);
      if (!records.length) {
        msgEl.textContent = "No valid rows found.";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        msgEl.textContent = "File is large; upload may take time...";
      } else {
        msgEl.textContent = "Uploading " + records.length + " rows...";
      }

      var batchSize = 300;
      var processed = 0;

      function runBatch() {
        if (processed >= records.length) {
          msgEl.textContent = "Done. Uploaded " + records.length + " rows into \"" + collectionName + "\".";
          fileInput.value = "";
          return;
        }
        // Modular Firestore call: writeBatch()
        var batch = writeBatch(db); 
        var slice = records.slice(processed, processed + batchSize);
        slice.forEach(function(r) {
          var data = transform(r);
          var id = docId(r);
          if (!id) return;
          // Modular Firestore call: doc()
          var ref = doc(db, collectionName, id);
          batch.set(ref, data, { merge: true });
        });
        batch.commit().then(function() {
          processed += slice.length;
          msgEl.textContent = "Uploaded " + processed + "/" + records.length + " rows...";
          runBatch();
        }).catch(function(err) {
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
// STUDENTS PAGE (Modular CRUD)
// ======================================================
function renderStudentsPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card mb-4\">" +
    "  <h3 class=\"font-semibold mb-2\">Add Single Student</h3>" +
    "  <form id=\"studentForm\" class=\"grid grid-cols-1 md:grid-cols-4 gap-3 text-xs\">" +
    "    <input required name=\"roll\" class=\"input\" placeholder=\"Roll (e.g., 21BD1A0501)\">" +
    "    <input required name=\"name\" class=\"input\" placeholder=\"Name\">" +
    "    <input required name=\"branch\" class=\"input\" placeholder=\"Branch (e.g., CSE)\">" +
    "    <input required name=\"semester\" class=\"input\" placeholder=\"Semester (e.g., 3)\">" +
    "    <input required name=\"section\" class=\"input\" placeholder=\"Section (e.g., A)\">" +
    "    <input name=\"phone\" class=\"input\" placeholder=\"Phone\">" +
    "    <input name=\"email\" class=\"input md:col-span-2\" placeholder=\"Email\">" +
    "    <button class=\"btn-primary mt-1 md:col-span-1\">Save Student</button>" +
    "  </form>" +
    "  <div id=\"studentFormMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>" +

    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Bulk Upload Students (CSV)</h3>" +
    "  <p class=\"text-xs text-slate-300 mb-2\">" +
    "    Headers required: <code>roll,name,branch,semester,section,phone,email</code>" +
    "  </p>" +
    "  <input id=\"studentCsv\" type=\"file\" accept=\".csv\" class=\"text-xs mb-2 text-slate-200\">" +
    "  <button id=\"uploadStudentsBtn\" class=\"btn-upload text-xs disabled:opacity-40\" disabled>Upload</button>" +
    "  <div id=\"studentCsvMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>";

  var form = document.getElementById("studentForm");
  var formMsg = document.getElementById("studentFormMsg");
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    formMsg.textContent = "Saving...";
    var data = Object.fromEntries(new FormData(form).entries());
    // Modular Firestore call: doc() and setDoc()
    setDoc(doc(db, "students", data.roll), {
      roll: data.roll,
      name: data.name,
      branch: data.branch,
      semester: data.semester,
      section: data.section,
      phone: data.phone || "",
      email: data.email || "",
      // Modular Firestore call: serverTimestamp()
      createdAt: serverTimestamp() 
    }).then(function() {
      formMsg.textContent = "Student saved.";
      form.reset();
    }).catch(function(err) {
      console.error(err);
      formMsg.textContent = "Error saving student.";
    });
  });

  var fileInput = document.getElementById("studentCsv");
  var uploadBtn = document.getElementById("uploadStudentsBtn");
  var csvMsg = document.getElementById("studentCsvMsg");

  fileInput.addEventListener("change", function() {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", function() {
    handleCsvUpload({
      fileInput: fileInput,
      msgEl: csvMsg,
      collection: "students",
      transform: function(r) {
        return {
          roll: r.roll,
          name: r.name,
          branch: r.branch,
          semester: r.semester,
          section: r.section,
          phone: r.phone || "",
          email: r.email || "",
          createdAt: serverTimestamp()
        };
      },
      docId: function(r) { return r.roll; }
    });
  });
}

// ======================================================
// FACULTY PAGE (Modular CRUD)
// ======================================================
function renderFacultyPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card mb-4\">" +
    "  <h3 class=\"font-semibold mb-2\">Add Single Faculty</h3>" +
    "  <form id=\"facultyForm\" class=\"grid grid-cols-1 md:grid-cols-4 gap-3 text-xs\">" +
    "    <input required name=\"facultyId\" class=\"input\" placeholder=\"Faculty ID (use UID or custom)\">" +
    "    <input required name=\"name\" class=\"input\" placeholder=\"Name\">" +
    "    <input required name=\"branch\" class=\"input\" placeholder=\"Branch\">" +
    "    <input name=\"phone\" class=\"input\" placeholder=\"Phone\">" +
    "    <input name=\"email\" class=\"input md:col-span-2\" placeholder=\"Email\">" +
    "    <button class=\"btn-primary mt-1 md:col-span-1\">Save Faculty</button>" +
    "  </form>" +
    "  <div id=\"facultyFormMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>" +

    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Bulk Upload Faculty (CSV)</h3>" +
    "  <p class=\"text-xs text-slate-300 mb-2\">Headers: <code>facultyId,name,branch,phone,email</code></p>" +
    "  <input id=\"facultyCsv\" type=\"file\" accept=\".csv\" class=\"text-xs mb-2 text-slate-200\">" +
    "  <button id=\"uploadFacultyBtn\" class=\"btn-upload text-xs disabled:opacity-40\" disabled>Upload</button>" +
    "  <div id=\"facultyCsvMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>";

  var form = document.getElementById("facultyForm");
  var formMsg = document.getElementById("facultyFormMsg");
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    formMsg.textContent = "Saving...";
    var data = Object.fromEntries(new FormData(form).entries());
    // Modular Firestore call: doc() and setDoc()
    setDoc(doc(db, "faculty", data.facultyId), {
      facultyId: data.facultyId,
      name: data.name,
      branch: data.branch,
      phone: data.phone || "",
      email: data.email || "",
      createdAt: serverTimestamp()
    }).then(function() {
      formMsg.textContent = "Faculty saved.";
      form.reset();
    }).catch(function(err) {
      console.error(err);
      formMsg.textContent = "Error saving faculty.";
    });
  });

  var fileInput = document.getElementById("facultyCsv");
  var uploadBtn = document.getElementById("uploadFacultyBtn");
  var csvMsg = document.getElementById("facultyCsvMsg");

  fileInput.addEventListener("change", function() {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", function() {
    handleCsvUpload({
      fileInput: fileInput,
      msgEl: csvMsg,
      collection: "faculty",
      transform: function(r) {
        return {
          facultyId: r.facultyId,
          name: r.name,
          branch: r.branch,
          phone: r.phone || "",
          email: r.email || "",
          createdAt: serverTimestamp()
        };
      },
      docId: function(r) { return r.facultyId; }
    });
  });
}

// ======================================================
// SUBJECTS PAGE (Modular CRUD)
// ======================================================
function renderSubjectsPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Bulk Upload Subjects</h3>" +
    "  <p class=\"text-xs text-slate-300 mb-2\">" +
    "    Headers: <code>subjectCode,subjectName,semester,branch,credits,subjectType</code>" +
    "  </p>" +
    "  <input id=\"subjectCsv\" type=\"file\" accept=\".csv\" class=\"text-xs mb-2 text-slate-200\">" +
    "  <button id=\"uploadSubjectsBtn\" class=\"btn-upload text-xs disabled:opacity-40\" disabled>Upload</button>" +
    "  <div id=\"subjectCsvMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>";

  var fileInput = document.getElementById("subjectCsv");
  var uploadBtn = document.getElementById("uploadSubjectsBtn");
  var csvMsg = document.getElementById("subjectCsvMsg");

  fileInput.addEventListener("change", function() {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", function() {
    handleCsvUpload({
      fileInput: fileInput,
      msgEl: csvMsg,
      collection: "subjects",
      transform: function(r) {
        return {
          subjectCode: r.subjectCode,
          subjectName: r.subjectName,
          semester: r.semester,
          branch: r.branch,
          credits: r.credits,
          subjectType: r.subjectType,
          createdAt: serverTimestamp()
        };
      },
      docId: function(r) { return r.subjectCode; }
    });
  });
}

// ======================================================
// FACULTY–SUBJECT ASSIGNMENTS PAGE (Modular CRUD)
// ======================================================
function renderAssignmentsPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Bulk Upload Faculty–Subject Assignments</h3>" +
    "  <p class=\"text-xs text-slate-300 mb-2\">" +
    "    Headers: <code>facultyId,facultyName,subjectCode,subjectName,semester,branch,section</code>" +
    "  </p>" +
    "  <input id=\"assignCsv\" type=\"file\" accept=\".csv\" class=\"text-xs mb-2 text-slate-200\">" +
    "  <button id=\"uploadAssignBtn\" class=\"btn-upload text-xs disabled:opacity-40\" disabled>Upload</button>" +
    "  <div id=\"assignCsvMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>";

  var fileInput = document.getElementById("assignCsv");
  var uploadBtn = document.getElementById("uploadAssignBtn");
  var csvMsg = document.getElementById("assignCsvMsg");

  fileInput.addEventListener("change", function() {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", function() {
    handleCsvUpload({
      fileInput: fileInput,
      msgEl: csvMsg,
      collection: "facultyAssignments",
      transform: function(r) {
        return {
          facultyId: r.facultyId,
          facultyName: r.facultyName,
          subjectCode: r.subjectCode,
          subjectName: r.subjectName,
          semester: r.semester,
          branch: r.branch,
          section: r.section,
          createdAt: serverTimestamp()
        };
      },
      docId: function(r) { return r.facultyId + "_" + r.subjectCode + "_" + r.section; }
    });
  });
}

// ======================================================
// MARKS PAGE (Modular CRUD)
// ======================================================
function renderMarksPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Bulk Upload Marks</h3>" +
    "  <p class=\"text-xs text-slate-300 mb-2\">" +
    "    Headers: <code>roll,subjectCode,subjectName,internalMarks,externalMarks,totalMarks,semester,branch,section,examType</code>" +
    "  </p>" +
    "  <input id=\"marksCsv\" type=\"file\" accept=\".csv\" class=\"text-xs mb-2 text-slate-200\">" +
    "  <button id=\"uploadMarksBtn\" class=\"btn-upload text-xs disabled:opacity-40\" disabled>Upload</button>" +
    "  <div id=\"marksCsvMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>";

  var fileInput = document.getElementById("marksCsv");
  var uploadBtn = document.getElementById("uploadMarksBtn");
  var csvMsg = document.getElementById("marksCsvMsg");

  fileInput.addEventListener("change", function() {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", function() {
    handleCsvUpload({
      fileInput: fileInput,
      msgEl: csvMsg,
      collection: "marks",
      transform: function(r) {
        return {
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
          createdAt: serverTimestamp()
        };
      },
      docId: function(r) { return r.roll + "_" + r.subjectCode + "_" + (r.examType || "REGULAR"); }
    });
  });
}

// ======================================================
// ROLES PAGE (Modular CRUD)
// ======================================================
function renderRolesPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card mb-4\">" +
    "  <h3 class=\"font-semibold mb-2\">Assign Role to User</h3>" +
    "  <form id=\"roleForm\" class=\"grid grid-cols-1 md:grid-cols-4 gap-3 text-xs\">" +
    "    <input required name=\"uid\" class=\"input\" placeholder=\"Firebase UID\">" +
    "    <input required name=\"email\" class=\"input\" placeholder=\"User Email (info only)\">" +
    "    <select required name=\"role\" class=\"input\">" +
    "      <option value=\"ADMIN\">ADMIN</option>" +
    "      <option value=\"FACULTY\">FACULTY</option>" +
    "      <option value=\"STUDENT\">STUDENT</option>" +
    "    </select>" +
    "    <button class=\"btn-primary mt-1 md:col-span-1\">Save Role</button>" +
    "  </form>" +
    "  <div id=\"roleFormMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "  <p class=\"text-[11px] text-slate-400 mt-2\">This writes into <code>roles</code> collection.</p>" +
    "</div>" +

    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Bulk Upload Roles (CSV)</h3>" +
    "  <p class=\"text-xs text-slate-300 mb-2\">Headers: <code>uid,role</code></p>" +
    "  <input id=\"rolesCsv\" type=\"file\" accept=\".csv\" class=\"text-xs mb-2 text-slate-200\">" +
    "  <button id=\"uploadRolesBtn\" class=\"btn-upload text-xs disabled:opacity-40\" disabled>Upload</button>" +
    "  <div id=\"rolesCsvMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>";

  var form = document.getElementById("roleForm");
  var formMsg = document.getElementById("roleFormMsg");
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    formMsg.textContent = "Saving role...";
    var data = Object.fromEntries(new FormData(form).entries());
    var role = (data.role || "").toUpperCase();
    // Modular Firestore call: doc() and setDoc()
    setDoc(doc(db, "roles", data.uid), {
      role: role,
      email: data.email,
      updatedAt: serverTimestamp()
    }).then(function() {
      formMsg.textContent = "Role saved.";
      form.reset();
    }).catch(function(err) {
      console.error(err);
      formMsg.textContent = "Error saving role.";
    });
  });

  var fileInput = document.getElementById("rolesCsv");
  var uploadBtn = document.getElementById("uploadRolesBtn");
  var csvMsg = document.getElementById("rolesCsvMsg");

  fileInput.addEventListener("change", function() {
    uploadBtn.disabled = !fileInput.files.length;
  });

  uploadBtn.addEventListener("click", function() {
    handleCsvUpload({
      fileInput: fileInput,
      msgEl: csvMsg,
      collection: "roles",
      transform: function(r) {
        return {
          role: (r.role || "").toUpperCase(),
          updatedAt: serverTimestamp()
        };
      },
      docId: function(r) { return r.uid; }
    });
  });
}

// ======================================================
// NOTICES PAGE (Modular CRUD)
// ======================================================
function renderNoticesPage() {
  contentArea.innerHTML = "" +
    "<div class=\"panel-card mb-4\">" +
    "  <h3 class=\"font-semibold mb-2\">Create Notice</h3>" +
    "  <form id=\"noticeForm\" class=\"grid grid-cols-1 md:grid-cols-3 gap-3 text-xs\">" +
    "    <input required name=\"title\" class=\"input md:col-span-2\" placeholder=\"Title\">" +
    "    <select name=\"active\" class=\"input\">" +
    "      <option value=\"true\">Active</option>" +
    "      <option value=\"false\">Inactive</option>" +
    "    </select>" +
    "    <textarea name=\"message\" rows=\"3\" class=\"input md:col-span-3\" placeholder=\"Full notice text (optional)\"></textarea>" +
    "    <input name=\"expiresAt\" type=\"date\" class=\"input md:col-span-1\" placeholder=\"Expiry date (YYYY-MM-DD) optional\">" +
    "    <label class=\"text-[11px] text-slate-400 md:col-span-2 flex items-center\">" +
    "      <input type=\"checkbox\" name=\"pinned\" class=\"mr-2\">Pinned / High Priority" +
    "    </label>" +
    "    <button class=\"btn-primary mt-1 md:col-span-1\">Save Notice</button>" +
    "  </form>" +
    "  <div id=\"noticeFormMsg\" class=\"text-xs mt-2 text-slate-200\"></div>" +
    "</div>" +

    "<div class=\"panel-card\">" +
    "  <h3 class=\"font-semibold mb-2\">Recent Notices</h3>" +
    "  <div id=\"noticesList\" class=\"text-xs text-slate-200\">Loading...</div>" +
    "</div>";

  var form = document.getElementById("noticeForm");
  var formMsg = document.getElementById("noticeFormMsg");
  var listEl  = document.getElementById("noticesList");

  form.addEventListener("submit", function(e) {
    e.preventDefault();
    formMsg.textContent = "Saving notice...";
    var fd = new FormData(form);
    var data = Object.fromEntries(fd.entries());

    var expiresAtTs = null;
    if (data.expiresAt) {
      var d = new Date(data.expiresAt + "T23:59:59");
      if (!isNaN(d.getTime())) {
        // Modular Firestore call: Timestamp.fromDate()
        expiresAtTs = Timestamp.fromDate(d); 
      }
    }

    // Modular Firestore call: collection() and addDoc()
    addDoc(collection(db, "notices"), { 
      title: data.title,
      message: data.message || "",
      active: data.active === "true",
      pinned: fd.get("pinned") === "on",
      createdAt: serverTimestamp(),
      expiresAt: expiresAtTs
    }).then(function() {
      formMsg.textContent = "Notice saved.";
      form.reset();
      loadNoticesList(listEl);
      loadNoticeTicker();
    }).catch(function(err) {
      console.error(err);
      formMsg.textContent = "Error saving notice.";
    });
  });

  loadNoticesList(listEl);
}

// Modular List Loading
function loadNoticesList(listEl) {
    // Modular Firestore call: collection(), query(), limit(), getDocs()
    const noticesColRef = collection(db, "notices");
    // Removing orderBy to adhere to no-orderBy instruction; sort is done client-side if needed
    const q = query(noticesColRef, limit(20));
    
    getDocs(q)
    .then(function(snap) {
      if (snap.empty) {
        listEl.textContent = "No notices yet.";
        return;
      }
      
      // Client-side sort by createdAt descending (most recent first)
      const sortedDocs = snap.docs.sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis());
      
      var html = "<ul class='space-y-1'>";
      sortedDocs.forEach(function(doc) {
        var n = doc.data();
        var active = n.active ? "ACTIVE" : "INACTIVE";
        var pinned = n.pinned ? "⭐ " : "";
        html += "<li class='border-b border-slate-700/60 py-1 flex justify-between'>" +
          "<div>" +
          "<div class='font-semibold'>" + pinned + (n.title || "(no title)") + "</div>" +
          "<div class='text-[11px] text-slate-400'>" + (n.message || "") + "</div>" +
          "</div>" +
          "<div class='text-[10px] mt-1 " + (n.active ? "text-emerald-300" : "text-slate-500") + "'>" + active + "</div>" +
          "</li>";
      });
      html += "</ul>";
      listEl.innerHTML = html;
    }).catch(function(err) {
      console.error("Notices list error", err);
      listEl.textContent = "Unable to load notices.";
    });
}

// ======================================================
// OVERVIEW PAGE (Modular Queries)
// ======================================================
function renderOverview() {
  var html = "" +
    "<div class='grid grid-cols-1 md:grid-cols-3 gap-4 mb-5'>" +
    "  <div class='panel-card'>" +
    "    <div class='text-[11px] text-slate-300'>Total Students</div>" +
    "    <div id='ovStudents' class='text-2xl font-bold mt-1'>–</div>" +
    "    <span class='text-[10px] text-emerald-400' id='ovStudUpdated'></span>" +
    "  </div>" +
    "  <div class='panel-card'>" +
    "    <div class='text-[11px] text-slate-300'>Total Faculty</div>" +
    "    <div id='ovFaculty' class='text-2xl font-bold mt-1'>–</div>" +
    "    <span class='text-[10px] text-emerald-400' id='ovFacUpdated'></span>" +
    "  </div>" +
    "  <div class='panel-card'>" +
    "    <div class='text-[11px] text-slate-300'>Subjects Offered</div>" +
    "    <div id='ovSubjects' class='text-2xl font-bold mt-1'>–</div>" +
    "    <span class='text-[10px] text-emerald-400' id='ovSubUpdated'></span>" +
    "  </div>" +
    "</div>" +

    "<div class='grid grid-cols-1 md:grid-cols-2 gap-4'>" +
    "  <div class='panel-card'>" +
    "    <div class='text-sm font-semibold mb-2'>Marks Summary</div>" +
    "    <div id='ovMarks' class='text-slate-300 text-sm'>Loading...</div>" +
    "  </div>" +
    "  <div class='panel-card'>" +
    "    <div class='text-sm font-semibold mb-2'>Latest Notices</div>" +
    "    <ul id='ovNotices' class='text-xs text-slate-300 space-y-1'></ul>" +
    "  </div>" +
    "</div>";

  contentArea.innerHTML = html;

  // Modular Firestore call: getDocs(collection(db, "collectionName"))
  Promise.all([
    getDocs(collection(db, "students")),
    getDocs(collection(db, "faculty")),
    getDocs(collection(db, "subjects")),
    getDocs(query(collection(db, "marks"), limit(5))), // using query + limit
    getDocs(query(collection(db, "notices"), limit(5)))
  ]).then(function(res) {
    var studSnap = res[0];
    var facSnap  = res[1];
    var subSnap  = res[2];
    var marksSnap = res[3];
    var noticesSnap = res[4];
    
    document.getElementById("ovStudents").textContent = studSnap.size;
    document.getElementById("ovFaculty").textContent  = facSnap.size;
    document.getElementById("ovSubjects").textContent = subSnap.size;

    var ovMarks = document.getElementById("ovMarks");
    if (marksSnap.empty) {
      ovMarks.textContent = "No marks uploaded yet.";
    } else {
      ovMarks.textContent = "Recent marks entries: " + marksSnap.size + " (showing last " + marksSnap.size + ").";
    }

    var ovNotices = document.getElementById("ovNotices");
    if (noticesSnap.empty) {
      ovNotices.innerHTML = "<li>No active notices.</li>";
    } else {
      // Client-side sort by createdAt descending (most recent first)
      const sortedDocs = noticesSnap.docs.sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis());
      
      var listHtml = "";
      sortedDocs.forEach(function(doc) {
        var n = doc.data();
        var text = n.title || n.message || "(no title)";
        listHtml += "<li>• " + text + "</li>";
      });
      ovNotices.innerHTML = listHtml;
    }
  }).catch(function(err) {
    console.error("Overview load error", err);
  });
}

// ======================================================
// SYSTEM MAINTENANCE PAGE (MANUAL PURGE - Modular)
// ======================================================
function renderMaintenancePage() {
  contentArea.innerHTML = "" +
    "<div class='panel-card mb-4'>" +
    "  <h3 class='font-semibold mb-2'>System Maintenance</h3>" +
    "  <p class='text-xs text-slate-300 mb-3'>" +
    "    Notices auto-expire logically after 30 days or when expiresAt is past." +
    "  </p>" +
    "  <div id='maintSummary' class='text-xs mb-3'>Loading summary...</div>" +
    "  <button id='purgeNowBtn' class='btn-primary mt-2'>🗑 Purge Expired Notices Now</button>" +
    "</div>" +

    "<div class='panel-card'>" +
    "  <h3 class='font-semibold mb-2'>Purge Logs</h3>" +
    "  <div id='purgeLogs' class='text-xs text-slate-300'>Loading logs...</div>" +
    "</div>";

  var purgeNowBtn = document.getElementById("purgeNowBtn");
  if (purgeNowBtn) {
    purgeNowBtn.onclick = function() {
      if (purgeModal) {
        purgeModal.classList.remove("hidden");
      }
    };
  }
  if (cancelPurgeBtn) {
    cancelPurgeBtn.onclick = function() {
      purgeModal.classList.add("hidden");
    };
  }
  if (confirmPurgeBtn) {
    confirmPurgeBtn.onclick = runManualPurge;
  }

  loadMaintenanceSummary();
  loadPurgeLogs();
}

/**
 * Completes the logic to load and display maintenance summary counts. (Modular)
 */
async function loadMaintenanceSummary() {
  var summaryEl = document.getElementById("maintSummary");
  if (!summaryEl) return;

  const now = Timestamp.now();
  // Calculate 30 days ago in milliseconds
  const ageLimit = Date.now() - 30 * 24 * 3600 * 1000;
  const ageTs = Timestamp.fromMillis(ageLimit);
  var purgeBtn = document.getElementById("purgeNowBtn");
  purgeBtn.disabled = true;
    
  const noticesColRef = collection(db, "notices");
    
  try {
        // Query 1: Notices older than 30 days (by createdAt)
        const oldNoticesQuery = query(noticesColRef, where("createdAt", "<", ageTs));
        // Query 2: Notices expired by explicit date (expiresAt)
        const expiredNoticesQuery = query(noticesColRef, where("expiresAt", "<", now));
        // Query 3: Notices currently active (for general overview)
        const activeNoticesQuery = query(noticesColRef, where("active", "==", true));

        const [oldSnap, expSnap, activeSnap] = await Promise.all([
            getDocs(oldNoticesQuery),
            getDocs(expiredNoticesQuery),
            getDocs(activeNoticesQuery)
        ]);

    // Combine both types of expired notices to determine the purge count
    var purgeCandidateCount = 0;
    var candidateIds = new Set();

    oldSnap.forEach(doc => candidateIds.add(doc.id));
    expSnap.forEach(doc => candidateIds.add(doc.id));

    purgeCandidateCount = candidateIds.size;
    
    summaryEl.innerHTML = "" +
      "<div>Expired by age (>30 days): <b>" + oldSnap.size + "</b></div>" +
      "<div>Expired by explicit date: <b>" + expSnap.size + "</b></div>" +
      "<div>Total notices to purge: <b class='text-red-400'>" + purgeCandidateCount + "</b></div>" +
      "<div>Currently active notices: <b>" + activeSnap.size + "</b></div>";
    
    if (purgeCandidateCount > 0) {
      purgeBtn.disabled = false;
      purgeBtn.textContent = `🗑 Purge Expired Notices Now (${purgeCandidateCount})`;
    } else {
      purgeBtn.textContent = `✅ No Expired Notices to Purge`;
    }

  } catch(err) {
    console.error("Summary load error", err);
    summaryEl.innerHTML = "<div class='text-red-400'>Error loading summary. Check security rules or console.</div>";
    purgeBtn.disabled = true;
  }
}

/**
 * Handles the actual batched deletion of all expired notices. (Modular)
 */
async function runManualPurge() {
  purgeModal.classList.add("hidden");
  var logEl = document.getElementById("purgeLogs");
  logEl.innerHTML = "<div class='text-yellow-400'>Starting purge process...</div>";

  const now = Timestamp.now();
  const ageLimit = Date.now() - 30 * 24 * 3600 * 1000;
  const ageTs = Timestamp.fromMillis(ageLimit);
  
  const noticesColRef = collection(db, "notices");

  try {
        // Collect all documents to delete from both expired sets (age and explicit date)
        const oldNoticesQuery = query(noticesColRef, where("createdAt", "<", ageTs));
        const expiredNoticesQuery = query(noticesColRef, where("expiresAt", "<", now));

        const [oldSnap, expSnap] = await Promise.all([
            getDocs(oldNoticesQuery),
            getDocs(expiredNoticesQuery)
        ]);

    var documentsToDelete = new Set();
    var deleteCount = 0;

    oldSnap.forEach(doc => documentsToDelete.add(doc.ref));
    expSnap.forEach(doc => documentsToDelete.add(doc.ref));

    deleteCount = documentsToDelete.size;

    if (deleteCount === 0) {
      logEl.innerHTML += "<div class='text-emerald-400'>No documents to delete. Purge complete.</div>";
      loadMaintenanceSummary();
      return;
    }

    logEl.innerHTML += `<div>Found <b class='text-red-400'>${deleteCount}</b> unique notices to delete.</div>`;

    // Start batch deletion
    var batchSize = 499; 
    var processed = 0;
    var docRefs = Array.from(documentsToDelete);

    async function executeBatch() {
      if (processed >= deleteCount) {
        logEl.innerHTML += `<div class='text-emerald-400'>✅ Purge Complete. Deleted ${deleteCount} notices.</div>`;
        loadMaintenanceSummary(); // Refresh summary after deletion
        return;
      }

      // Modular Firestore call: writeBatch()
      var currentBatch = writeBatch(db);
      var slice = docRefs.slice(processed, processed + batchSize);
      
      slice.forEach(function(ref) {
        currentBatch.delete(ref);
      });
      
      await currentBatch.commit().then(function() {
        processed += slice.length;
        logEl.innerHTML += `<div>Successfully deleted batch. Total deleted: ${processed}/${deleteCount}</div>`;
        executeBatch(); // Recurse to run next batch
      });
    }
    
    executeBatch();

  } catch(err) {
    console.error("Purge query or batch error:", err);
    logEl.innerHTML = `<div class='text-red-400'>❌ Error during purge. Check console.</div>`;
  }
}

/**
 * Placeholder for loading purge logs (since actual logs would be in Firebase Functions/Cloud).
 */
function loadPurgeLogs() {
  var logEl = document.getElementById("purgeLogs");
  if (!logEl) return;

  logEl.innerHTML = "<div class='text-slate-400'>Purge logs are typically stored server-side. Showing runtime status only.</div>";
}
