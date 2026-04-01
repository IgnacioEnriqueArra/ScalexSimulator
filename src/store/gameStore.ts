import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface GameState {
  speed: number;
  laps: number;
  bestLap: number | null;
  currentLapTime: number;
  isDerailed: boolean;
  isAccelerating: boolean;
  
  // Socket state
  socket: Socket | null;
  roomCode: string | null;
  isHost: boolean;
  isControllerConnected: boolean;
  
  setSpeed: (speed: number) => void;
  setAccelerating: (isAcc: boolean) => void;
  derail: () => void;
  resetCar: () => void;
  completeLap: (time: number) => void;
  updateLapTime: (delta: number) => void;
  
  // Socket actions
  initSocket: () => void;
  createRoom: () => string;
  joinRoom: (code: string) => Promise<boolean>;
  setControllerConnected: (connected: boolean) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  speed: 0,
  laps: 0,
  bestLap: null,
  currentLapTime: 0,
  isDerailed: false,
  isAccelerating: false,
  
  socket: null,
  roomCode: null,
  isHost: false,
  isControllerConnected: false,
  
  setSpeed: (speed) => set({ speed }),
  setAccelerating: (isAccelerating) => {
    set({ isAccelerating });
    const { socket, roomCode, isHost } = get();
    // If we are the controller, send the state to the host
    if (socket && roomCode && !isHost) {
      socket.emit('accelerationChange', roomCode, isAccelerating);
    }
  },
  derail: () => set({ isDerailed: true, speed: 0, isAccelerating: false }),
  resetCar: () => set({ isDerailed: false, speed: 0, currentLapTime: 0 }),
  completeLap: (time) => set((state) => ({
    laps: state.laps + 1,
    currentLapTime: 0,
    bestLap: state.bestLap ? Math.min(state.bestLap, time) : time,
  })),
  updateLapTime: (delta) => set((state) => ({
    currentLapTime: state.isDerailed ? state.currentLapTime : state.currentLapTime + delta
  })),
  
  initSocket: () => {
    if (!get().socket) {
      const socket = io();
      
      socket.on('controllerConnected', () => {
        set({ isControllerConnected: true });
      });
      
      socket.on('accelerationChange', (isAccelerating: boolean) => {
        // Only the host should react to this
        if (get().isHost) {
          set({ isAccelerating });
        }
      });
      
      set({ socket });
    }
  },
  
  createRoom: () => {
    const { socket } = get();
    if (!socket) return '';
    
    // Generate a 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    socket.emit('createRoom', code);
    set({ roomCode: code, isHost: true, isControllerConnected: false });
    return code;
  },
  
  joinRoom: (code: string) => {
    return new Promise((resolve) => {
      const { socket } = get();
      if (!socket) {
        resolve(false);
        return;
      }
      
      socket.emit('joinRoom', code, (response: { success: boolean }) => {
        if (response.success) {
          set({ roomCode: code, isHost: false, isControllerConnected: true });
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  },
  
  setControllerConnected: (connected) => set({ isControllerConnected: connected }),
}));
