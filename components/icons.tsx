import React from 'react';

export const FileUploadIcon: React.FC = () => (
    <div className="h-12 w-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5A2.25 2.25 0 0118.75 19.5H5.25A2.25 2.25 0 013 17.25z" />
        </svg>
    </div>
);

export const SpinnerIcon: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export const MicIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75v2.25m-3 0h6M12 3.75A2.25 2.25 0 009.75 6v6A2.25 2.25 0 0012 14.25 2.25 2.25 0 0014.25 12V6A2.25 2.25 0 0012 3.75z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 10.5v1.125a5.25 5.25 0 0010.5 0V10.5" />
  </svg>
);

export const StopIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
    <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
  </svg>
);

export const SoundWaveIcon: React.FC = () => (
    <div className="flex items-center justify-center gap-1 h-8">
        <div className="w-1 bg-indigo-500/40 rounded-full h-3 animate-[wave_1.2s_ease-in-out_infinite]"></div>
        <div className="w-1 bg-indigo-500 rounded-full h-6 animate-[wave_1.2s_ease-in-out_0.2s_infinite]"></div>
        <div className="w-1 bg-indigo-500/60 rounded-full h-8 animate-[wave_1.2s_ease-in-out_0.4s_infinite]"></div>
        <div className="w-1 bg-indigo-500/20 rounded-full h-4 animate-[wave_1.2s_ease-in-out_0.6s_infinite]"></div>
        <div className="w-1 bg-indigo-500/70 rounded-full h-7 animate-[wave_1.2s_ease-in-out_0.8s_infinite]"></div>
        <div className="w-1 bg-indigo-500/30 rounded-full h-5 animate-[wave_1.2s_ease-in-out_1s_infinite]"></div>
        <div className="w-1 bg-indigo-500/60 rounded-full h-9 animate-[wave_1.2s_ease-in-out_0.2s_infinite]"></div>
        <div className="w-1 bg-indigo-500/40 rounded-full h-3 animate-[wave_1.2s_ease-in-out_0.4s_infinite]"></div>
        <style>{`
            @keyframes wave {
                0%, 100% { transform: scaleY(0.5); }
                50% { transform: scaleY(1); }
            }
        `}</style>
    </div>
);

export const DownloadIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
  </svg>
);
