// scripts/create-superadmin.mjs
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
});

const prisma = new PrismaClient({ adapter });

const USERNAME = 'superadmin';
const PASSWORD = 'ChangeMe123!';

async function main() {
  const existing = await prisma.user.findUnique({
    where: { username: USERNAME },
  });

  if (existing) {
    console.log(
      `Пользователь "${USERNAME}" уже существует (id=${existing.id}).`,
    );
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      username: USERNAME,
      passwordHash,
      role: 'SUPERADMIN',
      isActive: true,
      isSystem: true,
    },
  });

  console.log('Системный супер-админ создан:');
  console.log(`  username: ${USERNAME}`);
  console.log(`  password: ${PASSWORD}`);
  console.log(`  id:       ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });