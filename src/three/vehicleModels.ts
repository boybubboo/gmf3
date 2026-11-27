import * as THREE from 'three';
import type {
  CarPresetId,
  DriverTypeId,
  DrivingCameraView,
  DrivingPhysicsId,
  VehicleCustomSpec,
  VehicleRoofStyle,
  VehicleWheelStyle,
  VehicleWingStyle,
} from '../types/maker';

export interface CarPresetDef {
  id: CarPresetId;
  name: string;
  blurb: string;
  colorHex: string;
  accentHex: string;
  wheelRadius: number;
  wheelBase: number;
  trackWidth: number;
  bodyClearance: number;
  speedScale: number;
  gripScale: number;
  defaultWheelStyle: VehicleWheelStyle;
  defaultRoofStyle: VehicleRoofStyle;
  isTwoWheeler?: boolean;
}

export interface DrivingPhysicsDef {
  id: DrivingPhysicsId;
  name: string;
  blurb: string;
  maxSpeed: number;
  accel: number;
  brakeAccel: number;
  reverseSpeed: number;
  turnSpeed: number;
  driftGrip: number;
  normalGrip: number;
  offroadGrip: number;
  boostPower: number;
  jumpMult: number;
  suspensionStiffness: number;
  bodyRollFactor: number;
}

export interface DriverTypeDef {
  id: DriverTypeId;
  name: string;
  blurb: string;
  topSpeedMult: number;
  boostRechargeMult: number;
  driftControlMult: number;
}

export const CAR_PRESETS: CarPresetDef[] = [
  {
    id: 'trailBuggy',
    name: 'Trail Buggy',
    blurb: 'Roll-cage dune & forest explorer with knobby suspension.',
    colorHex: '#FF7A2F',
    accentHex: '#FBBF24',
    wheelRadius: 0.44,
    wheelBase: 1.9,
    trackWidth: 1.56,
    bodyClearance: 0.46,
    speedScale: 1.0,
    gripScale: 1.0,
    defaultWheelStyle: 'offroadKnobby',
    defaultRoofStyle: 'rollCage',
  },
  {
    id: 'rallyCoupe',
    name: 'Rally Coupe',
    blurb: 'Wide-fender forest sprinter with rear wing & quad rally pods.',
    colorHex: '#2563EB',
    accentHex: '#F8FAFC',
    wheelRadius: 0.39,
    wheelBase: 1.98,
    trackWidth: 1.52,
    bodyClearance: 0.34,
    speedScale: 1.12,
    gripScale: 1.06,
    defaultWheelStyle: 'standard',
    defaultRoofStyle: 'standard',
  },
  {
    id: 'forestTruck',
    name: 'Ranger 4x4',
    blurb: 'Lifted timber-bed pickup built for mud, hills & riversides.',
    colorHex: '#20B46A',
    accentHex: '#D97706',
    wheelRadius: 0.5,
    wheelBase: 2.1,
    trackWidth: 1.66,
    bodyClearance: 0.56,
    speedScale: 0.92,
    gripScale: 1.18,
    defaultWheelStyle: 'offroadKnobby',
    defaultRoofStyle: 'standard',
  },
  {
    id: 'vintageRoadster',
    name: 'Woodland Roadster',
    blurb: 'Open-top brass & crimson tourer with swept fenders.',
    colorHex: '#E11D48',
    accentHex: '#FDE68A',
    wheelRadius: 0.4,
    wheelBase: 2.02,
    trackWidth: 1.48,
    bodyClearance: 0.36,
    speedScale: 1.06,
    gripScale: 0.94,
    defaultWheelStyle: 'standard',
    defaultRoofStyle: 'openTop',
  },
  {
    id: 'flintstones',
    name: 'Stone-Age Roller',
    blurb: 'Prehistoric log frame & carved granite rollers with dappled hide canopy.',
    colorHex: '#9A6338',
    accentHex: '#D97706',
    wheelRadius: 0.48,
    wheelBase: 1.96,
    trackWidth: 1.58,
    bodyClearance: 0.44,
    speedScale: 0.96,
    gripScale: 1.1,
    defaultWheelStyle: 'stoneRoller',
    defaultRoofStyle: 'standard',
  },
  {
    id: 'f1Racer',
    name: 'Apex F1 Racer',
    blurb: 'Razor-low open-wheel formula missile with front splitter, halo & GT wing.',
    colorHex: '#DC2626',
    accentHex: '#F8FAFC',
    wheelRadius: 0.38,
    wheelBase: 2.28,
    trackWidth: 1.68,
    bodyClearance: 0.24,
    speedScale: 1.24,
    gripScale: 1.16,
    defaultWheelStyle: 'slick',
    defaultRoofStyle: 'openTop',
  },
  {
    id: 'sportCoupe',
    name: 'Turbo GT Coupe',
    blurb: 'Sloped fastback supercar silhouette with frog-eye lamps & sunroof ready.',
    colorHex: '#18181B',
    accentHex: '#F59E0B',
    wheelRadius: 0.38,
    wheelBase: 2.04,
    trackWidth: 1.54,
    bodyClearance: 0.3,
    speedScale: 1.18,
    gripScale: 1.12,
    defaultWheelStyle: 'thickMag',
    defaultRoofStyle: 'sunroof',
  },
  {
    id: 'motorbike',
    name: 'Trail Motorbike',
    blurb: 'Agile leaning scrambler bike built for narrow ridges & high-arc jumps.',
    colorHex: '#0EA5E9',
    accentHex: '#FACC15',
    wheelRadius: 0.41,
    wheelBase: 1.78,
    trackWidth: 0.0,
    bodyClearance: 0.38,
    speedScale: 1.16,
    gripScale: 1.04,
    defaultWheelStyle: 'offroadKnobby',
    defaultRoofStyle: 'openTop',
    isTwoWheeler: true,
  },
];

