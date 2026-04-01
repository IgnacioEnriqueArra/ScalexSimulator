import { create } from 'zustand';
import { db, auth } from '../firebase';
import { doc, setDoc, onSnapshot, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface GameState {
  speed: number;
  laps: number;
  bestLap: number | null;
  currentLapTime: number;
  isDerailed: boolean;
  isAccelerating: boolean;
  
  // Firebase state
  roomCode: string | null;
  isHost: boolean;
  isControllerConnected: boolean;
  user: User | null;
  isAuthReady: boolean;
  
  setSpeed: (speed: number) => void;
  setAccelerating: (isAcc: boolean) => void;
  derail: () => void;
  resetCar: () => void;
  completeLap: (time: number) => void;
  updateLapTime: (delta: number) => void;
  
  // Firebase actions
  initFirebase: () => void;
  createRoom: () => Promise<string>;
  joinRoom: (code: string) => Promise<boolean>;
  setControllerConnected: (connected: boolean) => void;
}

let unsubscribeRoom: (() => void) | null = null;

export const useGameStore = create<GameState>((set, get) => ({
  speed: 0,
  laps: 0,
  bestLap: null,
  currentLapTime: 0,
  isDerailed: false,
  isAccelerating: false,
  
  roomCode: null,
  isHost: false,
  isControllerConnected: false,
  user: null,
  isAuthReady: false,
  
  setSpeed: (speed) => set({ speed }),
  setAccelerating: async (isAccelerating) => {
    set({ isAccelerating });
    const { roomCode, isHost, user } = get();
    
    // If we are the controller, send the state to the host via Firestore
    if (roomCode && !isHost && user) {
      try {
        const roomRef = doc(db, 'rooms', roomCode);
        await updateDoc(roomRef, { isAccelerating });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomCode}`);
      }
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
  
  initFirebase: () => {
    if (!get().isAuthReady) {
      onAuthStateChanged(auth, (user) => {
        set({ user, isAuthReady: true });
        if (!user) {
          signInAnonymously(auth).catch((error) => {
            console.error("Error signing in anonymously:", error);
          });
        }
      });
    }
  },
  
  createRoom: async () => {
    const { user } = get();
    if (!user) return '';
    
    // Generate a 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const roomRef = doc(db, 'rooms', code);
    
    try {
      await setDoc(roomRef, {
        hostId: user.uid,
        isAccelerating: false,
        controllerConnected: false,
        createdAt: serverTimestamp()
      });
      
      set({ roomCode: code, isHost: true, isControllerConnected: false });
      
      // Listen for controller connection and acceleration changes
      if (unsubscribeRoom) unsubscribeRoom();
      unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.controllerConnected) {
            set({ isControllerConnected: true });
          }
          // Host reads acceleration from controller
          set({ isAccelerating: data.isAccelerating });
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `rooms/${code}`);
      });
      
      return code;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `rooms/${code}`);
      return '';
    }
  },
  
  joinRoom: async (code: string) => {
    const { user } = get();
    if (!user) return false;
    
    const roomRef = doc(db, 'rooms', code);
    
    try {
      const snapshot = await getDoc(roomRef);
      if (snapshot.exists()) {
        await updateDoc(roomRef, { controllerConnected: true });
        set({ roomCode: code, isHost: false, isControllerConnected: true });
        return true;
      }
      return false;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${code}`);
      return false;
    }
  },
  
  setControllerConnected: (connected) => set({ isControllerConnected: connected }),
}));
