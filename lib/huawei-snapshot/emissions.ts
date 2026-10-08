/** Coalesce a component's updates after the current render, without a timed debounce. */
export function createEmissionQueue() {
  const pending = new Set<() => void>();
  let version = 0;
  return {
    get pending() {
      return pending.size;
    },
    get version() {
      return version;
    },
    debounce(callback: () => void) {
      const emit = () => {
        pending.delete(emit);
        version++;
        callback();
      };
      return () => {
        version++;
        if (pending.has(emit)) return;
        pending.add(emit);
        setTimeout(emit, 0);
      };
    },
  };
}
