import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import config from "../../config/config.js";
import * as functions from "../../functions/functions.js";

const nameCommand = "link_account_to_discord";
let data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription("no description")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("new")
      .setDescription(config.command[nameCommand].subCommand["new"])
      .addStringOption((option) =>
        option
          .setName("account")
          .setDescription("プレイヤータグ")
          .setRequired(true),
      )
      .addUserOption((option) =>
        option
          .setName("pilot_dc")
          .setDescription("使用者の discord アカウント")
          .setRequired(true),
      ),
  );

export default {
  data: data,

  async autocomplete(interaction, client) {
    let focusedOption = interaction.options.getFocused(true);
    let focusedValue = interaction.options.getFocused();
    if (focusedOption.name === "account") {
      const query = {
        "pilotDC.id": interaction.user.id,
        status: { $ne: false },
      };
      const options = { projection: { stats: 0, attacks: 0, defenses: 0 } };
      const sort = { townHallLevel: -1 };
      const cursor = client.clientMongo
        .db("jwc")
        .collection("accounts")
        .find(query, options)
        .sort(sort);
      let accs = await cursor.toArray();
      await cursor.close();
      accs = accs.filter(function (acc) {
        return acc.name.includes(focusedValue);
      });
      if (accs.length > 25) {
        accs = accs.filter(function (acc, index) {
          return index < 25;
        });
      }
      if (accs.length > 0) {
        await interaction.respond(
          accs.map((acc) => ({
            name: `[TH${acc.townHallLevel}] ${acc.name}`,
            value: acc.tag,
          })),
        );
      }
    }
  },

  async execute(interaction, client) {
    let iPlayerTag = await interaction.options.getString("account");
    if (iPlayerTag.includes("#") == false) {
      iPlayerTag = "#" + iPlayerTag;
    }
    const iPilotDc = await interaction.options.getUser("pilot_dc");

    const iSenderId = interaction.user.id;

    let title = "";
    let description = "";
    let embed = new EmbedBuilder();
    embed.setColor(config.color.main);
    embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
    embed.setTimestamp();

    let mongoAcc = await client.clientMongo
      .db("jwc")
      .collection("accounts")
      .findOne({ tag: iPlayerTag });

    if (interaction.options.getSubcommand() == "new") {
      if (!mongoAcc) {
        let content = "* You can link the registered account only.\n";
        content += `* Please run </register_acc new:${config.command.register_acc.id}> to register your account.\n`;
        await interaction.followUp({ content: content, ephemeral: true });
        return;
      } else {
        let resultScan = await functions.scanAcc(client.clientCoc, iPlayerTag);

        title = await functions.getAccInfoTitle(resultScan.scPlayer, "long");
        embed.setTitle(title);

        description += await functions.getAccInfoDescriptionMain(resultScan.scPlayer, "long");

        let pilotDC = mongoAcc.pilotDC || iPilotDc;
        if (iPilotDc.id == config.clientId) {
          description += `\n`;
          description += `_You cannot register a bot as a pilot._`;
        } else {
          if (mongoAcc.pilotDC) {
            // 登録済み
            if (mongoAcc.pilotDC.id == iPilotDc.id) {
              // 自分
              description += `\n`;
              description += `_This account is already linked with you._`;
            } else {
              description += `\n`;
              description += `:exclamation: _This account is already linked with another user._`;
            }
          } else if (!mongoAcc.pilotDC) {
            // 新規登録
            pilotDC.avatarUrl = `https://cdn.discordapp.com/avatars/${pilotDC.id}/${pilotDC.avatar}.png`;
            await client.clientMongo
              .db("jwc")
              .collection("accounts")
              .updateOne({ tag: iPlayerTag }, { $set: { pilotDC: pilotDC } });
          }
        }

        embed.setDescription(description);

        let nameDiscord = pilotDC.globalName || pilotDC.username;
        embed.setAuthor({ name: nameDiscord, iconURL: pilotDC.avatarUrl });

        await interaction.followUp({ embeds: [embed] });
      }
    }
  },
};
