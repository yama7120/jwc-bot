import { EmbedBuilder } from "discord.js";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import config from "../config/config.js";
import config_coc from "../config/config_coc.js";
import schedule from "../config/schedule.js";
import * as fGetWars from "./fGetWars.js";
import * as fRanking from "./fRanking.js";

/**
 * チャンネルへ安全にメッセージを送信するユーティリティ。
 * チャンネルが見つからない・権限がない場合はエラーログを出して握りつぶす。
 * @param {Client} client - Discord Client
 * @param {string} channelId - 送信先チャンネルID
 * @param {object} payload - send() に渡す引数 (例: { embeds: [...] })
 * @param {string} [label] - ログ用ラベル (どこから呼ばれたか)
 * @returns {Promise<import("discord.js").Message|null>}
 */
async function safeSend(client, channelId, payload, label = "") {
  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel) {
      console.warn(`⚠️ [safeSend]${label ? ` (${label})` : ""} チャンネルが見つかりません: ${channelId}`);
      return null;
    }
    return await channel.send(payload);
  } catch (error) {
    console.error(`❌ [safeSend]${label ? ` (${label})` : ""} 送信失敗 ch=${channelId}:`, error.message);
    return null;
  }
}
export { safeSend };

function maintenance(interaction) {
  try {
    const send = (content) => {
      // Prefer followUp only when interaction is already replied/deferred
      if (
        typeof interaction.followUp === "function" &&
        (interaction.deferred || interaction.replied)
      ) {
        return interaction.followUp({ content });
      }
      if (typeof interaction.reply === "function") {
        return interaction.reply({ content });
      }
      if (interaction.channel?.isTextBased?.()) {
        return interaction.channel.send(content);
      }
    };

    if (isYama(interaction.user.id)) {
      send(`*under maintenance...*`);
      // allow Yama to proceed (no return true)
    } else {
      send(`*under maintenance...*`);
      return true; // block others
    }
  } catch (e) {
    console.error("maintenance notice failed:", e);
  }
}
export { maintenance };

function isYama(iSenderId) {
  if (iSenderId == config.yamaId) {
    return true;
  } else if (iSenderId != config.yamaId) {
    return false;
  }
}

async function getWeekNow(league) {
  const weekNowNum = Number(config.weekNow[league]);
  return weekNowNum;
}
export { getWeekNow };

async function countHeroEquipment(arrEquipmentInAttack) {
  let commonCount = 0;
  let epicCount = 0;

  // 装備名からタイプを取得するためのマップを作成
  const equipmentMap = {};
  config_coc.heroEquipments.forEach((equipment) => {
    equipmentMap[equipment.name] = equipment.type;
  });

  arrEquipmentInAttack.forEach((hero) => {
    if (hero.equipment) {
      hero.equipment.forEach((item) => {
        const type = equipmentMap[item];
        if (type === "common") {
          commonCount++;
        } else if (type === "epic") {
          epicCount++;
        }
      });
    }
  });

  const countEquip = { common: commonCount, epic: epicCount };
  return countEquip;
}
export { countHeroEquipment };

function countStarsLegend(diffTrophies) {
  let stars = -1;
  if (Math.abs(diffTrophies) == 40) {
    stars = 3;
  } else if (32 >= Math.abs(diffTrophies) && Math.abs(diffTrophies) >= 16) {
    stars = 2;
  } else if (15 >= Math.abs(diffTrophies) && Math.abs(diffTrophies) >= 5) {
    stars = 1;
  } else if (4 >= Math.abs(diffTrophies) && Math.abs(diffTrophies) >= 0) {
    stars = 0;
  }
  return stars;
}
export { countStarsLegend };

function countStarsNonLegend(diffTrophies) {
  let stars = -1;
  if (diffTrophies == 0) {
    stars = 3;
  } else if (24 >= diffTrophies && diffTrophies >= 8) {
    stars = 2;
  } else if (35 >= diffTrophies && diffTrophies >= 25) {
    stars = 1;
  } else if (diffTrophies == 40) {
    stars = 0;
  }
  return stars;
}
export { countStarsNonLegend };

async function createEmbedLegends(client, nDisplay, locationId, prefetched) {
  if (nDisplay == null) {
    nDisplay = 25;
  }

  const scPlayersLegend = prefetched?.players ?? [];
  const unixTime = prefetched?.unixTime ?? Math.round(Date.now() / 1000);

  let arrDescription = [];
  await Promise.all(
    scPlayersLegend.map(async (scPlayer, index) => {
      if (index < nDisplay) {
        arrDescription[index] = `${scPlayer.rank}. `;

        // リーグの絵文字を取得
        const leagueTier = config_coc.leagueTiers.find(
          (tier) => tier.id === scPlayer.leagueTier.id,
        );
        const leagueEmoji = leagueTier ? leagueTier.emote : "";

        arrDescription[index] += ` ${leagueEmoji} **${scPlayer.trophies}**`;
        arrDescription[index] += ` _x${scPlayer.attackWins}_`;

        let diffRank = scPlayer.rank - scPlayer.previousRank;
        if (diffRank < 0) {
          arrDescription[index] += ` ${config.emote.up}${-diffRank}`;
        } else if (diffRank > 0) {
          arrDescription[index] += ` ${config.emote.down}${diffRank}`;
        } else {
          arrDescription[index] += ` :white_small_square:${diffRank}`;
        }

        arrDescription[index] += ` ${config.emote.thn[config.lvTH]}`;
        arrDescription[index] += ` **${nameReplacer(scPlayer.name)}**`;
        let mongoAcc = await client.clientMongo
          .db("jwc")
          .collection("accounts")
          .findOne(
            { tag: scPlayer.tag },
            { projection: { homeClanAbbr: 1, _id: 0 } },
          );
        let homeTeamAbbr = "";
        if (mongoAcc != null) {
          homeTeamAbbr = mongoAcc.homeClanAbbr.j = ""
            ? ""
            : mongoAcc.homeClanAbbr.j;
          if (homeTeamAbbr != "") {
            arrDescription[index] +=
              ` | ${config.emote.jwc}${String(homeTeamAbbr).toUpperCase()}`;
          }
        }

        arrDescription[index] += `\n`;
      }
    }),
  );

  let pages = Math.ceil(nDisplay / 25);

  let arrEmbed = [];

  for (let i = 0; i < pages; i++) {
    let embed = new EmbedBuilder();
    embed.setColor(config.color.main);
    let title = "";
    if (locationId == config_coc.locationId.japan) {
      title = `${config.emote.legend} **JAPANESE LEGENDS :flag_jp:**`;
    } else {
      title = `${config.emote.legend} **GLOBAL LEGENDS :globe_with_meridians:**`;
    }
    embed.setTitle(title);

    arrEmbed[i] = {};
    let description = "";
    arrDescription.forEach((value, index) => {
      if (index >= 25 * i && index < 25 * (i + 1)) {
        description += value;
      }
    });
    description += `\n`;
    description += `<t:${unixTime}:f>\n`;
    embed.setDescription(description);

    let footer = `The End of Last Day`;
    footer += ` | Page ${i + 1} of ${pages}`;
    embed.setFooter({ text: footer, iconURL: config.urlImage.jwc });
    arrEmbed[i] = embed;
  }

  return arrEmbed;
}
export { createEmbedLegends };

function tagReplacer(tag) {
  let tagNew =
    tag.includes("#") || tag.includes("＃")
      ? tag.replace("＃", "#")
      : "#" + tag;
  return tagNew.replace(/O/g, "0").toUpperCase();
}
export { tagReplacer };

