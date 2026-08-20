export function useZavorthControlOperatorWorkbench(viewModel: any = {}) {
  const canonicalPath = '/api/v2/nexus/workbench';
  return viewModel.operatorWorkbench || viewModel.nexusWorkbench || {
    canonicalPath,
    status: 'unknown',
    operatorExperience: {
      statusLabel: 'Operator Workbench',
      cards: [],
    },
    capabilities: {
      nextAction: 'Abrir readiness completo',
    },
  };
}

export const useZavorthControlNexusWorkbench = useZavorthControlOperatorWorkbench;
