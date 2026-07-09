// build.mjs — bundla src/app.jsx → dist/app.js e copia public/ pra dist/ (mesmo padrão da LP-V4)
import { execSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
cpSync("public", "dist", { recursive: true });
execSync(
  "npx --yes esbuild src/app.jsx --bundle --minify --target=es2018 --outfile=dist/app.js",
  { stdio: "inherit" }
);
console.log("OK -> dist/");
