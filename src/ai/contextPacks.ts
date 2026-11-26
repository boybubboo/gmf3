import type { SkeletonInspection } from '../three/proceduralRigAnimator';
import type { AiStudioContextId, CharacterPromptGuide } from './studioBridge';

export interface AiContextMeta {
  id: AiStudioContextId;
  title: string;
  tagline: string;
  accentHex: string;
  saveAreaLabel: string;
  starterPrompts: string[];
}

export const AI_CONTEXT_META: Record<AiStudioContextId, AiContextMeta> = {
  world: {
    id: 'world',
    title: 'World Terraform AI',
    tagline: 'Sculpts mountains, spiral paths, crystal caves, lakes, weather & landmarks on this island.',
    accentHex: '#20B46A',
    saveAreaLabel: 'Apply to World',
    starterPrompts: [
      'Bear mountain with a large blue crystal cave at the base and a winding path spiraling to a giant oak summit',
      'Alpine snow peak with frozen lake, rocky ravine, aurora night sky and falling snow',
      'Lush emerald valley with winding river, waterfall pond, misty hills and campfire glade',
    ],
  },
  character: {
    id: 'character',
    title: 'Character Maker AI',
    tagline: 'Sculpts SDF clay proportions, coat, armor/addons, facial hair, expressions & rig traits.',
    accentHex: '#A855F7',
    saveAreaLabel: 'Save to Chars',
    starterPrompts: [
      'A valiant medieval knight in gleaming steel plate armor with shoulder pauldrons, crimson cape, closed visor helmet and iron boots',
      'Stocky anthropomorphic brown bear hero with round ears, broad shoulders, warm snout and determined brows',
      'Wise elder wizard with long pointed blue hat, flowing white beard, dark cloak and glowing amber eyes',
    ],
  },
  creature: {
    id: 'creature',
    title: 'Creature Maker AI',
    tagline: 'Designs quadruped, 6-leg or 8-leg beasts, windup telegraphs, attacks & boss/buddy abilities.',
    accentHex: '#EC4899',
    saveAreaLabel: 'Save Beast',
    starterPrompts: [
      'Sneaky mountain goat baddie with swept horns, hooves, charge ram attack and stomp telegraph',
      'Boss Queen Bee guardian with insect wings, stinger tail, striped coat and dance-then-sting attack',
      'Six-legged crystal cavern drake with icy scales, glowing eyes and breath attack',
    ],
  },
  cast: {
    id: 'cast',
    title: 'Cast & Hero AI',
    tagline: 'Creates monsters, bosses, buddies or NPCs directly into your cast roster and level.',
    accentHex: '#0EA5E9',
    saveAreaLabel: 'Add to Cast',
    starterPrompts: [
      'Create a boss bee guardian with wing flap, dance windup and venomous sting',
      'Create a grumpy mountain goat sentry ready to ram intruders down the slope',
      'Create a friendly honeybee scout buddy who warns the hero near the mountain trail',
    ],
  },
  motion: {
    id: 'motion',
    title: 'Motion Studio AI',
    tagline: 'Generates keyframe animations for your selected hero, beast or uploaded GLB rig straight onto the timeline.',
    accentHex: '#7C5CFF',
    saveAreaLabel: 'Save to Motion Library',
    starterPrompts: [
      'Heavy bear ground-pound slam: wind up arms high, crouch fast and slam both fists down',
      'Boss bee telegraph dance before stinging: rhythmic figure-8 hover sway then sharp forward lunge',
      'Alert goat headbutt ram: lower horns low, paw the ground then burst forward',
    ],
  },
  logic: {
    id: 'logic',
    title: 'Logic & Multi-Level Planner AI',
    tagline: 'Plans connected levels, portals, save plinths, NPCs, bosses, objectives & When-If-Then game rules.',
    accentHex: '#A855F7',
    saveAreaLabel: 'Build Game System',
    starterPrompts: [
      'Bear honey quest: Bear starts sad in Crystal Cave with empty honey jar, climbs Spiral Mountain dodging 8 sneaky goats using ground pound, defeats dancing Boss Bee under summit oak to win Magic Spoon & Honey',
      '3-level woodland adventure: Forest Village hub with Save Plinth & Elder NPC -> Misty Cavern -> Sky Citadel Boss',
      'Mountain trial with portal gates, key treasure chest, checkpoint plinth and boss arena',
    ],
  },
  object: {
    id: 'object',
    title: 'Object Creator AI',
    tagline: 'Assembles multi-part 3D props & mechanisms (hinges, sliders, glowing emissives) within Maker geometry limits.',
    accentHex: '#7C5CFF',
    saveAreaLabel: 'Save to Objects',
    starterPrompts: [
      'Warm glowing iron & amber-glass hanging trail lantern with handle ring and cap',
      'Golden beehive with layered hexagonal tiers and dripping honey spout',
      'Ornate magic honey spoon with carved oak handle and glowing golden bowl',
    ],
  },
  plant: {
    id: 'plant',
    title: 'Plant Creator AI',
    tagline: 'Builds botanical leaf clumps, flowers & bioluminescent cave flora using Maker leaf/petal builders.',
    accentHex: '#20B46A',
    saveAreaLabel: 'Save to Plants',
    starterPrompts: [
      'Glowing blue cave crystal fern cluster with bioluminescent tips and arched fronds',
      'Lush golden wildflower & clover clump with warm petal fan and central bloom',
      'Giant tropical monstera & banana leaf cluster with deep veins',
    ],
  },
  tree: {
    id: 'tree',
    title: 'Tree Creator AI',
    tagline: 'Configures bark, gnarl, roots, owl hollows, canopies, seasonal leaves & fruit for Tree Studio.',
    accentHex: '#16A34A',
    saveAreaLabel: 'Save to Trees',
    starterPrompts: [
      'Gnarly ancient summit oak with wide twisted roots, owl hollow, golden amber beehive fruit and rich green canopy',
      'Tall alpine snow-heavy conifer pine with frosted lower boughs and dark bark',
      'Mystic glowing blossom fantasy tree with swirling branches and lantern fruit',
    ],
  },
  interface: {
    id: 'interface',
    title: 'HUD & Storybook AI',
    tagline: 'Designs HUD widgets (health, stamina, boss bar, objectives, minimap) and storybook framing.',
    accentHex: '#F59E0B',
    saveAreaLabel: 'Apply HUD Setup',
    starterPrompts: [
      'Cozy adventure HUD with health bar, stamina bar for ground pound, objective tracker, minimap and boss bar',
      'Minimalist storybook HUD with clean corner hearts, quest banner and bottom action buttons',
    ],
  },
};

