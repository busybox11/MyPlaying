import express, { type Request, type Response } from "express";
import expressWs from "@wll8/express-ws";

import { SpotifyService } from "./providers/sptwss.ts";
import { LastFmService } from "./providers/lastfm.ts";

import playingImgTemplate from "./templates/playing_img";

import type { LastPlayingState } from "./types/playingState.ts";
import EventEmitter from "events";

const { app } = expressWs(express());

const PORT = process.env.SERVER_PORT || 7089;

const BASE_LAST_PLAYING_STATE = {
  meta: {
    source: undefined,
    url: undefined,
    image: undefined,
    preview: undefined,
  },
  progress: {
    playing: false,
    current: undefined,
    duration: undefined,
  },
  title: "No song playing",
  artist: "",
  album: undefined,
} satisfies LastPlayingState;

const globalEvents = new EventEmitter();
let lastFmPriority = false;

// Initialize SpotifyService
const spotifyService = new SpotifyService(process.env.SPTWSS_URL!);
const spotifyEvent = spotifyService.getProviderEvent();

// Initialize LastFmService
const lastFmService = new LastFmService(process.env.LASTFM_USER!);
const lastFmEvent = lastFmService.getProviderEvent();

const lastPlayingState = (): LastPlayingState => {
  const lastFmLastUpdate = lastFmService.lastTickUpdate;
  const spotifyLastUpdate = spotifyService.lastTickUpdate;

  const spotifyLastState = spotifyService.getLastPlayingState();
  const lastFmLastState = lastFmService.getLastPlayingState();

  if (
    lastFmPriority &&
    (lastFmLastUpdate > spotifyLastUpdate ||
      (!spotifyLastState?.progress?.playing &&
        lastFmLastState?.progress?.playing))
  ) {
    return lastFmLastState || BASE_LAST_PLAYING_STATE;
  }

  return spotifyLastState || BASE_LAST_PLAYING_STATE;
};

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.status(200).send("Hello World!");
});

app.get("/playing/img", async (req, res) => {
  res.setHeader("cache-control", "public, max-age=0, must-revalidate");
  res.setHeader("content-type", "image/svg+xml; charset=utf-8");

  res.status(200).send(await playingImgTemplate(lastPlayingState(), req.query));
});

function widgetHandler(_req: Request, res: Response) {
  res.setHeader("cache-control", "public, max-age=0, must-revalidate");
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.status(200).render("widget", {
    lastPlayingState: lastPlayingState(),
    analyticsScript: process.env.ANALYTICS_SCRIPT || "",
  });
}

app.get("/widget", widgetHandler);
app.get("/widget.html", widgetHandler);

app.get("/playing/badge", async (_req, res) => {
  res.setHeader("cache-control", "public, max-age=0, must-revalidate");
  res.setHeader("content-type", "image/svg+xml; charset=utf-8");

  const replaceCharacters = (str: string) => {
    const replacements = {
      " ": "_",
      "-": "--",
      _: "__",
    } as const;

    return str.replace(/[-_ ]/g, (character: string) => {
      return replacements[character as keyof typeof replacements] || character;
    });
  };

  const newArtist = replaceCharacters(lastPlayingState().artist);
  const newTitle = replaceCharacters(lastPlayingState().title);

  // Use badge from img.shields.io
  const badgeURL = `https://img.shields.io/badge/${encodeURIComponent(
    newArtist + " - " + newTitle
  )}-1ed760?&style=for-the-badge&logo=spotify&logoColor=white`;

  // Download badge from URL and send it
  const badge = await fetch(badgeURL).then((res) => res.arrayBuffer());
  res.status(200).send(badge);
});

app.ws(`/playing`, (ws, req) => {
  function sendMessage(type: "player" | "nextTrack", data: any) {
    if (ws.readyState == 3) {
      ws.close();
      return;
    }

    ws.send(
      JSON.stringify({
        success: true,
        type,
        data,
      })
    );
  }

  function sendPlayingSong() {
    sendMessage("player", lastPlayingState());
  }

  sendPlayingSong();

  const updatePlayingSong = () => {
    sendPlayingSong();
  };

  globalEvents.on("updatedSong", updatePlayingSong);
  ws.on("close", () => {
    globalEvents.off("updatedSong", updatePlayingSong);
  });
});

spotifyEvent.on("idle", () => {
  lastFmPriority = true;
  lastFmService.startRefreshLoop();
});
spotifyEvent.on("resume", () => {
  lastFmPriority = false;
  lastFmService.stopRefreshLoop();
});
spotifyEvent.on("updatedSong", () => {
  lastFmPriority = false;
  lastFmService.stopRefreshLoop();

  globalEvents.emit("updatedSong");
});

lastFmEvent.on("updatedSong", () => {
  globalEvents.emit("updatedSong");
});

app.get("/playing", async (req, res) => {
  res.setHeader("cache-control", "public, max-age=0, must-revalidate");
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.status(200).send(
    JSON.stringify({
      success: true,
      data: lastPlayingState(),
    })
  );
});

spotifyService.connect();

app.listen(PORT);
console.log(`[Server] Listening on :${PORT}`);
