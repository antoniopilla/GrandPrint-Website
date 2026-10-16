const path = require("node:path");
const { spawn } = require("node:child_process");
const { config, validateConfig, systemEnv } = require("./config.cjs");
const [command, ...options] = process.argv.slice(2);
validateConfig();
if (options.some(option => option !== "--confirm-local")) throw new Error("Unknown demo option; targets cannot be overridden.");
if (command === "inspect") {
  console.log(JSON.stringify({ mode: "local-synthetic-only", api: config.apiOrigin, client: config.clientOrigin, mongoUri: config.mongoUri, database: config.database, stateDirectory: config.stateDir, uploads: "local filesystem", emailViewer: `${config.apiOrigin}/portfolio-demo/mail`, environmentFiles: "never loaded", productionStartup: "never imported", dependencies: "existing client/server node_modules; Node 22" }, null, 2));
} else {
  if (!["api", "client", "seed", "test"].includes(command)) throw new Error("Commands: inspect, test, seed --confirm-local, api --confirm-local, client --confirm-local");
  if (command !== "test" && !options.includes("--confirm-local")) throw new Error("Review inspect output, then explicitly pass --confirm-local.");
  const file = path.join(__dirname, command === "test" ? "safety.test.cjs" : `${command}.cjs`);
  const child = spawn(process.execPath, command === "test" ? ["--test", file] : [file, "--confirm-local"], {
    cwd: config.root, env: { ...systemEnv(), GRANDPRINT_PORTFOLIO_DEMO: "1" }, stdio: "inherit",
  });
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
