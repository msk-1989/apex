import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/medicines/[id] - Get single medicine with all batches
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const medicine = await db.medicine.findUnique({
      where: { id },
      include: {
        category: true,
        manufacturer: true,
        batches: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!medicine) {
      return NextResponse.json({ error: 'Medicine not found' }, { status: 404 })
    }

    const totalStock = medicine.batches.reduce((sum, b) => sum + b.currentStock, 0)
    const totalValue = medicine.batches.reduce((sum, b) => sum + (b.costPrice * b.currentStock), 0)

    return NextResponse.json({
      ...medicine,
      totalStock,
      totalValue: Math.round(totalValue * 100) / 100,
      isLowStock: totalStock <= medicine.minStockLevel,
    })
  } catch (error) {
    console.error('Medicine GET by ID error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch medicine' },
      { status: 500 }
    )
  }
}

// PUT /api/medicines/[id] - Update medicine
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.medicine.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Medicine not found' }, { status: 404 })
    }

    const medicine = await db.medicine.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        genericName: body.genericName ?? existing.genericName,
        saltComposition: body.saltComposition ?? existing.saltComposition,
        categoryId: body.categoryId ?? existing.categoryId,
        manufacturerId: body.manufacturerId ?? existing.manufacturerId,
        hsnCode: body.hsnCode ?? existing.hsnCode,
        schedule: body.schedule ?? existing.schedule,
        strength: body.strength ?? existing.strength,
        form: body.form ?? existing.form,
        unit: body.unit ?? existing.unit,
        stripQty: body.stripQty ?? existing.stripQty,
        gstRate: body.gstRate ?? existing.gstRate,
        minStockLevel: body.minStockLevel ?? existing.minStockLevel,
        maxStockLevel: body.maxStockLevel ?? existing.maxStockLevel,
        rackNo: body.rackNo ?? existing.rackNo,
        isActive: body.isActive ?? existing.isActive,
      },
      include: {
        category: true,
        manufacturer: true,
      },
    })

    return NextResponse.json({ medicine })
  } catch (error) {
    console.error('Medicine PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update medicine' },
      { status: 400 }
    )
  }
}

// DELETE /api/medicines/[id] - Soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.medicine.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Medicine not found' }, { status: 404 })
    }

    const medicine = await db.medicine.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ medicine, message: 'Medicine deactivated successfully' })
  } catch (error) {
    console.error('Medicine DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete medicine' },
      { status: 500 }
    )
  }
}
