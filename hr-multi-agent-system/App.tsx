
import React, { useState, useCallback, useEffect } from 'react';
import { Agent, CandidateContext } from './types';
import { memoryService, CandidateRecord, WorkflowState } from './services/memoryService';
import AgentSelector from './components/AgentSelector';
import TalentScout from './components/TalentScout';
import MultiAgentProcessor from './components/MultiAgentProcessor';
import Onboarder from './components/Onboarder';
import PolicyQA from './components/PolicyQA';
import Manager from './components/Manager';
  
const App: React.FC = () => {
  const [activeAgent, setActiveAgent] = useState<Agent>(Agent.Manager);
  const [candidateContext, setCandidateContext] = useState<CandidateContext | null>(null);
  const [currentCandidateId, setCurrentCandidateId] = useState<string | null>(null);

  useEffect(() => {
    // Load workflow state on app start
    const workflowState = memoryService.getWorkflowState();
    if (workflowState && workflowState.currentCandidateId) {
      const candidate = memoryService.getCandidateRecord(workflowState.currentCandidateId);
      if (candidate) {
        setCandidateContext(candidate.personalInfo);
        setCurrentCandidateId(candidate.id);
      }
    }
  }, []);

  const handleHireCandidate = useCallback((candidate: CandidateContext) => {
    // Create or update candidate record
    const candidateId = memoryService.generateCandidateId();
    const candidateRecord: CandidateRecord = {
      id: candidateId,
      personalInfo: candidate,
      status: 'hired',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    memoryService.saveCandidateRecord(candidateRecord);
    setCandidateContext(candidate);
    setCurrentCandidateId(candidateId);
    
    // Update workflow state
    const workflowState: WorkflowState = {
      currentAgent: 'Onboarder',
      currentCandidateId: candidateId,
      workflowStep: 'onboarding',
      metadata: { hiredAt: new Date().toISOString() }
    };
    memoryService.saveWorkflowState(workflowState);
    
    setActiveAgent(Agent.Onboarder);
  }, []);

  const handleNavigateToAgent = useCallback((agent: Agent, candidateId?: string) => {
    if (candidateId) {
      const candidate = memoryService.getCandidateRecord(candidateId);
      if (candidate) {
        setCandidateContext(candidate.personalInfo);
        setCurrentCandidateId(candidateId);
        
        // Update workflow state
        const workflowState: WorkflowState = {
          currentAgent: agent,
          currentCandidateId: candidateId,
          workflowStep: getWorkflowStep(agent),
          metadata: { navigatedAt: new Date().toISOString() }
        };
        memoryService.saveWorkflowState(workflowState);
      }
    } else {
      setCandidateContext(null);
      setCurrentCandidateId(null);
    }
    
    setActiveAgent(agent);
  }, []);

  const getWorkflowStep = (agent: Agent): 'screening' | 'review' | 'onboarding' | 'policy_questions' => {
    switch (agent) {
      case Agent.TalentScout: return 'screening';
      case Agent.MultiAgentProcessor: return 'screening';
      case Agent.Onboarder: return 'onboarding';
      case Agent.PolicyQA: return 'policy_questions';
      default: return 'review';
    }
  };

  const renderActiveAgent = () => {
    switch (activeAgent) {
      case Agent.Manager:
        return <Manager onNavigateToAgent={handleNavigateToAgent} />;
      case Agent.TalentScout:
        return <TalentScout onHireCandidate={handleHireCandidate} currentCandidateId={currentCandidateId} />;
      case Agent.MultiAgentProcessor:
        return <MultiAgentProcessor onHireCandidate={handleHireCandidate} />;
      case Agent.Onboarder:
        return <Onboarder candidate={candidateContext} currentCandidateId={currentCandidateId} />;
      case Agent.PolicyQA:
        return <PolicyQA currentCandidateId={currentCandidateId} />;
      default:
        return <Manager onNavigateToAgent={handleNavigateToAgent} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            HR Multi-Agent System
          </h1>
          <p className="mt-2 text-slate-400">Your intelligent HR automation solution.</p>
        </header>

        <main className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl shadow-2xl shadow-slate-950/50 overflow-hidden">
          <AgentSelector activeAgent={activeAgent} setActiveAgent={handleNavigateToAgent} />
          <div className="p-6 sm:p-8">
            {renderActiveAgent()}
          </div>
        </main>
        <footer className="text-center mt-8 text-slate-500 text-sm">
            <p>Powered by Gemini API</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
