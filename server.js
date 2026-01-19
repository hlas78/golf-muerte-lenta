const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const port = parseInt(process.env.PORT, 10) || 3000;

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new Server(httpServer, {
    path: "/socket",
    cors: {
      origin: "*",
    },
  });

  const presence = new Map();

  io.on("connection", (socket) => {
    socket.on("round:join", (roundId) => {
      socket.join(`round:${roundId}`);
    });

    socket.on("presence:join", ({ roundId, user }) => {
      if (!roundId || !user?._id) {
        return;
      }
      const room = `round:${roundId}`;
      socket.join(room);
      presence.set(socket.id, { roundId, user });

      const users = Array.from(presence.values())
        .filter((entry) => entry.roundId === roundId)
        .map((entry) => entry.user);

      io.to(room).emit("presence:update", users);
    });

    socket.on("scorecard:update", ({ roundId, payload }) => {
      socket.to(`round:${roundId}`).emit("scorecard:update", payload);
    });

    socket.on("disconnect", () => {
      const entry = presence.get(socket.id);
      if (entry) {
        presence.delete(socket.id);
        const room = `round:${entry.roundId}`;
        const users = Array.from(presence.values())
          .filter((item) => item.roundId === entry.roundId)
          .map((item) => item.user);
        io.to(room).emit("presence:update", users);
      }
    });
  });

  httpServer.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Golf Muerte Lenta listening on http://localhost:${port}`);
  });
});
