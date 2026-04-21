import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Score {
  name: string;
  score: number;
  created_at: string;
}

const DB_PATH = path.join(process.cwd(), 'scores.json');

async function getScores(): Promise<Score[]> {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function saveScores(scores: Score[]) {
  await fs.writeFile(DB_PATH, JSON.stringify(scores, null, 2));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // Initialize DB if not exists
  try {
    await fs.access(DB_PATH);
  } catch {
    console.log('Creating initial scores.json file...');
    await fs.writeFile(DB_PATH, JSON.stringify([]));
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/scores', async (req, res) => {
    try {
      const scores = await getScores();
      const sorted = scores.sort((a, b) => b.score - a.score).slice(0, 5);
      res.json(sorted.map(s => ({ name: s.name, score: s.score })));
    } catch (error) {
      console.error('Error fetching scores:', error);
      res.status(500).json({ error: 'Failed to fetch scores' });
    }
  });

  app.post('/api/scores', async (req, res) => {
    const { name, score } = req.body;
    if (!name || typeof score !== 'number') {
      return res.status(400).json({ error: 'Invalid name or score' });
    }
    try {
      const scores = await getScores();
      scores.push({
        name: name.toUpperCase().slice(0, 3),
        score,
        created_at: new Date().toISOString()
      });
      await saveScores(scores);
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving score:', error);
      res.status(500).json({ error: 'Failed to save score' });
    }
  });

  // Vite integration
  const isDev = process.env.NODE_ENV !== 'production';
  console.log(`Mode: ${isDev ? 'Development' : 'Production'}`);

  if (isDev) {
    console.log('Initializing Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware ready.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`8-Bit Racer Server running at http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
