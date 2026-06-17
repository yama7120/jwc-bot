/** ランク戦ログ行の重複検出（API に battleTime は無い想定。armyShareCode は使わない） */
function normalizePlayerTag(tag) {
  if (typeof tag !== 'string') return '';
  let s = tag.trim().toUpperCase();
  if (!s) return '';
  if (!s.startsWith('#')) s = `#${s}`;
  return s;
}

/** Legend I の battlelog は battleType が "legend"。下位帯は "ranked" のまま */
function isLegendRankedBattleType(battleType) {
  return battleType === 'ranked' || battleType === 'legend';
}

function fingerprintRankedBattleItem(item) {
  const battleType = isLegendRankedBattleType(item?.battleType)
    ? 'ranked'
    : (item?.battleType ?? '');
  const atk = item?.attack === true ? '1' : '0';
  const opp = normalizePlayerTag(item?.opponentPlayerTag);
  const stars = Math.min(3, Math.max(0, Number(item?.stars ?? 0)));
  // API により 79 / "79" / 79.0 が混在し得るため整数化して比較
  const dest = Math.round(Number(item?.destructionPercentage ?? 0));
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

function fingerprintRankedBattleEventRow(row) {
  const action = rankedBattleLogRowAction(row);
  const atk = action === 'attack' ? '1' : '0';
  const opp = normalizePlayerTag(row?.opponentPlayerTag);
  const stars = Math.min(3, Math.max(0, Number(row?.stars ?? 0)));
  const dest = Math.round(Number(row?.destructionPercentage ?? 0));
  if (!opp) return null;
  return `ranked|${atk}|${opp}|${stars}|${dest}`;
}

/** API 行が既に events / 旧 rankedBattleLog にあるか（ログ末尾走査の打ち切り用） */
function battleLogItemMatchesStoredRankedBattle(item, events, rankedBattleLog) {
  const fp = fingerprintRankedBattleItem(item);
  // opponent が空の場合は fingerprint が ...||... になりやすいので明示的に除外
  if (!normalizePlayerTag(item?.opponentPlayerTag)) return false;

  const safeEvents = Array.isArray(events) ? events : [];
  for (const e of safeEvents) {
    const fpe = fingerprintRankedBattleEventRow(e);
    if (fpe && fpe === fp) return true;
  }

  const rbl = Array.isArray(rankedBattleLog) ? rankedBattleLog : [];
  for (const r of rbl) {
    const fpr = fingerprintRankedBattleEventRow(r);
    if (fpr && fpr === fp) return true;
  }

  return false;
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
  return items.filter((i) => isLegendRankedBattleType(i?.battleType));
}

/** API により battleTime は秒数、battleTimestamp が実時刻文字列のことがある */
function battleLogItemTimestampRaw(item) {
  if (typeof item?.battleTimestamp === 'string') return item.battleTimestamp;
  if (typeof item?.battleTime === 'string') return item.battleTime;
  return null;
}

/** battleTimestamp ("YYYYMMDDTHHMMSS.SSSZ") を unix seconds に変換。失敗時は null */
function battleTimestampToUnixSeconds(battleTimestampRaw) {
  if (typeof battleTimestampRaw !== 'string') return null;
  const s = battleTimestampRaw.trim();
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

function battleLogItemToUnixSeconds(item) {
  return battleTimestampToUnixSeconds(battleLogItemTimestampRaw(item));
}

async function fetchBattleLogItems(clientCoc, playerTag) {
  if (typeof clientCoc?.rest?.requestHandler?.request === 'function') {
    const response = await clientCoc.rest.requestHandler.request(
      `/players/${encodeURIComponent(playerTag)}/battlelog`,
    );
    return Array.isArray(response?.body?.items) ? response.body.items : [];
  }

  if (typeof clientCoc?.rest?.getBattleLog === 'function') {
    const response = await clientCoc.rest.getBattleLog(playerTag);
    return Array.isArray(response?.body?.items) ? response.body.items : [];
  }

  // NOTE: helper はバージョン差で返却shapeが変わることがあるため最後に使う
  if (typeof clientCoc?.getBattleLog === 'function') {
    const items = await clientCoc.getBattleLog(playerTag);
    return Array.isArray(items) ? items : [];
  }

  throw new Error('battlelog endpoint is not available in current clashofclans.js client');
}

export {
  battleLogItemMatchesStoredRankedBattle,
  battleLogItemTimestampRaw,
  battleLogItemToUnixSeconds,
  battleTimestampToUnixSeconds,
  fetchBattleLogItems,
  fingerprintRankedBattleItem,
  filterRankedBattleItems,
  hasLegendRankedOpponentEvent,
  isLegendRankedBattleType,
  isLegendRankedEventsSeeded,
  legendRankedOpponentKey,
};
