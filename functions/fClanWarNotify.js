import { EmbedBuilder } from 'discord.js';

import config from '../config/config.js';
import * as functions from './functions.js';
import { canBotPostLegendLogToChannel } from './fLegend.js';

const HOUR_MS = 60 * 60 * 1000;
const END_REMINDER_HOURS = [
  { key: 'end12h', hours: 12, title: '⏰ WAR ENDS IN 12 HOURS' },
  { key: 'end3h', hours: 3, title: '⏰ WAR ENDS IN 3 HOURS' },
  { key: 'end1h', hours: 1, title: '⏰ WAR ENDS IN 1 HOUR' },
];

const CLAN_RESOLVE_CONCURRENCY = 5;
const WAR_FETCH_CONCURRENCY = 3;
const SEND_DELAY_MS = 200;
const BROKEN_DELIVERY_ERROR_CODES = new Set([50001, 10003, 50007]);

function getWarReminderSettings(mongoAcc) {
  return mongoAcc?.warReminders ?? null;
}

function isChannelPostMode(post) {
  return post === 'channel' || post === 'channel_mention';
}

function isDeliverablePostMode(post) {
  return isChannelPostMode(post) || post === 'dm';
}

/**
 * 種類ごとの通知先を返す。
 * 旧形式（types が boolean / 共通 post）も互換。
 */
function getTypePostMode(mongoAcc, typeKey) {
  const settings = getWarReminderSettings(mongoAcc);
  if (!settings || settings.enabled === 'false') return 'NA';

  const types = settings.types;
  if (!types || typeof types !== 'object') {
    return isDeliverablePostMode(settings.post) ? settings.post : 'NA';
  }

  const value = types[typeKey];
  if (value === true || value === 'true' || value === 'all') {
    return isDeliverablePostMode(settings.post) ? settings.post : 'NA';
  }
  if (value === false || value === 'false' || value == null) return 'NA';
  if (isDeliverablePostMode(value) || value === 'NA') return value;
  return 'NA';
}

function isWarReminderTypeEnabled(mongoAcc, typeKey) {
  return isDeliverablePostMode(getTypePostMode(mongoAcc, typeKey));
}

function accountHasClanWarReminders(mongoAcc) {
  const settings = getWarReminderSettings(mongoAcc);
  if (!settings) return false;
  if (settings.enabled === 'false') return false;

  const typeKeys = ['matched', 'started', 'end12h', 'end3h', 'end1h', 'attack'];
  return typeKeys.some((key) => isWarReminderTypeEnabled(mongoAcc, key));
}

function typeKeyFromPrimaryKey(primaryKey) {
  if (typeof primaryKey === 'string' && primaryKey.startsWith('attack')) {
    return 'attack';
  }
  return primaryKey;
}

async function resolveDeliveryChannel(client, channelId) {
  if (!channelId) return null;
  let channel = client.channels.cache.get(channelId);
  if (!channel) {
    channel = await client.channels.fetch(channelId).catch(() => null);
  }
  return channel?.isTextBased() ? channel : null;
}

async function disableBrokenChannelWarReminders(client, mongoAcc, details) {
  const settings = getWarReminderSettings(mongoAcc);
  if (!settings) return false;

  const types = { ...(settings.types ?? {}) };
  const typeKeys = ['matched', 'started', 'end12h', 'end3h', 'end1h', 'attack'];
  let changed = false;

  for (const key of typeKeys) {
    const mode = getTypePostMode(mongoAcc, key);
    if (isChannelPostMode(mode)) {
      types[key] = 'NA';
      changed = true;
    } else if (typeof types[key] === 'boolean' || types[key] === 'true' || types[key] === 'all') {
      // keep non-channel legacy as explicit dm if that was shared post
      if (settings.post === 'dm') {
        types[key] = 'dm';
      }
    }
  }

  if (!changed && !settings.channel && !isChannelPostMode(settings.post)) {
    return false;
  }

  const anyOn = typeKeys.some((key) => isDeliverablePostMode(types[key]));
  const disabledAt = Math.floor(Date.now() / 1000);
  const next = {
    enabled: anyOn ? 'all' : 'false',
    channel: null,
    types,
    lastDisabledAt: disabledAt,
    lastDisabledReason: details.reason,
  };

  await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .updateOne({ tag: mongoAcc.tag }, { $set: { warReminders: next } });

  mongoAcc.warReminders = next;
  return true;
}

