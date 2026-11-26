import { useEffect, type ProfilerOnRenderCallback } from 'react';

export type MonitorEventKind =
  | 'long_frame'
  | 'long_task'
  | 'heavy_render'
  | 'heavy_state_update'
  | 'heavy_persistence';

export type MonitorSeverity = 'warn' | 'critical';

export interface MonitorThresholds {
  /** Frame gap in ms via rAF that counts as UI blocking (default 50ms). */
  longFrameMs: number;
  /** Severe frame stall threshold in ms (default 150ms). */
  criticalFrameMs: number;
  /** LongTask API threshold filter in ms (default 50ms). */
  longTaskMs: number;
  /** React Profiler actualDuration threshold in ms (default 16ms). */
  heavyRenderMs: number;
  /** Store state update / mutator threshold in ms (default 12ms). */
  heavyStateUpdateMs: number;
  /** JSON.stringify / localStorage persistence threshold in ms (default 12ms). */
  heavyPersistenceMs: number;
  /** Minimum ms between identical source warnings to prevent log storms (default 400ms). */
  throttleMs: number;
  /** Maximum retained events in the in-memory ring buffer (default 150). */
  maxEvents: number;
}

export interface ActivityBreadcrumb {
  kind: 'render' | 'state' | 'persistence' | 'stage';
  source: string;
  durationMs?: number;
  detail?: string;
  timestamp: number;
}

export interface MemoryDiagnosticSnapshot {
  supported: boolean;
  timestamp: string;
  reason: string;
  usedMB?: number;
  totalMB?: number;
  limitMB?: number;
  usagePct?: number;
  deltaFromBaselineMB?: number;
  deltaFromPreviousMB?: number;
  growthMBPerMin?: number;
  consecutiveGrowthCount: number;
  leakSuspected: boolean;
  hint?: string;
}

export interface ResourceMonitorEvent {
  id: number;
  timestamp: string;
  kind: MonitorEventKind;
  severity: MonitorSeverity;
  source: string;
  durationMs: number;
  stage: string | null;
  projectId: string | null;
  phase?: 'mount' | 'update' | 'nested-update';
  baseDurationMs?: number;
  payloadBytes?: number;
  attributedTo?: string;
  jsHeapMB?: number;
  memoryDiagnostic?: MemoryDiagnosticSnapshot;
  detail?: string;
}

export interface ResourceMonitorSummary {
  enabled: boolean;
  running: boolean;
  totalEvents: number;
  droppedByThrottle: number;
  byKind: Record<MonitorEventKind, number>;
  worstEvent: ResourceMonitorEvent | null;
  topSources: Array<{ source: string; count: number; maxMs: number; totalMs: number }>;
  latestMemory: MemoryDiagnosticSnapshot | null;
}

const DEFAULT_THRESHOLDS: MonitorThresholds = {
  longFrameMs: 50,
  criticalFrameMs: 150,
  longTaskMs: 50,
  heavyRenderMs: 16,
  heavyStateUpdateMs: 12,
  heavyPersistenceMs: 12,
  throttleMs: 400,
  maxEvents: 150,
};

const BYTES_PER_MB = 1024 * 1024;
const round1 = (v: number): number => Math.round(v * 10) / 10;

interface PerformanceMemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemoryInfo;
}

const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const readMemoryInfo = (): PerformanceMemoryInfo | null => {
  if (typeof performance === 'undefined') return null;
  const mem = (performance as PerformanceWithMemory).memory;
  if (!mem || !Number.isFinite(mem.usedJSHeapSize)) return null;
  return mem;
};

/** Lightweight one-shot JS heap reader (returns MB or undefined when unsupported). */
export function readJsHeapUsageMB(): { usedMB: number; totalMB: number; limitMB: number } | undefined {
  const mem = readMemoryInfo();
  if (!mem) return undefined;
  return {
    usedMB: round1(mem.usedJSHeapSize / BYTES_PER_MB),
    totalMB: round1(mem.totalJSHeapSize / BYTES_PER_MB),
    limitMB: round1(mem.jsHeapSizeLimit / BYTES_PER_MB),
  };
}

class EditorResourceMonitor {
  private enabled = true;
  private running = false;
  private thresholds: MonitorThresholds = { ...DEFAULT_THRESHOLDS };
  private events: ResourceMonitorEvent[] = [];
  private nextEventId = 1;
  private droppedByThrottle = 0;