export const DRIVING_PHYSICS_PRESETS: DrivingPhysicsDef[] = [
  {
    id: 'arcadeDrift',
    name: 'Arcade Drift',
    blurb: 'Playful tail slides around bends with snappy recovery.',
    maxSpeed: 23.5,
    accel: 24,
    brakeAccel: 32,
    reverseSpeed: 9,
    turnSpeed: 2.45,
    driftGrip: 2.3,
    normalGrip: 6.2,
    offroadGrip: 4.8,
    boostPower: 1.38,
    jumpMult: 1.08,
    suspensionStiffness: 0.72,
    bodyRollFactor: 1.25,
  },
  {
    id: 'grippyRally',
    name: 'Grippy Rally',
    blurb: 'Plant-and-go dirt traction with crisp turn-in bite.',
    maxSpeed: 25,
    accel: 27,
    brakeAccel: 38,
    reverseSpeed: 9.5,
    turnSpeed: 2.3,
    driftGrip: 4.1,
    normalGrip: 9.8,
    offroadGrip: 7.4,
    boostPower: 1.32,
    jumpMult: 1.0,
    suspensionStiffness: 0.92,
    bodyRollFactor: 0.82,
  },
  {
    id: 'offroadCrawler',
    name: 'Off-Road 4x4',
    blurb: 'High torque climbing steep ridges & grassy detours.',
    maxSpeed: 19.5,
    accel: 22,
    brakeAccel: 30,
    reverseSpeed: 8.5,
    turnSpeed: 2.1,
    driftGrip: 4.8,
    normalGrip: 10.6,
    offroadGrip: 9.8,
    boostPower: 1.24,
    jumpMult: 0.92,
    suspensionStiffness: 0.65,
    bodyRollFactor: 1.35,
  },
  {
    id: 'turboSport',
    name: 'Turbo Sport',
    blurb: 'Blistering top speed & massive boost bursts on straights.',
    maxSpeed: 29.5,
    accel: 30,
    brakeAccel: 42,
    reverseSpeed: 10.5,
    turnSpeed: 2.2,
    driftGrip: 2.7,
    normalGrip: 7.8,
    offroadGrip: 5.2,
    boostPower: 1.5,
    jumpMult: 1.18,
    suspensionStiffness: 1.0,
    bodyRollFactor: 0.65,
  },
];

export const DRIVER_TYPES: DriverTypeDef[] = [
  {
    id: 'stunt',
    name: 'Stunt Ace',
    blurb: 'Visor helmet driver with faster boost recharge.',
    topSpeedMult: 1.03,
    boostRechargeMult: 1.35,
    driftControlMult: 1.08,
  },
  {
    id: 'ranger',
    name: 'Forest Ranger',
    blurb: 'Steady outdoors trail driver with strong cornering grip.',
    topSpeedMult: 0.98,
    boostRechargeMult: 1.05,
    driftControlMult: 1.2,
  },
  {
    id: 'skunk',
    name: 'Pepper the Skunk',
    blurb: 'Striped forest daredevil with agile featherweight handling.',
    topSpeedMult: 1.05,
    boostRechargeMult: 1.15,
    driftControlMult: 1.12,
  },
  {
    id: 'bot',
    name: 'Mecha Pilot',
    blurb: 'Precision servo steering & calibrated boost stability.',
    topSpeedMult: 1.02,
    boostRechargeMult: 1.2,
    driftControlMult: 1.16,
  },
];

export interface DrivingCameraViewDef {
  id: DrivingCameraView;
  name: string;
  shortLabel: string;
  blurb: string;
}

export const DRIVING_CAMERA_VIEWS: DrivingCameraViewDef[] = [
  {
    id: 'driverPov',
    name: 'Driver POV',
    shortLabel: 'Driver',
    blurb: 'Cockpit view over the hood turning directly with the steering wheel.',
  },
  {
    id: 'closeChase',
    name: 'Just Behind',
    shortLabel: 'Behind',
    blurb: 'Tight behind-the-bumper rally chase camera locked to your car heading.',
  },
  {
    id: 'farChase',
    name: 'Further Away',
    shortLabel: 'Far',
    blurb: 'Wide forest chase camera showing upcoming corners, ramps, and trails.',
  },
];

export function getDrivingCameraView(view?: DrivingCameraView): DrivingCameraViewDef {
  return DRIVING_CAMERA_VIEWS.find((v) => v.id === view) ?? DRIVING_CAMERA_VIEWS[1];
}

export function getCarPreset(carId?: CarPresetId): CarPresetDef {
  return CAR_PRESETS.find((c) => c.id === carId) ?? CAR_PRESETS[0];
}

export function getDrivingPhysics(physicsId?: DrivingPhysicsId): DrivingPhysicsDef {
  return DRIVING_PHYSICS_PRESETS.find((p) => p.id === physicsId) ?? DRIVING_PHYSICS_PRESETS[0];
}

export function getDriverType(driverId?: DriverTypeId): DriverTypeDef {
  return DRIVER_TYPES.find((d) => d.id === driverId) ?? DRIVER_TYPES[0];
}

export interface CarRig {
  group: THREE.Group;
  chassisPivot: THREE.Group;
  wheelFL: THREE.Group;
  wheelFR: THREE.Group;
  wheelRL: THREE.Group;
  wheelRR: THREE.Group;
  tireFL: THREE.Group;
  tireFR: THREE.Group;
  tireRL: THREE.Group;
  tireRR: THREE.Group;
  wingLeft: THREE.Group;
  wingRight: THREE.Group;
  hasPermanentWings: boolean;
  isTwoWheeler: boolean;
  brakeLights: THREE.MeshStandardMaterial;
  exhaustPos: THREE.Object3D;
  driverEyeAnchor: THREE.Object3D;
  driverHead: THREE.Group;
  shadowDisc: THREE.Mesh;
}

