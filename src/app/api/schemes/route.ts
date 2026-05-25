import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/schemes - List schemes with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || ''
    const active = searchParams.get('active')
    const medicineId = searchParams.get('medicineId') || ''
    const categoryId = searchParams.get('categoryId') || ''
    const manufacturerId = searchParams.get('manufacturerId') || ''
    const scope = searchParams.get('scope') || ''
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const where: Prisma.SchemeWhereInput = {
      ...(type && { type }),
      ...(active !== null && active !== '' && { isActive: active === 'true' }),
      ...(medicineId && { medicineId }),
      ...(categoryId && { categoryId }),
      ...(manufacturerId && { manufacturerId }),
      ...(scope && { scope }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { description: { contains: search } },
        ],
      }),
    }

    const [schemes, total] = await Promise.all([
      db.scheme.findMany({
        where,
        include: {
          supplier: true,
          category: true,
          manufacturer: true,
          medicine: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.scheme.count({ where }),
    ])

    return NextResponse.json({
      schemes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Schemes GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch schemes' }, { status: 500 })
  }
}

// POST /api/schemes - Create a new scheme
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type, description, supplierId, buyQty, getQty, flatDiscount, minQty, maxQty, qtyDiscountPct, validFrom, validTo, scope, categoryId, manufacturerId, medicineId, isActive } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 })
    }

    const scheme = await db.scheme.create({
      data: {
        name,
        type,
        description: description || null,
        supplierId: supplierId || null,
        buyQty: buyQty || null,
        getQty: getQty || null,
        flatDiscount: flatDiscount || null,
        minQty: minQty || null,
        maxQty: maxQty || null,
        qtyDiscountPct: qtyDiscountPct || null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        scope: scope || 'all',
        categoryId: categoryId || null,
        manufacturerId: manufacturerId || null,
        medicineId: medicineId || null,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        supplier: true,
        category: true,
        manufacturer: true,
        medicine: true,
      },
    })

    return NextResponse.json({ scheme }, { status: 201 })
  } catch (error) {
    console.error('Schemes POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create scheme' },
      { status: 400 }
    )
  }
}

// PUT /api/schemes - Update a scheme
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...fields } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const data: Prisma.SchemeUpdateInput = {}
    if (fields.name !== undefined) data.name = fields.name
    if (fields.type !== undefined) data.type = fields.type
    if (fields.description !== undefined) data.description = fields.description
    if (fields.supplierId !== undefined) data.supplier = fields.supplierId ? { connect: { id: fields.supplierId } } : { disconnect: true }
    if (fields.buyQty !== undefined) data.buyQty = fields.buyQty
    if (fields.getQty !== undefined) data.getQty = fields.getQty
    if (fields.flatDiscount !== undefined) data.flatDiscount = fields.flatDiscount
    if (fields.minQty !== undefined) data.minQty = fields.minQty
    if (fields.maxQty !== undefined) data.maxQty = fields.maxQty
    if (fields.qtyDiscountPct !== undefined) data.qtyDiscountPct = fields.qtyDiscountPct
    if (fields.validFrom !== undefined) data.validFrom = fields.validFrom ? new Date(fields.validFrom) : null
    if (fields.validTo !== undefined) data.validTo = fields.validTo ? new Date(fields.validTo) : null
    if (fields.scope !== undefined) data.scope = fields.scope
    if (fields.categoryId !== undefined) data.category = fields.categoryId ? { connect: { id: fields.categoryId } } : { disconnect: true }
    if (fields.manufacturerId !== undefined) data.manufacturer = fields.manufacturerId ? { connect: { id: fields.manufacturerId } } : { disconnect: true }
    if (fields.medicineId !== undefined) data.medicine = fields.medicineId ? { connect: { id: fields.medicineId } } : { disconnect: true }
    if (fields.isActive !== undefined) data.isActive = fields.isActive

    const scheme = await db.scheme.update({
      where: { id },
      data,
      include: {
        supplier: true,
        category: true,
        manufacturer: true,
        medicine: true,
      },
    })

    return NextResponse.json({ scheme })
  } catch (error) {
    console.error('Schemes PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update scheme' },
      { status: 400 }
    )
  }
}
