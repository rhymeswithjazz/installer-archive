-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "date" DATETIME,
    "issueNumber" INTEGER,
    "scrapedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'articles',
    "sectionName" TEXT,
    "isPrimaryLink" BOOLEAN NOT NULL DEFAULT false,
    "isCrowdsourced" BOOLEAN NOT NULL DEFAULT false,
    "contributorName" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "dead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "issueId" INTEGER NOT NULL,
    CONSTRAINT "Recommendation_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "_RecommendationToTag" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_RecommendationToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Recommendation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_RecommendationToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_url_key" ON "Issue"("url");

-- CreateIndex
CREATE INDEX "Recommendation_category_idx" ON "Recommendation"("category");

-- CreateIndex
CREATE INDEX "Recommendation_issueId_idx" ON "Recommendation"("issueId");

-- CreateIndex
CREATE INDEX "Recommendation_hidden_idx" ON "Recommendation"("hidden");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_RecommendationToTag_AB_unique" ON "_RecommendationToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_RecommendationToTag_B_index" ON "_RecommendationToTag"("B");
