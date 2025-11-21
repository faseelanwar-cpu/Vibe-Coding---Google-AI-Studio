import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDcr9-xdleWQADdE4kClx4yOav1aR-mtaA",
    authDomain: "interview-coach-pro-v1.firebaseapp.com",
    projectId: "interview-coach-pro-v1",
    storageBucket: "interview-coach-pro-v1.firebasestorage.app",
    messagingSenderId: "204595160059",
    appId: "1:204595160059:web:e57631c0e8502575c0a15e",
    measurementId: "G-5MVPN6F6QH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };