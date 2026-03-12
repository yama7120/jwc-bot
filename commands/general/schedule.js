const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const config = require('../../config.js');
const schedule = require('../../schedule.js');
const functions = require('../../functions/functions.js');


const nameCommand = 'schedule';
let data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription('no description')
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
  );
config.choices.league5.forEach(choice => {
  data.options[0].options[0].addChoices(choice);
  data.options[1].options[0].addChoices(choice);
});


module.exports = {
  data: data,

  async autocomplete(interaction, client) {
    const focusedValue = interaction.options.getFocused();
    const iLeague = await interaction.options.getString('league');
    let teamList = await client.clientMongo.db('jwc').collection('config').findOne({ _id: 'teamList' });

    teams = teamList[iLeague].filter(function(team) { return team.team_abbr.includes(focusedValue) });
    if (teams.length >= 25) {
      teams = teams.filter(function(clan, index) { return index < 25 });
    };
    await interaction.respond(teams.map(team => ({
      name: `${team.team_abbr.toUpperCase()}: ${team.clan_name} | ${team.team_name}`,
      value: team.team_abbr
    })));
  },

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const iLeague = await interaction.options.getString('league');
    let embed = new EmbedBuilder();
    let title = '';
    let description = '';
    let footer = '';

    let options = { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' };

    if (subcommand == 'league') {
      title = `:calendar: **SCHEDULE**`;
      footer = `${config.footer} ${config.league[iLeague]} SEASON ${config.season[iLeague]}`;

      if (iLeague == 'five') {
        Object.keys(schedule.dateDef5v.day).forEach(key => {
          const week = key.slice(1);
          if (week > 0) {
            description += `### WEEK ${week}`;
            description += `\n`;
            if (schedule.dateDef5v.day[key] == 'BYE') {
              description += `*BYE*\n`;
            }
            else {
              description += `:alarm_clock: ${schedule.dateDef5v.day[key].toLocaleDateString('ja-JP', options)}`;
              description += ` ${schedule.dateDef5v.time[key]}\n`;
              description += `:hourglass_flowing_sand: ${schedule.timePrep[iLeague]} 分 / :crossed_swords: ${schedule.timeBattle[iLeague]} 分\n`;
              description += `:calendar: ${schedule.dateDef5v.period[key]} 日間\n`;
            };
          };
        });
        description += `\n`;
        description += `:alarm_clock: 基準日・基準時間\n`;
        description += `:hourglass_flowing_sand: 準備時間 / :crossed_swords: 対戦時間\n`;
        description += `:calendar: 基準期間（基準日を含めた日数）\n`;
      }
      else if (iLeague != 'five') {
        Object.keys(schedule.dateDef[iLeague].day).forEach(key => {
          const week = key.slice(1);
          if (week > 0) {
            description += `### WEEK ${week}`;
            description += `\n`;
            if (schedule.dateDef[iLeague].day[key] == 'BYE') {
              description += `*BYE*\n`;
            }
            else {
              description += `:alarm_clock: ${schedule.dateDef[iLeague].day[key].toLocaleDateString('ja-JP', options)}`;
              description += ` ${schedule.timeDef[iLeague]}\n`;
              description += `:hourglass_flowing_sand: ${schedule.timePrep[iLeague]} 時間 / :crossed_swords: ${schedule.timeBattle[iLeague]} 時間\n`;
              description += `:calendar: ${schedule.dateDef[iLeague].start[key].toLocaleDateString('ja-JP', options)} ～ `;
              description += `${schedule.dateDef[iLeague].end[key].toLocaleDateString('ja-JP', options)}\n`;
            };
          };
        });
        description += `\n`;
        description += `:alarm_clock: 基準日・基準時間\n`;
        description += `:hourglass_flowing_sand: 準備時間 / :crossed_swords: 対戦時間\n`;
        description += `:calendar: 基準期間\n`;
      };
    }
    else if (subcommand == 'team') {
      title = ':calendar: **SCHEDULE**';
      footer = `${config.footer} ${config.league[iLeague]} SEASON ${config.season[iLeague]}`;

      const clanAbbr = await interaction.options.getString('team');

      let dbValueClan = await client.clientMongo.db('jwc').collection('clans').findOne({ clan_abbr: clanAbbr });

      const query = {
        season: config.season[iLeague],
        league: iLeague,
        week: { $gt: 0 },
        $or: [{ clan_abbr: clanAbbr }, { opponent_abbr: clanAbbr }]
      };
      const projection = { _id: 0, week: 1, clan_abbr: 1, opponent_abbr: 1, deal: 1, name_match: 1 };
      const options = { projection: projection };
      const sort = { week: 1 };
      const cursor = client.clientMongo.db('jwc').collection('wars').find(query, options).sort(sort);
      const wars = await cursor.toArray();
      await cursor.close();

      if (wars.length == 0) {
        description += '*No war scheduled*';
      }
      else {
        let arrDescription = [];
        await Promise.all(wars.map(async (war, index) => {
          let clanAbbrOpp = '';
          if (war.clan_abbr == clanAbbr) {
            clanAbbrOpp = war.opponent_abbr;
          }
          else {
            clanAbbrOpp = war.clan_abbr;
          };
          const dbValueClanOpp = await client.clientMongo.db('jwc').collection('clans').findOne({ clan_abbr: clanAbbrOpp });
          arrDescription[index] = `* **WEEK ${war.week}**\n`;
          arrDescription[index] += `**:vs: ${dbValueClanOpp.team_name}**\n`;
          if (war.deal) {
            arrDescription[index] += `:calendar: ${war.deal.date} :alarm_clock: ${war.deal.time}\n`;
            arrDescription[index] += `:hourglass_flowing_sand: ${war.deal.prep_time} / :crossed_swords: ${war.deal.battle_time}\n`;
          }
          else {
            arrDescription[index] += '_not yet scheduled_\n';
          };
          if (war.name_match) {
            arrDescription[index] += `_${war.name_match}_\n`;
          };
          arrDescription[index] += `\n`;
        }));

        arrDescription.forEach(function(value) {
          description += value;
        });
      };

      embed.setAuthor({ name: dbValueClan.team_name, iconURL: dbValueClan.logo_url });
    };

    if (iLeague == 'j1' || iLeague == 'j2' || iLeague == 'mix') {
      const urlImage = config.urlImage.schedule[iLeague];
      if (urlImage) {
        embed.setImage(config.urlImage.schedule[iLeague]);
      };
    };

    embed.setTitle(title);
    embed.setDescription(description);
    embed.setColor(config.color[iLeague]);
    embed.setFooter({ text: footer, iconURL: config.urlImage.jwc });

    await interaction.followUp({ embeds: [embed] });
  }
}