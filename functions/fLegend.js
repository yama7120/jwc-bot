import { EmbedBuilder } from 'discord.js';

import config from '../config/config.js';
import config_coc from '../config/config_coc.js';

import * as functions from './functions.js';
import * as fRanking from './fRanking.js';
import {
  battleLogItemMatchesStoredRankedBattle,
  filterRankedBattleItems,
  hasLegendRankedOpponentEvent,
  isLegendRankedEventsSeeded,
} from './fBattleLog.js';

const LEAGUE_SEASONS_LEAGUE_ID = 29000022;
const LEAGUE_SEASONS_CACHE_MS = 10 * 60 * 1000;
let leagueSeasonsCache = { fetchedAtMs: 0, items: null };

async function fetchLeagueSeasons(clientCoc) {
  try {
    if (!clientCoc) return [];
    // NOTE: /leagues/{leagueId}/seasons is for CWL league seasons.
    // We intentionally hardcode leagueId=29000022 per requirements.
    if (typeof clientCoc?.rest?.requestHandler?.request === 'function') {
      const res = await clientCoc.rest.requestHandler.request(
        `/leagues/${LEAGUE_SEASONS_LEAGUE_ID}/seasons`,
      );
      const items = res?.body?.items;
      return Array.isArray(items) ? items : [];
    }
    // clashofclans.js helper may differ by version; prefer raw REST route above.
    if (typeof clientCoc?.getLeagueSeasons === 'function') {
      const seasons = await clientCoc.getLeagueSeasons(LEAGUE_SEASONS_LEAGUE_ID);
      return Array.isArray(seasons) ? seasons : [];
    }
    return [];
  } catch (e) {
    console.warn(
      `[legend] failed to fetch league seasons (${LEAGUE_SEASONS_LEAGUE_ID}):`,
      e?.message ?? e,
    );
    return [];
  }
}

async function getCurrentLeagueSeasonId(clientCoc) {
  const nowMs = Date.now();
  if (
    leagueSeasonsCache.items
    && nowMs - leagueSeasonsCache.fetchedAtMs < LEAGUE_SEASONS_CACHE_MS
  ) {
    const cached = leagueSeasonsCache.items;
    const now = nowMs;
    const hit = cached.find((s) => {
      const st = new Date(s?.startTime).getTime();
      const et = new Date(s?.endTime).getTime();
      return Number.isFinite(st) && Number.isFinite(et) && st <= now && now <= et;
    });
    return hit?.id ?? cached[0]?.id ?? null;
  }
  const items = await fetchLeagueSeasons(clientCoc);
  leagueSeasonsCache = { fetchedAtMs: nowMs, items };
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  const hit = items.find((s) => {
    const st = new Date(s?.startTime).getTime();
    const et = new Date(s?.endTime).getTime();
    return Number.isFinite(st) && Number.isFinite(et) && st <= nowMs && nowMs <= et;
  });
  return hit?.id ?? items[0]?.id ?? null;
}

/** レジェンドのシーズン開始トロフィーリセット（5000・一括減少）かどうか */
function isLegendLeagueSeasonTrophyReset(beforePlayerStats, afterPlayerStats) {
  if (afterPlayerStats.trophies !== 5000 || beforePlayerStats.trophies <= 5000) {
    return false;
  }
  const diffTrophies = afterPlayerStats.trophies - beforePlayerStats.trophies;
  // 単発防衛程度（おおよそ -40 前後）でちょうど 5000 になるケースと区別する
  return diffTrophies <= -100;
}

