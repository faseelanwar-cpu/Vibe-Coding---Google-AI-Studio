import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { InterviewReport, CVAnalysisResult, HistoryItem } from '../types';

const INTERVIEWS_COLLECTION = 'interviews';
const CV_ANALYSES_COLLECTION = 'cv_analyses';

export const saveInterviewReport = async (userEmail: string, report: InterviewReport) => {
    if (!db) return;

    try {
        await addDoc(collection(db, INTERVIEWS_COLLECTION), {
            userEmail: userEmail.toLowerCase(), // Key by Email
            report,
            company: report.summary.companyDetected || 'Unknown Company',
            role: report.summary.roleDetected || 'Unknown Role',
            score: report.summary.overallScore,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to save interview report to Firestore:", error);
        throw error;
    }
};

export const saveCVAnalysis = async (userEmail: string, analysis: CVAnalysisResult, jobDescriptionSnippet: string) => {
    if (!db) return;

    try {
        await addDoc(collection(db, CV_ANALYSES_COLLECTION), {
            userEmail: userEmail.toLowerCase(), // Key by Email
            analysis,
            matchScore: analysis.match_score,
            jobSnippet: jobDescriptionSnippet.substring(0, 100) + '...',
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to save CV analysis to Firestore:", error);
        throw error;
    }
};

export const getUserHistory = async (userEmail: string): Promise<HistoryItem[]> => {
    if (!db) return [];
    
    const history: HistoryItem[] = [];

    try {
        // 1. Fetch Interviews by Email
        // NOTE: Removed 'orderBy' to avoid requiring a Composite Index in Firestore Console.
        // Sorting is now handled in JavaScript below.
        const interviewsQuery = query(
            collection(db, INTERVIEWS_COLLECTION), 
            where('userEmail', '==', userEmail.toLowerCase())
        );
        const interviewsSnap = await getDocs(interviewsQuery);

        interviewsSnap.forEach(doc => {
            const data = doc.data();
            if (data.report) {
                history.push({
                    id: doc.id,
                    type: 'interview',
                    date: data.timestamp?.toDate() || new Date(),
                    title: `Interview: ${data.role}`,
                    subtitle: `at ${data.company}`,
                    score: data.score,
                    data: data.report as InterviewReport
                });
            }
        });

        // 2. Fetch CV Analyses by Email
        const cvQuery = query(
            collection(db, CV_ANALYSES_COLLECTION), 
            where('userEmail', '==', userEmail.toLowerCase())
        );
        const cvSnap = await getDocs(cvQuery);

        cvSnap.forEach(doc => {
            const data = doc.data();
            if (data.analysis) {
                history.push({
                    id: doc.id,
                    type: 'cv_analysis',
                    date: data.timestamp?.toDate() || new Date(),
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