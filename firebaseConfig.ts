// FIX: Use Firebase v9 compat library to resolve module import errors.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// Your web app's Firebase configuration from the script you provided
const firebaseConfig = {
    apiKey: "AIzaSyDcr9-xdleWQADdE4kClx4yOav1aR-mtaA",
    authDomain: "interview-coach-pro-v1.firebaseapp.com",
    projectId: "interview-coach-pro-v1",
    storageBucket: "interview-coach-pro-v1.firebasestorage.app",
    messagingSenderId: "204595160059",
    appId: "1:204595160059:web:e57631c0e8502575c0a15e",
    measurementId: "G-5MVPN6F6QH"
};


let db: firebase.firestore.Firestore | undefined;

try {
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  // Get a reference to the Firestore service
  db = firebase.firestore();
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export { db };
