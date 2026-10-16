const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createRequire } = require("node:module");
const { config, requireOptIn } = require("./config.cjs");
const { installSocketGuard } = require("./network.cjs");
function viteIsolationOptions() {
  return { root: path.join(config.root, "client"), configFile: false, envDir: false, envFile: false, envPrefix: [] };
}
async function main() {
  requireOptIn();
  installSocketGuard([config.apiPort, config.clientPort]);
  const clientDir = path.join(config.root, "client");
  const clientRequire = createRequire(path.join(clientDir, "package.json"));
  const { createServer } = await import(pathToFileURL(clientRequire.resolve("vite")).href);
  const { default: react } = await import(pathToFileURL(clientRequire.resolve("@vitejs/plugin-react")).href);
  const csp = `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${config.apiOrigin} ws://127.0.0.1:3212; img-src 'self' ${config.apiOrigin} data:; font-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  const server = await createServer({
    ...viteIsolationOptions(),
    plugins: [{
      name: "portfolio-local-sanitization", enforce: "pre",
      configResolved(resolved) {
        if (resolved.envDir !== false || resolved.configFile) throw new Error("Environment or original config loading was not disabled.");
      },
      transform(code, id) {
        if (!id.replaceAll("\\", "/").startsWith(clientDir.replaceAll("\\", "/") + "/src/")) return null;
        let safe = code;
        if (/\.css(?:\?|$)/.test(id)) safe = safe.replace(/@import\s+url\(['"]https?:\/\/[^)]*\);?/g, "");
        if (/\.[cm]?jsx?(?:\?|$)/.test(id)) safe = safe.replace(/https?:\/\/(?:www\.)?messenger\.com\/[^\s"'`<>]+/g, `${config.apiOrigin}/portfolio-demo/contact`).replace(/\b09\d{9}\b/g, "09000000000").replace(/placeholder="e\.g\. [^"]+"/g, 'placeholder="Sample Customer A"');
        return safe === code ? null : { code: safe, map: null };
      },
    }, react()],
    define: { "import.meta.env.VITE_API_URL": JSON.stringify(config.apiOrigin), __ALLOW_LOCAL_API_FALLBACK__: "false" },
    server: { host: config.host, port: config.clientPort, strictPort: true, open: false, headers: { "Content-Security-Policy": csp, "X-Portfolio-Demo": "local-synthetic-data-only" } },
  });
  await server.listen();
  console.log(`GrandPrint local demo UI: ${config.clientOrigin}; environment files disabled.`);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close().then(() => process.exit(0)));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { viteIsolationOptions };
