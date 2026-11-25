export interface PointCharge {
  id: string;
  x: number; // meters
  y: number; // meters
  q: number; // microcoulombs (μC)
}

export interface ChargeColumn {
  id: string;
  x: number; // meters (infinite column along y-axis at this x)
  q: number; // charge density parameter (-5.0 to +5.0)
  potentialVolts?: number; // fixed electric potential in Volts (capacitor mode)
}

export type SimulationModel = 'point' | 'uniform';
export type FieldDisplayMode = 'none' | 'lines' | 'vectors' | 'both';
export type ToolMode = 'select' | 'add-positive' | 'add-negative';
export type VectorScaleMode = 'logarithmic' | 'uniform';

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ElectricFieldSample {
  ex: number; // N/C
  ey: number; // N/C
  magnitude: number; // N/C
}

export interface FieldLineArrow {
  x: number;
  y: number;
  angle: number; // radians in world space
}

export interface FieldLine {
  points: Array<{ x: number; y: number }>;
  arrows: FieldLineArrow[];
}

export interface ContourLevelData {
  levelVolts: number;
  label: string;
  segments: Float32Array; // [x1, y1, x2, y2, ...]
  segmentCount: number;
  labelPos: { x: number; y: number } | null;
}

export interface PresetScenario {
  id: string;
  name: string;
  subtitle: string;
  charges: Array<{ x: number; y: number; q: number }>;
}

// Coulomb constant scaled for q in μC (10^-6 C) and r in m:
// k0 * 10^-6 = 8.98755e9 * 1e-6 = 8987.55 N·m²/(C·μC)
export const K_MICRO = 8987.55;

export const CHARGE_RADIUS_WORLD = 0.24;

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'single',
    name: '単一電荷',
    subtitle: '+2 μC',
    charges: [{ x: 0, y: 0, q: 2 }],
  },
  {
    id: 'dipole',
    name: '双極子',
    subtitle: '+2 μC と −2 μC',
    charges: [
      { x: -2, y: 0, q: 2 },
      { x: 2, y: 0, q: -2 },
    ],
  },
  {
    id: 'same-sign',
    name: '同符号',
    subtitle: '+2 μC と +2 μC',
    charges: [
      { x: -2, y: 0, q: 2 },
      { x: 2, y: 0, q: 2 },
    ],
  },
  {
    id: 'unequal',
    name: '電気量比',
    subtitle: '+3 μC と −1 μC',
    charges: [
      { x: -2, y: 0, q: 3 },
      { x: 2, y: 0, q: -1 },
    ],
  },
];

export interface UniformPresetScenario {
  id: string;
  name: string;
  subtitle: string;
  columns: Array<{ x: number; q: number; potentialVolts?: number }>;
}

export const UNIFORM_PRESET_SCENARIOS: UniformPresetScenario[] = [
  {
    id: 'single-pos',
    name: '正の列',
    subtitle: '+2.0',
    columns: [{ x: 0, q: 2 }],
  },
  {
    id: 'capacitor',
    name: 'コンデンサー',
    subtitle: '+100 V と −100 V',
    columns: [
      { x: -2, q: 2, potentialVolts: 100 },
      { x: 2, q: -2, potentialVolts: -100 },
    ],
  },
  {
    id: 'single-neg',
    name: '負の列',
    subtitle: '−2.0',
    columns: [{ x: 0, q: -2 }],
  },
  {
    id: 'same-plates',
    name: '同符号の列',
    subtitle: '+2.0 と +2.0',
    columns: [
      { x: -2, q: 2 },
      { x: 2, q: 2 },
    ],
  },
];

// Uniform electric field strength per unit charge density on each side of a single column:
// 12.5 V/m per unit -> single +2.0 has E = 25 V/m (V = ∓200 V at x = ±8 m);
// capacitor (+100 V, -100 V) at x = ±2 m (d = 4 m) has E = 50 V/m and q = ±2.0.
export const PLATE_E_PER_UNIT = 12.5;

// Maps electric potential V [Volts] linearly to vertical 3D V-axis height:
// Point-charge mode: 7000 V/unit up to ±9.0 units (±63 kV).
// Uniform-field mode: 25 V/unit so ±200 V maps cleanly to ±8.0 units (max ±225 V).
export const V_AXIS_VOLTS_PER_UNIT = 7000;
export const UNIFORM_V_AXIS_VOLTS_PER_UNIT = 25;
export const V_AXIS_MAX_HEIGHT = 9.0;

