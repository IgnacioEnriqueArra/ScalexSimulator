import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import path from "path";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const PORT = 3000;

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Host creates a room
    socket.on("createRoom", (roomCode) => {
      socket.join(roomCode);
      console.log(`Host ${socket.id} created room: ${roomCode}`);
    });

    // Client joins a room
    socket.on("joinRoom", (roomCode, callback) => {
      const room = io.sockets.adapter.rooms.get(roomCode);
      if (room) {
        socket.join(roomCode);
        console.log(`Client ${socket.id} joined room: ${roomCode}`);
        // Notify host that a controller connected
        socket.to(roomCode).emit("controllerConnected");
        callback({ success: true });
      } else {
        callback({ success: false, message: "Room not found" });
      }
    });

    // Controller sends acceleration state
    socket.on("accelerationChange", (roomCode, isAccelerating) => {
      // Forward to the host
      socket.to(roomCode).emit("accelerationChange", isAccelerating);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
