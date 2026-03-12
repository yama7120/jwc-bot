const { EmbedBuilder } = require('discord.js');
const querystring = require('querystring');
const fetch = require('@replit/node-fetch'); // cliantCoc よりは後に置く
const config = require('../config.js');
const functions = require('./functions.js');
const fMongo = require('./fMongo.js');
const fRanking = require('./fRanking.js');


async function post(req, res, client, data) {
  //console.dir(data);

  if (!data) {
    console.log('No post data');
    res.status(400).json({ error: 'No post data' });
    return;
  };

  try {
    const scPlayer = await client.clientCoc.getPlayer('#2PP');
    //console.dir(scPlayer);
  }
  catch (error) {
    if (error.reason === 'inMaintenance') {
      console.log('inMaintenance');
      res.status(503).json({ error: 'Service in maintenance' });
      return;
    }
    else {
      console.log(`error: ${error.reason}`);
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
      return;
    };
  };

  //functions.updateWarInfo(client, 'mix', 13);

  // dataがオブジェクトの場合はそのまま使用、文字列の場合はquerystring.parse
  let dataObject;
  if (typeof data === 'object') {
    dataObject = data;
  } else {
    dataObject = querystring.parse(data);
  }
  if (dataObject.type == 'schedule_war') {
    await scheduleWar(client, dataObject);
    res.json({ success: true, message: 'War scheduled successfully' });
  }
  else if (dataObject.type == 'calendar') {
    console.log('post: ' + dataObject.type);
    await calendar(client, dataObject);
    res.json({ success: true, message: 'Calendar updated successfully' });
  }
  else if (dataObject.type == 'testFetch') {
    console.log(dataObject.type);
    res.json({ success: true, message: 'Test fetch successful' });
  }
  else {
    res.status(400).json({ error: 'Unknown type: ' + (dataObject.type || 'undefined') });
  }
  //console.log('end post');
};
exports.post = post;


async function scheduleWar(client, dataObject) {
  let description = '';
  let league = '';
  let week = '';

  let arrWars = JSON.parse(dataObject.arrWars);
  await Promise.all(arrWars.map(async (war) => {
    league = war.league;
    week = war.week;
    description += `${war.clan_abbr.toUpperCase()}  *vs.*  ${war.opponent_abbr.toUpperCase()}\n`;
    let listing = {};
    //listing._id = war.id;
    listing.league = war.league;
    listing.season = war.season;
    listing.division = war.division;
    listing.week = war.week;
    listing.match = war.match;
    listing.clan_abbr = war.clan_abbr;
    listing.opponent_abbr = war.opponent_abbr;
    listing.nego_channel = '';
    listing.clan_war = '';
    listing.opponent_war = '';
    listing.result = '';
    listing.deal = '';
    listing.name_match = war.name_match;
    let dbValueWar = await client.clientMongo.db('jwc').collection('wars').findOne({ 
      league: war.league, 
      season: war.season,
      week: war.week,
      match: war.match,
      clan_abbr: war.clan_abbr,
      opponent_abbr: war.opponent_abbr,
    });
    if (dbValueWar == null) { // 初回登録
      await client.clientMongo.db('jwc').collection('wars').insertOne(listing);
    }
    else { // 追加登録（更新） 
      //await client.clientMongo.db('jwc').collection('wars').updateOne({ _id: war.id }, { $set: listing });
    };
  }));
  description += `\n`;
  description += `:white_check_mark: ${config.league[league]} [week ${week}] wars have been scheduled successfully.\n`;

  const result = await functions.getDescriptionNego(league, week, 'teamNameA', 'teamNameB', 'matchName');
  description += `### PREVIEW`;
  description += `\n`;
  description += result.content;
  description += `\n`;
  description += result.description;

  let idCh = config.logch.adminBotRoom;
  if (league == 'five') {
    idCh = config.logch.adminBotRoom5v;
  };

  let myEmbed = new EmbedBuilder();
  let title = `**SCHEDULE**`;
  let footerText = `${config.footer} ${config.league[league]} WEEK ${week}`;
  myEmbed.setTitle(title);
  myEmbed.setDescription(description);
  myEmbed.setColor(config.color.main);
  myEmbed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });
  await client.channels.cache.get(idCh).send({ embeds: [myEmbed] });

  return;
};


