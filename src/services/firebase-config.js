// src/services/firebase-config.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDJjBHQ6AYuXzh7-YgHETSbJNob9BtwUrU",
  authDomain: "placasperdidas-f0bcd.firebaseapp.com",
  projectId: "placasperdidas-f0bcd",
  storageBucket: "placasperdidas-f0bcd.appspot.com", // ✅ corrigido aqui
  messagingSenderId: "549628365180",
  appId: "1:549628365180:web:b9cefba73047720707fcf9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);

export { app, db, rtdb };
