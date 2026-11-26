import {
  createDefaultCanopyConfig,
  createDefaultSpeciesConfig,
} from '../data/canopyEnginePresets';
import {
  BehaviorVocabulary,
  createBlankLevel,
  createEntity,
  makeWidget,
} from '../data/registries';
import type { MakerStore } from '../store/useMakerStore';
import {
  CHARACTER_PRESETS,
  createCharacterPresetDoc,
  createDefaultAddonConfig,
  createDefaultSpikesConfig,
  createMuzzlePreset,
} from '../three/characterMakerBuilder';
import {
  createBeardPresetConfig,
  createMustachePresetConfig,
  createSideburnsPresetConfig,
  resolveFacialHairConfig,
} from '../three/facialHairBuilder';
import * as THREE from 'three';
import {
  OBJECT_PRIMITIVE_CATALOG,
  buildPartGeometry,
  centerAndGroundObjectDoc,
  computePartWorldMatrix,
  createDefaultMaterialFinish,
  createDefaultPartSpec,
} from '../three/objectMakerBuilder';
import { performBooleanCsg, serializeBufferGeometry } from '../three/meshCsg';
import {
  PLANT_SHAPE_CATALOG,
  createClusterGroupAndParts,
  createStarterPlantDoc,
  getPlantShapeMeta,
  isPlantShape,
} from '../three/plantMakerBuilder';
import {
  MONSTER_PRESETS,
  createDefaultMonsterBlueprint,
  resolveMonsterBlueprint,
  type ResolvedMonsterBlueprint,
} from '../three/quadrupedMonsterBuilder';
import {
  MONSTER_ABILITY_CATALOG,
  MONSTER_ATTACK_CATALOG,
} from '../three/monsterAttackVfx';
import type {
  AssetCategory,
  BaddieWindupClueStyle,
  BehaviorCard,
  BiomeId,
  BonePoseAngles,
  BuildingMaterialId,
  CanopyCrownSilhouette,
  CanopyLeafShape,
  CaveGrotto,
  CharacterBeardStyle,
  CharacterBeakStyle,
  CharacterBodyGearStyle,
  CharacterEarStyle,
  CharacterEyebrowExpression,
  CharacterEyewearStyle,
  CharacterFootStyle,
  CharacterHairStyle,
  CharacterHandStyle,
  CharacterHeadGearStyle,
  CharacterHornStyle,
  CharacterLimbProfile,
  CharacterMakerDoc,
  CharacterMaterialFinish,
  CharacterMouthStyle,
  CharacterMustacheStyle,
  CharacterMuzzlePresetId,
  CharacterNoseStyle,
  CharacterPresetId,
  CharacterSideburnsStyle,
  CharacterSpikesStyle,
  CharacterSpikesZone,
  CharacterSurfaceCoatMode,
  CharacterTailStyle,
  CharacterWingStyle,
  CompleteCondition,
  ConiferShapeStyle,
  CreatureExpressionMood,
  BuiltinMechanismTemplate,
  CustomClipSlot,
  CustomMotionPreset,
  CustomPoseKeyframe,
  EntityKind,
  FeatureFrequency,
  FruitDistributionMode,
  GameLevel,
  HUDWidget,
  LeafSeasonPresetId,
  LevelEntity,
  MechanismKind,
  MonsterAbilityId,
  MonsterAttackType,
  MonsterBlueprint,
  MonsterEarStyle,
  MonsterHeadStyle,
  MonsterHornStyle,
  MonsterPawStyle,
  MonsterTailStyle,
  MonsterWingStyle,
  MotionEasing,
  ObjectAttachBodyPart,
  ObjectMakerDoc,
  ObjectMechanism,
  ObjectPartSpec,
  ObjectPrimitiveShapeId,
  ObjectSdfBlobConfig,
  ObjectSdfNode,
  ObjectSplineConfig,
  ObjectSplineProfile,
  PlantClusterLayout,
  PlantClusterRecipe,
  PlantLeafPatternId,
  PlantShapeId,
  PlatformMotionType,
  PlatformPreset,
  RigBoneRole,
  RoadSpline,
  SidePlatformSegment,
  SidePlatformSegmentStyle,
  SideScrollerBackdropStyle,
  SideScrollerConfig,
  SideScrollerLayoutStyle,
  SideScrollerSecretRoom,
  SideScrollerThemeId,
  SideScrollerVineOrLadder,
  SkyPresetId,
  StorybookThemeId,
  StylizedCanopyConfig,
  TerrainData,
  TreeBarkStyle,
  TreeGeneratorMode,
  TreeSpeciesType,
  WaterBodyConfig,
  WeatherKind,
  WidgetAnchor,
  WidgetKind,
} from '../types/maker';
import { getDefaultMechanismsForTemplate } from '../three/mechanismController';
import type { AiApplyOptions, CharacterPromptGuide } from './studioBridge';
import {
  IslandTerrain,
  applyMountainCaveToTerrain,
  applyRoadSplineToTerrain,
  carveWaterBodyIntoTerrain,
  createDefaultMountainConfig,
  createInitialTerrain,
  createSideScrollerPresetConfig,
  ensureUpgradedTerrain,
  getEnvironmentType,
  getSideScrollerThemeLayers,
  getTerrainRadius,
  levelWorldToBoard,
  normalizeCaveGrotto,
  sampleLevelHeight,
  sampleTerrainHeight,
  uid,
} from '../utils/terrain';
import {
  LAND_REGION_PALETTE,
  createEmptyWorldMap,
  createScratchOceanTerrain,
  ensureWorldMapForProject,
  getWorldMapRadius,
} from '../utils/worldMap';

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

const NAMED_HEX_MAP: Record<string, string> = {
  brown: '#6D442B',
  'dark brown': '#3E2723',
  'light brown': '#8D6E63',
  tan: '#D2B48C',
  beige: '#F5F5DC',
  red: '#DC2626',
  'dark red': '#991B1B',
  crimson: '#B91C1C',
  orange: '#EA580C',
  yellow: '#FACC15',
  gold: '#F59E0B',
  golden: '#F59E0B',
  amber: '#D97706',
  green: '#16A34A',
  'dark green': '#15803D',
  'forest green': '#166534',
  lime: '#84CC16',
  emerald: '#10B981',
  teal: '#0D9488',
  cyan: '#06B6D4',
  blue: '#2563EB',
  navy: '#1E3A8A',
  'royal blue': '#1D4ED8',
  'sky blue': '#38BDF8',
  purple: '#9333EA',
  violet: '#7C3AED',
  magenta: '#C026D3',
  pink: '#EC4899',
  rose: '#F43F5E',
  white: '#F9FAFB',
  cream: '#FEF3C7',
  ivory: '#FDFBF7',
  gray: '#6B7280',
  grey: '#6B7280',
  'dark gray': '#374151',
  'dark grey': '#374151',
  'light gray': '#D1D5DB',
  'light grey': '#D1D5DB',
  black: '#111827',
  charcoal: '#1F2937',
  bronze: '#92400E',
  copper: '#B45309',
  silver: '#94A3B8',
  steel: '#64748B',
  iron: '#475569',
  pewter: '#6B7280',
  rust: '#9A3412',
  maroon: '#831843',
  lavender: '#C4B5FD',
  mint: '#6EE7B7',
  olive: '#65A30D',
  coral: '#FB7185',
  peach: '#FDBA74',
};

function hexColor(v: unknown, fallback: string): string {
  if (typeof v === 'string') {
    const clean = v.trim().toLowerCase();
    if (NAMED_HEX_MAP[clean]) {
      return NAMED_HEX_MAP[clean];
    }
    for (const [name, hex] of Object.entries(NAMED_HEX_MAP)) {
      if (clean === name || clean.startsWith(name + ' ') || clean.endsWith(' ' + name)) {
        return hex;
      }
    }
    const hexCandidate = clean.startsWith('#') ? clean : `#${clean}`;
    if (/^#[0-9a-f]{6}$/i.test(hexCandidate) || /^#[0-9a-f]{3}$/i.test(hexCandidate)) {
      return hexCandidate;
    }
  }
  return fallback;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && allowed.includes(v as T) ? (v as T) : fallback;
}

function vec3(
  v: unknown,
  fallback: [number, number, number],
  min = -5,
  max = 5
): [number, number, number] {
  if (!Array.isArray(v) || v.length < 3) return fallback;
  return [
    num(v[0], fallback[0], min, max),
    num(v[1], fallback[1], min, max),
    num(v[2], fallback[2], min, max),
  ];
}

// ---------------------------------------------------------------------------
// 1. OBJECT MAKER SANITIZER
// ---------------------------------------------------------------------------
const VALID_OBJECT_SHAPES = OBJECT_PRIMITIVE_CATALOG.map((p) => p.id);
const VALID_MATERIALS: BuildingMaterialId[] = [
  'hewnStone',
  'sandstone',
  'randomCobble',
  'squareFlagstone',
  'crackedSlate',
  'masonryBrick',
  'wattlePlaster',
  'packedDirt',
  'timberPlank',
  'roundLogs',
  'weatheredSlats',
  'thatchedStraw',
  'clayTile',
  'woodShingle',
  'rustedIron',
];
const VALID_ATTACH_PARTS: ObjectAttachBodyPart[] = [
  'rightHand',
  'leftHand',
  'head',
  'back',
  'hips',
];

export interface SanitizedObjectResult {
  name: string;
  category: AssetCategory;
  summary: string;
  attachBodyPart: ObjectAttachBodyPart | null;
  doc: ObjectMakerDoc;
  mechanisms: ObjectMechanism[];
}

export interface ObjectApplyExistingState {
  doc: ObjectMakerDoc;
  mechanisms: ObjectMechanism[];
  name?: string;
  category?: AssetCategory;
  attachBodyPart?: ObjectAttachBodyPart | null;
  modifyExisting?: boolean;
}

