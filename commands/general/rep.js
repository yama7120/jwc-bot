import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import config from '../../config/config.js';
import * as functions from '../../functions/functions.js';
import * as fMongo from '../../functions/fMongo.js';
import * as fRoster from '../../functions/fRoster.js';

const nameCommand = 'rep';
let data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription('no description')
  // 0
  .addSubcommand((subcommand) =>
    subcommand
      .setName('deal_war')
      .setDescription(config.command[nameCommand].subCommand['deal_war'])
      .addStringOption((option) =>
        option
          .setName('date')
          .setDescription('マッチング日（選択）')
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((option) =>
        option
          .setName('time')
          .setDescription('マッチング時刻（選択リスト以外の入力可）')
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption(
        (option) =>
          option
            .setName('prep_time')
            .setDescription('準備時間（選択）')
            .setRequired(true),
        //.setAutocomplete(true)
      )
      .addStringOption(
        (option) =>
          option
            .setName('battle_time')
            .setDescription('対戦時間（選択）')
            .setRequired(true),
        //.setAutocomplete(true)
      )
      .addStringOption((option) =>
        option
          .setName('send')
          .setDescription('申請側クラン（選択）')
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((option) =>
        option.setName('size').setDescription('対戦人数（選択）'),
      ),
  )
  // 1
  .addSubcommand((subcommand) =>
    subcommand
      .setName('my_roster')
      .setDescription(config.command[nameCommand].subCommand['my_roster']),
  )
  // 3
  .addSubcommand((subcommand) =>
    subcommand
      .setName('my_team_information')
      .setDescription(
        config.command[nameCommand].subCommand['my_team_information'],
      ),
  )
  // 4
  .addSubcommandGroup((subcommandgroup) =>
    subcommandgroup
      .setName('edit')
      .setDescription('no description')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('team_information')
          .setDescription(
            config.command[nameCommand].subCommandGroup['edit'][
              'team_information'
            ],
          )
          /*.addStringOption(option =>
            option
              .setName('league')
              .setDescription('リーグ')
              .setRequired(true)
          )*/
          .addStringOption((option) =>
            option
              .setName('team')
              .setDescription('チーム')
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName('division')
              .setDescription('ディビジョン / グループ')
              .addChoices(
                { name: 'TBD', value: 'tbd' },
                { name: 'FIST', value: 'fist' },
                { name: 'CLOAK', value: 'cloak' },
                { name: 'TOME', value: 'tome' },
                { name: 'SHIELD', value: 'shield' },
                { name: 'A', value: 'a' },
                { name: 'B', value: 'b' },
              ),
          )
          .addStringOption((option) =>
            option.setName('clan_tag').setDescription('使用クランタグ'),
          )
          .addStringOption((option) =>
            option
              .setName('team_name')
              .setDescription(
                'チーム名（未記入の場合はクラン名がチーム名になります）',
              ),
          )
          .addStringOption((option) =>
            option.setName('logo_url').setDescription('クランロゴのURL'),
          )
          .addUserOption((option) =>
            option.setName('rep_1st').setDescription('代表者1'),
          )
          .addUserOption((option) =>
            option
              .setName('rep_2nd')
              .setDescription('代表者2（CUP では任意）'),
          )
          .addUserOption((option) =>
            option.setName('rep_3rd').setDescription('代表者3（オプション）'),
          )
          .addStringOption((option) =>
            option
              .setName('change_league')
              .setDescription('リーグ昇格/降格')
              .addChoices(
                { name: 'J1', value: 'j1' },
                { name: 'J2', value: 'j2' },
              ),
          )
          .addStringOption((option) =>
            option
              .setName('status_season')
              .setDescription('status の対象シーズン（未指定＝次シーズン）')
              .addChoices(
                { name: '今シーズン', value: 'current' },
                { name: '次シーズン', value: 'next' },
              ),
          )
          .addStringOption((option) =>
            option
              .setName('status')
              .setDescription('参加/不参加')
              .addChoices(
                { name: '参加', value: 'true' },
                { name: '未定', value: 'question' },
                { name: '不参加', value: 'false' },
              ),
          )
          .addStringOption((option) =>
            option.setName('remove').setDescription('削除').addChoices(
              //{ name: 'Log channel', value: 'logCh' },
              { name: '2nd rep', value: 'rep2nd' },
              { name: '3rd rep', value: 'rep3rd' },
              { name: 'All', value: 'all' },
            ),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('my_channel')
          .setDescription(
            config.command[nameCommand].subCommandGroup['edit']['my_channel'],
          )
          .addStringOption((option) =>
            option.setName('league').setDescription('リーグ').setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName('team')
              .setDescription('チーム')
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName('main')
              .setDescription('メイン（各チームコマンド実行）')
              .addChoices(
                { name: 'ON', value: 'on' },
                { name: 'OFF', value: 'off' },
              ),
          )
          .addStringOption((option) =>
            option
              .setName('deal')
              .setDescription('交渉結果')
              .addChoices(
                { name: 'ON', value: 'on' },
                { name: 'OFF', value: 'off' },
              ),
          )
          .addStringOption((option) =>
            option
              .setName('start')
              .setDescription('マッチング')
              .addChoices(
                { name: 'ON', value: 'on' },
                { name: 'OFF', value: 'off' },
              ),
          )
          .addStringOption((option) =>
            option
              .setName('attacks_defenses')
              .setDescription('攻撃/防衛')
              .addChoices(
                { name: 'ON', value: 'on' },
                { name: 'OFF', value: 'off' },
              ),
          )
          .addStringOption((option) =>
            option
              .setName('end')
              .setDescription('終戦')
              .addChoices(
                { name: 'ON', value: 'on' },
                { name: 'OFF', value: 'off' },
              ),
          ),
      ),
  )
  // 5
  .addSubcommandGroup((subcommandgroup) =>
    subcommandgroup
      .setName('roster')
      .setDescription('no description')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('new')
          .setDescription(
            config.command[nameCommand].subCommandGroup['roster']['new'],
          )
          .addStringOption((option) =>
            option
              .setName('account')
              .setDescription('プレイヤータグ')
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName('pilot_name')
              .setDescription('パイロット名')
              .setRequired(true),
          )
          .addUserOption((option) =>
            option
              .setName('pilot_dc')
              .setDescription('使用者の discord アカウント'),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('delete')
          .setDescription(
            config.command[nameCommand].subCommandGroup['roster']['delete'],
          )
          .addStringOption((option) =>
            option
              .setName('account')
              .setDescription(
                'プレイヤータグ（名前の一部を入力すると予測リストが更新されます）',
              )
              .setRequired(true)
              .setAutocomplete(true),
          ),
      ),
  );

config.choices.league4.forEach((choice) => {
  data.options[3].options[1].options[0].addChoices(choice);
});
// 日付選択肢は動的に生成するため、ここでは空の配列を初期化
let choices_date = [];
/*config.choices.time.forEach(choice => {
  data.options[0].options[1].addChoices(choice);
});
});*/
config.choices.prep_time.forEach((choice) => {
  data.options[0].options[2].addChoices(choice);
});
config.choices.battle_time.forEach((choice) => {
  data.options[0].options[3].addChoices(choice);
});
config.choices.size.forEach((choice) => {
  data.options[0].options[5].addChoices(choice);
});

export default {
  data: data,

  async autocomplete(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand == 'deal_war') {
      let focusedOption = interaction.options.getFocused(true);
      let focusedValue = interaction.options.getFocused();

      let mongoWar = await client.clientMongo
        .db('jwc')
        .collection('wars')
        .findOne(
          { nego_channel: interaction.channel.id },
          { projection: { league: 1, clan_abbr: 1, opponent_abbr: 1, _id: 0 } }
        );

      if (!mongoWar) {
        let description = '';
        description += `*ERROR: No war found*\n`;
        description += `channel: ${interaction.channel.id}\n`;
        await interaction.respond([
          {
            name: description,
            value: 'error',
          },
        ]);
        console.error(description);
        console.error('No war found');
        return;
      }

      let choices = [];
      if (focusedOption.name === 'date') {
        // 動的に日付選択肢を生成
        const today = new Date();
        const day_arr = ['日', '月', '火', '水', '木', '金', '土'];
        let dateChoices = [];
        
        for (let iDate = 0; iDate < 25; iDate++) {
          let date = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + iDate,
          );
          let dateJst = `${date.getMonth() + 1} 月 ${date.getDate()} 日 （${day_arr[date.getDay()]}）`;
          let timeUnix = String(date.getTime() / 1000);
          let dateObj = { name: dateJst, value: timeUnix };
          dateChoices.push(dateObj);
        }
        
        // 入力値でフィルタリング（部分一致）
        if (focusedValue) {
          dateChoices = dateChoices.filter(choice => 
            choice.name.toLowerCase().includes(focusedValue.toLowerCase())
          );
        }
        
        // Discordの制限（最大25個）に合わせて制限
        if (dateChoices.length > 25) {
          dateChoices = dateChoices.slice(0, 25);
        }
        
        await interaction.respond(dateChoices);
      } else if (focusedOption.name === 'time') {
        choices = config.choices.time;
        await interaction.respond(
          choices.map((choice) => ({ name: choice.name, value: choice.value })),
        );
      } else if (focusedOption.name === 'send') {
        let clanAbbr = mongoWar.clan_abbr;
        let opponentAbbr = mongoWar.opponent_abbr;
        choices = [clanAbbr.toUpperCase(), opponentAbbr.toUpperCase()];
        const q = String(focusedValue ?? '').toLowerCase();
        choices = choices.filter(function (choice) {
          return choice.toLowerCase().includes(q);
        });
        await interaction.respond(
          choices.map((choice) => ({ name: choice, value: choice })),
        );
      }
    } else if (subcommand == 'team_information') {
      let focusedOption = interaction.options.getFocused(true);
      if (focusedOption.name === 'team') {
        const mongoTeam = await client.clientMongo
          .db('jwc')
          .collection('clans')
          .findOne({ rep_channel: interaction.channel.id });

        if (mongoTeam) {
          await interaction.respond([
            {
              name: functions.formatTeamAutocompleteName(
                mongoTeam.clan_abbr,
                mongoTeam.team_name,
              ),
              value: mongoTeam.clan_abbr,
            },
          ]);
        }
      }
    } else if (subcommand == 'my_channel') {
      const focusedValue = interaction.options.getFocused();
      const iLeague = await interaction.options.getString('league');

      const query = {
        [`status.${functions.seasonToString(config.season[iLeague])}`]: 'true',
        league: iLeague,
      };
      const options = { projection: { _id: 0, clan_abbr: 1, team_name: 1 } };
      const sort = { clan_abbr: 1 };
      const cursor = client.clientMongo
        .db('jwc')
        .collection('clans')
        .find(query, options)
        .sort(sort);
      let mongoClans = await cursor.toArray();
      await cursor.close();

      mongoClans = mongoClans.filter(function (team) {
        return functions.teamMatchesAutocompleteFilter(team, focusedValue);
      });

      if (mongoClans.length >= 25) {
        mongoClans = mongoClans.filter(function (team, index) {
          return index < 25;
        });
      }

      if (mongoClans.length > 0) {
        await interaction.respond(
          mongoClans.map((team) => ({
            name: functions.formatTeamAutocompleteName(
              team.clan_abbr,
              team.team_name,
            ),
            value: team.clan_abbr,
          })),
        );
      }
    } else if (subcommandGroup == 'roster') {
      if (subcommand == 'delete') {
        const mongoTeam = await client.clientMongo
          .db('jwc')
          .collection('clans')
          .findOne({ rep_channel: interaction.channel.id });

        if (!mongoTeam) {
          await interaction.respond([]);
          console.error(
            `rep autocomplete: no team found for channel ${interaction.channel.id}`,
          );
          return;
        }

        const leagueM = config.leagueM[mongoTeam.league];
        if (!leagueM) {
          await interaction.respond([]);
          console.error(
            `rep autocomplete: invalid league "${mongoTeam.league}" for team ${mongoTeam.clan_abbr}`,
          );
          return;
        }

        const query = {
          [`homeClanAbbr.${leagueM}`]: mongoTeam.clan_abbr,
          status: true,
        };
        const projection = {
          _id: 0,
          tag: 1,
          name: 1,
          townHallLevel: 1,
          pilotName: 1,
        };
        const options = { projection: projection };
        const sort = { townHallLevel: -1 };
        const cursor = client.clientMongo
          .db('jwc')
          .collection('accounts')
          .find(query, options)
          .sort(sort);
        let accs = await cursor.toArray();
        await cursor.close();

        let focusedValue = interaction.options.getFocused();
        accs = accs.filter(function (acc) {
          return acc.name.includes(focusedValue);
        });
        if (accs.length >= 25) {
          accs = accs.filter(function (acc, index) {
            return index < 25;
          });
        }

        if (accs.length > 0) {
          await interaction.respond(
            accs.map((acc) => ({
              name: `${acc.tag} [TH${acc.townHallLevel}] ${acc.pilotName?.[leagueM] ?? '-'} | ${acc.name}`,
              value: acc.tag,
            })),
          );
        }
      }
    }
  },

  async execute(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand == 'deal_war') {
      await dealWar(client, interaction);
    } else if (subcommand == 'my_roster') {
      await myRoster(client, interaction);
    } else if (subcommand == 'my_team_information') {
      await myTeamInformation(client, interaction);
    } else if (subcommandGroup == 'roster') {
      if (subcommand == 'new') {
        await addRoster(client, interaction);
      } else if (subcommand == 'delete') {
        await deleteRoster(client, interaction);
      }
    } else if (subcommandGroup == 'edit') {
      if (subcommand == 'team_information') {
        await editTeamInformation(client, interaction);
      } else if (subcommand == 'my_channel') {
        await editMyChannel(client, interaction);
      }
    }

    return;
  },
};

