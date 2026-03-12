const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const config = require('../../config.js');
const config_coc = require('../../config_coc.js');
const functions = require('../../functions/functions.js');
const fRanking = require('../../functions/fRanking.js');


const nameCommand = 'ranking';
let data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription('no description')
  .addSubcommand(subcommand =>
    subcommand
      .setName('legend')
      .setDescription(config.command[nameCommand].subCommand['legend'])
      .addStringOption(option =>
        option
          .setName('item')
          .setDescription('項目')
          .setRequired(true)
          .addChoices(
            //{ name: 'Now', value: 'legendNow' },
            { name: 'Previous Day', value: 'legendPreviousDay' },
            //{ name: 'Difference', value: 'legendDifference' },
            { name: 'Previous Season Result', value: 'legendPreviousSeason' },
            { name: 'Lifetime Legend Trophies', value: 'legendTrophies' },
          )
      )
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
      .addIntegerOption(option =>
        option
          .setName('th_level')
          .setDescription('タウンホールレベル')
      )
      .addIntegerOption(option =>
        option
          .setName('n_display')
          .setDescription('表示数（ 100 以下）')
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('account_data')
      .setDescription(config.command[nameCommand].subCommand['account_data'])
      .addStringOption(option =>
        option
          .setName('item')
          .setDescription('項目')
          .setRequired(true)
          .addChoices(
            { name: 'Trophies', value: 'trophies' },
            { name: 'Attack Wins', value: 'attackWins' },
            { name: 'Lifetime War Stars', value: 'warStars' },
            { name: 'Total Hero Lv.', value: 'lvHeroes' },
            { name: 'Total Hero Equip. Lv.', value: 'equipTotal' },
            { name: 'Giant Gauntlet Lv.', value: 'equipGiantGauntlet' },
            { name: 'Spiky Ball Lv.', value: 'equipSpikyBall' },
            { name: 'Snake Bracelet Lv.', value: 'equipSnakeBracelet' },
            { name: 'Frozen Arrow Lv.', value: 'equipFrozenArrow' },
            { name: 'Magic Mirror Lv.', value: 'equipMagicMirror' },
            { name: 'Action Figure Lv.', value: 'equipActionFigure' },
            { name: 'Fireball Lv.', value: 'equipFireball' },
            { name: 'Lavaloon Puppet Lv.', value: 'equipLavaloonPuppet' },
            { name: 'Rocket Spear Lv.', value: 'equipRocketSpear' },
            { name: 'Electro Boots Lv.', value: 'equipElectroBoots' },
            { name: 'Dark Crown Lv.', value: 'equipDarkCrown' },
            { name: 'Meteor Staff Lv.', value: 'equipMeteorStaff' },
          )
      )
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
      .addIntegerOption(option =>
        option
          .setName('th_level')
          .setDescription('タウンホールレベル')
      )
      .addIntegerOption(option =>
        option
          .setName('n_display')
          .setDescription('表示数（ 100 以下）')
      )
  )
  .addSubcommandGroup(subcommandgroup =>
    subcommandgroup
      .setName('jwc')
      .setDescription('no description')
      .addSubcommand(subcommand =>
        subcommand
          .setName('attack')
          .setDescription(config.command[nameCommand].subCommandGroup['jwc']['attack'])
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
          .addIntegerOption(option =>
            option
              .setName('th_level')
              .setDescription('タウンホールレベル')
          )
          .addStringOption(option =>
            option
              .setName('attack_type')
              .setDescription('初見 / 非初見 / オーバーキル（指定なし：総合）')
          )
          .addIntegerOption(option =>
            option
              .setName('n_display')
              .setDescription('表示数（ 100 以下）')
          )
          .addStringOption(option =>
            option
              .setName('only_regular_season')
              .setDescription('プレーオフを除く')
              .addChoices(
                { name: 'TRUE', value: 'true' },
              )
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('defense')
          .setDescription(config.command[nameCommand].subCommandGroup['jwc']['defense'])
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
          .addIntegerOption(option =>
            option
              .setName('th_level')
              .setDescription('タウンホールレベル')
          )
          .addStringOption(option =>
            option
              .setName('attack_type')
              .setDescription('初見 / 非初見 / オーバーキル（指定なし：総合）')
          )
          .addIntegerOption(option =>
            option
              .setName('n_display')
              .setDescription('表示数（ 100 以下）')
          )
      )
  );
config.choices.league.forEach(choice => {
  data.options[0].options[1].addChoices(choice);
  data.options[1].options[1].addChoices(choice);
});
config.choices.league5.forEach(choice => {
  data.options[2].options[0].options[0].addChoices(choice);
  data.options[2].options[1].options[0].addChoices(choice);
});
config.choices.townHallLevelInt.forEach(choice => {
  data.options[0].options[3].addChoices(choice);
  data.options[1].options[3].addChoices(choice);
  data.options[2].options[0].options[2].addChoices(choice);
  data.options[2].options[1].options[2].addChoices(choice);
});
const choices_nDisplay = [
  { name: '10', value: 10 },
  { name: '20', value: 20 },
  { name: '50', value: 50 },
  { name: '100', value: 100 },
];
choices_nDisplay.forEach(choice => {
  data.options[0].options[4].addChoices(choice);
  data.options[1].options[4].addChoices(choice);
  data.options[2].options[0].options[4].addChoices(choice);
  data.options[2].options[1].options[4].addChoices(choice);
});
const choices_attackType = [
  { name: '初見', value: 'fresh' },
  { name: '非所見', value: 'cleanup' },
  { name: 'オーバーキル', value: 'overkill' },
];
choices_attackType.forEach(choice => {
  data.options[2].options[0].options[3].addChoices(choice);
  data.options[2].options[1].options[3].addChoices(choice);
});


module.exports = {
  data: data,

  async autocomplete(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    let focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'team') {
      const focusedValue = interaction.options.getFocused();
      const iLeague = await interaction.options.getString('league');
      const teamList = await client.clientMongo.db('jwc').collection('config').findOne({ _id: 'teamList' });
      //console.dir(teamList);

      if (iLeague == 'entire') {
        await interaction.respond([{ name: 'ENTIRE JWC BOT', value: 'entire' }]);
      }
      else {
        teams = teamList[iLeague].filter(function(team) { return team.team_abbr.includes(focusedValue) });
        if (iLeague == 'j1' || iLeague == 'j2') {
          if (subcommandGroup == 'jwc') {
            teams = [{ team_abbr: 'Entire', clan_name: config.league[iLeague], team_name: config.league[iLeague], division: '' }].concat(teams);
          }
          else {
            teams = [{ team_abbr: 'Entire', clan_name: 'J1/J2', team_name: 'J1/J2', division: '' }].concat(teams);
          };
        }
        else if (iLeague == 'swiss') {
          teams = [{ team_abbr: 'Entire', clan_name: 'SWISS', team_name: 'SWISS', division: '' }].concat(teams);
        }
        else if (iLeague == 'mix') {
          teams = [{ team_abbr: 'Entire', clan_name: 'MIX', team_name: 'MIX', division: '' }].concat(teams);
        }
        else if (iLeague == 'five') {
          teams = [{ team_abbr: 'Entire', clan_name: '5V', team_name: '5V', division: '' }].concat(teams);
        };
        if (teams.length >= 25) {
          teams = teams.filter(function(team, index) { return index < 25 });
        };
        await interaction.respond(
          teams.map(team => (
            { name: `${team.team_abbr.toUpperCase()}: ${team.clan_name} | ${team.team_name}`, value: team.team_abbr }
          )),
        );
      };
    };
  },

  async execute(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup == 'jwc') {
      if (subcommand == 'attack') {
        jwcAttack(interaction, client);
      }
      else if (subcommand == 'defense') {
        jwcDefense(interaction, client);
      };
    }
    else if (subcommand == 'legend') {
      legend(interaction, client);
    }
    else if (subcommand == 'account_data') {
      accountData(interaction, client);
    };
  }
};


