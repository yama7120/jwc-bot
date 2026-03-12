const { EmbedBuilder } = require("discord.js");

const config = require("../config.js");
const config_coc = require("../config_coc.js");

const functions = require("./functions.js");
const fMongo = require("./fMongo.js");
const fRanking = require("./fRanking.js");
const fCron = require("./fCron.js");

async function autoUpdateLegend(client, mongoAcc, beforePlayerStats, afterPlayerStats, seasonData) {
  if (!mongoAcc) {
    console.log(`something wrong`, beforePlayerStats.tag, afterPlayerStats.tag);
    return;
  }

  //console.dir(afterPlayerStats);

  const unixTimeSeconds = Math.floor(Date.now() / 1000);

  const diffAttackWins = afterPlayerStats.attackWins - beforePlayerStats.attackWins;
  const diffDefenseWins = afterPlayerStats.defenseWins - beforePlayerStats.defenseWins;

  // 基本的なeventDataオブジェクトを作成
  const baseEventData = {
    season: seasonData.seasonId,
    day: seasonData.daysNow,
    trophiesCurrent: afterPlayerStats.trophies,
    diffTrophies: afterPlayerStats.trophies - beforePlayerStats.trophies,
    unixTimeSeconds: unixTimeSeconds,
    attacksCurrent: afterPlayerStats.attackWins,
    defensesCurrent: afterPlayerStats.defenseWins,
    diffAttackWins: diffAttackWins,
    diffDefenseWins: diffDefenseWins,
    leagueId: afterPlayerStats.leagueTier.id,
    leagueName: afterPlayerStats.leagueTier.name,
  };

  if (isSeasonResetEvent(beforePlayerStats, afterPlayerStats, seasonData)) {
    await handleLegendEvent(client, afterPlayerStats, mongoAcc, "seasonReset", baseEventData, diffAttackWins, seasonData);
    return;
  }

  if (afterPlayerStats.leagueTier.id == config_coc.leagueId.legend) {
    const legendEventType = isAttackOrDefenseLegend(diffAttackWins, diffDefenseWins,
      afterPlayerStats.trophies - beforePlayerStats.trophies, afterPlayerStats.attackWins);
    await handleLegendEvent(client, afterPlayerStats, mongoAcc, legendEventType, baseEventData, diffAttackWins, seasonData);
  } else {
    const legendEventType = isAttackOrDefense(diffAttackWins);
    await handleLegendEvent(client, afterPlayerStats, mongoAcc, legendEventType, baseEventData, diffAttackWins, seasonData);
  }

  return;
}
exports.autoUpdateLegend = autoUpdateLegend;

function isSeasonResetEvent(beforePlayerStats, afterPlayerStats, seasonData) {
  const hasTrophyReset =
    beforePlayerStats.trophies > afterPlayerStats.trophies &&
    afterPlayerStats.trophies === 5000;
  const hasCounterReset =
    afterPlayerStats.attackWins < beforePlayerStats.attackWins ||
    afterPlayerStats.defenseWins < beforePlayerStats.defenseWins;
  const isSeasonStartDay = seasonData.daysNow === 1;
  const isLegendLeague = afterPlayerStats.leagueTier.id === config_coc.leagueId.legend;

  return isLegendLeague && hasTrophyReset && (isSeasonStartDay || hasCounterReset);
}

