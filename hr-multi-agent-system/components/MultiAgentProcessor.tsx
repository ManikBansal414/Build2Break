import React, { useState, useCallback, useEffect } from 'react';
import AgentOrchestrator, { AgentStatus, ConcurrentProcessingResult, AgentTask } from '../services/agentOrchestrator';
import { memoryService } from '../services/memoryService';
import type { CandidateContext } from '../types';
import Spinner from './common/Spinner';

interface MultiAgentProcessorProps {
  onHireCandidate: (candidate: CandidateContext) => void;
}

interface ProcessingProgress {
  totalCandidates: number;
  processedCandidates: number;
  currentPhase: string;
  agentStatuses: AgentStatus[];
  estimatedTimeRemaining: number;
}

const MultiAgentProcessor: React.FC<MultiAgentProcessorProps> = ({ onHireCandidate }) => {
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState(''); // For single file with multiple resumes
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [resumeTexts, setResumeTexts] = useState<Array<{name: string, text: string}>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ConcurrentProcessingResult[]>([]);
  const [progress, setProgress] = useState<ProcessingProgress>({
    totalCandidates: 0,
    processedCandidates: 0,
    currentPhase: 'Idle',
    agentStatuses: [],
    estimatedTimeRemaining: 0
  });
  const [orchestrator, setOrchestrator] = useState<AgentOrchestrator | null>(null);
  const [processingLog, setProcessingLog] = useState<Array<{time: string, agent: string, message: string}>>([]);

  useEffect(() => {
    // Initialize orchestrator
    const apiKey = 'AIzaSyDudPrq0IqcQ-xHgnXysxxPgCPky_nCpj0'; // You can move this to .env
    if (apiKey) {
      const orch = new AgentOrchestrator(apiKey);
      
      // Set up event listeners for real-time updates
      orch.addEventListener('batch_started', (data: any) => {
        setProgress(prev => ({
          ...prev,
          totalCandidates: data.count,
          currentPhase: 'Starting batch processing...'
        }));
        addToLog('System', `Started processing ${data.count} candidates`);
      });

      orch.addEventListener('task_started', (data: any) => {
        addToLog(data.agent, `Started: ${data.task.agentType} for ${data.task.candidateId}`);
      });

      orch.addEventListener('task_completed', (data: any) => {
        addToLog(data.task.agentType, `Completed in ${data.processingTime}ms`);
        setProgress(prev => ({
          ...prev,
          processedCandidates: prev.processedCandidates + 1
        }));
      });

      orch.addEventListener('task_failed', (data: any) => {
        addToLog(data.task.agentType, `Failed: ${data.error}`);
      });

      orch.addEventListener('batch_completed', (data: any) => {
        setProgress(prev => ({
          ...prev,
          currentPhase: 'Processing complete!',
          estimatedTimeRemaining: 0
        }));
        addToLog('System', `Batch completed with ${data.results.length} results`);
      });

      setOrchestrator(orch);
    }
  }, []);

  const addToLog = (agent: string, message: string) => {
    const time = new Date().toLocaleTimeString();
    setProcessingLog(prev => [...prev.slice(-20), { time, agent, message }]); // Keep last 20 logs
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setResumeFiles(files);

    // Read file contents
    const filePromises = files.map((file: File) => {
      return new Promise<{name: string, text: string}>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            name: file.name,
            text: event.target?.result as string
          });
        };
        reader.readAsText(file);
      });
    });

    Promise.all(filePromises).then(setResumeTexts);
  };

  const handleProcessConcurrently = async () => {
    if (!orchestrator || !jobDescription || (!resumeText && resumeTexts.length === 0)) return;

    setIsProcessing(true);
    setResults([]);
    setProcessingLog([]);
    
    try {
      let processingResults: any[];

      if (resumeText.trim()) {
        // Process multiple resumes from a single text file
        processingResults = await orchestrator.processMultipleResumesFromFile(
          resumeText,
          jobDescription
        );
      } else {
        // Process individual uploaded files
        const candidates = resumeTexts.map(resume => ({
          resume: resume.text,
          name: extractNameFromResume(resume.text),
          role: extractRoleFromJobDescription(jobDescription)
        }));

        processingResults = await orchestrator.processCandidatesConcurrently(
          candidates,
          jobDescription
        );
      }

      setResults(processingResults);

      // Save all results to memory
      processingResults.forEach(result => {
        const candidateRecord = {
          id: result.candidateId,
          personalInfo: {
            name: result.candidateName,
            role: extractRoleFromJobDescription(jobDescription)
          },
          screeningResult: {
            candidate_name: result.candidateName,
            role_applied_for: extractRoleFromJobDescription(jobDescription),
            match_score: result.overallScore,
            summary: `Multi-agent analysis: ${result.agentConsensus ? 'Consensus reached' : 'Conflicting opinions'}`,
            strengths: result.agentResults.talentscout?.strengths || [],
            weaknesses: result.agentResults.talentscout?.weaknesses || [],
            recommendation: result.recommendation,
            reasoning: result.conflictResolution || 'Strong consensus among agents'
          },
          status: 'screened' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        memoryService.saveCandidateRecord(candidateRecord);
      });

    } catch (error) {
      console.error('Multi-agent processing failed:', error);
      addToLog('System', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const extractNameFromResume = (resumeText: string): string => {
    // Simple name extraction - you can improve this
    const lines = resumeText.split('\\n');
    return lines[0]?.trim() || 'Unknown Candidate';
  };

  const extractRoleFromJobDescription = (jobDesc: string): string => {
    // Simple role extraction - you can improve this
    const match = jobDesc.match(/(?:position|role|job):?\\s*([^\\n]+)/i);
    return match?.[1]?.trim() || 'Software Engineer';
  };

  const getBestCandidates = () => {
    return results
      .filter(r => r.recommendation === 'STRONG_HIRE' || r.recommendation === 'HIRE')
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 3);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-indigo-400">🤖 Multi-Agent Concurrent Processor</h2>
        <p className="text-slate-400 mt-1">
          Multiple AI agents working simultaneously to process candidates faster and more thoroughly.
        </p>
      </div>

      {/* Configuration Section */}
      <div className="bg-slate-900/70 p-6 rounded-lg border border-slate-700">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Configuration</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Job Description</label>
            <textarea
              rows={4}
              className="w-full bg-slate-800 border border-slate-600 rounded-md p-3 text-slate-200"
              placeholder="Enter the job description..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Resume Input Method</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Single file with multiple resumes */}
              <div className="bg-slate-800 p-4 rounded border border-slate-600">
                <h4 className="font-medium text-slate-200 mb-2">📄 Single File (Multiple Resumes)</h4>
                <p className="text-sm text-slate-400 mb-3">
                  Upload a .txt file containing multiple resumes separated by delimiters
                </p>
                <textarea
                  rows={6}
                  className="w-full bg-slate-700 border border-slate-500 rounded-md p-3 text-slate-200 text-sm"
                  placeholder="Paste multiple resumes here, or upload a file below...

Example format:
Resume 1 - John Doe
[John's resume content]

Resume 2 - Jane Smith  
[Jane's resume content]

---OR---

CANDIDATE 1 - Bob Johnson
[Bob's resume content]

CANDIDATE 2 - Alice Wilson
[Alice's resume content]"
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                />
                <input
                  type="file"
                  accept=".txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.type === 'text/plain') {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        setResumeText(content);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="mt-2 w-full bg-slate-700 border border-slate-500 rounded-md p-2 text-slate-200 text-sm"
                />
                {resumeText && (
                  <div className="mt-2 text-sm text-green-400">
                    ✅ Content loaded ({resumeText.length} characters)
                  </div>
                )}
              </div>

              {/* Individual files */}
              <div className="bg-slate-800 p-4 rounded border border-slate-600">
                <h4 className="font-medium text-slate-200 mb-2">📁 Individual Files</h4>
                <p className="text-sm text-slate-400 mb-3">
                  Upload multiple individual resume files
                </p>
                <input
                  type="file"
                  multiple
                  accept=".txt,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="w-full bg-slate-700 border border-slate-500 rounded-md p-3 text-slate-200"
                />
                {resumeTexts.length > 0 && (
                  <div className="mt-2 text-sm text-green-400">
                    ✅ {resumeTexts.length} files loaded: {resumeTexts.map(r => r.name).join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Status Dashboard */}
      {orchestrator && (
        <div className="bg-slate-900/70 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">🤖 Agent Status Dashboard</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {progress.agentStatuses.map(agent => (
              <div key={agent.id} className="bg-slate-800 p-4 rounded border border-slate-600">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-200">{agent.name}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    agent.status === 'busy' ? 'bg-green-500/20 text-green-400' :
                    agent.status === 'idle' ? 'bg-blue-500/20 text-blue-400' :
                    agent.status === 'error' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {agent.status.toUpperCase()}
                  </span>
                </div>
                {agent.currentTask && (
                  <div className="text-xs text-slate-400 mb-1">{agent.currentTask}</div>
                )}
                <div className="text-xs text-slate-500">
                  Completed: {agent.tasksCompleted} | Avg: {Math.round(agent.averageProcessingTime)}ms
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing Controls */}
      <div className="flex space-x-4">
        <button
          onClick={handleProcessConcurrently}
          disabled={!jobDescription || (!resumeText.trim() && resumeTexts.length === 0) || isProcessing}
          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-md transition"
        >
          {isProcessing ? (
            <>
              <Spinner />
              Processing candidates...
            </>
          ) : (
            <>
              🚀 Process {resumeText.trim() ? 'Multiple Resumes from File' : `${resumeTexts.length} Candidates`} Concurrently
            </>
          )}
        </button>
      </div>

      {/* Progress Indicator */}
      {isProcessing && (
        <div className="bg-slate-900/70 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">Processing Progress</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-slate-400 mb-1">
                <span>Candidates: {progress.processedCandidates}/{progress.totalCandidates}</span>
                <span>{progress.currentPhase}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${progress.totalCandidates > 0 ? (progress.processedCandidates / progress.totalCandidates) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>

            {/* Live Processing Log */}
            <div className="bg-slate-800 p-4 rounded border border-slate-600 max-h-40 overflow-y-auto">
              <h4 className="text-sm font-medium text-slate-300 mb-2">Live Processing Log</h4>
              {processingLog.map((log, index) => (
                <div key={index} className="text-xs text-slate-400 mb-1">
                  <span className="text-slate-500">{log.time}</span> 
                  <span className="text-indigo-400 mx-2">{log.agent}:</span>
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {results.length > 0 && (
        <div className="space-y-6">
          {/* Best Candidates Summary */}
          <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-6">
            <h3 className="text-xl font-bold text-green-400 mb-4">🏆 Top Candidates</h3>
            <div className="grid gap-4">
              {getBestCandidates().map((candidate, index) => (
                <div key={candidate.candidateId} className="bg-slate-800/50 p-4 rounded border border-green-500/30">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-200">
                        #{index + 1} {candidate.candidateName}
                      </h4>
                      <div className="text-sm text-slate-400">
                        Score: {candidate.overallScore}/100 | {candidate.recommendation}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {candidate.agentConsensus ? (
                        <span className="text-green-400 text-xs">✅ Consensus</span>
                      ) : (
                        <span className="text-yellow-400 text-xs">⚠️ Mixed</span>
                      )}
                      <button
                        onClick={() => onHireCandidate({ 
                          name: candidate.candidateName, 
                          role: extractRoleFromJobDescription(jobDescription) 
                        })}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Hire
                      </button>
                    </div>
                  </div>
                  
                  {/* Agent Breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                    {candidate.agentResults.talentscout && (
                      <div className="bg-blue-500/20 p-2 rounded">
                        <div className="text-blue-400">TalentScout</div>
                        <div className="text-slate-300">{candidate.agentResults.talentscout.match_score}/100</div>
                      </div>
                    )}
                    {candidate.agentResults.skillsanalyst && (
                      <div className="bg-purple-500/20 p-2 rounded">
                        <div className="text-purple-400">Skills</div>
                        <div className="text-slate-300">{candidate.agentResults.skillsanalyst.technical_score}/100</div>
                      </div>
                    )}
                    {candidate.agentResults.culturefit && (
                      <div className="bg-pink-500/20 p-2 rounded">
                        <div className="text-pink-400">Culture</div>
                        <div className="text-slate-300">{candidate.agentResults.culturefit.culture_score}/100</div>
                      </div>
                    )}
                    {candidate.agentResults.compliance && (
                      <div className="bg-yellow-500/20 p-2 rounded">
                        <div className="text-yellow-400">Compliance</div>
                        <div className="text-slate-300">{candidate.agentResults.compliance.compliance_score}/100</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* All Results Table */}
          <div className="bg-slate-900/70 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">All Results ({results.length})</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left p-2 text-slate-300">Candidate</th>
                    <th className="text-center p-2 text-slate-300">Overall Score</th>
                    <th className="text-center p-2 text-slate-300">Recommendation</th>
                    <th className="text-center p-2 text-slate-300">Consensus</th>
                    <th className="text-center p-2 text-slate-300">Processing Time</th>
                    <th className="text-center p-2 text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(result => (
                    <tr key={result.candidateId} className="border-b border-slate-700">
                      <td className="p-2 text-slate-200">{result.candidateName}</td>
                      <td className="p-2 text-center">
                        <span className={`font-bold ${
                          result.overallScore >= 80 ? 'text-green-400' :
                          result.overallScore >= 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {result.overallScore}/100
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          result.recommendation === 'STRONG_HIRE' ? 'bg-green-500/20 text-green-400' :
                          result.recommendation === 'HIRE' ? 'bg-blue-500/20 text-blue-400' :
                          result.recommendation === 'CONSIDER' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {result.recommendation}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        {result.agentConsensus ? (
                          <span className="text-green-400">✅</span>
                        ) : (
                          <span className="text-yellow-400">⚠️</span>
                        )}
                      </td>
                      <td className="p-2 text-center text-slate-400">
                        {Math.round(result.processingTime)}ms
                      </td>
                      <td className="p-2 text-center">
                        {(result.recommendation === 'HIRE' || result.recommendation === 'STRONG_HIRE') && (
                          <button
                            onClick={() => onHireCandidate({ 
                              name: result.candidateName, 
                              role: extractRoleFromJobDescription(jobDescription) 
                            })}
                            className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs"
                          >
                            Hire
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiAgentProcessor;