import { GoogleGenAI } from "@google/genai";

export interface AgentStatus {
  id: string;
  name: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  tasksCompleted: number;
  averageProcessingTime: number;
  errorCount: number;
  currentTask?: string;
  throughput: number;
}

export interface AgentTask {
  id: string;
  agentType: 'TalentScout' | 'SkillsAnalyst' | 'CultureFit' | 'Onboarder' | 'ComplianceChecker';
  candidateId: string;
  input: any;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: string;
}

export interface ConcurrentProcessingResult {
  candidateId: string;
  candidateName: string;
  overallScore: number;
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'CONSIDER' | 'NO_HIRE';
  agentResults: {
    talentscout?: any;
    skillsanalyst?: any;
    culturefit?: any;
    onboarder?: any;
    compliance?: any;
  };
  processingTime: number;
  agentConsensus: boolean;
  conflictResolution?: string;
}

class AgentOrchestrator {
  private agents: Map<string, AgentStatus> = new Map();
  private taskQueue: AgentTask[] = [];
  private activeTasks: Map<string, AgentTask> = new Map();
  private genAI: GoogleGenAI;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(apiKey: string) {
    this.genAI = new GoogleGenAI({ apiKey });
    this.initializeAgents();
  }

  private initializeAgents() {
    const agentConfigs = [
      { id: 'talentscout', name: 'TalentScout', specialization: 'resume-screening' },
      { id: 'skillsanalyst', name: 'SkillsAnalyst', specialization: 'technical-skills' },
      { id: 'culturefit', name: 'CultureFit', specialization: 'cultural-assessment' },
      { id: 'onboarder', name: 'Onboarder', specialization: 'onboarding-plans' },
      { id: 'compliance', name: 'ComplianceChecker', specialization: 'legal-compliance' }
    ];

    agentConfigs.forEach(config => {
      this.agents.set(config.id, {
        id: config.id,
        name: config.name,
        status: 'idle',
        tasksCompleted: 0,
        averageProcessingTime: 0,
        errorCount: 0,
        throughput: 0
      });
    });
  }

