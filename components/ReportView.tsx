import React from 'react';
import { InterviewReport, Scores } from '../types';
import { DownloadIcon } from './icons';

interface ReportViewProps {
  report: InterviewReport;
  onStartOver: () => void;
}

const ScorePill: React.FC<{ label: string; score: number }> = ({ label, score }) => {
  const bgColor = score >= 4 ? 'bg-green-500/20 text-green-300' : score >= 3 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300';
  return (
    <div className={`flex justify-between items-center text-sm px-3 py-1.5 rounded-full ${bgColor}`}>
      <span>{label}</span>
      <span className="font-semibold">{score}/5</span>
    </div>
  );
};

const ReportView: React.FC<ReportViewProps> = ({ report, onStartOver }) => {
  const { summary, transcript, downloadableReportText, downloadableTranscriptMarkdown } = report;

  const handleDownload = (filename: string, content: string, mimeType: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: mimeType });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">Your Interview Report</h1>
        <p className="text-slate-300">
          Role: {summary.roleDetected} | Company: {summary.companyDetected}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
          <p className="text-slate-400">Overall Score</p>
          <p className="text-7xl font-bold text-indigo-400 my-2">{summary.overallScore}<span className="text-4xl text-slate-500">/100</span></p>
          <p className="text-xs text-slate-500 max-w-xs">This score reflects your performance across all assessed categories.</p>
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-semibold mb-3 text-green-400">Top Strengths</h3>
                <ul className="list-disc list-inside space-y-2 text-sm text-slate-300">
                    {summary.topStrengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
            </div>
             <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-semibold mb-3 text-yellow-400">Areas for Improvement</h3>
                <ul className="space-y-3 text-sm text-slate-300">
                    {summary.topImprovements.map((item, i) => (
                        <li key={i}>
                            <p className="font-medium">{item.point}</p>
                            <p className="text-slate-400 text-xs italic">Suggestion: {item.suggestion}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold mb-6">Full Transcript & Analysis</h2>
        <div className="space-y-6">
          {transcript.map(turn => (
            <div key={turn.questionNumber} className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-6">
                <p className="text-sm text-indigo-400 font-semibold">Question {turn.questionNumber}</p>
                <p className="text-slate-50 my-2 text-lg">"{turn.question}"</p>
                <p className="text-sm text-slate-300 bg-slate-800/50 p-4 rounded-lg my-4">{turn.candidateAnswer}</p>
              </div>
              <div className="bg-slate-900/70 p-6 border-t border-slate-800">
                <h4 className="font-semibold mb-3 text-sm">Feedback & Scores</h4>
                <p className="text-sm text-slate-400 italic mb-4">"{turn.quickFeedback}"</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {Object.entries(turn.scores).map(([key, value]) => (
                      <ScorePill key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} score={value} />
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
        <button 
          onClick={() => handleDownload('transcript.md', downloadableTranscriptMarkdown, 'text/markdown')}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors"
        >
          <DownloadIcon /> Download Transcript.md
        </button>
        <button 
          onClick={() => handleDownload('report.txt', downloadableReportText, 'text/plain')}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 border border-slate-700 hover:bg-slate-800 rounded-lg font-medium transition-colors"
        >
          <DownloadIcon /> Download Report.txt
        </button>
         <button 
          onClick={onStartOver}
          className="w-full sm:w-auto px-6 py-3 border border-slate-700 hover:bg-slate-800 rounded-lg font-medium transition-colors"
        >
          Start New Interview
        </button>
      </div>
    </div>
  );
};

export default ReportView;
