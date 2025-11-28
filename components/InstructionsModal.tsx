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
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full m-4 relative animate-fade-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Close instructions"
        >
          <XIcon />
        </button>
        <h2 className="text-xl font-semibold mb-6 text-slate-50">How Interview Coach Pro works</h2>
        
        <div className="mb-6">
            <h3 className="font-medium text-indigo-300 mb-3 uppercase text-xs tracking-wider">Feature 1: CV Alignment</h3>
            <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-start gap-3">
                <span className="font-semibold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded text-xs">1</span>
                <span><strong>Upload & Analyze:</strong> Upload your current CV and paste the Job Description you are targeting.</span>
            </li>
            <li className="flex items-start gap-3">
                <span className="font-semibold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded text-xs">2</span>
                <span><strong>Get Suggestions:</strong> The AI identifies gaps and provides tailored bullet-point improvements and missing ATS keywords.</span>
            </li>
            <li className="flex items-start gap-3">
                <span className="font-semibold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded text-xs">3</span>
                <span><strong>Preview & Export:</strong> Review changes and download a new, optimized markdown version of your CV.</span>
            </li>
            </ul>
        </div>

        <div className="mb-6 border-t border-slate-800 pt-6">
            <h3 className="font-medium text-indigo-300 mb-3 uppercase text-xs tracking-wider">Feature 2: Mock Interview</h3>
            <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-start gap-3">
                <span className="font-semibold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded text-xs">1</span>
                <span><strong>Start Session:</strong> Using the same JD and your profile, start a voice-based interview.</span>
            </li>
            <li className="flex items-start gap-3">
                <span className="font-semibold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded text-xs">2</span>
                <span><strong>Speak:</strong> Answer 6–8 questions. We record your audio and transcribe it in real-time.</span>
            </li>
            <li className="flex items-start gap-3">
                <span className="font-semibold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded text-xs">3</span>
                <span><strong>Report:</strong> Get a detailed scorecard on relevance, structure, and communication, plus a full transcript.</span>
            </li>
            </ul>
        </div>

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