const { EmbedBuilder } = require("discord.js");

const config = require("../config.js");
const config_coc = require("../config_coc.js");
const functions = require("./functions.js");

async function registerAcc(
  client,
  playerTag,
  pilotName,
  league,
  clanAbbr,
  pilotDC,
) {
  let listing = {};
  listing.status = true;

  let mongoAcc = await client.clientMongo
    .db("jwc")
    .collection("accounts")
    .findOne(
      { tag: playerTag },
      {
        projection: {
          homeClanAbbr: 1,
          league: 1,
          pilotName: 1,
          pilotDC: 1,
          _id: 0,
        },
      },
    );

  if (mongoAcc == null) {
    // 初回登録
    listing.tag = playerTag;
    listing.homeClanAbbr = { j: "", swiss: "", mix: "", five: "" };
    listing.league = { j: "", swiss: "", mix: "", five: "" };
    listing.pilotName = { j: "", swiss: "", mix: "", five: "" };
    let resultScan = await functions.scanAcc(client.clientCoc, playerTag);
    listing.name = resultScan.scPlayer.name;
    listing.townHallLevel = resultScan.scPlayer.townHallLevel;

    if (typeof pilotDC === "string") {
      let pilotDCnew = { id: pilotDC };
      listing.pilotDC = pilotDCnew;
    } else if (pilotDC != null) {
      listing.pilotDC = pilotDC;
    }
  } else {
    // 追加登録（更新）
    if (mongoAcc.homeClanAbbr == null) {
      listing.homeClanAbbr = { j: "", swiss: "", mix: "", five: "" };
    } else {
      listing.homeClanAbbr = mongoAcc.homeClanAbbr;
    }
    if (mongoAcc.league == null) {
      listing.league = { j: "", swiss: "", mix: "", five: "" };
    } else {
      listing.league = mongoAcc.league;
    }
    if (mongoAcc.pilotName == null) {
      listing.pilotName = { j: "", swiss: "", mix: "", five: "" };
    } else {
      listing.pilotName = mongoAcc.pilotName;
    }

    if (
      mongoAcc.pilotDC == null ||
      mongoAcc.pilotDC == "" ||
      mongoAcc.pilotDC == "no discord acc"
    ) {
      if (typeof pilotDC === "string") {
        let pilotDCnew = { id: pilotDC };
        listing.pilotDC = pilotDCnew;
      } else if (pilotDC != null) {
        listing.pilotDC = pilotDC;
      }
    }
  }

  if (league != null) {
    if (league.indexOf("j") != -1) {
      listing.homeClanAbbr.j = clanAbbr;
      listing.league.j = league;
      if (pilotName != null) {
        listing.pilotName.j = pilotName;
      }
    } else if (league.indexOf("swiss") != -1) {
      listing.homeClanAbbr.swiss = clanAbbr;
      listing.league.swiss = league;
      if (pilotName != null) {
        listing.pilotName.swiss = pilotName;
      }
    } else if (league.indexOf("mix") != -1) {
      listing.homeClanAbbr.mix = clanAbbr;
      listing.league.mix = league;
      if (pilotName != null) {
        listing.pilotName.mix = pilotName;
      }
    } else if (league.indexOf("five") != -1) {
      listing.homeClanAbbr.five = clanAbbr;
      listing.league.five = league;
      if (pilotName != null) {
        listing.pilotName.five = pilotName;
      }
    }
  }

  if (mongoAcc == null) {
    // 初回登録
    await client.clientMongo
      .db("jwc")
      .collection("accounts")
      .insertOne(listing);
  } else {
    // 追加登録（更新）
    await client.clientMongo
      .db("jwc")
      .collection("accounts")
      .updateOne({ tag: playerTag }, { $set: listing });
  }

  return;
}
exports.registerAcc = registerAcc;