function nameReplacer(name) {
  let nameNew = String(name)
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/`/g, "\\`");
  return nameNew;
}
export { nameReplacer };

async function getAccInfoTitle(scPlayer) {
  //console.dir(scPlayer.troops);
  let title = "";
  title = `${config.emote.thn[scPlayer.townHallLevel]}`;
  title += `  ${nameReplacer(scPlayer.name)}`;
  return title;
}
export { getAccInfoTitle };

async function getAccInfoDescriptionMain(scPlayer, formatLength) {
  let description = "";
  const urlPlayer = `https://link.clashofclans.com/jp?action=OpenPlayerProfile&tag=${scPlayer.tag.slice(1)}`;
  if (formatLength == "long") {
    if (
      scPlayer.townHallLevel == 12 ||
      scPlayer.townHallLevel == 13 ||
      scPlayer.townHallLevel == 14 ||
      scPlayer.townHallLevel == 15 ||
      scPlayer.townHallLevel == 17
    ) {
      if (scPlayer.townHallWeaponLevel === undefined) {
        description = `[__${scPlayer.tag}__](${urlPlayer}) TH${scPlayer.townHallLevel}\n`;
      } else {
        description = `[__${scPlayer.tag}__](${urlPlayer}) TH${scPlayer.townHallLevel}-${scPlayer.townHallWeaponLevel}\n`;
      }
    } else {
      description = `[__${scPlayer.tag}__](${urlPlayer}) TH${scPlayer.townHallLevel}\n`;
    }
  } else if (formatLength == "short") {
    description = config.emote.thn[scPlayer.townHallLevel];
    description += " ";
    description += `**${nameReplacer(scPlayer.name)}**`;
    description += ` [__${scPlayer.tag}__](${urlPlayer})\n`;
  }
  return description;
}
export { getAccInfoDescriptionMain };

async function getAccInfoDescriptionWar(clientCoc, scPlayer, formatLength) {
  let description = "";

  if (scPlayer.inClan == false) {
    description += `*not in any clans*\n`;
  } else if (scPlayer.inClan == true) {
    description += `${nameReplacer(scPlayer.clan.name)}\n`;
    if (formatLength == "long") {
      description += "\n";
      description += "* **WAR**\n";
    }
    let clanWar = null;
    try {
      clanWar = await clientCoc.getCurrentWar(scPlayer.clan.tag);
      //console.dir(clanWar);
    } catch (error) {
      if (error.reason != "notFound") {
        description += `error: *${error.reason}*\n`;
      }
    }
    if (clanWar != null) {
      if (clanWar.state == "preparation" || clanWar.state == "inWar") {
        const clanWarMember = clanWar.getMember(scPlayer.tag);
        if (clanWarMember != null) {
          const startTimeJstDate = toZonedTime(clanWar.startTime, "Asia/Tokyo");
          const startTimeJstStr = format(startTimeJstDate, "M/d HH:mm");
          const startTimeUnix = new Date(clanWar.startTime).getTime() / 1000;
          const endTimeJstDate = toZonedTime(clanWar.endTime, "Asia/Tokyo");
          const endTimeJstStr = format(endTimeJstDate, "M/d HH:mm");
          const endTimeUnix = new Date(clanWar.endTime).getTime() / 1000;
          description += `_in war until ${endTimeJstStr}_ <t:${endTimeUnix}:R>\n`;
          if (clanWar.state == "preparation") {
            description += `_preparation until ${startTimeJstStr}_ <t:${startTimeUnix}:R>\n`;
          } else if (clanWar.state == "inWar") {
            if (formatLength == "long") {
              let inSCCWL = null;
              try {
                let clanWarLeagueGroup = await clientCoc.getClanWarLeagueGroup(
                  scPlayer.clan.tag,
                );
                inSCCWL = true;
                if (clanWarLeagueGroup.state == "inWar") {
                  description += await createDescriptionAttacksSCCWL(
                    clientCoc,
                    clanWarLeagueGroup,
                    scPlayer,
                  );
                }
              } catch (error) {
                if (error.reason == "notFound") {
                  inSCCWL = false;
                }
              }

              if (inSCCWL == false) {
                try {
                  //let clanWar = await clientCoc.getCurrentWar(scPlayer.clan.tag);
                  if (clanWar.state == "inWar") {
                    description += await createDescriptionAttacks(
                      clanWar,
                      clanWarMember,
                      scPlayer,
                    );
                  }
                } catch (error) {}
              }
            } else if (formatLength == "short") {
              description += await createDescriptionAttacks(
                clanWar,
                clanWarMember,
                scPlayer,
              );
            }
          }
        } else if (clanWarMember == null) {
          description += "*not in war*\n";
        }
      } else {
        description += `*${clanWar.state}*\n`;
        //console.dir(clanWar);
      }
    }
  } else {
    description += `*error*\n`;
  }
  return description;
}
export { getAccInfoDescriptionWar };

async function createDescriptionAttacks(clanWar, clanWarMember, scPlayer) {
  let description = "";
  if (
    clanWar.clan.tag == scPlayer.clan.tag ||
    clanWar.opponent.tag == scPlayer.clan.tag
  ) {
    if (clanWarMember != null) {
      if (clanWar.attacksPerMember == 2) {
        if (clanWarMember.attacks.length == 2) {
          description += await createDescriptionAttack(
            clanWarMember.attacks[0],
          );
          description += await createDescriptionAttack(
            clanWarMember.attacks[1],
          );
        } else if (clanWarMember.attacks.length == 1) {
          description += await createDescriptionAttack(
            clanWarMember.attacks[0],
          );
          description += `${config.emote.sword} **1 attack remaining**\n`;
        } else {
          description += `${config.emote.sword} ${config.emote.sword} **2 attacks remaining**\n`;
        }
      } else if (clanWar.attacksPerMember == 1) {
        if (clanWarMember.attacks.length == 1) {
          description += await createDescriptionAttack(
            clanWarMember.attacks[0],
          );
        } else {
          description += `${config.emote.sword} **1 attack remaining**\n`;
        }
      }
    } else {
      //description += `*not in war*\n`;
    }
  }
  return description;
}

async function createDescriptionAttacksSCCWL(
  clientCoc,
  clanWarLeagueGroup,
  scPlayer,
) {
  let description = "";
  let arrDescription = [];
  await Promise.all(
    clanWarLeagueGroup.rounds.map(async (round, index) => {
      arrDescription[index] = "";
      await Promise.all(
        round.warTags.map(async (warTag) => {
          let clanWar = await clientCoc.getClanWarLeagueRound(warTag);
          if (clanWar.state == "warEnded" || clanWar.state == "inWar") {
            if (
              clanWar.clan.tag == scPlayer.clan.tag ||
              clanWar.opponent.tag == scPlayer.clan.tag
            ) {
              const clanWarMember = await clanWar.getMember(scPlayer.tag);
              arrDescription[index] += `DAY ${index + 1}: `;
              if (clanWarMember != null) {
                if (clanWarMember.attacks.length > 0) {
                  arrDescription[index] += await createDescriptionAttack(
                    clanWarMember.attacks[0],
                  );
                } else {
                  arrDescription[index] +=
                    `${config.emote.sword} **1 attack remaining**\n`;
                }
              } else {
                arrDescription[index] += `*not in war*\n`;
              }
            }
          }
        }),
      );
    }),
  );
  arrDescription.forEach(function (value, index) {
    if (value != "") {
      description += `${arrDescription[index]}`;
    }
  });
  return description;
}

