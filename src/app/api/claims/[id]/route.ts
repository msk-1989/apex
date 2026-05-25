import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/claims/[id] - Get single claim
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const claim = await db.claim.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, phone: true, email: true, address: true } },
        purchaseOrder: { select: { id: true, invoiceNo: true, date: true, totalAmount: true } },
        batch: {
          select: {
            id: true,
            batchNo: true,
            expiryDate: true,
            currentStock: true,
            costPrice: true,
            mrp: true,
            medicine: { select: { id: true, name: true, form: true, strength: true, manufacturer: { select: { name: true } } } },
          },
        },
      },
    })

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    return NextResponse.json({ claim })
  } catch (error) {
    console.error('Claim GET by ID error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claim' },
      { status: 500 }
    )
  }
}

// PUT /api/claims/[id] - Update claim status (approve/reject/settle)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.claim.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    const now = new Date()
    const updateData: Record<string, unknown> = {}

    switch (body.status) {
      case 'approved':
        updateData.status = 'approved'
        updateData.approvedBy = body.approvedBy || 'Admin'
        updateData.approvedAt = now
        break
      case 'rejected':
        updateData.status = 'rejected'
        updateData.approvedBy = body.approvedBy || 'Admin'
        updateData.approvedAt = now
        updateData.notes = body.notes ? `${existing.notes || ''}\n[Rejected: ${body.notes}]` : existing.notes
        break
      case 'settled':
        updateData.status = 'settled'
        updateData.settledAt = now
        updateData.creditNoteNo = body.creditNoteNo || null
        if (body.settledAt) {
          updateData.settledAt = new Date(body.settledAt)
        }
        break
      default:
        // Generic field updates
        if (body.notes !== undefined) updateData.notes = body.notes
        if (body.quantity !== undefined) {
          updateData.quantity = body.quantity
          updateData.totalAmount = body.quantity * existing.unitCost
        }
    }

    const claim = await db.claim.update({
      where: { id },
      data: updateData,
      include: {
        supplier: { select: { id: true, name: true } },
        batch: {
          select: {
            id: true,
            batchNo: true,
            expiryDate: true,
            currentStock: true,
            medicine: { select: { id: true, name: true, form: true, strength: true } },
          },
        },
        purchaseOrder: { select: { id: true, invoiceNo: true } },
      },
    })

    return NextResponse.json({ claim })
  } catch (error) {
    console.error('Claim PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update claim' },
      { status: 400 }
    )
  }
}
