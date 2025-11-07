// FIX: Import Firebase v9 compat library to align with updated initialization.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from '../firebaseConfig';

const APPROVED_EMAILS_KEY = 'interview_coach_pro_approved_emails';
const FIRESTORE_COLLECTION = 'approved_users';

const getLocalEmails = (): string[] => {
    try {
        const localData = localStorage.getItem(APPROVED_EMAILS_KEY);
        return localData ? JSON.parse(localData) : [];
    } catch (error) {
        console.error("Failed to parse emails from localStorage:", error);
        return [];
    }
};

const saveLocalEmails = (emails: string[]) => {
    try {
        // Exclude the hardcoded test email from being saved
        const emailsToSave = emails.filter(email => email !== "test@procoach.ai");
        localStorage.setItem(APPROVED_EMAILS_KEY, JSON.stringify(emailsToSave));
    } catch (error) {
        console.error("Failed to save emails to localStorage:", error);
    }
};


export const loadApprovedEmails = async (): Promise<string[]> => {
    const emailSet = new Set<string>(getLocalEmails());
    emailSet.add("test@procoach.ai"); // Hardcoded test email

    if (db) {
        try {
            // FIX: Use v9 compat syntax for collection and getDocs
            const usersCollection = db.collection(FIRESTORE_COLLECTION);
            const snapshot = await usersCollection.get();
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.email && typeof data.email === 'string') {
                    emailSet.add(data.email.toLowerCase());
                }
            });
            // Sync local storage with the combined list
            saveLocalEmails(Array.from(emailSet));
        } catch (error) {
            console.warn("Could not sync with Firestore. Using local data.", error);
        }
    }

    return Array.from(emailSet);
};

export const addApprovedEmail = async (email: string): Promise<{ success: boolean; finalEmails: string[] }> => {
    const currentEmails = await loadApprovedEmails();
    const emailSet = new Set(currentEmails);
    emailSet.add(email.toLowerCase());
    const finalEmails = Array.from(emailSet);

    saveLocalEmails(finalEmails);

    if (db) {
        try {
            // FIX: Use v9 compat syntax for collection, addDoc, and serverTimestamp
            const usersCollection = db.collection(FIRESTORE_COLLECTION);
            await usersCollection.add({
                email: email.toLowerCase(),
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.warn("Could not add email to Firestore. Local copy was saved.", error);
            return { success: false, finalEmails }; // Indicate sync failed
        }
    }
    
    return { success: true, finalEmails };
};


export const removeApprovedEmail = async (emailToRemove: string): Promise<{ success: boolean; finalEmails: string[] }> => {
    const currentEmails = await loadApprovedEmails();
    const finalEmails = currentEmails.filter(e => e !== emailToRemove);

    saveLocalEmails(finalEmails);

    if (db) {
        try {
            // FIX: Use v9 compat syntax for query, batch, and delete
            const usersCollection = db.collection(FIRESTORE_COLLECTION);
            const q = usersCollection.where('email', '==', emailToRemove);
            const querySnapshot = await q.get();
            
            const batch = db.batch();
            querySnapshot.forEach(docSnapshot => {
                batch.delete(docSnapshot.ref);
            });
            await batch.commit();
        } catch (error) {
            console.warn("Could not remove email from Firestore. Local copy was updated.", error);
            return { success: false, finalEmails }; // Indicate sync failed
        }
    }

    return { success: true, finalEmails };
};