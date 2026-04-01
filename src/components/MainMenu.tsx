import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

interface MainMenuProps {
  onStartGame: () => void;
  onStartController: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStartGame, onStartController }) => {
  const { initFirebase, createRoom, joinRoom, isAuthReady, user, isHost, isControllerConnected } = useGameStore();
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [hostCode, setHostCode] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    initFirebase();
    
    // Simple mobile detection
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      if (/android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent)) {
        setIsMobile(true);
      } else if (window.innerWidth <= 768) {
        setIsMobile(true);
      }
    };
    
    checkMobile();
  }, [initFirebase]);

  useEffect(() => {
    if (isHost && isControllerConnected) {
      onStartGame();
    }
  }, [isHost, isControllerConnected, onStartGame]);

  const handleCreateGame = async () => {
    if (!isAuthReady || !user) {
      setError('Conectando al servidor...');
      return;
    }
    setIsCreating(true);
    const code = await createRoom();
    if (code) {
      setHostCode(code);
    } else {
      setError('Error al crear la partida');
    }
    setIsCreating(false);
  };

  const handleJoinGame = async () => {
    if (!isAuthReady || !user) {
      setError('Conectando al servidor...');
      return;
    }
    if (roomCode.length !== 4) {
      setError('El código debe tener 4 dígitos');
      return;
    }
    
    const success = await joinRoom(roomCode);
    if (success) {
      onStartController();
    } else {
      setError('Código inválido o sala no encontrada');
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 font-pixel">
      <div className="bg-stone-800 border-4 border-stone-600 p-8 max-w-md w-full shadow-[12px_12px_0px_rgba(0,0,0,0.5)]">
        <h1 className="text-4xl text-white text-center mb-8 drop-shadow-[2px_2px_0px_#000]">
          RC CAR RACING
        </h1>

        {hostCode ? (
          <div className="text-center">
            <p className="text-stone-300 mb-4">CÓDIGO DE VINCULACIÓN:</p>
            <div className="text-6xl text-green-400 tracking-widest mb-8 drop-shadow-[2px_2px_0px_#000]">
              {hostCode}
            </div>
            <p className="text-stone-400 text-sm mb-8">
              Ingresa desde tu celular a esta misma web y usa este código para usarlo como mando.
            </p>
            <div className="w-full bg-stone-700 text-stone-300 px-6 py-4 text-xl border-b-4 border-stone-900 animate-pulse">
              ESPERANDO MANDO...
            </div>
          </div>
        ) : isMobile ? (
          <div className="flex flex-col gap-4">
            <p className="text-stone-300 text-center mb-2">MODO MANDO</p>
            <input
              type="text"
              maxLength={4}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, ''))}
              placeholder="CÓDIGO (4 DÍGITOS)"
              className="w-full bg-stone-900 text-white border-2 border-stone-600 p-4 text-center text-2xl tracking-widest focus:outline-none focus:border-green-500"
            />
            {error && <p className="text-red-500 text-center text-sm">{error}</p>}
            <button
              onClick={handleJoinGame}
              className="w-full bg-green-500 text-white px-6 py-4 text-xl border-b-4 border-green-700 hover:bg-green-400 hover:border-green-600 active:border-b-0 active:translate-y-1 transition-all mt-4"
            >
              CONECTAR MANDO
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {error && <p className="text-red-500 text-center text-sm">{error}</p>}
            <button
              onClick={handleCreateGame}
              disabled={isCreating || !isAuthReady}
              className="w-full bg-green-500 text-white px-6 py-4 text-xl border-b-4 border-green-700 hover:bg-green-400 hover:border-green-600 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'CREANDO...' : 'CREAR PARTIDA'}
            </button>
            <button
              onClick={() => setIsMobile(true)}
              className="w-full bg-stone-700 text-white px-6 py-4 text-xl border-b-4 border-stone-900 hover:bg-stone-600 hover:border-stone-800 active:border-b-0 active:translate-y-1 transition-all"
            >
              USAR COMO MANDO
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
