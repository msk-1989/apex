'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Edit2, Trash2, X, Download,
  RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */
interface Category { id: string; name: string }
interface Manufacturer { id: string; name: string }
interface BatchInfo {
  id: string; batchNo: string; expiryDate: string; costPrice: number;
  mrp: number; sellingPrice: number; wholesalePrice: number; currentStock: number;
}

interface Medicine {
  id: string; name: string; genericName: string | null;
  saltComposition: string | null; categoryId: string | null; manufacturerId: string | null;
  hsnCode: string | null; schedule: string; strength: string | null;
  form: string; unit: string; stripQty: number; gstRate: number;
  minStockLevel: number; maxStockLevel: number; rackNo: string | null;
  isActive: boolean; totalStock: number; totalValue: number;
  isLowStock: boolean;
  category: Category | null; manufacturer: Manufacturer | null; batches: BatchInfo[];
}

interface PaginationInfo {
  page: number; limit: number; total: number; totalPages: number;
}

/* ═══════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════ */
const EMPTY_FORM = {
  name: '', genericName: '', saltComposition: '', categoryId: '', manufacturerId: '',
  hsnCode: '', schedule: 'none', strength: '', form: 'tablet', unit: 'strip',
  stripQty: 1, gstRate: 12, minStockLevel: 10, maxStockLevel: 1000, rackNo: '',
};

const SCHEDULES = ['none', 'H', 'H1', 'X', 'G', 'L'];
const FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'powder'];
const UNITS = ['strip', 'bottle', 'tube', 'vial', 'pack', 'piece'];
const GST_RATES = [0, 5, 12, 18, 28];

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */
function scheduleBadge(schedule: string) {
  if (!schedule || schedule === 'none') return <span style={{ fontSize: '7pt', color: '#808080' }}>--</span>;
  const cls = schedule === 'H' ? 'marg-badge marg-badge-red'
    : (schedule === 'H1' || schedule === 'X') ? 'marg-badge marg-badge-orange'
    : 'marg-badge marg-badge-blue';
  return <span className={cls}>{schedule}</span>;
}

function stockColor(stock: number, minStock: number) {
  if (stock <= 0) return '#CC0000';
  if (stock <= minStock) return '#CC6600';
  return '#006600';
}

function statusBadge(med: Medicine) {
  if (med.totalStock <= 0) return <span className="marg-badge marg-badge-red">OOS</span>;
  if (med.isLowStock) return <span className="marg-badge marg-badge-orange">LOW</span>;
  return <span className="marg-badge marg-badge-green">OK</span>;
}

