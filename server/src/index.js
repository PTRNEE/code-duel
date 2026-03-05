import express from "express";
import pkg from "@prisma/client";

import { exec } from "child_process";
import fs from "fs";
import path from "path";

import cors from "cors";

import http from "http";
import { Server } from "socket.io";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {

  console.log("user connected");

  socket.on("joinBattle", (battleId) => {

    socket.join(battleId);
    console.log("joined battle", battleId);

  });

  socket.on("codeUpdate", ({ battleId, player, code }) => {

    io.to(battleId).emit("codeUpdate", {
      player,
      code
    });

  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
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

// Helper function to run Python code
function runPython(code, input) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(process.cwd(), "temp.py");

    fs.writeFileSync(filePath, code);

    exec(`python temp.py ${input}`, (error, stdout, stderr) => {
      fs.unlinkSync(filePath);

      if (error) {
        return resolve("ERROR");
      }

      resolve(stdout);
    });
  });
}

// Start the server
server.listen(3000, () => {
  console.log("Server running on port 3000");
});