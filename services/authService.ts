import { auth } from '../firebaseConfig';
import firebase from 'firebase/compat/app';
import { UserProfile } from '../types';
import * as userService from './userService';

// Local storage key to remember the user's email "session"
const STORAGE_KEY_EMAIL = 'icp_user_email';

let authStateListeners: ((user: UserProfile | null) => void)[] = [];

// Helper to map Firebase Auth error codes to friendly messages
const getAuthErrorMessage = (error: any): string => {
    if (!error) return "An unknown error occurred.";
    const code = error.code;
    const msg = error.message;

    switch (code) {
        case 'auth/network-request-failed':
            return "Unable to connect. Please check your internet connection.";
        case 'auth/operation-not-allowed':
            return "Sign-in is currently disabled. Please check the Firebase Console.";
        case 'auth/too-many-requests':
            return "Too many login attempts. Please wait a few minutes and try again.";
        case 'auth/user-disabled':
            return "This account has been disabled by an administrator.";
        case 'auth/invalid-email':
            return "The email address provided is invalid.";
        case 'auth/internal-error':
            return "A temporary system error occurred. Please try again.";
        case 'auth/app-not-authorized':
            return "This domain is not authorized to run the app. Check Firebase Console > Authentication > Settings > Authorized Domains.";
        case 'auth/unauthorized-domain':
            return `Domain unauthorized (${window.location.hostname}). Add to Firebase Console > Authentication > Settings > Authorized Domains.`;
        case 'auth/popup-closed-by-user':
            return "Sign-in was cancelled.";
        case 'auth/popup-blocked':
            return "Sign-in popup was blocked by your browser. Please allow popups for this site.";
        case 'auth/quota-exceeded':
            return "Service quota exceeded. Please try again later.";
        case 'auth/api-key-not-valid':
            return "Firebase API Key is invalid. Please check your configuration.";
        default:
            if (msg && msg.includes("permission-denied")) {
                return "Access Denied: Database permissions are blocking this request.";
            }
            return msg || "Authentication failed. Please try again.";
    }
};

export const signInWithEmail = async (email: string): Promise<{ user: UserProfile | null; error?: string }> => {
  if (!auth) {
      return { user: null, error: "System Configuration Error: Firebase Auth is not initialized." };
  }

  if (!navigator.onLine) {
      return { user: null, error: "You are offline. Please check your internet connection." };
  }

  try {
    if (!auth.currentUser) {
        try {
            await auth.signInAnonymously();
        } catch (anonError: any) {
             console.error("Anonymous Auth Init Failed:", anonError);
             return { user: null, error: `Connection failed: ${getAuthErrorMessage(anonError)}` };
        }
    }

    const profile = await userService.getUserProfile(email);
    
    if (!profile) {
        return { user: null, error: "Access Denied: This email is not on the approved access list." };
    }

    localStorage.setItem(STORAGE_KEY_EMAIL, email);
    const userProfile = { ...profile, uid: email };
    notifyListeners(userProfile);
    return { user: userProfile };

  } catch (error: any) {
    console.error("Sign in error:", error);
    return { user: null, error: getAuthErrorMessage(error) };
  }
};

export const signInWithGoogle = async (): Promise<{ user: UserProfile | null; error?: string }> => {
    if (!auth) {
        return { user: null, error: "System Error: Auth not initialized" };
    }
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        if (!user || !user.email) {
            return { user: null, error: "Could not identify user email." };
        }

        const profile = await userService.getUserProfile(user.email);
        
        if (!profile) {
            await auth.signOut();
            return { user: null, error: "Access Denied: Your Google account is not on the approved access list." };
        }

        localStorage.setItem(STORAGE_KEY_EMAIL, user.email);
        const userProfile = { ...profile, uid: user.email };
        notifyListeners(userProfile);

        return { user: userProfile };

    } catch (error: any) {
        console.error("Google Sign In Error:", error);
        return { user: null, error: getAuthErrorMessage(error) };
    }
};

export const signOut = async () => {
  if (auth) {
    try {
        await auth.signOut();
    } catch (e) {
        console.warn("Error signing out of Firebase:", e);
    }
  }
  localStorage.removeItem(STORAGE_KEY_EMAIL);
  notifyListeners(null);
};

const notifyListeners = (user: UserProfile | null) => {
    authStateListeners.forEach(listener => listener(user));
};

export const subscribeToAuthChanges = (callback: (user: UserProfile | null) => void) => {
    authStateListeners.push(callback);

    const storedEmail = localStorage.getItem(STORAGE_KEY_EMAIL);

    if (storedEmail && auth) {
        auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                const profile = await userService.getUserProfile(storedEmail);
                if (profile) {
                    callback({ ...profile, uid: storedEmail });
                } else {
                    localStorage.removeItem(STORAGE_KEY_EMAIL);
                    callback(null);
                }
            } else {
                if (localStorage.getItem(STORAGE_KEY_EMAIL)) {
                     auth.signInAnonymously().catch(() => callback(null));
                } else {
                    callback(null);
                }
            }
        });
    } else {
        callback(null);
    }
    
    return () => {
        authStateListeners = authStateListeners.filter(l => l !== callback);
    };
};