function isAttackOrDefenseLegend(diffAttackWins, diffDefenseWins, diffTrophies, attacksCurrent) {
  if (diffAttackWins == 0) {
    if (diffDefenseWins == 1) {
      return "defense";
    } else {
      if (diffTrophies > 0) {
        // 攻撃通知（攻撃 + 防衛 > 0 かもしれないが判定不可能）：星ゼロ確定
        if (diffDefenseWins == 0) {
          return "attack"; // バグ対応
        }
      } else if (diffTrophies < 0) {
        if (diffTrophies <= -41) {
          // 2回同時防衛通知
          return "2defenses";
        } else {
          // 2防衛通知（攻撃 + 防衛 < 0 かもしれないが判定不可能）
          return "defense";
        }
      }
    }
  } else if (diffAttackWins == 1) {
    if (diffTrophies > 0) {
      // 攻撃通知（攻撃 + 防衛 > 0 かもしれないが判定不可能）
      return "attack";
    } else if (diffTrophies == 0) {
      // 注意通知（攻撃 + 防衛 = 0）
      return "both";
    } else if (diffTrophies < 0) {
      // 注意通知（攻撃 + 防衛 < 0）
      return "both";
    }
  } else if (diffAttackWins >= 2 && diffAttackWins <= 8) {
    return "multipleAttacks";
  } else if (diffAttackWins >= 9) {
    return "warning";
  }
}

function isAttackOrDefense(diffAttackWins) {
  if (diffAttackWins == 0) {
    return "defense";
  } else if (diffAttackWins == 1) {
    return "attack";
  } else if (diffAttackWins >= 2 && diffAttackWins <= 8) {
    return "multipleAttacks";
  } else if (diffAttackWins >= 9) {
    return "warning";
  }
}

// イベント処理
async function handleLegendEvent(client, scPlayer, mongoAcc, legendEventType, baseEventData, diffAttackWins, seasonData) {
  switch (legendEventType) {
    case "seasonReset":
      await sendLogLegendMain(client, scPlayer, mongoAcc, legendEventType, baseEventData, 1, 0, { nToday: { attacks: 0, defenses: 0 } }, seasonData);
      break;

    case "nonLegend":
    case "nextLegend":
      if (baseEventData.diffTrophies !== 0) {
        const result = await writeLogLegendR2(client, mongoAcc, legendEventType, baseEventData);
        if (result && result.value) {
          await sendLogLegendMain(client, scPlayer, mongoAcc, legendEventType, baseEventData, 1, 0, result, seasonData);
        }
      }
      break;

    case "multipleAttacks":
      await handleMultipleAttacks(client, scPlayer, mongoAcc, baseEventData, diffAttackWins, seasonData);
      break;

    case "both":
      await handleBothAttackDefense(client, scPlayer, mongoAcc, baseEventData, seasonData);
      break;

    case "2defenses":
      await handle2Defenses(client, scPlayer, mongoAcc, baseEventData, seasonData);
      break;

    default:
      // 単一のattack/defense
      const result = await writeLogLegendR2(client, mongoAcc, legendEventType, baseEventData);
      if (result && result.value) {
        await sendLogLegendMain(client, scPlayer, mongoAcc, legendEventType, baseEventData, 1, 0, result, seasonData);
      }
      break;
  }
}

// 複数攻撃の処理
async function handleMultipleAttacks(client, scPlayer, mongoAcc, baseEventData, attackCount, seasonData) {
  const { diffTrophies, trophiesCurrent, unixTimeSeconds } = baseEventData;

  // トロフィーを攻撃回数分に分割
  const trophyDistribution = distributeTrophies(diffTrophies, attackCount);

  // 複数のイベントデータを配列として準備
  const multipleEvents = [];
  for (let i = 0; i < attackCount; i++) {
    const eventData = {
      ...baseEventData,
      trophiesCurrent: trophiesCurrent - (diffTrophies - trophyDistribution.cumulative[i]),
      diffTrophies: trophyDistribution.individual[i],
      unixTimeSeconds: unixTimeSeconds - (attackCount - 1 - i) * 120, // 120秒間隔
      attacksCurrent: baseEventData.attacksCurrent - (attackCount - 1 - i)
    };
    multipleEvents.push(eventData);
  }

  // 1回のデータベース書き込みで複数イベントを処理
  const result = await writeLogLegendR2(client, mongoAcc, "attack", multipleEvents);
  if (result && result.value) {
    // ひとつひとつ通知を送信する
    for (let i = 0; i < multipleEvents.length; i++) {
      await sendLogLegendMain(client, scPlayer, mongoAcc, "attack", multipleEvents[i], multipleEvents.length, i, result, seasonData);
    }
  }
}