async function legend(interaction, client) {
  let iItem = await interaction.options.getString('item');
  const iLeague = await interaction.options.getString('league');
  let league = iLeague;
  let leagueM = league;
  if (league == 'j1' || league == 'j2') {
    leagueM = 'j';
  };
  const iTeamAbbr = await interaction.options.getString('team');
  let teamAbbr = '';
  if (iTeamAbbr != null) {
    teamAbbr = iTeamAbbr;
  };
  let iLvTH = await interaction.options.getInteger('th_level');
  let nDisplay = await interaction.options.getInteger('n_display');
  if (nDisplay == null) {
    nDisplay = 5;
  };

  let mongoRanking = await client.clientMongo.db('jwc').collection('ranking').findOne({ name: iItem });
  let arrRanking = mongoRanking.accounts;

  let accs = [];
  let footer = '';

  if (iTeamAbbr == 'entire') {
    accs = arrRanking;
    footer = `${config.footer}`;
  }
  else if (iTeamAbbr == 'Entire') {
    if (iLvTH == null) {
      accs = arrRanking.filter(function(acc) { return acc.homeClanAbbr[leagueM] != '' });
    }
    else {
      accs = arrRanking.filter(function(acc) { return acc.homeClanAbbr[leagueM] != '' && acc.townHallLevel == iLvTH });
    };
    footer = `${config.footer}`;
  }
  else {
    if (iLvTH == null) {
      accs = arrRanking.filter(function(acc) { return acc.homeClanAbbr[leagueM] == teamAbbr });
    }
    else {
      accs = arrRanking.filter(function(acc) { return acc.homeClanAbbr[leagueM] == teamAbbr && acc.townHallLevel == iLvTH });
    };
    footer = `${config.footer}  |  ${iTeamAbbr.toUpperCase()}`;
  };
  if (accs.length == 0) {
    interaction.followUp(`*no accounts*`, { ephemeral: true });
  }

  let nAccPerPage = 50;
  let arrDescription = [];
  if (iItem == 'legendTrophies') {
    for (let [index, acc] of accs.entries()) {
      let emoteTH = config.emote.thn[acc.townHallLevel];
      let nameAcc = `**${String(acc.name).replace(/\*/g, '\\*').replace(/_/g, '\\_')}**`;
      if (iTeamAbbr == 'entire') {
        arrDescription[index] = `${index + 1}. **${acc[iItem]}**  ${emoteTH}  ${nameAcc}\n`;
      }
      else {
        let nameTeam = String(acc.homeClanAbbr[leagueM]).toUpperCase();
        if (iTeamAbbr == 'Entire') {
          arrDescription[index] = `${index + 1}. **${acc[iItem]}**  ${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}  |  ${nameTeam}\n`;
        }
        else {
          arrDescription[index] = `${index + 1}. **${acc[iItem]}**  ${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}\n`;
        };
      };
      let myIndex = nDisplay - 1;
      if (index == myIndex) break;
    };
  }
  else if (iItem == 'legendPreviousDay') {
    nAccPerPage = 25;
    for (let [index, acc] of accs.entries()) {
      let emoteTH = config.emote.thn[acc.townHallLevel];
      let nameAcc = `**${String(acc.name).replace(/\*/g, '\\*').replace(/_/g, '\\_')}**`;
      let diffTrophies = 'no data';
      diffTrophies = acc.difference;
      if (diffTrophies >= 0) {
        diffTrophies = '+' + diffTrophies;
      };
      if (iTeamAbbr == 'entire') {
        arrDescription[index] = `${index + 1}. **${acc[iItem].trophies}** [${diffTrophies}, x${acc.diffAttackWins}]`;
        arrDescription[index] += `  ${emoteTH}  ${nameAcc}\n`;
      }
      else {
        let nameTeam = String(acc.homeClanAbbr[leagueM]).toUpperCase();
        if (iTeamAbbr == 'Entire') {
          arrDescription[index] = `${index + 1}. **${acc[iItem].trophies}** [${diffTrophies}, x${acc.diffAttackWins}]`;
          arrDescription[index] += `  ${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}  |  ${nameTeam}\n`;
        }
        else {
          arrDescription[index] = `${index + 1}. **${acc[iItem].trophies}** [${diffTrophies}, x${acc.diffAttackWins}]`;
          arrDescription[index] += `  ${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}\n`;
        };
      };
      let myIndex = nDisplay - 1;
      if (index == myIndex) break;
    };
  }
  else if (iItem == 'legendDifference') {
    nAccPerPage = 25;
    for (let [index, acc] of accs.entries()) {
      let emoteTH = config.emote.thn[acc.townHallLevel];
      let nameAcc = `**${String(acc.name).replace(/\*/g, '\\*').replace(/_/g, '\\_')}**`;
      let diffTrophies = 'no data';
      diffTrophies = acc.legendDifference;
      if (diffTrophies >= 0) {
        diffTrophies = '+' + diffTrophies;
      };
      if (iTeamAbbr == 'entire') {
        arrDescription[index] = `${index + 1}. **${diffTrophies}** [*${acc.trophies}*]  ${emoteTH}  ${nameAcc}\n`;
      }
      else {
        let nameTeam = String(acc.homeClanAbbr[leagueM]).toUpperCase();
        if (iTeamAbbr == 'Entire') {
          arrDescription[index] = `${index + 1}. **${diffTrophies}** [*${acc.trophies}*]\n`;
          arrDescription[index] += `${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}  |  ${nameTeam}\n`;
        }
        else {
          arrDescription[index] = `${index + 1}. **${diffTrophies}** [*${acc.trophies}*]  ${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}\n`;
        };
      };
      let myIndex = nDisplay - 1;
      if (index == myIndex) break;
    };
  }
  else if (iItem == 'legendPreviousSeason') {
    nAccPerPage = 25;
    for (let [index, acc] of accs.entries()) {
      let emoteTH = config.emote.thn[acc.townHallLevel];
      let nameAcc = `**${String(acc.name).replace(/\*/g, '\\*').replace(/_/g, '\\_')}**`;
      if (iTeamAbbr == 'entire') {
        let rankSc = acc[iItem].rank > 200 ? acc[iItem].rank : `**${acc[iItem].rank}**`;
        let homeTeamAbbr = acc.homeClanAbbr.j == '' ? acc.homeClanAbbr.swiss : acc.homeClanAbbr.j;
        homeTeamAbbr = homeTeamAbbr == '' ? acc.homeClanAbbr.mix : homeTeamAbbr;
        let nameTeam = String(homeTeamAbbr).toUpperCase();
        if (homeTeamAbbr == '') {
          arrDescription[index] = `${index + 1}. **${acc[iItem].trophies}** :earth_asia: ${rankSc}  ${emoteTH}  ${nameAcc}\n`;
        }
        else {
          arrDescription[index] = `${index + 1}. **${acc[iItem].trophies}** :earth_asia: ${rankSc}  ${emoteTH}  ${nameAcc}  |  ${nameTeam}\n`;
        };
      }
      else {
        let rankSc = acc[iItem].rank > 200 ? acc[iItem].rank : `**${acc[iItem].rank}**`;
        let nameTeam = String(acc.homeClanAbbr[leagueM]).toUpperCase();
        if (iTeamAbbr == 'Entire') {
          arrDescription[index] = `${index + 1}. **${acc[iItem].trophies}** :earth_asia: ${rankSc}  ${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}  |  ${nameTeam}\n`;
        }
        else {
          arrDescription[index] = `${index + 1}. **${acc[iItem].trophies}** :earth_asia: ${rankSc}  ${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}\n`;
        };
      };
      let myIndex = nDisplay - 1;
      if (index == myIndex) break;
    };
  };

  let embed = new EmbedBuilder();
  embed.setFooter({ text: footer, iconURL: config.urlImage.jwc });

  let title = '';
  let description = ['', '', '', ''];

  if (iItem == 'legendPreviousDay') {
    title = `${config.emote.legend} **LEGEND [${accs[0][iItem].id}]**`;
    description[0] += `<t:${accs[0].unixTimeRequest}:F> (<t:${accs[0].unixTimeRequest}:R>)\n`;
  }
  else if (iItem == 'legendDifference') {
    title = `${config.emote.legend} **Difference**`;
    description[0] += `<t:${accs[0].unixTimeRequest}:F> (<t:${accs[0].unixTimeRequest}:R>)\n`;
  }
  else if (iItem == 'legendPreviousSeason') {
    title = `${config.emote.legend} **LEGEND [${accs[0][iItem].id}]**`;
    embed.setTimestamp();
  }
  else if (iItem == 'legendTrophies') {
    title = `${config.emote.legend} **Lifetime Legend Trophies**`;
    embed.setTimestamp();
  }
  else {
    title = '**ERROR**';
  };
  embed.setTitle(title);

  for (let i = 0; i < nDisplay; i++) {
    for (let page = 0; page < 4; page++) {
      if (nAccPerPage * page <= i && i < nAccPerPage * (page + 1)) {
        description[page] += arrDescription[i] ?? '';
        break;
      };
    };
  };

  let color = config.color.main;

  if (iTeamAbbr != 'entire') {
    color = config.color[league];
  };
  embed.setColor(color);

  description.map(async (iDescription) => {
    if (iDescription != '') {
      embed.setDescription(iDescription);
      await interaction.followUp({ embeds: [embed] });
    };
  });

  return;
};


