const { SlashCommandBuilder } = require("@discordjs/builders");
const {
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const config = require("../../config.js");
const schedule = require("../../schedule.js");
const functions = require("../../functions/functions.js");
const fGetWars = require("../../functions/fGetWars.js");
const fScore = require("../../functions/fScore.js");
const fRanking = require("../../functions/fRanking.js");
const fCreateJSON = require("../../functions/fCreateJSON.js");
const fMongo = require("../../functions/fMongo.js");
const post = require("../../functions/post.js");
const fCron = require("../../functions/fCron.js");

const nameCommand = "admin";
let data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription("no description")
  // subcommandGroup 0
  .addSubcommandGroup((subcommandgroup) =>
    subcommandgroup
      .setName("create")
      .setDescription("no description")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("negotiation_channels")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["create"][
              "negotiation_channels"
            ],
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          )
          .addIntegerOption((option) =>
            option.setName("week").setDescription("週").setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("team_channel")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["create"][
              "team_channel"
            ],
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("team_name")
              .setDescription("チーム名")
              .setRequired(true),
          )
          .addUserOption((option) =>
            option
              .setName("rep1st")
              .setDescription("代表者1")
              .setRequired(true),
          )
          .addUserOption((option) =>
            option
              .setName("rep2nd")
              .setDescription("代表者2")
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("team_data")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["create"][
              "team_data"
            ],
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("abbreviation")
              .setDescription("チーム略称")
              .setRequired(true),
          ),
      ),
  )
  // subcommandGroup 1
  .addSubcommandGroup((subcommandgroup) =>
    subcommandgroup
      .setName("update")
      .setDescription("no description")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("single_war")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["update"][
              "single_war"
            ],
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          )
          .addIntegerOption((option) =>
            option.setName("week").setDescription("週").setRequired(true),
          )
          .addIntegerOption((option) =>
            option
              .setName("match")
              .setDescription("対戦")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("change_state")
              .setDescription("強制対戦状況変更")
              .addChoices(
                { name: "warEnded", value: "warEnded" },
                { name: "inWar", value: "inWar" },
                { name: "preparation", value: "preparation" },
              ),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("every_war")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["update"][
              "every_war"
            ],
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          )
          .addIntegerOption((option) =>
            option.setName("week").setDescription("週").setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("league_standings")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["update"][
              "league_standings"
            ],
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("season_score")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["update"][
              "season_score"
            ],
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("single_account_data")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["update"][
              "single_account_data"
            ],
          )
          .addStringOption((option) =>
            option
              .setName("tag")
              .setDescription("プレイヤータグ")
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("all_account_data")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["update"][
              "all_account_data"
            ],
          ),
      ),
  )
  // subcommandGroup 2
  .addSubcommandGroup((subcommandgroup) =>
    subcommandgroup
      .setName("edit")
      .setDescription("no description")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("attack_result")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["edit"][
              "attack_result"
            ],
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          )
          .addIntegerOption((option) =>
            option.setName("week").setDescription("週").setRequired(true),
          )
          .addIntegerOption((option) =>
            option
              .setName("match")
              .setDescription("対戦")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("team")
              .setDescription("チーム")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addIntegerOption((option) =>
            option
              .setName("attack")
              .setDescription("攻撃")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("action")
              .setDescription("内容")
              .setRequired(true)
              .addChoices({ name: "星1 減", value: "1StarDeduction" })
              .addChoices({ name: "無効", value: "Invalidate" }),
          )
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription("理由（記入）")
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("war")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["edit"]["war"],
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          )
          .addIntegerOption((option) =>
            option.setName("week").setDescription("週").setRequired(true),
          )
          .addIntegerOption((option) =>
            option
              .setName("match")
              .setDescription("対戦")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("action")
              .setDescription("内容")
              .setRequired(true)
              .addChoices(
                { name: "没収試合（要：勝利クランを選択）", value: "forfeit" },
                {
                  name: "星数減点（要：クラン・減点数を選択）",
                  value: "deductStar",
                },
                {
                  name: "防衛ポイント加点（要：クラン・加点数を選択）",
                  value: "addDefPoint",
                },
                {
                  name: "星数＆破壊率減点（要：クラン・減点数を選択）",
                  value: "deductStarAndDestruction",
                },
                { name: "配信フラグ ON/OFF", value: "stream" },
              ),
          )
          .addStringOption((option) =>
            option
              .setName("team")
              .setDescription("チーム")
              .setAutocomplete(true),
          )
          .addIntegerOption((option) =>
            option
              .setName("point")
              .setDescription("加点数/減点数")
              .addChoices(
                { name: "1", value: 1 },
                { name: "2", value: 2 },
                { name: "3", value: 3 },
                { name: "4", value: 4 },
                { name: "5", value: 5 },
              ),
          )
          .addStringOption((option) =>
            option.setName("reason").setDescription("理由（記入）"),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("team_score")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["edit"][
              "team_score"
            ],
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("team")
              .setDescription("チーム")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("action")
              .setDescription("内容")
              .setRequired(true)
              .addChoices(
                { name: "勝ち点加点（要：加点数を選択）", value: "addPoint" },
                { name: "星数差減点（要：減点数を選択）", value: "deductStar" },
              ),
          )
          .addIntegerOption((option) =>
            option
              .setName("point")
              .setDescription("加点数/減点数")
              .setRequired(true)
              .addChoices(
                { name: "1", value: 1 },
                { name: "2", value: 2 },
                { name: "3", value: 3 },
                { name: "4", value: 4 },
                { name: "5", value: 5 },
              ),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("add_attack")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["edit"][
              "add_attack"
            ],
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          )
          .addIntegerOption((option) =>
            option.setName("week").setDescription("週").setRequired(true),
          )
          .addIntegerOption((option) =>
            option
              .setName("match")
              .setDescription("対戦")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("team")
              .setDescription("チーム")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("attacker")
              .setDescription("攻撃プレイヤー")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("defender")
              .setDescription("防衛プレイヤー")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("attack_type")
              .setDescription("初見/非初見/オーバーキル")
              .setRequired(true)
              .addChoices(
                { name: "初見", value: "fresh" },
                { name: "非初見", value: "cleanup" },
                { name: "オーバーキル", value: "overkill" },
              ),
          )
          .addIntegerOption((option) =>
            option
              .setName("stars")
              .setDescription("星数")
              .setRequired(true)
              .addChoices(
                { name: "0", value: 0 },
                { name: "1", value: 1 },
                { name: "2", value: 2 },
                { name: "3", value: 3 },
              ),
          )
          .addIntegerOption((option) =>
            option
              .setName("destruction")
              .setDescription("破壊率")
              .setRequired(true)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("account")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["edit"]["account"],
          )
          .addStringOption((option) =>
            option
              .setName("tag")
              .setDescription("アカウントタグ")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("action")
              .setDescription("編集内容")
              .setRequired(true)
              .addChoices(
                { name: "status ON/OFF", value: "status" },
                { name: "streamer ON/OFF", value: "streamer" },
              ),
          ),
      ),
  )
  // subcommandGroup 3
  .addSubcommandGroup((subcommandgroup) =>
    subcommandgroup
      .setName("edit_dc")
      .setDescription("no description")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("role")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["edit_dc"]["role"],
          )
          .addUserOption((option) =>
            option.setName("user").setDescription("ユーザー").setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("action")
              .setDescription("編集内容")
              .setRequired(true)
              .addChoices(
                { name: "ロール追加", value: "add" },
                { name: "ロール削除", value: "remove" },
              ),
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("ch_view_permission")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["edit_dc"][
              "ch_view_permission"
            ],
          )
          .addStringOption((option) =>
            option
              .setName("action")
              .setDescription("実行内容")
              .setRequired(true)
              .addChoices(
                { name: "削除", value: "delete" },
                { name: "追加", value: "add" },
              ),
          )
          .addUserOption((option) =>
            option.setName("user").setDescription("ユーザー").setRequired(true),
          )
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription("チャンネル")
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("ch_emote")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["edit_dc"][
              "ch_emote"
            ],
          )
          .addStringOption((option) =>
            option
              .setName("action")
              .setDescription("編集内容")
              .setRequired(true)
              .addChoices(
                { name: "初期化（絵文字削除）", value: "initialize" },
                { name: "新規応募", value: "new" },
                { name: "受付完了", value: "accepted" },
                { name: "ロスター継続登録確認完了", value: "roster" },
                { name: "不参加", value: "declined" },
              ),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("ch_emote_all")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["edit_dc"][
              "ch_emote_all"
            ],
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("ch_name")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["edit_dc"][
              "ch_name"
            ],
          )
          .addStringOption((option) =>
            option
              .setName("new_channel_name")
              .setDescription("チャンネル名")
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("delete_nego_chs")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["edit_dc"][
              "delete_nego_chs"
            ],
          )
          .addIntegerOption((option) =>
            option.setName("week").setDescription("週").setRequired(true),
          ),
      ),
  )
  // subcommandGroup 4
  .addSubcommandGroup(
    (subcommandgroup) =>
      subcommandgroup
        .setName("info")
        .setDescription("no description")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("war_summary")
            .setDescription(
              config.adminCommand[nameCommand].subCommandGroup["info"][
                "war_summary"
              ],
            )
            .addStringOption((option) =>
              option
                .setName("league")
                .setDescription("リーグ")
                .setRequired(true),
            )
            .addIntegerOption((option) =>
              option.setName("week").setDescription("週").setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("ranking_summary")
            .setDescription(
              config.adminCommand[nameCommand].subCommandGroup["info"][
                "ranking_summary"
              ],
            )
            .addStringOption((option) =>
              option
                .setName("league")
                .setDescription("リーグ")
                .setRequired(true),
            )
            .addIntegerOption((option) =>
              option.setName("th_level").setDescription("タウンホールレベル"),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("bot_status")
            .setDescription(
              config.adminCommand[nameCommand].subCommandGroup["info"][
                "bot_status"
              ],
            ),
        ),
    /*
      .addSubcommand(subcommand =>
        subcommand
          .setName('bot_status_legend')
          .setDescription(config.adminCommand[nameCommand].subCommandGroup['info']['bot_status_legend'])
      )
      */
  )
  // subcommandGroup 5
  .addSubcommandGroup((subcommandgroup) =>
    subcommandgroup
      .setName("roster")
      .setDescription("no description")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("delete")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["roster"][
              "delete"
            ],
          )
          .addStringOption((option) =>
            option
              .setName("team")
              .setDescription("チーム")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("account")
              .setDescription("アカウント")
              .setRequired(true)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("update_season")
          .setDescription(
            config.adminCommand[nameCommand].subCommandGroup["roster"][
              "update_season"
            ],
          )
          .addStringOption((option) =>
            option.setName("league").setDescription("リーグ").setRequired(true),
          ),
      ),
  )
  // 6
  .addSubcommand((subcommand) =>
    subcommand
      .setName("send_message_war_ended")
      .setDescription(
        config.adminCommand[nameCommand].subCommand["send_message_war_ended"],
      )
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("チャンネル")
          .setRequired(true),
      ),
  )
  // 7
  .addSubcommand((subcommand) =>
    subcommand
      .setName("scan_clan")
      .setDescription(config.adminCommand[nameCommand].subCommand["scan_clan"])
      .addStringOption((option) =>
        option.setName("league").setDescription("リーグ").setRequired(true),
      )
      .addStringOption((option) =>
        option.setName("team").setDescription("チーム").setAutocomplete(true),
      ),
  )
  // 8
  .addSubcommand((subcommand) =>
    subcommand
      .setName("mention_reps")
      .setDescription(
        config.adminCommand[nameCommand].subCommand["mention_reps"],
      )
      .addStringOption((option) =>
        option.setName("league").setDescription("リーグ").setRequired(true),
      )
      .addIntegerOption((option) =>
        option.setName("week").setDescription("週").setRequired(true),
      )
      .addIntegerOption((option) =>
        option
          .setName("match")
          .setDescription("対戦")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((option) =>
        option
          .setName("message")
          .setDescription("メンション内容")
          .setRequired(true),
      ),
  )
  // 9
  .addSubcommand(
    (subcommand) =>
      subcommand
        .setName("test")
        .setDescription(config.adminCommand[nameCommand].subCommand["test"]),
    /*.addStringOption(option =>
      option.setName('channel').setDescription('チャンネル').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('message').setDescription('ID of message').setRequired(true)
    )*/
  );

config.choices.league5.forEach((choice) => {
  // create
  data.options[0].options[0].options[0].addChoices(choice);
  data.options[0].options[1].options[0].addChoices(choice);
  data.options[0].options[2].options[0].addChoices(choice);
  // update
  data.options[1].options[0].options[0].addChoices(choice);
  data.options[1].options[1].options[0].addChoices(choice);
  data.options[1].options[2].options[0].addChoices(choice);
  data.options[1].options[3].options[0].addChoices(choice);
  // edit
  data.options[2].options[0].options[0].addChoices(choice);
  data.options[2].options[1].options[0].addChoices(choice);
  data.options[2].options[2].options[0].addChoices(choice);
  data.options[2].options[3].options[0].addChoices(choice);
  // edit_dc
  data.options[3].options[0].options[2].addChoices(choice);
  data.options[3].options[3].options[0].addChoices(choice);
  // info
  data.options[4].options[0].options[0].addChoices(choice);
  data.options[4].options[1].options[0].addChoices(choice);
  // roster
  //data.options[5].options[0].options[0].addChoices(choice);
  data.options[5].options[1].options[0].addChoices(choice);
  // subcommands
  data.options[7].options[0].addChoices(choice);
  data.options[8].options[0].addChoices(choice);
});
config.choices.weekInt.forEach((choice) => {
  data.options[0].options[0].options[1].addChoices(choice);
  data.options[1].options[0].options[1].addChoices(choice);
  data.options[1].options[1].options[1].addChoices(choice);
  data.options[2].options[0].options[1].addChoices(choice);
  data.options[2].options[1].options[1].addChoices(choice);
  data.options[2].options[3].options[1].addChoices(choice);
  data.options[3].options[5].options[0].addChoices(choice);
  data.options[4].options[0].options[1].addChoices(choice);
  data.options[8].options[1].addChoices(choice);
});
config.choices.townHallLevelInt.forEach((choice) => {
  data.options[4].options[1].options[1].addChoices(choice);
});

module.exports = {
  data: data,

  async autocomplete(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    const focusedOption = interaction.options.getFocused(true);
    let iLeague = await interaction.options.getString("league");
    if (iLeague == null) {
      iLeague = "j1";
    }
    let iWeek = await interaction.options.getInteger("week");
    if (iWeek == null || iWeek == 99) {
      iWeek = await functions.getWeekNow(iLeague);
    }

    if (subcommandGroup == "roster") {
      const mongoTeam = await client.clientMongo
        .db("jwc")
        .collection("clans")
        .findOne(
          { rep_channel: interaction.channel.id },
          { projection: { clan_abbr: 1, team_name: 1, _id: 0 } }
        );
      
      if (focusedOption.name === "team") {
        if (mongoTeam) {
          await interaction.respond([
            {
              name: `${mongoTeam.clan_abbr.toUpperCase()}: ${mongoTeam.team_name}`,
              value: mongoTeam.clan_abbr,
            },
          ]);
        }
      } else if (focusedOption.name === "account") {
        const iTeamAbbr = await interaction.options.getString("team");
        let leagueM = mongoTeam.league;
        if (leagueM == "j1" || leagueM == "j2") {
          leagueM = "j";
        }

        const query = { [`homeClanAbbr.${leagueM}`]: iTeamAbbr, status: true };
        const options = {
          projection: {
            _id: 0,
            tag: 1,
            name: 1,
            townHallLevel: 1,
            homeClanAbbr: 1,
            pilotName: 1,
          },
        };
        const sort = { townHallLevel: -1, [`pilotName.${leagueM}`]: 1 };
        const cursor = client.clientMongo
          .db("jwc")
          .collection("accounts")
          .find(query, options)
          .sort(sort);
        let accs = await cursor.toArray();
        await cursor.close();

        const focusedValue = interaction.options.getFocused();
        accs = accs.filter(function (acc) {
          return acc.name.includes(focusedValue);
        });
        if (accs.length > 24) {
          accs = accs.filter(function (acc, index) {
            return index < 24;
          });
        }

        await interaction.respond([
          { name: "ALL", value: "all" },
          ...accs.map((acc) => ({
            name: `[TH${acc.townHallLevel}] ${acc.name} | ${acc.pilotName[leagueM]}`,
            value: acc.tag,
          })),
        ]);
      }
    } else {
      if (focusedOption.name === "match") {
        const query = {
          season: config.season[iLeague],
          league: iLeague,
          week: iWeek,
        };
        const options = {
          projection: {
            _id: 0,
            league: 1,
            week: 1,
            match: 1,
            clan_abbr: 1,
            opponent_abbr: 1,
            name_match: 1,
          },
        };
        const sort = { match: 1 };
        const cursor = client.clientMongo
          .db("jwc")
          .collection("wars")
          .find(query, options)
          .sort(sort);
        let mongoWars = await cursor.toArray();
        await cursor.close();

        if (mongoWars.length > 0) {
          await interaction.respond(
            mongoWars.map((war) => ({
              name: `${war.name_match || war.match} - ${war.clan_abbr.toUpperCase()} vs. ${war.opponent_abbr.toUpperCase()}`,
              value: war.match,
            })),
          );
        }
      } else if (focusedOption.name === "team") {
        // 対戦のどちらかのチーム
        if (
          subcommand === "attack_result" ||
          subcommand === "war" ||
          subcommand === "add_attack"
        ) {
          const iMatch = await interaction.options.getInteger("match");
          const query = {
            season: config.season[iLeague],
            league: iLeague,
            week: iWeek,
            match: iMatch,
          };
          const myColl = client.clientMongo.db("jwc").collection("wars");
          const mongoWar = await myColl.findOne(
            query,
            { projection: { clan_abbr: 1, opponent_abbr: 1, _id: 0 } }
          );
          await interaction.respond([
            {
              name: mongoWar.clan_abbr.toUpperCase(),
              value: mongoWar.clan_abbr,
            },
            {
              name: mongoWar.opponent_abbr.toUpperCase(),
              value: mongoWar.opponent_abbr,
            },
          ]);
        }
        // リーグ内全チーム
        else {
          const focusedValue = interaction.options.getFocused();
          const iLeague = await interaction.options.getString("league");
          let teamList = await client.clientMongo
            .db("jwc")
            .collection("config")
            .findOne(
              { _id: "teamList" },
              { projection: { [iLeague]: 1, _id: 0 } }
            );

          teamList = teamList[iLeague].filter(function (team) {
            return team.team_abbr.includes(focusedValue);
          });
          if (teamList.length >= 25) {
            teamList = teamList.filter(function (team, index) {
              return index < 25;
            });
          }

          await interaction.respond(
            teamList.map((team) => ({
              name: `${team.team_abbr.toUpperCase()}: ${team.team_name}`,
              value: team.team_abbr,
            })),
          );
        }
      } else if (focusedOption.name === "attack") {
        const iMatch = await interaction.options.getInteger("match");
        const iClanAbbr = await interaction.options.getString("team");
        const query = {
          season: config.season[iLeague],
          league: iLeague,
          week: iWeek,
          match: iMatch,
        };
        const mongoWar = await client.clientMongo
          .db("jwc")
          .collection("wars")
          .findOne(
            query,
            { projection: { clan_abbr: 1, opponent_abbr: 1, clan_war: 1, opponent_war: 1, _id: 0 } }
          );
        let members = {};
        if (mongoWar.clan_abbr == iClanAbbr) {
          members = mongoWar.clan_war.clan.members;
        } else {
          members = mongoWar.opponent_war.clan.members;
        }
        let attacks = [];
        await members.map((member) => {
          if (member.attacks[0] != undefined) attacks.push(member.attacks[0]);
          if (mongoWar.clan_war.attacksPerMember != 1) {
            if (member.attacks[1] != undefined) attacks.push(member.attacks[1]);
          }
        });
        const focusedValue = interaction.options.getFocused();
        attacks = attacks.filter(function (attack) {
          return attack.name.includes(focusedValue);
        });
        if (attacks.length >= 25) {
          attacks = attacks.filter(function (attack, index) {
            return index < 25;
          });
        }
        await interaction.respond(
          attacks.map((attack) => ({
            name: `[${attack.stars} stars / ${attack.destruction}%] ${attack.name} -> ${attack.namePlayerDef}`,
            value: attack.order,
          })),
        );
      } else if (focusedOption.name === "attacker") {
        const iMatch = await interaction.options.getInteger("match");
        const iTeamAbbr = await interaction.options.getString("team");
        const query = {
          season: config.season[iLeague],
          league: iLeague,
          week: iWeek,
          match: iMatch,
        };
        const myColl = client.clientMongo.db("jwc").collection("wars");
        const mongoWar = await myColl.findOne(query);
        let members = {};
        if (mongoWar.clan_abbr == String(iTeamAbbr).toLowerCase()) {
          members = mongoWar.clan_war.clan.members;
        } else {
          members = mongoWar.opponent_war.clan.members;
        }
        const focusedValue = interaction.options.getFocused();
        members = members.filter(function (member) {
          return member.name.includes(focusedValue);
        });
        if (members.length > 25) {
          members = members.filter(function (member, index) {
            return index < 25;
          });
        }
        await interaction.respond(
          members.map((member) => ({
            name: `[TH${member.townHallLevel}] ${member.name}`,
            value: member.tag,
          })),
        );
      } else if (focusedOption.name === "defender") {
        const iMatch = await interaction.options.getInteger("match");
        const iTeamAbbr = await interaction.options.getString("team");
        const query = {
          season: config.season[iLeague],
          league: iLeague,
          week: iWeek,
          match: iMatch,
        };
        const myColl = client.clientMongo.db("jwc").collection("wars");
        const mongoWar = await myColl.findOne(query);
        let members = {};
        if (mongoWar.clan_abbr == String(iTeamAbbr).toLowerCase()) {
          members = mongoWar.opponent_war.clan.members;
        } else {
          members = mongoWar.clan_war.clan.members;
        }
        const focusedValue = interaction.options.getFocused();
        members = members.filter(function (member) {
          return member.name.includes(focusedValue);
        });
        if (members.length > 25) {
          members = members.filter(function (member, index) {
            return index < 25;
          });
        }
        await interaction.respond(
          members.map((member) => ({
            name: `[TH${member.townHallLevel}] ${member.name}`,
            value: member.tag,
          })),
        );
      } else if (focusedOption.name === "destruction") {
        choices = [
          100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84,
          83, 82, 81, 80, 79, 78, 77, 76,
        ];
        await interaction.respond(
          choices.map((choice) => ({ name: String(choice), value: choice })),
        );
      }
    }
  },

  async execute(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (Object.values(config.adminId).includes(interaction.user.id) == false) {
      interaction.followUp(`:exclamation: *this command is for admins*`, {
        ephemeral: true,
      });
      return;
    }

    if (subcommandGroup == "create") {
      if (subcommand == "negotiation_channels") {
        createNegoChMain(interaction, client);
      } else if (subcommand == "team_channel") {
        createTeamChMain(interaction, client);
      } else if (subcommand == "team_data") {
        createTeamData(interaction, client);
      }
    } else if (subcommandGroup == "update") {
      if (subcommand == "single_war") {
        updateSingleWar(interaction, client);
      } else if (subcommand == "every_war") {
        updateEveryWar(interaction, client);
      } else if (subcommand == "league_standings") {
        updateLeagueStandings(interaction, client);
      } else if (subcommand == "season_score") {
        updateSeasonScore(interaction, client);
      } else if (subcommand == "single_account_data") {
        const tag = interaction.options.getString("tag");
        await fMongo.updateAcc(client, tag);
        await interaction.followUp({ content: "*done*" }, { ephemeral: true });
      } else if (subcommand == "all_account_data") {
        await fCron.cronLegend2pm(client);
        await interaction.followUp({ content: "*done*" }, { ephemeral: true });
      }
    } else if (subcommandGroup == "edit") {
      if (subcommand == "attack_result") {
        editAttackResult(interaction, client);
      } else if (subcommand == "war") {
        editWarResult(interaction, client);
      } else if (subcommand == "team_score") {
        editTeamScore(interaction, client);
      } else if (subcommand == "war_stream") {
        editStream(interaction, client);
      } else if (subcommand == "add_attack") {
        addAttack(interaction, client);
      } else if (subcommand == "account") {
        editAccount(interaction, client);
      }
    } else if (subcommandGroup == "edit_dc") {
      if (subcommand == "role") {
        editRole(interaction);
      } else if (subcommand == "ch_view_permission") {
        editChannelView(interaction);
      } else if (subcommand == "ch_emote") {
        editChannelEmote(interaction);
      } else if (subcommand == "ch_emote_all") {
        editChannelEmoteAll(interaction);
      } else if (subcommand == "ch_name") {
        changeChannelName(interaction);
      } else if (subcommand == "delete_nego_chs") {
        deleteNegoChs(interaction);
      }
    } else if (subcommandGroup == "info") {
      if (subcommand == "war_summary") {
        warSummary(interaction, client);
      } else if (subcommand == "ranking_summary") {
        rankingSummary(interaction, client);
      } else if (subcommand == "bot_status") {
        const embed = await functions.getEmbedStatusInfo(client.clientMongo);
        await interaction.followUp({ embeds: [embed] });
        return;
      }
      /*
      else if (subcommand == 'bot_status_legend') {
        const embed = await functions.getEmbedStatusInfoLegend(client.clientMongo);
        await interaction.followUp({ embeds: [embed] });
        return;
      }
      */
    } else if (subcommandGroup == "roster") {
      if (subcommand == "delete") {
        deleteAccFromRoster(interaction, client);
      } else if (subcommand == "update_season") {
        updateSeasonOfRoster(interaction, client);
      }
    } else if (subcommand == "send_message_war_ended") {
      sendEndMessage(interaction, client);
    } else if (subcommand == "scan_clan") {
      scanClan(interaction, client);
    } else if (subcommand == "mention_reps") {
      mentionReps(interaction, client);
    } else if (subcommand == "test") {
      fMongo.legends200(client);

      const idChannel = await interaction.options.getString("channel");
      const idMessage = await interaction.options.getString("message");
      const channel = await client.channels.fetch(idChannel);
      const message = await channel.messages.fetch(idMessage);
      message.react("<:atama:906158271432372295>");
      await interaction.followUp({ content: "*done*" }, { ephemeral: true });

      await interaction.followUp({ content: "_done_" });
      return;
    }
  },
};

async function createNegoChMain(interaction, client) {
  const iLeague = await interaction.options.getString("league");
  let iWeek = await interaction.options.getInteger("week");
  if (iWeek == null || iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  }

  const query = {
    season: config.season[iLeague],
    league: iLeague,
    week: iWeek,
    nego_channel: "",
  }; // nego_channel が未設定：チャンネル未作成の対戦のみ
  const options = {
    sort: { match: 1 },
    projection: { clan_war: 0, opponent_war: 0, result: 0 },
  };
  const cursor = client.clientMongo
    .db("jwc")
    .collection("wars")
    .find(query, options);
  let mongoWars = await cursor.toArray();
  await cursor.close();

  let myContent = "";
  if (mongoWars.length == 0) {
    myContent = `:exclamation: **No Matches**`;
  } else {
    let arrStr = [];
    if (iLeague == "five") {
      await Promise.all(
        mongoWars.map(async (mongoWar, index) => {
          arrStr[index] = await createNegoCh5v(
            interaction,
            client,
            iLeague,
            iWeek,
            mongoWar,
          );
        }),
      );
    } else {
      await Promise.all(
        mongoWars.map(async (mongoWar, index) => {
          arrStr[index] = await createNegoCh(
            interaction,
            client,
            iLeague,
            iWeek,
            mongoWar,
          );
        }),
      );
    }

    arrStr.forEach(function (value) {
      myContent += value;
    });
    myContent += `*${config.league[iLeague]} - WEEK ${iWeek}*\n`;
  }

  interaction.followUp(myContent);

  return;
}

async function createNegoCh5v(interaction, client, league, week, mongoWar) {
  const clanAbbr = mongoWar.clan_abbr;
  const clanAbbrOpp = mongoWar.opponent_abbr;
  const weekStr = "w" + week;
  const match = mongoWar.match;

  const mongoClan = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne(
      { clan_abbr: clanAbbr },
      { projection: { rep_1st: 1, rep_2nd: 1, rep_3rd: 1, team_name: 1, _id: 0 } }
    );
  const rep1stId1 = mongoClan.rep_1st.id;
  const rep2ndId1 = mongoClan.rep_2nd.id;
  let rep3rdId1 = 0;

  const mongoClanOpp = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne(
      { clan_abbr: clanAbbrOpp },
      { projection: { rep_1st: 1, rep_2nd: 1, rep_3rd: 1, team_name: 1, _id: 0 } }
    );
  const rep1stId2 = mongoClanOpp.rep_1st.id;
  const rep2ndId2 = mongoClanOpp.rep_2nd.id;
  let rep3rdId2 = 0;

  let clanAbbr1 = clanAbbr.replace(/5v-/g, "");
  let clanAbbr2 = clanAbbrOpp.replace(/5v-/g, "");

  // チャンネル作成
  let ch = await interaction.guild.channels.create({
    name: `5v-${clanAbbr1}-vs-${clanAbbr2}`,
    type: ChannelType.GuildText,
    parent: schedule.parentIdNego5v[weekStr],
    permissionOverwrites: [
      {
        id: interaction.guild.roles.everyone.id, // everyone
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
    ],
  });
  ch.permissionOverwrites.edit(config.roleId.admins5v, { ViewChannel: true });
  ch.permissionOverwrites.edit(config.roleId.bots5v, { ViewChannel: true });
  ch.permissionOverwrites.edit(config.roleId.streamer5v, { ViewChannel: true });
  await client.users.fetch(rep1stId1);
  await client.users.fetch(rep2ndId1);
  await client.users.fetch(rep1stId2);
  await client.users.fetch(rep2ndId2);
  ch.permissionOverwrites.edit(rep1stId1, { ViewChannel: true });
  ch.permissionOverwrites.edit(rep2ndId1, { ViewChannel: true });
  ch.permissionOverwrites.edit(rep1stId2, { ViewChannel: true });
  ch.permissionOverwrites.edit(rep2ndId2, { ViewChannel: true });

  if (mongoClan.rep_3rd != null && mongoClan.rep_3rd != "non-registered") {
    rep3rdId1 = await mongoClan.rep_3rd.id;
    await client.users.fetch(rep3rdId1);
    ch.permissionOverwrites.edit(rep3rdId1, { ViewChannel: true });
  }
  if (
    mongoClanOpp.rep_3rd != null &&
    mongoClanOpp.rep_3rd != "non-registered"
  ) {
    rep3rdId2 = await mongoClanOpp.rep_3rd.id;
    await client.users.fetch(rep3rdId2);
    ch.permissionOverwrites.edit(rep3rdId2, { ViewChannel: true });
  }

  let nameMatch = "";
  if (mongoWar.name_match == "") {
    nameMatch = schedule.week[weekStr];
  } else {
    nameMatch = mongoWar.name_match;
  }
  let myTitle = `**${nameMatch} | ${clanAbbr1.toUpperCase()} vs ${clanAbbr2.toUpperCase()}**`;

  // メッセージ文言作成
  const result = await functions.getDescriptionNego(
    league,
    week,
    mongoClan.team_name,
    mongoClanOpp.team_name,
    mongoWar.name_match,
  );

  let myContent = ``;
  myContent += `<@!${rep1stId1}> <@!${rep2ndId1}>`;
  if (mongoClan.rep_3rd != null && mongoClan.rep_3rd != "non-registered") {
    myContent += ` <@!${rep3rdId1}>`;
  }
  myContent += `\n`;
  myContent += `<@!${rep1stId2}> <@!${rep2ndId2}>`;
  if (
    mongoClanOpp.rep_3rd != null &&
    mongoClanOpp.rep_3rd != "non-registered"
  ) {
    myContent += ` <@!${rep3rdId2}>`;
  }
  myContent += `\n`;
  myContent += result.content;

  let myDescription = "";
  myDescription += result.description;

  let textFooter = `${config.footer} ${config.league[league]} | SEASON ${config.season[league]}`;
  const myEmbed = new EmbedBuilder()
    .setTitle(myTitle)
    .setDescription(myDescription)
    .setColor(config.color[league])
    .setFooter({ text: textFooter, iconURL: config.urlImage.jwc });

  // 作成したチャンネルにメッセージ送信
  ch.send({ content: myContent, embeds: [myEmbed] });

  const query = {
    season: config.season[league],
    league: league,
    week: week,
    match: match,
  };
  const updatedListing = { nego_channel: ch.id };
  await client.clientMongo
    .db("jwc")
    .collection("wars")
    .updateOne(query, { $set: updatedListing });

  let rtnStr = `<#${ch.id}> : ${mongoClan.team_name} :vs: ${mongoClanOpp.team_name}\n`;

  return rtnStr;
}

async function createNegoCh(interaction, client, league, week, mongoWar) {
  const clanAbbr = mongoWar.clan_abbr;
  const clanAbbrOpp = mongoWar.opponent_abbr;
  const weekStr = "w" + week;
  const match = mongoWar.match;

  const mongoClan = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: clanAbbr });
  const rep1stId1 = mongoClan.rep_1st.id;
  const rep2ndId1 = mongoClan.rep_2nd.id;
  let rep3rdId1 = 0;

  const mongoClanOpp = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: clanAbbrOpp });
  const rep1stId2 = mongoClanOpp.rep_1st.id;
  const rep2ndId2 = mongoClanOpp.rep_2nd.id;
  let rep3rdId2 = 0;

  let clanAbbr1 = clanAbbr.replace(/s-/g, "").replace(/m-/g, "");
  let clanAbbr2 = clanAbbrOpp.replace(/s-/g, "").replace(/m-/g, "");

  let parentIdNego = schedule.parentIdNego;
  let adminId = config.roleId.admins;
  let botId = config.roleId.bots;

  // チャンネル作成
  let ch = await interaction.guild.channels.create({
    name: `${league}-${clanAbbr1}-vs-${clanAbbr2}`,
    type: ChannelType.GuildText,
    parent: parentIdNego[weekStr],
    permissionOverwrites: [
      {
        id: interaction.guild.roles.everyone.id, // everyone
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
    ],
  });
  ch.permissionOverwrites.edit(adminId, { ViewChannel: true });
  ch.permissionOverwrites.edit(botId, { ViewChannel: true });
  await client.users.fetch(rep1stId1);
  await client.users.fetch(rep2ndId1);
  await client.users.fetch(rep1stId2);
  await client.users.fetch(rep2ndId2);
  ch.permissionOverwrites.edit(rep1stId1, { ViewChannel: true });
  ch.permissionOverwrites.edit(rep2ndId1, { ViewChannel: true });
  ch.permissionOverwrites.edit(rep1stId2, { ViewChannel: true });
  ch.permissionOverwrites.edit(rep2ndId2, { ViewChannel: true });

  if (mongoClan.rep_3rd != null && mongoClan.rep_3rd != "non-registered") {
    rep3rdId1 = await mongoClan.rep_3rd.id;
    await client.users.fetch(rep3rdId1);
    ch.permissionOverwrites.edit(rep3rdId1, { ViewChannel: true });
  }
  if (
    mongoClanOpp.rep_3rd != null &&
    mongoClanOpp.rep_3rd != "non-registered"
  ) {
    rep3rdId2 = await mongoClanOpp.rep_3rd.id;
    await client.users.fetch(rep3rdId2);
    ch.permissionOverwrites.edit(rep3rdId2, { ViewChannel: true });
  }

  let nameMatch = "";
  if (mongoWar.name_match == "") {
    nameMatch = schedule.week[weekStr];
  } else {
    nameMatch = mongoWar.name_match;
  }
  let myTitle = `**${nameMatch} | ${clanAbbr1.toUpperCase()} vs ${clanAbbr2.toUpperCase()}**`;

  // メッセージ文言作成
  const result = await functions.getDescriptionNego(
    league,
    week,
    mongoClan.team_name,
    mongoClanOpp.team_name,
    mongoWar.name_match,
  );

  let myContent = ``;
  myContent += `<@!${rep1stId1}> <@!${rep2ndId1}>`;
  if (mongoClan.rep_3rd != null && mongoClan.rep_3rd != "non-registered") {
    myContent += ` <@!${rep3rdId1}>`;
  }
  myContent += `\n`;
  myContent += `<@!${rep1stId2}> <@!${rep2ndId2}>`;
  if (
    mongoClanOpp.rep_3rd != null &&
    mongoClanOpp.rep_3rd != "non-registered"
  ) {
    myContent += ` <@!${rep3rdId2}>`;
  }
  myContent += `\n`;
  myContent += result.content;

  let myDescription = "";
  myDescription += result.description;

  let textFooter = `${config.footer} ${config.league[league]} | SEASON ${config.season[league]}`;
  const myEmbed = new EmbedBuilder()
    .setTitle(myTitle)
    .setDescription(myDescription)
    .setColor(config.color[league])
    .setFooter({ text: textFooter, iconURL: config.urlImage.jwc });

  // 作成したチャンネルにメッセージ送信
  ch.send({ content: myContent, embeds: [myEmbed] });

  const query = {
    season: config.season[league],
    league: league,
    week: week,
    match: match,
  };
  const updatedListing = { nego_channel: ch.id };
  await client.clientMongo
    .db("jwc")
    .collection("wars")
    .updateOne(query, { $set: updatedListing });

  let rtnStr = `<#${ch.id}> : ${mongoClan.team_name} :vs: ${mongoClanOpp.team_name}\n`;

  return rtnStr;
}

