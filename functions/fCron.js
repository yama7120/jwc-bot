import { EmbedBuilder } from 'discord.js';

import config from '../config/config.js';
import schedule from '../config/schedule.js';
import config_coc from '../config/config_coc.js';

import * as functions from './functions.js';
import * as fMongo from './fMongo.js';
import { getWeekNow } from './weekNow.js';
import * as fGetWars from './fGetWars.js';
import * as fRanking from './fRanking.js';
import * as fCanvas from './fCanvas.js';
import { reportError } from './errorReport.js';

const WAR_UPDATE_CONCURRENCY = 4;


async function cronWarAutoUpdate(client, league) {
  const unixTime = Math.floor(Date.now() / 1000);
  const status = config.cronWarStatus[league];
  const weekNow = getWeekNow(league);
  if (status == 'on') {
    await autoUpdateWar(client, league, weekNow);
  }
  if (league == 'j1') { // 通信料削減のためJ1のときだけbot status更新
    functions.updateStatusInfo(client, unixTime);
  }
}
export { cronWarAutoUpdate };


async function autoUpdateWar(client, league, week) {
  const startedAt = Date.now();
  const cursor = client.clientMongo.db('jwc').collection('wars')
    .find({ season: config.season[league], league: league, week: week, 'result.state': { $ne: 'warEnded' } });
  const mongoWars = await cursor.toArray();
  await cursor.close();

  let sumFlagUpdate = 0;

  await runWithConcurrency(
    mongoWars,
    WAR_UPDATE_CONCURRENCY,
    async (mongoWar) => {
      const result = await fGetWars.getClanWarUpdateDB(client, mongoWar);
      sumFlagUpdate += result || 0;
    },
    client,
    'cronWar:update',
  );

  if (sumFlagUpdate > 0) {
    await functions.updateWarInfo(client, league, week);
  }

  const cursor2 = client.clientMongo.db('jwc').collection('wars')
    .find({ season: config.season[league], league: league, week: { $in: [week, week + 1] }, 'result.state': { $ne: 'warEnded' } });
  const mongoWars2 = await cursor2.toArray();
  await cursor2.close();

  await runWithConcurrency(
    mongoWars2,
    WAR_UPDATE_CONCURRENCY,
    async (mongoWar) => {
      if (mongoWar.deal?.unixTime) {
        const date = new Date(mongoWar.deal.unixTime * 1000);
        const now = new Date();
        const timeDifference = date - now;
        const hoursDifference = timeDifference / (1000 * 60 * 60);
        if (hoursDifference >= 12 && hoursDifference <= 24) {
          await sendReminderMain(client, mongoWar);
        }
      }
    },
    client,
    'cronWar:reminder',
  );
  void startedAt;
}

async function sendReminderMain(client, mongoWar) {
  const mongoClanA = await client.clientMongo.db('jwc').collection('clans').findOne({ clan_abbr: mongoWar.clan_abbr });
  const mongoClanB = await client.clientMongo.db('jwc').collection('clans').findOne({ clan_abbr: mongoWar.opponent_abbr });

  if (!mongoWar.deal.remainder) {
    const result = await sendReminder(client, mongoWar.nego_channel, mongoWar, mongoClanA, mongoClanB);

    if (mongoClanA.log?.deal?.switch == 'on') {
      await sendReminder(client, mongoClanA.log.deal.channel_id, mongoWar, mongoClanA, mongoClanB);
    }

    if (mongoClanB.log?.deal?.switch == 'on') {
      await sendReminder(client, mongoClanB.log.deal.channel_id, mongoWar, mongoClanA, mongoClanB);
    }

    if (result) {
      const listingUpdate = {
        deal: {
          ...mongoWar.deal,
          remainder: true
        }
      };
      await client.clientMongo.db('jwc').collection('wars').updateOne({ _id: mongoWar._id }, { $set: listingUpdate });
    } else {
      console.error('Failed to send reminder message');
    }
  }
}

