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
import { deliverLegendLogToUser } from './fLegend.js';
import { reportError } from './errorReport.js';
import {
  isHeavyCronRunning,
  getHeavyCronJob,
  runHeavyCron,
} from './heavyCronGuard.js';

const WAR_UPDATE_CONCURRENCY = 4;
const ACC_UPDATE_CONCURRENCY = 10;
const ACC_UPDATE_BATCH_DELAY_MS = 1500;


async function cronWarAutoUpdate(client, league) {
  if (isHeavyCronRunning()) {
    console.log(
      `⏭️ cronWar skipped: ${league} (heavy cron: ${getHeavyCronJob()})`,
    );
    return;
  }
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
  return runHeavyCron('cronUpdate2am', async () => {
    const startedAt = Date.now();
    const currentDate = new Date();
    // cronUpdate2am は「JST 02:00 切替」側の処理（Legend I 以外）
    const seasonData = functions.calculateSeasonValues(client, currentDate, 17);
    const nAccs = await autoUpdateAcc(client);

    await fRanking.rankingMain(client.clientMongo);
    console.log(`[cronUpdate2am] elapsed=${Date.now() - startedAt}ms accounts=${nAccs}`);
  });
}
export { cronUpdate2am };

async function runCronStep(jobLabel, stepName, fn) {
  try {
    await fn();
    return true;
  } catch (e) {
    console.error(
      `[${jobLabel}] step failed: ${stepName}:`,
      e?.message ?? e,
    );
    return false;
  }
}

