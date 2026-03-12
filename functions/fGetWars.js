const { EmbedBuilder, AttachmentBuilder } = require("discord.js");

const config = require("../config.js");
const config_coc = require("../config_coc.js");
const schedule = require("../schedule.js");
const fScore = require("./fScore.js");
const functions = require("./functions.js");
const fMongo = require("./fMongo.js");
const fCanvas = require("./fCanvas.js");
const post = require("./post.js");

/*
async function autoUpdate(client, league, week) {
  const cursor = client.clientMongo.db('jwc').collection('wars')
    .find({ season: config.season[league], league: league, week: week, 'result.state': { $ne: 'warEnded' } });
  let mongoWars = await cursor.toArray();
  await cursor.close();
  let sumFlagUpdate = 0;
  // 対戦情報取得 & データベース更新
  await Promise.all(mongoWars.map(async (mongoWar) => {
    result = await getClanWarUpdateDB(client, mongoWar);
    //console.dir(result);
    sumFlagUpdate += result;
  }));
  //console.dir(`sumFlagUpdate: ${sumFlagUpdate} [${league}]`);
  if (sumFlagUpdate > 0) {
    functions.updateWarInfo(client, league, week);
    //console.dir(`end: fCreateJSON.currentWeek [${league}]`);
  };
};
exports.autoUpdate = autoUpdate;
*/

async function getClanWarUpdateDB(client, mongoWar) {
  let clanWar = "";
  let clanWarOpp = "";
  let flagError = 0;

  const league = mongoWar.league;
  const week = mongoWar.week;
  const match = mongoWar.match;
  const clanAbbr = mongoWar.clan_abbr;
  const clanAbbrOpp = mongoWar.opponent_abbr;

  const mongoClan = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne(
      { clan_abbr: mongoWar.clan_abbr },
      { projection: { clan_tag: 1, team_name: 1, log: 1, rep_1st: 1, rep_2nd: 1, rep_3rd: 1, _id: 0 } }
    );
  const mongoClanOpp = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne(
      { clan_abbr: mongoWar.opponent_abbr },
      { projection: { clan_tag: 1, team_name: 1, log: 1, rep_1st: 1, rep_2nd: 1, rep_3rd: 1, _id: 0 } }
    );

  const clanTag = mongoClan.clan_tag;
  const clanTagOpp = mongoClanOpp.clan_tag;
  const teamName = mongoClan.team_name;
  const teamNameOpp = mongoClanOpp.team_name;

  // db確認
  if (mongoWar.clan_war != "") {
    if (mongoWar.clan_war.state == "warEnded") {
      // 終わった対戦は更新しない
      //console.dir(`[${league}-w${week}] warEnded: ${teamName} vs ${teamNameOpp}`);
      return 0;
    } else if (mongoWar.result.state == "warEnded") {
      // 手動でwarEndedにしたやつ
      //console.dir(`[${league}-w${week}] warEnded: ${teamName} vs ${teamNameOpp}`);
      return 0;
    } else {
    }
  }

  try {
    clanWar = await client.clientCoc.getClanWar(clanTag);
  } catch (error) {
    flagError = 1;
  }

  try {
    clanWarOpp = await client.clientCoc.getClanWar(clanTagOpp);
  } catch (error) {
    flagError = 2;
  }

  //console.dir(`[${league}-w${week}-m${match}] ${teamName}: ${clanWar.state}`);
  //console.dir(`[${league}-w${week}-m${match}] ${teamNameOpp}: ${clanWarOpp.state}`);
  //console.dir(`[${league}-w${week}-m${match}] ${teamName}: ${clanWar.state}, ${teamNameOpp}: ${clanWarOpp.state}`);

  if (flagError > 0) {
    console.dir(`[${league}-w${week}] erorr: ${teamName} vs ${teamNameOpp}`);
    return 0;
  }

  let flagUpdate = 0;
  let mongoWarUpdated = {};
  // db更新
  if (clanWar == null || clanWarOpp == null) {
    console.error(`[${league}-w${week}] erorr2: ${teamName} vs ${teamNameOpp}`);
    return 0;
  } else if (clanWar.state == "notInWar" || clanWarOpp.state == "notInWar") {
    //console.dir(`[${league}-w${week}] notInWar: ${teamName} vs ${teamNameOpp}`);
    return 0;
  } else {
    if (
      clanWar.opponent.tag == clanWarOpp.clan.tag &&
      clanWarOpp.opponent.tag == clanWar.clan.tag
    ) {
      if (mongoWar.war_type == null) {
        if (league == "j1" || league == "j2") {
          //if (clanWar.clan.members.length < config.minSize[league]) {
          if (clanWar.clan.members.length < 15) {
            return flagUpdate;
          }
        } else if (league == "swiss" || league == "mix" || league == "five") {
          if (clanWar.clan.members.length != config.minSize[league]) {
            return flagUpdate;
          }
        }
      } else if (mongoWar.war_type == "tieBreak") {
        if (clanWar.clan.members.length != 5) {
          return flagUpdate;
        }
      }
      //console.log(`[${config.league[league]}-w${week}] ${clanWar.state}: ${teamName} vs ${teamNameOpp}`);

      // 更新前攻撃回数取得
      let nAtBefore = { clan: 0, opponent: 0 };
      if (clanWar.state == "inWar" || clanWar.state == "warEnded") {
        if (mongoWar.result != "") {
          if (
            mongoWar.result.clan != null &&
            mongoWar.result.opponent != null
          ) {
            nAtBefore.clan = mongoWar.result.clan.allAttackTypes.nAt.total;
            nAtBefore.opponent =
              mongoWar.result.opponent.allAttackTypes.nAt.total;
          }
        }
      }
      // state 判定 -> return
      // ********** マッチング完了（初回） -> データベース更新、通知 **********
      if (mongoWar.result == "") {
        if (client != "noClient") {
          [mongoWarUpdated, flagUpdate] = await dbUpdate(
            client,
            mongoWar,
            clanWar,
            clanWarOpp,
            league,
            week,
            match,
            nAtBefore,
            mongoClan,
            mongoClanOpp,
            teamName,
            teamNameOpp,
          );
          //console.dir(mongoWarUpdated);
          await sendStart(client, mongoWar, clanWar);
          //await functions.register_accs(client, league, clanAbbr, clanWar.clan.members);
          //await functions.register_accs(client, league, clanAbbrOpp, clanWarOpp.clan.members);
        }
      } else {
        // ********** 準備中 **********
        if (
          clanWar.state == "preparation" &&
          clanWarOpp.state == "preparation"
        ) {
          if (client != "noClient") {
            //dbUpdate(clientMongo, client, mongoWar, clanWar, clanWarOpp, league, week, match, nAtBefore, logChIdLocal, teamName, teamNameOpp);
            //await fCreateJSON.currentWeek();
            //console.dir(`end: fCreateJSON.currentWeek`);
          }
        }
        // ********** 対戦中 -> データベース更新 **********
        else if (clanWar.state == "inWar") {
          if (client != "noClient") {
            [mongoWarUpdated, flagUpdate] = await dbUpdate(
              client,
              mongoWar,
              clanWar,
              clanWarOpp,
              league,
              week,
              match,
              nAtBefore,
              mongoClan,
              mongoClanOpp,
              teamName,
              teamNameOpp,
            );
          }
        }
        // ********** 終戦 -> データベース更新、通知 **********
        else if (
          clanWar.state == "warEnded" &&
          clanWarOpp.state == "warEnded"
        ) {
          if (client != "noClient") {
            console.dir(
              `warEnded: [${league}-w${week}-m${match}] ${teamName} vs ${teamNameOpp}`,
            );
            [mongoWarUpdated, flagUpdate] = await dbUpdate(
              client,
              mongoWar,
              clanWar,
              clanWarOpp,
              league,
              week,
              match,
              nAtBefore,
              mongoClan,
              mongoClanOpp,
              teamName,
              teamNameOpp,
            );
            console.dir(`end: dbUpdate`);
            await fScore.updateScoreAccs(
              client.clientMongo,
              config.season[league],
              league,
              week,
              mongoWarUpdated.clan_war.clan.members,
              mongoWarUpdated.opponent_war.clan.members,
            );
            await fScore.updateScoreAccs(
              client.clientMongo,
              config.season[league],
              league,
              week,
              mongoWarUpdated.opponent_war.clan.members,
              mongoWarUpdated.clan_war.clan.members,
            );
            console.dir(`end: fScore.updateScoreAccs`);
            await fScore.calcStatsAccs(
              client.clientMongo,
              league,
              clanAbbr,
              config.season[league],
            );
            await fScore.calcStatsAccs(
              client.clientMongo,
              league,
              clanAbbrOpp,
              config.season[league],
            );
            console.dir(`end: fScore.calcStatsAccs`);
            await fScore.autoUpdate(client.clientMongo, league);
            console.dir(`end: fScore.autoUpdate`);
            /*
            await fCreateJSON.teamInfo(client.clientMongo, league);
            console.dir(`end: fCreateJSON.teamInfo [${league}]`);
            await fCreateJSON.teamData(client.clientMongo, league);
            console.dir(`end: fCreateJSON.teamData [${league}]`);
            await fCreateJSON.tablePlayers(client.clientMongo, league);
            console.dir(`end: fCreateJSON.tablePlayers [${league}]`);
            await fCreateJSON.tableWars(client.clientMongo, league);
            console.dir(`end: fCreateJSON.tableWars [${league}]`);
            await fCreateJSON.tableStandings(client.clientMongo, league);
            console.dir(`end: fCreateJSON.tableStandings [${league}]`);
            await fCreateJSON.leagueStats(client.clientMongo, league);
            console.dir(`end: fCreateJSON.leagueStats [${league}]`);
            */
            await fMongo.statsPlayer(client.clientMongo);
            console.dir(`end: fMongo.statsPlayer`);
            await sendEnd(client, mongoWarUpdated);
            await fMongo.standings(client.clientMongo, league);
            if (league == "five") {
              await fMongo.standingsGroupStage(
                client.clientMongo,
                league,
                "a",
                "b",
              );
            } else if (league == "j1") {
              await fMongo.standingsGroupStage(
                client.clientMongo,
                league,
                "fist",
                "cloak",
              );
            }
            if (league == "mix") {
              for (const lvTH of config.lvTHmix) {
                await functions.updateRankingJwcAttack(client, league, lvTH);
              }
            } else {
              await functions.updateRankingJwcAttack(
                client,
                league,
                config.lvTH,
              );
            }
          }
        }
      }
      flagUpdate = 1;
    } else {
      //console.dir(`[${league}-w${week}] notInWar: ${teamName} vs ${teamNameOpp}`);
    }
  }

  return flagUpdate;
}
exports.getClanWarUpdateDB = getClanWarUpdateDB;

