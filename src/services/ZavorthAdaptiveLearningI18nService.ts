import type { ZavorthAdaptiveLearningSnapshot } from '../contracts/native/ZavorthAdaptiveLearningOsContract.js';

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
  title: 'Sistema de Aprendizado Adaptactive Zavorth',
  status: 'status',
  green: 'Faixa Verde',
  yellow: 'Faixa Amarela',
  red: 'Faixa Vermelha',
  userModel: 'modeloUser',
  shadowSkills: 'skillsSombra',
  policy: 'Policy: local learning, reversible and inspectable.',
  greenPolicy: 'The green lane adapts low-risk preferences with receipts.',
  yellowPolicy: 'A Faixa Amarela prepara procedimentos, rascunhos e melhorias de skill para review.',
  redPolicy: 'The Red Lane requires explicit approval and blocks raw psychological diagnosis.',
  qa: 'QA',
  autoApplied: 'autoaplicado(s)',
  digestItems: 'item(s) no digest',
  approvalItems: 'item(s) requiring approval',
  evidenceRecords: 'registro(s) com evidence',
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
    try {
      if (new Intl.Locale(normalized).language === 'pt') return PT;
    } catch {
      if (normalized === 'pt') return PT;
    }
    return EN;
  }
}
