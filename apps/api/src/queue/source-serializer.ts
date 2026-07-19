/**
 * Serializes async work by key: tasks for the same key run one-at-a-time in submission
 * order (FIFO); different keys run in parallel. A failed task does not stall its key.
 *
 * In-memory — assumes a single worker instance (true for the in-process delivery worker
 * at this stage). A multi-instance worker would need a Redis-backed lock instead.
 */
export class KeyedSerializer {
  private readonly tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    // Run `task` whether the previous task fulfilled or rejected — one failure must not
    // block the rest of the key's queue.
    const next = prev.then(task, task);
    this.tails.set(key, next);
    void next
      .catch(() => undefined)
      .finally(() => {
        if (this.tails.get(key) === next) this.tails.delete(key);
      });
    return next;
  }
}
