/**
 * Create Admin User Script
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts <email> <password>
 *
 * Example:
 *   npx tsx scripts/create-admin.ts admin@example.com mysecurepassword
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: npx tsx scripts/create-admin.ts <email> <password>");
    console.error("Example: npx tsx scripts/create-admin.ts admin@example.com mysecurepassword");
    process.exit(1);
  }

  const [email, password] = args;

  if (!email.includes("@")) {
    console.error("Error: Invalid email address");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters");
    process.exit(1);
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`User ${email} already exists.`);

    // Ask if they want to update the password
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question("Update password? (y/n): ", resolve);
    });
    rl.close();

    if (answer.toLowerCase() === "y") {
      const hashedPassword = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      });
      console.log(`Password updated for ${email}`);
    } else {
      console.log("No changes made.");
    }
  } else {
    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: "Admin",
      },
    });
    console.log(`Admin user created: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
