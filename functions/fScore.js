import config from "../config/config.js";
import * as functions from "./functions.js";
import * as ss from "simple-statistics";

async function autoUpdate(clientMongo, league) {
  let rtn_description = "";

  const cursor = clientMongo.db("jwc").collection("clans")
    .find({ league: league, [`status.${functions.seasonToString(config.season[league])}`]: "true" });
  let mongoClans = await cursor.toArray();
  await cursor.close();

  // リーグ内全チームスコア更新
  rtn_description += "* **Score**\n";
  let arrDescription = [];
  await Promise.all(mongoClans.map(async (mongoClan, index) => {
    await updateScore(clientMongo, league, mongoClan);
    arrDescription[index] = `${mongoClan.team_name}\n`;
  }));

  arrDescription.forEach(function (description) {
    rtn_description += description;
  });

  // リーグ全体スタッツ更新
  rtn_description += "* **Stats in League**\n";
  let mongoLeague = await clientMongo.db("jwc").collection("leagues").findOne(
    { league: league },
    { projection: { stats: 1, _id: 0 } }
  );
  const statsLeague = await calcStatsLeague(clientMongo, mongoClans, league, mongoLeague);
  if (mongoLeague == null) { // 初回登録
    const listing = { league: league, stats: statsLeague };
    await clientMongo.db("jwc").collection("leagues").insertOne(listing);
    rtn_description += "_Added_\n";
  }
  else {
    await clientMongo.db("jwc").collection("leagues").updateOne({ league: league }, { $set: { stats: statsLeague } });
    rtn_description += "_Updated_\n";
  };

  // リーグ内全チーム偏差値更新
  rtn_description += "* **T Score**\n";
  let mongoLeagueUpdated = await clientMongo.db("jwc").collection("leagues").findOne(
    { league: league },
    { projection: { stats: 1, _id: 0 } }
  );
  await Promise.all(mongoClans.map(async (mongoClan, index) => {
    await calcTScore(clientMongo, mongoClan, mongoLeagueUpdated);
    arrDescription[index] = `${mongoClan.team_name}\n`;
  }));

  arrDescription.forEach(function (description) {
    rtn_description += description;
  });

  return rtn_description;
};
export { autoUpdate };


async function calcTScore(clientMongo, mongoClan, mongoLeague) {
  let objScore = mongoClan.score;
  let tScore = {};
  let tScoreDef = {};

  if (objScore) {
    Object.keys(objScore).forEach((key) => {
      if (key != "penalty" && key != "add" && key != "w0") {
        let scoreClan = objScore[key].clan;
        tScore[key] = {};
        tScore[key].allAttackTypes = objTScore(scoreClan, mongoLeague.stats[key], "allAttackTypes", "hitrate");
        tScore[key].fresh = objTScore(scoreClan, mongoLeague.stats[key], "fresh", "hitrate");
        tScore[key].cleanup = objTScore(scoreClan, mongoLeague.stats[key], "cleanup", "hitrate");
        tScore[key].overkill = objTScore(scoreClan, mongoLeague.stats[key], "overkill", "hitrate");
        tScoreDef[key] = {};
        tScoreDef[key].allAttackTypes = objTScore(scoreClan, mongoLeague.stats[key], "allAttackTypes", "defrate");
        tScoreDef[key].fresh = objTScore(scoreClan, mongoLeague.stats[key], "fresh", "defrate");
        tScoreDef[key].cleanup = objTScore(scoreClan, mongoLeague.stats[key], "cleanup", "defrate");
        tScoreDef[key].overkill = objTScore(scoreClan, mongoLeague.stats[key], "overkill", "defrate");
      };
    });
  };

  let stats = {};
  stats.tScore = tScore;
  stats.tScoreDef = tScoreDef;

  clientMongo.db("jwc").collection("clans")
    .updateOne({ clan_abbr: mongoClan.clan_abbr }, { $set: { stats: stats } });
};


function objTScore(scoreClan, statsLeague, attackType, action) {
  let objTScore = {};
  objTScore.total = ss_tScore(scoreClan, statsLeague, attackType, "total", action);
  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let keyLvTH = `th${iTH}`;
    objTScore[keyLvTH] = ss_tScore(scoreClan, statsLeague, attackType, keyLvTH, action);
  };
  return objTScore;
};


function ss_tScore(scoreClan, statsLeague, attackType, lvTH, action) {
  if (!scoreClan || !statsLeague || !scoreClan[attackType] || !statsLeague[attackType]) {
    return;
  };
  let value = scoreClan[attackType][action][lvTH];
  let mean = statsLeague[attackType][action][lvTH];
  let sd = 0;
  if (action == "hitrate") {
    sd = statsLeague[attackType].sd[lvTH];
  }
  else {
    sd = statsLeague[attackType].sdDef[lvTH];
  }
  let tScore = 50 + 10 * ss.zScore(value, mean, sd);
  tScore = Math.round(tScore * 100) / 100;
  return tScore;
};


async function calcStatsLeague(clientMongo, mongoClans, league, mongoLeague) {
  const arrWeeks = ["sum", "sumQ", "w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8", "w9", "w10", "w11", "w12", "w13", "w14", "w15"];
  let statsLeague = {};
  let weekNow = await functions.getWeekNow(league);

  await Promise.all(arrWeeks.map(async (weekStr, index) => {
    if (index <= weekNow + 1) {
      statsLeague[weekStr] = await calcStatsLeagueWeek(mongoClans, weekStr);
      //}
      //else {
      //  statsLeague[weekStr] = mongoLeague.stats[weekStr];
    };
  }));

  return statsLeague;
};


