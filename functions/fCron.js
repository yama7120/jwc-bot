import { EmbedBuilder } from "discord.js";

import config from "../config/config.js";
import schedule from "../config/schedule.js";
import config_coc from "../config/config_coc.js";

import * as functions from "./functions.js";
import * as fMongo from "./fMongo.js";
import * as fGetWars from "./fGetWars.js";
import * as fRanking from "./fRanking.js";
import * as fCanvas from "./fCanvas.js";


async function cronWarAutoUpdate(client, league) {
  const unixTime = Math.floor(Date.now() / 1000);
  const status = config.cronWarStatus[league];
  const weekNow = config.weekNow[league];
  if (status == "on") {
    await autoUpdateWar(client, league, weekNow);
  }
  if (league == "j1") { // 通信料削減のためJ1のときだけbot status更新
    functions.updateStatusInfo(client, unixTime);
  }
}
export { cronWarAutoUpdate };


async function autoUpdateWar(client, league, week) {
  const cursor = client.clientMongo.db("jwc").collection("wars")
    .find({ season: config.season[league], league: league, week: week, "result.state": { $ne: "warEnded" } });
  const mongoWars = await cursor.toArray();
  await cursor.close();

  let sumFlagUpdate = 0;

  await Promise.all(mongoWars.map(async (mongoWar) => {
    const result = await fGetWars.getClanWarUpdateDB(client, mongoWar);
    sumFlagUpdate += result || 0;
  }));

  if (sumFlagUpdate > 0) {
    functions.updateWarInfo(client, league, week);
  }

  const cursor2 = client.clientMongo.db("jwc").collection("wars")
    .find({ season: config.season[league], league: league, week: { $in: [week, week + 1] }, "result.state": { $ne: "warEnded" } });
  const mongoWars2 = await cursor2.toArray();
  await cursor2.close();

  await Promise.all(mongoWars2.map(async (mongoWar) => {
    if (mongoWar.deal?.unixTime) {
      const date = new Date(mongoWar.deal.unixTime * 1000);
      const now = new Date();
      const timeDifference = date - now;
      const hoursDifference = timeDifference / (1000 * 60 * 60);
      if (hoursDifference >= 12 && hoursDifference <= 24) {
        await sendReminderMain(client, mongoWar);
      }
    }
  }));
}

async function sendReminderMain(client, mongoWar) {
  const mongoClanA = await client.clientMongo.db("jwc").collection("clans").findOne({ clan_abbr: mongoWar.clan_abbr });
  const mongoClanB = await client.clientMongo.db("jwc").collection("clans").findOne({ clan_abbr: mongoWar.opponent_abbr });

  if (!mongoWar.deal.remainder) {
    const result = await sendReminder(client, mongoWar.nego_channel, mongoWar, mongoClanA, mongoClanB);

    if (mongoClanA.log?.deal?.switch == "on") {
      await sendReminder(client, mongoClanA.log.deal.channel_id, mongoWar, mongoClanA, mongoClanB);
    }

    if (mongoClanB.log?.deal?.switch == "on") {
      await sendReminder(client, mongoClanB.log.deal.channel_id, mongoWar, mongoClanA, mongoClanB);
    }

    if (result) {
      const listingUpdate = {
        deal: {
          ...mongoWar.deal,
          remainder: true
        }
      };
      await client.clientMongo.db("jwc").collection("wars").updateOne({ _id: mongoWar._id }, { $set: listingUpdate });
    } else {
      console.error("Failed to send reminder message");
    }
  }
}

