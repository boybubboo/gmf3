import * as THREE from 'three';
import {
  buildCreatureMesh,
  buildHeroModel,
  buildProceduralBaddieModel,
  buildProceduralNpcRig,
  type BaddieRig,
  type HeroRig,
} from './proceduralModels';
import {
  buildQuadrupedMonsterMesh,
  createDefaultMonsterBlueprint,
  MONSTER_PRESETS,
  type QuadrupedMonsterRig,
} from './quadrupedMonsterBuilder';
import {
  createShowcaseTwinFlameDrakeBlueprint,
} from '../data/baddieActionLibrary';
import {
  instantiateCustomModel,
  type CustomModelInstance,
} from './gltfAssetManager';
import type { HeroEquipmentHandles } from './heroEquipmentAttachments';
import {
  createDefaultRigSettings,
  inspectModelSkeleton,
  ProceduralRigController,
  sampleMotionPresetToPose,
} from './proceduralRigAnimator';
import {
  MOTION_SLOT_META_BY_SLOT,
} from '../data/motionLibrary';
import type {
  BonePoseAngles,
  CreatureBodyId,
  CustomAssetMeta,
  CustomClipSlot,
  CustomMotionPreset,
  CustomRigSettings,
  GameLevel,
  GameProject,
  LevelEntity,
  MonsterBlueprint,
  MotionActorCategory,
  MotionActorTarget,
  MotionFitReport,
  MotionFitWarning,
  MotionRigArchetype,
  RigBoneRole,
} from '../types/maker';
import { uid } from '../utils/terrain';

export interface StudioActorDescriptor {
  id: string;
  label: string;
  subtitle: string;
  category: MotionActorCategory;
  archetype: MotionRigArchetype;
  target: MotionActorTarget;
  entityId?: string;
}

export interface StudioContextPropsState {
  weapon: 'none' | 'sword' | 'axe' | 'fishingPole' | 'torch';
  shield: boolean;
  showTelegraph: boolean;
  inventoryItemId?: string | null;
}

export interface StudioActorRuntime {
  instance: CustomModelInstance;
  descriptor: StudioActorDescriptor;
  archetype: MotionRigArchetype;
  category: MotionActorCategory;
  hipsHeightRef: number;
  boundsCenter: THREE.Vector3;
  boundsSize: THREE.Vector3;
  radius: number;
  heroRig?: HeroRig;
  baddieRig?: BaddieRig;
  quadrupedRig?: QuadrupedMonsterRig;
  telegraphGroup?: THREE.Group;
  customEquipmentHandles?: HeroEquipmentHandles | null;
  studioAttachedGroup?: THREE.Group | null;
  customAnimations: CustomMotionPreset[];
  defaultSlotPresets: Partial<Record<CustomClipSlot, string>>;
  assetMeta?: CustomAssetMeta;
  monsterBlueprint?: MonsterBlueprint;
}

const BUDDY_CREATURE_SPECIES: CreatureBodyId[] = [
  'Duckling',
  'Skunk',
  'Porcupine',
  'Mole Rat',
  'Vulture',
  'Squirrel',
  'Badger',
  'Owl',
];

export function describeTargetKey(t: MotionActorTarget): string {
  switch (t.kind) {
    case 'builtInHero':
      return 'builtInHero';
    case 'proceduralNpc':
      return `proceduralNpc:${t.entityId ?? 'default'}`;
    case 'buddyCritter':
      return `buddyCritter:${t.creatureType}:${t.entityId ?? 'species'}`;
    case 'proceduralBaddie':
      return `proceduralBaddie:${t.variant}:${t.entityId ?? 'default'}`;
    case 'monsterBlueprint':
      return `monsterBlueprint:${t.monsterId}:${t.entityId ?? 'bp'}`;
    case 'customAsset':
      return `customAsset:${t.assetId}`;
  }
}

