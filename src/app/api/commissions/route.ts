import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/commissions - List commissions with summary and staff list
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId') || ''
    const month = searchParams.get('month') || ''
    const year = searchParams.get('year') || ''
    const status = searchParams.get('status') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const where: Prisma.CommissionWhereInput = {
      ...(staffId && { staffId }),
      ...(month && { month: parseInt(month) }),
      ...(year && { year: parseInt(year) }),
      ...(status && { status }),
    }

    const [commissions, total, allStaff] = await Promise.all([
      db.commission.findMany({
        where,
        include: {
          staff: {
            select: { id: true, name: true, role: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.commission.count({ where }),
      // Get all staff for the dropdown
      db.commission.groupBy({
        by: ['staffId'],
        where: { month: month ? parseInt(month) : undefined, year: year ? parseInt(year) : undefined },
      }),
    ])

    // Fetch staff details
    const staffIds = allStaff.map(s => s.staffId)
    const staffDetails = staffIds.length > 0
      ? await db.commission.findMany({
          where: { staffId: { in: staffIds } },
          distinct: ['staffId'],
          select: { staff: { select: { id: true, name: true, role: true } } },
        })
      : []

    const staffList = staffDetails.map(s => s.staff)

    // Compute summary from all commissions matching filter (not just current page)
    const summaryData = await db.commission.aggregate({
      _sum: { commissionAmt: true },
      _count: true,
      where,
    })

    const paidData = await db.commission.aggregate({
      _sum: { commissionAmt: true },
      where: { ...where, status: 'paid' },
    })

    const pendingData = await db.commission.aggregate({
      _sum: { commissionAmt: true },
      where: { ...where, status: 'calculated' },
    })

    // Top earner: group by staffId and sum commissionAmt
    const topEarners = await db.commission.groupBy({
      by: ['staffId'],
      where,
      _sum: { commissionAmt: true },
      orderBy: { _sum: { commissionAmt: 'desc' } },
      take: 1,
    })

    let topEarner: { name: string; amount: number } | null = null
    if (topEarners.length > 0 && topEarners[0]._sum.commissionAmt) {
      const topStaff = await db.commission.findFirst({
        where: { staffId: topEarners[0].staffId },
        select: { staff: { select: { name: true } } },
      })
      topEarner = topStaff
        ? { name: topStaff.staff.name, amount: topEarners[0]._sum.commissionAmt || 0 }
        : null
    }

    const summary = {
      totalCommission: summaryData._sum.commissionAmt || 0,
      paidCommission: paidData._sum.commissionAmt || 0,
      pendingCommission: pendingData._sum.commissionAmt || 0,
      topEarner,
    }

    return NextResponse.json({
      commissions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary,
      staffList,
    })
  } catch (error) {
    console.error('Commissions GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 })
  }
}

// POST /api/commissions - Create commission entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { staffId, invoiceId, month, year, totalSales, totalProfit, commissionPct, commissionAmt, status, notes, action } = body

    if (!staffId || !month || !year) {
      return NextResponse.json({ error: 'staffId, month, and year are required' }, { status: 400 })
    }

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: 'month must be between 1 and 12' }, { status: 400 })
    }

    // Handle "calculate" action: auto-calc from sales data
    if (action === 'calculate') {
      const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1)
      const monthEnd = new Date(parseInt(year), parseInt(month), 1)

      const salesItems = await db.salesInvoiceItem.findMany({
        where: {
          invoice: {
            date: { gte: monthStart, lt: monthEnd },
            status: 'completed',
            createdBy: staffId,
          },
        },
        include: {
          invoice: { select: { totalAmount: true } },
        },
      })

      // Since there's no direct createdBy link, use aggregate approach
      const totalSalesAmt = salesItems.reduce((s, i) => s + i.totalAmount, 0)

      // Calculate commission: 2% of sales or 5% of profit, whichever is higher
      const pctCommission = Math.round(totalSalesAmt * 0.02 * 100) / 100

      const commission = await db.commission.create({
        data: {
          staffId,
          month: parseInt(month),
          year: parseInt(year),
          totalSales: totalSalesAmt,
          totalProfit: Math.round(totalSalesAmt * 0.3 * 100) / 100, // estimated 30% margin
          commissionPct: 2,
          commissionAmt: pctCommission,
          status: 'calculated',
          notes: notes || null,
        },
        include: {
          staff: { select: { id: true, name: true, role: true } },
        },
      })

      return NextResponse.json({ commission }, { status: 201 })
    }

    // Handle "pay" action
    if (action === 'pay') {
      const existing = await db.commission.findFirst({
        where: {
          staffId,
          month: parseInt(month),
          year: parseInt(year),
          status: 'calculated',
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!existing) {
        return NextResponse.json({ error: 'No pending commission found for this staff/month' }, { status: 404 })
      }

      const commission = await db.commission.update({
        where: { id: existing.id },
        data: { status: 'paid', paidAt: new Date() },
        include: {
          staff: { select: { id: true, name: true, role: true } },
        },
      })

      return NextResponse.json({ commission })
    }

    // Default: create commission entry
    const commission = await db.commission.create({
      data: {
        staffId,
        invoiceId: invoiceId || null,
        month: parseInt(month),
        year: parseInt(year),
        totalSales: totalSales || 0,
        totalProfit: totalProfit || 0,
        commissionPct: commissionPct || 2,
        commissionAmt: commissionAmt || 0,
        status: status || 'calculated',
        notes: notes || null,
      },
      include: {
        staff: {
          select: { id: true, name: true, role: true },
        },
      },
    })

    return NextResponse.json({ commission }, { status: 201 })
  } catch (error) {
    console.error('Commissions POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create commission' },
      { status: 400 }
    )
  }
}
