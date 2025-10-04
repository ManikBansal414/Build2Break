

# HR Multi-Agent System

A comprehensive AI-powered HR automation solution that handles resume screening, onboarding plan creation, and policy questions with advanced memory management and workflow orchestration.

## 🚀 Features

### 🤖 Multi-Agent Architecture
- **Manager/Orchestrator**: Central dashboard for workflow management and candidate oversight
- **TalentScout**: AI-powered resume screening with detailed analysis and recommendations
- **Onboarder**: Automated 30-day onboarding plan generation with personalization
- **PolicyQA**: Interactive chatbot for company policy questions with conversation memory

### 💾 Advanced Memory System
- **Persistent Storage**: Local storage for candidates, conversations, and workflow state
- **Candidate Records**: Complete tracking from screening to onboarding completion
- **Conversation History**: Full chat history preservation across sessions
- **Workflow State**: Resume where you left off with automatic state restoration

### 🛡️ Security & Validation
- **Input Validation**: Comprehensive validation for all user inputs
- **Sanitization**: XSS protection and content cleaning
- **File Validation**: Safe file upload with type and size restrictions
- **Prompt Injection Protection**: Detection and prevention of malicious prompts

### 🔄 Reliability Features
- **Retry Logic**: Automatic retry with exponential backoff for API failures
- **Error Recovery**: Graceful error handling with user-friendly messages
- **Data Export/Import**: Backup and restore functionality
- **Real-time Validation**: Live input validation with helpful feedback

## 📦 Installation & Setup

### Prerequisites
- **Node.js** (version 16 or higher)
- **Gemini API Key** from Google AI Studio

### Quick Start

1. **Clone or download the project**
   ```bash
   cd hr-multi-agent-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Create/edit `.env.local` in the project root
   - Add your Gemini API key:
     ```
     GEMINI_API_KEY=your_actual_api_key_here
     ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   - Navigate to `http://localhost:3000`
   - The app will open with the Manager dashboard

## 🎯 Usage Guide

### Getting Started
1. **Start with Manager Dashboard**: Overview of all candidates and workflow status
2. **Screen Resumes**: Use TalentScout to analyze resumes against job descriptions
3. **Create Onboarding Plans**: Generate personalized plans for hired candidates
4. **Policy Q&A**: Interactive assistance for HR policy questions

### Agent Workflows

#### TalentScout (Resume Screening)
- Upload resume files (.txt, .pdf, .doc, .docx) or paste text
- Enter detailed job descriptions
- Get AI-powered analysis with:
  - Match score (0-100)
  - Strengths and weaknesses
  - Hiring recommendation
  - Detailed reasoning

#### Onboarder (Onboarding Plans)
- Enter candidate details (name, role, team)
- Generate comprehensive 30-day plans with:
  - Week-by-week breakdown
  - Specific action items
  - Manager check-in points
  - Team integration activities

#### PolicyQA (Policy Assistant)
- Interactive chat interface
- Company policy knowledge base
- Conversation memory across sessions
- Context-aware responses

#### Manager (Orchestrator)
- Central candidate management
- Workflow state tracking
- Data export/import functionality
- Cross-agent navigation

## 🏗️ Technical Architecture

### Frontend Stack
- **React 19.2.0** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Custom animations** and transitions

### AI Integration
- **Google Gemini 2.5 Flash** for AI processing
- **Structured outputs** with JSON schema validation
- **Streaming responses** for real-time interaction
- **Error handling** with retry mechanisms

### Data Management
- **LocalStorage** for persistent data
- **SessionStorage** for temporary state
- **In-memory** conversation tracking
- **Export/Import** functionality

### Validation & Security
- **Input sanitization** for XSS prevention
- **File type validation** for secure uploads
- **Prompt injection detection** for AI safety
- **Real-time validation** with user feedback

## 📊 Data Structure

### Candidate Records
```typescript
interface CandidateRecord {
  id: string;
  personalInfo: { name: string; role: string };
  screeningResult?: ScreeningResult;
  onboardingPlan?: string;
  team?: string;
  status: 'screened' | 'hired' | 'onboarding' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}
```

### Workflow State
```typescript
interface WorkflowState {
  currentAgent: string;
  currentCandidateId?: string;
  workflowStep: 'screening' | 'review' | 'onboarding' | 'policy_questions';
  metadata?: Record<string, any>;
}
```

## 🔧 Configuration

### Environment Variables
- `GEMINI_API_KEY`: Your Google AI Studio API key (required)

### Available Scripts
- `npm run dev`: Start development server (port 3000)
- `npm run build`: Build for production
- `npm run preview`: Preview production build

## 🛠️ Development

### Project Structure
```
hr-multi-agent-system/
├── components/
│   ├── Manager.tsx          # Orchestrator dashboard
│   ├── TalentScout.tsx      # Resume screening
│   ├── Onboarder.tsx        # Onboarding plans
│   ├── PolicyQA.tsx         # Policy Q&A chat
│   ├── AgentSelector.tsx    # Navigation component
│   └── common/              # Shared components
├── services/
│   ├── geminiService.ts     # AI API integration
│   ├── memoryService.ts     # Data persistence
│   └── validationService.ts # Input validation
├── types.ts                 # TypeScript definitions
└── styles/
    └── custom.css          # Custom styling
```

### Key Features Implemented


✅ **Multi-Agent System** with Manager orchestration  
✅ **Memory System** with local storage persistence  
✅ **Input Validation** with real-time feedback  
✅ **Retry Logic** with exponential backoff  



✅ **Error Recovery** with graceful degradation  
✅ **Data Export/Import** for backup/restore  
✅ **Workflow Management** with state tracking  
✅ **Security Features** with XSS protection  


✅ **Responsive Design** with modern UI  
✅ **Real-time Validation** with user guidance  

## 🔒 Security Features

- **Input Sanitization**: All user inputs are cleaned and validated
- **File Validation**: Upload restrictions and content scanning
- **XSS Protection**: HTML/JavaScript content filtering
- **Prompt Injection Prevention**: AI prompt safety measures
- **Data Validation**: Type checking and format validation

## 📈 Performance Features

- **Lazy Loading**: Components loaded on demand
- **Caching**: Local storage for frequently accessed data
- **Retry Logic**: Automatic recovery from temporary failures
- **Streaming**: Real-time AI response streaming
- **Debouncing**: Optimized input validation

## 🤝 Contributing

This project implements a complete HR Multi-Agent System as specified in Problem Statement 2. All core requirements have been implemented with additional security and reliability features.

## 📄 License

This project is created for demonstration purposes and includes all necessary components for a production-ready HR automation system.

## 🆘 Troubleshooting

### Common Issues

1. **API Key Error**: Ensure `GEMINI_API_KEY` is correctly set in `.env.local`
2. **Build Errors**: Run `npm install` to ensure all dependencies are installed
3. **Storage Issues**: Clear browser localStorage if experiencing data corruption
4. **Network Errors**: Check internet connection and API key validity

### Support

For technical issues or questions about implementation, refer to the code comments and documentation within each component.

---

**View your app in AI Studio**: https://ai.studio/apps/temp/1
