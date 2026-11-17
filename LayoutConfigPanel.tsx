import { Grid3X3, Layers, SlidersHorizontal, Sun } from 'lucide-react';
import { StudioLightingConfig } from '../sim/factoryScene';
import {
  BoxObstacle,
  LAYOUT_CONFIGS,
  LAYOUT_ORDER,
  LayoutConfig,
  LayoutId,
  SORTING_BIN_POS,
} from '../sim/slamPlanner';
import { SceneGridEditor } from './SceneGridEditor';

export type ConfigPanelTab = 'presets' | 'grid';

interface LayoutConfigPanelProps {
  selectedLayout: LayoutId;
  onSelectLayout: (layoutId: LayoutId) => void;
  activeTab: ConfigPanelTab;
  onChangeTab: (tab: ConfigPanelTab) => void;
  customObstacles: BoxObstacle[];
  dropOffPos: [number, number];
  onChangeCustomObstacles: (next: BoxObstacle[]) => void;
  onChangeDropOffPos: (next: [number, number]) => void;
  onResetScene: () => void;
  onRunSimulation: () => void;
  showLidarRays: boolean;
  onToggleLidarRays: () => void;
  timeDilation: number;
  onChangeTimeDilation: (scale: number) => void;
  lighting: StudioLightingConfig;
  onChangeLighting: (next: StudioLightingConfig) => void;
  disabled?: boolean;
}

function FloorplanPreview({
  config,
  active,
  customObstacles,
  dropOffPos,
}: {
  config: LayoutConfig;
  active: boolean;
  customObstacles: BoxObstacle[];
  dropOffPos: [number, number];
}) {
  const toSvgX = (wx: number) => ((wx + 4.1) / 8.2) * 120;
  const toSvgY = (wy: number) => ((3.1 - wy) / 6.2) * 88;

  const routePoints = [
    [config.startPose[0], config.startPose[1]],
    ...config.exploreWaypoints,
  ]
    .map(([x, y]) => `${toSvgX(x).toFixed(1)},${toSvgY(y).toFixed(1)}`)
    .join(' ');

  return (
    <svg
      viewBox="0 0 120 88"
      className="w-24 h-[70px] shrink-0 rounded-md bg-[#090d14] border border-slate-800/90"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={active ? '#28c7fa' : '#334155'}
        strokeWidth="1.2"
        strokeDasharray="2.5 2"
        points={routePoints}
      />

      {config.boxes.map((b, idx) => {
        const cx = b.kind === 'bin' && active ? dropOffPos[0] : b.cx;
        const cy = b.kind === 'bin' && active ? dropOffPos[1] : b.cy;
        const x = toSvgX(cx - b.hx);
        const y = toSvgY(cy + b.hy);
        const w = Math.max(1.5, ((b.hx * 2) / 8.2) * 120);
        const h = Math.max(1.5, ((b.hy * 2) / 6.2) * 88);
        let fill = '#475569';
        if (b.kind === 'obstacle') fill = active ? '#d99126' : '#8a6220';
        else if (b.kind === 'table') fill = '#9c7d5b';
        else if (b.kind === 'bin') fill = '#2563eb';
        return <rect key={idx} x={x} y={y} width={w} height={h} fill={fill} rx={0.5} />;
      })}

      {active &&
        customObstacles.map((b, idx) => {
          const x = toSvgX(b.cx - b.hx);
          const y = toSvgY(b.cy + b.hy);
          const w = Math.max(1.5, ((b.hx * 2) / 8.2) * 120);
          const h = Math.max(1.5, ((b.hy * 2) / 6.2) * 88);
          return (
            <rect
              key={`c-${idx}`}
              x={x}
              y={y}
              width={w}
              height={h}
              fill="#d97706"
              stroke="#38bdf8"
              strokeWidth={0.6}
              rx={0.5}
            />
          );
        })}

      <circle
        cx={toSvgX(config.startPose[0])}
        cy={toSvgY(config.startPose[1])}
        r={2.8}
        fill="#22e066"
      />
    </svg>
  );
}

