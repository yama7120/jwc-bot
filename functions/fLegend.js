import { EmbedBuilder } from 'discord.js';

import config from '../config/config.js';
import config_coc from '../config/config_coc.js';

import * as functions from './functions.js';
import * as fRanking from './fRanking.js';
import {
  filterRankedBattleItems,
  fingerprintRankedBattleItem,
} from './fBattleLog.js';

/** レジェンドのシーズン開始トロフィーリセット（5000・一括減少）かどうか */
function isLegendLeagueSeasonTrophyReset(beforePlayerStats, afterPlayerStats) {
  if (afterPlayerStats.trophies !== 5000 || beforePlayerStats.trophies <= 5000) {
    return false;
  }
  const diffTrophies = afterPlayerStats.trophies - beforePlayerStats.trophies;
  // 単発防衛程度（おおよそ -40 前後）でちょうど 5000 になるケースと区別する
  return diffTrophies <= -100;
}

function getLeagueTierDisplayName(scPlayer) {
  const leagueTierId = scPlayer?.leagueTier?.id;
  const leagueTierConfig = config_coc.leagueTiers.find(
    (tier) => tier.id === leagueTierId,
  );
  const leagueName = leagueTierConfig?.name ?? scPlayer?.leagueTier?.name ?? 'Unknown League';
  return leagueName.toUpperCase();
}

function getRankedBattlesCapForTier(leagueTierId) {
  const tier = config_coc.leagueTiers?.find((t) => t.id === leagueTierId);
  const n = tier?.nBattles;
  return typeof n === 'number' && n > 0 ? n : 0;
}

/** LEGEND I 以外の本文用: トーナメント枠に対する残り攻撃／防衛（weeklySummary = 期間内のログ件数） */
function nonLegendRankedRemainingDescriptionLine(
  scPlayer,
  weeklySummary,
  kind,
) {
  if (scPlayer.leagueTier.id === config_coc.leagueId.legend) {
    return '';
  }
  const cap = getRankedBattlesCapForTier(scPlayer?.leagueTier?.id);
  if (cap <= 0) {
    return '';
  }
  const used = kind === 'attack'
    ? Math.max(0, Number(weeklySummary?.attacks ?? 0))
    : Math.max(0, Number(weeklySummary?.defenses ?? 0));
  const remaining = Math.max(0, cap - used);
  const label = kind === 'attack' ? 'attacks' : 'defenses';
  if (remaining <= 0) {
    return `**0/${cap}** — all ${label} used ✅\n`;
  }
  return `**${remaining}/${cap}** ${label} remaining\n`;
}

function isLegendLeagueTierId(id) {
  return (
    id === config_coc.leagueId.legend
    || id === config_coc.leagueId.legend2
    || id === config_coc.leagueId.legend3
  );
}

/** ランク戦ログ Embed フッター。レジェンド帯は config、他は config_coc、無ければ API */
function getRankedBattleLogFooterIconUrl(scPlayer) {
  const id = scPlayer?.leagueTier?.id;
  if (isLegendLeagueTierId(id)) {
    return config.urlImage.legend;
  }
  const tier = config_coc.leagueTiers?.find((t) => t.id === id);
  if (tier?.iconUrls?.small) {
    return tier.iconUrls.small;
  }
  return scPlayer?.leagueTier?.icon?.url;
}