async function sendStart(client, mongoWar, clanWar) {
  const league = mongoWar.league;
  const week = mongoWar.week;
  const weekStr = "w" + week;
  const match = mongoWar.match;
  const matchStr = "m" + match;

  const mongoClan = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: mongoWar.clan_abbr });
  const mongoClanOpp = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: mongoWar.opponent_abbr });

  // ********** 時間計算 **********
  let prepTimeMinute = Math.round(
    (clanWar.startTime - clanWar.preparationStartTime) / (60 * 1000),
  );
  let prepTimeStr = "";
  if (prepTimeMinute >= 60) {
    prepTimeStr = `${Math.round(prepTimeMinute / 60)}h`;
  } else {
    prepTimeStr = `${prepTimeMinute}m`;
  }
  let warTimeMinute = Math.round(
    (clanWar.endTime - clanWar.startTime) / (60 * 1000),
  );
  let warTimeStr = "";
  if (warTimeMinute >= 60) {
    warTimeStr = `${Math.round(warTimeMinute / 60)}h`;
  } else {
    warTimeStr = `${warTimeMinute}m`;
  }

  let embed = new EmbedBuilder();
  embed.setColor(config.color[league]);
  embed.setTitle(":arrow_forward: **WAR DECLARED**");
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  let description = "";
  description += `${config.leaguePlusEmote[league]}  |  ${schedule.week[weekStr]}\n`;
  description += `${mongoClan.team_name} :vs: ${mongoClanOpp.team_name}\n`;
  description += `\n`;
  description += `:hourglass_flowing_sand: ${prepTimeStr} / :crossed_swords: ${warTimeStr}\n`;
  description += `\n`;

  let description1 =
    description + `* Attack Log: <#${config.attacklogch[league][matchStr]}>\n`;
  embed.setDescription(description1);
  client.channels.cache.get(config.warlogch[league]).send({ embeds: [embed] });

  let descriptionCommands = ``;
  descriptionCommands += `${config.emote.discord} </war live:${config.command["war"].id}>\n`;
  descriptionCommands += `${config.emote.discord} </war lineup:${config.command["war"].id}>\n`;
  descriptionCommands += `${config.emote.discord} </war attacks:${config.command["war"].id}>\n`;
  descriptionCommands += `${config.emote.discord} </info league_standings:${config.command["info"].id}>\n`;
  descriptionCommands += `${config.emote.discord} </help commands:${config.command["help"].id}>\n`;

  if (mongoClan.log?.start?.switch == "on") {
    let description2 = description + `_Try running the following commands_`;
    if (mongoClan.log?.main?.switch == "on") {
      description2 += ` _in_ <#${mongoClan.log.main.channel_id}>\n`;
      description2 += `${config.emote.discord} </war own:${config.command["war"].id}>\n`;
    }
    description2 += `\n` + descriptionCommands;
    embed.setDescription(description2);
    client.channels.cache
      .get(mongoClan.log.start.channel_id)
      .send({ embeds: [embed] });
  }
  if (mongoClanOpp.log?.start?.switch == "on") {
    let description2 = description + `_Try running the following commands_`;
    if (mongoClanOpp.log?.main?.switch == "on") {
      description2 += ` _in_ <#${mongoClanOpp.log.main.channel_id}>\n`;
      description2 += `${config.emote.discord} </war own:${config.command["war"].id}>\n`;
    }
    description2 += `\n` + descriptionCommands;
    embed.setDescription(description2);
    client.channels.cache
      .get(mongoClanOpp.log.start.channel_id)
      .send({ embeds: [embed] });
  }
}
exports.sendStart = sendStart;

async function sendEnd(client, mongoWar) {
  const league = mongoWar.league;
  const week = mongoWar.week;
  const weekStr = "w" + week;
  const match = mongoWar.match;
  const matchStr = "m" + match;

  const mongoClan = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: mongoWar.clan_abbr });
  const mongoClanOpp = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: mongoWar.opponent_abbr });

  let myContent = ``;
  myContent += `<@!${mongoClan.rep_1st.id}> <@!${mongoClan.rep_2nd.id}>`;
  if (mongoClan.rep_3rd != null && mongoClan.rep_3rd != "non-registered") {
    myContent += ` <@!${mongoClan.rep_3rd.id}>`;
  }
  myContent += `\n`;
  myContent += `<@!${mongoClanOpp.rep_1st.id}> <@!${mongoClanOpp.rep_2nd.id}>`;
  if (
    mongoClanOpp.rep_3rd != null &&
    mongoClanOpp.rep_3rd != "non-registered"
  ) {
    myContent += ` <@!${mongoClanOpp.rep_3rd.id}>`;
  }
  myContent += `\n`;
  myContent += `対戦お疲れ様でした！\n`;
  myContent += `両チーム、JWC 本部サーバーの結果報告チャンネルに対戦結果のスクリーンショットの投稿をお願いいたします。\n`;
  myContent += `<#${config.resultCh[league]}>\n`;
  if (league == "swiss") {
    myContent += `* **SWISS**\n`;
    myContent += `勝敗および__全壊数__のわかる画面\n`;
    myContent += `※ プレイヤーの攻撃結果がわかる画面は必要ありません\n`;
  } else {
    myContent += `* **${config.league[league]}**\n`;
    myContent += `勝敗のわかる画面\n`;
    myContent += `プレイヤー全員の攻撃結果がわかる画面\n`;
  }
  myContent += `\n`;
  for (let i = 0; i < config.season[league]; i++) {
    myContent += `:small_orange_diamond:`;
  }
  myContent += `\n`;

  let embed = new EmbedBuilder();
  embed.setColor(config.color[league]);
  embed.setTitle(":checkered_flag: **WAR HAS ENDED**");
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  let description = "";
  description += `${config.leaguePlusEmote[league]}  |  ${schedule.week[weekStr]}\n`;
  description += `${mongoClan.team_name} :vs: ${mongoClanOpp.team_name}\n`;
  description += `\n`;

  let description1 =
    description + `* Attack Log: <#${config.attacklogch[league][matchStr]}>\n`;
  embed.setDescription(description1);
  client.channels.cache.get(config.warlogch[league]).send({ embeds: [embed] });

  mongoWar.result.state = "warEnded";
  const embed2 = await createEmbedWarStats(
    client.clientMongo,
    league,
    mongoWar,
    mongoClan,
    mongoClanOpp,
  );
  let attachment = await fCanvas.warProgress(mongoWar);

  //var nameCommand = 'war own';
  //let description2 = description + `* </${nameCommand}:${config.command['war'].id}> to see stats of the war\n`;
  //embed.setDescription(description2);

  const negoChannel = client.channels.cache.get(mongoWar.nego_channel);
  negoChannel.send({ content: myContent, embeds: [embed] });
  negoChannel.send({ embeds: [embed2] });
  negoChannel.send({ files: [attachment] });

  if (mongoClan.log?.end?.switch == "on") {
    const teamChannel = client.channels.cache.get(mongoClan.log.end.channel_id);
    if (teamChannel) {
      teamChannel.send({ embeds: [embed] });
      teamChannel.send({ embeds: [embed2] });
      teamChannel.send({ files: [attachment] });
    }
  }
  if (mongoClanOpp.log?.end?.switch == "on") {
    const teamChannelOpp = client.channels.cache.get(
      mongoClanOpp.log.end.channel_id,
    );
    if (teamChannelOpp) {
      teamChannelOpp.send({ embeds: [embed] });
      teamChannelOpp.send({ embeds: [embed2] });
      teamChannelOpp.send({ files: [attachment] });
    }
  }

  let newChName = negoChannel.name.replace("✅", "🏁");
  let guild = null;
  if (league == "five") {
    guild = await client.guilds.fetch(config.guildId.jwc5v);
  } else {
    guild = await client.guilds.fetch(config.guildId.jwcReps);
  }
  guild.channels.edit(mongoWar.nego_channel, { name: newChName });
}
exports.sendEnd = sendEnd;

