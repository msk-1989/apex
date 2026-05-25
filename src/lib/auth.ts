import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const AUTH_SECRET = process.env.AUTH_SECRET || 'pharmacare-erp-secret-key-2024-change-in-production'
const TOKEN_EXPIRY_HOURS = 24

export interface SessionUser {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
}

function sign(payload: string): string {
  const sig = createHmac('sha256', AUTH_SECRET).update(payload).digest('hex').slice(0, 32)
  return Buffer.from(payload).toString('base64url') + '.' + sig
}

function unsign(token: string): string | null {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return null
    const payload = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    const expectedSig = createHmac('sha256', AUTH_SECRET).update(payload).digest('hex').slice(0, 32)
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null
    return Buffer.from(payload, 'base64url').toString('utf-8')
  } catch {
    return null
  }
}

export function createSessionToken(user: SessionUser): string {
  const payload = JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    exp: Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    nonce: randomBytes(8).toString('hex'),
  })
  return sign(payload)
}

export function validateSessionToken(token: string): SessionUser | null {
  const raw = unsign(token)
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (!data.id || !data.name || !data.role) return null
    if (data.exp && Date.now() > data.exp) return null
    return { id: data.id, name: data.name, email: data.email || null, phone: data.phone || null, role: data.role }
  } catch {
    return null
  }
}
