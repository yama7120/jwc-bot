// 'node test.js' to run in Shell

const fCreateJSON = require("./functions/fCreateJSON.js");
const fRanking = require("./functions/fRanking.js");
const fMongo = require("./functions/fMongo.js");
//const index = require('./index.js');
const config = require("./config.js");
const fGetWars = require("./functions/fGetWars.js");
const fScore = require("./functions/fScore.js");
const functions = require("./functions/functions.js");
const post = require("./functions/post.js");

const { MongoClient, ServerApiVersion } = require("mongodb");
const clientMongo = new MongoClient(process.env.mongoURI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//const fetch = require('node-fetch');
const ss = require("simple-statistics");

const fetch = require("@replit/node-fetch");

(async () => {
  console.log(functions.plusTime("start"));

  await fixLegendEventActions(clientMongo);

  /*
  await fMongo.createFireballTable(clientMongo, (thLevel = 17));
  await fMongo.createFireballTable(clientMongo, (thLevel = 16));
  await fMongo.createFireballTable(clientMongo, (thLevel = 15));
  await fMongo.createFireballTable(clientMongo, (thLevel = 14));
  await fMongo.createFireballTable(clientMongo, (thLevel = 13));
  await fMongo.createFireballTable(clientMongo, (thLevel = 12));
  await fMongo.createZapQuakeTable(clientMongo, (thLevel = 17));
  await fMongo.createZapQuakeTable(clientMongo, (thLevel = 16));
  await fMongo.createZapQuakeTable(clientMongo, (thLevel = 15));
  await fMongo.createZapQuakeTable(clientMongo, (thLevel = 14));
  await fMongo.createZapQuakeTable(clientMongo, (thLevel = 13));
  await fMongo.createZapQuakeTable(clientMongo, (thLevel = 12));
  */

  //await fRanking.rankingLegend(clientMongo, nameItem = 'previous', nameRanking = 'legendPreviousSeason', key = 'legend.previous.trophies');

  //await checkDuplicate(clientMongo);
  //await updateLegendLogSettings(clientMongo);
  //await myMongoTeam(clientMongo);
  //await ranking(clientMongo);

  //await fRanking.rankingEquipment(clientMongo, nameItem = 'EB');
  //await fRanking.rankingGeneral(clientMongo, nameRanking = 'lvHeroes');
  //await fRanking.rankingGeneral(clientMongo, nameRanking = 'trophies');
  //await fRanking.rankingGeneral(clientMongo, nameRanking = 'warStars');
  //await fRanking.rankingGeneral(clientMongo, nameRanking = 'attackWins');

  //await post.autoUpdatePlayer(clientMongo);

  //await fMongo.standingsGroupStage(clientMongo, 'five');
  //await fMongo.jwcAttacks(clientMongo, 'five');
  //await fMongo.teamList(clientMongo, 'j1');
  //await fMongo.standings(clientMongo, 'j2');
  //await fMongo.updateLegendDay(clientMongo, 1);
  //await fMongo.rezeroLegendCount(clientMongo);

  console.log(functions.plusTime("end"));
  process.exit();
})();

async function calcStatsLeagueWeek(dbValueClans, weekStr) {
  let arrReturn = {};

  let allAttackTypes = {};
  let fresh = {};
  let cleanup = {};
  let overkill = {};

  const arr_destruction = returnArr(
    dbValueClans,
    weekStr,
    "destruction",
    "",
    "",
  );
  if (arr_destruction.length == 0) {
    return;
  }
  arrReturn.destruction = Math.round(ss.mean(arr_destruction) * 100) / 100;

  // ********** allAttackTypes **********
  let nAt = {};
  let obj_nAt = {};
  obj_nAt.total = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nAt",
    "total",
  );
  obj_nAt.th16 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nAt",
    "th16",
  );
  obj_nAt.th15 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nAt",
    "th15",
  );
  obj_nAt.th14 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nAt",
    "th14",
  );
  obj_nAt.th13 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nAt",
    "th13",
  );
  obj_nAt.th12 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nAt",
    "th12",
  );
  nAt.total = ss.sum(obj_nAt.total);
  nAt.th16 = ss.sum(obj_nAt.th16);
  nAt.th15 = ss.sum(obj_nAt.th15);
  nAt.th14 = ss.sum(obj_nAt.th14);
  nAt.th13 = ss.sum(obj_nAt.th13);
  nAt.th12 = ss.sum(obj_nAt.th12);
  allAttackTypes.nAt = nAt;

  let nTriple = {};
  let obj_nTriple = {};
  obj_nTriple.total = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nTriple",
    "total",
  );
  obj_nTriple.th16 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nTriple",
    "th16",
  );
  obj_nTriple.th15 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nTriple",
    "th15",
  );
  obj_nTriple.th14 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nTriple",
    "th14",
  );
  obj_nTriple.th13 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nTriple",
    "th13",
  );
  obj_nTriple.th12 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nTriple",
    "th12",
  );
  nTriple.total = ss.sum(obj_nTriple.total);
  nTriple.th16 = ss.sum(obj_nTriple.th16);
  nTriple.th15 = ss.sum(obj_nTriple.th15);
  nTriple.th14 = ss.sum(obj_nTriple.th14);
  nTriple.th13 = ss.sum(obj_nTriple.th13);
  nTriple.th12 = ss.sum(obj_nTriple.th12);
  allAttackTypes.nTriple = nTriple;

  let nDef = {};
  let obj_nDef = {};
  obj_nDef.total = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nDef",
    "total",
  );
  obj_nDef.th16 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nDef",
    "th16",
  );
  obj_nDef.th15 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nDef",
    "th15",
  );
  obj_nDef.th14 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nDef",
    "th14",
  );
  obj_nDef.th13 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nDef",
    "th13",
  );
  obj_nDef.th12 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nDef",
    "th12",
  );
  nDef.total = ss.sum(obj_nDef.total);
  nDef.th16 = ss.sum(obj_nDef.th16);
  nDef.th15 = ss.sum(obj_nDef.th15);
  nDef.th14 = ss.sum(obj_nDef.th14);
  nDef.th13 = ss.sum(obj_nDef.th13);
  nDef.th12 = ss.sum(obj_nDef.th12);
  allAttackTypes.nDef = nDef;

  let nDefTriple = {};
  let obj_nDefTriple = {};
  obj_nDefTriple.total = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nDefTriple",
    "total",
  );
  obj_nDefTriple.th16 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nDefTriple",
    "th16",
  );
  obj_nDefTriple.th15 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nDefTriple",
    "th15",
  );
  obj_nDefTriple.th14 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nDefTriple",
    "th14",
  );
  obj_nDefTriple.th13 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nDefTriple",
    "th13",
  );
  obj_nDefTriple.th12 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "nDefTriple",
    "th12",
  );
  nDefTriple.total = ss.sum(obj_nDefTriple.total);
  nDefTriple.th16 = ss.sum(obj_nDefTriple.th16);
  nDefTriple.th15 = ss.sum(obj_nDefTriple.th15);
  nDefTriple.th14 = ss.sum(obj_nDefTriple.th14);
  nDefTriple.th13 = ss.sum(obj_nDefTriple.th13);
  nDefTriple.th12 = ss.sum(obj_nDefTriple.th12);
  allAttackTypes.nDefTriple = nDefTriple;

  let hitrate = {};
  let obj_hitrate = {};
  let sd = {};
  let defrate = {};
  let obj_defrate = {};
  let sdDef = {};
  obj_hitrate.total = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "hitrate",
    "total",
  );
  obj_hitrate.th16 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "hitrate",
    "th16",
  );
  obj_hitrate.th15 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "hitrate",
    "th15",
  );
  obj_hitrate.th14 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "hitrate",
    "th14",
  );
  obj_hitrate.th13 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "hitrate",
    "th13",
  );
  obj_hitrate.th12 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "hitrate",
    "th12",
  );
  hitrate.total = Math.round((nTriple.total / nAt.total) * 100 * 100) / 100;
  hitrate.th16 = Math.round((nTriple.th16 / nAt.th16) * 100 * 100) / 100;
  hitrate.th15 = Math.round((nTriple.th15 / nAt.th15) * 100 * 100) / 100;
  hitrate.th14 = Math.round((nTriple.th14 / nAt.th14) * 100 * 100) / 100;
  hitrate.th13 = Math.round((nTriple.th13 / nAt.th13) * 100 * 100) / 100;
  hitrate.th12 = Math.round((nTriple.th12 / nAt.th12) * 100 * 100) / 100;
  if (obj_hitrate.total.length != 0)
    sd.total = Math.round(ss.standardDeviation(obj_hitrate.total) * 100) / 100;
  if (obj_hitrate.th16.length != 0)
    sd.th16 = Math.round(ss.standardDeviation(obj_hitrate.th16) * 100) / 100;
  if (obj_hitrate.th15.length != 0)
    sd.th15 = Math.round(ss.standardDeviation(obj_hitrate.th15) * 100) / 100;
  if (obj_hitrate.th14.length != 0)
    sd.th14 = Math.round(ss.standardDeviation(obj_hitrate.th14) * 100) / 100;
  if (obj_hitrate.th13.length != 0)
    sd.th13 = Math.round(ss.standardDeviation(obj_hitrate.th13) * 100) / 100;
  if (obj_hitrate.th12.length != 0)
    sd.th12 = Math.round(ss.standardDeviation(obj_hitrate.th12) * 100) / 100;
  obj_defrate.total = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "defrate",
    "total",
  );
  obj_defrate.th16 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "defrate",
    "th16",
  );
  obj_defrate.th15 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "defrate",
    "th15",
  );
  obj_defrate.th14 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "defrate",
    "th14",
  );
  obj_defrate.th13 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "defrate",
    "th13",
  );
  obj_defrate.th12 = returnArr(
    dbValueClans,
    weekStr,
    "allAttackTypes",
    "defrate",
    "th12",
  );
  defrate.total =
    Math.round((100 - (nDefTriple.total / nDef.total) * 100) * 100) / 100;
  defrate.th16 =
    Math.round((100 - (nDefTriple.th16 / nDef.th16) * 100) * 100) / 100;
  defrate.th15 =
    Math.round((100 - (nDefTriple.th15 / nDef.th15) * 100) * 100) / 100;
  defrate.th14 =
    Math.round((100 - (nDefTriple.th14 / nDef.th14) * 100) * 100) / 100;
  defrate.th13 =
    Math.round((100 - (nDefTriple.th13 / nDef.th13) * 100) * 100) / 100;
  defrate.th12 =
    Math.round((100 - (nDefTriple.th12 / nDef.th12) * 100) * 100) / 100;
  if (obj_defrate.total.length != 0)
    sdDef.total =
      Math.round(ss.standardDeviation(obj_defrate.total) * 100) / 100;
  if (obj_defrate.th16.length != 0)
    sdDef.th16 = Math.round(ss.standardDeviation(obj_defrate.th16) * 100) / 100;
  if (obj_defrate.th15.length != 0)
    sdDef.th15 = Math.round(ss.standardDeviation(obj_defrate.th15) * 100) / 100;
  if (obj_defrate.th14.length != 0)
    sdDef.th14 = Math.round(ss.standardDeviation(obj_defrate.th14) * 100) / 100;
  if (obj_defrate.th13.length != 0)
    sdDef.th13 = Math.round(ss.standardDeviation(obj_defrate.th13) * 100) / 100;
  if (obj_defrate.th12.length != 0)
    sdDef.th12 = Math.round(ss.standardDeviation(obj_defrate.th12) * 100) / 100;

  allAttackTypes.hitrate = hitrate;
  allAttackTypes.sd = sd;
  allAttackTypes.defrate = defrate;
  allAttackTypes.sdDef = sdDef;

  arrReturn.allAttackTypes = allAttackTypes;
  // ********** allAttackTypes **********

  // ********** fresh **********
  let nFresh = {};
  let obj_nFresh = {};
  obj_nFresh.total = returnArr(dbValueClans, weekStr, "fresh", "nAt", "total");
  obj_nFresh.th16 = returnArr(dbValueClans, weekStr, "fresh", "nAt", "th16");
  obj_nFresh.th15 = returnArr(dbValueClans, weekStr, "fresh", "nAt", "th15");
  obj_nFresh.th14 = returnArr(dbValueClans, weekStr, "fresh", "nAt", "th14");
  obj_nFresh.th13 = returnArr(dbValueClans, weekStr, "fresh", "nAt", "th13");
  obj_nFresh.th12 = returnArr(dbValueClans, weekStr, "fresh", "nAt", "th12");
  nFresh.total = ss.sum(obj_nFresh.total);
  nFresh.th16 = ss.sum(obj_nFresh.th16);
  nFresh.th15 = ss.sum(obj_nFresh.th15);
  nFresh.th14 = ss.sum(obj_nFresh.th14);
  nFresh.th13 = ss.sum(obj_nFresh.th13);
  nFresh.th12 = ss.sum(obj_nFresh.th12);
  fresh.nAt = nFresh;

  let nTripleFresh = {};
  let obj_nTripleFresh = {};
  obj_nTripleFresh.total = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nTriple",
    "total",
  );
  obj_nTripleFresh.th16 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nTriple",
    "th16",
  );
  obj_nTripleFresh.th15 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nTriple",
    "th15",
  );
  obj_nTripleFresh.th14 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nTriple",
    "th14",
  );
  obj_nTripleFresh.th13 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nTriple",
    "th13",
  );
  obj_nTripleFresh.th12 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nTriple",
    "th12",
  );
  nTripleFresh.total = ss.sum(obj_nTripleFresh.total);
  nTripleFresh.th16 = ss.sum(obj_nTripleFresh.th16);
  nTripleFresh.th15 = ss.sum(obj_nTripleFresh.th15);
  nTripleFresh.th14 = ss.sum(obj_nTripleFresh.th14);
  nTripleFresh.th13 = ss.sum(obj_nTripleFresh.th13);
  nTripleFresh.th12 = ss.sum(obj_nTripleFresh.th12);
  fresh.nTriple = nTripleFresh;

  let nDefFresh = {};
  let obj_nDefFresh = {};
  obj_nDefFresh.total = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nDef",
    "total",
  );
  obj_nDefFresh.th16 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nDef",
    "th16",
  );
  obj_nDefFresh.th15 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nDef",
    "th15",
  );
  obj_nDefFresh.th14 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nDef",
    "th14",
  );
  obj_nDefFresh.th13 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nDef",
    "th13",
  );
  obj_nDefFresh.th12 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nDef",
    "th12",
  );
  nDefFresh.total = ss.sum(obj_nDefFresh.total);
  nDefFresh.th16 = ss.sum(obj_nDefFresh.th16);
  nDefFresh.th15 = ss.sum(obj_nDefFresh.th15);
  nDefFresh.th14 = ss.sum(obj_nDefFresh.th14);
  nDefFresh.th13 = ss.sum(obj_nDefFresh.th13);
  nDefFresh.th12 = ss.sum(obj_nDefFresh.th12);
  fresh.nDef = nDefFresh;

  let nDefTripleFresh = {};
  let obj_nDefTripleFresh = {};
  obj_nDefTripleFresh.total = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nDefTriple",
    "total",
  );
  obj_nDefTripleFresh.th16 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nDefTriple",
    "th16",
  );
  obj_nDefTripleFresh.th15 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nDefTriple",
    "th15",
  );
  obj_nDefTripleFresh.th14 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nDefTriple",
    "th14",
  );
  obj_nDefTripleFresh.th13 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nDefTriple",
    "th13",
  );
  obj_nDefTripleFresh.th12 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "nDefTriple",
    "th12",
  );
  nDefTripleFresh.total = ss.sum(obj_nDefTripleFresh.total);
  nDefTripleFresh.th16 = ss.sum(obj_nDefTripleFresh.th16);
  nDefTripleFresh.th15 = ss.sum(obj_nDefTripleFresh.th15);
  nDefTripleFresh.th14 = ss.sum(obj_nDefTripleFresh.th14);
  nDefTripleFresh.th13 = ss.sum(obj_nDefTripleFresh.th13);
  nDefTripleFresh.th12 = ss.sum(obj_nDefTripleFresh.th12);
  fresh.nDefTriple = nDefTripleFresh;

  let hitrateFresh = {};
  let obj_hitrateFresh = {};
  let sdFresh = {};
  let defrateFresh = {};
  let obj_defrateFresh = {};
  let sdDefFresh = {};
  obj_hitrateFresh.total = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "hitrate",
    "total",
  );
  obj_hitrateFresh.th16 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "hitrate",
    "th16",
  );
  obj_hitrateFresh.th15 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "hitrate",
    "th15",
  );
  obj_hitrateFresh.th14 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "hitrate",
    "th14",
  );
  obj_hitrateFresh.th13 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "hitrate",
    "th13",
  );
  obj_hitrateFresh.th12 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "hitrate",
    "th12",
  );
  hitrateFresh.total =
    Math.round((nTripleFresh.total / nFresh.total) * 100 * 100) / 100;
  hitrateFresh.th16 =
    Math.round((nTripleFresh.th16 / nFresh.th16) * 100 * 100) / 100;
  hitrateFresh.th15 =
    Math.round((nTripleFresh.th15 / nFresh.th15) * 100 * 100) / 100;
  hitrateFresh.th14 =
    Math.round((nTripleFresh.th14 / nFresh.th14) * 100 * 100) / 100;
  hitrateFresh.th13 =
    Math.round((nTripleFresh.th13 / nFresh.th13) * 100 * 100) / 100;
  hitrateFresh.th12 =
    Math.round((nTripleFresh.th12 / nFresh.th12) * 100 * 100) / 100;
  if (obj_hitrateFresh.total.length != 0)
    sdFresh.total =
      Math.round(ss.standardDeviation(obj_hitrateFresh.total) * 100) / 100;
  if (obj_hitrateFresh.th16.length != 0)
    sdFresh.th16 =
      Math.round(ss.standardDeviation(obj_hitrateFresh.th16) * 100) / 100;
  if (obj_hitrateFresh.th15.length != 0)
    sdFresh.th15 =
      Math.round(ss.standardDeviation(obj_hitrateFresh.th15) * 100) / 100;
  if (obj_hitrateFresh.th14.length != 0)
    sdFresh.th14 =
      Math.round(ss.standardDeviation(obj_hitrateFresh.th14) * 100) / 100;
  if (obj_hitrateFresh.th13.length != 0)
    sdFresh.th13 =
      Math.round(ss.standardDeviation(obj_hitrateFresh.th13) * 100) / 100;
  if (obj_hitrateFresh.th12.length != 0)
    sdFresh.th12 =
      Math.round(ss.standardDeviation(obj_hitrateFresh.th12) * 100) / 100;
  obj_defrateFresh.total = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "defrate",
    "total",
  );
  obj_defrateFresh.th16 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "defrate",
    "th15",
  );
  obj_defrateFresh.th15 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "defrate",
    "th15",
  );
  obj_defrateFresh.th14 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "defrate",
    "th14",
  );
  obj_defrateFresh.th13 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "defrate",
    "th13",
  );
  obj_defrateFresh.th12 = returnArr(
    dbValueClans,
    weekStr,
    "fresh",
    "defrate",
    "th12",
  );
  defrateFresh.total =
    Math.round((100 - (nDefTripleFresh.total / nDefFresh.total) * 100) * 100) /
    100;
  defrateFresh.th16 =
    Math.round((100 - (nDefTripleFresh.th16 / nDefFresh.th16) * 100) * 100) /
    100;
  defrateFresh.th15 =
    Math.round((100 - (nDefTripleFresh.th15 / nDefFresh.th15) * 100) * 100) /
    100;
  defrateFresh.th14 =
    Math.round((100 - (nDefTripleFresh.th14 / nDefFresh.th14) * 100) * 100) /
    100;
  defrateFresh.th13 =
    Math.round((100 - (nDefTripleFresh.th13 / nDefFresh.th13) * 100) * 100) /
    100;
  defrateFresh.th12 =
    Math.round((100 - (nDefTripleFresh.th12 / nDefFresh.th12) * 100) * 100) /
    100;
  if (obj_defrateFresh.total.length != 0)
    sdDefFresh.total =
      Math.round(ss.standardDeviation(obj_defrateFresh.total) * 100) / 100;
  if (obj_defrateFresh.th16.length != 0)
    sdDefFresh.th16 =
      Math.round(ss.standardDeviation(obj_defrateFresh.th16) * 100) / 100;
  if (obj_defrateFresh.th15.length != 0)
    sdDefFresh.th15 =
      Math.round(ss.standardDeviation(obj_defrateFresh.th15) * 100) / 100;
  if (obj_defrateFresh.th14.length != 0)
    sdDefFresh.th14 =
      Math.round(ss.standardDeviation(obj_defrateFresh.th14) * 100) / 100;
  if (obj_defrateFresh.th13.length != 0)
    sdDefFresh.th13 =
      Math.round(ss.standardDeviation(obj_defrateFresh.th13) * 100) / 100;
  if (obj_defrateFresh.th12.length != 0)
    sdDefFresh.th12 =
      Math.round(ss.standardDeviation(obj_defrateFresh.th12) * 100) / 100;

  fresh.hitrate = hitrateFresh;
  fresh.sd = sdFresh;
  fresh.defrate = defrateFresh;
  fresh.sdDef = sdDefFresh;

  arrReturn.fresh = fresh;
  // ********** fresh **********

  // ********** cleanup **********
  let nCleanup = {};
  let obj_nCleanup = {};
  obj_nCleanup.total = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nAt",
    "total",
  );
  obj_nCleanup.th16 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nAt",
    "th16",
  );
  obj_nCleanup.th15 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nAt",
    "th15",
  );
  obj_nCleanup.th14 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nAt",
    "th14",
  );
  obj_nCleanup.th13 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nAt",
    "th13",
  );
  obj_nCleanup.th12 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nAt",
    "th12",
  );
  nCleanup.total = ss.sum(obj_nCleanup.total);
  nCleanup.th16 = ss.sum(obj_nCleanup.th16);
  nCleanup.th15 = ss.sum(obj_nCleanup.th15);
  nCleanup.th14 = ss.sum(obj_nCleanup.th14);
  nCleanup.th13 = ss.sum(obj_nCleanup.th13);
  nCleanup.th12 = ss.sum(obj_nCleanup.th12);
  cleanup.nAt = nCleanup;

  let nTripleCleanup = {};
  let obj_nTripleCleanup = {};
  obj_nTripleCleanup.total = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nTriple",
    "total",
  );
  obj_nTripleCleanup.th16 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nTriple",
    "th16",
  );
  obj_nTripleCleanup.th15 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nTriple",
    "th15",
  );
  obj_nTripleCleanup.th14 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nTriple",
    "th14",
  );
  obj_nTripleCleanup.th13 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nTriple",
    "th13",
  );
  obj_nTripleCleanup.th12 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nTriple",
    "th12",
  );
  nTripleCleanup.total = ss.sum(obj_nTripleCleanup.total);
  nTripleCleanup.th16 = ss.sum(obj_nTripleCleanup.th16);
  nTripleCleanup.th15 = ss.sum(obj_nTripleCleanup.th15);
  nTripleCleanup.th14 = ss.sum(obj_nTripleCleanup.th14);
  nTripleCleanup.th13 = ss.sum(obj_nTripleCleanup.th13);
  nTripleCleanup.th12 = ss.sum(obj_nTripleCleanup.th12);
  cleanup.nTriple = nTripleCleanup;

  let nDefCleanup = {};
  let obj_nDefCleanup = {};
  obj_nDefCleanup.total = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nDef",
    "total",
  );
  obj_nDefCleanup.th16 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nDef",
    "th16",
  );
  obj_nDefCleanup.th15 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nDef",
    "th15",
  );
  obj_nDefCleanup.th14 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nDef",
    "th14",
  );
  obj_nDefCleanup.th13 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nDef",
    "th13",
  );
  obj_nDefCleanup.th12 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nDef",
    "th12",
  );
  nDefCleanup.total = ss.sum(obj_nDefCleanup.total);
  nDefCleanup.th16 = ss.sum(obj_nDefCleanup.th16);
  nDefCleanup.th15 = ss.sum(obj_nDefCleanup.th15);
  nDefCleanup.th14 = ss.sum(obj_nDefCleanup.th14);
  nDefCleanup.th13 = ss.sum(obj_nDefCleanup.th13);
  nDefCleanup.th12 = ss.sum(obj_nDefCleanup.th12);
  cleanup.nDef = nDefCleanup;

  let nDefTripleCleanup = {};
  let obj_nDefTripleCleanup = {};
  obj_nDefTripleCleanup.total = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nDefTriple",
    "total",
  );
  obj_nDefTripleCleanup.th16 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nDefTriple",
    "th16",
  );
  obj_nDefTripleCleanup.th15 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nDefTriple",
    "th15",
  );
  obj_nDefTripleCleanup.th14 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nDefTriple",
    "th14",
  );
  obj_nDefTripleCleanup.th13 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nDefTriple",
    "th13",
  );
  obj_nDefTripleCleanup.th12 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "nDefTriple",
    "th12",
  );
  nDefTripleCleanup.total = ss.sum(obj_nDefTripleCleanup.total);
  nDefTripleCleanup.th16 = ss.sum(obj_nDefTripleCleanup.th16);
  nDefTripleCleanup.th15 = ss.sum(obj_nDefTripleCleanup.th15);
  nDefTripleCleanup.th14 = ss.sum(obj_nDefTripleCleanup.th14);
  nDefTripleCleanup.th13 = ss.sum(obj_nDefTripleCleanup.th13);
  nDefTripleCleanup.th12 = ss.sum(obj_nDefTripleCleanup.th12);
  cleanup.nDefTriple = nDefTripleCleanup;

  let hitrateCleanup = {};
  let obj_hitrateCleanup = {};
  let sdCleanup = {};
  let defrateCleanup = {};
  let obj_defrateCleanup = {};
  let sdDefCleanup = {};
  obj_hitrateCleanup.total = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "hitrate",
    "total",
  );
  obj_hitrateCleanup.th16 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "hitrate",
    "th16",
  );
  obj_hitrateCleanup.th15 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "hitrate",
    "th15",
  );
  obj_hitrateCleanup.th14 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "hitrate",
    "th14",
  );
  obj_hitrateCleanup.th13 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "hitrate",
    "th13",
  );
  obj_hitrateCleanup.th12 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "hitrate",
    "th12",
  );
  hitrateCleanup.total =
    Math.round((nTripleCleanup.total / nCleanup.total) * 100 * 100) / 100;
  hitrateCleanup.th16 =
    Math.round((nTripleCleanup.th16 / nCleanup.th16) * 100 * 100) / 100;
  hitrateCleanup.th15 =
    Math.round((nTripleCleanup.th15 / nCleanup.th15) * 100 * 100) / 100;
  hitrateCleanup.th14 =
    Math.round((nTripleCleanup.th14 / nCleanup.th14) * 100 * 100) / 100;
  hitrateCleanup.th13 =
    Math.round((nTripleCleanup.th13 / nCleanup.th13) * 100 * 100) / 100;
  hitrateCleanup.th12 =
    Math.round((nTripleCleanup.th12 / nCleanup.th12) * 100 * 100) / 100;
  if (obj_hitrateCleanup.total.length != 0)
    sdCleanup.total =
      Math.round(ss.standardDeviation(obj_hitrateCleanup.total) * 100) / 100;
  if (obj_hitrateCleanup.th16.length != 0)
    sdCleanup.th16 =
      Math.round(ss.standardDeviation(obj_hitrateCleanup.th16) * 100) / 100;
  if (obj_hitrateCleanup.th15.length != 0)
    sdCleanup.th15 =
      Math.round(ss.standardDeviation(obj_hitrateCleanup.th15) * 100) / 100;
  if (obj_hitrateCleanup.th14.length != 0)
    sdCleanup.th14 =
      Math.round(ss.standardDeviation(obj_hitrateCleanup.th14) * 100) / 100;
  if (obj_hitrateCleanup.th13.length != 0)
    sdCleanup.th13 =
      Math.round(ss.standardDeviation(obj_hitrateCleanup.th13) * 100) / 100;
  if (obj_hitrateCleanup.th12.length != 0)
    sdCleanup.th12 =
      Math.round(ss.standardDeviation(obj_hitrateCleanup.th12) * 100) / 100;
  obj_defrateCleanup.total = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "defrate",
    "total",
  );
  obj_defrateCleanup.th16 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "defrate",
    "th16",
  );
  obj_defrateCleanup.th15 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "defrate",
    "th15",
  );
  obj_defrateCleanup.th14 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "defrate",
    "th14",
  );
  obj_defrateCleanup.th13 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "defrate",
    "th13",
  );
  obj_defrateCleanup.th12 = returnArr(
    dbValueClans,
    weekStr,
    "cleanup",
    "defrate",
    "th12",
  );
  defrateCleanup.total =
    Math.round(
      (100 - (nDefTripleCleanup.total / nDefCleanup.total) * 100) * 100,
    ) / 100;
  defrateCleanup.th16 =
    Math.round(
      (100 - (nDefTripleCleanup.th16 / nDefCleanup.th16) * 100) * 100,
    ) / 100;
  defrateCleanup.th15 =
    Math.round(
      (100 - (nDefTripleCleanup.th15 / nDefCleanup.th15) * 100) * 100,
    ) / 100;
  defrateCleanup.th14 =
    Math.round(
      (100 - (nDefTripleCleanup.th14 / nDefCleanup.th14) * 100) * 100,
    ) / 100;
  defrateCleanup.th13 =
    Math.round(
      (100 - (nDefTripleCleanup.th13 / nDefCleanup.th13) * 100) * 100,
    ) / 100;
  defrateCleanup.th12 =
    Math.round(
      (100 - (nDefTripleCleanup.th12 / nDefCleanup.th12) * 100) * 100,
    ) / 100;
  if (obj_defrateCleanup.total.length != 0)
    sdDefCleanup.total =
      Math.round(ss.standardDeviation(obj_defrateCleanup.total) * 100) / 100;
  if (obj_defrateCleanup.th16.length != 0)
    sdDefCleanup.th16 =
      Math.round(ss.standardDeviation(obj_defrateCleanup.th16) * 100) / 100;
  if (obj_defrateCleanup.th15.length != 0)
    sdDefCleanup.th15 =
      Math.round(ss.standardDeviation(obj_defrateCleanup.th15) * 100) / 100;
  if (obj_defrateCleanup.th14.length != 0)
    sdDefCleanup.th14 =
      Math.round(ss.standardDeviation(obj_defrateCleanup.th14) * 100) / 100;
  if (obj_defrateCleanup.th13.length != 0)
    sdDefCleanup.th13 =
      Math.round(ss.standardDeviation(obj_defrateCleanup.th13) * 100) / 100;
  if (obj_defrateCleanup.th12.length != 0)
    sdDefCleanup.th12 =
      Math.round(ss.standardDeviation(obj_defrateCleanup.th12) * 100) / 100;

  cleanup.hitrate = hitrateCleanup;
  cleanup.sd = sdCleanup;
  cleanup.defrate = defrateCleanup;
  cleanup.sdDef = sdDefCleanup;

  arrReturn.cleanup = cleanup;
  // ********** cleanup **********

  // ********** overkill **********
  let nOverkill = {};
  let obj_nOverkill = {};
  obj_nOverkill.total = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nAt",
    "total",
  );
  obj_nOverkill.th16 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nAt",
    "th16",
  );
  obj_nOverkill.th15 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nAt",
    "th15",
  );
  obj_nOverkill.th14 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nAt",
    "th14",
  );
  obj_nOverkill.th13 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nAt",
    "th13",
  );
  obj_nOverkill.th12 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nAt",
    "th12",
  );
  nOverkill.total = ss.sum(obj_nOverkill.total);
  nOverkill.th16 = ss.sum(obj_nOverkill.th16);
  nOverkill.th15 = ss.sum(obj_nOverkill.th15);
  nOverkill.th14 = ss.sum(obj_nOverkill.th14);
  nOverkill.th13 = ss.sum(obj_nOverkill.th13);
  nOverkill.th12 = ss.sum(obj_nOverkill.th12);
  overkill.nAt = nOverkill;

  let nTripleOverkill = {};
  let obj_nTripleOverkill = {};
  obj_nTripleOverkill.total = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nTriple",
    "total",
  );
  obj_nTripleOverkill.th16 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nTriple",
    "th16",
  );
  obj_nTripleOverkill.th15 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nTriple",
    "th15",
  );
  obj_nTripleOverkill.th14 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nTriple",
    "th14",
  );
  obj_nTripleOverkill.th13 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nTriple",
    "th13",
  );
  obj_nTripleOverkill.th12 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nTriple",
    "th12",
  );
  nTripleOverkill.total = ss.sum(obj_nTripleOverkill.total);
  nTripleOverkill.th16 = ss.sum(obj_nTripleOverkill.th16);
  nTripleOverkill.th15 = ss.sum(obj_nTripleOverkill.th15);
  nTripleOverkill.th14 = ss.sum(obj_nTripleOverkill.th14);
  nTripleOverkill.th13 = ss.sum(obj_nTripleOverkill.th13);
  nTripleOverkill.th12 = ss.sum(obj_nTripleOverkill.th12);
  overkill.nTriple = nTripleOverkill;

  let nDefOverkill = {};
  let obj_nDefOverkill = {};
  obj_nDefOverkill.total = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nDef",
    "total",
  );
  obj_nDefOverkill.th16 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nDef",
    "th16",
  );
  obj_nDefOverkill.th15 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nDef",
    "th15",
  );
  obj_nDefOverkill.th14 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nDef",
    "th14",
  );
  obj_nDefOverkill.th13 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nDef",
    "th13",
  );
  obj_nDefOverkill.th12 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nDef",
    "th12",
  );
  nDefOverkill.total = ss.sum(obj_nDefOverkill.total);
  nDefOverkill.th16 = ss.sum(obj_nDefOverkill.th16);
  nDefOverkill.th15 = ss.sum(obj_nDefOverkill.th15);
  nDefOverkill.th14 = ss.sum(obj_nDefOverkill.th14);
  nDefOverkill.th13 = ss.sum(obj_nDefOverkill.th13);
  nDefOverkill.th12 = ss.sum(obj_nDefOverkill.th12);
  overkill.nDef = nDefOverkill;

  let nDefTripleOverkill = {};
  let obj_nDefTripleOverkill = {};
  obj_nDefTripleOverkill.total = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nDefTriple",
    "total",
  );
  obj_nDefTripleOverkill.th16 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nDefTriple",
    "th16",
  );
  obj_nDefTripleOverkill.th15 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nDefTriple",
    "th15",
  );
  obj_nDefTripleOverkill.th14 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nDefTriple",
    "th14",
  );
  obj_nDefTripleOverkill.th13 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nDefTriple",
    "th13",
  );
  obj_nDefTripleOverkill.th12 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "nDefTriple",
    "th12",
  );
  nDefTripleOverkill.total = ss.sum(obj_nDefTripleOverkill.total);
  nDefTripleOverkill.th16 = ss.sum(obj_nDefTripleOverkill.th16);
  nDefTripleOverkill.th15 = ss.sum(obj_nDefTripleOverkill.th15);
  nDefTripleOverkill.th14 = ss.sum(obj_nDefTripleOverkill.th14);
  nDefTripleOverkill.th13 = ss.sum(obj_nDefTripleOverkill.th13);
  nDefTripleOverkill.th12 = ss.sum(obj_nDefTripleOverkill.th12);
  overkill.nDefTriple = nDefTripleOverkill;

  let hitrateOverkill = {};
  let obj_hitrateOverkill = {};
  let sdOverkill = {};
  let defrateOverkill = {};
  let obj_defrateOverkill = {};
  let sdDefOverkill = {};
  obj_hitrateOverkill.total = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "hitrate",
    "total",
  );
  obj_hitrateOverkill.th16 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "hitrate",
    "th16",
  );
  obj_hitrateOverkill.th15 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "hitrate",
    "th15",
  );
  obj_hitrateOverkill.th14 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "hitrate",
    "th14",
  );
  obj_hitrateOverkill.th13 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "hitrate",
    "th13",
  );
  obj_hitrateOverkill.th12 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "hitrate",
    "th12",
  );
  hitrateOverkill.total =
    Math.round((nTripleOverkill.total / nOverkill.total) * 100 * 100) / 100;
  hitrateOverkill.th16 =
    Math.round((nTripleOverkill.th16 / nOverkill.th16) * 100 * 100) / 100;
  hitrateOverkill.th15 =
    Math.round((nTripleOverkill.th15 / nOverkill.th15) * 100 * 100) / 100;
  hitrateOverkill.th14 =
    Math.round((nTripleOverkill.th14 / nOverkill.th14) * 100 * 100) / 100;
  hitrateOverkill.th13 =
    Math.round((nTripleOverkill.th13 / nOverkill.th13) * 100 * 100) / 100;
  hitrateOverkill.th12 =
    Math.round((nTripleOverkill.th12 / nOverkill.th12) * 100 * 100) / 100;
  if (obj_hitrateOverkill.total.length != 0)
    sdOverkill.total =
      Math.round(ss.standardDeviation(obj_hitrateOverkill.total) * 100) / 100;
  if (obj_hitrateOverkill.th16.length != 0)
    sdOverkill.th16 =
      Math.round(ss.standardDeviation(obj_hitrateOverkill.th16) * 100) / 100;
  if (obj_hitrateOverkill.th15.length != 0)
    sdOverkill.th15 =
      Math.round(ss.standardDeviation(obj_hitrateOverkill.th15) * 100) / 100;
  if (obj_hitrateOverkill.th14.length != 0)
    sdOverkill.th14 =
      Math.round(ss.standardDeviation(obj_hitrateOverkill.th14) * 100) / 100;
  if (obj_hitrateOverkill.th13.length != 0)
    sdOverkill.th13 =
      Math.round(ss.standardDeviation(obj_hitrateOverkill.th13) * 100) / 100;
  if (obj_hitrateOverkill.th12.length != 0)
    sdOverkill.th12 =
      Math.round(ss.standardDeviation(obj_hitrateOverkill.th12) * 100) / 100;
  obj_defrateOverkill.total = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "defrate",
    "total",
  );
  obj_defrateOverkill.th16 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "defrate",
    "th15",
  );
  obj_defrateOverkill.th15 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "defrate",
    "th15",
  );
  obj_defrateOverkill.th14 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "defrate",
    "th14",
  );
  obj_defrateOverkill.th13 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "defrate",
    "th13",
  );
  obj_defrateOverkill.th12 = returnArr(
    dbValueClans,
    weekStr,
    "overkill",
    "defrate",
    "th12",
  );
  defrateOverkill.total =
    Math.round(
      (100 - (nDefTripleOverkill.total / nDefOverkill.total) * 100) * 100,
    ) / 100;
  defrateOverkill.th16 =
    Math.round(
      (100 - (nDefTripleOverkill.th16 / nDefOverkill.th16) * 100) * 100,
    ) / 100;
  defrateOverkill.th15 =
    Math.round(
      (100 - (nDefTripleOverkill.th15 / nDefOverkill.th15) * 100) * 100,
    ) / 100;
  defrateOverkill.th14 =
    Math.round(
      (100 - (nDefTripleOverkill.th14 / nDefOverkill.th14) * 100) * 100,
    ) / 100;
  defrateOverkill.th13 =
    Math.round(
      (100 - (nDefTripleOverkill.th13 / nDefOverkill.th13) * 100) * 100,
    ) / 100;
  defrateOverkill.th12 =
    Math.round(
      (100 - (nDefTripleOverkill.th12 / nDefOverkill.th12) * 100) * 100,
    ) / 100;
  if (obj_defrateOverkill.total.length != 0)
    sdDefOverkill.total =
      Math.round(ss.standardDeviation(obj_defrateOverkill.total) * 100) / 100;
  if (obj_defrateOverkill.th16.length != 0)
    sdDefOverkill.th16 =
      Math.round(ss.standardDeviation(obj_defrateOverkill.th16) * 100) / 100;
  if (obj_defrateOverkill.th15.length != 0)
    sdDefOverkill.th15 =
      Math.round(ss.standardDeviation(obj_defrateOverkill.th15) * 100) / 100;
  if (obj_defrateOverkill.th14.length != 0)
    sdDefOverkill.th14 =
      Math.round(ss.standardDeviation(obj_defrateOverkill.th14) * 100) / 100;
  if (obj_defrateOverkill.th13.length != 0)
    sdDefOverkill.th13 =
      Math.round(ss.standardDeviation(obj_defrateOverkill.th13) * 100) / 100;
  if (obj_defrateOverkill.th12.length != 0)
    sdDefOverkill.th12 =
      Math.round(ss.standardDeviation(obj_defrateOverkill.th12) * 100) / 100;

  overkill.hitrate = hitrateOverkill;
  overkill.sd = sdOverkill;
  overkill.defrate = defrateOverkill;
  overkill.sdDef = sdDefOverkill;

  arrReturn.overkill = overkill;
  // ********** overkill **********

  return arrReturn;
}
exports.calcStatsLeagueWeek = calcStatsLeagueWeek;

