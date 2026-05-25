'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'

/* ═══════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════ */

interface BatchInfo {
  id: string
  batchNo: string
  expiryDate: string
  costPrice: number
  mrp: number
  sellingPrice: number
  currentStock: number
  wholesalePrice?: number | null
}

interface SchemeInfo {
  id: string
  name: string
  type: string // buy_x_get_y, flat_discount, quantity_discount
  buyQty?: number | null
  getQty?: number | null
  flatDiscount?: number | null
  minQty?: number | null
  maxQty?: number | null
  qtyDiscountPct?: number | null
  description?: string | null
  scope: string
  categoryId?: string | null
  manufacturerId?: string | null
  medicineId?: string | null
}

interface UnitConversionInfo {
  id: string
  fromUnit: string
  toUnit: string
  factor: number
}

interface CartItem {
  id: string
  medicineId: string
  medicineName: string
  genericName: string
  batchId: string
  batchNo: string
  expiryDate: string
  sellingPrice: number
  gstRate: number
  quantity: number
  discount: number
  maxStock: number
  schedule: string
  strength: string
  form: string
  manufacturer: string
  /* new fields */
  scheme?: SchemeInfo | null
  freeQty: number
  expiryStatus: 'ok' | 'near' | 'critical'
  expiryDiscount: number
  unitConversion?: UnitConversionInfo | null
  selectedUnit: string
  prescriptionRequired: boolean
  prescriptionConfirmed: boolean
}

interface Customer {
  id: string
  name: string
  phone: string | null
  type: string
  creditLimit: number
  balance: number
  riskCategory: string
}

interface PrescriptionInfo {
  patientName: string
  patientPhone: string
  patientAge: number
  patientGender: string
  doctorName: string
  doctorRegNo: string
  notes: string
}

type PaymentMode = 'cash' | 'card' | 'upi'
type BillType = 'retail' | 'wholesale'
type CounterName = 'Counter-A' | 'Counter-B' | 'Counter-C'

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */

let _seq = 0
function uid(): string {
  return `c${Date.now()}_${++_seq}`
}

function cur(n: number): string {
  return '\u20B9' + n.toFixed(2)
}

function shortDate(d: string | Date): string {
  if (!d) return ''
  return format(new Date(d), 'MM/yy')
}

function fullDate(d: Date): string {
  return format(d, 'dd/MM/yyyy')
}

/** Check expiry: returns 'critical' (< 1 month), 'near' (< 3 months), 'ok' */
function getExpiryStatus(expiryDate: string): 'ok' | 'near' | 'critical' {
  const now = new Date()
  const exp = new Date(expiryDate)
  const diffMs = exp.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 30) return 'critical'
  if (diffDays < 90) return 'near'
  return 'ok'
}

/** Get suggested expiry discount */
function getExpiryDiscount(status: 'ok' | 'near' | 'critical'): number {
  if (status === 'critical') return 10
  if (status === 'near') return 5
  return 0
}

/** FEFO: pick batch with earliest expiry that has stock */
function fefoPick(batches: BatchInfo[]): BatchInfo | null {
  const sorted = [...batches]
    .filter(b => b.currentStock > 0)
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
  return sorted[0] ?? null
}

/** Check if a scheme applies to a medicine */
function schemeApplies(scheme: SchemeInfo, med: any): boolean {
  if (scheme.scope === 'all') return true
  if (scheme.scope === 'specific' && scheme.medicineId === med.id) return true
  if (scheme.scope === 'category' && scheme.categoryId === med.categoryId) return true
  if (scheme.scope === 'manufacturer' && scheme.manufacturerId === med.manufacturerId) return true
  return false
}

/** Calculate scheme details */
function calcScheme(scheme: SchemeInfo, qty: number): { freeQty: number; discount: number; label: string } {
  if (scheme.type === 'buy_x_get_y' && scheme.buyQty && scheme.getQty) {
    const freeQty = Math.floor(qty / scheme.buyQty) * scheme.getQty
    return { freeQty, discount: 0, label: `Buy ${scheme.buyQty} Get ${scheme.getQty}` }
  }
  if (scheme.type === 'flat_discount' && scheme.flatDiscount) {
    return { freeQty: 0, discount: scheme.flatDiscount, label: `${scheme.flatDiscount}% Off` }
  }
  if (scheme.type === 'quantity_discount' && scheme.minQty && scheme.qtyDiscountPct) {
    if (qty >= scheme.minQty) {
      return { freeQty: 0, discount: scheme.qtyDiscountPct, label: `${scheme.qtyDiscountPct}% Off (${scheme.minQty}+)` }
    }
    return { freeQty: 0, discount: 0, label: `Need ${scheme.minQty}+ for ${scheme.qtyDiscountPct}%` }
  }
  return { freeQty: 0, discount: 0, label: scheme.name }
}

