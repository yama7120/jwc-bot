import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import config from '../../config/config.js';
import * as functions from '../../functions/functions.js';
import schedule from '../../config/schedule.js';
import * as fCanvas from '../../functions/fCanvas.js';


const nameCommand = 'stats';
let data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription('no description')
  .addSubcommand(subcommand =>
    subcommand
      .setName('account')
      .setDescription(config.command[nameCommand].subCommand['account'])
      .addStringOption(option =>
        option
          .setName('league')
          .setDescription('リーグ')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('team')
          .setDescription('チーム')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('account')
          .setDescription('アカウント')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('season')
          .setDescription('シーズン（選択なしの場合は今シーズン）')
          .addChoices(
            { name: '昨シーズン', value: 'last' },
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('team')
      .setDescription(config.command[nameCommand].subCommand['team'])
      .addStringOption(option =>
        option
          .setName('league')
          .setDescription('リーグ')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('team')
          .setDescription('チーム')
          .setRequired(true)
          .setAutocomplete(true)
      )
    /*.addIntegerOption(option =>
      option
        .setName('week')
        .setDescription('対戦週（選択なしの場合は全期間）')
    )*/
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('league')
      .setDescription(config.command[nameCommand].subCommand['league'])
      .addStringOption(option =>
        option
          .setName('league')
          .setDescription('リーグ')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('week')
          .setDescription('対戦週（選択なしの場合は全期間）')
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('player')
      .setDescription(config.command[nameCommand].subCommand['player'])
      .addUserOption(option =>
        option
          .setName('player_dc')
          .setDescription('使用者の discord アカウント（自分の場合入力不要）')
      )
      .addStringOption(option =>
        option
          .setName('defenses')
          .setDescription('防衛成績')
          .addChoices(
            { name: '表示', value: 'true' },
          )
      )
  );
config.choices.league5.forEach(choice => {
  data.options[0].options[0].addChoices(choice);
  data.options[1].options[0].addChoices(choice);
  data.options[2].options[0].addChoices(choice);
});
config.choices.weekInt.forEach(choice => {
  //data.options[1].options[2].addChoices(choice);
  data.options[2].options[1].addChoices(choice);
});

export default {
  data: data,

  async autocomplete(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    let focusedOption = interaction.options.getFocused(true);
    let focusedValue = interaction.options.getFocused();
    let iLeague = await interaction.options.getString('league');

    if (focusedOption.name === 'team') {
      const focusedValue = interaction.options.getFocused();
      const iLeague = await interaction.options.getString('league');
      let teamList = await client.clientMongo.db('jwc').collection('config').findOne({ _id: 'teamList' });

      teamList = teamList[iLeague].filter(function(team) { return team.team_abbr.includes(focusedValue) });
      if (teamList.length >= 25) {
        teamList = teamList.filter(function(team, index) { return index < 25 });
      };
      await interaction.respond(teamList.map(team => (
        { name: `${team.team_abbr.toUpperCase()}: ${team.team_name.replace(/\\/g, '')}`, value: team.team_abbr }
      )));
    }
    else if (focusedOption.name === 'account') {
      let clanAbbr = await interaction.options.getString('team');
      let query = {};
      if (iLeague == 'j1' || iLeague == 'j2') {
        query = { 'homeClanAbbr.j': clanAbbr };
      }
      else if (iLeague == 'swiss') {
        query = { 'homeClanAbbr.swiss': clanAbbr };
      }
      else if (iLeague == 'mix') {
        query = { 'homeClanAbbr.mix': clanAbbr };
      }
      else if (iLeague == 'five') {
        query = { 'homeClanAbbr.five': clanAbbr };
      };
      const options = { projection: { stats: 0, attacks: 0, defenses: 0, legend: 0, stats_last_season: 0, lvHeroEquipment: 0 } };
      const sort = { townHallLevel: -1, name: 1 };
      const cursor = client.clientMongo.db('jwc').collection('accounts').find(query, options).sort(sort);
      let accs = await cursor.toArray();
      await cursor.close();
      accs = accs.filter(function(acc) { return acc.name.includes(focusedValue) });
      if (accs.length >= 25) {
        accs = accs.filter(function(acc, index) { return index < 25 });
      };
      if (accs.length > 0) {
        await interaction.respond(accs.map(acc => ({
          name: `${acc.tag} (${acc.name}, TH${acc.townHallLevel})`,
          value: acc.tag
        })));
      };
    };
  },

  async execute(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand == 'account') {
      statsAccount(interaction, client);
    }
    else if (subcommand == 'team') {
      statsTeam(interaction, client);
    }
    else if (subcommand == 'league') {
      statsLeague(interaction, client);
    }
    else if (subcommand == 'player') {
      statsPlayer(interaction, client);
    };
  }
};


async function statsAccount(interaction, client) {
  const iLeague = await interaction.options.getString('league');
  let iPlayerTag = await interaction.options.getString('account');
  if (iPlayerTag.includes('#') == false) {
    iPlayerTag = '#' + iPlayerTag;
  };
  let urlPlayer = `https://link.clashofclans.com/jp?action=OpenPlayerProfile&tag=${iPlayerTag.slice(1)}`;
  let iSeason = await interaction.options.getString('season');

  let dbValuePlayer = await client.clientMongo.db('jwc').collection('accounts')
    .findOne({ tag: iPlayerTag });

  let season = null;
  let stats = null;
  if (iSeason == 'last') {
    season = config.seasonLast[iLeague];
    stats = dbValuePlayer.lastSeason[config.leagueM[iLeague]].stats;
  }
  else {
    season = config.season[iLeague];
    stats = dbValuePlayer.stats[iLeague];
  };

  let embed = new EmbedBuilder();

  // ********** attacks **********
  let myTitle = `${config.emote.sword} **ATTACKS**`;
  let myDescription = '';
  myDescription += `\n`;
  myDescription += `${config.emote.thn[dbValuePlayer.townHallLevel]} [__${iPlayerTag}__](${urlPlayer}) ${dbValuePlayer.name.replace(/\*/g, '\\*').replace(/_/g, '\\_')}\n`;
  if (iLeague == 'j1' || iLeague == 'j2') {
    myDescription += `${dbValuePlayer.homeClanAbbr.j.toUpperCase()}  ${config.leaguePlusEmote[iLeague]}\n`;
  }
  else {
    myDescription += `${dbValuePlayer.homeClanAbbr[iLeague].toUpperCase()}  ${config.leaguePlusEmote[iLeague]}\n`;
  };
  myDescription += `\n`;

  let attacks = dbValuePlayer.attacks;

  if (attacks == null) {
    myDescription += '*no attack*';
  }
  else {
    attacks.sort((a, b) => a.order - b.order);
    attacks.sort((a, b) => a.week - b.week);
    let arrDescriptionAttacks = [];
    await Promise.all(dbValuePlayer.attacks.map(async (attack, index) => {
      if (attack.league == iLeague && Number(attack.season) === Number(season)) {
        arrDescriptionAttacks[index] = '';
        if (attack.attackType == 'remaining') {
          //arrDescriptionAttacks[index] += `w${attack.week} `;
          //arrDescriptionAttacks[index] += `${config.emote.sword}`;
        }
        else {
          arrDescriptionAttacks[index] += `w${attack.week} `;
          let stars = [];
          for (let i = 0; i < 3; i++) {
            if (attack.arrStarsFlag[i] == 3) {
              stars[i] = config.emote.starRed;
            }
            else if (attack.arrStarsFlag[i] == 2) {
              stars[i] = config.emote.star;
            }
            else if (attack.arrStarsFlag[i] == 1) {
              stars[i] = config.emote.starShaded;
            }
            else if (attack.arrStarsFlag[i] == 0) {
              stars[i] = config.emote.starGray;
            };
          };
          arrDescriptionAttacks[index] += `${stars[0]}${stars[1]}${stars[2]}  **${attack.destruction}%**  `;
          let left = 180 - attack.duration;
          arrDescriptionAttacks[index] += `  _${left}″ left_`;
          if (attack.destruction == 100) {
            arrDescriptionAttacks[index] += '  :boom:';
          };
          arrDescriptionAttacks[index] += '\n';
        };
      };
    }));
    arrDescriptionAttacks.forEach(function(value) {
      myDescription += value;
    });
    if (arrDescriptionAttacks.length == 0) {
      myDescription += '*no attack*\n';
    }
    else {
      if (stats != null) {
        if (stats.attacks.fresh.nAttacks > 0) {
          myDescription += `:small_blue_diamond:`;
          myDescription += ` **${stats.attacks.fresh.nTriples}**`;
          myDescription += `/${stats.attacks.fresh.nAttacks}`;
          myDescription += `  ( **${stats.attacks.fresh.rate}**% )`;
          myDescription += `\n`;
        };
        if (stats.attacks.cleanup.nAttacks > 0) {
          myDescription += `:small_orange_diamond:`;
          myDescription += ` **${stats.attacks.cleanup.nTriples}**`;
          myDescription += `/${stats.attacks.cleanup.nAttacks}`;
          myDescription += `  ( **${stats.attacks.cleanup.rate}**% )`;
          myDescription += `\n`;
        };
        if (stats.attacks.overkill.nAttacks > 0) {
          myDescription += `:small_red_triangle:`;
          myDescription += ` **${stats.attacks.overkill.nTriples}**`;
          myDescription += `/${stats.attacks.overkill.nAttacks}`;
          myDescription += `  ( **${stats.attacks.overkill.rate}**% )`;
          myDescription += `\n`;
        };
        if (stats.attacks.total.nAttacks > 0) {
          myDescription += `${config.emote.sword} `;
          myDescription += ` **${stats.attacks.total.nTriples}**`;
          myDescription += `/${stats.attacks.total.nAttacks}`;
          myDescription += `  ( **${stats.attacks.total.rate}**% )\n`;
        };
      };
    };
    myDescription += `\n`;
  };

  let footer = `${config.footer} ${config.league[iLeague]} SEASON ${season}`;

  embed.setTitle(myTitle);
  embed.setDescription(myDescription);
  embed.setColor(config.color[iLeague]);
  embed.setFooter({ text: footer, iconURL: config.urlImage.jwc });

  if (dbValuePlayer.pilotDC != null && dbValuePlayer.pilotDC != 'no discord acc') {
    if (dbValuePlayer.pilotDC.username != null && dbValuePlayer.pilotDC.avatarUrl != null) {
      embed.setAuthor({ name: dbValuePlayer.pilotDC.username, iconURL: dbValuePlayer.pilotDC.avatarUrl });
    };
  };

  await interaction.followUp({ embeds: [embed] });
  // ********** attacks **********

  // ********** defenses **********
  myTitle = `${config.emote.shield} **DEFENSES**`;
  myDescription = '';
  let defenses = dbValuePlayer.defenses;
  if (defenses == null) {
    myDescription += '*no defense*';
  }
  else {
    defenses.sort((a, b) => a.order - b.order);
    defenses.sort((a, b) => a.week - b.week);
    let arrDescriptionDefenses = [];
    await Promise.all(dbValuePlayer.defenses.map(async (defense, index) => {
      if (defense.league == iLeague && defense.season == season) {
        arrDescriptionDefenses[index] = '';
        arrDescriptionDefenses[index] += `w${defense.week} `;
        let stars = [];
        for (let i = 0; i < 3; i++) {
          if (defense.arrStarsFlag[i] == 3) {
            stars[i] = config.emote.starRed;
          }
          else if (defense.arrStarsFlag[i] == 2) {
            stars[i] = config.emote.star;
          }
          else if (defense.arrStarsFlag[i] == 1) {
            stars[i] = config.emote.starShaded;
          }
          else if (defense.arrStarsFlag[i] == 0) {
            stars[i] = config.emote.starGray;
          };
        };
        arrDescriptionDefenses[index] += `${stars[0]}${stars[1]}${stars[2]}  **${defense.destruction}%**  `;
        let left = 180 - defense.duration;
        arrDescriptionDefenses[index] += `  _${left}″ left_`;
        if (defense.destruction == 100) {
          arrDescriptionDefenses[index] += '  :boom:';
        };
        arrDescriptionDefenses[index] += '\n';
      };
    }));
    arrDescriptionDefenses.forEach(function(value) {
      myDescription += value;
    });
    if (arrDescriptionDefenses.length == 0) {
      myDescription += '*no defense*\n';
    }
    else {
      if (stats != null) {
        if (stats.defenses.fresh.nDefenses > 0) {
          myDescription += `:small_blue_diamond:`;
          myDescription += ` **${stats.defenses.fresh.nSucDefenses}**`;
          myDescription += `/${stats.defenses.fresh.nDefenses}`;
          myDescription += `  ( **${stats.defenses.fresh.rate}**% )`;
          myDescription += `\n`;
        };
        if (stats.defenses.cleanup.nDefenses > 0) {
          myDescription += `:small_orange_diamond:`;
          myDescription += ` **${stats.defenses.cleanup.nSucDefenses}**`;
          myDescription += `/${stats.defenses.cleanup.nDefenses}`;
          myDescription += `  ( **${stats.defenses.cleanup.rate}**% )`;
          myDescription += `\n`;
        };
        if (stats.defenses.overkill.nDefenses > 0) {
          myDescription += `:small_red_triangle:`;
          myDescription += ` **${stats.defenses.overkill.nSucDefenses}**`;
          myDescription += `/${stats.defenses.overkill.nDefenses}`;
          myDescription += `  ( **${stats.defenses.overkill.rate}**% )`;
          myDescription += `\n`;
        };
        if (stats.defenses.total.nAttacks > 0) {
          myDescription += `${config.emote.shield}`;
          myDescription += ` **${stats.defenses.total.nSucDefenses}**`;
          myDescription += `/${stats.defenses.total.nDefenses}`;
          myDescription += `  ( **${stats.defenses.total.rate}**% )\n`;
        };
      };
    };
    myDescription += `\n`;
  };

  embed.setTitle(myTitle);
  embed.setDescription(myDescription);
  embed.setColor(config.color[iLeague]);

  await interaction.followUp({ embeds: [embed] });
  // ********** defenses **********

  return;
};


async function statsTeam(interaction, client) {
  const iLeague = await interaction.options.getString('league');
  const iClanAbbr = await interaction.options.getString('team');
  let clanAbbr = iClanAbbr.toLowerCase();
  /*
  let iWeek = await interaction.options.getInteger('week');
  if (iWeek == 99) {
    iWeek = await functions.getWeekNow(client.clientMongo, iLeague);
  };
  let week = `w${iWeek}`;
  if (iWeek == null) {
    week = `sum`;
  };
  */
  let week = `sum`;

  let mongoTeam = await client.clientMongo.db('jwc').collection('clans').findOne({ clan_abbr: clanAbbr });

  let title = `**TEAM STATS**`;
  let description = '';
  let footerText = '';
  let stats0 = mongoTeam.score[week];
  let stats = mongoTeam.score[week].clan;
  let tScore = mongoTeam.stats.tScore[week];
  let tScoreDef = mongoTeam.stats.tScoreDef[week];

  if (week == 'sum') {
    description += `**${stats0.nWin}**-${stats0.nLoss}`;
    if (stats0.nTie > 0) {
      description += `-${stats0.nTie}`;
    };
    description += `\n`;
    if (stats0.starDifference >= 0) {
      description += `${config.emote.star}+`;
    }
    else {
      description += `${config.emote.star}`;
    };
    description += `**${stats0.starDifference}**\n`;
    /*if (iLeague == 'mix') {
      if (stats0.ptDefDifference >= 0) {
        description += `${config.emote.shield}+`;
      }
      else {
        description += `${config.emote.shield}`;
      };
      description += `**${stats0.ptDefDifference}**`;
      description += `\n`;
    };*/
    description += `\n`;

    description += `* **AVERAGE**\n`;
  };

  if (iLeague == 'swiss' || iLeague == 'mix') {
    if (week == 'sum') {
      description += `${config.emote.star}**${Math.round(stats.sumStars / stats0.nWar * 10) / 10}**\n`;
    }
    else {
      description += `${config.emote.star}**${stats.stars}**\n`;
    };
  };

  description += `*${Math.round(stats.destruction * 100) / 100}%*\n`;

  if (iLeague == 'mix') {
    description += `\n`;
  };

  if (week == 'sum' && iLeague != 'mix') {
    description += `${config.emote.sword} **${Math.round(stats.allAttackTypes.hitrate.total * 10) / 10}**%`;
    description += `  ( ${stats.allAttackTypes.nTriple.total} / ${stats.allAttackTypes.nAt.total} )`;
    description += `  *T${Math.round(tScore.allAttackTypes.total * 10) / 10}*\n`;
    if (config.nHit[iLeague] == 2) {
      description += `:small_blue_diamond: **${Math.round(stats.fresh.hitrate.total * 10) / 10}**%`;
      description += `  ( ${stats.fresh.nTriple.total} / ${stats.fresh.nAt.total} )`;
      description += `  *T${Math.round(tScore.fresh.total * 10) / 10}*\n`;
      description += `:small_orange_diamond: **${Math.round(stats.cleanup.hitrate.total * 10) / 10}**%`;
      description += `  ( ${stats.cleanup.nTriple.total} / ${stats.cleanup.nAt.total} )`;
      description += `  *T${Math.round(tScore.cleanup.total * 10) / 10}*\n`;
      if (stats.overkill.nAt.total > 0) {
        description += `:small_red_triangle: **${Math.round(stats.overkill.hitrate.total * 10) / 10}**%`;
        description += `  ( ${stats.overkill.nTriple.total} / ${stats.overkill.nAt.total} )`;
        description += `  *T${Math.round(tScore.overkill.total * 10) / 10}*\n`;
      };
    };
  };

  if (iLeague == 'mix') {
    for (const lvTH of config.lvTHmix) {
      description += descriptionThTeam(week, iLeague, stats, tScore, lvTH);
    };
  }
  else if (week != 'sum') {
    let lvTH = `th${config.lvTH}`;
    description += descriptionThTeam(week, iLeague, stats, tScore, lvTH);
  };

  if (week == 'sum') {
    footerText = `${config.footer} ${config.league[iLeague]}`;
  }
  else {
    footerText = `${config.footer} ${config.league[iLeague]} | WEEK ${iWeek}`;
  };

  let embed = new EmbedBuilder()
    .setAuthor({ name: mongoTeam.team_name.replace(/\\/g, ''), iconURL: mongoTeam.logo_url })
    .setTitle(title)
    .setColor(config.color[iLeague])
    .setDescription(description)
    .setFooter({ text: footerText, iconURL: config.urlImage.jwc })
  await interaction.followUp({ embeds: [embed] });

  const mongoRanking = await client.clientMongo.db('jwc').collection('ranking').findOne({ name: 'jwcAttacks' });
  const attachment = await fCanvas.teamStats(client.clientMongo, iLeague, mongoTeam, mongoRanking);
  await interaction.followUp({ files: [attachment] });

  return;
};

function descriptionThTeam(week, league, stats, tScore, lvTH) {
  const lvTHstr = `th${lvTH}`;
  let description = '';

  description += `${config.emote.thn[lvTH]} **${Math.round(stats.allAttackTypes.hitrate[lvTHstr] * 10) / 10}**%`;
  description += `  (**${stats.allAttackTypes.nTriple[lvTHstr]}**/${stats.allAttackTypes.nAt[lvTHstr]})`;
  description += `  *T${Math.round(tScore.allAttackTypes[lvTHstr] * 10) / 10}*\n`;

  if (league == 'j1' || league == 'j2') {
    description += `:small_blue_diamond: **${Math.round(stats.fresh.hitrate[lvTHstr] * 10) / 10}**%`;
    description += `  (**${stats.fresh.nTriple[lvTHstr]}**/${stats.fresh.nAt[lvTHstr]})`;
    if (week == 'sum' && league == 'mix') {
      description += `  *T${Math.round(tScore.fresh[lvTHstr] * 10) / 10}*`;
    };
    description += '\n';

    if (stats.cleanup.nAt[lvTHstr] > 0) {
      description += `:small_orange_diamond: **${Math.round(stats.cleanup.hitrate[lvTHstr] * 10) / 10}**%`;
      description += `  (**${stats.cleanup.nTriple[lvTHstr]}**/${stats.cleanup.nAt[lvTHstr]})`;
      if (week == 'sum' && league == 'mix') {
        description += `  *T${Math.round(tScore.cleanup[lvTHstr] * 10) / 10}*`;
      };
      description += '\n';
    };

    if (stats.overkill.nAt[lvTHstr] > 0) {
      description += `:small_red_triangle: **${Math.round(stats.overkill.hitrate[lvTHstr] * 10) / 10}**%`;
      description += `  (**${stats.overkill.nTriple[lvTHstr]}**/${stats.overkill.nAt[lvTHstr]})`;
      if (week == 'sum' && league == 'mix') {
        description += `  *T${Math.round(tScore.overkill[lvTHstr] * 10) / 10}*`;
      };
      description += '\n';
    };

    description += '\n';
  };

  return description;
};


async function statsLeague(interaction, client) {
  const iLeague = await interaction.options.getString('league');
  let iWeek = await interaction.options.getInteger('week');
  if (iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  };
  let week = `w${iWeek}`;
  if (iWeek == null) {
    week = `sum`;
  };

  let mongoLeague = await client.clientMongo.db('jwc').collection('leagues').findOne({ league: iLeague });

  if (mongoLeague.stats[week] == null) {
    let text = '_no stats_';
    await interaction.followUp({ content: text });
    return;
  };

  let stats = mongoLeague.stats[week];
  let description = '';
  description += `* **Hitrate**\n`;
  if (iLeague == 'j1' || iLeague == 'j2') {
    description += `:boom: **${Math.round(stats.allAttackTypes.hitrate.total * 10) / 10}**%`;
    description += `  ( ${stats.allAttackTypes.nTriple.total} / ${stats.allAttackTypes.nAt.total} )\n`;
    description += `:small_blue_diamond: **${Math.round(stats.fresh.hitrate.total * 10) / 10}**%`;
    description += `  ( ${stats.fresh.nTriple.total} / ${stats.fresh.nAt.total} )\n`;
    description += `:small_orange_diamond: **${Math.round(stats.cleanup.hitrate.total * 10) / 10}**%`;
    description += `  ( ${stats.cleanup.nTriple.total} / ${stats.cleanup.nAt.total} )\n`;
    if (stats.overkill.nAt.total > 0) {
      description += `:small_red_triangle: **${Math.round(stats.overkill.hitrate.total * 10) / 10}**%`;
      description += `  ( ${stats.overkill.nTriple.total} / ${stats.overkill.nAt.total} )\n`;
    };
  }
  else if (iLeague == 'swiss' || iLeague == 'five') {
    description += `:boom: **${Math.round(stats.allAttackTypes.hitrate.total * 10) / 10}**%`;
    description += `  ( ${stats.allAttackTypes.nTriple.total} / ${stats.allAttackTypes.nAt.total} )\n`;
  }
  else if (iLeague == 'mix') {
    for (const lvTH of config.lvTHmix) {
      description += descriptionThLeague(stats, lvTH);
    }
  };
  description += `\n`;
  description += `* **Destruction**\n`;
  description += `*${Math.round(stats.destruction * 10) / 10}% on average*\n`;

  let title = `**LEAGUE STATS**  ${config.leaguePlusEmote[iLeague]}`;

  let footerText = `${config.footer} ${config.league[iLeague]} | ${schedule.week[week]}`;

  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setColor(config.color[iLeague]);
  embed.setDescription(description);
  embed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });
  await interaction.followUp({ embeds: [embed] });

  return;
};

