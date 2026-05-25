import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/notifications/batch - Batch update notifications (mark all as read, dismiss multiple)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, isRead, isDismissed, markAllRead } = body

    // Mark all as read
    if (markAllRead) {
      const result = await db.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      })

      return NextResponse.json({ updated: result.count })
    }

    // Batch update specific IDs
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required when markAllRead is not set' }, { status: 400 })
    }

    const data: Record<string, boolean> = {}
    if (isRead !== undefined) data.isRead = isRead
    if (isDismissed !== undefined) data.isDismissed = isDismissed

    const result = await db.notification.updateMany({
      where: { id: { in: ids } },
      data,
    })

    return NextResponse.json({ updated: result.count })
  } catch (error) {
    console.error('Notifications batch PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to batch update notifications' },
      { status: 400 }
    )
  }
}
