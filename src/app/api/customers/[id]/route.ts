import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/customers/[id] - Get single customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { salesInvoices: true } },
      },
    })
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    return NextResponse.json({ customer })
  } catch (error) {
    console.error('Customer GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
  }
}

// PUT /api/customers/[id] - Update customer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const customer = await db.customer.update({
      where: { id },
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        address: body.address,
        gstNo: body.gstNo,
        dlNo: body.dlNo,
        creditLimit: body.creditLimit || 0,
        type: body.type || 'retail',
      },
    })

    return NextResponse.json({ customer })
  } catch (error) {
    console.error('Customer PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update customer' },
      { status: 400 }
    )
  }
}
