import * as THREE from 'three';
import type { ObjectSerializedGeometry } from '../types/maker';

const EPSILON = 1e-4;

interface CsgVertex {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  uv: THREE.Vector2;
}

function cloneVertex(v: CsgVertex): CsgVertex {
  return {
    pos: v.pos.clone(),
    normal: v.normal.clone(),
    uv: v.uv.clone(),
  };
}

function interpolateVertex(a: CsgVertex, b: CsgVertex, t: number): CsgVertex {
  const pos = a.pos.clone().lerp(b.pos, t);
  const normal = a.normal.clone().lerp(b.normal, t);
  if (normal.lengthSq() > 1e-8) normal.normalize();
  const uv = a.uv.clone().lerp(b.uv, t);
  return { pos, normal, uv };
}

class CsgPlane {
  normal: THREE.Vector3;
  w: number;

  constructor(normal: THREE.Vector3, w: number) {
    this.normal = normal;
    this.w = w;
  }

  static fromPoints(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): CsgPlane | null {
    const ab = b.clone().sub(a);
    const ac = c.clone().sub(a);
    const n = ab.cross(ac);
    const lenSq = n.lengthSq();
    if (lenSq < 1e-10) return null;
    n.multiplyScalar(1 / Math.sqrt(lenSq));
    return new CsgPlane(n, n.dot(a));
  }

  clone(): CsgPlane {
    return new CsgPlane(this.normal.clone(), this.w);
  }

  flip(): void {
    this.normal.negate();
    this.w = -this.w;
  }

