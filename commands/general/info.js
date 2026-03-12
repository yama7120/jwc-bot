const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const config = require("../../config.js");
const config_coc = require("../../config_coc.js");
const config_history = require("../../history.js");
const functions = require("../../functions/functions.js");
const fMongo = require("../../functions/fMongo.js");
const fCanvas = require("../../functions/fCanvas.js");
const fRoster = require("../../functions/fRoster.js");


const nameCommand = "info";
let data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription("no description")
  // options[0]
  .addSubcommandGroup(subcommandgroup =>
    subcommandgroup
      .setName("account")
      .setDescription("no description")
      .addSubcommand(subcommand =>
        subcommand
          .setName("own")
          .setDescription(config.command[nameCommand].subCommandGroup["account"]["own"])
          .addStringOption(option =>
            option
              .setName("account_own")
              .setDescription("ACCOUNT")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName("single")
          .setDescription(config.command[nameCommand].subCommandGroup["account"]["single"])
          .addStringOption(option =>
            option
              .setName("league")
              .setDescription("LEAGUE")
              .setRequired(true)
          )
          .addStringOption(option =>
            option
              .setName("team")
              .setDescription("TEAM")
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addStringOption(option =>
            option
              .setName("account")
              .setDescription("ACCOUNT")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName("list")
          .setDescription(config.command[nameCommand].subCommandGroup["account"]["list"])
          .addStringOption(option =>
            option
              .setName("item")
              .setDescription("DISPLAY ITEMS")
              .addChoices(
                { name: "RANKED BATTLES", value: "ranked_battles" },
                { name: "HEROES", value: "hero" },
                { name: "SUPER UNITS", value: "super_troops" },
                { name: "TROPHIES", value: "trophies" },
                { name: "LEVEL STATS", value: "acc_data" },
              )
          )
          .addUserOption(option =>
            option
              .setName("user")
              .setDescription("DISCORD ACCOUNT (IF YOU ARE THE OWNER, INPUT NOTHING)")
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName("any")
          .setDescription(config.command[nameCommand].subCommandGroup["account"]["any"])
          .addStringOption(option =>
            option
              .setName("tag")
              .setDescription("ACCOUNT TAG")
              .setRequired(true)
          )
      )
  )
  // options[1]
  .addSubcommandGroup(subcommandgroup =>
    subcommandgroup
      .setName("team")
      .setDescription("no description")
      .addSubcommand(subcommand =>
        subcommand
          .setName("list")
          .setDescription(config.command[nameCommand].subCommandGroup["team"]["list"])
          .addStringOption(option =>
            option
              .setName("league")
              .setDescription("LEAGUE")
              .setRequired(true)
          )
          .addStringOption(option =>
            option
              .setName("season")
              .setDescription("SEASON (DEFAULT: CURRENT)")
              .addChoices(
                { name: "NEXT", value: "next" },
                { name: "CURRENT", value: "this" },
              )
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName("single")
          .setDescription(config.command[nameCommand].subCommandGroup["team"]["single"])
          .addStringOption(option =>
            option
              .setName("league")
              .setDescription("LEAGUE")
              .setRequired(true)
          )
          .addStringOption(option =>
            option
              .setName("team")
              .setDescription("TEAM")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
  )
  // options[2]
  .addSubcommand(subcommand =>
    subcommand
      .setName("league_standings")
      .setDescription(config.command[nameCommand].subCommand["league_standings"])
      .addStringOption(option =>
        option
          .setName("league")
          .setDescription("LEAGUE")
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("round")
          .setDescription("IF 5v, SELECT ROUND")
          .addChoices(
            { name: "QUALIFIER", value: "qualifier" },
            { name: "GROUP_STAGE", value: "group_stage" },
          )
      )
  )
  // options[3]
  .addSubcommandGroup(subcommandgroup =>
    subcommandgroup
      .setName("roster")
      .setDescription("no description")
      .addSubcommand(subcommand =>
        subcommand
          .setName("team")
          .setDescription(config.command[nameCommand].subCommandGroup["roster"]["team"])
          .addStringOption(option =>
            option
              .setName("league")
              .setDescription("LEAGUE")
              .setRequired(true)
          )
          .addStringOption(option =>
            option
              .setName("team")
              .setDescription("TEAM")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName("league")
          .setDescription(config.command[nameCommand].subCommandGroup["roster"]["league"])
          .addStringOption(option =>
            option
              .setName("league")
              .setDescription("LEAGUE")
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName("clan")
          .setDescription(config.command[nameCommand].subCommandGroup["roster"]["clan"])
          .addStringOption(option =>
            option
              .setName("league")
              .setDescription("LEAGUE")
              .setRequired(true)
          )
          .addStringOption(option =>
            option
              .setName("team")
              .setDescription("TEAM")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName("transfer")
          .setDescription(config.command[nameCommand].subCommandGroup["roster"]["transfer"])
          .addStringOption(option =>
            option
              .setName("league")
              .setDescription("LEAGUE")
              .setRequired(true)
          )
      )
  )
  // options[4]
  .addSubcommand(subcommand =>
    subcommand
      .setName("zap_quake")
      .setDescription(config.command[nameCommand].subCommand["zap_quake"])
      .addIntegerOption(option =>
        option
          .setName("th_level")
          .setDescription("TOWNHALL LEVEL")
      )
  )
  // options[5]
  .addSubcommand(subcommand =>
    subcommand
      .setName("fireball")
      .setDescription(config.command[nameCommand].subCommand["fireball"])
      .addIntegerOption(option =>
        option
          .setName("th_level")
          .setDescription("TOWNHALL LEVEL")
      )
  )
  // options[6]
  .addSubcommand(subcommand =>
    subcommand
      .setName("useful_links")
      .setDescription(config.command[nameCommand].subCommand["useful_links"])
      .addStringOption(option =>
        option
          .setName("item")
          .setDescription("ITEM")
          .setRequired(true)
          .addChoices(
            { name: "RULEBOOK", value: "rule" },
            { name: "SERVER_LINK", value: "server" },
            { name: "SC_STORE", value: "scStore" },
          )
      )
  )
  // options[7]
  .addSubcommand(subcommand =>
    subcommand
      .setName("champions")
      .setDescription(config.command[nameCommand].subCommand["champions"])
      .addStringOption(option =>
        option
          .setName("league")
          .setDescription("LEAGUE")
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("streamer")
      .setDescription(config.command[nameCommand].subCommand["streamer"])
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("bot_status")
      .setDescription(config.command[nameCommand].subCommand["bot_status"])
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("discord_id")
      .setDescription(config.command[nameCommand].subCommand["discord_id"])
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("DISCORD ACCOUNT (IF YOU ARE THE OWNER, INPUT NOTHING)")
      )
  );
config.choices.league5.forEach(choice => {
  // account
  data.options[0].options[1].options[0].addChoices(choice);
  // team
  data.options[1].options[0].options[0].addChoices(choice);
  data.options[1].options[1].options[0].addChoices(choice);
  // league_standings
  data.options[2].options[0].addChoices(choice);
  // roster
  data.options[3].options[0].options[0].addChoices(choice);
  data.options[3].options[1].options[0].addChoices(choice);
  data.options[3].options[2].options[0].addChoices(choice);
});
config.choices.leagueM.forEach(choice => {
  data.options[3].options[3].options[0].addChoices(choice);
});
config.choices.leagueAll.forEach(choice => {
  // champions
  data.options[7].options[0].addChoices(choice);
});
config.choices.townHallLevelInt.forEach(choice => {
  data.options[4].options[0].addChoices(choice);
  data.options[5].options[0].addChoices(choice);
});

module.exports = {
  data: data,

  async autocomplete(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup == "account") {
      let focusedOption = interaction.options.getFocused(true);
      if (focusedOption.name === "account_own") {
        let focusedValue = interaction.options.getFocused();
        const query = { "pilotDC.id": interaction.user.id, status: { $ne: false } };
        const options = { projection: { tag: 1, name: 1, townHallLevel: 1 } };
        const sort = { townHallLevel: -1 };
        const cursor = client.clientMongo.db("jwc").collection("accounts").find(query, options).sort(sort);
        let accs = await cursor.toArray();
        await cursor.close();
        accs = accs.filter(function(acc) { return acc.name.includes(focusedValue) });
        if (accs.length >= 25) {
          accs = accs.filter(function(acc, index) { return index < 25 });
        };
        if (accs.length > 0) {
          await interaction.respond(accs.map(acc => ({
            name: `[TH${acc.townHallLevel}] ${acc.name}`,
            value: acc.tag
          })));
        };
      }
      else if (focusedOption.name === "team") {
        const focusedValue = interaction.options.getFocused();
        const iLeague = await interaction.options.getString("league");

        if (iLeague == "entire") {
          await interaction.respond([{ name: "ENTIRE JWC BOT", value: "entire" }]);
        }
        else {
          const query = { [`status.${functions.seasonToString(config.season[iLeague])}`]: { $in: ["true", "question"] }, league: iLeague };
          const options = { projection: { _id: 0, clan_abbr: 1, team_name: 1 } };
          const sort = { clan_abbr: 1 };
          const cursor = client.clientMongo.db("jwc").collection("clans").find(query, options).sort(sort);
          let mongoClans = await cursor.toArray();
          await cursor.close();

          mongoClans = mongoClans.filter(function(team) { return team.clan_abbr.includes(focusedValue) });

          if (mongoClans.length >= 25) {
            mongoClans = mongoClans.filter(function(team, index) { return index < 25 });
          };

          if (mongoClans.length > 0) {
            await interaction.respond(mongoClans.map(team => ({
              name: `${team.clan_abbr.toUpperCase()}: ${team.team_name}`,
              value: team.clan_abbr
            })));
          };
        };
      }
      else if (focusedOption.name === "account") {
        let focusedValue = interaction.options.getFocused();
        let iLeague = await interaction.options.getString("league");
        let clanAbbr = await interaction.options.getString("team");
        let query = {};
        if (iLeague == "entire") {
          query = {};
        }
        else if (iLeague == "j1" || iLeague == "j2") {
          query = { "homeClanAbbr.j": clanAbbr };
        }
        else if (iLeague == "swiss") {
          query = { "homeClanAbbr.swiss": clanAbbr };
        }
        else if (iLeague == "mix") {
          query = { "homeClanAbbr.mix": clanAbbr };
        }
        else if (iLeague == "five") {
          query = { "homeClanAbbr.five": clanAbbr };
        };
        const options = { projection: { tag: 1, name: 1, townHallLevel: 1 } };
        const sort = { townHallLevel: -1, name: 1 };
        const cursor = client.clientMongo.db("jwc").collection("accounts").find(query, options).sort(sort);
        let accs = await cursor.toArray();
        await cursor.close();
        accs = accs.filter(function(acc) { return acc.name.includes(focusedValue) });
        if (accs.length >= 25) {
          accs = accs.filter(function(acc, index) { return index < 25 });
        };
        if (accs.length > 0) {
          await interaction.respond(accs.map(acc => ({
            name: `[TH${acc.townHallLevel}] ${acc.name}`,
            value: acc.tag
          })));
        };
      };
    }
    else if (subcommandGroup == "team" || subcommandGroup == "roster") {
      let focusedOption = interaction.options.getFocused(true);
      if (focusedOption.name === "team") {
        const focusedValue = interaction.options.getFocused();
        const iLeague = await interaction.options.getString("league");

        const query = { [`status.${functions.seasonToString(config.season[iLeague])}`]: { $in: ["true", "question"] }, league: iLeague };
        const projection = { _id: 0, clan_abbr: 1, team_name: 1 };
        const sort = { clan_abbr: 1 };
        const options = { projection: projection, sort: sort };
        const cursor = client.clientMongo.db("jwc").collection("clans").find(query, options);
        let mongoClans = await cursor.toArray();
        await cursor.close();

        mongoClans = mongoClans.filter(function(team) { return team.clan_abbr.includes(focusedValue) });
        if (mongoClans.length >= 25) {
          mongoClans = mongoClans.filter(function(team, index) { return index < 25 });
        };

        if (mongoClans.length > 0) {
          await interaction.respond(mongoClans.map(team => ({
            name: `${team.clan_abbr.toUpperCase()}: ${functions.nameReplacer(team.team_name)}`,
            value: team.clan_abbr
          })));
        };
      };
    };
  },

  async execute(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup == "account") {
      if (subcommand == "list") {
        accountList(interaction, client);
      }
      else if (subcommand == "own" || subcommand == "single" || subcommand == "any") {
        accountSingle(interaction, client, subcommand);
      };
    }
    else if (subcommandGroup == "team") {
      if (subcommand == "list") {
        teamList(interaction, client);
      }
      else if (subcommand == "single") {
        teamSingle(interaction, client);
      };
    }
    else if (subcommand == "league_standings") {
      leagueStandings(interaction, client);
    }
    else if (subcommandGroup == "roster") {
      const iLeague = await interaction.options.getString("league");
      const iTeamAbbr = await interaction.options.getString("team");
      if (subcommand == "team") {
        await fRoster.roster(interaction, client, iLeague, iTeamAbbr);
      }
      else if (subcommand == "league") {
        await fRoster.rosterLeague(interaction, client, iLeague);
      }
      else if (subcommand == "clan") {
        await fRoster.rosterClan(interaction, client, iLeague, iTeamAbbr);
      }
      else if (subcommand == "transfer") {
        transfer(interaction, client);
      };
    }
    else if (subcommand == "zap_quake") {
      zapQuake(interaction, client);
    }
    else if (subcommand == "fireball") {
      fireball(interaction, client);
    }
    else if (subcommand == "useful_links") {
      usefulLinks(interaction, client);
    }
    else if (subcommand == "champions") {
      champions(interaction, client);
    }
    else if (subcommand == "streamer") {
      streamer(interaction, client);
    }
    else if (subcommand == "bot_status") {
      const embed = await functions.getEmbedStatusInfo(client.clientMongo);
      await interaction.followUp({ embeds: [embed] });
      return;
    }
    else if (subcommand == "discord_id") {
      const iUser = await interaction.options.getUser("user");
      if (iUser == null) {
        await interaction.followUp({ content: interaction.user.id });
      }
      else {
        await interaction.followUp({ content: iUser.id });
      };
      return;
    };
  }
};


async function accountList(interaction, client) {
  const iUser = await interaction.options.getUser("user");
  let pilotDc = {};
  if (iUser == null) {
    pilotDc = interaction.user;
  }
  else {
    pilotDc = iUser;
  };
  let avatarUrl = "";
  if (pilotDc.avatar == null) {
    avatarUrl = `https://cdn.discordapp.com/attachments/1143171140508991500/1318442274002309170/discord-round-black-icon.png`;
  }
  else {
    avatarUrl = `https://cdn.discordapp.com/avatars/${pilotDc.id}/${pilotDc.avatar}.png`;
  };

  const query = { "pilotDC.id": pilotDc.id, status: true };
  const options = { projection: { _id: 0, tag: 1, name: 1, townHallLevel: 1 } };
  const sort = { townHallLevel: -1, "lvHeroes.level": -1, "lvAll.level": -1 };
  const cursor = client.clientMongo.db("jwc").collection("accounts").find(query, options).sort(sort);
  let accountsAll = await cursor.toArray();
  await cursor.close();

  let title = "**ACCOUNTS**";
  let description = ["", "", "", "", "", "", "", "", "", ""];

  let nAccPerPage = 10;

  let flagWar = "true";
  let flagHero = "false";
  let flagSuperTroops = "false";
  let flagRankedBattles = "false";
  let flagTrophies = "false";
  let flagAccData = "false";

  if (accountsAll.length == 0) {
    description[0] += "*no linked account*\n";
    description[0] += "\n";
    description[0] += `* Please run </link_account_to_discord new:${config.command.link_account_to_discord.id}> to link your account.\n`;
  }
  else {
    let optionItem = await interaction.options.getString("item");
    if (optionItem == "hero") {
      flagHero = "true";
      flagWar = "false";
      nAccPerPage = 2;
    }
    else if (optionItem == "super_troops") {
      flagSuperTroops = "true";
      flagWar = "false";
      nAccPerPage = 20;
    }
    else if (optionItem == "ranked_battles") {
      flagRankedBattles = "true";
      flagWar = "false";
      nAccPerPage = 20;
    }
    else if (optionItem == "trophies") {
      flagTrophies = "true";
      flagWar = "false";
      nAccPerPage = 20;
    }
    else if (optionItem == "acc_data") {
      flagAccData = "true";
      flagWar = "false";
      nAccPerPage = 5;
    };

    let arrDescription = [];
    await Promise.all(accountsAll.map(async (acc, index) => {
      const query = { tag: acc.tag, status: true };
      const mongoAcc = await client.clientMongo.db("jwc").collection("accounts").findOne(
        query,
        { projection: { legend: 1, score: 1, attacks: 1, defenses: 1, attackWins: 1, defenseWins: 1, lvTroops: 1, lvSpells: 1, lvHeroes: 1, lvHeroEquipment: 1, lvPets: 1, lvSieges: 1, _id: 0 } }
      );
      let resultScan = await functions.scanAcc(client.clientCoc, acc.tag);
      arrDescription[index] = index + 1;
      arrDescription[index] += ". ";
      if (resultScan.status == "ok") {
        arrDescription[index] += await functions.getAccInfoDescriptionMain(resultScan.scPlayer, formatLength = "short");
        if (flagWar == "true") {
          title = `**WAR**`;
          arrDescription[index] += await functions.getAccInfoDescriptionWar(client.clientCoc, resultScan.scPlayer, formatLength = "short");
        }
        else if (flagHero == "true") {
          title = `**HEROES**`;
          arrDescription[index] += await functions.getAccInfoDescriptionHeroes(resultScan.scPlayer, showAllEquipment = true, formatLength = "short");
        }
        else if (flagSuperTroops == "true") {
          title = `**SUPER TROOPS**`;
          arrDescription[index] += await functions.getAccInfoDescriptionSuperTroops(resultScan.scPlayer, formatLength = "short");
        }
        else if (flagRankedBattles == "true") {
          title = `**RANKED BATTLES**`;
          arrDescription[index] += await functions.getAccInfoDescriptionRankedBattles(resultScan.scPlayer, mongoAcc, formatLength = "short");
        }
        else if (flagTrophies == "true") {
          title = `**TROPHIES**`;
          arrDescription[index] += await functions.getAccInfoDescriptionTrophies(resultScan.scPlayer, mongoAcc, formatLength = "short");
        }
        else if (flagAccData == "true") {
          title = `**LEVELS SUMMARY**`;
          arrDescription[index] += await functions.getAccInfoDescriptionAccData(mongoAcc, formatLength = "short");
        };
        arrDescription[index] += "\n";
      }
      else {
        arrDescription[index] += ` ${config.emote.thn[acc.townHallLevel]}`;
        arrDescription[index] += ` **${functions.nameReplacer(acc.name)}**`;
        arrDescription[index] += "\n";
        arrDescription[index] += `ERROR: _${resultScan.status}_`;
        arrDescription[index] += "\n";
        arrDescription[index] += "\n";
      }
    }));

    arrDescription.forEach(function(value, index) {
      for (let i = 0; i < 10; i++) {
        if (nAccPerPage * i <= index && index < nAccPerPage * (i + 1)) {
          description[i] += value;
          break;
        };
      };
    });
  };

  if (description[0] == "") {
    description[0] += "*no account*\n";
  };

  let embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description[0])
    .setColor(config.color.main)
    .setFooter({ text: config.footer, iconURL: config.urlImage.jwc })
    .setTimestamp()
  embed.setAuthor({ name: pilotDc.username, iconURL: avatarUrl });
  await interaction.followUp({ embeds: [embed] });

  for (let i = 1; i < 10; i++) {
    if (description[i] != "") {
      embed.setDescription(description[i])
      await interaction.followUp({ embeds: [embed] });
    };
  };
};


async function accountSingle(interaction, client, subcommand) {
  let iPlayerTag = {};
  if (subcommand == "own") {
    iPlayerTag = await interaction.options.getString("account_own");
  }
  else if (subcommand == "single") {
    iPlayerTag = await interaction.options.getString("account");
  }
  else if (subcommand == "any") {
    iPlayerTag = await interaction.options.getString("tag");
  };

  const query = { tag: iPlayerTag, status: true };
  const projection = {
    legend: 1,
    score: 1,
    trophies: 1,
    homeClanAbbr: 1,
    attacks: 1,
    defenses: 1,
    attackWins: 1,
    defenseWins: 1,
    lvTroops: 1,
    lvSpells: 1,
    lvHeroes: 1,
    lvHeroEquipment: 1,
    lvPets: 1,
    lvSieges: 1,
    pilotDC: 1,
    unixTimeRequest: 1,
    _id: 0
  };
  const mongoAcc = await client.clientMongo
    .db("jwc")
    .collection("accounts")
    .findOne(query, { projection });

  let resultScan = await functions.scanAcc(client.clientCoc, iPlayerTag);

  //console.dir(resultScan.scPlayer);

  let title = "";
  let description = "";

  if (resultScan.status == "ok") {
    title = await functions.getAccInfoTitle(resultScan.scPlayer, formatLength = "long");
    description += await functions.getAccInfoDescriptionMain(resultScan.scPlayer, formatLength = "long");
    description += await functions.getAccInfoDescriptionWar(client.clientCoc, resultScan.scPlayer, formatLength = "long");
    //description += await functions.getAccInfoDescriptionWarAttacks(client.clientCoc, resultScan.scPlayer, formatLength = "long");
    if (resultScan.scPlayer.townHallLevel >= 7) {
      description += await functions.getAccInfoDescriptionHeroes(resultScan.scPlayer, showAllEquipment = true, formatLength = "long");
    };
    description += await functions.getAccInfoDescriptionSuperTroops(resultScan.scPlayer, formatLength = "long");
    description += await functions.getAccInfoDescriptionRankedBattles(resultScan.scPlayer, mongoAcc, formatLength = "long");
    //description += await functions.getAccInfoDescriptionTrophies(resultScan.scPlayer, mongoAcc, formatLength = "long");
  }
  else if (resultScan.status == "notFound") {
    title = `:x: **${resultScan.status}**`;
    description = `*Invalid tag was inputted.*`;
  }
  else {
    title = `:x: **${resultScan.status}**`;
    description = `*Please try again later.*`;
  };

  description += `\n`;
  description += `<t:${Math.round(Date.now() / 1000)}:f>\n`;

  let embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(config.color.main)
    .setFooter({ text: config.footer, iconURL: config.urlImage.jwc })

  if (mongoAcc?.pilotDC) {
    const user = await client.users.fetch(mongoAcc.pilotDC.id);
    let pilotDC = mongoAcc.pilotDC;

    // avatorが異なる場合は更新
    if (pilotDC.avatar !== user.avatar && subcommand == "own") {
      pilotDC = {
        ...pilotDC,
        avatar: user.avatar,
        avatarUrl: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      };
      await client.clientMongo.db("jwc").collection("accounts").updateOne(
        { tag: iPlayerTag },
        { $set: { pilotDC } }
      );
    };

    const { globalName, username, avatarUrl } = pilotDC;
    if (globalName || username) {
      embed.setAuthor({
        name: globalName || username,
        iconURL: avatarUrl
      });
    };
  };
  await interaction.followUp({ embeds: [embed] });

  let description2 = "";
  if (mongoAcc && resultScan.status == "ok") {
    description2 = await functions.getAccInfoDescriptionAccData(mongoAcc, formatLength = "long");
  };
  description2 += `\n`;

  description2 += await functions.getAccInfoDescriptionJWC(mongoAcc);

  if (mongoAcc) {
    description2 += `<t:${Math.round(mongoAcc.unixTimeRequest)}:f>\n`;
  }

  embed.setDescription(description2);

  await interaction.followUp({ embeds: [embed] });
};


async function teamList(interaction, client) {
  let iLeague = await interaction.options.getString("league");
  let iSeason = await interaction.options.getString("season");
  let season = 0;
  if (iSeason == "next") {
    season = config.seasonNext[iLeague];
  }
  else {
    season = config.season[iLeague];
  };

  let title = `${config.leaguePlusEmote[iLeague]} | SEASON ${season}`;
  let arrDescription = [];

  arrDescription = await functions.setDescriptionClanList(client, iLeague, season);

  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setColor(config.color[iLeague]);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });

  if (arrDescription[0] == "") {
    embed.setDescription("_no team_");
    await interaction.followUp({ embeds: [embed] });
  }
  else {
    for (let i = 0; i < 5; i++) {
      if (arrDescription[i] != "") {
        embed.setDescription(arrDescription[i]);
        await interaction.followUp({ embeds: [embed] });
      };
    };
  };

  return;
};


async function teamSingle(interaction, client) {
  const iTeamAbbr = await interaction.options.getString("team");

  functions.sendClanInfo(interaction, client, iTeamAbbr.toLowerCase());

  return;
};


async function leagueStandings(interaction, client) {
  let iLeague = await interaction.options.getString("league");
  let iRound = await interaction.options.getString("round");

  let embed = new EmbedBuilder();
  embed.setColor(config.color[iLeague]);
  let footer = `${config.footer} ${config.league[iLeague]} SEASON ${config.season[iLeague]}`;
  embed.setFooter({ text: footer, iconURL: config.urlImage.jwc });

  let mongoLeagueStats = await client.clientMongo.db("jwc").collection("leagues").findOne(
    { league: iLeague },
    { projection: { standings: 1, standings_gs: 1, _id: 0 } }
  );

  let strRound = "";
  if (iLeague == "five") {
    if (iRound == "qualifier") {
      strRound = "QUALIFIER";
    }
    else if (iRound == "group_stage") {
      strRound = "GROUP STAGE";
    }
    else if (!iRound) {
      const weekNow = await functions.getWeekNow("five");
      if (weekNow <= 5) {
        strRound = "QUALIFIER";
      }
      else {
        strRound = "GROUP STAGE";
      };
    };
  };

  let title = "";
  if (iLeague != "five") {
    const weekNow = await functions.getWeekNow(iLeague);
    title = `**STANDINGS** ${config.leaguePlusEmote[iLeague]}`;
    if (weekNow <= config.weeksQ[iLeague]) {
      title += ` | WEEK ${weekNow}`;
    };
  }
  else if (iLeague == "five") {
    if (strRound == "QUALIFIER") {
      const weekNow = await functions.getWeekNow(iLeague);
      title = `**QUALIFIER STANDINGS** ${config.leaguePlusEmote[iLeague]}`;
      if (weekNow <= config.weeksQ[iLeague]) {
        title += ` | WEEK ${weekNow}`;
      };
    }
    else if (strRound == "GROUP STAGE") {
      title = `**GROUP STAGE STANDINGS** ${config.leaguePlusEmote[iLeague]}`;
    };
  };
  embed.setTitle(title);

  let description = "";
  try {
    if (iLeague != "five") {
      description = await setDescriptionStandings(iLeague, mongoLeagueStats.standings);
    }
    else if (iLeague == "five") {
      if (strRound == "QUALIFIER") {
        description = await setDescriptionStandings(iLeague, mongoLeagueStats.standings);
      }
      else if (strRound == "GROUP STAGE") {
        description = await setDescriptionStandingsGroupStage(mongoLeagueStats.standings_gs);
      };
    };
  }
  catch (error) {
    console.error(error);
    description = `_no data_`;
  };
  embed.setDescription(description);

  await interaction.followUp({ embeds: [embed] });

  // 画像
  if (iLeague == "five") {
    if (strRound == "QUALIFIER") {
      const attachment = await fCanvas.standings(iLeague, mongoLeagueStats.standings, mongoLeagueStats);
      await interaction.followUp({ files: [attachment] });
      const attachment2 = await fCanvas.standingsLandscape(iLeague, mongoLeagueStats.standings, mongoLeagueStats, strRound);
      await interaction.followUp({ files: [attachment2] });
    }
    else if (strRound == "GROUP STAGE") {
      const attachment2 = await fCanvas.standingsLandscape(iLeague, mongoLeagueStats.standings_gs, mongoLeagueStats, strRound);
      await interaction.followUp({ files: [attachment2] });
    };
  }
  else if (iLeague == "j1") {
    const attachment = await fCanvas.standings(iLeague, mongoLeagueStats.standings, mongoLeagueStats);
    await interaction.followUp({ files: [attachment] });
    const attachment2 = await fCanvas.standingsLandscape(iLeague, mongoLeagueStats.standings_gs, mongoLeagueStats, strRound = null);
    await interaction.followUp({ files: [attachment2] });
  }
  else {
    const attachment = await fCanvas.standings(iLeague, mongoLeagueStats.standings, mongoLeagueStats);
    await interaction.followUp({ files: [attachment] });
  };

  /*
  if (iLeague == "swiss") {
    let message = ":arrow_down_small: **Official Standings [Regular Season]**\n";
    message += config.link.tonamel;
    interaction.followUp({ content: message });

    message = ":arrow_down_small: **Playoffs**\n";
    message += config.link.challonge[iLeague];
    interaction.followUp({ content: message });
  };
  */

  return;
};

async function setDescriptionStandings(iLeague, standings) {
  let return_str = "";

  await Promise.all(standings.map(async (team, index) => {
    return_str += `${team.rank}. **${team.team_name}**`;
    if (team.division) {
      return_str += ` ${config.emote[`div_${team.division.toLowerCase()}`]}`;
    };
    return_str += `\n`;

    if (team.sumScore) {
      let sumScore = team.sumScore;

      return_str += `**${sumScore.nWin}**-${sumScore.nLoss}`;
      if (sumScore.nTie > 0) {
        return_str += `-${sumScore.nTie}`;
      };
      if (sumScore.starDifference >= 0) {
        return_str += ` ${config.emote.star}+`;
      }
      else {
        return_str += ` ${config.emote.star}`;
      };
      return_str += `${sumScore.starDifference} `;

      /*if (iLeague == "mix") {
        if (sumScore.ptDefDifference >= 0) {
          return_str += `${config.emote.shield}+`;
        }
        else {
          return_str += `${config.emote.shield}`;
        };
        return_str += `${sumScore.ptDefDifference} `;
      };*/

      return_str += ` _${sumScore.clan.destruction}%_ `;

      if (iLeague == "swiss") {
        return_str += `:boom:`;
        if (sumScore.clan.allAttackTypes) {
          return_str += `${sumScore.clan.allAttackTypes.nTriple.total}`;
          return_str += `/${sumScore.clan.allAttackTypes.nAt.total}`;
          return_str += ` (${sumScore.clan.allAttackTypes.hitrate.total}%)`;
        }
        else {
          return_str += `0/0 (0%)`;
        };
      };

      if (sumScore.penalty != null) {
        return_str += `\n`;
        return_str += `_${sumScore.penalty.note}_`;
      };
      return_str += `\n`;
    };

    return_str += `\n`;
  }));

  return return_str;
};

async function setDescriptionStandingsGroupStage(standings) {
  let return_str = "";

  await Promise.all(standings.map(async (team, index) => {
    return_str += `${team.rank}. **${team.team_name}**`;
    return_str += `\n`;

    if (team.sumScore != null) {
      let sumScore = team.sumScore;

      return_str += `**${sumScore.nWin}**-${sumScore.nLoss}`;
      if (sumScore.nTie > 0) {
        return_str += `-${sumScore.nTie}`;
      };
      if (sumScore.starDifference >= 0) {
        return_str += ` ${config.emote.star}+`;
      }
      else {
        return_str += ` ${config.emote.star}`;
      };
      return_str += `${sumScore.starDifference} `;

      return_str += ` _${sumScore.clan.destruction}%_ `;

      if (sumScore.penalty != null) {
        return_str += `\n`;
        return_str += `_${sumScore.penalty.note}_`;
      };
      return_str += `\n`;
    };
    return_str += `\n`;
  }));

  return return_str;
};


async function transfer(interaction, client) {
  let iLeague = await interaction.options.getString("league");
  let leagueM = iLeague;

  const query = { $or: [{ [`homeClanAbbr.${leagueM}`]: { $ne: "" } }, { [`lastSeason.${leagueM}.homeClanAbbr`]: { $ne: "" } }], status: true };
  const sort = { [`homeClanAbbr.${leagueM}`]: 1, [`lastSeason.${leagueM}.homeClanAbbr`]: 1 };
  const options = { projection: { _id: 0, tag: 1, name: 1, homeClanAbbr: 1, lastSeason: 1, townHallLevel: 1 } };
  const cursor = client.clientMongo.db("jwc").collection("accounts").find(query, options).sort(sort);
  let accs = await cursor.toArray();
  await cursor.close();

  let arrDescription = [];
  await Promise.all(accs.map(async (acc, index) => {
    arrDescription[index] = "";
    const homeTeamAbbrNew = acc.homeClanAbbr[leagueM];
    let homeTeamAbbrOld = "";
    if (acc.lastSeason == null) {
      homeTeamAbbrOld = "";
    }
    else if (acc.lastSeason[leagueM] == null) {
      homeTeamAbbrOld = "";
    }
    else {
      homeTeamAbbrOld = acc.lastSeason[leagueM].homeClanAbbr ?? "";
    };
    if (homeTeamAbbrOld != homeTeamAbbrNew) {
      if (homeTeamAbbrOld != "" && homeTeamAbbrNew != "") {
        arrDescription[index] += `${homeTeamAbbrOld.toUpperCase()} :arrow_right: ${homeTeamAbbrNew.toUpperCase()}`;
      }
      else if (homeTeamAbbrNew != "") {
        arrDescription[index] += `*FREE* :arrow_right: ${homeTeamAbbrNew.toUpperCase()}`;
      }
      else if (homeTeamAbbrOld != "") {
        arrDescription[index] += `${homeTeamAbbrOld.toUpperCase()} :arrow_right: *FREE*`;
      };
      arrDescription[index] += ` ${config.emote.thn[acc.townHallLevel]}`;
      arrDescription[index] += ` **${functions.nameReplacer(acc.name)}**\n`;
    };
  }));

  let description = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
  let counter = 0;
  for (let i = 0; i < accs.length; i++) {
    if (arrDescription[i] != "") {
      counter += 1;
      if (counter <= 25) {
        description[0] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 50) {
        description[1] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 75) {
        description[2] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 100) {
        description[3] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 125) {
        description[4] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 150) {
        description[5] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 175) {
        description[6] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 200) {
        description[7] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 225) {
        description[8] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 250) {
        description[9] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 275) {
        description[10] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 300) {
        description[11] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 325) {
        description[12] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 350) {
        description[13] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 375) {
        description[14] += `${counter}. ${arrDescription[i]}`;
      }
      else if (counter <= 400) {
        description[15] += `${counter}. ${arrDescription[i]}`;
      };
    };
  };

  if (description[0] == "") {
    description = "*no transfer*";
  };

  let title = `**TRANSFER** | ${config.league[iLeague]}`;

  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setColor(config.color[leagueM]);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });

  for (let i = 0; i < 16; i++) {
    if (description[i] != "") {
      embed.setDescription(description[i]);
      await interaction.followUp({ embeds: [embed] });
    };
  };

  return;
};


async function zapQuake(interaction, client) {
  const lvTH = interaction.options.getInteger("th_level") ?? config.lvTH;
  const thLevelStr = `th${lvTH}`;

  const embed = new EmbedBuilder();

  let title = `ZAPQUAKE | TH${lvTH}`;
  embed.setTitle(title);

  const urlThumbnail = config.urlImage[thLevelStr];
  embed.setThumbnail(urlThumbnail);

  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });

  let description = "";
  let description10Plus = "";

  const query = { name: "zapQuakeTable" };
  const zapQuakeTable = await client.clientMongo.db("jwc").collection("config").findOne(query);

  zapQuakeTable[thLevelStr].forEach((item, index) => {
    //console.log(item.name);
    let tempDescription = `* ${item.name} ${item.emote} *${item.hp}*\n`;

    let minSumSpell = 99;
    item.zq.forEach((zq, zqIndex) => {
      if (zqIndex == 0) {
        tempDescription += `${config_coc.emote.lightning} ${zq.numLightning}`;
        if (item.id < 50 && Math.abs(zq.hpRemaining) < config_coc.buildings[4].repair[thLevelStr]) {
          tempDescription += `\*`;
        }
        else if (item.id < 50 && Math.abs(zq.hpRemaining) < 2 * config_coc.buildings[4].repair[thLevelStr]) {
          tempDescription += `\\*\\*`;
        };
        minSumSpell = zq.numLightning;
      }
      else {
        let sumSpell = zq.numLightning + zqIndex;
        if (sumSpell <= minSumSpell) {
          if (zqIndex == 1) {
            tempDescription += ` / ${config_coc.emote.lightning}${config_coc.emote.earthquake}`;
          };
          if (zqIndex >= 2) {
            tempDescription += ` *or*`;
          };
          tempDescription += ` **${zq.numLightning}**-${zqIndex}`;
          if (Math.abs(zq.hpRemaining) < config_coc.buildings[4].repair[thLevelStr]) {
            tempDescription += `\*`;
          }
          else if (Math.abs(zq.hpRemaining) < 2 * config_coc.buildings[4].repair[thLevelStr]) {
            tempDescription += `\\*\\*`;
          };
          minSumSpell = sumSpell;
        };
      };
    });
    //console.dir(minSumSpell);
    tempDescription += "\n";

    let tempDescriptionCc = ``;
    let counterCc = 0;
    item.zqCc.forEach((zqCc, zqCcIndex) => {
      let sumSpell = zqCc.numLightningCc + zqCcIndex;
      //console.dir(sumSpell);
      if (sumSpell < minSumSpell) {
        if (counterCc == 0) {
          tempDescriptionCc += `(CC)`;
          counterCc++;
        };
        if (zqCcIndex == 0) {
          tempDescriptionCc += ` ${config_coc.emote.lightning}`;
          tempDescriptionCc += ` ${zqCc.numLightningCc}`;
        }
        else if (zqCcIndex == 1) {
          tempDescriptionCc += ` ${config_coc.emote.lightning}${config_coc.emote.earthquake}`;
          tempDescriptionCc += ` **${zqCc.numLightningCc}**-${zqCcIndex}`;
        };
        if (zqCcIndex >= 2) {
          tempDescriptionCc += ` *or*`;
          tempDescriptionCc += ` **${zqCc.numLightningCc}**-${zqCcIndex}`;
        };
        if (Math.abs(zqCc.hpRemaining) < config_coc.buildings[4].repair[thLevelStr]) {
          tempDescriptionCc += `\*`;
        }
        else if (Math.abs(zqCc.hpRemaining) < 2 * config_coc.buildings[4].repair[thLevelStr]) {
          tempDescriptionCc += `\\*\\*`;
        };
      };
    });
    if (tempDescriptionCc.length > 0) {
      tempDescription += tempDescriptionCc + "\n";
    };
    tempDescription += "\n";

    if (item.id < 10) {
      description += tempDescription;
    }
    else {
      description10Plus += tempDescription;
    };
  });

  embed.setDescription(description + description10Plus);
  await interaction.followUp({ embeds: [embed] });

  /*
  embed.setDescription(description);
  await interaction.followUp({ embeds: [embed] });
  embed.setDescription(description10Plus);
  await interaction.followUp({ embeds: [embed] });
  */

  let descriptionAdd = "";
  if (lvTH >= 14) {
    descriptionAdd += `${config.emote.builder} \* *quickly before 1st repair by the builder*\n`;
    descriptionAdd += `${config.emote.builder} \\*\\* *before 2nd repair*\n`;
    descriptionAdd += `+${config_coc.buildings[4].repair[thLevelStr]} per hit\n`;
    descriptionAdd += `\n`;
  };
  descriptionAdd += `### Damage\n`;
  descriptionAdd += `${config_coc.emote.lightning} ${config_coc.damage.lightning[thLevelStr]}\n`;
  descriptionAdd += `${config_coc.emote.lightning} ${config_coc.damage.lightningDonated[thLevelStr]} (*donated*)\n`;
  descriptionAdd += `x1 ${config_coc.emote.earthquake} ${100 - Math.round(config_coc.damage.earthquake[1] * 100)}%\n`;
  descriptionAdd += `x2 ${config_coc.emote.earthquake} ${100 - Math.round(config_coc.damage.earthquake[2] * 100)}%\n`;
  descriptionAdd += `x3 ${config_coc.emote.earthquake} ${100 - Math.round(config_coc.damage.earthquake[3] * 100)}%\n`;
  descriptionAdd += `\n`;
  if (lvTH <= 16) {
    descriptionAdd += `* (CC) when using donated spells from Clan Castle\n`;
    descriptionAdd += `+${config_coc.damage.lightningAdd[thLevelStr]} with **${config_coc.numCcSpells[thLevelStr]}** donated lightning spells\n`;
    descriptionAdd += `\n`;
  };

  embed.setDescription(descriptionAdd);
  await interaction.followUp({ embeds: [embed] });

  /*
  for (let thLevel = 12; thLevel <= 17; thLevel++) {
    await fMongo.createZapQuakeTable(client.clientMongo, thLevel);
  };
  */

  /*
  if (lvTH == null) {
    title = "⚡️ **TH16** ⚡️";
    description = "_since June 2024 update_";
    name = "Arle";
    avator = config.urlImage.arle;
    urlAuthor = "https://twitter.com/arle_coc";
    urlThumbnail = config.urlImage.th16;
    urlImage = "https://cdn.discordapp.com/attachments/884266417812291645/1264922122728509511/IMG_1231.png";
  }
  else {
    title = `⚡️ **TH${lvTH.toUpperCase()}** ⚡️`;
    description = "_since December 2023 update_";
    name = "Thorfinn | GaihaziBomber 2";
    avator = config.urlImage.thorfinn;
    urlAuthor = "https://ja.wikipedia.org/wiki/%E3%83%B4%E3%82%A3%E3%83%B3%E3%83%A9%E3%83%B3%E3%83%89%E3%83%BB%E3%82%B5%E3%82%AC";
    let arrUrlThumbnail = {};
    arrUrlThumbnail.th16 = config.urlImage.th16;
    arrUrlThumbnail.th15 = config.urlImage.th15;
    arrUrlThumbnail.th14 = config.urlImage.th14;
    arrUrlThumbnail.th13 = config.urlImage.th13;
    arrUrlThumbnail.th12 = config.urlImage.th12;
    urlThumbnail = arrUrlThumbnail[`th${lvTH}`];
    let arrUrlImage = {};
    arrUrlImage.th16 = "https://cdn.discordapp.com/attachments/990991444749717605/1184810571175043072/TH16_202312_1.png";
    arrUrlImage.th15 = "https://cdn.discordapp.com/attachments/990991444749717605/1184810532314820709/TH15_202312.png";
    arrUrlImage.th14 = "https://cdn.discordapp.com/attachments/990991444749717605/1184810492640903188/TH14_202312_1.png";
    arrUrlImage.th13 = "https://cdn.discordapp.com/attachments/990991444749717605/1184810456024621098/TH13_202312.png";
    arrUrlImage.th12 = "https://cdn.discordapp.com/attachments/990991444749717605/1184810403721662504/TH12_202312.png";
    urlImage = arrUrlImage[`th${lvTH}`];
  };

  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setDescription(description);
  embed.setAuthor({ name: name, iconURL: avator, url: urlAuthor });
  embed.setThumbnail(urlThumbnail);
  embed.setImage(urlImage);
  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });

  await interaction.followUp({ embeds: [embed] });
  */
};


async function fireball(interaction, client) {
  const lvTH = interaction.options.getInteger("th_level") ?? config.lvTH;
  const thLevelStr = `th${lvTH}`;

  const embed = new EmbedBuilder();

  let title = `${config_coc.emote.fireball} FIREBALL | TH${lvTH}`;
  embed.setTitle(title);

  const urlThumbnail = config.urlImage[thLevelStr];
  embed.setThumbnail(urlThumbnail);

  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });

  let description = "";
  let arrDescription = ["", "", "", "", ""]; // eq0, eq1, eq2, eq3, heroes
  const query = { name: "fireballTable" };
  const fireballTable = await client.clientMongo.db("jwc").collection("config").findOne(query);

  fireballTable[thLevelStr].forEach((item, index) => {
    if (item.numEq >= 0) {
      arrDescription[item.numEq] += `* ${item.name} ${item.emote} *${item.hp}*`;
      if (Math.abs(item.hpRemaining) < config_coc.buildings[4].repair[thLevelStr]) {
        arrDescription[item.numEq] += ` \*`;
      }
      else if (Math.abs(item.hpRemaining) < 2 * config_coc.buildings[4].repair[thLevelStr]) {
        arrDescription[item.numEq] += `\\*\\*`;
      };
      arrDescription[item.numEq] += `\n`;
    }
    else {
      arrDescription[4] += `* ${item.name} ${item.emote} *${item.hp}*\n`;
      if (item.numLgCc < item.numLg) {
        arrDescription[4] += `(CC) ${config_coc.emote.lightning} ${item.numLgCc}`;
      }
      else {
        arrDescription[4] += `${config_coc.emote.lightning} ${item.numLg}`;
      };
      arrDescription[4] += `\n`;
    };
  });

  arrDescription.forEach((item, index) => {
    if (item.length > 0) {
      if (index <= 3) {
        description += `### x${index} ${config_coc.emote.earthquake}\n`;
      }
      else if (index == 4) {
        description += `### HEROES\n`;
      };
      description += item;
      description += "\n";
    };
  });
  embed.setDescription(description);

  await interaction.followUp({ embeds: [embed] });

  let descriptionAdd = "";
  if (lvTH >= 14) {
    descriptionAdd += `${config.emote.builder} \* *quickly before 1st repair by the builder*\n`;
    descriptionAdd += `${config.emote.builder} \\*\\* *before 2nd repair*\n`;
    descriptionAdd += `+${config_coc.buildings[4].repair[thLevelStr]} per hit\n`;
    descriptionAdd += `\n`;
  };
  descriptionAdd += "### Hard Mode\n";
  descriptionAdd += `* Level: ${config_coc.maxLevel.heroEquipmentsHardMode.epic[thLevelStr]}\n`;
  descriptionAdd += "* Radius: 5 tiles\n";
  descriptionAdd += `\n`;
  descriptionAdd += `### Damage\n`;
  descriptionAdd += `${config_coc.emote.fireball} ${config_coc.damage.fireball[thLevelStr]}\n`;
  descriptionAdd += `${config_coc.emote.lightning} ${config_coc.damage.lightning[thLevelStr]}\n`;
  descriptionAdd += `${config_coc.emote.lightning} ${config_coc.damage.lightningDonated[thLevelStr]} (*donated*)\n`;
  descriptionAdd += `x1 ${config_coc.emote.earthquake} ${100 - Math.round(config_coc.damage.earthquake[1] * 100)}%\n`;
  descriptionAdd += `x2 ${config_coc.emote.earthquake} ${100 - Math.round(config_coc.damage.earthquake[2] * 100)}%\n`;
  descriptionAdd += `x3 ${config_coc.emote.earthquake} ${100 - Math.round(config_coc.damage.earthquake[3] * 100)}%\n`;

  descriptionAdd += "\n";
  descriptionAdd += "### Effective Damage Range\n";
  //descriptionAdd += "Please refer to the image below.\n";
  let urlImage = config.urlImage.fireball;
  embed.setImage(urlImage);

  embed.setDescription(descriptionAdd);

  await interaction.followUp({ embeds: [embed] });

  /*
  for (let thLevel = 12; thLevel <= 17; thLevel++) {
    await fMongo.createFireballTable(client.clientMongo, thLevel);
  };
  */
};


