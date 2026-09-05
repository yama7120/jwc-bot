import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import config from '../../config/config.js';
import * as functions from '../../functions/functions.js';
import { canBotPostLegendLogToChannel } from '../../functions/fLegend.js';

const nameCommand = 'reminders';

const POST_CHOICES = [
  { name: '[this_channel] このチャンネル', value: 'channel' },
  {
    name: '[channel_mention] このチャンネル（メンションあり）',
    value: 'channel_mention',
  },
  { name: '[dm] DM', value: 'dm' },
  { name: '[false] 通知しない', value: 'NA' },
];

const POST_LABEL = {
  channel: 'this_channel',
  channel_mention: 'channel_mention',
  dm: 'dm',
  NA: 'OFF',
};

const NOTIFY_TYPE_OPTIONS = [
  { name: 'matched', description: 'MATCHED（マッチング時）の通知先', key: 'matched' },
  { name: 'started', description: 'STARTED（戦争開始時）の通知先', key: 'started' },
  { name: 'end_12h', description: 'WAR ENDS IN 12 HOURS の通知先', key: 'end12h' },
  { name: 'end_3h', description: 'WAR ENDS IN 3 HOURS の通知先', key: 'end3h' },
  { name: 'end_1h', description: 'WAR ENDS IN 1 HOUR の通知先', key: 'end1h' },
  { name: 'attack', description: 'ATTACK（攻撃結果）の通知先', key: 'attack' },
];

function isChannelPostMode(post) {
  return post === 'channel' || post === 'channel_mention';
}

function buildCommand() {
  return new SlashCommandBuilder()
    .setName(nameCommand)
    .setDescription('no description')
    .addSubcommandGroup((group) => {
      group
        .setName('war')
        .setDescription('クラン対戦リマインダー')
        .addSubcommand((subcommand) => {
          subcommand
            .setName('settings')
            .setDescription(
              config.command[nameCommand].subCommandGroup.war.settings,
            )
            .addStringOption((option) =>
              option
                .setName('account')
                .setDescription('プレイヤータグ')
                .setRequired(true)
                .setAutocomplete(true),
            );

          for (const typeOpt of NOTIFY_TYPE_OPTIONS) {
            subcommand.addStringOption((option) =>
              option
                .setName(typeOpt.name)
                .setDescription(typeOpt.description)
                .addChoices(...POST_CHOICES)
                .setRequired(true),
            );
          }

          return subcommand;
        });

      return group;
    });
}

const data = buildCommand();

export default {
  data,

  async autocomplete(interaction, client) {
    const focusedOption = interaction.options.getFocused(true);
    const focusedValue = interaction.options.getFocused();
    if (focusedOption.name !== 'account') return;

    const query = {
      'pilotDC.id': interaction.user.id,
      status: { $ne: false },
    };
    const options = {
      projection: { _id: 0, tag: 1, name: 1, townHallLevel: 1 },
    };
    const cursor = client.clientMongo
      .db('jwc')
      .collection('accounts')
      .find(query, options)
      .sort({ townHallLevel: -1 });
    let accs = await cursor.toArray();
    await cursor.close();

    accs = accs.filter((acc) => acc.name?.includes(focusedValue));
    if (accs.length > 25) {
      accs = accs.slice(0, 25);
    }
    if (accs.length > 0) {
      await interaction.respond(
        accs.map((acc) => ({
          name: `[TH${acc.townHallLevel}] ${acc.name}`,
          value: acc.tag,
        })),
      );
    }
  },

  async execute(interaction, client) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    if (group === 'war' && sub === 'settings') {
      await warSettings(interaction, client);
    }
  },
};