function buildDriverOccupant(driverId: DriverTypeId): { root: THREE.Group; head: THREE.Group } {
  const root = new THREE.Group();
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1F2937', roughness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#F3C7A4', roughness: 0.62 });

  const jacketHex =
    driverId === 'stunt'
      ? '#EF4444'
      : driverId === 'ranger'
      ? '#2F855A'
      : driverId === 'bot'
      ? '#475569'
      : '#1B1B22';
  const jacketMat = new THREE.MeshStandardMaterial({
    color: jacketHex,
    roughness: driverId === 'bot' ? 0.3 : 0.6,
    metalness: driverId === 'bot' ? 0.65 : 0.08,
  });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.34, 10), jacketMat);
  torso.position.y = 0.18;
  torso.castShadow = true;
  root.add(torso);

  const head = new THREE.Group();
  head.position.set(0, 0.46, 0.02);

  if (driverId === 'skunk') {
    const blackFur = new THREE.MeshStandardMaterial({ color: '#1B1B22', roughness: 0.78 });
    const whiteFur = new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.72 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: '#F48FB1', roughness: 0.5 });
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), blackFur);
    cranium.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.24), whiteFur);
    stripe.position.set(0, 0.11, -0.02);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.14, 8), blackFur);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.02, 0.17);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), pinkMat);
    nose.position.set(0, -0.02, 0.24);
    const earGeo = new THREE.SphereGeometry(0.055, 8, 8);
    const earL = new THREE.Mesh(earGeo, blackFur);
    earL.position.set(-0.13, 0.15, -0.02);
    const earR = earL.clone();
    earR.position.x = 0.13;
    const goggleStrap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.185, 0.185, 0.05, 12),
      new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.4 })
    );
    goggleStrap.position.y = 0.04;
    head.add(cranium, stripe, snout, nose, earL, earR, goggleStrap);
  } else if (driverId === 'stunt') {
    const helmetMat = new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.22, metalness: 0.25 });
    const visorMat = new THREE.MeshStandardMaterial({
      color: '#F59E0B',
      emissive: '#B45309',
      emissiveIntensity: 0.25,
      roughness: 0.18,
      metalness: 0.6,
    });
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), helmetMat);
    helm.castShadow = true;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.2, 0.32),
      new THREE.MeshStandardMaterial({ color: '#EF4444', roughness: 0.35 })
    );
    stripe.position.y = 0.1;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.08), visorMat);
    visor.position.set(0, 0.01, 0.16);
    head.add(helm, stripe, visor);
  } else if (driverId === 'ranger') {
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 12), skinMat);
    cranium.castShadow = true;
    const hatMat = new THREE.MeshStandardMaterial({ color: '#854D0E', roughness: 0.75 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.035, 12), hatMat);
    brim.position.y = 0.13;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.15, 10), hatMat);
    crown.position.y = 0.21;
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.05), darkMat);
    shades.position.set(0, 0.02, 0.16);
    head.add(cranium, brim, crown, shades);
  } else {
    const steelMat = new THREE.MeshStandardMaterial({ color: '#CBD5E1', roughness: 0.25, metalness: 0.82 });
    const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.28), steelMat);
    cranium.castShadow = true;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.08, 0.04),
      new THREE.MeshStandardMaterial({ color: '#38BDF8', emissive: '#38BDF8', emissiveIntensity: 1.0 })
    );
    visor.position.set(0, 0.02, 0.145);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.16, 6), steelMat);
    antenna.position.set(0.11, 0.2, -0.04);
    head.add(cranium, visor, antenna);
  }

  root.add(head);
  return { root, head };
}

function createWheelUnit(
  radius: number,
  width: number,
  wheelStyle: VehicleWheelStyle,
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  frameMat: THREE.Material,
  stoneMat: THREE.Material,
  woodMat: THREE.Material
): { steerPivot: THREE.Group; tireSpin: THREE.Group } {
  const steerPivot = new THREE.Group();
  const tireSpin = new THREE.Group();

  if (wheelStyle === 'stoneRoller') {
    const rollerW = Math.max(width * 1.45, 0.52);
    const stoneDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.96, radius * 1.02, rollerW, 12),
      stoneMat
    );
    stoneDrum.rotation.z = Math.PI / 2;
    stoneDrum.castShadow = true;
    const axleEnd = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, rollerW + 0.1, 8),
      woodMat
    );
    axleEnd.rotation.z = Math.PI / 2;
    const chiselBand = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.99, radius * 0.99, rollerW * 0.22, 10),
      frameMat
    );
    chiselBand.rotation.z = Math.PI / 2;
    tireSpin.add(stoneDrum, axleEnd, chiselBand);
  } else if (wheelStyle === 'thickMag') {
    const magWidth = Math.max(width * 1.38, 0.42);
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, magWidth, 18),
      tireMat
    );
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;

    // Deep-dish machined mag barrel + bold 5-spoke alloy star
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, magWidth + 0.025, 16),
      rimMat
    );
    barrel.rotation.z = Math.PI / 2;
    const dishInner = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.52, radius * 0.52, magWidth + 0.035, 16),
      frameMat
    );
    dishInner.rotation.z = Math.PI / 2;
    tireSpin.add(tire, barrel, dishInner);

    for (let s = 0; s < 5; s++) {
      const a = (s / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(magWidth + 0.055, radius * 0.56, 0.078),
        rimMat
      );
      spoke.rotation.x = a;
      spoke.position.set(0, Math.cos(a) * radius * 0.24, Math.sin(a) * radius * 0.24);
      tireSpin.add(spoke);
    }
    const centerCap = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, magWidth + 0.08, 10),
      rimMat
    );
    centerCap.rotation.z = Math.PI / 2;
    tireSpin.add(centerCap);
  } else if (wheelStyle === 'offroadKnobby') {
    const kWidth = Math.max(width * 1.15, 0.34);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, kWidth, 14), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.54, radius * 0.54, kWidth + 0.02, 10),
      rimMat
    );
    rim.rotation.z = Math.PI / 2;
    tireSpin.add(tire, rim);
    for (let t = 0; t < 8; t++) {
      const a = (t / 8) * Math.PI * 2;
      const lug = new THREE.Mesh(new THREE.BoxGeometry(kWidth * 0.9, 0.065, 0.09), tireMat);
      lug.position.set(0, Math.cos(a) * (radius + 0.01), Math.sin(a) * (radius + 0.01));
      lug.rotation.x = -a;
      tireSpin.add(lug);
    }
  } else if (wheelStyle === 'slick') {
    const sWidth = Math.max(width * 1.32, 0.4);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, sWidth, 20), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, sWidth + 0.025, 16),
      rimMat
    );
    rim.rotation.z = Math.PI / 2;
    const nut = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, sWidth + 0.06, 6),
      new THREE.MeshStandardMaterial({ color: '#EF4444', roughness: 0.25, metalness: 0.8 })
    );
    nut.rotation.z = Math.PI / 2;
    tireSpin.add(tire, rim, nut);
  } else {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 10),
      rimMat
    );
    hub.rotation.z = Math.PI / 2;
    const lug = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, radius * 0.82, 0.08), frameMat);
    const lug2 = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.08, radius * 0.82), frameMat);
    tireSpin.add(tire, hub, lug, lug2);
  }

  steerPivot.add(tireSpin);
  return { steerPivot, tireSpin };
}

