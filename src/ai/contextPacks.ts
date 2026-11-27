import type { SkeletonInspection } from '../three/proceduralRigAnimator';
import type {
  AiStudioContextId,
  CharacterPromptGuide,
  DrivingGuideMod,
  DrivingGuideVehicleStyle,
  DrivingPromptGuide,
  PlatformerPromptGuide,
  RoguelikeGuideTrap,
  RoguelikePromptGuide,
  RoguelikeScenarioPreset,
  RpgPromptGuide,
  RpgScenarioPreset,
} from './studioBridge';

export const PLATFORMER_WORLD_STARTER_PROMPTS: string[] = [
  'Donkey Kong style vertical steel girder tower going upward with ladders, rolling hazards, spring launcher and treasure at the summit',
  'Donkey Kong Country layered jungle floor with elevated wooden canopy branches, climbable vines, baddies patrolling limbs and a secret bonus room',
  'Classic flat 2D sunny cliff run with moving platforms, spinning saw trap, giant bounce spring and hidden cavern treasure vault',
  'Deep coral underwater platformer with low-gravity swim feel, rising bubble streams, glowing kelp ledges, coral arches and sunken pearl vault',
];

export const DRIVING_WORLD_STARTER_PROMPTS: string[] = [
  'Winding tropical island road across volcanic cliffs with giant chasm gaps, timber stunt ramps, Mario Kart-style flight bonus cubes and glowing boost pads',
  'Flintstones prehistoric stone-age roller car with twin granite cylinder wheels, rustic log chassis, bone roll cage and dinosaur rib arches along a winding canyon dirt trail',
  'Formula 1 red sleek missile racer with low ground effect aero wings, thick mag slicks, neon boost pads and high-speed banked apex turns across a coastline circuit',
  'Porsche-style sport coupe with tinted sunroof, thick mag wheels, chasm glider wings and stunt jumps over island ocean inlets',
];

export const ROGUELIKE_WORLD_STARTER_PROMPTS: string[] = [
  'High-tech Cyberpunk Lab with neon cyan panels, holographic grid floors, laser tripwires, acid puddles, patrolling mech enforcers and Rogue Overseer AI boss',
  'Overgrown Mayan Jungle Ruins with ancient mossy stone walls, jungle earth, poison dart pillars, saw blades, jungle serpents and Jungle Behemoth boss',
  'Glacial Frost Citadel with translucent crystalline ice walls, permafrost floors, frost spike traps, frost wraiths and Glacial Sovereign boss',
  'Volcanic Abyss Caverns with obsidian basalt walls, ember basalt floors, fire geysers, lava plates, magma brutes and Infernal Dreadlord boss',
  'Sunken Coral Temple with abyssal coral walls, sea sand floors, whirlpool vortex traps, coral relics, abyssal lurkers and Leviathan Sovereign boss',
  'Desert Sandstone Pyramid with ancient hieroglyphs, desert sand, gold sarcophagi, poison dart pillars, mummy guards and Pharaoh Guardian boss',
  'Astral Cosmic Void with starry nebula tiles, void conduits, gravity saw vortexes, astral phantoms and Void Dreadlord boss',
];

