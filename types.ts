
export enum TopLevelView {
  SIGNIN = 'signin',
  ADMIN_PIN = 'admin-pin',
  ADMIN_PANEL = 'admin-panel',
  APP = 'app',
}

export enum Feature {
  CV_SUGGESTIONS = 'cv',
  INTERVIEW = 'interview',
  HISTORY = 'history',
  PROFILE = 'profile', // New feature
}

export enum InterviewFlowView {
  SETUP = 'setup',
  INTERVIEW = 'interview',
  REPORT = 'report',
}

export interface DocumentData {
  base64: string;
  mimeType: string;
  name: string;
}

// --- User Profile Structures ---

export interface WorkExperience {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string; // "Present" or date
  description: string | string[]; // Updated to support bullet array
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string;
  description: string | string[]; // Updated to support bullet array
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  startDate: string; // Issue Date
  expirationDate: string;
  credentialId: string;
  url: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | string[]; // Updated
  link?: string;
}

export interface CandidateProfile {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    linkedin?: string;
    location?: string;
    portfolio?: string;
  };
  summary: string;
  experience: WorkExperience[];
  education: Education[];
  skills: string[]; // Array of strings
  projects: Project[];
  certifications: Certification[];
}

// -------------------------------

export interface InitialInterviewState {
  jd: string;
  cv?: DocumentData;
  linkedIn?: DocumentData;
  profileData?: CandidateProfile; // Allow passing structured profile instead of file
}

export interface Scores {
  relevance: number;
  structure: number;
  metrics: number;
  alignment: number;
  communication: number;
}

export interface TranscriptTurn {
  questionNumber: number;
  question: string;
  sourceOfQuestion: 'JD' | 'CandidateProfile' | 'Mixed';
  candidateAnswer: string;
  quickFeedback: string;
  scores: Scores;
}

export interface InterviewReport {
  summary: {
    companyDetected: string;
    roleDetected: string;
    overallScore: number;
    topStrengths: string[];
    topImprovements: { point: string; suggestion: string }[];
  };
  transcript: TranscriptTurn[];
  downloadableTranscriptMarkdown: string;
  downloadableReportText: string;
}


export interface SuggestedImprovement {
  section: 'Experience' | 'Summary' | 'Skills' | 'Achievements' | string;
  original: string;
  suggestion: string;
  reason: string;
  confidence_score: number; // 0 to 100
}

export interface KeywordSuggestion {
  keyword: string;
  importance: 'High' | 'Medium';
}

export interface CVAnalysisResult {
  match_score: number;
  match_explanation: string[];
  suggested_improvements: SuggestedImprovement[];
  critical_additions: string[];
  missing_keywords: KeywordSuggestion[];
  extracted_text?: string; 
}

export interface FullCVPreviewResult {
    full_cv_preview_html: string;
    downloadable_cv_markdown: string;
    latex_source: string;
    structured_cv: CandidateProfile; // Added for PDF generation
}

export interface UserProfile {
  email: string;
  isAdmin: boolean;
  uid?: string;
  createdAt?: any;
  hasCompletedOnboarding?: boolean;
}

export interface HistoryItem {
  id: string;
  type: 'interview' | 'cv_analysis';
  date: Date;
  title: string;
  subtitle: string;
  score?: number;
  data: InterviewReport | CVAnalysisResult; 
}
