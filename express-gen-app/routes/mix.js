let express = require('express');
let router = express.Router();

const fs = require("fs");
const path = require('path');

const config = require("../../config.js");

router.get('/', async function(req, res, next) {
  let league = "mix";
  var myPath = path.resolve(__dirname, '../public/json/clanAbbrList.json');
  const clanAbbrList = fs.readFileSync(myPath, 'utf8');
  var myPath = path.resolve(__dirname, `../public/json/dataTeams_${league}.json`);
  const dataTeams = fs.readFileSync(myPath, 'utf8');
  var myPath = path.resolve(__dirname, `../public/json/tableWars_${league}.json`);
  const tableWars = fs.readFileSync(myPath, 'utf8');
  var myPath = path.resolve(__dirname, `../public/json/tableRate_${league}.json`);
  const tableRate = fs.readFileSync(myPath, 'utf8');
  var myPath = path.resolve(__dirname, `../public/json/tableClanPlayers_${league}.json`);
  const tableClanPlayers = fs.readFileSync(myPath, 'utf8');
  var myPath = path.resolve(__dirname, `../public/json/tablePlayers_${league}.json`);
  const tablePlayers = fs.readFileSync(myPath, 'utf8');
  var myPath = path.resolve(__dirname, `../public/json/tableStandings_${league}.json`);
  const tableStandings = fs.readFileSync(myPath, 'utf8');
  var myPath = path.resolve(__dirname, `../public/json/chartData_${league}.json`);
  const chartData = fs.readFileSync(myPath, 'utf8');
  var myPath = path.resolve(__dirname, '../public/json/chartDataTH.json');
  const chartDataTH = fs.readFileSync(myPath, 'utf8');
  let tableLeagueStats = {};
  var myPath = path.resolve(__dirname, `../public/json/tableLeagueStats_mix.json`);
  tableLeagueStats.mix = JSON.parse(fs.readFileSync(myPath, 'utf8'));
  let chartDataLeagueStats = {};
  var myPath = path.resolve(__dirname, '../public/json/chartDataLeagueStats_mix.json');
  chartDataLeagueStats.mix = JSON.parse(fs.readFileSync(myPath, 'utf8'));
  res.render(league, {
    config: config,
    clanAbbrList: clanAbbrList,
    dataTeams: dataTeams,
    tableWars: tableWars,
    tableRate: tableRate,
    tableClanPlayers: tableClanPlayers,
    tablePlayers: tablePlayers,
    tableStandings: tableStandings,
    chartData: chartData,
    chartDataTH: chartDataTH,
    tableLeagueStats: JSON.stringify(tableLeagueStats),
    chartDataLeagueStats: JSON.stringify(chartDataLeagueStats),
  });
});
module.exports = router;
