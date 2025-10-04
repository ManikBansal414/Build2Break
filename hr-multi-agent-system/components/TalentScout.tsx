
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

interface ResumeCandidate {
  resumeText: string;
  fileName?: string;
  result?: ScreeningResult;
}

const TalentScout: React.FC<TalentScoutProps> = ({ onHireCandidate, currentCandidateId }) => {
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [resumes, setResumes] = useState<ResumeCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [bestCandidate, setBestCandidate] = useState<ResumeCandidate | null>(null);
  const [allResults, setAllResults] = useState<ScreeningResult[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  
  
  const canSubmit = jobDescription.trim().length > 0 && (resumeText.trim().length > 0 || resumes.length > 0) && validationErrors.length === 0;

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

    // Validate all uploaded resumes
    resumes.forEach((resume, index) => {
      if (resume.resumeText) {
        const resumeValidation = ValidationService.validateResumeText(resume.resumeText);
        errors.push(...resumeValidation.errors.map(err => `Resume ${index + 1}: ${err}`));
        warnings.push(...resumeValidation.warnings.map(warn => `Resume ${index + 1}: ${warn}`));
      }
    });

    setValidationErrors(errors);
    setValidationWarnings(warnings);
  }, [jobDescription, resumeText, resumes]);

  const parseMultipleResumes = (text: string): ResumeCandidate[] => {
    // Split by common resume separators
    const resumeSections = text.split(/Resume \d+\s*[-–]\s*/i).filter(section => section.trim().length > 100);
    
    if (resumeSections.length <= 1) {
      // Try splitting by names or other patterns
      const nameSections = text.split(/\n\s*([A-Z][a-z]+ [A-Z][a-z]+)\s*\n/).filter(section => section.trim().length > 50);
      if (nameSections.length > 1) {
        return nameSections.map((section, index) => ({
          resumeText: section.trim(),
          fileName: `Resume ${index + 1}`
        }));
      }
      // If no clear separation, return as single resume
      return [{ resumeText: text.trim(), fileName: 'Single Resume' }];
    }
    
    return resumeSections.map((section, index) => ({
      resumeText: section.trim(),
      fileName: `Resume ${index + 1}`
    }));
  };

  const processAllResumes = async (): Promise<ScreeningResult[]> => {
    const resumesToProcess = resumes.length > 0 ? resumes : parseMultipleResumes(resumeText);
    const results: ScreeningResult[] = [];
    
    setProcessingStatus(`Processing ${resumesToProcess.length} resume(s)...`);
    
    for (let i = 0; i < resumesToProcess.length; i++) {
      try {
        setProcessingStatus(`Processing resume ${i + 1} of ${resumesToProcess.length}...`);
        const result = await screenResume(jobDescription, resumesToProcess[i].resumeText);
        results.push(result);
        
        // Add small delay to avoid overwhelming the API
        if (i < resumesToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (err) {
        console.error(`Error processing resume ${i + 1}:`, err);
        // Continue with other resumes even if one fails
      }
    }
    
    return results;
  };

  const findBestCandidate = (results: ScreeningResult[]): ScreeningResult => {
    // Sort by match score (descending) and recommendation priority
    const recommendationPriority = {
      'STRONG_HIRE': 4,
      'HIRE': 3,
      'CONSIDER': 2,
      'NO_HIRE': 1
    };
    
    return results.sort((a, b) => {
      // First prioritize by recommendation
      const aWeight = recommendationPriority[a.recommendation];
      const bWeight = recommendationPriority[b.recommendation];
      
      if (aWeight !== bWeight) {
        return bWeight - aWeight;
      }
      
      // Then by match score
      return b.match_score - a.match_score;
    })[0];
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setBestCandidate(null);
    setAllResults([]);

    try {
      const results = await processAllResumes();
      setAllResults(results);
      
      if (results.length === 0) {
        setError('No resumes could be processed successfully.');
        return;
      }
      
      const bestResult = findBestCandidate(results);
      setResult(bestResult);
      
      setProcessingStatus(`Found best candidate: ${bestResult.candidate_name} (Score: ${bestResult.match_score}/100)`);
      
      // Save the best candidate to memory
      const candidateId = currentCandidateId || memoryService.generateCandidateId();
      const candidateRecord: CandidateRecord = {
        id: candidateId,
        personalInfo: {
          name: bestResult.candidate_name,
          role: bestResult.role_applied_for
        },
        screeningResult: bestResult,
        status: 'screened',
        createdAt: currentCandidateId ? memoryService.getCandidateRecord(candidateId)?.createdAt || new Date() : new Date(),
        updatedAt: new Date()
      };
      
      memoryService.saveCandidateRecord(candidateRecord);
      
      // Save all other candidates as well for reference
      results.forEach((result, index) => {
        if (result !== bestResult) {
          const otherCandidateId = memoryService.generateCandidateId();
          const otherRecord: CandidateRecord = {
            id: otherCandidateId,
            personalInfo: {
              name: result.candidate_name,
              role: result.role_applied_for
            },
            screeningResult: result,
            status: 'screened',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          memoryService.saveCandidateRecord(otherRecord);
        }
      });

      setRetryCount(0);

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
      setProcessingStatus('');
    }
  }, [jobDescription, resumeText, resumes, canSubmit, currentCandidateId, retryCount]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newResumes: ResumeCandidate[] = [];
    let filesProcessed = 0;

    Array.from(files).forEach((file: File) => {
      // Validate file first
      const fileValidation = ValidationService.validateFile(file);
      if (!fileValidation.isValid) {
        setError(`File validation failed for ${file.name}: ${fileValidation.errors.join(', ')}`);
        return;
      }
      
      if (fileValidation.warnings.length > 0) {
        setValidationWarnings(prev => [...prev, ...fileValidation.warnings.map(w => `${file.name}: ${w}`)]);
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const sanitizedContent = ValidationService.sanitizeText(content);
        
        newResumes.push({
          resumeText: sanitizedContent,
          fileName: file.name
        });
        
        filesProcessed++;
        
        // Update state when all files are processed
        if (filesProcessed === files.length) {
          setResumes(prev => [...prev, ...newResumes]);
          // Clear the single resume text if we're uploading multiple files
          if (newResumes.length > 1) {
            setResumeText('');
          }
        }
      };
      reader.onerror = () => {
        setError(`Failed to read file ${file.name}. Please try again.`);
      };
      reader.readAsText(file);
    });
  };

  const removeResume = (index: number) => {
    setResumes(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllResumes = () => {
    setResumes([]);
    setResumeText('');
    setResult(null);
    setAllResults([]);
    setBestCandidate(null);
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

      {processingStatus && (
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
          <p className="text-blue-400 text-sm">{processingStatus}</p>
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
              Upload .txt file(s)
            </label>
            <input 
              id="resume-upload" 
              type="file" 
              accept=".txt" 
              multiple 
              className="hidden" 
              onChange={handleFileChange} 
            />
            <span className="text-slate-500 text-sm">or paste below (multiple resumes supported)</span>
            {(resumes.length > 0 || resumeText.trim()) && (
              <button
                type="button"
                onClick={clearAllResumes}
                className="text-red-400 hover:text-red-300 text-sm underline"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Show uploaded resumes */}
          {resumes.length > 0 && (
            <div className="mt-3 space-y-2">
              <h4 className="text-sm font-medium text-slate-300">Uploaded Resumes ({resumes.length}):</h4>
              {resumes.map((resume, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-800 p-2 rounded border">
                  <span className="text-slate-300 text-sm">{resume.fileName}</span>
                  <button
                    type="button"
                    onClick={() => removeResume(index)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            id="resumeText"
            rows={10}
            className="w-full bg-slate-900 border border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 mt-2 text-slate-200 transition"
            placeholder="Upload multiple .txt files or paste multiple resumes here (separate with 'Resume 1 - Name', 'Resume 2 - Name', etc.)..."
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
            {loading ? (
              <>
                <Spinner /> 
                {resumes.length > 0 || resumeText.includes('Resume') ? 'Processing Multiple Resumes...' : 'Screening...'}
              </>
            ) : (
              resumes.length > 0 || resumeText.includes('Resume') ? 
                `Screen ${resumes.length > 0 ? resumes.length : 'Multiple'} Resume(s)` : 
                'Screen Resume'
            )}
          </button>
        </div>
      </form>

      {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-md">{error}</div>}

      {result && (
        <div className="space-y-4 pt-4 border-t border-slate-700 animate-fade-in">
          {allResults.length > 1 && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-4">
              <h4 className="text-green-400 font-medium mb-2">🏆 Best Candidate Selected</h4>
              <p className="text-green-300 text-sm">
                Processed {allResults.length} candidates and automatically selected the best match based on score and recommendation.
              </p>
            </div>
          )}
          
          <h3 className="text-xl font-bold">
            {allResults.length > 1 ? '🥇 Best Candidate: ' : 'Screening Result for '}{result.candidate_name}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/70 p-4 rounded-lg">
                  <h4 className="font-semibold text-indigo-400">Match Score</h4>
                  <p className="text-4xl font-bold">{result.match_score}<span className="text-xl text-slate-400">/100</span></p>
              </div>
              <div className="bg-slate-900/70 p-4 rounded-lg">
                  <h4 className="font-semibold text-indigo-400">Recommendation</h4>
                  <p className={`text-2xl font-bold ${result.recommendation.includes('HIRE') ? 'text-green-400' : 'text-amber-400'}`}>
                    {result.recommendation.replace('_', ' ')}
                  </p>
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

          {/* Show all candidates if multiple were processed */}
          {allResults.length > 1 && (
            <div className="bg-slate-900/70 p-4 rounded-lg">
              <h4 className="font-semibold text-indigo-400 mb-3">All Candidates Comparison</h4>
              <div className="space-y-3">
                {allResults.map((candidate, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded border ${candidate === result ? 'border-green-500 bg-green-500/10' : 'border-slate-600'}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-slate-200">
                          {candidate === result && '🏆 '}{candidate.candidate_name}
                        </span>
                        <span className="text-slate-400 text-sm ml-2">({candidate.role_applied_for})</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-bold">{candidate.match_score}/100</span>
                        <span className={`text-sm font-medium ${candidate.recommendation.includes('HIRE') ? 'text-green-400' : 'text-amber-400'}`}>
                          {candidate.recommendation.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(result.recommendation === 'HIRE' || result.recommendation === 'STRONG_HIRE') && (
            <button
                onClick={() => onHireCandidate({ name: result.candidate_name, role: result.role_applied_for })}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-md transition duration-300 mt-4"
            >
                🎉 Proceed to Onboarding for {result.candidate_name}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TalentScout;