export function sanitizeObjectMakerResult(
  raw: Record<string, unknown>,
  existing?: ObjectApplyExistingState
): SanitizedObjectResult {
  const isModify = Boolean(existing?.modifyExisting && existing.doc.parts.length > 0);
  const name = str(raw.name, isModify && existing?.name ? existing.name : 'AI Prop');
  const category = oneOf<AssetCategory>(
    raw.category,
    ['prop', 'scenery', 'building'],
    isModify && existing?.category ? existing.category : 'prop'
  );
  const summary = str(raw.summary, isModify ? `Modified ${name}` : `Generated ${name}`);
  const attachBodyPart =
    raw.attachBodyPart === null
      ? null
      : typeof raw.attachBodyPart === 'string' &&
          VALID_ATTACH_PARTS.includes(raw.attachBodyPart as ObjectAttachBodyPart)
        ? (raw.attachBodyPart as ObjectAttachBodyPart)
        : isModify
          ? existing?.attachBodyPart ?? null
          : null;

  const buildSanitizedPart = (
    p: Record<string, unknown>,
    idx: number,
    prevPart?: ObjectPartSpec
  ): ObjectPartSpec => {
    const shape = oneOf<ObjectPrimitiveShapeId>(
      p.shape,
      VALID_OBJECT_SHAPES,
      prevPart?.shape ?? 'cube'
    );
    const base = prevPart ?? createDefaultPartSpec(shape);
    const hasMat =
      typeof p.materialId === 'string' &&
      VALID_MATERIALS.includes(p.materialId as BuildingMaterialId);
    const matId = hasMat ? (p.materialId as BuildingMaterialId) : undefined;
    const finish = matId
      ? createDefaultMaterialFinish(
          matId,
          hexColor(p.color, prevPart?.material.color ?? '#CBD5E1')
        )
      : prevPart?.material ??
        createDefaultMaterialFinish(undefined, hexColor(p.color, '#CBD5E1'));

    const emissiveHex =
      typeof p.emissive === 'string' ? hexColor(p.emissive, '') : '';

    // Deformers (accept either top-level p.taperStart or nested p.modifiers.taperStart)
    const modRaw =
      p.modifiers && typeof p.modifiers === 'object'
        ? (p.modifiers as Record<string, unknown>)
        : {};
    const getMod = (k: string) => (modRaw[k] !== undefined ? modRaw[k] : p[k]);

    const rawTaperStart = getMod('taperStart');
    const rawTaperEnd = getMod('taperEnd');
    const rawSmoothStart = getMod('taperSmoothStart');
    const rawSmoothEnd = getMod('taperSmoothEnd');
    const rawBendAngle = getMod('bendAngle');
    const rawBendAxis = getMod('bendAxis');
    const rawTwistAngle = getMod('twistAngle');

    const modifiers = {
      ...base.modifiers,
      bevel:
        getMod('bevel') !== undefined
          ? num(getMod('bevel'), base.modifiers.bevel, 0, 0.35)
          : base.modifiers.bevel,
      segments:
        getMod('segments') !== undefined
          ? Math.round(num(getMod('segments'), base.modifiers.segments ?? 16, 8, 32))
          : base.modifiers.segments,
      taperStart:
        rawTaperStart !== undefined
          ? num(rawTaperStart, base.modifiers.taperStart ?? 1, 0.05, 2.2)
          : base.modifiers.taperStart,
      taperEnd:
        rawTaperEnd !== undefined
          ? num(rawTaperEnd, base.modifiers.taperEnd ?? 1, 0.05, 2.2)
          : base.modifiers.taperEnd,
      taperSmoothStart:
        rawSmoothStart !== undefined
          ? num(rawSmoothStart, base.modifiers.taperSmoothStart ?? 0.35, 0.05, 1)
          : base.modifiers.taperSmoothStart,
      taperSmoothEnd:
        rawSmoothEnd !== undefined
          ? num(rawSmoothEnd, base.modifiers.taperSmoothEnd ?? 0.35, 0.05, 1)
          : base.modifiers.taperSmoothEnd,
      bendAngle:
        rawBendAngle !== undefined
          ? num(rawBendAngle, base.modifiers.bendAngle ?? 0, -170, 170)
          : base.modifiers.bendAngle,
      bendAxis:
        rawBendAxis === 'x' || rawBendAxis === 'z'
          ? (rawBendAxis as 'x' | 'z')
          : base.modifiers.bendAxis,
      twistAngle:
        rawTwistAngle !== undefined
          ? num(rawTwistAngle, base.modifiers.twistAngle ?? 0, -360, 360)
          : base.modifiers.twistAngle,
    };

    // Sanitize splineConfig (accept nested p.splineConfig or top-level p.points)
    let splineConfig: ObjectSplineConfig | undefined = base.splineConfig;
    const rawSpline =
      p.splineConfig && typeof p.splineConfig === 'object'
        ? (p.splineConfig as Record<string, unknown>)
        : Array.isArray(p.points)
          ? p
          : null;
    if (shape === 'splineTube' && rawSpline) {
      const rawPts = Array.isArray(rawSpline.points) ? rawSpline.points : [];
      const parsedPts: [number, number, number][] = [];
      for (const entry of rawPts.slice(0, 16)) {
        if (Array.isArray(entry) && entry.length >= 3) {
          parsedPts.push([
            num(entry[0], 0, -4, 4),
            num(entry[1], 0, -4, 4),
            num(entry[2], 0, -4, 4),
          ]);
        }
      }
      const fallbackPts = base.splineConfig?.points ?? [
        [0, -0.6, -0.14],
        [0, 0, 0.14],
        [0, 0.6, -0.14],
      ];
      const finalPts = parsedPts.length >= 2 ? parsedPts : fallbackPts;
      const rawRadii = Array.isArray(rawSpline.pointRadii) ? rawSpline.pointRadii : null;
      const pointRadii =
        rawRadii && rawRadii.length === finalPts.length
          ? rawRadii.map((r) => num(r, 1, 0.08, 3.0))
          : undefined;
      splineConfig = {
        points: finalPts,
        ...(pointRadii ? { pointRadii } : {}),
        profile: oneOf<ObjectSplineProfile>(
          rawSpline.profile,
          ['round', 'oval', 'flatStave', 'beveledBar'],
          base.splineConfig?.profile ?? 'round'
        ),
        radius: num(rawSpline.radius, base.splineConfig?.radius ?? 0.045, 0.006, 0.6),
        ovalness: num(rawSpline.ovalness, base.splineConfig?.ovalness ?? 0.55, 0.15, 2.0),
        taperStart: num(rawSpline.taperStart ?? modifiers.taperStart, 1, 0.05, 2.2),
        taperEnd: num(rawSpline.taperEnd ?? modifiers.taperEnd, 1, 0.05, 2.2),
        taperSmoothStart: num(rawSpline.taperSmoothStart ?? modifiers.taperSmoothStart, 0.35, 0.05, 1),
        taperSmoothEnd: num(rawSpline.taperSmoothEnd ?? modifiers.taperSmoothEnd, 0.35, 0.05, 1),
        closed: Boolean(rawSpline.closed),
        steps: Math.round(num(rawSpline.steps, Math.max(24, finalPts.length * 7), 12, 72)),
        radialSegments: Math.round(num(rawSpline.radialSegments ?? modifiers.segments, 14, 6, 24)),
        mirrorSymmetry: oneOf(rawSpline.mirrorSymmetry, ['none', 'y', 'x'] as const, 'none'),
      };
    }

    // Sanitize latheProfile
    let latheProfile: [number, number][] | undefined = base.latheProfile;
    if (shape === 'lathe' && Array.isArray(p.latheProfile)) {
      const pts: [number, number][] = [];
      for (const entry of p.latheProfile.slice(0, 24)) {
        if (Array.isArray(entry) && entry.length >= 2) {
          pts.push([num(entry[0], 0.15, 0.004, 2.5), num(entry[1], 0, -3, 3)]);
        }
      }
      if (pts.length >= 2) latheProfile = pts;
    }

    // Sanitize sdfBlobConfig
    let sdfBlobConfig: ObjectSdfBlobConfig | undefined = base.sdfBlobConfig;
    const rawSdf =
      p.sdfBlobConfig && typeof p.sdfBlobConfig === 'object'
        ? (p.sdfBlobConfig as Record<string, unknown>)
        : Array.isArray(p.sdfPrimitives)
          ? { primitives: p.sdfPrimitives }
          : null;
    if (shape === 'sdfBlob' && rawSdf) {
      const rawNodes = Array.isArray(rawSdf.primitives) ? rawSdf.primitives : [];
      const nodes: ObjectSdfNode[] = [];
      for (const entry of rawNodes.slice(0, 14)) {
        if (!entry || typeof entry !== 'object') continue;
        const n = entry as Record<string, unknown>;
        const rawKind =
          n.kind === 'box'
            ? 'roundedBox'
            : n.kind === 'cone'
              ? 'capsule'
              : n.kind;
        nodes.push({
          kind: oneOf(rawKind, ['ellipsoid', 'capsule', 'roundedBox'] as const, 'ellipsoid'),
          op: n.op === 'sub' ? 'sub' : 'add',
          a: vec3(n.a, [0, 0, 0], -3, 3),
          b: vec3(n.b, [0.22, 0.22, 0.22], -3, 3),
          ...(n.startRadius !== undefined ? { startRadius: num(n.startRadius, 0.14, 0.015, 0.8) } : {}),
          ...(n.midRadius !== undefined ? { midRadius: num(n.midRadius, 0.14, 0.015, 0.8) } : {}),
          ...(n.endRadius !== undefined ? { endRadius: num(n.endRadius, 0.12, 0.01, 0.8) } : {}),
          ...(n.curvature !== undefined ? { curvature: num(n.curvature, 0, -0.8, 0.8) } : {}),
          ...(n.roundness !== undefined ? { roundness: num(n.roundness, 0.05, 0.005, 0.3) } : {}),
        });
      }
      if (nodes.length > 0) {
        sdfBlobConfig = {
          blendK: num(rawSdf.blendK, 0.12, 0.02, 0.4),
          resolution: Math.round(num(rawSdf.resolution, 28, 18, 38)),
          primitives: nodes,
        };
      }
    }

    return {
      ...base,
      id: prevPart?.id ?? uid(),
      shape,
      name: str(p.name, prevPart?.name ?? `Part_${idx + 1}`),
      position:
        p.position !== undefined
          ? vec3(p.position, base.position, -4, 4)
          : base.position,
      rotation:
        p.rotation !== undefined
          ? vec3(p.rotation, base.rotation, -180, 180)
          : base.rotation,
      dimensions:
        p.dimensions !== undefined
          ? vec3(p.dimensions, base.dimensions, 0.01, 4)
          : base.dimensions,
      modifiers,
      ...(splineConfig ? { splineConfig } : {}),
      ...(latheProfile ? { latheProfile } : {}),
      ...(sdfBlobConfig ? { sdfBlobConfig } : {}),
      ...(p.isCutter === true ? { isCutter: true } : {}),
      material: {
        ...finish,
        color:
          typeof p.color === 'string'
            ? hexColor(p.color, finish.color)
            : finish.color,
        roughness:
          p.roughness !== undefined
            ? num(p.roughness, finish.roughness, 0.05, 1)
            : finish.roughness,
        metalness:
          p.metalness !== undefined
            ? num(p.metalness, finish.metalness, 0, 1)
            : finish.metalness,
        ...(emissiveHex
          ? {
              emissive: emissiveHex,
              emissiveIntensity: num(
                p.emissiveIntensity,
                finish.emissiveIntensity ?? 1.0,
                0,
                3
              ),
            }
          : {}),
      },
    };
  };

  const rawParts = Array.isArray(raw.parts) ? raw.parts : [];
  let parts: ObjectPartSpec[] = [];
  const cutterTargetsById = new Map<string, string[]>();

  const trackCutTargets = (partId: string, entry: Record<string, unknown>) => {
    if (entry.isCutter === true && Array.isArray(entry.cutTargets)) {
      const list = entry.cutTargets
        .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
        .filter(Boolean);
      if (list.length > 0) cutterTargetsById.set(partId, list);
    }
  };

  if (isModify && existing && raw.replaceAll !== true) {
    parts = existing.doc.parts.map((pt) => ({ ...pt }));
    rawParts.slice(0, 18).forEach((entry, idx) => {
      if (!entry || typeof entry !== 'object') return;
      const p = entry as Record<string, unknown>;
      const targetName = typeof p.name === 'string' ? p.name.trim().toLowerCase() : '';
      const matchIdx = targetName
        ? parts.findIndex((existingPt) => existingPt.name.toLowerCase() === targetName)
        : -1;
      if (matchIdx >= 0) {
        parts[matchIdx] = buildSanitizedPart(p, matchIdx, parts[matchIdx]);
        trackCutTargets(parts[matchIdx].id, p);
      } else {
        const added = buildSanitizedPart(p, parts.length + idx);
        parts.push(added);
        trackCutTargets(added.id, p);
      }
    });
  } else {
    rawParts.slice(0, 18).forEach((entry, idx) => {
      if (!entry || typeof entry !== 'object') return;
      const p = entry as Record<string, unknown>;
      const added = buildSanitizedPart(p, idx);
      parts.push(added);
      trackCutTargets(added.id, p);
    });
  }

  // Automatically execute CSG boolean subtract for any AI cutter parts (`isCutter: true`)
  const cutters = parts.filter((pt) => pt.isCutter);
  if (cutters.length > 0) {
    let solids = parts.filter((pt) => !pt.isCutter);
    const tempDoc: ObjectMakerDoc = { version: 1, parts, groups: existing?.doc.groups ?? [] };
    for (const cutter of cutters) {
      const cutGeo = buildPartGeometry(cutter);
      const cutMat = computePartWorldMatrix(tempDoc, cutter);
      cutGeo.computeBoundingBox();
      const cutBox = cutGeo.boundingBox?.clone().applyMatrix4(cutMat);
      const targetNames = cutterTargetsById.get(cutter.id);

      solids = solids.map((solid) => {
        if (targetNames && !targetNames.includes(solid.name.toLowerCase())) {
          return solid;
        }
        const solidGeo = buildPartGeometry(solid);
        const solidMat = computePartWorldMatrix(tempDoc, solid);
        solidGeo.computeBoundingBox();
        const solidBox = solidGeo.boundingBox?.clone().applyMatrix4(solidMat);
        if (cutBox && solidBox && !cutBox.intersectsBox(solidBox)) {
          solidGeo.dispose();
          return solid;
        }
        const csgRes = performBooleanCsg('subtract', solidGeo, solidMat, cutGeo, cutMat);
        solidGeo.dispose();
        if (!csgRes) return solid;

        csgRes.geometry.computeBoundingBox();
        const sz = new THREE.Vector3();
        csgRes.geometry.boundingBox?.getSize(sz);
        const baked = serializeBufferGeometry(csgRes.geometry);
        csgRes.geometry.dispose();
        return {
          ...solid,
          parentGroupId: null,
          shape: 'csgResult',
          position: [
            Number(csgRes.center.x.toFixed(4)),
            Number(csgRes.center.y.toFixed(4)),
            Number(csgRes.center.z.toFixed(4)),
          ],
          rotation: [0, 0, 0],
          dimensions: [
            Number(Math.max(0.01, sz.x).toFixed(3)),
            Number(Math.max(0.01, sz.y).toFixed(3)),
            Number(Math.max(0.01, sz.z).toFixed(3)),
          ],
          modifiers: {
            ...solid.modifiers,
            bevel: 0,
            chamfer: 0,
            roundness: 0,
            edgeWear: 0,
            bendAngle: 0,
            twistAngle: 0,
            taperStart: 1,
            taperEnd: 1,
          },
          bakedGeometry: baked,
        };
      });
      cutGeo.dispose();
    }
    if (solids.length > 0) {
      parts = solids;
    }
  }

  if (parts.length === 0) {
    parts.push(createDefaultPartSpec('cube'));
  }

  const rawDoc: ObjectMakerDoc = isModify && existing
    ? {
        ...existing.doc,
        parts,
        attachBodyPart: attachBodyPart ?? undefined,
      }
    : {
        version: 1,
        parts,
        groups: [],
        attachBodyPart: attachBodyPart ?? undefined,
      };
  const doc = isModify && existing ? rawDoc : centerAndGroundObjectDoc(rawDoc).doc;

  const rawMechs = Array.isArray(raw.mechanisms) ? raw.mechanisms : [];
  const mechanisms: ObjectMechanism[] = isModify && existing ? [...existing.mechanisms] : [];
  rawMechs.slice(0, 4).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const m = entry as Record<string, unknown>;
    const targetName = str(m.targetPartName, '');
    const matchPart =
      doc.parts.find((pt) => pt.name.toLowerCase() === targetName.toLowerCase()) ??
      doc.parts[0];
    if (!matchPart) return;
    const mechKind = oneOf<MechanismKind>(
      m.kind,
      ['hinge', 'slider', 'spinner', 'pendulum', 'springBounce', 'transporter'],
      'hinge'
    );
    const defaultTriggers =
      mechKind === 'springBounce'
        ? [
            {
              id: uid(),
              event: 'playerTouches' as const,
              radius: 1.5,
              action: 'open' as const,
              condition: 'none' as const,
              sound: 'jump' as const,
            },
          ]
        : mechKind === 'transporter'
        ? [
            {
              id: uid(),
              event: 'playerUses' as const,
              radius: 2.2,
              action: 'toggle' as const,
              condition: 'none' as const,
              sound: 'sparkle' as const,
            },
          ]
        : [];
    const nextMech: ObjectMechanism = {
      id: uid(),
      name: str(m.name, `${matchPart.name} Motion`),
      targetNodePath: matchPart.name,
      targetLabel: matchPart.name,
      kind: mechKind,
      axis: oneOf(m.axis, ['x', 'y', 'z'] as const, mechKind === 'pendulum' ? 'z' : 'y'),
      pivot: [...matchPart.position] as [number, number, number],
      restAngleDeg: 0,
      openAngleDeg: num(m.openAngleDeg, 90, -180, 180),
      restOffset: 0,
      openOffset: num(m.openOffset, mechKind === 'springBounce' ? 0.45 : 0.5, -2, 2),
      duration: num(m.duration, mechKind === 'springBounce' ? 0.25 : 0.7, 0.15, 4),
      easing: 'smooth',
      playbackMode: mechKind === 'spinner' || mechKind === 'pendulum' ? 'loop' : 'toggle',
      spinSpeedDegPerSec:
        mechKind === 'spinner' ? num(m.spinSpeedDegPerSec, 150, -720, 720) : undefined,
      swingAmplitudeDeg:
        mechKind === 'pendulum' ? num(m.swingAmplitudeDeg, 48, 5, 140) : undefined,
      swingFrequencyHz:
        mechKind === 'pendulum' ? num(m.swingFrequencyHz, 0.7, 0.15, 3.0) : undefined,
      bounceVelocity:
        mechKind === 'springBounce' ? num(m.bounceVelocity, 18.5, 6, 36) : undefined,
      transportLabel:
        mechKind === 'transporter' ? str(m.transportLabel, 'Warp!') : undefined,
      isHazard: Boolean(m.isHazard),
      triggers: defaultTriggers,
    };
    const existingMechIdx = mechanisms.findIndex(
      (em) => em.name.toLowerCase() === nextMech.name.toLowerCase()
    );
    if (existingMechIdx >= 0) {
      mechanisms[existingMechIdx] = { ...nextMech, id: mechanisms[existingMechIdx].id };
    } else {
      mechanisms.push(nextMech);
    }
  });

  return { name, category, summary, attachBodyPart, doc, mechanisms };
}

// ---------------------------------------------------------------------------
// 2. PLANT MAKER SANITIZER
// ---------------------------------------------------------------------------
const VALID_PLANT_SHAPES = PLANT_SHAPE_CATALOG.map((p) => p.id);
const VALID_PLANT_PATTERNS: PlantLeafPatternId[] = [
  'solid',
  'veins',
  'ribs',
  'variegated',
  'spotted',
  'striped',
  'gradientTip',
  'bioluminescent',
];

export interface SanitizedPlantResult {
  name: string;
  summary: string;
  doc: ObjectMakerDoc;
}

export function sanitizePlantMakerResult(
  raw: Record<string, unknown>,
  existing?: { doc: ObjectMakerDoc; name?: string; modifyExisting?: boolean }
): SanitizedPlantResult {
  const isModify = Boolean(existing?.modifyExisting);
  const name = str(raw.name, isModify && existing?.name ? existing.name : 'AI Botanical Plant');
  const summary = str(raw.summary, isModify ? `Modified ${name}` : `Generated ${name}`);
  const prevClusterGroup = isModify ? existing?.doc.groups[0] : undefined;
  const prevRecipe = prevClusterGroup?.plantCluster;

  const rawCluster =
    raw.cluster && typeof raw.cluster === 'object'
      ? (raw.cluster as Record<string, unknown>)
      : {};
  const hasClusterUpdates = Object.keys(rawCluster).length > 0;

  let clusterParts: ObjectPartSpec[] = [];
  let clusterGroups = existing?.doc.groups ?? [];

  if (!isModify || !prevRecipe || hasClusterUpdates) {
    const shape = oneOf<PlantShapeId>(
      rawCluster.shape,
      VALID_PLANT_SHAPES,
      prevRecipe?.shape ?? 'leafBanana'
    );
    const meta = getPlantShapeMeta(shape);
    const pattern = oneOf<PlantLeafPatternId>(
      rawCluster.pattern,
      VALID_PLANT_PATTERNS,
      prevRecipe?.basePlant?.pattern ?? meta.defaultPattern
    );
    const dims =
      rawCluster.baseDimensions !== undefined
        ? vec3(rawCluster.baseDimensions, prevRecipe?.baseDimensions ?? [...meta.defaultSize], 0.05, 2.5)
        : prevRecipe?.baseDimensions ?? [...meta.defaultSize];
    const baseColor = hexColor(
      rawCluster.baseColor,
      prevRecipe?.baseColor ?? meta.defaultColor
    );

    const recipe: PlantClusterRecipe = {
      target: oneOf(
        rawCluster.target,
        ['leaf', 'petal', 'fantasy'] as const,
        prevRecipe?.target ?? 'leaf'
      ),
      shape,
      count:
        rawCluster.count !== undefined
          ? Math.round(num(rawCluster.count, prevRecipe?.count ?? 8, 2, 20))
          : prevRecipe?.count ?? 8,
      layout: oneOf<PlantClusterLayout>(
        rawCluster.layout,
        ['fan', 'randomCenter', 'spiral'],
        prevRecipe?.layout ?? 'fan'
      ),
      symmetrical:
        typeof rawCluster.symmetrical === 'boolean'
          ? rawCluster.symmetrical
          : prevRecipe?.symmetrical ?? false,
      randomness: num(rawCluster.randomness, prevRecipe?.randomness ?? 0.28, 0, 1),
      fanAngleDeg: num(rawCluster.fanAngleDeg, prevRecipe?.fanAngleDeg ?? 50, 10, 85),
      arcSpanDeg: num(rawCluster.arcSpanDeg, prevRecipe?.arcSpanDeg ?? 360, 60, 360),
      centerRadius: num(rawCluster.centerRadius, prevRecipe?.centerRadius ?? 0.08, 0, 0.6),
      hubHeight: num(rawCluster.hubHeight, prevRecipe?.hubHeight ?? 0.14, 0, 0.9),
      minScale: num(rawCluster.minScale, prevRecipe?.minScale ?? 0.78, 0.3, 1.5),
      maxScale: num(rawCluster.maxScale, prevRecipe?.maxScale ?? 1.2, 0.4, 2.0),
      tierLayers: Math.round(
        num(rawCluster.tierLayers, prevRecipe?.tierLayers ?? 2, 1, 3)
      ),
      includeFlowerCore:
        typeof rawCluster.includeFlowerCore === 'boolean'
          ? rawCluster.includeFlowerCore
          : prevRecipe?.includeFlowerCore ?? false,
      coreColor: hexColor(rawCluster.coreColor, prevRecipe?.coreColor ?? '#F59E0B'),
      baseDimensions: dims,
      baseColor,
      seed: prevRecipe?.seed ?? Math.floor(Math.random() * 9000 + 100),
      basePlant: {
        pattern,
        accentColor: hexColor(
          rawCluster.accentColor,
          prevRecipe?.basePlant?.accentColor ?? meta.defaultAccentColor
        ),
        tipColor: hexColor(
          rawCluster.tipColor,
          prevRecipe?.basePlant?.tipColor ?? meta.defaultTipColor
        ),
        emissiveColor:
          typeof rawCluster.emissiveColor === 'string'
            ? hexColor(rawCluster.emissiveColor, baseColor)
            : prevRecipe?.basePlant?.emissiveColor,
        emissiveIntensity: num(
          rawCluster.emissiveIntensity,
          prevRecipe?.basePlant?.emissiveIntensity ?? meta.defaultEmissiveIntensity ?? 0,
          0,
          2.5
        ),
        droop: num(rawCluster.droop, prevRecipe?.basePlant?.droop ?? meta.defaultDroop, -1, 1),
        cup: num(rawCluster.cup, prevRecipe?.basePlant?.cup ?? meta.defaultCup, 0, 1),
        ruffle: num(rawCluster.ruffle, prevRecipe?.basePlant?.ruffle ?? meta.defaultRuffle, 0, 1),
        veinDepth: num(rawCluster.veinDepth, prevRecipe?.basePlant?.veinDepth ?? 0.48, 0, 1),
        doubleSided: true,
      },
    };

    const builtCluster = createClusterGroupAndParts(recipe, `${name}_Cluster`);
    clusterParts = builtCluster.parts;
    clusterGroups = [builtCluster.group];
  } else if (prevClusterGroup) {
    clusterParts = existing!.doc.parts.filter((pt) => pt.parentGroupId === prevClusterGroup.id);
    clusterGroups = existing!.doc.groups;
  }

  const prevExtras =
    isModify && existing
      ? existing.doc.parts.filter(
          (pt) => !pt.parentGroupId || pt.parentGroupId !== prevClusterGroup?.id
        )
      : [];
  const extraParts: ObjectPartSpec[] = [...prevExtras];
  const rawExtras = Array.isArray(raw.extraParts) ? raw.extraParts : [];
  rawExtras.slice(0, 8).forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const ep = entry as Record<string, unknown>;
    const eShape = isPlantShape(String(ep.shape ?? ''))
      ? (ep.shape as PlantShapeId)
      : 'stemCurved';
    const eMeta = getPlantShapeMeta(eShape);
    const base = createDefaultPartSpec(eShape);
    const col = hexColor(ep.color, eMeta.defaultColor);
    const em = typeof ep.emissive === 'string' ? hexColor(ep.emissive, '') : '';
    extraParts.push({
      ...base,
      id: uid(),
      name: str(ep.name, `${eMeta.defaultName}_${idx + 1}`),
      position: vec3(ep.position, [0, 0.25, 0], -2, 2),
      dimensions: vec3(ep.dimensions, eMeta.defaultSize, 0.05, 2.2),
      material: {
        ...base.material,
        color: col,
        ...(em
          ? {
              emissive: em,
              emissiveIntensity: num(ep.emissiveIntensity, 0.9, 0, 2.5),
            }
          : {}),
      },
    });
  });

  const starter = isModify && existing ? existing.doc : createStarterPlantDoc();
  const rawDoc: ObjectMakerDoc = {
    ...starter,
    groups: clusterGroups,
    parts: [...clusterParts, ...extraParts],
  };
  const doc = isModify ? rawDoc : centerAndGroundObjectDoc(rawDoc).doc;
  return { name, summary, doc };
}

// ---------------------------------------------------------------------------
// 3. TREE CANOPY SANITIZER
// ---------------------------------------------------------------------------
export interface SanitizedTreeResult {
  name: string;
  summary: string;
  config: StylizedCanopyConfig;
}