// トロフィー分割
function distributeTrophies(totalTrophies, attackCount) {
  const individual = new Array(attackCount).fill(0);
  const cumulative = new Array(attackCount).fill(0);

  let remaining = totalTrophies;
  
  // 平均値（小数は切り捨て）で均等配分し、最後で合計を調整
  const base = Math.floor(totalTrophies / attackCount);
  for (let i = 0; i < attackCount; i++) {
    individual[i] = base;
  }
  const sumBase = base * attackCount;
  const adjust = totalTrophies - sumBase; // 調整分（0以上とは限らない）
  individual[attackCount - 1] += adjust;

  // 累積計算
  let sum = 0;
  for (let i = 0; i < attackCount; i++) {
    sum += individual[i];
    cumulative[i] = sum;
  }
  return { individual, cumulative };
}

// 攻撃+防衛の同時処理
async function handleBothAttackDefense(client, scPlayer, mongoAcc, baseEventData, seasonData) {
  const { diffTrophies, unixTimeSeconds } = baseEventData;

  // トロフィーを攻撃と防衛に分割
  let attackTrophies, defenseTrophies;
  if (diffTrophies === 0) {
    attackTrophies = 40;
    defenseTrophies = -40;
  } else {
    attackTrophies = 0;
    defenseTrophies = diffTrophies;
  }

  // 攻撃と防衛のイベントデータを配列として準備
  const bothEvents = [
    {
      ...baseEventData,
      diffTrophies: attackTrophies,
      unixTimeSeconds: unixTimeSeconds - 60
    },
    {
      ...baseEventData,
      diffTrophies: defenseTrophies,
      unixTimeSeconds: unixTimeSeconds
    }
  ];

  // 1回のデータベース書き込みで両方のイベントを処理
  const result = await writeLogLegendR2(client, mongoAcc, "both", bothEvents);

  if (result && result.value) {
    await sendLogLegendMain(client, scPlayer, mongoAcc, "both", baseEventData, 1, 0, result, seasonData);
  }
}

// 2回同時防衛の処理
async function handle2Defenses(client, scPlayer, mongoAcc, baseEventData, seasonData) {
  const { diffTrophies, trophiesCurrent, unixTimeSeconds } = baseEventData;

  // 2回の防衛イベントを作成
  // 1つ目: -40、2つ目: 元の合計に40を足した数値
  const secondDefenseTrophies = diffTrophies + 40;
  const defenseEvents = [
    {
      ...baseEventData,
      trophiesCurrent: trophiesCurrent - secondDefenseTrophies,
      diffTrophies: -40,
      unixTimeSeconds: unixTimeSeconds - 60
    },
    {
      ...baseEventData,
      trophiesCurrent: trophiesCurrent,
      diffTrophies: secondDefenseTrophies,
      unixTimeSeconds: unixTimeSeconds
    }
  ];

  // 1回のデータベース書き込みで両方の防衛イベントを処理
  const result = await writeLogLegendR2(client, mongoAcc, "defense", defenseEvents);

  if (result && result.value) {
    // 2回の通知を送信する
    await sendLogLegendMain(client, scPlayer, mongoAcc, "defense", defenseEvents[0], 2, 0, result, seasonData);
    await sendLogLegendMain(client, scPlayer, mongoAcc, "defense", defenseEvents[1], 2, 1, result, seasonData);
  }
}

