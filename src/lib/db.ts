import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Read a variable directly from the .env file (bypasses stale shell env vars).
 * Falls back to process.env if .env file doesn't exist or var is not found.
 */
function readEnvFile(varName: string): string | undefined {
  try {
    const envPath = join(process.cwd(), '.env')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith(`${varName}=`)) {
        let value = trimmed.substring(varName.length + 1)
        // Strip surrounding quotes
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        return value
      }
    }
  } catch {
    // .env file not found – fall through to process.env
  }
  return undefined
}

function getDatabaseUrl(): string {
  const envVal = process.env.DATABASE_URL || ''
  const fileVal = readEnvFile('DATABASE_URL') || ''

  // If process.env has a non-PostgreSQL URL (stale SQLite leftover),
  // prefer the .env file value instead
  if (
    fileVal &&
    !envVal.startsWith('postgresql://') &&
    !envVal.startsWith('postgres://')
  ) {
    return fileVal
  }

  return envVal || fileVal
}

function getDirectUrl(): string | undefined {
  const envVal = process.env.DIRECT_URL || ''
  const fileVal = readEnvFile('DIRECT_URL') || ''

  if (
    fileVal &&
    !envVal.startsWith('postgresql://') &&
    !envVal.startsWith('postgres://')
  ) {
    return fileVal
  }

  return envVal || fileVal || undefined
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const url = getDatabaseUrl()
if (!url) {
  console.error(
    '[db] FATAL: DATABASE_URL is not set. Check your .env file.'
  )
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : [],
    datasources: {
      db: {
        url,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
