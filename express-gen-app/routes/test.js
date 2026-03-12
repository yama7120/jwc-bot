let express = require('express');
let router = express.Router();

const fs = require("fs");
const path = require('path');

const config = require("../../config.js");

router.get('/', async function(req, res, next) {
  let dataWarStatsCurrent = {};
  var myPath = path.resolve(__dirname, '../public/json/dataWarStatsCurrent_j1.json');
  dataWarStatsCurrent.j1 = JSON.parse(fs.readFileSync(myPath, 'utf8'));
  var myPath = path.resolve(__dirname, '../public/json/dataWarStatsCurrent_j2.json');
  dataWarStatsCurrent.j2 = JSON.parse(fs.readFileSync(myPath, 'utf8'));
  var myPath = path.resolve(__dirname, '../public/json/dataWarStatsCurrent_swiss.json');
  dataWarStatsCurrent.swiss = JSON.parse(fs.readFileSync(myPath, 'utf8'));
  var myPath = path.resolve(__dirname, '../public/json/dataWarStatsCurrent_mix.json');
  dataWarStatsCurrent.mix = JSON.parse(fs.readFileSync(myPath, 'utf8'));
  var myPath = path.resolve(__dirname, '../public/json/chartDataWarProgress.json');
  const chartDataWarProgress = fs.readFileSync(myPath, 'utf8');
  var myPath = path.resolve(__dirname, '../public/json/chartOptionsWarProgress.json');
  const chartOptionsWarProgress = fs.readFileSync(myPath, 'utf8');
  res.render('test', {
    config: config,
    dataWarStatsCurrent: JSON.stringify(dataWarStatsCurrent),
    chartDataWarProgress: chartDataWarProgress,
    chartOptionsWarProgress: chartOptionsWarProgress,
  });
});

module.exports = router;
