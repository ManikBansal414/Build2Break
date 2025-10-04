import os

from crewai import LLM
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import (
	FileReadTool,
	OCRTool,
	ScrapeWebsiteTool
)






@CrewBase
class EnterpriseAresHrAutomationPlatformCrew:
    """EnterpriseAresHrAutomationPlatform crew"""

    
    @agent
    def chief_hr_orchestrator(self) -> Agent:

        
        return Agent(
            config=self.agents_config["chief_hr_orchestrator"],
            
            
            tools=[

            ],
            reasoning=True,
            max_reasoning_attempts=3,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model="claude-sonnet-4-5",
                temperature=0.7,
            ),
            
        )
    
    @agent
    def onboarder_agent(self) -> Agent:

        
        return Agent(
            config=self.agents_config["onboarder_agent"],
            
            
            tools=[
				FileReadTool()
            ],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model="claude-sonnet-4-5",
                temperature=0.7,
            ),
            
        )
    
    @agent
    def recruitment_specialist_agent(self) -> Agent:

        
        return Agent(
            config=self.agents_config["recruitment_specialist_agent"],
            
            
            tools=[
				FileReadTool(),
				OCRTool(),
				ScrapeWebsiteTool()
            ],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model="gpt-4o-mini",
                temperature=0.7,
            ),
            
        )
    
    @agent
    def interview_coordinator_agent(self) -> Agent:

        
        return Agent(
            config=self.agents_config["interview_coordinator_agent"],
            
            
            tools=[
				FileReadTool()
            ],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model="gpt-4o-mini",
                temperature=0.7,
            ),
            
        )
    
    @agent
    def performance_analyst_agent(self) -> Agent:

        
        return Agent(
            config=self.agents_config["performance_analyst_agent"],
            
            
            tools=[
				FileReadTool()
            ],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model="gpt-4o-mini",
                temperature=0.7,
            ),
            
        )
    
    @agent
    def employee_relations_agent(self) -> Agent:

        
        return Agent(
            config=self.agents_config["employee_relations_agent"],
            
            
            tools=[
				FileReadTool(),
				ScrapeWebsiteTool()
            ],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model="gpt-4o-mini",
                temperature=0.7,
            ),
            
        )
    
    @agent
    def compliance_monitor_agent(self) -> Agent:

        
        return Agent(
            config=self.agents_config["compliance_monitor_agent"],
            
            
            tools=[
				FileReadTool(),
				ScrapeWebsiteTool()
            ],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model="gpt-4o-mini",
                temperature=0.7,
            ),
            
        )
    
    @agent
    def hr_analytics_agent(self) -> Agent:

        
        return Agent(
            config=self.agents_config["hr_analytics_agent"],
            
            
            tools=[
				FileReadTool(),
				ScrapeWebsiteTool()
            ],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model="gpt-4o-mini",
                temperature=0.7,
            ),
            
        )
    

    
    @task
    def execute_comprehensive_recruitment_process(self) -> Task:
        return Task(
            config=self.tasks_config["execute_comprehensive_recruitment_process"],
            markdown=False,
            
            
        )
    
    @task
    def analyze_performance_and_development(self) -> Task:
        return Task(
            config=self.tasks_config["analyze_performance_and_development"],
            markdown=False,
            
            
        )
    
    @task
    def provide_employee_experience_support(self) -> Task:
        return Task(
            config=self.tasks_config["provide_employee_experience_support"],
            markdown=False,
            
            
        )
    
    @task
    def monitor_compliance_and_risk(self) -> Task:
        return Task(
            config=self.tasks_config["monitor_compliance_and_risk"],
            markdown=False,
            
            
        )
    
    @task
    def design_intelligent_interview_process(self) -> Task:
        return Task(
            config=self.tasks_config["design_intelligent_interview_process"],
            markdown=False,
            
            
        )
    
    @task
    def generate_hr_analytics_and_insights(self) -> Task:
        return Task(
            config=self.tasks_config["generate_hr_analytics_and_insights"],
            markdown=False,
            
            
        )
    
    @task
    def create_adaptive_onboarding_experience(self) -> Task:
        return Task(
            config=self.tasks_config["create_adaptive_onboarding_experience"],
            markdown=False,
            
            
        )
    
    @task
    def orchestrate_enterprise_hr_automation(self) -> Task:
        return Task(
            config=self.tasks_config["orchestrate_enterprise_hr_automation"],
            markdown=False,
            
            
        )
    

    @crew
    def crew(self) -> Crew:
        """Creates the EnterpriseAresHrAutomationPlatform crew"""
        return Crew(
            agents=self.agents,  # Automatically created by the @agent decorator
            tasks=self.tasks,  # Automatically created by the @task decorator
            process=Process.sequential,
            verbose=True,
        )

    def _load_response_format(self, name):
        with open(os.path.join(self.base_directory, "config", f"{name}.json")) as f:
            json_schema = json.loads(f.read())

        return SchemaConverter.build(json_schema)