function descriptionThLeague(stats, lvTH) {
  const lvTHstr = `th${lvTH}`;
  let description = '';
  description += `${config.emote.thn[lvTH]} **${Math.round(stats.allAttackTypes.hitrate[lvTHstr] * 10) / 10}**%`;
  description += `  ( ${stats.allAttackTypes.nTriple[lvTHstr]} / ${stats.allAttackTypes.nAt[lvTHstr]} )\n`;
  if (config.nHit.mix == 2) {
    description += `:small_blue_diamond: **${Math.round(stats.fresh.hitrate[lvTHstr] * 10) / 10}**%`;
    description += `  ( ${stats.fresh.nTriple[lvTHstr]} / ${stats.fresh.nAt[lvTHstr]} )\n`;
    description += `:small_orange_diamond: **${Math.round(stats.cleanup.hitrate[lvTHstr] * 10) / 10}**%`;
    description += `  ( ${stats.cleanup.nTriple[lvTHstr]} / ${stats.cleanup.nAt[lvTHstr]} )\n`;
    description += `:small_red_triangle: **${Math.round(stats.overkill.hitrate[lvTHstr] * 10) / 10}**%`;
    description += `  ( ${stats.overkill.nTriple[lvTHstr]} / ${stats.overkill.nAt[lvTHstr]} )\n`;
  };
  return description;
};


