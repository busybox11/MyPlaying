import "dotenv/config";

import { EventEmitter } from "events";

import { LastClient } from "@musicorum/lastfm";

const LASTFM_API_KEY = process.env.LASTFM_API_KEY!;

type LastPlayingState =
  import("../types/playingState").LastPlayingState<"Last.fm">;

export class LastFmService {
  private client: LastClient;
  private lastFmEvent: EventEmitter;
  private lastPlayingState: LastPlayingState | null = null;
  private refreshLoop!: Timer;
  private sendUpdates: boolean = false;

  public userId: string;
  public lastTickUpdate: number = 0;

  constructor(userId: string) {
    this.userId = userId;

    this.lastFmEvent = new EventEmitter();
    this.client = new LastClient(LASTFM_API_KEY);

    this.refreshLoop = setInterval(() => {
      this.refreshLastPlayingState();
    }, 1000 * 8); // Refresh every 30 seconds
    this.refreshLastPlayingState();
  }

  private async refreshLastPlayingState() {
    this.lastPlayingState = await this.requestLastPlayedTrack();
  }

  public startRefreshLoop() {
    this.sendUpdates = true;

    this.refreshLastPlayingState();
  }

  public stopRefreshLoop() {
    this.sendUpdates = false;
  }

  public async requestLastPlayedTrack() {
    const trackRes = await this.client.user.getRecentTracks(this.userId, {
      limit: 1,
    });

    const track = trackRes.tracks[0];

    const trackImage = track.images?.length
      ? track.images[track.images.length - 1].url
      : undefined;
    const progress = track.nowPlaying
      ? {
          playing: true,
        }
      : null;

    const lastTrack = {
      meta: {
        source: "Last.fm",
        url: track.url,
        image: trackImage,
      },
      progress,
      title: track.name,
      artist: track.artist?.name || "Unknown artist",
      album: track.album?.name,
    } satisfies LastPlayingState;

    this.lastPlayingState = lastTrack;

    if (this.sendUpdates) this.lastFmEvent.emit("updatedSong");

    const lastLoggedTrack = trackRes.tracks[1] || trackRes.tracks[0];
    this.lastTickUpdate = lastLoggedTrack.date?.getTime() || 0;

    return lastTrack;
  }

  public getLastPlayingState(): LastPlayingState | null {
    return this.lastPlayingState;
  }

  public getLastFmEvent(): EventEmitter {
    return this.lastFmEvent;
  }
}
