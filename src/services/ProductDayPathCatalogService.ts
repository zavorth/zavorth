// Local for test resolution — jest.local replaces this at runtime
export class ProductDayPathCatalogService {
  list(): unknown[] { return []; }
  search(_q: string): unknown[] { return []; }
  formatForLlm(): string { return '{}'; }
  getByIds(_ids: string[]): unknown[] { return []; }
  listGroups(): unknown[] { return []; }
  toCandidateCards(): unknown[] { return []; }
}
