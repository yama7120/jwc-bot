const express = require("express");
const path = require("path");
const createError = require("http-errors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

class WebServer {
  constructor(config) {
    this.config = config;
    this.app = express();
    this.listener = null;
  }

  // Expressアプリケーションの設定
  setupExpress() {
    // view engine setup
    this.app.set("views", path.join(__dirname, "../express-gen-app/views"));
    this.app.set("view engine", "ejs");

    // ミドルウェアの設定
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));
    this.app.use(cookieParser());
    this.app.use(morgan("combined"));
    this.app.use(express.static(path.join(__dirname, "../express-gen-app/public")));

    // ルートの設定
    const homeRouter = require("../express-gen-app/routes/home");
    const j1Router = require("../express-gen-app/routes/j1");
    const j2Router = require("../express-gen-app/routes/j2");
    const mixRouter = require("../express-gen-app/routes/mix");
    const swissRouter = require("../express-gen-app/routes/swiss");
    const testRouter = require("../express-gen-app/routes/test");

    this.app.use("/", homeRouter);
    this.app.use("/j1", j1Router);
    this.app.use("/j2", j2Router);
    this.app.use("/mix", mixRouter);
    this.app.use("/swiss", swissRouter);
    this.app.use("/test", testRouter);
  }

  // POSTエンドポイントの設定
  setupPostEndpoint(client, postHandler) {
    // GET /post など他メソッドは 405（POSTより前に定義）
    this.app.all("/post", (req, res, next) => {
      if (req.method !== 'POST') {
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

    // エラーハンドラー
    this.app.use((err, req, res, next) => {
      res.locals.message = err.message;
      res.locals.error = req.app.get("env") === "development" ? err : {};
      res.status(err.status || 500);
      res.render("error");
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