async function dbUpdate(
  client,
  mongoWar,
  clanWar,
  clanWarOpp,
  league,
  week,
  match,
  nAtBefore,
  mongoClan,
  mongoClanOpp,
  teamName,
  teamNameOpp,
) {
  const unixTime = Math.round(Date.now() / 1000);

  let result = new Object();
  let arrAttacks = [];
  let arrPlayers = [];
  let flagUpdate = 0;

  if (clanWar.state == "notInWar") {
    flagUpdate = 0;
    return [mongoWar, flagUpdate];
  } else if (clanWar.state == "preparation") {
    result.state = clanWar.state;
    flagUpdate = 1;
  } else if (clanWar.state == "inWar" || clanWar.state == "warEnded") {
    if (
      clanWar.clan.attackCount == nAtBefore.clan &&
      clanWar.opponent.attackCount == nAtBefore.opponent &&
      clanWar.state == "inWar"
    ) {
      flagUpdate = 0;
      return [mongoWar, flagUpdate];
    }

    if (mongoWar.result.state == "preparation") {
      flagUpdate = 1;
    }

    if (clanWar.state == "warEnded") {
      flagUpdate = 1;
    }

    const size = clanWar.teamSize;
    const apm = clanWar.attacksPerMember;

    let nOneDefense = { clan: 0, opponent: 0 };

    // 攻撃データ整理
    if (clanWar.clan.members) {
      await Promise.all(
        clanWar.clan.members.map(async (member) => {
          arrPlayers.push({
            clanType: "offense",
            tag: member.tag,
            name: member.name,
            townHallLevel: member.townHallLevel ?? member.townhallLevel,
          });
          if (!member.attacks) {
            arrAttacks = await writeClanWarAttack(
              client,
              league,
              arrAttacks,
              member,
              0,
              0,
              "attack",
            );
            if (apm == 2) {
              arrAttacks = await writeClanWarAttack(
                client,
                league,
                arrAttacks,
                member,
                1,
                0,
                "attack",
              );
            }
          } else {
            if (member.attacks.length > 0) {
              arrAttacks = await writeClanWarAttack(
                client,
                league,
                arrAttacks,
                member,
                0,
                1,
                "attack",
              );
            } else {
              arrAttacks = await writeClanWarAttack(
                client,
                league,
                arrAttacks,
                member,
                0,
                0,
                "attack",
              );
            }
            if (member.attacks.length > 1) {
              arrAttacks = await writeClanWarAttack(
                client,
                league,
                arrAttacks,
                member,
                1,
                1,
                "attack",
              );
            } else if (apm == 2) {
              arrAttacks = await writeClanWarAttack(
                client,
                league,
                arrAttacks,
                member,
                1,
                0,
                "attack",
              );
            }
          }
          if (member.defenseCount == 1) {
            nOneDefense.opponent += 1;
          }
        }),
      );
    }
    if (clanWarOpp.clan.members) {
      await Promise.all(
        clanWarOpp.clan.members.map(async (member) => {
          arrPlayers.push({
            clanType: "defense",
            tag: member.tag,
            name: member.name,
            townHallLevel: member.townHallLevel ?? member.townhallLevel,
          });
          if (!member.attacks) {
            arrAttacks = await writeClanWarAttack(
              client,
              league,
              arrAttacks,
              member,
              0,
              0,
              "defense",
            );
            if (apm == 2) {
              arrAttacks = await writeClanWarAttack(
                client,
                league,
                arrAttacks,
                member,
                1,
                0,
                "defense",
              );
            }
          } else {
            if (member.attacks.length > 0) {
              arrAttacks = await writeClanWarAttack(
                client,
                league,
                arrAttacks,
                member,
                0,
                1,
                "defense",
              );
            } else {
              arrAttacks = await writeClanWarAttack(
                client,
                league,
                arrAttacks,
                member,
                0,
                0,
                "defense",
              );
            }
            if (member.attacks.length > 1) {
              arrAttacks = await writeClanWarAttack(
                client,
                league,
                arrAttacks,
                member,
                1,
                1,
                "defense",
              );
            } else if (apm == 2) {
              arrAttacks = await writeClanWarAttack(
                client,
                league,
                arrAttacks,
                member,
                1,
                0,
                "defense",
              );
            }
          }
          if (member.defenseCount == 1) {
            nOneDefense.clan += 1;
          }
        }),
      );
    }

    arrAttacks.sort((a, b) => a.order - b.order);

    let arrAttacksPlus = []; // 初見/非初見判定等込み
    let resultClan = {};
    let resultOpponent = {};
    [arrAttacksPlus, resultClan, resultOpponent] = await createResult(
      arrAttacks,
      arrPlayers,
      clanWar.state,
      mongoWar.result,
    );

    resultClan.stars = clanWar.clan.stars;
    resultOpponent.stars = clanWarOpp.clan.stars;
    resultClan.destruction = Math.round(clanWar.clan.destruction * 100) / 100;
    resultOpponent.destruction =
      Math.round(clanWarOpp.clan.destruction * 100) / 100;
    resultClan.nLeft = size * apm - clanWar.clan.attackCount;
    resultOpponent.nLeft = size * apm - clanWarOpp.clan.attackCount;
    resultClan.nOneDefense = nOneDefense.opponent;
    resultOpponent.nOneDefense = nOneDefense.clan;

    // 追加防衛ポイント（2回目攻められず）
    if (mongoWar.war_type != "tieBreak") {
      if (clanWar.state == "warEnded" && clanWarOpp.state == "warEnded") {
        resultClan.ptDefSum += 2 * resultClan.nOneDefense;
        resultOpponent.ptDefSum += 2 * resultOpponent.nOneDefense;
        if (resultClan.nOneDefense > 0) {
          resultClan.ptDef2 = 2 * resultClan.nOneDefense;
          resultClan.note2 = `${2 * resultClan.nOneDefense} defense points added`;
        }
        if (resultOpponent.nOneDefense > 0) {
          resultOpponent.ptDef2 = 2 * resultOpponent.nOneDefense;
          resultOpponent.note2 = `${2 * resultOpponent.nOneDefense} defense points added`;
        }
      }
    }

    // ペナルティ
    let note = "";
    if (clanWar.clan.penalty != null) {
      if (
        clanWar.clan.penalty.star != null &&
        clanWar.clan.penalty.defPoint == null
      ) {
        resultClan.stars += clanWar.clan.penalty.star;
        if (clanWar.clan.penalty.star == -1) {
          note = `1 star deducted`;
        } else {
          note = `${-clanWar.clan.penalty.star} stars deducted`;
        }
      } else if (
        clanWar.clan.penalty.star == null &&
        clanWar.clan.penalty.defPoint != null
      ) {
        resultClan.ptDefSum += clanWar.clan.penalty.defPoint;
        if (clanWar.clan.penalty.defPoint == 1) {
          note = `1 defense point added`;
        } else {
          note = `${clanWar.clan.penalty.defPoint} defense points added`;
        }
      } else if (
        clanWar.clan.penalty.star != null &&
        clanWar.clan.penalty.defPoint != null
      ) {
        resultClan.stars += clanWar.clan.penalty.star;
        resultClan.ptDefSum += clanWar.clan.penalty.defPoint;
        if (clanWar.clan.penalty.star == -1) {
          note = `1 star deducted`;
        } else {
          note = `${-clanWar.clan.penalty.star} stars deducted`;
        }
        note += " / ";
        if (clanWar.clan.penalty.defPoint == 1) {
          note += `1 defense point added`;
        } else {
          note += `${clanWar.clan.penalty.defPoint} defense points added`;
        }
      }
      if (clanWar.clan.penalty.destruction != null) {
        resultClan.destruction += clanWar.clan.penalty.destruction;
        note += ` / ${-clanWar.clan.penalty.destruction}% deducted`;
      }
      resultClan.note = note;
    }
    if (clanWarOpp.clan.penalty != null) {
      if (
        clanWarOpp.clan.penalty.star != null &&
        clanWarOpp.clan.penalty.defPoint == null
      ) {
        resultOpponent.stars += clanWarOpp.clan.penalty.star;
        if (clanWarOpp.clan.penalty.star == -1) {
          note = `1 star deducted`;
        } else {
          note = `${-clanWarOpp.clan.penalty.star} stars deducted`;
        }
      } else if (
        clanWarOpp.clan.penalty.star == null &&
        clanWarOpp.clan.penalty.defPoint != null
      ) {
        resultOpponent.ptDefSum += clanWarOpp.clan.penalty.defPoint;
        if (clanWarOpp.clan.penalty.defPoint == 1) {
          note = `1 defense point added`;
        } else {
          note = `${clanWarOpp.clan.penalty.defPoint} defense points added`;
        }
      } else if (
        clanWarOpp.clan.penalty.star != null &&
        clanWarOpp.clan.penalty.defPoint != null
      ) {
        resultOpponent.stars += clanWarOpp.clan.penalty.star;
        resultOpponent.ptDefSum += clanWarOpp.clan.penalty.defPoint;
        if (clanWarOpp.clan.penalty.star == -1) {
          note = `1 star deducted`;
        } else {
          note = `${-clanWarOpp.clan.penalty.star} stars deducted`;
        }
        note += " / ";
        if (clanWarOpp.clan.penalty.defPoint == 1) {
          note = `1 defense point added`;
        } else {
          note = `${clanWarOpp.clan.penalty.defPoint} defense points added`;
        }
      }
      if (clanWarOpp.clan.penalty.destruction != null) {
        resultOpponent.destruction += clanWarOpp.clan.penalty.destruction;
        note += ` / ${-clanWarOpp.clan.penalty.destruction}% deducted`;
      }
      resultOpponent.note = note;
    }

    result.season = config.season[league];
    result.league = league;
    result.week = week;
    result.match = match;
    result.state = clanWar.state;
    result.size = size;
    result.apm = apm;
    result.arrAttacksPlus = arrAttacksPlus;
    result.clan = resultClan;
    result.opponent = resultOpponent;

    // 攻撃・防衛通知
    let nAtt = [0, 0];
    for (const elem of arrAttacksPlus) {
      if (elem.attackType != "remaining") {
        if (elem.action == "attack") {
          nAtt[0] += 1;
        } else if (elem.action == "defense") {
          nAtt[1] += 1;
        }
      }
      // 更新ありの場合
      if (
        elem.order > nAtBefore.clan + nAtBefore.opponent &&
        elem.attackType != "remaining"
      ) {
        flagUpdate += 1;
        if (mongoClan.log?.att_def?.switch == "on") {
          sendAttackInfo(
            client,
            clanWar.clan.name,
            clanWar.opponent.name,
            elem,
            nAtt,
            league,
            mongoClan.log.att_def.channel_id,
            teamName,
            teamNameOpp,
          );
        }
        if (mongoClanOpp.log?.att_def?.switch == "on") {
          sendAttackInfo(
            client,
            clanWar.clan.name,
            clanWar.opponent.name,
            elem,
            nAtt,
            league,
            mongoClanOpp.log.att_def.channel_id,
            teamName,
            teamNameOpp,
          );
        }
        const matchStr = "m" + match;
        let logChId = config.attacklogch[league][matchStr];
        sendAttackInfo(
          client,
          clanWar.clan.name,
          clanWar.opponent.name,
          elem,
          nAtt,
          league,
          logChId,
          teamName,
          teamNameOpp,
        );
        if (elem.action == "attack") {
          console.dir(
            `[${league.toUpperCase()}] TH${elem.townHallLevel} ★ ${elem.stars} ${elem.destruction}% - ${teamName} | ${elem.name}`,
          );
        } else if (elem.action == "defense") {
          console.dir(
            `[${league.toUpperCase()}] TH${elem.townHallLevel} ★ ${elem.stars} ${elem.destruction}% - ${teamNameOpp} | ${elem.name}`,
          );
        }
      }
    }
  }

  //flagUpdate = 1; // on遅れて対戦中にonした場合

  if (flagUpdate > 0 && client != "noClient") {
    let query = {
      league: league,
      week: week,
      match: match,
      season: config.season[league],
    };
    let updatedListing = {};
    updatedListing = {
      clan_war: clanWar,
      opponent_war: clanWarOpp,
      result: result,
      unixTimeRequest: unixTime,
    };
    await client.clientMongo
      .db("jwc")
      .collection("wars")
      .updateOne(query, { $set: updatedListing });
    //console.dir(`end: dbupdate`);

    let mongoWarUpdated = await client.clientMongo
      .db("jwc")
      .collection("wars")
      .findOne(query);

    return [mongoWarUpdated, flagUpdate];
  } else {
    return [mongoWar, flagUpdate];
  }
}
exports.dbUpdate = dbUpdate;

