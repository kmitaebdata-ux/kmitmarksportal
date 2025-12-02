// ADMIN.JS
console.log("Admin panel JS loaded");

// Navigation handling
const navLinks = document.querySelectorAll('.nav-link');
const contentArea = document.getElementById('contentArea');
const pageTitle = document.getElementById('pageTitle');

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    const page = link.dataset.page;
    loadPage(page);
  });
});

function loadPage(page) {
  pageTitle.textContent = page.replace(/\b\w/g, c => c.toUpperCase());
  contentArea.textContent = `Loaded: ${page}`;
}

// Logout
const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.addEventListener('click', () => {
  alert('Logged out');
});

// Fetch Notices (demo)
const noticeBoard = document.getElementById('noticeBoard');
noticeBoard.innerHTML = "<p>Loading notices...</p>";

setTimeout(() => {
  noticeBoard.innerHTML = `
    <ul>
      <li class='text-red-600 font-bold'>* Exam registration started</li>
      <li class='text-blue-600'>* Lab marks submission enabled</li>
      <li class='text-green-700'>* Holiday on Monday</li>
    </ul>`;
}, 1200);
