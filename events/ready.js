const { Events, EmbedBuilder, ActivityType } = require("discord.js");

const config = require("../config.js");
const functions = require("../functions/functions.js");
const fMongo = require("../functions/fMongo.js");
const fCron = require("../functions/fCron.js");

const cron = require("node-cron");

module.exports = {
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

    client.channels.cache.get(config.logch.ready).send({
      embeds: [readyEmbed],
    });
    console.log(`Logged in as ${client.user.tag}!`);

    // JWC wars
    await cronWar(client, "j1", "*/2 * * * *");
    await cronWar(client, "j2", "*/3 * * * *");
    await cronWar(client, "swiss", "*/7 * * * *");
    await cronWar(client, "mix", "*/5 * * * *");
    await cronWar(client, "five", "*/33 * * * * *");

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

    // 毎週月曜 14:10
    cron.schedule("00 10 05 * * 1", async () => {
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