async function addRoster(client, interaction) {
  const mongoTeam = await client.clientMongo
    .db('jwc')
    .collection('clans')
    .findOne({ rep_channel: interaction.channel.id });

  if (!mongoTeam) {
    await interaction.followUp({ content: '*ERROR: No Team*', ephemeral: true });
    return;
  }
  
  let league = mongoTeam.league;
  let leagueM = config.leagueM[league];
  let flagNG = 0;
  let townHallLevel = 0;
  let nameDiscord = '';
  let avatarUrl = '';
  let pilotDC = null;

  let title = '';
  let description = '';
  let embed = new EmbedBuilder();
  embed.setColor(config.color.main);
  embed.setThumbnail(mongoTeam.logo_url);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  embed.setTimestamp();

  if (interaction.user.id != config.adminId.yama) {
    const weekNow = await functions.getWeekNow(league);
    if (weekNow > config.weeksQ[league]) {
      title = 'ERROR';
      description = '*Registration is now closed.*';
      embed.setTitle(title);
      embed.setDescription(description);
      embed.setColor(config.color.red);
      await interaction.followUp({ embeds: [embed] });
      return;
    }
  }

  const iPlayerTag = await interaction.options.getString('account');
  const playerTag = functions.tagReplacer(iPlayerTag);
  const iPilotName = await interaction.options.getString('pilot_name');
  const iPilotDC = await interaction.options.getUser('pilot_dc');

  let mongoAcc = await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .findOne({ tag: playerTag, status: true });

  if (mongoAcc) {
    const pilotDCInfo = mongoAcc.pilotDC;
    if (isPilotDCLinked(pilotDCInfo)) {
      // Discordユーザーが登録済み
      description += `:bust_in_silhouette: ${iPilotName} <@!${pilotDCInfo.id}>\n`;
      nameDiscord = pilotDCInfo.globalName ?? pilotDCInfo.username;
      avatarUrl = pilotDCInfo.avatar
        ? `https://cdn.discordapp.com/avatars/${pilotDCInfo.id}/${pilotDCInfo.avatar}.png`
        : (pilotDCInfo.avatarUrl ?? config.urlImage.discord);
      pilotDC = pilotDCInfo;
    } else if (iPilotDC) {
      // DB登録済みだが未連携：オプションでDiscordアカウントを指定
      pilotDC = buildPilotDCFromUser(iPilotDC);
      description += `:bust_in_silhouette: ${iPilotName} <@!${iPilotDC.id}>\n`;
      nameDiscord = iPilotDC.globalName ?? iPilotDC.username;
      avatarUrl = pilotDC.avatarUrl ?? config.urlImage.discord;
    } else {
      // Discordユーザー未登録
      description += `:bust_in_silhouette: ${iPilotName}\n`;
    }
  } else if (iPilotDC) {
    // 新規Discordユーザー登録
    pilotDC = buildPilotDCFromUser(iPilotDC);
    description += `:bust_in_silhouette: ${iPilotName} <@!${iPilotDC.id}>\n`;
    nameDiscord = iPilotDC.globalName ?? iPilotDC.username;
    avatarUrl = pilotDC.avatarUrl ?? config.urlImage.discord;
  } else {
    // Discordユーザー未登録
    description += `:bust_in_silhouette: ${iPilotName}\n`;
  }
  if (nameDiscord && avatarUrl) {
    embed.setAuthor({ name: nameDiscord, iconURL: avatarUrl });
  }

  if (mongoAcc) {
    // データベース登録済み
    title = await functions.getAccInfoTitle(mongoAcc, 'long');
    description += await functions.getAccInfoDescriptionMain(mongoAcc, 'long');
    townHallLevel = mongoAcc.townHallLevel;
    const registeredClanAbbr = mongoAcc.homeClanAbbr?.[leagueM];

    if (registeredClanAbbr != '' && registeredClanAbbr != null) {
      // チーム登録済みかチェックする
      description += `\n:exclamation: *Already Registered:* **${String(registeredClanAbbr).toUpperCase()}**`;
      flagNG = 1;
    }
  } else {
    // データベース登録なし：新規登録
    let resultScan = await functions.scanAcc(client.clientCoc, playerTag);

    if (resultScan.status == 'ok') {
      title = await functions.getAccInfoTitle(resultScan.scPlayer, 'long');
      description += await functions.getAccInfoDescriptionMain(resultScan.scPlayer, 'long');
      townHallLevel = resultScan.scPlayer.townHallLevel;
    } else if (resultScan.status == 'notFound') {
      title = `**${resultScan.status}**`;
      description += playerTag;
      description += '\n';
      description += `*Invalid tag was inputted.*`;
      flagNG = 1;
    } else {
      title = `**${resultScan.status}**`;
      description += playerTag;
      description += '\n';
      description = `*Please try again later.*`;
      flagNG = 1;
    }
  }

  if (flagNG == 0) {
    if (functions.detectTownHallLevel(league, townHallLevel) == false) {
      description += '\n';
      description += ':exclamation: *Invalid town hall Level*\n';
      flagNG = 1;
    }
  }

  if (!validatePilotName(iPilotName)) {
    description += '\n';
    description += `*Invalid pilot name was inputted.*\n`;
    description += `*Please check here:* https://discord.com/channels/919210540436443146/1318018108446871644/1318926046413852714\n`;
    flagNG = 1;
  }

  if (flagNG == 0) {
    // OK -> mongoDB に登録
    if (mongoAcc) {
      let listingUpdate = {
        league: { ...(mongoAcc.league ?? {}) },
        homeClanAbbr: { ...(mongoAcc.homeClanAbbr ?? {}) },
        pilotName: { ...(mongoAcc.pilotName ?? {}) },
        pilotDC: mongoAcc.pilotDC,
      };
      listingUpdate.league[leagueM] = league;
      listingUpdate.homeClanAbbr[leagueM] = mongoTeam.clan_abbr;
      listingUpdate.pilotName[leagueM] = iPilotName;
      listingUpdate.pilotDC = pilotDC;
      await client.clientMongo
        .db('jwc')
        .collection('accounts')
        .updateOne({ tag: playerTag }, { $set: listingUpdate });
    } else {
      await fMongo.registerAcc(
        client,
        playerTag,
        iPilotName,
        mongoTeam.league,
        mongoTeam.clan_abbr,
        pilotDC,
      );
      await fMongo.updateAcc(client, playerTag);
    }
    description += '\n';
    description += `:white_check_mark: *Successfully registered to the roster of* **${mongoTeam.clan_abbr.toUpperCase()}** *team!*\n`;

    if (pilotDC == null) {
      description += `\n`;
      description += `${config.emote.discord} </link_account_to_discord new:${config.command.link_account_to_discord.id}>\n`;
      description += `to link the CoC account to a discord account\n`;
    }
  } else if (flagNG > 0) {
    // NG
    title = ':x:  ' + title;
    embed.setColor(config.color.red);
  }

  embed.setTitle(title);
  embed.setDescription(description);

  await interaction.followUp({ embeds: [embed] });

  const registrationLogChannel = client.channels.cache.get(
    config.logch.playerRegistration[league],
  );
  if (registrationLogChannel) {
    await registrationLogChannel.send({ embeds: [embed] });
  } else {
    console.error(
      `playerRegistration log channel not found for league ${league}`,
    );
  }

  if (flagNG == 0) {
    await fMongo.teamList(client.clientMongo, league);
  }
}

