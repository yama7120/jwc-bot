import { Events, EmbedBuilder } from "discord.js";
import config from "../config/config.js";

export default {
  name: Events.GuildCreate,
  async execute(guild, client) {
    const addEmbed = new EmbedBuilder()
      .setTitle("サーバー追加")
      .setDescription(`${guild.name}(${guild.id})にBotが追加されました。`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setColor(config.color.main)
      .setTimestamp();
    const ch = client.channels.cache.get(config.logch.guildCreate);
    if (ch) ch.send({ embeds: [addEmbed] });
  },
};