async function accountData(interaction, client) {
  let iItem = await interaction.options.getString('item');
  const iLeague = await interaction.options.getString('league');
  let league = iLeague;
  let leagueM = league;
  if (league == 'j1' || league == 'j2') {
    leagueM = 'j';
  };
  const iTeamAbbr = await interaction.options.getString('team');
  let teamAbbr = '';
  if (iTeamAbbr != null) {
    teamAbbr = iTeamAbbr;
  };
  let iLvTH = await interaction.options.getInteger('th_level');
  let nDisplay = await interaction.options.getInteger('n_display');
  if (nDisplay == null) {
    nDisplay = 5;
  };

  let mongoRanking = await client.clientMongo.db('jwc').collection('ranking').findOne({ name: iItem });
  let arrRanking = mongoRanking.accounts;

  let accs = [];
  let footer = '';

  if (iTeamAbbr == 'entire') {
    accs = arrRanking;
    footer = `${config.footer}`;
  }
  else if (iTeamAbbr == 'Entire') {
    if (iLvTH == null) {
      accs = arrRanking.filter(function(acc) { return acc.homeClanAbbr[leagueM] != '' });
    }
    else {
      accs = arrRanking.filter(function(acc) { return acc.homeClanAbbr[leagueM] != '' && acc.townHallLevel == iLvTH });
    };
    footer = `${config.footer}`;
  }
  else {
    if (iLvTH == null) {
      accs = arrRanking.filter(function(acc) { return acc.homeClanAbbr[leagueM] == teamAbbr });
    }
    else {
      accs = arrRanking.filter(function(acc) { return acc.homeClanAbbr[leagueM] == teamAbbr && acc.townHallLevel == iLvTH });
    };
    footer = `${config.footer}  |  ${iTeamAbbr.toUpperCase()}`;
  };
  if (accs.length == 0) {
    interaction.followUp(`*no accounts*`, { ephemeral: true });
  }

  let nAccPerPage = 50;
  let arrDescription = [];
  if (iItem.includes('equip')) {
    for (let [index, acc] of accs.entries()) {
      let emoteTH = config.emote.thn[acc.townHallLevel];
      let nameAcc = `**${String(acc.name).replace(/\*/g, '\\*').replace(/_/g, '\\_')}**`;
      if (iTeamAbbr == 'entire') {
        arrDescription[index] = `${index + 1}. **${acc[iItem].level}**/${acc[iItem].maxLevel}  ${emoteTH}  ${nameAcc}\n`;
      }
      else {
        let nameTeam = String(acc.homeClanAbbr[leagueM]).toUpperCase();
        if (iTeamAbbr == 'Entire') {
          arrDescription[index] = `${index + 1}. **${acc[iItem].level}**/${acc[iItem].maxLevel}  ${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}  |  ${nameTeam}\n`;
        }
        else {
          arrDescription[index] = `${index + 1}. **${acc[iItem].level}**/${acc[iItem].maxLevel}  ${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}\n`;
        };
      };
      let myIndex = nDisplay - 1;
      if (index == myIndex) break;
    };
  }
  else if (iItem == 'trophies' || iItem == 'warStars' || iItem == 'attackWins') {
    for (let [index, acc] of accs.entries()) {
      let emoteTH = config.emote.thn[acc.townHallLevel];
      let nameAcc = `**${String(acc.name).replace(/\*/g, '\\*').replace(/_/g, '\\_')}**`;
      if (iTeamAbbr == 'entire') {
        arrDescription[index] = `${index + 1}. **${acc[iItem]}**  ${emoteTH}  ${nameAcc}\n`;
      }
      else {
        let nameTeam = String(acc.homeClanAbbr[leagueM]).toUpperCase();
        if (iTeamAbbr == 'Entire') {
          arrDescription[index] = `${index + 1}. **${acc[iItem]}**  ${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}  |  ${nameTeam}\n`;
        }
        else {
          arrDescription[index] = `${index + 1}. **${acc[iItem]}**  ${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}\n`;
        };
      };
      let myIndex = nDisplay - 1;
      if (index == myIndex) break;
    };
  }
  else if (iItem == 'lvHeroes') {
    for (let [index, acc] of accs.entries()) {
      let emoteTH = config.emote.thn[acc.townHallLevel];
      let nameAcc = `**${functions.nameReplacer(acc.name)}**`;
      if (iTeamAbbr == 'entire') {
        nAccPerPage = 20;
        arrDescription[index] = `${index + 1}. **${acc[iItem].level}**/${acc[iItem].maxLevel}  ${emoteTH}  ${nameAcc}\n`;
      }
      else {
        nAccPerPage = 15;
        let nameTeam = String(acc.homeClanAbbr[leagueM]).toUpperCase();
        if (iTeamAbbr == 'Entire') {
          arrDescription[index] = `${index + 1}. **${acc[iItem].level}**/${acc[iItem].maxLevel}  ${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}  |  ${nameTeam}\n`;
        }
        else {
          arrDescription[index] = `${index + 1}. **${acc[iItem].level}**/${acc[iItem].maxLevel}  ${emoteTH}  ${nameAcc}  |  ${acc.pilotName[leagueM]}\n`;
        };
      };
      arrDescription[index] += `${config_coc.heroes[0].emote} ${acc[iItem].BK}`;
      arrDescription[index] += ` ${config_coc.heroes[1].emote} ${acc[iItem].AQ}`;
      arrDescription[index] += ` ${config_coc.heroes[2].emote} ${acc[iItem].GW}`;
      arrDescription[index] += ` ${config_coc.heroes[3].emote} ${acc[iItem].RC}`;
      arrDescription[index] += ` ${config_coc.heroes[4].emote} ${acc[iItem].MP}`;
      arrDescription[index] += `\n`;
      arrDescription[index] += `\n`;

      let myIndex = nDisplay - 1;
      if (index == myIndex) break;
    };
  };

  let title = '';
  let description = ['', '', '', '', ''];

  //description[0] += `<t:${accs[0].unixTimeRequest}:F>\n`;

  await Promise.all(arrDescription.map((value, index) => {
    for (let i = 0; i < 5; i++) {
      if (nAccPerPage * i <= index && index < nAccPerPage * (i + 1)) {
        description[i] += value;
        break;
      };
    };
  }));

  if (iItem == 'equipTotal') {
    title = `${config.emote.jwc} **Total Hero Equipment Level**`;
  }
  else if (iItem == 'lvHeroes') {
    title = `${config.emote.jwc} **Total Hero Level**`;
  }
  else if (iItem.includes('equip')) {
    const nameEquipment = iItem.slice(5).replace(/([A-Z])/g, ' $1').trim();
    const foundEquipment = config_coc.heroEquipments.find(equipment_config => equipment_config.name == nameEquipment);
    title = `${foundEquipment.emote} **${nameEquipment} Level**`;
  }
  else if (iItem == 'trophies') {
    title = `:trophy: **Trophies**`;
  }
  else if (iItem == 'warStars') {
    title = `${config.emote.star} **Lifetime War Stars**`;
  }
  else if (iItem == 'attackWins') {
    title = `${config.emote.sword} **Attack Wins**`;
  }
  else {
    title = '**ERROR**';
  };

  let color = config.color.main;

  if (iTeamAbbr != 'entire') {
    color = config.color[league];
  };

  let embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setFooter({ text: footer, iconURL: config.urlImage.jwc })

  description.map(async (iDescription) => {
    if (iDescription != '') {
      embed.setDescription(iDescription);
      await interaction.followUp({ embeds: [embed] });
    };
  });

  return;
};


