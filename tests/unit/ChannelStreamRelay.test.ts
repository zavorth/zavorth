import { ChannelStreamRelay } from "../../src/gateways/channels/ChannelStreamRelay";
import { StreamChannelAdapter, TokenChunk } from "../../src/contracts/StreamingContract";

describe("ChannelStreamRelay", () => {
  let mockChannelAdapter: jest.Mocked<StreamChannelAdapter>;
  let streamRelay: ChannelStreamRelay;

  beforeEach(() => {
    mockChannelAdapter = {
      sendStreamChunk: jest.fn().mockImplementation(async (channelId, messageId, text) => {
        return messageId || "msg_1001";
      })
    };
    streamRelay = new ChannelStreamRelay(mockChannelAdapter, { minChunkIntervalMs: 50 });
  });

  it("should accumulate and dispatch tokens to channel adapter", async () => {
    const chunk1: TokenChunk = { workerId: "w1", sequenceId: 1, content: "Hello ", isFinal: false, timestamp: Date.now() };
    const chunk2: TokenChunk = { workerId: "w1", sequenceId: 2, content: "World!", isFinal: true, timestamp: Date.now() };

    await streamRelay.processTokenChunk("chan_1", "w1", chunk1);
    await streamRelay.processTokenChunk("chan_1", "w1", chunk2);

    expect(mockChannelAdapter.sendStreamChunk).toHaveBeenCalledWith("chan_1", null, "Hello World!", true);
    expect(streamRelay.getActiveStreamCount()).toBe(0);
  });
});
