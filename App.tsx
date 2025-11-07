import React, { useState, useCallback, useEffect } from 'react';
import SetupView from './components/SetupView';
import InterviewView from './components/InterviewView';
import ReportView from './components/ReportView';
import SigninView from './components/SigninView';
import AdminPinView from './components/AdminPinView';
import AdminPanelView from './components/AdminPanelView';
import { InterviewFlowView, InitialInterviewState, InterviewReport, TopLevelView } from './types';
import { UserIcon, SpinnerIcon } from './components/icons';
import * as userService from './services/userService';
import './firebaseConfig'; // Ensures Firebase is initialized

const App: React.FC = () => {
  // Top-level application state
  const [currentView, setCurrentView] = useState<TopLevelView>(TopLevelView.SIGNIN);
  const [approvedEmails, setApprovedEmails] = useState<string[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // State for the core interview flow
  const [interviewFlowView, setInterviewFlowView] = useState<InterviewFlowView>(InterviewFlowView.SETUP);
  const [initialInterviewState, setInitialInterviewState] = useState<InitialInterviewState | null>(null);
  const [interviewReport, setInterviewReport] = useState<InterviewReport | null>(null);

  // --- Initial Load ---
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const emails = await userService.loadApprovedEmails();
        setApprovedEmails(emails);
      } catch (error) {
        console.error("Failed to load approved emails:", error);
        setLoadError("Could not load user data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);


  // --- Authentication and Navigation Handlers ---

  const handleSignin = useCallback((email: string) => {
    if (approvedEmails.includes(email.toLowerCase())) {
      setCurrentUserEmail(email);
      setCurrentView(TopLevelView.APP);
    } else {
      // Error is handled inside SigninView
      return false;
    }
    return true;
  }, [approvedEmails]);

  const handleSignout = useCallback(() => {
    setCurrentUserEmail(null);
    setCurrentView(TopLevelView.SIGNIN);
    // Reset interview state
    setInterviewFlowView(InterviewFlowView.SETUP);
    setInitialInterviewState(null);
    setInterviewReport(null);
  }, []);

  // --- Admin Panel Handlers ---

  const handleAddEmail = useCallback(async (email: string) => {
    const lowerCaseEmail = email.toLowerCase();
    if (approvedEmails.includes(lowerCaseEmail)) {
        return { success: true }; // Already exists
    }
    
    const { success, finalEmails } = await userService.addApprovedEmail(lowerCaseEmail);
    if (success) {
        setApprovedEmails(finalEmails);
    }
    return { success };
  }, [approvedEmails]);
  
  const handleRemoveEmail = useCallback(async (email: string) => {
    const { success, finalEmails } = await userService.removeApprovedEmail(email);
    if (success) {
        setApprovedEmails(finalEmails);
    }
    return { success };
  }, [approvedEmails]);

  // --- Interview Flow Handlers ---

  const handleInterviewStart = useCallback((initialState: InitialInterviewState) => {
    setInitialInterviewState(initialState);
    setInterviewFlowView(InterviewFlowView.INTERVIEW);
  }, []);

  const handleInterviewFinish = useCallback((report: InterviewReport) => {
    setInterviewReport(report);
    setInterviewFlowView(InterviewFlowView.REPORT);
  }, []);
  
  const handleStartOver = useCallback(() => {
    setInitialInterviewState(null);
    setInterviewReport(null);
    setInterviewFlowView(InterviewFlowView.SETUP);
  }, []);

  // --- View Rendering Logic ---

  const renderInterviewFlow = () => {
    switch (interviewFlowView) {
      case InterviewFlowView.INTERVIEW:
        return initialInterviewState && <InterviewView initialState={initialInterviewState} onFinish={handleInterviewFinish} />;
      case InterviewFlowView.REPORT:
        return interviewReport && <ReportView report={interviewReport} onStartOver={handleStartOver} />;
      case InterviewFlowView.SETUP:
      default:
        return <SetupView onStart={handleInterviewStart} />;
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-[calc(100vh-80px)]">
            <SpinnerIcon />
            <span className="ml-3 text-slate-400">Loading...</span>
        </div>
      )
    }

    if (loadError) {
      return (
        <div className="flex justify-center items-center h-[calc(100vh-80px)] text-red-400">
          {loadError}
        </div>
      )
    }

    switch(currentView) {
      case TopLevelView.SIGNIN:
        return <SigninView approvedEmails={approvedEmails} onSignin={handleSignin} onNavigateAdmin={() => setCurrentView(TopLevelView.ADMIN_PIN)} />;
      case TopLevelView.ADMIN_PIN:
        return <AdminPinView onCorrectPin={() => setCurrentView(TopLevelView.ADMIN_PANEL)} onBack={() => setCurrentView(TopLevelView.SIGNIN)} />;
      case TopLevelView.ADMIN_PANEL:
        return <AdminPanelView approvedEmails={approvedEmails} onAddEmail={handleAddEmail} onRemoveEmail={handleRemoveEmail} onBack={() => setCurrentView(TopLevelView.SIGNIN)} />;
      case TopLevelView.APP:
        if (!currentUserEmail) {
          // Safeguard
          setCurrentView(TopLevelView.SIGNIN);
          return null;
        }
        return renderInterviewFlow();
      default:
        return <SigninView approvedEmails={approvedEmails} onSignin={handleSignin} onNavigateAdmin={() => setCurrentView(TopLevelView.ADMIN_PIN)} />;
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-400"></div>
            <span className="font-semibold tracking-tight text-lg">Interview Coach Pro</span>
          </div>
          {currentUserEmail && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <UserIcon />
                <span>{currentUserEmail}</span>
              </div>
              <button 
                onClick={handleSignout} 
                className="text-sm text-slate-400 hover:text-slate-50 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>
      <main>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;