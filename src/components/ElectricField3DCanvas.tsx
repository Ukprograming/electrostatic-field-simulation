import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  PointCharge,
  ChargeColumn,
  SimulationModel,
  FieldDisplayMode,
  WorldBounds,
  evaluateField,
  evaluatePotential,
  evaluateUniformField,
  evaluateUniformPotential,
  potentialToHeight,
  V_AXIS_MAX_HEIGHT,
  traceFieldLines,
  traceUniformFieldLines,
  computeEquipotentialContours,
  computeUniformEquipotentialContours,
} from '../physics/electrostatics';

type CameraPreset = 'top' | 'iso' | 'side';

interface ElectricField3DCanvasProps {
  simulationModel: SimulationModel;
  charges: PointCharge[];
  selectedChargeId: string | null;
  columns: ChargeColumn[];
  selectedColumnId: string | null;
  fieldMode: FieldDisplayMode;
  showEquipotentials: boolean;
  showPotentialTint: boolean;
  snapToInteger: boolean;
  onSelectCharge: (id: string | null) => void;
  onMoveCharge: (id: string, x: number, y: number) => void;
  onSelectColumn: (id: string | null) => void;
  onMoveColumn: (id: string, x: number) => void;
}

const DOMAIN_HALF = 16;
const DOMAIN_BOUNDS: WorldBounds = {
  minX: -DOMAIN_HALF,
  maxX: DOMAIN_HALF,
  minY: -DOMAIN_HALF,
  maxY: DOMAIN_HALF,
};

const SURFACE_SEGMENTS = 160;
const VECTOR_RANGE = 15; // integer points from -15..15
const MAX_VECTORS = (VECTOR_RANGE * 2 + 1) * (VECTOR_RANGE * 2 + 1); // 961
const MAX_FIELD_ARROWS = 2000;

// Reusable module-scope math objects (zero GC in render/interaction loops)
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _planeHit = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();
const _tmpColor = new THREE.Color();
const _upVec = new THREE.Vector3(0, 1, 0);
const _dirVec = new THREE.Vector3();
const _quat = new THREE.Quaternion();

function createTextSprite(
  text: string,
  color = '#475569',
  fontSize = 34
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = `600 ${fontSize}px "IBM Plex Mono", "Plus Jakarta Sans", "Noto Sans JP", sans-serif`;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const padX = 18;
  const padY = 10;
  canvas.width = Math.ceil(metrics.width + padX * 2);
  canvas.height = Math.ceil(fontSize * 1.3 + padY * 2);

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.92)';
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const aspect = canvas.width / canvas.height;
  const scaleH = 0.42;
  sprite.scale.set(scaleH * aspect, scaleH, 1);
  return sprite;
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
    if (mat) {
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        const spriteMat = m as THREE.SpriteMaterial;
        if (spriteMat.map) spriteMat.map.dispose();
        m.dispose();
      }
    }
  });
}

function interpolateVectorColor(t: number, out: THREE.Color) {
  const c = Math.max(0, Math.min(1, t));
  if (c < 0.6) {
    const u = c / 0.6;
    out.setRGB(
      (56 + u * (15 - 56)) / 255,
      (139 + u * (23 - 139)) / 255,
      (196 + u * (42 - 196)) / 255
    );
  } else {
    const u = (c - 0.6) / 0.4;
    out.setRGB(
      (15 + u * (185 - 15)) / 255,
      (23 + u * (28 - 23)) / 255,
      (42 + u * (28 - 42)) / 255
    );
  }
}

const _colZero = new THREE.Color(0x94a3b8);
const _colPosLight = new THREE.Color(0xfee2e2);
const _colPosMid = new THREE.Color(0xef4444);
const _colPosDeep = new THREE.Color(0x7f1d1d);
const _colNegLight = new THREE.Color(0xdbeafe);
const _colNegMid = new THREE.Color(0x3b82f6);
const _colNegDeep = new THREE.Color(0x1e3a8a);

function getChargeColor(q: number): THREE.Color {
  if (Math.abs(q) < 0.05) {
    return _colZero.clone();
  }
  const t = Math.max(0, Math.min(1, Math.abs(q) / 5.0));
  const out = new THREE.Color();
  if (q > 0) {
    if (t <= 0.4) {
      out.lerpColors(_colPosLight, _colPosMid, t / 0.4);
    } else {
      out.lerpColors(_colPosMid, _colPosDeep, (t - 0.4) / 0.6);
    }
  } else {
    if (t <= 0.4) {
      out.lerpColors(_colNegLight, _colNegMid, t / 0.4);
    } else {
      out.lerpColors(_colNegMid, _colNegDeep, (t - 0.4) / 0.6);
    }
  }
  return out;
}

