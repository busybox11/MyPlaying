const urlParams = new URLSearchParams(window.location.search);

const DOM = {
  songBgImg: document.getElementById("img_song_bg"),
  songImgContainer: document.getElementById("img_container"),
  songImg: document.getElementById("img_song"),
  songImgLink: document.getElementById("img_song_link"),
  songInfoStrings: document.getElementById("song_info_strings"),
  previewPlayBtn: document.getElementById("preview_play_btn"),
  previewPlayBtnMuteIcon: document.getElementById("preview_play_btn_muteicon"),
  previewPlayBtnSoundIcon: document.getElementById(
    "preview_play_btn_soundicon"
  ),
  title: document.getElementById("song_title"),
  artist: document.getElementById("song_artist"),
  album: document.getElementById("song_album"),
  progress: {
    container: document.getElementById("progressbar_div"),
    timestampsCont: document.getElementById("progressbar_times"),
    current: document.getElementById("progressbar_current_time"),
    fullDuration: document.getElementById("progressbar_full_duration"),
    bar: document.getElementById("progressbar_current_bar"),
  },
  nowPlayingState: {
    container: document.getElementById("nowplaying_state_div"),
    provider: document.getElementById("nowplaying_provider"),
  },
  pauseIcon: document.getElementById("img_pause_icon"),
};

let lastState = {};

const utils = {
  nonZeroHour: (dates) => {
    let result = false;
    for (const date of dates) {
      if (date.getHours() != 1) {
        result = true;
        break;
      }
    }

    return result;
  },
};

var socket;

function initWidgetConfig(config) {
  // Init widget with specified configuration.
  // At load time, URL parameters are used. Though the widget might be updated
  // later, so it should also work with changing configuration

  // Showing album adds another line to the widget.
  // When showing a two-line tall track name, the progression bar will be hidden because
  // of overflowing. We'll limit track lines number to be only one to prevent this.
  DOM.album.classList[config.showAlbum == "false" ? "add" : "remove"]("hidden");
  DOM.title.classList[config.showAlbum == "false" ? "remove" : "add"](
    "single-line"
  );

  DOM.progress.timestampsCont.classList[
    config.showProgress == "false" ? "add" : "remove"
  ]("hidden");
  DOM.progress.bar.classList[
    config.progressTransition == "false" ? "add" : "remove"
  ]("no-transition");
}

initWidgetConfig(Object.fromEntries(urlParams.entries()));

let previewAudio = new Audio();

function handlePreviewState() {
  const isPreviewPlaying = !previewAudio.paused;

  const icon = isPreviewPlaying
    ? DOM.previewPlayBtnSoundIcon
    : DOM.previewPlayBtnMuteIcon;
  const otherIcon = isPreviewPlaying
    ? DOM.previewPlayBtnMuteIcon
    : DOM.previewPlayBtnSoundIcon;

  icon.style.display = "block";
  otherIcon.style.display = "none";

  DOM.previewPlayBtn.classList.toggle("playing", isPreviewPlaying);
}

previewAudio.addEventListener("play", function () {
  handlePreviewState();
});

previewAudio.addEventListener("pause", function () {
  handlePreviewState();
});

previewAudio.addEventListener("ended", function () {
  handlePreviewState();
});

DOM.previewPlayBtn.addEventListener("click", function () {
  if (previewAudio.paused) {
    previewAudio.src = lastState.meta.preview;
    previewAudio.play();
  } else {
    previewAudio.pause();
    previewAudio.currentTime = 0;
  }
});

function handleProgress(progress, currentState, lastState) {
  try {
    if (progress === null || progress?.playing) {
      DOM.pauseIcon.style.opacity = "0";
    } else {
      DOM.pauseIcon.style.opacity = "1";
    }

    if (progress?.current) {
      DOM.progress.container.style.display = "flex";
      DOM.nowPlayingState.container.style.display = "none";

      let currentDate = new Date(progress.current);
      let fullDurationDate = new Date(progress.duration);

      // Timestamps are longer than one hour, we should show the hour duration in the time string
      let sliceDateOffset = 14;
      if (utils.nonZeroHour([currentDate, fullDurationDate])) {
        sliceDateOffset = 11;
      }

      DOM.progress.current.innerText = currentDate
        .toISOString()
        .slice(sliceDateOffset, 19);
      DOM.progress.fullDuration.innerText = fullDurationDate
        .toISOString()
        .slice(sliceDateOffset, 19);

      DOM.progress.bar.style.width = `${
        (progress.current * 100) / progress.duration
      }%`;
    } else {
      DOM.progress.container.style.display = "none";

      if (progress?.playing) {
        DOM.nowPlayingState.container.style.display = "flex";
      } else {
        DOM.nowPlayingState.container.style.display = "none";
      }
    }

    if (lastState && currentState) {
      let modifierClass;

      if (lastState.meta?.url != currentState.meta?.url) {
        // Don't show transition on progress bar if this is a new song
        modifierClass = "no-transition";
      } else {
        // If the song is the same, it has been seeked
        // Show a quicker transition
        modifierClass = "fast_animation";
      }

      DOM.progress.bar.classList.add(modifierClass);
      DOM.progress.bar.offsetHeight; // Trigger a reflow, flushing the CSS changes
      DOM.progress.bar.classList.remove(modifierClass);
    }
  } catch (e) {
    console.error(e);
    DOM.progress.container.style.display = "none";
    DOM.songImgLink.href = "#";
    DOM.songInfoStrings.href = "#";
  }
}

