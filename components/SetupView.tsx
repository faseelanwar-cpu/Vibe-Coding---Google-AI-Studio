import React, { useState, useMemo } from 'react';
import { DocumentData } from '../types';
import { fileToBase64 } from '../utils/fileUtils';
import { FileUploadIcon, SpinnerIcon } from './icons';

interface SetupViewProps {
  onStart: (initialState: { jd: string; cv?: DocumentData; linkedIn?: DocumentData }) => void;
  onShowInstructions: () => void;
}

const SetupView: React.FC<SetupViewProps> = ({ onStart, onShowInstructions }) => {
  const [jd, setJd] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [linkedinFile, setLinkedinFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReady = useMemo(() => {
    return jd.trim().length > 50 && (cvFile || linkedinFile);
  }, [jd, cvFile, linkedinFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<File | null>>) => {
    if (e.target.files && e.target.files[0]) {
      setter(e.target.files[0]);
    }
  };

  const handleStartClick = async () => {
    if (!isReady) return;

    setIsLoading(true);
    setError(null);

    try {
      let cvData, linkedInData;
      if (cvFile) {
        const { base64, mimeType } = await fileToBase64(cvFile);
        cvData = { base64, mimeType, name: cvFile.name };
      }
      if (linkedinFile) {
        const { base64, mimeType } = await fileToBase64(linkedinFile);
        linkedInData = { base64, mimeType, name: linkedinFile.name };
      }
      
      onStart({ jd, cv: cvData, linkedIn: linkedInData });

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during setup.');
      setIsLoading(false);
    }
  };

  const FileInputCard: React.FC<{
    title: string;
    file: File | null;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    id: string;
  }> = ({ title, file, onChange, id }) => (
    <div className="flex-grow bg-slate-900/50 border border-slate-800 rounded-2xl p-6 text-center flex flex-col items-center justify-center transition-colors hover:border-slate-700">
      <label htmlFor={id} className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
        <FileUploadIcon />
        <h3 className="font-semibold mt-4">{title}</h3>
        <p className="text-xs text-slate-400 mt-1">
          {file ? 'File selected:' : 'Click to upload PDF'}
        </p>
        {file && <p className="text-xs text-indigo-400 mt-2 font-mono break-all">{file.name}</p>}
      </label>
      <input type="file" id={id} accept=".pdf" className="hidden" onChange={onChange} />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="relative text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          AI mock interviews that match the job.
        </h1>
        <p className="text-slate-300 max-w-2xl mx-auto">
          Paste the job description, upload your CV or LinkedIn PDF, and get a realistic, voice-first interview.
        </p>
         <button 
            onClick={onShowInstructions} 
            className="absolute top-0 right-0 text-sm text-slate-400 hover:text-indigo-400 transition-colors px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600"
          >
            Instructions
          </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-stretch">
        <div className="flex flex-col">
          <label htmlFor="jd" className="block text-sm font-medium text-slate-300 mb-2">1. Paste Job Description</label>
          <textarea
            id="jd"
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            className="w-full flex-grow bg-slate-900/50 border border-slate-800 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow resize-none min-h-[350px]"
            placeholder="Paste the full job description here..."
          />
        </div>
        <div className="flex flex-col">
           <h2 className="block text-sm font-medium text-slate-300 mb-2">2. Upload Documents (at least one)</h2>
           <div className="flex-grow flex flex-col gap-6">
             <FileInputCard title="CV / Resume (PDF)" file={cvFile} onChange={(e) => handleFileChange(e, setCvFile)} id="cv-upload" />
             <FileInputCard title="LinkedIn Profile (PDF)" file={linkedinFile} onChange={(e) => handleFileChange(e, setLinkedinFile)} id="linkedin-upload" />
           </div>
        </div>
      </div>

      <div className="mt-12 text-center">
        <button
          onClick={handleStartClick}
          disabled={!isReady || isLoading}
          className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-lg disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center mx-auto"
        >
          {isLoading ? (
            <>
              <SpinnerIcon />
              Initializing Session...
            </>
          ) : 'Start Mock Interview'}
        </button>
        {error && <p className="text-red-400 mt-4">{error}</p>}
        {!isReady && !isLoading && <p className="text-slate-500 mt-4 text-sm">Please provide a job description and at least one document to begin.</p>}
      </div>
    </div>
  );
};

export default SetupView;