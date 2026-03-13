import { AttachmentBuilder } from "discord.js";
import config from "../config/config.js";
import config_coc from "../config/config_coc.js";
import * as functions from "./functions.js";
import Canvas from "@napi-rs/canvas";
import path from "node:path";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";

// ***** 共通フォント定義 ***** //
// フォントを一度だけ登録（GlobalFontsは一度登録すれば全体で利用可能）
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  try {
    Canvas.GlobalFonts.registerFromPath("./fonts/OPTIMA_B.TTF", "Optima");
    Canvas.GlobalFonts.registerFromPath(
      "./fonts/Noto_Serif_JP/NotoSerifJP-Black.otf",
      "NotoSerifJP",
    );
    Canvas.GlobalFonts.registerFromPath(
      "./fonts/SourceHanSans-VF.ttf",
      "HanSans",
    );
    Canvas.GlobalFonts.registerFromPath(
      "./fonts/Supercell-magic.ttf",
      "Supercell",
    );
    Canvas.GlobalFonts.registerFromPath(
      "./fonts/Graduate-Regular.ttf",
      "Graduate",
    );
    Canvas.GlobalFonts.registerFromPath(
      "./fonts/Kameron-VariableFont_wght.ttf",
      "Kameron",
    );
    fontsRegistered = true;
  } catch (error) {
    // 既に登録されている場合はエラーを無視
    console.warn("Font registration warning:", error.message);
  }
}

// フォント名定数
const FONTS = {
  MAIN: "Optima",
  JP: "NotoSerifJP",
  SC: "Supercell",
  NUMBER: "Kameron",
};

// フォントサイズ定数（config.canvasFontSizeへのエイリアス）
const fontSize = config.canvasFontSize;

// フォント設定ヘルパー関数
function setFont(ctx, fontSize, fontName = FONTS.MAIN, style = "") {
  const stylePrefix = style ? `${style} ` : "";
  ctx.font = `${stylePrefix}${fontSize}px ${fontName}`;
}

// 日本語フォントを使用する場合のヘルパー
function setFontJP(ctx, fontSize, fontName = FONTS.MAIN, style = "") {
  const fontFamily = `${fontName}, ${FONTS.JP}, sans-serif`;
  const stylePrefix = style ? `${style} ` : "";
  ctx.font = `${stylePrefix}${fontSize}px ${fontFamily}`;
}

// 絵文字・特殊文字対応フォントを使用する場合のヘルパー
function setFontName(ctx, fontSize, fontName = FONTS.MAIN, style = "") {
  const fontFamily = `${fontName}, ${FONTS.JP}, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "EmojiOne Color", "Twemoji Mozilla", "Apple Symbols", "Segoe UI Symbol", sans-serif`;
  const stylePrefix = style ? `${style} ` : "";
  ctx.font = `${stylePrefix}${fontSize}px ${fontFamily}`;
}

// 初回実行時にフォントを登録
registerFonts();

function reflectImage2Canvas(
  ctx,
  imageDom,
  previewAreaDomWidth,
  previewAreaDomHeight,
  dx,
  dy,
) {
  const ratio =
    getOrientation(imageDom.naturalWidth, imageDom.naturalHeight) ===
    `landscape`
      ? previewAreaDomWidth / imageDom.naturalWidth
      : previewAreaDomHeight / imageDom.naturalHeight;

  const resizedImageDomWidth = imageDom.naturalWidth * ratio;
  const resizedImageDomHeight = imageDom.naturalHeight * ratio;

  const resizedImageDomCenterX = resizedImageDomWidth / 2;
  const resizedImageDomCenterY = resizedImageDomHeight / 2;
  const previewAreaDomCenterX = previewAreaDomWidth / 2;
  const previewAreaDomCenterY = previewAreaDomHeight / 2;

  const deltaParallelMoveX = previewAreaDomCenterX - resizedImageDomCenterX;
  const deltaParallelMoveY = previewAreaDomCenterY - resizedImageDomCenterY;

  ctx.drawImage(
    imageDom,
    dx + deltaParallelMoveX,
    dy + deltaParallelMoveY,
    imageDom.naturalWidth * ratio,
    imageDom.naturalHeight * ratio,
  );

  return ctx;
}
export { reflectImage2Canvas };

function getOrientation(imageDomWidth, imageDomHeight) {
  if (imageDomWidth > imageDomHeight) {
    return `landscape`;
  }
  return `portrait`;
}