async function writeClanWarAttack(
  client,
  league,
  arrAttacks,
  member,
  attackNo,
  flagAttacked,
  action,
) {
  let clanWarAttack = {};
  if (flagAttacked == 1) {
    clanWarAttack = member.attacks[attackNo];
  }
  clanWarAttack["action"] = action;
  clanWarAttack["name"] = member.name;
  clanWarAttack["attackerTag"] = member.tag;
  clanWarAttack["townHallLevel"] = member.townHallLevel ?? member.townhallLevel;
  if (flagAttacked == 0) {
    clanWarAttack["order"] = 200 + member.mapPosition;
    clanWarAttack["attackType"] = "remaining";
  }

  // pilot name
  let pilotName = "";
  const mongoAcc = await client.clientMongo
    .db("jwc")
    .collection("accounts")
    .findOne({ tag: member.tag });
  if (mongoAcc) {
    pilotName = mongoAcc.pilotName[config.leagueM[league]];
    if (pilotName == "") {
      pilotName = ":question";
    }
  } else {
    pilotName = ":question";
  }
  clanWarAttack["pilotName"] = pilotName;

  // equipment
  /*
  let arrEquipmentAll = [];
  let resultScan = await functions.scanAcc(client.clientCoc, member.tag);

  if (resultScan.scPlayer) {
    resultScan.scPlayer.heroes.map((hero) => {
      if (hero.village == 'home') {
        let objHero = {};
        objHero.name = hero.name;
        if (hero.equipment) {
          let arrEquipment = [];
          hero.equipment.map((equipment) => {
            arrEquipment.push(equipment.name);
          });
          objHero.equipment = arrEquipment;
        };
        arrEquipmentAll.push(objHero);
      };
    });
  }
  else {
    console.error(`[${league.toUpperCase()}] ${member.name} (${member.tag}) not found`);
    arrEquipmentAll.push({ name: ':question' });
  }
  clanWarAttack['equipment'] = arrEquipmentAll;
  */

  arrAttacks.push(clanWarAttack);
  return arrAttacks;
}

async function sendAttackInfo(
  client,
  nameClan,
  nameClanOpp,
  dataAttack,
  nAtt,
  league,
  logChId,
  teamName,
  teamNameOpp,
) {
  let stars = [];
  for (i = 0; i < 3; i++) {
    if (dataAttack.arrStarsFlag[i] == 2) {
      stars[i] = config.emote.star;
    } else if (dataAttack.arrStarsFlag[i] == 1) {
      stars[i] = config.emote.starShaded;
    } else if (dataAttack.arrStarsFlag[i] == 0) {
      stars[i] = config.emote.starGray;
    } else if (dataAttack.arrStarsFlag[i] == 3) {
      stars[i] = config.emote.starRed;
    }
  }
  let destruction = dataAttack.destruction;
  let left = 180 - dataAttack.duration;
  let nDef = dataAttack.nDef;
  let ptDef = dataAttack.ptDef;

  let description = "";
  if (destruction == 100) {
    description += ":boom: ";
  }
  if (dataAttack.action == "attack") {
    description += `${config.emote.thn[dataAttack.townHallLevel]} ${config.emote.sword} ${config.emote.thn[dataAttack.townHallLevelDef]} `;
  } else if (dataAttack.action == "defense") {
    description += `${config.emote.thn[dataAttack.townHallLevelDef]} ${config.emote.sword2} ${config.emote.thn[dataAttack.townHallLevel]} `;
  }
  description += `_${left}″ left_\n`;
  let namePlayerAtt = dataAttack.name
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_");
  let namePlayerDef = dataAttack.namePlayerDef
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_");
  if (dataAttack.action == "attack") {
    description += `${namePlayerAtt} ${config.emote.arrowAtt} ${namePlayerDef}\n`;
  } else if (dataAttack.action == "defense") {
    description += `${namePlayerDef} ${config.emote.arrowDef} ${namePlayerAtt}\n`;
  }
  description += `\n`;

  let existsNote = false;
  if (nDef > 1) {
    description += `${config.emote.shield} `;
    if (destruction == 100) {
      description += `(${nDef} defs)`;
    } else {
      description += `${nDef} defs`;
      for (i = 0; i < nDef; i++) {
        description += `!`;
      }
    }
    description += `\n`;
    existsNote = true;
  } else if (nDef == 1) {
    if (destruction == 100) {
      description += `${config.emote.shield} `;
      description += `(${nDef} def)\n`;
      existsNote = true;
    }
  }
  if (league == "mix" && ptDef > 0) {
    description += `${config.emote.star} _+${ptDef} def pt._\n`;
    existsNote = true;
  }
  if (destruction != 100 && dataAttack.attackType == "overkill") {
    description += `(overkill def!)\n`;
    existsNote = true;
  }
  if (existsNote) {
    description += `\n`;
  }

  // equipment
  //let resultScan = await functions.scanAcc(client.clientCoc, dataAttack.attackerTag);
  //description += await functions.getAccInfoDescriptionHeroes(resultScan.scPlayer, showAllEquipment = false, formatLength = 'log');

  let footerText = "";
  footerText += `${nAtt[0]}|${nAtt[1]} - ${teamName} vs ${teamNameOpp}`;

  let iPlayerTag = dataAttack.attackerTag;

  const dbValuePlayers = await client.clientMongo
    .db("jwc")
    .collection("accounts")
    .findOne({ tag: iPlayerTag });

  let embed = new EmbedBuilder()
    .setTitle(`${stars[0]}${stars[1]}${stars[2]}  **${destruction}%**`)
    .setDescription(description)
    .setColor(config.color[dataAttack.action])
    .setFooter({ text: footerText, iconURL: config.urlImage.jwc });
  if (dbValuePlayers != null) {
    if (
      dbValuePlayers.pilotDC != "no discord acc" &&
      dbValuePlayers.pilotDC != null
    ) {
      if (
        dbValuePlayers.pilotDC.username != null &&
        dbValuePlayers.pilotDC.avatarUrl != null
      ) {
        embed.setAuthor({
          name: dbValuePlayers.pilotDC.username,
          iconURL: dbValuePlayers.pilotDC.avatarUrl,
        });
      }
    }
  }

  let logCh = client.channels.cache.get(logChId);
  if (logCh != null && logCh != undefined) {
    logCh.send({ embeds: [embed] });
  }
}
exports.sendAttackInfo = sendAttackInfo;

