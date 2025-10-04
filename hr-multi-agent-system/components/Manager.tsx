import React, { useState, useEffect } from 'react';
import { Agent, CandidateContext } from '../types';
import { memoryService, CandidateRecord, WorkflowState } from '../services/memoryService';
import Spinner from './common/Spinner';

interface ManagerProps {
  onNavigateToAgent: (agent: Agent, candidateId?: string) => void;
}

const Manager: React.FC<ManagerProps> = ({ onNavigateToAgent }) => {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    loadData();
    
    // Set up an interval to refresh data periodically
    const interval = setInterval(() => {
      loadData();
    }, 2000); // Refresh every 2 seconds
    
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setCandidates(memoryService.getAllCandidates());
    setWorkflowState(memoryService.getWorkflowState());
  };

  const handleCandidateSelect = (candidateId: string) => {
    setSelectedCandidate(candidateId);
    const candidate = candidates.find(c => c.id === candidateId);
    if (candidate) {
      // Update workflow state
      const newWorkflowState: WorkflowState = {
        currentAgent: 'Manager',
        currentCandidateId: candidateId,
        workflowStep: getNextWorkflowStep(candidate.status),
        metadata: { lastUpdated: new Date().toISOString() }
      };
      memoryService.saveWorkflowState(newWorkflowState);
      setWorkflowState(newWorkflowState);
    }
  };

  const getNextWorkflowStep = (status: string): 'screening' | 'review' | 'onboarding' | 'policy_questions' => {
    switch (status) {
      case 'screened': return 'review';
      case 'hired': return 'onboarding';
      case 'onboarding': return 'policy_questions';
      default: return 'screening';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'screened': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'hired': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'onboarding': return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getRecommendationColor = (recommendation?: string) => {
    switch (recommendation) {
      case 'STRONG_HIRE': return 'text-green-400';
      case 'HIRE': return 'text-blue-400';
      case 'CONSIDER': return 'text-yellow-400';
      case 'NO_HIRE': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const navigateToAgent = (agent: Agent) => {
    if (selectedCandidate) {
      onNavigateToAgent(agent, selectedCandidate);
    } else {
      onNavigateToAgent(agent);
    }
  };

  const deleteCandidate = (candidateId: string) => {
    if (confirm('Are you sure you want to delete this candidate? This action cannot be undone.')) {
      memoryService.deleteCandidateRecord(candidateId);
      loadData();
      if (selectedCandidate === candidateId) {
        setSelectedCandidate(null);
      }
    }
  };

  const exportData = () => {
    const data = memoryService.exportAllData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hr-system-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (memoryService.importData(content)) {
          loadData();
          alert('Data imported successfully!');
        } else {
          alert('Failed to import data. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const clearAllData = () => {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      memoryService.clearAllData();
      loadData();
      setSelectedCandidate(null);
    }
  };

  const selectedCandidateData = selectedCandidate 
    ? candidates.find(c => c.id === selectedCandidate) 
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-indigo-400 mb-2">HR Manager Dashboard</h2>
        <p className="text-slate-400">Orchestrate your HR workflow and manage candidates</p>
      </div>

      {/* Workflow Status */}
      {workflowState && (
        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
          <h3 className="text-lg font-semibold text-cyan-400 mb-2">Current Workflow</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Current Agent:</span>
              <span className="ml-2 text-white font-medium">{workflowState.currentAgent}</span>
            </div>
            <div>
              <span className="text-slate-400">Workflow Step:</span>
              <span className="ml-2 text-white font-medium capitalize">{workflowState.workflowStep}</span>
            </div>
            <div>
              <span className="text-slate-400">Active Candidate:</span>
              <span className="ml-2 text-white font-medium">
                {workflowState.currentCandidateId ? 
                  candidates.find(c => c.id === workflowState.currentCandidateId)?.personalInfo.name || 'Unknown'
                  : 'None'
                }
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Candidates List */}
        <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-cyan-400">Candidates ({candidates.length})</h3>
            <div className="flex gap-2">
              <button
                onClick={loadData}
                className="px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm font-medium transition-colors"
                title="Refresh data"
              >
                ↻ Refresh
              </button>
              <button
                onClick={() => onNavigateToAgent(Agent.TalentScout)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors"
              >
                Add New
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {candidates.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No candidates yet. Start by screening resumes!</p>
            ) : (
              candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedCandidate === candidate.id
                      ? 'bg-indigo-500/20 border-indigo-500'
                      : 'bg-slate-800/50 border-slate-600 hover:border-slate-500'
                  }`}
                  onClick={() => handleCandidateSelect(candidate.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{candidate.personalInfo.name}</h4>
                      <p className="text-sm text-slate-400">{candidate.personalInfo.role}</p>
                      {candidate.team && (
                        <p className="text-xs text-slate-500">Team: {candidate.team}</p>
                      )}
                      {candidate.screeningResult && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-slate-400">Score:</span>
                          <span className="text-sm font-medium">{candidate.screeningResult.match_score}/100</span>
                          <span className={`text-xs font-medium ${getRecommendationColor(candidate.screeningResult.recommendation)}`}>
                            {candidate.screeningResult.recommendation}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(candidate.status)}`}>
                        {candidate.status}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCandidate(candidate.id);
                        }}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Candidate Details & Actions */}
        <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
          <h3 className="text-xl font-semibold text-cyan-400 mb-4">
            {selectedCandidateData ? 'Candidate Details' : 'Select a Candidate'}
          </h3>

          {selectedCandidateData ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-white mb-2">{selectedCandidateData.personalInfo.name}</h4>
                <p className="text-slate-400 text-sm">Role: {selectedCandidateData.personalInfo.role}</p>
                {selectedCandidateData.team && (
                  <p className="text-slate-400 text-sm">Team: {selectedCandidateData.team}</p>
                )}
                <p className="text-slate-400 text-sm">
                  Status: <span className="capitalize">{selectedCandidateData.status}</span>
                </p>
                <p className="text-slate-400 text-sm">
                  Created: {selectedCandidateData.createdAt.toLocaleDateString()}
                </p>
              </div>

              {selectedCandidateData.screeningResult && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h5 className="font-medium text-white mb-2">Screening Results</h5>
                  <div className="space-y-2 text-sm">
                    <p className="text-slate-400">
                      Match Score: <span className="text-white font-medium">{selectedCandidateData.screeningResult.match_score}/100</span>
                    </p>
                    <p className="text-slate-400">
                      Recommendation: <span className={`font-medium ${getRecommendationColor(selectedCandidateData.screeningResult.recommendation)}`}>
                        {selectedCandidateData.screeningResult.recommendation}
                      </span>
                    </p>
                    <p className="text-slate-400">{selectedCandidateData.screeningResult.summary}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h5 className="font-medium text-white">Available Actions</h5>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => navigateToAgent(Agent.TalentScout)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                  >
                    Review/Re-screen
                  </button>
                  <button
                    onClick={() => navigateToAgent(Agent.Onboarder)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors"
                  >
                    Create Onboarding Plan
                  </button>
                  <button
                    onClick={() => navigateToAgent(Agent.PolicyQA)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                  >
                    Policy Questions
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">
              Select a candidate from the list to view details and available actions.
            </p>
          )}
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
        <h3 className="text-xl font-semibold text-cyan-400 mb-4">Data Management</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportData}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm transition-colors"
          >
            Export Data
          </button>
          <label className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm transition-colors cursor-pointer">
            Import Data
            <input
              type="file"
              accept=".json"
              onChange={importData}
              className="hidden"
            />
          </label>
          <button
            onClick={clearAllData}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
          >
            Clear All Data
          </button>
        </div>
        <p className="text-slate-400 text-sm mt-2">
          Export your data for backup or import previously exported data. 
          Clear all data will permanently remove all candidates, conversations, and workflow state.
        </p>
      </div>
    </div>
  );
};

export default Manager;