async function createDescriptionAttack(clanWarAttack) {
  let description = "";
  let star = ["", "", ""];
  let destruction = clanWarAttack.destruction;
  let left = 180 - clanWarAttack.duration;
  //if (destruction == 100) {
  //  description += ':boom: ';
  //};
  if (clanWarAttack.stars == 0) {
    star[0] = config.emote.starGray;
    star[1] = config.emote.starGray;
    star[2] = config.emote.starGray;
  } else if (clanWarAttack.stars == 1) {
    star[0] = config.emote.star;
    star[1] = config.emote.starGray;
    star[2] = config.emote.starGray;
  } else if (clanWarAttack.stars == 2) {
    star[0] = config.emote.star;
    star[1] = config.emote.star;
    star[2] = config.emote.starGray;
  } else if (clanWarAttack.stars == 3) {
    star[0] = config.emote.star;
    star[1] = config.emote.star;
    star[2] = config.emote.star;
  }
  description += `${star[0]}${star[1]}${star[2]}  **${destruction}%**  _${left}″ left_\n`;
  return description;
}

async function getAccInfoDescriptionHeroes(scPlayer, showAllEquipment, format) {
  let description = "";
  const logUnknownEquipment = (equipmentName, heroName = "unknown") => {
    console.error(
      `[getAccInfoDescriptionHeroes] unknown hero equipment: ${equipmentName} (hero: ${heroName}, player: ${scPlayer?.name ?? "unknown"}, tag: ${scPlayer?.tag ?? "unknown"})`,
    );
  };

  if (!scPlayer.heroes) {
    return "*ERROR*\n";
  }

  if (format == "long") {
    description += "\n";
    description += "* **HEROES**\n";
  }

  let hasHeroes = false;
  let hasHeroEquipments = false;

  let arrEqName = [];
  scPlayer.heroes.map((hero) => {
    if (hero.village == "home") {
      //console.log(hero.name, hero.isLoaded);

      hasHeroes = true;
      const foundEquipment = config_coc.heroes.find(
        (hero_config) => hero_config.name == hero.name,
      );
      if (!foundEquipment) {
        console.warn(`[getAccInfoDescriptionHeroes] unknown hero: ${hero.name}`);
        description += `[${hero.name}] `;
        return;
      }
      description += foundEquipment.emote;
      let hallMaxLevel = hero.hallMaxLevel;
      if (hero.name == "Minion Prince") {
        hallMaxLevel =
          config_coc.maxLevel.heroes.minionPrince[
            `th${scPlayer.townHallLevel}`
          ];
      }
      if (hero.name == "Dragon Duke") {
        hallMaxLevel =
          config_coc.maxLevel.heroes.dragonDuke[
            `th${scPlayer.townHallLevel}`
          ] ?? hero.hallMaxLevel;
      }
      if (hero.level == hallMaxLevel) {
        description += ` **${hero.level}/${hallMaxLevel}**`;
      } else {
        description += ` ${hero.level}/${hallMaxLevel}`;
      }
      description += ` `;

      if (hero.equipment) {
        hero.equipment.map((equipment) => {
          const foundEquipment = config_coc.heroEquipments.find(
            (equipment_config) => equipment_config.name == equipment.name,
          );
          let hallMaxLevel = 99;
          let emote = ":question:";
          if (foundEquipment) {
            hallMaxLevel =
              equipment.hallMaxLevel ??
              config_coc.maxLevel.heroEquipments[foundEquipment.type][
                `th${scPlayer.townHallLevel}`
              ];
            emote = foundEquipment.emote;
            /*if (foundEquipment.type == "epic") {
              numEpic += 1;
            }*/
          } else {
            logUnknownEquipment(equipment.name, hero.name);
          }
          description += ` ${emote}`;
          if (equipment.level == hallMaxLevel) {
            description += ` **${equipment.level}/${hallMaxLevel}**`;
          } else {
            description += ` ${equipment.level}/${hallMaxLevel}`;
          }
          arrEqName.push(equipment.name);
        });
      }
      description += `\n`;
    }
  });
  //escription += `_E${numEpic}_\n`;

  if (hasHeroes == false) {
    description += "*No heroes*\n";
  }

  if (showAllEquipment == true) {
    let equipmentCountInLine = 0;
    scPlayer.heroEquipment.map((equipment) => {
      //console.log(equipment.name);
      if (arrEqName.includes(equipment.name) == false) {
        const foundEquipment = config_coc.heroEquipments.find(
          (equipment_config) => equipment_config.name == equipment.name,
        );
        let hallMaxLevel = 99;
        let emote = ":question:";
        if (foundEquipment) {
          hallMaxLevel =
            equipment.hallMaxLevel ??
            config_coc.maxLevel.heroEquipments[foundEquipment.type][
              `th${scPlayer.townHallLevel}`
            ];
          emote = foundEquipment.emote;
        } else {
          logUnknownEquipment(equipment.name);
        }
        description += ` ${emote}`;
        if (equipment.level == hallMaxLevel) {
          description += ` **${equipment.level}/${hallMaxLevel}**`;
        } else {
          description += ` ${equipment.level}/${hallMaxLevel}`;
        }
        equipmentCountInLine += 1;
        if (equipmentCountInLine % 6 == 0) {
          description += `\n`;
        }
        hasHeroEquipments = true;
      }
    });
    if (hasHeroEquipments == true) {
      description += `\n`;
    }
  }

  return description;
}
export { getAccInfoDescriptionHeroes };

async function getAccInfoDescriptionSuperTroops(scPlayer, formatLength) {
  let description = "";
  if (formatLength == "long") {
    description += "\n";
    description += "* **SUPER TROOPS**\n";
  }

  const activeSuperTroops = scPlayer.superTroops.filter(
    (troop) => troop.isActive,
  );
  if (activeSuperTroops.length > 0) {
    description += activeSuperTroops.map((troop) => troop.name).join(" / ");
  } else {
    description += "*None*";
  }

  description += "\n";

  return description;
}
export { getAccInfoDescriptionSuperTroops };

async function getAccInfoDescriptionRankedBattles(
  scPlayer,
  mongoAcc,
  formatLength,
) {
  let description = "";
  if (formatLength == "long") {
    description += "\n";
    description += "* **RANKED BATTLES**\n";
  }

  const leagueTierConfig = config_coc.leagueTiers.find(
    (tier) => tier.id === scPlayer.leagueTier.id,
  );
  const leagueEmote = leagueTierConfig?.emote ?? config.emote.legend;
  const nBattles = leagueTierConfig?.nBattles ?? 0;

  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    const trophiesStart = mongoAcc?.legend?.current?.trophies ?? 0;
    const attackWinsStart = mongoAcc?.attackWins ?? 0;
    const diffAattackWins = scPlayer.attackWins - attackWinsStart;
    let diffTrophies = scPlayer.trophies - trophiesStart;
    if (diffTrophies >= 0) {
      diffTrophies = `+${diffTrophies}`;
    }
    description += `:trophy: **${scPlayer.trophies}** [${diffTrophies}] ${config.emote.sword} **${diffAattackWins}**/${nBattles}`;
  } else {
    description += `:trophy: ${scPlayer.trophies} ${config.emote.sword} **${scPlayer.attackWins}**/${nBattles}`;
  }

  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    description += ` ${leagueEmote} **${scPlayer.leagueTier.name}**`;
  } else {
    description += ` ${leagueEmote} ${scPlayer.leagueTier.name}`;
  }

  description += `\n`;

  return description;
}
export { getAccInfoDescriptionRankedBattles };