export function potentialToHeight(volts: number, isUniform = false): number {
  const scale = isUniform ? UNIFORM_V_AXIS_VOLTS_PER_UNIT : V_AXIS_VOLTS_PER_UNIT;
  const h = volts / scale;
  return Math.max(-V_AXIS_MAX_HEIGHT, Math.min(V_AXIS_MAX_HEIGHT, h));
}

export function evaluateUniformField(
  x: number,
  columns: ChargeColumn[]
): ElectricFieldSample {
  let ex = 0;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (Math.abs(col.q) < 0.05) continue;
    const dx = x - col.x;
    if (Math.abs(dx) < 1e-6) continue;
    ex += PLATE_E_PER_UNIT * col.q * (dx > 0 ? 1 : -1);
  }
  return {
    ex,
    ey: 0,
    magnitude: Math.abs(ex),
  };
}

// Reference potential is strictly V = 0 at the origin (x = 0, y = 0).
export function evaluateUniformPotential(
  x: number,
  columns: ChargeColumn[]
): number {
  let v = 0;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (Math.abs(col.q) < 0.05) continue;
    v += -PLATE_E_PER_UNIT * col.q * (Math.abs(x - col.x) - Math.abs(col.x));
  }
  return v;
}

export function resolveCapacitorColumns(
  columns: ChargeColumn[]
): ChargeColumn[] {
  if (columns.length !== 2) return columns;
  const [c0, c1] = columns;
  if (c0.potentialVolts === undefined || c1.potentialVolts === undefined) {
    return columns;
  }
  const left = c0.x <= c1.x ? c0 : c1;
  const right = c0.x <= c1.x ? c1 : c0;
  const d = Math.max(0.5, right.x - left.x);
  const vLeft = left.potentialVolts!;
  const vRight = right.potentialVolts!;
  const qLeft = (vLeft - vRight) / (2 * PLATE_E_PER_UNIT * d);
  const qRight = -qLeft;

  return columns.map((col) => ({
    ...col,
    q: col.id === left.id ? qLeft : qRight,
  }));
}

export function evaluateCapacitorPotential(
  x: number,
  columns: ChargeColumn[]
): number {
  if (columns.length !== 2) return 0;
  const [c0, c1] = columns;
  const left = c0.x <= c1.x ? c0 : c1;
  const right = c0.x <= c1.x ? c1 : c0;
  const vLeft = left.potentialVolts ?? 0;
  const vRight = right.potentialVolts ?? 0;
  if (x <= left.x) return vLeft;
  if (x >= right.x) return vRight;
  const d = right.x - left.x;
  if (d < 1e-6) return 0.5 * (vLeft + vRight);
  return vLeft + ((vRight - vLeft) / d) * (x - left.x);
}

export function evaluateField(
  x: number,
  y: number,
  charges: PointCharge[]
): ElectricFieldSample {
  let ex = 0;
  let ey = 0;

  for (let i = 0; i < charges.length; i++) {
    const c = charges[i];
    if (c.q === 0) continue;
    const dx = x - c.x;
    const dy = y - c.y;
    const r2 = dx * dx + dy * dy;
    if (r2 < 1e-6) continue;
    const invR3 = 1 / (r2 * Math.sqrt(r2));
    const factor = K_MICRO * c.q * invR3;
    ex += factor * dx;
    ey += factor * dy;
  }

  return {
    ex,
    ey,
    magnitude: Math.hypot(ex, ey),
  };
}

export function evaluatePotential(
  x: number,
  y: number,
  charges: PointCharge[]
): number {
  let v = 0;
  for (let i = 0; i < charges.length; i++) {
    const c = charges[i];
    if (c.q === 0) continue;
    const dx = x - c.x;
    const dy = y - c.y;
    const r = Math.hypot(dx, dy);
    if (r < 0.05) {
      // Soft cap right at charge center to prevent Inf/NaN
      v += (K_MICRO * c.q) / 0.05;
    } else {
      v += (K_MICRO * c.q) / r;
    }
  }
  return v;
}

