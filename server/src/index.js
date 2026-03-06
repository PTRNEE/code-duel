import express from "express";
import pkg from "@prisma/client";

import { exec } from "child_process";
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
  cors: {
    origin: "*",
  },
});

const battleRooms = {};

io.on("connection", (socket) => {

  socket.on("joinBattle", ({ battleId, role }) => {

    if (!battleRooms[battleId]) {
      battleRooms[battleId] = {
        player1: null,
        player2: null
      };
    }

    const room = battleRooms[battleId];

    if (role === "player1") {

      if (room.player1) {
        socket.emit("roleTaken");
        return;
      }

      room.player1 = socket.id;
    }

    if (role === "player2") {

      if (room.player2) {
        socket.emit("roleTaken");
        return;
      }

      room.player2 = socket.id;
    }

    socket.join(battleId);

    io.to(battleId).emit("roomUpdate", room);
  });

  socket.on("codeUpdate", ({ battleId, player, code }) => {

    socket.to(battleId).emit("codeUpdate", {
      player,
      code
    });

  });

  socket.on("disconnect", () => {

    for (const battleId in battleRooms) {

      const room = battleRooms[battleId];

      if (room.player1 === socket.id) {
        room.player1 = null;
      }

      if (room.player2 === socket.id) {
        room.player2 = null;
      }

      io.to(battleId).emit("roomUpdate", room);
    }

  });

});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("CodeDuel API is running 🚀");
});

// GET battle by ID
app.get("/battles/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const battle = await prisma.battle.findUnique({
      where: { id },
      include: { testCases: true },
    });

    res.json(battle);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch battle" });
  }
});

// GET all battles
app.get("/battles", async (req, res) => {
  try {
    const battles = await prisma.battle.findMany();
    res.json(battles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch battles" });
  }
});

// Create a new battle
app.post("/battle", async (req, res) => {
  const { title, description } = req.body;

  try {
    const battle = await prisma.battle.create({
      data: {
        title,
        description,
      },
    });

    res.json(battle);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create battle" });
  }
});

// Add test case to battle
app.post("/battle/:id/testcase", async (req, res) => {
  const { id } = req.params;
  const { input, expected } = req.body;

  try {
    const testCase = await prisma.testCase.create({
      data: {
        input,
        expected,
        battleId: id,
      },
    });

    res.json(testCase);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create test case" });
  }
});

// Create user
app.post("/users", async (req, res) => {
  const { username } = req.body;

  try {
    const user = await prisma.user.create({
      data: { username },
    });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Create user failed" });
  }
});

// // Run code without saving submission
// app.post("/run", async (req, res) => {

//   const { code, input } = req.body;

//   try {

//     const result = await runPython(code, input);

//     res.json({
//       output: result
//     });

//   } catch (err) {

//     res.json({
//       output: "ERROR"
//     });

//   }

// });

app.post("/run", async (req, res) => {

  const { code, input } = req.body;

  console.log("CODE:");
  console.log(code);

  console.log("INPUT:");
  console.log(input);

  const result = await runPython(code, input);

  console.log("RESULT:", result);

  res.json({ output: result });

});

// Handle code submission
app.post("/submit", async (req, res) => {
  const { userId, battleId, code } = req.body;

  try {
    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      include: { testCases: true },
    });

    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }

    let score = 0;

    for (const test of battle.testCases) {
      const result = await runPython(code, test.input);
      if (result.trim() === test.expected.trim()) {
        score++;
      }
    }

    const submission = await prisma.submission.create({
      data: {
        code,
        score,
        userId,
        battleId,
      },
    });

    res.json({ score, total: battle.testCases.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Submission failed" });
  }
});

// GET all users
app.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Fetch leaderboard for a battle
app.get("/leaderboard/:battleId", async (req, res) => {
  const { battleId } = req.params;

  try {
    const leaderboard = await prisma.submission.groupBy({
      by: ["userId"],
      where: { battleId },
      _max: {
        score: true,
      },
      orderBy: {
        _max: {
          score: "desc",
        },
      },
    });

    res.json(leaderboard);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

function runPython(code, input) {
  return new Promise((resolve, reject) => {

    const filePath = path.join(process.cwd(), "temp.py");

    fs.writeFileSync(filePath, code);

    const py = spawn("python", [filePath]);

    let output = "";
    let errorOutput = "";

    py.stdin.write(input);
    py.stdin.end();

    py.stdout.on("data", (data) => {
      output += data.toString();
    });

    py.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    py.on("close", () => {
      fs.unlinkSync(filePath);

      if (errorOutput) {
        console.log(errorOutput);
        resolve("ERROR");
      } else {
        resolve(output);
      }
    });

  });
}

// Start the server
server.listen(3000, () => {
  console.log("Server running on port 3000");
});