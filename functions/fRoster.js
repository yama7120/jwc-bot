import { EmbedBuilder } from 'discord.js';

import config from '../config/config.js';
import config_coc from '../config/config_coc.js';
import * as functions from './functions.js';
import * as fMongo from './fMongo.js';
import * as fTeamLogo from './fTeamLogo.js';

const leagueTierRankById = new Map(
  config_coc.leagueTiers.map((tier, index) => [tier.id, index]),
);

function sortRosterAccounts(accs, sortOrder) {
  if (sortOrder !== 'league_tier') {
    return accs;
  }
  return [...accs].sort((a, b) => {
    const rankA = leagueTierRankById.get(a.leagueTier?.id) ?? -1;
    const rankB = leagueTierRankById.get(b.leagueTier?.id) ?? -1;
    if (rankB !== rankA) {
      return rankB - rankA;
    }
    return (b.trophies ?? 0) - (a.trophies ?? 0);
  });
}

async function roster(interaction, client, iLeague, iTeamAbbr, sortOrder = 'default') {
  let mongoTeam = await client.clientMongo.db('jwc').collection('clans').findOne(
    { clan_abbr: iTeamAbbr },
    {
      projection: {
        team_name: 1,
        clan_abbr: 1,
        logo_url: 1,
        logo_data: 1,
        logo_data_thumb: 1,
        clan_tag: 1,
        _id: 0,
      },
    }
  );

  const query = { [`homeClanAbbr.${config.leagueM[iLeague]}`]: iTeamAbbr, status: true };
  const projection = {
    _id: 0,
    tag: 1,
    name: 1,
    townHallLevel: 1,
    homeClanAbbr: 1,
    attacks: 1,
    pilotDC: 1,
    pilotName: 1,
    trophies: 1,
    'leagueTier.id': 1,
  };
  const sort =
    sortOrder === 'league_tier'
      ? {}
      : { townHallLevel: -1, [`pilotName.${config.leagueM[iLeague]}`]: 1 };
  const cursor = client.clientMongo
    .db('jwc')
    .collection('accounts')
    .find(query, { projection })
    .sort(sort);
  let accs = await cursor.toArray();
  await cursor.close();
  accs = sortRosterAccounts(accs, sortOrder);

  if (accs.length == 0) {
    let title = `**ROSTER**`;
    let description = '';
    description += `*league: ${iLeague}*\n`;
    description += `*team abbr: ${iTeamAbbr}*\n\n`;
    description += '*no account registerd*\n';

    let embed = new EmbedBuilder();
    embed.setTitle(title);
    embed.setDescription(description);
    embed.setColor(config.color[iLeague]);
    embed.setFooter({ text: `${config.footer} ${config.league[iLeague]}`, iconURL: config.urlImage.jwc });
    //embed.setAuthor({ name: mongoTeam.team_name, iconURL: mongoTeam.logo_url });

    await interaction.followUp({ embeds: [embed] });

    return;
  };
  
  await fMongo.teamList(client.clientMongo, iLeague);

  await rosterMain(interaction, client, mongoTeam, accs, iLeague, sortOrder);
};
export { roster };

