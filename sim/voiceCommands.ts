import { INTRO_FRAMES, LayoutId, SIM_FRAMES, STAGE_COUNTS } from './slamPlanner';
import { CameraMode } from './videoCompositor';

export type VoiceCommandAction =
  | { type: 'start-simulation'; label: string }
  | { type: 'play'; label: string }
  | { type: 'pause'; label: string }
  | { type: 'restart'; label: string }
  | { type: 'set-camera'; mode: CameraMode; label: string }
  | { type: 'set-layout'; layoutId: LayoutId; label: string }
  | { type: 'set-lidar'; show: boolean; label: string }
  | { type: 'set-dilation'; scale: number; label: string }
  | { type: 'seek-frame'; frame: number; label: string }
  | { type: 'open-grid-editor'; label: string }
  | { type: 'export-mp4'; label: string };

export const VOICE_COMMAND_EXAMPLES = [
  'Start simulation',
  'Restart video',
  'Pause simulation',
  'Set camera to follow mode',
  'First-person camera',
  'Fixed camera',
  'Auto camera',
  'Slow motion',
  'Corridor maze',
];

function normalizeSpeech(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\w\s*-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseVoiceCommand(rawTranscript: string): VoiceCommandAction | null {
  const text = normalizeSpeech(rawTranscript);
  if (!text) return null;

  // Check "restart" / "reset" before "start" so "restart video" never triggers "start"
  if (
    text.includes('restart') ||
    text.includes('start over') ||
    text.includes('from the beginning') ||
    text.includes('reset video') ||
    text.includes('replay')
  ) {
    return { type: 'restart', label: 'Restart Video' };
  }

  // Pause / stop commands
  if (
    text.includes('pause') ||
    text.includes('stop simulation') ||
    text.includes('stop video') ||
    text.includes('freeze') ||
    text === 'stop'
  ) {
    return { type: 'pause', label: 'Pause Simulation' };
  }

  // Start simulation / run simulation
  if (
    text.includes('start simulation') ||
    text.includes('run simulation') ||
    text.includes('run sim') ||
    text.includes('begin simulation') ||
    text.includes('launch simulation')
  ) {
    return { type: 'start-simulation', label: 'Start Simulation' };
  }

  // Resume / play commands
  if (
    text.includes('resume') ||
    text.includes('play video') ||
    text.includes('play simulation') ||
    text === 'play' ||
    text === 'start'
  ) {
    return { type: 'play', label: 'Play Video' };
  }

  // Camera modes
  if (
    text.includes('first person') ||
    text.includes('first-person') ||
    text.includes('1st person') ||
    text.includes('robot view') ||
    text.includes('onboard camera') ||
    text.includes('pov')
  ) {
    return { type: 'set-camera', mode: 'first-person', label: 'Camera: First-Person' };
  }

  if (text.includes('follow')) {
    return { type: 'set-camera', mode: 'follow', label: 'Camera: Follow' };
  }

  if (text.includes('fixed') || text.includes('overhead') || text.includes('top view')) {
    return { type: 'set-camera', mode: 'fixed', label: 'Camera: Fixed' };
  }

  if (
    text.includes('auto camera') ||
    text.includes('auto cycle') ||
    text.includes('cycle camera') ||
    text.includes('automatic camera') ||
    text.includes('camera to auto')
  ) {
    return { type: 'set-camera', mode: 'auto', label: 'Camera: Auto Cycle' };
  }

  // Floor layouts
  if (text.includes('open space')) {
    return { type: 'set-layout', layoutId: 'open-space', label: 'Layout: Open Space' };
  }
  if (text.includes('corridor') || text.includes('maze')) {
    return { type: 'set-layout', layoutId: 'corridor-maze', label: 'Layout: Corridor Maze' };
  }
  if (text.includes('narrow') || text.includes('aisle')) {
    return { type: 'set-layout', layoutId: 'narrow-aisles', label: 'Layout: Narrow Aisles' };
  }

  // LiDAR visibility
  if (text.includes('hide lidar') || text.includes('hide rays') || text.includes('disable lidar')) {
    return { type: 'set-lidar', show: false, label: 'LiDAR Rays: Hide' };
  }
  if (text.includes('show lidar') || text.includes('show rays') || text.includes('enable lidar')) {
    return { type: 'set-lidar', show: true, label: 'LiDAR Rays: Show' };
  }

  // Time dilation
  if (text.includes('slow motion') || text.includes('slow down') || text.includes('half speed')) {
    return { type: 'set-dilation', scale: 0.5, label: 'Speed: 0.50x (Slow-Mo)' };
  }
  if (
    text.includes('normal speed') ||
    text.includes('real time') ||
    text.includes('realtime') ||
    text.includes('reset speed')
  ) {
    return { type: 'set-dilation', scale: 1.0, label: 'Speed: 1.00x (Real-Time)' };
  }
  if (text.includes('speed up') || text.includes('fast forward') || text.includes('double speed')) {
    return { type: 'set-dilation', scale: 2.0, label: 'Speed: 2.00x (Fast)' };
  }

  // Stage chapters
  if (text.includes('sensor init')) {
    return { type: 'seek-frame', frame: INTRO_FRAMES, label: 'Jump: Sensor Init' };
  }
  if (text.includes('slam') && (text.includes('jump') || text.includes('stage') || text.includes('go to'))) {
    return {
      type: 'seek-frame',
      frame: INTRO_FRAMES + STAGE_COUNTS[0],
      label: 'Jump: LiDAR SLAM',
    };
  }
  if (text.includes('a star') || text.includes('a*') || text.includes('path planning') || text.includes('navigation')) {
    return {
      type: 'seek-frame',
      frame: INTRO_FRAMES + STAGE_COUNTS[0] + STAGE_COUNTS[1],
      label: 'Jump: A* Nav',
    };
  }
  if (text.includes('vision') || text.includes('detection')) {
    return {
      type: 'seek-frame',
      frame: INTRO_FRAMES + STAGE_COUNTS[0] + STAGE_COUNTS[1] + STAGE_COUNTS[2],
      label: 'Jump: 3D Vision',
    };
  }
  if (text.includes('grasp') || text.includes('pick and place') || text.includes('pickup')) {
    return {
      type: 'seek-frame',
      frame:
        INTRO_FRAMES + STAGE_COUNTS[0] + STAGE_COUNTS[1] + STAGE_COUNTS[2] + STAGE_COUNTS[3],
      label: 'Jump: IK Grasp',
    };
  }
  if (text.includes('benchmark') || text.includes('summary') || text.includes('outro')) {
    return {
      type: 'seek-frame',
      frame: INTRO_FRAMES + SIM_FRAMES,
      label: 'Jump: Benchmark',
    };
  }

  // Grid editor & MP4 export
  if (text.includes('draw grid') || text.includes('grid editor') || text.includes('edit floor')) {
    return { type: 'open-grid-editor', label: 'Open Grid Editor' };
  }
  if (text.includes('export video') || text.includes('export mp4') || text.includes('render video')) {
    return { type: 'export-mp4', label: 'Export MP4 Video' };
  }

  return null;
}
