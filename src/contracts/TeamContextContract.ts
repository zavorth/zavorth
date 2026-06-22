export type ZavorthTeamMember = {
  name: string;
  role: string;
  contactPreference?: string;
};

export type ZavorthTeamContext = {
  schemaVersion: 'zavorth.team-context/v1';
  teamName?: string;
  teamSize: number;
  members: ZavorthTeamMember[];
  sharedChannels: string[];
  codeReviewPolicy: string;
  namingConventions: string;
  updatedAt: string;
};