async function rosterMain(
  interaction,
  client,
  mongoTeam,
  accs,
  iLeague,
  sortOrder = 'default',
) {
  let embed = new EmbedBuilder();

  let title = `**ROSTER**`;

  let arrDescription = [];
  accs.forEach((acc, index) => {
    arrDescription[index] = '';
    arrDescription[index] += index + 1;
    arrDescription[index] += '.';
    arrDescription[index] += ` ${config.emote.thn[acc.townHallLevel]}`;
    arrDescription[index] += ` **${functions.nameReplacer(acc.name)}**`;
    const urlPlayer = `https://link.clashofclans.com/jp?action=OpenPlayerProfile&tag=${acc.tag.slice(1)}`;
    arrDescription[index] += ` [__${acc.tag}__](${urlPlayer})`;

    // 出場数
    let numWar = 0;
    if (acc.attacks != null) {
      acc.attacks.forEach(function(attack) {
        if (Number(attack.season) === Number(config.season[iLeague]) && attack.league == iLeague && attack.week != 0 && attack.attackNo == 1) {
          numWar += 1;
        };
      });
    };
    if (numWar > 0) {
      arrDescription[index] += ` (${numWar})`;
    };
    arrDescription[index] += `\n`;

    if (sortOrder === 'league_tier') {
      const leagueTierId = acc.leagueTier?.id;
      const leagueTierConfig = config_coc.leagueTiers.find(
        (tier) => tier.id === leagueTierId,
      );
      const leagueEmote = leagueTierConfig?.emote ?? ':question:';
      const leagueLabel = functions.getRankedLeagueTierLabel({
        leagueTier: { id: leagueTierId },
      });
      arrDescription[index] += `${leagueEmote} ${leagueLabel} :trophy: ${acc.trophies ?? 0}`;
      arrDescription[index] += `\n`;
    }

    arrDescription[index] += `:bust_in_silhouette: ${acc.pilotName[config.leagueM[iLeague]]}`;
    if (acc.pilotDC != 'no discord acc' && acc.pilotDC != null && acc.pilotDC != '') {
      arrDescription[index] += ` <@!${acc.pilotDC.id}>`;
    };

    arrDescription[index] += `\n\n`;
  });

  let nAccPerPage = 15;

  let description = [];
  for (let i = 0; i < 10; i++) {
    description[i] = '';
  };
  arrDescription.forEach(function(value, index) {
    for (let i = 0; i < 10; i++) {
      if (nAccPerPage * i <= index && index < nAccPerPage * (i + 1)) {
        description[i] += value;
        break;
      };
    };
  });

  let footer = `${config.footer} ${config.league[iLeague]}`;
  const teamLogo = fTeamLogo.createTeamLogoEmbedAsset(mongoTeam);

  embed.setTitle(title);
  embed.setDescription(description[0]);
  embed.setColor(config.color[iLeague]);
  embed.setFooter({ text: footer, iconURL: config.urlImage.jwc });
  embed.setAuthor({ name: mongoTeam.team_name, iconURL: teamLogo.url });
  await interaction.followUp(
    fTeamLogo.withTeamLogo({ embeds: [embed] }, teamLogo),
  );

  for (let i = 1; i < 5; i++) {
    if (description[i] != '') {
      embed.setDescription(description[i])
      await interaction.followUp(
        fTeamLogo.withTeamLogo({ embeds: [embed] }, teamLogo),
      );
    };
  };

  description = await setDescriptionRosterLeagueOne(client.clientMongo, iLeague, -1, mongoTeam.clan_abbr, mongoTeam.team_name);

  embed.setDescription(description);
  await interaction.followUp(
    fTeamLogo.withTeamLogo({ embeds: [embed] }, teamLogo),
  );

  return;
};


async function rosterLeague(interaction, client, iLeague) {
  let title = `ROSTER | ${config.league[iLeague]}`;
  let arrDescription = [];

  arrDescription = await setDescriptionRosterLeague(client, iLeague);

  for (let i = 0; i < 3; i++) {
    if (arrDescription[i] != '') {
      let embed = new EmbedBuilder();
      embed.setTitle(title);
      embed.setDescription(arrDescription[i]);
      embed.setColor(config.color[iLeague]);
      embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
      await interaction.followUp({ embeds: [embed] });
    };
  };

  await fMongo.teamList(client.clientMongo, iLeague);

  return;
};
export { rosterLeague };

async function setDescriptionRosterLeague(client, iLeague) {
  let return_arr = [];
  let return_arr2 = ['', '', ''];

  const query = { league: iLeague, [`status.${functions.seasonToString(config.season[iLeague])}`]: 'true' };
  const projection = { _id: 0, clan_abbr: 1, team_name: 1 };
  const sort = { clan_abbr: 1 };
  const options = { projection: projection, sort: sort };
  const cursor = client.clientMongo.db('jwc').collection('clans').find(query, options);
  let clans = await cursor.toArray();
  await cursor.close();

  await Promise.all(clans.map(async (clan, index) => {
    let clanAbbr = clan.clan_abbr;
    let teamName = clan.team_name;
    return_arr[index] = '';
    return_arr[index] = await setDescriptionRosterLeagueOne(client.clientMongo, iLeague, index, clanAbbr, teamName);
  }));

  for (let index = 0; index < clans.length; index++) {
    if (index < 50) {
      return_arr2[0] += return_arr[index];
    }
    else if (index < 100) {
      return_arr2[1] += return_arr[index];
    }
    else if (index < 150) {
      return_arr2[2] += return_arr[index];
    };
  };

  return return_arr2;
};