async function getAccInfoDescriptionTrophies(scPlayer, mongoAcc, formatLength) {
  let description = "";
  if (formatLength == "long") {
    description += "\n";
    if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
      description += "* **ATTACK WINS / DEFENSE WINS**\n";
    } else {
      description += "* **TROPHIES / ATTACK WINS / DEFENSE WINS**\n";
    }
  }
  let attackWinsStart = 0;
  let defenseWinsStart = 0;
  if (mongoAcc?.attackWins != null) {
    attackWinsStart = mongoAcc.attackWins;
  }
  if (mongoAcc?.defenseWins != null) {
    defenseWinsStart = mongoAcc.defenseWins;
  }

  let diffAattackWins = scPlayer.attackWins - attackWinsStart;
  let diffDefenseWins = scPlayer.defenseWins - defenseWinsStart;
  if (scPlayer.leagueTier.id == config_coc.leagueId.legend) {
    // Legend League
    if (formatLength == "short") {
      description += `:trophy: ${scPlayer.trophies} `;
    }
    description += `${config.emote.sword} ${diffAattackWins} ${config.emote.shield} ${diffDefenseWins}`;
  } else {
    description += `:trophy: ${scPlayer.trophies} ${config.emote.sword} ${diffAattackWins} ${config.emote.shield} ${diffDefenseWins}`;
  }
  description += `\n`;

  return description;
}
export { getAccInfoDescriptionTrophies };

async function getAccInfoDescriptionAccData(mongoAcc, formatLength) {
  let description = "";

  if (formatLength == "long") {
    description += `* **TROPHIES / ATTACK WINS / DEFENSE WINS**\n`;
    description += `:trophy: ${mongoAcc.trophies}`;
    description += `  ${config.emote.sword} ${mongoAcc.attackWins}`;
    description += `  ${config.emote.shield} ${mongoAcc.defenseWins}\n`;
    description += `\n`;
    description += `* **LEVELS SUMMARY**\n`;
  }

  description += createDescriptionLevels(
    config.emote.iconNormalTroops,
    mongoAcc.lvTroops.normal.level,
    mongoAcc.lvTroops.normal.maxLevel,
    "Nomal Troops",
  );
  description += createDescriptionLevels(
    config.emote.iconDarkTroops,
    mongoAcc.lvTroops.dark.level,
    mongoAcc.lvTroops.dark.maxLevel,
    "Dark Troops",
  );
  description += createDescriptionLevels(
    config.emote.iconNormalSpells,
    mongoAcc.lvSpells.normal.level,
    mongoAcc.lvSpells.normal.maxLevel,
    "Nomal Spells",
  );
  description += createDescriptionLevels(
    config.emote.iconDarkSpells,
    mongoAcc.lvSpells.dark.level,
    mongoAcc.lvSpells.dark.maxLevel,
    "Dark Spells",
  );
  description += createDescriptionLevels(
    config_coc.heroes[0].emote,
    mongoAcc.lvHeroes.level,
    mongoAcc.lvHeroes.maxLevel,
    "Heroes",
  );
  description += createDescriptionLevels(
    config_coc.heroEquipments[0].emote,
    mongoAcc.lvHeroEquipment.total.level,
    mongoAcc.lvHeroEquipment.total.maxLevel,
    "Hero Equipments",
  );
  description += createDescriptionLevels(
    config.emote.iconPets,
    mongoAcc.lvPets.level,
    mongoAcc.lvPets.maxLevel,
    "Pets",
  );
  description += createDescriptionLevels(
    config.emote.iconSieges,
    mongoAcc.lvSieges.level,
    mongoAcc.lvSieges.maxLevel,
    "Siege Machines",
  );

  return description;
}
export { getAccInfoDescriptionAccData };

function createDescriptionLevels(emote, level, maxLevel, strItem) {
  let description = "";
  if (maxLevel == 0) {
    return "";
  }
  if (level == maxLevel) {
    description += `${emote} **${level}/${maxLevel}** :white_check_mark: - ${strItem}\n`;
  } else {
    const rateGrowth = Math.round((level / maxLevel) * 100);
    let emoteRate = "";
    if (rateGrowth >= 95) {
      emoteRate = ":green_circle:";
    } else if (rateGrowth >= 90) {
      emoteRate = ":yellow_circle:";
    } else if (rateGrowth >= 85) {
      emoteRate = ":orange_circle:";
    } else {
      emoteRate = ":red_circle:";
    }
    description += `${emote} ${level}/${maxLevel} ( ${emoteRate}*${rateGrowth}%* ) - ${strItem}\n`;
  }
  return description;
}

async function getAccInfoDescriptionJWC(mongoAcc) {
  let description = "";

  description += `* **TEAM FOR JWC ${config.emote.jwc}**\n`;
  description += `J1/J2 *S${config.season.j}*: ${(mongoAcc?.homeClanAbbr?.j?.trim().toUpperCase() || "FREE") === "FREE" ? "*FREE*" : `**${mongoAcc.homeClanAbbr.j.toUpperCase()}**`}\n`;
  description += `SWISS *S${config.season.swiss}*: ${(mongoAcc?.homeClanAbbr?.swiss?.trim().toUpperCase() || "FREE") === "FREE" ? "*FREE*" : `**${mongoAcc.homeClanAbbr.swiss.toUpperCase()}**`}\n`;
  description += `MIX *S${config.season.mix}*: ${(mongoAcc?.homeClanAbbr?.mix?.trim().toUpperCase() || "FREE") === "FREE" ? "*FREE*" : `**${mongoAcc.homeClanAbbr.mix.toUpperCase()}**`}\n`;
  description += `5V *S${config.season.five}*: ${(mongoAcc?.homeClanAbbr?.five?.trim().toUpperCase() || "FREE") === "FREE" ? "*FREE*" : `**${mongoAcc.homeClanAbbr.five.toUpperCase()}**`}\n`;
  description += `\n`;

  return description;
}
export { getAccInfoDescriptionJWC };

async function scanAcc(clientCoc, playerTag) {
  let result = {};
  try {
    let scPlayer = await clientCoc.getPlayer(playerTag);
    //console.dir(scPlayer);
    result.status = "ok";
    result.scPlayer = scPlayer;
  } catch (error) {
    //console.error(error);
    result.status = error.reason;
    result.scPlayer = null;
  }

  return result;
}
export { scanAcc };

async function updateWarInfo(client, league, weekStr) {
  const description = await getDescriptionWarInfo(
    client.clientMongo,
    league,
    weekStr,
  );
  const footerText = `${config.footer} ${config.league[league]} S${config.season[league]}`;

  const embed = new EmbedBuilder()
    .setTitle(`**WEEK ${weekStr}**`)
    .setDescription(description)
    .setColor(config.color[league])
    .setFooter({ text: footerText, iconURL: config.urlImage.jwc })
    .setTimestamp();

  const query = {
    season: config.season[league],
    league: league,
    week: Number(weekStr),
  };
  const dbValueSch = await client.clientMongo
    .db(config.mongo.nameDatabase)
    .collection("war_info")
    .findOne(query);

  if (dbValueSch != null) {
    const message = await client.channels.cache
      .get(config.leagueCh[league])
      .messages.fetch(dbValueSch.message_id);
    if (message != null) {
      message.edit({ embeds: [embed] });
    }
  }

  return;
}
export { updateWarInfo };