function buildAeroWingAssembly(
  side: -1 | 1,
  wingStyle: VehicleWingStyle,
  primaryMat: THREE.Material,
  accentMat: THREE.Material
): THREE.Group {
  const pivot = new THREE.Group();
  const isJet = wingStyle === 'jetWing';
  const isFins = wingStyle === 'aeroFins';
  const span = isFins ? 1.05 : isJet ? 1.95 : 2.15;
  const chord = isFins ? 0.58 : 0.72;

  const wingGeo = new THREE.BoxGeometry(span, 0.065, chord);
  const wing = new THREE.Mesh(wingGeo, primaryMat);
  wing.position.set(side * (span * 0.5 + 0.16), 0.03, 0);
  wing.rotation.y = side * (isJet ? -0.28 : -0.14);
  wing.rotation.z = side * 0.07;
  wing.castShadow = true;

  const leadEdge = new THREE.Mesh(new THREE.BoxGeometry(span * 0.96, 0.075, 0.14), accentMat);
  leadEdge.position.set(side * (span * 0.5 + 0.16), 0.035, chord * 0.42);
  leadEdge.rotation.y = wing.rotation.y;
  leadEdge.rotation.z = wing.rotation.z;

  const glowMat = new THREE.MeshStandardMaterial({
    color: '#38BDF8',
    emissive: '#0EA5E9',
    emissiveIntensity: 1.3,
    roughness: 0.2,
  });
  const tipFin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, chord * 0.85), glowMat);
  tipFin.position.set(side * (span + 0.14), 0.14, -0.08);

  pivot.add(wing, leadEdge, tipFin);

  if (isJet) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.75, 10), accentMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * (span * 0.42 + 0.18), -0.05, -0.08);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.16, 10), glowMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(side * (span * 0.42 + 0.18), -0.05, -0.46);
    pivot.add(pod, nozzle);
  }

  return pivot;
}

