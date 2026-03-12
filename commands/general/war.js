const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

const config = require('../../config.js');
const schedule = require('../../schedule.js');
const functions = require('../../functions/functions.js');
const fGetWars = require('../../functions/fGetWars.js');
const fCanvas = require('../../functions/fCanvas.js');

const nameCommand = 'war';
let data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription('no description')
  // 0
  .addSubcommand(subcommand =>
    subcommand
      .setName('summary')
      .setDescription(config.command[nameCommand].subCommand['summary'])
      .addStringOption(option =>
        option.setName('league').setDescription('リーグ').setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('week').setDescription('対戦週（選択なしの場合は最新の週）')
      )
  )
  // 1
  .addSubcommand(subcommand =>
    subcommand
      .setName('live')
      .setDescription(config.command[nameCommand].subCommand['live'])
  )
  // 2
  .addSubcommand(subcommand =>
    subcommand
      .setName('single')
      .setDescription(config.command[nameCommand].subCommand['single'])
      .addStringOption(option =>
        option.setName('league').setDescription('リーグ').setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('week').setDescription('対戦週').setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('match').setDescription('対戦').setRequired(true).setAutocomplete(true)
      )
  )
  // 3
  .addSubcommand(subcommand =>
    subcommand
      .setName('own')
      .setDescription(config.command[nameCommand].subCommand['own'])
  )
  // 4
  .addSubcommand(subcommand =>
    subcommand
      .setName('attacks')
      .setDescription(config.command[nameCommand].subCommand['attacks'])
      .addStringOption(option =>
        option.setName('league').setDescription('リーグ').setRequired(true)
      )
      .addStringOption(option =>
        option.setName('team').setDescription('チーム').setRequired(true).setAutocomplete(true)
      )
      .addIntegerOption(option =>
        option.setName('week').setDescription('対戦週（選択なしの場合は最新の週）')
      )
  )
  // 5
  .addSubcommand(subcommand =>
    subcommand
      .setName('defenses')
      .setDescription(config.command[nameCommand].subCommand['defenses'])
      .addStringOption(option =>
        option.setName('league').setDescription('リーグ').setRequired(true)
      )
      .addStringOption(option =>
        option.setName('team').setDescription('チーム').setRequired(true).setAutocomplete(true)
      )
      .addIntegerOption(option =>
        option.setName('week').setDescription('対戦週（選択なしの場合は最新の週）')
      )
  )
  // 6
  .addSubcommand(subcommand =>
    subcommand
      .setName('lineup')
      .setDescription(config.command[nameCommand].subCommand['lineup'])
      .addStringOption(option =>
        option.setName('league').setDescription('リーグ').setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('week').setDescription('対戦週').setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('match').setDescription('対戦').setRequired(true).setAutocomplete(true)
      )
  );

config.choices.league5.forEach(choice => {
  data.options[0].options[0].addChoices(choice);
  data.options[2].options[0].addChoices(choice);
  data.options[4].options[0].addChoices(choice);
  data.options[5].options[0].addChoices(choice);
  data.options[6].options[0].addChoices(choice);
});
config.choices.weekInt.forEach(choice => {
  data.options[0].options[1].addChoices(choice);
  data.options[2].options[1].addChoices(choice);
  data.options[4].options[2].addChoices(choice);
  data.options[5].options[2].addChoices(choice);
  data.options[6].options[1].addChoices(choice);
});