async function updateRankingJwcAttack(client, league, lvTH) {
  const keyAttacks = "attacks";
  const iAttackType = "total";
  const query = {
    townHallLevel: lvTH,
    //[`league.${config.leagueM[league]}`]: league,
    [`stats.${league}.${keyAttacks}.${iAttackType}.nAttacks`]: { $gt: 0 },
    [`stats.${league}.season`]: config.season[league],
  };
  const sort = {
    [`stats.${league}.${keyAttacks}.${iAttackType}.nTriples`]: -1,
    [`stats.${league}.${keyAttacks}.${iAttackType}.nAttacks`]: 1,
    [`stats.${league}.${keyAttacks}.${iAttackType}.avrgDestruction`]: -1,
    [`stats.${league}.${keyAttacks}.${iAttackType}.avrgLeft`]: -1,
  };

  let nDisplay = 10;
  if (league == "mix") {
    nDisplay = 5;
  }

  const description = await fRanking.getDescriptionRankingJwcAttack(
    client.clientMongo,
    league,
    query,
    sort,
    "entire",
    lvTH,
    nDisplay,
    true,
    "false",
    iAttackType,
  );
  const footerText = `${config.footer} ${config.league[league]} S${config.season[league]}`;

  const embed = new EmbedBuilder();
  embed.setTitle(`${config.emote.sword} **TOP ATTACKERS**`);
  embed.setDescription(description[0]);
  embed.setColor(config.color[league]);
  embed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });
  embed.setTimestamp();

  const mongoSummaryRanking = await client.clientMongo
    .db(config.mongo.nameDatabase)
    .collection("ranking")
    .findOne({ name: "summary" });

  if (mongoSummaryRanking) {
    let messageId = mongoSummaryRanking.channelId[league];
    if (league == "mix") {
      messageId = mongoSummaryRanking.channelId[league]?.[`th${lvTH}`];
    }
    const channel = client.channels.cache.get(config.rankingCh[league]);
    if (channel && messageId) {
      try {
        const message = await channel.messages.fetch(messageId);
        if (message?.edit) {
          await message.edit({ embeds: [embed] });
        }
      } catch (e) {
        console.error(`updateRankingJwcAttack: failed to edit message (league=${league}, messageId=${messageId}):`, e.message);
      }
    }
  }

  return;
}
export { updateRankingJwcAttack };

async function getDescriptionWarInfo(clientMongo, league, weekStr) {
  const query = {
    season: config.season[league],
    league: league,
    week: Number(weekStr),
  };
  const sort = { match: 1 };
  const myColl = clientMongo.db(config.mongo.nameDatabase).collection("wars");
  const cursor = myColl.find(query).sort(sort);
  let dbValueWars = await cursor.toArray();
  await cursor.close();

  let arrDescription = [];
  await Promise.all(
    dbValueWars.map(async (dbValueWar, index) => {
      arrDescription[index] =
        `${await fGetWars.createDescription(clientMongo, dbValueWar, league, "multi")}`;
    }),
  );

  let description = "";
  arrDescription.forEach(function (value, index) {
    description += value;
  });

  return description;
}
export { getDescriptionWarInfo };

async function updateStatusInfo(client, unixTime) {
  const embed = await getEmbedStatusInfo(client.clientMongo, true, unixTime);

  const message = await client.channels.cache
    .get(config.logch.status)
    .messages.fetch(config.messageId.status);
  if (message != null) {
    message.edit({ embeds: [embed] });
  }

  return;
}
export { updateStatusInfo };

async function getEmbedStatusInfo(clientMongo, isAdmin, unixTime) {
  const embed = new EmbedBuilder();
  embed.setTitle("**BOT STATUS**");
  embed.setColor(config.color.main);

  /*
  const myColl = clientMongo.db(config.mongo.nameDatabase).collection('config');
  var query = { name: 'weekNow' };
  var cursor = myColl.find(query);
  const mongoWeekNow = await cursor.toArray();
  await cursor.close();

  var query = { name: 'status' };
  var cursor = myColl.find(query);
  const mongoStatusNow = await cursor.toArray();
  await cursor.close();
  */

  let description = "";

  description += "* **Current Week**\n";
  description += await getDescriptionStatusInfo("j1");
  description += await getDescriptionStatusInfo("j2");
  description += await getDescriptionStatusInfo("swiss");
  description += await getDescriptionStatusInfo("mix");
  description += await getDescriptionStatusInfo("five");

  description += "\n";
  description += "* **Last Update**\n";
  if (isAdmin == true) {
    description += `<t:${unixTime}:f> (<t:${unixTime}:R>)\n`;
  } else {
    description += `<#${config.logch.status}>\n`;
    embed.setTimestamp();
  }
  embed.setDescription(description);

  const footerText = `${config.footer}`;
  embed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });

  return embed;
}
export { getEmbedStatusInfo };

async function getDescriptionStatusInfo(league) {
  let description = "";

  description += `${config.league[league]}: **Week ${config.weekNow[league]}**`;
  if (config.cronWarStatus[league] == "on") {
    description += " :green_circle: _active_";
  }
  description += "\n";

  return description;
}

async function updateStatusInfoLegend(client, seasonData) {
  const embed = await getEmbedStatusInfoLegend(client, seasonData);

  const message = await client.channels.cache
    .get(config.logch.status)
    .messages.fetch(config.messageId.statusLegend);
  if (message != null) {
    message.edit({ embeds: [embed] });
  }

  return;
}
export { updateStatusInfoLegend };

async function getEmbedStatusInfoLegend(client, seasonData) {
  const embed = new EmbedBuilder();
  embed.setTitle("**BOT STATUS [LEGEND]**");
  embed.setColor(config.color.legend);

  let description = "";

  description += "* **Start**\n";
  const unixTimeSeasonStart = Math.floor(
    new Date(seasonData.seasonStart) / 1000,
  );
  description += `<t:${unixTimeSeasonStart}:f> (<t:${unixTimeSeasonStart}:R>)\n`;

  description += "* **End**\n";
  const unixTimeSeasonEnd = Math.floor(new Date(seasonData.seasonEnd) / 1000);
  description += `<t:${unixTimeSeasonEnd}:f> (<t:${unixTimeSeasonEnd}:R>)\n`;

  description += "* **Current Day**\n";
  description += `Day ${seasonData.daysNow}\n`;

  description += "* **Days Remaining**\n";
  description += `${seasonData.daysEnd} ${seasonData.daysEnd === 1 ? "day" : "days"}\n`;

  description += "\n";
  description += "* **Last Update**\n";
  const unixTime = Math.floor(Date.now() / 1000);
  description += `<t:${unixTime}:f> (<t:${unixTime}:R>)\n`;

  embed.setDescription(description);

  const footerText = `SEASON ${seasonData.seasonId}`;
  embed.setFooter({ text: footerText, iconURL: config.urlImage.legend });

  // Write status information to MongoDB
  try {
    const statusData = {
      seasonId: seasonData.seasonId,
      seasonStart: seasonData.seasonStart,
      seasonEnd: seasonData.seasonEnd,
      unixTimeSeasonStart: unixTimeSeasonStart,
      unixTimeSeasonEnd: unixTimeSeasonEnd,
      currentDay: seasonData.daysNow,
      daysRemaining: seasonData.daysEnd,
      lastUpdate: new Date(),
      unixTimeLastUpdate: unixTime,
      timestamp: Date.now(),
    };

    await client.clientMongo
      .db("jwc")
      .collection("config")
      .updateOne({ name: "rankedBattlesSeason" }, { $set: statusData });
  } catch (error) {
    console.error("Error writing status info to MongoDB:", error);
  }

  return embed;
}
export { getEmbedStatusInfoLegend };

