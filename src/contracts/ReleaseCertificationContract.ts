export * from './release/ReleaseCertificationContract.js';

export const ZAVORTH_RELEASE_CERTIFICATION_CONTRACT_VERSION_PUBLIC_MARKER =
  'ZAVORTH_RELEASE_CERTIFICATION_CONTRACT_VERSION';

export type ReleaseCertificationPublicAuditVocabulary = {
  profile: 'ReleaseCertificationProfile';
  status: 'ReleaseCertificationStatus';
  gate: 'ReleaseCertificationGate';
  waiver: 'ReleaseCertificationWaiver';
  receipt: 'ReleaseCertificationReceipt';
  snapshot: 'ReleaseCertificationSnapshot';
  nextPhase: 'Etapa 10 - P0 Gap Closure';
  policy: {
    waiversMustBeExplicit: true;
    secretValuesSerialized: false;
  };
};
