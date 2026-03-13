import { Events, EmbedBuilder, ActivityType } from "discord.js";
import config from "../config/config.js";
import * as fMongo from "../functions/fMongo.js";
import * as fCron from "../functions/fCron.js";
import cron from "node-cron";

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
        console.warn("ready channel not found or not text-based:", config.logch.ready);
      }
    } catch (e) {
      console.error("Failed to send ready embed:", e);
    }
    console.log(`✅ Logged in as ${client.user.tag}! ✅`);

    // JWC wars (config.cronWarStatus が "on" のリーグのみ実行)
    const cronWarSchedules = {
      j1: "*/2 * * * *",
      j2: "*/3 * * * *",
      swiss: "*/7 * * * *",
      mix: "*/5 * * * *",
      five: "*/1 * * * *",
    };
    for (const [league, schedule] of Object.entries(cronWarSchedules)) {
      if (config.cronWarStatus?.[league] === "on") {
        await cronWar(client, league, schedule);
      } else {
        console.log(`⏭️ cronWar skipped: ${league} (status: ${config.cronWarStatus?.[league] ?? "undefined"})`);
      }
    }

    // 13:58pm
    cron.schedule("00 58 04 * * *", async () => {
      await fMongo.legends200(client);
      console.log("END: fMongo.legends200");
    });

    // 2pm
    cron.schedule("00 00 05 * * *", async () => {
      await fCron.cronUpdate2pm(client);
      console.log("END: fCron.cronUpdate2pm");
    });

    // 毎週火曜 8:00（月曜 32:00：23:00 UTC）
    cron.schedule("00 00 23 * * 1", async () => {
      await fCron.rankedBattles(client);
      console.log("END: fCron.rankedBattles");
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
  const isRunning = {};
  isRunning[league] = false;

  cron.schedule(option, async () => {
    if (isRunning[league]) {
      console.error(`Skipping cronWar: ${league}`);
      return;
    }

    isRunning[league] = true;
    try {
      await fCron.cronWarAutoUpdate(client, league);
    } catch (error) {
      console.error("ERROR: ", error);
    } finally {
      isRunning[league] = false;
    }
  });
}