module.exports = {
  data: data,

  async autocomplete(interaction, client) {
    const focusedOption = interaction.options.getFocused(true);
    const iLeague = interaction.options.getString('league');
    let iWeek = interaction.options.getInteger('week');

    // Autocomplete interactions expire quickly; always return a response promptly.
    if (!iLeague) {
      await safeAutocompleteRespond(interaction, []);
      return;
    }

    if (focusedOption.name === 'match') {
      if (iWeek == null || iWeek == 99) {
        iWeek = await functions.getWeekNow(iLeague);
      };

      const query = { season: config.season[iLeague], league: iLeague, week: iWeek };
      const options = { projection: { _id: 0, league: 1, week: 1, match: 1, clan_abbr: 1, opponent_abbr: 1, name_match: 1 } };
      const sort = { match: 1 };
      const mongoWars = await client.clientMongo.db('jwc').collection('wars').find(query, options).sort(sort).limit(25).toArray();
      await safeAutocompleteRespond(interaction, mongoWars.map(war => ({
        name: `${war.name_match || war.match} - ${war.clan_abbr.toUpperCase()} vs. ${war.opponent_abbr.toUpperCase()}`,
        value: war.match
      })));
      return;
    }
    else if (focusedOption.name === 'team') {
      let teamList = await client.clientMongo.db('jwc').collection('config').findOne({ _id: 'teamList' });

      const focusedValue = interaction.options.getFocused();
      teamList = (teamList?.[iLeague] || []).filter(function(team) { return team.team_abbr.includes(focusedValue) });
      if (teamList.length >= 25) {
        teamList = teamList.filter(function(team, index) { return index < 25 });
      };

      await safeAutocompleteRespond(interaction, teamList.map(team => (
        { name: `${team.team_abbr.toUpperCase()}: ${team.team_name}`, value: team.team_abbr }
      )));
      return;
    };

    await safeAutocompleteRespond(interaction, []);
  },

  async execute(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand == 'summary') {
      warSummary(interaction, client);
    }
    else if (subcommand == 'live') {
      warLive(interaction, client);
    }
    else if (subcommand == 'single') {
      warSingle(interaction, client);
    }
    else if (subcommand == 'own') {
      warOwn(interaction, client);
    }
    else if (subcommand == 'attacks') {
      warAttacks(interaction, client);
    }
    else if (subcommand == 'defenses') {
      warDefenses(interaction, client);
    }
    else if (subcommand == 'lineup') {
      warLineupMain(interaction, client);
    };
  }
};

async function safeAutocompleteRespond(interaction, choices) {
  try {
    await interaction.respond(choices);
  } catch (error) {
    if (error?.code === 10062 || error?.code === 40060) {
      return;
    }
    throw error;
  }
}


async function warSummary(interaction, client) {
  const iLeague = await interaction.options.getString('league');
  let iWeek = await interaction.options.getInteger('week');
  if (iWeek == null || iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  };

  const query = { season: config.season[iLeague], league: iLeague, week: iWeek };
  const options = {};
  const sort = { 'match': 1 };
  const myColl = client.clientMongo.db('jwc').collection('wars');
  const cursor = myColl.find(query, options).sort(sort);
  let mongoWars = await cursor.toArray();
  await cursor.close();

  let arrDescription = [];
  await Promise.all(mongoWars.map(async (mongoWar, index) => {
    arrDescription[index] = `${await fGetWars.createDescription(client.clientMongo, mongoWar, iLeague, 'multi')}`;
  }));

  let description1 = '';
  let description2 = '';
  let description3 = '';
  arrDescription.forEach(function(value, index) {
    if (index < 6) {
      description1 += value;
    }
    else if (index < 12) {
      description2 += value;
    }
    else if (index < 18) {
      description3 += value;
    };
  });

  let title = `${config.league[iLeague]}  |  ${schedule.week['w' + iWeek]}`;
  await interaction.followUp({
    embeds: [
      new EmbedBuilder()
        .setTitle(title)
        .setDescription(description1)
        .setColor(config.color[iLeague])
        .setFooter({ text: config.footer, iconURL: config.urlImage.jwc })
    ]
  });
  if (description2 != '') {
    await interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description2)
          .setColor(config.color[iLeague])
          .setFooter({ text: config.footer, iconURL: config.urlImage.jwc })
      ]
    })
  };
  if (description3 != '') {
    await interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description3)
          .setColor(config.color[iLeague])
          .setFooter({ text: config.footer, iconURL: config.urlImage.jwc })
      ]
    })
  };

  return;
};


async function warLive(interaction, client) {
  const query = { season: config.season.j1, $or: [{ 'clan_war.state': 'inWar' }, { 'result.state': 'inWar' }] };
  const options = { projection: { _id: 0, league: 1, week: 1, match: 1, result: 1, clan_abbr: 1, opponent_abbr: 1, name_match: 1, clan_war: 1 } };
  const sort = { 'league': 1, 'week': 1, 'match': 1 };
  const cursor = client.clientMongo.db('jwc').collection('wars').find(query, options).sort(sort);
  let mongoWars = await cursor.toArray();
  await cursor.close();

  let numLive = 0;
  let description = '';
  let arrDescription = [];
  await Promise.all(mongoWars.map(async (mongoWar, index) => {
    //if (mongoWar.clan_war.state == 'inWar' || mongoWar.result.state == 'inWar') {
    numLive += 1;
    arrDescription[index] = await fGetWars.createDescriptionLive(client.clientMongo, mongoWar);
    //};
  }));

  if (numLive == 0) {
    description = '_no war now_';
  }
  else {
    arrDescription.forEach(function(value) {
      description += value;
    });
  };

  await interaction.followUp({
    embeds: [
      new EmbedBuilder()
        .setTitle(`:arrow_forward: **LIVE!!**`)
        .setDescription(description)
        .setColor(config.color.main)
        .setFooter({ text: config.footer, iconURL: config.urlImage.jwc })
        .setTimestamp()
    ]
  });

  return;
};


