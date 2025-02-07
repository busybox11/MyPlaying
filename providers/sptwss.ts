import { EventEmitter } from "events";

type LastPlayingState =
  import("../types/playingState").LastPlayingState<"Spotify">;

type SpotifyMessageData = {
  type: string;
  song: string;
  artist: string;
  name: string;
  album: string;
  albumArt: string;
  id: string;
  preview: string | null;
  progress: {
    playing: boolean;
    current: number | null;
    duration: number;
  };
};

export class SpotifyService {
  private spotifyWs!: WebSocket;
  private spotifyEvent: EventEmitter;
  private lastPlayingState: LastPlayingState | null = null;
  private isIdle: boolean = false;
  private sptwssUrl: string;

  public lastTickUpdate: number;

  constructor(sptwssUrl: string) {
    this.sptwssUrl = sptwssUrl;
    this.spotifyEvent = new EventEmitter();
    this.lastTickUpdate = Date.now();

    setInterval(() => {
      this.tick();
    }, 1000);
  }

  public connect(): void {
    this.initSpotifyWs();
  }

  private initSpotifyWs(): void {
    this.spotifyWs = new WebSocket(`ws://${this.sptwssUrl}/`);

    this.spotifyWs.addEventListener("message", this.onMessage.bind(this));
    this.spotifyWs.addEventListener("open", this.onConnect.bind(this));
    this.spotifyWs.addEventListener("error", (event) => {
      console.error("[SpotifyWS] Error:", event);

      this.spotifyWs.close();
      this.initSpotifyWs();
    });
  }

  private tick() {
    try {
      if (this.lastPlayingState && this.lastPlayingState.progress?.playing) {
        if (this.lastPlayingState.progress.current) {
          this.lastPlayingState.progress.current += 1000;

          const now = Date.now();

          // If last tick was over 30 seconds ago, send resume event
          if (now - this.lastTickUpdate > 1000 * 30) {
            // console.log("[SpotifyWS] Resume");
            this.spotifyEvent.emit("resume");
            this.isIdle = false;
          }
          this.lastTickUpdate = now;
        }

        // If going over song duration, stays at the end instead of incrementing
        if (
          this.lastPlayingState.progress.current &&
          this.lastPlayingState.progress.duration &&
          this.lastPlayingState.progress.current >=
            this.lastPlayingState.progress.duration
        ) {
          this.lastPlayingState.progress.current =
            this.lastPlayingState.progress.duration;
        }
      }

      // If last update was more than 30 seconds ago, send idle event
      if (Date.now() - this.lastTickUpdate > 1000 * 30 && !this.isIdle) {
        // console.log("[SpotifyWS] Idle");
        this.spotifyEvent.emit("idle");
        this.isIdle = true;
      }
    } catch (e) {}
  }

  private onConnect(connection: any): void {
    console.log("[SpotifyWS] Connected");

    this.lastTickUpdate = Date.now();
  }

  private onMessage(event: MessageEvent): void {
    const message = event.data as string;

    if (typeof message === "string") {
      const msgData: SpotifyMessageData = JSON.parse(message);

      if (msgData.type === "updatedSong") {
        try {
          this.lastPlayingState = {
            meta: {
              source: "Spotify",
              url: `https://open.spotify.com/track/${msgData.id}`,
              image: msgData.albumArt,
              preview: msgData.preview || undefined,
            },
            progress: msgData.progress,
            title: msgData.name,
            artist: msgData.artist,
            album: msgData.album,
          };
        } catch (e) {
          console.error("[SpotifyService] Error parsing message:", e);
        }

        this.spotifyEvent.emit("updatedSong");
      }
    }
  }

  public getLastPlayingState(): LastPlayingState | null {
    return this.lastPlayingState;
  }

  public getSpotifyEvent(): EventEmitter {
    return this.spotifyEvent;
  }
}
