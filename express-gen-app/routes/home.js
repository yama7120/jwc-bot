let express = require('express');
let router = express.Router();

const fs = require("fs");
const path = require('path');

const config = require("../../config.js");

const { MongoClient, ServerApiVersion } = require('mongodb');
const clientMongo = new MongoClient(process.env.mongoURI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

router.get('/', async function(req, res, next) {
  let dataWarStatsCurrent = {};
  var myPath = path.resolve(__dirname, '../public/json/dataWarStatsCurrent_j1.json');
  var jsonString = fs.readFileSync(myPath, 'utf8');
  if (jsonString == '') {
    dataWarStatsCurrent.j1 = '';
  }
  else {
    dataWarStatsCurrent.j1 = JSON.parse(jsonString);
  };
  var myPath = path.resolve(__dirname, '../public/json/dataWarStatsCurrent_j2.json');
  var jsonString = fs.readFileSync(myPath, 'utf8');
  if (jsonString == '') {
    dataWarStatsCurrent.j2 = '';
  }
  else {
    dataWarStatsCurrent.j2 = JSON.parse(jsonString);
  };
  var myPath = path.resolve(__dirname, '../public/json/dataWarStatsCurrent_swiss.json');
  var jsonString = fs.readFileSync(myPath, 'utf8');
  if (jsonString == '') {
    dataWarStatsCurrent.swiss = '';
  }
  else {
    dataWarStatsCurrent.swiss = JSON.parse(jsonString);
  };
  var myPath = path.resolve(__dirname, '../public/json/dataWarStatsCurrent_mix.json');
  var jsonString = fs.readFileSync(myPath, 'utf8');
  if (jsonString == '') {
    dataWarStatsCurrent.mix = '';
  }
  else {
    dataWarStatsCurrent.mix = JSON.parse(jsonString);
  };
  
  var myPath = path.resolve(__dirname, '../public/json/chartDataWarProgress.json');
  const chartDataWarProgress = fs.readFileSync(myPath, 'utf8');
  
  var myPath = path.resolve(__dirname, '../public/json/chartOptionsWarProgress.json');
  const chartOptionsWarProgress = fs.readFileSync(myPath, 'utf8');
  
  const weekNow = await clientMongo.db('jwc').collection('config').findOne({ name: 'weekNow' });
  
  res.render('home', {
    config: config,
    dataWarStatsCurrent: JSON.stringify(dataWarStatsCurrent),
    chartDataWarProgress: chartDataWarProgress,
    chartOptionsWarProgress: chartOptionsWarProgress,
    weekNow: JSON.stringify(weekNow),
  });
});

module.exports = router;
