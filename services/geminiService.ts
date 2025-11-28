
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { InitialInterviewState, InterviewReport, TranscriptTurn, DocumentData, Scores, CVAnalysisResult, SuggestedImprovement, FullCVPreviewResult, CandidateProfile } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// We use Flash for quick tasks (TTS, Parsing) and Pro for complex reasoning (Analysis, Rewriting)
const FAST_MODEL = "gemini-2.5-flash"; 
const QUALITY_MODEL = "gemini-3-pro-preview"; 

// Helper for retry logic to handle transient network/RPC errors
async function retryOperation<T>(operation: () => Promise<T>, retries = 2, delay = 2000): Promise<T> {
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            console.warn(`Gemini API Attempt ${i + 1} failed:`, error);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1))); // Exponential backoff
        }
    }
    throw new Error('Operation failed after retries');
}

const documentToPart = (doc: DocumentData) => ({
  inlineData: {
    data: doc.base64,
    mimeType: doc.mimeType,
  },
});

export const profileToText = (profile: CandidateProfile): string => {
    let text = `Name: ${profile.personalInfo.name}\nEmail: ${profile.personalInfo.email}\n`;
    
    if (profile.personalInfo.phone) text += `Phone: ${profile.personalInfo.phone}\n`;
    if (profile.personalInfo.location) text += `Location: ${profile.personalInfo.location}\n`;
    if (profile.personalInfo.linkedin) text += `LinkedIn: ${profile.personalInfo.linkedin}\n`;
    if (profile.personalInfo.portfolio) text += `Portfolio: ${profile.personalInfo.portfolio}\n`;
    
    text += `\nPROFESSIONAL SUMMARY\n${profile.summary}\n\n`;
    
    text += `EXPERIENCE\n`;
    profile.experience.forEach(exp => {
        const desc = Array.isArray(exp.description) ? exp.description.join('\n- ') : exp.description;
        text += `${exp.role} at ${exp.company} (${exp.startDate} - ${exp.endDate})\n${desc}\n\n`;
    });

    text += `EDUCATION\n`;
    profile.education.forEach(edu => {
        const desc = Array.isArray(edu.description) ? edu.description.join('\n- ') : edu.description;
        text += `${edu.degree} in ${edu.major} from ${edu.institution} (${edu.startDate} - ${edu.endDate})\n${desc}\n`;
    });

    text += `\nSKILLS\n${profile.skills.join(', ')}\n`;

    if (profile.projects && profile.projects.length > 0) {
        text += `\nPROJECTS\n`;
        profile.projects.forEach(p => {
             const desc = Array.isArray(p.description) ? p.description.join('\n- ') : p.description;
             text += `${p.name}: ${desc} ${p.link ? `(${p.link})` : ''}\n`;
        });
    }
    
    if (profile.certifications && profile.certifications.length > 0) {
         text += `\nCERTIFICATIONS\n`;
         profile.certifications.forEach(c => {
             text += `${c.name} - ${c.issuer} (${c.startDate})`;
             if (c.credentialId) text += ` ID: ${c.credentialId}`;
             if (c.url) text += ` URL: ${c.url}`;
             text += `\n`;
         });
    }

    return text;
};

export const generateSpeech = async (text: string): Promise<string> => {
    return retryOperation(async () => {
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
    });
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const base64Audio = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  return retryOperation(async () => {
      const response = await ai.models.generateContent({
        model: FAST_MODEL,
        contents: {
          parts: [
            { inlineData: { mimeType: audioBlob.type || 'audio/webm', data: base64Audio } },
            { text: "Transcribe the user's speech accurately. Provide only the transcribed text." }
          ]
        }
      });
      return response.text || "";
  });
}