async function cronUpdate2pmLegend1(client) {
  return runHeavyCron('cronUpdate2pmLegend1', async () => {
    const startedAt = Date.now();
    const currentDate = new Date();
    // Legend I の日境界: JST 14:00 (= UTC 05:00)
    const seasonData = functions.calculateSeasonValues(client, currentDate, 5);
    const job = 'cronUpdate2pmLegend1';

    // 1) 日次データ更新（失敗しても後続を試みる）
    let nAccs = 0;
    try {
      nAccs = await autoUpdateAcc(client);
    } catch (e) {
      console.error(`[${job}] step failed: autoUpdateAcc:`, e?.message ?? e);
    }

    // 2) ユーザー向け result を最優先（rankingMain の Mongo sort 失敗で止まらないように前に置く）
    await runCronStep(job, 'legends200', () => fMongo.legends200(client));
    await runCronStep(job, 'saveAllLegend1DayRanks', () =>
      saveAllLegend1DayRanks(client, seasonData),
    );
    await runCronStep(job, 'sendLegendResult', () =>
      sendLegendResult(client, seasonData),
    );

    // 3) ランキング集計（失敗しても result は既に送済）
    await runCronStep(job, 'rankingMain', () =>
      fRanking.rankingMain(client.clientMongo),
    );

    // 4) 掲示板・新日エントリ
    await runCronStep(job, 'sendLogUpdated', () =>
      sendLogUpdated(client, nAccs, seasonData),
    );
    await runCronStep(job, 'sendLogLegendDay', () =>
      sendLogLegendDay(client, seasonData),
    );
    await runCronStep(job, 'updateStatusInfoLegend', () =>
      functions.updateStatusInfoLegend(client, seasonData),
    );
    await runCronStep(job, 'addNewDayToLegendAccounts', () =>
      addNewDayToLegendAccounts(client, seasonData),
    );

    console.log(`[cronUpdate2pmLegend1] elapsed=${Date.now() - startedAt}ms accounts=${nAccs}`);
  });
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
          (d) =>
            String(d?.season) === String(seasonId)
            && Number(d?.day) === Number(currentDay),
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
          day: Number(currentDay) || currentDay,
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
        const dayCandidates = [...new Set([
          Number(currentDay),
          String(currentDay),
          currentDay,
        ].filter((v) => v != null && v !== '' && !(typeof v === 'number' && !Number.isFinite(v))))];
        const seasonCandidates = [...new Set(
          [seasonId, String(seasonId)].filter((s) => s != null && s !== ''),
        )];
        await client.clientMongo
          .db('jwc')
          .collection('accounts')
          .updateOne(
            {
              tag: account.tag,
              'legend.days': {
                $not: {
                  $elemMatch: {
                    season: { $in: seasonCandidates },
                    day: { $in: dayCandidates },
                  },
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

  // 並び順は更新結果に不要。Mongo sort は 32MB 制限で落ちうるので使わない
  const query = { status: true };
  const options = { projection: { _id: 0, tag: 1 } };
  const cursor = client.clientMongo.db('jwc').collection('accounts').find(query, options);
  const accountsAll = await cursor.toArray();
  await cursor.close();
  console.log(`accountsAll: ${accountsAll.length}`);

  const nAccPerLoop = ACC_UPDATE_CONCURRENCY;
  const nLoop = Math.ceil(accountsAll.length / nAccPerLoop);
  const failedTags = [];

  for (let i = 0; i < nLoop; i++) {
    const min = nAccPerLoop * i;
    const max = Math.min(nAccPerLoop * (i + 1), accountsAll.length);
    const accs = accountsAll.slice(min, max);

    await Promise.all(accs.map(acc =>
      fMongo.updateAcc(client, acc.tag).catch(error => {
        console.error(`[autoUpdateAcc] ${acc.tag}:`, error?.message ?? error);
        if (functions.isThrottleError(error)) {
          failedTags.push(acc.tag);
        }
      })
    ));

    console.log(`${max} / ${accountsAll.length}`);
    await functions.sleep(ACC_UPDATE_BATCH_DELAY_MS);
  }

  if (failedTags.length > 0) {
    console.log(`[autoUpdateAcc] retrying ${failedTags.length} throttled accounts sequentially`);
    for (const tag of failedTags) {
      try {
        await fMongo.updateAcc(client, tag);
      } catch (error) {
        console.error(`[autoUpdateAcc] retry failed ${tag}:`, error?.message ?? error);
      }
      await functions.sleep(ACC_UPDATE_BATCH_DELAY_MS);
    }
  }

  return accountsAll.length;
}

async function autoUpdateAccLegend1(client) {
  console.log(`start: autoUpdateAccLegend1`);

  const query = {
    status: true,
    'leagueTier.id': config_coc.leagueId.legend,
  };
  // 並び順不要。sort による QueryExceededMemoryLimit を避ける
  const options = { projection: { _id: 0, tag: 1 } };
  const cursor = client.clientMongo
    .db('jwc')
    .collection('accounts')
    .find(query, options);
  const accountsAll = await cursor.toArray();
  await cursor.close();
  console.log(`accountsLegend1: ${accountsAll.length}`);

  const nAccPerLoop = ACC_UPDATE_CONCURRENCY;
  const nLoop = Math.ceil(accountsAll.length / nAccPerLoop);

  for (let i = 0; i < nLoop; i++) {
    const min = nAccPerLoop * i;
    const max = Math.min(nAccPerLoop * (i + 1), accountsAll.length);
    const accs = accountsAll.slice(min, max);

    await Promise.all(accs.map(acc =>
      fMongo.updateAcc(client, acc.tag).catch(error => console.error(error))
    ));

    console.log(`${max} / ${accountsAll.length}`);
    await functions.sleep(ACC_UPDATE_BATCH_DELAY_MS);
  }

  return accountsAll.length;
}

function getPreviousSeasonId(seasonId) {
  const [y, m] = String(seasonId).split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return null;
  }
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function inferPreviousSeasonLastDay(currentSeasonId, accountsAll) {
  const prevSeason = getPreviousSeasonId(currentSeasonId);
  if (!prevSeason) {
    return { targetSeason: currentSeasonId, targetDay: 0 };
  }

  let maxDay = 0;
  for (const acc of accountsAll) {
    for (const d of acc.legend?.days ?? []) {
      const day = Number(d?.day);
      if (d?.season === prevSeason && Number.isFinite(day) && day > maxDay) {
        maxDay = day;
      }
    }
  }
  return { targetSeason: prevSeason, targetDay: maxDay };
}

/**
 * TOP10 表示対象の season/day を決める。
 * 新シーズン初日 (daysNow === 1) は前シーズン最終日（sendLegendResult と同様）。
 */
function resolveLegendTop10Target(seasonData, rankedBattlesConfig, accountsAll) {
  if (seasonData.daysNow > 1) {
    return {
      targetSeason: seasonData.seasonId,
      targetDay: seasonData.daysNow - 1,
    };
  }

  if (
    rankedBattlesConfig?.seasonId
    && rankedBattlesConfig.seasonId !== seasonData.seasonId
    && Number.isFinite(rankedBattlesConfig.currentDay)
    && rankedBattlesConfig.currentDay > 0
  ) {
    return {
      targetSeason: rankedBattlesConfig.seasonId,
      targetDay: rankedBattlesConfig.currentDay,
    };
  }

  return inferPreviousSeasonLastDay(seasonData.seasonId, accountsAll);
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
  // cron は JST 14:00 起動。表示・ソート対象は終了した日の日次サマリ
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

  const rankedBattlesConfig = await client.clientMongo
    .db('jwc')
    .collection('config')
    .findOne({ name: 'rankedBattlesSeason' });

  const { targetSeason, targetDay } = resolveLegendTop10Target(
    seasonData,
    rankedBattlesConfig,
    accountsAll,
  );

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

  await deliverLegendLogToUser(client, mongoAcc, { embeds: [embed] });
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
    `*${functions.formatLegendDaysRemaining(seasonData.daysEnd, 'toGo')}*`
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
  // result は slash では文字列 'true'。boolean も許容。current 有無は必須にしない
  const query = {
    status: true,
    'leagueTier.id': config_coc.leagueId.legend,
    'legend.logSettings.result': { $in: ['true', true] },
    'legend.logSettings.post': { $nin: ['NA', 'false', false, null] },
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
  const japanRankMap = buildTagRankMap(legends200?.japan);
  const legend200Borders = getLegendRank200BorderTrophies(legends200);
  const summaryByPilot = new Map();

  console.log(`sendLegendResult: ${mongoAccs.length}`);
  let sent = 0;
  let skippedNoImg = 0;
  let skippedDelivery = 0;
  let failed = 0;

  for (let i = 0; i < mongoAccs.length; i++) {
    const mongoAcc = mongoAccs[i];

    console.log(`[sendLegendResult ${i + 1}/${mongoAccs.length}] ${mongoAcc.name} (${mongoAcc.tag}) post=${mongoAcc.legend?.logSettings?.post}`);

    const rankInfo = buildLegendDayRankInfo(mongoAcc, japanRankMap);

    try {
      const resultR1 = await fCanvas.legendStatsR1(client, mongoAcc, 'previous');
      if (!resultR1?.attachment) {
        skippedNoImg += 1;
        console.warn(
          `[sendLegendResult] no image day=${resultR1?.dayStats?.day ?? 'null'} daysLen=${mongoAcc.legend?.days?.length ?? 0} ${mongoAcc.tag}`,
        );
        continue;
      }
      const ok = await sendLogAttachment(client, mongoAcc, resultR1, seasonData, rankInfo, legend200Borders);
      if (ok) sent += 1;
      else skippedDelivery += 1;
      collectLegendSummary(summaryByPilot, mongoAcc, resultR1, rankInfo);

      await functions.sleep(500);
    } catch (error) {
      failed += 1;
      console.error(`[sendLegendResult ${i + 1}/${mongoAccs.length}] error (${mongoAcc.tag}):`, error);
      await functions.sleep(1000);
    }
  }

  await sendLegendSummaryByPilot(client, seasonData, summaryByPilot);
  console.log(
    `end: sendLegendResult sent=${sent} noImg=${skippedNoImg} deliveryFail=${skippedDelivery} err=${failed}`,
  );
}

/**
 * Legend I 全員について、終了した日の globalRank / japanRank を days[] に保存する。
 * 14:00 cron（autoUpdateAcc 後・addNewDay 前）から呼ぶ。
 * globalRank = legend.current.rank を days[0]（= 終了日）へ書く。
 */
async function saveAllLegend1DayRanks(client, seasonData) {
  const query = {
    status: true,
    'leagueTier.id': config_coc.leagueId.legend,
    'legend.days.0': { $exists: true },
  };
  const options = {
    projection: {
      _id: 0,
      tag: 1,
      name: 1,
      legend: 1,
      leagueTier: 1,
    },
  };

  const cursor = client.clientMongo.db('jwc').collection('accounts').find(query, options);
  const mongoAccs = await cursor.toArray();
  await cursor.close();

  const legends200 = await client.clientMongo.db('jwc').collection('ranking').findOne(
    { name: 'legends200' },
    { projection: { _id: 0, japan: 1, global: 1 } },
  );
  const japanRankMap = buildTagRankMap(legends200?.japan);

  console.log(`saveAllLegend1DayRanks: ${mongoAccs.length} accounts`);
  let saved = 0;
  let skipped = 0;
  let missingRank = 0;

  for (const mongoAcc of mongoAccs) {
    // addNewDay 前なので通常 days[0] が終了した日
    const endedDayStats = resolveEndedDayStatsForRankSave(mongoAcc, seasonData);
    if (!endedDayStats) {
      skipped += 1;
      continue;
    }
    const rankInfo = buildLegendDayRankInfo(mongoAcc, japanRankMap);
    if (rankInfo.global == null && rankInfo.japan == null) {
      missingRank += 1;
      console.warn(
        `[saveAllLegend1DayRanks] no ranks ${mongoAcc.name} (${mongoAcc.tag}) day=${endedDayStats.day} current.rank=${mongoAcc.legend?.current?.rank ?? 'null'}`,
      );
    }
    try {
      const ok = await saveLegendRankHistoryForDay(
        client,
        mongoAcc.tag,
        endedDayStats,
        rankInfo,
      );
      if (ok) saved += 1;
      else skipped += 1;
    } catch (e) {
      console.error(
        `[saveAllLegend1DayRanks] failed ${mongoAcc.tag}:`,
        e?.message ?? e,
      );
      skipped += 1;
    }
  }

  console.log(
    `saveAllLegend1DayRanks done: saved=${saved} skipped=${skipped} missingRank=${missingRank}`,
  );
}

/** Tag を #FOO 形・大文字に揃えて Map 検索する */
function normalizePlayerTag(tag) {
  if (tag == null || tag === '') return '';
  const t = String(tag).trim().toUpperCase();
  if (!t) return '';
  return t.startsWith('#') ? t : `#${t}`;
}

function buildTagRankMap(players) {
  const map = new Map();
  if (!Array.isArray(players)) return map;
  for (const p of players) {
    const key = normalizePlayerTag(p?.tag);
    const rank = parsePositiveRankNumber(p?.rank);
    if (key && rank != null) {
      map.set(key, rank);
    }
  }
  return map;
}

/**
 * 終了日の順位:
 * - globalRank: autoUpdateAcc 直後の legend.current.rank（API）
 * - japanRank: legends200 日本 Top200（無ければ null）
 */
function buildLegendDayRankInfo(mongoAcc, japanRankMap) {
  const tagKey = normalizePlayerTag(mongoAcc.tag);
  const global =
    parsePositiveRankNumber(mongoAcc.legend?.current?.rank)
    ?? parsePositiveRankNumber(mongoAcc.legendStatistics?.currentSeason?.rank)
    ?? null;
  const japan =
    parsePositiveRankNumber(japanRankMap?.get?.(tagKey) ?? japanRankMap?.get?.(mongoAcc.tag))
    ?? null;
  return { global, japan };
}

function parsePositiveRankNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 順位保存先の day エントリ。
 * addNewDay 前: 通常 days[0] が終了日。当日エントリが先にある例外だけ days[1]。
 */
function resolveEndedDayStatsForRankSave(mongoAcc, seasonData) {
  const daysArr = Array.isArray(mongoAcc?.legend?.days)
    ? mongoAcc.legend.days.filter((d) => d != null)
    : [];
  if (daysArr.length === 0) return null;

  const daysNow = Number(seasonData?.daysNow);
  const newest = daysArr[0];
  if (Number.isFinite(daysNow) && Number(newest?.day) === daysNow) {
    return daysArr[1] ?? null;
  }
  return newest;
}

/** result 画像などで終了した日の days[] エントリを特定する */
function resolvePreviousLegendDayStats(mongoAcc, seasonData) {
  return resolveEndedDayStatsForRankSave(mongoAcc, seasonData);
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

/**
 * @returns {Promise<boolean>} 本体 result 画像または embed のどちらかが届けば true
 */
async function sendLogAttachment(client, mongoAcc, result, seasonData, rankInfo = {}, legend200Borders = {}) {
  if (!result?.attachment) {
    console.warn(
      `[sendLogAttachment] skip (no attachment): ${mongoAcc?.name} (${mongoAcc?.tag})`,
    );
    return false;
  }

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
  const footer = `DAY ${seasonData.daysNow} | ${functions.formatLegendDaysRemaining(seasonData.daysEnd, 'footer')} | SEASON ${seasonData.seasonId}`;
  embed.setFooter({ text: footer, iconURL: config.urlImage.legend });

  // history は失敗しても result 本体は送る
  let attachmentHistory = null;
  try {
    attachmentHistory = await fCanvas.legendHistory(mongoAcc);
  } catch (historyErr) {
    console.error(
      `[sendLogAttachment] legendHistory failed ${mongoAcc.tag}:`,
      historyErr?.message ?? historyErr,
    );
  }

  const embedDelivery = await deliverLegendLogToUser(client, mongoAcc, {
    embeds: [embed],
  });
  if (!embedDelivery.ok) {
    console.warn(
      `[sendLogAttachment] embed not delivered ${mongoAcc.tag}: ${embedDelivery.reason}`,
    );
  }

  const imageDelivery = await deliverLegendLogToUser(client, mongoAcc, {
    files: [result.attachment],
  });
  if (!imageDelivery.ok) {
    console.warn(
      `[sendLogAttachment] result image not delivered ${mongoAcc.tag}: ${imageDelivery.reason}`,
    );
  }

  if (attachmentHistory) {
    const historyDelivery = await deliverLegendLogToUser(client, mongoAcc, {
      files: [attachmentHistory],
    });
    if (!historyDelivery.ok) {
      console.warn(
        `[sendLogAttachment] history image not delivered ${mongoAcc.tag}: ${historyDelivery.reason}`,
      );
    }
  }

  // 14時のresult系バックアップ通知先
  const disableLegendLogs = process.env.DISABLE_LEGEND_LOGS === 'true';
  if (!disableLegendLogs && config.logch.legend_result) {
    let backupChannel = client.channels.cache.get(config.logch.legend_result);
    if (!backupChannel) {
      backupChannel = await client.channels.fetch(config.logch.legend_result).catch(() => null);
    }
    if (backupChannel) {
      await backupChannel.send({ embeds: [embed] }).catch(() => null);
      await backupChannel.send({ files: [result.attachment] }).catch(() => null);
      if (attachmentHistory) {
        await backupChannel.send({ files: [attachmentHistory] }).catch(() => null);
      }
    }
  }

  return Boolean(embedDelivery.ok || imageDelivery.ok);
}

async function saveLegendRankHistoryForDay(client, tag, dayStats, rankInfo) {
  const season = dayStats?.season;
  const day = Number(dayStats?.day);
  if (season == null || season === '' || !Number.isFinite(day)) {
    console.warn(
      `[saveLegendRankHistoryForDay] skip invalid dayStats tag=${tag} season=${season} day=${dayStats?.day}`,
    );
    return false;
  }
  const globalRank = parsePositiveRankNumber(rankInfo?.global);
  const japanRank = parsePositiveRankNumber(rankInfo?.japan);

  // null で既存の順位を潰さない（取れた方だけ $set）
  if (globalRank == null && japanRank == null) {
    console.warn(
      `[saveLegendRankHistoryForDay] skip no finite ranks tag=${tag} season=${season} day=${day}`,
    );
    return false;
  }

  const seasonCandidates = [...new Set(
    [season, String(season)].filter((s) => s != null && s !== ''),
  )];
  if (typeof season === 'string' && /^\d+$/.test(season)) {
    seasonCandidates.push(Number(season));
  } else if (typeof season === 'number') {
    seasonCandidates.push(String(season));
  }
  const dayCandidates = [...new Set([day, String(day)])];

  const $set = {};
  if (globalRank != null) {
    $set['legend.days.$[target].globalRank'] = globalRank;
  }
  if (japanRank != null) {
    $set['legend.days.$[target].japanRank'] = japanRank;
  }

  // ドキュメントマッチ条件でも day を要求 → arrayFilter 空振りを検出できる
  const result = await client.clientMongo.db('jwc').collection('accounts').updateOne(
    {
      tag,
      'legend.days': {
        $elemMatch: {
          day: { $in: dayCandidates },
          season: { $in: seasonCandidates },
        },
      },
    },
    { $set },
    {
      arrayFilters: [
        {
          'target.day': { $in: dayCandidates },
          'target.season': { $in: seasonCandidates },
        },
      ],
    },
  );

  if (result.matchedCount === 0) {
    console.warn(
      `[saveLegendRankHistoryForDay] no matching day tag=${tag} season=${season} day=${day} global=${globalRank} japan=${japanRank}`,
    );
    return false;
  }

  console.log(
    `[saveLegendRankHistoryForDay] ok tag=${tag} season=${season} day=${day} global=${globalRank} japan=${japanRank} modified=${result.modifiedCount}`,
  );
  return true;
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
  const footer = `DAY ${seasonData.daysNow} | ${functions.formatLegendDaysRemaining(seasonData.daysEnd, 'footer')} | SEASON ${seasonData.seasonId}`;
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
