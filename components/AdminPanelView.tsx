import React, { useState } from 'react';
import { ArrowLeftIcon, TrashIcon, SpinnerIcon } from './icons';

interface AdminPanelViewProps {
  approvedEmails: string[];
  onAddEmail: (email: string) => Promise<{ success: boolean }>;
  onRemoveEmail: (email: string) => Promise<{ success: boolean }>;
  onBack: () => void;
}

const AdminPanelView: React.FC<AdminPanelViewProps> = ({ approvedEmails, onAddEmail, onRemoveEmail, onBack }) => {
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleAdd = async () => {
    setError(null);
    setSyncWarning(null);
    if (!newEmail) {
      setError('Email cannot be empty.');
      return;
    }
    if (!validateEmail(newEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (approvedEmails.includes(newEmail.toLowerCase())) {
        setError('This email is already on the list.');
        return;
    }
    
    setIsAdding(true);
    const { success } = await onAddEmail(newEmail);
    if (!success) {
        setSyncWarning('Could not sync with backend. Local copy saved.');
    }
    setIsAdding(false);
    setNewEmail('');
  };

  const handleRemove = async (email: string) => {
    setSyncWarning(null);
    setRemovingEmail(email);
    const { success } = await onRemoveEmail(email);
    if (!success) {
        setSyncWarning('Could not sync removal with backend. Local copy updated.');
    }
    setRemovingEmail(null);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="relative mb-8 text-center">
        <button onClick={onBack} className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-50">
            <ArrowLeftIcon />
        </button>
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
      </div>
       {syncWarning && <div className="mb-4 text-center text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg text-sm">{syncWarning}</div>}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Add New User</h2>
        <form onSubmit={e => {e.preventDefault(); handleAdd();}} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="new.user@example.com"
            className="flex-grow bg-slate-900/50 border border-slate-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
            disabled={isAdding}
          />
          <button type="submit" className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors flex items-center justify-center disabled:bg-slate-700" disabled={isAdding}>
            {isAdding ? <><SpinnerIcon /> Adding...</> : 'Add to Approved List'}
          </button>
        </form>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      <div className="mt-8">
        <h2 className="font-semibold mb-4">Approved Users ({approvedEmails.length})</h2>
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl">
          {approvedEmails.length > 0 ? (
            <ul className="divide-y divide-slate-800">
              {approvedEmails.sort().map(email => (
                <li key={email} className="px-6 py-4 flex justify-between items-center">
                  <span className="font-mono text-slate-300">{email}</span>
                  {email !== "test@procoach.ai" && (
                    <button 
                      onClick={() => handleRemove(email)}
                      className="text-slate-500 hover:text-red-400 transition-colors w-10 h-10 flex items-center justify-center disabled:text-slate-600"
                      aria-label={`Remove ${email}`}
                      disabled={!!removingEmail}
                    >
                      {removingEmail === email ? <SpinnerIcon /> : <TrashIcon />}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 text-center py-8">No approved users yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanelView;