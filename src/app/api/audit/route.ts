import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/audit - List audit logs with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const moduleName = searchParams.get('module') || ''
    const action = searchParams.get('action') || ''
    const entityType = searchParams.get('entityType') || ''
    const entityId = searchParams.get('entityId') || ''
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const userId = searchParams.get('userId') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const where: Prisma.AuditLogWhereInput = {
      ...(moduleName && { module: moduleName }),
      ...(action && { action }),
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(userId && { userId }),
      ...(dateFrom && dateTo && {
        createdAt: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo),
        },
      }),
      ...(dateFrom && !dateTo && {
        createdAt: {
          gte: new Date(dateFrom),
        },
      }),
      ...(!dateFrom && dateTo && {
        createdAt: {
          lte: new Date(dateTo),
        },
      }),
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Audit GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}

// POST /api/audit - Create audit log entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { module, action, entityId, entityType, fieldName, oldValue, newValue, description, userId, ipAddress } = body

    if (!module || !action || !entityId || !entityType) {
      return NextResponse.json({ error: 'module, action, entityId, and entityType are required' }, { status: 400 })
    }

    const log = await db.auditLog.create({
      data: {
        module,
        action,
        entityId,
        entityType,
        fieldName: fieldName || null,
        oldValue: oldValue !== undefined ? String(oldValue) : null,
        newValue: newValue !== undefined ? String(newValue) : null,
        description: description || null,
        userId: userId || null,
        ipAddress: ipAddress || null,
      },
    })

    return NextResponse.json({ log }, { status: 201 })
  } catch (error) {
    console.error('Audit POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create audit log' },
      { status: 400 }
    )
  }
}