async function writeLogLegendR2(client, mongoAcc, legendEventType, eventData) {
  // 単一イベントの場合は配列に変換
  const events = Array.isArray(eventData) ? eventData : [eventData];

  const newEvents = events.map(event => ({
    unixTime: event.unixTimeSeconds,
    season: event.season,
    day: event.day,
    action: legendEventType,
    diffTrophies: event.diffTrophies,
    trophies: event.trophiesCurrent,
    leagueId: event.leagueId,
    leagueName: event.leagueName
  }));

  // 1. 新しいイベントの最後のdayを取得
  const lastEvent = newEvents[newEvents.length - 1];
  const targetSeason = lastEvent.season;
  const targetDay = lastEvent.day;

  // 2. 既存のeventsから該当するdayのイベントを取得
  const existingEvents = Array.isArray(mongoAcc.legend.events) ? mongoAcc.legend.events : [];
  const targetDayEvents = existingEvents.filter(event =>
    event.season === targetSeason && event.day === targetDay
  );

  // 3. 該当するdayのイベントを再計算（既存 + 新規）
  const allTargetDayEvents = [...targetDayEvents, ...newEvents];
  const updatedDayData = aggregateDaysFromEvents(allTargetDayEvents).find(d =>
    d.season === targetSeason && d.day === targetDay
  );

  const updatePipeline = [
    {
      $set: {
        "legend.events": {
          $concatArrays: [
            { $ifNull: ["$legend.events", []] },
            newEvents
          ]
        }
      }
    },
    {
      $set: {
        "legend.events": {
          $slice: ["$legend.events", -80] // 最新80件のみ保持
        }
      }
    }
  ];

  // updatedDayData がないケース（Legend以外のリーグ等）では
  // legend.days に null が混入しないようにし、既存の null も掃除する
  if (updatedDayData) {
    updatePipeline.push(
      {
        $set: {
          "legend.days": {
            $concatArrays: [
              {
                $filter: {
                  input: { $ifNull: ["$legend.days", []] },
                  cond: {
                    $not: {
                      $and: [
                        { $eq: ["$$this.season", targetSeason] },
                        { $eq: ["$$this.day", targetDay] }
                      ]
                    }
                  }
                }
              },
              [updatedDayData]
            ]
          }
        }
      },
      {
        $set: {
          "legend.days": {
            $sortArray: { input: "$legend.days", sortBy: { season: -1, day: -1 } }
          }
        }
      },
      {
        $set: {
          "legend.days": {
            $slice: ["$legend.days", 80] // 最新80件のみ保持（先頭から）
          }
        }
      }
    );
  } else {
    updatePipeline.push({
      $set: {
        "legend.days": {
          $filter: {
            input: { $ifNull: ["$legend.days", []] },
            as: "day",
            cond: { $ne: ["$$day", null] }
          }
        }
      }
    });
  }

  // 4. 1回のデータベースアクセスでeventsとdaysを同時に更新
  const result = await client.clientMongo
    .db("jwc")
    .collection("accounts")
    .findOneAndUpdate(
      { tag: mongoAcc.tag },
      updatePipeline,
      {
        returnDocument: "after",
        projection: { legend: 1, _id: 0 }
      }
    );

  // 5. 戻り値用にnTodayを計算（更新されたdayデータから取得）
  const nToday = {
    attacks: updatedDayData ? updatedDayData.attacks : 0,
    defenses: updatedDayData ? updatedDayData.defenses : 0
  };

  result.nToday = nToday;
  return result;
}
exports.writeLogLegendR2 = writeLogLegendR2;

