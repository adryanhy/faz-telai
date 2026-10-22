import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAppServer } from "./app.js";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../..");

// Em desenvolvimento, as chaves ficam num .env na raiz. Em produção vêm do painel do Render.
if (existsSync(join(ROOT_DIR, ".env"))) process.loadEnvFile(join(ROOT_DIR, ".env"));

const PORT = Number(process.env.PORT) || 3001;
const { httpServer } = createAppServer({ clientDist: join(ROOT_DIR, "client/dist") });

httpServer.listen(PORT, () => {
  console.log(`faz-telai ouvindo em http://localhost:${PORT}`);
});
