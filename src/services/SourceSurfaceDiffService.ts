import type {
  SourceDiscoveredSurface,
  SourceSurfaceDiffItem,
  SourceSurfaceDiffSnapshot,
  SourceSurfaceLedgerEntry,
  SourceSurfacePriority,
} from '../contracts/SourceSurfaceLedgerContract.js';

export class SourceSurfaceDiffService {
  public diff(
    ledgerEntries: SourceSurfaceLedgerEntry[],
    discoveredSurfaces: SourceDiscoveredSurface[],
  ): SourceSurfaceDiffSnapshot {
    const entriesBySurface = new Map<string, SourceSurfaceLedgerEntry>();
    for (const entry of ledgerEntries) {
      entriesBySurface.set(surfaceKey(entry.category, entry.sourcePath), entry);
    }

    const discoveredBySurface = new Map<string, SourceDiscoveredSurface>();
    for (const surface of discoveredSurfaces) {
      discoveredBySurface.set(surfaceKey(surface.category, surface.sourcePath), surface);
    }

    const unclassified: SourceSurfaceDiffItem[] = [];
    const missingFromCheckout: SourceSurfaceDiffItem[] = [];
    const evidenceChanged: SourceSurfaceDiffItem[] = [];
    let classified = 0;

    for (const surface of discoveredSurfaces) {
      const entry = entriesBySurface.get(surfaceKey(surface.category, surface.sourcePath));
      if (!entry) {
        unclassified.push({
          category: surface.category,
          sourcePath: surface.sourcePath,
          item: surface.item,
          priority: priorityForUnclassified(surface.category),
          severity: 'blocking',
          reason: 'Discovered Source surface has no ledger decision.',
          evidence: surface.evidence,
        });
        continue;
      }

      classified += 1;
      if (hasEvidenceCountChanged(entry.sourceEvidence, surface.evidence)) {
        evidenceChanged.push({
          category: surface.category,
          sourcePath: surface.sourcePath,
          item: surface.item,
          priority: entry.priority,
          severity: 'warning',
          reason: 'Source surface evidence counts changed since the ledger was generated.',
          ledgerEntryId: entry.id,
          decision: entry.decision,
          evidence: [
            `ledger=${entry.sourceEvidence.join(',') || 'none'}`,
            `current=${surface.evidence.join(',') || 'none'}`,
          ],
        });
      }
    }

    for (const entry of ledgerEntries) {
      if (discoveredBySurface.has(surfaceKey(entry.category, entry.sourcePath))) continue;
      missingFromCheckout.push({
        category: entry.category,
        sourcePath: entry.sourcePath,
        item: entry.item,
        priority: entry.priority,
        severity: 'warning',
        reason: 'Ledger entry was not found in the current Source checkout scan.',
        ledgerEntryId: entry.id,
        decision: entry.decision,
        evidence: entry.sourceEvidence,
      });
    }

    return {
      classified,
      unclassified: sortDiffItems(unclassified),
      missingFromCheckout: sortDiffItems(missingFromCheckout),
      evidenceChanged: sortDiffItems(evidenceChanged),
    };
  }
}

function surfaceKey(category: string, sourcePath: string): string {
  return `${category}:${sourcePath.replace(/\\/g, '/')}`;
}

function hasEvidenceCountChanged(ledgerEvidence: string[], currentEvidence: string[]): boolean {
  const ledgerCounts = parseEvidenceCounts(ledgerEvidence);
  const currentCounts = parseEvidenceCounts(currentEvidence);
  if (!ledgerCounts || !currentCounts) return false;
  return ledgerCounts.files !== currentCounts.files || ledgerCounts.dirs !== currentCounts.dirs;
}

function parseEvidenceCounts(evidence: string[]): { files: number; dirs: number } | null {
  let files: number | null = null;
  let dirs: number | null = null;

  for (const item of evidence) {
    const filesMatch = /^files=(\d+)$/.exec(item);
    if (filesMatch) files = Number(filesMatch[1]);
    const dirsMatch = /^dirs=(\d+)$/.exec(item);
    if (dirsMatch) dirs = Number(dirsMatch[1]);
  }

  if (files === null || dirs === null) return null;
  return { files, dirs };
}

function priorityForUnclassified(category: string): SourceSurfacePriority {
  if (category === 'native_app' || category === 'internal_package') return 'P0';
  if (category === 'src_module' || category === 'runtime_dependency') return 'P1';
  return 'P2';
}

function sortDiffItems(items: SourceSurfaceDiffItem[]): SourceSurfaceDiffItem[] {
  return items.sort((left, right) => {
    const category = left.category.localeCompare(right.category);
    if (category !== 0) return category;
    return left.sourcePath.localeCompare(right.sourcePath);
  });
}