  private activeStage: string | null = null;
  private activeProjectId: string | null = null;
  private lastBreadcrumb: ActivityBreadcrumb | null = null;
  private lastLogByKey = new Map<string, number>();

  private memoryBaselineBytes: number | null = null;
  private memoryBaselineMs = 0;
  private prevMemoryBytes: number | null = null;
  private consecutiveGrowthCount = 0;
  private memoryHistory: MemoryDiagnosticSnapshot[] = [];
  private reportedUnsupportedMemory = false;

  private rafId: number | null = null;
  private lastFrameTimestamp = 0;
  private hiddenSince = 0;
  private resumeGraceUntil = 0;
  private longTaskObserver: PerformanceObserver | null = null;
  private visibilityListener: (() => void) | null = null;
  private activeConsumers = 0;

  setContext(context: { stage?: string | null; projectId?: string | null }): void {
    if (context.stage !== undefined && context.stage !== this.activeStage) {
      this.activeStage = context.stage;
      this.markBreadcrumb({
        kind: 'stage',
        source: `stage:${context.stage ?? 'none'}`,
        timestamp: nowMs(),
      });
    }
    if (context.projectId !== undefined) {
      this.activeProjectId = context.projectId;
    }
  }

  setEnabled(next: boolean): void {
    this.enabled = next;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setThresholds(partial: Partial<MonitorThresholds>): void {
    this.thresholds = { ...this.thresholds, ...partial };
    if (this.events.length > this.thresholds.maxEvents) {
      this.events = this.events.slice(-this.thresholds.maxEvents);
    }
  }

  getThresholds(): MonitorThresholds {
    return { ...this.thresholds };
  }

  clear(): void {
    this.events = [];
    this.memoryHistory = [];
    this.droppedByThrottle = 0;
    this.lastLogByKey.clear();
    this.consecutiveGrowthCount = 0;
    const mem = readMemoryInfo();
    if (mem) {
      this.memoryBaselineBytes = mem.usedJSHeapSize;
      this.memoryBaselineMs = nowMs();
      this.prevMemoryBytes = mem.usedJSHeapSize;
    } else {
      this.memoryBaselineBytes = null;
      this.prevMemoryBytes = null;
    }
  }

  getEvents(): ResourceMonitorEvent[] {
    return [...this.events];
  }

  getMemoryHistory(): MemoryDiagnosticSnapshot[] {
    return [...this.memoryHistory];
  }

  /**
   * Captures a heap snapshot via `performance.memory` (when supported by the browser),
   * compares against baseline & previous warnings to spot memory leaks / GC pressure,
   * and optionally logs diagnostic details to console.
   */
  sampleMemoryDiagnostic(reason: string, emitLog = true): MemoryDiagnosticSnapshot {
    const mem = readMemoryInfo();
    const now = nowMs();
    const timestamp = new Date().toISOString();

    if (!mem) {
      const unsupported: MemoryDiagnosticSnapshot = {
        supported: false,
        timestamp,
        reason,
        consecutiveGrowthCount: 0,
        leakSuspected: false,
        hint: 'performance.memory API unavailable in this browser (Chromium/Chrome exposes JS heap metrics).',
      };
      if (emitLog && !this.reportedUnsupportedMemory) {
        this.reportedUnsupportedMemory = true;
        console.info(`[ResourceMonitor][Memory] ${unsupported.hint}`, { reason });
      }
      return unsupported;
    }

    if (this.memoryBaselineBytes === null) {
      this.memoryBaselineBytes = mem.usedJSHeapSize;
      this.memoryBaselineMs = now;
    }

    const usedMB = round1(mem.usedJSHeapSize / BYTES_PER_MB);
    const totalMB = round1(mem.totalJSHeapSize / BYTES_PER_MB);
    const limitMB = round1(mem.jsHeapSizeLimit / BYTES_PER_MB);
    const usagePct =
      mem.jsHeapSizeLimit > 0 ? round1((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100) : undefined;

    const deltaFromBaselineMB = round1((mem.usedJSHeapSize - this.memoryBaselineBytes) / BYTES_PER_MB);
    const deltaFromPreviousMB =
      this.prevMemoryBytes !== null
        ? round1((mem.usedJSHeapSize - this.prevMemoryBytes) / BYTES_PER_MB)
        : 0;

    if (this.prevMemoryBytes !== null) {
      if (deltaFromPreviousMB >= 0.25) {
        this.consecutiveGrowthCount += 1;
      } else if (deltaFromPreviousMB <= -1.0) {
        this.consecutiveGrowthCount = 0;
      }
    }
    this.prevMemoryBytes = mem.usedJSHeapSize;

    const elapsedMin = Math.max(0.05, (now - this.memoryBaselineMs) / 60000);
    const growthMBPerMin = round1(deltaFromBaselineMB / elapsedMin);

    const highHeapPressure = usagePct !== undefined && usagePct >= 75;
    const sustainedGrowth = deltaFromBaselineMB >= 32 && this.consecutiveGrowthCount >= 3;
    const rapidSpike =
      deltaFromBaselineMB >= 24 &&
      deltaFromPreviousMB >= 4 &&
      this.consecutiveGrowthCount >= 2 &&
      growthMBPerMin >= 30;
    const leakSuspected = highHeapPressure || sustainedGrowth || rapidSpike;

    let hint: string | undefined;
    if (highHeapPressure) {
      hint = `High JS heap pressure (${usagePct}% of ${limitMB} MB limit); likely GC pauses or retained GPU/CPU buffers.`;
    } else if (sustainedGrowth) {
      hint = `Heap grew +${deltaFromBaselineMB} MB over ${this.consecutiveGrowthCount} consecutive warnings; possible memory leak (check undisposed geometries/textures or retained closures).`;
    } else if (rapidSpike) {
      hint = `Rapid heap allocation (+${deltaFromBaselineMB} MB, ~${growthMBPerMin} MB/min) accompanying stall.`;
    } else if (deltaFromPreviousMB >= 4) {
      hint = `Transient allocation spike (+${deltaFromPreviousMB} MB since previous warning) may have triggered GC freeze.`;
    }

    const snapshot: MemoryDiagnosticSnapshot = {
      supported: true,
      timestamp,
      reason,
      usedMB,
      totalMB,
      limitMB,
      usagePct,
      deltaFromBaselineMB,
      deltaFromPreviousMB,
      growthMBPerMin,
      consecutiveGrowthCount: this.consecutiveGrowthCount,
      leakSuspected,
      ...(hint ? { hint } : {}),
    };

    this.memoryHistory.push(snapshot);
    if (this.memoryHistory.length > 60) {
      this.memoryHistory.shift();
    }

    if (emitLog) {
      const summaryLine = `Heap ${usedMB}/${totalMB} MB (limit ${limitMB} MB${usagePct !== undefined ? `, ${usagePct}%` : ''}, Δbase ${deltaFromBaselineMB >= 0 ? '+' : ''}${deltaFromBaselineMB} MB, Δprev ${deltaFromPreviousMB >= 0 ? '+' : ''}${deltaFromPreviousMB} MB)`;
      if (leakSuspected) {
        console.error(`[ResourceMonitor][Memory][LEAK_SUSPECTED] ${summaryLine} — ${hint}`, snapshot);
      } else {
        console.warn(`[ResourceMonitor][Memory] ${summaryLine}`, snapshot);
      }
    }

    return snapshot;
  }

  getSummary(): ResourceMonitorSummary {
    const byKind: Record<MonitorEventKind, number> = {
      long_frame: 0,
      long_task: 0,
      heavy_render: 0,
      heavy_state_update: 0,
      heavy_persistence: 0,
    };
    const sourceStats = new Map<string, { count: number; maxMs: number; totalMs: number }>();
    let worstEvent: ResourceMonitorEvent | null = null;

    for (const ev of this.events) {
      byKind[ev.kind] += 1;
      if (!worstEvent || ev.durationMs > worstEvent.durationMs) {
        worstEvent = ev;
      }
      const prev = sourceStats.get(ev.source);
      if (prev) {
        prev.count += 1;
        prev.totalMs += ev.durationMs;
        if (ev.durationMs > prev.maxMs) prev.maxMs = ev.durationMs;
      } else {
        sourceStats.set(ev.source, {
          count: 1,
          maxMs: ev.durationMs,
          totalMs: ev.durationMs,
        });
      }
    }

    const topSources = Array.from(sourceStats.entries())
      .map(([source, stat]) => ({
        source,
        count: stat.count,
        maxMs: round1(stat.maxMs),
        totalMs: round1(stat.totalMs),
      }))
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 10);

    return {
      enabled: this.enabled,
      running: this.running,
      totalEvents: this.events.length,
      droppedByThrottle: this.droppedByThrottle,
      byKind,
      worstEvent,
      topSources,
      latestMemory:
        this.memoryHistory.length > 0
          ? this.memoryHistory[this.memoryHistory.length - 1]
          : null,
    };
  }

  start(): () => void {
    this.activeConsumers += 1;
    if (this.running || typeof window === 'undefined') {
      return () => this.stopConsumer();
    }

    this.running = true;
    this.lastFrameTimestamp = nowMs();

    const mem = readMemoryInfo();
    if (mem && this.memoryBaselineBytes === null) {
      this.memoryBaselineBytes = mem.usedJSHeapSize;
      this.memoryBaselineMs = nowMs();
      this.prevMemoryBytes = mem.usedJSHeapSize;
    }

    if (typeof document !== 'undefined') {
      this.hiddenSince = document.visibilityState === 'visible' ? 0 : nowMs();
      this.visibilityListener = () => {
        const ts = nowMs();
        if (document.visibilityState === 'visible') {
          if (this.hiddenSince > 0) {
            this.resumeGraceUntil = ts + 300;
            this.lastFrameTimestamp = ts;
          }
          this.hiddenSince = 0;
        } else {
          this.hiddenSince = ts;
        }
      };
      document.addEventListener('visibilitychange', this.visibilityListener);
    }

    const tick = (rafTime: number) => {
      if (!this.running) return;
      const now = rafTime || nowMs();
      const delta = now - this.lastFrameTimestamp;
      this.lastFrameTimestamp = now;

      const isVisible =
        typeof document === 'undefined' || document.visibilityState === 'visible';
      if (
        this.enabled &&
        isVisible &&
        now >= this.resumeGraceUntil &&
        delta >= this.thresholds.longFrameMs
      ) {
        const attributedTo = this.resolveAttribution(now);
        this.recordEvent({
          kind: 'long_frame',
          severity: delta >= this.thresholds.criticalFrameMs ? 'critical' : 'warn',
          source: 'main-thread:rAF',
          durationMs: delta,
          attributedTo,
          detail: attributedTo
            ? `UI frame blocked for ${Math.round(delta)}ms shortly after ${attributedTo}`
            : `UI frame blocked for ${Math.round(delta)}ms`,
        });
      }

      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);

    if (
      typeof PerformanceObserver !== 'undefined' &&
      Array.isArray(PerformanceObserver.supportedEntryTypes) &&
      PerformanceObserver.supportedEntryTypes.includes('longtask')
    ) {
      try {
        this.longTaskObserver = new PerformanceObserver((list) => {
          if (!this.enabled) return;
          const now = nowMs();
          if (now < this.resumeGraceUntil) return;
          if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
            return;
          }
          for (const entry of list.getEntries()) {
            if (entry.duration >= this.thresholds.longTaskMs) {
              const attributedTo = this.resolveAttribution(now);
              this.recordEvent({
                kind: 'long_task',
                severity:
                  entry.duration >= this.thresholds.criticalFrameMs ? 'critical' : 'warn',
                source: `longtask:${entry.name || 'self'}`,
                durationMs: entry.duration,
                attributedTo,
                detail: attributedTo
                  ? `Browser long task (${Math.round(entry.duration)}ms) near ${attributedTo}`
                  : `Browser long task (${Math.round(entry.duration)}ms)`,
              });
            }
          }
        });
        this.longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch {
        this.longTaskObserver = null;
      }
    }

    return () => this.stopConsumer();
  }

  private stopConsumer(): void {
    this.activeConsumers = Math.max(0, this.activeConsumers - 1);
    if (this.activeConsumers > 0 || !this.running) return;

    this.running = false;
    if (this.rafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.longTaskObserver) {
      try {
        this.longTaskObserver.disconnect();
      } catch {
        // ignore
      }
      this.longTaskObserver = null;
    }
    if (this.visibilityListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
  }

  markBreadcrumb(crumb: ActivityBreadcrumb): void {
    this.lastBreadcrumb = crumb;
  }

  recordRenderTiming(
    id: string,
    phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number,
    baseDuration: number
  ): void {
    if (!this.enabled) return;
    const now = nowMs();
    this.markBreadcrumb({
      kind: 'render',
      source: `render:${id}`,
      durationMs: actualDuration,
      detail: phase,
      timestamp: now,
    });

    if (actualDuration < this.thresholds.heavyRenderMs) return;

    this.recordEvent({
      kind: 'heavy_render',
      severity: actualDuration >= this.thresholds.criticalFrameMs ? 'critical' : 'warn',
      source: `render:${id}`,
      durationMs: actualDuration,
      phase,
      baseDurationMs: round1(baseDuration),
      detail: `React ${phase} of <${id}> took ${round1(actualDuration)}ms (base ${round1(baseDuration)}ms)`,
    });
  }

  recordStateUpdate(source: string, durationMs: number, detail?: string): void {
    if (!this.enabled) return;
    const now = nowMs();
    this.markBreadcrumb({
      kind: 'state',
      source: `state:${source}`,
      durationMs,
      detail,
      timestamp: now,
    });

    if (durationMs < this.thresholds.heavyStateUpdateMs) return;

    this.recordEvent({
      kind: 'heavy_state_update',
      severity: durationMs >= this.thresholds.criticalFrameMs ? 'critical' : 'warn',
      source: `state:${source}`,
      durationMs,
      detail: detail ?? `State update "${source}" took ${round1(durationMs)}ms`,
    });
  }

  recordPersistence(
    source: string,
    durationMs: number,
    payloadBytes?: number,
    detail?: string
  ): void {
    if (!this.enabled) return;
    const now = nowMs();
    this.markBreadcrumb({
      kind: 'persistence',
      source: `persist:${source}`,
      durationMs,
      detail,
      timestamp: now,
    });

    if (durationMs < this.thresholds.heavyPersistenceMs) return;

    const kb = payloadBytes !== undefined ? round1(payloadBytes / 1024) : undefined;
    this.recordEvent({
      kind: 'heavy_persistence',
      severity: durationMs >= this.thresholds.criticalFrameMs ? 'critical' : 'warn',
      source: `persist:${source}`,
      durationMs,
      payloadBytes,
      detail:
        detail ??
        `Serialization/storage "${source}" took ${round1(durationMs)}ms${
          kb !== undefined ? ` (${kb} KB)` : ''
        }`,
    });
  }

  private resolveAttribution(now: number): string | undefined {
    const crumb = this.lastBreadcrumb;
    if (!crumb) return undefined;
    if (now - crumb.timestamp > 350) return undefined;
    const dur = crumb.durationMs !== undefined ? ` (${round1(crumb.durationMs)}ms)` : '';
    return `${crumb.source}${dur}`;
  }

  private recordEvent(
    input: Omit<
      ResourceMonitorEvent,
      'id' | 'timestamp' | 'stage' | 'projectId' | 'jsHeapMB' | 'memoryDiagnostic'
    >
  ): void {
    const now = nowMs();
    const key = `${input.kind}:${input.source}`;
    const lastLogged = this.lastLogByKey.get(key) ?? 0;

    if (
      input.severity !== 'critical' &&
      now - lastLogged < this.thresholds.throttleMs
    ) {
      this.droppedByThrottle += 1;
      return;
    }
    this.lastLogByKey.set(key, now);

    const roundedDuration = round1(input.durationMs);
    const memoryDiagnostic = this.sampleMemoryDiagnostic(
      `${input.kind}:${input.source} (${roundedDuration}ms)`,
      true
    );

    const event: ResourceMonitorEvent = {
      ...input,
      id: this.nextEventId++,
      timestamp: new Date().toISOString(),
      durationMs: roundedDuration,
      stage: this.activeStage,
      projectId: this.activeProjectId,
      jsHeapMB: memoryDiagnostic.usedMB,
      memoryDiagnostic,
    };

    this.events.push(event);
    if (this.events.length > this.thresholds.maxEvents) {
      this.events.shift();
    }

    const prefix = `[ResourceMonitor][${event.severity.toUpperCase()}][${event.kind}]`;
    const meta = {
      source: event.source,
      durationMs: event.durationMs,
      stage: event.stage,
      ...(event.phase ? { phase: event.phase } : {}),
      ...(event.baseDurationMs !== undefined ? { baseDurationMs: event.baseDurationMs } : {}),
      ...(event.payloadBytes !== undefined ? { payloadBytes: event.payloadBytes } : {}),
      ...(event.attributedTo ? { attributedTo: event.attributedTo } : {}),
      ...(event.jsHeapMB !== undefined ? { jsHeapMB: event.jsHeapMB } : {}),
      ...(memoryDiagnostic.supported
        ? {
            heapDeltaBaseMB: memoryDiagnostic.deltaFromBaselineMB,
            heapUsagePct: memoryDiagnostic.usagePct,
            leakSuspected: memoryDiagnostic.leakSuspected,
          }
        : {}),
    };

    if (event.severity === 'critical') {
      console.error(`${prefix} ${event.detail ?? event.source}`, meta);
    } else {
      console.warn(`${prefix} ${event.detail ?? event.source}`, meta);
    }
  }
}

export const resourceMonitor = new EditorResourceMonitor();

export function logMemoryDiagnosticSnapshot(reason = 'manual'): MemoryDiagnosticSnapshot {
  return resourceMonitor.sampleMemoryDiagnostic(reason, true);
}

export const onEditorProfilerRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration
) => {
  resourceMonitor.recordRenderTiming(id, phase, actualDuration, baseDuration);
};

export function measureStateUpdate<T>(source: string, fn: () => T, detail?: string): T {
  const start = nowMs();
  try {
    return fn();
  } finally {
    const duration = nowMs() - start;
    resourceMonitor.recordStateUpdate(source, duration, detail);
  }
}

export function measurePersistence<T>(
  source: string,
  fn: () => { result: T; payloadBytes?: number },
  detail?: string
): T {
  const start = nowMs();
  let payloadBytes: number | undefined;
  try {
    const out = fn();
    payloadBytes = out.payloadBytes;
    return out.result;
  } finally {
    const duration = nowMs() - start;
    resourceMonitor.recordPersistence(source, duration, payloadBytes, detail);
  }
}

export function useEditorResourceMonitor(context: {
  stage: string | null;
  projectId: string | null;
}): void {
  useEffect(() => {
    resourceMonitor.setContext(context);
  }, [context.stage, context.projectId]);

  useEffect(() => {
    const stop = resourceMonitor.start();
    return () => {
      stop();
    };
  }, []);
}

export interface ResourceMonitorDebugHandle {
  getEvents: () => ResourceMonitorEvent[];
  getSummary: () => ResourceMonitorSummary;
  getMemoryHistory: () => MemoryDiagnosticSnapshot[];
  checkMemory: (reason?: string) => MemoryDiagnosticSnapshot;
  clear: () => void;
  setEnabled: (enabled: boolean) => void;
  setThresholds: (partial: Partial<MonitorThresholds>) => void;
  getThresholds: () => MonitorThresholds;
  dump: () => void;
}

declare global {
  interface Window {
    __makerResourceMonitor?: ResourceMonitorDebugHandle;
  }
}

if (typeof window !== 'undefined') {
  window.__makerResourceMonitor = {
    getEvents: () => resourceMonitor.getEvents(),
    getSummary: () => resourceMonitor.getSummary(),
    getMemoryHistory: () => resourceMonitor.getMemoryHistory(),
    checkMemory: (reason = 'console:checkMemory') =>
      resourceMonitor.sampleMemoryDiagnostic(reason, true),
    clear: () => resourceMonitor.clear(),
    setEnabled: (enabled: boolean) => resourceMonitor.setEnabled(enabled),
    setThresholds: (partial: Partial<MonitorThresholds>) =>
      resourceMonitor.setThresholds(partial),
    getThresholds: () => resourceMonitor.getThresholds(),
    dump: () => {
      const summary = resourceMonitor.getSummary();
      const events = resourceMonitor.getEvents();
      console.info('[ResourceMonitor] Summary:', summary);
      if (events.length > 0 && typeof console.table === 'function') {
        console.table(
          events.slice(-30).map((e) => ({
            time: e.timestamp.slice(11, 23),
            kind: e.kind,
            severity: e.severity,
            source: e.source,
            ms: e.durationMs,
            heapMB: e.jsHeapMB ?? '-',
            leak: e.memoryDiagnostic?.leakSuspected ? 'YES' : 'no',
            stage: e.stage,
            attributedTo: e.attributedTo ?? '',
          }))
        );
      }
    },
  };
}