  splitPolygon(
    polygon: CsgPolygon,
    coplanarFront: CsgPolygon[],
    coplanarBack: CsgPolygon[],
    front: CsgPolygon[],
    back: CsgPolygon[]
  ): void {
    const COPLANAR = 0;
    const FRONT = 1;
    const BACK = 2;
    const SPANNING = 3;

    let polygonType = 0;
    const types: number[] = new Array(polygon.vertices.length);
    for (let i = 0; i < polygon.vertices.length; i++) {
      const t = this.normal.dot(polygon.vertices[i].pos) - this.w;
      const type = t < -EPSILON ? BACK : t > EPSILON ? FRONT : COPLANAR;
      polygonType |= type;
      types[i] = type;
    }

    switch (polygonType) {
      case COPLANAR:
        (this.normal.dot(polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
        break;
      case FRONT:
        front.push(polygon);
        break;
      case BACK:
        back.push(polygon);
        break;
      case SPANNING: {
        const f: CsgVertex[] = [];
        const b: CsgVertex[] = [];
        for (let i = 0; i < polygon.vertices.length; i++) {
          const j = (i + 1) % polygon.vertices.length;
          const ti = types[i];
          const tj = types[j];
          const vi = polygon.vertices[i];
          const vj = polygon.vertices[j];
          if (ti !== BACK) f.push(vi);
          if (ti !== FRONT) b.push(ti !== BACK ? cloneVertex(vi) : vi);
          if ((ti | tj) === SPANNING) {
            const denom = this.normal.dot(vj.pos.clone().sub(vi.pos));
            const t =
              Math.abs(denom) > 1e-9
                ? THREE.MathUtils.clamp((this.w - this.normal.dot(vi.pos)) / denom, 0, 1)
                : 0.5;
            const v = interpolateVertex(vi, vj, t);
            f.push(v);
            b.push(cloneVertex(v));
          }
        }
        if (f.length >= 3) front.push(new CsgPolygon(f, polygon.plane.clone()));
        if (b.length >= 3) back.push(new CsgPolygon(b, polygon.plane.clone()));
        break;
      }
    }
  }
}

class CsgPolygon {
  vertices: CsgVertex[];
  plane: CsgPlane;

  constructor(vertices: CsgVertex[], plane?: CsgPlane) {
    this.vertices = vertices;
    if (plane) {
      this.plane = plane;
    } else {
      const p = CsgPlane.fromPoints(vertices[0].pos, vertices[1].pos, vertices[2].pos);
      this.plane = p ?? new CsgPlane(new THREE.Vector3(0, 1, 0), 0);
    }
  }

  clone(): CsgPolygon {
    return new CsgPolygon(this.vertices.map(cloneVertex), this.plane.clone());
  }

  flip(): void {
    this.vertices.reverse();
    for (const v of this.vertices) {
      v.normal.negate();
    }
    this.plane.flip();
  }
}

class BspNode {
  plane: CsgPlane | null = null;
  front: BspNode | null = null;
  back: BspNode | null = null;
  polygons: CsgPolygon[] = [];

  constructor(polygons?: CsgPolygon[]) {
    if (polygons && polygons.length > 0) {
      this.build(polygons);
    }
  }

  clone(): BspNode {
    const node = new BspNode();
    node.plane = this.plane ? this.plane.clone() : null;
    node.front = this.front ? this.front.clone() : null;
    node.back = this.back ? this.back.clone() : null;
    node.polygons = this.polygons.map((p) => p.clone());
    return node;
  }

  invert(): void {
    for (const p of this.polygons) p.flip();
    this.plane?.flip();
    this.front?.invert();
    this.back?.invert();
    const tmp = this.front;
    this.front = this.back;
    this.back = tmp;
  }

  clipPolygons(polygons: CsgPolygon[]): CsgPolygon[] {
    if (!this.plane) return polygons.slice();
    let front: CsgPolygon[] = [];
    let back: CsgPolygon[] = [];
    for (const p of polygons) {
      this.plane.splitPolygon(p, front, back, front, back);
    }
    if (this.front) front = this.front.clipPolygons(front);
    back = this.back ? this.back.clipPolygons(back) : [];
    return front.concat(back);
  }

  clipTo(bsp: BspNode): void {
    this.polygons = bsp.clipPolygons(this.polygons);
    this.front?.clipTo(bsp);
    this.back?.clipTo(bsp);
  }

  allPolygons(): CsgPolygon[] {
    let polys = this.polygons.slice();
    if (this.front) polys = polys.concat(this.front.allPolygons());
    if (this.back) polys = polys.concat(this.back.allPolygons());
    return polys;
  }

  build(polygons: CsgPolygon[], depth = 0): void {
    if (polygons.length === 0) return;
    if (!this.plane) {
      // Pick middle polygon to produce a better-balanced tree than always picking index 0
      const pivotIdx = Math.floor(polygons.length / 2);
      this.plane = polygons[pivotIdx].plane.clone();
    }
    const front: CsgPolygon[] = [];
    const back: CsgPolygon[] = [];
    for (const p of polygons) {
      this.plane.splitPolygon(p, this.polygons, this.polygons, front, back);
    }
    if (depth > 38) {
      if (front.length > 0) this.polygons.push(...front);
      if (back.length > 0) this.polygons.push(...back);
      return;
    }
    if (front.length > 0) {
      if (!this.front) this.front = new BspNode();
      this.front.build(front, depth + 1);
    }
    if (back.length > 0) {
      if (!this.back) this.back = new BspNode();
      this.back.build(back, depth + 1);
    }
  }
}

function geometryToPolygons(
  geometry: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4
): CsgPolygon[] {
  const posAttr = geometry.attributes.position as THREE.BufferAttribute | undefined;
  if (!posAttr) return [];
  const normAttr = geometry.attributes.normal as THREE.BufferAttribute | undefined;
  const uvAttr = geometry.attributes.uv as THREE.BufferAttribute | undefined;
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);
  const idx = geometry.index;
  const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(posAttr.count / 3);
  const polygons: CsgPolygon[] = [];

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const cross = new THREE.Vector3();

  const readVertex = (vi: number): CsgVertex => {
    const pos = new THREE.Vector3().fromBufferAttribute(posAttr, vi).applyMatrix4(worldMatrix);
    const normal = normAttr
      ? new THREE.Vector3().fromBufferAttribute(normAttr, vi).applyMatrix3(normalMatrix).normalize()
      : new THREE.Vector3(0, 1, 0);
    const uv = uvAttr
      ? new THREE.Vector2().fromBufferAttribute(uvAttr, vi)
      : new THREE.Vector2(0, 0);
    return { pos, normal, uv };
  };

  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;

    const a = readVertex(i0);
    const b = readVertex(i1);
    const c = readVertex(i2);

    vA.copy(a.pos);
    vB.copy(b.pos);
    vC.copy(c.pos);
    e1.subVectors(vB, vA);
    e2.subVectors(vC, vA);
    cross.crossVectors(e1, e2);
    if (cross.lengthSq() < 1e-11) continue;

    const plane = CsgPlane.fromPoints(a.pos, b.pos, c.pos);
    if (!plane) continue;
    polygons.push(new CsgPolygon([a, b, c], plane));
  }

  return polygons;
}