export const parseCVToProfile = async (cvDoc: DocumentData): Promise<CandidateProfile> => {
    const systemInstruction = `You are an expert data extraction AI. Extract information from the provided CV document into a structured JSON format.
    
    Rules:
    - Extract exact dates where possible (Month Year).
    - If a field is missing, leave it as an empty string or empty array.
    - For 'description' in experience/education, combine bullet points into a coherent block.
    - Separate Degree and Major in Education.
    - Extract full details for Certifications including issuer and dates.
    `;

    return retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: FAST_MODEL, // Parsing is a structural task, Flash is sufficient and fast
            contents: {
                parts: [
                    documentToPart(cvDoc),
                    { text: "Extract the structured candidate profile." }
                ]
            },
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        personalInfo: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                email: { type: Type.STRING },
                                phone: { type: Type.STRING },
                                linkedin: { type: Type.STRING },
                                location: { type: Type.STRING },
                                portfolio: { type: Type.STRING },
                            },
                            required: ["name", "email"]
                        },
                        summary: { type: Type.STRING },
                        experience: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    company: { type: Type.STRING },
                                    role: { type: Type.STRING },
                                    startDate: { type: Type.STRING },
                                    endDate: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                },
                                required: ["company", "role", "description"]
                            }
                        },
                        education: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    institution: { type: Type.STRING },
                                    degree: { type: Type.STRING },
                                    major: { type: Type.STRING },
                                    startDate: { type: Type.STRING },
                                    endDate: { type: Type.STRING },
                                    description: { type: Type.STRING }
                                }
                            }
                        },
                        skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                        projects: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    link: { type: Type.STRING }
                                }
                            }
                        },
                        certifications: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    issuer: { type: Type.STRING },
                                    startDate: { type: Type.STRING },
                                    expirationDate: { type: Type.STRING },
                                    credentialId: { type: Type.STRING },
                                    url: { type: Type.STRING }
                                }
                            }
                        }
                    },
                    required: ["personalInfo", "experience", "education", "skills"]
                }
            }
        });

        const text = response.text || "{}";
        const data = JSON.parse(text) as CandidateProfile;
        
        const genId = () => Math.random().toString(36).substr(2, 9);
        if (data.experience) data.experience.forEach(e => e.id = e.id || genId());
        if (data.education) data.education.forEach(e => e.id = e.id || genId());
        if (data.projects) data.projects.forEach(e => e.id = e.id || genId());
        if (data.certifications) data.certifications.forEach(e => e.id = e.id || genId());

        return data;
    });
};

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
- You must use BOTH the provided job description and the candidate's documents (CV/LinkedIn/Profile) to ask relevant questions.
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
    
    if (initialState.cv) {
        parts.push(documentToPart(initialState.cv));
    } else if (initialState.profileData) {
        const profileText = profileToText(initialState.profileData);
        parts.push({ text: `Candidate Profile Data:\n${profileText}\n`});
    }
    
    if(initialState.linkedIn) parts.push(documentToPart(initialState.linkedIn));
    
    parts.push({ text: `\n\nFull transcript so far:\n${JSON.stringify(transcript, null, 2)}` });
    parts.push({ text: `\n\n---\n\nYour task:\n${userPrompt}` });

    return retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: QUALITY_MODEL, // Interview logic requires high reasoning capabilities
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
        
        const text = response.text || "{}";
        const jsonResponse = JSON.parse(text);
        
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
    });
};

export const analyzeCV = async (jd: string, cvInput: DocumentData | CandidateProfile): Promise<CVAnalysisResult> => {
    const systemInstruction = `You are an elite career coach and ATS specialist, tasked with rewriting and enhancing a candidate's CV.
    
    GOAL: Compare the CV against the Job Description (JD). 
    
    TASKS:
    1.  **Match Score:** Calculate a match score (0-100) based on skills, experience, and keywords.
    2.  **Explanation:** Explain the score with 3-5 key points.
    3.  **Improvements:** Identify 3-5 specific sections to improve. 
        -   Provide the *original* text.
        -   Provide a *rewritten suggestion* that uses strong action verbs and metrics.
        -   Explain *why* the change helps (Reason).
        -   Assign a confidence score to your suggestion.
    4.  **Critical Additions:** List missing skills or experiences that are crucial for the JD.
    5.  **Keywords:** List missing ATS keywords and their importance (High/Medium).
    
    **OUTPUT REQUIREMENTS:**
    - The final output MUST be a perfect JSON object matching the schema.
    `;

    let cv_text = "";
    if ('base64' in cvInput) {
        const cvTextResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: FAST_MODEL, // Flash is great for simple extraction
            contents: { parts: [ documentToPart(cvInput), { text: "Extract the full text from this document. Preserve the structure." } ] }
        }));
        cv_text = cvTextResponse.text || "";
    } else {
        cv_text = profileToText(cvInput);
    }
    
    const userPrompt = `Analyze the provided cv_text against the job_description. Ground every suggestion in the original CV content, identifying the specific company/role for each improvement. Identify ATS keywords that are missing. Adhere strictly to the system instructions and return the analysis in the specified JSON format.`;

    return retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: QUALITY_MODEL, // Use Pro for deep analysis and reasoning
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
                            description: "An array of strings explaining the score."
                        },
                        suggested_improvements: {
                            type: Type.ARRAY,
                            items: { 
                                type: Type.OBJECT,
                                properties: {
                                    section: { type: Type.STRING },
                                    original: { type: Type.STRING },
                                    suggestion: { type: Type.STRING },
                                    reason: { type: Type.STRING },
                                    confidence_score: { type: Type.INTEGER }
                                },
                                required: ["section", "original", "suggestion", "reason", "confidence_score"]
                            }
                        },
                        critical_additions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        missing_keywords: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    keyword: { type: Type.STRING },
                                    importance: { type: Type.STRING, enum: ['High', 'Medium'] }
                                }
                            }
                        }
                    },
                    required: ["match_score", "match_explanation", "suggested_improvements", "critical_additions", "missing_keywords"]
                }
            }
        });

        const text = response.text || "{}";
        const result = JSON.parse(text);
        return { ...result, extracted_text: cv_text };
    });
};

