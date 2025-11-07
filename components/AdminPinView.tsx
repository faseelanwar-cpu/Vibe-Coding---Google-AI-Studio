import React, { useState } from 'react';

interface AdminPinViewProps {
  onCorrectPin: () => void;
  onBack: () => void;
}

const ADMIN_PIN = '112358';

const AdminPinView: React.FC<AdminPinViewProps> = ({ onCorrectPin, onBack }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleEnter = () => {
    if (pin === ADMIN_PIN) {
      onCorrectPin();
    } else {
      setError('Incorrect PIN.');
      setPin('');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center">
      <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Admin Access</h1>
        <p className="text-slate-400 mb-6">Enter the administrator PIN to continue.</p>
        
        <form onSubmit={(e) => { e.preventDefault(); handleEnter(); }}>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow text-center tracking-widest"
            placeholder="******"
            required
          />
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          <button
            type="submit"
            className="w-full mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-lg transition-colors"
          >
            Enter
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800 pt-6">
          <button onClick={onBack} className="text-sm text-slate-400 hover:text-indigo-400 transition-colors">
            Back to sign-in
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPinView;
