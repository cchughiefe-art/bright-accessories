import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBS-6-QNtNvS6AwPIn4zorzEhqSeDZSZiQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "bright-accessories.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "bright-accessories",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "bright-accessories.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "365521981842",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:365521981842:web:89d9b0e17282f18b21b14b",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
