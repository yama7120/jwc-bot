const express = require("express");

class WebServer {
  constructor(config) {
    this.config = config;
    this.app = express();
    this.listener = null;
  }

  // Bot運用に必要な最小エンドポイントのみ設定
  setupCoreRoutes(client, postHandler) {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));

    // Replitのヘルスチェック用
    this.app.get("/", (req, res) => {
      res.status(200).send("ok");
    });
    this.app.get("/health", (req, res) => {
      res.status(200).json({ status: "ok" });
    });

    // GET /post など他メソッドは 405（POSTより前に定義）
    this.app.all("/post", (req, res, next) => {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed: use POST");
      }
      next();
    });

    // POST /post だけ受け付ける
    this.app.post("/post", async (req, res) => {
      if (client == null) {
        return res.status(500).json({ error: "Client not available" });
      }

      try {
        await postHandler.post(req, res, client, req.body);
      } catch (error) {
        console.error("Error in POST endpoint:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // 存在しないルートは 404
    this.app.use((req, res) => {
      res.status(404).send("Not Found");
    });
  }

  // サーバーの起動
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.listener = this.app.listen(
          this.config.server.port,
          this.config.server.host,
          () => {
            console.log(`Opened API Server: ${this.listener.address().port}`);
            console.dir(this.listener.address());
            resolve(this.listener);
          }
        );

        this.listener.on("error", (error) => {
          console.error("Server error:", error);
          reject(error);
        });
      } catch (error) {
        console.error("Failed to start server:", error);
        reject(error);
      }
    });
  }

  // アプリケーションの取得
  getApp() {
    return this.app;
  }

  // リスナーの取得
  getListener() {
    return this.listener;
  }
}

module.exports = WebServer;
