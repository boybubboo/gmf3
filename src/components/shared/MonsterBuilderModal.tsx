import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  Eye,
  Flame,
  Layers,
  Pencil,
  Play,
  Plus,
  Redo2,
  Save,
  Skull,
  Sparkles,
  Undo2,
  Wand2,
  X,
} from 'lucide-react';
import { CreatureSketchModal } from './CreatureSketchModal';
import {
  requestOpenContextualAiModal,
  useRegisterStudioAiBridge,
} from '../../ai/studioBridge';
import { sanitizeMonsterResult } from '../../ai/aiAppliers';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  BaddieWindupClueStyle,
  CharacterEyePupilStyle,
  CharacterMaterialFinish,
  CharacterSurfaceCoatMode,
  CreatureExpressionMood,
  MonsterAbilityId,
  MonsterAttackType,
  MonsterBlueprint,
  MonsterEarStyle,
  MonsterHeadStyle,
  MonsterHornStyle,
  MonsterLegPairConfig,
  MonsterNoseStyle,
  MonsterPartKey,
  MonsterPawStyle,
  MonsterRole,
  MonsterSegmentProfile,
  MonsterSpikeStyle,
  MonsterTailStyle,
  MonsterTeethStyle,
  MonsterWingStyle,
} from '../../types/maker';
import { WINDUP_CLUE_OPTIONS } from '../../data/baddieActionLibrary';
import {
  createMakerRenderer,
  detectSoftwareGl,
  disposeObject3D,
  setupSceneEnvironment,
} from '../../three/islandScene';
import { isWebGPUFallbackAdapter } from '../../three/webglUtils';
import {
  animateQuadrupedMonster,
  buildQuadrupedMonsterMesh,
  createDefaultMonsterBlueprint,
  createRandomMonsterBlueprint,
  MONSTER_PRESETS,
  resolveMonsterBlueprint,
  type QuadrupedAnimState,
  type QuadrupedMonsterRig,
  type ResolvedMonsterBlueprint,
} from '../../three/quadrupedMonsterBuilder';
import {
  MONSTER_ABILITY_BY_ID,
  MONSTER_ABILITY_CATALOG,
  MONSTER_ATTACK_BY_ID,
  MONSTER_ATTACK_CATALOG,
  MonsterAttackVfxController,
} from '../../three/monsterAttackVfx';
import {
  createMonsterSegmentOverlay,
  type MonsterSegmentOverlayController,
} from '../../three/monsterSegmentOverlay';
import { AudioEngine } from '../../utils/audio';

export interface MonsterBuilderModalProps {
  store: MakerStore;
  initialBlueprint?: MonsterBlueprint | null;
  editingEntityId?: string | null;
  onClose: () => void;
}

type PreviewAction = 'idle' | 'walk' | 'run' | 'fly' | 'primaryAttack' | 'secondaryAttack' | 'celebrate';
type CameraPreset = 'fullBody' | 'head' | 'side' | 'back';

const BODY_PART_GROUPS: {
  group: string;
  items: { key: MonsterPartKey; label: string }[];
}[] = [
  {
    group: 'Core Torso',
    items: [
      { key: 'chest', label: 'Chest & Shoulders' },
      { key: 'torso', label: 'Mid Torso & Spine' },
      { key: 'hips', label: 'Hips & Haunches' },
      { key: 'belly', label: 'Belly Underplate' },
    ],
  },
  {
    group: 'Head & Face',
    items: [
      { key: 'neck', label: 'Neck(s) & Spread' },
      { key: 'head', label: 'Head, Cranium & Jaw' },
      { key: 'muzzle', label: 'Snout & Muzzle' },
      { key: 'nose', label: 'Nose & Nostrils' },
      { key: 'mouth', label: 'Mouth & Expressions' },
      { key: 'teeth', label: 'Teeth & Fangs' },
      { key: 'eyes', label: 'Eyes & Eyelids' },
      { key: 'eyebrows', label: 'Eyebrows & Moods' },
      { key: 'ears', label: 'Ears & Frills' },
      { key: 'horns', label: 'Horns & Crests' },
    ],
  },
  {
    group: 'Limbs & Appendages',
    items: [
      { key: 'frontLegs', label: 'Front Legs & Paws' },
      { key: 'rearLegs', label: 'Rear Legs & Paws' },
      { key: 'midLegs', label: 'Middle / Extra Legs' },
      { key: 'wings', label: 'Wings & Flight' },
      { key: 'tail', label: 'Tail & Tip' },
    ],
  },
  {
    group: 'Surface & Combat',
    items: [
      { key: 'spikes', label: 'Dorsal Spikes & Armor' },
      { key: 'coat', label: 'Skin, Fur & Scales Coat' },
      { key: 'combat', label: 'Special Attacks & Ability' },
    ],
  },
];

const ALL_PART_KEYS: MonsterPartKey[] = BODY_PART_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const HEAD_OPTIONS: { id: MonsterHeadStyle; label: string }[] = [
  { id: 'wolf', label: 'Wolf / Fox' },
  { id: 'dragon', label: 'Dragon' },
  { id: 'demon', label: 'Horned Beast' },
  { id: 'dino', label: 'Dino' },
  { id: 'fluffy', label: 'Bear / Fluffy' },
  { id: 'spider', label: 'Spider' },
];

const HORN_OPTIONS: { id: MonsterHornStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'twinHorns', label: 'Twin Horns' },
  { id: 'ramCurl', label: 'Ram Curl' },
  { id: 'stagAntlers', label: 'Stag Antlers' },
  { id: 'crownSpikes', label: 'Crown Spikes' },
  { id: 'rhinoHorn', label: 'Rhino Horn' },
  { id: 'unicorn', label: 'Unicorn Spire' },
  { id: 'devilSweep', label: 'Devil Sweep' },
  { id: 'crystalCrown', label: 'Crystal Crown' },
];

const EAR_OPTIONS: { id: MonsterEarStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'wolfPerk', label: 'Wolf Perk' },
  { id: 'foxTall', label: 'Fox Tall' },
  { id: 'bearRound', label: 'Bear Round' },
  { id: 'floppy', label: 'Floppy Hound' },
  { id: 'batFin', label: 'Bat Fin' },
  { id: 'frill', label: 'Dragon Frill' },
];

const WING_OPTIONS: { id: MonsterWingStyle; label: string }[] = [
  { id: 'none', label: 'No Wings' },
  { id: 'dragonBat', label: 'Dragon / Bat' },
  { id: 'feathered', label: 'Feathered' },
  { id: 'fairyInsect', label: 'Fairy / Insect' },
  { id: 'wyvern', label: 'Wyvern Leather' },
  { id: 'elementalEnergy', label: 'Elemental Energy' },
];

const TAIL_OPTIONS: { id: MonsterTailStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'bushy', label: 'Bushy Plume' },
  { id: 'dragonSpiked', label: 'Dragon Taper' },
  { id: 'club', label: 'Club Mace' },
  { id: 'stinger', label: 'Scorpion Stinger' },
  { id: 'shortStub', label: 'Short Stub' },
  { id: 'whip', label: 'Long Whip' },
  { id: 'bladeFin', label: 'Blade Fin' },
  { id: 'twinFork', label: 'Twin Fork' },
];

const PAW_OPTIONS: { id: MonsterPawStyle; label: string }[] = [
  { id: 'paw', label: 'Rounded Paw' },
  { id: 'claw', label: 'Sharp Claws' },
  { id: 'talon', label: 'Raptor Talons' },
  { id: 'hoof', label: 'Hooves' },
  { id: 'arachnid', label: 'Arachnid Tip' },
  { id: 'stump', label: 'Clay Stump' },
];

const SPIKE_OPTIONS: { id: MonsterSpikeStyle; label: string }[] = [
  { id: 'boneSpikes', label: 'Bone Spikes' },
  { id: 'dorsalFins', label: 'Dorsal Fins' },
  { id: 'crystalSpines', label: 'Crystal Spines' },
  { id: 'armoredPlates', label: 'Armor Plates' },
  { id: 'maneTufts', label: 'Mane Tufts' },
];

const EXPRESSION_MOOD_OPTIONS: { id: CreatureExpressionMood; label: string }[] = [
  { id: 'closed', label: 'Closed' },
  { id: 'open', label: 'Open' },
  { id: 'angry', label: 'Angry' },
  { id: 'happy', label: 'Happy' },
  { id: 'shy', label: 'Shy' },
];

const TEETH_OPTIONS: { id: MonsterTeethStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'strips', label: 'Flat Strips' },
  { id: 'canine', label: 'Fangs' },
  { id: 'stripsAndCanine', label: 'Strips + Fangs' },
  { id: 'buck', label: 'Buck Teeth' },
];

const NOSE_OPTIONS: { id: MonsterNoseStyle; label: string }[] = [
  { id: 'round', label: 'Round Button' },
  { id: 'oval', label: 'Oval Pad' },
  { id: 'triangle', label: 'Soft Triangle' },
  { id: 'snoutPad', label: 'Pig / Snout Pad' },
  { id: 'nostrilsOnly', label: 'Nostrils Only' },
  { id: 'none', label: 'None' },
];

const COAT_OPTIONS: { id: CharacterSurfaceCoatMode; label: string }[] = [
  { id: 'none', label: 'Smooth Clay' },
  { id: 'furShort', label: 'Short Fur' },
  { id: 'furLong', label: 'Long Shaggy Fur' },
  { id: 'furClumped', label: 'Clumped Tufts' },
  { id: 'scalesFish', label: 'Fish Scales' },
  { id: 'scalesDragon', label: 'Dragon Scales' },
  { id: 'scalesHex', label: 'Hex Armor' },
];

const PUPIL_OPTIONS: { id: CharacterEyePupilStyle; label: string }[] = [
  { id: 'round', label: 'Round' },
  { id: 'catSlit', label: 'Dragon Slit' },
  { id: 'oval', label: 'Vertical Oval' },
  { id: 'starry', label: 'Starry' },
  { id: 'glow', label: 'Glowing Void' },
];

const FINISH_OPTIONS: { id: CharacterMaterialFinish; label: string }[] = [
  { id: 'clay', label: 'Matte Clay' },
  { id: 'toonSatin', label: 'Toon Satin' },
  { id: 'glossySlime', label: 'Glossy Slime' },
  { id: 'velvetCreature', label: 'Velvet Fur' },
];

const ROLE_OPTIONS: { id: MonsterRole; label: string; desc: string }[] = [
  { id: 'baddie', label: 'Monster Foe', desc: 'Patrols, chases & battles hero' },
  { id: 'npc', label: 'Friendly Critter', desc: 'Wanders peacefully & talks' },
  { id: 'buddy', label: 'Buddy Companion', desc: 'Joins & follows the hero' },
];

const COLOR_SWATCHES = [
  '#B91C1C', '#D95F28', '#F59E0B', '#10B981', '#0F766E',
  '#2563EB', '#7C3AED', '#EC4899', '#6D442B', '#6B7280', '#1F2937', '#F3F4F6',
];

