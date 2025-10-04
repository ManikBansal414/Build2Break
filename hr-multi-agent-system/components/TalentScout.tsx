
import React, { useState, useCallback, useEffect } from 'react';
import { screenResume } from '../services/geminiService';
import { memoryService, CandidateRecord } from '../services/memoryService';
import { ValidationService } from '../services/validationService';
import BulkResumeProcessor, { BulkProcessingSummary, BulkResumeResult } from '../services/bulkResumeService';
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
  
  // Bulk processing state
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ processed: 0, total: 0, current: '' });
  const [bulkResults, setBulkResults] = useState<BulkProcessingSummary | null>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [numberOfHires, setNumberOfHires] = useState<number>(1);
  const [hiredCandidates, setHiredCandidates] = useState<Set<string>>(new Set());
  
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

  const handleHireCandidate = useCallback((candidate: BulkResumeResult) => {
    // Add to hired candidates
    setHiredCandidates(prev => new Set([...prev, candidate.candidateName]));
    
    // Trigger onboarding
    onHireCandidate({
      name: candidate.candidateName,
      role: candidate.screeningResult.role_applied_for
    });
  }, [onHireCandidate]);

  const getTopCandidatesForHiring = useCallback(() => {
    if (!bulkResults) return [];
    
    // Get all candidates sorted by score (already sorted in bulkResults.topCandidates)
    const allCandidates = [...bulkResults.topCandidates];
    
    // Filter out those who are not recommended for hiring
    const hirableCandidates = allCandidates.filter(candidate => 
      candidate.screeningResult.recommendation === 'STRONG_HIRE' || 
      candidate.screeningResult.recommendation === 'HIRE'
    );
    
    // If we don't have enough hirable candidates, include 'CONSIDER' candidates
    if (hirableCandidates.length < numberOfHires) {
      const considerCandidates = allCandidates.filter(candidate => 
        candidate.screeningResult.recommendation === 'CONSIDER'
      );
      hirableCandidates.push(...considerCandidates);
    }
    
    // Return the top N candidates
    return hirableCandidates.slice(0, numberOfHires);
  }, [bulkResults, numberOfHires]);
  
  const handleBulkProcessing = useCallback(async () => {
    if (!bulkFile || !jobDescription.trim()) return;

    setBulkProcessing(true);
    setError(null);
    setBulkResults(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        
        const processor = new BulkResumeProcessor(
          jobDescription,
          (processed, total, current) => {
            setBulkProgress({ processed, total: total || bulkProgress.total, current: current || '' });
          }
        );

        const resumes = processor.parseResumesFromText(content);
        if (resumes.length === 0) {
          throw new Error('No resumes found in the file. Please check the format.');
        }

        setBulkProgress({ processed: 0, total: resumes.length, current: 'Starting...' });
        
        const summary = await processor.processAllResumes(resumes, 2); // Process 2 at a time
        setBulkResults(summary);
        
        // Save bulk results to memory
        summary.topCandidates.forEach((candidate, index) => {
          const candidateRecord: CandidateRecord = {
            id: `bulk_${Date.now()}_${index}`,
            personalInfo: {
              name: candidate.candidateName,
              role: candidate.screeningResult.role_applied_for
            },
            screeningResult: candidate.screeningResult,
            status: 'screened',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          memoryService.saveCandidateRecord(candidateRecord);
        });
      };
      
      reader.readAsText(bulkFile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during bulk processing.';
      setError(errorMessage);
    } finally {
      setBulkProcessing(false);
    }
  }, [bulkFile, jobDescription, bulkProgress.total]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (mode === 'bulk') {
        // Handle bulk file upload
        setBulkFile(file);
        setError(null);
        return;
      }

      // Validate file first (for single resume)
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
        <p className="text-slate-400 mt-1">Analyze single resumes or process multiple resumes in bulk.</p>
        {currentCandidateId && (
          <p className="text-cyan-400 text-sm mt-1">Editing existing candidate screening</p>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="flex space-x-1 bg-slate-900 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
            mode === 'single'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Single Resume
        </button>
        <button
          type="button"
          onClick={() => setMode('bulk')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
            mode === 'bulk'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Bulk Processing
        </button>
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

      {mode === 'bulk' ? (
        /* Bulk Processing Form */
        <div className="space-y-4">
          <div>
            <label htmlFor="bulkJobDescription" className="block text-sm font-medium text-slate-300 mb-1">Job Description</label>
            <textarea
              id="bulkJobDescription"
              rows={6}
              className="w-full bg-slate-900 border border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 text-slate-200 transition"
              placeholder="Paste the full job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>
          
          <div>
            <label htmlFor="bulkFile" className="block text-sm font-medium text-slate-300 mb-1">
              Upload Bulk Resumes File (.txt)
            </label>
            <div className="text-xs text-slate-400 mb-2">
              Format: Separate each resume with "---RESUME---", "===RESUME===", or similar delimiters
            </div>
            <input
              id="bulkFile"
              type="file"
              accept=".txt,.doc,.docx"
              onChange={handleFileChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 text-slate-200 transition"
            />
          </div>

          <div>
            <label htmlFor="numberOfHires" className="block text-sm font-medium text-slate-300 mb-1">
              Number of candidates to hire
            </label>
            <div className="text-xs text-slate-400 mb-2">
              Specify how many top candidates you want to hire from the batch
            </div>
            <input
              id="numberOfHires"
              type="number"
              min="1"
              max="50"
              value={numberOfHires}
              onChange={(e) => setNumberOfHires(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-slate-900 border border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 text-slate-200 transition"
              placeholder="Enter number of hires (e.g., 2)"
            />
          </div>

          {/* Bulk Progress */}
          {bulkProcessing && (
            <div className="bg-slate-900/70 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-300">Processing Resumes...</span>
                <span className="text-sm text-slate-400">{bulkProgress.processed}/{bulkProgress.total}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${(bulkProgress.processed / (bulkProgress.total || 1)) * 100}%` }}
                ></div>
              </div>
              {bulkProgress.current && (
                <p className="text-xs text-slate-400">Current: {bulkProgress.current}</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleBulkProcessing}
            disabled={!jobDescription.trim() || !bulkFile || bulkProcessing}
            className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition duration-300"
          >
            {bulkProcessing ? <><Spinner /> Processing...</> : 'Process All Resumes'}
          </button>
        </div>
      ) : (
        /* Single Resume Form */
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
      )}

      {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-md">{error}</div>}

      {/* Bulk Results Display */}
      {bulkResults && (
        <div className="space-y-6 pt-4 border-t border-slate-700 animate-fade-in">
          <h3 className="text-xl font-bold">Bulk Processing Results</h3>
          
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/70 p-4 rounded-lg">
              <h4 className="font-semibold text-indigo-400">Total Processed</h4>
              <p className="text-2xl font-bold">{bulkResults.successfulScreenings}/{bulkResults.totalResumes}</p>
            </div>
            <div className="bg-slate-900/70 p-4 rounded-lg">
              <h4 className="font-semibold text-indigo-400">Average Score</h4>
              <p className="text-2xl font-bold">{Math.round(bulkResults.averageScore)}<span className="text-lg text-slate-400">/100</span></p>
            </div>
            <div className="bg-slate-900/70 p-4 rounded-lg">
              <h4 className="font-semibold text-green-400">Strong Hires</h4>
              <p className="text-2xl font-bold text-green-400">{bulkResults.recommendations.strongHire.length}</p>
            </div>
            <div className="bg-slate-900/70 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-400">Total Hires</h4>
              <p className="text-2xl font-bold text-blue-400">{bulkResults.recommendations.hire.length + bulkResults.recommendations.strongHire.length}</p>
            </div>
          </div>

          {/* Hiring Controls */}
          <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 p-6 rounded-lg border border-indigo-500/30">
            <h4 className="text-lg font-bold text-indigo-400 mb-3">Hiring Controls</h4>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div>
                <label htmlFor="numberOfHires" className="block text-sm font-medium text-slate-300 mb-1">
                  Number of candidates to hire:
                </label>
                <input
                  id="numberOfHires"
                  type="number"
                  min="1"
                  max={bulkResults.topCandidates.length}
                  value={numberOfHires}
                  onChange={(e) => setNumberOfHires(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="text-sm text-slate-400">
                Showing top {Math.min(numberOfHires, getTopCandidatesForHiring().length)} candidates for hiring
              </div>
            </div>
          </div>

          {/* Top Candidates for Hiring */}
          {getTopCandidatesForHiring().length > 0 && (
            <div className="bg-gradient-to-r from-green-900/30 to-indigo-900/30 p-6 rounded-lg border border-green-500/30">
              <h4 className="text-lg font-bold text-green-400 mb-3">🏆 Best Candidates to Hire</h4>
              <div className="space-y-4">
                {getTopCandidatesForHiring().map((candidate, index) => (
                  <div key={candidate.candidateIndex} className="bg-slate-800/50 p-4 rounded-lg border border-slate-600">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <div>
                        <h5 className="font-semibold text-slate-300">#{index + 1} {candidate.candidateName}</h5>
                        <p className="text-sm text-slate-400">{candidate.screeningResult.role_applied_for}</p>
                        {hiredCandidates.has(candidate.candidateName) && (
                          <span className="inline-block bg-green-600 text-white text-xs px-2 py-1 rounded-full mt-1">
                            ✓ HIRED
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-xl font-bold text-green-400">{candidate.screeningResult.match_score}%</span>
                        <p className="text-sm text-green-300">{candidate.screeningResult.recommendation.replace('_', ' ')}</p>
                      </div>
                      <div className="text-sm text-slate-300">
                        <p>{candidate.screeningResult.summary.substring(0, 100)}...</p>
                      </div>
                      <div>
                        <button
                          onClick={() => handleHireCandidate(candidate)}
                          disabled={hiredCandidates.has(candidate.candidateName)}
                          className={`w-full font-bold py-2 px-4 rounded-md transition duration-300 ${
                            hiredCandidates.has(candidate.candidateName)
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {hiredCandidates.has(candidate.candidateName) ? 'Hired' : 'Hire Now'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Candidates List */}
          <div className="bg-slate-900/70 p-6 rounded-lg">
            <h4 className="text-lg font-bold text-indigo-400 mb-4">All Candidates ({bulkResults.topCandidates.length})</h4>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-900/30 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-400">{hiredCandidates.size}</p>
                <p className="text-sm text-green-300">Hired</p>
              </div>
              <div className="bg-blue-900/30 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-400">{bulkResults.recommendations.strongHire.length}</p>
                <p className="text-sm text-blue-300">Strong Hire</p>
              </div>
              <div className="bg-purple-900/30 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-400">{bulkResults.recommendations.hire.length}</p>
                <p className="text-sm text-purple-300">Hire</p>
              </div>
              <div className="bg-yellow-900/30 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-400">{bulkResults.recommendations.consider.length}</p>
                <p className="text-sm text-yellow-300">Consider</p>
              </div>
            </div>

            {/* Candidates List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {bulkResults.topCandidates.map((candidate, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-600">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">#{index + 1}</span>
                      <h5 className="font-semibold text-slate-200">{candidate.candidateName}</h5>
                      {hiredCandidates.has(candidate.candidateName) && (
                        <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                          ✓ HIRED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">{candidate.screeningResult.role_applied_for}</p>
                    <p className="text-xs text-slate-500 mt-1">{candidate.screeningResult.summary.substring(0, 120)}...</p>
                  </div>
                  <div className="text-center mx-4">
                    <span className={`text-lg font-bold ${
                      candidate.screeningResult.match_score >= 80 ? 'text-green-400' :
                      candidate.screeningResult.match_score >= 60 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>{candidate.screeningResult.match_score}%</span>
                    <p className={`text-xs ${
                      candidate.screeningResult.recommendation === 'STRONG_HIRE' ? 'text-green-300' :
                      candidate.screeningResult.recommendation === 'HIRE' ? 'text-blue-300' :
                      candidate.screeningResult.recommendation === 'CONSIDER' ? 'text-yellow-300' :
                      'text-red-300'
                    }`}>{candidate.screeningResult.recommendation.replace('_', ' ')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleHireCandidate(candidate)}
                      disabled={hiredCandidates.has(candidate.candidateName)}
                      className={`font-bold py-2 px-4 rounded-md transition duration-300 text-sm ${
                        hiredCandidates.has(candidate.candidateName)
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : candidate.screeningResult.recommendation === 'STRONG_HIRE' || candidate.screeningResult.recommendation === 'HIRE'
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      }`}
                    >
                      {hiredCandidates.has(candidate.candidateName) ? 'Hired' : 'Hire'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>          {/* Download Report Button */}
          <button
            onClick={() => {
              const processor = new BulkResumeProcessor(jobDescription);
              const report = processor.generateReport(bulkResults);
              const blob = new Blob([report], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `bulk-screening-report-${new Date().toISOString().split('T')[0]}.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-md transition duration-300"
          >
            📄 Download Full Report
          </button>
        </div>
      )}

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
