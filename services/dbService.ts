
import { db } from '../firebaseConfig';
import firebase from 'firebase/compat/app';
import { InterviewReport, CVAnalysisResult, HistoryItem, CandidateProfile } from '../types';

const INTERVIEWS_COLLECTION = 'interviews';
const CV_ANALYSES_COLLECTION = 'cv_analyses';
const PROFILES_COLLECTION = 'user_profiles'; // New collection for structured profiles
const GENERATED_CVS_COLLECTION = 'generated_cvs';

// --- Profile Management ---

export const saveCandidateProfile = async (userEmail: string, profile: CandidateProfile) => {
    if (!db) return;
    const cleanEmail = userEmail.toLowerCase();
    try {
        // We store the profile in a document keyed by the user's email (or UID if we had strict UIDs everywhere)
        // Using email as ID for simplicity in this architecture, ensuring 1 profile per user.
        await db.collection(PROFILES_COLLECTION).doc(cleanEmail).set({
            ...profile,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error: any) {
        console.error("Failed to save profile:", error);
        if (error.code === 'permission-denied') {
             console.error(`
🚨 FIRESTORE PERMISSION ERROR 🚨
To save User Profiles, please add this rule to your Firebase Console > Firestore Database > Rules:

match /user_profiles/{document} {
  allow read, write: if request.auth != null;
}
`);
            throw new Error("Permission Denied: Check console for Firestore Rules instructions.");
        }
        throw error;
    }
};

export const getCandidateProfile = async (userEmail: string): Promise<CandidateProfile | null> => {
    if (!db) return null;
    const cleanEmail = userEmail.toLowerCase();
    try {
        const doc = await db.collection(PROFILES_COLLECTION).doc(cleanEmail).get();
        if (doc.exists) {
            const data = doc.data() as CandidateProfile;
            return data;
        }
        return null;
    } catch (error: any) {
        console.error("Failed to get profile:", error);
        if (error.code === 'permission-denied') {
            console.error("ACTION REQUIRED: Update Firestore Rules to allow read/write on 'user_profiles'.");
        }
        return null;
    }
};

// --- History & Reports ---

export const saveInterviewReport = async (userEmail: string, report: InterviewReport) => {
    if (!db) return;

    try {
        await db.collection(INTERVIEWS_COLLECTION).add({
            userEmail: userEmail.toLowerCase(),
            report,
            company: report.summary.companyDetected || 'Unknown Company',
            role: report.summary.roleDetected || 'Unknown Role',
            score: report.summary.overallScore,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to save interview report to Firestore:", error);
        throw error;
    }
};

export const saveCVAnalysis = async (userEmail: string, analysis: CVAnalysisResult, jobDescriptionSnippet: string) => {
    if (!db) return;

    try {
        await db.collection(CV_ANALYSES_COLLECTION).add({
            userEmail: userEmail.toLowerCase(),
            analysis,
            matchScore: analysis.match_score,
            jobSnippet: jobDescriptionSnippet.substring(0, 100) + '...',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to save CV analysis to Firestore:", error);
        throw error;
    }
};

export const saveGeneratedCV = async (userEmail: string, base64Pdf: string) => {
    if (!db) return;
    try {
        await db.collection(GENERATED_CVS_COLLECTION).add({
            userEmail: userEmail.toLowerCase(),
            fileData: base64Pdf, // Storing base64 directly in firestore (limit 1MB).
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error: any) {
        // Handle permission errors gracefully so the user doesn't see a "crash", but log the fix.
        if (error.code === 'permission-denied') {
            console.error(`
🚨 FIRESTORE PERMISSION ERROR 🚨
To save generated PDFs to the cloud history, please add this rule to your Firebase Console > Firestore Database > Rules:

match /generated_cvs/{document} {
  allow read, write: if request.auth != null;
}
`);
            console.warn("Cloud Save Skipped due to permissions. PDF is available for local download.");
            return;
        } 
        
        if (error.code === 'invalid-argument' && error.message && error.message.includes("exceeds the maximum allowed size")) {
             console.warn("Cloud Save Skipped: PDF exceeds 1MB Firestore limit. Available for local download only.");
             return;
        }
        
        console.error("Failed to save generated CV to cloud:", error);
        return;
    }
};

export const getUserHistory = async (userEmail: string): Promise<HistoryItem[]> => {
    if (!db) return [];
    
    const history: HistoryItem[] = [];

    try {
        // 1. Fetch Interviews by Email
        const interviewsSnap = await db.collection(INTERVIEWS_COLLECTION)
            .where('userEmail', '==', userEmail.toLowerCase())
            .get();

        interviewsSnap.forEach(doc => {
            const data = doc.data();
            if (data.report) {
                history.push({
                    id: doc.id,
                    type: 'interview',
                    date: data.timestamp ? data.timestamp.toDate() : new Date(),
                    title: `Interview: ${data.role}`,
                    subtitle: `at ${data.company}`,
                    score: data.score,
                    data: data.report as InterviewReport
                });
            }
        });

        // 2. Fetch CV Analyses by Email
        const cvSnap = await db.collection(CV_ANALYSES_COLLECTION)
            .where('userEmail', '==', userEmail.toLowerCase())
            .get();

        cvSnap.forEach(doc => {
            const data = doc.data();
            if (data.analysis) {
                history.push({
                    id: doc.id,
                    type: 'cv_analysis',
                    date: data.timestamp ? data.timestamp.toDate() : new Date(),
                    title: `CV Analysis`,
                    subtitle: `Match Score: ${data.matchScore}/100`,
                    score: data.matchScore,
                    data: data.analysis as CVAnalysisResult
                });
            }
        });
        
        // Perform sorting in memory (Newest first)
        return history.sort((a, b) => b.date.getTime() - a.date.getTime());

    } catch (error) {
        console.error("Error fetching history from Firestore:", error);
        return [];
    }
};

export const deleteHistoryItem = async (id: string, type: 'interview' | 'cv_analysis') => {
    if (!db) return;
    const collection = type === 'interview' ? INTERVIEWS_COLLECTION : CV_ANALYSES_COLLECTION;
    try {
        await db.collection(collection).doc(id).delete();
    } catch (error) {
        console.error(`Failed to delete ${type} ${id}:`, error);
        throw error;
    }
};

export const deleteAllUserHistory = async (userEmail: string) => {
    if (!db) return;
    const cleanEmail = userEmail.toLowerCase();

    try {
        // 1. Find all interview docs
        const interviewsSnap = await db.collection(INTERVIEWS_COLLECTION)
            .where('userEmail', '==', cleanEmail)
            .get();
        
        // 2. Find all CV docs
        const cvSnap = await db.collection(CV_ANALYSES_COLLECTION)
            .where('userEmail', '==', cleanEmail)
            .get();

        // 3. Delete all (Batching is better for large sets, using Promise.all for simplicity here)
        const deletePromises: Promise<void>[] = [];
        
        interviewsSnap.forEach(doc => deletePromises.push(doc.ref.delete()));
        cvSnap.forEach(doc => deletePromises.push(doc.ref.delete()));

        await Promise.all(deletePromises);
        
    } catch (error) {
        console.error("Failed to delete all history:", error);
        throw error;
    }
};
