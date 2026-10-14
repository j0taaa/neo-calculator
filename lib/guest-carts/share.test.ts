import { expect, test } from "bun:test";
import { decodeGuestShare, encodeGuestShare, guestShareUrl } from "./share";

test("cart links round-trip Unicode JSON without sending content to the server URL", async () => {
  const document = { schemaVersion: 1, resourceType: "cart", cart: { name: "São Paulo 日本語 🚀", products: [] } };
  const encoded = await encodeGuestShare(document);
  expect(await decodeGuestShare(encoded)).toEqual(document);
  const url = new URL(guestShareUrl("https://calculator.hwctools.site/ignored?private=1", encoded));
  expect(url.pathname).toBe("/cart"); expect(url.search).toBe(""); expect(url.hash).toBe(`#cart=${encoded}`);
});
test("invalid formats, truncated gzip and oversized links fail safely", async () => {
  for (const payload of ["v2.AAAA", "v1.!", "v1.AAAA", "v1." + "A".repeat(64_001)]) await expect(decodeGuestShare(payload)).rejects.toThrow();
  await expect(encodeGuestShare({ text: "x".repeat(2_000_001) })).rejects.toThrow("too large");
});
test("compressed payloads cannot inflate beyond the resource-document limit", async () => {
  const blob = new Blob([JSON.stringify({ text: "x".repeat(3_000_000) })]);
  const bytes = new Uint8Array(await new Response(blob.stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  const compressed = "v1." + btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await expect(decodeGuestShare(compressed)).rejects.toThrow("oversized");
});