function normalizedFieldDir(
  x: number,
  y: number,
  charges: PointCharge[],
  dirSign: 1 | -1
): { ux: number; uy: number; mag: number } | null {
  const { ex, ey, magnitude } = evaluateField(x, y, charges);
  if (magnitude < 1e-3) return null;
  return {
    ux: (dirSign * ex) / magnitude,
    uy: (dirSign * ey) / magnitude,
    mag: magnitude,
  };
}

function stepRK4(
  x: number,
  y: number,
  charges: PointCharge[],
  dirSign: 1 | -1,
  ds: number
): { x: number; y: number } | null {
  const k1 = normalizedFieldDir(x, y, charges, dirSign);
  if (!k1) return null;

  const k2 = normalizedFieldDir(
    x + 0.5 * ds * k1.ux,
    y + 0.5 * ds * k1.uy,
    charges,
    dirSign
  );
  if (!k2) return null;

  const k3 = normalizedFieldDir(
    x + 0.5 * ds * k2.ux,
    y + 0.5 * ds * k2.uy,
    charges,
    dirSign
  );
  if (!k3) return null;

  const k4 = normalizedFieldDir(
    x + ds * k3.ux,
    y + ds * k3.uy,
    charges,
    dirSign
  );
  if (!k4) return null;

  const vx = (k1.ux + 2 * k2.ux + 2 * k3.ux + k4.ux) / 6;
  const vy = (k1.uy + 2 * k2.uy + 2 * k3.uy + k4.uy) / 6;
  const norm = Math.hypot(vx, vy);
  if (norm < 1e-4) return null;

  return {
    x: x + (ds * vx) / norm,
    y: y + (ds * vy) / norm,
  };
}

function computeBaseAngle(charge: PointCharge, charges: PointCharge[], lineCount: number): number {
  let nearest: PointCharge | null = null;
  let nearestDist = Infinity;
  for (const other of charges) {
    if (other.id === charge.id || other.q === 0) continue;
    const d = Math.hypot(other.x - charge.x, other.y - charge.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = other;
    }
  }
  if (!nearest) return 0;
  const angleToNearest = Math.atan2(nearest.y - charge.y, nearest.x - charge.x);
  // Same-sign charges repel along the connecting axis with a saddle point:
  // offset by half a sector so field lines symmetrically curve around the null point.
  return nearest.q * charge.q > 0 ? angleToNearest + Math.PI / lineCount : angleToNearest;
}

function buildArrowsForLine(
  points: Array<{ x: number; y: number }>,
  bounds: WorldBounds
): FieldLineArrow[] {
  if (points.length < 4) return [];

  // Compute cumulative arc length inside visible viewport (with small padding)
  const arrows: FieldLineArrow[] = [];
  let totalLen = 0;
  const cumLen = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) {
    totalLen += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    cumLen[i] = totalLen;
  }

  if (totalLen < 0.6) return [];

  // Place arrows roughly every 2.2 m along the curve, avoiding immediate charge centers
  const spacing = 2.2;
  let nextTarget = Math.min(1.1, totalLen * 0.45);

  for (let i = 1; i < points.length - 1; i++) {
    if (cumLen[i] >= nextTarget) {
      const p = points[i];
      const prev = points[i - 1];
      const next = points[i + 1];
      if (
        p.x >= bounds.minX + 0.15 &&
        p.x <= bounds.maxX - 0.15 &&
        p.y >= bounds.minY + 0.15 &&
        p.y <= bounds.maxY - 0.15
      ) {
        arrows.push({
          x: p.x,
          y: p.y,
          angle: Math.atan2(next.y - prev.y, next.x - prev.x),
        });
      }
      nextTarget = cumLen[i] + spacing;
    }
  }

  // Ensure at least one arrow if the line is short but visible
  if (arrows.length === 0 && points.length >= 4) {
    const mid = Math.floor(points.length / 2);
    const p = points[mid];
    if (
      p.x >= bounds.minX &&
      p.x <= bounds.maxX &&
      p.y >= bounds.minY &&
      p.y <= bounds.maxY
    ) {
      arrows.push({
        x: p.x,
        y: p.y,
        angle: Math.atan2(
          points[mid + 1].y - points[mid - 1].y,
          points[mid + 1].x - points[mid - 1].x
        ),
      });
    }
  }

  return arrows;
}

