require('dotenv').config()
const fs = require('fs')

module.exports = function(playingObj, height=250, width=600) {
    return new Promise((resolve, reject) =>  {
        fs.readFile('./templates/playing_img.svg', 'utf-8', function (err, fileContent) {
            if (err) {
                console.log(err)
                return
            }
          
            var replaced = fileContent
           
            replaced = replaced.replaceAll('{IMAGE_HEIGHT}', height)
            replaced = replaced.replaceAll('{IMAGE_WIDTH}', width)
            replaced = replaced.replaceAll('{TRACK_NAME}', playingObj.title)
            replaced = replaced.replaceAll('{TRACK_ARTIST}', playingObj.artist)
            replaced = replaced.replaceAll('{COVER_URL}', playingObj.meta.image)
            replaced = replaced.replaceAll('{TRACK_URL}', playingObj.meta.url)
            replaced = replaced.replaceAll('{SPOTIFY_PROFILE_URL}', process.env.SPOTIFY_PROFILE_URL || 'https://open.spotify.com/')

            replaced = replaced.replaceAll('{PLAYING_ICON}', (playingObj.progress.playing) ? '<img src="https://open.spotifycdn.com/cdn/images/equaliser-animated-green.f93a2ef4.gif" height="16" />' : '')
            replaced = replaced.replaceAll('{PLAYING_TEXT}', (playingObj.progress.playing) ? 'Now playing on Spotify' : 'Last played song')

            resolve(replaced)
        })
    })
}