export function sanitizeTreeCanopyResult(
  raw: Record<string, unknown>,
  prevCfg?: StylizedCanopyConfig
): SanitizedTreeResult {
  const treeType = oneOf<TreeSpeciesType>(
    raw.treeType,
    ['oak', 'conifer', 'birch', 'fantasy', 'custom'],
    prevCfg?.treeType ?? 'oak'
  );
  const base = createDefaultSpeciesConfig(treeType);
  const fallback = prevCfg ? { ...createDefaultCanopyConfig(), ...base, ...prevCfg } : base;

  const minPuffs = Math.round(num(raw.minPuffs, fallback.minPuffs, 2, 16));
  const maxPuffs = Math.max(
    minPuffs,
    Math.round(num(raw.maxPuffs, fallback.maxPuffs, 2, 18))
  );

  const config: StylizedCanopyConfig = {
    ...fallback,
    enabled: true,
    treeType,
    customTypeName:
      treeType === 'custom'
        ? str(raw.customTypeName, str(raw.name, 'Custom Tree'))
        : fallback.customTypeName,
    treeGeneratorMode: oneOf<TreeGeneratorMode>(
      raw.treeGeneratorMode,
      ['stylized', 'ezTree'],
      fallback.treeGeneratorMode ?? 'stylized'
    ),
    barkStyle: oneOf<TreeBarkStyle>(
      raw.barkStyle,
      ['oak', 'pine', 'birch', 'rough', 'painterly', 'textural', 'cartoony', 'knotty', 'fantasy'],
      fallback.barkStyle ?? 'oak'
    ),
    barkColor: hexColor(raw.barkColor, fallback.barkColor),
    trunkHeight: num(raw.trunkHeight, fallback.trunkHeight, 1.8, 12),
    trunkThickness: num(raw.trunkThickness, fallback.trunkThickness, 0.25, 2.8),
    trunkLean: num(raw.trunkLean, fallback.trunkLean, 0, 0.8),
    majorBranchCount: Math.round(
      num(raw.majorBranchCount, fallback.majorBranchCount ?? 4, 0, 7)
    ),
    majorBranchLength: num(
      raw.majorBranchLength,
      fallback.majorBranchLength ?? 1.4,
      0.3,
      3.0
    ),
    majorBranchThickness: num(
      raw.majorBranchThickness,
      fallback.majorBranchThickness ?? 0.9,
      0.25,
      2.0
    ),
    majorBranchSpread: num(
      raw.majorBranchSpread,
      fallback.majorBranchSpread ?? 0.72,
      0.15,
      1.5
    ),
    majorBranchDroop: num(
      raw.majorBranchDroop,
      fallback.majorBranchDroop ?? 0,
      -1,
      1
    ),
    gnarlAmount: num(raw.gnarlAmount, fallback.gnarlAmount ?? 0.35, 0, 1),
    hollowMode: oneOf<FeatureFrequency>(
      raw.hollowMode,
      ['none', 'some', 'lots', 'all'],
      fallback.hollowMode ?? 'none'
    ),
    rootMode: oneOf<FeatureFrequency>(
      raw.rootMode,
      ['none', 'some', 'lots', 'all'],
      fallback.rootMode ?? 'some'
    ),
    rootCount: Math.round(num(raw.rootCount, fallback.rootCount ?? 5, 2, 9)),
    rootReach: num(raw.rootReach, fallback.rootReach ?? 1.5, 0.5, 3.2),
    rootArchHeight: num(raw.rootArchHeight, fallback.rootArchHeight ?? 0.4, 0, 1.1),
    silhouette: oneOf<CanopyCrownSilhouette>(
      raw.silhouette,
      ['dome', 'umbrella', 'cypress', 'tiered', 'windswept'],
      fallback.silhouette
    ),
    minPuffs,
    maxPuffs,
    canopyHeight: num(raw.canopyHeight, fallback.canopyHeight, 1.2, 8),
    basePuffSize: num(raw.basePuffSize, fallback.basePuffSize, 0.6, 4.5),
    foliageBaseColor: hexColor(
      raw.foliageBaseColor,
      fallback.foliageBaseColor ?? '#4FA83B'
    ),
    canopyLeavesEnabled:
      typeof raw.canopyLeavesEnabled === 'boolean'
        ? raw.canopyLeavesEnabled
        : fallback.canopyLeavesEnabled ?? true,
    canopyLeafShape: oneOf<CanopyLeafShape>(
      raw.canopyLeafShape,
      ['basic', 'oak', 'maple', 'triple'],
      fallback.canopyLeafShape ?? 'oak'
    ),
    canopyLeafSeason: oneOf<LeafSeasonPresetId>(
      raw.canopyLeafSeason,
      ['custom', 'spring', 'summer', 'earlyFall', 'peakAutumn', 'winter', 'blossom', 'mystic'],
      fallback.canopyLeafSeason ?? 'summer'
    ),
    canopyLeafColor: hexColor(
      raw.canopyLeafColor,
      fallback.canopyLeafColor ?? '#5DBB47'
    ),
    canopyLeafCount: Math.round(
      num(raw.canopyLeafCount, fallback.canopyLeafCount ?? 220, 20, 620)
    ),
    coniferTiers: Math.round(num(raw.coniferTiers, fallback.coniferTiers ?? 6, 3, 11)),
    coniferShape: oneOf<ConiferShapeStyle>(
      raw.coniferShape,
      ['classic', 'spire', 'snowDroop', 'flatBough', 'weeping'],
      fallback.coniferShape ?? 'classic'
    ),
    fruitEnabled:
      typeof raw.fruitEnabled === 'boolean'
        ? raw.fruitEnabled
        : Boolean(fallback.fruitEnabled),
    fruitCount: Math.round(num(raw.fruitCount, fallback.fruitCount ?? 8, 0, 32)),
    fruitSize: num(raw.fruitSize, fallback.fruitSize ?? 0.24, 0.08, 0.55),
    fruitColor: hexColor(raw.fruitColor, fallback.fruitColor ?? '#F59E0B'),
    fruitDistribution: oneOf<FruitDistributionMode>(
      raw.fruitDistribution,
      ['outerCrown', 'underCanopy', 'hanging'],
      fallback.fruitDistribution ?? 'hanging'
    ),
    fruitGlow: num(raw.fruitGlow, fallback.fruitGlow ?? 0.2, 0, 1.5),
    windSway: num(raw.windSway, fallback.windSway, 0, 2),
  };

  return {
    name: str(raw.name, `${treeType[0].toUpperCase()}${treeType.slice(1)} Tree`),
    summary: str(raw.summary, `Configured ${treeType} canopy tree`),
    config,
  };
}

// ---------------------------------------------------------------------------
// 4. CHARACTER MAKER SANITIZER
// ---------------------------------------------------------------------------
const VALID_CHAR_PRESETS = CHARACTER_PRESETS.map((p) => p.id);

export interface SanitizedCharacterResult {
  name: string;
  summary: string;
  doc: CharacterMakerDoc;
}

function normalizeMeterWidth(
  rawVal: unknown,
  baseMeter: number,
  minMeter: number,
  maxMeter: number
): number {
  const n = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : Number(rawVal);
  if (!Number.isFinite(n) || n <= 0) {
    return Math.max(minMeter, Math.min(maxMeter, baseMeter));
  }
  // If AI mistakenly output a scale multiplier (> 0.45) instead of half-width meters, convert relative to baseMeter
  const meters = n > 0.45 ? baseMeter * Math.max(0.65, Math.min(1.55, n)) : n;
  return Number(Math.max(minMeter, Math.min(maxMeter, meters)).toFixed(3));
}

function inferDefaultCharacterPreset(
  raw: Record<string, unknown>,
  guide?: CharacterPromptGuide
): CharacterPresetId {
  if (guide?.archetype === 'humanoid') return 'standardHumanoid';
  if (guide?.archetype === 'bird') return 'storyOwl';
  if (guide?.archetype === 'bug') return 'pocketCritter';
  if (guide?.archetype === 'fantasy') return 'hornedMonster';
  if (guide?.archetype === 'animal') return 'storyBear';

  const text = `${String(raw.name ?? '')} ${String(raw.summary ?? '')}`.toLowerCase();
  if (/\b(knight|paladin|warrior|soldier|wizard|mage|archer|king|queen|prince|princess|pirate|human|girl|boy|man|woman|villager|hero|adventurer)\b/.test(text)) {
    return 'standardHumanoid';
  }
  if (/\b(elf|ranger|fairy)\b/.test(text)) return 'forestElf';
  if (/\b(owl|bird|eagle|falcon|hawk|duck|chicken)\b/.test(text)) return 'storyOwl';
  if (/\b(bear|panda)\b/.test(text)) return 'storyBear';
  if (/\b(fox|wolf)\b/.test(text)) return 'storyFox';
  if (/\b(rabbit|bunny|hare)\b/.test(text)) return 'storyRabbit';
  if (/\b(horse|pony|unicorn)\b/.test(text)) return 'storyHorse';
  if (/\b(dragon|lizard|gecko|dino|reptile)\b/.test(text)) return 'storyGecko';
  if (/\b(demon|monster|ogre|gargoyle|goblin|troll)\b/.test(text)) return 'hornedMonster';
  return 'standardHumanoid';
}

