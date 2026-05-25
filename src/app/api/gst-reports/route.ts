import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/gst-reports?type=gstr1|gstr3b|purchase_register|gst_summary&dateFrom=...&dateTo=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || ''
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const today = new Date()
    const defaultFrom = dateFrom ? new Date(dateFrom) : new Date(today.getFullYear(), today.getMonth(), 1)
    const defaultTo = dateTo ? new Date(dateTo + 'T23:59:59.999Z') : new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

    const startOfDay = new Date(defaultFrom)
    startOfDay.setHours(0, 0, 0, 0)

    switch (type) {
      // ── GSTR-1: Outward Supplies ──────────────────────────────────
      case 'gstr1': {
        const invoices = await db.salesInvoice.findMany({
          where: {
            date: { gte: startOfDay, lte: defaultTo },
            status: 'completed',
          },
          include: {
            customer: { select: { name: true, gstNo: true, type: true } },
            items: {
              include: {
                medicine: { select: { name: true, hsnCode: true } },
              },
            },
          },
          orderBy: { date: 'desc' },
        })

        // Rate-wise aggregation
        const rateMap: Record<number, {
          taxableValue: number; cgst: number; sgst: number; igst: number; invoices: number; count: number;
        }> = {}

        let totalTaxableValue = 0
        let totalCGST = 0
        let totalSGST = 0
        let totalIGST = 0
        let totalAmount = 0

        for (const invoice of invoices) {
          for (const item of invoice.items) {
            const rate = item.gstRate
            const taxable = Math.round(item.sellingPrice * item.quantity * 100) / 100
            const gst = Math.round(item.gstAmount * 100) / 100
            const halfGst = Math.round(gst / 2 * 100) / 100

            if (!rateMap[rate]) {
              rateMap[rate] = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, invoices: 0, count: 0 }
            }
            rateMap[rate].taxableValue += taxable
            rateMap[rate].cgst += halfGst
            rateMap[rate].sgst += halfGst
            rateMap[rate].count++

            totalTaxableValue += taxable
            totalCGST += halfGst
            totalSGST += halfGst
          }

          // Track unique invoice count per rate (approximate: add once per invoice)
          const invoiceRates = new Set(invoice.items.map((i: { gstRate: number }) => i.gstRate))
          for (const r of invoiceRates) {
            rateMap[r].invoices++
          }
        }

        // Round rate-wise values
        const rateWise = Object.entries(rateMap).map(([rate, v]) => ({
          gstRate: Number(rate),
          taxableValue: Math.round(v.taxableValue * 100) / 100,
          cgst: Math.round(v.cgst * 100) / 100,
          sgst: Math.round(v.sgst * 100) / 100,
          igst: Math.round(v.igst * 100) / 100,
          invoices: v.invoices,
        })).sort((a, b) => a.gstRate - b.gstRate)

        totalTaxableValue = Math.round(totalTaxableValue * 100) / 100
        totalCGST = Math.round(totalCGST * 100) / 100
        totalSGST = Math.round(totalSGST * 100) / 100
        totalIGST = Math.round(totalIGST * 100) / 100
        totalAmount = Math.round(invoices.reduce((s, i) => s + i.totalAmount, 0) * 100) / 100

        const invoiceList = invoices.map(inv => ({
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          customerName: inv.customer?.name || 'Walk-in',
          customerGst: inv.customer?.gstNo || '',
          date: inv.date,
          subtotal: inv.subtotal,
          gstAmount: inv.gstAmount,
          totalAmount: inv.totalAmount,
          paymentMode: inv.paymentMode,
          itemsCount: inv.items.length,
        }))

        return NextResponse.json({
          type: 'gstr1',
          dateRange: { from: startOfDay, to: defaultTo },
          summary: { totalTaxableValue, totalCGST, totalSGST, totalIGST, totalInvoices: invoices.length, totalAmount },
          rateWise,
          invoices: invoiceList,
        })
      }

      // ── GSTR-3B: Summary Return ──────────────────────────────────
      case 'gstr3b': {
        const invoices = await db.salesInvoice.findMany({
          where: {
            date: { gte: startOfDay, lte: defaultTo },
            status: 'completed',
          },
          include: { items: true },
        })

        let totalTaxable = 0
        let totalIGST = 0
        let totalCGST = 0
        let totalSGST = 0
        let totalCess = 0

        for (const inv of invoices) {
          for (const item of inv.items) {
            const taxable = Math.round(item.sellingPrice * item.quantity * 100) / 100
            const gst = Math.round(item.gstAmount * 100) / 100
            totalTaxable += taxable
            // Intra-state: CGST + SGST
            totalCGST += Math.round(gst / 2 * 100) / 100
            totalSGST += Math.round(gst / 2 * 100) / 100
          }
        }

        totalTaxable = Math.round(totalTaxable * 100) / 100
        totalIGST = Math.round(totalIGST * 100) / 100
        totalCGST = Math.round(totalCGST * 100) / 100
        totalSGST = Math.round(totalSGST * 100) / 100
        totalCess = Math.round(totalCess * 100) / 100

        // ITC from purchases
        const purchases = await db.purchaseOrder.findMany({
          where: {
            date: { gte: startOfDay, lte: defaultTo },
            status: 'received',
          },
          include: { items: true, supplier: true },
        })

        let itcAvailable = 0
        let itcCGST = 0
        let itcSGST = 0
        let itcIGST = 0

        for (const po of purchases) {
          for (const item of po.items) {
            const gst = Math.round(item.gstAmount * 100) / 100
            itcAvailable += gst
            itcCGST += Math.round(gst / 2 * 100) / 100
            itcSGST += Math.round(gst / 2 * 100) / 100
          }
        }

        itcAvailable = Math.round(itcAvailable * 100) / 100
        itcCGST = Math.round(itcCGST * 100) / 100
        itcSGST = Math.round(itcSGST * 100) / 100
        itcIGST = Math.round(itcIGST * 100) / 100

        // Tax payable = Output tax - ITC utilized (ITC utilized = min of available and output)
        const itcUtilizedCGST = Math.min(itcCGST, totalCGST)
        const itcUtilizedSGST = Math.min(itcSGST, totalSGST)
        const itcUtilizedIGST = Math.min(itcIGST, totalIGST)
        const itcUtilized = itcUtilizedCGST + itcUtilizedSGST + itcUtilizedIGST

        const taxIGST = Math.max(0, totalIGST - itcUtilizedIGST)
        const taxCGST = Math.max(0, totalCGST - itcUtilizedCGST)
        const taxSGST = Math.max(0, totalSGST - itcUtilizedSGST)
        const taxCess = Math.max(0, totalCess)
        const taxTotal = Math.round((taxIGST + taxCGST + taxSGST + taxCess) * 100) / 100

        return NextResponse.json({
          type: 'gstr3b',
          dateRange: { from: startOfDay, to: defaultTo },
          supplies: {
            taxableValue: totalTaxable,
            igst: totalIGST,
            cgst: totalCGST,
            sgst: totalSGST,
            cess: totalCess,
          },
          itc: {
            available: itcAvailable,
            cgst: itcCGST,
            sgst: itcSGST,
            igst: itcIGST,
            utilized: Math.round(itcUtilized * 100) / 100,
          },
          tax: {
            igst: Math.round(taxIGST * 100) / 100,
            cgst: Math.round(taxCGST * 100) / 100,
            sgst: Math.round(taxSGST * 100) / 100,
            cess: taxCess,
            total: taxTotal,
          },
          interest: 0,
          lateFee: 0,
          totalLiability: taxTotal,
        })
      }

      // ── Purchase Register for GST Input Credit ────────────────────
      case 'purchase_register': {
        const purchases = await db.purchaseOrder.findMany({
          where: {
            date: { gte: startOfDay, lte: defaultTo },
            status: 'received',
          },
          include: {
            supplier: { select: { name: true, gstNo: true } },
            items: { include: { medicine: { select: { name: true, hsnCode: true } } } },
          },
          orderBy: { date: 'desc' },
        })

        const purchaseList: Array<{
          id: string
          invoiceNo: string
          supplier: string
          supplierGst: string
          date: Date
          taxableValue: number
          gstRate: number
          cgst: number
          sgst: number
          total: number
        }> = []

        let totalPurchases = 0
        let totalTaxable = 0
        let totalCGST = 0
        let totalSGST = 0

        for (const po of purchases) {
          let poTaxable = 0
          let poCGST = 0
          let poSGST = 0

          for (const item of po.items) {
            const taxable = Math.round(item.costPrice * item.quantity * 100) / 100
            const gst = Math.round(item.gstAmount * 100) / 100
            poTaxable += taxable
            poCGST += Math.round(gst / 2 * 100) / 100
            poSGST += Math.round(gst / 2 * 100) / 100
          }

          // Average GST rate across items
          const avgGstRate = po.items.length > 0
            ? Math.round(po.items.reduce((s, i) => s + i.gstRate, 0) / po.items.length * 100) / 100
            : 0

          purchaseList.push({
            id: po.id,
            invoiceNo: po.invoiceNo,
            supplier: po.supplier.name,
            supplierGst: po.supplier.gstNo || '',
            date: po.date,
            taxableValue: Math.round(poTaxable * 100) / 100,
            gstRate: avgGstRate,
            cgst: Math.round(poCGST * 100) / 100,
            sgst: Math.round(poSGST * 100) / 100,
            total: Math.round(po.totalAmount * 100) / 100,
          })

          totalPurchases += po.totalAmount
          totalTaxable += poTaxable
          totalCGST += poCGST
          totalSGST += poSGST
        }

        return NextResponse.json({
          type: 'purchase_register',
          dateRange: { from: startOfDay, to: defaultTo },
          purchases: purchaseList,
          summary: {
            totalPurchases: Math.round(totalPurchases * 100) / 100,
            totalTaxable: Math.round(totalTaxable * 100) / 100,
            totalCGST: Math.round(totalCGST * 100) / 100,
            totalSGST: Math.round(totalSGST * 100) / 100,
          },
        })
      }

      // ── GST Summary Dashboard ─────────────────────────────────────
      case 'gst_summary': {
        // Output GST from sales
        const salesInvoices = await db.salesInvoice.findMany({
          where: {
            date: { gte: startOfDay, lte: defaultTo },
            status: 'completed',
          },
          include: { items: true },
        })

        let outputCGST = 0
        let outputSGST = 0
        let outputIGST = 0
        let totalSales = 0

        for (const inv of salesInvoices) {
          totalSales += inv.totalAmount
          for (const item of inv.items) {
            const gst = Math.round(item.gstAmount * 100) / 100
            outputCGST += Math.round(gst / 2 * 100) / 100
            outputSGST += Math.round(gst / 2 * 100) / 100
          }
        }

        totalSales = Math.round(totalSales * 100) / 100
        outputCGST = Math.round(outputCGST * 100) / 100
        outputSGST = Math.round(outputSGST * 100) / 100
        outputIGST = Math.round(outputIGST * 100) / 100

        // Input GST from purchases
        const purchaseOrders = await db.purchaseOrder.findMany({
          where: {
            date: { gte: startOfDay, lte: defaultTo },
            status: 'received',
          },
          include: { items: true },
        })

        let inputCGST = 0
        let inputSGST = 0
        let inputIGST = 0
        let totalPurchases = 0

        for (const po of purchaseOrders) {
          totalPurchases += po.totalAmount
          for (const item of po.items) {
            const gst = Math.round(item.gstAmount * 100) / 100
            inputCGST += Math.round(gst / 2 * 100) / 100
            inputSGST += Math.round(gst / 2 * 100) / 100
          }
        }

        totalPurchases = Math.round(totalPurchases * 100) / 100
        inputCGST = Math.round(inputCGST * 100) / 100
        inputSGST = Math.round(inputSGST * 100) / 100
        inputIGST = Math.round(inputIGST * 100) / 100

        const netCGST = Math.max(0, outputCGST - inputCGST)
        const netSGST = Math.max(0, outputSGST - inputSGST)
        const netIGST = Math.max(0, outputIGST - inputIGST)
        const netPayable = Math.round((netCGST + netSGST + netIGST) * 100) / 100

        return NextResponse.json({
          type: 'gst_summary',
          dateRange: { from: startOfDay, to: defaultTo },
          outputGST: { cgst: outputCGST, sgst: outputSGST, igst: outputIGST, total: Math.round((outputCGST + outputSGST + outputIGST) * 100) / 100 },
          inputGST: { cgst: inputCGST, sgst: inputSGST, igst: inputIGST, total: Math.round((inputCGST + inputSGST + inputIGST) * 100) / 100 },
          netPayable,
          totalSales,
          totalPurchases,
        })
      }

      default:
        return NextResponse.json(
          { error: `Unknown report type: ${type}. Valid types: gstr1, gstr3b, purchase_register, gst_summary` },
          { status: 400 },
        )
    }
  } catch (error) {
    console.error('GST Reports GET error:', error)
    return NextResponse.json({ error: 'Failed to generate GST report' }, { status: 500 })
  }
}
