export const ZAVORTH_MNEMOS_QUERY_VERSION = 'zavorth-mnemos-query-v1';

export type ZavorthMnemosQueryRankSource =
  | 'sqlite-fts5'
  | 'keyword'
  | 'tag'
  | 'graph';

export type ZavorthMnemosQueryHit = {
  pageId: string;
  title: string;
  path: string;
  tags: string[];
  score: number;
  rankSources: ZavorthMnemosQueryRankSource[];
  excerpt: string;
};

export type ZavorthMnemosQuerySnapshot = {
  version: typeof ZAVORTH_MNEMOS_QUERY_VERSION;
  generatedAt: string;
  status: 'ready' | 'empty';
  query: string;
  summary: {
    pagesScanned: number;
    hits: number;
    returned: number;
    graphEdgesUsed: number;
    sqliteFtsAvailable: boolean;
  };
  ranking: {
    method: 'sqlite-fts5-keyword-tag-graph-rrf';
    topK: number;
    rrfK: number;
  };
  hits: ZavorthMnemosQueryHit[];
  context: string;
  safety: {
    wikiRootOnly: true;
    providerCall: false;
    networkCall: false;
    untrustedContextWrapped: true;
    topKOnly: true;
    secretsRedacted: true;
    sqliteIndexIsDerived: true;
  };
  receipt: {
    id: string;
    providerCall: false;
    durableMutation: false;
  };
};
