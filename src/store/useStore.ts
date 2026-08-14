import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  DriveFile,
  DriveFolder,
  PlayerTrack,
  ThemeMode,
  RepeatModeSetting,
} from '../types';

interface AuthSlice {
  isAuthenticated: boolean;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userPhoto: string | null;
  accessToken: string | null;
  tokenExpiresAt: number | null;
  myCloudPlayerFolderId: string | null;
}

interface SettingsSlice {
  youtubeApiKey: string;
  theme: ThemeMode;
}

interface LibrarySlice {
  songs: DriveFile[];
  playlists: DriveFolder[];
  isLoadingLibrary: boolean;
  libraryError: string | null;
}

interface PlayerSlice {
  currentTrack: PlayerTrack | null;
  playbackQueue: PlayerTrack[];
  playbackIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  shuffleEnabled: boolean;
  repeatMode: RepeatModeSetting;
  isPlayerOpen: boolean;
  isQueueOpen: boolean;
}

interface AppState extends AuthSlice, SettingsSlice, LibrarySlice, PlayerSlice {
  setAuth: (
    userInfo: { id: string; email: string; name: string; photo?: string | null },
    accessToken: string,
    folderId: string,
    expiresIn?: number
  ) => void;
  updateAccessToken: (token: string, expiresIn?: number) => void;
  clearAuth: () => void;

  setYoutubeApiKey: (key: string) => void;
  setTheme: (theme: ThemeMode) => void;

  setSongs: (songs: DriveFile[]) => void;
  addSong: (song: DriveFile) => void;
  removeSong: (id: string) => void;
  setPlaylists: (playlists: DriveFolder[]) => void;
  addPlaylist: (playlist: DriveFolder) => void;
  removePlaylist: (id: string) => void;
  setLoadingLibrary: (loading: boolean) => void;
  setLibraryError: (error: string | null) => void;

  setCurrentTrack: (track: PlayerTrack | null) => void;
  setPlaybackSession: (
    queue: PlayerTrack[],
    index: number,
    track?: PlayerTrack | null
  ) => void;
  setPlaying: (playing: boolean) => void;
  setBuffering: (buffering: boolean) => void;
  setProgress: (position: number, duration: number) => void;
  setShuffleEnabled: (enabled: boolean) => void;
  setRepeatMode: (mode: RepeatModeSetting) => void;
  toggleShuffle: () => void;
  setPlayerOpen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userId: null,
      userEmail: null,
      userName: null,
      userPhoto: null,
      accessToken: null,
      tokenExpiresAt: null,
      myCloudPlayerFolderId: null,

      youtubeApiKey: import.meta.env.VITE_YOUTUBE_API_KEY ?? '',
      theme: 'system',

      songs: [],
      playlists: [],
      isLoadingLibrary: false,
      libraryError: null,

      currentTrack: null,
      playbackQueue: [],
      playbackIndex: 0,
      isPlaying: false,
      isBuffering: false,
      position: 0,
      duration: 0,
      shuffleEnabled: false,
      repeatMode: 'off',
      isPlayerOpen: false,
      isQueueOpen: false,

      setAuth: (userInfo, accessToken, folderId, expiresIn = 3600) =>
        set({
          isAuthenticated: true,
          userId: userInfo.id,
          userEmail: userInfo.email,
          userName: userInfo.name,
          userPhoto: userInfo.photo ?? null,
          accessToken,
          tokenExpiresAt: Date.now() + expiresIn * 1000,
          myCloudPlayerFolderId: folderId,
        }),

      updateAccessToken: (token, expiresIn = 3600) =>
        set({
          accessToken: token,
          tokenExpiresAt: Date.now() + expiresIn * 1000,
        }),

      clearAuth: () =>
        set({
          isAuthenticated: false,
          userId: null,
          userEmail: null,
          userName: null,
          userPhoto: null,
          accessToken: null,
          tokenExpiresAt: null,
          myCloudPlayerFolderId: null,
          songs: [],
          playlists: [],
        }),

      setYoutubeApiKey: (key) => set({ youtubeApiKey: key }),
      setTheme: (theme) => set({ theme }),

      setSongs: (songs) => set({ songs }),
      addSong: (song) => set((state) => ({ songs: [song, ...state.songs] })),
      removeSong: (id) =>
        set((state) => ({ songs: state.songs.filter((s) => s.id !== id) })),
      setPlaylists: (playlists) => set({ playlists }),
      addPlaylist: (playlist) =>
        set((state) => ({ playlists: [...state.playlists, playlist] })),
      removePlaylist: (id) =>
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
        })),
      setLoadingLibrary: (loading) => set({ isLoadingLibrary: loading }),
      setLibraryError: (error) => set({ libraryError: error }),

      setCurrentTrack: (track) => set({ currentTrack: track }),
      setPlaybackSession: (queue, index, track) =>
        set({
          playbackQueue: queue,
          playbackIndex: index,
          ...(track !== undefined ? { currentTrack: track } : {}),
        }),
      setPlaying: (playing) => set({ isPlaying: playing }),
      setBuffering: (buffering) => set({ isBuffering: buffering }),
      setProgress: (position, duration) => set({ position, duration }),
      setShuffleEnabled: (enabled) => set({ shuffleEnabled: enabled }),
      setRepeatMode: (mode) => set({ repeatMode: mode }),
      toggleShuffle: () =>
        set((state) => ({ shuffleEnabled: !state.shuffleEnabled })),
      setPlayerOpen: (open) => set({ isPlayerOpen: open }),
      setQueueOpen: (open) => set({ isQueueOpen: open }),
    }),
    {
      name: 'mycloudplayer-web-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        youtubeApiKey: state.youtubeApiKey,
        theme: state.theme,
        shuffleEnabled: state.shuffleEnabled,
        repeatMode: state.repeatMode,
        currentTrack: state.currentTrack,
        playbackQueue: state.playbackQueue,
        playbackIndex: state.playbackIndex,
        isAuthenticated: state.isAuthenticated,
        myCloudPlayerFolderId: state.myCloudPlayerFolderId,
        userId: state.userId,
        userEmail: state.userEmail,
        userName: state.userName,
        userPhoto: state.userPhoto,
        songs: state.songs,
        playlists: state.playlists,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.userEmail && state?.myCloudPlayerFolderId) {
          state.isAuthenticated = true;
        }
      },
    }
  )
);
