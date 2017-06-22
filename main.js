const {
  app,
  BrowserWindow,
  globalShortcut,
  dialog,
  webFrame,
  Menu,
  ipcMain,
  Tray
} = require('electron');

// 二重起動防止
var shouldQuit = app.makeSingleInstance((argv, workingDirectory) => {})
if (shouldQuit) app.quit()

const Config = require('electron-config');
const config = new Config({
  defaults: {
    bounds: {
      width: 800,
      height: 600,
    },
  },
})

const twitterAPI = require('node-twitter-api');
const twitter = new twitterAPI({
  consumerKey: 'PUT YOUR CONSUMER KEY',
  consumerSecret: 'PUT YOUR CONSUMER SECRET',
  callback: 'PUT YOUR URL',
});

var twitter_accessToken;
var twitter_accessTokenSecret;

let tray = null

app.on('ready', function () {
  const {
    width,
    height,
    x,
    y
  } = config.get('bounds')

  // トレイアイコンの表示
  // TODO 表示非表示項目を足す
  tray = new Tray(__dirname + '/icons/trayicon.png')
  const contextMenu = Menu.buildFromTemplate([{
      label: 'Quit',
      click: function () {
        app.quit();
      }
    },
    {
      label: 'Clear Settings',
      click: function () {
        // 設定をデフォルトにして再起動
        // TODO 本当にいいですかダイアログ追加する
        config.clear();
        app.relaunch();
        app.exit(0);
      }
    }
  ])
  tray.setToolTip('This is my application.')
  tray.setContextMenu(contextMenu)

  const mainWindow = new BrowserWindow({
    frame: false,
    x: x,
    y: y,
    width: width,
    height: height,
    webPreferences: {
      webSecurity: false
    }
  });

  // ウインドウの状態によってウインドウを表示する
  function showOrHideWindow() {
    if (mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  }

  if (process.platform === 'darwin') {
    // dockに表示しない
    app.dock.hide();
  }

  // メニューバーのアイコンを右クリックするとウィンドウを表示/非表示
  click_action = 'right-click';
  var click_action = function () {
    if (process.platform !== 'darwin') return 'click'
  }
  tray.on(click_action, () => {
    showOrHideWindow();
  });

  // サイズを覚えておく
  ['resize', 'move'].forEach(ev => {
    mainWindow.on(ev, () => {
      config.set('bounds', mainWindow.getBounds())
    })
  });

  // 画面表示ショートカット
  const ret = globalShortcut.register('Control+Shift+Space', () => {
    console.log('CommandOrControl+X is pressed')
    showOrHideWindow();
  });

  // レンダラからのツイート指示を受け取る
  ipcMain.on('asynchronous-tweet', function (event, tweetstr) {
    console.log(tweetstr);
    tweet(tweetstr, event); // レンダラに結果を返すために event を引数に入れた
  })

  // ウィンドウ隠してね指示を受け取る
  ipcMain.on('hide-after-tweet', function (mainWindow) {
    console.log('hide-after-tweet');
    showOrHideWindow();
  })

  // アクセストークンとかなかったら取得する
  if (!config.has('twitter_accessToken') || !config.has('twitter_accessTokenSecret')) {
    twitter.getRequestToken(function (error, requestToken, requestTokenSecret, results) {
      var url = twitter.getAuthUrl(requestToken);
      mainWindow.webContents.on('will-navigate', function (event, url) {
        var matched;
        if (matched = url.match(/\?oauth_token=([^&]*)&oauth_verifier=([^&]*)/)) {
          twitter.getAccessToken(requestToken, requestTokenSecret, matched[2], function (error, accessToken, accessTokenSecret, results) {
            twitter_accessToken = accessToken;
            twitter_accessTokenSecret = accessTokenSecret;
            // アクセストークンを保存する
            config.set('twitter_accessToken', twitter_accessToken);
            config.set('twitter_accessTokenSecret', twitter_accessTokenSecret);
            // 投稿画面へ
            twitter.verifyCredentials(
              config.get('twitter_accessToken'),
              config.get('twitter_accessTokenSecret'), {},
              function (error, data, respons) {
                mainWindow.loadURL('file://' + __dirname + '/index.html');
              });
          });
        }
        event.preventDefault();
      });
      mainWindow.loadURL(url);
    });
  }

  twitter_accessToken = config.get('twitter_accessToken');
  twitter_accessTokenSecret = config.get('twitter_accessTokenSecret');

  // 投稿画面へ
  twitter.verifyCredentials(
    config.get('twitter_accessToken'),
    config.get('twitter_accessTokenSecret'), {},
    function (error, data, respons) {
      mainWindow.loadURL('file://' + __dirname + '/index.html');
    });
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// ツイートします
// 結果はipcで返す
function tweet(tweetstr, event) {
  twitter.statuses("update", {
      status: tweetstr
    },
    twitter_accessToken,
    twitter_accessTokenSecret,
    function (error, data, response) {
      if (error) {
        console.log(error);
        console.log('tweet() error');
        event.sender.send('asynchronous-tweet-ret', 'error');
      } else {
        // console.log(data);
        console.log("tweet() success");
        event.sender.send('asynchronous-tweet-ret', 'success');
      }
    });
}