async function calcStatsLeagueWeek(mongoClans, weekStr) {
  let allAttackTypes = {};
  let fresh = {};
  let cleanup = {};
  let overkill = {};

  // ********** allAttackTypes **********
  let nAt = {};
  let nTriple = {};
  let nDef = {};
  let nDefTriple = {};
  let hitrate = {};
  let defrate = {};

  let obj_nAt = {};
  let obj_nTriple = {};
  let obj_nDef = {};
  let obj_nDefTriple = {};
  let obj_hitrate = {};
  let obj_defrate = {};

  let sd = {};
  let sdDef = {};

  obj_nAt.total = returnArr(mongoClans, weekStr, "allAttackTypes", "nAt", "total");
  nAt.total = ss.sum(obj_nAt.total);
  obj_nTriple.total = returnArr(mongoClans, weekStr, "allAttackTypes", "nTriple", "total");
  nTriple.total = ss.sum(obj_nTriple.total);
  obj_nDef.total = returnArr(mongoClans, weekStr, "allAttackTypes", "nDef", "total");
  nDef.total = ss.sum(obj_nDef.total);
  obj_nDefTriple.total = returnArr(mongoClans, weekStr, "allAttackTypes", "nDefTriple", "total");
  nDefTriple.total = ss.sum(obj_nDefTriple.total);

  obj_hitrate.total = returnArr(mongoClans, weekStr, "allAttackTypes", "hitrate", "total");
  hitrate.total = Math.round((nTriple.total / nAt.total) * 100 * 100) / 100;
  if (obj_hitrate.total.length != 0) sd.total = Math.round(ss.standardDeviation(obj_hitrate.total) * 100) / 100;
  obj_defrate.total = returnArr(mongoClans, weekStr, "allAttackTypes", "defrate", "total");
  defrate.total = Math.round((100 - (nDefTriple.total / nDef.total) * 100) * 100) / 100;
  if (obj_defrate.total.length != 0) sdDef.total = Math.round(ss.standardDeviation(obj_defrate.total) * 100) / 100;

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let keyLvTH = `th${iTH}`;

    obj_nAt[keyLvTH] = returnArr(mongoClans, weekStr, "allAttackTypes", "nAt", keyLvTH);
    nAt[keyLvTH] = ss.sum(obj_nAt[keyLvTH]);
    obj_nTriple[keyLvTH] = returnArr(mongoClans, weekStr, "allAttackTypes", "nTriple", keyLvTH);
    nTriple[keyLvTH] = ss.sum(obj_nTriple[keyLvTH]);
    obj_nDef[keyLvTH] = returnArr(mongoClans, weekStr, "allAttackTypes", "nDef", keyLvTH);
    nDef[keyLvTH] = ss.sum(obj_nDef[keyLvTH]);
    obj_nDefTriple[keyLvTH] = returnArr(mongoClans, weekStr, "allAttackTypes", "nDefTriple", keyLvTH);
    nDefTriple[keyLvTH] = ss.sum(obj_nDefTriple[keyLvTH]);

    obj_hitrate[keyLvTH] = returnArr(mongoClans, weekStr, "allAttackTypes", "hitrate", keyLvTH);
    hitrate[keyLvTH] = Math.round((nTriple[keyLvTH] / nAt[keyLvTH]) * 100 * 100) / 100;
    if (obj_hitrate[keyLvTH].length != 0) sd[keyLvTH] = Math.round(ss.standardDeviation(obj_hitrate[keyLvTH]) * 100) / 100;
    obj_defrate[keyLvTH] = returnArr(mongoClans, weekStr, "allAttackTypes", "defrate", keyLvTH);
    defrate[keyLvTH] = Math.round((100 - (nDefTriple[keyLvTH] / nDef[keyLvTH]) * 100) * 100) / 100;
    if (obj_defrate[keyLvTH].length != 0) sdDef[keyLvTH] = Math.round(ss.standardDeviation(obj_defrate[keyLvTH]) * 100) / 100;
  };

  allAttackTypes.nAt = nAt;
  allAttackTypes.nTriple = nTriple;
  allAttackTypes.nDef = nDef;
  allAttackTypes.nDefTriple = nDefTriple;

  allAttackTypes.hitrate = hitrate;
  allAttackTypes.sd = sd;
  allAttackTypes.defrate = defrate;
  allAttackTypes.sdDef = sdDef;
  // ********** allAttackTypes **********

  // ********** fresh **********
  let nFresh = {};
  let nTripleFresh = {};
  let nDefFresh = {};
  let nDefTripleFresh = {};
  let hitrateFresh = {};
  let defrateFresh = {};

  let obj_nFresh = {};
  let obj_nTripleFresh = {};
  let obj_nDefFresh = {};
  let obj_nDefTripleFresh = {};
  let obj_hitrateFresh = {};
  let obj_defrateFresh = {};

  let sdFresh = {};
  let sdDefFresh = {};

  obj_nFresh.total = returnArr(mongoClans, weekStr, "fresh", "nAt", "total");
  nFresh.total = ss.sum(obj_nFresh.total);
  obj_nTripleFresh.total = returnArr(mongoClans, weekStr, "fresh", "nTriple", "total");
  nTripleFresh.total = ss.sum(obj_nTripleFresh.total);
  obj_nDefFresh.total = returnArr(mongoClans, weekStr, "fresh", "nDef", "total");
  nDefFresh.total = ss.sum(obj_nDefFresh.total);
  obj_nDefTripleFresh.total = returnArr(mongoClans, weekStr, "fresh", "nDefTriple", "total");
  nDefTripleFresh.total = ss.sum(obj_nDefTripleFresh.total);

  obj_hitrateFresh.total = returnArr(mongoClans, weekStr, "fresh", "hitrate", "total");
  hitrateFresh.total = Math.round((nTripleFresh.total / nFresh.total) * 100 * 100) / 100;
  if (obj_hitrateFresh.total.length != 0) sdFresh.total = Math.round(ss.standardDeviation(obj_hitrateFresh.total) * 100) / 100;
  defrateFresh.total = Math.round((100 - (nDefTripleFresh.total / nDefFresh.total) * 100) * 100) / 100;
  obj_defrateFresh.total = returnArr(mongoClans, weekStr, "fresh", "defrate", "total");
  if (obj_defrateFresh.total.length != 0) sdDefFresh.total = Math.round(ss.standardDeviation(obj_defrateFresh.total) * 100) / 100;

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let keyLvTH = `th${iTH}`;

    obj_nFresh[keyLvTH] = returnArr(mongoClans, weekStr, "fresh", "nAt", keyLvTH);
    nFresh[keyLvTH] = ss.sum(obj_nFresh[keyLvTH]);
    obj_nTripleFresh[keyLvTH] = returnArr(mongoClans, weekStr, "fresh", "nTriple", keyLvTH);
    nTripleFresh[keyLvTH] = ss.sum(obj_nTripleFresh[keyLvTH]);
    obj_nDefFresh[keyLvTH] = returnArr(mongoClans, weekStr, "fresh", "nDef", keyLvTH);
    nDefFresh[keyLvTH] = ss.sum(obj_nDefFresh[keyLvTH]);
    obj_nDefTripleFresh[keyLvTH] = returnArr(mongoClans, weekStr, "fresh", "nDefTriple", keyLvTH);
    nDefTripleFresh[keyLvTH] = ss.sum(obj_nDefTripleFresh[keyLvTH]);

    obj_hitrateFresh[keyLvTH] = returnArr(mongoClans, weekStr, "fresh", "hitrate", keyLvTH);
    hitrateFresh[keyLvTH] = Math.round((nTripleFresh[keyLvTH] / nFresh[keyLvTH]) * 100 * 100) / 100;
    if (obj_hitrateFresh[keyLvTH].length != 0) sdFresh[keyLvTH] = Math.round(ss.standardDeviation(obj_hitrateFresh[keyLvTH]) * 100) / 100;
    obj_defrateFresh[keyLvTH] = returnArr(mongoClans, weekStr, "fresh", "defrate", keyLvTH);
    defrateFresh[keyLvTH] = Math.round((100 - (nDefTripleFresh[keyLvTH] / nDefFresh[keyLvTH]) * 100) * 100) / 100;
    if (obj_defrateFresh[keyLvTH].length != 0) sdDefFresh[keyLvTH] = Math.round(ss.standardDeviation(obj_defrateFresh[keyLvTH]) * 100) / 100;
  };

  fresh.nAt = nFresh;
  fresh.nTriple = nTripleFresh;
  fresh.nDef = nDefFresh;
  fresh.nDefTriple = nDefTripleFresh;

  fresh.hitrate = hitrateFresh;
  fresh.sd = sdFresh;
  fresh.defrate = defrateFresh;
  fresh.sdDef = sdDefFresh;
  // ********** fresh **********

  // ********** cleanup **********
  let nCleanup = {};
  let nTripleCleanup = {};
  let nDefCleanup = {};
  let nDefTripleCleanup = {};
  let hitrateCleanup = {};
  let defrateCleanup = {};

  let obj_nCleanup = {};
  let obj_nTripleCleanup = {};
  let obj_nDefCleanup = {};
  let obj_nDefTripleCleanup = {};
  let obj_hitrateCleanup = {};
  let obj_defrateCleanup = {};

  let sdCleanup = {};
  let sdDefCleanup = {};

  obj_nCleanup.total = returnArr(mongoClans, weekStr, "cleanup", "nAt", "total");
  nCleanup.total = ss.sum(obj_nCleanup.total);
  obj_nTripleCleanup.total = returnArr(mongoClans, weekStr, "cleanup", "nTriple", "total");
  nTripleCleanup.total = ss.sum(obj_nTripleCleanup.total);
  obj_nDefCleanup.total = returnArr(mongoClans, weekStr, "cleanup", "nDef", "total");
  nDefCleanup.total = ss.sum(obj_nDefCleanup.total);
  obj_nDefTripleCleanup.total = returnArr(mongoClans, weekStr, "cleanup", "nDefTriple", "total");
  nDefTripleCleanup.total = ss.sum(obj_nDefTripleCleanup.total);

  obj_hitrateCleanup.total = returnArr(mongoClans, weekStr, "cleanup", "hitrate", "total");
  hitrateCleanup.total = Math.round((nTripleCleanup.total / nCleanup.total) * 100 * 100) / 100;
  if (obj_hitrateCleanup.total.length != 0) sdCleanup.total = Math.round(ss.standardDeviation(obj_hitrateCleanup.total) * 100) / 100;
  defrateCleanup.total = Math.round((100 - (nDefTripleCleanup.total / nDefCleanup.total) * 100) * 100) / 100;
  obj_defrateCleanup.total = returnArr(mongoClans, weekStr, "cleanup", "defrate", "total");
  if (obj_defrateCleanup.total.length != 0) sdDefCleanup.total = Math.round(ss.standardDeviation(obj_defrateCleanup.total) * 100) / 100;

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let keyLvTH = `th${iTH}`;

    obj_nCleanup[keyLvTH] = returnArr(mongoClans, weekStr, "cleanup", "nAt", keyLvTH);
    nCleanup[keyLvTH] = ss.sum(obj_nCleanup[keyLvTH]);
    obj_nTripleCleanup[keyLvTH] = returnArr(mongoClans, weekStr, "cleanup", "nTriple", keyLvTH);
    nTripleCleanup[keyLvTH] = ss.sum(obj_nTripleCleanup[keyLvTH]);
    obj_nDefCleanup[keyLvTH] = returnArr(mongoClans, weekStr, "cleanup", "nDef", keyLvTH);
    nDefCleanup[keyLvTH] = ss.sum(obj_nDefCleanup[keyLvTH]);
    obj_nDefTripleCleanup[keyLvTH] = returnArr(mongoClans, weekStr, "cleanup", "nDefTriple", keyLvTH);
    nDefTripleCleanup[keyLvTH] = ss.sum(obj_nDefTripleCleanup[keyLvTH]);

    obj_hitrateCleanup[keyLvTH] = returnArr(mongoClans, weekStr, "cleanup", "hitrate", keyLvTH);
    hitrateCleanup[keyLvTH] = Math.round((nTripleCleanup[keyLvTH] / nCleanup[keyLvTH]) * 100 * 100) / 100;
    if (obj_hitrateCleanup[keyLvTH].length != 0) sdCleanup[keyLvTH] = Math.round(ss.standardDeviation(obj_hitrateCleanup[keyLvTH]) * 100) / 100;
    obj_defrateCleanup[keyLvTH] = returnArr(mongoClans, weekStr, "cleanup", "defrate", keyLvTH);
    defrateCleanup[keyLvTH] = Math.round((100 - (nDefTripleCleanup[keyLvTH] / nDefCleanup[keyLvTH]) * 100) * 100) / 100;
    if (obj_defrateCleanup[keyLvTH].length != 0) sdDefCleanup[keyLvTH] = Math.round(ss.standardDeviation(obj_defrateCleanup[keyLvTH]) * 100) / 100;
  };

  cleanup.nAt = nCleanup;
  cleanup.nTriple = nTripleCleanup;
  cleanup.nDef = nDefCleanup;
  cleanup.nDefTriple = nDefTripleCleanup;

  cleanup.hitrate = hitrateCleanup;
  cleanup.sd = sdCleanup;
  cleanup.defrate = defrateCleanup;
  cleanup.sdDef = sdDefCleanup;
  // ********** cleanup **********

  // ********** overkill **********
  let nOverkill = {};
  let obj_nOverkill = {};
  let nTripleOverkill = {};
  let obj_nTripleOverkill = {};
  let nDefOverkill = {};
  let obj_nDefOverkill = {};
  let nDefTripleOverkill = {};
  let obj_nDefTripleOverkill = {};

  let hitrateOverkill = {};
  let obj_hitrateOverkill = {};
  let sdOverkill = {};
  let defrateOverkill = {};
  let obj_defrateOverkill = {};
  let sdDefOverkill = {};

  obj_nOverkill.total = returnArr(mongoClans, weekStr, "overkill", "nAt", "total");
  nOverkill.total = ss.sum(obj_nOverkill.total);
  obj_nTripleOverkill.total = returnArr(mongoClans, weekStr, "overkill", "nTriple", "total");
  nTripleOverkill.total = ss.sum(obj_nTripleOverkill.total);
  obj_nDefOverkill.total = returnArr(mongoClans, weekStr, "overkill", "nDef", "total");
  nDefOverkill.total = ss.sum(obj_nDefOverkill.total);
  obj_nDefTripleOverkill.total = returnArr(mongoClans, weekStr, "overkill", "nDefTriple", "total");
  nDefTripleOverkill.total = ss.sum(obj_nDefTripleOverkill.total);

  obj_hitrateOverkill.total = returnArr(mongoClans, weekStr, "overkill", "hitrate", "total");
  hitrateOverkill.total = Math.round((nTripleOverkill.total / nOverkill.total) * 100 * 100) / 100;
  if (obj_hitrateOverkill.total.length != 0) sdOverkill.total = Math.round(ss.standardDeviation(obj_hitrateOverkill.total) * 100) / 100;
  obj_defrateOverkill.total = returnArr(mongoClans, weekStr, "overkill", "defrate", "total");
  defrateOverkill.total = Math.round((100 - (nDefTripleOverkill.total / nDefOverkill.total) * 100) * 100) / 100;
  if (obj_defrateOverkill.total.length != 0) sdDefOverkill.total = Math.round(ss.standardDeviation(obj_defrateOverkill.total) * 100) / 100;

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let keyLvTH = `th${iTH}`;

    obj_nOverkill[keyLvTH] = returnArr(mongoClans, weekStr, "overkill", "nAt", keyLvTH);
    nOverkill[keyLvTH] = ss.sum(obj_nOverkill[keyLvTH]);
    obj_nTripleOverkill[keyLvTH] = returnArr(mongoClans, weekStr, "overkill", "nTriple", keyLvTH);
    nTripleOverkill[keyLvTH] = ss.sum(obj_nTripleOverkill[keyLvTH]);
    obj_nDefOverkill[keyLvTH] = returnArr(mongoClans, weekStr, "overkill", "nDef", keyLvTH);
    nDefOverkill[keyLvTH] = ss.sum(obj_nDefOverkill[keyLvTH]);
    obj_nDefTripleOverkill[keyLvTH] = returnArr(mongoClans, weekStr, "overkill", "nDefTriple", keyLvTH);
    nDefTripleOverkill[keyLvTH] = ss.sum(obj_nDefTripleOverkill[keyLvTH]);

    obj_hitrateOverkill[keyLvTH] = returnArr(mongoClans, weekStr, "overkill", "hitrate", keyLvTH);
    hitrateOverkill[keyLvTH] = Math.round((nTripleOverkill[keyLvTH] / nOverkill[keyLvTH]) * 100 * 100) / 100;
    if (obj_hitrateOverkill[keyLvTH].length != 0) sdOverkill[keyLvTH] = Math.round(ss.standardDeviation(obj_hitrateOverkill[keyLvTH]) * 100) / 100;
    obj_defrateOverkill[keyLvTH] = returnArr(mongoClans, weekStr, "overkill", "defrate", keyLvTH);
    defrateOverkill[keyLvTH] = Math.round((100 - (nDefTripleOverkill[keyLvTH] / nDefOverkill[keyLvTH]) * 100) * 100) / 100;
    if (obj_defrateOverkill[keyLvTH].length != 0) sdDefOverkill[keyLvTH] = Math.round(ss.standardDeviation(obj_defrateOverkill[keyLvTH]) * 100) / 100;
  };

  overkill.nAt = nOverkill;
  overkill.nTriple = nTripleOverkill;
  overkill.nDef = nDefOverkill;
  overkill.nDefTriple = nDefTripleOverkill;

  overkill.hitrate = hitrateOverkill;
  overkill.sd = sdOverkill;
  overkill.defrate = defrateOverkill;
  overkill.sdDef = sdDefOverkill;
  // ********** overkill **********

  let statsLeagueWeek = {};
  const arr_destruction = returnArr(mongoClans, weekStr, "destruction", "", "");
  if (arr_destruction.length == 0) {
    return;
  };
  statsLeagueWeek.destruction = Math.round(ss.mean(arr_destruction) * 100) / 100;

  statsLeagueWeek.allAttackTypes = allAttackTypes;
  statsLeagueWeek.fresh = fresh;
  statsLeagueWeek.cleanup = cleanup;
  statsLeagueWeek.overkill = overkill;

  return statsLeagueWeek;
};