async function updateAcc(client, tagAccount) {
  let mongoAcc = await client.clientMongo
    .db("jwc")
    .collection("accounts")
    .findOne({ tag: tagAccount });

  let scPlayer = null;
  try {
    scPlayer = await client.clientCoc.getPlayer(tagAccount);
  } catch (error) {
    console.log(error);
    if (error.reason == "notFound") {
      let myEmbed = new EmbedBuilder();
      let title = `**ERROR**`;
      let description = "";
      description += `${tagAccount}\n`;
      description += `*${error.reason}*\n`;
      myEmbed.setTitle(title);
      myEmbed.setDescription(description);
      myEmbed.setColor(config.color.red);
      myEmbed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
      await client.channels.cache
        .get(config.logch.freeBotRoom)
        .send({ embeds: [myEmbed] });
    }
    return;
  }

  let listing = {};
  listing.unixTimeRequest = Math.round(Date.now() / 1000);
  listing.name = scPlayer.name;
  listing.townHallLevel = scPlayer.townHallLevel;
  listing.trophies = scPlayer.trophies;
  listing.warStars = scPlayer.warStars;
  listing.attackWins = scPlayer.attackWins;
  listing.defenseWins = scPlayer.defenseWins;

  let attackWinsStart = 0;
  let defenseWinsStart = 0;
  if (mongoAcc != null) {
    if (mongoAcc.attackWins != null) {
      attackWinsStart = mongoAcc.attackWins;
    }
    if (mongoAcc.defenseWins != null) {
      defenseWinsStart = mongoAcc.defenseWins;
    }
  }
  let diffAttackWins = scPlayer.attackWins - attackWinsStart;
  let diffDefenseWins = scPlayer.defenseWins - defenseWinsStart;
  if (diffAttackWins < 0) {
    diffAttackWins = scPlayer.attackWins;
  }
  if (diffDefenseWins < 0) {
    diffDefenseWins = scPlayer.defenseWins;
  }
  listing.diffAttackWins = diffAttackWins;
  listing.diffDefenseWins = diffDefenseWins;

  // レジェンドリーグの情報を処理
  listing.legend = mongoAcc?.legend ?? {};
  if (scPlayer.legendStatistics) {
    if (mongoAcc?.legend?.current) {
      listing.legend.difference =
        scPlayer.trophies - mongoAcc.legend.current.trophies;
      listing.legend.previousDay = {
        trophies: mongoAcc.legend.current.trophies,
        rank: mongoAcc.legend.current.rank ?? null,
        id: mongoAcc.legend.current.id ?? null,
      };
    } else {
      listing.legend.difference = 0;
      listing.legend.previousDay = null;
    }

    // 基本情報を更新
    listing.legend.legendTrophies = scPlayer.legendStatistics.legendTrophies;
    listing.legend.current = scPlayer.legendStatistics.currentSeason ?? null;
    listing.legend.previous = scPlayer.legendStatistics.previousSeason ?? null;
  } else if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    // TH低いとlegendなのにlegendStatisticsがない
    listing.legend = mongoAcc?.legend ?? {};

    if (mongoAcc?.legend?.current) {
      listing.legend.difference =
        scPlayer.trophies - mongoAcc.legend.current.trophies;
      listing.legend.previousDay = {
        trophies: mongoAcc.legend.current.trophies,
        rank: mongoAcc.legend.current.rank ?? null,
        id: mongoAcc.legend.current.id ?? null,
      };
      listing.legend.current.trophies = scPlayer.trophies;
    } else {
      listing.legend.current = {
        trophies: scPlayer.trophies,
      };
      listing.legend.difference = 0;
      listing.legend.previousDay = null;
    }
  }

  listing.leagueTier = scPlayer.leagueTier;

  // トロフィー履歴の更新
  /*const arrTrophies = await updateTrophyHistory(
    client,
    mongoAcc,
    scPlayer,
    diffAttackWins,
  );
  listing.trophiesHistory = arrTrophies;*/

  // ユニット、兵器、ペット
  let lvTroops = {
    normal: { level: 0, maxLevel: 0 },
    dark: { level: 0, maxLevel: 0 },
  };
  let lvPets = { level: 0, maxLevel: 0 };
  let lvSieges = { level: 0, maxLevel: 0 };

  // 通常ユニットと闇ユニット
  scPlayer.homeTroops.forEach((troop) => {
    const normalTroop = config_coc.troops.normal.find(
      (item) => item.name === troop.name,
    );
    const darkTroop = config_coc.troops.dark.find(
      (item) => item.name === troop.name,
    );

    if (normalTroop) {
      lvTroops.normal.level += troop.level;
      lvTroops.normal.maxLevel +=
        normalTroop.maxLevel[`th${scPlayer.townHallLevel}`] ?? 0;
    } else if (darkTroop) {
      lvTroops.dark.level += troop.level;
      lvTroops.dark.maxLevel +=
        darkTroop.maxLevel[`th${scPlayer.townHallLevel}`] ?? 0;
    }
  });

  // ヒーローペット
  scPlayer.heroPets.forEach((pet) => {
    const item = config_coc.pets.find((item) => item.name === pet.name);
    if (item) {
      lvPets.level += pet.level;
      lvPets.maxLevel += item.maxLevel[`th${scPlayer.townHallLevel}`] ?? 0;
    }
  });

  // 兵器
  scPlayer.siegeMachines.forEach((siege) => {
    const item = config_coc.sieges.find((item) => item.name === siege.name);
    if (item) {
      lvSieges.level += siege.level;
      lvSieges.maxLevel += item.maxLevel[`th${scPlayer.townHallLevel}`] ?? 0;
    }
  });

  listing.lvTroops = lvTroops;
  listing.lvPets = lvPets;
  listing.lvSieges = lvSieges;

  // 呪文
  let lvSpells = { normal: 0, dark: 0 };
  let normalSpells = { level: 0, maxLevel: 0 };
  let darkSpells = { level: 0, maxLevel: 0 };

  if (scPlayer.spells) {
    scPlayer.spells.forEach((spell) => {
      const normalSpell = config_coc.spells.normal.find(
        (normalSpell) => normalSpell.name === spell.name,
      );
      const darkSpell = config_coc.spells.dark.find(
        (darkSpell) => darkSpell.name === spell.name,
      );
      if (normalSpell) {
        normalSpells.level += spell.level;
        normalSpells.maxLevel +=
          normalSpell.maxLevel[`th${scPlayer.townHallLevel}`] ?? 0;
      } else if (darkSpell) {
        darkSpells.level += spell.level;
        darkSpells.maxLevel +=
          darkSpell.maxLevel[`th${scPlayer.townHallLevel}`] ?? 0;
      }
    });
  }

  lvSpells.normal = normalSpells;
  lvSpells.dark = darkSpells;
  listing.lvSpells = lvSpells;

  // ヒーロー
  let lvHeroes = { level: 0, maxLevel: 0, BK: 0, AQ: 0, GW: 0, RC: 0, MP: 0 };
  if (scPlayer.heroes != null) {
    scPlayer.heroes.map((hero) => {
      if (hero.village == "home") {
        lvHeroes.level += hero.level;
        if (hero.name == "Minion Prince") {
          lvHeroes.maxLevel +=
            config_coc.maxLevel.heroes.minionPrince[
              `th${scPlayer.townHallLevel}`
            ] ?? 0;
        } else {
          lvHeroes.maxLevel += hero.hallMaxLevel ?? 0;
        }
      }
      if (hero.name == "Barbarian King") {
        lvHeroes.BK = hero.level;
      } else if (hero.name == "Archer Queen") {
        lvHeroes.AQ = hero.level;
      } else if (hero.name == "Grand Warden") {
        lvHeroes.GW = hero.level;
      } else if (hero.name == "Royal Champion") {
        lvHeroes.RC = hero.level;
      } else if (hero.name == "Minion Prince") {
        lvHeroes.MP = hero.level;
      }
    });
  }
  listing.lvHeroes = lvHeroes;

  // ヒーロー装備の処理
  const processHeroEquipment = async () => {
    const lvHeroEquipment = {
      total: { level: 0, maxLevel: 0 },
      bk: { level: 0, maxLevel: 0 },
      aq: { level: 0, maxLevel: 0 },
      gw: { level: 0, maxLevel: 0 },
      rc: { level: 0, maxLevel: 0 },
      mp: { level: 0, maxLevel: 0 },
    };
    const epicEquipments = config_coc.heroEquipments.filter(
      (eq) => eq.type === "epic",
    );

    if (scPlayer.heroEquipment) {
      await Promise.all(
        scPlayer.heroEquipment.map((equipment) => {
          const foundEquipment = config_coc.heroEquipments.find(
            (e) => e.name === equipment.name,
          );

          if (foundEquipment) {
            const maxLevel =
              config_coc.maxLevel.heroEquipments[foundEquipment.type][
                `th${scPlayer.townHallLevel}`
              ] ?? 0;
            const key =
              equipment.name.replace(/\s+/g, "").charAt(0).toLowerCase() +
              equipment.name.replace(/\s+/g, "").slice(1);

            // 合計と個別の装備レベルを更新
            lvHeroEquipment.total.level += equipment.level;
            lvHeroEquipment.total.maxLevel += maxLevel;
            lvHeroEquipment[key] = { level: equipment.level, maxLevel };

            // ヒーロー別の装備レベルを更新
            if (foundEquipment.hero === "Barbarian King") {
              lvHeroEquipment.bk.level += equipment.level;
              lvHeroEquipment.bk.maxLevel += maxLevel;
            } else if (foundEquipment.hero === "Archer Queen") {
              lvHeroEquipment.aq.level += equipment.level;
              lvHeroEquipment.aq.maxLevel += maxLevel;
            } else if (foundEquipment.hero === "Grand Warden") {
              lvHeroEquipment.gw.level += equipment.level;
              lvHeroEquipment.gw.maxLevel += maxLevel;
            } else if (foundEquipment.hero === "Royal Champion") {
              lvHeroEquipment.rc.level += equipment.level;
              lvHeroEquipment.rc.maxLevel += maxLevel;
            } else if (foundEquipment.hero === "Minion Prince") {
              lvHeroEquipment.mp.level += equipment.level;
              lvHeroEquipment.mp.maxLevel += maxLevel;
            }
          }
        }),
      );
    }

    // 未所持の装備も0で初期化
    epicEquipments.forEach(({ name }) => {
      const key =
        name.replace(/\s+/g, "").charAt(0).toLowerCase() +
        name.replace(/\s+/g, "").slice(1);
      if (!lvHeroEquipment[key]) {
        lvHeroEquipment[key] = { level: 0, maxLevel: 0 };
      }
    });

    return lvHeroEquipment;
  };

  // メイン処理を非同期関数に変更
  const processAll = async () => {
    // ヒーロー装備の処理を実行
    listing.lvHeroEquipment = await processHeroEquipment();

    // 全レベルの集計
    let lvAll = { level: 0, maxLevel: 0 };
    lvAll.level =
      lvTroops.normal.level +
      lvTroops.dark.level +
      lvSpells.normal.level +
      lvSpells.dark.level +
      lvPets.level +
      lvSieges.level +
      lvHeroes.level +
      listing.lvHeroEquipment.total.level;

    lvAll.maxLevel =
      lvTroops.normal.maxLevel +
      lvTroops.dark.maxLevel +
      lvSpells.normal.maxLevel +
      lvSpells.dark.maxLevel +
      lvPets.maxLevel +
      lvSieges.maxLevel +
      lvHeroes.maxLevel +
      listing.lvHeroEquipment.total.maxLevel;

    // lvAllをlistingに追加するか、必要に応じて返す
    listing.lvAll = lvAll;

    await client.clientMongo
      .db("jwc")
      .collection("accounts")
      .updateOne({ tag: tagAccount }, { $set: listing });
  };

  // 関数を呼び出す
  await processAll();

  return;
}
exports.updateAcc = updateAcc;

