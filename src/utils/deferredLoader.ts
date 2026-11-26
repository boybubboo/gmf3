export interface DeferredChunkOptions<T> {
  items: readonly T[];
  chunkSize?: number;
  frameBudgetMs?: number;
  maxItemsPerFrame?: number;
  yieldBeforeFirst?: boolean;
  signal?: AbortSignal;
  onChunk: (chunk: T[], startIndex: number) => void | Promise<void>;
}

export interface DeferredStep {
  label?: string;
  run: () => void | Promise<void>;
}

export interface DeferredStepsOptions {
  frameBudgetMs?: number;
  yieldBeforeFirst?: boolean;
  signal?: AbortSignal;
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * Yields to the next animation frame (or micro-timer when backgrounded / non-DOM),
 * resolving to `false` immediately if the AbortSignal is triggered.
 */
export function nextAnimationFrame(signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let rafId = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ok);
    };

    const onAbort = () => {
      if (rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
      }
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      finish(false);
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const canUseRaf =
      typeof requestAnimationFrame === 'function' &&
      (typeof document === 'undefined' || document.visibilityState !== 'hidden');

    if (canUseRaf) {
      rafId = requestAnimationFrame(() => finish(!signal?.aborted));
    } else {
      timerId = setTimeout(() => finish(!signal?.aborted), 0);
    }
  });
}

/**
 * Processes an array in small chunks, yielding across animation frames whenever
 * the frame time budget (~6ms) or per-frame item cap is reached so UI & camera orbit stay responsive.
 */
export async function runDeferredChunks<T>({
  items,
  chunkSize = 4,
  frameBudgetMs = 6,
  maxItemsPerFrame = Math.max(chunkSize, 12),
  yieldBeforeFirst = false,
  signal,
  onChunk,
}: DeferredChunkOptions<T>): Promise<boolean> {
  if (signal?.aborted) return false;
  if (items.length === 0) return true;

  if (yieldBeforeFirst) {
    const ok = await nextAnimationFrame(signal);
    if (!ok) return false;
  }

  const safeChunkSize = Math.max(1, chunkSize);
  let sliceStart = nowMs();
  let itemsInSlice = 0;

  for (let i = 0; i < items.length; i += safeChunkSize) {
    if (signal?.aborted) return false;

    const chunk = items.slice(i, i + safeChunkSize);
    await onChunk(chunk, i);
    if (signal?.aborted) return false;

    itemsInSlice += chunk.length;
    const hasMore = i + safeChunkSize < items.length;
    if (hasMore && (nowMs() - sliceStart >= frameBudgetMs || itemsInSlice >= maxItemsPerFrame)) {
      const ok = await nextAnimationFrame(signal);
      if (!ok) return false;
      sliceStart = nowMs();
      itemsInSlice = 0;
    }
  }

  return !signal?.aborted;
}

/**
 * Executes heterogeneous deferred build steps across animation frames while respecting
 * a per-frame time budget and immediate AbortSignal cancellation.
 */
export async function runDeferredSteps(
  steps: readonly DeferredStep[],
  opts: DeferredStepsOptions = {}
): Promise<boolean> {
  const { frameBudgetMs = 6, yieldBeforeFirst = false, signal } = opts;
  if (signal?.aborted) return false;
  if (steps.length === 0) return true;

  if (yieldBeforeFirst) {
    const ok = await nextAnimationFrame(signal);
    if (!ok) return false;
  }

  let sliceStart = nowMs();
  for (let i = 0; i < steps.length; i++) {
    if (signal?.aborted) return false;
    await steps[i].run();
    if (signal?.aborted) return false;

    const hasMore = i + 1 < steps.length;
    if (hasMore && nowMs() - sliceStart >= frameBudgetMs) {
      const ok = await nextAnimationFrame(signal);
      if (!ok) return false;
      sliceStart = nowMs();
    }
  }

  return !signal?.aborted;
}
