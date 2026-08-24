import express from 'express';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
  Collection,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import schedule from './config/schedule.js';
import appConfig from './config/config.js';
import config_coc from './config/config_coc.js';
import * as functions from './functions/functions.js';
import {
  reportError,
  isIgnorableProcessError,
} from './functions/errorReport.js';
import {
  isHeavyCronRunning,
  getHeavyCronJob,
} from './functions/heavyCronGuard.js';
import * as fLegend from './functions/fLegend.js';
import * as fMongo from './functions/fMongo.js';
import { loadWeekNowFromDb, getWeekNowSnapshot } from './functions/weekNow.js';
import { fetchBattleLogItems } from './functions/fBattleLog.js';
import { post } from './functions/post.js';
import { handleGithubWebhook } from './functions/githubWebhook.js';
import {
  Client as ClientCoc,
  PollingClient,
  Util as CocUtil,
} from 'clashofclans.js';

let startupT0 = Date.now();

function formatDuration(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s (${ms}ms)`;
  return `${ms}ms`;
}

function sinceBoot() {
  return formatDuration(Date.now() - startupT0);
}

function logStartupBegin(label) {
  console.log(`⏳ ${label}... (+${sinceBoot()} since boot)`);
  return Date.now();
}

function logStartupPhase(label, startedAt, detail = '') {
  const ms = Date.now() - startedAt;
  const extra = detail ? ` | ${detail}` : '';
  console.log(
    `⏱️ ${label}: ${formatDuration(ms)}${extra} (+${sinceBoot()} since boot)`,
  );
}

// ====== ENV ======
const TOKEN = (process.env.BOT_TOKEN || '').trim();
const MONGO_URI = (process.env.mongoURI || '').trim();

if (!TOKEN) {
  console.error(
    '❌ DISCORD_TOKEN (or BOT_TOKEN) is empty. Set it in Replit Secrets.',
  );
  process.exit(1);
}

// --- Web server (healthcheck must respond before heavy init) ---
const app = express();
app.get('/', (_, res) => res.status(200).send('OK'));
app.get('/ok', (_, res) => res.status(200).json({ ok: true, ts: Date.now() }));

// GitHub Webhook（署名検証のため raw body が必要 — express.json より前に登録）
app.post(
  '/github/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      await handleGithubWebhook(req, res, client);
    } catch (e) {
      console.error('Error in /github/webhook:', e);
      if (client?.isReady?.()) {
        reportError(client, e, { source: 'http:github-webhook' }).catch(() => {});
      }
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  },
);

app.use(express.json());

// /post は POST のみ許可（他メソッドは 405）
app.all('/post', (req, res, next) => {
  if (req.method !== 'POST')
    return res.status(405).send('Method Not Allowed: use POST');
  next();
});
// 受信ハンドラ（最小版）—必要に応じてDBや各処理をここに
app.post('/post', async (req, res) => {
  try {
    // functions/post.jsのpost関数を呼び出し
    await post(req, res, client, req.body);
  } catch (e) {
    console.error('Error in /post:', e);
    reportError(client, e, { source: 'http:post' }).catch(() => {});
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () =>
  console.log(`🌐 Web server up on 0.0.0.0:${port} (PORT=${process.env.PORT ?? 'unset'})`),
);

const isDeployment =
  process.env.DEPLOYMENT === 'true' &&
  process.env.STARTUP_GUARD === 'your-random-long-string';

if (!isDeployment) {
  console.log('[GUARD] Bot startup blocked: Deployment-only mode.');
  process.exit(0);
}

// ====== MongoDB ======
import { MongoClient, ServerApiVersion } from 'mongodb';

const clientMongo = new MongoClient(MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

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

client.on('error', (error) => {
  if (isIgnorableProcessError(error)) {
    console.warn('[discord] ignorable client error:', error.message);
    return;
  }
  reportError(client, error, { source: 'discord:client' }).catch(() => {});
});
client.on('shardError', (error, shardId) => {
  if (isIgnorableProcessError(error)) {
    console.warn(
      `[discord] ignorable shardError (shard ${shardId}):`,
      error.message,
    );
    return;
  }
  reportError(client, error, {
    source: 'discord:shardError',
    extra: { shardId },
  }).catch(() => {});
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
    const commandsRoot = path.join(__dirname, 'commands');
    const commandFolders = fs
      .readdirSync(commandsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const folder of commandFolders) {
      const folderPath = path.join(commandsRoot, folder);
      const commandFiles = fs
        .readdirSync(folderPath)
        .filter((f) => f.endsWith('.js'));
      for (const file of commandFiles) {
        const fullPath = path.join(folderPath, file);
        try {
          const tFile = Date.now();
          const mod = await import(pathToFileURL(fullPath).href);
          const fileMs = Date.now() - tFile;
          const command = mod.default ?? mod;
          if (!command?.data?.name || typeof command?.execute !== 'function') {
            console.warn(`⚠️ Skipped ${file}: invalid command shape`);
            continue;
          }
          this.client.commands.set(command.data.name, command);
          const slowMark = fileMs >= 200 ? ` (${formatDuration(fileMs)})` : '';
          console.log(`🔧 loaded command: ${command.data.name}${slowMark}`);
        } catch (err) {
          console.error(`❌ Error loading command ${file}:`, err);
        }
      }
    }
    console.log(`⚡ Successfully loaded ${this.client.commands.size} commands`);
  }
  async loadEvents() {
    const eventsRoot = path.join(__dirname, 'events');
    const eventFiles = fs
      .readdirSync(eventsRoot)
      .filter((f) => f.endsWith('.js'));
    for (const file of eventFiles) {
      const fullPath = path.join(eventsRoot, file);
      try {
        const tFile = Date.now();
        const mod = await import(pathToFileURL(fullPath).href);
        const fileMs = Date.now() - tFile;
        const event = mod.default ?? mod;
        if (!event?.name || typeof event?.execute !== 'function') {
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
        console.log(
          `🔧 loaded event: ${event.name} (${file} ${formatDuration(fileMs)})`,
        );
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
const COC_EMAIL = (process.env.clashEmail || '').trim();
const COC_PW = (process.env.clashPW || '').trim();

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
    const t = logStartupBegin('coc loginMain');
    this.clientCoc = new ClientCoc();
    this.apiKey = await this.clientCoc.login({
      email: COC_EMAIL,
      password: COC_PW,
      keyName: 'replit_main',
    });
    logStartupPhase('coc loginMain', t);
    console.log(`✅ LOGGED IN: clientCoc`);
    return this.clientCoc;
  }
  async loginLegend() {
    const t = logStartupBegin('coc loginLegend');
    this.clientCocLegend = new ClientCoc();
    this.apiKeyLegend = await this.clientCocLegend.login({
      email: COC_EMAIL,
      password: COC_PW,
      keyName: 'replit_legend',
    });
    logStartupPhase('coc loginLegend', t);
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
    if (!this.apiKey) throw new Error('❌ Main CoC client not logged in');
    const pollingClient = new PollingClient({ keys: [this.apiKey] });
    pollingClient.pollingInterval = 60000;
    return pollingClient;
  }
  createTrophyPolling() {
    if (!this.apiKey) throw new Error('❌ Main CoC client not logged in');
    const pollingClient = new PollingClient({ keys: [this.apiKey] });
    pollingClient.pollingInterval = 60000;
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
    this.accountsLegendReady = false;
    this.playerUpdateLocks = new Set();
    this.lastLegendStatusUpdateMs = 0;
    this.lastBattleLogSweepMsByTag = new Map();
    this.battleLogSweepFailStreakByTag = new Map();
    this.battleLogSweepBackoffUntilByTag = new Map();
    this.battleLogSweepRunning = false;
    this.battleLogSweepPausedUntil = 0;
  }

  sanitizeTagForBattleLogSweep(rawTag) {
    if (typeof rawTag !== 'string') return null;
    const compact = rawTag.replace(/\s+/g, '');
    if (!compact) return null;
    return this.functions.tagReplacer(compact);
  }

  formatBattleLogSweepError(err) {
    const parts = [];
    if (err?.reason) parts.push(String(err.reason));
    if (err?.status) parts.push(`status=${err.status}`);
    if (err?.message) parts.push(String(err.message));
    return parts.length > 0 ? parts.join(' | ') : String(err);
  }

  isTransientNetworkError(err) {
    const msg = this.formatBattleLogSweepError(err);
    return /Connect Timeout|ETIMEDOUT|EPIPE|ECONNRESET|ECONNREFUSED|UND_ERR|other side closed|socket hang up|fetch failed/i.test(
      msg,
    );
  }

  // メンテナンスの処理の初期化
  async initializeMaintenancePolling(pollingClient) {
    const t = logStartupBegin('maintenance polling init');
    try {
      this.pollingClientMaintenance = pollingClient;
      await this.pollingClientMaintenance.init();
      logStartupPhase('maintenance polling init', t);
      console.log('⚙️ Maintenance polling initialized (60s)');
      this.pollingClientMaintenance.on('maintenanceStart', () => {
        this.handleMaintenanceStart();
      });
      this.pollingClientMaintenance.on(
        'maintenanceEnd',
        (durationInMiliSec) => {
          this.handleMaintenanceEnd(durationInMiliSec);
        },
      );
      this.pollingClientMaintenance.on('newSeasonStart', async () => {
        await this.handleNewSeasonStart();
      });
      return this.pollingClientMaintenance;
    } catch (error) {
      console.error('❌ Failed to initialize maintenance polling:', error);
      throw error;
    }
  }

  // メンテナンスが始まったときの処理
  handleMaintenanceStart() {
    const now = Date.now();
    if (now - this.lastMaintenanceStart < 2 * 60 * 1000) return;
    this.lastMaintenanceStart = now;
    const embed = new EmbedBuilder()
      .setAuthor({ name: 'CLASH OF CLANS', iconURL: this.config.urlImage?.coc })
      .setTitle('MAINTENANCE HAS STARTED')
      .setDescription('*The game is under maintenance.*')
      .setColor(this.config.color?.red ?? '#ff0000')
      .setTimestamp();
    const ch = this.client.channels.cache.get(this.config.logch?.freeBotRoom);
    if (ch) {
      ch.send({ embeds: [embed] }).catch((e) =>
        reportError(this.client, e, { source: 'maintenanceStart:notify' }),
      );
    } else console.error('❌ channelFreeBotRoom not found');
  }

  // メンテナンスが終わったときの処理
  handleMaintenanceEnd(durationInMiliSec) {
    const now = Date.now();

    // 重複防止: 2分以内の重複通知を防ぐ
    if (now - this.lastMaintenanceEnd < 2 * 60 * 1000) {
      console.log(
        '⚠️ Maintenance end notification skipped (duplicate prevention)',
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
      .setAuthor({ name: 'CLASH OF CLANS', iconURL: this.config.urlImage?.coc })
      .setTitle(':white_check_mark: MAINTENANCE HAS ENDED')
      .setDescription(
        `Maintenance time: ${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      )
      .setColor(this.config.color?.green ?? '#00ff00')
      .setTimestamp();
    const ch = this.client.channels.cache.get(this.config.logch?.freeBotRoom);
    if (ch) {
      ch.send({ embeds: [embed] }).catch((e) =>
        reportError(this.client, e, { source: 'maintenanceEnd:notify' }),
      );
    } else console.error('channelFreeBotRoom not found');
  }

  // 新しいシーズンが始まったときの処理
  async handleNewSeasonStart() {
    const embed = new EmbedBuilder()
      .setAuthor({ name: 'CLASH OF CLANS', iconURL: this.config.urlImage?.coc })
      .setTitle('NEW SEASON HAS STARTED')
      .setDescription('*The new season has started.*')
      .setColor(this.config.color?.green ?? '#00ff00')
      .setTimestamp();
    const ch = this.client.channels.cache.get(this.config.logch?.freeBotRoom);
    if (ch) {
      ch.send({ embeds: [embed] }).catch((e) =>
        reportError(this.client, e, { source: 'newSeason:notify' }),
      );
    } else console.error('❌ channelFreeBotRoom not found');
    await this.functions.sleep(30 * 1000);
    this.fLegend.autoUpdateLegendReset(this.client).catch((e) =>
      reportError(this.client, e, { source: 'newSeason:legendReset' }),
    );
  }

  // プレイヤーのステータスが変化したときの処理の初期化
  async initializeTrophyPolling(pollingClient) {
    const t = logStartupBegin('trophy polling init');
    try {
      this.pollingClientTrophies = pollingClient;
      await this.pollingClientTrophies.init();
      logStartupPhase('trophy polling init', t);
      console.log('⚙️ Trophy polling initialized (60s)');
      this.pollingClientTrophies.setPlayerEvent({
        name: 'playerStatsChange',
        filter: (before, after) =>
          before.trophies !== after.trophies ||
          before.attackWins !== after.attackWins ||
          before.defenseWins !== after.defenseWins ||
          before.leagueTier?.id !== after.leagueTier?.id ||
          before.currentLeagueSeasonId !== after.currentLeagueSeasonId ||
          before.currentLeagueGroupTag !== after.currentLeagueGroupTag,
      });
      console.log('🔧 Registered playerStatsChange event filter');
      return this.pollingClientTrophies;
    } catch (error) {
      console.error('❌ Failed to initialize trophy polling:', error);
      throw error;
    }
  }

  getMonitoringAccountsQuery() {
    return {
      status: true,
      $or: [
        { 'legend.logSettings.post': { $in: ['channel', 'dm'] } },
        { 'leagueTier.id': config_coc.leagueId.legend },
        { 'leagueTier.id': config_coc.leagueId.legend2 },
        { 'leagueTier.id': config_coc.leagueId.legend3 },
        { 'leagueTier.id': config_coc.leagueId.electro33 },
        { 'leagueTier.id': config_coc.leagueId.electro32 },
        { 'leagueTier.id': config_coc.leagueId.electro31 },
      ],
    };
  }

  getMonitoringAccountsProjection(mode = 'full') {
    if (mode === 'tags') {
      return { _id: 0, tag: 1 };
    }
    return {
      _id: 0,
      tag: 1,
      'legend.logSettings': 1,
      'legend.events': 1,
      'legend.weeks': 1,
      'legend.current': 1,
      'legend.lastRankedSeasonId': 1,
      legendStatistics: 1,
      'leagueTier.id': 1,
      'pilotDC.id': 1,
      name: 1,
      townHallLevel: 1,
    };
  }

  async fetchMonitoringAccountsFromMongo(mode = 'full') {
    const label = mode === 'tags' ? 'tags only' : 'full';
    console.log(
      `⏳ mongo accounts find start (${label})... (+${sinceBoot()} since boot)`,
    );
    const tMongo = Date.now();
    const maxAttempts = 3;
    let accounts;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const cursor = clientMongo
        .db('jwc')
        .collection('accounts')
        .find(this.getMonitoringAccountsQuery(), {
          projection: this.getMonitoringAccountsProjection(mode),
          maxTimeMS: 60_000,
          batchSize: 200,
        });
      try {
        accounts = await cursor.toArray();
        await cursor.close().catch(() => {});
        break;
      } catch (error) {
        await cursor.close().catch(() => {});
        const cursorGone =
          error?.code === 43 ||
          /cursor id .* not found/i.test(String(error?.message ?? ''));
        if (!cursorGone || attempt === maxAttempts) throw error;
        console.warn(
          `⚠️ mongo accounts find cursor expired (${label}), retry ${attempt}/${maxAttempts - 1}`,
        );
      }
    }
    const mongoMs = Date.now() - tMongo;
    console.log(
      `✅ mongo accounts find done (${label}): ${accounts.length} docs in ${formatDuration(mongoMs)} (+${sinceBoot()} since boot)`,
    );
    return accounts;
  }

  async syncPollingPlayers(newTags) {
    const newTagsSet = new Set(newTags);
    if (!this.pollingClientTrophies) {
      console.warn('pollingClientTrophies is not initialized; skip addPlayers');
      return;
    }
    const oldTags = this.accountsLegend.map((a) => a.tag);
    const oldTagsSet = new Set(oldTags);
    const removedTags = oldTags.filter((t) => !newTagsSet.has(t));
    const addedTags = newTags.filter((t) => !oldTagsSet.has(t));
    if (removedTags.length > 0) {
      const tDel = Date.now();
      this.pollingClientTrophies.deletePlayers(removedTags);
      console.log(
        `🗑️ deletePlayers done: ${removedTags.length} players in ${Date.now() - tDel}ms`,
      );
    }
    if (newTags.length > 0) {
      const newLabel =
        oldTags.length === 0
          ? 'initial load'
          : `${addedTags.length} new / ${newTags.length} total`;
      console.log(`⏳ addPlayers start: ${newTags.length} players (${newLabel})`);
      const tAdd = Date.now();
      await this.pollingClientTrophies.addPlayers(newTags);
      const addMs = Date.now() - tAdd;
      console.log(
        `✅ addPlayers done: ${newTags.length} players in ${(addMs / 1000).toFixed(1)}s (${addMs}ms)`,
      );
    } else {
      console.log('ℹ️ addPlayers skipped: 0 players');
    }
  }

  // アカウントを更新
  async updateMonitoringAccounts({
    mode = 'full',
    syncPolling = true,
  } = {}) {
    const t0 = Date.now();
    try {
      const accounts = await this.fetchMonitoringAccountsFromMongo(mode);
      const newTags = accounts.map((a) => a.tag);
      if (syncPolling) {
        await this.syncPollingPlayers(newTags);
      }
      if (mode === 'full') {
        this.accountsLegend = accounts;
        global.accountsLegend = accounts;
        this.accountsLegendReady = true;
      }
      console.log(
        `📋 monitoring accounts update done (${mode}): ${newTags.length} total in ${formatDuration(Date.now() - t0)}`,
      );
    } catch (error) {
      console.error('❌ Error updating monitoring accounts:', error);
    }
  }

  async loadFullMonitoringAccounts() {
    await this.updateMonitoringAccounts({ mode: 'full', syncPolling: false });
  }

  // プレイヤーのステータスが変化したときの処理
  async handlePlayerStatsChange(beforePlayerStats, afterPlayerStats) {
    const tagPlayer = afterPlayerStats.tag;
    if (!this.accountsLegendReady) {
      return;
    }
    if (!this.accountsLegend || this.accountsLegend.length === 0) {
      console.log(
        `⚠️ accountsLegend not initialized; skip player stats change for tag: ${afterPlayerStats.tag}`,
      );
      return;
    }
    const currentDate = new Date();
    // Legend I は JST 14:00 (= UTC 05:00) 切替、その他は JST 02:00 (= UTC 17:00)
    const boundaryUtcHour =
      afterPlayerStats?.leagueTier?.id === config_coc.leagueId.legend ? 5 : 17;
    const seasonData = this.functions.calculateSeasonValues(
      this.client,
      currentDate,
      boundaryUtcHour,
    );
    if (this.playerUpdateLocks.has(tagPlayer)) {
      return;
    }
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
      currentLeagueSeasonId,
      previousLeagueSeasonId,
      currentLeagueGroupTag,
      previousLeagueGroupTag,
    }) => ({
      tag,
      name,
      townHallLevel,
      trophies,
      attackWins,
      defenseWins,
      leagueTier,
      currentLeagueSeasonId,
      previousLeagueSeasonId,
      currentLeagueGroupTag,
      previousLeagueGroupTag,
    });
    const beforeSlim = {
      ...pick(beforePlayerStats),
      legendStatistics: fLegend.legendStatisticsForNotify(beforePlayerStats),
    };
    const afterSlim = {
      ...pick(afterPlayerStats),
      legendStatistics: fLegend.legendStatisticsForNotify(afterPlayerStats),
    };
    this.playerUpdateLocks.add(tagPlayer);
    try {
      let battleLogItems = null;
      try {
        if (this.client?.clientCoc) {
          battleLogItems = await fetchBattleLogItems(
            this.client.clientCoc,
            tagPlayer,
          );
        } else {
          console.warn(
            `⚠️ clientCoc unavailable; skip battle log fetch for ${tagPlayer}`,
          );
        }
      } catch (blErr) {
        console.warn(
          `⚠️ battle log fetch failed (${tagPlayer}):`,
          blErr?.message ?? blErr,
        );
        battleLogItems = null;
      }
      await this.fLegend.autoUpdateLegend(
        this.client,
        mongoAcc,
        beforeSlim,
        afterSlim,
        seasonData,
        battleLogItems,
      );
    } catch (e) {
      console.error(`❌ autoUpdateLegend failed for ${tagPlayer}:`, e);
    } finally {
      this.playerUpdateLocks.delete(tagPlayer);
    }
    const now = Date.now();
    if (now - this.lastLegendStatusUpdateMs >= 15 * 1000) {
      this.lastLegendStatusUpdateMs = now;
      await this.functions.updateStatusInfoLegend(this.client, seasonData);
    }
  }

  // 5分ごとにアカウントを更新
  startAccountUpdateInterval() {
    const id = setInterval(() => {
      if (isHeavyCronRunning()) {
        console.log(
          `⏭️ monitoring accounts update deferred (heavy cron: ${getHeavyCronJob()})`,
        );
        return;
      }
      this.updateMonitoringAccounts().catch((e) =>
        reportError(this.client, e, { source: 'polling:updateAccounts' }),
      );
    }, 5 * 60 * 1000);
    return id;
  }

  // statsChange が飛んでも飛ばなくても battlelog 新規行が本線。
  // トロフィー0変動の防衛など statsChange 欠落を定期 sweep で拾う。
  startBattleLogSweepInterval() {
    const intervalMs = 60 * 1000; // 1分
    const perTagCooldownMs = 2 * 60 * 1000; // 同一タグは2分に1回まで
    const maxTagsPerTick = 20;
    const globalPauseMs = 4 * 60 * 1000;
    const id = setInterval(async () => {
      if (this.battleLogSweepRunning) return;
      try {
        this.battleLogSweepRunning = true;
        if (!this.client?.clientCoc) return;
        if (!Array.isArray(this.accountsLegend) || this.accountsLegend.length === 0) return;
        if (isHeavyCronRunning()) return;
        const tickNow = Date.now();
        if (tickNow < this.battleLogSweepPausedUntil) return;

        let processed = 0;
        let failCount = 0;
        let lastFailMsg = '';
        let pausedForNetwork = false;

        for (const mongoAcc of this.accountsLegend) {
          if (processed >= maxTagsPerTick) break;

          const tag = mongoAcc?.tag;
          if (!tag) continue;
          if (this.playerUpdateLocks.has(tag)) continue;

          const now = Date.now();
          const backoffUntil = Number(this.battleLogSweepBackoffUntilByTag.get(tag) ?? 0);
          if (now < backoffUntil) continue;

          const last = Number(this.lastBattleLogSweepMsByTag.get(tag) ?? 0);
          if (now - last < perTagCooldownMs) continue;

          const apiTag = this.sanitizeTagForBattleLogSweep(tag);
          if (!apiTag) {
            console.warn(`⚠️ battlelog sweep skipped invalid tag: ${tag}`);
            this.battleLogSweepBackoffUntilByTag.set(tag, now + 30 * 60 * 1000);
            continue;
          }

          processed += 1;
          this.lastBattleLogSweepMsByTag.set(tag, now);
          this.playerUpdateLocks.add(tag);
          try {
            const scPlayer = await this.client.clientCoc.getPlayer(apiTag);
            const boundaryUtcHour =
              scPlayer?.leagueTier?.id === config_coc.leagueId.legend ? 5 : 17;
            const seasonData = this.functions.calculateSeasonValues(
              this.client,
              new Date(),
              boundaryUtcHour,
            );
            const battleLogItems = await fetchBattleLogItems(this.client.clientCoc, apiTag);

            // 「変動が無いから before/after が無い」ケース向けに、after を両方渡して battlelog 差分だけ処理させる
            const pick = ({
              tag,
              name,
              townHallLevel,
              trophies,
              attackWins,
              defenseWins,
              leagueTier,
              currentLeagueSeasonId,
              previousLeagueSeasonId,
              currentLeagueGroupTag,
              previousLeagueGroupTag,
            }) => ({
              tag,
              name,
              townHallLevel,
              trophies,
              attackWins,
              defenseWins,
              leagueTier,
              currentLeagueSeasonId,
              previousLeagueSeasonId,
              currentLeagueGroupTag,
              previousLeagueGroupTag,
            });
            const afterSlim = {
              ...pick(scPlayer),
              legendStatistics: fLegend.legendStatisticsForNotify(scPlayer),
            };

            await this.fLegend.autoUpdateLegend(
              this.client,
              mongoAcc,
              afterSlim,
              afterSlim,
              seasonData,
              battleLogItems,
            );
            this.battleLogSweepFailStreakByTag.delete(tag);
            this.battleLogSweepBackoffUntilByTag.delete(tag);
          } catch (e) {
            const streak = (this.battleLogSweepFailStreakByTag.get(tag) ?? 0) + 1;
            this.battleLogSweepFailStreakByTag.set(tag, streak);
            const backoffMs = Math.min(
              30 * 60 * 1000,
              perTagCooldownMs * (2 ** Math.min(streak, 4)),
            );
            this.battleLogSweepBackoffUntilByTag.set(tag, now + backoffMs);
            failCount += 1;
            lastFailMsg = this.formatBattleLogSweepError(e);
            if (this.isTransientNetworkError(e)) {
              this.battleLogSweepPausedUntil = Date.now() + globalPauseMs;
              pausedForNetwork = true;
              break;
            }
          } finally {
            this.playerUpdateLocks.delete(tag);
          }
        }

        if (failCount > 0) {
          const pauseNote = pausedForNetwork
            ? `; global pause ${Math.round(globalPauseMs / 1000)}s`
            : '';
          console.warn(
            `⚠️ battlelog sweep: ${failCount} failed / ${processed} tried (${lastFailMsg})${pauseNote}`,
          );
        }
      } catch (e) {
        console.warn('⚠️ battlelog sweep loop error:', e?.message ?? e);
        reportError(this.client, e, { source: 'polling:battleLogSweep' }).catch(
          () => {},
        );
      } finally {
        this.battleLogSweepRunning = false;
      }
    }, intervalMs);
    return id;
  }

  // 初期化（tag のみ取得して addPlayers、詳細は loadFullMonitoringAccounts で後読み）
  async initialize() {
    await this.updateMonitoringAccounts({ mode: 'tags' });
    this.setupPlayerStatsChangeListener();
    this.startAccountUpdateInterval();
    this.startBattleLogSweepInterval();
  }

  // プレイヤーのステータス変化イベントのリスナー登録
  setupPlayerStatsChangeListener() {
    if (this.pollingClientTrophies) {
      console.log('🔧 Attaching playerStatsChange listener');
      this.pollingClientTrophies.on('playerStatsChange', (before, after) => {
        this.handlePlayerStatsChange(before, after).catch((e) =>
          reportError(this.client, e, {
            source: 'polling:playerStatsChange',
            extra: { tag: after?.tag },
          }),
        );
      });
      console.log('🔧 Player stats change listener setup completed');
    } else {
      console.error('❌ pollingClientTrophies is not initialized');
    }
  }
}