async function sendReminder(client, channelId, mongoWar, mongoClanA, mongoClanB) {
  const weekNow = getWeekNow(mongoWar.league);

  const isBotDataFetchOK = mongoWar.week === weekNow;

  const myEmbed = new EmbedBuilder();

  const title = `:bell: **REMINDER**${isBotDataFetchOK ? ' :white_check_mark:' : ''}`;

  const descriptionLines = [
    `* ${config.league[mongoWar.league]}`,
    `* WEEK ${mongoWar.week}`,
    `* ${mongoWar.name_match || schedule.match['m' + mongoWar.match]}`,
    ``,
    `**${mongoClanA.team_name} :vs: ${mongoClanB.team_name}**`,
    ``,
    `:calendar: <t:${mongoWar.deal.unixTime}:F> (<t:${mongoWar.deal.unixTime}:R>)`,
    `:hourglass_flowing_sand:  ${mongoWar.deal.prep_time}  /  :crossed_swords:  ${mongoWar.deal.battle_time}`,
  ];

  const clanTagA = mongoClanA?.clan_tag;
  const clanTagB = mongoClanB?.clan_tag;
  if (clanTagA && clanTagB) {
    const clanLinkA =
      'https://link.clashofclans.com/?action=OpenClanProfile&tag=' +
      clanTagA.slice(1);
    const clanLinkB =
      'https://link.clashofclans.com/?action=OpenClanProfile&tag=' +
      clanTagB.slice(1);
    descriptionLines.push(
      ``,
      `[__**${clanTagA}**__](${clanLinkA}) ${mongoClanA.clan_name}`,
      `[__**${clanTagB}**__](${clanLinkB}) ${mongoClanB.clan_name}`,
    );
  }

  const description = descriptionLines.join('\n');
  const footer = config.footer;

  myEmbed.setTitle(title);
  myEmbed.setDescription(description);
  myEmbed.setColor(config.color[mongoWar.league]);
  myEmbed.setFooter({ text: footer, iconURL: config.urlImage.jwc });
  myEmbed.setTimestamp();

  let channelName = 'unknown';
  try {
    let channel = client.channels.cache.get(channelId);
    if (!channel) {
      channel = await client.channels.fetch(channelId).catch(() => null);
    }
    channelName = channel?.name || 'unknown';

    if (!channel || !channel.isTextBased()) {
      throw new Error('Channel not found or not text-based');
    }
    let botMember = channel.guild?.members?.me ?? null;
    if (!botMember && channel.guild) {
      botMember = await channel.guild.members.fetchMe().catch(() => null);
    }
    const permissions = botMember ? channel.permissionsFor(botMember) : null;
    if (
      permissions &&
      (!permissions.has('ViewChannel') ||
        !permissions.has('SendMessages') ||
        (channel.isThread?.() && !permissions.has('SendMessagesInThreads')))
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

async function cronUpdate2am(client) {
  const startedAt = Date.now();
  const currentDate = new Date();
  // cronUpdate2am は「JST 02:00 切替」側の処理（Legend I 以外）
  const seasonData = functions.calculateSeasonValues(client, currentDate, 17);
  const nAccs = await autoUpdateAcc(client);

  await fRanking.rankingMain(client.clientMongo);
  console.log(`[cronUpdate2am] elapsed=${Date.now() - startedAt}ms accounts=${nAccs}`);
}
export { cronUpdate2am };

async function cronUpdate2pmLegend1(client) {
  const startedAt = Date.now();
  const currentDate = new Date();
  // Legend I の日境界: JST 14:00 (= UTC 05:00)
  const seasonData = functions.calculateSeasonValues(client, currentDate, 5);

  // 14:00 に全体更新・ランキング更新も集約する
  const nAccs = await autoUpdateAcc(client);
  await fRanking.rankingMain(client.clientMongo);

  // Legend I の日次サマリ（TOP10 / day start / result / day entry）
  await sendLogUpdated(client, nAccs, seasonData);
  await sendLogLegendDay(client, seasonData);
  await sendLegendResult(client, seasonData);
  await functions.updateStatusInfoLegend(client, seasonData);
  await addNewDayToLegendAccounts(client, seasonData);

  console.log(`[cronUpdate2pmLegend1] elapsed=${Date.now() - startedAt}ms accounts=${nAccs}`);
}
export { cronUpdate2pmLegend1 };

async function addNewDayToLegendAccounts(client, seasonData) {
  try {
    const configData = await client.clientMongo
      .db('jwc')
      .collection('config')
      .findOne({ name: 'rankedBattlesSeason' });

    let seasonId, currentDay;
    if (!configData) {
      console.log('rankedBattlesSeason config not found, using seasonData values');
      seasonId = seasonData.seasonId;
      currentDay = seasonData.daysNow;
    } else {
      seasonId = configData.seasonId;
      currentDay = configData.currentDay;
    }

    const query = {
      status: true,
      'legend.days': { $exists: true, $ne: null }
    };

    const accounts = await client.clientMongo
      .db('jwc')
      .collection('accounts')
      .find(query)
      .toArray();

    console.log(`Found ${accounts.length} accounts with legend.days array`);

    let nSkipped = 0;
    for (const account of accounts) {
      try {
        const daysArr = Array.isArray(account?.legend?.days) ? account.legend.days : [];

        // 既に当日エントリ (season, day) が存在するアカウントはスキップ（重複 push 防止）
        const hasCurrentDay = daysArr.some(
          (d) => d?.season === seasonId && d?.day === currentDay,
        );
        if (hasCurrentDay) {
          nSkipped += 1;
          continue;
        }

        // 新しい1日の開始トロフィーは、直前の day の終了値（無ければ現在のトロフィー）を引き継ぐ
        // 当日エントリが存在しない前提なので、legend.days[0] は前日以前のもの
        const prevDayTrophies = Number(daysArr[0]?.trophies);
        const startingTrophies = Number.isFinite(prevDayTrophies) && prevDayTrophies > 0
          ? prevDayTrophies
          : Number(account?.trophies) || 0;

        const newDayObject = {
          season: seasonId,
          day: currentDay,
          trophies: startingTrophies,
          diffTrophies: 0,
          attacks: 0,
          defenses: 0,
          triples: 0,
          defTriples: 0,
          attackTrophies: 0,
          defenseTrophies: 0,
          globalRank: null,
          japanRank: null
        };

        // 競合対策: フィルタ側で当日エントリが無いことを再確認（read→write 間に
        // ランク戦経由で day=currentDay が作られた場合は no-op になる）
        await client.clientMongo
          .db('jwc')
          .collection('accounts')
          .updateOne(
            {
              tag: account.tag,
              'legend.days': {
                $not: {
                  $elemMatch: { season: seasonId, day: currentDay },
                },
              },
            },
            {
              $push: {
                'legend.days': {
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
    if (nSkipped > 0) {
      console.log(`Skipped ${nSkipped} accounts already having day=${currentDay} entry`);
    }

    console.log('Successfully added new day objects to legend accounts');
  } catch (error) {
    console.error('Error in addNewDayToLegendAccounts:', error);
  }
}

async function autoUpdateAcc(client) {
  console.log(`start: autoUpdateAcc`);

  const query = { status: true };
  const options = { projection: { _id: 0, tag: 1 } };
  const sort = { trophies: -1 };
  const cursor = client.clientMongo.db('jwc').collection('accounts').find(query, options).sort(sort);
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

async function autoUpdateAccLegend1(client) {
  console.log(`start: autoUpdateAccLegend1`);

  const query = {
    status: true,
    'leagueTier.id': config_coc.leagueId.legend,
  };
  const options = { projection: { _id: 0, tag: 1 } };
  const sort = { trophies: -1 };
  const cursor = client.clientMongo
    .db('jwc')
    .collection('accounts')
    .find(query, options)
    .sort(sort);
  const accountsAll = await cursor.toArray();
  await cursor.close();
  console.log(`accountsLegend1: ${accountsAll.length}`);

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

function findLegendDayStats(acc, targetSeason, targetDay) {
  const daysArr = Array.isArray(acc.legend?.days) ? acc.legend.days : [];
  return (
    daysArr.find((d) => d?.season === targetSeason && d?.day === targetDay) ?? null
  );
}

/** 終了した legend 日の trophies で降順 TOP10（表示数値と同じキーでソート） */
function pickTop10ByLegendDayTrophies(accountsAll, targetSeason, targetDay) {
  return accountsAll
    .map((acc) => {
      const dayStats = findLegendDayStats(acc, targetSeason, targetDay);
      const trophies = Number(dayStats?.trophies);
      if (!dayStats || !Number.isFinite(trophies)) {
        return null;
      }
      return { acc, dayStats };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.dayStats.trophies) - Number(a.dayStats.trophies))
    .slice(0, 10);
}

async function sendLogUpdated(client, nAccs, seasonData) {
  // cron は JST 14:00 起動。表示・ソート対象は終了した日 (daysNow - 1) の日次サマリ
  const targetSeason = seasonData.seasonId;
  const targetDay = seasonData.daysNow - 1;

  const query = { status: true, 'legend.days': { $ne: null } };
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
  const cursor = client.clientMongo.db('jwc').collection('accounts').find(query, options);
  const accountsAll = await cursor.toArray();
  await cursor.close();

  const top10 = pickTop10ByLegendDayTrophies(accountsAll, targetSeason, targetDay);
  const legends200 = await client.clientMongo
    .db('jwc')
    .collection('ranking')
    .findOne(
      { name: 'legends200' },
      { projection: { _id: 0, japan: 1, global: 1 } }
    );
  const global200 = legends200?.global?.find((player) => player.rank === 200)
    ?? legends200?.global?.[199]
    ?? null;
  const japan200 = legends200?.japan?.find((player) => player.rank === 200)
    ?? legends200?.japan?.[199]
    ?? null;

  const myEmbed = new EmbedBuilder();
  const title = `:white_check_mark: **UPDATED**`;

  const unixTimeRequest =
    top10[0]?.acc?.unixTimeRequest ?? Math.round(Date.now() / 1000);
  const descriptionLines = [
    `<t:${Math.round(unixTimeRequest)}:t> (<t:${Math.round(unixTimeRequest)}:R>)`,
    '*The data for all JWC accounts has been successfully updated.*',
    `*${nAccs} accounts*`,
    ``,
    `${config.emote.legend} **TOP 10 LEGEND PLAYERS** (DAY ${targetDay})`
  ];

  top10.forEach(({ acc, dayStats }, index) => {
    const diffTrophies =
      dayStats.diffTrophies >= 0
        ? `+${dayStats.diffTrophies}`
        : `${dayStats.diffTrophies}`;
    const attackTrophies = dayStats.attackTrophies ?? 0;
    const defenseTrophies = dayStats.defenseTrophies ?? 0;
    const attackTrophiesText = attackTrophies >= 0 ? `+${attackTrophies}` : `${attackTrophies}`;
    const defenseTrophiesText =
      defenseTrophies >= 0 ? `+${defenseTrophies}` : `${defenseTrophies}`;
    const emoteTH = config.emote.thn[acc.townHallLevel];
    const nameAcc = `**${functions.nameReplacer(acc.name)}**`;
    const clanInfo = acc.homeClanAbbr.j != ''
      ? ` | ${config.emote.jwc} ${String(acc.homeClanAbbr.j).toUpperCase()}`
      : '';

    descriptionLines.push(
      [
        `${index + 1}.`,
        `**${dayStats.trophies}**`,
        `[${diffTrophies}]`,
        `${config.emote.sword}${attackTrophiesText}`,
        `${config.emote.shield}${defenseTrophiesText}`,
        `${emoteTH}`,
        `${nameAcc}${clanInfo}`
      ].filter(Boolean).join(' ')
    );
  });

  if (top10.length === 0) {
    descriptionLines.push(
      `_No legend day stats for season ${targetSeason} day ${targetDay}._`,
    );
  }

  descriptionLines.push(
    ``,
    `:earth_asia: **GLOBAL LEGENDS**`,
    global200
      ? `200th border: **${global200.trophies}**`
      : `200th border: N/A`,
    ``,
    `:flag_jp: **JAPANESE LEGENDS**`,
    japan200
      ? `200th border: **${japan200.trophies}**`
      : `200th border: N/A`,
  );

  descriptionLines.push(
    ``,
    `${config.emote.discord} **USEFUL COMMANDS**`,
    `</ranking account_data:${config.command['ranking'].id}>`,
    `</ranking legend:${config.command['ranking'].id}>`,
    `</legend global:${config.command['legend'].id}>`,
    `</legend japan_local:${config.command['legend'].id}>`,
    `</help commands:${config.command['help'].id}>`
  );

  const description = descriptionLines.join('\n');
  const footer = config.footer;

  myEmbed.setTitle(title);
  myEmbed.setDescription(description);
  myEmbed.setColor(config.color.main);
  myEmbed.setFooter({ text: footer, iconURL: config.urlImage.jwc });
  await client.channels.cache.get(config.logch.freeBotRoom).send({ embeds: [myEmbed] });
}

function legendAccountHasBattleNotifications(logSettings) {
  if (!logSettings) return false;
  const attacksOn = logSettings.attacks === 'all';
  const defensesOn =
    logSettings.defenses === 'all' || logSettings.defenses === 'non-tripled';
  return attacksOn || defensesOn;
}

async function sendLegendDayEmbedToAccount(client, mongoAcc, embed) {
  const logSettings = mongoAcc?.legend?.logSettings;
  if (!logSettings || logSettings.post === 'NA') return;
  if (!legendAccountHasBattleNotifications(logSettings)) return;

  try {
    if (logSettings.post === 'channel') {
      let channel = client.channels.cache.get(logSettings.channel);
      if (!channel) {
        channel = await client.channels.fetch(logSettings.channel).catch(() => null);
      }
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] });
      } else {
        console.error(
          'Day start: channel not found or not text-based',
          mongoAcc.name,
          mongoAcc.tag,
        );
      }
    } else if (logSettings.post === 'dm') {
      const pilotId = extractPilotId(mongoAcc);
      if (!pilotId) {
        console.warn('Day start: pilotDC.id missing', mongoAcc.tag);
        return;
      }
      const pilot = await client.users.fetch(pilotId);
      await pilot.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Day start notification failed:', mongoAcc.name, mongoAcc.tag, error);
  }
}

async function sendLogLegendDayToMonitoredLegend1(client, embed) {
  const query = {
    status: true,
    'leagueTier.id': config_coc.leagueId.legend,
    'legend.logSettings.post': { $in: ['channel', 'dm'] },
    $or: [
      { 'legend.logSettings.attacks': 'all' },
      { 'legend.logSettings.defenses': 'all' },
      { 'legend.logSettings.defenses': 'non-tripled' },
    ],
  };
  const projection = {
    _id: 0,
    tag: 1,
    name: 1,
    pilotDC: 1,
    legend: 1,
  };
  const accounts = await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .find(query, { projection })
    .toArray();

  console.log(`sendLogLegendDayToMonitoredLegend1: ${accounts.length} accounts`);

  for (const acc of accounts) {
    await sendLegendDayEmbedToAccount(client, acc, embed);
    await functions.sleep(200);
  }
}

async function sendLogLegendDay(client, seasonData) {
  const myEmbed = new EmbedBuilder();
  const title = `:white_check_mark: **UPDATED**`;

  const descriptionLines = [
    `<t:${Math.round(Date.now() / 1000)}:t> (<t:${Math.round(Date.now() / 1000)}:R>)`,
    `*Day ${seasonData.daysNow} has started.*`,
    `*${seasonData.daysEnd} days to go.*`
  ];

  const description = descriptionLines.join('\n');
  const footer = `SEASON ${seasonData.seasonId}`;

  myEmbed.setTitle(title);
  myEmbed.setDescription(description);
  myEmbed.setColor(config.color.legend);
  myEmbed.setFooter({ text: footer, iconURL: config.urlImage.legend });

  const freeCh = client.channels.cache.get(config.logch.freeBotRoom);
  if (freeCh?.isTextBased()) {
    await freeCh.send({ embeds: [myEmbed] });
  } else {
    console.error('freeBotRoom not found or not text-based');
  }

  await sendLogLegendDayToMonitoredLegend1(client, myEmbed);
}


async function sendLegendResult(client, seasonData) {
  const query = {
    status: true,
    'legend.logSettings.result': 'true',
    'legend.current': { $ne: null }
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

  const cursor = client.clientMongo.db('jwc').collection('accounts').find(query, options);
  const mongoAccs = await cursor.toArray();
  await cursor.close();

  const legends200 = await client.clientMongo.db('jwc').collection('ranking').findOne(
    { name: 'legends200' },
    { projection: { _id: 0, japan: 1, global: 1 } }
  );
  const japanRankMap = new Map((legends200?.japan ?? []).map(player => [player.tag, player.rank]));
  const globalRankMap = new Map((legends200?.global ?? []).map(player => [player.tag, player.rank]));
  const legend200Borders = getLegendRank200BorderTrophies(legends200);
  const summaryByPilot = new Map();

  console.log(`sendLegendResult: ${mongoAccs.length}`);

  for (let i = 0; i < mongoAccs.length; i++) {
    const mongoAcc = mongoAccs[i];

    console.log(`[${i + 1}/${mongoAccs.length}] アカウント処理中: ${mongoAcc.name} (${mongoAcc.tag}) ${mongoAcc.leagueTier.name}`);
    if (mongoAcc.leagueTier.id == config_coc.leagueId.legend) {
      try {
        const resultR1 = await fCanvas.legendStatsR1(client, mongoAcc, 'previous');
        const rankInfo = {
          global: globalRankMap.get(mongoAcc.tag) ?? mongoAcc.legend?.current?.rank ?? null,
          japan: japanRankMap.get(mongoAcc.tag) ?? null
        };
        await saveLegendRankHistoryForDay(client, mongoAcc.tag, resultR1?.dayStats, rankInfo);
        await sendLogAttachment(client, mongoAcc, resultR1, seasonData, rankInfo, legend200Borders);
        collectLegendSummary(summaryByPilot, mongoAcc, resultR1, rankInfo);

        await functions.sleep(500);
      } catch (error) {
        console.error(`[${i + 1}/${mongoAccs.length}] エラー発生 (${mongoAcc.tag}): ${error.message}`);
        await functions.sleep(1000);
      }
    }
  }

  await sendLegendSummaryByPilot(client, seasonData, summaryByPilot);
  console.log('end: sendLegendResult');
}

function getLegendRank200BorderTrophies(legends200) {
  const global200 =
    legends200?.global?.find((player) => player.rank === 200) ??
    legends200?.global?.[199] ??
    null;
  const japan200 =
    legends200?.japan?.find((player) => player.rank === 200) ??
    legends200?.japan?.[199] ??
    null;
  return {
    global: Number.isFinite(global200?.trophies) ? global200.trophies : null,
    japan: Number.isFinite(japan200?.trophies) ? japan200.trophies : null
  };
}

async function sendLogAttachment(client, mongoAcc, result, seasonData, rankInfo = {}, legend200Borders = {}) {
  const embed = new EmbedBuilder();
  const title = `${config.emote.legend} RESULT OF ${seasonData.daysNow == 1 ? 'THE LAST DAY' : `DAY ${seasonData.daysNow - 1}`}`;
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

  const formattedStart = Number.isFinite(startTrophies) ? `**${startTrophies}**` : '*N/A*';
  const formattedEnd = Number.isFinite(endTrophies) ? `**${endTrophies}**` : '*N/A*';
  const formattedDiff = Number.isFinite(diffTrophies)
    ? (diffTrophies >= 0 ? `**+${diffTrophies}**` : `**${diffTrophies}**`)
    : '*N/A*';
  const formattedDiffWithArrow = Number.isFinite(diffTrophies)
    ? `${diffTrophies >= 0 ? config.emote.up : config.emote.down}${formattedDiff}`
    : formattedDiff;
  const formattedAttackTrophies = Number.isFinite(attackTrophies) ? `**+${attackTrophies}**` : '*N/A*';
  const formattedDefenseTrophies = Number.isFinite(defenseTrophies) ? `**${defenseTrophies}**` : '*N/A*';
  const formattedGlobalRank = Number.isFinite(globalRank) ? `**#${globalRank}**` : '*N/A*';
  const formattedJapanRank = Number.isFinite(japanRank) ? `**#${japanRank}**` : '*N/A*';

  if (result.isPerfect) {
    description += `\n\n:boom: **8 TRIPLES** 🎉\n`;
    description += `*Perfect Legend Day!*`;
  }
  description += `\n\n:trophy: Start: ${formattedStart}`;
  description += `\n:trophy: End: ${formattedEnd} [${formattedDiffWithArrow}]`;
  description += `\n${config.emote.sword} Attack Trophies: ${formattedAttackTrophies}`;
  description += `\n${config.emote.shield} Defense Trophies: ${formattedDefenseTrophies}`;
  description += `\n:globe_with_meridians: Global Rank: ${formattedGlobalRank}`;
  const borderGlobal = legend200Borders.global ?? null;
  if (Number.isFinite(endTrophies) && Number.isFinite(borderGlobal)) {
    const vsGlobal = endTrophies - borderGlobal;
    const vsGlobalFormatted =
      vsGlobal >= 0 ? `**+${vsGlobal}**` : `**${vsGlobal}**`;
    const vsGlobalArrow = vsGlobal >= 0 ? ':green_circle:' : ':red_circle:';
    description += `\n:earth_asia: vs Global 200th (**${borderGlobal}**): ${vsGlobalArrow}${vsGlobalFormatted}`;
  }
  if (Number.isFinite(japanRank)) {
    description += `\n:flag_jp: Japan Rank: ${formattedJapanRank}`;
  }
  const borderJapan = legend200Borders.japan ?? null;
  if (Number.isFinite(endTrophies) && Number.isFinite(borderJapan)) {
    const vsJapan = endTrophies - borderJapan;
    const vsJapanFormatted =
      vsJapan >= 0 ? `**+${vsJapan}**` : `**${vsJapan}**`;
    const vsJapanArrow = vsJapan >= 0 ? ':green_circle:' : ':red_circle:';
    description += `\n:flag_jp: vs Japan 200th (**${borderJapan}**): ${vsJapanArrow}${vsJapanFormatted}`;
  }
  embed.setDescription(description);
  embed.setColor(config.color.legend);
  const footer = `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  embed.setFooter({ text: footer, iconURL: config.urlImage.legend });

  const attachmentHistory = await fCanvas.legendHistory(mongoAcc);

  try {
    if (mongoAcc.legend.logSettings.post === 'channel') {
      let channel = client.channels.cache.get(mongoAcc.legend.logSettings.channel);
      if (!channel) {
        channel = await client.channels.fetch(mongoAcc.legend.logSettings.channel).catch(() => null);
      }
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] });
        await channel.send({ files: [result.attachment] });
        await channel.send({ files: [attachmentHistory] });
      } else {
        console.error(
          'Result: channel not found or not text-based',
          mongoAcc.name,
          mongoAcc.tag,
        );
      }
    } else if (mongoAcc.legend.logSettings.post === 'dm') {
      const pilotId = extractPilotId(mongoAcc);
      if (!pilotId) {
        throw new Error('pilotDC.id is missing for DM destination');
      }
      const pilot = await client.users.fetch(pilotId);
      await pilot.send({ embeds: [embed] });
      await pilot.send({ files: [result.attachment] });
      await pilot.send({ files: [attachmentHistory] });
    }
  } catch (error) {
    console.error(`メッセージの送信中にエラーが発生しました: ${mongoAcc.name}`, error);
  }
  // 14時のresult系バックアップ通知先
  const disableLegendLogs = process.env.DISABLE_LEGEND_LOGS === 'true';
  if (!disableLegendLogs && config.logch.legend_result) {
    let backupChannel = client.channels.cache.get(config.logch.legend_result);
    if (!backupChannel) {
      backupChannel = await client.channels.fetch(config.logch.legend_result).catch(() => null);
    }
    if (backupChannel) {
      await backupChannel.send({ embeds: [embed] });
      await backupChannel.send({ files: [result.attachment] });
      await backupChannel.send({ files: [attachmentHistory] });
    }
  }
}

async function saveLegendRankHistoryForDay(client, tag, dayStats, rankInfo) {
  const season = dayStats?.season;
  const day = dayStats?.day;
  if (!season || !Number.isFinite(day)) {
    return;
  }
  const globalRank = Number.isFinite(rankInfo?.global) ? rankInfo.global : null;
  const japanRank = Number.isFinite(rankInfo?.japan) ? rankInfo.japan : null;
  await client.clientMongo.db('jwc').collection('accounts').updateOne(
    { tag },
    {
      $set: {
        'legend.days.$[target].globalRank': globalRank,
        'legend.days.$[target].japanRank': japanRank
      }
    },
    {
      arrayFilters: [{ 'target.season': season, 'target.day': day }]
    }
  );
}

function collectLegendSummary(summaryByPilot, mongoAcc, result, rankInfo) {
  const pilotId = extractPilotId(mongoAcc);
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
    post: mongoAcc?.legend?.logSettings?.post ?? 'NA',
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
        if (destination.type === 'channel') {
          let channel = client.channels.cache.get(destination.id);
          if (!channel) {
            channel = await client.channels.fetch(destination.id).catch(() => null);
          }
          if (channel) await channel.send({ embeds: [embed] });
        } else if (destination.type === 'dm') {
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
    if (item.post === 'channel' && item.channel) {
      destinationMap.set(`channel:${item.channel}`, { type: 'channel', id: item.channel });
    } else if (item.post === 'dm') {
      destinationMap.set(`dm:${pilotId}`, { type: 'dm', id: pilotId });
    }
  });

  return Array.from(destinationMap.values());
}

function extractPilotId(mongoAcc) {
  const pilotDC = mongoAcc?.pilotDC;
  if (!pilotDC) return null;
  if (typeof pilotDC === 'string') {
    return pilotDC;
  }
  return pilotDC.id ?? null;
}

function createLegendSummaryEmbed(items, seasonData) {
  const embed = new EmbedBuilder();
  const title = `${config.emote.legend} SUMMARY OF ${seasonData.daysNow == 1 ? 'THE LAST DAY' : `DAY ${seasonData.daysNow - 1}`}`;
  embed.setTitle(title);
  embed.setColor(config.color.legend);
  const footer = `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  embed.setFooter({ text: footer, iconURL: config.urlImage.legend });

  const lines = [];
  items.forEach((item, index) => {
    const end = Number.isFinite(item.endTrophies) ? item.endTrophies : 'N/A';
    const diff = Number.isFinite(item.diffTrophies)
      ? `${item.diffTrophies >= 0 ? config.emote.up : config.emote.down} ${item.diffTrophies >= 0 ? `+${item.diffTrophies}` : item.diffTrophies}`
      : 'N/A';
    const atk = Number.isFinite(item.attackTrophies) ? `+${item.attackTrophies}` : 'N/A';
    const def = Number.isFinite(item.defenseTrophies) ? `${item.defenseTrophies}` : 'N/A';
    const gRank = Number.isFinite(item.globalRank) ? `#${item.globalRank}` : 'N/A';
    const hasJapanRank = Number.isFinite(item.japanRank);
    const jRank = hasJapanRank ? `#${item.japanRank}` : null;
    const rankLine = hasJapanRank
      ? `:globe_with_meridians: ${gRank} | :flag_jp: ${jRank}`
      : `:globe_with_meridians: ${gRank}`;
    lines.push(
      `${index + 1}. ${config.emote.thn[item.townHallLevel]} **${item.name}**`
      + `\n:trophy: ${end} [${diff}] | ${config.emote.sword} ${atk} | ${config.emote.shield} ${def}`
      + `\n${rankLine}`
    );
  });

  embed.setDescription(lines.join('\n\n'));
  return embed;
}

async function runWithConcurrency(items, concurrency, worker, client = null, workerSource = 'worker') {
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }
  const queue = [...items];
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, queue.length)) },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) {
          continue;
        }
        try {
          await worker(item);
        } catch (error) {
          console.error('[runWithConcurrency] worker failed:', error);
          if (client) {
            const warInfo =
              item?.league != null
                ? `[${item.league}] w${item.week} ${item.clan_abbr} vs ${item.opponent_abbr}`
                : undefined;
            await reportError(client, error, {
              source: workerSource,
              context: { warInfo, cronJob: workerSource },
              extra: item?._id ? { warId: String(item._id) } : undefined,
            });
          }
        }
      }
    },
  );
  await Promise.all(workers);
}
