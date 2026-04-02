import express from "express";
import pkg from "@prisma/client";
import fs from "fs";
import path from "path";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// battleRooms[battleId] = {
//   owner: playerId (string),
//   player1: playerId | null,       ← เก็บ playerId ไม่ใช่ socket.id
//   player2: playerId | null,
//   spectators: Map<playerId, socketId>,  ← Map แทน Set เพื่อ dedup ต่อ player
//   player1SocketId: socketId | null,
//   player2SocketId: socketId | null,
//   ...state
// }
const battleRooms = {};

const getRoomCounts = (battleId) => {
  const room = battleRooms[battleId];
  if (!room) return { player1: 0, player2: 0, spectators: 0 };
  return {
    player1: room.player1 ? 1 : 0,
    player2: room.player2 ? 1 : 0,
    spectators: room.spectators ? room.spectators.size : 0,
  };
};

const broadcastRoomCounts = () => {
  const counts = {};
  for (const battleId in battleRooms) counts[battleId] = getRoomCounts(battleId);
  io.emit("allRoomCounts", counts);
};

const broadcastBattleList = async () => {
  try {
    const battles = await prisma.battle.findMany({ include: { owner: true } });
    io.emit("battleListUpdate", battles.map((b) => ({ ...b, counts: getRoomCounts(b.id) })));
  } catch (err) { console.error("broadcastBattleList error:", err); }
};

