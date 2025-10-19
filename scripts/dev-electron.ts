import { spawn } from "node:child_process";
import path from "node:path";
import waitOn from "wait-on";

const rendererUrl = "http://localhost:5173";
const distMainEntry = path.join(process.cwd(), "dist", "main", "index.js");

async function main() {
  await waitOn({
    resources: [rendererUrl, distMainEntry],
    timeout: 45_000,
    interval: 300
  });

  const electronBinary = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "electron.cmd" : "electron"
  );

  const child = spawn(electronBinary, ["."] , {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: rendererUrl
    }
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("Failed to launch Electron in dev mode", error);
  process.exit(1);
});
