import { EmbedBuilder } from 'discord.js';
import querystring from 'querystring';
import config from '../config/config.js';
import * as functions from './functions.js';


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
export { post };


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
  
  const channel = await client.channels.fetch(idCh).catch(() => null);
  if (!channel) {
    throw new Error(`Channel not found / no access: idCh=${idCh}`);
  }
  if (!channel.isTextBased()) {
    throw new Error(`Channel is not text-based: idCh=${idCh}, type=${channel.type}`);
  }
  await channel.send({ embeds: [myEmbed] });

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
  await functions.safeSend(client, config.logch.calendar, { embeds: [embed] }, "calendar");

  return;
};