// eventsからdaysを集約計算する関数
function aggregateDaysFromEvents(events) {
  const daysMap = new Map(); // key: "season-day"

  events.forEach(event => {
    // legendリーグのイベントのみを処理
    if (event.leagueId !== config_coc.leagueId.legend) {
      return;
    }
    
    const key = `${event.season}-${event.day}`;

    if (!daysMap.has(key)) {
      // 新しい日の初期化
      daysMap.set(key, {
        season: event.season,
        day: event.day,
        trophies: event.trophies,
        diffTrophies: 0,
        attackTrophies: 0,  // 攻撃で増加したトロフィー数
        defenseTrophies: 0, // 防衛で減少したトロフィー数
        attacks: 0,
        defenses: 0,
        triples: 0,
        defTriples: 0
      });
    }

    const dayEntry = daysMap.get(key);

    // カウンター更新
    switch (event.action) {
      case "attack":
        dayEntry.attacks++;
        if (event.diffTrophies === 40) {
          dayEntry.triples++;
        }
        // 攻撃で増加したトロフィー数を記録（正の値のみ）
        if (event.diffTrophies > 0) {
          dayEntry.attackTrophies += event.diffTrophies;
        }
        break;
      case "defense":
        dayEntry.defenses++;
        if (event.diffTrophies === -40) {
          dayEntry.defTriples++;
        }
        // 防衛で減少したトロフィー数を記録（負の値のまま）
        if (event.diffTrophies < 0) {
          dayEntry.defenseTrophies += event.diffTrophies;
        }
        break;
    }

    // トロフィー累計
    dayEntry.diffTrophies += event.diffTrophies;

    // 最新のトロフィー数を保持
    dayEntry.trophies = event.trophies;
  });

  // Mapを配列に変換してソート
  return Array.from(daysMap.values())
    .sort((a, b) => {
      if (a.season !== b.season) return b.season - a.season;
      return b.day - a.day;
    });
}

async function sendLogLegendMain(client, scPlayer, mongoAcc, legendEventType, eventData, nEvents, i, result, seasonData) {
  let embed = null;

  // embed作成
  if (mongoAcc.legend.logSettings) {
    if (mongoAcc.legend.logSettings.post === "channel" || mongoAcc.legend.logSettings.post === "dm") {
      embed = await handleBattleLog(legendEventType, scPlayer, mongoAcc, eventData, nEvents, i, result, seasonData);
    }
    else {
      embed = null;
    }
  } else {
    embed = null;
  }

  // 送信
  if (embed) {
    await sendLogEmbed(client, mongoAcc, embed);
  }
  else {
    //await sendSimpleLogToChannel(client, mongoAcc, eventData, seasonData);
  }
}

async function handleBattleLog(legendEventType, scPlayer, mongoAcc, eventData, nEvents, i, result, seasonData) {
  const logSettings = mongoAcc.legend.logSettings;
  switch (legendEventType) {
    case "seasonReset":
      return await createLogLegendSeasonReset(scPlayer, seasonData);

    case "attack":
      if (logSettings.attacks === "all") return await createLogLegendAttack(scPlayer, eventData, result.nToday, nEvents, i, seasonData);
      break;

    case "defense":
      if (logSettings.defenses === "all") return await createLogLegendDefense(scPlayer, eventData, result.nToday, nEvents, i, seasonData);
      if (logSettings.defenses === "non-tripled" && eventData.diffTrophies !== -40) return await createLogLegendDefense(scPlayer, eventData, result.nToday, nEvents, i, seasonData);
      break;

    case "both":
      return await createLogLegendBoth(scPlayer, eventData.diffTrophies, seasonData);

    default:
      return await createLogLegendWarning(scPlayer, eventData.diffTrophies, seasonData);
  }
  return null;
}

async function sendLogEmbed(client, mongoAcc, myEmbed) {
  try {
    // ユーザー設定に基づく送信
    if (mongoAcc.legend.logSettings.post == "NA") {
    } else if (mongoAcc.legend.logSettings.post == "channel") {
      const channelUser = client.channels.cache.get(
        mongoAcc.legend.logSettings.channel,
      );
      if (channelUser?.isTextBased()) {
        await channelUser.send({ embeds: [myEmbed] });
      } else {
        console.error(
          "チャンネルが見つからないか、テキストチャンネルではありません。",
          mongoAcc.name,
          mongoAcc.tag,
        );
      }
    } else if (mongoAcc.legend.logSettings.post == "dm") {
      await sendToDM(client, mongoAcc, myEmbed);
    }

    // ログチャンネルへの送信
    const channelLog = client.channels.cache.get(config.logch.legend);
    if (channelLog?.isTextBased()) {
      await channelLog.send({ embeds: [myEmbed] });
    } else {
      console.error(
        "ログチャンネルが見つからないか、テキストチャンネルではありません。",
      );
    }
  } catch (error) {
    console.error("ログ送信中にエラーが発生しました:", error, mongoAcc.name);
  }
}