function isPilotDCLinked(pilotDCInfo) {
  return (
    pilotDCInfo &&
    pilotDCInfo !== 'no discord acc' &&
    pilotDCInfo !== '' &&
    pilotDCInfo.id
  );
}

function buildPilotDCFromUser(user) {
  const pilotDC = user;
  if (pilotDC.avatar == null) {
    pilotDC.avatarUrl =
      'https://cdn.discordapp.com/attachments/1143171140508991500/1318442274002309170/discord-round-black-icon.png';
  } else {
    pilotDC.avatarUrl = `https://cdn.discordapp.com/avatars/${pilotDC.id}/${pilotDC.avatar}.png`;
  }
  return pilotDC;
}

function validatePilotName(str) {
  const regex = /^([ぁ-んァ-ヶー]{1,8}|[a-zA-Z]{1,16})$/;
  return regex.test(str);
}

async function deleteRoster(client, interaction) {
  const mongoTeam = await client.clientMongo
    .db('jwc')
    .collection('clans')
    .findOne({ rep_channel: interaction.channel.id });

  if (!mongoTeam) {
    await interaction.followUp({ content: '*ERROR: No Team*', ephemeral: true });
    return;
  }

  const leagueM = config.leagueM[mongoTeam.league];
  if (!leagueM) {
    await interaction.followUp({
      content: '*ERROR: Invalid Team League*',
      ephemeral: true,
    });
    return;
  }

  const iPlayerTag = await interaction.options.getString('account');

  const mongoAcc = await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .findOne({ tag: iPlayerTag });

  if (!mongoAcc) {
    await interaction.followUp({ content: '*ERROR: No Account*', ephemeral: true });
    return;
  }
  
  let listingUpdate = {};
  listingUpdate.homeClanAbbr = { ...(mongoAcc.homeClanAbbr ?? {}) };
  listingUpdate.homeClanAbbr[leagueM] = '';
  await client.clientMongo
    .db('jwc')
    .collection('accounts')
    .updateOne({ tag: iPlayerTag }, { $set: listingUpdate });

  let title = '';
  let description = '';
  let embed = new EmbedBuilder();
  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  embed.setTimestamp();

  title = await functions.getAccInfoTitle(mongoAcc, 'long');
  description += await functions.getAccInfoDescriptionMain(mongoAcc, 'long');
  description += `\n`;
  description += `:white_check_mark: *The account has been unregistered from the roster of* ${mongoTeam.clan_abbr.toUpperCase()} *team*. :wave:`;

  embed.setTitle(title);
  embed.setDescription(description);

  await interaction.followUp({ embeds: [embed] });

  const registrationLogChannel = client.channels.cache.get(
    config.logch.playerRegistration[mongoTeam.league],
  );
  if (registrationLogChannel) {
    await registrationLogChannel.send({ embeds: [embed] });
  } else {
    console.error(
      `playerRegistration log channel not found for league ${mongoTeam.league}`,
    );
  }

  await fMongo.teamList(client.clientMongo, mongoTeam.league);
}

