import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/purchase-suggestions - Smart purchase suggestions based on stock data
export async function GET(request: NextRequest) {
  try {
    // 1. Get all medicines with their batches and supplier info
    const medicines = await db.medicine.findMany({
      where: { isActive: true },
      include: {
        batches: {
          where: { isActive: true },
          select: {
            id: true,
            batchNo: true,
            expiryDate: true,
            currentStock: true,
            supplierId: true,
            costPrice: true,
          },
        },
        category: { select: { id: true, name: true } },
        manufacturer: { select: { id: true, name: true } },
        purchaseItems: {
          select: {
            quantity: true,
            purchaseOrder: {
              select: {
                date: true,
                supplierId: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        salesItems: {
          select: {
            quantity: true,
            invoice: {
              select: { date: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    })

    const suggestions: Array<{
      medicineId: string
      medicineName: string
      supplierId: string | null
      supplierName: string | null
      currentStock: number
      reorderPoint: number
      suggestedQty: number
      reason: string
      category: string | null
      manufacturer: string | null
      costPrice: number | null
    }> = []

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

    for (const med of medicines) {
      const totalStock = med.batches.reduce((sum, b) => sum + b.currentStock, 0)

      // Calculate sales velocity (units sold in last 30 days)
      const sales30Days = med.salesItems.filter(
        item => item.invoice && new Date(item.invoice.date) >= thirtyDaysAgo
      ).reduce((sum, item) => sum + item.quantity, 0)

      // Calculate sales in 30-60 day window
      const sales60Days = med.salesItems.filter(
        item => item.invoice && new Date(item.invoice.date) >= sixtyDaysAgo && new Date(item.invoice.date) < thirtyDaysAgo
      ).reduce((sum, item) => sum + item.quantity, 0)

      // Determine primary supplier (most recent purchase)
      const lastPurchase = med.purchaseItems[0]
      const supplierId = lastPurchase?.purchaseOrder?.supplierId || med.batches[0]?.supplierId || null

      let supplierName: string | null = null
      if (supplierId) {
        const supplier = await db.supplier.findUnique({
          where: { id: supplierId },
          select: { name: true },
        })
        supplierName = supplier?.name || null
      }

      const avgCost = med.batches.length > 0
        ? med.batches.reduce((sum, b) => sum + b.costPrice, 0) / med.batches.length
        : null

      // Check: Below reorder point
      if (totalStock <= med.reorderPoint && totalStock >= 0) {
        suggestions.push({
          medicineId: med.id,
          medicineName: med.name,
          supplierId,
          supplierName,
          currentStock: totalStock,
          reorderPoint: med.reorderPoint,
          suggestedQty: med.reorderQty,
          reason: 'below_reorder_point',
          category: med.category?.name || null,
          manufacturer: med.manufacturer?.name || null,
          costPrice: avgCost,
        })
        continue
      }

      // Check: Fast-moving items (high sales velocity, may need reorder soon)
      if (sales30Days > 0 && totalStock > med.reorderPoint) {
        const daysOfStock = Math.floor(totalStock / (sales30Days / 30))
        if (daysOfStock <= 30) {
          // Calculate suggested quantity based on 45-day supply
          const dailyRate = sales30Days / 30
          const neededFor45Days = Math.ceil(dailyRate * 45)
          suggestions.push({
            medicineId: med.id,
            medicineName: med.name,
            supplierId,
            supplierName,
            currentStock: totalStock,
            reorderPoint: med.reorderPoint,
            suggestedQty: neededFor45Days - totalStock,
            reason: 'fast_moving',
            category: med.category?.name || null,
            manufacturer: med.manufacturer?.name || null,
            costPrice: avgCost,
          })
          continue
        }
      }

      // Check: Expiring stock within 90 days
      const expiringBatches = med.batches.filter(
        b => b.expiryDate <= ninetyDaysFromNow && b.currentStock > 0
      )
      if (expiringBatches.length > 0) {
        const expiringQty = expiringBatches.reduce((sum, b) => sum + b.currentStock, 0)
        if (expiringQty > totalStock * 0.5) { // More than 50% stock is expiring
          suggestions.push({
            medicineId: med.id,
            medicineName: med.name,
            supplierId,
            supplierName,
            currentStock: totalStock,
            reorderPoint: med.reorderPoint,
            suggestedQty: med.reorderQty,
            reason: 'upcoming_expiry',
            category: med.category?.name || null,
            manufacturer: med.manufacturer?.name || null,
            costPrice: avgCost,
          })
          continue
        }
      }

      // Check: Dead stock (zero sales in 30 days, has stock)
      if (sales30Days === 0 && totalStock > 0 && med.salesItems.length > 0) {
        suggestions.push({
          medicineId: med.id,
          medicineName: med.name,
          supplierId,
          supplierName,
          currentStock: totalStock,
          reorderPoint: med.reorderPoint,
          suggestedQty: 0,
          reason: 'dead_stock',
          category: med.category?.name || null,
          manufacturer: med.manufacturer?.name || null,
          costPrice: avgCost,
        })
      }
    }

    // Sort: below_reorder_point first, then fast_moving, then upcoming_expiry, then dead_stock
    const priorityOrder: Record<string, number> = {
      below_reorder_point: 0,
      fast_moving: 1,
      upcoming_expiry: 2,
      dead_stock: 3,
    }
    suggestions.sort((a, b) => priorityOrder[a.reason] - priorityOrder[b.reason])

    // Group by supplier
    const groupedBySupplier: Record<string, typeof suggestions> = {}
    const ungrouped = suggestions.filter(s => !s.supplierId)
    const grouped = suggestions.filter(s => s.supplierId)

    for (const suggestion of grouped) {
      const key = suggestion.supplierId!
      if (!groupedBySupplier[key]) {
        groupedBySupplier[key] = []
      }
      groupedBySupplier[key].push(suggestion)
    }

    // Summary stats
    const summary = {
      totalSuggestions: suggestions.length,
      belowReorderPoint: suggestions.filter(s => s.reason === 'below_reorder_point').length,
      fastMoving: suggestions.filter(s => s.reason === 'fast_moving').length,
      upcomingExpiry: suggestions.filter(s => s.reason === 'upcoming_expiry').length,
      deadStock: suggestions.filter(s => s.reason === 'dead_stock').length,
      supplierGroups: Object.keys(groupedBySupplier).length,
      totalSuggestedValue: suggestions
        .filter(s => s.reason !== 'dead_stock')
        .reduce((sum, s) => sum + (s.suggestedQty * (s.costPrice || 0)), 0),
    }

    return NextResponse.json({
      suggestions,
      groupedBySupplier,
      summary,
    })
  } catch (error) {
    console.error('Purchase Suggestions GET error:', error)
    return NextResponse.json({ error: 'Failed to generate purchase suggestions' }, { status: 500 })
  }
}