io.on("connection", (socket) => {
  const playerId = socket.handshake.auth.playerId;
  socket.playerId = playerId;

  // ส่ง counts ปัจจุบันให้ client ใหม่ทันที
  const currentCounts = {};
  for (const battleId in battleRooms) currentCounts[battleId] = getRoomCounts(battleId);
  socket.emit("allRoomCounts", currentCounts);

  socket.on("joinBattle", async ({ battleId, role }) => {
    // สร้าง room ถ้ายังไม่มี
    if (!battleRooms[battleId]) {
      const battle = await prisma.battle.findUnique({ where: { id: battleId } });
      if (!battle) { socket.emit("battleNotFound"); return; }
      battleRooms[battleId] = {
        owner: battle.ownerId,
        player1: null,           // playerId
        player2: null,           // playerId
        player1SocketId: null,   // socket.id ปัจจุบัน
        player2SocketId: null,
        spectators: new Map(),   // Map<playerId, socketId>
        timeLeft: null, timerRunning: false, finished: false, duration: null,
        player1Code: "", player2Code: "",
        player1Output: null, player2Output: null,
      };
    }

    const room = battleRooms[battleId];

    // ถ้า player เคยอยู่ในห้องนี้แล้ว (reconnect/reload) → ให้เข้าได้เลย
    if (role === "player1") {
      if (room.player1 && room.player1 !== playerId) {
        socket.emit("roleTaken"); return;
      }
      // ถ้าเคยเป็น spectator → ออกจาก spectators ก่อน
      room.spectators.delete(playerId);
      room.player1 = playerId;
      room.player1SocketId = socket.id;
    } else if (role === "player2") {
      if (room.player2 && room.player2 !== playerId) {
        socket.emit("roleTaken"); return;
      }
      room.spectators.delete(playerId);
      room.player2 = playerId;
      room.player2SocketId = socket.id;
    } else {
      // spectator: ถ้า playerId เดิมเข้ามาใหม่ → update socketId (dedup อัตโนมัติ)
      // แต่ถ้า playerId นั้นเป็น player1/player2 อยู่แล้ว → ไม่นับซ้ำเป็น spectator
      if (room.player1 !== playerId && room.player2 !== playerId) {
        room.spectators.set(playerId, socket.id);
      }
    }

    socket.currentBattle = battleId;
    socket.currentRole = role;
    socket.join(battleId);

    socket.emit("ownerUpdate", room.owner);
    socket.emit("timerUpdate", room.timeLeft);
    socket.emit("roomUpdate", { ...room, spectators: room.spectators.size });
    socket.emit("battleStatus", { started: room.timerRunning || room.finished, finished: room.finished });
    socket.emit("codeUpdate", { player: "player1", code: room.player1Code });
    socket.emit("codeUpdate", { player: "player2", code: room.player2Code });

    if (role === "spectator") {
      if (room.player1Output) socket.emit("runResult", { player: "player1", ...room.player1Output });
      if (room.player2Output) socket.emit("runResult", { player: "player2", ...room.player2Output });
    }

    io.to(battleId).emit("roomUpdate", { ...room, spectators: room.spectators.size });
    broadcastRoomCounts();
  });

  socket.on("leaveBattle", ({ battleId }) => {
    cleanupSocketFromRoom(socket, battleId);
    broadcastRoomCounts();
  });

  socket.on("startBattle", ({ battleId, duration }) => {
    const room = battleRooms[battleId];
    if (!room || socket.playerId !== room.owner) return;
    room.finished = false;
    room.timerRunning = true;
    room.duration = duration || null;
    room.timeLeft = duration || null;
    io.to(battleId).emit("battleStarted", room.timeLeft);
  });

  socket.on("stopTimer", ({ battleId }) => {
    const room = battleRooms[battleId];
    if (!room || socket.playerId !== room.owner) return;
    room.timerRunning = false;
    io.to(battleId).emit("timerStopped");
  });

  socket.on("resumeTimer", ({ battleId }) => {
    const room = battleRooms[battleId];
    if (!room || socket.playerId !== room.owner) return;
    room.timerRunning = true;
    io.to(battleId).emit("timerResumed");
  });

  socket.on("resetTimer", ({ battleId, duration }) => {
    const room = battleRooms[battleId];
    if (!room || socket.playerId !== room.owner) return;
    room.timerRunning = false;
    room.finished = false;
    room.timeLeft = duration || room.duration;
    io.to(battleId).emit("timerReset", room.timeLeft);
  });

  socket.on("resetRoom", ({ battleId }) => {
    const room = battleRooms[battleId];
    if (!room || socket.playerId !== room.owner) return;
    room.finished = false;
    room.timerRunning = false;
    room.timeLeft = null;
    room.player1Code = "";
    room.player2Code = "";
    room.player1Output = null;
    room.player2Output = null;
    io.to(battleId).emit("roomReset");
  });

  socket.on("codeUpdate", ({ battleId, player, code }) => {
    const room = battleRooms[battleId];
    if (room) {
      if (player === "player1") room.player1Code = code;
      if (player === "player2") room.player2Code = code;
    }
    socket.to(battleId).emit("codeUpdate", { player, code });
  });

  socket.on("runResult", ({ battleId, player, input, output }) => {
    const room = battleRooms[battleId];
    if (room) {
      if (player === "player1") room.player1Output = { input, output };
      if (player === "player2") room.player2Output = { input, output };
    }
    socket.to(battleId).emit("runResult", { player, input, output });
  });

  socket.on("submitCode", async ({ battleId, player, code, language, userId }) => {
    const room = battleRooms[battleId];
    if (!room || room.finished) return;
    try {
      const battle = await prisma.battle.findUnique({ where: { id: battleId }, include: { testCases: true } });
      
      console.log("Battle testCases count:", battle?.testCases?.length);

      if (!battle || battle.testCases.length === 0) {
        room.finished = true;
        room.timerRunning = false;
        if (userId) await prisma.submission.create({ data: { code, score: 0, language: language || "python", userId, battleId } }).catch(() => {});
        io.to(battleId).emit("battleFinished", player);
        return;
      }
      let passed = 0;
      for (const test of battle.testCases) {
        const result = await runCode(code, test.input, language || "python");
        if (result.trim() === test.expected.trim()) passed++;
      }
      const total = battle.testCases.length;
      if (userId) await prisma.submission.create({ data: { code, score: passed, language: language || "python", userId, battleId } }).catch(() => {});
      if (passed === total) {
        room.finished = true;
        room.timerRunning = false;
        socket.emit("submitResult", { passed, total, success: true });
        io.to(battleId).emit("battleFinished", player);
      } else {
        socket.emit("submitResult", { passed, total, success: false });
      }
    } catch (err) {
      console.error("submitCode error:", err);
      socket.emit("submitResult", { passed: 0, total: 0, success: false, error: "Server error" });
    }
  });

  socket.on("cursorMove", ({ battleId, player, position }) => {
    socket.to(battleId).emit("cursorMove", { player, position });
  });

  socket.on("disconnect", () => {
    // หา room ที่ socket นี้อยู่ แล้วลบออก
    for (const battleId in battleRooms) {
      cleanupSocketFromRoom(socket, battleId);
    }
    broadcastRoomCounts();
  });
});

// แยก cleanup ออกมาใช้ร่วมกันระหว่าง disconnect และ leaveBattle
function cleanupSocketFromRoom(socket, battleId) {
  const room = battleRooms[battleId];
  if (!room) return;

  const playerId = socket.playerId;
  let changed = false;

  if (room.player1 === playerId && room.player1SocketId === socket.id) {
    room.player1 = null;
    room.player1SocketId = null;
    changed = true;
  }
  if (room.player2 === playerId && room.player2SocketId === socket.id) {
    room.player2 = null;
    room.player2SocketId = null;
    changed = true;
  }
  // spectator: ลบเฉพาะถ้า socketId ตรงกัน (ป้องกัน reconnect ลบของใหม่)
  const specSocketId = room.spectators.get(playerId);
  if (specSocketId === socket.id) {
    room.spectators.delete(playerId);
    changed = true;
  }

  if (changed) {
    io.to(battleId).emit("roomUpdate", { ...room, spectators: room.spectators.size });
  }
}