async function sendReminder(client, channelId, mongoWar, mongoClanA, mongoClanB) {
  const weekNow = config.weekNow[mongoWar.league];

  const isBotDataFetchOK = mongoWar.week === weekNow;

  const myEmbed = new EmbedBuilder();

  const title = `:bell: **REMINDER**${isBotDataFetchOK ? " :white_check_mark:" : ""}`;

  const descriptionLines = [
    `* ${config.league[mongoWar.league]}`,
    `* WEEK ${mongoWar.week}`,
    `* ${mongoWar.name_match || schedule.match["m" + mongoWar.match]}`,
    ``,
    `**${mongoClanA.team_name} :vs: ${mongoClanB.team_name}**`,
    ``,
    `:calendar: <t:${mongoWar.deal.unixTime}:F> (<t:${mongoWar.deal.unixTime}:R>)`,
    `:hourglass_flowing_sand:  ${mongoWar.deal.prep_time}  /  :crossed_swords:  ${mongoWar.deal.battle_time}`
  ];

  const description = descriptionLines.join("\n");
  const footer = config.footer;

  myEmbed.setTitle(title);
  myEmbed.setDescription(description);
  myEmbed.setColor(config.color[mongoWar.league]);
  myEmbed.setFooter({ text: footer, iconURL: config.urlImage.jwc });
  myEmbed.setTimestamp();

  let channelName = "unknown";
  try {
    let channel = client.channels.cache.get(channelId);
    if (!channel) {
      channel = await client.channels.fetch(channelId).catch(() => null);
    }
    channelName = channel?.name || "unknown";

    if (!channel || !channel.isTextBased()) {
      throw new Error("Channel not found or not text-based");
    }
    const botMember = channel.guild?.members?.me ?? null;
    const permissions = botMember ? channel.permissionsFor(botMember) : null;
    if (
      permissions &&
      (!permissions.has("ViewChannel") || !permissions.has("SendMessages"))
    ) {
      console.warn(
        `[sendReminder] missing permission for channel ${channelId} (${channelName})`,
      );
      return null;
    }

    const result = await channel.send({ embeds: [myEmbed] });

    if (!isBotDataFetchOK) {
      try {
        await channel.send(
          `<@!${config.yamaId}> Please update the current week setting.`,
        );
      } catch (mentionError) {
        console.warn(
          `[sendReminder] failed to send week-setting mention in ${channelId} (${channelName}): ${mentionError.message}`,
        );
      }
    }

    return result;
  } catch (error) {
    if (error?.code === 50001) {
      console.warn(
        `[sendReminder] missing access to channel ${channelId} (${channelName})`,
      );
      return null;
    }
    console.error(`Failed to send reminder to channel ${channelId} (${channelName}):`, error);
    return null;
  }
}