export function traceFieldLines(
  charges: PointCharge[],
  bounds: WorldBounds
): FieldLine[] {
  const activeCharges = charges.filter((c) => Math.abs(c.q) >= 0.05);
  if (activeCharges.length === 0) return [];

  const LINES_PER_UC = 8;
  const SEED_RADIUS = 0.23;
  const STOP_RADIUS = 0.21;
  const STEP_SIZE = 0.08;
  const MAX_STEPS = 600;
  const MARGIN = 2.5;

  const traceMinX = bounds.minX - MARGIN;
  const traceMaxX = bounds.maxX + MARGIN;
  const traceMinY = bounds.minY - MARGIN;
  const traceMaxY = bounds.maxY + MARGIN;

  const lines: FieldLine[] = [];

  // Track which angular bins of negative charges have received an incoming forward line
  const negChargeMeta = new Map<
    string,
    { charge: PointCharge; count: number; baseAngle: number; covered: boolean[] }
  >();

  for (const c of activeCharges) {
    if (c.q < 0) {
      const count = Math.max(4, Math.min(40, Math.round(LINES_PER_UC * Math.abs(c.q))));
      negChargeMeta.set(c.id, {
        charge: c,
        count,
        baseAngle: computeBaseAngle(c, activeCharges, count),
        covered: new Array(count).fill(false),
      });
    }
  }

  // Pass 1: Trace forward (+E) from positive charges
  for (const c of activeCharges) {
    if (c.q <= 0) continue;
    const count = Math.max(4, Math.min(40, Math.round(LINES_PER_UC * Math.abs(c.q))));
    const baseAngle = computeBaseAngle(c, activeCharges, count);

    for (let k = 0; k < count; k++) {
      const theta = baseAngle + (2 * Math.PI * k) / count;
      let cx = c.x + SEED_RADIUS * Math.cos(theta);
      let cy = c.y + SEED_RADIUS * Math.sin(theta);

      const pts: Array<{ x: number; y: number }> = [
        { x: c.x + 0.16 * Math.cos(theta), y: c.y + 0.16 * Math.sin(theta) },
        { x: cx, y: cy },
      ];

      for (let step = 0; step < MAX_STEPS; step++) {
        const next = stepRK4(cx, cy, activeCharges, 1, STEP_SIZE);
        if (!next) break;
        cx = next.x;
        cy = next.y;
        pts.push({ x: cx, y: cy });

        if (cx < traceMinX || cx > traceMaxX || cy < traceMinY || cy > traceMaxY) {
          break;
        }

        // Check if terminated on a negative charge
        let hitNeg = false;
        for (const other of activeCharges) {
          if (other.q >= 0) continue;
          const dist = Math.hypot(cx - other.x, cy - other.y);
          if (dist <= STOP_RADIUS) {
            const meta = negChargeMeta.get(other.id);
            if (meta) {
              const arrivalAngle = Math.atan2(cy - other.y, cx - other.x);
              let rel = (arrivalAngle - meta.baseAngle) % (2 * Math.PI);
              if (rel < 0) rel += 2 * Math.PI;
              const bin = Math.round((rel / (2 * Math.PI)) * meta.count) % meta.count;
              meta.covered[bin] = true;
            }
            pts.push({
              x: other.x + 0.16 * Math.cos(Math.atan2(cy - other.y, cx - other.x)),
              y: other.y + 0.16 * Math.sin(Math.atan2(cy - other.y, cx - other.x)),
            });
            hitNeg = true;
            break;
          }
        }
        if (hitNeg) break;

        // Avoid tiny stagnation loops
        if (step > 8 && step % 6 === 0) {
          const prev = pts[pts.length - 6];
          if (Math.hypot(cx - prev.x, cy - prev.y) < STEP_SIZE * 1.5) {
            break;
          }
        }
      }

      lines.push({
        points: pts,
        arrows: buildArrowsForLine(pts, bounds),
      });
    }
  }

  // Pass 2: Trace backward (-E) from uncovered sectors of negative charges
  for (const meta of negChargeMeta.values()) {
    const { charge: c, count, baseAngle, covered } = meta;
    for (let k = 0; k < count; k++) {
      if (covered[k]) continue;
      const theta = baseAngle + (2 * Math.PI * k) / count;
      let cx = c.x + SEED_RADIUS * Math.cos(theta);
      let cy = c.y + SEED_RADIUS * Math.sin(theta);

      const pts: Array<{ x: number; y: number }> = [
        { x: c.x + 0.16 * Math.cos(theta), y: c.y + 0.16 * Math.sin(theta) },
        { x: cx, y: cy },
      ];

      let hitPositive = false;
      for (let step = 0; step < MAX_STEPS; step++) {
        const next = stepRK4(cx, cy, activeCharges, -1, STEP_SIZE);
        if (!next) break;
        cx = next.x;
        cy = next.y;
        pts.push({ x: cx, y: cy });

        if (cx < traceMinX || cx > traceMaxX || cy < traceMinY || cy > traceMaxY) {
          break;
        }

        for (const other of activeCharges) {
          if (other.q <= 0) continue;
          if (Math.hypot(cx - other.x, cy - other.y) <= STOP_RADIUS) {
            hitPositive = true;
            break;
          }
        }
        if (hitPositive) break;

        if (step > 8 && step % 6 === 0) {
          const prev = pts[pts.length - 6];
          if (Math.hypot(cx - prev.x, cy - prev.y) < STEP_SIZE * 1.5) {
            break;
          }
        }
      }

      // Skip if backward trace hit a positive charge (Pass 1 already emitted its flux)
      if (hitPositive) continue;

      // Reverse so points always run along +E direction
      pts.reverse();
      lines.push({
        points: pts,
        arrows: buildArrowsForLine(pts, bounds),
      });
    }
  }

  return lines;
}