async function warSettings(interaction, client) {
  const iPlayerTag = interaction.options.getString('account');
  const mongoAcc = await client.clientMongo.db('jwc').collection('accounts').findOne(
    { tag: iPlayerTag },
    { projection: { legend: 1, pilotDC: 1, warReminders: 1, _id: 0 } },
  );

  if (!mongoAcc || interaction.user.id !== mongoAcc.pilotDC?.id) {
    const pilot = mongoAcc?.pilotDC?.id == null ? 'unknown' : `<@!${mongoAcc.pilotDC?.id}>`;
    const content = [
      'There was an issue with your account operation. Please check the following steps:',
      `1. Register your account: </register_acc new:${config.command.register_acc.id}>`,
      `2. Link your account to Discord: </link_account_to_discord new:${config.command.link_account_to_discord.id}>`,
      '*You can only operate accounts that are registered and linked.*',
      '',
      `tag: ${iPlayerTag}`,
      `pilot: ${pilot}`,
    ].join('\n');
    await interaction.followUp({ content, ephemeral: true });
    return;
  }

  const types = {};
  for (const typeOpt of NOTIFY_TYPE_OPTIONS) {
    types[typeOpt.key] = interaction.options.getString(typeOpt.name);
  }

  const needsChannel = Object.values(types).some((v) => isChannelPostMode(v));
  const needsMention = Object.values(types).some((v) => v === 'channel_mention');
  let iChannelId = null;

  if (needsChannel) {
    const channel = interaction.channel;
    if (!channel?.isTextBased()) {
      await interaction.followUp({
        content: 'War reminders can only be posted to text channels.',
        ephemeral: true,
      });
      return;
    }

    const guildMember =
      interaction.guild?.members?.me
      ?? (interaction.guild
        ? await interaction.guild.members.fetch(client.user.id).catch(() => null)
        : null);
    const botActor = guildMember?.user ?? client.user;
    if (!canBotPostLegendLogToChannel(channel, botActor)) {
      await interaction.followUp({
        content:
          'JWC BOT needs **View Channel** and **Send Messages** in this channel. '
          + 'Fix permissions or choose DM.',
        ephemeral: true,
      });
      return;
    }

    if (needsMention && !mongoAcc.pilotDC?.id) {
      await interaction.followUp({
        content: 'pilotDC.id is missing. Link the account to Discord first.',
        ephemeral: true,
      });
      return;
    }

    iChannelId = channel.id;
  }

  const anyOn = Object.values(types).some((v) => v !== 'NA');
  const warReminders = {
    enabled: anyOn ? 'all' : 'false',
    channel: iChannelId,
    types,
  };

  const resultScan = await functions.scanAcc(client.clientCoc, iPlayerTag);
  const updatedListing = { warReminders };
  if (resultScan?.scPlayer?.clan) {
    updatedListing.clan = {
      tag: resultScan.scPlayer.clan.tag,
      name: resultScan.scPlayer.clan.name,
    };
  } else if (resultScan?.scPlayer) {
    updatedListing.clan = null;
  }

  await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .updateOne({ tag: iPlayerTag }, { $set: updatedListing });

  const title = resultScan?.scPlayer
    ? await functions.getAccInfoTitle(resultScan.scPlayer)
    : iPlayerTag;

  let description = '';
  if (resultScan?.scPlayer) {
    description += await functions.getAccInfoDescriptionMain(resultScan.scPlayer, 'long');
    description += `\n`;
  }
  description += `⚔️ Clan War Reminder Settings\n`;
  description += `[Matched] *${POST_LABEL[types.matched] ?? types.matched}*\n`;
  description += `[Started] *${POST_LABEL[types.started] ?? types.started}*\n`;
  description += `[Ends 12h] *${POST_LABEL[types.end12h] ?? types.end12h}*\n`;
  description += `[Ends 3h] *${POST_LABEL[types.end3h] ?? types.end3h}*\n`;
  description += `[Ends 1h] *${POST_LABEL[types.end1h] ?? types.end1h}*\n`;
  description += `[Attack] *${POST_LABEL[types.attack] ?? types.attack}*\n`;
  description += `\n`;
  if (!anyOn) {
    description += `*War reminders are disabled.*\n`;
  } else {
    if (needsChannel) {
      description += `channel: <#${interaction.channel.id}>\n`;
    }
    if (needsMention) {
      description += `mention: <@!${mongoAcc.pilotDC.id}>\n`;
    }
  }
  description += `\n`;
  description += `_Legend notifications use </legend settings:${config.command.legend.id}> separately._\n`;

  const embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setDescription(description);
  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  embed.setTimestamp();

  const nameDiscord = mongoAcc.pilotDC.globalName
    ? mongoAcc.pilotDC.globalName
    : mongoAcc.pilotDC.username;
  if (nameDiscord) {
    embed.setAuthor({ name: nameDiscord, iconURL: mongoAcc.pilotDC.avatarUrl });
  }

  await interaction.followUp({ embeds: [embed] });
}
