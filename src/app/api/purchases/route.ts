import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/purchases - List purchase orders with supplier info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    const where: Prisma.PurchaseOrderWhereInput = {
      ...(search && {
        OR: [
          { invoiceNo: { contains: search, mode: 'insensitive' } },
          { supplier: { name: { contains: search, mode: 'insensitive' } } },
          { notes: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(status && { status }),
    }

    const [orders, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          items: {
            include: {
              medicine: {
                include: {
                  category: true,
                  manufacturer: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      db.purchaseOrder.count({ where }),
    ])

    return NextResponse.json({
      orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Purchases GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 })
  }
}

// POST /api/purchases - Create purchase order with items (also creates batches and adjusts stock)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { supplierId, items, dueDate, notes, paymentMode } = body

    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'supplierId and items are required' },
        { status: 400 }
      )
    }

    // Generate invoice number
    const lastPO = await db.purchaseOrder.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { invoiceNo: true },
    })
    let poNumber = 'PO-2024-0001'
    if (lastPO?.invoiceNo) {
      const match = lastPO.invoiceNo.match(/PO-\d{4}-(\d+)/)
      if (match) {
        poNumber = `PO-${new Date().getFullYear()}-${String(parseInt(match[1]) + 1).padStart(4, '0')}`
      }
    }

    // Calculate totals
    let subtotal = 0
    let totalGst = 0
    const itemsData = []

    for (const item of items) {
      const itemSubtotal = item.costPrice * item.quantity
      const itemGst = Math.round(itemSubtotal * (item.gstRate || 5) / 100 * 100) / 100
      const itemTotal = Math.round((itemSubtotal + itemGst) * 100) / 100

      subtotal += itemSubtotal
      totalGst += itemGst

      itemsData.push({
        medicineId: item.medicineId,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
        hsnCode: item.hsnCode,
        gstRate: item.gstRate || 5,
        costPrice: item.costPrice,
        mrp: item.mrp,
        quantity: item.quantity,
        freeQty: item.freeQty || 0,
        discount: item.discount || 0,
        gstAmount: itemGst,
        totalAmount: itemTotal,
        receivedQty: item.quantity,
      })
    }

    const totalAmount = Math.round((subtotal + totalGst) * 100) / 100

    // Create purchase order
    const order = await db.purchaseOrder.create({
      data: {
        invoiceNo: poNumber,
        supplierId,
        date: new Date(),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        subtotal: Math.round(subtotal * 100) / 100,
        gstAmount: Math.round(totalGst * 100) / 100,
        totalAmount,
        paidAmount: 0,
        status: 'received',
        paymentStatus: 'unpaid',
        paymentMode: paymentMode || undefined,
        notes,
        items: { create: itemsData },
      },
      include: {
        supplier: true,
        items: { include: { medicine: true } },
      },
    })

    // Create or update batches and create stock adjustments
    for (const item of items) {
      // Check if batch already exists for this medicine
      const existingBatch = await db.medicineBatch.findFirst({
        where: {
          medicineId: item.medicineId,
          batchNo: item.batchNo,
        },
      })

      if (existingBatch) {
        const previousStock = existingBatch.currentStock
        const newStock = previousStock + item.quantity

        await db.medicineBatch.update({
          where: { id: existingBatch.id },
          data: { currentStock: newStock },
        })

        // Create stock adjustment
        await db.stockAdjustment.create({
          data: {
            batchId: existingBatch.id,
            type: 'purchase',
            quantity: item.quantity,
            previousStock,
            newStock,
            referenceId: order.id,
            notes: `Purchase order ${poNumber}`,
          },
        })
      } else {
        // Create new batch
        const sellingPrice = Math.round((item.mrp || item.costPrice * 1.5) * 0.95 * 100) / 100
        const wholesalePrice = Math.round((item.mrp || item.costPrice * 1.5) * 0.88 * 100) / 100

        const batch = await db.medicineBatch.create({
          data: {
            medicineId: item.medicineId,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : new Date(new Date().getFullYear() + 2, 11, 31),
            costPrice: item.costPrice,
            mrp: item.mrp || item.costPrice * 1.5,
            sellingPrice,
            wholesalePrice,
            openingStock: item.quantity,
            currentStock: item.quantity,
          },
        })

        // Create stock adjustment
        await db.stockAdjustment.create({
          data: {
            batchId: batch.id,
            type: 'purchase',
            quantity: item.quantity,
            previousStock: 0,
            newStock: item.quantity,
            referenceId: order.id,
            notes: `Purchase order ${poNumber} - New batch`,
          },
        })
      }
    }

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    console.error('Purchase POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create purchase order' },
      { status: 400 }
    )
  }
}