async function createLogLegendNewSeason(
  scPlayer,
  mongoAcc,
  eventData,
  seasonData,
) {
  const myEmbed = new EmbedBuilder();
  myEmbed.setTitle('**RANKED BATTLES LOG**');
  let footer = '';
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    footer =
      `${getLeagueTierDisplayName(scPlayer)} | ` +
      `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  } else {
    footer = `${getLeagueTierDisplayName(scPlayer)}`;
  }
  myEmbed.setFooter({ text: footer, iconURL: getRankedBattleLogFooterIconUrl(scPlayer) });
  myEmbed.setColor(config.color.green);
  myEmbed.setTimestamp();
  let description = `${config.emote.thn[scPlayer.townHallLevel]} **${scPlayer.name}** | ${scPlayer.tag}\n\n`;
  description += `:trophy: **${eventData.trophiesCurrent}**\n\n`;
  description += `New season has started.\n`;
  myEmbed.setDescription(description);
  return myEmbed;
}

async function autoUpdateLegend(
  client,
  mongoAcc,
  beforePlayerStats,
  afterPlayerStats,
  seasonData,
  battleLogItems = null,
) {
  if (!mongoAcc) {
    console.log(`something wrong`, beforePlayerStats.tag, afterPlayerStats.tag);
    return;
  }

  //console.dir(afterPlayerStats);

  const unixTimeSeconds = Math.floor(Date.now() / 1000);

  const diffAttackWins =
    afterPlayerStats.attackWins - beforePlayerStats.attackWins;
  const diffDefenseWins =
    afterPlayerStats.defenseWins - beforePlayerStats.defenseWins;

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

  if (afterPlayerStats.leagueTier.id == config_coc.leagueId.legend) {
    if (isLegendLeagueSeasonTrophyReset(beforePlayerStats, afterPlayerStats)) {
      const embed = await createLogLegendNewSeason(
        afterPlayerStats,
        mongoAcc,
        baseEventData,
        seasonData,
      );
      await sendLogEmbed(client, mongoAcc, embed);
      return;
    }
    if (Array.isArray(battleLogItems)) {
      await processLegendRankedBattleLog(
        client,
        mongoAcc,
        battleLogItems,
        afterPlayerStats,
        seasonData,
      );
      return;
    }
    console.warn(
      `⚠️ legend ranked log: battle log unavailable for ${afterPlayerStats.tag}; skip (no stats fallback)`,
    );
    return;
  } else {
    if (baseEventData.diffTrophies < 0 && baseEventData.trophiesCurrent == 0) {
      await removeNonLegendEventsOnReset(client, mongoAcc.tag);
      const embed = await createLogReset(afterPlayerStats, mongoAcc, baseEventData, seasonData);
      await sendLogEmbed(client, mongoAcc, embed);
    }
    else {
      const eventType = isAttackOrDefense(diffAttackWins);
      await handleEvent(
        client,
        afterPlayerStats,
        mongoAcc,
        eventType,
        baseEventData,
        diffAttackWins,
        seasonData,
      );
    }
  }

  return;
}
export { autoUpdateLegend };

async function removeNonLegendEventsOnReset(client, tag) {
  if (!tag) {
    return;
  }
  await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .updateOne(
      { tag },
      [
        {
          $set: {
            'legend.events': {
              $filter: {
                input: { $ifNull: ['$legend.events', []] },
                cond: { $eq: ['$$this.leagueId', config_coc.leagueId.legend] },
              },
            },
          },
        },
      ],
    );
}

function isAttackOrDefense(diffAttackWins) {
  if (diffAttackWins == 0) {
    return 'defense';
  } else if (diffAttackWins == 1) {
    return 'attack';
  } else if (diffAttackWins >= 2 && diffAttackWins <= 8) {
    return 'multipleAttacks';
  } else if (diffAttackWins >= 9) {
    return 'warning';
  }
}

// イベント処理
async function handleEvent(
  client,
  scPlayer,
  mongoAcc,
  eventType,
  baseEventData,
  diffAttackWins,
  seasonData,
) {
  switch (eventType) {
    case 'multipleAttacks':
      await handleMultipleAttacks(
        client,
        scPlayer,
        mongoAcc,
        baseEventData,
        diffAttackWins,
        seasonData,
      );
      break;

    case 'both':
      await handleBothAttackDefense(
        client,
        scPlayer,
        mongoAcc,
        baseEventData,
        seasonData,
      );
      break;

    case '2defenses':
      await handle2Defenses(
        client,
        scPlayer,
        mongoAcc,
        baseEventData,
        seasonData,
      );
      break;

    default:
      const result = await writeLogLegendR2(
        client,
        mongoAcc,
        eventType,
        baseEventData,
      );
      if (result && result.value) {
        await sendLogLegendMain(
          client,
          scPlayer,
          mongoAcc,
          eventType,
          baseEventData,
          1,
          0,
          result,
          seasonData,
        );
      }
      break;
  }
}

// 複数攻撃の処理
async function handleMultipleAttacks(
  client,
  scPlayer,
  mongoAcc,
  baseEventData,
  attackCount,
  seasonData,
) {
  const { diffTrophies, trophiesCurrent, unixTimeSeconds } = baseEventData;

  // トロフィーを攻撃回数分に分割
  const trophyDistribution = distributeTrophies(diffTrophies, attackCount);

  // 複数のイベントデータを配列として準備
  const multipleEvents = [];
  for (let i = 0; i < attackCount; i++) {
    const eventData = {
      ...baseEventData,
      trophiesCurrent:
        trophiesCurrent - (diffTrophies - trophyDistribution.cumulative[i]),
      diffTrophies: trophyDistribution.individual[i],
      unixTimeSeconds: unixTimeSeconds - (attackCount - 1 - i) * 120, // 120秒間隔
      attacksCurrent: baseEventData.attacksCurrent - (attackCount - 1 - i),
    };
    multipleEvents.push(eventData);
  }

  // 1回のデータベース書き込みで複数イベントを処理
  const result = await writeLogLegendR2(
    client,
    mongoAcc,
    'attack',
    multipleEvents,
  );
  if (result && result.value) {
    // ひとつひとつ通知を送信する
    for (let i = 0; i < multipleEvents.length; i++) {
      await sendLogLegendMain(
        client,
        scPlayer,
        mongoAcc,
        'attack',
        multipleEvents[i],
        multipleEvents.length,
        i,
        result,
        seasonData,
      );
    }
  }
}

// トロフィー分割
function distributeTrophies(totalTrophies, attackCount) {
  const individual = new Array(attackCount).fill(0);
  const cumulative = new Array(attackCount).fill(0);

  // attackCountが2から8で、totalTrophiesが40*attackCount-14以上の場合
  // 最初の(attackCount-1)個を40に設定し、最後をtotalTrophies - 40*(attackCount-1)に設定
  if (attackCount >= 2 && attackCount <= 8 && totalTrophies >= 40 * attackCount - 14) {
    for (let i = 0; i < attackCount - 1; i++) {
      individual[i] = 40;
    }
    individual[attackCount - 1] = totalTrophies - 40 * (attackCount - 1);
    
    // 累積計算
    let sum = 0;
    for (let i = 0; i < attackCount; i++) {
      sum += individual[i];
      cumulative[i] = sum;
    }
    return { individual, cumulative };
  }
  else {
    // 平均値（小数は切り捨て）で均等配分し、最後で合計を調整
    const base = Math.floor(totalTrophies / attackCount);
    for (let i = 0; i < attackCount; i++) {
      individual[i] = base;
    }
    const sumBase = base * attackCount;
    const adjust = totalTrophies - sumBase; // 調整分
    individual[attackCount - 1] += adjust;

    // 累積計算
    let sum = 0;
    for (let i = 0; i < attackCount; i++) {
      sum += individual[i];
      cumulative[i] = sum;
    }
    return { individual, cumulative };
  }
}

// 攻撃+防衛の同時処理
async function handleBothAttackDefense(
  client,
  scPlayer,
  mongoAcc,
  baseEventData,
  seasonData,
) {
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
      unixTimeSeconds: unixTimeSeconds - 60,
    },
    {
      ...baseEventData,
      diffTrophies: defenseTrophies,
      unixTimeSeconds: unixTimeSeconds,
    },
  ];

  // 1回のデータベース書き込みで両方のイベントを処理
  const result = await writeLogLegendR2(client, mongoAcc, 'both', bothEvents);

  if (result && result.value) {
    await sendLogLegendMain(
      client,
      scPlayer,
      mongoAcc,
      'both',
      baseEventData,
      1,
      0,
      result,
      seasonData,
    );
  }
}

// 2回同時防衛の処理
async function handle2Defenses(
  client,
  scPlayer,
  mongoAcc,
  baseEventData,
  seasonData,
) {
  const { diffTrophies, trophiesCurrent, unixTimeSeconds } = baseEventData;

  // 2回の防衛イベントを作成
  // 1つ目: -40、2つ目: 元の合計に40を足した数値
  const secondDefenseTrophies = diffTrophies + 40;
  const defenseEvents = [
    {
      ...baseEventData,
      trophiesCurrent: trophiesCurrent - secondDefenseTrophies,
      diffTrophies: -40,
      unixTimeSeconds: unixTimeSeconds - 60,
    },
    {
      ...baseEventData,
      trophiesCurrent: trophiesCurrent,
      diffTrophies: secondDefenseTrophies,
      unixTimeSeconds: unixTimeSeconds,
    },
  ];

  // 1回のデータベース書き込みで両方の防衛イベントを処理
  const result = await writeLogLegendR2(
    client,
    mongoAcc,
    'defense',
    defenseEvents,
  );

  if (result && result.value) {
    // 2回の通知を送信する
    await sendLogLegendMain(
      client,
      scPlayer,
      mongoAcc,
      'defense',
      defenseEvents[0],
      2,
      0,
      result,
      seasonData,
    );
    await sendLogLegendMain(
      client,
      scPlayer,
      mongoAcc,
      'defense',
      defenseEvents[1],
      2,
      1,
      result,
      seasonData,
    );
  }
}

async function writeLogLegendR2(client, mongoAcc, legendEventType, eventData) {
  // 単一イベントの場合は配列に変換
  const events = Array.isArray(eventData) ? eventData : [eventData];

  const newEvents = events.map((event) => {
    const row = {
      unixTime: event.unixTimeSeconds,
      season: event.season,
      day: event.day,
      action: legendEventType,
      diffTrophies: event.diffTrophies,
      trophies: event.trophiesCurrent,
      leagueId: event.leagueId,
      leagueName: event.leagueName,
    };
    if (Number.isFinite(event.stars)) {
      row.stars = Math.min(3, Math.max(0, Number(event.stars)));
    }
    if (Number.isFinite(event.destructionPercentage)) {
      row.destructionPercentage = Number(event.destructionPercentage);
    }
    return row;
  });

  // 1. 新しいイベントの最後のdayを取得
  const lastEvent = newEvents[newEvents.length - 1];
  const targetSeason = lastEvent.season;
  const targetDay = lastEvent.day;

  // 2. 既存のeventsから該当するdayのイベントを取得
  const existingEvents = Array.isArray(mongoAcc.legend.events)
    ? mongoAcc.legend.events
    : [];
  const targetDayEvents = existingEvents.filter(
    (event) => event.season === targetSeason && event.day === targetDay,
  );

  // 3. 該当するdayのイベントを再計算（既存 + 新規）
  const allTargetDayEvents = [...targetDayEvents, ...newEvents];
  const updatedDayData = aggregateDaysFromEvents(allTargetDayEvents).find(
    (d) => d.season === targetSeason && d.day === targetDay,
  );
  const existingDayData = Array.isArray(mongoAcc?.legend?.days)
    ? mongoAcc.legend.days.find(
      (d) => d.season === targetSeason && d.day === targetDay,
    )
    : null;
  if (updatedDayData) {
    updatedDayData.globalRank = existingDayData?.globalRank ?? null;
    updatedDayData.japanRank = existingDayData?.japanRank ?? null;
  }
  const baseLegendDaysArray = {
    $filter: {
      input: { $ifNull: ['$legend.days', []] },
      cond: { $ne: ['$$this', null] },
    },
  };
  const mergedLegendDays = updatedDayData
    ? {
      $concatArrays: [
        {
          $filter: {
            input: baseLegendDaysArray,
            cond: {
              $not: {
                $and: [
                  { $eq: ['$$this.season', targetSeason] },
                  { $eq: ['$$this.day', targetDay] },
                ],
              },
            },
          },
        },
        [updatedDayData],
      ],
    }
    : baseLegendDaysArray;

  // 4. 1回のデータベースアクセスでeventsとdaysを同時に更新
  const result = await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .findOneAndUpdate(
      { tag: mongoAcc.tag },
      [
        {
          $set: {
            'legend.events': {
              $concatArrays: [{ $ifNull: ['$legend.events', []] }, newEvents],
            },
          },
        },
        {
          $set: {
            'legend.events': {
              $sortArray: {
                input: '$legend.events',
                sortBy: { unixTime: -1 },
              },
            },
          },
        },
        {
          $set: {
            'legend.events': {
              $slice: ['$legend.events', 80], // 最新80件のみ保持（先頭から）
            },
          },
        },
        {
          $set: {
            'legend.days': mergedLegendDays,
          },
        },
        {
          $set: {
            'legend.days': {
              $sortArray: {
                input: '$legend.days',
                sortBy: { season: -1, day: -1 },
              },
            },
          },
        },
        {
          $set: {
            'legend.days': {
              $slice: ['$legend.days', 80], // 最新80件のみ保持（先頭から）
            },
          },
        },
      ],
      {
        returnDocument: 'after',
        includeResultMetadata: true,
        projection: { legend: 1, _id: 0 },
      },
    );

  // 5. 戻り値用にnTodayを計算（更新されたdayデータから取得）
  const nToday = {
    attacks: updatedDayData ? updatedDayData.attacks : 0,
    defenses: updatedDayData ? updatedDayData.defenses : 0,
    attackTrophies: updatedDayData ? updatedDayData.attackTrophies : 0,
    defenseTrophies: updatedDayData ? updatedDayData.defenseTrophies : 0,
  };

  result.nToday = nToday;
  return result;
}
export { writeLogLegendR2 };

// eventsからdaysを集約計算する関数
function aggregateDaysFromEvents(events) {
  const daysMap = new Map(); // key: 'season-day'

  events.forEach((event) => {
    const key = `${event.season}-${event.day}`;

    if (!daysMap.has(key)) {
      // 新しい日の初期化
      daysMap.set(key, {
        season: event.season,
        day: event.day,
        trophies: event.trophies,
        diffTrophies: 0,
        attackTrophies: 0, // 攻撃で増加したトロフィー数
        defenseTrophies: 0, // 防衛で減少したトロフィー数
        attacks: 0,
        defenses: 0,
        triples: 0,
        defTriples: 0,
          globalRank: null,
          japanRank: null,
      });
    }

    const dayEntry = daysMap.get(key);

    // カウンター更新（ランク戦ログ由来は leagueId 付き。action が attack/defense のみ集計）
    switch (event.action) {
      case 'attack':
        dayEntry.attacks++;
        if (event.diffTrophies === 40) {
          dayEntry.triples++;
        }
        dayEntry.attackTrophies += event.diffTrophies ?? 0;
        break;
      case 'defense':
        dayEntry.defenses++;
        if (event.diffTrophies === -40) {
          dayEntry.defTriples++;
        }
        dayEntry.defenseTrophies += event.diffTrophies ?? 0;
        break;
      default:
        break;
    }

    // トロフィー累計
    dayEntry.diffTrophies += event.diffTrophies;

    // 最新のトロフィー数を保持
    dayEntry.trophies = event.trophies;
  });

  // Mapを配列に変換してソート
  return Array.from(daysMap.values()).sort((a, b) => {
    if (a.season !== b.season) return b.season - a.season;
    return b.day - a.day;
  });
}

async function sendLogLegendMain(
  client,
  scPlayer,
  mongoAcc,
  legendEventType,
  eventData,
  nEvents,
  i,
  result,
  seasonData,
) {
  let embed = null;

  // embed作成
  if (mongoAcc.legend.logSettings) {
    if (
      mongoAcc.legend.logSettings.post === 'channel' ||
      mongoAcc.legend.logSettings.post === 'dm'
    ) {
      embed = await handleBattleLog(
        client,
        legendEventType,
        scPlayer,
        mongoAcc,
        eventData,
        nEvents,
        i,
        result,
        seasonData,
      );
    } else {
      embed = null;
    }
  } else {
    embed = null;
  }

  // 送信
  if (embed) {
    await sendLogEmbed(client, mongoAcc, embed);
  } else {
    //await sendSimpleLogToChannel(client, mongoAcc, eventData, seasonData);
  }
}

async function handleBattleLog(
  client,
  legendEventType,
  scPlayer,
  mongoAcc,
  eventData,
  nEvents,
  i,
  result,
  seasonData,
) {
  const logSettings = mongoAcc.legend.logSettings;
  const weeklySummary = getWeeklySummaryFromEvents(
    result?.value?.legend?.events,
    seasonData,
  );
  const weekRatedAvg = getWeekRatedBattleAvgStats(
    result?.value?.legend?.events,
    seasonData,
  );
  switch (legendEventType) {
    case 'attack':
      if (logSettings.attacks === 'all')
        return await createLogLegendAttack(
          client,
          scPlayer,
          eventData,
          result.nToday,
          weeklySummary,
          weekRatedAvg,
          nEvents,
          i,
          seasonData,
          legendEventType,
        );
      break;

    case 'defense':
      if (logSettings.defenses === 'all')
        return await createLogLegendDefense(
          client,
          scPlayer,
          eventData,
          result.nToday,
          weeklySummary,
          weekRatedAvg,
          nEvents,
          i,
          seasonData,
          legendEventType,
        );
      if (
        logSettings.defenses === 'non-tripled' &&
        eventData.diffTrophies !== -40
      )
        return await createLogLegendDefense(
          client,
          scPlayer,
          eventData,
          result.nToday,
          weeklySummary,
          weekRatedAvg,
          nEvents,
          i,
          seasonData,
          legendEventType,
        );
      break;

    case 'both':
      return await createLogLegendBoth(
        scPlayer,
        eventData.diffTrophies,
        seasonData,
      );

    default:
      return await createLogLegendWarning(
        scPlayer,
        eventData.diffTrophies,
        seasonData,
      );
  }
  return null;
}

function calcAttackTrophies(stars, destruction) {
  if (stars >= 3) return 40;

  if (stars === 2) {
    return Math.min(32, 16 + Math.floor((destruction - 50) / 3));
  }

  if (stars === 1) {
    return Math.min(15, 5 + Math.floor((destruction - 1) / 9));
  }

  return Math.min(4, Math.floor(destruction / 10));
}

function calcDefenseTrophies(stars, destruction) {
  const attacker = calcAttackTrophies(stars, destruction);

  if (stars === 0) return 40;

  return 40 - attacker;
}

/** battle log 1行から、プレイヤー視点のトロフィー増減（Ranked Battles ルール） */
function rankedBattleTrophyDeltaFromBattleLog(
  isOurAttack,
  starsRaw,
  destructionRaw,
  leagueId,
) {
  const stars = Math.min(3, Math.max(0, Number(starsRaw) || 0));
  const destruction = Number(destructionRaw ?? 0);
  if (isOurAttack === true) {
    return calcAttackTrophies(stars, destruction);
  }

  if (leagueId === config_coc.leagueId.legend) {
    return -calcAttackTrophies(stars, destruction);
  }

  return calcDefenseTrophies(stars, destruction);
}

function rankedBattleLogStoredRow(item, fingerprint, meta = {}) {
  return {
    fingerprint,
    battleType: 'ranked',
    attack: item?.attack === true,
    action: item?.attack === true ? 'attack' : 'defense',
    opponentPlayerTag: item?.opponentPlayerTag ?? '',
    stars: Number(item?.stars ?? 0),
    destructionPercentage: Number(item?.destructionPercentage ?? 0),
    armyShareCode: item?.armyShareCode ?? '',
    diffTrophies: meta.diffTrophies ?? null,
    trophiesCurrent: meta.trophiesCurrent ?? null,
    leagueId: meta.leagueId ?? null,
    leagueName: meta.leagueName ?? null,
    battleUnixTime: meta.battleUnixTime ?? null,
    storedAt: Math.floor(Date.now() / 1000),
    detectedAt: meta.detectedAt ?? Math.floor(Date.now() / 1000),
  };
}

async function reloadMongoAccLegendProjection(client, mongoAcc) {
  const doc = await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .findOne({ tag: mongoAcc.tag }, { projection: { legend: 1, _id: 0 } });
  if (doc?.legend) {
    mongoAcc.legend = doc.legend;
  }
}

async function setLegendRankedBattleLogBootstrap(
  client,
  tag,
  rankedItems,
  afterPlayerStats,
) {
  const capped =
    rankedItems.length > 120
      ? rankedItems.slice(-120)
      : rankedItems;
  const rows = [];
  const seen = new Set();
  for (const item of capped) {
    const fp = fingerprintRankedBattleItem(item);
    if (seen.has(fp)) {
      continue;
    }
    seen.add(fp);
    const isAttack = item?.attack === true;
    const diffT = rankedBattleTrophyDeltaFromBattleLog(
      isAttack,
      item?.stars,
      item?.destructionPercentage,
      afterPlayerStats.leagueTier.id,
    );
    rows.push(
      rankedBattleLogStoredRow(item, fp, {
        diffTrophies: diffT,
        trophiesCurrent: afterPlayerStats.trophies,
        leagueId: afterPlayerStats.leagueTier.id,
        leagueName: afterPlayerStats.leagueTier.name,
        battleUnixTime: null,
      }),
    );
  }
  await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .updateOne({ tag }, { $set: { 'legend.rankedBattleLog': rows } });
}

/**
 * battleType ranked のみを Mongo に保持し、新規行だけ通知する。
 * CoC API の battle log は古い戦闘ほど先頭・新しいほど末尾（下）の並び想定。
 */
async function processLegendRankedBattleLog(
  client,
  mongoAcc,
  battleLogItems,
  afterPlayerStats,
  seasonData,
) {
  const ranked = filterRankedBattleItems(battleLogItems);
  const lb = mongoAcc.legend?.rankedBattleLog;
  const notBootstrapped = lb === undefined || lb === null;

  if (notBootstrapped) {
    await setLegendRankedBattleLogBootstrap(
      client,
      mongoAcc.tag,
      ranked,
      afterPlayerStats,
    );
    await reloadMongoAccLegendProjection(client, mongoAcc);
    return;
  }

  const priorRows = Array.isArray(lb) ? lb : [];
  const storedFp = new Set(priorRows.map((s) => s?.fingerprint).filter(Boolean));

  const newRev = [];
  for (let i = ranked.length - 1; i >= 0; i--) {
    const item = ranked[i];
    const fp = fingerprintRankedBattleItem(item);
    if (storedFp.has(fp)) {
      break;
    }
    newRev.push({ item, fp });
  }

  if (newRev.length === 0) {
    return;
  }

  const chronological = [...newRev].reverse();
  const rowsToStoreChronological = [];
  let mongoAccMut = { ...mongoAcc };
  let lastResult = null;

  for (let idx = 0; idx < chronological.length; idx++) {
    const { item, fp } = chronological[idx];
    const isAttack = item?.attack === true;
    const legendEventType = isAttack ? 'attack' : 'defense';
    const diffT = rankedBattleTrophyDeltaFromBattleLog(
      isAttack,
      item?.stars,
      item?.destructionPercentage,
      afterPlayerStats.leagueTier.id,
    );
    const unixTimeSeconds = Math.floor(Date.now() / 1000) + idx;
    const eventData = {
      season: seasonData.seasonId,
      day: seasonData.daysNow,
      trophiesCurrent: afterPlayerStats.trophies,
      diffTrophies: diffT,
      unixTimeSeconds,
      attacksCurrent: afterPlayerStats.attackWins,
      defensesCurrent: afterPlayerStats.defenseWins,
      diffAttackWins: isAttack ? 1 : 0,
      diffDefenseWins: isAttack ? 0 : 1,
      destructionPercentage: Number(item?.destructionPercentage ?? 0),
      stars: Math.min(3, Math.max(0, Number(item?.stars ?? 0))),
      leagueId: afterPlayerStats.leagueTier.id,
      leagueName: afterPlayerStats.leagueTier.name,
    };
    rowsToStoreChronological.push(
      rankedBattleLogStoredRow(item, fp, {
        diffTrophies: diffT,
        trophiesCurrent: afterPlayerStats.trophies,
        leagueId: afterPlayerStats.leagueTier.id,
        leagueName: afterPlayerStats.leagueTier.name,
        battleUnixTime: unixTimeSeconds,
        detectedAt: unixTimeSeconds,
      }),
    );

    lastResult = await writeLogLegendR2(
      client,
      mongoAccMut,
      legendEventType,
      eventData,
    );
    const updatedLegend = lastResult?.value?.legend;
    if (updatedLegend) {
      mongoAccMut = { ...mongoAccMut, legend: updatedLegend };
    }
    await sendLogLegendMain(
      client,
      afterPlayerStats,
      mongoAccMut,
      legendEventType,
      eventData,
      1,
      0,
      lastResult,
      seasonData,
    );
  }

  const newFpSet = new Set(rowsToStoreChronological.map((r) => r.fingerprint));
  const tail = priorRows.filter((r) => !newFpSet.has(r.fingerprint));
  const mergedRankedLog = [...tail, ...rowsToStoreChronological].slice(-120);
  await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .updateOne({ tag: mongoAcc.tag }, { $set: { 'legend.rankedBattleLog': mergedRankedLog } });

  await reloadMongoAccLegendProjection(client, mongoAcc);
}

function getWeeklyTournamentUnixBounds(seasonData) {
  const nowUnix = Math.floor(Date.now() / 1000);
  const startMs = new Date(seasonData?.tournamentWindow?.startTime).getTime();
  const endMs = new Date(seasonData?.tournamentWindow?.endTime).getTime();
  const startUnix = Number.isFinite(startMs) && startMs > 0
    ? Math.floor(startMs / 1000)
    : nowUnix - 7 * 24 * 60 * 60;
  const weekEndUnix = Number.isFinite(endMs) && endMs > 0
    ? Math.floor(endMs / 1000)
    : startUnix + 7 * 24 * 60 * 60;
  return { startUnix, weekEndUnix };
}

function getWeekRatedBattleAvgStats(events, seasonData) {
  const { startUnix, weekEndUnix } = getWeeklyTournamentUnixBounds(seasonData);
  const safeEvents = Array.isArray(events) ? events : [];
  let atkStarSum = 0;
  let atkStarN = 0;
  let atkDestSum = 0;
  let atkDestN = 0;
  let defStarSum = 0;
  let defStarN = 0;
  let defDestSum = 0;
  let defDestN = 0;
  safeEvents.forEach((event) => {
    if (typeof event?.unixTime !== 'number') {
      return;
    }
    if (event.unixTime < startUnix || event.unixTime > weekEndUnix) {
      return;
    }
    const stRaw = Number(event.stars);
    const destRaw = Number(event.destructionPercentage);
    if (event.action === 'attack') {
      if (Number.isFinite(stRaw)) {
        atkStarSum += stRaw;
        atkStarN += 1;
      }
      if (Number.isFinite(destRaw)) {
        atkDestSum += destRaw;
        atkDestN += 1;
      }
      return;
    }
    if (event.action === 'defense') {
      if (Number.isFinite(stRaw)) {
        defStarSum += stRaw;
        defStarN += 1;
      }
      if (Number.isFinite(destRaw)) {
        defDestSum += destRaw;
        defDestN += 1;
      }
    }
  });
  const round1 = (v) => Math.round(v * 10) / 10;
  return {
    attackStarsAvg: atkStarN ? round1(atkStarSum / atkStarN) : null,
    attackDestAvg: atkDestN ? Math.round(atkDestSum / atkDestN) : null,
    atkStarN,
    atkDestN,
    defenseStarsAvg: defStarN ? round1(defStarSum / defStarN) : null,
    defenseDestAvg: defDestN ? Math.round(defDestSum / defDestN) : null,
    defStarN,
    defDestN,
  };
}

function appendNonLegend1WeeklyRatedAvgLine(
  description,
  scPlayer,
  avgs,
  weeklySummary,
  legendEventType,
) {
  if (scPlayer.leagueTier.id === config_coc.leagueId.legend) {
    return description;
  }
  const ws = weeklySummary ?? {};
  const boldTrophySum = (n) => {
    if (n > 0) {
      return `**+${n}**`;
    }
    if (n === 0) {
      return `**0**`;
    }
    return `**${n}**`;
  };
  const signedAvg = (n) => (n >= 0 ? `+${n}` : `${n}`);

  const lines = [];
  const showAttack = legendEventType === 'attack';
  const showDefense = legendEventType === 'defense';

  if (showAttack) {
    const atkExtras = [];
    if (avgs.atkStarN > 0) {
      atkExtras.push(`${config.emote.star} ${avgs.attackStarsAvg} avg (${avgs.atkStarN})`);
    }
    if (avgs.atkDestN > 0) {
      atkExtras.push(`${avgs.attackDestAvg}% dest (${avgs.atkDestN})`);
    }
    const atkExtraStr = atkExtras.length ? ` — ${atkExtras.join(', ')}` : '';

    if (ws.attacks > 0) {
      const avg = Math.round(ws.attackTrophies / ws.attacks);
      lines.push(
        `${config.emote.sword} ${boldTrophySum(ws.attackTrophies)} in ${ws.attacks} attacks (avg: ${signedAvg(avg)})${atkExtraStr}`,
      );
    } else if (atkExtras.length) {
      lines.push(`${config.emote.sword} ${atkExtras.join(', ')}`);
    }
  }

  if (showDefense) {
    const defExtras = [];
    if (avgs.defStarN > 0) {
      defExtras.push(`${config.emote.star} ${avgs.defenseStarsAvg} avg (${avgs.defStarN})`);
    }
    if (avgs.defDestN > 0) {
      defExtras.push(`${avgs.defenseDestAvg}% dest (${avgs.defDestN})`);
    }
    const defExtraStr = defExtras.length ? ` — ${defExtras.join(', ')}` : '';

    if (ws.defenses > 0) {
      const avg = Math.round(ws.defenseTrophies / ws.defenses);
      lines.push(
        `${config.emote.shield} ${boldTrophySum(ws.defenseTrophies)} in ${ws.defenses} defenses (avg: ${signedAvg(avg)})${defExtraStr}`,
      );
    } else if (defExtras.length) {
      lines.push(`${config.emote.shield} ${defExtras.join(', ')}`);
    }
  }

  if (lines.length === 0) {
    return description;
  }

  return `${description}${lines.join('\n')}\n`;
}

function getWeeklySummaryFromEvents(events, seasonData) {
  const safeEvents = Array.isArray(events) ? events : [];
  const { startUnix, weekEndUnix } = getWeeklyTournamentUnixBounds(seasonData);

  let attacks = 0;
  let defenses = 0;
  let attackTrophies = 0;
  let defenseTrophies = 0;

  safeEvents.forEach((event) => {
    if (typeof event?.unixTime !== 'number') {
      return;
    }
    if (event.unixTime < startUnix || event.unixTime > weekEndUnix) {
      return;
    }
    if (event.action === 'attack') {
      attacks += 1;
      attackTrophies += event.diffTrophies ?? 0;
    } else if (event.action === 'defense') {
      defenses += 1;
      defenseTrophies += event.diffTrophies ?? 0;
    }
  });

  return {
    attacks,
    defenses,
    attackTrophies,
    defenseTrophies,
    weekEndUnix,
  };
}

async function sendLogEmbed(client, mongoAcc, myEmbed) {
  try {
    const disableLegendLogs = process.env.DISABLE_LEGEND_LOGS === 'true';

    // ユーザー設定に基づく送信
    if (!mongoAcc.legend.logSettings) {
      return;
    } else if (mongoAcc.legend.logSettings.post == 'NA') {
      return;
    } else if (mongoAcc.legend.logSettings.post === 'channel') {
      const channelUser = client.channels.cache.get(
        mongoAcc.legend.logSettings.channel,
      );
      if (channelUser?.isTextBased()) {
        await channelUser.send({ embeds: [myEmbed] });
      } else {
        console.error(
          'チャンネルが見つからないか、テキストチャンネルではありません。',
          mongoAcc.name,
          mongoAcc.tag,
        );
      }
    } else if (mongoAcc.legend.logSettings.post == 'dm') {
      await sendToDM(client, mongoAcc, myEmbed);
    }

    // ログチャンネルへの送信
    if (!disableLegendLogs) {
      const channelLog = client.channels.cache.get(config.logch.legend);
      if (channelLog?.isTextBased()) {
        await channelLog.send({ embeds: [myEmbed] });
      } else {
        console.error(
          'ログチャンネルが見つからないか、テキストチャンネルではありません。',
        );
      }
    }
  } catch (error) {
    console.error('ログ送信中にエラーが発生しました:', error, mongoAcc.name);
  }
}

async function sendToDM(client, mongoAcc, myEmbed) {
  try {
    const pilot = await client.users.fetch(mongoAcc.pilotDC.id);
    await pilot.send({ embeds: [myEmbed] });
  } catch (error) {
    console.error('DMの送信中にエラーが発生しました:', error, mongoAcc.name);
  }
}

async function createLogLegendAttack(
  client,
  scPlayer,
  eventData,
  nToday,
  nWeek,
  weekRatedAvg,
  nEvents,
  i,
  seasonData,
  legendEventType,
) {
  const myEmbed = new EmbedBuilder();
  myEmbed.setTitle(
    `${config.emote.sword} ${createDescriptionLegend(
      eventData.diffTrophies,
      eventData.destructionPercentage,
    )}`,
  );
  let footer = '';
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    footer =
      `${getLeagueTierDisplayName(scPlayer)} | ` +
      `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO`;
  } else {
    footer = `${getLeagueTierDisplayName(scPlayer)}`;
  }
  myEmbed.setFooter({ text: footer, iconURL: getRankedBattleLogFooterIconUrl(scPlayer) });
  myEmbed.setColor(config.color.attack);
  myEmbed.setTimestamp();

  let description = `<t:${eventData.unixTimeSeconds}:t> :trophy: **${eventData.trophiesCurrent}** ${config.emote.thn[scPlayer.townHallLevel]} **${scPlayer.name}**\n`;

  // 今日の攻撃合計と平均を表示
  if (nToday.attacks >= 2) {
    const averageTrophies = Math.round(nToday.attackTrophies / nToday.attacks);
    description += `:bar_chart: **+${nToday.attackTrophies}** in ${nToday.attacks} attacks (avg: +${averageTrophies})\n`;
  }
  description = appendNonLegend1WeeklyRatedAvgLine(
    description,
    scPlayer,
    weekRatedAvg,
    nWeek,
    legendEventType,
  );

  if (eventData.leagueId == config_coc.leagueId.legend) {
    // TOP200ランキング確認
    const rankingDisplay = await getRankingDisplay(client, scPlayer);
    if (rankingDisplay) {
      description += rankingDisplay;
    }

    description += `${config.emote.discord}</legend stats:${config.command.legend.id}>`;
    description += ` ${config.emote.discord}</legend history own:${config.command.legend.id}>`;
  }
  const quotaLineAtk = nonLegendRankedRemainingDescriptionLine(scPlayer, nWeek, 'attack');
  if (quotaLineAtk) {
    description += description.endsWith('\n') ? quotaLineAtk : `\n${quotaLineAtk}`;
  }
  myEmbed.setDescription(description);

  return myEmbed;
}

async function createLogLegendDefense(
  client,
  scPlayer,
  eventData,
  nToday,
  nWeek,
  weekRatedAvg,
  nEvents,
  i,
  seasonData,
  legendEventType,
) {
  const myEmbed = new EmbedBuilder();
  let title = '';
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    title = `${config.emote.shield} ${createDescriptionLegend(
      eventData.diffTrophies,
      eventData.destructionPercentage,
    )}`;
  } else {
    title = `${config.emote.shield} ${createDescriptionNonLegend(
      eventData.diffTrophies,
      eventData.destructionPercentage,
    )}`;
  }
  myEmbed.setTitle(title);
  let footer = '';
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    footer =
      `${getLeagueTierDisplayName(scPlayer)} | ` +
      `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO`;
  } else {
    footer = `${getLeagueTierDisplayName(scPlayer)}`;
  }
  myEmbed.setFooter({ text: footer, iconURL: getRankedBattleLogFooterIconUrl(scPlayer) });
  myEmbed.setColor(config.color.defense);
  myEmbed.setTimestamp();
  let description = `<t:${eventData.unixTimeSeconds}:t> :trophy: **${eventData.trophiesCurrent}** ${config.emote.thn[scPlayer.townHallLevel]} **${scPlayer.name}**\n`;

  // 今日の防衛合計と平均を表示
  if (nToday.defenses >= 2) {
    const averageTrophies = Math.round(nToday.defenseTrophies / nToday.defenses);
    const avgLabel = averageTrophies >= 0 ? `+${averageTrophies}` : `${averageTrophies}`;
    description += `:bar_chart: **${nToday.defenseTrophies}** in ${nToday.defenses} defenses (avg: ${avgLabel})\n`;
  }
  description = appendNonLegend1WeeklyRatedAvgLine(
    description,
    scPlayer,
    weekRatedAvg,
    nWeek,
    legendEventType,
  );

  if (eventData.leagueId == config_coc.leagueId.legend) {
    // TOP200ランキング確認
    const rankingDisplay = await getRankingDisplay(client, scPlayer);
    if (rankingDisplay) {
      description += rankingDisplay;
    }

    description += `${config.emote.discord}</legend stats:${config.command.legend.id}>`;
    description += ` ${config.emote.discord}</legend history own:${config.command.legend.id}>`;
  }
  const quotaLineDef = nonLegendRankedRemainingDescriptionLine(scPlayer, nWeek, 'defense');
  if (quotaLineDef) {
    description += description.endsWith('\n') ? quotaLineDef : `\n${quotaLineDef}`;
  }
  myEmbed.setDescription(description);

  return myEmbed;
}

// ランキング表示用の共通関数
async function getRankingDisplay(client, scPlayer) {
  try {
    const playerRanks = await client.clientCoc.getPlayerRanks(
      config_coc.locationId.japan,
    );
    const playerRank = playerRanks.find((rank) => rank.tag === scPlayer.tag);

    if (playerRank && playerRank.rank <= 200) {
      let rankingText = `:flag_jp: No. **${playerRank.rank}** in JAPAN`;

      // 20位以内の場合はグローバルランキングも取得
      if (playerRank.rank <= 20) {
        try {
          const globalRanks = await client.clientCoc.getPlayerRanks('global');
          const globalRank = globalRanks.find(
            (rank) => rank.tag === scPlayer.tag,
          );

          if (globalRank) {
            rankingText += ` :earth_asia: No. **${globalRank.rank}** in GLOBAL\n`;
          } else {
            rankingText += `\n`;
          }
        } catch (globalError) {
          console.error('グローバルランキング取得エラー:', globalError);
        }
      } else {
        rankingText += `\n`;
      }

      return rankingText;
    }
  } catch (error) {
    console.error('ランキング取得エラー:', error);
  }

  return '';
}

async function createLogLegendBoth(scPlayer, diffTrophies, seasonData) {
  const myEmbed = new EmbedBuilder();
  myEmbed.setTitle(`**RANKED BATTLES LOG**`);
  let footer = '';
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    footer =
      `${getLeagueTierDisplayName(scPlayer)} | ` +
      `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  } else {
    footer = `${getLeagueTierDisplayName(scPlayer)}`;
  }
  myEmbed.setFooter({ text: footer, iconURL: getRankedBattleLogFooterIconUrl(scPlayer) });
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
  let footer = '';
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    footer =
      `${getLeagueTierDisplayName(scPlayer)} | ` +
      `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  } else {
    footer = `${getLeagueTierDisplayName(scPlayer)}`;
  }
  myEmbed.setFooter({ text: footer, iconURL: getRankedBattleLogFooterIconUrl(scPlayer) });
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

async function createLogReset(scPlayer, mongoAcc, eventData, seasonData) {
  const myEmbed = new EmbedBuilder();
  const title = `**⚔️ LEAGUE RESET!**`;
  myEmbed.setTitle(title);
  const footer = `${getLeagueTierDisplayName(scPlayer)}`;
  myEmbed.setFooter({ text: footer, iconURL: getRankedBattleLogFooterIconUrl(scPlayer) });
  myEmbed.setColor(config.color.main);
  myEmbed.setTimestamp();
  let description = '';
  description += `<t:${eventData.unixTimeSeconds}:t> :trophy: **${eventData.trophiesCurrent}** ${config.emote.thn[scPlayer.townHallLevel]} **${scPlayer.name}**\n\n`;
  const leagueTierIdBefore = mongoAcc.leagueTier?.id ?? 0;
  const leagueTierIdAfter = scPlayer.leagueTier?.id ?? 0;
  if (leagueTierIdAfter - leagueTierIdBefore == 1) {
    description += `${config.emote.up} You've been promoted!\n`;
  } else if (leagueTierIdAfter - leagueTierIdBefore == -1) {
    description += `${config.emote.down} You've been demoted.\n`;
  } else if (leagueTierIdAfter - leagueTierIdBefore == 0) {
    description += `${config.emote.white_small_square} You've stayed the same.\n`;
  } else {
    description += `:exclamation: The league has been reset.\n`;
  }
  // Non-legend reset has a sign-up window until Tuesday 02:00 JST.
  const tournamentStartUnixFromReset = (() => {
    if (!Number.isFinite(eventData.unixTimeSeconds)) {
      return NaN;
    }
    const resetUtcMs = eventData.unixTimeSeconds * 1000;
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const resetJstDate = new Date(resetUtcMs + JST_OFFSET_MS);
    const jstDay = resetJstDate.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, ...
    const daysUntilTuesday = (2 - jstDay + 7) % 7;

    let tuesday2amJstUtcMs = Date.UTC(
      resetJstDate.getUTCFullYear(),
      resetJstDate.getUTCMonth(),
      resetJstDate.getUTCDate() + daysUntilTuesday,
      -7,
      0,
      0,
    ); // 02:00 JST

    if (tuesday2amJstUtcMs <= resetUtcMs) {
      tuesday2amJstUtcMs += 7 * 24 * 60 * 60 * 1000;
    }

    return Math.floor(tuesday2amJstUtcMs / 1000);
  })();
  const tournamentStartUnixFromWindow = Math.floor(
    new Date(seasonData.tournamentWindow.startTime).getTime() / 1000,
  );
  const tournamentStartUnix = Number.isFinite(tournamentStartUnixFromReset)
    && tournamentStartUnixFromReset > 0
    ? tournamentStartUnixFromReset
    : tournamentStartUnixFromWindow;
  description += `Sign up now to join the next tournament.\n`;
  if (Number.isFinite(tournamentStartUnix) && tournamentStartUnix > 0) {
    description += `Tournament starts at: <t:${tournamentStartUnix}:F> (<t:${tournamentStartUnix}:R>)\n`;
  } else {
    description += `Tournament starts at: ${seasonData.tournamentWindow.startTime}\n`;
  }
  myEmbed.setDescription(description);

  return myEmbed;
}