/** Legend I 以外のランク戦シーズン切り替え（前シーズンの battle log が一括で「新規」扱いされるのを防ぐ） */
function isNonLegendRankedSeasonStart(
  beforePlayerStats,
  afterPlayerStats,
  seasonData,
  mongoAcc,
) {
  if (afterPlayerStats.leagueTier?.id === config_coc.leagueId.legend) {
    return false;
  }

  const storedSeason = mongoAcc?.legend?.lastRankedSeasonId;
  if (
    typeof storedSeason === 'string'
    && storedSeason.length > 0
    && storedSeason !== seasonData.seasonId
  ) {
    return true;
  }

  const events = Array.isArray(mongoAcc?.legend?.events)
    ? mongoAcc.legend.events
    : [];
  if (events.length > 0) {
    const hasCurrentSeason = events.some((e) => e?.season === seasonData.seasonId);
    const hasOtherSeason = events.some(
      (e) => typeof e?.season === 'string' && e.season !== seasonData.seasonId,
    );
    if (hasOtherSeason && !hasCurrentSeason) {
      return true;
    }
  }

  if (
    seasonData.daysNow === 1
    && beforePlayerStats.trophies - afterPlayerStats.trophies >= 200
  ) {
    return true;
  }

  return false;
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

function leagueFooterCapSuffix(scPlayer) {
  if (scPlayer?.leagueTier?.id === config_coc.leagueId.legend) {
    return '';
  }
  const cap = getRankedBattlesCapForTier(scPlayer?.leagueTier?.id);
  return cap > 0 ? ` [x${cap}]` : '';
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
      `${getLeagueTierDisplayName(scPlayer)}${leagueFooterCapSuffix(scPlayer)} | ` +
      `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  } else {
    footer = `${getLeagueTierDisplayName(scPlayer)}${leagueFooterCapSuffix(scPlayer)}`;
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

  // 基本的なeventDataオブジェクトを作成（リセット通知用）
  const baseEventData = {
    // NOTE: ranked battles / legend logs must use Legend seasonId.
    // CWL league season id (e.g. "2015-07") breaks numeric season sorting in legend aggregations.
    season: seasonData.seasonId,
    day: seasonData.daysNow,
    trophiesCurrent: afterPlayerStats.trophies,
    diffTrophies: afterPlayerStats.trophies - beforePlayerStats.trophies,
    unixTimeSeconds: unixTimeSeconds,
    attacksCurrent: afterPlayerStats.attackWins,
    defensesCurrent: afterPlayerStats.defenseWins,
    diffAttackWins: afterPlayerStats.attackWins - beforePlayerStats.attackWins,
    diffDefenseWins: afterPlayerStats.defenseWins - beforePlayerStats.defenseWins,
    leagueId: afterPlayerStats.leagueTier.id,
    leagueName: afterPlayerStats.leagueTier.name,
  };

  // LEGEND I のシーズン開始リセットは最優先
  if (
    afterPlayerStats.leagueTier.id == config_coc.leagueId.legend
    && isLegendLeagueSeasonTrophyReset(beforePlayerStats, afterPlayerStats)
  ) {
    const embed = await createLogLegendNewSeason(
      afterPlayerStats,
      mongoAcc,
      baseEventData,
      seasonData,
    );
    await sendLogEmbed(client, mongoAcc, embed);
    return;
  }

  // Legend I 以外: シーズン切り替え時は新シーズン通知のみ（前シーズン分の防衛/攻撃は通知しない）
  if (
    isNonLegendRankedSeasonStart(
      beforePlayerStats,
      afterPlayerStats,
      seasonData,
      mongoAcc,
    )
  ) {
    const embed = await createLogLegendNewSeason(
      afterPlayerStats,
      mongoAcc,
      baseEventData,
      seasonData,
    );
    await sendLogEmbed(client, mongoAcc, embed);
    if (Array.isArray(battleLogItems)) {
      await ingestLegendRankedBattleLogSilent(
        client,
        mongoAcc,
        filterRankedBattleItems(battleLogItems),
        afterPlayerStats,
        seasonData,
      );
    } else {
      await client.clientMongo
        .db('jwc')
        .collection('accounts')
        .updateOne(
          { tag: mongoAcc.tag },
          { $set: { 'legend.lastRankedSeasonId': seasonData.seasonId } },
        );
    }
    return;
  }

  // battle log が取れた場合は、リーグに関係なく ranked の差分検出用に保持・通知
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
    `⚠️ ranked battle log: battle log unavailable for ${afterPlayerStats.tag}; skip (no stats inference)`,
  );

  return;
}
export { autoUpdateLegend };

// (stats inference helpers removed)

async function writeLogLegendR2(client, mongoAcc, legendEventType, eventData) {
  // 単一イベントの場合は配列に変換
  const events = Array.isArray(eventData) ? eventData : [eventData];

  const existingEvents = Array.isArray(mongoAcc.legend?.events)
    ? mongoAcc.legend.events
    : [];

  const newEvents = [];
  for (const event of events) {
    const opp =
      typeof event.opponentPlayerTag === 'string' ? event.opponentPlayerTag.trim() : '';
    if (
      opp
      && hasLegendRankedOpponentEvent(
        existingEvents,
        event.season,
        event.day,
        legendEventType,
        opp,
      )
    ) {
      continue;
    }
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
    if (opp) {
      row.opponentPlayerTag = opp;
    }
    if (Number.isFinite(event.stars)) {
      row.stars = Math.min(3, Math.max(0, Number(event.stars)));
    }
    if (Number.isFinite(event.destructionPercentage)) {
      row.destructionPercentage = Number(event.destructionPercentage);
    }
    newEvents.push(row);
  }

  if (newEvents.length === 0) {
    return { skipped: true, nToday: null, value: { legend: mongoAcc.legend } };
  }

  // 1. 新しいイベントの最後のdayを取得
  const lastEvent = newEvents[newEvents.length - 1];
  const targetSeason = lastEvent.season;
  const targetDay = lastEvent.day;
  const isLegend1 = lastEvent.leagueId === config_coc.leagueId.legend;

  let updatedDayData = null;
  let mergedLegendDays = { $ifNull: ['$legend.days', []] };
  if (isLegend1) {
    // 2. 既存のeventsから該当するdayのイベントを取得
    const existingEvents = Array.isArray(mongoAcc.legend.events)
      ? mongoAcc.legend.events
      : [];
    const targetDayEvents = existingEvents.filter(
      (event) => event.season === targetSeason && event.day === targetDay,
    );

    // 3. 該当するdayのイベントを再計算（既存 + 新規）
    const allTargetDayEvents = [...targetDayEvents, ...newEvents];
    updatedDayData = aggregateDaysFromEvents(allTargetDayEvents).find(
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
    mergedLegendDays = updatedDayData
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
  }

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
        ...(isLegend1 ? [
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
        ] : []),
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
  switch (legendEventType) {
    case 'attack':
      if (logSettings.attacks === 'all')
        return await createLogLegendAttack(
          client,
          scPlayer,
          eventData,
          nEvents,
          i,
          seasonData,
          legendEventType,
          result,
        );
      break;

    case 'defense':
      if (logSettings.defenses === 'all')
        return await createLogLegendDefense(
          client,
          scPlayer,
          eventData,
          nEvents,
          i,
          seasonData,
          legendEventType,
          result,
        );
      if (
        logSettings.defenses === 'non-tripled' &&
        eventData.diffTrophies !== -40
      )
        return await createLogLegendDefense(
          client,
          scPlayer,
          eventData,
          nEvents,
          i,
          seasonData,
          legendEventType,
          result,
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

function formatSignedInt(n) {
  const v = Math.round(Number(n) || 0);
  return v >= 0 ? `+${v}` : `${v}`;
}

function buildLegendBarChartLine(kind, nToday) {
  if (!nToday) return '';

  if (kind === 'attack') {
    const n = Number(nToday.attacks ?? 0);
    const sum = Number(nToday.attackTrophies ?? 0);
    if (!Number.isFinite(n) || !Number.isFinite(sum) || n <= 0) return '';
    const avg = Math.round(sum / n);
    return `${config.emote.sword} ${formatSignedInt(sum)} in ${n} attacks (avg: ${formatSignedInt(avg)})\n`;
  }

  if (kind === 'defense') {
    const n = Number(nToday.defenses ?? 0);
    const sum = Number(nToday.defenseTrophies ?? 0);
    if (!Number.isFinite(n) || !Number.isFinite(sum) || n <= 0) return '';
    const avg = Math.round(sum / n);
    return `${config.emote.shield} ${formatSignedInt(sum)} in ${n} defenses (avg: ${formatSignedInt(avg)})\n`;
  }

  return '';
}

function buildWeeklySummaryLine(kind, legendEvents, seasonData) {
  const ws = getWeeklySummaryFromEvents(legendEvents, seasonData);
  if (!ws) return '';

  if (kind === 'attack') {
    const n = Number(ws.attacks ?? 0);
    const sum = Number(ws.attackTrophies ?? 0);
    if (!Number.isFinite(n) || !Number.isFinite(sum) || n <= 0) return '';
    const avg = Math.round(sum / n);
    return `${config.emote.sword} ${formatSignedInt(sum)} in ${n} attacks (avg: ${formatSignedInt(avg)})\n`;
  }

  if (kind === 'defense') {
    const n = Number(ws.defenses ?? 0);
    const sum = Number(ws.defenseTrophies ?? 0);
    if (!Number.isFinite(n) || !Number.isFinite(sum) || n <= 0) return '';
    const avg = Math.round(sum / n);
    return `${config.emote.shield} ${formatSignedInt(sum)} in ${n} defenses (avg: ${formatSignedInt(avg)})\n`;
  }

  return '';
}

function buildRankedBattleStarsAndDestText(scPlayer, eventData) {
  const isLegend1 = scPlayer?.leagueTier?.id == config_coc.leagueId.legend;
  // battle log 由来の eventData.stars があればそれを使う（non-legend は diffTrophies から逆算できないため）
  const starsFromEvent = Number(eventData?.stars);
  const countStars = Number.isFinite(starsFromEvent)
    ? Math.min(3, Math.max(0, starsFromEvent))
    : (isLegend1
      ? functions.countStarsLegend(eventData.diffTrophies)
      : functions.countStarsNonLegend(eventData.diffTrophies));

  let s = '';
  if (countStars === 0) {
    s += `${config.emote.starGray}`;
  } else {
    for (let i = 1; i <= countStars; i++) {
      s += `${config.emote.star}`;
    }
  }

  const dp = Number(eventData.destructionPercentage);
  if (Number.isFinite(dp)) {
    s += ` ${dp}%`;
  }

  if (countStars === 3) {
    s += ` :boom:`;
  }

  return s;
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

  // Legend I のみ防衛は攻撃側の獲得トロフィーのマイナス（対称ルール）
  if (leagueId === config_coc.leagueId.legend) {
    return -calcAttackTrophies(stars, destruction);
  }

  return calcDefenseTrophies(stars, destruction);
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

function legendWeekKey(w) {
  if (!w) return null;
  const id = w.weekId ?? weeklyTournamentIdFromStartUnix(w.weekStartUnix);
  if (!id) return null;
  return `${w.season}|${id}`;
}

function mergeLegendWeeks(existingWeeks, weekEntry) {
  const safe = Array.isArray(existingWeeks) ? existingWeeks : [];
  const targetKey = legendWeekKey(weekEntry);
  // 同じ週 (season + weekId) の既存エントリを除去して、新エントリで置き換える。
  // weekId は UTC 月曜日付なので、旧スケジュール (Mon 05:00 UTC) で保存された
  // weekStartUnix から導出した ID とも一致する → 自然にマイグレーションされる。
  const filtered = targetKey
    ? safe.filter((w) => legendWeekKey(w) !== targetKey)
    : safe;
  return [...filtered, weekEntry]
    .sort((a, b) => (b.weekStartUnix ?? 0) - (a.weekStartUnix ?? 0))
    .slice(0, 80);
}

async function updateLegendWeeksFromEvents(
  client,
  mongoAcc,
  legendEvents,
  seasonData,
  leagueTier,
) {
  const { startUnix, weekEndUnix } = getWeeklyTournamentUnixBounds(seasonData);
  const ws = getWeeklySummaryFromEvents(legendEvents, seasonData);
  const av = getWeekRatedBattleAvgStats(legendEvents, seasonData);
  const weekEntry = {
    season: seasonData.seasonId,
    weekId: weeklyTournamentIdFromStartUnix(startUnix),
    weekStartUnix: startUnix,
    weekEndUnix,
    leagueId: leagueTier?.id ?? null,
    leagueName: leagueTier?.name ?? null,
    attacks: ws.attacks,
    defenses: ws.defenses,
    attackTrophies: ws.attackTrophies,
    defenseTrophies: ws.defenseTrophies,
    attackStarsAvg: av.attackStarsAvg,
    attackDestAvg: av.attackDestAvg,
    defenseStarsAvg: av.defenseStarsAvg,
    defenseDestAvg: av.defenseDestAvg,
    updatedAt: Math.floor(Date.now() / 1000),
  };
  const merged = mergeLegendWeeks(mongoAcc.legend?.weeks, weekEntry);
  await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .updateOne({ tag: mongoAcc.tag }, { $set: { 'legend.weeks': merged } });
  mongoAcc.legend = { ...(mongoAcc.legend ?? {}), weeks: merged };
}

function buildRankedEventDataFromBattleLogItem(
  item,
  afterPlayerStats,
  seasonData,
  runningTrophies,
  diffT,
  unixTimeSeconds,
  includeRanking,
) {
  const isAttack = item?.attack === true;
  const opp = typeof item?.opponentPlayerTag === 'string' ? item.opponentPlayerTag.trim() : '';
  return {
    season: seasonData.seasonId,
    day: seasonData.daysNow,
    trophiesCurrent: runningTrophies,
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
    includeRanking,
    opponentPlayerTag: opp || undefined,
  };
}

/** 初回のみ API の ranked ログを events に無通知で取り込み（以降は opponent で差分検出） */
async function bootstrapLegendRankedEvents(
  client,
  mongoAcc,
  rankedItems,
  afterPlayerStats,
  seasonData,
) {
  const capped = rankedItems.length > 120 ? rankedItems.slice(-120) : rankedItems;
  let mongoAccMut = { ...mongoAcc };

  for (const item of capped) {
    const opp = item?.opponentPlayerTag ?? '';
    if (!opp) continue;
    if (
      battleLogItemMatchesStoredRankedBattle(
        item,
        mongoAccMut.legend?.events,
        mongoAccMut.legend?.rankedBattleLog,
      )
    ) {
      continue;
    }

    const isAttack = item?.attack === true;
    const legendEventType = isAttack ? 'attack' : 'defense';
    const diffT = rankedBattleTrophyDeltaFromBattleLog(
      isAttack,
      item?.stars,
      item?.destructionPercentage,
      afterPlayerStats.leagueTier.id,
    );
    const eventData = buildRankedEventDataFromBattleLogItem(
      item,
      afterPlayerStats,
      seasonData,
      afterPlayerStats.trophies,
      diffT,
      Math.floor(Date.now() / 1000),
      false,
    );

    const result = await writeLogLegendR2(
      client,
      mongoAccMut,
      legendEventType,
      eventData,
    );
    if (result?.skipped) continue;
    const updatedLegend = result?.value?.legend;
    if (updatedLegend) {
      mongoAccMut = { ...mongoAccMut, legend: updatedLegend };
    }
  }

  await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .updateOne(
      { tag: mongoAcc.tag },
      {
        $set: {
          'legend.rankedEventsSeeded': true,
          'legend.lastRankedSeasonId': seasonData.seasonId,
        },
        $unset: { 'legend.rankedBattleLog': '' },
      },
    );
  await reloadMongoAccLegendProjection(client, mongoAcc);
}

/** シーズン切り替え時など: ranked battle log を events に取り込むだけ（Discord 通知なし） */
async function ingestLegendRankedBattleLogSilent(
  client,
  mongoAcc,
  rankedItems,
  afterPlayerStats,
  seasonData,
) {
  const capped = rankedItems.length > 120 ? rankedItems.slice(-120) : rankedItems;
  let mongoAccMut = { ...mongoAcc };

  for (const item of capped) {
    const opp = item?.opponentPlayerTag ?? '';
    if (!opp) continue;
    if (
      battleLogItemMatchesStoredRankedBattle(
        item,
        mongoAccMut.legend?.events,
        mongoAccMut.legend?.rankedBattleLog,
      )
    ) {
      continue;
    }

    const isAttack = item?.attack === true;
    const legendEventType = isAttack ? 'attack' : 'defense';
    const diffT = rankedBattleTrophyDeltaFromBattleLog(
      isAttack,
      item?.stars,
      item?.destructionPercentage,
      afterPlayerStats.leagueTier.id,
    );
    const eventData = buildRankedEventDataFromBattleLogItem(
      item,
      afterPlayerStats,
      seasonData,
      afterPlayerStats.trophies,
      diffT,
      Math.floor(Date.now() / 1000),
      false,
    );

    const result = await writeLogLegendR2(
      client,
      mongoAccMut,
      legendEventType,
      eventData,
    );
    if (result?.skipped) continue;
    const updatedLegend = result?.value?.legend;
    if (updatedLegend) {
      mongoAccMut = { ...mongoAccMut, legend: updatedLegend };
    }
  }

  await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .updateOne(
      { tag: mongoAcc.tag },
      {
        $set: {
          'legend.rankedEventsSeeded': true,
          'legend.lastRankedSeasonId': seasonData.seasonId,
        },
        $unset: { 'legend.rankedBattleLog': '' },
      },
    );
  await reloadMongoAccLegendProjection(client, mongoAcc);
}

/**
 * battleType ranked のみを legend.events に記録し、新規行だけ通知する。
 * 同日・同 action では opponentPlayerTag は一意（API に battleTime は無い想定）。
 * CoC API の battle log は古い戦闘ほど先頭・新しいほど末尾（下）の並び想定。
 */
async function processLegendRankedBattleLog(
  client,
  mongoAcc,
  battleLogItems,
  afterPlayerStats,
  seasonData,
) {
  await reloadMongoAccLegendProjection(client, mongoAcc);

  const ranked = filterRankedBattleItems(battleLogItems);

  if (!isLegendRankedEventsSeeded(mongoAcc.legend)) {
    await bootstrapLegendRankedEvents(
      client,
      mongoAcc,
      ranked,
      afterPlayerStats,
      seasonData,
    );
    return;
  }

  const legendEvents = mongoAcc.legend?.events ?? [];
  const legacyRankedLog = mongoAcc.legend?.rankedBattleLog;

  const newRev = [];
  for (let i = ranked.length - 1; i >= 0; i--) {
    const item = ranked[i];
    if (battleLogItemMatchesStoredRankedBattle(item, legendEvents, legacyRankedLog)) {
      break;
    }
    newRev.push(item);
  }

  if (newRev.length === 0) {
    return;
  }

  // シーズン初日に大量の「新規」が出た場合は誤検知（events 80件切り詰め等）→ 通知せず取り込みのみ
  if (
    afterPlayerStats.leagueTier.id !== config_coc.leagueId.legend
    && seasonData.daysNow <= 1
    && newRev.length >= 5
  ) {
    await ingestLegendRankedBattleLogSilent(
      client,
      mongoAcc,
      ranked,
      afterPlayerStats,
      seasonData,
    );
    return;
  }

  const chronological = [...newRev].reverse();
  let mongoAccMut = { ...mongoAcc };
  let lastResult = null;
  const baseUnixTimeSeconds = Math.floor(Date.now() / 1000);
  const spacedStepSeconds = 120;
  const diffsChronological = chronological.map((item) => {
    const isAttack = item?.attack === true;
    return rankedBattleTrophyDeltaFromBattleLog(
      isAttack,
      item?.stars,
      item?.destructionPercentage,
      afterPlayerStats.leagueTier.id,
    );
  });
  const totalDelta = diffsChronological.reduce((sum, v) => sum + (Number(v) || 0), 0);
  let runningTrophies = Number(afterPlayerStats.trophies) - totalDelta;

  for (let idx = 0; idx < chronological.length; idx++) {
    const item = chronological[idx];
    const isAttack = item?.attack === true;
    const legendEventType = isAttack ? 'attack' : 'defense';
    const diffT = diffsChronological[idx];
    runningTrophies += diffT;
    const unixTimeSeconds = baseUnixTimeSeconds + (idx * spacedStepSeconds);
    const includeRanking = idx === chronological.length - 1;
    const eventData = buildRankedEventDataFromBattleLogItem(
      item,
      afterPlayerStats,
      seasonData,
      runningTrophies,
      diffT,
      unixTimeSeconds,
      includeRanking,
    );

    lastResult = await writeLogLegendR2(
      client,
      mongoAccMut,
      legendEventType,
      eventData,
    );
    if (lastResult?.skipped) {
      continue;
    }
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

  if (afterPlayerStats.leagueTier.id !== config_coc.leagueId.legend) {
    await updateLegendWeeksFromEvents(
      client,
      mongoAccMut,
      lastResult?.value?.legend?.events,
      seasonData,
      afterPlayerStats.leagueTier,
    );
  }

  await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .updateOne(
      { tag: mongoAcc.tag },
      {
        $set: {
          'legend.rankedEventsSeeded': true,
          'legend.lastRankedSeasonId': seasonData.seasonId,
        },
        $unset: { 'legend.rankedBattleLog': '' },
      },
    );

  await reloadMongoAccLegendProjection(client, mongoAcc);
}

/**
 * 週次トーナメント (Legend 1 以外) の境界を JST ベースで自前計算する。
 *
 * 仕様:
 *   - 週開始: JST 火 02:00  (= UTC 月 17:00)
 *   - 週終了: 翌 JST 月 02:00 (= UTC 日 17:00)  ← 週開始 + 6日
 *   - JST 月 02:00 〜 火 02:00 はバトル不可の 24h ギャップ
 *
 * ギャップ中 (= 週終了後・次の週開始前) に呼ばれた場合は「直前に終わった週」
 * の境界を返す。これにより、cronUpdate2am (JST 02:00) 直後に呼ばれても
 * 集計対象は前週分のまま保たれる。
 *
 * 第2引数 (legacy: seasonData) は互換のため受け取るが未使用。
 */
function getWeeklyTournamentUnixBounds(_seasonData, nowMs = Date.now()) {
  const d = new Date(nowMs);
  const day = d.getUTCDay(); // 0=Sun ... 6=Sat
  const hour = d.getUTCHours();

  // 「直近の UTC 月 17:00」までの経過日数
  // Mon=0, Tue=1, ..., Sun=6
  let daysSinceWeekStart = (day + 6) % 7;
  // 月曜の 17:00 UTC 未満は「先週月曜が直近の週開始」
  if (day === 1 && hour < 17) {
    daysSinceWeekStart = 7;
  }

  const weekStartDate = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - daysSinceWeekStart,
    17, 0, 0, 0,
  ));
  // 週終了 = 週開始 + 6 日 (24h ギャップは含めない)
  const weekEndDate = new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);

  return {
    startUnix: Math.floor(weekStartDate.getTime() / 1000),
    weekEndUnix: Math.floor(weekEndDate.getTime() / 1000),
  };
}

/**
 * 週次トーナメントの安定 ID。UTC 月曜の YYYY-MM-DD を返す。
 * 旧スケジュール (Mon 05:00 UTC 起点) で保存されたデータも同じ ID に揃うので、
 * `mergeLegendWeeks` のキー突合に使える。
 */
function weeklyTournamentIdFromStartUnix(startUnix) {
  if (!Number.isFinite(startUnix) || startUnix <= 0) return null;
  return new Date(startUnix * 1000).toISOString().slice(0, 10);
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
    if (event.season && event.season !== seasonData.seasonId) {
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
    if (event.season && event.season !== seasonData.seasonId) {
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
  nEvents,
  i,
  seasonData,
  legendEventType,
  result = null,
) {
  const myEmbed = new EmbedBuilder();
  const titleEmote = eventData.diffTrophies >= 0 ? config.emote.up : config.emote.down;
  myEmbed.setTitle(
    `${titleEmote}**${formatSignedInt(eventData.diffTrophies)}** :trophy: **${eventData.trophiesCurrent}**`,
  );
  let footer = '';
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    footer =
      `${getLeagueTierDisplayName(scPlayer)}${leagueFooterCapSuffix(scPlayer)} | ` +
      `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO`;
  } else {
    footer = `${getLeagueTierDisplayName(scPlayer)}${leagueFooterCapSuffix(scPlayer)}`;
  }
  myEmbed.setFooter({ text: footer, iconURL: getRankedBattleLogFooterIconUrl(scPlayer) });
  myEmbed.setColor(config.color.attack);
  myEmbed.setTimestamp();

  const urlPlayer = `https://link.clashofclans.com/jp?action=OpenPlayerProfile&tag=${scPlayer.tag.slice(1)}`;
  let description = `${config.emote.thn[scPlayer.townHallLevel]} **${scPlayer.name}** [${scPlayer.tag}](${urlPlayer})\n`;
  description += `<t:${eventData.unixTimeSeconds}:t> ${buildRankedBattleStarsAndDestText(scPlayer, eventData)}\n`;

  // legend1 は当日集計、それ以外は週次集計
  if (scPlayer?.leagueTier?.id == config_coc.leagueId.legend) {
    const dayLine = buildLegendBarChartLine('attack', result?.nToday);
    if (dayLine) description += dayLine;
  } else {
    const weekLine = buildWeeklySummaryLine(
      'attack',
      result?.value?.legend?.events ?? scPlayer?.legend?.events ?? null,
      seasonData,
    );
    if (weekLine) description += weekLine;
  }

  if (isLegendLeagueTierId(eventData.leagueId)) {
    if (eventData.includeRanking !== false) {
      const rankingDisplay = await getRankingDisplay(client, scPlayer);
      if (rankingDisplay) {
        description += rankingDisplay;
      }
    }

    if (
      eventData.leagueId === config_coc.leagueId.legend
      && eventData.includeRanking !== false
    ) {
      description += `${config.emote.discord}</legend stats:${config.command.legend.id}>`;
      description += ` ${config.emote.discord}</legend history own:${config.command.legend.id}>`;
    }
  }
  myEmbed.setDescription(description);

  return myEmbed;
}

async function createLogLegendDefense(
  client,
  scPlayer,
  eventData,
  nEvents,
  i,
  seasonData,
  legendEventType,
  result = null,
) {
  const myEmbed = new EmbedBuilder();
  const titleEmote = eventData.diffTrophies >= 0 ? config.emote.up : config.emote.down;
  myEmbed.setTitle(
    `${titleEmote}**${formatSignedInt(eventData.diffTrophies)}** :trophy: **${eventData.trophiesCurrent}**`,
  );
  let footer = '';
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    footer =
      `${getLeagueTierDisplayName(scPlayer)}${leagueFooterCapSuffix(scPlayer)} | ` +
      `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO`;
  } else {
    footer = `${getLeagueTierDisplayName(scPlayer)}${leagueFooterCapSuffix(scPlayer)}`;
  }
  myEmbed.setFooter({ text: footer, iconURL: getRankedBattleLogFooterIconUrl(scPlayer) });
  myEmbed.setColor(config.color.defense);
  myEmbed.setTimestamp();
  const urlPlayer = `https://link.clashofclans.com/jp?action=OpenPlayerProfile&tag=${scPlayer.tag.slice(1)}`;
  let description = `${config.emote.thn[scPlayer.townHallLevel]} **${scPlayer.name}** [${scPlayer.tag}](${urlPlayer})\n`;
  description += `<t:${eventData.unixTimeSeconds}:t> ${buildRankedBattleStarsAndDestText(scPlayer, eventData)}\n`;

  // legend1 は当日集計、それ以外は週次集計
  if (scPlayer?.leagueTier?.id == config_coc.leagueId.legend) {
    const dayLine = buildLegendBarChartLine('defense', result?.nToday);
    if (dayLine) description += dayLine;
  } else {
    const weekLine = buildWeeklySummaryLine(
      'defense',
      result?.value?.legend?.events ?? scPlayer?.legend?.events ?? null,
      seasonData,
    );
    if (weekLine) description += weekLine;
  }

  if (isLegendLeagueTierId(eventData.leagueId)) {
    if (eventData.includeRanking !== false) {
      const rankingDisplay = await getRankingDisplay(client, scPlayer);
      if (rankingDisplay) {
        description += rankingDisplay;
      }
    }

    if (
      eventData.leagueId === config_coc.leagueId.legend
      && eventData.includeRanking !== false
    ) {
      description += `${config.emote.discord}</legend stats:${config.command.legend.id}>`;
      description += ` ${config.emote.discord}</legend history own:${config.command.legend.id}>`;
    }
  }
  myEmbed.setDescription(description);

  return myEmbed;
}