export function listStudioActors(
  project: GameProject | null,
  currentLevel: GameLevel | null,
  customAssets: CustomAssetMeta[]
): StudioActorDescriptor[] {
  const list: StudioActorDescriptor[] = [];

  // 1. HERO
  list.push({
    id: 'builtInHero',
    label: 'Built-In Hero',
    subtitle: 'Starter adventurer rig (Sword, Shield, Locomotion)',
    category: 'hero',
    archetype: 'humanoid',
    target: { kind: 'builtInHero', category: 'hero', label: 'Built-In Hero' },
  });

  if (project?.heroCustomAssetId) {
    const heroMeta = customAssets.find((a) => a.id === project.heroCustomAssetId);
    if (heroMeta) {
      list.push({
        id: `customAsset:${heroMeta.id}`,
        label: `${heroMeta.name} (Equipped Hero)`,
        subtitle: `${heroMeta.boneNames?.length ?? 0} bones · Custom Hero`,
        category: 'hero',
        archetype: 'humanoid',
        target: { kind: 'customAsset', assetId: heroMeta.id, category: 'hero', label: heroMeta.name },
      });
    }
  }

  for (const a of customAssets) {
    if (a.category === 'character' && a.id !== project?.heroCustomAssetId) {
      list.push({
        id: `customAsset:${a.id}`,
        label: a.name,
        subtitle: `${a.boneNames?.length ?? 0} bones · Custom Character`,
        category: 'hero',
        archetype: 'humanoid',
        target: { kind: 'customAsset', assetId: a.id, category: 'hero', label: a.name },
      });
    }
  }

  // 2. NPCs
  const levelEntities = currentLevel?.entities ?? [];
  const levelNpcs = levelEntities.filter((e) => e.kind === 'npc' && !e.isBuddy);

  list.push({
    id: 'proceduralNpc:default',
    label: 'Townsperson NPC (Default)',
    subtitle: 'Articulated villager rig · Talk, Wave, Laugh, Sit',
    category: 'npc',
    archetype: 'humanoid',
    target: { kind: 'proceduralNpc', category: 'npc', label: 'Townsperson NPC' },
  });

  for (const npc of levelNpcs) {
    if (npc.customAssetId) {
      const meta = customAssets.find((a) => a.id === npc.customAssetId);
      if (meta) {
        list.push({
          id: `npc_custom_${npc.id}`,
          label: `${npc.name} (${meta.name})`,
          subtitle: `Placed NPC on ${currentLevel?.name ?? 'Level'}`,
          category: 'npc',
          archetype: 'humanoid',
          target: { kind: 'customAsset', assetId: meta.id, category: 'npc', label: npc.name },
          entityId: npc.id,
        });
        continue;
      }
    }
    if (npc.creatureType) {
      list.push({
        id: `npc_creature_${npc.id}`,
        label: `${npc.name} (${npc.creatureType})`,
        subtitle: `Creature NPC on ${currentLevel?.name ?? 'Level'}`,
        category: 'npc',
        archetype: 'critter',
        target: {
          kind: 'buddyCritter',
          category: 'buddy',
          creatureType: npc.creatureType,
          entityId: npc.id,
          label: npc.name,
        },
        entityId: npc.id,
      });
    } else {
      list.push({
        id: `npc_entity_${npc.id}`,
        label: npc.name,
        subtitle: `Placed Townsperson on ${currentLevel?.name ?? 'Level'}`,
        category: 'npc',
        archetype: 'humanoid',
        target: { kind: 'proceduralNpc', category: 'npc', entityId: npc.id, label: npc.name },
        entityId: npc.id,
      });
    }
  }

  // 3. BUDDY PARTNERS
  const seenBuddySpecies = new Set<CreatureBodyId>();
  const levelBuddies = levelEntities.filter((e) => Boolean(e.isBuddy));
  for (const buddy of levelBuddies) {
    const sp = buddy.creatureType ?? 'Duckling';
    seenBuddySpecies.add(sp);
    list.push({
      id: `buddy_entity_${buddy.id}`,
      label: `${buddy.name} (${sp})`,
      subtitle: 'Level Buddy Partner · Cheer, Shy, Grumpy, Power',
      category: 'buddy',
      archetype: 'critter',
      target: {
        kind: 'buddyCritter',
        category: 'buddy',
        creatureType: sp,
        entityId: buddy.id,
        label: buddy.name,
      },
      entityId: buddy.id,
    });
  }

  for (const species of BUDDY_CREATURE_SPECIES) {
    const label = species === 'Duckling' ? 'Buddy Duckling (Sidekick)' : `${species} (Misfit Buddy)`;
    list.push({
      id: `buddy_species_${species}`,
      label,
      subtitle: seenBuddySpecies.has(species) ? 'Placed species · Default Critter Rig' : 'Critter Partner Rig',
      category: 'buddy',
      archetype: 'critter',
      target: { kind: 'buddyCritter', category: 'buddy', creatureType: species, label },
    });
  }

  // 4. ENEMIES & BOSSES
  const seenBlueprintIds = new Set<string>();
  const levelMonsters = levelEntities.filter((e) => e.kind === 'baddie' && e.monsterConfig);
  for (const ent of levelMonsters) {
    if (!ent.monsterConfig) continue;
    seenBlueprintIds.add(ent.monsterConfig.id);
    list.push({
      id: `monster_entity_${ent.id}`,
      label: `${ent.name}${ent.isBoss ? ' (Boss)' : ''}`,
      subtitle: `Level Monster · ${ent.monsterConfig.headCount}H ${ent.monsterConfig.canFly ? 'Winged' : 'Ground'}`,
      category: 'enemy',
      archetype: 'quadruped',
      target: {
        kind: 'monsterBlueprint',
        category: 'enemy',
        monsterId: ent.monsterConfig.id,
        entityId: ent.id,
        label: ent.name,
      },
      entityId: ent.id,
    });
  }

  const projectBlueprints = project?.customMonsters ?? [];
  for (const bp of projectBlueprints) {
    if (seenBlueprintIds.has(bp.id)) continue;
    seenBlueprintIds.add(bp.id);
    list.push({
      id: `monster_bp_${bp.id}`,
      label: bp.name,
      subtitle: `Monster Blueprint · ${bp.canFly ? 'Flying' : 'Ground'}`,
      category: 'enemy',
      archetype: 'quadruped',
      target: { kind: 'monsterBlueprint', category: 'enemy', monsterId: bp.id, label: bp.name },
    });
  }

  // Always offer Twin Flame Drake showcase + core presets
  if (!seenBlueprintIds.has('preset_twin_dragon')) {
    list.push({
      id: 'monster_bp_preset_twin_dragon',
      label: 'Twin Flame Drake (Boss Dragon)',
      subtitle: '2-Headed Flying Dragon · Death, Head Sway, Fire Breath',
      category: 'enemy',
      archetype: 'quadruped',
      target: {
        kind: 'monsterBlueprint',
        category: 'enemy',
        monsterId: 'preset_twin_dragon',
        label: 'Twin Flame Drake',
      },
    });
  }

  for (const mp of MONSTER_PRESETS) {
    if (mp.id === 'twin_dragon') continue;
    if (seenBlueprintIds.has(mp.blueprint.id)) continue;
    list.push({
      id: `monster_preset_${mp.id}`,
      label: mp.label,
      subtitle: `${mp.blurb} · Quadruped Rig`,
      category: 'enemy',
      archetype: 'quadruped',
      target: {
        kind: 'monsterBlueprint',
        category: 'enemy',
        monsterId: mp.id,
        label: mp.label,
      },
    });
  }

  // Procedural Baddies & Level Baddies without monsterConfig
  for (const ent of levelEntities) {
    if (ent.kind !== 'baddie' || ent.monsterConfig) continue;
    if (ent.customAssetId) {
      const meta = customAssets.find((a) => a.id === ent.customAssetId);
      if (meta) {
        list.push({
          id: `baddie_custom_${ent.id}`,
          label: `${ent.name} (${meta.name})`,
          subtitle: `Placed Enemy on ${currentLevel?.name ?? 'Level'}`,
          category: 'enemy',
          archetype: 'humanoid',
          target: { kind: 'customAsset', assetId: meta.id, category: 'enemy', label: ent.name },
          entityId: ent.id,
        });
        continue;
      }
    }
    const v: 'ground' | 'flyer' | 'boss' = ent.baddieAI?.canFly
      ? 'flyer'
      : ent.isBoss
      ? 'boss'
      : 'ground';
    list.push({
      id: `baddie_entity_${ent.id}`,
      label: ent.name,
      subtitle: `Placed Procedural ${v === 'flyer' ? 'Flyer' : v === 'boss' ? 'Boss' : 'Baddie'}`,
      category: 'enemy',
      archetype: 'baddie',
      target: {
        kind: 'proceduralBaddie',
        category: 'enemy',
        variant: v,
        entityId: ent.id,
        label: ent.name,
      },
      entityId: ent.id,
    });
  }

  list.push(
    {
      id: 'proceduralBaddie:ground',
      label: 'Procedural Ground Baddie',
      subtitle: 'Spear Fighter · Slash, Windup, Defeat',
      category: 'enemy',
      archetype: 'baddie',
      target: {
        kind: 'proceduralBaddie',
        category: 'enemy',
        variant: 'ground',
        label: 'Procedural Ground Baddie',
      },
    },
    {
      id: 'proceduralBaddie:flyer',
      label: 'Procedural Winged Flyer',
      subtitle: 'Aerial Scout · Hover Flap, Dive Strike',
      category: 'enemy',
      archetype: 'baddie',
      target: {
        kind: 'proceduralBaddie',
        category: 'enemy',
        variant: 'flyer',
        label: 'Procedural Winged Flyer',
      },
    },
    {
      id: 'proceduralBaddie:boss',
      label: 'Procedural Boss Warlord',
      subtitle: 'Crowned Heavy Boss · Slam, Roar, Death',
      category: 'enemy',
      archetype: 'baddie',
      target: {
        kind: 'proceduralBaddie',
        category: 'enemy',
        variant: 'boss',
        label: 'Procedural Boss Warlord',
      },
    }
  );

  return list;
}

