import { startTunnel } from "untun";

const port = Number(process.env.PORT) || 3000;

console.log(`Starting Cloudflare tunnel for port ${port}...`);

try {
  const tunnel = await startTunnel({ port });
  if (!tunnel) {
    console.error("Failed to start tunnel.");
    process.exit(1);
  }

  const url = await tunnel.getURL();
  console.log("\n========================================================");
  console.log(`🚀 Tunnel Active: ${url}`);
  console.log(`🔗 Forwarding to: http://localhost:${port}`);
  console.log(`📖 Swagger Docs:  ${url}/docs`);
  console.log("========================================================\n");

  // Check if local server is listening
  try {
    const res = await fetch(`http://localhost:${port}/docs`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      console.log(`✅ Local server is online on port ${port}. Requests will forward normally!`);
    }
  } catch {
    console.log(`⚠️  Local server is not reachable on port ${port} yet.`);
    console.log(`👉 Please run 'npm run dev' in another terminal to handle requests.\n`);
  }

  // Keep process alive
  process.stdin.resume();
} catch (err) {
  console.error("Tunnel error:", err);
  process.exit(1);
}
