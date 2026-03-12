// 環境変数とアプリケーション設定の一元管理
require('dotenv').config();

// デバッグ用：環境変数の確認
console.log("Environment variables check:");
console.log("mongoURI:", process.env.mongoURI ? "SET" : "NOT SET");
console.log("BOT_TOKEN:", process.env.BOT_TOKEN ? "SET" : "NOT SET");
console.log("clashEmail:", process.env.clashEmail ? "SET" : "NOT SET");
console.log("clashPW:", process.env.clashPW ? "SET" : "NOT SET");

// 環境変数が設定されていない場合の警告
if (!process.env.mongoURI) {
  console.warn("⚠️  WARNING: mongoURI environment variable is not set. Using default localhost connection.");
}
if (!process.env.BOT_TOKEN) {
  console.warn("⚠️  WARNING: BOT_TOKEN environment variable is not set. Bot will not be able to connect to Discord.");
}
if (!process.env.clashEmail || !process.env.clashPW) {
  console.warn("⚠️  WARNING: Clash of Clans credentials are not set. CoC features will not work.");
}

// 既存の設定を先に読み込み
let existingConfig = {};
try {
  existingConfig = require('../config.js');
  console.log("Existing config loaded successfully");
} catch (error) {
  console.warn("Warning: Could not load existing config.js:", error.message);
}

// 新しい設定を作成（既存の設定を上書き）
const newConfig = {
  // Discord設定
  discord: {
    token: process.env.BOT_TOKEN,
    intents: ['Guilds'],
  },

  // MongoDB設定
  mongo: {
    uri: process.env.mongoURI,
    nameDatabase: "jwc",
    options: {
      serverApi: {
        version: "1",
        strict: true,
        deprecationErrors: true,
      },
    },
  },

  // Clash of Clans設定
  clashOfClans: {
    email: process.env.clashEmail,
    password: process.env.clashPW,
    keyNames: {
      main: "replit_main",
      legend: "replit_legend",
    },
  },

  // Webサーバー設定
  server: {
    port: 3000,
    host: "0.0.0.0",
  },

  // ポーリング間隔設定
  intervals: {
    maintenance: 60000,        // メンテナンス監視: 60秒
    trophies: 30000,          // トロフィー監視: 30秒
    accountUpdate: 5 * 60 * 1000, // アカウント更新: 5分
    maintenanceThreshold: 120000,  // メンテナンス通知閾値: 2分
    legendUpdateDelay: 30000,     // レジェンド更新遅延: 30秒
  },
};

// 既存の設定と新しい設定をマージ（新しい設定が優先）
const finalConfig = { ...existingConfig, ...newConfig };

// デバッグ用：最終設定の確認
console.log("Final config structure:");
console.log("- discord section:", !!finalConfig.discord);
console.log("- mongo section:", !!finalConfig.mongo);
console.log("- clashOfClans section:", !!finalConfig.clashOfClans);
console.log("- mongo.uri:", finalConfig.mongo?.uri ? "SET" : "NOT SET");

module.exports = finalConfig;


