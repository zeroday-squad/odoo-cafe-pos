require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const { app, setSocket } = require("./app");

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

setSocket(io);

io.on("connection", (socket) => {
  socket.emit("kitchen:connected", { ok: true });
});

server.listen(PORT, () => {
  console.log(`Odoo Cafe POS API running on http://localhost:${PORT}`);
});
