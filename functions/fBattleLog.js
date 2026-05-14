/** CoC battle log の戦闘時刻（同一戦を一意に識別するのに使う） */
function rankedBattleTimeKey(item) {
  const raw = item?.battleTime ?? item?.endTime ?? item?.time ?? '';
  return typeof raw === 'string' && raw.length > 0 ? raw : '';
}

/**
 * ランク戦ログ行の重複検出キー。
 * armyShareCode 等が後から付くと旧キーと一致しなくなるため、battleTime があるときはそれを主キーにする。
 */
function fingerprintRankedBattleItem(item) {
  const battleType = item?.battleType ?? '';
  const bt = rankedBattleTimeKey(item);
  if (bt) {
    const atk = item?.attack === true ? '1' : '0';
    return `v2|${battleType}|${atk}|${bt}`;
  }
  const atk = item?.attack === true ? '1' : '0';
  const opp = item?.opponentPlayerTag ?? '';
  const stars = Number(item?.stars ?? 0);
  const dest = Number(item?.destructionPercentage ?? 0);
  const code = item?.armyShareCode ?? '';
  return `${battleType}|${atk}|${opp}|${stars}|${dest}|${code}`;
}

/**
 * Mongo `legend.rankedBattleLog` 用。同一 battleTime は後勝ち（API で指紋が揺れて二重保存された行を収束）。
 */
function dedupeRankedBattleLogRowsPreferLast(rows) {
  if (!Array.isArray(rows) || rows.length <= 1) {
    return Array.isArray(rows) ? rows : [];
  }
  const indexByKey = new Map();
  const out = [];
  for (const r of rows) {
    const bt = r?.battleTime;
    const key =
      typeof bt === 'string' && bt.length > 0
        ? `bt:${bt}`
        : typeof r?.fingerprint === 'string' && r.fingerprint.length > 0
          ? `fp:${r.fingerprint}`
          : null;
    if (!key) {
      out.push(r);
      continue;
    }
    if (indexByKey.has(key)) {
      out[indexByKey.get(key)] = r;
    } else {
      indexByKey.set(key, out.length);
      out.push(r);
    }
  }
  return out;
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
  dedupeRankedBattleLogRowsPreferLast,
  fetchBattleLogItems,
  fingerprintRankedBattleItem,
  filterRankedBattleItems,
  rankedBattleTimeKey,
};