export const ElectricField3DCanvas: React.FC<ElectricField3DCanvasProps> = ({
  simulationModel,
  charges,
  selectedChargeId,
  columns,
  selectedColumnId,
  fieldMode,
  showEquipotentials,
  showPotentialTint,
  snapToInteger,
  onSelectCharge,
  onMoveCharge,
  onSelectColumn,
  onMoveColumn,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const propsRef = useRef({
    simulationModel,
    charges,
    selectedChargeId,
    columns,
    selectedColumnId,
    fieldMode,
    showEquipotentials,
    showPotentialTint,
    snapToInteger,
    onSelectCharge,
    onMoveCharge,
    onSelectColumn,
    onMoveColumn,
  });
  propsRef.current = {
    simulationModel,
    charges,
    selectedChargeId,
    columns,
    selectedColumnId,
    fieldMode,
    showEquipotentials,
    showPotentialTint,
    snapToInteger,
    onSelectCharge,
    onMoveCharge,
    onSelectColumn,
    onMoveColumn,
  };

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveringCharge, setHoveringCharge] = useState(false);
  const [activeCamPreset, setActiveCamPreset] = useState<CameraPreset | null>('top');

  const sceneRefs = useRef<{
    requestRender: () => void;
    setCameraPreset: (preset: CameraPreset) => void;
    rebuildPhysics: () => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect software WebGL
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    // 3. Scene & Camera (Default: Overhead Top-Down View)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);

    const rect = container.getBoundingClientRect();
    const initW = Math.max(1, rect.width);
    const initH = Math.max(1, rect.height);
    const camera = new THREE.PerspectiveCamera(44, initW / initH, 0.1, 140);
    camera.position.set(0, 12.4, 0.04);
    renderer.setSize(initW, initH, false);

    // 4. Studio Environment & Lighting
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0xf0f9ff, 0xe2e8f0, 0.92);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
    keyLight.position.set(6, 14, 8);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xe0f2fe, 0.6);
    rimLight.position.set(-8, 6, -6);
    scene.add(rimLight);

    // 5. OrbitControls (iPad: 1-finger rotate, 2-finger pinch zoom + 2-finger swipe pan)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5.5;
    controls.maxDistance = 32;
    controls.minPolarAngle = 0.003;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 1.0;
    controls.target.set(0, 0, 0);
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    // 6. Expanded Base Grid & Thick 3D Coordinate Axes (x, y, V)
    const staticGroup = new THREE.Group();
    scene.add(staticGroup);

    const basePlaneGeo = new THREE.PlaneGeometry(DOMAIN_HALF * 2, DOMAIN_HALF * 2);
    basePlaneGeo.rotateX(-Math.PI / 2);
    const basePlaneMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const basePlane = new THREE.Mesh(basePlaneGeo, basePlaneMat);
    basePlane.position.y = -0.008;
    staticGroup.add(basePlane);

    const gridHelper = new THREE.GridHelper(
      DOMAIN_HALF * 2,
      DOMAIN_HALF * 2,
      0xcbd5e1,
      0xe2e8f0
    );
    gridHelper.position.y = 0;
    staticGroup.add(gridHelper);

    // Thick 3D cylinders for x-axis & y-axis so they stand clearly apart from thin 1px field lines
    const xyAxisMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.6,
      metalness: 0.15,
    });

    const xAxisGeo = new THREE.CylinderGeometry(0.042, 0.042, DOMAIN_HALF * 2, 12);
    xAxisGeo.rotateZ(Math.PI / 2);
    const xAxisMesh = new THREE.Mesh(xAxisGeo, xyAxisMat);
    xAxisMesh.position.y = 0.01;
    staticGroup.add(xAxisMesh);

    const yAxisGeo = new THREE.CylinderGeometry(0.042, 0.042, DOMAIN_HALF * 2, 12);
    yAxisGeo.rotateX(Math.PI / 2);
    const yAxisMesh = new THREE.Mesh(yAxisGeo, xyAxisMat);
    yAxisMesh.position.y = 0.01;
    staticGroup.add(yAxisMesh);

    // Subtle tick crossbars on x and y axes every 2m
    const xyTickGeo = new THREE.BoxGeometry(0.032, 0.025, 0.22);
    for (let t = -14; t <= 14; t += 2) {
      if (t === 0) continue;
      const tickX = new THREE.Mesh(xyTickGeo, xyAxisMat);
      tickX.position.set(t, 0.01, 0);
      staticGroup.add(tickX);

      const tickY = new THREE.Mesh(xyTickGeo, xyAxisMat);
      tickY.rotation.y = Math.PI / 2;
      tickY.position.set(0, 0.01, -t);
      staticGroup.add(tickY);
    }

    // Integer coordinate tick labels across expanded range (-14..+14)
    for (let t = -14; t <= 14; t += 2) {
      if (t === 0) continue;
      const sx = createTextSprite(String(t), '#475569', 28);
      sx.position.set(t, 0.08, 0.38);
      staticGroup.add(sx);
      const sy = createTextSprite(String(t), '#475569', 28);
      sy.position.set(-0.38, 0.08, -t);
      staticGroup.add(sy);
    }

    const xAxisUnit = createTextSprite('x [m]', '#334155', 32);
    xAxisUnit.position.set(5.2, 0.1, -0.42);
    staticGroup.add(xAxisUnit);
    const yAxisUnit = createTextSprite('y [m]', '#334155', 32);
    yAxisUnit.position.set(0.48, 0.1, -4.2);
    staticGroup.add(yAxisUnit);

    // Thick Vertical V-axis group (gradually fades in when rotating out of overhead view)
    const vAxisGroup = new THREE.Group();
    scene.add(vAxisGroup);

    const vAxisSpan = V_AXIS_MAX_HEIGHT + 0.5;
    const vAxisMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.55,
      metalness: 0.15,
      transparent: true,
      opacity: 0,
    });
    const vAxisCylGeo = new THREE.CylinderGeometry(0.045, 0.045, vAxisSpan * 2, 12);
    const vAxisCyl = new THREE.Mesh(vAxisCylGeo, vAxisMat);
    vAxisGroup.add(vAxisCyl);

    const vAxisArrowGeo = new THREE.ConeGeometry(0.11, 0.34, 14);
    const vAxisArrow = new THREE.Mesh(vAxisArrowGeo, vAxisMat);
    vAxisArrow.position.y = vAxisSpan + 0.14;
    vAxisGroup.add(vAxisArrow);

    const vTickVolts = [-42000, -28000, -14000, 14000, 28000, 42000];
    const vTickBarGeo = new THREE.BoxGeometry(0.28, 0.035, 0.035);
    const vAxisSprites: THREE.Sprite[] = [];
    for (const tv of vTickVolts) {
      const ty = potentialToHeight(tv);
      const bar1 = new THREE.Mesh(vTickBarGeo, vAxisMat);
      bar1.position.set(0, ty, 0);
      vAxisGroup.add(bar1);
      const bar2 = new THREE.Mesh(vTickBarGeo, vAxisMat);
      bar2.rotation.y = Math.PI / 2;
      bar2.position.set(0, ty, 0);
      vAxisGroup.add(bar2);

      const labelStr = `${tv > 0 ? '+' : '−'}${Math.abs(tv / 1000)} kV`;
      const labelColor = tv > 0 ? '#C2410C' : '#0E7490';
      const spr = createTextSprite(labelStr, labelColor, 28);
      spr.position.set(-0.82, ty, 0);
      vAxisGroup.add(spr);
      vAxisSprites.push(spr);
    }

    const vTitle = createTextSprite('V [kV]', '#0F172A', 34);
    vTitle.position.set(0, vAxisSpan + 0.55, 0);
    vAxisGroup.add(vTitle);
    vAxisSprites.push(vTitle);
    vAxisGroup.visible = false;

    // 7. Dynamic 3D Potential Surface Mesh (hidden overhead, fades in smoothly on rotation)
    const surfaceGeo = new THREE.PlaneGeometry(
      DOMAIN_HALF * 2,
      DOMAIN_HALF * 2,
      SURFACE_SEGMENTS,
      SURFACE_SEGMENTS
    );
    surfaceGeo.rotateX(-Math.PI / 2);
    const vertCount = surfaceGeo.attributes.position.count;
    const surfaceColors = new Float32Array(vertCount * 3);
    surfaceGeo.setAttribute('color', new THREE.BufferAttribute(surfaceColors, 3));

    const maxIndices = SURFACE_SEGMENTS * SURFACE_SEGMENTS * 6;
    const dynamicIndices = new Uint32Array(maxIndices);
    const dynamicIndexAttr = new THREE.BufferAttribute(dynamicIndices, 1);
    surfaceGeo.setIndex(dynamicIndexAttr);

    const surfaceMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.04,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    surfaceMesh.visible = false;
    scene.add(surfaceMesh);

    const surfaceWireMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      wireframe: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const surfaceWireMesh = new THREE.Mesh(surfaceGeo, surfaceWireMat);
    surfaceWireMesh.visible = false;
    scene.add(surfaceWireMesh);

    // Vertical asymptote guides (also fade in/out smoothly with 3D surface)
    const asymptoteGroup = new THREE.Group();
    asymptoteGroup.visible = false;
    scene.add(asymptoteGroup);
    const asymptoteMats: THREE.LineDashedMaterial[] = [];

    // 8. Dynamic Groups for Equipotential Contours, Field Lines, Integer Vectors, Charges
    const equipotentialGroup = new THREE.Group();
    scene.add(equipotentialGroup);

    const fieldLinesGroup = new THREE.Group();
    scene.add(fieldLinesGroup);

    const arrowConeGeo = new THREE.ConeGeometry(0.065, 0.18, 10);
    const arrowConeMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.1,
    });
    const fieldArrowsInstanced = new THREE.InstancedMesh(
      arrowConeGeo,
      arrowConeMat,
      MAX_FIELD_ARROWS
    );
    fieldArrowsInstanced.frustumCulled = false;
    fieldArrowsInstanced.count = 0;
    scene.add(fieldArrowsInstanced);

    const vecShaftGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 8);
    vecShaftGeo.translate(0, 0.5, 0);
    const vecShaftMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const vecShafts = new THREE.InstancedMesh(vecShaftGeo, vecShaftMat, MAX_VECTORS);
    vecShafts.frustumCulled = false;
    vecShafts.count = 0;
    scene.add(vecShafts);

    const vecHeadGeo = new THREE.ConeGeometry(0.055, 0.16, 10);
    vecHeadGeo.translate(0, 0.08, 0);
    const vecHeadMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const vecHeads = new THREE.InstancedMesh(vecHeadGeo, vecHeadMat, MAX_VECTORS);
    vecHeads.frustumCulled = false;
    vecHeads.count = 0;
    scene.add(vecHeads);

    const vecDotGeo = new THREE.SphereGeometry(0.036, 8, 8);
    const vecDotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const vecDots = new THREE.InstancedMesh(vecDotGeo, vecDotMat, MAX_VECTORS);
    vecDots.frustumCulled = false;
    vecDots.count = 0;
    scene.add(vecDots);

    const chargesGroup = new THREE.Group();
    scene.add(chargesGroup);
    let hitMeshes: THREE.Mesh[] = [];

    const rebuildPhysics = () => {
      const {
        simulationModel: curModel,
        charges: curCharges,
        selectedChargeId: curSelId,
        columns: curColumns,
        selectedColumnId: curSelColId,
        fieldMode: curFieldMode,
        showEquipotentials: curShowEq,
      } = propsRef.current;

      const isUniform = curModel === 'uniform';
      const activeCharges = curCharges.filter((c) => Math.abs(c.q) >= 0.05);
      const activeColumns = curColumns.filter((c) => Math.abs(c.q) >= 0.05);
      const hasActiveSources = isUniform
        ? activeColumns.length > 0
        : activeCharges.length > 0;

      // A. Update 3D Potential Surface V(x, y)
      const posAttr = surfaceGeo.attributes.position as THREE.BufferAttribute;
      const colAttr = surfaceGeo.attributes.color as THREE.BufferAttribute;

      const saturatedVerts = new Uint8Array(posAttr.count);
      const satThreshold = V_AXIS_MAX_HEIGHT - 0.05;

      for (let i = 0; i < posAttr.count; i++) {
        const wx = posAttr.getX(i);
        const wz = posAttr.getZ(i);
        const wy = -wz;

        const v = hasActiveSources
          ? isUniform
            ? evaluateUniformPotential(wx, activeColumns)
            : evaluatePotential(wx, wy, activeCharges)
          : 0;
        const h = potentialToHeight(v);
        posAttr.setY(i, h);
        // Only omit 1/r asymptotic caps in point-charge mode; uniform planes stay continuous
        saturatedVerts[i] = !isUniform && Math.abs(h) >= satThreshold ? 1 : 0;

        const norm = Math.tanh(v / 20000);
        if (norm >= 0) {
          colAttr.setXYZ(
            i,
            0.96 - norm * (0.96 - 0.92),
            0.97 - norm * (0.97 - 0.35),
            0.98 - norm * (0.98 - 0.08)
          );
        } else {
          const n = -norm;
          colAttr.setXYZ(
            i,
            0.96 - n * (0.96 - 0.02),
            0.97 - n * (0.97 - 0.54),
            0.98 - n * (0.98 - 0.84)
          );
        }
      }

      const stride = SURFACE_SEGMENTS + 1;
      let idxCount = 0;
      for (let r = 0; r < SURFACE_SEGMENTS; r++) {
        for (let c = 0; c < SURFACE_SEGMENTS; c++) {
          const a = r * stride + c;
          const b = a + 1;
          const d = (r + 1) * stride + c;
          const e = d + 1;

          if (!(saturatedVerts[a] && saturatedVerts[b] && saturatedVerts[d])) {
            dynamicIndices[idxCount++] = a;
            dynamicIndices[idxCount++] = d;
            dynamicIndices[idxCount++] = b;
          }
          if (!(saturatedVerts[b] && saturatedVerts[d] && saturatedVerts[e])) {
            dynamicIndices[idxCount++] = b;
            dynamicIndices[idxCount++] = d;
            dynamicIndices[idxCount++] = e;
          }
        }
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      dynamicIndexAttr.needsUpdate = true;
      surfaceGeo.setDrawRange(0, idxCount);
      surfaceGeo.computeVertexNormals();

      // B. Update 3D Equipotential Contour Lines
      while (equipotentialGroup.children.length > 0) {
        const ch = equipotentialGroup.children[0];
        equipotentialGroup.remove(ch);
        disposeObject3D(ch);
      }

      if (curShowEq && hasActiveSources) {
        const contours = isUniform
          ? computeUniformEquipotentialContours(activeColumns, DOMAIN_BOUNDS)
          : computeEquipotentialContours(activeCharges, DOMAIN_BOUNDS, 136, 136);
        for (const contour of contours) {
          const h = potentialToHeight(contour.levelVolts) + 0.015;
          const segs = contour.segments;
          const pts = new Float32Array((segs.length / 4) * 6);
          let pIdx = 0;
          for (let i = 0; i < segs.length; i += 4) {
            pts[pIdx++] = segs[i];
            pts[pIdx++] = h;
            pts[pIdx++] = -segs[i + 1];
            pts[pIdx++] = segs[i + 2];
            pts[pIdx++] = h;
            pts[pIdx++] = -segs[i + 3];
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));

          const isZero = Math.abs(contour.levelVolts) < 1;
          const isPos = contour.levelVolts > 0;
          const mat = new THREE.LineBasicMaterial({
            color: isZero ? 0x475569 : isPos ? 0xea580c : 0x0891b2,
            transparent: true,
            opacity: isZero ? 0.85 : 0.92,
          });
          equipotentialGroup.add(new THREE.LineSegments(geo, mat));
        }
      }

      // C. Update Electric Field Lines
      while (fieldLinesGroup.children.length > 0) {
        const ch = fieldLinesGroup.children[0];
        fieldLinesGroup.remove(ch);
        disposeObject3D(ch);
      }
      fieldArrowsInstanced.count = 0;

      if (
        (curFieldMode === 'lines' || curFieldMode === 'both') &&
        hasActiveSources
      ) {
        const lines = isUniform
          ? traceUniformFieldLines(activeColumns, DOMAIN_BOUNDS)
          : traceFieldLines(activeCharges, DOMAIN_BOUNDS);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x0f172a,
          transparent: true,
          opacity: curFieldMode === 'both' ? 0.58 : 0.9,
        });

        let arrowIdx = 0;
        for (const line of lines) {
          const visiblePts: THREE.Vector3[] = [];
          for (const p of line.points) {
            if (
              Math.abs(p.x) <= DOMAIN_HALF &&
              Math.abs(p.y) <= DOMAIN_HALF
            ) {
              visiblePts.push(new THREE.Vector3(p.x, 0.048, -p.y));
            } else if (visiblePts.length > 0) {
              const cx = Math.max(-DOMAIN_HALF, Math.min(DOMAIN_HALF, p.x));
              const cy = Math.max(-DOMAIN_HALF, Math.min(DOMAIN_HALF, p.y));
              visiblePts.push(new THREE.Vector3(cx, 0.048, -cy));
              break;
            }
          }

          if (visiblePts.length >= 2) {
            const geo = new THREE.BufferGeometry().setFromPoints(visiblePts);
            fieldLinesGroup.add(new THREE.Line(geo, lineMat));
          }

          for (const arrow of line.arrows) {
            if (
              arrowIdx >= MAX_FIELD_ARROWS ||
              Math.abs(arrow.x) > DOMAIN_HALF - 0.1 ||
              Math.abs(arrow.y) > DOMAIN_HALF - 0.1
            ) {
              continue;
            }
            _dirVec.set(Math.cos(arrow.angle), 0, -Math.sin(arrow.angle)).normalize();
            _quat.setFromUnitVectors(_upVec, _dirVec);
            _dummyObj.position.set(arrow.x, 0.052, -arrow.y);
            _dummyObj.quaternion.copy(_quat);
            _dummyObj.scale.set(1, 1, 1);
            _dummyObj.updateMatrix();
            fieldArrowsInstanced.setMatrixAt(arrowIdx++, _dummyObj.matrix);
          }
        }
        fieldArrowsInstanced.count = arrowIdx;
        fieldArrowsInstanced.instanceMatrix.needsUpdate = true;
      }

      // D. Update Integer Coordinate Electric Field Vectors (x, y ∈ ℤ)
      let vecIdx = 0;
      if (
        (curFieldMode === 'vectors' || curFieldMode === 'both') &&
        hasActiveSources
      ) {
        for (let ix = -VECTOR_RANGE; ix <= VECTOR_RANGE; ix++) {
          if (isUniform) {
            let nearColumn = false;
            for (const col of activeColumns) {
              if (Math.abs(ix - col.x) < 0.42) {
                nearColumn = true;
                break;
              }
            }
            if (nearColumn) continue;
          }

          for (let iy = -VECTOR_RANGE; iy <= VECTOR_RANGE; iy++) {
            if (vecIdx >= MAX_VECTORS) break;

            if (!isUniform) {
              let nearCharge = false;
              for (const c of activeCharges) {
                if (Math.hypot(ix - c.x, iy - c.y) < 0.42) {
                  nearCharge = true;
                  break;
                }
              }
              if (nearCharge) continue;
            }

            const { ex, ey, magnitude } = isUniform
              ? evaluateUniformField(ix, activeColumns)
              : evaluateField(ix, iy, activeCharges);
            if (magnitude < 1e-2) continue;

            const strengthNorm =
              Math.log10(1 + magnitude / 350) / Math.log10(1 + 95000 / 350);
            const clampedNorm = Math.max(0, Math.min(1, strengthNorm));
            const totalLen = 0.25 + clampedNorm * 0.58;
            const shaftLen = Math.max(0.08, totalLen - 0.14);

            interpolateVectorColor(clampedNorm, _tmpColor);

            _dummyObj.position.set(ix, 0.052, -iy);
            _dummyObj.quaternion.identity();
            _dummyObj.scale.set(1, 1, 1);
            _dummyObj.updateMatrix();
            vecDots.setMatrixAt(vecIdx, _dummyObj.matrix);
            vecDots.setColorAt(vecIdx, _tmpColor);

            _dirVec.set(ex, 0, -ey).normalize();
            _quat.setFromUnitVectors(_upVec, _dirVec);

            _dummyObj.position.set(ix, 0.052, -iy);
            _dummyObj.quaternion.copy(_quat);
            _dummyObj.scale.set(1, shaftLen, 1);
            _dummyObj.updateMatrix();
            vecShafts.setMatrixAt(vecIdx, _dummyObj.matrix);
            vecShafts.setColorAt(vecIdx, _tmpColor);

            _dummyObj.position.set(
              ix + _dirVec.x * shaftLen,
              0.052,
              -iy + _dirVec.z * shaftLen
            );
            _dummyObj.quaternion.copy(_quat);
            _dummyObj.scale.set(1, 1, 1);
            _dummyObj.updateMatrix();
            vecHeads.setMatrixAt(vecIdx, _dummyObj.matrix);
            vecHeads.setColorAt(vecIdx, _tmpColor);

            vecIdx++;
          }
        }
      }
      vecDots.count = vecIdx;
      vecShafts.count = vecIdx;
      vecHeads.count = vecIdx;
      vecDots.instanceMatrix.needsUpdate = true;
      vecShafts.instanceMatrix.needsUpdate = true;
      vecHeads.instanceMatrix.needsUpdate = true;
      if (vecDots.instanceColor) vecDots.instanceColor.needsUpdate = true;
      if (vecShafts.instanceColor) vecShafts.instanceColor.needsUpdate = true;
      if (vecHeads.instanceColor) vecHeads.instanceColor.needsUpdate = true;

      // E. Rebuild Point Charges or Infinite Charge Columns
      while (chargesGroup.children.length > 0) {
        const ch = chargesGroup.children[0];
        chargesGroup.remove(ch);
        disposeObject3D(ch);
      }
      while (asymptoteGroup.children.length > 0) {
        const ch = asymptoteGroup.children[0];
        asymptoteGroup.remove(ch);
        disposeObject3D(ch);
      }
      asymptoteMats.length = 0;
      hitMeshes = [];

      if (isUniform) {
        const colLength = DOMAIN_HALF * 2;
        const sphereCount = DOMAIN_HALF * 2 - 1; // y = -15..+15 every 1m
        for (const col of curColumns) {
          const isSelected = col.id === curSelColId;
          const mainColor = getChargeColor(col.q);

          const group = new THREE.Group();
          group.position.set(col.x, 0, 0);

          // Part 1: Continuous plate rail along the y-axis
          const railGeo = new THREE.BoxGeometry(
            isSelected ? 0.36 : 0.28,
            0.035,
            colLength
          );
          const railMat = new THREE.MeshStandardMaterial({
            color: isSelected ? 0x0f172a : 0x94a3b8,
            roughness: 0.5,
            metalness: 0.35,
          });
          const railMesh = new THREE.Mesh(railGeo, railMat);
          railMesh.position.y = 0.018;
          group.add(railMesh);

          // Part 2: Row of constant-size charge spheres along the y-axis (color depth = |q|)
          const sphereRadius = 0.18;
          const sphereGeo = new THREE.SphereGeometry(sphereRadius, 18, 14);
          const sphereMat = new THREE.MeshStandardMaterial({
            color: mainColor,
            roughness: 0.28,
            metalness: 0.06,
          });
          const spheresInst = new THREE.InstancedMesh(
            sphereGeo,
            sphereMat,
            sphereCount
          );
          spheresInst.frustumCulled = false;
          for (let idx = 0; idx < sphereCount; idx++) {
            const py = -(DOMAIN_HALF - 1) + idx;
            _dummyObj.position.set(0, sphereRadius + 0.035, -py);
            _dummyObj.quaternion.identity();
            _dummyObj.scale.set(1, 1, 1);
            _dummyObj.updateMatrix();
            spheresInst.setMatrixAt(idx, _dummyObj.matrix);
          }
          spheresInst.instanceMatrix.needsUpdate = true;
          group.add(spheresInst);

          // Part 3: Subtle selection rim bars when selected
          if (isSelected) {
            const rimGeo = new THREE.BoxGeometry(0.035, 0.055, colLength);
            const rimMat = new THREE.MeshStandardMaterial({
              color: 0x0f172a,
              roughness: 0.35,
              metalness: 0.5,
            });
            const rimL = new THREE.Mesh(rimGeo, rimMat);
            rimL.position.set(-0.22, 0.028, 0);
            group.add(rimL);
            const rimR = new THREE.Mesh(rimGeo.clone(), rimMat.clone());
            rimR.position.set(0.22, 0.028, 0);
            group.add(rimR);
          }

          // Column charge density label sprite (clear of x-axis numbers)
          const signStr = col.q > 0 ? '+' : col.q < 0 ? '−' : '';
          const colLabel = `${signStr}${Math.abs(col.q).toFixed(1)}`;
          const labelSprite = createTextSprite(colLabel, '#0F172A', 30);
          labelSprite.position.set(0, sphereRadius * 2 + 0.34, -2.5);
          group.add(labelSprite);

          // Full-length touch/mouse hit box on layer 1 for smooth x-axis dragging
          const hitGeo = new THREE.BoxGeometry(0.95, 0.95, colLength);
          const hitMat = new THREE.MeshBasicMaterial({ visible: false });
          const hitMesh = new THREE.Mesh(hitGeo, hitMat);
          hitMesh.position.y = sphereRadius + 0.05;
          hitMesh.layers.set(1);
          hitMesh.userData.columnId = col.id;
          group.add(hitMesh);
          hitMeshes.push(hitMesh);

          chargesGroup.add(group);
        }
      } else {
        for (const c of curCharges) {
          const isPos = c.q > 0;
          const isSelected = c.id === curSelId;
          const mainColor = getChargeColor(c.q);

          const group = new THREE.Group();
          group.position.set(c.x, 0, -c.y);

          // Part 1: Base anchor disc
          const baseDiscGeo = new THREE.CylinderGeometry(0.28, 0.31, 0.03, 24);
          const baseDiscMat = new THREE.MeshStandardMaterial({
            color: isSelected ? 0x0f172a : 0x94a3b8,
            roughness: 0.55,
            metalness: 0.45,
          });
          const baseDisc = new THREE.Mesh(baseDiscGeo, baseDiscMat);
          baseDisc.position.y = 0.015;
          group.add(baseDisc);

          // Part 2: Constant-volume primary charge sphere (color depth = |q|)
          const sphereRadius = 0.24;
          const sphereGeo = new THREE.SphereGeometry(sphereRadius, 24, 18);
          const sphereMat = new THREE.MeshStandardMaterial({
            color: mainColor,
            roughness: 0.28,
            metalness: 0.06,
          });
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);
          sphere.position.y = sphereRadius + 0.03;
          group.add(sphere);

          // Part 3: Equatorial collar
          const collarGeo = new THREE.TorusGeometry(
            sphereRadius + 0.07,
            isSelected ? 0.032 : 0.018,
            10,
            28
          );
          collarGeo.rotateX(Math.PI / 2);
          const collarMat = new THREE.MeshStandardMaterial({
            color: isSelected ? 0x0f172a : 0xcbd5e1,
            roughness: 0.3,
            metalness: 0.78,
          });
          const collar = new THREE.Mesh(collarGeo, collarMat);
          collar.position.y = 0.035;
          group.add(collar);

          // Vertical asymptote guide extending into the diverging 1/r funnel (+∞ or -∞)
          if (Math.abs(c.q) >= 0.05) {
            const asympEnd = isPos ? V_AXIS_MAX_HEIGHT + 0.6 : -V_AXIS_MAX_HEIGHT - 0.6;
            const asympGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(c.x, isPos ? sphereRadius + 0.03 : 0, -c.y),
              new THREE.Vector3(c.x, asympEnd, -c.y),
            ]);
            const asympMat = new THREE.LineDashedMaterial({
              color: mainColor,
              dashSize: 0.25,
              gapSize: 0.16,
              transparent: true,
              opacity: 0,
            });
            const asympLine = new THREE.Line(asympGeo, asympMat);
            asympLine.computeLineDistances();
            asymptoteGroup.add(asympLine);
            asymptoteMats.push(asympMat);
          }

          // Charge value sprite
          const signStr = c.q > 0 ? '+' : c.q < 0 ? '−' : '';
          const qText = `${signStr}${Math.abs(c.q).toFixed(1)} μC`;
          const labelSprite = createTextSprite(qText, '#0F172A', 30);
          labelSprite.position.set(0, sphereRadius * 2 + 0.28, 0);
          group.add(labelSprite);

          // Generous touch hit-sphere on layer 1
          const hitGeo = new THREE.SphereGeometry(0.65, 12, 10);
          const hitMat = new THREE.MeshBasicMaterial({ visible: false });
          const hitMesh = new THREE.Mesh(hitGeo, hitMat);
          hitMesh.position.y = sphereRadius + 0.03;
          hitMesh.layers.set(1);
          hitMesh.userData.chargeId = c.id;
          group.add(hitMesh);
          hitMeshes.push(hitMesh);

          chargesGroup.add(group);
        }
      }
    };

    // 9. On-demand coalesced rendering loop + smooth polar-angle potential surface fade
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let camTargetPos: THREE.Vector3 | null = null;
    let camLookTarget: THREE.Vector3 | null = null;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const now = performance.now();
        const delta = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;

        let needsMoreFrames = false;

        if (camTargetPos && camLookTarget) {
          camera.position.x = THREE.MathUtils.damp(
            camera.position.x,
            camTargetPos.x,
            7,
            delta
          );
          camera.position.y = THREE.MathUtils.damp(
            camera.position.y,
            camTargetPos.y,
            7,
            delta
          );
          camera.position.z = THREE.MathUtils.damp(
            camera.position.z,
            camTargetPos.z,
            7,
            delta
          );
          controls.target.x = THREE.MathUtils.damp(
            controls.target.x,
            camLookTarget.x,
            7,
            delta
          );
          controls.target.y = THREE.MathUtils.damp(
            controls.target.y,
            camLookTarget.y,
            7,
            delta
          );
          controls.target.z = THREE.MathUtils.damp(
            controls.target.z,
            camLookTarget.z,
            7,
            delta
          );
          if (
            camera.position.distanceTo(camTargetPos) < 0.03 &&
            controls.target.distanceTo(camLookTarget) < 0.03
          ) {
            camera.position.copy(camTargetPos);
            controls.target.copy(camLookTarget);
            camTargetPos = null;
            camLookTarget = null;
          } else {
            needsMoreFrames = true;
          }
        }

        const moved = controls.update();
        if (moved && controls.enableDamping) {
          needsMoreFrames = true;
        }

        controls.target.x = Math.max(-10, Math.min(10, controls.target.x));
        controls.target.z = Math.max(-10, Math.min(10, controls.target.z));
        controls.target.y = Math.max(-6, Math.min(6, controls.target.y));

        // Gradually fade 3D potential surface, V-axis, and asymptotes based on tilt away from overhead
        const polarAngle = controls.getPolarAngle();
        const rawTilt = THREE.MathUtils.clamp((polarAngle - 0.06) / 0.45, 0, 1);
        const tiltFactor = rawTilt * rawTilt * (3 - 2 * rawTilt);

        const targetSurfaceOpacity = propsRef.current.showPotentialTint ? 0.78 : 0.44;
        const targetWireOpacity = propsRef.current.showPotentialTint ? 0.06 : 0.11;

        const show3D = tiltFactor > 0.005;
        surfaceMesh.visible = show3D;
        surfaceWireMesh.visible = show3D;
        surfaceMat.opacity = targetSurfaceOpacity * tiltFactor;
        surfaceWireMat.opacity = targetWireOpacity * tiltFactor;

        vAxisGroup.visible = tiltFactor > 0.01;
        vAxisMat.opacity = 0.9 * tiltFactor;
        for (const spr of vAxisSprites) {
          spr.material.opacity = tiltFactor;
        }

        asymptoteGroup.visible = tiltFactor > 0.01;
        for (const mat of asymptoteMats) {
          mat.opacity = 0.55 * tiltFactor;
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsMoreFrames) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    controls.addEventListener('start', () => {
      camTargetPos = null;
      camLookTarget = null;
      setActiveCamPreset(null);
    });
    controls.addEventListener('change', requestRender);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const setCameraPreset = (preset: CameraPreset) => {
      if (preset === 'top') {
        camTargetPos = new THREE.Vector3(0, 12.4, 0.04);
        camLookTarget = new THREE.Vector3(0, 0, 0);
      } else if (preset === 'iso') {
        camTargetPos = new THREE.Vector3(9.5, 8.2, 11.2);
        camLookTarget = new THREE.Vector3(0, 0.8, 0);
      } else {
        camTargetPos = new THREE.Vector3(0, 2.2, 18.0);
        camLookTarget = new THREE.Vector3(0, 1.0, 0);
      }
      requestRender();
    };

    sceneRefs.current = {
      requestRender,
      setCameraPreset,
      rebuildPhysics,
    };

    rebuildPhysics();
    requestRender();

    // 10. Pointer & Touch Handling
    let activeDragTarget: { type: 'charge' | 'column'; id: string } | null = null;
    let pointerDownPos: { x: number; y: number; time: number } | null = null;

    const updateNdc = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      _ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) {
        activeDragTarget = null;
        setDraggingId(null);
        controls.enabled = true;
        return;
      }

      updateNdc(e);
      _raycaster.setFromCamera(_ndc, camera);
      _raycaster.layers.set(1);
      const hits = _raycaster.intersectObjects(hitMeshes, false);

      if (hits.length > 0) {
        const userData = hits[0].object.userData;
        if (userData.columnId) {
          const columnId = userData.columnId as string;
          activeDragTarget = { type: 'column', id: columnId };
          setDraggingId(columnId);
          propsRef.current.onSelectColumn(columnId);
        } else if (userData.chargeId) {
          const chargeId = userData.chargeId as string;
          activeDragTarget = { type: 'charge', id: chargeId };
          setDraggingId(chargeId);
          propsRef.current.onSelectCharge(chargeId);
        }
        controls.enabled = false;
        camTargetPos = null;
        camLookTarget = null;
        try {
          renderer.domElement.setPointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
        e.stopPropagation();
      } else {
        pointerDownPos = {
          x: e.clientX,
          y: e.clientY,
          time: performance.now(),
        };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      updateNdc(e);
      _raycaster.setFromCamera(_ndc, camera);

      if (activeDragTarget) {
        if (_raycaster.ray.intersectPlane(_dragPlane, _planeHit)) {
          const clampedX = Math.max(
            -DOMAIN_HALF + 0.5,
            Math.min(DOMAIN_HALF - 0.5, _planeHit.x)
          );
          const snap = propsRef.current.snapToInteger;
          const finalX = snap
            ? Math.round(clampedX)
            : Math.round(clampedX * 10) / 10;

          if (activeDragTarget.type === 'column') {
            propsRef.current.onMoveColumn(activeDragTarget.id, finalX);
          } else {
            const clampedY = Math.max(
              -DOMAIN_HALF + 0.5,
              Math.min(DOMAIN_HALF - 0.5, -_planeHit.z)
            );
            const finalY = snap
              ? Math.round(clampedY)
              : Math.round(clampedY * 10) / 10;
            propsRef.current.onMoveCharge(activeDragTarget.id, finalX, finalY);
          }
        }
        return;
      }

      if (e.pointerType === 'mouse') {
        _raycaster.layers.set(1);
        const hits = _raycaster.intersectObjects(hitMeshes, false);
        setHoveringCharge(hits.length > 0);
      }
    };

    const onPointerUpOrCancel = (e: PointerEvent) => {
      if (activeDragTarget) {
        try {
          renderer.domElement.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
        activeDragTarget = null;
        setDraggingId(null);
        controls.enabled = true;
        return;
      }

      if (pointerDownPos) {
        const dist = Math.hypot(
          e.clientX - pointerDownPos.x,
          e.clientY - pointerDownPos.y
        );
        const elapsed = performance.now() - pointerDownPos.time;
        if (dist < 6 && elapsed < 260) {
          if (propsRef.current.simulationModel === 'uniform') {
            propsRef.current.onSelectColumn(null);
          } else {
            propsRef.current.onSelectCharge(null);
          }
        }
        pointerDownPos = null;
      }
    };

    const onPointerLeave = () => {
      setHoveringCharge(false);
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown, { capture: true });
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUpOrCancel);
    dom.addEventListener('pointercancel', onPointerUpOrCancel);
    dom.addEventListener('pointerleave', onPointerLeave);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(1, Math.floor(entry.contentRect.width));
        const h = Math.max(1, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        requestRender();
      }
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown, { capture: true });
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUpOrCancel);
      dom.removeEventListener('pointercancel', onPointerUpOrCancel);
      dom.removeEventListener('pointerleave', onPointerLeave);
      controls.dispose();
      disposeObject3D(staticGroup);
      disposeObject3D(vAxisGroup);
      disposeObject3D(asymptoteGroup);
      disposeObject3D(equipotentialGroup);
      disposeObject3D(fieldLinesGroup);
      disposeObject3D(chargesGroup);
      surfaceGeo.dispose();
      surfaceMat.dispose();
      surfaceWireMat.dispose();
      arrowConeGeo.dispose();
      arrowConeMat.dispose();
      vecShaftGeo.dispose();
      vecShaftMat.dispose();
      vecHeadGeo.dispose();
      vecHeadMat.dispose();
      vecDotGeo.dispose();
      vecDotMat.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (dom.parentElement === container) {
        container.removeChild(dom);
      }
    };
  }, []);

  useEffect(() => {
    sceneRefs.current?.rebuildPhysics();
    sceneRefs.current?.requestRender();
  }, [
    simulationModel,
    charges,
    selectedChargeId,
    columns,
    selectedColumnId,
    fieldMode,
    showEquipotentials,
    showPotentialTint,
  ]);

  const handleCameraPreset = useCallback((preset: CameraPreset) => {
    setActiveCamPreset(preset);
    sceneRefs.current?.setCameraPreset(preset);
  }, []);

  const cursorClass = draggingId
    ? 'cursor-grabbing'
    : hoveringCharge
      ? 'cursor-grab'
      : 'cursor-move';

  return (
    <div className="relative w-full h-full min-h-[380px] bg-slate-50 overflow-hidden select-none">
      <div
        ref={mountRef}
        className={`w-full h-full ${cursorClass}`}
        aria-label="3D静電場と電位曲面キャンバス"
      />

      {/* Top-Right Compact View Switcher */}
      <div className="absolute top-3 right-3 inline-flex items-center gap-1 p-1 bg-white/95 border border-slate-200 rounded-lg shadow-xs">
        <button
          type="button"
          onClick={() => handleCameraPreset('top')}
          className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
            activeCamPreset === 'top'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          上から
        </button>
        <button
          type="button"
          onClick={() => handleCameraPreset('iso')}
          className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
            activeCamPreset === 'iso'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          3D視点
        </button>
        <button
          type="button"
          onClick={() => handleCameraPreset('side')}
          className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
            activeCamPreset === 'side'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          横から (V軸)
        </button>
      </div>
    </div>
  );
};