function returnArr(mongoClans, weekStr, term1, term2, term3) {
  let arr = mongoClans.map(function (mongoClan) {
    if (mongoClan.score !== null) {
      if (mongoClan.score[weekStr] !== undefined) {
        if (mongoClan.score[weekStr].clan[term1] !== undefined) {
          if (term2 == "") {
            return mongoClan.score[weekStr].clan[term1];
          }
          else {
            return mongoClan.score[weekStr].clan[term1][term2][term3];
          };
        };
      };
    };
  });
  arr = arr.filter((x) => { return x !== undefined && x === x }); // undefined, NaN を除去
  return arr;
};


async function updateScore(clientMongo, league, mongoClan) {
  const clanAbbr = mongoClan.clan_abbr;
  const query = { season: config.season[league], league: league, week: { $gt: 0 } };
  const options = {};
  const myColl = clientMongo.db("jwc").collection("wars");
  const cursor = myColl.find(query, options);
  let mongoWars = await cursor.toArray();
  await cursor.close();

  let scoreAll = {};

  let win = 0;
  let tie = 0;
  let loss = 0;

  let nWar = 0;
  let nWarF = 0; // includes forfeited war
  let nWin = 0;
  let nTie = 0;
  let nLoss = 0;
  let sumPoint = 0;
  let sumScoreClan = {};
  let sumScoreOpp = {};

  // regular season
  let nWarQ = 0;
  let nWarQF = 0; // includes forfeited war
  let nWinQ = 0;
  let nTieQ = 0;
  let nLossQ = 0;
  let sumPointQ = 0;
  let sumScoreClanQ = {};
  let sumScoreOppQ = {};

  // group stage for 5v
  let nWarGS = 0;
  let nWarGSf = 0; // includes forfeited war
  let nWinGS = 0;
  let nTieGS = 0;
  let nLossGS = 0;
  let sumPointGS = 0;
  let sumScoreClanGS = {};
  let sumScoreOppGS = {};

  await Promise.all(mongoWars.map(async (mongoWar) => {
    const week = mongoWar.week;
    const weekStr = `w${week}`;
    let point = 0;

    if (mongoWar.clan_abbr == clanAbbr || mongoWar.opponent_abbr == clanAbbr) {
      if (mongoWar.result) {
        if (mongoWar.result.state == "warEnded" || mongoWar.result.state == "forfeited") {
          if (mongoWar.clan_abbr == clanAbbr) {
            [point, win, tie, loss] = calcPoint(mongoWar, "clan", "opponent");
            /*
            if (league == "mix") {
              [point, win, tie, loss] = calcPointMix(mongoWar, "clan", "opponent");
            }
            else {
              [point, win, tie, loss] = calcPoint(mongoWar, "clan", "opponent");
            };
            */
          }
          else if (mongoWar.opponent_abbr == clanAbbr) {
            [point, win, tie, loss] = calcPoint(mongoWar, "opponent", "clan");
            /*
            if (league == "mix") {
              [point, win, tie, loss] = calcPointMix(mongoWar, "opponent", "clan");
            }
            else {
              [point, win, tie, loss] = calcPoint(mongoWar, "opponent", "clan");
            };
            */
          };

          // 合計・平均計算
          nWar += 1;
          nWin += win;
          nTie += tie;
          nLoss += loss;
          sumPoint += point;
          if (mongoWar.result.state != "forfeited") {
            nWarF += 1;
          };

          if (league == "j1" || league == "j2") {
            if (week <= config.weeksQ[league]) {
              nWarQ += 1;
              nWinQ += win;
              nTieQ += tie;
              nLossQ += loss;
              sumPointQ += point;
              if (mongoWar.result.state != "forfeited") {
                nWarQF += 1;
              };
            };
          }
          else if (league == "swiss" || league == "mix") {
            if (week <= config.weeksQ[league]) {
              nWarQ += 1;
              nWinQ += win;
              nTieQ += tie;
              nLossQ += loss;
              sumPointQ += point;
              if (mongoWar.result.state != "forfeited") {
                nWarQF += 1;
              };
            };
          }
          else if (league == "five") {
            if (week <= config.weeksQ[league]) {
              nWarQ += 1;
              nWinQ += win;
              nTieQ += tie;
              nLossQ += loss;
              sumPointQ += point;
              if (mongoWar.result.state != "forfeited") {
                nWarQF += 1;
              };
            }
            else if (config.weeksGS.start <= week && week <= config.weeksGS.end) {
              nWarGS += 1;
              nWinGS += win;
              nTieGS += tie;
              nLossGS += loss;
              sumPointGS += point;
              if (mongoWar.result.state != "forfeited") {
                nWarGSf += 1;
              };
            };
          };

          let scoreClan = {};
          let scoreOpp = {};

          if (mongoWar.result.state == "warEnded") {
            if (mongoWar.clan_abbr == clanAbbr) {
              scoreClan = mongoWar.result.clan;
              scoreOpp = mongoWar.result.opponent;
              scoreOpp.teamAbbr = mongoWar.opponent_abbr;
              sumScoreClan = await sumResult(sumScoreClan, mongoWar, "clan");
              sumScoreOpp = await sumResult(sumScoreOpp, mongoWar, "opponent");
              if (league == "j1" || league == "j2") {
                if (week <= config.weeksQ[league]) {
                  sumScoreClanQ = await sumResult(sumScoreClanQ, mongoWar, "clan");
                  sumScoreOppQ = await sumResult(sumScoreOppQ, mongoWar, "opponent");
                };
              }
              else if (league == "swiss" || league == "mix") {
                if (week <= config.weeksQ[league]) {
                  sumScoreClanQ = await sumResult(sumScoreClanQ, mongoWar, "clan");
                  sumScoreOppQ = await sumResult(sumScoreOppQ, mongoWar, "opponent");
                };
              }
              else if (league == "five") {
                if (week <= config.weeksQ[league]) {
                  sumScoreClanQ = await sumResult(sumScoreClanQ, mongoWar, "clan");
                  sumScoreOppQ = await sumResult(sumScoreOppQ, mongoWar, "opponent");
                }
                else if (config.weeksGS.start <= week && week <= config.weeksGS.end) {
                  sumScoreClanGS = await sumResult(sumScoreClanGS, mongoWar, "clan");
                  sumScoreOppGS = await sumResult(sumScoreOppGS, mongoWar, "opponent");
                };
              };
            }
            else if (mongoWar.opponent_abbr == clanAbbr) {
              scoreClan = mongoWar.result.opponent;
              scoreOpp = mongoWar.result.clan;
              scoreOpp.teamAbbr = mongoWar.clan_abbr;
              sumScoreClan = await sumResult(sumScoreClan, mongoWar, "opponent");
              sumScoreOpp = await sumResult(sumScoreOpp, mongoWar, "clan");
              if (league == "j1" || league == "j2") {
                if (week <= config.weeksQ[league]) {
                  sumScoreClanQ = await sumResult(sumScoreClanQ, mongoWar, "opponent");
                  sumScoreOppQ = await sumResult(sumScoreOppQ, mongoWar, "clan");
                };
              }
              else if (league == "swiss" || league == "mix") {
                if (week <= config.weeksQ[league]) {
                  sumScoreClanQ = await sumResult(sumScoreClanQ, mongoWar, "opponent");
                  sumScoreOppQ = await sumResult(sumScoreOppQ, mongoWar, "clan");
                };
              }
              else if (league == "five") {
                if (week <= config.weeksQ[league]) {
                  sumScoreClanQ = await sumResult(sumScoreClanQ, mongoWar, "opponent");
                  sumScoreOppQ = await sumResult(sumScoreOppQ, mongoWar, "clan");
                }
                else if (config.weeksGS.start <= week && week <= config.weeksGS.end) {
                  sumScoreClanGS = await sumResult(sumScoreClanGS, mongoWar, "opponent");
                  sumScoreOppGS = await sumResult(sumScoreOppGS, mongoWar, "clan");
                };
              };
            };
          }
          else if (mongoWar.result.state == "forfeited") {
            scoreClan = "N/A";
            scoreOpp = "N/A";
          };

          const scoreThisWar = {
            state: mongoWar.result.state,
            point: point,
            clan: scoreClan,
            opponent: scoreOpp,
          };

          scoreAll[weekStr] = scoreThisWar;
        }
      }
    }
  }));

  sumScoreClan.sumDestruction = (nWarF > 0) ? Math.round(sumScoreClan.sumDestruction * 100) / 100 : 0;
  sumScoreOpp.sumDestruction = (nWarF > 0) ? Math.round(sumScoreOpp.sumDestruction * 100) / 100 : 0;
  sumScoreClan.destruction = (nWarF > 0) ? Math.round(sumScoreClan.sumDestruction / nWarF * 100) / 100 : NaN;
  sumScoreOpp.destruction = (nWarF > 0) ? Math.round(sumScoreOpp.sumDestruction / nWarF * 100) / 100 : NaN;

  sumScoreClanQ.sumDestruction = (nWarQF > 0) ? Math.round(sumScoreClanQ.sumDestruction * 100) / 100 : 0;
  sumScoreOppQ.sumDestruction = (nWarQF > 0) ? Math.round(sumScoreOppQ.sumDestruction * 100) / 100 : 0;
  sumScoreClanQ.destruction = (nWarQF > 0) ? Math.round(sumScoreClanQ.sumDestruction / nWarQF * 100) / 100 : NaN;
  sumScoreOppQ.destruction = (nWarQF > 0) ? Math.round(sumScoreOppQ.sumDestruction / nWarQF * 100) / 100 : NaN;

  let starDifference = (nWarF > 0) ? sumScoreClan.sumStars - sumScoreOpp.sumStars : 0;
  let ptDefDifference = (nWarF > 0) ? sumScoreClan.sumPtDef - sumScoreOpp.sumPtDef : 0;
  let starPlusPtDefDifference = starDifference + ptDefDifference;

  let starDifferenceQ = (nWarQF > 0) ? sumScoreClanQ.sumStars - sumScoreOppQ.sumStars : 0;
  let ptDefDifferenceQ = (nWarQF > 0) ? sumScoreClanQ.sumPtDef - sumScoreOppQ.sumPtDef : 0;
  let starPlusPtDefDifferenceQ = starDifferenceQ + ptDefDifferenceQ;

  let starDifferenceGS = 0;

  if (league == "five") {
    sumScoreClanGS.sumDestruction = (nWarGSf > 0) ? Math.round(sumScoreClanGS.sumDestruction * 100) / 100 : 0;
    sumScoreOppGS.sumDestruction = (nWarGSf > 0) ? Math.round(sumScoreOppGS.sumDestruction * 100) / 100 : 0;
    sumScoreClanGS.destruction = (nWarGSf > 0) ? Math.round(sumScoreClanGS.sumDestruction / nWarGSf * 100) / 100 : NaN;
    sumScoreOppGS.destruction = (nWarGSf > 0) ? Math.round(sumScoreOppGS.sumDestruction / nWarGSf * 100) / 100 : NaN;

    starDifferenceGS = (nWarGSf > 0) ? sumScoreClanGS.sumStars - sumScoreOppGS.sumStars : 0;
  };

  if (mongoClan.score != null) {
    if (mongoClan.score.add != null) {
      sumPoint = sumPoint + mongoClan.score.add.point;
      nWin = nWin + mongoClan.score.add.nWin;
      scoreAll.add = mongoClan.score.add;
    };
    if (mongoClan.score.penalty != null) {
      starDifference = starDifference + mongoClan.score.penalty.star;
      starPlusPtDefDifference = starPlusPtDefDifference + mongoClan.score.penalty.star;
      starDifferenceQ = starDifferenceQ + mongoClan.score.penalty.star;
      starPlusPtDefDifferenceQ = starPlusPtDefDifferenceQ + mongoClan.score.penalty.star;
      scoreAll.penalty = mongoClan.score.penalty;
    };
  };

  const scoreSum = {
    nWar: nWar,
    nWin: nWin,
    nTie: nTie,
    nLoss: nLoss,
    point: sumPoint,
    starDifference: starDifference,
    ptDefDifference: ptDefDifference,
    starPlusPtDefDifference: starPlusPtDefDifference,
    clan: sumScoreClan,
    opponent: sumScoreOpp,
  };
  scoreAll.sum = scoreSum;

  const scoreSumQ = {
    nWar: nWarQ,
    nWin: nWinQ,
    nTie: nTieQ,
    nLoss: nLossQ,
    point: sumPointQ,
    starDifference: starDifferenceQ,
    starDifferenceAvg: Math.round(starDifferenceQ / nWarQ * 10) / 10,
    ptDefDifference: ptDefDifferenceQ,
    starPlusPtDefDifference: starPlusPtDefDifferenceQ,
    clan: sumScoreClanQ,
    opponent: sumScoreOppQ,
  };
  scoreAll.sumQ = scoreSumQ;

  if (league == "five") {
    const scoreSumGS = {
      nWar: nWarGS,
      nWin: nWinGS,
      nTie: nTieGS,
      nLoss: nLossGS,
      point: sumPointGS,
      starDifference: starDifferenceGS,
      starDifferenceAvg: Math.round(starDifferenceGS / nWarGS * 10) / 10,
      clan: sumScoreClanGS,
      opponent: sumScoreOppGS,
    };
    scoreAll.sumGS = scoreSumGS;
  };

  clientMongo.db("jwc").collection("clans").updateOne({ clan_abbr: mongoClan.clan_abbr }, { $set: { score: scoreAll } });
};
export { updateScore };