async function warSingle(interaction, client) {
  const iLeague = await interaction.options.getString('league');
  let iWeek = await interaction.options.getInteger('week');
  const iMatch = await interaction.options.getInteger('match');

  if (iWeek == null || iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  };

  let mongoWar = await client.clientMongo.db('jwc').collection('wars')
    .findOne({ season: config.season[iLeague], league: iLeague, week: iWeek, match: iMatch });
  await fGetWars.sendWarStats(interaction, client.clientMongo, iLeague, mongoWar);

  return;
};


async function warOwn(interaction, client) {
  let flagFind = 0;
  let league = '';
  let week = '';
  let match = '';
  let mongoWar = null;
  let clanAbbr = '';

  [flagFind, match, league] = await getMatch(interaction, 'j1');
  if (flagFind == 0) {
    [flagFind, match, league] = await getMatch(interaction, 'j2');
  };
  if (flagFind == 0) {
    [flagFind, match, league] = await getMatch(interaction, 'swiss');
  };
  if (flagFind == 0) {
    [flagFind, match, league] = await getMatch(interaction, 'mix');
  };
  if (flagFind == 0) {
    [flagFind, match, league] = await getMatch(interaction, 'five');
  };

  if (flagFind != 0) {
    week = await functions.getWeekNow(league);
    mongoWar = await client.clientMongo.db('jwc').collection('wars')
      .findOne({ season: config.season[league], league: league, week: week, match: match });
  };

  if (flagFind == 0) { // local log channel
    const mongoClan = await client.clientMongo.db('jwc').collection('clans')
      .findOne({ 'log.main.channel_id': interaction.channelId });
    if (mongoClan) {
      clanAbbr = mongoClan.clan_abbr;
      league = mongoClan.league;
      week = await functions.getWeekNow(league);
      mongoWar = await client.clientMongo.db('jwc').collection('wars')
        .findOne({ season: config.season[league], league: league, week: week, clan_abbr: clanAbbr });
      if (!mongoWar) {
        mongoWar = await client.clientMongo.db('jwc').collection('wars')
          .findOne({ season: config.season[league], league: league, week: week, opponent_abbr: clanAbbr });
      }
      flagFind = 1;
    };
  };

  if (flagFind == 0) { // nego channel
    mongoWar = await client.clientMongo.db('jwc').collection('wars')
      .findOne({ nego_channel: interaction.channelId });
    if (mongoWar != null) {
      flagFind = 1;
    };
  };

  if (flagFind == 0) {
    let myContent = '';
    myContent += '*You can use this command at attack log channnels in JWC BOT server.*\n';
    myContent += 'https://discord.gg/J9pN36evmW\n';
    myContent += '\n';
    myContent += '*or your registered log channnel in your team server*\n';
    await interaction.followUp({ content: myContent });
    return;
  };

  await fGetWars.sendWarStats(interaction, client.clientMongo, mongoWar.league, mongoWar);

  return;
};

async function getMatch(interaction, league) {
  let flagFind = 0;
  let match = 0;
  for (let key in config.attacklogch[league]) {
    if (interaction.channelId == config.attacklogch[league][key]) {
      flagFind = 1;
      match = Number(key.slice(1));
      return [flagFind, match, league];
    };
  };
  return [flagFind, match, league];
};


