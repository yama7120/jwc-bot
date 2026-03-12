const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

const config = require('../../config.js');
const functions = require('../../functions/functions.js');

const nameCommand = 'ping';
const data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription(config.command[nameCommand][1]);

module.exports = {
  data: data,

  async execute(interaction, client) {
    const apiPing = Date.now() - interaction.createdTimestamp;
    
    let embed = new EmbedBuilder();
    embed.setTitle(':ping_pong: Pong!');
    embed.setColor(config.color.main);
    embed.setFooter({ text: config.footer, iconURL: config.urlImage.jwc });
    embed.setTimestamp();
    embed.addFields(
      {
        name: ':electric_plug: WebSocket Ping',
        value: '`' + client.ws.ping + 'ms`'
      },
      {
        name: ':yarn: API Endpoint Ping',
        value: '`' + apiPing + 'ms`'
      }
    );
    
    interaction.followUp({ embeds: [embed], ephemeral: true });
  }
}