import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ARM_BASE_HEIGHT,
  ARM_EE_OFFSET,
  ARM_L1,
  ARM_L2,
  ARM_SHOULDER_OFFSET,
  BoxObstacle,
  CRITICAL_LIDAR_DIST,
  LAYOUT_CONFIGS,
  LayoutId,
  NUM_LIDAR_RAYS,
  SORTING_BIN_POS,
  SimFrameState,
} from './slamPlanner';

export type CameraAngle = 'fixed' | 'follow' | 'first-person';

export interface StudioLightingConfig {
  intensity: number;
  temperatureK: number;
}

export interface OnboardDetection {
  imageData: ImageData;
  detected: boolean;
  bbox: { x: number; y: number; w: number; h: number; cx: number; cy: number } | null;
}

function kelvinToThreeColor(kelvin: number, target: THREE.Color): THREE.Color {
  const temp = Math.max(1000, Math.min(12000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;

  if (temp <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
    b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    b = 255;
  }

  return target.setRGB(
    Math.max(0, Math.min(255, r)) / 255,
    Math.max(0, Math.min(255, g)) / 255,
    Math.max(0, Math.min(255, b)) / 255,
    THREE.SRGBColorSpace
  );
}

function detectSoftwareWebGL(): boolean {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

function createIndustrialFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#252b34';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#323a46';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let i = 0; i < 600; i++) {
    const x = (i * 73) % 512;
    const y = (i * 137) % 512;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createHazardStripeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#c8871e';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#1b1f26';
  for (let x = -256; x < 512; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 24, 0);
    ctx.lineTo(x + 152, 256);
    ctx.lineTo(x + 128, 256);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export class Factory3DStudio {
  public readonly isSoftwareGl: boolean;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly mainCamera: THREE.PerspectiveCamera;
  public readonly onboardCamera: THREE.PerspectiveCamera;
  private readonly onboardTarget: THREE.WebGLRenderTarget;
  private readonly onboardPixelBuf: Uint8Array;
  private readonly onboardImageData: ImageData;

  private readonly robotRoot: THREE.Group;
  private readonly lidarTurret: THREE.Mesh;
  private readonly waistGroup: THREE.Group;
  private readonly shoulderGroup: THREE.Group;
  private readonly elbowGroup: THREE.Group;
  private readonly wristGroup: THREE.Group;
  private readonly wristRollGroup: THREE.Group;
  private readonly fingerLeft: THREE.Mesh;
  private readonly fingerRight: THREE.Mesh;
  private readonly redCube: THREE.Mesh;

  private readonly lidarLines: THREE.LineSegments;
  private readonly lidarPositions: Float32Array;
  private readonly lidarColors: Float32Array;
  private readonly astarLine: THREE.Line;
  private readonly astarPositions: Float32Array;

  private readonly camPos = new THREE.Vector3(-4.6, 3.15, 0.4);
  private readonly camTgt = new THREE.Vector3(-2.1, 0.22, -1.35);
  private readonly desiredPos = new THREE.Vector3();
  private readonly desiredTgt = new THREE.Vector3();
  private lastCameraAngle: CameraAngle | null = null;
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly obstaclesGroup = new THREE.Group();
  private readonly binGroup = new THREE.Group();
  private obstacleGeometries: THREE.BufferGeometry[] = [];
  private currentLayoutId: LayoutId = 'open-space';
  private customSceneKey = '';
  private readonly wallTrimMat: THREE.MeshStandardMaterial;
  private readonly obsMat: THREE.MeshStandardMaterial;
  private readonly obsStripeMat: THREE.MeshStandardMaterial;
  private readonly customObsMat: THREE.MeshStandardMaterial;
  private readonly customObsCapMat: THREE.MeshStandardMaterial;
  private readonly bumperMat: THREE.MeshStandardMaterial;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly tempColor = new THREE.Color();
  private readonly coolBlueColor = new THREE.Color(0xbcd2f5);
  private readonly rimBaseColor = new THREE.Color(0x68b5ff);

  constructor() {
    this.isSoftwareGl = detectSoftwareWebGL();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(760, 720, false);
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d121a);
    this.scene.fog = new THREE.FogExp2(0x0d121a, 0.035);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTex;
    this.disposables.push(envTex);
    pmrem.dispose();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const floorTex = createIndustrialFloorTexture(maxAniso);
    const hazardTex = createHazardStripeTexture(maxAniso);
    this.disposables.push(floorTex, hazardTex);

    this.hemiLight = new THREE.HemisphereLight(0xbcd2f5, 0x262018, 0.72);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff1dc, 2.1);
    this.keyLight.position.set(4.5, 7.5, 4.0);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 22;
    this.keyLight.shadow.camera.left = -6;
    this.keyLight.shadow.camera.right = 6;
    this.keyLight.shadow.camera.top = 6;
    this.keyLight.shadow.camera.bottom = -6;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x68b5ff, 0.65);
    this.rimLight.position.set(-5.0, 4.5, -4.5);
    this.scene.add(this.rimLight);

    this.setLighting({ intensity: 1.0, temperatureK: 5500 });

    const floorGeo = new THREE.PlaneGeometry(14, 12);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.72,
      metalness: 0.12,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.disposables.push(floorGeo, floorMat);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x3b4452,
      roughness: 0.58,
      metalness: 0.28,
    });
    const wallTrimMat = new THREE.MeshStandardMaterial({
      color: 0x1c222b,
      roughness: 0.35,
      metalness: 0.75,
    });
    const obsMat = new THREE.MeshStandardMaterial({
      color: 0xc28a2e,
      roughness: 0.52,
      metalness: 0.18,
    });
    const obsStripeMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.58,
      metalness: 0.15,
    });
    const tableTopMat = new THREE.MeshStandardMaterial({
      color: 0x8e7254,
      roughness: 0.65,
      metalness: 0.08,
    });
    const tableLegMat = new THREE.MeshStandardMaterial({
      color: 0x202630,
      roughness: 0.32,
      metalness: 0.82,
    });
    const binMat = new THREE.MeshStandardMaterial({
      color: 0x1f6feb,
      roughness: 0.36,
      metalness: 0.25,
    });
    const binInnerMat = new THREE.MeshStandardMaterial({
      color: 0x124799,
      roughness: 0.55,
      metalness: 0.15,
    });
    const customObsMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.45,
      metalness: 0.25,
    });
    const customObsCapMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.35,
      metalness: 0.45,
    });
    this.disposables.push(
      wallMat,
      wallTrimMat,
      obsMat,
      obsStripeMat,
      customObsMat,
      customObsCapMat,
      tableTopMat,
      tableLegMat,
      binMat,
      binInnerMat
    );

    this.wallTrimMat = wallTrimMat;
    this.obsMat = obsMat;
    this.obsStripeMat = obsStripeMat;
    this.customObsMat = customObsMat;
    this.customObsCapMat = customObsCapMat;
    this.scene.add(this.obstaclesGroup);

    const staticBoxes = LAYOUT_CONFIGS['open-space'].boxes.filter((b) => b.kind !== 'obstacle');
    for (const box of staticBoxes) {
      if (box.kind === 'wall') {
        const g = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(box.hx * 2, box.height, box.hy * 2);
        const body = new THREE.Mesh(bodyGeo, wallMat);
        body.position.y = box.height / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        const capGeo = new THREE.BoxGeometry(box.hx * 2 + 0.02, 0.05, box.hy * 2 + 0.02);
        const cap = new THREE.Mesh(capGeo, wallTrimMat);
        cap.position.y = box.height + 0.025;
        g.add(body, cap);
        g.position.set(box.cx, 0, -box.cy);
        this.scene.add(g);
        this.disposables.push(bodyGeo, capGeo);
      } else if (box.kind === 'table') {
        const g = new THREE.Group();
        const topGeo = new THREE.BoxGeometry(box.hx * 2, 0.06, box.hy * 2);
        const top = new THREE.Mesh(topGeo, tableTopMat);
        top.position.y = box.height - 0.03;
        top.castShadow = true;
        top.receiveShadow = true;
        g.add(top);

        const legGeo = new THREE.BoxGeometry(0.06, box.height - 0.06, 0.06);
        const legOffsets: Array<[number, number]> = [
          [box.hx - 0.05, box.hy - 0.05],
          [-box.hx + 0.05, box.hy - 0.05],
          [box.hx - 0.05, -box.hy + 0.05],
          [-box.hx + 0.05, -box.hy + 0.05],
        ];
        for (const [lx, lz] of legOffsets) {
          const leg = new THREE.Mesh(legGeo, tableLegMat);
          leg.position.set(lx, (box.height - 0.06) / 2, lz);
          leg.castShadow = true;
          g.add(leg);
        }
        g.position.set(box.cx, 0, -box.cy);
        this.scene.add(g);
        this.disposables.push(topGeo, legGeo);
      } else if (box.kind === 'bin') {
        const floorBinGeo = new THREE.BoxGeometry(box.hx * 2, 0.03, box.hy * 2);
        const floorBin = new THREE.Mesh(floorBinGeo, binInnerMat);
        floorBin.position.y = 0.015;
        floorBin.receiveShadow = true;
        const wallFGeo = new THREE.BoxGeometry(box.hx * 2, 0.18, 0.03);
        const wallSGeo = new THREE.BoxGeometry(0.03, 0.18, box.hy * 2 - 0.04);
        const w1 = new THREE.Mesh(wallFGeo, binMat);
        w1.position.set(0, 0.09, box.hy - 0.015);
        const w2 = new THREE.Mesh(wallFGeo, binMat);
        w2.position.set(0, 0.09, -box.hy + 0.015);
        const w3 = new THREE.Mesh(wallSGeo, binMat);
        w3.position.set(-box.hx + 0.015, 0.09, 0);
        const w4 = new THREE.Mesh(wallSGeo, binMat);
        w4.position.set(box.hx - 0.015, 0.09, 0);
        for (const m of [w1, w2, w3, w4]) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
        this.binGroup.add(floorBin, w1, w2, w3, w4);
        this.binGroup.position.set(box.cx, 0, -box.cy);
        this.scene.add(this.binGroup);
        this.disposables.push(floorBinGeo, wallFGeo, wallSGeo);
      }
    }

    this.setCustomScene('open-space', [], SORTING_BIN_POS);

    const cubeGeo = new THREE.BoxGeometry(0.065, 0.065, 0.065);
    const cubeMat = new THREE.MeshPhysicalMaterial({
      color: 0xe61e1e,
      roughness: 0.25,
      metalness: 0.1,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
    });
    this.redCube = new THREE.Mesh(cubeGeo, cubeMat);
    this.redCube.castShadow = true;
    this.scene.add(this.redCube);
    this.disposables.push(cubeGeo, cubeMat);

    this.robotRoot = new THREE.Group();
    this.scene.add(this.robotRoot);

    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x222933,
      roughness: 0.42,
      metalness: 0.65,
    });
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x101317,
      roughness: 0.85,
      metalness: 0.05,
    });
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x9aa4b2,
      roughness: 0.28,
      metalness: 0.85,
    });
    const cyanBumperMat = new THREE.MeshStandardMaterial({
      color: 0x00c8f0,
      emissive: 0x007ca0,
      emissiveIntensity: 0.55,
      roughness: 0.3,
      metalness: 0.4,
    });
    this.bumperMat = cyanBumperMat;
    const lidarMat = new THREE.MeshStandardMaterial({
      color: 0x12d878,
      emissive: 0x067040,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.7,
    });
    const armWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xe2e7ee,
      roughness: 0.34,
      metalness: 0.35,
    });
    const armJointMat = new THREE.MeshStandardMaterial({
      color: 0x2c3440,
      roughness: 0.3,
      metalness: 0.8,
    });
    const armAccentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.35,
      metalness: 0.4,
    });
    this.disposables.push(
      chassisMat,
      wheelMat,
      hubMat,
      cyanBumperMat,
      lidarMat,
      armWhiteMat,
      armJointMat,
      armAccentMat
    );

    const chassisGeo = new THREE.BoxGeometry(0.56, 0.14, 0.44);
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.set(0, 0.14, 0);
    chassis.castShadow = true;
    this.robotRoot.add(chassis);

    const topPlateGeo = new THREE.BoxGeometry(0.46, 0.03, 0.36);
    const topPlate = new THREE.Mesh(topPlateGeo, hubMat);
    topPlate.position.set(-0.02, 0.225, 0);
    this.robotRoot.add(topPlate);

    const bumperGeo = new THREE.BoxGeometry(0.05, 0.08, 0.44);
    const bumper = new THREE.Mesh(bumperGeo, cyanBumperMat);
    bumper.position.set(0.275, 0.13, 0);
    this.robotRoot.add(bumper);

    const wheelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.055, 20);
    const hubGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.06, 12);
    const wheelPos: Array<[number, number]> = [
      [0.18, 0.24],
      [0.18, -0.24],
      [-0.18, 0.24],
      [-0.18, -0.24],
    ];
    for (const [wx, wz] of wheelPos) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.08, wz);
      w.castShadow = true;
      const h = new THREE.Mesh(hubGeo, hubMat);
      h.rotation.x = Math.PI / 2;
      h.position.set(wx, 0.08, wz);
      this.robotRoot.add(w, h);
    }

    const lidarBaseGeo = new THREE.CylinderGeometry(0.065, 0.072, 0.04, 20);
    const lidarBase = new THREE.Mesh(lidarBaseGeo, armJointMat);
    lidarBase.position.set(0.20, 0.23, 0);
    const lidarGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.055, 20);
    this.lidarTurret = new THREE.Mesh(lidarGeo, lidarMat);
    this.lidarTurret.position.set(0.20, 0.275, 0);
    this.robotRoot.add(lidarBase, this.lidarTurret);

    const mastGeo = new THREE.BoxGeometry(0.035, 0.28, 0.035);
    const mast = new THREE.Mesh(mastGeo, armJointMat);
    mast.position.set(0.22, 0.38, 0);
    const camBarGeo = new THREE.BoxGeometry(0.045, 0.045, 0.14);
    const camBar = new THREE.Mesh(camBarGeo, armWhiteMat);
    camBar.position.set(0.24, 0.53, 0);
    const lensGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.02, 12);
    const lensL = new THREE.Mesh(lensGeo, wheelMat);
    lensL.rotation.z = Math.PI / 2;
    lensL.position.set(0.265, 0.53, -0.04);
    const lensR = new THREE.Mesh(lensGeo, wheelMat);
    lensR.rotation.z = Math.PI / 2;
    lensR.position.set(0.265, 0.53, 0.04);
    this.robotRoot.add(mast, camBar, lensL, lensR);

    this.disposables.push(
      chassisGeo,
      topPlateGeo,
      bumperGeo,
      wheelGeo,
      hubGeo,
      lidarBaseGeo,
      lidarGeo,
      mastGeo,
      camBarGeo,
      lensGeo
    );

    const armRoot = new THREE.Group();
    armRoot.position.set(0, ARM_BASE_HEIGHT, 0);
    this.robotRoot.add(armRoot);

    this.waistGroup = new THREE.Group();
    armRoot.add(this.waistGroup);

    const pedGeo = new THREE.CylinderGeometry(0.075, 0.09, ARM_SHOULDER_OFFSET, 18);
    const ped = new THREE.Mesh(pedGeo, armWhiteMat);
    ped.position.y = ARM_SHOULDER_OFFSET / 2;
    ped.castShadow = true;
    const shJointGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.13, 16);
    const shJoint = new THREE.Mesh(shJointGeo, armJointMat);
    shJoint.rotation.x = Math.PI / 2;
    shJoint.position.y = ARM_SHOULDER_OFFSET;
    this.waistGroup.add(ped, shJoint);

    this.shoulderGroup = new THREE.Group();
    this.shoulderGroup.position.set(0, ARM_SHOULDER_OFFSET, 0);
    this.waistGroup.add(this.shoulderGroup);

    const upperGeo = new THREE.CylinderGeometry(0.052, 0.06, ARM_L1, 16);
    const upper = new THREE.Mesh(upperGeo, armWhiteMat);
    upper.position.y = ARM_L1 / 2;
    upper.castShadow = true;
    const bandGeo = new THREE.CylinderGeometry(0.057, 0.057, 0.05, 16);
    const band = new THREE.Mesh(bandGeo, armAccentMat);
    band.position.y = ARM_L1 * 0.55;
    const elJointGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.11, 16);
    const elJoint = new THREE.Mesh(elJointGeo, armJointMat);
    elJoint.rotation.x = Math.PI / 2;
    elJoint.position.y = ARM_L1;
    this.shoulderGroup.add(upper, band, elJoint);

    this.elbowGroup = new THREE.Group();
    this.elbowGroup.position.set(0, ARM_L1, 0);
    this.shoulderGroup.add(this.elbowGroup);

    const foreGeo = new THREE.CylinderGeometry(0.042, 0.05, ARM_L2, 16);
    const fore = new THREE.Mesh(foreGeo, armWhiteMat);
    fore.position.y = ARM_L2 / 2;
    fore.castShadow = true;
    const wrJointGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.09, 14);
    const wrJoint = new THREE.Mesh(wrJointGeo, armJointMat);
    wrJoint.rotation.x = Math.PI / 2;
    wrJoint.position.y = ARM_L2;
    this.elbowGroup.add(fore, wrJoint);

    this.wristGroup = new THREE.Group();
    this.wristGroup.position.set(0, ARM_L2, 0);
    this.elbowGroup.add(this.wristGroup);

    this.wristRollGroup = new THREE.Group();
    this.wristGroup.add(this.wristRollGroup);

    const palmGeo = new THREE.BoxGeometry(0.048, 0.055, 0.11);
    const palm = new THREE.Mesh(palmGeo, armJointMat);
    palm.position.y = 0.055;
    const fingerGeo = new THREE.BoxGeometry(0.022, 0.08, 0.016);
    this.fingerLeft = new THREE.Mesh(fingerGeo, hubMat);
    this.fingerLeft.position.set(0, ARM_EE_OFFSET - 0.025, -0.04);
    this.fingerRight = new THREE.Mesh(fingerGeo, hubMat);
    this.fingerRight.position.set(0, ARM_EE_OFFSET - 0.025, 0.04);
    this.wristRollGroup.add(palm, this.fingerLeft, this.fingerRight);

    this.disposables.push(
      pedGeo,
      shJointGeo,
      upperGeo,
      bandGeo,
      elJointGeo,
      foreGeo,
      wrJointGeo,
      palmGeo,
      fingerGeo
    );

    this.lidarPositions = new Float32Array(NUM_LIDAR_RAYS * 2 * 3);
    this.lidarColors = new Float32Array(NUM_LIDAR_RAYS * 2 * 3);
    const lidarGeom = new THREE.BufferGeometry();
    lidarGeom.setAttribute('position', new THREE.BufferAttribute(this.lidarPositions, 3));
    lidarGeom.setAttribute('color', new THREE.BufferAttribute(this.lidarColors, 3));
    const lidarLineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
    });
    this.lidarLines = new THREE.LineSegments(lidarGeom, lidarLineMat);
    this.lidarLines.frustumCulled = false;
    this.scene.add(this.lidarLines);
    this.disposables.push(lidarGeom, lidarLineMat);

    this.astarPositions = new Float32Array(64 * 3);
    const astarGeom = new THREE.BufferGeometry();
    astarGeom.setAttribute('position', new THREE.BufferAttribute(this.astarPositions, 3));
    const astarMat = new THREE.LineBasicMaterial({
      color: 0x22e3ff,
      linewidth: 2,
    });
    this.astarLine = new THREE.Line(astarGeom, astarMat);
    this.astarLine.frustumCulled = false;
    this.scene.add(this.astarLine);
    this.disposables.push(astarGeom, astarMat);

    this.mainCamera = new THREE.PerspectiveCamera(54, 760 / 720, 0.1, 30);
    this.mainCamera.position.copy(this.camPos);
    this.mainCamera.lookAt(this.camTgt);

    this.onboardCamera = new THREE.PerspectiveCamera(58, 248 / 186, 0.05, 14);
    this.onboardTarget = new THREE.WebGLRenderTarget(248, 186, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });
    this.onboardPixelBuf = new Uint8Array(248 * 186 * 4);
    this.onboardImageData = new ImageData(248, 186);
    this.disposables.push(this.onboardTarget);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.mainCamera);
    }
  }

  public setLayout(layoutId: LayoutId) {
    this.setCustomScene(layoutId, [], SORTING_BIN_POS);
  }

  public setCustomScene(
    layoutId: LayoutId,
    customObstacles: BoxObstacle[] = [],
    dropOffPos: [number, number] = SORTING_BIN_POS
  ) {
    this.binGroup.position.set(dropOffPos[0], 0, -dropOffPos[1]);

    const key = `${layoutId}|${customObstacles.map((o) => `${o.cx.toFixed(2)},${o.cy.toFixed(2)}`).join(';')}`;
    if (this.currentLayoutId === layoutId && this.customSceneKey === key && this.obstacleGeometries.length > 0) {
      return;
    }
    this.currentLayoutId = layoutId;
    this.customSceneKey = key;

    while (this.obstaclesGroup.children.length > 0) {
      this.obstaclesGroup.remove(this.obstaclesGroup.children[0]);
    }
    for (const geo of this.obstacleGeometries) {
      geo.dispose();
    }
    this.obstacleGeometries = [];

    const presetBoxes = LAYOUT_CONFIGS[layoutId].boxes.filter((b) => b.kind === 'obstacle');
    const buildObstacleMesh = (box: BoxObstacle, isCustom: boolean) => {
      const g = new THREE.Group();
      const baseGeo = new THREE.BoxGeometry(box.hx * 2, 0.12, box.hy * 2);
      const base = new THREE.Mesh(baseGeo, this.obsStripeMat);
      base.position.y = 0.06;
      const bodyGeo = new THREE.BoxGeometry(box.hx * 1.96, box.height - 0.16, box.hy * 1.96);
      const body = new THREE.Mesh(bodyGeo, isCustom ? this.customObsMat : this.obsMat);
      body.position.y = 0.12 + (box.height - 0.16) / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      const capGeo = new THREE.BoxGeometry(box.hx * 2, 0.04, box.hy * 2);
      const cap = new THREE.Mesh(capGeo, isCustom ? this.customObsCapMat : this.wallTrimMat);
      cap.position.y = box.height - 0.02;
      g.add(base, body, cap);
      g.position.set(box.cx, 0, -box.cy);
      this.obstaclesGroup.add(g);
      this.obstacleGeometries.push(baseGeo, bodyGeo, capGeo);
    };

    for (const box of presetBoxes) {
      buildObstacleMesh(box, false);
    }
    for (const box of customObstacles) {
      buildObstacleMesh(box, true);
    }
  }

  public syncAndRender(
    state: SimFrameState,
    smoothCamera: boolean,
    showLidarRays = true,
    cameraAngle: CameraAngle = 'follow'
  ): { mainCanvas: HTMLCanvasElement; onboard: OnboardDetection } {
    this.setCustomScene(state.layoutId, state.customObstacles, state.dropOffPos);
    this.robotRoot.position.set(state.rx, 0, -state.ry);
    this.robotRoot.rotation.y = state.yaw;
    this.lidarTurret.rotation.y += 0.32;

    const navWarning = state.proximityWarning;
    const flashHigh = Math.floor(state.simFrame / 4) % 2 === 0;
    if (navWarning && flashHigh) {
      this.bumperMat.color.setHex(0xff3b3b);
      this.bumperMat.emissive.setHex(0xdc2626);
      this.bumperMat.emissiveIntensity = 1.4;
    } else if (navWarning) {
      this.bumperMat.color.setHex(0x991b1b);
      this.bumperMat.emissive.setHex(0x7f1d1d);
      this.bumperMat.emissiveIntensity = 0.65;
    } else {
      this.bumperMat.color.setHex(0x00c8f0);
      this.bumperMat.emissive.setHex(0x007ca0);
      this.bumperMat.emissiveIntensity = 0.55;
    }

    this.waistGroup.rotation.y = state.arm.joints[0];
    this.shoulderGroup.rotation.z = -state.arm.joints[1];
    this.elbowGroup.rotation.z = state.arm.joints[3];
    this.wristGroup.rotation.z = -state.arm.joints[5];
    this.wristRollGroup.rotation.y = state.arm.joints[6];
    this.fingerLeft.position.z = -(state.arm.gripperOpening + 0.008);
    this.fingerRight.position.z = state.arm.gripperOpening + 0.008;

    this.redCube.position.set(state.cubePos[0], state.cubePos[2], -state.cubePos[1]);

    for (let i = 0; i < NUM_LIDAR_RAYS; i++) {
      const idx6 = i * 6;
      const sx = state.lidarStarts[i * 3];
      const sy = state.lidarStarts[i * 3 + 1];
      const sz = state.lidarStarts[i * 3 + 2];
      const hx = state.lidarHits[i * 3];
      const hy = state.lidarHits[i * 3 + 1];
      const hz = state.lidarHits[i * 3 + 2];

      this.lidarPositions[idx6] = sx;
      this.lidarPositions[idx6 + 1] = sz;
      this.lidarPositions[idx6 + 2] = -sy;
      this.lidarPositions[idx6 + 3] = hx;
      this.lidarPositions[idx6 + 4] = hz;
      this.lidarPositions[idx6 + 5] = -hy;

      const close = state.lidarDists[i] < CRITICAL_LIDAR_DIST;
      const r = close ? 1.0 : 0.22;
      const g = close ? 0.24 : 0.94;
      const b = close ? 0.22 : 0.34;
      this.lidarColors[idx6] = r;
      this.lidarColors[idx6 + 1] = g;
      this.lidarColors[idx6 + 2] = b;
      this.lidarColors[idx6 + 3] = r;
      this.lidarColors[idx6 + 4] = g;
      this.lidarColors[idx6 + 5] = b;
    }
    this.lidarLines.geometry.attributes.position.needsUpdate = true;
    this.lidarLines.geometry.attributes.color.needsUpdate = true;

    if (state.showAstar && state.astarPath.length > 1) {
      this.astarLine.visible = true;
      const count = Math.min(64, state.astarPath.length);
      for (let i = 0; i < count; i++) {
        this.astarPositions[i * 3] = state.astarPath[i][0];
        this.astarPositions[i * 3 + 1] = 0.04;
        this.astarPositions[i * 3 + 2] = -state.astarPath[i][1];
      }
      this.astarLine.geometry.setDrawRange(0, count);
      this.astarLine.geometry.attributes.position.needsUpdate = true;
    } else {
      this.astarLine.visible = false;
    }

    let targetFov = 54;
    if (cameraAngle === 'fixed') {
      targetFov = 52;
      this.desiredPos.set(-3.45, 4.15, 3.45);
      this.desiredTgt.set(0.45, 0.25, -0.15);
    } else if (cameraAngle === 'first-person') {
      targetFov = 66;
      const eyeX = state.rx + 0.16 * Math.cos(state.yaw);
      const eyeY = state.ry + 0.16 * Math.sin(state.yaw);
      const lookX = state.rx + 1.45 * Math.cos(state.yaw);
      const lookY = state.ry + 1.45 * Math.sin(state.yaw);
      this.desiredPos.set(eyeX, 0.74, -eyeY);
      this.desiredTgt.set(lookX, 0.34, -lookY);
    } else {
      targetFov = 54;
      const carryingRemote =
        state.stageNum === 5 &&
        Math.hypot(state.dropOffPos[0] - 1.62, state.dropOffPos[1] - 0.80) > 0.68 &&
        Math.hypot(state.rx - 1.62, state.ry - 0.80) > 0.16;
      if (state.stageNum <= 3 || carryingRemote) {
        const chaseDist = 1.95;
        const px = THREE.MathUtils.clamp(state.rx - chaseDist * Math.cos(state.yaw), -3.85, 3.85);
        const pz = THREE.MathUtils.clamp(-(state.ry - chaseDist * Math.sin(state.yaw)), -2.85, 2.85);
        this.desiredPos.set(px, 1.95, pz);
        this.desiredTgt.set(
          state.rx + 0.55 * Math.cos(state.yaw),
          0.34,
          -(state.ry + 0.55 * Math.sin(state.yaw))
        );
      } else {
        this.desiredTgt.set(1.94, 0.36, -0.58);
        this.desiredPos.set(2.68, 1.36, 0.92);
      }
    }

    if (this.mainCamera.fov !== targetFov) {
      this.mainCamera.fov = targetFov;
      this.mainCamera.updateProjectionMatrix();
    }

    const switchedAngle = this.lastCameraAngle !== cameraAngle;
    this.lastCameraAngle = cameraAngle;

    if (smoothCamera && cameraAngle === 'follow' && !switchedAngle) {
      this.camPos.lerp(this.desiredPos, 0.14);
      this.camTgt.lerp(this.desiredTgt, 0.14);
    } else {
      this.camPos.copy(this.desiredPos);
      this.camTgt.copy(this.desiredTgt);
    }
    this.mainCamera.position.copy(this.camPos);
    this.mainCamera.lookAt(this.camTgt);

    const obPosX = state.rx + 0.24 * Math.cos(state.yaw);
    const obPosY = state.ry + 0.24 * Math.sin(state.yaw);
    const obTgtX = state.rx + 0.92 * Math.cos(state.yaw);
    const obTgtY = state.ry + 0.92 * Math.sin(state.yaw);
    this.onboardCamera.position.set(obPosX, 0.56, -obPosY);
    this.onboardCamera.lookAt(obTgtX, 0.38, -obTgtY);

    this.lidarLines.visible = false;
    this.astarLine.visible = false;
    this.renderer.setRenderTarget(this.onboardTarget);
    this.renderer.render(this.scene, this.onboardCamera);
    this.renderer.readRenderTargetPixels(
      this.onboardTarget,
      0,
      0,
      248,
      186,
      this.onboardPixelBuf
    );
    this.renderer.setRenderTarget(null);

    this.lidarLines.visible = showLidarRays;
    if (state.showAstar && state.astarPath.length > 1) {
      this.astarLine.visible = true;
    }

    const onboard = this.extractRedCubeDetection();

    this.renderer.render(this.scene, this.mainCamera);
    return {
      mainCanvas: this.renderer.domElement,
      onboard,
    };
  }

  private extractRedCubeDetection(): OnboardDetection {
    const w = 248;
    const h = 186;
    const dst = this.onboardImageData.data;
    const src = this.onboardPixelBuf;

    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;
    let count = 0;

    for (let y = 0; y < h; y++) {
      const srcRow = (h - 1 - y) * w * 4;
      const dstRow = y * w * 4;
      for (let x = 0; x < w; x++) {
        const sIdx = srcRow + x * 4;
        const dIdx = dstRow + x * 4;
        const r = src[sIdx];
        const g = src[sIdx + 1];
        const b = src[sIdx + 2];
        dst[dIdx] = r;
        dst[dIdx + 1] = g;
        dst[dIdx + 2] = b;
        dst[dIdx + 3] = 255;

        if (r > 120 && r > g * 1.85 && r > b * 1.85 && r - Math.max(g, b) > 55) {
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const detected = count > 22 && maxX >= minX && maxY >= minY;
    return {
      imageData: this.onboardImageData,
      detected,
      bbox: detected
        ? {
            x: minX,
            y: minY,
            w: maxX - minX + 1,
            h: maxY - minY + 1,
            cx: Math.round((minX + maxX) / 2),
            cy: Math.round((minY + maxY) / 2),
          }
        : null,
    };
  }

  public setLighting(config: StudioLightingConfig) {
    const intensity = Math.max(0.25, Math.min(2.2, config.intensity));
    kelvinToThreeColor(config.temperatureK, this.tempColor);

    this.keyLight.intensity = 2.1 * intensity;
    this.keyLight.color.copy(this.tempColor);

    this.hemiLight.intensity = 0.72 * (0.4 + 0.6 * intensity);
    this.hemiLight.color.copy(this.tempColor).lerp(this.coolBlueColor, 0.35);

    this.rimLight.intensity = 0.65 * (0.35 + 0.65 * intensity);
    this.rimLight.color.copy(this.rimBaseColor).lerp(this.tempColor, 0.35);

    this.scene.environmentIntensity = Math.max(0.22, 0.92 * intensity);
    this.renderer.toneMappingExposure = 0.85 + 0.3 * intensity;
  }

  public dispose() {
    for (const geo of this.obstacleGeometries) {
      geo.dispose();
    }
    this.obstacleGeometries = [];
    for (const item of this.disposables) {
      item.dispose();
    }
    this.renderer.dispose();
  }
}