export function sanitizeCharacterMakerResult(
  raw: Record<string, unknown>,
  baseDoc?: CharacterMakerDoc,
  characterGuide?: CharacterPromptGuide
): SanitizedCharacterResult {
  const isModify = Boolean(baseDoc);
  const inferredFallback = baseDoc?.presetId ?? inferDefaultCharacterPreset(raw, characterGuide);
  let presetId = oneOf<CharacterPresetId>(
    raw.presetId,
    VALID_CHAR_PRESETS,
    inferredFallback
  );
  if (!baseDoc && characterGuide?.archetype === 'humanoid') {
    if (!['standardHumanoid', 'adventurer', 'forestElf'].includes(presetId)) {
      presetId = 'standardHumanoid';
    }
  } else if (!baseDoc && characterGuide?.archetype === 'bird') {
    if (presetId !== 'storyOwl' && presetId !== 'storyTweety') {
      presetId = 'storyOwl';
    }
  }

  const base = baseDoc ? baseDoc : createCharacterPresetDoc(presetId);
  const isHumanoidPreset =
    presetId === 'standardHumanoid' ||
    presetId === 'adventurer' ||
    presetId === 'forestElf';

  const hasExplicitCoat =
    typeof raw.coatColor === 'string' || typeof raw.torsoColor === 'string';
  const hasExplicitHead =
    typeof raw.headColor === 'string' || typeof raw.skinColor === 'string';
  const hasExplicitLimbs = typeof raw.limbsColor === 'string';

  const coatColor = hexColor(
    raw.coatColor ?? raw.torsoColor,
    base.torso.color || base.head.color || '#64748B'
  );
  const headColor = hasExplicitHead
    ? hexColor(raw.headColor ?? raw.skinColor, base.head.color)
    : !isModify && hasExplicitCoat && !isHumanoidPreset
      ? coatColor
      : undefined;
  const limbsColor = hasExplicitLimbs
    ? hexColor(raw.limbsColor, base.upperLeg.color)
    : !isModify && hasExplicitCoat && !isHumanoidPreset
      ? coatColor
      : undefined;

  const partScales =
    raw.partScales && typeof raw.partScales === 'object'
      ? (raw.partScales as Record<string, unknown>)
      : {};

  const applyScale = <T extends CharacterLimbProfile>(
    part: T,
    key: string,
    overrideColor?: string
  ): T => {
    const rawScale = partScales[key];
    if (rawScale === undefined && !overrideColor) return part;
    if (rawScale === undefined && overrideColor) {
      return { ...part, color: overrideColor };
    }
    const s = vec3(rawScale, [1, 1, 1], 0.72, 1.48);
    const avgXZ = Math.max(0.7, (s[0] + s[2]) * 0.5);
    return {
      ...part,
      startRadius: Number((part.startRadius * avgXZ).toFixed(3)),
      midRadius: Number((part.midRadius * avgXZ).toFixed(3)),
      endRadius: Number((part.endRadius * avgXZ).toFixed(3)),
      length: Number((part.length * s[1]).toFixed(3)),
      squashX: Number(
        Math.max(0.55, Math.min(1.65, (part.squashX ?? 1) * (s[0] / avgXZ))).toFixed(3)
      ),
      squashZ: Number(
        Math.max(0.55, Math.min(1.65, (part.squashZ ?? 1) * (s[2] / avgXZ))).toFixed(3)
      ),
      color: overrideColor ?? part.color,
    };
  };

  const torsoColor = !isModify || hasExplicitCoat ? coatColor : undefined;
  const upperArmColor = limbsColor ?? torsoColor;
  const lowerArmColor = limbsColor ?? (hasExplicitCoat && !isHumanoidPreset ? coatColor : undefined);
  const hipsAndLegColor = limbsColor ?? (!isHumanoidPreset && hasExplicitCoat ? coatColor : undefined);
  const partBellyColor =
    !isModify || typeof raw.bellyColor === 'string'
      ? hexColor(raw.bellyColor, base.bellyColor)
      : undefined;

  const muzzlePresetRaw = oneOf<CharacterMuzzlePresetId>(
    raw.muzzlePreset,
    [
      'none',
      'bunnySplit',
      'squirrelPuff',
      'catWhiskerPad',
      'foxTaper',
      'dogSnout',
      'horseMuzzle',
      'bearBroad',
      'lizardSnout',
      'custom',
    ],
    base.muzzle?.preset ?? 'none'
  );
  const snoutColorResolved = hexColor(
    raw.snoutColor,
    headColor ?? base.snoutColor ?? base.head.color
  );
  const resolvedMuzzle =
    typeof raw.muzzlePreset === 'string' && muzzlePresetRaw !== 'custom'
      ? createMuzzlePreset(muzzlePresetRaw, snoutColorResolved)
      : base.muzzle
        ? { ...base.muzzle, color: snoutColorResolved }
        : createMuzzlePreset('none', snoutColorResolved);

  const normalizedSnoutWidth = (() => {
    const rawW = typeof raw.snoutWidth === 'number' ? raw.snoutWidth : Number(raw.snoutWidth);
    if (!Number.isFinite(rawW)) return base.snoutWidth;
    const scaled = rawW > 0.3 ? base.snoutWidth * Math.min(1.6, rawW) : rawW;
    return Number(Math.max(0.035, Math.min(0.16, scaled)).toFixed(3));
  })();
  const normalizedSnoutLength = (() => {
    if (muzzlePresetRaw === 'none' && typeof raw.snoutLength !== 'number') {
      return isHumanoidPreset ? 0 : base.snoutLength;
    }
    const rawL = typeof raw.snoutLength === 'number' ? raw.snoutLength : Number(raw.snoutLength);
    if (!Number.isFinite(rawL)) return resolvedMuzzle.length || base.snoutLength;
    const scaled = rawL > 0.35 ? 0.14 * Math.min(1.5, rawL) : rawL;
    return Number(Math.max(0, Math.min(0.24, scaled)).toFixed(3));
  })();

  const beakStyle = oneOf<CharacterBeakStyle>(
    raw.beakStyle,
    ['none', 'songbird', 'duck', 'owl', 'eagleHawk', 'storkCrane', 'pelican'],
    base.beakStyle ?? 'none'
  );
  const noseStyle = oneOf<CharacterNoseStyle>(
    raw.noseStyle,
    [
      'none',
      'buttonSphere',
      'oval',
      'flatButton',
      'longHuman',
      'bulbous',
      'triangleAnimal',
      'wideSnoutNose',
    ],
    base.noseStyle ?? (isHumanoidPreset ? 'longHuman' : 'buttonSphere')
  );

  // Addons (eyewear, headgear, bodyGear)
  const rawAddons =
    raw.addons && typeof raw.addons === 'object'
      ? (raw.addons as Record<string, unknown>)
      : {};
  const baseAddons = base.addons ?? createDefaultAddonConfig();
  const addons = {
    ...baseAddons,
    eyewear: oneOf<CharacterEyewearStyle>(
      rawAddons.eyewear,
      ['none', 'roundGlasses', 'goggles', 'cyberVisor', 'monocle'],
      baseAddons.eyewear
    ),
    eyewearColor: hexColor(rawAddons.eyewearColor, baseAddons.eyewearColor),
    eyewearLensColor: hexColor(rawAddons.eyewearLensColor, baseAddons.eyewearLensColor),
    headGear: oneOf<CharacterHeadGearStyle>(
      rawAddons.headGear,
      ['none', 'adventurerCap', 'wizardHat', 'crown', 'halo', 'flowerCrown'],
      baseAddons.headGear
    ),
    headGearColor: hexColor(rawAddons.headGearColor, baseAddons.headGearColor),
    headGearAccentColor: hexColor(
      rawAddons.headGearAccentColor,
      baseAddons.headGearAccentColor
    ),
    bodyGear: oneOf<CharacterBodyGearStyle>(
      rawAddons.bodyGear,
      ['none', 'backpack', 'quiver', 'cape', 'scarf', 'pauldrons'],
      baseAddons.bodyGear
    ),
    bodyGearColor: hexColor(rawAddons.bodyGearColor, baseAddons.bodyGearColor),
    bodyGearAccentColor: hexColor(
      rawAddons.bodyGearAccentColor,
      baseAddons.bodyGearAccentColor
    ),
  };

  // Spikes
  const rawSpikes =
    raw.spikes && typeof raw.spikes === 'object'
      ? (raw.spikes as Record<string, unknown>)
      : {};
  const baseSpikes = base.spikes ?? createDefaultSpikesConfig();
  const spikes = {
    ...baseSpikes,
    enabled:
      typeof rawSpikes.enabled === 'boolean' ? rawSpikes.enabled : baseSpikes.enabled,
    style: oneOf<CharacterSpikesStyle>(
      rawSpikes.style,
      ['porcupineQuills', 'boneSpikes', 'dorsalFins', 'crystalSpines'],
      baseSpikes.style
    ),
    zone: oneOf<CharacterSpikesZone>(
      rawSpikes.zone,
      ['spine', 'headAndBack', 'shouldersAndBack', 'fullBody'],
      baseSpikes.zone
    ),
    color: hexColor(rawSpikes.color, baseSpikes.color),
    tipColor: hexColor(rawSpikes.tipColor, baseSpikes.tipColor),
  };

  // Hair & Facial Hair
  const hairStyle = (() => {
    const aliasMap: Record<string, CharacterHairStyle> = {
      tuft: 'spikyTufts',
      bob: 'bobCut',
      spiky: 'messySpiky',
      curly: 'curlyAfro',
      longFlowing: 'longStraight',
      twinTails: 'twinPigtails',
    };
    const rawHair =
      typeof raw.hairStyle === 'string'
        ? aliasMap[raw.hairStyle] ?? raw.hairStyle
        : raw.hairStyle;
    return oneOf<CharacterHairStyle>(
      rawHair,
      [
        'none',
        'shortCrop',
        'sidePart',
        'pompadour',
        'messySpiky',
        'undercut',
        'buzzFade',
        'surferCurtains',
        'longStraight',
        'longEndCurls',
        'bobCut',
        'bobFlip',
        'wavyShoulder',
        'twinPigtails',
        'highBun',
        'braidedCrown',
        'ponytail',
        'curlyAfro',
        'spikyTufts',
        'mohawk',
        'curlSwirl',
        'mushroomCap',
        'horseMane',
        'lionMane',
        'featherTuft',
        'fluffyBangs',
      ],
      base.hairStyle
    );
  })();
  const hairColor = hexColor(raw.hairColor, base.hairColor);

  const rawFacialHair =
    raw.facialHair && typeof raw.facialHair === 'object'
      ? (raw.facialHair as Record<string, unknown>)
      : null;
  const resolvedBaseFacial = resolveFacialHairConfig({ ...base, hairColor });
  const mustacheStyle = oneOf<CharacterMustacheStyle>(
    rawFacialHair?.mustacheStyle,
    [
      'none',
      'pencil',
      'classicStraight',
      'chevron',
      'handlebar',
      'imperial',
      'dali',
      'walrus',
      'bushyBrush',
      'horseshoe',
      'fuManchu',
      'toothbrush',
    ],
    resolvedBaseFacial.mustache.style
  );
  const beardStyle = oneOf<CharacterBeardStyle>(
    rawFacialHair?.beardStyle,
    [
      'none',
      'soulPatch',
      'goatee',
      'vanDyke',
      'circleBeard',
      'chinStrap',
      'chinCurtain',
      'shortBoxed',
      'fullTrimmed',
      'bushyLumberjack',
      'ducktail',
      'wizardLong',
      'vikingBraided',
      'muttonChops',
    ],
    resolvedBaseFacial.beard.style
  );
  const sideburnsStyle = oneOf<CharacterSideburnsStyle>(
    rawFacialHair?.sideburnsStyle,
    ['none', 'shortNeat', 'pointed', 'flared', 'muttonChops', 'connectedFull'],
    resolvedBaseFacial.sideburns.style
  );
  const facialHairColor = hexColor(rawFacialHair?.color, hairColor);
  const facialHair = {
    ...resolvedBaseFacial,
    color: facialHairColor,
    matchHairColor: !rawFacialHair?.color,
    mustache: createMustachePresetConfig(mustacheStyle),
    beard: createBeardPresetConfig(beardStyle),
    sideburns: createSideburnsPresetConfig(sideburnsStyle),
  };

  const extremityTipColor = hexColor(raw.extremityTipColor, base.extremityTipColor);

  const doc: CharacterMakerDoc = {
    ...base,
    presetId,
    materialFinish: oneOf<CharacterMaterialFinish>(
      raw.materialFinish,
      ['clay', 'toonSatin', 'glossySlime', 'velvetCreature'],
      base.materialFinish
    ),
    blendSmoothness: num(raw.blendSmoothness, base.blendSmoothness, 0.018, 0.095),
    shoulderWidth: normalizeMeterWidth(raw.shoulderWidth, base.shoulderWidth, 0.135, 0.31),
    hipWidth: normalizeMeterWidth(raw.hipWidth, base.hipWidth, 0.09, 0.19),
    legStanceWidth: normalizeMeterWidth(
      raw.legStanceWidth,
      base.legStanceWidth,
      0.1,
      0.22
    ),
    armSpreadDeg: num(raw.armSpreadDeg, base.armSpreadDeg || 32, 18, 50),
    bellyPatchEnabled:
      typeof raw.bellyPatchEnabled === 'boolean'
        ? raw.bellyPatchEnabled
        : base.bellyPatchEnabled,
    bellyColor: hexColor(raw.bellyColor, base.bellyColor),
    extremityTipColor,
    snoutLength: normalizedSnoutLength,
    snoutWidth: normalizedSnoutWidth,
    snoutColor: snoutColorResolved,
    muzzle: resolvedMuzzle,
    head: applyScale(base.head, 'head', headColor),
    neck: applyScale(base.neck, 'neck', headColor),
    torso: applyScale(base.torso, 'torso', torsoColor),
    belly: applyScale(base.belly, 'belly', partBellyColor),
    hips: applyScale(base.hips, 'hips', hipsAndLegColor),
    upperArm: applyScale(base.upperArm, 'upperArm', upperArmColor),
    lowerArm: applyScale(base.lowerArm, 'lowerArm', lowerArmColor),
    upperLeg: applyScale(base.upperLeg, 'upperLeg', hipsAndLegColor),
    lowerLeg: applyScale(base.lowerLeg, 'lowerLeg', hipsAndLegColor),
    beakStyle,
    beakLength: beakStyle !== 'none' ? Math.max(base.beakLength ?? 0.07, 0.065) : base.beakLength,
    beakColor: hexColor(raw.beakColor, base.beakColor ?? '#F59E0B'),
    noseStyle,
    noseColor: headColor ?? base.noseColor,
    handStyle: oneOf<CharacterHandStyle>(
      raw.handStyle,
      ['fingers5', 'fingers4', 'fingers3', 'fingers2', 'paw', 'claw', 'hoof', 'nub'],
      base.handStyle
    ),
    handScale: num(raw.handScale, base.handScale, 0.75, 1.45),
    footStyle: oneOf<CharacterFootStyle>(
      raw.footStyle,
      ['biped', 'paw', 'claw', 'hoof'],
      base.footStyle
    ),
    footScale: num(raw.footScale, base.footScale, 0.8, 1.45),
    earStyle: oneOf<CharacterEarStyle>(
      raw.earStyle,
      [
        'none',
        'rabbitLong',
        'rabbitFloppy',
        'squirrelRound',
        'catFoxTriangle',
        'dogFloppy',
        'horsePerked',
        'human',
        'elfPointed',
        'animalPerk',
        'floppy',
        'bat',
        'fin',
        'antennae',
      ],
      base.earStyle
    ),
    earSize: num(raw.earSize, base.earSize, 0.4, 1.8),
    earColor:
      typeof raw.earColor === 'string'
        ? hexColor(raw.earColor, base.earColor)
        : headColor ?? base.earColor,
    tailStyle: oneOf<CharacterTailStyle>(
      raw.tailStyle,
      [
        'none',
        'bunnyCotton',
        'squirrelPlume',
        'horseTail',
        'catTail',
        'dogTail',
        'foxBrush',
        'lionTail',
        'geckoTail',
        'dragonTail',
        'fishTail',
        'birdTail',
        'smooth',
        'bulbTip',
        'spiky',
        'fluffy',
        'fin',
      ],
      base.tailStyle
    ),
    hornCount: ([0, 1, 2, 4].includes(Number(raw.hornCount))
      ? Number(raw.hornCount)
      : base.hornCount) as 0 | 1 | 2 | 4,
    hornStyle: oneOf<CharacterHornStyle>(
      raw.hornStyle,
      ['straight', 'curvedBack', 'ramSpiral', 'devilSweep', 'antler'],
      base.hornStyle
    ),
    hornColor: hexColor(raw.hornColor, base.hornColor),
    wingStyle: oneOf<CharacterWingStyle>(
      raw.wingStyle,
      [
        'none',
        'birdRound',
        'birdSoaring',
        'birdLong',
        'dragon',
        'bat',
        'feather',
        'fairy',
        'fairyButterfly',
        'angelFeather',
      ],
      base.wingStyle
    ),
    wingSpan: num(raw.wingSpan, base.wingSpan, 0.45, 1.8),
    wingColor: hexColor(raw.wingColor, base.wingColor),
    hairStyle,
    hairColor,
    facialHair,
    addons,
    spikes,
    irisColor: hexColor(raw.irisColor ?? raw.eyeColor, base.irisColor),
    eyebrowExpression: (() => {
      const aliasMap: Record<string, CharacterEyebrowExpression> = {
        angry: 'determined',
        sad: 'neutral',
        happy: 'friendly',
        worried: 'surprised',
      };
      const rawExpr =
        typeof raw.eyebrowExpression === 'string'
          ? aliasMap[raw.eyebrowExpression] ?? raw.eyebrowExpression
          : raw.eyebrowExpression;
      return oneOf<CharacterEyebrowExpression>(
        rawExpr,
        ['neutral', 'determined', 'friendly', 'surprised', 'sly'],
        base.eyebrowExpression
      );
    })(),
    mouthStyle: (() => {
      const aliasMap: Record<string, CharacterMouthStyle> = {
        neutral: 'smirk',
        grin: 'openGrin',
        snarl: 'fangs',
        open: 'openSmile',
      };
      const rawMouth =
        typeof raw.mouthStyle === 'string'
          ? aliasMap[raw.mouthStyle] ?? raw.mouthStyle
          : raw.mouthStyle;
      return oneOf<CharacterMouthStyle>(
        rawMouth,
        [
          'none',
          'smile',
          'smirk',
          'frown',
          'catW',
          'fangs',
          'openSmile',
          'openSurprised',
          'openWorried',
          'openGrin',
          'beak',
        ],
        base.mouthStyle
      );
    })(),
    surfaceCoat: {
      mode: oneOf<CharacterSurfaceCoatMode>(
        raw.surfaceCoatMode,
        ['none', 'furShort', 'furLong', 'furClumped', 'scalesFish', 'scalesDragon', 'scalesHex'],
        base.surfaceCoat?.mode ?? 'none'
      ),
      intensity: base.surfaceCoat?.intensity ?? 0.65,
      density: base.surfaceCoat?.density ?? 0.75,
      scaleSize: base.surfaceCoat?.scaleSize ?? 0.85,
      clumpiness: base.surfaceCoat?.clumpiness ?? 0.4,
      tipColor: extremityTipColor,
    },
  };

  // Enforce ticked Prompt Helper overrides cleanly
  if (characterGuide) {
    if (characterGuide.extremities === 'hands') {
      doc.handStyle = 'fingers5';
      doc.footStyle = 'biped';
    } else if (characterGuide.extremities === 'paw') {
      doc.handStyle = 'paw';
      doc.footStyle = 'paw';
    } else if (characterGuide.extremities === 'claw') {
      doc.handStyle = 'claw';
      doc.footStyle = 'claw';
    } else if (characterGuide.extremities === 'hoof') {
      doc.handStyle = 'hoof';
      doc.footStyle = 'hoof';
    } else if (characterGuide.extremities === 'nub') {
      doc.handStyle = 'nub';
    }

    if (characterGuide.surface === 'smooth') {
      doc.surfaceCoat = { ...doc.surfaceCoat!, mode: 'none' };
      doc.materialFinish = 'clay';
    } else if (characterGuide.surface === 'armor') {
      doc.surfaceCoat = { ...doc.surfaceCoat!, mode: 'none' };
      doc.materialFinish = 'toonSatin';
    } else if (characterGuide.surface === 'furShort') {
      doc.surfaceCoat = { ...doc.surfaceCoat!, mode: 'furShort' };
      doc.materialFinish = 'velvetCreature';
    } else if (characterGuide.surface === 'furLong') {
      doc.surfaceCoat = { ...doc.surfaceCoat!, mode: 'furLong' };
      doc.materialFinish = 'velvetCreature';
    } else if (characterGuide.surface === 'scales') {
      doc.surfaceCoat = { ...doc.surfaceCoat!, mode: 'scalesDragon' };
      doc.materialFinish = 'toonSatin';
    }

    const extras = new Set(characterGuide.extras);
    if (extras.has('helmetOrHat') && doc.addons && doc.addons.headGear === 'none') {
      doc.addons.headGear = 'adventurerCap';
    }
    if (extras.has('pauldronsOrArmor') && doc.addons) {
      doc.addons.bodyGear = 'pauldrons';
    }
    if (extras.has('capeOrCloak') && doc.addons && doc.addons.bodyGear === 'none') {
      doc.addons.bodyGear = 'cape';
    }
    if (
      extras.has('beardOrMustache') &&
      doc.facialHair &&
      doc.facialHair.beard.style === 'none' &&
      doc.facialHair.mustache.style === 'none'
    ) {
      doc.facialHair = {
        ...doc.facialHair,
        beard: createBeardPresetConfig('shortBoxed'),
        mustache: createMustachePresetConfig('classicStraight'),
      };
    }
    if (extras.has('eyewear') && doc.addons && doc.addons.eyewear === 'none') {
      doc.addons.eyewear = 'cyberVisor';
    }
    if (extras.has('wings') && doc.wingStyle === 'none') {
      doc.wingStyle = 'feather';
    }
    if (extras.has('horns') && doc.hornCount === 0) {
      doc.hornCount = 2;
    }
    if (extras.has('tail') && doc.tailStyle === 'none') {
      doc.tailStyle = 'smooth';
    }
    if (extras.has('spikes') && doc.spikes) {
      doc.spikes.enabled = true;
    }
  }

  // HARD ANATOMICAL INVARIANTS (prevent detached forearms/hands & fused knee-level crotch)
  const clampLimbMin = (
    prof: CharacterLimbProfile,
    minStart: number,
    minMid: number,
    minEnd: number,
    minLen: number,
    maxLen: number
  ) => {
    prof.startRadius = Number(Math.max(minStart, Math.min(0.24, prof.startRadius)).toFixed(3));
    prof.midRadius = Number(Math.max(minMid, Math.min(0.24, prof.midRadius)).toFixed(3));
    prof.endRadius = Number(Math.max(minEnd, Math.min(0.2, prof.endRadius)).toFixed(3));
    prof.length = Number(Math.max(minLen, Math.min(maxLen, prof.length)).toFixed(3));
  };

  clampLimbMin(doc.upperArm, 0.04, 0.036, 0.032, 0.16, 0.4);
  clampLimbMin(doc.lowerArm, Math.max(0.035, doc.upperArm.endRadius * 0.8), 0.033, 0.028, 0.15, 0.38);
  clampLimbMin(doc.upperLeg, 0.06, 0.052, 0.044, 0.18, 0.48);
  clampLimbMin(doc.lowerLeg, Math.max(0.044, doc.upperLeg.endRadius * 0.8), 0.038, 0.032, 0.18, 0.46);

  // Keep hips/pelvis & upper thighs within bounds so legs separate cleanly above knees
  doc.hips.startRadius = Number(Math.min(0.21, Math.max(0.085, doc.hips.startRadius)).toFixed(3));
  doc.hips.midRadius = Number(Math.min(0.21, Math.max(0.095, doc.hips.midRadius)).toFixed(3));
  doc.hips.endRadius = Number(Math.min(0.185, Math.max(0.08, doc.hips.endRadius)).toFixed(3));
  doc.hips.length = Number(Math.min(0.2, Math.max(0.1, doc.hips.length)).toFixed(3));
  doc.upperLeg.startRadius = Number(Math.min(0.125, doc.upperLeg.startRadius).toFixed(3));
  doc.upperLeg.midRadius = Number(Math.min(0.105, doc.upperLeg.midRadius).toFixed(3));

  // Keep shoulder sockets anchored inside chest width so arms never float away from torso
  const torsoHalfX = doc.torso.midRadius * (doc.torso.squashX ?? 1.15);
  doc.shoulderWidth = Number(
    Math.max(0.135, Math.min(0.31, torsoHalfX + 0.045, doc.shoulderWidth)).toFixed(3)
  );
  doc.hipWidth = Number(
    Math.max(0.09, Math.min(0.19, doc.hips.midRadius * 1.02, doc.hipWidth)).toFixed(3)
  );

  // Guarantee clear thigh separation gap so smooth-min blend never welds thighs to knees
  const minStanceForThighs = Math.max(
    0.1,
    doc.upperLeg.midRadius + 0.028,
    doc.upperLeg.startRadius * 0.92,
    doc.hips.midRadius * 0.64
  );
  doc.legStanceWidth = Number(
    Math.max(minStanceForThighs, Math.min(0.22, doc.legStanceWidth)).toFixed(3)
  );
  const thighHalfGap = Math.max(0.014, doc.legStanceWidth - doc.upperLeg.midRadius * 0.88);
  const maxSafeBlend = Math.max(0.024, Math.min(0.085, thighHalfGap * 1.15));
  doc.blendSmoothness = Number(
    Math.max(0.018, Math.min(maxSafeBlend, doc.blendSmoothness)).toFixed(3)
  );

  return {
    name: str(raw.name, 'AI Character'),
    summary: str(raw.summary, `Sculpted ${presetId} clay character`),
    doc,
  };
}

// ---------------------------------------------------------------------------
// 5. MONSTER / CREATURE SANITIZER
// ---------------------------------------------------------------------------
const VALID_MONSTER_ATTACKS = MONSTER_ATTACK_CATALOG.map((a) => a.id);
const VALID_MONSTER_ABILITIES = MONSTER_ABILITY_CATALOG.map((a) => a.id);

export interface SanitizedMonsterResult {
  summary: string;
  blueprint: ResolvedMonsterBlueprint;
}

function detectMonsterPreset(
  raw: Record<string, unknown>,
  fallback = 'forest_stag'
): string {
  const allowedPresets = MONSTER_PRESETS.map((p) => p.id);
  const rawPreset =
    typeof raw.presetId === 'string' ? raw.presetId.trim().toLowerCase() : '';
  if (allowedPresets.includes(rawPreset as never)) {
    return rawPreset;
  }

  const textCues = [
    rawPreset,
    typeof raw.name === 'string' ? raw.name.toLowerCase() : '',
    typeof raw.summary === 'string' ? raw.summary.toLowerCase() : '',
    typeof raw.headStyle === 'string' ? raw.headStyle.toLowerCase() : '',
    typeof raw.role === 'string' ? raw.role.toLowerCase() : '',
  ].join(' ');

  if (/\b(moose|elk|stag|deer|caribou|reindeer|buck|antelope|gazelle)\b/.test(textCues)) {
    return 'forest_stag';
  }
  if (/\b(bear|grizzly|panda|polar|ursine|badger|wolverine)\b/.test(textCues)) {
    return 'grizzly_bear';
  }
  if (/\b(wolf|hound|canine|coyote|jackal|dingo|dog|hyena)\b/.test(textCues)) {
    return 'timber_wolf';
  }
  if (/\b(fox|vixen|kitsune|fennec)\b/.test(textCues)) {
    return 'red_fox';
  }
  if (/\b(spider|arachnid|weaver|scorpion|crawler|tick)\b/.test(textCues)) {
    return 'eight_leg_weaver';
  }
  if (/\b(hydra|3-head|three-head|swamp beast)\b/.test(textCues)) {
    return 'hydra_beast';
  }
  if (/\b(manticore|chimera|griffin|gryphon|winged lion)\b/.test(textCues)) {
    return 'winged_manticore';
  }
  if (/\b(shadow hound|six-leg|6-leg)\b/.test(textCues)) {
    return 'six_leg_hound';
  }
  if (/\b(dragon|drake|wyvern|wyrm)\b/.test(textCues)) {
    return 'twin_dragon';
  }

  if (allowedPresets.includes(fallback as never)) {
    return fallback;
  }
  return 'timber_wolf';
}

function resolveMonsterHornStyle(
  rawVal: unknown,
  presetId: string,
  fallback: MonsterHornStyle
): MonsterHornStyle {
  if (typeof rawVal === 'string') {
    const s = rawVal.toLowerCase();
    if (s.includes('none') || s === 'no' || s === 'no horn' || s === 'no horns') return 'none';
    if (
      s.includes('antler') ||
      s.includes('moose') ||
      s.includes('elk') ||
      s.includes('stag') ||
      s.includes('deer') ||
      s.includes('branch')
    ) {
      return 'stagAntlers';
    }
    if (s.includes('ram') || s.includes('curl') || s.includes('spiral') || s.includes('sheep') || s.includes('goat')) {
      return 'ramCurl';
    }
    if (s.includes('twin') || s.includes('horns') || s.includes('double')) return 'twinHorns';
    if (s.includes('crown') || s.includes('spikes')) return 'crownSpikes';
    if (s.includes('rhino')) return 'rhinoHorn';
    if (s.includes('unicorn') || s.includes('spire') || s.includes('single')) return 'unicorn';
    if (s.includes('devil') || s.includes('sweep')) return 'devilSweep';
    if (s.includes('crystal')) return 'crystalCrown';
  }
  if (presetId === 'forest_stag') return 'stagAntlers';
  return fallback;
}

