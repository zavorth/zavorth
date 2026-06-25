export type ZavorthLearningStyle =
  | 'examples-first'
  | 'theory-first'
  | 'hands-on'
  | 'visual'
  | 'step-by-step';

export type ZavorthLearningPreferences = {
  schemaVersion: 'zavorth.learning-preferences/v1';
  primaryStyle: ZavorthLearningStyle;
  depthPreference: 'shallow' | 'moderate' | 'deep';
  documentationPreference: 'official-docs' | 'blog-posts' | 'mixed';
  handsOnPreference: 'try-first' | 'read-first' | 'mixed';
  updatedAt: string;
};
