import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import config from '../../config/config.js';

const nameCommand = 'ping';
const data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription(config.command[nameCommand][1]);

export default {
  data: data,

  async execute(interaction, client) {
    try {
      const apiPing = Date.now() - interaction.createdTimestamp;
      
      const embed = new EmbedBuilder()
        .setTitle(':ping_pong: Pong!')
        .setColor(config.color.main)
        .setFooter({ text: config.footer, iconURL: config.urlImage.jwc })
        .setTimestamp()
        .addFields(
          {
            name: ':electric_plug: WebSocket Ping',
            value: `\`${client.ws.ping}ms\``
          },
          {
            name: ':yarn: API Endpoint Ping',
            value: `\`${apiPing}ms\``
          }
        );
      
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error('Ping command error:', error);
      // エラーが発生した場合は何もしない（既にdeferReplyされているため）
    }
  }
}