async function myRoster(client, interaction) {
  const mongoTeam = await client.clientMongo
    .db('jwc')
    .collection('clans')
    .findOne({ rep_channel: interaction.channel.id });
  const mongoTeam2 = await client.clientMongo
    .db('jwc')
    .collection('clans')
    .findOne({ 'log.main.channel_id': interaction.channel.id });

  if (mongoTeam) {
    await fRoster.roster(interaction, client, mongoTeam.league, mongoTeam.clan_abbr);
  } else if (mongoTeam2) {
    await fRoster.roster(interaction, client, mongoTeam2.league, mongoTeam2.clan_abbr);
  } else {
    await interaction.followUp({ content: '*Error*', ephemeral: true });
    return;
  }
}

async function myTeamInformation(client, interaction) {
  const mongoTeam = await client.clientMongo
    .db('jwc')
    .collection('clans')
    .findOne({ rep_channel: interaction.channel.id });
  const mongoTeam2 = await client.clientMongo
    .db('jwc')
    .collection('clans')
    .findOne({ 'log.main.channel_id': interaction.channel.id });

  if (mongoTeam) {
    await functions.sendClanInfo(interaction, client, mongoTeam.clan_abbr);
  } else if (mongoTeam2) {
    await functions.sendClanInfo(interaction, client, mongoTeam2.clan_abbr);
  } else {
    await interaction.followUp({ content: '*Error*', ephemeral: true });
    return;
  }
}

