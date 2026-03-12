const CommandLoader = require('./commandLoader');
const WebServer = require('./webServer');
const ClashOfClans = require('./clashOfClans');
const PollingSystem = require('./pollingSystem');

class BotInitializer {
  constructor(client, config, clientMongo) {
    this.client = client;
    this.config = config;
    this.clientMongo = clientMongo;
    this.commandLoader = null;
    this.webServer = null;
    this.clashOfClans = null;
    this.pollingSystem = null;
  }

  // MongoDB接続
  async connectMongoDB() {
    try {
      await this.clientMongo.connect();
      console.log("connected to the Mongo database");
      this.client.clientMongo = this.clientMongo;
      console.log("MongoDB connection established successfully");
    } catch (error) {
      console.error("Failed to connect to MongoDB:", error);
      throw error;
    }
  }

  // 基本的なクライアント設定
  setupBasicClient() {
    this.client.fs = require("fs");
    this.client.config = this.config;
    this.client.schedule = require("../schedule.js");
  }

  // コマンドとイベントの読み込み
  async loadCommandsAndEvents() {
    try {
      this.commandLoader = new CommandLoader(this.client);
      await this.commandLoader.loadAll();
      console.log("Commands and events loaded successfully");
    } catch (error) {
      console.error("Failed to load commands and events:", error);
      throw error;
    }
  }

  // Webサーバーの初期化
  async initializeWebServer() {
    try {
      this.webServer = new WebServer(this.config);
      this.webServer.setupExpress();
      
      // POSTエンドポイントの設定
      const post = require("../functions/post.js");
      this.webServer.setupPostEndpoint(this.client, post);
      
      // サーバーの起動
      await this.webServer.start();
      
      // アプリケーションをエクスポート
      module.exports = this.webServer.getApp();
      
      console.log("Web server initialized successfully");
    } catch (error) {
      console.error("Failed to initialize web server:", error);
      throw error;
    }
  }

  // Clash of Clans接続の初期化
  async initializeClashOfClans() {
    try {
      this.clashOfClans = new ClashOfClans(this.config);
      await this.clashOfClans.loginAll();
      this.clashOfClans.setupClient(this.client);
      
      console.log("Clash of Clans initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Clash of Clans:", error);
      throw error;
    }
  }

  // ポーリングシステムの初期化
  async initializePollingSystem() {
    try {
      const functions = require("../functions/functions.js");
      const fLegend = require("../functions/fLegend.js");
      
      this.pollingSystem = new PollingSystem(this.client, this.config, functions, fLegend);
      
      // メンテナンス監視の初期化
      const maintenancePolling = this.clashOfClans.createMaintenancePolling();
      await this.pollingSystem.initializeMaintenancePolling(maintenancePolling);
      
      // トロフィー監視の初期化
      const trophyPolling = this.clashOfClans.createTrophyPolling();
      await this.pollingSystem.initializeTrophyPolling(trophyPolling);
      
      // アカウント監視の初期化
      await this.pollingSystem.initialize();
      
      console.log("Polling system initialized successfully");
    } catch (error) {
      console.error("Failed to initialize polling system:", error);
      throw error;
    }
  }

  // エラーハンドリングの設定
  setupErrorHandling() {
    // 未処理例外のハンドリング
    process.on("uncaughtException", (error) => {
      console.error(
        `[${this.client.functions?.timeToJST(Date.now(), true) || new Date().toISOString()}] ${error.stack}`,
      );
      const embed = new (require("discord.js").EmbedBuilder)()
        .setTitle("ERROR - uncaughtException")
        .setDescription("```\n" + error.stack + "\n```")
        .setColor("#ff0000")
        .setTimestamp();

      const channelError = this.client.channels.cache.get(this.config.logch?.error);
      if (channelError) {
        channelError.send({ embeds: [embed] });
      } else {
        console.error("channelError not found");
      }
    });

    // 未処理プロミス拒否のハンドリング
    process.on("unhandledRejection", (reason, promise) => {
      console.error(
        `\u001b[31m[${this.client.functions?.timeToJST(Date.now(), true) || new Date().toISOString()}] ${reason}\u001b[0m\n`,
        promise,
      );
      const embed = new (require("discord.js").EmbedBuilder)()
        .setTitle("ERROR - unhandledRejection")
        .setDescription("```\n" + reason + "\n```")
        .setColor("#ff0000")
        .setTimestamp();

      const channelError = this.client.channels.cache.get(this.config.logch?.error);
      if (channelError) {
        channelError.send({ embeds: [embed] });
      } else {
        console.error("channelError not found");
      }
    });
  }

  // メイン初期化処理
  async initialize() {
    try {
      console.log("Starting bot initialization...");
      
      // MongoDB接続
      await this.connectMongoDB();
      
      // 基本的なクライアント設定
      this.setupBasicClient();
      
      // コマンドとイベントの読み込み
      await this.loadCommandsAndEvents();
      
      // Webサーバーの初期化
      await this.initializeWebServer();
      
      // Clash of Clans接続の初期化
      await this.initializeClashOfClans();
      
      // ポーリングシステムの初期化
      await this.initializePollingSystem();
      
      // エラーハンドリングの設定
      this.setupErrorHandling();
      
      console.log("Bot initialization completed successfully");
    } catch (error) {
      console.error("Bot initialization failed:", error);
      throw error;
    }
  }

  // クリーンアップ処理
  async cleanup() {
    try {
      if (this.clashOfClans) {
        await this.clashOfClans.cleanup();
      }
      console.log("Cleanup completed");
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }
}

module.exports = BotInitializer;
