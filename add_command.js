const { REST, Routes } = require('discord.js');
const config = require('./config.js');
const fs = require('node:fs');

const commands = [];
const adminCommands = [];
const commandFiles = fs.readdirSync('./commands/general').filter(file => file.endsWith('.js'));
const adminCommandFiles = fs.readdirSync("./commands/admin").filter(file => file.endsWith(".js"));

//JSON化
for (const file of commandFiles) {
  const command = require(`./commands/general/${file}`);
  commands.push(command.data.toJSON());
}

for (const file of adminCommandFiles) {
  const command = require(`./commands/admin/${file}`);
  adminCommands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    //console.log(`${adminCommands.length}個のコマンドを読み込み中`);
    const adminData1 = await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId.yama),
      { body: adminCommands },
    );
    console.log(`[GuildCommand] ${adminData1.length} 個のコマンドを読み込み完了`);

    //console.log(`${adminCommands.length}個のコマンドを読み込み中`);
    const adminData2 = await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId.jwcMain),
      { body: adminCommands },
    );
    console.log(`[GuildCommand] ${adminData2.length} 個のコマンドを読み込み完了`);

    //console.log(`${adminCommands.length}個のコマンドを読み込み中`);
    const adminData3 = await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId.jwcReps),
      { body: adminCommands },
    );
    console.log(`[GuildCommand] ${adminData3.length} 個のコマンドを読み込み完了`);

    //console.log(`${adminCommands.length}個のコマンドを読み込み中`);
    const adminData4 = await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId.jwcbot),
      { body: adminCommands },
    );
    console.log(`[GuildCommand] ${adminData4.length} 個のコマンドを読み込み完了`);

    //console.log(`${adminCommands.length}個のコマンドを読み込み中`);
    const adminData5 = await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId.jwc5v),
      { body: adminCommands },
    );
    console.log(`[GuildCommand] ${adminData5.length} 個のコマンドを読み込み完了`);

    //console.log(`${commands.length}個のコマンドを読み込み中`);
    const data = await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands },
    );
    console.log(`[GlobalCommand] ${data.length} 個のコマンドを読み込み完了`);
    data.forEach(command => {
      /*if (command.options != null) {
        command.options.forEach(option1 => {
          if (option1.type == 1) {
            console.log(command.name, option1.name);
          }
          else if (option1.type == 2) {
            option1.options.forEach(option2 => {
              console.log(command.name, option1.name, option2.name);
            });
          };
        });
      }
      else {
        console.log(command.name);
      };*/
      console.log(command.name);
    });
  }
  catch (error) {
    console.error(error);
  }
})();