async function sendToDM(client, mongoAcc, myEmbed) {
  try {
    const pilot = await client.users.fetch(mongoAcc.pilotDC.id);
    await pilot.send({ embeds: [myEmbed] });
  } catch (error) {
    console.error("DMの送信中にエラーが発生しました:", error, mongoAcc.name);
  }
}

async function createLogLegendAttack(scPlayer, eventData, nToday, nEvents, i, seasonData) {
  const myEmbed = new EmbedBuilder();
  myEmbed.setTitle(`${config.emote.sword} ${createDescriptionLegend(eventData.diffTrophies)}`);
  let footer = "";
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    footer = `#${nToday.attacks - nEvents + i + 1} | ` +
      `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | ${scPlayer.leagueTier.name.toUpperCase()}`;
  }
  else {
    footer = `${scPlayer.leagueTier.name.toUpperCase()}`;
  }
  myEmbed.setFooter({ text: footer, iconURL: scPlayer.leagueTier.icon.url });
  myEmbed.setColor(config.color.attack);
  myEmbed.setTimestamp();
  let description = `<t:${eventData.unixTimeSeconds}:t> :trophy: ${eventData.trophiesCurrent} ${config.emote.thn[scPlayer.townHallLevel]} **${scPlayer.name}**\n`;
  if (eventData.leagueId == config_coc.leagueId.legend) {
    description += `${config.emote.discord}</legend stats:${config.command.legend.id}>`;
    description += ` ${config.emote.discord}</legend history own:${config.command.legend.id}>`;
  }
  myEmbed.setDescription(description);

  return myEmbed;
}

async function createLogLegendDefense(scPlayer, eventData, nToday, nEvents, i, seasonData) {
  const myEmbed = new EmbedBuilder();
  let title = "";
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    title = `${config.emote.shield} ${createDescriptionLegend(eventData.diffTrophies)}`;
  }
  else {
    title = `${config.emote.shield} ${createDescriptionNonLegend(eventData.diffTrophies)}`;
  }
  myEmbed.setTitle(title);
  let footer = "";
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    footer = `#${nToday.defenses - nEvents + i + 1} | ` +
      `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | ${scPlayer.leagueTier.name.toUpperCase()}`;
  }
  else {
    footer = `${scPlayer.leagueTier.name.toUpperCase()}`;
  }
  myEmbed.setFooter({ text: footer, iconURL: scPlayer.leagueTier.icon.url });
  myEmbed.setColor(config.color.defense);
  myEmbed.setTimestamp();
  let description = `<t:${eventData.unixTimeSeconds}:t> :trophy: ${eventData.trophiesCurrent} ${config.emote.thn[scPlayer.townHallLevel]} **${scPlayer.name}**\n`;
  if (eventData.leagueId == config_coc.leagueId.legend) {
    description += `${config.emote.discord}</legend stats:${config.command.legend.id}>`;
    description += ` ${config.emote.discord}</legend history own:${config.command.legend.id}>`;
  }
  myEmbed.setDescription(description);

  return myEmbed;
}

