import type { ZavorthAdaptiveLearningSnapshot } from '../contracts/ZavorthAdaptiveLearningOsContract.js';

export type ZavorthAdaptiveLearningRenderOptions = {
  locale?: string | null;
};

type Catalog = {
  title: string;
  status: string;
  green: string;
  yellow: string;
  red: string;
  userModel: string;
  shadowSkills: string;
  policy: string;
  greenPolicy: string;
  yellowPolicy: string;
  redPolicy: string;
  qa: string;
  autoApplied: string;
  digestItems: string;
  approvalItems: string;
  evidenceRecords: string;
  drafts: string;
};

const EN: Catalog = {
  title: 'Zavorth Adaptive Learning OS',
  status: 'status',
  green: 'Green Lane',
  yellow: 'Yellow Lane',
  red: 'Red Lane',
  userModel: 'userModel',
  shadowSkills: 'shadowSkills',
  policy: 'Policy: local-only, reversible and inspectable learning.',
  greenPolicy: 'Green Lane can adapt low-risk preferences with receipts.',
  yellowPolicy: 'Yellow Lane stages procedures, drafts and skill improvements for digest review.',
  redPolicy: 'Red Lane requires explicit approval and blocks raw psychological diagnosis.',
  qa: 'QA',
  autoApplied: 'auto-applied',
  digestItems: 'digest item(s)',
  approvalItems: 'approval item(s)',
  evidenceRecords: 'evidence-bound record(s)',
  drafts: 'draft(s)',
};

const PT: Catalog = {
  title: 'Sistema de Aprendizado Adaptativo Zavorth',
  status: 'status',
  green: 'Faixa Verde',
  yellow: 'Faixa Amarela',
  red: 'Faixa Vermelha',
  userModel: 'modeloUsuario',
  shadowSkills: 'skillsSombra',
  policy: 'Politica: aprendizado local, reversivel e inspecionavel.',
  greenPolicy: 'A Faixa Verde adapta preferencias de baixo risco com recibos.',
  yellowPolicy: 'A Faixa Amarela prepara procedimentos, rascunhos e melhorias de skill para revisao.',
  redPolicy: 'A Faixa Vermelha exige aprovacao explicita e bloqueia diagnostico psicologico bruto.',
  qa: 'QA',
  autoApplied: 'autoaplicado(s)',
  digestItems: 'item(ns) no digest',
  approvalItems: 'item(ns) exigindo aprovacao',
  evidenceRecords: 'registro(s) com evidencia',
  drafts: 'rascunho(s)',
};

export class ZavorthAdaptiveLearningI18nService {
  public render(snapshot: ZavorthAdaptiveLearningSnapshot, options: ZavorthAdaptiveLearningRenderOptions = {}): string {
    const catalog = this.catalogFor(options.locale);
    return [
      catalog.title,
      '',
      `${catalog.status}=${snapshot.status}`,
      `${catalog.green}=${snapshot.summary.greenAutoApplied} ${catalog.autoApplied}`,
      `${catalog.yellow}=${snapshot.summary.yellowDigestItems} ${catalog.digestItems}`,
      `${catalog.red}=${snapshot.summary.redApprovalRequired} ${catalog.approvalItems}`,
      `${catalog.userModel}=${snapshot.summary.userModelRecords} ${catalog.evidenceRecords}`,
      `${catalog.shadowSkills}=${snapshot.summary.shadowSkillDrafts} ${catalog.drafts}`,
      '',
      catalog.policy,
      catalog.greenPolicy,
      catalog.yellowPolicy,
      catalog.redPolicy,
      '',
      `${catalog.qa}: ${snapshot.commands.check}`,
    ].join('\n');
  }

  private catalogFor(locale: string | null | undefined): Catalog {
    const normalized = String(locale || 'en').trim().toLowerCase().replace(/_/g, '-');
    if (normalized.startsWith('pt')) return PT;
    return EN;
  }
}