async function teamStats(clientMongo, league, mongoTeam, mongoRanking) {
  const widthCanvas = config.canvasSize.width;
  const heightCanvas = config.canvasSize.height;
  let myCanvas = Canvas.createCanvas(
    config.canvasSize.width,
    config.canvasSize.height,
  );
  let ctx = myCanvas.getContext("2d");

  const widthCenter = widthCanvas / 2;
  const heightCenter = heightCanvas / 2;

  // ***** background image ***** //
  const bgUrl = `./image/bg/war_${league}.png`;
  const bgImage = await Canvas.loadImage(bgUrl);
  ctx.drawImage(bgImage, 0, 0, widthCanvas, heightCanvas);

  // ***** text & line color ***** //
  ctx.fillStyle = config.rgb.snowWhite;
  ctx.strokeStyle = config.rgb.snowWhite;

  // ***** Font ***** //
  const myFont = FONTS.MAIN;
  const myFontJP = FONTS.JP;
  const myFontSC = FONTS.SC;
  const myFontNumber = FONTS.NUMBER;

  // ***** Horizontal Position ***** //
  let pos = {};
  for (let i = 0; i < 20; i++) {
    pos[`h${String(i)}1`] = widthCenter - (widthCanvas * i) / 40;
    pos[`h${String(i)}2`] = widthCenter + (widthCanvas * i) / 40;
    pos[`v${String(i)}1`] = heightCenter - (heightCanvas * i) / 40;
    pos[`v${String(i)}2`] = heightCenter + (heightCanvas * i) / 40;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = config.rgb.black;
  ctx.globalAlpha = 0.2;

  ctx.beginPath();
  ctx.moveTo(pos.h191, pos.v121 - 40);
  ctx.lineTo(widthCenter - 40, pos.v121 - 40);
  ctx.lineTo(widthCenter - 40, pos.v71 - 20);
  ctx.lineTo(pos.h191, pos.v71 - 20);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(pos.h191, pos.v51 - 20);
  ctx.lineTo(widthCenter - 40, pos.v51 - 20);
  ctx.lineTo(widthCenter - 40, pos.v162);
  ctx.lineTo(pos.h191, pos.v162);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(widthCenter + 40, pos.v51 - 20);
  ctx.lineTo(pos.h192, pos.v51 - 20);
  ctx.lineTo(pos.h192, pos.v162);
  ctx.lineTo(widthCenter + 40, pos.v162);
  ctx.fill();

  ctx.globalAlpha = 1.0;

  // ***** 中央上 ***** //
  ctx.fillStyle = config.rgb.snowWhite;
  let text = `Japan War Clans`;
  setFont(ctx, config.canvasFontSize.small);
  ctx.fillText(text, widthCenter, 200);

  // team logo
  const lengthLogo = 400;
  const posLogo = {
    x: widthCenter - lengthLogo / 2,
    y: pos.v151 - lengthLogo / 2,
  };
  //const lengthLogo2 = 3500;
  //const posLogo2 = { x: pos.h152 - lengthLogo2 / 2, y: pos.v162 - lengthLogo2 / 2 };
  try {
    const imgTeam = await Canvas.loadImage(
      `./image/teamLogo/${mongoTeam.clan_abbr}.png`,
    );
    //ctx.globalAlpha = 0.2;
    //ctx = reflectImage2Canvas(ctx, imgTeam, lengthLogo2, lengthLogo2, posLogo2.x, posLogo2.y);
    ctx.globalAlpha = 1.0;
    ctx = reflectImage2Canvas(
      ctx,
      imgTeam,
      lengthLogo,
      lengthLogo,
      posLogo.x,
      posLogo.y,
    );
  } catch (error) {
    const imgJwc = await Canvas.loadImage(`./image/JWC.png`);
    ctx = reflectImage2Canvas(
      ctx,
      imgJwc,
      lengthLogo,
      lengthLogo,
      posLogo.x,
      posLogo.y,
    );
  }

  // team name
  ctx.fillStyle = config.rgb.gray200;
  text = mongoTeam.clan_abbr.toUpperCase();
  setFont(ctx, config.canvasFontSize.small);
  ctx.fillText(text, pos.h111, pos.v161);

  ctx.fillStyle = config.rgb.snowWhite;
  text = mongoTeam.team_name.replace(/\\/g, "").replace(/‪⋆͛/g, "");
  let fontSize_teamName = config.canvasFontSize.large;
  //console.log(text.length);
  const ratz = /[a-z]/,
    rAtZ = /[A-Z]/,
    r0t9 = /[0-9]/;
  if (
    ratz.test(text.charAt(0)) ||
    rAtZ.test(text.charAt(0)) ||
    r0t9.test(text.charAt(0))
  ) {
  } else {
    if (text.length > 14) {
      fontSize_teamName = config.canvasFontSize.small;
    } else if (text.length > 10) {
      fontSize_teamName = config.canvasFontSize.medium;
    }
  }
  if (
    mongoTeam.clan_abbr.includes("omi") ||
    mongoTeam.clan_abbr.includes("lily")
  ) {
    setFont(ctx, fontSize_teamName, FONTS.JP);
  } else {
    setFontJP(ctx, fontSize_teamName);
  }
  ctx.fillText(text, pos.h111, pos.v151);

  // league
  text = config.league[league];
  setFont(ctx, config.canvasFontSize.large);
  ctx.fillText(text, pos.h102, pos.v151);

  // trophy
  if (mongoTeam.score.result == 1) {
    let imgTrophy = await Canvas.loadImage(`./image/jTrophy.png`);
    const lengthTrophy = 350;
    ctx.drawImage(
      imgTrophy,
      pos.h102 - lengthTrophy / 2,
      pos.v171 - lengthTrophy / 2,
      lengthTrophy,
      lengthTrophy,
    );
  }

  // subtitles
  ctx.textAlign = "center";
  setFont(ctx, config.canvasFontSize.medium);
  //text = 'STATS';
  //ctx.fillText(text, pos.h181, pos.v121);
  text = "WARS";
  ctx.fillText(text, pos.h101, pos.v61);
  text = "TOP PLAYERS";
  ctx.fillText(text, pos.h102, pos.v61);

  // STATS
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  setFont(ctx, config.canvasFontSize.medium);
  text = "W";
  ctx.fillText(text, pos.h161, pos.v111);
  setFont(ctx, config.canvasFontSize.small);
  text = "L";
  ctx.fillText(text, pos.h131 + 10, pos.v111);
  text = "T";
  ctx.fillText(text, pos.h101 + 10, pos.v111);
  setFont(ctx, config.canvasFontSize.xLarge);
  text = String(mongoTeam.score.sum.nWin);
  ctx.fillText(text, pos.h151 + 10, pos.v111);
  setFont(ctx, config.canvasFontSize.large);
  text = String(mongoTeam.score.sum.nLoss);
  ctx.fillText(text, pos.h121, pos.v111);
  text = String(mongoTeam.score.sum.nTie);
  ctx.fillText(text, pos.h91, pos.v111);

  const imgStar = await Canvas.loadImage(`./image/scStar.png`);
  const lengthStar = 500;
  ctx.drawImage(
    imgStar,
    pos.h61 - lengthStar / 2,
    pos.v111 - lengthStar / 2 - 20,
    lengthStar,
    lengthStar,
  );
  let sd = mongoTeam.score.sum.starDifference;
  if (sd < 0) {
    text = String(sd);
  } else {
    text = `+${String(sd)}`;
  }
  ctx.textAlign = "left";
  setFont(ctx, config.canvasFontSize.medium);
  ctx.fillText(text, pos.h51 - 20, pos.v111);

  // hitrates
  if (league == "j1" || league == "j2") {
    var imgRatio = 0.5;
    var imgStars = await Canvas.loadImage(`./image/scStarTriple.png`);
    var posImgStarsH = pos.h161 + 30 - (300 * imgRatio) / 2 - 30;
    var posImgStarsV = pos.v101 - (130 * imgRatio) / 1.4 + 10;
    ctx.drawImage(
      imgStars,
      posImgStarsH,
      posImgStarsV,
      300 * imgRatio,
      130 * imgRatio,
    );
    var imgRatio = 0.35;
    var imgStars = await Canvas.loadImage(`./image/scStarTripleBlue.png`);
    var posImgStarsH = pos.h121 + 20 - (300 * imgRatio) / 2;
    ctx.drawImage(
      imgStars,
      posImgStarsH,
      posImgStarsV + 10,
      300 * imgRatio,
      130 * imgRatio,
    );
    var imgStars = await Canvas.loadImage(`./image/scStarTripleOrange.png`);
    var posImgStarsH = pos.h81 + 20 - (300 * imgRatio) / 2;
    ctx.drawImage(
      imgStars,
      posImgStarsH,
      posImgStarsV + 10,
      300 * imgRatio,
      130 * imgRatio,
    );
    var imgStars = await Canvas.loadImage(`./image/scStarTripleRed.png`);
    var posImgStarsH = pos.h41 + 20 - (300 * imgRatio) / 2;
    ctx.drawImage(
      imgStars,
      posImgStarsH,
      posImgStarsV + 10,
      300 * imgRatio,
      130 * imgRatio,
    );

    const posHirtateV = pos.v91;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    setFont(ctx, config.canvasFontSize.medium);
    text = `${Math.round(mongoTeam.score.sum.clan.allAttackTypes.hitrate.total)}`;
    ctx.fillText(text, pos.h161 + 30, posHirtateV);
    setFont(ctx, config.canvasFontSize.small);
    text = `${Math.round(mongoTeam.score.sum.clan.fresh.hitrate.total)}`;
    ctx.fillText(text, pos.h121 + 30, posHirtateV - 3);
    text = `${Math.round(mongoTeam.score.sum.clan.cleanup.hitrate.total)}`;
    ctx.fillText(text, pos.h81 + 30, posHirtateV - 3);
    text = `${Math.round(mongoTeam.score.sum.clan.overkill.hitrate.total)}`;
    ctx.fillText(text, pos.h41 + 30, posHirtateV - 3);
    ctx.textAlign = "left";
    setFont(ctx, config.canvasFontSize.small);
    text = `%`;
    ctx.fillText(text, pos.h161 + 30, posHirtateV + 5);
    setFont(ctx, config.canvasFontSize.xSmall);
    ctx.fillText(text, pos.h121 + 30, posHirtateV + 2);
    ctx.fillText(text, pos.h81 + 30, posHirtateV + 2);
    ctx.fillText(text, pos.h41 + 30, posHirtateV + 2);

    const pos_triple = pos.v81;
    ctx.textAlign = "right";
    setFont(ctx, config.canvasFontSize.medium);
    text = `${mongoTeam.score.sum.clan.allAttackTypes.nTriple.total}`;
    ctx.fillText(text, pos.h161 + 20, pos_triple - 10);
    setFont(ctx, config.canvasFontSize.small);
    text = `${mongoTeam.score.sum.clan.fresh.nTriple.total}`;
    ctx.fillText(text, pos.h121 + 30, pos_triple - 5);
    text = `${mongoTeam.score.sum.clan.cleanup.nTriple.total}`;
    ctx.fillText(text, pos.h81 + 30, pos_triple - 5);
    text = `${mongoTeam.score.sum.clan.overkill.nTriple.total}`;
    ctx.fillText(text, pos.h41 + 30, pos_triple - 5);
    ctx.textAlign = "left";
    setFont(ctx, config.canvasFontSize.small);
    text = `/${mongoTeam.score.sum.clan.allAttackTypes.nAt.total}`;
    ctx.fillText(text, pos.h161 + 20, pos_triple);
    setFont(ctx, config.canvasFontSize.xSmall);
    text = `/${mongoTeam.score.sum.clan.fresh.nAt.total}`;
    ctx.fillText(text, pos.h121 + 30, pos_triple);
    text = `/${mongoTeam.score.sum.clan.cleanup.nAt.total}`;
    ctx.fillText(text, pos.h81 + 30, pos_triple);
    text = `/${mongoTeam.score.sum.clan.overkill.nAt.total}`;
    ctx.fillText(text, pos.h41 + 30, pos_triple);
  } else if (league == "swiss" || league == "five") {
    var imgRatio = 0.5;
    var imgStars = await Canvas.loadImage(`./image/scStarTriple.png`);
    var posImgStarsH = pos.h91 - (300 * imgRatio) / 2 - 50;
    var posImgStarsV = pos.v101 - (130 * imgRatio) / 1.4 + 10;
    ctx.drawImage(
      imgStars,
      posImgStarsH,
      posImgStarsV,
      300 * imgRatio,
      130 * imgRatio,
    );

    const posHirtateV = pos.v91;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    setFont(ctx, config.canvasFontSize.medium);
    ctx.fillText(
      `${Math.round(mongoTeam.score.sum.clan.allAttackTypes.hitrate.total)}`,
      pos.h101 + 10,
      posHirtateV,
    );
    ctx.textAlign = "left";
    setFont(ctx, config.canvasFontSize.small);
    ctx.fillText(`%`, pos.h101 + 10, posHirtateV + 5);

    const pos_triple = pos.v81;
    ctx.textAlign = "right";
    setFont(ctx, config.canvasFontSize.medium);
    ctx.fillText(
      `${mongoTeam.score.sum.clan.allAttackTypes.nTriple.total}`,
      pos.h101 + 0,
      pos_triple - 10,
    );
    ctx.textAlign = "left";
    setFont(ctx, config.canvasFontSize.small);
    ctx.fillText(
      `/${mongoTeam.score.sum.clan.allAttackTypes.nAt.total}`,
      pos.h101 + 0,
      pos_triple,
    );
  } else if (league == "mix") {
    const imgRatio = 0.5;
    const imgStars = await Canvas.loadImage(`./image/scStarTriple.png`);
    const posImgStarsH = pos.h161 - (300 * imgRatio) / 2 + 17;
    const posImgStarsV = pos.v101 - (130 * imgRatio) / 1.4 + 20;
    ctx.drawImage(
      imgStars,
      posImgStarsH,
      posImgStarsV,
      300 * imgRatio,
      130 * imgRatio,
    );

    const posHirtateV = pos.v91;
    const posTripleV = pos.v81 - 10;

    ctx.textBaseline = "middle";

    // 合計ヒットレートを描画
    ctx.textAlign = "right";
    setFont(ctx, config.canvasFontSize.medium);
    ctx.fillText(
      `${Math.round(mongoTeam.score.sum.clan.allAttackTypes.hitrate.total)}`,
      pos.h161 + 30,
      posHirtateV,
    );
    ctx.fillText(
      `${mongoTeam.score.sum.clan.allAttackTypes.nTriple.total}`,
      pos.h161 + 20,
      posTripleV - 10,
    );
    ctx.textAlign = "left";
    setFont(ctx, config.canvasFontSize.small);
    ctx.fillText("%", pos.h161 + 30, posHirtateV + 5);
    ctx.fillText(
      `/${mongoTeam.score.sum.clan.allAttackTypes.nAt.total}`,
      pos.h161 + 20,
      posTripleV,
    );

    // タウンホール別
    const imgLength = 80;
    const townhalls = [
      {
        level: "th17",
        img: "./image/th17_cam3.png",
        posH: pos.h121,
        posV: pos.v101,
      },
      {
        level: "th16",
        img: "./image/th16_cam3.png",
        posH: pos.h101,
        posV: pos.v101,
      },
      {
        level: "th15",
        img: "./image/th15_cam3.png",
        posH: pos.h81,
        posV: pos.v101 + 5,
      },
      {
        level: "th14",
        img: "./image/th14_cam3.png",
        posH: pos.h61,
        posV: pos.v101,
      },
      {
        level: "th13",
        img: "./image/th13_cam3.png",
        posH: pos.h41,
        posV: pos.v101,
      },
    ];

    for (const th of townhalls) {
      // タウンホール画像を描画
      const imgTH = await Canvas.loadImage(th.img);
      const posImgTownhallH = th.posH - imgLength / 2 + 25;
      const posImgTownhallV = th.posV - imgLength / 2 + 10;
      ctx.drawImage(
        imgTH,
        posImgTownhallH,
        posImgTownhallV,
        imgLength,
        imgLength,
      );

      // ヒットレートを描画
      ctx.textAlign = "right";
      setFont(ctx, config.canvasFontSize.small);
      ctx.fillText(
        `${Math.round(mongoTeam.score.sum.clan.allAttackTypes.hitrate[th.level])}`,
        th.posH + 40,
        posHirtateV - 3,
      );
      ctx.fillText(
        `${mongoTeam.score.sum.clan.allAttackTypes.nTriple[th.level]}`,
        th.posH + 20,
        posTripleV - 5,
      );
      ctx.textAlign = "left";
      setFont(ctx, config.canvasFontSize.xxSmall);
      ctx.fillText("%", th.posH + 40, posHirtateV + 2);
      ctx.fillText(
        `/${mongoTeam.score.sum.clan.allAttackTypes.nAt[th.level]}`,
        th.posH + 20,
        posTripleV,
      );
    }
  }

  // ***** Chart ***** //
  const widthChart = 640;
  const heightChart = 640;
  const width = widthChart;
  const height = heightChart;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  let chartLabels = [];
  let chartDataAvg = [];
  let chartDataTeam = [];
  if (league == "j1" || league == "j2") {
    chartLabels = [
      "All att.",
      "Fresh att.",
      "Cleanup att.",
      "Overkill att.",
      "All def.",
      "Fresh def.",
      "Cleanup def.",
      "Overkill def.",
    ];
    chartDataAvg = [50, 50, 50, 50, 50, 50, 50, 50];
    chartDataTeam[0] = mongoTeam.stats.tScore.sum.allAttackTypes.total;
    chartDataTeam[1] = mongoTeam.stats.tScore.sum.fresh.total;
    chartDataTeam[2] = mongoTeam.stats.tScore.sum.cleanup.total;
    chartDataTeam[3] = mongoTeam.stats.tScore.sum.overkill.total;
    chartDataTeam[4] = mongoTeam.stats.tScoreDef.sum.allAttackTypes.total;
    chartDataTeam[5] = mongoTeam.stats.tScoreDef.sum.fresh.total;
    chartDataTeam[6] = mongoTeam.stats.tScoreDef.sum.cleanup.total;
    chartDataTeam[7] = mongoTeam.stats.tScoreDef.sum.overkill.total;
  } else if (league == "swiss" || league == "five") {
    chartLabels = ["All att.", "Fresh att.", "All def.", "Fresh def."];
    chartDataAvg = [50, 50, 50, 50];
    chartDataTeam[0] = mongoTeam.stats.tScore.sum.allAttackTypes.total;
    chartDataTeam[1] = mongoTeam.stats.tScore.sum.fresh.total;
    chartDataTeam[2] = mongoTeam.stats.tScoreDef.sum.allAttackTypes.total;
    chartDataTeam[3] = mongoTeam.stats.tScoreDef.sum.fresh.total;
  } else if (league == "mix") {
    chartLabels = [
      "TH17 att.",
      "TH16 att.",
      "TH15 att.",
      "TH14 att.",
      "TH13 att.",
      "TH17 def.",
      "TH16 def.",
      "TH15 def.",
      "TH14 def.",
      "TH13 def.",
    ];
    chartDataAvg = Array(10).fill(50);
    chartDataTeam = [17, 16, 15, 14, 13].flatMap((th) => [
      mongoTeam.stats.tScore.sum.allAttackTypes[`th${th}`],
      mongoTeam.stats.tScoreDef.sum.allAttackTypes[`th${th}`],
    ]);
  }
  const chartColor = {
    j1: config.rgb.red,
    j2: config.rgb.blue,
    swiss: config.rgb.yellow,
    mix: config.rgb.green,
    five: config.rgb.purple.default,
  };
  const chartColorAlpha = {
    j1: config.rgba.red,
    j2: config.rgba.blue,
    swiss: config.rgba.yellow,
    mix: config.rgba.green,
    five: config.rgb.purple.one,
  };
  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: `AVERAGE [${league.toUpperCase()}]`,
        data: chartDataAvg,
        fill: true,
        backgroundColor: config.rgba.black,
        borderColor: config.rgb.gray200,
        pointBackgroundColor: config.rgb.gray200,
        pointBorderColor: config.rgb.darkGray,
      },
      {
        label: mongoTeam.clan_abbr.toUpperCase(),
        data: chartDataTeam,
        fill: true,
        backgroundColor: chartColorAlpha[league],
        borderColor: chartColor[league],
        pointBackgroundColor: chartColor[league],
        pointBorderColor: config.rgb.darkGray,
      },
    ],
  };
  const fontChartString = {
    family: "Helvetica Neue",
    size: 20,
  };
  const fontChartNumber = {
    family: "Helvetica Neue",
    size: 16,
  };
  const chartOptions = {
    scales: {
      r: {
        grid: {
          color: config.rgb.darkGray,
          lineWidth: 1,
        },
        angleLines: {
          display: true,
          color: config.rgb.darkGray,
        },
        suggestedMin: 30,
        suggestedMax: 70,
        ticks: {
          font: fontChartNumber,
          color: config.rgb.silverWhite,
          backdropColor: "rgba(255, 255, 255, 0)",
        },
        pointLabels: {
          font: fontChartString,
          color: config.rgb.silverWhite,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
        labels: {
          font: fontChartString,
          color: config.rgb.silverWhite,
        },
      },
    },
  };

  const configuration = {
    type: "radar",
    data: chartData,
    options: chartOptions,
  };

  const urlChart = await chartJSNodeCanvas.renderToDataURL(configuration);
  const imgChart = await Canvas.loadImage(urlChart);
  ctx.drawImage(
    imgChart,
    pos.h102 - widthChart / 2,
    pos.v101 - heightChart / 2 + 20,
    widthChart,
    heightChart,
  );
  // ***** Chart ***** //

  // ***** WARS ***** //
  const pos_wars = pos.v41;
  ctx.textAlign = "center";
  ctx.fillStyle = config.rgb.gray200;
  setFont(ctx, config.canvasFontSize.xxSmall);
  text = "Week";
  ctx.fillText(text, pos.h171, pos_wars);
  text = "Result";
  ctx.fillText(text, pos.h141, pos_wars);
  text = "Hitrate";
  ctx.fillText(text, pos.h111, pos_wars);
  text = "Triples";
  ctx.fillText(text, pos.h81, pos_wars);
  text = "vs.";
  ctx.fillText(text, pos.h41, pos_wars);

  const query = {
    season: config.season[league],
    league: league,
    $or: [
      { clan_abbr: mongoTeam.clan_abbr },
      { opponent_abbr: mongoTeam.clan_abbr },
    ],
  };
  const options = {
    projection: { _id: 0, clan_abbr: 1, opponent_abbr: 1, week: 1 },
  };
  const sort = {};
  const cursor = clientMongo
    .db("jwc")
    .collection("wars")
    .find(query, options)
    .sort(sort);
  const wars = await cursor.toArray();
  await cursor.close();
  let arrOpponentAbbr = [];
  wars.map((war, index) => {
    if (war.clan_abbr == mongoTeam.clan_abbr) {
      arrOpponentAbbr[war.week] = war.opponent_abbr;
    } else {
      arrOpponentAbbr[war.week] = war.clan_abbr;
    }
  });

  ctx.fillStyle = config.rgb.snowWhite;
  setFont(ctx, config.canvasFontSize.xSmall);
  let spacing = 220;
  let weekMax = 9;
  if (league == "j1") {
    spacing = 220;
    weekMax = 8;
  }
  if (league == "j2" || league == "swiss") {
    spacing = 220;
    weekMax = 9;
  } else if (league == "mix") {
    spacing = 140;
    weekMax = 14;
  } else if (league == "five") {
    spacing = 160;
    weekMax = 12;
  }
  for (let week = 1; week <= weekMax; week++) {
    ctx.textAlign = "center";
    const score = mongoTeam.score[`w${week}`];
    let pos_wars_i = pos_wars + week * spacing;
    text = String(week);
    setFont(ctx, config.canvasFontSize.xSmall);
    ctx.fillText(text, pos.h171, pos_wars_i);
    if (score) {
      if (score.point == 2) {
        ctx.fillStyle = config.rgb.green;
      } else if (score.point == 1) {
        ctx.fillStyle = config.rgb.darkGray;
      } else if (score.point == 0) {
        ctx.fillStyle = config.rgb.red;
      }
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(pos.h151, pos_wars_i, 30, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();

      if (score.point == 2) {
        text = "W";
      } else if (score.point == 1) {
        text = "T";
      } else if (score.point == 0) {
        text = "L";
      }
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = config.rgb.snowWhite;
      setFont(ctx, config.canvasFontSize.xSmall);
      ctx.fillText(text, pos.h151, pos_wars_i);

      if (score.state != "forfeited") {
        ctx.textBaseline = "bottom";

        setFont(ctx, config.canvasFontSize.medium);
        text = `${score.clan.stars}`;
        ctx.fillText(text, pos.h131 - 20, pos_wars_i + 5);
        setFont(ctx, config.canvasFontSize.small);
        text = `${score.opponent.stars}`;
        ctx.fillText(text, pos.h131 - 20, pos_wars_i + 50);

        ctx.textAlign = "right";
        setFont(ctx, config.canvasFontSize.medium);
        text = `${Math.round(score.clan.allAttackTypes.hitrate.total)}`;
        ctx.fillText(text, pos.h111 + 20, pos_wars_i + 5);
        ctx.textAlign = "left";
        setFont(ctx, config.canvasFontSize.small);
        text = `%`;
        ctx.fillText(text, pos.h111 + 20, pos_wars_i + 5);
        ctx.textAlign = "right";
        setFont(ctx, config.canvasFontSize.small);
        text = `${Math.round(score.opponent.allAttackTypes.hitrate.total)}`;
        ctx.fillText(text, pos.h111 + 20, pos_wars_i + 50);
        ctx.textAlign = "left";
        setFont(ctx, config.canvasFontSize.xSmall);
        text = `%`;
        ctx.fillText(text, pos.h111 + 20, pos_wars_i + 50);

        ctx.textAlign = "right";
        setFont(ctx, config.canvasFontSize.medium);
        text = `${score.clan.allAttackTypes.nTriple.total}`;
        ctx.fillText(text, pos.h81 + 10, pos_wars_i + 5);
        ctx.textAlign = "left";
        setFont(ctx, config.canvasFontSize.small);
        text = `/${score.clan.allAttackTypes.nAt.total}`;
        ctx.fillText(text, pos.h81 + 10, pos_wars_i + 5);
        ctx.textAlign = "right";
        setFont(ctx, config.canvasFontSize.small);
        text = `${score.opponent.allAttackTypes.nTriple.total}`;
        ctx.fillText(text, pos.h81 + 10, pos_wars_i + 50);
        ctx.textAlign = "left";
        setFont(ctx, config.canvasFontSize.xSmall);
        text = `/${score.opponent.allAttackTypes.nAt.total}`;
        ctx.fillText(text, pos.h81 + 10, pos_wars_i + 50);
      }
    }

    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    setFont(ctx, config.canvasFontSize.xSmall);
    let opponentAbbr = arrOpponentAbbr[week];
    if (opponentAbbr == undefined) {
      if (league == "j2" && week <= 9) {
        opponentAbbr = "BYE";
      } else {
        opponentAbbr = "";
      }
      setFont(ctx, config.canvasFontSize.xxSmall);
    }
    text = String(opponentAbbr).toUpperCase();
    ctx.fillText(text, pos.h41, pos_wars_i);
  }

  // TOP PLAYERS
  let posStart_topPlayers = {};

  if (league == "j1" || league == "j2") {
    posStart_topPlayers = {
      total: pos.v41,
      fresh: pos.v42 + 48,
      cleanup: pos.v92,
      overkill: pos.v132 + 48,
    };
    ctx.textAlign = "center";
    var imgRatio = 0.35;
    var imgStars = await Canvas.loadImage(`./image/scStarTriple.png`);
    var posImgStarsH = pos.h32 - (300 * imgRatio) / 2;
    var posImgStarsV = posStart_topPlayers.total - (130 * imgRatio) / 1.4 + 5;
    ctx.drawImage(
      imgStars,
      posImgStarsH,
      posImgStarsV,
      300 * imgRatio,
      130 * imgRatio,
    );
    var imgRatio = 0.25;
    var imgStars = await Canvas.loadImage(`./image/scStarTripleBlue.png`);
    var posImgStarsV = posStart_topPlayers.fresh - (130 * imgRatio) / 1.4 + 2;
    ctx.drawImage(
      imgStars,
      posImgStarsH + 17,
      posImgStarsV,
      300 * imgRatio,
      130 * imgRatio,
    );
    var imgStars = await Canvas.loadImage(`./image/scStarTripleOrange.png`);
    var posImgStarsV = posStart_topPlayers.cleanup - (130 * imgRatio) / 1.4 + 2;
    ctx.drawImage(
      imgStars,
      posImgStarsH + 17,
      posImgStarsV,
      300 * imgRatio,
      130 * imgRatio,
    );
    var imgStars = await Canvas.loadImage(`./image/scStarTripleRed.png`);
    var posImgStarsV =
      posStart_topPlayers.overkill - (130 * imgRatio) / 1.4 + 2;
    ctx.drawImage(
      imgStars,
      posImgStarsH + 17,
      posImgStarsV,
      300 * imgRatio,
      130 * imgRatio,
    );

    ctx.textAlign = "left";
    setFont(ctx, config.canvasFontSize.small);
    text = "Total";
    ctx.fillText(text, pos.h42 + 30, posStart_topPlayers.total);
    setFont(ctx, config.canvasFontSize.xSmall);
    text = "Fresh";
    ctx.fillText(text, pos.h42 + 30, posStart_topPlayers.fresh);
    text = "Cleanup";
    ctx.fillText(text, pos.h42 + 30, posStart_topPlayers.cleanup);
    text = "Overkill";
    ctx.fillText(text, pos.h42 + 30, posStart_topPlayers.overkill);

    spacing = 68;
    let counter = 1;
    mongoRanking[league].total.forEach((acc, index) => {
      if (counter > 10) return;
      if (acc.homeClanAbbr == mongoTeam.clan_abbr) {
        let pos_ranking = posStart_topPlayers.total + counter * spacing;
        ctx.textAlign = "center";
        ctx.fillStyle = config.rgb.snowWhite;
        text = String(counter);
        setFont(ctx, config.canvasFontSize.xSmall);
        ctx.fillText(text, pos.h32, pos_ranking);
        if (acc.rank < 100) {
          text = `(${String(acc.rank)})`;
          setFont(ctx, config.canvasFontSize.xxSmall);
          ctx.fillText(text, pos.h42, pos_ranking);
        }
        text = String(acc.name);
        setFontJP(ctx, config.canvasFontSize.xSmall);
        ctx.fillText(text, pos.h102, pos_ranking);
        ctx.textAlign = "right";
        setFont(ctx, config.canvasFontSize.small);
        text = String(acc.nTriples);
        ctx.fillText(text, pos.h162, pos_ranking);
        setFont(ctx, config.canvasFontSize.xSmall);
        ctx.textAlign = "left";
        text = String(`/${acc.nAttacks}`);
        ctx.fillText(text, pos.h162, pos_ranking + 3);
        counter += 1;
      }
    });
    spacing = 60;
    counter = 1;
    mongoRanking[league].fresh.forEach((acc, index) => {
      if (counter > 5) return;
      if (acc.homeClanAbbr == mongoTeam.clan_abbr) {
        let pos_ranking = posStart_topPlayers.fresh + counter * spacing;
        ctx.textAlign = "center";
        ctx.fillStyle = config.rgb.snowWhite;
        text = String(counter);
        setFont(ctx, config.canvasFontSize.xxSmall);
        ctx.fillText(text, pos.h32, pos_ranking);
        if (acc.rank < 100) {
          text = `(${String(acc.rank)})`;
          setFont(ctx, config.canvasFontSize.xxxSmall);
          ctx.fillText(text, pos.h42, pos_ranking);
        }
        text = String(acc.name);
        setFontJP(ctx, config.canvasFontSize.xxSmall);
        ctx.fillText(text, pos.h102, pos_ranking);
        ctx.textAlign = "right";
        setFont(ctx, config.canvasFontSize.xSmall);
        text = String(acc.nTriples);
        ctx.fillText(text, pos.h162, pos_ranking);
        setFont(ctx, config.canvasFontSize.xxSmall);
        ctx.textAlign = "left";
        text = String(`/${acc.nAttacks}`);
        ctx.fillText(text, pos.h162, pos_ranking + 2);
        counter += 1;
      }
    });
    counter = 1;
    mongoRanking[league].cleanup.forEach((acc, index) => {
      if (counter > 5) return;
      if (acc.homeClanAbbr == mongoTeam.clan_abbr) {
        let pos_ranking = posStart_topPlayers.cleanup + counter * spacing;
        ctx.textAlign = "center";
        ctx.fillStyle = config.rgb.snowWhite;
        text = String(counter);
        setFont(ctx, config.canvasFontSize.xxSmall);
        ctx.fillText(text, pos.h32, pos_ranking);
        if (acc.rank < 100) {
          text = `(${String(acc.rank)})`;
          setFont(ctx, config.canvasFontSize.xxxSmall);
          ctx.fillText(text, pos.h42, pos_ranking);
        }
        text = String(acc.name);
        setFontJP(ctx, config.canvasFontSize.xxSmall);
        ctx.fillText(text, pos.h102, pos_ranking);
        ctx.textAlign = "right";
        setFont(ctx, config.canvasFontSize.xSmall);
        text = String(acc.nTriples);
        ctx.fillText(text, pos.h162, pos_ranking);
        setFont(ctx, config.canvasFontSize.xxSmall);
        ctx.textAlign = "left";
        text = String(`/${acc.nAttacks}`);
        ctx.fillText(text, pos.h162, pos_ranking + 2);
        counter += 1;
      }
    });
    counter = 1;
    mongoRanking[league].overkill.forEach((acc, index) => {
      if (counter > 5) return;
      if (acc.homeClanAbbr == mongoTeam.clan_abbr) {
        let pos_ranking = posStart_topPlayers.overkill + counter * spacing;
        ctx.textAlign = "center";
        ctx.fillStyle = config.rgb.snowWhite;
        text = String(counter);
        setFont(ctx, config.canvasFontSize.xxSmall);
        ctx.fillText(text, pos.h32, pos_ranking);
        if (acc.rank < 100) {
          text = `(${String(acc.rank)})`;
          setFont(ctx, config.canvasFontSize.xxxSmall);
          ctx.fillText(text, pos.h42, pos_ranking);
        }
        text = String(acc.name);
        setFontJP(ctx, config.canvasFontSize.xxSmall);
        ctx.fillText(text, pos.h102, pos_ranking);
        ctx.textAlign = "right";
        setFont(ctx, config.canvasFontSize.xSmall);
        text = String(acc.nTriples);
        ctx.fillText(text, pos.h162, pos_ranking);
        setFont(ctx, config.canvasFontSize.xxSmall);
        ctx.textAlign = "left";
        text = String(`/${acc.nAttacks}`);
        ctx.fillText(text, pos.h162, pos_ranking + 2);
        counter += 1;
      }
    });
  } else if (league == "swiss" || league == "five") {
    posStart_topPlayers.total = pos.v51;
    spacing = 70;
    let counter = 1;
    mongoRanking[league].forEach((acc, index) => {
      if (counter > 20) return;
      if (acc.homeClanAbbr == mongoTeam.clan_abbr) {
        let pos_ranking = posStart_topPlayers.total + counter * spacing;
        ctx.textAlign = "center";
        ctx.fillStyle = config.rgb.snowWhite;
        text = String(counter);
        setFont(ctx, config.canvasFontSize.xSmall);
        ctx.fillText(text, pos.h32, pos_ranking);
        if (acc.rank < 100) {
          text = `(${String(acc.rank)})`;
          setFont(ctx, config.canvasFontSize.xxSmall);
          ctx.fillText(text, pos.h42, pos_ranking);
        }
        text = String(acc.name);
        setFontJP(ctx, config.canvasFontSize.xSmall);
        ctx.fillText(text, pos.h102, pos_ranking);
        ctx.textAlign = "right";
        setFont(ctx, config.canvasFontSize.small);
        text = String(acc.nTriples);
        ctx.fillText(text, pos.h162, pos_ranking);
        setFont(ctx, config.canvasFontSize.xSmall);
        ctx.textAlign = "left";
        text = String(`/${acc.nAttacks}`);
        ctx.fillText(text, pos.h162, pos_ranking + 3);
        counter += 1;
      }
    });
  } else if (league == "mix") {
    const posStart_topPlayers = {
      th17: pos.v41,
      th16: pos.v12,
      th15: pos.v42,
      th14: pos.v82,
      th13: pos.v122,
    };

    const imgLength = 80;
    const posImgStarsH = pos.h32 - imgLength / 2;

    for (const [th, posV] of Object.entries(posStart_topPlayers)) {
      const imgTH = await Canvas.loadImage(`./image/${th}_cam3.png`);
      const posImgStarsV = posV - imgLength / 2;
      ctx.drawImage(imgTH, posImgStarsH, posImgStarsV, imgLength, imgLength);

      ctx.textAlign = "right";
      setFont(ctx, config.canvasFontSize.xSmall);
      ctx.fillText("TH", pos.h52 + 0, posV + 7);

      ctx.textAlign = "left";
      setFont(ctx, config.canvasFontSize.small);
      ctx.fillText(th.replace("th", ""), pos.h52 + 0, posV + 5);

      spacing = 70;
      const levels = ["th17", "th16", "th15", "th14", "th13"];
      const limits = { th17: 5, th16: 2, th15: 4, th14: 4, th13: 4 };

      levels.forEach((lvTH) => {
        let counter = 1;
        const limit = limits[lvTH];
        mongoRanking[league][lvTH].forEach((acc, index) => {
          if (counter > limit) return;
          if (acc.homeClanAbbr == mongoTeam.clan_abbr) {
            const pos_ranking = posStart_topPlayers[lvTH] + counter * spacing;
            ctx.textAlign = "center";
            ctx.fillStyle = config.rgb.snowWhite;
            let text = String(counter);
            setFont(ctx, config.canvasFontSize.xSmall);
            ctx.fillText(text, pos.h32, pos_ranking);
            if (acc.rank < 100) {
              text = `(${String(acc.rank)})`;
              setFont(ctx, config.canvasFontSize.xxSmall);
              ctx.fillText(text, pos.h42, pos_ranking);
            }
            text = String(acc.name);
            setFontJP(ctx, config.canvasFontSize.xSmall);
            ctx.fillText(text, pos.h102, pos_ranking);
            ctx.textAlign = "right";
            setFont(ctx, config.canvasFontSize.small);
            text = String(acc.nTriples);
            ctx.fillText(text, pos.h162, pos_ranking);
            setFont(ctx, config.canvasFontSize.xSmall);
            ctx.textAlign = "left";
            text = String(`/${acc.nAttacks}`);
            ctx.fillText(text, pos.h162, pos_ranking + 3);
            counter += 1;
          }
        });
      });
    }
  }

  // ***** 中央下 ***** //
  ctx.textAlign = "center";
  const lengthLogoJwc = 150;
  const imgJwcLogo = await Canvas.loadImage("./image/JWC.png");
  ctx.drawImage(
    imgJwcLogo,
    widthCenter - lengthLogoJwc / 2,
    heightCanvas - 260,
    lengthLogoJwc,
    lengthLogoJwc,
  );

  text = `SEASON ${config.season[league]}`;
  setFont(ctx, config.canvasFontSize.xxSmall);
  ctx.fillText(text, widthCenter, heightCanvas - 80);

  // ***** 左下 ***** //
  ctx.fillStyle = config.rgb.gray200;
  const timeUtc = Date.now();
  const timeJst = toZonedTime(timeUtc, "Asia/Tokyo");
  setFont(ctx, config.canvasFontSize.xxxSmall, FONTS.MAIN, "italic");
  text = format(timeJst, "pp, PPPP") + " [JST]";
  ctx.fillText(text, pos.h111, heightCanvas - 110);
  setFont(ctx, config.canvasFontSize.xxxxSmall, FONTS.MAIN, "italic");
  text = "Automatically generated by JWC bot";
  ctx.fillText(text, pos.h111, heightCanvas - 70);

  // ***** 後処理 ***** //
  const pngData = await myCanvas.encode("png");

  const attachment = new AttachmentBuilder(pngData, {
    name: `teamStats_${league}.png`,
  });

  return attachment;
}
export { teamStats };

async function standings(league, standings, leagueStats) {
  const widthCanvas = config.canvasSize.width;
  const heightCanvas = config.canvasSize.height;
  let myCanvas = Canvas.createCanvas(
    config.canvasSize.width,
    config.canvasSize.height,
  );
  let ctx = myCanvas.getContext("2d");

  const widthCenter = widthCanvas / 2;
  const heightCenter = heightCanvas / 2;

  // ***** background image ***** //
  const bgUrl = `./image/bg/war_${league}.png`;
  const bgImage = await Canvas.loadImage(bgUrl);
  ctx.drawImage(bgImage, 0, 0, widthCanvas, heightCanvas);

  // ***** text & line color ***** //
  ctx.fillStyle = config.rgb.snowWhite;
  ctx.strokeStyle = config.rgb.snowWhite;

  // ***** Font ***** //
  const myFont = FONTS.MAIN;
  const myFontJP = FONTS.JP;
  const myFontSC = FONTS.SC;
  const myFontNumber = FONTS.NUMBER;

  // ***** Horizontal Position ***** //
  let pos = {};
  for (let i = 0; i < 20; i++) {
    pos[`h${String(i)}1`] = widthCenter - (widthCanvas * i) / 40;
    pos[`h${String(i)}2`] = widthCenter + (widthCanvas * i) / 40;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // ***** 中央上 ***** //
  let text = `STANDINGS | ${config.league[league]}`;
  setFont(ctx, config.canvasFontSize.large);
  ctx.fillText(text, widthCenter, 200);

  // ***** 中央下 ***** //
  const lengthLogoJwc = 100;
  const imgJwcLogo = await Canvas.loadImage("./image/JWC.png");
  ctx.drawImage(
    imgJwcLogo,
    widthCenter - lengthLogoJwc / 2,
    heightCanvas - 200,
    lengthLogoJwc,
    lengthLogoJwc,
  );

  text = `SEASON ${config.season[league]}`;
  setFont(ctx, config.canvasFontSize.xxxSmall);
  ctx.fillText(text, widthCenter, heightCanvas - 70);

  // ***** 左下 ***** //
  ctx.fillStyle = config.rgb.gray200;
  const timeUtc = Date.now();
  const timeJst = toZonedTime(timeUtc, "Asia/Tokyo");
  setFont(ctx, config.canvasFontSize.xxxSmall, FONTS.MAIN, "italic");
  text = format(timeJst, "pp, PPPP") + " [JST]";
  ctx.fillText(text, pos.h111, heightCanvas - 110);
  setFont(ctx, config.canvasFontSize.xxxxSmall, FONTS.MAIN, "italic");
  text = "Automatically generated by JWC bot";
  ctx.fillText(text, pos.h111, heightCanvas - 70);

  // ***** STANDINGS ***** //
  ctx.fillStyle = config.rgb.snowWhite;
  const marginTop = 600;
  const spacing = (heightCanvas - 800) / standings.length;
  const headerHeight = 350;

  let posH = {};
  posH.rank = pos.h161;
  posH.logo = pos.h131;
  posH.team = pos.h111;
  posH.teamName = pos.h91;
  posH.score = pos.h41;
  posH.sd = pos.h11;
  posH.dp = pos.h22;
  posH.hitrate = {};
  // j1, j2
  posH.hitrate.j1 = pos.h62;
  posH.hitrate.j2 = pos.h62;
  posH.fresh = pos.h92;
  posH.cleanup = pos.h122;
  posH.overkill = pos.h152;
  // swiss, five
  posH.hitrate.swiss = pos.h72;
  posH.hitrate.five = pos.h72;
  posH.triple = pos.h122;
  // mix
  posH.hitrate.mix = pos.h62;
  posH.th17 = pos.h82;
  posH.th16 = pos.h102;
  posH.th15 = pos.h122;
  posH.th14 = pos.h142;
  posH.th13 = pos.h162;

  setFont(ctx, config.canvasFontSize.xxSmall);
  text = "Rank";
  ctx.fillText(text, posH.rank, headerHeight);
  text = "Team";
  ctx.fillText(text, posH.team, headerHeight);
  text = "W-L(-T)";
  ctx.fillText(text, posH.score, headerHeight);
  text = "SD";
  ctx.fillText(text, posH.sd + 20, headerHeight);
  text = "%";
  ctx.fillText(text, posH.dp, headerHeight);
  text = "Hitrate";
  ctx.fillText(text, posH.hitrate[league], headerHeight);
  setFont(ctx, config.canvasFontSize.xxxSmall);
  if (league == "j1" || league == "j2") {
    text = "Fresh";
    ctx.fillText(text, posH.fresh, headerHeight);
    text = "Cleanup";
    ctx.fillText(text, posH.cleanup, headerHeight);
    text = "Overkill";
    ctx.fillText(text, posH.overkill, headerHeight);
    /*
    if (league == 'j1') {
      text = 'Div.';
      ctx.fillText(text, pos.h172, headerHeight);
    };
    */
  } else if (league == "swiss" || league == "five") {
  } else if (league == "mix") {
    // change TH level
    text = "TH17";
    ctx.fillText(text, posH.th17 + 30, headerHeight);
    text = "TH16";
    ctx.fillText(text, posH.th16 + 30, headerHeight);
    text = "TH15";
    ctx.fillText(text, posH.th15 + 30, headerHeight);
    text = "TH14";
    ctx.fillText(text, posH.th14 + 30, headerHeight);
    text = "TH13";
    ctx.fillText(text, posH.th13 + 30, headerHeight);
    const lengthTh = 60;
    const imgTh17 = await Canvas.loadImage(`./image/th17_cam3.png`);
    ctx = reflectImage2Canvas(
      ctx,
      imgTh17,
      lengthTh,
      lengthTh,
      posH.th17 - lengthTh / 2 + 30,
      headerHeight + lengthTh / 4,
    );
    const imgTh16 = await Canvas.loadImage(`./image/th16_cam3.png`);
    ctx = reflectImage2Canvas(
      ctx,
      imgTh16,
      lengthTh,
      lengthTh,
      posH.th16 - lengthTh / 2 + 30,
      headerHeight + lengthTh / 4,
    );
    const imgTh15 = await Canvas.loadImage(`./image/th15_cam3.png`);
    ctx = reflectImage2Canvas(
      ctx,
      imgTh15,
      lengthTh,
      lengthTh,
      posH.th15 - lengthTh / 2 + 30,
      headerHeight + lengthTh / 2.9,
    );
    const imgTh14 = await Canvas.loadImage(`./image/th14_cam3.png`);
    ctx = reflectImage2Canvas(
      ctx,
      imgTh14,
      lengthTh,
      lengthTh,
      posH.th14 - lengthTh / 2 + 30,
      headerHeight + lengthTh / 3.2,
    );
    const imgTh13 = await Canvas.loadImage(`./image/th13_cam3.png`);
    ctx = reflectImage2Canvas(
      ctx,
      imgTh13,
      lengthTh,
      lengthTh,
      posH.th13 - lengthTh / 2 + 30,
      headerHeight + lengthTh / 3.0,
    );
  }
  ctx.fillStyle = config.rgb.gray200;
  setFont(ctx, config.canvasFontSize.xxxxSmall);
  text = "Star Difference";
  ctx.fillText(text, posH.sd, headerHeight + 50);
  text = "Destruction Percentage";
  ctx.fillText(text, posH.dp, headerHeight + 50);
  if (league == "swiss" || league == "five") {
    ctx.fillStyle = config.rgb.snowWhite;
    setFont(ctx, config.canvasFontSize.xxSmall);
    text = "Triples / Attacks";
    ctx.fillText(text, posH.triple + 20, headerHeight);
  } else {
    text = "Triples / Attacks";
    ctx.fillText(text, posH.hitrate[league], headerHeight + 50);
  }
  const lengthStar = 30;
  const imgStar = await Canvas.loadImage(`./image/star2.png`);
  ctx = reflectImage2Canvas(
    ctx,
    imgStar,
    lengthStar,
    lengthStar,
    posH.sd - lengthStar / 2 - 20,
    headerHeight - lengthStar / 2,
  );

  await Promise.all(
    standings.map(async (team, index) => {
      ctx.fillStyle = config.rgb.snowWhite;

      let pos0 = marginTop + index * spacing;

      ctx.fillStyle = config.rgb.black;
      ctx.beginPath();
      ctx.globalAlpha = 0.5;
      ctx.moveTo(pos.h181, pos0 - spacing * 0.4);
      ctx.lineTo(pos.h192, pos0 - spacing * 0.4);
      ctx.lineTo(pos.h182, pos0 + spacing * 0.4);
      ctx.lineTo(pos.h191, pos0 + spacing * 0.4);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      ctx.fillStyle = config.rgb.snowWhite;
      text = String(team.rank);
      setFont(ctx, config.canvasFontSize.small);
      ctx.fillText(text, posH.rank, pos0);

      // team logo
      const lengthLogo = spacing * 0.5;
      let dxA = posH.logo - lengthLogo / 2;
      let dyA = pos0 - lengthLogo * 0.5;
      try {
        const imgTeam = await Canvas.loadImage(
          `./image/teamLogo/${team.clan_abbr}.png`,
        );
        ctx = reflectImage2Canvas(
          ctx,
          imgTeam,
          lengthLogo,
          lengthLogo,
          dxA,
          dyA,
        );
      } catch (error) {
        const imgJwc = await Canvas.loadImage(`./image/JWC.png`);
        ctx = reflectImage2Canvas(
          ctx,
          imgJwc,
          lengthLogo,
          lengthLogo,
          dxA,
          dyA,
        );
      }

      text = team.clan_abbr.toUpperCase();
      setFont(ctx, config.canvasFontSize.small);
      ctx.fillText(text, posH.teamName, pos0);

      text = team.team_name.replace(/\\/g, "").replace(/‪⋆͛/g, "");
      let fontSizeTeamName = "";
      if (league == "swiss" || league == "five") {
        fontSizeTeamName = config.canvasFontSize.xxxxSmall;
      } else {
        fontSizeTeamName = config.canvasFontSize.xxSmall;
      }
      if (team.clan_abbr.includes("omi") || team.clan_abbr.includes("lily")) {
        setFont(ctx, fontSizeTeamName, FONTS.JP);
      } else {
        setFontJP(ctx, fontSizeTeamName);
      }
      ctx.fillText(text, posH.teamName, pos0 + spacing * 0.3);

      let score = {};
      score = team.sumScore;

      if (score) {
        text = `${score.nWin}-${score.nLoss}`;
        text += score.nTie == 0 ? "" : `-${score.nTie}`;
        setFont(ctx, config.canvasFontSize.smallMedium);
        ctx.fillText(text, posH.score, pos0);

        text =
          score.starDifference < 0
            ? `${score.starDifference}`
            : `+${score.starDifference}`;
        setFont(ctx, config.canvasFontSize.smallMedium);
        ctx.fillText(text, posH.sd, pos0);

        ctx.textAlign = "right";
        text = String(Math.round(score.clan.destruction * 10) / 10);
        setFont(ctx, config.canvasFontSize.xSmall);
        ctx.fillText(text, posH.dp + 25, pos0);
        ctx.textAlign = "left";
        text = "%";
        setFont(ctx, config.canvasFontSize.xxxSmall);
        ctx.fillText(text, posH.dp + 25, pos0 + 5);

        if (league == "j1" || league == "j2") {
          ctxHitrate(
            ctx,
            score.clan.allAttackTypes,
            "total",
            posH.hitrate[league],
            pos0,
            myFont,
            config.canvasFontSize.smallMedium,
            config.canvasFontSize.xSmall,
            15,
          );
          ctxTriples(
            ctx,
            score.clan.allAttackTypes,
            "total",
            posH.hitrate[league],
            pos0,
            myFont,
            config.canvasFontSize.small,
            config.canvasFontSize.xxSmall,
            config.rgb.gray200,
            10,
            spacing / 4,
          );

          ctxHitrate(
            ctx,
            score.clan.fresh,
            "total",
            posH.fresh,
            pos0,
            myFont,
            config.canvasFontSize.small,
            config.canvasFontSize.xxSmall,
            15,
          );
          ctxTriples(
            ctx,
            score.clan.fresh,
            "total",
            posH.fresh,
            pos0,
            myFont,
            config.canvasFontSize.xSmall,
            config.canvasFontSize.xxxSmall,
            config.rgb.gray200,
            10,
            spacing / 4,
          );

          ctxHitrate(
            ctx,
            score.clan.cleanup,
            "total",
            posH.cleanup,
            pos0,
            myFont,
            config.canvasFontSize.small,
            config.canvasFontSize.xxSmall,
            15,
          );
          ctxTriples(
            ctx,
            score.clan.cleanup,
            "total",
            posH.cleanup,
            pos0,
            myFont,
            config.canvasFontSize.xSmall,
            config.canvasFontSize.xxxSmall,
            config.rgb.gray200,
            10,
            spacing / 4,
          );

          ctxHitrate(
            ctx,
            score.clan.overkill,
            "total",
            posH.overkill,
            pos0,
            myFont,
            config.canvasFontSize.small,
            config.canvasFontSize.xxSmall,
            15,
          );
          ctxTriples(
            ctx,
            score.clan.overkill,
            "total",
            posH.overkill,
            pos0,
            myFont,
            config.canvasFontSize.xSmall,
            config.canvasFontSize.xxxSmall,
            config.rgb.gray200,
            10,
            spacing / 4,
          );
        } else if (league == "swiss" || league == "five") {
          ctxHitrate(
            ctx,
            score.clan.allAttackTypes,
            "total",
            posH.hitrate[league],
            pos0,
            myFont,
            config.canvasFontSize.smallMedium,
            config.canvasFontSize.xSmall,
            15,
          );
          ctxTriples(
            ctx,
            score.clan.allAttackTypes,
            "total",
            posH.triple,
            pos0,
            myFont,
            config.canvasFontSize.smallMedium,
            config.canvasFontSize.xSmall,
            config.rgb.snowWhite,
            0,
            0,
          );
        } else if (league == "mix") {
          // change TH level
          ctxHitrate(
            ctx,
            score.clan.allAttackTypes,
            "total",
            posH.hitrate[league],
            pos0,
            myFont,
            config.canvasFontSize.smallMedium,
            config.canvasFontSize.xSmall,
            30,
          );
          ctxTriples(
            ctx,
            score.clan.allAttackTypes,
            "total",
            posH.hitrate[league],
            pos0,
            myFont,
            config.canvasFontSize.small,
            config.canvasFontSize.xxxSmall,
            config.rgb.gray200,
            20,
            spacing / 4,
          );

          ctxHitrate(
            ctx,
            score.clan.fresh,
            "th17",
            posH.th17,
            pos0,
            myFont,
            config.canvasFontSize.small,
            config.canvasFontSize.xxxSmall,
            60,
          );
          ctxTriples(
            ctx,
            score.clan.fresh,
            "th17",
            posH.th17,
            pos0,
            myFont,
            config.canvasFontSize.xSmall,
            config.canvasFontSize.xxxxSmall,
            config.rgb.gray200,
            50,
            spacing / 4,
          );

          ctxHitrate(
            ctx,
            score.clan.fresh,
            "th16",
            posH.th16,
            pos0,
            myFont,
            config.canvasFontSize.small,
            config.canvasFontSize.xxxSmall,
            60,
          );
          ctxTriples(
            ctx,
            score.clan.fresh,
            "th16",
            posH.th16,
            pos0,
            myFont,
            config.canvasFontSize.xSmall,
            config.canvasFontSize.xxxxSmall,
            config.rgb.gray200,
            50,
            spacing / 4,
          );

          ctxHitrate(
            ctx,
            score.clan.fresh,
            "th15",
            posH.th15,
            pos0,
            myFont,
            config.canvasFontSize.small,
            config.canvasFontSize.xxxSmall,
            60,
          );
          ctxTriples(
            ctx,
            score.clan.fresh,
            "th15",
            posH.th15,
            pos0,
            myFont,
            config.canvasFontSize.xSmall,
            config.canvasFontSize.xxxxSmall,
            config.rgb.gray200,
            50,
            spacing / 4,
          );

          ctxHitrate(
            ctx,
            score.clan.fresh,
            "th14",
            posH.th14,
            pos0,
            myFont,
            config.canvasFontSize.small,
            config.canvasFontSize.xxxSmall,
            60,
          );
          ctxTriples(
            ctx,
            score.clan.fresh,
            "th14",
            posH.th14,
            pos0,
            myFont,
            config.canvasFontSize.xSmall,
            config.canvasFontSize.xxxxSmall,
            config.rgb.gray200,
            50,
            spacing / 4,
          );

          ctxHitrate(
            ctx,
            score.clan.fresh,
            "th13",
            posH.th13,
            pos0,
            myFont,
            config.canvasFontSize.small,
            config.canvasFontSize.xxxSmall,
            60,
          );
          ctxTriples(
            ctx,
            score.clan.fresh,
            "th13",
            posH.th13,
            pos0,
            myFont,
            config.canvasFontSize.xSmall,
            config.canvasFontSize.xxxxSmall,
            config.rgb.gray200,
            50,
            spacing / 4,
          );
        }
      }

      ctx.textAlign = "center";
      ctx.fillStyle = config.rgb.snowWhite;

      /*
    if (team.division) {
      text = team.division.toUpperCase();
      setFont(ctx, config.canvasFontSize.xxxSmall);
      ctx.fillText(text, pos.h172, pos0);
    };
    */
    }),
  );

  let posAll = heightCanvas - 200;
  let statsLeague = {};
  if (leagueStats.stats) {
    if (
      league == "j1" ||
      league == "swiss" ||
      league == "mix" ||
      league == "five"
    ) {
      statsLeague = leagueStats.stats.sumQ;
    } else if (league == "j2") {
      statsLeague = leagueStats.stats.sum;
    }

    if (statsLeague) {
      if (league == "j1" || league == "j2") {
        ctxHitrate(
          ctx,
          statsLeague.allAttackTypes,
          "total",
          posH.hitrate[league],
          posAll,
          myFont,
          config.canvasFontSize.smallMedium,
          config.canvasFontSize.xSmall,
          15,
        );
        ctxTriples(
          ctx,
          statsLeague.allAttackTypes,
          "total",
          posH.hitrate[league],
          posAll,
          myFont,
          config.canvasFontSize.small,
          config.canvasFontSize.xxSmall,
          config.rgb.gray200,
          10,
          spacing / 4,
        );

        ctxHitrate(
          ctx,
          statsLeague.fresh,
          "total",
          posH.fresh,
          posAll,
          myFont,
          config.canvasFontSize.small,
          config.canvasFontSize.xxSmall,
          15,
        );
        ctxTriples(
          ctx,
          statsLeague.fresh,
          "total",
          posH.fresh,
          posAll,
          myFont,
          config.canvasFontSize.xSmall,
          config.canvasFontSize.xxxSmall,
          config.rgb.gray200,
          10,
          spacing / 4,
        );

        ctxHitrate(
          ctx,
          statsLeague.cleanup,
          "total",
          posH.cleanup,
          posAll,
          myFont,
          config.canvasFontSize.small,
          config.canvasFontSize.xxSmall,
          15,
        );
        ctxTriples(
          ctx,
          statsLeague.cleanup,
          "total",
          posH.cleanup,
          posAll,
          myFont,
          config.canvasFontSize.xSmall,
          config.canvasFontSize.xxxSmall,
          config.rgb.gray200,
          10,
          spacing / 4,
        );

        ctxHitrate(
          ctx,
          statsLeague.overkill,
          "total",
          posH.overkill,
          posAll,
          myFont,
          config.canvasFontSize.small,
          config.canvasFontSize.xxSmall,
          15,
        );
        ctxTriples(
          ctx,
          statsLeague.overkill,
          "total",
          posH.overkill,
          posAll,
          myFont,
          config.canvasFontSize.xSmall,
          config.canvasFontSize.xxxSmall,
          config.rgb.gray200,
          10,
          spacing / 4,
        );
      } else if (league == "swiss" || league == "five") {
        ctxHitrate(
          ctx,
          statsLeague.allAttackTypes,
          "total",
          posH.hitrate[league],
          posAll,
          myFont,
          config.canvasFontSize.smallMedium,
          config.canvasFontSize.xSmall,
          15,
        );
        ctxTriples(
          ctx,
          statsLeague.allAttackTypes,
          "total",
          posH.triple,
          posAll,
          myFont,
          config.canvasFontSize.smallMedium,
          config.canvasFontSize.xSmall,
          config.rgb.snowWhite,
          10,
          0,
        );
      } else if (league == "mix") {
        // change TH level
        ctxHitrate(
          ctx,
          statsLeague.allAttackTypes,
          "total",
          posH.hitrate[league],
          posAll,
          myFont,
          config.canvasFontSize.smallMedium,
          config.canvasFontSize.xSmall,
          30,
        );
        ctxTriples(
          ctx,
          statsLeague.allAttackTypes,
          "total",
          posH.hitrate[league],
          posAll,
          myFont,
          config.canvasFontSize.small,
          config.canvasFontSize.xxSmall,
          config.rgb.gray200,
          20,
          spacing / 4,
        );

        ctxHitrate(
          ctx,
          statsLeague.fresh,
          "th17",
          posH.th17,
          posAll,
          myFont,
          config.canvasFontSize.small,
          config.canvasFontSize.xxSmall,
          60,
        );
        ctxTriples(
          ctx,
          statsLeague.fresh,
          "th17",
          posH.th17,
          posAll,
          myFont,
          config.canvasFontSize.xSmall,
          config.canvasFontSize.xxxSmall,
          config.rgb.gray200,
          50,
          spacing / 4,
        );

        ctxHitrate(
          ctx,
          statsLeague.fresh,
          "th16",
          posH.th16,
          posAll,
          myFont,
          config.canvasFontSize.small,
          config.canvasFontSize.xxSmall,
          60,
        );
        ctxTriples(
          ctx,
          statsLeague.fresh,
          "th16",
          posH.th16,
          posAll,
          myFont,
          config.canvasFontSize.xSmall,
          config.canvasFontSize.xxxSmall,
          config.rgb.gray200,
          50,
          spacing / 4,
        );

        ctxHitrate(
          ctx,
          statsLeague.fresh,
          "th15",
          posH.th15,
          posAll,
          myFont,
          config.canvasFontSize.small,
          config.canvasFontSize.xxSmall,
          60,
        );
        ctxTriples(
          ctx,
          statsLeague.fresh,
          "th15",
          posH.th15,
          posAll,
          myFont,
          config.canvasFontSize.xSmall,
          config.canvasFontSize.xxxSmall,
          config.rgb.gray200,
          50,
          spacing / 4,
        );

        ctxHitrate(
          ctx,
          statsLeague.fresh,
          "th14",
          posH.th14,
          posAll,
          myFont,
          config.canvasFontSize.small,
          config.canvasFontSize.xxSmall,
          60,
        );
        ctxTriples(
          ctx,
          statsLeague.fresh,
          "th14",
          posH.th14,
          posAll,
          myFont,
          config.canvasFontSize.xSmall,
          config.canvasFontSize.xxxSmall,
          config.rgb.gray200,
          50,
          spacing / 4,
        );

        ctxHitrate(
          ctx,
          statsLeague.fresh,
          "th13",
          posH.th13,
          posAll,
          myFont,
          config.canvasFontSize.small,
          config.canvasFontSize.xxSmall,
          60,
        );
        ctxTriples(
          ctx,
          statsLeague.fresh,
          "th13",
          posH.th13,
          posAll,
          myFont,
          config.canvasFontSize.xSmall,
          config.canvasFontSize.xxxSmall,
          config.rgb.gray200,
          50,
          spacing / 4,
        );
      }
    }
  }

  // ***** 後処理 ***** //
  const pngData = await myCanvas.encode("png");

  const attachment = new AttachmentBuilder(pngData, {
    name: `standings_${league}.png`,
  });

  return attachment;
}
export { standings };

async function standingsLandscape(league, standings, leagueStats, strRound) {
  // ***** background image ***** //
  const bgUrl = `./image/bg/bg_landscape_${league}.png`;
  const bgImage = await Canvas.loadImage(bgUrl);

  const widthCanvas = bgImage.width;
  const heightCanvas = bgImage.height;
  let myCanvas = Canvas.createCanvas(widthCanvas, heightCanvas);
  let ctx = myCanvas.getContext("2d");
  ctx.drawImage(bgImage, 0, 0, widthCanvas, heightCanvas);

  const widthCenter = widthCanvas / 2;
  const heightCenter = heightCanvas / 2;

  // ***** text & line color ***** //
  ctx.fillStyle = config.rgb.snowWhite;
  ctx.strokeStyle = config.rgb.snowWhite;

  // ***** Font ***** //
  const myFont = FONTS.MAIN;
  const myFontJP = FONTS.JP;
  const myFontSC = FONTS.SC;
  const myFontNumber = FONTS.NUMBER;

  // ***** Horizontal Position ***** //
  let pos = {};
  for (let i = 0; i < 40; i++) {
    pos[`h${String(i)}1`] = widthCenter - (widthCanvas * i) / 80;
    pos[`h${String(i)}2`] = widthCenter + (widthCanvas * i) / 80;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // ***** 中央上 ***** //
  let text = `STANDINGS | ${config.league[league]}`;
  if (strRound) {
    text += ` - ${strRound}`;
  }
  setFont(ctx, config.canvasFontSize.xLarge);
  ctx.fillText(text, widthCenter, 200);
  ctx.fillStyle = config.rgb.gray200;
  setFont(ctx, config.canvasFontSize.large);
  if (league == "j1") {
    ctx.fillText("FIST", pos.h201, 250);
    ctx.fillText("CLOAK", pos.h202, 250);
  } else {
    ctx.fillText("A", pos.h201, 250);
    ctx.fillText("B", pos.h202, 250);
  }
  ctx.fillStyle = config.rgb.snowWhite;

  // ***** 中央下 ***** //
  const lengthLogoJwc = 150;
  const imgJwcLogo = await Canvas.loadImage("./image/JWC.png");
  ctx.drawImage(
    imgJwcLogo,
    widthCenter - lengthLogoJwc / 2,
    heightCanvas - 300,
    lengthLogoJwc,
    lengthLogoJwc,
  );

  text = `SEASON ${config.season[league]}`;
  setFont(ctx, config.canvasFontSize.xSmall);
  ctx.fillText(text, widthCenter, heightCanvas - 100);

  // ***** 左下 ***** //
  ctx.fillStyle = config.rgb.gray200;
  const timeUtc = Date.now();
  const timeJst = toZonedTime(timeUtc, "Asia/Tokyo");
  setFont(ctx, config.canvasFontSize.small, FONTS.MAIN, "italic");
  text = format(timeJst, "pp, PPPP") + " [JST]";
  ctx.fillText(text, pos.h211, heightCanvas - 180);
  setFont(ctx, config.canvasFontSize.xSmall, FONTS.MAIN, "italic");
  text = "Automatically generated by JWC bot";
  ctx.fillText(text, pos.h211, heightCanvas - 120);

  // ***** STANDINGS ***** //
  ctx.fillStyle = config.rgb.snowWhite;
  let marginTop = 0;
  let headerHeight = 0;
  let numTeamLeft = 8;

  let spacing = {};
  if (league == "five") {
    if (strRound == "QUALIFIER") {
      headerHeight = 400;
      marginTop = 600;
      spacing = {
        left: (heightCanvas - 800) / numTeamLeft,
        right: (heightCanvas - 800) / (standings.length - numTeamLeft),
      };
    } else if (strRound == "GROUP STAGE") {
      headerHeight = 400;
      marginTop = 700;
      spacing = {
        left: (heightCanvas - 800) / 4,
        right: (heightCanvas - 800) / 4,
      };
    }
  } else if (league == "j1") {
    headerHeight = 450;
    marginTop = 650;
    spacing = {
      left: (heightCanvas - 800) / 6,
      right: (heightCanvas - 800) / 6,
    };
  }

  let posH = {};
  posH.rank = { left: pos.h351, right: pos.h52 };
  posH.logo = { left: pos.h311, right: pos.h92 };
  posH.team = { left: pos.h281, right: pos.h122 };
  posH.teamName = { left: pos.h261, right: pos.h142 };
  posH.score = { left: pos.h211, right: pos.h192 };
  posH.sd = { left: pos.h181, right: pos.h222 };
  posH.dp = { left: pos.h151, right: pos.h252 };
  posH.hitrate = { left: pos.h111, right: pos.h292 };
  posH.triple = { left: pos.h71, right: pos.h332 };

  setFont(ctx, config.canvasFontSize.xSmall);
  text = "Rank";
  ctx.fillText(text, posH.rank.left, headerHeight);
  ctx.fillText(text, posH.rank.right, headerHeight);
  text = "Team";
  ctx.fillText(text, posH.team.left, headerHeight);
  ctx.fillText(text, posH.team.right, headerHeight);
  text = "W-L(-T)";
  ctx.fillText(text, posH.score.left, headerHeight);
  ctx.fillText(text, posH.score.right, headerHeight);
  text = "SD";
  ctx.fillText(text, posH.sd.left + 20, headerHeight);
  ctx.fillText(text, posH.sd.right + 20, headerHeight);
  text = "%";
  ctx.fillText(text, posH.dp.left, headerHeight);
  ctx.fillText(text, posH.dp.right, headerHeight);
  text = "Hitrate";
  ctx.fillText(text, posH.hitrate.left, headerHeight);
  ctx.fillText(text, posH.hitrate.right, headerHeight);
  setFont(ctx, config.canvasFontSize.xxSmall);

  ctx.fillStyle = config.rgb.gray200;
  setFont(ctx, config.canvasFontSize.xxxxSmall);
  text = "Star Difference";
  ctx.fillText(text, posH.sd.left, headerHeight + 50);
  ctx.fillText(text, posH.sd.right, headerHeight + 50);
  text = "Destruction Percentage";
  ctx.fillText(text, posH.dp.left, headerHeight + 50);
  ctx.fillText(text, posH.dp.right, headerHeight + 50);
  ctx.fillStyle = config.rgb.snowWhite;
  setFont(ctx, config.canvasFontSize.xSmall);
  text = "Triples / Attacks";
  ctx.fillText(text, posH.triple.left + 20, headerHeight);
  ctx.fillText(text, posH.triple.right + 20, headerHeight);
  const lengthStar = 50;
  const imgStar = await Canvas.loadImage(`./image/star2.png`);
  ctx = reflectImage2Canvas(
    ctx,
    imgStar,
    lengthStar,
    lengthStar,
    posH.sd.left - lengthStar / 2 - 30,
    headerHeight - lengthStar / 2,
  );
  ctx = reflectImage2Canvas(
    ctx,
    imgStar,
    lengthStar,
    lengthStar,
    posH.sd.right - lengthStar / 2 - 30,
    headerHeight - lengthStar / 2,
  );

  let posSide = [];
  let pos0 = [];

  await Promise.all(
    standings.map(async (team, index) => {
      //console.dir(team);
      let rank = 0;
      let ratioSpacing = 0;
      if (league == "five") {
        if (strRound == "QUALIFIER") {
          rank = team.rank;
          if (index < numTeamLeft) {
            posSide[index] = "left";
            pos0[index] = marginTop + index * spacing[posSide[index]];
          } else if (index >= numTeamLeft) {
            posSide[index] = "right";
            pos0[index] =
              marginTop + (index - numTeamLeft) * spacing[posSide[index]];
          }
          ratioSpacing = 0.4;
          ctx.globalAlpha = 0.6;
        } else if (strRound == "GROUP STAGE") {
          rank = team.rank_div;
          if (team.division == "a") {
            posSide[index] = "left";
          } else if (team.division == "b") {
            posSide[index] = "right";
          }
          pos0[index] =
            marginTop + (team.rank_div - 1) * spacing[posSide[index]];
          ratioSpacing = 0.3;
          ctx.globalAlpha = 0.5;
        }
      } else if (league == "j1") {
        rank = team.rank_div;
        if (team.division == "fist") {
          posSide[index] = "left";
        } else if (team.division == "cloak") {
          posSide[index] = "right";
        }
        pos0[index] = marginTop + (team.rank_div - 1) * spacing[posSide[index]];
        ratioSpacing = 0.4;
        ctx.globalAlpha = 0.7;
      }

      // black row back ground
      if (posSide[index] == "left") {
        ctx.fillStyle = config.rgb.black;
        ctx.beginPath();
        ctx.moveTo(
          pos.h371,
          pos0[index] - spacing[posSide[index]] * ratioSpacing,
        );
        ctx.lineTo(
          pos.h21,
          pos0[index] - spacing[posSide[index]] * ratioSpacing,
        );
        ctx.lineTo(
          pos.h31,
          pos0[index] + spacing[posSide[index]] * ratioSpacing,
        );
        ctx.lineTo(
          pos.h381,
          pos0[index] + spacing[posSide[index]] * ratioSpacing,
        );
      } else if (posSide[index] == "right") {
        ctx.fillStyle = config.rgb.black;
        ctx.beginPath();
        ctx.moveTo(
          pos.h32,
          pos0[index] - spacing[posSide[index]] * ratioSpacing,
        );
        ctx.lineTo(
          pos.h382,
          pos0[index] - spacing[posSide[index]] * ratioSpacing,
        );
        ctx.lineTo(
          pos.h372,
          pos0[index] + spacing[posSide[index]] * ratioSpacing,
        );
        ctx.lineTo(
          pos.h22,
          pos0[index] + spacing[posSide[index]] * ratioSpacing,
        );
      }
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // rank
      ctx.fillStyle = config.rgb.snowWhite;
      text = String(rank);
      setFont(ctx, config.canvasFontSize.smallMedium);
      ctx.fillText(text, posH.rank[posSide[index]], pos0[index]);

      // team logo
      const lengthLogo = spacing[posSide[index]] * 0.5;
      let dxA = posH.logo[posSide[index]] - lengthLogo / 2;
      let dyA = pos0[index] - lengthLogo * 0.5;
      try {
        const imgTeam = await Canvas.loadImage(
          `./image/teamLogo/${team.clan_abbr}.png`,
        );
        ctx = reflectImage2Canvas(
          ctx,
          imgTeam,
          lengthLogo,
          lengthLogo,
          dxA,
          dyA,
        );
      } catch (error) {
        const imgJwc = await Canvas.loadImage(`./image/JWC.png`);
        ctx = reflectImage2Canvas(
          ctx,
          imgJwc,
          lengthLogo,
          lengthLogo,
          dxA,
          dyA,
        );
      }

      // team abbr
      text = team.clan_abbr.toUpperCase();
      setFont(ctx, config.canvasFontSize.smallMedium);
      ctx.fillText(text, posH.teamName[posSide[index]], pos0[index]);

      // team name
      text = team.team_name.replace(/\\/g, "").replace(/‪⋆͛/g, "");
      let fontSizeTeamName = config.canvasFontSize.xxSmall;
      if (team.clan_abbr.includes("omi") || team.clan_abbr.includes("lily")) {
        setFont(ctx, fontSizeTeamName, FONTS.JP);
      } else {
        setFontJP(ctx, fontSizeTeamName);
      }
      ctx.fillText(
        text,
        posH.teamName[posSide[index]],
        pos0[index] + spacing[posSide[index]] * (ratioSpacing - 0.1),
      );

      let score = {};
      score = team.sumScore;

      text = `${score.nWin}-${score.nLoss}`;
      text += score.nTie == 0 ? "" : `-${score.nTie}`;
      setFont(ctx, config.canvasFontSize.smallMedium);
      ctx.fillText(text, posH.score[posSide[index]], pos0[index]);

      text =
        score.starDifference < 0
          ? `${score.starDifference}`
          : `+${score.starDifference}`;
      setFont(ctx, config.canvasFontSize.smallMedium);
      ctx.fillText(text, posH.sd[posSide[index]], pos0[index]);

      ctx.textAlign = "right";
      text = String(Math.round(score.clan.destruction * 10) / 10);
      setFont(ctx, config.canvasFontSize.xSmall);
      ctx.fillText(text, posH.dp[posSide[index]] + 25, pos0[index]);
      ctx.textAlign = "left";
      text = "%";
      setFont(ctx, config.canvasFontSize.xxxSmall);
      ctx.fillText(text, posH.dp[posSide[index]] + 25, pos0[index] + 5);

      ctxHitrate(
        ctx,
        score.clan.allAttackTypes,
        "total",
        posH.hitrate[posSide[index]],
        pos0[index],
        myFont,
        config.canvasFontSize.smallMedium,
        config.canvasFontSize.xSmall,
        15,
      );
      ctxTriples(
        ctx,
        score.clan.allAttackTypes,
        "total",
        posH.triple[posSide[index]],
        pos0[index],
        myFont,
        config.canvasFontSize.smallMedium,
        config.canvasFontSize.xSmall,
        config.rgb.snowWhite,
        10,
        0,
      );

      ctx.textAlign = "center";
      ctx.fillStyle = config.rgb.snowWhite;
    }),
  );

  if (strRound == "QUALIFIER") {
    let posAll = heightCanvas - 200;
    let statsLeague = {};
    statsLeague = leagueStats.stats.sumQ;

    ctxHitrate(
      ctx,
      statsLeague.allAttackTypes,
      "total",
      posH.hitrate.right,
      posAll,
      myFont,
      config.canvasFontSize.smallMedium,
      config.canvasFontSize.xSmall,
      15,
    );
    ctxTriples(
      ctx,
      statsLeague.allAttackTypes,
      "total",
      posH.triple.right,
      posAll,
      myFont,
      config.canvasFontSize.smallMedium,
      config.canvasFontSize.xSmall,
      config.rgb.snowWhite,
      10,
      0,
    );
  }

  // ***** 後処理 ***** //
  const pngData = await myCanvas.encode("png");

  const attachment = new AttachmentBuilder(pngData, {
    name: `standings_${league}.png`,
  });

  return attachment;
}
export { standingsLandscape };

function ctxHitrate(
  ctx,
  score,
  th,
  pos,
  pos0,
  myFont,
  fontSize,
  fontSizePercent,
  hMargin,
) {
  ctx.fillStyle = config.rgb.snowWhite;

  if (score) {
    ctx.textAlign = "right";
    let text = `${Math.round(score.hitrate[th])}`;
    setFont(ctx, fontSize, myFont);
    ctx.fillText(text, pos + hMargin, pos0);

    ctx.textAlign = "left";
    text = `%`;
    setFont(ctx, fontSizePercent, myFont);
    ctx.fillText(text, pos + hMargin, pos0 + 5);
  }

  return;
}

function ctxTriples(
  ctx,
  score,
  th,
  pos,
  pos0,
  myFont,
  fontSize,
  fontSize2,
  color,
  hMargin,
  vMargin,
) {
  ctx.fillStyle = color;

  if (score) {
    ctx.textAlign = "right";
    let text = `${score.nTriple[th]}`;
    setFont(ctx, fontSize, myFont);
    ctx.fillText(text, pos + hMargin, pos0 + vMargin);

    ctx.textAlign = "left";
    text = `/${score.nAt[th]}`;
    setFont(ctx, fontSize2, myFont);
    ctx.fillText(text, pos + hMargin, pos0 + vMargin + 5);
  }

  return;
}

async function legendStatsR1(client, mongoAcc, iDay) {
  const currentDate = new Date();
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(currentDate.getDate() + 1);

  const seasonData = functions.calculateSeasonValues(client, currentDate);

  let dayStats = {};
  const daysLength = mongoAcc.legend.days?.length ?? 0;
  if (daysLength == 0) {
    return { attachment: null, isPerfect: false };
  }

  const dayStatsNewest = mongoAcc.legend.days[0]; // 最新のデータ
  if (iDay == "current") {
    if (dayStatsNewest.day == seasonData.daysNow) {
      dayStats = dayStatsNewest;
    } else {
      // 最新のデータがまだ翌日
      return { attachment: null, isPerfect: false };
    }
  } else if (iDay == "previous") {
    if (daysLength == 1) {
      if (dayStatsNewest.day == seasonData.daysNow) {
        // 最新のデータが当日
        return { attachment: null, isPerfect: false };
      } else {
        // 最新のデータが前日
        dayStats = dayStatsNewest;
      }
    } else {
      if (dayStatsNewest.day == seasonData.daysNow) {
        // 最新のデータが当日
        dayStats = mongoAcc.legend.days[1];
      } else {
        // 最新のデータが前日
        dayStats = dayStatsNewest;
      }
    }
  }

  // ***** CANVAS ***** //
  const widthCanvas = 1920;
  const heightCanvas = 1600;
  let myCanvas = Canvas.createCanvas(widthCanvas, heightCanvas);
  let ctx = myCanvas.getContext("2d");

  const widthCenter = widthCanvas / 2;
  const heightCenter = heightCanvas / 2;

  // ***** background color ***** //
  ctx.beginPath();
  ctx.fillStyle = config.rgb.darkGray;
  ctx.fillRect(0, 0, widthCanvas, heightCanvas);

  // ***** background image ***** //
  let bgImage = null;
  if (mongoAcc.leagueTier.id == config_coc.leagueId.legend) {
    bgImage = await Canvas.loadImage("./image/bg/bgOrange.jpg");
  } else {
    bgImage = await Canvas.loadImage("./image/bg/bgBlue.png");
  }
  ctx.drawImage(bgImage, 0, 0, widthCanvas, heightCanvas);

  // ***** text & line color ***** //
  ctx.fillStyle = config.rgb.snowWhite;
  ctx.strokeStyle = config.rgb.snowWhite;

  // ***** Font ***** //
  const myFont = FONTS.MAIN;
  const myFontJP = FONTS.JP;
  const myFontSC = FONTS.SC;
  const myFontNumber = FONTS.NUMBER;

  // ***** Horizontal Position ***** //
  const h51 = widthCenter - (widthCanvas * 5) / 28;
  const h52 = widthCenter + (widthCanvas * 5) / 28;
  const h61 = widthCenter - (widthCanvas * 6) / 28;
  const h62 = widthCenter + (widthCanvas * 6) / 28;
  const h71 = widthCenter - (widthCanvas * 7) / 28;
  const h72 = widthCenter + (widthCanvas * 7) / 28;
  const h81 = widthCenter - (widthCanvas * 8) / 28;
  const h82 = widthCenter + (widthCanvas * 8) / 28;
  const h91 = widthCenter - (widthCanvas * 9) / 28;
  const h92 = widthCenter + (widthCanvas * 9) / 28;

  // ***** 中央上 ***** //
  ctx.textAlign = "center";
  let text = mongoAcc.leagueTier.name;
  setFont(ctx, fontSize.xxSmall, FONTS.SC);
  ctx.fillText(text, widthCenter, 100);

  const lengthLogoLegend = 200;
  const urlLogoLeague = mongoAcc.leagueTier.icon.url;
  const imgLogoLegend = await Canvas.loadImage(urlLogoLeague);
  ctx.drawImage(
    imgLogoLegend,
    widthCenter - lengthLogoLegend / 2,
    150,
    lengthLogoLegend,
    lengthLogoLegend,
  );

  text = "Start";
  setFont(ctx, fontSize.xxSmall);
  ctx.fillText(text, widthCenter, 500);

  let tophiesStart = 5000;
  if (!dayStats || dayStats.day != 1) {
    if (iDay == "current") {
      tophiesStart = mongoAcc.legend.current
        ? mongoAcc.legend.current.trophies
        : "no data";
    } else if (iDay == "previous") {
      tophiesStart =
        mongoAcc.legend.previousDay == null
          ? "?"
          : mongoAcc.legend.previousDay.trophies;
    }
  } else {
    tophiesStart = 5000;
  }
  text = String(tophiesStart);
  setFont(ctx, fontSize.xSmall, FONTS.SC);
  ctx.fillText(text, widthCenter, 580);

  text = iDay == "current" ? "Current" : "End";
  setFont(ctx, fontSize.xxSmall);
  ctx.fillText(text, widthCenter, 1000);

  if (dayStats) {
    text = String(dayStats.trophies);
  } else {
    text = String(mongoAcc.trophies);
  }
  setFont(ctx, fontSize.small, FONTS.SC, "bold");
  ctx.fillText(text, widthCenter, 1080);

  setFont(ctx, fontSize.xSmall, FONTS.SC, "bold");
  text = "Attacks";
  ctx.fillText(text, h71, 280);
  text = "Defenses";
  ctx.fillText(text, h72, 280);

  // ***** ATTACKS & DEFENSES ***** //
  const count = { attacks: 0, defenses: 0 };
  const sumDiffTrophies = { attacks: 0, defenses: 0 };
  if (dayStats) {
    const dayEvents = (mongoAcc.legend?.events ?? []).filter(
      (log) =>
        log.season === (dayStats.season || "") && log.day === dayStats.day,
    );

    setFont(ctx, fontSize.xSmall, FONTS.SC);

    // 攻撃と防衛を分離して処理
    const attackLogs = dayEvents.filter((log) => log.action === "attack");
    const defenseLogs = dayEvents.filter((log) => log.action === "defense");

    // 攻撃ログを処理
    await Promise.all(
      attackLogs.map(async (log, index) => {
        const posAttacksV = 400 + index * 100;
        await drawImageStars(
          ctx,
          functions.countStarsLegend(log.diffTrophies),
          h91,
          posAttacksV,
        );
        ctx.fillText(`+${log.diffTrophies}`, h51, posAttacksV);
        sumDiffTrophies.attacks += log.diffTrophies;
      }),
    );

    // 防衛ログを処理
    await Promise.all(
      defenseLogs.map(async (log, index) => {
        const posDefensesV = 400 + index * 100;
        await drawImageStars(
          ctx,
          functions.countStarsLegend(log.diffTrophies),
          h92,
          posDefensesV,
        );
        ctx.fillText(String(log.diffTrophies), h52, posDefensesV);
        sumDiffTrophies.defenses += log.diffTrophies;
      }),
    );

    // 攻撃と防衛の数を更新
    count.attacks = attackLogs.length;
    count.defenses = defenseLogs.length;

    // 合計値を表示
    setFont(ctx, fontSize.small, FONTS.SC, "bold");
    ctx.fillText(`+${sumDiffTrophies.attacks}`, h71, 1250);
    ctx.fillText(String(sumDiffTrophies.defenses), h72, 1250);

    // パーフェクトメッセージ（攻撃合計が320の場合）
    if (sumDiffTrophies.attacks === 320) {
      setFont(ctx, fontSize.smallMedium, FONTS.SC, "bold");
      ctx.fillStyle = config.rgb.gold;
      ctx.fillText("PERFECT DAY!", h71, 1350);
      ctx.fillStyle = config.rgb.snowWhite;
    }
  }

  // ***** TOTAL ***** //
  setFont(ctx, fontSize.medium, FONTS.SC, "bold");
  let totalDiffTrophies = sumDiffTrophies.attacks + sumDiffTrophies.defenses;
  text =
    totalDiffTrophies < 0 ? String(totalDiffTrophies) : "+" + totalDiffTrophies;
  ctx.fillText(text, widthCenter, 1250);

  // ***** 中央下 ***** //
  const lengthLogoJwc = 100;
  const imgJwcLogo = await Canvas.loadImage("./image/JWC.png");
  ctx.drawImage(
    imgJwcLogo,
    widthCenter - lengthLogoJwc / 2,
    heightCanvas - 200,
    lengthLogoJwc,
    lengthLogoJwc,
  );

  setFont(ctx, fontSize.xxxSmall);
  text = `designed by JWC bot with Supercell`;
  ctx.fillText(text, widthCenter, heightCanvas - 50);

  // ***** 左下 ***** //
  if (dayStats) {
    text = `Day ${dayStats.day}`;
    setFont(ctx, fontSize.xSmall, FONTS.SC, "bold");
    ctx.fillText(text, h71, heightCanvas - 170);
    text = `${dayStats.season || "Unknown"} Season`;
    setFontJP(ctx, fontSize.xxSmall, FONTS.SC);
    ctx.fillText(text, h71, heightCanvas - 100);
  } else {
    text = `Day ${seasonData.daysNow}`;
    setFont(ctx, fontSize.xSmall, FONTS.SC, "bold");
    ctx.fillText(text, h71, heightCanvas - 170);
    text = `${seasonData.seasonId} Season`;
    setFontJP(ctx, fontSize.xxSmall, FONTS.SC);
    ctx.fillText(text, h71, heightCanvas - 100);
  }

  // ***** 右下 ***** //
  text = mongoAcc.name;
  setFontJP(ctx, fontSize.xSmall, FONTS.SC, "bold");
  ctx.fillText(text, h72, heightCanvas - 170);
  let textPilot;
  if (mongoAcc.pilotDC) {
    textPilot = mongoAcc.pilotDC.globalName ?? mongoAcc.pilotDC.username;
  } else {
    textPilot = "UNKNOWN";
  }
  setFontJP(ctx, fontSize.xxSmall, FONTS.MAIN, "bold");
  ctx.fillText(textPilot, h72, heightCanvas - 100);

  // ***** 後処理 ***** //
  const pngData = await myCanvas.encode("png");

  const attachment = new AttachmentBuilder(pngData, {
    name: "warProgress.png",
  });

  // パーフェクトフラグを返す
  const isPerfect = sumDiffTrophies.attacks === 320;

  return { attachment, isPerfect, dayStats };

  /*
  const imgWorld = await Canvas.loadImage('./image/dot-world-map.png');
  const widthWorld = imgWorld.width;
  const heightWorld = imgWorld.height;
  const imgWorldScale = 0.2;
  ctx.drawImage(imgWorld, widthCenter - widthWorld * imgWorldScale / 2, 660, widthWorld * imgWorldScale, heightWorld * imgWorldScale);
  text = 'Rank';
  setFont(ctx, fontSize.xxSmall);
  ctx.fillText(text, widthCenter, 700);
  text = String(mongoAcc.legend.current.rank);
  setFont(ctx, fontSize.small, FONTS.SC);
  ctx.fillText(text, widthCenter, 780);
  */
}
export { legendStatsR1 };

async function drawImageStars(ctx, stars, posH, posV) {
  if (stars < 0) {
    return;
  }
  let imgStars = "";
  if (stars == 3) {
    imgStars = await Canvas.loadImage("./image/iconStars3.png");
  } else if (stars == 2) {
    imgStars = await Canvas.loadImage("./image/iconStars2.png");
  } else if (stars == 1) {
    imgStars = await Canvas.loadImage("./image/iconStars1.png");
  } else if (stars == 0) {
    imgStars = await Canvas.loadImage("./image/iconStars0.png");
  }
  const ratio = 0.5;
  const posImageH = posH - (300 * ratio) / 2;
  const posImageV = posV - (130 * ratio) / 1.4;
  ctx.drawImage(imgStars, posImageH, posImageV, 300 * ratio, 130 * ratio);

  return;
}

async function legendHistory(mongoAcc) {
  // ***** CANVAS ***** //
  const widthCanvas = 1920;
  const heightCanvas = 2880;
  let myCanvas = Canvas.createCanvas(widthCanvas, heightCanvas);
  let ctx = myCanvas.getContext("2d");

  // ***** ヘルパー関数 ***** //
  function setTextStyle(font, color, align = "center", baseline = "middle") {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
  }

  function drawTextWithShadow(
    text,
    x,
    y,
    shadowColor = config.rgb.discordBlack,
    shadowBlur = 4,
    shadowOffsetY = 2,
  ) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = shadowOffsetY;
    ctx.fillText(text, x, y);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  const widthCenter = widthCanvas / 2;
  const heightCenter = heightCanvas / 2;

  // ***** Chart ***** //
  const marginTopChart = 450;
  const marginBottomChart = 300;
  const heightChart = heightCanvas - marginTopChart - marginBottomChart;
  const marginLeftChart = 100;
  const marginRightChart = 100;
  const widthChart = widthCanvas - marginLeftChart - marginRightChart;

  // ***** background color ***** //
  //ctx.beginPath();
  //ctx.fillStyle = config.rgb.darkPurple;
  //ctx.fillRect(0, 0, widthCanvas, heightCanvas);

  // ***** background image ***** //
  const bgImage = await Canvas.loadImage("./image/bg/bgOrange.jpg");
  ctx.drawImage(bgImage, 0, 0, widthCanvas, heightCanvas);

  // ***** text & line color ***** //
  ctx.fillStyle = config.rgb.snowWhite;
  ctx.strokeStyle = config.rgb.snowWhite;

  // ***** Font ***** //
  const myFont = FONTS.MAIN;
  const myFontJP = FONTS.JP;
  const myFontSC = FONTS.SC;
  const myFontNumber = FONTS.NUMBER;

  // ***** Horizontal Position ***** //
  const h51 = widthCenter - (widthCanvas * 5) / 28;
  const h52 = widthCenter + (widthCanvas * 5) / 28;
  const h61 = widthCenter - (widthCanvas * 6) / 28;
  const h62 = widthCenter + (widthCanvas * 6) / 28;
  const h71 = widthCenter - (widthCanvas * 7) / 28;
  const h72 = widthCenter + (widthCanvas * 7) / 28;
  const h81 = widthCenter - (widthCanvas * 8) / 28;
  const h82 = widthCenter + (widthCanvas * 8) / 28;
  const h91 = widthCenter - (widthCanvas * 9) / 28;
  const h92 = widthCenter + (widthCanvas * 9) / 28;

  // ***** 中央上 ***** //
  ctx.save();
  setFontJP(ctx, config.canvasFontSize.xxSmall, FONTS.SC);
  ctx.fillStyle = config.rgb.snowWhite;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let text = "LEGEND HISTORY";
  ctx.lineWidth = 1;
  ctx.strokeStyle = config.rgb.orange.default;
  ctx.strokeText(text, widthCenter, 100);
  drawTextWithShadow(text, widthCenter, 100, config.rgb.discordBlack, 6, 2);
  ctx.restore();

  const lengthLogoLegend = 200;
  const urlLogoLeague = mongoAcc.leagueTier.icon.url;
  const imgLogoLegend = await Canvas.loadImage(urlLogoLeague);
  ctx.drawImage(
    imgLogoLegend,
    widthCenter - lengthLogoLegend / 2,
    150,
    lengthLogoLegend,
    lengthLogoLegend,
  );

  // ***** トロフィー表示 ***** //
  ctx.save();
  ctx.fillStyle = config.rgb.snowWhite;
  ctx.textBaseline = "bottom";

  setFontJP(ctx, config.canvasFontSize.xxxSmall, FONTS.SC);
  ctx.textAlign = "right";
  drawTextWithShadow("LAST DAY", h82 - 30, 190);

  setFontJP(ctx, config.canvasFontSize.xSmall, FONTS.SC);
  ctx.textAlign = "left";
  drawTextWithShadow(String(mongoAcc.trophies), h82, 200);

  setFontJP(ctx, config.canvasFontSize.xxSmall, FONTS.SC);
  ctx.textAlign = "right";
  drawTextWithShadow("CURRENT", h82 - 30, 290);

  setFontJP(ctx, config.canvasFontSize.small, FONTS.SC, "bold");
  ctx.textAlign = "left";
  drawTextWithShadow(String(mongoAcc.legend.days[0].trophies), h82, 300);
  ctx.restore();

  // ***** 中央下 ***** //
  const lengthLogoJwc = 100;
  const imgJwcLogo = await Canvas.loadImage("./image/JWC.png");
  ctx.drawImage(
    imgJwcLogo,
    widthCenter - lengthLogoJwc / 2,
    heightCanvas - 200,
    lengthLogoJwc,
    lengthLogoJwc,
  );

  ctx.save();
  setFontJP(ctx, config.canvasFontSize.xxxSmall, FONTS.MAIN);
  ctx.fillStyle = config.rgb.snowWhite;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawTextWithShadow(
    "designed by JWC bot with Supercell",
    widthCenter,
    heightCanvas - 50,
  );
  ctx.restore();

  // 事前に全期間のdaysをソート（昇順）
  let legendDaysSorted = [...mongoAcc.legend.days].sort((a, b) => {
    if (a.season !== b.season) {
      // seasonがundefinedまたはnullの場合の安全な処理
      const seasonA = a.season || "";
      const seasonB = b.season || "";
      return seasonA.localeCompare(seasonB);
    }
    return a.day - b.day;
  });

  // データ準備（直近10日を取得）
  const last10 = legendDaysSorted.slice(-10);
  let sumAttacks10 = 0;
  let sumDefenses10 = 0;
  let sumTriples10 = 0;
  let sumDefTriples10 = 0;
  last10.forEach((d) => {
    sumAttacks10 += Number(d.attacks || 0);
    sumDefenses10 += Number(d.defenses || 0);
    sumTriples10 += Number(d.triples || 0);
    sumDefTriples10 += Number(d.defTriples || 0);
  });
  const rateAttack =
    sumAttacks10 > 0
      ? Math.round((sumTriples10 / sumAttacks10) * 1000) / 10
      : 0;
  const rateDefense =
    sumDefenses10 > 0
      ? Math.round((sumDefTriples10 / sumDefenses10) * 1000) / 10
      : 0;

  // ※ サマリーの描画は四つのグラフ配置後、最下段に行う（座標は後段で計算）

  // ***** 左下 ***** //
  ctx.save();
  ctx.fillStyle = config.rgb.snowWhite;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  setFontJP(ctx, fontSize.xSmall, FONTS.SC, "bold");
  drawTextWithShadow(mongoAcc.name, h71, heightCanvas - 170);
  if (mongoAcc.pilotDC) {
    setFontJP(ctx, fontSize.xxSmall, FONTS.MAIN, "bold");
    drawTextWithShadow(
      mongoAcc.pilotDC.globalName ?? mongoAcc.pilotDC.username,
      h71,
      heightCanvas - 100,
    );
  }
  ctx.restore();

  // ***** 右下 ***** //
  ctx.save();
  setFontJP(ctx, fontSize.xxSmall, FONTS.SC, "bold");
  ctx.fillStyle = config.rgb.snowWhite;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (mongoAcc.leagueTier.id == config_coc.leagueId.legend) {
    drawTextWithShadow(
      `${mongoAcc.legend.days[0].season || "Unknown"} SEASON`,
      h72,
      heightCanvas - 170,
    );
  } else {
    drawTextWithShadow(
      "Not in Legend League",
      h72,
      heightCanvas - 170,
      config.rgb.discordBlack,
      6,
      2,
    );
  }
  ctx.restore();

  // ***** Font for Chart ***** //
  const fontChartString = {
    family: "Helvetica Neue",
    size: 24,
  };
  const fontChartNumber = {
    family: "Helvetica Neue",
    size: 20,
  };

  let chartLabels = [];
  for (let i = 0; i < 40; i++) {
    chartLabels.push(String(40 - i - 1));
  }

  // ***** Chart Data Points ***** //
  let cdpTrophies = [];
  let cdpAttacks = [];
  let cdpDefenses = [];
  let cdpTriples = [];
  let cdpDefTriples = [];
  let cdpAtkTrophies = [];
  let cdpDefTrophies = [];
  let cdpDiffTrophies = [];

  if (mongoAcc.legend.days.length <= 40) {
    for (let i = 0; i < 40 - mongoAcc.legend.days.length; i++) {
      cdpAttacks.push("NaN");
      cdpDefenses.push("NaN");
      cdpTriples.push("NaN");
      cdpDefTriples.push("NaN");
      cdpTrophies.push("NaN");
      cdpAtkTrophies.push("NaN");
      cdpDefTrophies.push("NaN");
      cdpDiffTrophies.push("NaN");
    }
  }

  // ***** Get Data for Chart ***** //
  let maxTrophies = 0;
  let minTrophies = 7000;
  // 既に上でソート済みの legendDaysSorted を再利用
  // 最後の40件（過去→現在順のうち最新40日）を取得
  let legendDaysLast40 = legendDaysSorted.slice(-40);

  legendDaysLast40.forEach((object, index) => {
    cdpAttacks.push(object.attacks);
    cdpDefenses.push(object.defenses);
    cdpTriples.push(object.triples);
    cdpDefTriples.push(object.defTriples || 0);
    cdpTrophies.push(object.trophies);
    cdpAtkTrophies.push(object.attackTrophies || 0);
    cdpDefTrophies.push(object.defenseTrophies || 0); // 既に負の値
    cdpDiffTrophies.push(object.diffTrophies || 0);
    if (object.trophies > maxTrophies) {
      maxTrophies = object.trophies;
    }
    if (object.trophies < minTrophies) {
      minTrophies = object.trophies;
    }
  });

  let minYscale = 5000;
  if (minTrophies < 5000) {
    minYscale = Math.floor(minTrophies / 1000) * 1000;
  }
  let maxYscale = 6000;
  if (maxTrophies > 6000) {
    maxYscale = 6500;
  } else if (maxTrophies < 2000) {
    maxYscale = 2000;
  } else if (maxTrophies < 5000) {
    maxYscale = Math.ceil(maxTrophies / 1000) * 1000;
  }

  // Trophies（線）
  const chartDataLine = {
    labels: chartLabels,
    datasets: [
      {
        label: "Trophies",
        data: cdpTrophies,
        fill: true,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const canvasCtx = chart.ctx;
          const chartArea = chart.chartArea;
          if (!chartArea) {
            return null;
          }
          const gradient = canvasCtx.createLinearGradient(
            0,
            chartArea.top,
            0,
            chartArea.bottom,
          );
          gradient.addColorStop(0, config.rgb.orange.four);
          gradient.addColorStop(1, config.rgb.orange.zero);
          return gradient;
        },
        pointStyle: "rectRot",
        pointRadius: 5,
        pointBorderColor: config.rgb.discordBlack,
        pointBackgroundColor: config.rgb.orange.default,
        borderWidth: 1,
        borderColor: config.rgb.orange.default,
        yAxisID: "y",
        type: "line",
      },
    ],
  };

  const chartOptionsLine = {
    scales: {
      x: {
        beginAtZero: true,
        ticks: { font: fontChartNumber, color: config.rgb.silverWhite },
        border: { color: config.rgb.silverWhite },
        title: {
          display: true,
          text: "Days ago",
          font: fontChartString,
          color: config.rgb.silverWhite,
        },
      },
      y: {
        position: "left",
        beginAtZero: false,
        max: maxYscale,
        min: minYscale,
        //ticks: { font: fontChartNumber, color: config.rgb.silverWhite, autoSkip: true, maxTicksLimit: 5 },
        ticks: {
          font: fontChartNumber,
          color: config.rgb.silverWhite,
          stepSize: 100,
        },
        border: { color: config.rgb.silverWhite },
        title: {
          display: true,
          text: "Trophies",
          font: fontChartString,
          color: config.rgb.silverWhite,
        },
        grid: {
          color: "rgba(255,255,255,0.2)",
          lineWidth: 0.5,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
        labels: {
          usePointStyle: true,
          font: fontChartString,
          color: config.rgb.silverWhite,
          padding: 15,
        },
      },
    },
  };

  // 攻撃/防衛トロフィーの積み上げ棒（上下対称）
  // diffTrophies（= 攻撃 + 防衛）の折れ線を重ねる
  const chartDataStack = {
    labels: chartLabels,
    datasets: [
      {
        label: "Attack Trophies",
        data: cdpAtkTrophies,
        type: "bar",
        backgroundColor: config.rgb.orange.four,
        yAxisID: "y",
        stack: "trophiesStack",
        borderSkipped: false,
        order: 2,
      },
      {
        label: "Defense Trophies",
        data: cdpDefTrophies,
        type: "bar",
        backgroundColor: config.rgb.gray.half,
        yAxisID: "y",
        stack: "trophiesStack",
        borderSkipped: false,
        order: 2,
      },
      {
        label: "Diff Trophies",
        data: cdpDiffTrophies,
        type: "line",
        pointStyle: "rectRot",
        pointRadius: 5,
        pointBorderColor: config.rgb.discordBlack,
        pointBackgroundColor: config.rgb.orange.default,
        borderWidth: 1,
        borderColor: config.rgb.orange.default,
        yAxisID: "y",
        order: 1,
      },
    ],
  };

  const chartOptionsStack = {
    scales: {
      x: {
        beginAtZero: true,
        ticks: { font: fontChartNumber, color: config.rgb.silverWhite },
        border: { color: config.rgb.silverWhite },
        title: {
          display: true,
          text: "Days ago",
          font: fontChartString,
          color: config.rgb.silverWhite,
        },
        stacked: true,
      },
      y: {
        beginAtZero: false,
        min: -320,
        max: 320,
        ticks: {
          font: fontChartNumber,
          color: config.rgb.silverWhite,
          stepSize: 80,
        },
        border: { color: config.rgb.silverWhite },
        title: {
          display: true,
          text: "Trophies Gained / Lost",
          font: fontChartString,
          color: config.rgb.silverWhite,
        },
        stacked: true,
        grid: {
          color: (ctx) =>
            ctx.tick && ctx.tick.value === 0
              ? "rgba(255,255,255,0.4)"
              : "rgba(255,255,255,0.2)",
          lineWidth: (ctx) => (ctx.tick && ctx.tick.value === 0 ? 1.5 : 0.5),
        },
      },
    },
    plugins: {
      legend: {
        display: false,
        labels: {
          usePointStyle: true,
          font: fontChartString,
          color: config.rgb.silverWhite,
          padding: 15,
        },
      },
    },
  };

  // Triples/Defense Tripled（棒）
  const chartDataBars = {
    labels: chartLabels,
    datasets: [
      {
        label: "Triples",
        data: cdpTriples,
        fill: true,
        backgroundColor: config.rgb.darkOrange,
        yAxisID: "y",
        type: "bar",
        categoryPercentage: 0.2,
      },
      {
        label: "Def Triples",
        data: cdpDefTriples,
        fill: true,
        backgroundColor: config.rgb.gray150,
        yAxisID: "y",
        type: "bar",
        categoryPercentage: 0.2,
      },
    ],
  };

  const chartOptionsBars = {
    scales: {
      x: {
        beginAtZero: true,
        ticks: { font: fontChartNumber, color: config.rgb.silverWhite },
        border: { color: config.rgb.silverWhite },
        title: {
          display: true,
          text: "Days ago",
          font: fontChartString,
          color: config.rgb.silverWhite,
        },
      },
      y: {
        position: "left",
        beginAtZero: true,
        max: 8,
        ticks: {
          font: fontChartNumber,
          color: config.rgb.silverWhite,
          stepSize: 4,
        },
        border: { color: config.rgb.silverWhite },
        title: {
          display: true,
          text: "Triples / Def Triples",
          font: fontChartString,
          color: config.rgb.silverWhite,
        },
        grid: {
          color: "rgba(255,255,255,0.2)",
          lineWidth: 0.5,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
        labels: {
          usePointStyle: true,
          font: fontChartString,
          color: config.rgb.silverWhite,
          padding: 15,
        },
      },
    },
  };

  // attacks / defenses（棒）
  const chartDataBarsAD = {
    labels: chartLabels,
    datasets: [
      {
        label: "Attacks",
        data: cdpAttacks,
        fill: true,
        backgroundColor: config.rgb.darkOrange,
        yAxisID: "y",
        type: "bar",
        categoryPercentage: 0.2,
      },
      {
        label: "Defenses",
        data: cdpDefenses,
        fill: true,
        backgroundColor: config.rgb.gray150,
        yAxisID: "y",
        type: "bar",
        categoryPercentage: 0.2,
      },
    ],
  };

  const chartOptionsBarsAD = {
    scales: {
      x: {
        beginAtZero: true,
        ticks: { font: fontChartNumber, color: config.rgb.silverWhite },
        border: { color: config.rgb.silverWhite },
        title: {
          display: true,
          text: "Days ago",
          font: fontChartString,
          color: config.rgb.silverWhite,
        },
      },
      y: {
        position: "left",
        beginAtZero: true,
        max: 8,
        ticks: {
          font: fontChartNumber,
          color: config.rgb.silverWhite,
          stepSize: 4,
        },
        border: { color: config.rgb.silverWhite },
        title: {
          display: true,
          text: "Attacks / Defenses",
          font: fontChartString,
          color: config.rgb.silverWhite,
        },
        grid: {
          color: "rgba(255,255,255,0.2)",
          lineWidth: 0.5,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
        labels: {
          usePointStyle: true,
          font: fontChartString,
          color: config.rgb.silverWhite,
          padding: 15,
        },
      },
    },
  };

  const yTopLine = 300; // Trophies（線）
  const yTopStack = 850; // 攻防トロフィーの積み上げ
  const yTopBars = 1300; // Triples/Defense（棒）
  const yTopBarsAD = 1650; // Attacks/Defenses（棒）
  const heightLine = 500;
  const heightStack = 400;
  const heightBars = 300;
  const heightBarsAD = 300;
  const chartBars = new ChartJSNodeCanvas({
    width: widthChart - 15,
    height: heightBars,
  });
  const chartLine = new ChartJSNodeCanvas({
    width: widthChart,
    height: heightLine,
  });
  const chartStack = new ChartJSNodeCanvas({
    width: widthChart - 35,
    height: heightStack,
  });
  const chartBarsAD = new ChartJSNodeCanvas({
    width: widthChart - 35,
    height: heightBarsAD,
  });

  const configurationBars = {
    type: "bar",
    data: chartDataBars,
    options: chartOptionsBars,
  };
  const configurationLine = {
    type: "line",
    data: chartDataLine,
    options: chartOptionsLine,
  };
  const configurationStack = {
    type: "bar",
    data: chartDataStack,
    options: chartOptionsStack,
  };
  const configurationBarsAD = {
    type: "bar",
    data: chartDataBarsAD,
    options: chartOptionsBarsAD,
  };

  const urlChartBars = await chartBars.renderToDataURL(configurationBars);
  const urlChartLine = await chartLine.renderToDataURL(configurationLine);
  const urlChartStack = await chartStack.renderToDataURL(configurationStack);
  const urlChartBarsAD = await chartBarsAD.renderToDataURL(configurationBarsAD);

  const imgChartBars = await Canvas.loadImage(urlChartBars);
  const imgChartLine = await Canvas.loadImage(urlChartLine);
  const imgChartStack = await Canvas.loadImage(urlChartStack);
  const imgChartBarsAD = await Canvas.loadImage(urlChartBarsAD);

  ctx.drawImage(
    imgChartLine,
    marginLeftChart + 10,
    yTopLine,
    widthChart - 15,
    heightLine,
  );
  ctx.drawImage(
    imgChartStack,
    marginLeftChart,
    yTopStack,
    widthChart,
    heightStack,
  );
  ctx.drawImage(
    imgChartBars,
    marginLeftChart + 35,
    yTopBars,
    widthChart - 35,
    heightBars,
  );
  ctx.drawImage(
    imgChartBarsAD,
    marginLeftChart + 35,
    yTopBarsAD,
    widthChart - 35,
    heightBarsAD,
  );

  // ***** Summary (last 10 days) を最下段に描画 ***** //
  const summaryTop = yTopBarsAD + heightBarsAD + 100; // 最下段グラフの下に余白を空けて配置
  const summaryBottom = summaryTop + 500;
  const summaryHeight = summaryBottom - summaryTop;

  // 背景薄枠（透過にする）
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = config.rgb.discordBlack;
  ctx.fillRect(
    marginLeftChart + 200,
    summaryTop,
    widthChart - 350,
    summaryHeight,
  );
  ctx.restore();

  const xCenter = marginLeftChart + widthChart / 2;

  // サマリー部分の描画
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let yCursor = summaryTop + 100;
  setFontJP(ctx, config.canvasFontSize.xSmall, FONTS.SC);
  ctx.fillStyle = config.rgb.darkOrange;
  ctx.fillText("LAST 10 DAYS", xCenter, yCursor);

  yCursor += 50;
  setFontJP(ctx, config.canvasFontSize.xxSmall, FONTS.SC);
  ctx.fillText("ATTACKS", h71, yCursor);
  ctx.fillText("DEFENSES", h72, yCursor);

  yCursor += 100;
  setFontJP(ctx, config.canvasFontSize.xxSmall, FONTS.SC);
  ctx.fillStyle = config.rgb.darkOrange;
  ctx.fillText("TRIPLES / DEF TRIPLES", xCenter, yCursor);
  setFontJP(ctx, config.canvasFontSize.xSmall, FONTS.SC, "bold");
  ctx.fillStyle = config.rgb.silverWhite;
  ctx.fillText(String(sumTriples10), h71, yCursor);
  ctx.fillText(String(sumDefTriples10), h72, yCursor);

  yCursor += 100;
  setFontJP(ctx, config.canvasFontSize.xxSmall, FONTS.SC);
  ctx.fillStyle = config.rgb.darkOrange;
  ctx.fillText("N OF ATTACKS / DEFENSES", xCenter, yCursor);
  setFontJP(ctx, config.canvasFontSize.xxSmall, FONTS.SC);
  ctx.fillStyle = config.rgb.silverWhite;
  ctx.fillText(String(sumAttacks10), h71, yCursor);
  ctx.fillText(String(sumDefenses10), h72, yCursor);

  yCursor += 100;
  setFontJP(ctx, config.canvasFontSize.xxSmall, FONTS.SC);
  ctx.fillStyle = config.rgb.darkOrange;
  ctx.fillText("RATE", xCenter, yCursor);
  setFontJP(ctx, config.canvasFontSize.xSmall, FONTS.SC, "bold");
  ctx.fillStyle = config.rgb.silverWhite;
  ctx.textAlign = "right";
  ctx.fillText(`${rateAttack}`, h71 + 30, yCursor);
  ctx.fillText(`${rateDefense}`, h72 + 30, yCursor);
  setFontJP(ctx, config.canvasFontSize.xxSmall, FONTS.SC);
  ctx.textAlign = "left";
  ctx.fillText(`%`, h71 + 30, yCursor);
  ctx.fillText(`%`, h72 + 30, yCursor);
  ctx.restore();

  const pngData = await myCanvas.encode("png");

  const attachment = new AttachmentBuilder(pngData, {
    name: "legendHistory.png",
  });

  return attachment;
}
export { legendHistory };

async function warProgress(mongoWar) {
  const league = mongoWar.league;

  let chartData = {};
  let chartOptions = {};

  // ***** Chart Data Points ***** //
  let cdpStars = [[0], [0]];
  let cdpDestruction = [[0], [0]];
  let cdpAverageDestruction = { clan: ["NaN"], opponent: ["NaN"] };
  let cdpTriples = [[0], [0]];
  let cdpHitrate = { clan: ["NaN"], opponent: ["NaN"] };
  let chartLabels = [0];

  // ***** Font for Chart ***** //
  const fontChartString = {
    family: "Helvetica Neue",
    size: 24,
  };
  const fontChartNumber = {
    family: "Helvetica Neue",
    size: 20,
  };

  let oneStar = [0, 0];
  let zeroStar = [0, 0];

  // ***** Get Data for Chart ***** //
  const processAttackData = (attack, teamIndex) => {
    const newStars = attack.arrStarsFlag.filter(
      (element) => element === 2,
    ).length;
    const lastStars = Number(
      cdpStars[teamIndex][cdpStars[teamIndex].length - 1],
    );
    const lastDestruction = Number(
      cdpDestruction[teamIndex][cdpDestruction[teamIndex].length - 1],
    );
    const lastTriples = Number(
      cdpTriples[teamIndex][cdpTriples[teamIndex].length - 1],
    );

    // スター数を更新
    cdpStars[teamIndex].push(lastStars + newStars);

    // 破壊率を更新
    cdpDestruction[teamIndex].push(lastDestruction + attack.destruction);

    // 平均破壊率を計算
    const avgDestruction =
      lastDestruction / (cdpDestruction[teamIndex].length - 1);
    const targetKey = teamIndex === 0 ? "clan" : "opponent";
    cdpAverageDestruction[targetKey].push(avgDestruction);

    // トリプル数を更新
    let triples = lastTriples;
    if (attack.stars === 3) {
      triples += 1;
    } else if (attack.stars === 1) {
      oneStar[teamIndex] += 1;
    } else if (attack.stars === 0) {
      zeroStar[teamIndex] += 1;
    }
    cdpTriples[teamIndex].push(triples);

    // ヒット率を計算
    const hitRate = (triples / (cdpTriples[teamIndex].length - 1)) * 100;
    cdpHitrate[targetKey].push(hitRate);
  };

  if (mongoWar.result?.arrAttacksPlus) {
    mongoWar.result.arrAttacksPlus
      .filter((attack) => attack.attackType !== "remaining")
      .forEach((attack) => {
        if (attack.action === "attack") {
          processAttackData(attack, 0);
        } else if (attack.action === "defense") {
          processAttackData(attack, 1);
        }
      });
  }

  if (config.nHit[league] == 1) {
    const pointRadius = { circle: 10, triangle: 16, rect: 14, rectRot: 15 };
    for (let i = 0; i < mongoWar.result.size; i++) {
      chartLabels.push((i + 1).toString());
    }
    chartData = {
      labels: chartLabels,
      datasets: [
        {
          label: `Stars [${mongoWar.clan_abbr.toUpperCase()}]`,
          data: cdpStars[0],
          fill: false,
          pointStyle: "circle",
          pointRadius: pointRadius.circle,
          borderDash: [15, 20],
          borderColor: config.rgb.orange.default,
          backgroundColor: config.rgb.orange.default,
          pointBorderColor: config.rgb.discordBlack,
          cubicInterpolationMode: "monotone",
          yAxisID: "y",
        },
        {
          label: `Stars [${mongoWar.opponent_abbr.toUpperCase()}]`,
          data: cdpStars[1],
          fill: false,
          pointStyle: "circle",
          pointRadius: pointRadius.circle,
          borderDash: [15, 20],
          borderColor: config.rgb.blue,
          backgroundColor: config.rgb.blue,
          pointBorderColor: config.rgb.discordBlack,
          cubicInterpolationMode: "monotone",
          yAxisID: "y",
        },
        {
          label: `Average Destruction [${mongoWar.clan_abbr.toUpperCase()}]`,
          data: cdpAverageDestruction.clan,
          fill: false,
          pointStyle: "rect",
          pointRadius: pointRadius.rect,
          borderDash: [15, 20],
          borderColor: config.rgb.darkOrange,
          backgroundColor: config.rgb.darkOrange,
          pointBorderColor: config.rgb.discordBlack,
          cubicInterpolationMode: "monotone",
          yAxisID: "y2",
        },
        {
          label: `Average Destruction [${mongoWar.opponent_abbr.toUpperCase()}]`,
          data: cdpAverageDestruction.opponent,
          fill: false,
          pointStyle: "rect",
          pointRadius: pointRadius.rect,
          borderDash: [15, 20],
          borderColor: config.rgb.darkBlue,
          backgroundColor: config.rgb.darkBlue,
          pointBorderColor: config.rgb.discordBlack,
          cubicInterpolationMode: "monotone",
          yAxisID: "y2",
        },
      ],
    };
    chartOptions = {
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            font: fontChartNumber,
            color: config.rgb.silverWhite,
          },
          border: {
            color: config.rgb.silverWhite,
          },
          title: {
            display: true,
            text: "Attacks used",
            font: fontChartString,
            color: config.rgb.silverWhite,
          },
        },
        y: {
          position: "left",
          beginAtZero: true,
          max: 3 * mongoWar.result.size + 3,
          ticks: {
            font: fontChartNumber,
            color: config.rgb.silverWhite,
          },
          border: {
            color: config.rgb.silverWhite,
          },
          title: {
            display: true,
            text: "Total Stars",
            font: fontChartString,
            color: config.rgb.silverWhite,
          },
        },
        y2: {
          position: "right",
          beginAtZero: true,
          max: 110,
          ticks: {
            font: fontChartNumber,
            color: config.rgb.silverWhite,
          },
          border: {
            color: config.rgb.silverWhite,
          },
          title: {
            display: true,
            text: "Average Destruction",
            font: fontChartString,
            color: config.rgb.silverWhite,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
          labels: {
            usePointStyle: true,
            font: fontChartString,
            color: config.rgb.silverWhite,
            padding: 15,
          },
        },
      },
    };
  } else if (config.nHit[league] == 2) {
    const pointRadius = { circle: 7, triangle: 12, rect: 10, rectRot: 11 };
    for (let i = 0; i < 2 * mongoWar.result.size; i++) {
      chartLabels.push((i + 1).toString());
    }
    chartData = {
      labels: chartLabels,
      datasets: [
        {
          label: `Stars [${mongoWar.clan_abbr.toUpperCase()}]`,
          data: cdpStars[0],
          fill: false,
          pointStyle: "circle",
          pointRadius: pointRadius.circle,
          borderDash: [10, 15],
          borderColor: config.rgb.orange.default,
          backgroundColor: config.rgb.orange.default,
          pointBorderColor: config.rgb.discordBlack,
          cubicInterpolationMode: "monotone",
          yAxisID: "y",
        },
        {
          label: `Stars [${mongoWar.opponent_abbr.toUpperCase()}]`,
          data: cdpStars[1],
          fill: false,
          pointStyle: "circle",
          pointRadius: pointRadius.circle,
          borderDash: [10, 15],
          borderColor: config.rgb.blue,
          backgroundColor: config.rgb.blue,
          pointBorderColor: config.rgb.discordBlack,
          cubicInterpolationMode: "monotone",
          yAxisID: "y",
        },
        {
          label: `Hitrate [${mongoWar.clan_abbr.toUpperCase()}]`,
          data: cdpHitrate.clan,
          fill: false,
          pointStyle: "rect",
          pointRadius: pointRadius.rect,
          borderDash: [10, 15],
          borderColor: config.rgb.darkOrange,
          backgroundColor: config.rgb.darkOrange,
          pointBorderColor: config.rgb.discordBlack,
          cubicInterpolationMode: "monotone",
          yAxisID: "y2",
        },
        {
          label: `Hitrate [${mongoWar.opponent_abbr.toUpperCase()}]`,
          data: cdpHitrate.opponent,
          fill: false,
          pointStyle: "rect",
          pointRadius: pointRadius.rect,
          borderDash: [10, 15],
          borderColor: config.rgb.darkBlue,
          backgroundColor: config.rgb.darkBlue,
          pointBorderColor: config.rgb.discordBlack,
          cubicInterpolationMode: "monotone",
          yAxisID: "y2",
        },
      ],
    };
    chartOptions = {
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            font: fontChartNumber,
            color: config.rgb.silverWhite,
          },
          border: {
            color: config.rgb.silverWhite,
          },
          title: {
            display: true,
            text: "Attacks used",
            font: fontChartString,
            color: config.rgb.silverWhite,
          },
        },
        y: {
          position: "left",
          beginAtZero: true,
          max: 3 * mongoWar.result.size + 3,
          ticks: {
            font: fontChartNumber,
            color: config.rgb.silverWhite,
          },
          border: {
            color: config.rgb.silverWhite,
          },
          title: {
            display: true,
            text: "Total Stars",
            font: fontChartString,
            color: config.rgb.silverWhite,
          },
        },
        y2: {
          position: "right",
          beginAtZero: true,
          max: 110,
          ticks: {
            font: fontChartNumber,
            color: config.rgb.silverWhite,
          },
          border: {
            color: config.rgb.silverWhite,
          },
          title: {
            display: true,
            text: "Hitrate",
            font: fontChartString,
            color: config.rgb.silverWhite,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
          labels: {
            usePointStyle: true,
            font: fontChartString,
            color: config.rgb.silverWhite,
            padding: 15,
          },
        },
      },
    };
  }

  // ***** CANVAS ***** //
  const widthCanvas = config.canvasSize.width;
  const heightCanvas = config.canvasSize.height;
  let myCanvas = Canvas.createCanvas(widthCanvas, heightCanvas);
  let ctx = myCanvas.getContext("2d");

  const widthCenter = widthCanvas / 2;
  const heightCenter = heightCanvas / 2;

  // ***** Horizontal Position ***** //
  let pos = {};
  for (let i = 0; i < 20; i++) {
    pos[`h${String(i)}1`] = widthCenter - (widthCanvas * i) / 40;
    pos[`h${String(i)}2`] = widthCenter + (widthCanvas * i) / 40;
    pos[`v${String(i)}1`] = heightCenter - (heightCanvas * i) / 40;
    pos[`v${String(i)}2`] = heightCenter + (heightCanvas * i) / 40;
  }

  // ***** background image ***** //
  const bgUrl = `./image/bg/war_${league}.png`;
  const bgImage = await Canvas.loadImage(bgUrl);
  ctx.drawImage(bgImage, 0, 0, widthCanvas, heightCanvas);

  // ***** text & line color ***** //
  ctx.fillStyle = config.rgb.snowWhite;
  ctx.strokeStyle = config.rgb.snowWhite;

  // ***** Font ***** //
  const myFont = FONTS.MAIN;
  const myFontJP = FONTS.JP;
  const myFontNumber = FONTS.NUMBER;

  const resultClan = mongoWar.result.clan;
  const resultOpponent = mongoWar.result.opponent;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  setFont(ctx, config.canvasFontSize.xxSmall);
  let text = "Japan War Clans";
  ctx.fillText(text, widthCenter, pos.v191);

  //** タウンホール画像
  let imgTownHall = {
    th18: null,
    th17: null,
    th16: null,
    th15: null,
    th14: null,
    th13: null,
  };
  imgTownHall.th18 = await Canvas.loadImage("./image/th18_cam3.png");
  imgTownHall.th17 = await Canvas.loadImage("./image/th17_cam3.png");
  imgTownHall.th16 = await Canvas.loadImage("./image/th16_cam3.png");
  imgTownHall.th15 = await Canvas.loadImage("./image/th15_cam3.png");
  imgTownHall.th14 = await Canvas.loadImage("./image/th14_cam3.png");
  imgTownHall.th13 = await Canvas.loadImage("./image/th13_cam3.png");
  ctx.textAlign = "center";
  if (league == "mix") {
    if (mongoWar.season == 17) {
      let lengthTownHall = {
        th17: 120,
        th16: 110,
        th15: 100,
        th14: 90,
        th13: 70,
      };
      ctx.drawImage(
        imgTownHall.th13,
        widthCenter - 175,
        pos.v181 + 45,
        lengthTownHall.th13,
        lengthTownHall.th13,
      );
      ctx.drawImage(
        imgTownHall.th14,
        widthCenter - 130,
        pos.v181 + 32,
        lengthTownHall.th14,
        lengthTownHall.th14,
      );
      ctx.drawImage(
        imgTownHall.th15,
        widthCenter - 70,
        pos.v181 + 30,
        lengthTownHall.th15,
        lengthTownHall.th15,
      );
      ctx.drawImage(
        imgTownHall.th16,
        widthCenter + 0,
        pos.v181 + 10,
        lengthTownHall.th16,
        lengthTownHall.th16,
      );
      ctx.drawImage(
        imgTownHall.th17,
        widthCenter + 70,
        pos.v181 + 5,
        lengthTownHall.th17,
        lengthTownHall.th17,
      );
    } else if (mongoWar.season == 16) {
      const lengthTownHall = [120, 100, 80];
      let imgTownHall = [];
      if (mongoWar.week <= 12) {
        imgTownHall[0] = await Canvas.loadImage("./image/th16_cam3.png");
      } else {
        imgTownHall[0] = await Canvas.loadImage("./image/th17_cam3.png");
      }
      imgTownHall[1] = await Canvas.loadImage("./image/th14_cam3.png");
      imgTownHall[2] = await Canvas.loadImage("./image/th13_cam3.png");
      ctx.drawImage(
        imgTownHall[2],
        widthCenter - (lengthTownHall[0] / 2) * 5 + 20,
        pos.v181 + 40,
        lengthTownHall[2],
        lengthTownHall[2],
      );
      ctx.drawImage(
        imgTownHall[1],
        widthCenter - (lengthTownHall[0] / 2) * 3 + 10,
        pos.v181 + 20,
        lengthTownHall[1],
        lengthTownHall[1],
      );
      ctx.drawImage(
        imgTownHall[0],
        widthCenter - (lengthTownHall[0] / 2) * 1 + 0,
        pos.v181 + 0,
        lengthTownHall[0],
        lengthTownHall[0],
      );
      ctx.drawImage(
        imgTownHall[1],
        widthCenter + (lengthTownHall[0] / 2) * 1 + 10,
        pos.v181 + 20,
        lengthTownHall[1],
        lengthTownHall[1],
      );
      ctx.drawImage(
        imgTownHall[2],
        widthCenter + (lengthTownHall[0] / 2) * 3 + 20,
        pos.v181 + 40,
        lengthTownHall[2],
        lengthTownHall[2],
      );
    }
  } else {
    let lengthTownHall = 120;
    const imgTownHall = await Canvas.loadImage(
      `./image/th${config.lvTH}_cam3.png`,
    );
    ctx.drawImage(
      imgTownHall,
      widthCenter - lengthTownHall / 2,
      pos.v181,
      lengthTownHall,
      lengthTownHall,
    );
  }

  setFont(ctx, config.canvasFontSize.xSmall, FONTS.NUMBER);
  if (mongoWar.result != "") {
    text = `${mongoWar.clan_war.teamSize} v ${mongoWar.opponent_war.teamSize}`;
  } else {
    text = `${config.minSize[league]} v ${config.minSize[league]}`;
  }
  ctx.fillText(text, widthCenter, pos.v171 + 50);

  if (resultClan && resultOpponent) {
    setFont(ctx, config.canvasFontSize.xxxxLarge, FONTS.NUMBER, "bold");
    text = String(resultClan.stars);
    ctx.fillText(text, pos.h31, pos.v141);
    text = String(resultOpponent.stars);
    ctx.fillText(text, pos.h32, pos.v141);
    // penalty
    if (mongoWar.clan_war.clan.penalty) {
      ctx.fillStyle = config.rgb.red;
      text = String(mongoWar.clan_war.clan.penalty.star);
      setFont(ctx, config.canvasFontSize.medium, FONTS.NUMBER, "bold");
      ctx.fillText(text, pos.h31, pos.v151);
      ctx.fillStyle = config.rgb.snowWhite;
    }
    if (mongoWar.opponent_war.clan.penalty) {
      ctx.fillStyle = config.rgb.red;
      text = String(mongoWar.opponent_war.clan.penalty.star);
      setFont(ctx, config.canvasFontSize.medium, FONTS.NUMBER, "bold");
      ctx.fillText(text, pos.h31, pos.v151);
      ctx.fillStyle = config.rgb.snowWhite;
    }

    ctx.textAlign = "right";
    setFont(ctx, config.canvasFontSize.medium, FONTS.NUMBER);
    text = String(Math.round(resultClan.destruction * 10) / 10);
    ctx.fillText(text, pos.h31 + 40, pos.v131);
    text = String(Math.round(resultOpponent.destruction * 10) / 10);
    ctx.fillText(text, pos.h32 + 40, pos.v131);
    ctx.textAlign = "left";
    setFont(ctx, config.canvasFontSize.small, FONTS.NUMBER);
    text = "%";
    ctx.fillText(text, pos.h31 + 40, pos.v131 + 5);
    ctx.fillText(text, pos.h32 + 40, pos.v131 + 5);
  }

  ctx.textAlign = "center";

  setFont(ctx, config.canvasFontSize.xSmall);
  if (mongoWar.result != "") {
    if (mongoWar.result.state == "warEnded") {
      text = "WAR ENDED";
    } else if (mongoWar.result.state == "inWar") {
      text = "NOW IN WAR";
    } else if (mongoWar.result.state == "preparation") {
      text = "NOW IN PREPARATION";
    }
  } else {
    text = "NOT IN WAR";
  }
  ctx.fillText(text, widthCenter, pos.v121);

  // ***** STATS ***** //
  const heightStats = [pos.v101, pos.v91, pos.v81, pos.v71, pos.v61];

  setFont(ctx, config.canvasFontSize.small);
  text = "Hitrate";
  ctx.fillText(text, widthCenter, heightStats[0]);

  if (config.nHit[league] == 2) {
    text = "Fresh Hitrate";
    ctx.fillText(text, widthCenter, heightStats[1]);
    text = "Cleanup Hitrate";
    ctx.fillText(text, widthCenter, heightStats[2]);
    text = "Overkill Hitrate";
    ctx.fillText(text, widthCenter, heightStats[3]);
  } else if (config.nHit[league] == 1) {
    text = "Average Destruction";
    ctx.fillText(text, widthCenter, heightStats[1]);
    text = "One-Star";
    ctx.fillText(text, widthCenter, heightStats[2]);
    text = "Zero-Star";
    ctx.fillText(text, widthCenter, heightStats[3]);
  }

  text = "Attacks Left";
  ctx.fillText(text, widthCenter, heightStats[4]);

  ctx.textAlign = "left";

  if (resultClan && resultOpponent) {
    setFont(ctx, config.canvasFontSize.medium, FONTS.NUMBER);
    text = `${resultClan.allAttackTypes.nTriple.total}/${resultClan.allAttackTypes.nAt.total} (${Math.round(resultClan.allAttackTypes.hitrate.total)}%)`;
    ctx.fillText(text, pos.h141, heightStats[0]);

    let averageDestruction = [0, 0];

    if (config.nHit[league] == 2) {
      text = `${resultClan.fresh.nTriple.total}/${resultClan.fresh.nAt.total} (${Math.round(resultClan.fresh.hitrate.total)}%)`;
      ctx.fillText(text, pos.h141, heightStats[1]);
      text = `${resultClan.cleanup.nTriple.total}/${resultClan.cleanup.nAt.total} (${Math.round(resultClan.cleanup.hitrate.total)}%)`;
      ctx.fillText(text, pos.h141, heightStats[2]);
      text = `${resultClan.overkill.nTriple.total}/${resultClan.overkill.nAt.total} (${Math.round(resultClan.overkill.hitrate.total)}%)`;
      ctx.fillText(text, pos.h141, heightStats[3]);
      text = `${resultClan.nLeft}/${2 * mongoWar.result.size}`;
      ctx.fillText(text, pos.h141, heightStats[4]);
    } else if (config.nHit[league] == 1) {
      averageDestruction[0] =
        Math.round(
          ((resultClan.destruction * mongoWar.result.size) /
            resultClan.allAttackTypes.nAt.total) *
            10,
        ) / 10;
      text = `${averageDestruction[0]}%`;
      ctx.fillText(text, pos.h141, heightStats[1]);
      text = `${oneStar[0]}/${resultClan.allAttackTypes.nAt.total}`;
      ctx.fillText(text, pos.h141, heightStats[2]);
      text = `${zeroStar[0]}/${resultClan.allAttackTypes.nAt.total}`;
      ctx.fillText(text, pos.h141, heightStats[3]);
      text = `${resultClan.nLeft}/${mongoWar.result.size}`;
      ctx.fillText(text, pos.h141, heightStats[4]);
    }

    ctx.textAlign = "right";

    text = `${resultOpponent.allAttackTypes.nTriple.total}/${resultOpponent.allAttackTypes.nAt.total} (${Math.round(resultOpponent.allAttackTypes.hitrate.total)}%)`;
    ctx.fillText(text, pos.h142, heightStats[0]);

    if (config.nHit[league] == 2) {
      text = `${resultOpponent.fresh.nTriple.total}/${resultOpponent.fresh.nAt.total} (${Math.round(resultOpponent.fresh.hitrate.total)}%)`;
      ctx.fillText(text, pos.h142, heightStats[1]);
      text = `${resultOpponent.cleanup.nTriple.total}/${resultOpponent.cleanup.nAt.total} (${Math.round(resultOpponent.cleanup.hitrate.total)}%)`;
      ctx.fillText(text, pos.h142, heightStats[2]);
      text = `${resultOpponent.overkill.nTriple.total}/${resultOpponent.overkill.nAt.total} (${Math.round(resultOpponent.overkill.hitrate.total)}%)`;
      ctx.fillText(text, pos.h142, heightStats[3]);
      text = `${resultOpponent.nLeft}/${2 * mongoWar.result.size}`;
      ctx.fillText(text, pos.h142, heightStats[4]);
    } else if (config.nHit[league] == 1) {
      averageDestruction[1] =
        Math.round(
          ((resultOpponent.destruction * mongoWar.result.size) /
            resultOpponent.allAttackTypes.nAt.total) *
            10,
        ) / 10;
      text = `${averageDestruction[1]}%`;
      ctx.fillText(text, pos.h142, heightStats[1]);
      text = `${oneStar[1]}/${resultOpponent.allAttackTypes.nAt.total}`;
      ctx.fillText(text, pos.h142, heightStats[2]);
      text = `${zeroStar[1]}/${resultOpponent.allAttackTypes.nAt.total}`;
      ctx.fillText(text, pos.h142, heightStats[3]);
      text = `${resultOpponent.nLeft}/${mongoWar.result.size}`;
      ctx.fillText(text, pos.h142, heightStats[4]);
    }

    const barBlack = await Canvas.loadImage("./image/bar/black.png");
    const lBarMax = widthCenter - pos.h141;
    const hBar = 8;
    const marginBarBottom = 35;
    ctx.drawImage(
      barBlack,
      pos.h141 - 10,
      heightStats[0] + marginBarBottom,
      lBarMax,
      hBar,
    );
    ctx.drawImage(
      barBlack,
      widthCenter + 10,
      heightStats[0] + marginBarBottom,
      lBarMax,
      hBar,
    );
    ctx.drawImage(
      barBlack,
      pos.h141 - 10,
      heightStats[1] + marginBarBottom,
      lBarMax,
      hBar,
    );
    ctx.drawImage(
      barBlack,
      widthCenter + 10,
      heightStats[1] + marginBarBottom,
      lBarMax,
      hBar,
    );
    ctx.drawImage(
      barBlack,
      pos.h141 - 10,
      heightStats[2] + marginBarBottom,
      lBarMax,
      hBar,
    );
    ctx.drawImage(
      barBlack,
      widthCenter + 10,
      heightStats[2] + marginBarBottom,
      lBarMax,
      hBar,
    );
    ctx.drawImage(
      barBlack,
      pos.h141 - 10,
      heightStats[3] + marginBarBottom,
      lBarMax,
      hBar,
    );
    ctx.drawImage(
      barBlack,
      widthCenter + 10,
      heightStats[3] + marginBarBottom,
      lBarMax,
      hBar,
    );
    ctx.drawImage(
      barBlack,
      pos.h141 - 10,
      heightStats[4] + marginBarBottom,
      lBarMax,
      hBar,
    );
    ctx.drawImage(
      barBlack,
      widthCenter + 10,
      heightStats[4] + marginBarBottom,
      lBarMax,
      hBar,
    );

    const barGreenLight = await Canvas.loadImage("./image/bar/green.png");
    const barGreenDark = await Canvas.loadImage("./image/bar/darkGreen.png");
    const barRedLight = await Canvas.loadImage("./image/bar/red.png");
    const barRedDark = await Canvas.loadImage("./image/bar/darkRed.png");

    let valueLeft = resultClan.allAttackTypes.hitrate.total * 0.01;
    let valueRight = resultOpponent.allAttackTypes.hitrate.total * 0.01;
    ctx = drawBar(
      ctx,
      barGreenLight,
      barGreenDark,
      lBarMax,
      valueLeft,
      valueRight,
      widthCenter,
      pos.h141,
      heightStats[0] + marginBarBottom,
      hBar,
    );

    if (config.nHit[league] == 2) {
      valueLeft = resultClan.fresh.hitrate.total * 0.01;
      valueRight = resultOpponent.fresh.hitrate.total * 0.01;
      ctx = drawBar(
        ctx,
        barGreenLight,
        barGreenDark,
        lBarMax,
        valueLeft,
        valueRight,
        widthCenter,
        pos.h141,
        heightStats[1] + marginBarBottom,
        hBar,
      );

      valueLeft = resultClan.cleanup.hitrate.total * 0.01;
      valueRight = resultOpponent.cleanup.hitrate.total * 0.01;
      ctx = drawBar(
        ctx,
        barGreenLight,
        barGreenDark,
        lBarMax,
        valueLeft,
        valueRight,
        widthCenter,
        pos.h141,
        heightStats[2] + marginBarBottom,
        hBar,
      );

      valueLeft = resultClan.overkill.hitrate.total * 0.01;
      valueRight = resultOpponent.overkill.hitrate.total * 0.01;
      ctx = drawBar(
        ctx,
        barGreenLight,
        barGreenDark,
        lBarMax,
        valueLeft,
        valueRight,
        widthCenter,
        pos.h141,
        heightStats[3] + marginBarBottom,
        hBar,
      );

      valueLeft = resultClan.nLeft / (2 * mongoWar.result.size);
      valueRight = resultOpponent.nLeft / (2 * mongoWar.result.size);
      let barLight = "";
      let barDark = "";
      if (mongoWar.result.state == "warEnded") {
        barLight = barRedLight;
        barDark = barRedDark;
      } else {
        barLight = barGreenLight;
        barDark = barGreenDark;
      }
      ctx = drawBar(
        ctx,
        barLight,
        barDark,
        lBarMax,
        valueLeft,
        valueRight,
        widthCenter,
        pos.h141,
        heightStats[4] + marginBarBottom,
        hBar,
      );
    } else if (config.nHit[league] == 1) {
      valueLeft = averageDestruction[0] * 0.01;
      valueRight = averageDestruction[1] * 0.01;
      ctx = drawBar(
        ctx,
        barGreenLight,
        barGreenDark,
        lBarMax,
        valueLeft,
        valueRight,
        widthCenter,
        pos.h141,
        heightStats[1] + marginBarBottom,
        hBar,
      );

      valueLeft = oneStar[0] / mongoWar.result.size;
      valueRight = oneStar[1] / mongoWar.result.size;
      ctx = drawBar(
        ctx,
        barRedLight,
        barRedDark,
        lBarMax,
        valueLeft,
        valueRight,
        widthCenter,
        pos.h141,
        heightStats[2] + marginBarBottom,
        hBar,
      );

      valueLeft = zeroStar[0] / mongoWar.result.size;
      valueRight = zeroStar[1] / mongoWar.result.size;
      ctx = drawBar(
        ctx,
        barRedLight,
        barRedDark,
        lBarMax,
        valueLeft,
        valueRight,
        widthCenter,
        pos.h141,
        heightStats[3] + marginBarBottom,
        hBar,
      );

      valueLeft = resultClan.nLeft / mongoWar.result.size;
      valueRight = resultOpponent.nLeft / mongoWar.result.size;
      let barLight = "";
      let barDark = "";
      if (mongoWar.result.state == "warEnded") {
        barLight = barRedLight;
        barDark = barRedDark;
      } else {
        barLight = barGreenLight;
        barDark = barGreenDark;
      }
      ctx = drawBar(
        ctx,
        barLight,
        barDark,
        lBarMax,
        valueLeft,
        valueRight,
        widthCenter,
        pos.h141,
        heightStats[4] + marginBarBottom,
        hBar,
      );
    }
  }

  // ***** LINEUPS ***** //
  if (mongoWar.result != "") {
    const posLineup = pos.v41;
    ctx.textAlign = "center";
    ctx.fillStyle = config.rgb.snowWhite;
    const size = mongoWar.clan_war.teamSize;
    let fontSizeLineup = null;
    let fontSizeLineup2nd = null;
    let lengthStar = null;
    let lengthTh = null;
    if (size == 5) {
      lengthStar = 50;
      lengthTh = 70;
      fontSizeLineup = config.canvasFontSize.xxSmall;
      fontSizeLineup2nd = config.canvasFontSize.xxxSmall;
    } else if (size == 10) {
      lengthStar = 40;
      lengthTh = 60;
      fontSizeLineup = config.canvasFontSize.xxxSmall;
      fontSizeLineup2nd = config.canvasFontSize.xxxxSmall;
    } else {
      lengthStar = 30;
      lengthTh = 40;
      fontSizeLineup = config.canvasFontSize.xxxxSmall;
      fontSizeLineup2nd = config.canvasFontSize.xxxxxSmall;
    }
    const spacing = (heightCanvas * 0.27) / size;
    const apm = mongoWar.clan_war.attacksPerMember;
    // Home team
    await Promise.all(
      mongoWar.clan_war.clan.members.map(async (member, index) => {
        setFontJP(ctx, fontSizeLineup);
        text = member.name;
        ctx.textAlign = "center";
        ctx.fillText(
          text,
          pos.h101,
          posLineup + spacing * (member.mapPosition - 1),
        );

        // Town Hall Image
        ctx.drawImage(
          imgTownHall[`th${member.townHallLevel}`],
          widthCenter - lengthTh / 2,
          posLineup + spacing * (member.mapPosition - 1) - lengthTh / 2,
          lengthTh,
          lengthTh,
        );

        if (member.attacks.length != 0) {
          if (apm == 1) {
            let starFlag = member.attacks[0].arrStarsFlag;
            await drawStars(
              ctx,
              starFlag,
              lengthStar,
              pos.h21,
              "left",
              posLineup,
              spacing,
              member.mapPosition,
              member.attacks[0],
              fontSizeLineup,
              fontSizeLineup2nd,
              myFont,
            );
          } else if (apm == 2) {
            let starFlag = member.attacks[0].arrStarsFlag;
            await drawStars(
              ctx,
              starFlag,
              lengthStar,
              pos.h51,
              "left",
              posLineup,
              spacing,
              member.mapPosition,
              member.attacks[0],
              fontSizeLineup,
              fontSizeLineup2nd,
              myFont,
            );
            if (member.attacks.length == 2) {
              let starFlag2 = member.attacks[1].arrStarsFlag;
              await drawStars(
                ctx,
                starFlag2,
                lengthStar,
                pos.h21,
                "left",
                posLineup,
                spacing,
                member.mapPosition,
                member.attacks[1],
                fontSizeLineup,
                fontSizeLineup2nd,
                myFont,
              );
            }
          }
        }
      }),
    );
    // Away team
    await Promise.all(
      mongoWar.opponent_war.clan.members.map(async (member, index) => {
        setFontJP(ctx, fontSizeLineup);
        text = member.name;
        ctx.textAlign = "center";
        ctx.fillText(
          text,
          pos.h102,
          posLineup + spacing * (member.mapPosition - 1),
        );

        if (member.attacks.length != 0) {
          if (apm == 1) {
            let starFlag = member.attacks[0].arrStarsFlag;
            await drawStars(
              ctx,
              starFlag,
              lengthStar,
              pos.h22,
              "right",
              posLineup,
              spacing,
              member.mapPosition,
              member.attacks[0],
              fontSizeLineup,
              fontSizeLineup2nd,
              myFont,
            );
          } else if (apm == 2) {
            let starFlag = member.attacks[0].arrStarsFlag;
            await drawStars(
              ctx,
              starFlag,
              lengthStar,
              pos.h22,
              "right",
              posLineup,
              spacing,
              member.mapPosition,
              member.attacks[0],
              fontSizeLineup,
              fontSizeLineup2nd,
              myFont,
            );
            if (member.attacks.length == 2) {
              let starFlag2 = member.attacks[1].arrStarsFlag;
              await drawStars(
                ctx,
                starFlag2,
                lengthStar,
                pos.h52,
                "right",
                posLineup,
                spacing,
                member.mapPosition,
                member.attacks[1],
                fontSizeLineup,
                fontSizeLineup2nd,
                myFont,
              );
            }
          }
        }
      }),
    );
  }

  // Legend for Chart
  const posLegend = pos.v82;
  ctx.textAlign = "center";
  setFont(ctx, config.canvasFontSize.xSmall);
  text = mongoWar.clan_abbr.toUpperCase();
  ctx.fillText(text, pos.h41, posLegend - 50);
  text = mongoWar.opponent_abbr.toUpperCase();
  ctx.fillText(text, pos.h42, posLegend - 50);

  setFont(ctx, config.canvasFontSize.xxSmall);
  text = "Total Stars";
  ctx.fillText(text, widthCenter, posLegend);

  if (config.nHit[league] == 2) {
    setFont(ctx, config.canvasFontSize.xxSmall);
    text = "Hitrate";
    ctx.fillText(text, widthCenter, posLegend + 50);
  } else if (config.nHit[league] == 1) {
    setFont(ctx, config.canvasFontSize.xxSmall);
    text = "Average Destruction";
    ctx.fillText(text, widthCenter, posLegend + 50);
  }

  let circleRadius = 8;
  let lxRect = 16;
  let lyRect = 16;
  ctx.fillStyle = config.rgb.orange.default;
  ctx.beginPath();
  ctx.arc(pos.h41, posLegend - circleRadius / 2, circleRadius, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = config.rgb.blue;
  ctx.beginPath();
  ctx.arc(pos.h42, posLegend - circleRadius / 2, circleRadius, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = config.rgb.darkOrange;
  ctx.fillRect(
    pos.h41 - lxRect / 2,
    posLegend - circleRadius / 2 + 50,
    lxRect,
    lyRect,
  );
  ctx.fillStyle = config.rgb.darkBlue;
  ctx.fillRect(
    pos.h42 - lxRect / 2,
    posLegend - circleRadius / 2 + 50,
    lxRect,
    lyRect,
  );

  // ***** line color 初期化 ***** //
  ctx.fillStyle = config.rgb.snowWhite;

  // ***** Chart ***** //
  if (mongoWar.result != "") {
    const widthChart = config.canvasSize.width * 0.7;
    const heightChart = config.canvasSize.height * 0.18;
    const width = widthChart;
    const height = heightChart;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

    const configuration = {
      type: "line",
      data: chartData,
      options: chartOptions,
    };
    const urlChart = await chartJSNodeCanvas.renderToDataURL(configuration);

    const marginTopChart = pos.v92;
    let marginLeftChart = 5;
    const imgChart = await Canvas.loadImage(urlChart);
    ctx.drawImage(
      imgChart,
      (widthCanvas - widthChart) / 2 + marginLeftChart,
      marginTopChart,
      widthChart,
      heightChart,
    );
  }

  // ***** 左上、右上 ***** //
  const lengthTeamLogo = widthCanvas / 6;
  let dxA = pos.h101 - lengthTeamLogo / 2;
  let dyA = pos.v161;
  try {
    const imgTeamA = await Canvas.loadImage(
      `./image/teamLogo/${mongoWar.clan_abbr}.png`,
    );
    ctx = reflectImage2Canvas(
      ctx,
      imgTeamA,
      lengthTeamLogo,
      lengthTeamLogo,
      dxA,
      dyA,
    );
  } catch (error) {
    const imgJwc = await Canvas.loadImage(`./image/JWC.png`);
    ctx = reflectImage2Canvas(
      ctx,
      imgJwc,
      lengthTeamLogo,
      lengthTeamLogo,
      dxA,
      dyA,
    );
  }
  let dxB = pos.h102 - lengthTeamLogo / 2;
  let dyB = pos.v161;
  try {
    const imgTeamB = await Canvas.loadImage(
      `./image/teamLogo/${mongoWar.opponent_abbr}.png`,
    );
    ctx = reflectImage2Canvas(
      ctx,
      imgTeamB,
      lengthTeamLogo,
      lengthTeamLogo,
      dxB,
      dyB,
    );
  } catch (error) {
    const imgJwc = await Canvas.loadImage(`./image/JWC.png`);
    ctx = reflectImage2Canvas(
      ctx,
      imgJwc,
      lengthTeamLogo,
      lengthTeamLogo,
      dxB,
      dyB,
    );
  }

  // ***** 左下 ***** //
  setFont(ctx, config.canvasFontSize.medium, FONTS.MAIN, "bold");
  text = config.league[mongoWar.league];
  ctx.fillText(text, pos.h101, heightCanvas - 240 - 10);

  setFont(ctx, config.canvasFontSize.xSmall);
  text = `WEEK ${mongoWar.week}`;
  ctx.fillText(text, pos.h101, heightCanvas - 180);

  setFont(ctx, config.canvasFontSize.xxSmall);
  text = `MATCH ${mongoWar.match}`;
  ctx.fillText(text, pos.h101, heightCanvas - 120);

  // ***** 右下 ***** //
  if (mongoWar.result != "") {
    const endTimeUtc = mongoWar.clan_war.endTime;
    const endTimeJst = toZonedTime(endTimeUtc, "Asia/Tokyo");

    setFont(ctx, config.canvasFontSize.xxSmall, FONTS.MAIN, "italic");
    if (mongoWar.result.state == "warEnded") {
      text = "The war ended at:";
    } else {
      text = "The war will end at:";
    }
    ctx.fillText(text, pos.h102, heightCanvas - 240 - 10);

    setFont(ctx, config.canvasFontSize.xSmall, FONTS.MAIN, "italic");
    text = format(endTimeJst, "pp, PPPP") + " [JST]";
    ctx.fillText(text, pos.h102, heightCanvas - 180);

    setFont(ctx, config.canvasFontSize.xxSmall, FONTS.MAIN, "italic");
    text = format(endTimeUtc, "pp, PPPP") + " [UTC]";
    ctx.fillText(text, pos.h102, heightCanvas - 120);
  }

  // ***** 中央下 ***** //
  const lengthLogoJwc = 100;
  const imgJwcLogo = await Canvas.loadImage("./image/JWC.png");
  ctx.drawImage(
    imgJwcLogo,
    widthCenter - lengthLogoJwc / 2,
    heightCanvas - 200,
    lengthLogoJwc,
    lengthLogoJwc,
  );

  setFont(ctx, config.canvasFontSize.xxSmall);
  text = `SEASON ${mongoWar.season}`;
  ctx.fillText(text, widthCenter, heightCanvas - 70);

  const pngData = await myCanvas.encode("png");

  const attachment = new AttachmentBuilder(pngData, {
    name: "warProgress.png",
  });

  return attachment;
}
export { warProgress };

// ランキング（レジェンド）用のトロフィーグラフ画像を生成
async function legendRankingChart(locationId, prefetched) {
  const nDisplay = 200;
  const scPlayersLegend = prefetched?.players ?? [];

  const labels = [];
  const ranks = [];
  const teams = [];
  const dataTrophies = [];
  const dataAttacks = [];
  scPlayersLegend.slice(0, nDisplay).forEach((p) => {
    labels.push(p.name ?? "ERROR");
    ranks.push(String(p.rank));
    teams.push(p.homeClanAbbr ?? "");
    dataTrophies.push(p.trophies);
    dataAttacks.push(p.attackWins);
  });

  const width = 1200;
  const perRowHeight = 24; // 1人あたりの縦幅
  const reservedPadding = 160; // 凡例・余白（タイトルは別描画）
  const height = Math.max(labels.length * perRowHeight + reservedPadding, 1200);
  const headerHeight = 140; // タイトル描画エリア
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width: width - 40,
    height: height - 40,
    backgroundColour: config.rgb.discordBlack,
  });
  const chartPaddingTop = 0;
  const chartPaddingLeft = 400;
  const chartPaddingRight = 24;
  const chartPaddingBottom = 0;

  const title =
    locationId == config_coc.locationId.japan
      ? "TOP 200 JAPANESE LEGENDS"
      : "TOP 200 GLOBAL LEGENDS";

  // ***** Font ***** //
  const myFont = FONTS.MAIN;
  const myFontJP = FONTS.JP;
  const myFontSC = FONTS.SC;
  const myFontNumber = FONTS.NUMBER;

  // ***** Font for Chart ***** //
  const fontChartString = {
    family: "Helvetica Neue",
    size: 24,
  };
  const fontChartNumber = {
    family: "Helvetica Neue",
    size: 20,
  };

  const configuration = {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "TROPHIES",
          data: dataTrophies,
          borderWidth: 0,
          backgroundColor: (ctx) => {
            const { chart } = ctx;
            const gradient = chart.ctx.createLinearGradient(
              0,
              0,
              chart.width,
              0,
            );
            gradient.addColorStop(0, config.rgb.purple.zero);
            gradient.addColorStop(1, config.rgb.purple.seven);
            return gradient;
          },
          barThickness: 12,
          barPercentage: 0.8,
        },
        {
          label: "ATTACK WINS",
          data: dataAttacks,
          borderWidth: 0,
          backgroundColor: (ctx) => {
            const { chart } = ctx;
            const gradient = chart.ctx.createLinearGradient(
              0,
              0,
              chart.width,
              0,
            );
            gradient.addColorStop(0, config.rgb.gray.zero);
            gradient.addColorStop(1, config.rgb.gray.half);
            return gradient;
          },
          barThickness: 8,
          barPercentage: 0.4,
          xAxisID: "x1",
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: false,
        },
        legend: {
          display: true,
          labels: {
            color: config.rgb.silverWhite,
            font: { family: "sans-serif", size: 12, weight: "normal" },
          },
        },
      },
      scales: {
        x: {
          position: "top",
          min: 5000,
          ticks: { color: config.rgb.silverWhite, font: fontChartNumber },
          grid: { color: config.rgba.darkBlue },
        },
        x1: {
          min: 0,
          max: 250,
          ticks: { color: config.rgb.silverWhite, font: fontChartNumber },
          grid: { drawOnChartArea: false },
        },
        y: {
          ticks: {
            display: false,
            color: config.rgb.silverWhite,
            autoSkip: false,
            font: fontChartNumber,
          },
          grid: { color: config.rgba.darkBlue },
        },
      },
      layout: {
        padding: {
          top: chartPaddingTop,
          right: chartPaddingRight,
          bottom: chartPaddingBottom,
          left: chartPaddingLeft,
        },
      },
      font: fontChartString,
    },
  };

  const pngBuffer = await chartJSNodeCanvas.renderToBuffer(
    configuration,
    "image/png",
  );

  // 合成キャンバスを作り、上部にSCフォントのタイトルを別描画
  const totalCanvas = Canvas.createCanvas(width, height + headerHeight);
  const ctx = totalCanvas.getContext("2d");
  // 背景
  ctx.fillStyle = config.rgb.discordBlack;
  ctx.fillRect(0, 0, totalCanvas.width, totalCanvas.height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = config.rgb.silverWhite;
  setFont(ctx, fontSize.smallMedium, FONTS.MAIN, "bold");
  ctx.fillText(title, Math.floor(width / 2), Math.floor(headerHeight / 2));

  // Chart画像を貼り付け
  const chartImg = await Canvas.loadImage(pngBuffer);
  ctx.drawImage(chartImg, 0, headerHeight);

  // アカウント名と順位をChart画像とは別にtotalCanvas上に直接描画
  // JWCロゴを事前に読み込み（チーム所属がある行にだけ描画）
  const imgJwcLogo = await Canvas.loadImage("./image/JWC.png");
  const logoSize = Math.max(12, Math.floor(perRowHeight * 0.8));
  const logoMargin = 8;
  const namePositionX = chartPaddingLeft - 110; // 名前の位置
  const teamPositionX = chartPaddingLeft - 80; // チーム名の位置
  const rankPositionX = chartPaddingLeft - 10; // 順位の位置

  ctx.textBaseline = "middle";
  ctx.fillStyle = config.rgb.silverWhite;

  labels.forEach((label, idx) => {
    // Chart画像内でのy位置を計算（perRowHeightを使用）
    const chartY =
      68 + chartPaddingTop + idx * (perRowHeight + 0.05) + perRowHeight / 2;
    // totalCanvas上でのy位置（headerHeight分のオフセットを加算）
    const totalY = headerHeight + chartY;

    // 名前を描画（右寄せ）- 絵文字・特殊文字対応
    ctx.textAlign = "right";
    setFontName(ctx, fontSize.xxxxSmall, FONTS.JP);
    const name = label ?? "";
    ctx.fillText(name, namePositionX, totalY);

    // チーム名を描画（左寄せ）
    ctx.textAlign = "left";
    setFont(ctx, fontSize.xxxxSmall);
    const team = teams[idx] ?? "";
    if (team) {
      // JWCロゴをチーム名の左側に描画
      const logoX = teamPositionX - logoMargin - logoSize + 5;
      const logoY = totalY - logoSize / 2;
      // ロゴ本体
      ctx.drawImage(imgJwcLogo, logoX, logoY, logoSize, logoSize);
      ctx.restore();
      // チーム名
      ctx.fillText(team.toUpperCase(), teamPositionX, totalY + 0.5);
    }

    // 順位を描画（左寄せ）
    ctx.textAlign = "center";
    setFont(ctx, fontSize.xxxxxSmall);
    const rankPadded = ranks[idx] ?? "";
    if (rankPadded) ctx.fillText(`${rankPadded}`, rankPositionX, totalY);
  });

  const finalPng = await totalCanvas.encode("png");
  const name =
    locationId == config_coc.locationId.japan
      ? "legend_japan.png"
      : "legend_global.png";
  const attachment = new AttachmentBuilder(finalPng, { name });
  return attachment;
}
export { legendRankingChart };