async function createTeamChMain(interaction, client) {
  const iLeague = await interaction.options.getString("league");
  const iTeamName = await interaction.options.getString("team_name");
  const iRep1st = await interaction.options.getUser("rep1st");
  const iRep2nd = await interaction.options.getUser("rep2nd");

  let ch = await createTeamCh(
    interaction,
    iLeague,
    iTeamName,
    iRep1st.id,
    iRep2nd.id,
  );

  let title = `**TEAM CHANNEL CREATED**`;
  let description = ``;
  description += `**${config.league[iLeague]}**\n`;
  description += `<#${ch.id}>\n\n`;
  description += `:one: <@!${iRep1st.id}>\n`;
  description += `:two: <@!${iRep2nd.id}>`;

  let embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(config.color[iLeague])
    .setFooter({ text: config.footer, iconURL: config.urlImage.jwc });

  await interaction.followUp({ embeds: [embed] });

  // メッセージ文言作成
  let myContent = ``;
  myContent += `<@!${iRep1st.id}>\n`;
  myContent += `<@!${iRep2nd.id}>\n`;
  myContent += `こちらのチャンネルで各種必要情報をご提出ください。\n`;
  myContent += `\n`;
  // 小数シーズン(例: 18.5)でも安全に動くように整数化
  for (let i = 0; i < Math.floor(config.seasonNext[iLeague]); i++) {
    myContent += `:small_orange_diamond:`;
  }
  myContent += `\n`;

  let footer = `${config.footer} ${config.league[iLeague]} SEASON ${config.seasonNext[iLeague]}`;

  let myTitle = `**${iTeamName}**`;
  let myDescription = "";
  myDescription += `* チーム名略称\n`;
  myDescription += `英数字 2 ～ 5 文字程度でチームを表す略称\n`;
  myDescription += `代表者は名前の後ろに略称を付けてください。\n`;
  myDescription += `\n`;
  myDescription += `* 使用クランタグ\n`;
  myDescription += `\n`;
  myDescription += `* ロゴ画像\n`;
  myDescription += `ない場合は運営側で作成しますのでご依頼ください。\n`;
  const myEmbed = new EmbedBuilder()
    .setTitle(myTitle)
    .setDescription(myDescription)
    .setColor(config.color[iLeague])
    .setFooter({ text: footer, iconURL: config.urlImage.jwc });

  // 作成したチャンネルにメッセージ送信
  ch.send({ content: myContent, embeds: [myEmbed] });

  return;
}