export function resolveMonsterBlueprintForTarget(
  monsterId: string,
  entityId: string | undefined,
  project: GameProject | null,
  currentLevel: GameLevel | null
): MonsterBlueprint {
  if (entityId && currentLevel) {
    const ent = currentLevel.entities.find((e) => e.id === entityId);
    if (ent?.monsterConfig) return ent.monsterConfig;
  }
  const fromProject = project?.customMonsters?.find((m) => m.id === monsterId || m.presetId === monsterId);
  if (fromProject) return fromProject;
  if (monsterId === 'preset_twin_dragon' || monsterId === 'twin_dragon') {
    return createShowcaseTwinFlameDrakeBlueprint();
  }
  const fromPreset = MONSTER_PRESETS.find((p) => p.blueprint.id === monsterId || p.id === monsterId);
  if (fromPreset) return fromPreset.blueprint;
  return createDefaultMonsterBlueprint(monsterId);
}

function createVirtualInstanceWrapper(opts: {
  rootObject: THREE.Group;
  modelNode: THREE.Group;
  customAnimations: CustomMotionPreset[];
  defaultSlotPresets: Partial<Record<CustomClipSlot, string>>;
}): CustomModelInstance {
  const { rootObject, modelNode, customAnimations, defaultSlotPresets } = opts;
  const inspection = inspectModelSkeleton(modelNode);
  const rigSettings = createDefaultRigSettings(inspection, false);
  // Zero arm relax on procedural rigs whose bind pose already rests naturally at sides
  rigSettings.armRelaxAngle = 0;

  const controller = new ProceduralRigController(
    rootObject,
    modelNode,
    rigSettings,
    customAnimations,
    defaultSlotPresets
  );

  let animSpeed = 1;
  let currentDefaults: Partial<Record<CustomClipSlot, string>> = { ...defaultSlotPresets };
  let currentOverrideKind: string | null = null;
  const instance: CustomModelInstance = {
    group: rootObject,
    scaledRoot: modelNode,
    modelRoot: modelNode,
    mixer: null,
    proceduralRig: controller,
    rigSettings,
    clips: {},
    clipHasMotion: {},
    fallbackAction: null,
    currentSlot: 'idle',
    activeDriver: 'procedural',
    setAction: (slot) => {
      instance.currentSlot = slot;
    },
    update: (dt, speedMultiplier = 1) => {
      controller.update(dt, instance.currentSlot, speedMultiplier * animSpeed);
      const isCustom =
        currentOverrideKind === 'presetPreview' ||
        currentOverrideKind === 'poseSnapshot' ||
        (!currentOverrideKind && Boolean(currentDefaults[instance.currentSlot]));
      instance.activeDriver = isCustom ? 'custom' : 'procedural';
    },
    applyRigSettings: (next) => {
      rigSettings.mode = next.mode;
      if (Object.keys(next.boneMap).length > 0 || Object.keys(rigSettings.boneMap).length === 0) {
        rigSettings.boneMap = { ...next.boneMap };
      }
      rigSettings.limbSwingAxis = next.limbSwingAxis;
      rigSettings.armRelaxAngle = next.armRelaxAngle;
      rigSettings.armSpreadAngle = next.armSpreadAngle;
      rigSettings.idleArmSpreadAngle = next.idleArmSpreadAngle;
      rigSettings.mirrorArmRelax = next.mirrorArmRelax;
      rigSettings.mirrorLimbSwing = next.mirrorLimbSwing;
      rigSettings.motionStrength = next.motionStrength;
      rigSettings.headMotion = next.headMotion;
      rigSettings.facingOffsetDeg = next.facingOffsetDeg;
      rigSettings.slotTuning = next.slotTuning ? { ...next.slotTuning } : undefined;
      controller.updateSettings(rigSettings);
    },
    setCustomAnimations: (presets, defaults) => {
      currentDefaults = defaults ? { ...defaults } : {};
      controller.setCustomAnimations(presets, defaults);
    },
    setTestOverride: (override) => {
      currentOverrideKind = override?.kind ?? null;
      controller.setTestOverride(override);
    },
    setAnimSpeed: (speed) => {
      animSpeed = THREE.MathUtils.clamp(speed || 1, 0.25, 3);
    },
  };
  return instance;
}

export function resolveStudioCustomAnimationsAndDefaults(
  target: MotionActorTarget,
  project: GameProject | null,
  currentLevel: GameLevel | null,
  customAssets: CustomAssetMeta[]
): {
  customAnimations: CustomMotionPreset[];
  defaultSlotPresets: Partial<Record<CustomClipSlot, string>>;
  assetMeta?: CustomAssetMeta;
  monsterBlueprint?: MonsterBlueprint;
  entity?: LevelEntity;
} {
  const projectLib = project?.customMotionLibrary ?? [];

  if (target.kind === 'customAsset') {
    const meta = customAssets.find((a) => a.id === target.assetId);
    const mergedPresets = mergePresetsById(meta?.customAnimations ?? [], projectLib);
    return {
      customAnimations: mergedPresets,
      defaultSlotPresets: { ...(meta?.defaultSlotPresets ?? {}) },
      assetMeta: meta,
    };
  }

  if (target.kind === 'builtInHero') {
    const entityPresets = mergePresetsById(projectLib, []);
    return {
      customAnimations: entityPresets,
      defaultSlotPresets: { ...(project?.heroMotionSlots ?? {}) },
    };
  }

  if (target.kind === 'proceduralNpc') {
    const entity = target.entityId
      ? currentLevel?.entities.find((e) => e.id === target.entityId)
      : undefined;
    const defaults = {
      ...(project?.npcMotionSlots ?? {}),
      ...(entity?.motionSlotOverrides ?? {}),
    };
    const merged = mergePresetsById(projectLib, entity?.motionCustomAnimations ?? []);
    return { customAnimations: merged, defaultSlotPresets: defaults, entity };
  }

  if (target.kind === 'buddyCritter') {
    const entity = target.entityId
      ? currentLevel?.entities.find((e) => e.id === target.entityId)
      : undefined;
    const speciesSlots = project?.buddyMotionSlotsByCreature?.[target.creatureType] ?? {};
    const defaults = {
      ...(project?.buddyMotionSlots ?? {}),
      ...speciesSlots,
      ...(entity?.motionSlotOverrides ?? {}),
    };
    const merged = mergePresetsById(projectLib, entity?.motionCustomAnimations ?? []);
    return { customAnimations: merged, defaultSlotPresets: defaults, entity };
  }

  if (target.kind === 'proceduralBaddie') {
    const entity = target.entityId
      ? currentLevel?.entities.find((e) => e.id === target.entityId)
      : undefined;
    const defaults = {
      ...(project?.baddieMotionSlots ?? {}),
      ...(entity?.motionSlotOverrides ?? {}),
    };
    const merged = mergePresetsById(projectLib, entity?.motionCustomAnimations ?? []);
    return { customAnimations: merged, defaultSlotPresets: defaults, entity };
  }

  // monsterBlueprint
  const entity = target.entityId
    ? currentLevel?.entities.find((e) => e.id === target.entityId)
    : undefined;
  const bp = resolveMonsterBlueprintForTarget(
    target.monsterId,
    target.entityId,
    project,
    currentLevel
  );
  const defaults = {
    ...(bp.defaultSlotPresets ?? {}),
    ...(entity?.motionSlotOverrides ?? {}),
  };
  const merged = mergePresetsById(
    bp.customAnimations ?? [],
    mergePresetsById(projectLib, entity?.motionCustomAnimations ?? [])
  );
  return {
    customAnimations: merged,
    defaultSlotPresets: defaults,
    monsterBlueprint: bp,
    entity,
  };
}