async function usefulLinks(interaction, client) {
  const iItem = await interaction.options.getString("item");

  let link = "";
  let title = "";
  let description = "";
  let content = "";

  if (iItem == "rule") {
    link = client.config.link[iItem];
    title = "**RULEBOOK**";
    description += `* **J1 / J2** *SEASON ${config.link.rule.j.season}*\n`;
    description += `[__document__](${config.link.rule.j.url})\n`;
    description += `* **SWISS** *SEASON ${config.link.rule.swiss.season}*\n`;
    description += `[__document__](${config.link.rule.swiss.url})\n`;
    description += `* **MIX** *SEASON ${config.link.rule.mix.season} 10v*\n`;
    description += `[__document__](${config.link.rule.mix.url})\n`;
    description += `* **MIX** *SEASON ${config.link.rule.mix.season} 5v*\n`;
    description += `[__document__](${config.link.rule.mix5v.url})\n`;
    description += `* **5V** *SEASON ${config.link.rule.five.season}*\n`;
    description += `[__document__](${config.link.rule.five.url})\n`;
  }
  else if (iItem == "server") {
    let content = "";
    content = `* Main Server\n${config.link.server.main}`;
    await interaction.followUp({ content: content });
    content = `* Reps Server\n${config.link.server.reps}`;
    await interaction.followUp({ content: content });
    content = `* eSports (5V) Server\n${config.link.server.five}`;
    await interaction.followUp({ content: content });
    content = `* Bot Server\n${config.link.server.bot}`;
    await interaction.followUp({ content: content });
    return;
  }
  else if (iItem.includes("playerRegistration") == true || iItem.includes("bet") == true) {
    link = config.link[iItem];
    await interaction.followUp({ content: link });

    if (iItem == "betLeague" || iItem == "betWeek") {
      await interaction.followUp({ content: ":arrow_down_small: your discord ID" });
      await interaction.followUp({ content: interaction.user.id });
    };
    return;
  }
  else if (iItem == "scStore") {
    await interaction.followUp({ content: "https://store.supercell.com/ja/game/clashofclans" });
    return;
  }
  else {
    title = "**NULL**";
    description += `_under construction_`;
  };

  let embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(client.config.color.main)
    .setFooter({ text: client.config.footer, iconURL: client.config.urlImage.jwc });

  await interaction.followUp({ embeds: [embed] });
};