async function rankedBattles(client) {
  console.log("start: rankedBattles");

  try {
    const query = { status: true };
    const options = {
      projection: {
        _id: 0,
        tag: 1,
        name: 1,
        leagueTier: 1
      }
    };
    const cursor = client.clientMongo.db("jwc").collection("accounts").find(query, options);
    const mongoAccs = await cursor.toArray();
    await cursor.close();

    console.log(`処理対象アカウント数: ${mongoAccs.length}`);

    for (let i = 0; i < mongoAccs.length; i++) {
      const mongoAcc = mongoAccs[i];

      try {
        const scPlayer = await client.clientCoc.getPlayer(mongoAcc.tag);

        if (scPlayer.leagueTier) {
          const currentTime = new Date();
          const unixTime = Math.floor(currentTime.getTime() / 1000);

          const historyEntry = {
            leagueTier: scPlayer.leagueTier,
            trophies: scPlayer.trophies,
            attackWins: scPlayer.attackWins,
            defenseWins: scPlayer.defenseWins,
            townHallLevel: scPlayer.townHallLevel,
            unixTime: unixTime,
            date: currentTime.toISOString(),
            year: currentTime.getFullYear(),
            month: currentTime.getMonth() + 1,
            day: currentTime.getDate()
          };

          await client.clientMongo.db("jwc").collection("accounts").updateOne(
            { tag: mongoAcc.tag },
            {
              $set: {
                "leagueTier.name": scPlayer.leagueTier.name,
                "leagueTier.id": scPlayer.leagueTier.id,
                "leagueTier.icon": scPlayer.leagueTier.icon
              },
              $push: {
                "leagueTier.history": historyEntry
              }
            }
          );
        } else {
          console.log(`[${i + 1}/${mongoAccs.length}] leagueTier情報なし: ${mongoAcc.name} (${mongoAcc.tag})`);
        }
      } catch (error) {
        if (error.reason === "inMaintenance") {
          console.log(`[${i + 1}/${mongoAccs.length}] メンテナンス中: ${mongoAcc.name} (${mongoAcc.tag})`);
        } else if (error.reason === "notFound") {
          console.log(`[${i + 1}/${mongoAccs.length}] アカウントが見つかりません: ${mongoAcc.name} (${mongoAcc.tag})`);
        } else if (error.reason === "requestThrottled") {
          console.log(`[${i + 1}/${mongoAccs.length}] リクエスト制限: ${mongoAcc.name} (${mongoAcc.tag})`);
        } else {
          console.error(`[${i + 1}/${mongoAccs.length}] エラー: ${mongoAcc.name} (${mongoAcc.tag}) - ${error.reason}`);
        }
      }

      if ((i + 1) % 100 === 0) {
        console.log(`進捗: ${i + 1}/${mongoAccs.length} アカウント処理完了`);
      }

      await functions.sleep(100);
    }

    console.log("end: rankedBattles");
  } catch (error) {
    console.error("rankedBattles エラー:", error);
  }
}
export { rankedBattles };


async function cronUpdate2pm(client) {
  const currentDate = new Date();
  const seasonData = functions.calculateSeasonValues(client, currentDate, true);
  const nAccs = await autoUpdateAcc(client);

  await sendLogUpdated(client, nAccs, seasonData);

  await fRanking.rankingMain(client.clientMongo);

  await sendLogLegendDay(client, seasonData);

  await functions.sleep(60 * 1000);

  await sendLegendResult(client, seasonData);

  functions.updateStatusInfoLegend(client, seasonData);

  await addNewDayToLegendAccounts(client, seasonData);
}
export { cronUpdate2pm };

async function addNewDayToLegendAccounts(client, seasonData) {
  try {
    const configData = await client.clientMongo
      .db("jwc")
      .collection("config")
      .findOne({ name: "rankedBattlesSeason" });

    let seasonId, currentDay;
    if (!configData) {
      console.log("rankedBattlesSeason config not found, using seasonData values");
      seasonId = seasonData.seasonId;
      currentDay = seasonData.daysNow;
    } else {
      seasonId = configData.seasonId;
      currentDay = configData.currentDay;
    }

    const query = {
      status: true,
      "legend.days": { $exists: true, $ne: null }
    };

    const accounts = await client.clientMongo
      .db("jwc")
      .collection("accounts")
      .find(query)
      .toArray();

    console.log(`Found ${accounts.length} accounts with legend.days array`);

    const newDayObject = {
      season: seasonId,
      day: currentDay,
      trophies: 0,
      diffTrophies: 0,
      attacks: 0,
      defenses: 0,
      triples: 0,
      defTriples: 0,
      attackTrophies: 0,
      defenseTrophies: 0
    };

    for (const account of accounts) {
      try {
        await client.clientMongo
          .db("jwc")
          .collection("accounts")
          .updateOne(
            { tag: account.tag },
            {
              $push: {
                "legend.days": {
                  $each: [newDayObject],
                  $position: 0
                }
              }
            }
          );
      } catch (error) {
        console.error(`Error updating account ${account.tag}:`, error);
      }
    }

    console.log("Successfully added new day objects to legend accounts");
  } catch (error) {
    console.error("Error in addNewDayToLegendAccounts:", error);
  }
}

