import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, MapPin, Play, PlusSquare, RotateCcw, Trash2 } from 'lucide-react';
import {
  BoxObstacle,
  EDITOR_CELL_SIZE,
  EDITOR_GRID_COLS,
  EDITOR_GRID_ROWS,
  INITIAL_CUBE_POS,
  LAYOUT_CONFIGS,
  LayoutId,
  PARK_POSE,
  SORTING_BIN_POS,
  editorCellToWorld,
} from '../sim/slamPlanner';

export type GridEditorTool = 'obstacle' | 'dropoff' | 'erase';

interface SceneGridEditorProps {
  layoutId: LayoutId;
  customObstacles: BoxObstacle[];
  dropOffPos: [number, number];
  onChangeCustomObstacles: (next: BoxObstacle[]) => void;
  onChangeDropOffPos: (next: [number, number]) => void;
  onResetScene: () => void;
  onRunSimulation: () => void;
  disabled?: boolean;
}

const CANVAS_W = 276;
const CANVAS_H = 204;
const PAD = 3;
const CELL_PX = 18;

type ProtectedReason = 'preset' | 'table' | 'start' | 'dock' | null;

function getCellProtection(col: number, row: number, layoutId: LayoutId): ProtectedReason {
  const [cx, cy] = editorCellToWorld(col, row);
  const cfg = LAYOUT_CONFIGS[layoutId];

  for (const b of cfg.boxes) {
    if (b.kind === 'bin') continue;
    if (Math.abs(cx - b.cx) < b.hx + 0.22 && Math.abs(cy - b.cy) < b.hy + 0.22) {
      return b.kind === 'table' ? 'table' : 'preset';
    }
  }

  const [sx, sy] = cfg.startPose;
  if (Math.hypot(cx - sx, cy - sy) < 0.42) return 'start';
  if (Math.hypot(cx - PARK_POSE[0], cy - PARK_POSE[1]) < 0.42) return 'dock';
  return null;
}

function worldToCanvasX(wx: number): number {
  const minX = -((EDITOR_GRID_COLS * EDITOR_CELL_SIZE) / 2);
  const norm = (wx - minX) / (EDITOR_GRID_COLS * EDITOR_CELL_SIZE);
  return PAD + norm * (EDITOR_GRID_COLS * CELL_PX);
}

function worldToCanvasY(wy: number): number {
  const maxY = (EDITOR_GRID_ROWS * EDITOR_CELL_SIZE) / 2;
  const norm = (maxY - wy) / (EDITOR_GRID_ROWS * EDITOR_CELL_SIZE);
  return PAD + norm * (EDITOR_GRID_ROWS * CELL_PX);
}

