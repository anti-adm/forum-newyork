// prisma.config.ts
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // никаких env, сразу строка
    url: 'file:./prisma/dev.db',
  },
});