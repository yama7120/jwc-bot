import { Events, EmbedBuilder, ActivityType } from 'discord.js';
import config from '../config/config.js';
import * as fMongo from '../functions/fMongo.js';
import * as fCron from '../functions/fCron.js';
import * as fLegend from '../functions/fLegend.js';
import * as fClanWarNotify from '../functions/fClanWarNotify.js';
import { reportError } from '../functions/errorReport.js';
import cron from 'node-cron';

const cronLocks = new Map();

export default {
  name: Events.ClientReady,
  once: true, // true -> 一度だけ

  async execute(client) {
    const guildCount = client.guilds.cache.size;
    client.user.setPresence({
      activities: [
        {
          name: `SEASON ${config.seasonNext.j1} | ${guildCount} servers `,
          type: ActivityType.Custom,
          //type: ActivityType.Watching
        },
      ],
      //status: 'online' // online, dnd, idle, invisible
    });

    const readyEmbed = new EmbedBuilder();
    readyEmbed.setTitle(`${config.emote.jwc} ONLINE`);
    readyEmbed.setDescription(`> JWC BOT IS READY NOW: ${guildCount} servers`);
    readyEmbed.setColor(config.color.main);
    readyEmbed.setTimestamp();

    try {
      const chReady =
        client.channels.cache.get(config.logch.ready) ||
        (await client.channels.fetch(config.logch.ready).catch(() => null));
      if (chReady?.isTextBased()) {
        await chReady.send({ embeds: [readyEmbed] });
      } else {
        console.warn('ready channel not found or not text-based:', config.logch.ready);
      }
    } catch (e) {
      console.error('Failed to send ready embed:', e);
    }
    console.log(`✅ Logged in as ${client.user.tag}! ✅`);

    // JWC wars (config.cronWarStatus が 'on' のリーグのみ実行)
    const cronWarSchedules = {
      j1: '*/2 * * * *',
      j2: '*/3 * * * *',
      swiss: '*/7 * * * *',
      mix: '*/5 * * * *',
      cup: '*/5 * * * *',
    };
    for (const [league, schedule] of Object.entries(cronWarSchedules)) {
      if (config.cronWarStatus?.[league] === 'on') {
        await cronWar(client, league, schedule);
      } else {
        console.log(`⏭️ cronWar skipped: ${league} (status: ${config.cronWarStatus?.[league] ?? 'undefined'})`);
      }
    }

    // legends200: 30分ごと（location 榜はバトルログでは Mongo のみ参照）
    scheduleCronWithGuard('legends200', '00 */30 * * * *', async () => {
      await fMongo.legends200(client);
      console.log('END: fMongo.legends200');
    });

    // 2pm (JST) - Legend I day boundary
    scheduleCronWithGuard('cronUpdate2pmLegend1', '00 00 05 * * *', async () => {
      await fCron.cronUpdate2pmLegend1(client);
      console.log('END: fCron.cronUpdate2pmLegend1');
    }, { timeoutMs: 45 * 60 * 1000 });

    // 月曜 08:00 JST (= 日曜 23:00 UTC) — ranked week end reminder (6h before Mon 14:00 JST reset)
    scheduleCronWithGuard(
      'rankedWeekEndReminder',
      '00 00 23 * * 0',
      async () => {
        await fLegend.cronRankedWeekEndReminder(client);
        console.log('END: fLegend.cronRankedWeekEndReminder');
      },
      { timeoutMs: 30 * 60 * 1000 },
    );

    // クラン対戦リマインダー（マッチング / 開始 / 終了 12h・3h・1h 前）
    scheduleCronWithGuard(
      'clanWarNotify',
      '*/5 * * * *',
      async () => {
        await fClanWarNotify.cronClanWarNotify(client);
        console.log('END: fClanWarNotify.cronClanWarNotify');
      },
      { timeoutMs: 10 * 60 * 1000 },
    );

    // 毎週月曜 15:00 JST (= 月曜 06:00 UTC) — leaguehistory を一括取得
    scheduleCronWithGuard('syncLeagueHistory', '00 00 06 * * 1', async () => {
      await fMongo.syncLeagueHistoryAll(client);
      console.log('END: fMongo.syncLeagueHistoryAll');
    });

    // legend reset day
    /*
    cron.schedule('00 01 05 27 01 *', async () => { // !! 毎月更新 !! 14:01
      await fCron.autoUpdateLegendResetDay(client);
    });
    */

    // legend reset
    /*
    cron.schedule('00 00 06 27 01 *', async () => { // !! 毎月更新 !! 15:00
      await fCron.autoUpdateLegendReset(client);
    });
    */

    // legend
    //let isRunningLegend = false;
    //cron.schedule('*/59 * * * * *', async () => {
    /*
      if (isRunningLegend) {
        const unixTimeLegendNow = Math.round(Date.now() / 1000);
        const content = `Skipping legend: ${unixTimeLegendNow - unixTimeLegendStart}`;
        console.error(content);
        client.channels.cache.get(config.logch.legend_old).send({ content });
        return;
      }

      isRunningLegend = true;
      try {
        const unixTimeLegendStart = Math.round(Date.now() / 1000);
        await fCron.cronLegend(client);
        const unixTimeLegendEnd = Math.round(Date.now() / 1000);
        const content = `end legend: ${unixTimeLegendEnd - unixTimeLegendStart} s`;
        client.channels.cache.get(config.logch.legend_old).send({ content });
      }
      catch (error) {
        console.error('ERROR: ', error);
      }
      finally {
        isRunningLegend = false;
      }
      */
    //});
  },
};

async function cronWar(client, league, option) {
  scheduleCronWithGuard(`cronWar:${league}`, option, async () => {
    await fCron.cronWarAutoUpdate(client, league);
  });
}

function scheduleCronWithGuard(jobName, expression, task, options = {}) {
  const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
  cron.schedule(expression, async () => {
    if (cronLocks.get(jobName)) {
      console.warn(`[CRON][SKIP] ${jobName} is still running`);
      return;
    }
    cronLocks.set(jobName, true);
    const startedAt = Date.now();
    try {
      await withTimeout(task(), timeoutMs, jobName);
      const elapsed = Date.now() - startedAt;
      void elapsed;
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      console.error(`[CRON][ERROR] ${jobName} (${elapsed} ms):`, error);
      await reportError(client, error, {
        source: `cron:${jobName}`,
        context: { cronJob: jobName },
      });
    } finally {
      cronLocks.set(jobName, false);
    }
  });
}

async function withTimeout(promise, timeoutMs, jobName) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `[CRON][TIMEOUT] ${jobName} exceeded ${timeoutMs} ms`,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