export function SceneGridEditor({
  layoutId,
  customObstacles,
  dropOffPos,
  onChangeCustomObstacles,
  onChangeDropOffPos,
  onResetScene,
  onRunSimulation,
  disabled = false,
}: SceneGridEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<GridEditorTool>('obstacle');
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null);
  const [blockedFlash, setBlockedFlash] = useState<string | null>(null);
  const drawingModeRef = useRef<GridEditorTool | null>(null);
  const lastCellKeyRef = useRef<string | null>(null);

  const customObsKeys = useMemo(() => {
    const map = new Map<string, number>();
    customObstacles.forEach((obs, idx) => {
      for (let r = 0; r < EDITOR_GRID_ROWS; r++) {
        for (let c = 0; c < EDITOR_GRID_COLS; c++) {
          const [wx, wy] = editorCellToWorld(c, r);
          if (Math.hypot(wx - obs.cx, wy - obs.cy) < 0.1) {
            map.set(`${c},${r}`, idx);
          }
        }
      }
    });
    return map;
  }, [customObstacles]);

  const applyToolAtCell = useCallback(
    (col: number, row: number, activeTool: GridEditorTool) => {
      if (disabled) return;
      if (col < 0 || col >= EDITOR_GRID_COLS || row < 0 || row >= EDITOR_GRID_ROWS) return;

      const reason = getCellProtection(col, row, layoutId);
      if (reason) {
        const msgMap: Record<Exclude<ProtectedReason, null>, string> = {
          preset: 'Reserved for preset factory wall',
          table: 'Reserved for pickup table station',
          start: 'Reserved for robot spawn pose',
          dock: 'Reserved for grasping dock pose',
        };
        setBlockedFlash(msgMap[reason]);
        return;
      }
      setBlockedFlash(null);

      const [wx, wy] = editorCellToWorld(col, row);
      const cellKey = `${col},${row}`;

      if (activeTool === 'obstacle') {
        if (Math.hypot(wx - dropOffPos[0], wy - dropOffPos[1]) < 0.34) {
          setBlockedFlash('Cell holds the Drop-Off zone');
          return;
        }
        if (customObsKeys.has(cellKey)) return;
        const newObs: BoxObstacle = {
          cx: wx,
          cy: wy,
          hx: 0.23,
          hy: 0.23,
          height: 0.62,
          kind: 'obstacle',
        };
        onChangeCustomObstacles([...customObstacles, newObs]);
      } else if (activeTool === 'erase') {
        const existingIdx = customObsKeys.get(cellKey);
        if (existingIdx !== undefined) {
          onChangeCustomObstacles(customObstacles.filter((_, i) => i !== existingIdx));
        }
      } else if (activeTool === 'dropoff') {
        const existingIdx = customObsKeys.get(cellKey);
        if (existingIdx !== undefined) {
          onChangeCustomObstacles(customObstacles.filter((_, i) => i !== existingIdx));
        }
        onChangeDropOffPos([wx, wy]);
      }
    },
    [
      customObsKeys,
      customObstacles,
      disabled,
      dropOffPos,
      layoutId,
      onChangeCustomObstacles,
      onChangeDropOffPos,
    ]
  );

  const getCellFromPointer = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const col = Math.floor((px - PAD) / CELL_PX);
    const row = Math.floor((py - PAD) / CELL_PX);
    if (col < 0 || col >= EDITOR_GRID_COLS || row < 0 || row >= EDITOR_GRID_ROWS) return null;
    return [col, row];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background & grid border
    ctx.fillStyle = '#090d14';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle grid lines
    ctx.strokeStyle = '#162033';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= EDITOR_GRID_COLS; c++) {
      const x = PAD + c * CELL_PX;
      ctx.moveTo(x, PAD);
      ctx.lineTo(x, PAD + EDITOR_GRID_ROWS * CELL_PX);
    }
    for (let r = 0; r <= EDITOR_GRID_ROWS; r++) {
      const y = PAD + r * CELL_PX;
      ctx.moveTo(PAD, y);
      ctx.lineTo(PAD + EDITOR_GRID_COLS * CELL_PX, y);
    }
    ctx.stroke();

    const cfg = LAYOUT_CONFIGS[layoutId];

    // Protected station/dock rings
    const dockX = worldToCanvasX(PARK_POSE[0]);
    const dockY = worldToCanvasY(PARK_POSE[1]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(dockX, dockY, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Preset factory boxes (walls, obstacles, pickup table)
    for (const b of cfg.boxes) {
      if (b.kind === 'wall' || b.kind === 'bin') continue;
      const left = worldToCanvasX(b.cx - b.hx);
      const top = worldToCanvasY(b.cy + b.hy);
      const right = worldToCanvasX(b.cx + b.hx);
      const bottom = worldToCanvasY(b.cy - b.hy);
      const w = Math.max(4, right - left);
      const h = Math.max(4, bottom - top);

      if (b.kind === 'obstacle') {
        ctx.fillStyle = '#8b5e1e';
        ctx.strokeStyle = '#d99126';
        ctx.lineWidth = 1;
        ctx.fillRect(left, top, w, h);
        ctx.strokeRect(left, top, w, h);
      } else if (b.kind === 'table') {
        ctx.fillStyle = '#7c6246';
        ctx.strokeStyle = '#c4a482';
        ctx.lineWidth = 1;
        ctx.fillRect(left, top, w, h);
        ctx.strokeRect(left, top, w, h);
      }
    }

    // Target cube on pickup table
    const cubeX = worldToCanvasX(INITIAL_CUBE_POS[0]);
    const cubeY = worldToCanvasY(INITIAL_CUBE_POS[1]);
    ctx.fillStyle = '#ff5514';
    ctx.fillRect(cubeX - 3, cubeY - 3, 6, 6);

    // Custom drawn obstacles
    for (const obs of customObstacles) {
      const left = worldToCanvasX(obs.cx - obs.hx);
      const top = worldToCanvasY(obs.cy + obs.hy);
      const right = worldToCanvasX(obs.cx + obs.hx);
      const bottom = worldToCanvasY(obs.cy - obs.hy);
      const w = right - left;
      const h = bottom - top;

      ctx.fillStyle = '#d97706';
      ctx.fillRect(left + 1, top + 1, w - 2, h - 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(left + 1, top + 1, w - 2, h - 2);
    }

    // Drop-off sorting bin
    const binX = worldToCanvasX(dropOffPos[0]);
    const binY = worldToCanvasY(dropOffPos[1]);
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(binX - 7, binY - 6, 14, 12);
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(binX - 7, binY - 6, 14, 12);

    ctx.fillStyle = '#e0f2fe';
    ctx.font = '700 6px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BIN', binX, binY + 0.5);

    // Robot start marker
    const [sx, sy, syaw] = cfg.startPose;
    const rx = worldToCanvasX(sx);
    const ry = worldToCanvasY(sy);
    ctx.fillStyle = '#22e066';
    ctx.beginPath();
    ctx.arc(rx, ry, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + Math.cos(syaw) * 7, ry - Math.sin(syaw) * 7);
    ctx.stroke();

    // Hover highlight
    if (hoverCell) {
      const [hc, hr] = hoverCell;
      const x = PAD + hc * CELL_PX;
      const y = PAD + hr * CELL_PX;
      const reason = getCellProtection(hc, hr, layoutId);

      if (reason) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
        ctx.strokeStyle = '#ef4444';
      } else if (tool === 'obstacle') {
        ctx.fillStyle = 'rgba(217, 119, 6, 0.32)';
        ctx.strokeStyle = '#38bdf8';
      } else if (tool === 'dropoff') {
        ctx.fillStyle = 'rgba(37, 99, 235, 0.35)';
        ctx.strokeStyle = '#93c5fd';
      } else {
        ctx.fillStyle = 'rgba(248, 113, 113, 0.22)';
        ctx.strokeStyle = '#f87171';
      }
      ctx.lineWidth = 1.5;
      ctx.fillRect(x + 1, y + 1, CELL_PX - 2, CELL_PX - 2);
      ctx.strokeRect(x + 1, y + 1, CELL_PX - 2, CELL_PX - 2);
    }

    ctx.restore();
  }, [customObstacles, dropOffPos, hoverCell, layoutId, tool]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const cell = getCellFromPointer(e);
    const activeTool: GridEditorTool = e.button === 2 ? 'erase' : tool;
    drawingModeRef.current = activeTool;
    lastCellKeyRef.current = null;
    if (cell) {
      lastCellKeyRef.current = `${cell[0]},${cell[1]}`;
      applyToolAtCell(cell[0], cell[1], activeTool);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cell = getCellFromPointer(e);
    setHoverCell(cell);
    if (!drawingModeRef.current || !cell) return;
    const key = `${cell[0]},${cell[1]}`;
    if (key === lastCellKeyRef.current) return;
    lastCellKeyRef.current = key;
    applyToolAtCell(cell[0], cell[1], drawingModeRef.current);
  };

  const handlePointerUp = () => {
    drawingModeRef.current = null;
    lastCellKeyRef.current = null;
  };

  const isCustomDropOff =
    Math.hypot(dropOffPos[0] - SORTING_BIN_POS[0], dropOffPos[1] - SORTING_BIN_POS[1]) > 0.02;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setTool('obstacle')}
          className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer disabled:opacity-60 ${
            tool === 'obstacle'
              ? 'bg-amber-500/20 text-amber-200 border-amber-400/70'
              : 'bg-[#0a0f18] text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <PlusSquare className="w-3.5 h-3.5 shrink-0" />
          <span>Obstacle</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => setTool('dropoff')}
          className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer disabled:opacity-60 ${
            tool === 'dropoff'
              ? 'bg-blue-500/20 text-blue-200 border-blue-400/70'
              : 'bg-[#0a0f18] text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span>Drop-Off</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => setTool('erase')}
          className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer disabled:opacity-60 ${
            tool === 'erase'
              ? 'bg-rose-500/20 text-rose-200 border-rose-400/70'
              : 'bg-[#0a0f18] text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <Eraser className="w-3.5 h-3.5 shrink-0" />
          <span>Erase</span>
        </button>
      </div>

      <div className="rounded-lg border border-slate-800 bg-[#090d14] p-1 flex flex-col items-center">
        <canvas
          ref={canvasRef}
          aria-label="Interactive factory floor grid editor"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => {
            setHoverCell(null);
            handlePointerUp();
          }}
          className="w-full aspect-[276/204] rounded cursor-crosshair touch-none select-none block"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] font-mono-data text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-[#22e066] inline-block" />
          Start
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-[#d97706] border border-[#38bdf8] inline-block" />
          Drawn
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-[#2563eb] border border-[#93c5fd] inline-block" />
          Drop-Off
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-[#8b5e1e] inline-block" />
          Preset
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono-data text-slate-400 bg-[#0a0f18] border border-slate-800/80 rounded-lg px-2.5 py-1.5">
        <span>
          Blocks: <strong className="text-amber-300">{customObstacles.length}</strong>
        </span>
        <span>
          Bin:{' '}
          <strong className={isCustomDropOff ? 'text-blue-300' : 'text-slate-300'}>
            ({dropOffPos[0].toFixed(1)}, {dropOffPos[1].toFixed(1)})
          </strong>
        </span>
      </div>

      {blockedFlash ? (
        <p className="text-[11px] text-rose-300 font-medium leading-tight">{blockedFlash}</p>
      ) : (
        <p className="text-[11px] text-slate-400 leading-tight">
          Click or drag to place blocks or relocate the bin. Edits sync live to the 3D factory scene.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled || (customObstacles.length === 0 && !isCustomDropOff)}
          onClick={onResetScene}
          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
        >
          {customObstacles.length > 0 ? (
            <Trash2 className="w-3.5 h-3.5" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" />
          )}
          Reset Grid
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onRunSimulation}
          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-60 transition-colors cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          Run Sim
        </button>
      </div>
    </div>
  );
}