async function warAttacks(interaction, client) {
  const iLeague = await interaction.options.getString('league');
  const iClan = await interaction.options.getString('team');
  let clanAbbr = iClan.toLowerCase();
  let iWeek = await interaction.options.getInteger('week');

  if (iWeek == null || iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  };

  let mongoClan = await client.clientMongo.db('jwc').collection('clans').findOne(
    { clan_abbr: clanAbbr },
    { projection: { team_name: 1, _id: 0 } }
  );
  const teamName = mongoClan?.team_name || iClan.toUpperCase();

  const query = {
    season: config.season[iLeague],
    league: iLeague,
    week: iWeek,
    $or: [
      { clan_abbr: clanAbbr },
      { opponent_abbr: clanAbbr }
    ]
  };
  const projection = { _id: 0, clan_abbr: 1, opponent_abbr: 1, result: 1 };
  const options = { projection: projection };
  const mongoWar = await client.clientMongo.db('jwc').collection('wars').findOne(query, options);

  if (!mongoWar) {
    await interaction.followUp({ content: '*ERROR*' });
    return;
  }

  let clanAbbrOpp = '';
  let arrAttacks = {};
  let action = '';

  if (mongoWar.clan_abbr == clanAbbr) {
    action = 'attack';
    clanAbbrOpp = mongoWar.opponent_abbr;
    arrAttacks = mongoWar.result.arrAttacksPlus;
  }
  else if (mongoWar.opponent_abbr == clanAbbr) {
    action = 'defense';
    clanAbbrOpp = mongoWar.clan_abbr;
    arrAttacks = mongoWar.result.arrAttacksPlus;
  };

  let teamNameOpp = '';
  if (clanAbbrOpp) {
    const mongoClanOpp = await client.clientMongo.db('jwc').collection('clans')
      .findOne({ clan_abbr: clanAbbrOpp });
    teamNameOpp = mongoClanOpp?.team_name || clanAbbrOpp.toUpperCase();
  };

  let arrDescription = ['', '', '', '', ''];
  let footerText = '';
  let counter = 0;
  if (arrAttacks && clanAbbrOpp) {
    await Promise.all(arrAttacks.map(async (attack) => {
      if (attack.action == action) {
        let countEquip = null;
        if (attack.equipment) {
          countEquip = await functions.countHeroEquipment(attack.equipment);
        };
        let description = '';
        description += `${counter + 1}. `;
        if (attack.attackType == 'remaining') {
          description += `${config.emote.sword} ${config.emote.thn[attack.townHallLevel]} ${functions.nameReplacer(attack.name)}`;
          if (attack.pilotName) {
            description += ` | ${attack.pilotName}`;
          };
          description += `\n`;
        }
        else {
          let stars = [];
          for (j = 0; j < 3; j++) {
            if (attack.arrStarsFlag[j] == 2) {
              stars[j] = config.emote.star;
            }
            else if (attack.arrStarsFlag[j] == 1) {
              stars[j] = config.emote.starShaded;
            }
            else if (attack.arrStarsFlag[j] == 0) {
              stars[j] = config.emote.starGray;
            }
            else if (attack.arrStarsFlag[j] == 3) {
              stars[j] = config.emote.starRed;
            };
          };
          let time = attack.unixTime == null ? '' : `<t:${attack.unixTime}:t> `;
          if (iLeague == 'five') {
            time = '';
          };
          description += `${time}${stars[0]}${stars[1]}${stars[2]} **${attack.destruction}%**`;
          if (countEquip && countEquip.epic > 0) {
            description += ` _E${countEquip.epic}_`;
          }
          description += `\n`;
          description += `${config.emote.thn[attack.townHallLevel]} ${functions.nameReplacer(attack.name)}`;
          if (attack.pilotName) {
            description += ` | ${attack.pilotName}`;
          };
          description += `\n`;
          description += `\n`;
        };
        if (counter < 20) {
          arrDescription[0] += description;
        }
        else if (counter < 40) {
          arrDescription[1] += description;
        }
        else if (counter < 60) {
          arrDescription[2] += description;
        }
        else if (counter < 80) {
          arrDescription[3] += description;
        }
        else if (counter < 100) {
          arrDescription[4] += description;
        };
        counter += 1;
      };
    }));
    footerText = `${config.footer} ${config.league[iLeague]} ${'W' + iWeek} | vs ${teamNameOpp}`;
  }
  else {
    arrDescription[0] = '*no attack*';
    footerText = `${config.footer} ${config.league[iLeague]} ${'W' + iWeek}`;
  };

  const title = arrDescription[0] ? `${config.emote.sword} **ATTACKS**` : 'ERROR';
  const description = arrDescription[0] ? arrDescription.filter(Boolean) : ['*no attack*'];

  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setColor(config.color[iLeague]);
  embed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });
  embed.setAuthor({ name: teamName, iconURL: mongoClan?.logo_url });

  for (const desc of description) {
    embed.setDescription(desc);
    await interaction.followUp({ embeds: [embed] });
  };

  return;
};


