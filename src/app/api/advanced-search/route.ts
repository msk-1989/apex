import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/advanced-search - Ultra-fast search across medicines with partial matching
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const field = searchParams.get('field') || ''
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))

    if (!q || q.length < 1) {
      return NextResponse.json({ medicines: [], query: q, count: 0 })
    }

    // Build search conditions based on field parameter or search all fields
    let searchConditions: Prisma.MedicineWhereInput

    if (field && field !== 'all') {
      // Search specific field
      const fieldMap: Record<string, Prisma.MedicineWhereInput> = {
        name: { name: { contains: q, mode: 'insensitive' } },
        salt: { saltComposition: { contains: q, mode: 'insensitive' } },
        barcode: { barcode: { equals: q } },
        company: { manufacturer: { name: { contains: q, mode: 'insensitive' } } },
        composition: { saltComposition: { contains: q, mode: 'insensitive' } },
        rack: { rackNo: { contains: q, mode: 'insensitive' } },
        genericName: { genericName: { contains: q, mode: 'insensitive' } },
      }

      searchConditions = fieldMap[field] || { name: { contains: q, mode: 'insensitive' } }
    } else {
      // Search ALL fields simultaneously with partial matching
      searchConditions = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { genericName: { contains: q, mode: 'insensitive' } },
          { saltComposition: { contains: q, mode: 'insensitive' } },
          { barcode: { equals: q } },
          { manufacturer: { name: { contains: q, mode: 'insensitive' } } },
          { category: { name: { contains: q, mode: 'insensitive' } } },
          { rackNo: { contains: q, mode: 'insensitive' } },
          { hsnCode: { contains: q, mode: 'insensitive' } },
          { strength: { contains: q, mode: 'insensitive' } },
          { form: { contains: q, mode: 'insensitive' } },
        ],
      }
    }

    const medicines = await db.medicine.findMany({
      where: {
        isActive: true,
        ...searchConditions,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
        manufacturer: {
          select: { id: true, name: true },
        },
        batches: {
          where: { isActive: true, currentStock: { gt: 0 } },
          select: {
            id: true,
            batchNo: true,
            expiryDate: true,
            costPrice: true,
            mrp: true,
            sellingPrice: true,
            wholesalePrice: true,
            currentStock: true,
            freeStock: true,
            location: true,
          },
          orderBy: [
            { expiryDate: 'asc' },   // FEFO: First Expiry First Out
            { currentStock: 'desc' },
          ],
        },
      },
      orderBy: { name: 'asc' },
      take: limit,
    })

    // Add aggregated stock data
    const enrichedMedicines = medicines.map(med => {
      const totalStock = med.batches.reduce((sum, b) => sum + b.currentStock, 0)
      const totalFreeStock = med.batches.reduce((sum, b) => sum + b.freeStock, 0)
      const bestPrice = med.batches.length > 0
        ? Math.min(...med.batches.map(b => b.sellingPrice))
        : null
      const nearestExpiry = med.batches.length > 0
        ? med.batches[0]?.expiryDate || null
        : null

      return {
        ...med,
        totalStock,
        totalFreeStock,
        bestPrice,
        nearestExpiry,
        isLowStock: totalStock <= med.minStockLevel,
        hasExpiringStock: nearestExpiry
          ? new Date(nearestExpiry) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          : false,
      }
    })

    return NextResponse.json({
      medicines: enrichedMedicines,
      query: q,
      field: field || 'all',
      count: enrichedMedicines.length,
    })
  } catch (error) {
    console.error('Advanced Search GET error:', error)
    return NextResponse.json({ error: 'Failed to search medicines' }, { status: 500 })
  }
}