async function statsPlayer(interaction, client) {
  const iPilotDc = await interaction.options.getUser('player_dc');
  let pilotDc = {};
  if (iPilotDc == null) {
    pilotDc = interaction.user;
  }
  else {
    pilotDc = iPilotDc;
  };

  let dbValuePlayer = await client.clientMongo.db('jwc').collection('players').findOne({ 'pilotDC.id': pilotDc.id });

  if (dbValuePlayer == null) {
    await interaction.followUp({ content: '*The player is not found.*', ephemeral: true });
    return;
  }

  let stats = dbValuePlayer.stats;

  // ********** attacks **********
  let title = `${config.emote.sword} **ATTACKS**`;
  let description = '';
  if (stats.j1.attacks.total.nAttacks > 0) {
    description += `* **J1**  ${config.emote.thn[`th${config.lvTH}`]}\n`;
    description += createDescriptionAttacks(stats, 'j1');
    description += `\n`;
  }
  else if (stats.j2.attacks.total.nAttacks > 0) {
    description += `* **J2**  ${config.emote.thn[`th${config.lvTH}`]}\n`;
    description += createDescriptionAttacks(stats, 'j2');
    description += `\n`;
  };
  if (stats.swiss.attacks.total.nAttacks > 0) {
    description += `* **SWISS**  ${config.emote.thn[`th${config.lvTH}`]}\n`;
    description += createDescriptionAttacks(stats, 'swiss');
    description += `\n`;
  };
  if (stats.mix1.attacks.total.nAttacks > 0) {
    description += `* **MIX** [TH${config.lvTHmix[0]}]  ${config.emote.thn[`th${config.lvTHmix[0]}`]}\n`;
    description += createDescriptionAttacks(stats, 'mix1');
    description += `\n`;
  };
  if (stats.mix2.attacks.total.nAttacks > 0) {
    description += `* **MIX** [TH${config.lvTHmix[1]}]  ${config.emote.thn[`th${config.lvTHmix[1]}`]}\n`;
    description += createDescriptionAttacks(stats, 'mix2');
    description += `\n`;
  };
  if (stats.mix3.attacks.total.nAttacks > 0) {
    description += `* **MIX** [TH${config.lvTHmix[2]}]  ${config.emote.thn[`th${config.lvTHmix[2]}`]}\n`;
    description += createDescriptionAttacks(stats, 'mix3');
    description += `\n`;
  };
  if (stats.mix4.attacks.total.nAttacks > 0) {
    description += `* **MIX** [TH${config.lvTHmix[3]}]  ${config.emote.thn[`th${config.lvTHmix[3]}`]}\n`;
    description += createDescriptionAttacks(stats, 'mix4');
    description += `\n`;
  };
  if (stats.five.attacks.total.nAttacks > 0) {
    description += `* **5V**  ${config.emote.thn[`th${config.lvTH}`]}\n`;
    description += createDescriptionAttacks(stats, 'five');
    description += `\n`;
  };

  if (description == '') {
    description = '*No attack*';
  };

  var embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(config.color.main)
    .setFooter({ text: `${config.footer}  |  PLAYER STATS`, iconURL: config.urlImage.jwc })
    .setAuthor({ name: pilotDc.username, iconURL: dbValuePlayer.pilotDC.avatarUrl });

  await interaction.followUp({ embeds: [embed] });
  // ********** attacks **********

  const iDefenses = await interaction.options.getString('defenses');

  // ********** defenses **********
  if (iDefenses == 'true') {
    let title = `${config.emote.shield} **DEFENSES**`;
    let description = '';
    if (stats.j1.defenses.total.nDefenses > 0) {
      description += `* **J1**  ${config.emote.thn[`th${config.lvTH}`]}\n`;
      description += createDescriptionDefenses(stats, 'j1');
      description += `\n`;
    }
    else if (stats.j2.defenses.total.nDefenses > 0) {
      description += `* **J2**  ${config.emote.thn[`th${config.lvTH}`]}\n`;
      description += createDescriptionDefenses(stats, 'j2');
      description += `\n`;
    };
    if (stats.swiss.defenses.total.nDefenses > 0) {
      description += `* **SWISS**  ${config.emote.thn[`th${config.lvTH}`]}\n`;
      description += createDescriptionDefenses(stats, 'swiss');
      description += `\n`;
    };
    if (stats.mix1.defenses.total.nDefenses > 0) {
      description += `* **MIX** [TH${config.lvTHmix[0]}]  ${config.emote.thn[`th${config.lvTHmix[0]}`]}\n`;
      description += createDescriptionDefenses(stats, 'mix1');
      description += `\n`;
    };
    if (stats.mix2.defenses.total.nDefenses > 0) {
      description += `* **MIX** [TH${config.lvTHmix[1]}]  ${config.emote.thn[`th${config.lvTHmix[1]}`]}\n`;
      description += createDescriptionDefenses(stats, 'mix2');
      description += `\n`;
    };
    if (stats.mix3.defenses.total.nDefenses > 0) {
      description += `* **MIX** [TH${config.lvTHmix[2]}]  ${config.emote.thn[`th${config.lvTHmix[2]}`]}\n`;
      description += createDescriptionDefenses(stats, 'mix3');
      description += `\n`;
    };
    if (stats.mix4.defenses.total.nDefenses > 0) {
      description += `* **MIX** [TH${config.lvTHmix[3]}]  ${config.emote.thn[`th${config.lvTHmix[3]}`]}\n`;
      description += createDescriptionDefenses(stats, 'mix4');
      description += `\n`;
    };
    if (stats.five.defenses.total.nDefenses > 0) {
      description += `* **5V**  ${config.emote.thn[`th${config.lvTH}`]}\n`;
      description += createDescriptionDefenses(stats, 'five');
      description += `\n`;
    };

    if (description == '') {
      description = '*No defense*';
    };

    var embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(config.color.main)
      .setFooter({ text: `${config.footer}  |  PLAYER STATS`, iconURL: config.urlImage.jwc })
      .setAuthor({ name: pilotDc.username, iconURL: dbValuePlayer.pilotDC.avatarUrl });

    await interaction.followUp({ embeds: [embed] });
  }
  // ********** defenses **********

  //** update database: pilotDC
  var query = { 'pilotDC.id': pilotDc.id };
  pilotDc.avatarUrl = `https://cdn.discordapp.com/avatars/${pilotDc.id}/${pilotDc.avatar}.png`;
  let updatedListing = { pilotDC: pilotDc };
  await client.clientMongo.db('jwc').collection('players').updateOne(query, { $set: updatedListing });

  return;
};

