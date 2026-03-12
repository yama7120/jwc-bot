const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const config = require('../../config.js');
const functions = require('../../functions/functions.js');
const fMongo = require('../../functions/fMongo.js');

const nameCommand = 'register_acc';
let data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription('no description')
  .addSubcommand(subcommand =>
    subcommand
      .setName('new')
      .setDescription(config.command[nameCommand].subCommand['new'])
      .addStringOption(option =>
        option
          .setName('account')
          .setDescription('プレイヤータグ')
          .setRequired(true)
      )
      .addUserOption(option =>
        option
          .setName('pilot_dc')
          .setDescription('使用者の discord アカウント')
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('unregister')
      .setDescription(config.command[nameCommand].subCommand['unregister'])
      .addStringOption(option =>
        option
          .setName('account')
          .setDescription('プレイヤータグ')
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

module.exports = {
  data: data,

  async autocomplete(interaction, client) {
    let focusedOption = interaction.options.getFocused(true);
    let focusedValue = interaction.options.getFocused();

    if (focusedOption.name === 'account') {
      const query = { 'pilotDC.id': interaction.user.id, status: { $ne: false } };
      const projection = { _id: 0, tag: 1, name: 1, townHallLevel: 1 };
      const sort = { townHallLevel: -1 };
      const options = { projection: projection, sort: sort };
      const cursor = client.clientMongo.db('jwc').collection('accounts').find(query, options);
      let accs = await cursor.toArray();
      await cursor.close();

      accs = accs.filter(function(acc) { return acc.name.includes(focusedValue) });
      if (accs.length > 25) {
        accs = accs.filter(function(acc, index) { return index < 25 });
      };

      if (accs.length > 0) {
        await interaction.respond(accs.map(acc => ({
          name: `[TH${acc.townHallLevel}] ${acc.name}`,
          value: acc.tag
        })));
      };
    };
  },

  async execute(interaction, client) {
    if (interaction.options.getSubcommand() == 'unregister') {
      await unregister(interaction, client);
    }
    else if (interaction.options.getSubcommand() == 'new') {
      await register(interaction, client);
    };
  }
};


async function register(interaction, client) {
  const iPlayerTag = await interaction.options.getString('account');
  const playerTag = functions.tagReplacer(iPlayerTag);
  const iPilotDc = await interaction.options.getUser('pilot_dc');

  let title = '';
  let description = '';
  let embed = new EmbedBuilder();
  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  embed.setTimestamp();

  let resultScan = await functions.scanAcc(client.clientCoc, playerTag);

  let pilotDC = null;

  let mongoAcc = await client.clientMongo.db('jwc').collection('accounts').findOne({ tag: playerTag, status: true });
  if (mongoAcc != null) {
    title = ``;
    title = await functions.getAccInfoTitle(mongoAcc, formatLength = 'long');
    description += await functions.getAccInfoDescriptionMain(mongoAcc, formatLength = 'long');
    if (mongoAcc.pilotDC != 'no discord acc' && mongoAcc.pilotDC != null && mongoAcc.pilotDC != '') {
      description += `:bust_in_silhouette: <@!${mongoAcc.pilotDC.id}>\n`;
    };
    description += `\n`;
    description += `:exclamation: *The account has already been registered in JWC bot database.*`;
  }
  else {
    if (iPilotDc != null) {
      pilotDC = iPilotDc;
      if (pilotDC.avatar == null) {
        pilotDC.avatarUrl = `https://cdn.discordapp.com/attachments/1143171140508991500/1318442274002309170/discord-round-black-icon.png`;
      }
      else {
        pilotDC.avatarUrl = `https://cdn.discordapp.com/avatars/${pilotDC.id}/${pilotDC.avatar}.png`;
      };
      await client.clientMongo.db('jwc').collection('accounts').updateOne({ tag: playerTag }, { $set: { pilotDC: pilotDC, status: true } });
      let nameDiscord = '';
      if (iPilotDc.globalName != null) {
        nameDiscord = iPilotDc.globalName;
      }
      else {
        nameDiscord = iPilotDc.username;
      }
      embed.setAuthor({ name: nameDiscord, iconURL: pilotDC.avatarUrl });
    };

    if (resultScan.status == 'ok') {
      await fMongo.registerAcc(client, playerTag, iPilotName = null, league = null, clanAbbr = null, pilotDC);
      await fMongo.updateAcc(client, playerTag);
      title = await functions.getAccInfoTitle(resultScan.scPlayer, formatLength = 'long');
      description += await functions.getAccInfoDescriptionMain(resultScan.scPlayer, formatLength = 'long');
      description += `\n`;
      description += `:white_check_mark: *The account has been successfully registered.*\n`;
      if (iPilotDc == null) {
        description += `\n`;
        description += `</link_account_to_discord new:${config.command.link_account_to_discord.id}>`;
        description += ` to link the CoC account to a discord account.`;
      };
    }
    else if (resultScan.status == 'notFound') {
      title = `:x: **${resultScan.status}**`;
      description = `*Invalid tag was inputted.*`;
    }
    else {
      title = `:x: **${resultScan.status}**`;
      description = `*Please try again later.*`;
    };
  };

  embed.setTitle(title);
  embed.setDescription(description);

  await interaction.followUp({ embeds: [embed] });
};


async function unregister(interaction, client) {
  const iSenderId = interaction.user.id;

  const iPlayerTag = await interaction.options.getString('account');
  const playerTag = functions.tagReplacer(iPlayerTag);

  let mongoAcc = await client.clientMongo.db('jwc').collection('accounts').findOne({ tag: playerTag });

  let isConfermed = false;

  if (iSenderId == mongoAcc.pilotDC.id || Object.values(config.adminId).includes(iSenderId) == true) { // 自分の or admins -> OK
    isConfermed = true;
  }
  else {
    const cursor = client.clientMongo.db('jwc').collection('clans')
      .find({}, { sort: { clan_abbr: 1 }, projection: { score: 0 } });
    let clans = await cursor.toArray();
    await cursor.close();

    let clan1 = clans.filter(function(clan) {
      if (clan.rep_1st != null && clan.rep_1st != 'non-registered') {
        return clan.rep_1st.id.includes(iSenderId);
      };
    });
    let clan2 = clans.filter(function(clan) {
      if (clan.rep_2nd != null && clan.rep_2nd != 'non-registered') {
        return clan.rep_2nd.id.includes(iSenderId);
      };
    });
    let clan3 = clans.filter(function(clan) {
      if (clan.rep_3rd != null && clan.rep_3rd != 'non-registered') {
        return clan.rep_3rd.id.includes(iSenderId);
      };
    });

    if (clan1.length + clan2.length + clan3.length > 0) { // reps -> OK
      isConfermed = true;
    }
    else {
      isConfermed == false;
    };
  };

  let title = '';
  let description = '';
  let embed = new EmbedBuilder();
  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  embed.setTimestamp();

  title = await functions.getAccInfoTitle(mongoAcc, formatLength = 'long');
  description += await functions.getAccInfoDescriptionMain(mongoAcc, formatLength = 'long');
  description += `\n`;

  if (isConfermed == false) {
    description += `:exclamation: *You can unregister only your account.*`;
  }
  else {
    await client.clientMongo.db('jwc').collection('accounts').updateOne({ tag: playerTag }, { $set: { status: false } });
    description += `:white_check_mark: *The account has been unregistered from the JWC bot database.* :wave:`;
  };

  embed.setTitle(title);
  embed.setDescription(description);

  await interaction.followUp({ embeds: [embed] });

  return;
};