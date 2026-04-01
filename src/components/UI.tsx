import { useGameStore } from '../store/gameStore';

export function UI() {
  const { speed, laps, bestLap, currentLapTime, isDerailed, resetCar } = useGameStore();

  const formatTime = (time: number) => {
    return time.toFixed(2) + 's';
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 font-pixel">
      <div className="flex justify-between items-start">
        {/* Top Left: Stats */}
        <div className="bg-stone-900/90 border-4 border-stone-600 p-4 text-stone-100 shadow-[8px_8px_0px_rgba(0,0,0,0.5)] flex flex-col gap-3 min-w-[200px]">
          <div className="flex items-center justify-between border-b-2 border-stone-700 pb-2">
            <div className="text-stone-400 text-xl uppercase tracking-widest">
              TELEMETRY
            </div>
            <div className="text-sm text-stone-500">
              v1.0
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <div className="text-sm text-stone-500 uppercase">SPEED</div>
              <div className="text-3xl text-emerald-400">
                {Math.round(speed * 10)} <span className="text-lg text-stone-500">KM/H</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-stone-500 uppercase">LAPS</div>
              <div className="text-3xl text-white">
                {laps}
              </div>
            </div>
          </div>

          <div className="h-0.5 bg-stone-700 my-1" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-stone-500 uppercase">CURRENT</div>
              <div className="text-2xl text-stone-300">
                {formatTime(currentLapTime)}
              </div>
            </div>
            <div>
              <div className="text-sm text-stone-500 uppercase">BEST</div>
              <div className="text-2xl text-amber-400">
                {bestLap ? formatTime(bestLap) : '--'}
              </div>
            </div>
          </div>
        </div>

        {/* Top Right: Title & Controls */}
        <div className="flex flex-col items-end gap-4">
          <div className="bg-stone-900/90 border-4 border-stone-600 px-6 py-3 shadow-[8px_8px_0px_rgba(0,0,0,0.5)]">
            <h1 className="text-5xl tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-amber-500 drop-shadow-[2px_2px_0px_#fff]">
              SCALEX<span className="text-white">SIM</span>
            </h1>
          </div>
          
          <div className="bg-stone-900/90 border-4 border-stone-600 p-4 text-stone-100 shadow-[8px_8px_0px_rgba(0,0,0,0.5)] flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xl text-stone-400 uppercase tracking-wider">ACCELERATE</span>
              <kbd className="bg-stone-800 border-b-4 border-stone-950 px-4 py-1 text-xl text-white shadow-sm">
                SPACE
              </kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Derailment Alert */}
      {isDerailed && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          <div className="bg-red-950/95 border-4 border-red-500 p-8 shadow-[12px_12px_0px_rgba(0,0,0,0.8)] flex flex-col items-center gap-4 animate-in zoom-in duration-200">
            <div className="text-center">
              <h2 className="text-5xl text-red-500 mb-2 drop-shadow-[2px_2px_0px_#000]">DERAILED!</h2>
              <p className="text-xl text-red-200">TOO FAST ON THE CORNER</p>
            </div>
            <button 
              onClick={resetCar}
              className="mt-4 bg-white text-red-950 px-8 py-4 text-2xl border-b-4 border-stone-400 hover:bg-stone-200 hover:border-stone-500 active:border-b-0 active:translate-y-1 transition-all"
            >
              RESET CAR
            </button>
          </div>
        </div>
      )}

      {/* Bottom: Speed Bar */}
      <div className="w-full max-w-2xl mx-auto bg-stone-900/90 border-4 border-stone-600 p-4 shadow-[8px_8px_0px_rgba(0,0,0,0.5)] flex items-center gap-4">
        <div className="text-2xl text-amber-400">PWR</div>
        <div className="flex-1 h-6 bg-stone-800 border-2 border-stone-950 overflow-hidden relative">
          {/* Grip Limit Marker */}
          <div className="absolute top-0 bottom-0 w-1 bg-red-500 z-10" style={{ left: '75%' }} />
          
          <div 
            className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-all duration-75 ease-out"
            style={{ width: `${Math.min(100, (speed / 25) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