function createDescriptionAttacks(stats, league) {
  let description = '';
  description += createDescriptionAttacks1(stats, ':boom:', league, 'attacks', 'total');
  if (stats[league].attacks.fresh.nAttacks > 0 && config.nHit[league] == 2) {
    description += createDescriptionAttacks1(stats, ':small_blue_diamond:', league, 'attacks', 'fresh');
  };
  if (stats[league].attacks.cleanup.nAttacks > 0) {
    description += createDescriptionAttacks1(stats, ':small_orange_diamond:', league, 'attacks', 'cleanup');
  };
  if (stats[league].attacks.overkill.nAttacks > 0) {
    description += createDescriptionAttacks1(stats, ':small_red_triangle:', league, 'attacks', 'overkill');
  };
  return description;
};

function createDescriptionAttacks1(stats, emote, league, action, type) {
  let description = '';
  description += `${emote} **${stats[league][action][type].nTriples}**/${stats[league][action][type].nAttacks}`;
  description += `  ( **${stats[league][action][type].rate}**% )`;
  description += `  *${stats[league][action][type].avrgDestruction}%*`;
  if (stats[league][action][type].avrgLeft > 0) {
    description += `  _${stats[league][action][type].avrgLeft}″ left_`;
  };
  description += `\n`;
  return description;
};

