import express from "express";
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
  Collection,
} from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import schedule from "./config/schedule.js";
import appConfig from "./config/config.js";
import config_coc from "./config/config_coc.js";
import * as functions from "./functions/functions.js";
import * as fLegend from "./functions/fLegend.js";
import * as fMongo from "./functions/fMongo.js";
import { post } from "./functions/post.js";
import {
  Client as ClientCoc,
  PollingClient,
  Util as CocUtil,
} from "clashofclans.js";

// ====== ENV ======
const TOKEN = (process.env.BOT_TOKEN || "").trim();
const MONGO_URI = (process.env.mongoURI || "").trim();

if (!TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN (or BOT_TOKEN) is empty. Set it in Replit Secrets.",
  );
  process.exit(1);
}

// ====== MongoDB ======
import { MongoClient, ServerApiVersion } from "mongodb";

const clientMongo = new MongoClient(MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const isDeployment =
  process.env.DEPLOYMENT === "true" &&
  process.env.STARTUP_GUARD === "your-random-long-string";

if (!isDeployment) {
  console.log("[GUARD] Bot startup blocked: Deployment-only mode.");
  process.exit(0);
}

// --- Web server (Preview/health & /post:POST only) ---
const app = express();
app.use(express.json());
app.get("/", (_, res) => res.send("OK"));
app.get("/ok", (_, res) => res.json({ ok: true, ts: Date.now() }));

// /post は POST のみ許可（他メソッドは 405）
app.all("/post", (req, res, next) => {
  if (req.method !== "POST")
    return res.status(405).send("Method Not Allowed: use POST");
  next();
});
// 受信ハンドラ（最小版）—必要に応じてDBや各処理をここに
app.post("/post", async (req, res) => {
  try {
    // functions/post.jsのpost関数を呼び出し
    await post(req, res, client, req.body);
  } catch (e) {
    console.error("Error in /post:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () =>
  console.log(`🌐 Web server up on 0.0.0.0:${port}`),
);

// Discord Client
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

// 基本クライアント設定
client.fs = fs;
client.schedule = schedule;

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Discord client ready: ${c.user.tag}`);
});

// ===== CommandLoader =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CommandLoader {
  constructor(dcClient) {
    this.client = dcClient;
  }
  async loadCommands() {
    this.client.commands = new Collection();
    const commandsRoot = path.join(__dirname, "commands");
    const commandFolders = fs
      .readdirSync(commandsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const folder of commandFolders) {
      const folderPath = path.join(commandsRoot, folder);
      const commandFiles = fs
        .readdirSync(folderPath)
        .filter((f) => f.endsWith(".js"));
      for (const file of commandFiles) {
        const fullPath = path.join(folderPath, file);
        try {
          const mod = await import(pathToFileURL(fullPath).href);
          const command = mod.default ?? mod;
          if (!command?.data?.name || typeof command?.execute !== "function") {
            console.warn(`⚠️ Skipped ${file}: invalid command shape`);
            continue;
          }
          this.client.commands.set(command.data.name, command);
          console.log(`🔧 loaded command: ${command.data.name}`);
        } catch (err) {
          console.error(`❌ Error loading command ${file}:`, err);
        }
      }
    }
    console.log(`⚡ Successfully loaded ${this.client.commands.size} commands`);
  }
  async loadEvents() {
    const eventsRoot = path.join(__dirname, "events");
    const eventFiles = fs
      .readdirSync(eventsRoot)
      .filter((f) => f.endsWith(".js"));
    for (const file of eventFiles) {
      const fullPath = path.join(eventsRoot, file);
      try {
        const mod = await import(pathToFileURL(fullPath).href);
        const event = mod.default ?? mod;
        if (!event?.name || typeof event?.execute !== "function") {
          console.warn(`⚠️ Skipped ${file}: invalid event shape`);
          continue;
        }
        if (event.once) {
          this.client.once(event.name, (...args) =>
            event.execute(...args, this.client),
          );
        } else {
          this.client.on(event.name, (...args) =>
            event.execute(...args, this.client),
          );
        }
        console.log(`🔧 loaded event: ${event.name}`);
      } catch (err) {
        console.error(`❌ Error loading event ${file}:`, err);
      }
    }
    console.log(`⚡ Successfully loaded ${eventFiles.length} events`);
  }
  async loadAll() {
    await this.loadCommands();
    await this.loadEvents();
  }
}

// ===== ClashOfClans =====
const COC_EMAIL = (process.env.clashEmail || "").trim();
const COC_PW = (process.env.clashPW || "").trim();

class ClashOfClans {
  constructor(config) {
    this.config = config;
    this.clientCoc = null;
    this.clientCocLegend = null;
    this.apiKey = null;
    this.apiKeyLegend = null;
    this.utilCoc = CocUtil;
  }
  async loginMain() {
    this.clientCoc = new ClientCoc();
    this.apiKey = await this.clientCoc.login({
      email: COC_EMAIL,
      password: COC_PW,
      keyName: "replit_main",
    });
    console.log(`✅ LOGGED IN: clientCoc`);
    return this.clientCoc;
  }
  async loginLegend() {
    this.clientCocLegend = new ClientCoc();
    this.apiKeyLegend = await this.clientCocLegend.login({
      email: COC_EMAIL,
      password: COC_PW,
      keyName: "replit_legend",
    });
    console.log(`✅ LOGGED IN: clientCocLegend`);
    return this.clientCocLegend;
  }
  async loginAll() {
    await this.loginMain();
    await this.loginLegend();
  }
  setupClient(dcClient) {
    dcClient.clientCoc = this.clientCoc;
    dcClient.clientCocLegend = this.clientCocLegend;
    dcClient.utilCoc = this.utilCoc;
  }
  createMaintenancePolling() {
    if (!this.apiKey) throw new Error("❌ Main CoC client not logged in");
    const pollingClient = new PollingClient({ keys: [this.apiKey] });
    pollingClient.pollingInterval = 60000;
    return pollingClient;
  }
  createTrophyPolling() {
    if (!this.apiKey) throw new Error("❌ Main CoC client not logged in");
    const pollingClient = new PollingClient({ keys: [this.apiKey] });
    pollingClient.pollingInterval = 30000;
    return pollingClient;
  }
}

// ===== PollingSystem =====
class PollingSystem {
  constructor(dcClient, config, functionsLib, fLegendLib) {
    this.client = dcClient;
    this.config = config;
    this.functions = functionsLib;
    this.fLegend = fLegendLib;
    this.pollingClientMaintenance = null;
    this.pollingClientTrophies = null;
    this.lastMaintenanceStart = 0;
    this.lastMaintenanceEnd = 0;
    this.accountsLegend = [];
  }

  // メンテナンスの処理の初期化
  async initializeMaintenancePolling(pollingClient) {
    try {
      this.pollingClientMaintenance = pollingClient;
      await this.pollingClientMaintenance.init();
      console.log("⚙️ Maintenance polling initialized (60s)");
      this.pollingClientMaintenance.on("maintenanceStart", () => {
        this.handleMaintenanceStart();
      });
      this.pollingClientMaintenance.on(
        "maintenanceEnd",
        (durationInMiliSec) => {
          this.handleMaintenanceEnd(durationInMiliSec);
        },
      );
      this.pollingClientMaintenance.on("newSeasonStart", async () => {
        await this.handleNewSeasonStart();
      });
      return this.pollingClientMaintenance;
    } catch (error) {
      console.error("❌ Failed to initialize maintenance polling:", error);
      throw error;
    }
  }

  // メンテナンスが始まったときの処理
  handleMaintenanceStart() {
    const now = Date.now();
    if (now - this.lastMaintenanceStart < 2 * 60 * 1000) return;
    this.lastMaintenanceStart = now;
    const embed = new EmbedBuilder()
      .setAuthor({ name: "CLASH OF CLANS", iconURL: this.config.urlImage?.coc })
      .setTitle("MAINTENANCE HAS STARTED")
      .setDescription("*The game is under maintenance.*")
      .setColor(this.config.color?.red ?? "#ff0000")
      .setTimestamp();
    const ch = this.client.channels.cache.get(this.config.logch?.freeBotRoom);
    if (ch) ch.send({ embeds: [embed] });
    else console.error("❌ channelFreeBotRoom not found");
  }

  // メンテナンスが終わったときの処理
  handleMaintenanceEnd(durationInMiliSec) {
    const now = Date.now();

    // 重複防止: 2分以内の重複通知を防ぐ
    if (now - this.lastMaintenanceEnd < 2 * 60 * 1000) {
      console.log(
        "⚠️ Maintenance end notification skipped (duplicate prevention)",
      );
      return;
    }

    // メンテナンス時間が短すぎる場合は通知しない（デフォルト: 30秒未満）
    const threshold = 30000; // 30秒
    if (durationInMiliSec < threshold) {
      console.log(
        `⚠️ Maintenance end notification skipped (duration too short: ${durationInMiliSec}ms < ${threshold}ms)`,
      );
      return;
    }

    this.lastMaintenanceEnd = now;

    const sec = Math.round(durationInMiliSec / 1000);
    const s = sec % 60;
    const m = Math.floor(sec / 60) % 60;
    const h = Math.floor(sec / 3600) % 24;
    const embed = new EmbedBuilder()
      .setAuthor({ name: "CLASH OF CLANS", iconURL: this.config.urlImage?.coc })
      .setTitle(":white_check_mark: MAINTENANCE HAS ENDED")
      .setDescription(
        `Maintenance time: ${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      )
      .setColor(this.config.color?.green ?? "#00ff00")
      .setTimestamp();
    const ch = this.client.channels.cache.get(this.config.logch?.freeBotRoom);
    if (ch) ch.send({ embeds: [embed] });
    else console.error("channelFreeBotRoom not found");
  }

  // 新しいシーズンが始まったときの処理
  async handleNewSeasonStart() {
    const embed = new EmbedBuilder()
      .setAuthor({ name: "CLASH OF CLANS", iconURL: this.config.urlImage?.coc })
      .setTitle("NEW SEASON HAS STARTED")
      .setDescription("*The new season has started.*")
      .setColor(this.config.color?.green ?? "#00ff00")
      .setTimestamp();
    const ch = this.client.channels.cache.get(this.config.logch?.freeBotRoom);
    if (ch) ch.send({ embeds: [embed] });
    else console.error("❌ channelFreeBotRoom not found");
    await this.functions.sleep(30 * 1000);
    this.fLegend.autoUpdateLegendReset(this.client);
  }

  // プレイヤーのステータスが変化したときの処理の初期化
  async initializeTrophyPolling(pollingClient) {
    try {
      this.pollingClientTrophies = pollingClient;
      await this.pollingClientTrophies.init();
      console.log("⚙️ Trophy polling initialized (30s)");
      this.pollingClientTrophies.setPlayerEvent({
        name: "playerStatsChange",
        filter: (before, after) =>
          before.trophies !== after.trophies ||
          before.attackWins !== after.attackWins ||
          before.defenseWins !== after.defenseWins,
      });
      console.log("🔧 Registered playerStatsChange event filter");
      return this.pollingClientTrophies;
    } catch (error) {
      console.error("❌ Failed to initialize trophy polling:", error);
      throw error;
    }
  }

  // アカウントを更新
  async updateMonitoringAccounts() {
    try {
      const query = {
        status: true,
        $or: [
          { "legend.logSettings.post": { $in: ["channel", "dm"] } },
          { "leagueTier.id": config_coc.leagueId.legend },
          { "leagueTier.id": config_coc.leagueId.electro33 },
          { "leagueTier.id": config_coc.leagueId.electro32 },
          { "leagueTier.id": config_coc.leagueId.electro31 },
        ],
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
      const cursor = clientMongo
        .db("jwc")
        .collection("accounts")
        .find(query, options);
      const newAccountsLegend = await cursor.toArray();
      await cursor.close();
      const newTags = newAccountsLegend.map((a) => a.tag);
      const newTagsSet = new Set(newTags);
      if (this.pollingClientTrophies) {
        // 古いアカウントで新しいリストにないものをポーリングから削除
        const oldTags = this.accountsLegend.map((a) => a.tag);
        const removedTags = oldTags.filter((t) => !newTagsSet.has(t));
        if (removedTags.length > 0) {
          this.pollingClientTrophies.deletePlayers(removedTags);
        }
        // 新しいタグを追加
        if (newTags.length > 0) {
          this.pollingClientTrophies.addPlayers(newTags);
        }
      } else {
        console.warn(
          "pollingClientTrophies is not initialized; skip addPlayers",
        );
      }
      this.accountsLegend = newAccountsLegend;
      global.accountsLegend = newAccountsLegend;
      //console.log(`🔍 LEGEND ACCOUNTS MONITORING: ${newTags.length}`);
    } catch (error) {
      console.error("❌ Error updating monitoring accounts:", error);
    }
  }

  // プレイヤーのステータスが変化したときの処理
  handlePlayerStatsChange(beforePlayerStats, afterPlayerStats) {
    if (!this.accountsLegend || this.accountsLegend.length === 0) {
      console.log(
        `⚠️ accountsLegend not initialized; skip player stats change for tag: ${afterPlayerStats.tag}`,
      );
      return;
    }
    const currentDate = new Date();
    const seasonData = this.functions.calculateSeasonValues(
      this.client,
      currentDate,
    );
    const tagPlayer = afterPlayerStats.tag;
    const mongoAcc = this.accountsLegend.find((a) => a.tag === tagPlayer);
    if (!mongoAcc) {
      console.warn(
        `⚠️ mongoAcc not found in accountsLegend for tag=${tagPlayer}`,
      );
      return;
    }
    const pick = ({
      tag,
      name,
      townHallLevel,
      trophies,
      attackWins,
      defenseWins,
      leagueTier,
    }) => ({
      tag,
      name,
      townHallLevel,
      trophies,
      attackWins,
      defenseWins,
      leagueTier,
    });
    const beforeSlim = pick(beforePlayerStats);
    const afterSlim = pick(afterPlayerStats);
    try {
      this.fLegend.autoUpdateLegend(
        this.client,
        mongoAcc,
        beforeSlim,
        afterSlim,
        seasonData,
      );
    } catch (e) {
      console.error(`❌ autoUpdateLegend failed for ${tagPlayer}:`, e);
    }
    this.functions.updateStatusInfoLegend(this.client, seasonData);
  }

  // 5分ごとにアカウントを更新
  startAccountUpdateInterval() {
    const id = setInterval(
      () => {
        this.updateMonitoringAccounts();
      },
      5 * 60 * 1000,
    );
    return id;
  }

  // 初期化
  async initialize() {
    await this.updateMonitoringAccounts();
    this.setupPlayerStatsChangeListener();
    this.startAccountUpdateInterval();
  }

  // プレイヤーのステータス変化イベントのリスナー登録
  setupPlayerStatsChangeListener() {
    if (this.pollingClientTrophies) {
      console.log("🔧 Attaching playerStatsChange listener");
      this.pollingClientTrophies.on("playerStatsChange", (before, after) => {
        this.handlePlayerStatsChange(before, after);
      });
      console.log("🔧 Player stats change listener setup completed");
    } else {
      console.error("❌ pollingClientTrophies is not initialized");
    }
  }
}

(async function () {
  try {
    // Mongo 接続
    await clientMongo.connect();
    console.log("✅ connected to the Mongo database");
    client.clientMongo = clientMongo;

    const dbWeekNow = await fMongo.getWeekNowFromDb(clientMongo);
    if (dbWeekNow) {
      for (const key of Object.keys(appConfig.weekNow)) {
        if (dbWeekNow[key] != null) appConfig.weekNow[key] = dbWeekNow[key];
      }
      console.log("✅ weekNow loaded from DB:", appConfig.weekNow);
    } else {
      console.log("⚠️ weekNow not found in DB, using config default");
    }

    // コマンド・イベント
    const commandLoader = new CommandLoader(client);
    await commandLoader.loadAll();
    console.log("⚡ Commands and events loaded successfully");

    // CoC クライアント
    const clashOfClans = new ClashOfClans(appConfig);
    await clashOfClans.loginAll();
    clashOfClans.setupClient(client);
    console.log("✅ Clash of Clans initialized successfully");

    // PollingSystem
    const pollingSystem = new PollingSystem(
      client,
      appConfig,
      functions,
      fLegend,
    );
    const maintenancePolling = clashOfClans.createMaintenancePolling();
    await pollingSystem.initializeMaintenancePolling(maintenancePolling);
    const trophyPolling = clashOfClans.createTrophyPolling();
    await pollingSystem.initializeTrophyPolling(trophyPolling);
    await pollingSystem.initialize();
    console.log("✅ Polling system initialized successfully");

    // エラーハンドリング
    process.on("uncaughtException", (error) => {
      console.error(`❌ [${new Date().toISOString()}] ${error.stack}`);
      const embed = new EmbedBuilder()
        .setTitle("ERROR - uncaughtException")
        .setDescription("```\n" + error.stack + "\n```")
        .setColor("#ff0000")
        .setTimestamp();
      const channelError = client.channels.cache.get(appConfig.logch?.error);
      if (channelError) channelError.send({ embeds: [embed] });
    });
    process.on("unhandledRejection", (reason, promise) => {
      console.error(`❌ [${new Date().toISOString()}] ${reason}`, promise);
      const embed = new EmbedBuilder()
        .setTitle("ERROR - unhandledRejection")
        .setDescription("```\n" + reason + "\n```")
        .setColor("#ff0000")
        .setTimestamp();
      const channelError = client.channels.cache.get(appConfig.logch?.error);
      if (channelError) channelError.send({ embeds: [embed] });
    });

    await client.login(TOKEN);
  } catch (err) {
    console.error("❌ Initialization error:", err);
    process.exit(1);
  }
})();
