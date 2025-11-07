import React, { useState, useEffect, useRef, useCallback } from 'react';
import { InitialInterviewState, InterviewReport, TranscriptTurn } from '../types';
import { generateSpeech, getNextStep, transcribeAudio } from '../services/geminiService';
import { playAudio } from '../utils/audioUtils';
import { MicIcon, SpinnerIcon, StopIcon, SoundWaveIcon } from './icons';

interface InterviewViewProps {
  initialState: InitialInterviewState;
  onFinish: (report: InterviewReport) => void;
}

type InterviewStatus = 'initializing' | 'generating_question' | 'generating_audio' | 'speaking_question' | 'listening' | 'transcribing' | 'processing_answer';

const TOTAL_QUESTIONS = 7; // Assuming an average of 7 questions for progress calculation

const InterviewView: React.FC<InterviewViewProps> = ({ initialState, onFinish }) => {
  const [status, setStatus] = useState<InterviewStatus>('initializing');
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [questionNumber, setQuestionNumber] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const processNextStep = useCallback(async (userAnswer: string | null = null) => {
    const isFirstTurn = transcript.length === 0 && userAnswer === null;
    
    let transcriptForApi = transcript;
    if (userAnswer) {
        setStatus('processing_answer');
        const newTurn: TranscriptTurn = {
            questionNumber: questionNumber,
            question: currentQuestion,
            candidateAnswer: userAnswer,
            quickFeedback: 'Analyzing...',
            scores: { relevance: 0, structure: 0, metrics: 0, alignment: 0, communication: 0 },
            sourceOfQuestion: 'JD'
        };
        transcriptForApi = [...transcript, newTurn];
        setTranscript(transcriptForApi);
    } else {
        setStatus('generating_question');
    }
    
    try {
        const response = await getNextStep(initialState, transcriptForApi, userAnswer);
      
        if (response.interviewComplete) {
            onFinish(response.finalReport!);
            return;
        }

        if (response.currentAnswerAnalysis) {
            setTranscript(prev => {
                const updatedTranscript = [...prev];
                const lastTurn = updatedTranscript[updatedTranscript.length - 1];
                if (lastTurn) {
                    lastTurn.quickFeedback = response.currentAnswerAnalysis.quickFeedback;
                    lastTurn.scores = response.currentAnswerAnalysis.scores;
                    lastTurn.sourceOfQuestion = response.currentAnswerAnalysis.sourceOfQuestion;
                }
                return updatedTranscript;
            });
        }
        
        const { question, questionNumber: newQuestionNum } = response.nextQuestion!;
        setCurrentQuestion(question);
        setQuestionNumber(newQuestionNum);
        
        setStatus('generating_audio');
        const audioBase64 = await generateSpeech(question);
        
        setStatus('speaking_question');
        await playAudio(audioBase64);
        
        setStatus('listening');
        mediaRecorderRef.current?.start();

    } catch (error) {
        console.error("Error processing next step:", error);
        setPermissionError("An error occurred during the interview. Please try again.");
    }
  }, [initialState, transcript, onFinish, questionNumber, currentQuestion]);

  const processNextStepRef = useRef(processNextStep);
  useEffect(() => {
    processNextStepRef.current = processNextStep;
  });

  const stopRecordingAndProcess = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
  }, []);

  useEffect(() => {
    async function initializeInterview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          setStatus('transcribing');
          setTranscriptionError(null);
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];
          
          if (audioBlob.size === 0) {
            setTranscriptionError("I couldn't hear a valid answer. Please try answering again.");
            setStatus('listening');
            mediaRecorderRef.current?.start();
            return;
          }
          
          try {
            const transcribedText = await transcribeAudio(audioBlob);
            const isInvalid = !transcribedText || transcribedText.trim().length < 5 || transcribedText.toLowerCase().includes("this is my transcribed answer");

            if (isInvalid) {
              setTranscriptionError("I couldn't hear a valid answer. Please try answering again.");
              setStatus('listening');
              mediaRecorderRef.current?.start();
            } else {
              processNextStepRef.current(transcribedText);
            }
          } catch (error) {
            console.error("Transcription error:", error);
            setTranscriptionError("There was an error transcribing your answer. Please try again.");
            setStatus('listening');
            mediaRecorderRef.current?.start();
          }
        };

        processNextStepRef.current();

      } catch (err) {
        console.error("Microphone access error:", err);
        setPermissionError("Microphone access is required for the interview. Please allow access in your browser settings and refresh the page.");
      }
    }
    
    initializeInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const getStatusMessage = () => {
    switch(status) {
      case 'initializing': return "Initializing interview...";
      case 'generating_question': return "Generating first question...";
      case 'generating_audio': return "Generating audio, please wait...";
      case 'speaking_question': return "Listen to the question...";
      case 'listening': return "Listening for your answer...";
      case 'transcribing': return "Transcribing your answer...";
      case 'processing_answer': return "Analyzing your answer...";
      default: return "Please wait...";
    }
  };

  if (permissionError) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] text-center">
        <h2 className="text-2xl font-semibold text-red-400 mb-4">Permission Denied</h2>
        <p className="text-slate-300">{permissionError}</p>
      </div>
    );
  }
  
  const progressPercentage = questionNumber > 0 ? Math.min(100, (questionNumber / TOTAL_QUESTIONS) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="w-full bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center">
            {status === 'initializing' || status === 'generating_question' || (status === 'processing_answer' && !currentQuestion) || status === 'generating_audio' ? (
                 <div className="flex flex-col items-center justify-center h-64">
                    <SpinnerIcon />
                    <p className="text-slate-400 mt-4">{getStatusMessage()}</p>
                 </div>
            ) : (
                <>
                <div className="mb-6">
                    <div className="flex justify-between items-center text-sm text-slate-400 mb-2">
                        <span>Interview Progress</span>
                        <span>{Math.round(progressPercentage)}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                        <div
                            className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercentage}%` }}
                        ></div>
                    </div>
                </div>

                <p className="text-sm text-slate-400 mb-2">Question {questionNumber} of {TOTAL_QUESTIONS}</p>
                <h1 className="text-2xl font-semibold text-slate-50">
                    "{currentQuestion}"
                </h1>
                
                {transcriptionError && (
                    <div className="my-4 text-yellow-300 text-sm p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg transition-opacity duration-300">
                        {transcriptionError}
                    </div>
                )}

                <div className="my-8 h-20 flex items-center justify-center">
                    {status === 'listening' ? <SoundWaveIcon /> : <p className="text-slate-400">{getStatusMessage()}</p>}
                </div>

                <button
                    onClick={stopRecordingAndProcess}
                    disabled={status !== 'listening'}
                    className="h-20 w-20 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 mx-auto transition-all disabled:bg-slate-700 disabled:shadow-none"
                    aria-label="Stop recording"
                >
                    {status === 'listening' ? <StopIcon /> : <MicIcon />}
                </button>
                <p className="text-xs text-slate-500 mt-4">
                  {status === 'listening' ? 'Click the button when you have finished your answer.' : 'Prepare to answer the next question.'}
                </p>
                </>
            )}
        </div>
        <div className="mt-6 text-sm text-slate-500">
            Transcript and scores will be available at the end of the session.
        </div>
    </div>
  );
};

export default InterviewView;