import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { compare } from 'bcryptjs'
import { createSessionToken, validateSessionToken, type SessionUser } from '@/lib/auth'

const COOKIE_NAME = 'pharmacare_session'
const COOKIE_MAX_AGE = 24 * 60 * 60 // 24 hours

function getSessionFromCookie(req: NextRequest): SessionUser | null {
  const cookie = req.cookies.get(COOKIE_NAME)
  if (!cookie?.value) return null
  return validateSessionToken(cookie.value)
}

function setCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

function clearCookie(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

// GET /api/auth → Check current session
export async function GET(req: NextRequest) {
  try {
    const user = getSessionFromCookie(req)
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    // Refresh staff data from DB
    const staff = await db.staff.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, lastLogin: true },
    })

    if (!staff || !staff.isActive) {
      const res = NextResponse.json({ authenticated: false }, { status: 401 })
      clearCookie(res)
      return res
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
      },
    })
  } catch (error) {
    console.error('Auth GET error:', error)
    return NextResponse.json({ authenticated: false }, { status: 500 })
  }
}

// POST /api/auth → Login
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Find staff by email or name
    const staff = await db.staff.findFirst({
      where: {
        OR: [
          { email: email },
          { name: { equals: email, mode: 'insensitive' } },
        ],
      },
    })

    if (!staff) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!staff.isActive) {
      return NextResponse.json({ error: 'Account is deactivated. Contact admin.' }, { status: 403 })
    }

    // Compare password
    if (!staff.password) {
      return NextResponse.json({ error: 'No password set. Contact admin.' }, { status: 401 })
    }

    const valid = await compare(password, staff.password)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Update last login
    await db.staff.update({
      where: { id: staff.id },
      data: { lastLogin: new Date() },
    })

    // Create session token
    const token = createSessionToken({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      role: staff.role,
    })

    const res = NextResponse.json({
      success: true,
      user: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
      },
    })

    setCookie(res, token)
    return res
  } catch (error) {
    console.error('Auth POST error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

// DELETE /api/auth → Logout
export async function DELETE(req: NextRequest) {
  try {
    const res = NextResponse.json({ success: true, message: 'Logged out' })
    clearCookie(res)
    return res
  } catch (error) {
    console.error('Auth DELETE error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