async function deleteRoster(clientMongo, league, playerTag) {
  let mongoAcc = await clientMongo
    .db("jwc")
    .collection("accounts")
    .findOne({ tag: playerTag });
  let listingSet = {};
  listingSet.homeClanAbbr = mongoAcc.homeClanAbbr;
  if (league.includes("j")) {
    listingSet.homeClanAbbr.j = "";
  } else {
    listingSet.homeClanAbbr[league] = "";
  }
  const result = await clientMongo
    .db("jwc")
    .collection("accounts")
    .updateOne({ tag: playerTag }, { $set: listingSet });

  return [result, mongoAcc];
}
exports.deleteRoster = deleteRoster;

async function legends200(client) {
  const name = "legends200";
  let listing = {};
  listing.japan = await client.clientCoc.getPlayerRanks(
    config_coc.locationId.japan,
  );
  listing.global = await client.clientCoc.getPlayerRanks("global");
  listing.date = new Date();
  listing.unixTimeRequest = Math.round(Date.now() / 1000);
  await client.clientMongo
    .db("jwc")
    .collection("ranking")
    .updateOne({ name: name }, { $set: listing });
  console.dir("done: legends200");
  return;
}
exports.legends200 = legends200;

async function standings(clientMongo, league) {
  const query = {
    league: league,
    [`status.${functions.seasonToString(config.season[league])}`]: "true",
  };
  const options = {
    projection: { _id: 0, clan_abbr: 1, team_name: 1, division: 1, score: 1 },
  };
  let sort = {};
  if (league == "j1") {
    sort = {
      "score.sumQ.point": -1,
      "score.sumQ.numWar": 1,
      "score.sumQ.starDifference": -1,
      "score.sumQ.clan.destruction": -1,
      "score.sumQ.h2h": -1,
      clan_abbr: 1,
    };
  } else if (league == "j2") {
    sort = {
      "score.sum.point": -1,
      "score.sum.numWar": 1,
      "score.sum.starDifference": -1,
      "score.sum.clan.destruction": -1,
      clan_abbr: 1,
    };
  } else if (league == "mix") {
    sort = {
      "score.sumQ.point": -1,
      "score.sumQ.numWar": 1,
      "score.sumQ.starDifference": -1,
      "score.sumQ.clan.destruction": -1,
      clan_abbr: 1,
    };
  } else if (league == "swiss" || league == "five") {
    sort = {
      "score.sum.point": -1,
      //"score.sum.numWar": 1,
      "score.sum.starDifference": -1,
      "score.sum.clan.destruction": -1,
      clan_abbr: 1,
    };
  }

  const cursor = clientMongo
    .db("jwc")
    .collection("clans")
    .find(query, options)
    .sort(sort);
  let standings = await cursor.toArray();
  await cursor.close();

  let arrStandings = [];
  let teamStatsAbove = {};
  standings.forEach((team, index) => {
    let teamStats = {};
    if (team.score) {
      if (league == "j1" || league == "mix") {
        teamStats.sumScore = team.score.sumQ;
      } else if (league == "j2" || league == "swiss" || league == "five") {
        teamStats.sumScore = team.score.sum;
      }
      if (team.score.penalty != null) {
        teamStats.sumScore.penalty = team.score.penalty;
      }
      if (
        index != 0 &&
        teamStats.sumScore.point == teamStatsAbove.sumScore.point &&
        teamStats.sumScore.nWar == teamStatsAbove.sumScore.nWar &&
        teamStats.sumScore.starDifference ==
          teamStatsAbove.sumScore.starDifference &&
        teamStats.sumScore.clan.destruction ==
          teamStatsAbove.sumScore.clan.destruction &&
        teamStats.sumScore.clan.allAttackTypes.hitrate.total ==
          teamStatsAbove.sumScore.clan.allAttackTypes.hitrate.total
      ) {
        teamStats.rank = teamStatsAbove.rank;
      } else {
        teamStats.rank = index + 1;
      }
    } else {
      teamStats.rank = index + 1;
    }
    teamStats.clan_abbr = team.clan_abbr;
    teamStats.team_name = team.team_name;
    teamStats.division = team.division;
    teamStatsAbove = teamStats;
    arrStandings.push(teamStats);
  });

  let listing = {};
  listing.standings = arrStandings;
  await clientMongo
    .db("jwc")
    .collection("leagues")
    .updateOne({ league: league }, { $set: listing });

  return;
}
exports.standings = standings;

