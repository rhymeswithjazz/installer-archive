#!/bin/sh
set -e

echo "=== Installer Archive Startup ==="

# Run Prisma migrations to ensure database is set up
echo "Running database migrations..."
npx prisma migrate deploy

# Check if admin user needs to be created
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "Ensuring admin user exists..."
  node -e "
    const bcrypt = require('bcryptjs');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    async function main() {
      const email = process.env.ADMIN_EMAIL;
      const password = process.env.ADMIN_PASSWORD;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        const hashedPassword = await bcrypt.hash(password, 12);
        await prisma.user.create({
          data: { email, password: hashedPassword, name: 'Admin' }
        });
        console.log('Admin user created: ' + email);
      } else {
        console.log('Admin user already exists: ' + email);
      }
    }

    main().catch(console.error).finally(() => prisma.\$disconnect());
  "
fi

# Start the application
echo "Starting Next.js server..."
exec node server.js