export const RPG_WORLD_STARTER_PROMPTS: string[] = [
  'Detailed medieval village with rustic timber tavern, blacksmith forge, distressed organic wood fences, wandering chickens, stone village well, weathered broken stone paths, and recruited knight & mage companions',
  'Overgrown jungle temple ruins with lush tropical banyan & palm trees with hanging liana vines, giant exotic monstera plants, humid mist, rope bridge with wooden slats & broken slat across a chasm, and fanned-out reward cards',
  'Deep dark wooded forest so lush the sky is hidden, hidden magic glowing inside an ancient hollow tree and forest cottage, weathered stepping stones, and an ogre brute guarding a rune shrine',
  'Isometric cutaway cottage & tavern interior with warm hearth fireplace, volumetric lantern light beams, alchemy shelves, wooden tables, secret cave cellar, and both traditional chest loot & fanned card choices',
];

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
    tagline: 'Builds curved splines (bows, horns, cables), tapered/bent primitives, turned lathes, organic SDF sculptures & boolean cutouts.',
    accentHex: '#7C5CFF',
    saveAreaLabel: 'Save to Objects',
    starterPrompts: [
      'Recurved wooden hunter bow with tapered flat limbs, leather hand grip, taut thin bowstring and nocked arrow',
      'Warm glowing iron & amber-glass hanging trail lantern with curved handle ring and cap',
      'Vintage flintlock pistol with carved wooden stock, tapered metal barrel, trigger guard cutout and hammer',
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

function formatPlatformerGuideSection(
  guide?: PlatformerPromptGuide | null
): string {
  if (!guide) return '';
  const lines: string[] = [];
  if (guide.layoutStyle !== 'auto') {
    lines.push(`- Platformer Layout Architecture: ${guide.layoutStyle}`);
  }
  if (guide.theme !== 'auto') {
    lines.push(`- Visual Theme & Layer Palette: ${guide.theme}`);
  }
  if (guide.mechanics.length > 0) {
    lines.push(
      `- Required Platformer Elements (MUST build all checked): ${guide.mechanics.join(', ')}`
    );
  }
  if (lines.length === 0) return '';
  return `USER PLATFORMER PROMPT HELPER SELECTIONS (HIGHEST PRIORITY — MUST OBEY):\n${lines.join('\n')}`;
}

export function formatDrivingGuideSection(guide?: DrivingPromptGuide | null): string {
  if (!guide) return '';
  const lines: string[] = [];
  if (guide.vehicleStyle && guide.vehicleStyle !== 'auto') {
    const styleDescriptions: Record<Exclude<DrivingGuideVehicleStyle, 'auto'>, string> = {
      flintstones: 'Flintstones stone-age vehicle: twin heavy granite log rollers, rustic lashed wood log chassis, bone roll cage, stone slab seating, prehistoric horn.',
      f1Racer: 'Formula 1 high-speed racecar: low aerodynamic monocoque chassis, prominent front/rear aero wing downforce, slick low-profile tires, halo cockpit guard.',
      sportCoupe: 'Sport Coupe / Porsche-style fastback: curved aerodynamic canopy, tinted sunroof, frog-eye headlamps, quad tail exhaust, thick alloy mag wheels.',
      motorbike: 'Two-wheeled scrambler motorbike: front suspension fork, exposed engine block, dual spoke wheels, high rise handlebars, agile lean physics.',
      trailBuggy: 'All-terrain tube chassis crawler buggy with long travel suspension and knobby off-road tires.',
      rallyCoupe: 'Lightweight rally sprint coupe tuned for dirt slides and apex drifts.',
      forestTruck: 'Heavy 4x4 pickup truck with high ground clearance, bullbar and roll bar lights.',
      vintageRoadster: 'Open-top classic roadster with rounded sweeping fenders and chrome wire rims.',
    };
    lines.push(`- Requested Vehicle Archetype: ${guide.vehicleStyle} (${styleDescriptions[guide.vehicleStyle] ?? ''})`);
  }
  if (guide.trackStyle && guide.trackStyle !== 'auto') {
    lines.push(`- Track Architecture Style: ${guide.trackStyle}`);
  }
  if (guide.mods && guide.mods.length > 0) {
    const modMap: Record<DrivingGuideMod, string> = {
      thickMagWheels: 'Equip "thickMag" wide alloy wheels with deep-dish rims.',
      stoneRollerWheels: 'Equip "stoneRoller" heavy prehistoric cylindrical granite wheels.',
      slickWheels: 'Equip "slick" smooth high-grip racing slicks.',
      tintedSunroof: 'Equip "sunroof" dark tinted glass canopy on the vehicle roof.',
      openRoadster: 'Equip "openTop" roadster canopy without roof pillars.',
      chasmGliderWings: 'Equip "gliderWings" aerodynamic wings (glides through the air across deep island gorges when holding Space).',
      turboJetWings: 'Equip "jetWing" turbo jet thrusters and aerodynamic wings.',
      neonBoostPads: 'Place glowing "boostPad" entities along straights and leading into launch ramps.',
      flightBonusCubes: 'Place floating Mario Kart-style "flightCube" bonus pickups granting 9.5s temporary flight over chasms.',
      stuntRamps: 'Place angled "ramp" timber stunt ramps right before gorges and chasm gaps.',
      carvedChasms: 'Carve deep chasm/canyon gaps in the terrain with steep cliffs down to the ocean.',
    };
    lines.push(`- Active Vehicle Mods & Course Mechanics (MUST INCLUDE):\n${guide.mods.map((m: DrivingGuideMod) => `  * ${modMap[m] ?? m}`).join('\n')}`);
  }
  if (lines.length === 0) return '';
  return `USER DRIVING COURSE & VEHICLE HELPER SELECTIONS (HIGHEST PRIORITY — MUST OBEY):\n${lines.join('\n')}`;
}

export function formatRoguelikeGuideSection(guide?: RoguelikePromptGuide | null): string {
  if (!guide) return '';
  const lines: string[] = [];
  if (guide.scenario && guide.scenario !== 'auto') {
    const scenarioMap: Record<RoguelikeScenarioPreset, string> = {
      auto: 'Adaptive roguelike scenario.',
      ancientCrypt: 'Ancient Torchlit Crypt: dark damp stone masonry, flagstone/slate floors, bone plinths, torches, iron spikes, skeletons & Crypt Warden boss.',
      cyberpunkLab: 'High-Tech Cyberpunk Lab: glowing neon cyber panels, holographic grid floors, server terminals, laser tripwires, acid puddles, cyber mechs & Rogue Overseer AI boss.',
      overgrownJungle: 'Overgrown Jungle / Mayan Ruins: mossy ancient stone, jungle earth, monolith steles, poison dart pillars, saw blades, serpents & Jungle Behemoth boss.',
      volcanicAbyss: 'Volcanic Abyss Caverns: obsidian basalt walls, ember basalt floors, arcane braziers, fire geysers, ember plates, magma brutes & Infernal Dreadlord boss.',
      frostCitadel: 'Glacial Ice Citadel: crystalline ice walls, frozen permafrost floors, glacial spires, frost spikes, chilling wights & Glacial Sovereign boss.',
      sunkenTemple: 'Sunken Coral Temple: abyssal coral walls, sea sand floors, coral relics, whirlpool vortex traps, deepsea lurkers & Leviathan Sovereign boss.',
      desertPyramid: 'Desert Sandstone Pyramid: warm hieroglyphic sandstone, desert sand floors, gold sarcophagi, poison dart pillars, cursed runes, mummy guards & Pharaoh Guardian boss.',
      astralVoid: 'Astral Cosmic Void: starry void walls, cosmic tiles, astral pylons, gravity saw vortexes, void phantoms & Void Dreadlord boss.',
    };
    lines.push(`- Scenario Theme: ${guide.scenario} (${scenarioMap[guide.scenario] ?? guide.scenario})`);
  }
  if (guide.traps && guide.traps.length > 0) {
    lines.push(`- Traps & Hazards (MUST INCLUDE): ${guide.traps.join(', ')}`);
  }
  if (guide.enemyDensity) {
    lines.push(`- Enemy Encounter Density: ${guide.enemyDensity}`);
  }
  if (guide.bossTheme && guide.bossTheme !== 'auto') {
    lines.push(`- Boss Encounter Theme: ${guide.bossTheme}`);
  }
  if (lines.length === 0) return '';
  return `USER ROGUELIKE SCENARIO & DUNGEON HELPER SELECTIONS (HIGHEST PRIORITY — MUST OBEY):\n${lines.join('\n')}`;
}

export function formatRpgGuideSection(guide?: RpgPromptGuide | null): string {
  if (!guide) return '';
  const lines: string[] = [];
  if (guide.scenario && guide.scenario !== 'auto') {
    const scenarioMap: Record<RpgScenarioPreset, string> = {
      auto: 'Detailed isometric RPG scene with full-sized walk-in enterable buildings, river gorge slat bridge, and living village cast.',
      medievalVillage: 'Medieval Village: FULL-SIZED walk-in Tavern (with hinged front door, fireplace, bar, bartender, seated patrons at tables, upstairs inn loft, wall lanterns, framed wall pictures & wooden floors), FULL-SIZED walk-in Blacksmith (with red-hot forge, anvil, blacksmith hammering glowing metal with flying sparks), tethered horses outside the tavern, enclosed distressed organic wood fence pen keeping wandering chickens in, hanging lamp posts flanking the village entrance road, villagers walking the road, villager raking their yard, and a walkable wooden slat rope bridge spanning across a real water river gorge between two higher pieces of land.',
      jungleRuins: 'Overgrown Jungle Ruins: lush tropical banyan & palm trees with hanging vines (NO pine or oak trees!), exotic giant monstera & fern plants, mossy walk-in stone temple sanctum, humid mist & fog, and a wooden slat rope bridge spanning across a deep water river gorge between two elevated jungle banks.',
      deepWoodedForest: 'Deep Wooded Forest: dense towering canopy hiding the sky (with automatic camera zoom when foliage obscures view), hidden magic glowing inside hollow trees & full-sized walk-in forest cottages, weathered stone & river-spanning rope bridge slats.',
      stoneTemple: 'Ancient Stone Temple: full-sized walk-in vine-draped stone temple sanctum with hinged sanctuary doors, wall lanterns, framed bas-relief murals, benches, rune puzzles, detailed stone altar & guardians.',
      coastalVillage: 'Coastal Fishing Village: wooden docks, stone sea walls, weathered slat walkways, full-sized walk-in tavern with bartender & patrons, tethered horses & seaside shrines.',
      interiorCottage: 'Isometric Cutaway Forest Cottage Interior: spacious walk-in stone & timber hall, glowing hearth fireplace, wall lanterns, framed wall pictures, windows, wooden plank floors, alchemy table, benches & bookshelves.',
      interiorTavern: 'Isometric Cutaway Medieval Tavern Interior: full-sized walk-in great hall, roaring hearth fire, oak bar with bartender, multiple tables & benches with seated patrons, stairs to upstairs inn loft, wall lanterns, windows, framed wall pictures & wooden floors.',
      interiorCave: 'Isometric Cutaway Deep Cavern Interior: jagged rock cavern walls, glowing crystals, volumetric lantern god-rays, underground river gorge with wooden slat rope bridge & ancient shrine.',
    };
    lines.push(`- RPG World Scenario: ${guide.scenario} (${scenarioMap[guide.scenario] ?? guide.scenario})`);
  }
  if (guide.pathStyle) {
    lines.push(`- Terraformed Path & Bridge Style: ${guide.pathStyle} (weathered broken organic stones, and a walkable wooden slat rope bridge with the odd broken slat spanning across a real water-filled river gorge between two higher pieces of land).`);
  }
  if (guide.lootStyle) {
    lines.push(`- Loot & Treasure System: ${guide.lootStyle} (support traditional chests/ground items AND fanned-out colorful card choices upon defeating enemies, opening shrines, or solving puzzles).`);
  }
  if (guide.companionRecruits) {
    lines.push(`- Recruited Companions: ${guide.companionRecruits} (player + recruited allies fighting alongside with sword, bow & magic).`);
  }
  if (guide.worldAtmosphere) {
    lines.push(`- Atmosphere & Flora: ${guide.worldAtmosphere} (refined smaller-scale organic landscaping, atmospheric fog/mist, non-blocky shapes, volumetric lantern lighting).`);
  }
  if (lines.length === 0) return '';
  return `USER ISOMETRIC RPG SCENARIO & DETAILS HELPER SELECTIONS (HIGHEST PRIORITY — MUST OBEY):\n${lines.join('\n')}`;
}

export function buildContextualAiPrompts(params: {
  context: AiStudioContextId;
  userRequest: string;
  snapshot: Record<string, unknown>;
  glbSummary?: GlbAiSummary | null;
  modifyExisting?: boolean;
  characterGuide?: CharacterPromptGuide | null;
  platformerGuide?: PlatformerPromptGuide | null;
  drivingGuide?: DrivingPromptGuide | null;
  roguelikeGuide?: RoguelikePromptGuide | null;
  rpgGuide?: RpgPromptGuide | null;
  hasReferenceImage?: boolean;
}): { systemPrompt: string; userPrompt: string } {
  const {
    context,
    userRequest,
    snapshot,
    glbSummary,
    modifyExisting,
    characterGuide,
    platformerGuide,
    drivingGuide,
    roguelikeGuide,
    rpgGuide,
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
    context === 'character'
      ? formatCharacterGuideSection(characterGuide)
      : context === 'world' && snapshot?.environmentType === 'sideScroller'
      ? formatPlatformerGuideSection(platformerGuide)
      : context === 'world' && snapshot?.gameplayMode === 'driving'
      ? formatDrivingGuideSection(drivingGuide)
      : context === 'world' && snapshot?.gameplayMode === 'roguelike'
      ? formatRoguelikeGuideSection(roguelikeGuide)
      : context === 'world' && snapshot?.gameplayMode === 'rpg'
      ? formatRpgGuideSection(rpgGuide)
      : '';

  const refImageSection = hasReferenceImage
    ? `ATTACHED VISUAL GUIDE IMAGE:
Study the attached reference image carefully. Match the subject's silhouette, species/humanoid build, clothing or armor colors, headgear/helmets, eyewear/visor, facial hair, ears/horns/wings/tail, and personality while staying strictly inside the exact Maker schema and anatomical meter bounds.`
    : '';

  const schemaSpec = getSchemaSpecForContext(context, snapshot);
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

function getSchemaSpecForContext(
  context: AiStudioContextId,
  snapshot?: Record<string, unknown>
): string {
  switch (context) {
    case 'object':
      return `TARGET SCHEMA (Object Maker Multi-Part & Curved/Sculpted Prop):

CONSTRUCTION RULES & CAPABILITIES (READ CAREFULLY):
1. NEVER build curved shapes (bows, horns, tusks, handles, cables, arches, scythes, sickles, fishing rods) out of a straight stick/cylinder!
   - Use "shape": "splineTube" with 5 to 9 ordered 3D control points in "splineConfig.points" that trace the true silhouette curve, plus smooth end tapers ("taperStart": 0.25..0.5, "taperEnd": 0.25..0.5, "taperSmoothStart": 0.45..0.8, "taperSmoothEnd": 0.45..0.8).
   - Or add "bendAngle" (-160..160) & "taperStart"/"taperEnd" (0.05..2.0) to cylinders/planks/beams.
2. BOWS & RECURVE WEAPONS:
   - MUST use a symmetric 7-point curved "splineTube" ("profile": "flatStave", "ovalness": 0.45, "radius": 0.032..0.045, "mirrorSymmetry": "y") whose belly curves toward +Z at Y=0 (e.g. [0,0,0.18]) and tips recurve smoothly at top/bottom (e.g. [0,±0.68,-0.16]) with tapered nock tips ("taperStart": 0.35, "taperEnd": 0.35, "taperSmoothStart": 0.65, "taperSmoothEnd": 0.65).
   - Add a separate vertical leather grip wrap ("cylinder" or "splineTube") at the handle center, tip nock caps, and a taut straight bowstring ("cylinder", dimensions: [0.012, stringLength, 0.012]) spanning straight between the exact Z/Y coordinates of the two bowstring tip points! Optionally add a resting/nocked arrow if appropriate.
3. TURNED VESSELS / BARRELS / BOTTLES / CHALICES / COLUMNS:
   - Use "shape": "lathe" with "latheProfile": [[radius, y], ...] from bottom to top (up to 16 points, radius >= 0.005).
4. ORGANIC / CREATURE / ROCK / SKULL / CARVED FORMS:
   - Use "shape": "sdfBlob" with "sdfBlobConfig": { "blendK": 0.12, "resolution": 28, "primitives": [...] } combining smooth-blended ellipsoids, curved capsules, rounded boxes, and negative "op": "sub" eye sockets or hollows!
5. COMPLEX HARD-SURFACE CUTOUTS (GUNS, TRIGGER GUARDS, KEYHOLES, SLOTS, ARCHED WINDOWS):
   - Combine tapered/bent primitives & "lathe" barrels with optional cutter parts marked "isCutter": true and "cutTargets": ["PartName"] — the engine automatically boolean-subtracts "isCutter" volumes out of those target parts!
6. Thin strings, wires, sights, blades, triggers can go down to 0.01m ("dimensions": [0.01..3, 0.01..3, 0.01..3]).

{
  "name": string (short asset title, e.g. "Recurved Hunter Bow"),
  "category": "prop" | "scenery" | "building",
  "summary": string,
  "attachBodyPart": null | "rightHand" | "leftHand" | "head" | "back" | "hips",
  "parts": [ (1 to 16 parts centered around X=0, Z=0, base near Y=0)
    {
      "name": string,
      "shape": "splineTube" | "lathe" | "sdfBlob" | "cube" | "halfCube" | "sphere" | "hemisphere" | "cylinder" | "cone" | "capsule" | "torus" | "wedge" | "arch" | "prism" | "plank" | "beamLarge" | "beamSmall" | "stairs" | "pillar" | "fence" | "roofAFrame" | "roofSlope",
      "position": [number (-3..3), number (-2..4), number (-3..3)],
      "rotation": [number (deg -180..180), number, number],
      "dimensions": [number (0.01..3.5), number (0.01..3.5), number (0.01..3.5)],
      "bevel": number (0..0.35),
      "segments": number (8..32),
      "taperStart": number (0.05..2.0, optional, default 1),
      "taperEnd": number (0.05..2.0, optional, default 1),
      "taperSmoothStart": number (0.05..1.0, optional, default 0.35),
      "taperSmoothEnd": number (0.05..1.0, optional, default 0.35),
      "bendAngle": number (-165..165 deg, optional, default 0),
      "bendAxis": "x" | "z" (optional, default "z"),
      "twistAngle": number (-360..360 deg, optional, default 0),
      "splineConfig": { (REQUIRED when shape === "splineTube")
        "points": [[x, y, z], ...] (3..12 local points relative to part position!),
        "pointRadii": [number (0.1..2.5), ...] (optional per-point multiplier matching points.length),
        "profile": "round" | "oval" | "flatStave" | "beveledBar",
        "radius": number (0.008..0.5),
        "ovalness": number (0.25..1.8, e.g. 0.45 for flat bow stave),
        "taperStart": number (0.05..2.0),
        "taperEnd": number (0.05..2.0),
        "taperSmoothStart": number (0.05..1.0),
        "taperSmoothEnd": number (0.05..1.0),
        "closed": boolean,
        "mirrorSymmetry": "none" | "y" | "x"
      },
      "latheProfile": [[radius 0.005..1.5, y -2..2], ...] (REQUIRED when shape === "lathe", ordered bottom->top),
      "sdfBlobConfig": { (REQUIRED when shape === "sdfBlob")
        "blendK": number (0.03..0.35),
        "resolution": number (20..36),
        "primitives": [
          {
            "kind": "ellipsoid" | "capsule" | "roundedBox",
            "op": "add" | "sub",
            "a": [x, y, z],
            "b": [x, y, z] (radii/half-extents for ellipsoid/box, or end point for capsule/cone),
            "startRadius": number (0.02..0.5, for capsule/cone),
            "midRadius": number (0.02..0.5, for capsule),
            "endRadius": number (0.01..0.5, for capsule/cone),
            "curvature": number (-0.6..0.6)
          }
        ]
      },
      "isCutter": boolean (optional; set true to boolean-subtract this volume from cutTargets or overlapping solid parts!),
      "cutTargets": [string] (optional list of part names to carve when isCutter is true),
      "materialId": null | "hewnStone" | "sandstone" | "randomCobble" | "timberPlank" | "roundLogs" | "rustedIron" | "clayTile" | "thatchedStraw",
      "color": "#RRGGBB",
      "roughness": number (0.08..0.95),
      "metalness": number (0..1),
      "emissive": "#RRGGBB" (optional),
      "emissiveIntensity": number (0..2.5)
    }
  ],
  "mechanisms": [ (optional interactive joints OR platformer contraptions like spinners, swings, bounce springs & transporters)
    {
      "name": string,
      "targetPartName": string (must match a non-cutter part.name above),
      "kind": "hinge" | "slider" | "spinner" | "pendulum" | "springBounce" | "transporter",
      "axis": "x" | "y" | "z",
      "openAngleDeg": number (-160..160),
      "openOffset": number (-1.5..1.5),
      "duration": number (0.25..2.5),
      "spinSpeedDegPerSec": number (-720..720, for spinner),
      "swingAmplitudeDeg": number (5..140, for pendulum),
      "swingFrequencyHz": number (0.15..3.0, for pendulum),
      "bounceVelocity": number (8..32, for springBounce),
      "isHazard": boolean (optional, true for deadly saws/blades/spiked pendulums),
      "transportLabel": string (optional, for transporter cannons/pads)
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
      if (snapshot?.environmentType === 'sideScroller') {
        return `TARGET SCHEMA (2D / 2.5D Platformer Stage Director — Full Layer, Contraption & Secret Room Control):
COORDINATE SPACE:
- World X spans [-48, +48] meters horizontally (player runs left->right or climbs upward); Hero Z is 0.
- Y is elevation in meters: floor ground typically sits at Y=0..2; upper branches/girders/platforms stack upward at Y=4, Y=8, Y=12, Y=16, Y=20+; secret rooms sit tucked underground around Y=-16 or high sky around Y=24!
- Set "layoutStyle" intentionally:
  * "flat2D": Classic left-to-right sunny/castle/cavern run with gaps, cliffs, bridges, moving lifts & secret cavern.
  * "verticalClimber": Donkey-Kong-style stacked steel girders / tiers climbing upward (Y=0 -> Y=5 -> Y=10 -> Y=15 -> Y=20) connected by "ladder" climbs!
  * "layeredJungle": Donkey-Kong-Country-style solid jungle ground floor PLUS elevated "branch" canopy platforms (with baddies patrolling branches!) connected by climbable "vine" ropes and bounce pads!
  * "underwater": Low-gravity underwater coral reef platformer ("swimPhysics": true, "gravityScale": 0.48, "liquidType": "water") with rising "bubbleStream" lifts!
  * "skyTemple" / "cavern": Cloud ruins or glowing subterranean crystal chasms.
{
  "summary": string,
  "layoutStyle": "flat2D" | "verticalClimber" | "layeredJungle" | "underwater" | "skyTemple" | "cavern",
  "theme": "sunnyCliffs" | "jungleCanopy" | "underwaterCoral" | "volcanicForge" | "crystalCavern" | "skyTemple",
  "biome": "meadow" | "island" | "forest" | "snow" | "desert" | "cave" | "swamp" | "night",
  "sky": "sunny" | "golden" | "night" | "mist" | "storm" | "cave",
  "weather": "none" | "fireflies" | "leaves" | "rain" | "snow",
  "gravityScale": number (0.35..1.4, default 1.0; use 0.45..0.6 for underwater),
  "swimPhysics": boolean (true ONLY for underwater levels),
  "layers": {
    "midgroundStyle": "cliffsAndPines" | "jungleTreesAndVines" | "coralReefAndKelp" | "volcanicSpires" | "crystalCaverns" | "floatingTemples",
    "heroLaneColor": "#RRGGBB",
    "heroTrimColor": "#RRGGBB",
    "foregroundColor": "#RRGGBB",
    "midgroundColor": "#RRGGBB",
    "farColor": "#RRGGBB",
    "liquidType": "water" | "lava" | "mist" | "none",
    "liquidColor": "#RRGGBB",
    "liquidLevelY": number (-12..2)
  },
  "segments": [ (4 to 14 walkable terrain slabs / upper branches / girders)
    {
      "minX": number (-48..42),
      "maxX": number (-42..48),
      "y": number (-2..24),
      "style": "cliff" | "bridge" | "stone" | "jungleFloor" | "branch" | "girder" | "coral" | "crystal" | "cloud",
      "oneWay": boolean (true for upper branches/girders player can jump up through & press Down to drop through),
      "color": "#RRGGBB" (optional custom tint)
    }
  ],
  "vines": [ (0 to 8 climbable vines, ladders, or underwater bubble streams connecting lower & upper segments)
    {
      "kind": "vine" | "ladder" | "bubbleStream",
      "x": number (-42..42),
      "bottomY": number (-4..18),
      "topY": number (2..26)
    }
  ],
  "secretRooms": [ (0 to 2 hidden bonus chambers with entrance warp portal & treasure chest inside!)
    {
      "name": string,
      "entranceX": number (-38..38),
      "entranceY": number (-2..22),
      "roomCenterX": number (-30..30),
      "roomCenterY": number (-20..-12 or 22..28),
      "width": number (10..18)
    }
  ],
  "platforms": [ (0 to 6 moving/spinning platforms, bounce pads, or saw wheels)
    {
      "name": string,
      "preset": "stoneLift" | "swingingBridge" | "spinningDisc" | "jungleVine" | "bouncePad" | "crumbleStone" | "sawWheel",
      "motion": "slide" | "vertical" | "spin" | "pendulum",
      "x": number (-42..42),
      "y": number (-2..24),
      "endX": number (-42..42),
      "endY": number (-2..24),
      "speed": number (1..7)
    }
  ],
  "contraptions": [ (0 to 5 interactive mechanical objects: giant springs, spinning blade wheels, swinging hazards, warp cannons!)
    {
      "name": string,
      "template": "bounceSpring" | "spinHazard" | "pendulumVine" | "warpCannon",
      "x": number (-42..42),
      "y": number (-2..24),
      "scale": number (0.7..2.0),
      "bounceVelocity": number (12..28, for bounceSpring),
      "targetX": number (-42..42, for warpCannon),
      "targetY": number (-20..26, for warpCannon)
    }
  ],
  "baddies": [ (1 to 8 patrolling enemies placed ON ground or ON elevated branches/girders)
    {
      "name": string,
      "x": number (-42..42),
      "y": number (-2..24),
      "isBoss": boolean,
      "health": number (1..12),
      "speed": number (1.5..6),
      "tint": "#RRGGBB"
    }
  ],
  "traps": [ (0 to 6 floor spike/hazard traps)
    {
      "name": string,
      "x": number (-42..42),
      "y": number (-2..24)
    }
  ],
  "treasures": [ (1 to 5 treasure chests/bonuses — place one inside secretRoom center if secretRooms present!)
    {
      "name": string,
      "x": number (-42..42),
      "y": number (-22..28)
    }
  ],
  "startPoint": { "x": number (-44..44), "y": number (-2..24) },
  "portalPoint": { "x": number (-44..44), "y": number (-2..24) }
}`;
      }
      if (snapshot?.gameplayMode === 'driving') {
        return `TARGET SCHEMA (High-Speed Driving Course, Island Circuit & Custom Vehicle Director):
Coordinate space: x and z range within [-120, 120] meters on the island (0,0 is island center).
The AI can build custom vehicles, create winding roads across island cliffs with carved chasms/gorges, and place Mario Kart-style flight bonus cubes, neon boost pads, timber stunt ramps, road barriers, and rally arches!

{
  "summary": string,
  "biome": "meadow" | "island" | "forest" | "snow" | "desert" | "cave" | "swamp" | "night",
  "sky": "sunny" | "golden" | "night" | "mist" | "storm" | "cave",
  "weather": "none" | "fireflies" | "leaves" | "rain" | "snow",
  "vehicle": {
    "carId": "flintstones" | "f1Racer" | "sportCoupe" | "motorbike" | "trailBuggy" | "rallyCoupe" | "forestTruck" | "vintageRoadster",
    "physicsId": "arcadeDrift" | "grippyRally" | "offroadCrawler",
    "driverId": "stunt" | "ranger" | "skunk" | "bot",
    "cameraView": "closeChase" | "driverPov" | "farChase",
    "custom": {
      "bodyColor": "#RRGGBB",
      "accentColor": "#RRGGBB",
      "rimColor": "#RRGGBB",
      "wheelStyle": "standard" | "thickMag" | "offroadKnobby" | "stoneRoller" | "slick",
      "roofStyle": "standard" | "sunroof" | "openTop" | "rollCage",
      "wingStyle": "none" | "gliderWings" | "aeroFins" | "jetWing",
      "hasSpoiler": boolean,
      "hasBullbar": boolean,
      "hasTwinExhaust": boolean
    }
  },
  "track": {
    "waypoints": [ [x, z], ... (5 to 16 waypoints forming a continuous winding island road or circuit) ],
    "trackHalfWidth": number (4.0..8.0, default 5.2),
    "surfaceLayer": "sand" | "rock" | "cliff" | "snow",
    "chasmGaps": [
      {
        "centerWaypointIndex": number (index along waypoints list where a deep gorge / chasm is carved into the terrain),
        "gapRadius": number (12..28 meters wide chasm that vehicles leap over with ramps/boost/flight wings)
      }
    ]
  },
  "stuntRamps": [ (1 to 6 stunt launch ramps placed right before chasms or jumps)
    { "x": number (-110..110), "z": number (-110..110), "yaw": number (radians) }
  ],
  "flightCubes": [ (1 to 6 glowing winged bonus cubes that grant Mario Kart-style temporary flight over chasms)
    { "x": number (-110..110), "z": number (-110..110) }
  ],
  "boostPads": [ (2 to 8 neon chevron boost pads on straights and before ramps)
    { "x": number (-110..110), "z": number (-110..110), "yaw": number (radians) }
  ],
  "roadBarriers": [ (0 to 8 hazard barriers creating slalom chicanes or marking cliff edges)
    { "x": number (-110..110), "z": number (-110..110), "yaw": number (radians) }
  ],
  "checkpointArches": [ (2 to 8 rally checkpoint arches along the course)
    { "x": number (-110..110), "z": number (-110..110), "yaw": number (radians) }
  ],
  "playerSpawn": [x (-110..110), z (-110..110)]
}`;
      }
      if (snapshot?.gameplayMode === 'roguelike') {
        return `TARGET SCHEMA (Multi-Scenario Roguelike Director — Any Theme, Traps, Themed Enemies & Bosses):
The engine supports ANY roguelike scenario (not just classic stone crypts!):
- "cyberpunkLab": High-tech lab, cyberPanels walls, cyberGrid floors, cyberTerminals, laserTripwires, acidPuddles, Laser Drones, Mech Enforcers, Rogue Overseer AI boss.
- "overgrownJungle": Mayan ruins, overgrownStone walls, jungleEarth floors, jungleMonoliths, poisonDartPillars, sawBlades, Jungle Vipers, Mayan Guardians, Jungle Behemoth boss.
- "volcanicAbyss": Magma cavern, obsidianBasalt walls, emberBasalt floors, arcaneBraziers, fireGeysers, emberPlates, Magma Imps, Flame Golems, Infernal Dreadlord boss.
- "frostCitadel": Crystalline citadel, glacialIce walls, frozenPermafrost floors, glacialCrystals, frostSpikes, Frost Wraiths, Ice Wights, Glacial Sovereign boss.
- "sunkenTemple": Coral ruins, sunkenCoral walls, abyssalSand floors, coralRelics, whirlpoolVortex, Abyssal Skimmers, Coral Lurkers, Leviathan Sovereign boss.
- "desertPyramid": Sandstone pyramid, sandstoneHieroglyphs walls, desertSandstone floors, desertSarcophagi, poisonDartPillars, cursedRunes, Mummy Guards, Pharaoh Guardian boss.
- "astralVoid": Cosmic void, astralVoid walls, cosmicTiles floors, astralPylons, cursedRunes, sawBlades, Star Phantoms, Cosmic Horrors, Void Dreadlord boss.
- "ancientCrypt": Damp masonry, dampMasonry walls, flagstone floors, cryptBarrels, ironSpikes, cursedRunes, Skeletons, Bats, Crypt Warden boss.

{
  "summary": string,
  "scenarioKind": "ancientCrypt" | "cyberpunkLab" | "overgrownJungle" | "volcanicAbyss" | "frostCitadel" | "sunkenTemple" | "desertPyramid" | "astralVoid",
  "dungeonStyle": {
    "wallStyle": "dampMasonry" | "obsidianBasalt" | "mossyRuins" | "gildedCrypt" | "crimsonCatacombs" | "cyberPanels" | "overgrownStone" | "glacialIce" | "sunkenCoral" | "sandstoneHieroglyphs" | "astralVoid",
    "floorStyle": "flagstone" | "checkerMarble" | "crackedSlate" | "emberBasalt" | "mossyCobble" | "cyberGrid" | "jungleEarth" | "frozenPermafrost" | "abyssalSand" | "desertSandstone" | "cosmicTiles",
    "propStyle": "cryptBarrels" | "arcaneBraziers" | "boneRelics" | "gildedUrns" | "cyberTerminals" | "jungleMonoliths" | "glacialCrystals" | "coralRelics" | "desertSarcophagi" | "astralPylons",
    "trapStyle": "laserTripwires" | "poisonDartPillars" | "fireGeysers" | "frostSpikes" | "acidPuddles" | "whirlpoolVortex" | "ironSpikes" | "emberPlates" | "cursedRunes" | "sawBlades",
    "wallTint": "#RRGGBB" (optional),
    "floorTint": "#RRGGBB" (optional),
    "propTint": "#RRGGBB" (optional),
    "trapTint": "#RRGGBB" (optional)
  },
  "roguelikeConfig": {
    "bossInterval": number (2..5, default 3),
    "difficultyScale": number (0.15..0.6, default 0.28),
    "trapDensity": number (0.5..2.5, default 1.2),
    "startingMaxHealth": number (4..12, default 6)
  },
  "atmosphere": {
    "sky": "night" | "cave" | "storm" | "mist" | "golden" | "sunny",
    "weather": "none" | "fireflies" | "leaves" | "rain" | "snow"
  },
  "traps": [ (2 to 8 placed hazards across dungeon rooms)
    {
      "name": string,
      "trapStyle": "laserTripwires" | "poisonDartPillars" | "fireGeysers" | "frostSpikes" | "acidPuddles" | "whirlpoolVortex" | "ironSpikes" | "emberPlates" | "cursedRunes" | "sawBlades",
      "x": number (-34..34),
      "z": number (-34..34),
      "tint": "#RRGGBB"
    }
  ],
  "enemies": [ (3 to 10 scenario-specific enemies)
    {
      "name": string,
      "brain": "Chaser" | "Flyer" | "Charger" | "Patroller",
      "health": number (2..12),
      "speed": number (2.2..4.8),
      "damage": number (1..2),
      "scale": number (0.8..1.5),
      "x": number (-34..34),
      "z": number (-34..34),
      "tint": "#RRGGBB"
    }
  ],
  "boss": {
    "name": string,
    "health": number (12..45),
    "speed": number (2.8..4.4),
    "scale": number (1.4..2.2),
    "x": number (-28..28),
    "z": number (-28..28),
    "dialogue": string,
    "tint": "#RRGGBB"
  },
  "treasures": [ (2 to 5 chests / relic urns)
    {
      "name": string,
      "x": number (-34..34),
      "z": number (-34..34),
      "loot": "Health" | "Coins"
    }
  ],
  "regenerateRooms": boolean
}`;
      }
      if (snapshot?.gameplayMode === 'rpg') {
        return `TARGET SCHEMA (Detailed Isometric RPG Director — Full-Sized Walk-In Enterable Buildings, River Gorge Slat Bridges, Living Medieval Villages, Jungle Ruins, Deep Wooded Forests, Recruited Companions, Sword/Arrow/Magic Combat & Fanned Loot Cards):
CRITICAL QUALITY-CONTROL RULES FOR ISOMETRIC RPG WORLDS:
1. FULL-SIZED WALK-IN ENTERABLE BUILDINGS (NEVER SMALL BOXES):
   - Every building ("tavern", "blacksmith", "cottage", "shrine", "temple", "scifiBuilding", "modernBuilding") is a large, full-sized walk-in structure (always set "scale" between 1.0 and 1.25, NEVER < 1.0!) where the player can walk to the front door, press E (Use) to swing the door open, and walk inside while the roof cuts away and the camera moves closer.
   - All walk-in buildings feature wooden/flagstone plank floors, glowing wall lanterns, paned windows, framed wall pictures/paintings, dining tables, and benches.
   - "tavern" includes a roaring stone fireplace, long bar counter with a bartender behind the bar, multiple tables with seated patrons holding mugs, and stairs leading to an upstairs inn loft with beds.
   - "blacksmith" includes a red-hot coal forge, iron anvil with glowing hot metal, and an animated blacksmith hammering the metal with flying sparks!
   - If the user asks for a modern or sci-fi building, use "modernBuilding" or "scifiBuilding" at full walk-in scale (>= 1.0).
2. REAL WATER RIVER GORGE & WALKABLE SLAT ROPE BRIDGE:
   - Whenever a "ropeBridge" is placed, place it at (x: 0, z: -14) with "rotationDeg": 0 and "scale": 1.0 so it spans directly across the deep water-filled river gorge carved between the South Village Plateau (z > -7) and the North Highlands (z < -21). Keep buildings on the South Plateau (z between -3 and +24) or North Highlands (z < -26), never inside the river channel (z between -20 and -8).
3. LIVING MEDIEVAL VILLAGE REALISM:
   - For any village scene, always include:
     * "tetheredHorses" right outside the tavern (e.g. x: -8.2, z: 18.8)
     * An enclosed chicken yard built from 4 to 6 "fence" props (distressed organic split-rail wood, never cube blocks) surrounding 3 to 4 wandering "chicken" props
     * "hangingLampPost" props lining both sides of the main village entrance road
     * "rakingVillager" raking leaves in a cottage yard
     * "roadVillager" friendly villagers strolling along the village road
4. BIOME-ACCURATE FLORA & ATMOSPHERE:
   - If the user asks for "jungleRuins" (or tropical/jungle): use "biome": "swamp", "sky": "mist" (or "golden"), "weather": "fireflies" (or "rain"), "fogDensity": 0.045, and populate ONLY "tropicalTree" (with hanging vines), "exoticPlant", "fern", "stonePillar", "ropeBridge", and "weatheredStonePath" — NEVER pine or oak trees on a sunny blue-sky island!
   - If the user asks for "deepWoodedForest": use "biome": "forest", "sky": "mist" or "night", "fogDensity": 0.055, and include "hollowMagicTree", "cottage", "hangingLampPost", "fern", and "weatheredStonePath".

{
  "summary": string,
  "scenarioKind": "medievalVillage" | "jungleRuins" | "deepWoodedForest" | "stoneTemple" | "coastalVillage" | "interiorCottage" | "interiorTavern" | "interiorCave",
  "pathStyle": "weatheredStone" | "ropeBridgeSlats" | "mossyCobble" | "woodPlankWalkway",
  "lootMode": "both" | "traditional" | "fannedCards",
  "isInterior": boolean,
  "atmosphere": {
    "biome": "forest" | "island" | "meadow" | "cave" | "swamp" | "night",
    "sky": "golden" | "sunny" | "night" | "mist" | "storm" | "cave",
    "weather": "none" | "fireflies" | "leaves" | "rain" | "snow",
    "fogDensity": number (0.015..0.08),
    "volumetricLanterns": boolean
  },
  "party": {
    "heroClass": "warrior" | "ranger" | "mage" | "paladin",
    "companions": [ (1 to 3 recruited allies fighting alongside hero: knight, mage, ranger, cleric)
      {
        "name": string,
        "class": "warrior" | "mage" | "ranger" | "cleric",
        "health": number (18..45),
        "weapon": "sword" | "staff" | "bow"
      }
    ]
  },
  "buildings": [ (1 to 6 FULL-SIZED walk-in enterable buildings: tavern with bartender/patrons/inn loft, blacksmith with hammering smith & flying sparks, cottage, shrine/temple, sci-fi command outpost, or modern lodge)
    {
      "name": string,
      "kind": "tavern" | "blacksmith" | "cottage" | "shrine" | "temple" | "scifiBuilding" | "modernBuilding" | "interiorCottage" | "interiorTavern" | "interiorCave",
      "x": number (-45..45),
      "z": number (-45..35),
      "rotationDeg": number (-180..180),
      "scale": number (1.0..1.25)
    }
  ],
  "propsAndFlora": [ (10 to 28 detailed organic props: distressed wood rail fences enclosing chickens, tethered tavern horses, hanging lamp posts on road, villager raking yard, strolling road villagers, village stone well, weathered stone paths, river-spanning rope bridge with broken slats, tropical trees with vines, exotic plants, hollow magic trees, volumetric lanterns, rune puzzles)
    {
      "name": string,
      "kind": "fence" | "well" | "chicken" | "tetheredHorses" | "hangingLampPost" | "rakingVillager" | "roadVillager" | "tropicalTree" | "exoticPlant" | "fern" | "hollowMagicTree" | "lantern" | "stonePillar" | "weatheredStonePath" | "ropeBridge" | "runePuzzle",
      "x": number (-55..55),
      "z": number (-55..55),
      "rotationDeg": number (-180..180),
      "scale": number (0.9..1.35)
    }
  ],
  "enemies": [ (2 to 10 RPG monsters or bandits with overhead evaporating health points & combat AI; include at least one "ogre" brute for brute-force throw attacks!)
    {
      "name": string,
      "archetype": "bandit" | "ogre" | "skeleton" | "goblin" | "darkMage",
      "health": number (14..55),
      "attackPower": number (2..8),
      "x": number (-55..55),
      "z": number (-55..55)
    }
  ],
  "lootsAndCards": [ (2 to 6 traditional treasure chests OR fanned-out reward card shrines for acquiring weapons, potions, herbs & skills)
    {
      "name": string,
      "kind": "chest" | "cardChoice",
      "rewardItem": "health_potion" | "healing_herb" | "mana_elixir" | "steel_sword" | "elven_bow" | "magic_scroll" | "gold_pouch",
      "x": number (-48..48),
      "z": number (-48..48)
    }
  ],
  "playerSpawn": [x (-50..50), z (-50..50)]
}`;
      }
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