function formatDestructionPercentage(destructionPercentage) {
  if (Number.isFinite(destructionPercentage)) {
    return ` ${destructionPercentage}%`;
  }
  return '';
}

function createDescriptionLegend(diffTrophies, destructionPercentage = null) {
  let description = '';
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
    description += formatDestructionPercentage(destructionPercentage);
    if (functions.countStarsLegend(diffTrophies) == 3) {
      description += ` :boom:`;
    }
    return description;
  }
  return `${description}${formatDestructionPercentage(destructionPercentage)}`;
}

function createDescriptionNonLegend(diffTrophies, destructionPercentage = null) {
  let description = '';
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
    description += formatDestructionPercentage(destructionPercentage);
    if (functions.countStarsNonLegend(diffTrophies) == 3) {
      description += ` :boom:`;
    }
    return description;
  }
  return `${description}${formatDestructionPercentage(destructionPercentage)}`;
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

async function autoUpdateLegendReset(client) {
  var query = { status: true };
  var sort = { trophies: -1 };
  var cursor = client.clientMongo
    .db('jwc')
    .collection('accounts')
    .find(query, {
      projection: {
        _id: 0,
        tag: 1,
      },
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
    'previous',
    'legendPreviousSeason',
    'legend.previous.trophies'
  );

  return;
}
export { autoUpdateLegendReset };

async function updateLegendPreviousSeason(clientMongo, clientCoc, playerTag) {
  try {
    let mongoAcc = await clientMongo
      .db('jwc')
      .collection('accounts')
      .findOne({ tag: playerTag }, { projection: { legend: 1, _id: 0 } });

    if (mongoAcc.legend) {
      let listingUpdate = {};
      listingUpdate.attackWins = 0;
      listingUpdate.defenseWins = 0;
      listingUpdate.diffAttackWins = 0;
      listingUpdate.diffDefenseWins = 0;

      const resultScan = await functions.scanAcc(clientCoc, playerTag);
      if (resultScan.scPlayer) {
        listingUpdate.legend = mongoAcc.legend;
        listingUpdate.legend.previous =
          resultScan.scPlayer.legendStatistics?.previousSeason ?? null;
      }

      await clientMongo
        .db('jwc')
        .collection('accounts')
        .updateOne({ tag: playerTag }, { $set: listingUpdate });
    }
  } catch (error) {
    console.error(error);
  }
  return;
}
