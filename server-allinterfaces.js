const express = require("express");
const app = express();

const HOST = "0.0.0.0";
const PORT = 3002;

app.get("/", (_req, res) => {
  res.json({
    message: "Hello from 0.0.0.0 (all interfaces)",
    host: HOST,
    port: PORT,
    info: "This server binds to 0.0.0.0 — reachable from outside the container via port mapping.",
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
