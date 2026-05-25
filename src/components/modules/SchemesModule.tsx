'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import {
  Plus, Search, Edit2, X, RefreshCw, ChevronLeft, ChevronRight,
  ToggleLeft, ToggleRight
} from 'lucide-react'
import { toast } from 'sonner'

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */
interface SchemeRel {
  id: string; name: string;
}

interface Scheme {
  id: string;
  name: string;
  type: string;
  description: string | null;
  supplierId: string | null;
  buyQty: number | null;
  getQty: number | null;
  flatDiscount: number | null;
  minQty: number | null;
  maxQty: number | null;
  qtyDiscountPct: number | null;
  validFrom: string | null;
  validTo: string | null;
  scope: string;
  categoryId: string | null;
  manufacturerId: string | null;
  medicineId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  supplier: SchemeRel | null;
  category: SchemeRel | null;
  manufacturer: SchemeRel | null;
  medicine: SchemeRel | null;
}

interface PaginationInfo {
  page: number; limit: number; total: number; totalPages: number;
}

/* ═══════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════ */
const SCHEME_TYPES = [
  { value: 'buy_x_get_y', label: 'Buy X Get Y' },
  { value: 'flat_discount', label: 'Flat Discount' },
  { value: 'quantity_discount', label: 'Quantity Discount' },
  { value: 'batch_specific', label: 'Batch Specific' },
]

const SCOPE_OPTIONS = [
  { value: 'all', label: 'All Medicines' },
  { value: 'category', label: 'Category' },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'specific', label: 'Specific Medicine' },
]

