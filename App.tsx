import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  DraftingCompass,
  Film,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { ConfigPanelTab, LayoutConfigPanel } from './components/LayoutConfigPanel';
import { VoiceControlButton } from './components/VoiceControlButton';
import { Factory3DStudio, StudioLightingConfig } from './sim/factoryScene';
import {
  BoxObstacle,
  FPS,
  INTRO_FRAMES,
  LAYOUT_CONFIGS,
  LayoutId,
  SIM_FRAMES,
  SORTING_BIN_POS,
  STAGE_COUNTS,
  SimFrameState,
  TOTAL_FRAMES,
  buildSimulationTimeline,
} from './sim/slamPlanner';
import { CameraMode, DocumentaryVideoCompositor } from './sim/videoCompositor';
import { VoiceCommandAction } from './sim/voiceCommands';

interface ChapterMarker {
  id: string;
  label: string;
  frame: number;
}

const CHAPTERS: ChapterMarker[] = [
  { id: 'intro', label: 'Intro', frame: 0 },
  { id: 's1', label: 'Sensor Init', frame: INTRO_FRAMES },
  { id: 's2', label: 'LiDAR SLAM', frame: INTRO_FRAMES + STAGE_COUNTS[0] },
  { id: 's3', label: 'A* Nav', frame: INTRO_FRAMES + STAGE_COUNTS[0] + STAGE_COUNTS[1] },
  {
    id: 's4',
    label: '3D Vision',
    frame: INTRO_FRAMES + STAGE_COUNTS[0] + STAGE_COUNTS[1] + STAGE_COUNTS[2],
  },
  {
    id: 's5',
    label: 'IK Grasp',
    frame:
      INTRO_FRAMES + STAGE_COUNTS[0] + STAGE_COUNTS[1] + STAGE_COUNTS[2] + STAGE_COUNTS[3],
  },
  { id: 'outro', label: 'Benchmark', frame: INTRO_FRAMES + SIM_FRAMES },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const studioRef = useRef<Factory3DStudio | null>(null);
  const compositorRef = useRef<DocumentaryVideoCompositor | null>(null);

  const [selectedLayout, setSelectedLayout] = useState<LayoutId>('open-space');
  const [configTab, setConfigTab] = useState<ConfigPanelTab>('presets');
  const [customObstacles, setCustomObstacles] = useState<BoxObstacle[]>([]);
  const [dropOffPos, setDropOffPos] = useState<[number, number]>([...SORTING_BIN_POS]);
  const [showLidarRays, setShowLidarRays] = useState(true);
  const [timeDilation, setTimeDilation] = useState(1.0);
  const [lighting, setLighting] = useState<StudioLightingConfig>({
    intensity: 1.0,
    temperatureK: 5500,
  });
  const [showArchitecturalOverlay, setShowArchitecturalOverlay] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('auto');

  const timelineCacheRef = useRef<Map<string, SimFrameState[]>>(new Map());
  const getOrBuildTimeline = useCallback(
    (layoutId: LayoutId, obstacles: BoxObstacle[], binPos: [number, number]): SimFrameState[] => {
      const key = JSON.stringify({
        layoutId,
        obs: obstacles.map((o) => [o.cx, o.cy]),
        binPos,
      });
      const existing = timelineCacheRef.current.get(key);
      if (existing) return existing;
      const built = buildSimulationTimeline(layoutId, {
        customObstacles: obstacles,
        dropOffPos: binPos,
      });
      if (timelineCacheRef.current.size >= 12) {
        const firstKey = timelineCacheRef.current.keys().next().value;
        if (firstKey !== undefined) timelineCacheRef.current.delete(firstKey);
      }
      timelineCacheRef.current.set(key, built);
      return built;
    },
    []
  );

  const timeline = useMemo(
    () => getOrBuildTimeline(selectedLayout, customObstacles, dropOffPos),
    [customObstacles, dropOffPos, getOrBuildTimeline, selectedLayout]
  );

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [dockOpen, setDockOpen] = useState(true);
  const [contextLost, setContextLost] = useState(false);

  const [exportState, setExportState] = useState<
    | { status: 'idle' }
    | { status: 'rendering'; progress: number; phase: string }
    | { status: 'ready'; videoUrl: string; downloadUrl: string; sizeMb: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' });
  const [viewMode, setViewMode] = useState<'studio' | 'mp4'>('studio');

  const frameRef = useRef(0);
  const frameAccumRef = useRef(0);
  const isPlayingRef = useRef(true);
  const exportingRef = useRef(false);
  const timelineRef = useRef<SimFrameState[]>(timeline);
  const showLidarRef = useRef(true);
  const dilationRef = useRef(1.0);
  const cameraModeRef = useRef<CameraMode>('auto');
  const showArchOverlayRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  useEffect(() => {
    showLidarRef.current = showLidarRays;
  }, [showLidarRays]);

  useEffect(() => {
    dilationRef.current = timeDilation;
  }, [timeDilation]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    showArchOverlayRef.current = showArchitecturalOverlay;
  }, [showArchitecturalOverlay]);

  const drawSingleFrame = useCallback((frameIdx: number, smoothCamera: boolean) => {
    const canvas = canvasRef.current;
    const studio = studioRef.current;
    const compositor = compositorRef.current;
    if (!canvas || !studio || !compositor) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const clamped = Math.max(0, Math.min(TOTAL_FRAMES - 1, frameIdx));
    compositor.renderFrame(
      ctx,
      clamped,
      timelineRef.current,
      studio,
      smoothCamera,
      showLidarRef.current,
      cameraModeRef.current,
      showArchOverlayRef.current
    );
  }, []);

  useEffect(() => {
    const studio = new Factory3DStudio();
    const compositor = new DocumentaryVideoCompositor(() => {
      if (!isPlayingRef.current && frameRef.current < INTRO_FRAMES) {
        drawSingleFrame(frameRef.current, false);
      }
    });
    studioRef.current = studio;
    compositorRef.current = compositor;

    const webglCanvas = studio.renderer.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => {
      setContextLost(false);
    };
    webglCanvas.addEventListener('webglcontextlost', onLost);
    webglCanvas.addEventListener('webglcontextrestored', onRestored);

    drawSingleFrame(0, false);

    let rafId = 0;
    let timerId = 0;
    let lastTime = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = studio.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (!sync) {
          timerId = window.setTimeout(cb, 80);
          return;
        }
        const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          timerId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          timerId = window.setTimeout(cb, 80);
        }
      };
      timerId = window.setTimeout(poll, 5);
    };

    const tick = (now: number) => {
      if (!exportingRef.current && isPlayingRef.current) {
        const elapsed = Math.min(0.1, (now - lastTime) / 1000);
        lastTime = now;
        frameAccumRef.current =
          (frameAccumRef.current + elapsed * FPS * dilationRef.current) % TOTAL_FRAMES;
        const next = Math.floor(frameAccumRef.current);
        if (next !== frameRef.current) {
          frameRef.current = next;
          setCurrentFrame(next);
          drawSingleFrame(next, next > INTRO_FRAMES);
        }
      } else {
        lastTime = now;
      }

      if (studio.isSoftwareGl) {
        afterDraw(() => {
          rafId = requestAnimationFrame(tick);
        });
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      webglCanvas.removeEventListener('webglcontextlost', onLost);
      webglCanvas.removeEventListener('webglcontextrestored', onRestored);
      studio.dispose();
      studioRef.current = null;
      compositorRef.current = null;
    };
  }, [drawSingleFrame]);

  const seekToFrame = (target: number) => {
    const clamped = Math.max(0, Math.min(TOTAL_FRAMES - 1, target));
    frameRef.current = clamped;
    frameAccumRef.current = clamped;
    setCurrentFrame(clamped);
    setViewMode('studio');
    drawSingleFrame(clamped, false);
  };

  const handleTogglePlay = () => {
    setViewMode('studio');
    setIsPlaying((prev) => !prev);
  };

  const handleRestart = () => {
    setViewMode('studio');
    frameRef.current = 0;
    frameAccumRef.current = 0;
    setCurrentFrame(0);
    setIsPlaying(true);
    drawSingleFrame(0, false);
  };

  const previewCustomSceneIn3D = useCallback(
    (layoutId: LayoutId, nextObs: BoxObstacle[], nextDrop: [number, number]) => {
      if (exportingRef.current) return;
      const nextTimeline = getOrBuildTimeline(layoutId, nextObs, nextDrop);
      timelineRef.current = nextTimeline;
      studioRef.current?.setCustomScene(layoutId, nextObs, nextDrop);
      setExportState({ status: 'idle' });
      setViewMode('studio');
      setIsPlaying(false);
      isPlayingRef.current = false;

      const targetFrame =
        frameRef.current < INTRO_FRAMES || frameRef.current >= INTRO_FRAMES + SIM_FRAMES
          ? INTRO_FRAMES
          : frameRef.current;
      frameRef.current = targetFrame;
      frameAccumRef.current = targetFrame;
      setCurrentFrame(targetFrame);
      drawSingleFrame(targetFrame, false);
    },
    [drawSingleFrame, getOrBuildTimeline]
  );

  const handleChangeConfigTab = (tab: ConfigPanelTab) => {
    setConfigTab(tab);
    if (
      tab === 'grid' &&
      !exportingRef.current &&
      (frameRef.current < INTRO_FRAMES || frameRef.current >= INTRO_FRAMES + SIM_FRAMES)
    ) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      seekToFrame(INTRO_FRAMES);
    }
  };

  const handleChangeCustomObstacles = (nextObs: BoxObstacle[]) => {
    setCustomObstacles(nextObs);
    previewCustomSceneIn3D(selectedLayout, nextObs, dropOffPos);
  };

  const handleChangeDropOffPos = (nextDrop: [number, number]) => {
    setDropOffPos(nextDrop);
    previewCustomSceneIn3D(selectedLayout, customObstacles, nextDrop);
  };

  const handleResetCustomScene = () => {
    const defaultDrop: [number, number] = [...SORTING_BIN_POS];
    setCustomObstacles([]);
    setDropOffPos(defaultDrop);
    previewCustomSceneIn3D(selectedLayout, [], defaultDrop);
  };

  const handleRunCustomSimulation = () => {
    if (exportingRef.current) return;
    const nextTimeline = getOrBuildTimeline(selectedLayout, customObstacles, dropOffPos);
    timelineRef.current = nextTimeline;
    studioRef.current?.setCustomScene(selectedLayout, customObstacles, dropOffPos);
    setViewMode('studio');
    frameRef.current = INTRO_FRAMES;
    frameAccumRef.current = INTRO_FRAMES;
    setCurrentFrame(INTRO_FRAMES);
    setIsPlaying(true);
    isPlayingRef.current = true;
    drawSingleFrame(INTRO_FRAMES, false);
  };

  const handleSelectLayout = (layoutId: LayoutId) => {
    if (exportingRef.current) return;
    const defaultDrop: [number, number] = [...SORTING_BIN_POS];
    setSelectedLayout(layoutId);
    setCustomObstacles([]);
    setDropOffPos(defaultDrop);
    timelineRef.current = getOrBuildTimeline(layoutId, [], defaultDrop);
    studioRef.current?.setCustomScene(layoutId, [], defaultDrop);
    setExportState({ status: 'idle' });
    setViewMode('studio');
    const previewFrame = INTRO_FRAMES + STAGE_COUNTS[0];
    frameRef.current = previewFrame;
    frameAccumRef.current = previewFrame;
    setCurrentFrame(previewFrame);
    setIsPlaying(true);
    drawSingleFrame(previewFrame, false);
  };

  const handleToggleLidarRays = () => {
    setShowLidarRays((prev) => {
      const next = !prev;
      showLidarRef.current = next;
      if (!isPlayingRef.current) {
        drawSingleFrame(frameRef.current, false);
      }
      return next;
    });
  };

  const handleVoiceCommand = (action: VoiceCommandAction) => {
    if (exportingRef.current) return;
    switch (action.type) {
      case 'start-simulation':
        handleRunCustomSimulation();
        break;
      case 'play':
        setViewMode('studio');
        setIsPlaying(true);
        isPlayingRef.current = true;
        break;
      case 'pause':
        setIsPlaying(false);
        isPlayingRef.current = false;
        break;
      case 'restart':
        handleRestart();
        break;
      case 'set-camera':
        handleChangeCameraMode(action.mode);
        break;
      case 'set-layout':
        handleSelectLayout(action.layoutId);
        break;
      case 'set-lidar':
        setShowLidarRays(action.show);
        showLidarRef.current = action.show;
        if (!isPlayingRef.current) {
          drawSingleFrame(frameRef.current, false);
        }
        break;
      case 'set-dilation':
        setTimeDilation(action.scale);
        break;
      case 'seek-frame':
        setIsPlaying(false);
        isPlayingRef.current = false;
        seekToFrame(action.frame);
        break;
      case 'open-grid-editor':
        handleChangeConfigTab('grid');
        break;
      case 'export-mp4':
        void handleExportMp4();
        break;
    }
  };

  const handleChangeCameraMode = (mode: CameraMode) => {
    setCameraMode(mode);
    cameraModeRef.current = mode;
    setViewMode('studio');
    if (!isPlayingRef.current) {
      drawSingleFrame(frameRef.current, false);
    }
  };

  const handleChangeLighting = (next: StudioLightingConfig) => {
    setLighting(next);
    studioRef.current?.setLighting(next);
    setViewMode('studio');
    if (frameRef.current < INTRO_FRAMES || frameRef.current >= INTRO_FRAMES + SIM_FRAMES) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      seekToFrame(INTRO_FRAMES);
    } else if (!isPlayingRef.current) {
      drawSingleFrame(frameRef.current, false);
    }
  };

  const handleToggleArchitecturalOverlay = () => {
    setShowArchitecturalOverlay((prev) => {
      const next = !prev;
      showArchOverlayRef.current = next;
      setViewMode('studio');
      if (
        next &&
        (frameRef.current < INTRO_FRAMES || frameRef.current >= INTRO_FRAMES + SIM_FRAMES)
      ) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        seekToFrame(INTRO_FRAMES);
      } else if (!isPlayingRef.current) {
        drawSingleFrame(frameRef.current, false);
      }
      return next;
    });
  };

  const handleExportMp4 = async () => {
    if (exportingRef.current) return;
    const canvas = canvasRef.current;
    const studio = studioRef.current;
    const compositor = compositorRef.current;
    if (!canvas || !studio || !compositor) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    exportingRef.current = true;
    setIsPlaying(false);
    setViewMode('studio');
    setExportState({ status: 'rendering', progress: 0, phase: 'Initializing FFmpeg encoder...' });

    try {
      const initRes = await fetch('/api/export/init', { method: 'POST' });
      if (!initRes.ok) throw new Error('Failed to initialize export session');
      const { jobId } = (await initRes.json()) as { jobId: string };

      const batchSize = 30;
      let batch: Array<{ index: number; dataUrl: string }> = [];

      for (let f = 0; f < TOTAL_FRAMES; f++) {
        compositor.renderFrame(
          ctx,
          f,
          timelineRef.current,
          studio,
          f > INTRO_FRAMES,
          showLidarRef.current,
          cameraModeRef.current,
          showArchOverlayRef.current
        );
        const dataUrl = canvas.toDataURL('image/jpeg', 0.91);
        batch.push({ index: f, dataUrl });

        if (batch.length === batchSize || f === TOTAL_FRAMES - 1) {
          const uploadRes = await fetch(`/api/export/batch/${jobId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frames: batch }),
          });
          if (!uploadRes.ok) throw new Error('Failed uploading rendered frames');
          batch = [];
          const pct = Math.round(((f + 1) / TOTAL_FRAMES) * 85);
          setExportState({
            status: 'rendering',
            progress: pct,
            phase: `Rendering frame ${f + 1} / ${TOTAL_FRAMES} (1280x720 @ 30 FPS)`,
          });
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      setExportState({
        status: 'rendering',
        progress: 92,
        phase: 'Encoding H.264 MP4 with FFmpeg...',
      });

      const finRes = await fetch(`/api/export/finalize/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fps: FPS }),
      });
      if (!finRes.ok) {
        const errBody = await finRes.json().catch(() => ({}));
        throw new Error(errBody.error || 'FFmpeg MP4 encoding failed');
      }

      const finData = (await finRes.json()) as {
        videoUrl: string;
        downloadUrl: string;
        sizeBytes: number;
      };
      const sizeMb = (finData.sizeBytes / (1024 * 1024)).toFixed(2);
      setExportState({
        status: 'ready',
        videoUrl: finData.videoUrl,
        downloadUrl: finData.downloadUrl,
        sizeMb,
      });
      setViewMode('mp4');
    } catch (err) {
      setExportState({
        status: 'error',
        message: err instanceof Error ? err.message : 'MP4 export failed',
      });
    } finally {
      exportingRef.current = false;
    }
  };

  const activeChapter = useMemo(() => {
    let found = CHAPTERS[0].id;
    for (const ch of CHAPTERS) {
      if (currentFrame >= ch.frame) found = ch.id;
    }
    return found;
  }, [currentFrame]);

  const timeSec = (currentFrame / FPS).toFixed(1).padStart(4, '0');
  const totalSec = (TOTAL_FRAMES / FPS).toFixed(1);

  const liveBatteryPct = useMemo(() => {
    if (timeline.length === 0) return 99.4;
    if (currentFrame < INTRO_FRAMES) return timeline[0].batteryPct;
    if (currentFrame >= INTRO_FRAMES + SIM_FRAMES) {
      return timeline[timeline.length - 1].batteryPct;
    }
    return timeline[currentFrame - INTRO_FRAMES].batteryPct;
  }, [currentFrame, timeline]);

  const batteryCritical = liveBatteryPct < 25;
  const batteryWarning = liveBatteryPct >= 25 && liveBatteryPct < 50;
  const filledSegments = Math.max(1, Math.min(10, Math.round(liveBatteryPct / 10)));

  return (
    <div className="min-h-screen bg-[#090d14] text-slate-100 flex flex-col">
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800/90 bg-[#0c111b]">
        <a
          href="#viewport"
          onClick={(e) => {
            e.preventDefault();
            seekToFrame(0);
          }}
          className="font-display text-lg font-bold tracking-wide text-slate-100 whitespace-nowrap shrink-0"
        >
          VIKRAM-SLAM Studio
        </a>

        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-400">
          {CHAPTERS.slice(0, 5).map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => seekToFrame(ch.frame)}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeChapter === ch.id
                  ? 'text-cyan-400'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <VoiceControlButton
            onCommand={handleVoiceCommand}
            disabled={exportState.status === 'rendering'}
          />

          <button
            type="button"
            onClick={handleToggleArchitecturalOverlay}
            disabled={exportState.status === 'rendering'}
            aria-pressed={showArchitecturalOverlay}
            title="Toggle semi-transparent technical blueprint & room alignment grid over the 3D viewport"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
              showArchitecturalOverlay
                ? 'bg-cyan-500/20 border-cyan-400/80 text-cyan-200'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200'
            }`}
          >
            <DraftingCompass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Architectural Overlay</span>
          </button>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <Camera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <label htmlFor="camera-mode-select" className="text-xs font-medium text-slate-400 whitespace-nowrap hidden sm:inline">
              Camera
            </label>
            <select
              id="camera-mode-select"
              aria-label="Camera Mode"
              value={cameraMode}
              disabled={exportState.status === 'rendering'}
              onChange={(e) => handleChangeCameraMode(e.target.value as CameraMode)}
              className="bg-transparent text-xs font-medium text-slate-100 focus:outline-none cursor-pointer disabled:opacity-60"
            >
              <option value="auto" className="bg-slate-900 text-slate-100">
                Auto Cycle (All Angles)
              </option>
              <option value="fixed" className="bg-slate-900 text-slate-100">
                Fixed
              </option>
              <option value="follow" className="bg-slate-900 text-slate-100">
                Follow
              </option>
              <option value="first-person" className="bg-slate-900 text-slate-100">
                First-Person
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportMp4}
            disabled={exportState.status === 'rendering'}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Film className="w-3.5 h-3.5" />
            {exportState.status === 'rendering' ? 'Rendering MP4...' : 'Export MP4 Video'}
          </button>
        </div>
      </header>

      <main
        id="viewport"
        className="flex-1 flex flex-col items-center justify-center px-5 py-4 relative overflow-x-hidden"
      >
        <div className="w-full max-w-[1440px] flex flex-col lg:flex-row items-start gap-5">
          <LayoutConfigPanel
            selectedLayout={selectedLayout}
            onSelectLayout={handleSelectLayout}
            activeTab={configTab}
            onChangeTab={handleChangeConfigTab}
            customObstacles={customObstacles}
            dropOffPos={dropOffPos}
            onChangeCustomObstacles={handleChangeCustomObstacles}
            onChangeDropOffPos={handleChangeDropOffPos}
            onResetScene={handleResetCustomScene}
            onRunSimulation={handleRunCustomSimulation}
            showLidarRays={showLidarRays}
            onToggleLidarRays={handleToggleLidarRays}
            timeDilation={timeDilation}
            onChangeTimeDilation={setTimeDilation}
            lighting={lighting}
            onChangeLighting={handleChangeLighting}
            disabled={exportState.status === 'rendering'}
          />

          <div className="w-full flex-1 min-w-0 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 px-1">
              <div className="flex items-center gap-2 font-mono-data">
                <span className="text-slate-200 font-medium">vikram_slam_complete_demo.mp4</span>
                <span aria-hidden="true">·</span>
                <span className="text-cyan-400">{LAYOUT_CONFIGS[selectedLayout].name}</span>
                {customObstacles.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-300">+{customObstacles.length} Custom</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>{timeDilation.toFixed(2)}x</span>
                <span aria-hidden="true">·</span>
                <span>1280x720</span>
                <span aria-hidden="true">·</span>
                <span>30 FPS</span>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border font-mono-data text-xs ${
                    batteryCritical
                      ? 'bg-red-950/70 border-red-500/80 text-red-300 animate-pulse'
                      : batteryWarning
                        ? 'bg-amber-950/50 border-amber-500/60 text-amber-300'
                        : 'bg-slate-900/90 border-slate-800 text-emerald-300'
                  }`}
                  title="Simulated Robot Battery Level"
                >
                  {batteryCritical ? (
                    <BatteryWarning className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  ) : batteryWarning ? (
                    <BatteryLow className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : liveBatteryPct < 75 ? (
                    <BatteryMedium className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <BatteryFull className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}

                  <div className="flex items-center gap-0.5" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, idx) => {
                      const active = idx < filledSegments;
                      const segColor = batteryCritical
                        ? 'bg-red-400'
                        : batteryWarning
                          ? 'bg-amber-400'
                          : 'bg-emerald-400';
                      return (
                        <span
                          key={idx}
                          className={`w-1 h-2.5 rounded-[1px] ${active ? segColor : 'bg-slate-800'}`}
                        />
                      );
                    })}
                  </div>

                  <span className="font-semibold">{liveBatteryPct.toFixed(1)}%</span>
                  {batteryCritical && (
                    <span className="text-[10px] font-bold tracking-wider text-red-200">
                      LOW BAT
                    </span>
                  )}
                </div>

                {exportState.status === 'ready' && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setViewMode('studio')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      viewMode === 'studio'
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Live Renderer
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('mp4')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      viewMode === 'mp4'
                        ? 'bg-slate-800 text-cyan-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Encoded MP4 ({exportState.sizeMb} MB)
                  </button>
                </div>

                <a
                  href={exportState.downloadUrl}
                  download="vikram_slam_complete_demo.mp4"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download MP4
                </a>
              </div>
            )}
              </div>
          </div>

          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-800 bg-[#0a0e17] shadow-2xl">
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className={`w-full h-full block ${viewMode === 'mp4' ? 'hidden' : 'block'}`}
            />

            {viewMode === 'mp4' && exportState.status === 'ready' && (
              <video
                src={exportState.videoUrl}
                controls
                autoPlay
                className="w-full h-full block bg-black"
              />
            )}

            {contextLost && (
              <div className="absolute inset-0 bg-[#0a0e17] flex items-center justify-center p-6 text-center">
                <p className="text-sm text-slate-300">
                  WebGL rendering context suspended. Reload or resume playback to restore the 3D scene.
                </p>
              </div>
            )}

            {exportState.status === 'rendering' && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6">
                <div className="w-full max-w-md space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono-data">
                    <span className="text-cyan-400 font-semibold">EXPORTING MP4 VIDEO</span>
                    <span className="text-slate-200">{exportState.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-transform duration-150 origin-left"
                      style={{ transform: `scaleX(${exportState.progress / 100})` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 font-mono-data">{exportState.phase}</p>
                </div>
              </div>
            )}

            {exportState.status === 'error' && (
              <div className="absolute bottom-4 left-4 right-4 bg-red-950/95 border border-red-700/80 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-xs text-red-200">{exportState.message}</span>
                <button
                  type="button"
                  onClick={() => setExportState({ status: 'idle' })}
                  className="text-xs font-medium text-red-100 underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => setDockOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-t-lg transition-colors cursor-pointer"
            >
              {dockOpen ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Hide Timeline Controls
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Show Timeline Controls
                </>
              )}
            </button>

            {dockOpen && (
              <div className="w-full bg-[#101622] border border-slate-800 rounded-xl px-4 py-3 flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTogglePlay}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          Play
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleRestart}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restart
                    </button>

                    <span className="ml-2 text-xs font-mono-data text-slate-300 whitespace-nowrap">
                      {timeSec}s / {totalSec}s
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800/80">
                    {CHAPTERS.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => seekToFrame(ch.frame)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          activeChapter === ch.id
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={TOTAL_FRAMES - 1}
                  value={currentFrame}
                  aria-label="Documentary timeline scrubber"
                  onChange={(e) => {
                    setIsPlaying(false);
                    seekToFrame(Number(e.target.value));
                  }}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