async function createResult(arrAttacks, arrPlayers, state, resultOld) {
  let arrAttacksPlusOld = [];
  if (resultOld.state == "inWar") {
    arrAttacksPlusOld = resultOld.arrAttacksPlus;
  }

  let nFresh = [0, 0];
  let nCleanUp = [0, 0];
  let nOverKill = [0, 0];
  let tripleFresh = [0, 0];
  let tripleCleanUp = [0, 0];
  let tripleOverKill = [0, 0];

  let arrAttacksPlus = [];

  let attackType = "";
  let namePlayerDef = "";
  let townHallLevelDef = 0;
  let ptDefSum = [0, 0];
  let nDefC = [0, 0]; // 初見以外の防衛回数
  let nDefThisBase = [];

  let obj_nFresh = {};
  let obj_nCleanUp = {};
  let obj_nOverKill = {};
  let obj_tripleFresh = {};
  let obj_tripleCleanUp = {};
  let obj_tripleOverKill = {};
  let obj_hitrateFresh = {};
  let obj_hitrateCleanUp = {};
  let obj_hitrateOverKill = {};

  let obj_nFreshOpp = {};
  let obj_nCleanUpOpp = {};
  let obj_nOverKillOpp = {};
  let obj_tripleFreshOpp = {};
  let obj_tripleCleanUpOpp = {};
  let obj_tripleOverKillOpp = {};
  let obj_hitrateFreshOpp = {};
  let obj_hitrateCleanUpOpp = {};
  let obj_hitrateOverKillOpp = {};

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let levelKey = `th${iTH}`;
    obj_nFresh[levelKey] = 0;
    obj_nCleanUp[levelKey] = 0;
    obj_nOverKill[levelKey] = 0;
    obj_tripleFresh[levelKey] = 0;
    obj_tripleCleanUp[levelKey] = 0;
    obj_tripleOverKill[levelKey] = 0;
    obj_hitrateFresh[levelKey] = 0;
    obj_hitrateCleanUp[levelKey] = 0;
    obj_hitrateOverKill[levelKey] = 0;
    obj_nFreshOpp[levelKey] = 0;
    obj_nCleanUpOpp[levelKey] = 0;
    obj_nOverKillOpp[levelKey] = 0;
    obj_tripleFreshOpp[levelKey] = 0;
    obj_tripleCleanUpOpp[levelKey] = 0;
    obj_tripleOverKillOpp[levelKey] = 0;
    obj_hitrateFreshOpp[levelKey] = 0;
    obj_hitrateCleanUpOpp[levelKey] = 0;
    obj_hitrateOverKillOpp[levelKey] = 0;
  }

  arrAttacks.forEach((arrAttack, i) => {
    let ptDef = 0;
    let clanWarAttack = arrAttack;
    let levelKey = `th${arrAttack.townHallLevel}`;
    if (arrAttack.attackType != "remaining") {
      let nDef = 0;
      let flagCleanUp = 0;
      let bestStars = 0;
      // 1回目は初見
      if (i == 0) {
        nDefThisBase[i] = 1;
        attackType = "fresh";
        if (arrAttack.action == "attack") {
          nFresh[0] += 1;
          obj_nFresh[levelKey] += 1;
        } else if (arrAttack.action == "defense") {
          nFresh[1] += 1;
          obj_nFreshOpp[levelKey] += 1;
        }
        if (arrAttack.stars == 3) {
          if (arrAttack.action == "attack") {
            tripleFresh[0] += 1;
            obj_tripleFresh[levelKey] += 1;
          } else if (arrAttack.action == "defense") {
            tripleFresh[1] += 1;
            obj_tripleFreshOpp[levelKey] += 1;
          }
        } else {
          nDef += 1;
        }
      }
      // 2回目以降はそれまでの攻撃のdefenderTagから判定
      else {
        nDefThisBase[i] = 1;
        for (let j = 0; j < i; j++) {
          if (arrAttack.defenderTag == arrAttacks[j].defenderTag) {
            nDefThisBase[i] += 1;
            flagCleanUp = 1;
            if (arrAttacks[j].stars != 3) {
              nDef += 1;
            }
            if (arrAttacks[j].stars > bestStars) {
              bestStars = arrAttacks[j].stars;
            }
          }
        }
        if (bestStars == 3) {
          // オーバーキル
          attackType = "overkill";
          if (arrAttack.action == "attack") {
            nOverKill[0] += 1;
            nDefC[1] += 1;
            obj_nOverKill[levelKey] += 1;
          } else if (arrAttack.action == "defense") {
            nOverKill[1] += 1;
            nDefC[0] += 1;
            obj_nOverKillOpp[levelKey] += 1;
          }
          if (arrAttack.stars == 3) {
            if (arrAttack.action == "attack") {
              tripleOverKill[0] += 1;
              obj_tripleOverKill[levelKey] += 1;
            } else if (arrAttack.action == "defense") {
              tripleOverKill[1] += 1;
              obj_tripleOverKillOpp[levelKey] += 1;
            }
          } else {
            nDef += 1;
            ptDef = 1;
          }
        } else if (flagCleanUp == 0) {
          // 初見
          attackType = "fresh";
          if (arrAttack.action == "attack") {
            nFresh[0] += 1;
            obj_nFresh[levelKey] += 1;
          } else if (arrAttack.action == "defense") {
            nFresh[1] += 1;
            obj_nFreshOpp[levelKey] += 1;
          }
          if (arrAttack.stars == 3) {
            if (arrAttack.action == "attack") {
              tripleFresh[0] += 1;
              obj_tripleFresh[levelKey] += 1;
            } else if (arrAttack.action == "defense") {
              tripleFresh[1] += 1;
              obj_tripleFreshOpp[levelKey] += 1;
            }
          } else {
            nDef += 1;
          }
        } else if (flagCleanUp == 1) {
          // 非初見
          attackType = "cleanup";
          if (arrAttack.action == "attack") {
            nCleanUp[0] += 1;
            nDefC[1] += 1;
            obj_nCleanUp[levelKey] += 1;
          } else if (arrAttack.action == "defense") {
            nCleanUp[1] += 1;
            nDefC[0] += 1;
            obj_nCleanUpOpp[levelKey] += 1;
          }
          if (arrAttack.stars == 3) {
            if (arrAttack.action == "attack") {
              tripleCleanUp[0] += 1;
              obj_tripleCleanUp[levelKey] += 1;
            } else if (arrAttack.action == "defense") {
              tripleCleanUp[1] += 1;
              obj_tripleCleanUpOpp[levelKey] += 1;
            }
          } else {
            nDef += 1;
            ptDef = 1;
          }
        }
      }

      if (arrAttack.action == "attack") {
        ptDefSum[1] += ptDef;
      } else if (arrAttack.action == "defense") {
        ptDefSum[0] += ptDef;
      }

      // 星絵文字用配列作成
      let arrStarsFlag = [0, 0, 0];
      for (let j = 0; j < arrAttack.stars; j++) {
        // とりあえず2
        arrStarsFlag[j] = 2;
      }
      if (bestStars <= arrAttack.stars) {
        // 新星分以外を1に書き換え
        for (let k = 0; k < bestStars; k++) {
          arrStarsFlag[k] = 1;
          if (attackType == "overkill") {
            arrStarsFlag[k] = 3;
          }
        }
      } else {
        // 全部1に書き換え
        for (let k = 0; k < arrAttack.stars; k++) {
          arrStarsFlag[k] = 1;
          if (attackType == "overkill") {
            arrStarsFlag[k] = 3;
          }
        }
      }

      // 防衛プレイヤー情報取得
      for (let k in arrPlayers) {
        if (arrAttack.defenderTag == arrPlayers[k].tag) {
          namePlayerDef = arrPlayers[k].name;
          townHallLevelDef = arrPlayers[k].townHallLevel;
          break;
        }
      }

      if (arrAttack.action == "attack") {
        clanWarAttack.action = "attack";
      } else if (arrAttack.action == "defense") {
        clanWarAttack.action = "defense";
      }
      clanWarAttack.namePlayerDef = namePlayerDef;
      clanWarAttack.townHallLevelDef = townHallLevelDef;
      clanWarAttack.attackType = attackType;
      clanWarAttack.nDef = nDef;
      clanWarAttack.arrStarsFlag = arrStarsFlag;
      clanWarAttack.ptDef = ptDef;
      clanWarAttack.unixTime = Math.round(Date.now() / 1000);
    }
    if (arrAttacksPlusOld[i] != undefined) {
      if (arrAttacksPlusOld[i].attackType != "remaining") {
        clanWarAttack = arrAttacksPlusOld[i];
      }
    }

    arrAttacksPlus.push(clanWarAttack);
  });

  obj_hitrateFresh.total =
    Math.round((tripleFresh[0] / nFresh[0]) * 100 * 100) / 100;
  obj_hitrateCleanUp.total =
    Math.round((tripleCleanUp[0] / nCleanUp[0]) * 100 * 100) / 100;
  obj_hitrateOverKill.total =
    Math.round((tripleOverKill[0] / nOverKill[0]) * 100 * 100) / 100;

  obj_hitrateFreshOpp.total =
    Math.round((tripleFresh[1] / nFresh[1]) * 100 * 100) / 100;
  obj_hitrateCleanUpOpp.total =
    Math.round((tripleCleanUp[1] / nCleanUp[1]) * 100 * 100) / 100;
  obj_hitrateOverKillOpp.total =
    Math.round((tripleOverKill[1] / nOverKill[1]) * 100 * 100) / 100;

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let levelKey = `th${iTH}`;
    obj_hitrateFresh[levelKey] =
      Math.round(
        (obj_tripleFresh[levelKey] / obj_nFresh[levelKey]) * 100 * 100,
      ) / 100;
    obj_hitrateCleanUp[levelKey] =
      Math.round(
        (obj_tripleCleanUp[levelKey] / obj_nCleanUp[levelKey]) * 100 * 100,
      ) / 100;
    obj_hitrateOverKill[levelKey] =
      Math.round(
        (obj_tripleOverKill[levelKey] / obj_nOverKill[levelKey]) * 100 * 100,
      ) / 100;
    obj_hitrateFreshOpp[levelKey] =
      Math.round(
        (obj_tripleFreshOpp[levelKey] / obj_nFreshOpp[levelKey]) * 100 * 100,
      ) / 100;
    obj_hitrateCleanUpOpp[levelKey] =
      Math.round(
        (obj_tripleCleanUpOpp[levelKey] / obj_nCleanUpOpp[levelKey]) *
          100 *
          100,
      ) / 100;
    obj_hitrateOverKillOpp[levelKey] =
      Math.round(
        (obj_tripleOverKillOpp[levelKey] / obj_nOverKillOpp[levelKey]) *
          100 *
          100,
      ) / 100;
  }

  let fresh = {
    nAt: {},
    nTriple: {},
    hitrate: {},
    nDef: {},
    nDefTriple: {},
    defrate: {},
  };
  let cleanup = {
    nAt: {},
    nTriple: {},
    hitrate: {},
    nDef: {},
    nDefTriple: {},
    defrate: {},
  };
  let overkill = {
    nAt: {},
    nTriple: {},
    hitrate: {},
    nDef: {},
    nDefTriple: {},
    defrate: {},
  };
  let allAttackTypes = {
    nAt: {},
    nTriple: {},
    hitrate: {},
    nDef: {},
    nDefTriple: {},
    defrate: {},
  };

  fresh.nAt.total = nFresh[0];
  cleanup.nAt.total = nCleanUp[0];
  overkill.nAt.total = nOverKill[0];
  allAttackTypes.nAt.total = nFresh[0] + nCleanUp[0] + nOverKill[0];

  fresh.nTriple.total = tripleFresh[0];
  cleanup.nTriple.total = tripleCleanUp[0];
  overkill.nTriple.total = tripleOverKill[0];
  allAttackTypes.nTriple.total =
    tripleFresh[0] + tripleCleanUp[0] + tripleOverKill[0];

  fresh.hitrate.total = obj_hitrateFresh.total;
  cleanup.hitrate.total = obj_hitrateCleanUp.total;
  overkill.hitrate.total = obj_hitrateOverKill.total;
  allAttackTypes.hitrate.total =
    Math.round(
      (allAttackTypes.nTriple.total / allAttackTypes.nAt.total) * 100 * 100,
    ) / 100;

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let levelKey = `th${iTH}`;
    fresh.nAt[levelKey] = obj_nFresh[levelKey];
    cleanup.nAt[levelKey] = obj_nCleanUp[levelKey];
    overkill.nAt[levelKey] = obj_nOverKill[levelKey];
    allAttackTypes.nAt[levelKey] =
      obj_nFresh[levelKey] + obj_nCleanUp[levelKey] + obj_nOverKill[levelKey];

    fresh.nTriple[levelKey] = obj_tripleFresh[levelKey];
    cleanup.nTriple[levelKey] = obj_tripleCleanUp[levelKey];
    overkill.nTriple[levelKey] = obj_tripleOverKill[levelKey];
    allAttackTypes.nTriple[levelKey] =
      obj_tripleFresh[levelKey] +
      obj_tripleCleanUp[levelKey] +
      obj_tripleOverKill[levelKey];

    fresh.hitrate[levelKey] = obj_hitrateFresh[levelKey];
    cleanup.hitrate[levelKey] = obj_hitrateCleanUp[levelKey];
    overkill.hitrate[levelKey] = obj_hitrateOverKill[levelKey];
    allAttackTypes.hitrate[levelKey] =
      Math.round(
        (allAttackTypes.nTriple[levelKey] / allAttackTypes.nAt[levelKey]) *
          100 *
          100,
      ) / 100;
  }

  let freshOpponent = {
    nAt: {},
    nTriple: {},
    hitrate: {},
    nDef: {},
    nDefTriple: {},
    defrate: {},
  };
  let cleanupOpponent = {
    nAt: {},
    nTriple: {},
    hitrate: {},
    nDef: {},
    nDefTriple: {},
    defrate: {},
  };
  let overkillOpponent = {
    nAt: {},
    nTriple: {},
    hitrate: {},
    nDef: {},
    nDefTriple: {},
    defrate: {},
  };
  let allAttackTypesOpponent = {
    nAt: {},
    nTriple: {},
    hitrate: {},
    nDef: {},
    nDefTriple: {},
    defrate: {},
  };

  freshOpponent.nAt.total = nFresh[1];
  cleanupOpponent.nAt.total = nCleanUp[1];
  overkillOpponent.nAt.total = nOverKill[1];
  allAttackTypesOpponent.nAt.total = nFresh[1] + nCleanUp[1] + nOverKill[1];

  freshOpponent.nTriple.total = tripleFresh[1];
  cleanupOpponent.nTriple.total = tripleCleanUp[1];
  overkillOpponent.nTriple.total = tripleOverKill[1];
  allAttackTypesOpponent.nTriple.total =
    tripleFresh[1] + tripleCleanUp[1] + tripleOverKill[1];

  freshOpponent.hitrate.total = obj_hitrateFreshOpp.total;
  cleanupOpponent.hitrate.total = obj_hitrateCleanUpOpp.total;
  overkillOpponent.hitrate.total = obj_hitrateOverKillOpp.total;
  allAttackTypesOpponent.hitrate.total =
    Math.round(
      (allAttackTypesOpponent.nTriple.total /
        allAttackTypesOpponent.nAt.total) *
        100 *
        100,
    ) / 100;

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let levelKey = `th${iTH}`;
    freshOpponent.nAt[levelKey] = obj_nFreshOpp[levelKey];
    cleanupOpponent.nAt[levelKey] = obj_nCleanUpOpp[levelKey];
    overkillOpponent.nAt[levelKey] = obj_nOverKillOpp[levelKey];
    allAttackTypesOpponent.nAt[levelKey] =
      obj_nFreshOpp[levelKey] +
      obj_nCleanUpOpp[levelKey] +
      obj_nOverKillOpp[levelKey];

    freshOpponent.nTriple[levelKey] = obj_tripleFreshOpp[levelKey];
    cleanupOpponent.nTriple[levelKey] = obj_tripleCleanUpOpp[levelKey];
    overkillOpponent.nTriple[levelKey] = obj_tripleOverKillOpp[levelKey];
    allAttackTypesOpponent.nTriple[levelKey] =
      obj_tripleFreshOpp[levelKey] +
      obj_tripleCleanUpOpp[levelKey] +
      obj_tripleOverKillOpp[levelKey];

    freshOpponent.hitrate[levelKey] = obj_hitrateFreshOpp[levelKey];
    cleanupOpponent.hitrate[levelKey] = obj_hitrateCleanUpOpp[levelKey];
    overkillOpponent.hitrate[levelKey] = obj_hitrateOverKillOpp[levelKey];
    allAttackTypesOpponent.hitrate[levelKey] =
      Math.round(
        (allAttackTypesOpponent.nTriple[levelKey] /
          allAttackTypesOpponent.nAt[levelKey]) *
          100 *
          100,
      ) / 100;
  }

  fresh.nDef.total = freshOpponent.nAt.total;
  cleanup.nDef.total = cleanupOpponent.nAt.total;
  overkill.nDef.total = overkillOpponent.nAt.total;
  allAttackTypes.nDef.total = allAttackTypesOpponent.nAt.total;

  fresh.nDefTriple.total = freshOpponent.nTriple.total;
  cleanup.nDefTriple.total = cleanupOpponent.nTriple.total;
  overkill.nDefTriple.total = overkillOpponent.nTriple.total;
  allAttackTypes.nDefTriple.total = allAttackTypesOpponent.nTriple.total;

  fresh.defrate.total = 100 - freshOpponent.hitrate.total;
  cleanup.defrate.total = 100 - cleanupOpponent.hitrate.total;
  overkill.defrate.total = 100 - overkillOpponent.hitrate.total;
  allAttackTypes.defrate.total = 100 - allAttackTypesOpponent.hitrate.total;

  freshOpponent.nDef.total = fresh.nAt.total;
  cleanupOpponent.nDef.total = cleanup.nAt.total;
  overkillOpponent.nDef.total = overkill.nAt.total;
  allAttackTypesOpponent.nDef.total = allAttackTypes.nAt.total;

  freshOpponent.nDefTriple.total = fresh.nTriple.total;
  cleanupOpponent.nDefTriple.total = cleanup.nTriple.total;
  overkillOpponent.nDefTriple.total = overkill.nTriple.total;
  allAttackTypesOpponent.nDefTriple.total = allAttackTypes.nTriple.total;

  freshOpponent.defrate.total = 100 - fresh.hitrate.total;
  cleanupOpponent.defrate.total = 100 - cleanup.hitrate.total;
  overkillOpponent.defrate.total = 100 - overkill.hitrate.total;
  allAttackTypesOpponent.defrate.total = 100 - allAttackTypes.hitrate.total;

  for (let iTH = config.rangeLvTH.min; iTH <= config.rangeLvTH.max; iTH++) {
    let levelKey = `th${iTH}`;

    fresh.nDef[levelKey] = freshOpponent.nAt[levelKey];
    cleanup.nDef[levelKey] = cleanupOpponent.nAt[levelKey];
    overkill.nDef[levelKey] = overkillOpponent.nAt[levelKey];
    allAttackTypes.nDef[levelKey] = allAttackTypesOpponent.nAt[levelKey];

    fresh.nDefTriple[levelKey] = freshOpponent.nTriple[levelKey];
    cleanup.nDefTriple[levelKey] = cleanupOpponent.nTriple[levelKey];
    overkill.nDefTriple[levelKey] = overkillOpponent.nTriple[levelKey];
    allAttackTypes.nDefTriple[levelKey] =
      allAttackTypesOpponent.nTriple[levelKey];

    fresh.defrate[levelKey] = 100 - freshOpponent.hitrate[levelKey];
    cleanup.defrate[levelKey] = 100 - cleanupOpponent.hitrate[levelKey];
    overkill.defrate[levelKey] = 100 - overkillOpponent.hitrate[levelKey];
    allAttackTypes.defrate[levelKey] =
      100 - allAttackTypesOpponent.hitrate[levelKey];

    freshOpponent.nDef[levelKey] = fresh.nAt[levelKey];
    cleanupOpponent.nDef[levelKey] = cleanup.nAt[levelKey];
    overkillOpponent.nDef[levelKey] = overkill.nAt[levelKey];
    allAttackTypesOpponent.nDef[levelKey] = allAttackTypes.nAt[levelKey];

    freshOpponent.nDefTriple[levelKey] = fresh.nTriple[levelKey];
    cleanupOpponent.nDefTriple[levelKey] = cleanup.nTriple[levelKey];
    overkillOpponent.nDefTriple[levelKey] = overkill.nTriple[levelKey];
    allAttackTypesOpponent.nDefTriple[levelKey] =
      allAttackTypes.nTriple[levelKey];

    freshOpponent.defrate[levelKey] = 100 - fresh.hitrate[levelKey];
    cleanupOpponent.defrate[levelKey] = 100 - cleanup.hitrate[levelKey];
    overkillOpponent.defrate[levelKey] = 100 - overkill.hitrate[levelKey];
    allAttackTypesOpponent.defrate[levelKey] =
      100 - allAttackTypes.hitrate[levelKey];
  }

  let resultClan = {
    fresh: fresh,
    cleanup: cleanup,
    overkill: overkill,
    allAttackTypes: allAttackTypes,
    nDefC: nDefC[0],
    ptDefSum: ptDefSum[0],
  };

  let resultOpponent = {
    fresh: freshOpponent,
    cleanup: cleanupOpponent,
    overkill: overkillOpponent,
    allAttackTypes: allAttackTypesOpponent,
    nDefC: nDefC[1],
    ptDefSum: ptDefSum[1],
  };

  return [arrAttacksPlus, resultClan, resultOpponent];
}