async function setDescriptionClanList(client, iLeague, season) {
  let return_arr = ["", "", "", "", ""];

  const query = {
    league: iLeague,
    [`status.${seasonToString(season)}`]: { $in: ["true", "question"] },
  };
  const projection = {
    _id: 0,
    division: 1,
    clan_abbr: 1,
    clan_name: 1,
    clan_tag: 1,
    team_name: 1,
    status: 1,
  };
  const sort = { clan_abbr: 1 };
  const options = { projection: projection, sort: sort };
  const myColl = client.clientMongo.db("jwc").collection("clans");
  const cursor = myColl.find(query, options);
  let clans = await cursor.toArray();
  await cursor.close();

  await Promise.all(
    clans.map(async (clan, index) => {
      if (index < 12) {
        return_arr[0] += setDescriptionClanListOne(
          iLeague,
          index,
          season,
          clan,
        );
      } else if (index < 24) {
        return_arr[1] += setDescriptionClanListOne(
          iLeague,
          index,
          season,
          clan,
        );
      } else if (index < 36) {
        return_arr[2] += setDescriptionClanListOne(
          iLeague,
          index,
          season,
          clan,
        );
      } else if (index < 48) {
        return_arr[3] += setDescriptionClanListOne(
          iLeague,
          index,
          season,
          clan,
        );
      } else if (index < 60) {
        return_arr[4] += setDescriptionClanListOne(
          iLeague,
          index,
          season,
          clan,
        );
      }
    }),
  );

  return return_arr;
}
export { setDescriptionClanList };

function setDescriptionClanListOne(iLeague, index, season, clan) {
  let status = clan.status[`${seasonToString(season)}`];
  let clanLink =
    clan.clan_tag !== null
      ? "https://link.clashofclans.com/?action=OpenClanProfile&tag=" +
        clan.clan_tag.replace("#", "")
      : null;

  let return_str = "";

  let statusEmote = "";
  if (clan.clan_tag == "non-registered") {
    statusEmote = ":exclamation:";
  } else if (status == "true") {
    statusEmote = ":white_check_mark:";
  } else if (status == false) {
    statusEmote = ":x:";
  } else {
    statusEmote = ":question:";
  }

  return_str += `${index + 1}. **${clan.clan_abbr.toUpperCase()} | ${clan.team_name}** ${statusEmote}\n`;
  const clanStr =
    clan.clan_tag !== null
      ? `[__**${clan.clan_tag}**__](${clanLink}) ${clan.clan_name}\n`
      : ":question:\n";
  return_str += clanStr;

  if (
    clan.division != null &&
    clan.division != "" &&
    clan.division != "NO DIVISION"
  ) {
    return_str += `*${clan.division.toUpperCase()}*\n`;
  }
  let clanAbbrRoster = clan.clan_abbr.toUpperCase().replace("-", "_");
  if (iLeague == "j1" || iLeague == "j2") {
    clanAbbrRoster = "J_" + clanAbbrRoster;
  }
  /*
  if (iLeague != 'five') {
    const rosterLink = 'https://docs.google.com/spreadsheets/d/' + config.ssId[clanAbbrRoster] + '/edit?usp=sharing';
    return_str += `[__ROSTER | ${clanAbbr.toUpperCase()}__](${rosterLink})\n`;
    return_str += `\n`;
  };
  */
  return return_str;
}

async function getDescriptionNego(
  league,
  week,
  teamNameA,
  teamNameB,
  matchName,
) {
  let objReturn = {};

  let myContent = "";
  let myDescription = "";

  let options = {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  };

  if (league == "five") {
    myContent += `* 本対戦に関する連絡や交渉はこちらのチャンネル内でのみお願いします。\n`;
    myContent += `* 下記の基準日を含めて ${schedule.dateDef5v.period[`w${week}`]} 日以内に対戦を実施してください。\n`;
    myContent += `* マッチング時間は 22:00 または 23:00 としてください。\n`;
    myContent += `* 交渉結果は </rep deal_war_5v:1229035726549680191> コマンドで報告してください。\n`;
    myContent += `* 対戦の申請はホームチームから行ってください。\n`;

    myDescription += `**HOME: ${teamNameA}**\n`;
    myDescription += `**AWAY: ${teamNameB}**\n`;
    myDescription += `\n`;
    myDescription += `対戦人数： **${config.bd[league]}** ${config.emote.thn[config.lvTH]}\n`;
    myDescription += `攻撃回数： **${config.nHit[league]}** 回\n`;
    myDescription += `対戦モード： **eSports Mode**:fire:\n`;
    myDescription += `\n`;
    myDescription += `基準日・基準時間 (JST)：\n`;
    myDescription += `:calendar: ${schedule.dateDef5v.day[`w${week}`].toLocaleDateString("ja-JP", options)}\n`;
    myDescription += `:alarm_clock: ${schedule.dateDef5v.time[`w${week}`]} ポチ\n`;
    myDescription += `:hourglass_flowing_sand: ${schedule.timePrep[league]} 分 / :crossed_swords: ${schedule.timeBattle[league]} 分\n`;
  } else if (league != "five") {
    myContent += `* 交渉はこちらのチャンネル内でのみお願いします。\n`;
    myContent += `* 日程と、どちらから申請するかを決めてください。\n`;
    myContent += `* 交渉結果は </rep deal_war:1229035726549680191> コマンドで報告してください。 <#1123531433475063818>\n`;
    myContent += `* 下記の基準日から変更する場合は、必ず基準期間内に __マッチング__ するようご注意ください。\n`;

    myDescription += `**${teamNameA}** :vs: **${teamNameB}**\n`;
    myDescription += `\n`;

    if (league == "swiss" || league == "mix") {
      myDescription += `対戦人数（固定）： `;
    } else {
      myDescription += `対戦人数（増加可）： `;
    }

    if (league == "mix") {
      config.lvTHmix.forEach((lvTH, index) => {
        myDescription += `**${config.bd["mix"][`th${lvTH}`]}** ${config.emote.thn[lvTH]}`;
        if (index == config.lvTHmix.length - 1) {
          myDescription += `\n`;
        } else {
          myDescription += ` / `;
        }
      });
    } else {
      if (league == "j1j2") {
        league = "j2";
      }
      let bd = config.bd[league];
      myDescription += `**${bd}** ${config.emote.thn[config.lvTH]}\n`;
    }

    myDescription += `攻撃回数： **${config.nHit[league]}** 回\n`;
    myDescription += `対戦モード： **${config.mode[league]}**:fire:\n`;
    myDescription += `\n`;
    myDescription += `基準日：\n`;
    myDescription += `:calendar: ${schedule.dateDef[league].day[`w${week}`].toLocaleDateString("ja-JP", options)}\n`;
    myDescription += `:alarm_clock: 11:00 ポチ\n`;
    myDescription += `:hourglass_flowing_sand: ${schedule.timePrep[league]} 時間 / :crossed_swords: ${schedule.timeBattle[league]} 時間\n`;
    myDescription += `\n`;
    myDescription += `基準期間：\n`;
    myDescription += `${schedule.dateDef[league].start[`w${week}`].toLocaleDateString("ja-JP", options)} ～ `;
    myDescription += `${schedule.dateDef[league].end[`w${week}`].toLocaleDateString("ja-JP", options)}\n`;
  }

  objReturn.content = myContent;
  objReturn.description = myDescription;

  return objReturn;
}
export { getDescriptionNego };