function resolveMonsterHeadStyle(
  rawVal: unknown,
  presetId: string,
  fallback: MonsterHeadStyle
): MonsterHeadStyle {
  if (typeof rawVal === 'string') {
    const s = rawVal.toLowerCase();
    if (
      s.includes('moose') ||
      s.includes('elk') ||
      s.includes('stag') ||
      s.includes('deer') ||
      s.includes('wolf') ||
      s.includes('fox') ||
      s.includes('dog') ||
      s.includes('hound') ||
      s.includes('horse')
    ) {
      return 'wolf';
    }
    if (s.includes('bear') || s.includes('fluffy') || s.includes('furry') || s.includes('round') || s.includes('cat')) {
      return 'fluffy';
    }
    if (s.includes('spider') || s.includes('bug') || s.includes('arachnid')) return 'spider';
    if (s.includes('dino') || s.includes('raptor') || s.includes('t-rex') || s.includes('croc') || s.includes('alligator')) {
      return 'dino';
    }
    if (s.includes('demon') || s.includes('gargoyle') || s.includes('beast')) return 'demon';
    if (s.includes('dragon') || s.includes('drake') || s.includes('lizard') || s.includes('reptile')) return 'dragon';
  }
  if (presetId === 'forest_stag' || presetId === 'timber_wolf' || presetId === 'red_fox') return 'wolf';
  if (presetId === 'grizzly_bear') return 'fluffy';
  if (presetId === 'eight_leg_weaver') return 'spider';
  return fallback;
}

function resolveMonsterPawStyle(
  rawVal: unknown,
  presetId: string,
  fallback: MonsterPawStyle
): MonsterPawStyle {
  if (typeof rawVal === 'string') {
    const s = rawVal.toLowerCase();
    if (
      s.includes('hoof') ||
      s.includes('hooves') ||
      s.includes('moose') ||
      s.includes('elk') ||
      s.includes('stag') ||
      s.includes('deer') ||
      s.includes('horse') ||
      s.includes('goat')
    ) {
      return 'hoof';
    }
    if (s.includes('claw') || s.includes('sharp')) return 'claw';
    if (s.includes('talon') || s.includes('raptor') || s.includes('bird')) return 'talon';
    if (s.includes('arachnid') || s.includes('spider') || s.includes('point')) return 'arachnid';
    if (s.includes('stump')) return 'stump';
    if (s.includes('paw') || s.includes('pad')) return 'paw';
  }
  if (presetId === 'forest_stag') return 'hoof';
  return fallback;
}

function resolveMonsterWingStyle(
  rawVal: unknown,
  presetId: string,
  fallback: MonsterWingStyle
): MonsterWingStyle {
  if (typeof rawVal === 'string') {
    const s = rawVal.toLowerCase();
    if (s.includes('none') || s === 'no' || s === 'ground' || s === 'no wings') return 'none';
    if (s.includes('feather') || s.includes('bird') || s.includes('angel')) return 'feathered';
    if (s.includes('dragon') || s.includes('bat') || s.includes('leather')) return 'dragonBat';
    if (s.includes('fairy') || s.includes('insect') || s.includes('bee') || s.includes('bug')) return 'fairyInsect';
    if (s.includes('wyvern')) return 'wyvern';
    if (s.includes('energy') || s.includes('elemental')) return 'elementalEnergy';
  }
  if (['forest_stag', 'grizzly_bear', 'timber_wolf', 'red_fox'].includes(presetId)) {
    return 'none';
  }
  return fallback;
}

function resolveMonsterTailStyle(
  rawVal: unknown,
  presetId: string,
  fallback: MonsterTailStyle
): MonsterTailStyle {
  if (typeof rawVal === 'string') {
    const s = rawVal.toLowerCase();
    if (s.includes('none') || s === 'no') return 'none';
    if (
      s.includes('short') ||
      s.includes('stub') ||
      s.includes('bob') ||
      s.includes('deer') ||
      s.includes('moose') ||
      s.includes('bear')
    ) {
      return 'shortStub';
    }
    if (s.includes('bushy') || s.includes('fluffy') || s.includes('plume') || s.includes('fox') || s.includes('wolf')) {
      return 'bushy';
    }
    if (s.includes('stinger') || s.includes('scorpion')) return 'stinger';
    if (s.includes('club') || s.includes('mace')) return 'club';
    if (s.includes('whip') || s.includes('long')) return 'whip';
    if (s.includes('spike') || s.includes('dragon')) return 'dragonSpiked';
    if (s.includes('fin') || s.includes('blade')) return 'bladeFin';
    if (s.includes('fork') || s.includes('twin')) return 'twinFork';
  }
  if (presetId === 'forest_stag' || presetId === 'grizzly_bear') return 'shortStub';
  if (presetId === 'timber_wolf' || presetId === 'red_fox') return 'bushy';
  return fallback;
}

function resolveMonsterEarStyle(
  rawVal: unknown,
  presetId: string,
  fallback: MonsterEarStyle
): MonsterEarStyle {
  if (typeof rawVal === 'string') {
    const s = rawVal.toLowerCase();
    if (s.includes('none') || s === 'no') return 'none';
    if (s.includes('round') || s.includes('bear')) return 'bearRound';
    if (s.includes('tall') || s.includes('fox')) return 'foxTall';
    if (
      s.includes('wolf') ||
      s.includes('perk') ||
      s.includes('point') ||
      s.includes('moose') ||
      s.includes('stag') ||
      s.includes('deer')
    ) {
      return 'wolfPerk';
    }
    if (s.includes('flop') || s.includes('hound')) return 'floppy';
    if (s.includes('bat') || s.includes('fin')) return 'batFin';
    if (s.includes('frill') || s.includes('dragon')) return 'frill';
  }
  if (presetId === 'forest_stag') return 'wolfPerk';
  if (presetId === 'grizzly_bear') return 'bearRound';
  if (presetId === 'red_fox') return 'foxTall';
  if (presetId === 'timber_wolf') return 'wolfPerk';
  return fallback;
}

export function sanitizeMonsterResult(
  raw: Record<string, unknown>,
  baseBlueprint?: MonsterBlueprint
): SanitizedMonsterResult {
  const isModify = Boolean(baseBlueprint);
  const detectedPreset = detectMonsterPreset(
    raw,
    baseBlueprint?.presetId ?? 'forest_stag'
  );
  const presetId = detectedPreset;
  const templateBase = createDefaultMonsterBlueprint(presetId);
  const resolvedBase = baseBlueprint ? resolveMonsterBlueprint(baseBlueprint) : undefined;
  // If modifying, merge with resolvedBase; if fresh creation, start clean from templateBase!
  const base = isModify && resolvedBase ? resolvedBase : templateBase;

  const isLandAnimal = ['forest_stag', 'grizzly_bear', 'timber_wolf', 'red_fox'].includes(presetId);

  const legPairs = ([2, 3, 4].includes(Number(raw.legPairs))
    ? Number(raw.legPairs)
    : isLandAnimal
    ? 2
    : base.legPairs) as 2 | 3 | 4;

  const rawHeadCount = Number(raw.headCount);
  const headCount = ([1, 2, 3].includes(rawHeadCount)
    ? rawHeadCount
    : isLandAnimal || !isModify
    ? 1
    : base.headCount) as 1 | 2 | 3;

  const pawStyle = resolveMonsterPawStyle(
    raw.pawStyle,
    presetId,
    base.frontLegs?.pawStyle ?? (isLandAnimal && presetId === 'forest_stag' ? 'hoof' : 'paw')
  );

  const wingStyle = resolveMonsterWingStyle(
    raw.wingStyle,
    presetId,
    !isModify && isLandAnimal ? 'none' : base.wingStyle
  );

  const canFly =
    typeof raw.canFly === 'boolean'
      ? raw.canFly
      : wingStyle === 'none'
      ? false
      : !isModify && isLandAnimal
      ? false
      : Boolean(base.canFly);

  const spineSpikes =
    typeof raw.spineSpikes === 'boolean'
      ? raw.spineSpikes
      : !isModify && isLandAnimal
      ? false
      : Boolean(base.spineSpikes);

  const hornStyle = resolveMonsterHornStyle(raw.hornStyle, presetId, base.hornStyle);
  const headStyle = resolveMonsterHeadStyle(raw.headStyle, presetId, base.headStyle);
  const tailStyle = resolveMonsterTailStyle(raw.tailStyle, presetId, base.tailStyle);

  const defaultCoatMode: CharacterSurfaceCoatMode =
    presetId === 'forest_stag' || presetId === 'timber_wolf' || presetId === 'red_fox'
      ? 'furShort'
      : presetId === 'grizzly_bear'
      ? 'furLong'
      : 'none';

  const coatMode = oneOf<CharacterSurfaceCoatMode>(
    raw.surfaceCoatMode,
    ['none', 'furShort', 'furLong', 'furClumped', 'scalesFish', 'scalesDragon', 'scalesHex'],
    !isModify && isLandAnimal ? defaultCoatMode : (base.surfaceCoat?.mode ?? defaultCoatMode)
  );

  const defaultBodyColor =
    presetId === 'forest_stag'
      ? '#6D442B'
      : presetId === 'grizzly_bear'
      ? '#5C3826'
      : presetId === 'timber_wolf'
      ? '#6B7280'
      : presetId === 'red_fox'
      ? '#D95F28'
      : base.bodyColor;

  const defaultBellyColor =
    presetId === 'forest_stag'
      ? '#C89B6D'
      : presetId === 'grizzly_bear'
      ? '#9A7456'
      : presetId === 'timber_wolf'
      ? '#E5E7EB'
      : presetId === 'red_fox'
      ? '#FFF3E0'
      : base.bellyColor;

  const defaultAccentColor =
    presetId === 'forest_stag'
      ? '#E2C799'
      : presetId === 'grizzly_bear'
      ? '#3B2314'
      : presetId === 'timber_wolf'
      ? '#374151'
      : presetId === 'red_fox'
      ? '#2B211B'
      : base.accentColor;

  const blueprintRaw: MonsterBlueprint = {
    ...base,
    id: isModify && baseBlueprint ? baseBlueprint.id : uid(),
    name: str(
      raw.name,
      isLandAnimal && presetId === 'forest_stag' ? 'Forest Moose' : base.name || 'AI Beast'
    ),
    presetId,
    role: oneOf(raw.role, ['baddie', 'buddy', 'npc'] as const, base.role),
    isBoss: typeof raw.isBoss === 'boolean' ? raw.isBoss : Boolean(base.isBoss),
    health: Math.round(num(raw.health, base.health ?? 5, 1, 35)),
    speed: num(raw.speed, base.speed ?? 4, 1, 10),
    dialogue: typeof raw.dialogue === 'string' ? raw.dialogue.trim() : base.dialogue,
    legPairs,
    headCount,
    headStyle,
    hornStyle,
    wingStyle,
    canFly,
    tailStyle,
    spineSpikes,
    bodyLength: num(raw.bodyLength, base.bodyLength, 0.7, 1.7),
    bodyWidth: num(raw.bodyWidth, base.bodyWidth, 0.7, 1.6),
    legHeight: num(raw.legHeight, base.legHeight, 0.6, 1.6),
    scale: num(raw.scale, base.scale, 0.6, 2.4),
    bodyColor: hexColor(raw.bodyColor, defaultBodyColor),
    bellyColor: hexColor(raw.bellyColor, defaultBellyColor),
    accentColor: hexColor(raw.accentColor, defaultAccentColor),
    eyeColor: hexColor(raw.eyeColor, base.eyeColor),
    wingColor: hexColor(raw.wingColor, base.wingColor),
    // Reset sculpt stamps when creating fresh so previous dragon/beast sculpt deformations don't pollute new animal
    sculptData: isModify ? base.sculptData : undefined,
    neck: {
      color: base.neck?.color ?? base.bodyColor ?? '#888888',
      startRadius: base.neck?.startRadius ?? 0.3,
      midRadius: base.neck?.midRadius ?? 0.25,
      endRadius: base.neck?.endRadius ?? 0.2,
      curvature: base.neck?.curvature ?? 0.1,
      length: base.neck?.length ?? 0.3,
      squashX: base.neck?.squashX ?? 1,
      squashZ: base.neck?.squashZ ?? 1,
      offsetX: base.neck?.offsetX ?? 0,
      offsetY: base.neck?.offsetY ?? 0,
      offsetZ: base.neck?.offsetZ ?? 0,
      blendScale: base.neck?.blendScale ?? 0.8,
      segments: base.neck?.segments ?? 2,
      pitchDeg: base.neck?.pitchDeg ?? 20,
      spreadDeg: headCount === 1 ? 0 : (base.neck?.spreadDeg ?? 22),
    },
    primaryAttack: oneOf<MonsterAttackType>(
      raw.primaryAttack,
      VALID_MONSTER_ATTACKS,
      base.primaryAttack ?? (presetId === 'forest_stag' ? 'chargeGore' : 'clawSlash')
    ),
    secondaryAttack: oneOf<MonsterAttackType>(
      raw.secondaryAttack,
      VALID_MONSTER_ATTACKS,
      base.secondaryAttack ?? (presetId === 'forest_stag' ? 'groundPound' : 'groundPound')
    ),
    specialAbility: oneOf<MonsterAbilityId>(
      raw.specialAbility,
      VALID_MONSTER_ABILITIES,
      base.specialAbility ?? (presetId === 'forest_stag' ? 'thickFat' : 'none')
    ),
  };

  const resolved = resolveMonsterBlueprint(blueprintRaw);
  resolved.ears.style = resolveMonsterEarStyle(raw.earStyle, presetId, resolved.ears.style);
  resolved.frontLegs.pawStyle = pawStyle;
  resolved.rearLegs.pawStyle = pawStyle;
  resolved.midLegs.pawStyle = pawStyle;
  resolved.surfaceCoat.mode = coatMode;
  if (raw.expressionMood !== undefined) {
    const resolvedMood = oneOf<CreatureExpressionMood>(
      raw.expressionMood,
      ['closed', 'open', 'angry', 'happy', 'shy'],
      resolved.mouth.mood
    );
    resolved.mouth.mood = resolvedMood;
    resolved.eyebrows.mood = resolvedMood;
  }

  if (raw.windupClueStyle || raw.windupClue || raw.telegraphDuration) {
    const clueAlias: Record<string, BaddieWindupClueStyle> = {
      crouchShake: 'crouchPounce',
      wingFlare: 'wingFlare',
      roarWave: 'headSway3',
      groundRing: 'footMarch',
      glowingEyes: 'headSway3',
      sparkCharge: 'crouchPounce',
    };
    const rawClue = raw.windupClueStyle ?? raw.windupClue;
    const mappedClue =
      typeof rawClue === 'string' ? clueAlias[rawClue] ?? rawClue : rawClue;
    resolved.baddieAI = {
      ...(resolved.baddieAI ?? {
        detectionMode: 'both',
        aggroRange: 16,
        sightAngleDeg: 140,
        territoryRadius: 18,
        patrolPattern: 'wander',
        flightPattern: 'hover',
        flightAltitude: 3.2,
        hoverAttackHeight: 2.2,
        varietyFactor: 0.45,
        primaryAction: resolved.primaryAttack,
        secondaryAction: resolved.secondaryAttack,
      }),
      windupClueStyle: oneOf<BaddieWindupClueStyle>(
        mappedClue,
        ['auto', 'headSway3', 'footMarch', 'wingFlare', 'crouchPounce'],
        resolved.baddieAI?.windupClueStyle ?? 'auto'
      ),
      canFly: resolved.canFly,
    };
  }

  return {
    summary: str(raw.summary, `Generated ${resolved.name}`),
    blueprint: resolved,
  };
}

// ---------------------------------------------------------------------------
// 6. MOTION PRESET SANITIZER (WITH GLB BONE REMAPPING)
// ---------------------------------------------------------------------------
const VALID_CLIP_SLOTS: CustomClipSlot[] = [
  'idle',
  'walk',
  'run',
  'jump',
  'swim',
  'attack',
  'interact',
  'sit',
  'swing',
  'throw',
  'sleep',
  'crouch',
  'sneak',
  'stab',
  'dying',
  'celebrate',
  'windup_headSway3',
  'windup_footMarch',
  'windup_wingFlare',
  'windup_crouchPounce',
  'groundPound',
  'clawSlash',
  'tailSmash',
  'chargeGore',
  'sonicRoar',
  'block',
];

function matchClosestBoneName(
  requested: string,
  validBones: string[],
  autoMap: Partial<Record<RigBoneRole, string>>
): string | null {
  if (validBones.length === 0) return requested;
  if (validBones.includes(requested)) return requested;
  const lower = requested.toLowerCase().replace(/[^a-z0-9]/g, '');
  const exactInsensitive = validBones.find(
    (b) => b.toLowerCase().replace(/[^a-z0-9]/g, '') === lower
  );
  if (exactInsensitive) return exactInsensitive;

  // Check semantic autoBoneMap roles
  const roleAlias: [RegExp, RigBoneRole][] = [
    [/head|skull|cranium/, 'head'],
    [/neck/, 'neck'],
    [/chest|uppertorso|rib/, 'chest'],
    [/spine|torso|back|waist/, 'spine'],
    [/hip|pelvis|root/, 'hips'],
    [/(left|l_).*(clavicle|collar|shoulder)/, 'leftShoulder'],
    [/(left|l_).*(upperarm|arm)/, 'leftUpperArm'],
    [/(left|l_).*(forearm|lowerarm|elbow)/, 'leftLowerArm'],
    [/(left|l_).*(hand|wrist|palm)/, 'leftHand'],
    [/(right|r_).*(clavicle|collar|shoulder)/, 'rightShoulder'],
    [/(right|r_).*(upperarm|arm)/, 'rightUpperArm'],
    [/(right|r_).*(forearm|lowerarm|elbow)/, 'rightLowerArm'],
    [/(right|r_).*(hand|wrist|palm)/, 'rightHand'],
    [/(left|l_).*(thigh|upperleg|upleg|hip)/, 'leftUpperLeg'],
    [/(left|l_).*(shin|calf|lowerleg|knee)/, 'leftLowerLeg'],
    [/(left|l_).*(foot|ankle|paw)/, 'leftFoot'],
    [/(right|r_).*(thigh|upperleg|upleg|hip)/, 'rightUpperLeg'],
    [/(right|r_).*(shin|calf|lowerleg|knee)/, 'rightLowerLeg'],
    [/(right|r_).*(foot|ankle|paw)/, 'rightFoot'],
  ];
  for (const [pattern, role] of roleAlias) {
    if (pattern.test(lower) && autoMap[role]) {
      return autoMap[role]!;
    }
  }

  const partial = validBones.find((b) =>
    b.toLowerCase().replace(/[^a-z0-9]/g, '').includes(lower)
  );
  return partial ?? null;
}

