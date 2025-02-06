import { EventEmitter } from "events";

type LastPlayingState =
  import("../types/playingState").LastPlayingState<"spotify">;

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
  private spotifyWs: WebSocket;
  private spotifyEvent: EventEmitter;
  private lastPlayingState: LastPlayingState = {} as LastPlayingState;
  private sptwssUrl: string;

  constructor(sptwssUrl: string) {
    this.sptwssUrl = sptwssUrl;
    this.spotifyEvent = new EventEmitter();
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

  private onConnect(connection: any): void {
    console.log("[SpotifyWS] Connected");
  }

  private onMessage(event: MessageEvent): void {
    const message = event.data as string;

    if (typeof message === "string") {
      const msgData: SpotifyMessageData = JSON.parse(message);

      if (msgData.type === "updatedSong") {
        try {
          this.lastPlayingState = {
            meta: {
              source: "spotify",
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

  public getLastPlayingState(): LastPlayingState {
    return this.lastPlayingState;
  }

  public getSpotifyEvent(): EventEmitter {
    return this.spotifyEvent;
  }
}
