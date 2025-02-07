import "dotenv/config";
import type { LastPlayingState } from "../types/playingState";

interface QueryParams {
  hideGithubLogo?: boolean;
  height?: number;
  width?: number;
}

export default async function (
  playingObj: LastPlayingState,
  query?: QueryParams
) {
  const height = query?.height || 250;
  const width = query?.width || 600;

  const templateImgPath = "./templates/playing_img.svg";
  const templateImgFile = Bun.file(templateImgPath);

  const templateImg = await templateImgFile.text();

  let addInCSS = "";
  let replaced: string = templateImg;

  replaced = replaced.replaceAll("{IMAGE_HEIGHT}", String(height));
  replaced = replaced.replaceAll("{IMAGE_WIDTH}", String(width));
  replaced = replaced.replaceAll("{TRACK_NAME}", playingObj.title);
  replaced = replaced.replaceAll("{TRACK_ARTIST}", playingObj.artist);
  replaced = replaced.replaceAll("{TRACK_URL}", playingObj.meta.url || "");
  replaced = replaced.replaceAll(
    "{SPOTIFY_PROFILE_URL}",
    process.env.SPOTIFY_PROFILE_URL || "https://open.spotify.com/"
  );
  replaced = replaced.replaceAll(
    "{LASTFM_PROFILE_URL}",
    `https://www.last.fm/user/${process.env.LASTFM_USER}/`
  );
  replaced = replaced.replaceAll(
    "{PLAYING_TEXT}",
    playingObj.progress?.playing
      ? `Now playing on ${playingObj.meta.source}`
      : "Last played song"
  );

  // browsers dont directly render '&' as a single character, using '&amp;' instead does
  // for when the track title or artist name consists of one
  replaced = replaced.replaceAll("&", "&amp;");

  // Fetch and replace cover image
  function errorCoverImage() {
    replaced = replaced.replaceAll("{COVER_URL}", ""); // set to empty string to avoid broken image
    addInCSS += `
      #cover_img {
        display: none;
      }
    `;
  }

  try {
    if (playingObj.meta.image) {
      const coverImage = await fetch(playingObj.meta.image);
      const rawCoverImage = Buffer.from(
        await coverImage.arrayBuffer()
      ).toString("base64");

      const base64CoverImage =
        "data:" +
        coverImage.headers.get("content-type") +
        ";base64," +
        rawCoverImage;

      replaced = replaced.replaceAll("{COVER_URL}", base64CoverImage);
    } else {
      errorCoverImage();
    }
  } catch (e) {
    console.error("Error fetching cover image", e);
    errorCoverImage();
  }

  // Set playing icon
  let playingIcon = "";
  if (playingObj.progress?.playing) {
    try {
      const playingGifImgPath = "./public/equaliser-animated-green.gif";
      const playingGifImgFile = Bun.file(playingGifImgPath);

      const playingGifImg = await playingGifImgFile.arrayBuffer();
      const base64PlayingGifImg = Buffer.from(playingGifImg).toString("base64");

      playingIcon = `<img src="${
        "data:image/gif;base64," + base64PlayingGifImg
      }" height="16" />`;
    } catch (e) {
      console.error("Error fetching playing icon", e);
      playingIcon = ""; // set to empty string to avoid broken image
    }
  }
  replaced = replaced.replaceAll("{PLAYING_ICON}", playingIcon);

  // Hide GitHub logo
  if (query?.hideGithubLogo) {
    addInCSS += `
      #github_logo_link {
        display: none;
      }
    `;
  }

  const providers = {
    "Last.fm": "lastfm",
    Spotify: "spotify",
  };
  const currentProvider = playingObj.meta.source;
  for (const [providerName, providerId] of Object.entries(providers)) {
    if (providerName !== currentProvider) {
      addInCSS += `
        #${providerId}_logo_link {
          display: none;
        }
      `;
    }
  }

  replaced = replaced.replaceAll("{ADD_IN_CSS}", addInCSS);

  return replaced;
}