async function standingsGroupStage(clientMongo, league, div1, div2) {
  const query = {
    league: league,
    [`status.${functions.seasonToString(config.season[league])}`]: "true",
    division: { $in: [div1, div2] },
  };
  const options = {
    projection: { _id: 0, clan_abbr: 1, team_name: 1, division: 1, score: 1 },
  };
  let sort = {};
  if (league == "five") {
    sort = {
      "score.sumGS.point": -1,
      "score.sumGS.numWar": 1,
      "score.sumGS.starDifference": -1,
      "score.sumGS.clan.destruction": -1,
      clan_abbr: 1,
    };
  } else if (league == "j1") {
    sort = {
      "score.sumQ.point": -1,
      "score.sumQ.numWar": 1,
      "score.sumQ.starDifference": -1,
      "score.sumQ.clan.destruction": -1,
      clan_abbr: 1,
    };
  }

  const cursor = clientMongo
    .db("jwc")
    .collection("clans")
    .find(query, options)
    .sort(sort);
  let standings = await cursor.toArray();
  await cursor.close();

  let rankDiv = { [div1]: 0, [div2]: 0 };

  let arrStandings = [];
  let teamStatsAbove = {};
  standings.forEach((team, index) => {
    let teamStats = {};
    if (league == "five") {
      teamStats.sumScore = team.score.sumGS;
    } else if (league == "j1") {
      teamStats.sumScore = team.score.sumQ;
    }
    if (
      index != 0 &&
      teamStats.sumScore.point == teamStatsAbove.sumScore.point &&
      teamStats.sumScore.nWar == teamStatsAbove.sumScore.nWar &&
      teamStats.sumScore.starDifference ==
        teamStatsAbove.sumScore.starDifference &&
      teamStats.sumScore.clan.destruction ==
        teamStatsAbove.sumScore.clan.destruction &&
      teamStats.sumScore.clan.allAttackTypes.hitrate.total ==
        teamStatsAbove.sumScore.clan.allAttackTypes.hitrate.total
    ) {
      teamStats.rank = teamStatsAbove.rank;
    } else {
      teamStats.rank = index + 1;
    }
    if (team.division == div1) {
      rankDiv[div1] += 1;
      teamStats.rank_div = rankDiv[div1];
    } else {
      rankDiv[div2] += 1;
      teamStats.rank_div = rankDiv[div2];
    }
    teamStats.clan_abbr = team.clan_abbr;
    teamStats.team_name = team.team_name;
    teamStats.division = team.division;
    teamStatsAbove = teamStats;
    arrStandings.push(teamStats);
  });

  let listing = {};
  listing.standings_gs = arrStandings;
  await clientMongo
    .db("jwc")
    .collection("leagues")
    .updateOne({ league: league }, { $set: listing });

  return;
}
exports.standingsGroupStage = standingsGroupStage;

async function teamList(clientMongo, league) {
  let listingUpdate = {};
  listingUpdate[league] = [];

  const query = {
    [`status.${functions.seasonToString(config.season[league])}`]: {
      $in: ["true", "question"],
    },
    league: league,
  };
  const options = {
    projection: {
      _id: 0,
      league: 1,
      clan_abbr: 1,
      clan_name: 1,
      team_name: 1,
      division: 1,
    },
  };
  const sort = { clan_abbr: 1 };
  const cursor = clientMongo
    .db("jwc")
    .collection("clans")
    .find(query, options)
    .sort(sort);
  const teams = await cursor.toArray();
  await cursor.close();

  await Promise.all(
    teams.map(async (team, index) => {
      let obj = {};
      obj.team_abbr = team.clan_abbr;
      obj.clan_name = team.clan_name;
      obj.team_name = team.team_name;
      obj.division = team.division;

      // count accounts
      let leagueM = league;
      if (team.league == "j1" || team.league == "j2") {
        leagueM = "j";
      }
      const query2 = {
        [`homeClanAbbr.${leagueM}`]: team.clan_abbr,
        status: true,
      };
      const options2 = { projection: { _id: 0, pilotName: 1 } };
      const cursor = clientMongo
        .db("jwc")
        .collection("accounts")
        .find(query2, options2);
      const accs = await cursor.toArray();
      await cursor.close();
      obj.accounts = accs.length;

      //count players
      let arrPilots = [];
      accs.forEach((acc) => {
        arrPilots.push(acc.pilotName[leagueM]);
      });
      const uniqueArrPilots = Array.from(new Set(arrPilots));
      obj.players = uniqueArrPilots.length;

      listingUpdate[league].push(obj);
    }),
  );

  listingUpdate[league].sort((a, b) => {
    if (a.team_abbr > b.team_abbr) return 1;
    else return -1;
  });

  await clientMongo
    .db("jwc")
    .collection("config")
    .updateOne({ _id: "teamList" }, { $set: listingUpdate });
  console.log(`Mongo: teamList has been updated.`);

  return;
}
exports.teamList = teamList;

async function jwcAttacks(clientMongo, league) {
  const name = "jwcAttacks";
  let listing = {};
  listing.date = new Date();
  listing.unixTimeRequest = Math.round(Date.now() / 1000);

  listing[league] = {};
  let attackType = "";
  if (league == "j1" || league == "j2") {
    attackType = "total";
    listing[league][attackType] = await getRankingAcc(
      clientMongo,
      config.lvTH,
      league,
      attackType,
    );
    attackType = "fresh";
    listing[league][attackType] = await getRankingAcc(
      clientMongo,
      config.lvTH,
      league,
      attackType,
    );
    attackType = "cleanup";
    listing[league][attackType] = await getRankingAcc(
      clientMongo,
      config.lvTH,
      league,
      attackType,
    );
    attackType = "overkill";
    listing[league][attackType] = await getRankingAcc(
      clientMongo,
      config.lvTH,
      league,
      attackType,
    );
  } else if (league == "swiss") {
    listing[league] = await getRankingAcc(
      clientMongo,
      config.lvTH,
      league,
      (attackType = "total"),
    );
  } else if (league == "mix") {
    for (const lvTH of config.lvTHmix) {
      const keyLvTH = `th${lvTH}`;
      listing[league][keyLvTH] = await getRankingAcc(
        clientMongo,
        lvTH,
        league,
        (attackType = "total"),
      );
    }
  } else if (league == "five") {
    listing[league] = await getRankingAcc(
      clientMongo,
      config.lvTH,
      league,
      (attackType = "total"),
    );
  }

  await clientMongo
    .db("jwc")
    .collection("ranking")
    .updateOne({ name: name }, { $set: listing });
  console.dir("done: jwcAttacks");

  return;
}
exports.jwcAttacks = jwcAttacks;

