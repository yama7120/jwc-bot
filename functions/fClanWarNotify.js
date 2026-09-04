import { EmbedBuilder } from 'discord.js';

import config from '../config/config.js';
import * as functions from './functions.js';
import { deliverLegendLogToUser } from './fLegend.js';

const HOUR_MS = 60 * 60 * 1000;
const END_REMINDER_HOURS = [
  { key: 'end12h', hours: 12, title: '⏰ WAR ENDS IN 12 HOURS' },
  { key: 'end3h', hours: 3, title: '⏰ WAR ENDS IN 3 HOURS' },
  { key: 'end1h', hours: 1, title: '⏰ WAR ENDS IN 1 HOUR' },
];

const CLAN_RESOLVE_CONCURRENCY = 5;
const WAR_FETCH_CONCURRENCY = 3;
const SEND_DELAY_MS = 200;

function accountHasClanWarReminders(logSettings) {
  if (!logSettings || logSettings.war_reminders !== 'all') return false;
  if (logSettings.post !== 'channel' && logSettings.post !== 'dm') return false;
  return true;
}

function buildWarKey(clanTag, startTime) {
  const startUnix = Math.floor(new Date(startTime).getTime() / 1000);
  if (!clanTag || !Number.isFinite(startUnix) || startUnix <= 0) return null;
  return `${clanTag}:${startUnix}`;
}

function isFriendlyWar(clanWar) {
  if (!clanWar) return false;
  if (clanWar.isFriendly === true) return true;
  if (typeof clanWar.warType === 'string') {
    return clanWar.warType.toLowerCase() === 'friendly';
  }
  return false;
}

function remainingAttacks(clanWar, member) {
  const apm = Number(clanWar?.attacksPerMember) || 0;
  const used = Array.isArray(member?.attacks) ? member.attacks.length : 0;
  return Math.max(0, apm - used);
}

function opponentClan(clanWar, homeClanTag) {
  if (!clanWar) return null;
  if (clanWar.clan?.tag === homeClanTag) return clanWar.opponent;
  if (clanWar.opponent?.tag === homeClanTag) return clanWar.clan;
  return clanWar.opponent ?? null;
}

function homeClan(clanWar, homeClanTag) {
  if (!clanWar) return null;
  if (clanWar.clan?.tag === homeClanTag) return clanWar.clan;
  if (clanWar.opponent?.tag === homeClanTag) return clanWar.opponent;
  return clanWar.clan ?? null;
}

function playerHeader(mongoAcc) {
  const th = mongoAcc.townHallLevel;
  const thEmote = config.emote?.thn?.[th] ?? `TH${th ?? '?'}`;
  return `${thEmote} **${functions.nameReplacer(mongoAcc.name)}** (\`${mongoAcc.tag}\`)`;
}

function warMatchLine(clanWar, homeClanTag) {
  const home = homeClan(clanWar, homeClanTag);
  const opp = opponentClan(clanWar, homeClanTag);
  const size = clanWar.teamSize ?? '?';
  const homeName = functions.nameReplacer(home?.name ?? 'Your clan');
  const oppName = functions.nameReplacer(opp?.name ?? 'Opponent');
  return `**${homeName}** vs **${oppName}** (${size}v${size})`;
}

function createMatchedEmbed(mongoAcc, clanWar, homeClanTag) {
  const startUnix = Math.floor(new Date(clanWar.startTime).getTime() / 1000);
  const embed = new EmbedBuilder();
  embed.setTitle('⚔️ CLAN WAR MATCHED');
  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  embed.setTimestamp();
  embed.setDescription(
    [
      playerHeader(mongoAcc),
      warMatchLine(clanWar, homeClanTag),
      '',
      `War starts: <t:${startUnix}:F> (<t:${startUnix}:R>)`,
    ].join('\n'),
  );
  return embed;
}

function createStartedEmbed(mongoAcc, clanWar, homeClanTag) {
  const endUnix = Math.floor(new Date(clanWar.endTime).getTime() / 1000);
  const apm = clanWar.attacksPerMember ?? '?';
  const embed = new EmbedBuilder();
  embed.setTitle('⚔️ CLAN WAR STARTED');
  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  embed.setTimestamp();
  embed.setDescription(
    [
      playerHeader(mongoAcc),
      warMatchLine(clanWar, homeClanTag),
      '',
      `War ends: <t:${endUnix}:F> (<t:${endUnix}:R>)`,
      `Attacks: **${apm}** per member`,
    ].join('\n'),
  );
  return embed;
}

function createEndReminderEmbed(mongoAcc, clanWar, homeClanTag, member, reminder) {
  const endUnix = Math.floor(new Date(clanWar.endTime).getTime() / 1000);
  const left = remainingAttacks(clanWar, member);
  const apm = clanWar.attacksPerMember ?? '?';
  const embed = new EmbedBuilder();
  embed.setTitle(reminder.title);
  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  embed.setTimestamp();
  embed.setDescription(
    [
      playerHeader(mongoAcc),
      warMatchLine(clanWar, homeClanTag),
      '',
      `War ends: <t:${endUnix}:F> (<t:${endUnix}:R>)`,
      `Remaining attacks: **${left}/${apm}**`,
    ].join('\n'),
  );
  return embed;
}

