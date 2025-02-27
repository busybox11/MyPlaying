import { EventEmitter } from "events";
import type { BaseTrack, LastPlayingState } from "../types/playingState";

export interface BaseProvider {
  /**
   * Establishes connection to the music service
   */
  connect(): void;

  /**
   * Returns the current or last known playing state
   */
  getLastPlayingState(): LastPlayingState | null;

  /**
   * Returns the event emitter instance for subscribing to provider events
   * Events that must be supported:
   * - updatedSong: Emitted when the current song changes
   * - idle: Emitted when no activity is detected for a while
   * - resume: Emitted when activity resumes after being idle
   */
  getProviderEvent(): EventEmitter;
}
