import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/unit-conversions?medicineId=X
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const medicineId = searchParams.get('medicineId') || ''

    if (!medicineId) {
      return NextResponse.json({ conversions: [] })
    }

    const conversions = await db.unitConversion.findMany({
      where: {
        medicineId,
        isActive: true,
      },
      orderBy: { factor: 'desc' },
    })

    return NextResponse.json({ conversions })
  } catch (error) {
    console.error('Unit Conversions GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch unit conversions' }, { status: 500 })
  }
}