async function createLogLegendBoth(scPlayer, diffTrophies, seasonData) {
  const myEmbed = new EmbedBuilder();
  myEmbed.setTitle(`**RANKED BATTLES LOG**`);
  let footer = "";
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    footer = `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  }
  else {
    footer = `${scPlayer.leagueTier.name.toUpperCase()}`;
  }
  myEmbed.setFooter({ text: footer, iconURL: scPlayer.leagueTier.icon.url });
  myEmbed.setColor(config.color.legend);
  myEmbed.setTimestamp();
  let description = `${config.emote.thn[scPlayer.townHallLevel]} **${scPlayer.name}** | ${scPlayer.tag}\n\n`;
  if (diffTrophies >= 0) {
    description += `:trophy: ${scPlayer.trophies} ( **+${diffTrophies}** )\n`;
  } else {
    description += `:trophy: ${scPlayer.trophies} ( **${diffTrophies}** )\n`;
  }
  description += `\n`;
  description += `:exclamation: The defense coincided with the attack.\n`;
  myEmbed.setDescription(description);

  return myEmbed;
}

async function createLogLegendWarning(scPlayer, diffTrophies, seasonData) {
  const myEmbed = new EmbedBuilder();
  myEmbed.setTitle(`**RANKED BATTLES LOG**`);
  let footer = "";
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    footer = `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  }
  else {
    footer = `${scPlayer.leagueTier.name.toUpperCase()}`;
  }
  myEmbed.setFooter({ text: footer, iconURL: scPlayer.leagueTier.icon.url });
  myEmbed.setColor(config.color.legend);
  myEmbed.setTimestamp();
  let description = `${config.emote.thn[scPlayer.townHallLevel]} **${scPlayer.name}** | ${scPlayer.tag}\n\n`;
  if (diffTrophies >= 0) {
    description += `:trophy: ${scPlayer.trophies} ( **+${diffTrophies}** )\n`;
  } else {
    description += `:trophy: ${scPlayer.trophies} ( **${diffTrophies}** )\n`;
  }
  description += `\n`;
  description += `:exclamation: There are two or more attacks/defenses while not being monitored.\n`;
  myEmbed.setDescription(description);

  return myEmbed;
}

async function createLogLegendSeasonReset(scPlayer, seasonData) {
  const myEmbed = new EmbedBuilder();
  myEmbed.setTitle(`**RANKED BATTLES LOG**`);
  myEmbed.setFooter({
    text: `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`,
    iconURL: scPlayer.leagueTier.icon.url
  });
  myEmbed.setColor(config.color.attack);
  myEmbed.setTimestamp();

  let description = `${config.emote.thn[scPlayer.townHallLevel]} **${scPlayer.name}** | ${scPlayer.tag}\n\n`;
  description += `:trophy: **5000**\n\n`;
  description += `:sparkles: New season has started.\n`;
  myEmbed.setDescription(description);

  return myEmbed;
}

function createDescriptionLegend(diffTrophies) {
  let description = "";
  if (diffTrophies < 0) {
    description += `**${diffTrophies}** `;
  } else {
    description += `**+${diffTrophies}** `;
  }
  if (functions.countStarsLegend(diffTrophies) == 0) {
    description += `${config.emote.starGray}`;
  } else {
    for (let i = 1; i <= functions.countStarsLegend(diffTrophies); i++) {
      description += `${config.emote.star}`;
    }
    if (functions.countStarsLegend(diffTrophies) == 3) {
      description += ` :boom:`;
    }
  }
  return description;
}

function createDescriptionNonLegend(diffTrophies) {
  let description = "";
  if (diffTrophies < 0) {
    description += `**${diffTrophies}** `;
  } else {
    description += `**+${diffTrophies}** `;
  }
  if (functions.countStarsNonLegend(diffTrophies) == 0) {
    description += `${config.emote.starGray}`;
  } else {
    for (let i = 1; i <= functions.countStarsNonLegend(diffTrophies); i++) {
      description += `${config.emote.star}`;
    }
    if (functions.countStarsNonLegend(diffTrophies) == 3) {
      description += ` :boom:`;
    }
  }
  return description;
}

