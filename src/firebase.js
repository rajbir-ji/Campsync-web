import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDxT38ZjM8UhHlJbxhSTTj3DYB87qcYtlc",
  authDomain: "CampusPro-v2.firebaseapp.com",
  // FIX: This must exactly match the URL in the Firebase Console (all lowercase)
  databaseURL: "https://campsync-v2-default-rtdb.asia-southeast1.firebasedatabase.app", 
  projectId: "CampusPro-v2",
  storageBucket: "CampusPro-v2.firebasestorage.app",
  messagingSenderId: "770910197301",
  appId: "1:770910197301:web:1f6e939c3d389d030a437c",
  measurementId: "G-K9G8GDYQ17"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);