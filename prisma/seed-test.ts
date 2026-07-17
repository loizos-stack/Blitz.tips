// Test-data seed (CLI). Thin wrapper over seedTestData() so the same logic backs
// both `npm run db:seed:test` and the temporary /api/admin/seed-test endpoint.
import { PrismaClient } from "@prisma/client";
import { seedTestData } from "../src/lib/test-seed";

const prisma = new PrismaClient();

seedTestData(prisma)
  .then((r) => console.log(`Test seed complete: ${r.handicappers} handicappers + ${r.fans} fans (password: password123).`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
