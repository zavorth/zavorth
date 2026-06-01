export type SecurityMeshSnapshotPort = {
  buildSnapshot(): {
    narrative: {
      operatorSummary: string;
      trustBoundary: string;
    };
    posture: {
      label: string;
    };
    summary: {
      totalModes: number;
      coreReady: number;
      extensionsReady: number;
      gvisorActive: boolean;
      firecrackerReady: boolean;
      neverDowngrade: boolean;
    };
  };
};