// ランキング表示用の共通関数
async function getRankingDisplay(client, scPlayer) {
  try {
    // グローバル順位は /players/{playerTag} の legendStatistics に含まれる
    const globalRankValue = scPlayer?.legendStatistics?.currentSeason?.rank ?? null;

    let japanRank = null;
    try {
      const playerRanks = await client.clientCoc.getPlayerRanks(
        config_coc.locationId.japan,
      );
      japanRank = playerRanks.find((rank) => rank.tag === scPlayer.tag) ?? null;
    } catch (jpError) {
      console.error('日本ランキング取得エラー:', jpError);
    }

    let rankingText = '';
    if (japanRank) {
      rankingText += `:flag_jp: No. **${japanRank.rank}** in JAPAN\n`;
    }
    if (Number.isFinite(Number(globalRankValue)) && Number(globalRankValue) > 0) {
      rankingText += `:earth_asia: No. **${Number(globalRankValue)}** in GLOBAL\n`;
    }

    return rankingText;
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
      `${getLeagueTierDisplayName(scPlayer)}${leagueFooterCapSuffix(scPlayer)} | ` +
      `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  } else {
    footer = `${getLeagueTierDisplayName(scPlayer)}${leagueFooterCapSuffix(scPlayer)}`;
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
      `${getLeagueTierDisplayName(scPlayer)}${leagueFooterCapSuffix(scPlayer)} | ` +
      `DAY ${seasonData.daysNow} | ${seasonData.daysEnd} DAYS TO GO | SEASON ${seasonData.seasonId}`;
  } else {
    footer = `${getLeagueTierDisplayName(scPlayer)}${leagueFooterCapSuffix(scPlayer)}`;
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
