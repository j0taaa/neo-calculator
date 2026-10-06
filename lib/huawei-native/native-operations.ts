type Operation = { created: number; running: boolean; cancelled: boolean; session?: string };
/** Correlate initialization with cleanup, including cancellation before or after its response. */
export class NativeOperations {
  private entries = new Map<string, Operation>();
  constructor(private release: (session: string) => Promise<void>) {}
  sweep(now = Date.now()) {
    for (const [id, entry] of this.entries)
      if (!entry.running && now - entry.created > 600000) this.entries.delete(id);
  }
  private entry(id: string) {
    const existing = this.entries.get(id);
    if (existing) return existing;
    this.sweep();
    if (this.entries.size >= 2000) throw new Error("Too many calculator initializations");
    const entry: Operation = { created: Date.now(), running: false, cancelled: false };
    this.entries.set(id, entry);
    return entry;
  }
  async cancel(id: string) {
    const entry = this.entry(id);
    entry.cancelled = true;
    if (entry.session) {
      const session = entry.session;
      entry.session = undefined;
      await this.release(session);
    }
  }
  async run<T extends { session: string }>(id: string | undefined, initialize: () => Promise<T>): Promise<T> {
    if (!id) return initialize();
    const entry = this.entry(id);
    if (entry.running || entry.session || entry.cancelled) throw new Error("Calculator initialization already used or cancelled");
    entry.running = true;
    try {
      const result = await initialize();
      if (entry.cancelled) {
        await this.release(result.session);
        throw new Error("Calculator initialization cancelled");
      }
      entry.session = result.session;
      return result;
    } catch (error) {
      this.entries.delete(id);
      throw error;
    } finally { entry.running = false; }
  }
}
export function isNativeOperationId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
}
