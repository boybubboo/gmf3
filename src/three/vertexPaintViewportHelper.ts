import * as THREE from 'three';
import type { VertexPaintStroke } from '../types/maker';
import {
  applyVertexPaintDab,
  computeShiftedHexColor,
  type VertexPaintBrushSettings,
} from './vertexPainter';

export function shiftVertexPaintStrokes(
  strokes: VertexPaintStroke[],
  shift: [number, number, number]
): VertexPaintStroke[] {
  const [dx, dy, dz] = shift;
  if (Math.abs(dx) < 1e-5 && Math.abs(dy) < 1e-5 && Math.abs(dz) < 1e-5) {
    return strokes;
  }
  return strokes.map((s) => ({
    ...s,
    points: s.points.map(
      ([x, y, z]) =>
        [
          Number((x + dx).toFixed(4)),
          Number((y + dy).toFixed(4)),
          Number((z + dz).toFixed(4)),
        ] as [number, number, number]
    ),
  }));
}

export interface MakerPaintCursor {
  group: THREE.Group;
  sphere: THREE.Mesh;
  ring: THREE.Mesh;
}

export function createMakerPaintCursor(): MakerPaintCursor {
  const group = new THREE.Group();
  group.visible = false;
  group.renderOrder = 950;
  group.userData.noVertexPaint = true;

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 16),
    new THREE.MeshBasicMaterial({
      color: '#EC4899',
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  sphere.userData.noVertexPaint = true;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1.0, 32),
    new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  ring.userData.noVertexPaint = true;

  group.add(sphere, ring);
  return { group, sphere, ring };
}

export function disposeMakerPaintCursor(cursor: MakerPaintCursor): void {
  cursor.sphere.geometry.dispose();
  (cursor.sphere.material as THREE.Material).dispose();
  cursor.ring.geometry.dispose();
  (cursor.ring.material as THREE.Material).dispose();
}

export function updateMakerPaintCursorAppearance(
  cursor: MakerPaintCursor,
  brush: VertexPaintBrushSettings
): void {
  cursor.group.scale.setScalar(Math.max(0.06, brush.radius));
  const col =
    brush.mode === 'erase'
      ? '#EF4444'
      : brush.mode === 'degrade'
      ? '#F59E0B'
      : brush.mode === 'hueShift'
      ? '#38BDF8'
      : computeShiftedHexColor(
          brush.color,
          brush.hueShift,
          brush.saturationShift,
          brush.valueShift
        );
  (cursor.sphere.material as THREE.MeshBasicMaterial).color.set(col);
  (cursor.ring.material as THREE.MeshBasicMaterial).color.set(
    brush.mode === 'erase' ? '#FCA5A5' : '#FFFFFF'
  );
}

export class MakerVertexPaintSession {
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private worldHit = new THREE.Vector3();
  private localHit = new THREE.Vector3();
  private worldNormal = new THREE.Vector3();
  private normalMat = new THREE.Matrix3();
  private upVec = new THREE.Vector3(0, 0, 1);

  private activeStroke: VertexPaintStroke | null = null;
  private isBrushing = false;
  private lastDabPoint = new THREE.Vector3();
  private strokeModified = false;

  readonly cursor: MakerPaintCursor;

