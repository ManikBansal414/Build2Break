
import React, { useState, useCallback, useEffect } from 'react';
import { screenResume } from '../services/geminiService';
import { memoryService, CandidateRecord } from '../services/memoryService';
import { ValidationService } from '../services/validationService';
import type { ScreeningResult, CandidateContext } from '../types';
import Spinner from './common/Spinner';

interface TalentScoutProps {
    onHireCandidate: (candidate: CandidateContext) => void;
    currentCandidateId?: string | null;
}

const TalentScout: React.FC<TalentScoutProps> = ({ onHireCandidate, currentCandidateId }) => {
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  
  const canSubmit = jobDescription.trim().length > 0 && resumeText.trim().length > 0 && validationErrors.length === 0;

  useEffect(() => {
    // Load existing candidate data if editing
    if (currentCandidateId) {
      const candidate = memoryService.getCandidateRecord(currentCandidateId);
      if (candidate && candidate.screeningResult) {
        setResult(candidate.screeningResult);
        // Optionally load previous job description and resume if stored
      }
    }
  }, [currentCandidateId]);

  useEffect(() => {
    // Validate inputs in real-time
    const errors: string[] = [];
    const warnings: string[] = [];

    if (jobDescription) {
      const jobValidation = ValidationService.validateJobDescription(jobDescription);
      errors.push(...jobValidation.errors);
      warnings.push(...jobValidation.warnings);
    }

    if (resumeText) {
      const resumeValidation = ValidationService.validateResumeText(resumeText);
      errors.push(...resumeValidation.errors);
      warnings.push(...resumeValidation.warnings);
    }

    setValidationErrors(errors);
    setValidationWarnings(warnings);
  }, [jobDescription, resumeText]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const screeningResult = await screenResume(jobDescription, resumeText);
      setResult(screeningResult);
      setRetryCount(0);

      // Save to memory
      const candidateId = currentCandidateId || memoryService.generateCandidateId();
      const candidateRecord: CandidateRecord = {
        id: candidateId,
        personalInfo: {
          name: screeningResult.candidate_name,
          role: screeningResult.role_applied_for
        },
        screeningResult,
        status: 'screened',
        createdAt: currentCandidateId ? memoryService.getCandidateRecord(candidateId)?.createdAt || new Date() : new Date(),
        updatedAt: new Date()
      };
      
      memoryService.saveCandidateRecord(candidateRecord);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      
      // Implement retry logic for API failures
      if (retryCount < 3 && errorMessage.includes('API')) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          handleSubmit(e);
        }, 2000 * (retryCount + 1)); // Exponential backoff
      }
    } finally {
      setLoading(false);
    }
  }, [jobDescription, resumeText, canSubmit, currentCandidateId, retryCount]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file first
      const fileValidation = ValidationService.validateFile(file);
      if (!fileValidation.isValid) {
        setError(`File validation failed: ${fileValidation.errors.join(', ')}`);
        return;
      }
      
      if (fileValidation.warnings.length > 0) {
        setValidationWarnings(prev => [...prev, ...fileValidation.warnings]);
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const sanitizedContent = ValidationService.sanitizeText(content);
        setResumeText(sanitizedContent);
      };
      reader.onerror = () => {
        setError('Failed to read file. Please try again.');
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-indigo-400">TalentScout: Resume Screening</h2>
        <p className="text-slate-400 mt-1">Provide a job description and a resume to get an AI-powered analysis.</p>
        {currentCandidateId && (
          <p className="text-cyan-400 text-sm mt-1">Editing existing candidate screening</p>
        )}
      </div>

      {/* Validation Messages */}
      {validationErrors.length > 0 && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
          <h4 className="text-red-400 font-medium mb-2">Validation Errors:</h4>
          <ul className="text-red-300 text-sm space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {validationWarnings.length > 0 && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4">
          <h4 className="text-yellow-400 font-medium mb-2">Warnings:</h4>
          <ul className="text-yellow-300 text-sm space-y-1">
            {validationWarnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {retryCount > 0 && (
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
          <p className="text-blue-400 text-sm">Retrying API request... (Attempt {retryCount + 1}/4)</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="jobDescription" className="block text-sm font-medium text-slate-300 mb-1">Job Description</label>
          <textarea
            id="jobDescription"
            rows={6}
            className="w-full bg-slate-900 border border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 text-slate-200 transition"
            placeholder="Paste the full job description here..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="resumeText" className="block text-sm font-medium text-slate-300 mb-1">Resume Text</label>
           <div className="flex items-center space-x-2">
            <label
              htmlFor="resume-upload"
              className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 px-4 rounded-md transition duration-200 text-sm"
            >
              Upload .txt file
            </label>
            <input id="resume-upload" type="file" accept=".txt" className="hidden" onChange={handleFileChange} />
            <span className="text-slate-500 text-sm">or paste below</span>
          </div>
          <textarea
            id="resumeText"
            rows={10}
            className="w-full bg-slate-900 border border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 mt-2 text-slate-200 transition"
            placeholder="Upload a .txt file or paste the resume contents here..."
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition duration-300"
          >
            {loading ? <><Spinner /> Screening...</> : 'Screen Resume'}
          </button>
        </div>
      </form>

      {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-md">{error}</div>}

      {result && (
        <div className="space-y-4 pt-4 border-t border-slate-700 animate-fade-in">
          <h3 className="text-xl font-bold">Screening Result for {result.candidate_name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/70 p-4 rounded-lg">
                  <h4 className="font-semibold text-indigo-400">Match Score</h4>
                  <p className="text-4xl font-bold">{result.match_score}<span className="text-xl text-slate-400">/100</span></p>
              </div>
              <div className="bg-slate-900/70 p-4 rounded-lg">
                  <h4 className="font-semibold text-indigo-400">Recommendation</h4>
                  <p className={`text-2xl font-bold ${result.recommendation.includes('HIRE') ? 'text-green-400' : 'text-amber-400'}`}>{result.recommendation.replace('_', ' ')}</p>
              </div>
               <div className="bg-slate-900/70 p-4 rounded-lg md:col-span-1">
                <h4 className="font-semibold text-indigo-400">Role Applied For</h4>
                <p className="text-lg font-bold">{result.role_applied_for}</p>
            </div>
          </div>

          <div className="bg-slate-900/70 p-4 rounded-lg">
              <h4 className="font-semibold text-indigo-400">Summary</h4>
              <p className="text-slate-300">{result.summary}</p>
          </div>
          <div className="bg-slate-900/70 p-4 rounded-lg">
              <h4 className="font-semibold text-indigo-400">Reasoning</h4>
              <p className="text-slate-300">{result.reasoning}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/70 p-4 rounded-lg">
              <h4 className="font-semibold text-green-400">Strengths</h4>
              <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300">
                {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div className="bg-slate-900/70 p-4 rounded-lg">
              <h4 className="font-semibold text-amber-400">Weaknesses</h4>
              <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300">
                {result.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
          {(result.recommendation === 'HIRE' || result.recommendation === 'STRONG_HIRE') && (
            <button
                onClick={() => onHireCandidate({ name: result.candidate_name, role: result.role_applied_for })}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-md transition duration-300 mt-4"
            >
                Proceed to Onboarding for {result.candidate_name}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TalentScout;