async function sendClanInfo(interaction, client, clanAbbr) {
  const nameCollection = "clans";
  const query = { clan_abbr: clanAbbr };
  const options = {};
  const myColl = client.clientMongo
    .db(config.mongo.nameDatabase)
    .collection(nameCollection);
  const mongoClan = await myColl.findOne(query, options);

  let clanLink = "";
  if (mongoClan.clan_tag) {
    clanLink =
      "https://link.clashofclans.com/?action=OpenClanProfile&tag=" +
      mongoClan.clan_tag.slice(1);
  }

  let myTitle = clanAbbr.toUpperCase();
  if (mongoClan.team_name) {
    myTitle += ` | ${mongoClan.team_name}`;
  } else {
    myTitle += ` | NO TEAM NAME`;
  }

  let myDescription = "";

  myDescription += "### LEAGUE";
  myDescription += `\n`;
  myDescription += config.leaguePlusEmote[mongoClan.league];
  if (
    mongoClan.division != null &&
    mongoClan.division != "" &&
    mongoClan.division != "NO DIVISION"
  ) {
    myDescription += ` - *${mongoClan.division.toUpperCase()}*`;
  }
  myDescription += `\n\n`;

  myDescription += "### STATUS";
  myDescription += `\n`;
  let statusEmote = "";
  if (!mongoClan.status) {
    statusEmote = ":question:";
  } else {
    let status =
      mongoClan.status[seasonToString(config.seasonNext[mongoClan.league])];
    if (status == "true") {
      statusEmote = ":white_check_mark:";
    } else if (status == "false") {
      statusEmote = ":x:";
    } else {
      statusEmote = ":question:";
    }
  }
  myDescription += ` ${statusEmote} SEASON ${config.seasonNext[mongoClan.league]}`;
  myDescription += `\n\n`;

  myDescription += "### REPS";
  myDescription += `\n`;
  if (!mongoClan.rep_1st) {
    myDescription += `:one: :question:\n`;
    myDescription += `:two: :question:\n`;
  } else if (!mongoClan.rep_2nd) {
    if (mongoClan.rep_1st.id == null) {
      myDescription += `:one: *${mongoClan.rep_1st}*\n`;
    } else {
      let username1 = mongoClan.rep_1st.username;
      if (username1.includes("__")) {
        username1 = username1.replace(/__/g, "\\__");
      }
      myDescription += `:one: ${username1} <@!${mongoClan.rep_1st.id}>\n`;
    }
    myDescription += `:two: :question:\n`;
  } else {
    if (mongoClan.rep_1st.id == null) {
      myDescription += `:one: *${mongoClan.rep_1st}*\n`;
    } else {
      let username1 = mongoClan.rep_1st.username;
      if (username1.includes("__")) {
        username1 = username1.replace(/__/g, "\\__");
      }
      myDescription += `:one: ${username1} <@!${mongoClan.rep_1st.id}>\n`;
    }
    if (mongoClan.rep_2nd.id == null) {
      myDescription += `:two: *${mongoClan.rep_2nd}*\n\n`;
    } else {
      let username2 = mongoClan.rep_2nd.username;
      if (username2.includes("__")) {
        username2 = username2.replace(/__/g, "\\__");
      }
      myDescription += `:two: ${username2} <@!${mongoClan.rep_2nd.id}>\n\n`;
    }
    if (mongoClan.rep_3rd != null) {
      if (mongoClan.rep_3rd.id == null) {
        myDescription += ``;
      } else {
        let username3 = mongoClan.rep_3rd.username;
        if (username3.includes("__")) {
          username3 = username3.replace(/__/g, "\\__");
        }
        myDescription += `:three: ${username3} <@!${mongoClan.rep_3rd.id}>\n\n`;
      }
    }
  }

  myDescription += "### CLAN";
  myDescription += `\n`;
  if (mongoClan.clan_tag) {
    let apiClan = await client.clientCoc.getClan(mongoClan.clan_tag);
    if (apiClan.isWarLogPublic == true) {
      myDescription += `[__**${mongoClan.clan_tag}**__](${clanLink}) :ballot_box_with_check:\n`;
    } else {
      myDescription += `[__**${mongoClan.clan_tag}**__](${clanLink}) :x: *War Log is NOT Public*\n`;
    }
    myDescription += `${mongoClan.clan_name}\n`;
  } else {
    myDescription += `:exclamation: *clan is not registered*\n`;
  }
  myDescription += `\n`;

  myDescription += "### ROSTER";
  myDescription += `\n`;
  try {
    const { players, accounts } = await getTeamInfo(
      client,
      mongoClan.league,
      mongoClan.clan_abbr,
    );
    myDescription += `*${players} players, ${accounts} accounts*\n`;
    myDescription += `${config.emote.discord} </info roster team:1225810453918253116>\n`;
    myDescription += `${config.emote.discord} </rep my_roster:1229035726549680191> [for reps]\n`;
    myDescription += `\n`;
  } catch (error) {
    console.error(error.message);
    myDescription += "*no account registered*\n";
    myDescription += `\n`;
  }

  if (mongoClan.rep_channel != null) {
    myDescription += "### TEAM CHANNEL [REP SERVER]";
    myDescription += `\n`;
    myDescription += `<#${mongoClan.rep_channel}>\n`;
    myDescription += `\n`;
  }

  myDescription += "### TEAM CHANNEL [LOCAL SERVER]";
  myDescription += `\n`;
  if (mongoClan.log) {
    myDescription += `* Main: `;
    if (mongoClan.log.main.switch == "on") {
      myDescription += `<#${mongoClan.log.main.channel_id}>\n`;
    } else {
      myDescription += `off\n`;
    }

    myDescription += `* Deal: `;
    if (mongoClan.log.deal.switch == "on") {
      myDescription += `<#${mongoClan.log.deal.channel_id}>\n`;
    } else {
      myDescription += `off\n`;
    }

    myDescription += `* Start: `;
    if (mongoClan.log.start.switch == "on") {
      myDescription += `<#${mongoClan.log.start.channel_id}>\n`;
    } else {
      myDescription += `off\n`;
    }

    myDescription += `* Attacks & Defenses: `;
    if (mongoClan.log.att_def.switch == "on") {
      myDescription += `<#${mongoClan.log.att_def.channel_id}>\n`;
    } else {
      myDescription += `off\n`;
    }

    myDescription += `* End: `;
    if (mongoClan.log.end.switch == "on") {
      myDescription += `<#${mongoClan.log.end.channel_id}>\n`;
    } else {
      myDescription += `off\n`;
    }
  }
  myDescription += `${config.emote.discord} </rep edit my_channel:1229035726549680191> [for reps]\n`;

  let embed = new EmbedBuilder()
    .setTitle(myTitle)
    .setDescription(myDescription)
    .setColor(config.color.main)
    .setThumbnail(mongoClan.logo_url)
    .setFooter({ text: config.footer, iconURL: config.urlImage.jwc });

  await interaction.followUp({ embeds: [embed] });
}
export { sendClanInfo };

async function getTeamInfo(client, league, teamAbbr) {
  const teamList = await client.clientMongo
    .db("jwc")
    .collection("config")
    .findOne({ name: "teamList" });

  const team = teamList[league].find((team) => team.team_abbr === teamAbbr);

  if (!team) {
    throw new Error(
      `Team with abbreviation ${teamAbbr.toUpperCase()} has no account registered in ${config.league[league]} league`,
    );
  }

  return {
    players: team.players,
    accounts: team.accounts,
  };
}

