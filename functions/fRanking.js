const config = require('../config.js');


async function rankingMain(clientMongo) {
  // legend previous day [current season]
  rankingLegend(clientMongo, nameItem = 'current', nameRanking = 'legendPreviousDay', key = 'legend.current.trophies');

  // legend trophies
  rankingLegend(clientMongo, nameItem = 'legendTrophies', nameRanking = 'legendTrophies', key = 'legend.legendTrophies');

  // ** Hero Equipment **
  rankingEquipment(clientMongo, nameItem = 'Total');
  rankingEquipment(clientMongo, nameItem = 'giantGauntlet');
  rankingEquipment(clientMongo, nameItem = 'spikyBall');
  rankingEquipment(clientMongo, nameItem = 'snakeBracelet');
  rankingEquipment(clientMongo, nameItem = 'frozenArrow');
  rankingEquipment(clientMongo, nameItem = 'magicMirror');
  rankingEquipment(clientMongo, nameItem = 'actionFigure');
  rankingEquipment(clientMongo, nameItem = 'fireball');
  rankingEquipment(clientMongo, nameItem = 'lavaloonPuppet');
  rankingEquipment(clientMongo, nameItem = 'rocketSpear');
  rankingEquipment(clientMongo, nameItem = 'electroBoots');
  rankingEquipment(clientMongo, nameItem = 'darkCrown');
  rankingEquipment(clientMongo, nameItem = 'meteorStaff');

  // ** Others **
  rankingGeneral(clientMongo, nameRanking = 'trophies');
  rankingGeneral(clientMongo, nameRanking = 'warStars');
  rankingGeneral(clientMongo, nameRanking = 'attackWins');
  rankingGeneral(clientMongo, nameRanking = 'lvHeroes');

  return;
};
exports.rankingMain = rankingMain;


async function rankingLegend(clientMongo, nameItem, nameRanking, key) {
  let arr = [];
  let query = { status: true, [key]: { $gt: 0 } };
  let options = { projection: { _id: 0, name: 1, pilotName: 1, townHallLevel: 1, homeClanAbbr: 1, legend: 1, diffAttackWins: 1, diffDefenseWins: 1, trophies: 1, unixTimeRequest: 1 } };
  let sort = { [key]: -1 };
  let accs = await getAccsFromMongo(clientMongo, query, options, sort);

  await Promise.all(accs.map(async (acc, index) => {
    let obj = { name: acc.name, pilotName: acc.pilotName, townHallLevel: acc.townHallLevel, homeClanAbbr: acc.homeClanAbbr, [nameRanking]: acc.legend[nameItem], difference: acc.legend.difference, diffAttackWins: acc.diffAttackWins, diffDefenseWins: acc.diffDefenseWins, trophies: acc.trophies, unixTimeRequest: acc.unixTimeRequest };
    arr.push(obj);
  }));

  let listing = {};
  listing.accounts = arr;
  listing.date = new Date();
  listing.unixTime = Math.round(Date.now() / 1000);

  await clientMongo.db('jwc').collection('ranking').updateOne({ name: nameRanking }, { $set: listing });

  console.log(`Mongo: ${nameRanking} has been updated.`);

  return;
};
exports.rankingLegend = rankingLegend;


async function rankingEquipment(clientMongo, nameItem) {
  let arr = [];
  let nameRanking = `equip${nameItem.charAt(0).toUpperCase() + nameItem.slice(1)}`;
  if (nameItem == 'Total') {
    nameItem = 'total';
  };
  const key = `lvHeroEquipment.${nameItem}.level`;
  let query = { status: true, [key]: { $gt: 0 } };
  let options = { projection: { _id: 0, name: 1, pilotName: 1, townHallLevel: 1, homeClanAbbr: 1, lvHeroEquipment: 1, unixTimeRequest: 1 } };
  let sort = { [key]: -1 };
  let accs = await getAccsFromMongo(clientMongo, query, options, sort);

  await Promise.all(accs.map(async (acc, index) => {
    let obj = { name: acc.name, pilotName: acc.pilotName, townHallLevel: acc.townHallLevel, homeClanAbbr: acc.homeClanAbbr, [nameRanking]: acc.lvHeroEquipment[nameItem] };
    arr.push(obj);
  }));

  var listing = {};
  listing.accounts = arr;
  listing.date = new Date();
  listing.unixTime = Math.round(Date.now() / 1000);

  await clientMongo.db('jwc').collection('ranking').updateOne({ name: nameRanking }, { $set: listing });

  console.log(`Mongo: ${nameRanking} has been updated.`);

  return;
};
exports.rankingEquipment = rankingEquipment; // test用


async function rankingGeneral(clientMongo, nameRanking) {
  let arr = [];
  let query = { status: true, [nameRanking]: { $ne: null } };
  let options = { projection: { _id: 0, name: 1, pilotName: 1, townHallLevel: 1, homeClanAbbr: 1, [nameRanking]: 1, unixTimeRequest: 1 } };
  let sort = { [nameRanking]: -1 };
  let accs = await getAccsFromMongo(clientMongo, query, options, sort);

  await Promise.all(accs.map(async (acc, index) => {
    let obj = { name: acc.name, pilotName: acc.pilotName, townHallLevel: acc.townHallLevel, homeClanAbbr: acc.homeClanAbbr, [nameRanking]: acc[nameRanking], unixTimeRequest: acc.unixTimeRequest };
    arr.push(obj);
  }));

  let listing = {};
  listing.accounts = arr;
  listing.date = new Date();
  listing.unixTime = Math.round(Date.now() / 1000);

  await clientMongo.db('jwc').collection('ranking').updateOne({ name: nameRanking }, { $set: listing });

  console.log(`Mongo: ${nameRanking} has been updated.`);

  return;
};
exports.rankingGeneral = rankingGeneral; // test用


