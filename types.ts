export enum AppView {
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
