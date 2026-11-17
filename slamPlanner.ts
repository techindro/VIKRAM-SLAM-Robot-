export type LayoutId = 'open-space' | 'corridor-maze' | 'narrow-aisles';

export interface BoxObstacle {
  cx: number;
  cy: number;
  hx: number;
  hy: number;
  height: number;
  kind: 'wall' | 'obstacle' | 'table' | 'bin';
}

export interface LayoutConfig {
  id: LayoutId;
  name: string;
  description: string;
  obstacleCount: number;
  minClearance: string;
  startPose: [number, number, number];
  exploreWaypoints: Array<[number, number]>;
  exploreSpeed: number;
  boxes: BoxObstacle[];
}

export interface ArmPose {
  joints: [number, number, number, number, number, number, number];
  gripperOpening: number;
  gripperState: 'OPEN' | 'LOCKED';
  eeWorld: [number, number, number];
}

export interface SimFrameState {
  simFrame: number;
  stageNum: 1 | 2 | 3 | 4 | 5;
  stageBanner: string;
  layoutId: LayoutId;
  layoutName: string;
  rx: number;
  ry: number;
  yaw: number;
  lidarStarts: Float32Array;
  lidarHits: Float32Array;
  lidarDists: Float32Array;
  lidarHitFlags: Uint8Array;
  minLidar: number;
  frontMinLidar: number;
  proximityWarning: boolean;
  slamGrid: Float32Array;
  coveragePct: number;
  odomPath: Array<[number, number]>;
  astarPath: Array<[number, number]>;
  showAstar: boolean;
  arm: ArmPose;
  cubePos: [number, number, number];
  cubeLocked: boolean;
  targetLocked3D: [number, number, number] | null;
  batteryPct: number;
  motorCurrentA: number;
  customObstacles: BoxObstacle[];
  dropOffPos: [number, number];
}

export interface CustomSceneOptions {
  customObstacles?: BoxObstacle[];
  dropOffPos?: [number, number] | null;
}

export const FPS = 30;
export const INTRO_FRAMES = 120;
export const STAGE_COUNTS: [number, number, number, number, number] = [90, 180, 150, 90, 150];
export const SIM_FRAMES = 660;
export const OUTRO_FRAMES = 120;
export const TOTAL_FRAMES = INTRO_FRAMES + SIM_FRAMES + OUTRO_FRAMES;

export const GRID_RES = 0.08;
export const GRID_ORIGIN_X = -4.4;
export const GRID_ORIGIN_Y = -3.4;
export const GRID_W = 110;
export const GRID_H = 85;
export const NUM_LIDAR_RAYS = 180;
export const LIDAR_MAX_RANGE = 5.5;
export const CRITICAL_LIDAR_DIST = 0.50;

export const PICKUP_TABLE_CENTER: [number, number] = [2.45, 0.80];
export const INITIAL_CUBE_POS: [number, number, number] = [2.20, 0.80, 0.47];
export const SORTING_BIN_POS: [number, number] = [1.65, 0.20];
export const PARK_POSE: [number, number, number] = [1.62, 0.80, 0.0];

const SHARED_PERIMETER_AND_STATIONS: BoxObstacle[] = [
  { cx: 0.0, cy: 3.0, hx: 4.08, hy: 0.08, height: 0.66, kind: 'wall' },
  { cx: 0.0, cy: -3.0, hx: 4.08, hy: 0.08, height: 0.66, kind: 'wall' },
  { cx: 4.0, cy: 0.0, hx: 0.08, hy: 3.0, height: 0.66, kind: 'wall' },
  { cx: -4.0, cy: 0.0, hx: 0.08, hy: 3.0, height: 0.66, kind: 'wall' },
  { cx: 2.45, cy: 0.80, hx: 0.40, hy: 0.45, height: 0.44, kind: 'table' },
  { cx: 1.65, cy: 0.20, hx: 0.20, hy: 0.17, height: 0.20, kind: 'bin' },
];

