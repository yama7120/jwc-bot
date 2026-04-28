import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import config from '../../config/config.js';
import * as functions from '../../functions/functions.js';

const nameCommand = 'battlelog';

const data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription('Battle log summary')
  .addStringOption((option) =>
    option
      .setName('account')
      .setDescription('プレイヤータグ')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addStringOption((option) =>
    option
      .setName('type')
      .setDescription('ログタイプで絞り込み')
      .addChoices(
        { name: 'ALL', value: 'all' },
        { name: 'RANKED', value: 'ranked' },
        { name: 'HOME VILLAGE', value: 'homeVillage' },
        { name: 'LEGEND', value: 'legend' },
      ),
  )
  .addIntegerOption((option) =>
    option
      .setName('limit')
      .setDescription('集計対象件数')
      .addChoices(
        { name: '10', value: 10 },
        { name: '25', value: 25 },
        { name: '50', value: 50 },
      ),
  );

function sumResource(entries, resourceName) {
  return entries.reduce((total, entry) => {
    const list = Array.isArray(entry?.lootedResources) ? entry.lootedResources : [];
    const hit = list.find((item) => item?.name === resourceName);
    return total + (hit?.amount ?? 0);
  }, 0);
}

function formatNumber(num) {
  return Number(num || 0).toLocaleString('en-US');
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

function buildRecentLines(entries, maxLines = 10) {
  return entries.slice(0, maxLines).map((entry, idx) => {
    const side = entry?.attack ? 'A' : 'D';
    const battleType = entry?.battleType ?? 'unknown';
    const stars = Number(entry?.stars ?? 0);
    const destruction = Number(entry?.destructionPercentage ?? 0);
    const opponent = entry?.opponentPlayerTag ?? 'N/A';
    return `${idx + 1}. [${side}] ${battleType} ${'⭐'.repeat(Math.max(0, stars))}${stars === 0 ? '☆0' : ''} ${destruction}% vs ${opponent}`;
  });
}

export default {
  data,

  async autocomplete(interaction, client) {
    const focusedOption = interaction.options.getFocused(true);
    const focusedValue = interaction.options.getFocused();

    if (focusedOption.name !== 'account') {
      await interaction.respond([]);
      return;
    }

    const query = { 'pilotDC.id': interaction.user.id, status: { $ne: false } };
    const options = { projection: { _id: 0, tag: 1, name: 1, townHallLevel: 1 } };
    const sort = { townHallLevel: -1 };
    const cursor = client.clientMongo.db('jwc').collection('accounts')
      .find(query, options)
      .sort(sort)
      .limit(25);
    const accs = await cursor.toArray();
    await cursor.close();

    const filtered = accs
      .filter((acc) => String(acc.name).includes(focusedValue))
      .slice(0, 25);
    await interaction.respond(
      filtered.map((acc) => ({
        name: `[TH${acc.townHallLevel}] ${acc.name}`,
        value: acc.tag,
      })),
    );
  },

  async execute(interaction, client) {
    const iPlayerTag = interaction.options.getString('account');
    const playerTag = functions.tagReplacer(iPlayerTag);
    const filterType = interaction.options.getString('type') ?? 'all';
    const limit = interaction.options.getInteger('limit') ?? 25;

    const scPlayer = await client.clientCoc.getPlayer(playerTag);
    const allItems = await fetchBattleLogItems(client.clientCoc, playerTag);
    const filteredItems = (filterType === 'all')
      ? allItems
      : allItems.filter((item) => item?.battleType === filterType);
    const targetItems = filteredItems.slice(0, Math.max(1, limit));

    const attacks = targetItems.filter((item) => item?.attack === true);
    const defenses = targetItems.filter((item) => item?.attack === false);
    const rankedCount = targetItems.filter((item) => item?.battleType === 'ranked').length;
    const homeCount = targetItems.filter((item) => item?.battleType === 'homeVillage').length;
    const legendCount = targetItems.filter((item) => item?.battleType === 'legend').length;

    const attack3Star = attacks.filter((item) => Number(item?.stars ?? 0) === 3).length;
    const defenseHold = defenses.filter((item) => Number(item?.stars ?? 0) <= 1).length;

    const totalGold = sumResource(targetItems, 'Gold');
    const totalElixir = sumResource(targetItems, 'Elixir');
    const totalDark = sumResource(targetItems, 'DarkElixir');
    const totalSour = sumResource(targetItems, 'SourElixir');

    const recentLines = buildRecentLines(targetItems, 10);

    const description = [
      `${config.emote.thn[scPlayer.townHallLevel] ?? ''} **${functions.nameReplacer(scPlayer.name)}** | ${scPlayer.tag}`,
      '',
      `対象: **${targetItems.length}件** (取得全体: ${allItems.length}件, filter: ${filterType})`,
      `A/D: **${attacks.length} / ${defenses.length}**`,
      `Attack 3★: **${attack3Star}** | Defense hold(<=1★): **${defenseHold}**`,
      '',
      `Type counts -> ranked: **${rankedCount}** / homeVillage: **${homeCount}** / legend: **${legendCount}**`,
      '',
      `Loot total`,
      `- Gold: **${formatNumber(totalGold)}**`,
      `- Elixir: **${formatNumber(totalElixir)}**`,
      `- Dark: **${formatNumber(totalDark)}**`,
      `- Sour: **${formatNumber(totalSour)}**`,
      '',
      `Recent`,
      ...(recentLines.length > 0 ? recentLines : ['- no logs']),
    ].join('\n');

    const embed = new EmbedBuilder()
      .setTitle('**BATTLE LOG SUMMARY**')
      .setDescription(description)
      .setColor(config.color.main)
      .setFooter({ text: config.footer, iconURL: config.urlImage.jwc })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
  },
};