async function createTeamCh(
  interaction,
  iLeague,
  iTeamName,
  idRep1st,
  idRep2nd,
) {
  let chName = `${iTeamName}`;
  if (iLeague == "swiss") {
    chName = `s-` + chName;
  } else if (iLeague == "mix") {
    chName = `m-` + chName;
  }
  chName = `🆕` + chName;
  let idAdmins = "";
  let idBots = "";
  if (iLeague == "five") {
    idAdmins = config.roleId.admins5v;
    idBots = config.roleId.bots5v;
  } else {
    idAdmins = config.roleId.admins;
    idBots = config.roleId.bots;
  }
  let ch = await interaction.guild.channels.create({
    name: chName,
    type: ChannelType.GuildText,
    parent: config.parentId.repsServer[iLeague],
    permissionOverwrites: [
      {
        id: interaction.guild.roles.everyone.id, // everyone
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: idAdmins,
        allow: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: idBots,
        allow: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: idRep1st,
        allow: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: idRep2nd,
        allow: [PermissionsBitField.Flags.ViewChannel],
      },
    ],
  });

  return ch;
}

async function createTeamData(interaction, client) {
  let iLeague = interaction.options.getString("league");
  let iTeamAbbr = await interaction.options.getString("abbreviation");
  let teamAbbr = iTeamAbbr.toLowerCase();

  let listing = {
    clan_abbr: teamAbbr,
    clan_name: null,
    clan_tag: null,
    team_name: null,
    league: iLeague,
    division: null,
    logo_url: config.urlImage.jwc,
    rep_1st: null,
    rep_2nd: null,
    rep_3rd: null,
    log_channel: null,
    score: null,
    status: null,
    rep_channel: interaction.channel.id,
  };

  const result = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .insertOne(listing);
  console.log(
    `New listing created with the following id: ${result.insertedId}`,
  );
  fMongo.teamList(client.clientMongo, iLeague);

  functions.sendClanInfo(interaction, client, teamAbbr);
}

