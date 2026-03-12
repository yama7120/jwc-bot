const config = require("../config.js");
const functions = require("../functions/functions.js");
const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction, client) {
    if (config.isMaintenance) {
      if (maintenance(interaction)) {
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
        if (error.code === 10062 || error.code === 40060) return;
        console.error(error);
      }
    }
    else if (interaction.isChatInputCommand()) {
      try {
        await interaction.deferReply();
        await command.execute(interaction, client);
        functions.logInteraction(interaction, client);
      }
      catch (error) {
        console.error(error);
        console.error(`${interaction.user.tag} - ${interaction.commandName}: ${interaction.toString()}`);
        let description = `*Please report to <@!${config.yamaId}>.*`;
        const embed = createEmbed('ERROR', description);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [ embed ] });
        }
        else {
          await interaction.reply({ embeds: [ embed ] });
        }
      }
    }
    else {
      console.error(interaction);
      return;
    }
  }
};

function createEmbed(title, description) {
  const embed = new EmbedBuilder();
  embed.setTitle(`**${title}**`);
  embed.setDescription(description);
  embed.setColor(config.color.main);
  embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
  return embed;
}