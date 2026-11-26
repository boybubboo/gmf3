import * as THREE from 'three';
import type { CarPresetId, DriverTypeId, DrivingCameraView, DrivingPhysicsId } from '../types/maker';

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

export function buildCarModel(
  carId: CarPresetId = 'trailBuggy',
  driverId: DriverTypeId = 'stunt',
  accentColorOverride?: string
): CarRig {
  const preset = getCarPreset(carId);
  const group = new THREE.Group();

  const shadowDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(preset.trackWidth + 0.75, preset.wheelBase + 1.45),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.26, depthWrite: false })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  group.add(shadowDisc);

  const chassisPivot = new THREE.Group();
  chassisPivot.position.y = preset.bodyClearance;
  group.add(chassisPivot);

  const primaryHex = accentColorOverride || preset.colorHex;
  const paintMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    roughness: 0.28,
    metalness: 0.32,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: preset.accentHex,
    roughness: 0.35,
    metalness: 0.45,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#1E2430', roughness: 0.55, metalness: 0.4 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.2, metalness: 0.88 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#7DD3FC',
    roughness: 0.12,
    metalness: 0.2,
    transparent: true,
    opacity: 0.55,
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

  // Wheel helper (steering pivot holds rolling tire group)
  const tireMat = new THREE.MeshStandardMaterial({ color: '#17191E', roughness: 0.88 });
  const rimMat = new THREE.MeshStandardMaterial({
    color: carId === 'vintageRoadster' ? '#FDE68A' : '#CBD5E1',
    roughness: 0.3,
    metalness: 0.78,
  });

  const makeWheel = (x: number, z: number, wide = false) => {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(x, preset.wheelRadius, z);
    const tireSpin = new THREE.Group();
    const w = wide ? 0.34 : 0.28;
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(preset.wheelRadius, preset.wheelRadius, w, 16), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(preset.wheelRadius * 0.58, preset.wheelRadius * 0.58, w + 0.02, 10),
      rimMat
    );
    hub.rotation.z = Math.PI / 2;
    const lug = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, preset.wheelRadius * 0.82, 0.08), frameMat);
    const lug2 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.08, preset.wheelRadius * 0.82), frameMat);
    tireSpin.add(tire, hub, lug, lug2);
    steerPivot.add(tireSpin);
    group.add(steerPivot);
    return { steerPivot, tireSpin };
  };

  const hx = preset.trackWidth * 0.5;
  const hz = preset.wheelBase * 0.5;
  const fl = makeWheel(-hx, hz);
  const fr = makeWheel(hx, hz);
  const rl = makeWheel(-hx, -hz, carId === 'trailBuggy' || carId === 'forestTruck');
  const rr = makeWheel(hx, -hz, carId === 'trailBuggy' || carId === 'forestTruck');

  // Chassis + car-specific styling
  const exhaustPos = new THREE.Object3D();
  exhaustPos.position.set(-0.34, 0.08, -1.45);
  chassisPivot.add(exhaustPos);

  const driverEyeAnchor = new THREE.Object3D();
  if (carId === 'trailBuggy') {
    driverEyeAnchor.position.set(0, 0.84, 0.14);
  } else if (carId === 'rallyCoupe') {
    // Positioned at the front windshield brow so opaque cabin walls never block cockpit sightline
    driverEyeAnchor.position.set(-0.14, 0.84, 0.62);
  } else if (carId === 'forestTruck') {
    driverEyeAnchor.position.set(-0.24, 0.96, 1.02);
  } else {
    driverEyeAnchor.position.set(-0.18, 0.78, 0.06);
  }
  chassisPivot.add(driverEyeAnchor);

  const driver = buildDriverOccupant(driverId);

  if (carId === 'trailBuggy') {
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
    // Tubular roll cage
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
    const roofPlate = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.78), trimMat);
    roofPlate.position.set(0, 1.0, -0.06);
    roofPlate.castShadow = true;
    // Spare tire & rear twin exhausts
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.2, 12), tireMat);
    spare.rotation.x = Math.PI / 2 + 0.35;
    spare.position.set(0, 0.5, -1.16);
    spare.castShadow = true;
    // Headlights & brake lamps
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
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.42, 1.35), paintMat);
    cabin.position.set(0, 0.6, -0.1);
    cabin.castShadow = true;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.34, 1.38), glassMat);
    windshield.position.set(0, 0.58, -0.08);
    const wingPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.18), frameMat);
    wingPillarL.position.set(-0.42, 0.52, -1.25);
    const wingPillarR = wingPillarL.clone();
    wingPillarR.position.x = 0.42;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.07, 0.34), frameMat);
    wing.position.set(0, 0.66, -1.28);
    wing.castShadow = true;
    // Quad rally pod lights on hood
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
    chassisPivot.add(body, stripe, cabin, windshield, wingPillarL, wingPillarR, wing, blL, blR, driver.root);
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
    const woodMat = new THREE.MeshStandardMaterial({ color: '#9A5B2F', roughness: 0.85 });
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
    brakeLights,
    exhaustPos,
    driverEyeAnchor,
    driverHead: driver.head,
    shadowDisc,
  };
}