function ProfileCurvePreview({ profile }: { profile: Pick<MonsterSegmentProfile, 'startRadius' | 'midRadius' | 'endRadius' | 'curvature' | 'color'> }) {
  const maxR = Math.max(0.06, profile.startRadius, profile.midRadius, profile.endRadius) * 1.18;
  const toY = (r: number, sign: number) => 24 + sign * THREE.MathUtils.clamp((r / maxR) * 18, 2, 20);
  const bow = profile.curvature * 5;
  const top = `M 14 ${toY(profile.startRadius, -1).toFixed(1)} Q 50 ${(toY(profile.midRadius, -1) - bow).toFixed(1)} 86 ${toY(profile.endRadius, -1).toFixed(1)}`;
  const bot = `L 86 ${toY(profile.endRadius, 1).toFixed(1)} Q 50 ${(toY(profile.midRadius, 1) + bow).toFixed(1)} 14 ${toY(profile.startRadius, 1).toFixed(1)} Z`;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] px-2.5 py-1.5">
      <svg viewBox="0 0 100 48" className="h-10 w-24 shrink-0">
        <path d={`${top} ${bot}`} fill={profile.color || '#7C5CFF'} fillOpacity={0.32} stroke={profile.color || '#7C5CFF'} strokeWidth={1.6} />
        <line x1={14} y1={24} x2={86} y2={24} stroke="currentColor" strokeOpacity={0.22} strokeDasharray="3 2" />
        <circle cx={14} cy={24} r={2.2} fill="#38BDF8" />
        <circle cx={50} cy={24} r={2.2} fill="#FACC15" />
        <circle cx={86} cy={24} r={2.2} fill="#F472B6" />
      </svg>
      <div className="flex flex-1 flex-col gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
        <div className="flex justify-between">
          <span>Start R</span>
          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{profile.startRadius.toFixed(2)}m</span>
        </div>
        <div className="flex justify-between">
          <span>Mid R</span>
          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{profile.midRadius.toFixed(2)}m</span>
        </div>
        <div className="flex justify-between">
          <span>End R</span>
          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{profile.endRadius.toFixed(2)}m</span>
        </div>
      </div>
    </div>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
  onChange: (v: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  decimals = 2,
  onChange,
  onDragStart,
  onDragEnd,
}) => (
  <label className="block space-y-1">
    <div className="flex items-center justify-between text-[11px]">
      <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <span className="font-mono text-[10.5px] font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
        {value.toFixed(decimals)}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={THREE.MathUtils.clamp(value, min, max)}
      onPointerDown={onDragStart}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      onBlur={onDragEnd}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 accent-[#7C5CFF] cursor-pointer"
    />
  </label>
);

const ColorField: React.FC<{
  label: string;
  value: string;
  onChange: (hex: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#191E2B] px-2.5 py-1.5">
    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{label}</span>
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1">
        {COLOR_SWATCHES.slice(0, 6).map((sw) => (
          <button
            key={sw}
            type="button"
            onClick={() => onChange(sw)}
            title={sw}
            className={`w-3.5 h-3.5 rounded-full border transition-transform ${
              value.toLowerCase() === sw.toLowerCase()
                ? 'border-white scale-110 ring-1 ring-[#7C5CFF]'
                : 'border-black/20 hover:scale-110'
            }`}
            style={{ backgroundColor: sw }}
          />
        ))}
      </div>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-5 rounded border border-slate-300 dark:border-white/15 bg-transparent cursor-pointer"
      />
    </div>
  </div>
);

export const MonsterBuilderModal: React.FC<MonsterBuilderModalProps> = ({
  store,
  initialBlueprint,
  editingEntityId,
  onClose,
}) => {
  const [bp, setBp] = useState<ResolvedMonsterBlueprint>(() =>
    resolveMonsterBlueprint(
      initialBlueprint ? { ...initialBlueprint } : createDefaultMonsterBlueprint('twin_dragon')
    )
  );
  const [undoStack, setUndoStack] = useState<ResolvedMonsterBlueprint[]>([]);
  const [redoStack, setRedoStack] = useState<ResolvedMonsterBlueprint[]>([]);
  const [activePart, setActivePart] = useState<MonsterPartKey>('chest');
  const [legSubTab, setLegSubTab] = useState<'placement' | 'upper' | 'lower' | 'paws'>('placement');
  const [previewAction, setPreviewAction] = useState<PreviewAction>(() =>
    initialBlueprint?.canFly ? 'fly' : 'idle'
  );
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showPartHighlights, setShowPartHighlights] = useState(true);
  const [crispResMode, setCrispResMode] = useState(true);
  const [showingSketchModal, setShowingSketchModal] = useState(false);
  const [isSliderActive, setIsSliderActive] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [oneShotAttack, setOneShotAttack] = useState<{
    attack: MonsterAttackType;
    startedAt: number;
  } | null>(null);

  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const studioRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: WebGPURenderer;
    controls: OrbitControls;
    holder: THREE.Group;
    rig: QuadrupedMonsterRig | null;
    skeletonHelper: THREE.SkeletonHelper | null;
    segmentOverlay: MonsterSegmentOverlayController | null;
    vfx: MonsterAttackVfxController;
    cameraFocusAnim: { targetPos: THREE.Vector3; targetLook: THREE.Vector3 } | null;
  } | null>(null);

  const latestRef = useRef({
    action: previewAction,
    showSkeleton,
    showPartHighlights,
    activePart,
    oneShotAttack,
    primaryAttack: bp.primaryAttack,
    secondaryAttack: bp.secondaryAttack,
    mouthMood: bp.mouth.mood,
    eyebrowMood: bp.eyebrows.mood,
    windupClueStyle: bp.baddieAI?.windupClueStyle,
  });
  latestRef.current = {
    action: previewAction,
    showSkeleton,
    showPartHighlights,
    activePart,
    oneShotAttack,
    primaryAttack: bp.primaryAttack,
    secondaryAttack: bp.secondaryAttack,
    mouthMood: bp.mouth.mood,
    eyebrowMood: bp.eyebrows.mood,
    windupClueStyle: bp.baddieAI?.windupClueStyle,
  };

  const pushHistoryUpdate = useCallback(
    (updater: (prev: ResolvedMonsterBlueprint) => ResolvedMonsterBlueprint, recordUndo = true) => {
      setBp((prev) => {
        const next = resolveMonsterBlueprint(updater(prev));
        if (recordUndo) {
          setUndoStack((u) => [...u.slice(-24), prev]);
          setRedoStack([]);
        }
        return next;
      });
    },
    []
  );

  const patchBp = useCallback(
    (patch: Partial<MonsterBlueprint>, recordUndo = false) => {
      pushHistoryUpdate((prev) => ({ ...prev, ...patch }), recordUndo);
    },
    [pushHistoryUpdate]
  );

  const handleUndo = () => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [bp, ...r.slice(0, 24)]);
      setBp(last);
      return prev.slice(0, -1);
    });
  };

  const handleRedo = () => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setUndoStack((u) => [...u, bp]);
      setBp(next);
      return prev.slice(1);
    });
  };

  const playMoveSound = (attack: MonsterAttackType) => {
    if (attack === 'waterJet') AudioEngine.playSound('splash');
    else if (attack === 'electricShock' || attack === 'solarBeam') AudioEngine.playSound('sparkle');
    else if (attack === 'groundPound' || attack === 'tailSmash') AudioEngine.playSound('hit');
    else AudioEngine.playSound('whoosh');
  };

  const triggerTestAttack = (which: 'primary' | 'secondary') => {
    const attack = which === 'primary' ? bp.primaryAttack : bp.secondaryAttack;
    playMoveSound(attack);
    setOneShotAttack({ attack, startedAt: performance.now() });
    setPreviewAction(which === 'primary' ? 'primaryAttack' : 'secondaryAttack');
  };

  const setCameraView = (preset: CameraPreset) => {
    const st = studioRef.current;
    if (!st) return;
    const h = Math.max(0.9, (st.rig?.topHeight ?? 1.5) * 0.55);
    const sc = bp.scale;
    const camMap: Record<CameraPreset, { pos: [number, number, number]; look: [number, number, number] }> = {
      fullBody: { pos: [2.6 * sc, 1.5 * sc, 2.9 * sc], look: [0, h * 0.72, 0] },
      head: { pos: [0.95 * sc, h * 1.12, 1.65 * sc], look: [0, h * 0.92, 0.35 * sc] },
      side: { pos: [3.2 * sc, 1.15 * sc, 0.15], look: [0, h * 0.72, 0] },
      back: { pos: [-1.4 * sc, 1.45 * sc, -2.8 * sc], look: [0, h * 0.68, -0.15 * sc] },
    };
    const cfg = camMap[preset];
    st.cameraFocusAnim = {
      targetPos: new THREE.Vector3(...cfg.pos),
      targetLook: new THREE.Vector3(...cfg.look),
    };
  };

  // Sync flying preview if user disables wings/flight
  useEffect(() => {
    if (previewAction === 'fly' && (bp.wingStyle === 'none' || !bp.canFly)) {
      setPreviewAction('idle');
    }
  }, [bp.wingStyle, bp.canFly, previewAction]);

  // Setup Three.js WebGPU / WebGL Studio Stage
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(240, host.clientWidth);
    const height = Math.max(240, host.clientHeight);

    let renderer = createMakerRenderer(isSoftwareGl);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    host.innerHTML = '';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#131722');
    scene.fog = new THREE.FogExp2('#131722', 0.028);
    let envTex: THREE.Texture | null = null;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.06, 90);
    camera.position.set(2.7, 1.65, 3.1);

    const hemi = new THREE.HemisphereLight('#D8E2FF', '#242938', 0.88);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#FFF6E5', 1.85);
    keyLight.position.set(4.5, 6.8, 4.4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.4;
    keyLight.shadow.camera.far = 24;
    const d = 3.8;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#7DD3FC', 0.82);
    rimLight.position.set(-4.2, 3.2, -4.4);
    scene.add(rimLight);

    const floorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.55, 0.1, 48),
      new THREE.MeshStandardMaterial({ color: '#1B2130', roughness: 0.78, metalness: 0.1 })
    );
    floorMesh.position.y = -0.05;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.75, 0.016, 10, 64),
      new THREE.MeshBasicMaterial({ color: '#7C5CFF', transparent: true, opacity: 0.42 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.004;
    scene.add(ring);

    const grid = new THREE.GridHelper(8, 16, '#2D344C', '#1D2234');
    grid.position.y = -0.002;
    scene.add(grid);

    const holder = new THREE.Group();
    scene.add(holder);
    const vfx = new MonsterAttackVfxController(scene);

    const createControls = (dom: HTMLElement) => {
      dom.style.touchAction = 'none';
      const c = new OrbitControls(camera, dom);
      c.enableDamping = !isSoftwareGl;
      c.dampingFactor = 0.075;
      c.target.set(0, 0.8, 0);
      c.minDistance = 0.9;
      c.maxDistance = 10.5;
      c.maxPolarAngle = Math.PI * 0.52;
      c.update();
      return c;
    };
    let controls = createControls(renderer.domElement);

    const state = {
      scene,
      camera,
      renderer,
      controls,
      holder,
      rig: null as QuadrupedMonsterRig | null,
      skeletonHelper: null as THREE.SkeletonHelper | null,
      segmentOverlay: null as MonsterSegmentOverlayController | null,
      vfx,
      cameraFocusAnim: null as { targetPos: THREE.Vector3; targetLook: THREE.Vector3 } | null,
    };
    controls.addEventListener('start', () => {
      state.cameraFocusAnim = null;
    });
    studioRef.current = state;

    const handleLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleRestored);

    let disposed = false;
    let frameId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let walkPhase = 0;
    let prevCycleBucket = -1;

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      elapsed += dt;

      try {
        const cur = latestRef.current;
        const rig = state.rig;
        if (rig) {
          let qState: QuadrupedAnimState = 'idle';
          let speedNorm = 0;
          let prog = 0;
          let attackForFrame: MonsterAttackType | undefined;

          if (cur.action === 'walk') {
            qState = 'walk';
            walkPhase += dt * 5.2;
            speedNorm = 0.55;
          } else if (cur.action === 'run') {
            qState = 'run';
            walkPhase += dt * 9.5;
            speedNorm = 0.94;
          } else if (cur.action === 'fly') {
            qState = 'fly';
            walkPhase += dt * 4.0;
            speedNorm = 0.6;
          } else if (cur.action === 'celebrate') {
            qState = 'celebrate';
          } else if (cur.action === 'primaryAttack' || cur.action === 'secondaryAttack') {
            const activeMove =
              cur.action === 'primaryAttack' ? cur.primaryAttack : cur.secondaryAttack;
            attackForFrame = activeMove;
            const meta = MONSTER_ATTACK_BY_ID[activeMove] ?? MONSTER_ATTACK_BY_ID.clawSlash;
            const totalCycle = meta.windupDuration + meta.strikeDuration + 0.55;
            const cyclePos = cur.oneShotAttack
              ? ((now - cur.oneShotAttack.startedAt) / 1000) % totalCycle
              : elapsed % totalCycle;
            const cycleBucket = Math.floor(
              (cur.oneShotAttack ? (now - cur.oneShotAttack.startedAt) / 1000 : elapsed) / totalCycle
            );
            if (cycleBucket !== prevCycleBucket) {
              prevCycleBucket = cycleBucket;
            }
            if (cyclePos < meta.windupDuration) {
              qState = 'windup';
              prog = cyclePos / meta.windupDuration;
              state.vfx.emitAttackStep(rig, activeMove, 'windup', prog, dt);
            } else if (cyclePos < meta.windupDuration + meta.strikeDuration) {
              qState = 'strike';
              prog = (cyclePos - meta.windupDuration) / meta.strikeDuration;
              state.vfx.emitAttackStep(rig, activeMove, 'strike', prog, dt);
            } else {
              qState = 'idle';
            }
          }

          animateQuadrupedMonster(
            rig,
            dt,
            elapsed,
            walkPhase,
            speedNorm,
            qState,
            prog,
            0,
            0,
            0,
            attackForFrame,
            cur.mouthMood,
            cur.eyebrowMood,
            0,
            cur.windupClueStyle
          );
        }

        state.vfx.update(dt);

        if (state.skeletonHelper) {
          state.skeletonHelper.visible = cur.showSkeleton;
        }

        if (state.cameraFocusAnim) {
          const alpha = isSoftwareGl ? 1 : 1 - Math.exp(-10 * dt);
          camera.position.lerp(state.cameraFocusAnim.targetPos, alpha);
          state.controls.target.lerp(state.cameraFocusAnim.targetLook, alpha);
          if (
            camera.position.distanceToSquared(state.cameraFocusAnim.targetPos) < 1e-4 &&
            state.controls.target.distanceToSquared(state.cameraFocusAnim.targetLook) < 1e-4
          ) {
            camera.position.copy(state.cameraFocusAnim.targetPos);
            state.controls.target.copy(state.cameraFocusAnim.targetLook);
            state.cameraFocusAnim = null;
          }
        }

        state.controls.update();
        renderer.render(scene, camera);
      } catch {
        // transient render error
      } finally {
        if (!disposed) {
          if (isSoftwareGl) frameId = window.setTimeout(tick, 60);
          else frameId = requestAnimationFrame(tick);
        }
      }
    };

    const switchToWebGLFallback = async (): Promise<boolean> => {
      if (disposed) return false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.domElement.removeEventListener('webglcontextlost', handleLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleRestored);
      controls.dispose();
      envTex?.dispose();
      envTex = null;
      try {
        renderer.dispose();
      } catch {
        // ignore
      }
      renderer = createMakerRenderer(isSoftwareGl, true);
      renderer.setSize(Math.max(240, host.clientWidth), Math.max(240, host.clientHeight));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      host.innerHTML = '';
      host.appendChild(renderer.domElement);
      renderer.domElement.addEventListener('webglcontextlost', handleLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleRestored);
      controls = createControls(renderer.domElement);
      controls.addEventListener('start', () => {
        state.cameraFocusAnim = null;
      });
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
      const w = Math.max(240, host.clientWidth);
      const h = Math.max(240, host.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(host);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      state.segmentOverlay?.dispose();
      state.segmentOverlay = null;
      if (state.skeletonHelper) {
        scene.remove(state.skeletonHelper);
        state.skeletonHelper.dispose();
      }
      vfx.dispose();
      state.controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleRestored);
      disposeObject3D(scene);
      envTex?.dispose();
      try {
        renderer.dispose();
      } catch {
        // ignore
      }
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
      studioRef.current = null;
    };
  }, []);

  // Rebuild SDF clay mesh whenever blueprint or resolution mode changes
  useEffect(() => {
    const st = studioRef.current;
    if (!st) return;

    const targetRes = isSliderActive
      ? 28
      : bp.sculptData?.enabled
      ? Math.max(crispResMode ? 48 : 36, Math.min(72, bp.sculptData.resolution))
      : crispResMode
      ? 48
      : 36;
    const delayMs = isSliderActive ? 14 : 40;

    const timer = window.setTimeout(() => {
      st.segmentOverlay?.dispose();
      st.segmentOverlay = null;
      if (st.skeletonHelper) {
        st.scene.remove(st.skeletonHelper);
        st.skeletonHelper.dispose();
        st.skeletonHelper = null;
      }
      disposeObject3D(st.holder);
      st.holder.clear();

      const built = buildQuadrupedMonsterMesh(bp, {
        resolution: targetRes,
        includeGuides: true,
      });
      st.holder.add(built);

      const rig = (built.userData.quadrupedRig as QuadrupedMonsterRig) ?? null;
      st.rig = rig;

      if (rig) {
        const helper = new THREE.SkeletonHelper(rig.root);
        helper.visible = latestRef.current.showSkeleton;
        st.scene.add(helper);
        st.skeletonHelper = helper;

        st.segmentOverlay = createMonsterSegmentOverlay(
          rig,
          latestRef.current.activePart,
          latestRef.current.showPartHighlights
        );
      }
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [bp, isSliderActive, crispResMode]);

  // Update active highlighted body part immediately when dropdown changes
  useEffect(() => {
    const st = studioRef.current;
    if (!st?.segmentOverlay) return;
    st.segmentOverlay.setActivePart(activePart);
    st.segmentOverlay.setVisible(showPartHighlights);
  }, [activePart, showPartHighlights]);

  const savedMonsters = useMemo(
    () => store.currentProject?.customMonsters ?? [],
    [store.currentProject?.customMonsters]
  );

  const handleSaveAndPlace = (placeInLevel: boolean) => {
    const cleanName = bp.name.trim() || 'Custom Beast';
    const finalBp: MonsterBlueprint = {
      ...bp,
      id: bp.id || `mon_${Date.now().toString(36)}`,
      name: cleanName,
    };
    store.saveCustomMonster(finalBp);
    if (editingEntityId) {
      store.updateEntity(editingEntityId, 'update creature', (e) => ({
        ...e,
        name: cleanName,
        kind: finalBp.role === 'baddie' ? 'baddie' : 'npc',
        isBuddy: finalBp.role === 'buddy',
        isBoss: Boolean(finalBp.isBoss),
        brain: finalBp.canFly ? 'Flyer' : finalBp.role === 'baddie' ? 'Chaser' : 'Walker',
        speed: finalBp.speed ?? 4,
        health: finalBp.health ?? (finalBp.role === 'baddie' ? 5 : 4),
        dialogue: finalBp.dialogue ?? '',
        monsterConfig: finalBp,
      }));
    } else if (placeInLevel) {
      store.spawnMonsterEntity(finalBp);
    }
    onClose();
  };

  useRegisterStudioAiBridge({
    id: 'modal-creature',
    context: 'creature',
    title: `Creature Maker · ${bp.name}`,
    subtitle: 'AI sculpts beast proportions, horns, wings, coat & combat abilities',
    saveLabel: 'Save Beast',
    getSnapshot: () => ({
      name: bp.name,
      presetId: bp.presetId,
      role: bp.role,
      legPairs: bp.legPairs,
      headCount: bp.headCount,
      isBoss: Boolean(bp.isBoss),
    }),
    applyResult: (raw, options) => {
      const { blueprint, summary } = sanitizeMonsterResult(
        raw,
        options?.modifyExisting ? bp : undefined
      );
      setUndoStack((u) => [...u.slice(-24), bp]);
      setBp(blueprint);
      setPreviewAction(blueprint.canFly && blueprint.wingStyle !== 'none' ? 'fly' : 'idle');
      setActivePart('torso');
      if (editingEntityId) {
        store.updateEntity(editingEntityId, 'AI apply creature', (e) => ({
          ...e,
          name: blueprint.name,
          kind: blueprint.role === 'baddie' ? 'baddie' : 'npc',
          isBuddy: blueprint.role === 'buddy',
          isBoss: Boolean(blueprint.isBoss),
          brain: blueprint.canFly ? 'Flyer' : blueprint.role === 'baddie' ? 'Chaser' : 'Walker',
          speed: blueprint.speed ?? 4,
          health: blueprint.health ?? (blueprint.role === 'baddie' ? 5 : 4),
          dialogue: blueprint.dialogue ?? e.dialogue,
          monsterConfig: blueprint,
        }));
      }
      return summary;
    },
    saveAsset: async (suggestedName) => {
      const cleanName = (suggestedName || bp.name).trim() || 'Custom Beast';
      const finalBp: MonsterBlueprint = {
        ...bp,
        id: bp.id || `mon_${Date.now().toString(36)}`,
        name: cleanName,
      };
      store.saveCustomMonster(finalBp);
      return `Saved beast "${cleanName}"`;
    },
  });

  const stepPartDropdown = (dir: -1 | 1) => {
    const idx = ALL_PART_KEYS.indexOf(activePart);
    const nextIdx = (idx + dir + ALL_PART_KEYS.length) % ALL_PART_KEYS.length;
    setActivePart(ALL_PART_KEYS[nextIdx]);
  };

  const updateSegmentPart = (
    key: 'chest' | 'torso' | 'hips' | 'belly' | 'neck' | 'head' | 'tail',
    patch: Partial<ResolvedMonsterBlueprint[typeof key]>
  ) => {
    pushHistoryUpdate((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }), false);
  };

  const updateLegPair = (
    pairKey: 'frontLegs' | 'rearLegs' | 'midLegs',
    patch: Partial<MonsterLegPairConfig>
  ) => {
    pushHistoryUpdate((prev) => ({
      ...prev,
      [pairKey]: { ...prev[pairKey], ...patch },
    }), false);
  };

  const renderSegmentSculptControls = (
    key: 'chest' | 'torso' | 'hips' | 'belly' | 'neck' | 'head' | 'tail',
    prof: MonsterSegmentProfile,
    opts?: { maxLen?: number; maxRad?: number; allowXOffset?: boolean }
  ) => {
    const maxLen = opts?.maxLen ?? 0.9;
    const maxRad = opts?.maxRad ?? 0.45;
    return (
      <div className="space-y-3">
        <ProfileCurvePreview profile={prof} />
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <SliderRow label="Start Radius" value={prof.startRadius} min={0.02} max={maxRad} step={0.005} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart(key, { startRadius: v })} />
          <SliderRow label="Mid Radius" value={prof.midRadius} min={0.02} max={maxRad} step={0.005} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart(key, { midRadius: v })} />
          <SliderRow label="End Radius" value={prof.endRadius} min={0.015} max={maxRad} step={0.005} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart(key, { endRadius: v })} />
          <SliderRow label="Length" value={prof.length} min={0.06} max={maxLen} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart(key, { length: v })} />
          <SliderRow label="Curvature" value={prof.curvature} min={-1} max={1} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart(key, { curvature: v })} />
          <SliderRow label="Blend Smooth" value={prof.blendScale} min={0.2} max={1.6} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart(key, { blendScale: v })} />
          <SliderRow label="Width Squash X" value={prof.squashX} min={0.5} max={1.8} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart(key, { squashX: v })} />
          <SliderRow label="Depth Squash Z" value={prof.squashZ} min={0.5} max={1.8} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart(key, { squashZ: v })} />
        </div>
        <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            3D Placement Offsets
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {opts?.allowXOffset !== false && (
              <SliderRow label="Offset X" value={prof.offsetX} min={-0.35} max={0.35} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart(key, { offsetX: v })} />
            )}
            <SliderRow label="Offset Y" value={prof.offsetY} min={-0.45} max={0.45} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart(key, { offsetY: v })} />
            <SliderRow label="Offset Z" value={prof.offsetZ} min={-0.65} max={0.65} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart(key, { offsetZ: v })} />
          </div>
        </div>
        <ColorField label="Clay Color" value={prof.color} onChange={(c) => updateSegmentPart(key, { color: c })} />
      </div>
    );
  };

  const renderLegPairInspector = (pairKey: 'frontLegs' | 'rearLegs' | 'midLegs', title: string) => {
    const legCfg = bp[pairKey];
    if (pairKey === 'midLegs' && bp.legPairs === 2) {
      return (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/[0.03] p-4 text-center space-y-2.5">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            This creature currently has <strong>4 legs</strong> (2 pairs). Enable 6 or 8 legs to sculpt middle pairs.
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => patchBp({ legPairs: 3 }, true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#7C5CFF] text-white whitespace-nowrap"
            >
              Switch to 6 Legs
            </button>
            <button
              type="button"
              onClick={() => patchBp({ legPairs: 4 }, true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-100 whitespace-nowrap"
            >
              Switch to 8 Legs
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 dark:bg-white/[0.05] p-1">
          {(
            [
              { id: 'placement', label: 'Placement' },
              { id: 'upper', label: 'Upper' },
              { id: 'lower', label: 'Lower' },
              { id: 'paws', label: 'Paws' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setLegSubTab(t.id)}
              className={`py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                legSubTab === t.id
                  ? 'bg-white dark:bg-[#7C5CFF] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {legSubTab === 'placement' && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <SliderRow label={`${title} Spread X`} value={legCfg.hipSpreadX} min={0.05} max={0.55} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { hipSpreadX: v })} />
            <SliderRow label="Hip Height Y" value={legCfg.hipOffsetY} min={-0.35} max={0.25} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { hipOffsetY: v })} />
            <SliderRow label="Hip Forward Z" value={legCfg.hipOffsetZ} min={-0.65} max={0.65} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { hipOffsetZ: v })} />
            <SliderRow label="Stance Angle" value={legCfg.stanceAngleDeg} min={-55} max={55} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { stanceAngleDeg: v })} />
            <SliderRow label="Knee Bend" value={legCfg.kneeBendDeg} min={-65} max={85} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { kneeBendDeg: v })} />
            <SliderRow label="Side Splay" value={legCfg.spiderSplay} min={-0.35} max={1.35} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { spiderSplay: v })} />
          </div>
        )}

        {legSubTab === 'upper' && (
          <div className="space-y-2.5">
            <ProfileCurvePreview profile={legCfg.upper} />
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <SliderRow label="Hip Radius" value={legCfg.upper.startRadius} min={0.018} max={0.24} step={0.004} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { upper: { ...legCfg.upper, startRadius: v } })} />
              <SliderRow label="Thigh Mid R" value={legCfg.upper.midRadius} min={0.018} max={0.22} step={0.004} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { upper: { ...legCfg.upper, midRadius: v } })} />
              <SliderRow label="Knee Radius" value={legCfg.upper.endRadius} min={0.015} max={0.18} step={0.004} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { upper: { ...legCfg.upper, endRadius: v } })} />
              <SliderRow label="Upper Length" value={legCfg.upper.length} min={0.08} max={0.65} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { upper: { ...legCfg.upper, length: v } })} />
              <SliderRow label="Curvature" value={legCfg.upper.curvature} min={-1} max={1} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { upper: { ...legCfg.upper, curvature: v } })} />
              <SliderRow label="Joint Blend" value={legCfg.upper.blendScale} min={0.2} max={1.5} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { upper: { ...legCfg.upper, blendScale: v } })} />
            </div>
            <ColorField label="Upper Limb Color" value={legCfg.upper.color} onChange={(c) => updateLegPair(pairKey, { upper: { ...legCfg.upper, color: c } })} />
          </div>
        )}

        {legSubTab === 'lower' && (
          <div className="space-y-2.5">
            <ProfileCurvePreview profile={legCfg.lower} />
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <SliderRow label="Upper Shin R" value={legCfg.lower.startRadius} min={0.015} max={0.18} step={0.004} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { lower: { ...legCfg.lower, startRadius: v } })} />
              <SliderRow label="Shin Mid R" value={legCfg.lower.midRadius} min={0.012} max={0.16} step={0.004} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { lower: { ...legCfg.lower, midRadius: v } })} />
              <SliderRow label="Ankle Radius" value={legCfg.lower.endRadius} min={0.012} max={0.16} step={0.004} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { lower: { ...legCfg.lower, endRadius: v } })} />
              <SliderRow label="Lower Length" value={legCfg.lower.length} min={0.08} max={0.65} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { lower: { ...legCfg.lower, length: v } })} />
              <SliderRow label="Curvature" value={legCfg.lower.curvature} min={-1} max={1} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { lower: { ...legCfg.lower, curvature: v } })} />
              <SliderRow label="Joint Blend" value={legCfg.lower.blendScale} min={0.2} max={1.5} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { lower: { ...legCfg.lower, blendScale: v } })} />
            </div>
            <ColorField label="Lower Limb Color" value={legCfg.lower.color} onChange={(c) => updateLegPair(pairKey, { lower: { ...legCfg.lower, color: c } })} />
          </div>
        )}

        {legSubTab === 'paws' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {PAW_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateLegPair(pairKey, { pawStyle: opt.id })}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                    legCfg.pawStyle === opt.id
                      ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                      : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <SliderRow label="Paw / Foot Scale" value={legCfg.pawScale} min={0.5} max={1.85} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateLegPair(pairKey, { pawScale: v })} />
            <ColorField label="Claw / Hoof Color" value={legCfg.clawColor} onChange={(c) => updateLegPair(pairKey, { clawColor: c })} />
          </div>
        )}
      </div>
    );
  };

  const renderContextualInspector = () => {
    switch (activePart) {
      case 'chest':
        return renderSegmentSculptControls('chest', bp.chest, { maxLen: 0.65, maxRad: 0.45 });
      case 'torso':
        return (
          <div className="space-y-3">
            <SliderRow
              label="Spine Arch Height"
              value={bp.torso.archY}
              min={-0.15}
              max={0.2}
              step={0.005}
              unit="m"
              onDragStart={() => setIsSliderActive(true)}
              onDragEnd={() => setIsSliderActive(false)}
              onChange={(v) => updateSegmentPart('torso', { archY: v })}
            />
            {renderSegmentSculptControls('torso', bp.torso, { maxLen: 0.95, maxRad: 0.45 })}
          </div>
        );
      case 'hips':
        return renderSegmentSculptControls('hips', bp.hips, { maxLen: 0.85, maxRad: 0.55 });
      case 'belly':
        return (
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3 py-2 cursor-pointer">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Enable Belly Underplate
              </span>
              <input
                type="checkbox"
                checked={bp.belly.enabled}
                onChange={(e) => updateSegmentPart('belly', { enabled: e.target.checked })}
                className="w-4 h-4 accent-[#7C5CFF]"
              />
            </label>
            {bp.belly.enabled && renderSegmentSculptControls('belly', bp.belly, { maxLen: 0.95, maxRad: 0.42 })}
          </div>
        );
      case 'neck':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <SliderRow label="Neck Pitch" value={bp.neck.pitchDeg} min={-20} max={78} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart('neck', { pitchDeg: v })} />
              <SliderRow label="Head Spread Angle" value={bp.neck.spreadDeg} min={0} max={55} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart('neck', { spreadDeg: v })} />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                Neck Segments
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[2, 3].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => updateSegmentPart('neck', { segments: s })}
                    className={`py-1.5 rounded-lg text-xs font-semibold border ${
                      bp.neck.segments === s
                        ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                        : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {s} Segments
                  </button>
                ))}
              </div>
            </div>
            {renderSegmentSculptControls('neck', bp.neck, { maxLen: 0.85, maxRad: 0.3 })}
          </div>
        );
      case 'head':
        return (
          <div className="space-y-3">
            <div>
              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                Skull Silhouette Preset
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {HEAD_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchBp({ headStyle: opt.id }, true)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border whitespace-nowrap ${
                      bp.headStyle === opt.id
                        ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                        : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <SliderRow label="Crown Dome" value={bp.head.crownHeight} min={0} max={0.14} step={0.004} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart('head', { crownHeight: v })} />
              <SliderRow label="Brow Fierce" value={bp.head.browFierce} min={0} max={1} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart('head', { browFierce: v })} />
              <SliderRow label="Jaw Width" value={bp.head.jawWidth} min={0.45} max={1.45} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart('head', { jawWidth: v })} />
              <SliderRow label="Jaw Drop" value={bp.head.jawDrop} min={0} max={0.12} step={0.004} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart('head', { jawDrop: v })} />
              <SliderRow label="Skull Tilt" value={bp.head.craniumTiltDeg} min={-35} max={35} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart('head', { craniumTiltDeg: v })} />
            </div>
            {renderSegmentSculptControls('head', bp.head, { maxLen: 0.6, maxRad: 0.32 })}
          </div>
        );
      case 'muzzle':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="flex flex-1 items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3 py-2 cursor-pointer">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Enable Snout / Muzzle
                </span>
                <input
                  type="checkbox"
                  checked={bp.muzzle.enabled}
                  onChange={(e) => patchBp({ muzzle: { ...bp.muzzle, enabled: e.target.checked } }, true)}
                  className="w-4 h-4 accent-[#7C5CFF]"
                />
              </label>
              <button
                type="button"
                onClick={() => setActivePart('nose')}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] hover:border-[#7C5CFF]/50 text-[11px] font-semibold text-[#7C5CFF] whitespace-nowrap"
              >
                Edit Nose &rarr;
              </button>
            </div>
            {bp.muzzle.enabled && (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <SliderRow label="Snout Length" value={bp.muzzle.length} min={0.04} max={0.48} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ muzzle: { ...bp.muzzle, length: v } })} />
                  <SliderRow label="Snout Width" value={bp.muzzle.width} min={0.04} max={0.24} step={0.005} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ muzzle: { ...bp.muzzle, width: v } })} />
                  <SliderRow label="Snout Height" value={bp.muzzle.height} min={0.03} max={0.2} step={0.005} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ muzzle: { ...bp.muzzle, height: v } })} />
                  <SliderRow label="Tip Taper" value={bp.muzzle.taper} min={0.25} max={1.1} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ muzzle: { ...bp.muzzle, taper: v } })} />
                  <SliderRow label="Whisker Split" value={bp.muzzle.splitCleft} min={0} max={1} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ muzzle: { ...bp.muzzle, splitCleft: v } })} />
                  <SliderRow label="Tilt Angle" value={bp.muzzle.tiltDeg} min={-25} max={35} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ muzzle: { ...bp.muzzle, tiltDeg: v } })} />
                  <SliderRow label="Blend Smooth" value={bp.muzzle.blendScale} min={0.2} max={1.4} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ muzzle: { ...bp.muzzle, blendScale: v } })} />
                  <SliderRow label="Offset Y" value={bp.muzzle.offsetY} min={-0.15} max={0.15} step={0.005} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ muzzle: { ...bp.muzzle, offsetY: v } })} />
                  <SliderRow label="Offset Z" value={bp.muzzle.offsetZ} min={-0.15} max={0.18} step={0.005} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ muzzle: { ...bp.muzzle, offsetZ: v } })} />
                </div>
                <ColorField label="Muzzle Color" value={bp.muzzle.color} onChange={(c) => patchBp({ muzzle: { ...bp.muzzle, color: c } })} />
                <button
                  type="button"
                  onClick={() => setActivePart('teeth')}
                  className="w-full py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] hover:border-[#7C5CFF]/50 text-[11px] font-semibold text-[#7C5CFF]"
                >
                  Customize Teeth &amp; Fangs &rarr;
                </button>
              </>
            )}
          </div>
        );
      case 'eyes':
        return (
          <div className="space-y-3">
            <div>
              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                Eye Count
              </div>
              <div className="grid grid-cols-6 gap-1">
                {([1, 2, 3, 4, 6, 8] as const).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => patchBp({ eyes: { ...bp.eyes, count: cnt } }, true)}
                    className={`py-1 rounded-lg text-xs font-semibold border ${
                      bp.eyes.count === cnt
                        ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                        : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                Pupil Style
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {PUPIL_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchBp({ eyes: { ...bp.eyes, pupilStyle: opt.id } }, true)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border whitespace-nowrap ${
                      bp.eyes.pupilStyle === opt.id
                        ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                        : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <SliderRow label="Eye Size" value={bp.eyes.size} min={0.018} max={0.09} step={0.002} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyes: { ...bp.eyes, size: v } })} />
              <SliderRow label="Spacing" value={bp.eyes.spacing} min={0.02} max={0.18} step={0.004} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyes: { ...bp.eyes, spacing: v } })} />
              <SliderRow label="Height Offset" value={bp.eyes.height} min={-0.06} max={0.14} step={0.004} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyes: { ...bp.eyes, height: v } })} />
              <SliderRow label="Depth Embed" value={bp.eyes.depthOffset} min={-0.04} max={0.04} step={0.002} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyes: { ...bp.eyes, depthOffset: v } })} />
              <SliderRow label="Aspect X" value={bp.eyes.aspectX} min={0.6} max={1.5} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyes: { ...bp.eyes, aspectX: v } })} />
              <SliderRow label="Aspect Y" value={bp.eyes.aspectY} min={0.6} max={1.5} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyes: { ...bp.eyes, aspectY: v } })} />
              <SliderRow label="Eyelid Fierce" value={bp.eyes.eyelidRest} min={0} max={0.75} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyes: { ...bp.eyes, eyelidRest: v } })} />
              <SliderRow label="Eye Glow" value={bp.eyes.glowEmissive} min={0} max={1.4} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyes: { ...bp.eyes, glowEmissive: v } })} />
            </div>
            <div className="space-y-1.5">
              <ColorField label="Iris Color" value={bp.eyes.irisColor} onChange={(c) => patchBp({ eyes: { ...bp.eyes, irisColor: c }, eyeColor: c })} />
              <ColorField label="Sclera Color" value={bp.eyes.scleraColor} onChange={(c) => patchBp({ eyes: { ...bp.eyes, scleraColor: c } })} />
              <ColorField label="Pupil Color" value={bp.eyes.pupilColor} onChange={(c) => patchBp({ eyes: { ...bp.eyes, pupilColor: c } })} />
            </div>
          </div>
        );
      case 'nose':
        return (
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3 py-2 cursor-pointer">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Enable Nose &amp; Nostrils
              </span>
              <input
                type="checkbox"
                checked={bp.nose.enabled}
                onChange={(e) => patchBp({ nose: { ...bp.nose, enabled: e.target.checked } }, true)}
                className="w-4 h-4 accent-[#7C5CFF]"
              />
            </label>
            {bp.nose.enabled && (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  {NOSE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => patchBp({ nose: { ...bp.nose, style: opt.id } }, true)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border whitespace-nowrap ${
                        bp.nose.style === opt.id
                          ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                          : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {bp.nose.style !== 'none' && (
                  <>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      <SliderRow label="Width" value={bp.nose.width} min={0.012} max={0.11} step={0.002} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ nose: { ...bp.nose, width: v } })} />
                      <SliderRow label="Height" value={bp.nose.height} min={0.01} max={0.09} step={0.002} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ nose: { ...bp.nose, height: v } })} />
                      <SliderRow label="Flat to 3D" value={bp.nose.depth3D} min={0.05} max={1.3} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ nose: { ...bp.nose, depth3D: v } })} />
                      <SliderRow label="Nose Shine" value={bp.nose.shine} min={0} max={1} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ nose: { ...bp.nose, shine: v } })} />
                      <SliderRow label="Snout Fwd/Back" value={bp.nose.posZ} min={-0.18} max={0.12} step={0.004} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ nose: { ...bp.nose, posZ: v } })} />
                      <SliderRow label="Snout Up/Down" value={bp.nose.posY} min={-0.12} max={0.12} step={0.004} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ nose: { ...bp.nose, posY: v } })} />
                      <SliderRow label="Left / Right" value={bp.nose.posX} min={-0.06} max={0.06} step={0.002} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ nose: { ...bp.nose, posX: v } })} />
                      <SliderRow label="Surface Push/Sink" value={bp.nose.embed} min={-0.025} max={0.04} step={0.002} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ nose: { ...bp.nose, embed: v } })} />
                      <SliderRow label="Tilt Angle" value={bp.nose.tiltDeg} min={-40} max={40} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ nose: { ...bp.nose, tiltDeg: v } })} />
                      {bp.nose.showNostrils && (
                        <SliderRow label="Nostril Size" value={bp.nose.nostrilScale} min={0.4} max={1.6} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ nose: { ...bp.nose, nostrilScale: v } })} />
                      )}
                    </div>
                    {bp.nose.style !== 'nostrilsOnly' && (
                      <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3 py-2 cursor-pointer">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Show Nostrils</span>
                        <input
                          type="checkbox"
                          checked={bp.nose.showNostrils}
                          onChange={(e) => patchBp({ nose: { ...bp.nose, showNostrils: e.target.checked } }, true)}
                          className="w-4 h-4 accent-[#7C5CFF]"
                        />
                      </label>
                    )}
                    <div className="space-y-1.5">
                      {bp.nose.style !== 'nostrilsOnly' && (
                        <ColorField label="Nose Color" value={bp.nose.color} onChange={(c) => patchBp({ nose: { ...bp.nose, color: c } })} />
                      )}
                      {(bp.nose.showNostrils || bp.nose.style === 'nostrilsOnly') && (
                        <ColorField label="Nostril Color" value={bp.nose.nostrilColor} onChange={(c) => patchBp({ nose: { ...bp.nose, nostrilColor: c } })} />
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        );
      case 'mouth':
        return (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Mouth Expression Mood
                </span>
                <button
                  type="button"
                  onClick={() => patchBp({ eyebrows: { ...bp.eyebrows, mood: bp.mouth.mood } }, true)}
                  className="text-[10.5px] font-semibold text-[#7C5CFF] hover:underline whitespace-nowrap"
                >
                  Sync to Eyebrows
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {EXPRESSION_MOOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      patchBp(
                        {
                          mouth: { ...bp.mouth, mood: opt.id },
                          eyebrows: { ...bp.eyebrows, mood: opt.id },
                        },
                        true
                      )
                    }
                    className={`px-1.5 py-1.5 rounded-lg text-[11px] font-semibold border whitespace-nowrap ${
                      bp.mouth.mood === opt.id
                        ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                        : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3 py-2 cursor-pointer">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Show Tongue Inside Mouth
              </span>
              <input
                type="checkbox"
                checked={bp.mouth.tongueVisible}
                onChange={(e) => patchBp({ mouth: { ...bp.mouth, tongueVisible: e.target.checked } }, true)}
                className="w-4 h-4 accent-[#7C5CFF]"
              />
            </label>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <SliderRow label="Mouth Width" value={bp.mouth.width} min={0.04} max={0.26} step={0.005} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ mouth: { ...bp.mouth, width: v } })} />
              <SliderRow label="Mouth Open" value={bp.mouth.mouthOpen} min={0} max={0.7} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ mouth: { ...bp.mouth, mouthOpen: v } })} />
              <SliderRow label="Smile Curve" value={bp.mouth.smileCurve} min={-1} max={1} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ mouth: { ...bp.mouth, smileCurve: v } })} />
              <SliderRow label="Stick Tongue Out" value={bp.mouth.tongueStickOut ?? 0} min={0} max={1} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ mouth: { ...bp.mouth, tongueStickOut: v } })} />
              <SliderRow label="Lip Thickness" value={bp.mouth.lipThickness} min={0.004} max={0.028} step={0.001} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ mouth: { ...bp.mouth, lipThickness: v } })} />
              <SliderRow label="Offset Y" value={bp.mouth.offsetY} min={-0.08} max={0.08} step={0.004} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ mouth: { ...bp.mouth, offsetY: v } })} />
              <SliderRow label="Offset Z" value={bp.mouth.offsetZ} min={-0.08} max={0.08} step={0.004} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ mouth: { ...bp.mouth, offsetZ: v } })} />
            </div>
            <div className="space-y-1.5">
              <ColorField label="Lip Line Color" value={bp.mouth.lipColor} onChange={(c) => patchBp({ mouth: { ...bp.mouth, lipColor: c } })} />
              <ColorField label="Mouth Void" value={bp.mouth.interiorColor} onChange={(c) => patchBp({ mouth: { ...bp.mouth, interiorColor: c } })} />
              <ColorField label="Tongue Color" value={bp.mouth.tongueColor} onChange={(c) => patchBp({ mouth: { ...bp.mouth, tongueColor: c } })} />
              <ColorField label="Shy Cheek Blush" value={bp.mouth.blushColor} onChange={(c) => patchBp({ mouth: { ...bp.mouth, blushColor: c } })} />
            </div>
          </div>
        );
      case 'teeth':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {TEETH_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchBp({ teeth: { ...bp.teeth, style: opt.id } }, true)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border whitespace-nowrap ${
                    bp.teeth.style === opt.id
                      ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                      : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {bp.teeth.style !== 'none' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3 py-2 cursor-pointer">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Top Teeth</span>
                    <input
                      type="checkbox"
                      checked={bp.teeth.showTop}
                      onChange={(e) => patchBp({ teeth: { ...bp.teeth, showTop: e.target.checked } }, true)}
                      className="w-4 h-4 accent-[#7C5CFF]"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3 py-2 cursor-pointer">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Bottom Teeth</span>
                    <input
                      type="checkbox"
                      checked={bp.teeth.showBottom}
                      onChange={(e) => patchBp({ teeth: { ...bp.teeth, showBottom: e.target.checked } }, true)}
                      className="w-4 h-4 accent-[#7C5CFF]"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <SliderRow label="Tooth Size" value={bp.teeth.size} min={0.4} max={2.0} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ teeth: { ...bp.teeth, size: v } })} />
                  <SliderRow label="Sharp vs Dull" value={bp.teeth.sharpness} min={0} max={1} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ teeth: { ...bp.teeth, sharpness: v } })} />
                  <SliderRow label="Lateral Spread" value={bp.teeth.spreadX} min={0.4} max={1.55} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ teeth: { ...bp.teeth, spreadX: v } })} />
                  <SliderRow label="Left / Right" value={bp.teeth.offsetX} min={-0.06} max={0.06} step={0.002} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ teeth: { ...bp.teeth, offsetX: v } })} />
                  <SliderRow label="Up / Down" value={bp.teeth.offsetY} min={-0.06} max={0.06} step={0.002} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ teeth: { ...bp.teeth, offsetY: v } })} />
                  <SliderRow label="Fwd / Back" value={bp.teeth.offsetZ} min={-0.03} max={0.06} step={0.002} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ teeth: { ...bp.teeth, offsetZ: v } })} />
                  <SliderRow label="Top Teeth Y" value={bp.teeth.topOffsetY} min={-0.04} max={0.04} step={0.002} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ teeth: { ...bp.teeth, topOffsetY: v } })} />
                  <SliderRow label="Bottom Teeth Y" value={bp.teeth.bottomOffsetY} min={-0.04} max={0.04} step={0.002} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ teeth: { ...bp.teeth, bottomOffsetY: v } })} />
                </div>
                <ColorField label="Tooth Color" value={bp.teeth.color} onChange={(c) => patchBp({ teeth: { ...bp.teeth, color: c } })} />
              </>
            )}
          </div>
        );
      case 'eyebrows':
        return (
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3 py-2 cursor-pointer">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Enable Sculpted Eyebrows
              </span>
              <input
                type="checkbox"
                checked={bp.eyebrows.enabled}
                onChange={(e) => patchBp({ eyebrows: { ...bp.eyebrows, enabled: e.target.checked } }, true)}
                className="w-4 h-4 accent-[#7C5CFF]"
              />
            </label>
            {bp.eyebrows.enabled && (
              <>
                <div>
                  <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Eyebrow Mood Expression
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {EXPRESSION_MOOD_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => patchBp({ eyebrows: { ...bp.eyebrows, mood: opt.id } }, true)}
                        className={`px-1.5 py-1.5 rounded-lg text-[11px] font-semibold border whitespace-nowrap ${
                          bp.eyebrows.mood === opt.id
                            ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                            : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <SliderRow label="Brow Width" value={bp.eyebrows.width} min={0.03} max={0.18} step={0.004} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyebrows: { ...bp.eyebrows, width: v } })} />
                  <SliderRow label="Thickness" value={bp.eyebrows.thickness} min={0.006} max={0.036} step={0.002} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyebrows: { ...bp.eyebrows, thickness: v } })} />
                  <SliderRow label="Arch Curve" value={bp.eyebrows.arch} min={-0.6} max={1.0} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyebrows: { ...bp.eyebrows, arch: v } })} />
                  <SliderRow label="Tilt Angle" value={bp.eyebrows.tiltDeg} min={-35} max={45} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyebrows: { ...bp.eyebrows, tiltDeg: v } })} />
                  <SliderRow label="Eye Spacing" value={bp.eyebrows.spacing} min={0.02} max={0.18} step={0.004} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyebrows: { ...bp.eyebrows, spacing: v } })} />
                  <SliderRow label="Height Offset" value={bp.eyebrows.height} min={-0.02} max={0.18} step={0.004} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ eyebrows: { ...bp.eyebrows, height: v } })} />
                </div>
                <ColorField label="Eyebrow Color" value={bp.eyebrows.color} onChange={(c) => patchBp({ eyebrows: { ...bp.eyebrows, color: c } })} />
              </>
            )}
          </div>
        );
      case 'ears':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {EAR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchBp({ ears: { ...bp.ears, style: opt.id } }, true)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border whitespace-nowrap ${
                    bp.ears.style === opt.id
                      ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                      : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {bp.ears.style !== 'none' && (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <SliderRow label="Ear Size" value={bp.ears.size} min={0.4} max={2.0} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ ears: { ...bp.ears, size: v } })} />
                  <SliderRow label="Ear Thickness" value={bp.ears.thickness ?? 1.0} min={0.4} max={2.4} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ ears: { ...bp.ears, thickness: v } })} />
                  <SliderRow label="Curve Softening" value={bp.ears.softness ?? 0.2} min={0} max={1} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ ears: { ...bp.ears, softness: v } })} />
                  <SliderRow label="Tilt Forward" value={bp.ears.tiltDeg} min={-45} max={45} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ ears: { ...bp.ears, tiltDeg: v } })} />
                  <SliderRow label="Outward Spread" value={bp.ears.spreadDeg} min={0} max={70} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ ears: { ...bp.ears, spreadDeg: v } })} />
                  <SliderRow label="Offset Y" value={bp.ears.offsetY} min={-0.12} max={0.14} step={0.005} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ ears: { ...bp.ears, offsetY: v } })} />
                  <SliderRow label="Offset Z" value={bp.ears.offsetZ} min={-0.14} max={0.14} step={0.005} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ ears: { ...bp.ears, offsetZ: v } })} />
                </div>
                <ColorField label="Outer Ear" value={bp.ears.color} onChange={(c) => patchBp({ ears: { ...bp.ears, color: c } })} />
                <ColorField label="Inner Ear" value={bp.ears.innerColor} onChange={(c) => patchBp({ ears: { ...bp.ears, innerColor: c } })} />
              </>
            )}
          </div>
        );
      case 'horns':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {HORN_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchBp({ hornStyle: opt.id }, true)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border whitespace-nowrap ${
                    bp.hornStyle === opt.id
                      ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                      : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {bp.hornStyle !== 'none' && (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <SliderRow label="Length" value={bp.horns.length} min={0.1} max={0.85} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ horns: { ...bp.horns, length: v } })} />
                  <SliderRow label="Thickness" value={bp.horns.thickness} min={0.45} max={2.0} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ horns: { ...bp.horns, thickness: v } })} />
                  <SliderRow label="Tip Softening" value={bp.horns.softness ?? 0.14} min={0} max={1} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ horns: { ...bp.horns, softness: v } })} />
                  <SliderRow label="Sweep Back" value={bp.horns.sweepDeg} min={-20} max={70} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ horns: { ...bp.horns, sweepDeg: v } })} />
                  <SliderRow label="Spread X" value={bp.horns.spreadX} min={0.02} max={0.22} step={0.005} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ horns: { ...bp.horns, spreadX: v } })} />
                  <SliderRow label="Offset Y" value={bp.horns.offsetY} min={-0.12} max={0.15} step={0.005} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ horns: { ...bp.horns, offsetY: v } })} />
                  <SliderRow label="Offset Z" value={bp.horns.offsetZ} min={-0.18} max={0.18} step={0.005} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ horns: { ...bp.horns, offsetZ: v } })} />
                </div>
                <ColorField label="Horn Color" value={bp.horns.color} onChange={(c) => patchBp({ horns: { ...bp.horns, color: c } })} />
              </>
            )}
          </div>
        );
      case 'frontLegs':
        return renderLegPairInspector('frontLegs', 'Front');
      case 'rearLegs':
        return renderLegPairInspector('rearLegs', 'Rear');
      case 'midLegs':
        return renderLegPairInspector('midLegs', 'Middle');
      case 'wings':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {WING_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchBp({ wingStyle: opt.id, canFly: opt.id !== 'none' ? bp.canFly : false }, true)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border whitespace-nowrap ${
                    bp.wingStyle === opt.id
                      ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                      : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {bp.wingStyle !== 'none' && (
              <>
                <label className="flex items-center justify-between rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-sky-700 dark:text-sky-300">Hover &amp; Fly in Play Mode</div>
                    <div className="text-[10px] text-sky-600/80 dark:text-sky-300/70">Flaps continuously above ground</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={bp.canFly}
                    onChange={(e) => patchBp({ canFly: e.target.checked }, true)}
                    className="w-4 h-4 accent-sky-500"
                  />
                </label>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <SliderRow label="Wingspan" value={bp.wings.span} min={0.4} max={2.2} step={0.05} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ wings: { ...bp.wings, span: v } })} />
                  <SliderRow label="Chord Width" value={bp.wings.chordWidth} min={0.25} max={1.0} step={0.02} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ wings: { ...bp.wings, chordWidth: v } })} />
                  <SliderRow label="Sweep Back" value={bp.wings.sweepBackDeg} min={-15} max={60} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ wings: { ...bp.wings, sweepBackDeg: v } })} />
                  <SliderRow label="Lift Angle" value={bp.wings.liftDeg} min={-25} max={55} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ wings: { ...bp.wings, liftDeg: v } })} />
                  <SliderRow label="Outer Fold" value={bp.wings.foldDeg} min={-35} max={45} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ wings: { ...bp.wings, foldDeg: v } })} />
                  <SliderRow label="Ribs / Feathers" value={bp.wings.ribCount} min={3} max={6} step={1} decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ wings: { ...bp.wings, ribCount: v } })} />
                  <SliderRow label="Membrane Opacity" value={bp.wings.membraneOpacity ?? 0.76} min={0.2} max={0.98} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ wings: { ...bp.wings, membraneOpacity: v } })} />
                  <SliderRow label="Mount X" value={bp.wings.offsetX} min={0.05} max={0.35} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ wings: { ...bp.wings, offsetX: v } })} />
                  <SliderRow label="Mount Y" value={bp.wings.offsetY} min={-0.08} max={0.28} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ wings: { ...bp.wings, offsetY: v } })} />
                  <SliderRow label="Mount Z" value={bp.wings.offsetZ} min={-0.3} max={0.25} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ wings: { ...bp.wings, offsetZ: v } })} />
                </div>
                <div className="space-y-1.5">
                  <ColorField label="Membrane / Feather" value={bp.wings.wingColor} onChange={(c) => patchBp({ wings: { ...bp.wings, wingColor: c }, wingColor: c })} />
                  <ColorField label="Wing Bone" value={bp.wings.boneColor} onChange={(c) => patchBp({ wings: { ...bp.wings, boneColor: c } })} />
                  <ColorField label="Wing Tip" value={bp.wings.tipColor} onChange={(c) => patchBp({ wings: { ...bp.wings, tipColor: c } })} />
                </div>
              </>
            )}
          </div>
        );
      case 'tail':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {TAIL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchBp({ tailStyle: opt.id }, true)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border whitespace-nowrap ${
                    bp.tailStyle === opt.id
                      ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                      : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {bp.tailStyle !== 'none' && (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <SliderRow label="Segments" value={bp.tail.segments} min={2} max={5} step={1} decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart('tail', { segments: v })} />
                  <SliderRow label="Curl Up" value={bp.tail.curlUp} min={-0.6} max={1.4} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart('tail', { curlUp: v })} />
                  <SliderRow label="Tip Feature Scale" value={bp.tail.tipScale} min={0.5} max={2.0} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => updateSegmentPart('tail', { tipScale: v })} />
                </div>
                <ColorField label="Tail Tip Color" value={bp.tail.tipColor} onChange={(c) => updateSegmentPart('tail', { tipColor: c })} />
                {renderSegmentSculptControls('tail', bp.tail, { maxLen: 1.4, maxRad: 0.35 })}
              </>
            )}
          </div>
        );
      case 'spikes':
        return (
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3 py-2 cursor-pointer">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Enable Dorsal Spikes / Armor
              </span>
              <input
                type="checkbox"
                checked={bp.spikes.enabled}
                onChange={(e) => patchBp({ spikes: { ...bp.spikes, enabled: e.target.checked }, spineSpikes: e.target.checked }, true)}
                className="w-4 h-4 accent-[#7C5CFF]"
              />
            </label>
            {bp.spikes.enabled && (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {SPIKE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => patchBp({ spikes: { ...bp.spikes, style: opt.id } }, true)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border whitespace-nowrap ${
                        bp.spikes.style === opt.id
                          ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                          : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <SliderRow label="Spike Count" value={bp.spikes.count} min={2} max={14} step={1} decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ spikes: { ...bp.spikes, count: v } })} />
                  <SliderRow label="Length" value={bp.spikes.length} min={0.05} max={0.38} step={0.01} unit="m" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ spikes: { ...bp.spikes, length: v } })} />
                  <SliderRow label="Thickness" value={bp.spikes.thickness} min={0.45} max={2.8} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ spikes: { ...bp.spikes, thickness: v } })} />
                  <SliderRow label="Sink Into Body" value={bp.spikes.sinkDepth ?? 0.016} min={0} max={0.12} step={0.004} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ spikes: { ...bp.spikes, sinkDepth: v } })} />
                  <SliderRow label="Curve Softening" value={bp.spikes.softness ?? 0.2} min={0} max={1} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ spikes: { ...bp.spikes, softness: v } })} />
                  <SliderRow label="Sweep Angle" value={bp.spikes.sweepDeg} min={-15} max={70} step={1} unit="°" decimals={0} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ spikes: { ...bp.spikes, sweepDeg: v } })} />
                  <SliderRow label="Spine Start" value={bp.spikes.startFrac} min={0} max={0.6} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ spikes: { ...bp.spikes, startFrac: v } })} />
                  <SliderRow label="Spine End" value={bp.spikes.endFrac} min={0.4} max={1} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ spikes: { ...bp.spikes, endFrac: v } })} />
                </div>
                <ColorField label="Spike Base" value={bp.spikes.color} onChange={(c) => patchBp({ spikes: { ...bp.spikes, color: c } })} />
                <ColorField label="Spike Crest Tip" value={bp.spikes.tipColor} onChange={(c) => patchBp({ spikes: { ...bp.spikes, tipColor: c } })} />
              </>
            )}
          </div>
        );
      case 'coat':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              {COAT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchBp({ surfaceCoat: { ...bp.surfaceCoat, mode: opt.id } }, true)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border whitespace-nowrap ${
                    bp.surfaceCoat.mode === opt.id
                      ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                      : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {bp.surfaceCoat.mode !== 'none' && (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <SliderRow label="Relief Intensity" value={bp.surfaceCoat.intensity} min={0.05} max={1.0} step={0.02} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ surfaceCoat: { ...bp.surfaceCoat, intensity: v } })} />
                  <SliderRow label="Density" value={bp.surfaceCoat.density} min={0.3} max={1.8} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ surfaceCoat: { ...bp.surfaceCoat, density: v } })} />
                  <SliderRow label="Tuft / Scale Size" value={bp.surfaceCoat.scaleSize} min={0.5} max={2.0} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ surfaceCoat: { ...bp.surfaceCoat, scaleSize: v } })} />
                  <SliderRow label="Fur Clumping" value={bp.surfaceCoat.clumpiness} min={0} max={1.0} step={0.05} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ surfaceCoat: { ...bp.surfaceCoat, clumpiness: v } })} />
                </div>
                <ColorField label="Coat Tip Accent" value={bp.surfaceCoat.tipColor} onChange={(c) => patchBp({ surfaceCoat: { ...bp.surfaceCoat, tipColor: c } })} />
              </>
            )}
            <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Global Body Scale &amp; Proportions
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <SliderRow label="Overall Scale" value={bp.scale} min={0.6} max={2.2} step={0.05} unit="x" onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ scale: v })} />
                <SliderRow label="Clay Blend K" value={bp.blendSmoothness} min={0.02} max={0.18} step={0.004} unit="m" decimals={3} onDragStart={() => setIsSliderActive(true)} onDragEnd={() => setIsSliderActive(false)} onChange={(v) => patchBp({ blendSmoothness: v })} />
              </div>
            </div>
          </div>
        );
      case 'combat': {
        const primMeta = MONSTER_ATTACK_BY_ID[bp.primaryAttack];
        const secMeta = MONSTER_ATTACK_BY_ID[bp.secondaryAttack];
        const abilityMeta = MONSTER_ABILITY_BY_ID[bp.specialAbility];
        return (
          <div className="space-y-3.5">
            {/* Primary Special Move */}
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-white">Primary Signature Move</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{primMeta.element} &middot; {primMeta.description}</div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerTestAttack('primary')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-[11px] font-semibold whitespace-nowrap shrink-0"
                >
                  <Play className="w-3 h-3" />
                  Test Move
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {MONSTER_ATTACK_CATALOG.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      patchBp({ primaryAttack: m.id, attackRange: m.defaultRange }, true);
                      playMoveSound(m.id);
                      setOneShotAttack({ attack: m.id, startedAt: performance.now() });
                      setPreviewAction('primaryAttack');
                    }}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-medium border text-left transition-colors ${
                      bp.primaryAttack === m.id
                        ? 'bg-[#7C5CFF]/15 border-[#7C5CFF] text-slate-900 dark:text-white'
                        : 'bg-white dark:bg-[#191E2B] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-[#7C5CFF]/50'
                    }`}
                  >
                    <span className="truncate">{m.label}</span>
                    <span
                      className="w-2 h-2 rounded-full shrink-0 ml-1"
                      style={{ backgroundColor: m.color }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Secondary Move */}
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-white">Secondary Move</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{secMeta.element} &middot; Alternates during battle</div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerTestAttack('secondary')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-800 dark:text-white text-[11px] font-semibold whitespace-nowrap shrink-0"
                >
                  <Play className="w-3 h-3" />
                  Test 2nd
                </button>
              </div>
              <select
                value={bp.secondaryAttack}
                onChange={(e) => patchBp({ secondaryAttack: e.target.value as MonsterAttackType }, true)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-[#191E2B] text-xs font-medium text-slate-800 dark:text-slate-100"
              >
                {MONSTER_ATTACK_CATALOG.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.element})
                  </option>
                ))}
              </select>
            </div>

            {/* Pokemon-Style Passive Ability */}
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-white">Special Passive Ability</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7C5CFF]">
                  {abilityMeta.tag}
                </span>
              </div>
              <select
                value={bp.specialAbility}
                onChange={(e) => patchBp({ specialAbility: e.target.value as MonsterAbilityId }, true)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-[#191E2B] text-xs font-semibold text-slate-800 dark:text-slate-100"
              >
                {MONSTER_ABILITY_CATALOG.map((ab) => (
                  <option key={ab.id} value={ab.id}>
                    {ab.label} ({ab.tag})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {abilityMeta.description}
              </p>
            </div>

            {/* Combat Tuning & Dialogue */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <SliderRow label="Attack Power" value={bp.attackPower} min={1} max={5} step={1} decimals={0} onChange={(v) => patchBp({ attackPower: v })} />
              <SliderRow label="Attack Range" value={bp.attackRange} min={1.8} max={12.5} step={0.2} unit="m" decimals={1} onChange={(v) => patchBp({ attackRange: v })} />
              <SliderRow label="Move Cooldown" value={bp.attackCooldown} min={0.6} max={3.2} step={0.1} unit="s" decimals={1} onChange={(v) => patchBp({ attackCooldown: v })} />
              <SliderRow label="Health" value={bp.health ?? 5} min={1} max={40} step={1} decimals={0} onChange={(v) => patchBp({ health: v })} />
              <SliderRow label="Speed" value={bp.speed ?? 4} min={1} max={8} step={1} decimals={0} onChange={(v) => patchBp({ speed: v })} />
              <SliderRow
                label="Action Variety"
                value={bp.baddieAI?.varietyFactor ?? 0.65}
                min={0}
                max={1}
                step={0.05}
                decimals={2}
                onChange={(v) =>
                  patchBp({
                    baddieAI: {
                      detectionMode: bp.baddieAI?.detectionMode ?? 'both',
                      aggroRange: bp.baddieAI?.aggroRange ?? 26,
                      sightAngleDeg: bp.baddieAI?.sightAngleDeg ?? 130,
                      territoryRadius: bp.baddieAI?.territoryRadius ?? 22,
                      patrolPattern: bp.baddieAI?.patrolPattern ?? 'orbit',
                      flightPattern: bp.baddieAI?.flightPattern ?? 'figure8',
                      flightAltitude: bp.baddieAI?.flightAltitude ?? (bp.canFly ? 4.0 : 0),
                      hoverAttackHeight: bp.baddieAI?.hoverAttackHeight ?? (bp.canFly ? 2.5 : 0),
                      primaryAction: bp.primaryAttack,
                      secondaryAction: bp.secondaryAttack,
                      ...bp.baddieAI,
                      varietyFactor: v,
                    },
                  })
                }
              />
              {bp.canFly && (
                <SliderRow
                  label="Flight Altitude"
                  value={bp.baddieAI?.flightAltitude ?? 4.0}
                  min={1.2}
                  max={9.0}
                  step={0.2}
                  unit="m"
                  decimals={1}
                  onChange={(v) =>
                    patchBp({
                      baddieAI: {
                        detectionMode: bp.baddieAI?.detectionMode ?? 'both',
                        aggroRange: bp.baddieAI?.aggroRange ?? 26,
                        sightAngleDeg: bp.baddieAI?.sightAngleDeg ?? 130,
                        territoryRadius: bp.baddieAI?.territoryRadius ?? 22,
                        patrolPattern: bp.baddieAI?.patrolPattern ?? 'orbit',
                        flightPattern: bp.baddieAI?.flightPattern ?? 'figure8',
                        hoverAttackHeight: bp.baddieAI?.hoverAttackHeight ?? 2.5,
                        varietyFactor: bp.baddieAI?.varietyFactor ?? 0.65,
                        primaryAction: bp.primaryAttack,
                        secondaryAction: bp.secondaryAttack,
                        ...bp.baddieAI,
                        flightAltitude: v,
                      },
                    })
                  }
                />
              )}
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Pre-Attack Windup Clue
                </div>
                <select
                  value={bp.baddieAI?.windupClueStyle ?? 'auto'}
                  onChange={(e) =>
                    patchBp({
                      baddieAI: {
                        detectionMode: bp.baddieAI?.detectionMode ?? 'both',
                        aggroRange: bp.baddieAI?.aggroRange ?? 26,
                        sightAngleDeg: bp.baddieAI?.sightAngleDeg ?? 130,
                        territoryRadius: bp.baddieAI?.territoryRadius ?? 22,
                        patrolPattern: bp.baddieAI?.patrolPattern ?? 'orbit',
                        flightPattern: bp.baddieAI?.flightPattern ?? 'figure8',
                        flightAltitude: bp.baddieAI?.flightAltitude ?? (bp.canFly ? 4.0 : 0),
                        hoverAttackHeight: bp.baddieAI?.hoverAttackHeight ?? (bp.canFly ? 2.5 : 0),
                        varietyFactor: bp.baddieAI?.varietyFactor ?? 0.65,
                        primaryAction: bp.primaryAttack,
                        secondaryAction: bp.secondaryAttack,
                        ...bp.baddieAI,
                        windupClueStyle: e.target.value as BaddieWindupClueStyle,
                      },
                    })
                  }
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-[#191E2B] text-xs font-medium text-slate-800 dark:text-slate-100"
                >
                  {WINDUP_CLUE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {bp.canFly && (
                <label className="flex items-center justify-between gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                      Land Between Air Attacks
                    </div>
                    <div className="text-[10px] text-sky-600/80 dark:text-sky-300/70">
                      Performs 1 aerial attack, hovers briefly, then lands before attacking again
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={bp.baddieAI?.landAfterAirAttack !== false}
                    onChange={(e) =>
                      patchBp({
                        baddieAI: {
                          detectionMode: bp.baddieAI?.detectionMode ?? 'both',
                          aggroRange: bp.baddieAI?.aggroRange ?? 26,
                          sightAngleDeg: bp.baddieAI?.sightAngleDeg ?? 130,
                          territoryRadius: bp.baddieAI?.territoryRadius ?? 22,
                          patrolPattern: bp.baddieAI?.patrolPattern ?? 'orbit',
                          flightPattern: bp.baddieAI?.flightPattern ?? 'figure8',
                          flightAltitude: bp.baddieAI?.flightAltitude ?? 4.0,
                          hoverAttackHeight: bp.baddieAI?.hoverAttackHeight ?? 2.5,
                          varietyFactor: bp.baddieAI?.varietyFactor ?? 0.65,
                          primaryAction: bp.primaryAttack,
                          secondaryAction: bp.secondaryAttack,
                          ...bp.baddieAI,
                          landAfterAirAttack: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 accent-sky-500 shrink-0"
                  />
                </label>
              )}
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                Battle Cry / Dialogue
              </div>
              <input
                type="text"
                value={bp.dialogue ?? ''}
                onChange={(e) => patchBp({ dialogue: e.target.value })}
                placeholder="Grrrr! Look out!"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-[#191E2B] text-xs text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4">
      <div className="flex flex-col w-full h-full max-w-[1440px] max-h-[920px] rounded-2xl overflow-hidden border border-slate-200 dark:border-white/12 bg-white dark:bg-[#131722] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161B28] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#7C5CFF]/15 border border-[#7C5CFF]/30 flex items-center justify-center text-[#7C5CFF] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
                Creature Maker
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Organic SDF Clay Sculpt &middot; Multi-Limb Rig &middot; Expressions &amp; Attacks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => requestOpenContextualAiModal('creature')}
              title="AI Creature Designer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#EC4899]/40 bg-[#EC4899]/15 text-[#EC4899] dark:text-[#F472B6] hover:bg-[#EC4899]/25 text-xs font-bold whitespace-nowrap shrink-0"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>AI</span>
            </button>
            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              title="Undo"
              className="p-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 disabled:opacity-40"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={redoStack.length === 0}
              onClick={handleRedo}
              title="Redo"
              className="p-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 disabled:opacity-40"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setUndoStack((u) => [...u.slice(-24), bp]);
                setBp(resolveMonsterBlueprint(createRandomMonsterBlueprint()));
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
            >
              <Dices className="w-3.5 h-3.5 text-amber-500" />
              Randomize
            </button>
            <button
              type="button"
              onClick={() => setShowPartHighlights((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 ${
                showPartHighlights
                  ? 'bg-[#7C5CFF]/15 border-[#7C5CFF]/50 text-[#7C5CFF] dark:text-[#C4B5FD]'
                  : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Guides
            </button>
            <button
              type="button"
              onClick={() => setShowSkeleton((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 ${
                showSkeleton
                  ? 'bg-sky-500/15 border-sky-500/50 text-sky-600 dark:text-sky-300'
                  : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Bones
            </button>
            <button
              type="button"
              onClick={() => setCrispResMode((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 ${
                crispResMode
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-300'
              }`}
            >
              {crispResMode ? 'Hi-Res Clay' : 'Draft SDF'}
            </button>
            <button
              type="button"
              onClick={() => setShowingSketchModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#7C5CFF]/40 bg-[#7C5CFF]/15 text-[#7C5CFF] dark:text-[#C4B5FD] text-xs font-bold whitespace-nowrap shrink-0 hover:bg-[#7C5CFF]/25"
            >
              <Pencil className="w-3.5 h-3.5" />
              3D Sculpt &amp; Stamp
            </button>

            <div className="h-5 w-px bg-slate-200 dark:bg-white/10 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={() => handleSaveAndPlace(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-100 whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              Save Only
            </button>
            <button
              type="button"
              onClick={() => handleSaveAndPlace(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#7C5CFF] hover:bg-[#6A48F5] text-xs font-semibold text-white shadow-sm whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              {editingEntityId ? 'Update in Level' : 'Save & Place in Level'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Creature Maker"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Left: 3D SDF Turntable + Preset Shelf */}
          <div className="relative flex-1 min-h-[320px] flex flex-col bg-[#131722] overflow-hidden">
            {/* Top viewport bar: Camera Views & Animation Tester */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#161B28]/90 border-b border-white/10 z-10 flex-wrap">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'fullBody', label: 'Full Body' },
                    { id: 'head', label: 'Head' },
                    { id: 'side', label: 'Side' },
                    { id: 'back', label: 'Tail' },
                  ] as const
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setCameraView(cam.id)}
                    className="px-2 py-1 rounded-md text-[11px] font-medium bg-white/[0.06] hover:bg-white/12 text-slate-300 hover:text-white whitespace-nowrap shrink-0"
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {(
                  [
                    { id: 'idle', label: 'Alive Idle' },
                    { id: 'walk', label: 'Walk' },
                    { id: 'run', label: 'Run' },
                    ...(bp.canFly && bp.wingStyle !== 'none' ? ([{ id: 'fly', label: 'Fly' }] as const) : []),
                    { id: 'primaryAttack', label: MONSTER_ATTACK_BY_ID[bp.primaryAttack].label },
                    { id: 'secondaryAttack', label: MONSTER_ATTACK_BY_ID[bp.secondaryAttack].label },
                    { id: 'celebrate', label: 'Cheer' },
                  ] as { id: PreviewAction; label: string }[]
                ).map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => {
                      setPreviewAction(act.id);
                      if (act.id === 'primaryAttack' || act.id === 'secondaryAttack') {
                        const mv = act.id === 'primaryAttack' ? bp.primaryAttack : bp.secondaryAttack;
                        playMoveSound(mv);
                        setOneShotAttack({ attack: mv, startedAt: performance.now() });
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      previewAction === act.id
                        ? 'bg-[#7C5CFF] text-white'
                        : 'bg-white/[0.06] text-slate-300 hover:bg-white/12'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative flex-1 min-h-0">
              <div ref={canvasHostRef} className="w-full h-full" />
              {contextLost && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#131722]/90 text-xs text-slate-300">
                  Restoring 3D viewport...
                </div>
              )}
              <div className="pointer-events-none absolute bottom-2.5 left-3 text-[11px] text-slate-400 tabular-nums">
                Drag to orbit &middot; Scroll to zoom &middot; {bp.legPairs * 2} legs &middot; {bp.headCount} {bp.headCount === 1 ? 'head' : 'heads'}
              </div>
            </div>

            {/* Bottom Preset Shelf */}
            <div className="border-t border-white/10 bg-[#151A27] px-3 py-2 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                  Preset Species &amp; Saved Beasts
                </span>
                <span className="text-[10.5px] text-slate-500">
                  Click any species to load &amp; sculpt
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {MONSTER_PRESETS.map((preset) => {
                  const active = bp.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setUndoStack((u) => [...u.slice(-24), bp]);
                        setBp(resolveMonsterBlueprint(createDefaultMonsterBlueprint(preset.id)));
                        setPreviewAction(preset.blueprint.canFly ? 'fly' : 'idle');
                      }}
                      title={preset.blurb}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left shrink-0 transition-all ${
                        active
                          ? 'bg-[#7C5CFF]/20 border-[#7C5CFF] text-white'
                          : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-white/25"
                        style={{ backgroundColor: preset.blueprint.bodyColor }}
                      />
                      <span className="text-[11px] font-semibold whitespace-nowrap">{preset.label}</span>
                    </button>
                  );
                })}
                {savedMonsters.map((sm) => (
                  <button
                    key={sm.id}
                    type="button"
                    onClick={() => {
                      setUndoStack((u) => [...u.slice(-24), bp]);
                      setBp(resolveMonsterBlueprint({ ...sm }));
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border shrink-0 ${
                      bp.id === sm.id
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                        : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: sm.bodyColor }}
                    />
                    <span className="text-[11px] font-semibold whitespace-nowrap">{sm.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Contextual Body Part Inspector */}
          <div className="w-full lg:w-[400px] xl:w-[430px] flex flex-col border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-white/10 bg-white dark:bg-[#171C29] min-h-0">
            {/* Creature Header + Body Part Dropdown */}
            <div className="p-3.5 border-b border-slate-200 dark:border-white/10 space-y-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={bp.name}
                  onChange={(e) => patchBp({ name: e.target.value })}
                  placeholder="Creature Name..."
                  className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#1E2434] text-xs font-semibold text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => patchBp({ isBoss: !bp.isBoss }, true)}
                  className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 ${
                    bp.isBoss
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-600 dark:text-amber-300'
                      : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Skull className="w-3.5 h-3.5" />
                  Boss
                </button>
              </div>

              {/* Role + Leg Pairs + Heads + Material Finish */}
              <div className="grid grid-cols-3 gap-1.5">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    title={r.desc}
                    onClick={() => patchBp({ role: r.id }, true)}
                    className={`px-2 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap ${
                      bp.role === r.id
                        ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                        : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <select
                  aria-label="Leg count"
                  value={bp.legPairs}
                  onChange={(e) => patchBp({ legPairs: Number(e.target.value) as 2 | 3 | 4 }, true)}
                  className="h-7 px-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1E2434] text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                >
                  <option value={2}>4 Legs (2 Pairs)</option>
                  <option value={3}>6 Legs (3 Pairs)</option>
                  <option value={4}>8 Legs (4 Pairs)</option>
                </select>
                <select
                  aria-label="Head count"
                  value={bp.headCount}
                  onChange={(e) => patchBp({ headCount: Number(e.target.value) as 1 | 2 | 3 }, true)}
                  className="h-7 px-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1E2434] text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                >
                  <option value={1}>1 Head</option>
                  <option value={2}>2 Heads</option>
                  <option value={3}>3 Heads</option>
                </select>
                <select
                  aria-label="Clay finish"
                  value={bp.materialFinish}
                  onChange={(e) => patchBp({ materialFinish: e.target.value as CharacterMaterialFinish }, true)}
                  className="h-7 px-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1E2434] text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                >
                  {FINISH_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* Contextual Body Part Dropdown */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#7C5CFF]">
                    Sculpt Body Part &amp; Controls
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePart('combat')}
                    className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-600 dark:text-amber-300 hover:underline whitespace-nowrap"
                  >
                    <Flame className="w-3 h-3" />
                    Moves &amp; Ability
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => stepPartDropdown(-1)}
                    title="Previous body part"
                    className="h-9 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#1E2434] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shrink-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <select
                    aria-label="Select creature body part to edit"
                    value={activePart}
                    onChange={(e) => setActivePart(e.target.value as MonsterPartKey)}
                    className="flex-1 h-9 px-3 rounded-lg border-2 border-[#7C5CFF]/60 bg-slate-50 dark:bg-[#1E2434] text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#7C5CFF]"
                  >
                    {BODY_PART_GROUPS.map((grp) => (
                      <optgroup key={grp.group} label={grp.group}>
                        {grp.items.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => stepPartDropdown(1)}
                    title="Next body part"
                    className="h-9 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#1E2434] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shrink-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Contextual Controls for Selected Body Part */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {renderContextualInspector()}
            </div>
          </div>
        </div>
      </div>

      {showingSketchModal && (
        <CreatureSketchModal
          blueprint={bp}
          onSave={(updatedBp) => {
            setUndoStack((u) => [...u.slice(-24), bp]);
            setBp(resolveMonsterBlueprint(updatedBp));
          }}
          onClose={() => setShowingSketchModal(false)}
        />
      )}
    </div>
  );
};