function polygonsToGeometry(polygons: CsgPolygon[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (const poly of polygons) {
    if (poly.vertices.length < 3) continue;
    const v0 = poly.vertices[0];
    for (let i = 1; i < poly.vertices.length - 1; i++) {
      const v1 = poly.vertices[i];
      const v2 = poly.vertices[i + 1];
      const e1x = v1.pos.x - v0.pos.x;
      const e1y = v1.pos.y - v0.pos.y;
      const e1z = v1.pos.z - v0.pos.z;
      const e2x = v2.pos.x - v0.pos.x;
      const e2y = v2.pos.y - v0.pos.y;
      const e2z = v2.pos.z - v0.pos.z;
      const cx = e1y * e2z - e1z * e2y;
      const cy = e1z * e2x - e1x * e2z;
      const cz = e1x * e2y - e1y * e2x;
      if (cx * cx + cy * cy + cz * cz < 1e-11) continue;

      for (const v of [v0, v1, v2]) {
        positions.push(v.pos.x, v.pos.y, v.pos.z);
        normals.push(v.normal.x, v.normal.y, v.normal.z);
        uvs.push(v.uv.x, v.uv.y);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export type BooleanOperation = 'union' | 'subtract' | 'intersect';

export function performBooleanCsg(
  op: BooleanOperation,
  geomA: THREE.BufferGeometry,
  matA: THREE.Matrix4,
  geomB: THREE.BufferGeometry,
  matB: THREE.Matrix4
): { geometry: THREE.BufferGeometry; center: THREE.Vector3 } | null {
  const polysA = geometryToPolygons(geomA, matA);
  const polysB = geometryToPolygons(geomB, matB);
  if (polysA.length === 0) return null;
  if (polysB.length === 0) {
    const fallback = polygonsToGeometry(polysA);
    fallback.computeBoundingBox();
    const center = new THREE.Vector3();
    fallback.boundingBox?.getCenter(center);
    fallback.translate(-center.x, -center.y, -center.z);
    return { geometry: fallback, center };
  }

  const a = new BspNode(polysA);
  const b = new BspNode(polysB);
  let resultPolys: CsgPolygon[] = [];

  if (op === 'union') {
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    resultPolys = a.allPolygons();
  } else if (op === 'subtract') {
    a.invert();
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    a.invert();
    resultPolys = a.allPolygons();
  } else {
    a.invert();
    b.clipTo(a);
    b.invert();
    a.clipTo(b);
    b.clipTo(a);
    a.build(b.allPolygons());
    a.invert();
    resultPolys = a.allPolygons();
  }

  if (resultPolys.length === 0) return null;
  const geo = polygonsToGeometry(resultPolys);
  geo.computeBoundingBox();
  const center = new THREE.Vector3();
  geo.boundingBox?.getCenter(center);
  geo.translate(-center.x, -center.y, -center.z);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return { geometry: geo, center };
}

export function combineGeometriesWorldSpace(
  entries: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[]
): { geometry: THREE.BufferGeometry; center: THREE.Vector3 } | null {
  const allPolys: CsgPolygon[] = [];
  for (const entry of entries) {
    allPolys.push(...geometryToPolygons(entry.geometry, entry.matrix));
  }
  if (allPolys.length === 0) return null;
  const geo = polygonsToGeometry(allPolys);
  geo.computeBoundingBox();
  const center = new THREE.Vector3();
  geo.boundingBox?.getCenter(center);
  geo.translate(-center.x, -center.y, -center.z);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return { geometry: geo, center };
}

export function serializeBufferGeometry(geo: THREE.BufferGeometry): ObjectSerializedGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const norm = geo.attributes.normal as THREE.BufferAttribute | undefined;
  const uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
  const roundArr = (arr: ArrayLike<number>, dec = 4): number[] => {
    const mult = 10 ** dec;
    const out = new Array<number>(arr.length);
    for (let i = 0; i < arr.length; i++) {
      out[i] = Math.round(arr[i] * mult) / mult;
    }
    return out;
  };
  return {
    positions: pos ? roundArr(pos.array, 4) : [],
    normals: norm ? roundArr(norm.array, 3) : [],
    uvs: uv ? roundArr(uv.array, 3) : [],
    ...(geo.index ? { indices: Array.from(geo.index.array) } : {}),
  };
}

export function deserializeBufferGeometry(data: ObjectSerializedGeometry): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  if (data.normals.length === data.positions.length) {
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  } else {
    geo.computeVertexNormals();
  }
  if (data.uvs.length > 0) {
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
  }
  if (data.indices && data.indices.length > 0) {
    geo.setIndex(data.indices);
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}
