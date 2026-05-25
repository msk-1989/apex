'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Truck, Search, ChevronLeft, ChevronRight,
  Plus, Eye, X, RefreshCw, Printer, Loader2, CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────
interface MedicineOption {
  id: string
  name: string
  hsnCode?: string
  gstRate: number
  category?: { name: string }
  manufacturer?: { name: string }
}

interface SupplierOption {
  id: string
  name: string
  contactPerson?: string
  phone?: string
  gstNo?: string
}

interface PurchaseItem {
  id: string
  purchaseOrderId: string
  medicineId: string
  medicine?: { name: string; hsnCode?: string; category?: { name: string } }
  batchNo?: string
  expiryDate?: string
  hsnCode?: string
  gstRate: number
  costPrice: number
  mrp: number
  quantity: number
  freeQty: number
  discount: number
  gstAmount: number
  totalAmount: number
  receivedQty: number
}

interface PurchaseOrder {
  id: string
  invoiceNo: string
  supplierId: string
  supplier: { id: string; name: string; contactPerson?: string; phone?: string; gstNo?: string }
  date: string
  dueDate?: string
  subtotal: number
  gstAmount: number
  discount: number
  totalAmount: number
  paidAmount: number
  status: string
  paymentStatus: string
  paymentMode?: string
  notes?: string
  items: PurchaseItem[]
}

interface POFormItem {
  _uid: string
  medicineId: string
  medicineName: string
  batchNo: string
  expiryDate: string
  hsnCode: string
  gstRate: number
  costPrice: number
  mrp: number
  quantity: number
  freeQty: number
  discount: number
}

