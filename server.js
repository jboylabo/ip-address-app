const express = require("express");

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 3000);

const app = express();

app.get("/", (req, res) => {
  res.json({
    boundHost: HOST,
    port: PORT,
    serverSeenLocalAddress: req.socket.localAddress,
    clientRemoteAddress: req.socket.remoteAddress,
  });
});

app.listen(PORT, HOST, () => {
  console.log(`listening on http://${HOST}:${PORT}`);
});