async function updateSingleWar(interaction, client) {
  const iLeague = await interaction.options.getString("league");
  const iMatch = await interaction.options.getInteger("match");
  const iState = await interaction.options.getString("change_state");

  let iWeek = await interaction.options.getInteger("week");
  if (iWeek == null || iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  }

  let title = `**RESULT UPDATED**`;
  let description = "";

  const query = {
    season: config.season[iLeague],
    league: iLeague,
    week: iWeek,
    match: iMatch,
  };

  // 強制対戦状況変更
  if (iState != null) {
    await client.clientMongo
      .db("jwc")
      .collection("wars")
      .updateOne(query, {
        $set: { "clan_war.state": iState, "opponent_war.state": iState },
      });
  }

  let mongoWar = await client.clientMongo
    .db("jwc")
    .collection("wars")
    .findOne(query);

  description += `${mongoWar.clan_abbr} vs. ${mongoWar.opponent_abbr}\n`;

  if (mongoWar.clan_war.state == "warEnded") {
    let clanWar = mongoWar.clan_war;
    let clanWarOpp = mongoWar.opponent_war;
    let mongoClan = null;
    let mongoClanOpp = null;
    let teamName = null;
    let teamNameOpp = null;
    let nAtBefore = 99;
    await fGetWars.dbUpdate(
      client,
      mongoWar,
      clanWar,
      clanWarOpp,
      iLeague,
      iWeek,
      iMatch,
      nAtBefore,
      mongoClan,
      mongoClanOpp,
      teamName,
      teamNameOpp,
    );
  }

  console.log("updateWarInfo...");
  await functions.updateWarInfo(client, iLeague, iWeek);
  description += `* War info updated: ${iLeague}-w${iWeek}\n`;
  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setDescription(description);
  embed.setColor(config.color[iLeague]);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  await interaction.followUp({ embeds: [embed] });

  let mongoWarUpdated = await client.clientMongo
    .db("jwc")
    .collection("wars")
    .findOne({
      season: config.season[iLeague],
      league: iLeague,
      week: iWeek,
      match: iMatch,
    });

  if (mongoWarUpdated.result.state == null) {
    embed.setDescription("*Before the war*");
    await interaction.followUp({ embeds: [embed] });
  } else {
    if (mongoWarUpdated.result.state == "warEnded") {
      console.log("updateScoreAccs...");
      await fScore.updateScoreAccs(
        client.clientMongo,
        config.season[iLeague],
        iLeague,
        iWeek,
        mongoWarUpdated.clan_war.clan.members,
        mongoWarUpdated.opponent_war.clan.members,
      );
      await fScore.updateScoreAccs(
        client.clientMongo,
        config.season[iLeague],
        iLeague,
        iWeek,
        mongoWarUpdated.opponent_war.clan.members,
        mongoWarUpdated.clan_war.clan.members,
      );
      console.log("calcStatsAccs...");
      await fScore.calcStatsAccs(
        client.clientMongo,
        iLeague,
        mongoWarUpdated.clan_abbr,
        config.season[iLeague],
      );
      await fScore.calcStatsAccs(
        client.clientMongo,
        iLeague,
        mongoWarUpdated.opponent_abbr,
        config.season[iLeague],
      );

      embed.setTitle(`**SCORE UPDATED**`);
      embed.setDescription(
        `${mongoWarUpdated.clan_abbr.toUpperCase()}\n${mongoWarUpdated.opponent_abbr.toUpperCase()}`,
      );
      await interaction.followUp({ embeds: [embed] });
    } else {
      embed.setDescription("* *Accounts have registered successfully*");
      await interaction.followUp({ embeds: [embed] });
    }
  }

  return;
}

async function updateEveryWar(interaction, client) {
  const iLeague = await interaction.options.getString("league");
  let iWeek = await interaction.options.getInteger("week");
  if (iWeek == null || iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  }

  let description = "";

  const query = {
    season: config.season[iLeague],
    league: iLeague,
    week: iWeek,
  };
  const options = {};
  const cursor = client.clientMongo
    .db("jwc")
    .collection("wars")
    .find(query, options);
  let mongoWars = await cursor.toArray();
  await cursor.close();

  await Promise.all(
    mongoWars.map(async (mongoWar) => {
      if (mongoWar.result.state == "warEnded") {
        let clanWar = mongoWar.clan_war;
        let clanWarOpp = mongoWar.opponent_war;
        let match = mongoWar.match;
        let mongoClan = null;
        let mongoClanOpp = null;
        let teamName = null;
        let teamNameOpp = null;
        let nAtBefore = 99;
        await fGetWars.dbUpdate(
          client,
          mongoWar,
          clanWar,
          clanWarOpp,
          iLeague,
          iWeek,
          match,
          nAtBefore,
          mongoClan,
          mongoClanOpp,
          teamName,
          teamNameOpp,
        );
        await fScore.updateScoreAccs(
          client.clientMongo,
          config.season[iLeague],
          iLeague,
          iWeek,
          mongoWar.clan_war.clan.members,
          mongoWar.opponent_war.clan.members,
        );
        await fScore.updateScoreAccs(
          client.clientMongo,
          config.season[iLeague],
          iLeague,
          iWeek,
          mongoWar.opponent_war.clan.members,
          mongoWar.clan_war.clan.members,
        );
        await fScore.calcStatsAccs(
          client.clientMongo,
          iLeague,
          mongoWar.clan_abbr,
          config.season[iLeague],
        );
        await fScore.calcStatsAccs(
          client.clientMongo,
          iLeague,
          mongoWar.opponent_abbr,
          config.season[iLeague],
        );
        description += `${mongoWar.match}: ${mongoWar.clan_abbr} vs ${mongoWar.opponent_abbr}\n`;
      }
    }),
  );

  await functions.updateWarInfo(client, iLeague, iWeek);
  description += `* War info updated: ${iLeague}-w${iWeek}\n`;

  let embed = new EmbedBuilder();
  embed.setTitle(`**RESULT UPDATED**`);
  embed.setDescription(description);
  embed.setColor(config.color[iLeague]);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });

  await interaction.followUp({ embeds: [embed] });

  return;
}

async function updateLeagueStandings(interaction, client) {
  const iLeague = await interaction.options.getString("league");

  let embed = new EmbedBuilder();
  embed.setTitle(`**STANDINGS UPDATED**`);

  const description = await fScore.autoUpdate(client.clientMongo, iLeague);
  embed.setDescription(description);

  embed.setColor(config.color[iLeague]);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });

  await fMongo.standings(client.clientMongo, iLeague);
  if (iLeague == "five") {
    await fMongo.standingsGroupStage(client.clientMongo, iLeague, "a", "b");
  } else if (iLeague == "j1") {
    await fMongo.standingsGroupStage(
      client.clientMongo,
      iLeague,
      "fist",
      "cloak",
    );
  }
  await fMongo.jwcAttacks(client.clientMongo, iLeague);

  if (iLeague == "mix") {
    for (const lvTH of config.lvTHmix) {
      await functions.updateRankingJwcAttack(client, iLeague, lvTH);
    }
  } else {
    await functions.updateRankingJwcAttack(client, iLeague, config.lvTH);
  }

  await interaction.followUp({ embeds: [embed] });

  return;
}

