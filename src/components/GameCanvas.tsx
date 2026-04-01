import React, { useEffect, useRef, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { Spline2D } from '../utils/spline';

// Define the track waypoints (a curvy oval)
const points = [
  { x: 100, y: 100 },
  { x: 700, y: 100 },
  { x: 800, y: 300 },
  { x: 600, y: 500 },
  { x: 400, y: 400 },
  { x: 200, y: 500 },
  { x: 50, y: 300 },
];

const spline = new Spline2D(points);

// Simple Audio Synthesizer for Electric Motor
class MotorSound {
  ctx: AudioContext | null = null;
  osc: OscillatorNode | null = null;
  gain: GainNode | null = null;
  filter: BiquadFilterNode | null = null;
  isPlaying = false;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.osc = this.ctx.createOscillator();
    this.osc.type = 'sawtooth'; // Electric whine
    
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 5;
    
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;

    this.osc.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(this.ctx.destination);
    
    this.osc.start();
    this.isPlaying = true;
  }

  update(speed: number, isAccelerating: boolean) {
    if (!this.ctx || !this.osc || !this.gain || !this.filter) return;
    
    // Resume context if suspended (browser policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const normalizedSpeed = Math.max(0, Math.min(1, speed / 30));
    
    // Pitch goes up with speed
    const baseFreq = 150;
    const targetFreq = baseFreq + (normalizedSpeed * 600);
    this.osc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);

    // Filter opens up with speed
    const targetCutoff = 500 + (normalizedSpeed * 2000);
    this.filter.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 0.1);

    // Volume depends on acceleration and speed
    let targetVol = 0;
    if (isAccelerating) {
      targetVol = 0.1 + (normalizedSpeed * 0.15); // Louder when on throttle
    } else if (speed > 1) {
      targetVol = 0.05 + (normalizedSpeed * 0.05); // Coasting whine
    }
    
    this.gain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.05);
  }

  stop() {
    if (this.gain && this.ctx) {
      this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }
}