async function autoUpdateAcc(client) {
  console.log(`start: autoUpdateAcc`);

  const query = { status: true };
  const options = { projection: { _id: 0, tag: 1 } };
  const sort = { trophies: -1 };
  const cursor = client.clientMongo.db("jwc").collection("accounts").find(query, options).sort(sort);
  const accountsAll = await cursor.toArray();
  await cursor.close();
  console.log(`accountsAll: ${accountsAll.length}`);

  const nAccPerLoop = 30;
  const nLoop = Math.ceil(accountsAll.length / nAccPerLoop);

  for (let i = 0; i < nLoop; i++) {
    const min = nAccPerLoop * i;
    const max = Math.min(nAccPerLoop * (i + 1), accountsAll.length);
    const accs = accountsAll.slice(min, max);

    await Promise.all(accs.map(acc =>
      fMongo.updateAcc(client, acc.tag).catch(error => console.error(error))
    ));

    console.log(`${max} / ${accountsAll.length}`);
    await functions.sleep(1000);
  }

  return accountsAll.length;
}

async function sendLogUpdated(client, nAccs, seasonData) {
  const query = { status: true, "legend.days": { $ne: null } };
  const options = {
    projection: {
      _id: 0,
      name: 1,
      trophies: 1,
      townHallLevel: 1,
      unixTimeRequest: 1,
      legend: 1,
      homeClanAbbr: 1,
      diffAttackWins: 1
    }
  };
  const sort = { trophies: -1 };
  const cursor = client.clientMongo.db("jwc").collection("accounts").find(query, options).sort(sort).limit(10);
  const accounts = await cursor.toArray();
  await cursor.close();

  const myEmbed = new EmbedBuilder();
  const title = `:white_check_mark: **UPDATED**`;

  const descriptionLines = [
    `<t:${Math.round(accounts[0].unixTimeRequest)}:t> (<t:${Math.round(accounts[0].unixTimeRequest)}:R>)`,
    "*The data for all JWC accounts has been successfully updated.*",
    `*${nAccs} accounts*`,
    ``,
    `${config.emote.legend} **TOP 10 LEGEND PLAYERS**`
  ];

  accounts.forEach((acc, index) => {
    let dayStats = acc.legend.days[0];
    const diffTrophies = dayStats.diffTrophies >= 0 ? `+${dayStats.diffTrophies}` : `${dayStats.diffTrophies}`;
    const emoteTH = config.emote.thn[acc.townHallLevel];
    const nameAcc = `**${functions.nameReplacer(acc.name)}**`;
    const clanInfo = acc.homeClanAbbr.j != ""
      ? ` | ${config.emote.jwc} ${String(acc.homeClanAbbr.j).toUpperCase()}`
      : "";

    descriptionLines.push(
      [
        `${index + 1}.`,
        `**${dayStats.trophies}**`,
        `[${diffTrophies}]`,
        `:boom:`,
        `**${dayStats.triples}**/${dayStats.attacks}`,
        `${emoteTH}`,
        `${nameAcc}${clanInfo}`
      ].filter(Boolean).join(" ")
    );
  });

  descriptionLines.push(
    ``,
    `${config.emote.discord} **USEFUL COMMANDS**`,
    `</ranking account_data:${config.command["ranking"].id}>`,
    `</ranking legend:${config.command["ranking"].id}>`,
    `</legend global:${config.command["legend"].id}>`,
    `</legend japan_local:${config.command["legend"].id}>`,
    `</help commands:${config.command["help"].id}>`
  );

  const description = descriptionLines.join("\n");
  const footer = config.footer;

  myEmbed.setTitle(title);
  myEmbed.setDescription(description);
  myEmbed.setColor(config.color.main);
  myEmbed.setFooter({ text: footer, iconURL: config.urlImage.jwc });
  await client.channels.cache.get(config.logch.freeBotRoom).send({ embeds: [myEmbed] });
}

