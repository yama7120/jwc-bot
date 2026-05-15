/** ランク戦ログ行の重複検出（API に battleTime は無い想定。armyShareCode は使わない） */
function fingerprintRankedBattleItem(item) {
  const battleType = item?.battleType ?? '';
  const atk = item?.attack === true ? '1' : '0';
  const opp = item?.opponentPlayerTag ?? '';
  const stars = Number(item?.stars ?? 0);
  const dest = Number(item?.destructionPercentage ?? 0);
  return `${battleType}|${atk}|${opp}|${stars}|${dest}`;
}

/** legend.events 用: 同日・同 action では opponent は一意（ゲーム仕様） */
function legendRankedOpponentKey(season, day, action, opponentTag) {
  const opp = typeof opponentTag === 'string' ? opponentTag.trim() : '';
  if (!opp) return null;
  return `${season}|${day}|${action}|${opp}`;
}

function hasLegendRankedOpponentEvent(events, season, day, action, opponentTag) {
  const key = legendRankedOpponentKey(season, day, action, opponentTag);
  if (!key) return false;
  const safe = Array.isArray(events) ? events : [];
  return safe.some(
    (e) => legendRankedOpponentKey(e.season, e.day, e.action, e.opponentPlayerTag) === key,
  );
}

function rankedBattleLogRowAction(row) {
  if (row?.action === 'attack' || row?.action === 'defense') return row.action;
  return row?.attack === true ? 'attack' : 'defense';
}

/** API 行が既に events / 旧 rankedBattleLog にあるか（ログ末尾走査の打ち切り用） */
function battleLogItemMatchesStoredRankedBattle(item, events, rankedBattleLog) {
  const action = item?.attack === true ? 'attack' : 'defense';
  const opp = item?.opponentPlayerTag ?? '';
  const stars = Number(item?.stars ?? 0);
  const dest = Number(item?.destructionPercentage ?? 0);
  if (!opp) return false;

  const safeEvents = Array.isArray(events) ? events : [];
  for (const e of safeEvents) {
    if (
      e.opponentPlayerTag === opp
      && e.action === action
      && Number(e.stars) === stars
      && Number(e.destructionPercentage) === dest
    ) {
      return true;
    }
  }

  const rbl = Array.isArray(rankedBattleLog) ? rankedBattleLog : [];
  return rbl.some(
    (r) =>
      r.opponentPlayerTag === opp
      && rankedBattleLogRowAction(r) === action
      && Number(r.stars) === stars
      && Number(r.destructionPercentage) === dest,
  );
}

function isLegendRankedEventsSeeded(legend) {
  if (!legend) return false;
  if (legend.rankedEventsSeeded === true) return true;
  const events = legend.events ?? [];
  if (events.some((e) => typeof e.opponentPlayerTag === 'string' && e.opponentPlayerTag.length > 0)) {
    return true;
  }
  if (Array.isArray(legend.rankedBattleLog) && legend.rankedBattleLog.length > 0) {
    return true;
  }
  return false;
}

function filterRankedBattleItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.filter((i) => i?.battleType === 'ranked');
}

async function fetchBattleLogItems(clientCoc, playerTag) {
  if (typeof clientCoc?.getBattleLog === 'function') {
    const items = await clientCoc.getBattleLog(playerTag);
    return Array.isArray(items) ? items : [];
  }

  if (typeof clientCoc?.rest?.getBattleLog === 'function') {
    const response = await clientCoc.rest.getBattleLog(playerTag);
    return Array.isArray(response?.body?.items) ? response.body.items : [];
  }

  if (typeof clientCoc?.rest?.requestHandler?.request === 'function') {
    const response = await clientCoc.rest.requestHandler.request(
      `/players/${encodeURIComponent(playerTag)}/battlelog`,
    );
    return Array.isArray(response?.body?.items) ? response.body.items : [];
  }

  throw new Error('battlelog endpoint is not available in current clashofclans.js client');
}

export {
  battleLogItemMatchesStoredRankedBattle,
  fetchBattleLogItems,
  fingerprintRankedBattleItem,
  filterRankedBattleItems,
  hasLegendRankedOpponentEvent,
  isLegendRankedEventsSeeded,
  legendRankedOpponentKey,
};
