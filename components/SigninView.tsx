
import React, { useState } from 'react';
import { signInWithEmail, signInWithGoogle } from '../services/authService';
import { SpinnerIcon, GoogleIcon } from './icons';

interface SigninViewProps {
  approvedEmails: string[]; // Kept for prop compatibility, though logic is now in service
  onSignin: (email: string) => boolean; 
  onNavigateAdmin: () => void;
  onShowInstructions: () => void;
}

const SigninView: React.FC<SigninViewProps> = ({ onNavigateAdmin, onShowInstructions }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Trim whitespace immediately
    const cleanEmail = email.trim();
    setEmail(cleanEmail); // Update UI to show trimmed version

    setLoading(true);
    setError(null);
    
    const result = await signInWithEmail(cleanEmail);
    
    setLoading(false);

    if (!result.user && result.error) {
        // Provide more helpful error text if it's a generic denial
        if (result.error.includes("Access Denied")) {
            setError(`${result.error} (Checked: '${cleanEmail}')`);
        } else {
            setError(result.error);
        }
    }
    // On success, App.tsx listener handles the view change
  };

  const handleGoogleSignin = async () => {
      setGoogleLoading(true);
      setError(null);
      
      const result = await signInWithGoogle();
      
      setGoogleLoading(false);
      
      if (!result.user && result.error) {
          setError(result.error);
      }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-50">
          AI-powered CV alignment and virtual mock interviews.
        </h1>
        <p className="text-slate-300 max-w-3xl mx-auto mb-12">
          Paste the actual JD and your CV to get tailored improvement suggestions, then run a realistic voice interview for that role. Every answer is recorded, scored, and available as a downloadable report.
        </p>
        
        <div className="max-w-md mx-auto">
            <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
                <h2 className="text-2xl font-bold tracking-tight mb-6">Welcome Back</h2>
                
                <button 
                    onClick={handleGoogleSignin}
                    disabled={googleLoading || loading}
                    className="w-full bg-white hover:bg-slate-100 text-slate-900 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-3 mb-6 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                   {googleLoading ? <SpinnerIcon /> : <GoogleIcon />}
                   {googleLoading ? "Verifying Access..." : "Sign in with Google"}
                </button>

                <div className="relative flex items-center gap-4 mb-6">
                    <div className="flex-grow h-px bg-slate-800"></div>
                    <span className="text-xs text-slate-500 uppercase">Or continue with email</span>
                    <div className="flex-grow h-px bg-slate-800"></div>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your approved email..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                        required
                    />
                    
                    <button 
                      type="submit"
                      disabled={loading || googleLoading}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                       {loading ? <SpinnerIcon /> : null}
                       {loading ? "Checking Access..." : "Enter"}
                    </button>
                </form>

                {error && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-left animate-fade-in">
                     <p className="text-red-300 text-sm font-medium mb-1">Access Denied</p>
                     <p className="text-red-400 text-xs leading-relaxed">{error}</p>
                  </div>
                )}

                <div className="mt-6 border-t border-slate-800 pt-6 flex justify-center items-center gap-6">
                 <button onClick={onShowInstructions} className="text-sm text-slate-400 hover:text-indigo-400 transition-colors">
                    How it works
                </button>
                 <button onClick={onNavigateAdmin} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    Admin Access
                </button>
                </div>
            </div>
            <p className="text-xs text-slate-600 mt-6">
              Access is restricted to approved beta users.
            </p>
        </div>
        <style>{`
            @keyframes fade-in {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in {
                animation: fade-in 0.3s ease-out forwards;
            }
        `}</style>
    </div>
  );
};

export default SigninView;
