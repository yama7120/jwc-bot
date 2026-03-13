import { REST, Routes } from "discord.js";
import config from './config/config.js';
import fs from 'node:fs';

const BOT_TOKEN = process.env.BOT_TOKEN?.trim();
const CLIENT_ID = process.env.CLIENT_ID?.trim();

function assertEnv(name, val) {
  if (!val) {
    console.error(
      `❌ Missing env: ${name}. Replit Secrets で ${name} を設定してください。`,
    );
    process.exit(1);
  }
}
assertEnv("BOT_TOKEN", BOT_TOKEN);
assertEnv("CLIENT_ID", CLIENT_ID);

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    const commands = [];
    const adminCommands = [];
    const commandFiles = fs.readdirSync('./commands/general').filter(file => file.endsWith('.js'));
    const adminCommandFiles = fs.readdirSync("./commands/admin").filter(file => file.endsWith(".js"));

    //JSON化
    for (const file of commandFiles) {
      const command = await import(`./commands/general/${file}`);
      commands.push(command.default.data.toJSON());
    }

    for (const file of adminCommandFiles) {
      const command = await import(`./commands/admin/${file}`);
      adminCommands.push(command.default.data.toJSON());
    }
    
    const adminData1 = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, config.guildId.yama),
      { body: adminCommands },
    );
    console.log(`[adminCommands] ${adminData1.length} 個のコマンドを読み込み完了`);

    const adminData2 = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, config.guildId.jwcMain),
      { body: adminCommands },
    );
    console.log(`[adminCommands] ${adminData2.length} 個のコマンドを読み込み完了`);

    const adminData3 = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, config.guildId.jwcReps),
      { body: adminCommands },
    );
    console.log(`[adminCommands] ${adminData3.length} 個のコマンドを読み込み完了`);

    const adminData4 = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, config.guildId.jwcbot),
      { body: adminCommands },
    );
    console.log(`[adminCommands] ${adminData4.length} 個のコマンドを読み込み完了`);

    const adminData5 = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, config.guildId.jwc5v),
      { body: adminCommands },
    );
    console.log(`[adminCommands] ${adminData5.length} 個のコマンドを読み込み完了`);

    const data = await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands },
    );
    console.log(`[GlobalCommands] ${data.length} 個のコマンドを読み込み完了`);
    data.forEach(command => {
      console.log(command.name);
    });
  }
  catch (error) {
    console.error(error);
  }
})();