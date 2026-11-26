import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  GitBranch,
  Maximize2,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Workflow,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  BehaviorVocabulary,
  EntityKindMeta,
  ruleSentence,
} from '../../data/registries';
import { BADDIE_ACTION_LIBRARY, FLIGHT_PATTERN_OPTIONS } from '../../data/baddieActionLibrary';
import type { MakerStore } from '../../store/useMakerStore';
import type { BehaviorCard, CardClause, LevelEntity } from '../../types/maker';
import { uid } from '../../utils/terrain';
import { IconBadge } from './MakerUI';

interface LogicFlowModalProps {
  store: MakerStore;
  onClose: () => void;
}

export interface LogicFlowWorkspaceProps {
  store: MakerStore;
  embedded?: boolean;
  onClose?: () => void;
  onSwitchToRules?: () => void;
}

type NodeRole = 'entity' | 'when' | 'if' | 'then';
type TraceStatus = 'idle' | 'passed' | 'blocked' | 'fired' | 'disabled';

interface FlowNode {
  id: string;
  role: NodeRole;
  entityId: string;
  cardId?: string;
  clauseId?: string;
  clauseIndex?: number;
  title: string;
  subtitle: string;
  detail?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isOnce?: boolean;
  isEnabled?: boolean;
  entityKind?: LevelEntity['kind'];
  hasWarning?: boolean;
}

interface FlowEdge {
  id: string;
  fromId: string;
  toId: string;
  kind: 'flow' | 'dependency';
  label?: string;
  cardId?: string;
  entityId?: string;
}

interface LogicDiagnostic {
  id: string;
  severity: 'error' | 'warning';
  entityId: string;
  cardId: string;
  nodeId: string;
  title: string;
  detail: string;
}

interface SimulationState {
  hasKey: boolean;
  playerClose: boolean;
  healthFull: boolean;
  flags: Record<string, boolean>;
}

interface TraceLogEntry {
  id: string;
  entityName: string;
  ruleLabel: string;
  outcome: 'fired' | 'blocked' | 'disabled';
  detail: string;
}

const NODE_W = 228;
const ENTITY_W = 196;
const COL_X = {
  entity: 48,
  when: 304,
  if: 596,
  then: 888,
};

function clauseLabel(
  list: typeof BehaviorVocabulary.events,
  clause: CardClause
): { label: string; detail: string; needsDetail: boolean } {
  const def = list.find((d) => d.key === clause.key);
  return {
    label: def?.label ?? clause.key,
    detail: clause.detail?.trim() ?? '',
    needsDetail: Boolean(def?.needsDetail),
  };
}

function normalizeFlagKey(raw: string): string {
  return raw.trim().toLowerCase();
}

