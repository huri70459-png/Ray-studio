/**
 * Lightweight path coalescer for optional rapid-change resilience (FT-010).
 *
 * Continuous FileSystemWatcher / git binding is **deferred** for B.2
 * (ponytail: inject watcher later; reindexPath remains primary merge surface).
 * This helper only coalesces in-process scheduled reindex tokens — no I/O.
 */

export class PathCoalescer {
  private readonly pending = new Map<string, number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly delayMs: number;
  private readonly onFlush: (paths: string[]) => void | Promise<void>;
  private flushChain: Promise<void> = Promise.resolve();

  constructor(delayMs: number, onFlush: (paths: string[]) => void | Promise<void>) {
    this.delayMs = delayMs;
    this.onFlush = onFlush;
  }

  /** Schedule a path; rapid fires for same path collapse to one flush entry. */
  schedule(path: string): void {
    this.pending.set(path, (this.pending.get(path) ?? 0) + 1);
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flushNow();
    }, this.delayMs);
  }

  /** Pending unique path count (must stay bounded — one entry per path). */
  pendingCount(): number {
    return this.pending.size;
  }

  async flushNow(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const paths = [...this.pending.keys()].sort();
    this.pending.clear();
    if (paths.length === 0) return;
    this.flushChain = this.flushChain.then(async () => {
      await this.onFlush(paths);
    });
    await this.flushChain;
  }

  dispose(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending.clear();
  }
}
