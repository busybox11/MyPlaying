export type LastPlayingState<T = string> = {
  meta: {
    source: T;
    url?: string;
    image?: string;
    preview?: string;
  };
  progress?: {
    playing: boolean;
    current?: number | null;
    duration?: number;
  };
  title: string;
  artist: string;
  album?: string;
};
