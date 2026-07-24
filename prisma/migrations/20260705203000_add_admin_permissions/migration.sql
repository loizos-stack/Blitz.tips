-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "adminPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
