import type { ApprovalLease } from './ApprovalLeaseTypes.js';

export class InMemoryApprovalLeaseStore {
  private static readonly leases = new Map<string, ApprovalLease>();

  public static createLease(lease: ApprovalLease): void {
    this.leases.set(lease.leaseId, { ...lease });
  }

  public static getLease(leaseId: string): ApprovalLease | undefined {
    const found = this.leases.get(leaseId);
    return found ? { ...found } : undefined;
  }

  public static revokeLease(leaseId: string, revokedAt: string): void {
    const lease = this.leases.get(leaseId);
    if (lease) {
      lease.revokedAt = revokedAt;
    }
  }

  public static findLeaseForSubjectToolWorkspace(
    subjectId: string,
    toolQualifiedName: string,
    workspaceId: string
  ): ApprovalLease[] {
    const results: ApprovalLease[] = [];
    for (const lease of this.leases.values()) {
      if (
        lease.subjectId === subjectId &&
        lease.toolQualifiedName === toolQualifiedName &&
        lease.workspaceId === workspaceId
      ) {
        results.push({ ...lease });
      }
    }
    return results;
  }

  public static clearForTests(): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('clearForTests is only allowed in test environment');
    }
    this.leases.clear();
  }
}
