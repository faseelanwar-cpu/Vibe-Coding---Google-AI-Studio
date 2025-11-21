import { db, auth } from '../firebaseConfig';
import { collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { UserProfile } from '../types';

const FIRESTORE_COLLECTION = 'approved_users';
const CONFIG_COLLECTION = 'system_config';
const CONFIG_DOC_ID = 'admin_settings';

// Helper to map Firestore error codes to friendly messages
const getFirestoreErrorMessage = (error: any): string => {
    if (!error) return "An unknown database error occurred.";
    const code = error.code;
    const msg = error.message;

    switch (code) {
        case 'permission-denied':
            return "Permission denied. You are not authorized to access this data. Please check your Admin permissions.";
        case 'unavailable':
            return "Service unavailable. You appear to be offline or the database is unreachable.";
        case 'not-found':
            return "The requested record could not be found.";
        case 'already-exists':
            return "This record already exists in the database.";
        case 'resource-exhausted':
            return "Database quota exceeded. Please try again later.";
        case 'deadline-exceeded':
            return "The operation timed out. Please check your internet connection.";
        case 'failed-precondition':
            // This often happens with missing indexes or offline queries requiring cache
            if (msg && msg.includes("index")) {
                return "System Error: A required database index is missing. Please contact support.";
            }
            return "Operation failed. Please ensure you are online.";
        case 'aborted':
            return "The operation was aborted. Please try again.";
        case 'unauthenticated':
            return "You are not currently signed in. Please refresh the page.";
        default:
            if (msg && msg.toLowerCase().includes("offline")) {
                return "You appear to be offline. Please check your connection.";
            }
            return msg || "A database error occurred.";
    }
};

export const loadApprovedEmails = async (): Promise<string[]> => {
    if (!db) return [];

    try {
        const q = collection(db, FIRESTORE_COLLECTION);
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            // Handle case where doc ID might be the email, or the email field exists
            return data.email || doc.id;
        });
    } catch (error) {
        console.error("Error loading emails from Firestore:", error);
        // We return empty array here to not crash the UI, but log the specific error
        return [];
    }
};

export const getUserProfile = async (email: string): Promise<UserProfile | null> => {
    if (!db) return null;
    
    try {
        const cleanEmail = email.toLowerCase().trim();
        console.log(`Looking up user: '${cleanEmail}'`);

        // Strategy 1: Query by 'email' field (Standard way)
        const q = query(collection(db, FIRESTORE_COLLECTION), where('email', '==', cleanEmail));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            return {
                email: data.email,
                isAdmin: !!data.isAdmin,
                createdAt: data.created_at
            };
        }

        // Strategy 2: Check if the Document ID is the email (Common manual entry way)
        const docRef = doc(db, FIRESTORE_COLLECTION, cleanEmail);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
             const data = docSnap.data();
             return {
                email: cleanEmail,
                isAdmin: !!data.isAdmin,
                createdAt: data.created_at
             };
        }

        return null;
    } catch (error: any) {
        console.error("Error checking user profile:", getFirestoreErrorMessage(error));
        // If it's a permission error, it means the user definitely isn't allowed
        return null;
    }
};

export const addApprovedEmail = async (email: string): Promise<{ success: boolean; finalEmails: string[]; error?: string }> => {
    if (!db) return { success: false, finalEmails: [], error: "Database not initialized" };
    
    try {
        const cleanEmail = email.toLowerCase().trim();
        // Add as a field
        await addDoc(collection(db, FIRESTORE_COLLECTION), {
            email: cleanEmail,
            isAdmin: false,
            created_at: serverTimestamp()
        });
        const finalEmails = await loadApprovedEmails();
        return { success: true, finalEmails };
    } catch (error: any) {
        console.error("Error adding user to Firestore:", error);
        return { success: false, finalEmails: [], error: getFirestoreErrorMessage(error) };
    }
};

export const removeApprovedEmail = async (emailToRemove: string): Promise<{ success: boolean; finalEmails: string[]; error?: string }> => {
    if (!db) return { success: false, finalEmails: [], error: "Database not initialized" };

    try {
        const cleanEmail = emailToRemove.toLowerCase().trim();
        
        // 1. Try finding by field
        const q = query(collection(db, FIRESTORE_COLLECTION), where('email', '==', cleanEmail));
        const snapshot = await getDocs(q);
        
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        
        // 2. Try finding by ID
        const docRef = doc(db, FIRESTORE_COLLECTION, cleanEmail);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            deletePromises.push(deleteDoc(docRef));
        }

        await Promise.all(deletePromises);
        
        const finalEmails = await loadApprovedEmails();
        return { success: true, finalEmails };
    } catch (error: any) {
        console.error("Error removing user from Firestore:", error);
        return { success: false, finalEmails: [], error: getFirestoreErrorMessage(error) };
    }
};

export const validateAdminPin = async (inputPin: string): Promise<{ isValid: boolean; error?: string }> => {
    if (!db || !auth) return { isValid: false, error: "Database not initialized" };

    try {
        // Ensure we have at least an anonymous connection to read the DB config
        if (!auth.currentUser) {
            try {
                await signInAnonymously(auth);
            } catch (authError: any) {
                console.error("Anonymous Auth Failed:", authError);
                return { isValid: false, error: `Auth Error: ${getAuthErrorMessage(authError)}` };
            }
        }

        const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
        let docSnap;
        
        try {
            docSnap = await getDoc(docRef);
        } catch (dbError: any) {
            console.error("Firestore Read Failed:", dbError);
            
            if (dbError.code === 'permission-denied') {
                return { isValid: false, error: "Access Denied: Application cannot read admin settings. Check Firestore Rules." };
            }
            
            return { isValid: false, error: `Connection Error: ${getFirestoreErrorMessage(dbError)}` };
        }

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Robust Cleaning:
            // 1. Convert to string (handles Numbers)
            // 2. Remove accidental quotes (handles '"123456"')
            // 3. Trim whitespace (handles '123456 ')
            const storedPin = String(data.pin).replace(/['"]/g, '').trim();
            const cleanInput = inputPin.trim();

            console.log(`Verifying PIN. Stored (cleaned): '${storedPin}', Input: '${cleanInput}'`);
            
            if (storedPin === cleanInput) {
                return { isValid: true };
            } else {
                return { isValid: false, error: "Incorrect PIN." };
            }
        } else {
            // SECURITY: If config is missing, deny access.
            return { isValid: false, error: "Security Configuration missing. Please create 'system_config/admin_settings' in database." };
        }
    } catch (error: any) {
        console.error("Unexpected error verifying admin PIN:", error);
        return { isValid: false, error: error.message || "Unknown verification error" };
    }
};

// Re-export helper for authService usage
function getAuthErrorMessage(error: any): string {
    // Simple local duplicate or import from authService if circular dependency wasn't an issue.
    // For simplicity, we inline basic auth error mapping or use generic fallback
    return error.message;
}