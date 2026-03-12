const fs = require('fs');
const config = require('../config.js');
const functions = require('./functions.js');


async function teamInfo(clientMongo, league) {
  let teamInfo = {};

  var myColl = clientMongo.db('jwc').collection('clans');
  var cursor = myColl.find({ league: league });
  if (league == 'j1') {
    var cursor = myColl.find({ $or: [{ league: 'j1' }, { league: 'j2' }] });
  };
  let clans = await cursor.toArray();
  await cursor.close();

  await Promise.all(clans.map(async (clan, index) => {
    let newKey = `clan_${clan.clan_abbr}`;
    teamInfo[newKey] = {
      team_name: clan.team_name,
      division: clan.division,
      logo_url: clan.logo_url,
      score: clan.score,
      stats: clan.stats,
    };
  }));

  var path = `./express-gen-app/public/json/teamInfo_${league}.json`;
  fs.writeFile(path, JSON.stringify(teamInfo), (err) => {
    if (err) console.error(err);
    if (!err) console.dir(`JSON CREATED: teamInfo [${league}]`);
  });

  return;
}
exports.teamInfo = teamInfo;


async function currentWeek(clientMongo, league) {
  let dataWarStatsCurrent = {};

  var wars = {};
  var cursor = clientMongo.db('jwc').collection('wars').find({ season: config.jwc.season, league: league });
  wars = await cursor.toArray();
  await cursor.close();

  var myPath = `./express-gen-app/public/json/chartDataWarProgress.json`;
  const chartDataWarProgressJSON = fs.readFileSync(myPath, 'utf8');
  let chartDataWarProgress = {};
  if (chartDataWarProgressJSON != '') {
    chartDataWarProgress = JSON.parse(chartDataWarProgressJSON);
  };
  chartDataWarProgress[league] = {};

  var myPath = `./express-gen-app/public/json/chartOptionsWarProgress.json`;
  const chartOptionsWarProgressJSON = fs.readFileSync(myPath, 'utf8');
  let chartOptionsWarProgress = {};
  if (chartOptionsWarProgressJSON != '') {
    chartOptionsWarProgress = JSON.parse(chartOptionsWarProgressJSON);
  };
  chartOptionsWarProgress[league] = {};

  var myPath = `./express-gen-app/public/json/teamInfo_${league}.json`;
  const teamInfoJson = fs.readFileSync(myPath, 'utf8');
  let teamInfo = JSON.parse(teamInfoJson);

  await Promise.all(wars.map(async (war, index) => {
    let weekNow = await functions.getWeekNow(clientMongo, league);
    if (war.week == weekNow) {
      let nameMatch = war.name_match.replace(/\'/g, '&#39;');
      if (war.name_match == '') {
        nameMatch = '-';
      };
      dataWarStatsCurrent[`m${war.match}`] = {};
      dataWarStatsCurrent[`m${war.match}`].nameMatch = nameMatch;
      dataWarStatsCurrent[`m${war.match}`].deal = war.deal;
      dataWarStatsCurrent[`m${war.match}`].teamName = [
        teamInfo[`clan_${war.clan_abbr}`].team_name,
        teamInfo[`clan_${war.opponent_abbr}`].team_name,
      ];
      if (war.result.state == 'preparation' || war.result.state == 'inWar' || war.result.state == 'warEnded') {
        let lineup = [[], []];
        var members = war.clan_war.clan.members;
        members.sort((a, b) => a.mapPosition - b.mapPosition);
        members.map((member) => {
          var name = member.name.replace(/\'/g, '&#39;');
          name = name.replace(/\'/g, '&quot;');
          var townHallLevel = member.townHallLevel ?? member.townhallLevel;
          var attacks = ['remining', 'remining'];
          if (war.result.state == 'inWar' || war.result.state == 'warEnded') {
            if (member.attacks != null) {
              if (member.attacks[0] != null) {
                attacks[0] = member.attacks[0].stars >= 0 ? 'done' : 'remining';
              };
              if (member.attacks[1] != null) {
                attacks[1] = member.attacks[1].stars >= 0 ? 'done' : 'remining';
              };
            };
          };
          lineup[0].push({ name: name, townHallLevel: townHallLevel, attacks: attacks });
        });
        var members = war.opponent_war.clan.members;
        members.sort((a, b) => a.mapPosition - b.mapPosition);
        members.map((member) => {
          var name = member.name.replace(/\'/g, '&#39;');
          name = name.replace(/\'/g, '&quot;');
          var townHallLevel = member.townHallLevel ?? member.townhallLevel;
          var attacks = ['remining', 'remining'];
          if (war.result.state == 'inWar' || war.result.state == 'warEnded') {
            if (member.attacks != null) {
              if (member.attacks[0] != null) {
                attacks[0] = member.attacks[0].stars >= 0 ? 'done' : 'remining';
              };
              if (member.attacks[1] != null) {
                attacks[1] = member.attacks[1].stars >= 0 ? 'done' : 'remining';
              };
            };
          };
          lineup[1].push({ name: name, townHallLevel: townHallLevel, attacks: attacks });
        });
        dataWarStatsCurrent[`m${war.match}`].lineup = lineup;
      };

      let chartDataPointStars = [[0], [0]];
      let chartDataPointDestruction = [[0], [0]];
      let chartDataPointTriples = [[0], [0]];
      let chartLabels = [0];

      if (war.result.state == 'inWar' || war.result.state == 'warEnded') {
        dataWarStatsCurrent[`m${war.match}`].state = war.result.state;
        dataWarStatsCurrent[`m${war.match}`].startTime = war.clan_war.startTime;
        dataWarStatsCurrent[`m${war.match}`].endTime = war.clan_war.endTime;
        dataWarStatsCurrent[`m${war.match}`].clan = war.result.clan;
        dataWarStatsCurrent[`m${war.match}`].opponent = war.result.opponent;
        let attacks = [];
        war.result.arrAttacksPlus.map((attack, index) => {
          attack = Object.fromEntries(Object.entries(attack).map(([key, value]) => {
            if (key == 'name' || key == 'namePlayerDef') {
              value = value.replace(/\'/g, '&#39;');
              value = value.replace(/\'/g, '&quot;');
            };
            return [key, value];
          }));
          attacks.push(attack);
          // chart
          if (attack.attackType != 'remaining') {
            if (attack.action == 'attack') {
              if (chartDataPointStars[0].length == 0) {
                let newStars = attack.arrStarsFlag.filter(element => element == 2).length;
                chartDataPointStars[0].push(newStars);
                chartDataPointDestruction[0].push(attack.destruction);
                let triples = 0;
                if (attack.stars == 3) triples = 1;
                chartDataPointTriples[0].push(triples);
              }
              else {
                let newStars = attack.arrStarsFlag.filter(element => element == 2).length;
                chartDataPointStars[0].push(Number(chartDataPointStars[0][chartDataPointStars[0].length - 1]) + newStars);
                chartDataPointDestruction[0].push(Number(chartDataPointDestruction[0][chartDataPointDestruction[0].length - 1]) + attack.destruction);
                let triples = Number(chartDataPointTriples[0][chartDataPointTriples[0].length - 1]);
                if (attack.stars == 3) triples += 1;
                chartDataPointTriples[0].push(triples);
              };
            }
            else if (attack.action == 'defense') {
              if (chartDataPointStars[1].length == 0) {
                let newStars = attack.arrStarsFlag.filter(element => element == 2).length;
                chartDataPointStars[1].push(newStars);
                chartDataPointDestruction[1].push(attack.destruction);
                let triples = 0;
                if (attack.stars == 3) triples = 1;
                chartDataPointTriples[1].push(triples);
              }
              else {
                let newStars = attack.arrStarsFlag.filter(element => element == 2).length;
                chartDataPointStars[1].push(Number(chartDataPointStars[1][chartDataPointStars[1].length - 1]) + newStars);
                chartDataPointDestruction[1].push(Number(chartDataPointDestruction[1][chartDataPointDestruction[1].length - 1]) + attack.destruction);
                let triples = Number(chartDataPointTriples[1][chartDataPointTriples[1].length - 1]);
                if (attack.stars == 3) triples += 1;
                chartDataPointTriples[1].push(triples);
              };
            };
          };
        });
        dataWarStatsCurrent[`m${war.match}`].attacks = attacks;
      }
      else if (war.result.state == 'preparation') {
        dataWarStatsCurrent[`m${war.match}`].state = war.result.state;
        dataWarStatsCurrent[`m${war.match}`].startTime = war.clan_war.startTime;
        dataWarStatsCurrent[`m${war.match}`].endTime = war.clan_war.endTime;
      }
      else {
        dataWarStatsCurrent[`m${war.match}`].state = 'beforeTheWar';
      };
      if (war.result.state == 'inWar' || war.result.state == 'warEnded') {
        if (league == 'swiss') {
          for (let i = 0; i < war.result.size; i++) {
            chartLabels.push((i + 1).toString());
          };
          chartDataWarProgress[league][`m${war.match}`] = {
            labels: chartLabels,
            datasets: [
              {
                label: `STARS [${war.clan_abbr.toUpperCase()}]`,
                data: chartDataPointStars[0],
                fill: false,
                borderColor: config.rgb.orange.default,
                backgroundColor: config.rgb.orange.default,
                cubicInterpolationMode: 'monotone',
                yAxisID: 'y',
              },
              {
                label: `STARS [${war.opponent_abbr.toUpperCase()}]`,
                data: chartDataPointStars[1],
                fill: false,
                borderColor: config.rgb.royalblue,
                backgroundColor: config.rgb.royalblue,
                cubicInterpolationMode: 'monotone',
                yAxisID: 'y',
              },
              {
                label: `DESTRUCTION [${war.clan_abbr.toUpperCase()}]`,
                data: chartDataPointDestruction[0],
                fill: true,
                borderColor: config.rgba.orange,
                backgroundColor: config.rgba.orange,
                cubicInterpolationMode: 'monotone',
                yAxisID: 'y2',
              },
              {
                label: `DESTRUCTION [${war.opponent_abbr.toUpperCase()}]`,
                data: chartDataPointDestruction[1],
                fill: true,
                borderColor: config.rgba.royalblue,
                backgroundColor: config.rgba.royalblue,
                cubicInterpolationMode: 'monotone',
                yAxisID: 'y2',
              },
            ]
          };
          chartOptionsWarProgress[league][`m${war.match}`] = {
            scales: {
              x: {
                display: true,
                title: {
                  display: true,
                  text: 'THE NUMBER OF ATTACKS'
                }
              },
              y: {
                display: true,
                position: 'left',
                min: 0,
                max: 3 * war.result.size ? 3 * war.result.size : 30,
                title: {
                  display: true,
                  text: 'TOTAL STARS',
                },
              },
              y2: {
                display: true,
                position: 'right',
                min: 0,
                max: 100 * war.result.size ? 100 * war.result.size : 1000,
                title: {
                  display: true,
                  text: 'TOTAL DESTRUCTION',
                },
              },
            },
            plugins: {
              legend: {
                labels: {
                  usePointStyle: true,
                },
              },
            },
          };
        }
        else { // j1, j2, mix
          for (let i = 0; i < 2 * war.result.size; i++) {
            chartLabels.push((i + 1).toString());
          };
          chartDataWarProgress[league][`m${war.match}`] = {
            labels: chartLabels,
            datasets: [
              {
                label: `STARS [${war.clan_abbr.toUpperCase()}]`,
                data: chartDataPointStars[0],
                fill: false,
                borderColor: config.rgb.orange.default,
                backgroundColor: config.rgb.orange.default,
                cubicInterpolationMode: 'monotone',
              },
              {
                label: `STARS [${war.opponent_abbr.toUpperCase()}]`,
                data: chartDataPointStars[1],
                fill: false,
                borderColor: config.rgb.royalblue,
                backgroundColor: config.rgb.royalblue,
                cubicInterpolationMode: 'monotone',
              },
              {
                label: `TRIPLES [${war.clan_abbr.toUpperCase()}]`,
                data: chartDataPointTriples[0],
                fill: false,
                borderColor: config.rgb.orange.default,
                backgroundColor: config.rgb.white,
                cubicInterpolationMode: 'monotone',
              },
              {
                label: `TRIPLES [${war.opponent_abbr.toUpperCase()}]`,
                data: chartDataPointTriples[1],
                fill: false,
                borderColor: config.rgb.royalblue,
                backgroundColor: config.rgb.white,
                cubicInterpolationMode: 'monotone',
              },
            ]
          };
          chartOptionsWarProgress[league][`m${war.match}`] = {
            scales: {
              x: {
                display: true,
                title: {
                  display: true,
                  text: 'THE NUMBER OF ATTACKS'
                }
              },
              y: {
                display: true,
                position: 'left',
                min: 0,
                max: 3 * war.result.size ? 3 * war.result.size : 30,
                title: {
                  display: true,
                  text: 'TOTAL STARS / TRIPLES',
                },
              },
            },
            plugins: {
              legend: {
                labels: {
                  usePointStyle: true,
                },
              },
            },
          };
        };
      };
    };
  }));

  var path = `./express-gen-app/public/json/dataWarStatsCurrent_${league}.json`;
  try {
    fs.writeFileSync(path, JSON.stringify(dataWarStatsCurrent), 'utf8');
    console.dir(`JSON CREATED: dataWarStatsCurrent [${league}]`);
  }
  catch (e) {
    console.error(e);
  };

  var path = './express-gen-app/public/json/chartDataWarProgress.json';
  try {
    fs.writeFileSync(path, JSON.stringify(chartDataWarProgress), 'utf8');
    console.dir(`JSON CREATED: chartDataWarProgress [${league}]`);
  }
  catch (e) {
    console.error(e);
  };

  var path = './express-gen-app/public/json/chartOptionsWarProgress.json';
  try {
    fs.writeFileSync(path, JSON.stringify(chartOptionsWarProgress), 'utf8');
    console.dir(`JSON CREATED: chartOptionsWarProgress [${league}]`);
  }
  catch (e) {
    console.error(e);
  };

  return;
}
exports.currentWeek = currentWeek;

/*
async function allWeeks(clientMongo, league) {
  let dataWarStats = {};
  var wars = {};
  var myColl = clientMongo.db('jwc').collection('wars');
  var cursor = myColl.find({ season: config.jwc.season, league: league });
  wars = await cursor.toArray();
  await cursor.close();

  await Promise.all(wars.map(async (war, index) => {
    if (dataWarStats[`w${war.week}`] == null) {
      dataWarStats[`w${war.week}`] = {};
    };
    dataWarStats[`w${war.week}`][`m${war.match}`] = {};
    dataWarStats[`w${war.week}`][`m${war.match}`].teamName = [
      teamInfo[`clan_${war.clan_abbr}`].team_name,
      teamInfo[`clan_${war.opponent_abbr}`].team_name,
    ];
    if (war.result != '') {
      if (war.result.state == 'warEnded' || war.result.state == 'inWar') {
        dataWarStats[`w${war.week}`][`m${war.match}`].clan = war.result.clan;
        dataWarStats[`w${war.week}`][`m${war.match}`].opponent = war.result.opponent;
      };
    };
  }));

  var path = `./express-gen-app/public/json/dataWarStats_${league}.json`;
  fs.writeFile(path, JSON.stringify(dataWarStats), (err) => {
    if (err) console.error(err);
    if (!err) console.dir(`JSON CREATED: dataWarStats [${league}]`);
  });

  return;
}
exports.allWeeks = allWeeks;
*/

async function teamData(clientMongo, league) {
  let dataTeams = {};
  let tableDataRate = {};
  let tableDataClanPlayers = {};
  let chartData = {};
  let chartDataTH = {};
  chartDataTH.th16 = {};
  chartDataTH.th15 = {};
  chartDataTH.th14 = {};
  chartDataTH.th13 = {};
  chartDataTH.th12 = {};

  var myColl = clientMongo.db('jwc').collection('clans');
  var cursor = myColl.find({ league: league, rep_1st: { $ne: null } });
  if (league == 'j1') {
    var cursor = myColl.find({ $or: [{ league: 'j1' }, { league: 'j2' }], rep_1st: { $ne: null } });
  };
  let clans = await cursor.toArray();
  await cursor.close();

  await Promise.all(clans.map(async (clan, index) => {
    let newKey = `clan_${clan.clan_abbr}`;
    //console.log(newKey);
    let starDifferences = clan.score.sumQ.starDifference;
    if (starDifferences >= 0) {
      starDifferences = `+${starDifferences}`;
    };
    let objSummary = {
      nWin: clan.score.sumQ.nWin,
      nLoss: clan.score.sumQ.nLoss,
      starDifferences: starDifferences,
      destruction: `${Math.round(clan.score.sumQ.clan.destruction * 10) / 10}%`,
    };
    if (league == 'mix') {
      let ptDefDifference = clan.score.sumQ.ptDefDifference;
      if (ptDefDifference >= 0) {
        ptDefDifference = `+${ptDefDifference}`;
      };
      objSummary.ptDefDifference = ptDefDifference;
    };

    let hitrate1 = {};
    let hitrate2 = {};
    let objHitrate = {};
    let defrate1 = {};
    let defrate2 = {};
    let objDefrate = {};
    if (clan.score.sumQ.nWar == 0 || clan.score.sumQ.clan.allAttackTypes == null) {
      objHitrate.allTH = {
        total: `--% ( 0 / 0 )`,
        fresh: `--% ( 0 / 0 )`,
        cleanup: `--% ( 0 / 0 )`,
        overkill: `--% ( 0 / 0 )`,
      };
      objDefrate.allTH = {
        total: `--% ( 0 / 0 )`,
        fresh: `--% ( 0 / 0 )`,
        cleanup: `--% ( 0 / 0 )`,
        overkill: `--% ( 0 / 0 )`,
      };
    }
    else {
      hitrate1.allTH = [
        `${Math.round(clan.score.sumQ.clan.allAttackTypes.hitrate.total * 10) / 10}%`,
        `${Math.round(clan.score.sumQ.clan.fresh.hitrate.total * 10) / 10}%`,
        `${Math.round(clan.score.sumQ.clan.cleanup.hitrate.total * 10) / 10}%`,
        `${Math.round(clan.score.sumQ.clan.overkill.hitrate.total * 10) / 10}%`,
      ];
      hitrate2.allTH = [
        `${clan.score.sumQ.clan.allAttackTypes.nTriple.total} / ${clan.score.sumQ.clan.allAttackTypes.nAt.total}`,
        `${clan.score.sumQ.clan.fresh.nTriple.total} / ${clan.score.sumQ.clan.fresh.nAt.total}`,
        `${clan.score.sumQ.clan.cleanup.nTriple.total} / ${clan.score.sumQ.clan.cleanup.nAt.total}`,
        `${clan.score.sumQ.clan.overkill.nTriple.total} / ${clan.score.sumQ.clan.overkill.nAt.total}`,
      ];
      objHitrate.allTH = {
        total: `${hitrate1.allTH[0]} ( ${hitrate2.allTH[0]} )`,
        fresh: `${hitrate1.allTH[1]} ( ${hitrate2.allTH[1]} )`,
        cleanup: `${hitrate1.allTH[2]} ( ${hitrate2.allTH[2]} )`,
        overkill: `${hitrate1.allTH[3]} ( ${hitrate2.allTH[3]} )`,
      };
      defrate1.allTH = [
        `${Math.round(clan.score.sumQ.clan.allAttackTypes.defrate.total * 10) / 10}%`,
        `${Math.round(clan.score.sumQ.clan.fresh.defrate.total * 10) / 10}%`,
        `${Math.round(clan.score.sumQ.clan.cleanup.defrate.total * 10) / 10}%`,
        `${Math.round(clan.score.sumQ.clan.overkill.defrate.total * 10) / 10}%`,
      ];
      defrate2.allTH = [
        `${clan.score.sumQ.clan.allAttackTypes.nDef.total - clan.score.sumQ.clan.allAttackTypes.nDefTriple.total} / ${clan.score.sumQ.clan.allAttackTypes.nDef.total}`,
        `${clan.score.sumQ.clan.fresh.nDef.total - clan.score.sumQ.clan.fresh.nDefTriple.total} / ${clan.score.sumQ.clan.fresh.nDef.total}`,
        `${clan.score.sumQ.clan.cleanup.nDef.total - clan.score.sumQ.clan.cleanup.nDefTriple.total} / ${clan.score.sumQ.clan.cleanup.nDef.total}`,
        `${clan.score.sumQ.clan.overkill.nDef.total - clan.score.sumQ.clan.overkill.nDefTriple.total} / ${clan.score.sumQ.clan.overkill.nDef.total}`,
      ];
      objDefrate.allTH = {
        total: `${defrate1.allTH[0]} ( ${defrate2.allTH[0]} )`,
        fresh: `${defrate1.allTH[1]} ( ${defrate2.allTH[1]} )`,
        cleanup: `${defrate1.allTH[2]} ( ${defrate2.allTH[2]} )`,
        overkill: `${defrate1.allTH[3]} ( ${defrate2.allTH[3]} )`,
      };
    };

    dataTeams[newKey] = {
      league: league,
      team_name: clan.team_name,
      logo_url: clan.logo_url,
      summary: objSummary,
      hitrate: objHitrate.allTH,
      defrate: objDefrate.allTH,
    };

    if (league == 'mix') {
      [dataTeams[newKey].hitrateTH16, dataTeams[newKey].defrateTH16] = hitrateAndDefrate('th16', clan);
      [dataTeams[newKey].hitrateTH15, dataTeams[newKey].defrateTH15] = hitrateAndDefrate('th15', clan);
      [dataTeams[newKey].hitrateTH14, dataTeams[newKey].defrateTH14] = hitrateAndDefrate('th14', clan);
      [dataTeams[newKey].hitrateTH13, dataTeams[newKey].defrateTH13] = hitrateAndDefrate('th13', clan);
      [dataTeams[newKey].hitrateTH12, dataTeams[newKey].defrateTH12] = hitrateAndDefrate('th12', clan);

      [objHitrate.th16, objDefrate.th16] = hitrateAndDefrate('th16', clan);
      [objHitrate.th15, objDefrate.th15] = hitrateAndDefrate('th15', clan);
      [objHitrate.th14, objDefrate.th14] = hitrateAndDefrate('th14', clan);
      [objHitrate.th13, objDefrate.th13] = hitrateAndDefrate('th13', clan);
      [objHitrate.th12, objDefrate.th12] = hitrateAndDefrate('th12', clan);
      tableDataRate[newKey] = [
        ['All', objHitrate.allTH.total, objHitrate.th16.total, objHitrate.th15.total, objHitrate.th14.total, objHitrate.th13.total, objHitrate.th12.total, objDefrate.allTH.total, objDefrate.th16.total, objDefrate.th15.total, objDefrate.th14.total, objDefrate.th13.total, objDefrate.th12.total],
        ['Fresh', objHitrate.allTH.fresh, objHitrate.th16.fresh, objHitrate.th15.fresh, objHitrate.th14.fresh, objHitrate.th13.fresh, objHitrate.th12.fresh, objDefrate.allTH.fresh, objDefrate.th16.fresh, objDefrate.th15.fresh, objDefrate.th14.fresh, objDefrate.th13.fresh, objDefrate.th12.fresh],
        ['Cleanup', objHitrate.allTH.cleanup, objHitrate.th16.cleanup, objHitrate.th15.cleanup, objHitrate.th14.cleanup, objHitrate.th13.cleanup, objHitrate.th12.cleanup, objDefrate.allTH.cleanup, objDefrate.th16.cleanup, objDefrate.th15.cleanup, objDefrate.th14.cleanup, objDefrate.th13.cleanup, objDefrate.th12.cleanup],
        ['Overkill', objHitrate.allTH.overkill, objHitrate.th16.overkill, objHitrate.th15.overkill, objHitrate.th14.overkill, objHitrate.th13.overkill, objHitrate.th12.overkill, objDefrate.allTH.overkill, objDefrate.th16.overkill, objDefrate.th15.overkill, objDefrate.th14.overkill, objDefrate.th13.overkill, objDefrate.th12.overkill],
      ];
    }
    else {
      tableDataRate[newKey] = [
        ['All', objHitrate.allTH.total, objDefrate.allTH.total],
        ['Fresh', objHitrate.allTH.fresh, objDefrate.allTH.fresh],
        ['Cleanup', objHitrate.allTH.cleanup, objDefrate.allTH.cleanup],
        ['Overkill', objHitrate.allTH.overkill, objDefrate.allTH.overkill],
      ];
    };

    // radar chart
    let data = [];
    let labels = [];
    let dataAvg = [];
    let data2 = {};
    data2.th16 = [];
    data2.th15 = [];
    data2.th14 = [];
    data2.th13 = [];
    data2.th12 = [];
    if (league == 'j1' || league == 'j2') {
      data[0] = clan.stats.tScore.sum.allAttackTypes.total;
      data[1] = clan.stats.tScore.sum.fresh.total;
      data[2] = clan.stats.tScore.sum.cleanup.total;
      data[3] = clan.stats.tScoreDef.sum.allAttackTypes.total;
      data[4] = clan.stats.tScoreDef.sum.fresh.total;
      data[5] = clan.stats.tScoreDef.sum.cleanup.total;
      labels = [
        'All att.',
        'Fresh att.',
        'Cleanup att.',
        'All def.',
        'Fresh def.',
        'Cleanup def.',
      ];
      dataAvg = [50, 50, 50, 50, 50, 50];
    }
    else if (league == 'swiss') {
      data[0] = clan.stats.tScore.sum.allAttackTypes.total;
      data[1] = clan.stats.tScore.sum.fresh.total;
      data[2] = clan.stats.tScoreDef.sum.allAttackTypes.total;
      data[3] = clan.stats.tScoreDef.sum.fresh.total;
      labels = [
        'All att.',
        'Fresh att.',
        'All def.',
        'Fresh def.',
      ];
      dataAvg = [50, 50, 50, 50];
    }
    else if (league == 'mix') {
      labels = [
        'All att.',
        'Fresh att.',
        'Cleanup att.',
        'Overkill att.',
        'All def.',
        'Fresh def.',
        'Cleanup def.',
        'Overkill def.',
      ];
      dataAvg = [50, 50, 50, 50, 50, 50, 50, 50];

      data[0] = clan.stats.tScore.sum.allAttackTypes.total;
      data[1] = clan.stats.tScore.sum.fresh.total;
      data[2] = clan.stats.tScore.sum.cleanup.total;
      data[3] = clan.stats.tScore.sum.overkill.total;
      data[4] = clan.stats.tScoreDef.sum.allAttackTypes.total;
      data[5] = clan.stats.tScoreDef.sum.fresh.total;
      data[6] = clan.stats.tScoreDef.sum.cleanup.total;
      data[7] = clan.stats.tScoreDef.sum.overkill.total;

      var lvTH = 'th16';
      data2[lvTH][0] = clan.stats.tScore.sum.allAttackTypes[lvTH];
      data2[lvTH][1] = clan.stats.tScore.sum.fresh[lvTH];
      data2[lvTH][2] = clan.stats.tScore.sum.cleanup[lvTH];
      data2[lvTH][3] = clan.stats.tScore.sum.overkill[lvTH];
      data2[lvTH][4] = clan.stats.tScoreDef.sum.allAttackTypes[lvTH];
      data2[lvTH][5] = clan.stats.tScoreDef.sum.fresh[lvTH];
      data2[lvTH][6] = clan.stats.tScoreDef.sum.cleanup[lvTH];
      data2[lvTH][7] = clan.stats.tScoreDef.sum.overkill[lvTH];
      var lvTH = 'th15';
      data2[lvTH][0] = clan.stats.tScore.sum.allAttackTypes[lvTH];
      data2[lvTH][1] = clan.stats.tScore.sum.fresh[lvTH];
      data2[lvTH][2] = clan.stats.tScore.sum.cleanup[lvTH];
      data2[lvTH][3] = clan.stats.tScore.sum.overkill[lvTH];
      data2[lvTH][4] = clan.stats.tScoreDef.sum.allAttackTypes[lvTH];
      data2[lvTH][5] = clan.stats.tScoreDef.sum.fresh[lvTH];
      data2[lvTH][6] = clan.stats.tScoreDef.sum.cleanup[lvTH];
      data2[lvTH][7] = clan.stats.tScoreDef.sum.overkill[lvTH];
      var lvTH = 'th14';
      data2[lvTH][0] = clan.stats.tScore.sum.allAttackTypes[lvTH];
      data2[lvTH][1] = clan.stats.tScore.sum.fresh[lvTH];
      data2[lvTH][2] = clan.stats.tScore.sum.cleanup[lvTH];
      data2[lvTH][3] = clan.stats.tScore.sum.overkill[lvTH];
      data2[lvTH][4] = clan.stats.tScoreDef.sum.allAttackTypes[lvTH];
      data2[lvTH][5] = clan.stats.tScoreDef.sum.fresh[lvTH];
      data2[lvTH][6] = clan.stats.tScoreDef.sum.cleanup[lvTH];
      data2[lvTH][7] = clan.stats.tScoreDef.sum.overkill[lvTH];
      var lvTH = 'th13';
      data2[lvTH][0] = clan.stats.tScore.sum.allAttackTypes[lvTH];
      data2[lvTH][1] = clan.stats.tScore.sum.fresh[lvTH];
      data2[lvTH][2] = clan.stats.tScore.sum.cleanup[lvTH];
      data2[lvTH][3] = clan.stats.tScore.sum.overkill[lvTH];
      data2[lvTH][4] = clan.stats.tScoreDef.sum.allAttackTypes[lvTH];
      data2[lvTH][5] = clan.stats.tScoreDef.sum.fresh[lvTH];
      data2[lvTH][6] = clan.stats.tScoreDef.sum.cleanup[lvTH];
      data2[lvTH][7] = clan.stats.tScoreDef.sum.overkill[lvTH];
      var lvTH = 'th12';
      data2[lvTH][0] = clan.stats.tScore.sum.allAttackTypes[lvTH];
      data2[lvTH][1] = clan.stats.tScore.sum.fresh[lvTH];
      data2[lvTH][2] = clan.stats.tScore.sum.cleanup[lvTH];
      data2[lvTH][3] = clan.stats.tScore.sum.overkill[lvTH];
      data2[lvTH][4] = clan.stats.tScoreDef.sum.allAttackTypes[lvTH];
      data2[lvTH][5] = clan.stats.tScoreDef.sum.fresh[lvTH];
      data2[lvTH][6] = clan.stats.tScoreDef.sum.cleanup[lvTH];
      data2[lvTH][7] = clan.stats.tScoreDef.sum.overkill[lvTH];
    };

    chartData[newKey] = {
      labels: labels,
      datasets: [{
        label: clan.team_name,
        data: data,
        fill: true,
        backgroundColor: config.rgba.red,
        borderColor: config.rgb.red,
        pointBackgroundColor: config.rgb.red,
        pointBorderColor: config.rgb.white,
        pointHoverBackgroundColor: config.rgb.white,
        pointHoverBorderColor: config.rgb.red,
      }, {
        label: `AVERAGE [${clan.league.toUpperCase()}]`,
        data: dataAvg,
        fill: true,
        backgroundColor: config.rgba.black,
        borderColor: config.rgb.gray,
        pointBackgroundColor: config.rgb.gray,
        pointBorderColor: config.rgb.white,
        pointHoverBackgroundColor: config.rgb.white,
        pointHoverBorderColor: config.rgb.gray,
      }]
    };

    if (league == 'mix') {
      chartDataTH.th16[newKey] = {
        labels: labels,
        datasets: [{
          label: clan.team_name,
          data: data2.th16,
          fill: true,
          backgroundColor: config.rgba.red,
          borderColor: config.rgb.red,
          pointBackgroundColor: config.rgb.red,
          pointBorderColor: config.rgb.white,
          pointHoverBackgroundColor: config.rgb.white,
          pointHoverBorderColor: config.rgb.red,
        }, {
          label: `AVERAGE [${clan.league.toUpperCase()}]`,
          data: dataAvg,
          fill: true,
          backgroundColor: config.rgba.black,
          borderColor: config.rgb.gray,
          pointBackgroundColor: config.rgb.gray,
          pointBorderColor: config.rgb.white,
          pointHoverBackgroundColor: config.rgb.white,
          pointHoverBorderColor: config.rgb.gray,
        }]
      };
      chartDataTH.th15[newKey] = {
        labels: labels,
        datasets: [{
          label: clan.team_name,
          data: data2.th15,
          fill: true,
          backgroundColor: config.rgba.red,
          borderColor: config.rgb.red,
          pointBackgroundColor: config.rgb.red,
          pointBorderColor: config.rgb.white,
          pointHoverBackgroundColor: config.rgb.white,
          pointHoverBorderColor: config.rgb.red,
        }, {
          label: `AVERAGE [${clan.league.toUpperCase()}]`,
          data: dataAvg,
          fill: true,
          backgroundColor: config.rgba.black,
          borderColor: config.rgb.gray,
          pointBackgroundColor: config.rgb.gray,
          pointBorderColor: config.rgb.white,
          pointHoverBackgroundColor: config.rgb.white,
          pointHoverBorderColor: config.rgb.gray,
        }]
      };
      chartDataTH.th14[newKey] = {
        labels: labels,
        datasets: [{
          label: clan.team_name,
          data: data2.th14,
          fill: true,
          backgroundColor: config.rgba.red,
          borderColor: config.rgb.red,
          pointBackgroundColor: config.rgb.red,
          pointBorderColor: config.rgb.white,
          pointHoverBackgroundColor: config.rgb.white,
          pointHoverBorderColor: config.rgb.red,
        }, {
          label: `AVERAGE [${clan.league.toUpperCase()}]`,
          data: dataAvg,
          fill: true,
          backgroundColor: config.rgba.black,
          borderColor: config.rgb.gray,
          pointBackgroundColor: config.rgb.gray,
          pointBorderColor: config.rgb.white,
          pointHoverBackgroundColor: config.rgb.white,
          pointHoverBorderColor: config.rgb.gray,
        }]
      };
      chartDataTH.th13[newKey] = {
        labels: labels,
        datasets: [{
          label: clan.team_name,
          data: data2.th13,
          fill: true,
          backgroundColor: config.rgba.red,
          borderColor: config.rgb.red,
          pointBackgroundColor: config.rgb.red,
          pointBorderColor: config.rgb.white,
          pointHoverBackgroundColor: config.rgb.white,
          pointHoverBorderColor: config.rgb.red,
        }, {
          label: `AVERAGE [${clan.league.toUpperCase()}]`,
          data: dataAvg,
          fill: true,
          backgroundColor: config.rgba.black,
          borderColor: config.rgb.gray,
          pointBackgroundColor: config.rgb.gray,
          pointBorderColor: config.rgb.white,
          pointHoverBackgroundColor: config.rgb.white,
          pointHoverBorderColor: config.rgb.gray,
        }]
      };
      chartDataTH.th12[newKey] = {
        labels: labels,
        datasets: [{
          label: clan.team_name,
          data: data2.th12,
          fill: true,
          backgroundColor: config.rgba.red,
          borderColor: config.rgb.red,
          pointBackgroundColor: config.rgb.red,
          pointBorderColor: config.rgb.white,
          pointHoverBackgroundColor: config.rgb.white,
          pointHoverBorderColor: config.rgb.red,
        }, {
          label: `AVERAGE [${clan.league.toUpperCase()}]`,
          data: dataAvg,
          fill: true,
          backgroundColor: config.rgba.black,
          borderColor: config.rgb.gray,
          pointBackgroundColor: config.rgb.gray,
          pointBorderColor: config.rgb.white,
          pointHoverBackgroundColor: config.rgb.white,
          pointHoverBorderColor: config.rgb.gray,
        }]
      };
    };
    // attackers
    let query = {};
    let sort = {};
    if (league == 'j1') {
      query = { 'townHallLevel': config.jwc.lvTH, 'homeClanAbbr.j': clan.clan_abbr, 'stats.j1.attacks.total.nAttacks': { $gt: 0 } };
      sort = { 'stats.j1.attacks.total.nTriples': -1, 'stats.j1.attacks.total.nAttacks': 1, 'stats.j1.attacks.total.avrgDestruction': -1, 'stats.j1.attacks.total.avrgLeft': -1 };
    }
    else if (league == 'j2') {
      query = { 'townHallLevel': config.jwc.lvTH, 'homeClanAbbr.j': clan.clan_abbr, 'stats.j2.attacks.total.nAttacks': { $gt: 0 } };
      sort = { 'stats.j2.attacks.total.nTriples': -1, 'stats.j2.attacks.total.nAttacks': 1, 'stats.j2.attacks.total.avrgDestruction': -1, 'stats.j2.attacks.total.avrgLeft': -1 };
    }
    else if (league == 'swiss') {
      query = { 'townHallLevel': config.jwc.lvTH, 'homeClanAbbr.swiss': clan.clan_abbr, 'stats.swiss.attacks.total.nAttacks': { $gt: 0 } };
      sort = { 'stats.swiss.attacks.total.nTriples': -1, 'stats.swiss.attacks.total.nAttacks': 1, 'stats.swiss.attacks.total.avrgDestruction': -1, 'stats.swiss.attacks.total.avrgLeft': -1 };
    }
    else if (league == 'mix') {
      query = { 'homeClanAbbr.mix': clan.clan_abbr, 'stats.mix.attacks.total.nAttacks': { $gt: 0 } };
      sort = { 'stats.mix.attacks.total.nTriples': -1, 'stats.mix.attacks.total.nAttacks': 1, 'stats.mix.attacks.total.avrgDestruction': -1, 'stats.mix.attacks.total.avrgLeft': -1 };
    };
    const options = {
      projection: {
        _id: 0,
        name: 1,
        townHallLevel: 1,
        stats: 1,
        pilotDC: 1
      }
    };
    const cursor = clientMongo.db('jwc').collection('players')
      .find(query, options).sort(sort);
    let accs = await cursor.toArray();
    await cursor.close();

    tableDataClanPlayers[newKey] = [];
    accs.map((acc, index) => {
      let lvTH = `<img class=discordIcon src=img/th/th${acc.townHallLevel}.png> TH${acc.townHallLevel}`;
      let name = String(acc.name).replace(/\'/g, '&#39;');
      name = name.replace(/\'/g, '&quot;');
      let rate = `${acc.stats[league].attacks.total.rate}% ( ${acc.stats[league].attacks.total.nTriples} / ${acc.stats[league].attacks.total.nAttacks} )`;
      let left = String(acc.stats[league].attacks.total.avrgLeft);
      let pilot = '-';
      if (acc.pilotDC != null && acc.pilotDC != 'no discord acc') {
        if (acc.pilotDC.id != null) {
          pilot = `<img class=discordIcon src=https://cdn.discordapp.com/avatars/${acc.pilotDC.id}/${acc.pilotDC.avatar}.png> ${acc.pilotDC.username}`;
        };
      };
      if (isNaN(left)) left = '-';
      tableDataClanPlayers[newKey].push([
        index + 1,
        lvTH,
        name,
        rate,
        `${acc.stats[league].attacks.total.avrgDestruction}%`,
        left,
        pilot,
      ]);
    });
  }));

  var path = `./express-gen-app/public/json/dataTeams_${league}.json`;
  fs.writeFile(path, JSON.stringify(dataTeams), (err) => {
    if (err) console.error(err);
    if (!err) console.dir(`JSON CREATED: dataTeams [${league}]`);
  });

  let tableColumnsRate = [
    { title: 'Attack type' },
    { title: `Hitrate [TH${config.jwc.lvTH}]` },
    { title: `Defrate [TH${config.jwc.lvTH}]` },
  ];

  let tableColumnsRateMix = [
    { title: 'Attack type' },
    { title: 'Hitrate [All TH lv.]' },
    { title: `Hitrate [TH${config.jwc.lvTHmix[0]}]` },
    { title: `Hitrate [TH${config.jwc.lvTHmix[1]}]` },
    { title: `Hitrate [TH${config.jwc.lvTHmix[2]}]` },
    { title: `Hitrate [TH${config.jwc.lvTHmix[3]}]` },
    { title: 'Defrate [All TH lv.]' },
    { title: `Defrate [TH${config.jwc.lvTHmix[0]}]` },
    { title: `Defrate [TH${config.jwc.lvTHmix[1]}]` },
    { title: `Defrate [TH${config.jwc.lvTHmix[2]}]` },
    { title: `Defrate [TH${config.jwc.lvTHmix[3]}]` },
  ];

  let tableColumnsClanPlayers = [
    { title: 'Rank' },
    { title: 'TH Lv.' },
    { title: 'Name' },
    { title: 'Hitrate' },
    { title: 'Dest.' },
    { title: 'Left' },
    { title: 'Pilot' },
  ];

  let tableRate = {};
  let tableClanPlayers = {};
  await Promise.all(Object.keys(dataTeams).map(async (key) => {
    tableRate[key] = {
      data: tableDataRate[key],
      lengthChange: false,
      searching: false,
      ordering: false,
      info: false,
      paging: false,
      scrollX: true,
      autoWidth: false,
      columnDefs: [{ 'className': 'dt-center', 'targets': '_all' }],
    };
    if (dataTeams[key].league == 'mix') {
      tableRate[key].columns = tableColumnsRateMix;
    }
    else {
      tableRate[key].columns = tableColumnsRate;
    };
    tableClanPlayers[key] = {
      columns: tableColumnsClanPlayers,
      data: tableDataClanPlayers[key],
      lengthChange: false,
      searching: false,
      ordering: true,
      info: false,
      paging: false,
      scrollX: true,
      autoWidth: false,
      columnDefs: [{ 'className': 'dt-center', 'targets': '_all' }],
    };
  }));

  var path = `./express-gen-app/public/json/tableRate_${league}.json`;
  fs.writeFile(path, JSON.stringify(tableRate), (err) => {
    if (err) console.error(err);
    if (!err) console.dir(`JSON CREATED: tableRate [${league}]`);
  });

  var path = `./express-gen-app/public/json/tableClanPlayers_${league}.json`;
  fs.writeFile(path, JSON.stringify(tableClanPlayers), (err) => {
    if (err) console.error(err);
    if (!err) console.dir(`JSON CREATED: tableClanPlayers [${league}]`);
  });

  var path = './express-gen-app/public/json/chartData.json';
  var path = `./express-gen-app/public/json/chartData_${league}.json`;
  fs.writeFile(path, JSON.stringify(chartData), (err) => {
    if (err) console.error(err);
    if (!err) console.dir(`JSON CREATED: chartData [${league}]`);
  });

  if (league == 'mix') {
    var path = `./express-gen-app/public/json/chartDataTH.json`;
    fs.writeFile(path, JSON.stringify(chartDataTH), (err) => {
      if (err) console.error(err);
      if (!err) console.dir('JSON CREATED: chartDataTH');
    });
  };

  return;
}
exports.teamData = teamData;

function hitrateAndDefrate(lvTH, clan) {
  let hitrate1 = {};
  let hitrate2 = {};
  let defrate1 = {};
  let defrate2 = {};
  let objHitrate = {};
  let objDefrate = {};
  if (clan.score.sum.clan.allAttackTypes == null) {
    objHitrate = {
      total: `--% ( 0 / 0 )`,
      fresh: `--% ( 0 / 0 )`,
      cleanup: `--% ( 0 / 0 )`,
      overkill: `--% ( 0 / 0 )`,
    };
    objDefrate = {
      total: `--% ( 0 / 0 )`,
      fresh: `--% ( 0 / 0 )`,
      cleanup: `--% ( 0 / 0 )`,
      overkill: `--% ( 0 / 0 )`,
    };
  }
  else {
    hitrate1[lvTH] = [
      `${Math.round(clan.score.sum.clan.allAttackTypes.hitrate[lvTH] * 10) / 10}%`,
      `${Math.round(clan.score.sum.clan.fresh.hitrate[lvTH] * 10) / 10}%`,
      `${Math.round(clan.score.sum.clan.cleanup.hitrate[lvTH] * 10) / 10}%`,
      `${Math.round(clan.score.sum.clan.overkill.hitrate[lvTH] * 10) / 10}%`,
    ];
    hitrate2[lvTH] = [
      `${clan.score.sum.clan.allAttackTypes.nTriple[lvTH]} / ${clan.score.sum.clan.allAttackTypes.nAt[lvTH]}`,
      `${clan.score.sum.clan.fresh.nTriple[lvTH]} / ${clan.score.sum.clan.fresh.nAt[lvTH]}`,
      `${clan.score.sum.clan.cleanup.nTriple[lvTH]} / ${clan.score.sum.clan.cleanup.nAt[lvTH]}`,
      `${clan.score.sum.clan.overkill.nTriple[lvTH]} / ${clan.score.sum.clan.overkill.nAt[lvTH]}`,
    ];
    objHitrate = {
      total: `${hitrate1[lvTH][0]} ( ${hitrate2[lvTH][0]} )`,
      fresh: `${hitrate1[lvTH][1]} ( ${hitrate2[lvTH][1]} )`,
      cleanup: `${hitrate1[lvTH][2]} ( ${hitrate2[lvTH][2]} )`,
      overkill: `${hitrate1[lvTH][3]} ( ${hitrate2[lvTH][3]} )`,
    };
    defrate1[lvTH] = [
      `${Math.round(clan.score.sum.clan.allAttackTypes.defrate[lvTH] * 10) / 10}%`,
      `${Math.round(clan.score.sum.clan.fresh.defrate[lvTH] * 10) / 10}%`,
      `${Math.round(clan.score.sum.clan.cleanup.defrate[lvTH] * 10) / 10}%`,
      `${Math.round(clan.score.sum.clan.overkill.defrate[lvTH] * 10) / 10}%`,
    ];
    defrate2[lvTH] = [
      `${clan.score.sum.clan.allAttackTypes.nDef[lvTH] - clan.score.sum.clan.allAttackTypes.nDefTriple[lvTH]} / ${clan.score.sum.clan.allAttackTypes.nDef[lvTH]}`,
      `${clan.score.sum.clan.fresh.nDef[lvTH] - clan.score.sum.clan.fresh.nDefTriple[lvTH]} / ${clan.score.sum.clan.fresh.nDef[lvTH]}`,
      `${clan.score.sum.clan.cleanup.nDef[lvTH] - clan.score.sum.clan.cleanup.nDefTriple[lvTH]} / ${clan.score.sum.clan.cleanup.nDef[lvTH]}`,
      `${clan.score.sum.clan.overkill.nDef[lvTH] - clan.score.sum.clan.overkill.nDefTriple[lvTH]} / ${clan.score.sum.clan.overkill.nDef[lvTH]}`,
    ];
    objDefrate = {
      total: `${defrate1[lvTH][0]} ( ${defrate2[lvTH][0]} )`,
      fresh: `${defrate1[lvTH][1]} ( ${defrate2[lvTH][1]} )`,
      cleanup: `${defrate1[lvTH][2]} ( ${defrate2[lvTH][2]} )`,
      overkill: `${defrate1[lvTH][3]} ( ${defrate2[lvTH][3]} )`,
    };
  }
  return [objHitrate, objDefrate];
};


async function tablePlayers(clientMongo, league) {
  let tableDataPlayers = {};

  let tableColumnsPlayers = [];
  if (league == 'j1' || league == 'j2') {
    tableColumnsPlayers = [
      { title: 'Rank' },
      { title: 'TH Lv.' },
      { title: 'Name' },
      { title: 'Clan' },
      { title: 'Div.' },
      { title: 'Hitrate' },
      { title: 'Dest.' },
      { title: 'Left' },
      { title: 'Pilot' },
    ];
  }
  else {
    tableColumnsPlayers = [
      { title: 'Rank' },
      { title: 'TH Lv.' },
      { title: 'Name' },
      { title: 'Clan' },
      { title: 'Hitrate' },
      { title: 'Dest.' },
      { title: 'Left' },
      { title: 'Pilot' },
    ];
  };

  if (league == 'j1') {
    query = { 'townHallLevel': config.jwc.lvTH, 'stats.j1.attacks.total.nAttacks': { $gt: 0 } };
    sort = { 'stats.j1.attacks.total.nTriples': -1, 'stats.j1.attacks.total.nAttacks': 1, 'stats.j1.attacks.total.avrgDestruction': -1, 'stats.j1.attacks.total.avrgLeft': -1 };
  }
  else if (league == 'j2') {
    query = { 'townHallLevel': config.jwc.lvTH, 'stats.j2.attacks.total.nAttacks': { $gt: 0 } };
    sort = { 'stats.j2.attacks.total.nTriples': -1, 'stats.j2.attacks.total.nAttacks': 1, 'stats.j2.attacks.total.avrgDestruction': -1, 'stats.j2.attacks.total.avrgLeft': -1 };
  }
  else if (league == 'swiss') {
    query = { 'townHallLevel': config.jwc.lvTH, 'stats.swiss.attacks.total.nAttacks': { $gt: 0 } };
    sort = { 'stats.swiss.attacks.total.nTriples': -1, 'stats.swiss.attacks.total.nAttacks': 1, 'stats.swiss.attacks.total.avrgDestruction': -1, 'stats.swiss.attacks.total.avrgLeft': -1 };
  }
  else if (league == 'mix') {
    query = { 'stats.mix.attacks.total.nAttacks': { $gt: 0 } };
    sort = { 'stats.mix.attacks.total.nTriples': -1, 'stats.mix.attacks.total.nAttacks': 1, 'stats.mix.attacks.total.avrgDestruction': -1, 'stats.mix.attacks.total.avrgLeft': -1 };
  };
  var cursor = clientMongo.db('jwc').collection('players').find(query).sort(sort);
  let accs = await cursor.toArray();
  await cursor.close();

  const teamList = await clientMongo.db('jwc').collection('config').findOne({ name: 'teamList' });

  tableDataPlayers = [];
  accs.map((acc, index) => {
    let lvTH = `<img class=discordIcon src=img/th/th${acc.townHallLevel}.png> TH${acc.townHallLevel}`;
    let name = String(acc.name).replace(/\'/g, '&#39;');
    name = name.replace(/\'/g, '&quot;');
    let league2 = league;
    if (league == 'j1' || league == 'j2') {
      league2 = 'j';
    };
    let clanAbbr = '';
    if (acc.homeClanAbbr != null) {
      clanAbbr = acc.homeClanAbbr[league2].toUpperCase();
    };
    let division = '';
    teamList[league].map((team) => {
      if (acc.homeClanAbbr != null) {
        if (team.team_abbr == acc.homeClanAbbr[league2]) {
          division = team.division.toUpperCase();
        };
      };
    });
    let rate = `${acc.stats[league].attacks.total.rate}% ( ${acc.stats[league].attacks.total.nTriples} / ${acc.stats[league].attacks.total.nAttacks} )`;
    let left = String(acc.stats[league].attacks.total.avrgLeft);
    let pilot = '-';
    if (acc.pilotDC != null && acc.pilotDC != 'no discord acc') {
      if (acc.pilotDC.id != null) {
        pilot = `<img class=discordIcon src=https://cdn.discordapp.com/avatars/${acc.pilotDC.id}/${acc.pilotDC.avatar}.png> ${acc.pilotDC.username}`;
      };
    };
    if (isNaN(left)) left = '-';
    if (league == 'j1' || league == 'j2') {
      tableDataPlayers.push([
        index + 1,
        lvTH,
        name,
        clanAbbr,
        division,
        rate,
        `${acc.stats[league].attacks.total.avrgDestruction}%`,
        left,
        pilot,
      ]);
    }
    else {
      tableDataPlayers.push([
        index + 1,
        lvTH,
        name,
        clanAbbr,
        rate,
        `${acc.stats[league].attacks.total.avrgDestruction}%`,
        left,
        pilot,
      ]);
    };
  });

  tablePlayers = {
    columns: tableColumnsPlayers,
    data: tableDataPlayers,
    lengthChange: false,
    searching: false,
    ordering: true,
    info: false,
    paging: false,
    scrollX: true,
    autoWidth: false,
    columnDefs: [{ 'className': 'dt-center', 'targets': '_all' }],
  };

  var path = `./express-gen-app/public/json/tablePlayers_${league}.json`;
  fs.writeFile(path, JSON.stringify(tablePlayers), (err) => {
    if (err) console.error(err);
    if (!err) console.dir(`JSON CREATED: tablePlayers [${league}]`);
  });

  return;
}
exports.tablePlayers = tablePlayers;


async function tableWars(clientMongo, league) {
  let tableDataWars = {};
  var wars = {};
  var myColl = clientMongo.db('jwc').collection('wars');
  var cursor = myColl.find({ season: config.jwc.season, league: league, name_match: { $ne: 'EXHIBITION' } });
  wars = await cursor.toArray();
  await cursor.close();

  var myPath = `./express-gen-app/public/json/teamInfo_${league}.json`;
  const teamInfoJson = fs.readFileSync(myPath, 'utf8');
  let teamInfo = JSON.parse(teamInfoJson);

  var myPath = `./express-gen-app/public/json/dataTeams_${league}.json`;
  const dataTeamsJson = fs.readFileSync(myPath, 'utf8');
  let dataTeams = JSON.parse(dataTeamsJson);

  await Promise.all(wars.map(async (war, index) => {
    let clanAbbr = {
      clan: `clan_${war.clan_abbr}`,
      opponent: `clan_${war.opponent_abbr}`,
    };
    let nameMatch = war.name_match.replace(/\'/g, '&#39;');
    if (war.name_match == '') {
      nameMatch = '-';
    };
    let point = {};
    let result = {};
    let stars = {};
    let distruction = {};
    let hitrate = {};
    let hitrate2 = {};

    if (war.result.state != 'warEnded') {
      point.clan = -1;
      point.opponent = -1;
      result.clan = `-`;
      result.opponent = `-`;
      stars.clan = `-`;
      stars.opponent = `-`;
      distruction.clan = `-`;
      distruction.opponent = `-`;
      hitrate.clan = -1;
      hitrate.opponent = -1;
      hitrate2.clan = `-`;
      hitrate2.opponent = `-`;
    }
    else {
      point.clan = teamInfo[clanAbbr.clan].score[`w${war.week}`].point;
      point.opponent = teamInfo[clanAbbr.opponent].score[`w${war.week}`].point;
      hitrate.clan = `${Math.round(teamInfo[clanAbbr.clan].score[`w${war.week}`].clan.allAttackTypes.hitrate.total * 10) / 10}%`;
      hitrate.opponent = `${Math.round(teamInfo[clanAbbr.opponent].score[`w${war.week}`].clan.allAttackTypes.hitrate.total * 10) / 10}%`;
      if (point.clan == 2) {
        result.clan = 'W';
      }
      else if (point.clan == 0) {
        result.clan = 'L';
      }
      else {
        result.clan = 'T';
      };
      if (point.opponent == 2) {
        result.opponent = 'W';
      }
      else if (point.opponent == 0) {
        result.opponent = 'L';
      }
      else {
        result.opponent = 'T';
      };

      stars.clan = `${war.clan_war.clan.stars} - ${war.opponent_war.clan.stars}`;
      stars.opponent = `${war.opponent_war.clan.stars} - ${war.clan_war.clan.stars}`;
      distruction.clan = `${Math.round(war.clan_war.clan.destruction * 10) / 10}% - ${Math.round(war.opponent_war.clan.destruction * 10) / 10}%`;
      distruction.opponent = `${Math.round(war.opponent_war.clan.destruction * 10) / 10}% - ${Math.round(war.clan_war.clan.destruction * 10) / 10}%`;
      hitrate2.clan = `${hitrate.clan} - ${hitrate.opponent}`;
      hitrate2.opponent = `${hitrate.opponent} - ${hitrate.clan}`;
    };

    let date = 'not yet scheduled';
    if (war.deal != '') {
      date = war.deal.date;
    };
    let arr = [
      war.week,
      dataTeams[clanAbbr.opponent].team_name,//えらー
      result.clan,
      stars.clan,
      distruction.clan,
      hitrate2.clan,
      date,
      nameMatch,
    ];
    if (tableDataWars[clanAbbr.clan] == null) {
      tableDataWars[clanAbbr.clan] = [];
    };
    tableDataWars[clanAbbr.clan].push(arr);

    let arrOpp = [
      war.week,
      dataTeams[clanAbbr.clan].team_name,
      result.opponent,
      stars.opponent,
      distruction.opponent,
      hitrate2.opponent,
      date,
      nameMatch,
    ];
    if (tableDataWars[clanAbbr.opponent] == null) {
      tableDataWars[clanAbbr.opponent] = [];
    };
    tableDataWars[clanAbbr.opponent].push(arrOpp);
  }));

  let tableColumnsWars = [
    { title: 'Week' },
    { title: 'Opponent' },
    { title: 'Result' },
    { title: 'Stars' },
    { title: 'Destruction' },
    { title: 'Hitrate' },
    { title: 'Date' },
    { title: 'Match Name' },
  ];

  let tableWars = {};
  Object.keys(dataTeams).map((key) => {
    tableWars[key] = {
      columns: tableColumnsWars,
      data: tableDataWars[key],
      lengthChange: false,
      searching: false,
      ordering: true,
      info: false,
      paging: false,
      scrollX: true,
      autoWidth: false,
      columnDefs: [{ 'className': 'dt-center', 'targets': '_all' }],
    };
  });
  var path = `./express-gen-app/public/json/tableWars_${league}.json`;
  fs.writeFile(path, JSON.stringify(tableWars), (err) => {
    if (err) console.error(err);
    if (!err) console.dir(`JSON CREATED: tableWars [${league}]`);
  });

  return;
}
exports.tableWars = tableWars;


async function tableStandings(clientMongo, league) {
  let tableDataStandings = [];
  let tableColumnsStandings = {};
  let clans = {};

  var myColl = clientMongo.db('jwc').collection('clans');
  var sort = {};
  if (league == 'mix') {
    sort = { 'score.sumQ.point': -1, 'score.sumQ.numWar': 1, 'score.sumQ.starPlusPtDefDifference': -1, 'score.sumQ.clan.sumDestruction': -1 };
  }
  else {
    sort = { 'score.sumQ.point': -1, 'score.sumQ.numWar': 1, 'score.sumQ.starDifference': -1, 'score.sumQ.clan.sumDestruction': -1 };
  };
  var cursor = myColl.find({ league: league, rep_1st: { $ne: null } }).sort(sort);
  clans = await cursor.toArray();
  await cursor.close();

  if (league == 'mix') {
    await Promise.all(clans.map(async (clan, index) => {
      let starDifference = clan.score.sumQ.starDifference;
      if (starDifference >= 0) {
        starDifference = `+${starDifference}`;
      };
      let ptDefDifference = clan.score.sumQ.ptDefDifference;
      if (ptDefDifference >= 0) {
        ptDefDifference = `+${ptDefDifference}`;
      };
      let destruction = '--';
      let hitrate = '--';
      let defrate = '--';
      if (clan.score.sumQ.clan.allAttackTypes != null) {
        destruction = Math.round(clan.score.sumQ.clan.destruction * 10) / 10;
        hitrate = Math.round(clan.score.sumQ.clan.allAttackTypes.hitrate.total * 10) / 10;
        defrate = Math.round(clan.score.sumQ.clan.allAttackTypes.defrate.total * 10) / 10;
      };
      let arr = [
        index + 1,
        clan.team_name,
        `${clan.score.sumQ.nWin}-${clan.score.sumQ.nLoss}`,
        starDifference,
        ptDefDifference,
        `${destruction}%`,
        `${hitrate}%`,
        `${defrate}%`,
        clan.division.toUpperCase(),
      ];
      tableDataStandings.push(arr);
    }));

    tableColumnsStandings = [
      { title: 'Rank' },
      { title: 'Clan' },
      { title: 'W-L' },
      { title: 'SD' },
      { title: 'DD' },
      { title: 'Dest.' },
      { title: 'Hitrate' },
      { title: 'Defrate' },
      { title: 'Group' },
    ];
  }
  else {
    await Promise.all(clans.map(async (clan, index) => {
      let starDifference = clan.score.sumQ.starDifference;
      if (starDifference >= 0) {
        starDifference = `+${starDifference}`;
      };
      let destruction = '--';
      let hitrate = '--';
      let defrate = '--';
      if (clan.score.sumQ.clan.allAttackTypes != null) {
        destruction = Math.round(clan.score.sumQ.clan.destruction * 10) / 10;
        hitrate = Math.round(clan.score.sumQ.clan.allAttackTypes.hitrate.total * 10) / 10;
        defrate = Math.round(clan.score.sumQ.clan.allAttackTypes.defrate.total * 10) / 10;
      };
      let arr = [
        index + 1,
        clan.team_name,
        `${clan.score.sumQ.nWin}-${clan.score.sumQ.nLoss}`,
        starDifference,
        `${destruction}%`,
        `${hitrate}%`,
        `${defrate}%`,
        clan.division.toUpperCase(),
      ];
      tableDataStandings.push(arr);
    }));

    tableColumnsStandings = [
      { title: 'Rank' },
      { title: 'Clan' },
      { title: 'W-L' },
      { title: 'SD' },
      { title: 'Dest.' },
      { title: 'Hitrate' },
      { title: 'Defrate' },
      { title: 'Division' },
    ];
  };

  let tableStandings = {
    columns: tableColumnsStandings,
    data: tableDataStandings,
    lengthChange: false,
    searching: false,
    ordering: true,
    info: false,
    paging: false,
    scrollX: true,
    autoWidth: false,
    columnDefs: [{ 'className': 'dt-center', 'targets': '_all' }],
  };

  var path = `./express-gen-app/public/json/tableStandings_${league}.json`;
  fs.writeFile(path, JSON.stringify(tableStandings), (err) => {
    if (err) console.error(err);
    if (!err) console.dir(`JSON CREATED: tableStandings [${league}]`);
  });

  return;
}
exports.tableStandings = tableStandings;


async function leagueStats(clientMongo, league) {
  let arrHitrate = {};
  arrHitrate.fresh = [];
  arrHitrate.cleanup = [];
  arrHitrate.overkill = [];
  arrHitrate.allAttackTypes = [];
  let arrHitrateMix = {};
  arrHitrateMix.th16 = {};
  arrHitrateMix.th15 = {};
  arrHitrateMix.th14 = {};
  arrHitrateMix.th13 = {};
  arrHitrateMix.th12 = {};
  arrHitrateMix.th16.fresh = [];
  arrHitrateMix.th16.cleanup = [];
  arrHitrateMix.th16.overkill = [];
  arrHitrateMix.th16.allAttackTypes = [];
  arrHitrateMix.th15.fresh = [];
  arrHitrateMix.th15.cleanup = [];
  arrHitrateMix.th15.overkill = [];
  arrHitrateMix.th15.allAttackTypes = [];
  arrHitrateMix.th14.fresh = [];
  arrHitrateMix.th14.cleanup = [];
  arrHitrateMix.th14.overkill = [];
  arrHitrateMix.th14.allAttackTypes = [];
  arrHitrateMix.th13.fresh = [];
  arrHitrateMix.th13.cleanup = [];
  arrHitrateMix.th13.overkill = [];
  arrHitrateMix.th13.allAttackTypes = [];
  arrHitrateMix.th12.fresh = [];
  arrHitrateMix.th12.cleanup = [];
  arrHitrateMix.th12.overkill = [];
  arrHitrateMix.th12.allAttackTypes = [];
  let chartDataLeagueStats = {};
  let labelsX = [];

  let tableDataLeagueStats = {};
  tableDataLeagueStats.th16 = [];
  tableDataLeagueStats.th15 = [];
  tableDataLeagueStats.th14 = [];
  tableDataLeagueStats.th13 = [];
  tableDataLeagueStats.th12 = [];

  const result = await clientMongo.db('jwc').collection('leagues')
    .findOne({ league: league });
  const leagueStats = result.stats;

  await Promise.all(Object.keys(leagueStats).map(async (key, index) => {
    if (key != 'sumQ' && leagueStats[key] != null) {
      let label = '';
      let week = '';
      let week2 = '';
      if (key == 'sum') {
        label = 'ALL WEEKS';
        week = 'All Weeks';
        week2 = 'All Weeks';
      }
      else {
        label = `WEEK ${index - 1}`;
        week = Number(index - 1);
        week2 = ('00' + week).slice(-2);
      };
      labelsX.push(label);
      arrHitrate.allAttackTypes.push(leagueStats[key].allAttackTypes.hitrate.total);
      arrHitrate.fresh.push(leagueStats[key].fresh.hitrate.total);
      arrHitrate.cleanup.push(leagueStats[key].cleanup.hitrate.total);
      arrHitrate.overkill.push(leagueStats[key].overkill.hitrate.total ?? NaN);
      arrHitrateMix.th16.allAttackTypes.push(leagueStats[key].allAttackTypes.hitrate.th16);
      arrHitrateMix.th16.fresh.push(leagueStats[key].fresh.hitrate.th16);
      arrHitrateMix.th16.cleanup.push(leagueStats[key].cleanup.hitrate.th16);
      arrHitrateMix.th16.overkill.push(leagueStats[key].overkill.hitrate.th16 ?? NaN);
      arrHitrateMix.th15.allAttackTypes.push(leagueStats[key].allAttackTypes.hitrate.th15);
      arrHitrateMix.th15.fresh.push(leagueStats[key].fresh.hitrate.th15);
      arrHitrateMix.th15.cleanup.push(leagueStats[key].cleanup.hitrate.th15);
      arrHitrateMix.th15.overkill.push(leagueStats[key].overkill.hitrate.th15 ?? NaN);
      arrHitrateMix.th14.allAttackTypes.push(leagueStats[key].allAttackTypes.hitrate.th14);
      arrHitrateMix.th14.fresh.push(leagueStats[key].fresh.hitrate.th14);
      arrHitrateMix.th14.cleanup.push(leagueStats[key].cleanup.hitrate.th14);
      arrHitrateMix.th14.overkill.push(leagueStats[key].overkill.hitrate.th14 ?? NaN);
      arrHitrateMix.th13.allAttackTypes.push(leagueStats[key].allAttackTypes.hitrate.th13);
      arrHitrateMix.th13.fresh.push(leagueStats[key].fresh.hitrate.th13);
      arrHitrateMix.th13.cleanup.push(leagueStats[key].cleanup.hitrate.th13);
      arrHitrateMix.th13.overkill.push(leagueStats[key].overkill.hitrate.th13 ?? NaN);
      arrHitrateMix.th12.allAttackTypes.push(leagueStats[key].allAttackTypes.hitrate.th12);
      arrHitrateMix.th12.fresh.push(leagueStats[key].fresh.hitrate.th12);
      arrHitrateMix.th12.cleanup.push(leagueStats[key].cleanup.hitrate.th12);
      arrHitrateMix.th12.overkill.push(leagueStats[key].overkill.hitrate.th12 ?? NaN);

      if (league == 'j1' || league == 'j2') {
        let objHitrate = fHitrate(leagueStats[key], 'total');
        let arr = [
          week,
          objHitrate.allAttackTypes,
          objHitrate.fresh,
          objHitrate.cleanup,
          objHitrate.overkill,
        ];
        tableDataLeagueStats.th16.push(arr);
      }
      else if (league == 'swiss') {
        let objHitrate = fHitrate(leagueStats[key], 'total');
        let arr = [
          week,
          objHitrate.fresh,
        ];
        tableDataLeagueStats.th16.push(arr);
      }
      else if (league == 'mix') {
        let objHitrate = {};
        let arr = {};
        objHitrate.th16 = fHitrate(leagueStats[key], 'th16');
        arr.th16 = [
          week2,
          objHitrate.th16.allAttackTypes,
          objHitrate.th16.fresh,
          objHitrate.th16.cleanup,
          objHitrate.th16.overkill,
        ];
        tableDataLeagueStats.th16.push(arr.th16);
        objHitrate.th15 = fHitrate(leagueStats[key], 'th15');
        arr.th15 = [
          week2,
          objHitrate.th15.allAttackTypes,
          objHitrate.th15.fresh,
          objHitrate.th15.cleanup,
          objHitrate.th15.overkill,
        ];
        tableDataLeagueStats.th15.push(arr.th15);
        objHitrate.th14 = fHitrate(leagueStats[key], 'th14');
        arr.th14 = [
          week2,
          objHitrate.th14.allAttackTypes,
          objHitrate.th14.fresh,
          objHitrate.th14.cleanup,
          objHitrate.th14.overkill,
        ];
        tableDataLeagueStats.th14.push(arr.th14);
        objHitrate.th13 = fHitrate(leagueStats[key], 'th13');
        arr.th13 = [
          week2,
          objHitrate.th13.allAttackTypes,
          objHitrate.th13.fresh,
          objHitrate.th13.cleanup,
          objHitrate.th13.overkill,
        ];
        tableDataLeagueStats.th13.push(arr.th13);
        objHitrate.th12 = fHitrate(leagueStats[key], 'th12');
        arr.th12 = [
          week2,
          objHitrate.th12.allAttackTypes,
          objHitrate.th12.fresh,
          objHitrate.th12.cleanup,
          objHitrate.th12.overkill,
        ];
        tableDataLeagueStats.th12.push(arr.th12);
      };
    };
  }));

  let tableLeagueStats = {};
  tableLeagueStats.th16 = {};
  tableLeagueStats.th15 = {};
  tableLeagueStats.th14 = {};
  tableLeagueStats.th13 = {};
  tableLeagueStats.th12 = {};
  if (league == 'j1' || league == 'j2') {
    chartDataLeagueStats = fChartDataLeagueStats(league, labelsX, arrHitrate);
    tableColumnsLeagueStats = [
      { title: 'Week' },
      { title: 'All Attack Types' },
      { title: 'Fresh' },
      { title: 'Cleanup' },
      { title: 'Overkill' },
    ];
    tableLeagueStats[`th${config.jwc.lvTH}`] = {
      columns: tableColumnsLeagueStats,
      data: tableDataLeagueStats[`th${config.jwc.lvTH}`],
      lengthChange: false,
      searching: false,
      ordering: true,
      info: false,
      paging: false,
      scrollX: true,
      autoWidth: false,
      columnDefs: [{ 'className': 'dt-center', 'targets': '_all' }],
    };
  }
  else if (league == 'swiss') {
    chartDataLeagueStats = fChartDataLeagueStats(league, labelsX, arrHitrate);
    tableColumnsLeagueStats = [
      { title: 'Week' },
      { title: 'Fresh' },
    ];
    tableLeagueStats[`th${config.jwc.lvTH}`] = {
      columns: tableColumnsLeagueStats,
      data: tableDataLeagueStats[`th${config.jwc.lvTH}`],
      lengthChange: false,
      searching: false,
      ordering: true,
      info: false,
      paging: false,
      scrollX: true,
      autoWidth: false,
      columnDefs: [{ 'className': 'dt-center', 'targets': '_all' }],
    };
  }
  else if (league == 'mix') {
    chartDataLeagueStats[`th${config.jwc.lvTHmix[0]}`] = fChartDataLeagueStats(league, labelsX, arrHitrateMix[`th${config.jwc.lvTHmix[0]}`]);
    chartDataLeagueStats[`th${config.jwc.lvTHmix[1]}`] = fChartDataLeagueStats(league, labelsX, arrHitrateMix[`th${config.jwc.lvTHmix[1]}`]);
    chartDataLeagueStats[`th${config.jwc.lvTHmix[2]}`] = fChartDataLeagueStats(league, labelsX, arrHitrateMix[`th${config.jwc.lvTHmix[2]}`]);
    chartDataLeagueStats[`th${config.jwc.lvTHmix[3]}`] = fChartDataLeagueStats(league, labelsX, arrHitrateMix[`th${config.jwc.lvTHmix[3]}`]);
    tableColumnsLeagueStats = [
      { title: 'Week' },
      { title: 'All Attack Types' },
      { title: 'Fresh' },
      { title: 'Cleanup' },
      { title: 'Overkill' },
    ];
    tableLeagueStats[`th${config.jwc.lvTHmix[0]}`] = {
      columns: tableColumnsLeagueStats,
      data: tableDataLeagueStats[`th${config.jwc.lvTHmix[0]}`],
      lengthChange: false,
      searching: false,
      ordering: true,
      info: false,
      paging: false,
      scrollX: true,
      autoWidth: false,
      columnDefs: [{ 'className': 'dt-center', 'targets': '_all' }],
    };
    tableLeagueStats[`th${config.jwc.lvTHmix[1]}`] = {
      columns: tableColumnsLeagueStats,
      data: tableDataLeagueStats[`th${config.jwc.lvTHmix[1]}`],
      lengthChange: false,
      searching: false,
      ordering: true,
      info: false,
      paging: false,
      scrollX: true,
      autoWidth: false,
      columnDefs: [{ 'className': 'dt-center', 'targets': '_all' }],
    };
    tableLeagueStats[`th${config.jwc.lvTHmix[2]}`] = {
      columns: tableColumnsLeagueStats,
      data: tableDataLeagueStats[`th${config.jwc.lvTHmix[2]}`],
      lengthChange: false,
      searching: false,
      ordering: true,
      info: false,
      paging: false,
      scrollX: true,
      autoWidth: false,
      columnDefs: [{ 'className': 'dt-center', 'targets': '_all' }],
    };
    tableLeagueStats[`th${config.jwc.lvTHmix[3]}`] = {
      columns: tableColumnsLeagueStats,
      data: tableDataLeagueStats[`th${config.jwc.lvTHmix[3]}`],
      lengthChange: false,
      searching: false,
      ordering: true,
      info: false,
      paging: false,
      scrollX: true,
      autoWidth: false,
      columnDefs: [{ 'className': 'dt-center', 'targets': '_all' }],
    };
  };

  var path = `./express-gen-app/public/json/chartDataLeagueStats_${league}.json`;
  fs.writeFile(path, JSON.stringify(chartDataLeagueStats), (err) => {
    if (err) console.error(err);
    if (!err) console.dir(`JSON CREATED: leagueStats [${league}]`);
  });

  var path = `./express-gen-app/public/json/tableLeagueStats_${league}.json`;
  fs.writeFile(path, JSON.stringify(tableLeagueStats), (err) => {
    if (err) console.error(err);
    if (!err) console.dir(`JSON CREATED: tableLeagueStats [${league}]`);
  });

  return;
}
exports.leagueStats = leagueStats;

function fChartDataLeagueStats(league, labelsX, arrHitrate) {
  let chartDataLeagueStats = {};
  if (league != 'swiss') {
    chartDataLeagueStats = {
      labels: labelsX,
      datasets: [
        {
          label: `ALL ATTACK TYPES`,
          data: arrHitrate.allAttackTypes,
          borderWidth: 1,
          borderColor: config.rgb.allAttackTypes,
          backgroundColor: config.rgba.allAttackTypes,
        },
        {
          label: `FLESH`,
          data: arrHitrate.fresh,
          borderWidth: 1,
          borderColor: config.rgb.fresh,
          backgroundColor: config.rgba.fresh,
        },
        {
          label: `CLEANUP`,
          data: arrHitrate.cleanup,
          borderWidth: 1,
          borderColor: config.rgb.cleanup,
          backgroundColor: config.rgba.cleanup,
        },
        {
          label: `OVERKILL`,
          data: arrHitrate.overkill,
          borderWidth: 1,
          borderColor: config.rgb.overkill,
          backgroundColor: config.rgba.overkill,
        },
      ]
    };
  }
  else {
    chartDataLeagueStats = {
      labels: labelsX,
      datasets: [
        {
          label: `FLESH`,
          data: arrHitrate.fresh,
          borderWidth: 1,
          borderColor: config.rgb.fresh,
          backgroundColor: config.rgba.fresh,
        },
      ]
    };
  };
  return chartDataLeagueStats;
};

function fHitrate(leagueStats, lvTH) {
  let hitrate1 = [
    `${Math.round(leagueStats.allAttackTypes.hitrate[lvTH] * 10) / 10}%`,
    `${Math.round(leagueStats.fresh.hitrate[lvTH] * 10) / 10}%`,
    `${Math.round(leagueStats.cleanup.hitrate[lvTH] * 10) / 10}%`,
    `${Math.round(leagueStats.overkill.hitrate[lvTH] * 10) / 10}%`,
  ];
  let hitrate2 = [
    `${leagueStats.allAttackTypes.nTriple[lvTH]} / ${leagueStats.allAttackTypes.nAt[lvTH]}`,
    `${leagueStats.fresh.nTriple[lvTH]} / ${leagueStats.fresh.nAt[lvTH]}`,
    `${leagueStats.cleanup.nTriple[lvTH]} / ${leagueStats.cleanup.nAt[lvTH]}`,
    `${leagueStats.overkill.nTriple[lvTH]} / ${leagueStats.overkill.nAt[lvTH]}`,
  ];
  let objHitrate = {
    allAttackTypes: `${hitrate1[0]} ( ${hitrate2[0]} )`,
    fresh: `${hitrate1[1]} ( ${hitrate2[1]} )`,
    cleanup: `${hitrate1[2]} ( ${hitrate2[2]} )`,
    overkill: `${hitrate1[3]} ( ${hitrate2[3]} )`,
  };
  return objHitrate;
};

/*
async function matchList() {
  let teamName = {};
  var myPath = `./json/clan_list.json`;
  const clanListJSON = fs.readFileSync(myPath, 'utf8');
  let clanList = JSON.parse(clanListJSON);
  clanList.j1.forEach(clan => {
    teamName[clan.clan_abbr] = clan.team_name.replace(/\\/g, '');
  });
  clanList.j2.forEach(clan => {
    teamName[clan.clan_abbr] = clan.team_name.replace(/\\/g, '');
  });
  clanList.swiss.forEach(clan => {
    teamName[clan.clan_abbr] = clan.team_name.replace(/\\/g, '');
  });
  clanList.mix.forEach(clan => {
    teamName[clan.clan_abbr] = clan.team_name.replace(/\\/g, '');
  });

  let matchList = {};
  matchList.j1 = {};
  matchList.j2 = {};
  matchList.swiss = {};
  matchList.mix = {};

  var query = { season: config.jwc.season };
  var sort = { week: 1, match: 1 };
  var myColl = clientMongo.db('jwc').collection('wars');
  var cursor = myColl.find(query).sort(sort);
  let wars = await cursor.toArray();
  await cursor.close();

  await Promise.all(wars.map(async (war, index) => {
    if (war.league == 'j1' || war.league == 'j2' || war.league == 'swiss' || war.league == 'mix') {
      //let arr = { name: `MATCH ${war.match}: ${war.clan_abbr.toUpperCase()} vs ${war.opponent_abbr.toUpperCase()}`, value: war.match };
      let arr = { name: `M${war.match}: ${teamName[war.clan_abbr]} vs ${teamName[war.opponent_abbr]}`, value: war.match };
      if (matchList[war.league][`w${war.week}`] === undefined) {
        matchList[war.league][`w${war.week}`] = [];
      };
      matchList[war.league][`w${war.week}`].push(arr);
    };
  }));

  var path = './json/match_list.json';
  fs.writeFile(path, JSON.stringify(matchList), (err) => {
    if (err) console.error(err);
    if (!err) console.dir('JSON CREATED: match_list.json');
  });

  return;
}
exports.matchList = matchList;


async function clanList() {
  let clanList = {};
  clanList.j1 = [];
  clanList.j2 = [];
  clanList.swiss = [];
  clanList.mix = [];

  var sort = { 'clan_abbr': 1 };
  var myColl = clientMongo.db('jwc').collection('clans');
  var cursor = myColl.find().sort(sort);
  let clans = await cursor.toArray();
  await cursor.close();

  await Promise.all(clans.map(async (clan, index) => {
    if (clan.league == 'j1' || clan.league == 'j2' || clan.league == 'swiss' || clan.league == 'mix') {
      let arr = { clan_abbr: clan.clan_abbr, clan_name: clan.clan_name, team_name: clan.team_name, division: clan.division };
      clanList[clan.league].push(arr);
    };
  }));

  clanList.dummy = [];
  clanList.dummy.push({ clan_abbr: 'dummy', clan_name: 'DUMMY', team_name: 'DUMMY', division: '' });

  var path = './json/clan_list.json';
  fs.writeFile(path, JSON.stringify(clanList), (err) => {
    if (err) console.error(err);
    if (!err) console.dir('JSON CREATED: clan_list.json');
  });

  return;
}
exports.clanList = clanList;


async function clanAbbrList() {
  let clanAbbrList = {};
  clanAbbrList.j1 = [];
  clanAbbrList.j2 = [];
  clanAbbrList.swiss = [];
  clanAbbrList.mix = [];

  var sort = { 'clan_abbr': 1 };
  var myColl = clientMongo.db('jwc').collection('clans');
  var cursor = myColl.find().sort(sort);
  let clans = await cursor.toArray();
  await cursor.close();

  await Promise.all(clans.map(async (clan, index) => {
    let league = clan.league;

    if (league == 'j1' || league == 'j2' || league == 'swiss' || league == 'mix') {
      let newKey = `clan_${clan.clan_abbr}`;
      clanAbbrList[league].push(newKey);
    };
  }));

  var path = './express-gen-app/public/json/clanAbbrList.json';
  fs.writeFile(path, JSON.stringify(clanAbbrList), (err) => {
    if (err) console.error(err);
    if (!err) console.dir('JSON CREATED: clanAbbrList');
  });

  return;
}
exports.clanAbbrList = clanAbbrList;
*/