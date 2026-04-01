import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Spline2D } from '../utils/spline';

// Define the track waypoints (a curvy oval)
const trackPoints = [
  { x: 100, y: 100 },
  { x: 700, y: 100 },
  { x: 800, y: 300 },
  { x: 600, y: 500 },
  { x: 400, y: 400 },
  { x: 200, y: 500 },
  { x: 50, y: 300 },
];

const spline = new Spline2D(trackPoints);

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
  
  const playerT = useRef(0);
  const driftAngle = useRef(0); // For visual drifting
  const lateralOffset = useRef(0); // For deslotting
  const zoomLevel = useRef(1.4); // For zooming
  
  const lastTime = useRef(performance.now());
  const animationFrameId = useRef<number>(0);

  // Physics constants
  const ACCELERATION = 12; // Slower, progressive acceleration
  const BRAKING_FRICTION = 8; // Engine braking
  const COASTING_FRICTION = 2; // Rolling resistance
  const MAX_SPEED = 35; // Higher top speed
  const GRIP_LIMIT = 22; // Speed at which drifting starts
  const DERAIL_LIMIT = 28; // Speed at which you fly off

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setAccelerating(true);
        motorSound.init(); // Init audio on first interaction
      }
      if (e.code === 'ArrowUp') {
        zoomLevel.current = Math.min(zoomLevel.current + 0.1, 4.0);
      }
      if (e.code === 'ArrowDown') {
        zoomLevel.current = Math.max(zoomLevel.current - 0.1, 0.5);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setAccelerating(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      motorSound.stop();
    };
  }, [setAccelerating]);

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
      const currentSpeedState = state.speed;
      const isAccelerating = state.isAccelerating;
      const isDerailed = state.isDerailed;

      // Update audio
      if (!isDerailed) {
        motorSound.update(currentSpeedState, isAccelerating);
      } else {
        motorSound.stop();
      }

      if (!isDerailed) {
        state.updateLapTime(delta);
        
        // Progressive Physics
        let currentSpeed = currentSpeedState;
        if (isAccelerating) {
          // Acceleration curve: less acceleration at higher speeds
          const accFactor = 1 - (currentSpeed / MAX_SPEED) * 0.5;
          currentSpeed += ACCELERATION * accFactor * delta;
        } else {
          // Inertia: slow down gradually
          const friction = currentSpeed > 10 ? BRAKING_FRICTION : COASTING_FRICTION;
          currentSpeed -= friction * delta;
        }
        currentSpeed = Math.max(0, Math.min(currentSpeed, MAX_SPEED));
        state.setSpeed(currentSpeed);

        // Move player
        playerT.current += (currentSpeed * delta) / 150; // Track length divisor
        if (playerT.current >= 1) {
          playerT.current -= 1;
          state.completeLap(useGameStore.getState().currentLapTime);
        }

        // Cornering Physics
        const curvature = spline.getSignedCurvature(playerT.current);
        const absCurvature = Math.abs(curvature);
        
        // Centrifugal force
        const force = currentSpeed * absCurvature;

        // Drifting disabled per user request
        driftAngle.current = 0;

        // Derailment disabled per user request
        lateralOffset.current = 0;
      } else {
        // Post-derail physics (slide to a stop)
        let currentSpeed = currentSpeedState;
        currentSpeed -= 20 * delta; // High friction on grass
        currentSpeed = Math.max(0, currentSpeed);
        state.setSpeed(currentSpeed);
        
        // Continue moving in the direction of the derailment
        if (currentSpeed > 0) {
            const curvature = spline.getSignedCurvature(playerT.current);
            lateralOffset.current += currentSpeed * delta * 2 * Math.sign(curvature || 1);
            playerT.current += (currentSpeed * delta) / 200; // Slower forward movement
        }
      }

      drawScene(ctx, canvas.width, canvas.height);
      animationFrameId.current = requestAnimationFrame(render);
    };

    animationFrameId.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const drawScene = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
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

    // Single Slot (Center)
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#111';
    ctx.beginPath();
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const p = spline.getPoint(t);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    
    // Slot metallic reflection
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#888';
    ctx.beginPath();
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const p = spline.getPoint(t);
      if (i === 0) ctx.moveTo(p.x - 1, p.y - 1);
      else ctx.lineTo(p.x - 1, p.y - 1);
    }
    ctx.stroke();

    // Draw Player Car (Center lane, with drift and offset)
    drawCar(ctx, playerT.current, lateralOffset.current, driftAngle.current, '#ff0044', isDerailed);

    ctx.restore(); // Restore screen centering
  };

  const drawCar = (ctx: CanvasRenderingContext2D, t: number, offset: number, drift: number, color: string, derailed: boolean) => {
    const p = spline.getPoint(t);
    const tangent = spline.getTangent(t);
    const normal = { x: -tangent.y, y: tangent.x };
    
    let cx = p.x + normal.x * offset;
    let cy = p.y + normal.y * offset;
    let angle = Math.atan2(tangent.y, tangent.x);

    if (!derailed) {
        // Apply drift rotation
        angle += drift;
    } else {
        // Spin out
        angle += drift + (offset * 0.1);
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(1.5, 1.5); // Slightly larger car

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-6, -2 + (drift * 5), 16, 8); // Shadow shifts during drift

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
    
    // Wheels (turn slightly during drift)
    ctx.fillStyle = '#222';
    ctx.fillRect(-6, -5, 4, 2); // RL
    ctx.fillRect(-6, 3, 4, 2); // RR
    
    ctx.save();
    ctx.translate(5, -4);
    ctx.rotate(drift * 2); // Front wheels steer into drift
    ctx.fillRect(-2, -1, 4, 2); // FL
    ctx.restore();

    ctx.save();
    ctx.translate(5, 4);
    ctx.rotate(drift * 2);
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
    </div>
  );
};
