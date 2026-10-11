import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database"; 
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDxT38ZjM8UhHlJbxhSTTj3DYB87qcYtlc",
  // EVERYTHING MUST SAY "campsync-v2" NOT CampusPro!
  authDomain: "campsync-v2.firebaseapp.com",
  databaseURL: "https://campsync-v2-default-rtdb.asia-southeast1.firebasedatabase.app", 
  projectId: "campsync-v2",
  storageBucket: "campsync-v2.appspot.com",
  messagingSenderId: "770910197301",
  appId: "1:770910197301:web:1f6e939c3d389d030a437c",
  measurementId: "G-K9G8GDYQ17"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app); 
export const storage = getStorage(app);