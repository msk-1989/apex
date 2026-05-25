import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/inventory - List all batches with stock info, expiry/low stock alerts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lowStock = searchParams.get('lowStock') === 'true'
    const expiringSoon = searchParams.get('expiringSoon') === 'true'
    const outOfStock = searchParams.get('outOfStock') === 'true'
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    const now = new Date()
    const expiryThreshold = new Date(now)
    expiryThreshold.setDate(expiryThreshold.getDate() + 90)

    const where: Prisma.MedicineBatchWhereInput = {
      isActive: true,
      medicine: { isActive: true },
      ...(lowStock && {}),
      ...(expiringSoon && {
        expiryDate: { lte: expiryThreshold },
      }),
      ...(outOfStock && {}),
      ...(search && {
        OR: [
          { batchNo: { contains: search } },
          { medicine: {
            isActive: true,
            OR: [
              { name: { contains: search } },
              { genericName: { contains: search } },
            ],
          }},
        ],
      }),
    }

    const [batches, total] = await Promise.all([
      db.medicineBatch.findMany({
        where,
        include: {
          medicine: {
            include: {
              category: true,
              manufacturer: true,
            },
          },
        },
        orderBy: [
          { currentStock: 'asc' },
          { expiryDate: 'asc' },
        ],
        skip,
        take: limit,
      }),
      db.medicineBatch.count({ where }),
    ])

    // Filter low stock / out of stock client-side (need medicine minStockLevel)
    let filteredBatches = batches
    if (lowStock) {
      filteredBatches = batches.filter(b => b.currentStock > 0 && b.currentStock <= b.medicine.minStockLevel)
    }
    if (outOfStock) {
      filteredBatches = batches.filter(b => b.currentStock <= 0)
    }

    // Enrich with status info
    const enrichedBatches = filteredBatches.map(batch => {
      const daysUntilExpiry = Math.ceil(
        (new Date(batch.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      let stockStatus = 'normal'
      if (batch.currentStock <= 0) {
        stockStatus = 'out_of_stock'
      } else if (batch.currentStock <= batch.medicine.minStockLevel * 0.25) {
        stockStatus = 'critical'
      } else if (batch.currentStock <= batch.medicine.minStockLevel) {
        stockStatus = 'low'
      }

      let expiryStatus = 'safe'
      if (daysUntilExpiry <= 0) {
        expiryStatus = 'expired'
      } else if (daysUntilExpiry <= 30) {
        expiryStatus = 'urgent'
      } else if (daysUntilExpiry <= 90) {
        expiryStatus = 'expiring_soon'
      }

      return {
        id: batch.id,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        manufacturingDate: batch.manufacturingDate,
        costPrice: batch.costPrice,
        mrp: batch.mrp,
        sellingPrice: batch.sellingPrice,
        wholesalePrice: batch.wholesalePrice,
        currentStock: batch.currentStock,
        openingStock: batch.openingStock,
        location: batch.location,
        daysUntilExpiry,
        stockStatus,
        expiryStatus,
        medicine: {
          id: batch.medicine.id,
          name: batch.medicine.name,
          genericName: batch.medicine.genericName,
          strength: batch.medicine.strength,
          form: batch.medicine.form,
          unit: batch.medicine.unit,
          stripQty: batch.medicine.stripQty,
          minStockLevel: batch.medicine.minStockLevel,
          maxStockLevel: batch.medicine.maxStockLevel,
          hsnCode: batch.medicine.hsnCode,
          schedule: batch.medicine.schedule,
          category: batch.medicine.category,
          manufacturer: batch.medicine.manufacturer,
        },
      }
    })

    // Compute summary across all active batches (not just the current page)
    const [allBatches, allTotal] = await Promise.all([
      db.medicineBatch.findMany({
        where: { isActive: true, medicine: { isActive: true } },
        include: { medicine: true },
      }),
      0,
    ])

    const criticalThreshold = new Date(now)
    criticalThreshold.setDate(criticalThreshold.getDate() + 90)

    const totalValue = allBatches.reduce((sum, b) => sum + (b.costPrice * b.currentStock), 0)
    const lowStockCount = allBatches.filter(b => b.currentStock > 0 && b.currentStock <= b.medicine.minStockLevel).length
    const expiringSoonCount = allBatches.filter(b => {
      const days = Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return days <= 90 && days > 0
    }).length
    const outOfStockCount = allBatches.filter(b => b.currentStock <= 0).length

    return NextResponse.json({
      batches: enrichedBatches,
      summary: {
        totalStockValue: Math.round(totalValue * 100) / 100,
        lowStockCount,
        expiringSoonCount,
        outOfStockCount,
        totalBatches: allBatches.length,
      },
      pagination: {
        page,
        limit,
        total: lowStock || outOfStock ? filteredBatches.length : total,
        totalPages: Math.ceil((lowStock || outOfStock ? filteredBatches.length : total) / limit),
      },
    })
  } catch (error) {
    console.error('Inventory GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}

// POST /api/inventory - Stock adjustment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { batchId, newStock, notes } = body

    if (!batchId || newStock === undefined) {
      return NextResponse.json({ error: 'batchId and newStock are required' }, { status: 400 })
    }

    const batch = await db.medicineBatch.findUnique({ where: { id: batchId } })
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    const previousStock = batch.currentStock
    const updatedBatch = await db.medicineBatch.update({
      where: { id: batchId },
      data: { currentStock: newStock },
    })

    // Create adjustment record
    await db.stockAdjustment.create({
      data: {
        batchId,
        type: body.type || 'adjustment',
        quantity: newStock - previousStock,
        previousStock,
        newStock,
        notes,
      },
    })

    return NextResponse.json({ batch: updatedBatch, message: 'Stock adjusted successfully' })
  } catch (error) {
    console.error('Inventory POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to adjust stock' },
      { status: 400 }
    )
  }
}
