require('dotenv').config()

var events = require('events')
var path = require('path')

const express = require(`express`)
const expressWs = require(`@wll8/express-ws`)
var WebSocketClient = require('websocket').client;
const { app, wsRoute } = expressWs(express())

const PORT = process.env.SERVER_PORT || 7089

let lastPlayingState = {}

// Connect to spotify WS and create event
const spotifyWs = new WebSocketClient()

spotifyWs.on('connect', function(connection) {
    console.log('[SpotifyWS] Connected')

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            const msgData = JSON.parse(message.utf8Data)

            if (msgData.type == 'updatedSong') {
                try {
                    lastPlayingState = {
                        meta: {
                            source: "spotify",
                            url: `https://open.spotify.com/track/${msgData.id}`,
                            image: msgData.albumArt
                        },
                        progress: msgData.progress,
                        title: msgData.name,
                        artist: msgData.artist,
                        album: msgData.album
                    }
                } catch(e) {}

                spotifyEvent.emit('updatedSong')
            }
        }
    })
})

app.get('/', (req, res) => {
    res.status(200).send('Hello World!')
})

app.get('/playing/img', async (req, res) => {
    res.setHeader('cache-control', 'public, max-age=0, must-revalidate')
    res.setHeader('content-type', 'image/svg+xml; charset=utf-8')
    res.status(200).send(await require('./templates/playing_img')(lastPlayingState, req.query))
})

spotifyWs.connect(`ws://${process.env.SPTWSS_URL}/`)

var spotifyEvent = new events.EventEmitter()

app.ws(`/playing`, (ws, req) => {
    function sendPlayingSong() {
        if (ws.readyState == 3) {
            ws.close()
            return
        }

        ws.send(JSON.stringify({
            success: true,
            type: "player",
            data: lastPlayingState
        }))
    }

    sendPlayingSong()

    /* ws.send(JSON.stringify({
        success: true,
        type: "player",
        data: {
            meta: {
                source: "spotify",
                url: "https://open.spotify.com/track/463KSxKSERdabrLZUA7MxF",
                image: "https://i.scdn.co/image/ab67616d0000b27363b0b35f599f4b1a3cdd82e2"
            },
            progress: {
                playing: true,
                current: 113356,
                duration: 193266
            },
            title: "Feelwitchu",
            artist: "Tennyson",
            album: "Rot"            
        }
    })) */

    spotifyEvent.on('updatedSong', sendPlayingSong)
})

// Every second increment lastPlayingState progress
setInterval(function(){ 
    try {
        lastPlayingState.progress.current += 1000

        // If going over song duration, stays at the end instead of incrementing
        if (lastPlayingState.progress.current >= lastPlayingState.progress.duration) {
            lastPlayingState.progress.current = lastPlayingState.progress.duration
        }
    } catch(e) {}
}, 1000)

app.use(express.static('public'))

app.listen(PORT)
console.log(`[Server] Listening on :${PORT}`)