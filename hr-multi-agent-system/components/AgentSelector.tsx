
import React from 'react';
import { Agent } from '../types';
import { FileTextIcon } from './common/icons/FileTextIcon';
import { UserCheckIcon } from './common/icons/UserCheckIcon';
import { BookOpenIcon } from './common/icons/BookOpenIcon';
import { ManagerIcon } from './common/icons/ManagerIcon';

interface AgentSelectorProps {
  activeAgent: Agent;
  setActiveAgent: (agent: Agent, candidateId?: string) => void;
}

const agents = [
  { id: Agent.Manager, name: 'Manager', description: 'Dashboard & Workflow', icon: ManagerIcon },
  { id: Agent.TalentScout, name: 'TalentScout', description: 'Resume Screening', icon: FileTextIcon },
  { id: Agent.Onboarder, name: 'Onboarder', description: 'Onboarding Plans', icon: UserCheckIcon },
  { id: Agent.PolicyQA, name: 'Policy Q&A', description: 'Company Policies', icon: BookOpenIcon },
];

const AgentSelector: React.FC<AgentSelectorProps> = ({ activeAgent, setActiveAgent }) => {
  return (
    <div className="flex justify-center border-b border-slate-700 bg-slate-900/50">
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => setActiveAgent(agent.id)}
          className={`flex-1 sm:flex-grow-0 sm:flex-shrink-0 sm:w-1/4 py-4 px-2 sm:px-4 text-center text-sm sm:text-base font-medium transition-all duration-300 ease-in-out border-b-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 rounded-t-lg
            ${activeAgent === agent.id 
              ? 'border-indigo-400 text-white' 
              : 'border-transparent text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
            }`}
        >
          <div className="flex items-center justify-center gap-2">
            <agent.icon className="w-5 h-5" />
            <div className="flex flex-col items-start">
              <span className="font-bold">{agent.name}</span>
              <span className="hidden md:inline text-xs text-slate-500">{agent.description}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default AgentSelector;
