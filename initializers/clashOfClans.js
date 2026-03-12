const { Client: ClientCoc, PollingClient, Util } = require("clashofclans.js");

class ClashOfClans {
  constructor(config) {
    this.config = config;
    this.clientCoc = null;
    this.clientCocLegend = null;
    this.apiKey = null;
    this.apiKeyLegend = null;
    this.utilCoc = Util;
  }

  // メインクライアントのログイン
  async loginMain() {
    try {
      this.clientCoc = new ClientCoc();
      this.apiKey = await this.clientCoc.login({
        email: this.config.clashOfClans.email,
        password: this.config.clashOfClans.password,
        keyName: this.config.clashOfClans.keyNames.main,
      });
      
      console.log(`LOGGED IN: clientCoc`);
      return this.clientCoc;
    } catch (error) {
      console.error("Failed to login main CoC client:", error);
      throw error;
    }
  }

  // レジェンドクライアントのログイン
  async loginLegend() {
    try {
      this.clientCocLegend = new ClientCoc();
      this.apiKeyLegend = await this.clientCocLegend.login({
        email: this.config.clashOfClans.email,
        password: this.config.clashOfClans.password,
        keyName: this.config.clashOfClans.keyNames.legend,
      });
      
      console.log(`LOGGED IN: clientCocLegend`);
      return this.clientCocLegend;
    } catch (error) {
      console.error("Failed to login legend CoC client:", error);
      throw error;
    }
  }

  // 両方のクライアントをログイン
  async loginAll() {
    await this.loginMain();
    await this.loginLegend();
  }

  // クライアントをDiscordクライアントに設定
  setupClient(client) {
    client.clientCoc = this.clientCoc;
    client.clientCocLegend = this.clientCocLegend;
    client.utilCoc = this.utilCoc;
  }

  // メンテナンス監視用ポーリングクライアントの作成
  createMaintenancePolling() {
    if (!this.apiKey) {
      throw new Error("Main CoC client not logged in");
    }

    const pollingClient = new PollingClient({ keys: [this.apiKey] });
    pollingClient.pollingInterval = this.config.intervals.maintenance;
    return pollingClient;
  }

  // トロフィー監視用ポーリングクライアントの作成
  createTrophyPolling() {
    if (!this.apiKey) {
      throw new Error("Main CoC client not logged in");
    }

    const pollingClient = new PollingClient({ keys: [this.apiKey] });
    pollingClient.pollingInterval = this.config.intervals.trophies;
    return pollingClient;
  }

  // クリーンアップ
  async cleanup() {
    try {
      if (this.clientCoc) {
        // 必要に応じてクリーンアップ処理
      }
      if (this.clientCocLegend) {
        // 必要に応じてクリーンアップ処理
      }
    } catch (error) {
      console.error("Error during CoC cleanup:", error);
    }
  }
}

module.exports = ClashOfClans;