/*async function createLogLegendNonLegend(scPlayer, diffTrophies, seasonData) {
  const myEmbed = new EmbedBuilder();
  myEmbed.setTitle(`**RANKED BATTLES LOG**`);
  const footer = `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  myEmbed.setFooter({ text: footer, iconURL: scPlayer.leagueTier.icon.url });
  myEmbed.setColor(config.color.legend);
  myEmbed.setTimestamp();
  let description = `${config.emote.thn[scPlayer.townHallLevel]} **${scPlayer.name}** | ${scPlayer.tag}\n\n`;
  if (diffTrophies >= 0) {
    description += `:trophy: ${scPlayer.trophies} ( **+${diffTrophies}** )\n`;
  } else {
    description += `:trophy: ${scPlayer.trophies} ( **${diffTrophies}** )\n`;
  }
  description += `\n`;
  description += `:exclamation: *The account is not in Legend League.*\n`;
  myEmbed.setDescription(description);

  return myEmbed;
}*/

/*async function createLogLegendReset(scPlayer, seasonData) {
  const myEmbed = new EmbedBuilder();
  myEmbed.setTitle(`**LEGEND LOG**`);
  const footer = `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  myEmbed.setFooter({ text: footer, iconURL: scPlayer.leagueTier.icon.url });
  myEmbed.setColor(config.color.attack);
  myEmbed.setTimestamp();
  let description = "";
  description += config.emote.thn[scPlayer.townHallLevel];
  description += ` **${scPlayer.name}**\n`;
  description += ` ${scPlayer.tag}\n`;
  description += `\n`;
  //description += `:trophy: **5000**\n`;
  //description += `\n`;
  description += `*New season has started.*\n`;
  description += `* ${seasonData.seasonId} SEASON\n`;
  description += `* ${seasonData.daysEnd} DAYS\n`;
  description += `* Start: ${seasonData.seasonStart}\n`;
  description += `* End: ${seasonData.seasonEnd}\n`;
  myEmbed.setDescription(description);

  return myEmbed;
}*/

async function autoUpdateLegendReset(client) {
  var query = { status: true };
  var sort = { trophies: -1 };
  var cursor = client.clientMongo
    .db("jwc")
    .collection("accounts")
    .find(query, {
      projection: {
        _id: 0,
        tag: 1,
      }
    })
    .sort(sort);
  let accountsAll = await cursor.toArray();
  await cursor.close();

  const nAccLoop = 30;
  let nLoop = Math.floor(accountsAll.length / nAccLoop) + 1;

  for (let i = 0; i < nLoop; i++) {
    let min = nAccLoop * i;
    let max = nAccLoop * (i + 1);
    if (max > accountsAll.length) {
      max = accountsAll.length;
    }
    const accs = accountsAll.slice(min, max);

    // Promise.allを使用して並列処理を制御
    await Promise.all(
      accs.map((acc) =>
        updateLegendPreviousSeason(
          client.clientMongo,
          client.clientCoc,
          acc.tag,
        ).catch((error) => console.error(error)),
      ),
    );

    console.log(`${max} / ${accountsAll.length}`);
    await functions.sleep(1000);
  }

  // legend [previous season]
  await fRanking.rankingLegend(
    client.clientMongo,
    (nameItem = "previous"),
    (nameRanking = "legendPreviousSeason"),
    (key = "legend.previous.trophies"),
  );

  return;
}
exports.autoUpdateLegendReset = autoUpdateLegendReset;

async function updateLegendPreviousSeason(clientMongo, clientCoc, playerTag) {
  try {
    let mongoAcc = await clientMongo
      .db("jwc")
      .collection("accounts")
      .findOne(
        { tag: playerTag },
        { projection: { legend: 1, _id: 0 } }
      );

    if (mongoAcc.legend) {
      let listingUpdate = {};
      listingUpdate.attackWins = 0;
      listingUpdate.defenseWins = 0;
      listingUpdate.diffAttackWins = 0;
      listingUpdate.diffDefenseWins = 0;

      const resultScan = await functions.scanAcc(clientCoc, playerTag);
      listingUpdate.legend.previous = resultScan.scPlayer.legendStatistics?.previousSeason ?? null;

      await clientMongo
        .db("jwc")
        .collection("accounts")
        .updateOne({ tag: playerTag }, { $set: listingUpdate });
    }
  } catch (error) {
    console.error(error);
  }
  return;
}
