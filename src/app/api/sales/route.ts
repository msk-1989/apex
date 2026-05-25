import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/sales - List sales invoices
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const paymentMode = searchParams.get('paymentMode') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where: Prisma.SalesInvoiceWhereInput = {
      ...(search && {
        OR: [
          { invoiceNo: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { doctorName: { contains: search, mode: 'insensitive' } },
          { prescriptionNo: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(status && { status }),
      ...(paymentMode && { paymentMode }),
      ...(dateFrom && dateTo && {
        date: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo),
        },
      }),
    }

    const [invoices, total] = await Promise.all([
      db.salesInvoice.findMany({
        where,
        include: {
          customer: true,
          counter: true,
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
          payments: true,
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      db.salesInvoice.count({ where }),
    ])

    return NextResponse.json({
      invoices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Sales GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch sales invoices' }, { status: 500 })
  }
}

// POST /api/sales - Create sales invoice with items (deducts stock, creates adjustments)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerId, counterId, type, paymentMode, items, doctorName, prescriptionNo, notes, discount } = body

    if (!counterId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'counterId and items are required' },
        { status: 400 }
      )
    }

    // Generate invoice number
    const lastInv = await db.salesInvoice.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { invoiceNo: true },
    })
    let invNumber = `INV-${new Date().getFullYear()}-00001`
    if (lastInv?.invoiceNo) {
      const match = lastInv.invoiceNo.match(/INV-\d{4}-(\d+)/)
      if (match) {
        invNumber = `INV-${new Date().getFullYear()}-${String(parseInt(match[1]) + 1).padStart(5, '0')}`
      }
    }

    // Calculate totals
    let subtotal = 0
    let totalGst = 0
    let totalAmount = 0
    const itemsData = []

    // Validate stock availability and prepare items
    for (const item of items) {
      // Get the batch
      const batch = item.batchId
        ? await db.medicineBatch.findUnique({ where: { id: item.batchId } })
        : await db.medicineBatch.findFirst({
            where: { medicineId: item.medicineId, isActive: true, currentStock: { gt: 0 } },
            orderBy: { expiryDate: 'asc' },
          })

      if (!batch) {
        return NextResponse.json(
          { error: `No available batch found for medicine ${item.medicineId}` },
          { status: 400 }
        )
      }

      if (batch.currentStock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for batch ${batch.batchNo}. Available: ${batch.currentStock}, Requested: ${item.quantity}` },
          { status: 400 }
        )
      }

      const medicine = await db.medicine.findUnique({ where: { id: item.medicineId } })
      const gstRate = item.gstRate || medicine?.gstRate || 5
      const sellingPrice = item.sellingPrice || batch.sellingPrice
      const itemSubtotal = sellingPrice * item.quantity
      const itemGst = Math.round(itemSubtotal * gstRate / 100 * 100) / 100
      const itemTotal = Math.round((itemSubtotal + itemGst) * 100) / 100

      subtotal += itemSubtotal
      totalGst += itemGst
      totalAmount += itemTotal

      itemsData.push({
        medicineId: item.medicineId,
        batchId: batch.id,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        hsnCode: medicine?.hsnCode,
        gstRate,
        costPrice: batch.costPrice,
        mrp: batch.mrp,
        sellingPrice,
        quantity: item.quantity,
        freeQty: item.freeQty || 0,
        discount: item.discount || 0,
        gstAmount: itemGst,
        totalAmount: itemTotal,
      })
    }

    // Apply overall discount
    const discountAmount = discount || 0
    totalAmount = Math.max(0, Math.round((subtotal + totalGst - discountAmount) * 100) / 100)

    // Create invoice
    const invoice = await db.salesInvoice.create({
      data: {
        invoiceNo: invNumber,
        customerId: customerId || null,
        counterId,
        type: type || 'retail',
        date: new Date(),
        subtotal: Math.round(subtotal * 100) / 100,
        gstAmount: Math.round(totalGst * 100) / 100,
        discount: discountAmount,
        roundOff: 0,
        totalAmount,
        paidAmount: totalAmount,
        paymentMode: paymentMode || 'cash',
        doctorName,
        prescriptionNo,
        notes,
        items: { create: itemsData },
        payments: {
          create: {
            amount: totalAmount,
            mode: paymentMode || 'cash',
          },
        },
      },
      include: {
        customer: true,
        counter: true,
        items: { include: { medicine: true } },
        payments: true,
      },
    })

    // Deduct stock from each batch and create adjustments
    for (const item of itemsData) {
      const previousStock = await db.medicineBatch.findUnique({
        where: { id: item.batchId },
        select: { currentStock: true },
      })

      const prev = previousStock?.currentStock || 0
      const newStock = prev - item.quantity

      await db.medicineBatch.update({
        where: { id: item.batchId },
        data: { currentStock: newStock },
      })

      await db.stockAdjustment.create({
        data: {
          batchId: item.batchId,
          type: 'sale',
          quantity: -item.quantity,
          previousStock: prev,
          newStock,
          referenceId: invoice.id,
          notes: `Sales invoice ${invNumber}`,
        },
      })
    }

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    console.error('Sales POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create sales invoice' },
      { status: 400 }
    )
  }
}