async function editAttackResult(interaction, client) {
  const iLeague = await interaction.options.getString("league");
  const iMatch = await interaction.options.getInteger("match");
  const iAction = await interaction.options.getString("action");
  const iClanAbbr = await interaction.options.getString("team");
  const iAttackOrder = await interaction.options.getInteger("attack");
  const iReason = await interaction.options.getString("reason");

  let iWeek = await interaction.options.getInteger("week");
  if (iWeek == null || iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  }

  let myKey = "";

  const query = {
    season: config.season[iLeague],
    league: iLeague,
    week: iWeek,
    match: iMatch,
  };
  const mongoWar = await client.clientMongo
    .db("jwc")
    .collection("wars")
    .findOne(query);

  let members = {};
  if (mongoWar.clan_abbr == iClanAbbr) {
    members = mongoWar.clan_war.clan.members;
    myKey = "clan_war.clan";
  } else {
    members = mongoWar.opponent_war.clan.members;
    myKey = "opponent_war.clan";
  }

  let attack = [];
  members.map((member, index) => {
    if (member.attacks[0] != undefined) {
      if (member.attacks[0].order == iAttackOrder) {
        attack = member.attacks[0];
        myKey += `.members.${index}.attacks.0`;
      }
    }
    if (member.attacks[1] != undefined) {
      if (mongoWar.clan_war.attacksPerMember != 1) {
        if (member.attacks[1].order == iAttackOrder) {
          attack = member.attacks[1];
          myKey += `.members.${index}.attacks.1`;
        }
      }
    }
  });

  let description = "";
  let footer = "";

  // 攻撃結果編集処理のメイン部分
  if (iAction == "1StarDeduction" || iAction == "Invalidate") {
    // ===== 共通処理: 通知作成と送信 =====
    description += `:exclamation: **VIOLATION**\n${iReason}\n`;
    footer = `${config.footer} ${config.league[iLeague]} W${iWeek} M${iMatch} - Attack No. ${iAttackOrder}\n`;

    let actionTitle = iAction == "1StarDeduction" ? "星1減" : "攻撃無効";

    const embedNotification = new EmbedBuilder()
      .setTitle(`**ATTACK RESULT EDITED: ${actionTitle}**`)
      .setDescription(description)
      .setColor(config.color[iLeague])
      .setFooter({ text: footer, iconURL: config.urlImage.jwc });

    await interaction.followUp({ embeds: [embedNotification] });

    // ===== 共通処理: 現在の攻撃状態表示 =====
    description = "";
    const stars = [];

    // 星の状態を表示用に変換
    for (let i = 0; i < 3; i++) {
      if (attack.arrStarsFlag[i] == 2) {
        stars[i] = config.emote.star;
      } else if (attack.arrStarsFlag[i] == 1) {
        stars[i] = config.emote.starShaded;
      } else {
        stars[i] = config.emote.starGray;
      }
    }

    // プレイヤー名のエスケープ処理
    const namePlayerAtt = attack.name
      .replace(/\*/g, "\\*")
      .replace(/_/g, "\\_");
    const namePlayerDef = attack.namePlayerDef
      .replace(/\*/g, "\\*")
      .replace(/_/g, "\\_");

    // 攻撃情報の説明文作成
    description += `${config.emote.thn[attack.townHallLevel]} ${config.emote.sword} ${config.emote.thn[attack.townHallLevelDef]} `;
    description += `${namePlayerAtt} ${config.emote.arrowAtt} ${namePlayerDef}\n`;

    footer = `${mongoWar.clan_war.clan.name} vs ${mongoWar.clan_war.opponent.name}`;

    // 現在の攻撃結果を表示
    const embedCurrentAttack = new EmbedBuilder()
      .setTitle(
        `:x: ${stars[0]}${stars[1]}${stars[2]}  **${attack.destruction}%**`,
      )
      .setDescription(description)
      .setColor(config.color.main)
      .setFooter({ text: footer, iconURL: config.urlImage.jwc });

    await interaction.followUp({ embeds: [embedCurrentAttack] });

    // ===== アクション固有の状態更新 =====
    let arrStarsFlagAfter = [...attack.arrStarsFlag]; // 配列のコピーを作成
    let starsAfter = [...stars]; // 表示用星配列のコピー
    let destructionAfter = attack.destruction; // 破壊率の初期値
    let penaltyText = "";

    if (iAction == "1StarDeduction") {
      // 星を1つ減らす - 最も高い星から減らす
      penaltyText = "1 star deduction";

      if (attack.arrStarsFlag[2] == 2 || attack.arrStarsFlag[2] == 1) {
        starsAfter[2] = config.emote.starGray;
        arrStarsFlagAfter[2] = 0;
      } else if (attack.arrStarsFlag[1] == 2 || attack.arrStarsFlag[1] == 1) {
        starsAfter[1] = config.emote.starGray;
        arrStarsFlagAfter[1] = 0;
      } else if (attack.arrStarsFlag[0] == 2 || attack.arrStarsFlag[0] == 1) {
        starsAfter[0] = config.emote.starGray;
        arrStarsFlagAfter[0] = 0;
      }
    } else if (iAction == "Invalidate") {
      // 全ての星を灰色に、破壊率を0%に
      penaltyText = "Invalidated";
      starsAfter = [
        config.emote.starGray,
        config.emote.starGray,
        config.emote.starGray,
      ];
      arrStarsFlagAfter = [0, 0, 0];
      destructionAfter = 0;
    }

    // 更新後の状態を表示
    const embedUpdatedAttack = new EmbedBuilder()
      .setTitle(
        `${starsAfter[0]}${starsAfter[1]}${starsAfter[2]}  **${destructionAfter}%**`,
      )
      .setDescription(description)
      .setColor(config.color.main)
      .setFooter({ text: footer, iconURL: config.urlImage.jwc });

    await interaction.followUp({ embeds: [embedUpdatedAttack] });

    // ===== 共通処理: データベース更新 =====
    description = "";

    // 攻撃データの更新
    attack.stars = iAction == "1StarDeduction" ? attack.stars - 1 : 0;
    attack.arrStarsFlag = arrStarsFlagAfter;
    attack.destruction = destructionAfter;
    attack.penalty = penaltyText;
    attack.reasonPenalty = iReason;

    const updatedListing = { [myKey]: attack };

    try {
      // MongoDBに更新を適用
      await client.clientMongo
        .db("jwc")
        .collection("wars")
        .updateOne(query, { $set: updatedListing });

      description += `:white_check_mark: *The attack result has successfully updated.*\n`;

      // ===== 共通処理: スコアと統計の更新 =====
      // 両クランのスコア更新
      await Promise.all([
        fScore.updateScoreAccs(
          client.clientMongo,
          config.season[iLeague],
          mongoWar.league,
          mongoWar.week,
          mongoWar.clan_war.clan.members,
          mongoWar.opponent_war.clan.members,
        ),
        fScore.updateScoreAccs(
          client.clientMongo,
          config.season[iLeague],
          mongoWar.league,
          mongoWar.week,
          mongoWar.opponent_war.clan.members,
          mongoWar.clan_war.clan.members,
        ),
      ]);

      // 両クランの統計更新
      await Promise.all([
        fScore.calcStatsAccs(
          client.clientMongo,
          mongoWar.league,
          mongoWar.clan_abbr,
          config.season[iLeague],
        ),
        fScore.calcStatsAccs(
          client.clientMongo,
          mongoWar.league,
          mongoWar.opponent_abbr,
          config.season[iLeague],
        ),
      ]);

      description += `:white_check_mark: *The account stats has successfully updated.*\n\n`;
    } catch (error) {
      description += `:warning: *更新中にエラーが発生しました。*\n\n`;
      console.error("更新エラー:", error);
    }

    // 管理コマンドの案内
    description += `run </admin edit war:${config.adminCommand["admin"].id}> to change the final stats of the war\n`;

    // ===== 共通処理: 結果ログの表示 =====
    const embedResultLog = new EmbedBuilder()
      .setTitle(`**ATTACK RESULT EDITED**: ${actionTitle}`)
      .setDescription(description)
      .setColor(config.color[iLeague])
      .setFooter({ text: config.footer, iconURL: config.urlImage.jwc })
      .setTimestamp();

    await interaction.followUp({ embeds: [embedResultLog] });
  }

  await client.channels.cache
    .get(mongoWar.nego_channel)
    .send({ embeds: [embedResultLog] });

  return;
}

async function editWarResult(interaction, client) {
  const iLeague = await interaction.options.getString("league");
  const iMatch = await interaction.options.getInteger("match");
  const iAction = await interaction.options.getString("action");
  const iClanAbbr = await interaction.options.getString("team");
  const iPoint = await interaction.options.getInteger("point");
  const iReason = await interaction.options.getString("reason");

  let iWeek = await interaction.options.getInteger("week");
  if (iWeek == null || iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  }

  const query = {
    season: config.season[iLeague],
    league: iLeague,
    week: iWeek,
    match: iMatch,
  };
  const myColl = client.clientMongo.db("jwc").collection("wars");
  const mongoWar = await myColl.findOne(query);

  if (iAction == "stream") {
    let description = "";

    description += `* ${config.league[mongoWar.league]}\n`;
    if (mongoWar.name_match != "") {
      description += `* ${mongoWar.name_match}\n`;
    } else {
      description += `* WEEK ${mongoWar.week}\n`;
      description += `* MATCH ${mongoWar.match}\n`;
    }
    description += `**${mongoWar.clan_abbr.toUpperCase()} vs. ${mongoWar.opponent_abbr.toUpperCase()}**\n`;

    if (mongoWar[iAction] == false || mongoWar[iAction] == null) {
      var updatedListing = { [iAction]: true };
      description += `STREAM: ON`;
    } else {
      var updatedListing = { [iAction]: false };
      description += `STREAM: OFF`;
    }
    await client.clientMongo
      .db("jwc")
      .collection("wars")
      .updateOne(query, { $set: updatedListing });

    await functions.updateWarInfo(client, iLeague, iWeek);

    const embed = new EmbedBuilder();
    embed.setTitle(`**:tv: STREAM**`);
    embed.setDescription(description);
    embed.setColor(config.color[iLeague]);
    embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });

    await interaction.followUp({ embeds: [embed] });

    return;
  }

  let description = "";

  description += `:exclamation: **VIOLATION**\n`;
  description += `${iReason}\n\n`;

  if (iAction == "forfeit") {
    description += await forfeit(client, query, mongoWar, iClanAbbr);
  } else if (iAction == "deductStar") {
    description += await deductStarInWarResult(
      client,
      query,
      mongoWar,
      iClanAbbr,
      iPoint,
    );
  } else if (iAction == "addDefPoint") {
    description += await addDefPoint(
      client,
      query,
      mongoWar,
      iClanAbbr,
      iPoint,
    );
  } else if (iAction == "deductStarAndDestruction") {
    description += await deductStarAndDestruction(
      client,
      query,
      mongoWar,
      iClanAbbr,
      iPoint,
    );
  }

  description += `\n`;
  description += `${config.league[iLeague]} - Week ${iWeek} - Match ${iMatch}\n`;
  description += `<#${mongoWar.nego_channel}>\n`;

  description += `\n`;

  const mongoWarUpdated = await myColl.findOne(query);

  if (iAction != "forfeit") {
    let logChIdLocal = null;
    let teamName = null;
    let teamNameOpp = null;
    let nAtBefore = 99;
    await fGetWars.dbUpdate(
      client,
      mongoWarUpdated,
      mongoWarUpdated.clan_war,
      mongoWarUpdated.opponent_war,
      mongoWarUpdated.league,
      mongoWarUpdated.week,
      mongoWarUpdated.match,
      nAtBefore,
      logChIdLocal,
      teamName,
      teamNameOpp,
    );
  }
  description += `:white_check_mark: *The War result has successfully updated.*\n`;

  await functions.updateWarInfo(
    client,
    mongoWarUpdated.league,
    mongoWarUpdated.week,
  );
  description += `:white_check_mark: *The war info has successfully updated.*: ${config.league[mongoWarUpdated.league]}-w${mongoWarUpdated.week}\n`;

  const embed = new EmbedBuilder();
  embed.setTitle("**WAR RESULT EDITED**");
  embed.setDescription(description);
  embed.setColor(config.color[iLeague]);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  embed.setTimestamp();
  await interaction.followUp({ embeds: [embed] });

  const negoCh = await client.channels.cache.get(mongoWar.nego_channel);
  await negoCh.send({ embeds: [embed] });
  const newChName = negoCh.name.replace("✅", "❌");
  await negoCh.edit(mongoWar.nego_channel, { name: newChName });

  return;
}

async function forfeit(client, query, mongoWar, clanAbbr) {
  let description = "";
  let note = "";

  let clanAbbrOpp = "";
  let resultClan = "";
  let resultOpponent = "";
  if (mongoWar.clan_abbr == clanAbbr) {
    clanAbbrOpp = mongoWar.opponent_abbr;
    resultClan = "win";
    resultOpponent = "lose";
  } else {
    clanAbbrOpp = mongoWar.clan_abbr;
    resultClan = "lose";
    resultOpponent = "win";
  }

  description += `:x: **FORFEITED**\n`;
  description += `_${clanAbbr.toUpperCase()} won_\n`;
  description += `_${clanAbbrOpp.toUpperCase()} lost_\n`;

  note = `Forfeited: ${clanAbbr.toUpperCase()} won`;
  resultUpdated = {
    state: "forfeited",
    note: note,
    clan: resultClan,
    opponent: resultOpponent,
  };

  await client.clientMongo
    .db("jwc")
    .collection("wars")
    .updateOne(query, { $set: { result: resultUpdated } });

  return description;
}

async function deductStarInWarResult(
  client,
  query,
  mongoWar,
  clanAbbr,
  iPoint,
) {
  let description = "";
  let note = "";
  let penalty = {};

  description += `* **PENALTY**: ${clanAbbr.toUpperCase()}\n`;
  if (iPoint == 1) {
    note = `1 star deducted`;
  } else {
    note = `${iPoint} stars deducted`;
  }
  description += `_${note}_\n`;

  if (mongoWar.clan_abbr == clanAbbr) {
    penalty = mongoWar.clan_war.clan.penalty ?? {};
    penalty.star = -iPoint;
    await client.clientMongo
      .db("jwc")
      .collection("wars")
      .updateOne(query, { $set: { "clan_war.clan.penalty": penalty } });
  } else if (mongoWar.opponent_abbr == clanAbbr) {
    penalty = mongoWar.opponent_war.clan.penalty ?? {};
    penalty.star = -iPoint;
    await client.clientMongo
      .db("jwc")
      .collection("wars")
      .updateOne(query, { $set: { "opponent_war.clan.penalty": penalty } });
  }

  return description;
}

