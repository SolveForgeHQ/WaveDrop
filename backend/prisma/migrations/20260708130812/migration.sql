-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "assignedTo" TEXT;

-- CreateTable
CREATE TABLE "IssueApplication" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IssueApplication_waveId_githubLogin_idx" ON "IssueApplication"("waveId", "githubLogin");

-- CreateIndex
CREATE UNIQUE INDEX "IssueApplication_issueId_githubLogin_key" ON "IssueApplication"("issueId", "githubLogin");

-- AddForeignKey
ALTER TABLE "IssueApplication" ADD CONSTRAINT "IssueApplication_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