async function calendar(client, dataObject) {
  let embed = new EmbedBuilder();
  let title = `__**JWC CALENDAR**__`;
  let footer = `${config.footer}`;

  embed.setTitle(title);
  embed.setURL(dataObject.urlCalendar);
  //embed.setDescription(description);
  embed.setColor(config.color.main);
  //embed.setFields(JSON.parse(dataObject.fields)[0]);
  embed.setDescription(dataObject.description);
  embed.setFooter({ text: footer, iconURL: config.urlImage.jwc });
  await client.channels.cache.get(config.logch.calendar).send({ embeds: [embed] });

  return;
};


//以下ごみ箱

async function autoUpdateLegendReset(client) {
  var query = { status: true };
  var sort = { trophies: -1 };
  var cursor = client.clientMongo.db('jwc').collection('accounts').find(query).sort(sort);
  let accountsAll = await cursor.toArray();
  await cursor.close();

  const nAccLoop = 30;

  let nLoop = Math.floor(accountsAll.length / nAccLoop) + 1;

  for (let i = 0; i < nLoop; i++) {
    let min = nAccLoop * i;
    let max = nAccLoop * (i + 1);
    if (max > accountsAll.length) {
      max = accountsAll.length;
    };
    const accs = accountsAll.filter(function(acc, index) { return min <= index && index < max });
    accs.map(async (acc, index) => {
      try {
        await updateLegendPreviousSeason(client.clientMongo, client.clientCoc, acc.tag);
      }
      catch (error) {
        console.error(error);
      };
    });
    console.log(`${max} / ${accountsAll.length}`);
    await functions.sleep(1000);
  };

  fMongo.updateLegendDay(client.clientMongo, 0);

  // legend [previous season]
  var nameRanking = 'legendPreviousSeason';
  var query = { status: true, 'legend.previous.trophies': { $gt: 0 } };
  var sort = { 'legend.previous.trophies': -1 };
  var nameItem = 'previous';
  await fRanking.rankingLegend(client.clientMongo, nameRanking, query, sort, nameItem);

  return;
};


async function updateLegendPreviousSeason(clientMongo, clientCoc, tag) {
  try {
    let mongoAcc = await clientMongo.db('jwc').collection('accounts').findOne(
      { tag: tag },
      { projection: { legend: 1, _id: 1 } }
    );

    if (mongoAcc.legend != null && mongoAcc.legend != undefined) {
      let listingUpdate = {};
      listingUpdate.legend = mongoAcc.legend;
      listingUpdate.attackWins = 0;

      const scAcc = await clientCoc.getPlayer(tag);
      listingUpdate.legend.previous = scAcc.legendStatistics == null ? null : scAcc.legendStatistics.previousSeason;

      await clientMongo.db('jwc').collection('accounts').updateOne({ _id: mongoAcc._id }, { $set: listingUpdate });
    };
  }
  catch (error) {
    console.error(error);
  };
  return;
};