const EQUIPOTENTIAL_LEVELS_KV = [
  -54, -42, -30, -21, -15, -12, -9, -6, -3,
  0,
  3, 6, 9, 12, 15, 21, 30, 42, 54,
];

function formatVoltageLabel(volts: number): string {
  if (Math.abs(volts) < 0.5) return '0 V';
  const sign = volts > 0 ? '+' : '−';
  const absV = Math.abs(volts);
  if (absV < 1000) {
    return `${sign}${Math.round(absV)} V`;
  }
  const absKv = absV / 1000;
  const formatted = Number.isInteger(absKv) ? absKv.toFixed(0) : absKv.toFixed(2).replace(/0$/, '');
  return `${sign}${formatted} kV`;
}

export function computeEquipotentialContours(
  charges: PointCharge[],
  bounds: WorldBounds,
  cols = 108,
  rows = 76
): ContourLevelData[] {
  const activeCharges = charges.filter((c) => Math.abs(c.q) >= 0.05);
  if (activeCharges.length === 0) return [];

  const dx = (bounds.maxX - bounds.minX) / cols;
  const dy = (bounds.maxY - bounds.minY) / rows;

  const stride = cols + 1;
  const gridV = new Float32Array(stride * (rows + 1));
  const nearCharge = new Uint8Array(stride * (rows + 1));

  for (let j = 0; j <= rows; j++) {
    const y = bounds.minY + j * dy;
    for (let i = 0; i <= cols; i++) {
      const x = bounds.minX + i * dx;
      const idx = j * stride + i;
      let v = 0;
      let tooClose = false;
      for (let cIdx = 0; cIdx < activeCharges.length; cIdx++) {
        const c = activeCharges[cIdx];
        const rx = x - c.x;
        const ry = y - c.y;
        const r2 = rx * rx + ry * ry;
        if (r2 < 0.008) {
          tooClose = true;
          v += (K_MICRO * c.q) / Math.sqrt(0.008);
        } else {
          v += (K_MICRO * c.q) / Math.sqrt(r2);
        }
      }
      gridV[idx] = v;
      nearCharge[idx] = tooClose ? 1 : 0;
    }
  }

  const results: ContourLevelData[] = [];
  // Pre-allocate temporary buffer for segments (max ~2 * cols * rows segments)
  const tempBuf = new Float32Array(cols * rows * 8);

  const labelCandidateMinX = bounds.minX + (bounds.maxX - bounds.minX) * 0.12;
  const labelCandidateMaxX = bounds.maxX - (bounds.maxX - bounds.minX) * 0.12;
  const labelCandidateMinY = bounds.minY + (bounds.maxY - bounds.minY) * 0.12;
  const labelCandidateMaxY = bounds.maxY - (bounds.maxY - bounds.minY) * 0.12;

  for (const levelKv of EQUIPOTENTIAL_LEVELS_KV) {
    const level = levelKv * 1000;
    let outIdx = 0;
    let bestLabelPos: { x: number; y: number } | null = null;
    let bestLabelScore = -Infinity;

    for (let j = 0; j < rows; j++) {
      const y0 = bounds.minY + j * dy;
      const y1 = y0 + dy;
      const rowOffset = j * stride;
      const nextRowOffset = (j + 1) * stride;

      for (let i = 0; i < cols; i++) {
        const i00 = rowOffset + i;
        const i10 = i00 + 1;
        const i11 = nextRowOffset + i + 1;
        const i01 = nextRowOffset + i;

        if (
          nearCharge[i00] ||
          nearCharge[i10] ||
          nearCharge[i11] ||
          nearCharge[i01]
        ) {
          continue;
        }

        const v00 = gridV[i00];
        const v10 = gridV[i10];
        const v11 = gridV[i11];
        const v01 = gridV[i01];

        const minV = Math.min(v00, v10, v11, v01);
        const maxV = Math.max(v00, v10, v11, v01);
        if (level < minV || level > maxV) continue;

        let caseIdx = 0;
        if (v00 >= level) caseIdx |= 1;
        if (v10 >= level) caseIdx |= 2;
        if (v11 >= level) caseIdx |= 4;
        if (v01 >= level) caseIdx |= 8;

        if (caseIdx === 0 || caseIdx === 15) continue;

        const x0 = bounds.minX + i * dx;
        const x1 = x0 + dx;

        const interp = (va: number, vb: number) => {
          const denom = vb - va;
          if (Math.abs(denom) < 1e-9) return 0.5;
          return Math.max(0, Math.min(1, (level - va) / denom));
        };

        // Edge points:
        // 0: bottom (x0..x1, y0)
        // 1: right  (x1, y0..y1)
        // 2: top    (x0..x1, y1)
        // 3: left   (x0, y0..y1)
        const e0x = x0 + interp(v00, v10) * dx;
        const e0y = y0;
        const e1x = x1;
        const e1y = y0 + interp(v10, v11) * dy;
        const e2x = x0 + interp(v01, v11) * dx;
        const e2y = y1;
        const e3x = x0;
        const e3y = y0 + interp(v00, v01) * dy;

        const pushSeg = (ax: number, ay: number, bx: number, by: number) => {
          tempBuf[outIdx++] = ax;
          tempBuf[outIdx++] = ay;
          tempBuf[outIdx++] = bx;
          tempBuf[outIdx++] = by;

          const mx = 0.5 * (ax + bx);
          const my = 0.5 * (ay + by);
          if (
            mx > labelCandidateMinX &&
            mx < labelCandidateMaxX &&
            my > labelCandidateMinY &&
            my < labelCandidateMaxY
          ) {
            // Prefer segments that are nearly horizontal and comfortably away from charges
            const horiz = Math.abs(bx - ax) / (Math.hypot(bx - ax, by - ay) + 1e-6);
            let minChargeDist = Infinity;
            for (let cIdx = 0; cIdx < activeCharges.length; cIdx++) {
              const d = Math.hypot(mx - activeCharges[cIdx].x, my - activeCharges[cIdx].y);
              if (d < minChargeDist) minChargeDist = d;
            }
            const score = horiz * 1.5 + Math.min(minChargeDist, 3.0) - Math.abs(mx) * 0.08;
            if (score > bestLabelScore && minChargeDist > 0.65) {
              bestLabelScore = score;
              bestLabelPos = { x: mx, y: my };
            }
          }
        };

        switch (caseIdx) {
          case 1:
          case 14:
            pushSeg(e3x, e3y, e0x, e0y);
            break;
          case 2:
          case 13:
            pushSeg(e0x, e0y, e1x, e1y);
            break;
          case 3:
          case 12:
            pushSeg(e3x, e3y, e1x, e1y);
            break;
          case 4:
          case 11:
            pushSeg(e1x, e1y, e2x, e2y);
            break;
          case 6:
          case 9:
            pushSeg(e0x, e0y, e2x, e2y);
            break;
          case 7:
          case 8:
            pushSeg(e3x, e3y, e2x, e2y);
            break;
          case 5: {
            const centerV = 0.25 * (v00 + v10 + v11 + v01);
            if (centerV >= level) {
              pushSeg(e3x, e3y, e2x, e2y);
              pushSeg(e0x, e0y, e1x, e1y);
            } else {
              pushSeg(e3x, e3y, e0x, e0y);
              pushSeg(e1x, e1y, e2x, e2y);
            }
            break;
          }
          case 10: {
            const centerV = 0.25 * (v00 + v10 + v11 + v01);
            if (centerV >= level) {
              pushSeg(e3x, e3y, e0x, e0y);
              pushSeg(e1x, e1y, e2x, e2y);
            } else {
              pushSeg(e3x, e3y, e2x, e2y);
              pushSeg(e0x, e0y, e1x, e1y);
            }
            break;
          }
        }
      }
    }

    if (outIdx > 0) {
      results.push({
        levelVolts: level,
        label: formatVoltageLabel(level),
        segments: tempBuf.slice(0, outIdx),
        segmentCount: outIdx / 4,
        labelPos: bestLabelPos,
      });
    }
  }

  return results;
}