async function getRankingAcc(clientMongo, lvTH, league, iAttackType) {
  let leagueM = "";
  if (league == "j1" || league == "j2") {
    leagueM = "j";
  } else {
    leagueM = league;
  }

  const query = {
    status: true,
    townHallLevel: lvTH,
    [`stats.${league}.season`]: config.season[league],
    [`stats.${league}.attacks.${iAttackType}.nTriples`]: { $gt: 0 },
  };
  const options = {
    projection: {
      _id: 0,
      status: 1,
      name: 1,
      tag: 1,
      townHallLevel: 1,
      league: 1,
      stats: 1,
      homeClanAbbr: 1,
    },
  };
  const sort = {
    [`stats.${league}.attacks.${iAttackType}.nTriples`]: -1,
    [`stats.${league}.attacks.${iAttackType}.nAttacks`]: 1,
    [`stats.${league}.attacks.${iAttackType}.avrgDestruction`]: -1,
    [`stats.${league}.attacks.${iAttackType}.avrgLeft`]: -1,
  };

  const cursor = clientMongo
    .db("jwc")
    .collection("accounts")
    .find(query, options)
    .sort(sort);
  let accs = await cursor.toArray();
  await cursor.close();

  let ranking = [];
  for (let [index, acc] of accs.entries()) {
    let item = {};
    item.rank = index + 1;
    item.tag = acc.tag;
    item.name = acc.name;
    item.townHallLevel = acc.townHallLevel;
    item.homeClanAbbr = acc.homeClanAbbr[leagueM];
    item.nTriples = acc.stats[league].attacks[iAttackType].nTriples;
    item.nAttacks = acc.stats[league].attacks[iAttackType].nAttacks;
    item.hitrate = acc.stats[league].attacks[iAttackType].rate;
    item.avrgDestruction =
      acc.stats[league].attacks[iAttackType].avrgDestruction;
    item.avrgLeft = acc.stats[league].attacks[iAttackType].avrgLeft;
    ranking.push(item);
  }

  return ranking;
}

async function statsPlayer(clientMongo) {
  // stats 初期化
  let totalAtt = {
    nAttacks: 0,
    nTriples: 0,
    rate: 0,
    avrgDestruction: 0,
    avrgLeft: 0,
  };
  let freshAtt = {
    nAttacks: 0,
    nTriples: 0,
    rate: 0,
    avrgDestruction: 0,
    avrgLeft: 0,
  };
  let cleanupAtt = {
    nAttacks: 0,
    nTriples: 0,
    rate: 0,
    avrgDestruction: 0,
    avrgLeft: 0,
  };
  let overkillAtt = {
    nAttacks: 0,
    nTriples: 0,
    rate: 0,
    avrgDestruction: 0,
    avrgLeft: 0,
  };
  let attacks = {
    total: totalAtt,
    fresh: freshAtt,
    cleanup: cleanupAtt,
    overkill: overkillAtt,
  };
  let totalDef = {
    nDefenses: 0,
    nSucDefenses: 0,
    rate: 0,
    avrgDestruction: 0,
    avrgLeft: 0,
  };
  let freshDef = {
    nDefenses: 0,
    nSucDefenses: 0,
    rate: 0,
    avrgDestruction: 0,
    avrgLeft: 0,
  };
  let cleanupDef = {
    nDefenses: 0,
    nSucDefenses: 0,
    rate: 0,
    avrgDestruction: 0,
    avrgLeft: 0,
  };
  let overkillDef = {
    nDefenses: 0,
    nSucDefenses: 0,
    rate: 0,
    avrgDestruction: 0,
    avrgLeft: 0,
  };
  let defenses = {
    total: totalDef,
    fresh: freshDef,
    cleanup: cleanupDef,
    overkill: overkillDef,
  };
  let j1 = { attacks: attacks, defenses: defenses };
  let j2 = { attacks: attacks, defenses: defenses };
  let swiss = { attacks: attacks, defenses: defenses };
  let mix1 = { attacks: attacks, defenses: defenses };
  let mix2 = { attacks: attacks, defenses: defenses };
  let mix3 = { attacks: attacks, defenses: defenses };
  let mix4 = { attacks: attacks, defenses: defenses };
  let five = { attacks: attacks, defenses: defenses };
  let statsNew = {
    j1: j1,
    j2: j2,
    swiss: swiss,
    mix1: mix1,
    mix2: mix2,
    mix3: mix3,
    mix4: mix4,
    five: five,
  };
  let listingNew = { stats: statsNew };

  var query = {};
  var options = { projection: { _id: 1, stats: 0, pilotDC: 0 } };
  var cursor = clientMongo.db("jwc").collection("players").find(query, options);
  let players = await cursor.toArray();
  await cursor.close();

  await Promise.all(
    players.map(async (player, index) => {
      await clientMongo
        .db("jwc")
        .collection("players")
        .updateOne({ _id: player._id }, { $set: listingNew });
    }),
  );

  // stats 書き込み
  var query = {
    status: { $ne: false },
    "pilotDC.username": { $ne: null },
    stats: { $ne: null },
  };
  var options = {
    projection: { _id: 0, pilotDC: 1, stats: 1, townHallLevel: 1 },
  };
  var cursor = clientMongo
    .db("jwc")
    .collection("accounts")
    .find(query, options);
  let accs = await cursor.toArray();
  //console.log(accs.length);
  await cursor.close();

  for await (const acc of accs) {
    //console.log(acc.pilotDC.username);
    let dbValuePlayer = await clientMongo
      .db("jwc")
      .collection("players")
      .findOne({ "pilotDC.id": acc.pilotDC.id });
    // 新規
    if (dbValuePlayer == null) {
      let listing = {};
      listing.pilotDC = acc.pilotDC;
      listing.stats = statsNew;
      await clientMongo.db("jwc").collection("players").insertOne(listing);
    }
    // 更新
    let dbValuePlayerNew = await clientMongo
      .db("jwc")
      .collection("players")
      .findOne({ "pilotDC.id": acc.pilotDC.id });
    let stats = {};
    if (
      acc.stats.j1.attacks != null &&
      acc.stats.j1.attacks != "no attack" &&
      acc.townHallLevel == config.lvTH &&
      acc.stats.j1.season == config.season.j1
    ) {
      stats.j1 = calcStatsLeague(dbValuePlayerNew.stats.j1, acc.stats.j1);
    } else {
      stats.j1 = dbValuePlayerNew.stats.j1;
    }
    if (
      acc.stats.j2.attacks != null &&
      acc.stats.j2.attacks != "no attack" &&
      acc.townHallLevel == config.lvTH &&
      acc.stats.j2.season == config.season.j2
    ) {
      stats.j2 = calcStatsLeague(dbValuePlayerNew.stats.j2, acc.stats.j2);
    } else {
      stats.j2 = dbValuePlayerNew.stats.j2;
    }
    if (
      acc.stats.swiss.attacks != null &&
      acc.stats.swiss.attacks != "no attack" &&
      acc.townHallLevel == config.lvTH &&
      acc.stats.swiss.season == config.season.swiss
    ) {
      stats.swiss = calcStatsLeague(
        dbValuePlayerNew.stats.swiss,
        acc.stats.swiss,
      );
    } else {
      stats.swiss = dbValuePlayerNew.stats.swiss;
    }
    if (
      acc.stats.mix.attacks != null &&
      acc.stats.mix.attacks != "no attack" &&
      acc.stats.mix.season == config.season.mix
    ) {
      if (acc.townHallLevel == config.lvTHmix[0]) {
        stats.mix1 = calcStatsLeague(
          dbValuePlayerNew.stats.mix1,
          acc.stats.mix,
        );
      } else {
        stats.mix1 = dbValuePlayerNew.stats.mix1;
      }
      if (acc.townHallLevel == config.lvTHmix[1]) {
        stats.mix2 = calcStatsLeague(
          dbValuePlayerNew.stats.mix2,
          acc.stats.mix,
        );
      } else {
        stats.mix2 = dbValuePlayerNew.stats.mix2;
      }
      if (acc.townHallLevel == config.lvTHmix[2]) {
        stats.mix3 = calcStatsLeague(
          dbValuePlayerNew.stats.mix3,
          acc.stats.mix,
        );
      } else {
        stats.mix3 = dbValuePlayerNew.stats.mix3;
      }
      if (acc.townHallLevel == config.lvTHmix[3]) {
        stats.mix4 = calcStatsLeague(
          dbValuePlayerNew.stats.mix4,
          acc.stats.mix,
        );
      } else {
        stats.mix4 = dbValuePlayerNew.stats.mix4;
      }
    } else {
      stats.mix1 = dbValuePlayerNew.stats.mix1;
      stats.mix2 = dbValuePlayerNew.stats.mix2;
      stats.mix3 = dbValuePlayerNew.stats.mix3;
      stats.mix4 = dbValuePlayerNew.stats.mix4;
    }
    if (
      acc.stats.five.attacks != null &&
      acc.stats.five.attacks != "no attack" &&
      acc.townHallLevel == config.lvTH &&
      acc.stats.five.season == config.season.five
    ) {
      stats.five = calcStatsLeague(dbValuePlayerNew.stats.five, acc.stats.five);
    } else {
      stats.five = dbValuePlayerNew.stats.five;
    }
    let listing = {};
    listing.stats = stats;
    await clientMongo
      .db("jwc")
      .collection("players")
      .updateOne({ "pilotDC.id": acc.pilotDC.id }, { $set: listing });
  }
  return;
}
exports.statsPlayer = statsPlayer;