export function buildCarModel(
  carId: CarPresetId = 'trailBuggy',
  driverId: DriverTypeId = 'stunt',
  customOrHex?: string | VehicleCustomSpec
): CarRig {
  const customSpec: VehicleCustomSpec =
    typeof customOrHex === 'string'
      ? { bodyColor: customOrHex }
      : customOrHex ?? {};
  const preset = getCarPreset(carId);
  const group = new THREE.Group();

  const wheelScale = THREE.MathUtils.clamp(customSpec.wheelScale ?? 1.0, 0.75, 1.48);
  const wheelRadius = preset.wheelRadius * wheelScale;
  const wheelLift = Math.max(0, wheelRadius - preset.wheelRadius);
  const wheelStyle: VehicleWheelStyle = customSpec.wheelStyle ?? preset.defaultWheelStyle;
  const roofStyle: VehicleRoofStyle = customSpec.roofStyle ?? preset.defaultRoofStyle;
  const wingStyle: VehicleWingStyle = customSpec.wingStyle ?? 'none';

  const shadowDisc = new THREE.Mesh(
    new THREE.PlaneGeometry((preset.trackWidth || 0.85) + 0.75, preset.wheelBase + 1.45),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.26, depthWrite: false })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  group.add(shadowDisc);

  const chassisPivot = new THREE.Group();
  chassisPivot.position.y = preset.bodyClearance + wheelLift;
  group.add(chassisPivot);

  const primaryHex = customSpec.bodyColor || preset.colorHex;
  const accentHex = customSpec.accentColor || preset.accentHex;
  const rimHex =
    customSpec.rimColor ||
    (wheelStyle === 'thickMag'
      ? '#E2E8F0'
      : carId === 'vintageRoadster'
      ? '#FDE68A'
      : '#CBD5E1');

  const paintMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    roughness: carId === 'flintstones' ? 0.86 : 0.24,
    metalness: carId === 'flintstones' ? 0.05 : 0.38,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.34,
    metalness: 0.42,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#1E2430', roughness: 0.55, metalness: 0.4 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.18, metalness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8B5A2B', roughness: 0.86 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#78716C', roughness: 0.92, flatShading: true });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#7DD3FC',
    roughness: 0.1,
    metalness: 0.25,
    transparent: true,
    opacity: 0.58,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: '#FEF3C7',
    emissive: '#FDE68A',
    emissiveIntensity: 1.4,
    roughness: 0.15,
  });
  const brakeLights = new THREE.MeshStandardMaterial({
    color: '#DC2626',
    emissive: '#EF4444',
    emissiveIntensity: 0.45,
    roughness: 0.25,
  });

  const tireMat = new THREE.MeshStandardMaterial({ color: '#17191E', roughness: 0.88 });
  const rimMat = new THREE.MeshStandardMaterial({
    color: rimHex,
    roughness: wheelStyle === 'thickMag' ? 0.18 : 0.3,
    metalness: wheelStyle === 'thickMag' ? 0.92 : 0.78,
  });

  const hx = preset.trackWidth * 0.5;
  const hz = preset.wheelBase * 0.5;
  const wideRear = carId === 'trailBuggy' || carId === 'forestTruck' || carId === 'f1Racer';

  let fl: { steerPivot: THREE.Group; tireSpin: THREE.Group };
  let fr: { steerPivot: THREE.Group; tireSpin: THREE.Group };
  let rl: { steerPivot: THREE.Group; tireSpin: THREE.Group };
  let rr: { steerPivot: THREE.Group; tireSpin: THREE.Group };

  if (preset.isTwoWheeler) {
    fl = createWheelUnit(wheelRadius, 0.22, wheelStyle, tireMat, rimMat, frameMat, stoneMat, woodMat);
    fl.steerPivot.position.set(0, wheelRadius, hz);
    rl = createWheelUnit(wheelRadius * 1.05, 0.26, wheelStyle, tireMat, rimMat, frameMat, stoneMat, woodMat);
    rl.steerPivot.position.set(0, wheelRadius * 1.05, -hz);
    group.add(fl.steerPivot, rl.steerPivot);
    fr = { steerPivot: new THREE.Group(), tireSpin: new THREE.Group() };
    rr = { steerPivot: new THREE.Group(), tireSpin: new THREE.Group() };
  } else {
    fl = createWheelUnit(wheelRadius, 0.28, wheelStyle, tireMat, rimMat, frameMat, stoneMat, woodMat);
    fl.steerPivot.position.set(-hx, wheelRadius, hz);
    fr = createWheelUnit(wheelRadius, 0.28, wheelStyle, tireMat, rimMat, frameMat, stoneMat, woodMat);
    fr.steerPivot.position.set(hx, wheelRadius, hz);
    rl = createWheelUnit(wheelRadius, wideRear ? 0.36 : 0.28, wheelStyle, tireMat, rimMat, frameMat, stoneMat, woodMat);
    rl.steerPivot.position.set(-hx, wheelRadius, -hz);
    rr = createWheelUnit(wheelRadius, wideRear ? 0.36 : 0.28, wheelStyle, tireMat, rimMat, frameMat, stoneMat, woodMat);
    rr.steerPivot.position.set(hx, wheelRadius, -hz);
    group.add(fl.steerPivot, fr.steerPivot, rl.steerPivot, rr.steerPivot);
  }

  const exhaustPos = new THREE.Object3D();
  exhaustPos.position.set(preset.isTwoWheeler ? 0.2 : -0.34, 0.08, -1.45);
  chassisPivot.add(exhaustPos);

  const driverEyeAnchor = new THREE.Object3D();
  if (carId === 'trailBuggy') {
    driverEyeAnchor.position.set(0, 0.84, 0.14);
  } else if (carId === 'rallyCoupe' || carId === 'sportCoupe') {
    driverEyeAnchor.position.set(-0.14, 0.82, 0.62);
  } else if (carId === 'forestTruck') {
    driverEyeAnchor.position.set(-0.24, 0.96, 1.02);
  } else if (carId === 'f1Racer') {
    driverEyeAnchor.position.set(0, 0.72, 0.18);
  } else if (carId === 'motorbike') {
    driverEyeAnchor.position.set(0, 0.95, 0.16);
  } else if (carId === 'flintstones') {
    driverEyeAnchor.position.set(0, 0.88, 0.2);
  } else {
    driverEyeAnchor.position.set(-0.18, 0.78, 0.06);
  }
  chassisPivot.add(driverEyeAnchor);

  const driver = buildDriverOccupant(driverId);

  if (carId === 'flintstones') {
    // Prehistoric twin-log chassis, carved boulder axles, stone seats, log pillars, dappled animal-hide canopy
    for (const lx of [-0.48, 0.48]) {
      const sideLog = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.125, 2.75, 8), woodMat);
      sideLog.rotation.x = Math.PI / 2;
      sideLog.position.set(lx, 0.18, 0);
      sideLog.castShadow = true;
      chassisPivot.add(sideLog);
    }
    const frontAxleBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.55, 8), woodMat);
    frontAxleBeam.rotation.z = Math.PI / 2;
    frontAxleBeam.position.set(0, 0.14, 0.98);
    const rearAxleBeam = frontAxleBeam.clone();
    rearAxleBeam.position.z = -0.98;
    const plankDeck = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.1, 1.55), paintMat);
    plankDeck.position.set(0, 0.18, -0.05);
    plankDeck.castShadow = true;
    const stoneBench = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.24, 0.56), stoneMat);
    stoneBench.position.set(0, 0.34, -0.32);
    stoneBench.castShadow = true;
    const boneSteering = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 10), new THREE.MeshStandardMaterial({ color: '#F5E8C8', roughness: 0.75 }));
    boneSteering.position.set(0, 0.56, 0.35);
    boneSteering.rotation.x = -0.5;
    for (const [px, pz] of [
      [-0.45, 0.56],
      [0.45, 0.56],
      [-0.45, -0.68],
      [0.45, -0.68],
    ]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 1.05, 7), woodMat);
      pole.position.set(px, 0.72, pz);
      pole.castShadow = true;
      chassisPivot.add(pole);
    }
    if (roofStyle !== 'openTop') {
      const canopyMat = new THREE.MeshStandardMaterial({ color: accentHex || '#EA580C', roughness: 0.9 });
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.12, 1.52), canopyMat);
      canopy.position.set(0, 1.24, -0.06);
      canopy.castShadow = true;
      chassisPivot.add(canopy);
      // Spots on hide canopy
      for (const [sx, sz] of [[-0.28, 0.2], [0.24, -0.18], [-0.1, -0.4]]) {
        const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.135, 8), frameMat);
        spot.position.set(sx, 1.24, sz);
        chassisPivot.add(spot);
      }
      if (roofStyle === 'sunroof') {
        const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.145, 0.56), glassMat);
        hatch.position.set(0, 1.24, 0.06);
        chassisPivot.add(hatch);
      }
    }
    driver.root.position.set(0, 0.25, -0.26);
    chassisPivot.add(frontAxleBeam, rearAxleBeam, plankDeck, stoneBench, boneSteering, driver.root);
  } else if (carId === 'f1Racer') {
    // Sleek F1 monocoque + tapered nosecone + front wing + sidepods + cockpit halo + rear F1 wing
    const monocoque = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.3, 2.35), paintMat);
    monocoque.position.set(0, 0.2, -0.08);
    monocoque.castShadow = true;
    const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.15, 8), paintMat);
    noseCone.rotation.x = Math.PI / 2;
    noseCone.scale.set(1.0, 0.52, 1.0);
    noseCone.position.set(0, 0.16, 1.48);
    noseCone.castShadow = true;
    const frontWing = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.055, 0.36), trimMat);
    frontWing.position.set(0, 0.09, 1.88);
    frontWing.castShadow = true;
    for (const sx of [-0.52, 0.52]) {
      const sidepod = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 1.28), paintMat);
      sidepod.position.set(sx, 0.18, -0.18);
      sidepod.castShadow = true;
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), frameMat);
      intake.position.set(sx, 0.19, 0.46);
      chassisPivot.add(sidepod, intake);
    }
    const engineCover = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.36, 0.96), paintMat);
    engineCover.position.set(0, 0.42, -0.76);
    engineCover.castShadow = true;
    const airbox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.34), frameMat);
    airbox.position.set(0, 0.58, -0.34);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.032, 6, 12, Math.PI), frameMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 0.46, 0.14);
    const rearPylonL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.22), frameMat);
    rearPylonL.position.set(-0.28, 0.44, -1.42);
    const rearPylonR = rearPylonL.clone();
    rearPylonR.position.x = 0.28;
    const rearWing = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.07, 0.42), trimMat);
    rearWing.position.set(0, 0.68, -1.46);
    rearWing.castShadow = true;
    const blCenter = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), brakeLights);
    blCenter.position.set(0, 0.24, -1.48);

    driver.root.position.set(0, 0.16, 0.02);
    chassisPivot.add(monocoque, noseCone, frontWing, engineCover, airbox, halo, rearPylonL, rearPylonR, rearWing, blCenter, driver.root);
  } else if (carId === 'sportCoupe') {
    // Porsche-inspired sleek sloped fastback + twin frog-eye lamps + sculpted sunroof option + ducktail wing
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.36, 2.86), paintMat);
    body.position.set(0, 0.2, 0);
    body.castShadow = true;
    const slopedNose = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.2, 0.92), paintMat);
    slopedNose.position.set(0, 0.32, 0.92);
    slopedNose.rotation.x = 0.18;
    slopedNose.castShadow = true;
    const cabinLower = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.34, 1.38), paintMat);
    cabinLower.position.set(0, 0.5, -0.14);
    cabinLower.castShadow = true;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.28, 1.32), glassMat);
    windshield.position.set(0, 0.52, -0.06);

    if (roofStyle === 'sunroof') {
      // Dark panoramic sunroof glass set in painted frame
      const roofRim = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.08, 0.98), paintMat);
      roofRim.position.set(0, 0.68, -0.16);
      const sunGlass = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.1, 0.68),
        new THREE.MeshStandardMaterial({
          color: '#0F172A',
          roughness: 0.08,
          metalness: 0.55,
          transparent: true,
          opacity: 0.72,
        })
      );
      sunGlass.position.set(0, 0.695, -0.14);
      const sunFrame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.09, 0.74), chromeMat);
      sunFrame.position.set(0, 0.685, -0.14);
      chassisPivot.add(roofRim, sunFrame, sunGlass);
    } else if (roofStyle !== 'openTop') {
      const solidRoof = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.08, 0.98), paintMat);
      solidRoof.position.set(0, 0.68, -0.16);
      chassisPivot.add(solidRoof);
    }

    // Twin raised Porsche-style round headlights on front fenders
    for (const lx of [-0.52, 0.52]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.42, 12), paintMat);
      pod.rotation.x = Math.PI / 2 - 0.18;
      pod.position.set(lx, 0.37, 1.18);
      pod.castShadow = true;
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), headlightMat);
      lens.position.set(lx, 0.39, 1.38);
      chassisPivot.add(pod, lens);
    }
    const accentStripe = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.06, 2.3), trimMat);
    accentStripe.position.set(0, 0.12, 0);
    const ducktail = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.14, 0.24), paintMat);
    ducktail.position.set(0, 0.46, -1.32);
    ducktail.rotation.x = 0.28;
    const blBar = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.08, 0.06), brakeLights);
    blBar.position.set(0, 0.32, -1.44);

    driver.root.position.set(-0.2, 0.22, -0.08);
    chassisPivot.add(body, slopedNose, cabinLower, windshield, accentStripe, ducktail, blBar, driver.root);
  } else if (carId === 'motorbike') {
    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.62), frameMat);
    engineBlock.position.set(0, 0.16, 0);
    engineBlock.castShadow = true;
    const frameSpine = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 1.35), trimMat);
    frameSpine.position.set(0, 0.34, 0.02);
    const fuelTank = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), paintMat);
    fuelTank.scale.set(0.85, 0.72, 1.35);
    fuelTank.position.set(0, 0.48, 0.34);
    fuelTank.castShadow = true;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.62), frameMat);
    seat.position.set(0, 0.42, -0.28);
    const forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.84, 8), chromeMat);
    forkL.position.set(-0.14, 0.32, 0.74);
    forkL.rotation.x = -0.35;
    const forkR = forkL.clone();
    forkR.position.x = 0.14;
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.74, 8), chromeMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 0.68, 0.58);
    const frontFender = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.56), paintMat);
    frontFender.position.set(0, 0.34, 0.88);
    const headlight = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.12, 10), headlightMat);
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(0, 0.56, 0.76);
    const tailLamp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.08), brakeLights);
    tailLamp.position.set(0, 0.42, -0.96);

    driver.root.position.set(0, 0.42, -0.2);
    chassisPivot.add(engineBlock, frameSpine, fuelTank, seat, forkL, forkR, handlebar, frontFender, headlight, tailLamp, driver.root);
  } else if (carId === 'trailBuggy') {
    const pan = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.24, 2.45), paintMat);
    pan.position.y = 0.14;
    pan.castShadow = true;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.85), paintMat);
    nose.position.set(0, 0.22, 1.05);
    nose.rotation.x = 0.18;
    nose.castShadow = true;
    const bullbar = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 6, 10, Math.PI), frameMat);
    bullbar.position.set(0, 0.18, 1.44);
    bullbar.rotation.z = Math.PI;
    const makeBar = (x: number, y: number, z: number, h: number, rx = 0, rz = 0) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, h, 8), frameMat);
      m.position.set(x, y, z);
      m.rotation.set(rx, 0, rz);
      m.castShadow = true;
      chassisPivot.add(m);
    };
    makeBar(-0.46, 0.64, 0.45, 0.84, -0.32, 0);
    makeBar(0.46, 0.64, 0.45, 0.84, -0.32, 0);
    makeBar(-0.46, 0.64, -0.52, 0.82, 0.22, 0);
    makeBar(0.46, 0.64, -0.52, 0.82, 0.22, 0);
    const roofPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.06, 0.78),
      roofStyle === 'sunroof' ? glassMat : trimMat
    );
    roofPlate.position.set(0, 1.0, -0.06);
    roofPlate.castShadow = true;
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.2, 12), tireMat);
    spare.rotation.x = Math.PI / 2 + 0.35;
    spare.position.set(0, 0.5, -1.16);
    spare.castShadow = true;
    const hlL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10), headlightMat);
    hlL.rotation.x = Math.PI / 2;
    hlL.position.set(-0.34, 0.32, 1.38);
    const hlR = hlL.clone();
    hlR.position.x = 0.34;
    const blL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.06), brakeLights);
    blL.position.set(-0.36, 0.24, -1.24);
    const blR = blL.clone();
    blR.position.x = 0.36;

    driver.root.position.set(0, 0.2, -0.05);
    chassisPivot.add(pan, nose, bullbar, roofPlate, spare, hlL, hlR, blL, blR, driver.root);
  } else if (carId === 'rallyCoupe') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.42, 2.86), paintMat);
    body.position.y = 0.22;
    body.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.435, 2.88), trimMat);
    stripe.position.y = 0.22;
    if (roofStyle !== 'openTop') {
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.42, 1.35), paintMat);
      cabin.position.set(0, 0.6, -0.1);
      cabin.castShadow = true;
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.34, 1.38), glassMat);
      windshield.position.set(0, 0.58, -0.08);
      chassisPivot.add(cabin, windshield);
      if (roofStyle === 'sunroof') {
        const sunGlass = new THREE.Mesh(
          new THREE.BoxGeometry(0.76, 0.08, 0.66),
          new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.1, metalness: 0.6 })
        );
        sunGlass.position.set(0, 0.81, -0.1);
        chassisPivot.add(sunGlass);
      }
    } else {
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.28, 0.08), glassMat);
      windshield.position.set(0, 0.52, 0.54);
      windshield.rotation.x = -0.35;
      chassisPivot.add(windshield);
    }
    const wingPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.18), frameMat);
    wingPillarL.position.set(-0.42, 0.52, -1.25);
    const wingPillarR = wingPillarL.clone();
    wingPillarR.position.x = 0.42;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.07, 0.34), frameMat);
    wing.position.set(0, 0.66, -1.28);
    wing.castShadow = true;
    for (const lx of [-0.28, -0.09, 0.09, 0.28]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 10), headlightMat);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(lx, 0.48, 1.15);
      chassisPivot.add(pod);
    }
    const blL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.05), brakeLights);
    blL.position.set(-0.42, 0.3, -1.44);
    const blR = blL.clone();
    blR.position.x = 0.42;

    driver.root.position.set(-0.18, 0.28, -0.02);
    chassisPivot.add(body, stripe, wingPillarL, wingPillarR, wing, blL, blR, driver.root);
  } else if (carId === 'forestTruck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.68, 1.25), paintMat);
    cab.position.set(0, 0.52, 0.35);
    cab.castShadow = true;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.42, 0.85), paintMat);
    hood.position.set(0, 0.38, 1.15);
    hood.castShadow = true;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.34, 1.28), glassMat);
    glass.position.set(0, 0.66, 0.36);
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.28, 1.22), paintMat);
    bedFloor.position.set(0, 0.32, -0.88);
    bedFloor.castShadow = true;
    const cargoCrate = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.38, 0.68), woodMat);
    cargoCrate.position.set(0.1, 0.56, -0.9);
    cargoCrate.rotation.y = 0.15;
    cargoCrate.castShadow = true;
    const rollBar = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 8, 12, Math.PI), frameMat);
    rollBar.position.set(0, 0.48, -0.36);
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: '#F59E0B', emissive: '#F59E0B', emissiveIntensity: 0.9 })
    );
    beacon.position.set(0, 0.92, 0.35);
    if (roofStyle === 'sunroof') {
      const sunGlass = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.68), glassMat);
      sunGlass.position.set(0, 0.87, 0.35);
      chassisPivot.add(sunGlass);
    }
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.28, 0.08), chromeMat);
    grille.position.set(0, 0.36, 1.58);
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.06), headlightMat);
    hlL.position.set(-0.56, 0.42, 1.58);
    const hlR = hlL.clone();
    hlR.position.x = 0.56;
    const blL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.06), brakeLights);
    blL.position.set(-0.56, 0.36, -1.49);
    const blR = blL.clone();
    blR.position.x = 0.56;

    driver.root.position.set(-0.24, 0.34, 0.32);
    chassisPivot.add(cab, hood, glass, bedFloor, cargoCrate, rollBar, beacon, grille, hlL, hlR, blL, blR, driver.root);
  } else {
    // vintageRoadster
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.38, 2.95), paintMat);
    hull.position.y = 0.24;
    hull.castShadow = true;
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, 1.15, 12), paintMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.28, 0.95);
    nose.castShadow = true;
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.46, 0.1), chromeMat);
    grille.position.set(0, 0.3, 1.52);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.3, 0.06), glassMat);
    windshield.position.set(0, 0.54, 0.35);
    windshield.rotation.x = -0.24;
    const fenderGeo = new THREE.BoxGeometry(0.26, 0.14, 0.92);
    for (const [fx, fz] of [
      [-0.68, 0.95],
      [0.68, 0.95],
      [-0.68, -0.95],
      [0.68, -0.95],
    ]) {
      const f = new THREE.Mesh(fenderGeo, trimMat);
      f.position.set(fx, 0.28, fz);
      f.castShadow = true;
      chassisPivot.add(f);
    }
    if (roofStyle === 'sunroof' || roofStyle === 'standard') {
      const softTop = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 0.08, 1.02),
        roofStyle === 'sunroof' ? glassMat : trimMat
      );
      softTop.position.set(0, 0.88, -0.15);
      chassisPivot.add(softTop);
    }
    const hlL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), headlightMat);
    hlL.position.set(-0.46, 0.4, 1.46);
    const hlR = hlL.clone();
    hlR.position.x = 0.46;
    const blL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), brakeLights);
    blL.position.set(-0.4, 0.34, -1.48);
    const blR = blL.clone();
    blR.position.x = 0.4;

    driver.root.position.set(-0.18, 0.24, -0.18);
    chassisPivot.add(hull, nose, grille, windshield, hlL, hlR, blL, blR, driver.root);
  }

  // Modular optional addons (roll cage, spoiler, bullbar, twin exhausts)
  if (roofStyle === 'rollCage' && carId !== 'trailBuggy' && !preset.isTwoWheeler) {
    for (const cx of [-0.46, 0.46]) {
      const hoop = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.72, 8), frameMat);
      hoop.position.set(cx, 0.62, -0.35);
      chassisPivot.add(hoop);
    }
    const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.96, 8), frameMat);
    crossBar.rotation.z = Math.PI / 2;
    crossBar.position.set(0, 0.96, -0.35);
    chassisPivot.add(crossBar);
  }

  if (customSpec.hasSpoiler && carId !== 'rallyCoupe' && carId !== 'f1Racer' && !preset.isTwoWheeler) {
    const pL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.16), frameMat);
    pL.position.set(-0.44, 0.48, -1.25);
    const pR = pL.clone();
    pR.position.x = 0.44;
    const sWing = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.065, 0.32), trimMat);
    sWing.position.set(0, 0.62, -1.28);
    sWing.castShadow = true;
    chassisPivot.add(pL, pR, sWing);
  }

  if (customSpec.hasBullbar && !preset.isTwoWheeler) {
    const bar = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 6, 12, Math.PI), chromeMat);
    bar.position.set(0, 0.22, preset.wheelBase * 0.68);
    bar.rotation.z = Math.PI;
    chassisPivot.add(bar);
  }

  if (customSpec.hasTwinExhaust && !preset.isTwoWheeler) {
    for (const ex of [-0.28, 0.28]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.36, 8), chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(ex, 0.12, -preset.wheelBase * 0.68);
      chassisPivot.add(pipe);
    }
  }

  // Deployable / Permanent Aero Flight Wings (shown whenever equipped OR during Flight Bonus Cube activation!)
  const resolvedWingStyle: VehicleWingStyle = wingStyle !== 'none' ? wingStyle : 'gliderWings';
  const wingLeft = buildAeroWingAssembly(-1, resolvedWingStyle, paintMat, trimMat);
  const wingRight = buildAeroWingAssembly(1, resolvedWingStyle, paintMat, trimMat);
  wingLeft.position.set(-0.35, 0.34, -0.08);
  wingRight.position.set(0.35, 0.34, -0.08);
  const hasPermanentWings = wingStyle !== 'none';
  wingLeft.visible = hasPermanentWings;
  wingRight.visible = hasPermanentWings;
  chassisPivot.add(wingLeft, wingRight);

  return {
    group,
    chassisPivot,
    wheelFL: fl.steerPivot,
    wheelFR: fr.steerPivot,
    wheelRL: rl.steerPivot,
    wheelRR: rr.steerPivot,
    tireFL: fl.tireSpin,
    tireFR: fr.tireSpin,
    tireRL: rl.tireSpin,
    tireRR: rr.tireSpin,
    wingLeft,
    wingRight,
    hasPermanentWings,
    isTwoWheeler: Boolean(preset.isTwoWheeler),
    brakeLights,
    exhaustPos,
    driverEyeAnchor,
    driverHead: driver.head,
    shadowDisc,
  };
}