export const LAYOUT_CONFIGS: Record<LayoutId, LayoutConfig> = {
  'open-space': {
    id: 'open-space',
    name: 'Open Space',
    description: 'Wide industrial floor with 3 isolated storage pillars and broad sightlines.',
    obstacleCount: 3,
    minClearance: '1.45 m',
    startPose: [-2.8, 1.8, 0.0],
    exploreSpeed: 4.15,
    exploreWaypoints: [
      [-2.9, 0.0],
      [-1.0, -0.2],
      [-0.8, -2.1],
      [2.2, -2.1],
      [2.2, -0.65],
      [0.65, -0.45],
      [0.45, 0.35],
      [0.45, 2.0],
      [-2.1, 2.0],
    ],
    boxes: [
      ...SHARED_PERIMETER_AND_STATIONS,
      { cx: -0.8, cy: 0.8, hx: 0.45, hy: 0.45, height: 0.68, kind: 'obstacle' },
      { cx: 0.6, cy: -1.1, hx: 0.55, hy: 0.30, height: 0.68, kind: 'obstacle' },
      { cx: -2.0, cy: -1.3, hx: 0.40, hy: 0.40, height: 0.68, kind: 'obstacle' },
    ],
  },
  'corridor-maze': {
    id: 'corridor-maze',
    name: 'Corridor Maze',
    description: 'Interlocking baffle walls forcing serpentine SLAM mapping and doorway routing.',
    obstacleCount: 4,
    minClearance: '1.15 m',
    startPose: [-3.1, 1.8, -Math.PI / 2],
    exploreSpeed: 5.15,
    exploreWaypoints: [
      [-3.1, -1.85],
      [-1.4, -1.85],
      [-1.4, 1.85],
      [0.0, 1.85],
      [0.0, -1.85],
      [3.15, -2.30],
      [3.25, -1.15],
      [1.04, -0.75],
    ],
    boxes: [
      ...SHARED_PERIMETER_AND_STATIONS,
      { cx: -2.1, cy: 0.85, hx: 0.14, hy: 1.45, height: 0.68, kind: 'obstacle' },
      { cx: -0.65, cy: -0.80, hx: 0.14, hy: 1.50, height: 0.68, kind: 'obstacle' },
      { cx: 0.48, cy: 1.05, hx: 0.14, hy: 1.25, height: 0.68, kind: 'obstacle' },
      { cx: 1.85, cy: -1.65, hx: 0.90, hy: 0.14, height: 0.68, kind: 'obstacle' },
    ],
  },
  'narrow-aisles': {
    id: 'narrow-aisles',
    name: 'Narrow Aisles',
    description: 'Parallel warehouse racking bays with tight 0.99 m lanes and cross-aisle turns.',
    obstacleCount: 4,
    minClearance: '0.99 m',
    startPose: [-3.40, 2.38, 0.0],
    exploreSpeed: 5.45,
    exploreWaypoints: [
      [0.52, 2.38],
      [0.52, 0.78],
      [-3.40, 0.78],
      [-3.40, -0.78],
      [3.38, -0.78],
      [3.38, -2.38],
      [-0.80, -2.38],
    ],
    boxes: [
      ...SHARED_PERIMETER_AND_STATIONS,
      { cx: -1.45, cy: 1.55, hx: 1.45, hy: 0.28, height: 0.68, kind: 'obstacle' },
      { cx: -1.45, cy: 0.0, hx: 1.45, hy: 0.28, height: 0.68, kind: 'obstacle' },
      { cx: -1.45, cy: -1.55, hx: 1.45, hy: 0.28, height: 0.68, kind: 'obstacle' },
      { cx: 1.95, cy: -1.55, hx: 0.95, hy: 0.28, height: 0.68, kind: 'obstacle' },
    ],
  },
};

export const LAYOUT_ORDER: LayoutId[] = ['open-space', 'corridor-maze', 'narrow-aisles'];

export const EDITOR_GRID_COLS = 15;
export const EDITOR_GRID_ROWS = 11;
export const EDITOR_CELL_SIZE = 0.48;

export function editorCellToWorld(col: number, row: number): [number, number] {
  const cx = -((EDITOR_GRID_COLS - 1) * 0.5) * EDITOR_CELL_SIZE + col * EDITOR_CELL_SIZE;
  const cy = ((EDITOR_GRID_ROWS - 1) * 0.5) * EDITOR_CELL_SIZE - row * EDITOR_CELL_SIZE;
  return [Number(cx.toFixed(3)), Number(cy.toFixed(3))];
}

export function getEffectiveSceneBoxes(
  layoutId: LayoutId,
  customObstacles: BoxObstacle[] = [],
  dropOffPos: [number, number] = SORTING_BIN_POS
): BoxObstacle[] {
  const base = LAYOUT_CONFIGS[layoutId].boxes.map((b) =>
    b.kind === 'bin' ? { ...b, cx: dropOffPos[0], cy: dropOffPos[1] } : b
  );
  return [...base, ...customObstacles];
}

function isRobotBlocked(rx: number, ry: number, boxes: BoxObstacle[], margin = 0.30): boolean {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (Math.abs(rx - b.cx) < b.hx + margin && Math.abs(ry - b.cy) < b.hy + margin) {
      return true;
    }
  }
  return false;
}

export function wrapAngle(a: number): number {
  let ang = a;
  while (ang > Math.PI) ang -= 2.0 * Math.PI;
  while (ang < -Math.PI) ang += 2.0 * Math.PI;
  return ang;
}