async function jwcAttack(interaction, client) {
  const iLeague = await interaction.options.getString('league');
  const iTeamAbbr = await interaction.options.getString('team');
  let teamAbbr = iTeamAbbr.toLowerCase();
  let iLvTH = await interaction.options.getInteger('th_level');
  let lvTH = Number(iLvTH);
  if (iLvTH == null) {
    lvTH = config.lvTH;
  };
  let iAttackType = await interaction.options.getString('attack_type');
  if (iAttackType == null) {
    iAttackType = 'total';
  };
  let nDisplay = await interaction.options.getInteger('n_display');
  if (nDisplay == null) {
    nDisplay = 5;
  };
  const iRegularSeason = await interaction.options.getString('only_regular_season');

  let leagueM = '';
  if (iLeague == 'j1' || iLeague == 'j2') {
    leagueM = 'j';
  }
  else {
    leagueM = iLeague;
  };

  let keyAttacks = 'attacks';
  if (iRegularSeason == 'true') {
    keyAttacks = 'attacks2';
  };

  let query = {};
  if (teamAbbr == 'entire') {
    query = {
      townHallLevel: lvTH,
      //[`league.${leagueM}`]: iLeague,
      [`stats.${iLeague}.${keyAttacks}.${iAttackType}.nAttacks`]: { $gt: 0 },
      [`stats.${iLeague}.season`]: config.season[iLeague]
    };
  }
  else if (teamAbbr != 'entire') {
    query = {
      townHallLevel: lvTH,
      //[`league.${leagueM}`]: iLeague,
      [`homeClanAbbr.${leagueM}`]: iTeamAbbr,
      [`stats.${iLeague}.${keyAttacks}.${iAttackType}.nAttacks`]: { $gt: 0 },
      [`stats.${iLeague}.season`]: config.season[iLeague]
    };
  };
  let sort = {};
  sort = {
    [`stats.${iLeague}.${keyAttacks}.${iAttackType}.nTriples`]: -1,
    [`stats.${iLeague}.${keyAttacks}.${iAttackType}.nAttacks`]: 1,
    [`stats.${iLeague}.${keyAttacks}.${iAttackType}.avrgDestruction`]: -1,
    [`stats.${iLeague}.${keyAttacks}.${iAttackType}.avrgLeft`]: -1
  };

  let embed = new EmbedBuilder();

  let title = `${config.emote.sword} **TOP ATTACKERS**`;
  embed.setTitle(title);

  const description = await fRanking.getDescriptionRankingJwcAttack(client.clientMongo, iLeague, query, sort, teamAbbr = 'entire', lvTH, nDisplay, flagSummary = false, iRegularSeason, iAttackType);

  let footer = '';
  if (iAttackType == 'total') {
    footer = `${config.footer} ${config.league[iLeague]} SEASON ${config.season[iLeague]}`;
  }
  else {
    footer = `${config.footer} ${config.league[iLeague]} SEASON ${config.season[iLeague]}  [${iAttackType.toUpperCase()}]`;
  };
  embed.setFooter({ text: footer, iconURL: config.urlImage.jwc });

  if (teamAbbr != 'entire') {
    let dbValueClan = await client.clientMongo.db('jwc').collection('clans').findOne(
      { clan_abbr: teamAbbr },
      { projection: { team_name: 1, logo_url: 1, _id: 0 } }
    );
    embed.setAuthor({ name: dbValueClan.team_name, iconURL: dbValueClan.logo_url });
  };

  let color = config.color[iLeague];
  embed.setColor(color);

  description.map(async (iDescription, index) => {
    if (iDescription != '') {
      if (index == 4) {
        title = `${config.emote.sword} **TOTAL**`;
        embed.setTitle(title);
      };
      embed.setDescription(iDescription);
      await interaction.followUp({ embeds: [embed] });
    };
  });

  return;
};


