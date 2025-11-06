import React, { useState, useCallback } from 'react';
import SetupView from './components/SetupView';
import InterviewView from './components/InterviewView';
import ReportView from './components/ReportView';
import { AppView, InitialInterviewState, InterviewReport } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.SETUP);
  const [initialInterviewState, setInitialInterviewState] = useState<InitialInterviewState | null>(null);
  const [interviewReport, setInterviewReport] = useState<InterviewReport | null>(null);

  const handleInterviewStart = useCallback((initialState: InitialInterviewState) => {
    setInitialInterviewState(initialState);
    setCurrentView(AppView.INTERVIEW);
  }, []);

  const handleInterviewFinish = useCallback((report: InterviewReport) => {
    setInterviewReport(report);
    setCurrentView(AppView.REPORT);
  }, []);
  
  const handleStartOver = useCallback(() => {
    setInitialInterviewState(null);
    setInterviewReport(null);
    setCurrentView(AppView.SETUP);
  }, []);

  const renderView = () => {
    switch (currentView) {
      case AppView.INTERVIEW:
        return initialInterviewState && <InterviewView initialState={initialInterviewState} onFinish={handleInterviewFinish} />;
      case AppView.REPORT:
        return interviewReport && <ReportView report={interviewReport} onStartOver={handleStartOver} />;
      case AppView.SETUP:
      default:
        return <SetupView onStart={handleInterviewStart} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-400"></div>
            <span className="font-semibold tracking-tight text-lg">Interview Coach Pro</span>
          </div>
        </div>
      </header>
      <main>
        {renderView()}
      </main>
    </div>
  );
};

export default App;