function calcPoint(mongoWar, myClan, myOpponent) {
  let point = 0;
  let nWin = 0;
  let nTie = 0;
  let nLoss = 0;
  if (mongoWar.result.state == "forfeited") {
    if (mongoWar.result[myClan] == "win") {
      point = 2;
      nWin = 1;
    }
    else {
      point = 0;
      nLoss = 1;
    };
  }
  else if (mongoWar.result[myClan].stars > mongoWar.result[myOpponent].stars) {
    point = 2;
    nWin = 1;
  }
  else if (mongoWar.result[myClan].stars < mongoWar.result[myOpponent].stars) {
    point = 0;
    nLoss = 1;
  }
  else {  // tie in stars
    if (mongoWar.result[myClan].destruction > mongoWar.result[myOpponent].destruction) {
      point = 2;
      nWin = 1;
    }
    else if (mongoWar.result[myClan].destruction < mongoWar.result[myOpponent].destruction) {
      point = 0;
      nLoss = 1;
    }
    else {  // tie in destruction
      if (mongoWar.result[myClan].overkill.nTriple.total > mongoWar.result[myOpponent].overkill.nTriple.total) {
        point = 2;
        nWin = 1;
      }
      else if (mongoWar.result[myClan].overkill.nTriple.total < mongoWar.result[myOpponent].overkill.nTriple.total) {
        point = 0;
        nLoss = 1;
      }
      else {  // tie in all
        point = 1;
        nTie = 1;
      };
    };
  };
  return [point, nWin, nTie, nLoss];
};


