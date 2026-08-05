/**
 * Minimal external store for a boolean UI preference backed by localStorage.
 *
 * Exists so components can read persisted state through useSyncExternalStore
 * instead of seeding it inside an effect. Reading localStorage during render
 * would desync the first client paint from the server HTML, and writing it
 * back through setState in an effect causes the cascading render that
 * react-hooks/set-state-in-effect exists to prevent.
 *
 * The browser's own `storage` event only fires in *other* tabs, so same-tab
 * writes are broadcast through a local listener set.
 */
export function createPersistedToggle(key: string, fallback = false) {
  const listeners = new Set<() => void>();
  let cached: boolean | null = null;

  function read(): boolean {
    if (cached !== null) return cached;
    if (typeof window === "undefined") return fallback;
    cached = window.localStorage.getItem(key) === "1";
    return cached;
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) {
          cached = null;
          listener();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot: read,
    /** Server render always uses the fallback so hydration matches. */
    getServerSnapshot: () => fallback,
    set(value: boolean) {
      cached = value;
      window.localStorage.setItem(key, value ? "1" : "0");
      listeners.forEach((l) => l());
    },
    toggle() {
      this.set(!read());
    },
  };
}
