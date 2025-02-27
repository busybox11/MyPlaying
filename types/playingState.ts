export type BaseTrack<T = string> = {
  title: string;
  artist: string;
  album?: string;
  meta: {
    source?: T;
    url?: string;
    image?: string;
    preview?: string;
  };
};

export type LastPlayingState<T = string> = BaseTrack<T> & {
  progress?: {
    playing: boolean;
    current?: number | null;
    duration?: number;
  } | null;
};