function calcPointMix(mongoWar, myClan, myOpponent) {
  let point = 0;
  let nWin = 0;
  let nTie = 0;
  let nLoss = 0;
  if (mongoWar.result.state == "forfeited") {
    if (mongoWar.result[myClan] == "win") {
      point = 2;
      nWin = 1;
    }
    else {
      point = 0;
      nLoss = 1;
    };
  }
  else if (mongoWar.result[myClan].stars + mongoWar.result[myClan].ptDefSum > mongoWar.result[myOpponent].stars + mongoWar.result[myOpponent].ptDefSum) {
    point = 2;
    nWin = 1;
  }
  else if (mongoWar.result[myClan].stars + mongoWar.result[myClan].ptDefSum < mongoWar.result[myOpponent].stars + mongoWar.result[myOpponent].ptDefSum) {
    point = 0;
    nLoss = 1;
  }
  else {  // tie
    if (mongoWar.result[myClan].destruction > mongoWar.result[myOpponent].destruction) {
      point = 2;
      nWin = 1;
    }
    else if (mongoWar.result[myClan].destruction < mongoWar.result[myOpponent].destruction) {
      point = 0;
      nLoss = 1;
    }
    else {  // tie
      point = 1;
      nTie = 1;
    };
  };
  return [point, nWin, nTie, nLoss];
};

/*
async function sumResult(scoreSum, mongoWar, myClan) {
  scoreSum.sumStars = mySum(scoreSum.sumStars, mongoWar.result[myClan].stars);
  scoreSum.sumDestruction = mySum(scoreSum.sumDestruction, mongoWar.result[myClan].destruction);
  scoreSum.sumPtDef = mySum(scoreSum.sumPtDef, mongoWar.result[myClan].ptDefSum);

  let nAt = {};
  let nTriple = {};
  let nDef = {};
  let nDefTriple = {};
  let hitrate = {};
  let defrate = {};

  if (!scoreSum.allAttackTypes) {
    nAt.total = 0;
    nTriple.total = 0;
    nDef.total = 0;
    nDefTriple.total = 0;
    hitrate.total = NaN;
    defrate.total = NaN;
    for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
      let keyLvTH = `th${iTH}`;
      nAt[keyLvTH] = 0;
      nTriple[keyLvTH] = 0;
      nDef[keyLvTH] = 0;
      nDefTriple[keyLvTH] = 0;
      hitrate[keyLvTH] = NaN;
      defrate[keyLvTH] = NaN;
    };
    scoreSum.allAttackTypes = { nAt: nAt, nTriple: nTriple, nDef: nDef, nDefTriple: nDefTriple, hitrate: hitrate, defrate: defrate };
  };

  nAt.total = mySum(scoreSum.allAttackTypes.nAt.total, mongoWar.result[myClan].allAttackTypes.nAt.total);
  nTriple.total = mySum(scoreSum.allAttackTypes.nTriple.total, mongoWar.result[myClan].allAttackTypes.nTriple.total);
  nDef.total = mySum(scoreSum.allAttackTypes.nDef.total, mongoWar.result[myClan].allAttackTypes.nDef.total);
  nDefTriple.total = mySum(scoreSum.allAttackTypes.nDefTriple.total, mongoWar.result[myClan].allAttackTypes.nDefTriple.total);
  hitrate.total = Math.round(nTriple.total / nAt.total * 100 * 100) / 100;
  defrate.total = 100 - Math.round(nDefTriple.total / nDef.total * 100 * 100) / 100;

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let keyLvTH = `th${iTH}`;
    nAt[keyLvTH] = mySum(scoreSum.allAttackTypes.nAt[keyLvTH], mongoWar.result[myClan].allAttackTypes.nAt[keyLvTH]);
    nTriple[keyLvTH] = mySum(scoreSum.allAttackTypes.nTriple[keyLvTH], mongoWar.result[myClan].allAttackTypes.nTriple[keyLvTH]);
    nDef[keyLvTH] = mySum(scoreSum.allAttackTypes.nDef[keyLvTH], mongoWar.result[myClan].allAttackTypes.nDef[keyLvTH]);
    nDefTriple[keyLvTH] = mySum(scoreSum.allAttackTypes.nDefTriple[keyLvTH], mongoWar.result[myClan].allAttackTypes.nDefTriple[keyLvTH]);
    hitrate[keyLvTH] = Math.round(scoreSum.allAttackTypes.nTriple[keyLvTH] / scoreSum.allAttackTypes.nAt[keyLvTH] * 100 * 100) / 100;
    defrate[keyLvTH] = 100 - Math.round(scoreSum.allAttackTypes.nDefTriple[keyLvTH] / scoreSum.allAttackTypes.nDef[keyLvTH] * 100 * 100) / 100;
  };

  scoreSum.allAttackTypes = { nAt: nAt, nTriple: nTriple, nDef: nDef, nDefTriple: nDefTriple, hitrate: hitrate, defrate: defrate };

  let nAt = {};
  let nTriple = {};
  let nDef = {};
  let nDefTriple = {};
  let hitrate = {};
  let defrate = {};

  if (!scoreSum.fresh) {
    nAt.total = 0;
    nTriple.total = 0;
    nDef.total = 0;
    nDefTriple.total = 0;
    hitrate.total = NaN;
    defrate.total = NaN;
    for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
      let keyLvTH = `th${iTH}`;
      nAt[keyLvTH] = 0;
      nTriple[keyLvTH] = 0;
      nDef[keyLvTH] = 0;
      nDefTriple[keyLvTH] = 0;
      hitrate[keyLvTH] = NaN;
      defrate[keyLvTH] = NaN;
    };
    scoreSum.fresh = { nAt: nAt, nTriple: nTriple, nDef: nDef, nDefTriple: nDefTriple, hitrate: hitrate, defrate: defrate };
  };

  nAt.total = mySum(scoreSum.fresh.nAt.total, mongoWar.result[myClan].fresh.nAt.total);
  nTriple.total = mySum(scoreSum.fresh.nTriple.total, mongoWar.result[myClan].fresh.nTriple.total);
  nDef.total = mySum(scoreSum.fresh.nDef.total, mongoWar.result[myClan].fresh.nDef.total);
  nDefTriple.total = mySum(scoreSum.fresh.nDefTriple.total, mongoWar.result[myClan].fresh.nDefTriple.total);
  hitrate.total = Math.round(nTriple.total / nAt.total * 100 * 100) / 100;
  defrate.total = 100 - Math.round(nDefTriple.total / nDef.total * 100 * 100) / 100;

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let keyLvTH = `th${iTH}`;
    nAt[keyLvTH] = mySum(scoreSum.fresh.nAt[keyLvTH], mongoWar.result[myClan].fresh.nAt[keyLvTH]);
    nTriple[keyLvTH] = mySum(scoreSum.fresh.nTriple[keyLvTH], mongoWar.result[myClan].fresh.nTriple[keyLvTH]);
    nDef[keyLvTH] = mySum(scoreSum.fresh.nDef[keyLvTH], mongoWar.result[myClan].fresh.nDef[keyLvTH]);
    nDefTriple[keyLvTH] = mySum(scoreSum.fresh.nDefTriple[keyLvTH], mongoWar.result[myClan].fresh.nDefTriple[keyLvTH]);
    hitrate[keyLvTH] = Math.round(scoreSum.fresh.nTriple[keyLvTH] / scoreSum.fresh.nAt[keyLvTH] * 100 * 100) / 100;
    defrate[keyLvTH] = 100 - Math.round(scoreSum.fresh.nDefTriple[keyLvTH] / scoreSum.fresh.nDef[keyLvTH] * 100 * 100) / 100;
  };

  scoreSum.fresh = { nAt: nAt, nTriple: nTriple, nDef: nDef, nDefTriple: nDefTriple, hitrate: hitrate, defrate: defrate };

  let nAt = {};
  let nTriple = {};
  let nDef = {};
  let nDefTriple = {};
  let hitrate = {};
  let defrate = {};

  if (!scoreSum.cleanup) {
    nAt.total = 0;
    nTriple.total = 0;
    nDef.total = 0;
    nDefTriple.total = 0;
    hitrate.total = NaN;
    defrate.total = NaN;
    for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
      let keyLvTH = `th${iTH}`;
      nAt[keyLvTH] = 0;
      nTriple[keyLvTH] = 0;
      nDef[keyLvTH] = 0;
      nDefTriple[keyLvTH] = 0;
      hitrate[keyLvTH] = NaN;
      defrate[keyLvTH] = NaN;
    };
    scoreSum.cleanup = { nAt: nAt, nTriple: nTriple, nDef: nDef, nDefTriple: nDefTriple, hitrate: hitrate, defrate: defrate };
  };

  nAt.total = mySum(scoreSum.cleanup.nAt.total, mongoWar.result[myClan].cleanup.nAt.total);
  nTriple.total = mySum(scoreSum.cleanup.nTriple.total, mongoWar.result[myClan].cleanup.nTriple.total);
  nDef.total = mySum(scoreSum.cleanup.nDef.total, mongoWar.result[myClan].cleanup.nDef.total);
  nDefTriple.total = mySum(scoreSum.cleanup.nDefTriple.total, mongoWar.result[myClan].cleanup.nDefTriple.total);
  hitrate.total = Math.round(nTriple.total / nAt.total * 100 * 100) / 100;
  defrate.total = 100 - Math.round(nDefTriple.total / nDef.total * 100 * 100) / 100;

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let keyLvTH = `th${iTH}`;
    nAt[keyLvTH] = mySum(scoreSum.cleanup.nAt[keyLvTH], mongoWar.result[myClan].cleanup.nAt[keyLvTH]);
    nTriple[keyLvTH] = mySum(scoreSum.cleanup.nTriple[keyLvTH], mongoWar.result[myClan].cleanup.nTriple[keyLvTH]);
    nDef[keyLvTH] = mySum(scoreSum.cleanup.nDef[keyLvTH], mongoWar.result[myClan].cleanup.nDef[keyLvTH]);
    nDefTriple[keyLvTH] = mySum(scoreSum.cleanup.nDefTriple[keyLvTH], mongoWar.result[myClan].cleanup.nDefTriple[keyLvTH]);
    hitrate[keyLvTH] = Math.round(scoreSum.cleanup.nTriple[keyLvTH] / scoreSum.cleanup.nAt[keyLvTH] * 100 * 100) / 100;
    defrate[keyLvTH] = 100 - Math.round(scoreSum.cleanup.nDefTriple[keyLvTH] / scoreSum.cleanup.nDef[keyLvTH] * 100 * 100) / 100;
  };

  scoreSum.cleanup = { nAt: nAt, nTriple: nTriple, nDef: nDef, nDefTriple: nDefTriple, hitrate: hitrate, defrate: defrate };

  let nAt = {};
  let nTriple = {};
  let nDef = {};
  let nDefTriple = {};
  let hitrate = {};
  let defrate = {};

  if (!scoreSum.overkill) {
    nAt.total = 0;
    nTriple.total = 0;
    nDef.total = 0;
    nDefTriple.total = 0;
    hitrate.total = NaN;
    defrate.total = NaN;
    for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
      let keyLvTH = `th${iTH}`;
      nAt[keyLvTH] = 0;
      nTriple[keyLvTH] = 0;
      nDef[keyLvTH] = 0;
      nDefTriple[keyLvTH] = 0;
      hitrate[keyLvTH] = NaN;
      defrate[keyLvTH] = NaN;
    };
    scoreSum.overkill = { nAt: nAt, nTriple: nTriple, nDef: nDef, nDefTriple: nDefTriple, hitrate: hitrate, defrate: defrate };
  };

  nAt.total = mySum(scoreSum.overkill.nAt.total, mongoWar.result[myClan].overkill.nAt.total);
  nTriple.total = mySum(scoreSum.overkill.nTriple.total, mongoWar.result[myClan].overkill.nTriple.total);
  nDef.total = mySum(scoreSum.overkill.nDef.total, mongoWar.result[myClan].overkill.nDef.total);
  nDefTriple.total = mySum(scoreSum.overkill.nDefTriple.total, mongoWar.result[myClan].overkill.nDefTriple.total);
  hitrate.total = Math.round(nTriple.total / nAt.total * 100 * 100) / 100;
  defrate.total = 100 - Math.round(nDefTriple.total / nDef.total * 100 * 100) / 100;

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let keyLvTH = `th${iTH}`;
    nAt[keyLvTH] = mySum(scoreSum.overkill.nAt[keyLvTH], mongoWar.result[myClan].overkill.nAt[keyLvTH]);
    nTriple[keyLvTH] = mySum(scoreSum.overkill.nTriple[keyLvTH], mongoWar.result[myClan].overkill.nTriple[keyLvTH]);
    nDef[keyLvTH] = mySum(scoreSum.overkill.nDef[keyLvTH], mongoWar.result[myClan].overkill.nDef[keyLvTH]);
    nDefTriple[keyLvTH] = mySum(scoreSum.overkill.nDefTriple[keyLvTH], mongoWar.result[myClan].overkill.nDefTriple[keyLvTH]);
    hitrate[keyLvTH] = Math.round(nTriple[keyLvTH] / nAt[keyLvTH] * 100 * 100) / 100;
    defrate[keyLvTH] = 100 - Math.round(nDefTriple[keyLvTH] / nDef[keyLvTH] * 100 * 100) / 100;
  };

  scoreSum.overkill = { nAt: nAt, nTriple: nTriple, nDef: nDef, nDefTriple: nDefTriple, hitrate: hitrate, defrate: defrate };

  return scoreSum;
};
*/

