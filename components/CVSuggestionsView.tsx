
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DocumentData, CVAnalysisResult, FullCVPreviewResult, CandidateProfile } from '../types';
import { fileToBase64 } from '../utils/fileUtils';
import { getCandidateProfile, saveGeneratedCV } from '../services/dbService';
import * as geminiService from '../services/geminiService';
import * as pdfService from '../services/pdfService';
import { FileUploadIcon, SpinnerIcon, ArrowLeftIcon, DownloadIcon, UserIcon, CheckCircleIcon } from './icons';

interface CVSuggestionsViewProps {
  onShowInstructions: () => void;
  initialAnalysis: CVAnalysisResult | null;
  onAnalysisComplete: (result: CVAnalysisResult, jdSnippet: string) => void;
  onReset: () => void;
}

const CVSuggestionsView: React.FC<CVSuggestionsViewProps> = ({ onShowInstructions, initialAnalysis, onAnalysisComplete, onReset }) => {
  const [jd, setJd] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [originalCvText, setOriginalCvText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [analysisResult, setAnalysisResult] = useState<CVAnalysisResult | null>(null);
  const [approvedAdditions, setApprovedAdditions] = useState<string[]>([]);
  const [approvedKeywords, setApprovedKeywords] = useState<string[]>([]);
  
  // PDF Preview State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [previewResult, setPreviewResult] = useState<FullCVPreviewResult | null>(null); // Keep for latex source

  // Profile State
  const [useProfile, setUseProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState<CandidateProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const email = localStorage.getItem('icp_user_email');
      if (email) {
          getCandidateProfile(email).then(p => {
              setSavedProfile(p);
              setLoadingProfile(false);
              if (p && p.experience.length > 0) setUseProfile(true);
          });
      } else {
          setLoadingProfile(false);
      }
  }, []);

  // Load historical data
  useEffect(() => {
      if (initialAnalysis) {
          setAnalysisResult(initialAnalysis);
      } else {
          setAnalysisResult(null);
      }
  }, [initialAnalysis]);

  const isReadyForAnalysis = useMemo(() => {
      const hasContext = useProfile ? !!savedProfile : !!cvFile;
      return jd.trim().length > 50 && hasContext;
  }, [jd, cvFile, useProfile, savedProfile]);

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
    setApprovedKeywords([]);
    setPdfUrl(null);
    setPdfBlob(null);
    
    try {
      let inputData: DocumentData | CandidateProfile;

      if (useProfile && savedProfile) {
          inputData = savedProfile;
      } else if (cvFile) {
          const { base64, mimeType } = await fileToBase64(cvFile);
          inputData = { base64, mimeType, name: cvFile.name };
      } else {
          throw new Error("No CV input provided");
      }

      const result = await geminiService.analyzeCV(jd, inputData);
      
      if (result.extracted_text) {
          setOriginalCvText(result.extracted_text);
      }
      
      setAnalysisResult(result);
      onAnalysisComplete(result, jd);

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
      setError(`Analysis failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleStartOver = () => {
    setJd('');
    setCvFile(null);
    setOriginalCvText('');
    setAnalysisResult(null);
    setError(null);
    setIsLoading(false);
    setApprovedAdditions([]);
    setApprovedKeywords([]);
    setPdfUrl(null);
    setPdfBlob(null);
    onReset();
  };
  
  const handleAdditionToggle = (addition: string) => {
    setApprovedAdditions(prev => 
      prev.includes(addition) ? prev.filter(item => item !== addition) : [...prev, addition]
    );
  };

  const handleKeywordToggle = (keyword: string) => {
    setApprovedKeywords(prev => 
      prev.includes(keyword) ? prev.filter(item => item !== keyword) : [...prev, keyword]
    );
  };

  const handleGenerateFullCV = async () => {
    if (!analysisResult) return;
    
    if (!originalCvText && initialAnalysis) {
        setError("Cannot generate preview from historical data (original CV text not saved). Please start a new analysis.");
        return;
    }

    setIsGeneratingPdf(true);
    setError(null);
    setPdfUrl(null); // Clear previous

    try {
        // Create a timeout promise to prevent infinite loading
        // Gemini 3 Pro can be slow, giving it 3 minutes (180000ms)
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Generation timed out. The server is busy, please try again.")), 180000);
        });

        // 1. Get structured data from AI
        const generationPromise = geminiService.generateFullCVPreview(
            originalCvText || "CV Content Placeholder", 
            analysisResult.suggested_improvements,
            approvedAdditions,
            approvedKeywords
        );

        const result = await Promise.race([generationPromise, timeoutPromise]) as FullCVPreviewResult;
        setPreviewResult(result);

        // 2. Generate PDF Blob immediately
        const blob = await pdfService.generatePDF(result.structured_cv);
        setPdfBlob(blob);
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);

        // 3. Save to DB in background
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64data = reader.result as string;
            const email = localStorage.getItem('icp_user_email');
            if (email) {
                await saveGeneratedCV(email, base64data);
            }
        };

        // Scroll to preview
        setTimeout(() => {
            previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

    } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to generate the PDF.");
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  const handleDownloadPDF = () => {
      if (!pdfUrl) return;
      const a = document.createElement('a');
      a.href = pdfUrl;
      const name = previewResult?.structured_cv.personalInfo.name?.replace(/\s+/g, '_') || 'CV';
      a.download = `${name}_Resume.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const handleDownloadLatex = () => {
    if (!previewResult?.latex_source) return;
    const element = document.createElement("a");
    const file = new Blob([previewResult.latex_source], {type: 'application/x-tex'});
    element.href = URL.createObjectURL(file);
    element.download = "cv_source.tex";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };
  
  const handleOpenInNewTab = () => {
      if (pdfUrl) {
          window.open(pdfUrl, '_blank');
      }
  };

  const renderAnalysisView = () => (
    <div className="max-w-3xl mx-auto">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <SpinnerIcon />
          <p className="text-slate-400 mt-4">Analysing your profile with advanced AI...</p>
        </div>
      ) : analysisResult ? (
        <div className="space-y-6 animate-fade-in">
          <div className="mb-8 flex justify-between items-center">
            <button onClick={handleStartOver} className="flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition-colors">
              <ArrowLeftIcon />
              Start a new analysis
            </button>
             {initialAnalysis && <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">Viewing Historical Result</span>}
          </div>
          {error && <div className="mb-6 p-4 bg-red-900/50 border border-red-500/30 rounded-lg text-red-300 text-sm whitespace-pre-wrap">{error}</div>}
          
          {/* Match Score */}
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
                  <div className="flex justify-between items-start mb-2">
                      <p className="font-medium text-slate-400">Section: {item.section}</p>
                      {item.confidence_score !== undefined && (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                              item.confidence_score >= 80 ? 'bg-green-500/20 text-green-300' : 
                              item.confidence_score >= 50 ? 'bg-yellow-500/20 text-yellow-300' : 
                              'bg-red-500/20 text-red-300'
                          }`}>
                              {item.confidence_score}% confidence
                          </span>
                      )}
                  </div>
                  <p className="text-slate-500 line-through my-1"><strong className="text-slate-500">Original:</strong> {item.original}</p>
                  <p className="text-green-300"><strong className="text-green-400">Suggested:</strong> {item.suggestion}</p>
                  <p className="text-xs text-indigo-400 mt-2 pt-2 border-t border-slate-700"><strong className="text-indigo-300">Reason:</strong> {item.reason}</p>
                </div>
              ))}
            </div>
          </div>

           {/* Missing Keywords */}
           {analysisResult.missing_keywords && analysisResult.missing_keywords.length > 0 && (
               <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                   <h3 className="font-semibold mb-3 text-blue-400">Missing ATS Keywords</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       {analysisResult.missing_keywords.map((item, i) => (
                           <label key={i} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-600">
                               <input
                                   type="checkbox"
                                   className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
                                   checked={approvedKeywords.includes(item.keyword)}
                                   onChange={() => handleKeywordToggle(item.keyword)}
                               />
                               <div className="flex-1 flex justify-between items-center">
                                   <span className="text-sm text-slate-300">{item.keyword}</span>
                                   <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.importance === 'High' ? 'bg-red-500/20 text-red-300' : 'bg-slate-700 text-slate-400'}`}>
                                       {item.importance}
                                   </span>
                               </div>
                           </label>
                       ))}
                   </div>
               </div>
           )}

          {/* Critical Additions */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h3 className="font-semibold mb-3 text-yellow-400">Critical Additions</h3>
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

          <div className="text-center pt-6 pb-12">
            {!initialAnalysis && (
                <button
                    onClick={handleGenerateFullCV}
                    disabled={isGeneratingPdf}
                    className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-lg disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center mx-auto shadow-lg shadow-indigo-900/20"
                >
                    {isGeneratingPdf ? <><SpinnerIcon /> Generating PDF (This may take a minute)...</> : 'Generate PDF Resume'}
                </button>
            )}
          </div>
        </div>
      ) : ( // Initial Input View
        <div className="max-w-2xl mx-auto">
          {/* ... [Initial Input View code remains same] ... */}
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
              <h2 className="block text-sm font-medium text-slate-300 mb-2">2. Your Background</h2>
               <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 mb-4">
                   <button 
                       onClick={() => setUseProfile(true)}
                       className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${useProfile ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                   >
                       <UserIcon /> Use Saved Profile
                   </button>
                   <button 
                       onClick={() => setUseProfile(false)}
                       className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${!useProfile ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                   >
                       <FileUploadIcon /> Upload PDF
                   </button>
               </div>

               <div className="flex-grow">
                 {useProfile ? (
                     <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
                         {loadingProfile ? (
                             <SpinnerIcon />
                         ) : savedProfile ? (
                             <>
                                 <div className="h-12 w-12 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-300 mb-3">
                                     <UserIcon />
                                 </div>
                                 <h3 className="font-semibold">{savedProfile.personalInfo.name}</h3>
                                 <p className="text-slate-400 text-sm mb-4">{savedProfile.experience.length} Roles | {savedProfile.skills.length} Skills</p>
                                 <div className="flex items-center gap-2 text-green-400 text-xs">
                                    <CheckCircleIcon />
                                    <span>Ready to analyze</span>
                                 </div>
                             </>
                         ) : (
                             <>
                                <p className="text-slate-400 mb-4">No profile saved.</p>
                                <p className="text-xs text-slate-500">Go to the "Profile" tab to parse your CV.</p>
                             </>
                         )}
                     </div>
                 ) : (
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 text-center flex flex-col items-center justify-center hover:border-slate-700 transition-colors min-h-[200px]">
                      <label htmlFor="cv-upload-analysis" className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                        <FileUploadIcon />
                        <h3 className="font-semibold mt-4">Upload CV (PDF)</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          {cvFile ? 'File selected:' : 'Click to upload'}
                        </p>
                        {cvFile && <p className="text-xs text-indigo-400 mt-2 font-mono">{cvFile.name}</p>}
                      </label>
                      <input type="file" id="cv-upload-analysis" accept=".pdf" className="hidden" onChange={handleFileChange} />
                    </div>
                 )}
               </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={handleAnalyse}
              disabled={!isReadyForAnalysis || isLoading}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-lg disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center mx-auto shadow-lg shadow-indigo-900/20"
            >
              {isLoading ? (
                <>
                  <SpinnerIcon />
                  Analyzing Profile...
                </>
              ) : 'Analyze & Improve CV'}
            </button>
            {error && <p className="text-red-400 mt-4">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="relative text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          CV Suggestions
        </h1>
        <p className="text-slate-300 max-w-2xl mx-auto">
          Get expert, AI-powered suggestions to tailor your profile to a specific job description.
        </p>
         <button 
            onClick={onShowInstructions} 
            className="absolute top-0 right-0 text-sm text-slate-400 hover:text-indigo-400 transition-colors px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600"
          >
            Instructions
          </button>
      </div>

      {renderAnalysisView()}

      {/* PDF Viewer Section */}
      {pdfUrl && (
        <div ref={previewRef} className="mt-16 border-t border-slate-800 pt-12 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-50">CV Ready</h2>
                    <p className="text-slate-400">Review your optimized, ATS-friendly PDF below.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleOpenInNewTab}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-sm transition-colors text-slate-300"
                    >
                        <DownloadIcon /> Open New Tab
                    </button>
                    <button 
                        onClick={handleDownloadLatex}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-sm transition-colors"
                    >
                        <DownloadIcon /> LaTeX Source
                    </button>
                    <button 
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        <DownloadIcon /> Download PDF
                    </button>
                </div>
            </div>

            {/* PDF Viewer - Using Object Tag for better compatibility */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl h-[800px]">
                <object
                    data={pdfUrl}
                    type="application/pdf"
                    className="w-full h-full"
                    aria-label="CV Preview"
                >
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                        <p className="mb-4">Your browser doesn't support inline PDF viewing.</p>
                        <button 
                            onClick={handleOpenInNewTab}
                            className="px-4 py-2 bg-indigo-600 rounded text-white text-sm"
                        >
                            Click to View PDF
                        </button>
                    </div>
                </object>
            </div>
        </div>
      )}
    </div>
  );
};

export default CVSuggestionsView;
