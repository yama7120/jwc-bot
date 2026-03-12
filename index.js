const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Collection,
} = require("discord.js");

const options = {
  intents: [GatewayIntentBits.Guilds],
};

const client = new Client(options);

const config = require("./config/index.js");

// Explicitly require saslprep before MongoDB to avoid warnings
try {
  require("saslprep");
} catch (err) {
  // saslprep is optional, ignore if not available
}

const { MongoClient, ServerApiVersion } = require("mongodb");

const clientMongo = new MongoClient(config.mongo.uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

(async function () {
  try {
    const BotInitializer = require("./initializers/BotInitializer");
    const initializer = new BotInitializer(client, config, clientMongo);
    await initializer.initialize();

    // LOG-IN
    client.login(config.discord.token).catch(console.error);
  } catch (error) {
    console.error("Initialization error:", error);
    process.exit(1);
  }
})();