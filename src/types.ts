export type Platform = 'youtube' | 'twitch';

export type StreamSlot = {
  id: number;
  platform: Platform | null;
  source: string;
  title: string;
  isMuted: boolean;
  isMain: boolean;
};

export type LayoutSettings = {
  columns: number;
};

export type AppState = {
  slots: StreamSlot[];
  maxSlots: number;
  layout: LayoutSettings;
};

