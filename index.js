const {
  electron,
  ipcRenderer
} = require('electron');

var itunes = require('playback');

// ズームを禁止する
const webFrame = require('electron').webFrame;
webFrame.setZoomLevelLimits(1, 1);

// Tweetした後の成否がメインプロセスから返ってくるのでそいつを確認する
ipcRenderer.on('asynchronous-tweet-ret', function (event, arg) {
  console.log(arg);
  if (arg == 'success') {
    // 成功したらテキストエリア空にする
    document.forms["tweetform"].elements["tweettext"].value = '';

    // 投稿後にウィンドウを非表示にする
    // TODO:ウィンドウを非表示にするか設定できるようにしたい
    ipcRenderer.send('hide-after-tweet');

  } else {
    console.log('tweetミス');
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

    itunes.currentTrack(function (track) {
      document.forms["tweetform"].elements["tweettext"].value += '♪ ' + track.name + ' - ' + track.artist;
    });
  }

}

function tweet(str) {
  if (str === '') {
    // なにもしない
    return;
  }
  // メッセージ送信
  ipcRenderer.send('asynchronous-tweet', str);
}