async function sendLogLegendDay(client, seasonData) {
  const myEmbed = new EmbedBuilder();
  const title = `:white_check_mark: **UPDATED**`;

  const descriptionLines = [
    `<t:${Math.round(Date.now() / 1000)}:t> (<t:${Math.round(Date.now() / 1000)}:R>)`,
    `*Day ${seasonData.daysNow} has started.*`,
    `*${seasonData.daysEnd} days to go.*`
  ];

  const description = descriptionLines.join("\n");
  const footer = `SEASON ${seasonData.seasonId}`;

  myEmbed.setTitle(title);
  myEmbed.setDescription(description);
  myEmbed.setColor(config.color.legend);
  myEmbed.setFooter({ text: footer, iconURL: config.urlImage.legend });
  await client.channels.cache.get(config.logch.freeBotRoom).send({ embeds: [myEmbed] });
}


async function sendLegendResult(client, seasonData) {
  const query = {
    status: true,
    "legend.logSettings.result": "true",
    "legend.current": { $ne: null }
  };
  const options = {
    projection: {
      _id: 0,
      tag: 1,
      trophies: 1,
      legend: 1,
      leagueTier: 1,
      pilotDC: 1,
      name: 1,
      townHallLevel: 1
    }
  };

  const cursor = client.clientMongo.db("jwc").collection("accounts").find(query, options);
  const mongoAccs = await cursor.toArray();
  await cursor.close();

  const legends200 = await client.clientMongo.db("jwc").collection("ranking").findOne(
    { name: "legends200" },
    { projection: { _id: 0, japan: 1, global: 1 } }
  );
  const japanRankMap = new Map((legends200?.japan ?? []).map(player => [player.tag, player.rank]));
  const globalRankMap = new Map((legends200?.global ?? []).map(player => [player.tag, player.rank]));
  const summaryByPilot = new Map();

  console.log(`sendLegendResult: ${mongoAccs.length}`);

  for (let i = 0; i < mongoAccs.length; i++) {
    const mongoAcc = mongoAccs[i];

    console.log(`[${i + 1}/${mongoAccs.length}] アカウント処理中: ${mongoAcc.name} (${mongoAcc.tag}) ${mongoAcc.leagueTier.name}`);
    if (mongoAcc.leagueTier.id == config_coc.leagueId.legend) {
      try {
        const resultR1 = await fCanvas.legendStatsR1(client, mongoAcc, "previous");
        const rankInfo = {
          global: globalRankMap.get(mongoAcc.tag) ?? mongoAcc.legend?.current?.rank ?? null,
          japan: japanRankMap.get(mongoAcc.tag) ?? null
        };
        await sendLogAttachment(client, mongoAcc, resultR1, seasonData, rankInfo);
        collectLegendSummary(summaryByPilot, mongoAcc, resultR1, rankInfo);

        await functions.sleep(500);
      } catch (error) {
        console.error(`[${i + 1}/${mongoAccs.length}] エラー発生 (${mongoAcc.tag}): ${error.message}`);
        await functions.sleep(1000);
      }
    }
  }

  await sendLegendSummaryByPilot(client, seasonData, summaryByPilot);
  console.log("end: sendLegendResult");
}