async function setDescriptionRosterLeagueOne(clientMongo, iLeague, index, teamAbbr, teamName) {
  const teamList = await clientMongo.db('jwc').collection('config').findOne(
    { _id: 'teamList' },
    { projection: { [iLeague]: 1, _id: 0 } }
  );

  let numAccounts = 0;
  let numPlayers = 0;
  const leagueTeams = teamList?.[iLeague] ?? [];
  leagueTeams.forEach((team) => {
    if (team.team_abbr == teamAbbr) {
      numPlayers = team.players;
      numAccounts = team.accounts;
    };
  });

  let return_str = '';
  if (index == -1) {
    return_str += `* **${teamAbbr.toUpperCase()}**\n`;
  }
  else {
    return_str += `${index + 1}. **${teamAbbr.toUpperCase()} | ${teamName}**\n`;
  };
  return_str += `*${numPlayers} players, ${numAccounts} accounts*\n`;
  return_str += `\n`;

  return return_str;
};


async function rosterClan(interaction, client, iLeague, iTeamAbbr) {
  let mongoTeam = await client.clientMongo.db('jwc').collection('clans').findOne(
    { clan_abbr: iTeamAbbr },
    {
      projection: {
        team_name: 1,
        clan_abbr: 1,
        logo_url: 1,
        logo_data: 1,
        logo_data_thumb: 1,
        clan_tag: 1,
        _id: 0,
      },
    }
  );

  if (!mongoTeam) {
    await interaction.followUp({ content: `*ERROR: no team*` });
    return;
  }

  // rosterアカウントリスト作成
  const query = { [`homeClanAbbr.${config.leagueM[iLeague]}`]: iTeamAbbr, status: true };
  const options = { projection: { _id: 0, tag: 1 } };
  const sort = {};
  const cursor = client.clientMongo.db('jwc').collection('accounts').find(query, options).sort(sort);
  const accs = await cursor.toArray();
  await cursor.close();

  const tagsRoster = accs.map(acc => acc.tag);

  let title = `MEMBERS IN CLAN`;
  let arrDescription = [];

  const clan = await client.clientCoc.getClan(mongoTeam.clan_tag);
  await Promise.all(clan.members.map(async (member, index) => {
    if (tagsRoster.includes(member.tag)) {
      arrDescription[index] = `:white_check_mark:`;
    }
    else {
      arrDescription[index] = `:x:`;
    }
    const urlPlayer = `https://link.clashofclans.com/jp?action=OpenPlayerProfile&tag=${member.tag.slice(1)}`;
    arrDescription[index] += ` ${config.emote.thn[member.townHallLevel]}`;
    arrDescription[index] += ` [__${member.tag}__](${urlPlayer})`;
    arrDescription[index] += ` ${member.name}`;
    arrDescription[index] += `\n`;
  }));

  const description1 = arrDescription.slice(0, 25).join('');
  const description2 = arrDescription.slice(25).join('');

  const footer = `${config.footer} ${config.league[iLeague]}`;
  const teamLogo = fTeamLogo.createTeamLogoEmbedAsset(mongoTeam);

  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setDescription(description1);
  embed.setColor(config.color[iLeague]);
  embed.setFooter({ text: footer, iconURL: config.urlImage.jwc });
  embed.setAuthor({ name: mongoTeam.team_name, iconURL: teamLogo.url });
  await interaction.followUp(
    fTeamLogo.withTeamLogo({ embeds: [embed] }, teamLogo),
  );

  if (description2) {
    embed.setDescription(description2);
    await interaction.followUp(
      fTeamLogo.withTeamLogo({ embeds: [embed] }, teamLogo),
    );
  };
  
  return;
};
export { rosterClan };
