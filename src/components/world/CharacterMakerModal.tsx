import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  Bone,
  Camera,
  Check,
  ChevronDown,
  Dices,
  Download,
  Eye,
  FolderOpen,
  Hand,
  Layers,
  Paintbrush,
  Play,
  Plus,
  Redo2,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  User,
  Wand2,
  X,
  Pencil,
} from 'lucide-react';
import { CharacterSketchModal } from '../shared/CharacterSketchModal';
import {
  requestOpenContextualAiModal,
  useRegisterStudioAiBridge,
} from '../../ai/studioBridge';
import { sanitizeCharacterMakerResult } from '../../ai/aiAppliers';
import type { MakerStore } from '../../store/useMakerStore';
import {
  BEAK_PRESET_OPTIONS,
  buildAndExportCharacterDocToGlb,
  buildCharacterRigAndMesh,
  CHARACTER_PRESETS,
  createCharacterPresetDoc,
  createDefaultAddonConfig,
  createDefaultCharacterDoc,
  createDefaultHeadCrown,
  createDefaultHeadJaw,
  createDefaultSpikesConfig,
  createDefaultSurfaceCoat,
  createHairPresetConfig,
  createMuzzlePreset,
  getBeakPresetDefaults,
  MUZZLE_PRESET_OPTIONS,
  resolveCharacterExtras,
  type BuiltCharacterAsset,
} from '../../three/characterMakerBuilder';
import {
  BEARD_STYLE_OPTIONS,
  createBeardPresetConfig,
  createDefaultFacialHairConfig,
  createMustachePresetConfig,
  createSideburnsPresetConfig,
  FACIAL_HAIR_COMBO_PRESETS,
  MUSTACHE_STYLE_OPTIONS,
  SIDEBURNS_STYLE_OPTIONS,
  STUBBLE_STYLE_OPTIONS,
} from '../../three/facialHairBuilder';
import {
  createCharacterSegmentOverlay,
  type CharacterSegmentOverlayController,
} from '../../three/characterSegmentOverlay';
import {
  hasSavedCharacterSpeciesDefault,
  resetCharacterSpeciesDefault,
  saveCharacterSpeciesDefault,
  useDefaultCharacterPresetsVersion,
} from '../../utils/defaultCharacterPresets';
import {
  deleteCustomHairPreset,
  saveCustomHairPreset,
  useCustomHairPresets,
} from '../../utils/customHairPresets';
import { createMakerRenderer, detectSoftwareGl, disposeObject3D, setupSceneEnvironment } from '../../three/islandScene';
import { createDefaultRigSettings, inspectModelSkeleton, ProceduralRigController } from '../../three/proceduralRigAnimator';
import { isWebGPUFallbackAdapter } from '../../three/webglUtils';
import {
  applyVertexPaintStrokesToObject,
  generateOrganicDappleStroke,
  prepareObjectForVertexPainting,
  resetObjectVertexPaint,
  type VertexPaintBrushSettings,
} from '../../three/vertexPainter';
import { MakerVertexPaintSession } from '../../three/vertexPaintViewportHelper';
import { VertexPaintInspector } from './VertexPaintInspector';
import type {
  CharacterAddonConfig,
  CharacterBeakStyle,
  CharacterBeardConfig,
  CharacterBeardStyle,
  CharacterBodyGearStyle,
  CharacterBodyPartKey,
  CharacterEarStyle,
  CharacterEyebrowExpression,
  CharacterEyebrowSculptConfig,
  CharacterEyebrowSideConfig,
  CharacterEyePupilStyle,
  CharacterEyeSculptConfig,
  CharacterEyeSideConfig,
  CharacterEyewearStyle,
  CharacterFacialHairConfig,
  CharacterFootStyle,
  CharacterHairDetailStyle,
  CharacterHairLayoutMode,
  CharacterHairSculptConfig,
  CharacterHairSideConfig,
  CharacterHairStyle,
  CharacterHandStyle,
  CharacterHeadGearStyle,
  CharacterHeadSegmentProfile,
  CharacterHornStyle,
  CharacterLimbProfile,
  CharacterMakerDoc,
  CharacterMaterialFinish,
  CharacterMouthSculptConfig,
  CharacterMouthSideConfig,
  CharacterMouthStyle,
  CharacterMustacheConfig,
  CharacterMustacheSideConfig,
  CharacterMustacheStyle,
  CharacterMuzzleConfig,
  CharacterMuzzlePresetId,
  CharacterMuzzleSegment,
  CharacterNoseStyle,
  CharacterNostrilStyle,
  CharacterPresetId,
  CharacterSideburnsConfig,
  CharacterSideburnsStyle,
  CharacterSpikesConfig,
  CharacterSpikesStyle,
  CharacterSpikesZone,
  CharacterStubbleConfig,
  CharacterStubbleStyle,
  CharacterSurfaceCoatConfig,
  CharacterSurfaceCoatMode,
  CharacterTailStyle,
  CharacterTeethStyle,
  CharacterWingStyle,
  CustomAssetMeta,
  CustomClipSlot,
  VertexPaintStroke,
} from '../../types/maker';
import { AssetThumbnail } from '../shared/AssetThumbnail';

export interface CharacterMakerModalProps {
  store: MakerStore;
  initialAssetId?: string | null;
  onClose: () => void;
}

type InspectorTab = 'body' | 'limbs' | 'coat' | 'extras' | 'eyes' | 'paint';
type PreviewAnimMode = 'rest' | CustomClipSlot;
type CameraPreset = 'fullBody' | 'face' | 'side' | 'back';

const BODY_PART_ITEMS: { key: CharacterBodyPartKey; label: string; group: string }[] = [
  { key: 'head', label: 'Head (Main Skull)', group: 'Core' },
  { key: 'headCrown', label: 'Head Crown / Brow', group: 'Core' },
  { key: 'headJaw', label: 'Head Jaw / Chin', group: 'Core' },
  { key: 'muzzle', label: 'Muzzle (5-Seg)', group: 'Core' },
  { key: 'neck', label: 'Neck', group: 'Core' },
  { key: 'torso', label: 'Chest / Torso', group: 'Core' },
  { key: 'belly', label: 'Belly / Waist', group: 'Core' },
  { key: 'hips', label: 'Hips / Pelvis', group: 'Core' },
  { key: 'upperArm', label: 'Upper Arm', group: 'Limbs' },
  { key: 'lowerArm', label: 'Forearm', group: 'Limbs' },
  { key: 'upperLeg', label: 'Upper Leg / Thigh', group: 'Limbs' },
  { key: 'lowerLeg', label: 'Lower Leg / Shin', group: 'Limbs' },
  { key: 'tail', label: 'Tail', group: 'Extra' },
  { key: 'extraArm', label: 'Extra Arms', group: 'Extra' },
  { key: 'extraLeg', label: 'Extra Legs', group: 'Extra' },
];

const HAND_OPTIONS: { id: CharacterHandStyle; label: string }[] = [
  { id: 'fingers5', label: '5 Fingers + Thumb' },
  { id: 'fingers4', label: '4 Fingers + Thumb' },
  { id: 'fingers3', label: '3 Fingers + Thumb' },
  { id: 'fingers2', label: '2 Fingers + Thumb' },
  { id: 'paw', label: 'Rounded Paw' },
  { id: 'claw', label: 'Sharp Claws' },
  { id: 'hoof', label: 'Hoof' },
  { id: 'nub', label: 'Clay Nub' },
];

const FOOT_OPTIONS: { id: CharacterFootStyle; label: string }[] = [
  { id: 'biped', label: 'Biped Foot' },
  { id: 'paw', label: 'Creature Paw' },
  { id: 'claw', label: 'Clawed Talons' },
  { id: 'hoof', label: 'Hoofs' },
];

const EAR_OPTIONS: { id: CharacterEarStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'rabbitLong', label: 'Rabbit Long' },
  { id: 'rabbitFloppy', label: 'Rabbit Floppy' },
  { id: 'squirrelRound', label: 'Squirrel Round' },
  { id: 'catFoxTriangle', label: 'Fox / Cat Point' },
  { id: 'dogFloppy', label: 'Dog Floppy' },
  { id: 'horsePerked', label: 'Horse Perked' },
  { id: 'human', label: 'Human' },
  { id: 'elfPointed', label: 'Elf Pointed' },
  { id: 'animalPerk', label: 'Animal Perk' },
  { id: 'floppy', label: 'Floppy Hound' },
  { id: 'bat', label: 'Bat Scallop' },
  { id: 'fin', label: 'Aquatic Fin' },
  { id: 'antennae', label: 'Antennae' },
];

const HORN_OPTIONS: { id: CharacterHornStyle; label: string }[] = [
  { id: 'straight', label: 'Straight' },
  { id: 'curvedBack', label: 'Swept Back' },
  { id: 'ramSpiral', label: 'Ram Spiral' },
  { id: 'devilSweep', label: 'Devil Curve' },
  { id: 'antler', label: 'Antler Branch' },
];

const WING_OPTIONS: { id: CharacterWingStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'birdRound', label: 'Bird Round' },
  { id: 'birdSoaring', label: 'Bird Soaring' },
  { id: 'birdLong', label: 'Bird Long' },
  { id: 'dragon', label: 'Dragon' },
  { id: 'bat', label: 'Bat Wings' },
  { id: 'feather', label: 'Feathered' },
  { id: 'fairy', label: 'Fairy' },
  { id: 'fairyButterfly', label: 'Butterfly' },
  { id: 'angelFeather', label: 'Angel Feather' },
];

const TAIL_OPTIONS: { id: CharacterTailStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'bunnyCotton', label: 'Bunny Cotton' },
  { id: 'squirrelPlume', label: 'Squirrel Plume' },
  { id: 'horseTail', label: 'Horse Tail' },
  { id: 'catTail', label: 'Cat Tail' },
  { id: 'dogTail', label: 'Dog Tail' },
  { id: 'foxBrush', label: 'Fox Brush' },
  { id: 'lionTail', label: 'Lion Tuft' },
  { id: 'geckoTail', label: 'Gecko Coiled' },
  { id: 'dragonTail', label: 'Dragon Tail' },
  { id: 'fishTail', label: 'Fish Tail' },
  { id: 'birdTail', label: 'Bird Tail' },
  { id: 'smooth', label: 'Smooth Taper' },
  { id: 'bulbTip', label: 'Bulb Tip' },
  { id: 'spiky', label: 'Spiky Ridge' },
  { id: 'fluffy', label: 'Fluffy Plume' },
  { id: 'fin', label: 'Fin Tail' },
];

const HAIR_OPTIONS: {
  id: CharacterHairStyle;
  label: string;
  group: 'male' | 'female' | 'creature';
}[] = [
  // Male / Unisex
  { id: 'shortCrop', label: 'Short Crop', group: 'male' },
  { id: 'sidePart', label: 'Side Part', group: 'male' },
  { id: 'pompadour', label: 'Pompadour', group: 'male' },
  { id: 'messySpiky', label: 'Messy Spiky', group: 'male' },
  { id: 'undercut', label: 'Undercut', group: 'male' },
  { id: 'buzzFade', label: 'Buzz Fade', group: 'male' },
  { id: 'surferCurtains', label: 'Surfer Part', group: 'male' },
  // Female / Long
  { id: 'longStraight', label: 'Long Straight', group: 'female' },
  { id: 'longEndCurls', label: 'Long End Curls', group: 'female' },
  { id: 'bobCut', label: 'Classic Bob', group: 'female' },
  { id: 'bobFlip', label: 'Flipped Bob Curls', group: 'female' },
  { id: 'wavyShoulder', label: 'Wavy Shoulder', group: 'female' },
  { id: 'twinPigtails', label: 'Twin Pigtails', group: 'female' },
  { id: 'highBun', label: 'High Bun', group: 'female' },
  { id: 'braidedCrown', label: 'Braided Crown', group: 'female' },
  { id: 'ponytail', label: 'Ponytail', group: 'female' },
  { id: 'curlyAfro', label: 'Curly Afro', group: 'female' },
  // Creature & Stylized
  { id: 'spikyTufts', label: 'Spiky Tufts', group: 'creature' },
  { id: 'mohawk', label: 'Crest / Mohawk', group: 'creature' },
  { id: 'curlSwirl', label: 'Curl Swirl', group: 'creature' },
  { id: 'mushroomCap', label: 'Cap Dome', group: 'creature' },
  { id: 'horseMane', label: 'Horse Mane', group: 'creature' },
  { id: 'lionMane', label: 'Lion Mane', group: 'creature' },
  { id: 'featherTuft', label: 'Feather Tuft', group: 'creature' },
  { id: 'fluffyBangs', label: 'Fluffy Bangs', group: 'creature' },
];

const SURFACE_COAT_OPTIONS: { id: CharacterSurfaceCoatMode; label: string; desc: string }[] = [
  { id: 'none', label: 'Smooth / None', desc: 'Clean base surface' },
  { id: 'furShort', label: 'Short Fur', desc: 'Plush micro-tufts' },
  { id: 'furLong', label: 'Long Shaggy Fur', desc: 'Layered flowing pelage' },
  { id: 'furClumped', label: 'Clumped Fur', desc: 'Chunky stylized locks' },
  { id: 'scalesFish', label: 'Fish Scales', desc: 'Overlapping rounded shingles' },
  { id: 'scalesDragon', label: 'Dragon Scales', desc: 'Pointed armored scutes' },
  { id: 'scalesHex', label: 'Hex Reptile', desc: 'Crisp hex plate pattern' },
];

const SPIKES_STYLE_OPTIONS: { id: CharacterSpikesStyle; label: string }[] = [
  { id: 'porcupineQuills', label: 'Porcupine Quills' },
  { id: 'boneSpikes', label: 'Monster Spikes' },
  { id: 'dorsalFins', label: 'Dorsal Fins' },
  { id: 'crystalSpines', label: 'Crystal Spines' },
];

const SPIKES_ZONE_OPTIONS: { id: CharacterSpikesZone; label: string }[] = [
  { id: 'spine', label: 'Spine Ridge' },
  { id: 'headAndBack', label: 'Head & Back' },
  { id: 'shouldersAndBack', label: 'Shoulders & Back' },
  { id: 'fullBody', label: 'Full Body' },
];

const EYEWEAR_OPTIONS: { id: CharacterEyewearStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'roundGlasses', label: 'Round Glasses' },
  { id: 'goggles', label: 'Pilot Goggles' },
  { id: 'cyberVisor', label: 'Cyber Visor' },
  { id: 'monocle', label: 'Monocle' },
];

const HEADGEAR_OPTIONS: { id: CharacterHeadGearStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'adventurerCap', label: 'Adventurer Cap' },
  { id: 'wizardHat', label: 'Wizard Hat' },
  { id: 'crown', label: 'Royal Crown' },
  { id: 'halo', label: 'Angel Halo' },
  { id: 'flowerCrown', label: 'Flower Crown' },
];

const BODYGEAR_OPTIONS: { id: CharacterBodyGearStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'backpack', label: 'Backpack' },
  { id: 'quiver', label: 'Arrow Quiver' },
  { id: 'cape', label: 'Hero Cape' },
  { id: 'scarf', label: 'Cozy Scarf' },
  { id: 'pauldrons', label: 'Armor Pauldrons' },
];

const PUPIL_OPTIONS: { id: CharacterEyePupilStyle; label: string }[] = [
  { id: 'round', label: 'Round' },
  { id: 'oval', label: 'Oval' },
  { id: 'catSlit', label: 'Cat Slit' },
  { id: 'starry', label: 'Starry Spark' },
  { id: 'glow', label: 'Glowing' },
];

const BROW_EXPR_OPTIONS: { id: CharacterEyebrowExpression; label: string }[] = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'determined', label: 'Fierce' },
  { id: 'surprised', label: 'Surprised' },
  { id: 'sly', label: 'Sly' },
];

const MOUTH_OPTIONS: { id: CharacterMouthStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'openSmile', label: 'Open D-Smile' },
  { id: 'openGrin', label: 'Open Wide Grin' },
  { id: 'openSurprised', label: 'Open Surprised' },
  { id: 'openWorried', label: 'Open Worried' },
  { id: 'smile', label: 'Smile Line' },
  { id: 'smirk', label: 'Smirk' },
  { id: 'frown', label: 'Frown' },
  { id: 'catW', label: 'Cat / Bunny :3' },
  { id: 'fangs', label: 'Fangs' },
];

const NOSE_OPTIONS: { id: CharacterNoseStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'buttonSphere', label: 'Button Sphere' },
  { id: 'oval', label: 'Oval' },
  { id: 'flatButton', label: 'Flat Button' },
  { id: 'longHuman', label: 'Long Nose' },
  { id: 'bulbous', label: 'Bulbous' },
  { id: 'triangleAnimal', label: 'Animal Nose' },
  { id: 'wideSnoutNose', label: 'Wide Snout Pad' },
];

const NOSTRIL_STYLE_OPTIONS: { id: CharacterNostrilStyle; label: string }[] = [
  { id: 'teardrop', label: 'Teardrop' },
  { id: 'round', label: 'Round' },
  { id: 'slit', label: 'Slit' },
];

const TEETH_OPTIONS: { id: CharacterTeethStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'strips', label: 'Tooth Strips' },
  { id: 'canine', label: 'Canine Fangs' },
  { id: 'buck', label: 'Buck Teeth' },
  { id: 'stripsAndCanine', label: 'Strips + Fangs' },
];

const MUZZLE_SEGMENT_LABELS = [
  '1 · Root Base',
  '2 · Upper Bridge',
  '3 · Mid Bridge',
  '4 · Pre-Tip Flare',
  '5 · Lip / Nose Tip',
] as const;

const ANIM_OPTIONS: { id: PreviewAnimMode; label: string }[] = [
  { id: 'rest', label: 'Bind Pose' },
  { id: 'idle', label: 'Idle' },
  { id: 'walk', label: 'Walk' },
  { id: 'run', label: 'Run' },
  { id: 'jump', label: 'Jump' },
  { id: 'interact', label: 'Wave' },
  { id: 'attack', label: 'Action' },
];

const COLOR_SWATCHES = [
  '#F3C7A4', '#F6D6BA', '#C68642', '#7C4D33',
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#A855F7', '#EC4899', '#2DD4BF', '#334155',
  '#E5E7EB', '#1F2937',
];

function isOpenMouthStyle(style: CharacterMouthStyle): boolean {
  return (
    style === 'openSmile' ||
    style === 'openGrin' ||
    style === 'openSurprised' ||
    style === 'openWorried'
  );
}

function getLimbProfile(doc: CharacterMakerDoc, key: CharacterBodyPartKey): CharacterLimbProfile {
  switch (key) {
    case 'head': return doc.head;
    case 'headCrown': return doc.headCrown ?? createDefaultHeadCrown(doc.head);
    case 'headJaw': return doc.headJaw ?? createDefaultHeadJaw(doc.head);
    case 'neck': return doc.neck;
    case 'torso': return doc.torso;
    case 'belly': return doc.belly;
    case 'hips': return doc.hips;
    case 'muzzle': {
      const m = resolveCharacterExtras(doc).muzzle;
      return {
        startRadius: m.segments[0].rx,
        midRadius: m.segments[2].rx,
        endRadius: m.segments[4].rx,
        curvature: 0,
        length: Math.max(0.02, m.length),
        color: m.color,
      };
    }
    case 'upperArm': return doc.upperArm;
    case 'lowerArm': return doc.lowerArm;
    case 'upperLeg': return doc.upperLeg;
    case 'lowerLeg': return doc.lowerLeg;
    case 'tail': return doc.tailProfile;
    case 'extraArm': return doc.extraArmProfile;
    case 'extraLeg': return doc.extraLegProfile;
  }
}

function setLimbProfile(
  doc: CharacterMakerDoc,
  key: CharacterBodyPartKey,
  updater: (prev: CharacterLimbProfile) => CharacterLimbProfile
): CharacterMakerDoc {
  switch (key) {
    case 'head': return { ...doc, head: updater(doc.head) };
    case 'headCrown': {
      const cur = doc.headCrown ?? createDefaultHeadCrown(doc.head);
      const next = updater(cur);
      return { ...doc, headCrown: { ...cur, ...next } };
    }
    case 'headJaw': {
      const cur = doc.headJaw ?? createDefaultHeadJaw(doc.head);
      const next = updater(cur);
      return { ...doc, headJaw: { ...cur, ...next } };
    }
    case 'neck': return { ...doc, neck: updater(doc.neck) };
    case 'torso': return { ...doc, torso: updater(doc.torso) };
    case 'belly': return { ...doc, belly: updater(doc.belly) };
    case 'hips': return { ...doc, hips: updater(doc.hips) };
    case 'muzzle': return doc;
    case 'upperArm': return { ...doc, upperArm: updater(doc.upperArm) };
    case 'lowerArm': return { ...doc, lowerArm: updater(doc.lowerArm) };
    case 'upperLeg': return { ...doc, upperLeg: updater(doc.upperLeg) };
    case 'lowerLeg': return { ...doc, lowerLeg: updater(doc.lowerLeg) };
    case 'tail': return { ...doc, tailProfile: updater(doc.tailProfile) };
    case 'extraArm': return { ...doc, extraArmProfile: updater(doc.extraArmProfile) };
    case 'extraLeg': return { ...doc, extraLegProfile: updater(doc.extraLegProfile) };
  }
}

function updateHeadSegment(
  doc: CharacterMakerDoc,
  key: 'headCrown' | 'headJaw',
  patch: Partial<CharacterHeadSegmentProfile>
): CharacterMakerDoc {
  if (key === 'headCrown') {
    const cur = doc.headCrown ?? createDefaultHeadCrown(doc.head);
    return { ...doc, headCrown: { ...cur, ...patch } };
  }
  const cur = doc.headJaw ?? createDefaultHeadJaw(doc.head);
  return { ...doc, headJaw: { ...cur, ...patch } };
}

function ProfileCurvePreview({ profile }: { profile: CharacterLimbProfile }) {
  const pts: string[] = [];
  const topPts: string[] = [];
  const botPts: string[] = [];
  const maxR = Math.max(0.05, profile.startRadius, profile.midRadius, profile.endRadius) * 1.3;
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const half = t <= 0.5;
    const u = half ? t * 2 : (t - 0.5) * 2;
    const ra = half ? profile.startRadius : profile.midRadius;
    const rb = half ? profile.midRadius : profile.endRadius;
    const smooth = 0.5 - 0.5 * Math.cos(u * Math.PI);
    const bow = profile.curvature * Math.sin(u * Math.PI) * 0.22 * ((ra + rb) * 0.5);
    const rad = Math.max(0.004, ra + (rb - ra) * smooth + bow);
    const x = 6 + t * 148;
    const halfH = (rad / maxR) * 16;
    topPts.push(`${x.toFixed(1)},${(22 - halfH).toFixed(1)}`);
    botPts.unshift(`${x.toFixed(1)},${(22 + halfH).toFixed(1)}`);
  }
  pts.push(...topPts, ...botPts);
  return (
    <svg viewBox="0 0 160 44" className="w-full h-11 rounded-xl bg-slate-900/75 border border-white/10">
      <line x1="6" y1="22" x2="154" y2="22" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 3" />
      <polygon points={pts.join(' ')} fill={profile.color} fillOpacity="0.32" stroke={profile.color} strokeWidth="1.8" />
    </svg>
  );
}

