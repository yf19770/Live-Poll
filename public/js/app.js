// Import functions from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, collection, getDoc, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot, FieldValue, increment, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ======================================================
// PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE
// Find this in your Firebase project settings
const firebaseConfig = {
  apiKey: "AIzaSyCuQ0M778FK3m1724JUyjZjn0pNFuoA8Ug",
  authDomain: "voting-osfy.firebaseapp.com",
  projectId: "voting-osfy",
  storageBucket: "voting-osfy.firebasestorage.app",
  messagingSenderId: "688805860238",
  appId: "1:688805860238:web:4059fb83cbf584c3f2cadf",
  measurementId: "G-D8RMZSG1ZR"
};
// ======================================================


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Export firebase services and functions for use in other scripts
export { 
    db, 
    auth, 
    doc, 
    collection, 
    getDoc,
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot,
    increment,
    // THE FIX IS HERE: ADDING writeBatch to the export list
    writeBatch, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
};