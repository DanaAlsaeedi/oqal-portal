import { execSync } from "child_process";

try {
  console.log("Running prisma db push...");
  execSync("npx prisma db push", { stdio: "inherit" });
  console.log("prisma db push completed.");
} catch (e) {
  console.error("prisma db push failed:", e.message);
}

try {
  console.log("Running seed...");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
  console.log("Seed completed.");
} catch (e) {
  console.error("Seed failed:", e.message);
}

try {
  console.log("Starting Next.js...");
  execSync("npx next start", { stdio: "inherit" });
} catch (e) {
  console.error("Next.js failed:", e.message);
  process.exit(1);
}
