const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

const config = require('../../config.js');

const nameCommand = 'help';
let data = new SlashCommandBuilder()
  .setName(nameCommand)
  .setDescription('no description')
  .addSubcommand(subcommand =>
    subcommand
      .setName('commands')
      .setDescription(config.command[nameCommand].subCommand['commands'])
      .addStringOption(option =>
        option
          .setName('admin')
          .setDescription('運営用コマンド')
          .addChoices(
            { name: '表示', value: 'true' },
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('rule')
      .setDescription(config.command[nameCommand].subCommand['rule'])
  );

module.exports = {
  data: data,

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const iAdmin = await interaction.options.getString('admin');

    let title = '';
    let description = '';

    if (subcommand == 'commands') {
      if (iAdmin == 'true') {
        title = '**ADMIN COMMANDS**';
        description = await createDescription(config.adminCommand);
      }
      else {
        title = '**GENERAL COMMANDS**';
        description = await createDescription(config.command);
      };
    }
    else if (subcommand == 'rule') {
      title = '**RULEBOOK**';
      description += `* **J1 / J2** *SEASON ${config.link.rule.j.season}*\n`;
      description += `[__document__](${config.link.rule.j.url})\n`;
      description += `* **SWISS** *SEASON ${config.link.rule.swiss.season}*\n`;
      description += `[__document__](${config.link.rule.swiss.url})\n`;
      description += `* **MIX** *SEASON ${config.link.rule.mix.season} 10v*\n`;
      description += `[__document__](${config.link.rule.mix.url})\n`;
      description += `* **MIX** *SEASON ${config.link.rule.mix.season} 5v*\n`;
      description += `[__document__](${config.link.rule.mix5v.url})\n`;
      description += `* **5V** *SEASON ${config.link.rule.five.season}*\n`;
      description += `[__document__](${config.link.rule.five.url})\n`;
      //description += `\n`;
      //description += `* [__マッチングに関わるルールおよびペナルティ__](${client.config.link.rule.war})\n`;
      //description += `* [__ロスターに関わるルールおよびペナルティ__](${client.config.link.rule.roster})\n`;
    };

    let embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(config.color.main)
      .setFooter({ text: config.footer, iconURL: client.config.urlImage.jwc });

    await interaction.followUp({ embeds: [embed] });
  }
};

async function createDescription(objCommands) {
  let description = '';
  Object.keys(objCommands).forEach(function(nameCommand, index) {
    if (objCommands[nameCommand].subCommandGroup != null) {
      Object.keys(objCommands[nameCommand].subCommandGroup).forEach(function(nameSubCommandGroup, index) {
        description += `\n* **${nameCommand.toUpperCase()} ${nameSubCommandGroup.toUpperCase()}**\n`;
        Object.keys(objCommands[nameCommand].subCommandGroup[nameSubCommandGroup]).forEach(function(nameSubCommand, index) {
          description += `</${nameCommand} ${nameSubCommandGroup} ${nameSubCommand}:${objCommands[nameCommand].id}>\n`;
          description += `　${objCommands[nameCommand].subCommandGroup[nameSubCommandGroup][nameSubCommand]}\n`;
        });
      });
    };
    if (objCommands[nameCommand].subCommand != null) {
      description += `\n* **${nameCommand.toUpperCase()}**\n`;
      Object.keys(objCommands[nameCommand].subCommand).forEach(function(nameSubCommand, index) {
        description += `</${nameCommand} ${nameSubCommand}:${objCommands[nameCommand].id}>\n`;
        description += `　${objCommands[nameCommand].subCommand[nameSubCommand]}\n`;
      });
    };
    if (objCommands[nameCommand].subCommand == null && objCommands[nameCommand].subCommandGroup == null) {
      description += `\n* **${nameCommand.toUpperCase()}**\n`;
      if (objCommands[nameCommand][0] != '') {
        description += `</${nameCommand}:${objCommands[nameCommand][0]}>\n`;
        description += `　${objCommands[nameCommand][1]}\n`;
      }
      else {
        description += `/${nameCommand}\n`;
        description += `　${objCommands[nameCommand][1]}\n`;
      };
    };
  });
  return description;
};