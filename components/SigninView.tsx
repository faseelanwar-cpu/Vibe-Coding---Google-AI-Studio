import React, { useState } from 'react';

interface SigninViewProps {
  approvedEmails: string[];
  onSignin: (email: string) => boolean;
  onNavigateAdmin: () => void;
}

const SigninView: React.FC<SigninViewProps> = ({ approvedEmails, onSignin, onNavigateAdmin }) => {
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
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center">
      <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Sign in to Interview Coach Pro</h1>
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

        <div className="mt-6 border-t border-slate-800 pt-6">
          <button onClick={onNavigateAdmin} className="text-sm text-slate-400 hover:text-indigo-400 transition-colors">
            Admin login
          </button>
        </div>
      </div>
    </div>
  );
};

export default SigninView;