async function createDescription(clientMongo, mongoWar, league, type) {
  let clanAbbr = mongoWar.clan_abbr;
  let clanAbbrOpp = mongoWar.opponent_abbr;
  let mongoClanA = await clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: clanAbbr });
  let mongoClanB = await clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: clanAbbrOpp });

  let stateStr = "";
  if (mongoWar.result != null) {
    if (mongoWar.result.state == "warEnded") {
      stateStr = `:checkered_flag: `;
    } else if (mongoWar.result.state == "preparation") {
      stateStr = `:arrow_forward: `;
    } else if (mongoWar.result.state == "inWar") {
      stateStr = `:arrow_forward: `;
    }
  }

  let description = "";
  if (mongoWar.name_match) {
    description += `* ${stateStr}${mongoWar.name_match}`;
  } else {
    if (type == "multi") {
      description += `* ${stateStr}${schedule.match["m" + mongoWar.match]}`;
    }
  }
  if (mongoWar.stream) {
    description += ` :tv:`;
  }
  description += `\n`;

  if (type == "multi") {
    description += `**${mongoClanA.team_name} :vs: ${mongoClanB.team_name}**\n`;
  }

  if (mongoWar.result == "") {
    // マッチング前
    if (mongoWar.deal) {
      if (mongoWar.deal.unixTime) {
        description += `:calendar: <t:${mongoWar.deal.unixTime}:F> (<t:${mongoWar.deal.unixTime}:R>)\n`;
      }
      description += `:hourglass_flowing_sand:  ${mongoWar.deal.prep_time}`;
      description += `  /  :crossed_swords:  ${mongoWar.deal.battle_time}\n`;
    } else {
      description += "_not yet scheduled_\n";
    }
  } else if (mongoWar.result.note) {
    description += `_${mongoWar.result.note}_\n`;
  } else {
    // マッチング後
    if (mongoWar.result.state == "preparation") {
      description += ``;
    } else {
      // inWar, warEnded
      if (type == "single") {
        description += `\n`;
      }
      description += await createDescriptionSingle(
        league,
        mongoWar.result,
        type,
      );
    }

    //const dateNow = new Date();
    //const startTimeJstDate = utcToZonedTime(mongoWar.clan_war.startTime, 'Asia/Tokyo');
    //const startTimeJstStr = format(startTimeJstDate, 'M/d HH:mm:ss');
    const startTimeUnix =
      new Date(mongoWar.clan_war.startTime).getTime() / 1000;
    //const endTimeJstDate = utcToZonedTime(mongoWar.clan_war.endTime, 'Asia/Tokyo');
    //const endTimeJstStr = format(endTimeJstDate, 'M/d HH:mm:ss');
    const endTimeUnix = new Date(mongoWar.clan_war.endTime).getTime() / 1000;

    if (mongoWar.result.state == "preparation") {
      description += `_starts at_ <t:${startTimeUnix}:t> (<t:${startTimeUnix}:R>)\n`;
    } else if (mongoWar.result.state == "inWar") {
      description += `_ends at_ <t:${endTimeUnix}:t> (<t:${endTimeUnix}:R>)\n`;
    }
    if (type == "single") {
      if (mongoWar.result.state == "warEnded") {
        description += `:checkered_flag: _war has ended_\n`;
      }
    }

    // note
    if (mongoWar.result.state == "warEnded") {
      if (mongoWar.result.clan.note != null) {
        description += `_${mongoWar.clan_abbr.toUpperCase()}: ${mongoWar.result.clan.note}_\n`;
      }
      if (mongoWar.result.opponent.note != null) {
        description += `_${mongoWar.opponent_abbr.toUpperCase()}: ${mongoWar.result.opponent.note}_\n`;
      }
      if (
        league == "mix" &&
        config.nHit[league] == 2 &&
        mongoWar.result.clan.note2 != null
      ) {
        description += `_${mongoWar.clan_abbr.toUpperCase()}: ${mongoWar.result.clan.note2}_\n`;
      }
      if (
        league == "mix" &&
        config.nHit[league] == 2 &&
        mongoWar.result.opponent.note2 != null
      ) {
        description += `_${mongoWar.opponent_abbr.toUpperCase()}: ${mongoWar.result.opponent.note2}_\n`;
      }
    }
  }
  description += `\n`;

  return description;
}
exports.createDescription = createDescription;