function calcStatsLeague(statsBefore, statsThis) {
  let statsAfter = {};
  statsAfter.attacks = {};
  statsAfter.attacks.total = calcStatsAttacks(
    statsBefore.attacks.total,
    statsThis.attacks.total,
  );
  statsAfter.attacks.fresh = calcStatsAttacks(
    statsBefore.attacks.fresh,
    statsThis.attacks.fresh,
  );
  statsAfter.attacks.cleanup = calcStatsAttacks(
    statsBefore.attacks.cleanup,
    statsThis.attacks.cleanup,
  );
  statsAfter.attacks.overkill = calcStatsAttacks(
    statsBefore.attacks.overkill,
    statsThis.attacks.overkill,
  );
  statsAfter.defenses = {};
  statsAfter.defenses.total = calcStatsDefenses(
    statsBefore.defenses.total,
    statsThis.defenses.total,
  );
  statsAfter.defenses.fresh = calcStatsDefenses(
    statsBefore.defenses.fresh,
    statsThis.defenses.fresh,
  );
  statsAfter.defenses.cleanup = calcStatsDefenses(
    statsBefore.defenses.cleanup,
    statsThis.defenses.cleanup,
  );
  statsAfter.defenses.overkill = calcStatsDefenses(
    statsBefore.defenses.overkill,
    statsThis.defenses.overkill,
  );
  return statsAfter;
}

function calcStatsAttacks(statsBefore, statsThis) {
  let statsAfter = {};
  statsAfter.nAttacks = statsBefore.nAttacks + statsThis.nAttacks;
  statsAfter.nTriples = statsBefore.nTriples + statsThis.nTriples;
  statsAfter.rate =
    Math.round((statsAfter.nTriples / statsAfter.nAttacks) * 100 * 10) / 10;
  let avrgDestruction = 0;
  let avrgLeft = 0;
  if (statsBefore.nAttacks != 0 && statsThis.nAttacks == 0) {
    avrgDestruction = statsBefore.avrgDestruction;
    avrgLeft = statsBefore.avrgLeft;
  }
  if (statsBefore.nAttacks == 0 && statsThis.nAttacks != 0) {
    avrgDestruction = statsThis.avrgDestruction;
    avrgLeft = statsThis.avrgLeft;
  }
  if (statsBefore.nAttacks != 0 && statsThis.nAttacks != 0) {
    let destructionBefore = statsBefore.avrgDestruction * statsBefore.nAttacks;
    let destructionThis = statsThis.avrgDestruction * statsThis.nAttacks;
    avrgDestruction =
      (destructionBefore + destructionThis) / statsAfter.nAttacks;
    let leftBefore = statsBefore.avrgLeft * statsBefore.nAttacks;
    let leftThis = statsThis.avrgLeft * statsThis.nAttacks;
    avrgLeft = (leftBefore + leftThis) / statsAfter.nAttacks;
  }
  statsAfter.avrgDestruction = Math.round(avrgDestruction * 10) / 10;
  statsAfter.avrgLeft = Math.round(avrgLeft);
  return statsAfter;
}