export function traceUniformFieldLines(
  columns: ChargeColumn[],
  bounds: WorldBounds
): FieldLine[] {
  const active = columns
    .filter((c) => Math.abs(c.q) >= 0.05)
    .slice()
    .sort((a, b) => a.x - b.x);
  if (active.length === 0) return [];

  // Partition x-axis into intervals between sorted columns
  const boundaries: number[] = [bounds.minX];
  for (const col of active) {
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, col.x));
    if (clampedX > boundaries[boundaries.length - 1] + 1e-4) {
      boundaries.push(clampedX);
    }
  }
  if (bounds.maxX > boundaries[boundaries.length - 1] + 1e-4) {
    boundaries.push(bounds.maxX);
  }

  const lines: FieldLine[] = [];
  const baseSpacingPerUnit = 2.0; // spacing = 2.0 / |q_eff| meters

  for (let i = 0; i < boundaries.length - 1; i++) {
    const xStart = boundaries[i];
    const xEnd = boundaries[i + 1];
    const width = xEnd - xStart;
    if (width < 0.25) continue;

    const midX = 0.5 * (xStart + xEnd);
    const sample = evaluateUniformField(midX, active);
    const effUnits = sample.magnitude / PLATE_E_PER_UNIT;
    if (effUnits < 0.05) continue; // Outside capacitor where fields cancel to 0!

    const dy = Math.max(0.25, Math.min(2.5, baseSpacingPerUnit / effUnits));
    const dirSign = sample.ex >= 0 ? 1 : -1;
    const angle = dirSign > 0 ? 0 : Math.PI;

    // Trim slightly from column center spheres so lines terminate cleanly on the column
    const padL = i === 0 ? 0 : 0.22;
    const padR = i === boundaries.length - 2 ? 0 : 0.22;
    const lx0 = xStart + padL;
    const lx1 = xEnd - padR;
    if (lx1 - lx0 < 0.15) continue;

    const maxK = Math.floor((bounds.maxY - 0.25) / dy);
    for (let k = -maxK; k <= maxK; k++) {
      const y = k * dy;
      if (y < bounds.minY + 0.1 || y > bounds.maxY - 0.1) continue;

      const pts =
        dirSign > 0
          ? [
              { x: lx0, y },
              { x: lx1, y },
            ]
          : [
              { x: lx1, y },
              { x: lx0, y },
            ];

      const arrows: FieldLineArrow[] = [];
      const arrowSpacing = 2.8;
      if (lx1 - lx0 < arrowSpacing) {
        arrows.push({ x: 0.5 * (lx0 + lx1), y, angle });
      } else {
        for (let ax = lx0 + 1.2; ax <= lx1 - 1.0; ax += arrowSpacing) {
          arrows.push({ x: ax, y, angle });
        }
      }

      lines.push({ points: pts, arrows });
    }
  }

  return lines;
}