async function champions(interaction, client) {
  let iLeague = await interaction.options.getString("league");

  const arrHistory = config_history.history[iLeague];
  const arrChampions = config_history.champions[iLeague];

  //console.dir(arrHistory);
  //console.dir(arrChampions);

  let title = "";
  let description = "";

  title = `${config.emote.jwc} CHAMPIONS :trophy:`;
  description = "";

  for (const history of arrHistory) {
    description += `SEASON ${history.season}`;
    if (iLeague == "mix") {
      for (const lvTH of history.lvTH) {
        description += ` ${config.emote.thn[lvTH]}`;
      };
    }
    else {
      description += ` ${config.emote.thn[history.lvTH]}`;
    };
    description += ` _${history.year}_`;
    description += `\n`;
    for (const champion of arrChampions[`s${history.season}`]) {
      description += `${config.emote.place[champion.rank]} **${champion.name}**`;
      if (champion.note != "") {
        description += ` [${champion.note}]`;
      };
      description += `\n`;
    };
    description += `\n`;
  };

  let footer = `${config.footer} ${config.league[iLeague]}`;

  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setDescription(description);
  embed.setColor(config.color[iLeague]);
  embed.setFooter({ text: footer, iconURL: config.urlImage.jwc });

  await interaction.followUp({ embeds: [embed] });
};