const motorSound = new MotorSound();

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDerailed = useGameStore((state) => state.isDerailed);
  const setAccelerating = useGameStore((state) => state.setAccelerating);
  
  const carPos = useRef({ x: points[0].x, y: points[0].y });
  const carAngle = useRef(Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x));
  const carSpeed = useRef(0);
  const hasStarted = useRef(false);
  const nextCheckpoint = useRef(1); // 0 is start, 1 is middle, 2 is end
  
  const zoomLevel = useRef(1.4); // For zooming
  
  const lastTime = useRef(performance.now());
  const animationFrameId = useRef<number>(0);

  // Precompute track points for collision detection
  const trackPoints = useMemo(() => spline.getSpacedPoints(1000), []);
  const checkpoints = useMemo(() => [
    trackPoints[0],
    trackPoints[333],
    trackPoints[666]
  ], [trackPoints]);

  // RC Physics constants
  const ACCEL = 250;
  const BRAKE = 350;
  const REVERSE_ACCEL = 150;
  const FRICTION = 60;
  const MAX_SPEED = 450;
  const MAX_REVERSE = 200;
  const TURN_SPEED = 3.5; // Radians per second at full speed
  const TRACK_RADIUS = 28; // Track width is 60, so radius is 30. Car has width.

  useEffect(() => {
    const keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      up: false,
      down: false,
      left: false,
      right: false,
      space: false,
    };

    const updateControls = () => {
      const accel = keys.w || keys.up || keys.space;
      const rev = keys.s || keys.down;
      let steer = 0;
      if (keys.a || keys.left) steer = -1;
      if (keys.d || keys.right) steer = 1;
      if ((keys.a || keys.left) && (keys.d || keys.right)) steer = 0;
      
      useGameStore.getState().setControls(accel, rev, steer);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      let changed = false;
      if (e.code === 'Space') { keys.space = true; changed = true; motorSound.init(); }
      if (e.code === 'KeyW') { keys.w = true; changed = true; motorSound.init(); }
      if (e.code === 'ArrowUp') { keys.up = true; changed = true; motorSound.init(); }
      if (e.code === 'KeyS') { keys.s = true; changed = true; motorSound.init(); }
      if (e.code === 'ArrowDown') { keys.down = true; changed = true; motorSound.init(); }
      if (e.code === 'KeyA') { keys.a = true; changed = true; }
      if (e.code === 'ArrowLeft') { keys.left = true; changed = true; }
      if (e.code === 'KeyD') { keys.d = true; changed = true; }
      if (e.code === 'ArrowRight') { keys.right = true; changed = true; }
      
      if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        zoomLevel.current = Math.min(zoomLevel.current + 0.1, 4.0);
      }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        zoomLevel.current = Math.max(zoomLevel.current - 0.1, 0.5);
      }

      if (changed) updateControls();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      let changed = false;
      if (e.code === 'Space') { keys.space = false; changed = true; }
      if (e.code === 'KeyW') { keys.w = false; changed = true; }
      if (e.code === 'ArrowUp') { keys.up = false; changed = true; }
      if (e.code === 'KeyS') { keys.s = false; changed = true; }
      if (e.code === 'ArrowDown') { keys.down = false; changed = true; }
      if (e.code === 'KeyA') { keys.a = false; changed = true; }
      if (e.code === 'ArrowLeft') { keys.left = false; changed = true; }
      if (e.code === 'KeyD') { keys.d = false; changed = true; }
      if (e.code === 'ArrowRight') { keys.right = false; changed = true; }

      if (changed) updateControls();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      motorSound.stop();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Handle resize to make it full screen
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const render = (time: number) => {
      const delta = Math.min((time - lastTime.current) / 1000, 0.1); // Cap delta to prevent huge jumps
      lastTime.current = time;

      const state = useGameStore.getState();
      const { isAccelerating, isReversing, steering } = state;

      // Update audio
      motorSound.update(Math.abs(carSpeed.current) / 10, isAccelerating || isReversing);

      // Start timer on first movement
      if (!hasStarted.current && Math.abs(carSpeed.current) > 0.1) {
        hasStarted.current = true;
      }
      if (hasStarted.current) {
        state.updateLapTime(delta);
      }
      
      // RC Physics
      let speed = carSpeed.current;
      if (isAccelerating) {
        if (speed < 0) speed += BRAKE * delta; // Braking
        else speed += ACCEL * delta; // Accelerating
      } else if (isReversing) {
        if (speed > 0) speed -= BRAKE * delta; // Braking
        else speed -= REVERSE_ACCEL * delta; // Reversing
      } else {
        // Friction
        if (speed > 0) speed = Math.max(0, speed - FRICTION * delta);
        if (speed < 0) speed = Math.min(0, speed + FRICTION * delta);
      }

      speed = Math.max(-MAX_REVERSE, Math.min(MAX_SPEED, speed));

      // Steering (only when moving)
      if (Math.abs(speed) > 5) {
        const turnDir = speed > 0 ? 1 : -1;
        // Steering is -1 (left) to 1 (right)
        carAngle.current += steering * TURN_SPEED * turnDir * delta * (Math.abs(speed) / MAX_SPEED);
      }

      carPos.current.x += Math.cos(carAngle.current) * speed * delta;
      carPos.current.y += Math.sin(carAngle.current) * speed * delta;

      // Collision detection
      let minDist = Infinity;
      let closestPt = trackPoints[0];
      for (const pt of trackPoints) {
        const dist = Math.hypot(carPos.current.x - pt.x, carPos.current.y - pt.y);
        if (dist < minDist) {
          minDist = dist;
          closestPt = pt;
        }
      }

      if (minDist > TRACK_RADIUS) {
        // Push back inside the track
        const angleToCenter = Math.atan2(closestPt.y - carPos.current.y, closestPt.x - carPos.current.x);
        carPos.current.x = closestPt.x - Math.cos(angleToCenter) * TRACK_RADIUS;
        carPos.current.y = closestPt.y - Math.sin(angleToCenter) * TRACK_RADIUS;
        // Bounce / lose speed
        speed *= -0.5;
      }

      carSpeed.current = speed;
      state.setSpeed(Math.abs(speed) / 10); // Scale for UI

      // Checkpoint logic for laps
      const cpDist = Math.hypot(carPos.current.x - checkpoints[nextCheckpoint.current].x, carPos.current.y - checkpoints[nextCheckpoint.current].y);
      if (cpDist < 60) {
        nextCheckpoint.current = (nextCheckpoint.current + 1) % checkpoints.length;
        if (nextCheckpoint.current === 1 && hasStarted.current) {
          // Crossed start line!
          state.completeLap(useGameStore.getState().currentLapTime);
        }
      }

      drawScene(ctx, canvas.width, canvas.height, steering);
      animationFrameId.current = requestAnimationFrame(render);
    };

    animationFrameId.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const drawScene = (ctx: CanvasRenderingContext2D, width: number, height: number, steering: number) => {
    // Center the track in the screen
    ctx.save();
    // Calculate scale to fit track
    const trackWidth = 850; // Max X (800) + margin
    const trackHeight = 600; // Max Y (500) + margin
    const trackCenterX = 425; // (Min X 50 + Max X 800) / 2
    const trackCenterY = 300; // (Min Y 100 + Max Y 500) / 2
    
    const scale = Math.min(width / trackWidth, height / trackHeight) * zoomLevel.current;
    
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-trackCenterX, -trackCenterY);

    // Clear background
    ctx.fillStyle = '#2d4a22';
    ctx.fillRect(-1000, -1000, 3000, 3000); // Fill way beyond bounds

    const numSegments = 300;
    
    // Track base
    ctx.lineWidth = 60; // Wider track
    ctx.strokeStyle = '#333';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const p = spline.getPoint(t);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Start/Finish line
    ctx.lineWidth = 60;
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    const startP = spline.getPoint(0);
    const startTangent = spline.getTangent(0);
    const startNormal = { x: -startTangent.y, y: startTangent.x };
    ctx.moveTo(startP.x - startNormal.x * 30, startP.y - startNormal.y * 30);
    ctx.lineTo(startP.x + startNormal.x * 30, startP.y + startNormal.y * 30);
    ctx.stroke();
    
    // Draw Player Car
    drawCar(ctx, carPos.current.x, carPos.current.y, carAngle.current, '#ff0044', steering);

    ctx.restore(); // Restore screen centering
  };

  const drawCar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, color: string, steering: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(1.5, 1.5); // Slightly larger car

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-6, -2, 16, 8); 

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(-8, -4, 16, 8); 
    
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(-8, -4, 16, 2);
    
    // Cockpit
    ctx.fillStyle = '#111';
    ctx.fillRect(-4, -3, 6, 6); 
    
    // Window reflection
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-2, -2, 2, 2);

    // Headlights
    ctx.fillStyle = '#fff';
    ctx.fillRect(6, -3, 2, 2); 
    ctx.fillRect(6, 1, 2, 2); 
    
    // Wheels (turn slightly based on steering)
    ctx.fillStyle = '#222';
    ctx.fillRect(-6, -5, 4, 2); // RL
    ctx.fillRect(-6, 3, 4, 2); // RR
    
    ctx.save();
    ctx.translate(5, -4);
    ctx.rotate(steering * 0.5); // Front wheels steer
    ctx.fillRect(-2, -1, 4, 2); // FL
    ctx.restore();

    ctx.save();
    ctx.translate(5, 4);
    ctx.rotate(steering * 0.5);
    ctx.fillRect(-2, -1, 4, 2); // FR
    ctx.restore();

    ctx.restore();
  };

  return (
    <div className="absolute inset-0 bg-stone-900 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="absolute top-4 left-4 text-white font-pixel text-xl drop-shadow-[2px_2px_0px_#000]">
        <p>LAP: {useGameStore((state) => state.laps)}</p>
        <p>TIME: {useGameStore((state) => state.currentLapTime).toFixed(2)}s</p>
        {useGameStore((state) => state.bestLap) !== null && (
          <p className="text-green-400">BEST: {useGameStore((state) => state.bestLap)?.toFixed(2)}s</p>
        )}
      </div>
    </div>
  );
};
