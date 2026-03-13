// 'node test.js' to run in Shell

import * as functions from "./functions/functions.js";
import * as fRanking from "./functions/fRanking.js";
import * as fCanvas from "./functions/fCanvas.js";
import config from "./config/config.js";
import config_coc from "./config/config_coc.js";

import { MongoClient, ServerApiVersion } from "mongodb";
import { EmbedBuilder } from "discord.js";
const clientMongo = new MongoClient(process.env.mongoURI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

(async () => {
  console.log(functions.plusTime("start"));

  await removeDuplicateEvents(clientMongo);

  console.log(functions.plusTime("end"));
  process.exit();
})();

// legend.events配列からunixTimeが重複しているオブジェクトを削除
async function removeDuplicateEvents(clientMongo) {
  try {
    console.log(functions.plusTime("start: removeDuplicateEvents"));
    
    // legend.events配列が存在する全アカウントを検索
    const query = {
      status: true,
      "legend.events": { $exists: true, $type: "array" }
    };

    const accounts = await clientMongo
      .db("jwc")
      .collection("accounts")
      .find(query, { projection: { _id: 0, tag: 1, "legend.events": 1 } })
      .toArray();

    console.log(`Found ${accounts.length} accounts with legend.events array`);

    let totalRemoved = 0;
    let accountsUpdated = 0;

    // 各アカウントに対して処理を実行
    for (const account of accounts) {
      try {
        // 現在のlegend.events配列を取得
        const currentEvents = account.legend.events || [];
        
        // unixTimeをキーとして重複を検出し、最初に見つかったもののみを保持
        const seenUnixTimes = new Set();
        const uniqueEvents = [];
        
        for (const eventObj of currentEvents) {
          if (eventObj && eventObj.unixTime !== undefined) {
            const unixTime = eventObj.unixTime;
            if (!seenUnixTimes.has(unixTime)) {
              seenUnixTimes.add(unixTime);
              uniqueEvents.push(eventObj);
            }
          } else {
            // unixTimeが存在しないオブジェクトはそのまま保持
            uniqueEvents.push(eventObj);
          }
        }
        
        // 削除されるオブジェクトの数を計算
        const removedCount = currentEvents.length - uniqueEvents.length;
        
        if (removedCount > 0) {
          // データベースを更新
          await clientMongo
            .db("jwc")
            .collection("accounts")
            .updateOne(
              { tag: account.tag },
              {
                $set: {
                  "legend.events": uniqueEvents
                }
              }
            );
          
          totalRemoved += removedCount;
          accountsUpdated++;
          console.log(`Account ${account.tag}: removed ${removedCount} duplicate events`);
        }
      } catch (error) {
        console.error(`Error updating account ${account.tag}:`, error);
      }
    }

    console.log(`Successfully updated ${accountsUpdated} accounts`);
    console.log(`Total removed ${totalRemoved} duplicate event objects`);
    console.log(functions.plusTime("end: removeDuplicateEvents"));
    
  } catch (error) {
    console.error("Error in removeDuplicateEvents:", error);
  }
}
