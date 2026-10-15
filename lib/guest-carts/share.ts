import { guestCartMaxBytes } from "./store";

const maxLinkBytes = 64_000;
async function boundedBytes(stream: ReadableStream<Uint8Array>, limit: number) {
  const reader = stream.getReader(), chunks: Uint8Array[] = [];
  let count = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    count += value.length;
    if (count > limit) { await reader.cancel(); throw new Error("This cart is too large for a share link. Use JSON export instead."); }
    chunks.push(value);
  }
  const output = new Uint8Array(count);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}
export async function encodeGuestShare(document: unknown) {
  const json = JSON.stringify(document);
  if (new TextEncoder().encode(json).length > guestCartMaxBytes) throw new Error("This cart is too large for a share link. Use JSON export instead.");
  const data = await boundedBytes(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip")), Math.floor((maxLinkBytes - 3) * 3 / 4));
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return "v1." + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function decodeGuestShare(payload: string): Promise<unknown> {
  if (payload.length > maxLinkBytes || !/^v1\.[A-Za-z0-9_-]+$/.test(payload)) throw new Error("Invalid or oversized cart share link.");
  try {
    const binary = atob(payload.slice(3).replace(/-/g, "+").replace(/_/g, "/"));
    const data = Uint8Array.from(binary, byte => byte.charCodeAt(0));
    const output = await boundedBytes(new Blob([data]).stream().pipeThrough(new DecompressionStream("gzip")), guestCartMaxBytes);
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(output));
  } catch { throw new Error("Invalid or oversized cart share link. Your existing carts have not been changed."); }
}
export function guestShareUrl(origin: string, payload: string) { return `${new URL(origin).origin}/cart#cart=${payload}`; }