function mergePresetsById(
  primary: CustomMotionPreset[],
  secondary: CustomMotionPreset[]
): CustomMotionPreset[] {
  const map = new Map<string, CustomMotionPreset>();
  for (const p of secondary) map.set(p.id, p);
  for (const p of primary) map.set(p.id, p);
  return Array.from(map.values());
}

export function buildTelegraphGuideGroup(radius = 2.6, color = '#FF5E3A'): THREE.Group {
  const g = new THREE.Group();
  g.name = 'StudioTelegraphGuide';
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.88, radius, 40),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;

  const cone = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 1.15, 24, -Math.PI * 0.22 + Math.PI * 0.5, Math.PI * 0.44),
    new THREE.MeshBasicMaterial({
      color: '#F59E0B',
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  cone.rotation.x = -Math.PI / 2;
  cone.position.y = 0.025;

  g.add(ring, cone);
  g.visible = false;
  return g;
}

export function applyContextPropsToHeroRig(
  rig: HeroRig | undefined,
  props: StudioContextPropsState | undefined
): void {
  if (!rig || !props) return;
  if (rig.sword) rig.sword.visible = props.weapon === 'sword';
  if (rig.axe) rig.axe.visible = props.weapon === 'axe';
  if (rig.fishingPole) rig.fishingPole.visible = props.weapon === 'fishingPole';
  if (rig.torch) rig.torch.visible = props.weapon === 'torch';
  if (rig.heldGeneric) rig.heldGeneric.visible = false;
  if (rig.shield) {
    rig.shield.visible =
      props.shield &&
      props.weapon !== 'axe' &&
      props.weapon !== 'fishingPole' &&
      props.weapon !== 'torch';
  }
}

export function instantiateStudioActor(
  descriptor: StudioActorDescriptor,
  project: GameProject | null,
  currentLevel: GameLevel | null,
  customAssets: CustomAssetMeta[],
  contextProps?: StudioContextPropsState
): StudioActorRuntime | null {
  const { target } = descriptor;
  const resolved = resolveStudioCustomAnimationsAndDefaults(target, project, currentLevel, customAssets);

  if (target.kind === 'customAsset') {
    const inst = instantiateCustomModel(target.assetId, resolved.assetMeta);
    if (!inst) return null;
    inst.setCustomAnimations(resolved.customAnimations, resolved.defaultSlotPresets);

    inst.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inst.scaledRoot);
    const boundsCenter = new THREE.Vector3();
    const boundsSize = new THREE.Vector3();
    if (!box.isEmpty()) {
      box.getCenter(boundsCenter);
      box.getSize(boundsSize);
    } else {
      boundsCenter.set(0, 0.9, 0);
      boundsSize.set(0.8, 1.8, 0.6);
    }
    return {
      instance: inst,
      descriptor,
      archetype: 'humanoid',
      category: descriptor.category,
      hipsHeightRef: inst.proceduralRig?.getHipsHeightRef() ?? Math.max(0.45, boundsSize.y * 0.5),
      boundsCenter,
      boundsSize,
      radius: Math.max(0.75, Math.hypot(boundsSize.x, boundsSize.z) * 0.55),
      customAnimations: resolved.customAnimations,
      defaultSlotPresets: resolved.defaultSlotPresets,
      assetMeta: resolved.assetMeta,
    };
  }

  let rootGroup: THREE.Group;
  let modelNode: THREE.Group;
  let shadowDisc: THREE.Mesh | undefined;
  let heroRig: HeroRig | undefined;
  let baddieRig: BaddieRig | undefined;
  let quadrupedRig: QuadrupedMonsterRig | undefined;
  let telegraphGroup: THREE.Group | undefined;

  if (target.kind === 'builtInHero') {
    const style = project?.heroColors ?? {
      tunic: '#2D9CDB',
      cloak: '#27AE60',
      hair: '#4A3121',
      skin: '#F3C7A4',
    };
    heroRig = buildHeroModel(project?.heroBody || 'Adventurer', style);
    applyContextPropsToHeroRig(heroRig, contextProps ?? { weapon: 'sword', shield: true, showTelegraph: false });
    rootGroup = heroRig.group;
    modelNode = heroRig.group;
    shadowDisc = heroRig.shadowDisc;
  } else if (target.kind === 'proceduralNpc') {
    heroRig = buildProceduralNpcRig(resolved.entity?.styleTint);
    rootGroup = heroRig.group;
    modelNode = heroRig.group;
    shadowDisc = heroRig.shadowDisc;
  } else if (target.kind === 'buddyCritter') {
    const cGroup = buildCreatureMesh(target.creatureType);
    heroRig = cGroup.userData.heroRig as HeroRig | undefined;
    rootGroup = cGroup;
    modelNode = cGroup;
    shadowDisc = heroRig?.shadowDisc;
  } else if (target.kind === 'proceduralBaddie') {
    const built = buildProceduralBaddieModel(target.variant, resolved.entity?.styleTint);
    baddieRig = built.rig;
    rootGroup = built.group;
    modelNode = built.group;
    telegraphGroup = buildTelegraphGuideGroup(target.variant === 'boss' ? 2.4 : 1.7, '#FF5E3A');
    telegraphGroup.visible = Boolean(contextProps?.showTelegraph);
    rootGroup.add(telegraphGroup);
  } else {
    // monsterBlueprint
    const bp = resolved.monsterBlueprint ?? createShowcaseTwinFlameDrakeBlueprint();
    const mon = buildQuadrupedMonsterMesh(bp, { resolution: 28 });
    quadrupedRig = mon.userData.quadrupedRig as QuadrupedMonsterRig | undefined;
    rootGroup = new THREE.Group();
    rootGroup.name = `StudioMonsterWrapper_${bp.id}`;
    rootGroup.add(mon);
    modelNode = mon;
    telegraphGroup = buildTelegraphGuideGroup(
      Math.max(2.2, (bp.attackRange ?? 6) * 0.45),
      bp.bodyColor || '#FF5E3A'
    );
    telegraphGroup.visible = Boolean(contextProps?.showTelegraph);
    rootGroup.add(telegraphGroup);
  }

  const inst = createVirtualInstanceWrapper({
    rootObject: rootGroup,
    modelNode,
    customAnimations: resolved.customAnimations,
    defaultSlotPresets: resolved.defaultSlotPresets,
  });

  rootGroup.updateMatrixWorld(true);
  const box = new THREE.Box3();
  modelNode.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh || !m.visible || m === shadowDisc) return;
    box.expandByObject(m);
  });
  const boundsCenter = new THREE.Vector3(0, 0.9, 0);
  const boundsSize = new THREE.Vector3(1, 1.8, 1);
  if (!box.isEmpty()) {
    box.getCenter(boundsCenter);
    box.getSize(boundsSize);
  }

  return {
    instance: inst,
    descriptor,
    archetype: descriptor.archetype,
    category: descriptor.category,
    hipsHeightRef: inst.proceduralRig?.getHipsHeightRef() ?? Math.max(0.35, boundsSize.y * 0.5),
    boundsCenter,
    boundsSize,
    radius: Math.max(0.75, Math.hypot(boundsSize.x, boundsSize.z) * 0.55),
    heroRig,
    baddieRig,
    quadrupedRig,
    telegraphGroup,
    customAnimations: resolved.customAnimations,
    defaultSlotPresets: resolved.defaultSlotPresets,
    assetMeta: resolved.assetMeta,
    monsterBlueprint: resolved.monsterBlueprint,
  };
}