export interface SanitizedMotionResult {
  summary: string;
  preset: CustomMotionPreset;
}

export function sanitizeMotionResult(
  raw: Record<string, unknown>,
  validBoneNames: string[],
  autoBoneMap: Partial<Record<RigBoneRole, string>> = {},
  basePreset?: CustomMotionPreset
): SanitizedMotionResult {
  const isModify = Boolean(basePreset);
  const slotAlias = raw.slot === 'windup' ? 'windup_crouchPounce' : raw.slot;
  const slot = oneOf<CustomClipSlot>(
    slotAlias,
    VALID_CLIP_SLOTS,
    basePreset?.slot ?? 'attack'
  );
  const duration = num(raw.duration, basePreset?.duration ?? 1.0, 0.25, 4.5);
  const easingAlias =
    raw.easing === 'snappy'
      ? 'easeOut'
      : raw.easing === 'bounce'
        ? 'elastic'
        : raw.easing;
  const easing = oneOf<MotionEasing>(
    easingAlias,
    ['linear', 'smooth', 'easeIn', 'easeOut', 'elastic'],
    basePreset?.easing ?? 'smooth'
  );
  const loop =
    typeof raw.loop === 'boolean'
      ? raw.loop
      : isModify && basePreset
        ? basePreset.loop
        : slot !== 'attack' && slot !== 'dying';
  const autoCloseLoop =
    typeof raw.autoCloseLoop === 'boolean'
      ? raw.autoCloseLoop
      : isModify && basePreset
        ? basePreset.autoCloseLoop
        : loop;

  const rawKeys = Array.isArray(raw.keyframes) ? raw.keyframes : [];
  let keyframes: CustomPoseKeyframe[] = [];

  rawKeys.slice(0, 10).forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const k = entry as Record<string, unknown>;
    const bonesRaw =
      k.bones && typeof k.bones === 'object' ? (k.bones as Record<string, unknown>) : {};
    const bones: Record<string, BonePoseAngles> = {};
    for (const [bName, anglesRaw] of Object.entries(bonesRaw)) {
      const targetBone = matchClosestBoneName(bName, validBoneNames, autoBoneMap);
      if (!targetBone || !anglesRaw) continue;
      if (Array.isArray(anglesRaw)) {
        bones[targetBone] = [
          num(anglesRaw[0], 0, -165, 165),
          num(anglesRaw[1], 0, -165, 165),
          num(anglesRaw[2], 0, -165, 165),
        ];
      } else if (typeof anglesRaw === 'object') {
        const a = anglesRaw as Record<string, unknown>;
        bones[targetBone] = [
          num(a.rx, 0, -165, 165),
          num(a.ry, 0, -165, 165),
          num(a.rz, 0, -165, 165),
        ];
      }
    }

    const fallbackTime = rawKeys.length > 1 ? idx / (rawKeys.length - 1) : 0;
    keyframes.push({
      id: uid(),
      time: num(k.time, fallbackTime, 0, 1),
      hipsOffsetY: num(k.hipsOffsetY, 0, -0.7, 0.9),
      bones,
    });
  });

  if (keyframes.length === 0) {
    if (isModify && basePreset && basePreset.keyframes.length > 0) {
      keyframes = basePreset.keyframes.map((kf) => ({
        ...kf,
        bones: { ...kf.bones },
      }));
    } else {
      keyframes.push(
        { id: uid(), time: 0, hipsOffsetY: 0, bones: {} },
        { id: uid(), time: 0.5, hipsOffsetY: 0.08, bones: {} },
        { id: uid(), time: 1, hipsOffsetY: 0, bones: {} }
      );
    }
  }
  keyframes.sort((a, b) => a.time - b.time);
  keyframes[0].time = 0;

  const preset: CustomMotionPreset = {
    id: isModify && basePreset ? basePreset.id : uid(),
    name: str(raw.name, basePreset?.name ?? `AI ${slot}`),
    slot,
    duration,
    loop,
    autoCloseLoop,
    easing,
    keyframes,
    updatedAt: new Date().toISOString(),
  };

  return {
    summary: str(
      raw.summary,
      `${isModify ? 'Modified' : 'Generated'} ${keyframes.length}-keyframe "${preset.name}" motion`
    ),
    preset,
  };
}

// ---------------------------------------------------------------------------
// 7. WORLD TERRAFORM APPLIER
// ---------------------------------------------------------------------------
function stampMountainPeakOntoTerrain(
  terrain: TerrainData,
  opts: {
    x: number;
    z: number;
    rx: number;
    rz: number;
    height: number;
    falloff: 'smooth' | 'dome' | 'peak' | 'plateau';
    allowSnow?: boolean;
  }
): TerrainData {
  const size = terrain.size;
  const width = size + 1;
  const worldRadius = getTerrainRadius(terrain);
  const step = (2 * worldRadius) / size;
  const heights = [...terrain.heights];
  const layers = [...terrain.layers];

  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const vx = -worldRadius + col * step;
      const vz = -worldRadius + row * step;
      const d = Math.hypot((vx - opts.x) / opts.rx, (vz - opts.z) / opts.rz);
      if (d >= 1) continue;
      let w = 0;
      if (opts.falloff === 'dome') {
        w = Math.sqrt(Math.max(0, 1 - d * d));
      } else if (opts.falloff === 'peak') {
        const inv = 1 - d;
        w = inv * inv;
      } else if (opts.falloff === 'plateau') {
        if (d <= 0.45) w = 1;
        else {
          const t = (d - 0.45) / 0.55;
          w = 1 - t * t * (3 - 2 * t);
        }
      } else {
        const inv = 1 - d;
        w = inv * inv * inv * (inv * (inv * 6 - 15) + 10);
      }
      const idx = row * width + col;
      const ridgeNoise =
        1 + 0.08 * Math.sin(vx * 0.14 + vz * 0.11) * Math.cos(vz * 0.17 - vx * 0.09);
      const added = opts.height * w * ridgeNoise;
      heights[idx] = Math.max(heights[idx], 1.2 + added);
      if (opts.allowSnow && heights[idx] > 11.5) layers[idx] = 3;
      else if (heights[idx] > 5.8) layers[idx] = 2;
    }
  }

  return {
    ...terrain,
    heights,
    layers,
    revision: terrain.revision + 1,
  };
}

function buildSpiralPathPoints(
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  turns: number
): [number, number][] {
  const pts: [number, number][] = [];
  const total = Math.max(18, Math.round(turns * 14));
  for (let i = 0; i <= total; i++) {
    const t = i / total;
    const angle = t * turns * Math.PI * 2;
    const rFrac = 0.88 * (1 - t * 0.85);
    pts.push([
      Number((cx + Math.cos(angle) * rx * rFrac).toFixed(2)),
      Number((cz + Math.sin(angle) * rz * rFrac).toFixed(2)),
    ]);
  }
  return pts;
}

function syncTerrainOntoProjectWorldMap(
  baseWm: ReturnType<typeof createEmptyWorldMap>,
  levelId: string,
  levelName: string,
  terrain: TerrainData,
  resetAllLand: boolean
) {
  const wm = resetAllLand ? createEmptyWorldMap() : { ...baseWm };
  const size = wm.gridSize;
  const width = size + 1;
  const wmRadius = getWorldMapRadius(wm);
  const step = (2 * wmRadius) / size;

  let region = wm.regions.find((r) => r.levelId === levelId);
  let regions = [...wm.regions];
  if (!region) {
    const usedCodes = new Set(regions.map((r) => r.code));
    let code = 1;
    while (usedCodes.has(code)) code++;
    region = {
      id: `region-${levelId}`,
      code,
      name: levelName || `Land ${code}`,
      colorHex: LAND_REGION_PALETTE[(code - 1) % LAND_REGION_PALETTE.length],
      levelId,
      origin: [0, 0],
    };
    regions = [...regions, region];
  }

  const landMask = resetAllLand ? new Array<number>(width * width).fill(0) : [...wm.landMask];
  const regionGrid = resetAllLand ? new Array<number>(width * width).fill(0) : [...wm.regionGrid];
  const ox = region.origin?.[0] ?? 0;
  const oz = region.origin?.[1] ?? 0;
  const localRadius = getTerrainRadius(terrain);
  const seaCutoff = IslandTerrain.waterLevel - 0.15;

  for (let row = 0; row <= size; row++) {
    const wz = -wmRadius + row * step;
    const lz = wz - oz;
    if (Math.abs(lz) > localRadius + 0.01) continue;
    const rowOff = row * width;
    for (let col = 0; col <= size; col++) {
      const wx = -wmRadius + col * step;
      const lx = wx - ox;
      if (Math.abs(lx) > localRadius + 0.01) continue;
      const idx = rowOff + col;
      const h = sampleTerrainHeight(terrain, lx, lz);
      if (h > seaCutoff) {
        landMask[idx] = 1;
        regionGrid[idx] = region.code;
      } else if (resetAllLand && regionGrid[idx] === region.code) {
        landMask[idx] = 0;
        regionGrid[idx] = 0;
      }
    }
  }

  return {
    ...wm,
    landMask,
    regionGrid,
    regions,
    revision: wm.revision + 1,
  };
}

export function applyPlatformerAiToStore(
  store: MakerStore,
  raw: Record<string, unknown>,
  options?: AiApplyOptions
): string {
  const lvl = store.currentLevel;
  const proj = store.currentProject;
  if (!lvl || !proj) throw new Error('No active platformer level found.');

  const modifyExisting = Boolean(options?.modifyExisting);
  const guide = options?.platformerGuide;

  const layoutHint =
    guide && guide.layoutStyle !== 'auto' ? guide.layoutStyle : raw.layoutStyle;
  const layoutStyle = oneOf<SideScrollerLayoutStyle>(
    layoutHint,
    ['flat2D', 'verticalClimber', 'layeredJungle', 'underwater', 'skyTemple', 'cavern'],
    modifyExisting && lvl.sideScrollerConfig ? lvl.sideScrollerConfig.layoutStyle : 'layeredJungle'
  );

  const inferredThemeDefault: SideScrollerThemeId =
    layoutStyle === 'layeredJungle'
      ? 'jungleCanopy'
      : layoutStyle === 'underwater'
      ? 'underwaterCoral'
      : layoutStyle === 'verticalClimber'
      ? 'volcanicForge'
      : layoutStyle === 'skyTemple'
      ? 'skyTemple'
      : layoutStyle === 'cavern'
      ? 'crystalCavern'
      : 'sunnyCliffs';
  const themeHint = guide && guide.theme !== 'auto' ? guide.theme : raw.theme;
  const theme = oneOf<SideScrollerThemeId>(
    themeHint,
    ['sunnyCliffs', 'jungleCanopy', 'underwaterCoral', 'volcanicForge', 'crystalCavern', 'skyTemple'],
    modifyExisting && lvl.sideScrollerConfig ? lvl.sideScrollerConfig.theme : inferredThemeDefault
  );

  const presetBase = createSideScrollerPresetConfig(layoutStyle, theme);
  const existingSide = modifyExisting ? lvl.sideScrollerConfig : undefined;

  const rawLayers =
    raw.layers && typeof raw.layers === 'object' ? (raw.layers as Record<string, unknown>) : null;
  const themeLayers = getSideScrollerThemeLayers(theme);
  const layers: SideScrollerConfig['layers'] = {
    foregroundStyle: oneOf<SideScrollerConfig['layers']['foregroundStyle']>(
      rawLayers?.foregroundStyle,
      ['shrubsAndRocks', 'jungleFraming', 'coralSilhouette', 'cavernStalactites', 'none'],
      existingSide?.layers.foregroundStyle ?? themeLayers.foregroundStyle
    ),
    foregroundColor: hexColor(
      rawLayers?.foregroundColor,
      existingSide?.layers.foregroundColor ?? themeLayers.foregroundColor
    ),
    heroLaneColor: hexColor(
      rawLayers?.heroLaneColor,
      existingSide?.layers.heroLaneColor ?? themeLayers.heroLaneColor
    ),
    heroTrimColor: hexColor(
      rawLayers?.heroTrimColor,
      existingSide?.layers.heroTrimColor ?? themeLayers.heroTrimColor
    ),
    midgroundStyle: oneOf<SideScrollerBackdropStyle>(
      rawLayers?.midgroundStyle ?? rawLayers?.backdropStyle,
      [
        'cliffsAndPines',
        'jungleTreesAndVines',
        'coralReefAndKelp',
        'volcanicSpires',
        'crystalCaverns',
        'floatingTemples',
      ],
      existingSide?.layers.midgroundStyle ?? themeLayers.midgroundStyle
    ),
    midgroundColor: hexColor(
      rawLayers?.midgroundColor,
      existingSide?.layers.midgroundColor ?? themeLayers.midgroundColor
    ),
    farStyle: oneOf<SideScrollerConfig['layers']['farStyle']>(
      rawLayers?.farStyle,
      [
        'alpineMountains',
        'jungleMistCanopy',
        'deepOceanRays',
        'volcanoPeaks',
        'cavernVault',
        'cloudPillars',
      ],
      existingSide?.layers.farStyle ?? themeLayers.farStyle
    ),
    farColor: hexColor(
      rawLayers?.farColor ?? rawLayers?.farHorizonColor,
      existingSide?.layers.farColor ?? themeLayers.farColor
    ),
    liquidType: oneOf<'water' | 'lava' | 'mist' | 'none'>(
      rawLayers?.liquidType,
      ['water', 'lava', 'mist', 'none'],
      existingSide?.layers.liquidType ?? themeLayers.liquidType
    ),
    liquidColor: hexColor(
      rawLayers?.liquidColor,
      existingSide?.layers.liquidColor ?? themeLayers.liquidColor
    ),
    liquidLevelY: num(
      rawLayers?.liquidLevelY,
      existingSide?.layers.liquidLevelY ?? themeLayers.liquidLevelY,
      -14,
      10
    ),
  };

  const rawSegs = Array.isArray(raw.segments) ? raw.segments : [];
  const parsedSegs: SidePlatformSegment[] = [];
  rawSegs.slice(0, 18).forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const s = entry as Record<string, unknown>;
    const minX = num(s.minX, -20 + idx * 8, -54, 48);
    const maxX = Math.max(minX + 2.5, num(s.maxX, minX + 10, -48, 54));
    const style = oneOf<SidePlatformSegmentStyle>(
      s.style,
      ['cliff', 'bridge', 'stone', 'jungleFloor', 'branch', 'girder', 'coral', 'crystal', 'cloud'],
      layoutStyle === 'layeredJungle' ? 'branch' : layoutStyle === 'verticalClimber' ? 'girder' : 'cliff'
    );
    const oneWay =
      s.oneWay !== undefined
        ? Boolean(s.oneWay)
        : style === 'branch' || style === 'girder' || style === 'cloud';
    parsedSegs.push({
      id: uid(),
      minX,
      maxX,
      y: num(s.y, 0, -6, 28),
      thickness: num(s.thickness, oneWay ? 0.9 : 4.5, 0.3, 8),
      style,
      oneWay,
      color: typeof s.color === 'string' ? hexColor(s.color, layers.heroLaneColor) : undefined,
    });
  });

  const segments =
    parsedSegs.length > 0
      ? parsedSegs
      : modifyExisting && existingSide?.segments.length
      ? existingSide.segments
      : presetBase.segments;

  const rawVines = Array.isArray(raw.vines) ? raw.vines : [];
  const parsedVines: SideScrollerVineOrLadder[] = [];
  rawVines.slice(0, 10).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const v = entry as Record<string, unknown>;
    const bY = num(v.bottomY, 0, -6, 22);
    const tY = Math.max(bY + 2.5, num(v.topY, bY + 6, -2, 30));
    parsedVines.push({
      id: uid(),
      kind: oneOf(
        v.kind,
        ['vine', 'ladder', 'bubbleStream'] as const,
        layoutStyle === 'verticalClimber'
          ? 'ladder'
          : layoutStyle === 'underwater'
          ? 'bubbleStream'
          : 'vine'
      ),
      x: num(v.x, 0, -46, 46),
      bottomY: bY,
      topY: tY,
    });
  });
  const vines =
    parsedVines.length > 0
      ? modifyExisting && existingSide
        ? [...existingSide.vines, ...parsedVines]
        : parsedVines
      : modifyExisting && existingSide
      ? existingSide.vines
      : presetBase.vines;

  const rawRooms = Array.isArray(raw.secretRooms) ? raw.secretRooms : [];
  const parsedRooms: SideScrollerSecretRoom[] = [];
  rawRooms.slice(0, 3).forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const r = entry as Record<string, unknown>;
    parsedRooms.push({
      id: uid(),
      name: str(r.name, `Secret Chamber ${idx + 1}`),
      entranceX: num(r.entranceX, 14, -44, 44),
      entranceY: num(r.entranceY, 0, -4, 24),
      roomCenterX: num(r.roomCenterX, idx * 18, -36, 36),
      roomCenterY: num(r.roomCenterY, -16, -24, 30),
      width: num(r.width ?? r.roomWidth, 14, 8, 22),
      height: num(r.height, 6.5, 4, 12),
      floorColor: layers.heroLaneColor,
      wallColor: layers.midgroundColor,
      accentColor: layers.heroTrimColor,
    });
  });
  const secretRooms =
    parsedRooms.length > 0
      ? modifyExisting && existingSide
        ? [...existingSide.secretRooms, ...parsedRooms]
        : parsedRooms
      : modifyExisting && existingSide
      ? existingSide.secretRooms
      : presetBase.secretRooms;

  const nextSideConfig: SideScrollerConfig = {
    layoutStyle,
    theme,
    gravityScale: num(
      raw.gravityScale,
      existingSide?.gravityScale ?? presetBase.gravityScale ?? 1,
      0.32,
      1.6
    ),
    swimPhysics:
      raw.swimPhysics !== undefined
        ? Boolean(raw.swimPhysics)
        : existingSide?.swimPhysics ?? presetBase.swimPhysics ?? layoutStyle === 'underwater',
    layers,
    segments,
    vines,
    secretRooms,
  };

  const tempLvl: GameLevel = {
    ...lvl,
    environmentType: 'sideScroller',
    sideScrollerConfig: nextSideConfig,
  };
  const boardPosAt = (wx: number, wz = 0) => levelWorldToBoard(tempLvl, wx, wz);
  const elevAt = (wx: number, wz: number, targetY: number) => {
    const base = sampleLevelHeight(tempLvl, wx, wz);
    return Number((targetY - base).toFixed(2));
  };

  const nextEntities: LevelEntity[] = modifyExisting ? [...lvl.entities] : [];

  // Moving/spinning platforms, bounce pads, saw wheels
  const rawPlats = Array.isArray(raw.platforms) ? raw.platforms : [];
  rawPlats.slice(0, 8).forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const p = entry as Record<string, unknown>;
    const wx = num(p.x, -8 + idx * 6, -46, 46);
    const wy = num(p.y, 2, -6, 26);
    const ex = num(p.endX, wx, -46, 46);
    const ey = num(p.endY, wy, -6, 26);
    const bp = boardPosAt(wx, 0);
    const endBp = boardPosAt(ex, 0);
    const preset = oneOf<PlatformPreset>(
      p.preset,
      ['stoneLift', 'swingingBridge', 'spinningDisc', 'jungleVine', 'bouncePad', 'crumbleStone', 'sawWheel'],
      'stoneLift'
    );
    const motion = oneOf<PlatformMotionType>(
      p.motion,
      ['slide', 'vertical', 'spin', 'pendulum'],
      preset === 'spinningDisc' || preset === 'sawWheel'
        ? 'spin'
        : Math.abs(ey - wy) > 0.6
        ? 'vertical'
        : 'slide'
    );
    nextEntities.push(
      createEntity('platform', str(p.name, `Platform ${idx + 1}`), bp.x, bp.y, {
        platformPreset: preset,
        platformMotion: motion,
        platformEnd: endBp,
        platformSpeed: num(p.speed, 2.6, 0.5, 8),
        platformRunning: true,
        elevationY: elevAt(wx, 0, wy),
      })
    );
  });

  // Mechanical contraptions (giant springs, blade spinners, swinging traps, warp cannons)
  const rawContrap = Array.isArray(raw.contraptions) ? raw.contraptions : [];
  rawContrap.slice(0, 8).forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const c = entry as Record<string, unknown>;
    const template = oneOf<BuiltinMechanismTemplate>(
      c.template,
      ['bounceSpring', 'spinHazard', 'pendulumVine', 'warpCannon'],
      'bounceSpring'
    );
    const wx = num(c.x, 4 + idx * 6, -46, 46);
    const wy = num(c.y, 0, -22, 28);
    const bp = boardPosAt(wx, 0);
    const mechs = getDefaultMechanismsForTemplate(template).map((m) => {
      if (m.kind === 'springBounce' && c.bounceVelocity !== undefined) {
        return { ...m, bounceVelocity: num(c.bounceVelocity, 19, 10, 32) };
      }
      if (m.kind === 'transporter') {
        const tx = num(c.targetX, wx + 12, -46, 46);
        const ty = num(c.targetY, wy + 5, -22, 28);
        return {
          ...m,
          transportTarget: boardPosAt(tx, 0),
          transportTargetY: ty,
          transportLabel: str(c.name, 'Barrel Blast!'),
        };
      }
      return m;
    });
    const kind = template === 'spinHazard' || template === 'pendulumVine' ? 'trap' : 'prop';
    nextEntities.push(
      createEntity(kind, str(c.name, template), bp.x, bp.y, {
        mechTemplate: template,
        mechanisms: mechs,
        scale: num(c.scale, 1.0, 0.65, 2.2),
        elevationY: elevAt(wx, 0, wy),
      })
    );
  });

  // Patrolling baddies placed cleanly on floor OR upper tree branches/girders
  const rawBaddies = Array.isArray(raw.baddies) ? raw.baddies : [];
  rawBaddies.slice(0, 10).forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const b = entry as Record<string, unknown>;
    const wx = num(b.x, -4 + idx * 7, -46, 46);
    const wy = num(b.y, 0, -6, 26);
    const bp = boardPosAt(wx, 0);
    nextEntities.push(
      createEntity('baddie', str(b.name, `Patrol Critter ${idx + 1}`), bp.x, bp.y, {
        brain: 'Patroller',
        isBoss: Boolean(b.isBoss),
        health: Math.round(num(b.health, 3, 1, 16)),
        speed: num(b.speed, 3.0, 1.0, 7.5),
        styleTint: hexColor(b.tint, '#E11D48'),
        elevationY: elevAt(wx, 0, wy),
      })
    );
  });

  // Traps
  const rawTraps = Array.isArray(raw.traps) ? raw.traps : [];
  rawTraps.slice(0, 8).forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const tr = entry as Record<string, unknown>;
    const wx = num(tr.x, idx * 8, -46, 46);
    const wy = num(tr.y, 0, -22, 26);
    const bp = boardPosAt(wx, 0);
    nextEntities.push(
      createEntity('trap', str(tr.name, `Spike Trap ${idx + 1}`), bp.x, bp.y, {
        elevationY: elevAt(wx, 0, wy),
      })
    );
  });

  // Treasures (bonus chests including any placed inside Secret Rooms!)
  const rawTreasures = Array.isArray(raw.treasures) ? raw.treasures : [];
  rawTreasures.slice(0, 6).forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const t = entry as Record<string, unknown>;
    const wx = num(t.x, idx * 10, -46, 46);
    const wy = num(t.y, 0, -24, 30);
    const bp = boardPosAt(wx, 0);
    nextEntities.push(
      createEntity('treasure', str(t.name, `Bonus Chest ${idx + 1}`), bp.x, bp.y, {
        elevationY: elevAt(wx, 0, wy),
      })
    );
  });

  const startObj =
    raw.startPoint && typeof raw.startPoint === 'object'
      ? (raw.startPoint as Record<string, unknown>)
      : null;
  const portalObj =
    raw.portalPoint && typeof raw.portalPoint === 'object'
      ? (raw.portalPoint as Record<string, unknown>)
      : null;

  const nextStart = startObj
    ? boardPosAt(num(startObj.x, -26, -46, 46), 0)
    : modifyExisting
    ? lvl.startPoint
    : boardPosAt(-24, 0);
  const nextPortal = portalObj
    ? boardPosAt(num(portalObj.x, 30, -46, 46), 0)
    : modifyExisting
    ? lvl.portalPoint
    : boardPosAt(28, 0);

  const biome = oneOf<BiomeId>(
    raw.biome,
    ['meadow', 'island', 'forest', 'snow', 'desert', 'cave', 'swamp', 'night'],
    theme === 'jungleCanopy'
      ? 'forest'
      : theme === 'underwaterCoral'
      ? 'island'
      : theme === 'crystalCavern'
      ? 'cave'
      : theme === 'volcanicForge'
      ? 'night'
      : 'meadow'
  );
  const sky = oneOf<SkyPresetId>(
    raw.sky,
    ['sunny', 'golden', 'night', 'mist', 'storm', 'cave'],
    theme === 'crystalCavern'
      ? 'cave'
      : theme === 'volcanicForge'
      ? 'night'
      : theme === 'underwaterCoral'
      ? 'mist'
      : 'sunny'
  );
  const weather = oneOf<WeatherKind>(
    raw.weather,
    ['none', 'fireflies', 'leaves', 'rain', 'snow'],
    theme === 'jungleCanopy' ? 'leaves' : theme === 'crystalCavern' ? 'fireflies' : 'none'
  );

  store.updateLevel(
    modifyExisting ? 'AI modify platformer level' : 'AI direct platformer stage',
    (current) => ({
      ...current,
      environmentType: 'sideScroller',
      cameraMode: 'sideScroll',
      biome,
      sky,
      weather,
      sideScrollerConfig: nextSideConfig,
      startPoint: nextStart,
      portalPoint: nextPortal,
      entities: nextEntities,
    })
  );
  store.setSelectedEntityID(null);
  store.setWorldEditorScope(lvl.id);

  return str(
    raw.summary,
    `${modifyExisting ? 'Updated' : 'Built'} ${layoutStyle} platformer (${theme}) with ${segments.length} platforms, ${vines.length} climbs, and ${secretRooms.length} secret rooms.`
  );
}

