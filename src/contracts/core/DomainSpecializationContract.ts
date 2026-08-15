export type ZavorthDomainId =
  | 'software-engineering'
  | 'data-science'
  | 'devops'
  | 'creative-writing'
  | 'business-ops'
  | 'research'
  | 'education'
  | 'healthcare'
  | 'legal'
  | 'finance'
  | 'general';

export type ZavorthDomainProfile = {
  id: ZavorthDomainId;
  label: string;
  audience: string;
  vocabulary: string[];
  preferredTools: string[];
  assumptions: string[];
  commonWorkflows: string[];
};

export type ZavorthDomainResolution = {
  domainId: ZavorthDomainId;
  confidence: 'explicit' | 'high' | 'medium' | 'fallback';
  reason: string;
  matchedSignals: string[];
};

export type ZavorthDomainSpecializationContract = {
  schemaVersion: 1;
  surface: 'domain-specialization';
  selected: {
    domainId: ZavorthDomainId;
    vocabulary: string[];
    preferredTools: string[];
    assumptions: string[];
  };
  resolution: ZavorthDomainResolution;
  domains: ZavorthDomainProfile[];
};
