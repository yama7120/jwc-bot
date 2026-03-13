import config from "../config/config.js";
import * as functions from "../functions/functions.js";
import { Events, EmbedBuilder, MessageFlags } from "discord.js";

export default {
  name: Events.InteractionCreate,

  async execute(interaction, client) {
    if (config.isMaintenance) {
      if (interaction.isChatInputCommand()) {
        if (functions.maintenance(interaction)) return;
      } else {
        // 非チャットコマンド（autocomplete等）は応答せず遮断
        return;
      }
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    if (interaction.isAutocomplete()) {
      try {
        await command.autocomplete(interaction, client);
      } catch (error) {
        console.error(error);
      }
    } else if (interaction.isChatInputCommand()) {
      try {
        if (!interaction.deferred && !interaction.replied) {
          try {
            await interaction.deferReply();
          } catch (e) {
            if (e?.code === 10062) return; // Unknown interaction → 中断
            throw e;
          }
        }
        await command.execute(interaction, client);
        functions.logInteraction(interaction, client);
      } catch (error) {
        console.error(error);
        console.error(`${interaction.user.tag} - ${interaction.commandName}: ${interaction.toString()}`);
        let description = `*Please report to <@!${config.yamaId}>.*`;
        const embed = createEmbed("ERROR", description);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [embed] });
        } else {
          await interaction.reply({ embeds: [embed] });
        }
      }
    } else {
      console.error(interaction);
      return;
    }
  },
};

function createEmbed(title, description) {
  const embed = new EmbedBuilder();
  embed.setTitle(`**${title}**`);
  embed.setDescription(description);
  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  return embed;
}