import { UniversalStreamingAdapter } from "../../src/adapters/overlord/UniversalStreamingAdapter";
import { TokenChunk } from "../../src/contracts/StreamingContract";

describe("UniversalStreamingAdapter", () => {
  let adapter: UniversalStreamingAdapter;

  beforeEach(() => {
    adapter = new UniversalStreamingAdapter();
  });

  it("should emit token deltas with incrementing sequence IDs to subscribers", async () => {
    const receivedChunks: TokenChunk[] = [];
    const unsubscribe = adapter.subscribe("worker_1", (chunk) => {
      receivedChunks.push(chunk);
    });

    await adapter.emitTokenDelta("worker_1", "Hello ");
    await adapter.emitTokenDelta("worker_1", "World!", true);

    expect(receivedChunks).toHaveLength(2);
    expect(receivedChunks[0].sequenceId).toBe(1);
    expect(receivedChunks[0].content).toBe("Hello ");
    expect(receivedChunks[1].sequenceId).toBe(2);
    expect(receivedChunks[1].isFinal).toBe(true);

    unsubscribe();
  });

  it("should cleanup subscribers on final chunk emission", async () => {
    let callCount = 0;
    adapter.subscribe("worker_2", () => {
      callCount++;
    });

    await adapter.emitTokenDelta("worker_2", "Chunk", true);
    expect(callCount).toBe(1);

    await adapter.emitTokenDelta("worker_2", "New Stream");
    expect(callCount).toBe(1);
  });
});
