
import { db, auth } from '../firebaseConfig';
import firebase from 'firebase/compat/app';
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

// Re-export helper for authService usage (simplified local version if needed)
function getAuthErrorMessage(error: any): string {
    return error.message;
}

export const loadApprovedEmails = async (): Promise<string[]> => {
    if (!db) return [];

    try {
        const snapshot = await db.collection(FIRESTORE_COLLECTION).get();
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return data.email || doc.id;
        });
    } catch (error) {
        console.error("Error loading emails from Firestore:", error);
        return [];
    }
};

export const getUserProfile = async (email: string): Promise<UserProfile | null> => {
    if (!db) return null;
    
    try {
        const cleanEmail = email.toLowerCase().trim();
        console.log(`Looking up user: '${cleanEmail}'`);

        // Strategy 1: Query by 'email' field
        const snapshot = await db.collection(FIRESTORE_COLLECTION).where('email', '==', cleanEmail).get();
        
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            return {
                email: data.email,
                isAdmin: !!data.isAdmin,
                createdAt: data.created_at,
                hasCompletedOnboarding: !!data.hasCompletedOnboarding
            };
        }

        // Strategy 2: Check if the Document ID is the email
        const docRef = db.collection(FIRESTORE_COLLECTION).doc(cleanEmail);
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
             const data = docSnap.data();
             if (data) {
                 return {
                    email: cleanEmail,
                    isAdmin: !!data.isAdmin,
                    createdAt: data.created_at,
                    hasCompletedOnboarding: !!data.hasCompletedOnboarding
                 };
             }
        }

        return null;
    } catch (error: any) {
        console.error("Error checking user profile:", getFirestoreErrorMessage(error));
        return null;
    }
};

export const completeOnboarding = async (email: string): Promise<boolean> => {
    if (!db) return false;
    const cleanEmail = email.toLowerCase().trim();

    try {
        // Find document reference first (similar strategies as getUserProfile)
        let docRef: firebase.firestore.DocumentReference | null = null;
        
        const snapshot = await db.collection(FIRESTORE_COLLECTION).where('email', '==', cleanEmail).get();
        if (!snapshot.empty) {
            docRef = snapshot.docs[0].ref;
        } else {
            const idRef = db.collection(FIRESTORE_COLLECTION).doc(cleanEmail);
            const docSnap = await idRef.get();
            if (docSnap.exists) docRef = idRef;
        }

        if (docRef) {
            await docRef.update({ hasCompletedOnboarding: true });
            return true;
        }
        return false;
    } catch (error) {
        console.error("Failed to update onboarding status", error);
        return false;
    }
};

export const addApprovedEmail = async (email: string): Promise<{ success: boolean; finalEmails: string[]; error?: string }> => {
    if (!db) return { success: false, finalEmails: [], error: "Database not initialized" };
    
    try {
        const cleanEmail = email.toLowerCase().trim();
        await db.collection(FIRESTORE_COLLECTION).add({
            email: cleanEmail,
            isAdmin: false,
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
            hasCompletedOnboarding: false
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
        const snapshot = await db.collection(FIRESTORE_COLLECTION).where('email', '==', cleanEmail).get();
        const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
        
        // 2. Try finding by ID
        const docRef = db.collection(FIRESTORE_COLLECTION).doc(cleanEmail);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            deletePromises.push(docRef.delete());
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
        if (!auth.currentUser) {
            try {
                await auth.signInAnonymously();
            } catch (authError: any) {
                console.error("Anonymous Auth Failed:", authError);
                return { isValid: false, error: `Auth Error: ${authError.message}` };
            }
        }

        const docRef = db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID);
        let docSnap;
        
        try {
            docSnap = await docRef.get();
        } catch (dbError: any) {
            console.error("Firestore Read Failed:", dbError);
            
            if (dbError.code === 'permission-denied') {
                return { isValid: false, error: "Access Denied: Application cannot read admin settings. Check Firestore Rules." };
            }
            
            return { isValid: false, error: `Connection Error: ${getFirestoreErrorMessage(dbError)}` };
        }

        if (docSnap.exists) {
            const data = docSnap.data();
            if (!data) return { isValid: false, error: "Invalid data" };

            const storedPin = String(data.pin).replace(/['"]/g, '').trim();
            const cleanInput = inputPin.trim();

            console.log(`Verifying PIN. Stored (cleaned): '${storedPin}', Input: '${cleanInput}'`);
            
            if (storedPin === cleanInput) {
                return { isValid: true };
            } else {
                return { isValid: false, error: "Incorrect PIN." };
            }
        } else {
            return { isValid: false, error: "Security Configuration missing. Please create 'system_config/admin_settings' in database." };
        }
    } catch (error: any) {
        console.error("Unexpected error verifying admin PIN:", error);
        return { isValid: false, error: error.message || "Unknown verification error" };
    }
};