async function notifyWarReminderSettingsDisabled(client, mongoAcc, reason) {
  const commandId = config.command?.war_reminders?.id;
  const settingsCommand = commandId
    ? `</war_reminders settings:${commandId}>`
    : '`/war_reminders settings`';
  const accountLabel = `${mongoAcc.name ?? 'unknown'} (${mongoAcc.tag ?? 'unknown'})`;
  const content = [
    ':warning: Clan war reminder channel delivery was disabled.',
    `Account: **${accountLabel}**`,
    `Reason: ${reason}`,
    `Please reconfigure with ${settingsCommand}.`,
  ].join('\n');

  if (mongoAcc.pilotDC?.id) {
    try {
      const pilot = await client.users.fetch(mongoAcc.pilotDC.id);
      await pilot.send({ content });
    } catch (error) {
      console.warn(
        `[clanWarNotify] failed to notify pilot (${mongoAcc.tag}):`,
        error?.message ?? error,
      );
    }
  }
}

async function deliverWarReminderToUser(client, mongoAcc, payload, postMode) {
  if (!isDeliverablePostMode(postMode)) {
    return { ok: false, reason: 'disabled' };
  }

  const settings = getWarReminderSettings(mongoAcc);

  try {
    if (isChannelPostMode(postMode)) {
      const channel = await resolveDeliveryChannel(client, settings?.channel);
      if (!channel) {
        await disableBrokenChannelWarReminders(client, mongoAcc, {
          reason: 'channel_not_found',
        });
        await notifyWarReminderSettingsDisabled(client, mongoAcc, 'channel_not_found');
        return { ok: false, reason: 'channel_not_found' };
      }
      if (!canBotPostLegendLogToChannel(channel, client.user)) {
        await disableBrokenChannelWarReminders(client, mongoAcc, {
          reason: 'missing_channel_permissions',
        });
        await notifyWarReminderSettingsDisabled(
          client,
          mongoAcc,
          'missing_channel_permissions',
        );
        return { ok: false, reason: 'missing_channel_permissions' };
      }

      const sendPayload = { ...payload };
      if (postMode === 'channel_mention') {
        const pilotId = mongoAcc.pilotDC?.id;
        if (!pilotId) {
          return { ok: false, reason: 'pilot_missing' };
        }
        sendPayload.content = `<@!${pilotId}>`;
        sendPayload.allowedMentions = { users: [String(pilotId)] };
      }

      await channel.send(sendPayload);
      return { ok: true };
    }

    if (postMode === 'dm') {
      const pilotId = mongoAcc.pilotDC?.id;
      if (!pilotId) {
        return { ok: false, reason: 'pilot_missing' };
      }
      const pilot = await client.users.fetch(pilotId);
      await pilot.send(payload);
      return { ok: true };
    }

    return { ok: false, reason: 'unsupported_post_mode' };
  } catch (error) {
    console.error(
      '[clanWarNotify] delivery failed:',
      mongoAcc.name,
      mongoAcc.tag,
      error,
    );
    if (BROKEN_DELIVERY_ERROR_CODES.has(error?.code)) {
      const reason =
        postMode === 'dm' ? 'dm_unreachable' : `discord_error_${error.code}`;
      if (isChannelPostMode(postMode)) {
        await disableBrokenChannelWarReminders(client, mongoAcc, { reason });
        await notifyWarReminderSettingsDisabled(client, mongoAcc, reason);
      }
    }
    return { ok: false, reason: 'delivery_failed', error };
  }
}

function buildWarKey(clanTag, startTime) {
  const startUnix = Math.floor(new Date(startTime).getTime() / 1000);
  if (!clanTag || !Number.isFinite(startUnix) || startUnix <= 0) return null;
  return `${clanTag}:${startUnix}`;
}

function normalizeAttacks(member) {
  const raw = member?.attacks;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw.length === 'number') {
    try {
      return Array.from(raw);
    } catch {
      const list = [];
      for (let i = 0; i < raw.length; i += 1) {
        if (raw[i] != null) list.push(raw[i]);
      }
      return list;
    }
  }
  if (typeof raw.values === 'function') {
    try {
      return [...raw.values()];
    } catch {
      return [];
    }
  }
  return [];
}