function MuzzleProfilePreview({ muzzle }: { muzzle: CharacterMuzzleConfig }) {
  const maxR = Math.max(
    0.04,
    ...muzzle.segments.map((s) => Math.max(s.rx, s.ry))
  ) * 1.25;
  const sideTop: string[] = [];
  const sideBot: string[] = [];
  const widthPts: string[] = [];
  muzzle.segments.forEach((seg, idx) => {
    const x = 14 + (idx / 4) * 132;
    const hy = (seg.ry / maxR) * 16;
    const wx = (seg.rx / maxR) * 16;
    sideTop.push(`${x.toFixed(1)},${(24 - hy).toFixed(1)}`);
    sideBot.unshift(`${x.toFixed(1)},${(24 + hy).toFixed(1)}`);
    widthPts.push(`${x.toFixed(1)},${(24 - wx).toFixed(1)}`);
  });
  return (
    <svg viewBox="0 0 160 48" className="w-full h-12 rounded-xl bg-slate-900/75 border border-white/10">
      <line x1="10" y1="24" x2="150" y2="24" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 3" />
      <polygon
        points={[...sideTop, ...sideBot].join(' ')}
        fill={muzzle.color}
        fillOpacity="0.32"
        stroke={muzzle.color}
        strokeWidth="1.8"
      />
      <polyline points={widthPts.join(' ')} fill="none" stroke="rgba(255,255,255,0.45)" strokeDasharray="2 2" strokeWidth="1.2" />
      {muzzle.segments.map((_, idx) => {
        const x = 14 + (idx / 4) * 132;
        return <circle key={idx} cx={x} cy={24} r={2} fill="#7C5CFF" />;
      })}
    </svg>
  );
}