async function dealWar(client, interaction) {
  const iDateTimeUnix = await interaction.options.getString('date');
  const iTimeMatch = await interaction.options.getString('time');
  let iTimePrep = await interaction.options.getString('prep_time');
  let iTimeBattle = await interaction.options.getString('battle_time');
  const iClanAbbrSend = await interaction.options
    .getString('send')
    .toLowerCase();
  let iSize = await interaction.options.getString('size');

  let day_arr = ['日', '月', '火', '水', '木', '金', '土'];
  let date = new Date(iDateTimeUnix * 1000);
  let dateJstLong = `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 （${day_arr[date.getDay()]}）`;

  const hour = Number(iTimeMatch.split(':')[0]) - 9;
  const min = Number(iTimeMatch.split(':')[1]);
  const dateFull = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    min,
  );
  const dealTimeUnixLong = dateFull.getTime() / 1000;

  const iChId = await interaction.channel.id;
  const mongoWar = await client.clientMongo
    .db('jwc')
    .collection('wars')
    .findOne({ nego_channel: iChId });

  if (!mongoWar) {
    await interaction.followUp({
      content: '*ERROR: No War*',
      ephemeral: true,
    });
    return;
  }

  let league = mongoWar.league;
  let week = mongoWar.week;
  let match = mongoWar.match;
  let clanAbbr = mongoWar.clan_abbr;
  let opponentAbbr = mongoWar.opponent_abbr;

  if (league == 'cup') {
    iTimeBattle = '12h';
    if (iSize == null) {
      iSize = '5v5';
    }
  }

  let clanAbbrA = '';
  let clanAbbrB = '';
  if (iClanAbbrSend == clanAbbr) {
    clanAbbrA = clanAbbr;
    clanAbbrB = opponentAbbr;
  } else if (iClanAbbrSend == opponentAbbr) {
    clanAbbrA = opponentAbbr;
    clanAbbrB = clanAbbr;
  }

  if (!clanAbbrA || !clanAbbrB) {
    await interaction.followUp({
      content: '*ERROR: Invalid send team*',
      ephemeral: true,
    });
    return;
  }

  let mongoClanA = {};
  let mongoClanB = {};
  try {
    mongoClanA = await client.clientMongo
      .db('jwc')
      .collection('clans')
      .findOne({ clan_abbr: clanAbbrA });
    mongoClanB = await client.clientMongo
      .db('jwc')
      .collection('clans')
      .findOne({ clan_abbr: clanAbbrB });
  } catch (error) {
    console.error(error);
    let message = '_ERROR: please try again lator._\n';
    message += `* iDateTimeUnix: ${iDateTimeUnix}\n`;
    message += `* iTimeMatch: ${iTimeMatch}\n`;
    message += `* iTimePrep: ${iTimePrep}\n`;
    message += `* iTimeBattle: ${iTimeBattle}\n`;
    message += `* iClanAbbrSend: ${iClanAbbrSend}\n`;
    message += `* iSize: ${iSize}\n`;
    await interaction.followUp({ content: message });
    return;
  }

  if (!mongoClanA || !mongoClanB) {
    await interaction.followUp({
      content: '*ERROR: Team data not found*',
      ephemeral: true,
    });
    console.error(
      `dealWar: clan data not found (${clanAbbrA}, ${clanAbbrB})`,
    );
    return;
  }

  const clanNameA = mongoClanA.clan_name;
  const clanNameB = mongoClanB.clan_name;
  const clanTagA = mongoClanA.clan_tag;
  const clanTagB = mongoClanB.clan_tag;

  if (!clanTagA || !clanTagB) {
    await interaction.followUp({
      content: '*ERROR: Clan tag not found*',
      ephemeral: true,
    });
    console.error(
      `dealWar: clan tag not found (${clanAbbrA}, ${clanAbbrB})`,
    );
    return;
  }

  const clanLinkA =
    'https://link.clashofclans.com/?action=OpenClanProfile&tag=' +
    clanTagA.slice(1);
  const clanLinkB =
    'https://link.clashofclans.com/?action=OpenClanProfile&tag=' +
    clanTagB.slice(1);

  let title = ':white_check_mark: **DEAL!**';
  let description = '';
  description += `${config.leaguePlusEmote[league]}\n`;
  description += `_${client.schedule.week['w' + week]} - ${client.schedule.match['m' + match]}_\n`;
  description += `**${mongoClanA.team_name} :vs: ${mongoClanB.team_name}**\n`;
  description += `\n`;
  description += `:calendar: <t:${dealTimeUnixLong}:F> (<t:${dealTimeUnixLong}:R>)\n`;
  description += `:hourglass_flowing_sand:  ${iTimePrep}  /  :crossed_swords:  ${iTimeBattle}\n`;
  if (iSize != null) {
    description += `_${iSize}_\n`;
  }
  description += `\n`;
  description += `[__**${clanTagA}**__](${clanLinkA}) ${clanNameA}\n`;
  description += `:arrow_down:\n`;
  description += `[__**${clanTagB}**__](${clanLinkB}) ${clanNameB}\n`;

  const footer = `${config.footer} ${config.league[league]} SEASON ${config.season[league]}`;

  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setDescription(description);
  embed.setColor(config.color[league]);
  embed.setFooter({ text: footer, iconURL: config.urlImage.jwc });
  await interaction.followUp({ embeds: [embed] });

  if (mongoClanA.log?.deal?.switch == 'on') {
    try {
      await client.channels.cache
        .get(mongoClanA.log.deal.channel_id)
        .send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
    }
  }
  if (mongoClanB.log?.deal?.switch == 'on') {
    try {
      await client.channels.cache
        .get(mongoClanB.log.deal.channel_id)
        .send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
    }
  }

  // check
  try {
    const oldCh = await interaction.guild.channels.fetch(iChId);
    let newChName = oldCh.name.replace('✅', '');
    newChName = '✅' + newChName;
    await interaction.guild.channels.edit(interaction.channelId, {
      name: newChName,
    });
  } catch (error) {
    console.error(`dealWar: failed to update channel name ${iChId}`);
    console.error(error);
  }

  //db update
  let query = { nego_channel: iChId };
  let deal = {};
  deal.date = dateJstLong;
  deal.time = iTimeMatch;
  deal.prep_time = iTimePrep;
  deal.battle_time = iTimeBattle;
  deal.send = iClanAbbrSend;
  deal.size = iSize;
  deal.unixTime = dealTimeUnixLong;
  let updatedListing = { deal: deal };
  await client.clientMongo
    .db('jwc')
    .collection('wars')
    .updateOne(query, { $set: updatedListing });

  //auto-updating
  await functions.updateWarInfo(client, league, week);

  let json = {};
  json.league = league;
  json.week = week;
  json.teamA = clanAbbrA;
  json.teamB = clanAbbrB;
  json.prep = iTimePrep;
  json.battle = iTimeBattle;
  json.unixTime = dealTimeUnixLong;

  // delete pre-deal calendar event if needed
  if (mongoWar.deal && mongoWar.deal != '') {
    json.type = 'delete_calendar_event';
    json.unixTimeOld = mongoWar.deal.unixTime;
    await editCalendarEvent(json);
  }

  //create calendar event
  json.type = 'create_calendar_event';
  await editCalendarEvent(json);

  //await fCreateJSON.currentWeek(client.clientMongo, league);
  //console.dir(`end: fCreateJSON.currentWeek [${league}]`);
}

