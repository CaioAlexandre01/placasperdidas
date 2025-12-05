import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics"; // 👈 novo

const firebaseConfig = {
  apiKey: "AIzaSyDJjBHQ6AYuXzh7-YgHETSbJNob9BtwUrU",
  authDomain: "placasperdidas-f0bcd.firebaseapp.com",
  projectId: "placasperdidas-f0bcd",
  storageBucket: "placasperdidas-f0bcd.appspot.com",
  messagingSenderId: "549628365180",
  appId: "1:549628365180:web:b9cefba73047720707fcf9",
  measurementId: "G-3N1SS73L41",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const analytics = getAnalytics(app); // 👈 novo

export { app, db, rtdb, analytics };
