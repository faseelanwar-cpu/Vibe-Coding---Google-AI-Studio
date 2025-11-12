import { GoogleGenAI, Type, Modality } from "@google/genai";
import { InitialInterviewState, InterviewReport, TranscriptTurn, DocumentData, Scores, CVAnalysisResult, SuggestedImprovement, FullCVPreviewResult } from "../types";

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

export const analyzeCV = async (jd: string, cvDoc: DocumentData): Promise<CVAnalysisResult> => {
    const systemInstruction = `You are an elite career coach and ATS specialist, tasked with rewriting and enhancing a candidate's CV to secure a top-tier job interview. Your suggestions must be comprehensive, professional, and directly aligned with the provided job description (JD).

**ZERO-TOLERANCE POLICY FOR HALLUCINATION:**
- You MUST NOT invent facts, figures, employers, projects, or skills not present in the original cv_text.
- Every suggestion MUST be grounded in the candidate's provided history.
- Rephrase and enhance existing achievements; do not create new ones.
- If a key skill from the JD is genuinely missing from the CV, it MUST be listed in 'critical_additions', not woven into existing experience.

**ANALYSIS & REWRITING PROCESS:**
1.  **Deconstruct the JD:** Identify the core role, seniority, key skills (e.g., 'lead generation', 'customer experience'), tools, and domain (e.g., 'B2B SaaS', 'FinTech').
2.  **Deconstruct the CV:** Identify the candidate's roles, employers (e.g., 'WELLFIT', 'FinTech App (Stealth)'), and quantifiable achievements.
3.  **Score Accurately:** Use the provided 5-point rubric to calculate the match_score. Be realistic.
4.  **Rewrite Experience (STAR Method):** For each relevant job in the CV, rewrite the bullet points.
    *   **Identify the Company:** Each suggestion MUST be tied to a specific role. The 'section' field MUST be formatted as "Under [Company Name from CV]".
    *   **Use Strong Verbs:** Start with verbs like 'Spearheaded', 'Engineered', 'Architected', 'Delivered', 'Optimized'.
    *   **Apply STAR Method:** Briefly describe the Situation/Task, detail the Action, and ALWAYS include the Result (%, $, user growth, etc.).
    *   **Incorporate JD Keywords:** Naturally weave keywords from the JD into the rewritten bullets. For example, if the JD wants 'end-to-end Customer Experience' and the CV mentions an omni-channel platform, combine them.
5.  **Generate Professional Summary:** Write a powerful, 3-4 line summary that leads with the target role from the JD and includes the candidate's top skills and achievements.
6.  **Identify Critical Gaps:** Compare the JD's absolute requirements against the CV. Any true gaps go into 'critical_additions'.

**OUTPUT REQUIREMENTS:**
- The final output MUST be a perfect JSON object matching the schema.
- 'suggested_improvements' MUST be an array of objects, each containing 'section', 'original', 'suggestion', and 'reason'.
- The tone must be that of a senior hiring manager providing expert advice.
- The grammar and professionalism must be impeccable, aiming for a 95/100 quality score on every suggestion.`;

    const cvTextResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [ documentToPart(cvDoc), { text: "Extract the full text from this document." } ] }
    });
    const cv_text = cvTextResponse.text;
    
    const userPrompt = `Analyze the provided cv_text against the job_description. Ground every suggestion in the original CV content, identifying the specific company/role for each improvement. Adhere strictly to the system instructions and return the analysis in the specified JSON format.`;

    const response = await ai.models.generateContent({
        model: model,
        contents: {
            parts: [
                { text: `job_description:\n---\n${jd}\n---\n` },
                { text: `\n\ncv_text:\n---\n${cv_text}\n---\n` },
                { text: `\n\nYour task:\n${userPrompt}` }
            ]
        },
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    match_score: { type: Type.INTEGER, description: "The overall match score from 0-100." },
                    match_explanation: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "An array of strings explaining the score, following the rubric."
                    },
                    suggested_improvements: {
                        type: Type.ARRAY,
                        items: { 
                            type: Type.OBJECT,
                            properties: {
                                section: { type: Type.STRING, description: "The CV section, formatted as 'Under [Company Name]' for professional experience." },
                                original: { type: Type.STRING, description: "The original line from the CV, or 'not present'." },
                                suggestion: { type: Type.STRING, description: "The improved, single-line CV bullet, written with a professional, human tone." },
                                reason: { type: Type.STRING, description: "Why this change matters for the JD, explained by an expert." }
                            },
                            required: ["section", "original", "suggestion", "reason"]
                        },
                        description: "An array of structured, expert-level improvement suggestions."
                    },
                    critical_additions: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "An array of missing-but-important items from the JD."
                    }
                },
                required: ["match_score", "match_explanation", "suggested_improvements", "critical_additions"]
            }
        }
    });

    return JSON.parse(response.text);
};


export const generateFullCVPreview = async (
    cv_text: string,
    improvements: SuggestedImprovement[],
    approved_additions: string[]
): Promise<FullCVPreviewResult> => {
    const systemInstruction = `You are a precision text-editing engine. Your task is to perform a mechanical find-and-replace and insertion operation on a given text. You do not have creative freedom.

**ZERO-TOLERANCE HALLUCINATION POLICY:**
- You MUST NOT alter any facts, including company names, dates, and LOCATIONS, that are not part of the explicit 'suggestion' text.
- Your ONLY job is to replace the exact 'original' string with the exact 'suggestion' string, and insert the 'approved_additions'.
- Do NOT "improve" or "correct" any other part of the original cv_text. Preserve it exactly as it is.

**MECHANICAL PROCESS:**
1.  **Start with the original cv_text.**
2.  **For each item in 'suggested_improvements':**
    *   Find the exact string from the 'original' field.
    *   Replace it with the exact string from the 'suggestion' field.
3.  **For each item in 'approved_additions':**
    *   Intelligently insert this new line into the most relevant section of the CV (e.g., a skills addition goes in the skills section, an experience bullet goes under the most relevant job).
4.  **Highlighting:** Wrap EVERY replaced line and EVERY newly inserted line in a specific span tag: <span class="cv-change">...the new line...</span>.
5.  **Formatting:** Preserve the original CV's structure (line breaks, etc.) as closely as possible.
6.  **Output:** Return the final text in the specified JSON format containing the HTML preview and a clean markdown version.`;

    const userPrompt = `Here is the original CV text, the suggested improvements, and the approved critical additions. Reconstruct the full CV with all changes applied and highlighted as requested. Adhere strictly to the zero-tolerance hallucination policy.

Original CV Text:
---
${cv_text}
---

Suggested Improvements to Apply:
---
${JSON.stringify(improvements, null, 2)}
---

Approved Critical Additions to Insert:
---
${approved_additions.join('\n')}
---
`;

    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: userPrompt }] },
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    full_cv_preview_html: { 
                        type: Type.STRING, 
                        description: "The full CV text as an HTML string, with all changed/new lines wrapped in <span class='cv-change'> tags." 
                    },
                    downloadable_cv_markdown: {
                        type: Type.STRING,
                        description: "A clean markdown version of the final CV for download."
                    }
                },
                required: ["full_cv_preview_html", "downloadable_cv_markdown"]
            }
        }
    });

    return JSON.parse(response.text);
};
