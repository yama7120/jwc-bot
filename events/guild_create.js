const { Events, EmbedBuilder } = require('discord.js');
const config = require("../config.js");

module.exports = {
  name: Events.GuildCreate,
  async execute(guild, client) {
    const addEmbed = new EmbedBuilder()
      .setTitle("サーバー追加")
      .setDescription(`${guild.name}(${guild.id})にBotが追加されました。`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setColor(config.color.main)
      .setTimestamp();
    client.channels.cache.get(config.logch.guildCreate).send({embeds: [addEmbed]});
  }
}