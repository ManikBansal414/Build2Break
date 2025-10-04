
import React, { useState, useEffect, useCallback } from 'react';
import { createOnboardingPlan } from '../services/geminiService';
import { memoryService, CandidateRecord } from '../services/memoryService';
import { ValidationService } from '../services/validationService';
import { CandidateContext } from '../types';
import Spinner from './common/Spinner';

interface OnboarderProps {
    candidate: CandidateContext | null;
    currentCandidateId?: string | null;
}

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const lines = content.split('\n');
    return (
        <div className="prose prose-invert prose-sm sm:prose-base max-w-none space-y-2">
            {lines.map((line, index) => {
                if (line.startsWith('###')) {
                    return <h3 key={index} className="font-bold text-lg mt-4 text-cyan-400">{line.replace('###', '').trim()}</h3>;
                }
                if (line.startsWith('##')) {
                    return <h2 key={index} className="font-bold text-xl mt-6 border-b border-slate-700 pb-2 text-indigo-400">{line.replace('##', '').trim()}</h2>;
                }
                if (line.startsWith('#')) {
                    return <h1 key={index} className="font-bold text-2xl mb-4 text-indigo-400">{line.replace('#', '').trim()}</h1>;
                }
                if (line.startsWith('* ')) {
                    return <li key={index} className="ml-4 list-disc">{line.substring(2)}</li>;
                }
                if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={index} className="font-bold">{line.substring(2, line.length - 2)}</p>;
                }
                return <p key={index}>{line}</p>;
            })}
        </div>
    );
};


const Onboarder: React.FC<OnboarderProps> = ({ candidate, currentCandidateId }) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [team, setTeam] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [plan, setPlan] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        if (candidate) {
            setName(candidate.name);
            setRole(candidate.role);
        }
        
        // Load existing onboarding plan if available
        if (currentCandidateId) {
            const candidateRecord = memoryService.getCandidateRecord(currentCandidateId);
            if (candidateRecord) {
                setName(candidateRecord.personalInfo.name);
                setRole(candidateRecord.personalInfo.role);
                if (candidateRecord.team) {
                    setTeam(candidateRecord.team);
                }
                if (candidateRecord.onboardingPlan) {
                    setPlan(candidateRecord.onboardingPlan);
                }
            }
        }
    }, [candidate, currentCandidateId]);

    useEffect(() => {
        // Real-time validation
        const errors: string[] = [];
        
        if (name) {
            const nameValidation = ValidationService.validateName(name);
            errors.push(...nameValidation.errors);
        }
        
        if (role) {
            const roleValidation = ValidationService.validateRole(role);
            errors.push(...roleValidation.errors);
        }
        
        if (team) {
            const teamValidation = ValidationService.validateTeam(team);
            errors.push(...teamValidation.errors);
        }
        
        setValidationErrors(errors);
    }, [name, role, team]);

    const canSubmit = name.trim().length > 0 && role.trim().length > 0 && team.trim().length > 0 && validationErrors.length === 0;

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setLoading(true);
        setError(null);
        setPlan(null);
        
        try {
            const generatedPlan = await createOnboardingPlan(name, role, team);
            setPlan(generatedPlan);
            setRetryCount(0);
            
            // Save to memory
            if (currentCandidateId) {
                const existingCandidate = memoryService.getCandidateRecord(currentCandidateId);
                if (existingCandidate) {
                    const updatedCandidate: CandidateRecord = {
                        ...existingCandidate,
                        team,
                        onboardingPlan: generatedPlan,
                        status: 'onboarding',
                        updatedAt: new Date()
                    };
                    memoryService.saveCandidateRecord(updatedCandidate);
                }
            } else {
                // Create new candidate record
                const candidateId = memoryService.generateCandidateId();
                const candidateRecord: CandidateRecord = {
                    id: candidateId,
                    personalInfo: { name, role },
                    team,
                    onboardingPlan: generatedPlan,
                    status: 'onboarding',
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                memoryService.saveCandidateRecord(candidateRecord);
            }
            
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            
            // Retry logic
            if (retryCount < 3 && errorMessage.includes('API')) {
                setTimeout(() => {
                    setRetryCount(prev => prev + 1);
                    handleSubmit(e);
                }, 2000 * (retryCount + 1));
            }
        } finally {
            setLoading(false);
        }
    }, [name, role, team, canSubmit, currentCandidateId, retryCount]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-indigo-400">Onboarder: Plan Generation</h2>
                <p className="text-slate-400 mt-1">Enter new hire details to generate a personalized 30-day onboarding plan.</p>
                {currentCandidateId && (
                    <p className="text-cyan-400 text-sm mt-1">Creating onboarding plan for existing candidate</p>
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

            {retryCount > 0 && (
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
                    <p className="text-blue-400 text-sm">Retrying API request... (Attempt {retryCount + 1}/4)</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">New Hire Name</label>
                        <input
                            type="text"
                            id="name"
                            className="w-full bg-slate-900 border border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 text-slate-200 transition"
                            placeholder="e.g., Jane Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-slate-300 mb-1">Role</label>
                        <input
                            type="text"
                            id="role"
                            className="w-full bg-slate-900 border border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 text-slate-200 transition"
                            placeholder="e.g., Senior Software Engineer"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="team" className="block text-sm font-medium text-slate-300 mb-1">Team</label>
                    <input
                        type="text"
                        id="team"
                        className="w-full bg-slate-900 border border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 text-slate-200 transition"
                        placeholder="e.g., Platform Engineering"
                        value={team}
                        onChange={(e) => setTeam(e.target.value)}
                    />
                </div>
                <div>
                    <button
                        type="submit"
                        disabled={!canSubmit || loading}
                        className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition duration-300"
                    >
                        {loading ? <><Spinner /> Generating Plan...</> : 'Generate Onboarding Plan'}
                    </button>
                </div>
            </form>

            {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-md">{error}</div>}

            {plan && (
                <div className="space-y-4 pt-4 border-t border-slate-700 animate-fade-in">
                    <h3 className="text-xl font-bold">Onboarding Plan for {name}</h3>
                    <div className="bg-slate-900/70 p-4 sm:p-6 rounded-lg">
                        <MarkdownRenderer content={plan} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Onboarder;