async function sumResult(scoreSum, mongoWar, myClan) {
  const warResult = mongoWar.result[myClan];

  scoreSum.sumStars = mySum(scoreSum.sumStars, warResult.stars);
  scoreSum.sumDestruction = mySum(scoreSum.sumDestruction, warResult.destruction);
  scoreSum.sumPtDef = mySum(scoreSum.sumPtDef, warResult.ptDefSum);

  const attackTypes = ["allAttackTypes", "fresh", "cleanup", "overkill"];

  for (const attackType of attackTypes) {
    scoreSum[attackType] = sumAttackTypeResults(scoreSum[attackType], warResult[attackType]);
  };

  return scoreSum;
};

function sumAttackTypeResults(scoreSumAttackType, warResultAttackType) {
  let numberOfAttacks = {};
  let numberOfTripleStars = {};
  let numberOfDefenses = {};
  let numberOfTripleDefenses = {};
  let hitRate = {};
  let defenseRate = {};

  if (!scoreSumAttackType) {
    numberOfAttacks.total = 0;
    numberOfTripleStars.total = 0;
    numberOfDefenses.total = 0;
    numberOfTripleDefenses.total = 0;
    hitRate.total = NaN;
    defenseRate.total = NaN;

    for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
      const keyLvTH = `th${iTH}`;
      numberOfAttacks[keyLvTH] = 0;
      numberOfTripleStars[keyLvTH] = 0;
      numberOfDefenses[keyLvTH] = 0;
      numberOfTripleDefenses[keyLvTH] = 0;
      hitRate[keyLvTH] = NaN;
      defenseRate[keyLvTH] = NaN;
    }

    scoreSumAttackType = {
      nAt: numberOfAttacks,
      nTriple: numberOfTripleStars,
      nDef: numberOfDefenses,
      nDefTriple: numberOfTripleDefenses,
      hitrate: hitRate,
      defrate: defenseRate,
    };
  };

  numberOfAttacks.total = mySum(scoreSumAttackType.nAt.total, warResultAttackType.nAt.total);
  numberOfTripleStars.total = mySum(scoreSumAttackType.nTriple.total, warResultAttackType.nTriple.total);
  numberOfDefenses.total = mySum(scoreSumAttackType.nDef.total, warResultAttackType.nDef.total);
  numberOfTripleDefenses.total = mySum(scoreSumAttackType.nDefTriple.total, warResultAttackType.nDefTriple.total);
  hitRate.total = calculateHitrate(numberOfTripleStars.total, numberOfAttacks.total);
  defenseRate.total = 100 - calculateHitrate(numberOfTripleDefenses.total, numberOfDefenses.total);

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    const keyLvTH = `th${iTH}`;
    numberOfAttacks[keyLvTH] = mySum(scoreSumAttackType.nAt[keyLvTH], warResultAttackType.nAt[keyLvTH]);
    numberOfTripleStars[keyLvTH] = mySum(scoreSumAttackType.nTriple[keyLvTH], warResultAttackType.nTriple[keyLvTH]);
    numberOfDefenses[keyLvTH] = mySum(scoreSumAttackType.nDef[keyLvTH], warResultAttackType.nDef[keyLvTH]);
    numberOfTripleDefenses[keyLvTH] = mySum(scoreSumAttackType.nDefTriple[keyLvTH], warResultAttackType.nDefTriple[keyLvTH]);
    hitRate[keyLvTH] = calculateHitrate(numberOfTripleStars[keyLvTH], numberOfAttacks[keyLvTH]);
    defenseRate[keyLvTH] = 100 - calculateHitrate(numberOfTripleDefenses[keyLvTH], numberOfDefenses[keyLvTH]);
  };

  return {
    nAt: numberOfAttacks,
    nTriple: numberOfTripleStars,
    nDef: numberOfDefenses,
    nDefTriple: numberOfTripleDefenses,
    hitrate: hitRate,
    defrate: defenseRate,
  };
};

