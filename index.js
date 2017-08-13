const {
  electron,
  ipcRenderer
} = require('electron');

var itunes = require('playback');
var applescript = require('applescript');

// ズームを禁止する
const webFrame = require('electron').webFrame;
webFrame.setZoomLevelLimits(1, 1);

// Tweetした後の成否がメインプロセスから返ってくるのでそいつを確認する
ipcRenderer.on('asynchronous-tweet-ret', function (event, arg) {
  if (arg == 'success') {
    console.log('RendererProcess: ' + 'tweet成功');
    // 成功したらテキストエリア空にする
    document.forms["tweetform"].elements["tweettext"].value = '';

    // 投稿後にウィンドウを非表示にする{
    ipcRenderer.send('hide-after-tweet');


  } else {
    console.log('RendererProcess: tweetミス');
    alert('Tweet失敗');
  }
})

document.onkeydown = keydown;

function keydown() {
  // cmd(もしくはctrl)+enterでツイート
  if (((event.ctrlKey && !event.metaKey) || (!event.ctrlKey && event.metaKey)) && event.keyCode == 13) {
    tweet(document.forms["tweetform"].elements["tweettext"].value);
  }

  // cmd(もしくはctrl)+shift+mでiTunesのなうぷれ取得
  if (((event.ctrlKey && !event.metaKey) || (!event.ctrlKey && event.metaKey)) &&
    event.shiftKey &&
    event.keyCode == 77) {
    getNowplaying();
  }
}

function tweet(str) {
  if (str === '') {
    // なにもしない
    return;
  }
  // メッセージ送信
  console.log('RendererProcess: tweetを BrowserProcess に送信');
  ipcRenderer.send('asynchronous-tweet', str);
}



function getNowplaying() {
  itunes.currentTrack(function (track) {
    if (track) {
      // テキストボックスに挿入
      document.forms["tweetform"].elements["tweettext"].value +=
        track.name + " - " + track.album + ' by ' + track.artist + '#nowplaying';
    } else {
      // iTunesが取れなかったらSpotifyを取ってくる
      var script = `
property spotPause : «constant ****kPSp»
property spotPlay : «constant ****kPSP»
set ret to ""
if application "Spotify" is running then
  tell application "Spotify" to set playerState to player state
  if playerState is spotPlay then
    tell application "Spotify"
      set currentArtist to artist of current track as string
      set currentTrack to name of current track as string
      set currentAlbum to album of current track as string
      set ret to currentTrack & " - " & currentAlbum & " by " & currentArtist & " #nowplaying"
    end tell
  end if
end if
delay 1
return ret
`;
      applescript.execString(script, function (err, result) {
        if (err) {
          // Something went wrong! 
          console.log('RendererProcess: ' + err);
        } else {
          // テキストボックスに挿入
          document.forms["tweetform"].elements["tweettext"].value += result;
        }
      });
    }
  });
}