async function editRoleMain(interaction, user, action, league, flagReturn) {
  // 小数のseasonに対応するため、文字列として処理
  const seasonValue = config.seasonNext[league];
  const seasonStr = seasonToString(seasonValue);
  const roleIdAll = config.roleId.repsServer[seasonStr].all;
  const roleIdLeague = config.roleId.repsServer[seasonStr][league];
  const roleIdJ1 = config.roleId.repsServer[seasonStr].j1;
  const roleIdJ2 = config.roleId.repsServer[seasonStr].j2;
  const roleIdS = config.roleId.repsServer[seasonStr].swiss;
  const roleIdM = config.roleId.repsServer[seasonStr].mix;
  const arrRolesAll = [roleIdJ1, roleIdJ2, roleIdS, roleIdM];

  if (action == "add") {
    if (
      !interaction.guild.members.cache
        .get(user.id)
        ._roles.includes(roleIdLeague)
    ) {
      await editRole(interaction, user, roleIdLeague, action, flagReturn);
    }
    if (
      !interaction.guild.members.cache.get(user.id)._roles.includes(roleIdAll)
    ) {
      await editRole(interaction, user, roleIdAll, action, flagReturn);
    }
  } else if (action == "remove") {
    await editRole(interaction, user, roleIdLeague, action, flagReturn);
    if (
      !interaction.guild.members.cache.get(user.id)._roles.includes(roleIdJ1)
    ) {
      if (
        !interaction.guild.members.cache.get(user.id)._roles.includes(roleIdJ2)
      ) {
        if (
          !interaction.guild.members.cache.get(user.id)._roles.includes(roleIdM)
        ) {
          if (
            !interaction.guild.members.cache
              .get(user.id)
              ._roles.includes(roleIdS)
          ) {
            await editRole(interaction, user, roleIdAll, action, flagReturn);
          }
        }
      }
    }
  }
}
export { editRoleMain };

async function editRoleMain5v(interaction, user, action, flagReturn) {
  // 小数のseasonに対応するため、文字列として処理
  const seasonValue = config.seasonNext.five;
  const seasonStr = seasonToString(seasonValue);
  const repId = config.roleId.repsServer5v[seasonStr];

  if (action == "add") {
    if (!interaction.guild.members.cache.get(user.id)._roles.includes(repId)) {
      await editRole(interaction, user, repId, action, flagReturn);
    }
  } else if (action == "remove") {
    await editRole(interaction, user, repId, action, flagReturn);
  }
}
export { editRoleMain5v };

async function editRole(interaction, user, roleId, action, flagReturn) {
  let title = ``;
  let description = ``;

  if (action == "add" && flagReturn == 1) {
    if (interaction.guild.members.cache.get(user.id)._roles.includes(roleId)) {
      title = `*ERROR*`;
      description = `<@!${user.id}>\n`;
      description += `already has the role, <@&${roleId}>\n`;
      followUpEmbed(interaction, title, description);
      return;
    }
  }

  const obj = { user: user, role: roleId };
  if (action == "add") {
    title = `:white_check_mark: *ROLE ADDED*`;
    await interaction.guild.members.addRole(obj);
  } else if (action == "remove") {
    title = `*ROLE REMOVED*`;
    //console.dir(user);
    await interaction.guild.members.removeRole(obj);
  }

  description = `<@&${roleId}>\n`;
  description += `<@!${user.id}>\n`;

  let embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(config.color.main)
    .setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  await interaction.followUp({ embeds: [embed] });

  return;
}
export { editRole };

function detectTownHallLevel(league, lvTownHall) {
  if (
    league == "j1" ||
    league == "j2" ||
    league == "swiss" ||
    league == "five"
  ) {
    if (lvTownHall == config.lvTH) {
      return true;
    }
  } else if (league == "mix") {
    /*if (config.lvTHmix.includes(lvTownHall)) {
      return true;
    };*/
    if (
      config.rangeLvTH.min <= lvTownHall &&
      lvTownHall <= config.rangeLvTH.max
    ) {
      return true;
    }
  }
  return false;
}
export { detectTownHallLevel };

//スラッシュコマンドの実行ログをログチャンネルに出力
async function logInteraction(interaction, client) {
  try {
    if (interaction.user.id != config.yamaId) {
      const log = new EmbedBuilder()
        .setTitle("**INTERACTION LOG**")
        .setColor(config.color.main)
        .setTimestamp()
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          {
            name: "COMMAND",
            value: "```\n" + interaction.toString() + "\n```",
          },
          {
            name: "USER",
            value: `${interaction.user.tag}\n<@!${interaction.user.id}>`,
            inline: false,
          },
          {
            name: "SERVER",
            value: `${interaction.guild?.name ?? "DM"}`,
            inline: false,
          },
        );
      //.setFooter({ text: String(interaction.id) });
      let channelName = interaction.channel?.name ?? "undefiend";
      let channelId = interaction.channel?.id ?? "DM";
      if (channelId != "DM") {
        log.addFields({
          name: "CHANNEL",
          value: `${channelName} <#${channelId}>\n`,
          inline: false,
        });
      }
      client.channels.cache.get(config.logch.command).send({ embeds: [log] });
    }
  } catch (error) {
    console.error(error);
  }
}
export { logInteraction };

// 関数：文字列にtime stampを追加
function plusTime(myString) {
  let return_str;
  return_str = `[${timeToJST(Date.now(), true)}] ` + myString;
  return return_str;
}
export { plusTime };

// JSTタイムスタンプから日付
function timeToJST(timestamp, format = false) {
  const dt = timeToJSTTimestamp(timestamp);
  const year = dt.getFullYear();
  const month = dt.getMonth() + 1;
  const date = dt.getDate();
  const hour = dt.getHours();
  const minute = dt.getMinutes();
  const second = dt.getSeconds();

  let return_str;
  if (format == true) {
    return_str = `${year}/${month}/${date} ${hour}:${minute}:${second}`;
  } else {
    return_str = {
      year: year,
      month: month,
      date: date,
      hour: hour,
      minute: minute,
      second: second,
    };
  }
  return return_str;
}
export { timeToJST };

// タイムスタンプをJSTタイムスタンプに変換
function timeToJSTTimestamp(timestamp) {
  var dt = new Date(); // Date オブジェクトを作成
  var tz = dt.getTimezoneOffset(); // サーバーで設定されているタイムゾーンの世界標準時からの時差（分）
  tz = (tz + 540) * 60 * 1000; // 日本時間との時差(9時間=540分)を計算し、ミリ秒単位に変換

  dt = new Date(timestamp + tz); // 時差を調整した上でタイムスタンプ値を Date オブジェクトに変換
  return dt;
}
export { timeToJSTTimestamp };

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
export { sleep };

// 小数のseasonを文字列に変換する関数（ピリオドをアンダースコアに変換）
function seasonToString(seasonValue) {
  return Number.isInteger(seasonValue)
    ? `s${seasonValue}`
    : `s${String(seasonValue).replace(".", "_")}`;
}
export { seasonToString };

function calculateSeasonValues(client, now = new Date()) {
  const season = client.utilCoc.getSeason();
  const seasonStart = season.startTime;
  const seasonEnd = season.endTime;
  const seasonId = season.seasonId;

  const tournamentWindow = client.utilCoc.getTournamentWindow();

  const MS = 24 * 60 * 60 * 1000;
  // 端数や時計ズレのガードで 0 未満は切り上げ
  const daysNow = Math.max(
    1,
    Math.floor((now.getTime() - seasonStart.getTime()) / MS) + 1,
  );
  const daysEnd = Math.max(
    0,
    Math.floor((seasonEnd.getTime() - now.getTime()) / MS) + 1,
  );

  return { seasonStart, seasonEnd, seasonId, daysNow, daysEnd, tournamentWindow };
}
export { calculateSeasonValues };