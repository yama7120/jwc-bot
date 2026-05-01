function fingerprintRankedBattleItem(item) {
  const battleType = item?.battleType ?? '';
  const atk = item?.attack === true ? '1' : '0';
  const opp = item?.opponentPlayerTag ?? '';
  const stars = Number(item?.stars ?? 0);
  const dest = Number(item?.destructionPercentage ?? 0);
  const code = item?.armyShareCode ?? '';
  return `${battleType}|${atk}|${opp}|${stars}|${dest}|${code}`;
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

export { fetchBattleLogItems, fingerprintRankedBattleItem, filterRankedBattleItems };
