import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

type GizmoEntry = [
  THREE.Object3D,
  [number, number, number]?,
  [number, number, number]?,
  [number, number, number]?
];

function buildGizmoGroupFromEntries(map: Record<string, GizmoEntry[]>): THREE.Object3D {
  const root = new THREE.Object3D();
  for (const name of Object.keys(map)) {
    const entries = map[name];
    for (let i = 0; i < entries.length; i++) {
      const [proto, pos, rot, scl] = entries[i];
      const obj = proto.clone();
      obj.name = name;
      if (pos) obj.position.set(pos[0], pos[1], pos[2]);
      if (rot) obj.rotation.set(rot[0], rot[1], rot[2]);
      if (scl) obj.scale.set(scl[0], scl[1], scl[2]);
      obj.updateMatrix();
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) {
        const baked = mesh.geometry.clone();
        baked.applyMatrix4(mesh.matrix);
        mesh.geometry = baked;
      }
      obj.position.set(0, 0, 0);
      obj.rotation.set(0, 0, 0);
      obj.scale.set(1, 1, 1);
      obj.renderOrder = Infinity;
      root.add(obj);
    }
  }
  return root;
}

function disposeGizmoGroupChildren(group: THREE.Object3D | undefined) {
  if (!group) return;
  group.traverse((child) => {
    const m = child as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
  group.clear();
}

export function enhanceTransformControlsGizmo(tc: TransformControls) {
  const gizmoInst = (
    tc as unknown as {
      _gizmo?: THREE.Object3D & {
        gizmo: Record<string, THREE.Object3D>;
        picker: Record<string, THREE.Object3D>;
        materialLib: Record<
          string,
          THREE.MeshBasicMaterial & { _color?: THREE.Color; _opacity?: number }
        >;
      };
    }
  )._gizmo;
  if (!gizmoInst || !gizmoInst.gizmo || !gizmoInst.picker) return;

  tc.setColors('#FF4757', '#2ED573', '#1E90FF', '#FFD32A');

  const mat = (colorHex: string, opacity = 1) =>
    new THREE.MeshBasicMaterial({
      color: colorHex,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      transparent: true,
      opacity,
    });

  const matX = gizmoInst.materialLib?.xAxis ?? mat('#FF4757', 1);
  const matY = gizmoInst.materialLib?.yAxis ?? mat('#2ED573', 1);
  const matZ = gizmoInst.materialLib?.zAxis ?? mat('#1E90FF', 1);
  const matXPlane = gizmoInst.materialLib?.xAxisTransparent ?? mat('#FF4757', 0.42);
  const matYPlane = gizmoInst.materialLib?.yAxisTransparent ?? mat('#2ED573', 0.42);
  const matZPlane = gizmoInst.materialLib?.zAxisTransparent ?? mat('#1E90FF', 0.42);
  const matCenter = mat('#FFFFFF', 0.72);
  const matGray = mat('#94A3B8', 0.55);
  const matRingOuter = mat('#FACC15', 0.45);
  const matInvisible = mat('#FFFFFF', 0.12);

  // Fat Translate Visuals: thick shafts + prominent arrowheads on both ends
  const shaftGeo = new THREE.CylinderGeometry(0.032, 0.032, 1.12, 12);
  const arrowConeGeo = new THREE.CylinderGeometry(0, 0.115, 0.26, 16);
  arrowConeGeo.translate(0, 0.13, 0);
  const arrowCollarGeo = new THREE.BoxGeometry(0.095, 0.095, 0.095);
  const planeQuadGeo = new THREE.BoxGeometry(0.22, 0.22, 0.024);

  const fatTranslate: Record<string, GizmoEntry[]> = {
    X: [
      [new THREE.Mesh(shaftGeo, matX), [0, 0, 0], [0, 0, -Math.PI / 2]],
      [new THREE.Mesh(arrowConeGeo, matX), [0.52, 0, 0], [0, 0, -Math.PI / 2]],
      [new THREE.Mesh(arrowConeGeo, matX), [-0.52, 0, 0], [0, 0, Math.PI / 2]],
      [new THREE.Mesh(arrowCollarGeo, matX), [0.5, 0, 0]],
      [new THREE.Mesh(arrowCollarGeo, matX), [-0.5, 0, 0]],
    ],
    Y: [
      [new THREE.Mesh(shaftGeo, matY), [0, 0, 0]],
      [new THREE.Mesh(arrowConeGeo, matY), [0, 0.52, 0]],
      [new THREE.Mesh(arrowConeGeo, matY), [0, -0.52, 0], [Math.PI, 0, 0]],
      [new THREE.Mesh(arrowCollarGeo, matY), [0, 0.5, 0]],
      [new THREE.Mesh(arrowCollarGeo, matY), [0, -0.5, 0]],
    ],
    Z: [
      [new THREE.Mesh(shaftGeo, matZ), [0, 0, 0], [Math.PI / 2, 0, 0]],
      [new THREE.Mesh(arrowConeGeo, matZ), [0, 0, 0.52], [Math.PI / 2, 0, 0]],
      [new THREE.Mesh(arrowConeGeo, matZ), [0, 0, -0.52], [-Math.PI / 2, 0, 0]],
      [new THREE.Mesh(arrowCollarGeo, matZ), [0, 0, 0.5]],
      [new THREE.Mesh(arrowCollarGeo, matZ), [0, 0, -0.5]],
    ],
    XYZ: [[new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12), matCenter), [0, 0, 0]]],
    XY: [[new THREE.Mesh(planeQuadGeo, matZPlane), [0.23, 0.23, 0]]],
    YZ: [[new THREE.Mesh(planeQuadGeo, matXPlane), [0, 0.23, 0.23], [0, Math.PI / 2, 0]]],
    XZ: [[new THREE.Mesh(planeQuadGeo, matYPlane), [0.23, 0, 0.23], [-Math.PI / 2, 0, 0]]],
  };

  // Oversized Translate Picker Hit Volumes (cursor + finger friendly!)
  const pickAxisCyl = new THREE.CylinderGeometry(0.24, 0.24, 1.68, 12);
  const pickTipSphere = new THREE.SphereGeometry(0.32, 10, 8);
  const pickPlaneBox = new THREE.BoxGeometry(0.34, 0.34, 0.14);

  const fatPickerTranslate: Record<string, GizmoEntry[]> = {
    X: [
      [new THREE.Mesh(pickAxisCyl, matInvisible), [0, 0, 0], [0, 0, -Math.PI / 2]],
      [new THREE.Mesh(pickTipSphere, matInvisible), [0.64, 0, 0]],
      [new THREE.Mesh(pickTipSphere, matInvisible), [-0.64, 0, 0]],
    ],
    Y: [
      [new THREE.Mesh(pickAxisCyl, matInvisible), [0, 0, 0]],
      [new THREE.Mesh(pickTipSphere, matInvisible), [0, 0.64, 0]],
      [new THREE.Mesh(pickTipSphere, matInvisible), [0, -0.64, 0]],
    ],
    Z: [
      [new THREE.Mesh(pickAxisCyl, matInvisible), [0, 0, 0], [Math.PI / 2, 0, 0]],
      [new THREE.Mesh(pickTipSphere, matInvisible), [0, 0, 0.64]],
      [new THREE.Mesh(pickTipSphere, matInvisible), [0, 0, -0.64]],
    ],
    XYZ: [[new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), matInvisible), [0, 0, 0]]],
    XY: [[new THREE.Mesh(pickPlaneBox, matInvisible), [0.23, 0.23, 0]]],
    YZ: [[new THREE.Mesh(pickPlaneBox, matInvisible), [0, 0.23, 0.23], [0, Math.PI / 2, 0]]],
    XZ: [[new THREE.Mesh(pickPlaneBox, matInvisible), [0.23, 0, 0.23], [-Math.PI / 2, 0, 0]]],
  };

  // Fat Scale Visuals: thick shafts + chunky end cubes on every axis + center uniform cube
  const scaleEndCube = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const scaleCenterCube = new THREE.BoxGeometry(0.24, 0.24, 0.24);
  const fatScale: Record<string, GizmoEntry[]> = {
    X: [
      [new THREE.Mesh(shaftGeo, matX), [0, 0, 0], [0, 0, -Math.PI / 2]],
      [new THREE.Mesh(scaleEndCube, matX), [0.62, 0, 0]],
      [new THREE.Mesh(scaleEndCube, matX), [-0.62, 0, 0]],
    ],
    Y: [
      [new THREE.Mesh(shaftGeo, matY), [0, 0, 0]],
      [new THREE.Mesh(scaleEndCube, matY), [0, 0.62, 0]],
      [new THREE.Mesh(scaleEndCube, matY), [0, -0.62, 0]],
    ],
    Z: [
      [new THREE.Mesh(shaftGeo, matZ), [0, 0, 0], [Math.PI / 2, 0, 0]],
      [new THREE.Mesh(scaleEndCube, matZ), [0, 0, 0.62]],
      [new THREE.Mesh(scaleEndCube, matZ), [0, 0, -0.62]],
    ],
    XY: [[new THREE.Mesh(planeQuadGeo, matZPlane), [0.23, 0.23, 0]]],
    YZ: [[new THREE.Mesh(planeQuadGeo, matXPlane), [0, 0.23, 0.23], [0, Math.PI / 2, 0]]],
    XZ: [[new THREE.Mesh(planeQuadGeo, matYPlane), [0.23, 0, 0.23], [-Math.PI / 2, 0, 0]]],
    XYZ: [[new THREE.Mesh(scaleCenterCube, matCenter), [0, 0, 0]]],
  };

  // Oversized Scale Picker Hit Volumes: thick shaft cylinders + 0.42m cube hit zones at tips
  const pickScaleCube = new THREE.BoxGeometry(0.42, 0.42, 0.42);
  const fatPickerScale: Record<string, GizmoEntry[]> = {
    X: [
      [new THREE.Mesh(pickAxisCyl, matInvisible), [0, 0, 0], [0, 0, -Math.PI / 2]],
      [new THREE.Mesh(pickScaleCube, matInvisible), [0.62, 0, 0]],
      [new THREE.Mesh(pickScaleCube, matInvisible), [-0.62, 0, 0]],
    ],
    Y: [
      [new THREE.Mesh(pickAxisCyl, matInvisible), [0, 0, 0]],
      [new THREE.Mesh(pickScaleCube, matInvisible), [0, 0.62, 0]],
      [new THREE.Mesh(pickScaleCube, matInvisible), [0, -0.62, 0]],
    ],
    Z: [
      [new THREE.Mesh(pickAxisCyl, matInvisible), [0, 0, 0], [Math.PI / 2, 0, 0]],
      [new THREE.Mesh(pickScaleCube, matInvisible), [0, 0, 0.62]],
      [new THREE.Mesh(pickScaleCube, matInvisible), [0, 0, -0.62]],
    ],
    XY: [[new THREE.Mesh(pickPlaneBox, matInvisible), [0.23, 0.23, 0]]],
    YZ: [[new THREE.Mesh(pickPlaneBox, matInvisible), [0, 0.23, 0.23], [0, Math.PI / 2, 0]]],
    XZ: [[new THREE.Mesh(pickPlaneBox, matInvisible), [0.23, 0, 0.23], [-Math.PI / 2, 0, 0]]],
    XYZ: [[new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), matInvisible), [0, 0, 0]]],
  };

  // Fat Rotate Visuals: thick rings + chunky tactile grabber cubes mounted on each axis ring
  const makeRotateArcGeo = (radius: number, arcFrac: number) => {
    const geo = new THREE.TorusGeometry(radius, 0.028, 10, 48, arcFrac * Math.PI * 2);
    geo.rotateY(Math.PI / 2);
    geo.rotateX(Math.PI / 2);
    return geo;
  };
  const rotateArcGeo = makeRotateArcGeo(0.6, 0.5);
  const rotateOuterGeo = makeRotateArcGeo(0.84, 1.0);
  const rotateFreeGeo = makeRotateArcGeo(0.6, 1.0);
  const rotateKnobGeo = new THREE.BoxGeometry(0.135, 0.135, 0.135);

  const fatRotate: Record<string, GizmoEntry[]> = {
    XYZE: [[new THREE.Mesh(rotateFreeGeo, matGray), [0, 0, 0], [0, Math.PI / 2, 0]]],
    X: [
      [new THREE.Mesh(rotateArcGeo, matX)],
      [new THREE.Mesh(rotateKnobGeo, matX), [0, 0, 0.6]],
    ],
    Y: [
      [new THREE.Mesh(rotateArcGeo, matY), [0, 0, 0], [0, 0, -Math.PI / 2]],
      [new THREE.Mesh(rotateKnobGeo, matY), [0, 0, 0.6], [0, 0, -Math.PI / 2]],
    ],
    Z: [
      [new THREE.Mesh(rotateArcGeo, matZ), [0, 0, 0], [0, Math.PI / 2, 0]],
      [new THREE.Mesh(rotateKnobGeo, matZ), [0.6, 0, 0], [0, Math.PI / 2, 0]],
    ],
    E: [[new THREE.Mesh(rotateOuterGeo, matRingOuter), [0, 0, 0], [0, Math.PI / 2, 0]]],
  };

  // Oversized Rotate Picker Hit Tori
  const pickRotateTorus = new THREE.TorusGeometry(0.6, 0.21, 10, 28);
  const fatPickerRotate: Record<string, GizmoEntry[]> = {
    XYZE: [[new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), matInvisible)]],
    X: [[new THREE.Mesh(pickRotateTorus, matInvisible), [0, 0, 0], [0, -Math.PI / 2, -Math.PI / 2]]],
    Y: [[new THREE.Mesh(pickRotateTorus, matInvisible), [0, 0, 0], [Math.PI / 2, 0, 0]]],
    Z: [[new THREE.Mesh(pickRotateTorus, matInvisible), [0, 0, 0], [0, 0, -Math.PI / 2]]],
    E: [[new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.18, 10, 28), matInvisible)]],
  };

  const swapGroup = (
    container: Record<string, THREE.Object3D>,
    mode: 'translate' | 'rotate' | 'scale',
    entries: Record<string, GizmoEntry[]>,
    visible: boolean
  ) => {
    const oldGroup = container[mode];
    if (oldGroup) {
      disposeGizmoGroupChildren(oldGroup);
      gizmoInst.remove(oldGroup);
    }
    const nextGroup = buildGizmoGroupFromEntries(entries);
    nextGroup.visible = visible;
    container[mode] = nextGroup;
    gizmoInst.add(nextGroup);
  };

  swapGroup(gizmoInst.gizmo, 'translate', fatTranslate, tc.mode === 'translate');
  swapGroup(gizmoInst.gizmo, 'scale', fatScale, tc.mode === 'scale');
  swapGroup(gizmoInst.gizmo, 'rotate', fatRotate, tc.mode === 'rotate');
  swapGroup(gizmoInst.picker, 'translate', fatPickerTranslate, false);
  swapGroup(gizmoInst.picker, 'scale', fatPickerScale, false);
  swapGroup(gizmoInst.picker, 'rotate', fatPickerRotate, false);
}