async function jwcDefense(interaction, client) {
  const iLeague = await interaction.options.getString('league');
  const iTeamAbbr = await interaction.options.getString('team');
  let teamAbbr = iTeamAbbr.toLowerCase();
  let iLvTH = await interaction.options.getInteger('th_level');
  let lvTH = Number(iLvTH);
  if (iLvTH == null) {
    lvTH = config.lvTH;
  };
  let iAttackType = await interaction.options.getString('attack_type');
  if (iAttackType == null) {
    iAttackType = 'total';
  };
  let nDisplay = await interaction.options.getInteger('n_display');
  if (nDisplay == null) {
    nDisplay = 5;
  };

  let query = {};
  let sort = {};
  let leagueM = '';
  if (iLeague == 'j1' || iLeague == 'j2') {
    leagueM = 'j';
  }
  else {
    leagueM = iLeague;
  };
  if (teamAbbr == 'entire') {
    query = { status: true, townHallLevel: lvTH, [`league.${leagueM}`]: iLeague, [`stats.${iLeague}.defenses.${iAttackType}.nSucDefenses`]: { $gt: 0 }, [`stats.${iLeague}.season`]: config.season[iLeague] };
    sort = { [`stats.${iLeague}.defenses.${iAttackType}.nSucDefenses`]: -1, [`stats.${iLeague}.defenses.${iAttackType}.nDefenses`]: 1, [`stats.${iLeague}.defenses.${iAttackType}.avrgDestruction`]: 1 };
  }
  else if (teamAbbr != 'entire') {
    query = { status: true, townHallLevel: lvTH, [`league.${leagueM}`]: iLeague, [`homeClanAbbr.${leagueM}`]: iTeamAbbr, [`stats.${iLeague}.defenses.${iAttackType}.nDefenses`]: { $gt: 0 }, [`stats.${iLeague}.season`]: config.season[iLeague] };
    sort = { [`stats.${iLeague}.defenses.${iAttackType}.nSucDefenses`]: -1, [`stats.${iLeague}.defenses.${iAttackType}.nDefenses`]: 1, [`stats.${iLeague}.defenses.${iAttackType}.avrgDestruction`]: 1 };
  };
  const cursor = client.clientMongo.db('jwc').collection('accounts').find(query).sort(sort);
  let accs = await cursor.toArray();
  await cursor.close();

  let totalDefenses = 0;
  let totalSucDefenses = 0;
  let totalAvrgDestruction = 0;

  let description = ['', '', '', '', ''];
  if (accs.length == 0) {
    description[0] = '*no defenses*';
  }
  else {
    let arrDescription = [];
    for (let [index, acc] of accs.entries()) {
      arrDescription[index] = '';
      if (teamAbbr == 'entire') {
        arrDescription[index] += `${index + 1}. ${config.emote.thn[lvTH]} **${acc.name.replace(/\*/g, '\\*').replace(/_/g, '\\_')}**`;
        arrDescription[index] += ` | ${acc.homeClanAbbr[leagueM].toUpperCase()}\n`;
      }
      else {
        arrDescription[index] += `${index + 1}. ${config.emote.thn[lvTH]} **${acc.name.replace(/\*/g, '\\*').replace(/_/g, '\\_')}**`;
        arrDescription[index] += ` | ${acc.pilotName[leagueM]}\n`;
      };
      arrDescription[index] += `**${acc.stats[iLeague].defenses[iAttackType].nSucDefenses}**/${acc.stats[iLeague].defenses[iAttackType].nDefenses}`;
      arrDescription[index] += `  ( **${acc.stats[iLeague].defenses[iAttackType].rate}**% )`;
      arrDescription[index] += `  ${acc.stats[iLeague].defenses[iAttackType].avrgDestruction}%`;
      arrDescription[index] += `\n`;
      arrDescription[index] += `\n`;
      totalDefenses += acc.stats[iLeague].defenses[iAttackType].nDefenses;
      totalSucDefenses += acc.stats[iLeague].defenses[iAttackType].nSucDefenses;
      totalAvrgDestruction += acc.stats[iLeague].defenses[iAttackType].avrgDestruction * acc.stats[iLeague].defenses[iAttackType].nDefenses;
      let myIndex = nDisplay - 1;
      if (index == myIndex) break;
    };
    arrDescription.forEach(function(value, index) {
      if (index < 25) {
        description[0] += value;
      }
      else if (index < 50) {
        description[1] += value;
      }
      else if (index < 75) {
        description[2] += value;
      }
      else if (index < 100) {
        description[3] += value;
      };
    });
  };

  let title = `${config.emote.shield} **TOP DEFENDERS**`;
  let footer = '';
  if (iAttackType == 'total') {
    footer = `${config.footer} ${config.league[iLeague]} SEASON ${config.season[iLeague]}`;
  }
  else {
    footer = `${config.footer} ${config.league[iLeague]} SEASON ${config.season[iLeague]}  [${iAttackType.toUpperCase()}]`;
  };

  let embed = new EmbedBuilder()
    .setTitle(title)
    .setFooter({ text: footer, iconURL: config.urlImage.jwc })

  if (teamAbbr != 'entire') {
    let dbValueClan = await client.clientMongo.db('jwc').collection('clans').findOne({ clan_abbr: teamAbbr });
    embed.setAuthor({ name: dbValueClan.team_name, iconURL: dbValueClan.logo_url });
  };

  let color = config.color[iLeague];
  embed.setColor(color);

  description.map(async (iDescription) => {
    if (iDescription != '') {
      embed.setDescription(iDescription);
      await interaction.followUp({ embeds: [embed] });
    };
  });

  if (nDisplay >= accs.length && accs.length != 0) {
    title = `${config.emote.sword} **TOTAL**`;
    embed.setTitle(title);
    let rate = Math.round(totalSucDefenses / totalDefenses * 1000) / 10;
    totalAvrgDestruction = Math.round(totalAvrgDestruction / totalDefenses * 100) / 100;
    let description = '';
    description += `**${totalSucDefenses}**/${totalDefenses}  ( **${rate}**% )  ${totalAvrgDestruction}%`;
    embed.setDescription(description);
    await interaction.followUp({ embeds: [embed] });
  };

  return;
};