function rayIntersectBox2D(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  box: BoxObstacle
): number | null {
  const minX = box.cx - box.hx;
  const maxX = box.cx + box.hx;
  const minY = box.cy - box.hy;
  const maxY = box.cy + box.hy;

  let tMin = 0.0;
  let tMax = LIDAR_MAX_RANGE;

  if (Math.abs(dx) < 1e-8) {
    if (ox < minX || ox > maxX) return null;
  } else {
    const invDx = 1.0 / dx;
    let t1 = (minX - ox) * invDx;
    let t2 = (maxX - ox) * invDx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  if (Math.abs(dy) < 1e-8) {
    if (oy < minY || oy > maxY) return null;
  } else {
    const invDy = 1.0 / dy;
    let t1 = (minY - oy) * invDy;
    let t2 = (maxY - oy) * invDy;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  return tMin >= 0.0 ? tMin : null;
}

function castLidar360(rx: number, ry: number, yaw: number, boxes: BoxObstacle[]) {
  const rStart = 0.35;
  const zRay = 0.23;
  const starts = new Float32Array(NUM_LIDAR_RAYS * 3);
  const hits = new Float32Array(NUM_LIDAR_RAYS * 3);
  const dists = new Float32Array(NUM_LIDAR_RAYS);
  const hitFlags = new Uint8Array(NUM_LIDAR_RAYS);

  let minD = LIDAR_MAX_RANGE;
  let frontMinD = LIDAR_MAX_RANGE;
  for (let i = 0; i < NUM_LIDAR_RAYS; i++) {
    const relAngle = (i / NUM_LIDAR_RAYS) * Math.PI * 2.0;
    const wrappedRel = relAngle > Math.PI ? relAngle - Math.PI * 2.0 : relAngle;
    const angle = relAngle + yaw;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const sx = rx + rStart * ca;
    const sy = ry + rStart * sa;
    starts[i * 3] = sx;
    starts[i * 3 + 1] = sy;
    starts[i * 3 + 2] = zRay;

    let bestT = LIDAR_MAX_RANGE - rStart;
    let hit = false;
    for (let b = 0; b < boxes.length; b++) {
      const t = rayIntersectBox2D(sx, sy, ca, sa, boxes[b]);
      if (t !== null && t < bestT) {
        bestT = t;
        hit = true;
      }
    }

    const totalDist = rStart + bestT;
    dists[i] = totalDist;
    if (totalDist < minD) minD = totalDist;
    if (Math.abs(wrappedRel) <= 0.785 && totalDist < frontMinD) frontMinD = totalDist;
    hitFlags[i] = hit ? 1 : 0;
    hits[i * 3] = sx + bestT * ca;
    hits[i * 3 + 1] = sy + bestT * sa;
    hits[i * 3 + 2] = zRay;
  }

  return { starts, hits, dists, hitFlags, minD, frontMinD };
}

function updateSlamGrid(
  logOdds: Float32Array,
  rx: number,
  ry: number,
  hits: Float32Array,
  hitFlags: Uint8Array
) {
  const sx = (rx - GRID_ORIGIN_X) / GRID_RES;
  const sy = (ry - GRID_ORIGIN_Y) / GRID_RES;
  const steps = 72;

  for (let i = 0; i < NUM_LIDAR_RAYS; i++) {
    const hx = (hits[i * 3] - GRID_ORIGIN_X) / GRID_RES;
    const hy = (hits[i * 3 + 1] - GRID_ORIGIN_Y) / GRID_RES;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const gx = Math.max(0, Math.min(GRID_W - 1, Math.floor(sx + t * (hx - sx))));
      const gy = Math.max(0, Math.min(GRID_H - 1, Math.floor(sy + t * (hy - sy))));
      const idx = gy * GRID_W + gx;
      logOdds[idx] = Math.max(-5.0, logOdds[idx] - 0.35);
    }
    if (hitFlags[i]) {
      const ex = Math.max(0, Math.min(GRID_W - 1, Math.round(hx)));
      const ey = Math.max(0, Math.min(GRID_H - 1, Math.round(hy)));
      const idx = ey * GRID_W + ex;
      logOdds[idx] = Math.min(5.0, logOdds[idx] + 1.25);
    }
  }
}

function dilateMask(src: Uint8Array, radius: number): Uint8Array {
  const out = new Uint8Array(GRID_W * GRID_H);
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (src[y * GRID_W + x] === 0) continue;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(GRID_W - 1, x + radius);
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(GRID_H - 1, y + radius);
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          out[yy * GRID_W + xx] = 1;
        }
      }
    }
  }
  return out;
}