const EMPTY_FORM = {
  name: '',
  type: 'buy_x_get_y',
  description: '',
  supplierId: '',
  buyQty: 0,
  getQty: 0,
  flatDiscount: 0,
  minQty: 0,
  maxQty: 0,
  qtyDiscountPct: 0,
  validFrom: '',
  validTo: '',
  scope: 'all',
  categoryId: '',
  manufacturerId: '',
  medicineId: '',
  isActive: true,
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */
function typeBadge(type: string) {
  const map: Record<string, { cls: string; label: string }> = {
    buy_x_get_y: { cls: 'marg-badge marg-badge-blue', label: 'Buy X Get Y' },
    flat_discount: { cls: 'marg-badge marg-badge-green', label: 'Flat Disc.' },
    quantity_discount: { cls: 'marg-badge marg-badge-orange', label: 'Qty Disc.' },
    batch_specific: { cls: 'marg-badge marg-badge-red', label: 'Batch Spec.' },
  }
  const info = map[type] || { cls: 'marg-badge', label: type }
  return <span className={info.cls}>{info.label}</span>
}

function statusBadge(isActive: boolean) {
  return isActive
    ? <span className="marg-badge marg-badge-green">Active</span>
    : <span className="marg-badge marg-badge-red">Inactive</span>
}

function validityBadge(validFrom: string | null, validTo: string | null) {
  if (!validFrom && !validTo) return <span style={{ fontSize: '7pt', color: '#808080' }}>--</span>
  const now = new Date()
  if (validTo && new Date(validTo) < now) {
    return <span className="marg-badge marg-badge-red">Expired</span>
  }
  if (validFrom && new Date(validFrom) > now) {
    return <span className="marg-badge marg-badge-orange">Upcoming</span>
  }
  return <span className="marg-badge marg-badge-green">Valid</span>
}

function formatDateSafe(d: string | null) {
  if (!d) return '--'
  try { return format(new Date(d), 'dd-MMM-yyyy') } catch { return '--' }
}

function scopeLabel(scope: string, rel: SchemeRel | null) {
  const scopeMap: Record<string, string> = {
    all: 'All Medicines',
    category: rel ? `Cat: ${rel.name}` : 'Category',
    manufacturer: rel ? `Mfg: ${rel.name}` : 'Manufacturer',
    specific: rel ? rel.name : 'Specific',
  }
  return scopeMap[scope] || scope
}

function schemeSummary(s: Scheme): string {
  switch (s.type) {
    case 'buy_x_get_y':
      return `Buy ${s.buyQty || '?'} Get ${s.getQty || '?'}`
    case 'flat_discount':
      return `${s.flatDiscount || 0}% Off`
    case 'quantity_discount':
      return `${s.minQty || 0}-${s.maxQty || '∞'} pcs @ ${s.qtyDiscountPct || 0}%`
    default:
      return ''
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */
export default function SchemesModule() {
  /* ── Data State ────────────────────────────────────────────────── */
  const [schemes, setSchemes] = useState<Scheme[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  /* ── Lookup data ─────────────────────────────────────────────── */
  const [categories, setCategories] = useState<SchemeRel[]>([])
  const [manufacturers, setManufacturers] = useState<SchemeRel[]>([])
  const [medicines, setMedicines] = useState<SchemeRel[]>([])
  const [suppliers, setSuppliers] = useState<SchemeRel[]>([])

  /* ── Filter State ──────────────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  /* ── Dialog State ──────────────────────────────────────────────── */
  const [formOpen, setFormOpen] = useState(false)
  const [editingScheme, setEditingScheme] = useState<Scheme | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  /* ─── Data Fetching ────────────────────────────────────────────── */
  const fetchSchemes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(pagination.page))
      params.set('limit', String(pagination.limit))
      if (searchQuery) params.set('search', searchQuery)
      if (filterType !== 'all') params.set('type', filterType)
      if (filterStatus !== 'all') params.set('status', filterStatus)

      const res = await fetch(`/api/schemes?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSchemes(data.schemes)
        setPagination(data.pagination)
      }
    } catch {
      toast.error('Failed to fetch schemes')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, searchQuery, filterType, filterStatus])

  const fetchLookups = useCallback(async () => {
    try {
      // Fetch categories from medicines API (embedded in data)
      const [medRes, supRes] = await Promise.all([
        fetch('/api/medicines?limit=100'),
        fetch('/api/purchases?limit=50'),
      ])
      if (medRes.ok) {
        const medData = await medRes.json()
        const catMap = new Map<string, SchemeRel>()
        const mfgMap = new Map<string, SchemeRel>()
        const medMap = new Map<string, SchemeRel>()
        ;(medData.medicines || []).forEach((m: { category: SchemeRel | null; manufacturer: SchemeRel | null; id: string; name: string }) => {
          if (m.category) catMap.set(m.category.id, m.category)
          if (m.manufacturer) mfgMap.set(m.manufacturer.id, m.manufacturer)
          medMap.set(m.id, { id: m.id, name: m.name })
        })
        setCategories(Array.from(catMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
        setManufacturers(Array.from(mfgMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
        setMedicines(Array.from(medMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
      }
      if (supRes.ok) {
        const supData = await supRes.json()
        const supMap = new Map<string, SchemeRel>()
        ;(supData.orders || []).forEach((po: { supplier: { id: string; name: string } | null }) => {
          if (po.supplier) supMap.set(po.supplier.id, po.supplier)
        })
        setSuppliers(Array.from(supMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchSchemes() }, [fetchSchemes])
  useEffect(() => { fetchLookups() }, [fetchLookups])

  /* ─── Handlers ─────────────────────────────────────────────────── */
  const openAddForm = () => {
    setEditingScheme(null)
    setFormData(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEditForm = (scheme: Scheme) => {
    setEditingScheme(scheme)
    setFormData({
      name: scheme.name,
      type: scheme.type,
      description: scheme.description || '',
      supplierId: scheme.supplierId || '',
      buyQty: scheme.buyQty || 0,
      getQty: scheme.getQty || 0,
      flatDiscount: scheme.flatDiscount || 0,
      minQty: scheme.minQty || 0,
      maxQty: scheme.maxQty || 0,
      qtyDiscountPct: scheme.qtyDiscountPct || 0,
      validFrom: scheme.validFrom ? scheme.validFrom.split('T')[0] : '',
      validTo: scheme.validTo ? scheme.validTo.split('T')[0] : '',
      scope: scheme.scope || 'all',
      categoryId: scheme.categoryId || '',
      manufacturerId: scheme.manufacturerId || '',
      medicineId: scheme.medicineId || '',
      isActive: scheme.isActive,
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Scheme name is required')
      return
    }
    setSaving(true)
    try {
      const url = editingScheme ? `/api/schemes/${editingScheme.id}` : '/api/schemes'
      const method = editingScheme ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        toast.success(`Scheme ${editingScheme ? 'updated' : 'created'} successfully`)
        setFormOpen(false)
        fetchSchemes()
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to save scheme')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (scheme: Scheme) => {
    try {
      const res = await fetch(`/api/schemes/${scheme.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !scheme.isActive }),
      })
      if (res.ok) {
        toast.success(`Scheme ${scheme.isActive ? 'deactivated' : 'activated'}`)
        fetchSchemes()
      } else {
        toast.error('Failed to toggle scheme')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleFind = () => {
    setPagination(p => ({ ...p, page: 1 }))
  }

  const goToPage = (p: number) => setPagination(prev => ({ ...prev, page: p }))

  const fromRec = pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0
  const toRec = Math.min(pagination.page * pagination.limit, pagination.total)

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* ── Panel Caption ────────────────────────────────────────── */}
      <div className="marg-panel-caption">
        <span>Scheme Management — List</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="marg-btn marg-btn-blue" onClick={openAddForm}>
            <Plus style={{ width: 12, height: 12 }} /> Add New
          </button>
          <button className="marg-btn" onClick={() => { fetchSchemes(); toast.success('Refreshed') }}>
            <RefreshCw style={{ width: 12, height: 12 }} />
          </button>
          <button className="marg-btn" onClick={() => toast.info('Close')}>
            <X style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ── Filter GroupBox ──────────────────────────────────────── */}
      <div className="marg-groupbox" style={{ margin: '2px 0 0 0', padding: '4px 6px' }}>
        <legend>Filter</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Search:</span>
            <input
              className="marg-input"
              style={{ width: 160 }}
              placeholder="Scheme name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFind()}
            />
          </div>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Type:</span>
            <select
              className="marg-input"
              style={{ width: 130 }}
              value={filterType}
              onChange={e => { setFilterType(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
            >
              <option value="all">All Types</option>
              {SCHEME_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Status:</span>
            <select
              className="marg-input"
              style={{ width: 90 }}
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button className="marg-btn marg-btn-blue" onClick={handleFind} style={{ marginLeft: 'auto' }}>
            <Search style={{ width: 12, height: 12 }} /> Find
          </button>
        </div>
      </div>

      {/* ── Data Grid ────────────────────────────────────────────── */}
      <div className="marg-panel" style={{ flex: 1, overflow: 'auto', margin: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
            Loading...
          </div>
        ) : schemes.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
            No schemes found
          </div>
        ) : (
          <table className="marg-grid">
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th style={{ minWidth: 150 }}>Scheme Name</th>
                <th>Type</th>
                <th style={{ textAlign: 'center' }}>Summary</th>
                <th>Scope</th>
                <th>Supplier</th>
                <th>Valid From</th>
                <th>Valid To</th>
                <th style={{ textAlign: 'center' }}>Validity</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ width: 50, textAlign: 'center' }}>Toggle</th>
                <th style={{ width: 24 }}></th>
              </tr>
            </thead>
            <tbody>
              {schemes.map((scheme, idx) => {
                const rowIdx = fromRec + idx - 1
                return (
                  <tr
                    key={scheme.id}
                    onDoubleClick={() => openEditForm(scheme)}
                    style={{ cursor: 'pointer', opacity: scheme.isActive ? 1 : 0.6 }}
                  >
                    <td style={{ textAlign: 'right', color: '#808080', fontSize: '7pt' }}>{rowIdx}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{scheme.name}</div>
                      {scheme.description && (
                        <div style={{ fontSize: '7pt', color: '#808080', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }} title={scheme.description}>
                          {scheme.description}
                        </div>
                      )}
                    </td>
                    <td>{typeBadge(scheme.type)}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '7pt', fontWeight: 600, color: '#003366' }}>
                      {schemeSummary(scheme)}
                    </td>
                    <td style={{ fontSize: '7pt' }}>
                      {scopeLabel(scheme.scope, scheme.category || scheme.manufacturer || scheme.medicine)}
                    </td>
                    <td style={{ fontSize: '8pt' }}>{scheme.supplier?.name || '--'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '7pt' }}>{formatDateSafe(scheme.validFrom)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '7pt' }}>{formatDateSafe(scheme.validTo)}</td>
                    <td style={{ textAlign: 'center' }}>{validityBadge(scheme.validFrom, scheme.validTo)}</td>
                    <td style={{ textAlign: 'center' }}>{statusBadge(scheme.isActive)}</td>
                    <td style={{ textAlign: 'center', padding: '0 2px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleActive(scheme) }}
                        style={{
                          border: 'none', background: 'none', cursor: 'pointer',
                          padding: 0, display: 'flex', alignItems: 'center',
                        }}
                        title={scheme.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {scheme.isActive
                          ? <ToggleRight style={{ width: 16, height: 16, color: '#006600' }} />
                          : <ToggleLeft style={{ width: 16, height: 16, color: '#CC0000' }} />
                        }
                      </button>
                    </td>
                    <td style={{ padding: 0, textAlign: 'center' }}>
                      <button
                        style={{
                          border: 'none', background: 'none', cursor: 'pointer',
                          padding: '2px', color: '#336699', fontSize: '7pt', fontWeight: 700,
                        }}
                        onClick={e => { e.stopPropagation(); openEditForm(scheme) }}
                        title="Edit"
                      >
                        <Edit2 style={{ width: 11, height: 11 }} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pager ────────────────────────────────────────────────── */}
      <div className="marg-pager" style={{ marginTop: 0, justifyContent: 'space-between' }}>
        <span>Records {fromRec}–{toRec} of {pagination.total}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button className="marg-btn" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)}>
            <ChevronLeft style={{ width: 12, height: 12 }} /> Prev
          </button>
          <span>Page {pagination.page} of {pagination.totalPages || 1}</span>
          <button className="marg-btn" disabled={pagination.page >= pagination.totalPages} onClick={() => goToPage(pagination.page + 1)}>
            Next <ChevronRight style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Add / Edit Scheme Dialog
          ═══════════════════════════════════════════════════════════ */}
      {formOpen && (
        <div className="marg-dialog-overlay" onClick={e => e.target === e.currentTarget && setFormOpen(false)}>
          <div className="marg-dialog" style={{ minWidth: 560 }}>
            {/* Title Bar */}
            <div className="marg-dialog-titlebar">
              <span>{editingScheme ? 'Edit Scheme' : 'Add New Scheme'}</span>
              <button onClick={() => setFormOpen(false)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: 0 }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Body */}
            <div className="marg-dialog-body" style={{ padding: 8 }}>
              {/* ── Basic Info ────────────────────────────────────── */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 4 }}>
                <legend>Basic Information</legend>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Name *</span>
                    <input className="marg-input" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Buy 10 Get 1 Free" />
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Type *</span>
                    <select className="marg-input" value={formData.type} onChange={e => setFormData(f => ({ ...f, type: e.target.value }))}>
                      {SCHEME_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="marg-field">
                  <span className="marg-label">Description</span>
                  <input className="marg-input" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="Scheme description..." />
                </div>
              </fieldset>

              {/* ── Type-Specific Fields ──────────────────────────── */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 4 }}>
                <legend>Scheme Parameters</legend>
                {formData.type === 'buy_x_get_y' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div className="marg-field" style={{ flex: 1 }}>
                      <span className="marg-label">Buy Qty *</span>
                      <input className="marg-input" type="number" min={1} value={formData.buyQty} onChange={e => setFormData(f => ({ ...f, buyQty: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="marg-field" style={{ flex: 1 }}>
                      <span className="marg-label">Get Qty *</span>
                      <input className="marg-input" type="number" min={1} value={formData.getQty} onChange={e => setFormData(f => ({ ...f, getQty: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>
                )}
                {formData.type === 'flat_discount' && (
                  <div className="marg-field">
                    <span className="marg-label">Discount % *</span>
                    <input className="marg-input" type="number" min={0} max={100} step={0.5} value={formData.flatDiscount} onChange={e => setFormData(f => ({ ...f, flatDiscount: parseFloat(e.target.value) || 0 }))} style={{ width: 100 }} />
                    <span style={{ fontSize: '7pt', color: '#808080', marginLeft: 4 }}>% off on MRP</span>
                  </div>
                )}
                {formData.type === 'quantity_discount' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div className="marg-field" style={{ flex: 1 }}>
                      <span className="marg-label">Min Qty *</span>
                      <input className="marg-input" type="number" min={1} value={formData.minQty} onChange={e => setFormData(f => ({ ...f, minQty: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="marg-field" style={{ flex: 1 }}>
                      <span className="marg-label">Max Qty</span>
                      <input className="marg-input" type="number" min={1} value={formData.maxQty} onChange={e => setFormData(f => ({ ...f, maxQty: parseInt(e.target.value) || 0 }))} placeholder="0 = no limit" />
                    </div>
                    <div className="marg-field" style={{ flex: 1 }}>
                      <span className="marg-label">Discount % *</span>
                      <input className="marg-input" type="number" min={0} max={100} step={0.5} value={formData.qtyDiscountPct} onChange={e => setFormData(f => ({ ...f, qtyDiscountPct: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  </div>
                )}
                {formData.type === 'batch_specific' && (
                  <div className="marg-field">
                    <span className="marg-label" style={{ width: 200 }}>Applies to specific batch</span>
                    <span style={{ fontSize: '7pt', color: '#808080' }}>Select a specific medicine in Scope below. The scheme will apply to all active batches.</span>
                  </div>
                )}
              </fieldset>

              {/* ── Scope & Applicability ──────────────────────────── */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 4 }}>
                <legend>Scope &amp; Applicability</legend>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Scope</span>
                    <select className="marg-input" value={formData.scope} onChange={e => setFormData(f => ({ ...f, scope: e.target.value }))}>
                      {SCOPE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  {formData.scope === 'category' && (
                    <div className="marg-field" style={{ flex: 1 }}>
                      <span className="marg-label">Category *</span>
                      <select className="marg-input" value={formData.categoryId} onChange={e => setFormData(f => ({ ...f, categoryId: e.target.value }))}>
                        <option value="">-- Select --</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                  {formData.scope === 'manufacturer' && (
                    <div className="marg-field" style={{ flex: 1 }}>
                      <span className="marg-label">Manufacturer *</span>
                      <select className="marg-input" value={formData.manufacturerId} onChange={e => setFormData(f => ({ ...f, manufacturerId: e.target.value }))}>
                        <option value="">-- Select --</option>
                        {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  )}
                  {formData.scope === 'specific' && (
                    <div className="marg-field" style={{ flex: 1 }}>
                      <span className="marg-label">Medicine *</span>
                      <select className="marg-input" value={formData.medicineId} onChange={e => setFormData(f => ({ ...f, medicineId: e.target.value }))}>
                        <option value="">-- Select --</option>
                        {medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="marg-field" style={{ marginTop: 2 }}>
                  <span className="marg-label">Supplier</span>
                  <select className="marg-input" value={formData.supplierId} onChange={e => setFormData(f => ({ ...f, supplierId: e.target.value }))}>
                    <option value="">-- Optional --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </fieldset>

              {/* ── Validity ───────────────────────────────────────── */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 4 }}>
                <legend>Validity Period</legend>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Valid From</span>
                    <input className="marg-input" type="date" value={formData.validFrom} onChange={e => setFormData(f => ({ ...f, validFrom: e.target.value }))} />
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Valid To</span>
                    <input className="marg-input" type="date" value={formData.validTo} onChange={e => setFormData(f => ({ ...f, validTo: e.target.value }))} />
                  </div>
                </div>
              </fieldset>

              {/* ── Active ─────────────────────────────────────────── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '8pt', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={e => setFormData(f => ({ ...f, isActive: e.target.checked }))}
                    style={{ width: 13, height: 13 }}
                  />
                  <span style={{ fontWeight: 600 }}>Active</span>
                </label>
                <span style={{ fontSize: '7pt', color: '#808080' }}>
                  {formData.isActive ? 'Scheme will be available for use' : 'Scheme will be disabled'}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setFormOpen(false)}>Cancel</button>
              <button className="marg-btn marg-btn-blue" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