async function createDescriptionSingle(league, result, type) {
  let description = "";
  description += `${config.emote.star} **${result.clan.stars}** - **${result.opponent.stars}**`;
  description += `  ( *${result.clan.destruction}%* - *${result.opponent.destruction}%* )\n`;
  description += `:boom: **${result.clan.allAttackTypes.nTriple.total}**/${result.clan.allAttackTypes.nAt.total}`;
  description += ` - **${result.opponent.allAttackTypes.nTriple.total}**/${result.opponent.allAttackTypes.nAt.total}`;
  description += `  ( **${Math.round(result.clan.allAttackTypes.hitrate.total * 10) / 10}**%`;
  description += ` - **${Math.round(result.opponent.allAttackTypes.hitrate.total * 10) / 10}**% )\n`;

  if (type == "single") {
    if (config.nHit[league] == 2) {
      description += `:small_blue_diamond: **${result.clan.fresh.nTriple.total}**/${result.clan.fresh.nAt.total}`;
      description += ` - **${result.opponent.fresh.nTriple.total}**/${result.opponent.fresh.nAt.total}`;
      description += `  ( **${Math.round(result.clan.fresh.hitrate.total * 10) / 10}**%`;
      description += ` - **${Math.round(result.opponent.fresh.hitrate.total * 10) / 10}**% )\n`;
      description += `:small_orange_diamond: **${result.clan.cleanup.nTriple.total}**/${result.clan.cleanup.nAt.total}`;
      description += ` - **${result.opponent.cleanup.nTriple.total}**/${result.opponent.cleanup.nAt.total}`;
      description += `  ( **${Math.round(result.clan.cleanup.hitrate.total * 10) / 10}**%`;
      description += ` - **${Math.round(result.opponent.cleanup.hitrate.total * 10) / 10}**% )\n`;
      if (
        result.clan.overkill.nAt.total + result.opponent.overkill.nAt.total >
        0
      ) {
        description += `:small_red_triangle: **${result.clan.overkill.nTriple.total}**/${result.clan.overkill.nAt.total}`;
        description += ` - **${result.opponent.overkill.nTriple.total}**/${result.opponent.overkill.nAt.total}`;
        description += `  ( **${Math.round(result.clan.overkill.hitrate.total * 10) / 10}**%`;
        description += ` - **${Math.round(result.opponent.overkill.hitrate.total * 10) / 10}**% )\n`;
      }
    }
    if (league == "mix") {
      description += `\n`;
      for (const lvTH of config.lvTHmix) {
        description += await createDescriptionMix(lvTH, result);
      }
      description += `\n`;
    }
    description += `${config.emote.sword} **${result.clan.nLeft}**/${result.size * result.apm}`;
    description += ` - **${result.opponent.nLeft}**/${result.size * result.apm}\n`;
    description += `\n`;
  }

  // 防衛ポイント
  if (league == "mix" && config.nHit[league] == 2) {
    description += `${config.emote.shield} `;
    if (result.clan.ptDef2 > 0) {
      description += `**${result.clan.ptDefSum - result.clan.ptDef2}**/${result.clan.nDefC}`;
    } else {
      description += `**${result.clan.ptDefSum}**/${result.clan.nDefC}`;
    }
    if (result.opponent.ptDef2 > 0) {
      description += ` - **${result.opponent.ptDefSum - result.opponent.ptDef2}**/${result.opponent.nDefC}\n`;
    } else {
      description += ` - **${result.opponent.ptDefSum}**/${result.opponent.nDefC}\n`;
    }
    if (type == "single") {
      description += `\n`;
    }
    description += `${config.emote.star}${config.emote.shield} **${result.clan.stars + result.clan.ptDefSum}**`;
    description += ` - **${result.opponent.stars + result.opponent.ptDefSum}**\n`;
    if (type == "single") {
      description += `\n`;
    }
  }

  return description;
}
exports.createDescriptionSingle = createDescriptionSingle;

