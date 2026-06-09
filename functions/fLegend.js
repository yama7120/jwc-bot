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

function getStoredRankedSeasonId(playerStats, seasonData) {
  if (playerStats?.leagueTier?.id === config_coc.leagueId.legend) {
    return String(seasonData.seasonId);
  }
  const currentLeagueSeasonId = Number(playerStats?.currentLeagueSeasonId);
  if (Number.isFinite(currentLeagueSeasonId) && currentLeagueSeasonId > 0) {
    return `ranked:${currentLeagueSeasonId}`;
  }
  return String(seasonData.seasonId);
}

function isNonLegendLeagueReset(beforePlayerStats, afterPlayerStats) {
  if (afterPlayerStats?.leagueTier?.id === config_coc.leagueId.legend) {
    return false;
  }

  const beforeTrophies = Number(beforePlayerStats?.trophies ?? 0);
  const afterTrophies = Number(afterPlayerStats?.trophies ?? 0);
  const beforeAttackWins = Number(beforePlayerStats?.attackWins ?? 0);
  const afterAttackWins = Number(afterPlayerStats?.attackWins ?? 0);
  const beforeDefenseWins = Number(beforePlayerStats?.defenseWins ?? 0);
  const afterDefenseWins = Number(afterPlayerStats?.defenseWins ?? 0);
  const beforeLeagueSeasonId = beforePlayerStats?.currentLeagueSeasonId;
  const afterLeagueSeasonId = afterPlayerStats?.currentLeagueSeasonId;

  const droppedToZero = afterTrophies === 0 && beforeTrophies > 0;
  const winsReset =
    (afterAttackWins === 0 && beforeAttackWins > 0)
    || (afterDefenseWins === 0 && beforeDefenseWins > 0);
  const leagueSeasonChanged =
    beforeLeagueSeasonId != null
    && afterLeagueSeasonId != null
    && String(beforeLeagueSeasonId) !== String(afterLeagueSeasonId);

  return droppedToZero || (afterTrophies === 0 && (winsReset || leagueSeasonChanged));
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
  const currentSeason = getStoredRankedSeasonId(afterPlayerStats, seasonData);
  // 既にこの ranked シーズンを処理済みなら、events の season 差分等で再判定しない
  if (
    typeof storedSeason === 'string'
    && storedSeason.length > 0
    && storedSeason === currentSeason
  ) {
    return false;
  }
  if (
    typeof storedSeason === 'string'
    && storedSeason.length > 0
    && storedSeason !== currentSeason
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

function getLeagueTierSortOrder(leagueTierId) {
  return config_coc.leagueTiers.findIndex((tier) => tier.id === leagueTierId);
}

function getLeagueResetSummaryLine(beforePlayerStats, afterPlayerStats) {
  const beforeTierId = beforePlayerStats?.leagueTier?.id ?? null;
  const afterTierId = afterPlayerStats?.leagueTier?.id ?? null;
  const beforeLabel = getLeagueTierDisplayName(beforePlayerStats);
  const afterLabel = getLeagueTierDisplayName(afterPlayerStats);
  const beforeOrder = getLeagueTierSortOrder(beforeTierId);
  const afterOrder = getLeagueTierSortOrder(afterTierId);

  if (beforeOrder >= 0 && afterOrder >= 0) {
    if (afterOrder > beforeOrder) {
      return `${config.emote.up} Promoted to **${afterLabel}** from **${beforeLabel}**.`;
    }
    if (afterOrder < beforeOrder) {
      return `${config.emote.down} Demoted to **${afterLabel}** from **${beforeLabel}**.`;
    }
    return `:white_small_square: Stayed in **${afterLabel}**.`;
  }

  if (beforeTierId != null && afterTierId != null && beforeTierId === afterTierId) {
    return `:white_small_square: Stayed in **${afterLabel}**.`;
  }

  return `:exclamation: Ranked league reset: **${beforeLabel}** -> **${afterLabel}**`;
}

function formatLegendWeekTrophyDelta(value) {
  if (!Number.isFinite(value)) return 'N/A';
  return value >= 0 ? `+${value}` : `${value}`;
}

function formatLegendWeekStat(value, suffix = '') {
  if (!Number.isFinite(value)) return '—';
  return `${value}${suffix}`;
}

/** 3★100%（dest 欠損の旧 event は 3★ のみ） */
function isRankedBattleFullDestruction(event) {
  const stars = Number(event?.stars);
  if (!Number.isFinite(stars) || stars < 3) {
    return false;
  }
  const dest = Number(event?.destructionPercentage);
  if (Number.isFinite(dest)) {
    return dest >= 100;
  }
  return true;
}

function formatWeekHitRateSuffix(triples, total) {
  const t = Number(total);
  const n = Number(triples);
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(n) || n < 0) {
    return '';
  }
  const pct = Math.round((n / t) * 100);
  return ` · :boom: **${pct}%** (**${n}/${t}**)`;
}

/** @param {Record<string, unknown> | null | undefined} week */
function formatWeeklyTournamentSection(week, heading = 'LAST TOURNAMENT') {
  if (!week) return '';

  const attacks = Number(week.attacks ?? 0);
  const defenses = Number(week.defenses ?? 0);
  const hasActivity =
    attacks > 0
    || defenses > 0
    || Number.isFinite(Number(week.attackTrophies))
    || Number.isFinite(Number(week.defenseTrophies));
  if (!hasActivity) return '';

  const leagueLabel = String(week.leagueName ?? 'Unknown');
  const weekId = String(week.weekId ?? '');
  const attackTrophies = Number(week.attackTrophies);
  const defenseTrophies = Number(week.defenseTrophies);
  const netTrophies =
    (Number.isFinite(attackTrophies) ? attackTrophies : 0)
    + (Number.isFinite(defenseTrophies) ? defenseTrophies : 0);

  let block = `\n--- **${heading}** ---\n`;
  block += `**${leagueLabel}** · \`${weekId}\`\n`;
  block += `${config.emote.sword} ${attacks}  ${formatLegendWeekTrophyDelta(attackTrophies)} :trophy:`;
  block += `  |  ★${formatLegendWeekStat(Number(week.attackStarsAvg))} · ${formatLegendWeekStat(Number(week.attackDestAvg), '%')}`;
  block += `${formatWeekHitRateSuffix(week.attackTriples, attacks)}\n`;
  block += `${config.emote.shield} ${defenses}  ${formatLegendWeekTrophyDelta(defenseTrophies)} :trophy:`;
  block += `  |  ★${formatLegendWeekStat(Number(week.defenseStarsAvg))} · ${formatLegendWeekStat(Number(week.defenseDestAvg), '%')}`;
  block += `${formatWeekHitRateSuffix(week.defenseTriples, defenses)}\n`;
  block += `Net: **${formatLegendWeekTrophyDelta(netTrophies)}** :trophy:\n`;
  return block;
}

function formatLastTournamentWeekSection(week) {
  return formatWeeklyTournamentSection(week, 'LAST TOURNAMENT');
}

function getLatestLegendWeek(mongoAcc) {
  const weeks = mongoAcc?.legend?.weeks;
  if (!Array.isArray(weeks) || weeks.length === 0) return null;
  return weeks[0];
}

function rankedAccountHasNotifications(logSettings) {
  if (!logSettings || logSettings.post === 'NA') return false;
  if (logSettings.post !== 'channel' && logSettings.post !== 'dm') return false;
  return (
    logSettings.attacks === 'all'
    || logSettings.defenses === 'all'
    || logSettings.defenses === 'non-tripled'
  );
}

function createRankedWeekEndReminderEmbed(mongoAcc, weekEndUnix) {
  const playerLike = {
    townHallLevel: mongoAcc.townHallLevel,
    name: mongoAcc.name,
    leagueTier: mongoAcc.leagueTier,
  };
  const myEmbed = new EmbedBuilder();
  myEmbed.setTitle('**⏰ TOURNAMENT ENDS IN 12 HOURS**');
  myEmbed.setFooter({
    text: `${getLeagueTierDisplayName(playerLike)}${leagueFooterCapSuffix(playerLike)}`,
    iconURL: getRankedBattleLogFooterIconUrl(playerLike),
  });
  myEmbed.setColor(config.color.main);
  myEmbed.setTimestamp();

  const nowUnix = Math.floor(Date.now() / 1000);
  let description = '';
  description += `<t:${nowUnix}:t> :trophy: **${mongoAcc.trophies ?? 0}** `;
  description += `${config.emote.thn[mongoAcc.townHallLevel]} **${mongoAcc.name}**\n\n`;
  description += `The weekly tournament ends in **12 hours**.\n`;
  description += `Reset: <t:${weekEndUnix}:F> (<t:${weekEndUnix}:R>)\n`;
  description += formatWeeklyTournamentSection(getLatestLegendWeek(mongoAcc), 'THIS WEEK');
  myEmbed.setDescription(description);
  return myEmbed;
}

async function cronRankedWeekEndReminder(client) {
  const seasonData = functions.calculateSeasonValues(client, new Date(), 17);
  const { startUnix, weekEndUnix } = getWeeklyTournamentUnixBounds(seasonData, Date.now());
  const weekId = weeklyTournamentIdFromStartUnix(startUnix);
  if (!weekId) {
    console.warn('[cronRankedWeekEndReminder] invalid weekId');
    return;
  }

  const query = {
    status: true,
    'leagueTier.id': { $ne: config_coc.leagueId.legend },
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
    townHallLevel: 1,
    trophies: 1,
    leagueTier: 1,
    pilotDC: 1,
    legend: 1,
  };

  const accounts = await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .find(query, { projection })
    .toArray();

  console.log(`[cronRankedWeekEndReminder] weekId=${weekId} accounts=${accounts.length}`);

  let sent = 0;
  let skipped = 0;

  for (const mongoAcc of accounts) {
    if (!rankedAccountHasNotifications(mongoAcc.legend?.logSettings)) {
      skipped += 1;
      continue;
    }
    if (mongoAcc.legend?.lastWeekEndReminderWeekId === weekId) {
      skipped += 1;
      continue;
    }

    try {
      await updateLegendWeeksFromEvents(
        client,
        mongoAcc,
        mongoAcc.legend?.events,
        seasonData,
        mongoAcc.leagueTier,
      );

      const embed = createRankedWeekEndReminderEmbed(mongoAcc, weekEndUnix);
      await sendLogEmbedToUser(client, mongoAcc, embed);

      await client.clientMongo
        .db('jwc')
        .collection('accounts')
        .updateOne(
          { tag: mongoAcc.tag },
          { $set: { 'legend.lastWeekEndReminderWeekId': weekId } },
        );
      sent += 1;
      await functions.sleep(200);
    } catch (error) {
      console.error(`[cronRankedWeekEndReminder] failed ${mongoAcc.tag}:`, error);
    }
  }

  console.log(`[cronRankedWeekEndReminder] done sent=${sent} skipped=${skipped}`);
}

function getNextTournamentStartUnixFromReset(resetUnixSeconds, seasonData) {
  if (Number.isFinite(resetUnixSeconds) && resetUnixSeconds > 0) {
    const resetUtcMs = resetUnixSeconds * 1000;
    const jstDate = new Date(resetUtcMs + (9 * 60 * 60 * 1000));
    const jstDay = jstDate.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, ...
    const daysUntilTuesday = (2 - jstDay + 7) % 7;

    let tuesday2amJstUtcMs = Date.UTC(
      jstDate.getUTCFullYear(),
      jstDate.getUTCMonth(),
      jstDate.getUTCDate() + daysUntilTuesday,
      -7,
      0,
      0,
      0,
    );

    if (tuesday2amJstUtcMs <= resetUtcMs) {
      tuesday2amJstUtcMs += 7 * 24 * 60 * 60 * 1000;
    }

    return Math.floor(tuesday2amJstUtcMs / 1000);
  }

  const fallbackUnix = Math.floor(
    new Date(seasonData?.tournamentWindow?.startTime ?? 0).getTime() / 1000,
  );
  return Number.isFinite(fallbackUnix) && fallbackUnix > 0 ? fallbackUnix : null;
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

async function createLogReset(
  beforePlayerStats,
  afterPlayerStats,
  eventData,
  seasonData,
  mongoAcc,
) {
  const myEmbed = new EmbedBuilder();
  myEmbed.setTitle('**⚔️ LEAGUE RESET!**');
  const footer = `${getLeagueTierDisplayName(afterPlayerStats)}${leagueFooterCapSuffix(afterPlayerStats)}`;
  myEmbed.setFooter({
    text: footer,
    iconURL: getRankedBattleLogFooterIconUrl(afterPlayerStats),
  });
  myEmbed.setColor(config.color.main);
  myEmbed.setTimestamp();

  const tournamentStartUnix = getNextTournamentStartUnixFromReset(
    eventData?.unixTimeSeconds,
    seasonData,
  );

  let description = '';
  description += `<t:${eventData.unixTimeSeconds}:t> :trophy: **${eventData.trophiesCurrent}** `;
  description += `${config.emote.thn[afterPlayerStats.townHallLevel]} **${afterPlayerStats.name}**\n\n`;
  description += `${getLeagueResetSummaryLine(beforePlayerStats, afterPlayerStats)}\n`;
  description += `Registration is now open for the next tournament.\n`;
  if (Number.isFinite(tournamentStartUnix) && tournamentStartUnix > 0) {
    description += `Next tournament starts: <t:${tournamentStartUnix}:F> (<t:${tournamentStartUnix}:R>)\n`;
  }
  description += formatLastTournamentWeekSection(getLatestLegendWeek(mongoAcc));
  myEmbed.setDescription(description);

  return myEmbed;
}

async function markRankedSeasonTransition(
  client,
  mongoAcc,
  rankedSeasonId,
  trophiesAfterReset = null,
) {
  const $set = {
    'legend.lastRankedSeasonId': rankedSeasonId,
    'legend.rankedEventsSeeded': false,
  };
  const resetTrophies = Number(trophiesAfterReset);
  if (Number.isFinite(resetTrophies)) {
    $set.trophies = resetTrophies;
  }

  await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .updateOne(
      { tag: mongoAcc.tag },
      {
        $set,
        $unset: { 'legend.rankedBattleLog': '' },
      },
    );

  // accountsLegend はメモリにキャッシュされるため、DB更新だけだと次のポーリングまで
  // isNonLegendRankedSeasonStart 判定が古い lastRankedSeasonId を見てしまい、
  // 「New season has started」が繰り返し通知され得る。ローカルも同時に更新する。
  if (mongoAcc) {
    mongoAcc.legend = mongoAcc.legend ?? {};
    mongoAcc.legend.lastRankedSeasonId = rankedSeasonId;
    mongoAcc.legend.rankedEventsSeeded = false;
    if (Object.prototype.hasOwnProperty.call(mongoAcc.legend, 'rankedBattleLog')) {
      delete mongoAcc.legend.rankedBattleLog;
    }
    if (Number.isFinite(resetTrophies)) {
      mongoAcc.trophies = resetTrophies;
    }
  }
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
  const rankedSeasonId = getStoredRankedSeasonId(afterPlayerStats, seasonData);

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

  if (isNonLegendLeagueReset(beforePlayerStats, afterPlayerStats)) {
    if (afterPlayerStats.leagueTier?.id !== config_coc.leagueId.legend) {
      await updateLegendWeeksFromEvents(
        client,
        mongoAcc,
        mongoAcc.legend?.events,
        seasonData,
        beforePlayerStats.leagueTier,
      );
    }
    const embed = await createLogReset(
      beforePlayerStats,
      afterPlayerStats,
      baseEventData,
      seasonData,
      mongoAcc,
    );
    await sendLogEmbed(client, mongoAcc, embed);
    await markRankedSeasonTransition(
      client,
      mongoAcc,
      rankedSeasonId,
      afterPlayerStats.trophies,
    );
    return;
  }

  // Legend I 以外: シーズン切替の通知は LEAGUE RESET! に任せる。
  // ここでは battle log の無通知取り込みと lastRankedSeasonId 更新のみ行う。
  if (
    isNonLegendRankedSeasonStart(
      beforePlayerStats,
      afterPlayerStats,
      seasonData,
      mongoAcc,
    )
  ) {
    if (Array.isArray(battleLogItems)) {
      await ingestLegendRankedBattleLogSilent(
        client,
        mongoAcc,
        filterRankedBattleItems(battleLogItems),
        afterPlayerStats,
        seasonData,
      );
      await saveAccountTrophies(client, mongoAcc.tag, afterPlayerStats.trophies);
      if (mongoAcc) {
        mongoAcc.legend = mongoAcc.legend ?? {};
        mongoAcc.legend.lastRankedSeasonId = rankedSeasonId;
        mongoAcc.trophies = afterPlayerStats.trophies;
      }
    } else {
      await markRankedSeasonTransition(
        client,
        mongoAcc,
        rankedSeasonId,
        afterPlayerStats.trophies,
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
      beforePlayerStats,
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

function normalizePlayerTagForLegend(tag) {
  if (typeof tag !== 'string') return '';
  let s = tag.trim().toUpperCase();
  if (!s) return '';
  if (!s.startsWith('#')) s = `#${s}`;
  return s;
}

function legendEventFingerprint(action, opponentPlayerTag, stars, destructionPercentage) {
  const opp = normalizePlayerTagForLegend(opponentPlayerTag);
  if (!opp) return null;
  const st = Math.min(3, Math.max(0, Number(stars ?? 0)));
  // 79 / "79" / 79.0 などの揺れ対策で整数化
  const dest = Math.round(Number(destructionPercentage ?? 0));
  return `${action}|${opp}|${st}|${dest}`;
}

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

    // 並び順/日付判定のブレで同じ battlelog が別 day 扱いになっても重複しないよう、
    // action+opponent+stars+dest の fingerprint でも弾く（特に 0 変動防衛で発生しやすい）
    const fp = legendEventFingerprint(
      legendEventType,
      opp,
      event.stars,
      event.destructionPercentage,
    );
    if (
      fp
      && existingEvents.some((e) => {
        const fpe = legendEventFingerprint(
          e?.action,
          e?.opponentPlayerTag,
          e?.stars,
          e?.destructionPercentage,
        );
        return fpe && fpe === fp;
      })
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
    if (event.rankedSeasonId != null) {
      row.rankedSeasonId = event.rankedSeasonId;
    }
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

  const safeEvents = Array.isArray(events) ? events : [];
  safeEvents.forEach((event) => {
    const key = `${event.season}-${event.day}`;
    if (!daysMap.has(key)) {
      daysMap.set(key, {
        season: event.season,
        day: event.day,
        trophies: event.trophies,
        diffTrophies: 0,
        attackTrophies: 0,
        defenseTrophies: 0,
        attacks: 0,
        defenses: 0,
        triples: 0,
        defTriples: 0,
        globalRank: null,
        japanRank: null,
        _attackEvents: [],
        _defenseEvents: [],
        _latestUnix: null,
      });
    }

    const dayEntry = daysMap.get(key);
    const unix = typeof event?.unixTime === 'number' ? event.unixTime : null;
    if (unix != null && (dayEntry._latestUnix == null || unix > dayEntry._latestUnix)) {
      dayEntry._latestUnix = unix;
      dayEntry.trophies = event.trophies;
    }

    // action が attack/defense のみ集計（それ以外は diffTrophies だけ加算）
    if (event.action === 'attack') {
      dayEntry._attackEvents.push(event);
    } else if (event.action === 'defense') {
      dayEntry._defenseEvents.push(event);
    }

    dayEntry.diffTrophies += event.diffTrophies;
  });

  // Legend League は 1 日 8 回上限。表示/集計は最新 8 件に丸める。
  const CAP = 8;
  daysMap.forEach((dayEntry) => {
    const sortDesc = (a, b) => (Number(b?.unixTime ?? 0) - Number(a?.unixTime ?? 0));

    const attacksSorted = dayEntry._attackEvents.sort(sortDesc);
    const defensesSorted = dayEntry._defenseEvents.sort(sortDesc);

    const attacksCapped = attacksSorted.slice(0, CAP);
    const defensesCapped = defensesSorted.slice(0, CAP);

    dayEntry.attacks = attacksCapped.length;
    dayEntry.defenses = defensesCapped.length;

    dayEntry.attackTrophies = attacksCapped.reduce(
      (sum, e) => sum + (Number(e?.diffTrophies) || 0),
      0,
    );
    dayEntry.defenseTrophies = defensesCapped.reduce(
      (sum, e) => sum + (Number(e?.diffTrophies) || 0),
      0,
    );

    dayEntry.triples = attacksCapped.reduce(
      (n, e) => n + (Number(e?.diffTrophies) === 40 ? 1 : 0),
      0,
    );
    dayEntry.defTriples = defensesCapped.reduce(
      (n, e) => n + (Number(e?.diffTrophies) === -40 ? 1 : 0),
      0,
    );

    // internal
    delete dayEntry._attackEvents;
    delete dayEntry._defenseEvents;
    delete dayEntry._latestUnix;
  });

  return Array.from(daysMap.values()).sort((a, b) => {
    if (a.season !== b.season) return b.season - a.season;
    return b.day - a.day;
  });
}

async function saveAccountTrophies(client, tag, trophies) {
  const value = Number(trophies);
  if (!Number.isFinite(value)) {
    return;
  }
  await client.clientMongo.db('jwc').collection('accounts').updateOne(
    { tag },
    { $set: { trophies: value } },
  );
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
  const userPostEnabled =
    mongoAcc.legend?.logSettings
    && (mongoAcc.legend.logSettings.post === 'channel'
      || mongoAcc.legend.logSettings.post === 'dm');

  if (!userPostEnabled) {
    return;
  }

  // 本人向け（設定チャンネル/DM）: ランキング API 不調時のため順位なし
  const eventDataForUser = { ...eventData, includeRanking: false };
  const embedUser = await handleBattleLog(
    client,
    legendEventType,
    scPlayer,
    mongoAcc,
    eventDataForUser,
    nEvents,
    i,
    result,
    seasonData,
  );

  if (embedUser) {
    await sendLogEmbedToUser(client, mongoAcc, embedUser);
    if (legendEventType === 'attack' || legendEventType === 'defense') {
      const apiTrophies = Number(scPlayer?.trophies);
      const eventTrophies = Number(eventData.trophiesCurrent);
      await saveAccountTrophies(
        client,
        mongoAcc.tag,
        Number.isFinite(apiTrophies) ? apiTrophies : eventTrophies,
      );
    }
  }

  // 集約ログ（config.logch.legend）: 従来どおりランキング付き
  const disableLegendLogs = process.env.DISABLE_LEGEND_LOGS === 'true';
  if (!disableLegendLogs) {
    const embedLog = await handleBattleLog(
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
    if (embedLog) {
      await sendLegendLogChannelEmbed(client, embedLog);
    }
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
          mongoAcc,
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
          mongoAcc,
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
          mongoAcc,
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

/** 連続通知時は最新1件だけ総トロフィーをタイトルに出す */
function formatRankedBattleLogTitle(eventData) {
  const titleEmote = eventData.diffTrophies >= 0 ? config.emote.up : config.emote.down;
  const diffPart = `${titleEmote}**${formatSignedInt(eventData.diffTrophies)}**`;
  if (eventData.showTrophiesInTitle === false) {
    return diffPart;
  }
  return `${diffPart} :trophy: **${eventData.trophiesCurrent}**`;
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

/**
 * CoC battleTime ("YYYYMMDDTHHMMSS.SSSZ") を unix seconds に変換。
 * パースできない場合は null.
 */
function battleTimeToUnixSeconds(battleTimeRaw) {
  if (typeof battleTimeRaw !== 'string') return null;
  const s = battleTimeRaw.trim();
  // Example: "20260527T165501.000Z"
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d{1,3}))?Z$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  const ms = m[7] != null ? Number(String(m[7]).padEnd(3, '0')) : 0;
  if (
    !Number.isFinite(year)
    || !Number.isFinite(month)
    || !Number.isFinite(day)
    || !Number.isFinite(hour)
    || !Number.isFinite(minute)
    || !Number.isFinite(second)
    || !Number.isFinite(ms)
  ) {
    return null;
  }
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  if (!Number.isFinite(utcMs)) return null;
  return Math.floor(utcMs / 1000);
}

/** Legend / Ranked の「日」境界: JST 02:00 (= UTC 17:00) にスナップ */
function rankedDayStartUtcMs(timestampMs, boundaryUtcHour = 17) {
  const d = new Date(timestampMs);
  let boundaryMs = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    boundaryUtcHour,
    0,
    0,
    0,
  );
  if (timestampMs < boundaryMs) {
    boundaryMs -= 24 * 60 * 60 * 1000;
  }
  return boundaryMs;
}

function getLegendGraceSeasonData(seasonData, latestStoredEventDay, nowMs = Date.now()) {
  // battlelog に実時刻が無い前提の緩和策:
  // 「日付切替直後」かつ「まだ当日の events が無い」場合、取り込み分を前日扱いに寄せる。
  const GRACE_MS = 20 * 60 * 1000; // 20 minutes after JST 02:00
  const boundaryUtcHour = Number(seasonData?.dayBoundaryUtcHour);
  const dayStart = rankedDayStartUtcMs(
    nowMs,
    Number.isFinite(boundaryUtcHour) ? boundaryUtcHour : 17,
  );
  const withinGrace = nowMs - dayStart >= 0 && nowMs - dayStart < GRACE_MS;
  if (!withinGrace) return seasonData;
  const cur = Number(seasonData?.daysNow);
  const prev = cur - 1;
  if (!Number.isFinite(cur) || prev < 1) return seasonData;
  if (latestStoredEventDay == null) return seasonData;
  if (Number(latestStoredEventDay) >= cur) return seasonData;
  // only shift when the latest stored day is behind the computed day
  if (Number(latestStoredEventDay) === prev) {
    return { ...seasonData, daysNow: prev };
  }
  return seasonData;
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

  // Legend I 以外は従来ロジック（Electro 等の上限/下限も含めこちらで扱う）
  return calcDefenseTrophies(stars, destruction);
}

/**
 * API の現在トロフィーを終値として、各 battle の trophiesCurrent を逆算する。
 * 単発通知では after.trophies、そのまま使われる。
 */
function computeTrophiesCurrentByBattleIndex(afterPlayerStats, diffsChronological) {
  const afterT = Number(afterPlayerStats?.trophies);
  const anchor = Number.isFinite(afterT) ? afterT : 0;
  const n = diffsChronological.length;
  const out = new Array(n);
  let suffixDelta = 0;
  for (let i = n - 1; i >= 0; i--) {
    out[i] = anchor - suffixDelta;
    suffixDelta += Number(diffsChronological[i]) || 0;
  }
  return out;
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
  const weekHitRatePct = (triples, total) => (
    total > 0 ? Math.round((triples / total) * 100) : null
  );
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
    attackTriples: av.attackTriples,
    defenseTriples: av.defenseTriples,
    attackHitRate: weekHitRatePct(av.attackTriples, ws.attacks),
    defenseHitRate: weekHitRatePct(av.defenseTriples, ws.defenses),
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
  trophiesCurrent,
  diffT,
  unixTimeSeconds,
  includeRanking,
) {
  const isAttack = item?.attack === true;
  const opp = typeof item?.opponentPlayerTag === 'string' ? item.opponentPlayerTag.trim() : '';
  return {
    season: seasonData.seasonId,
    day: seasonData.daysNow,
    trophiesCurrent,
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
    rankedSeasonId: getStoredRankedSeasonId(afterPlayerStats, seasonData),
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
  const rankedSeasonId = getStoredRankedSeasonId(afterPlayerStats, seasonData);
  const latestStoredDay = Array.isArray(mongoAccMut?.legend?.events) && mongoAccMut.legend.events.length > 0
    ? mongoAccMut.legend.events[0]?.day
    : null;
  const seasonDataGrace = getLegendGraceSeasonData(seasonData, latestStoredDay);

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
    const battleUnix = battleTimeToUnixSeconds(item?.battleTime);
    const seasonDataAtBattle = battleUnix
      ? functions.calculateSeasonValues(client, new Date(battleUnix * 1000))
      : seasonDataGrace;
    const eventData = buildRankedEventDataFromBattleLogItem(
      item,
      afterPlayerStats,
      seasonDataAtBattle,
      afterPlayerStats.trophies,
      diffT,
      battleUnix ?? Math.floor(Date.now() / 1000),
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
          'legend.lastRankedSeasonId': rankedSeasonId,
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
  const rankedSeasonId = getStoredRankedSeasonId(afterPlayerStats, seasonData);
  const latestStoredDay = Array.isArray(mongoAccMut?.legend?.events) && mongoAccMut.legend.events.length > 0
    ? mongoAccMut.legend.events[0]?.day
    : null;
  const seasonDataGrace = getLegendGraceSeasonData(seasonData, latestStoredDay);

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
    const battleUnix = battleTimeToUnixSeconds(item?.battleTime);
    const seasonDataAtBattle = battleUnix
      ? functions.calculateSeasonValues(client, new Date(battleUnix * 1000))
      : seasonDataGrace;
    const eventData = buildRankedEventDataFromBattleLogItem(
      item,
      afterPlayerStats,
      seasonDataAtBattle,
      afterPlayerStats.trophies,
      diffT,
      battleUnix ?? Math.floor(Date.now() / 1000),
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
          'legend.lastRankedSeasonId': rankedSeasonId,
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
  beforePlayerStats,
  afterPlayerStats,
  seasonData,
) {
  await reloadMongoAccLegendProjection(client, mongoAcc);
  const rankedSeasonId = getStoredRankedSeasonId(afterPlayerStats, seasonData);

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

  // NOTE: battlelog の並び順は環境/クライアント差で逆転することがあるため、
  // 「末尾から走査して一致したら break」は誤検知しやすい。
  // 並び順に依存せず、既存と一致しない行だけを抽出する。
  const newItems = [];
  for (const item of ranked) {
    // ranked battlelog は opponentPlayerTag をキーに差分検出する設計。
    // opponent が無い行は重複排除も一意性も担保できないため、保存・通知対象にしない。
    const opp = typeof item?.opponentPlayerTag === 'string' ? item.opponentPlayerTag.trim() : '';
    if (!opp) {
      continue;
    }
    if (battleLogItemMatchesStoredRankedBattle(item, legendEvents, legacyRankedLog)) {
      continue;
    }
    newItems.push(item);
  }

  if (newItems.length === 0) {
    return;
  }

  // シーズン初日に大量の「新規」が出た場合は誤検知（events 80件切り詰め等）→ 通知せず取り込みのみ
  if (
    afterPlayerStats.leagueTier.id !== config_coc.leagueId.legend
    && seasonData.daysNow <= 1
    && newItems.length >= 5
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

  // battleTime が取れる場合はそれでソート。取れない場合は API の順序を保持する。
  const mapped = newItems.map((item, idx) => ({
    item,
    idx,
    unix: battleTimeToUnixSeconds(item?.battleTime),
  }));
  const hasAnyUnix = mapped.some((m) => typeof m.unix === 'number');
  const chronological = hasAnyUnix
    ? mapped
        .slice()
        .sort((a, b) => (Number(a.unix ?? 0) - Number(b.unix ?? 0)) || (a.idx - b.idx))
        .map((m) => m.item)
    : newItems;
  let mongoAccMut = { ...mongoAcc };
  let lastResult = null;
  const baseUnixTimeSeconds = Math.floor(Date.now() / 1000);
  const spacedStepSeconds = 120;
  const latestStoredDay = Array.isArray(mongoAccMut?.legend?.events) && mongoAccMut.legend.events.length > 0
    ? mongoAccMut.legend.events[0]?.day
    : null;
  const seasonDataGrace = getLegendGraceSeasonData(seasonData, latestStoredDay);
  const diffsChronological = chronological.map((item) => {
    const isAttack = item?.attack === true;
    return rankedBattleTrophyDeltaFromBattleLog(
      isAttack,
      item?.stars,
      item?.destructionPercentage,
      afterPlayerStats.leagueTier.id,
    );
  });
  const trophiesByIdx = computeTrophiesCurrentByBattleIndex(
    afterPlayerStats,
    diffsChronological,
  );
  const pendingNotifications = [];

  for (let idx = 0; idx < chronological.length; idx++) {
    const item = chronological[idx];
    const isAttack = item?.attack === true;
    const legendEventType = isAttack ? 'attack' : 'defense';
    const diffT = diffsChronological[idx];
    const battleUnix = battleTimeToUnixSeconds(item?.battleTime);
    const unixTimeSeconds =
      battleUnix ?? (baseUnixTimeSeconds + (idx * spacedStepSeconds));
    const seasonDataAtBattle = battleUnix
      ? functions.calculateSeasonValues(client, new Date(battleUnix * 1000))
      : seasonDataGrace;
    const includeRanking = true;
    const eventData = buildRankedEventDataFromBattleLogItem(
      item,
      afterPlayerStats,
      seasonDataAtBattle,
      trophiesByIdx[idx],
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
    pendingNotifications.push({
      legendEventType,
      eventData,
      lastResult,
      seasonData: seasonDataAtBattle,
    });
  }

  for (let i = 0; i < pendingNotifications.length; i++) {
    const pending = pendingNotifications[i];
    const eventDataForSend = {
      ...pending.eventData,
      showTrophiesInTitle: i === pendingNotifications.length - 1,
    };
    await sendLogLegendMain(
      client,
      afterPlayerStats,
      mongoAccMut,
      pending.legendEventType,
      eventDataForSend,
      1,
      0,
      pending.lastResult,
      pending.seasonData,
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
          'legend.lastRankedSeasonId': rankedSeasonId,
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
  let attackTriples = 0;
  let defenseTriples = 0;
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
      if (isRankedBattleFullDestruction(event)) {
        attackTriples += 1;
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
      if (isRankedBattleFullDestruction(event)) {
        defenseTriples += 1;
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
    attackTriples,
    defenseTriples,
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

/** 本人設定（channel / dm）のみ。シーズン通知などランキング無し embed 用 */
async function sendLogEmbed(client, mongoAcc, myEmbed) {
  try {
    await sendLogEmbedToUser(client, mongoAcc, myEmbed);
    const disableLegendLogs = process.env.DISABLE_LEGEND_LOGS === 'true';
    if (!disableLegendLogs) {
      await sendLegendLogChannelEmbed(client, myEmbed);
    }
  } catch (error) {
    console.error('ログ送信中にエラーが発生しました:', error, mongoAcc.name);
  }
}

async function sendLogEmbedToUser(client, mongoAcc, myEmbed) {
  if (!mongoAcc.legend?.logSettings) {
    return;
  }
  if (mongoAcc.legend.logSettings.post === 'NA') {
    return;
  }
  if (mongoAcc.legend.logSettings.post === 'channel') {
    let channelUser = client.channels.cache.get(
      mongoAcc.legend.logSettings.channel,
    );
    if (!channelUser) {
      channelUser = await client.channels
        .fetch(mongoAcc.legend.logSettings.channel)
        .catch(() => null);
    }
    if (channelUser?.isTextBased()) {
      await channelUser.send({ embeds: [myEmbed] });
    } else {
      console.error(
        'チャンネルが見つからないか、テキストチャンネルではありません。',
        mongoAcc.name,
        mongoAcc.tag,
      );
    }
    return;
  }
  if (mongoAcc.legend.logSettings.post === 'dm') {
    await sendToDM(client, mongoAcc, myEmbed);
  }
}

async function sendLegendLogChannelEmbed(client, myEmbed) {
  const channelLog = client.channels.cache.get(config.logch.legend);
  if (channelLog?.isTextBased()) {
    await channelLog.send({ embeds: [myEmbed] });
  } else {
    console.error(
      'ログチャンネルが見つからないか、テキストチャンネルではありません。',
    );
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
  mongoAcc,
  eventData,
  nEvents,
  i,
  seasonData,
  legendEventType,
  result = null,
) {
  const myEmbed = new EmbedBuilder();
  myEmbed.setTitle(formatRankedBattleLogTitle(eventData));
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

  if (eventData.includeRanking !== false) {
    const rankingDisplay = await getRankingDisplay(client, scPlayer, eventData);
    if (rankingDisplay) {
      description += rankingDisplay;
    }
  }
  if (
    scPlayer?.leagueTier?.id === config_coc.leagueId.legend
    && eventData.includeRanking !== false
  ) {
    description += `${config.emote.discord}</legend stats:${config.command.legend.id}>`;
    description += ` ${config.emote.discord}</legend history own:${config.command.legend.id}>`;
  }
  myEmbed.setDescription(description);

  return myEmbed;
}

async function createLogLegendDefense(
  client,
  scPlayer,
  mongoAcc,
  eventData,
  nEvents,
  i,
  seasonData,
  legendEventType,
  result = null,
) {
  const myEmbed = new EmbedBuilder();
  myEmbed.setTitle(formatRankedBattleLogTitle(eventData));
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

  if (eventData.includeRanking !== false) {
    const rankingDisplay = await getRankingDisplay(client, scPlayer, eventData);
    if (rankingDisplay) {
      description += rankingDisplay;
    }
  }
  if (
    scPlayer?.leagueTier?.id === config_coc.leagueId.legend
    && eventData.includeRanking !== false
  ) {
    description += `${config.emote.discord}</legend stats:${config.command.legend.id}>`;
    description += ` ${config.emote.discord}</legend history own:${config.command.legend.id}>`;
  }
  myEmbed.setDescription(description);

  return myEmbed;
}

function parsePositiveRank(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function globalRankFromScPlayer(scPlayer) {
  return parsePositiveRank(scPlayer?.legendStatistics?.currentSeason?.rank);
}

function findRankInLegends200List(players, tag) {
  if (!Array.isArray(players) || !tag) return null;
  const hit = players.find((p) => p?.tag === tag);
  return parsePositiveRank(hit?.rank);
}

/** 通知のトロフィーとプロフィールが一致するときだけ順位を出す（一括通知の中間戦闘で古い順位を出さない） */
function shouldShowLegendRankingForEvent(scPlayer, eventData) {
  const profileTrophies = Number(scPlayer?.trophies);
  const eventTrophies = Number(eventData?.trophiesCurrent);
  if (!Number.isFinite(profileTrophies) || !Number.isFinite(eventTrophies)) {
    return false;
  }
  return profileTrophies === eventTrophies;
}

/** 通知用: ポーリング getPlayer の legendStatistics をそのままプレーン化（補完なし） */
export function legendStatisticsForNotify(playerStats) {
  const ls = playerStats?.legendStatistics;
  if (!ls) return undefined;

  const cs = ls.currentSeason;
  return {
    legendTrophies: ls.legendTrophies,
    currentSeason: cs
      ? {
          rank: cs.rank,
          trophies: cs.trophies,
          id: cs.id,
        }
      : null,
    previousSeason: ls.previousSeason ?? null,
    bestSeason: ls.bestSeason ?? null,
  };
}

// ランキング表示: Legend I は location 榜優先。それ以外は legendStatistics.currentSeason.rank があれば公式順位を表示
async function getRankingDisplay(client, scPlayer, eventData = null) {
  try {
    let playerForRank = scPlayer;
    if (client?.clientCoc?.getPlayer && scPlayer?.tag) {
      try {
        const fresh = await client.clientCoc.getPlayer(scPlayer.tag);
        playerForRank = {
          ...scPlayer,
          trophies: fresh.trophies,
          legendStatistics: legendStatisticsForNotify(fresh),
        };
      } catch (refreshErr) {
        console.warn(
          `ランキング用 getPlayer 再取得スキップ (${scPlayer.tag}):`,
          refreshErr?.message ?? refreshErr,
        );
      }
    }

    const isLegend1 = playerForRank?.leagueTier?.id === config_coc.leagueId.legend;
    const legendGlobalRank = globalRankFromScPlayer(playerForRank);
    if (!isLegend1 && legendGlobalRank == null) {
      return '';
    }

    if (eventData && !shouldShowLegendRankingForEvent(playerForRank, eventData)) {
      return '';
    }

    const tag = playerForRank.tag;
    let japanRankValue = null;
    let globalRankValue = null;

    if (isLegend1) {
      try {
        const legends200 = await client.clientMongo
          .db('jwc')
          .collection('ranking')
          .findOne({ name: 'legends200' }, { projection: { _id: 0, japan: 1, global: 1 } });
        japanRankValue = findRankInLegends200List(legends200?.japan, tag);
        globalRankValue = findRankInLegends200List(legends200?.global, tag);
      } catch (mongoErr) {
        console.error('legends200 読み込みエラー:', mongoErr);
      }

      if (japanRankValue == null) {
        try {
          const playerRanks = await client.clientCoc.getPlayerRanks(
            config_coc.locationId.japan,
          );
          japanRankValue = findRankInLegends200List(playerRanks, tag);
        } catch (jpError) {
          console.error('日本ランキング取得エラー:', jpError);
        }
      }

      if (globalRankValue == null) {
        try {
          const globalRanks = await client.clientCoc.getPlayerRanks('global');
          globalRankValue = findRankInLegends200List(globalRanks, tag);
        } catch (globalError) {
          console.error('グローバルランキング取得エラー:', globalError);
        }
      }

      if (globalRankValue == null) {
        globalRankValue = legendGlobalRank;
      }
    } else {
      globalRankValue = legendGlobalRank;
      try {
        const legends200 = await client.clientMongo
          .db('jwc')
          .collection('ranking')
          .findOne({ name: 'legends200' }, { projection: { _id: 0, japan: 1 } });
        japanRankValue = findRankInLegends200List(legends200?.japan, tag);
      } catch (mongoErr) {
        console.error('legends200 読み込みエラー:', mongoErr);
      }
      if (japanRankValue == null) {
        try {
          const playerRanks = await client.clientCoc.getPlayerRanks(
            config_coc.locationId.japan,
          );
          japanRankValue = findRankInLegends200List(playerRanks, tag);
        } catch (jpError) {
          console.error('日本ランキング取得エラー:', jpError);
        }
      }
    }

    let rankingText = '';
    if (japanRankValue != null) {
      rankingText += `:flag_jp: No. **${japanRankValue}** in JAPAN\n`;
    }
    if (globalRankValue != null) {
      rankingText += `:earth_asia: No. **${globalRankValue}** in GLOBAL\n`;
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
export { autoUpdateLegendReset, cronRankedWeekEndReminder };

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