async function getAccsFromMongo(clientMongo, query, options, sort) {
  const cursor = clientMongo.db('jwc').collection('accounts').find(query, options).sort(sort);
  const accs = await cursor.toArray();
  await cursor.close();
  return accs;
};


async function getDescriptionRankingJwcAttack(clientMongo, league, query, sort, teamAbbr, lvTH, nDisplay, flagSummary, flagRegularSeason, attackType) {
  const projection = { _id: 0, name: 1, homeClanAbbr: 1, pilotName: 1, stats: 1 };
  const options = { projection: projection };
  const cursor = clientMongo.db('jwc').collection('accounts').find(query, options).sort(sort);
  let accs = await cursor.toArray();
  await cursor.close();

  let totalAttacks = 0;
  let totalTriples = 0;
  let totalAvrgDestruction = 0;

  let description = ['', '', '', '', ''];
  if (accs.length == 0) {
    description[0] = '*no attack*';
  }
  else {
    let arrDescription = [];
    for (let [index, acc] of accs.entries()) {
      arrDescription[index] = '';
      if (flagSummary == true && acc.stats[league].attacks[attackType].nTriples == 0) { // summaryでは0の人は非表示
        totalAttacks += acc.stats[league].attacks[attackType].nAttacks;
        totalAvrgDestruction += acc.stats[league].attacks[attackType].avrgDestruction * acc.stats[league].attacks[attackType].nAttacks;
      }
      else {
        if (teamAbbr == 'entire') {
          arrDescription[index] += `${index + 1}. ${config.emote.thn[lvTH]} **${acc.name.replace(/\*/g, '\\*').replace(/_/g, '\\_')}**`;
          arrDescription[index] += ` | ${acc.homeClanAbbr[config.leagueM[league]].toUpperCase()}\n`;
        }
        else {
          arrDescription[index] += `${index + 1}. ${config.emote.thn[lvTH]} **${acc.name.replace(/\*/g, '\\*').replace(/_/g, '\\_')}**`;
          arrDescription[index] += ` | ${acc.pilotName[leagueM]}\n`;
        };
        if (flagRegularSeason == 'true') {
          arrDescription[index] += `**${acc.stats[league].attacks2[attackType].nTriples}**/${acc.stats[league].attacks2[attackType].nAttacks}`;
          arrDescription[index] += `  ( **${acc.stats[league].attacks2[attackType].rate}**% )`;
          arrDescription[index] += `  ${acc.stats[league].attacks2[attackType].avrgDestruction}%`;
          let timeLeft = acc.stats[league].attacks2[attackType].avrgLeft;
          if (timeLeft >= 0) {
            arrDescription[index] += `  _${Math.round(timeLeft)}″ left_`;
          };
          arrDescription[index] += `\n`;
          arrDescription[index] += `\n`;
          totalAttacks += acc.stats[league].attacks2[attackType].nAttacks;
          totalTriples += acc.stats[league].attacks2[attackType].nTriples;
          totalAvrgDestruction += acc.stats[league].attacks2[attackType].avrgDestruction * acc.stats[league].attacks2[attackType].nAttacks;
        }
        else {
          arrDescription[index] += `**${acc.stats[league].attacks[attackType].nTriples}**/${acc.stats[league].attacks[attackType].nAttacks}`;
          arrDescription[index] += `  ( **${acc.stats[league].attacks[attackType].rate}**% )`;
          arrDescription[index] += `  ${acc.stats[league].attacks[attackType].avrgDestruction}%`;
          let timeLeft = acc.stats[league].attacks[attackType].avrgLeft;
          if (timeLeft >= 0) {
            arrDescription[index] += `  _${Math.round(timeLeft)}″ left_`;
          };
          arrDescription[index] += `\n`;
          arrDescription[index] += `\n`;
          totalAttacks += acc.stats[league].attacks[attackType].nAttacks;
          totalTriples += acc.stats[league].attacks[attackType].nTriples;
          totalAvrgDestruction += acc.stats[league].attacks[attackType].avrgDestruction * acc.stats[league].attacks[attackType].nAttacks;
        };
      };
    };
    arrDescription.forEach(function(value, index) {
      if (index < nDisplay) {
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
      };
    });
  };

  if (accs.length != 0) {
    let rate = Math.round(totalTriples / totalAttacks * 1000) / 10;
    totalAvrgDestruction = Math.round(totalAvrgDestruction / totalAttacks * 100) / 100;
    if (flagSummary == true) {
      description[0] += `### TOTAL`;
      description[0] += `\n`;
      description[0] += `**${totalTriples}**/${totalAttacks}  ( **${rate}**% )  ${totalAvrgDestruction}%`;
    }
    else {
      description[4] += `**${totalTriples}**/${totalAttacks}  ( **${rate}**% )  ${totalAvrgDestruction}%`;
    };
  };

  return description;
};
exports.getDescriptionRankingJwcAttack = getDescriptionRankingJwcAttack;