async function addDefPoint(client, query, mongoWar, clanAbbr, iPoint) {
  let description = "";
  let note = "";
  let penalty = {};

  description += `* ${clanAbbr.toUpperCase()}\n`;
  if (iPoint == 1) {
    note = `1 defense point added`;
  } else {
    note = `${iPoint} defense points added`;
  }
  description += `_${note}_\n`;

  if (mongoWar.clan_abbr == clanAbbr) {
    penalty = mongoWar.clan_war.clan.penalty ?? {};
    penalty.defPoint = iPoint;
    await client.clientMongo
      .db("jwc")
      .collection("wars")
      .updateOne(query, { $set: { "clan_war.clan.penalty": penalty } });
  } else {
    penalty = mongoWar.opponent_war.clan.penalty ?? {};
    penalty.defPoint = iPoint;
    await client.clientMongo
      .db("jwc")
      .collection("wars")
      .updateOne(query, { $set: { "opponent_war.clan.penalty": penalty } });
  }

  return description;
}

async function deductStarAndDestruction(
  client,
  query,
  mongoWar,
  clanAbbr,
  iPoint,
) {
  let description = "";
  let note = "";
  let penalty = {};

  description += `* **PENALTY**: ${clanAbbr.toUpperCase()}\n`;
  if (iPoint == 1) {
    note = `1 star and 2% deducted`;
  } else {
    note = `${iPoint} stars and ${2 * iPoint}% deducted`;
  }
  description += `_${note}_\n`;

  if (mongoWar.clan_abbr == clanAbbr) {
    penalty = mongoWar.clan_war.clan.penalty ?? {};
    penalty.star = -iPoint;
    penalty.destruction = -2 * iPoint;
    await client.clientMongo
      .db("jwc")
      .collection("wars")
      .updateOne(query, { $set: { "clan_war.clan.penalty": penalty } });
  } else {
    penalty = mongoWar.opponent_war.clan.penalty ?? {};
    penalty.star = -iPoint;
    penalty.destruction = -2 * iPoint;
    await client.clientMongo
      .db("jwc")
      .collection("wars")
      .updateOne(query, { $set: { "opponent_war.clan.penalty": penalty } });
  }

  return description;
}

async function editTeamScore(interaction, client) {
  const iLeague = await interaction.options.getString("league");
  const iAction = await interaction.options.getString("action");
  const iClanAbbr = await interaction.options.getString("team");
  const iPoint = await interaction.options.getInteger("point");

  const query = { clan_abbr: iClanAbbr };
  const mongoClan = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne(query);

  let description = "";
  if (iAction == "deductStar") {
    description = await deductStarInTeamScore(
      client,
      query,
      mongoClan,
      iClanAbbr,
      iPoint,
    );
  } else if (iAction == "addPoint") {
    description = await addPointInTeamScore(
      client,
      query,
      mongoClan,
      iClanAbbr,
      iPoint,
    );
  }
  description += `\n`;

  const mongoClanNew = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne(query);
  await fScore.updateScore(client.clientMongo, iLeague, mongoClanNew);
  await fMongo.standings(client.clientMongo, iLeague);
  //await fCreateJSON.tableStandings(client.clientMongo, iLeague);
  description += `:white_check_mark: *${config.league[iLeague]} standings has successfully updated.*\n`;

  const embed = new EmbedBuilder()
    .setTitle("**LEAGUE SCORE EDITED**")
    .setDescription(description)
    .setColor(config.color[iLeague])
    .setFooter({ text: config.footer, iconURL: config.urlImage.jwc })
    .setTimestamp();
  await interaction.followUp({ embeds: [embed] });

  return;
}

async function deductStarInTeamScore(
  client,
  query,
  mongoClan,
  iClanAbbr,
  iPoint,
) {
  let description = "";
  let note = "";
  let penalty = {};

  description += `* ${iClanAbbr.toUpperCase()}\n`;
  if (iPoint == 1) {
    note = `:small_red_triangle: 1 star deducted`;
  } else {
    note = `:small_red_triangle: ${iPoint} stars deducted`;
  }
  description += `*${note}*\n`;

  penalty = mongoClan.score.penalty ?? {};
  if (penalty.star == null) {
    penalty.star = -iPoint;
  } else {
    penalty.star += -iPoint;
  }
  if (penalty.star == -1) {
    penalty.note = `1 star deducted`;
  } else {
    penalty.note = `${-penalty.star} stars deducted`;
  }
  await client.clientMongo
    .db("jwc")
    .collection("clans")
    .updateOne(query, { $set: { "score.sum.penalty": penalty } });
  await client.clientMongo
    .db("jwc")
    .collection("clans")
    .updateOne(query, { $set: { "score.sumQ.penalty": penalty } });

  return description;
}

async function addPointInTeamScore(
  client,
  query,
  mongoClan,
  iClanAbbr,
  iPoint,
) {
  let description = "";
  let note = "";
  let add = {};

  description += `* ${iClanAbbr.toUpperCase()}\n`;
  if (iPoint == 1) {
    note = `:white_check_mark: 1 point added`;
  } else {
    note = `:white_check_mark: ${iPoint} point added`;
  }
  description += `*${note}*\n`;

  add = mongoClan.score.add ?? {};
  if (add.point == null) {
    add.point = iPoint;
  } else {
    add.point += iPoint;
  }
  if (add.point == 1) {
    add.note = `1 point added`;
  }
  if (add.point == 2) {
    add.note = `2 points added`;
    add.nWin = 1;
  } else {
    add.note = `${add.point} points added`;
  }
  await client.clientMongo
    .db("jwc")
    .collection("clans")
    .updateOne(query, { $set: { "score.add": add } });
  await client.clientMongo
    .db("jwc")
    .collection("clans")
    .updateOne(query, { $set: { "score.add": add } });

  return description;
}

async function addAttack(interaction, client) {
  const iLeague = await interaction.options.getString("league");
  const iMatch = await interaction.options.getInteger("match");
  const iClanAbbr = await interaction.options.getString("team").toLowerCase();
  const iAttackerTag = await interaction.options.getString("attacker");
  const iDefenderTag = await interaction.options.getString("defender");
  const iStars = await interaction.options.getInteger("stars");
  const iDestruction = await interaction.options.getInteger("destruction");
  const iAttackType = await interaction.options.getString("attack_type");

  let iWeek = await interaction.options.getInteger("week");
  if (iWeek == null || iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  }

  let myKeyClan = "";
  let myKeyOpp = "";
  let myKeyAttack = "";

  const query = {
    season: config.season[iLeague],
    league: iLeague,
    week: iWeek,
    match: iMatch,
  };
  const mongoWar = await client.clientMongo
    .db("jwc")
    .collection("wars")
    .findOne(query);
  let attackCountBefore = 0;
  let membersAtt = {};
  let membersDef = {};
  if (mongoWar.clan_abbr == iClanAbbr) {
    attackCountBefore = mongoWar.clan_war.clan.attackCount;
    membersAtt = mongoWar.clan_war.clan.members;
    membersDef = mongoWar.opponent_war.clan.members;
    myKeyClan = "clan_war";
    myKeyOpp = "opponent_war";
  } else {
    attackCountBefore = mongoWar.opponent_war.clan.attackCount;
    membersAtt = mongoWar.opponent_war.clan.members;
    membersDef = mongoWar.clan_war.clan.members;
    myKeyClan = "opponent_war";
    myKeyOpp = "clan_war";
  }

  let attacker = {};
  let nDef = 0;
  membersAtt.map((member, index) => {
    if (member.tag == iAttackerTag) {
      attacker = member;
      if (member.attacks.length == 0) {
        myKeyAttack = `${myKeyClan}.clan.members.${index}.attacks.0`;
      } else if (member.attacks.length == 1) {
        myKeyAttack += `${myKeyClan}.clan.members.${index}.attacks.1`;
      }
    }
    if (member.attacks[0] != null) {
      if (
        member.attacks[0].defenderTag == iDefenderTag &&
        member.attacks[0].stars != 3
      ) {
        nDef += 1;
      }
    }
    if (member.attacks[1] != null) {
      if (
        member.attacks[1].defenderTag == iDefenderTag &&
        member.attacks[0].stars != 3
      ) {
        nDef += 1;
      }
    }
  });
  if (iStars != 3) {
    nDef += 1;
  }

  let myKeyOppMember = "";
  let defender = {};
  let defenseCountBefore = 0;
  let bestOpponentAttackerTag = "";
  membersDef.map((member, index) => {
    if (member.tag == iDefenderTag) {
      defender = member;
      myKeyOppMember = `${myKeyOpp}.clan.members.${index}`;
      defenseCountBefore = member.defenseCount;
      bestOpponentAttackerTag = member._bestOpponentAttackerTag;
    }
  });

  let starsBefore = 0;
  let destructionBefore = 0;
  membersAtt.map((member, index) => {
    if (member.tag == bestOpponentAttackerTag) {
      if (member.attacks[0].defenderTag == iDefenderTag) {
        starsBefore = member.attacks[0].stars;
        destructionBefore = member.attacks[0].destruction;
      } else if (member.attacks[1].defenderTag == iDefenderTag) {
        starsBefore = member.attacks[1].stars;
        destructionBefore = member.attacks[1].destruction;
      }
    }
  });
  let bestOpponentAttackerTagNew = "";
  if (starsBefore < iStars) {
    bestOpponentAttackerTagNew = iAttackerTag;
  } else if ((starsBefore = iStars)) {
    if (destructionBefore <= iDestruction) {
      bestOpponentAttackerTagNew = iAttackerTag;
    } else {
      bestOpponentAttackerTagNew = bestOpponentAttackerTag;
    }
  } else {
    bestOpponentAttackerTagNew = bestOpponentAttackerTag;
  }

  // 星絵文字用配列作成
  let arrStarsFlag = [0, 0, 0];
  for (let j = 0; j < iStars; j++) {
    arrStarsFlag[j] = 2;
  }
  if (starsBefore <= iStars) {
    for (let k = 0; k < starsBefore; k++) {
      arrStarsFlag[k] = 1;
      if (iAttackType == "overkill") {
        arrStarsFlag[k] = 3;
      }
    }
  } else {
    for (let k = 0; k < iStars; k++) {
      arrStarsFlag[k] = 1;
      if (iAttackType == "overkill") {
        arrStarsFlag[k] = 3;
      }
    }
  }

  let stars = [];
  for (i = 0; i < 3; i++) {
    if (arrStarsFlag[i] == 3) {
      stars[i] = config.emote.starRed;
    } else if (arrStarsFlag[i] == 2) {
      stars[i] = config.emote.star;
    } else if (arrStarsFlag[i] == 1) {
      stars[i] = config.emote.starShaded;
    } else if (arrStarsFlag[i] == 0) {
      stars[i] = config.emote.starGray;
    }
  }

  let order =
    mongoWar.clan_war.clan.attackCount +
    mongoWar.opponent_war.clan.attackCount +
    1;

  let description = "";
  let footer = "";

  description += `${stars[0]}${stars[1]}${stars[2]}  **${iDestruction}%**\n\n`;
  description += `${config.emote.thn[attacker.townHallLevel]}`;
  description += ` ${config.emote.sword}`;
  description += ` ${config.emote.thn[defender.townHallLevel]}\n\n`;
  let namePlayerAtt = attacker.name.replace(/\*/g, "\\*").replace(/_/g, "\\_");
  let namePlayerDef = defender.name.replace(/\*/g, "\\*").replace(/_/g, "\\_");
  description += `${namePlayerAtt} ${config.emote.arrowAtt} ${namePlayerDef}\n`;

  let ptDef = 0;
  if (iAttackType != "fresh" && iStars != 3) {
    ptDef = 1;
  }

  // update mongo attack
  let newAttack = {};
  newAttack.stars = iStars;
  newAttack.arrStarsFlag = arrStarsFlag;
  newAttack.destruction = iDestruction;
  newAttack.order = order;
  newAttack.duration = 180;
  newAttack.action = "attack";
  newAttack.attackType = iAttackType;
  newAttack.attackerTag = iAttackerTag;
  newAttack.name = attacker.name;
  newAttack.townHallLevel = attacker.townHallLevel;
  newAttack.defenderTag = iDefenderTag;
  newAttack.namePlayerDef = defender.name;
  newAttack.townHallLevelDef = defender.townHallLevel;
  newAttack.nDef = nDef;
  newAttack.ptDef = ptDef;
  var updatedListing = { [myKeyAttack]: newAttack };
  await client.clientMongo
    .db("jwc")
    .collection("wars")
    .updateOne(query, { $set: updatedListing });

  // update mongo defense
  let defenseCountNew = defenseCountBefore + 1;
  var updatedListing = {
    [`${myKeyOppMember}.defenseCount`]: defenseCountNew,
    [`${myKeyOppMember}._bestOpponentAttackerTag`]: bestOpponentAttackerTagNew,
  };
  await client.clientMongo
    .db("jwc")
    .collection("wars")
    .updateOne(query, { $set: updatedListing });

  const mongoWarNew = await client.clientMongo
    .db("jwc")
    .collection("wars")
    .findOne(query);
  let membersAttNew = mongoWarNew[myKeyClan].clan.members;
  let membersDefNew = mongoWarNew[myKeyOpp].clan.members;

  // update mongo stats
  let starsAfter = mongoWar[myKeyClan].clan.stars + iStars - starsBefore;
  let destructionAfter = await calcDestruction(membersAttNew, membersDefNew);
  let attackCountAfter = attackCountBefore + 1;
  var updatedListing = {
    [`${myKeyClan}.clan.stars`]: starsAfter,
    [`${myKeyClan}.clan.destruction`]: destructionAfter,
    [`${myKeyClan}.clan.attackCount`]: attackCountAfter,
  };
  await client.clientMongo
    .db("jwc")
    .collection("wars")
    .updateOne(query, { $set: updatedListing });

  description += `\n\n`;
  description += `:white_check_mark: The attack result has been added successfully.\n`;

  await fScore.updateScoreAccs(
    client.clientMongo,
    config.season[iLeague],
    mongoWar.league,
    mongoWar.week,
    mongoWar.clan_war.clan.members,
    mongoWar.opponent_war.clan.members,
  );
  await fScore.updateScoreAccs(
    client.clientMongo,
    config.season[iLeague],
    mongoWar.league,
    mongoWar.week,
    mongoWar.opponent_war.clan.members,
    mongoWar.clan_war.clan.members,
  );
  await fScore.calcStatsAccs(
    client.clientMongo,
    mongoWar.league,
    mongoWar.clan_abbr,
    config.season[iLeague],
  );
  await fScore.calcStatsAccs(
    client.clientMongo,
    mongoWar.league,
    mongoWar.opponent_abbr,
    config.season[iLeague],
  );
  description += `:white_check_mark: The player stats has been updated successfully.\n`;

  footer = `${config.footer} ${config.league[iLeague]} W${iWeek} M${iMatch} - Attack No. ${order}\n`;
  const embed = new EmbedBuilder()
    .setTitle("**ATTACK ADDED**")
    .setDescription(description)
    .setColor(config.color[iLeague])
    .setFooter({ text: footer, iconURL: config.urlImage.jwc });
  await interaction.followUp({ embeds: [embed] });

  return;
}

