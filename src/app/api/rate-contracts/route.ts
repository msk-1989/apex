import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/rate-contracts - List rate contracts with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId') || ''
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const where: Prisma.RateContractWhereInput = {
      ...(customerId && { customerId }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { customer: { name: { contains: search } } },
          { notes: { contains: search } },
        ],
      }),
    }

    const [contracts, total] = await Promise.all([
      db.rateContract.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, phone: true, type: true },
          },
          items: {
            include: {
              medicine: {
                include: {
                  category: { select: { id: true, name: true } },
                  manufacturer: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.rateContract.count({ where }),
    ])

    return NextResponse.json({
      contracts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Rate Contracts GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch rate contracts' }, { status: 500 })
  }
}

// POST /api/rate-contracts - Create rate contract with items
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerId, name, validFrom, validTo, discountPct, notes, status, items } = body

    if (!customerId || !name || !validFrom || !items || items.length === 0) {
      return NextResponse.json({ error: 'customerId, name, validFrom, and items are required' }, { status: 400 })
    }

    const contract = await db.rateContract.create({
      data: {
        customerId,
        name,
        validFrom: new Date(validFrom),
        validTo: validTo ? new Date(validTo) : null,
        discountPct: discountPct || 0,
        notes: notes || null,
        status: status || 'active',
        items: {
          create: items.map((item: { medicineId: string; agreedPrice: number; minQty?: number; maxQty?: number }) => ({
            medicineId: item.medicineId,
            agreedPrice: item.agreedPrice,
            minQty: item.minQty || 1,
            maxQty: item.maxQty || null,
          })),
        },
      },
      include: {
        customer: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            medicine: {
              include: {
                category: { select: { id: true, name: true } },
                manufacturer: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ contract }, { status: 201 })
  } catch (error) {
    console.error('Rate Contracts POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create rate contract' },
      { status: 400 }
    )
  }
}

// PUT /api/rate-contracts - Update rate contract
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...fields } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const data: Prisma.RateContractUpdateInput = {}
    if (fields.name !== undefined) data.name = fields.name
    if (fields.validFrom !== undefined) data.validFrom = new Date(fields.validFrom)
    if (fields.validTo !== undefined) data.validTo = fields.validTo ? new Date(fields.validTo) : null
    if (fields.discountPct !== undefined) data.discountPct = fields.discountPct
    if (fields.notes !== undefined) data.notes = fields.notes
    if (fields.status !== undefined) data.status = fields.status
    if (fields.customerId !== undefined) data.customer = { connect: { id: fields.customerId } }

    // Handle item updates
    if (fields.items) {
      // Delete existing items and recreate
      await db.rateContractItem.deleteMany({ where: { rateContractId: id } })
      data.items = {
        create: fields.items.map((item: { medicineId: string; agreedPrice: number; minQty?: number; maxQty?: number }) => ({
          medicineId: item.medicineId,
          agreedPrice: item.agreedPrice,
          minQty: item.minQty || 1,
          maxQty: item.maxQty || null,
        })),
      }
    }

    const contract = await db.rateContract.update({
      where: { id },
      data,
      include: {
        customer: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            medicine: {
              include: {
                category: { select: { id: true, name: true } },
                manufacturer: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ contract })
  } catch (error) {
    console.error('Rate Contracts PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update rate contract' },
      { status: 400 }
    )
  }
}
