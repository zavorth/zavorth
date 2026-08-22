export interface PlanStep {
  step_id: string;
  type: string;
  description: string;
  tool: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any | null;
  command: string | null;
  file_targets: string[];
  expected_output: string | null;
  sensitive: boolean;
}

export interface Plan {
  plan_id: string;
  task_id: string;
  objective: string;
  context: string;
  assumptions: string[];
  executor_recommendation: string;
  workspace_recommendation: string | null;
  risk_level: number;
  requires_approval: boolean;
  steps: PlanStep[];
  validation_steps: string[];
  success_condition: string;
  rollback_condition: string | null;
  notes: string[];
}
