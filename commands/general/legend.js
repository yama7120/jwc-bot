import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import config from "../../config/config.js";
import config_coc from "../../config/config_coc.js";
import * as functions from "../../functions/functions.js";
import * as fCanvas from "../../functions/fCanvas.js";
import * as fCron from "../../functions/fCron.js";
import * as fLegend from "../../functions/fLegend.js";


const nameCommand = "legend";
let data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription("no description")
  .addSubcommand(subcommand =>
    subcommand
      .setName("stats")
      .setDescription(config.command[nameCommand].subCommand["stats"])
      .addStringOption(option =>
        option
          .setName("account")
          .setDescription("プレイヤータグ")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName("day")
          .setDescription("日（デフォルトは今日）")
          .addChoices(
            { name: "前日", value: "previous" },
            { name: "今日", value: "current" },
          )
      )
  )
  .addSubcommandGroup(subcommandgroup =>
    subcommandgroup
      .setName("history")
      .setDescription("no description")
      .addSubcommand(subcommand =>
        subcommand
          .setName("own")
          .setDescription(config.command[nameCommand].subCommandGroup["history"]["own"])
          .addStringOption(option =>
            option
              .setName("account")
              .setDescription("プレイヤータグ")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName("any")
          .setDescription(config.command[nameCommand].subCommandGroup["history"]["any"])
          .addStringOption(option =>
            option
              .setName("league")
              .setDescription("リーグ")
              .setRequired(true)
          )
          .addStringOption(option =>
            option
              .setName("team")
              .setDescription("チーム")
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addStringOption(option =>
            option
              .setName("account")
              .setDescription("プレイヤータグ")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName("top25")
          .setDescription(config.command[nameCommand].subCommandGroup["history"]["top25"])
          .addStringOption(option =>
            option
              .setName("account")
              .setDescription("プレイヤータグ")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("settings")
      .setDescription(config.command[nameCommand].subCommand["settings"])
      .addStringOption(option =>
        option
          .setName("account")
          .setDescription("プレイヤータグ")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName("attacks")
          .setDescription("攻撃結果通知")
          .addChoices(
            { name: "[all] 全て通知する（当該の結果のみ表示）", value: "all" },
            { name: "[false] 通知しない", value: "false" },
          )
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("defenses")
          .setDescription("防衛結果通知")
          .addChoices(
            { name: "[all] 全て通知する（当該の結果のみ表示）", value: "all" },
            { name: "[non-tripled] 防衛成功のみ通知する（当該の結果のみ表示）", value: "non-tripled" },
            { name: "[false] 通知しない", value: "false" },
          )
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("result")
          .setDescription("1日の結果通知")
          .addChoices(
            { name: "[true] 通知する", value: "true" },
            { name: "[false] 通知しない", value: "false" },
          )
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("post")
          .setDescription("通知先")
          .addChoices(
            { name: "[this_channel] このチャンネル", value: "channel" },
            { name: "[dm] DM", value: "dm" },
            { name: "[false] 通知しない", value: "NA" },
          )
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("japan_local")
      .setDescription(config.command[nameCommand].subCommand["japan_local"])
      .addIntegerOption(option =>
        option
          .setName("n_display")
          .setDescription("表示数（デフォルト：25）")
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("global")
      .setDescription(config.command[nameCommand].subCommand["global"])
      .addIntegerOption(option =>
        option
          .setName("n_display")
          .setDescription("表示数（デフォルト：25）")
      )
  );
config.choices.league4.forEach(choice => {
  data.options[1].options[1].options[0].addChoices(choice);
});
const choices_nDisplay = [
  { name: "10", value: 10 },
  { name: "50", value: 50 },
  { name: "100", value: 100 },
  { name: "200", value: 200 },
];
choices_nDisplay.forEach(choice => {
  data.options[3].options[0].addChoices(choice);
  data.options[4].options[0].addChoices(choice);
});

export default {
  data: data,

  async autocomplete(interaction, client) {
    let subCommand = interaction.options.getSubcommand();
    let subCommandGroup = interaction.options.getSubcommandGroup();
    let focusedOption = interaction.options.getFocused(true);
    let focusedValue = interaction.options.getFocused();
    
    if (focusedOption.name === "account") {
      // クエリ設定のマッピング
      const queryConfigs = {
        "stats": () => ({
          query: { "pilotDC.id": interaction.user.id, status: { $ne: false } },
          options: { projection: { _id: 0, tag: 1, name: 1, townHallLevel: 1 } },
          sort: { townHallLevel: -1 }
        }),
        "settings": () => ({
          query: { "pilotDC.id": interaction.user.id, status: { $ne: false } },
          options: { projection: { _id: 0, tag: 1, name: 1, townHallLevel: 1 } },
          sort: { townHallLevel: -1 }
        }),
        "history-own": () => ({
          query: { "pilotDC.id": interaction.user.id, status: { $ne: false } },
          options: { projection: { _id: 0, tag: 1, name: 1, townHallLevel: 1 } },
          sort: { townHallLevel: -1 }
        }),
        "history-top25": () => ({
          query: { status: { $ne: false } },
          options: { projection: { _id: 0, tag: 1, name: 1, townHallLevel: 1 } },
          sort: { trophies: -1 }
        }),
        "history-any": async () => {
          const iLeague = await interaction.options.getString("league");
          const teamAbbr = await interaction.options.getString("team");
          
          const leagueQueryMap = {
            "entire": {},
            "j1": { "homeClanAbbr.j": teamAbbr },
            "j2": { "homeClanAbbr.j": teamAbbr },
            "swiss": { "homeClanAbbr.swiss": teamAbbr },
            "mix": { "homeClanAbbr.mix": teamAbbr }
          };
          
          return {
            query: leagueQueryMap[iLeague] || {},
            options: { projection: { _id: 0, tag: 1, name: 1, townHallLevel: 1 } },
            sort: { townHallLevel: -1, name: 1 }
          };
        }
      };

      const configKey = subCommandGroup ? `${subCommandGroup}-${subCommand}` : `${subCommand}`;
      const config = queryConfigs[configKey];
      
      if (config) {
        const { query, options, sort } = await config();
        const cursor = client.clientMongo.db("jwc").collection("accounts")
          .find(query, options)
          .sort(sort)
          .limit(25);
        
        const accs = await cursor.toArray();
        await cursor.close();
        
        const filteredAccs = accs.filter(acc => 
          String(acc.name).includes(focusedValue)
        );
        
        if (filteredAccs.length > 0) {
          await interaction.respond(filteredAccs.map(acc => ({
            name: `[TH${acc.townHallLevel}] ${acc.name}`,
            value: acc.tag
          })));
        }
      }
    }
    else if (focusedOption.name === "team") {
      const focusedValue = interaction.options.getFocused();
      const iLeague = await interaction.options.getString("league");
      let teamList = await client.clientMongo.db("jwc").collection("config").findOne(
        { _id: "teamList" },
        { projection: { [iLeague]: 1, _id: 0 } }
      );

      if (!teamList) {
        await interaction.respond([{ name: "ERROR", value: "error" }]);
      }
      
      if (iLeague == "entire") {
        await interaction.respond([{ name: "ENTIRE JWC BOT", value: "entire" }]);
      }
      else {
        teams = teamList[iLeague].filter(function(team) { return team.team_abbr.includes(focusedValue) });
        if (teams.length >= 25) {
          teams = teams.filter(function(clan, index) { return index < 25 });
        };
        await interaction.respond(teams.map(team => ({
          name: `${team.team_abbr.toUpperCase()}: ${team.clan_name} | ${team.team_name}`,
          value: team.team_abbr
        })));
      };
    };
  },

  async execute(interaction, client) {
    if (interaction.options.getSubcommand() == "stats") {
      stats(interaction, client);
    }
    else if (interaction.options.getSubcommandGroup() == "history") {
      history(interaction, client.clientMongo);
    }
    else if (interaction.options.getSubcommand() == "japan_local") {
      japanLocal(interaction, client);
    }
    else if (interaction.options.getSubcommand() == "global") {
      global(interaction, client);
    }
    else if (interaction.options.getSubcommand() == "settings") {
      settings(interaction, client);
    };
    return;
  }
}

async function settings(interaction, client) {
  const iPlayerTag = await interaction.options.getString("account");
  const mongoAcc = await client.clientMongo.db("jwc").collection("accounts").findOne(
    { tag: iPlayerTag },
    { projection: { legend: 1, pilotDC: 1, _id: 0 } }
  );

  if (!mongoAcc || interaction.user.id !== mongoAcc.pilotDC?.id) {
    const pilot = mongoAcc?.pilotDC?.id == null ? "unknown" : `<@!${mongoAcc.pilotDC?.id}>`;
    const content = [
      "There was an issue with your account operation. Please check the following steps:",
      `1. Register your account: </register_acc new:${config.command.register_acc.id}>`,
      `2. Link your account to Discord: </link_account_to_discord new:${config.command.link_account_to_discord.id}>`,
      "*You can only operate accounts that are registered and linked.*",
      "*You can only retrieve logs for your own linked account.*",
      "",
      `tag: ${iPlayerTag}`,
      `pilot: ${pilot}`
    ].join("\n");

    await interaction.followUp({ content, ephemeral: true });
    return;
  };

  let title = "";
  let description = "";
  let embed = new EmbedBuilder();
  embed.setColor(config.color.legend);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  embed.setTimestamp();

  let resultScan = await functions.scanAcc(client.clientCoc, iPlayerTag);
  title = await functions.getAccInfoTitle(resultScan.scPlayer);
  description += await functions.getAccInfoDescriptionMain(resultScan.scPlayer, "long");
  let iSettingsAttacks = await interaction.options.getString("attacks");
  let iSettingsDefenses = await interaction.options.getString("defenses");
  let iSettingsResult = await interaction.options.getString("result");
  let iSettingsPost = await interaction.options.getString("post");
  let iSettingsChannelId = null;
  if (iSettingsPost == "dm") {
    iSettingsChannelId = null;
  }
  else if (iSettingsPost == "channel") {
    iSettingsChannelId = interaction.channel.id;
  };

  const logSettings = { attacks: iSettingsAttacks, defenses: iSettingsDefenses, result: iSettingsResult, post: iSettingsPost, channel: iSettingsChannelId };
  let updatedListing = { "legend.logSettings": logSettings };
  if (!mongoAcc.legend.days) { // 初めての登録
    updatedListing["legend.days"] = [];
    updatedListing["legend.events"] = [];
  };
  await client.clientMongo.db("jwc").collection("accounts").updateOne({ tag: iPlayerTag }, { $set: updatedListing });
  if (!mongoAcc.legend.logSettings) {
    let unixTime = Math.round(Date.now() / 1000);
    const currentDate = new Date();
    const seasonData = functions.calculateSeasonValues(client, currentDate, true);
    const eventData = {
      season: seasonData.seasonId,
      day: seasonData.daysNow,
      trophiesCurrent: resultScan.scPlayer.trophies,
      diffTrophies: 0,
      unixTimeSeconds: unixTime,
      attacksCurrent: resultScan.scPlayer.attackWins,
      defensesCurrent: resultScan.scPlayer.defenseWins,
      diffAttackWins: 0,
      diffDefenseWins: 0,
    };
    await fLegend.writeLogLegendR2(client, mongoAcc, "new", eventData);
  };

  description += `\n`;
  description += `${config.emote.legend} Legend Log Settings\n`;
  description += `[Attacks] *${iSettingsAttacks}*\n`;
  description += `[Defenses] *${iSettingsDefenses}*\n`;
  description += `[Result at End of the Day] *${iSettingsResult}*\n`;
  description += `\n`;
  if (iSettingsPost == "dm") {
    description += `*JWC bot will dm to you.*\n`;
  }
  else if (iSettingsPost == "channel") {
    description += `*JWC bot will post on this channel.*\n`;
    description += `<#${interaction.channel.id}>\n`;
  };
  embed.setTitle(title);
  embed.setDescription(description);

  const nameDiscord = mongoAcc.pilotDC.globalName ? mongoAcc.pilotDC.globalName : mongoAcc.pilotDC.username;
  if (nameDiscord) {
    embed.setAuthor({ name: nameDiscord, iconURL: mongoAcc.pilotDC.avatarUrl });
  };

  await interaction.followUp({ embeds: [embed] });

  return;
};


async function stats(interaction, client) {
  let iPlayerTag = await interaction.options.getString("account");
  let mongoAcc = await client.clientMongo.db("jwc").collection("accounts").findOne(
    { tag: iPlayerTag },
    { projection: { name: 1, legend: 1, pilotDC: 1, leagueTier: 1, _id: 0 } }
  );

  if (!mongoAcc?.legend?.events) {
    let description = ``;
    description += `_No legend data for the account tracked by the JWC bot._\n`;
    description += `* ${iPlayerTag}\n`;
    description += `\n`;
    description += `${config.emote.discord} </legend settings:${config.command.legend.id}> to have the JWC bot track and store your legend data.\n`;
    let embed = new EmbedBuilder();
    embed.setTitle("ERROR");
    embed.setDescription(description);
    embed.setColor(config.color.legend);
    embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
    await interaction.followUp({ embeds: [embed] });
  } 
  else {
    if (!mongoAcc?.pilotDC) {
      let description = ``;
      description += `_No pilot data for the account._\n`;
      description += `* ${iPlayerTag}\n`;
      description += `\n`;
      description += `${config.emote.discord} *</register_acc new:${config.command.register_acc.id}> to link your account to your discord account if this is your account.*\n`;
      description += `${config.emote.discord} *</legend settings:${config.command.legend.id}> to enable notifications of your legend data by the JWC bot.*\n`;
      let embed = new EmbedBuilder();
      embed.setTitle("ERROR");
      embed.setDescription(description);
      embed.setColor(config.color.legend);
      embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
      await interaction.followUp({ embeds: [embed] });
    }
    const iDay = await interaction.options.getString("day") ?? "current";
    const resultStats = await fCanvas.legendStatsR1(client, mongoAcc, iDay);
    if (resultStats.attachment) {
      await interaction.followUp({ files: [resultStats.attachment] });
    }
    else {
      await interaction.followUp({ content: "No data" });
    }
  };

  return;
};


async function history(interaction, clientMongo) {
  let iPlayerTag = await interaction.options.getString("account");
  let mongoAcc = await clientMongo.db("jwc").collection("accounts").findOne(
    { tag: iPlayerTag },
    { projection: { name: 1, trophies: 1, pilotDC: 1, legend: 1, leagueTier: 1, _id: 0 } }
  );

  if (!mongoAcc?.legend?.days) {
    let description = ``;
    description += `_No legend data for the account tracked by the JWC bot._\n`;
    let embed = new EmbedBuilder();
    embed.setTitle("ERROR");
    embed.setDescription(description);
    embed.setColor(config.color.legend);
    embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
    await interaction.followUp({ embeds: [embed] });
    return;
  }
  else {
    let attachment = await fCanvas.legendHistory(mongoAcc);
    await interaction.followUp({ files: [attachment] });
    return;
  }
};


async function japanLocal(interaction, client) {
  let nDisplay = await interaction.options.getInteger("n_display");

  // デフォルト（切り替え時）のデータを取得
  const mongo = await client.clientMongo
    .db("jwc")
    .collection("ranking")
    .findOne(
      { name: "legends200" },
      { projection: { japan: 1, unixTimeRequest: 1, _id: 0 } },
    );
  const prefetched = { players: mongo.japan, unixTime: mongo.unixTimeRequest };

  const arrEmbed = await functions.createEmbedLegends(client, nDisplay, config_coc.locationId.japan, prefetched);
  //console.dir(arrEmbed);

  const attachment = await fCanvas.legendRankingChart(config_coc.locationId.japan, prefetched);

  arrEmbed.forEach(async (embed, index) => {
    if (index === arrEmbed.length - 1 && attachment) {
      embed.setImage(`attachment://${attachment.name}`);
      await interaction.followUp({ embeds: [embed], files: [attachment] });
    } else {
      await interaction.followUp({ embeds: [embed] });
    }
  });

  return;
};


async function global(interaction, client) {
  let nDisplay = await interaction.options.getInteger("n_display");

  // デフォルト（切り替え時）のデータを取得
  const mongo = await client.clientMongo
    .db("jwc")
    .collection("ranking")
    .findOne(
      { name: "legends200" },
      { projection: { global: 1, unixTimeRequest: 1, _id: 0 } },
    );
  const prefetched = { players: mongo.global, unixTime: mongo.unixTimeRequest };

  const arrEmbed = await functions.createEmbedLegends(client, nDisplay, "global", prefetched);

  const attachment = await fCanvas.legendRankingChart("global", prefetched);

  arrEmbed.forEach(async (embed, index) => {
    if (index === arrEmbed.length - 1 && attachment) {
      embed.setImage(`attachment://${attachment.name}`);
      await interaction.followUp({ embeds: [embed], files: [attachment] });
    } else {
      await interaction.followUp({ embeds: [embed] });
    }
  });

  return;
};