  addEventListener(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  private emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => callback(data));
  }

  // Parse multiple resumes from a single text file
  parseMultipleResumesFromText(resumesText: string): Array<{ resume: string; name: string; role: string }> {
    // Define common delimiters for separating resumes
    const delimiters = [
      /(?:^|\n)\s*(?:RESUME|Resume)\s*(?:\d+|[A-Z])\s*[-–—]\s*([^\n]+)/gim,
      /(?:^|\n)\s*(?:CANDIDATE|Candidate)\s*(?:\d+|[A-Z])\s*[-–—]\s*([^\n]+)/gim,
      /(?:^|\n)\s*[-=]{3,}\s*([^\n]+)\s*[-=]{3,}/gim,
      /(?:^|\n)\s*\*{3,}\s*([^\n]+)\s*\*{3,}/gim
    ];

    let resumeSections: string[] = [];
    let foundDelimiter = false;

    // Try each delimiter pattern
    for (const delimiter of delimiters) {
      const matches = Array.from(resumesText.matchAll(delimiter));
      if (matches.length > 1) {
        // Split by this delimiter
        resumeSections = resumesText.split(delimiter).filter(section => section.trim().length > 100);
        foundDelimiter = true;
        break;
      }
    }

    // If no clear delimiters found, try to split by large gaps or repeated patterns
    if (!foundDelimiter) {
      // Try splitting by double newlines followed by names (common pattern)
      const namePattern = /\n\s*([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*\n/g;
      const nameMatches = Array.from(resumesText.matchAll(namePattern));
      
      if (nameMatches.length > 1) {
        // Split by name patterns
        resumeSections = resumesText.split(namePattern).filter(section => section.trim().length > 100);
      } else {
        // Last resort: split by very long gaps (4+ newlines)
        resumeSections = resumesText.split(/\n{4,}/).filter(section => section.trim().length > 100);
      }
    }

    // If still only one section, return it as a single resume
    if (resumeSections.length <= 1) {
      const extractedName = this.extractNameFromResume(resumesText);
      const extractedRole = this.extractRoleFromResume(resumesText);
      return [{
        resume: resumesText.trim(),
        name: extractedName || 'Unknown Candidate',
        role: extractedRole || 'Unknown Role'
      }];
    }

    // Process each resume section
    return resumeSections.map((section, index) => {
      const cleanSection = section.trim();
      const name = this.extractNameFromResume(cleanSection) || `Candidate ${index + 1}`;
      const role = this.extractRoleFromResume(cleanSection) || 'Unknown Role';

      return {
        resume: cleanSection,
        name,
        role
      };
    }).filter(resume => resume.resume.length > 50); // Filter out very short sections
  }

  // Extract candidate name from resume text
  private extractNameFromResume(resumeText: string): string | null {
    // Common patterns for names at the beginning of resumes
    const namePatterns = [
      /^([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/m,
      /Name:\s*([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /^([A-Z]{2,}(?:\s+[A-Z]{2,})+)/m, // All caps names
      /Resume.*?[-–—]\s*([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
    ];

    for (const pattern of namePatterns) {
      const match = resumeText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  // Extract role/position from resume text
  private extractRoleFromResume(resumeText: string): string | null {
    // Common patterns for roles/positions
    const rolePatterns = [
      /(?:seeking|applying for|interested in)\s+(.+?)(?:\n|$)/i,
      /(?:position|role):\s*(.+?)(?:\n|$)/i,
      /(?:software engineer|developer|analyst|manager|coordinator|specialist|consultant|architect|designer)[^.\n]*/i,
      /(?:experience|skills?).*?(?:as|in)\s+(.+?)(?:\n|$)/i
    ];

    for (const pattern of rolePatterns) {
      const match = resumeText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  // Enhanced method to process multiple resumes from text file
  async processMultipleResumesFromFile(
    resumesText: string,
    jobDescription: string
  ): Promise<ConcurrentProcessingResult[]> {
    // Parse multiple resumes from the text
    const candidates = this.parseMultipleResumesFromText(resumesText);
    
    console.log(`Parsed ${candidates.length} resume(s) from file:`, 
      candidates.map(c => `${c.name} (${c.role})`));
    
    // Process all candidates concurrently
    return this.processCandidatesConcurrently(candidates, jobDescription);
  }

  async processCandidatesConcurrently(
    candidates: Array<{ resume: string; name: string; role: string }>,
    jobDescription: string
  ): Promise<ConcurrentProcessingResult[]> {
    
    this.emit('batch_started', { count: candidates.length });
    
    // Create tasks for all candidates across all agents
    const allTasks: AgentTask[] = [];
    const timestamp = Date.now(); // Generate timestamp once for all candidates
    
    candidates.forEach((candidate, index) => {
      const candidateId = `candidate_${timestamp}_${index}`;
      
      // Create concurrent tasks for each agent type
      const tasks = [
        {
          id: `${candidateId}_talent_scout`,
          agentType: 'TalentScout' as const,
          candidateId,
          input: { resume: candidate.resume, jobDescription, candidateName: candidate.name },
          priority: 1,
          status: 'pending' as const
        },
        {
          id: `${candidateId}_skills`,
          agentType: 'SkillsAnalyst' as const,
          candidateId,
          input: { resume: candidate.resume, role: candidate.role },
          priority: 1,
          status: 'pending' as const
        },
        {
          id: `${candidateId}_culture`,
          agentType: 'CultureFit' as const,
          candidateId,
          input: { resume: candidate.resume, candidateName: candidate.name },
          priority: 1,
          status: 'pending' as const
        }
      ];
      
      allTasks.push(...tasks);
    });

    // Execute all tasks concurrently
    const taskPromises = allTasks.map(task => this.executeTask(task));
    const taskResults = await Promise.allSettled(taskPromises);

    // Group results by candidate
    const candidateResults = new Map<string, any[]>();
    
    taskResults.forEach((result, index) => {
      const task = allTasks[index];
      const candidateId = task.candidateId;
      
      if (!candidateResults.has(candidateId)) {
        candidateResults.set(candidateId, []);
      }
      
      if (result.status === 'fulfilled') {
        candidateResults.get(candidateId)!.push({
          agentType: task.agentType,
          result: result.value,
          task
        });
      }
    });

    // Compile final results
    const finalResults: ConcurrentProcessingResult[] = [];
    
    candidates.forEach((candidate, index) => {
      const candidateId = `candidate_${timestamp}_${index}`; // Use same timestamp
      const agentResults = candidateResults.get(candidateId) || [];
      
      console.log(`Processing results for ${candidateId}:`, agentResults.length, 'agent results');
      
      // Calculate overall score and recommendation
      const scores = agentResults.map(r => r.result?.match_score || r.result?.technical_score || r.result?.culture_score || 0);
      console.log(`Scores for ${candidate.name}:`, scores);
      
      const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      
      // Determine recommendation based on scores
      let recommendation: 'STRONG_HIRE' | 'HIRE' | 'CONSIDER' | 'NO_HIRE';
      if (overallScore >= 85) recommendation = 'STRONG_HIRE';
      else if (overallScore >= 70) recommendation = 'HIRE';
      else if (overallScore >= 50) recommendation = 'CONSIDER';
      else recommendation = 'NO_HIRE';

      const result: ConcurrentProcessingResult = {
        candidateId,
        candidateName: candidate.name,
        overallScore,
        recommendation,
        agentResults: {
          talentscout: agentResults.find(r => r.agentType === 'TalentScout')?.result,
          skillsanalyst: agentResults.find(r => r.agentType === 'SkillsAnalyst')?.result,
          culturefit: agentResults.find(r => r.agentType === 'CultureFit')?.result
        },
        processingTime: 0,
        agentConsensus: true
      };
      
      console.log(`Final result for ${candidate.name}:`, result);
      finalResults.push(result);
    });

    this.emit('batch_completed', { results: finalResults });
    return finalResults;
  }

  private async executeTask(task: AgentTask): Promise<any> {
    const startTime = Date.now();
    task.startTime = startTime;
    task.status = 'processing';
    
    // Update agent status
    const agentId = task.agentType.toLowerCase();
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'busy';
      agent.currentTask = `Processing ${task.candidateId}`;
    }

    this.emit('task_started', { task, agent: agentId });

    try {
      let result;
      
      switch (task.agentType) {
        case 'TalentScout':
          result = await this.runTalentScout(task.input);
          break;
        case 'SkillsAnalyst':
          result = await this.runSkillsAnalyst(task.input);
          break;
        case 'CultureFit':
          result = await this.runCultureFit(task.input);
          break;
        case 'Onboarder':
          result = await this.runOnboarder(task.input);
          break;
        case 'ComplianceChecker':
          result = await this.runComplianceChecker(task.input);
          break;
        default:
          throw new Error(`Unknown agent type: ${task.agentType}`);
      }

      const endTime = Date.now();
      task.endTime = endTime;
      task.status = 'completed';
      task.result = result;

      // Update agent metrics
      if (agent) {
        agent.status = 'idle';
        agent.tasksCompleted++;
        agent.averageProcessingTime = (agent.averageProcessingTime + (endTime - startTime)) / 2;
        agent.currentTask = undefined;
      }

      this.emit('task_completed', { task, processingTime: endTime - startTime });
      return result;

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';

      if (agent) {
        agent.status = 'error';
        agent.errorCount++;
        agent.currentTask = undefined;
      }

      this.emit('task_failed', { task, error: task.error });
      throw error;
    }
  }

  private async runTalentScout(input: { resume: string; jobDescription: string; candidateName: string }) {
    // Generate realistic scores for demo
    const score = Math.floor(Math.random() * 50) + 50; // 50-100
    const recommendations = ['STRONG_HIRE', 'HIRE', 'CONSIDER', 'NO_HIRE'];
    const recommendation = score >= 85 ? 'STRONG_HIRE' : score >= 70 ? 'HIRE' : score >= 50 ? 'CONSIDER' : 'NO_HIRE';
    
    return {
      candidate_name: input.candidateName,
      role_applied_for: 'Software Developer',
      match_score: score,
      summary: `Candidate evaluated with ${score}% match to job requirements`,
      strengths: ['Technical skills', 'Experience', 'Problem solving'],
      weaknesses: ['Communication', 'Leadership experience'],
      recommendation,
      reasoning: `Based on resume analysis, candidate shows ${score >= 75 ? 'strong' : score >= 50 ? 'moderate' : 'limited'} alignment with job requirements.`,
      technical_skills: ['Programming', 'Database design'],
      experience_years: Math.floor(Math.random() * 8) + 1,
      agent_confidence: Math.floor(Math.random() * 30) + 70
    };
  }

  private async runSkillsAnalyst(input: { resume: string; role: string }) {
    const score = Math.floor(Math.random() * 40) + 60; // 60-100
    
    return {
      technical_score: score,
      primary_skills: ['Programming', 'Database Design', 'System Architecture'],
      secondary_skills: ['Testing', 'Documentation', 'Version Control'],
      skill_gaps: ['Cloud Computing', 'DevOps', 'Microservices'],
      certification_level: 'INTERMEDIATE',
      years_experience: Math.floor(Math.random() * 8) + 2,
      agent_confidence: Math.floor(Math.random() * 30) + 70
    };
  }

  private async runCultureFit(input: { resume: string; candidateName: string }) {
    const score = Math.floor(Math.random() * 30) + 70; // 70-100
    
    return {
      culture_score: score,
      communication_style: 'COLLABORATIVE',
      team_preference: 'SMALL_TEAM',
      work_style: 'FLEXIBLE',
      personality_traits: ['Analytical', 'Detail-oriented', 'Team player'],
      potential_concerns: ['Limited leadership experience'],
      cultural_strengths: ['Strong communication', 'Adaptable', 'Growth mindset'],
      agent_confidence: Math.floor(Math.random() * 25) + 75
    };
  }

  private async runOnboarder(input: { candidateName: string; role: string }) {
    return {
      onboarding_plan: `30-day onboarding plan for ${input.candidateName}`,
      estimated_completion: 21,
      mentor_assignment: 'Senior Developer',
      team_assignment: 'Development Team A',
      agent_confidence: 85
    };
  }

  private async runComplianceChecker(input: { resume: string; role: string }) {
    return {
      compliance_score: 95,
      eligibility_status: 'ELIGIBLE',
      background_check_required: true,
      documentation_needed: ['ID verification', 'Education certificates'],
      agent_confidence: 90
    };
  }

  getAgentStatuses(): AgentStatus[] {
    return Array.from(this.agents.values());
  }
}

export default AgentOrchestrator;