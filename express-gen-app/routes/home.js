let express = require("express");
let router = express.Router();

const fs = require("fs");
const path = require("path");

const config = require("../../config.js");

const { MongoClient, ServerApiVersion } = require("mongodb");
const clientMongo = new MongoClient(process.env.mongoURI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const resolveJsonPath = (filename) =>
  path.resolve(__dirname, `../public/json/${filename}`);

const readJsonFile = (filename, fallbackObject) => {
  try {
    const jsonString = fs.readFileSync(resolveJsonPath(filename), "utf8");
    if (!jsonString || jsonString.trim() === "") {
      return fallbackObject;
    }
    return JSON.parse(jsonString);
  } catch (error) {
    console.error(`[home] failed to read ${filename}:`, error.message);
    return fallbackObject;
  }
};

const normalizeWeekNow = (source) => {
  const leagues = ["j1", "j2", "swiss", "mix"];
  const fallback = config.weekNow || { j1: 1, j2: 1, swiss: 1, mix: 1 };
  const normalized = {};

  leagues.forEach((league) => {
    const value = source?.[league] ?? fallback[league] ?? 1;
    normalized[league] = typeof value === "string" ? value : `w${value}`;
  });

  return normalized;
};

const sendHealthFallback = (res) => {
  if (!res.headersSent) {
    res.status(200).send("JWC Bot server is running");
  }
};

router.get("/", async function (req, res) {
  try {
    const dataWarStatsCurrent = {
      j1: readJsonFile("dataWarStatsCurrent_j1.json", {}),
      j2: readJsonFile("dataWarStatsCurrent_j2.json", {}),
      swiss: readJsonFile("dataWarStatsCurrent_swiss.json", {}),
      mix: readJsonFile("dataWarStatsCurrent_mix.json", {}),
    };

    const chartDataWarProgress = readJsonFile("chartDataWarProgress.json", {
      j1: {},
      j2: {},
      swiss: {},
      mix: {},
    });
    const chartOptionsWarProgress = readJsonFile("chartOptionsWarProgress.json", {
      j1: {},
      j2: {},
      swiss: {},
      mix: {},
    });

    let weekNow = normalizeWeekNow(config.weekNow);
    try {
      const mongoWeekNow = await clientMongo
        .db("jwc")
        .collection("config")
        .findOne({ name: "weekNow" });
      if (mongoWeekNow) {
        weekNow = normalizeWeekNow(mongoWeekNow);
      }
    } catch (error) {
      console.error("[home] failed to read weekNow from MongoDB:", error.message);
    }

    res.render(
      "home",
      {
        config: config,
        dataWarStatsCurrent: JSON.stringify(dataWarStatsCurrent),
        chartDataWarProgress: JSON.stringify(chartDataWarProgress),
        chartOptionsWarProgress: JSON.stringify(chartOptionsWarProgress),
        weekNow: JSON.stringify(weekNow),
      },
      (renderError, html) => {
        if (renderError) {
          console.error("[home] template render error:", renderError);
          sendHealthFallback(res);
          return;
        }
        res.send(html);
      }
    );
  } catch (error) {
    console.error("[home] unexpected render error:", error);
    sendHealthFallback(res);
  }
});

module.exports = router;
