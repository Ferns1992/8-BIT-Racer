import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Volume2, VolumeX, Medal } from 'lucide-react';

// --- Types ---
type GameState = 'START' | 'PLAYING' | 'GAME_OVER';

interface Score {
  name: string;
  score: number;
}

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'COIN' | 'SHELL' | 'OIL';
  speedY: number;
}

// --- Constants ---
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 60;
const ROAD_SPEED = 4;
const SPAWN_INTERVAL = 1000;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 1, this.ctx!.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1) {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.masterGain!);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playCoin() {
    this.playTone(987.77, 'square', 0.1, 0.05); // B5
    setTimeout(() => this.playTone(1318.51, 'square', 0.2, 0.05), 50); // E6
  }

  playCrash() {
    this.playTone(110, 'sawtooth', 0.3, 0.2);
    this.playTone(55, 'square', 0.5, 0.2);
  }

  playStart() {
    this.playTone(523.25, 'square', 0.1, 0.05); // C5
    setTimeout(() => this.playTone(659.25, 'square', 0.1, 0.05), 100); // E5
    setTimeout(() => this.playTone(783.99, 'square', 0.3, 0.05), 200); // G5
  }
}

const sounds = new SoundEngine();

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState<Score[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>(null);
  const playerXRef = useRef(CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2);
  const objectsRef = useRef<GameObject[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const lastSpawnRef = useRef(0);
  const roadOffsetRef = useRef(0);

  // --- API Calls ---
  const fetchScores = async () => {
    try {
      const res = await fetch('/api/scores');
      const data = await res.json();
      setHighScores(data);
    } catch (e) {
      console.error('Failed to fetch scores', e);
    }
  };

  const submitScore = async () => {
    if (!playerName.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, score }),
      });
      await fetchScores();
      setGameState('START');
      setPlayerName('');
    } catch (e) {
      console.error('Failed to submit score', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, []);

  // --- Game Mechanics ---
  const spawnObject = useCallback(() => {
    const types: ('COIN' | 'SHELL' | 'OIL')[] = ['COIN', 'COIN', 'SHELL', 'OIL'];
    const type = types[Math.floor(Math.random() * types.length)];
    const x = 50 + Math.random() * (CANVAS_WIDTH - 100 - 30);
    
    objectsRef.current.push({
      x,
      y: -50,
      width: 30,
      height: 30,
      type,
      speedY: ROAD_SPEED + (score / 500)
    });
  }, [score]);

  const update = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Movement
    const speed = 5;
    if (keysRef.current['ArrowLeft'] || keysRef.current['a']) playerXRef.current -= speed;
    if (keysRef.current['ArrowRight'] || keysRef.current['d']) playerXRef.current += speed;
    
    // Bounds
    playerXRef.current = Math.max(50, Math.min(CANVAS_WIDTH - 50 - PLAYER_WIDTH, playerXRef.current));

    // Road scrolling
    roadOffsetRef.current = (roadOffsetRef.current + ROAD_SPEED) % 80;

    // Spawning
    if (t - lastSpawnRef.current > Math.max(400, SPAWN_INTERVAL - (score / 10))) {
      spawnObject();
      lastSpawnRef.current = t;
    }

    // Objects update
    objectsRef.current = objectsRef.current.filter(obj => {
      obj.y += obj.speedY;

      // Collision
      const collides = (
        playerXRef.current < obj.x + obj.width &&
        playerXRef.current + PLAYER_WIDTH > obj.x &&
        CANVAS_HEIGHT - 100 < obj.y + obj.height &&
        CANVAS_HEIGHT - 100 + PLAYER_HEIGHT > obj.y
      );

      if (collides) {
        if (obj.type === 'COIN') {
          setScore(s => s + 100);
          sounds.playCoin();
          return false;
        } else {
          setGameState('GAME_OVER');
          sounds.playCrash();
          return false;
        }
      }

      return obj.y < CANVAS_HEIGHT;
    });

    // Rendering
    draw(ctx, t);
    gameLoopRef.current = requestAnimationFrame(update);
  }, [spawnObject, score]);

  const draw = (ctx: CanvasRenderingContext2D, t: number) => {
    // Clear - Mushroom Kingdom Green
    ctx.fillStyle = '#00A800'; 
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Road - Dark Slate
    ctx.fillStyle = '#505050';
    ctx.fillRect(50, 0, CANVAS_WIDTH - 100, CANVAS_HEIGHT);

    // Road Side Borders (White)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(50, 0, 8, CANVAS_HEIGHT);
    ctx.fillRect(CANVAS_WIDTH - 58, 0, 8, CANVAS_HEIGHT);

    // Dash lines
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([40, 40]);
    ctx.lineDashOffset = -roadOffsetRef.current;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Objects
    objectsRef.current.forEach(obj => {
      if (obj.type === 'COIN') {
        ctx.fillStyle = '#F8B800';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Slight spin/pulse for coins
        const coinPulse = Math.sin(t / 200) * 2;
        ctx.arc(obj.x + 15, obj.y + 15, 12 + coinPulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = 'black';
        ctx.font = '10px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('$', obj.x + 15, obj.y + 20);
      } else if (obj.type === 'SHELL') {
        ctx.fillStyle = '#00A800';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(obj.x + 15, obj.y + 15, 15, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else { // OIL
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(obj.x + 15, obj.y + 15, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Player - Kart Pink/Redish
    const px = playerXRef.current;
    // Bobbing effect for the kart
    const bob = Math.sin(t / 150) * 3;
    const py = (CANVAS_HEIGHT - 100) + bob;
    
    ctx.fillStyle = '#E40058'; // Pink/Magenta Body
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.fillRect(px + 4, py + 12, 32, 38);
    ctx.strokeRect(px + 4, py + 12, 32, 38);
    
    // Seat/Top
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(px + 10, py + 20, 20, 10);
    
    // Wheels (Black blocks) with spin lines
    const drawWheel = (wx: number, wy: number) => {
      ctx.fillStyle = 'black';
      ctx.fillRect(wx, wy, 8, 10);
      // Spin line effect
      ctx.fillStyle = '#444';
      const spinOffset = (t / 40) % 10;
      ctx.fillRect(wx, wy + spinOffset, 8, 2);
    };

    drawWheel(px - 2, py + 8);
    drawWheel(px + 34, py + 8);
    drawWheel(px - 2, py + 42);
    drawWheel(px + 34, py + 42);
  };

  useEffect(() => {
    if (gameState === 'PLAYING') {
      gameLoopRef.current = requestAnimationFrame(update);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    } else {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, update]);

  const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key] = true; };
  const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };

  const startGame = () => {
    sounds.init();
    sounds.playStart();
    setScore(0);
    playerXRef.current = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2;
    objectsRef.current = [];
    setGameState('PLAYING');
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#5C94FC] font-game text-white select-none overflow-hidden">
      <div className="scanlines" />

      {/* Top Banner */}
      <div className="h-16 flex items-center justify-between px-8 bg-black border-b-8 border-[#303030] shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-[#F8B800] border-2 border-white"></div>
          <h1 className="text-2xl font-black tracking-tighter retro-shadow-magenta">ULTRA-LIGHT RACER</h1>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-[#F8B800]">PORT STATUS</span>
            <span className="text-sm">3000:ACTIVE</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-[#F8B800]">DB_ENGINE</span>
            <span className="text-sm">JSON_FS</span>
          </div>
        </div>
      </div>

      {/* Main Game Layout */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0">
        
        {/* Game Viewport (Canvas Simulation) */}
        <div className="flex-1 relative flex items-center justify-center bg-[#00A800] retro-border-heavy">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="bg-[#505050] max-h-full"
            />

            {/* HUD Overlay */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
              <div className="bg-black/60 p-2 border-2 border-white">
                <p className="text-[8px] text-[#F8B800]">SCORE</p>
                <p className="text-xl">{score.toString().padStart(6, '0')}</p>
              </div>
              <button 
                onClick={() => setMuted(sounds.toggleMute())}
                className="bg-black/60 text-white p-2 border-2 border-white hover:bg-black/80 transition-colors w-fit"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>

            <AnimatePresence>
              {gameState === 'START' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center p-8 z-30"
                >
                  <h2 className="text-2xl text-[#F8B800] mb-8 retro-shadow-magenta">PRESS START</h2>
                  <button 
                    onClick={startGame}
                    className="px-8 py-4 bg-[#E40058] text-white retro-border-medium hover:bg-[#ff0066] transition-transform active:scale-95"
                  >
                    START ENGINE
                  </button>
                </motion.div>
              )}

              {gameState === 'GAME_OVER' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center z-30"
                >
                  <h2 className="text-2xl text-white mb-4 retro-shadow-magenta">GAME OVER</h2>
                  <div className="text-xl text-[#F8B800] mb-8">FINAL: {score}</div>
                  
                  <div className="bg-white/10 p-6 retro-border-medium w-full max-w-xs">
                    <p className="text-[8px] text-white/70 mb-4 uppercase">Enter 3 Letters</p>
                    <input 
                      type="text" 
                      maxLength={3}
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
                      className="w-full bg-black border-2 border-white text-center text-2xl py-2 text-[#5C94FC] outline-none font-game mb-4"
                      autoFocus
                    />
                    <button 
                      onClick={submitScore}
                      disabled={playerName.length < 1 || loading}
                      className="w-full bg-[#00A800] text-white py-3 retro-border-medium hover:bg-[#00cc00] disabled:opacity-50 text-xs"
                    >
                      {loading ? 'SAVING...' : 'SAVE SCORE'}
                    </button>
                  </div>

                  <button 
                    onClick={startGame}
                    className="mt-6 flex items-center gap-2 text-white/50 hover:text-white transition-colors text-[10px]"
                  >
                    <RotateCcw size={12} />
                    RETRY
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sidebar / Leaderboard */}
        <div className="w-80 flex flex-col gap-6 shrink-0 z-10">
          {/* Top Scores */}
          <div className="bg-white text-black p-4 retro-border-heavy flex-1 flex flex-col">
            <h2 className="text-lg font-black mb-4 border-b-4 border-black pb-2 tracking-tighter uppercase underline decoration-4 decoration-[#E40058]">TOP 5 RACERS</h2>
            <div className="space-y-4 flex-1">
              {highScores.map((s, i) => (
                <div key={i} className="flex justify-between items-end dotted-border-b text-[11px]">
                  <span>{i + 1}. {s.name}</span>
                  <span className="text-lg font-bold">{s.score}</span>
                </div>
              ))}
              {highScores.length === 0 && <p className="text-black/30 text-[10px]">No logs found...</p>}
            </div>
            <div className="mt-8 p-2 bg-[#F8B800] text-center border-4 border-black text-[10px] font-bold animate-pulse">
              NEW HIGH SCORE!
            </div>
          </div>

          {/* System Stats */}
          <div className="bg-black border-4 border-[#303030] p-4 text-[8px] space-y-1">
            <p className="text-[#F8B800]">{">"} SYSTEM_LOG</p>
            <p className="text-green-400">PERSISTENCE: JSON_FS...</p>
            <p className="text-green-400">MAPPED VOLUME: /APP/SCORES.JSON</p>
            <p className="text-green-400">CPU_LOAD: 0.05% (ULTRA-LIGHT)</p>
            <p className="text-white/40">WAITING FOR INPUT [A/B/START]</p>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="h-12 bg-black px-8 flex items-center justify-between border-t-8 border-[#303030] shrink-0 z-10">
        <div className="flex gap-6 text-[10px] text-[#F8B800]">
          <span>[ARROW KEYS] STEER</span>
          <span>[SPACE] ACCEL</span>
          <span>[ESC] PAUSE</span>
        </div>
        <div className="text-[9px] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
          RECORDING HIGH SCORES TO DISK
        </div>
      </div>
    </div>
  );
}