export interface GlbAiSummary {
  fileName: string;
  inspection: SkeletonInspection;
  animationClips: string[];
}

function formatCharacterGuideSection(
  guide?: CharacterPromptGuide | null
): string {
  if (!guide) return '';
  const lines: string[] = [];
  if (guide.archetype !== 'auto') {
    lines.push(`- Body Archetype: ${guide.archetype} (pick matching presetId & proportions)`);
  }
  if (guide.extremities !== 'auto') {
    lines.push(`- Hands & Feet Style: ${guide.extremities} (strictly set matching handStyle and footStyle)`);
  }
  if (guide.surface !== 'auto') {
    lines.push(`- Surface & Finish: ${guide.surface} (set matching surfaceCoatMode and materialFinish)`);
  }
  if (guide.extras.length > 0) {
    lines.push(
      `- Required Extras (MUST include all checked): ${guide.extras.join(', ')}`
    );
  }
  if (lines.length === 0) return '';
  return `USER PROMPT HELPER SELECTIONS (HIGHEST PRIORITY — MUST OBEY):\n${lines.join('\n')}`;
}

export function buildContextualAiPrompts(params: {
  context: AiStudioContextId;
  userRequest: string;
  snapshot: Record<string, unknown>;
  glbSummary?: GlbAiSummary | null;
  modifyExisting?: boolean;
  characterGuide?: CharacterPromptGuide | null;
  hasReferenceImage?: boolean;
}): { systemPrompt: string; userPrompt: string } {
  const {
    context,
    userRequest,
    snapshot,
    glbSummary,
    modifyExisting,
    characterGuide,
    hasReferenceImage,
  } = params;

  const glbSection = glbSummary
    ? `\nUPLOADED / ATTACHED GLB RIG DETECTED:
- fileName: ${glbSummary.fileName}
- hasSkeleton: ${glbSummary.inspection.hasSkeleton} (${glbSummary.inspection.boneNames.length} bones)
- boneNames: ${JSON.stringify(glbSummary.inspection.boneNames.slice(0, 64))}
- autoBoneMap: ${JSON.stringify(glbSummary.inspection.autoBoneMap)}
- animationClips: ${JSON.stringify(glbSummary.animationClips)}
Use exact bone names from boneNames / autoBoneMap whenever targeting bones!\n`
    : '';

  const guideSection =
    context === 'character' ? formatCharacterGuideSection(characterGuide) : '';

  const refImageSection = hasReferenceImage
    ? `ATTACHED VISUAL GUIDE IMAGE:
Study the attached reference image carefully. Match the subject's silhouette, species/humanoid build, clothing or armor colors, headgear/helmets, eyewear/visor, facial hair, ears/horns/wings/tail, and personality while staying strictly inside the exact Maker schema and anatomical meter bounds.`
    : '';

  const schemaSpec = getSchemaSpecForContext(context);
  const modeRule = modifyExisting
    ? 'MODE: MODIFY EXISTING ONLY. Keep everything currently in CURRENT STUDIO SNAPSHOT intact! Only output the specific fields, additions, or edits the user asked to change (omit untouched properties and do NOT clear or regenerate unrelated existing terrain, weather, biome, parts, or entities).'
    : 'MODE: FRESH CREATE. Design a clean complete result from scratch matching the prompt—do NOT inherit leftover theme/snow/weather from the old snapshot unless requested.';

  const systemPrompt = [
    'You are the built-in contextual Game Maker Studio AI Architect.',
    'Always return ONLY a single valid JSON object (no markdown fences, no commentary outside JSON).',
    'Stay strictly within the exact enums, numeric bounds, and capabilities of the Maker engine.',
    modeRule,
    schemaSpec,
  ].join('\n\n');

  const userPrompt = [
    `ACTIVE STUDIO CONTEXT: ${context}`,
    `EDIT MODE: ${modifyExisting ? 'MODIFY EXISTING ONLY (preserve everything not mentioned)' : 'FRESH BUILD (clean reset)'}`,
    `CURRENT STUDIO SNAPSHOT:\n${JSON.stringify(snapshot).slice(0, 5000)}`,
    glbSection,
    refImageSection,
    guideSection,
    `USER REQUEST:\n${userRequest.trim()}`,
    'Return ONLY valid JSON matching the target schema.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { systemPrompt, userPrompt };
}

function getSchemaSpecForContext(context: AiStudioContextId): string {
  switch (context) {
    case 'object':
      return `TARGET SCHEMA (Object Maker Prop / Mechanism):
{
  "name": string (short asset title, e.g. "Glowing Trail Lantern"),
  "category": "prop" | "scenery" | "building",
  "summary": string,
  "attachBodyPart": null | "rightHand" | "leftHand" | "head" | "back" | "hips",
  "parts": [ (1 to 14 parts built cleanly centered around X=0, Z=0, base sitting near Y=0)
    {
      "name": string,
      "shape": "cube" | "halfCube" | "sphere" | "hemisphere" | "cylinder" | "cone" | "capsule" | "torus" | "wedge" | "arch" | "prism" | "plank" | "beamLarge" | "beamSmall" | "stairs" | "pillar" | "fence" | "roofAFrame" | "roofSlope",
      "position": [number (-3..3), number (0..4), number (-3..3)],
      "rotation": [number (deg -180..180), number, number],
      "dimensions": [number (0.05..3), number (0.05..3), number (0.05..3)],
      "bevel": number (0..0.25),
      "segments": number (8..24),
      "materialId": null | "hewnStone" | "sandstone" | "randomCobble" | "timberPlank" | "roundLogs" | "rustedIron" | "clayTile" | "thatchedStraw",
      "color": "#RRGGBB",
      "roughness": number (0.08..0.95),
      "metalness": number (0..1),
      "emissive": "#RRGGBB" (optional, use with emissiveIntensity 0.5..2.4 for lanterns/crystals),
      "emissiveIntensity": number (0..2.5)
    }
  ],
  "mechanisms": [ (optional interactive hinge/slider animations)
    {
      "name": string,
      "targetPartName": string (must match a part.name above),
      "kind": "hinge" | "slider",
      "axis": "x" | "y" | "z",
      "openAngleDeg": number (-160..160),
      "openOffset": number (-1.5..1.5),
      "duration": number (0.25..2.5)
    }
  ]
}`;

    case 'plant':
      return `TARGET SCHEMA (Plant Maker Botanical Cluster):
{
  "name": string (e.g. "Blue Crystal Cave Fern"),
  "summary": string,
  "cluster": {
    "target": "leaf" | "petal" | "fantasy",
    "shape": "leafBanana" | "leafElephantEar" | "leafTeardrop" | "leafBlade" | "leafMonstera" | "leafFern" | "leafLotus" | "leafHeartVine" | "petalRound" | "petalPointed" | "petalRuffled" | "petalOrchid" | "fantasyBell" | "fantasyMushroom" | "fantasySpiralRibbon" | "fantasyTrumpet",
    "count": number (3..20),
    "layout": "fan" | "randomCenter" | "spiral",
    "symmetrical": boolean,
    "randomness": number (0..0.9),
    "fanAngleDeg": number (15..80),
    "arcSpanDeg": number (90..360),
    "centerRadius": number (0.02..0.45),
    "hubHeight": number (0.02..0.6),
    "minScale": number (0.4..1.2),
    "maxScale": number (0.6..1.8),
    "tierLayers": number (1..3),
    "includeFlowerCore": boolean,
    "coreColor": "#RRGGBB",
    "baseDimensions": [width 0.15..1.4, thickness 0.06..0.5, length 0.3..1.9],
    "baseColor": "#RRGGBB",
    "pattern": "solid" | "veins" | "ribs" | "variegated" | "spotted" | "striped" | "gradientTip" | "bioluminescent",
    "accentColor": "#RRGGBB",
    "tipColor": "#RRGGBB",
    "emissiveColor": "#RRGGBB",
    "emissiveIntensity": number (0..1.8),
    "droop": number (-0.8..1.0),
    "cup": number (0..0.9),
    "ruffle": number (0..0.8),
    "veinDepth": number (0..0.9)
  },
  "extraParts": [ (optional stems/bulbs/mushrooms/glow orbs)
    {
      "name": string,
      "shape": "stemCurved" | "bulbCorm" | "flowerCenter" | "fantasySporeOrb" | "fantasyMushroom" | "vineTendril",
      "position": [number (-1..1), number (0..1.5), number (-1..1)],
      "dimensions": [number (0.1..1.2), number (0.1..1.5), number (0.1..1.2)],
      "color": "#RRGGBB",
      "emissive": "#RRGGBB",
      "emissiveIntensity": number (0..2.0)
    }
  ]
}`;

    case 'tree':
      return `TARGET SCHEMA (Tree Studio Canopy Config):
{
  "name": string (e.g. "Ancient Honey Oak"),
  "summary": string,
  "treeType": "oak" | "conifer" | "birch" | "fantasy" | "custom",
  "customTypeName": string,
  "treeGeneratorMode": "stylized" | "ezTree",
  "barkStyle": "oak" | "pine" | "birch" | "rough" | "painterly" | "knotty" | "fantasy",
  "barkColor": "#RRGGBB",
  "trunkHeight": number (2.2..9.5),
  "trunkThickness": number (0.35..2.2),
  "trunkLean": number (0..0.6),
  "majorBranchCount": number (0..7),
  "majorBranchLength": number (0.5..2.6),
  "majorBranchThickness": number (0.4..1.6),
  "majorBranchSpread": number (0.25..1.35),
  "majorBranchDroop": number (-0.8..0.8),
  "gnarlAmount": number (0..1.0),
  "hollowMode": "none" | "some" | "lots" | "all",
  "rootMode": "none" | "some" | "lots" | "all",
  "rootCount": number (2..9),
  "rootReach": number (0.7..3.0),
  "rootArchHeight": number (0..1.0),
  "silhouette": "dome" | "umbrella" | "cypress" | "tiered" | "windswept",
  "minPuffs": number (3..12),
  "maxPuffs": number (4..15),
  "canopyHeight": number (1.8..6.0),
  "basePuffSize": number (1.0..3.5),
  "foliageBaseColor": "#RRGGBB",
  "canopyLeavesEnabled": boolean,
  "canopyLeafShape": "basic" | "oak" | "maple" | "triple",
  "canopyLeafSeason": "custom" | "spring" | "summer" | "earlyFall" | "peakAutumn" | "winter" | "blossom" | "mystic",
  "canopyLeafColor": "#RRGGBB",
  "canopyLeafCount": number (40..520),
  "coniferTiers": number (3..10),
  "coniferShape": "classic" | "spire" | "snowDroop" | "flatBough" | "weeping",
  "fruitEnabled": boolean,
  "fruitCount": number (0..28),
  "fruitSize": number (0.1..0.48),
  "fruitColor": "#RRGGBB",
  "fruitDistribution": "outerCrown" | "underCanopy" | "hanging",
  "fruitGlow": number (0..1.5),
  "windSway": number (0..1.8)
}`;

    case 'character':
      return `TARGET SCHEMA (Character Maker SDF Clay Rig — READ UNITS & GUARDRAILS CAREFULLY):

ANATOMICAL UNITS & GUARDRAILS (WHAT NOT TO DO):
1. "shoulderWidth", "hipWidth", and "legStanceWidth" are HALF-WIDTHS IN METERS — NEVER MULTIPLIERS!
   - Humanoid defaults: "shoulderWidth": 0.215, "hipWidth": 0.125, "legStanceWidth": 0.12.
   - ALWAYS keep "shoulderWidth" between 0.14 and 0.28, "hipWidth" between 0.09 and 0.17, "legStanceWidth" between 0.10 and 0.19.
   - Values > 0.35 stretch arms several meters wide and cause marching-cubes voxel slicing / detached forearms!
2. NEVER fuse the thighs or make the crotch drop down to the knees:
   - Keep "blendSmoothness" tight: 0.022..0.045 for humans/knights/armored heroes; 0.045..0.08 only for rounded plush animals.
   - Keep "legStanceWidth" >= 0.115 whenever "upperLeg" or "hips" are broad/armored.
   - Keep "partScales" multipliers moderate (0.8..1.35). Never shrink arm/leg X/Z thickness below 0.78 (thin wrists/ankles snap in voxels).
3. ALWAYS set "armSpreadDeg" between 26 and 44 (natural A-pose; never 0..10 flat T-pose).
4. NEVER output monochrome white ("#FFFFFF") clay unless the user explicitly asks for snow/ghost/marble. Paint distinct headColor (skin/helmet/fur), coatColor (torso armor/tunic/fur), limbsColor (pants/greaves/sleeves), bellyColor (chestplate/trim/belly), and extremityTipColor (boots/gauntlets/hooves).

ARCHETYPE PLAYBOOK:
- KNIGHTS / WARRIORS / PALADINS / GUARDS:
  Use "presetId": "standardHumanoid" (or "adventurer"), "materialFinish": "toonSatin", "blendSmoothness": 0.028, metallic plate colors ("coatColor": "#94A3B8" steel or "#64748B" iron, "limbsColor": "#475569", "bellyPatchEnabled": true, "bellyColor": "#D97706" gold/tabard accent, "extremityTipColor": "#1E293B" boots/gauntlets). If helmeted/armored face: "headColor": "#94A3B8" + "addons.eyewear": "cyberVisor" (visor slit!) + "addons.eyewearColor": "#334155" + "addons.eyewearLensColor": "#1E293B" + "hairStyle": "none"; if open-faced knight: natural skin "headColor": "#E8B996", "hairStyle": "shortCrop", determined brows, optional beard. ALWAYS include "addons.bodyGear": "pauldrons" (shoulder armor!) or "cape", and optionally "addons.headGear": "crown" for royal knights.
- WIZARDS / MAGES:
  Use "presetId": "standardHumanoid", robe colors, "addons.headGear": "wizardHat", "addons.bodyGear": "cape", "facialHair": { "beardStyle": "wizardLong", "mustacheStyle": "walrus" }.
- ADVENTURERS / RANGERS / SCIENTISTS:
  Use "presetId": "adventurer" or "forestElf", tunic/coat colors, "addons.headGear": "adventurerCap", "addons.bodyGear": "backpack" or "quiver", optional "eyewear": "goggles" or "roundGlasses".
- ANIMALS / CRITTERS / BIRDS / MONSTERS:
  Match species preset ("storyBear", "storyFox", "storyRabbit", "storySquirrel", "storyHorse", "storyGecko", "storyOwl", "storyTweety", "hornedMonster", "pocketCritter"), set matching "muzzlePreset" (or "beakStyle" for birds; "none" for humans), "earStyle", "tailStyle", "handStyle", "footStyle", and "surfaceCoatMode".

{
  "name": string (e.g. "Sir Roland of Ironcrest" or "Barnaby the Honey Bear"),
  "summary": string,
  "presetId": "standardHumanoid" | "adventurer" | "forestElf" | "pocketCritter" | "alienExplorer" | "hornedMonster" | "storyHorse" | "storySquirrel" | "storyRabbit" | "storyFox" | "storyGecko" | "storyBear" | "storyOwl" | "storyTweety",
  "materialFinish": "clay" | "toonSatin" | "glossySlime" | "velvetCreature",
  "blendSmoothness": number (0.02..0.085),
  "shoulderWidth": number (HALF-WIDTH IN METERS 0.14..0.28, default 0.215),
  "hipWidth": number (HALF-WIDTH IN METERS 0.09..0.17, default 0.125),
  "legStanceWidth": number (HALF-WIDTH IN METERS 0.10..0.19, default 0.12),
  "armSpreadDeg": number (26..44),
  "headColor": "#RRGGBB" (skin tone for open-faced humans, helmet metal if visored, or fur/scale color),
  "coatColor": "#RRGGBB" (torso armor / tunic / jacket / upper coat),
  "limbsColor": "#RRGGBB" (arm sleeves/vambraces & leg pants/greaves),
  "bellyPatchEnabled": boolean,
  "bellyColor": "#RRGGBB",
  "extremityTipColor": "#RRGGBB" (boots, gauntlets, gloves, claws or hooves),
  "muzzlePreset": "none" | "bunnySplit" | "squirrelPuff" | "catWhiskerPad" | "foxTaper" | "dogSnout" | "horseMuzzle" | "bearBroad" | "lizardSnout",
  "snoutLength": number (0..0.22),
  "snoutWidth": number (0.04..0.14),
  "snoutColor": "#RRGGBB",
  "beakStyle": "none" | "songbird" | "duck" | "owl" | "eagleHawk" | "storkCrane" | "pelican",
  "beakColor": "#RRGGBB",
  "noseStyle": "none" | "buttonSphere" | "oval" | "flatButton" | "longHuman" | "bulbous" | "triangleAnimal" | "wideSnoutNose",
  "handStyle": "fingers5" | "fingers4" | "fingers3" | "paw" | "claw" | "hoof" | "nub",
  "handScale": number (0.8..1.35),
  "footStyle": "biped" | "paw" | "claw" | "hoof",
  "footScale": number (0.85..1.35),
  "earStyle": "none" | "human" | "elfPointed" | "rabbitLong" | "rabbitFloppy" | "squirrelRound" | "catFoxTriangle" | "dogFloppy" | "horsePerked" | "animalPerk" | "floppy" | "bat" | "fin" | "antennae",
  "earSize": number (0.5..1.6),
  "earColor": "#RRGGBB",
  "tailStyle": "none" | "bunnyCotton" | "squirrelPlume" | "horseTail" | "catTail" | "dogTail" | "foxBrush" | "lionTail" | "geckoTail" | "dragonTail" | "fishTail" | "birdTail" | "smooth" | "bulbTip" | "spiky" | "fluffy" | "fin",
  "hornCount": 0 | 1 | 2 | 4,
  "hornStyle": "straight" | "curvedBack" | "ramSpiral" | "devilSweep" | "antler",
  "hornColor": "#RRGGBB",
  "wingStyle": "none" | "birdRound" | "birdSoaring" | "birdLong" | "dragon" | "bat" | "feather" | "fairy" | "fairyButterfly" | "angelFeather",
  "wingSpan": number (0.5..1.6),
  "wingColor": "#RRGGBB",
  "hairStyle": "none" | "shortCrop" | "sidePart" | "pompadour" | "messySpiky" | "undercut" | "buzzFade" | "surferCurtains" | "longStraight" | "longEndCurls" | "bobCut" | "wavyShoulder" | "twinPigtails" | "highBun" | "braidedCrown" | "ponytail" | "curlyAfro" | "spikyTufts" | "mohawk" | "horseMane" | "lionMane" | "featherTuft" | "fluffyBangs",
  "hairColor": "#RRGGBB",
  "facialHair": {
    "mustacheStyle": "none" | "pencil" | "classicStraight" | "chevron" | "handlebar" | "imperial" | "walrus" | "bushyBrush",
    "beardStyle": "none" | "soulPatch" | "goatee" | "vanDyke" | "circleBeard" | "chinStrap" | "shortBoxed" | "fullTrimmed" | "bushyLumberjack" | "wizardLong" | "vikingBraided",
    "color": "#RRGGBB"
  },
  "irisColor": "#RRGGBB",
  "eyebrowExpression": "neutral" | "determined" | "friendly" | "surprised" | "sly",
  "mouthStyle": "none" | "smile" | "smirk" | "frown" | "catW" | "fangs" | "openSmile" | "openSurprised" | "openWorried" | "openGrin" | "beak",
  "surfaceCoatMode": "none" | "furShort" | "furLong" | "furClumped" | "scalesFish" | "scalesDragon" | "scalesHex",
  "addons": {
    "eyewear": "none" | "roundGlasses" | "goggles" | "cyberVisor" | "monocle",
    "eyewearColor": "#RRGGBB",
    "eyewearLensColor": "#RRGGBB",
    "headGear": "none" | "adventurerCap" | "wizardHat" | "crown" | "halo" | "flowerCrown",
    "headGearColor": "#RRGGBB",
    "headGearAccentColor": "#RRGGBB",
    "bodyGear": "none" | "backpack" | "quiver" | "cape" | "scarf" | "pauldrons",
    "bodyGearColor": "#RRGGBB",
    "bodyGearAccentColor": "#RRGGBB"
  },
  "spikes": {
    "enabled": boolean,
    "style": "porcupineQuills" | "boneSpikes" | "dorsalFins" | "crystalSpines",
    "zone": "spine" | "headAndBack" | "shouldersAndBack" | "fullBody",
    "color": "#RRGGBB",
    "tipColor": "#RRGGBB"
  },
  "partScales": {
    "head": [x 0.8..1.35, y 0.8..1.35, z 0.8..1.35],
    "neck": [x 0.8..1.25, y 0.7..1.3, z 0.8..1.25],
    "torso": [x 0.8..1.4, y 0.8..1.3, z 0.8..1.35],
    "belly": [x 0.8..1.35, y 0.8..1.3, z 0.8..1.35],
    "hips": [x 0.85..1.25, y 0.85..1.2, z 0.85..1.25],
    "upperArm": [x 0.85..1.35, y 0.85..1.25, z 0.85..1.35],
    "lowerArm": [x 0.85..1.35, y 0.85..1.25, z 0.85..1.35],
    "upperLeg": [x 0.85..1.25, y 0.85..1.25, z 0.85..1.25],
    "lowerLeg": [x 0.85..1.25, y 0.85..1.25, z 0.85..1.25]
  }
}`;

    case 'creature':
    case 'cast':
      return `TARGET SCHEMA (Creature / Monster / Cast Entity):
IMPORTANT FOR NATURAL ANIMALS:
- For moose, deer, stag, elk, antelope: set "presetId": "forest_stag", "headCount": 1, "headStyle": "wolf", "hornStyle": "stagAntlers", "pawStyle": "hoof", "tailStyle": "shortStub", "wingStyle": "none", "canFly": false, "spineSpikes": false, "bodyColor": "#6D442B" (brown), "bellyColor": "#C89B6D".
- For bears (grizzly, panda, polar): set "presetId": "grizzly_bear", "headCount": 1, "headStyle": "fluffy", "hornStyle": "none", "pawStyle": "paw", "tailStyle": "shortStub", "wingStyle": "none", "canFly": false, "spineSpikes": false.
- For wolves / dogs: set "presetId": "timber_wolf", "headCount": 1, "headStyle": "wolf", "wingStyle": "none", "canFly": false.
- For foxes: set "presetId": "red_fox", "headCount": 1, "wingStyle": "none", "canFly": false.
- For spiders / insects: set "presetId": "eight_leg_weaver", "legPairs": 4, "headCount": 1, "headStyle": "spider", "wingStyle": "fairyInsect".
- Unless asked for a multi-headed monster (like hydra or twin dragon), ALWAYS set "headCount": 1.
- All colors must be valid 6-hex strings (#RRGGBB).
{
  "name": string (e.g. "Majestic Mountain Moose" or "Sneaky Mountain Goat"),
  "summary": string,
  "presetId": "timber_wolf" | "red_fox" | "forest_stag" | "grizzly_bear" | "twin_dragon" | "hydra_beast" | "winged_manticore" | "six_leg_hound" | "eight_leg_weaver",
  "role": "baddie" | "buddy" | "npc",
  "isBoss": boolean,
  "health": number (2..25),
  "speed": number (1.5..8.5),
  "dialogue": string (optional greeting/taunt),
  "legPairs": 2 | 3 | 4,
  "headCount": 1 | 2 | 3,
  "headStyle": "wolf" | "dragon" | "demon" | "dino" | "fluffy" | "spider",
  "hornStyle": "none" | "twinHorns" | "ramCurl" | "stagAntlers" | "crownSpikes" | "rhinoHorn" | "unicorn" | "devilSweep" | "crystalCrown",
  "earStyle": "none" | "wolfPerk" | "foxTall" | "bearRound" | "floppy" | "batFin" | "frill",
  "wingStyle": "none" | "dragonBat" | "feathered" | "fairyInsect" | "wyvern" | "elementalEnergy",
  "canFly": boolean,
  "tailStyle": "none" | "bushy" | "dragonSpiked" | "club" | "stinger" | "shortStub" | "whip" | "bladeFin" | "twinFork",
  "pawStyle": "paw" | "claw" | "talon" | "hoof" | "arachnid" | "stump",
  "spineSpikes": boolean,
  "bodyLength": number (0.75..1.65),
  "bodyWidth": number (0.75..1.55),
  "legHeight": number (0.65..1.55),
  "scale": number (0.65..2.2),
  "bodyColor": "#RRGGBB",
  "bellyColor": "#RRGGBB",
  "accentColor": "#RRGGBB",
  "eyeColor": "#RRGGBB",
  "wingColor": "#RRGGBB",
  "surfaceCoatMode": "none" | "furShort" | "furLong" | "furClumped" | "scalesFish" | "scalesDragon" | "scalesHex",
  "expressionMood": "closed" | "open" | "angry" | "happy" | "shy",
  "primaryAttack": "clawSlash" | "groundPound" | "tailSmash" | "chargeGore" | "sonicRoar" | "fireBreath" | "iceBreath" | "waterJet" | "electricShock" | "poisonSpit" | "shadowBeam" | "solarBeam",
  "secondaryAttack": "clawSlash" | "groundPound" | "tailSmash" | "chargeGore" | "sonicRoar" | "fireBreath" | "iceBreath" | "waterJet" | "electricShock" | "poisonSpit" | "shadowBeam" | "solarBeam",
  "specialAbility": "none" | "intimidate" | "thickFat" | "flameBody" | "staticShell" | "swiftStride" | "galeWings" | "berserk" | "regenerator",
  "windupClueStyle": "auto" | "headSway3" | "footMarch" | "wingFlare" | "crouchPounce"
}`;

    case 'motion':
      return `TARGET SCHEMA (Motion Studio Keyframe Animation Clip):
{
  "name": string (e.g. "Bear Ground Pound" or "Queen Bee Sting Dance"),
  "summary": string,
  "slot": "idle" | "walk" | "run" | "jump" | "swim" | "attack" | "interact" | "sit" | "swing" | "sleep" | "crouch" | "sneak" | "stab" | "dying" | "celebrate" | "windup_headSway3" | "windup_footMarch" | "windup_wingFlare" | "windup_crouchPounce" | "groundPound" | "clawSlash" | "chargeGore",
  "duration": number (0.35..3.5 seconds),
  "loop": boolean,
  "autoCloseLoop": boolean,
  "easing": "linear" | "smooth" | "easeIn" | "easeOut" | "elastic",
  "keyframes": [ (3 to 7 keyframes ordered by normalized time 0.0 -> 1.0)
    {
      "time": number (0.0..1.0),
      "hipsOffsetY": number (-0.55..0.75 meters),
      "bones": {
        "<ExactBoneNameFromSnapshot>": [rxDeg (-150..150), ryDeg (-150..150), rzDeg (-150..150)]
      }
    }
  ]
}
IMPORTANT: Use ONLY bone names present in CURRENT STUDIO SNAPSHOT.boneNames (or GLB boneNames)!`;

    case 'world':
      return `TARGET SCHEMA (World Maker Terraform, Caves, Spiral Paths & Landmarks):
Coordinate space: x and z range within [-130, 130] meters on the island (0,0 is island center).
IMPORTANT: Unless the user explicitly asks for snow/winter/ice, do NOT use biome "snow" or weather "snow", and set mountainConfig.snowStartHeight to 28 so non-snowy tall mountains stay lush green & rocky rather than white snow.
If the user asks for an empty ocean / clear land / start over with water only, set "oceanOnly": true, "biome": "island", "sky": "sunny", "weather": "none", and leave arrays empty.
{
  "summary": string,
  "oceanOnly": boolean,
  "biome": "meadow" | "island" | "forest" | "snow" | "desert" | "cave" | "swamp" | "night",
  "sky": "sunny" | "golden" | "night" | "mist" | "storm" | "cave",
  "weather": "none" | "fireflies" | "leaves" | "rain" | "snow",
  "heroSpawn": [x (-110..110), z (-110..110)],
  "mountainConfig": {
    "rockStartHeight": number (3..10),
    "snowStartHeight": number (7..28 — use 28 if not snowy!),
    "noiseType": "fbm" | "ridged" | "billow" | "terraced",
    "roughness": number (0.2..1.0)
  },
  "mountains": [ (0 to 5 peaks/plateaus sculpted onto the island heightmap)
    {
      "x": number (-100..100),
      "z": number (-100..100),
      "radiusX": number (14..65),
      "radiusZ": number (14..65),
      "height": number (4..22),
      "falloff": "smooth" | "dome" | "peak" | "plateau",
      "spiralPath": {
        "enabled": boolean,
        "turns": number (1.0..2.8),
        "width": number (2.2..4.5),
        "name": string
      }
    }
  ],
  "caves": [ (0 to 2 enterable crystal caves carved into hillsides)
    {
      "name": string,
      "x": number (-95..95),
      "z": number (-95..95),
      "rotationDeg": number (-180..180),
      "scale": number (0.8..1.6),
      "crystalDensity": number (0..1.5),
      "crystalColor": "#RRGGBB",
      "hasSpring": boolean
    }
  ],
  "roads": [ (custom dirt trails beyond mountain spiral paths)
    {
      "name": string,
      "points": [[x, z], ...],
      "width": number (1.6..5.0),
      "borderScatter": "none" | "wildflowers" | "grass" | "boulders" | "mixed"
    }
  ],
  "waterBodies": [
    {
      "kind": "lake" | "river" | "pond",
      "name": string,
      "center": [x, z],
      "radiusX": number (8..35),
      "radiusZ": number (8..35),
      "waterColor": "#RRGGBB"
    }
  ],
  "landmarks": [ (optional trees/props/checkPoints/savePlinths to place on terrain)
    {
      "kind": "oakTree" | "pineTree" | "savePlinth" | "campfire" | "treasure" | "portal",
      "name": string,
      "x": number (-110..110),
      "z": number (-110..110),
      "scale": number (0.8..2.6),
      "dialogueOrNote": string
    }
  ]
}`;

    case 'logic':
      return `TARGET SCHEMA (Full Multi-Level Game Architecture, Portals, Save Plinths, NPCs & Behavior Rules):
Normalized board coordinates: x and y are between 0.08 and 0.92.
Valid BehaviorCard event keys: "levelStarts" | "playerTouches" | "playerNear" | "seesPlayer" | "takesDamage" | "healthLow" | "baddiesGone" | "playerTalks" | "playerUses" | "timer"
Valid BehaviorCard condition keys: "hasKey" | "playerClose" | "flagSet" | "isBoss" | "healthFull"
Valid BehaviorCard action keys: "chase" | "patrol" | "flyPattern" | "flee" | "attack" | "randomAttack" | "landAndAttack" | "enrage" | "playAnimation" | "say" | "playSound" | "openDoor" | "giveTreasure" | "giveItem" | "heal" | "setFlag" | "endLevel" | "shakeCamera" | "showMessage" | "unlockPortal"
{
  "projectTitle": string,
  "heroName": string,
  "heroColors": { "tunic": "#RRGGBB", "cloak": "#RRGGBB", "hair": "#RRGGBB", "skin": "#RRGGBB" },
  "summary": string,
  "levels": [ (1 to 4 connected levels forming the full game)
    {
      "name": string,
      "biome": "meadow" | "island" | "forest" | "snow" | "desert" | "cave" | "swamp" | "night",
      "sky": "sunny" | "golden" | "night" | "mist" | "storm" | "cave",
      "weather": "none" | "fireflies" | "leaves" | "rain" | "snow",
      "completeCondition": "reachPortal" | "collectAll" | "defeatAll" | "talkToNPC" | "gatherBuddies",
      "heroIntroSpeech": string,
      "startPoint": [x 0.1..0.9, y 0.1..0.9],
      "portalPoint": [x 0.1..0.9, y 0.1..0.9],
      "terrainStyle": "mountainSpiral" | "crystalCave" | "valleyLake" | "standard",
      "objectives": [string],
      "savePlinths": [{ "name": string, "x": number, "y": number }],
      "entities": [
        {
          "kind": "npc" | "baddie" | "treasure" | "key" | "door" | "pickup" | "prop" | "scenery",
          "name": string,
          "x": number (0.1..0.9),
          "y": number (0.1..0.9),
          "isBoss": boolean,
          "isBuddy": boolean,
          "health": number (1..20),
          "speed": number (1..7),
          "damage": number (1..4),
          "dialogue": string,
          "notes": string,
          "loot": string,
          "monsterPreset": null | "wolf" | "dragon" | "bear" | "stag" | "beetle",
          "cards": [
            {
              "when": { "key": string, "detail": string },
              "conditions": [{ "key": string, "detail": string }],
              "actions": [{ "key": string, "detail": string }],
              "isOnce": boolean
            }
          ]
        }
      ]
    }
  ]
}`;

    case 'interface':
      return `TARGET SCHEMA (HUD & Storybook Interface):
{
  "summary": string,
  "themeName": string,
  "storybookEnabled": boolean,
  "storybookTheme": "woodland" | "goldenMeadow" | "moonlitFable",
  "accentColor": "#RRGGBB",
  "widgets": [
    {
      "kind": "bar" | "counter" | "inventoryGrid" | "minimap" | "objectiveList" | "dialogue" | "pauseButton" | "bossBar" | "joystick" | "actionButton",
      "label": string,
      "binding": "health" | "stamina" | "magic" | "coins" | "keys" | "objectives" | "minimap" | "boss" | "dialogue",
      "anchor": "topLeading" | "top" | "topTrailing" | "bottomLeading" | "bottom" | "bottomTrailing",
      "fillHex": "#RRGGBB"
    }
  ]
}`;
  }
}