function planAStar(
  logOdds: Float32Array,
  startXY: [number, number],
  goalXY: [number, number],
  inflationRadius: number
): Array<[number, number]> {
  const obs = new Uint8Array(GRID_W * GRID_H);
  for (let i = 0; i < obs.length; i++) {
    obs[i] = logOdds[i] > 0.35 ? 1 : 0;
  }
  const inflated = dilateMask(obs, inflationRadius);
  const softZone = dilateMask(obs, inflationRadius + 3);

  const scx = Math.max(1, Math.min(GRID_W - 2, Math.floor((startXY[0] - GRID_ORIGIN_X) / GRID_RES)));
  const scy = Math.max(1, Math.min(GRID_H - 2, Math.floor((startXY[1] - GRID_ORIGIN_Y) / GRID_RES)));
  const gcx = Math.max(1, Math.min(GRID_W - 2, Math.floor((goalXY[0] - GRID_ORIGIN_X) / GRID_RES)));
  const gcy = Math.max(1, Math.min(GRID_H - 2, Math.floor((goalXY[1] - GRID_ORIGIN_Y) / GRID_RES)));

  for (const [cx, cy] of [
    [scx, scy],
    [gcx, gcy],
  ]) {
    for (let yy = Math.max(0, cy - 2); yy <= Math.min(GRID_H - 1, cy + 2); yy++) {
      for (let xx = Math.max(0, cx - 2); xx <= Math.min(GRID_W - 1, cx + 2); xx++) {
        inflated[yy * GRID_W + xx] = 0;
      }
    }
  }

  const startIdx = scy * GRID_W + scx;
  const goalIdx = gcy * GRID_W + gcx;
  const gScore = new Float32Array(GRID_W * GRID_H).fill(1e9);
  const cameFrom = new Int32Array(GRID_W * GRID_H).fill(-1);
  const closed = new Uint8Array(GRID_W * GRID_H);

  const heap: Array<{ f: number; idx: number }> = [];
  const pushHeap = (item: { f: number; idx: number }) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f <= heap[i].f) break;
      const tmp = heap[p];
      heap[p] = heap[i];
      heap[i] = tmp;
      i = p;
    }
  };
  const popHeap = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let best = i;
        const l = i * 2 + 1;
        const r = i * 2 + 2;
        if (l < heap.length && heap[l].f < heap[best].f) best = l;
        if (r < heap.length && heap[r].f < heap[best].f) best = r;
        if (best === i) break;
        const tmp = heap[i];
        heap[i] = heap[best];
        heap[best] = tmp;
        i = best;
      }
    }
    return top;
  };

  gScore[startIdx] = 0;
  pushHeap({ f: Math.hypot(gcx - scx, gcy - scy), idx: startIdx });

  const dirs: Array<[number, number, number]> = [
    [1, 0, 1.0],
    [-1, 0, 1.0],
    [0, 1, 1.0],
    [0, -1, 1.0],
    [1, 1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [-1, -1, 1.414],
  ];

  let found = false;
  while (heap.length > 0) {
    const { idx } = popHeap();
    if (idx === goalIdx) {
      found = true;
      break;
    }
    if (closed[idx]) continue;
    closed[idx] = 1;

    const cx = idx % GRID_W;
    const cy = Math.floor(idx / GRID_W);
    for (let d = 0; d < dirs.length; d++) {
      const nx = cx + dirs[d][0];
      const ny = cy + dirs[d][1];
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
      const nIdx = ny * GRID_W + nx;
      if (inflated[nIdx] !== 0 || closed[nIdx] !== 0) continue;
      const penalty = softZone[nIdx] !== 0 ? 1.8 : 0.0;
      const ng = gScore[idx] + dirs[d][2] + penalty;
      if (ng < gScore[nIdx]) {
        gScore[nIdx] = ng;
        cameFrom[nIdx] = idx;
        const h = Math.hypot(gcx - nx, gcy - ny);
        pushHeap({ f: ng + h, idx: nIdx });
      }
    }
  }

  if (!found) {
    return [startXY, [0.5, -1.0], [0.5, 0.8], goalXY];
  }

  const cells: Array<[number, number]> = [];
  let cur = goalIdx;
  while (cur !== -1 && cur !== startIdx) {
    cells.push([cur % GRID_W, Math.floor(cur / GRID_W)]);
    cur = cameFrom[cur];
  }
  cells.push([scx, scy]);
  cells.reverse();

  const worldPts: Array<[number, number]> = cells.map(([x, y]) => [
    GRID_ORIGIN_X + (x + 0.5) * GRID_RES,
    GRID_ORIGIN_Y + (y + 0.5) * GRID_RES,
  ]);
  const stride = Math.max(1, Math.floor(worldPts.length / 22));
  const sampled: Array<[number, number]> = [];
  for (let i = 0; i < worldPts.length; i += stride) {
    sampled.push(worldPts[i]);
  }
  const last = worldPts[worldPts.length - 1];
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }
  return sampled;
}

function stepDifferentialDrive(
  rx: number,
  ry: number,
  yaw: number,
  targetX: number,
  targetY: number,
  maxV: number,
  maxW: number,
  dt: number
): { rx: number; ry: number; yaw: number; arrived: boolean } {
  const dx = targetX - rx;
  const dy = targetY - ry;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-4) return { rx, ry, yaw, arrived: true };

  const desiredYaw = Math.atan2(dy, dx);
  const errYaw = wrapAngle(desiredYaw - yaw);
  const yawStep = Math.max(-maxW * dt, Math.min(maxW * dt, errYaw * 7.0 * dt));
  const newYaw = wrapAngle(yaw + yawStep);
  const absErr = Math.abs(errYaw);
  const alignFactor = absErr > 0.35 ? 0.0 : Math.cos(absErr);
  const stepDist = Math.min(dist, maxV * dt * alignFactor);
  const newRx = rx + stepDist * Math.cos(newYaw);
  const newRy = ry + stepDist * Math.sin(newYaw);
  return { rx: newRx, ry: newRy, yaw: newYaw, arrived: dist < 0.12 };
}

export const ARM_BASE_HEIGHT = 0.24;
export const ARM_SHOULDER_OFFSET = 0.22;
export const ARM_L1 = 0.38;
export const ARM_L2 = 0.36;
export const ARM_EE_OFFSET = 0.14;