export const LogicFlowModal: React.FC<LogicFlowModalProps> = ({ store, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-2 sm:p-4">
    <div className="w-full max-w-[1440px] h-[min(93vh,860px)] rounded-2xl bg-white dark:bg-[#141720] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
      <LogicFlowWorkspace store={store} onClose={onClose} />
    </div>
  </div>
);

export const LogicFlowWorkspace: React.FC<LogicFlowWorkspaceProps> = ({
  store,
  embedded = false,
  onClose,
  onSwitchToRules,
}) => {
  const { currentLevel } = store;
  const [scopeEntityId, setScopeEntityId] = useState<string>('all');
  const [showCrossLinks, setShowCrossLinks] = useState(true);
  const [zoom, setZoom] = useState(0.92);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'inspect' | 'simulate' | 'issues'>('simulate');

  // Interactive debugger simulation state
  const [simState, setSimState] = useState<SimulationState>({
    hasKey: false,
    playerClose: true,
    healthFull: true,
    flags: {},
  });
  const [activeEventFilter, setActiveEventFilter] = useState<string | null>(null);
  const [simulatedCardId, setSimulatedCardId] = useState<string | null>(null);
  const [traceLog, setTraceLog] = useState<TraceLogEntry[]>([]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<
    | { mode: 'pan'; startX: number; startY: number; origPanX: number; origPanY: number }
    | {
        mode: 'node';
        nodeId: string;
        startX: number;
        startY: number;
        origDx: number;
        origDy: number;
      }
    | null
  >(null);

  const entities = useMemo(() => currentLevel?.entities ?? [], [currentLevel]);

  // Discover all flags referenced in the level so users can toggle them live in the simulator
  const discoveredFlags = useMemo(() => {
    const flags = new Map<string, string>();
    for (const ent of entities) {
      for (const card of ent.cards) {
        for (const c of card.conditions) {
          if (c.key === 'flagSet' && c.detail.trim()) {
            flags.set(normalizeFlagKey(c.detail), c.detail.trim());
          }
        }
        for (const a of card.actions) {
          if (a.key === 'setFlag' && a.detail.trim()) {
            flags.set(normalizeFlagKey(a.detail), a.detail.trim());
          }
        }
      }
    }
    return Array.from(flags.entries()).map(([norm, label]) => ({ norm, label }));
  }, [entities]);

  // Discover unique WHEN events present in the level for quick test-fire buttons
  const presentEventKeys = useMemo(() => {
    const set = new Set<string>();
    for (const ent of entities) {
      for (const card of ent.cards) {
        set.add(card.when.key);
      }
    }
    return Array.from(set);
  }, [entities]);

  // Static diagnostics across all entities in the level
  const diagnostics = useMemo<LogicDiagnostic[]>(() => {
    const list: LogicDiagnostic[] = [];
    const setFlags = new Set<string>();

    for (const ent of entities) {
      for (const card of ent.cards) {
        if (!card.isEnabled) continue;
        for (const act of card.actions) {
          if (act.key === 'setFlag' && act.detail.trim()) {
            setFlags.add(normalizeFlagKey(act.detail));
          }
        }
      }
    }

    for (const ent of entities) {
      const unconditionalWhenCounts = new Map<string, number>();
      for (const card of ent.cards) {
        const whenNodeId = `when:${ent.id}:${card.id}`;
        if (!card.isEnabled) {
          list.push({
            id: `disabled:${card.id}`,
            severity: 'warning',
            entityId: ent.id,
            cardId: card.id,
            nodeId: whenNodeId,
            title: `${ent.name}: Rule is disabled`,
            detail: 'This rule is turned off and will never fire during play.',
          });
        }
        if (card.actions.length === 0) {
          list.push({
            id: `noact:${card.id}`,
            severity: 'error',
            entityId: ent.id,
            cardId: card.id,
            nodeId: whenNodeId,
            title: `${ent.name}: Rule has no Then actions`,
            detail: 'Add at least one action so this trigger produces an effect.',
          });
        }
        const optionalWhenDetail = card.when.key === 'seesPlayer' || card.when.key === 'playerNear';
        const whenDef = BehaviorVocabulary.events.find((e) => e.key === card.when.key);
        if (whenDef?.needsDetail && !optionalWhenDetail && !card.when.detail.trim()) {
          list.push({
            id: `wdetail:${card.id}`,
            severity: 'warning',
            entityId: ent.id,
            cardId: card.id,
            nodeId: whenNodeId,
            title: `${ent.name}: Missing trigger detail`,
            detail: `Fill in "${whenDef.detailHint}" on the When node.`,
          });
        }

        if (card.conditions.length === 0 && card.isEnabled) {
          const prev = unconditionalWhenCounts.get(card.when.key) ?? 0;
          unconditionalWhenCounts.set(card.when.key, prev + 1);
          if (prev >= 1) {
            list.push({
              id: `dup:${card.id}`,
              severity: 'warning',
              entityId: ent.id,
              cardId: card.id,
              nodeId: whenNodeId,
              title: `${ent.name}: Overlapping triggers`,
              detail: 'Multiple rules share the same When trigger with no If conditions.',
            });
          }
        }

        for (const cond of card.conditions) {
          const condNodeId = `if:${ent.id}:${card.id}:${cond.id}`;
          const condDef = BehaviorVocabulary.conditions.find((c) => c.key === cond.key);
          if (condDef?.needsDetail && !cond.detail.trim()) {
            list.push({
              id: `cdetail:${cond.id}`,
              severity: 'error',
              entityId: ent.id,
              cardId: card.id,
              nodeId: condNodeId,
              title: `${ent.name}: Empty condition detail`,
              detail: `Specify "${condDef.detailHint}" so this condition can match.`,
            });
          }
          if (cond.key === 'flagSet' && cond.detail.trim()) {
            const norm = normalizeFlagKey(cond.detail);
            if (!setFlags.has(norm)) {
              list.push({
                id: `orphanflag:${cond.id}`,
                severity: 'warning',
                entityId: ent.id,
                cardId: card.id,
                nodeId: condNodeId,
                title: `${ent.name}: Flag "${cond.detail.trim()}" is never set`,
                detail: 'No active rule in this level has a "remember something happened" action matching this flag.',
              });
            }
          }
        }

        for (const act of card.actions) {
          const actNodeId = `then:${ent.id}:${card.id}:${act.id}`;
          const optionalActDetail =
            act.key === 'attack' || act.key === 'flyPattern' || act.key === 'landAndAttack';
          const actDef = BehaviorVocabulary.actions.find((a) => a.key === act.key);
          if (actDef?.needsDetail && !optionalActDetail && !act.detail.trim()) {
            list.push({
              id: `adetail:${act.id}`,
              severity: 'warning',
              entityId: ent.id,
              cardId: card.id,
              nodeId: actNodeId,
              title: `${ent.name}: Empty action detail`,
              detail: `Specify "${actDef.detailHint}" on "${actDef.label}".`,
            });
          }
        }
      }
    }

    return list;
  }, [entities]);

  const warningNodeIds = useMemo(() => new Set(diagnostics.map((d) => d.nodeId)), [diagnostics]);

  // Visible entities filtered by selector
  const visibleEntities = useMemo(() => {
    if (scopeEntityId === 'all') {
      const withRules = entities.filter((e) => e.cards.length > 0);
      return withRules.length > 0 ? withRules : entities.slice(0, 6);
    }
    return entities.filter((e) => e.id === scopeEntityId);
  }, [entities, scopeEntityId]);

  // Build deterministic, collision-free node & edge layout
  const { nodes, edges, bounds } = useMemo(() => {
    const builtNodes: FlowNode[] = [];
    const builtEdges: FlowEdge[] = [];

    let cursorY = 40;
    const CARD_GAP_Y = 34;
    const ENTITY_GAP_Y = 56;
    const CLAUSE_H = 68;
    const CLAUSE_GAP = 14;

    const flagSetters: { norm: string; nodeId: string; label: string }[] = [];
    const flagReaders: { norm: string; nodeId: string }[] = [];
    const keyGivers: { nodeId: string }[] = [];
    const keyReaders: { nodeId: string }[] = [];

    for (const ent of visibleEntities) {
      const entityNodeId = `entity:${ent.id}`;
      const entStartY = cursorY;

      if (ent.cards.length === 0) {
        builtNodes.push({
          id: entityNodeId,
          role: 'entity',
          entityId: ent.id,
          title: ent.name,
          subtitle: `${EntityKindMeta[ent.kind].title} · 0 rules`,
          x: COL_X.entity,
          y: cursorY,
          width: ENTITY_W,
          height: 76,
          entityKind: ent.kind,
        });
        cursorY += 76 + ENTITY_GAP_Y;
        continue;
      }

      const cardRowCenters: number[] = [];

      for (let rIdx = 0; rIdx < ent.cards.length; rIdx++) {
        const card = ent.cards[rIdx];
        const condCount = card.conditions.length;
        const actCount = Math.max(1, card.actions.length);
        const condBlockH = condCount > 0 ? condCount * CLAUSE_H + (condCount - 1) * CLAUSE_GAP : 0;
        const actBlockH = actCount * CLAUSE_H + (actCount - 1) * CLAUSE_GAP;
        const rowH = Math.max(82, condBlockH, actBlockH);
        const rowCenterY = cursorY + rowH / 2;
        cardRowCenters.push(rowCenterY);

        // WHEN node
        const whenInfo = clauseLabel(BehaviorVocabulary.events, card.when);
        const whenNodeId = `when:${ent.id}:${card.id}`;
        const whenH = 78;
        builtNodes.push({
          id: whenNodeId,
          role: 'when',
          entityId: ent.id,
          cardId: card.id,
          title: `When ${whenInfo.label}`,
          subtitle: `Rule ${rIdx + 1}${card.isOnce ? ' · Once' : ''}${card.isEnabled ? '' : ' · Disabled'}`,
          detail: whenInfo.detail || undefined,
          x: COL_X.when,
          y: rowCenterY - whenH / 2,
          width: NODE_W,
          height: whenH,
          isOnce: card.isOnce,
          isEnabled: card.isEnabled,
          hasWarning: warningNodeIds.has(whenNodeId),
        });

        builtEdges.push({
          id: `e:${entityNodeId}->${whenNodeId}`,
          fromId: entityNodeId,
          toId: whenNodeId,
          kind: 'flow',
          cardId: card.id,
          entityId: ent.id,
        });

        // IF nodes
        const condNodeIds: string[] = [];
        if (condCount > 0) {
          const startCondY = rowCenterY - condBlockH / 2;
          card.conditions.forEach((cond, cIdx) => {
            const cInfo = clauseLabel(BehaviorVocabulary.conditions, cond);
            const cNodeId = `if:${ent.id}:${card.id}:${cond.id}`;
            condNodeIds.push(cNodeId);
            builtNodes.push({
              id: cNodeId,
              role: 'if',
              entityId: ent.id,
              cardId: card.id,
              clauseId: cond.id,
              clauseIndex: cIdx,
              title: `If ${cInfo.label}`,
              subtitle: cIdx === 0 ? 'Condition gate' : 'And condition',
              detail: cInfo.detail || undefined,
              x: COL_X.if,
              y: startCondY + cIdx * (CLAUSE_H + CLAUSE_GAP),
              width: NODE_W,
              height: CLAUSE_H,
              isEnabled: card.isEnabled,
              hasWarning: warningNodeIds.has(cNodeId),
            });

            builtEdges.push({
              id: `e:${whenNodeId}->${cNodeId}`,
              fromId: whenNodeId,
              toId: cNodeId,
              kind: 'flow',
              cardId: card.id,
              entityId: ent.id,
            });

            if (cond.key === 'flagSet' && cond.detail.trim()) {
              flagReaders.push({ norm: normalizeFlagKey(cond.detail), nodeId: cNodeId });
            }
            if (cond.key === 'hasKey') {
              keyReaders.push({ nodeId: cNodeId });
            }
          });
        }

        // THEN nodes
        if (card.actions.length > 0) {
          const startActY = rowCenterY - actBlockH / 2;
          card.actions.forEach((act, aIdx) => {
            const aInfo = clauseLabel(BehaviorVocabulary.actions, act);
            const aNodeId = `then:${ent.id}:${card.id}:${act.id}`;
            builtNodes.push({
              id: aNodeId,
              role: 'then',
              entityId: ent.id,
              cardId: card.id,
              clauseId: act.id,
              clauseIndex: aIdx,
              title: `Then ${aInfo.label}`,
              subtitle: `Action ${aIdx + 1}`,
              detail: aInfo.detail || undefined,
              x: COL_X.then,
              y: startActY + aIdx * (CLAUSE_H + CLAUSE_GAP),
              width: NODE_W,
              height: CLAUSE_H,
              isEnabled: card.isEnabled,
              hasWarning: warningNodeIds.has(aNodeId),
            });

            if (condNodeIds.length > 0) {
              for (const cid of condNodeIds) {
                builtEdges.push({
                  id: `e:${cid}->${aNodeId}`,
                  fromId: cid,
                  toId: aNodeId,
                  kind: 'flow',
                  cardId: card.id,
                  entityId: ent.id,
                });
              }
            } else {
              builtEdges.push({
                id: `e:${whenNodeId}->${aNodeId}`,
                fromId: whenNodeId,
                toId: aNodeId,
                kind: 'flow',
                label: 'Direct',
                cardId: card.id,
                entityId: ent.id,
              });
            }

            if (act.key === 'setFlag' && act.detail.trim()) {
              flagSetters.push({
                norm: normalizeFlagKey(act.detail),
                nodeId: aNodeId,
                label: act.detail.trim(),
              });
            }
            if (
              (act.key === 'giveItem' || act.key === 'giveTreasure') &&
              act.detail.toLowerCase().includes('key')
            ) {
              keyGivers.push({ nodeId: aNodeId });
            }
          });
        }

        cursorY += rowH + CARD_GAP_Y;
      }

      const entCenterY =
        cardRowCenters.length > 0
          ? (cardRowCenters[0] + cardRowCenters[cardRowCenters.length - 1]) / 2
          : entStartY + 38;

      builtNodes.push({
        id: entityNodeId,
        role: 'entity',
        entityId: ent.id,
        title: ent.name,
        subtitle: `${EntityKindMeta[ent.kind].title} · ${ent.cards.length} rule${ent.cards.length === 1 ? '' : 's'}`,
        x: COL_X.entity,
        y: entCenterY - 38,
        width: ENTITY_W,
        height: 76,
        entityKind: ent.kind,
      });

      cursorY += ENTITY_GAP_Y - CARD_GAP_Y;
    }

    // Cross-rule causal dependency links (setFlag -> flagSet, giveKey -> hasKey)
    if (showCrossLinks) {
      for (const setter of flagSetters) {
        for (const reader of flagReaders) {
          if (setter.norm === reader.norm) {
            builtEdges.push({
              id: `dep:${setter.nodeId}->${reader.nodeId}`,
              fromId: setter.nodeId,
              toId: reader.nodeId,
              kind: 'dependency',
              label: `Flag: ${setter.label}`,
            });
          }
        }
      }
      for (const giver of keyGivers) {
        for (const reader of keyReaders) {
          builtEdges.push({
            id: `depkey:${giver.nodeId}->${reader.nodeId}`,
            fromId: giver.nodeId,
            toId: reader.nodeId,
            kind: 'dependency',
            label: 'Grants Key',
          });
        }
      }
    }

    const maxX = Math.max(1220, ...builtNodes.map((n) => n.x + n.width + 120));
    const maxY = Math.max(640, cursorY + 80);

    return {
      nodes: builtNodes,
      edges: builtEdges,
      bounds: { width: maxX, height: maxY },
    };
  }, [showCrossLinks, visibleEntities, warningNodeIds]);

  // Apply user drag offsets to node positions
  const positionedNodes = useMemo(() => {
    const map = new Map<string, FlowNode>();
    for (const n of nodes) {
      const off = nodeOffsets[n.id];
      const posNode = off ? { ...n, x: n.x + off.dx, y: n.y + off.dy } : n;
      map.set(n.id, posNode);
    }
    return map;
  }, [nodeOffsets, nodes]);

  // Evaluate live simulation trace status for every node & edge
  const evalCondition = useCallback(
    (cond: CardClause, entity: LevelEntity, state: SimulationState): boolean => {
      if (cond.key === 'hasKey') return state.hasKey;
      if (cond.key === 'playerClose') return state.playerClose;
      if (cond.key === 'healthFull') return state.healthFull;
      if (cond.key === 'isBoss') return entity.isBoss;
      if (cond.key === 'flagSet') {
        const key = normalizeFlagKey(cond.detail);
        return Boolean(key && state.flags[key]);
      }
      return true;
    },
    []
  );

  const traceStatuses = useMemo(() => {
    const nodeStatus = new Map<string, TraceStatus>();
    const edgeStatus = new Map<string, TraceStatus>();

    if (!activeEventFilter && !simulatedCardId) {
      return { nodeStatus, edgeStatus };
    }

    for (const ent of visibleEntities) {
      let entTriggered = false;
      for (const card of ent.cards) {
        const matches =
          (simulatedCardId && card.id === simulatedCardId) ||
          (activeEventFilter && card.when.key === activeEventFilter);
        if (!matches) continue;

        const whenId = `when:${ent.id}:${card.id}`;
        const entId = `entity:${ent.id}`;

        if (!card.isEnabled) {
          nodeStatus.set(whenId, 'disabled');
          edgeStatus.set(`e:${entId}->${whenId}`, 'disabled');
          continue;
        }

        entTriggered = true;
        nodeStatus.set(whenId, 'passed');
        edgeStatus.set(`e:${entId}->${whenId}`, 'passed');

        let allCondsPass = true;
        for (const cond of card.conditions) {
          const cid = `if:${ent.id}:${card.id}:${cond.id}`;
          const pass = evalCondition(cond, ent, simState);
          nodeStatus.set(cid, pass ? 'passed' : 'blocked');
          edgeStatus.set(`e:${whenId}->${cid}`, pass ? 'passed' : 'blocked');
          if (!pass) allCondsPass = false;
        }

        for (const act of card.actions) {
          const aid = `then:${ent.id}:${card.id}:${act.id}`;
          nodeStatus.set(aid, allCondsPass ? 'fired' : 'blocked');
          if (card.conditions.length > 0) {
            for (const cond of card.conditions) {
              const cid = `if:${ent.id}:${card.id}:${cond.id}`;
              const condPass = nodeStatus.get(cid) === 'passed';
              edgeStatus.set(
                `e:${cid}->${aid}`,
                allCondsPass && condPass ? 'fired' : 'blocked'
              );
            }
          } else {
            edgeStatus.set(`e:${whenId}->${aid}`, 'fired');
          }
        }
      }

      if (entTriggered) {
        nodeStatus.set(`entity:${ent.id}`, 'passed');
      }
    }

    return { nodeStatus, edgeStatus };
  }, [activeEventFilter, evalCondition, simState, simulatedCardId, visibleEntities]);

  const fireSimulation = useCallback(
    (opts: { eventKey?: string; cardId?: string }) => {
      setActiveEventFilter(opts.eventKey ?? null);
      setSimulatedCardId(opts.cardId ?? null);
      setRightTab('simulate');

      const nextFlags = { ...simState.flags };
      let nextHasKey = simState.hasKey;
      const newLogs: TraceLogEntry[] = [];

      for (const ent of visibleEntities) {
        ent.cards.forEach((card, idx) => {
          const matches =
            (opts.cardId && card.id === opts.cardId) ||
            (opts.eventKey && card.when.key === opts.eventKey);
          if (!matches) return;

          if (!card.isEnabled) {
            newLogs.push({
              id: uid(),
              entityName: ent.name,
              ruleLabel: `Rule ${idx + 1}`,
              outcome: 'disabled',
              detail: 'Skipped (rule is disabled)',
            });
            return;
          }

          const failedConds = card.conditions.filter((c) => !evalCondition(c, ent, simState));
          if (failedConds.length > 0) {
            const first = clauseLabel(BehaviorVocabulary.conditions, failedConds[0]);
            newLogs.push({
              id: uid(),
              entityName: ent.name,
              ruleLabel: `Rule ${idx + 1}`,
              outcome: 'blocked',
              detail: `Blocked by "If ${first.label}${first.detail ? ` (${first.detail})` : ''}"`,
            });
            return;
          }

          const actionSummary =
            card.actions.length === 0
              ? 'No actions attached'
              : card.actions
                  .map((a) => {
                    const info = clauseLabel(BehaviorVocabulary.actions, a);
                    if (a.key === 'setFlag' && info.detail) {
                      nextFlags[normalizeFlagKey(info.detail)] = true;
                    }
                    if (
                      (a.key === 'giveItem' || a.key === 'giveTreasure') &&
                      info.detail.toLowerCase().includes('key')
                    ) {
                      nextHasKey = true;
                    }
                    return `${info.label}${info.detail ? ` (${info.detail})` : ''}`;
                  })
                  .join(', ');

          newLogs.push({
            id: uid(),
            entityName: ent.name,
            ruleLabel: `Rule ${idx + 1}`,
            outcome: 'fired',
            detail: `Fired: ${actionSummary}`,
          });
        });
      }

      // Auto-propagate newly set flags or granted keys so multi-step puzzles can be stepped through!
      if (
        nextHasKey !== simState.hasKey ||
        JSON.stringify(nextFlags) !== JSON.stringify(simState.flags)
      ) {
        setSimState((prev) => ({
          ...prev,
          hasKey: nextHasKey,
          flags: nextFlags,
        }));
      }

      if (newLogs.length > 0) {
        setTraceLog((prev) => [...newLogs, ...prev].slice(0, 18));
      }
    },
    [evalCondition, simState, visibleEntities]
  );

  // Fit graph nicely into viewport
  const fitView = useCallback(() => {
    const el = canvasRef.current;
    if (!el || nodes.length === 0) {
      setZoom(0.92);
      setPan({ x: 24, y: 24 });
      return;
    }
    const cw = el.clientWidth || 800;
    const ch = el.clientHeight || 520;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    positionedNodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });
    const gw = Math.max(300, maxX - minX + 96);
    const gh = Math.max(240, maxY - minY + 96);
    const nextZoom = Math.max(0.45, Math.min(1.12, Math.min(cw / gw, ch / gh)));
    const nextPanX = (cw - (maxX - minX) * nextZoom) / 2 - minX * nextZoom;
    const nextPanY = Math.max(20, (ch - (maxY - minY) * nextZoom) / 2 - minY * nextZoom);
    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  }, [nodes.length, positionedNodes]);

  const focusNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      const target = positionedNodes.get(nodeId);
      const el = canvasRef.current;
      if (!target || !el) return;
      const cw = el.clientWidth || 800;
      const ch = el.clientHeight || 520;
      const z = Math.max(zoom, 0.9);
      setZoom(z);
      setPan({
        x: cw / 2 - (target.x + target.width / 2) * z,
        y: ch / 2 - (target.y + target.height / 2) * z,
      });
    },
    [positionedNodes, zoom]
  );

  // Pointer drag handlers for pan & individual node repositioning
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;
      if (ds.mode === 'pan') {
        setPan({
          x: ds.origPanX + (e.clientX - ds.startX),
          y: ds.origPanY + (e.clientY - ds.startY),
        });
      } else if (ds.mode === 'node') {
        const dx = ds.origDx + (e.clientX - ds.startX) / zoom;
        const dy = ds.origDy + (e.clientY - ds.startY) / zoom;
        setNodeOffsets((prev) => ({ ...prev, [ds.nodeId]: { dx, dy } }));
      }
    };
    const onUp = () => {
      dragStateRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [zoom]);

  if (!currentLevel) return null;

  const totalRules = entities.reduce((s, e) => s + e.cards.length, 0);
  const selectedNode = selectedNodeId ? positionedNodes.get(selectedNodeId) ?? null : null;
  const selectedEntity = selectedNode
    ? entities.find((e) => e.id === selectedNode.entityId) ?? null
    : null;
  const selectedCard =
    selectedEntity && selectedNode?.cardId
      ? selectedEntity.cards.find((c) => c.id === selectedNode.cardId) ?? null
      : null;

  const updateSelectedCard = (
    entityId: string,
    cardId: string,
    updater: (c: BehaviorCard) => BehaviorCard,
    recordUndo = true
  ) => {
    store.updateEntity(
      entityId,
      'edit rule in logic flow',
      (ent) => ({
        ...ent,
        cards: ent.cards.map((c) => (c.id === cardId ? updater(c) : c)),
      }),
      recordUndo
    );
  };

  return (
    <div className={embedded ? 'flex-1 min-h-0 flex flex-col bg-white dark:bg-[#141720] overflow-hidden' : 'flex-1 min-h-0 flex flex-col overflow-hidden'}>
      {/* Top Bar */}
      <header className="shrink-0 px-4 sm:px-5 py-2.5 border-b border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#171A23]">
        <div className="flex items-center gap-3 min-w-0">
          {!embedded && (
            <div className="w-9 h-9 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center shrink-0">
              <Workflow size={18} />
            </div>
          )}
          <div className="min-w-0">
            {!embedded && (
              <h2 className="text-base font-extrabold tracking-tight truncate">
                Logic Flow Visualizer
              </h2>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#949BB0] tabular-nums">
              <span className="font-bold text-slate-700 dark:text-slate-200">{currentLevel.name}</span>
              <span aria-hidden="true">·</span>
              <span>
                {totalRules} rule{totalRules === 1 ? '' : 's'}
              </span>
              <span aria-hidden="true">·</span>
              <span className={diagnostics.length > 0 ? 'text-[#F59E0B] font-semibold' : ''}>
                {diagnostics.length === 0
                  ? 'No rule issues'
                  : `${diagnostics.length} issue${diagnostics.length === 1 ? '' : 's'} detected`}
              </span>
            </div>
          </div>
        </div>

          {/* Graph Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={scopeEntityId}
              onChange={(e) => {
                setScopeEntityId(e.target.value);
                setNodeOffsets({});
              }}
              aria-label="Filter graph by entity"
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
            >
              <option value="all">All entities ({entities.filter((e) => e.cards.length > 0).length} with rules)</option>
              {entities.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.name} ({ent.cards.length} rule{ent.cards.length === 1 ? '' : 's'})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowCrossLinks((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap transition-colors ${
                showCrossLinks
                  ? 'bg-[#38BDF8]/15 border-[#38BDF8]/50 text-[#0284C7] dark:text-[#38BDF8]'
                  : 'bg-slate-100 dark:bg-[#1F2430] border-transparent text-slate-500 dark:text-[#949BB0]'
              }`}
            >
              <GitBranch size={13} />
              <span>Cross-Rule Links</span>
            </button>

            <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 dark:bg-[#1F2430]">
              <button
                type="button"
                title="Zoom out"
                onClick={() => setZoom((z) => Math.max(0.45, Number((z - 0.12).toFixed(2))))}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#272D3C] text-slate-600 dark:text-[#A3ACBF]"
              >
                <ZoomOut size={14} />
              </button>
              <span className="px-1.5 text-[11px] font-mono tabular-nums text-slate-600 dark:text-[#A3ACBF] w-11 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                title="Zoom in"
                onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.12).toFixed(2))))}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#272D3C] text-slate-600 dark:text-[#A3ACBF]"
              >
                <ZoomIn size={14} />
              </button>
              <button
                type="button"
                title="Fit graph to view"
                onClick={fitView}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#272D3C] text-slate-600 dark:text-[#A3ACBF]"
              >
                <Maximize2 size={13} />
              </button>
              <button
                type="button"
                title="Reset dragged node positions"
                onClick={() => {
                  setNodeOffsets({});
                  setPan({ x: 24, y: 24 });
                  setZoom(0.92);
                }}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#272D3C] text-slate-600 dark:text-[#A3ACBF]"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            {!embedded && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Logic Flow"
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </header>

        {/* Main Workspace Split: Node Graph Canvas + Debugger Sidebar */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Interactive Node Canvas */}
          <div className="relative flex-1 min-h-[340px] overflow-hidden bg-[#F7F8FB] dark:bg-[#0D1017] select-none">
            {/* Subtle column guide legend bar */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-4 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-[#171A23]/95 border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-semibold text-slate-600 dark:text-[#A3ACBF] pointer-events-none">
              <span className="text-slate-900 dark:text-slate-100 font-bold">Entity</span>
              <span aria-hidden="true">→</span>
              <span className="text-[#7C5CFF] font-bold">When (Trigger)</span>
              <span aria-hidden="true">→</span>
              <span className="text-[#D97706] dark:text-[#F59E0B] font-bold">If (Conditions)</span>
              <span aria-hidden="true">→</span>
              <span className="text-[#16A34A] dark:text-[#20B46A] font-bold">Then (Actions)</span>
              {showCrossLinks && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#0284C7] dark:text-[#38BDF8] font-bold">
                    Dashed = Flag / Key Link
                  </span>
                </>
              )}
            </div>

            {/* Active Simulation Clear Bar */}
            {(activeEventFilter || simulatedCardId) && (
              <div className="absolute top-3 right-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#171A23] text-white border border-white/[0.12] text-xs font-semibold">
                <span>
                  Trace active:{' '}
                  {activeEventFilter
                    ? BehaviorVocabulary.events.find((e) => e.key === activeEventFilter)?.label ??
                      activeEventFilter
                    : 'Single rule'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveEventFilter(null);
                    setSimulatedCardId(null);
                  }}
                  className="text-[#38BDF8] hover:underline font-bold"
                >
                  Clear
                </button>
              </div>
            )}

            {totalRules === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#7C5CFF]/15 text-[#7C5CFF] flex items-center justify-center">
                  <Workflow size={22} />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-sm font-extrabold">No When-If-Then rules in this level yet</h3>
                  <p className="text-xs text-slate-500 dark:text-[#949BB0] leading-relaxed">
                    Add a rule to any character, chest, door, or prop and it will appear here as an interactive node graph.
                  </p>
                </div>
                {entities[0] && (
                  <button
                    type="button"
                    onClick={() => {
                      store.setSelectedEntityID(entities[0].id);
                      store.addEmptyCard(entities[0].id);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7C5CFF] text-white text-xs font-bold hover:bg-[#6A48F5]"
                  >
                    <Plus size={14} />
                    <span>Add first rule to {entities[0].name}</span>
                  </button>
                )}
              </div>
            ) : (
              <div
                ref={canvasRef}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('[data-flow-node="true"]')) return;
                  setSelectedNodeId(null);
                  dragStateRef.current = {
                    mode: 'pan',
                    startX: e.clientX,
                    startY: e.clientY,
                    origPanX: pan.x,
                    origPanY: pan.y,
                  };
                }}
                onWheel={(e) => {
                  if (!e.ctrlKey && !e.metaKey) {
                    setPan((p) => ({ x: p.x - e.deltaX * 0.6, y: p.y - e.deltaY * 0.6 }));
                    return;
                  }
                  e.preventDefault();
                  const factor = e.deltaY < 0 ? 1.08 : 0.92;
                  setZoom((z) => Math.max(0.45, Math.min(1.6, Number((z * factor).toFixed(3)))));
                }}
                className="w-full h-full cursor-grab active:cursor-grabbing relative"
                style={{
                  backgroundImage:
                    'radial-gradient(circle, rgba(148,163,184,0.28) 1px, transparent 1px)',
                  backgroundSize: `${Math.round(24 * zoom)}px ${Math.round(24 * zoom)}px`,
                  backgroundPosition: `${pan.x}px ${pan.y}px`,
                }}
              >
                {/* Transformed Graph World */}
                <div
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    width: bounds.width,
                    height: bounds.height,
                  }}
                  className="relative"
                >
                  {/* SVG Bezier Connections Layer */}
                  <svg
                    width={bounds.width}
                    height={bounds.height}
                    className="absolute inset-0 pointer-events-none overflow-visible"
                  >
                    <defs>
                      <marker
                        id="arrow-neutral"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#94A3B8" />
                      </marker>
                      <marker
                        id="arrow-pass"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#20B46A" />
                      </marker>
                      <marker
                        id="arrow-block"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#F2545B" />
                      </marker>
                      <marker
                        id="arrow-dep"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#38BDF8" />
                      </marker>
                    </defs>

                    {edges.map((edge) => {
                      const from = positionedNodes.get(edge.fromId);
                      const to = positionedNodes.get(edge.toId);
                      if (!from || !to) return null;

                      const status = traceStatuses.edgeStatus.get(edge.id) ?? 'idle';
                      const isDep = edge.kind === 'dependency';

                      let d: string;
                      let midX: number;
                      let midY: number;

                      if (isDep) {
                        // Arc gracefully back from THEN -> IF across entities
                        const sx = from.x + from.width / 2;
                        const sy = from.y;
                        const tx = to.x + to.width / 2;
                        const ty = to.y;
                        const lift = Math.min(sy, ty) - 48;
                        d = `M ${sx} ${sy} C ${sx} ${lift}, ${tx} ${lift}, ${tx} ${ty}`;
                        midX = (sx + tx) / 2;
                        midY = lift + 6;
                      } else {
                        const sx = from.x + from.width;
                        const sy = from.y + from.height / 2;
                        const tx = to.x;
                        const ty = to.y + to.height / 2;
                        const dx = Math.max(44, Math.abs(tx - sx) * 0.45);
                        d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
                        midX = (sx + tx) / 2;
                        midY = (sy + ty) / 2;
                      }

                      const stroke = isDep
                        ? '#38BDF8'
                        : status === 'fired' || status === 'passed'
                        ? '#20B46A'
                        : status === 'blocked'
                        ? '#F2545B'
                        : status === 'disabled'
                        ? 'rgba(148,163,184,0.35)'
                        : 'rgba(148,163,184,0.65)';

                      const markerEnd = isDep
                        ? 'url(#arrow-dep)'
                        : status === 'fired' || status === 'passed'
                        ? 'url(#arrow-pass)'
                        : status === 'blocked'
                        ? 'url(#arrow-block)'
                        : 'url(#arrow-neutral)';

                      const strokeWidth =
                        status === 'fired' || status === 'passed' || status === 'blocked'
                          ? 2.6
                          : isDep
                          ? 1.8
                          : 1.75;

                      return (
                        <g key={edge.id}>
                          <path
                            d={d}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={strokeWidth}
                            strokeDasharray={isDep ? '6 5' : undefined}
                            markerEnd={markerEnd}
                          />
                          {edge.label && (
                            <g transform={`translate(${midX}, ${midY})`}>
                              <rect
                                x={-46}
                                y={-10}
                                width={92}
                                height={18}
                                rx={5}
                                fill={isDep ? '#0F172A' : '#1E2430'}
                                fillOpacity={0.92}
                              />
                              <text
                                textAnchor="middle"
                                y={3}
                                fontSize={9.5}
                                fontWeight={700}
                                fill={isDep ? '#38BDF8' : '#CBD5E1'}
                              >
                                {edge.label.length > 15
                                  ? `${edge.label.slice(0, 14)}…`
                                  : edge.label}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  {/* Interactive Nodes Layer */}
                  {Array.from(positionedNodes.values()).map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    const trace = traceStatuses.nodeStatus.get(node.id) ?? 'idle';
                    const roleColor =
                      node.role === 'when'
                        ? '#7C5CFF'
                        : node.role === 'if'
                        ? '#F59E0B'
                        : node.role === 'then'
                        ? '#20B46A'
                        : '#64748B';

                    const borderClass = isSelected
                      ? 'border-[#7C5CFF] ring-2 ring-[#7C5CFF]/35'
                      : trace === 'fired' || trace === 'passed'
                      ? 'border-[#20B46A] ring-2 ring-[#20B46A]/25'
                      : trace === 'blocked'
                      ? 'border-[#F2545B] ring-2 ring-[#F2545B]/25'
                      : node.hasWarning
                      ? 'border-[#F59E0B]/80'
                      : 'border-slate-200/90 dark:border-white/[0.1]';

                    return (
                      <div
                        key={node.id}
                        data-flow-node="true"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSelectedNodeId(node.id);
                          setRightTab('inspect');
                          const curOff = nodeOffsets[node.id] ?? { dx: 0, dy: 0 };
                          dragStateRef.current = {
                            mode: 'node',
                            nodeId: node.id,
                            startX: e.clientX,
                            startY: e.clientY,
                            origDx: curOff.dx,
                            origDy: curOff.dy,
                          };
                        }}
                        style={{
                          left: node.x,
                          top: node.y,
                          width: node.width,
                          minHeight: node.height,
                        }}
                        className={`absolute rounded-xl bg-white dark:bg-[#171B26] border ${borderClass} shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between p-2.5 ${
                          node.isEnabled === false ? 'opacity-55' : ''
                        }`}
                      >
                        {/* Connection ports */}
                        {node.role !== 'entity' && (
                          <span
                            className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white dark:bg-[#171B26] border-2"
                            style={{ borderColor: roleColor }}
                          />
                        )}
                        {node.role !== 'then' && (
                          <span
                            className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white dark:bg-[#171B26] border-2"
                            style={{ borderColor: roleColor }}
                          />
                        )}

                        {node.role === 'entity' && node.entityKind ? (
                          <div className="flex items-center gap-2.5">
                            <IconBadge
                              symbol={EntityKindMeta[node.entityKind].symbol}
                              tint={EntityKindMeta[node.entityKind].tint}
                              size={36}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-extrabold truncate">{node.title}</div>
                              <div className="text-[10px] text-slate-500 dark:text-[#949BB0] truncate">
                                {node.subtitle}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="text-[10px] font-extrabold tracking-tight"
                                style={{ color: roleColor }}
                              >
                                {node.subtitle}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {trace === 'passed' && (
                                  <span className="text-[10px] font-extrabold text-[#20B46A]">
                                    Pass
                                  </span>
                                )}
                                {trace === 'fired' && (
                                  <span className="text-[10px] font-extrabold text-[#20B46A]">
                                    Fired
                                  </span>
                                )}
                                {trace === 'blocked' && (
                                  <span className="text-[10px] font-extrabold text-[#F2545B]">
                                    Blocked
                                  </span>
                                )}
                                {trace === 'disabled' && (
                                  <span className="text-[10px] font-bold text-slate-400">
                                    Disabled
                                  </span>
                                )}
                                {node.hasWarning && trace === 'idle' && (
                                  <AlertTriangle size={12} className="text-[#F59E0B]" />
                                )}
                                {node.role === 'when' && node.cardId && (
                                  <button
                                    type="button"
                                    title="Simulate this rule"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      fireSimulation({ cardId: node.cardId });
                                    }}
                                    className="p-1 rounded-md hover:bg-[#7C5CFF]/15 text-[#7C5CFF]"
                                  >
                                    <Play size={11} fill="currentColor" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="text-xs font-bold leading-snug text-slate-900 dark:text-slate-100 mt-0.5 line-clamp-2">
                              {node.title}
                            </div>
                            {node.detail && (
                              <div className="text-[10px] font-mono text-slate-500 dark:text-[#949BB0] truncate mt-1 pt-1 border-t border-slate-200/60 dark:border-white/[0.06]">
                                {node.detail}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Simulator, Inspector & Diagnostics */}
          <aside className="w-full lg:w-[320px] shrink-0 bg-white dark:bg-[#171A23] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] flex flex-col min-h-0 max-h-[42vh] lg:max-h-none">
            {/* Sidebar Tabs */}
            <div className="shrink-0 p-2 border-b border-slate-200/80 dark:border-white/[0.08] grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setRightTab('simulate')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  rightTab === 'simulate'
                    ? 'bg-[#7C5CFF] text-white'
                    : 'text-slate-600 dark:text-[#949BB0] hover:bg-slate-100 dark:hover:bg-[#1F2430]'
                }`}
              >
                Simulate
              </button>
              <button
                type="button"
                onClick={() => setRightTab('inspect')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  rightTab === 'inspect'
                    ? 'bg-[#7C5CFF] text-white'
                    : 'text-slate-600 dark:text-[#949BB0] hover:bg-slate-100 dark:hover:bg-[#1F2430]'
                }`}
              >
                Inspector
              </button>
              <button
                type="button"
                onClick={() => setRightTab('issues')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap tabular-nums ${
                  rightTab === 'issues'
                    ? 'bg-[#7C5CFF] text-white'
                    : 'text-slate-600 dark:text-[#949BB0] hover:bg-slate-100 dark:hover:bg-[#1F2430]'
                }`}
              >
                Issues ({diagnostics.length})
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto maker-scroll p-4 space-y-5">
              {/* TAB 1: LIVE RULE SIMULATOR */}
              {rightTab === 'simulate' && (
                <>
                  <section className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                        Test Game State
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setSimState({
                            hasKey: false,
                            playerClose: true,
                            healthFull: true,
                            flags: {},
                          });
                          setActiveEventFilter(null);
                          setSimulatedCardId(null);
                          setTraceLog([]);
                        }}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      >
                        Reset
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold cursor-pointer">
                        <span>Player has Key</span>
                        <input
                          type="checkbox"
                          checked={simState.hasKey}
                          onChange={(e) =>
                            setSimState((s) => ({ ...s, hasKey: e.target.checked }))
                          }
                          className="accent-[#F59E0B] w-4 h-4"
                        />
                      </label>
                      <label className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold cursor-pointer">
                        <span>Player is Close</span>
                        <input
                          type="checkbox"
                          checked={simState.playerClose}
                          onChange={(e) =>
                            setSimState((s) => ({ ...s, playerClose: e.target.checked }))
                          }
                          className="accent-[#F59E0B] w-4 h-4"
                        />
                      </label>
                      <label className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold cursor-pointer">
                        <span>Player at Full Health</span>
                        <input
                          type="checkbox"
                          checked={simState.healthFull}
                          onChange={(e) =>
                            setSimState((s) => ({ ...s, healthFull: e.target.checked }))
                          }
                          className="accent-[#F59E0B] w-4 h-4"
                        />
                      </label>
                    </div>

                    {discoveredFlags.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.08] space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-[#949BB0] block">
                          Level Flags
                        </span>
                        {discoveredFlags.map((fl) => (
                          <label
                            key={fl.norm}
                            className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold cursor-pointer"
                          >
                            <span className="truncate font-mono text-[11px]">{fl.label}</span>
                            <input
                              type="checkbox"
                              checked={Boolean(simState.flags[fl.norm])}
                              onChange={(e) =>
                                setSimState((s) => ({
                                  ...s,
                                  flags: { ...s.flags, [fl.norm]: e.target.checked },
                                }))
                              }
                              className="accent-[#38BDF8] w-4 h-4 shrink-0"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Fire Trigger Buttons */}
                  <section className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] space-y-2">
                    <h3 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                      Fire Trigger Event
                    </h3>
                    {presentEventKeys.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-[#949BB0]">
                        No rule triggers in this level yet.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {presentEventKeys.map((key) => {
                          const def = BehaviorVocabulary.events.find((e) => e.key === key);
                          const active = activeEventFilter === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => fireSimulation({ eventKey: key })}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                active
                                  ? 'bg-[#20B46A] text-white'
                                  : 'bg-slate-100 dark:bg-[#1F2430] hover:bg-[#7C5CFF]/15 hover:text-[#7C5CFF] text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <Play size={10} fill="currentColor" />
                              <span className="truncate max-w-[190px]">{def?.label ?? key}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Trace Output */}
                  <section className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                        Execution Trace
                      </h3>
                      {traceLog.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTraceLog([])}
                          className="text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {traceLog.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-[#949BB0] leading-relaxed">
                        Click a trigger button above or press the play icon on any When node to trace pass/block paths through the graph.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {traceLog.map((entry) => (
                          <div
                            key={entry.id}
                            className="py-2 px-2.5 rounded-xl bg-slate-100/80 dark:bg-[#1F2430] space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-extrabold truncate">
                                {entry.entityName} · {entry.ruleLabel}
                              </span>
                              <span
                                className={`font-extrabold shrink-0 ${
                                  entry.outcome === 'fired'
                                    ? 'text-[#20B46A]'
                                    : entry.outcome === 'blocked'
                                    ? 'text-[#F2545B]'
                                    : 'text-slate-400'
                                }`}
                              >
                                {entry.outcome === 'fired'
                                  ? 'Fired'
                                  : entry.outcome === 'blocked'
                                  ? 'Blocked'
                                  : 'Disabled'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-[#A3ACBF] leading-snug">
                              {entry.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* TAB 2: NODE & RULE INSPECTOR */}
              {rightTab === 'inspect' && (
                <>
                  {!selectedNode || !selectedEntity ? (
                    <div className="py-10 text-center space-y-2">
                      <SlidersHorizontal size={20} className="mx-auto text-slate-400" />
                      <p className="text-xs text-slate-500 dark:text-[#949BB0]">
                        Select any node in the graph to inspect or edit its When-If-Then rule directly.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold truncate">{selectedEntity.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                            {EntityKindMeta[selectedEntity.kind].title} ·{' '}
                            {selectedEntity.cards.length} rule
                            {selectedEntity.cards.length === 1 ? '' : 's'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            store.setSelectedEntityID(selectedEntity.id);
                            store.setSelectedTab('logic');
                            if (onSwitchToRules) {
                              onSwitchToRules();
                            } else {
                              onClose?.();
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] hover:bg-[#7C5CFF]/15 hover:text-[#7C5CFF] text-[11px] font-bold shrink-0"
                        >
                          <Eye size={12} />
                          <span>{onSwitchToRules ? 'Basic Rules' : 'Logic Tab'}</span>
                        </button>
                      </div>

                      {selectedNode.role === 'entity' && (
                        <button
                          type="button"
                          onClick={() => store.addEmptyCard(selectedEntity.id)}
                          className="w-full py-2 px-3 rounded-xl bg-[#7C5CFF] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-[#6A48F5]"
                        >
                          <Plus size={14} />
                          <span>Add Rule to {selectedEntity.name}</span>
                        </button>
                      )}

                      {selectedCard && (
                        <>
                          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold leading-relaxed">
                            {ruleSentence(selectedCard)}
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedCard.isEnabled}
                                onChange={(e) =>
                                  updateSelectedCard(selectedEntity.id, selectedCard.id, (c) => ({
                                    ...c,
                                    isEnabled: e.target.checked,
                                  }))
                                }
                                className="accent-[#20B46A]"
                              />
                              <span>Active</span>
                            </label>
                            <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedCard.isOnce}
                                onChange={(e) =>
                                  updateSelectedCard(selectedEntity.id, selectedCard.id, (c) => ({
                                    ...c,
                                    isOnce: e.target.checked,
                                  }))
                                }
                                className="accent-[#7C5CFF]"
                              />
                              <span>Only once</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => fireSimulation({ cardId: selectedCard.id })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#20B46A] text-white text-[11px] font-bold"
                            >
                              <Play size={10} fill="currentColor" />
                              <span>Test</span>
                            </button>
                          </div>

                          {/* Edit WHEN */}
                          <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] space-y-2">
                            <span className="text-[11px] font-extrabold text-[#7C5CFF] block">
                              When Trigger
                            </span>
                            <select
                              value={selectedCard.when.key}
                              onChange={(e) =>
                                updateSelectedCard(selectedEntity.id, selectedCard.id, (c) => ({
                                  ...c,
                                  when: { ...c.when, key: e.target.value },
                                }))
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-bold"
                            >
                              {BehaviorVocabulary.events.map((ev) => (
                                <option key={ev.key} value={ev.key}>
                                  {ev.label}
                                </option>
                              ))}
                            </select>
                            {BehaviorVocabulary.events.find((e) => e.key === selectedCard.when.key)
                              ?.needsDetail && (
                              <input
                                type="text"
                                value={selectedCard.when.detail}
                                placeholder="Trigger detail…"
                                onChange={(e) =>
                                  updateSelectedCard(
                                    selectedEntity.id,
                                    selectedCard.id,
                                    (c) => ({
                                      ...c,
                                      when: { ...c.when, detail: e.target.value },
                                    }),
                                    false
                                  )
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-mono"
                              />
                            )}
                          </div>

                          {/* Edit IF Conditions */}
                          <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold text-[#D97706] dark:text-[#F59E0B]">
                                If Conditions ({selectedCard.conditions.length})
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedCard(selectedEntity.id, selectedCard.id, (c) => ({
                                    ...c,
                                    conditions: [
                                      ...c.conditions,
                                      { id: uid(), key: 'hasKey', detail: '' },
                                    ],
                                  }))
                                }
                                className="text-[11px] font-bold text-[#F59E0B] hover:underline"
                              >
                                + Add
                              </button>
                            </div>
                            {selectedCard.conditions.map((cond) => {
                              const def = BehaviorVocabulary.conditions.find(
                                (d) => d.key === cond.key
                              );
                              return (
                                <div key={cond.id} className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={cond.key}
                                      onChange={(e) =>
                                        updateSelectedCard(
                                          selectedEntity.id,
                                          selectedCard.id,
                                          (c) => ({
                                            ...c,
                                            conditions: c.conditions.map((x) =>
                                              x.id === cond.id ? { ...x, key: e.target.value } : x
                                            ),
                                          })
                                        )
                                      }
                                      className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-bold"
                                    >
                                      {BehaviorVocabulary.conditions.map((cd) => (
                                        <option key={cd.key} value={cd.key}>
                                          {cd.label}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateSelectedCard(
                                          selectedEntity.id,
                                          selectedCard.id,
                                          (c) => ({
                                            ...c,
                                            conditions: c.conditions.filter(
                                              (x) => x.id !== cond.id
                                            ),
                                          })
                                        )
                                      }
                                      className="p-1.5 text-slate-400 hover:text-[#F2545B]"
                                      title="Remove condition"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                  {def?.needsDetail && (
                                    <input
                                      type="text"
                                      value={cond.detail}
                                      placeholder={def.detailHint}
                                      onChange={(e) =>
                                        updateSelectedCard(
                                          selectedEntity.id,
                                          selectedCard.id,
                                          (c) => ({
                                            ...c,
                                            conditions: c.conditions.map((x) =>
                                              x.id === cond.id
                                                ? { ...x, detail: e.target.value }
                                                : x
                                            ),
                                          }),
                                          false
                                        )
                                      }
                                      className="w-full px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-mono"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Edit THEN Actions */}
                          <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold text-[#16A34A] dark:text-[#20B46A]">
                                Then Actions ({selectedCard.actions.length})
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedCard(selectedEntity.id, selectedCard.id, (c) => ({
                                    ...c,
                                    actions: [
                                      ...c.actions,
                                      { id: uid(), key: 'say', detail: 'Hello!' },
                                    ],
                                  }))
                                }
                                className="text-[11px] font-bold text-[#20B46A] hover:underline"
                              >
                                + Add
                              </button>
                            </div>
                            {selectedCard.actions.map((act) => {
                              const def = BehaviorVocabulary.actions.find((d) => d.key === act.key);
                              return (
                                <div key={act.id} className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={act.key}
                                      onChange={(e) =>
                                        updateSelectedCard(
                                          selectedEntity.id,
                                          selectedCard.id,
                                          (c) => ({
                                            ...c,
                                            actions: c.actions.map((x) =>
                                              x.id === act.id ? { ...x, key: e.target.value } : x
                                            ),
                                          })
                                        )
                                      }
                                      className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-bold"
                                    >
                                      {BehaviorVocabulary.actions.map((ad) => (
                                        <option key={ad.key} value={ad.key}>
                                          {ad.label}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateSelectedCard(
                                          selectedEntity.id,
                                          selectedCard.id,
                                          (c) => ({
                                            ...c,
                                            actions: c.actions.filter((x) => x.id !== act.id),
                                          })
                                        )
                                      }
                                      className="p-1.5 text-slate-400 hover:text-[#F2545B]"
                                      title="Remove action"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                  {def?.needsDetail && (
                                    <input
                                      type="text"
                                      value={act.detail}
                                      placeholder={def.detailHint}
                                      list={
                                        act.key === 'attack' || act.key === 'landAndAttack'
                                          ? 'flow-baddie-action-list'
                                          : act.key === 'flyPattern'
                                            ? 'flow-baddie-flight-list'
                                            : undefined
                                      }
                                      onChange={(e) =>
                                        updateSelectedCard(
                                          selectedEntity.id,
                                          selectedCard.id,
                                          (c) => ({
                                            ...c,
                                            actions: c.actions.map((x) =>
                                              x.id === act.id
                                                ? { ...x, detail: e.target.value }
                                                : x
                                            ),
                                          }),
                                          false
                                        )
                                      }
                                      className="w-full px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-mono"
                                    />
                                  )}
                                </div>
                              );
                            })}
                            <datalist id="flow-baddie-action-list">
                              {BADDIE_ACTION_LIBRARY.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.label}
                                </option>
                              ))}
                            </datalist>
                            <datalist id="flow-baddie-flight-list">
                              {FLIGHT_PATTERN_OPTIONS.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.label}
                                </option>
                              ))}
                            </datalist>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* TAB 3: AUTOMATED LOGIC DIAGNOSTICS */}
              {rightTab === 'issues' && (
                <>
                  {diagnostics.length === 0 ? (
                    <div className="py-10 text-center space-y-2">
                      <CheckCircle2 size={22} className="mx-auto text-[#20B46A]" />
                      <div className="text-xs font-extrabold">All rules look healthy</div>
                      <p className="text-[11px] text-slate-500 dark:text-[#949BB0]">
                        No broken flags, empty details, or dead triggers were found in this level.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {diagnostics.map((issue) => (
                        <button
                          key={issue.id}
                          type="button"
                          onClick={() => {
                            if (scopeEntityId !== 'all' && scopeEntityId !== issue.entityId) {
                              setScopeEntityId('all');
                            }
                            setTimeout(() => focusNode(issue.nodeId), 30);
                            setRightTab('inspect');
                          }}
                          className="w-full text-left p-3 rounded-xl bg-slate-100/80 dark:bg-[#1F2430] hover:bg-slate-200/70 dark:hover:bg-[#272D3C] transition-colors space-y-1"
                        >
                          <div className="flex items-start gap-2">
                            {issue.severity === 'error' ? (
                              <XCircle size={14} className="text-[#F2545B] shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle size={14} className="text-[#F59E0B] shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-bold leading-snug">{issue.title}</div>
                              <p className="text-[11px] text-slate-500 dark:text-[#949BB0] leading-snug mt-0.5">
                                {issue.detail}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
    </div>
  );
};