// ============================================================================
// Motion Fit-Check & Safety Guardrail Engine
// ============================================================================

const _qSeamA = new THREE.Quaternion();
const _qSeamB = new THREE.Quaternion();
const _eSeam = new THREE.Euler();

function angleBetweenDegrees(a: BonePoseAngles, b: BonePoseAngles): number {
  _eSeam.set(
    THREE.MathUtils.degToRad(a[0]),
    THREE.MathUtils.degToRad(a[1]),
    THREE.MathUtils.degToRad(a[2]),
    'XYZ'
  );
  _qSeamA.setFromEuler(_eSeam);
  _eSeam.set(
    THREE.MathUtils.degToRad(b[0]),
    THREE.MathUtils.degToRad(b[1]),
    THREE.MathUtils.degToRad(b[2]),
    'XYZ'
  );
  _qSeamB.setFromEuler(_eSeam);
  const dot = THREE.MathUtils.clamp(Math.abs(_qSeamA.dot(_qSeamB)), 0, 1);
  return THREE.MathUtils.radToDeg(2 * Math.acos(dot));
}

export function evaluateMotionSafety(
  preset: CustomMotionPreset,
  targetBoneNames: string[],
  archetype: MotionRigArchetype
): MotionFitReport {
  const warnings: MotionFitWarning[] = [];
  const meta = MOTION_SLOT_META_BY_SLOT[preset.slot];
  const [recMin, recMax] = meta?.recommendedDurationSec ?? [0.25, 3.0];

  // 1. Duration Check (prevent combat softlocks or clipped strikes)
  if (preset.duration > recMax * 1.15) {
    warnings.push({
      code: 'tooLong',
      severity: preset.duration > recMax * 1.6 ? 'caution' : 'info',
      message: `Duration ${preset.duration.toFixed(2)}s exceeds recommended ${recMin}s–${recMax}s for ${meta?.label ?? preset.slot} (gameplay action may feel sluggish).`,
    });
  } else if (preset.duration < recMin * 0.75) {
    warnings.push({
      code: 'tooShort',
      severity: 'info',
      message: `Duration ${preset.duration.toFixed(2)}s is faster than recommended ${recMin}s–${recMax}s.`,
    });
  }

  // 2. Keyframe bones & Joint Comfort Bounds Check
  const sorted = [...preset.keyframes].sort((a, b) => a.time - b.time);
  const presetBoneSet = new Set<string>();
  const targetSet = new Set(targetBoneNames.map((n) => n.toLowerCase()));
  let extremeJointFound = false;
  let floorSinkFound = false;
  const allowDeepFloorDrop =
    preset.slot === 'dying' ||
    preset.slot === 'die' ||
    preset.slot === 'sleep' ||
    preset.slot === 'knockdown';

  for (const kf of sorted) {
    const drop = kf.hipsOffsetY ?? 0;
    if (!allowDeepFloorDrop && drop < -0.42) {
      floorSinkFound = true;
    }
    for (const [bName, angles] of Object.entries(kf.bones)) {
      presetBoneSet.add(bName);
      const maxAbs = Math.max(Math.abs(angles[0]), Math.abs(angles[1]), Math.abs(angles[2]));
      const isTorsoOrHead = /head|neck|spine|chest|torso/i.test(bName);
      if ((isTorsoOrHead && maxAbs > 78) || maxAbs > 160) {
        extremeJointFound = true;
      }
    }
  }

  if (floorSinkFound) {
    warnings.push({
      code: 'floorClip',
      severity: 'caution',
      message: 'Deep vertical drop detected; Fit Engine auto-clamps root height above floor during play.',
    });
  }
  if (extremeJointFound) {
    warnings.push({
      code: 'extremeAngle',
      severity: 'caution',
      message: 'Extreme joint rotation (>160° or >78° spine/head bend) may look twisted. Use Clamp Natural Range.',
    });
  }

  // 3. Bone Anatomy Fit Check (wings, tail, multiple heads, etc.)
  const roleAliasLower = new Set([
    'hips', 'spine', 'chest', 'neck', 'head',
    'leftupperarm', 'leftlowerarm', 'rightupperarm', 'rightlowerarm',
    'leftupperleg', 'leftlowerleg', 'rightupperleg', 'rightlowerleg',
    'monsterbodypivot', 'monsterchest', 'monstertorso', 'monsterhips',
    'monsterneck_0_0', 'monsterhead_0',
  ]);
  let matchedCount = 0;
  let skippedAnatomy = 0;
  for (const b of presetBoneSet) {
    const bl = b.toLowerCase();
    if (targetSet.has(bl) || (archetype === 'humanoid' && roleAliasLower.has(bl))) {
      matchedCount++;
    } else if (/wing|tail|head_1|neck_1|jaw/i.test(b)) {
      skippedAnatomy++;
    }
  }

  if (presetBoneSet.size > 0 && matchedCount === 0 && targetBoneNames.length > 0) {
    warnings.push({
      code: 'boneMismatch',
      severity: 'caution',
      message: 'Rig bone names differ from this actor; role retargeting will map core joints automatically.',
    });
  } else if (skippedAnatomy > 0) {
    warnings.push({
      code: 'missingOptionalPart',
      severity: 'info',
      message: `${skippedAnatomy} optional wing/tail/extra-head track${skippedAnatomy > 1 ? 's' : ''} will be skipped cleanly on actors without those parts.`,
    });
  }

  // 4. Loop Seam Check
  let loopSeamDeg = 0;
  if (preset.loop && sorted.length >= 2) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const keys = new Set([...Object.keys(first.bones), ...Object.keys(last.bones)]);
    for (const k of keys) {
      const d = angleBetweenDegrees(first.bones[k] ?? [0, 0, 0], last.bones[k] ?? [0, 0, 0]);
      if (d > loopSeamDeg) loopSeamDeg = d;
    }
    if (loopSeamDeg > 28 && preset.autoCloseLoop === false) {
      warnings.push({
        code: 'loopSeamJump',
        severity: 'caution',
        message: `Loop seam jump (${Math.round(loopSeamDeg)}°) between end and start frames. Enable Auto-Blend Seam.`,
      });
    }
  }

  const hasCaution = warnings.some((w) => w.severity === 'caution');
  return {
    status: hasCaution ? 'caution' : 'safe',
    warnings,
    matchedBoneCount: matchedCount,
    totalPresetBones: presetBoneSet.size,
    loopSeamDeg: Math.round(loopSeamDeg),
  };
}

