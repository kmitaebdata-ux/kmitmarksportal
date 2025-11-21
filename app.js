// ----------------------
// Firebase Imports
// ----------------------
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// ----------------------
// Firebase Configuration
// ----------------------
const firebaseConfig = {
  apiKey: "AIzaSyC1Aa_mnq_0g7ZEuLbYVjN62iCMWemlKUc",
  authDomain: "kmit-marks-portal-9db76.firebaseapp.com",
  projectId: "kmit-marks-portal-9db76",
  storageBucket: "kmit-marks-portal-9db76.firebasestorage.app",
  messagingSenderId: "264909025742",
  appId: "1:264909025742:web:84de5216860219e6bc3b9f",
  measurementId: "G-JMZ564P8PJ"
};

// ----------------------
// Initialize Firebase
// ----------------------
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// ----------------------
// Initialize Firestore & Auth
// ----------------------
const db = getFirestore(app);
const auth = getAuth(app);

signInAnonymously(auth)
  .then(() => console.log("Signed in anonymously"))
  .catch((error) => console.error("Auth error:", error));

// ----------------------
// Function to Create / Set Course
// ----------------------
async function createCourse(courseId, courseName) {
  try {
    await setDoc(doc(collection(db, "courses"), courseId), {
      name: courseName,
      createdAt: new Date(),
    });
    console.log(`Course created with ID: ${courseId}`);
  } catch (error) {
    console.error("Error creating course:", error);
  }
}

// ----------------------
// Function to Save Roster
// ----------------------
async function saveRoster(courseId, roster) {
  try {
    await setDoc(doc(collection(db, "rosters"), courseId), {
      students: roster,
      updatedAt: new Date(),
    });
    console.log(`Roster saved for course: ${courseId}`);
  } catch (error) {
    console.error("Error saving roster:", error);
  }
}

// ----------------------
// Example Usage
// ----------------------
createCourse("CS101", "Introduction to Computer Science");

const roster = [
  { name: "Alice", marks: 85 },
  { name: "Bob", marks: 90 },
];

saveRoster("CS101", roster);