async function streamer(interaction, client) {
  let title = "";
  let description = "";

  title = `:tv: STREAMER`;
  description = "";

  const query = { streamer: true };
  const projection = { _id: 0, pilotDC: 1, townHallLevel: 1, name: 1, tag: 1 };
  const sort = { townHallLevel: -1, "pilotDC.id": 1 };
  const option = { projection: projection, sort: sort };
  const cursor = client.clientMongo.db("jwc").collection("accounts").find(query, option);
  const mongoStreamers = await cursor.toArray();
  await cursor.close();

  let arrDescription = [];
  if (mongoStreamers.length != 0) {
    await Promise.all(mongoStreamers.map(async (acc, index) => {
      arrDescription[index] = index + 1;
      arrDescription[index] += ". ";
      arrDescription[index] += await functions.getAccInfoDescriptionMain(acc, formatLength = "short");
      arrDescription[index] += `:bust_in_silhouette: <@${acc.pilotDC.id}>\n`;
      arrDescription[index] += `\n`;
    }));
  }
  else {
    description = `*no streamer*`;
  };

  arrDescription.forEach(function(value, index) {
    description += value;
  });

  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setDescription(description);
  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });

  await interaction.followUp({ embeds: [embed] });
};


/*
async function rosterSelected(interaction, client) {
  const iLeague = await interaction.options.getString("league");
  const teamAbbr = await interaction.options.getString("team");

  let json = {};
  json.type = "getRosterSelected";
  json.league = iLeague;
  json.teamAbbr = teamAbbr;

  let param = {
    "method": "POST",
    "Content-Type": "application/json",
    "body": JSON.stringify(json),
  };

  try {
    const response = await fetch(process.env.GAS_URI, param);
    const data = await response.json();
    arrAccountsSelected = data.accs;
    await rosterSelectedMain(interaction, client, arrAccountsSelected, iLeague, teamAbbr);
  }
  catch (error) {
    console.error("Fetch error: ", error);
  };

  return;
};

async function rosterSelectedMain(interaction, client, arrAccountsSelected, iLeague, teamAbbr) {
  let dbValueClan = await client.clientMongo.db("jwc").collection("clans").findOne({ clan_abbr: teamAbbr });

  let arrDescription = [];
  let description = "";

  await Promise.all(arrAccountsSelected.map(async (acc, index) => {
    try {
      arrDescription[index] = "";

      const scAcc = await client.clientCoc.getPlayer(acc.tag);
      const mongoAcc = await client.clientMongo.db("jwc").collection("accounts").findOne({ tag: acc.tag });

      arrDescription[index] += `${config.emote[`th${scAcc.townHallLevel}`]}`;
      arrDescription[index] += ` **${nameReplacer(scAcc.name)}**`;
      if (scAcc.clan != null) {
        if (scAcc.clan.tag == dbValueClan.clan_tag) {
          arrDescription[index] += ` :ballot_box_with_check:`;
        };
      };
      arrDescription[index] += `\n`;
      arrDescription[index] += `${acc.pilotName}`;
      if (mongoAcc.pilotDC != "no discord acc" && mongoAcc.pilotDC != null && mongoAcc.pilotDC != "") {
        arrDescription[index] += `  <@!${mongoAcc.pilotDC.id}>`;
      };
      arrDescription[index] += `\n`;
    }
    catch (error) {
      if (error.reason === "notFound") {
        arrDescription[index] += `${acc.tag} `;
        arrDescription[index] += ` :x:_notFound_`;
      }
      else {
        arrDescription[index] += `${acc.tag} `;
        arrDescription[index] += ` :x:_ERROR_`;
      }
    };
  }));

  for (let i = 0; i < arrAccountsSelected.length; i++) {
    description += arrDescription[i];
  };
  if (description == "") {
    description = "*no selected account*";
  };
  description += `\n`;
  description += `:ballot_box_with_check: *now in clan*`;

  let title = `**SELECTED** | ${dbValueClan.clan_abbr.toUpperCase()}`;
  let footer = `${config.footer} ${config.league[iLeague]}`;

  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setDescription(description);
  embed.setColor(config.color[iLeague])
  embed.setFooter({ text: footer, iconURL: config.urlImage.jwc })
  embed.setAuthor({ name: dbValueClan.team_name, iconURL: dbValueClan.logo_url });

  await interaction.followUp({ embeds: [embed] });

  return;
};
*/