async function fetchEligibleAccounts(client) {
  return client.clientMongo
    .db('jwc')
    .collection('accounts')
    .find(
      {
        status: { $ne: false },
        'legend.logSettings.war_reminders': 'all',
        'legend.logSettings.post': { $in: ['channel', 'dm'] },
      },
      {
        projection: {
          _id: 0,
          tag: 1,
          name: 1,
          townHallLevel: 1,
          clan: 1,
          pilotDC: 1,
          legend: 1,
          clanWarNotify: 1,
        },
      },
    )
    .toArray();
}

async function resolveClanTag(client, mongoAcc, playerCache, { forceRefresh = false } = {}) {
  if (!forceRefresh && mongoAcc.clan?.tag) {
    return mongoAcc.clan.tag;
  }

  const cached = playerCache.get(mongoAcc.tag);
  if (cached !== undefined) {
    return cached?.clan?.tag ?? null;
  }

  try {
    const scPlayer = await functions.retryOnThrottle(() =>
      client.clientCoc.getPlayer(mongoAcc.tag),
    );
    playerCache.set(mongoAcc.tag, scPlayer);
    const clanTag = scPlayer?.clan?.tag ?? null;
    const clanPayload = clanTag
      ? { tag: clanTag, name: scPlayer.clan.name }
      : null;
    await client.clientMongo
      .db('jwc')
      .collection('accounts')
      .updateOne({ tag: mongoAcc.tag }, { $set: { clan: clanPayload } });
    mongoAcc.clan = clanPayload;
    return clanTag;
  } catch (error) {
    if (error?.reason === 'notFound') {
      playerCache.set(mongoAcc.tag, null);
      return null;
    }
    console.error(`[clanWarNotify] getPlayer failed ${mongoAcc.tag}:`, error?.message ?? error);
    return mongoAcc.clan?.tag ?? null;
  }
}

async function getCurrentWarCached(client, clanTag, warCache) {
  if (warCache.has(clanTag)) {
    return warCache.get(clanTag);
  }

  try {
    const clanWar = await functions.retryOnThrottle(() =>
      client.clientCoc.getCurrentWar(clanTag),
    );
    warCache.set(clanTag, clanWar);
    return clanWar;
  } catch (error) {
    if (error?.reason === 'notFound' || error?.reason === 'accessDenied') {
      warCache.set(clanTag, null);
      return null;
    }
    console.error(`[clanWarNotify] getCurrentWar failed ${clanTag}:`, error?.message ?? error);
    warCache.set(clanTag, null);
    return null;
  }
}

function getNotifyState(mongoAcc, warKey) {
  const current = mongoAcc.clanWarNotify;
  if (!current || current.warKey !== warKey) {
    return { warKey, sent: {} };
  }
  return {
    warKey,
    sent: { ...(current.sent ?? {}) },
  };
}

async function claimAndSend(client, mongoAcc, warKey, primaryKey, embed, alsoMarkKeys = []) {
  const notify = getNotifyState(mongoAcc, warKey);
  if (notify.sent[primaryKey]) {
    return false;
  }

  const keysToMark = new Set([primaryKey, ...alsoMarkKeys]);
  for (const key of keysToMark) {
    notify.sent[key] = true;
  }

  const claim = await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .updateOne(
      {
        tag: mongoAcc.tag,
        $or: [
          { clanWarNotify: { $exists: false } },
          { 'clanWarNotify.warKey': { $ne: warKey } },
          {
            'clanWarNotify.warKey': warKey,
            [`clanWarNotify.sent.${primaryKey}`]: { $ne: true },
          },
        ],
      },
      { $set: { clanWarNotify: notify } },
    );

  if (claim.matchedCount === 0) {
    const fresh = await client.clientMongo
      .db('jwc')
      .collection('accounts')
      .findOne({ tag: mongoAcc.tag }, { projection: { clanWarNotify: 1 } });
    mongoAcc.clanWarNotify = fresh?.clanWarNotify;
    return false;
  }

  mongoAcc.clanWarNotify = notify;

  const result = await deliverLegendLogToUser(client, mongoAcc, { embeds: [embed] });
  if (!result?.ok) {
    console.warn(
      `[clanWarNotify] delivery failed ${mongoAcc.tag} ${primaryKey}:`,
      result?.reason ?? 'unknown',
    );
  }
  return true;
}

