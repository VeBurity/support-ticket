import { create } from 'zustand';
import type { PublicUser } from '@/types/api';

interface AuthState {
  accessToken: string | null;
  user: PublicUser | null;
  status: 'idle' | 'authenticated' | 'unauthenticated';
  setSession: (accessToken: string, user: PublicUser) => void;
  setAccessToken: (accessToken: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'idle',
  setSession: (accessToken, user) =>
    set({ accessToken, user, status: 'authenticated' }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clear: () => set({ accessToken: null, user: null, status: 'unauthenticated' }),
}));