function drawBar(
  ctx,
  barLight,
  barDark,
  lBarMax,
  valueLeft,
  valueRight,
  widthCenter,
  posH,
  height,
  hBar,
) {
  let lBar1 = lBarMax * valueLeft;
  let lBar2 = lBarMax * valueRight;
  let marginLeftBar = lBarMax - lBar1;

  if (valueLeft > valueRight) {
    ctx.drawImage(barLight, marginLeftBar + posH - 10, height, lBar1, hBar);
    ctx.drawImage(barDark, widthCenter + 10, height, lBar2, hBar);
  } else if (valueLeft < valueRight) {
    ctx.drawImage(barDark, marginLeftBar + posH - 10, height, lBar1, hBar);
    ctx.drawImage(barLight, widthCenter + 10, height, lBar2, hBar);
  } else {
    ctx.drawImage(barLight, marginLeftBar + posH - 10, height, lBar1, hBar);
    ctx.drawImage(barLight, widthCenter + 10, height, lBar2, hBar);
  }

  return ctx;
}

async function drawStars(
  ctx,
  starFlag,
  lengthStar,
  posH,
  LorR,
  posLineup,
  spacing,
  mapPosition,
  attack,
  fontSizeLineup,
  fontSizeLineup2nd,
  myFont,
) {
  let imgStar = [];
  let text = "";
  for (let i = 0; i < 3; i++) {
    imgStar[i] = await Canvas.loadImage(`./image/star${starFlag[i]}.png`);
    let posLR = null;
    if (LorR == "left") {
      posLR = -lengthStar * (3 - i);
    } else if (LorR == "right") {
      posLR = lengthStar * i;
    }
    ctx.drawImage(
      imgStar[i],
      posH + posLR,
      posLineup + spacing * (mapPosition - 1) - lengthStar / 2,
      lengthStar,
      lengthStar,
    );
  }

  if (attack.destruction != 100) {
    let posLR = null;
    if (LorR == "left") {
      posLR = -lengthStar * 0.4;
    } else if (LorR == "right") {
      posLR = lengthStar * 2.6;
    }
    text = `${attack.destruction}`;
    ctx.textAlign = "right";
    setFont(ctx, fontSizeLineup);
    ctx.fillText(
      text,
      posH + posLR,
      posLineup + spacing * (mapPosition - 1) + lengthStar * 0.2,
    );
    text = `%`;
    ctx.textAlign = "left";
    setFont(ctx, fontSizeLineup2nd);
    ctx.fillText(
      text,
      posH + posLR,
      posLineup + spacing * (mapPosition - 1) + lengthStar * 0.22,
    );
  }

  let posOrder = null;
  if (LorR == "left") {
    posOrder = -lengthStar * 3.6;
  } else if (LorR == "right") {
    posOrder = lengthStar * 3.6;
  }
  ctx.textAlign = "center";
  setFont(ctx, fontSizeLineup2nd);
  ctx.fillText(
    String(attack.order),
    posH + posOrder,
    posLineup + spacing * (mapPosition - 1) - lengthStar * 0.2,
  );

  return;
}