async function updateMasterRoster(client, dataObject) {
  let arrPlayers = JSON.parse(dataObject.arrPlayers);
  let rtnArrPlayers = [];

  const teamAbbr = dataObject.clanAbbr.toLowerCase();
  const mongoTeam = await client.clientMongo.db('jwc').collection('clans').findOne(
    { clan_abbr: teamAbbr },
    { projection: { clan_tag: 1, _id: 0 } }
  );

  /* 1秒80リクエスト制限に引っかかる
  await Promise.all(arrPlayers.map(async (player) => {
    const scPlayer = await client.clientCoc.getPlayer(player.accTag) ?? 0;
    let scClanWar = '';
    if (scPlayer.clan != null) {
      scClanWar = await client.clientCoc.getClanWar(scPlayer.clan.tag);
    }
    else {
      scClanWar = null;
    };
    rtnArrPlayers.push({ accTag: player.accTag, pilotName: player.pilotName, rawResponse: scPlayer, scClanWar: scClanWar });
  }));
  */

  for await (const player of arrPlayers) {
    let objAccClanWar = { inClan: '', clanName: '', endTime: '' };

    let resultScan = await functions.scanAcc(client.clientCoc, player.accTag);
    if (resultScan.status == 'inMaintenance') {
      console.log(resultScan.reason);
      return;
    };
    const scPlayer = resultScan.scPlayer;

    if (scPlayer.clan != null) {
      objAccClanWar.clanName = scPlayer.clan.name;
      //console.dir(scPlayer.clan.name);

      if (scPlayer.clan.tag == mongoTeam.clan_tag) {
        objAccClanWar.inClan = 'OK';
      }
      else {
        objAccClanWar.inClan = 'NG';
      };

      try {
        let scClanWar = await client.clientCoc.getClanWar(scPlayer.clan.tag);
        //console.dir(scClanWar.endTime);
        if (scClanWar.state == 'inWar' || scClanWar.state == 'preparation') {
          if (await isInWar(scClanWar, player.accTag) == true) {
            objAccClanWar.endTime = scClanWar.endTime;
          }
          else {
            objAccClanWar.endTime = 'not in war';
          };
        }
        else {
          objAccClanWar.endTime = 'not in war';
        };
      }
      catch (error) {
        objAccClanWar.endTime = `ERROR: ${error.reason}`;
      };
    }
    else {
      objAccClanWar.inClan = 'NG';
      objAccClanWar.clanName = '(not in any clans)';
      objAccClanWar.endTime = '';
    };

    rtnArrPlayers.push({ accTag: player.accTag, pilotName: player.pilotName, scPlayer: scPlayer, objAccClanWar: objAccClanWar });
  };

  // スプレッドシートに登録
  let json = {};
  json.type = dataObject.type;
  json.ssId = dataObject.ssId;
  json.clanAbbr = dataObject.clanAbbr;
  json.arrPlayers = rtnArrPlayers;

  //if (arrPlayers.length > 0) {
  let param = {
    'method': 'POST',
    'Content-Type': 'application/json',
    'body': JSON.stringify(json),
  };
  try {
    const response = await fetch(process.env.GAS_URI, param);
    //const data = await response.json();
    //console.log(data);
  } catch (error) {
    console.error('Fetch error: ', error);
  };
  //};
};

async function isInWar(scClanWar, playerTag) {
  try {
    for (member of scClanWar.clan.members) {
      if (member.tag == playerTag) {
        return true;
      };
    };
    return false;
  }
  catch (error) {
    return "Error: " + error.toString();
  }
};


async function updateMongoAccounts(client, dataObject) {
  let arrAccounts = JSON.parse(dataObject.arrAccounts);
  for await (const acc of arrAccounts) {
    let listing = {};
    try {
      //let scPlayer = await client.clientCoc.getPlayer(player.accTag);
      let mongoAcc = await client.clientMongo.db('jwc').collection('accounts').findOne({ tag: acc.accTag });

      if (mongoAcc == null) { // 初回登録
        let pilotDC = null;
        await fMongo.registerAcc(client, acc.accTag, acc.namePilot, acc.league2, acc.clanAbbr, pilotDC);
        console.log(`New listing created: ${acc.accTag} | ${acc.namePilot}`);
      }
      else { // 追加登録（更新）
        listing.name = acc.nameAcc;
        listing.townHallLevel = acc.lvTH;
        listing.homeClanAbbr = mongoAcc.homeClanAbbr;
        listing.pilotName = mongoAcc.pilotName;
        listing.league = mongoAcc.league;
        if (acc.league1 == 'j1j2') {
          listing.homeClanAbbr.j = acc.clanAbbr;
          listing.pilotName.j = acc.namePilot;
          listing.league.j = acc.league2;
        }
        else {
          listing.homeClanAbbr[acc.league1] = acc.clanAbbr;
          listing.pilotName[acc.league1] = acc.namePilot;
          listing.league[acc.league1] = acc.league2;
        };
        await client.clientMongo.db('jwc').collection('accounts').updateOne({ tag: acc.accTag }, { $set: listing });
        console.log(`Listing updated: ${mongoAcc.name}`);
      };
    }
    catch (error) {
      console.error(error);
    };
  };
};