export function applyWorldTerraformToStore(
  store: MakerStore,
  raw: Record<string, unknown>,
  options?: AiApplyOptions
): string {
  const lvl = store.currentLevel;
  const proj = store.currentProject;
  if (!lvl || !proj) throw new Error('No active level found to terraform.');

  if (getEnvironmentType(lvl) === 'sideScroller' || typeof raw.layoutStyle === 'string') {
    return applyPlatformerAiToStore(store, raw, options);
  }

  const modifyExisting = Boolean(options?.modifyExisting);
  const oceanOnly = !modifyExisting && Boolean(raw.oceanOnly);

  const biome = oneOf<BiomeId>(
    raw.biome,
    ['meadow', 'island', 'forest', 'snow', 'desert', 'cave', 'swamp', 'night'],
    modifyExisting ? lvl.biome : oceanOnly ? 'island' : 'meadow'
  );
  const sky = oneOf<SkyPresetId>(
    raw.sky,
    ['sunny', 'golden', 'night', 'mist', 'storm', 'cave'],
    modifyExisting ? lvl.sky : 'sunny'
  );
  const weather = oneOf<WeatherKind>(
    raw.weather,
    ['none', 'fireflies', 'leaves', 'rain', 'snow'],
    modifyExisting ? lvl.weather : 'none'
  );

  // Full ocean scratch reset
  if (oceanOnly) {
    const blankWm = createEmptyWorldMap();
    const freshTerrain = createScratchOceanTerrain();
    store.updateProject(
      'AI reset world ocean',
      (prev) => ({
        ...prev,
        worldMap: blankWm,
        levels: prev.levels.map((l) =>
          l.id === lvl.id
            ? {
                ...l,
                biome: 'island',
                sky: 'sunny',
                weather: 'none',
                fog: 0.14,
                vistaPreset: 'none',
                vistaItems: [],
                sceneryTextures: undefined,
                timeOfDay: undefined,
                grass: undefined,
                terrain: freshTerrain,
                entities: [],
              }
            : l
        ),
      }),
      true
    );
    store.setSelectedLevelID(lvl.id);
    store.setSelectedEntityID(null);
    store.setWorldEditorScope('worldMap');
    return str(raw.summary, 'Cleared all land and reset to a blank open ocean world.');
  }

  const rawMtnCfg =
    raw.mountainConfig && typeof raw.mountainConfig === 'object'
      ? (raw.mountainConfig as Record<string, unknown>)
      : null;

  const allowSnow =
    biome === 'snow' ||
    weather === 'snow' ||
    (modifyExisting &&
      (lvl.biome === 'snow' ||
        (lvl.terrain?.mountainConfig?.snowStartHeight ?? 28) <= 18));

  // Fresh builds start from a clean green grassy island — never inherit snow or old terraforming!
  let nextTerrain = modifyExisting
    ? ensureUpgradedTerrain(lvl.terrain ?? createInitialTerrain())
    : ensureUpgradedTerrain(createInitialTerrain());

  if (!modifyExisting && !allowSnow) {
    // Strip any stray snow layer or frost weathering from fresh base terrain
    nextTerrain = {
      ...nextTerrain,
      layers: nextTerrain.layers.map((layerVal) => (layerVal === 3 ? 0 : layerVal)),
      weathering: undefined,
      caves: [],
      roads: [],
      waterBodies: [],
      scatter: [],
      freeformWorld: false,
      revision: nextTerrain.revision + 1,
    };
  }

  const baseMtnCfg = nextTerrain.mountainConfig ?? createDefaultMountainConfig();
  const requestedSnowStart = rawMtnCfg
    ? num(rawMtnCfg.snowStartHeight, allowSnow ? 10.6 : 28, 5, 32)
    : allowSnow
      ? baseMtnCfg.snowStartHeight
      : 28;
  const resolvedSnowStart = allowSnow ? requestedSnowStart : Math.max(28, requestedSnowStart);

  nextTerrain = {
    ...nextTerrain,
    mountainConfig: {
      rockStartHeight: rawMtnCfg
        ? num(rawMtnCfg.rockStartHeight, baseMtnCfg.rockStartHeight, 2, 14)
        : baseMtnCfg.rockStartHeight,
      snowStartHeight: resolvedSnowStart,
      bandTransition: baseMtnCfg.bandTransition,
      roughness: rawMtnCfg
        ? num(rawMtnCfg.roughness, baseMtnCfg.roughness, 0.1, 1)
        : baseMtnCfg.roughness,
      noiseType: rawMtnCfg
        ? oneOf(
            rawMtnCfg.noiseType,
            ['fbm', 'ridged', 'billow', 'terraced'] as const,
            baseMtnCfg.noiseType
          )
        : baseMtnCfg.noiseType,
      noiseScale: baseMtnCfg.noiseScale,
      randomness: baseMtnCfg.randomness,
      autoSlopeWeathering: baseMtnCfg.autoSlopeWeathering,
    },
  };

  const spiralRoads: RoadSpline[] = [];
  const rawMountains = Array.isArray(raw.mountains) ? raw.mountains : [];
  rawMountains.slice(0, 5).forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const m = entry as Record<string, unknown>;
    const mx = num(m.x, 0, -110, 110);
    const mz = num(m.z, 0, -110, 110);
    const rx = num(m.radiusX, 34, 10, 75);
    const rz = num(m.radiusZ, 34, 10, 75);
    const mh = num(m.height, 12, 3, 24);
    const falloff = oneOf(
      m.falloff,
      ['smooth', 'dome', 'peak', 'plateau'] as const,
      'smooth'
    );
    nextTerrain = stampMountainPeakOntoTerrain(nextTerrain, {
      x: mx,
      z: mz,
      rx,
      rz,
      height: mh,
      falloff,
      allowSnow,
    });

    const sp =
      m.spiralPath && typeof m.spiralPath === 'object'
        ? (m.spiralPath as Record<string, unknown>)
        : null;
    if (sp?.enabled) {
      const turns = num(sp.turns, 1.8, 0.8, 3.2);
      const pts = buildSpiralPathPoints(mx, mz, rx, rz, turns);
      spiralRoads.push({
        id: uid(),
        name: str(sp.name, `Mountain Spiral ${idx + 1}`),
        points: pts,
        width: num(sp.width, 3.0, 1.4, 6.0),
        recessDepth: 0.25,
        bankSlopeAngle: 0.55,
        edgeTransition: 0.5,
        borderScatter: 'wildflowers',
        borderDensity: 0.55,
        borderRandomness: 0.5,
      });
    }
  });

  // Water bodies
  const rawWaters = Array.isArray(raw.waterBodies) ? raw.waterBodies : [];
  const newWaters: WaterBodyConfig[] = modifyExisting ? [...(nextTerrain.waterBodies ?? [])] : [];
  rawWaters.slice(0, 3).forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const w = entry as Record<string, unknown>;
    const centerArr = Array.isArray(w.center) ? w.center : [0, 0];
    const wb: WaterBodyConfig = {
      id: uid(),
      name: str(w.name, `AI Water ${idx + 1}`),
      kind: oneOf(w.kind, ['lake', 'river', 'pond', 'stream'] as const, 'lake'),
      center: [
        num(centerArr[0], -20, -110, 110),
        num(centerArr[1], 20, -110, 110),
      ],
      radiusX: num(w.radiusX, 16, 5, 45),
      radiusZ: num(w.radiusZ, 14, 5, 45),
      width: num(w.width, 8, 3, 18),
      waterLevelOffset: 0,
      waterColor: hexColor(w.waterColor, '#2E86AB'),
      deepMurkColor: '#0C2D48',
      opacity: 0.85,
      depth: 2.2,
      foamAmount: 0.6,
      waveSpeed: 0.75,
      windRipple: 0.5,
      flowSpeed: 0.5,
      flowAngleDeg: 0,
      bankSlope: 0.6,
      bankSmoothness: 0.75,
      shoreNoise: 0.35,
    };
    newWaters.push(wb);
    nextTerrain = carveWaterBodyIntoTerrain(nextTerrain, wb);
  });
  if (rawWaters.length > 0 || !modifyExisting) {
    nextTerrain = { ...nextTerrain, waterBodies: newWaters };
  }

  // Caves
  const rawCaves = Array.isArray(raw.caves) ? raw.caves : [];
  if (rawCaves.length > 0) {
    const caves: CaveGrotto[] = modifyExisting ? [...(nextTerrain.caves ?? [])] : [];
    rawCaves.slice(0, 3).forEach((entry, idx) => {
      if (!entry || typeof entry !== 'object') return;
      const c = entry as Record<string, unknown>;
      caves.push(
        normalizeCaveGrotto(
          {
            id: uid(),
            name: str(c.name, `Crystal Cavern ${idx + 1}`),
            x: num(c.x, -45, -105, 105),
            z: num(c.z, 45, -105, 105),
            rotation: (num(c.rotationDeg, -20, -180, 180) * Math.PI) / 180,
            scale: num(c.scale, 1.15, 0.75, 1.8),
            crystalDensity: num(c.crystalDensity, 1.1, 0, 1.5),
            crystalColor: hexColor(c.crystalColor, '#38BDF8'),
            hasSpring: Boolean(c.hasSpring),
          },
          caves.length
        )
      );
    });
    nextTerrain = applyMountainCaveToTerrain({ ...nextTerrain, caves });
  } else if (!modifyExisting) {
    nextTerrain = { ...nextTerrain, caves: [] };
  }

  // Custom roads + spiral roads
  const rawRoads = Array.isArray(raw.roads) ? raw.roads : [];
  const allNewRoads: RoadSpline[] = [...spiralRoads];
  rawRoads.slice(0, 4).forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const r = entry as Record<string, unknown>;
    const ptsRaw = Array.isArray(r.points) ? r.points : [];
    const points: [number, number][] = ptsRaw
      .filter((pt) => Array.isArray(pt) && pt.length >= 2)
      .map((pt) => [
        num((pt as unknown[])[0], 0, -125, 125),
        num((pt as unknown[])[1], 0, -125, 125),
      ]);
    if (points.length < 2) return;
    allNewRoads.push({
      id: uid(),
      name: str(r.name, `Trail ${idx + 1}`),
      points,
      width: num(r.width, 2.6, 1.2, 6.5),
      recessDepth: 0.28,
      bankSlopeAngle: 0.5,
      edgeTransition: 0.45,
      borderScatter: oneOf(
        r.borderScatter,
        ['none', 'wildflowers', 'grass', 'boulders', 'mixed'] as const,
        'wildflowers'
      ),
      borderDensity: 0.6,
      borderRandomness: 0.5,
    });
  });

  if (allNewRoads.length > 0) {
    const mergedRoads = modifyExisting
      ? [...(nextTerrain.roads ?? []), ...allNewRoads]
      : allNewRoads;
    for (const road of allNewRoads) {
      nextTerrain = applyRoadSplineToTerrain(nextTerrain, road, true);
    }
    nextTerrain = { ...nextTerrain, roads: mergedRoads };
  } else if (!modifyExisting) {
    nextTerrain = { ...nextTerrain, roads: [] };
  }

  // Optional Hero Spawn & Landmarks
  const heroSpawnArr = Array.isArray(raw.heroSpawn) ? raw.heroSpawn : null;
  const heroBoard = heroSpawnArr
    ? levelWorldToBoard(
        { ...lvl, terrain: nextTerrain },
        num(heroSpawnArr[0], 0, -120, 120),
        num(heroSpawnArr[1], 0, -120, 120)
      )
    : undefined;

  const extraEntities: LevelEntity[] = [];
  const rawLandmarks = Array.isArray(raw.landmarks) ? raw.landmarks : [];
  rawLandmarks.slice(0, 12).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const l = entry as Record<string, unknown>;
    const lKind = str(l.kind, 'oakTree');
    const pt = levelWorldToBoard(
      { ...lvl, terrain: nextTerrain },
      num(l.x, 0, -115, 115),
      num(l.z, 0, -115, 115)
    );
    const lName = str(l.name, lKind);
    const lScale = num(l.scale, 1.1, 0.5, 2.8);
    if (lKind === 'savePlinth' || lKind === 'campfire') {
      const ent = createEntity('prop', lName, pt.x, pt.y, {
        propPreset: lKind === 'savePlinth' ? 'savePlinth' : 'campfire',
        scale: lScale,
        notes: str(l.dialogueOrNote, ''),
      });
      extraEntities.push(ent);
    } else if (lKind === 'treasure' || lKind === 'portal') {
      const ent = createEntity(
        lKind === 'treasure' ? 'treasure' : 'portal',
        lName,
        pt.x,
        pt.y,
        {
          scale: lScale,
          notes: str(l.dialogueOrNote, ''),
        }
      );
      extraEntities.push(ent);
    } else {
      const ent = createEntity('scenery', lName, pt.x, pt.y, {
        scale: lScale,
        canopyTree: {
          ...createDefaultSpeciesConfig(lKind === 'pineTree' ? 'conifer' : 'oak'),
          enabled: true,
          targetTrees: 'placedOnly',
        },
      });
      extraEntities.push(ent);
    }
  });

  const nextVistaPreset = modifyExisting
    ? lvl.vistaPreset
    : biome === 'snow'
      ? 'alpineValley'
      : biome === 'island'
        ? 'coastalArchipelago'
        : 'mistyHills';

  store.updateProject(
    modifyExisting ? 'AI modify world terraform' : 'AI world terraform',
    (prev) => {
      const baseWm = prev.worldMap ?? ensureWorldMapForProject(prev);
      const nextWm = syncTerrainOntoProjectWorldMap(
        baseWm,
        lvl.id,
        lvl.name,
        nextTerrain,
        !modifyExisting && prev.levels.length <= 1
      );
      return {
        ...prev,
        worldMap: nextWm,
        levels: prev.levels.map((current) =>
          current.id !== lvl.id
            ? current
            : {
                ...current,
                biome,
                sky,
                weather,
                fog: modifyExisting
                  ? current.fog
                  : sky === 'mist'
                    ? 0.42
                    : sky === 'cave' || biome === 'cave'
                      ? 0.3
                      : 0.16,
                vistaPreset: nextVistaPreset,
                vistaItems: modifyExisting ? current.vistaItems : [],
                sceneryTextures: modifyExisting ? current.sceneryTextures : undefined,
                timeOfDay: modifyExisting ? current.timeOfDay : undefined,
                terrain: {
                  ...nextTerrain,
                  revision: nextTerrain.revision + 1,
                },
                startPoint: heroBoard ?? current.startPoint,
                entities: modifyExisting
                  ? [...current.entities, ...extraEntities]
                  : extraEntities,
              }
        ),
      };
    },
    true
  );

  // Immediately exit World Map view into the sculpted Land viewport so changes render live without pressing Play
  store.setSelectedLevelID(lvl.id);
  store.setWorldEditorScope(lvl.id);

  return str(
    raw.summary,
    `${modifyExisting ? 'Updated' : 'Terraformed'} ${biome} terrain (${rawMountains.length} peaks, ${allNewRoads.length} paths, ${rawCaves.length} caves).`
  );
}

