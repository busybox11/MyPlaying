require('dotenv').config()
const fs = require('fs')
const axios = require('axios')

module.exports = function(playingObj, height=250, width=600) {
    return new Promise(async (resolve, reject) =>  {
        fs.readFile('./templates/playing_img.svg', 'utf-8', async function (err, fileContent) {
            if (err) {
                console.log(err)
                return
            }
          
            var replaced = fileContent
           
            replaced = replaced.replaceAll('{IMAGE_HEIGHT}', height)
            replaced = replaced.replaceAll('{IMAGE_WIDTH}', width)
            replaced = replaced.replaceAll('{TRACK_NAME}', playingObj.title)
            replaced = replaced.replaceAll('{TRACK_ARTIST}', playingObj.artist)

            replaced = replaced.replaceAll('{TRACK_URL}', playingObj.meta.url)
            replaced = replaced.replaceAll('{SPOTIFY_PROFILE_URL}', process.env.SPOTIFY_PROFILE_URL || 'https://open.spotify.com/')

            replaced = replaced.replaceAll('{PLAYING_TEXT}', (playingObj.progress.playing) ? 'Now playing on Spotify' : 'Last played song')
            
            const coverImage = await axios.get(playingObj.meta.image, {responseType: 'arraybuffer'})
            const rawCoverImage = Buffer.from(coverImage.data).toString('base64')
            const base64CoverImage = "data:" + coverImage.headers["content-type"] + ";base64," + rawCoverImage
            replaced = replaced.replaceAll('{COVER_URL}', base64CoverImage)

            var playingIcon = ""
            if (playingObj.progress.playing) {
                const playingIconImage = await axios.get("https://open.spotifycdn.com/cdn/images/equaliser-animated-green.f93a2ef4.gif", {responseType: 'arraybuffer'})
                const rawPlayingIconImage = Buffer.from(playingIconImage.data).toString('base64')
                playingIcon = `<img src="${"data:" + playingIconImage.headers["content-type"] + ";base64," + rawPlayingIconImage}" height="16" />`
            }
            replaced = replaced.replaceAll('{PLAYING_ICON}', playingIcon)

            resolve(replaced)
        })
    })
}