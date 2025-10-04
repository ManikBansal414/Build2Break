
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Chat } from '@google/genai';
import { createPolicyQAChat } from '../services/geminiService';
import { memoryService, ConversationHistory } from '../services/memoryService';
import { ValidationService } from '../services/validationService';
import type { ChatMessage } from '../types';
import Spinner from './common/Spinner';

interface PolicyQAProps {
    currentCandidateId?: string | null;
}

const PolicyQA: React.FC<PolicyQAProps> = ({ currentCandidateId }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setChat(createPolicyQAChat());
        
        // Load conversation history if available
        const conversations = memoryService.getConversationsByAgent('PolicyQA');
        const candidateConversations = currentCandidateId 
            ? conversations.filter(c => c.candidateId === currentCandidateId)
            : conversations.filter(c => !c.candidateId);
            
        if (candidateConversations.length > 0) {
            // Load the most recent conversation
            const latestConversation = candidateConversations[candidateConversations.length - 1];
            setMessages(latestConversation.messages);
        } else {
            setMessages([{
                role: 'model',
                text: "Hello! I'm PolicyBot. Ask me anything about our company policies.",
                timestamp: new Date()
            }]);
        }
    }, [currentCandidateId]);
    
    useEffect(() => {
        chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight);
    }, [messages]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || !chat || loading) return;

        // Validate user input
        const validation = ValidationService.validateChatMessage(userInput);
        if (!validation.isValid) {
            setError(`Input validation failed: ${validation.errors.join(', ')}`);
            return;
        }
        
        if (validation.warnings.length > 0) {
            setValidationWarnings(validation.warnings);
        }

        const userMessage: ChatMessage = { 
            role: 'user', 
            text: userInput, 
            timestamp: new Date() 
        };
        setMessages(prev => [...prev, userMessage]);
        setUserInput('');
        setLoading(true);
        setError(null);

        try {
            const result = await chat.sendMessageStream({ message: userInput });
            let modelResponse = '';
            
            // Add a placeholder for streaming
            setMessages(prev => [...prev, { role: 'model', text: '', timestamp: new Date() }]);

            for await (const chunk of result) {
                modelResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { 
                        role: 'model', 
                        text: modelResponse, 
                        timestamp: new Date() 
                    };
                    return newMessages;
                });
            }

            // Save conversation to memory
            const conversation: ConversationHistory = {
                agentType: 'PolicyQA',
                messages: [userMessage, { role: 'model', text: modelResponse, timestamp: new Date() }],
                candidateId: currentCandidateId || undefined,
                timestamp: new Date()
            };
            memoryService.saveConversation(conversation);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            setMessages(prev => [...prev, { role: 'model', text: `Sorry, I encountered an error: ${errorMessage}`, timestamp: new Date() }]);
        } finally {
            setLoading(false);
        }
    }, [userInput, chat, loading, currentCandidateId]);

    return (
        <div className="flex flex-col h-[65vh] animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-indigo-400">Policy Q&A</h2>
                <p className="text-slate-400 mt-1 mb-4">Ask questions about the company handbook. This chat has memory.</p>
                {currentCandidateId && (
                    <p className="text-cyan-400 text-sm">Conversation linked to candidate</p>
                )}
            </div>

            {/* Validation Warnings */}
            {validationWarnings.length > 0 && (
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
                    <h4 className="text-yellow-400 font-medium mb-1">Warnings:</h4>
                    <ul className="text-yellow-300 text-sm space-y-1">
                        {validationWarnings.map((warning, index) => (
                            <li key={index}>• {warning}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 bg-slate-900/70 rounded-t-lg space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-lg p-3 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                           {msg.text === '' && msg.role === 'model' ? <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-pulse"></div> : msg.text}
                        </div>
                    </div>
                ))}
                 {loading && messages[messages.length - 1].role === 'user' && (
                    <div className="flex justify-start">
                        <div className="max-w-lg p-3 rounded-lg bg-slate-700 text-slate-200">
                           <Spinner />
                        </div>
                    </div>
                )}
            </div>
            
            {error && <div className="bg-red-900/50 border-t border-red-700 text-red-300 p-2 text-center text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="flex items-center p-2 bg-slate-800 border-t border-slate-700 rounded-b-lg">
                <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Ask a policy question..."
                    className="flex-1 bg-slate-700 border-transparent focus:ring-2 focus:ring-indigo-500 focus:border-transparent rounded-md p-2 text-slate-200 transition"
                    disabled={loading}
                />
                <button type="submit" disabled={loading || !userInput.trim()} className="ml-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition">
                    Send
                </button>
            </form>
        </div>
    );
};

export default PolicyQA;
