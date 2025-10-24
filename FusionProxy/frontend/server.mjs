import express from "express";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 8000;
const host = process.env.HOST || "0.0.0.0";

app.use(morgan("combined"));
app.use(express.static(path.join(__dirname)));

app.listen(port, host, () => {
  console.log(`FusionProxy frontend listening on: ${host}:${port}`)
});