function createDescriptionDefenses(stats, league) {
  let description = '';
  description += createDescriptionDefenses1(stats, config.emote.shield, league, 'defenses', 'total');
  if (stats[league].defenses.fresh.nDefenses > 0 && config.nHit[league] == 2) {
    description += createDescriptionDefenses1(stats, ':small_blue_diamond:', league, 'defenses', 'fresh');
  };
  if (stats[league].defenses.cleanup.nDefenses > 0) {
    description += createDescriptionDefenses1(stats, ':small_orange_diamond:', league, 'defenses', 'cleanup');
  };
  if (stats[league].defenses.overkill.nDefenses > 0) {
    description += createDescriptionDefenses1(stats, ':small_red_triangle:', league, 'defenses', 'overkill');
  };
  return description;
};

function createDescriptionDefenses1(stats, emote, league, action, type) {
  let description = '';
  description += `${emote} **${stats[league][action][type].nSucDefenses}**/${stats[league][action][type].nDefenses}`;
  description += `  ( **${stats[league][action][type].rate}**% )`;
  description += `  *${stats[league][action][type].avrgDestruction}%*`;
  if (stats[league][action][type].avrgLeft > 0) {
    description += `  _${stats[league][action][type].avrgLeft}″ left_`;
  };
  description += `\n`;
  return description;
};