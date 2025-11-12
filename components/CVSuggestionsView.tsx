import React, { useState, useMemo, useEffect } from 'react';
import { DocumentData, CVAnalysisResult, SuggestedImprovement, FullCVPreviewResult } from '../types';
import { fileToBase64 } from '../utils/fileUtils';
import * as geminiService from '../services/geminiService';
import { FileUploadIcon, SpinnerIcon, CheckCircleIcon, ArrowLeftIcon, DownloadIcon } from './icons';

interface CVSuggestionsViewProps {
  onShowInstructions: () => void;
}

const CVSuggestionsView: React.FC<CVSuggestionsViewProps> = ({ onShowInstructions }) => {
  const [cvView, setCvView] = useState<'analysis' | 'preview'>('analysis');
  const [jd, setJd] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [originalCvText, setOriginalCvText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [analysisResult, setAnalysisResult] = useState<CVAnalysisResult | null>(null);
  const [approvedAdditions, setApprovedAdditions] = useState<string[]>([]);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<FullCVPreviewResult | null>(null);


  const isReadyForAnalysis = useMemo(() => jd.trim().length > 50 && cvFile, [jd, cvFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCvFile(e.target.files[0]);
    }
  };

  const handleAnalyse = async () => {
    if (!isReadyForAnalysis) return;
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setApprovedAdditions([]);
    setPreviewResult(null);
    setCvView('analysis');
    try {
      const { base64, mimeType } = await fileToBase64(cvFile!);
      const cvDoc: DocumentData = { base64, mimeType, name: cvFile!.name };
      // We need the raw text for the preview generation step later
      const cvTextResponse = await new Response(cvFile!).text(); 
      setOriginalCvText(cvTextResponse);

      const result = await geminiService.analyzeCV(jd, cvDoc);
      setAnalysisResult(result);
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
      setError(`Analysis failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleStartOver = () => {
    setCvView('analysis');
    setJd('');
    setCvFile(null);
    setOriginalCvText('');
    setAnalysisResult(null);
    setError(null);
    setIsLoading(false);
    setApprovedAdditions([]);
    setPreviewResult(null);
  };
  
  const handleAdditionToggle = (addition: string) => {
    setApprovedAdditions(prev => 
      prev.includes(addition) ? prev.filter(item => item !== addition) : [...prev, addition]
    );
  };

  const handleGenerateFullCV = async () => {
    if (!analysisResult) return;
    setIsGeneratingPreview(true);
    setError(null);
    try {
        const result = await geminiService.generateFullCVPreview(
            originalCvText,
            analysisResult.suggested_improvements,
            approvedAdditions
        );
        setPreviewResult(result);
        setCvView('preview');
    } catch (err) {
        console.error(err);
        setError("Failed to generate the full CV preview. Please try again.");
        setCvView('analysis'); // Stay on analysis view if generation fails
    } finally {
        setIsGeneratingPreview(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!previewResult) return;
    const element = document.createElement("a");
    const file = new Blob([previewResult.downloadable_cv_markdown], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = "revised_cv.md";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  const renderAnalysisView = () => (
    <div className="max-w-3xl mx-auto">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <SpinnerIcon />
          <p className="text-slate-400 mt-4">Analysing your CV...</p>
        </div>
      ) : analysisResult ? (
        <div className="space-y-6 animate-fade-in">
          <div className="mb-8">
            <button onClick={handleStartOver} className="flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition-colors">
              <ArrowLeftIcon />
              Start a new analysis
            </button>
          </div>
          {error && <div className="mb-6 p-4 bg-red-900/50 border border-red-500/30 rounded-lg text-red-300 text-sm whitespace-pre-wrap">{error}</div>}
          
          {/* Match Score & Explanation */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h3 className="font-semibold mb-3 text-indigo-400">Analysis Result</h3>
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="text-center">
                <p className="text-6xl font-bold text-slate-50">{analysisResult.match_score}</p>
                <p className="text-slate-400 text-sm">/ 100</p>
              </div>
              <div className="flex-1 text-sm text-slate-300 border-t sm:border-t-0 sm:border-l border-slate-700 pt-4 sm:pt-0 sm:pl-6">
                <ul className="list-disc list-inside space-y-1">
                  {analysisResult.match_explanation.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>
          </div>

          {/* Suggested Improvements */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h3 className="font-semibold mb-3 text-green-400">Suggested Improvements</h3>
            <div className="space-y-4">
              {analysisResult.suggested_improvements.map((item, i) => (
                <div key={i} className="text-sm p-4 bg-slate-800/40 rounded-lg border border-slate-700/50">
                  <p><strong className="text-slate-400">Section:</strong> {item.section}</p>
                  <p className="text-slate-500 line-through my-1"><strong className="text-slate-500">Original:</strong> {item.original}</p>
                  <p className="text-green-300"><strong className="text-green-400">Suggested:</strong> {item.suggestion}</p>
                  <p className="text-xs text-indigo-400 mt-2 pt-2 border-t border-slate-700"><strong className="text-indigo-300">Reason:</strong> {item.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Critical Additions */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h3 className="font-semibold mb-3 text-yellow-400">Critical Additions (Not in your CV)</h3>
            <p className="text-xs text-slate-400 mb-4">Select items you have experience with to include them in the final CV.</p>
            <div className="space-y-3">
              {analysisResult.critical_additions.map((addition, i) => (
                <label key={i} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
                    checked={approvedAdditions.includes(addition)}
                    onChange={() => handleAdditionToggle(addition)}
                  />
                  <span className="text-sm text-slate-300">{addition}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="text-center pt-6">
            <button
                onClick={handleGenerateFullCV}
                disabled={isGeneratingPreview}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-lg disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center mx-auto"
            >
                {isGeneratingPreview ? <><SpinnerIcon /> Generating Preview...</> : 'Generate full CV with changes'}
            </button>
          </div>
        </div>
      ) : ( // Initial Input View
        <div className="max-w-2xl mx-auto">
          <div className="space-y-8">
            <div>
              <label htmlFor="jd-suggestions" className="block text-sm font-medium text-slate-300 mb-2">1. Paste Job Description</label>
              <textarea
                id="jd-suggestions"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow resize-none min-h-[250px]"
                placeholder="Paste the full job description here..."
              />
            </div>
            <div>
              <h2 className="block text-sm font-medium text-slate-300 mb-2">2. Upload your CV</h2>
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 text-center flex flex-col items-center justify-center transition-colors hover:border-slate-700">
                <label htmlFor="cv-upload-suggestions" className="cursor-pointer flex flex-col items-center justify-center w-full">
                  <FileUploadIcon />
                  <h3 className="font-semibold mt-4">Upload CV (PDF)</h3>
                  <p className="text-xs text-slate-400 mt-1">{cvFile ? 'File selected:' : 'Click to upload PDF'}</p>
                  {cvFile && <p className="text-xs text-indigo-400 mt-2 font-mono break-all">{cvFile.name}</p>}
                </label>
                <input type="file" id="cv-upload-suggestions" accept=".pdf" className="hidden" onChange={handleFileChange} />
              </div>
            </div>
            {error && <div className="p-4 bg-red-900/50 border border-red-500/30 rounded-lg text-red-300 text-sm whitespace-pre-wrap">{error}</div>}
            <button
              onClick={handleAnalyse}
              disabled={!isReadyForAnalysis || isLoading}
              className="w-full px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-lg disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              Analyse CV against JD
            </button>
          </div>
        </div>
      )}
    </div>
  );
  
  const renderPreviewView = () => (
    <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="mb-8 flex justify-between items-center">
            <button onClick={() => setCvView('analysis')} className="flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition-colors">
                <ArrowLeftIcon />
                Back to Analysis
            </button>
            <button 
                onClick={handleDownloadMarkdown}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-sm transition-colors"
                >
                <DownloadIcon /> Download CV (.md)
            </button>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <span className="h-4 w-4 rounded-sm cv-change-legend flex-shrink-0"></span>
                <p className="text-xs text-slate-400">Highlighted lines show AI-suggested improvements based on the Job Description.</p>
            </div>
            <div 
                className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-h2:my-3 prose-h3:my-3"
                dangerouslySetInnerHTML={{ __html: previewResult?.full_cv_preview_html || '' }} 
            />
        </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">CV Suggestions</h1>
        <p className="text-slate-300 max-w-2xl mx-auto">
          Get expert, AI-powered suggestions to tailor your CV to a specific job description.
        </p>
      </div>

      {cvView === 'analysis' ? renderAnalysisView() : renderPreviewView()}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        .cv-change {
          background: rgba(99, 102, 241, 0.15);
          border-left: 2px solid rgba(99, 102, 241, 0.8);
          padding-left: 0.5rem;
          display: block;
          margin: 0.25rem 0;
        }
        .cv-change-legend {
          background: rgba(99, 102, 241, 0.15);
          border-left: 2px solid rgba(99, 102, 241, 0.8);
        }
      `}</style>
    </div>
  );
};

export default CVSuggestionsView;
