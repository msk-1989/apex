import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/prescriptions - List prescriptions with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientName = searchParams.get('patientName') || ''
    const doctorName = searchParams.get('doctorName') || ''
    const status = searchParams.get('status') || ''
    const invoiceId = searchParams.get('invoiceId') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const where: Prisma.PrescriptionWhereInput = {
      ...(patientName && { patientName: { contains: patientName } }),
      ...(doctorName && { doctorName: { contains: doctorName } }),
      ...(status && { status }),
      ...(invoiceId && { invoiceId }),
    }

    const [prescriptions, total] = await Promise.all([
      db.prescription.findMany({
        where,
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNo: true,
              date: true,
              totalAmount: true,
              customer: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.prescription.count({ where }),
    ])

    return NextResponse.json({
      prescriptions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Prescriptions GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch prescriptions' }, { status: 500 })
  }
}

// POST /api/prescriptions - Create prescription (link to invoice if provided)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invoiceId, patientName, patientPhone, patientAge, patientGender, doctorName, doctorRegNo, imageUrl, notes, status } = body

    if (!patientName) {
      return NextResponse.json({ error: 'patientName is required' }, { status: 400 })
    }

    const prescription = await db.prescription.create({
      data: {
        invoiceId: invoiceId || null,
        patientName,
        patientPhone: patientPhone || null,
        patientAge: patientAge || null,
        patientGender: patientGender || null,
        doctorName: doctorName || null,
        doctorRegNo: doctorRegNo || null,
        imageUrl: imageUrl || null,
        notes: notes || null,
        status: status || 'active',
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            date: true,
            totalAmount: true,
          },
        },
      },
    })

    // If linked to an invoice, update the invoice's prescription reference
    if (invoiceId) {
      await db.salesInvoice.update({
        where: { id: invoiceId },
        data: {
          prescriptionId: prescription.id,
          doctorName: doctorName || undefined,
        },
      })
    }

    return NextResponse.json({ prescription }, { status: 201 })
  } catch (error) {
    console.error('Prescriptions POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create prescription' },
      { status: 400 }
    )
  }
}
