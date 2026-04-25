import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Volume2, VolumeX } from 'lucide-react';

// --- Types ---
type GameState = 'START' | 'PLAYING' | 'GAME_OVER' | 'PAUSED';

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

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }

// --- Constants ---
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const PLAYER_WIDTH = 48;
const PLAYER_HEIGHT = 36;
const ROAD_LEFT = 60;
const ROAD_RIGHT = CANVAS_WIDTH - 60;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private isMuted: boolean = false;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.9;
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.9, this.ctx.currentTime, 0.05);
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
    this.playTone(880, 'square', 0.12, 0.06);
    setTimeout(() => this.playTone(1320, 'square', 0.18, 0.04), 80);
  }

  playCrash() {
    this.playTone(120, 'sawtooth', 0.35, 0.18);
    this.playTone(60, 'square', 0.5, 0.14);
  }

  playStart() { this.playTone(540, 'sine', 0.14, 0.06); }

  startMusic() {
    if (!this.ctx || this.isMuted || this.musicOsc) return;
    this.musicOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    this.musicOsc.type = 'sine';
    this.musicOsc.frequency.value = 110;
    gain.gain.value = 0.03;
    this.musicOsc.connect(gain);
    gain.connect(this.masterGain!);
    this.musicOsc.start();
    // simple arpeggio effect
    let i = 0;
    const notes = [110, 165, 220, 330];
    const interval = () => {
      if (!this.musicOsc || !this.ctx) return;
      this.musicOsc.frequency.setTargetAtTime(notes[i % notes.length], this.ctx.currentTime, 0.01);
      i++;
      setTimeout(interval, 500);
    };
    interval();
  }

  stopMusic() {
    if (this.musicOsc) {
      this.musicOsc.stop();
      this.musicOsc.disconnect();
      this.musicOsc = null;
    }
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const playerXRef = useRef((CANVAS_WIDTH - PLAYER_WIDTH) / 2);
  const playerVxRef = useRef(0);
  const objectsRef = useRef<GameObject[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const lastSpawnRef = useRef(0);
  const roadOffsetRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef<number | null>(null);
  // visual magic
  const shakeRef = useRef(0);
  const wheelAngleRef = useRef(0);

  // --- API ---
  const fetchScores = async () => {
    try {
      const res = await fetch('/api/scores');
      const data = await res.json();
      setHighScores(data);
    } catch (e) { console.warn('Scores fetch failed', e); }
  };

  const submitScore = async () => {
    if (!playerName.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: playerName.slice(0,3), score }) });
      await fetchScores();
      setGameState('START');
      setPlayerName('');
    } catch (e) { console.warn('Failed to submit', e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchScores(); }, []);

  // --- Gameplay params ---
  const spawnObject = useCallback((difficulty: number) => {
    const types: GameObject['type'][] = Math.random() < 0.6 ? ['COIN'] : (Math.random() < 0.5 ? ['SHELL'] : ['OIL']);
    const type = (Array.isArray(types) ? types[0] : types) as GameObject['type'];
    const lanePadding = 20;
    const x = ROAD_LEFT + lanePadding + Math.random() * (ROAD_RIGHT - ROAD_LEFT - lanePadding * 2 - 30);
    objectsRef.current.push({ x, y: -40, width: 30, height: 30, type, speedY: 2 + difficulty * 0.6 + Math.random() * 1.4 });
  }, []);

  const spawnParticles = (x: number, y: number, color = '#F8B800') => {
    for (let i = 0; i < 8; i++) particlesRef.current.push({ x, y, vx: (Math.random() - 0.5) * 2.5, vy: -Math.random() * 2 - 0.5, life: 30 + Math.random() * 20, color });
  };

  const update = useCallback((t: number) => {
    if (!startTimeRef.current) startTimeRef.current = t;
    const dt = 16; // fixed-step feel
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    // Input - smoother steering
    const accel = 0.75;
    const maxV = 6;
    if (keysRef.current['ArrowLeft'] || keysRef.current['a']) playerVxRef.current -= accel;
    if (keysRef.current['ArrowRight'] || keysRef.current['d']) playerVxRef.current += accel;
    // boost
    if (keysRef.current[' '] || keysRef.current['Spacebar']) { /* could increase difficulty/score */ }
    // friction
    playerVxRef.current *= 0.85;
    playerVxRef.current = Math.max(-maxV, Math.min(maxV, playerVxRef.current));
    playerXRef.current += playerVxRef.current;
    playerXRef.current = Math.max(ROAD_LEFT + 8, Math.min(ROAD_RIGHT - PLAYER_WIDTH - 8, playerXRef.current));

    // road
    roadOffsetRef.current = (roadOffsetRef.current + 2) % 40;

    // difficulty ramp over time
    const elapsed = (t - startTimeRef.current) / 1000;
    const difficulty = Math.min(6, Math.floor(elapsed / 6));

    // spawning
    if (t - lastSpawnRef.current > Math.max(300, 900 - elapsed * 30)) { spawnObject(difficulty); lastSpawnRef.current = t; }

    // update objects
    objectsRef.current = objectsRef.current.filter(obj => {
      obj.y += obj.speedY;
      // collision
      const playerY = CANVAS_HEIGHT - 120;
      const collides = (
        playerXRef.current < obj.x + obj.width &&
        playerXRef.current + PLAYER_WIDTH > obj.x &&
        playerY < obj.y + obj.height &&
        playerY + PLAYER_HEIGHT > obj.y
      );
      if (collides) {
        if (obj.type === 'COIN') {
          setScore(s => s + 150 + Math.floor(elapsed * 2));
          sounds.playCoin();
          spawnParticles(obj.x + 15, obj.y + 12);
          shakeRef.current = Math.min(12, (shakeRef.current || 0) + 6);
          return false;
        } else {
          setGameState('GAME_OVER');
          sounds.playCrash();
          spawnParticles(obj.x + 15, obj.y + 12, '#333');
          shakeRef.current = 18;
          return false;
        }
      }
      return obj.y < CANVAS_HEIGHT + 50;
    });

    // update particles
    particlesRef.current = particlesRef.current.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.08, life: p.life - 1 })).filter(p => p.life > 0);

    // shake decay
    if (shakeRef.current && shakeRef.current > 0) shakeRef.current = Math.max(0, shakeRef.current - 0.7);
    // wheel rotation
    wheelAngleRef.current += playerVxRef.current * 0.35 + 0.6;

    // draw
    draw(ctx, t, elapsed);

    rafRef.current = requestAnimationFrame(update);
  }, [spawnObject]);

  const draw = (ctx: CanvasRenderingContext2D, t: number, elapsed: number) => {
    // camera shake
    const shake = (shakeRef.current ?? 0);
    if (shake > 0) {
      const sx = (Math.random() * 2 - 1) * shake;
      const sy = (Math.random() * 2 - 1) * shake * 0.5;
      ctx.save();
      ctx.translate(sx, sy);
    } else {
      ctx.save();
    }

    // sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    sky.addColorStop(0, '#7fb0ff');
    sky.addColorStop(1, '#5C94FC');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // road with soft lighting
    const roadGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    roadGrad.addColorStop(0, '#666'); roadGrad.addColorStop(1, '#303030');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, CANVAS_HEIGHT);

    // soft road edges
    ctx.fillStyle = '#2e2e2e'; ctx.fillRect(ROAD_LEFT - 30, 0, 30, CANVAS_HEIGHT); ctx.fillRect(ROAD_RIGHT, 0, 30, CANVAS_HEIGHT);

    // moving center dashed line with perspective fade
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([28, 20]); ctx.lineDashOffset = -roadOffsetRef.current * 1.2;
    ctx.beginPath(); ctx.moveTo(CANVAS_WIDTH / 2, 0); ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();

    // simple roadside details (distant stones)
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(10 + i * 60, 100 + ((t / 30) % 80), 8, 4);
    }

    // draw obstacles with shadow and detail
    objectsRef.current.forEach(obj => {
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(obj.x + obj.width / 2, obj.y + obj.height + 8, obj.width * 0.6, 6, 0, 0, Math.PI * 2); ctx.fill();

      if (obj.type === 'COIN') {
        // coin with rim and shine
        ctx.fillStyle = '#F8B800'; ctx.beginPath(); ctx.arc(obj.x + 15, obj.y + 14, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#c08500'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(obj.x + 9, obj.y + 8, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.font = '10px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText('$', obj.x + 15, obj.y + 20);
      } else if (obj.type === 'SHELL') {
        // shell / obstacle with highlight
        ctx.save(); ctx.translate(obj.x + 15, obj.y + 15);
        ctx.fillStyle = '#26A026'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1c7a1c'; ctx.beginPath(); ctx.ellipse(-4, -3, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        // oil slick with gloss
        ctx.save(); ctx.translate(obj.x + 15, obj.y + 15);
        ctx.fillStyle = '#001'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.ellipse(-6, -4, 8, 4, Math.PI / 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    });

    // draw speed lines when moving fast
    const speed = Math.abs(playerVxRef.current);
    if (speed > 2.2) {
      ctx.save(); ctx.globalAlpha = Math.min(0.6, (speed - 2) / 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); ctx.moveTo(playerXRef.current + PLAYER_WIDTH / 2 + (i - 3) * 6, CANVAS_HEIGHT - 120 - i * 6);
        ctx.lineTo(playerXRef.current + PLAYER_WIDTH / 2 + (i - 3) * 6 + (playerVxRef.current * -6), CANVAS_HEIGHT - 200 - i * 12);
        ctx.stroke();
      }
      ctx.restore();
    }

    // player shadow (soft)
    const px = playerXRef.current;
    const py = CANVAS_HEIGHT - 120 + Math.sin(t / 180) * 3;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(px + PLAYER_WIDTH / 2, py + PLAYER_HEIGHT, PLAYER_WIDTH * 0.6, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    // draw a more realistic car sprite with tilt and shading
    const tilt = Math.max(-0.35, Math.min(0.35, playerVxRef.current / 6));
    ctx.save();
    ctx.translate(px + PLAYER_WIDTH / 2, py + PLAYER_HEIGHT / 2);
    ctx.rotate(tilt);

    // car dims
    const w = PLAYER_WIDTH, h = PLAYER_HEIGHT;

    // metallic body gradient
    const bodyGrad = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
    bodyGrad.addColorStop(0, '#b3003a');
    bodyGrad.addColorStop(0.4, '#e40058');
    bodyGrad.addColorStop(1, '#ff6a8a');
    ctx.fillStyle = bodyGrad;

    // rounded capsule body
    ctx.beginPath();
    ctx.moveTo(-w/2 + 8, -h/2 + 6);
    ctx.quadraticCurveTo(0, -h/2 + 2, w/2 - 8, -h/2 + 6);
    ctx.lineTo(w/2 - 6, h/2 - 6);
    ctx.quadraticCurveTo(w/2 - 10, h/2, w/2 - 18, h/2);
    ctx.lineTo(-w/2 + 18, h/2);
    ctx.quadraticCurveTo(-w/2 + 10, h/2, -w/2 + 6, h/2 - 6);
    ctx.closePath(); ctx.fill();

    // hood highlight
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(-w/4, -h/2 + 8);
    ctx.quadraticCurveTo(0, -h/2 + 2, w/4, -h/2 + 8);
    ctx.fill();

    // cockpit window with tint and small reflection
    ctx.fillStyle = 'rgba(20,30,40,0.6)';
    if (ctx.roundRect) { ctx.roundRect(-w/6, -h/4 - 2, (w/3) * 1.2, h/4, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-w/6 + 6, -h/4, (w/3) * 0.4, 3);
    } else { ctx.fillRect(-w/6, -h/4 - 2, (w/3) * 1.2, h/4); }

    // grille and subtle headlights
    ctx.fillStyle = '#111'; ctx.fillRect(-w/2 + 6, -h/2 + 10, 10, 6); ctx.fillRect(w/2 - 16, -h/2 + 10, 10, 6);
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9; ctx.fillRect(w/2 - 12, -h/2 + 10, 4, 4); ctx.fillRect(-w/2 + 10, -h/2 + 10, 4, 4); ctx.globalAlpha = 1;

    // rear spoiler
    ctx.fillStyle = '#a10033'; ctx.fillRect(w/2 - 18, -h/2 + 2, 14, 5);

    // wheels: elliptical tires and rim detail
    const wheelY = h/2 - 4;
    // left tire
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(-w/2 + 12, wheelY, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(-w/2 + 12, wheelY); ctx.rotate(wheelAngleRef.current);
    ctx.fillStyle = '#777'; for (let s = 0; s < 6; s++) { ctx.fillRect(-1, -3, 2, 6); ctx.rotate((Math.PI * 2) / 6); }
    ctx.restore();
    // right tire
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(w/2 - 12, wheelY, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(w/2 - 12, wheelY); ctx.rotate(wheelAngleRef.current);
    ctx.fillStyle = '#777'; for (let s = 0; s < 6; s++) { ctx.fillRect(-1, -3, 2, 6); ctx.rotate((Math.PI * 2) / 6); }
    ctx.restore();

    ctx.restore();

    // particles
    particlesRef.current.forEach(p => { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2, 2); });

    // HUD overlay
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(8, 8, 180, 48);
    ctx.fillStyle = '#F8B800'; ctx.font = '12px "Press Start 2P"'; ctx.fillText('SCORE', 16, 24);
    ctx.fillStyle = '#fff'; ctx.fillText(String(score).padStart(6, '0'), 16, 44);

    // subtle vignette
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // restore camera transform from shake
    ctx.restore();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key] = true; if (e.key === 'Escape') setGameState(s => (s === 'PLAYING' ? 'PAUSED' : (s === 'PAUSED' ? 'PLAYING' : s))); };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      startTimeRef.current = null; rafRef.current = requestAnimationFrame(update); sounds.init(); sounds.startMusic();
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (gameState !== 'PLAYING') sounds.stopMusic();
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [gameState, update]);

  const startGame = () => { sounds.init(); sounds.playStart(); setScore(0); playerXRef.current = (CANVAS_WIDTH - PLAYER_WIDTH) / 2; objectsRef.current = []; particlesRef.current = []; setGameState('PLAYING'); };

  const toggleMute = () => { setMuted(sounds.toggleMute()); };

  // touch controls for mobile
  const touchControl = (dir: 'left' | 'right' | 'boost', active: boolean) => {
    if (dir === 'left') keysRef.current['ArrowLeft'] = active;
    if (dir === 'right') keysRef.current['ArrowRight'] = active;
    if (dir === 'boost') keysRef.current[' '] = active;
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#5C94FC] font-game text-white select-none overflow-hidden">
      <div className="scanlines" />
      <div className="h-16 flex items-center justify-between px-8 bg-black border-b-8 border-[#303030] shrink-0 z-10">
        <div className="flex items-center gap-4"><div className="w-8 h-8 bg-[#F8B800] border-2 border-white"/><h1 className="text-2xl font-black tracking-tighter retro-shadow-magenta">ULTRA-LIGHT RACER</h1></div>
        <div className="flex items-center gap-8">
          <div className="bg-black/60 p-2 border-2 border-white"><p className="text-[8px] text-[#F8B800]">PORT</p><p className="text-sm">3000</p></div>
          <button onClick={toggleMute} className="bg-black/60 text-white p-2 border-2 border-white">{muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0">
        <div className="flex-1 relative flex items-center justify-center bg-[#00A800] retro-border-heavy">
          <div className="relative">
            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="bg-[#505050] max-h-full" />

            {/* touch controls */}
            <div className="absolute bottom-6 left-6 flex gap-3 z-40 md:hidden">
              <button onTouchStart={() => touchControl('left', true)} onTouchEnd={() => touchControl('left', false)} className="w-12 h-12 bg-black/60 rounded">◀</button>
              <button onTouchStart={() => touchControl('boost', true)} onTouchEnd={() => touchControl('boost', false)} className="w-12 h-12 bg-yellow-500 rounded">⚡</button>
              <button onTouchStart={() => touchControl('right', true)} onTouchEnd={() => touchControl('right', false)} className="w-12 h-12 bg-black/60 rounded">▶</button>
            </div>

            <AnimatePresence>
              {gameState === 'START' && (
                <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center p-8 z-30">
                  <h2 className="text-2xl text-[#F8B800] mb-8 retro-shadow-magenta">PRESS START</h2>
                  <button onClick={startGame} className="px-8 py-4 bg-[#E40058] text-white retro-border-medium">START ENGINE</button>
                </motion.div>
              )}
              {gameState === 'PAUSED' && (
                <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-black/60 flex items-center justify-center text-center p-8 z-30"><div className="bg-black/70 p-6 retro-border-medium"><h3 className="mb-4">PAUSED</h3><button onClick={() => setGameState('PLAYING')} className="px-4 py-2 bg-[#00A800]">RESUME</button></div></motion.div>
              )}
              {gameState === 'GAME_OVER' && (
                <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center z-30">
                  <h2 className="text-2xl text-white mb-4 retro-shadow-magenta">GAME OVER</h2>
                  <div className="text-xl text-[#F8B800] mb-6">FINAL: {score}</div>
                  <div className="bg-white/10 p-6 retro-border-medium w-full max-w-xs">
                    <p className="text-[8px] text-white/70 mb-4 uppercase">Enter 3 Letters</p>
                    <input type="text" maxLength={3} value={playerName} onChange={(e) => setPlayerName(e.target.value.toUpperCase())} className="w-full bg-black border-2 border-white text-center text-2xl py-2 text-[#5C94FC] outline-none font-game mb-4" />
                    <button onClick={submitScore} disabled={playerName.length < 1 || loading} className="w-full bg-[#00A800] text-white py-3 retro-border-medium">{loading ? 'SAVING...' : 'SAVE SCORE'}</button>
                  </div>
                  <button onClick={startGame} className="mt-6 flex items-center gap-2 text-white/50"><RotateCcw size={12}/>RETRY</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="w-80 flex flex-col gap-6 shrink-0 z-10">
          <div className="bg-white text-black p-4 retro-border-heavy flex-1 flex flex-col">
            <h2 className="text-lg font-black mb-4 border-b-4 border-black pb-2 tracking-tighter uppercase">TOP 5 RACERS</h2>
            <div className="space-y-4 flex-1">
              {highScores.map((s, i) => <div key={i} className="flex justify-between items-end dotted-border-b text-[11px]"><span>{i+1}. {s.name}</span><span className="text-lg font-bold">{s.score}</span></div>)}
              {highScores.length === 0 && <p className="text-black/30 text-[10px]">No logs found...</p>}
            </div>
            <div className="mt-8 p-2 bg-[#F8B800] text-center border-4 border-black text-[10px] font-bold">NEW HIGH SCORE!</div>
          </div>

          <div className="bg-black border-4 border-[#303030] p-4 text-[8px] space-y-1">
            <p className="text-[#F8B800]">{">"} SYSTEM_LOG</p>
            <p className="text-green-400">PERSISTENCE: JSON_FS...</p>
            <p className="text-green-400">MAPPED VOLUME: /APP/SCORES.JSON</p>
            <p className="text-green-400">CPU_LOAD: 0.05% (ULTRA-LIGHT)</p>
          </div>
        </div>
      </div>

      <div className="h-12 bg-black px-8 flex items-center justify-between border-t-8 border-[#303030] shrink-0 z-10">
        <div className="flex gap-6 text-[10px] text-[#F8B800]"><span>[ARROW KEYS] STEER</span><span>[SPACE] ACCEL</span><span>[ESC] PAUSE</span></div>
        <div className="text-[9px] flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-600 animate-ping"/> RECORDING HIGH SCORES TO DISK</div>
      </div>
    </div>
  );
}
