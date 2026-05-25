import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/delivery - List deliveries with filters, pagination, and summary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const deliveryBoy = searchParams.get('deliveryBoy') || ''
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const where: Prisma.DeliveryWhereInput = {
      ...(status && { status }),
      ...(deliveryBoy && { deliveryBoy: { contains: deliveryBoy } }),
      ...(search && {
        OR: [
          { patientName: { contains: search } },
          { address: { contains: search } },
          { phone: { contains: search } },
          { customer: { name: { contains: search } } },
          { invoice: { invoiceNo: { contains: search } } },
        ],
      }),
    }

    const [deliveries, total] = await Promise.all([
      db.delivery.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, phone: true, address: true },
          },
          invoice: {
            select: {
              id: true,
              invoiceNo: true,
              date: true,
              totalAmount: true,
              paymentMode: true,
              _count: { select: { items: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.delivery.count({ where }),
    ])

    // Compute summary
    const [totalToday, inTransit, delivered, pending] = await Promise.all([
      db.delivery.count({ where: { ...where, createdAt: { gte: todayStart, lt: todayEnd } } }),
      db.delivery.count({ where: { ...where, status: 'in_transit' } }),
      db.delivery.count({ where: { ...where, status: 'delivered' } }),
      db.delivery.count({ where: { ...where, status: 'pending' } }),
    ])

    const summary = {
      totalToday,
      inTransit,
      delivered,
      pending,
    }

    return NextResponse.json({
      deliveries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary,
    })
  } catch (error) {
    console.error('Delivery GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 })
  }
}

// POST /api/delivery - Create delivery for an invoice
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invoiceId, customerId, patientName, address, phone, notes, codAmount } = body

    if (!invoiceId || !customerId || !address) {
      return NextResponse.json({ error: 'invoiceId, customerId, and address are required' }, { status: 400 })
    }

    // Check if delivery already exists for this invoice
    const existingDelivery = await db.delivery.findUnique({ where: { invoiceId } })
    if (existingDelivery) {
      return NextResponse.json({ error: 'Delivery already exists for this invoice' }, { status: 400 })
    }

    const delivery = await db.delivery.create({
      data: {
        invoiceId,
        customerId,
        patientName: patientName || null,
        address,
        phone: phone || null,
        notes: notes || null,
        codAmount: codAmount || null,
        status: 'pending',
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            totalAmount: true,
            _count: { select: { items: true } },
          },
        },
      },
    })

    return NextResponse.json({ delivery }, { status: 201 })
  } catch (error) {
    console.error('Delivery POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create delivery' },
      { status: 400 }
    )
  }
}

// PUT /api/delivery - Update delivery status (assign, in_transit, delivered)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, deliveryBoy, notes, codAmount } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
    }

    const validStatuses = ['pending', 'assigned', 'in_transit', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
    }

    const data: Prisma.DeliveryUpdateInput = { status }

    if (status === 'assigned' || status === 'in_transit') {
      if (deliveryBoy) data.deliveryBoy = deliveryBoy
      if (status === 'assigned') data.assignedAt = new Date()
    }

    if (status === 'delivered') {
      data.deliveredAt = new Date()
    }

    if (notes !== undefined) data.notes = notes
    if (codAmount !== undefined) data.codAmount = codAmount

    const delivery = await db.delivery.update({
      where: { id },
      data,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            totalAmount: true,
            _count: { select: { items: true } },
          },
        },
      },
    })

    return NextResponse.json({ delivery })
  } catch (error) {
    console.error('Delivery PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update delivery' },
      { status: 400 }
    )
  }
}