export function LayoutConfigPanel({
  selectedLayout,
  onSelectLayout,
  activeTab,
  onChangeTab,
  customObstacles,
  dropOffPos,
  onChangeCustomObstacles,
  onChangeDropOffPos,
  onResetScene,
  onRunSimulation,
  showLidarRays,
  onToggleLidarRays,
  timeDilation,
  onChangeTimeDilation,
  lighting,
  onChangeLighting,
  disabled = false,
}: LayoutConfigPanelProps) {
  const dilationMode =
    timeDilation < 0.95 ? 'Slow-Mo' : timeDilation > 1.05 ? 'Fast' : 'Real-Time';
  const tempMood =
    lighting.temperatureK < 4500
      ? 'Warm'
      : lighting.temperatureK > 6500
        ? 'Cool'
        : 'Daylight';

  const hasCustomEdits =
    customObstacles.length > 0 ||
    Math.hypot(dropOffPos[0] - SORTING_BIN_POS[0], dropOffPos[1] - SORTING_BIN_POS[1]) > 0.02;

  return (
    <aside
      aria-label="Factory Floor Configuration"
      className="w-full lg:w-[310px] shrink-0 bg-[#0d121c] border border-slate-800 rounded-xl p-4 flex flex-col gap-3.5"
    >
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-100">Floor Configuration</h2>
        </div>
        <span className="text-xs font-mono-data text-slate-400">8.0 x 6.0 m</span>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800/90">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChangeTab('presets')}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-60 ${
            activeTab === 'presets'
              ? 'bg-slate-800 text-cyan-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Presets</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChangeTab('grid')}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-60 ${
            activeTab === 'grid'
              ? 'bg-slate-800 text-cyan-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          <span>Draw Grid</span>
          {hasCustomEdits && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" aria-hidden="true" />
          )}
        </button>
      </div>

      {activeTab === 'presets' ? (
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-medium text-slate-400">Simulated Factory Layout</span>
          {LAYOUT_ORDER.map((id) => {
            const cfg = LAYOUT_CONFIGS[id];
            const isActive = selectedLayout === id;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectLayout(id)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors flex items-start gap-3 cursor-pointer disabled:opacity-60 ${
                  isActive
                    ? 'bg-slate-900 border-cyan-500/70'
                    : 'bg-[#0a0f18] border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <FloorplanPreview
                  config={cfg}
                  active={isActive}
                  customObstacles={customObstacles}
                  dropOffPos={dropOffPos}
                />
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-semibold truncate ${
                        isActive ? 'text-cyan-300' : 'text-slate-100'
                      }`}
                    >
                      {cfg.name}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug text-slate-400 line-clamp-2">
                    {cfg.description}
                  </p>
                  <div className="text-[11px] font-mono-data text-slate-500 flex items-center gap-1.5 pt-0.5">
                    <span>
                      {cfg.obstacleCount + (isActive ? customObstacles.length : 0)} Obstacles
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{cfg.minClearance} lane</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <SceneGridEditor
          layoutId={selectedLayout}
          customObstacles={customObstacles}
          dropOffPos={dropOffPos}
          onChangeCustomObstacles={onChangeCustomObstacles}
          onChangeDropOffPos={onChangeDropOffPos}
          onResetScene={onResetScene}
          onRunSimulation={onRunSimulation}
          disabled={disabled}
        />
      )}

      <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-300">360° LiDAR Rays</span>
          <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!showLidarRays) onToggleLidarRays();
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                showLidarRays
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Show
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (showLidarRays) onToggleLidarRays();
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                !showLidarRays
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hide
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="time-dilation-slider" className="text-xs font-medium text-slate-300">
              Time Dilation
            </label>
            <div className="flex items-center gap-1.5 text-xs font-mono-data">
              <span className="text-slate-400">{dilationMode}</span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="text-cyan-300 font-semibold">{timeDilation.toFixed(2)}x</span>
            </div>
          </div>

          <input
            id="time-dilation-slider"
            type="range"
            min={0.2}
            max={2.5}
            step={0.05}
            disabled={disabled}
            value={timeDilation}
            onChange={(e) => onChangeTimeDilation(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg disabled:opacity-60"
          />

          <div className="flex items-center justify-between text-[11px] font-mono-data text-slate-500">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChangeTimeDilation(0.25)}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              0.25x
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChangeTimeDilation(1.0)}
              className="hover:text-cyan-300 transition-colors cursor-pointer"
            >
              1.00x (Reset)
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChangeTimeDilation(2.5)}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              2.50x
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Sun className="w-3.5 h-3.5 text-amber-300" />
              Studio Lighting
            </span>
            <span className="text-[11px] font-mono-data text-slate-400">
              {tempMood} · {Math.round(lighting.intensity * 100)}%
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <label htmlFor="light-intensity-slider" className="text-slate-400">
                Intensity
              </label>
              <span className="font-mono-data text-cyan-300 font-semibold">
                {lighting.intensity.toFixed(2)}x
              </span>
            </div>
            <input
              id="light-intensity-slider"
              type="range"
              min={0.3}
              max={2.0}
              step={0.05}
              disabled={disabled}
              value={lighting.intensity}
              onChange={(e) =>
                onChangeLighting({ ...lighting, intensity: Number(e.target.value) })
              }
              className="w-full accent-amber-300 cursor-pointer h-1.5 bg-slate-800 rounded-lg disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <label htmlFor="light-temp-slider" className="text-slate-400">
                Color Temp
              </label>
              <span
                className={`font-mono-data font-semibold ${
                  lighting.temperatureK < 4500
                    ? 'text-amber-300'
                    : lighting.temperatureK > 6500
                      ? 'text-sky-300'
                      : 'text-slate-200'
                }`}
              >
                {lighting.temperatureK} K
              </span>
            </div>
            <input
              id="light-temp-slider"
              type="range"
              min={2500}
              max={9000}
              step={100}
              disabled={disabled}
              value={lighting.temperatureK}
              onChange={(e) =>
                onChangeLighting({ ...lighting, temperatureK: Number(e.target.value) })
              }
              className="w-full accent-sky-300 cursor-pointer h-1.5 rounded-lg bg-gradient-to-r from-amber-500 via-amber-100 to-sky-400 disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChangeLighting({ intensity: 0.85, temperatureK: 3200 })}
              className="px-2 py-1 text-[10px] font-medium rounded-md bg-[#0a0f18] border border-slate-800 hover:border-amber-500/60 text-amber-200 transition-colors cursor-pointer disabled:opacity-60"
            >
              Warm Cinema
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChangeLighting({ intensity: 1.0, temperatureK: 5500 })}
              className="px-2 py-1 text-[10px] font-medium rounded-md bg-[#0a0f18] border border-slate-800 hover:border-slate-600 text-slate-200 transition-colors cursor-pointer disabled:opacity-60"
            >
              Daylight
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChangeLighting({ intensity: 1.25, temperatureK: 8200 })}
              className="px-2 py-1 text-[10px] font-medium rounded-md bg-[#0a0f18] border border-slate-800 hover:border-sky-500/60 text-sky-200 transition-colors cursor-pointer disabled:opacity-60"
            >
              Cyber Cool
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
