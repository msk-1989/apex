import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/medicines - List medicines with search, filter, pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('categoryId') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const lowStock = searchParams.get('lowStock') === 'true'
    const skip = (page - 1) * limit

    const where: Prisma.MedicineWhereInput = {
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search } },
          { genericName: { contains: search } },
          { saltComposition: { contains: search } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(lowStock && {
        batches: {
          some: {},
        },
      }),
    }

    const [medicines, total] = await Promise.all([
      db.medicine.findMany({
        where,
        include: {
          category: true,
          manufacturer: true,
          batches: {
            where: { isActive: true },
            select: {
              id: true,
              batchNo: true,
              expiryDate: true,
              costPrice: true,
              mrp: true,
              sellingPrice: true,
              wholesalePrice: true,
              currentStock: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      db.medicine.count({ where }),
    ])

    // If lowStock filter, filter out medicines that have total stock above minStockLevel
    let filteredMedicines = medicines
    if (lowStock) {
      filteredMedicines = medicines.filter(med => {
        const totalStock = med.batches.reduce((sum, b) => sum + b.currentStock, 0)
        return totalStock <= med.minStockLevel
      })
    }

    // Add aggregated stock totals
    const medicinesWithStock = filteredMedicines.map(med => {
      const totalStock = med.batches.reduce((sum, b) => sum + b.currentStock, 0)
      const totalValue = med.batches.reduce((sum, b) => sum + (b.costPrice * b.currentStock), 0)
      return {
        ...med,
        totalStock,
        totalValue: Math.round(totalValue * 100) / 100,
        isLowStock: totalStock <= med.minStockLevel,
      }
    })

    return NextResponse.json({
      medicines: medicinesWithStock,
      pagination: {
        page,
        limit,
        total: lowStock ? filteredMedicines.length : total,
        totalPages: Math.ceil((lowStock ? filteredMedicines.length : total) / limit),
      },
    })
  } catch (error) {
    console.error('Medicines GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch medicines' },
      { status: 500 }
    )
  }
}

// POST /api/medicines - Create new medicine
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const medicine = await db.medicine.create({
      data: {
        name: body.name,
        genericName: body.genericName,
        saltComposition: body.saltComposition,
        categoryId: body.categoryId,
        manufacturerId: body.manufacturerId,
        hsnCode: body.hsnCode,
        schedule: body.schedule || 'none',
        strength: body.strength,
        form: body.form || 'tablet',
        unit: body.unit || 'strip',
        stripQty: body.stripQty || 1,
        gstRate: body.gstRate || 5,
        minStockLevel: body.minStockLevel || 10,
        maxStockLevel: body.maxStockLevel || 1000,
        rackNo: body.rackNo,
      },
      include: {
        category: true,
        manufacturer: true,
      },
    })

    return NextResponse.json({ medicine }, { status: 201 })
  } catch (error) {
    console.error('Medicine POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create medicine' },
      { status: 400 }
    )
  }
}