export function solveArmIK(
  rx: number,
  ry: number,
  yaw: number,
  targetWorld: [number, number, number],
  gripperOpening: number,
  gripperState: 'OPEN' | 'LOCKED'
): ArmPose {
  const dxW = targetWorld[0] - rx;
  const dyW = targetWorld[1] - ry;
  const cy = Math.cos(-yaw);
  const sy = Math.sin(-yaw);
  const lx = dxW * cy - dyW * sy;
  const ly = dxW * sy + dyW * cy;

  const j1 = Math.atan2(ly, lx);
  const r = Math.hypot(lx, ly);
  const zShoulder = ARM_BASE_HEIGHT + ARM_SHOULDER_OFFSET;
  const zWristCenter = targetWorld[2] + ARM_EE_OFFSET;
  const dz = zWristCenter - zShoulder;

  const dRaw = Math.hypot(r, dz);
  const d = Math.max(0.08, Math.min(ARM_L1 + ARM_L2 - 0.015, dRaw));
  const thetaTarget = Math.atan2(r, dz);

  const cosPhi = Math.max(
    -1.0,
    Math.min(1.0, (ARM_L1 * ARM_L1 + d * d - ARM_L2 * ARM_L2) / (2.0 * ARM_L1 * d))
  );
  const phi = Math.acos(cosPhi);
  const qShoulder = thetaTarget - phi;

  const cosInner = Math.max(
    -1.0,
    Math.min(1.0, (ARM_L1 * ARM_L1 + ARM_L2 * ARM_L2 - d * d) / (2.0 * ARM_L1 * ARM_L2))
  );
  const innerAngle = Math.acos(cosInner);
  const qElbow = Math.PI - innerAngle;
  const qWristPitch = Math.PI - (qShoulder + qElbow);

  const rWrist = ARM_L1 * Math.sin(qShoulder) + ARM_L2 * Math.sin(qShoulder + qElbow);
  const zWrist = zShoulder + ARM_L1 * Math.cos(qShoulder) + ARM_L2 * Math.cos(qShoulder + qElbow);
  const zEE = zWrist - ARM_EE_OFFSET;
  const worldYaw = yaw + j1;
  const eeWorld: [number, number, number] = [
    rx + rWrist * Math.cos(worldYaw),
    ry + rWrist * Math.sin(worldYaw),
    zEE,
  ];

  return {
    joints: [j1, qShoulder, 0.0, -qElbow, 0.0, qWristPitch, 0.78 - j1 * 0.25],
    gripperOpening,
    gripperState,
    eeWorld,
  };
}