async function createDescriptionMix(lvTH, result) {
  if (result.clan.allAttackTypes.nTriple[`th${lvTH}`] === undefined) {
    lvTH = 16;
  }
  let keyLvTH = `th${lvTH}`;
  let description = "";
  description += `${config.emote.thn[lvTH]} **${result.clan.allAttackTypes.nTriple[keyLvTH]}**/${result.clan.allAttackTypes.nAt[keyLvTH]}`;
  description += ` - **${result.opponent.allAttackTypes.nTriple[keyLvTH]}**/${result.opponent.allAttackTypes.nAt[keyLvTH]}`;
  description += `  ( **${Math.round(result.clan.allAttackTypes.hitrate[keyLvTH] * 10) / 10}**%`;
  description += ` - **${Math.round(result.opponent.allAttackTypes.hitrate[keyLvTH] * 10) / 10}**% )\n`;
  return description;
}

async function createDescriptionLive(clientMongo, mongoWar) {
  const result = mongoWar.result;
  let clanAbbr = mongoWar.clan_abbr;
  let clanAbbrOpp = mongoWar.opponent_abbr;
  let mongoClanA = await clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: clanAbbr });
  let mongoClanB = await clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: clanAbbrOpp });

  let description = "";
  description = `**${mongoClanA.team_name} :vs: ${mongoClanB.team_name}**\n`;
  description += `${config.emote.star} **${result.clan.stars}** - **${result.opponent.stars}**`;
  description += `  ( *${result.clan.destruction}%* - *${result.opponent.destruction}%* )\n`;
  description += `:boom: **${result.clan.allAttackTypes.nTriple.total}**/${result.clan.allAttackTypes.nAt.total}`;
  description += ` - **${result.opponent.allAttackTypes.nTriple.total}**/${result.opponent.allAttackTypes.nAt.total}`;
  description += `  ( **${Math.round(result.clan.allAttackTypes.hitrate.total * 10) / 10}**%`;
  description += ` - **${Math.round(result.opponent.allAttackTypes.hitrate.total * 10) / 10}**% )\n`;

  // 防衛ポイント
  //if (league == 'mix') {
  //description += `${config.emote.shield} **${result.clan.ptDefSum}**/${result.clan.nDefC}`;
  //description += ` - **${result.opponent.ptDefSum}**/${result.opponent.nDefC}\n`;
  //};

  /*
  const endTimeJstDate = utcToZonedTime(mongoWar.clan_war.endTime, 'Asia/Tokyo');
  const endTimeJstStr = format(endTimeJstDate, 'M/d HH:mm:ss');
  description += `_war ends at ${endTimeJstStr}_\n`;
  */

  let nameMatch = mongoWar.name_match;
  if (nameMatch != "") {
    description += `*${mongoWar.league.toUpperCase()} - ${nameMatch}*\n`;
  } else {
    description += `*${mongoWar.league.toUpperCase()} - MATCH ${mongoWar.match}*\n`;
  }
  description += `\n`;

  return description;
}
exports.createDescriptionLive = createDescriptionLive;

async function sendWarStats(interaction, clientMongo, league, mongoWar) {
  const mongoClanA = await clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: mongoWar.clan_abbr });
  const mongoClanB = await clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: mongoWar.opponent_abbr });

  const embed = await createEmbedWarStats(
    clientMongo,
    league,
    mongoWar,
    mongoClanA,
    mongoClanB,
  );
  await interaction.followUp({ embeds: [embed] });

  if (mongoWar.result != "") {
    let attachment = await fCanvas.warProgress(mongoWar);
    await interaction.followUp({ files: [attachment] });
  }

  return;
}
exports.sendWarStats = sendWarStats;

async function createEmbedWarStats(
  clientMongo,
  league,
  mongoWar,
  mongoClanA,
  mongoClanB,
) {
  let title = `**${mongoClanA.team_name} :vs: ${mongoClanB.team_name}**`;

  let footerText = "";
  footerText += `${config.footer} ${config.league[league]} `;
  footerText += `W${mongoWar.week} M${mongoWar.match}`;

  let description = "";
  description += await createDescription(
    clientMongo,
    mongoWar,
    league,
    "single",
  );

  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setDescription(description);
  embed.setColor(config.color[league]);
  embed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });

  return embed;
}