setInterval(() => {
  for (const battleId in battleRooms) {
    const room = battleRooms[battleId];
    if (!room.timerRunning || room.timeLeft === null) continue;
    if (room.timeLeft > 0) {
      room.timeLeft--;
      io.to(battleId).emit("timerUpdate", room.timeLeft);
    } else {
      room.timerRunning = false;
      room.finished = true;
      io.to(battleId).emit("battleEnded");
    }
  }
}, 1000);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("CodeDuel API is running 🚀"));

app.get("/battles", async (req, res) => {
  try {
    const battles = await prisma.battle.findMany({ include: { owner: true } });
    res.json(battles.map((b) => ({ ...b, counts: getRoomCounts(b.id) })));
  } catch { res.status(500).json({ error: "Failed to fetch battles" }); }
});

app.get("/battles/:id", async (req, res) => {
  try {
    const battle = await prisma.battle.findUnique({ where: { id: req.params.id }, include: { testCases: true } });
    res.json(battle);
  } catch { res.status(500).json({ error: "Failed to fetch battle" }); }
});

app.post("/battle", async (req, res) => {
  const { title, description, ownerId } = req.body;
  if (!ownerId) return res.status(400).json({ error: "ownerId required" });
  try {
    await prisma.user.upsert({ where: { id: ownerId }, update: {}, create: { id: ownerId, username: "Player_" + ownerId.slice(0, 6) } });
    const battle = await prisma.battle.create({ data: { title, description, ownerId } });
    await broadcastBattleList();
    res.json(battle);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create battle" });
  }
});

app.delete("/battle/:id", async (req, res) => {
  const { id } = req.params;
  const { ownerId } = req.body;
  try {
    const battle = await prisma.battle.findUnique({ where: { id } });
    if (!battle) return res.status(404).json({ error: "Battle not found" });
    if (battle.ownerId !== ownerId) return res.status(403).json({ error: "Not owner" });
    await prisma.battle.delete({ where: { id } });
    delete battleRooms[id];
    await broadcastBattleList();
    broadcastRoomCounts();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete battle" });
  }
});

app.post("/run", async (req, res) => {
  const { code, input, language } = req.body;
  try {
    const result = await runCode(code, input, language || "python");
    res.json({ output: result });
  } catch (err) { res.status(500).json({ output: "ERROR: " + err.message }); }
});

app.post("/battle/:id/testcase", async (req, res) => {
  const { id } = req.params;
  const { input, expected } = req.body;
  try {
    const testCase = await prisma.testCase.create({ data: { input, expected, battleId: id } });
    res.json(testCase);
  } catch { res.status(500).json({ error: "Failed to create test case" }); }
});

app.get("/leaderboard/:battleId", async (req, res) => {
  try {
    const leaderboard = await prisma.submission.groupBy({
      by: ["userId"],
      where: { battleId: req.params.battleId },
      _max: { score: true },
      orderBy: { _max: { score: "desc" } },
    });
    res.json(leaderboard);
  } catch { res.status(500).json({ error: "Failed to fetch leaderboard" }); }
});

function runCode(code, input, language) {
  return new Promise((resolve) => {
    if (language === "java") {
      const dir = path.join(process.cwd(), "tmp_java_" + Date.now());
      fs.mkdirSync(dir, { recursive: true });
      const match = code.match(/public\s+class\s+(\w+)/);
      const className = match ? match[1] : "Main";
      const filePath = path.join(dir, `${className}.java`);
      fs.writeFileSync(filePath, code);
      const compile = spawn("javac", [filePath]);
      let compileErr = "";
      compile.stderr.on("data", (d) => (compileErr += d.toString()));
      compile.on("close", (exitCode) => {
        if (exitCode !== 0) { fs.rmSync(dir, { recursive: true, force: true }); return resolve("COMPILE ERROR:\n" + compileErr); }
        const run = spawn("java", ["-cp", dir, className]);
        let out = "", err = "";
        if (input) { run.stdin.write(input); run.stdin.end(); } else run.stdin.end();
        run.stdout.on("data", (d) => (out += d.toString()));
        run.stderr.on("data", (d) => (err += d.toString()));
        run.on("close", () => { fs.rmSync(dir, { recursive: true, force: true }); resolve(err ? "RUNTIME ERROR:\n" + err : out); });
      });
    } else {
      const filePath = path.join(process.cwd(), "temp_" + Date.now() + ".py");
      fs.writeFileSync(filePath, code);
      const py = spawn("python3", [filePath]);
      let out = "", err = "";
      if (input) { py.stdin.write(input); py.stdin.end(); } else py.stdin.end();
      py.stdout.on("data", (d) => (out += d.toString()));
      py.stderr.on("data", (d) => (err += d.toString()));
      py.on("close", () => { try { fs.unlinkSync(filePath); } catch {} resolve(err ? "ERROR:\n" + err : out); });
    }
  });
}

server.listen(3000, () => console.log("Server running on port 3000"));