function calcStatsDefenses(statsBefore, statsThis) {
  let statsAfter = {};
  statsAfter.nDefenses = statsBefore.nDefenses + statsThis.nDefenses;
  statsAfter.nSucDefenses = statsBefore.nSucDefenses + statsThis.nSucDefenses;
  statsAfter.rate =
    Math.round((statsAfter.nSucDefenses / statsAfter.nDefenses) * 100 * 10) /
    10;
  let avrgDestruction = 0;
  let avrgLeft = 0;
  if (statsBefore.nDefenses != 0 && statsThis.nDefenses == 0) {
    avrgDestruction = statsBefore.avrgDestruction;
    avrgLeft = statsBefore.avrgLeft;
  }
  if (statsBefore.nDefenses == 0 && statsThis.nDefenses != 0) {
    avrgDestruction = statsThis.avrgDestruction;
    avrgLeft = statsThis.avrgLeft;
  }
  if (statsBefore.nDefenses != 0 && statsThis.nDefenses != 0) {
    let destructionBefore = statsBefore.avrgDestruction * statsBefore.nDefenses;
    let destructionThis = statsThis.avrgDestruction * statsThis.nDefenses;
    avrgDestruction =
      (destructionBefore + destructionThis) / statsAfter.nDefenses;
    let leftBefore = statsBefore.avrgLeft * statsBefore.nDefenses;
    let leftThis = statsThis.avrgLeft * statsThis.nDefenses;
    avrgLeft = (leftBefore + leftThis) / statsAfter.nDefenses;
  }
  statsAfter.avrgDestruction = Math.round(avrgDestruction * 10) / 10;
  statsAfter.avrgLeft = Math.round(avrgLeft);
  return statsAfter;
}

async function createZapQuakeTable(clientMongo, thLevel) {
  const thLevelStr = `th${thLevel}`;
  const damageLightning = config_coc.damage.lightning[thLevelStr];

  let tableUpdate = [];

  config_coc.buildings.forEach((building) => {
    if (building.name != "Clan Castle") {
      let objBuilding = {};
      Object.entries(building.hp).forEach(([th, hp]) => {
        let thLvelInt = Number(th.replace("th", ""));
        if (thLvelInt == thLevel) {
          objBuilding.id = building.id;
          objBuilding.emote = building.emote;
          objBuilding.name = building.name;
          objBuilding.hp = hp;
          let arrZq = [];
          config_coc.damage.earthquake.forEach((percentageEq) => {
            const hpRemainingEq = percentageEq * hp;
            const numLightning =
              Math.floor(hpRemainingEq / damageLightning) + 1;
            const hpRemaining = Math.ceil(
              hpRemainingEq - damageLightning * numLightning,
            );
            arrZq.push({ numLightning, hpRemaining });
          });
          objBuilding.zq = arrZq;
          let arrZqCc = []; // 援軍呪文
          config_coc.damage.earthquake.forEach((percentageEq) => {
            const hpRemainingEq = percentageEq * hp;
            const hpRemainingEqLgAdd =
              hpRemainingEq - config_coc.damage.lightningAdd[thLevelStr];
            const numLightningCc =
              Math.floor(hpRemainingEqLgAdd / damageLightning) + 1;
            const hpRemainingCc = Math.ceil(
              hpRemainingEqLgAdd - damageLightning * numLightningCc,
            );
            arrZqCc.push({ numLightningCc, hpRemainingCc });
          });
          objBuilding.zqCc = arrZqCc;
          tableUpdate.push(objBuilding);
        }
      });
    }
  });

  config_coc.heroes.forEach((hero) => {
    if (hero.name != "Barbarian King") {
      let objHero = {};
      Object.entries(hero.hp).forEach(([th, hp]) => {
        let thLvelInt = Number(th.replace("th", ""));
        if (thLvelInt == thLevel) {
          objHero.id = 90 + hero.id;
          objHero.emote = hero.emote;
          objHero.name = hero.name;
          objHero.hp = hp;
          let arrZq = [];
          const numLightning = Math.floor(hp / damageLightning) + 1;
          const hpRemaining = Math.ceil(hp - damageLightning * numLightning);
          arrZq.push({ numLightning, hpRemaining });
          objHero.zq = arrZq;
          let arrZqCc = [];
          const hpRemainingLgAdd =
            hp - config_coc.damage.lightningAdd[thLevelStr];
          const numLightningCc =
            Math.floor(hpRemainingLgAdd / damageLightning) + 1;
          const hpRemainingCc = Math.ceil(
            hpRemainingLgAdd - damageLightning * numLightningCc,
          );
          arrZqCc.push({ numLightningCc, hpRemainingCc });
          objHero.zqCc = arrZqCc;
          tableUpdate.push(objHero);
        }
      });
    }
  });

  let listingUpdate = {};
  listingUpdate[thLevelStr] = tableUpdate;

  const query = { name: "zapQuakeTable" };
  await clientMongo
    .db("jwc")
    .collection("config")
    .updateOne(query, { $set: listingUpdate });
  console.log(`Mongo: zapQuakeTable has been updated.`);

  return;
}
exports.createZapQuakeTable = createZapQuakeTable;

