import React from 'react';
import { XIcon } from './icons';

interface InstructionsModalProps {
  onClose: () => void;
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({ onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full m-4 relative animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Close instructions"
        >
          <XIcon />
        </button>
        <h2 className="text-xl font-semibold mb-4 text-slate-50">How Interview Coach Pro works</h2>
        <ul className="space-y-3 text-sm text-slate-300">
          <li className="flex items-start gap-3">
            <span className="font-semibold text-indigo-400">1.</span>
            <span>Paste the real job description — we extract role, skills, seniority, and company.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-semibold text-indigo-400">2.</span>
            <span>Upload your CV and/or your LinkedIn profile as PDF — we tailor questions to your profile.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-semibold text-indigo-400">3.</span>
            <span>Click ‘Start Mock Interview’ — the AI will start a voice-based interview (6–8 questions).</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-semibold text-indigo-400">4.</span>
            <span>We record and score your answers against relevance, structure, metrics, company alignment, and communication.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-semibold text-indigo-400">5.</span>
            <span>At the end, you get a report + transcript you can download.</span>
          </li>
        </ul>
        <div className="mt-6 text-right">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default InstructionsModal;