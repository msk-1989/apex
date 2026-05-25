import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/dashboard - Dashboard statistics
export async function GET() {
  try {
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    // Today's sales
    const todaySalesInvoices = await db.salesInvoice.findMany({
      where: {
        date: { gte: todayStart, lt: todayEnd },
        status: 'completed',
      },
    })
    const todaySales = todaySalesInvoices.reduce((s, i) => s + i.totalAmount, 0)
    const todayInvoices = todaySalesInvoices.length

    // Low stock count
    const allMedicines = await db.medicine.findMany({
      where: { isActive: true },
      include: { batches: { where: { isActive: true } } },
    })
    const lowStockCount = allMedicines.filter(
      m => m.batches.reduce((s, b) => s + b.currentStock, 0) <= m.minStockLevel
    ).length

    // Expiring soon (90 days)
    const expiryThreshold = new Date()
    expiryThreshold.setDate(expiryThreshold.getDate() + 90)
    const expiringBatches = await db.medicineBatch.findMany({
      where: {
        isActive: true,
        expiryDate: { lte: expiryThreshold },
        currentStock: { gt: 0 },
      },
      include: { medicine: { select: { name: true } } },
      orderBy: { expiryDate: 'asc' },
      take: 10,
    })
    const expiringSoonCount = expiringBatches.length
    const expiryAlerts = expiringBatches.map(b => ({
      id: b.id,
      name: b.medicine.name,
      batchNo: b.batchNo,
      expiryDate: b.expiryDate.toISOString(),
      daysRemaining: Math.max(0, Math.ceil((b.expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))),
    }))

    const totalMedicines = await db.medicine.count({ where: { isActive: true } })
    const totalCustomers = await db.customer.count()

    // Monthly sales (last 12 months)
    const monthlySales: Array<{ month: string; total: number; count: number }> = []
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 1)
      const monthInvoices = await db.salesInvoice.findMany({
        where: {
          date: { gte: monthStart, lt: monthEnd },
          status: 'completed',
        },
        select: { totalAmount: true },
      })
      const monthLabel = monthStart.toLocaleString('default', { month: 'short', year: '2-digit' })
      monthlySales.push({
        month: monthLabel,
        total: Math.round(monthInvoices.reduce((s, i) => s + i.totalAmount, 0) * 100) / 100,
        count: monthInvoices.length,
      })
    }

    // Recent sales (last 10)
    const recentSales = await db.salesInvoice.findMany({
      where: { status: 'completed' },
      include: {
        customer: { select: { name: true } },
        items: { include: { medicine: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
      take: 10,
    })

    // Top selling medicines (by quantity sold)
    const salesItems = await db.salesInvoiceItem.findMany({
      include: {
        medicine: {
          include: {
            category: true,
            manufacturer: true,
          },
        },
        invoice: { select: { status: true } },
      },
    })
    const filteredItems = salesItems.filter(si => si.invoice.status === 'completed')

    // Aggregate by medicine
    const medicineSalesMap: Record<string, { medicineName: string; quantity: number; revenue: number; category: string }> = {}
    for (const item of filteredItems) {
      const key = item.medicineId
      if (!medicineSalesMap[key]) {
        medicineSalesMap[key] = {
          medicineName: item.medicine.name,
          quantity: 0,
          revenue: 0,
          category: item.medicine.category.name,
        }
      }
      medicineSalesMap[key].quantity += item.quantity
      medicineSalesMap[key].revenue += item.totalAmount
    }

    const topSellingMedicines = Object.values(medicineSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map(m => ({
        name: m.medicineName,
        quantity: m.quantity,
        revenue: Math.round(m.revenue * 100) / 100,
        category: m.category,
      }))

    // Category-wise sales
    const categorySalesMap: Record<string, { category: string; total: number; count: number }> = {}
    for (const item of filteredItems) {
      const catName = item.medicine.category.name
      if (!categorySalesMap[catName]) {
        categorySalesMap[catName] = { category: catName, total: 0, count: 0 }
      }
      categorySalesMap[catName].total += item.totalAmount
      categorySalesMap[catName].count += item.quantity
    }

    const categoryWiseSales = Object.values(categorySalesMap)
      .sort((a, b) => b.total - a.total)
      .map(c => ({
        category: c.category,
        total: Math.round(c.total * 100) / 100,
        count: c.count,
      }))

    return NextResponse.json({
      todaySales: Math.round(todaySales * 100) / 100,
      todayInvoices,
      lowStockCount,
      expiringSoonCount,
      totalMedicines,
      totalCustomers,
      monthlySales,
      recentSales,
      topSellingMedicines,
      categoryWiseSales,
      expiryAlerts,
    })
  } catch (error) {
    console.error('Dashboard GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