// ---------------------------------------------------------------------------
// 8. LOGIC MULTI-LEVEL SYSTEM PLANNER
// ---------------------------------------------------------------------------
const VALID_EVENTS = BehaviorVocabulary.events.map((e) => e.key);
const VALID_CONDITIONS = BehaviorVocabulary.conditions.map((c) => c.key);
const VALID_ACTIONS = BehaviorVocabulary.actions.map((a) => a.key);

function sanitizeBehaviorCards(rawCards: unknown): BehaviorCard[] {
  if (!Array.isArray(rawCards)) return [];
  const cards: BehaviorCard[] = [];
  rawCards.slice(0, 6).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const c = entry as Record<string, unknown>;
    const whenObj =
      c.when && typeof c.when === 'object' ? (c.when as Record<string, unknown>) : {};
    const whenKey = oneOf(whenObj.key, VALID_EVENTS, 'playerNear');

    const condsRaw = Array.isArray(c.conditions) ? c.conditions : [];
    const conditions = condsRaw.slice(0, 3).map((ce) => {
      const co = ce && typeof ce === 'object' ? (ce as Record<string, unknown>) : {};
      return {
        id: uid(),
        key: oneOf(co.key, VALID_CONDITIONS, 'playerClose'),
        detail: str(co.detail, ''),
      };
    });

    const actsRaw = Array.isArray(c.actions) ? c.actions : [];
    const actions = actsRaw.slice(0, 4).map((ae) => {
      const ao = ae && typeof ae === 'object' ? (ae as Record<string, unknown>) : {};
      return {
        id: uid(),
        key: oneOf(ao.key, VALID_ACTIONS, 'say'),
        detail: str(ao.detail, ''),
      };
    });

    if (actions.length === 0) {
      actions.push({ id: uid(), key: 'say', detail: 'Hello adventurer!' });
    }

    cards.push({
      id: uid(),
      when: { id: uid(), key: whenKey, detail: str(whenObj.detail, '') },
      conditions,
      actions,
      isOnce: Boolean(c.isOnce),
      isEnabled: true,
    });
  });
  return cards;
}

export function applyLogicMultiLevelToStore(
  store: MakerStore,
  raw: Record<string, unknown>,
  options?: AiApplyOptions
): string {
  const proj = store.currentProject;
  if (!proj) throw new Error('No active project open.');

  const modifyExisting = Boolean(options?.modifyExisting);
  const rawLevels = Array.isArray(raw.levels) ? raw.levels : [];
  if (rawLevels.length === 0 && !modifyExisting) {
    throw new Error('AI plan did not include any levels.');
  }

  const buildLevelFromPlan = (
    lv: Record<string, unknown>,
    idx: number,
    existingLevel?: GameLevel
  ): GameLevel => {
    const fallbackName = existingLevel?.name ?? `Level ${idx + 1}`;
    const name = str(lv.name, fallbackName);
    const biome = oneOf<BiomeId>(
      lv.biome,
      ['meadow', 'island', 'forest', 'snow', 'desert', 'cave', 'swamp', 'night'],
      existingLevel?.biome ?? 'forest'
    );
    const sky = oneOf<SkyPresetId>(
      lv.sky,
      ['sunny', 'golden', 'night', 'mist', 'storm', 'cave'],
      existingLevel?.sky ?? (biome === 'cave' ? 'cave' : 'sunny')
    );
    const weather = oneOf<WeatherKind>(
      lv.weather,
      ['none', 'fireflies', 'leaves', 'rain', 'snow'],
      existingLevel?.weather ?? 'none'
    );
    const completeCondition = oneOf<CompleteCondition>(
      lv.completeCondition,
      ['reachPortal', 'collectAll', 'defeatAll', 'talkToNPC', 'gatherBuddies'],
      existingLevel?.completeCondition ?? 'reachPortal'
    );

    const allowLevelSnow = biome === 'snow' || weather === 'snow';
    const blank = existingLevel ?? createBlankLevel(name, biome, 'openWorld');
    let terrain = ensureUpgradedTerrain(
      existingLevel?.terrain ?? createInitialTerrain()
    );
    if (!existingLevel) {
      terrain = {
        ...terrain,
        layers: allowLevelSnow
          ? terrain.layers
          : terrain.layers.map((v) => (v === 3 ? 0 : v)),
        mountainConfig: {
          ...(terrain.mountainConfig ?? createDefaultMountainConfig()),
          snowStartHeight: allowLevelSnow ? 10.6 : 28,
        },
        weathering: undefined,
      };
    }

    const tStyle = typeof lv.terrainStyle === 'string' ? lv.terrainStyle : '';
    if (tStyle === 'mountainSpiral') {
      terrain = stampMountainPeakOntoTerrain(terrain, {
        x: 0,
        z: 0,
        rx: 48,
        rz: 48,
        height: 16,
        falloff: 'smooth',
        allowSnow: allowLevelSnow,
      });
      const pts = buildSpiralPathPoints(0, 0, 48, 48, 2.0);
      const spiral: RoadSpline = {
        id: uid(),
        name: 'Mountain Spiral Path',
        points: pts,
        width: 3.2,
        recessDepth: 0.25,
        bankSlopeAngle: 0.5,
        edgeTransition: 0.45,
        borderScatter: 'wildflowers',
        borderDensity: 0.6,
        borderRandomness: 0.5,
      };
      terrain = applyRoadSplineToTerrain(terrain, spiral, true);
      terrain = { ...terrain, roads: [...(terrain.roads ?? []), spiral] };
    } else if (tStyle === 'crystalCave') {
      const cave = normalizeCaveGrotto(
        {
          id: uid(),
          name: 'Crystal Cavern',
          x: -24,
          z: 18,
          rotation: -0.3,
          scale: 1.35,
          crystalDensity: 1.3,
          crystalColor: '#38BDF8',
          hasSpring: true,
        },
        0
      );
      terrain = applyMountainCaveToTerrain({
        ...terrain,
        caves: [...(terrain.caves ?? []), cave],
      });
    }

    const startArr = Array.isArray(lv.startPoint) ? lv.startPoint : null;
    const portalArr = Array.isArray(lv.portalPoint) ? lv.portalPoint : null;
    const startPoint = startArr
      ? {
          x: num(startArr[0], 0.22, 0.08, 0.92),
          y: num(startArr[1], 0.78, 0.08, 0.92),
        }
      : existingLevel?.startPoint ?? { x: 0.22, y: 0.78 };
    const portalPoint = portalArr
      ? {
          x: num(portalArr[0], 0.78, 0.08, 0.92),
          y: num(portalArr[1], 0.24, 0.08, 0.92),
        }
      : existingLevel?.portalPoint ?? { x: 0.78, y: 0.24 };

    const entities: LevelEntity[] = existingLevel ? [...existingLevel.entities] : [];
    if (!entities.some((e) => e.kind === 'hero')) {
      entities.push(
        createEntity(
          'hero',
          str(raw.heroName, proj.heroName),
          startPoint.x,
          startPoint.y
        )
      );
    }

    const rawPlinths = Array.isArray(lv.savePlinths) ? lv.savePlinths : [];
    rawPlinths.slice(0, 4).forEach((spRaw, sIdx) => {
      if (!spRaw || typeof spRaw !== 'object') return;
      const sp = spRaw as Record<string, unknown>;
      const plinth = createEntity(
        'prop',
        str(sp.name, `Save Plinth ${sIdx + 1}`),
        num(sp.x, 0.3 + sIdx * 0.12, 0.1, 0.9),
        num(sp.y, 0.65 - sIdx * 0.1, 0.1, 0.9),
        { propPreset: 'savePlinth' }
      );
      entities.push(plinth);
    });

    const rawEntities = Array.isArray(lv.entities) ? lv.entities : [];
    rawEntities.slice(0, 24).forEach((eRaw, eIdx) => {
      if (!eRaw || typeof eRaw !== 'object') return;
      const eObj = eRaw as Record<string, unknown>;
      const kind = oneOf<EntityKind>(
        eObj.kind,
        ['npc', 'baddie', 'treasure', 'key', 'door', 'pickup', 'prop', 'scenery'],
        'npc'
      );
      const ent = createEntity(
        kind,
        str(eObj.name, `Entity ${eIdx + 1}`),
        num(eObj.x, 0.5, 0.08, 0.92),
        num(eObj.y, 0.5, 0.08, 0.92)
      );
      ent.isBoss = Boolean(eObj.isBoss);
      ent.isBuddy = Boolean(eObj.isBuddy);
      ent.health = Math.round(num(eObj.health, ent.isBoss ? 12 : 4, 1, 35));
      ent.speed = num(eObj.speed, kind === 'baddie' ? 3.8 : 2.5, 0.5, 10);
      ent.damage = Math.round(num(eObj.damage, 1, 0, 6));
      ent.dialogue = str(eObj.dialogue, '');
      ent.notes = str(eObj.notes, '');
      ent.loot = str(eObj.loot, '');
      if (typeof eObj.monsterPreset === 'string' && eObj.monsterPreset) {
        const mPreset = createDefaultMonsterBlueprint(eObj.monsterPreset);
        mPreset.name = ent.name;
        mPreset.isBoss = ent.isBoss;
        mPreset.role = kind === 'baddie' ? 'baddie' : ent.isBuddy ? 'buddy' : 'npc';
        mPreset.health = ent.health;
        mPreset.speed = ent.speed;
        ent.monsterConfig = mPreset;
      }
      ent.cards = sanitizeBehaviorCards(eObj.cards);
      entities.push(ent);
    });

    const objListRaw = Array.isArray(lv.objectives) ? lv.objectives : [];
    const objectives =
      objListRaw.length > 0
        ? [
            ...(existingLevel ? existingLevel.objectives : []),
            ...objListRaw.slice(0, 5).map((text) => ({
              id: uid(),
              text: str(text, 'Explore the level'),
              isOptional: false,
            })),
          ]
        : blank.objectives;

    return {
      ...blank,
      name,
      biome,
      sky,
      weather,
      vistaPreset: existingLevel
        ? existingLevel.vistaPreset
        : allowLevelSnow
          ? 'alpineValley'
          : 'mistyHills',
      completeCondition,
      heroIntroSpeech:
        typeof lv.heroIntroSpeech === 'string'
          ? lv.heroIntroSpeech
          : existingLevel?.heroIntroSpeech ?? '',
      startPoint,
      portalPoint,
      hasStart: true,
      hasPortal: true,
      objectives,
      entities,
      terrain,
      notes: `Generated by Contextual AI · Level ${idx + 1}`,
    };
  };

  let createdLevels: GameLevel[];
  if (modifyExisting) {
    createdLevels = [...proj.levels];
    rawLevels.slice(0, 5).forEach((entry, idx) => {
      if (!entry || typeof entry !== 'object') return;
      const lv = entry as Record<string, unknown>;
      const lvName = typeof lv.name === 'string' ? lv.name.trim().toLowerCase() : '';
      const existingIdx = lvName
        ? createdLevels.findIndex((c) => c.name.toLowerCase() === lvName)
        : idx < createdLevels.length
          ? idx
          : -1;
      if (existingIdx >= 0) {
        createdLevels[existingIdx] = buildLevelFromPlan(
          lv,
          existingIdx,
          createdLevels[existingIdx]
        );
      } else {
        createdLevels.push(buildLevelFromPlan(lv, createdLevels.length));
      }
    });
  } else {
    createdLevels = rawLevels.slice(0, 5).map((entry, idx) => {
      const lv = (entry && typeof entry === 'object'
        ? entry
        : {}) as Record<string, unknown>;
      return buildLevelFromPlan(lv, idx);
    });
  }

  // Chain portals sequentially: Level 1 -> Level 2 -> ...
  for (let i = 0; i < createdLevels.length - 1; i++) {
    createdLevels[i].nextLevelID = createdLevels[i + 1].id;
  }

  const rawColors =
    raw.heroColors && typeof raw.heroColors === 'object'
      ? (raw.heroColors as Record<string, unknown>)
      : {};

  store.updateProject(
    modifyExisting ? 'AI modify multi-level adventure' : 'AI build multi-level adventure',
    (prev) => {
      let nextWm = modifyExisting
        ? prev.worldMap ?? ensureWorldMapForProject(prev)
        : createEmptyWorldMap();
      if (createdLevels[0]?.terrain) {
        nextWm = syncTerrainOntoProjectWorldMap(
          nextWm,
          createdLevels[0].id,
          createdLevels[0].name,
          createdLevels[0].terrain,
          !modifyExisting
        );
      }
      return {
        ...prev,
        worldMap: nextWm,
        name: str(raw.projectTitle, prev.name),
        heroName: str(raw.heroName, prev.heroName),
        heroColors: {
          tunic: hexColor(rawColors.tunic, prev.heroColors.tunic),
          cloak: hexColor(rawColors.cloak, prev.heroColors.cloak),
          hair: hexColor(rawColors.hair, prev.heroColors.hair),
          skin: hexColor(rawColors.skin, prev.heroColors.skin),
        },
        levels: createdLevels,
      };
    }
  );

  if (createdLevels[0]) {
    store.setSelectedLevelID(createdLevels[0].id);
    store.setWorldEditorScope(createdLevels[0].id);
  }

  return str(
    raw.summary,
    `${modifyExisting ? 'Updated' : 'Built'} ${createdLevels.length}-level linked adventure with portals, save plinths, NPCs & rules.`
  );
}

// ---------------------------------------------------------------------------
// 9. INTERFACE / HUD APPLIER
// ---------------------------------------------------------------------------
export function applyInterfacePlanToStore(
  store: MakerStore,
  raw: Record<string, unknown>,
  options?: AiApplyOptions
): string {
  const proj = store.currentProject;
  if (!proj) throw new Error('No active project open.');

  const modifyExisting = Boolean(options?.modifyExisting);
  const rawWidgets = Array.isArray(raw.widgets) ? raw.widgets : [];
  const validKinds: WidgetKind[] = [
    'bar',
    'counter',
    'inventoryGrid',
    'minimap',
    'objectiveList',
    'dialogue',
    'pauseButton',
    'timer',
    'bossBar',
    'tutorial',
    'joystick',
    'actionButton',
  ];
  const validAnchors: WidgetAnchor[] = [
    'topLeading',
    'top',
    'topTrailing',
    'bottomLeading',
    'bottom',
    'bottomTrailing',
  ];

  const nextWidgets: HUDWidget[] = rawWidgets
    .slice(0, 12)
    .map((entry) => {
      const w = (entry && typeof entry === 'object'
        ? entry
        : {}) as Record<string, unknown>;
      return makeWidget(
        oneOf(w.kind, validKinds, 'bar'),
        oneOf(w.anchor, validAnchors, 'topLeading'),
        str(w.binding, 'health'),
        hexColor(w.fillHex, '#20B46A'),
        str(w.label, 'Health')
      );
    });

  if (nextWidgets.length === 0 && !modifyExisting) {
    return 'No widget changes supplied.';
  }

  store.updateProject(
    modifyExisting ? 'AI modify HUD layout' : 'AI update HUD layout',
    (prev) => {
      let mergedWidgets = nextWidgets;
      if (modifyExisting) {
        mergedWidgets = [...prev.hud.widgets];
        nextWidgets.forEach((nw) => {
          const idx = mergedWidgets.findIndex(
            (ew) => ew.kind === nw.kind && ew.binding === nw.binding
          );
          if (idx >= 0) {
            mergedWidgets[idx] = { ...nw, id: mergedWidgets[idx].id };
          } else {
            mergedWidgets.push(nw);
          }
        });
      }
      return {
        ...prev,
        hud: {
          ...prev.hud,
          themeName: str(raw.themeName, prev.hud.themeName),
          widgets: mergedWidgets,
        },
        storybook: {
          enabled:
            typeof raw.storybookEnabled === 'boolean'
              ? raw.storybookEnabled
              : Boolean(prev.storybook?.enabled),
          theme: oneOf<StorybookThemeId>(
            raw.storybookTheme,
            ['woodland', 'goldenMeadow', 'moonlitFable'],
            prev.storybook?.theme ?? 'woodland'
          ),
        },
      };
    }
  );

  return str(
    raw.summary,
    `${modifyExisting ? 'Updated' : 'Applied'} ${nextWidgets.length} HUD widgets.`
  );
}