async function processAccountWar(client, mongoAcc, clanTag, clanWar, playerCache, warCache) {
  if (!clanWar || isFriendlyWar(clanWar)) return { sent: 0 };
  if (clanWar.state !== 'preparation' && clanWar.state !== 'inWar') return { sent: 0 };

  let member = findWarMember(clanWar, mongoAcc.tag);
  let effectiveClanTag = clanTag;

  // 保存クランが古い場合（移籍など）はプレイヤーを再取得して再判定
  if (!member) {
    const refreshedTag = await resolveClanTag(client, mongoAcc, playerCache, {
      forceRefresh: true,
    });
    if (!refreshedTag || refreshedTag === clanTag) {
      return { sent: 0 };
    }
    effectiveClanTag = refreshedTag;
    const refreshedWar = await getCurrentWarCached(client, refreshedTag, warCache);
    if (
      !refreshedWar
      || isFriendlyWar(refreshedWar)
      || (refreshedWar.state !== 'preparation' && refreshedWar.state !== 'inWar')
    ) {
      return { sent: 0 };
    }
    member = findWarMember(refreshedWar, mongoAcc.tag);
    if (!member) return { sent: 0 };
    clanWar = refreshedWar;
  }

  const warKey = buildWarKey(effectiveClanTag, clanWar.startTime);
  if (!warKey) return { sent: 0 };

  let sent = 0;
  const nowMs = Date.now();
  const endMs = new Date(clanWar.endTime).getTime();

  if (clanWar.state === 'preparation') {
    const embed = createMatchedEmbed(mongoAcc, clanWar, effectiveClanTag);
    if (await claimAndSend(client, mongoAcc, warKey, 'matched', embed)) {
      sent += 1;
      await functions.sleep(SEND_DELAY_MS);
    }
  }

  if (clanWar.state === 'inWar') {
    const startedEmbed = createStartedEmbed(mongoAcc, clanWar, effectiveClanTag);
    if (await claimAndSend(client, mongoAcc, warKey, 'started', startedEmbed)) {
      sent += 1;
      await functions.sleep(SEND_DELAY_MS);
    }

    const left = remainingAttacks(clanWar, member);
    if (left >= 1 && Number.isFinite(endMs)) {
      for (let i = END_REMINDER_HOURS.length - 1; i >= 0; i -= 1) {
        const reminder = END_REMINDER_HOURS[i];
        if (nowMs < endMs - reminder.hours * HOUR_MS) continue;

        const alsoMark = END_REMINDER_HOURS.slice(0, i).map((r) => r.key);
        const embed = createEndReminderEmbed(
          mongoAcc,
          clanWar,
          effectiveClanTag,
          member,
          reminder,
        );
        if (
          await claimAndSend(
            client,
            mongoAcc,
            warKey,
            reminder.key,
            embed,
            alsoMark,
          )
        ) {
          sent += 1;
          await functions.sleep(SEND_DELAY_MS);
        }
        break;
      }
    }
  }

  return { sent };
}

function findWarMember(clanWar, playerTag) {
  if (!clanWar || !playerTag) return null;
  if (typeof clanWar.getMember === 'function') {
    return clanWar.getMember(playerTag) ?? null;
  }
  return (
    clanWar.clan?.members?.find((m) => m.tag === playerTag)
    ?? clanWar.opponent?.members?.find((m) => m.tag === playerTag)
    ?? null
  );
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = [];
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runner(),
  );
  await Promise.all(runners);
  return results;
}

async function cronClanWarNotify(client) {
  const accounts = await fetchEligibleAccounts(client);
  console.log(`[clanWarNotify] eligible accounts=${accounts.length}`);
  if (accounts.length === 0) return;

  const playerCache = new Map();
  const warCache = new Map();

  const withClan = [];
  await runWithConcurrency(accounts, CLAN_RESOLVE_CONCURRENCY, async (mongoAcc) => {
    if (!accountHasClanWarReminders(mongoAcc.legend?.logSettings)) {
      return;
    }
    const clanTag = await resolveClanTag(client, mongoAcc, playerCache);
    if (!clanTag) return;
    withClan.push({ mongoAcc, clanTag });
  });

  const byClan = new Map();
  for (const entry of withClan) {
    const list = byClan.get(entry.clanTag) ?? [];
    list.push(entry.mongoAcc);
    byClan.set(entry.clanTag, list);
  }

  console.log(`[clanWarNotify] clans=${byClan.size}`);

  const clanTags = [...byClan.keys()];
  await runWithConcurrency(clanTags, WAR_FETCH_CONCURRENCY, async (clanTag) => {
    await getCurrentWarCached(client, clanTag, warCache);
  });

  let sentTotal = 0;
  let skippedNoWar = 0;
  let skippedFriendly = 0;

  for (const [clanTag, clanAccounts] of byClan) {
    const clanWar = warCache.get(clanTag);
    if (!clanWar || (clanWar.state !== 'preparation' && clanWar.state !== 'inWar')) {
      skippedNoWar += clanAccounts.length;
      continue;
    }
    if (isFriendlyWar(clanWar)) {
      skippedFriendly += clanAccounts.length;
      continue;
    }

    for (const mongoAcc of clanAccounts) {
      try {
        const result = await processAccountWar(
          client,
          mongoAcc,
          clanTag,
          clanWar,
          playerCache,
          warCache,
        );
        sentTotal += result.sent;
      } catch (error) {
        console.error(`[clanWarNotify] process failed ${mongoAcc.tag}:`, error);
      }
    }
  }

  console.log(
    `[clanWarNotify] done sent=${sentTotal} `
    + `skippedNoWar=${skippedNoWar} skippedFriendly=${skippedFriendly}`,
  );
}

export { accountHasClanWarReminders, cronClanWarNotify };