(async function () {
  startupT0 = Date.now();
  console.log('⏳ startup: heavy init begin');
  try {
    // Mongo 接続
    let t = logStartupBegin('mongo connect');
    await clientMongo.connect();
    logStartupPhase('mongo connect', t);
    console.log('✅ connected to the Mongo database');
    client.clientMongo = clientMongo;

    t = logStartupBegin('mongo indexes');
    await fMongo.ensureClansIndexes(clientMongo);
    logStartupPhase('mongo indexes', t);

    t = logStartupBegin('weekNow load');
    const weekNowLoaded = await loadWeekNowFromDb(clientMongo);
    logStartupPhase('weekNow load', t);
    if (Object.keys(weekNowLoaded).length > 0) {
      console.log('✅ weekNow loaded from DB:', getWeekNowSnapshot());
    } else {
      console.log('⚠️ weekNow not found in DB');
    }

    // コマンド・イベント
    const commandLoader = new CommandLoader(client);
    t = logStartupBegin('load commands');
    await commandLoader.loadCommands();
    logStartupPhase('load commands', t, `${client.commands.size} commands`);
    t = logStartupBegin('load events');
    await commandLoader.loadEvents();
    logStartupPhase('load events', t);
    console.log('⚡ Commands and events loaded successfully');

    // CoC クライアント
    const clashOfClans = new ClashOfClans(appConfig);
    t = logStartupBegin('coc loginAll');
    await clashOfClans.loginAll();
    logStartupPhase('coc loginAll', t);
    clashOfClans.setupClient(client);
    console.log('✅ Clash of Clans initialized successfully');

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
    t = logStartupBegin('polling system initialize');
    await pollingSystem.initialize();
    logStartupPhase('polling system initialize', t);
    console.log('✅ Polling system initialized successfully');

    // エラーハンドリング
    process.on('uncaughtException', (error) => {
      if (isIgnorableProcessError(error)) {
        console.warn('[uncaughtException] ignorable:', error.message);
        return;
      }
      reportError(client, error, { source: 'uncaughtException' });
    });
    process.on('unhandledRejection', (reason) => {
      if (isIgnorableProcessError(reason)) {
        console.warn(
          '[unhandledRejection] ignorable:',
          reason instanceof Error ? reason.message : reason,
        );
        return;
      }
      reportError(client, reason, { source: 'unhandledRejection' });
    });

    t = logStartupBegin('discord login');
    await client.login(TOKEN);
    logStartupPhase('discord login', t);
    console.log(`✅ startup complete (+${sinceBoot()} since boot)`);

    pollingSystem.loadFullMonitoringAccounts().catch((e) => {
      console.error('❌ Background full monitoring accounts load failed:', e);
      reportError(client, e, { source: 'startup:accountsFullLoad' }).catch(
        () => {},
      );
    });
  } catch (err) {
    console.error('❌ Initialization error:', err);
    reportError(client, err, { source: 'startup' }).catch(() => {});
    // Keep the healthcheck server alive so deployment logs stay reachable.
  }
})();