export function computeUniformEquipotentialContours(
  columns: ChargeColumn[],
  bounds: WorldBounds
): ContourLevelData[] {
  const active = columns
    .filter((c) => Math.abs(c.q) >= 0.05)
    .slice()
    .sort((a, b) => a.x - b.x);
  if (active.length === 0) return [];

  const breaks: number[] = [bounds.minX];
  for (const col of active) {
    const cx = Math.max(bounds.minX, Math.min(bounds.maxX, col.x));
    if (cx > breaks[breaks.length - 1] + 1e-4) {
      breaks.push(cx);
    }
  }
  if (bounds.maxX > breaks[breaks.length - 1] + 1e-4) {
    breaks.push(bounds.maxX);
  }

  const levelMap = new Map<number, number[]>();

  for (let i = 0; i < breaks.length - 1; i++) {
    const a = breaks[i];
    const b = breaks[i + 1];
    if (b - a < 1e-4) continue;

    const va = evaluateUniformPotential(a, active);
    const vb = evaluateUniformPotential(b, active);
    const dv = vb - va;
    if (Math.abs(dv) < 0.5) continue; // Flat plateau (E=0)

    const minV = Math.min(va, vb);
    const maxV = Math.max(va, vb);

    for (const level of UNIFORM_CONTOUR_LEVELS_V) {
      if (level < minV - 0.1 || level > maxV + 0.1) continue;
      const t = (level - va) / dv;
      if (t < 0 || t > 1) continue;
      const xStar = a + t * (b - a);

      // Avoid duplicate line right on a boundary already added
      const existing = levelMap.get(level) ?? [];
      let dup = false;
      for (let j = 0; j < existing.length; j += 4) {
        if (Math.abs(existing[j] - xStar) < 0.03) {
          dup = true;
          break;
        }
      }
      if (!dup) {
        existing.push(xStar, bounds.minY, xStar, bounds.maxY);
        levelMap.set(level, existing);
      }
    }
  }

  const results: ContourLevelData[] = [];
  for (const [level, arr] of levelMap.entries()) {
    results.push({
      levelVolts: level,
      label: formatVoltageLabel(level),
      segments: new Float32Array(arr),
      segmentCount: arr.length / 4,
      labelPos: null,
    });
  }
  return results;
}