// ─── Helpers ────────────────────────────────────────────────────────────
function formatINR(value: number): string {
  return '\u20B9' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

let _uid = 0
function uid() { return `i-${Date.now()}-${++_uid}` }

function createEmptyItem(): POFormItem {
  return {
    _uid: uid(), medicineId: '', medicineName: '', batchNo: '', expiryDate: '',
    hsnCode: '', gstRate: 5, costPrice: 0, mrp: 0, quantity: 1, freeQty: 0, discount: 0,
  }
}

// ─── Status Badge ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'marg-badge-orange',
    partial: 'marg-badge-blue',
    received: 'marg-badge-green',
    cancelled: 'marg-badge-red',
  }
  return <span className={`marg-badge ${map[status] || 'marg-badge marg-badge-blue'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'marg-badge-green',
    partial: 'marg-badge-orange',
    unpaid: 'marg-badge-red',
  }
  return <span className={`marg-badge ${map[status] || 'marg-badge marg-badge-blue'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

// ─── Component ──────────────────────────────────────────────────────────
export default function PurchasesModule() {
  // Data
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  // Suppliers & Medicines
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [medicines, setMedicines] = useState<MedicineOption[]>([])
  const [medicineSearch, setMedicineSearch] = useState('')

  // Filters
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  // Create PO Dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [poForm, setPoForm] = useState({
    supplierId: '', dueDate: '', paymentMode: '', notes: '',
    items: [createEmptyItem()],
  })

  // Detail Dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)

  // Status counts
  const [statusCounts, setStatusCounts] = useState({ all: 0, pending: 0, partial: 0, received: 0, cancelled: 0 })

  // ─── Data Fetching ───────────────────────────────────────────────────
  const fetchPurchases = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (searchQuery) params.set('search', searchQuery)
      if (activeTab !== 'all') params.set('status', activeTab)

      const res = await fetch(`/api/purchases?${params}`)
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders || [])
        setTotalPages(data.pagination?.totalPages || 1)
        setTotalItems(data.pagination?.total || 0)

        const map = new Map<string, SupplierOption>()
        for (const o of (data.orders || [])) {
          if (o.supplier && !map.has(o.supplier.id)) map.set(o.supplier.id, o.supplier)
        }
        setSuppliers(prev => {
          const merged = new Map<string, SupplierOption>()
          for (const s of prev) merged.set(s.id, s)
          for (const s of map.values()) merged.set(s.id, s)
          return Array.from(merged.values())
        })
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [page, searchQuery, activeTab])

  const fetchAllStatusCounts = useCallback(async () => {
    try {
      const statuses = ['', 'pending', 'partial', 'received', 'cancelled']
      const keys = ['all', 'pending', 'partial', 'received', 'cancelled'] as const
      const results = await Promise.all(
        statuses.map(s => fetch(`/api/purchases?status=${s}&limit=1`).then(r => r.json()))
      )
      const counts: Record<string, number> = {}
      keys.forEach((k, i) => { counts[k] = results[i].pagination?.total || 0 })
      setStatusCounts(counts)
    } catch { /* ignore */ }
  }, [])

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/purchases?limit=100')
      if (res.ok) {
        const data = await res.json()
        const map = new Map<string, SupplierOption>()
        for (const o of (data.orders || [])) {
          if (o.supplier && !map.has(o.supplier.id)) map.set(o.supplier.id, o.supplier)
        }
        if (map.size > 0) setSuppliers(Array.from(map.values()))
      }
    } catch { /* ignore */ }
  }, [])

  const fetchMedicines = useCallback(async (search = '') => {
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/medicines?${params}`)
      if (res.ok) setMedicines((await res.json()).medicines || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchPurchases(); fetchAllStatusCounts() }, [fetchPurchases, fetchAllStatusCounts])
  useEffect(() => { fetchSuppliers(); fetchMedicines() }, [fetchSuppliers, fetchMedicines])
  useEffect(() => { setPage(1) }, [activeTab, searchQuery])

  // ─── Summary ─────────────────────────────────────────────────────────
  const totalValue = useMemo(() => orders.reduce((s, o) => s + o.totalAmount, 0), [orders])

  // ─── Form Helpers ────────────────────────────────────────────────────
  const formTotals = useMemo(() => {
    let sub = 0, gst = 0
    for (const item of poForm.items) {
      const is = item.costPrice * item.quantity
      const ig = Math.round(is * item.gstRate / 100 * 100) / 100
      sub += is; gst += ig
    }
    return { subtotal: Math.round(sub * 100) / 100, gstAmount: Math.round(gst * 100) / 100, total: Math.round((sub + gst) * 100) / 100 }
  }, [poForm.items])

  const updateItem = (id: string, field: string, value: string | number) => {
    setPoForm(prev => ({
      ...prev,
      items: prev.items.map(it => it._uid === id ? { ...it, [field]: value } : it),
    }))
  }

  const addItem = () => setPoForm(prev => ({ ...prev, items: [...prev.items, createEmptyItem()] }))
  const removeItem = (id: string) => {
    setPoForm(prev => ({ ...prev, items: prev.items.length > 1 ? prev.items.filter(i => i._uid !== id) : prev.items }))
  }

  const selectMedicine = (uid: string, medId: string) => {
    const med = medicines.find(m => m.id === medId)
    if (med) {
      updateItem(uid, 'medicineId', medId)
      updateItem(uid, 'medicineName', med.name)
      updateItem(uid, 'hsnCode', med.hsnCode || '')
      updateItem(uid, 'gstRate', med.gstRate)
      setMedicineSearch('')
    }
  }

  // ─── Create PO ───────────────────────────────────────────────────────
  const handleCreatePO = async () => {
    if (!poForm.supplierId) { return }
    const validItems = poForm.items.filter(i => i.medicineId && i.costPrice > 0 && i.quantity > 0)
    if (validItems.length === 0) { return }

    setSaving(true)
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: poForm.supplierId,
          dueDate: poForm.dueDate || undefined,
          paymentMode: poForm.paymentMode || undefined,
          notes: poForm.notes || undefined,
          items: validItems.map(i => ({
            medicineId: i.medicineId, batchNo: i.batchNo || undefined,
            expiryDate: i.expiryDate || undefined, hsnCode: i.hsnCode || undefined,
            gstRate: i.gstRate, costPrice: i.costPrice, mrp: i.mrp,
            quantity: i.quantity, freeQty: i.freeQty, discount: i.discount,
          })),
        }),
      })
      if (res.ok) {
        setCreateDialogOpen(false)
        setPoForm({ supplierId: '', dueDate: '', paymentMode: '', notes: '', items: [createEmptyItem()] })
        fetchPurchases(); fetchAllStatusCounts(); fetchSuppliers()
        toast.success('Purchase order created successfully')
      }
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="marg-panel flex flex-col h-full">
      {/* Panel Caption */}
      <div className="marg-panel-caption">
        <span>Purchase Orders — List</span>
        <div className="flex items-center gap-1">
          <button className="marg-btn marg-btn-blue" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-3 h-3" /> New PO
          </button>
          <button className="marg-btn" onClick={() => { fetchPurchases(); fetchAllStatusCounts() }}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <button className="marg-btn" onClick={() => window.print()}>
            <Printer className="w-3 h-3" /> Print
          </button>
          <button className="marg-btn marg-btn-red">
            <X className="w-3 h-3" /> Close
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="flex border-b border-[#808080] bg-white">
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{statusCounts.all}</div>
          <div className="marg-kpi-label">Total POs</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value" style={{ color: '#CC6600' }}>{statusCounts.pending}</div>
          <div className="marg-kpi-label">Pending</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value" style={{ color: '#006600' }}>{statusCounts.received}</div>
          <div className="marg-kpi-label">Received</div>
        </div>
        <div className="marg-kpi flex-1">
          <div className="marg-kpi-value">{formatINR(totalValue)}</div>
          <div className="marg-kpi-label">Total Value</div>
        </div>
      </div>

      {/* Tab Filter */}
      <div className="marg-tabstrip">
        {(['all', 'pending', 'partial', 'received', 'cancelled'] as const).map(tab => (
          <button
            key={tab}
            className={`marg-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)} ({statusCounts[tab]})
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 px-1 py-1 border-b border-[#808080] bg-white">
        <div className="relative flex-1" style={{ maxWidth: 260 }}>
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#808080]" />
          <input
            className="marg-input"
            style={{ paddingLeft: 18 }}
            placeholder="Search PO #, supplier..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-auto">
        <table className="marg-grid">
          <thead>
            <tr>
              <th>PO #</th>
              <th>Date</th>
              <th>Supplier</th>
              <th style={{ textAlign: 'center' }}>Items</th>
              <th style={{ textAlign: 'right' }}>Subtotal</th>
              <th style={{ textAlign: 'right' }}>GST</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Payment</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j}>
                      <div className="animate-pulse" style={{ height: 14, background: '#F0F0F0', width: j === 2 ? 120 : 60 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: '#808080' }}>
                  <Truck style={{ width: 24, height: 24, margin: '0 auto 8px', opacity: 0.3 }} />
                  <div>No purchase orders found</div>
                </td>
              </tr>
            ) : orders.map(order => (
              <tr key={order.id} style={order.status === 'cancelled' ? { opacity: 0.5 } : undefined}>
                <td><span style={{ fontFamily: 'monospace', color: '#003366', fontWeight: 700 }}>{order.invoiceNo}</span></td>
                <td>{formatDate(order.date)}</td>
                <td>
                  <div>{order.supplier?.name || '\u2014'}</div>
                  <div style={{ color: '#808080' }}>{order.supplier?.contactPerson || ''}</div>
                </td>
                <td style={{ textAlign: 'center' }}><span className="marg-badge marg-badge-blue">{order.items.length}</span></td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(order.subtotal)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(order.gstAmount)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatINR(order.totalAmount)}</td>
                <td style={{ textAlign: 'center' }}><StatusBadge status={order.status} /></td>
                <td style={{ textAlign: 'center' }}><PaymentBadge status={order.paymentStatus} /></td>
                <td style={{ textAlign: 'center' }}>
                  <button className="marg-btn" style={{ padding: '0 4px', height: 18 }} onClick={() => { setSelectedOrder(order); setDetailOpen(true) }}>
                    <Eye className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      <div className="marg-pager">
        <span style={{ color: '#808080' }}>
          Records: {(page - 1) * limit + 1}\u2013{Math.min(page * limit, totalItems)} of {totalItems}
        </span>
        <div className="flex items-center gap-1" style={{ marginLeft: 'auto' }}>
          <button className="marg-btn" style={{ padding: '0 4px', height: 18 }} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-3 h-3" /> Prev
          </button>
          <span style={{ padding: '0 6px' }}>Page {page} of {totalPages}</span>
          <button className="marg-btn" style={{ padding: '0 4px', height: 18 }} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ─── Create PO Dialog ─────────────────────────────────────────── */}
      {createDialogOpen && (
        <div className="marg-dialog-overlay" onClick={() => setCreateDialogOpen(false)}>
          <div className="marg-dialog" style={{ minWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="marg-dialog-titlebar">
              <span><Plus className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />New Purchase Order</span>
              <button className="marg-btn" style={{ padding: '0 4px', height: 16 }} onClick={() => setCreateDialogOpen(false)}>
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="marg-dialog-body" style={{ padding: 6 }}>
              {/* Order Details */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
                <legend>Order Details</legend>
                <div className="marg-field">
                  <span className="marg-label">Supplier *</span>
                  <select
                    className="marg-input"
                    value={poForm.supplierId}
                    onChange={e => setPoForm(p => ({ ...p, supplierId: e.target.value }))}
                  >
                    <option value="">{suppliers.length === 0 ? 'No suppliers' : 'Select supplier'}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="marg-field flex-1">
                    <span className="marg-label">Due Date</span>
                    <input type="date" className="marg-input" value={poForm.dueDate} onChange={e => setPoForm(p => ({ ...p, dueDate: e.target.value }))} />
                  </div>
                  <div className="marg-field flex-1">
                    <span className="marg-label">Payment</span>
                    <select className="marg-input" value={poForm.paymentMode} onChange={e => setPoForm(p => ({ ...p, paymentMode: e.target.value }))}>
                      <option value="">Select</option>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="upi">UPI</option>
                      <option value="credit">Credit</option>
                    </select>
                  </div>
                </div>
                <div className="marg-field">
                  <span className="marg-label">Notes</span>
                  <input className="marg-input" placeholder="Additional notes..." value={poForm.notes} onChange={e => setPoForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </fieldset>

              {/* Items */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
                <legend>
                  Order Items ({poForm.items.length})
                  <button className="marg-btn marg-btn-blue" style={{ marginLeft: 8, padding: '0 6px', height: 16 }} onClick={addItem}>
                    <Plus className="w-3 h-3" /> Add Row
                  </button>
                </legend>

                <div className="marg-sunken" style={{ overflow: 'auto', maxHeight: 200 }}>
                  <table className="marg-grid">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th style={{ width: 70 }}>Batch #</th>
                        <th style={{ width: 95 }}>Expiry</th>
                        <th style={{ width: 45 }}>GST%</th>
                        <th style={{ width: 65 }}>Cost</th>
                        <th style={{ width: 55 }}>MRP</th>
                        <th style={{ width: 35 }}>Qty</th>
                        <th style={{ width: 35 }}>Free</th>
                        <th style={{ width: 35 }}>Disc%</th>
                        <th style={{ width: 24 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {poForm.items.map((item) => (
                        <tr key={item._uid}>
                          <td>
                            <div style={{ position: 'relative' }}>
                              <input
                                className="marg-input"
                                style={{ width: '100%' }}
                                placeholder="Search medicine..."
                                value={item.medicineName}
                                onChange={e => { updateItem(item._uid, 'medicineName', e.target.value); setMedicineSearch(e.target.value) }}
                              />
                              {medicineSearch === item.medicineName && item.medicineName.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#FFF', border: '1px solid #808080', maxHeight: 128, overflow: 'auto' }}>
                                  {medicines.filter(m => m.name.toLowerCase().includes(medicineSearch.toLowerCase())).slice(0, 8).map(m => (
                                    <button
                                      key={m.id}
                                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '1px 6px', borderBottom: '1px solid #E0E0E0', background: '#FFF' }}
                                      onMouseDown={() => selectMedicine(item._uid, m.id)}
                                    >
                                      {m.name}{m.category ? ` (${m.category.name})` : ''}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td><input className="marg-input" style={{ width: '100%' }} placeholder="B2024" value={item.batchNo} onChange={e => updateItem(item._uid, 'batchNo', e.target.value)} /></td>
                          <td><input type="date" className="marg-input" style={{ width: '100%' }} value={item.expiryDate} onChange={e => updateItem(item._uid, 'expiryDate', e.target.value)} /></td>
                          <td>
                            <select className="marg-input" style={{ width: '100%' }} value={String(item.gstRate)} onChange={e => updateItem(item._uid, 'gstRate', parseFloat(e.target.value))}>
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                          <td><input type="number" className="marg-input" style={{ width: '100%', textAlign: 'right' }} placeholder="0" value={item.costPrice || ''} onChange={e => updateItem(item._uid, 'costPrice', parseFloat(e.target.value) || 0)} /></td>
                          <td><input type="number" className="marg-input" style={{ width: '100%', textAlign: 'right' }} placeholder="0" value={item.mrp || ''} onChange={e => updateItem(item._uid, 'mrp', parseFloat(e.target.value) || 0)} /></td>
                          <td><input type="number" className="marg-input" style={{ width: '100%', textAlign: 'center' }} value={item.quantity} onChange={e => updateItem(item._uid, 'quantity', parseInt(e.target.value) || 1)} /></td>
                          <td><input type="number" className="marg-input" style={{ width: '100%', textAlign: 'center' }} value={item.freeQty || ''} onChange={e => updateItem(item._uid, 'freeQty', parseInt(e.target.value) || 0)} /></td>
                          <td><input type="number" className="marg-input" style={{ width: '100%', textAlign: 'center' }} value={item.discount || ''} onChange={e => updateItem(item._uid, 'discount', parseFloat(e.target.value) || 0)} /></td>
                          <td>
                            <button className="marg-btn marg-btn-red" style={{ padding: '0 3px', height: 16 }} onClick={() => removeItem(item._uid)}>
                              <X className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </fieldset>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <fieldset className="marg-groupbox" style={{ width: 240 }}>
                  <legend>Totals</legend>
                  <div className="marg-field">
                    <span className="marg-label" style={{ width: 80 }}>Subtotal:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, textAlign: 'right', flex: 1 }}>{formatINR(formTotals.subtotal)}</span>
                  </div>
                  <div className="marg-field">
                    <span className="marg-label" style={{ width: 80 }}>GST:</span>
                    <span style={{ fontFamily: 'monospace', textAlign: 'right', flex: 1 }}>{formatINR(formTotals.gstAmount)}</span>
                  </div>
                  <div className="marg-field" style={{ fontWeight: 700, fontSize: '9pt' }}>
                    <span className="marg-label" style={{ width: 80 }}>Total:</span>
                    <span style={{ fontFamily: 'monospace', color: '#003366', textAlign: 'right', flex: 1 }}>{formatINR(formTotals.total)}</span>
                  </div>
                </fieldset>
              </div>
            </div>

            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setCreateDialogOpen(false)}>Cancel</button>
              <button className="marg-btn marg-btn-blue" disabled={saving} onClick={handleCreatePO}>
                {saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : <><CheckCircle2 className="w-3 h-3" /> Save PO</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detail Dialog ────────────────────────────────────────────── */}
      {detailOpen && selectedOrder && (
        <div className="marg-dialog-overlay" onClick={() => setDetailOpen(false)}>
          <div className="marg-dialog" style={{ minWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="marg-dialog-titlebar">
              <span>
                {selectedOrder.invoiceNo} <StatusBadge status={selectedOrder.status} />
              </span>
              <button className="marg-btn" style={{ padding: '0 4px', height: 16 }} onClick={() => setDetailOpen(false)}>
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="marg-dialog-body" style={{ padding: 6 }}>
              <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
                <legend>Order Info</legend>
                <div className="marg-field"><span className="marg-label">Supplier:</span><span style={{ fontWeight: 600 }}>{selectedOrder.supplier?.name}</span></div>
                <div className="marg-field"><span className="marg-label">Date:</span><span>{formatDate(selectedOrder.date)}</span></div>
                {selectedOrder.dueDate && <div className="marg-field"><span className="marg-label">Due Date:</span><span>{formatDate(selectedOrder.dueDate)}</span></div>}
                {selectedOrder.paymentMode && <div className="marg-field"><span className="marg-label">Payment:</span><span>{selectedOrder.paymentMode}</span></div>}
                {selectedOrder.notes && <div className="marg-field"><span className="marg-label">Notes:</span><span>{selectedOrder.notes}</span></div>}
              </fieldset>

              <div className="marg-sunken" style={{ overflow: 'auto', maxHeight: 240 }}>
                <table className="marg-grid">
                  <thead>
                    <tr>
                      <th>#</th><th>Medicine</th><th>Batch</th><th>Expiry</th>
                      <th style={{ textAlign: 'right' }}>Cost</th><th style={{ textAlign: 'right' }}>MRP</th>
                      <th style={{ textAlign: 'center' }}>Qty</th><th style={{ textAlign: 'center' }}>Free</th>
                      <th style={{ textAlign: 'right' }}>GST</th><th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item, i) => (
                      <tr key={item.id}>
                        <td>{i + 1}</td>
                        <td>{item.medicine?.name || '\u2014'}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.batchNo || '\u2014'}</td>
                        <td>{item.expiryDate ? formatDate(item.expiryDate) : '\u2014'}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(item.costPrice)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(item.mrp)}</td>
                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'center' }}>{item.freeQty || 0}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(item.gstAmount)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatINR(item.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'right', fontWeight: 700, background: '#F0F0F0', padding: '2px 5px' }}>Grand Total:</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, background: '#F0F0F0', padding: '2px 5px', fontFamily: 'monospace', color: '#003366', fontSize: '9pt' }}>{formatINR(selectedOrder.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => window.print()}><Printer className="w-3 h-3" /> Print</button>
              <button className="marg-btn" onClick={() => setDetailOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
