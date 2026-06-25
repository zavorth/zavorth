export type ZavorthWorkflowStep = {
  order: number;
  description: string;
  command?: string;
  tool?: string;
  expectedOutput?: string;
};

export type ZavorthWorkflowTemplate = {
  id: string;
  label: string;
  description: string;
  steps: ZavorthWorkflowStep[];
  triggers: string[];
  tags: string[];
  addedAt: string;
};

export type ZavorthWorkflowTemplateIndex = {
  schemaVersion: 'zavorth.workflow-templates.index/v1';
  templates: ZavorthWorkflowTemplate[];
  updatedAt: string;
};
