const { Collection } = require("discord.js");
const fs = require("fs");

class CommandLoader {
  constructor(client) {
    this.client = client;
  }

  // コマンドの読み込み
  async loadCommands() {
    try {
      this.client.commands = new Collection();
      const commandFolders = fs.readdirSync("./commands");
      
      for (const folder of commandFolders) {
        const commandFiles = fs
          .readdirSync(`./commands/${folder}`)
          .filter((file) => file.endsWith(".js"));
        
        for (const file of commandFiles) {
          const command = require(`../commands/${folder}/${file}`);
          try {
            this.client.commands.set(command.data.name, command);
            console.log(`loaded command: ${command.data.name}`);
          } catch (error) {
            console.error(`Error loading command ${file}:`, error);
          }
        }
      }
      
      console.log(`Successfully loaded ${this.client.commands.size} commands`);
    } catch (error) {
      console.error("Error loading commands:", error);
      throw error;
    }
  }

  // イベントの読み込み
  async loadEvents() {
    try {
      const eventFiles = fs
        .readdirSync("./events")
        .filter((file) => file.endsWith(".js"));
      
      for (const file of eventFiles) {
        const event = require(`../events/${file}`);
        try {
          if (event.once) {
            this.client.once(event.name, (...args) => event.execute(...args, this.client));
            console.log(`loaded event: ${event.name}`);
          } else {
            this.client.on(event.name, (...args) => event.execute(...args, this.client));
            console.log(`loaded event: ${event.name}`);
          }
        } catch (error) {
          console.error(`Error loading event ${file}:`, error);
        }
      }
      
      console.log(`Successfully loaded ${eventFiles.length} events`);
    } catch (error) {
      console.error("Error loading events:", error);
      throw error;
    }
  }

  // すべての読み込み処理
  async loadAll() {
    await this.loadCommands();
    await this.loadEvents();
  }
}

module.exports = CommandLoader;
