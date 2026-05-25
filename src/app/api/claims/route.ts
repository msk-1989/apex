import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/claims - List claims with filters, pagination, and summary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const claimType = searchParams.get('type') || ''
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    const where: Prisma.ClaimWhereInput = {
      ...(status && { status }),
      ...(claimType && { claimType }),
      ...(search && {
        OR: [
          { creditNoteNo: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
          { supplier: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    }

    const [claims, total, summary] = await Promise.all([
      db.claim.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          purchaseOrder: { select: { id: true, invoiceNo: true } },
          batch: {
            select: {
              id: true,
              batchNo: true,
              expiryDate: true,
              currentStock: true,
              costPrice: true,
              medicine: { select: { id: true, name: true, form: true, strength: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.claim.count({ where }),
      // Summary stats
      db.claim.aggregate({
        _count: true,
        _sum: { totalAmount: true },
        where: {},
      }),
    ])

    // Additional summary stats
    const [pendingSum, approvedSum, settledSum] = await Promise.all([
      db.claim.aggregate({
        _count: true,
        _sum: { totalAmount: true },
        where: { status: 'pending' },
      }),
      db.claim.aggregate({
        _count: true,
        _sum: { totalAmount: true },
        where: { status: 'approved' },
      }),
      db.claim.aggregate({
        _count: true,
        _sum: { totalAmount: true },
        where: { status: 'settled' },
      }),
    ])

    return NextResponse.json({
      claims,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        totalClaims: summary._count,
        totalAmount: summary._sum.totalAmount || 0,
        pendingCount: pendingSum._count,
        pendingAmount: pendingSum._sum.totalAmount || 0,
        approvedCount: approvedSum._count,
        approvedAmount: approvedSum._sum.totalAmount || 0,
        settledCount: settledSum._count,
        settledAmount: settledSum._sum.totalAmount || 0,
        settlementRate: summary._count > 0
          ? Math.round((settledSum._count / summary._count) * 100)
          : 0,
      },
    })
  } catch (error) {
    console.error('Claims GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    )
  }
}

// POST /api/claims - Create new claim
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.supplierId || !body.batchId || !body.claimType || !body.quantity) {
      return NextResponse.json(
        { error: 'Supplier, batch, claim type, and quantity are required' },
        { status: 400 }
      )
    }

    // Get batch info for unit cost
    const batch = await db.medicineBatch.findUnique({
      where: { id: body.batchId },
      select: { costPrice: true },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    const unitCost = body.unitCost ?? batch.costPrice
    const totalAmount = body.quantity * unitCost

    const claim = await db.claim.create({
      data: {
        supplierId: body.supplierId,
        batchId: body.batchId,
        purchaseOrderId: body.purchaseOrderId || null,
        claimType: body.claimType,
        quantity: body.quantity,
        unitCost,
        totalAmount,
        notes: body.notes,
        status: 'pending',
      },
      include: {
        supplier: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, invoiceNo: true } },
        batch: {
          select: {
            id: true,
            batchNo: true,
            expiryDate: true,
            currentStock: true,
            costPrice: true,
            medicine: { select: { id: true, name: true, form: true, strength: true } },
          },
        },
      },
    })

    return NextResponse.json({ claim }, { status: 201 })
  } catch (error) {
    console.error('Claim POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create claim' },
      { status: 400 }
    )
  }
}
