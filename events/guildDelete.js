import { Events, EmbedBuilder } from "discord.js";
import config from "../config/config.js";

export default {
  name: Events.GuildDelete,
  async execute(guild, client) {
    const delEmbed = new EmbedBuilder()
      .setTitle("サーバー退出")
      .setDescription(`${guild.name}(${guild.id})からBotが退出しました。`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setColor(config.color.main)
      .setTimestamp();
    const ch = client.channels.cache.get(config.logch.guildDelete);
    if (ch) ch.send({ embeds: [delEmbed] });
  },
};