async function warDefenses(interaction, client) {
  const iLeague = await interaction.options.getString('league');
  const iClan = await interaction.options.getString('team');
  let clanAbbr = iClan.toLowerCase();
  let iWeek = await interaction.options.getInteger('week');

  if (iWeek == null || iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  };

  let mongoClan = await client.clientMongo.db('jwc').collection('clans').findOne(
    { clan_abbr: clanAbbr },
    { projection: { team_name: 1, _id: 0 } }
  );
  const teamName = mongoClan?.team_name || iClan.toUpperCase();

  const query = {
    season: config.season[iLeague],
    league: iLeague,
    week: iWeek,
    $or: [
      { clan_abbr: clanAbbr },
      { opponent_abbr: clanAbbr }
    ]
  };
  const projection = { _id: 0, clan_abbr: 1, opponent_abbr: 1, clan_war: 1, opponent_war: 1, result: 1 };
  const options = { projection: projection };
  const mongoWar = await client.clientMongo.db('jwc').collection('wars').findOne(query, options);

  let clanAbbrOpp = '';
  let arrAttacks = {};
  let members = {};

  if (mongoWar?.clan_abbr == clanAbbr) {
    clanAbbrOpp = mongoWar.opponent_abbr;
    arrAttacks = mongoWar.result.arrAttacksPlus;
    members = mongoWar.clan_war?.clan?.members || [];
  }
  else if (mongoWar?.opponent_abbr == clanAbbr) {
    clanAbbrOpp = mongoWar.clan_abbr;
    arrAttacks = mongoWar.result.arrAttacksPlus;
    members = mongoWar.opponent_war?.clan?.members || [];
  };

  let teamNameOpp = '';
  if (clanAbbrOpp) {
    const mongoClanOpp = await client.clientMongo.db('jwc').collection('clans')
      .findOne({ clan_abbr: clanAbbrOpp });
    teamNameOpp = mongoClanOpp?.team_name || clanAbbrOpp.toUpperCase();
  };

  let arrDescription = ['', '', '', '', ''];
  let footerText = '';

  if (arrAttacks && clanAbbrOpp && Array.isArray(members) && members.length > 0) {
    members.sort((a, b) => a.mapPosition - b.mapPosition);

    let membersTag = [];
    members.map(async (value, index) => {
      membersTag[index] = value.tag;
    });

    let arrAttacksPlus = [];
    arrAttacks.map(async (value) => {
      let clanWarAttack = value;
      clanWarAttack['mapPositionDef'] = 0;
      membersTag.forEach(function(elem, index) {
        if (value.defenderTag == elem) {
          clanWarAttack['mapPositionDef'] = index + 1;
        };
      });
      arrAttacksPlus.push(clanWarAttack);
    });

    arrAttacksPlus.sort((a, b) => a.mapPositionDef - b.mapPositionDef);
    //console.dir(arrAttacksPlus);

    let namePlayerDef = '';
    arrAttacksPlus.map(async (attack) => {
      if (attack.mapPositionDef > 0) {
        let description = '';
        if (namePlayerDef != attack.namePlayerDef) {
          namePlayerDef = attack.namePlayerDef;
          description += `\n`;
          description += `${config.emote.thn[attack.townHallLevel]} ${attack.mapPositionDef}. `;
          description += `${functions.nameReplacer(namePlayerDef)}\n`;
        };
        let stars = [];
        for (j = 0; j < 3; j++) {
          if (attack.arrStarsFlag[j] == 2) {
            stars[j] = config.emote.star;
          }
          else if (attack.arrStarsFlag[j] == 1) {
            stars[j] = config.emote.starShaded;
          }
          else if (attack.arrStarsFlag[j] == 0) {
            stars[j] = config.emote.starGray;
          }
          else if (attack.arrStarsFlag[j] == 3) {
            stars[j] = config.emote.starRed;
          };
        };
        description += `${stars[0]}${stars[1]}${stars[2]}  **${attack.destruction}%**`;
        if (attack.arrStarsFlag[2] > 0) {
          description += ` :boom:`;
        }
        else if (attack.attackType != 'fresh' && attack.arrStarsFlag[2] == 0) {
          description += ` ${config.emote.shield}`;
        };
        description += `\n`;
        if (attack.mapPositionDef <= 10) {
          arrDescription[0] += description;
        }
        else if (attack.mapPositionDef <= 20) {
          arrDescription[1] += description;
        }
        else if (attack.mapPositionDef <= 30) {
          arrDescription[2] += description;
        }
        else if (attack.mapPositionDef <= 40) {
          arrDescription[3] += description;
        }
        else if (attack.mapPositionDef <= 50) {
          arrDescription[4] += description;
        };
      };
    });
    footerText = `${config.footer} ${config.league[iLeague]} ${'W' + iWeek} | vs ${teamNameOpp}`;
  }
  else {
    arrDescription[0] = '*no defense*';
    footerText = `${config.footer} ${config.league[iLeague]} ${'W' + iWeek}`;
  };

  const title = arrDescription[0] ? `${config.emote.shield} **DEFENSES**` : 'ERROR';
  const description = arrDescription[0] ? arrDescription.filter(Boolean) : ['*no defense*'];

  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setColor(config.color[iLeague]);
  embed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });
  embed.setAuthor({ name: teamName, iconURL: mongoClan?.logo_url });

  for (const desc of description) {
    embed.setDescription(desc);
    await interaction.followUp({ embeds: [embed] });
  };

  return;
};


