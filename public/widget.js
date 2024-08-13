const urlParams = new URLSearchParams(window.location.search)

const DOM = {
    songImg: document.getElementById('img_song'),
    songImgLink: document.getElementById('img_song_link'),
    songInfoStrings: document.getElementById('song_info_strings'),
    title: document.getElementById('song_title'),
    artist: document.getElementById('song_artist'),
    album: document.getElementById('song_album'),
    progress: {
        container: document.getElementById('progressbar_div'),
        timestampsCont: document.getElementById('progressbar_times'),
        current: document.getElementById('progressbar_current_time'),
        fullDuration: document.getElementById('progressbar_full_duration'),
        bar: document.getElementById('progressbar_current_bar')
    },
    pauseIcon: document.getElementById('img_pause_icon')
}

let lastState = {}

const utils = {
    nonZeroHour: (dates) => {
        let result = false
        for (const date of dates) {
            if (date.getHours() != 1) {
                result = true
                break
            }
        }

        return result
    }
}

var socket

function initWidgetConfig(config) {
    // Init widget with specified configuration.
    // At load time, URL parameters are used. Though the widget might be updated
    // later, so it should also work with changing configuration

    // Showing album adds another line to the widget.
    // When showing a two-line tall track name, the progression bar will be hidden because
    // of overflowing. We'll limit track lines number to be only one to prevent this.
    DOM.album.classList[config.showAlbum == "false" ? 'add' : 'remove']('hidden')
    DOM.title.classList[config.showAlbum == "false" ? 'remove' : 'add']('single-line')

    DOM.progress.timestampsCont.classList[config.showProgress == "false" ? 'add' : 'remove']('hidden')
    DOM.progress.bar.classList[config.progressTransition == "false" ? 'add' : 'remove']('no-transition')
}

initWidgetConfig(Object.fromEntries(urlParams.entries()))

function handleProgress(progress, currentState, lastState) {
    try {
        DOM.progress.container.style.display = 'flex'
        if (progress.playing) {
            DOM.pauseIcon.style.opacity = '0'
        } else {
            DOM.pauseIcon.style.opacity = '1'
        }
        
        let currentDate = new Date(progress.current)
        let fullDurationDate = new Date(progress.duration)

        // Timestamps are longer than one hour, we should show the hour duration in the time string
        let sliceDateOffset = 14
        if (utils.nonZeroHour([currentDate, fullDurationDate])) {
            sliceDateOffset = 11
        }

        DOM.progress.current.innerText = currentDate.toISOString().slice(sliceDateOffset, 19)
        DOM.progress.fullDuration.innerText = fullDurationDate.toISOString().slice(sliceDateOffset, 19)

        DOM.progress.bar.style.width = `${progress.current * 100 / progress.duration}%`

        if (lastState && currentState) {
            let modifierClass

            if (lastState.meta?.url != currentState.meta?.url) {
                // Don't show transition on progress bar if this is a new song
                modifierClass = 'no-transition'
            } else {
                // If the song is the same, it has been seeked
                // Show a quicker transition
                modifierClass = 'fast_animation'
            }

            DOM.progress.bar.classList.add(modifierClass)
            DOM.progress.bar.offsetHeight // Trigger a reflow, flushing the CSS changes
            DOM.progress.bar.classList.remove(modifierClass)
        }
    } catch(e) {
        console.error(e)
        DOM.progress.container.style.display = 'none'
        DOM.songImgLink.href = "#"
        DOM.songInfoStrings.href = "#"
    }
}

function handlePlayerEvents(data) {
    const state = data.data

    try {
        DOM.title.innerText = state.title ?? 'No playing info'
        DOM.artist.innerText = state.artist ?? 'No player is currently active'
        DOM.album.innerText = state.album ?? ''

        DOM.songImg.src = state.meta.image
        DOM.songImg.style.display = 'block'

        DOM.songImgLink.href = state.meta.url
        DOM.songInfoStrings.href = state.meta.url

        handleProgress(state.progress, state, lastState)
    } catch(e) { console.error(e) }

    lastState = data.data
}

// Every second increment progress
setInterval(function(){ 
    try {
        if (lastState.progress.playing) {
            lastState.progress.current += 1000

            // If going over song duration, stays at the end instead of incrementing
            if (lastState.progress.current >= lastState.progress.duration) {
                lastState.progress.current = lastState.progress.duration
            }
        }

        handleProgress(lastState.progress)
    } catch(e) {}
}, 1000)

function initializeSocket() {
    socket = new WebSocket(`ws${(window.location.protocol == 'https:') ? 's' : ''}://${window.location.host}${window.location.pathname.replace('widget.html', 'playing')}`)

    socket.onopen = function(event) {
        console.log('[WS] Connected')
    }

    socket.onclose = function(event) {
        console.warn('[WS] Closed', event)
        setTimeout(function () {
            initializeSocket()
        }, 1000)
    }

    socket.onerror = function(event) {
        console.warn('[WS] Error', event)
        socket.close()
        setTimeout(function () {
            initializeSocket()
        }, 1000)
    }

    socket.onmessage = function(event) {
        const msgData = JSON.parse(event.data)

        if (msgData.type == "player") {
            handlePlayerEvents(msgData)
        }
    }
}

initializeSocket()