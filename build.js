var packager = require('electron-packager');  
var config = require('./package.json');

packager({  
  dir: './',          // 対象
  out: './dist',      // 出力先
  name: config.name,  // 名前
  platform: 'darwin', // or win32
  arch: 'x64',        // 64bit
  // electronVersion: '1.7.5',  // electron のバージョン
  icon: './app.icns', // アイコン
  extraResource: './config.json',

  appBundleId: 'jp.pinkylab.pinkycontinent', // ドメイン
  appVersion: config.version,          // バージョン

  overwrite: true,  // 上書き
  asar: true,       // アーカイブ
  prune: true,
  // 無視ファイル
  ignore: "node_modules/(electron-packager|electron-prebuilt|\.bin)|release\.js",
}, function done (err, appPath) {
  if(err) {
    throw new Error(err);
  }
  console.log('Done!!');
});