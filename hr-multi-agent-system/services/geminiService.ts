
import { GoogleGenAI, Type, Chat } from "@google/genai";
import type { ScreeningResult } from '../types';

// Get API key from environment variables
const API_KEY = (import.meta as any).env.VITE_API_KEY;

if (!API_KEY) {
    throw new Error("VITE_API_KEY environment variable not set. Please add it to your .env.local file.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const screeningResultSchema = {
    type: Type.OBJECT,
    properties: {
        candidate_name: { type: Type.STRING, description: "The full name of the candidate found in the resume." },
        role_applied_for: { type: Type.STRING, description: "The job role the candidate is being screened for, based on the job description." },
        match_score: { type: Type.INTEGER, description: "A score from 0 to 100 indicating how well the resume matches the job description." },
        summary: { type: Type.STRING, description: "A brief summary of the candidate's profile and qualifications." },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of key strengths and qualifications that match the job description." },
        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of potential weaknesses or areas where the resume is lacking." },
        recommendation: { type: Type.STRING, description: "A final recommendation: 'STRONG_HIRE', 'HIRE', 'CONSIDER', or 'NO_HIRE'." },
        reasoning: { type: Type.STRING, description: "A short paragraph explaining the reasoning behind the recommendation." },
    },
    required: ["candidate_name", "role_applied_for", "match_score", "summary", "strengths", "weaknesses", "recommendation", "reasoning"],
};

export const screenResume = async (jobDescription: string, resumeText: string, retryCount = 0): Promise<ScreeningResult> => {
    const prompt = `
        **Role:** You are 'TalentScout', an expert AI recruiter.
        **Task:** Analyze the provided resume against the job description and return a structured JSON analysis.
        
        **Job Description:**
        ---
        ${jobDescription}
        ---

        **Resume Text:**
        ---
        ${resumeText}
        ---

        **Instructions:**
        1.  Carefully read both the job description and the resume.
        2.  Identify the candidate's name and the role they are being considered for.
        3.  Evaluate the candidate's experience, skills, and qualifications against the requirements.
        4.  Calculate a match score from 0-100.
        5.  Summarize the key strengths and weaknesses.
        6.  Provide a clear hiring recommendation ('STRONG_HIRE', 'HIRE', 'CONSIDER', 'NO_HIRE').
        7.  Provide concise reasoning for your recommendation.
        8.  Return the analysis in the specified JSON format.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: screeningResultSchema,
            },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText) as ScreeningResult;
        
        // Validate the result
        if (!result.candidate_name || !result.role_applied_for || typeof result.match_score !== 'number') {
            throw new Error('Invalid API response format');
        }
        
        return result;
    } catch (error) {
        console.error("Error screening resume:", error);
        
        // Implement retry logic with exponential backoff
        if (retryCount < 3) {
            console.log(`Retrying API request... (Attempt ${retryCount + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
            return screenResume(jobDescription, resumeText, retryCount + 1);
        }
        
        throw new Error("Failed to get analysis from Gemini API after multiple attempts.");
    }
};

export const createOnboardingPlan = async (name: string, role: string, team: string, retryCount = 0): Promise<string> => {
    const prompt = `
        **Role:** You are 'Onboarder', an expert HR specialist.
        **Task:** Create a detailed and personalized 30-day onboarding plan for a new hire.
        
        **New Hire Details:**
        -   **Name:** ${name}
        -   **Role:** ${role}
        -   **Team:** ${team}

        **Instructions:**
        1.  Generate a comprehensive 30-day plan broken down into Week 1, Week 2, and Weeks 3-4.
        2.  Include a mix of activities: company orientation, team introductions, technical setup, initial projects, and learning goals.
        3.  Make the tone welcoming and professional.
        4.  Format the output using Markdown for readability (e.g., use '#' for headings, '*' for bullet points).
        5.  Include specific action items and deliverables for each week.
        6.  Add checkpoints for manager check-ins and feedback sessions.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        
        const plan = response.text;
        if (!plan || plan.trim().length < 100) {
            throw new Error('Generated plan is too short or empty');
        }
        
        return plan;
    } catch (error) {
        console.error("Error creating onboarding plan:", error);
        
        // Retry logic
        if (retryCount < 3) {
            console.log(`Retrying onboarding plan generation... (Attempt ${retryCount + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
            return createOnboardingPlan(name, role, team, retryCount + 1);
        }
        
        throw new Error("Failed to generate onboarding plan from Gemini API after multiple attempts.");
    }
};

export const createPolicyQAChat = (): Chat => {
    const DUMMY_POLICY_DOCUMENT = `
        **Company Policy Handbook**

        **1. Work Hours:**
        - Standard work hours are 9:00 AM to 5:00 PM, Monday to Friday.
        - Flexible work arrangements may be available upon manager approval.

        **2. Paid Time Off (PTO):**
        - Full-time employees accrue 15 days of PTO per year for the first 2 years.
        - After 2 years, PTO accrual increases to 20 days per year.
        - PTO requests must be submitted through the HR portal at least 2 weeks in advance.

        **3. Remote Work:**
        - The company supports a hybrid work model.
        - Employees are expected to be in the office at least 3 days a week.
        - Specific in-office days are determined by individual teams.

        **4. Code of Conduct:**
        - All employees are expected to maintain a professional and respectful work environment.
        - Harassment and discrimination of any kind are not tolerated.
    `;

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: `You are 'PolicyBot', a helpful HR assistant. Your role is to answer questions based *only* on the provided Company Policy Handbook. If the answer is not in the handbook, state that you do not have that information and recommend contacting a human HR representative. Do not invent information. Here is the handbook: \n\n${DUMMY_POLICY_DOCUMENT}`,
        },
    });
};
