import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';

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

// Initialize Firebase (check for existing apps to prevent re-initialization errors)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

export { db, auth };
export default firebase;