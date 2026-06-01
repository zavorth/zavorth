export type PlatformRegistryStatusPort = {
  buildStatusSummarySnapshot(): {
    narrative: {
      operatorSummary: string;
      headline: string;
    };
    catalogSync: {
      summary: string;
    };
    summary: {
      total: number;
      plugins: number;
      skills: number;
      mcps: number;
      collections: number;
      recipes: number;
    };
  };
};