async function editCalendarEvent(json) {
  let param = {
    method: 'POST',
    'Content-Type': 'application/json',
    body: JSON.stringify(json),
  };

  try {
    await fetch(process.env.GAS_URI, param);
    //const response = await fetch(process.env.GAS_URI, param);
    //const data = await response.json();
    //console.log(data);
  } catch (error) {
    console.error('Fetch error: ', error);
  }
}

async function editTeamInformation(client, interaction) {
  const mongoTeam = await client.clientMongo
    .db('jwc')
    .collection('clans')
    .findOne({ rep_channel: interaction.channel.id });

  if (mongoTeam == null) {
    await interaction.followUp({
      content:
        ':exclamation: *Team not found for this channel. Run `/admin create team_data` in the team channel first.*',
      ephemeral: true,
    });
    return;
  }

  const league = mongoTeam.league;

  const channelAbbr = mongoTeam.clan_abbr;
  let teamAbbr = channelAbbr;
  const iSenderId = interaction.user.id;
  const isAdmin = Object.values(config.adminId).includes(iSenderId);
  const iTeam = await interaction.options.getString('team');
  const parsedTeam = functions.normalizeTeamAbbrFromOption(iTeam);

  if (isAdmin && parsedTeam && parsedTeam !== channelAbbr) {
    const mongoTarget = await client.clientMongo
      .db('jwc')
      .collection('clans')
      .findOne({ clan_abbr: parsedTeam });
    if (!mongoTarget) {
      await interaction.followUp({
        content: `:exclamation: *Team "${parsedTeam.toUpperCase()}" not found.*`,
        ephemeral: true,
      });
      return;
    }
    teamAbbr = parsedTeam;
  }

  const iClanTag = await interaction.options.getString('clan_tag');
  const iTeamName = await interaction.options.getString('team_name');
  //let league = interaction.options.getString('league');
  const iDivision = await interaction.options.getString('division');
  const iUrlLogo = await interaction.options.getString('logo_url');
  const iRep1st = await interaction.options.getUser('rep_1st');
  const iRep2nd = await interaction.options.getUser('rep_2nd');
  const iRep3rd = await interaction.options.getUser('rep_3rd');
  const changeLeague = await interaction.options.getString('change_league');
  const iStatusSeason = await interaction.options.getString('status_season');
  const iStatus = await interaction.options.getString('status');
  const flagRemove = await interaction.options.getString('remove');

  if (iDivision) {
    if (!isAdmin) {
      await interaction.followUp({
        content: `:exclamation: *Only admins can set division.*`,
        ephemeral: true,
      });
      return;
    }
  }
  if (iRep1st || iRep2nd || iRep3rd) {
    if (!isAdmin) {
      await interaction.followUp({
        content: `:exclamation: *Only admins can change reps.*`,
        ephemeral: true,
      });
      return;
    }
  }

  if (flagRemove == 'all') {
    if (!isAdmin) {
      await interaction.followUp({
        content: `:exclamation: *Only admins can remove the data.*`,
        ephemeral: true,
      });
      return;
    }
    await client.clientMongo
      .db('jwc')
      .collection('clans')
      .deleteOne({ clan_abbr: teamAbbr });
    await interaction.followUp(`removed: ${teamAbbr}`);
    await fMongo.teamList(client.clientMongo, league);
    return;
  }

  let rep1stNow = '';
  let rep2ndNow = '';
  let rep3rdNow = '';
  let rep1stNowId = '';
  let rep2ndNowId = '';
  let rep3rdNowId = '';
  if (mongoTeam) {
    rep1stNow = mongoTeam.rep_1st;
    if (rep1stNow) {
      rep1stNowId = rep1stNow.id;
    }
    rep2ndNow = mongoTeam.rep_2nd;
    if (rep2ndNow) {
      rep2ndNowId = rep2ndNow.id;
    }
    rep3rdNow = mongoTeam.rep_3rd;
    if (rep3rdNow) {
      rep3rdNowId = rep3rdNow.id;
    }
  }

  if (
    iSenderId != rep1stNowId &&
    iSenderId != rep2ndNowId &&
    iSenderId != rep3rdNowId
  ) {
    if (!isAdmin) {
      await interaction.followUp({
        content: `:exclamation: *Only reps can change clan information.*`,
        ephemeral: true,
      });
      return;
    }
  }

  let listing = {};

  if (changeLeague) {
    listing.league = changeLeague;
  }

  if (iClanTag) {
    const scClan = await client.clientCoc.getClan(iClanTag);
    if (!scClan) {
      await interaction.followUp({
        content: `:exclamation: *Clan tag not found: ${iClanTag}*`,
        ephemeral: true,
      });
      return;
    }
    listing.clan_tag = iClanTag;
    listing.clan_name = scClan.name;
    if (!iTeamName && !mongoTeam.team_name) {
      listing.team_name = scClan.name;
    }
  }

  if (iTeamName) {
    listing.team_name = iTeamName;
  }

  if (iDivision == 'tbd') {
    listing.division = '';
  } else if (iDivision) {
    listing.division = iDivision;
  }

  if (iUrlLogo) {
    listing.logo_url = iUrlLogo;
  }

  if (flagRemove == 'rep2nd') {
    listing.rep_2nd = null;
    if (
      rep2ndNow &&
      rep2ndNow != '' &&
      rep2ndNow != 'non-registered' &&
      rep2ndNow.id
    ) {
      const repRemove = interaction.guild.members.cache.get(rep2ndNow.id);
      if (repRemove !== undefined) {
        await functions.editRoleMain(
          interaction,
          repRemove,
          'remove',
          league,
          0,
        );
      }
    }
  } else if (flagRemove == 'rep3rd') {
    listing.rep_3rd = null;
  } else if (iRep1st || iRep2nd || iRep3rd) {
    const rep1st = await editRole(
      interaction,
      league,
      iRep1st,
      mongoTeam,
      rep1stNow,
      iRep1st,
      iRep2nd,
      iRep3rd,
    );
    const rep2nd = await editRole(
      interaction,
      league,
      iRep2nd,
      mongoTeam,
      rep2ndNow,
      iRep1st,
      iRep2nd,
      iRep3rd,
    );
    const rep3rd = await editRole(
      interaction,
      league,
      iRep3rd,
      mongoTeam,
      rep3rdNow,
      iRep1st,
      iRep2nd,
      iRep3rd,
    );
    listing.rep_1st = rep1st;
    listing.rep_2nd = rep2nd;
    listing.rep_3rd = rep3rd;
  }

  let status = null;
  if (iStatus) {
    const seasonValue =
      iStatusSeason === 'current' ? config.season[league] : config.seasonNext[league];
    const statusKey = functions.seasonToString(seasonValue);
    if (mongoTeam.status) {
      status = mongoTeam.status;
      status[statusKey] = iStatus;
    } else {
      status = {};
      status[statusKey] = iStatus;
    }
    listing.status = status;
  }

  await client.clientMongo
    .db('jwc')
    .collection('clans')
    .updateOne({ clan_abbr: teamAbbr }, { $set: listing });
    
  await fMongo.teamList(client.clientMongo, league);

  await functions.sendClanInfo(interaction, client, teamAbbr);
}