async function playerRegistration5v(client, dataObject) {
  let league = dataObject.league;
  let teamAbbr = dataObject.teamAbbr;
  let arrTag = JSON.parse(dataObject.arrTag);
  let arrPilot = JSON.parse(dataObject.arrPilot);
  let arrDiscordId = JSON.parse(dataObject.arrDiscordId);
  //let arrIsRegistered = JSON.parse(dataObject.arrIsRegistered);
  //let arrClanAbbrRegistered = JSON.parse(dataObject.arrClanAbbrRegistered);
  //let arrTeamAbbrLastSeason = JSON.parse(dataObject.arrTeamAbbrLastSeason);
  //let arrTeamNameLastSeason = JSON.parse(dataObject.arrTeamNameLastSeason);
  //let rtnArrPlayers = [];

  let mongoTeam = await client.clientMongo.db('jwc').collection('clans').findOne({ clan_abbr: teamAbbr });

  // discord 送信
  await Promise.all(arrTag.map(async (tag, i) => {
    let isRegistered = false;
    let title = '';
    let description = '';
    let flagNG = 0;
    if (arrTag[i] != '') {
      let myEmbed = new EmbedBuilder();
      let footerText = dataObject.team;
      myEmbed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });
      myEmbed.setColor(config.color.main);
      myEmbed.setTimestamp();
      if (arrPilot[i] == '') {
        description += `* Account Tag: ${arrTag[i]}\n`;
        myEmbed.setTitle(':question: **NO Pilot Name**');
        myEmbed.setDescription(description);
        myEmbed.setColor(config.color.red);
      }
      else if (arrDiscordId[i] == '') {
        description += `* Account Tag: ${arrTag[i]}\n`;
        myEmbed.setTitle(':question: **NO discord ID**');
        myEmbed.setDescription(description);
        myEmbed.setColor(config.color.red);
      }
      else {
        let resultScan = await functions.scanAcc(client.clientCoc, arrTag[i]);
        console.dir(`${resultScan.status}: ${arrTag[i]} | ${arrPilot[i]}`);
        if (resultScan.status == 'ok') {
          title = await functions.getAccInfoTitle(resultScan.scPlayer, formatLength = 'long');
          description += await functions.getAccInfoDescriptionMain(resultScan.scPlayer, formatLength = 'long');
          description += '\n';
          description += `Pilot Name: ${arrPilot[i]} <@!${arrDiscordId[i]}>\n`;
          //if (arrTeamAbbrLastSeason[i] != 'NO DATA' && arrTeamAbbrLastSeason[i] != dataObject.clanAbbr) {
          //  description += `Last Season: ${arrTeamNameLastSeason[i]}\n`;
          //};

          // mongo: 5vチーム登録済みかチェックする
          let mongoAcc = await client.clientMongo.db('jwc').collection('accounts').findOne({ tag: arrTag[i] });
          if (mongoAcc != null) {
            if (mongoAcc.homeClanAbbr.five != '' && mongoAcc.homeClanAbbr.five != null) {
              isRegistered = true;
            };
          };
          if (isRegistered == true) {
            title = ':x:  ' + title;
            description += `\n:exclamation: *Already Registered: ${String(mongoAcc.homeClanAbbr.five).toUpperCase()}*`;
            flagNG = 1;
            myEmbed.setColor(config.color.red);
          }
          else if (detectTownHallLevel(league, resultScan.scPlayer.townHallLevel) == false) {
            title = ':x:  ' + title;
            description += '\n:exclamation: *Invalid TH Level*';
            flagNG = 1;
            myEmbed.setColor(config.color.red);
          };
          if (flagNG == 0) {
            description += '\n:white_check_mark: *Successfully registered*';
            let pilotDC = arrDiscordId[i];
            // mongoDB に登録
            await fMongo.registerAcc(client, arrTag[i], arrPilot[i], dataObject.league, dataObject.teamAbbr, pilotDC);
          };
          myEmbed.setTitle(title);
          myEmbed.setDescription(description);
          myEmbed.setThumbnail(mongoTeam.logo_url);
        }
        else if (resultScan.status == 'notFound') {
          description += `* Account Tag: ${arrTag[i]}\n`;
          description += `* Pilot Name: ${arrPilot[i]}\n`;
          myEmbed.setTitle(':question: **NOT FOUND**');
          myEmbed.setDescription(description);
          myEmbed.setColor(config.color.red);
        }
        else if (resultScan.status == 'error') {
          description += `* Account Tag: ${arrTag[i]}\n`;
          description += `* Pilot Name: ${arrPilot[i]}\n`;
          myEmbed.setTitle(':question: **ERROR**');
          myEmbed.setDescription(description);
          myEmbed.setColor(config.color.red);
        };
      };
      await client.channels.cache.get(config.logch.playerRegistration[dataObject.league]).send({ embeds: [myEmbed] });
    };
  }));
  if (dataObject.note != '') {
    let myEmbed = new EmbedBuilder();
    let footerText = dataObject.team;
    myEmbed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });
    myEmbed.setColor(config.color.main);
    myEmbed.setTimestamp();
    myEmbed.setTitle('**NOTE**');
    myEmbed.setDescription(dataObject.note);
    myEmbed.setColor(config.color.main);
    await client.channels.cache.get(config.logch.playerRegistration[dataObject.league]).send({ embeds: [myEmbed] });
  };

  await fMongo.teamList(client.clientMongo, league = 'five');

  return;
};


