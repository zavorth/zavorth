// Local for test resolution — jest.local replaces this at runtime
export class ProductDayPathCatalogService {
  list(): any[] { return []; }
  search(_q: string): any[] { return []; }
  formatForLlm(): string { return '{}'; }
  getByIds(_ids: string[]): any[] { return []; }
  listGroups(): any[] { return []; }
  toCandidateCards(): any[] { return []; }
}
