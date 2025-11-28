
import React, { useState, useCallback, useEffect } from 'react';
import SetupView from './components/SetupView';
import InterviewView from './components/InterviewView';
import ReportView from './components/ReportView';
import SigninView from './components/SigninView';
import AdminPanelView from './components/AdminPanelView';
import AdminPinView from './components/AdminPinView';
import InstructionsModal from './components/InstructionsModal';
import OnboardingModal from './components/OnboardingModal'; // New Import
import CVSuggestionsView from './components/CVSuggestionsView';
import HistoryView from './components/HistoryView';
import UserProfileView from './components/UserProfileView';
import { InterviewFlowView, InitialInterviewState, InterviewReport, TopLevelView, Feature, UserProfile, CVAnalysisResult } from './types';
import { UserIcon, SpinnerIcon } from './components/icons';
import * as userService from './services/userService';
import * as authService from './services/authService';
import * as dbService from './services/dbService';
import './firebaseConfig';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App Navigation
  const [currentView, setCurrentView] = useState<TopLevelView>(TopLevelView.SIGNIN);
  const [activeFeature, setActiveFeature] = useState<Feature>(Feature.CV_SUGGESTIONS);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false); // New State
  
  // Interview State
  const [interviewFlowView, setInterviewFlowView] = useState<InterviewFlowView>(InterviewFlowView.SETUP);
  const [initialInterviewState, setInitialInterviewState] = useState<InitialInterviewState | null>(null);
  const [interviewReport, setInterviewReport] = useState<InterviewReport | null>(null);
  
  // History Loading State
  const [loadedAnalysis, setLoadedAnalysis] = useState<CVAnalysisResult | null>(null);

  // --- Authentication Listener ---
  useEffect(() => {
    const unsubscribe = authService.subscribeToAuthChanges((profile) => {
      setUser(profile);
      if (profile) {
        setCurrentView(TopLevelView.APP);
        // Check for onboarding
        if (!profile.hasCompletedOnboarding) {
            setShowOnboarding(true);
        }
      } else {
        if (currentView !== TopLevelView.ADMIN_PANEL && currentView !== TopLevelView.ADMIN_PIN) {
            setCurrentView(TopLevelView.SIGNIN);
        }
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, [currentView]);

  // --- Auth Handlers ---
  const handleSignout = useCallback(async () => {
    await authService.signOut();
    setInterviewFlowView(InterviewFlowView.SETUP);
    setInitialInterviewState(null);
    setInterviewReport(null);
    setLoadedAnalysis(null);
    setCurrentView(TopLevelView.SIGNIN);
  }, []);
  
  const openInstructions = () => setShowInstructions(true);
  const closeInstructions = () => setShowInstructions(false);

  // --- Onboarding Handler ---
  const handleOnboardingComplete = async () => {
      setShowOnboarding(false);
      if (user && user.uid) {
          // Update DB
          await userService.completeOnboarding(user.uid); // user.uid is mapped to email in authService
          // Update local state to prevent re-showing in this session if DB update lags
          setUser(prev => prev ? ({ ...prev, hasCompletedOnboarding: true }) : null);
      }
  };

  // --- Admin Handlers ---
  const [adminPanelEmails, setAdminPanelEmails] = useState<string[]>([]);

  const enterAdminPanel = async () => {
      const emails = await userService.loadApprovedEmails();
      setAdminPanelEmails(emails);
      setCurrentView(TopLevelView.ADMIN_PANEL);
  };

  const handleHeaderAdminClick = () => {
     if (user?.isAdmin) enterAdminPanel();
  };

  const handleAdminPinSuccess = () => {
     enterAdminPanel();
  };

  const handleAddEmail = useCallback(async (email: string) => {
    const { success, finalEmails } = await userService.addApprovedEmail(email);
    if (success) setAdminPanelEmails(finalEmails);
    return { success };
  }, []);
  
  const handleRemoveEmail = useCallback(async (email: string) => {
    const { success, finalEmails } = await userService.removeApprovedEmail(email);
    if (success) setAdminPanelEmails(finalEmails);
    return { success };
  }, []);

  // --- Feature Handlers ---

  // Interview Flow
  const handleInterviewStart = useCallback((initialState: InitialInterviewState) => {
    setInitialInterviewState(initialState);
    setInterviewFlowView(InterviewFlowView.INTERVIEW);
  }, []);

  const handleInterviewFinish = useCallback(async (report: InterviewReport) => {
    setInterviewReport(report);
    setInterviewFlowView(InterviewFlowView.REPORT);
    if (user && user.uid) {
        await dbService.saveInterviewReport(user.uid, report);
    }
  }, [user]);
  
  const handleInterviewStartOver = useCallback(() => {
    setInitialInterviewState(null);
    setInterviewReport(null);
    setInterviewFlowView(InterviewFlowView.SETUP);
  }, []);

  // CV Flow
  const handleCVAnalysisComplete = useCallback(async (analysis: CVAnalysisResult, jdSnippet: string) => {
     if (user && user.uid) {
        await dbService.saveCVAnalysis(user.uid, analysis, jdSnippet);
     }
  }, [user]);

  // History Handlers
  const handleLoadInterview = (report: InterviewReport) => {
      setInterviewReport(report);
      setInterviewFlowView(InterviewFlowView.REPORT);
      setActiveFeature(Feature.INTERVIEW);
  };

  const handleLoadCVAnalysis = (analysis: CVAnalysisResult) => {
      setLoadedAnalysis(analysis);
      setActiveFeature(Feature.CV_SUGGESTIONS);
  };


  // --- Rendering ---

  const renderInterviewFlow = () => {
    switch (interviewFlowView) {
      case InterviewFlowView.INTERVIEW:
        return initialInterviewState && <InterviewView initialState={initialInterviewState} onFinish={handleInterviewFinish} />;
      case InterviewFlowView.REPORT:
        return interviewReport && <ReportView report={interviewReport} onStartOver={handleInterviewStartOver} />;
      case InterviewFlowView.SETUP:
      default:
        return <SetupView onStart={handleInterviewStart} onShowInstructions={openInstructions} />;
    }
  };

  const renderAppContent = () => {
    switch (activeFeature) {
      case Feature.PROFILE:
        return user?.uid ? <UserProfileView userId={user.uid} /> : null;
      case Feature.INTERVIEW:
        return renderInterviewFlow();
      case Feature.HISTORY:
        return user?.uid ? <HistoryView userId={user.uid} onLoadInterview={handleLoadInterview} onLoadCVAnalysis={handleLoadCVAnalysis} /> : null;
      case Feature.CV_SUGGESTIONS:
      default:
        return <CVSuggestionsView 
                onShowInstructions={openInstructions} 
                initialAnalysis={loadedAnalysis}
                onAnalysisComplete={handleCVAnalysisComplete}
                onReset={() => setLoadedAnalysis(null)}
               />;
    }
  };

  if (authLoading) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
            <SpinnerIcon />
            <span className="ml-3">Connecting...</span>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
       {showInstructions && <InstructionsModal onClose={closeInstructions} />}
       {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
      
       {/* Header */}
       {(currentView === TopLevelView.APP) && (
        <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-sm sticky top-0 z-10">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveFeature(Feature.CV_SUGGESTIONS)}>
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-400"></div>
                <span className="font-semibold tracking-tight text-lg hidden sm:block">Interview Coach Pro</span>
            </div>
            
            {user && (
                <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-800 rounded-lg p-1 text-sm">
                    <button 
                    onClick={() => setActiveFeature(Feature.CV_SUGGESTIONS)}
                    className={`px-3 py-1 rounded-md transition-colors ${activeFeature === Feature.CV_SUGGESTIONS ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                    CV Suggestions
                    </button>
                    <button 
                    onClick={() => setActiveFeature(Feature.INTERVIEW)}
                    className={`px-3 py-1 rounded-md transition-colors ${activeFeature === Feature.INTERVIEW ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                    Interview
                    </button>
                    <button 
                    onClick={() => setActiveFeature(Feature.PROFILE)}
                    className={`px-3 py-1 rounded-md transition-colors ${activeFeature === Feature.PROFILE ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                    Profile
                    </button>
                    <button 
                    onClick={() => setActiveFeature(Feature.HISTORY)}
                    className={`px-3 py-1 rounded-md transition-colors ${activeFeature === Feature.HISTORY ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                    History
                    </button>
                </div>
                </div>
            )}

            <div className="flex items-center gap-4">
                {user && (
                    <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
                    <UserIcon />
                    <span>{user.email}</span>
                    </div>
                )}
                
                {user?.isAdmin && (
                     <button onClick={handleHeaderAdminClick} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-full text-indigo-300 transition-colors">
                        Admin
                     </button>
                )}
                
                {user && (
                    <button 
                    onClick={handleSignout} 
                    className="text-sm text-slate-400 hover:text-slate-50 transition-colors"
                    >
                    Sign Out
                    </button>
                )}
            </div>
            </div>
        </header>
      )}

      <main>
        {currentView === TopLevelView.SIGNIN && (
            <SigninView 
                approvedEmails={[]} 
                onSignin={() => true} 
                onNavigateAdmin={() => setCurrentView(TopLevelView.ADMIN_PIN)} 
                onShowInstructions={openInstructions} 
            />
        )}

        {currentView === TopLevelView.ADMIN_PIN && (
             <AdminPinView 
                onCorrectPin={handleAdminPinSuccess}
                onBack={() => setCurrentView(TopLevelView.SIGNIN)}
             />
        )}
        
        {currentView === TopLevelView.ADMIN_PANEL && (
             <AdminPanelView 
                approvedEmails={adminPanelEmails}
                onAddEmail={handleAddEmail} 
                onRemoveEmail={handleRemoveEmail} 
                onBack={() => setCurrentView(user ? TopLevelView.APP : TopLevelView.SIGNIN)} 
             />
        )}

        {currentView === TopLevelView.APP && user && renderAppContent()}
      </main>
    </div>
  );
};

export default App;
