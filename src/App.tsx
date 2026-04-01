import { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { MainMenu } from './components/MainMenu';
import { Controller } from './components/Controller';

type ViewState = 'MENU' | 'GAME' | 'CONTROLLER';

export default function App() {
  const [view, setView] = useState<ViewState>('MENU');

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-stone-950 font-sans text-stone-100 selection:bg-emerald-500/30">
      {view === 'MENU' && (
        <MainMenu 
          onStartGame={() => setView('GAME')} 
          onStartController={() => setView('CONTROLLER')} 
        />
      )}
      {view === 'GAME' && <GameCanvas />}
      {view === 'CONTROLLER' && <Controller />}

      {/* CRT Scanlines Overlay */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'linear-gradient(transparent 50%, rgba(0, 0, 0, 0.5) 50%)',
          backgroundSize: '100% 4px',
        }}
      />
      {/* Vignette Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] mix-blend-multiply" />
    </main>
  );
}
