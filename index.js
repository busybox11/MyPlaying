require('dotenv').config()

const express = require(`express`)
const expressWs = require(`@wll8/express-ws`)
const { app, wsRoute } = expressWs(express())

app.ws(`/playing`, (ws, req) => {
    ws.send(JSON.stringify({
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
    }))
})

app.use(express.static('public'))

app.listen(process.env.SERVER_PORT)