async function editRole(
  interaction,
  league,
  repNew,
  mongoTeam,
  repNow,
  rep1st,
  rep2nd,
  rep3rd,
) {
  let rtnRep = {};
  if (repNew == null) {
    // 変更なし -> 今のまま登録
    if (mongoTeam == null) {
      rtnRep = 'non-registered';
    } else {
      rtnRep = repNow;
    }
  } else {
    // 変更 or 新規登録
    let rep1stId = 0;
    let rep2ndId = 0;
    let rep3rdId = 0;
    if (rep1st != null) {
      rep1stId = rep1st.id; // 新規
    }
    if (rep2nd != null) {
      rep2ndId = rep2nd.id; // 新規
    }
    if (rep3rd != null) {
      rep3rdId = rep3rd.id; // 新規
    }
    if (repNow != null && repNow != '' && repNow != 'non-registered') {
      if (
        repNow.id != rep1stId &&
        repNow.id != rep2ndId &&
        repNow.id != rep3rdId
      ) {
        // 前任者が辞める場合
        let rep_remove = interaction.guild.members.cache.get(repNow.id);
        if (rep_remove !== undefined) {
          await functions.editRoleMain(
            interaction,
            rep_remove,
            'remove',
            league,
            0,
          ); // 前任者のロール削除
        }
      }
    }
    await functions.editRoleMain(interaction, repNew, 'add', league, 0); // ロール追加（ついてなければ）
    rtnRep = repNew;
  }
  return rtnRep;
}

