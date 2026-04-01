import React, { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';

export const Controller: React.FC = () => {
  const { setControls, roomCode } = useGameStore();

  const [accel, setAccel] = useState(false);
  const [rev, setRev] = useState(false);
  const [steer, setSteer] = useState(0);

  // Sync state to store whenever it changes
  useEffect(() => {
    setControls(accel, rev, steer);
  }, [accel, rev, steer, setControls]);

  useEffect(() => {
    // Prevent default touch behaviors like scrolling or zooming
    const preventDefault = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', preventDefault, { passive: false });
    
    // Force landscape if possible
    if (screen.orientation && (screen.orientation as any).lock) {
      (screen.orientation as any).lock('landscape').catch(() => {
        // Ignore errors if not supported
      });
    }

    return () => {
      document.removeEventListener('touchmove', preventDefault);
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    };
  }, []);

  const vibrate = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-stone-900 flex flex-row items-center justify-between p-8 font-pixel select-none touch-none">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="text-stone-500 text-sm">
          SALA: {roomCode}
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-stone-800 text-stone-400 px-4 py-2 text-xs rounded border-b-2 border-stone-900 active:border-b-0 active:translate-y-0.5"
        >
          DESCONECTAR
        </button>
      </div>
      
      {/* Left side: Steering */}
      <div className="flex gap-4 h-full items-center">
        <button
          onPointerDown={() => { setSteer(-1); vibrate(); }}
          onPointerUp={() => setSteer(0)}
          onPointerLeave={() => setSteer(0)}
          className="w-24 h-24 rounded-2xl bg-stone-700 border-b-[8px] border-stone-800 active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center touch-none"
        >
          <span className="text-white text-3xl font-bold">{'<'}</span>
        </button>
        <button
          onPointerDown={() => { setSteer(1); vibrate(); }}
          onPointerUp={() => setSteer(0)}
          onPointerLeave={() => setSteer(0)}
          className="w-24 h-24 rounded-2xl bg-stone-700 border-b-[8px] border-stone-800 active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center touch-none"
        >
          <span className="text-white text-3xl font-bold">{'>'}</span>
        </button>
      </div>

      {/* Right side: Gas/Brake */}
      <div className="flex gap-4 h-full items-center">
        <button
          onPointerDown={() => { setRev(true); vibrate(); }}
          onPointerUp={() => setRev(false)}
          onPointerLeave={() => setRev(false)}
          className="w-24 h-24 rounded-2xl bg-red-600 border-b-[8px] border-red-800 active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center touch-none"
        >
          <span className="text-white text-xl font-bold drop-shadow-[2px_2px_0px_#000]">
            REV
          </span>
        </button>
        <button
          onPointerDown={() => { setAccel(true); vibrate(); }}
          onPointerUp={() => setAccel(false)}
          onPointerLeave={() => setAccel(false)}
          className="w-32 h-32 rounded-full bg-green-500 border-b-[12px] border-green-700 shadow-[0_10px_30px_rgba(34,197,94,0.3)] active:border-b-0 active:translate-y-3 transition-all flex items-center justify-center touch-none"
        >
          <span className="text-white text-3xl font-bold drop-shadow-[2px_2px_0px_#000]">
            GAS
          </span>
        </button>
      </div>
    </div>
  );
};
