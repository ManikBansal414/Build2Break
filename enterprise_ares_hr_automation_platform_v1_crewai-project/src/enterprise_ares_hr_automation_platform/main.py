#!/usr/bin/env python
import sys
from enterprise_ares_hr_automation_platform.crew import EnterpriseAresHrAutomationPlatformCrew

# This main file is intended to be a way for your to run your
# crew locally, so refrain from adding unnecessary logic into this file.
# Replace with inputs you want to test with, it will automatically
# interpolate any tasks and agents information

def run():
    """
    Run the crew.
    """
    inputs = {
        'company_name': 'sample_value',
        'job_title': 'sample_value',
        'resume_content': 'sample_value',
        'job_requirements': 'sample_value',
        'company_culture': 'sample_value',
        'budget_range': 'sample_value',
        'employee_name': 'sample_value',
        'performance_data': 'sample_value',
        'career_goals': 'sample_value',
        'organizational_needs': 'sample_value',
        'skill_assessments': 'sample_value',
        'feedback_history': 'sample_value',
        'employee_query': 'sample_value',
        'employee_context': 'sample_value',
        'policy_database': 'sample_value',
        'engagement_data': 'sample_value',
        'service_history': 'sample_value',
        'hr_processes': 'sample_value',
        'regulatory_requirements': 'sample_value',
        'case_data': 'sample_value',
        'policy_updates': 'sample_value',
        'audit_requirements': 'sample_value',
        'interview_panel': 'sample_value',
        'timeline_constraints': 'sample_value',
        'hr_data': 'sample_value',
        'analytics_query': 'sample_value',
        'benchmarking_requirements': 'sample_value',
        'performance_metrics': 'sample_value',
        'engagement_surveys': 'sample_value',
        'new_hire_profile': 'sample_value',
        'team_context': 'sample_value',
        'manager_preferences': 'sample_value',
        'company_policies': 'sample_value',
        'hr_process_type': 'sample_value',
        'priority_level': 'sample_value',
        'compliance_requirements': 'sample_value',
        'stakeholder_needs': 'sample_value'
    }
    EnterpriseAresHrAutomationPlatformCrew().crew().kickoff(inputs=inputs)


def train():
    """
    Train the crew for a given number of iterations.
    """
    inputs = {
        'company_name': 'sample_value',
        'job_title': 'sample_value',
        'resume_content': 'sample_value',
        'job_requirements': 'sample_value',
        'company_culture': 'sample_value',
        'budget_range': 'sample_value',
        'employee_name': 'sample_value',
        'performance_data': 'sample_value',
        'career_goals': 'sample_value',
        'organizational_needs': 'sample_value',
        'skill_assessments': 'sample_value',
        'feedback_history': 'sample_value',
        'employee_query': 'sample_value',
        'employee_context': 'sample_value',
        'policy_database': 'sample_value',
        'engagement_data': 'sample_value',
        'service_history': 'sample_value',
        'hr_processes': 'sample_value',
        'regulatory_requirements': 'sample_value',
        'case_data': 'sample_value',
        'policy_updates': 'sample_value',
        'audit_requirements': 'sample_value',
        'interview_panel': 'sample_value',
        'timeline_constraints': 'sample_value',
        'hr_data': 'sample_value',
        'analytics_query': 'sample_value',
        'benchmarking_requirements': 'sample_value',
        'performance_metrics': 'sample_value',
        'engagement_surveys': 'sample_value',
        'new_hire_profile': 'sample_value',
        'team_context': 'sample_value',
        'manager_preferences': 'sample_value',
        'company_policies': 'sample_value',
        'hr_process_type': 'sample_value',
        'priority_level': 'sample_value',
        'compliance_requirements': 'sample_value',
        'stakeholder_needs': 'sample_value'
    }
    try:
        EnterpriseAresHrAutomationPlatformCrew().crew().train(n_iterations=int(sys.argv[1]), filename=sys.argv[2], inputs=inputs)

    except Exception as e:
        raise Exception(f"An error occurred while training the crew: {e}")

def replay():
    """
    Replay the crew execution from a specific task.
    """
    try:
        EnterpriseAresHrAutomationPlatformCrew().crew().replay(task_id=sys.argv[1])

    except Exception as e:
        raise Exception(f"An error occurred while replaying the crew: {e}")

def test():
    """
    Test the crew execution and returns the results.
    """
    inputs = {
        'company_name': 'sample_value',
        'job_title': 'sample_value',
        'resume_content': 'sample_value',
        'job_requirements': 'sample_value',
        'company_culture': 'sample_value',
        'budget_range': 'sample_value',
        'employee_name': 'sample_value',
        'performance_data': 'sample_value',
        'career_goals': 'sample_value',
        'organizational_needs': 'sample_value',
        'skill_assessments': 'sample_value',
        'feedback_history': 'sample_value',
        'employee_query': 'sample_value',
        'employee_context': 'sample_value',
        'policy_database': 'sample_value',
        'engagement_data': 'sample_value',
        'service_history': 'sample_value',
        'hr_processes': 'sample_value',
        'regulatory_requirements': 'sample_value',
        'case_data': 'sample_value',
        'policy_updates': 'sample_value',
        'audit_requirements': 'sample_value',
        'interview_panel': 'sample_value',
        'timeline_constraints': 'sample_value',
        'hr_data': 'sample_value',
        'analytics_query': 'sample_value',
        'benchmarking_requirements': 'sample_value',
        'performance_metrics': 'sample_value',
        'engagement_surveys': 'sample_value',
        'new_hire_profile': 'sample_value',
        'team_context': 'sample_value',
        'manager_preferences': 'sample_value',
        'company_policies': 'sample_value',
        'hr_process_type': 'sample_value',
        'priority_level': 'sample_value',
        'compliance_requirements': 'sample_value',
        'stakeholder_needs': 'sample_value'
    }
    try:
        EnterpriseAresHrAutomationPlatformCrew().crew().test(n_iterations=int(sys.argv[1]), openai_model_name=sys.argv[2], inputs=inputs)

    except Exception as e:
        raise Exception(f"An error occurred while testing the crew: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: main.py <command> [<args>]")
        sys.exit(1)

    command = sys.argv[1]
    if command == "run":
        run()
    elif command == "train":
        train()
    elif command == "replay":
        replay()
    elif command == "test":
        test()
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