async function editMyChannel(client, interaction) {
  const iTeam = await interaction.options.getString('team');
  const teamAbbr = functions.normalizeTeamAbbrFromOption(iTeam);
  const iLog0 = interaction.options.getString('main');
  const iLog1 = interaction.options.getString('deal');
  const iLog2 = interaction.options.getString('start');
  const iLog3 = interaction.options.getString('attacks_defenses');
  const iLog4 = interaction.options.getString('end');

  let mongoTeam = await client.clientMongo
    .db('jwc')
    .collection('clans')
    .findOne({ clan_abbr: teamAbbr });

  if (mongoTeam == null) {
    mongoTeam = await client.clientMongo
      .db('jwc')
      .collection('clans')
      .findOne({ rep_channel: interaction.channel.id });
  }

  if (mongoTeam == null) {
    mongoTeam = await client.clientMongo
      .db('jwc')
      .collection('clans')
      .findOne({ 'log.main.channel_id': interaction.channel.id });
  }

  if (mongoTeam == null) {
    await interaction.followUp({
      content: `:exclamation: *Team not found (\`${teamAbbr}\`). Run \`/admin create team_data\` first.*`,
      ephemeral: true,
    });
    return;
  }

  const clanAbbrResolved = mongoTeam.clan_abbr;

  if (
    interaction.user.id != mongoTeam.rep_1st?.id &&
    interaction.user.id != mongoTeam.rep_2nd?.id &&
    interaction.user.id != mongoTeam.rep_3rd?.id
  ) {
    if (Object.values(config.adminId).includes(interaction.user.id) == false) {
      await interaction.followUp(
        `:exclamation: *Only reps can change clan information.*`,
      );
      return;
    }
  }

  let listing = {};
  if (mongoTeam.log) {
    listing.log = mongoTeam.log;
  } else {
    listing.log = {
      main: { switch: 'off', channel_id: null },
      deal: { switch: 'off', channel_id: null },
      start: { switch: 'off', channel_id: null },
      att_def: { switch: 'off', channel_id: null },
      end: { switch: 'off', channel_id: null },
    };
  }

  if (iLog0 == 'on') {
    listing.log.main.switch = 'on';
    listing.log.main.channel_id = interaction.channel.id;
  } else if (iLog0 == 'off') {
    listing.log.main.switch = 'off';
    listing.log.main.channel_id = null;
  }

  if (iLog1 == 'on') {
    listing.log.deal.switch = 'on';
    listing.log.deal.channel_id = interaction.channel.id;
  } else if (iLog1 == 'off') {
    listing.log.deal.switch = 'off';
    listing.log.deal.channel_id = null;
  }

  if (iLog2 == 'on') {
    listing.log.start.switch = 'on';
    listing.log.start.channel_id = interaction.channel.id;
  } else if (iLog2 == 'off') {
    listing.log.start.switch = 'off';
    listing.log.start.channel_id = null;
  }

  if (iLog3 == 'on') {
    listing.log.att_def.switch = 'on';
    listing.log.att_def.channel_id = interaction.channel.id;
  } else if (iLog3 == 'off') {
    listing.log.att_def.switch = 'off';
    listing.log.att_def.channel_id = null;
  }

  if (iLog4 == 'on') {
    listing.log.end.switch = 'on';
    listing.log.end.channel_id = interaction.channel.id;
  } else if (iLog4 == 'off') {
    listing.log.end.switch = 'off';
    listing.log.end.channel_id = null;
  }

  await client.clientMongo
    .db('jwc')
    .collection('clans')
    .updateOne({ clan_abbr: clanAbbrResolved }, { $set: listing });

  /*
  let description = '';
  description += `_JWC BOT has been linked to this channel._\n`;
  description += `The schedule of your war will be posted.\n`;
  description += `\n`;
  description += `Log Settings: [${iLogSwitch}]\n`;
  description += `* The beginning of your war\n`;
  description += `* Attacks / Defenses: [${iLogSwitch}]\n`;
  description += `* The end of your war\n`;
  description += `\n`;
  description += `_Try to run </war own:${config.command['war'].id}> to see stats of the war._\n`;
  description += `\n`;
  const clanLink = 'https://link.clashofclans.com/?action=OpenClanProfile&tag=' + clanTag.slice(1);
  description += `[__**${clanTag}**__](${clanLink})\n`;
  description += `${clanName}\n`;
  let footer = `${config.footer} ${league.toUpperCase()}`;
  const embed = new EmbedBuilder()
    .setTitle('**CHANNEL LINKED**')
    .setDescription(description)
    .setColor(config.color[iLeague])
    .setFooter({ text: footer, iconURL: config.urlImage.jwc })
  await client.channels.cache.get(iLogCh.id).send({ embeds: [embed] });
  */

  await functions.sendClanInfo(interaction, client, clanAbbrResolved);
}