export function buildSimulationTimeline(
  layoutId: LayoutId = 'open-space',
  customScene?: CustomSceneOptions
): SimFrameState[] {
  const layout = LAYOUT_CONFIGS[layoutId];
  const customObstacles = customScene?.customObstacles ?? [];
  const dropOffPos: [number, number] = customScene?.dropOffPos
    ? [customScene.dropOffPos[0], customScene.dropOffPos[1]]
    : [...SORTING_BIN_POS];
  const sceneBoxes = getEffectiveSceneBoxes(layoutId, customObstacles, dropOffPos);
  const timeline: SimFrameState[] = [];

  let rx = layout.startPose[0];
  let ry = layout.startPose[1];
  let yaw = layout.startPose[2];
  const initYaw = layout.startPose[2];

  const logOdds = new Float32Array(GRID_W * GRID_H);
  const exploreWps = layout.exploreWaypoints;
  let exploreIdx = 0;
  let blockedFrames = 0;
  let astarPath: Array<[number, number]> = [];
  let astarIdx = 0;
  let dropPath: Array<[number, number]> = [];
  let dropIdx = 0;
  let dropNavSpeed = 2.6;
  let dropApproachPose: [number, number, number] = [...PARK_POSE];
  const odomHistory: Array<[number, number]> = [[rx, ry]];

  let cubePos: [number, number, number] = [...INITIAL_CUBE_POS];
  let cubeLocked = false;
  let lockedTarget3D: [number, number, number] | null = null;

  const stowInitPose = solveArmIK(
    rx,
    ry,
    yaw,
    [rx + 0.18 * Math.cos(yaw), ry + 0.18 * Math.sin(yaw), 0.72],
    0.04,
    'OPEN'
  );
  const stowJoints: [number, number, number, number, number, number, number] = [...stowInitPose.joints];

  const c1 = STAGE_COUNTS[0];
  const c2 = c1 + STAGE_COUNTS[1];
  const c3 = c2 + STAGE_COUNTS[2];
  const c4 = c3 + STAGE_COUNTS[3];

  const dt = 1.0 / FPS;
  const inflation = layoutId === 'open-space' ? 5 : 4;
  let batteryPct = 99.4;
  let smoothedCurrentA = 2.4;
  let prevRx = rx;
  let prevRy = ry;
  let prevYaw = yaw;
  let prevJoints = [...stowJoints];
  let astarNavSpeed = 2.2;

  for (let sf = 0; sf < SIM_FRAMES; sf++) {
    let stageNum: 1 | 2 | 3 | 4 | 5 = 1;
    let localF = sf;
    let stageBanner = 'STAGE 1: ENV & 360 LIDAR SENSOR INIT';

    if (sf < c1) {
      stageNum = 1;
      localF = sf;
      stageBanner = 'STAGE 1: ENV & 360 LIDAR SENSOR INIT';
    } else if (sf < c2) {
      stageNum = 2;
      localF = sf - c1;
      stageBanner = 'STAGE 2: REAL-TIME LIDAR SLAM MAPPING';
    } else if (sf < c3) {
      stageNum = 3;
      localF = sf - c2;
      stageBanner = 'STAGE 3: A* AUTONOMOUS NAVIGATION';
    } else if (sf < c4) {
      stageNum = 4;
      localF = sf - c3;
      stageBanner = 'STAGE 4: OPENCV 3D VISION TARGET LOCK';
    } else {
      stageNum = 5;
      localF = sf - c4;
      stageBanner = 'STAGE 5: 6-DOF IK GRASP & SORTING';
    }

    if (stageNum === 1) {
      yaw = wrapAngle(initYaw + 0.18 * Math.sin(localF * 0.08));
    } else if (stageNum === 2) {
      if (exploreIdx < exploreWps.length) {
        const [wx, wy] = exploreWps[exploreIdx];
        const step = stepDifferentialDrive(rx, ry, yaw, wx, wy, layout.exploreSpeed, 7.2, dt);
        if (customObstacles.length > 0 && isRobotBlocked(step.rx, step.ry, sceneBoxes, 0.28)) {
          blockedFrames++;
          const tangentYaw = wrapAngle(yaw + 0.35);
          const altRx = rx + 0.08 * Math.cos(tangentYaw);
          const altRy = ry + 0.08 * Math.sin(tangentYaw);
          yaw = tangentYaw;
          if (!isRobotBlocked(altRx, altRy, sceneBoxes, 0.28)) {
            rx = altRx;
            ry = altRy;
          }
          if (blockedFrames > 14) {
            exploreIdx++;
            blockedFrames = 0;
          }
        } else {
          blockedFrames = 0;
          rx = step.rx;
          ry = step.ry;
          yaw = step.yaw;
          if (step.arrived) exploreIdx++;
        }
        odomHistory.push([rx, ry]);
      }
    } else if (stageNum === 3) {
      if (localF === 0) {
        astarPath = planAStar(logOdds, [rx, ry], [PARK_POSE[0], PARK_POSE[1]], inflation);
        astarIdx = astarPath.length > 1 ? 1 : 0;
        let pathLen = 0;
        for (let p = 1; p < astarPath.length; p++) {
          pathLen += Math.hypot(
            astarPath[p][0] - astarPath[p - 1][0],
            astarPath[p][1] - astarPath[p - 1][1]
          );
        }
        astarNavSpeed = Math.max(2.2, Math.min(4.8, (pathLen + 2.2) / 3.2));
      }
      if (localF < STAGE_COUNTS[2] - 20 && astarIdx < astarPath.length) {
        const [wx, wy] = astarPath[astarIdx];
        const step = stepDifferentialDrive(rx, ry, yaw, wx, wy, astarNavSpeed, 7.2, dt);
        if (customObstacles.length > 0 && isRobotBlocked(step.rx, step.ry, sceneBoxes, 0.26)) {
          yaw = wrapAngle(yaw + 0.35);
          if (astarIdx < astarPath.length - 1) astarIdx++;
        } else {
          rx = step.rx;
          ry = step.ry;
          yaw = step.yaw;
          if (step.arrived && astarIdx < astarPath.length - 1) astarIdx++;
        }
        odomHistory.push([rx, ry]);
      } else {
        rx += (PARK_POSE[0] - rx) * 0.25;
        ry += (PARK_POSE[1] - ry) * 0.25;
        yaw = wrapAngle(yaw + wrapAngle(PARK_POSE[2] - yaw) * 0.28);
      }
    } else if (stageNum === 4) {
      rx = PARK_POSE[0];
      ry = PARK_POSE[1];
      yaw = PARK_POSE[2];
      lockedTarget3D = [...INITIAL_CUBE_POS];
    } else {
      lockedTarget3D = [...INITIAL_CUBE_POS];
    }

    let armPose: ArmPose = solveArmIK(
      rx,
      ry,
      yaw,
      [rx + 0.18 * Math.cos(yaw), ry + 0.18 * Math.sin(yaw), 0.72],
      0.04,
      'OPEN'
    );

    if (stageNum === 4) {
      const [cx, cy, cz] = INITIAL_CUBE_POS;
      const t = Math.min(1, (localF + 1) / STAGE_COUNTS[3]);
      const s = t * t * (3 - 2 * t);
      const stowWorld: [number, number, number] = [rx + 0.18, ry, 0.72];
      const hoverWorld: [number, number, number] = [cx - 0.10, cy, cz + 0.22];
      const wp: [number, number, number] = [
        stowWorld[0] + (hoverWorld[0] - stowWorld[0]) * s,
        stowWorld[1] + (hoverWorld[1] - stowWorld[1]) * s,
        stowWorld[2] + (hoverWorld[2] - stowWorld[2]) * s,
      ];
      armPose = solveArmIK(rx, ry, yaw, wp, 0.04, 'OPEN');
    } else if (stageNum === 5) {
      const [cx, cy, cz] = INITIAL_CUBE_POS;
      const [bx, by] = dropOffPos;
      const directReach = Math.hypot(bx - PARK_POSE[0], by - PARK_POSE[1]) <= 0.68;

      if (directReach) {
        rx = PARK_POSE[0];
        ry = PARK_POSE[1];
        yaw = PARK_POSE[2];
        const hoverWorld: [number, number, number] = [cx - 0.10, cy, cz + 0.22];
        const preGrasp: [number, number, number] = [cx, cy, cz + 0.15];
        let wp: [number, number, number];
        let gripperOpening = 0.04;
        let gripperState: 'OPEN' | 'LOCKED' = 'OPEN';

        if (localF < 24) {
          const t = (localF + 1) / 24.0;
          const s = t * t * (3 - 2 * t);
          wp = [
            hoverWorld[0] + (preGrasp[0] - hoverWorld[0]) * s,
            hoverWorld[1] + (preGrasp[1] - hoverWorld[1]) * s,
            hoverWorld[2] + (preGrasp[2] - hoverWorld[2]) * s,
          ];
        } else if (localF < 50) {
          const t = (localF - 24 + 1) / 26.0;
          const s = t * t * (3 - 2 * t);
          wp = [cx, cy, cz + 0.15 - 0.145 * s];
        } else if (localF < 68) {
          const t = (localF - 50 + 1) / 18.0;
          wp = [cx, cy, cz + 0.005];
          gripperOpening = 0.04 - 0.015 * Math.min(1, t * 2);
          gripperState = 'LOCKED';
          if (localF >= 55) cubeLocked = true;
        } else if (localF < 92) {
          const t = (localF - 68 + 1) / 24.0;
          const s = t * t * (3 - 2 * t);
          wp = [cx, cy, cz + 0.005 + 0.27 * s];
          gripperOpening = 0.025;
          gripperState = 'LOCKED';
          cubeLocked = true;
        } else if (localF < 122) {
          const t = (localF - 92 + 1) / 30.0;
          const s = t * t * (3 - 2 * t);
          wp = [
            cx + (bx - cx) * s,
            cy + (by - cy) * s,
            cz + 0.275 + 0.045 * Math.sin(Math.PI * s),
          ];
          gripperOpening = 0.025;
          gripperState = 'LOCKED';
          cubeLocked = true;
        } else if (localF < 135) {
          const t = (localF - 122 + 1) / 13.0;
          const s = t * t * (3 - 2 * t);
          wp = [bx, by, cz + 0.275 - 0.335 * s];
          gripperOpening = 0.025;
          gripperState = 'LOCKED';
          cubeLocked = true;
        } else if (localF < 143) {
          const t = (localF - 135 + 1) / 8.0;
          wp = [bx, by, cz - 0.06];
          gripperOpening = 0.025 + 0.015 * t;
          gripperState = 'OPEN';
          cubeLocked = false;
          const dropZ = Math.max(0.07, cz - 0.06 - 0.35 * t * t);
          cubePos = [bx, by, dropZ];
        } else {
          const t = (localF - 143 + 1) / 7.0;
          const s = t * t * (3 - 2 * t);
          wp = [bx, by, cz - 0.06 + 0.28 * s];
          gripperOpening = 0.04;
          gripperState = 'OPEN';
          cubeLocked = false;
          cubePos = [bx, by, 0.07];
        }

        armPose = solveArmIK(rx, ry, yaw, wp, gripperOpening, gripperState);
        if (cubeLocked) {
          cubePos = [armPose.eeWorld[0], armPose.eeWorld[1], armPose.eeWorld[2] + 0.01];
        }
      } else {
        if (localF === 0) {
          const candidates: Array<[number, number]> = [
            [bx - 0.52, by],
            [bx + 0.52, by],
            [bx, by - 0.52],
            [bx, by + 0.52],
          ];
          let chosen: [number, number] = [bx - 0.52, by];
          for (const cand of candidates) {
            if (
              Math.abs(cand[0]) < 3.5 &&
              Math.abs(cand[1]) < 2.55 &&
              !isRobotBlocked(cand[0], cand[1], sceneBoxes, 0.28)
            ) {
              chosen = cand;
              break;
            }
          }
          dropApproachPose = [chosen[0], chosen[1], Math.atan2(by - chosen[1], bx - chosen[0])];
          dropPath = planAStar(
            logOdds,
            [PARK_POSE[0], PARK_POSE[1]],
            [chosen[0], chosen[1]],
            inflation
          );
          dropIdx = dropPath.length > 1 ? 1 : 0;
          let dLen = 0;
          for (let p = 1; p < dropPath.length; p++) {
            dLen += Math.hypot(
              dropPath[p][0] - dropPath[p - 1][0],
              dropPath[p][1] - dropPath[p - 1][1]
            );
          }
          dropNavSpeed = Math.max(2.4, Math.min(5.2, (dLen + 1.5) / 1.7));
        }

        const hoverWorld: [number, number, number] = [cx - 0.10, cy, cz + 0.22];
        const preGrasp: [number, number, number] = [cx, cy, cz + 0.15];
        let wp: [number, number, number];
        let gripperOpening = 0.04;
        let gripperState: 'OPEN' | 'LOCKED' = 'OPEN';

        if (localF < 18) {
          rx = PARK_POSE[0];
          ry = PARK_POSE[1];
          yaw = PARK_POSE[2];
          const t = (localF + 1) / 18.0;
          const s = t * t * (3 - 2 * t);
          wp = [
            hoverWorld[0] + (preGrasp[0] - hoverWorld[0]) * s,
            hoverWorld[1] + (preGrasp[1] - hoverWorld[1]) * s,
            hoverWorld[2] + (preGrasp[2] - hoverWorld[2]) * s,
          ];
        } else if (localF < 36) {
          const t = (localF - 18 + 1) / 18.0;
          const s = t * t * (3 - 2 * t);
          wp = [cx, cy, cz + 0.15 - 0.145 * s];
        } else if (localF < 48) {
          const t = (localF - 36 + 1) / 12.0;
          wp = [cx, cy, cz + 0.005];
          gripperOpening = 0.04 - 0.015 * Math.min(1, t * 2);
          gripperState = 'LOCKED';
          if (localF >= 40) cubeLocked = true;
        } else if (localF < 62) {
          const t = (localF - 48 + 1) / 14.0;
          const s = t * t * (3 - 2 * t);
          wp = [cx, cy, cz + 0.005 + 0.26 * s];
          gripperOpening = 0.025;
          gripperState = 'LOCKED';
          cubeLocked = true;
        } else if (localF < 118) {
          if (localF < 110 && dropIdx < dropPath.length) {
            const [wx, wy] = dropPath[dropIdx];
            const step = stepDifferentialDrive(rx, ry, yaw, wx, wy, dropNavSpeed, 7.6, dt);
            rx = step.rx;
            ry = step.ry;
            yaw = step.yaw;
            if (step.arrived && dropIdx < dropPath.length - 1) dropIdx++;
            odomHistory.push([rx, ry]);
          } else {
            rx += (dropApproachPose[0] - rx) * 0.28;
            ry += (dropApproachPose[1] - ry) * 0.28;
            yaw = wrapAngle(yaw + wrapAngle(dropApproachPose[2] - yaw) * 0.32);
          }
          wp = [rx + 0.38 * Math.cos(yaw), ry + 0.38 * Math.sin(yaw), 0.72];
          gripperOpening = 0.025;
          gripperState = 'LOCKED';
          cubeLocked = true;
        } else if (localF < 135) {
          rx = dropApproachPose[0];
          ry = dropApproachPose[1];
          yaw = dropApproachPose[2];
          const t = (localF - 118 + 1) / 17.0;
          const s = t * t * (3 - 2 * t);
          const carryPt: [number, number, number] = [
            rx + 0.38 * Math.cos(yaw),
            ry + 0.38 * Math.sin(yaw),
            0.72,
          ];
          wp = [
            carryPt[0] + (bx - carryPt[0]) * s,
            carryPt[1] + (by - carryPt[1]) * s,
            carryPt[2] + (0.34 - carryPt[2]) * s,
          ];
          gripperOpening = 0.025;
          gripperState = 'LOCKED';
          cubeLocked = true;
        } else if (localF < 143) {
          const t = (localF - 135 + 1) / 8.0;
          wp = [bx, by, 0.34];
          gripperOpening = 0.025 + 0.015 * t;
          gripperState = 'OPEN';
          cubeLocked = false;
          const dropZ = Math.max(0.07, 0.34 - 0.27 * t * t);
          cubePos = [bx, by, dropZ];
        } else {
          const t = (localF - 143 + 1) / 7.0;
          const s = t * t * (3 - 2 * t);
          wp = [bx, by, 0.34 + 0.30 * s];
          gripperOpening = 0.04;
          gripperState = 'OPEN';
          cubeLocked = false;
          cubePos = [bx, by, 0.07];
        }

        armPose = solveArmIK(rx, ry, yaw, wp, gripperOpening, gripperState);
        if (cubeLocked) {
          cubePos = [armPose.eeWorld[0], armPose.eeWorld[1], armPose.eeWorld[2] + 0.01];
        }
      }
    }

    const lidar = castLidar360(rx, ry, yaw, sceneBoxes);
    updateSlamGrid(logOdds, rx, ry, lidar.hits, lidar.hitFlags);

    let knownCount = 0;
    for (let i = 0; i < logOdds.length; i++) {
      if (Math.abs(logOdds[i]) > 0.35) knownCount++;
    }
    const coveragePct = Math.min(98.4, (100.0 * knownCount) / (GRID_W * GRID_H * 0.78));

    const linSpeed = Math.hypot(rx - prevRx, ry - prevRy) / dt;
    const angSpeed = Math.abs(wrapAngle(yaw - prevYaw)) / dt;
    let armVel = 0;
    for (let j = 0; j < 7; j++) {
      armVel += Math.abs(armPose.joints[j] - prevJoints[j]) / dt;
    }
    prevRx = rx;
    prevRy = ry;
    prevYaw = yaw;
    prevJoints = [...armPose.joints];

    const baseElectronicsA = 1.85;
    const lidarSpinupA = stageNum === 1 ? 1.15 * Math.exp(-localF / 22.0) : 0.25;
    const driveLoadA = linSpeed * 1.48 + angSpeed * 0.92;
    const armLoadA =
      armVel * 1.35 +
      (cubeLocked ? 3.85 : 0.0) +
      (stageNum === 5 && armPose.gripperState === 'LOCKED' ? 1.1 : 0.0);
    const visionLoadA = stageNum === 4 ? 0.55 : 0.0;
    const rawCurrentA = Math.min(
      15.2,
      baseElectronicsA + lidarSpinupA + driveLoadA + armLoadA + visionLoadA
    );
    smoothedCurrentA = smoothedCurrentA * 0.72 + rawCurrentA * 0.28;
    batteryPct = Math.max(8.0, batteryPct - smoothedCurrentA * 0.0222);

    const proximityWarning =
      (stageNum === 2 || stageNum === 3) &&
      (lidar.frontMinD < CRITICAL_LIDAR_DIST || lidar.minD < 0.40);

    timeline.push({
      simFrame: sf,
      stageNum,
      stageBanner,
      layoutId,
      layoutName: layout.name,
      rx,
      ry,
      yaw,
      lidarStarts: lidar.starts,
      lidarHits: lidar.hits,
      lidarDists: lidar.dists,
      lidarHitFlags: lidar.hitFlags,
      minLidar: lidar.minD,
      frontMinLidar: lidar.frontMinD,
      proximityWarning,
      slamGrid: new Float32Array(logOdds),
      coveragePct,
      odomPath: odomHistory.slice(),
      astarPath: astarPath.slice(),
      showAstar: stageNum === 3,
      arm: armPose,
      cubePos: [...cubePos],
      cubeLocked,
      targetLocked3D: lockedTarget3D ? [...lockedTarget3D] : null,
      batteryPct,
      motorCurrentA: smoothedCurrentA,
      customObstacles,
      dropOffPos,
    });
  }

  return timeline;
}
