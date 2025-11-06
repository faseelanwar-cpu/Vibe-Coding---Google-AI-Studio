import { GoogleGenAI, Type, Modality } from "@google/genai";
import { InitialInterviewState, InterviewReport, TranscriptTurn, DocumentData, Scores } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = "gemini-2.5-pro";

// Utility function to convert DocumentData to Gemini Part
const documentToPart = (doc: DocumentData) => ({
  inlineData: {
    data: doc.base64,
    mimeType: doc.mimeType,
  },
});

export const generateSpeech = async (text: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say this in a clear, professional voice: ${text}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Failed to generate audio from text.");
    }
    return base64Audio;
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const base64Audio = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: audioBlob.type || 'audio/webm', data: base64Audio } },
        { text: "Transcribe the user's speech accurately. Provide only the transcribed text." }
      ]
    }
  });
  return response.text;
}


export const getNextStep = async (
    initialState: InitialInterviewState, 
    transcript: TranscriptTurn[],
    userAnswer: string | null
): Promise<{ 
    interviewComplete: boolean; 
    nextQuestion?: { question: string; questionNumber: number };
    currentAnswerAnalysis?: { quickFeedback: string; scores: Scores; sourceOfQuestion: 'JD' | 'CandidateProfile' | 'Mixed' };
    finalReport?: InterviewReport;
}> => {
    const isFirstTurn = transcript.length === 0 && userAnswer === null;

    const systemInstruction = `You are Interview Coach Pro, an AI designed to conduct realistic job interviews. Your goal is to help candidates practice.
- You must use BOTH the provided job description and the candidate's documents (CV/LinkedIn) to ask relevant questions.
- Ask 6-8 questions in total. At least 2-3 questions must be based specifically on the candidate's profile.
- Ask one question at a time. Do not answer for the candidate.
- After each answer, provide a score and brief feedback, then the next question.
- After the last question, provide a full final report.
- Maintain a professional and encouraging tone.
- Your responses MUST be in the specified JSON format.`;

    let userPrompt = '';
    const parts = [];

    if (isFirstTurn) {
        userPrompt = `Start the interview. The job description is provided. The candidate has uploaded their documents. Generate the first question based on this context.`;
    } else {
        userPrompt = `Here is the candidate's answer to the previous question: "${userAnswer}".
        Analyze the answer in the context of the full interview so far.
        If the interview is complete (6-8 questions asked), generate the final report.
        Otherwise, provide feedback and scores for this answer, and generate the next question.`;
    }

    parts.push({ text: `Job Description:\n${initialState.jd}\n\n`});
    if(initialState.cv) parts.push(documentToPart(initialState.cv));
    if(initialState.linkedIn) parts.push(documentToPart(initialState.linkedIn));
    
    parts.push({ text: `\n\nFull transcript so far:\n${JSON.stringify(transcript, null, 2)}` });
    parts.push({ text: `\n\n---\n\nYour task:\n${userPrompt}` });

    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: parts },
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    interviewComplete: { type: Type.BOOLEAN },
                    nextQuestion: {
                        type: Type.OBJECT,
                        properties: {
                            questionNumber: { type: Type.INTEGER },
                            question: { type: Type.STRING },
                            sourceOfQuestion: { type: Type.STRING, enum: ['JD', 'CandidateProfile', 'Mixed'] },
                        },
                    },
                    currentAnswerAnalysis: {
                        type: Type.OBJECT,
                        properties: {
                            quickFeedback: { type: Type.STRING },
                            scores: {
                                type: Type.OBJECT,
                                properties: {
                                    relevance: { type: Type.INTEGER },
                                    structure: { type: Type.INTEGER },
                                    metrics: { type: Type.INTEGER },
                                    alignment: { type: Type.INTEGER },
                                    communication: { type: Type.INTEGER },
                                }
                            }
                        }
                    },
                    finalReport: {
                        type: Type.OBJECT,
                        properties: {
                           summary: {
                                type: Type.OBJECT,
                                properties: {
                                    companyDetected: { type: Type.STRING },
                                    roleDetected: { type: Type.STRING },
                                    overallScore: { type: Type.INTEGER },
                                    topStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    topImprovements: { 
                                        type: Type.ARRAY, 
                                        items: { 
                                            type: Type.OBJECT, 
                                            properties: {
                                                point: {type: Type.STRING},
                                                suggestion: {type: Type.STRING}
                                            }
                                        } 
                                    },
                                }
                           },
                           downloadableTranscriptMarkdown: { type: Type.STRING },
                           downloadableReportText: { type: Type.STRING },
                        }
                    }
                }
            }
        }
    });
    
    const jsonResponse = JSON.parse(response.text);

    if (jsonResponse.interviewComplete && jsonResponse.finalReport) {
        const finalTranscript = transcript.map((turn, index) => {
            if (index === transcript.length - 1 && jsonResponse.currentAnswerAnalysis) {
                return {
                    ...turn,
                    quickFeedback: jsonResponse.currentAnswerAnalysis.quickFeedback,
                    scores: jsonResponse.currentAnswerAnalysis.scores,
                };
            }
            return turn;
        });
        
        jsonResponse.finalReport.transcript = finalTranscript;
        return { interviewComplete: true, finalReport: jsonResponse.finalReport };
    }

    let currentAnswerAnalysis;
    if (!isFirstTurn && jsonResponse.currentAnswerAnalysis) {
        currentAnswerAnalysis = {
            quickFeedback: jsonResponse.currentAnswerAnalysis.quickFeedback,
            scores: jsonResponse.currentAnswerAnalysis.scores,
            sourceOfQuestion: jsonResponse.nextQuestion.sourceOfQuestion,
        }
    }

    return {
        interviewComplete: false,
        nextQuestion: jsonResponse.nextQuestion,
        currentAnswerAnalysis: currentAnswerAnalysis,
    };
};