import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@oqal.ai";
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.log("ADMIN_PASSWORD not set, skipping seed.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin user already exists, skipping seed.");
    return;
  }

  const hashed = await hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      name: "Oqal Admin",
      password: hashed,
      role: "admin",
      company: "Oqal AI",
    },
  });
  console.log(`Admin user created: ${email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
