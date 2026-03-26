-- CreateTable
CREATE TABLE "Subscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "userAgent" TEXT,
    "dataUpload" BIGINT,
    "dataDownload" BIGINT,
    "dataTotal" BIGINT,
    "expireAt" BIGINT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Proxy" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tag" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    CONSTRAINT "Proxy_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Filter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tag" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "proxyTypeFilterMode" TEXT NOT NULL,
    "proxyTypes" TEXT,
    "excludeRegex" TEXT,
    "includeRegex" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FilterOnSubscription" (
    "filterId" INTEGER NOT NULL,
    "subscriptionId" INTEGER NOT NULL,

    PRIMARY KEY ("filterId", "subscriptionId"),
    CONSTRAINT "FilterOnSubscription_filterId_fkey" FOREIGN KEY ("filterId") REFERENCES "Filter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FilterOnSubscription_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratorOnFilter" (
    "generatorId" INTEGER NOT NULL,
    "filterId" INTEGER NOT NULL,

    PRIMARY KEY ("generatorId", "filterId"),
    CONSTRAINT "GeneratorOnFilter_generatorId_fkey" FOREIGN KEY ("generatorId") REFERENCES "Generator" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeneratorOnFilter_filterId_fkey" FOREIGN KEY ("filterId") REFERENCES "Filter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Generator" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" JSONB,
    "url" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_name_key" ON "Subscription"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Filter_tag_key" ON "Filter"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "Generator_name_key" ON "Generator"("name");
