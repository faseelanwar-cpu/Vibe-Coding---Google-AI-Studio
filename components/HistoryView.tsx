import React, { useEffect, useState } from 'react';
import { HistoryItem, InterviewReport, CVAnalysisResult } from '../types';
import { getUserHistory } from '../services/dbService';
import { SpinnerIcon } from './icons';

interface HistoryViewProps {
  userId: string;
  onLoadInterview: (report: InterviewReport) => void;
  onLoadCVAnalysis: (analysis: CVAnalysisResult) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ userId, onLoadInterview, onLoadCVAnalysis }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const items = await getUserHistory(userId);
      setHistory(items);
      setLoading(false);
    };
    loadData();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <SpinnerIcon />
        <p className="text-slate-400 mt-4">Loading history...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
         <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-12">
            <h2 className="text-xl font-semibold text-slate-300 mb-2">No History Yet</h2>
            <p className="text-slate-500">Your completed interviews and CV analyses will appear here.</p>
         </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Your Activity History</h1>
      <div className="grid gap-4">
        {history.map((item) => (
          <div 
            key={item.id} 
            onClick={() => item.type === 'interview' ? onLoadInterview(item.data as InterviewReport) : onLoadCVAnalysis(item.data as CVAnalysisResult)}
            className="group bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 cursor-pointer transition-all hover:bg-slate-800/60 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
               <div className={`h-12 w-12 rounded-full flex items-center justify-center text-xl ${item.type === 'interview' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                  {item.type === 'interview' ? '🎤' : '📄'}
               </div>
               <div>
                 <h3 className="font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">{item.title}</h3>
                 <p className="text-sm text-slate-400">{item.subtitle}</p>
               </div>
            </div>
            <div className="text-right">
                {item.score !== undefined && (
                    <div className="text-2xl font-bold text-slate-500 mb-1 group-hover:text-slate-300">{item.score}</div>
                )}
                <div className="text-xs text-slate-500 font-mono">{item.date.toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </div>
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