const UNIFORM_CONTOUR_LEVELS_V = [
  -360, -320, -280, -240,
  -200, -180, -160, -140, -120, -100, -80, -60, -40, -20,
  0,
  20, 40, 60, 80, 100, 120, 140, 160, 180, 200,
  240, 280, 320, 360,
];

export function computeCapacitorEquipotentialContours(
  columns: ChargeColumn[],
  bounds: WorldBounds
): ContourLevelData[] {
  if (columns.length !== 2) return [];
  const [c0, c1] = columns;
  const left = c0.x <= c1.x ? c0 : c1;
  const right = c0.x <= c1.x ? c1 : c0;
  const a = Math.max(bounds.minX, left.x);
  const b = Math.min(bounds.maxX, right.x);
  if (b - a < 1e-4) return [];

  const va = left.potentialVolts ?? 0;
  const vb = right.potentialVolts ?? 0;
  const dv = vb - va;
  if (Math.abs(dv) < 0.5) return [];

  const minV = Math.min(va, vb);
  const maxV = Math.max(va, vb);
  const results: ContourLevelData[] = [];

  for (const level of UNIFORM_CONTOUR_LEVELS_V) {
    if (level <= minV + 0.5 || level >= maxV - 0.5) continue;
    const t = (level - va) / dv;
    if (t <= 0.005 || t >= 0.995) continue;
    const xStar = a + t * (b - a);
    results.push({
      levelVolts: level,
      label: formatVoltageLabel(level),
      segments: new Float32Array([xStar, bounds.minY, xStar, bounds.maxY]),
      segmentCount: 1,
      labelPos: null,
    });
  }
  return results;
}

export function formatScientificJP(value: number, unit: string): string {
  const abs = Math.abs(value);
  if (abs < 1e-6) return `0 ${unit}`;
  if (abs >= 1000 || abs < 0.01) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = value / Math.pow(10, exp);
    return `${mantissa.toFixed(2)} × 10^${exp} ${unit}`;
  }
  return `${value.toFixed(1)} ${unit}`;
}