export function autoFitPresetTiming(preset: CustomMotionPreset): CustomMotionPreset {
  const meta = MOTION_SLOT_META_BY_SLOT[preset.slot];
  if (!meta) return preset;
  const [minD, maxD] = meta.recommendedDurationSec;
  const nextDuration = Number(THREE.MathUtils.clamp(preset.duration, minD, maxD).toFixed(2));
  return {
    ...preset,
    duration: nextDuration,
    updatedAt: new Date().toISOString(),
  };
}

export function autoBlendLoopSeam(preset: CustomMotionPreset): CustomMotionPreset {
  const sorted = [...preset.keyframes].sort((a, b) => a.time - b.time);
  if (sorted.length < 2) {
    return { ...preset, autoCloseLoop: true, updatedAt: new Date().toISOString() };
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const cloned = sorted.map((kf) => ({
    ...kf,
    bones: Object.fromEntries(
      Object.entries(kf.bones).map(([k, v]) => [k, [...v] as BonePoseAngles])
    ),
  }));

  if (last.time >= 0.96) {
    // Match final keyframe cleanly to first keyframe pose so loop wraps seamlessly
    cloned[cloned.length - 1].bones = Object.fromEntries(
      Object.entries(first.bones).map(([k, v]) => [k, [...v] as BonePoseAngles])
    );
    cloned[cloned.length - 1].hipsOffsetY = first.hipsOffsetY;
  }

  return {
    ...preset,
    loop: true,
    autoCloseLoop: true,
    keyframes: cloned,
    updatedAt: new Date().toISOString(),
  };
}

export function clampPresetToNaturalRange(
  preset: CustomMotionPreset,
  archetype: MotionRigArchetype
): CustomMotionPreset {
  const allowCollapseDrop =
    preset.slot === 'dying' ||
    preset.slot === 'die' ||
    preset.slot === 'sleep' ||
    preset.slot === 'knockdown';

  const keyframes = preset.keyframes.map((kf) => {
    const nextBones: Record<string, BonePoseAngles> = {};
    for (const [bName, angles] of Object.entries(kf.bones)) {
      const isTorsoHead = /head|neck|spine|chest|torso/i.test(bName);
      const isJaw = /jaw/i.test(bName);
      const limit = isJaw
        ? 54
        : isTorsoHead
        ? archetype === 'quadruped'
          ? 70
          : 62
        : 148;
      nextBones[bName] = [
        THREE.MathUtils.clamp(angles[0], -limit, limit),
        THREE.MathUtils.clamp(angles[1], -limit, limit),
        THREE.MathUtils.clamp(angles[2], -limit, limit),
      ];
    }
    const minY = allowCollapseDrop ? -0.62 : -0.35;
    const hipsOffsetY =
      typeof kf.hipsOffsetY === 'number'
        ? THREE.MathUtils.clamp(kf.hipsOffsetY, minY, 0.75)
        : undefined;
    return { ...kf, bones: nextBones, hipsOffsetY };
  });

  return {
    ...preset,
    keyframes,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Runtime Preset Resolution & Procedural Pose Evaluators (Play Mode)
// ============================================================================

export function resolveMotionPresetForRuntime(opts: {
  slot: CustomClipSlot;
  customAnimName?: string;
  actorCategory: MotionActorCategory;
  project?: GameProject | null;
  entity?: LevelEntity | null;
  monsterBp?: MonsterBlueprint | null;
}): CustomMotionPreset | null {
  const { slot, customAnimName, actorCategory, project, entity, monsterBp } = opts;
  const projectLib = project?.customMotionLibrary ?? [];
  const entityLib = entity?.motionCustomAnimations ?? [];
  const monsterLib = monsterBp?.customAnimations ?? [];

  // Build search pool in precedence order
  const allPools: CustomMotionPreset[] = [...entityLib, ...monsterLib, ...projectLib];
  const findById = (id: string | undefined): CustomMotionPreset | null => {
    if (!id) return null;
    return allPools.find((p) => p.id === id) ?? null;
  };

  // 1. Direct named variation or slot from Logic rule playAnimation
  if (customAnimName && customAnimName.trim().length > 0) {
    const query = customAnimName.trim().toLowerCase();
    const byName = allPools.find((p) => p.name.trim().toLowerCase() === query);
    if (byName && byName.keyframes.length > 0) return byName;
    const bySlotMatch = allPools.find((p) => p.slot.toLowerCase() === query);
    if (bySlotMatch && bySlotMatch.keyframes.length > 0) return bySlotMatch;
  }

  // 2. Entity slot override
  const entitySlotId = entity?.motionSlotOverrides?.[slot];
  const entityPreset = findById(entitySlotId);
  if (entityPreset && entityPreset.keyframes.length > 0) return entityPreset;

  // 3. MonsterBlueprint slot override
  if (monsterBp) {
    const bpSlotId = monsterBp.defaultSlotPresets?.[slot];
    const bpPreset = findById(bpSlotId);
    if (bpPreset && bpPreset.keyframes.length > 0) return bpPreset;
  }

  // 4. Category default slot
  if (actorCategory === 'hero') {
    const p = findById(project?.heroMotionSlots?.[slot]);
    if (p && p.keyframes.length > 0) return p;
  } else if (actorCategory === 'npc') {
    const p = findById(project?.npcMotionSlots?.[slot]);
    if (p && p.keyframes.length > 0) return p;
  } else if (actorCategory === 'buddy') {
    const species = entity?.creatureType;
    const spSlotId = species ? project?.buddyMotionSlotsByCreature?.[species]?.[slot] : undefined;
    const p = findById(spSlotId) ?? findById(project?.buddyMotionSlots?.[slot]);
    if (p && p.keyframes.length > 0) return p;
  } else if (actorCategory === 'enemy') {
    const p = findById(project?.baddieMotionSlots?.[slot]);
    if (p && p.keyframes.length > 0) return p;
  }

  return null;
}

function getPoseAnglesByAliases(
  bones: Record<string, BonePoseAngles>,
  aliases: string[]
): BonePoseAngles | null {
  for (const key of aliases) {
    if (bones[key]) return bones[key];
  }
  return null;
}

/**
 * Applies a keyframe CustomMotionPreset pose directly onto a procedural HeroRig / NpcRig / CritterRig
 * with smooth blend factor (0..1) and optional upperBodyOnly mask so combat attacks blend over running feet.
 */
export function applyMotionPresetToHeroRigRuntime(
  rig: HeroRig,
  preset: CustomMotionPreset,
  timeNorm: number,
  blend = 1,
  upperBodyOnly = false,
  baseBodyY = 0
): void {
  const { bones, hipsOffsetY } = sampleMotionPresetToPose(preset, timeNorm);
  const w = THREE.MathUtils.clamp(blend, 0, 1);
  if (w <= 0.001) return;

  const blendEuler = (
    target: THREE.Object3D | undefined,
    angles: BonePoseAngles | null,
    scale = 1
  ) => {
    if (!target || !angles) return;
    const rx = THREE.MathUtils.degToRad(angles[0]) * scale;
    const ry = THREE.MathUtils.degToRad(angles[1]) * scale;
    const rz = THREE.MathUtils.degToRad(angles[2]) * scale;
    target.rotation.x = THREE.MathUtils.lerp(target.rotation.x, rx, w);
    target.rotation.y = THREE.MathUtils.lerp(target.rotation.y, ry, w);
    target.rotation.z = THREE.MathUtils.lerp(target.rotation.z, rz, w);
  };

  if (!upperBodyOnly) {
    blendEuler(rig.bodyPivot, getPoseAnglesByAliases(bones, ['Hips', 'hips', 'Pelvis']));
    if (Math.abs(hipsOffsetY) > 0.0005) {
      const refRatio = preset.hipsHeightRef && preset.hipsHeightRef > 0.05 ? 0.56 / preset.hipsHeightRef : 1;
      const targetY = Math.max(0.05, baseBodyY + hipsOffsetY * THREE.MathUtils.clamp(refRatio, 0.4, 2.2));
      rig.bodyPivot.position.y = THREE.MathUtils.lerp(rig.bodyPivot.position.y, targetY, w);
    }
    blendEuler(rig.legL, getPoseAnglesByAliases(bones, ['LeftUpperLeg', 'leftUpperLeg']));
    blendEuler(rig.legR, getPoseAnglesByAliases(bones, ['RightUpperLeg', 'rightUpperLeg']));
  }

  blendEuler(rig.spinePivot, getPoseAnglesByAliases(bones, ['Spine', 'spine', 'Chest', 'chest']));
  blendEuler(rig.head, getPoseAnglesByAliases(bones, ['Head', 'head']));
  blendEuler(rig.armL, getPoseAnglesByAliases(bones, ['LeftUpperArm', 'leftUpperArm']));
  blendEuler(rig.forearmL, getPoseAnglesByAliases(bones, ['LeftLowerArm', 'leftLowerArm']));
  blendEuler(rig.armR, getPoseAnglesByAliases(bones, ['RightUpperArm', 'rightUpperArm']));
  blendEuler(rig.forearmR, getPoseAnglesByAliases(bones, ['RightLowerArm', 'rightLowerArm']));

  // Creature hybrid parts if present
  const cRefs = rig.group.userData?.creatureAnim as
    | { tail?: THREE.Group; wingL?: THREE.Group; wingR?: THREE.Group }
    | undefined;
  if (cRefs) {
    blendEuler(cRefs.tail, getPoseAnglesByAliases(bones, ['Tail', 'tail']));
    blendEuler(cRefs.wingL, getPoseAnglesByAliases(bones, ['LeftWing', 'leftWing']));
    blendEuler(cRefs.wingR, getPoseAnglesByAliases(bones, ['RightWing', 'rightWing']));
  }
}

/**
 * Applies a keyframe CustomMotionPreset pose onto a Procedural BaddieRig in Play Mode.
 */
export function applyMotionPresetToBaddieRigRuntime(
  rig: BaddieRig,
  preset: CustomMotionPreset,
  timeNorm: number,
  baseY: number,
  blend = 1
): void {
  const { bones, hipsOffsetY } = sampleMotionPresetToPose(preset, timeNorm);
  const w = THREE.MathUtils.clamp(blend, 0, 1);
  if (w <= 0.001) return;

  const blendRot = (obj: THREE.Object3D | undefined, keys: string[]) => {
    const a = getPoseAnglesByAliases(bones, keys);
    if (!obj || !a) return;
    obj.rotation.x = THREE.MathUtils.lerp(obj.rotation.x, THREE.MathUtils.degToRad(a[0]), w);
    obj.rotation.y = THREE.MathUtils.lerp(obj.rotation.y, THREE.MathUtils.degToRad(a[1]), w);
    obj.rotation.z = THREE.MathUtils.lerp(obj.rotation.z, THREE.MathUtils.degToRad(a[2]), w);
  };

  blendRot(rig.bodyPivot, ['Hips', 'hips', 'MonsterBodyPivot']);
  if (Math.abs(hipsOffsetY) > 0.0005) {
    rig.bodyPivot.position.y = THREE.MathUtils.lerp(rig.bodyPivot.position.y, Math.max(0.04, baseY + hipsOffsetY), w);
  }
  blendRot(rig.torso, ['Spine', 'spine', 'Chest', 'chest']);
  blendRot(rig.head, ['Head', 'head']);
  blendRot(rig.armL, ['LeftUpperArm', 'leftUpperArm']);
  blendRot(rig.armR, ['RightUpperArm', 'rightUpperArm']);
  blendRot(rig.wingL, ['LeftWing', 'leftWing', 'Wing_L_Inner']);
  blendRot(rig.wingR, ['RightWing', 'rightWing', 'Wing_R_Inner']);
}

export function presetHasLegTracks(preset: CustomMotionPreset): boolean {
  for (const kf of preset.keyframes) {
    for (const [bName, angles] of Object.entries(kf.bones)) {
      if (!/leg|hip|pelvis/i.test(bName)) continue;
      if (Math.abs(angles[0]) > 2 || Math.abs(angles[1]) > 2 || Math.abs(angles[2]) > 2) {
        return true;
      }
    }
    if (typeof kf.hipsOffsetY === 'number' && Math.abs(kf.hipsOffsetY) > 0.12) {
      return true;
    }
  }
  return false;
}

export function resolveLogicPlayAnimationTarget(opts: {
  detail: string;
  actorCategory: MotionActorCategory;
  project?: GameProject | null;
  entity?: LevelEntity | null;
  monsterBp?: MonsterBlueprint | null;
}): { slot: CustomClipSlot; preset: CustomMotionPreset | null } {
  const { detail, actorCategory, project, entity, monsterBp } = opts;
  const trimmed = detail.trim();
  const lower = trimmed.toLowerCase();
  const matchingSlotMeta = Object.values(MOTION_SLOT_META_BY_SLOT).find(
    (m) => m.slot.toLowerCase() === lower || m.label.toLowerCase() === lower
  );
  const slot: CustomClipSlot = matchingSlotMeta?.slot ?? 'interact';
  const preset = resolveMotionPresetForRuntime({
    slot,
    customAnimName: trimmed,
    actorCategory,
    project,
    entity,
    monsterBp,
  });
  return { slot, preset };
}

/**
 * Applies a keyframe CustomMotionPreset pose directly onto a QuadrupedMonsterRig in Play Mode.
 */
export function applyMotionPresetToQuadrupedRuntime(
  rig: QuadrupedMonsterRig,
  preset: CustomMotionPreset,
  timeNorm: number,
  blend = 1,
  dt = 0.016
): void {
  const { bones, hipsOffsetY } = sampleMotionPresetToPose(preset, timeNorm);
  const w = THREE.MathUtils.clamp(blend, 0, 1);
  if (w <= 0.001) return;

  const dampRate = Math.max(8, 22 * w);
  const dampBone = (obj: THREE.Object3D | undefined, keys: string[]) => {
    if (!obj) return;
    const a = getPoseAnglesByAliases(bones, keys);
    const tx = a ? THREE.MathUtils.degToRad(a[0]) : 0;
    const ty = a ? THREE.MathUtils.degToRad(a[1]) : 0;
    const tz = a ? THREE.MathUtils.degToRad(a[2]) : 0;
    obj.rotation.x = THREE.MathUtils.damp(obj.rotation.x, tx, dampRate, dt);
    obj.rotation.y = THREE.MathUtils.damp(obj.rotation.y, ty, dampRate, dt);
    obj.rotation.z = THREE.MathUtils.damp(obj.rotation.z, tz, dampRate, dt);
  };

  const baseBodyY =
    rig.groundClearance +
    Math.max(rig.blueprint.chest.midRadius, rig.blueprint.torso.midRadius) * 0.58;
  const targetY = Math.max(
    preset.slot === 'dying' ? 0.14 : 0.2,
    baseBodyY + hipsOffsetY
  );
  rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, targetY, dampRate, dt);
  dampBone(rig.bodyPivot, ['MonsterBodyPivot', 'Hips', 'hips']);
  dampBone(rig.chestBone, ['MonsterChest', 'Chest', 'chest']);
  dampBone(rig.torsoBone, ['MonsterTorso', 'Spine', 'spine']);
  dampBone(rig.spineBackPivot, ['MonsterHips']);

  for (const h of rig.heads) {
    const idx = h.headIndex;
    h.neckBones.forEach((nb, segIdx) => {
      dampBone(nb, [`MonsterNeck_${idx}_${segIdx}`, `MonsterNeck_0_${segIdx}`, 'Neck', 'neck']);
    });
    dampBone(h.headPivot, [`MonsterHead_${idx}`, 'MonsterHead_0', 'Head', 'head']);
    dampBone(h.jawPivot, [`MonsterJaw_${idx}`, 'MonsterJaw_0']);
  }

  for (const leg of rig.legs) {
    const s = leg.side < 0 ? 'L' : 'R';
    dampBone(leg.hipPivot, [`Leg_${leg.pairIndex}_${s}_Hip`]);
    dampBone(leg.kneePivot, [`Leg_${leg.pairIndex}_${s}_Knee`]);
    dampBone(leg.pawGroup, [`Leg_${leg.pairIndex}_${s}_Paw`]);
  }

  rig.tailSegments.forEach((seg, i) => {
    dampBone(seg, [`MonsterTail_${i}`, 'Tail', 'tail']);
  });

  if (rig.wingL) {
    const innerL = getPoseAnglesByAliases(bones, ['Wing_L_Inner', 'LeftWing']);
    const outerL = getPoseAnglesByAliases(bones, ['Wing_L_Outer']);
    const baseZ = rig.wingL.side * rig.wingL.baseLiftRad;
    const dzIn = innerL ? THREE.MathUtils.degToRad(innerL[2]) : 0;
    const dzOut = outerL ? THREE.MathUtils.degToRad(outerL[2]) : 0;
    rig.wingL.innerPivot.rotation.z = THREE.MathUtils.damp(rig.wingL.innerPivot.rotation.z, baseZ + dzIn, dampRate, dt);
    rig.wingL.outerPivot.rotation.z = THREE.MathUtils.damp(rig.wingL.outerPivot.rotation.z, -baseZ * 0.35 + dzOut, dampRate, dt);
  }
  if (rig.wingR) {
    const innerR = getPoseAnglesByAliases(bones, ['Wing_R_Inner', 'RightWing']);
    const outerR = getPoseAnglesByAliases(bones, ['Wing_R_Outer']);
    const baseZ = rig.wingR.side * rig.wingR.baseLiftRad;
    const dzIn = innerR ? THREE.MathUtils.degToRad(innerR[2]) : 0;
    const dzOut = outerR ? THREE.MathUtils.degToRad(outerR[2]) : 0;
    rig.wingR.innerPivot.rotation.z = THREE.MathUtils.damp(rig.wingR.innerPivot.rotation.z, baseZ + dzIn, dampRate, dt);
    rig.wingR.outerPivot.rotation.z = THREE.MathUtils.damp(rig.wingR.outerPivot.rotation.z, -baseZ * 0.35 + dzOut, dampRate, dt);
  }
}
