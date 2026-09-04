import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import config from '../../config/config.js';
import * as functions from '../../functions/functions.js';
import { canBotPostLegendLogToChannel } from '../../functions/fLegend.js';

const nameCommand = 'war_reminders';

const data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription('no description')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('settings')
      .setDescription(config.command[nameCommand].subCommand.settings)
      .addStringOption((option) =>
        option
          .setName('account')
          .setDescription('プレイヤータグ')
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((option) =>
        option
          .setName('reminders')
          .setDescription('クラン対戦リマインダー')
          .addChoices(
            { name: '[all] 通知する（マッチング／開始／残攻撃）', value: 'all' },
            { name: '[false] 通知しない', value: 'false' },
          )
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName('post')
          .setDescription('通知先（legend とは別チャンネルを指定可）')
          .addChoices(
            { name: '[this_channel] このチャンネル', value: 'channel' },
            { name: '[dm] DM', value: 'dm' },
            { name: '[false] 通知しない', value: 'NA' },
          )
          .setRequired(true),
      ),
  );

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
    if (interaction.options.getSubcommand() === 'settings') {
      await settings(interaction, client);
    }
  },
};

async function settings(interaction, client) {
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

  const iReminders = interaction.options.getString('reminders');
  const iPost = interaction.options.getString('post');
  let iChannelId = null;

  if (iPost === 'channel') {
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
    iChannelId = channel.id;
  }

  const resultScan = await functions.scanAcc(client.clientCoc, iPlayerTag);
  const warReminders = {
    enabled: iReminders,
    post: iPost,
    channel: iChannelId,
  };

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
  description += `[Reminders] *${iReminders}*\n`;
  description += `[Post] *${iPost}*\n`;
  description += `\n`;
  if (iPost === 'dm') {
    description += `*JWC bot will dm war reminders to you.*\n`;
  } else if (iPost === 'channel') {
    description += `*JWC bot will post war reminders on this channel.*\n`;
    description += `<#${interaction.channel.id}>\n`;
  } else {
    description += `*War reminders are disabled.*\n`;
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