export const generateFullCVPreview = async (
    originalCvText: string,
    suggestedImprovements: SuggestedImprovement[],
    approvedAdditions: string[],
    approvedKeywords: string[]
): Promise<FullCVPreviewResult> => {

    const systemInstruction = `You are an expert executive resume writer. Your goal is to **TRANSFORM** a candidate's CV into a high-impact, ATS-optimized document.

    **CRITICAL INSTRUCTIONS - READ CAREFULLY:**
    
    1.  **NO HALLUCINATIONS:** You must NOT invent new roles, companies, or dates. Use the existing work history structure from the original CV text.
    2.  **IMPROVE, DON'T INVENT:** Your job is to rewrite the *descriptions* of existing roles to be more impactful.
    3.  **BULLET POINTS:** Rewrite every description into a list of **distinct, punchy bullet points**. 
        -   **Format:** Return them as an ARRAY of strings.
        -   **Style:** Start with a strong Power Verb (e.g., "Orchestrated", "Engineered").
        -   **Structure:** Use "Action + Task + Result" format where possible.
        -   **Length:** Each bullet should be 1-2 lines maximum.
        -   **No Fluff:** Remove generic phrases like "Responsible for".
    4.  **MANDATORY FIELDS:** Ensure Name, Email, Phone, LinkedIn, and Location are preserved.
    5.  **INTEGRATION:** Seamlessly integrate the provided "Suggested Improvements" and "Keywords" into the bullet points of the relevant roles.
    `;

    const userPrompt = `
    ORIGINAL CV TEXT:
    """
    ${originalCvText}
    """

    SUGGESTED IMPROVEMENTS TO INTEGRATE:
    ${JSON.stringify(suggestedImprovements, null, 2)}

    ADD THESE CRITICAL ITEMS (If applicable to existing roles):
    ${JSON.stringify(approvedAdditions, null, 2)}

    WEAVE IN THESE KEYWORDS:
    ${JSON.stringify(approvedKeywords, null, 2)}
    `;

    return retryOperation(async () => {
        // Using GEMINI 3 PRO PREVIEW as requested for maximum quality.
        // NOTE: This model is slower, so client-side timeout must be high.
        const response = await ai.models.generateContent({
            model: QUALITY_MODEL, 
            contents: { parts: [{ text: userPrompt }] },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        latex_source: { type: Type.STRING }, 
                        structured_cv: {
                            type: Type.OBJECT,
                            properties: {
                                personalInfo: {
                                    type: Type.OBJECT,
                                    properties: {
                                        name: { type: Type.STRING },
                                        email: { type: Type.STRING },
                                        phone: { type: Type.STRING },
                                        linkedin: { type: Type.STRING },
                                        location: { type: Type.STRING },
                                        portfolio: { type: Type.STRING },
                                    },
                                    required: ["name", "email"]
                                },
                                summary: { type: Type.STRING },
                                experience: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            id: { type: Type.STRING },
                                            company: { type: Type.STRING },
                                            role: { type: Type.STRING },
                                            startDate: { type: Type.STRING },
                                            endDate: { type: Type.STRING },
                                            description: { 
                                                type: Type.ARRAY,
                                                items: { type: Type.STRING },
                                                description: "List of bullet points"
                                            },
                                        },
                                        required: ["company", "role", "description"]
                                    }
                                },
                                education: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            id: { type: Type.STRING },
                                            institution: { type: Type.STRING },
                                            degree: { type: Type.STRING },
                                            major: { type: Type.STRING },
                                            startDate: { type: Type.STRING },
                                            endDate: { type: Type.STRING },
                                            description: { 
                                                type: Type.ARRAY,
                                                items: { type: Type.STRING },
                                                description: "List of bullet points"
                                            }
                                        }
                                    }
                                },
                                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                                projects: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            id: { type: Type.STRING },
                                            name: { type: Type.STRING },
                                            description: { 
                                                type: Type.ARRAY,
                                                items: { type: Type.STRING }
                                            },
                                            link: { type: Type.STRING }
                                        }
                                    }
                                },
                                certifications: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            id: { type: Type.STRING },
                                            name: { type: Type.STRING },
                                            issuer: { type: Type.STRING },
                                            startDate: { type: Type.STRING },
                                            expirationDate: { type: Type.STRING },
                                            credentialId: { type: Type.STRING },
                                            url: { type: Type.STRING }
                                        }
                                    }
                                }
                            },
                            required: ["personalInfo", "experience", "education", "skills"]
                        }
                    },
                    required: ["structured_cv"]
                }
            }
        });

        const text = response.text || "{}";
        const result = JSON.parse(text);
        
        if (!result.full_cv_preview_html) result.full_cv_preview_html = "";
        if (!result.downloadable_cv_markdown) result.downloadable_cv_markdown = "";
        if (!result.latex_source) {
            result.latex_source = "% LaTeX source available via PDF download options.";
        }
        
        return result as FullCVPreviewResult;
    });
};
