const { EmbedBuilder } = require("discord.js");
const config_coc = require("../config_coc.js");

class PollingSystem {
  constructor(client, config, functions, fLegend) {
    this.client = client;
    this.config = config;
    this.functions = functions;
    this.fLegend = fLegend;
    this.pollingClientMaintenance = null;
    this.pollingClientTrophies = null;
    this.lastMaintenanceStart = 0;
    this.accountsLegend = [];
  }

  // メンテナンス監視の初期化
  async initializeMaintenancePolling(pollingClient) {
    try {
      this.pollingClientMaintenance = pollingClient;
      await this.pollingClientMaintenance.init();
      console.log("Maintenance polling initialized (60s)");

      // メンテナンス開始イベント
      this.pollingClientMaintenance.on("maintenanceStart", () => {
        this.handleMaintenanceStart();
      });

      // メンテナンス終了イベント
      this.pollingClientMaintenance.on("maintenanceEnd", (durationInMiliSec) => {
        this.handleMaintenanceEnd(durationInMiliSec);
      });

      // 新シーズン開始イベント
      this.pollingClientMaintenance.on("newSeasonStart", async () => {
        await this.handleNewSeasonStart();
      });

      return this.pollingClientMaintenance;
    } catch (error) {
      console.error("Failed to initialize maintenance polling:", error);
      throw error;
    }
  }

  // トロフィー監視の初期化
  async initializeTrophyPolling(pollingClient) {
    try {
      this.pollingClientTrophies = pollingClient;
      await this.pollingClientTrophies.init();
      console.log("Trophy polling initialized (30s)");

      // プレイヤー統計変更イベントの設定は後で行う
      this.pollingClientTrophies.setPlayerEvent({
        name: "playerStatsChange",
        filter: (beforePlayerStats, afterPlayerStats) => {
          return (
            beforePlayerStats.trophies !== afterPlayerStats.trophies ||
            beforePlayerStats.attackWins !== afterPlayerStats.attackWins ||
            beforePlayerStats.defenseWins !== afterPlayerStats.defenseWins
          );
        },
      });

      return this.pollingClientTrophies;
    } catch (error) {
      console.error("Failed to initialize trophy polling:", error);
      throw error;
    }
  }

  // メンテナンス開始の処理
  handleMaintenanceStart() {
    const now = Date.now();
    if (now - this.lastMaintenanceStart < this.config.intervals.maintenanceThreshold) {
      return; // 2分以内の場合は通知しない
    }
    this.lastMaintenanceStart = now;

    const embed = new EmbedBuilder();
    embed.setAuthor({
      name: "CLASH OF CLANS",
      iconURL: this.config.urlImage.coc,
    });
    embed.setTitle("MAINTENANCE HAS STARTED");
    embed.setDescription("*The game is under maintenance.*");
    embed.setColor(this.config.color.red);
    embed.setTimestamp();

    const channelFreeBotRoom = this.client.channels.cache.get(this.config.logch.freeBotRoom);
    if (channelFreeBotRoom) {
      channelFreeBotRoom.send({ embeds: [embed] });
    } else {
      console.error("channelFreeBotRoom not found");
    }
  }

  // メンテナンス終了の処理
  handleMaintenanceEnd(durationInMiliSec) {
    if (durationInMiliSec < this.config.intervals.maintenanceThreshold) {
      return; // 2分以内の場合は通知しない
    }

    const durationInSec = Math.round(durationInMiliSec / 1000);
    const durationSec = durationInSec % 60;
    const durationInMin = Math.floor(durationInSec / 60);
    const durationMin = durationInMin % 60;
    const durationInHour = Math.floor(durationInMin / 60);
    const durationHour = durationInHour % 24;

    const embed = new EmbedBuilder();
    embed.setAuthor({
      name: "CLASH OF CLANS",
      iconURL: this.config.urlImage.coc,
    });
    embed.setTitle(":white_check_mark: MAINTENANCE HAS ENDED");
    embed.setDescription(`Maintenance time: ${durationHour}:${durationMin.toString().padStart(2, '0')}:${durationSec.toString().padStart(2, '0')}`);
    embed.setColor(this.config.color.green);
    embed.setTimestamp();

    const channelFreeBotRoom = this.client.channels.cache.get(this.config.logch.freeBotRoom);
    if (channelFreeBotRoom) {
      channelFreeBotRoom.send({ embeds: [embed] });
    } else {
      console.error("channelFreeBotRoom not found");
    }
  }

