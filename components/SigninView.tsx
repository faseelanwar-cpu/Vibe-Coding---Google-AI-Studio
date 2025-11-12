import React, { useState } from 'react';

interface SigninViewProps {
  approvedEmails: string[];
  onSignin: (email: string) => boolean;
  onNavigateAdmin: () => void;
  onShowInstructions: () => void;
}

const SigninView: React.FC<SigninViewProps> = ({ approvedEmails, onSignin, onNavigateAdmin, onShowInstructions }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleContinue = () => {
    setError(null);
    if (!email) {
      setError('Please enter an email address.');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!approvedEmails.includes(email.toLowerCase())) {
        setError('This email is not approved. Please contact the admin.');
        return;
    }

    onSignin(email);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-50">
          AI virtual mock interviews for real job descriptions.
        </h1>
        <p className="text-slate-300 max-w-3xl mx-auto mb-12">
          Paste the actual JD, upload your CV or LinkedIn PDF, and we’ll run a voice interview tailored to that company. Every answer is recorded, scored, and available as a downloadable report.
        </p>
        
        <div className="max-w-md mx-auto">
            <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center">
                <h2 className="text-2xl font-bold tracking-tight mb-2">Sign in to Interview Coach Pro</h2>
                <p className="text-slate-400 mb-6">Enter your approved email address to continue.</p>
                
                <form onSubmit={(e) => { e.preventDefault(); handleContinue(); }}>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
                    placeholder="you@example.com"
                    required
                />
                {error && <p className="text-red-400 text-sm mt-3 text-left">{error}</p>}
                <button
                    type="submit"
                    className="w-full mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-lg transition-colors"
                >
                    Continue
                </button>
                </form>

                <div className="mt-6 border-t border-slate-800 pt-6 flex justify-center items-center gap-6">
                <button onClick={onNavigateAdmin} className="text-sm text-slate-400 hover:text-indigo-400 transition-colors">
                    Admin login
                </button>
                 <button onClick={onShowInstructions} className="text-sm text-slate-400 hover:text-indigo-400 transition-colors">
                    Instructions
                </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default SigninView;