async function warLineupMain(interaction, client) {
  let embed = new EmbedBuilder();
  try {
    const iLeague = await interaction.options.getString('league');
    let iWeek = await interaction.options.getInteger('week');
    const iMatch = await interaction.options.getInteger('match');

    if (iWeek == null || iWeek == 99) {
      iWeek = await functions.getWeekNow(iLeague);
    };

    embed.setTitle('**LINEUP**');
    embed.setColor(config.color[iLeague]);

    let mongoWar = await client.clientMongo.db('jwc').collection('wars')
      .findOne({ season: config.season[iLeague], league: iLeague, week: iWeek, match: iMatch });

    if (!mongoWar?.clan_war?.clan?.members || !mongoWar?.opponent_war?.clan?.members) {
      embed.setDescription(`*no lineup*`);
      await interaction.followUp({ embeds: [embed] });
      return;
    };

    let teamAbbr_A = mongoWar.clan_abbr;
    let teamAbbr_B = mongoWar.opponent_abbr;
    let members_A = mongoWar.clan_war.clan.members;
    let members_B = mongoWar.opponent_war.clan.members;
    let mongoTeam_A = await client.clientMongo.db('jwc').collection('clans').findOne({ clan_abbr: teamAbbr_A });
    let mongoTeam_B = await client.clientMongo.db('jwc').collection('clans').findOne({ clan_abbr: teamAbbr_B });

    if (!mongoTeam_A || !mongoTeam_B) {
      embed.setDescription(`*no lineup*`);
      await interaction.followUp({ embeds: [embed] });
      return;
    };

    embed = await sendLineup(client, embed, iLeague, iWeek, mongoTeam_A, mongoTeam_B, members_A);
    await interaction.followUp({ embeds: [embed] });
    embed = await sendLineup(client, embed, iLeague, iWeek, mongoTeam_B, mongoTeam_A, members_B);
    await interaction.followUp({ embeds: [embed] });
  }
  catch (err) {
    embed.setDescription(`*no lineup*`);
    await interaction.followUp({ embeds: [embed] });
    return;
  };

  return;
};

async function sendLineup(client, embed, iLeague, iWeek, mongoTeam, mongoTeamOpp, members) {
  let leagueM = iLeague;
  if (iLeague == 'j1' || leagueM == 'j2') {
    leagueM = 'j';
  };

  embed.setAuthor({ name: mongoTeam.team_name, iconURL: mongoTeam.logo_url });

  let arrDescription = [];
  let description = '';

  await Promise.all(members.map(async (member) => {
    let tag = member.tag;
    let name = String(member.name).replace(/\*/g, '\\*').replace(/_/g, '\\_');

    let flagRostered = ':question:';
    let query = { tag: tag };
    const mongoAcc = await client.clientMongo.db('jwc').collection('accounts').findOne(query);
    if (mongoAcc != null) {
      if (mongoAcc.status == true && mongoAcc.homeClanAbbr[leagueM] == mongoTeam.clan_abbr) {
        flagRostered = ':white_check_mark:';
      }
      else {
        flagRostered = ':x:';
      };
    }
    else {
      flagRostered = ':x:';
    };

    arrDescription[member.mapPosition] = `${member.mapPosition}. ${flagRostered} ${config.emote.thn[member.townHallLevel]}`;
    if (flagRostered == ':x:') {
      arrDescription[member.mapPosition] += ` **${name}**\n`;
    }
    else {
      arrDescription[member.mapPosition] += ` **${name}**  |  ${mongoAcc.pilotName[leagueM]}\n`;
    };
  }));

  arrDescription.forEach(function(value, index) {
    if (index > 0) {
      description += value;
    };
  });

  embed.setDescription(description);

  footerText = `${config.footer} ${config.league[iLeague]} W${iWeek} | vs ${mongoTeamOpp.team_name}`;
  embed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });

  return embed;
};