function formatINR(val: number) {
  return '₹' + val.toLocaleString('en-IN');
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */
export default function MedicinesModule() {
  /* ── Data State ────────────────────────────────────────────────── */
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  /* ── Filter State ──────────────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSchedule, setFilterSchedule] = useState('all');
  const [filterLowStock, setFilterLowStock] = useState(false);

  /* ── Dialog State ──────────────────────────────────────────────── */
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  /* ─── Data Fetching ────────────────────────────────────────────── */
  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pagination.page));
      params.set('limit', String(pagination.limit));
      if (searchQuery) params.set('search', searchQuery);
      if (filterCategory !== 'all') params.set('categoryId', filterCategory);
      if (filterLowStock) params.set('lowStock', 'true');

      const res = await fetch(`/api/medicines?${params}`);
      if (res.ok) {
        const data = await res.json();
        let meds = data.medicines;
        // Client-side schedule filter
        if (filterSchedule !== 'all') {
          meds = meds.filter((m: Medicine) => m.schedule === filterSchedule);
        }
        setMedicines(meds);
        setPagination(data.pagination);
      }
    } catch {
      toast.error('Failed to fetch medicines');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, filterCategory, filterSchedule, filterLowStock]);

  const fetchLookups = useCallback(async () => {
    try {
      const res = await fetch('/api/medicines?limit=100');
      if (res.ok) {
        const data = await res.json();
        const catMap = new Map<string, Category>();
        const mfgMap = new Map<string, Manufacturer>();
        (data.medicines || []).forEach((m: Medicine) => {
          if (m.category) catMap.set(m.category.id, m.category);
          if (m.manufacturer) mfgMap.set(m.manufacturer.id, m.manufacturer);
        });
        setCategories(Array.from(catMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
        setManufacturers(Array.from(mfgMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchMedicines(); }, [fetchMedicines]);
  useEffect(() => { fetchLookups(); }, [fetchLookups]);

  /* ─── Handlers ─────────────────────────────────────────────────── */
  const openAddForm = () => {
    setEditingMedicine(null);
    setFormData(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEditForm = (med: Medicine) => {
    setEditingMedicine(med);
    setFormData({
      name: med.name, genericName: med.genericName || '', saltComposition: med.saltComposition || '',
      categoryId: med.categoryId || '', manufacturerId: med.manufacturerId || '',
      hsnCode: med.hsnCode || '', schedule: med.schedule, strength: med.strength || '',
      form: med.form, unit: med.unit, stripQty: med.stripQty, gstRate: med.gstRate,
      minStockLevel: med.minStockLevel, maxStockLevel: med.maxStockLevel, rackNo: med.rackNo || '',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.categoryId || !formData.manufacturerId) {
      toast.error('Name, Category and Manufacturer are required');
      return;
    }
    setSaving(true);
    try {
      const url = editingMedicine ? `/api/medicines/${editingMedicine.id}` : '/api/medicines';
      const method = editingMedicine ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success(`Medicine ${editingMedicine ? 'updated' : 'created'} successfully`);
        setFormOpen(false);
        fetchMedicines();
        fetchLookups();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to save medicine');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (med: Medicine) => {
    if (!confirm(`Deactivate "${med.name}"?`)) return;
    try {
      const res = await fetch(`/api/medicines/${med.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`"${med.name}" deactivated`);
        setSelectedMedicine(null);
        fetchMedicines();
      } else {
        toast.error('Failed to deactivate');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleExport = () => {
    const headers = ['Name', 'Generic', 'Salt', 'Category', 'Form', 'Strength', 'Mfg', 'Schedule', 'GST%', 'Stock', 'Value'];
    const rows = medicines.map(m => [
      m.name, m.genericName || '', m.saltComposition || '', m.category?.name || '',
      m.form, m.strength || '', m.manufacturer?.name || '', m.schedule || '',
      String(m.gstRate), String(m.totalStock), String(m.totalValue),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'medicines.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const handleFind = () => {
    setPagination(p => ({ ...p, page: 1 }));
    fetchMedicines();
  };

  const goToPage = (p: number) => setPagination(prev => ({ ...prev, page: p }));

  const fromRec = pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const toRec = Math.min(pagination.page * pagination.limit, pagination.total);

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* ── Panel Caption ────────────────────────────────────────── */}
      <div className="marg-panel-caption">
        <span>Medicine Master — List</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="marg-btn marg-btn-blue" onClick={openAddForm}>
            <Plus style={{ width: 12, height: 12 }} /> Add New
          </button>
          <button
            className="marg-btn"
            disabled={!selectedMedicine}
            onClick={() => selectedMedicine && openEditForm(selectedMedicine)}
          >
            <Edit2 style={{ width: 12, height: 12 }} /> Edit
          </button>
          <button
            className="marg-btn marg-btn-red"
            disabled={!selectedMedicine}
            onClick={() => selectedMedicine && handleDelete(selectedMedicine)}
          >
            <Trash2 style={{ width: 12, height: 12 }} /> Delete
          </button>
          <button className="marg-btn" onClick={handleExport}>
            <Download style={{ width: 12, height: 12 }} /> Export
          </button>
          <button className="marg-btn" onClick={() => { fetchMedicines(); toast.success('Refreshed'); }}>
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
              placeholder="Name, generic, salt..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFind()}
            />
          </div>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Category:</span>
            <select
              className="marg-input"
              style={{ width: 130 }}
              value={filterCategory}
              onChange={e => { setFilterCategory(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            >
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Schedule:</span>
            <select
              className="marg-input"
              style={{ width: 90 }}
              value={filterSchedule}
              onChange={e => { setFilterSchedule(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            >
              <option value="all">All</option>
              {SCHEDULES.map(s => <option key={s} value={s}>{s === 'none' ? 'None' : s}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '8pt', cursor: 'pointer', whiteSpace: 'nowrap', paddingLeft: 6 }}>
            <input
              type="checkbox"
              checked={filterLowStock}
              onChange={e => { setFilterLowStock(e.target.checked); setPagination(p => ({ ...p, page: 1 })); }}
              style={{ width: 13, height: 13 }}
            />
            Low Stock
          </label>
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
        ) : medicines.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
            No medicines found
          </div>
        ) : (
          <table className="marg-grid">
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th style={{ minWidth: 150 }}>Name</th>
                <th style={{ minWidth: 130 }}>Salt / Generic</th>
                <th>Category</th>
                <th>Form</th>
                <th>Strength</th>
                <th>Manufacturer</th>
                <th>Sch</th>
                <th>GST%</th>
                <th>Stock</th>
                <th>Status</th>
                <th style={{ width: 24 }}></th>
              </tr>
            </thead>
            <tbody>
              {medicines.map((med, idx) => {
                const rowIdx = fromRec + idx - 1;
                const sc = stockColor(med.totalStock, med.minStockLevel);
                return (
                  <tr
                    key={med.id}
                    className={selectedMedicine?.id === med.id ? 'selected' : ''}
                    onClick={() => setSelectedMedicine(med)}
                    onDoubleClick={() => { setSelectedMedicine(med); setDetailOpen(true); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ textAlign: 'right', color: '#808080', fontSize: '7pt' }}>{rowIdx}</td>
                    <td style={{ fontWeight: 600 }}>{med.name}</td>
                    <td>
                      <div style={{ fontSize: '7pt', lineHeight: 1.3 }}>
                        <div>{med.genericName || '--'}</div>
                        <div style={{ color: '#808080', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }} title={med.saltComposition || ''}>
                          {med.saltComposition || ''}
                        </div>
                      </div>
                    </td>
                    <td>{med.category?.name || '--'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{med.form}</td>
                    <td style={{ fontFamily: 'monospace' }}>{med.strength || '--'}</td>
                    <td>{med.manufacturer?.name || '--'}</td>
                    <td>{scheduleBadge(med.schedule)}</td>
                    <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>{med.gstRate}%</td>
                    <td style={{ fontWeight: 700, color: sc }}>{med.totalStock}</td>
                    <td>{statusBadge(med)}</td>
                    <td style={{ padding: 0, textAlign: 'center' }}>
                      <button
                        style={{
                          border: 'none', background: 'none', cursor: 'pointer',
                          padding: '2px', color: '#336699', fontSize: '7pt', fontWeight: 700,
                        }}
                        onClick={e => { e.stopPropagation(); setSelectedMedicine(med); setDetailOpen(true); }}
                        title="View Details"
                      >
                        →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pager ────────────────────────────────────────────────── */}
      <div className="marg-pager" style={{ marginTop: 0, justifyContent: 'space-between' }}>
        <span>Records {fromRec}–{toRec} of {pagination.total}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className="marg-btn"
            disabled={pagination.page <= 1}
            onClick={() => goToPage(pagination.page - 1)}
          >
            <ChevronLeft style={{ width: 12, height: 12 }} /> Prev
          </button>
          <span>Page {pagination.page} of {pagination.totalPages || 1}</span>
          <button
            className="marg-btn"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => goToPage(pagination.page + 1)}
          >
            Next <ChevronRight style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Add / Edit Dialog
          ═══════════════════════════════════════════════════════════ */}
      {formOpen && (
        <div className="marg-dialog-overlay" onClick={e => e.target === e.currentTarget && setFormOpen(false)}>
          <div className="marg-dialog">
            {/* Title Bar */}
            <div className="marg-dialog-titlebar">
              <span>{editingMedicine ? 'Edit Medicine' : 'Add New Medicine'}</span>
              <button
                onClick={() => setFormOpen(false)}
                style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: 0, fontSize: '8pt' }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Body */}
            <div className="marg-dialog-body" style={{ padding: 8 }}>
              {/* ── Basic Info ────────────────────────────────────── */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 4 }}>
                <legend>Basic Information</legend>
                <div className="marg-field">
                  <span className="marg-label">Name *</span>
                  <input className="marg-input" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Amoxicillin 500mg" />
                </div>
                <div className="marg-field">
                  <span className="marg-label">Generic Name</span>
                  <input className="marg-input" value={formData.genericName} onChange={e => setFormData(f => ({ ...f, genericName: e.target.value }))} placeholder="e.g., Amoxicillin" />
                </div>
                <div className="marg-field">
                  <span className="marg-label">Salt Comp.</span>
                  <input className="marg-input" value={formData.saltComposition} onChange={e => setFormData(f => ({ ...f, saltComposition: e.target.value }))} placeholder="e.g., Amoxicillin Trihydrate 500mg" />
                </div>
              </fieldset>

              {/* ── Classification ────────────────────────────────── */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 4 }}>
                <legend>Classification</legend>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Category *</span>
                    <select className="marg-input" value={formData.categoryId} onChange={e => setFormData(f => ({ ...f, categoryId: e.target.value }))}>
                      <option value="">-- Select --</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Manufacturer *</span>
                    <select className="marg-input" value={formData.manufacturerId} onChange={e => setFormData(f => ({ ...f, manufacturerId: e.target.value }))}>
                      <option value="">-- Select --</option>
                      {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Schedule</span>
                    <select className="marg-input" value={formData.schedule} onChange={e => setFormData(f => ({ ...f, schedule: e.target.value }))}>
                      {SCHEDULES.map(s => <option key={s} value={s}>{s === 'none' ? 'None' : s}</option>)}
                    </select>
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">HSN Code</span>
                    <input className="marg-input" value={formData.hsnCode} onChange={e => setFormData(f => ({ ...f, hsnCode: e.target.value }))} placeholder="e.g., 30041010" />
                  </div>
                </div>
              </fieldset>

              {/* ── Form & Packaging ──────────────────────────────── */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 4 }}>
                <legend>Form &amp; Packaging</legend>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Strength</span>
                    <input className="marg-input" value={formData.strength} onChange={e => setFormData(f => ({ ...f, strength: e.target.value }))} placeholder="e.g., 500mg" />
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Form</span>
                    <select className="marg-input" value={formData.form} onChange={e => setFormData(f => ({ ...f, form: e.target.value }))}>
                      {FORMS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Unit</span>
                    <select className="marg-input" value={formData.unit} onChange={e => setFormData(f => ({ ...f, unit: e.target.value }))}>
                      {UNITS.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Strip Qty</span>
                    <input className="marg-input" type="number" value={formData.stripQty} onChange={e => setFormData(f => ({ ...f, stripQty: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>
              </fieldset>

              {/* ── Stock Settings ────────────────────────────────── */}
              <fieldset className="marg-groupbox">
                <legend>Stock Settings</legend>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">GST Rate</span>
                    <select className="marg-input" value={String(formData.gstRate)} onChange={e => setFormData(f => ({ ...f, gstRate: parseFloat(e.target.value) }))}>
                      {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Rack No.</span>
                    <input className="marg-input" value={formData.rackNo} onChange={e => setFormData(f => ({ ...f, rackNo: e.target.value }))} placeholder="e.g., A1-01" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Min Stock</span>
                    <input className="marg-input" type="number" value={formData.minStockLevel} onChange={e => setFormData(f => ({ ...f, minStockLevel: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Max Stock</span>
                    <input className="marg-input" type="number" value={formData.maxStockLevel} onChange={e => setFormData(f => ({ ...f, maxStockLevel: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>
              </fieldset>
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

      {/* ═══════════════════════════════════════════════════════════
          Detail Dialog
          ═══════════════════════════════════════════════════════════ */}
      {detailOpen && selectedMedicine && (
        <div className="marg-dialog-overlay" onClick={e => e.target === e.currentTarget && setDetailOpen(false)}>
          <div className="marg-dialog" style={{ minWidth: 560 }}>
            {/* Title Bar */}
            <div className="marg-dialog-titlebar">
              <span>Medicine Details — {selectedMedicine.name}</span>
              <button
                onClick={() => setDetailOpen(false)}
                style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: 0, fontSize: '8pt' }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Body */}
            <div className="marg-dialog-body" style={{ padding: 8 }}>
              {/* Summary Bar */}
              <div className="marg-sunken" style={{ padding: '4px 6px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '9pt', color: '#003366' }}>{selectedMedicine.name}</span>
                  <span style={{ fontSize: '7pt', color: '#808080', marginLeft: 8 }}>
                    {selectedMedicine.genericName || ''} {selectedMedicine.strength ? '| ' + selectedMedicine.strength : ''} | {selectedMedicine.form} | {selectedMedicine.category?.name || '--'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {scheduleBadge(selectedMedicine.schedule)}
                  <span style={{ fontWeight: 700, fontSize: '9pt', color: stockColor(selectedMedicine.totalStock, selectedMedicine.minStockLevel) }}>
                    Stock: {selectedMedicine.totalStock}
                  </span>
                </div>
              </div>

              {/* Details */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
                <legend>Details</legend>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Salt Comp.</span>
                    <span style={{ fontSize: '8pt' }}>{selectedMedicine.saltComposition || '--'}</span>
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Manufacturer</span>
                    <span style={{ fontSize: '8pt' }}>{selectedMedicine.manufacturer?.name || '--'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">HSN Code</span>
                    <span style={{ fontSize: '8pt' }}>{selectedMedicine.hsnCode || '--'}</span>
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">GST Rate</span>
                    <span style={{ fontSize: '8pt' }}>{selectedMedicine.gstRate}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Unit / Strip</span>
                    <span style={{ fontSize: '8pt' }}>{selectedMedicine.unit} / {selectedMedicine.stripQty}</span>
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Rack No.</span>
                    <span style={{ fontSize: '8pt' }}>{selectedMedicine.rackNo || '--'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Min / Max</span>
                    <span style={{ fontSize: '8pt' }}>{selectedMedicine.minStockLevel} / {selectedMedicine.maxStockLevel}</span>
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Total Value</span>
                    <span style={{ fontSize: '8pt', fontWeight: 700, color: '#003366' }}>{formatINR(selectedMedicine.totalValue)}</span>
                  </div>
                </div>
              </fieldset>

              {/* Batch Sub-Grid */}
              {selectedMedicine.batches.length > 0 && (
                <fieldset className="marg-groupbox">
                  <legend>Batches ({selectedMedicine.batches.length})</legend>
                  <div style={{ maxHeight: 160, overflow: 'auto' }}>
                    <table className="marg-grid">
                      <thead>
                        <tr>
                          <th>Batch #</th>
                          <th>Expiry</th>
                          <th style={{ textAlign: 'right' }}>Cost</th>
                          <th style={{ textAlign: 'right' }}>MRP</th>
                          <th style={{ textAlign: 'right' }}>Selling</th>
                          <th style={{ textAlign: 'right' }}>Wholesale</th>
                          <th style={{ textAlign: 'right' }}>Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedMedicine.batches.map(b => {
                          const bsc = stockColor(b.currentStock, selectedMedicine.minStockLevel);
                          return (
                            <tr key={b.id}>
                              <td style={{ fontFamily: 'monospace' }}>{b.batchNo}</td>
                              <td>{formatDate(b.expiryDate)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(b.costPrice)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(b.mrp)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(b.sellingPrice)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(b.wholesalePrice)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: bsc }}>{b.currentStock}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </fieldset>
              )}
            </div>

            {/* Footer */}
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => { setDetailOpen(false); openEditForm(selectedMedicine); }}>
                <Edit2 style={{ width: 12, height: 12 }} /> Edit
              </button>
              <button className="marg-btn" onClick={() => setDetailOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
