import { channelDisplayName, channelLabel } from "@/lib/channel-display";

describe("channelDisplayName", () => {
  it("uses a readable name while retaining the ID separately for posting", () => {
    expect(channelDisplayName({ id: "chain://0xabc", name: "Homie" })).toBe(
      "Homie",
    );
  });
  it("falls back to a readable channel ID", () => {
    expect(channelDisplayName({ id: "ethereum", name: "" })).toBe("ethereum");
  });
  it("does not present raw addresses or URLs as names", () => {
    expect(
      channelDisplayName({
        id: "eip155:8453/erc20:0x123",
        name: "eip155:8453/erc20:0x123",
      }),
    ).toBeNull();
    expect(
      channelDisplayName({ id: "0x1234567890123456789012345678901234567890" }),
    ).toBeNull();
  });
});

describe("channelLabel", () => {
  it("prefers a readable registry name", () => {
    expect(channelLabel({ id: "homie", name: "Homie House" })).toBe(
      "Homie House",
    );
  });
  it("describes unnamed onchain parents instead of showing the raw CAIP ID", () => {
    expect(
      channelLabel({
        id: "eip155:8453/erc20:0xccd5951b8e3c665483f45af633e95881234abcd",
        name: "eip155:8453/erc20:0xccd5951b8e3c665483f45af633e95881234abcd",
      }),
    ).toBe("Base token · 0xccd5…abcd");
    expect(
      channelLabel({
        id: "chain://eip155:1/erc721:0x1234567890abcdef1234567890abcdef12345678",
      }),
    ).toBe("Ethereum NFT · 0x1234…5678");
    expect(
      channelLabel({
        id: "solana:101/address:DtR4D9FtVoTX2569gaL837ZgrB6wNjj6tkXYZ",
      }),
    ).toBe("Solana token · DtR4D9…kXYZ");
    expect(
      channelLabel({
        id: "eip155:/erc20:0x76bf9e96d1948349cd763f055b44e231c6a5beef",
      }),
    ).toBe("Ethereum token · 0x76bf…beef");
  });
});