  constructor(scene: THREE.Scene) {
    this.cursor = createMakerPaintCursor();
    scene.add(this.cursor.group);
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.cursor.group);
    disposeMakerPaintCursor(this.cursor);
  }

  hideCursor(): void {
    this.cursor.group.visible = false;
  }

  private raycastHit(
    clientX: number,
    clientY: number,
    domEl: HTMLElement,
    camera: THREE.Camera,
    targetMeshes: THREE.Mesh[]
  ): THREE.Intersection<THREE.Object3D> | null {
    if (targetMeshes.length === 0) return null;
    const rect = domEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, camera);
    const hits = this.raycaster.intersectObjects(targetMeshes, false);
    for (let i = 0; i < hits.length; i++) {
      if (hits[i].object.visible && !hits[i].object.userData.noVertexPaint) {
        return hits[i];
      }
    }
    return null;
  }

  private positionCursorAtHit(
    hit: THREE.Intersection<THREE.Object3D>,
    brush: VertexPaintBrushSettings
  ): void {
    updateMakerPaintCursorAppearance(this.cursor, brush);
    this.cursor.group.position.copy(hit.point);
    if (hit.face) {
      this.normalMat.getNormalMatrix(hit.object.matrixWorld);
      this.worldNormal.copy(hit.face.normal).applyMatrix3(this.normalMat).normalize();
      this.cursor.ring.quaternion.setFromUnitVectors(this.upVec, this.worldNormal);
    }
    this.cursor.group.visible = true;
  }

  handlePointerDown(params: {
    event: PointerEvent;
    domEl: HTMLElement;
    camera: THREE.Camera;
    paintRoot: THREE.Object3D;
    paintableMeshes: THREE.Mesh[];
    brush: VertexPaintBrushSettings;
  }): boolean {
    if (params.event.button !== 0) return false;
    const hit = this.raycastHit(
      params.event.clientX,
      params.event.clientY,
      params.domEl,
      params.camera,
      params.paintableMeshes
    );
    if (!hit) {
      this.hideCursor();
      return false;
    }

    this.positionCursorAtHit(hit, params.brush);
    params.paintRoot.updateMatrixWorld(true);
    this.worldHit.copy(hit.point);
    this.localHit.copy(this.worldHit);
    params.paintRoot.worldToLocal(this.localHit);

    const seed = Math.floor(Math.random() * 900000) + 100;
    const dabPt: [number, number, number] = [
      Number(this.localHit.x.toFixed(4)),
      Number(this.localHit.y.toFixed(4)),
      Number(this.localHit.z.toFixed(4)),
    ];

    this.activeStroke = {
      id: `vp_${Date.now().toString(36)}_${Math.floor(Math.random() * 9999)}`,
      points: [dabPt],
      radius: params.brush.radius,
      opacity: params.brush.opacity,
      softness: params.brush.softness,
      mode: params.brush.mode,
      target: params.brush.target,
      color: params.brush.color,
      hueShift: params.brush.hueShift,
      saturationShift: params.brush.saturationShift,
      valueShift: params.brush.valueShift,
      hueJitter: params.brush.hueJitter,
      degradeForm: params.brush.mode === 'degrade' ? params.brush.degradeForm ?? 'cracked' : undefined,
      degradeChipDepth:
        params.brush.mode === 'degrade' ? params.brush.degradeChipDepth ?? 0.45 : undefined,
      seed,
    };

    const modified = applyVertexPaintDab(
      params.paintRoot,
      this.localHit,
      params.brush,
      seed,
      params.paintableMeshes
    );
    this.strokeModified = modified;
    this.lastDabPoint.copy(this.localHit);
    this.isBrushing = true;
    try {
      params.domEl.setPointerCapture(params.event.pointerId);
    } catch {
      // ignore if capture unavailable
    }
    return true;
  }

  handlePointerMove(params: {
    event: PointerEvent;
    domEl: HTMLElement;
    camera: THREE.Camera;
    paintRoot: THREE.Object3D;
    paintableMeshes: THREE.Mesh[];
    brush: VertexPaintBrushSettings;
  }): void {
    const hit = this.raycastHit(
      params.event.clientX,
      params.event.clientY,
      params.domEl,
      params.camera,
      params.paintableMeshes
    );
    if (!hit) {
      if (!this.isBrushing) this.hideCursor();
      return;
    }

    this.positionCursorAtHit(hit, params.brush);
    if (!this.isBrushing || !this.activeStroke) return;

    params.paintRoot.updateMatrixWorld(true);
    this.worldHit.copy(hit.point);
    this.localHit.copy(this.worldHit);
    params.paintRoot.worldToLocal(this.localHit);

    const minSpacing = Math.max(0.03, params.brush.radius * 0.24);
    if (this.localHit.distanceTo(this.lastDabPoint) < minSpacing) return;

    this.lastDabPoint.copy(this.localHit);
    this.activeStroke.points.push([
      Number(this.localHit.x.toFixed(4)),
      Number(this.localHit.y.toFixed(4)),
      Number(this.localHit.z.toFixed(4)),
    ]);

    const modified = applyVertexPaintDab(
      params.paintRoot,
      this.localHit,
      params.brush,
      this.activeStroke.seed,
      params.paintableMeshes
    );
    if (modified) this.strokeModified = true;
  }

  updateHoverCursor(params: {
    event: PointerEvent;
    domEl: HTMLElement;
    camera: THREE.Camera;
    paintRoot?: THREE.Object3D;
    paintableMeshes: THREE.Mesh[];
    brush: VertexPaintBrushSettings;
  }): void {
    const hit = this.raycastHit(
      params.event.clientX,
      params.event.clientY,
      params.domEl,
      params.camera,
      params.paintableMeshes
    );
    if (!hit) {
      this.hideCursor();
      return;
    }
    this.positionCursorAtHit(hit, params.brush);
  }

  finishStroke(domEl?: HTMLElement, pointerId?: number): VertexPaintStroke | null {
    if (domEl && pointerId !== undefined) {
      try {
        if (domEl.hasPointerCapture(pointerId)) {
          domEl.releasePointerCapture(pointerId);
        }
      } catch {
        // ignore
      }
    }
    if (!this.isBrushing || !this.activeStroke) {
      this.isBrushing = false;
      this.activeStroke = null;
      this.strokeModified = false;
      return null;
    }
    const completed = this.strokeModified && this.activeStroke.points.length > 0 ? this.activeStroke : null;
    this.isBrushing = false;
    this.activeStroke = null;
    this.strokeModified = false;
    return completed;
  }

  get brushing(): boolean {
    return this.isBrushing;
  }
}
