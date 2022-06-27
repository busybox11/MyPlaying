const DOM = {
    songImg: document.getElementById('img_song'),
    title: document.getElementById('song_title'),
    artist: document.getElementById('song_artist'),
    progress: {
        current: document.getElementById('progressbar_current_time'),
        fullDuration: document.getElementById('progressbar_full_duration'),
        bar: document.getElementById('progressbar_current_bar')
    },
    pauseIcon: document.getElementById('img_pause_icon')
}

const utils = {
    nonZeroHour: (dates) => {
        let result = false
        for (date of dates) {
            if (date.getHours() != 1) {
                result = true
                break
            }
        }

        return result
    }
}

let socket = new WebSocket(`ws://${window.location.host}/playing`)

function handleProgress(progress) {
    try {
        if (progress.playing) {
            DOM.pauseIcon.style.display = 'none'
        } else {
            DOM.pauseIcon.style.display = 'block'
        }

        let currentDate = new Date(progress.current)
        let fullDurationDate = new Date(progress.duration)

        // Timetamps are longer than one hour, we should show the hour duration in the time string
        let sliceDateOffset = 14
        if (utils.nonZeroHour([currentDate, fullDurationDate])) {
            sliceDateOffset = 11
        }

        DOM.progress.current.innerText = currentDate.toISOString().slice(sliceDateOffset, 19)
        DOM.progress.fullDuration.innerText = fullDurationDate.toISOString().slice(sliceDateOffset, 19)

        DOM.progress.bar.style.width = `${progress.current * 100 / progress.duration}%`
    } catch(e) { console.error(e) }
}

function handlePlayerEvents(data) {
    const song = data.data

    try {
        DOM.title.innerText = song.title
        DOM.artist.innerText = song.artist

        DOM.songImg.src = song.meta.image
        DOM.songImg.style.display = 'block'

        handleProgress(song.progress)
    } catch(e) { console.error(e) }
}

socket.onopen = function(event) {
    console.log('[WS] Connected')
}

socket.onmessage = function(event) {
    const msgData = JSON.parse(event.data)

    if (msgData.type == "player") {
        handlePlayerEvents(msgData)
    }
}