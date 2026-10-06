// =============================================================
//  เซิร์ฟเวอร์เกม (Phase 1) — Colyseus + Express
//  - เสิร์ฟหน้าเว็บเกมจากโฟลเดอร์ /public
//  - ห้อง "world" เก็บตำแหน่งผู้เล่นทุกคน และเป็นตัวตัดสินการเดิน (กันโกง)
// =============================================================
const http = require("http");
const path = require("path");
const express = require("express");
const { Server } = require("colyseus");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { WorldRoom } = require("./WorldRoom");

const NODE_MODULES = path.join(__dirname, "..", "node_modules");
const PORT = Number(process.env.PORT) || 2567;

const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));
// ไฟล์ client ของ Colyseus สำหรับเบราว์เซอร์
app.get("/lib/colyseus.js", (_req, res) =>
  res.sendFile(path.join(NODE_MODULES, "colyseus.js", "dist", "colyseus.js"))
);
app.get("/lib/phaser.min.js", (_req, res) =>
  res.sendFile(path.join(NODE_MODULES, "phaser", "dist", "phaser.min.js"))
);
app.get("/credits", (_req, res) =>
  res.type("text/plain; charset=utf-8").sendFile(path.join(__dirname, "..", "CREDITS.md"))
);
app.get("/health", (_req, res) => res.send("ok"));

const gameServer = new Server({
  transport: new WebSocketTransport({ server: http.createServer(app) }),
});

gameServer.define("world", WorldRoom);

gameServer.listen(PORT).then(() => {
  console.log(`🎮 Game server running on http://localhost:${PORT}`);
});
