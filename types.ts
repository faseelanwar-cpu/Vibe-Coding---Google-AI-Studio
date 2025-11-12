export enum TopLevelView {
  SIGNIN = 'signin',
  ADMIN_PIN = 'admin-pin',
  ADMIN_PANEL = 'admin-panel',
  APP = 'app',
}

export enum Feature {
  CV_SUGGESTIONS = 'cv',
  INTERVIEW = 'interview',
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

export interface InitialInterviewState {
  jd: string;
  cv?: DocumentData;
  linkedIn?: DocumentData;
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


// New, expert-level structure for CV suggestions
export interface SuggestedImprovement {
  section: 'Experience' | 'Summary' | 'Skills' | 'Achievements' | string;
  original: string;
  suggestion: string;
  reason: string;
}

export interface CVAnalysisResult {
  match_score: number;
  match_explanation: string[];
  suggested_improvements: SuggestedImprovement[];
  critical_additions: string[];
}

// New structure for the full CV preview
export interface FullCVPreviewResult {
    full_cv_preview_html: string;
    downloadable_cv_markdown: string;
}
