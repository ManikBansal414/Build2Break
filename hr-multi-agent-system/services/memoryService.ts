import { ScreeningResult, CandidateContext, ChatMessage } from '../types';

export interface CandidateRecord {
  id: string;
  personalInfo: CandidateContext;
  screeningResult?: ScreeningResult;
  onboardingPlan?: string;
  team?: string;
  status: 'screened' | 'hired' | 'onboarding' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowState {
  currentAgent: string;
  currentCandidateId?: string;
  workflowStep: 'screening' | 'review' | 'onboarding' | 'policy_questions';
  metadata?: Record<string, any>;
}

export interface ConversationHistory {
  agentType: string;
  messages: ChatMessage[];
  candidateId?: string;
  timestamp: Date;
}

class MemoryService {
  private readonly CANDIDATES_KEY = 'hr_candidates';
  private readonly WORKFLOW_KEY = 'hr_workflow';
  private readonly CONVERSATIONS_KEY = 'hr_conversations';
  private readonly SESSION_KEY = 'hr_session';

  // Candidate Management
  saveCandidateRecord(candidate: CandidateRecord): void {
    const candidates = this.getAllCandidates();
    const existingIndex = candidates.findIndex(c => c.id === candidate.id);
    
    candidate.updatedAt = new Date();
    
    if (existingIndex >= 0) {
      candidates[existingIndex] = candidate;
    } else {
      candidates.push(candidate);
    }
    
    localStorage.setItem(this.CANDIDATES_KEY, JSON.stringify(candidates));
  }

  getCandidateRecord(id: string): CandidateRecord | null {
    const candidates = this.getAllCandidates();
    return candidates.find(c => c.id === id) || null;
  }

  getAllCandidates(): CandidateRecord[] {
    const stored = localStorage.getItem(this.CANDIDATES_KEY);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored).map((c: any) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt)
      }));
    } catch {
      return [];
    }
  }

  deleteCandidateRecord(id: string): void {
    const candidates = this.getAllCandidates().filter(c => c.id !== id);
    localStorage.setItem(this.CANDIDATES_KEY, JSON.stringify(candidates));
  }

  // Workflow State Management
  saveWorkflowState(state: WorkflowState): void {
    localStorage.setItem(this.WORKFLOW_KEY, JSON.stringify(state));
  }

  getWorkflowState(): WorkflowState | null {
    const stored = localStorage.getItem(this.WORKFLOW_KEY);
    if (!stored) return null;
    
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  clearWorkflowState(): void {
    localStorage.removeItem(this.WORKFLOW_KEY);
  }

  // Conversation History
  saveConversation(conversation: ConversationHistory): void {
    const conversations = this.getAllConversations();
    conversations.push(conversation);
    
    // Keep only last 50 conversations to prevent storage bloat
    if (conversations.length > 50) {
      conversations.splice(0, conversations.length - 50);
    }
    
    localStorage.setItem(this.CONVERSATIONS_KEY, JSON.stringify(conversations));
  }

  getAllConversations(): ConversationHistory[] {
    const stored = localStorage.getItem(this.CONVERSATIONS_KEY);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored).map((c: any) => ({
        ...c,
        timestamp: new Date(c.timestamp)
      }));
    } catch {
      return [];
    }
  }

  getConversationsByCandidate(candidateId: string): ConversationHistory[] {
    return this.getAllConversations().filter(c => c.candidateId === candidateId);
  }

  getConversationsByAgent(agentType: string): ConversationHistory[] {
    return this.getAllConversations().filter(c => c.agentType === agentType);
  }

  // Session Management
  saveSessionData(key: string, data: any): void {
    const session = this.getSessionData();
    session[key] = data;
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
  }

  getSessionData(): Record<string, any> {
    const stored = sessionStorage.getItem(this.SESSION_KEY);
    if (!stored) return {};
    
    try {
      return JSON.parse(stored);
    } catch {
      return {};
    }
  }

  clearSessionData(): void {
    sessionStorage.removeItem(this.SESSION_KEY);
  }

  // Utility methods
  generateCandidateId(): string {
    return `candidate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Update candidate status helper
  updateCandidateStatus(id: string, status: 'screened' | 'hired' | 'onboarding' | 'completed'): boolean {
    const candidate = this.getCandidateRecord(id);
    if (candidate) {
      candidate.status = status;
      candidate.updatedAt = new Date();
      this.saveCandidateRecord(candidate);
      return true;
    }
    return false;
  }

  // Get candidates by status
  getCandidatesByStatus(status: 'screened' | 'hired' | 'onboarding' | 'completed'): CandidateRecord[] {
    return this.getAllCandidates().filter(c => c.status === status);
  }

  exportAllData(): string {
    return JSON.stringify({
      candidates: this.getAllCandidates(),
      conversations: this.getAllConversations(),
      workflow: this.getWorkflowState(),
      exportDate: new Date().toISOString()
    }, null, 2);
  }

  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.candidates) {
        localStorage.setItem(this.CANDIDATES_KEY, JSON.stringify(data.candidates));
      }
      
      if (data.conversations) {
        localStorage.setItem(this.CONVERSATIONS_KEY, JSON.stringify(data.conversations));
      }
      
      if (data.workflow) {
        localStorage.setItem(this.WORKFLOW_KEY, JSON.stringify(data.workflow));
      }
      
      return true;
    } catch {
      return false;
    }
  }

  clearAllData(): void {
    localStorage.removeItem(this.CANDIDATES_KEY);
    localStorage.removeItem(this.WORKFLOW_KEY);
    localStorage.removeItem(this.CONVERSATIONS_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
  }
}

export const memoryService = new MemoryService();