async function createFireballTable(clientMongo, thLevel) {
  const thLevelStr = `th${thLevel}`;
  const damageLightning = config_coc.damage.lightning[thLevelStr];
  const damageLightningDonated = config_coc.damage.lightningDonated[thLevelStr];

  let tableUpdate = [];

  config_coc.buildings.forEach((building) => {
    let objBuilding = {};
    Object.entries(building.hp).forEach(([th, hp]) => {
      let thLvelInt = Number(th.replace("th", ""));
      if (thLvelInt == thLevel) {
        objBuilding.id = building.id;
        objBuilding.emote = building.emote;
        objBuilding.name = building.name;
        objBuilding.hp = hp;

        let numEq = 0;
        let found = false;
        config_coc.damage.earthquake.forEach((percentageEq, index) => {
          if (!found) {
            const hpRemainingEq = percentageEq * hp;
            const hpRemaining = Math.ceil(
              hpRemainingEq - config_coc.damage.fireball[thLevelStr],
            );
            if (hpRemaining < 0) {
              objBuilding.numEq = index;
              objBuilding.hpRemaining = hpRemaining;
              found = true;
            }
          }
        });

        tableUpdate.push(objBuilding);
      }
    });
  });

  config_coc.heroes.forEach((hero) => {
    if (hero.id != 0) {
      // Barbarian King 以外
      let objHero = {};
      Object.entries(hero.hp).forEach(([th, hp]) => {
        let thLvelInt = Number(th.replace("th", ""));
        if (thLvelInt == thLevel) {
          objHero.id = 90 + hero.id;
          objHero.emote = hero.emote;
          objHero.name = hero.name;
          objHero.hp = hp;

          const hpRemainingFb = hp - config_coc.damage.fireball[thLevelStr];
          const numLightning =
            hpRemainingFb < 0
              ? 0
              : Math.floor(hpRemainingFb / damageLightning) + 1;
          const hpRemaining = Math.ceil(
            hpRemainingFb - damageLightning * numLightning,
          );
          objHero.numLg = numLightning;
          objHero.hpRemaining = hpRemaining;

          const numLightningCc =
            hpRemainingFb < 0
              ? 0
              : Math.floor(hpRemainingFb / damageLightningDonated) + 1;
          const hpRemainingCc = Math.ceil(
            hpRemainingFb - damageLightningDonated * numLightningCc,
          );
          objHero.numLgCc = numLightningCc;
          objHero.hpRemainingCc = hpRemainingCc;

          tableUpdate.push(objHero);
        }
      });
    }
  });

  let listingUpdate = {};
  listingUpdate[thLevelStr] = tableUpdate;

  const query = { name: "fireballTable" };
  await clientMongo
    .db("jwc")
    .collection("config")
    .updateOne(query, { $set: listingUpdate });
  console.log(`Mongo: fireballTable has been updated.`);

  return;
}
exports.createFireballTable = createFireballTable;

// トロフィー履歴の更新
/*
async function updateTrophyHistory(client, mongoAcc, scPlayer, diffAttackWins) {
  // 既存の履歴を取得または初期化
  const arrTrophies = mongoAcc.trophiesHistory || []; // ここでnullの場合も考慮

  // 設定情報を取得
  const { day, season } = await client.clientMongo
    .db("jwc")
    .collection("config")
    .findOne({ name: "legend" });

  // 攻撃と防衛の記録を集計
  const logCurrent = mongoAcc.legend?.logCurrent || [];
  const todayLogs = logCurrent.filter((log) => log.day === day);

  // 攻撃の集計
  const attackLogs = todayLogs.filter((log) => log.action === "attack");
  const attacks = attackLogs.length;
  const perfectAttacks = attackLogs.filter(
    (log) => log.diffTrophies === 40,
  ).length;

  // 防衛の集計
  const defenseLogs = todayLogs.filter((log) => log.action === "defense");
  const defenses = defenseLogs.length;
  const perfectDefenses = defenseLogs.filter(
    (log) => log.diffTrophies === -40,
  ).length;

  // 今日のトロフィー情報を作成
  const trophiesHistoryToday = {
    trophies: scPlayer.trophies,
    diffTrophies: scPlayer.trophies - mongoAcc.trophies,
    diffAttackWins: diffAttackWins,
    season,
    day,
    rank: scPlayer.legendStatistics?.currentSeason?.rank || "NaN",
    attacks,
    perfectAttacks,
    defenses,
    perfectDefenses,
  };

  // 同じdayのエントリを確認
  const lastEntry =
    arrTrophies.length > 0 ? arrTrophies[arrTrophies.length - 1] : null;

  if (lastEntry && lastEntry.day === day) {
    // 最後のエントリが今日のものなら上書き
    arrTrophies[arrTrophies.length - 1] = trophiesHistoryToday;
  } else {
    // 履歴が50件を超える場合は古いものを削除
    if (arrTrophies.length >= 50) {
      arrTrophies.shift();
    }

    // 新しい履歴を追加
    arrTrophies.push(trophiesHistoryToday);
  }

  return arrTrophies;
}
*/

/*
async function weekNow(clientMongo, weekNow) {
  let name = 'weekNow';
  let listing = weekNow;
  listing.unixTimeRequest = Math.round(Date.now() / 1000);
  await clientMongo.db('jwc').collection('config').updateOne({ name: name }, { $set: listing });
  //console.log(`Mongo: ${name} has been updated.`);
  return;
};
exports.weekNow = weekNow;

async function statusNow(clientMongo, status) {
  let name = 'status';
  let listing = status;
  listing.unixTimeRequest = Math.round(Date.now() / 1000);
  await clientMongo.db('jwc').collection('config').updateOne({ name: name }, { $set: listing });
  //console.log(`Mongo: ${name} has been updated.`);
  return;
};
exports.statusNow = statusNow;
*/

/*
async function updateLegendDay(clientMongo, seasonId, isReset) {
  const name = "legend";
  const mongoLegend = await clientMongo
    .db("jwc")
    .collection("config")
    .findOne({ name: name });
  let dayNew = mongoLegend.day;

  let updatedListing = {};
  if (isReset == true) {
    dayNew = 1;
    updatedListing = {
      day: dayNew,
      seasonId,
      dayPrevious: mongoLegend.dayPrevious,
    };
  } else {
    dayNew += 1;
    updatedListing = { day: dayNew, seasonId, dayPrevious: mongoLegend.day };
  }

  try {
    await clientMongo
      .db("jwc")
      .collection("config")
      .updateOne({ name: name }, { $set: updatedListing });
    console.dir(updatedListing);
    const result = { result: "success", dayNew: dayNew };
    return result;
  } catch (error) {
    console.log(error);
    const result = { result: "error", dayNew: dayNew };
    return result;
  }
}
exports.updateLegendDay = updateLegendDay;
*/

/*
async function rezeroLegendCount(clientMongo) {
  let query = { status: true, "legend.logSettings": { $ne: null } };
  let sort = {};
  let cursor = clientMongo
    .db("jwc")
    .collection("accounts")
    .find(query)
    .sort(sort);
  let accountsLegends = await cursor.toArray();
  await cursor.close();

  console.log(`Rezeroing legend count for ${accountsLegends.length} accounts`);

  const nToday = { attacks: 0, defenses: 0 };
  const updatedListing = { "legend.nToday": nToday };

  try {
    let count = 0;
    for (const acc of accountsLegends) {
      await clientMongo
        .db("jwc")
        .collection("accounts")
        .updateOne({ tag: acc.tag }, { $set: updatedListing });
      count++;
      if (count % 10 === 0) {
        console.log(`Processed ${count}/${accountsLegends.length} accounts`);
      }
    }

    console.log(
      `Completed: Reset legend count for all ${accountsLegends.length} accounts`,
    );
    return "success";
  } catch (error) {
    console.log(error);
    return "error";
  }
}
exports.rezeroLegendCount = rezeroLegendCount;
*/
