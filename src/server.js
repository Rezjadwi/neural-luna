import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const app = express();
app.use(express.static(PUBLIC_DIR));

const PORT = process.env.PORT || 3131;
app.listen(PORT, () => {
  console.log(`Agent console listening on http://localhost:${PORT}`);
});