export const CharacterMakerModal: React.FC<CharacterMakerModalProps> = ({
  store,
  initialAssetId = null,
  onClose,
}) => {
  const [editingAssetId, setEditingAssetId] = useState<string | null>(initialAssetId);
  const [charName, setCharName] = useState<string>('Standard Humanoid');
  const [doc, setDoc] = useState<CharacterMakerDoc>(() => createCharacterPresetDoc('standardHumanoid'));
  const [showingSketchModal, setShowingSketchModal] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<CharacterMakerDoc[]>([]);
  const [redoStack, setRedoStack] = useState<CharacterMakerDoc[]>([]);

  const [activePart, setActivePart] = useState<CharacterBodyPartKey>('upperLeg');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('body');
  const customHairPresets = useCustomHairPresets();
  const [hairEditSide, setHairEditSide] = useState<'both' | 'left' | 'right'>('both');
  const [facialHairSubTab, setFacialHairSubTab] = useState<'mustache' | 'beard' | 'sideburns' | 'stubble'>('mustache');
  const [mustacheEditSide, setMustacheEditSide] = useState<'both' | 'left' | 'right'>('both');
  const [eyeEditSide, setEyeEditSide] = useState<'both' | 'left' | 'right'>('both');
  const [eyebrowEditSide, setEyebrowEditSide] = useState<'both' | 'left' | 'right'>('both');
  const [mouthEditSide, setMouthEditSide] = useState<'both' | 'left' | 'right'>('both');
  const [saveHairOpen, setSaveHairOpen] = useState(false);
  const [customHairName, setCustomHairName] = useState('');
  const [animMode, setAnimMode] = useState<PreviewAnimMode>('idle');
  const [paintStrokes, setPaintStrokes] = useState<VertexPaintStroke[]>(
    () => (doc.vertexPaintStrokes ? JSON.parse(JSON.stringify(doc.vertexPaintStrokes)) : [])
  );
  const [paintRedoStack, setPaintRedoStack] = useState<VertexPaintStroke[]>([]);
  const [paintTool, setPaintTool] = useState<'paint' | 'orbit'>('paint');
  const [spaceOrbiting, setSpaceOrbiting] = useState(false);
  const [paintBrush, setPaintBrush] = useState<VertexPaintBrushSettings>({
    mode: 'paint',
    target: 'all',
    radius: 0.22,
    opacity: 0.72,
    softness: 0.45,
    color: '#7C5CFF',
    hueShift: 0,
    saturationShift: 0,
    valueShift: 0,
    hueJitter: 18,
  });
  const paintStrokesRef = useRef<VertexPaintStroke[]>(paintStrokes);
  paintStrokesRef.current = paintStrokes;

  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showPartHighlights, setShowPartHighlights] = useState(true);
  const [crispResMode, setCrispResMode] = useState(true);
  const [isSliderActive, setIsSliderActive] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset | null>('fullBody');
  const [cameraNonce, setCameraNonce] = useState(0);
  const initialCamAppliedRef = useRef(false);
  const pendingFocusPartRef = useRef<CharacterBodyPartKey | null>(null);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [meshStats, setMeshStats] = useState<{ verts: number; tris: number; bones: number }>({
    verts: 0,
    tris: 0,
    bones: 0,
  });

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const savedCharacters = useMemo(
    () => store.customAssets.filter((a) => a.category === 'character'),
    [store.customAssets]
  );

  const loadExistingCharacter = useCallback(
    (asset: CustomAssetMeta) => {
      setEditingAssetId(asset.id);
      setCharName(asset.name);
      setUndoStack([]);
      setRedoStack([]);
      setShowLoadMenu(false);
      setHairEditSide('both');
      setMustacheEditSide('both');
      setEyeEditSide('both');
      setEyebrowEditSide('both');
      setMouthEditSide('both');
      if (asset.characterRecipe) {
        const cloned = JSON.parse(JSON.stringify(asset.characterRecipe)) as CharacterMakerDoc;
        setDoc(cloned);
        const loadedStrokes = asset.vertexPaintStrokes ?? cloned.vertexPaintStrokes ?? [];
        setPaintStrokes(JSON.parse(JSON.stringify(loadedStrokes)) as VertexPaintStroke[]);
        setPaintRedoStack([]);
        flashToast(`Loaded "${asset.name}" into Character Maker`);
      } else {
        setPaintStrokes(
          asset.vertexPaintStrokes ? (JSON.parse(JSON.stringify(asset.vertexPaintStrokes)) as VertexPaintStroke[]) : []
        );
        setPaintRedoStack([]);
        flashToast(`"${asset.name}" is an imported GLB — save creates a new Character Maker rig`);
      }
    },
    [flashToast]
  );

  useEffect(() => {
    if (!initialAssetId) return;
    const found = store.customAssets.find((a) => a.id === initialAssetId);
    if (found) {
      loadExistingCharacter(found);
    }
  }, [initialAssetId]);

  const updateDoc = useCallback(
    (updater: (prev: CharacterMakerDoc) => CharacterMakerDoc, recordHistory = false) => {
      setDoc((prev) => {
        if (recordHistory) {
          setUndoStack((h) => [...h.slice(-24), JSON.parse(JSON.stringify(prev)) as CharacterMakerDoc]);
          setRedoStack([]);
        }
        return updater(prev);
      });
    },
    []
  );

  const handleUndo = () => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [JSON.parse(JSON.stringify(doc)) as CharacterMakerDoc, ...r.slice(0, 24)]);
      setDoc(last);
      return prev.slice(0, -1);
    });
  };

  const handleRedo = () => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setUndoStack((u) => [...u, JSON.parse(JSON.stringify(doc)) as CharacterMakerDoc]);
      setDoc(next);
      return prev.slice(1);
    });
  };

  const speciesDefaultsVersion = useDefaultCharacterPresetsVersion();
  const activeSpeciesId: CharacterPresetId = doc.presetId ?? 'standardHumanoid';
  const activeSpeciesInfo = CHARACTER_PRESETS.find((p) => p.id === activeSpeciesId) ?? CHARACTER_PRESETS[0];
  const hasCustomSpeciesDefault = hasSavedCharacterSpeciesDefault(activeSpeciesId);

  const applyPreset = (presetId: CharacterPresetId) => {
    const info = CHARACTER_PRESETS.find((p) => p.id === presetId);
    const next = createCharacterPresetDoc(presetId);
    const wasCustomized = hasSavedCharacterSpeciesDefault(presetId);
    setHairEditSide('both');
    setMustacheEditSide('both');
    setEyeEditSide('both');
    setEyebrowEditSide('both');
    setMouthEditSide('both');
    updateDoc(() => next, true);
    setPaintStrokes(
      Array.isArray(next.vertexPaintStrokes)
        ? (JSON.parse(JSON.stringify(next.vertexPaintStrokes)) as VertexPaintStroke[])
        : []
    );
    setPaintRedoStack([]);
    if (info) setCharName(info.name);
    flashToast(
      wasCustomized
        ? `Loaded your saved "${info?.name ?? presetId}" species default`
        : `Loaded "${info?.name ?? presetId}" preset`
    );
  };

  const handleSaveAsSpeciesDefault = () => {
    const strokesToSave = paintStrokes.length > 0 ? paintStrokes : undefined;
    const docToSave: CharacterMakerDoc = {
      ...doc,
      presetId: activeSpeciesId,
      vertexPaintStrokes: strokesToSave,
    };
    saveCharacterSpeciesDefault(activeSpeciesId, docToSave, charName);
    flashToast(`Saved as "${activeSpeciesInfo.name}" species default in dropdown!`);
  };

  const handleResetSpeciesDefault = () => {
    resetCharacterSpeciesDefault(activeSpeciesId);
    const factory = activeSpeciesInfo.build();
    updateDoc(() => factory, true);
    setPaintStrokes([]);
    setPaintRedoStack([]);
    flashToast(`Reset "${activeSpeciesInfo.name}" back to factory preset`);
  };

  const randomizeCharacter = () => {
    const presetPool = CHARACTER_PRESETS;
    const pick = presetPool[Math.floor(Math.random() * presetPool.length)].build();
    const hues = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#7C5CFF', '#EF4444', '#14B8A6', '#D97706', '#C084FC'];
    const cMain = hues[Math.floor(Math.random() * hues.length)];
    const cAcc = hues[Math.floor(Math.random() * hues.length)];
    const earList: CharacterEarStyle[] = [
      'rabbitLong', 'rabbitFloppy', 'squirrelRound', 'catFoxTriangle',
      'dogFloppy', 'horsePerked', 'human', 'elfPointed', 'animalPerk', 'bat', 'antennae',
    ];
    const handList: CharacterHandStyle[] = ['fingers5', 'fingers4', 'fingers3', 'paw', 'claw', 'hoof'];
    const tailList: CharacterTailStyle[] = [
      'none', 'bunnyCotton', 'squirrelPlume', 'horseTail', 'catTail',
      'foxBrush', 'lionTail', 'geckoTail', 'dragonTail', 'birdTail', 'bulbTip', 'fluffy',
    ];
    setPaintStrokes([]);
    setPaintRedoStack([]);
    updateDoc(
      () => ({
        ...pick,
        blendSmoothness: Number((0.052 + Math.random() * 0.048).toFixed(3)),
        torso: { ...pick.torso, color: cMain },
        belly: { ...pick.belly, color: cAcc },
        tailStyle: tailList[Math.floor(Math.random() * tailList.length)],
        earStyle: earList[Math.floor(Math.random() * earList.length)],
        handStyle: handList[Math.floor(Math.random() * handList.length)],
        eyeFlatness: Number((0.28 + Math.random() * 0.72).toFixed(2)),
        hornCount: Math.random() < 0.25 ? 2 : 0,
      }),
      true
    );
  };

  // ---------------------------------------------------------------------------
  // LIVE 3D CHARACTER RIG + SDF VIEWPORT
  // ---------------------------------------------------------------------------
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const studioRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: WebGPURenderer;
    controls: OrbitControls;
    charHolder: THREE.Group;
    built: BuiltCharacterAsset | null;
    rigController: ProceduralRigController | null;
    skeletonHelper: THREE.SkeletonHelper | null;
    segmentOverlay: CharacterSegmentOverlayController | null;
    manualBlinkTimer: number;
    blinkLoopTimer: number;
    paintSession: MakerVertexPaintSession;
    paintableMeshes: THREE.Mesh[];
    cameraFocusAnim: { targetPos: THREE.Vector3; targetLook: THREE.Vector3 } | null;
  } | null>(null);

  const latestRef = useRef({
    animMode,
    showSkeleton,
    activePart,
    showPartHighlights,
    autoBlink: doc.autoBlink,
    inspectorTab,
    paintTool,
    spaceOrbiting,
    paintBrush,
    showingSketchModal,
  });
  latestRef.current = {
    animMode,
    showSkeleton,
    activePart,
    showPartHighlights,
    autoBlink: doc.autoBlink,
    inspectorTab,
    paintTool,
    spaceOrbiting,
    paintBrush,
    showingSketchModal,
  };

  const triggerManualBlink = useCallback(() => {
    const st = studioRef.current;
    if (st) {
      st.manualBlinkTimer = 0.001;
    }
  }, []);

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = container.clientWidth || 820;
    const height = container.clientHeight || 600;

    let renderer = createMakerRenderer(isSoftwareGl);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#131622');
    let envTex: THREE.Texture | null = null;

    const camera = new THREE.PerspectiveCamera(40, width / Math.max(1, height), 0.05, 120);
    camera.position.set(1.65, 1.35, 2.75);

    const hemi = new THREE.HemisphereLight('#F4F6FF', '#27293D', 0.95);
    const key = new THREE.DirectionalLight('#FFF7E8', 1.85);
    key.position.set(4.5, 7.5, 5.5);
    key.castShadow = !isSoftwareGl;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    const rim = new THREE.DirectionalLight('#93C5FD', 0.72);
    rim.position.set(-4, 3.5, -4);
    scene.add(hemi, key, rim);

    // Sculpting turntable pedestal
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.05, 0.08, 48),
      new THREE.MeshStandardMaterial({ color: '#1D2233', roughness: 0.78, metalness: 0.08 })
    );
    plinth.position.y = -0.04;
    plinth.receiveShadow = true;
    scene.add(plinth);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.96, 0.012, 10, 64),
      new THREE.MeshBasicMaterial({ color: '#7C5CFF', transparent: true, opacity: 0.48 })
    );
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = 0.002;
    scene.add(ring);

    const grid = new THREE.GridHelper(6, 12, '#31374F', '#202537');
    grid.position.y = -0.002;
    scene.add(grid);

    const charHolder = new THREE.Group();
    scene.add(charHolder);

    const createControls = (domEl: HTMLElement) => {
      domEl.style.touchAction = 'none';
      const c = new OrbitControls(camera, domEl);
      c.target.set(0, 0.78, 0);
      c.enableDamping = !isSoftwareGl;
      c.dampingFactor = 0.08;
      c.minDistance = 0.35;
      c.maxDistance = 12;
      c.maxPolarAngle = Math.PI * 0.54;
      c.update();
      return c;
    };
    let controls = createControls(renderer.domElement);
    const paintSession = new MakerVertexPaintSession(scene);

    const state = {
      scene,
      camera,
      renderer,
      controls,
      charHolder,
      built: null as BuiltCharacterAsset | null,
      rigController: null as ProceduralRigController | null,
      skeletonHelper: null as THREE.SkeletonHelper | null,
      segmentOverlay: null as CharacterSegmentOverlayController | null,
      manualBlinkTimer: 0,
      blinkLoopTimer: 2.2,
      paintSession,
      paintableMeshes: [] as THREE.Mesh[],
      cameraFocusAnim: null as { targetPos: THREE.Vector3; targetLook: THREE.Vector3 } | null,
    };
    controls.addEventListener('start', () => {
      state.cameraFocusAnim = null;
    });
    studioRef.current = state;

    const onPointerDown = (e: PointerEvent) => {
      const cur = latestRef.current;
      const isPaintingNow =
        cur.inspectorTab === 'paint' && cur.paintTool === 'paint' && !cur.spaceOrbiting;
      if (!isPaintingNow || e.button !== 0 || !state.built?.root) return;
      const started = state.paintSession.handlePointerDown({
        event: e,
        domEl: state.renderer.domElement,
        camera,
        paintRoot: state.built.root,
        paintableMeshes: state.paintableMeshes,
        brush: cur.paintBrush,
      });
      if (started) {
        e.stopPropagation();
      }
    };

    const onPointerHoverCursor = (e: PointerEvent) => {
      const cur = latestRef.current;
      const isPaintingNow =
        cur.inspectorTab === 'paint' && cur.paintTool === 'paint' && !cur.spaceOrbiting;
      if (isPaintingNow && state.built?.root && !state.paintSession.brushing) {
        state.paintSession.updateHoverCursor({
          event: e,
          domEl: state.renderer.domElement,
          camera,
          paintRoot: state.built.root,
          paintableMeshes: state.paintableMeshes,
          brush: cur.paintBrush,
        });
      } else if (!state.paintSession.brushing) {
        state.paintSession.hideCursor();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const cur = latestRef.current;
      if (cur.inspectorTab === 'paint' && cur.paintTool === 'paint' && !cur.spaceOrbiting && state.built?.root) {
        state.paintSession.handlePointerMove({
          event: e,
          domEl: state.renderer.domElement,
          camera,
          paintRoot: state.built.root,
          paintableMeshes: state.paintableMeshes,
          brush: cur.paintBrush,
        });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (state.paintSession.brushing) {
        const completed = state.paintSession.finishStroke(state.renderer.domElement, e.pointerId);
        if (completed) {
          setPaintStrokes((prev) => [...prev, completed]);
          setPaintRedoStack([]);
        }
      }
    };

    const attachCanvasPointerListeners = (domEl: HTMLElement) => {
      domEl.style.touchAction = 'none';
      domEl.addEventListener('pointerdown', onPointerDown);
      domEl.addEventListener('pointermove', onPointerHoverCursor);
    };
    const detachCanvasPointerListeners = (domEl: HTMLElement) => {
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('pointermove', onPointerHoverCursor);
    };

    attachCanvasPointerListeners(renderer.domElement);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    let disposed = false;
    let frameId = 0;
    let lastTs = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl =
        typeof renderer.getContext === 'function'
          ? (renderer.getContext() as Partial<WebGL2RenderingContext> | null)
          : null;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE ?? 0x9117, 0);
        gl.flush?.();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync?.(sync);
            return;
          }
          const st = sync
            ? gl.getSyncParameter?.(sync, gl.SYNC_STATUS ?? 0x9114)
            : (gl.SIGNALED ?? 0x9119);
          if (st === (gl.UNSIGNALED ?? 0x9118)) {
            frameId = window.setTimeout(poll, 6);
          } else {
            if (sync) gl.deleteSync?.(sync);
            frameId = window.setTimeout(cb, 55);
          }
        };
        frameId = window.setTimeout(poll, 6);
      } else {
        frameId = window.setTimeout(cb, 70);
      }
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.06, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      try {
        const cur = latestRef.current;
        const pauseAnimForPaint = cur.inspectorTab === 'paint';
        if (state.rigController) {
          if (cur.animMode === 'rest' || pauseAnimForPaint) {
            state.rigController.resetToRestPose();
          } else {
            state.rigController.update(dt, cur.animMode, 1.0);
          }
        }

        // Manual & Bind-Pose Blink override so Blink Test works even in Bind Pose!
        if (state.built && state.built.eyelids.length > 0 && !pauseAnimForPaint) {
          let blinkWeight = -1;
          if (state.manualBlinkTimer > 0) {
            state.manualBlinkTimer += dt;
            const dur = 0.22;
            if (state.manualBlinkTimer >= dur) {
              state.manualBlinkTimer = 0;
            } else {
              const u = state.manualBlinkTimer / dur;
              blinkWeight = u < 0.4 ? (u / 0.4) ** 2 : u < 0.55 ? 1 : 1 - ((u - 0.55) / 0.45) ** 2;
            }
          } else if (cur.animMode === 'rest' && cur.autoBlink) {
            state.blinkLoopTimer -= dt;
            if (state.blinkLoopTimer <= -0.18) {
              state.blinkLoopTimer = 2.6 + Math.random() * 2.5;
            } else if (state.blinkLoopTimer < 0) {
              const u = -state.blinkLoopTimer / 0.18;
              blinkWeight = Math.sin(u * Math.PI);
            } else {
              blinkWeight = 0;
            }
          }

          if (blinkWeight >= 0) {
            for (const lid of state.built.eyelids) {
              const frac = THREE.MathUtils.lerp(lid.restClosedFrac, 1, blinkWeight);
              lid.node.rotation.x = THREE.MathUtils.lerp(lid.minOpenRad, lid.maxCloseRad, frac);
            }
          }
        }

        if (state.skeletonHelper) {
          state.skeletonHelper.visible = cur.showSkeleton;
        }

        if (state.cameraFocusAnim) {
          const alpha = isSoftwareGl ? 1 : 1 - Math.exp(-10 * dt);
          camera.position.lerp(state.cameraFocusAnim.targetPos, alpha);
          state.controls.target.lerp(state.cameraFocusAnim.targetLook, alpha);
          if (
            camera.position.distanceToSquared(state.cameraFocusAnim.targetPos) < 1e-5 &&
            state.controls.target.distanceToSquared(state.cameraFocusAnim.targetLook) < 1e-5
          ) {
            camera.position.copy(state.cameraFocusAnim.targetPos);
            state.controls.target.copy(state.cameraFocusAnim.targetLook);
            state.cameraFocusAnim = null;
          }
        }

        state.controls.update();
        if (!cur.showingSketchModal) {
          renderer.render(scene, camera);
        }
      } catch {
        // ignore transient draw error
      } finally {
        if (!disposed) {
          if (isSoftwareGl) afterDraw(tick);
          else frameId = requestAnimationFrame(tick);
        }
      }
    };

    const switchToWebGLFallback = async (): Promise<boolean> => {
      if (disposed) return false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      detachCanvasPointerListeners(state.renderer.domElement);
      controls.dispose();
      envTex?.dispose();
      envTex = null;
      try {
        renderer.dispose();
      } catch {
        // ignore
      }
      renderer = createMakerRenderer(isSoftwareGl, true);
      renderer.setSize(container.clientWidth || 820, container.clientHeight || 600);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      controls = createControls(renderer.domElement);
      controls.addEventListener('start', () => {
        state.cameraFocusAnim = null;
      });
      attachCanvasPointerListeners(renderer.domElement);
      state.renderer = renderer;
      state.controls = controls;
      try {
        await renderer.init();
        if (disposed) return false;
        envTex = setupSceneEnvironment(scene, renderer);
        return true;
      } catch {
        return false;
      }
    };

    void (async () => {
      let ok = false;
      try {
        await renderer.init();
        if (!isSoftwareGl && isWebGPUFallbackAdapter(renderer)) {
          ok = await switchToWebGLFallback();
        } else {
          ok = true;
        }
      } catch {
        ok = await switchToWebGLFallback();
      }
      if (disposed || !ok) return;
      if (!envTex) {
        envTex = setupSceneEnvironment(scene, renderer);
      }
      tick();
    })();

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const w = container.clientWidth || 820;
      const h = container.clientHeight || 600;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      detachCanvasPointerListeners(state.renderer.domElement);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      state.segmentOverlay?.dispose();
      state.segmentOverlay = null;
      state.paintSession.dispose(scene);
      state.controls.dispose();
      disposeObject3D(charHolder);
      envTex?.dispose();
      try {
        renderer.dispose();
      } catch {
        // ignore
      }
      studioRef.current = null;
    };
  }, []);

  // Rebuild SDF Marching Cubes + Rig whenever doc or resolution changes
  // Use draft 32^3 while dragging sliders, and 56^3 when crisp or idle!
  useEffect(() => {
    const st = studioRef.current;
    if (!st) return;

    const targetRes = isSliderActive
      ? 32
      : doc.sculptData?.enabled
      ? Math.max(crispResMode ? 56 : 36, Math.min(72, doc.sculptData.resolution))
      : crispResMode
      ? 56
      : 36;
    const delayMs = isSliderActive ? 12 : 45;

    const timer = window.setTimeout(() => {
      const built = buildCharacterRigAndMesh(doc, targetRes, true);
      st.segmentOverlay?.dispose();
      st.segmentOverlay = null;
      if (st.skeletonHelper) {
        st.scene.remove(st.skeletonHelper);
        st.skeletonHelper.dispose();
        st.skeletonHelper = null;
      }
      disposeObject3D(st.charHolder);
      st.charHolder.clear();
      st.charHolder.add(built.root);

      const helper = new THREE.SkeletonHelper(built.root);
      helper.visible = latestRef.current.showSkeleton;
      st.scene.add(helper);

      const info = inspectModelSkeleton(built.root);
      const baseDefaults = createDefaultRigSettings(info, false);
      const savedAsset = editingAssetId
        ? store.customAssets.find((a) => a.id === editingAssetId)
        : undefined;
      const savedRig = savedAsset?.rigSettings;
      const rigSettings = savedRig
        ? {
            ...baseDefaults,
            ...savedRig,
            boneMap: baseDefaults.boneMap,
            armRelaxAngle:
              !savedRig.armRelaxAutoVersion &&
              savedRig.armRelaxAngle === 0 &&
              baseDefaults.armRelaxAngle >= 15
                ? baseDefaults.armRelaxAngle
                : savedRig.armRelaxAngle,
          }
        : baseDefaults;
      const rigCtrl = new ProceduralRigController(
        st.charHolder,
        built.root,
        rigSettings,
        savedAsset?.customAnimations,
        savedAsset?.defaultSlotPresets
      );

      st.built = built;
      st.skeletonHelper = helper;
      st.rigController = rigCtrl;
      st.paintableMeshes = prepareObjectForVertexPainting(built.root);
      if (paintStrokesRef.current.length > 0) {
        applyVertexPaintStrokesToObject(built.root, paintStrokesRef.current);
      }
      st.segmentOverlay = createCharacterSegmentOverlay(
        built,
        latestRef.current.activePart,
        latestRef.current.showPartHighlights
      );
      setMeshStats({
        verts: built.vertexCount,
        tris: built.triangleCount,
        bones: built.bones.length,
      });
      if (pendingFocusPartRef.current) {
        const pendingPart = pendingFocusPartRef.current;
        pendingFocusPartRef.current = null;
        focusBodyPart(pendingPart);
      }
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [doc, crispResMode, isSliderActive]);

  // Update active part yellow highlight and segment boundary visibility without rebuilding mesh
  useEffect(() => {
    const ov = studioRef.current?.segmentOverlay;
    if (!ov) return;
    ov.setActivePart(activePart);
    ov.setVisible(showPartHighlights);
  }, [activePart, showPartHighlights]);

  // Replay non-destructive vertex paint strokes without rebuilding Marching Cubes
  useEffect(() => {
    const st = studioRef.current;
    const root = st?.built?.root;
    if (!st || !root || st.paintSession.brushing) return;
    resetObjectVertexPaint(root);
    if (paintStrokes.length > 0) {
      applyVertexPaintStrokesToObject(root, paintStrokes);
    }
  }, [paintStrokes]);

  // Toggle OrbitControls left-button delegation while painting in 3D
  useEffect(() => {
    const st = studioRef.current;
    if (!st) return;
    const paintBrushingActive =
      inspectorTab === 'paint' && paintTool === 'paint' && !spaceOrbiting;
    st.controls.mouseButtons = {
      LEFT: paintBrushingActive ? (null as unknown as THREE.MOUSE) : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    st.controls.touches = {
      ONE: paintBrushingActive ? (null as unknown as THREE.TOUCH) : THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    if (!paintBrushingActive) {
      st.paintSession.hideCursor();
    }
  }, [inspectorTab, paintTool, spaceOrbiting]);

  // Paint keyboard shortcuts: Space to temporarily orbit, [ / ] to resize brush
  useEffect(() => {
    if (inspectorTab !== 'paint') {
      setSpaceOrbiting(false);
      return;
    }
    const isTextInput = (el: EventTarget | null) =>
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextInput(e.target)) return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpaceOrbiting(true);
      } else if (e.key === '[') {
        setPaintBrush((prev) => ({
          ...prev,
          radius: Math.max(0.04, Number((prev.radius - 0.04).toFixed(2))),
        }));
      } else if (e.key === ']') {
        setPaintBrush((prev) => ({
          ...prev,
          radius: Math.min(1.2, Number((prev.radius + 0.04).toFixed(2))),
        }));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceOrbiting(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [inspectorTab]);

  const focusBodyPart = useCallback((partKey: CharacterBodyPartKey) => {
    const st = studioRef.current;
    if (!st) return;
    const built = st.built;
    if (!built) {
      pendingFocusPartRef.current = partKey;
      return;
    }

    const anchor = built.partAnchors.find((a) => a.key === partKey)?.worldPos;
    const guides = built.segmentGuides?.filter((g) => g.partKey === partKey) ?? [];
    const isArmPart = partKey === 'upperArm' || partKey === 'lowerArm' || partKey === 'extraArm';
    const isLegPair = partKey === 'upperLeg' || partKey === 'lowerLeg' || partKey === 'extraLeg';

    const selectedGuides = isArmPart
      ? guides.filter((g) => {
          const avgX =
            g.rings.length > 0
              ? g.rings.reduce((acc, r) => acc + r.center[0], 0) / g.rings.length
              : 0;
          return avgX >= -0.02;
        })
      : guides;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const sampleGuides = selectedGuides.length > 0 ? selectedGuides : guides;
    for (const g of sampleGuides) {
      for (const r of g.rings) {
        const rad = Math.max(r.rx, r.rz, 0.04);
        minX = Math.min(minX, r.center[0] - rad);
        maxX = Math.max(maxX, r.center[0] + rad);
        minY = Math.min(minY, r.center[1] - rad);
        maxY = Math.max(maxY, r.center[1] + rad);
        minZ = Math.min(minZ, r.center[2] - rad);
        maxZ = Math.max(maxZ, r.center[2] + rad);
      }
    }

    const hasBounds = Number.isFinite(minX) && Number.isFinite(maxX);
    const center = new THREE.Vector3(
      hasBounds ? (minX + maxX) * 0.5 : anchor?.x ?? 0,
      hasBounds ? (minY + maxY) * 0.5 : anchor?.y ?? 0.9,
      hasBounds ? (minZ + maxZ) * 0.5 : anchor?.z ?? 0
    );
    if (isLegPair) {
      center.x = 0;
    } else if (anchor && !hasBounds) {
      center.copy(anchor);
    } else if (
      anchor &&
      (partKey === 'head' ||
        partKey === 'neck' ||
        partKey === 'belly' ||
        partKey === 'hips' ||
        partKey === 'torso')
    ) {
      center.x = anchor.x;
      center.z = anchor.z;
    }

    const extraPadY = partKey === 'head' ? 0.14 : partKey === 'headCrown' ? 0.1 : 0.06;
    const halfH = hasBounds ? Math.max(0.08, (maxY - minY) * 0.5 + extraPadY) : 0.22;
    const halfW = hasBounds ? Math.max(0.08, (maxX - minX) * 0.5 + 0.07) : 0.22;

    const minDistByPart: Record<CharacterBodyPartKey, number> = {
      head: 1.15,
      headCrown: 0.95,
      headJaw: 0.9,
      muzzle: 0.82,
      neck: 0.92,
      torso: 1.25,
      belly: 1.18,
      hips: 1.15,
      upperArm: 1.0,
      lowerArm: 0.95,
      upperLeg: 1.12,
      lowerLeg: 1.08,
      tail: 1.32,
      extraArm: 1.08,
      extraLeg: 1.22,
    };

    const halfFovRad = THREE.MathUtils.degToRad((st.camera.fov || 40) * 0.5);
    const tanHalfFov = Math.max(0.15, Math.tan(halfFovRad));
    const aspect = Math.max(0.6, st.camera.aspect || 1.3);
    const distV = (halfH * 2.2) / tanHalfFov;
    const distH = (halfW * 2.2) / (tanHalfFov * aspect);
    const minDist = minDistByPart[partKey] ?? 1.05;
    const dist = THREE.MathUtils.clamp(Math.max(distV, distH, minDist), minDist, 3.2);

    const dir = new THREE.Vector3(0.06, 0.06, 0.996);
    if (partKey === 'tail') {
      dir.set(0.62, 0.2, -0.76);
    } else if (partKey === 'extraLeg') {
      dir.set(0.45, 0.12, 0.88);
    } else if (partKey === 'muzzle') {
      dir.set(0.28, 0.05, 0.96);
    } else if (isArmPart) {
      dir.set(0.14, 0.06, 0.99);
    } else if (partKey === 'headJaw' || partKey === 'neck') {
      dir.set(0.08, 0.02, 0.996);
    } else if (partKey === 'headCrown') {
      dir.set(0.06, 0.14, 0.988);
    }
    dir.normalize();

    const targetPos = center.clone().addScaledVector(dir, dist);
    if (targetPos.y < 0.28) targetPos.y = 0.28;

    st.cameraFocusAnim = {
      targetPos,
      targetLook: center,
    };
  }, []);

  const selectBodyPart = useCallback(
    (partKey: CharacterBodyPartKey, openBodyTab = false) => {
      setActivePart(partKey);
      if (openBodyTab) {
        setInspectorTab('body');
      }
      setCameraPreset(null);
      focusBodyPart(partKey);
    },
    [focusBodyPart]
  );

  // Camera framing presets
  useEffect(() => {
    const st = studioRef.current;
    if (!st || !cameraPreset) return;
    const headAnchor = st.built?.partAnchors.find((a) => a.key === 'head')?.worldPos;
    const hy = headAnchor ? headAnchor.y : 1.35;

    const targetPos = new THREE.Vector3();
    const targetLook = new THREE.Vector3();
    if (cameraPreset === 'face') {
      targetPos.set(0.24, hy + 0.03, 1.05);
      targetLook.set(0, hy - 0.01, 0.08);
    } else if (cameraPreset === 'side') {
      targetPos.set(2.85, 1.05, 0.15);
      targetLook.set(0, 0.82, 0);
    } else if (cameraPreset === 'back') {
      targetPos.set(-0.35, 1.25, -2.75);
      targetLook.set(0, 0.82, 0);
    } else {
      targetPos.set(1.55, 1.32, 2.72);
      targetLook.set(0, 0.8, 0);
    }

    if (!initialCamAppliedRef.current) {
      initialCamAppliedRef.current = true;
      st.cameraFocusAnim = null;
      st.camera.position.copy(targetPos);
      st.controls.target.copy(targetLook);
      st.controls.update();
    } else {
      st.cameraFocusAnim = { targetPos, targetLook };
    }
  }, [cameraPreset, cameraNonce]);

  // Save rigged character .glb + characterRecipe to Chars (`category: 'character'`)
  const handleSaveCharacter = async (opts?: { asCopy?: boolean; placeNow?: boolean; setAsHero?: boolean }): Promise<string | null> => {
    const cleanName = charName.trim() || 'Custom Character';
    setSaving(true);
    try {
      const strokesToSave = paintStrokes.length > 0 ? paintStrokes : undefined;
      const docToSave: CharacterMakerDoc = {
        ...doc,
        vertexPaintStrokes: strokesToSave,
      };
      const { buffer } = await buildAndExportCharacterDocToGlb(docToSave, 54);
      const targetId = opts?.asCopy ? undefined : editingAssetId ?? undefined;
      const meta = await store.saveGeneratedAsset({
        existingAssetId: targetId,
        name: cleanName,
        category: 'character',
        buffer,
        characterRecipe: docToSave,
        vertexPaintStrokes: strokesToSave,
        keepMetricScale: true,
      });
      setEditingAssetId(meta.id);
      flashToast(targetId ? `Updated "${meta.name}"` : `Saved "${meta.name}" to Chars`);

      if (opts?.setAsHero && store.currentProject) {
        store.updateProject('assign custom hero', (p) => ({
          ...p,
          heroCustomAssetId: meta.id,
        }));
        flashToast(`Assigned "${meta.name}" as your playable Hero!`);
      } else if (opts?.placeNow) {
        const hero = store.currentLevel?.entities.find((e) => e.kind === 'hero');
        const bx = hero ? Math.min(0.86, hero.position.x + 0.08) : 0.5;
        const by = hero ? Math.min(0.86, hero.position.y + 0.06) : 0.5;
        store.addEntity('npc', meta.name, { x: bx, y: by }, meta.id);
        flashToast(`Saved & dropped "${meta.name}" into level`);
      }
      return meta.id;
    } catch (err) {
      flashToast(err instanceof Error ? err.message : 'Character export failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAttributesModal = async () => {
    const id = editingAssetId ?? (await handleSaveCharacter());
    if (id) {
      store.setAttributeModifierTarget({ kind: 'assetMeta', assetId: id });
    }
  };

  useRegisterStudioAiBridge({
    id: 'modal-character',
    context: 'character',
    title: `Character Maker · ${charName}`,
    subtitle: 'AI sculpts clay body proportions, face, coat & extras',
    saveLabel: 'Save to Chars',
    getSnapshot: () => ({
      name: charName,
      presetId: doc.presetId,
      shoulderWidth: doc.shoulderWidth,
      hipWidth: doc.hipWidth,
      earStyle: doc.earStyle,
      tailStyle: doc.tailStyle,
    }),
    applyResult: (raw, options) => {
      const res = sanitizeCharacterMakerResult(
        raw,
        options?.modifyExisting ? doc : undefined,
        options?.characterGuide
      );
      setUndoStack((u) => [...u.slice(-24), doc]);
      if (!options?.modifyExisting) {
        setEditingAssetId(null);
      }
      setCharName(
        options?.modifyExisting && typeof raw.name !== 'string' ? charName : res.name
      );
      setDoc(res.doc);
      flashToast(res.summary);
      return res.summary;
    },
    saveAsset: async (suggestedName) => {
      if (suggestedName) setCharName(suggestedName);
      const id = await handleSaveCharacter();
      return id ? `Saved "${suggestedName || charName}" to Chars` : 'Save failed';
    },
  });

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const safeFileSlug = () =>
    (charName.trim() || 'custom-character')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'custom-character';

  const handleExportCharacterJson = () => {
    const strokesToSave = paintStrokes.length > 0 ? paintStrokes : undefined;
    const payload = {
      format: 'maker-character-recipe',
      version: 1,
      name: charName.trim() || 'Custom Character',
      doc: { ...doc, vertexPaintStrokes: strokesToSave },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `${safeFileSlug()}.makerchar.json`);
    setShowLoadMenu(false);
    flashToast(`Downloaded "${charName.trim() || 'Character'}" recipe (.makerchar.json)`);
  };

  const handleExportCharacterGlb = async () => {
    setSaving(true);
    try {
      const { buffer } = await buildAndExportCharacterDocToGlb(doc, 54);
      const blob = new Blob([buffer], { type: 'model/gltf-binary' });
      triggerDownload(blob, `${safeFileSlug()}.glb`);
      setShowLoadMenu(false);
      flashToast(`Downloaded rigged 3D model (.glb)`);
    } catch (err) {
      flashToast(err instanceof Error ? err.message : 'GLB download failed');
    } finally {
      setSaving(false);
    }
  };

  const handleImportCharacterFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { name?: string; doc?: CharacterMakerDoc } & Partial<CharacterMakerDoc>;
      const importedDoc =
        parsed && typeof parsed === 'object' && parsed.doc && parsed.doc.head && parsed.doc.torso
          ? parsed.doc
          : parsed && parsed.head && parsed.torso
          ? (parsed as CharacterMakerDoc)
          : null;
      if (!importedDoc) {
        flashToast('Invalid character file — expected a .makerchar.json export');
        return;
      }
      const nextName =
        (typeof parsed.name === 'string' && parsed.name.trim()) ||
        file.name.replace(/\.(makerchar\.)?json$/i, '') ||
        'Imported Character';
      setEditingAssetId(null);
      setCharName(nextName);
      setPaintStrokes(
        Array.isArray(importedDoc.vertexPaintStrokes)
          ? (JSON.parse(JSON.stringify(importedDoc.vertexPaintStrokes)) as VertexPaintStroke[])
          : []
      );
      setPaintRedoStack([]);
      updateDoc(() => importedDoc, true);
      setShowLoadMenu(false);
      flashToast(`Loaded "${nextName}" from file — click Save to Chars to add to library`);
    } catch {
      flashToast('Could not read character JSON file');
    }
  };

  const ext = resolveCharacterExtras(doc);
  const activeProfile = getLimbProfile(doc, activePart);
  const startSliderDrag = () => setIsSliderActive(true);
  const endSliderDrag = () => setIsSliderActive(false);

  const applyMuzzleUpdate = (updater: (prev: CharacterMuzzleConfig) => CharacterMuzzleConfig, recordHistory = false) => {
    updateDoc((d) => {
      const nextMuzzle = updater(resolveCharacterExtras(d).muzzle);
      return {
        ...d,
        muzzle: nextMuzzle,
        snoutLength: nextMuzzle.preset === 'none' ? 0 : nextMuzzle.length,
        snoutWidth: nextMuzzle.segments[2].rx,
        snoutColor: nextMuzzle.color,
      };
    }, recordHistory);
  };

  const renderSliderRow = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (val: number) => void,
    unit = ''
  ) => (
    <label className="block space-y-1">
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="text-slate-600 dark:text-[#AEB7CC]">{label}</span>
        <span className="tabular-nums text-slate-900 dark:text-white">
          {step < 0.01 ? value.toFixed(3) : step < 1 ? value.toFixed(2) : Math.round(value)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={startSliderDrag}
        onPointerUp={endSliderDrag}
        onPointerCancel={endSliderDrag}
        onBlur={endSliderDrag}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#7C5CFF] cursor-pointer"
      />
    </label>
  );

  const renderColorRow = (label: string, value: string, onChange: (hex: string) => void) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-600 dark:text-[#AEB7CC]">{label}</span>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <span className="text-[10px] font-mono text-slate-500">{value.toUpperCase()}</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-6 h-6 rounded-lg border-0 bg-transparent cursor-pointer"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-1">
        {COLOR_SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            className={`w-4 h-4 rounded-full border transition-transform ${
              value.toLowerCase() === hex.toLowerCase()
                ? 'border-white scale-115 ring-1 ring-[#7C5CFF]'
                : 'border-black/20 hover:scale-110'
            }`}
            style={{ backgroundColor: hex }}
            title={hex}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-3">
      <div className="w-full h-full max-w-[1680px] rounded-2xl bg-white dark:bg-[#141720] border border-slate-200/80 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
        {/* TOP HEADER */}
        <header className="shrink-0 min-h-14 py-1.5 px-3 sm:px-4 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/90 dark:bg-[#10131C] flex flex-wrap items-center justify-between gap-2 relative z-30">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.makerchar.json,application/json"
            onChange={(e) => void handleImportCharacterFile(e)}
            className="hidden"
          />
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7C5CFF] to-[#EC4899] text-white flex items-center justify-center shadow-xs shrink-0">
              <User size={16} />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-xs font-black tracking-tight text-slate-900 dark:text-white">
                Character Maker
              </div>
              <div className="text-[10px] font-semibold text-slate-500 dark:text-[#8E96AB]">
                Organic SDF Clay &amp; Full Rig
              </div>
            </div>
            <input
              type="text"
              value={charName}
              onChange={(e) => setCharName(e.target.value)}
              placeholder="Character name…"
              className="w-36 sm:w-44 h-8 px-2.5 rounded-xl bg-white dark:bg-[#181C28] border border-slate-200/80 dark:border-white/[0.08] text-xs font-extrabold focus:outline-none focus:border-[#7C5CFF]"
            />

            {/* Load / Edit Saved Character + Portable File Export/Import */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLoadMenu((v) => !v)}
                className="h-8 px-2.5 rounded-xl bg-white dark:bg-[#181C28] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold inline-flex items-center gap-1.5 hover:border-[#7C5CFF] whitespace-nowrap"
              >
                <FolderOpen size={13} className="text-[#7C5CFF]" />
                <span>Saved ({savedCharacters.length})</span>
                <ChevronDown size={12} />
              </button>
              {showLoadMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowLoadMenu(false)} />
                  <div className="absolute left-0 top-10 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white dark:bg-[#181C28] border border-slate-200 dark:border-white/15 shadow-2xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Saved Characters ({savedCharacters.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAssetId(null);
                          setCharName('Custom Character');
                          setPaintStrokes([]);
                          setPaintRedoStack([]);
                          updateDoc(() => createDefaultCharacterDoc(), true);
                          setShowLoadMenu(false);
                          flashToast('Started fresh blank character');
                        }}
                        className="text-[11px] font-extrabold text-[#7C5CFF] hover:underline"
                      >
                        + New Blank
                      </button>
                    </div>

                    <div className="space-y-1 max-h-60 overflow-y-auto maker-scroll pr-0.5">
                      {savedCharacters.length === 0 ? (
                        <div className="text-xs text-slate-500 p-2">
                          No saved characters yet. Click &ldquo;Save to Chars&rdquo; to save this character!
                        </div>
                      ) : (
                        savedCharacters.map((a) => {
                          const isCurrent = editingAssetId === a.id;
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => loadExistingCharacter(a)}
                              className={`w-full flex items-center gap-2 p-1.5 rounded-xl text-left border transition-colors ${
                                isCurrent
                                  ? 'bg-[#7C5CFF]/15 border-[#7C5CFF]/50'
                                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-[#23293A]'
                              }`}
                            >
                              <AssetThumbnail customAsset={a} size={34} rounded="rounded-lg" />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold truncate">{a.name}</div>
                                <div className="text-[10px] text-slate-400">
                                  {a.characterRecipe ? 'Character Maker Rig' : 'Imported GLB'}
                                </div>
                              </div>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded-md bg-[#7C5CFF] text-white text-[9px] font-extrabold shrink-0">
                                  Editing
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.08] space-y-1.5">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                        Portable Backup &amp; Export
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-8 px-2 rounded-xl bg-slate-100 dark:bg-[#22283A] hover:bg-slate-200 dark:hover:bg-[#2D354C] text-[11px] font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap"
                          title="Load a .makerchar.json character file from disk"
                        >
                          <Upload size={12} />
                          <span>Import</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportCharacterJson}
                          className="h-8 px-2 rounded-xl bg-slate-100 dark:bg-[#22283A] hover:bg-slate-200 dark:hover:bg-[#2D354C] text-[11px] font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap"
                          title="Save editable .makerchar.json file to computer"
                        >
                          <Download size={12} />
                          <span>.JSON</span>
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleExportCharacterGlb()}
                          className="h-8 px-2 rounded-xl bg-slate-100 dark:bg-[#22283A] hover:bg-slate-200 dark:hover:bg-[#2D354C] text-[11px] font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50"
                          title="Download rigged 3D .glb model"
                        >
                          <Download size={12} />
                          <span>.GLB</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title="Undo"
              className="h-8 w-8 rounded-xl bg-white dark:bg-[#181C28] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center disabled:opacity-35"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Redo"
              className="h-8 w-8 rounded-xl bg-white dark:bg-[#181C28] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center disabled:opacity-35"
            >
              <Redo2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => requestOpenContextualAiModal('character')}
              title="AI Character Designer"
              className="h-8 px-2.5 rounded-xl bg-[#A855F7]/15 border border-[#A855F7]/40 text-[#A855F7] dark:text-[#D8B4FE] hover:bg-[#A855F7]/25 text-xs font-extrabold inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Wand2 size={13} />
              <Sparkles size={11} className="text-[#F59E0B]" />
              <span>AI</span>
            </button>
            <button
              type="button"
              onClick={randomizeCharacter}
              title="Mutate / Randomize Character"
              className="h-8 px-2.5 rounded-xl bg-white dark:bg-[#181C28] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold inline-flex items-center gap-1 hover:border-[#7C5CFF] whitespace-nowrap"
            >
              <Dices size={13} />
              <span className="hidden md:inline">Mutate</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleOpenAttributesModal()}
              title="Set default NPC Role, Attitude, Ability & Dialogue preset"
              className="h-8 px-2.5 rounded-xl bg-slate-100 dark:bg-[#181C28] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold inline-flex items-center gap-1.5 hover:border-[#7C5CFF] whitespace-nowrap disabled:opacity-50"
            >
              <SlidersHorizontal size={13} className="text-[#7C5CFF]" />
              <span className="hidden lg:inline">Attributes &amp; Role</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveCharacter({ setAsHero: true })}
              className="h-8 px-2.5 rounded-xl bg-[#20B46A]/15 text-[#20B46A] border border-[#20B46A]/40 text-xs font-extrabold inline-flex items-center gap-1 hover:bg-[#20B46A] hover:text-white transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <Check size={13} />
              <span>Set as Hero</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveCharacter({ placeNow: true })}
              className="h-8 px-2.5 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] border border-[#7C5CFF]/40 text-xs font-extrabold inline-flex items-center gap-1 hover:bg-[#7C5CFF] hover:text-white transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <Plus size={13} />
              <span>Drop in Level</span>
            </button>
            {editingAssetId && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveCharacter({ asCopy: true })}
                className="h-8 px-2.5 rounded-xl bg-slate-200/80 dark:bg-[#212636] text-xs font-bold whitespace-nowrap disabled:opacity-50"
              >
                Save Copy
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowingSketchModal(true)}
              className="h-8 px-2.5 rounded-xl border border-[#7C5CFF]/40 bg-[#7C5CFF]/15 text-[#7C5CFF] dark:text-[#C4B5FD] text-xs font-extrabold whitespace-nowrap inline-flex items-center gap-1.5 hover:bg-[#7C5CFF]/25"
            >
              <Pencil size={13} />
              <span>3D Sculpt &amp; Stamp</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveCharacter()}
              className="h-8 px-3 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap disabled:opacity-50"
            >
              <Save size={13} />
              <span>{saving ? 'Rigging…' : editingAssetId ? 'Save Rig' : 'Save to Chars'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Character Maker"
              className="h-8 w-8 rounded-xl bg-slate-200/70 dark:bg-[#212636] flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        {/* BODY: LEFT ANATOMY DOCK + CENTER 3D STUDIO + RIGHT INSPECTOR */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT DOCK */}
          <aside className="w-full lg:w-[228px] xl:w-[244px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#11141E] p-2.5 overflow-y-auto maker-scroll space-y-3 max-h-48 lg:max-h-none">
            <div className="space-y-2.5" data-species-ver={speciesDefaultsVersion}>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                Base Presets
              </div>
              {(
                [
                  { category: 'humans', label: 'Humans' },
                  { category: 'animals', label: 'Animals' },
                  { category: 'creatures', label: 'Creatures' },
                ] as const
              ).map(({ category, label }) => {
                const items = CHARACTER_PRESETS.filter((p) => p.category === category);
                const activeItem = items.find((p) => p.id === doc.presetId);
                return (
                  <label key={category} className="block space-y-1">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8D95AA]">
                        {label}
                      </span>
                      {activeItem && (
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: activeItem.accentHex }}
                        />
                      )}
                    </div>
                    <select
                      value={activeItem ? activeItem.id : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          applyPreset(e.target.value as CharacterPresetId);
                        }
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl border text-[11px] font-bold transition-colors focus:outline-none dark:[color-scheme:dark] ${
                        activeItem
                          ? 'bg-[#EDE9FE] dark:bg-[#231E3F] border-[#7C5CFF] text-slate-900 dark:text-white'
                          : 'bg-white dark:bg-[#171B27] border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-[#E2E8F0] hover:border-[#7C5CFF]/50'
                      }`}
                    >
                      {!activeItem && (
                        <option
                          value=""
                          disabled
                          className="bg-white text-slate-500 dark:bg-[#171B27] dark:text-[#949BB0]"
                        >
                          Select {label.toLowerCase()}…
                        </option>
                      )}
                      {items.map((p) => {
                        const isSavedCustom = hasSavedCharacterSpeciesDefault(p.id);
                        return (
                          <option
                            key={p.id}
                            value={p.id}
                            className="bg-white text-slate-900 dark:bg-[#171B27] dark:text-white"
                          >
                            {isSavedCustom ? '★ ' : ''}
                            {p.name} — {p.subtitle}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                );
              })}

              {/* Save / Reset Edited Character as Species Default */}
              <div className="pt-1 space-y-1.5">
                <button
                  type="button"
                  onClick={handleSaveAsSpeciesDefault}
                  title={`Overwrite "${activeSpeciesInfo.name}" in the dropdown with your current edits`}
                  className="w-full py-1.5 px-2.5 rounded-xl bg-[#7C5CFF]/15 hover:bg-[#7C5CFF] text-[#7C5CFF] hover:text-white border border-[#7C5CFF]/35 text-[10.5px] font-extrabold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Save size={11} />
                  <span className="truncate">Set as {activeSpeciesInfo.name} Default</span>
                </button>
                {hasCustomSpeciesDefault && (
                  <button
                    type="button"
                    onClick={handleResetSpeciesDefault}
                    className="w-full py-1 px-2 rounded-lg bg-slate-200/70 dark:bg-[#181C28] hover:bg-rose-500/15 text-slate-600 dark:text-[#9CA5BC] hover:text-rose-400 text-[10px] font-bold transition-colors"
                  >
                    Reset {activeSpeciesInfo.name} to Factory
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-slate-200/70 dark:border-white/[0.06]">
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Sculpt Segment Profile
                </span>
                <label
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-[#C8D0E4] cursor-pointer select-none"
                  title="Show or hide yellow body-part highlight and faint segment lines"
                >
                  <input
                    type="checkbox"
                    checked={showPartHighlights}
                    onChange={(e) => setShowPartHighlights(e.target.checked)}
                    className="w-3 h-3 accent-[#FACC15] rounded cursor-pointer"
                  />
                  <span>Guides</span>
                </label>
              </div>
              <div className="grid grid-cols-3 lg:grid-cols-1 gap-1">
                {BODY_PART_ITEMS.map((item) => {
                  const active = activePart === item.key;
                  const profColor =
                    item.key === 'muzzle'
                      ? ext.muzzle.color
                      : getLimbProfile(doc, item.key).color;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => selectBodyPart(item.key, true)}
                      className={`px-2 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between border transition-colors ${
                        active
                          ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                          : 'bg-white dark:bg-[#171B27] text-slate-700 dark:text-[#C8D0E4] border-slate-200/70 dark:border-white/[0.06] hover:border-[#7C5CFF]/50'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      <span
                        className="w-3 h-3 rounded-full border border-white/30 shrink-0"
                        style={{ backgroundColor: profColor }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* CENTER 3D CHARACTER VIEWPORT */}
          <main className="flex-1 min-w-0 min-h-[280px] relative flex flex-col bg-[#131622]">
            <div ref={viewportRef} className="w-full h-full flex-1" />

            {/* Top Floating Viewport Controls: Animation Test + Blink + Skeleton + Camera */}
            <div className="absolute top-3 left-3 right-3 pointer-events-none flex flex-wrap items-center justify-between gap-2">
              <div className="pointer-events-auto flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-lg">
                <span className="px-2 text-[10px] font-extrabold text-slate-300 inline-flex items-center gap-1">
                  <Play size={11} className="text-[#7C5CFF]" /> Rig Test
                </span>
                {ANIM_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAnimMode(opt.id)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors whitespace-nowrap ${
                      animMode === opt.id
                        ? 'bg-[#7C5CFF] text-white'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={triggerManualBlink}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#20B46A]/20 text-[#6EE7B7] hover:bg-[#20B46A] hover:text-white transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Eye size={11} /> Blink
                </button>
              </div>

              <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-lg">
                <button
                  type="button"
                  onClick={() => setShowPartHighlights((v) => !v)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    showPartHighlights
                      ? 'bg-[#FACC15]/20 text-[#FDE047] border border-[#FACC15]/45'
                      : 'text-slate-300 hover:bg-white/10 border border-transparent'
                  }`}
                  title="Show or hide yellow part highlight glow and faint segment boundary lines"
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-[4px] border inline-flex items-center justify-center transition-colors ${
                      showPartHighlights
                        ? 'bg-[#FACC15] border-[#FACC15] text-slate-950'
                        : 'border-slate-400/60 bg-transparent'
                    }`}
                  >
                    {showPartHighlights && <Check size={10} strokeWidth={3} />}
                  </span>
                  Segment Guides
                </button>
                <button
                  type="button"
                  onClick={() => setShowSkeleton((s) => !s)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                    showSkeleton ? 'bg-[#F59E0B] text-slate-950' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Bone size={11} /> Rig Bones
                </button>
                <button
                  type="button"
                  onClick={() => setCrispResMode((v) => !v)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                    crispResMode ? 'bg-[#7C5CFF]/30 text-white' : 'text-slate-300 hover:bg-white/10'
                  }`}
                  title="Switch between Fast Draft and High-Resolution Clay Mesh"
                >
                  <Sparkles size={11} /> {crispResMode ? 'Hi-Res Clay' : 'Draft Grid'}
                </button>
              </div>
            </div>

            {/* Bottom Camera View Strip & Mesh Summary */}
            <div className="absolute bottom-3 left-3 right-3 pointer-events-none flex flex-wrap items-center justify-between gap-2">
              <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10">
                <Camera size={12} className="text-slate-400 mx-1.5" />
                {(
                  [
                    { id: 'fullBody', label: 'Full Body' },
                    { id: 'face', label: 'Face & Eyes' },
                    { id: 'side', label: 'Side Silhouette' },
                    { id: 'back', label: 'Back & Tail' },
                  ] as const
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => {
                      setCameraPreset(cam.id);
                      setCameraNonce((n) => n + 1);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap ${
                      cameraPreset === cam.id
                        ? 'bg-white text-slate-900'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              <div className="px-3 py-1 rounded-xl bg-slate-900/75 text-[11px] font-semibold text-slate-300 border border-white/10 tabular-nums">
                {meshStats.bones} Bones · {meshStats.tris.toLocaleString()} Tris · Seamless SDF
              </div>
            </div>

            {toast && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl bg-[#7C5CFF] text-white text-xs font-extrabold shadow-xl">
                {toast}
              </div>
            )}
          </main>

          {/* RIGHT CONTEXTUAL INSPECTOR */}
          <aside className="w-full lg:w-[325px] xl:w-[355px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#151824] flex flex-col min-h-0 max-h-80 lg:max-h-none">
            <div className="shrink-0 p-1.5 border-b border-slate-200/80 dark:border-white/[0.08] grid grid-cols-6 gap-1 bg-slate-50/70 dark:bg-[#11141E]">
              {(
                [
                  { id: 'body', label: 'Body', Icon: Layers },
                  { id: 'limbs', label: 'Limbs', Icon: Hand },
                  { id: 'coat', label: 'Hair/Coat', Icon: Sparkles },
                  { id: 'extras', label: 'Extras', Icon: Wand2 },
                  { id: 'eyes', label: 'Face', Icon: Eye },
                  { id: 'paint', label: paintStrokes.length > 0 ? `Paint(${paintStrokes.length})` : 'Paint', Icon: Paintbrush },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInspectorTab(id)}
                  className={`py-2 px-0.5 rounded-xl text-[9.5px] font-extrabold flex flex-col items-center justify-center gap-0.5 transition-colors whitespace-nowrap ${
                    inspectorTab === id
                      ? 'bg-[#7C5CFF] text-white shadow-xs'
                      : 'text-slate-600 dark:text-[#9CA5BC] hover:bg-slate-200/60 dark:hover:bg-[#1E2333]'
                  }`}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4 maker-scroll">
              {inspectorTab === 'body' && (
                <>
                  {/* Global Clay Smoothness & Surface Finish */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <div className="text-xs font-extrabold flex items-center justify-between">
                      <span>Organic Clay Blend</span>
                      <span className="text-[10px] font-bold text-[#7C5CFF]">SDF smin</span>
                    </div>
                    {renderSliderRow(
                      'Clay Blend Smoothness',
                      doc.blendSmoothness,
                      0.015,
                      0.16,
                      0.005,
                      (val) => updateDoc((d) => ({ ...d, blendSmoothness: val }))
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'clay', label: 'Matte Clay' },
                          { id: 'toonSatin', label: 'Toon Satin' },
                          { id: 'glossySlime', label: 'Glossy Slime' },
                          { id: 'velvetCreature', label: 'Soft Velvet' },
                        ] as { id: CharacterMaterialFinish; label: string }[]
                      ).map((fin) => (
                        <button
                          key={fin.id}
                          type="button"
                          onClick={() => updateDoc((d) => ({ ...d, materialFinish: fin.id }), true)}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border ${
                            doc.materialFinish === fin.id
                              ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                              : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                          }`}
                        >
                          {fin.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Segment Editor: 5-Segment Muzzle OR 3-Point Limb/Neck/Body Sculptor */}
                  <div className="p-3 rounded-2xl border border-[#7C5CFF]/40 bg-[#7C5CFF]/6 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[#7C5CFF] truncate">
                        Segment: {BODY_PART_ITEMS.find((b) => b.key === activePart)?.label}
                      </span>
                      <select
                        value={activePart}
                        onChange={(e) => selectBodyPart(e.target.value as CharacterBodyPartKey)}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-[#171A25] border border-slate-200/80 dark:border-white/10 text-[11px] font-bold"
                      >
                        {BODY_PART_ITEMS.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {activePart === 'muzzle' ? (
                      <>
                        <div className="grid grid-cols-3 gap-1">
                          {MUZZLE_PRESET_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                applyMuzzleUpdate(
                                  (prev) => createMuzzlePreset(opt.id as CharacterMuzzlePresetId, prev.color),
                                  true
                                )
                              }
                              className={`py-1 px-1.5 rounded-xl text-[10px] font-bold border truncate ${
                                ext.muzzle.preset === opt.id
                                  ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                  : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                              }`}
                              title={opt.label}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        <MuzzleProfilePreview muzzle={ext.muzzle} />

                        {renderSliderRow(
                          'Muzzle Length',
                          ext.muzzle.length,
                          0,
                          0.26,
                          0.004,
                          (val) =>
                            applyMuzzleUpdate((prev) => ({
                              ...prev,
                              preset: val <= 0.01 ? 'none' : prev.preset === 'none' ? 'custom' : prev.preset,
                              length: val,
                            })),
                          'm'
                        )}

                        {ext.muzzle.length > 0.01 && (
                          <>
                            {renderSliderRow(
                              'Vertical Offset',
                              ext.muzzle.yOffset,
                              -0.08,
                              0.06,
                              0.002,
                              (val) => applyMuzzleUpdate((prev) => ({ ...prev, yOffset: val })),
                              'm'
                            )}
                            {renderSliderRow(
                              'Snout Tilt (Up ↔ Slope Down)',
                              ext.muzzle.tiltDeg,
                              -20,
                              35,
                              1,
                              (val) => applyMuzzleUpdate((prev) => ({ ...prev, tiltDeg: val })),
                              '°'
                            )}
                            {renderSliderRow(
                              'Bunny / Squirrel Cheek Split',
                              ext.muzzle.splitCleft,
                              0,
                              1.0,
                              0.02,
                              (val) => applyMuzzleUpdate((prev) => ({ ...prev, splitCleft: val }))
                            )}

                            <div className="space-y-2 pt-1 border-t border-white/10">
                              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                5-Segment Width &amp; Height Shaping
                              </div>
                              {ext.muzzle.segments.map((seg, segIdx) => (
                                <div
                                  key={segIdx}
                                  className="p-2 rounded-xl bg-white/75 dark:bg-[#141722]/90 border border-slate-200/60 dark:border-white/[0.07] space-y-1.5"
                                >
                                  <div className="text-[10px] font-extrabold text-[#7C5CFF]">
                                    {MUZZLE_SEGMENT_LABELS[segIdx]}
                                  </div>
                                  {renderSliderRow(
                                    'Width (X)',
                                    seg.rx,
                                    0.012,
                                    0.15,
                                    0.002,
                                    (val) =>
                                      applyMuzzleUpdate((prev) => {
                                        const segs = [...prev.segments] as [
                                          CharacterMuzzleSegment,
                                          CharacterMuzzleSegment,
                                          CharacterMuzzleSegment,
                                          CharacterMuzzleSegment,
                                          CharacterMuzzleSegment
                                        ];
                                        segs[segIdx] = { ...segs[segIdx], rx: val };
                                        return { ...prev, preset: 'custom', segments: segs };
                                      }),
                                    'm'
                                  )}
                                  {renderSliderRow(
                                    'Height (Y)',
                                    seg.ry,
                                    0.012,
                                    0.14,
                                    0.002,
                                    (val) =>
                                      applyMuzzleUpdate((prev) => {
                                        const segs = [...prev.segments] as [
                                          CharacterMuzzleSegment,
                                          CharacterMuzzleSegment,
                                          CharacterMuzzleSegment,
                                          CharacterMuzzleSegment,
                                          CharacterMuzzleSegment
                                        ];
                                        segs[segIdx] = { ...segs[segIdx], ry: val };
                                        return { ...prev, preset: 'custom', segments: segs };
                                      }),
                                    'm'
                                  )}
                                </div>
                              ))}
                            </div>

                            {renderColorRow('Muzzle Color', ext.muzzle.color, (hex) =>
                              applyMuzzleUpdate((prev) => ({ ...prev, color: hex }))
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {(activePart === 'head' || activePart === 'headCrown' || activePart === 'headJaw') && (
                          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/80 dark:bg-[#141722]">
                            {(
                              [
                                { key: 'head', label: 'Main Skull' },
                                { key: 'headCrown', label: 'Crown / Brow' },
                                { key: 'headJaw', label: 'Jaw / Chin' },
                              ] as const
                            ).map((seg) => (
                              <button
                                key={seg.key}
                                type="button"
                                onClick={() => selectBodyPart(seg.key)}
                                className={`py-1 px-1 rounded-lg text-[10px] font-extrabold transition-colors truncate ${
                                  activePart === seg.key
                                    ? 'bg-[#7C5CFF] text-white'
                                    : 'text-slate-500 dark:text-[#8D95AA] hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                {seg.label}
                              </button>
                            ))}
                          </div>
                        )}

                        <ProfileCurvePreview profile={activeProfile} />

                        {renderSliderRow(
                          'Start Thickness (Root)',
                          activeProfile.startRadius,
                          0.012,
                          0.32,
                          activePart === 'neck' ? 0.002 : 0.003,
                          (val) =>
                            updateDoc((d) => setLimbProfile(d, activePart, (p) => ({ ...p, startRadius: val }))),
                          'm'
                        )}
                        {renderSliderRow(
                          'Middle Thickness (Bulge / Pinch)',
                          activeProfile.midRadius,
                          0.012,
                          0.34,
                          activePart === 'neck' ? 0.002 : 0.003,
                          (val) =>
                            updateDoc((d) => setLimbProfile(d, activePart, (p) => ({ ...p, midRadius: val }))),
                          'm'
                        )}
                        {renderSliderRow(
                          'End Thickness (Tip)',
                          activeProfile.endRadius,
                          0.012,
                          0.3,
                          activePart === 'neck' ? 0.002 : 0.003,
                          (val) =>
                            updateDoc((d) => setLimbProfile(d, activePart, (p) => ({ ...p, endRadius: val }))),
                          'm'
                        )}
                        {renderSliderRow(
                          'Curvature Transition (Scoop ↔ Plump)',
                          activeProfile.curvature,
                          -1.0,
                          1.0,
                          0.05,
                          (val) =>
                            updateDoc((d) => setLimbProfile(d, activePart, (p) => ({ ...p, curvature: val })))
                        )}
                        {renderSliderRow(
                          'Segment Length',
                          activeProfile.length,
                          0.02,
                          activePart === 'neck' ? 1.05 : 0.85,
                          0.01,
                          (val) =>
                            updateDoc((d) => setLimbProfile(d, activePart, (p) => ({ ...p, length: val }))),
                          'm'
                        )}
                        {activeProfile.squashX !== undefined &&
                          renderSliderRow(
                            'Width Ovalness (X)',
                            activeProfile.squashX,
                            0.6,
                            1.65,
                            0.02,
                            (val) =>
                              updateDoc((d) => setLimbProfile(d, activePart, (p) => ({ ...p, squashX: val })))
                          )}
                        {activeProfile.squashZ !== undefined &&
                          renderSliderRow(
                            'Depth Ovalness (Z)',
                            activeProfile.squashZ,
                            0.6,
                            1.65,
                            0.02,
                            (val) =>
                              updateDoc((d) => setLimbProfile(d, activePart, (p) => ({ ...p, squashZ: val })))
                          )}
                        {(activePart === 'headCrown' || activePart === 'headJaw') && (() => {
                          const hSeg =
                            activePart === 'headCrown' ? ext.headCrown : ext.headJaw;
                          return (
                            <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
                              {renderSliderRow(
                                'Vertical Offset (Y)',
                                hSeg.offsetY,
                                -0.14,
                                0.18,
                                0.004,
                                (val) =>
                                  updateDoc((d) => updateHeadSegment(d, activePart, { offsetY: val })),
                                'm'
                              )}
                              {renderSliderRow(
                                'Forward / Back Offset (Z)',
                                hSeg.offsetZ,
                                -0.14,
                                0.16,
                                0.004,
                                (val) =>
                                  updateDoc((d) => updateHeadSegment(d, activePart, { offsetZ: val })),
                                'm'
                              )}
                              {renderSliderRow(
                                'Clay Blend Tightness',
                                hSeg.blendScale,
                                0.15,
                                1.0,
                                0.04,
                                (val) =>
                                  updateDoc((d) => updateHeadSegment(d, activePart, { blendScale: val }))
                              )}
                            </div>
                          );
                        })()}
                        {renderColorRow('Part Color (Blends at Joints)', activeProfile.color, (hex) =>
                          updateDoc((d) => setLimbProfile(d, activePart, (p) => ({ ...p, color: hex })))
                        )}
                      </>
                    )}
                  </div>

                  {/* Stance & Belly Patch */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">Proportions &amp; Belly Patch</span>
                      {activePart !== 'muzzle' && (
                        <button
                          type="button"
                          onClick={() => selectBodyPart('muzzle')}
                          className="px-2 py-0.5 rounded-lg bg-[#7C5CFF]/15 text-[#7C5CFF] text-[10px] font-extrabold hover:bg-[#7C5CFF] hover:text-white transition-colors"
                        >
                          5-Seg Muzzle
                        </button>
                      )}
                    </div>
                    {renderSliderRow(
                      'Shoulder Width',
                      doc.shoulderWidth,
                      0.1,
                      0.36,
                      0.01,
                      (val) => updateDoc((d) => ({ ...d, shoulderWidth: val })),
                      'm'
                    )}
                    {renderSliderRow(
                      'Leg Stance Width',
                      doc.legStanceWidth,
                      0.07,
                      0.26,
                      0.005,
                      (val) => updateDoc((d) => ({ ...d, legStanceWidth: val })),
                      'm'
                    )}
                    {renderSliderRow(
                      'Arm Bind Pose Angle',
                      doc.armSpreadDeg,
                      8,
                      68,
                      1,
                      (val) => updateDoc((d) => ({ ...d, armSpreadDeg: val })),
                      '°'
                    )}
                    <label className="flex items-center justify-between text-xs font-bold pt-1">
                      <span>Creature Belly Patch</span>
                      <input
                        type="checkbox"
                        checked={doc.bellyPatchEnabled}
                        onChange={(e) =>
                          updateDoc((d) => ({ ...d, bellyPatchEnabled: e.target.checked }), true)
                        }
                        className="accent-[#7C5CFF]"
                      />
                    </label>
                    {doc.bellyPatchEnabled &&
                      renderColorRow('Belly Patch Color', doc.bellyColor, (hex) =>
                        updateDoc((d) => ({ ...d, bellyColor: hex }))
                      )}
                  </div>
                </>
              )}

              {inspectorTab === 'limbs' && (
                <>
                  {/* Hands (2..5 Fingers with Thumb, Paw, Claw, Hoof) */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <div className="text-xs font-extrabold">Hands &amp; Fingers (With Thumb)</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {HAND_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateDoc((d) => ({ ...d, handStyle: opt.id }), true)}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border text-left ${
                            doc.handStyle === opt.id
                              ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                              : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {renderSliderRow(
                      'Hand Size',
                      doc.handScale,
                      0.65,
                      1.65,
                      0.05,
                      (val) => updateDoc((d) => ({ ...d, handScale: val })),
                      '×'
                    )}
                    {doc.handStyle.startsWith('fingers') &&
                      renderSliderRow(
                        'Finger Spread',
                        doc.fingerSpread,
                        0.1,
                        1.0,
                        0.05,
                        (val) => updateDoc((d) => ({ ...d, fingerSpread: val }))
                      )}
                  </div>

                  {/* Feet */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <div className="text-xs font-extrabold">Feet / Hoofs / Paws</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {FOOT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateDoc((d) => ({ ...d, footStyle: opt.id }), true)}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border ${
                            doc.footStyle === opt.id
                              ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                              : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {renderSliderRow(
                      'Foot Size',
                      doc.footScale,
                      0.7,
                      1.6,
                      0.05,
                      (val) => updateDoc((d) => ({ ...d, footScale: val })),
                      '×'
                    )}
                    {renderColorRow('Claw / Hoof Tip Color', doc.extremityTipColor, (hex) =>
                      updateDoc((d) => ({ ...d, extremityTipColor: hex }))
                    )}
                  </div>

                  {/* Extra Arms Pair */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <label className="flex items-center justify-between text-xs font-extrabold">
                      <span>Extra Arm Pair (4-Armed)</span>
                      <input
                        type="checkbox"
                        checked={doc.extraArmsEnabled}
                        onChange={(e) =>
                          updateDoc((d) => ({ ...d, extraArmsEnabled: e.target.checked }), true)
                        }
                        className="accent-[#7C5CFF]"
                      />
                    </label>
                    {doc.extraArmsEnabled && (
                      <>
                        {renderSliderRow(
                          'Vertical Offset',
                          doc.extraArmHeightOffset,
                          -0.28,
                          -0.05,
                          0.01,
                          (val) => updateDoc((d) => ({ ...d, extraArmHeightOffset: val })),
                          'm'
                        )}
                        {renderSliderRow(
                          'Extra Arm Length',
                          doc.extraArmProfile.length,
                          0.2,
                          0.75,
                          0.02,
                          (val) =>
                            updateDoc((d) => ({
                              ...d,
                              extraArmProfile: { ...d.extraArmProfile, length: val },
                            })),
                          'm'
                        )}
                        {renderColorRow('Extra Arm Color', doc.extraArmProfile.color, (hex) =>
                          updateDoc((d) => ({
                            ...d,
                            extraArmProfile: { ...d.extraArmProfile, color: hex },
                          }))
                        )}
                      </>
                    )}
                  </div>

                  {/* Extra Legs Pair */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <label className="flex items-center justify-between text-xs font-extrabold">
                      <span>Extra Hind Leg Pair (4-Legged)</span>
                      <input
                        type="checkbox"
                        checked={doc.extraLegsEnabled}
                        onChange={(e) =>
                          updateDoc((d) => ({ ...d, extraLegsEnabled: e.target.checked }), true)
                        }
                        className="accent-[#7C5CFF]"
                      />
                    </label>
                    {doc.extraLegsEnabled && (
                      <>
                        {renderSliderRow(
                          'Hind Stance Offset',
                          doc.extraLegRearOffset,
                          0.16,
                          0.48,
                          0.01,
                          (val) => updateDoc((d) => ({ ...d, extraLegRearOffset: val })),
                          'm'
                        )}
                        {renderColorRow('Extra Leg Color', doc.extraLegProfile.color, (hex) =>
                          updateDoc((d) => ({
                            ...d,
                            extraLegProfile: { ...d.extraLegProfile, color: hex },
                          }))
                        )}
                      </>
                    )}
                  </div>
                </>
              )}

              {inspectorTab === 'extras' && (
                <>
                  {/* Ears */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <div className="text-xs font-extrabold">Ears &amp; Antennae</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {EAR_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateDoc((d) => ({ ...d, earStyle: opt.id }), true)}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border ${
                            doc.earStyle === opt.id
                              ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                              : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {doc.earStyle !== 'none' && (
                      <>
                        {renderSliderRow(
                          'Ear Size',
                          doc.earSize,
                          0.55,
                          2.0,
                          0.05,
                          (val) => updateDoc((d) => ({ ...d, earSize: val })),
                          '×'
                        )}
                        {renderSliderRow(
                          'Ear Tilt',
                          doc.earTilt,
                          -0.6,
                          0.8,
                          0.05,
                          (val) => updateDoc((d) => ({ ...d, earTilt: val }))
                        )}
                        {renderColorRow('Ear Color', doc.earColor, (hex) =>
                          updateDoc((d) => ({ ...d, earColor: hex }))
                        )}
                      </>
                    )}
                  </div>

                  {/* Tail */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <div className="text-xs font-extrabold">Tail</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {TAIL_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateDoc((d) => ({ ...d, tailStyle: opt.id }), true)}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border ${
                            doc.tailStyle === opt.id
                              ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                              : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {doc.tailStyle !== 'none' && (
                      <>
                        {renderSliderRow(
                          'Tail Length',
                          doc.tailProfile.length,
                          0.2,
                          0.95,
                          0.02,
                          (val) =>
                            updateDoc((d) => ({
                              ...d,
                              tailProfile: { ...d.tailProfile, length: val },
                            })),
                          'm'
                        )}
                        {renderSliderRow(
                          'Tail Curl Up/Down',
                          doc.tailCurl,
                          -0.5,
                          1.1,
                          0.05,
                          (val) => updateDoc((d) => ({ ...d, tailCurl: val }))
                        )}
                        {renderColorRow('Tail Color', doc.tailProfile.color, (hex) =>
                          updateDoc((d) => ({
                            ...d,
                            tailProfile: { ...d.tailProfile, color: hex },
                          }))
                        )}
                      </>
                    )}
                  </div>

                  {/* Horns */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">Horns</span>
                      <div className="flex gap-1">
                        {([0, 1, 2, 4] as const).map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => updateDoc((d) => ({ ...d, hornCount: cnt }), true)}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold ${
                              doc.hornCount === cnt
                                ? 'bg-[#7C5CFF] text-white'
                                : 'bg-white dark:bg-[#141722]'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>
                    {doc.hornCount > 0 && (
                      <>
                        <div className="grid grid-cols-2 gap-1.5">
                          {HORN_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => updateDoc((d) => ({ ...d, hornStyle: opt.id }), true)}
                              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border ${
                                doc.hornStyle === opt.id
                                  ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                  : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {renderSliderRow(
                          'Horn Length',
                          doc.hornLength,
                          0.1,
                          0.52,
                          0.01,
                          (val) => updateDoc((d) => ({ ...d, hornLength: val })),
                          'm'
                        )}
                        {renderSliderRow(
                          'Horn Thickness',
                          doc.hornThickness,
                          0.02,
                          0.09,
                          0.003,
                          (val) => updateDoc((d) => ({ ...d, hornThickness: val })),
                          'm'
                        )}
                        {renderColorRow('Horn Color', doc.hornColor, (hex) =>
                          updateDoc((d) => ({ ...d, hornColor: hex }))
                        )}
                      </>
                    )}
                  </div>

                  {/* Wings */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <div className="text-xs font-extrabold">Wings</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {WING_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateDoc((d) => ({ ...d, wingStyle: opt.id }), true)}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border ${
                            doc.wingStyle === opt.id
                              ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                              : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {doc.wingStyle !== 'none' && (
                      <>
                        {renderSliderRow(
                          'Wing Span',
                          doc.wingSpan,
                          0.3,
                          1.1,
                          0.02,
                          (val) => updateDoc((d) => ({ ...d, wingSpan: val })),
                          'm'
                        )}
                        {renderSliderRow(
                          'Wing Fold (Spread ↔ Tucked)',
                          ext.wingFold,
                          0,
                          1,
                          0.04,
                          (val) => updateDoc((d) => ({ ...d, wingFold: val }))
                        )}
                        {renderColorRow('Wing Color', doc.wingColor, (hex) =>
                          updateDoc((d) => ({ ...d, wingColor: hex }))
                        )}
                        {renderColorRow('Wing Tip / Trim Color', ext.wingTipColor, (hex) =>
                          updateDoc((d) => ({ ...d, wingTipColor: hex }))
                        )}
                      </>
                    )}
                  </div>

                  {/* Whiskers & Hair */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">Whisker Pairs</span>
                      <div className="flex gap-1">
                        {([0, 1, 2, 3] as const).map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => updateDoc((d) => ({ ...d, whiskerPairs: cnt }), true)}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold ${
                              doc.whiskerPairs === cnt
                                ? 'bg-[#7C5CFF] text-white'
                                : 'bg-white dark:bg-[#141722]'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>
                    {doc.whiskerPairs > 0 && (
                      <>
                        {renderSliderRow(
                          'Whisker Length',
                          doc.whiskerLength,
                          0.08,
                          0.3,
                          0.01,
                          (val) => updateDoc((d) => ({ ...d, whiskerLength: val })),
                          'm'
                        )}
                        {renderColorRow('Whisker Color', doc.whiskerColor, (hex) =>
                          updateDoc((d) => ({ ...d, whiskerColor: hex }))
                        )}
                      </>
                    )}

                    <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => setInspectorTab('coat')}
                        className="w-full py-2 px-3 rounded-xl bg-[#7C5CFF]/15 hover:bg-[#7C5CFF]/25 text-[#7C5CFF] text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Sparkles size={13} />
                        <span>Open Hair, Fur, Scales &amp; Spikes Studio →</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {inspectorTab === 'coat' && (() => {
                const sc: CharacterSurfaceCoatConfig = ext.surfaceCoat ?? createDefaultSurfaceCoat();
                const sp: CharacterSpikesConfig = ext.spikes ?? createDefaultSpikesConfig();
                const ad: CharacterAddonConfig = ext.addons ?? createDefaultAddonConfig();
                const patchCoat = (patch: Partial<CharacterSurfaceCoatConfig>, record = false) =>
                  updateDoc(
                    (d) => ({
                      ...d,
                      surfaceCoat: { ...(d.surfaceCoat ?? createDefaultSurfaceCoat()), ...patch },
                    }),
                    record
                  );
                const patchSpikes = (patch: Partial<CharacterSpikesConfig>, record = false) =>
                  updateDoc(
                    (d) => ({
                      ...d,
                      spikes: { ...(d.spikes ?? createDefaultSpikesConfig()), ...patch },
                    }),
                    record
                  );
                const patchAddons = (patch: Partial<CharacterAddonConfig>, record = false) =>
                  updateDoc(
                    (d) => ({
                      ...d,
                      addons: { ...(d.addons ?? createDefaultAddonConfig()), ...patch },
                    }),
                    record
                  );
                const hairCfg: CharacterHairSculptConfig = ext.hairConfig;
                const matchedCustomHair = doc.customHairPresetId
                  ? customHairPresets.find((p) => p.id === doc.customHairPresetId)
                  : undefined;
                const hairSelectValue =
                  doc.hairStyle === 'none'
                    ? 'none'
                    : matchedCustomHair
                      ? `custom:${matchedCustomHair.id}`
                      : doc.hairStyle;

                const patchHairConfig = (patch: Partial<CharacterHairSculptConfig>, record = false) =>
                  updateDoc(
                    (d) => {
                      const prev = resolveCharacterExtras(d).hairConfig;
                      const next: CharacterHairSculptConfig = { ...prev, ...patch };
                      if (patch.mirrorSides === true) {
                        const source = hairEditSide === 'right' ? prev.right : prev.left;
                        next.left = { ...source };
                        next.right = { ...source };
                      }
                      return { ...d, hairConfig: next };
                    },
                    record
                  );

                const patchHairSide = (patch: Partial<CharacterHairSideConfig>, record = false) =>
                  updateDoc(
                    (d) => {
                      const prev = resolveCharacterExtras(d).hairConfig;
                      if (hairEditSide === 'both') {
                        return {
                          ...d,
                          hairConfig: {
                            ...prev,
                            mirrorSides: true,
                            left: { ...prev.left, ...patch },
                            right: { ...prev.right, ...patch },
                          },
                        };
                      }
                      if (hairEditSide === 'left') {
                        return {
                          ...d,
                          hairConfig: {
                            ...prev,
                            mirrorSides: false,
                            left: { ...prev.left, ...patch },
                          },
                        };
                      }
                      return {
                        ...d,
                        hairConfig: {
                          ...prev,
                          mirrorSides: false,
                          right: { ...prev.right, ...patch },
                        },
                      };
                    },
                    record
                  );

                const activeSideCfg = hairEditSide === 'right' ? hairCfg.right : hairCfg.left;
                const fh: CharacterFacialHairConfig = ext.facialHair;
                const patchFacialHair = (
                  updater: (prev: CharacterFacialHairConfig, d: CharacterMakerDoc) => CharacterFacialHairConfig,
                  record = false
                ) =>
                  updateDoc((d) => {
                    const prev = resolveCharacterExtras(d).facialHair;
                    return { ...d, facialHair: updater(prev, d) };
                  }, record);
                const patchMustache = (
                  patch: Partial<CharacterMustacheConfig>,
                  record = false
                ) =>
                  patchFacialHair((prev) => {
                    const next: CharacterMustacheConfig = { ...prev.mustache, ...patch };
                    if (patch.mirrorSides === true) {
                      const src = mustacheEditSide === 'right' ? prev.mustache.right : prev.mustache.left;
                      next.left = { ...src };
                      next.right = { ...src };
                    }
                    return { ...prev, mustache: next };
                  }, record);
                const patchMustacheSide = (
                  patch: Partial<CharacterMustacheSideConfig>,
                  record = false
                ) =>
                  patchFacialHair((prev) => {
                    if (mustacheEditSide === 'both') {
                      return {
                        ...prev,
                        mustache: {
                          ...prev.mustache,
                          mirrorSides: true,
                          left: { ...prev.mustache.left, ...patch },
                          right: { ...prev.mustache.right, ...patch },
                        },
                      };
                    }
                    if (mustacheEditSide === 'left') {
                      return {
                        ...prev,
                        mustache: {
                          ...prev.mustache,
                          mirrorSides: false,
                          left: { ...prev.mustache.left, ...patch },
                        },
                      };
                    }
                    return {
                      ...prev,
                      mustache: {
                        ...prev.mustache,
                        mirrorSides: false,
                        right: { ...prev.mustache.right, ...patch },
                      },
                    };
                  }, record);
                const patchBeard = (patch: Partial<CharacterBeardConfig>, record = false) =>
                  patchFacialHair((prev) => ({ ...prev, beard: { ...prev.beard, ...patch } }), record);
                const patchSideburns = (
                  patch: Partial<CharacterSideburnsConfig>,
                  record = false
                ) =>
                  patchFacialHair(
                    (prev) => ({ ...prev, sideburns: { ...prev.sideburns, ...patch } }),
                    record
                  );
                const patchStubble = (patch: Partial<CharacterStubbleConfig>, record = false) =>
                  patchFacialHair(
                    (prev) => ({ ...prev, stubble: { ...prev.stubble, ...patch } }),
                    record
                  );
                const activeMustacheSide =
                  mustacheEditSide === 'right' ? fh.mustache.right : fh.mustache.left;
                const maleHair = HAIR_OPTIONS.filter((h) => h.group === 'male');
                const femaleHair = HAIR_OPTIONS.filter((h) => h.group === 'female');
                const creatureHair = HAIR_OPTIONS.filter((h) => h.group === 'creature');
                const isSideBasedLayout =
                  hairCfg.layout === 'partedSides' ||
                  hairCfg.layout === 'afroSides' ||
                  hairCfg.layout === 'spikySides';

                return (
                  <>
                    {/* 1. Sculpted Dual-Side Hair Studio */}
                    <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-extrabold">Hair Studio (Dual-Side Sculpt)</div>
                          <div className="text-[10px] text-slate-500 dark:text-[#8D95AA]">
                            Left &amp; right parted locks/puffs — zero bowl cap
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const suggested =
                              matchedCustomHair?.name ||
                              HAIR_OPTIONS.find((h) => h.id === doc.hairStyle)?.label ||
                              'My Hair';
                            setCustomHairName(suggested);
                            setSaveHairOpen((v) => !v);
                          }}
                          disabled={doc.hairStyle === 'none'}
                          className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-[#7C5CFF]/15 hover:bg-[#7C5CFF]/25 text-[#7C5CFF] disabled:opacity-40 flex items-center gap-1"
                        >
                          <Plus size={11} />
                          <span>Save Preset</span>
                        </button>
                      </div>

                      {/* Hair Preset Dropdown + Custom Update/Delete */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <select
                            aria-label="Hair preset"
                            value={hairSelectValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'none') {
                                updateDoc(
                                  (d) => ({ ...d, hairStyle: 'none', customHairPresetId: undefined }),
                                  true
                                );
                                return;
                              }
                              if (val.startsWith('custom:')) {
                                const id = val.slice('custom:'.length);
                                const found = customHairPresets.find((p) => p.id === id);
                                if (found) {
                                  const clonedCfg = JSON.parse(
                                    JSON.stringify(found.hairConfig)
                                  ) as CharacterHairSculptConfig;
                                  setHairEditSide(clonedCfg.mirrorSides ? 'both' : 'left');
                                  updateDoc(
                                    (d) => ({
                                      ...d,
                                      hairStyle: found.baseStyle,
                                      customHairPresetId: found.id,
                                      hairColor: found.hairColor,
                                      hairAccentColor: found.hairAccentColor,
                                      hairScale: found.hairScale,
                                      hairOffsetX: found.hairOffsetX,
                                      hairOffsetY: found.hairOffsetY,
                                      hairOffsetZ: found.hairOffsetZ,
                                      hairRotX: found.hairRotX,
                                      hairRotY: found.hairRotY,
                                      hairRotZ: found.hairRotZ,
                                      hairConfig: clonedCfg,
                                    }),
                                    true
                                  );
                                }
                                return;
                              }
                              const styleId = val as CharacterHairStyle;
                              const nextCfg = createHairPresetConfig(styleId);
                              setHairEditSide(nextCfg.mirrorSides ? 'both' : 'left');
                              updateDoc(
                                (d) => ({
                                  ...d,
                                  hairStyle: styleId,
                                  customHairPresetId: undefined,
                                  hairConfig: nextCfg,
                                }),
                                true
                              );
                            }}
                            className="flex-1 min-w-0 px-2.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#141722] border border-slate-200/80 dark:border-white/[0.1] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]/40"
                          >
                            <option value="none">None (No Hair)</option>
                            {customHairPresets.length > 0 && (
                              <optgroup label="Custom Saved Presets">
                                {customHairPresets.map((cp) => (
                                  <option key={cp.id} value={`custom:${cp.id}`}>
                                    ★ {cp.name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="Male / Short &amp; Layered">
                              {maleHair.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Female / Long &amp; Curls">
                              {femaleHair.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Creature &amp; Stylized">
                              {creatureHair.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                          </select>

                          {matchedCustomHair && (
                            <>
                              <button
                                type="button"
                                title="Update saved custom preset"
                                onClick={() => {
                                  saveCustomHairPreset({
                                    id: matchedCustomHair.id,
                                    name: matchedCustomHair.name,
                                    baseStyle:
                                      doc.hairStyle === 'none' ? 'shortCrop' : doc.hairStyle,
                                    hairColor: doc.hairColor,
                                    hairAccentColor: ext.hairAccentColor,
                                    hairScale: ext.hairScale,
                                    hairOffsetX: ext.hairOffsetX,
                                    hairOffsetY: ext.hairOffsetY,
                                    hairOffsetZ: ext.hairOffsetZ,
                                    hairRotX: ext.hairRotX,
                                    hairRotY: ext.hairRotY,
                                    hairRotZ: ext.hairRotZ,
                                    hairConfig: hairCfg,
                                  });
                                }}
                                className="px-2 py-2 rounded-xl text-[10px] font-extrabold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30"
                              >
                                <Save size={12} />
                              </button>
                              <button
                                type="button"
                                title="Delete custom preset"
                                onClick={() => {
                                  deleteCustomHairPreset(matchedCustomHair.id);
                                  updateDoc(
                                    (d) => ({ ...d, customHairPresetId: undefined }),
                                    true
                                  );
                                }}
                                className="px-2 py-2 rounded-xl text-[10px] font-extrabold bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-500/30"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>

                        {saveHairOpen && doc.hairStyle !== 'none' && (
                          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white/90 dark:bg-[#141722] border border-[#7C5CFF]/30">
                            <input
                              type="text"
                              value={customHairName}
                              onChange={(e) => setCustomHairName(e.target.value)}
                              placeholder="Custom hair preset name..."
                              className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-[#1B1F2E] border border-slate-200/70 dark:border-white/[0.08] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const saved = saveCustomHairPreset({
                                  name: customHairName.trim() || 'Custom Hair',
                                  baseStyle: doc.hairStyle === 'none' ? 'shortCrop' : doc.hairStyle,
                                  hairColor: doc.hairColor,
                                  hairAccentColor: ext.hairAccentColor,
                                  hairScale: ext.hairScale,
                                  hairOffsetX: ext.hairOffsetX,
                                  hairOffsetY: ext.hairOffsetY,
                                  hairOffsetZ: ext.hairOffsetZ,
                                  hairRotX: ext.hairRotX,
                                  hairRotY: ext.hairRotY,
                                  hairRotZ: ext.hairRotZ,
                                  hairConfig: hairCfg,
                                });
                                updateDoc((d) => ({ ...d, customHairPresetId: saved.id }), true);
                                setSaveHairOpen(false);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-[#7C5CFF] text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setSaveHairOpen(false)}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </div>

                      {doc.hairStyle !== 'none' && (
                        <>
                          {/* Base Layout & Parting */}
                          <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                              Base Structure &amp; Part Line
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                              {(
                                [
                                  { id: 'partedSides', label: 'Parted Locks' },
                                  { id: 'afroSides', label: 'Dual Afro' },
                                  { id: 'spikySides', label: 'Spiky Sides' },
                                  { id: 'crest', label: 'Center Crest' },
                                  { id: 'mane', label: 'Full Mane' },
                                ] as { id: CharacterHairLayoutMode; label: string }[]
                              ).map((modeOpt) => (
                                <button
                                  key={modeOpt.id}
                                  type="button"
                                  onClick={() => patchHairConfig({ layout: modeOpt.id }, true)}
                                  className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border truncate ${
                                    hairCfg.layout === modeOpt.id
                                      ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                      : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                                  }`}
                                >
                                  {modeOpt.label}
                                </button>
                              ))}
                            </div>

                            {isSideBasedLayout && (
                              <>
                                {renderSliderRow(
                                  'Center Part Gap',
                                  hairCfg.partGap,
                                  -0.015,
                                  0.055,
                                  0.002,
                                  (val) => patchHairConfig({ partGap: val }),
                                  'm'
                                )}
                                {renderSliderRow(
                                  'Part Position (L ↔ R)',
                                  hairCfg.partShift,
                                  -0.075,
                                  0.075,
                                  0.003,
                                  (val) => patchHairConfig({ partShift: val }),
                                  'm'
                                )}
                              </>
                            )}
                          </div>

                          {/* Left / Right Side Sculpt Controls */}
                          {isSideBasedLayout && (
                            <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                  Side Sculpting
                                </span>
                                <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={hairCfg.mirrorSides}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      if (checked) setHairEditSide('both');
                                      else if (hairEditSide === 'both') setHairEditSide('left');
                                      patchHairConfig({ mirrorSides: checked }, true);
                                    }}
                                    className="accent-[#7C5CFF] rounded"
                                  />
                                  <span>Mirror Sides</span>
                                </label>
                              </div>

                              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/80 dark:bg-[#141722]">
                                {(
                                  [
                                    { id: 'both', label: 'Both Sides' },
                                    { id: 'left', label: 'Left Side' },
                                    { id: 'right', label: 'Right Side' },
                                  ] as const
                                ).map((sideOpt) => (
                                  <button
                                    key={sideOpt.id}
                                    type="button"
                                    onClick={() => {
                                      setHairEditSide(sideOpt.id);
                                      if (sideOpt.id === 'both' && !hairCfg.mirrorSides) {
                                        patchHairConfig({ mirrorSides: true }, true);
                                      }
                                    }}
                                    className={`py-1 rounded-lg text-[10px] font-extrabold transition-colors ${
                                      hairEditSide === sideOpt.id
                                        ? 'bg-[#7C5CFF] text-white'
                                        : 'text-slate-500 dark:text-[#8D95AA] hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                  >
                                    {sideOpt.label}
                                  </button>
                                ))}
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-600 dark:text-[#A4ACC0]">
                                  {hairEditSide === 'both'
                                    ? 'Both Sides Active'
                                    : hairEditSide === 'left'
                                      ? 'Left Side Active'
                                      : 'Right Side Active'}
                                </span>
                                <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={activeSideCfg.enabled}
                                    onChange={(e) =>
                                      patchHairSide({ enabled: e.target.checked }, true)
                                    }
                                    className="accent-[#7C5CFF] rounded"
                                  />
                                  <span>Visible</span>
                                </label>
                              </div>

                              {activeSideCfg.enabled && (
                                <div className="space-y-2">
                                  {renderSliderRow(
                                    'Length (Short ↔ Long)',
                                    activeSideCfg.length,
                                    0.2,
                                    2.2,
                                    0.04,
                                    (val) => patchHairSide({ length: val }),
                                    '×'
                                  )}
                                  {renderSliderRow(
                                    'Fullness (Thin ↔ Thick)',
                                    activeSideCfg.fullness,
                                    0.4,
                                    1.9,
                                    0.04,
                                    (val) => patchHairSide({ fullness: val }),
                                    '×'
                                  )}
                                  {renderSliderRow(
                                    'Flatness ↔ Crown Lift',
                                    activeSideCfg.flatness,
                                    0.35,
                                    1.8,
                                    0.04,
                                    (val) => patchHairSide({ flatness: val }),
                                    '×'
                                  )}
                                  {renderSliderRow(
                                    'Distance from Skin',
                                    activeSideCfg.skinHug,
                                    -0.025,
                                    0.07,
                                    0.003,
                                    (val) => patchHairSide({ skinHug: val }),
                                    'm'
                                  )}
                                  {renderSliderRow(
                                    'Puffiness (Individual Puffs)',
                                    activeSideCfg.puffiness,
                                    0,
                                    1,
                                    0.04,
                                    (val) => patchHairSide({ puffiness: val })
                                  )}
                                  {activeSideCfg.puffiness > 0.05 &&
                                    renderSliderRow(
                                      'Individual Puff Size',
                                      activeSideCfg.puffScale,
                                      0.4,
                                      1.8,
                                      0.04,
                                      (val) => patchHairSide({ puffScale: val }),
                                      '×'
                                    )}
                                  {renderSliderRow(
                                    'Spikiness',
                                    activeSideCfg.spikiness,
                                    0,
                                    1,
                                    0.04,
                                    (val) => patchHairSide({ spikiness: val })
                                  )}
                                  {renderSliderRow(
                                    'Front Bangs Drop',
                                    activeSideCfg.bangsDrop,
                                    0,
                                    1,
                                    0.04,
                                    (val) => patchHairSide({ bangsDrop: val })
                                  )}
                                  {renderSliderRow(
                                    'Tip Flare (In ↔ Out)',
                                    activeSideCfg.flare,
                                    -1,
                                    1,
                                    0.05,
                                    (val) => patchHairSide({ flare: val })
                                  )}
                                  {renderSliderRow(
                                    'Side Scale',
                                    activeSideCfg.scale,
                                    0.5,
                                    1.8,
                                    0.03,
                                    (val) => patchHairSide({ scale: val }),
                                    '×'
                                  )}
                                  {renderSliderRow(
                                    'Side Offset X',
                                    activeSideCfg.offsetX,
                                    -0.1,
                                    0.1,
                                    0.004,
                                    (val) => patchHairSide({ offsetX: val }),
                                    'm'
                                  )}
                                  {renderSliderRow(
                                    'Side Offset Y',
                                    activeSideCfg.offsetY,
                                    -0.1,
                                    0.1,
                                    0.004,
                                    (val) => patchHairSide({ offsetY: val }),
                                    'm'
                                  )}
                                  {renderSliderRow(
                                    'Side Offset Z',
                                    activeSideCfg.offsetZ,
                                    -0.1,
                                    0.1,
                                    0.004,
                                    (val) => patchHairSide({ offsetZ: val }),
                                    'm'
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Hair Details & Attachments */}
                          <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                              Curls &amp; Detail Attachments
                            </div>
                            <select
                              aria-label="Hair detail attachment"
                              value={hairCfg.detailStyle}
                              onChange={(e) =>
                                patchHairConfig(
                                  { detailStyle: e.target.value as CharacterHairDetailStyle },
                                  true
                                )
                              }
                              className="w-full px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-[#141722] border border-slate-200/80 dark:border-white/[0.1] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]/40"
                            >
                              <option value="none">None (Clean Ends)</option>
                              <option value="endCurls">Long End Curls (Ringlets)</option>
                              <option value="bobFlip">Flipped Up Bob Curls</option>
                              <option value="pigtails">Twin Pigtails</option>
                              <option value="twinBuns">Twin Space Buns</option>
                              <option value="ponytail">Back Ponytail</option>
                              <option value="highBun">Top High Bun</option>
                              <option value="braidPlait">Braided Crown Plait</option>
                              <option value="pompCrest">Front Pompadour Sweep</option>
                            </select>

                            {hairCfg.detailStyle !== 'none' && (
                              <div className="space-y-2">
                                {renderSliderRow(
                                  'Detail Scale',
                                  hairCfg.detailScale,
                                  0.4,
                                  1.8,
                                  0.04,
                                  (val) => patchHairConfig({ detailScale: val }),
                                  '×'
                                )}
                                {renderSliderRow(
                                  'Curl Bounce / Twist',
                                  hairCfg.detailCurl,
                                  0,
                                  1.5,
                                  0.05,
                                  (val) => patchHairConfig({ detailCurl: val })
                                )}
                                {renderSliderRow(
                                  'Detail Height Offset (Y)',
                                  hairCfg.detailOffsetY,
                                  -0.08,
                                  0.08,
                                  0.004,
                                  (val) => patchHairConfig({ detailOffsetY: val }),
                                  'm'
                                )}
                              </div>
                            )}
                          </div>

                          {/* Global Placement, Rotation & Colors */}
                          <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                Whole Hair Placement &amp; Colors
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateDoc(
                                    (d) => ({
                                      ...d,
                                      hairOffsetX: 0,
                                      hairOffsetY: 0,
                                      hairOffsetZ: 0,
                                      hairRotX: 0,
                                      hairRotY: 0,
                                      hairRotZ: 0,
                                      hairScale: 1,
                                    }),
                                    true
                                  )
                                }
                                className="text-[10px] font-extrabold text-[#7C5CFF] hover:underline"
                              >
                                Reset Pose
                              </button>
                            </div>
                            {renderSliderRow(
                              'Hair Scale',
                              ext.hairScale,
                              0.55,
                              1.75,
                              0.02,
                              (val) => updateDoc((d) => ({ ...d, hairScale: val })),
                              '×'
                            )}
                            {renderSliderRow(
                              'Offset Left / Right (X)',
                              ext.hairOffsetX,
                              -0.16,
                              0.16,
                              0.004,
                              (val) => updateDoc((d) => ({ ...d, hairOffsetX: val })),
                              'm'
                            )}
                            {renderSliderRow(
                              'Offset Up / Down (Y)',
                              ext.hairOffsetY,
                              -0.16,
                              0.16,
                              0.004,
                              (val) => updateDoc((d) => ({ ...d, hairOffsetY: val })),
                              'm'
                            )}
                            {renderSliderRow(
                              'Offset Front / Back (Z)',
                              ext.hairOffsetZ,
                              -0.16,
                              0.16,
                              0.004,
                              (val) => updateDoc((d) => ({ ...d, hairOffsetZ: val })),
                              'm'
                            )}
                            {renderSliderRow(
                              'Tilt Forward / Back (Pitch)',
                              ext.hairRotX,
                              -45,
                              45,
                              1,
                              (val) => updateDoc((d) => ({ ...d, hairRotX: val })),
                              '°'
                            )}
                            {renderSliderRow(
                              'Turn Left / Right (Yaw)',
                              ext.hairRotY,
                              -45,
                              45,
                              1,
                              (val) => updateDoc((d) => ({ ...d, hairRotY: val })),
                              '°'
                            )}
                            {renderSliderRow(
                              'Roll Sideways',
                              ext.hairRotZ,
                              -45,
                              45,
                              1,
                              (val) => updateDoc((d) => ({ ...d, hairRotZ: val })),
                              '°'
                            )}
                            {renderColorRow('Hair Color', doc.hairColor, (hex) =>
                              updateDoc((d) => ({ ...d, hairColor: hex }))
                            )}
                            {renderColorRow('Hair Band / Accent', ext.hairAccentColor, (hex) =>
                              updateDoc((d) => ({ ...d, hairAccentColor: hex }))
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* 1b. Beard, Mustache, Sideburns & Stubble Studio */}
                    <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-extrabold">Beard, Mustache &amp; Stubble</div>
                          <div className="text-[10px] text-slate-500 dark:text-[#8D95AA]">
                            Soft layered strands, independent mustache sides &amp; conformal painted stubble
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMustacheEditSide('both');
                            updateDoc(
                              (d) => ({
                                ...d,
                                facialHair: createDefaultFacialHairConfig(d.hairColor || '#5C3A21'),
                              }),
                              true
                            );
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white/80 dark:bg-[#141722] border border-slate-200/70 dark:border-white/[0.08] hover:border-[#7C5CFF]"
                        >
                          Clear All
                        </button>
                      </div>

                      {/* Quick Combo Presets */}
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8D95AA] mb-1">
                          Quick Styles
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {FACIAL_HAIR_COMBO_PRESETS.map((cp) => (
                            <button
                              key={cp.id}
                              type="button"
                              onClick={() => {
                                setMustacheEditSide('both');
                                patchFacialHair((prev, d) => {
                                  const applied = cp.apply(prev.color || d.hairColor || '#5C3A21');
                                  return {
                                    ...prev,
                                    ...applied,
                                  };
                                }, true);
                              }}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-[#141722] border border-slate-200/70 dark:border-white/[0.08] hover:border-[#7C5CFF] hover:text-[#7C5CFF]"
                            >
                              {cp.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Shared Color & Global Face Depth Offset */}
                      <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={fh.matchHairColor}
                            onChange={(e) =>
                              patchFacialHair(
                                (prev, d) => ({
                                  ...prev,
                                  matchHairColor: e.target.checked,
                                  color: e.target.checked ? d.hairColor || prev.color : prev.color,
                                }),
                                true
                              )
                            }
                            className="accent-[#7C5CFF]"
                          />
                          <span>Match Head Hair Color</span>
                        </label>
                        {!fh.matchHairColor &&
                          renderColorRow('Facial Hair Color', fh.color, (hex) =>
                            patchFacialHair((prev) => ({ ...prev, color: hex }))
                          )}
                        {renderColorRow('Accent / Tip Highlight', fh.accentColor, (hex) =>
                          patchFacialHair((prev) => ({ ...prev, accentColor: hex }))
                        )}
                        {renderSliderRow(
                          'Face Depth (Embed ↔ Offset)',
                          fh.depthOffset,
                          -0.035,
                          0.045,
                          0.002,
                          (val) => patchFacialHair((prev) => ({ ...prev, depthOffset: val })),
                          'm'
                        )}
                      </div>

                      {/* 4 Sub-tabs: Mustache / Beard / Sideburns / Stubble */}
                      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-white/80 dark:bg-[#141722] border border-slate-200/70 dark:border-white/[0.07]">
                        {(
                          [
                            { id: 'mustache', label: 'Mustache' },
                            { id: 'beard', label: 'Beard' },
                            { id: 'sideburns', label: 'Sideburns' },
                            { id: 'stubble', label: 'Stubble' },
                          ] as const
                        ).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setFacialHairSubTab(t.id)}
                            className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold transition ${
                              facialHairSubTab === t.id
                                ? 'bg-[#7C5CFF] text-white'
                                : 'text-slate-600 dark:text-[#A8B0C4] hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* Sub-tab 1: Mustache */}
                      {facialHairSubTab === 'mustache' && (
                        <div className="space-y-2.5">
                          <div>
                            <div className="text-[10px] font-bold text-slate-600 dark:text-[#A8B0C4] mb-1">
                              Mustache Style (Thin → Handlebar → Bushy)
                            </div>
                            <select
                              aria-label="Mustache style"
                              value={fh.mustache.style}
                              onChange={(e) => {
                                const style = e.target.value as CharacterMustacheStyle;
                                const nextM = createMustachePresetConfig(style);
                                setMustacheEditSide(nextM.mirrorSides ? 'both' : 'left');
                                patchFacialHair((prev) => ({ ...prev, mustache: nextM }), true);
                              }}
                              className="w-full px-2.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#141722] border border-slate-200/80 dark:border-white/[0.1] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]/40"
                            >
                              {MUSTACHE_STYLE_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label} — {opt.desc}
                                </option>
                              ))}
                            </select>
                          </div>

                          {fh.mustache.style !== 'none' && (
                            <>
                              <div className="p-2 rounded-xl bg-white/75 dark:bg-[#141722]/90 border border-slate-200/70 dark:border-white/[0.06] space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8D95AA]">
                                    Mustache Side Control
                                  </span>
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={fh.mustache.mirrorSides}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        patchMustache({ mirrorSides: checked }, true);
                                        if (checked) setMustacheEditSide('both');
                                        else if (mustacheEditSide === 'both') setMustacheEditSide('left');
                                      }}
                                      className="accent-[#7C5CFF]"
                                    />
                                    <span>Mirror Sides</span>
                                  </label>
                                </div>
                                <div className="grid grid-cols-3 gap-1">
                                  {(['both', 'left', 'right'] as const).map((side) => (
                                    <button
                                      key={side}
                                      type="button"
                                      onClick={() => {
                                        setMustacheEditSide(side);
                                        if (side === 'both') patchMustache({ mirrorSides: true }, true);
                                        else patchMustache({ mirrorSides: false }, true);
                                      }}
                                      className={`py-1 px-2 rounded-lg text-[10px] font-extrabold border ${
                                        mustacheEditSide === side
                                          ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                          : 'bg-white dark:bg-[#1B1F2E] border-slate-200/70 dark:border-white/[0.07]'
                                      }`}
                                    >
                                      {side === 'both'
                                        ? 'Both Sides'
                                        : side === 'left'
                                          ? 'Left Side'
                                          : 'Right Side'}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <label className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={activeMustacheSide.enabled}
                                  onChange={(e) =>
                                    patchMustacheSide({ enabled: e.target.checked }, true)
                                  }
                                  className="accent-[#7C5CFF]"
                                />
                                <span>
                                  Show{' '}
                                  {mustacheEditSide === 'both'
                                    ? 'Mustache'
                                    : mustacheEditSide === 'left'
                                      ? 'Left Side'
                                      : 'Right Side'}
                                </span>
                              </label>

                              {activeMustacheSide.enabled && (
                                <div className="space-y-2 pt-1">
                                  {renderSliderRow(
                                    'Thickness (Thin ↔ Thick)',
                                    activeMustacheSide.thickness,
                                    0.25,
                                    2.2,
                                    0.04,
                                    (val) => patchMustacheSide({ thickness: val })
                                  )}
                                  {renderSliderRow(
                                    'Length / Span',
                                    activeMustacheSide.length,
                                    0.3,
                                    2.2,
                                    0.04,
                                    (val) => patchMustacheSide({ length: val })
                                  )}
                                  {renderSliderRow(
                                    'Tip Curve (Droop ↔ Handlebar)',
                                    activeMustacheSide.curl,
                                    -1.2,
                                    1.8,
                                    0.05,
                                    (val) => patchMustacheSide({ curl: val })
                                  )}
                                  {renderSliderRow(
                                    'Bushiness (Soft Strands)',
                                    activeMustacheSide.bushiness,
                                    0,
                                    1,
                                    0.04,
                                    (val) => patchMustacheSide({ bushiness: val })
                                  )}
                                  {renderSliderRow(
                                    'Angle / Sweep',
                                    activeMustacheSide.angleDeg,
                                    -45,
                                    45,
                                    1,
                                    (val) => patchMustacheSide({ angleDeg: val }),
                                    '°'
                                  )}
                                  {renderSliderRow(
                                    'Scale',
                                    activeMustacheSide.scale,
                                    0.4,
                                    1.8,
                                    0.04,
                                    (val) => patchMustacheSide({ scale: val }),
                                    '×'
                                  )}
                                  {renderSliderRow(
                                    'Center Gap / X Offset',
                                    activeMustacheSide.offsetX,
                                    -0.03,
                                    0.06,
                                    0.002,
                                    (val) => patchMustacheSide({ offsetX: val }),
                                    'm'
                                  )}
                                  {renderSliderRow(
                                    'Height Y Offset',
                                    activeMustacheSide.offsetY,
                                    -0.05,
                                    0.05,
                                    0.002,
                                    (val) => patchMustacheSide({ offsetY: val }),
                                    'm'
                                  )}
                                  {renderSliderRow(
                                    'Side Depth Z (In ↔ Out)',
                                    activeMustacheSide.offsetZ,
                                    -0.035,
                                    0.045,
                                    0.002,
                                    (val) => patchMustacheSide({ offsetZ: val }),
                                    'm'
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* Sub-tab 2: Beard */}
                      {facialHairSubTab === 'beard' && (
                        <div className="space-y-2.5">
                          <div>
                            <div className="text-[10px] font-bold text-slate-600 dark:text-[#A8B0C4] mb-1">
                              Beard Style (Layered Soft Strands)
                            </div>
                            <select
                              aria-label="Beard style"
                              value={fh.beard.style}
                              onChange={(e) => {
                                const style = e.target.value as CharacterBeardStyle;
                                patchFacialHair(
                                  (prev) => ({ ...prev, beard: createBeardPresetConfig(style) }),
                                  true
                                );
                              }}
                              className="w-full px-2.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#141722] border border-slate-200/80 dark:border-white/[0.1] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]/40"
                            >
                              {BEARD_STYLE_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label} — {opt.desc}
                                </option>
                              ))}
                            </select>
                          </div>

                          {fh.beard.style !== 'none' && (
                            <div className="space-y-2 pt-1">
                              {renderSliderRow(
                                'Beard Length',
                                fh.beard.length,
                                0.25,
                                2.2,
                                0.04,
                                (val) => patchBeard({ length: val })
                              )}
                              {renderSliderRow(
                                'Strand Thickness',
                                fh.beard.thickness,
                                0.35,
                                2.0,
                                0.04,
                                (val) => patchBeard({ thickness: val })
                              )}
                              {renderSliderRow(
                                'Bushiness (Strand Layers)',
                                fh.beard.bushiness,
                                0,
                                1,
                                0.04,
                                (val) => patchBeard({ bushiness: val })
                              )}
                              {renderSliderRow(
                                'Jaw / Cheek Width',
                                fh.beard.width,
                                0.4,
                                1.8,
                                0.04,
                                (val) => patchBeard({ width: val })
                              )}
                              {renderSliderRow(
                                'Curl / Wave',
                                fh.beard.curl,
                                0,
                                1.1,
                                0.04,
                                (val) => patchBeard({ curl: val })
                              )}
                              {renderSliderRow(
                                'Taper (Broad ↔ Pointed)',
                                fh.beard.taper,
                                -1,
                                1,
                                0.05,
                                (val) => patchBeard({ taper: val })
                              )}
                              {renderSliderRow(
                                'Cheek Line Height',
                                fh.beard.cheekHeight,
                                0,
                                1,
                                0.04,
                                (val) => patchBeard({ cheekHeight: val })
                              )}
                              {renderSliderRow(
                                'Beard Depth (In ↔ Out)',
                                fh.beard.depthOffset,
                                -0.035,
                                0.045,
                                0.002,
                                (val) => patchBeard({ depthOffset: val }),
                                'm'
                              )}
                              {renderSliderRow(
                                'Offset Up / Down (Y)',
                                fh.beard.offsetY,
                                -0.05,
                                0.05,
                                0.002,
                                (val) => patchBeard({ offsetY: val }),
                                'm'
                              )}
                              {renderSliderRow(
                                'Offset Front / Back (Z)',
                                fh.beard.offsetZ,
                                -0.04,
                                0.04,
                                0.002,
                                (val) => patchBeard({ offsetZ: val }),
                                'm'
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sub-tab 3: Sideburns */}
                      {facialHairSubTab === 'sideburns' && (
                        <div className="space-y-2.5">
                          <div>
                            <div className="text-[10px] font-bold text-slate-600 dark:text-[#A8B0C4] mb-1">
                              Sideburns Style
                            </div>
                            <select
                              aria-label="Sideburns style"
                              value={fh.sideburns.style}
                              onChange={(e) => {
                                const style = e.target.value as CharacterSideburnsStyle;
                                patchFacialHair(
                                  (prev) => ({
                                    ...prev,
                                    sideburns: createSideburnsPresetConfig(style),
                                  }),
                                  true
                                );
                              }}
                              className="w-full px-2.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#141722] border border-slate-200/80 dark:border-white/[0.1] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]/40"
                            >
                              {SIDEBURNS_STYLE_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label} — {opt.desc}
                                </option>
                              ))}
                            </select>
                          </div>

                          {fh.sideburns.style !== 'none' && (
                            <div className="space-y-2 pt-1">
                              <div className="grid grid-cols-1 gap-1.5 p-2 rounded-xl bg-white/75 dark:bg-[#141722]/90 border border-slate-200/70 dark:border-white/[0.06]">
                                <label className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={fh.sideburns.connectToHair}
                                    onChange={(e) =>
                                      patchSideburns({ connectToHair: e.target.checked }, true)
                                    }
                                    className="accent-[#7C5CFF]"
                                  />
                                  <span>Connect Up to Head Hair</span>
                                </label>
                                <label className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={fh.sideburns.connectToBeard}
                                    onChange={(e) =>
                                      patchSideburns({ connectToBeard: e.target.checked }, true)
                                    }
                                    className="accent-[#7C5CFF]"
                                  />
                                  <span>Connect Down into Beard</span>
                                </label>
                              </div>
                              {renderSliderRow(
                                'Length',
                                fh.sideburns.length,
                                0.25,
                                1.7,
                                0.04,
                                (val) => patchSideburns({ length: val })
                              )}
                              {renderSliderRow(
                                'Width',
                                fh.sideburns.width,
                                0.3,
                                2.0,
                                0.04,
                                (val) => patchSideburns({ width: val })
                              )}
                              {renderSliderRow(
                                'Thickness',
                                fh.sideburns.thickness,
                                0.35,
                                2.0,
                                0.04,
                                (val) => patchSideburns({ thickness: val })
                              )}
                              {renderSliderRow(
                                'Flare (Tapered ↔ Mutton Chops)',
                                fh.sideburns.flare,
                                -0.4,
                                1.0,
                                0.04,
                                (val) => patchSideburns({ flare: val })
                              )}
                              {renderSliderRow(
                                'Sideburns Depth (In ↔ Out)',
                                fh.sideburns.depthOffset,
                                -0.035,
                                0.045,
                                0.002,
                                (val) => patchSideburns({ depthOffset: val }),
                                'm'
                              )}
                              {renderSliderRow(
                                'Offset Up / Down (Y)',
                                fh.sideburns.offsetY,
                                -0.04,
                                0.04,
                                0.002,
                                (val) => patchSideburns({ offsetY: val }),
                                'm'
                              )}
                              {renderSliderRow(
                                'Offset Front / Back (Z)',
                                fh.sideburns.offsetZ,
                                -0.04,
                                0.04,
                                0.002,
                                (val) => patchSideburns({ offsetZ: val }),
                                'm'
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sub-tab 4: Painted / Sticker Stubble */}
                      {facialHairSubTab === 'stubble' && (
                        <div className="space-y-2.5">
                          <div className="text-[10px] text-slate-500 dark:text-[#8D95AA]">
                            Zero-mesh-depth skin shading that conforms to head size, nose &amp; mouth placement.
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {STUBBLE_STYLE_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => patchStubble({ style: opt.id }, true)}
                                title={opt.desc}
                                className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border text-left truncate ${
                                  fh.stubble.style === opt.id
                                    ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                    : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {fh.stubble.style !== 'none' && (
                            <div className="space-y-2 pt-1">
                              {renderSliderRow(
                                'Stubble Opacity',
                                fh.stubble.opacity,
                                0,
                                1,
                                0.02,
                                (val) => patchStubble({ opacity: val })
                              )}
                              {renderSliderRow(
                                'Follicle Density',
                                fh.stubble.density,
                                0.15,
                                1,
                                0.03,
                                (val) => patchStubble({ density: val })
                              )}
                              {renderSliderRow(
                                'Edge Softness',
                                fh.stubble.softness,
                                0.1,
                                1,
                                0.03,
                                (val) => patchStubble({ softness: val })
                              )}
                              {renderSliderRow(
                                'Cheek Height',
                                fh.stubble.cheekHeight,
                                0,
                                1,
                                0.03,
                                (val) => patchStubble({ cheekHeight: val })
                              )}
                              {renderColorRow('Stubble Tint', fh.stubble.color, (hex) =>
                                patchStubble({ color: hex })
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. Fur & Scales Surface Coat */}
                    <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                      <div>
                        <div className="text-xs font-extrabold">Fur &amp; Scales Texture Coat</div>
                        <div className="text-[10px] text-slate-500 dark:text-[#8D95AA]">
                          Layered surface displacement + bone-bound 3D tufts or scales
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {SURFACE_COAT_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => patchCoat({ mode: opt.id }, true)}
                            title={opt.desc}
                            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border text-left truncate ${
                              sc.mode === opt.id
                                ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {sc.mode !== 'none' && (
                        <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                          {renderSliderRow(
                            'Relief Intensity',
                            sc.intensity,
                            0.1,
                            1.0,
                            0.04,
                            (val) => patchCoat({ intensity: val })
                          )}
                          {renderSliderRow(
                            'Coverage Density',
                            sc.density,
                            0.25,
                            1.6,
                            0.05,
                            (val) => patchCoat({ density: val }),
                            '×'
                          )}
                          {renderSliderRow(
                            'Tuft / Scale Size',
                            sc.scaleSize,
                            0.5,
                            2.0,
                            0.05,
                            (val) => patchCoat({ scaleSize: val }),
                            '×'
                          )}
                          {sc.mode.startsWith('fur') &&
                            renderSliderRow(
                              'Fur Clumpiness',
                              sc.clumpiness,
                              0,
                              1.0,
                              0.04,
                              (val) => patchCoat({ clumpiness: val })
                            )}
                          {renderColorRow('Tip / Edge Highlight', sc.tipColor, (hex) =>
                            patchCoat({ tipColor: hex })
                          )}
                        </div>
                      )}
                    </div>

                    {/* 3. Spikes, Quills & Dorsal Fins */}
                    <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                      <label className="flex items-center justify-between text-xs font-extrabold cursor-pointer">
                        <span>Spikes, Quills &amp; Fins</span>
                        <input
                          type="checkbox"
                          checked={sp.enabled}
                          onChange={(e) => patchSpikes({ enabled: e.target.checked }, true)}
                          className="accent-[#7C5CFF] w-4 h-4"
                        />
                      </label>

                      {sp.enabled && (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-2 gap-1.5">
                            {SPIKES_STYLE_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => patchSpikes({ style: opt.id }, true)}
                                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border text-left truncate ${
                                  sp.style === opt.id
                                    ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                    : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500">Placement Zone</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {SPIKES_ZONE_OPTIONS.map((z) => (
                                <button
                                  key={z.id}
                                  type="button"
                                  onClick={() => patchSpikes({ zone: z.id }, true)}
                                  className={`py-1 px-2 rounded-xl text-[10px] font-bold border truncate ${
                                    sp.zone === z.id
                                      ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                      : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                                  }`}
                                >
                                  {z.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {renderSliderRow(
                            'Spike Count / Density',
                            sp.density,
                            0.25,
                            1.6,
                            0.05,
                            (val) => patchSpikes({ density: val }),
                            '×'
                          )}
                          {renderSliderRow(
                            'Spike Length',
                            sp.length,
                            0.05,
                            0.38,
                            0.01,
                            (val) => patchSpikes({ length: val }),
                            'm'
                          )}
                          {renderSliderRow(
                            'Thickness',
                            sp.thickness,
                            0.5,
                            2.0,
                            0.05,
                            (val) => patchSpikes({ thickness: val }),
                            '×'
                          )}
                          {renderSliderRow(
                            'Backward Sweep',
                            sp.sweepDeg,
                            -15,
                            75,
                            2,
                            (val) => patchSpikes({ sweepDeg: val }),
                            '°'
                          )}
                          {renderColorRow('Base Color', sp.color, (hex) => patchSpikes({ color: hex }))}
                          {renderColorRow('Tip Color', sp.tipColor, (hex) => patchSpikes({ tipColor: hex }))}
                        </div>
                      )}
                    </div>

                    {/* 4. Fun Character Addons (Eyewear, Headwear, Back & Shoulder Gear) */}
                    <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                      <div className="text-xs font-extrabold">Character Addons</div>

                      {/* Eyewear */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                          Eyewear &amp; Visors
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {EYEWEAR_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => patchAddons({ eyewear: opt.id }, true)}
                              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border text-left truncate ${
                                ad.eyewear === opt.id
                                  ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                  : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {ad.eyewear !== 'none' && (
                          <div className="space-y-2 pl-2 border-l-2 border-[#7C5CFF]/40">
                            {renderSliderRow(
                              'Eyewear Scale',
                              ad.eyewearScale,
                              0.6,
                              1.6,
                              0.04,
                              (val) => patchAddons({ eyewearScale: val }),
                              '×'
                            )}
                            {renderSliderRow(
                              'Height Offset (Y)',
                              ad.eyewearOffsetY,
                              -0.08,
                              0.08,
                              0.004,
                              (val) => patchAddons({ eyewearOffsetY: val }),
                              'm'
                            )}
                            {renderSliderRow(
                              'Forward Offset (Z)',
                              ad.eyewearOffsetZ,
                              -0.06,
                              0.08,
                              0.004,
                              (val) => patchAddons({ eyewearOffsetZ: val }),
                              'm'
                            )}
                            {renderColorRow('Frame Color', ad.eyewearColor, (hex) =>
                              patchAddons({ eyewearColor: hex })
                            )}
                            {renderColorRow('Lens / Glow Color', ad.eyewearLensColor, (hex) =>
                              patchAddons({ eyewearLensColor: hex })
                            )}
                          </div>
                        )}
                      </div>

                      {/* Headwear */}
                      <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                          Hats, Crowns &amp; Halos
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {HEADGEAR_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => patchAddons({ headGear: opt.id }, true)}
                              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border text-left truncate ${
                                ad.headGear === opt.id
                                  ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                  : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {ad.headGear !== 'none' && (
                          <div className="space-y-2 pl-2 border-l-2 border-[#7C5CFF]/40">
                            {renderSliderRow(
                              'Hat Scale',
                              ad.headGearScale,
                              0.6,
                              1.65,
                              0.04,
                              (val) => patchAddons({ headGearScale: val }),
                              '×'
                            )}
                            {renderSliderRow(
                              'Height Offset (Y)',
                              ad.headGearOffsetY,
                              -0.08,
                              0.14,
                              0.004,
                              (val) => patchAddons({ headGearOffsetY: val }),
                              'm'
                            )}
                            {renderSliderRow(
                              'Tilt Back / Forward',
                              ad.headGearRotX,
                              -35,
                              35,
                              1,
                              (val) => patchAddons({ headGearRotX: val }),
                              '°'
                            )}
                            {renderColorRow('Main Color', ad.headGearColor, (hex) =>
                              patchAddons({ headGearColor: hex })
                            )}
                            {renderColorRow('Trim / Jewel Color', ad.headGearAccentColor, (hex) =>
                              patchAddons({ headGearAccentColor: hex })
                            )}
                          </div>
                        )}
                      </div>

                      {/* Body Gear */}
                      <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                          Back, Neck &amp; Shoulder Gear
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {BODYGEAR_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => patchAddons({ bodyGear: opt.id }, true)}
                              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border text-left truncate ${
                                ad.bodyGear === opt.id
                                  ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                  : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {ad.bodyGear !== 'none' && (
                          <div className="space-y-2 pl-2 border-l-2 border-[#7C5CFF]/40">
                            {renderSliderRow(
                              'Gear Scale',
                              ad.bodyGearScale,
                              0.6,
                              1.65,
                              0.04,
                              (val) => patchAddons({ bodyGearScale: val }),
                              '×'
                            )}
                            {renderColorRow('Gear Color', ad.bodyGearColor, (hex) =>
                              patchAddons({ bodyGearColor: hex })
                            )}
                            {renderColorRow('Accent / Strap Color', ad.bodyGearAccentColor, (hex) =>
                              patchAddons({ bodyGearAccentColor: hex })
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}

              {inspectorTab === 'eyes' && (() => {
                const eyeCfg = ext.eyeSideConfig;
                const activeEyeSide = eyeEditSide === 'right' ? eyeCfg.right : eyeCfg.left;
                const browCfg = ext.eyebrowSideConfig;
                const activeBrowSide = eyebrowEditSide === 'right' ? browCfg.right : browCfg.left;
                const mouthCfg = ext.mouthSideConfig;
                const activeMouthSide = mouthEditSide === 'right' ? mouthCfg.right : mouthCfg.left;

                const syncEyeFlatFields = (s: CharacterEyeSideConfig) => ({
                  eyeFlatness: s.flatness,
                  eyeSize: s.size,
                  eyeAspectX: s.aspectX,
                  eyeAspectY: s.aspectY,
                  eyeSpacing: s.spacing,
                  eyeHeight: s.height,
                  eyeDepthOffset: s.depthOffset,
                  pupilStyle: s.pupilStyle,
                  pupilSize: s.pupilSize,
                  irisColor: s.irisColor,
                  scleraColor: s.scleraColor,
                  eyelidEnabled: s.eyelidEnabled,
                  eyelidRestHeight: s.eyelidRestHeight,
                  eyelidLowerEnabled: s.eyelidLowerEnabled,
                  eyelidColor: s.eyelidColor,
                });

                const patchEyeConfig = (patch: Partial<CharacterEyeSculptConfig>, record = false) =>
                  updateDoc(
                    (d) => {
                      const prev = resolveCharacterExtras(d).eyeSideConfig;
                      const next: CharacterEyeSculptConfig = { ...prev, ...patch };
                      if (patch.mirrorSides === true) {
                        const source = eyeEditSide === 'right' ? prev.right : prev.left;
                        next.left = { ...source };
                        next.right = { ...source };
                        return { ...d, ...syncEyeFlatFields(source), eyeSideConfig: next };
                      }
                      return { ...d, eyeSideConfig: next };
                    },
                    record
                  );

                const patchEyeSide = (patch: Partial<CharacterEyeSideConfig>, record = false) =>
                  updateDoc(
                    (d) => {
                      const prev = resolveCharacterExtras(d).eyeSideConfig;
                      if (eyeEditSide === 'both') {
                        const nextSide = { ...prev.left, ...patch };
                        return {
                          ...d,
                          ...syncEyeFlatFields(nextSide),
                          eyeSideConfig: {
                            mirrorSides: true,
                            left: nextSide,
                            right: { ...nextSide },
                          },
                        };
                      }
                      if (eyeEditSide === 'left') {
                        return {
                          ...d,
                          eyeSideConfig: {
                            ...prev,
                            mirrorSides: false,
                            left: { ...prev.left, ...patch },
                          },
                        };
                      }
                      return {
                        ...d,
                        eyeSideConfig: {
                          ...prev,
                          mirrorSides: false,
                          right: { ...prev.right, ...patch },
                        },
                      };
                    },
                    record
                  );

                const syncBrowFlatFields = (s: CharacterEyebrowSideConfig) => ({
                  eyebrowExpression: s.expression,
                  eyebrowSpacing: s.spacing,
                  eyebrowHeight: s.height,
                  eyebrowTiltDeg: s.tiltDeg,
                  eyebrowArch: s.arch,
                  eyebrowThickness: s.thickness,
                  eyebrowWidth: s.width,
                  eyebrowColor: s.color,
                });

                const patchBrowConfig = (patch: Partial<CharacterEyebrowSculptConfig>, record = false) =>
                  updateDoc(
                    (d) => {
                      const prev = resolveCharacterExtras(d).eyebrowSideConfig;
                      const next: CharacterEyebrowSculptConfig = { ...prev, ...patch };
                      if (patch.mirrorSides === true) {
                        const source = eyebrowEditSide === 'right' ? prev.right : prev.left;
                        next.left = { ...source };
                        next.right = { ...source };
                        return { ...d, ...syncBrowFlatFields(source), eyebrowSideConfig: next };
                      }
                      return { ...d, eyebrowSideConfig: next };
                    },
                    record
                  );

                const patchBrowSide = (patch: Partial<CharacterEyebrowSideConfig>, record = false) =>
                  updateDoc(
                    (d) => {
                      const prev = resolveCharacterExtras(d).eyebrowSideConfig;
                      if (eyebrowEditSide === 'both') {
                        const nextSide = { ...prev.left, ...patch };
                        return {
                          ...d,
                          ...syncBrowFlatFields(nextSide),
                          eyebrowSideConfig: {
                            mirrorSides: true,
                            left: nextSide,
                            right: { ...nextSide },
                          },
                        };
                      }
                      if (eyebrowEditSide === 'left') {
                        return {
                          ...d,
                          eyebrowSideConfig: {
                            ...prev,
                            mirrorSides: false,
                            left: { ...prev.left, ...patch },
                          },
                        };
                      }
                      return {
                        ...d,
                        eyebrowSideConfig: {
                          ...prev,
                          mirrorSides: false,
                          right: { ...prev.right, ...patch },
                        },
                      };
                    },
                    record
                  );

                const syncMouthFlatFields = (s: CharacterMouthSideConfig) => ({
                  mouthSize: s.size,
                  mouthWidthScale: s.widthScale,
                  mouthOpenAmount: s.openAmount,
                  mouthOffsetY: s.offsetY,
                  mouthOffsetZ: s.offsetZ,
                  mouthTiltDeg: s.tiltDeg,
                  mouthColor: s.color,
                });

                const patchMouthConfig = (patch: Partial<CharacterMouthSculptConfig>, record = false) =>
                  updateDoc(
                    (d) => {
                      const prev = resolveCharacterExtras(d).mouthSideConfig;
                      const next: CharacterMouthSculptConfig = { ...prev, ...patch };
                      if (patch.mirrorSides === true) {
                        const source = mouthEditSide === 'right' ? prev.right : prev.left;
                        next.left = { ...source };
                        next.right = { ...source };
                        return { ...d, ...syncMouthFlatFields(source), mouthSideConfig: next };
                      }
                      return { ...d, mouthSideConfig: next };
                    },
                    record
                  );

                const patchMouthSide = (patch: Partial<CharacterMouthSideConfig>, record = false) =>
                  updateDoc(
                    (d) => {
                      const prev = resolveCharacterExtras(d).mouthSideConfig;
                      if (mouthEditSide === 'both') {
                        const nextSide = { ...prev.left, ...patch };
                        return {
                          ...d,
                          ...syncMouthFlatFields(nextSide),
                          mouthSideConfig: {
                            mirrorSides: true,
                            left: nextSide,
                            right: { ...nextSide },
                          },
                        };
                      }
                      if (mouthEditSide === 'left') {
                        return {
                          ...d,
                          mouthSideConfig: {
                            ...prev,
                            mirrorSides: false,
                            left: { ...prev.left, ...patch },
                          },
                        };
                      }
                      return {
                        ...d,
                        mouthSideConfig: {
                          ...prev,
                          mirrorSides: false,
                          right: { ...prev.right, ...patch },
                        },
                      };
                    },
                    record
                  );

                const renderSideSelector = (opts: {
                  title: string;
                  mirrorSides: boolean;
                  onToggleMirror: (checked: boolean) => void;
                  editSide: 'both' | 'left' | 'right';
                  onChangeSide: (side: 'both' | 'left' | 'right') => void;
                  sideEnabled: boolean;
                  onToggleEnabled: (enabled: boolean) => void;
                }) => (
                  <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                        {opts.title}
                      </span>
                      <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={opts.mirrorSides}
                          onChange={(e) => opts.onToggleMirror(e.target.checked)}
                          className="accent-[#7C5CFF] rounded"
                        />
                        <span>Mirror Sides</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/80 dark:bg-[#141722]">
                      {(
                        [
                          { id: 'both', label: 'Both Sides' },
                          { id: 'left', label: 'Left Side' },
                          { id: 'right', label: 'Right Side' },
                        ] as const
                      ).map((sideOpt) => (
                        <button
                          key={sideOpt.id}
                          type="button"
                          onClick={() => opts.onChangeSide(sideOpt.id)}
                          className={`py-1 rounded-lg text-[10px] font-extrabold transition-colors ${
                            opts.editSide === sideOpt.id
                              ? 'bg-[#7C5CFF] text-white'
                              : 'text-slate-500 dark:text-[#8D95AA] hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {sideOpt.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-[#A4ACC0]">
                        {opts.editSide === 'both'
                          ? 'Both Sides Active'
                          : opts.editSide === 'left'
                            ? 'Left Side Active'
                            : 'Right Side Active'}
                      </span>
                      <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={opts.sideEnabled}
                          onChange={(e) => opts.onToggleEnabled(e.target.checked)}
                          className="accent-[#7C5CFF] rounded"
                        />
                        <span>Visible</span>
                      </label>
                    </div>
                  </div>
                );

                return (
                <>
                  {/* Eyes Shape (Disc <-> Full Sphere), Count & Pupils */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">Eye Count</span>
                      <div className="flex gap-1">
                        {([1, 2, 3, 4, 6] as const).map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => updateDoc((d) => ({ ...d, eyeCount: cnt }), true)}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold ${
                              doc.eyeCount === cnt
                                ? 'bg-[#7C5CFF] text-white'
                                : 'bg-white dark:bg-[#141722]'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {renderSideSelector({
                      title: 'Eye Side Controls',
                      mirrorSides: eyeCfg.mirrorSides,
                      onToggleMirror: (checked) => {
                        if (checked) setEyeEditSide('both');
                        else if (eyeEditSide === 'both') setEyeEditSide('left');
                        patchEyeConfig({ mirrorSides: checked }, true);
                      },
                      editSide: eyeEditSide,
                      onChangeSide: (side) => {
                        setEyeEditSide(side);
                        if (side === 'both' && !eyeCfg.mirrorSides) {
                          patchEyeConfig({ mirrorSides: true }, true);
                        }
                      },
                      sideEnabled: activeEyeSide.enabled,
                      onToggleEnabled: (enabled) => patchEyeSide({ enabled }, true),
                    })}

                    {renderSliderRow(
                      'Eye Shape (Flat Disc ↔ Full Sphere)',
                      activeEyeSide.flatness,
                      0.14,
                      1.0,
                      0.02,
                      (val) => patchEyeSide({ flatness: val })
                    )}
                    {renderSliderRow(
                      'Eye Size',
                      activeEyeSide.size,
                      0.024,
                      0.095,
                      0.002,
                      (val) => patchEyeSide({ size: val })
                    )}
                    {renderSliderRow(
                      'Eye Width Ratio',
                      activeEyeSide.aspectX,
                      0.65,
                      1.5,
                      0.05,
                      (val) => patchEyeSide({ aspectX: val })
                    )}
                    {renderSliderRow(
                      'Eye Height Ratio',
                      activeEyeSide.aspectY,
                      0.65,
                      1.5,
                      0.05,
                      (val) => patchEyeSide({ aspectY: val })
                    )}
                    {doc.eyeCount > 1 &&
                      renderSliderRow(
                        'Eye Spacing',
                        activeEyeSide.spacing,
                        0.04,
                        0.15,
                        0.004,
                        (val) => patchEyeSide({ spacing: val })
                      )}
                    {renderSliderRow(
                      'Vertical Eye Placement',
                      activeEyeSide.height,
                      -0.05,
                      0.11,
                      0.004,
                      (val) => patchEyeSide({ height: val })
                    )}
                    {renderSliderRow(
                      'Eye Depth (Set In ↔ Out)',
                      activeEyeSide.depthOffset,
                      -0.1,
                      0.06,
                      0.001,
                      (val) => patchEyeSide({ depthOffset: val }),
                      'm'
                    )}

                    <div className="grid grid-cols-3 gap-1">
                      {PUPIL_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => patchEyeSide({ pupilStyle: opt.id }, true)}
                          className={`py-1 px-1.5 rounded-xl text-[10px] font-bold border ${
                            activeEyeSide.pupilStyle === opt.id
                              ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                              : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {renderSliderRow(
                      'Pupil Size',
                      activeEyeSide.pupilSize,
                      0.25,
                      0.82,
                      0.02,
                      (val) => patchEyeSide({ pupilSize: val })
                    )}
                    {renderColorRow('Iris Color', activeEyeSide.irisColor, (hex) =>
                      patchEyeSide({ irisColor: hex })
                    )}
                    {renderColorRow('Sclera Color', activeEyeSide.scleraColor, (hex) =>
                      patchEyeSide({ scleraColor: hex })
                    )}
                  </div>

                  {/* Eyelids (Rest Height from Barely Over Eye to Sleepy to Closed + Blink) */}
                  <div className="p-3 rounded-2xl border border-[#20B46A]/40 bg-[#20B46A]/8 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-extrabold text-[#20B46A]">
                        <input
                          type="checkbox"
                          checked={activeEyeSide.eyelidEnabled}
                          onChange={(e) => patchEyeSide({ eyelidEnabled: e.target.checked }, true)}
                          className="accent-[#20B46A]"
                        />
                        <span>
                          Eyelids &amp; Blink
                          {eyeEditSide !== 'both' ? ` (${eyeEditSide === 'left' ? 'Left' : 'Right'})` : ''}
                        </span>
                      </label>
                      {activeEyeSide.eyelidEnabled && (
                        <button
                          type="button"
                          onClick={triggerManualBlink}
                          className="px-2.5 py-1 rounded-lg bg-[#20B46A] text-white text-[11px] font-extrabold"
                        >
                          Test Blink
                        </button>
                      )}
                    </div>
                    {activeEyeSide.eyelidEnabled && (
                      <>
                        {renderSliderRow(
                          'Eyelid Rest Height (Wide ↔ Sleepy ↔ Shut)',
                          activeEyeSide.eyelidRestHeight,
                          0.0,
                          1.0,
                          0.02,
                          (val) => patchEyeSide({ eyelidRestHeight: val })
                        )}
                        <div className="flex items-center justify-between text-xs font-bold">
                          <label className="inline-flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={activeEyeSide.eyelidLowerEnabled}
                              onChange={(e) =>
                                patchEyeSide({ eyelidLowerEnabled: e.target.checked }, true)
                              }
                              className="accent-[#20B46A]"
                            />
                            <span>Lower Rim</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={doc.autoBlink}
                              onChange={(e) =>
                                updateDoc((d) => ({ ...d, autoBlink: e.target.checked }), true)
                              }
                              className="accent-[#20B46A]"
                            />
                            <span>Auto Blink</span>
                          </label>
                        </div>
                        {renderColorRow('Eyelid Color', activeEyeSide.eyelidColor, (hex) =>
                          patchEyeSide({ eyelidColor: hex })
                        )}
                      </>
                    )}
                  </div>

                  {/* Eyebrows */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <label className="flex items-center justify-between text-xs font-extrabold">
                      <span>Adjustable Eyebrows</span>
                      <input
                        type="checkbox"
                        checked={doc.eyebrowEnabled}
                        onChange={(e) =>
                          updateDoc((d) => ({ ...d, eyebrowEnabled: e.target.checked }), true)
                        }
                        className="accent-[#7C5CFF]"
                      />
                    </label>
                    {doc.eyebrowEnabled && (
                      <>
                        {renderSideSelector({
                          title: 'Eyebrow Side Controls',
                          mirrorSides: browCfg.mirrorSides,
                          onToggleMirror: (checked) => {
                            if (checked) setEyebrowEditSide('both');
                            else if (eyebrowEditSide === 'both') setEyebrowEditSide('left');
                            patchBrowConfig({ mirrorSides: checked }, true);
                          },
                          editSide: eyebrowEditSide,
                          onChangeSide: (side) => {
                            setEyebrowEditSide(side);
                            if (side === 'both' && !browCfg.mirrorSides) {
                              patchBrowConfig({ mirrorSides: true }, true);
                            }
                          },
                          sideEnabled: activeBrowSide.enabled,
                          onToggleEnabled: (enabled) => patchBrowSide({ enabled }, true),
                        })}

                        <div className="flex flex-wrap gap-1">
                          {BROW_EXPR_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => patchBrowSide({ expression: opt.id }, true)}
                              className={`px-2 py-1 rounded-xl text-[10px] font-bold border ${
                                activeBrowSide.expression === opt.id
                                  ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                  : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {doc.eyeCount > 1 &&
                          renderSliderRow(
                            'Brow Spacing (Closer ↔ Wider)',
                            activeBrowSide.spacing,
                            0.02,
                            0.17,
                            0.004,
                            (val) => patchBrowSide({ spacing: val }),
                            'm'
                          )}
                        {renderSliderRow(
                          'Brow Height',
                          activeBrowSide.height,
                          -0.01,
                          0.065,
                          0.002,
                          (val) => patchBrowSide({ height: val })
                        )}
                        {renderSliderRow(
                          'Brow Tilt (Fierce ↔ Worried)',
                          activeBrowSide.tiltDeg,
                          -35,
                          35,
                          1,
                          (val) => patchBrowSide({ tiltDeg: val }),
                          '°'
                        )}
                        {renderSliderRow(
                          'Brow Arch Curve',
                          activeBrowSide.arch,
                          -0.2,
                          1.2,
                          0.05,
                          (val) => patchBrowSide({ arch: val })
                        )}
                        {renderSliderRow(
                          'Brow Thickness',
                          activeBrowSide.thickness,
                          0.006,
                          0.026,
                          0.001,
                          (val) => patchBrowSide({ thickness: val })
                        )}
                        {renderColorRow('Eyebrow Color', activeBrowSide.color, (hex) =>
                          patchBrowSide({ color: hex })
                        )}
                      </>
                    )}

                  </div>

                  {/* Beak Maker */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <div className="text-xs font-extrabold">Beak Maker</div>
                    <div className="grid grid-cols-2 gap-1">
                      {BEAK_PRESET_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            updateDoc((d) => {
                              const defs =
                                opt.id === 'none' ? {} : getBeakPresetDefaults(opt.id as CharacterBeakStyle);
                              return {
                                ...d,
                                beakStyle: opt.id,
                                ...defs,
                                mouthStyle: opt.id !== 'none' && d.mouthStyle === 'beak' ? 'none' : d.mouthStyle,
                              };
                            }, true)
                          }
                          className={`py-1 px-1.5 rounded-xl text-[10px] font-bold border truncate ${
                            ext.beakStyle === opt.id
                              ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                              : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {ext.beakStyle !== 'none' && (
                      <>
                        {renderSliderRow(
                          'Beak Length',
                          ext.beakLength,
                          0.03,
                          0.32,
                          0.005,
                          (val) => updateDoc((d) => ({ ...d, beakLength: val })),
                          'm'
                        )}
                        {renderSliderRow(
                          'Beak Width',
                          ext.beakWidth,
                          0.02,
                          0.14,
                          0.003,
                          (val) => updateDoc((d) => ({ ...d, beakWidth: val })),
                          'm'
                        )}
                        {renderSliderRow(
                          'Beak Height',
                          ext.beakHeight,
                          0.02,
                          0.13,
                          0.003,
                          (val) => updateDoc((d) => ({ ...d, beakHeight: val })),
                          'm'
                        )}
                        {renderSliderRow(
                          'Hook Curve',
                          ext.beakHook,
                          -0.2,
                          1.2,
                          0.04,
                          (val) => updateDoc((d) => ({ ...d, beakHook: val }))
                        )}
                        {renderSliderRow(
                          'Beak Openness',
                          ext.beakOpen,
                          0,
                          0.45,
                          0.02,
                          (val) => updateDoc((d) => ({ ...d, beakOpen: val }))
                        )}
                        {renderColorRow('Upper Beak Color', ext.beakColor, (hex) =>
                          updateDoc((d) => ({ ...d, beakColor: hex }))
                        )}
                        {renderColorRow('Lower Beak / Pouch Color', ext.beakLowerColor, (hex) =>
                          updateDoc((d) => ({ ...d, beakLowerColor: hex }))
                        )}
                      </>
                    )}
                  </div>

                  {/* Shapeable Nose & Movable Muzzle Nostrils */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <div className="text-xs font-extrabold">Nose &amp; Muzzle Nostrils</div>
                    <div className="grid grid-cols-2 gap-1">
                      {NOSE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateDoc((d) => ({ ...d, noseStyle: opt.id }), true)}
                          className={`py-1 px-1.5 rounded-xl text-[10px] font-bold border truncate ${
                            ext.noseStyle === opt.id
                              ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                              : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {ext.noseStyle !== 'none' && (
                      <>
                        {renderSliderRow(
                          'Nose Size',
                          ext.noseSize,
                          0.01,
                          0.06,
                          0.002,
                          (val) => updateDoc((d) => ({ ...d, noseSize: val })),
                          'm'
                        )}
                        {renderSliderRow(
                          'Nose Width (X)',
                          ext.noseScaleX,
                          0.4,
                          2.0,
                          0.05,
                          (val) => updateDoc((d) => ({ ...d, noseScaleX: val }))
                        )}
                        {renderSliderRow(
                          'Nose Height (Y)',
                          ext.noseScaleY,
                          0.4,
                          2.0,
                          0.05,
                          (val) => updateDoc((d) => ({ ...d, noseScaleY: val }))
                        )}
                        {renderSliderRow(
                          'Nose Depth / Flatness (Z)',
                          ext.noseScaleZ,
                          0.2,
                          2.0,
                          0.05,
                          (val) => updateDoc((d) => ({ ...d, noseScaleZ: val }))
                        )}
                        {renderSliderRow(
                          'Nose Up / Down',
                          ext.noseOffsetY,
                          -0.06,
                          0.06,
                          0.002,
                          (val) => updateDoc((d) => ({ ...d, noseOffsetY: val })),
                          'm'
                        )}
                        {renderSliderRow(
                          'Nose Forward / Back',
                          ext.noseOffsetZ,
                          -0.04,
                          0.06,
                          0.002,
                          (val) => updateDoc((d) => ({ ...d, noseOffsetZ: val })),
                          'm'
                        )}
                        {renderColorRow('Nose Color', ext.noseColor, (hex) =>
                          updateDoc((d) => ({ ...d, noseColor: hex }))
                        )}
                      </>
                    )}

                    <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.06] space-y-2.5">
                      <label className="flex items-center justify-between text-xs font-extrabold">
                        <span>Movable Nostrils (Horse / Moose)</span>
                        <input
                          type="checkbox"
                          checked={ext.nostrilsEnabled}
                          onChange={(e) =>
                            updateDoc((d) => ({ ...d, nostrilsEnabled: e.target.checked }), true)
                          }
                          className="accent-[#7C5CFF]"
                        />
                      </label>
                      {ext.nostrilsEnabled && (
                        <>
                          <div className="grid grid-cols-3 gap-1">
                            {NOSTRIL_STYLE_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => updateDoc((d) => ({ ...d, nostrilStyle: opt.id }), true)}
                                className={`py-1 px-1.5 rounded-xl text-[10px] font-bold border ${
                                  ext.nostrilStyle === opt.id
                                    ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                    : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {renderSliderRow(
                            'Front ↔ Side Wrap Angle',
                            ext.nostrilSideAngleDeg,
                            4,
                            90,
                            1,
                            (val) => updateDoc((d) => ({ ...d, nostrilSideAngleDeg: val })),
                            '°'
                          )}
                          {renderSliderRow(
                            'Nostril Height (Up / Down)',
                            ext.nostrilHeightOffset,
                            -0.04,
                            0.05,
                            0.002,
                            (val) => updateDoc((d) => ({ ...d, nostrilHeightOffset: val })),
                            'm'
                          )}
                          {renderSliderRow(
                            'Nostril Forward / Back',
                            ext.nostrilForwardOffset,
                            -0.06,
                            0.05,
                            0.002,
                            (val) => updateDoc((d) => ({ ...d, nostrilForwardOffset: val })),
                            'm'
                          )}
                          {renderSliderRow(
                            'Nostril Size',
                            ext.nostrilSize,
                            0.4,
                            2.2,
                            0.05,
                            (val) => updateDoc((d) => ({ ...d, nostrilSize: val })),
                            '×'
                          )}
                          {renderColorRow('Nostril Pit Color', ext.nostrilColor, (hex) =>
                            updateDoc((d) => ({ ...d, nostrilColor: hex }))
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mouth, Flat Pink Tongue & Teeth */}
                  <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-[#1B1F2E] space-y-3">
                    <div className="text-xs font-extrabold">Mouth, Tongue &amp; Teeth</div>
                    <div className="grid grid-cols-2 gap-1">
                      {MOUTH_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateDoc((d) => ({ ...d, mouthStyle: opt.id }), true)}
                          className={`py-1 px-1.5 rounded-xl text-[10px] font-bold border truncate ${
                            doc.mouthStyle === opt.id
                              ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                              : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {doc.mouthStyle !== 'none' && doc.mouthStyle !== 'beak' && (
                      <>
                        {renderSideSelector({
                          title: 'Mouth Side Controls',
                          mirrorSides: mouthCfg.mirrorSides,
                          onToggleMirror: (checked) => {
                            if (checked) setMouthEditSide('both');
                            else if (mouthEditSide === 'both') setMouthEditSide('left');
                            patchMouthConfig({ mirrorSides: checked }, true);
                          },
                          editSide: mouthEditSide,
                          onChangeSide: (side) => {
                            setMouthEditSide(side);
                            if (side === 'both' && !mouthCfg.mirrorSides) {
                              patchMouthConfig({ mirrorSides: true }, true);
                            }
                          },
                          sideEnabled: activeMouthSide.enabled,
                          onToggleEnabled: (enabled) => patchMouthSide({ enabled }, true),
                        })}

                        {renderSliderRow(
                          'Mouth Size',
                          activeMouthSide.size,
                          0.5,
                          1.75,
                          0.05,
                          (val) => patchMouthSide({ size: val }),
                          '×'
                        )}
                        {renderSliderRow(
                          'Mouth Width Scale',
                          activeMouthSide.widthScale,
                          0.5,
                          1.8,
                          0.05,
                          (val) => patchMouthSide({ widthScale: val }),
                          '×'
                        )}
                        {isOpenMouthStyle(doc.mouthStyle) &&
                          renderSliderRow(
                            'Mouth Openness',
                            activeMouthSide.openAmount,
                            0.3,
                            1.4,
                            0.04,
                            (val) => patchMouthSide({ openAmount: val })
                          )}
                        {renderSliderRow(
                          'Placement Up / Down',
                          activeMouthSide.offsetY,
                          -0.08,
                          0.08,
                          0.002,
                          (val) => patchMouthSide({ offsetY: val }),
                          'm'
                        )}
                        {renderSliderRow(
                          'Depth to Surface (Flush In ↔ Out)',
                          activeMouthSide.offsetZ,
                          -0.028,
                          0.028,
                          0.001,
                          (val) => patchMouthSide({ offsetZ: val }),
                          'm'
                        )}
                        {renderSliderRow(
                          mouthEditSide === 'both' ? 'Mouth Pitch Tilt' : 'Side Corner Tilt',
                          activeMouthSide.tiltDeg,
                          -45,
                          45,
                          1,
                          (val) => patchMouthSide({ tiltDeg: val }),
                          '°'
                        )}

                        {isOpenMouthStyle(doc.mouthStyle) ? (
                          <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.06] space-y-2.5">
                            <label className="flex items-center justify-between text-xs font-bold">
                              <span>Carve Muzzle Recess</span>
                              <input
                                type="checkbox"
                                checked={ext.mouthRecessEnabled}
                                onChange={(e) =>
                                  updateDoc((d) => ({ ...d, mouthRecessEnabled: e.target.checked }), true)
                                }
                                className="accent-[#7C5CFF]"
                              />
                            </label>
                            <label className="flex items-center justify-between text-xs font-bold">
                              <span>Mid-Pink Cartoon Tongue</span>
                              <input
                                type="checkbox"
                                checked={ext.mouthTongueEnabled}
                                onChange={(e) =>
                                  updateDoc((d) => ({ ...d, mouthTongueEnabled: e.target.checked }), true)
                                }
                                className="accent-[#EC4899]"
                              />
                            </label>
                            {ext.mouthTongueEnabled &&
                              renderColorRow('Tongue Color', ext.mouthTongueColor, (hex) =>
                                updateDoc((d) => ({ ...d, mouthTongueColor: hex }))
                              )}

                            <div className="text-xs font-extrabold pt-1">Teeth Style</div>
                            <div className="grid grid-cols-2 gap-1">
                              {TEETH_OPTIONS.map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() =>
                                    updateDoc((d) => ({ ...d, mouthTeethStyle: opt.id }), true)
                                  }
                                  className={`py-1 px-1.5 rounded-xl text-[10px] font-bold border truncate ${
                                    ext.mouthTeethStyle === opt.id
                                      ? 'bg-[#7C5CFF] text-white border-[#7C5CFF]'
                                      : 'bg-white dark:bg-[#141722] border-slate-200/70 dark:border-white/[0.07]'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>

                            {ext.mouthTeethStyle === 'buck' && (
                              <div className="p-2 rounded-xl bg-white/70 dark:bg-[#141722]/90 space-y-2">
                                {renderSliderRow(
                                  'Buck Teeth Size / Length',
                                  ext.buckTeethSize,
                                  0.5,
                                  1.8,
                                  0.05,
                                  (val) => updateDoc((d) => ({ ...d, buckTeethSize: val })),
                                  '×'
                                )}
                                {renderSliderRow(
                                  'Top Root Width',
                                  ext.buckTeethTopWidth,
                                  0.35,
                                  1.5,
                                  0.04,
                                  (val) => updateDoc((d) => ({ ...d, buckTeethTopWidth: val }))
                                )}
                                {renderSliderRow(
                                  'Bottom Tip Width',
                                  ext.buckTeethBottomWidth,
                                  0.35,
                                  1.5,
                                  0.04,
                                  (val) => updateDoc((d) => ({ ...d, buckTeethBottomWidth: val }))
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          renderColorRow('Mouth Line Color', activeMouthSide.color, (hex) =>
                            patchMouthSide({ color: hex })
                          )
                        )}
                      </>
                    )}
                  </div>
                </>
                );
              })()}

              {inspectorTab === 'paint' && (
                <VertexPaintInspector
                  brush={paintBrush}
                  onChangeBrush={setPaintBrush}
                  interactionTool={paintTool}
                  onChangeInteractionTool={setPaintTool}
                  strokeCount={paintStrokes.length}
                  canRedo={paintRedoStack.length > 0}
                  accentColor="#A855F7"
                  onUndoStroke={() => {
                    setPaintStrokes((prev) => {
                      if (prev.length === 0) return prev;
                      const popped = prev[prev.length - 1];
                      setPaintRedoStack((r) => [...r, popped]);
                      return prev.slice(0, -1);
                    });
                  }}
                  onRedoStroke={() => {
                    setPaintRedoStack((stack) => {
                      if (stack.length === 0) return stack;
                      const restored = stack[stack.length - 1];
                      setPaintStrokes((prev) => [...prev, restored]);
                      return stack.slice(0, -1);
                    });
                  }}
                  onClearAllPaint={() => {
                    setPaintStrokes([]);
                    setPaintRedoStack([]);
                    flashToast('Cleared vertex paint');
                  }}
                  onAutoDapple={() => {
                    const root = studioRef.current?.built?.root;
                    if (!root) return;
                    const stroke = generateOrganicDappleStroke(
                      root,
                      paintBrush,
                      Math.floor(Math.random() * 900000) + 100
                    );
                    if (stroke) {
                      setPaintStrokes((prev) => [...prev, stroke]);
                      setPaintRedoStack([]);
                      flashToast('Applied organic paint mottling');
                    }
                  }}
                />
              )}
            </div>
          </aside>
        </div>
      </div>
      {showingSketchModal && (
        <CharacterSketchModal
          doc={doc}
          charName={charName}
          onSave={(nextDoc) => {
            updateDoc(() => nextDoc, true);
            setShowingSketchModal(false);
          }}
          onClose={() => setShowingSketchModal(false)}
        />
      )}
    </div>
  );
};
