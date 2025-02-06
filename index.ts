import "dotenv/config";

import express, { type Request, type Response } from "express";
import expressWs from "@wll8/express-ws";

import { SpotifyService } from "./providers/sptwss.ts";

import playingImgTemplate from "./templates/playing_img";

const { app } = expressWs(express());

const PORT = process.env.SERVER_PORT || 7089;

// Initialize SpotifyService
const spotifyService = new SpotifyService(process.env.SPTWSS_URL!);
const spotifyEvent = spotifyService.getSpotifyEvent();

let lastPlayingState = spotifyService.getLastPlayingState();

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.status(200).send("Hello World!");
});

app.get("/playing/img", async (req, res) => {
  res.setHeader("cache-control", "public, max-age=0, must-revalidate");
  res.setHeader("content-type", "image/svg+xml; charset=utf-8");
  res
    .status(200)
    .send(
      await playingImgTemplate(lastPlayingState, req.query)
    );
});

function widgetHandler(_req: Request, res: Response) {
  res.setHeader("cache-control", "public, max-age=0, must-revalidate");
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.status(200).render("widget", {
    lastPlayingState: lastPlayingState,
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

  const newArtist = replaceCharacters(lastPlayingState.artist);
  const newTitle = replaceCharacters(lastPlayingState.title);

  // Use badge from img.shields.io
  const badgeURL = `https://img.shields.io/badge/${encodeURIComponent(
    newArtist + " - " + newTitle
  )}-1ed760?&style=for-the-badge&logo=spotify&logoColor=white`;

  // Download badge from URL and send it
  const badge = await fetch(badgeURL).then((res) => res.arrayBuffer());
  res.status(200).send(badge);
});

app.ws(`/playing`, (ws, req) => {
  function sendPlayingSong() {
    if (ws.readyState == 3) {
      ws.close();
      return;
    }

    ws.send(
      JSON.stringify({
        success: true,
        type: "player",
        data: lastPlayingState,
      })
    );
  }

  sendPlayingSong();

  const updatePlayingSong = () => {
    sendPlayingSong();
  };

  spotifyEvent.on("updatedSong", updatePlayingSong);
  ws.on("close", () => {
    spotifyEvent.off("updatedSong", updatePlayingSong);
  });
});

spotifyEvent.on("updatedSong", () => {
  lastPlayingState = spotifyService.getLastPlayingState();
});

app.get("/playing", async (req, res) => {
  res.setHeader("cache-control", "public, max-age=0, must-revalidate");
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.status(200).send(
    JSON.stringify({
      success: true,
      data: lastPlayingState,
    })
  );
});

// Every second increment lastPlayingState progress
setInterval(function () {
  try {
    if (lastPlayingState.progress?.playing) {
      if (lastPlayingState.progress.current)
        lastPlayingState.progress.current += 1000;

      // If going over song duration, stays at the end instead of incrementing
      if (
        lastPlayingState.progress.current &&
        lastPlayingState.progress.duration &&
        lastPlayingState.progress.current >= lastPlayingState.progress.duration
      ) {
        lastPlayingState.progress.current = lastPlayingState.progress.duration;
      }
    }
  } catch (e) {}
}, 1000);

spotifyService.connect();

app.listen(PORT);
console.log(`[Server] Listening on :${PORT}`);
