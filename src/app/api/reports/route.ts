import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/reports - Generate various reports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || ''
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const today = new Date()
    const defaultFrom = dateFrom ? new Date(dateFrom) : new Date(today.getFullYear(), today.getMonth(), 1)
    const defaultTo = dateTo ? new Date(dateTo) : today

    switch (type) {
      case 'daily_sales': {
        // Daily sales report for a date range
        const sales = await db.salesInvoice.findMany({
          where: {
            date: { gte: defaultFrom, lte: defaultTo },
            status: 'completed',
          },
          include: {
            customer: true,
            counter: true,
            items: { include: { medicine: { include: { category: true } } } },
            payments: true,
          },
          orderBy: { date: 'desc' },
        })

        const summary = {
          totalSales: sales.reduce((s, i) => s + i.totalAmount, 0),
          totalGST: sales.reduce((s, i) => s + i.gstAmount, 0),
          totalDiscount: sales.reduce((s, i) => s + i.discount, 0),
          totalInvoices: sales.length,
          cashSales: sales.filter(i => i.paymentMode === 'cash').reduce((s, i) => s + i.totalAmount, 0),
          cardSales: sales.filter(i => i.paymentMode === 'card').reduce((s, i) => s + i.totalAmount, 0),
          upiSales: sales.filter(i => i.paymentMode === 'upi').reduce((s, i) => s + i.totalAmount, 0),
          creditSales: sales.filter(i => i.paymentMode === 'credit').reduce((s, i) => s + i.totalAmount, 0),
          avgInvoiceValue: sales.length > 0 ? Math.round(sales.reduce((s, i) => s + i.totalAmount, 0) / sales.length * 100) / 100 : 0,
        }

        return NextResponse.json({ type: 'daily_sales', dateRange: { from: defaultFrom, to: defaultTo }, summary, sales })
      }

      case 'stock_summary': {
        // Stock summary report
        const medicines = await db.medicine.findMany({
          where: { isActive: true },
          include: {
            category: true,
            manufacturer: true,
            batches: { where: { isActive: true } },
          },
        })

        const summary = {
          totalMedicines: medicines.length,
          totalItems: medicines.reduce((s, m) => s + m.batches.reduce((bs, b) => bs + b.currentStock, 0), 0),
          totalValue: medicines.reduce((s, m) => s + m.batches.reduce((bs, b) => bs + (b.costPrice * b.currentStock), 0), 0),
          lowStockItems: medicines.filter(m => m.batches.reduce((s, b) => s + b.currentStock, 0) <= m.minStockLevel).length,
          outOfStockItems: medicines.filter(m => m.batches.reduce((s, b) => s + b.currentStock, 0) === 0).length,
        }

        const medicinesWithStock = medicines.map(m => ({
          id: m.id,
          name: m.name,
          genericName: m.genericName,
          category: m.category.name,
          manufacturer: m.manufacturer.name,
          totalStock: m.batches.reduce((s, b) => s + b.currentStock, 0),
          totalValue: Math.round(m.batches.reduce((s, b) => s + (b.costPrice * b.currentStock), 0) * 100) / 100,
          batchCount: m.batches.length,
          minStockLevel: m.minStockLevel,
          isLowStock: m.batches.reduce((s, b) => s + b.currentStock, 0) <= m.minStockLevel,
        }))

        return NextResponse.json({ type: 'stock_summary', summary, medicines: medicinesWithStock })
      }

      case 'gst_report': {
        // GST report
        const sales = await db.salesInvoice.findMany({
          where: {
            date: { gte: defaultFrom, lte: defaultTo },
            status: 'completed',
          },
          include: {
            items: { include: { medicine: true } },
          },
        })

        // Group by GST rate
        const gstBreakdown: Record<number, { taxableAmount: number; cgst: number; sgst: number; totalGst: number }> = {}
        let totalTaxable = 0
        let totalGST = 0

        for (const invoice of sales) {
          for (const item of invoice.items) {
            const rate = item.gstRate
            const taxable = Math.round((item.sellingPrice * item.quantity) * 100) / 100
            const gst = item.gstAmount
            const halfGst = Math.round(gst / 2 * 100) / 100

            if (!gstBreakdown[rate]) {
              gstBreakdown[rate] = { taxableAmount: 0, cgst: 0, sgst: 0, totalGst: 0 }
            }
            gstBreakdown[rate].taxableAmount += taxable
            gstBreakdown[rate].cgst += halfGst
            gstBreakdown[rate].sgst += halfGst
            gstBreakdown[rate].totalGst += gst
            totalTaxable += taxable
            totalGST += gst
          }
        }

        // Round values
        for (const key of Object.keys(gstBreakdown)) {
          const entry = gstBreakdown[Number(key)]
          entry.taxableAmount = Math.round(entry.taxableAmount * 100) / 100
          entry.cgst = Math.round(entry.cgst * 100) / 100
          entry.sgst = Math.round(entry.sgst * 100) / 100
          entry.totalGst = Math.round(entry.totalGst * 100) / 100
        }

        return NextResponse.json({
          type: 'gst_report',
          dateRange: { from: defaultFrom, to: defaultTo },
          totalTaxable: Math.round(totalTaxable * 100) / 100,
          totalGST: Math.round(totalGST * 100) / 100,
          gstBreakdown,
        })
      }

      case 'expiry_report': {
        // Expiry report
        const now = new Date()
        const threeMonths = new Date(now)
        threeMonths.setDate(threeMonths.getDate() + 90)
        const sixMonths = new Date(now)
        sixMonths.setDate(sixMonths.getDate() + 180)
        const oneYear = new Date(now)
        oneYear.setFullYear(oneYear.getFullYear() + 1)

        const [expired, expiring3Months, expiring6Months, expiring1Year] = await Promise.all([
          db.medicineBatch.findMany({
            where: { isActive: true, expiryDate: { lte: now }, currentStock: { gt: 0 } },
            include: { medicine: { include: { category: true, manufacturer: true } } },
          }),
          db.medicineBatch.findMany({
            where: { isActive: true, expiryDate: { gt: now, lte: threeMonths }, currentStock: { gt: 0 } },
            include: { medicine: { include: { category: true, manufacturer: true } } },
          }),
          db.medicineBatch.findMany({
            where: { isActive: true, expiryDate: { gt: threeMonths, lte: sixMonths }, currentStock: { gt: 0 } },
            include: { medicine: { include: { category: true, manufacturer: true } } },
          }),
          db.medicineBatch.findMany({
            where: { isActive: true, expiryDate: { gt: sixMonths, lte: oneYear }, currentStock: { gt: 0 } },
            include: { medicine: { include: { category: true, manufacturer: true } } },
          }),
        ])

        const calculateValue = (batches: typeof expired) =>
          Math.round(batches.reduce((s, b) => s + b.costPrice * b.currentStock, 0) * 100) / 100

        return NextResponse.json({
          type: 'expiry_report',
          generatedAt: now,
          expired: { count: expired.length, value: calculateValue(expired), items: expired },
          expiring3Months: { count: expiring3Months.length, value: calculateValue(expiring3Months), items: expiring3Months },
          expiring6Months: { count: expiring6Months.length, value: calculateValue(expiring6Months), items: expiring6Months },
          expiring1Year: { count: expiring1Year.length, value: calculateValue(expiring1Year), items: expiring1Year },
        })
      }

      case 'profit_loss': {
        // Profit/Loss report
        const sales = await db.salesInvoice.findMany({
          where: {
            date: { gte: defaultFrom, lte: defaultTo },
            status: 'completed',
          },
          include: { items: true },
        })

        let totalRevenue = 0
        let totalCost = 0
        let totalGST = 0

        for (const invoice of sales) {
          totalRevenue += invoice.subtotal
          totalGST += invoice.gstAmount
          for (const item of invoice.items) {
            totalCost += item.costPrice * item.quantity
          }
        }

        const grossProfit = totalRevenue - totalCost
        const netRevenue = totalRevenue - totalGST

        // Get expenses
        const expenses = await db.expense.findMany({
          where: { date: { gte: defaultFrom, lte: defaultTo } },
        })
        const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

        const netProfit = grossProfit - totalExpenses
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

        return NextResponse.json({
          type: 'profit_loss',
          dateRange: { from: defaultFrom, to: defaultTo },
          revenue: {
            grossRevenue: Math.round(totalRevenue * 100) / 100,
            gstCollected: Math.round(totalGST * 100) / 100,
            netRevenue: Math.round(netRevenue * 100) / 100,
          },
          cost: {
            costOfGoods: Math.round(totalCost * 100) / 100,
            expenses: Math.round(totalExpenses * 100) / 100,
            totalCost: Math.round((totalCost + totalExpenses) * 100) / 100,
          },
          profit: {
            grossProfit: Math.round(grossProfit * 100) / 100,
            netProfit: Math.round(netProfit * 100) / 100,
            profitMargin: Math.round(profitMargin * 100) / 100,
          },
          expenses,
        })
      }

      default:
        return NextResponse.json(
          { error: `Unknown report type: ${type}. Valid types: daily_sales, stock_summary, gst_report, expiry_report, profit_loss` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Reports GET error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