function calculateHitrate(numerator, denominator) {
  const PRECISION_FACTOR = 10000;
  if (denominator === 0) {
    return NaN;
  };
  const hitrate = Math.round((numerator / denominator) * PRECISION_FACTOR) / 100;
  return hitrate;
};


function mySum(valueBefore, plusValue) {
  if (valueBefore == null || isNaN(valueBefore)) {
    if (plusValue == null || isNaN(plusValue)) {
      return 0;
    }
    else {
      return plusValue;
    };
  }
  else {
    if (plusValue == null || isNaN(plusValue)) {
      return valueBefore;
    }
    else {
      return valueBefore + plusValue;
    };
  };
};


async function updateScoreAccs(clientMongo, season, league, week, members, membersOpp) {
  if (!members) {
    return;
  }

  // ********** attacks **********
  let playerTags = [];
  await Promise.all(members.map(async (member, index) => {
    let playerTag = member.tag;
    playerTags[index] = playerTag;
    let mongoAcc = await clientMongo.db("jwc").collection("accounts").findOne({ tag: playerTag });
    if (mongoAcc != null) {
      let attacks = mongoAcc.attacks;
      let numAtBefore = attacks ? attacks.length : 0;
      let attacksNew = [];
      if (member.attacks == null) {
        attacksNew[0] = {};
        attacksNew[0].attackType = "remaining";
        attacksNew[0].season = season;
        attacksNew[0].league = league;
        attacksNew[0].week = week;
        attacksNew[0].attackNo = 1;
      }
      else {
        if (member.attacks[0] === undefined) {
          attacksNew[0] = {};
          attacksNew[0].attackType = "remaining";
          attacksNew[0].season = season;
          attacksNew[0].league = league;
          attacksNew[0].week = week;
          attacksNew[0].attackNo = 1;
        }
        else if (member.attacks.length > 0) {
          attacksNew[0] = member.attacks[0];
          attacksNew[0].season = season;
          attacksNew[0].league = league;
          attacksNew[0].week = week;
          attacksNew[0].attackNo = 1;
        };
      };
      if (league != "swiss") {
        if (member.attacks == null) {
          attacksNew[1] = {};
          attacksNew[1].attackType = "remaining";
          attacksNew[1].season = season;
          attacksNew[1].league = league;
          attacksNew[1].week = week;
          attacksNew[1].attackNo = 2;
        }
        else {
          if (member.attacks[1] === undefined) {
            attacksNew[1] = {};
            attacksNew[1].attackType = "remaining";
            attacksNew[1].season = season;
            attacksNew[1].league = league;
            attacksNew[1].week = week;
            attacksNew[1].attackNo = 2;
          }
          else {
            attacksNew[1] = member.attacks[1];
            attacksNew[1].season = season;
            attacksNew[1].league = league;
            attacksNew[1].week = week;
            attacksNew[1].attackNo = 2;
          };
        };
      };
      if (attacks == null) {
        attacks = [];
        attacks.push(attacksNew[0]);
        if (league != "swiss") {
          attacks.push(attacksNew[1]);
        };
      };
      if (attacks.length > 0) {
        let checkDuplication = attacks.some(attack => attack.season === attacksNew[0].season && attack.league === attacksNew[0].league && attack.week === attacksNew[0].week);
        if (!checkDuplication) { // 重複なし　→　追加登録
          attacks.push(attacksNew[0]);
          if (league != "swiss") {
            attacks.push(attacksNew[1]);
          };
        }
        else { // 重複あり　→　編集
          attacks.forEach((attack, index) => {
            if (attack.season === attacksNew[0].season && attack.league === attacksNew[0].league && attack.week === attacksNew[0].week && playerTag === attacksNew[0].attackerTag && attack.attackNo === attacksNew[0].attackNo && attack.attackType !== attacksNew[0].attackType) {
              attacks[index] = attacksNew[0];
              console.dir(attacksNew[0]);
            };
            if (league != "swiss") {
              if (attack.season === attacksNew[1].season && attack.league === attacksNew[1].league && attack.week === attacksNew[1].week && playerTag === attacksNew[1].attackerTag && attack.attackNo === attacksNew[1].attackNo && attack.attackType !== attacksNew[1].attackType) {
                attacks[index] = attacksNew[1];
                console.dir(attacksNew[1]);
              };
            };
          });
        };
      };
      let listing = {};
      listing.attacks = attacks;
      const mongo = await clientMongo.db("jwc").collection("accounts").updateOne({ tag: playerTag }, { $set: listing });
      //if (mongo.modifiedCount > 0) {
      //  console.log(member.name);
      //};
    };
  }));
  // ********** attacks **********

  // ********** defenses **********
  let arrDefensesNew = [];
  await Promise.all(membersOpp.map(async (memberOpp, index) => {
    if (memberOpp.attacks == null) {
      ;
    }
    else if (memberOpp.attacks[0] === undefined) {
      ;
    }
    else if (memberOpp.attacks.length > 0) {
      let defenseNew = memberOpp.attacks[0];
      defenseNew.season = season;
      defenseNew.league = league;
      defenseNew.week = week;
      arrDefensesNew.push(defenseNew);
    };
    if (league != "swiss") {
      if (memberOpp.attacks == null) {
        ;
      }
      else if (memberOpp.attacks[1] === undefined) {
        ;
      }
      else {
        let defenseNew = memberOpp.attacks[1];
        defenseNew.season = season;
        defenseNew.league = league;
        defenseNew.week = week;
        arrDefensesNew.push(defenseNew);
      }
    };
  }));

  arrDefensesNew.sort((a, b) => a.order - b.order);

  let defensesPlayer = [];
  await Promise.all(playerTags.map(async (playerTag, index) => {
    let mongoAcc = await clientMongo.db("jwc").collection("accounts").findOne(
      { tag: playerTag },
      { projection: { attacks: 1, _id: 0 } }
    );
    if (mongoAcc == null) {
      defensesPlayer[index] = [];
    }
    else {
      defensesPlayer[index] = mongoAcc.defenses;
      if (defensesPlayer[index] == null) defensesPlayer[index] = [];
    };
  }));

  await Promise.all(arrDefensesNew.map(async (defenseNew) => {
    let playerTagDef = defenseNew.defenderTag;
    let noPlayer = -1;
    playerTags.forEach((tag, index) => {
      if (tag == playerTagDef) {
        if (defensesPlayer[index].length > 0) { // 追加登録：重複チェックしてから
          let checkDuplication = defensesPlayer[index].some(defense => defense.season === defenseNew.season && defense.league === defenseNew.league && defense.week === defenseNew.week && defense.order === defenseNew.order);
          if (!checkDuplication) {
            defensesPlayer[index].push(defenseNew);
          };
        }
        else { // 新規登録
          defensesPlayer[index].push(defenseNew);
        };
      };
    });
  }));

  let defensesAll = [];
  await Promise.all(defensesPlayer.map(async (defenses) => {
    if (defenses.length > 0) {
      defensesAll.push(defenses);
    };
  }));

  await Promise.all(defensesAll.map(async (defenses, index) => {
    let playerTagDef = defenses[0].defenderTag;
    let listing = {};
    listing.defenses = defenses;
    const mongo = await clientMongo.db("jwc").collection("accounts").updateOne({ tag: playerTagDef }, { $set: listing });
  }));
  // ********** defenses **********

  return;
};
export { updateScoreAccs };