function returnArr(dbValueClans, weekStr, term1, term2, term3) {
  let arr = dbValueClans.map(function (dbValueClan) {
    if (
      dbValueClan.score_last_season !== null &&
      dbValueClan.score_last_season !== undefined
    ) {
      if (dbValueClan.score_last_season[weekStr] !== undefined) {
        if (dbValueClan.score_last_season[weekStr].clan[term1] !== undefined) {
          if (term2 == "") {
            return dbValueClan.score_last_season[weekStr].clan[term1];
          } else {
            return dbValueClan.score_last_season[weekStr].clan[term1][term2][
              term3
            ];
          }
        }
      }
    }
  });
  arr = arr.filter((x) => {
    return x !== undefined && x === x;
  }); // undefined, NaN を除去
  return arr;
}
exports.returnArr = returnArr;

// legend.leagueTier フィールドを削除
async function fixLegendEventActions(clientMongo) {
  const filter = {
    "legend.leagueTier": { $exists: true },
  };

  const updatePipeline = [
    {
      $unset: "legend.leagueTier",
    },
  ];

  const result = await clientMongo
    .db("jwc")
    .collection("accounts")
    .updateMany(filter, updatePipeline);

  console.log(
    `[fixLegendEventActions] matched: ${result.matchedCount}, modified: ${result.modifiedCount}`,
  );
  return result;
}
