import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...\n");

  // Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "changeme";

  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: "Admin",
      },
    });
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  // Import existing data if available
  const backupPath = "/tmp/installer-backup/installer-archive.json";

  if (fs.existsSync(backupPath)) {
    console.log("\nImporting existing data from backup...");

    const data = JSON.parse(fs.readFileSync(backupPath, "utf-8"));

    // Import issues
    console.log(`Importing ${data.issues.length} issues...`);
    for (const issue of data.issues) {
      await prisma.issue.upsert({
        where: { url: issue.url },
        update: {},
        create: {
          id: issue.id,
          title: issue.title,
          url: issue.url,
          date: issue.date ? new Date(issue.date) : null,
          issueNumber: issue.issueNumber,
          scrapedAt: new Date(),
        },
      });
    }

    // Import recommendations
    console.log(`Importing ${data.recommendations.length} recommendations...`);
    let imported = 0;
    let skipped = 0;

    for (const rec of data.recommendations) {
      // Check if issue exists
      const issue = await prisma.issue.findUnique({
        where: { id: rec.issueId },
      });

      if (!issue) {
        skipped++;
        continue;
      }

      // Handle tags
      const tagConnections = [];
      if (rec.tags && Array.isArray(rec.tags)) {
        for (const tagName of rec.tags) {
          const tag = await prisma.tag.upsert({
            where: { name: tagName },
            update: {},
            create: { name: tagName },
          });
          tagConnections.push({ id: tag.id });
        }
      }

      await prisma.recommendation.create({
        data: {
          title: rec.title,
          url: rec.url,
          description: rec.description,
          category: rec.category || "articles",
          sectionName: rec.sectionName,
          isPrimaryLink: rec.isPrimaryLink || false,
          isCrowdsourced: rec.isCrowdsourced || false,
          contributorName: rec.contributorName,
          hidden: rec.hidden || false,
          dead: rec.dead || false,
          issueId: rec.issueId,
          tags: {
            connect: tagConnections,
          },
        },
      });
      imported++;
    }

    console.log(`Imported ${imported} recommendations (${skipped} skipped)`);
  } else {
    console.log("\nNo backup data found at", backupPath);
    console.log("Run the scraper to populate the database.");
  }

  // Print stats
  const issueCount = await prisma.issue.count();
  const recCount = await prisma.recommendation.count();
  const tagCount = await prisma.tag.count();

  console.log("\n=== Database Stats ===");
  console.log(`Issues: ${issueCount}`);
  console.log(`Recommendations: ${recCount}`);
  console.log(`Tags: ${tagCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