async function sendLogAttachment(client, mongoAcc, result, seasonData, rankInfo = {}) {
  const embed = new EmbedBuilder();
  const title = `${config.emote.legend} RESULT OF ${seasonData.daysNow == 1 ? "THE LAST DAY" : `DAY ${seasonData.daysNow - 1}`}`;
  embed.setTitle(title);
  let description = `${config.emote.thn[mongoAcc.townHallLevel]} **${mongoAcc.name}**`;
  const dayStats = result?.dayStats ?? {};
  const startTrophies = mongoAcc?.legend?.previousDay?.trophies ?? null;
  const endTrophies = dayStats?.trophies ?? null;
  const diffTrophies = dayStats?.diffTrophies ?? null;
  const attackTrophies = dayStats?.attackTrophies ?? null;
  const defenseTrophies = dayStats?.defenseTrophies ?? null;
  const globalRank = rankInfo.global ?? null;
  const japanRank = rankInfo.japan ?? null;

  const formattedStart = Number.isFinite(startTrophies) ? `**${startTrophies}**` : "*N/A*";
  const formattedEnd = Number.isFinite(endTrophies) ? `**${endTrophies}**` : "*N/A*";
  const formattedDiff = Number.isFinite(diffTrophies)
    ? (diffTrophies >= 0 ? `**+${diffTrophies}**` : `**${diffTrophies}**`)
    : "*N/A*";
  const formattedDiffWithArrow = Number.isFinite(diffTrophies)
    ? `${diffTrophies >= 0 ? config.emote.up : config.emote.down} ${formattedDiff}`
    : formattedDiff;
  const formattedAttackTrophies = Number.isFinite(attackTrophies) ? `**+${attackTrophies}**` : "*N/A*";
  const formattedDefenseTrophies = Number.isFinite(defenseTrophies) ? `**${defenseTrophies}**` : "*N/A*";
  const formattedGlobalRank = Number.isFinite(globalRank) ? `**#${globalRank}**` : "*N/A*";
  const formattedJapanRank = Number.isFinite(japanRank) ? `**#${japanRank}**` : "*N/A*";

  if (result.isPerfect) {
    description += `\n\n:boom: **8 TRIPLES** 🎉\n`;
    description += `*Congratulations on achieving the maximum possible trophies in a single day!*`;
  } else {
    description += `\n\n:boom: **${dayStats.triples}**/${dayStats.attacks}`;
  }
  description += `\n\n:trophy: Start: ${formattedStart}`;
  description += `\n:trophy: End: ${formattedEnd} [${formattedDiffWithArrow}]`;
  description += `\n${config.emote.sword} Attack Trophies: ${formattedAttackTrophies}`;
  description += `\n${config.emote.shield} Defense Trophies: ${formattedDefenseTrophies}`;
  description += `\n:globe_with_meridians: Global Rank: ${formattedGlobalRank}`;
  description += `\n:flag_jp: Japan Rank: ${formattedJapanRank}`;
  embed.setDescription(description);
  embed.setColor(config.color.legend);
  const footer = `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  embed.setFooter({ text: footer, iconURL: config.urlImage.legend });

  const attachmentHistory = await fCanvas.legendHistory(mongoAcc);

  try {
    if (mongoAcc.legend.logSettings.post === "channel") {
      const channel = client.channels.cache.get(mongoAcc.legend.logSettings.channel);
      if (!channel) {
        throw new Error("チャンネルが見つからないか、テキストチャンネルではありません。");
      }
      await channel.send({ embeds: [embed] });
      await channel.send({ files: [result.attachment] });
      await channel.send({ files: [attachmentHistory] });
    } else if (mongoAcc.legend.logSettings.post === "dm") {
      const pilot = await client.users.fetch(mongoAcc.pilotDC.id);
      await pilot.send({ embeds: [embed] });
      await pilot.send({ files: [result.attachment] });
      await pilot.send({ files: [attachmentHistory] });
    }
  } catch (error) {
    console.error(`メッセージの送信中にエラーが発生しました: ${mongoAcc.name}`, error);
  }
  // log
  client.channels.cache.get(config.logch.legend).send({ embeds: [embed] });
  client.channels.cache.get(config.logch.legend).send({ files: [result.attachment] });
  client.channels.cache.get(config.logch.legend).send({ files: [attachmentHistory] });
}

function collectLegendSummary(summaryByPilot, mongoAcc, result, rankInfo) {
  const pilotId = mongoAcc?.pilotDC?.id;
  if (!pilotId) return;

  if (!summaryByPilot.has(pilotId)) {
    summaryByPilot.set(pilotId, []);
  }

  summaryByPilot.get(pilotId).push({
    tag: mongoAcc.tag,
    name: mongoAcc.name,
    townHallLevel: mongoAcc.townHallLevel,
    startTrophies: mongoAcc?.legend?.previousDay?.trophies ?? null,
    endTrophies: result?.dayStats?.trophies ?? null,
    diffTrophies: result?.dayStats?.diffTrophies ?? null,
    attackTrophies: result?.dayStats?.attackTrophies ?? null,
    defenseTrophies: result?.dayStats?.defenseTrophies ?? null,
    globalRank: rankInfo.global ?? null,
    japanRank: rankInfo.japan ?? null,
    post: mongoAcc?.legend?.logSettings?.post ?? "NA",
    channel: mongoAcc?.legend?.logSettings?.channel ?? null
  });
}

async function sendLegendSummaryByPilot(client, seasonData, summaryByPilot) {
  for (const [pilotId, itemsRaw] of summaryByPilot.entries()) {
    if (itemsRaw.length < 2) continue;

    const items = [...itemsRaw].sort((a, b) => (b.endTrophies ?? 0) - (a.endTrophies ?? 0));
    const destinations = getSummaryDestinations(items, pilotId);
    if (destinations.length === 0) continue;

    const embed = createLegendSummaryEmbed(items, seasonData);

    for (const destination of destinations) {
      try {
        if (destination.type === "channel") {
          const channel = client.channels.cache.get(destination.id);
          if (channel) await channel.send({ embeds: [embed] });
        } else if (destination.type === "dm") {
          const pilot = await client.users.fetch(destination.id);
          await pilot.send({ embeds: [embed] });
        }
      } catch (error) {
        console.error(`まとめ通知の送信中にエラーが発生しました: pilot=${pilotId}`, error);
      }
    }
  }
}

function getSummaryDestinations(items, pilotId) {
  const destinationMap = new Map();

  items.forEach(item => {
    if (item.post === "channel" && item.channel) {
      destinationMap.set(`channel:${item.channel}`, { type: "channel", id: item.channel });
    } else if (item.post === "dm") {
      destinationMap.set(`dm:${pilotId}`, { type: "dm", id: pilotId });
    }
  });

  return Array.from(destinationMap.values());
}

function createLegendSummaryEmbed(items, seasonData) {
  const embed = new EmbedBuilder();
  const title = `${config.emote.legend} SUMMARY OF ${seasonData.daysNow == 1 ? "THE LAST DAY" : `DAY ${seasonData.daysNow - 1}`}`;
  embed.setTitle(title);
  embed.setColor(config.color.legend);
  const footer = `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  embed.setFooter({ text: footer, iconURL: config.urlImage.legend });

  const lines = [];
  items.forEach((item, index) => {
    const end = Number.isFinite(item.endTrophies) ? item.endTrophies : "N/A";
    const diff = Number.isFinite(item.diffTrophies)
      ? `${item.diffTrophies >= 0 ? config.emote.up : config.emote.down} ${item.diffTrophies >= 0 ? `+${item.diffTrophies}` : item.diffTrophies}`
      : "N/A";
    const atk = Number.isFinite(item.attackTrophies) ? `+${item.attackTrophies}` : "N/A";
    const def = Number.isFinite(item.defenseTrophies) ? `${item.defenseTrophies}` : "N/A";
    const gRank = Number.isFinite(item.globalRank) ? `#${item.globalRank}` : "N/A";
    const jRank = Number.isFinite(item.japanRank) ? `#${item.japanRank}` : "N/A";
    lines.push(
      `${index + 1}. ${config.emote.thn[item.townHallLevel]} **${item.name}**`
      + `\n:trophy: ${end} [${diff}] | ${config.emote.sword} ${atk} | ${config.emote.shield} ${def}`
      + `\n:globe_with_meridians: ${gRank} | :flag_jp: ${jRank}`
    );
  });

  embed.setDescription(lines.join("\n\n"));
  return embed;
}
