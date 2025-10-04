
export enum Agent {
  TalentScout = 'TalentScout',
  Onboarder = 'Onboarder',
  PolicyQA = 'PolicyQA',
  Manager = 'Manager',
  MultiAgentProcessor = 'MultiAgentProcessor',
}

export interface ScreeningResult {
  candidate_name: string;
  role_applied_for: string;
  match_score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'CONSIDER' | 'NO_HIRE';
  reasoning: string;
}

export interface CandidateContext {
    name: string;
    role: string;
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    timestamp?: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AgentCapabilities {
  canProcess: string[];
  outputs: string[];
  dependencies: string[];
}

export interface WorkflowTransition {
  from: Agent;
  to: Agent;
  condition: string;
  data?: any;
}
