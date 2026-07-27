import { MnemosGraphCurator, MemoryNode } from "../../src/storage/MnemosGraphCurator";

describe("MnemosGraphCurator", () => {
  let curator: MnemosGraphCurator;

  beforeEach(() => {
    curator = new MnemosGraphCurator();
  });

  it("should process raw memory nodes and return graph consolidation results", async () => {
    const nodes: MemoryNode[] = [
      { id: "node_1", category: "episodic", content: "Built project container", tags: ["docker"], timestamp: Date.now() },
      { id: "node_2", category: "episodic", content: "Deployed to production server", tags: ["deploy"], timestamp: Date.now() }
    ];

    const result = await curator.consolidateMemoryNodes(nodes);

    expect(result.nodesConsolidated).toBe(2);
    expect(result.graphEdgesAdded.length).toBeGreaterThan(0);
  });
});