async function calcDestruction(membersAtt, membersDef) {
  let sumDestruction = 0;
  membersDef.map((memberDef, index) => {
    bestOpponentAttackerTag = memberDef._bestOpponentAttackerTag;
    membersAtt.map((memberAtt, index) => {
      if (memberAtt.tag == bestOpponentAttackerTag) {
        if (memberAtt.attacks[0] != null) {
          if (memberAtt.attacks[0].defenderTag == memberDef.tag) {
            sumDestruction += memberAtt.attacks[0].destruction;
          } else if (memberAtt.attacks[1] != null) {
            if (memberAtt.attacks[1].defenderTag == memberDef.tag) {
              sumDestruction += memberAtt.attacks[1].destruction;
            }
          }
        }
      }
    });
  });
  let destruction = sumDestruction / membersDef.length;
  destruction = Math.round(destruction * 100) / 100;
  return destruction;
}

async function editAccount(interaction, client) {
  const iAccountTag = await interaction.options.getString("tag");
  const iAction = await interaction.options.getString("action");

  const query = { tag: iAccountTag };
  const acc = await client.clientMongo
    .db("jwc")
    .collection("accounts")
    .findOne(query);

  const title = await functions.getAccInfoTitle(acc, (formatLength = "long"));
  let description = "";
  description += await functions.getAccInfoDescriptionMain(
    acc,
    (formatLength = "long"),
  );
  description += "\n";

  if (iAction == "status" || iAction == "streamer") {
    if (acc[iAction] == false || acc[iAction] == null) {
      var updatedListing = { [iAction]: true };
      description += `${iAction.toUpperCase()}: ON`;
    } else {
      var updatedListing = { [iAction]: false };
      description += `${iAction.toUpperCase()}: OFF`;
    }
  }
  await client.clientMongo
    .db("jwc")
    .collection("accounts")
    .updateOne(query, { $set: updatedListing });

  let embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setDescription(description);
  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  await interaction.followUp({ embeds: [embed] });

  return;
}

async function editRole(interaction) {
  const iUser = await interaction.options.getUser("user");
  const iAction = await interaction.options.getString("action");
  const iLeague = await interaction.options.getString("league");

  functions.editRoleMain(interaction, iUser, iAction, iLeague, 1);

  return;
}

async function editChannelView(interaction) {
  const iAction = await interaction.options.getString("action");
  const iUser = await interaction.options.getUser("user");
  const iCh = await interaction.options.getChannel("channel");

  let title = "";
  let description = "";

  if (iAction == "delete") {
    iCh.permissionOverwrites.edit(iUser.id, { ViewChannel: false });
    title = `*REP REMOVED*`;
    description = `<@!${iUser.id}>\n<#${iCh.id}>`;
  } else if (iAction == "add") {
    iCh.permissionOverwrites.edit(iUser.id, { ViewChannel: true });
    title = `*REP ADDED*`;
    description = `<@!${iUser.id}>\n<#${iCh.id}>`;
  }

  let embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(config.color.main)
    .setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  await interaction.followUp({ embeds: [embed] });

  return;
}

async function editChannelEmote(interaction) {
  const iAction = await interaction.options.getString("action");
  const oldCh = await interaction.guild.channels.fetch(interaction.channelId);

  let message = "";
  let newChName = "";
  if (iAction == "initialize") {
    newChName = oldCh.name;
    newChName = newChName.replace("👤", "");
    newChName = newChName.replace("🆕", "");
    newChName = newChName.replace("✅", "");
    newChName = newChName.replace("❌", "");
    message = "*done*";
  } else if (iAction == "new") {
    newChName = "🆕" + oldCh.name;
    message = "🆕 *new*";
  } else if (iAction == "accepted") {
    newChName = "✅" + oldCh.name;
    message = "✅ *accepted*";
  } else if (iAction == "roster") {
    newChName = "👤" + oldCh.name;
    message = "👤 *confirmed*";
  } else if (iAction == "declined") {
    newChName = oldCh.name;
    newChName = newChName.replace("✅", "");
    newChName = newChName.replace("🆕", "");
    newChName = "❌" + newChName;
    message = "❌ *declined*";
  }

  await interaction.guild.channels.edit(interaction.channelId, {
    name: newChName,
  });
  interaction.followUp(message);

  return;
}

async function editChannelEmoteAll(interaction) {
  const iLeague = interaction.options.getString("league");

  let description = "";
  let parentIdLeague = config.parentId.repsServer[iLeague];

  const channels = await interaction.guild.channels.fetch();

  for (const [, channel] of channels) {
    if (channel.parentId == parentIdLeague) {
      let newChName = channel.name;
      newChName = newChName
        .replace("👤", "")
        .replace("🆕", "")
        .replace("✅", "")
        .replace("❌", "");
      await channel.setName(newChName);
      description += newChName + "\n";
    }
  }

  await interaction.followUp(
    `✅ *successfully deleted emotes: ${config.league[iLeague]}*\n${description}`,
  );
}

async function deleteAccFromRoster(interaction, client) {
  const iTeamAbbr = await interaction.options.getString("team");
  const iAcc = await interaction.options.getString("account");

  const query = { clan_abbr: iTeamAbbr };
  const options = { projection: { _id: 0, league: 1 } };
  const mongoTeam = await client.clientMongo.db("jwc").collection("clans").findOne(query, options);

  if (!mongoTeam) {
    await interaction.followUp({ content: `*ERROR: no team for ${iTeamAbbr}*`, ephemeral: true });
    return;
  }

  let leagueM = mongoTeam.league;
  if (leagueM == "j1" || leagueM == "j2") {
    leagueM = "j";
  }

  let title = `ROSTER DELETED | ${iTeamAbbr.toUpperCase()}`;
  let description = "";
  let footer = `${config.footer} ${config.league[mongoTeam.league]}`;

  if (iAcc == "all") {
    const query = { [`homeClanAbbr.${leagueM}`]: iTeamAbbr, status: true };
    const options = { projection: { _id: 0, tag: 1 } };
    const cursor = client.clientMongo
      .db("jwc")
      .collection("accounts")
      .find(query, options);
    const accs = await cursor.toArray();
    await cursor.close();

    let arrDescription = [];

    await Promise.all(
      accs.map(async (acc, index) => {
        const [result, mongoAcc] = await fMongo.deleteRoster(
          client.clientMongo,
          mongoTeam.league,
          acc.tag,
        );
        arrDescription[index] = ` ${config.emote.thn[mongoAcc.townHallLevel]}`;
        arrDescription[index] +=
          ` **${functions.nameReplacer(mongoAcc.name)}**`;
        const urlPlayer = `https://link.clashofclans.com/jp?action=OpenPlayerProfile&tag=${mongoAcc.tag.slice(1)}`;
        arrDescription[index] += ` [__${mongoAcc.tag}__](${urlPlayer})`;
        arrDescription[index] += `\n`;
        arrDescription[index] +=
          `:bust_in_silhouette: ${mongoAcc.pilotName[leagueM]}`;
        if (
          mongoAcc.pilotDC != "no discord acc" &&
          mongoAcc.pilotDC != null &&
          mongoAcc.pilotDC != ""
        ) {
          arrDescription[index] += ` <@!${mongoAcc.pilotDC.id}>`;
        }
        arrDescription[index] += `\n`;
        if (result.modifiedCount == 1 && result.matchedCount == 1) {
          arrDescription[index] += ":white_check_mark: _sucessfully deleted_";
        } else {
          arrDescription[index] += ":question: _ERROR_";
        }
        arrDescription[index] += `\n`;
        arrDescription[index] += `\n`;
      }),
    );

    let nAccPerPage = 10;

    let description = [];
    for (let i = 0; i < 10; i++) {
      description[i] = "";
    }
    arrDescription.forEach(function (value, index) {
      for (let i = 0; i < 10; i++) {
        if (nAccPerPage * i <= index && index < nAccPerPage * (i + 1)) {
          description[i] += value;
          break;
        }
      }
    });

    let embed = new EmbedBuilder();
    embed.setTitle(title);
    embed.setDescription(description[0]);
    embed.setColor(config.color[mongoTeam.league]);
    embed.setFooter({ text: footer, iconURL: config.urlImage.jwc });
    await interaction.followUp({ embeds: [embed] });

    for (let i = 1; i < 10; i++) {
      if (description[i] != "") {
        embed.setDescription(description[i]);
        await interaction.followUp({ embeds: [embed] });
      }
    }
  } else {
    const [result, mongoAcc] = await fMongo.deleteRoster(
      client.clientMongo,
      mongoTeam.league,
      iAcc,
    );
    if (result.modifiedCount == 1 && result.matchedCount == 1) {
      description += ` ${config.emote.thn[mongoAcc.townHallLevel]}`;
      description += ` **${functions.nameReplacer(mongoAcc.name)}**`;
      const urlPlayer = `https://link.clashofclans.com/jp?action=OpenPlayerProfile&tag=${mongoAcc.tag.slice(1)}`;
      description += ` [__${mongoAcc.tag}__](${urlPlayer})`;
      description += `\n`;
      description += `:bust_in_silhouette: ${mongoAcc.pilotName[leagueM]}`;
      if (
        mongoAcc.pilotDC != "no discord acc" &&
        mongoAcc.pilotDC != null &&
        mongoAcc.pilotDC != ""
      ) {
        description += ` <@!${mongoAcc.pilotDC.id}>`;
      }
      description += `\n`;
      description += ":white_check_mark: sucessfully deleted";
    } else {
      description = ":question: _ERROR_";
    }

    let embed = new EmbedBuilder();
    embed.setTitle(title);
    embed.setDescription(description);
    embed.setColor(config.color[mongoTeam.league]);
    embed.setFooter({ text: footer, iconURL: config.urlImage.jwc });
    await interaction.followUp({ embeds: [embed] });
  }

  return;
}

