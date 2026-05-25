import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/schemes/[id] - Get single scheme
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const scheme = await db.scheme.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        manufacturer: { select: { id: true, name: true } },
        medicine: { select: { id: true, name: true } },
        batches: true,
        saleItems: true,
      },
    })

    if (!scheme) {
      return NextResponse.json({ error: 'Scheme not found' }, { status: 404 })
    }

    return NextResponse.json({ scheme })
  } catch (error) {
    console.error('Scheme GET by ID error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scheme' },
      { status: 500 }
    )
  }
}

// PUT /api/schemes/[id] - Update scheme or toggle activation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.scheme.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Scheme not found' }, { status: 404 })
    }

    const scheme = await db.scheme.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.supplierId !== undefined && { supplierId: body.supplierId || null }),
        ...(body.buyQty !== undefined && { buyQty: body.buyQty ?? null }),
        ...(body.getQty !== undefined && { getQty: body.getQty ?? null }),
        ...(body.flatDiscount !== undefined && { flatDiscount: body.flatDiscount ?? null }),
        ...(body.minQty !== undefined && { minQty: body.minQty ?? null }),
        ...(body.maxQty !== undefined && { maxQty: body.maxQty ?? null }),
        ...(body.qtyDiscountPct !== undefined && { qtyDiscountPct: body.qtyDiscountPct ?? null }),
        ...(body.validFrom !== undefined && { validFrom: body.validFrom ? new Date(body.validFrom) : null }),
        ...(body.validTo !== undefined && { validTo: body.validTo ? new Date(body.validTo) : null }),
        ...(body.scope !== undefined && { scope: body.scope }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId || null }),
        ...(body.manufacturerId !== undefined && { manufacturerId: body.manufacturerId || null }),
        ...(body.medicineId !== undefined && { medicineId: body.medicineId || null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        manufacturer: { select: { id: true, name: true } },
        medicine: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ scheme })
  } catch (error) {
    console.error('Scheme PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update scheme' },
      { status: 400 }
    )
  }
}
