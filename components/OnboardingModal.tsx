
import React, { useState } from 'react';
import { FileUploadIcon, MicIcon, CheckCircleIcon, ArrowLeftIcon } from './icons';

interface OnboardingModalProps {
  onComplete: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to Interview Coach Pro",
      description: "Your personal AI assistant to help you land your dream job. Let's get you set up in less than a minute.",
      icon: (
        <div className="h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-500/30">
          <span className="text-3xl">👋</span>
        </div>
      )
    },
    {
      title: "Step 1: Analyze & Align",
      description: "Upload your CV and a Job Description. Our AI scans for gaps, suggests ATS-friendly keywords, and rewrites your bullet points to match the role perfectly.",
      icon: (
        <div className="h-16 w-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-blue-500/30">
          <FileUploadIcon />
        </div>
      )
    },
    {
      title: "Step 2: Mock Interview",
      description: "Practice makes perfect. Jump into a voice-based interview tailored to your profile. Get instant feedback on your answers, structure, and communication skills.",
      icon: (
        <div className="h-16 w-16 bg-purple-500 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-purple-500/30">
          <MicIcon />
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const currentContent = steps[step];

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-[60]">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full m-4 relative flex flex-col items-center text-center animate-fade-in shadow-2xl">
        
        {/* Progress Dots */}
        <div className="flex gap-2 mb-8">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-indigo-500' : 'w-2 bg-slate-700'}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-grow flex flex-col items-center animate-slide-up key={step}">
          {currentContent.icon}
          <h2 className="text-2xl font-bold text-slate-50 mb-3">{currentContent.title}</h2>
          <p className="text-slate-400 leading-relaxed mb-8">
            {currentContent.description}
          </p>
        </div>

        {/* Actions */}
        <div className="w-full flex gap-3">
          {step > 0 ? (
             <button 
               onClick={handleBack}
               className="px-4 py-3 border border-slate-700 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
             >
               <ArrowLeftIcon />
             </button>
          ) : null}
          
          <button
            onClick={handleNext}
            className="flex-grow bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-2"
          >
            {step === steps.length - 1 ? (
              <>Get Started <CheckCircleIcon /></>
            ) : (
              "Next"
            )}
          </button>
        </div>

      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default OnboardingModal;