async function updateSeasonOfRoster(interaction, client) {
  const iLeague = await interaction.options.getString("league");

  let leagueM = config.leagueM[iLeague];

  const query = { status: true };
  const options = {
    projection: { _id: 0, tag: 1, homeClanAbbr: 1, stats: 1, lastSeason: 1 },
  };
  const cursor = client.clientMongo
    .db("jwc")
    .collection("accounts")
    .find(query, options);
  let mongoAccs = await cursor.toArray();
  await cursor.close();

  await Promise.all(
    mongoAccs.map(async (mongoAcc, index) => {
      let listingSet = {};
      if (mongoAcc.lastSeason == null) {
        listingSet.lastSeason = {};
      } else {
        listingSet.lastSeason = mongoAcc.lastSeason;
      }
      listingSet.lastSeason[leagueM] = {};
      listingSet.lastSeason[leagueM].season = config.seasonLast[iLeague];
      listingSet.lastSeason[leagueM].homeClanAbbr =
        mongoAcc.homeClanAbbr[leagueM];
      if (mongoAcc.stats == null) {
        listingSet.lastSeason[leagueM].stats = null;
      } else {
        listingSet.lastSeason[leagueM].stats = mongoAcc.stats[leagueM];
      }

      const result = await client.clientMongo
        .db("jwc")
        .collection("accounts")
        .updateOne({ tag: mongoAcc.tag }, { $set: listingSet });
    }),
  );

  await interaction.followUp({
    content: `:white_check_mark: _Updated season of roster_`,
  });

  return;
}

async function updateSeasonScore(interaction, client) {
  const iLeague = await interaction.options.getString("league");

  const query = {
    league: iLeague,
    [`status.${functions.seasonToString(config.seasonLast[iLeague])}`]: "true",
  };
  const options = {
    projection: { _id: 0, clan_abbr: 1, score: 1, score_last_season: 1 },
  };
  const cursor = client.clientMongo
    .db("jwc")
    .collection("clans")
    .find(query, options);
  const mongoTeams = await cursor.toArray();
  await cursor.close();

  console.dir(mongoTeams.length);

  await Promise.all(
    mongoTeams.map(async (mongoTeam, index) => {
      let listingSet = {};
      if (mongoTeam.score) {
        listingSet.score_last_season = mongoTeam.score;
        listingSet.score_last_season.season = config.seasonLast[iLeague];
        listingSet.score = null;
      }
      console.log(mongoTeam.clan_abbr);
      console.dir(listingSet);

      await client.clientMongo
        .db("jwc")
        .collection("clans")
        .updateOne({ clan_abbr: mongoTeam.clan_abbr }, { $set: listingSet });
    }),
  );

  await interaction.followUp({
    content: `:white_check_mark: _Updated season score_`,
  });

  return;
}

async function changeChannelName(interaction) {
  const iChName = await interaction.options.getString("new_channel_name");

  await interaction.guild.channels.edit(interaction.channelId, {
    name: iChName,
  });
  interaction.followUp(`*done*`);

  return;
}

async function changeChannelName(interaction) {
  const iChName = await interaction.options.getString("new_channel_name");

  await interaction.guild.channels.edit(interaction.channelId, {
    name: iChName,
  });
  interaction.followUp(`*done*`);

  return;
}

async function deleteNegoChs(interaction) {
  let iWeek = await interaction.options.getInteger("week");
  if (iWeek == null || iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  }

  let description = "";
  let parentIdNego = "";

  if (interaction.guild.id == config.guildId.jwcReps) {
    parentIdNego = schedule.parentIdNego[`w${iWeek}`];
  } else if (interaction.guild.id == config.guildId.jwc5v) {
    parentIdNego = schedule.parentIdNego5v[`w${iWeek}`];
  }

  interaction.guild.channels.cache.forEach((channel) => {
    if (channel.parentId == parentIdNego) {
      channel.delete().catch(console.error);
      description += channel.name + "\n";
    }
  });

  interaction.followUp(
    `✅ *successfully deleted channels: week ${iWeek}*\n${description}`,
  );

  return;
}

async function warSummary(interaction, client) {
  const iLeague = await interaction.options.getString("league");
  let iWeek = await interaction.options.getInteger("week");
  if (iWeek == null || iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  }

  const description = await functions.getDescriptionWarInfo(
    client.clientMongo,
    iLeague,
    iWeek,
  );
  const footerText = `${config.footer} ${config.league[iLeague]} S${config.season[iLeague]}`;

  const embed = new EmbedBuilder()
    .setTitle(`**WEEK ${iWeek}**`)
    .setDescription(description)
    .setColor(config.color[iLeague])
    .setFooter({ text: footerText, iconURL: config.urlImage.jwc })
    .setTimestamp();

  let msgId = "";
  await interaction.followUp({ embeds: [embed] }).then((message) => {
    msgId = message.id;
  });

  let newListing = {};
  newListing.name = `info-${functions.seasonToString(config.season[iLeague])}-${iLeague}-w${iWeek}`;
  newListing.message_id = msgId;
  newListing.season = config.season[iLeague];
  newListing.league = iLeague;
  newListing.week = Number(iWeek);
  await client.clientMongo
    .db("jwc")
    .collection("war_info")
    .insertOne(newListing);

  return;
}

async function rankingSummary(interaction, client) {
  const iLeague = await interaction.options.getString("league");
  const iLvTH = await interaction.options.getInteger("th_level");

  let lvTH = iLvTH;
  if (!iLvTH) {
    lvTH = config.lvTH;
  }

  const keyAttacks = "attacks";
  const iAttackType = "total";
  const query = {
    townHallLevel: lvTH,
    [`league.${config.leagueM[iLeague]}`]: iLeague,
    [`stats.${iLeague}.${keyAttacks}.${iAttackType}.nAttacks`]: { $gt: 0 },
    [`stats.${iLeague}.season`]: config.season[iLeague],
  };
  const sort = {
    [`stats.${iLeague}.${keyAttacks}.${iAttackType}.nTriples`]: -1,
    [`stats.${iLeague}.${keyAttacks}.${iAttackType}.nAttacks`]: 1,
    [`stats.${iLeague}.${keyAttacks}.${iAttackType}.avrgDestruction`]: -1,
    [`stats.${iLeague}.${keyAttacks}.${iAttackType}.avrgLeft`]: -1,
  };

  let nDisplay = 10;
  if (iLeague == "mix") {
    nDisplay = 5;
  }

  const description = await fRanking.getDescriptionRankingJwcAttack(
    client.clientMongo,
    iLeague,
    query,
    sort,
    (teamAbbr = "entire"),
    lvTH,
    nDisplay,
    (flagSummary = true),
    (flagRegularSeason = "false"),
    iAttackType,
  );
  const footerText = `${config.footer} ${config.league[iLeague]} S${config.season[iLeague]}`;

  const embed = new EmbedBuilder();
  embed.setTitle(`${config.emote.sword} **TOP ATTACKERS**`);
  embed.setDescription(description[0]);
  embed.setColor(config.color[iLeague]);
  embed.setFooter({ text: footerText, iconURL: config.urlImage.jwc });
  embed.setTimestamp();

  let msgId = "";
  await interaction.followUp({ embeds: [embed] }).then((message) => {
    msgId = message.id;
  });

  const mongoRankingSummary = await client.clientMongo
    .db("jwc")
    .collection("ranking")
    .findOne({ name: "summary" });

  let listingUpdate = {};
  listingUpdate.channelId = mongoRankingSummary.channelId;
  if (iLeague == "mix") {
    listingUpdate.channelId[iLeague][`th${lvTH}`] = msgId;
  } else {
    listingUpdate.channelId[iLeague] = msgId;
  }
  await client.clientMongo
    .db("jwc")
    .collection("ranking")
    .updateOne({ name: "summary" }, { $set: listingUpdate });

  return;
}

async function sendEndMessage(interaction, client) {
  const iCh = await interaction.options.getChannel("channel");

  let mongoWar = await client.clientMongo
    .db("jwc")
    .collection("wars")
    .findOne({ nego_channel: iCh.id });
  fGetWars.sendEnd(client, mongoWar);

  interaction.followUp(`*done*`, { ephemeral: true });

  return;
}

async function scanClan(interaction, client) {
  const iLeague = await interaction.options.getString("league");
  const iTeam = await interaction.options.getString("team");

  let title = "";
  let description = "";
  let description2 = "";

  if (iTeam != null) {
    title = "**SCANED**";

    const query = { clan_abbr: iTeam };
    const mongoClan = await client.clientMongo
      .db("jwc")
      .collection("clans")
      .findOne(query);

    let clanTag = mongoClan.clan_tag;
    let clanLink =
      "https://link.clashofclans.com/?action=OpenClanProfile&tag=" +
      clanTag.replace("#", "");
    let clan = await client.clientCoc.getClan(clanTag);
    if (clan.location == null) {
      description = `${mongoClan.team_name}\n`;
    } else if (clan.location.name == "Japan") {
      description = `:flag_jp: ${mongoClan.team_name}\n`;
    } else {
      description = `[${clan.location.name}] ${mongoClan.team_name}\n`;
    }
    description += `[__**${clanTag}**__](${clanLink}) ${clan.name}`;
    if (clan.isWarLogPublic == true) {
      description += ` :ballot_box_with_check:\n`;
    } else {
      description += ` :x: War Log is NOT Public\n`;
    }
    description += `\n`;
  } else {
    title = `CLANS | ${config.league[iLeague]}`;

    const query = { league: iLeague };
    const cursor = client.clientMongo.db("jwc").collection("clans").find(query);
    let mongoClans = await cursor.toArray();
    await cursor.close();

    let arrDescription = [];
    await Promise.all(
      mongoClans.map(async (mongoClan, index) => {
        let clanTag = mongoClan.clan_tag;
        let clanLink =
          "https://link.clashofclans.com/?action=OpenClanProfile&tag=" +
          clanTag.replace("#", "");
        let clan = await client.clientCoc.getClan(clanTag);
        if (clan.location == null) {
          arrDescription[index] = `${mongoClan.team_name}\n`;
        } else if (clan.location.name == "Japan") {
          arrDescription[index] = `:flag_jp: ${mongoClan.team_name}\n`;
        } else {
          arrDescription[index] =
            `[${clan.location.name}] ${mongoClan.team_name}\n`;
        }
        arrDescription[index] +=
          `[__**${clanTag}**__](${clanLink}) ${clan.name}`;
        if (clan.isWarLogPublic == true) {
          arrDescription[index] += ` :ballot_box_with_check:\n`;
        } else {
          arrDescription[index] += ` :x: War Log is NOT Public\n`;
        }
        arrDescription[index] += `\n`;
      }),
    );

    arrDescription.forEach(function (value, index) {
      if (index <= 12) {
        description += value;
      } else {
        description2 += value;
      }
    });
  }

  if (description != "") {
    await interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(config.color[iLeague])
          .setFooter({ text: config.footer, iconURL: config.urlImage.jwc })
          .setTimestamp(),
      ],
    });
  }

  if (description2 != "") {
    await interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description2)
          .setColor(config.color[iLeague])
          .setFooter({ text: config.footer, iconURL: config.urlImage.jwc })
          .setTimestamp(),
      ],
    });
  }

  return;
}

async function mentionReps(interaction, client) {
  const iLeague = await interaction.options.getString("league");
  const iMatch = await interaction.options.getInteger("match");
  const iMessage = await interaction.options.getString("message");

  let iWeek = await interaction.options.getInteger("week");
  if (iWeek == null || iWeek == 99) {
    iWeek = await functions.getWeekNow(iLeague);
  }

  const mongoWar = await client.clientMongo
    .db("jwc")
    .collection("wars")
    .findOne({
      season: config.season[iLeague],
      league: iLeague,
      week: iWeek,
      match: iMatch,
    });

  const mongoClan = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: mongoWar.clan_abbr });
  const rep1stId1 = mongoClan.rep_1st.id;
  const rep2ndId1 = mongoClan.rep_2nd.id;
  let rep3rdId1 = 0;
  if (mongoClan.rep_3rd != null && mongoClan.rep_3rd != "non-registered") {
    rep3rdId1 = await mongoClan.rep_3rd.id;
  }

  const mongoClanOpp = await client.clientMongo
    .db("jwc")
    .collection("clans")
    .findOne({ clan_abbr: mongoWar.opponent_abbr });
  const rep1stId2 = mongoClanOpp.rep_1st.id;
  const rep2ndId2 = mongoClanOpp.rep_2nd.id;
  let rep3rdId2 = 0;
  if (
    mongoClanOpp.rep_3rd != null &&
    mongoClanOpp.rep_3rd != "non-registered"
  ) {
    rep3rdId2 = await mongoClanOpp.rep_3rd.id;
  }

  let myContent = "";
  myContent += `<@!${rep1stId1}> <@!${rep2ndId1}>`;
  if (mongoClan.rep_3rd != null && mongoClan.rep_3rd != "non-registered") {
    myContent += ` <@!${rep3rdId1}>`;
  }
  myContent += `\n`;
  myContent += `<@!${rep1stId2}> <@!${rep2ndId2}>`;
  if (
    mongoClanOpp.rep_3rd != null &&
    mongoClanOpp.rep_3rd != "non-registered"
  ) {
    myContent += ` <@!${rep3rdId2}>`;
  }
  myContent += `\n`;
  myContent += iMessage;

  client.channels.cache.get(mongoWar.nego_channel).send({ content: myContent });

  interaction.followUp("*done*");
}
