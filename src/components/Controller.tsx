import React, { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export const Controller: React.FC = () => {
  const { setAccelerating, roomCode } = useGameStore();

  useEffect(() => {
    // Prevent default touch behaviors like scrolling or zooming
    const preventDefault = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', preventDefault, { passive: false });
    return () => {
      document.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  const handlePressIn = () => {
    setAccelerating(true);
    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const handlePressOut = () => {
    setAccelerating(false);
  };

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-4 font-pixel select-none">
      <div className="absolute top-4 left-4 text-stone-500 text-sm">
        SALA: {roomCode}
      </div>
      
      <div className="text-center mb-12">
        <h2 className="text-3xl text-stone-400 mb-2">MANDO</h2>
        <p className="text-stone-600 text-sm">MANTÉN PRESIONADO PARA ACELERAR</p>
      </div>

      <button
        onPointerDown={handlePressIn}
        onPointerUp={handlePressOut}
        onPointerLeave={handlePressOut}
        className="w-64 h-64 rounded-full bg-red-600 border-b-[16px] border-red-800 shadow-[0_20px_50px_rgba(220,38,38,0.5)] active:border-b-0 active:translate-y-4 transition-all flex items-center justify-center touch-none"
      >
        <span className="text-white text-4xl font-bold drop-shadow-[2px_2px_0px_#000]">
          GAS
        </span>
      </button>
    </div>
  );
};
