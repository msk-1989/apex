import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/notifications - List notifications with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || ''
    const priority = searchParams.get('priority') || ''
    const isRead = searchParams.get('isRead')
    const modName = searchParams.get('module') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const where: Prisma.NotificationWhereInput = {
      ...(type && { type }),
      ...(priority && { priority }),
      ...(isRead !== null && isRead !== '' && { isRead: isRead === 'true' }),
      ...(modName && { module: modName }),
    }

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
    ])

    const unreadCount = await db.notification.count({ where: { isRead: false, isDismissed: false } })

    return NextResponse.json({
      notifications,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

// POST /api/notifications - Create notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, title, message, module, priority, referenceId, expiresAt } = body

    if (!type || !title || !message) {
      return NextResponse.json({ error: 'type, title, and message are required' }, { status: 400 })
    }

    const notification = await db.notification.create({
      data: {
        type,
        title,
        message,
        module: module || null,
        priority: priority || 'info',
        referenceId: referenceId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    console.error('Notifications POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create notification' },
      { status: 400 }
    )
  }
}

// PUT /api/notifications - Mark notification(s) as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, isRead, markAll } = body

    // Handle markAll: mark all unread notifications as read
    if (markAll) {
      const result = await db.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      })
      return NextResponse.json({ success: true, updatedCount: result.count })
    }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const notification = await db.notification.update({
      where: { id },
      data: {
        ...(isRead !== undefined && { isRead }),
      },
    })

    return NextResponse.json({ notification })
  } catch (error) {
    console.error('Notifications PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update notification' },
      { status: 400 }
    )
  }
}