async function playerRegistration(client, dataObject) {
  //console.dir(dataObject);
  let league = dataObject.league;
  let teamAbbr = dataObject.teamAbbr;
  let arrTag = JSON.parse(dataObject.arrTag);
  let arrPilot = JSON.parse(dataObject.arrPilot);
  //let arrIsRegistered = JSON.parse(dataObject.arrIsRegistered);
  //let arrClanAbbrRegistered = JSON.parse(dataObject.arrClanAbbrRegistered);
  let isRegistered = false;
  let arrTeamAbbrLastSeason = JSON.parse(dataObject.arrTeamAbbrLastSeason);
  let arrTeamNameLastSeason = JSON.parse(dataObject.arrTeamNameLastSeason);
  let rtnArrPlayers = [];

  let mongoTeam = await client.clientMongo.db('jwc').collection('clans').findOne({ clan_abbr: teamAbbr });

  // discord 送信
  await Promise.all(arrTag.map(async (tag, i) => {
    let title = '';
    let description = '';
    let flagNG = 0;
    if (arrTag[i] != '') {
      let myEmbed = new EmbedBuilder();
      let footerText = dataObject.team;
      myEmbed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });
      myEmbed.setColor(config.color.main);
      myEmbed.setTimestamp();
      if (arrPilot[i] == '') {
        description += `* Account Tag: ${arrTag[i]}\n`;
        myEmbed.setTitle(':question: **NO PILOT NAME**');
        myEmbed.setDescription(description);
        myEmbed.setColor(config.color.red);
      }
      else {
        let resultScan = await functions.scanAcc(client.clientCoc, arrTag[i]);
        console.dir(`${resultScan.status}: ${arrTag[i]} | ${arrPilot[i]}`);
        if (resultScan.status == 'ok') {
          title = await functions.getAccInfoTitle(resultScan.scPlayer, formatLength = 'long');
          description += await functions.getAccInfoDescriptionMain(resultScan.scPlayer, formatLength = 'long');
          description += '\n';
          description += `Pilot Name: ${arrPilot[i]}\n`;
          if (arrTeamAbbrLastSeason[i] != 'NO DATA' && arrTeamAbbrLastSeason[i] != dataObject.clanAbbr) {
            description += `Last Season: ${arrTeamNameLastSeason[i]}\n`;
          };

          // mongo: チーム登録済みかチェックする
          let mongoAcc = await client.clientMongo.db('jwc').collection('accounts').findOne({ tag: arrTag[i] });
          if (mongoAcc != null) {
            let leagueM = league;
            if (league.includes('j')) {
              leagueM = 'j';
            };
            if (mongoAcc.homeClanAbbr[leagueM] != '' && mongoAcc.homeClanAbbr[leagueM] != null) {
              isRegistered = true;
            };
          };
          if (isRegistered == true) {
            title = ':x:  ' + title;
            description += `\n:exclamation: *Already Registered: ${String(mongoAcc.homeClanAbbr[leagueM]).toUpperCase()}*`;
            flagNG = 1;
            myEmbed.setColor(config.color.red);
          }
          else if (detectTownHallLevel(league, resultScan.scPlayer.townHallLevel) == false) {
            title = ':x:  ' + title;
            description += '\n:exclamation: *Invalid TH Level*';
            flagNG = 1;
            myEmbed.setColor(config.color.red);
          };
          if (flagNG == 0) {
            description += '\n:white_check_mark: *Successfully registered*';
            rtnArrPlayers.push([arrPilot[i], arrTag[i]]);
            let pilotDC = null;
            // mongoDB に登録
            await fMongo.registerAcc(client, arrTag[i], arrPilot[i], league, teamAbbr, pilotDC);
          };
          myEmbed.setTitle(title);
          myEmbed.setDescription(description);
          myEmbed.setThumbnail(mongoTeam.logo_url);
        }
        else if (resultScan.status == 'notFound') {
          description += `* Account Tag: ${arrTag[i]}\n`;
          description += `* Pilot Name: ${arrPilot[i]}\n`;
          myEmbed.setTitle(':question: **NOT FOUND**');
          myEmbed.setDescription(description);
          myEmbed.setColor(config.color.red);
        }
        else if (resultScan.status == 'error') {
          description += `* Account Tag: ${arrTag[i]}\n`;
          description += `* Pilot Name: ${arrPilot[i]}\n`;
          myEmbed.setTitle(':question: **ERROR**');
          myEmbed.setDescription(description);
          myEmbed.setColor(config.color.red);
        };
      };
      await client.channels.cache.get(config.logch.playerRegistration[dataObject.league]).send({ embeds: [myEmbed] });
    };
  }));
  if (dataObject.note != '') {
    let myEmbed = new EmbedBuilder();
    let footerText = dataObject.team;
    myEmbed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });
    myEmbed.setColor(config.color.main);
    myEmbed.setTimestamp();
    myEmbed.setTitle('**NOTE**');
    myEmbed.setDescription(dataObject.note);
    myEmbed.setColor(config.color.main);
    await client.channels.cache.get(config.logch.playerRegistration[dataObject.league]).send({ embeds: [myEmbed] });
  };

  // スプレッドシートに登録
  let json = {};
  json.league = league;
  json.teamAbbr = teamAbbr;
  json.arrPlayers = rtnArrPlayers;
  if (rtnArrPlayers.length > 0) {
    let param = {
      'method': 'POST',
      'Content-Type': 'application/json',
      'body': JSON.stringify(json),
    };
    try {
      const response = await fetch(process.env.GAS_URI, param);
      const data = await response.json();
      console.log(data);
    } catch (error) {
      console.error('Fetch error: ', error);
    };
  };

  await fMongo.teamList(client.clientMongo, league);

  return;
};