/* ---- per-item calculations ---- */
function itemBase(i: CartItem): number {
  return +(i.sellingPrice * i.quantity).toFixed(2)
}
function itemDisc(i: CartItem): number {
  return +(itemBase(i) * ((i.discount + i.expiryDiscount) / 100)).toFixed(2)
}
function itemGst(i: CartItem): number {
  return +((itemBase(i) - itemDisc(i)) * (i.gstRate / 100)).toFixed(2)
}
function itemNet(i: CartItem): number {
  return +(itemBase(i) - itemDisc(i) + itemGst(i)).toFixed(2)
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */

export default function POSModule() {
  /* ─── state ─── */
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCartIdx, setSelectedCartIdx] = useState<number>(-1)
  const [searchQ, setSearchQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [showDrop, setShowDrop] = useState(false)
  const [hlIdx, setHlIdx] = useState(-1)
  const [barcodeMode, setBarcodeMode] = useState(false)

  const [custQ, setCustQ] = useState('')
  const [custList, setCustList] = useState<Customer[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [showCustDrop, setShowCustDrop] = useState(false)

  const [doctor, setDoctor] = useState('')
  const [rxNo, setRxNo] = useState('')
  const [payMode, setPayMode] = useState<PaymentMode>('cash')
  const [billType, setBillType] = useState<BillType>('retail')
  const [cashIn, setCashIn] = useState('')
  const [saving, setSaving] = useState(false)
  const [counter, setCounter] = useState<CounterName>('Counter-A')

  const [schemeDialog, setSchemeDialog] = useState(false)
  const [rxDialog, setRxDialog] = useState(false)
  const [rxDialogItem, setRxDialogItem] = useState<string | null>(null)
  const [rxDialogDoctor, setRxDialogDoctor] = useState('')
  const [rxDialogRxNo, setRxDialogRxNo] = useState('')
  const [prescription, setPrescription] = useState<PrescriptionInfo>({
    patientName: '', patientPhone: '', patientAge: 0, patientGender: 'male',
    doctorName: '', doctorRegNo: '', notes: '',
  })
  const [rxLinkDialog, setRxLinkDialog] = useState(false)

  const [invDate] = useState(new Date())
  const invNo = `INV-${invDate.getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000).padStart(5, '0')}`

  /* ─── schemes cache ─── */
  const [schemesMap, setSchemesMap] = useState<Record<string, SchemeInfo[]>>({})
  const [unitConvMap, setUnitConvMap] = useState<Record<string, UnitConversionInfo[]>>({})

  /* ─── refs ─── */
  const searchRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const custRef = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const custTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const doSaveRef = useRef<() => void>(() => {})

  /* ════════════════ MEMOS ════════════════ */

  const expiryAlerts = useMemo(() => cart.filter(i => i.expiryStatus !== 'ok'), [cart])
  const scheduledItems = useMemo(() => cart.filter(i => i.prescriptionRequired && !i.prescriptionConfirmed), [cart])
  const schemeItems = useMemo(() => cart.filter(i => i.scheme), [cart])
  const totalFreeQty = useMemo(() => cart.reduce((s, i) => s + i.freeQty, 0), [cart])
  const totalSchemeSavings = useMemo(() => {
    return cart.reduce((s, i) => {
      if (!i.scheme) return s
      const sc = calcScheme(i.scheme, i.quantity)
      if (sc.freeQty > 0) return s + (sc.freeQty * i.sellingPrice)
      if (sc.discount > 0) return s + itemBase(i) * (sc.discount / 100)
      return s
    }, 0)
  }, [cart])

  /* ════════════════ SCHEME FETCHING ════════════════ */

  const fetchSchemes = useCallback(async (medicineId: string) => {
    if (schemesMap[medicineId]) return schemesMap[medicineId]
    try {
      const r = await fetch(`/api/schemes?medicineId=${medicineId}&active=true`)
      if (!r.ok) return []
      const d = await r.json()
      const list = d.schemes || []
      setSchemesMap(prev => ({ ...prev, [medicineId]: list }))
      return list
    } catch { return [] }
  }, [schemesMap])

  const fetchUnitConversions = useCallback(async (medicineId: string) => {
    if (unitConvMap[medicineId]) return unitConvMap[medicineId]
    try {
      const r = await fetch(`/api/unit-conversions?medicineId=${medicineId}`)
      if (!r.ok) return []
      const d = await r.json()
      const list = d.conversions || []
      setUnitConvMap(prev => ({ ...prev, [medicineId]: list }))
      return list
    } catch { return [] }
  }, [unitConvMap])

  /* ════════════════ MEDICINE SEARCH ════════════════ */

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 1) { setResults([]); setShowDrop(false); return }
    setSearching(true)
    try {
      const r = await fetch(`/api/medicines?search=${encodeURIComponent(q)}&limit=20`)
      if (!r.ok) return
      const d = await r.json()
      const list = (d.medicines || []).map((m: any) => {
        const b = fefoPick(m.batches || [])
        const total = (m.batches || []).reduce((s: number, x: BatchInfo) => s + x.currentStock, 0)
        return { ...m, _b: b, _stock: total }
      }).filter((m: any) => m._b)
      setResults(list)
      setShowDrop(list.length > 0)
      setHlIdx(-1)
    } catch { toast.error('Search failed') }
    finally { setSearching(false) }
  }, [])

  const onSearchInput = (v: string) => {
    setSearchQ(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => doSearch(v), 150)
    // Auto-detect barcode (all digits, length >= 6)
    if (/^\d{6,}$/.test(v)) {
      if (searchTimer.current) clearTimeout(searchTimer.current)
      searchTimer.current = setTimeout(() => doSearch(v), 50)
    }
  }

  const addMed = async (med: any) => {
    const b = med._b as BatchInfo
    if (!b) return

    // Check schedule drug control
    const sched = med.schedule || 'none'
    const isRx = ['H', 'H1', 'X'].includes(sched)
    if (isRx) {
      setRxDialog(true)
      setRxDialogItem(`${med.id}__${b.id}`)
      setRxDialogDoctor('')
      setRxDialogRxNo('')
      // Store pending med
      pendingMedRef.current = { med, b }
      return
    }

    // Fetch schemes and unit conversions
    const [schemes, convs] = await Promise.all([
      fetchSchemes(med.id),
      fetchUnitConversions(med.id),
    ])

    // Find applicable scheme
    let applicableScheme: SchemeInfo | null = null
    for (const s of schemes) {
      if (schemeApplies(s, med)) {
        applicableScheme = s
        break
      }
    }

    // Check expiry
    const expStatus = getExpiryStatus(b.expiryDate)
    const expDiscount = getExpiryDiscount(expStatus)

    // Unit conversion
    let selectedUnit = med.unit || 'strip'
    let unitConv: UnitConversionInfo | null = null
    if (convs.length > 0) {
      unitConv = convs[0]
      selectedUnit = convs[0].fromUnit
    }

    // Calculate initial scheme
    let freeQty = 0
    let discount = 0
    if (applicableScheme) {
      const sc = calcScheme(applicableScheme, 1)
      freeQty = sc.freeQty
      discount = sc.discount
    }

    setCart(prev => {
      const ei = prev.findIndex(c => c.medicineId === med.id && c.batchId === b.id)
      if (ei >= 0) {
        const it = prev[ei]
        if (it.quantity + 1 > it.maxStock) { toast.error(`Stock limit: ${it.maxStock}`); return prev }
        const u = [...prev]; u[ei] = { ...it, quantity: it.quantity + 1 }; return u
      }
      return [...prev, {
        id: uid(), medicineId: med.id, medicineName: med.name,
        genericName: med.genericName || '', batchId: b.id, batchNo: b.batchNo,
        expiryDate: b.expiryDate, sellingPrice: billType === 'wholesale' ? (b.wholesalePrice || b.sellingPrice) : b.sellingPrice,
        gstRate: med.gstRate || 5,
        quantity: 1, discount, maxStock: b.currentStock,
        schedule: sched, strength: med.strength || '', form: med.form || '',
        manufacturer: med.manufacturer?.name || '',
        scheme: applicableScheme, freeQty, expiryStatus: expStatus, expiryDiscount: expDiscount,
        unitConversion: unitConv, selectedUnit,
        prescriptionRequired: isRx, prescriptionConfirmed: false,
      }]
    })

    // Toast for scheme
    if (applicableScheme) {
      const sc = calcScheme(applicableScheme, 1)
      toast.success(`Scheme: ${sc.label}`, { description: 'Auto-applied to this item' })
    }
    if (expStatus !== 'ok') {
      toast.warning(`Short expiry detected!`, { description: expStatus === 'critical' ? '⛔ Critical — 10% discount suggested' : '⚠ Expiring soon — 5% discount suggested' })
    }

    setSearchQ(''); setResults([]); setShowDrop(false)
    searchRef.current?.focus()
  }

  const pendingMedRef = useRef<{ med: any; b: BatchInfo } | null>(null)

  const confirmRxDialog = async () => {
    if (!pendingMedRef.current) return
    const { med, b } = pendingMedRef.current
    const sched = med.schedule || 'none'

    if (sched === 'X' && !rxDialogRxNo.trim()) {
      toast.error('Prescription number is MANDATORY for Schedule X drugs')
      return
    }

    setDoctor(rxDialogDoctor)
    setRxNo(rxDialogRxNo)
    setRxDialog(false)

    // Fetch schemes and unit conversions
    const [schemes, convs] = await Promise.all([
      fetchSchemes(med.id),
      fetchUnitConversions(med.id),
    ])

    let applicableScheme: SchemeInfo | null = null
    for (const s of schemes) {
      if (schemeApplies(s, med)) {
        applicableScheme = s
        break
      }
    }

    const expStatus = getExpiryStatus(b.expiryDate)
    const expDiscount = getExpiryDiscount(expStatus)
    let selectedUnit = med.unit || 'strip'
    let unitConv: UnitConversionInfo | null = null
    if (convs.length > 0) {
      unitConv = convs[0]
      selectedUnit = convs[0].fromUnit
    }

    let freeQty = 0
    let discount = 0
    if (applicableScheme) {
      const sc = calcScheme(applicableScheme, 1)
      freeQty = sc.freeQty
      discount = sc.discount
    }

    setCart(prev => {
      const ei = prev.findIndex(c => c.medicineId === med.id && c.batchId === b.id)
      if (ei >= 0) {
        const it = prev[ei]
        if (it.quantity + 1 > it.maxStock) { toast.error(`Stock limit: ${it.maxStock}`); return prev }
        const u = [...prev]; u[ei] = { ...it, quantity: it.quantity + 1 }; return u
      }
      return [...prev, {
        id: uid(), medicineId: med.id, medicineName: med.name,
        genericName: med.genericName || '', batchId: b.id, batchNo: b.batchNo,
        expiryDate: b.expiryDate, sellingPrice: billType === 'wholesale' ? (b.wholesalePrice || b.sellingPrice) : b.sellingPrice,
        gstRate: med.gstRate || 5,
        quantity: 1, discount, maxStock: b.currentStock,
        schedule: sched, strength: med.strength || '', form: med.form || '',
        manufacturer: med.manufacturer?.name || '',
        scheme: applicableScheme, freeQty, expiryStatus: expStatus, expiryDiscount: expDiscount,
        unitConversion: unitConv, selectedUnit,
        prescriptionRequired: true, prescriptionConfirmed: true,
      }]
    })

    if (applicableScheme) {
      const sc = calcScheme(applicableScheme, 1)
      toast.success(`Scheme: ${sc.label}`, { description: 'Auto-applied to this item' })
    }

    setSearchQ(''); setResults([]); setShowDrop(false)
    searchRef.current?.focus()
    pendingMedRef.current = null
  }

  const cancelRxDialog = () => {
    setRxDialog(false)
    setRxDialogItem(null)
    pendingMedRef.current = null
    searchRef.current?.focus()
  }

  /* ─── dropdown keyboard nav ─── */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (!showDrop || !results.length) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setHlIdx(p => Math.min(p + 1, results.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHlIdx(p => Math.max(p - 1, 0)) }
      else if (e.key === 'Enter' && hlIdx >= 0) { e.preventDefault(); addMed(results[hlIdx]) }
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [showDrop, results, hlIdx])

  /* ─── click outside search dropdown ─── */
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  /* ─── click outside customer dropdown ─── */
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (custRef.current && !custRef.current.contains(e.target as Node)) setShowCustDrop(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  /* ════════════════ CART OPS ════════════════ */

  const updateCartItem = useCallback((id: string, updates: Partial<CartItem>) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i
      const updated = { ...i, ...updates }
      // Recalculate scheme
      if (i.scheme) {
        const sc = calcScheme(i.scheme, updated.quantity)
        updated.freeQty = sc.freeQty
        if (sc.discount > 0 && updated.discount < sc.discount) {
          updated.discount = sc.discount
        }
      }
      return updated
    }))
  }, [])

  const setQty = (id: string, q: number) => {
    if (q < 1) return
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i
      if (q > i.maxStock) { toast.error(`Max stock: ${i.maxStock}`); return i }
      const updated = { ...i, quantity: q }
      if (i.scheme) {
        const sc = calcScheme(i.scheme, q)
        updated.freeQty = sc.freeQty
        if (sc.discount > 0) updated.discount = sc.discount
      }
      return updated
    }))
  }

  const setDisc = (id: string, d: number) => {
    setCart(prev => prev.map(i => i.id !== id ? i : { ...i, discount: Math.max(0, Math.min(100, d)) }))
  }

  const delItem = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id))
    setSelectedCartIdx(-1)
  }

  const applyExpiryDiscount = (id: string) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i
      return { ...i, expiryDiscount: getExpiryDiscount(i.expiryStatus) }
    }))
  }

  const applySchemeToItem = (id: string) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id || !i.scheme) return i
      const sc = calcScheme(i.scheme, i.quantity)
      return { ...i, freeQty: sc.freeQty, discount: Math.max(i.discount, sc.discount) }
    }))
  }

  /* ════════════════ CALCULATIONS ════════════════ */

  const subtot = cart.reduce((s, i) => s + itemBase(i), 0)
  const totDisc = cart.reduce((s, i) => s + itemDisc(i), 0)
  const totGst = cart.reduce((s, i) => s + itemGst(i), 0)
  const cgst = +(totGst / 2).toFixed(2)
  const sgst = +(totGst / 2).toFixed(2)
  const raw = subtot - totDisc + totGst
  const roundOff = Math.round(raw) - raw
  const grand = Math.round(raw)
  const taxable = +(subtot - totDisc).toFixed(2)
  const discPct = subtot > 0 ? +((totDisc / subtot) * 100).toFixed(1) : 0
  const totQty = cart.reduce((s, i) => s + i.quantity, 0)
  const cashVal = parseFloat(cashIn) || 0
  const change = cashVal - grand

  const allSameRate = cart.length > 0 && cart.every(i => i.gstRate === cart[0].gstRate)
  const gstLabel = allSameRate ? (cart[0].gstRate / 2).toFixed(1) : '\u2014'

  /* ════════════════ CREDIT RISK ════════════════ */

  const creditRisk = useMemo(() => {
    if (!customer) return null
    if (customer.type === 'retail') return null
    const remaining = customer.creditLimit - customer.balance
    return {
      exceeded: customer.balance > customer.creditLimit,
      blocked: customer.riskCategory === 'blocked',
      remaining,
      limit: customer.creditLimit,
      balance: customer.balance,
    }
  }, [customer])

  /* ════════════════ CUSTOMER SEARCH ════════════════ */

  const doCustSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setCustList([]); setShowCustDrop(false); return }
    try {
      const r = await fetch(`/api/customers?search=${encodeURIComponent(q)}&limit=10`)
      if (!r.ok) return
      const d = await r.json()
      setCustList(d.customers || [])
      setShowCustDrop((d.customers || []).length > 0)
    } catch { /* silent */ }
  }, [])

  const onCustInput = (v: string) => {
    setCustQ(v); setCustomer(null)
    if (custTimer.current) clearTimeout(custTimer.current)
    custTimer.current = setTimeout(() => doCustSearch(v), 150)
  }

  const pickCust = (c: Customer) => {
    setCustomer(c); setCustQ(c.name); setShowCustDrop(false)
    if (c.riskCategory === 'blocked') {
      toast.error(`Customer "${c.name}" billing is BLOCKED`, { description: 'Risk category: BLOCKED. Contact management.' })
    } else if (c.balance > c.creditLimit) {
      toast.warning(`Credit limit exceeded for "${c.name}"`, { description: `Balance: ${cur(c.balance)}, Limit: ${cur(c.creditLimit)}` })
    }
  }

  const clearCust = () => { setCustomer(null); setCustQ('') }

  /* ════════════════ SAVE / HOLD / CANCEL ════════════════ */

  const doSave = useCallback(async () => {
    if (cart.length === 0) { toast.error('Cannot save empty bill'); return }

    // Check scheduled drugs prescription
    const unconfirmedRx = cart.filter(i => i.prescriptionRequired && !i.prescriptionConfirmed)
    if (unconfirmedRx.length > 0) {
      toast.error('Prescription required for scheduled drugs', { description: `${unconfirmedRx.length} item(s) need prescription confirmation` })
      return
    }

    // Check Schedule X prescription number
    const noRxNo = cart.filter(i => i.schedule === 'X' && !rxNo.trim())
    if (noRxNo.length > 0) {
      toast.error('Schedule X drugs require prescription number', { description: 'Please enter Rx# before saving' })
      return
    }

    // Check credit risk
    if (creditRisk?.blocked) {
      toast.error('Customer billing BLOCKED', { description: 'This customer has been blocked by management.' })
      return
    }

    if (payMode === 'cash' && cashVal < grand && grand > 0) { toast.error('Insufficient cash received'); return }
    if (saving) return
    setSaving(true)
    try {
      const r = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterId: counter,
          type: billType,
          paymentMode: payMode,
          customerId: customer?.id || null,
          doctorName: doctor || null,
          prescriptionNo: rxNo || null,
          items: cart.map(i => ({
            medicineId: i.medicineId, batchId: i.batchId, quantity: i.quantity,
            sellingPrice: i.sellingPrice, gstRate: i.gstRate, discount: i.discount + i.expiryDiscount,
            freeQty: i.freeQty,
          })),
        }),
      })
      if (r.ok) {
        const d = await r.json()
        toast.success(`Invoice ${d.invoice?.invoiceNo || invNo} saved!`)
        setCart([]); setCashIn(''); setDoctor(''); setRxNo(''); clearCust()
        setSelectedCartIdx(-1)
      } else {
        const d = await r.json()
        toast.error(d.error || 'Failed to save invoice')
      }
    } catch { toast.error('Network error') }
    finally { setSaving(false) }
  }, [cart, payMode, cashVal, grand, saving, customer, doctor, rxNo, invNo, billType, counter, creditRisk])

  doSaveRef.current = doSave

  const doHold = useCallback(() => {
    if (cart.length === 0) { toast.error('Nothing to hold'); return }
    toast.info('Bill held. Start a new bill.')
    setCart([]); setCashIn(''); setSelectedCartIdx(-1)
  }, [cart])

  const doCancel = useCallback(() => {
    if (cart.length === 0) return
    setCart([]); setCashIn(''); setDoctor(''); setRxNo(''); clearCust()
    setSelectedCartIdx(-1)
    toast.info('Bill cancelled')
  }, [cart])

  const doNewBill = useCallback(() => {
    setCart([]); setCashIn(''); setDoctor(''); setRxNo(''); clearCust()
    setSearchQ(''); setResults([]); setShowDrop(false)
    setSelectedCartIdx(-1)
    toast.info('New bill started')
  }, [])

  const doClearAll = useCallback(() => {
    setCart([]); setCashIn(''); setDoctor(''); setRxNo(''); clearCust()
    setSearchQ(''); setResults([]); setShowDrop(false)
    setSelectedCartIdx(-1)
    toast.info('All cleared')
  }, [])

  /* ════════════════ KEYBOARD SHORTCUTS ════════════════ */

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs (except for specific shortcuts)
      const tag = (e.target as HTMLElement)?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === 'F2' && !inInput) { e.preventDefault(); searchRef.current?.focus(); return }
      if (e.key === 'F3' && !inInput) { e.preventDefault(); custRef.current?.querySelector('input')?.focus(); return }
      if (e.key === 'F4') { e.preventDefault(); doHold(); return }
      if (e.key === 'F5') {
        e.preventDefault()
        // Apply scheme to selected item
        if (selectedCartIdx >= 0 && cart[selectedCartIdx]) {
          applySchemeToItem(cart[selectedCartIdx].id)
          toast.success('Scheme applied')
        }
        return
      }
      if (e.key === 'F6' && !inInput) {
        e.preventDefault()
        setBillType(prev => {
          const next = prev === 'retail' ? 'wholesale' : 'retail'
          toast.info(`Switched to ${next} billing`)
          return next
        })
        return
      }
      if (e.key === 'F7') { e.preventDefault(); toast.info('Delivery feature — enter delivery address'); return }
      if (e.key === 'F8') { e.preventDefault(); doSaveRef.current(); return }
      if (e.key === 'F9') { e.preventDefault(); doClearAll(); return }
      if (e.key === 'F10') { e.preventDefault(); doNewBill(); return }
      if (e.key === 'F11' && !inInput) {
        e.preventDefault()
        setCounter(prev => {
          const keys: CounterName[] = ['Counter-A', 'Counter-B', 'Counter-C']
          const idx = keys.indexOf(prev)
          return keys[(idx + 1) % keys.length]
        })
        toast.info('Counter switched')
        return
      }
      if (e.key === 'F12') { e.preventDefault(); doCancel(); return }
      if (e.key === 'Escape') {
        setShowDrop(false); setShowCustDrop(false)
        if (rxDialog) { cancelRxDialog(); return }
        if (schemeDialog) { setSchemeDialog(false); return }
        if (rxLinkDialog) { setRxLinkDialog(false); return }
      }
      // Ctrl shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b' || e.key === 'B') { e.preventDefault(); setBarcodeMode(p => { const next = !p; searchRef.current?.focus(); toast.info(next ? 'Barcode mode ON — scan or type barcode' : 'Barcode mode OFF'); return next }); return }
        if (e.key === 'p' || e.key === 'P') { e.preventDefault(); doSaveRef.current(); return }
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); searchRef.current?.focus(); return }
        if (e.key === 'd' || e.key === 'D') {
          e.preventDefault()
          if (selectedCartIdx >= 0 && cart[selectedCartIdx]) {
            const item = cart[selectedCartIdx]
            setDisc(item.id, item.discount >= 5 ? 0 : 5)
          }
          return
        }
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [doHold, doCancel, doNewBill, doClearAll, selectedCartIdx, cart, billType, barcodeMode, rxDialog, schemeDialog, rxLinkDialog])

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ═══ EXPIRY ALERT PANEL ═══ */}
      {expiryAlerts.length > 0 && (
        <div style={{
          background: expiryAlerts.some(a => a.expiryStatus === 'critical') ? '#FFE0E0' : '#FFF0D0',
          borderBottom: '1px solid ' + (expiryAlerts.some(a => a.expiryStatus === 'critical') ? '#CC0000' : '#CC6600'),
          padding: '3px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 700, color: expiryAlerts.some(a => a.expiryStatus === 'critical') ? '#CC0000' : '#CC6600', fontSize: '8pt' }}>
            {expiryAlerts.some(a => a.expiryStatus === 'critical') ? '\u26D4' : '\u26A0'} Short Expiry Alert:
          </span>
          {expiryAlerts.map(item => (
            <span key={item.id} style={{ fontSize: '7pt', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              {item.medicineName}
              <span className={`marg-badge ${item.expiryStatus === 'critical' ? 'marg-badge-red' : 'marg-badge-orange'}`}>
                {item.expiryStatus === 'critical' ? '\u26D4 Critical' : '\u26A0 Exp ' + shortDate(item.expiryDate)}
              </span>
              {item.expiryDiscount > 0 ? (
                <span className="marg-badge marg-badge-green" style={{ fontSize: '7pt' }}>({item.expiryDiscount}% Applied)</span>
              ) : (
                <span style={{ color: '#808080' }}>({getExpiryDiscount(item.expiryStatus)}% disc available)</span>
              )}
              {item.expiryDiscount === 0 && (
                <button className="marg-btn" style={{ height: '15px', fontSize: '7pt', padding: '0 4px', minWidth: '40px' }}
                  onClick={() => applyExpiryDiscount(item.id)}>Apply</button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* ═══ CREDIT RISK PANEL ═══ */}
      {creditRisk && creditRisk.blocked && (
        <div style={{ background: '#FFE0E0', borderBottom: '1px solid #CC0000', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="marg-badge marg-badge-red">\u26D4 BLOCKED</span>
          <span style={{ fontWeight: 700, color: '#CC0000', fontSize: '8pt' }}>Customer billing BLOCKED — {customer?.name}</span>
          <span style={{ color: '#CC0000', fontSize: '7pt' }}>Risk Category: BLOCKED. Contact management to resolve.</span>
        </div>
      )}
      {creditRisk && creditRisk.exceeded && !creditRisk.blocked && (
        <div style={{ background: '#FFF0D0', borderBottom: '1px solid #CC6600', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="marg-badge marg-badge-orange">\u26A0 Credit Limit</span>
          <span style={{ fontWeight: 700, color: '#CC6600', fontSize: '8pt' }}>Credit limit exceeded! {customer?.name}</span>
          <span style={{ color: '#CC6600', fontSize: '7pt' }}>Balance: {cur(creditRisk.balance)} / Limit: {cur(creditRisk.limit)}</span>
        </div>
      )}

      {/* ═══ TITLE BAR ═══ */}
      <div className="marg-titlebar">
        <span>POS / Billing — {billType === 'retail' ? 'Retail' : 'Wholesale'} Invoice</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {barcodeMode && <span className="marg-badge marg-badge-green" style={{ fontSize: '7pt' }}>BARCODE MODE</span>}
          <span className="marg-badge marg-badge-blue">{counter}</span>
          <span style={{ fontSize: '7pt', opacity: 0.7 }}>{fullDate(invDate)}</span>
        </div>
      </div>

      {/* ═══ INVOICE DETAILS ═══ */}
      <fieldset className="marg-groupbox" style={{ margin: '2px 3px 0 3px' }}>
        <legend>Invoice Details</legend>
        {/* Row 1 */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <div className="marg-field" style={{ flex: 1 }}>
            <span className="marg-label">Invoice#:</span>
            <input className="marg-input marg-input-readonly" value={invNo} readOnly />
          </div>
          <div className="marg-field" style={{ flex: 1 }}>
            <span className="marg-label">Date:</span>
            <input className="marg-input marg-input-readonly" value={fullDate(invDate)} readOnly />
          </div>
          <div className="marg-field" style={{ flex: 1 }}>
            <span className="marg-label">Counter:</span>
            <input className="marg-input marg-input-readonly" value={counter} readOnly />
          </div>
          <div className="marg-field" style={{ flex: 1 }}>
            <span className="marg-label">Type:</span>
            <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
              <button className={`marg-btn ${billType === 'retail' ? 'marg-btn-blue' : ''}`} style={{ flex: 1 }}
                onClick={() => setBillType('retail')}>Retail</button>
              <button className={`marg-btn ${billType === 'wholesale' ? 'marg-btn-blue' : ''}`} style={{ flex: 1 }}
                onClick={() => setBillType('wholesale')}>Wholesale</button>
            </div>
          </div>
        </div>
        {/* Row 2 */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {/* Customer */}
          <div className="marg-field" style={{ flex: 2, position: 'relative' }} ref={custRef}>
            <span className="marg-label">Customer:</span>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                className="marg-input"
                value={customer ? customer.name : custQ || ''}
                onChange={e => onCustInput(e.target.value)}
                onFocus={() => { if (custList.length > 0) setShowCustDrop(true) }}
                placeholder="Walk-in (F3 to search)"
                autoComplete="off"
                style={{ flex: 1, paddingRight: customer ? '18px' : '3px' }}
              />
              {!customer && !custQ && (
                <span style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', color: '#808080', pointerEvents: 'none', fontSize: '8pt' }}>Walk-in</span>
              )}
              {customer && (
                <button
                  className="marg-btn"
                  style={{ position: 'absolute', right: '1px', top: '1px', height: '16px', minWidth: '14px', padding: '0 2px', fontSize: '7pt', lineHeight: '1' }}
                  onClick={clearCust}
                >\u2715</button>
              )}
              {/* Credit info for selected customer */}
              {customer && customer.type !== 'retail' && creditRisk && (
                <span style={{ position: 'absolute', right: customer ? '20px' : '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '7pt', color: creditRisk.exceeded ? '#CC0000' : '#006600', pointerEvents: 'none' }}>
                  {cur(creditRisk.remaining)} / {cur(creditRisk.limit)}
                </span>
              )}
              {showCustDrop && custList.length > 0 && (
                <div className="marg-sunken" style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  maxHeight: '160px', overflowY: 'auto', zIndex: 60, background: '#FFFFFF',
                }}>
                  {custList.map(c => (
                    <div key={c.id}
                      onClick={() => pickCust(c as Customer)}
                      style={{
                        padding: '2px 4px', cursor: 'pointer', borderBottom: '1px solid #E0E0E0',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#CCDDEF' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '' }}
                    >
                      <span>{c.name}</span>
                      <span style={{ color: '#808080', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {c.phone || ''}
                        <span className={`marg-badge ${c.riskCategory === 'blocked' ? 'marg-badge-red' : c.type === 'wholesale' ? 'marg-badge-blue' : 'marg-badge-green'}`}>{c.type}</span>
                        {c.riskCategory !== 'low' && c.riskCategory !== 'blocked' && (
                          <span className="marg-badge marg-badge-orange">{c.riskCategory}</span>
                        )}
                        {c.riskCategory === 'blocked' && (
                          <span className="marg-badge marg-badge-red">BLOCKED</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Doctor */}
          <div className="marg-field" style={{ flex: 1 }}>
            <span className="marg-label">Doctor:</span>
            <input className="marg-input" value={doctor} onChange={e => setDoctor(e.target.value)} placeholder="Doctor name" />
          </div>
          {/* Rx# + Prescription */}
          <div className="marg-field" style={{ flex: 1 }}>
            <span className="marg-label">Rx#:</span>
            <input className="marg-input" value={rxNo} onChange={e => setRxNo(e.target.value)} placeholder="Prescription No." style={{ flex: 1 }} />
            <button className="marg-btn marg-btn-blue" style={{ height: '20px', minWidth: '20px', padding: '0 4px', fontSize: '7pt' }}
              onClick={() => setRxLinkDialog(true)} title="Attach Prescription">
              Rx
            </button>
          </div>
        </div>
      </fieldset>

      {/* ═══ SEARCH MEDICINE ═══ */}
      <fieldset className="marg-groupbox" style={{ margin: '2px 3px 0 3px' }}>
        <legend>Search Medicine (F2) {barcodeMode && <span className="marg-badge marg-badge-green" style={{ marginLeft: '4px' }}>Barcode Mode</span>}</legend>
        <div className="marg-field" ref={dropRef} style={{ position: 'relative' }}>
          <span className="marg-label">Medicine:</span>
          <div style={{ flex: 1, display: 'flex', gap: '4px', position: 'relative' }}>
            <input
              ref={searchRef}
              className="marg-input"
              value={searchQ}
              onChange={e => onSearchInput(e.target.value)}
              onFocus={() => { if (results.length > 0) setShowDrop(true) }}
              placeholder={barcodeMode ? 'Scan or type barcode...' : 'Type medicine name, generic, or barcode (Ctrl+B)...'}
              autoComplete="off"
              style={{ flex: 1, background: barcodeMode ? '#FFFDE6' : '#FFFFFF' }}
            />
            {searching && <span style={{ fontSize: '7pt', color: '#808080', whiteSpace: 'nowrap', alignSelf: 'center' }}>Searching...</span>}
            <button className="marg-btn" style={{ height: '20px', minWidth: '20px', padding: '0 4px', fontSize: '7pt' }}
              onClick={() => { setBarcodeMode(p => !p); searchRef.current?.focus() }}
              title="Toggle Barcode Mode (Ctrl+B)">
              {barcodeMode ? '\u25A0' : '\u25A1'}
            </button>

            {/* ── Dropdown ── */}
            {showDrop && results.length > 0 && (
              <div className="marg-sunken" style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                maxHeight: '240px', overflowY: 'auto', zIndex: 50, background: '#FFFFFF',
              }}>
                {/* header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2.4fr 1fr 0.7fr 0.4fr 0.45fr 0.45fr 0.4fr 0.5fr',
                  background: 'linear-gradient(180deg, #ECE9D8, #D4D0C8)',
                  padding: '2px 4px', fontWeight: 700, fontSize: '7pt', color: '#003366',
                  borderBottom: '1px solid #808080',
                }}>
                  <span>Medicine</span>
                  <span>Generic</span>
                  <span>Manufacturer</span>
                  <span style={{ textAlign: 'center' }}>Form</span>
                  <span style={{ textAlign: 'center' }}>Batch</span>
                  <span style={{ textAlign: 'right' }}>MRP</span>
                  <span style={{ textAlign: 'right' }}>Stock</span>
                  <span style={{ textAlign: 'center' }}>Exp</span>
                </div>
                {/* rows */}
                {results.map((med: any, idx: number) => {
                  const b = med._b as BatchInfo
                  const expStatus = getExpiryStatus(b.expiryDate)
                  return (
                    <div key={`${med.id}-${b.id}`}
                      onClick={() => addMed(med)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2.4fr 1fr 0.7fr 0.4fr 0.45fr 0.45fr 0.4fr 0.5fr',
                        padding: '2px 4px', cursor: 'pointer', borderBottom: '1px solid #E0E0E0',
                        background: idx === hlIdx ? '#316AC5' : idx % 2 === 0 ? '#FFFFFF' : '#F5F8FC',
                        color: idx === hlIdx ? '#FFFFFF' : '#000000',
                        alignItems: 'center',
                      }}
                      onMouseEnter={() => setHlIdx(idx)}
                      onMouseLeave={() => setHlIdx(-1)}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {med.name}{med.strength ? ` ${med.strength}` : ''}
                        {(med.schedule === 'H' || med.schedule === 'H1') && (
                          <span className="marg-badge marg-badge-red" style={{ marginLeft: '2px' }}>Sch-{med.schedule}</span>
                        )}
                        {med.schedule === 'X' && (
                          <span className="marg-badge marg-badge-red" style={{ marginLeft: '2px', background: idx === hlIdx ? '#990000' : '', borderColor: idx === hlIdx ? '#FF6666' : '' }}>Sch-X</span>
                        )}
                      </span>
                      <span style={{ color: '#808080', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '7pt' }}>{med.genericName || '\u2014'}</span>
                      <span style={{ color: '#808080', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '7pt' }}>{med.manufacturer?.name || '\u2014'}</span>
                      <span style={{ textAlign: 'center', fontSize: '7pt' }}>{med.form || '\u2014'}</span>
                      <span style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '7pt' }}>{b.batchNo}</span>
                      <span style={{ textAlign: 'right', fontWeight: 600, fontSize: '7pt' }}>{cur(b.mrp)}</span>
                      <span style={{ textAlign: 'right', color: med._stock <= 10 ? '#CC0000' : '#006600', fontWeight: 600, fontSize: '7pt' }}>{med._stock}</span>
                      <span style={{
                        textAlign: 'center', fontSize: '7pt', fontWeight: 600,
                        color: idx === hlIdx ? '#FFFFFF' : expStatus === 'critical' ? '#CC0000' : expStatus === 'near' ? '#CC6600' : '#006600',
                      }}>{shortDate(b.expiryDate)}</span>
                    </div>
                  )
                })}
                <div style={{ padding: '1px 4px', background: '#F0F0F0', fontSize: '7pt', color: '#808080', borderTop: '1px solid #C0C0C0' }}>
                  {results.length} result(s) \u2014 Click to add | \u2191\u2193 navigate | Enter select | Esc close
                </div>
              </div>
            )}
          </div>
        </div>
      </fieldset>

      {/* ═══ MAIN: LEFT (items) + RIGHT (summary) ═══ */}
      <div style={{ flex: 1, display: 'flex', gap: '2px', overflow: 'hidden', padding: '2px 3px 0 3px', minHeight: 0 }}>

        {/* ═══════ LEFT: BILL ITEMS ═══════ */}
        <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div className="marg-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="marg-panel-caption">
              <span>Bill Items</span>
              <span style={{ fontSize: '7pt' }}>
                {cart.length > 0 ? `${cart.length} item(s) | ${totQty} qty` : 'No items'}
                {totalFreeQty > 0 && <span style={{ marginLeft: '4px', color: '#FFFF00' }}>+{totalFreeQty} FREE</span>}
              </span>
            </div>

            {cart.length === 0 ? (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#808080', textAlign: 'center', padding: '16px',
              }}>
                <span>No items in bill.<br />Press F2 or search above to add medicines.<br /><br />
                <span style={{ fontSize: '7pt', color: '#003366' }}>Shortcuts: F2 Search | F3 Customer | F4 Hold | F5 Scheme | F6 Type | F8 Save | F12 Cancel<br />Ctrl+B Barcode | Ctrl+P Print | Ctrl+D Discount | Ctrl+F Find</span>
                </span>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                <table className="marg-grid" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '22px', textAlign: 'center' }}>#</th>
                      <th style={{ width: 'auto' }}>Medicine</th>
                      <th style={{ width: '72px', textAlign: 'center' }}>Batch</th>
                      <th style={{ width: '36px', textAlign: 'center' }}>Exp</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>Qty</th>
                      <th style={{ width: '24px', textAlign: 'center' }}>Free</th>
                      <th style={{ width: '48px', textAlign: 'right' }}>Rate</th>
                      <th style={{ width: '34px', textAlign: 'center' }}>Disc%</th>
                      <th style={{ width: '30px', textAlign: 'center' }}>GST%</th>
                      <th style={{ width: '52px', textAlign: 'right' }}>Amt</th>
                      <th style={{ width: '18px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, idx) => (
                      <tr key={item.id}
                        onClick={() => setSelectedCartIdx(idx)}
                        style={{ background: idx === selectedCartIdx ? '#CCDDEF' : undefined }}
                      >
                        {/* # */}
                        <td style={{ textAlign: 'center', color: '#808080' }}>{idx + 1}</td>
                        {/* Medicine */}
                        <td>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.medicineName}
                            {/* Schedule badges */}
                            {(item.schedule === 'H' || item.schedule === 'H1') && (
                              <span className="marg-badge marg-badge-red" style={{ marginLeft: '2px' }}>Sch-{item.schedule}</span>
                            )}
                            {item.schedule === 'X' && (
                              <span className="marg-badge marg-badge-red" style={{ marginLeft: '2px', background: '#CC0000', color: '#FFFFFF', borderColor: '#990000' }}>Sch-X</span>
                            )}
                            {/* Scheme badge */}
                            {item.scheme && (
                              <span className="marg-badge marg-badge-green" style={{ marginLeft: '2px' }}>
                                {calcScheme(item.scheme, item.quantity).label}
                              </span>
                            )}
                            {/* Expiry badge */}
                            {item.expiryStatus === 'critical' && (
                              <span className="marg-badge marg-badge-red" style={{ marginLeft: '2px' }}>\u26D4 Critical</span>
                            )}
                            {item.expiryStatus === 'near' && (
                              <span className="marg-badge marg-badge-orange" style={{ marginLeft: '2px' }}>\u26A0 Exp {shortDate(item.expiryDate)}</span>
                            )}
                          </div>
                          <div style={{ color: '#808080', fontSize: '7pt', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {[item.strength, item.form, item.manufacturer].filter(Boolean).join(' \u00B7 ')}
                            {item.unitConversion && (
                              <span style={{ color: '#003366', marginLeft: '4px' }}>
                                1 {item.unitConversion.fromUnit} = {item.unitConversion.factor} {item.unitConversion.toUnit}
                              </span>
                            )}
                            {item.expiryDiscount > 0 && (
                              <span style={{ color: '#CC6600', marginLeft: '4px' }}>
                                Expiry disc: {item.expiryDiscount}%
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Batch */}
                        <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '7pt' }}>{item.batchNo}</td>
                        {/* Exp */}
                        <td style={{ textAlign: 'center', fontSize: '7pt' }}>{shortDate(item.expiryDate)}</td>
                        {/* Qty */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0' }}>
                            <button className="marg-btn" style={{ padding: '0 4px', height: '17px', minWidth: '16px', fontSize: '9pt', lineHeight: '1', borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                              onClick={() => setQty(item.id, item.quantity - 1)}>\u2212</button>
                            <input type="number" value={item.quantity}
                              onChange={e => setQty(item.id, parseInt(e.target.value) || 1)}
                              className="marg-input" style={{ width: '24px', textAlign: 'center', height: '17px', padding: '0 1px', flex: 'none', borderRadius: 0, fontSize: '7pt' }}
                              min={1} max={item.maxStock} />
                            <button className="marg-btn" style={{ padding: '0 4px', height: '17px', minWidth: '16px', fontSize: '9pt', lineHeight: '1', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                              onClick={() => setQty(item.id, item.quantity + 1)}>+</button>
                          </div>
                        </td>
                        {/* Free Qty */}
                        <td style={{ textAlign: 'center', fontWeight: 700, color: item.freeQty > 0 ? '#006600' : '#C0C0C0', fontSize: '7pt' }}>
                          {item.freeQty > 0 ? item.freeQty : '\u2014'}
                        </td>
                        {/* Rate */}
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '7pt' }}>{cur(item.sellingPrice)}</td>
                        {/* Disc% */}
                        <td style={{ textAlign: 'center' }}>
                          <input type="number" value={item.discount || ''}
                            onChange={e => setDisc(item.id, parseFloat(e.target.value) || 0)}
                            className="marg-input" style={{ width: '26px', textAlign: 'center', height: '17px', padding: '0 1px', flex: 'none', fontSize: '7pt' }}
                            min={0} max={100} placeholder="0" />
                        </td>
                        {/* GST% */}
                        <td style={{ textAlign: 'center', color: '#808080', fontSize: '7pt' }}>{item.gstRate}%</td>
                        {/* Amount */}
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '7pt' }}>{cur(itemNet(item))}</td>
                        {/* Remove */}
                        <td style={{ textAlign: 'center' }}>
                          <button className="marg-btn" style={{ padding: '0 2px', height: '16px', minWidth: '14px', fontSize: '7pt', lineHeight: '1', color: '#CC0000', fontWeight: 700 }}
                            onClick={() => delItem(item.id)}>\u2715</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Scheme Summary */}
            {schemeItems.length > 0 && totalSchemeSavings > 0 && (
              <div style={{ padding: '3px 6px', background: '#E0FFE0', borderTop: '1px solid #80C080', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: '#006600', fontSize: '7pt' }}>\u2705 Scheme Savings:</span>
                {schemeItems.map(item => {
                  if (!item.scheme) return null
                  const sc = calcScheme(item.scheme, item.quantity)
                  return (
                    <span key={item.id} style={{ fontSize: '7pt', color: '#006600' }}>
                      {item.medicineName}: <b>{sc.label}</b>
                      {sc.freeQty > 0 && ` (+${sc.freeQty} free = ${cur(sc.freeQty * item.sellingPrice)})`}
                      {sc.discount > 0 && ` (${cur(itemBase(item) * sc.discount / 100)} off)`}
                    </span>
                  )
                })}
                <span style={{ fontWeight: 700, color: '#006600', fontSize: '8pt', marginLeft: 'auto' }}>
                  Total: {cur(totalSchemeSavings)}
                </span>
              </div>
            )}

            {/* Prescription Warning */}
            {scheduledItems.length > 0 && (
              <div style={{ padding: '3px 6px', background: '#FFE0E0', borderTop: '1px solid #FF8080', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, color: '#CC0000', fontSize: '7pt' }}>\u26A0 Prescription Required:</span>
                {scheduledItems.map(item => (
                  <span key={item.id} style={{ fontSize: '7pt', color: '#CC0000' }}>
                    {item.medicineName} <span className="marg-badge marg-badge-red">Sch-{item.schedule}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══════ RIGHT: SUMMARY + PAYMENT ═══════ */}
        <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '2px' }}>

          {/* ── Bill Summary ── */}
          <div className="marg-panel" style={{ flex: '0 0 auto' }}>
            <div className="marg-panel-caption"><span>Bill Summary</span></div>
            <div style={{ padding: '4px 6px' }}>
              <div className="marg-field">
                <span className="marg-label">Subtotal (Gross):</span>
                <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>{cur(subtot)}</span>
              </div>
              <div className="marg-field">
                <span className="marg-label" style={{ color: '#CC0000' }}>(-) Discount:</span>
                <span style={{ flex: 1, textAlign: 'right', color: '#CC0000', fontWeight: 600 }}>\u2212 {cur(totDisc)} ({discPct}%)</span>
              </div>
              <div className="marg-field">
                <span className="marg-label">Taxable Amount:</span>
                <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>{cur(taxable)}</span>
              </div>
              <div className="marg-field">
                <span className="marg-label">CGST ({gstLabel}%):</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{cur(cgst)}</span>
              </div>
              <div className="marg-field">
                <span className="marg-label">SGST ({gstLabel}%):</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{cur(sgst)}</span>
              </div>
              {totalFreeQty > 0 && (
                <div className="marg-field">
                  <span className="marg-label" style={{ color: '#006600' }}>Free Items:</span>
                  <span style={{ flex: 1, textAlign: 'right', color: '#006600', fontWeight: 600 }}>{totalFreeQty} (Save: {cur(totalFreeQty > 0 ? cart.reduce((s, i) => s + (i.freeQty * i.sellingPrice), 0) : 0)})</span>
                </div>
              )}
              {totalSchemeSavings > 0 && (
                <div className="marg-field">
                  <span className="marg-label" style={{ color: '#006600' }}>Scheme Save:</span>
                  <span style={{ flex: 1, textAlign: 'right', color: '#006600', fontWeight: 600 }}>{cur(totalSchemeSavings)}</span>
                </div>
              )}
              <div className="marg-field">
                <span className="marg-label">Round Off:</span>
                <span style={{ flex: 1, textAlign: 'right', color: roundOff >= 0 ? '#006600' : '#CC0000', fontWeight: 600 }}>
                  {roundOff >= 0 ? '+' : ''}{cur(roundOff)}
                </span>
              </div>
              {/* Grand Total */}
              <div style={{
                borderTop: '2px solid #003366', marginTop: '4px', paddingTop: '5px', paddingBottom: '4px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              }}>
                <span style={{ fontWeight: 700, color: '#003366', fontSize: '10pt' }}>GRAND TOTAL:</span>
                <span style={{ fontWeight: 700, color: '#003366', fontSize: '14pt', fontFamily: 'Tahoma, monospace' }}>
                  {cur(grand)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Credit Info ── */}
          {customer && customer.type !== 'retail' && creditRisk && (
            <div className="marg-panel" style={{ flex: '0 0 auto' }}>
              <div className="marg-panel-caption"><span>Credit Info</span></div>
              <div style={{ padding: '4px 6px' }}>
                <div className="marg-field">
                  <span className="marg-label">Balance:</span>
                  <span style={{ flex: 1, textAlign: 'right', fontWeight: 600, color: creditRisk.exceeded ? '#CC0000' : '#000000' }}>{cur(creditRisk.balance)}</span>
                </div>
                <div className="marg-field">
                  <span className="marg-label">Credit Limit:</span>
                  <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>{cur(creditRisk.limit)}</span>
                </div>
                <div className="marg-field">
                  <span className="marg-label">Remaining:</span>
                  <span style={{ flex: 1, textAlign: 'right', fontWeight: 700, color: creditRisk.remaining < 0 ? '#CC0000' : '#006600' }}>{cur(creditRisk.remaining)}</span>
                </div>
                <div className="marg-field">
                  <span className="marg-label">Risk:</span>
                  <span className={`marg-badge ${creditRisk.blocked ? 'marg-badge-red' : creditRisk.exceeded ? 'marg-badge-orange' : 'marg-badge-green'}`}>
                    {creditRisk.blocked ? '\u26D4 BLOCKED' : creditRisk.riskCategory?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Payment ── */}
          <div className="marg-panel" style={{ flex: '0 0 auto' }}>
            <div className="marg-panel-caption"><span>Payment</span></div>
            <div style={{ padding: '4px 6px' }}>
              {/* Mode */}
              <div className="marg-field">
                <span className="marg-label">Mode:</span>
                <div style={{ display: 'flex', gap: '6px', flex: 1, alignItems: 'center' }}>
                  {(['cash', 'card', 'upi'] as PaymentMode[]).map(m => (
                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', textTransform: 'uppercase', userSelect: 'none', fontSize: '8pt' }}>
                      <input type="radio" name="pmode" checked={payMode === m} onChange={() => { setPayMode(m); setCashIn('') }} />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              {payMode === 'cash' && (
                <>
                  {/* Quick cash */}
                  <div className="marg-field">
                    <span className="marg-label">Quick Cash:</span>
                    <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
                      {[100, 200, 500, 1000].map(a => (
                        <button key={a} className="marg-btn" style={{ flex: 1 }} onClick={() => setCashIn(String(a))}>{'\u20B9'}{a}</button>
                      ))}
                      <button className="marg-btn" style={{ flex: 1 }} onClick={() => setCashIn(String(grand))}>Exact</button>
                    </div>
                  </div>
                  {/* Given + Change */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <div className="marg-field" style={{ flex: 1 }}>
                      <span className="marg-label">Given:</span>
                      <input className="marg-input" type="number" value={cashIn} onChange={e => setCashIn(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="marg-field" style={{ flex: 1 }}>
                      <span className="marg-label">Change:</span>
                      <input className="marg-input marg-input-readonly" value={cur(Math.max(0, change))} readOnly style={{
                        background: change >= 0 ? '#F0F0F0' : '#FFE0E0',
                        color: change >= 0 ? '#404040' : '#CC0000',
                      }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Action Buttons ── */}
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button className="marg-btn marg-btn-green" style={{ flex: 1 }} onClick={doSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save & Print (F8)'}
              </button>
              <button className="marg-btn" style={{ flex: 1 }} onClick={doHold}>Hold (F4)</button>
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button className="marg-btn marg-btn-blue" style={{ flex: 1 }} onClick={doNewBill}>New Bill (F10)</button>
              <button className="marg-btn" style={{ flex: 1 }} onClick={doClearAll}>Clear (F9)</button>
            </div>
            <button className="marg-btn marg-btn-red" style={{ width: '100%' }} onClick={doCancel}>Cancel (F12)</button>
          </div>
        </div>
      </div>

      {/* ═══ STATUS BAR ═══ */}
      <div className="marg-statusbar" style={{ marginTop: 'auto' }}>
        <div className="sb-section"><b>F2</b> Search</div>
        <div className="sb-section"><b>F3</b> Customer</div>
        <div className="sb-section"><b>F4</b> Hold</div>
        <div className="sb-section"><b>F5</b> Scheme</div>
        <div className="sb-section"><b>F6</b> Type</div>
        <div className="sb-section"><b>F8</b> Save</div>
        <div className="sb-section"><b>F10</b> New</div>
        <div className="sb-section"><b>F12</b> Cancel</div>
        <div className="sb-section"><b>Ctrl+B</b> Barcode</div>
        <div className="sb-section" style={{ marginLeft: 'auto' }}>
          Items: {totQty} | Total: {cur(grand)} {totalFreeQty > 0 && <span style={{ color: '#FFFF00' }}>| +{totalFreeQty} FREE</span>}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
         DIALOGS
         ═══════════════════════════════════════════════════════ */}

      {/* ── Prescription Required Dialog ── */}
      {rxDialog && (
        <div className="marg-dialog-overlay" onClick={e => { if (e.target === e.currentTarget) cancelRxDialog() }}>
          <div className="marg-dialog" style={{ width: '420px' }}>
            <div className="marg-dialog-titlebar">
              <span>\u26A0 Prescription Required — Schedule Drug</span>
              <button className="marg-btn" style={{ height: '16px', minWidth: '16px', padding: '0 4px', fontSize: '7pt' }}
                onClick={cancelRxDialog}>\u2715</button>
            </div>
            <div className="marg-dialog-body">
              <div style={{ background: '#FFF0D0', border: '1px solid #CC6600', padding: '6px', marginBottom: '8px' }}>
                <p style={{ margin: 0, fontWeight: 700, color: '#CC6600', fontSize: '8pt' }}>
                  \u26A0 This is a Scheduled Drug. Sale requires valid prescription.
                </p>
                <p style={{ margin: '2px 0 0 0', color: '#CC6600', fontSize: '7pt' }}>
                  Please provide doctor name and prescription number below.
                </p>
              </div>
              <div className="marg-field">
                <span className="marg-label">Doctor Name:</span>
                <input className="marg-input" value={rxDialogDoctor} onChange={e => setRxDialogDoctor(e.target.value)}
                  placeholder="Dr. " style={{ background: '#FFFFCC', flex: 1 }} autoFocus />
              </div>
              <div className="marg-field">
                <span className="marg-label">Rx Number:</span>
                <input className="marg-input" value={rxDialogRxNo} onChange={e => setRxDialogRxNo(e.target.value)}
                  placeholder="Prescription No." style={{ background: '#FFFFCC', flex: 1 }} />
              </div>
            </div>
            <div className="marg-dialog-footer">
              <button className="marg-btn marg-btn-red" onClick={cancelRxDialog}>Cancel</button>
              <button className="marg-btn marg-btn-green" onClick={confirmRxDialog}>Confirm & Add</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Prescription Linking Dialog ── */}
      {rxLinkDialog && (
        <div className="marg-dialog-overlay" onClick={e => { if (e.target === e.currentTarget) setRxLinkDialog(false) }}>
          <div className="marg-dialog" style={{ width: '480px' }}>
            <div className="marg-dialog-titlebar">
              <span>Attach Prescription</span>
              <button className="marg-btn" style={{ height: '16px', minWidth: '16px', padding: '0 4px', fontSize: '7pt' }}
                onClick={() => setRxLinkDialog(false)}>\u2715</button>
            </div>
            <div className="marg-dialog-body">
              <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                <div className="marg-field" style={{ flex: 1 }}>
                  <span className="marg-label">Patient Name:</span>
                  <input className="marg-input" value={prescription.patientName}
                    onChange={e => setPrescription(p => ({ ...p, patientName: e.target.value }))} style={{ flex: 1 }} />
                </div>
                <div className="marg-field" style={{ flex: 1 }}>
                  <span className="marg-label">Phone:</span>
                  <input className="marg-input" value={prescription.patientPhone}
                    onChange={e => setPrescription(p => ({ ...p, patientPhone: e.target.value }))} style={{ flex: 1 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                <div className="marg-field" style={{ flex: 1 }}>
                  <span className="marg-label">Age:</span>
                  <input className="marg-input" type="number" value={prescription.patientAge || ''}
                    onChange={e => setPrescription(p => ({ ...p, patientAge: parseInt(e.target.value) || 0 }))} style={{ width: '50px' }} />
                </div>
                <div className="marg-field" style={{ flex: 1 }}>
                  <span className="marg-label">Gender:</span>
                  <select className="marg-input" value={prescription.patientGender}
                    onChange={e => setPrescription(p => ({ ...p, patientGender: e.target.value }))} style={{ flex: 1 }}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                <div className="marg-field" style={{ flex: 1 }}>
                  <span className="marg-label">Doctor Name:</span>
                  <input className="marg-input" value={prescription.doctorName}
                    onChange={e => setPrescription(p => ({ ...p, doctorName: e.target.value }))} style={{ flex: 1 }} />
                </div>
                <div className="marg-field" style={{ flex: 1 }}>
                  <span className="marg-label">Reg. No:</span>
                  <input className="marg-input" value={prescription.doctorRegNo}
                    onChange={e => setPrescription(p => ({ ...p, doctorRegNo: e.target.value }))} style={{ flex: 1 }} />
                </div>
              </div>
              <div className="marg-field">
                <span className="marg-label">Notes:</span>
                <input className="marg-input" value={prescription.notes}
                  onChange={e => setPrescription(p => ({ ...p, notes: e.target.value }))} />
              </div>
              {rxNo && (
                <div style={{ marginTop: '6px', padding: '4px', background: '#E0EEFF', border: '1px solid #80AADD' }}>
                  <span className="marg-badge marg-badge-blue">Rx# {rxNo}</span>
                  <span style={{ marginLeft: '4px', fontSize: '7pt', color: '#003366' }}>Prescription linked to bill</span>
                </div>
              )}
            </div>
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setRxLinkDialog(false)}>Cancel</button>
              <button className="marg-btn marg-btn-green" onClick={() => {
                if (prescription.patientName.trim()) {
                  if (prescription.doctorName) setDoctor(prescription.doctorName)
                  toast.success('Prescription attached to bill')
                  setRxLinkDialog(false)
                } else {
                  toast.error('Patient name is required')
                }
              }}>Attach</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
