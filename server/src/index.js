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

const io = new Server(server, {
  cors: { origin: "*" },
});

// battleRooms: { [battleId]: { owner, player1, player2, spectators, timeLeft, timerRunning, finished, duration } }
const battleRooms = {};

// roomCounts: { [battleId]: { player1: 0|1, player2: 0|1, spectators: number } }
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
  for (const battleId in battleRooms) {
    counts[battleId] = getRoomCounts(battleId);
  }
  io.emit("allRoomCounts", counts);
};

io.on("connection", (socket) => {
  const playerId = socket.handshake.auth.playerId;
  socket.playerId = playerId;

  // Send current room counts on connect
  socket.emit("allRoomCounts", (() => {
    const counts = {};
    for (const battleId in battleRooms) counts[battleId] = getRoomCounts(battleId);
    return counts;
  })());

  socket.on("joinBattle", async ({ battleId, role }) => {
    if (!battleRooms[battleId]) {
      const battle = await prisma.battle.findUnique({ where: { id: battleId } });
      if (!battle) { socket.emit("battleNotFound"); return; }
      battleRooms[battleId] = {
        owner: battle.ownerId,
        player1: null,
        player2: null,
        spectators: new Set(),
        timeLeft: null,
        timerRunning: false,
        finished: false,
        duration: null,
        player1Code: "",
        player2Code: "",
        player1Output: null,
        player2Output: null,
      };
    }

    const room = battleRooms[battleId];
    socket.emit("ownerUpdate", room.owner);

    if (role === "player1") {
      if (room.player1 && room.player1 !== socket.id) { socket.emit("roleTaken"); return; }
      room.player1 = socket.id;
    } else if (role === "player2") {
      if (room.player2 && room.player2 !== socket.id) { socket.emit("roleTaken"); return; }
      room.player2 = socket.id;
    } else {
      room.spectators.add(socket.id);
    }

    socket.currentBattle = battleId;
    socket.currentRole = role;
    socket.join(battleId);

    socket.emit("timerUpdate", room.timeLeft);
    socket.emit("roomUpdate", { ...room, spectators: room.spectators.size });
    socket.emit("battleStatus", {
      started: room.timerRunning || room.finished,
      finished: room.finished,
    });

    // Send existing code to new joiner
    socket.emit("codeUpdate", { player: "player1", code: room.player1Code });
    socket.emit("codeUpdate", { player: "player2", code: room.player2Code });

    // Send existing outputs to spectator
    if (role === "spectator") {
      if (room.player1Output) socket.emit("runResult", { player: "player1", ...room.player1Output });
      if (room.player2Output) socket.emit("runResult", { player: "player2", ...room.player2Output });
    }

    io.to(battleId).emit("roomUpdate", { ...room, spectators: room.spectators.size });
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

  socket.on("resetTimer", ({ battleId, duration }) => {
    const room = battleRooms[battleId];
    if (!room || socket.playerId !== room.owner) return;
    room.timerRunning = false;
    room.finished = false;
    room.timeLeft = duration || room.duration;
    io.to(battleId).emit("timerReset", room.timeLeft);
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

  socket.on("finishBattle", ({ battleId, player }) => {
    const room = battleRooms[battleId];
    if (!room || room.finished) return;
    room.finished = true;
    room.timerRunning = false;
    io.to(battleId).emit("battleFinished", player);
  });

  socket.on("cursorMove", ({ battleId, player, position }) => {
    socket.to(battleId).emit("cursorMove", { player, position });
  });

  socket.on("disconnect", () => {
    for (const battleId in battleRooms) {
      const room = battleRooms[battleId];
      if (room.player1 === socket.id) room.player1 = null;
      if (room.player2 === socket.id) room.player2 = null;
      if (room.spectators) room.spectators.delete(socket.id);
      io.to(battleId).emit("roomUpdate", { ...room, spectators: room.spectators.size });
    }
    broadcastRoomCounts();
  });
});

// Timer tick
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

// GET all battles with room counts
app.get("/battles", async (req, res) => {
  try {
    const battles = await prisma.battle.findMany({ include: { owner: true } });
    const battlesWithCounts = battles.map((b) => ({
      ...b,
      counts: getRoomCounts(b.id),
    }));
    res.json(battlesWithCounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch battles" });
  }
});

// GET battle by ID
app.get("/battles/:id", async (req, res) => {
  try {
    const battle = await prisma.battle.findUnique({
      where: { id: req.params.id },
      include: { testCases: true },
    });
    res.json(battle);
  } catch {
    res.status(500).json({ error: "Failed to fetch battle" });
  }
});

// Create battle
app.post("/battle", async (req, res) => {
  const { title, description, ownerId } = req.body;
  if (!ownerId) return res.status(400).json({ error: "ownerId required" });
  try {
    // Upsert user so owner always exists
    await prisma.user.upsert({
      where: { id: ownerId },
      update: {},
      create: { id: ownerId, username: "Player_" + ownerId.slice(0, 6) },
    });
    const battle = await prisma.battle.create({
      data: { title, description, ownerId },
    });
    res.json(battle);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create battle" });
  }
});

// Delete battle
app.delete("/battle/:id", async (req, res) => {
  const { id } = req.params;
  const { ownerId } = req.body;
  try {
    const battle = await prisma.battle.findUnique({ where: { id } });
    if (!battle) return res.status(404).json({ error: "Battle not found" });
    if (battle.ownerId !== ownerId) return res.status(403).json({ error: "Not owner" });
    await prisma.battle.delete({ where: { id } });
    // Clean up room
    delete battleRooms[id];
    broadcastRoomCounts();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete battle" });
  }
});

// Run code
app.post("/run", async (req, res) => {
  const { code, input, language } = req.body;
  try {
    const result = await runCode(code, input, language || "python");
    res.json({ output: result });
  } catch (err) {
    res.status(500).json({ output: "ERROR: " + err.message });
  }
});

// Submit code
app.post("/submit", async (req, res) => {
  const { userId, battleId, code, language } = req.body;
  try {
    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      include: { testCases: true },
    });
    if (!battle) return res.status(404).json({ error: "Battle not found" });

    let score = 0;
    for (const test of battle.testCases) {
      const result = await runCode(code, test.input, language || "python");
      if (result.trim() === test.expected.trim()) score++;
    }

    const submission = await prisma.submission.create({
      data: { code, score, userId, battleId },
    });

    res.json({ score, total: battle.testCases.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Submission failed" });
  }
});

// Create user
app.post("/users", async (req, res) => {
  const { id, username } = req.body;
  try {
    const user = await prisma.user.upsert({
      where: { id },
      update: { username },
      create: { id, username },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Create user failed" });
  }
});

// Leaderboard
app.get("/leaderboard/:battleId", async (req, res) => {
  try {
    const leaderboard = await prisma.submission.groupBy({
      by: ["userId"],
      where: { battleId: req.params.battleId },
      _max: { score: true },
      orderBy: { _max: { score: "desc" } },
    });
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// Run code helper - supports Python and Java
function runCode(code, input, language) {
  return new Promise((resolve, reject) => {
    let filePath, command, args;

    if (language === "java") {
      const dir = path.join(process.cwd(), "tmp_java_" + Date.now());
      fs.mkdirSync(dir, { recursive: true });
      // Extract class name
      const match = code.match(/public\s+class\s+(\w+)/);
      const className = match ? match[1] : "Main";
      filePath = path.join(dir, `${className}.java`);
      fs.writeFileSync(filePath, code);

      // Compile first
      const compile = spawn("javac", [filePath]);
      let compileErr = "";
      compile.stderr.on("data", (d) => (compileErr += d.toString()));
      compile.on("close", (code) => {
        if (code !== 0) {
          fs.rmSync(dir, { recursive: true, force: true });
          return resolve("COMPILE ERROR:\n" + compileErr);
        }
        // Run
        const run = spawn("java", ["-cp", dir, className]);
        let out = "", err = "";
        if (input) { run.stdin.write(input); run.stdin.end(); }
        run.stdout.on("data", (d) => (out += d.toString()));
        run.stderr.on("data", (d) => (err += d.toString()));
        run.on("close", () => {
          fs.rmSync(dir, { recursive: true, force: true });
          resolve(err ? "RUNTIME ERROR:\n" + err : out);
        });
      });
    } else {
      // Python
      filePath = path.join(process.cwd(), "temp_" + Date.now() + ".py");
      fs.writeFileSync(filePath, code);
      const py = spawn("python3", [filePath]);
      let out = "", err = "";
      if (input) { py.stdin.write(input); py.stdin.end(); }
      py.stdout.on("data", (d) => (out += d.toString()));
      py.stderr.on("data", (d) => (err += d.toString()));
      py.on("close", () => {
        try { fs.unlinkSync(filePath); } catch {}
        resolve(err ? "ERROR:\n" + err : out);
      });
    }
  });
}

server.listen(3000, () => console.log("Server running on port 3000"));