function detectTownHallLevel(league, lvTownHall) {
  if (league == 'j1' || league == 'j2' || league == 'swiss' || league == 'five') {
    if (lvTownHall == config.lvTH) {
      return true;
    };
  }
  else if (league == 'mix') {
    if (config.lvTHmix.includes(lvTownHall)) {
      return true;
    };
  };
  return false;
};


async function playerEditing(client, dataObject) {
  let myEmbed = new EmbedBuilder();

  let footerText = dataObject.team;
  myEmbed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });

  let title = '';
  let description = '';

  console.dir(`${dataObject.action}: ${dataObject.playerTag} | ${dataObject.pilotName}`);

  let resultScan = await functions.scanAcc(client.clientCoc, dataObject.playerTag);

  if (dataObject.error == 'error') {
    title = `:x: **ERROR**`;
    description += `* Account tag: ${dataObject.playerTag}\n`;
    description += `* Pilot Name: ${dataObject.pilotName}\n`;
    description += '\n';
    description += `*Invalid password was inputted.*`;
  }
  else {
    if (resultScan.status == 'ok') {
      title = await functions.getAccInfoTitle(resultScan.scPlayer, formatLength = 'long');
      description += await functions.getAccInfoDescriptionMain(resultScan.scPlayer, formatLength = 'long');

      description += '\n';
      description += `Pilot Name: ${dataObject.pilotName}\n`;
      let listing = {};
      if (dataObject.action == 'remove') {
        await fMongo.deleteRoster(client.clientMongo, dataObject.league, dataObject.playerTag);
        description += '\n';
        description += `:white_check_mark: _Successfully removed_\n`;
      }
      else if (dataObject.action == 'change') {
        listing.pilotName = mongoAcc.pilotName;
        if (dataObject.league == 'j1j2' || dataObject.league == 'j1' || dataObject.league == 'j2') {
          listing.pilotName.j = dataObject.pilotName;
        }
        else {
          listing.pilotName[dataObject.league] = dataObject.pilotName;
        };
        client.clientMongo.db('jwc').collection('accounts')
          .updateOne({ tag: dataObject.playerTag }, { $set: listing });
        description += '\n';
        description += `:white_check_mark: _Pilot name changed_\n`;
      };
      myEmbed.setColor(config.color.main);
    }
    else if (resultScan.status == 'notFound') {
      title = `:x: **${resultScan.status}**`;
      description = `*Invalid tag was inputted.*`;
      myEmbed.setColor(config.color.red);
    }
    else {
      title = `:x: **${resultScan.status}**`;
      description = `*Please try again later.*`;
      myEmbed.setColor(config.color.red);
    };
  };

  myEmbed.setTitle(title);
  myEmbed.setDescription(description);
  myEmbed.setTimestamp();
  await client.channels.cache.get(config.logch.playerRegistration[dataObject.league]).send({ embeds: [myEmbed] });

  if (dataObject.note != '') {
    myEmbed.setTitle('**NOTE**');
    myEmbed.setDescription(dataObject.note);
    await client.channels.cache.get(config.logch.playerRegistration[dataObject.league]).send({ embeds: [myEmbed] });
  };
};


async function bet(client, dataObject) {
  const myEmbed = new EmbedBuilder();
  if (dataObject.embedTitle != '' && dataObject.title != null) {
    myEmbed.setTitle(dataObject.embedTitle);
  };
  let footerText = `${config.footer}  |  ${dataObject.footer}`;
  myEmbed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });
  myEmbed.setColor(config.color.main);
  let description = dataObject.description.replace(/,/g, '\n');
  if (dataObject.discordId != '' && dataObject.discordId != null) {
    description += `<@!${dataObject.discordId}>`;
  };
  myEmbed.setDescription(description);

  client.channels.cache.get(config.logch.bet).send({ embeds: [myEmbed] });

  // DM
  if (dataObject.discordId != '') {
    let senderBet = await client.users.fetch(dataObject.discordId);
    let message = '';
    JSON.parse(dataObject.fields).forEach(function(value) {
      message += `**${value.title}**: ${value.response}\n`;
    });
    message += `\n`;
    message += `${dataObject.embedTitle}\n`;
    message += `*${dataObject.formTitle}*\n`;
    senderBet.send(message);
  };
};















