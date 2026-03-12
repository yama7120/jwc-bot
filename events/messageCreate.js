const { Events, EmbedBuilder } = require('discord.js');
const config = require("../config.js");

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    const guildCount = client.guilds.cache.size;
    if (message.author.bot || message.mentions.everyone) {
      return;
    };
    if (message.mentions.has(client.user)) {
      message.react('<:atama:906158271432372295>');
      //const args = message.content.trim().split(/ +/g);

      console.log(message.content + " | " + message.channel.name + "  ...  " + message.author.username);

      if (message.content.indexOf("test") > 0) {
        message.channel.send({
          reply: { messageReference: message.id },
          content: message.content,
        });
        return;
      }
      else if (message.content.indexOf("guild") > 0) {
        const Guilds = client.guilds.cache.map(guild => guild.id);
        let myTitle = `GUILDS`;
        let myDescription = ``;
        for (let i in Guilds) {
          myDescription += `${client.guilds.cache.get(Guilds[i]).name}\n`;
        }
        const myEmbed = new EmbedBuilder()
          .setTitle(myTitle)
          .setDescription(myDescription)
          .setColor(config.color.main)
          .setFooter({ text: config.jwc.footer, iconURL: config.urlImage.jwc })
        message.channel.send({
          reply: { messageReference: message.id },
          embeds: [myEmbed],
        });
        return;
      }
      else {
        /*
        message.channel.send({
          reply: { messageReference: message.id },
          content: "*try slash commands*",
        });
        */
        Object.keys(config.command).forEach(function(nameCommand) {
          console.log(nameCommand);
          if (message.content.indexOf(nameCommand) != -1) {
            message.channel.send({
              reply: { messageReference: message.id },
              content: `you can use </${nameCommand}:${config.command[nameCommand][0]}>`,
            });
          };
        });
        const embed = new EmbedBuilder()
          .setTitle("ERROR - botTaged")
          .setDescription(message.content)
          .setColor("#ff0000")
          .setTimestamp();
        client.channels.cache.get(config.logch.error).send({ embeds: [embed] });
        console.dir("bot was taged");
        return;
      }
    }
  }
}