  // 新シーズン開始の処理
  async handleNewSeasonStart() {
    const embed = new EmbedBuilder();
    embed.setAuthor({
      name: "CLASH OF CLANS",
      iconURL: this.config.urlImage.coc,
    });
    embed.setTitle("NEW SEASON HAS STARTED");
    embed.setDescription("*The new season has started.*");
    embed.setColor(this.config.color.green);
    embed.setTimestamp();

    const channelFreeBotRoom = this.client.channels.cache.get(this.config.logch.freeBotRoom);
    if (channelFreeBotRoom) {
      channelFreeBotRoom.send({ embeds: [embed] });
    } else {
      console.error("channelFreeBotRoom not found");
    }

    await this.functions.sleep(this.config.intervals.legendUpdateDelay);
    this.fLegend.autoUpdateLegendReset(this.client);
  }

  // アカウントリスト更新
  async updateMonitoringAccounts() {
    try {
      const query = {
        status: true,
        $or: [
          { "legend.logSettings.post": { $in: ["channel", "dm"] } },
          { "legend.previousDay.trophies": { $gte: 4000 } }
        ]
      };
      
      const options = {
        projection: {
          _id: 0,
          tag: 1,
          "legend.logSettings": 1,
          "legend.events": 1,
          "pilotDC.id": 1,
          name: 1,
          townHallLevel: 1,
        },
      };
      
      const cursor = this.client.clientMongo
        .db("jwc")
        .collection("accounts")
        .find(query, options);
      
      const newAccountsLegend = await cursor.toArray();
      await cursor.close();
      
      // 新しいアカウントを追加
      const newTags = newAccountsLegend.map(account => account.tag);
      this.pollingClientTrophies.addPlayers(newTags);
      
      // グローバル変数を更新
      this.accountsLegend = newAccountsLegend;
      global.accountsLegend = newAccountsLegend;
      
      console.log(`LEGEND ACCOUNTS MONITORING: ${newTags.length}`);
    } catch (error) {
      console.error("Error updating monitoring accounts:", error);
    }
  }

  // プレイヤー統計変更の処理
  handlePlayerStatsChange(beforePlayerStats, afterPlayerStats) {
    // アカウントリストが初期化されているかチェック
    if (!this.accountsLegend || this.accountsLegend.length === 0) {
      console.log(`[WARNING] accountsLegend is not initialized yet, skipping player stats change for tag: ${afterPlayerStats.tag}`);
      return;
    }

    const currentDate = new Date();
    const seasonData = this.functions.calculateSeasonValues(this.client, currentDate);
    const tagPlayer = afterPlayerStats.tag;
    const mongoAcc = this.accountsLegend.find((account) => account.tag === tagPlayer);
    
    if (!mongoAcc) {
      return;
    }
    const beforeSlim = (({ tag, name, townHallLevel, trophies, attackWins, defenseWins, leagueTier }) => 
      ({ tag, name, townHallLevel, trophies, attackWins, defenseWins, leagueTier }))(beforePlayerStats);
    const afterSlim = (({ tag, name, townHallLevel, trophies, attackWins, defenseWins, leagueTier }) => 
      ({ tag, name, townHallLevel, trophies, attackWins, defenseWins, leagueTier }))(afterPlayerStats);

    this.fLegend.autoUpdateLegend(this.client, mongoAcc, beforeSlim, afterSlim, seasonData);
    this.functions.updateStatusInfoLegend(this.client, seasonData);
  }

  // 定期的なアカウント更新の開始
  startAccountUpdateInterval() {
    setInterval(() => {
      this.updateMonitoringAccounts();
    }, this.config.intervals.accountUpdate);
  }

  // 初期化完了
  async initialize() {
    // 1. まずアカウントリストを初期化
    await this.updateMonitoringAccounts();
    
    // 2. アカウントリスト初期化後にイベントリスナーを設定
    this.setupPlayerStatsChangeListener();
    
    // 3. 定期的なアカウント更新を開始
    this.startAccountUpdateInterval();
  }

  // プレイヤー統計変更イベントリスナーの設定
  setupPlayerStatsChangeListener() {
    if (this.pollingClientTrophies) {
      this.pollingClientTrophies.on("playerStatsChange", (beforePlayerStats, afterPlayerStats) => {
        this.handlePlayerStatsChange(beforePlayerStats, afterPlayerStats);
      });
      console.log("Player stats change listener setup completed");
    } else {
      console.error("pollingClientTrophies is not initialized");
    }
  }
}

module.exports = PollingSystem;
