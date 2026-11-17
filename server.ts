import express from 'express';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

interface ExportJob {
  id: string;
  dir: string;
  mp4Path: string;
  ready: boolean;
  createdAt: number;
}

const jobs = new Map<string, ExportJob>();

function cleanupOldJobs() {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > 30 * 60 * 1000) {
      fs.rmSync(job.dir, { recursive: true, force: true });
      jobs.delete(id);
    }
  }
}

app.post('/api/export/init', (_req, res) => {
  cleanupOldJobs();
  const id = crypto.randomBytes(8).toString('hex');
  const dir = path.join(os.tmpdir(), `vikram_slam_${id}`);
  fs.mkdirSync(dir, { recursive: true });
  const mp4Path = path.join(dir, 'vikram_slam_complete_demo.mp4');
  jobs.set(id, { id, dir, mp4Path, ready: false, createdAt: Date.now() });
  res.json({ jobId: id });
});

app.post('/api/export/batch/:jobId', async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Export job not found' });
    return;
  }
  const frames = req.body?.frames as Array<{ index: number; dataUrl: string }> | undefined;
  if (!Array.isArray(frames)) {
    res.status(400).json({ error: 'Missing frames array' });
    return;
  }

  try {
    await Promise.all(
      frames.map(async (frame) => {
        const commaIdx = frame.dataUrl.indexOf(',');
        const b64 = commaIdx >= 0 ? frame.dataUrl.slice(commaIdx + 1) : frame.dataUrl;
        const buf = Buffer.from(b64, 'base64');
        const fname = `frame_${String(frame.index).padStart(4, '0')}.jpg`;
        await fs.promises.writeFile(path.join(job.dir, fname), buf);
      })
    );
    res.json({ saved: frames.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to write frames' });
  }
});

app.post('/api/export/finalize/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Export job not found' });
    return;
  }

  const fps = Number(req.body?.fps) || 30;
  const inputPattern = path.join(job.dir, 'frame_%04d.jpg');
  const args = [
    '-y',
    '-framerate',
    String(fps),
    '-i',
    inputPattern,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'fast',
    '-crf',
    '18',
    '-movflags',
    '+faststart',
    job.mp4Path,
  ];

  const ffmpeg = spawn('/usr/bin/ffmpeg', args);
  let stderr = '';
  ffmpeg.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  ffmpeg.on('close', async (code) => {
    if (code !== 0) {
      res.status(500).json({ error: `FFmpeg failed (code ${code}): ${stderr.slice(-400)}` });
      return;
    }

    job.ready = true;
    try {
      const files = await fs.promises.readdir(job.dir);
      await Promise.all(
        files
          .filter((f) => f.endsWith('.jpg'))
          .map((f) => fs.promises.unlink(path.join(job.dir, f)))
      );
    } catch {
      // ignore temp frame cleanup errors
    }

    const stat = fs.statSync(job.mp4Path);
    res.json({
      videoUrl: `/api/export/video/${job.id}`,
      downloadUrl: `/api/export/download/${job.id}`,
      sizeBytes: stat.size,
    });
  });
});

app.get('/api/export/video/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || !job.ready || !fs.existsSync(job.mp4Path)) {
    res.status(404).json({ error: 'Video not ready' });
    return;
  }
  res.sendFile(job.mp4Path);
});

app.get('/api/export/download/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || !job.ready || !fs.existsSync(job.mp4Path)) {
    res.status(404).json({ error: 'Video not ready' });
    return;
  }
  res.download(job.mp4Path, 'vikram_slam_complete_demo.mp4');
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VIKRAM-SLAM Video Studio listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