function setPlayerDOMState(state, targetLastState) {
  DOM.title.innerText = state.title ?? "No playing info";
  DOM.artist.innerText = state.artist ?? "No player is currently active";
  DOM.album.innerText = state.album ?? "";

  DOM.songImgLink.href = state.meta.url;
  DOM.songInfoStrings.href = state.meta.url;

  DOM.nowPlayingState.provider.innerText = state.meta?.source;

  // add provider class to body
  const makeProviderClass = (provider) => {
    // replace every non alphanumeric character with a dash
    const sanitizedProvider = provider
      ?.toLowerCase()
      ?.replace(/[^a-z0-9]/g, "-");
    return `provider-${sanitizedProvider}`;
  };
  const providerClass = makeProviderClass(state.meta?.source);
  const lastProviderClass = makeProviderClass(lastState.meta?.source);
  if (
    (lastProviderClass && lastProviderClass !== providerClass) ||
    !lastProviderClass
  ) {
    if (lastProviderClass) {
      document.body.classList.remove(lastProviderClass);
    }
    document.body.classList.add(providerClass);
  }

  if (Boolean(state.meta.preview)) {
    DOM.previewPlayBtn.classList.add("can_preview");
  } else {
    DOM.previewPlayBtn.classList.remove("can_preview");
  }

  handleProgress(state.progress, state, targetLastState);
}

let hasCompletedImage = true;
function handlePlayerEvents(data) {
  const state = data.data;
  const targetLastState = Object.assign({}, lastState);

  try {
    // If song preview changed
    if (state.meta.preview != lastState?.meta?.preview) {
      // Stop preview audio if it's playing
      if (previewAudio && !previewAudio.paused) {
        previewAudio.pause();
        previewAudio.currentTime = 0;
      }
    }

    // If image changed
    if (state.meta.image != lastState?.meta?.image) {
      console.log("Image changed");

      if (!state.meta.image) {
        DOM.songImg.style.display = "none";

        setPlayerDOMState(state, targetLastState);
      } else {
        DOM.songImg.style.display = "block";

        setTimeout(function () {
          if (hasCompletedImage) return;

          setPlayerDOMState(state, targetLastState);
          DOM.songImg.style.display = "none";
        }, 700);

        const newImg = new Image();
        hasCompletedImage = false;
        newImg.src = state.meta.image;

        newImg.onload = function () {
          hasCompletedImage = true;
          setPlayerDOMState(state, targetLastState);

          newImg.id = "img_song";

          DOM.songImgLink.replaceChildren(newImg);
          DOM.songImg = newImg;
          DOM.songBgImg.style.backgroundImage = `url(${state.meta.image})`;
        };

        // Will naturally resolve to the other case on the next tick
        // in case the image doesn't load before it
      }
    } else {
      if (!hasCompletedImage) return;

      setPlayerDOMState(state, targetLastState);
    }
  } catch (e) {
    console.error(e);
  }

  lastState = data.data;
}

// Every second increment progress
setInterval(function () {
  try {
    if (lastState.progress.playing) {
      lastState.progress.current += 1000;

      // If going over song duration, stays at the end instead of incrementing
      if (lastState.progress.current >= lastState.progress.duration) {
        lastState.progress.current = lastState.progress.duration;
      }
    }

    handleProgress(lastState.progress);
  } catch (e) {}
}, 1000);

function initializeSocket() {
  socket = new WebSocket(
    `ws${window.location.protocol == "https:" ? "s" : ""}://${
      window.location.host
    }${window.location.pathname
      .replace(".html", "")
      .replace("widget", "playing")}`
  );

  socket.onopen = function (event) {
    console.log("[WS] Connected");
  };

  socket.onclose = function (event) {
    console.warn("[WS] Closed", event);
    setTimeout(function () {
      initializeSocket();
    }, 1000);
  };

  socket.onerror = function (event) {
    console.warn("[WS] Error", event);
    socket.close();
    setTimeout(function () {
      initializeSocket();
    }, 1000);
  };

  socket.onmessage = function (event) {
    const msgData = JSON.parse(event.data);

    if (msgData.type == "player") {
      handlePlayerEvents(msgData);
    }
  };
}

initializeSocket();
