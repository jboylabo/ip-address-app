const express = require("express");
const app = express();

const HOST = "127.0.0.1";
const PORT = 3001;

app.get("/", (_req, res) => {
  res.json({
    message: "Hello from 127.0.0.1 (localhost only)",
    host: HOST,
    port: PORT,
    info: "This server binds to 127.0.0.1 — reachable only from inside the same machine/container.",
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
