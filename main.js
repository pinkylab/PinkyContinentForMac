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

const fs = require('fs');

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
    hide_after_tweet: true,
  },
})
const twitterAPI = require('node-twitter-api');

var data = JSON.parse(fs.readFileSync('config.json', 'utf8'));

const twitter = new twitterAPI({
  consumerKey: data.consumerKey,
  consumerSecret: data.consumerSecret,
  callback: data.callback,
});

var twitter_accessToken;
var twitter_accessTokenSecret;

let tray = null

app.on('ready', () => {
  const {
    width,
    height,
    x,
    y
  } = config.get('bounds')

  // トレイアイコンの表示
  tray = new Tray(__dirname + '/icons/trayicon.png')
  const taskTrayMenuTemplete = [{
      label: 'Settings',
      submenu: [{
          label: 'Hide After Tweet',
          type: 'checkbox',
          checked: config.get('hide_after_tweet'),
          click: (e) => {
            console.log('BrowserProcess: ' + 'Hide After Tweetクリック前：'+config.get('hide_after_tweet'));
            config.set('hide_after_tweet', e.checked);
            console.log('BrowserProcess: ' + 'Hide After Tweetクリック後：'+config.get('hide_after_tweet'));
          }
        },
        {
          label: 'Clear Settings',
          click: function () {
            var options = {
              title: 'Clear Settings?',
              type: 'warning',
              buttons: ['OK', 'Cancel'],
              cancelId: 0,
              message: 'Clear Settings',
              detail: 'OK?'
            };
            // buttons 配列の一つ目の添字が 0 になる
            if (dialog.showMessageBox(options) == 0) {
              // 設定をデフォルトにして再起動
              clearSettings();
            }
          }
        },
      ]
    },
    {
      type: 'separator'
    },
    {
      label: 'DevTools',
      click: function () {
        mainWindow.toggleDevTools();
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      click: function () {
        app.quit();
      }
    },
  ];

  // ログイン済みの場合スクリーンネームを表示する
  if (config.has('screen_name1')) {
    addScreenNameToTemplete(taskTrayMenuTemplete);
  }

  tray.setContextMenu(Menu.buildFromTemplate(taskTrayMenuTemplete));

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
    console.log('BrowserProcess: ' + 'CommandOrControl+X is pressed')
    showOrHideWindow();
  });

  // レンダラからのツイート指示を受け取る
  ipcMain.on('asynchronous-tweet', function (event, tweetstr) {
    console.log('BrowserProcess: ' + tweetstr);
    tweet(tweetstr, event); // レンダラに結果を返すために event を引数に入れた
  })

  // ウィンドウ隠してね指示を受け取る
  ipcMain.on('hide-after-tweet', function (mainWindow) {
    if (config.get('hide_after_tweet')) {
      console.log('BrowserProcess: ' + 'hide-after-tweet');
      showOrHideWindow();
    }
  })

  // アクセストークンとかなかったら取得する
  if (!config.has('twitter_accessToken1') || !config.has('twitter_accessTokenSecret1')) {
    twitterLogin(mainWindow);
  }

  twitter_accessToken = config.get('twitter_accessToken1');
  twitter_accessTokenSecret = config.get('twitter_accessTokenSecret1');

  // 投稿画面へ
  twitter.verifyCredentials(
    config.get('twitter_accessToken1'),
    config.get('twitter_accessTokenSecret1'), {},
    function (error, data, respons) {
      mainWindow.loadURL('file://' + __dirname + '/index.html');
    });


  // ウインドウの状態によってウインドウを表示する
  function showOrHideWindow() {
    if (mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  }

  function addScreenNameToTemplete(templete) {
    templete.unshift({
      label: "I'm @" + config.get('screen_name1'),
      click: function () {
        showOrHideWindow();
      }
    })
  }

  function clearSettings() {
    config.clear();
    app.relaunch();
    app.exit(0);
  }
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
        console.log('BrowserProcess: ' + error);
        event.sender.send('asynchronous-tweet-ret', 'error');
      } else {
        console.log("BrowserProcess: tweet() success");
        event.sender.send('asynchronous-tweet-ret', 'success');
      }
    });
}

function twitterLogin(mainWindow) {
  (twitter.getRequestToken(function (error, requestToken, requestTokenSecret, results) {
    var url = twitter.getAuthUrl(requestToken);
    mainWindow.webContents.on('will-navigate', function (event, url) {
      var matched;
      if (matched = url.match(/\?oauth_token=([^&]*)&oauth_verifier=([^&]*)/)) {
        twitter.getAccessToken(requestToken, requestTokenSecret, matched[2], function (error, accessToken, accessTokenSecret, results) {
          twitter_accessToken = accessToken;
          twitter_accessTokenSecret = accessTokenSecret;
          // アクセストークンを保存する
          config.set('twitter_accessToken1', twitter_accessToken);
          config.set('twitter_accessTokenSecret1', twitter_accessTokenSecret);
          // スクリーンネームも保存しておく
          config.set('screen_name1', results['screen_name1']);
          // タスクトレイのメニューにスクリーンネームを表示
          if (config.has('screen_name1')) {
            addScreenNameToTemplete(taskTrayMenuTemplete);
            tray.setContextMenu(Menu.buildFromTemplate(taskTrayMenuTemplete));
          }
          // 投稿画面へ
          twitter.verifyCredentials(
            config.get('twitter_accessToken1'),
            config.get('twitter_accessTokenSecret1'), {},
            function (error, data, respons) {
              mainWindow.loadURL('file://' + __dirname + '/index.html');
            });
          mainWindow.setBounds({
            x: 0,
            y: 0,
            width: 160,
            height: 100
          }, true);
        });
      }
      event.preventDefault();
    });
    mainWindow.loadURL(url);
  }));
}