function remainingAttacks(clanWar, member) {
  const apm = Number(clanWar?.attacksPerMember) || 0;
  const used = normalizeAttacks(member).length;
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
  embed.setColor(config.color.red);
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
  const deliverable = ['channel', 'channel_mention', 'dm'];
  return client.clientMongo
    .db('jwc')
    .collection('accounts')
    .find(
      {
        status: { $ne: false },
        'warReminders.enabled': { $ne: 'false' },
        $or: [
          { 'warReminders.types.matched': { $in: deliverable } },
          { 'warReminders.types.started': { $in: deliverable } },
          { 'warReminders.types.end12h': { $in: deliverable } },
          { 'warReminders.types.end3h': { $in: deliverable } },
          { 'warReminders.types.end1h': { $in: deliverable } },
          { 'warReminders.types.attack': { $in: deliverable } },
          // legacy: boolean types + shared post
          {
            'warReminders.enabled': 'all',
            'warReminders.post': { $in: deliverable },
          },
        ],
      },
      {
        projection: {
          _id: 0,
          tag: 1,
          name: 1,
          townHallLevel: 1,
          clan: 1,
          pilotDC: 1,
          warReminders: 1,
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
    return { warKey, sent: {}, attackCount: undefined };
  }
  return {
    warKey,
    sent: { ...(current.sent ?? {}) },
    attackCount: current.attackCount,
  };
}

function formatStars(stars) {
  const n = Number(stars) || 0;
  const filled = config.emote?.star ?? '⭐';
  const empty = config.emote?.starGray ?? '☆';
  return `${filled.repeat(Math.min(3, Math.max(0, n)))}${empty.repeat(Math.max(0, 3 - n))}`;
}

function findDefender(clanWar, homeClanTag, defenderTag) {
  const opp = opponentClan(clanWar, homeClanTag);
  if (!opp?.members || !defenderTag) return null;
  return opp.members.find((m) => m.tag === defenderTag) ?? null;
}

function formatAttackResultLine(clanWar, homeClanTag, attack, attackNo) {
  const stars = formatStars(attack?.stars);
  const destruction = attack?.destruction ?? 0;
  const duration = Number(attack?.duration);
  const left = Number.isFinite(duration) ? Math.max(0, 180 - duration) : null;
  const defender = findDefender(clanWar, homeClanTag, attack?.defenderTag);
  const defTh = defender?.townHallLevel;
  const defThEmote = defTh != null
    ? (config.emote?.thn?.[defTh] ?? `TH${defTh}`)
    : '';
  const defName = defender?.name
    ? functions.nameReplacer(defender.name)
    : (attack?.defenderTag ?? 'Unknown');
  const mapPos = defender?.mapPosition != null ? `#${defender.mapPosition}` : '';

  const lines = [
    `**Attack ${attackNo}**`,
    `${stars} **${destruction}%**${left != null ? `  _${left}″ left_` : ''}`,
    `${config.emote?.sword ?? '⚔️'} ${defThEmote} ${defName}${mapPos ? ` (${mapPos})` : ''}`,
  ];
  return lines.join('\n');
}

function createAttackResultEmbed(mongoAcc, clanWar, homeClanTag, attack, attackNo, attacksUsed, apm) {
  const embed = new EmbedBuilder();
  embed.setTitle(`⚔️ WAR ATTACK #${attackNo}`);
  embed.setColor(config.color.green);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  embed.setTimestamp();
  const usedLine =
    Number(attacksUsed) >= Number(apm) && Number(apm) > 0
      ? `Attacks used: **${attacksUsed}/${apm}** :white_check_mark:`
      : `Attacks used: **${attacksUsed}/${apm}**`;
  embed.setDescription(
    [
      playerHeader(mongoAcc),
      warMatchLine(clanWar, homeClanTag),
      '',
      formatAttackResultLine(clanWar, homeClanTag, attack, attackNo),
      '',
      usedLine,
    ].join('\n'),
  );
  return embed;
}

function toClanWarNotifyDoc(notify) {
  const doc = {
    warKey: notify.warKey,
    sent: { ...(notify.sent ?? {}) },
  };
  if (typeof notify.attackCount === 'number' && Number.isFinite(notify.attackCount)) {
    doc.attackCount = notify.attackCount;
  }
  return doc;
}

async function persistNotifyState(client, mongoAcc, notify) {
  const doc = toClanWarNotifyDoc(notify);
  await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .updateOne({ tag: mongoAcc.tag }, { $set: { clanWarNotify: doc } });
  mongoAcc.clanWarNotify = doc;
}

/** attackCount 未設定なら 0 から開始（既存攻撃も未送信なら通知する） */
async function ensureAttackCount(client, mongoAcc, warKey) {
  const notify = getNotifyState(mongoAcc, warKey);
  if (typeof notify.attackCount === 'number' && Number.isFinite(notify.attackCount)) {
    return notify.attackCount;
  }

  notify.attackCount = 0;
  await persistNotifyState(client, mongoAcc, notify);
  return 0;
}

async function processNewAttackResults(
  client,
  mongoAcc,
  warKey,
  clanWar,
  homeClanTag,
  member,
) {
  const attacks = normalizeAttacks(member);
  const apm = Number(clanWar?.attacksPerMember) || attacks.length || 1;
  let previousCount = await ensureAttackCount(client, mongoAcc, warKey);

  let sent = 0;
  for (let i = previousCount; i < attacks.length; i += 1) {
    const attackNo = i + 1;
    const embed = createAttackResultEmbed(
      mongoAcc,
      clanWar,
      homeClanTag,
      attacks[i],
      attackNo,
      attackNo,
      apm,
    );
    if (await claimAndSend(client, mongoAcc, warKey, `attack${attackNo}`, embed)) {
      const notify = getNotifyState(mongoAcc, warKey);
      notify.attackCount = Math.max(notify.attackCount ?? 0, attackNo);
      await persistNotifyState(client, mongoAcc, notify);
      sent += 1;
      await functions.sleep(SEND_DELAY_MS);
    } else {
      const notify = getNotifyState(mongoAcc, warKey);
      if ((notify.attackCount ?? 0) < attackNo) {
        notify.attackCount = attackNo;
        await persistNotifyState(client, mongoAcc, notify);
      }
    }
  }
  return sent;
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

  const doc = toClanWarNotifyDoc(notify);

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
      { $set: { clanWarNotify: doc } },
    );

  if (claim.matchedCount === 0) {
    const fresh = await client.clientMongo
      .db('jwc')
      .collection('accounts')
      .findOne({ tag: mongoAcc.tag }, { projection: { clanWarNotify: 1 } });
    mongoAcc.clanWarNotify = fresh?.clanWarNotify;
    return false;
  }

  mongoAcc.clanWarNotify = doc;

  const result = await deliverWarReminderToUser(
    client,
    mongoAcc,
    { embeds: [embed] },
    getTypePostMode(mongoAcc, typeKeyFromPrimaryKey(primaryKey)),
  );
  if (!result?.ok) {
    console.warn(
      `[clanWarNotify] delivery failed ${mongoAcc.tag} ${primaryKey}:`,
      result?.reason ?? 'unknown',
    );
  }
  return true;
}

async function processAccountWar(client, mongoAcc, clanTag, clanWar, playerCache, warCache) {
  if (!clanWar) return { sent: 0 };
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
    if (isWarReminderTypeEnabled(mongoAcc, 'matched')) {
      const embed = createMatchedEmbed(mongoAcc, clanWar, effectiveClanTag);
      if (await claimAndSend(client, mongoAcc, warKey, 'matched', embed)) {
        sent += 1;
        await functions.sleep(SEND_DELAY_MS);
      }
    }
  }

  if (clanWar.state === 'inWar') {
    if (isWarReminderTypeEnabled(mongoAcc, 'started')) {
      const startedEmbed = createStartedEmbed(mongoAcc, clanWar, effectiveClanTag);
      if (await claimAndSend(client, mongoAcc, warKey, 'started', startedEmbed)) {
        sent += 1;
        await functions.sleep(SEND_DELAY_MS);
      }
    }

    if (isWarReminderTypeEnabled(mongoAcc, 'attack')) {
      sent += await processNewAttackResults(
        client,
        mongoAcc,
        warKey,
        clanWar,
        effectiveClanTag,
        member,
      );
    }

    const left = remainingAttacks(clanWar, member);
    if (left >= 1 && Number.isFinite(endMs)) {
      for (let i = END_REMINDER_HOURS.length - 1; i >= 0; i -= 1) {
        const reminder = END_REMINDER_HOURS[i];
        if (nowMs < endMs - reminder.hours * HOUR_MS) continue;
        if (!isWarReminderTypeEnabled(mongoAcc, reminder.key)) continue;

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
    if (!accountHasClanWarReminders(mongoAcc)) {
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

  for (const [clanTag, clanAccounts] of byClan) {
    const clanWar = warCache.get(clanTag);
    if (!clanWar || (clanWar.state !== 'preparation' && clanWar.state !== 'inWar')) {
      skippedNoWar += clanAccounts.length;
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
    `[clanWarNotify] done sent=${sentTotal} skippedNoWar=${skippedNoWar}`,
  );
}

export { accountHasClanWarReminders, cronClanWarNotify };