async function calcStatsAccs(clientMongo, league, clanAbbr, season) {
  const query = { [`homeClanAbbr.${config.leagueM[league]}`]: clanAbbr };
  const projection = { tag: 1, attacks: 1, defenses: 1, stats: 1 };
  const options = { projection: projection };
  const cursor = clientMongo.db("jwc").collection("accounts").find(query, options);
  let mongoAccs = await cursor.toArray();
  await cursor.close();

  await Promise.all(mongoAccs.map(async (mongoAcc) => {
    let attacks = {};
    let total = [0, 0, 0, 0]; // nAttacks, nTriples, sumDestruction, sumDuration
    let fresh = [0, 0, 0, 0];
    let cleanup = [0, 0, 0, 0];
    let overkill = [0, 0, 0, 0];
    let attacks2 = {}; // only regular season
    let total2 = [0, 0, 0, 0];
    let fresh2 = [0, 0, 0, 0];
    let cleanup2 = [0, 0, 0, 0];
    let overkill2 = [0, 0, 0, 0];
    let weeksQ = config.weeksQ[league];

    if (mongoAcc.attacks != null) {
      mongoAcc.attacks.forEach((attack) => {
        if (attack.league == league && Number(attack.season) === Number(season) && attack.week >= 1) {
          if (attack.attackType == "fresh") {
            fresh[0] += 1;
            if (attack.stars == 3) {
              fresh[1] += 1;
              fresh[3] += attack.duration;
            };
            fresh[2] += attack.destruction;
          }
          else if (attack.attackType == "cleanup") {
            cleanup[0] += 1;
            if (attack.stars == 3) {
              cleanup[1] += 1;
              cleanup[3] += attack.duration;
            };
            cleanup[2] += attack.destruction;
          }
          else if (attack.attackType == "overkill") {
            overkill[0] += 1;
            if (attack.stars == 3) {
              overkill[1] += 1;
              overkill[3] += attack.duration;
            };
            overkill[2] += attack.destruction;
          };
          total[0] = fresh[0] + cleanup[0] + overkill[0];
          total[1] = fresh[1] + cleanup[1] + overkill[1];
          total[2] = fresh[2] + cleanup[2] + overkill[2];
          total[3] = fresh[3] + cleanup[3] + overkill[3];

          if (attack.week <= weeksQ) {
            fresh2[0] = fresh[0];
            fresh2[1] = fresh[1];
            fresh2[2] = fresh[2];
            fresh2[3] = fresh[3];
            cleanup2[0] = cleanup[0];
            cleanup2[1] = cleanup[1];
            cleanup2[2] = cleanup[2];
            cleanup2[3] = cleanup[3];
            overkill2[0] = overkill[0];
            overkill2[1] = overkill[1];
            overkill2[2] = overkill[2];
            overkill2[3] = overkill[3];
            total2[0] = total[0];
            total2[1] = total[1];
            total2[2] = total[2];
            total2[3] = total[3];
          };
        };
      });

      let objTotal = {};
      objTotal.nAttacks = total[0];
      objTotal.nTriples = total[1];
      objTotal.rate = Math.round(total[1] / total[0] * 1000) / 10;
      objTotal.avrgDestruction = Math.round(total[2] / total[0] * 10) / 10;
      objTotal.avrgLeft = Math.round(180 - Math.round(total[3] / total[1] * 10) / 10);

      let objFresh = {};
      objFresh.nAttacks = fresh[0];
      objFresh.nTriples = fresh[1];
      objFresh.rate = Math.round(fresh[1] / fresh[0] * 1000) / 10;
      objFresh.avrgDestruction = Math.round(fresh[2] / fresh[0] * 10) / 10;
      objFresh.avrgLeft = Math.round(180 - Math.round(fresh[3] / fresh[1] * 10) / 10);

      let objCleanup = {};
      objCleanup.nAttacks = cleanup[0];
      objCleanup.nTriples = cleanup[1];
      objCleanup.rate = Math.round(cleanup[1] / cleanup[0] * 1000) / 10;
      objCleanup.avrgDestruction = Math.round(cleanup[2] / cleanup[0] * 10) / 10;
      objCleanup.avrgLeft = Math.round(180 - Math.round(cleanup[3] / cleanup[1] * 10) / 10);

      let objOverkill = {};
      objOverkill.nAttacks = overkill[0];
      objOverkill.nTriples = overkill[1];
      objOverkill.rate = Math.round(overkill[1] / overkill[0] * 1000) / 10;
      objOverkill.avrgDestruction = Math.round(overkill[2] / overkill[0] * 10) / 10;
      objOverkill.avrgLeft = Math.round(180 - Math.round(overkill[3] / overkill[1] * 10) / 10);

      attacks.total = objTotal;
      attacks.fresh = objFresh;
      attacks.cleanup = objCleanup;
      attacks.overkill = objOverkill;

      let objTotal2 = {};
      objTotal2.nAttacks = total2[0];
      objTotal2.nTriples = total2[1];
      objTotal2.rate = Math.round(total2[1] / total2[0] * 1000) / 10;
      objTotal2.avrgDestruction = Math.round(total2[2] / total2[0] * 10) / 10;
      objTotal2.avrgLeft = Math.round(180 - Math.round(total2[3] / total2[1] * 10) / 10);

      let objFresh2 = {};
      objFresh2.nAttacks = fresh2[0];
      objFresh2.nTriples = fresh2[1];
      objFresh2.rate = Math.round(fresh2[1] / fresh2[0] * 1000) / 10;
      objFresh2.avrgDestruction = Math.round(fresh2[2] / fresh2[0] * 10) / 10;
      objFresh2.avrgLeft = Math.round(180 - Math.round(fresh2[3] / fresh2[1] * 10) / 10);

      let objCleanup2 = {};
      objCleanup2.nAttacks = cleanup2[0];
      objCleanup2.nTriples = cleanup2[1];
      objCleanup2.rate = Math.round(cleanup2[1] / cleanup2[0] * 1000) / 10;
      objCleanup2.avrgDestruction = Math.round(cleanup2[2] / cleanup2[0] * 10) / 10;
      objCleanup2.avrgLeft = Math.round(180 - Math.round(cleanup2[3] / cleanup2[1] * 10) / 10);

      let objOverkill2 = {};
      objOverkill2.nAttacks = overkill2[0];
      objOverkill2.nTriples = overkill2[1];
      objOverkill2.rate = Math.round(overkill2[1] / overkill2[0] * 1000) / 10;
      objOverkill2.avrgDestruction = Math.round(overkill2[2] / overkill2[0] * 10) / 10;
      objOverkill2.avrgLeft = Math.round(180 - Math.round(overkill2[3] / overkill2[1] * 10) / 10);

      attacks2.total = objTotal2;
      attacks2.fresh = objFresh2;
      attacks2.cleanup = objCleanup2;
      attacks2.overkill = objOverkill2;
    }
    else {
      attacks = "no attack";
    };

    let defenses = {};
    total = [0, 0, 0, 0]; // nDefenses, nTriples, sumDestruction, sumDuration
    fresh = [0, 0, 0, 0];
    cleanup = [0, 0, 0, 0];
    overkill = [0, 0, 0, 0];
    if (mongoAcc.defenses != null) {
      mongoAcc.defenses.forEach((defense) => {
        if (defense.league == league && defense.season == season && defense.week >= 1) {
          if (defense.attackType == "fresh") {
            fresh[0] += 1;
            if (defense.stars == 3) {
              fresh[1] += 1;
              fresh[3] += defense.duration;
            };
            fresh[2] += defense.destruction;
          }
          else if (defense.attackType == "cleanup") {
            cleanup[0] += 1;
            if (defense.stars == 3) {
              cleanup[1] += 1;
              cleanup[3] += defense.duration;
            };
            cleanup[2] += defense.destruction;
          }
          else if (defense.attackType == "overkill") {
            overkill[0] += 1;
            if (defense.stars == 3) {
              overkill[1] += 1;
              overkill[3] += defense.duration;
            };
            overkill[2] += defense.destruction;
          };
          total[0] = fresh[0] + cleanup[0] + overkill[0];
          total[1] = fresh[1] + cleanup[1] + overkill[1];
          total[2] = fresh[2] + cleanup[2] + overkill[2];
          total[3] = fresh[3] + cleanup[3] + overkill[3];
        };
      });

      let objTotal = {};
      objTotal.nDefenses = total[0];
      objTotal.nSucDefenses = total[0] - total[1];
      objTotal.rate = Math.round((total[0] - total[1]) / total[0] * 1000) / 10;
      objTotal.avrgDestruction = Math.round(total[2] / total[0] * 10) / 10;
      objTotal.avrgLeft = Math.round(180 - Math.round(total[3] / total[1] * 10) / 10);

      let objFresh = {};
      objFresh.nDefenses = fresh[0];
      objFresh.nSucDefenses = fresh[0] - fresh[1];
      objFresh.rate = Math.round((fresh[0] - fresh[1]) / fresh[0] * 1000) / 10;
      objFresh.avrgDestruction = Math.round(fresh[2] / fresh[0] * 10) / 10;
      objFresh.avrgLeft = Math.round(180 - Math.round(fresh[3] / fresh[1] * 10) / 10);

      let objCleanup = {};
      objCleanup.nDefenses = cleanup[0];
      objCleanup.nSucDefenses = cleanup[0] - cleanup[1];
      objCleanup.rate = Math.round((cleanup[0] - cleanup[1]) / cleanup[0] * 1000) / 10;
      objCleanup.avrgDestruction = Math.round(cleanup[2] / cleanup[0] * 10) / 10;
      objCleanup.avrgLeft = Math.round(180 - Math.round(cleanup[3] / cleanup[1] * 10) / 10);

      let objOverkill = {};
      objOverkill.nDefenses = overkill[0];
      objOverkill.nSucDefenses = overkill[0] - overkill[1];
      objOverkill.rate = Math.round((overkill[0] - overkill[1]) / overkill[0] * 1000) / 10;
      objOverkill.avrgDestruction = Math.round(overkill[2] / overkill[0] * 10) / 10;
      objOverkill.avrgLeft = Math.round(180 - Math.round(overkill[3] / overkill[1] * 10) / 10);

      defenses.total = objTotal;
      defenses.fresh = objFresh;
      defenses.cleanup = objCleanup;
      defenses.overkill = objOverkill;
    }
    else {
      defenses = "no defense";
    };

    let stats = {};
    if (mongoAcc.stats == null) {
      stats = { j1: "", j2: "", swiss: "", mix: "", five: "" };
    }
    else {
      stats = mongoAcc.stats;
    };
    stats[league] = {};
    stats[league].attacks = attacks;
    stats[league].attacks2 = attacks2;
    stats[league].defenses = defenses;
    stats[league].season = season;

    let listing = {};
    listing.stats = stats;

    await clientMongo.db("jwc").collection("accounts")
      .updateOne({ tag: mongoAcc.tag }, { $set: listing });
  }));
};
export { calcStatsAccs };