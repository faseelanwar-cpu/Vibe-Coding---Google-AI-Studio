
import React, { useEffect, useState } from 'react';
import { HistoryItem, InterviewReport, CVAnalysisResult } from '../types';
import { getUserHistory, deleteHistoryItem, deleteAllUserHistory } from '../services/dbService';
import { SpinnerIcon, TrashIcon } from './icons';

interface HistoryViewProps {
  userId: string; // This maps to email
  onLoadInterview: (report: InterviewReport) => void;
  onLoadCVAnalysis: (analysis: CVAnalysisResult) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ userId, onLoadInterview, onLoadCVAnalysis }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
        const items = await getUserHistory(userId);
        setHistory(items);
    } catch (e) {
        console.error("Failed to load history", e);
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteItem = async (item: HistoryItem) => {
    console.log("Deleting item:", item.id);
    
    // Removed window.confirm as it blocks in preview environments
    
    // Optimistic update
    setHistory(prev => prev.filter(i => i.id !== item.id));

    try {
        await deleteHistoryItem(item.id, item.type);
    } catch (error) {
        console.error("Delete failed", error);
        // Revert if failed
        loadData(); 
    }
  };

  const handleDeleteAll = async () => {
    if (!confirmClear) {
        setConfirmClear(true);
        setTimeout(() => setConfirmClear(false), 3000); // Reset after 3s
        return;
    }

    setIsDeleting(true);
    try {
        await deleteAllUserHistory(userId);
        setHistory([]); // Clear UI immediately
        setConfirmClear(false);
    } catch (error) {
        console.error("Delete all failed", error);
    } finally {
        setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <SpinnerIcon />
        <p className="text-slate-400 mt-4">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Your Activity History</h1>
        {history.length > 0 && (
            <button 
                type="button"
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className={`relative z-50 text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-2 border border-transparent cursor-pointer ${confirmClear ? 'bg-red-600 text-white hover:bg-red-500' : 'text-red-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/20'}`}
            >
                {isDeleting ? <SpinnerIcon /> : <TrashIcon />}
                {confirmClear ? "Click again to Confirm" : "Clear History"}
            </button>
        )}
      </div>

      {history.length === 0 ? (
         <div className="max-w-4xl mx-auto py-8 text-center">
            <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-12">
                <h2 className="text-xl font-semibold text-slate-300 mb-2">No History Yet</h2>
                <p className="text-slate-500">Your completed interviews and CV analyses will appear here.</p>
            </div>
         </div>
      ) : (
          <div className="grid gap-4">
            {history.map((item) => (
              <div key={item.id} className="relative group">
                {/* 
                  PHYSICAL SEPARATION:
                  The Clickable Card is one div.
                  The Delete Button is a completely separate SIBLING div positioned on top.
                */}
                
                {/* 1. Clickable Content Area */}
                <div 
                    onClick={() => item.type === 'interview' ? onLoadInterview(item.data as InterviewReport) : onLoadCVAnalysis(item.data as CVAnalysisResult)}
                    className="block w-full bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 pr-20 cursor-pointer transition-all hover:bg-slate-800/60 text-left"
                >
                    <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${item.type === 'interview' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                            {item.type === 'interview' ? '🎤' : '📄'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors truncate">{item.title}</h3>
                            <p className="text-sm text-slate-400 truncate">{item.subtitle}</p>
                        </div>
                         <div className="text-right hidden sm:block mr-4">
                            {item.score !== undefined && (
                                <div className="text-2xl font-bold text-slate-500 mb-1 group-hover:text-slate-300">{item.score}</div>
                            )}
                            <div className="text-xs text-slate-500 font-mono">{item.date.toLocaleDateString()}</div>
                        </div>
                    </div>
                </div>

                {/* 2. Delete Button Area (Sibling) */}
                <div className="absolute top-1/2 right-4 -translate-y-1/2 z-20 pointer-events-auto">
                    <button 
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                            handleDeleteItem(item);
                        }}
                        className="p-3 text-slate-600 hover:text-red-400 bg-slate-900 hover:bg-red-500/10 rounded-full transition-all border border-slate-800 hover:border-red-500/20 shadow-md"
                        aria-label="Delete item"
                        title="Delete Item"
                    >
                        <TrashIcon />
                    </button>
                </div>
              </div>
            ))}
          </div>
      )}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default HistoryView;
