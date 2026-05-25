'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, SlidersHorizontal, RefreshCw, X, Search,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */
interface BatchData {
  id: string;
  batchNo: string;
  expiryDate: string;
  manufacturingDate: string | null;
  costPrice: number;
  mrp: number;
  sellingPrice: number;
  wholesalePrice: number;
  currentStock: number;
  openingStock: number;
  location: string | null;
  daysUntilExpiry: number;
  stockStatus: 'normal' | 'low' | 'critical' | 'out_of_stock';
  expiryStatus: 'safe' | 'expiring_soon' | 'urgent' | 'expired';
  medicine: {
    id: string; name: string; genericName: string | null;
    strength: string | null; form: string; unit: string; stripQty: number;
    minStockLevel: number; maxStockLevel: number; hsnCode: string | null;
    schedule: string;
    category: { id: string; name: string } | null;
    manufacturer: { id: string; name: string } | null;
  };
}

interface InventorySummary {
  totalStockValue: number;
  lowStockCount: number;
  expiringSoonCount: number;
  outOfStockCount: number;
  totalBatches: number;
}

interface PaginationInfo {
  page: number; limit: number; total: number; totalPages: number;
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */
function formatINR(val: number) {
  if (val >= 10000000) return '₹' + (val / 10000000).toFixed(2) + 'Cr';
  if (val >= 100000) return '₹' + (val / 100000).toFixed(2) + 'L';
  if (val >= 1000) return '₹' + (val / 1000).toFixed(1) + 'K';
  return '₹' + val.toLocaleString('en-IN');
}

function formatINRFull(val: number) {
  return '₹' + val.toLocaleString('en-IN');
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function formatFullDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function stockBadge(status: string) {
  switch (status) {
    case 'out_of_stock': return <span className="marg-badge marg-badge-red" style={{ fontWeight: 900 }}>OUT</span>;
    case 'critical': return <span className="marg-badge marg-badge-red">CRITICAL</span>;
    case 'low': return <span className="marg-badge marg-badge-orange">LOW</span>;
    default: return <span className="marg-badge marg-badge-green">OK</span>;
  }
}

function expiryColor(days: number): string {
  if (days <= 0) return '#CC0000';
  if (days <= 30) return '#CC0000';
  if (days <= 90) return '#CC6600';
  return '#006600';
}

function expiryLabel(days: number) {
  if (days <= 0) return 'EXPIRED';
  return days + 'd';
}

function stockColor(stock: number, minStock: number) {
  if (stock <= 0) return '#CC0000';
  if (stock <= minStock) return '#CC6600';
  return '#006600';
}

const ADJUST_REASONS = ['Physical Count', 'Damage', 'Expiry', 'Purchase Addition', 'Return to Supplier'];

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */
export default function InventoryModule() {
  /* ── Data State ────────────────────────────────────────────────── */
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({
    totalStockValue: 0, lowStockCount: 0, expiringSoonCount: 0, outOfStockCount: 0, totalBatches: 0,
  });
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  /* ── Filter State ──────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  /* ── Adjustment Dialog State ───────────────────────────────────── */
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchData | null>(null);
  const [adjustReason, setAdjustReason] = useState('Physical Count');
  const [newStock, setNewStock] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [saving, setSaving] = useState(false);

  /* ─── Data Fetching ────────────────────────────────────────────── */
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pagination.page));
      params.set('limit', String(pagination.limit));
      if (searchQuery) params.set('search', searchQuery);
      if (activeTab === 'lowStock') params.set('lowStock', 'true');
      if (activeTab === 'expiringSoon') params.set('expiringSoon', 'true');
      if (activeTab === 'outOfStock') params.set('outOfStock', 'true');

      const res = await fetch(`/api/inventory?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
        if (data.summary) setSummary(data.summary);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      }
    } catch {
      toast.error('Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, activeTab]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  /* Reset page on tab/search change */
  useEffect(() => {
    setPagination(p => ({ ...p, page: 1 }));
  }, [activeTab, searchQuery]);

  /* ─── Adjustment ───────────────────────────────────────────────── */
  const openAdjust = (batch: BatchData) => {
    setSelectedBatch(batch);
    setNewStock(String(batch.currentStock));
    setAdjustReason('Physical Count');
    setAdjustNotes('');
    setAdjustOpen(true);
  };

  const handleSaveAdjust = async () => {
    if (!selectedBatch || !newStock) return;
    setSaving(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: selectedBatch.id,
          type: adjustReason,
          newStock: parseInt(newStock),
          notes: adjustNotes,
        }),
      });
      if (res.ok) {
        toast.success('Stock adjusted successfully');
        setAdjustOpen(false);
        fetchInventory();
      } else {
        toast.error('Failed to adjust stock');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const goToPage = (p: number) => setPagination(prev => ({ ...prev, page: p }));

  const fromRec = pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const toRec = Math.min(pagination.page * pagination.limit, pagination.total);

  /* Tab definitions */
  const tabs = [
    { key: 'all', label: 'All', count: null },
    { key: 'lowStock', label: 'Low Stock', count: summary.lowStockCount },
    { key: 'expiringSoon', label: 'Expiring', count: summary.expiringSoonCount },
    { key: 'outOfStock', label: 'Out of Stock', count: summary.outOfStockCount },
  ];

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* ── Panel Caption ────────────────────────────────────────── */}
      <div className="marg-panel-caption">
        <span>Stock Management — Batch View</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            className="marg-btn marg-btn-blue"
            disabled={!selectedBatch}
            onClick={() => selectedBatch ? openAdjust(selectedBatch) : toast.info('Select a batch first')}
          >
            <SlidersHorizontal style={{ width: 12, height: 12 }} /> Adjust
          </button>
          <button className="marg-btn" onClick={() => { fetchInventory(); toast.success('Refreshed'); }}>
            <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
          </button>
          <button className="marg-btn" onClick={() => toast.info('Close')}>
            <X style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 2, padding: '2px 0 0 0' }}>
        <div className="marg-kpi" style={{ flex: 1 }}>
          <div className="marg-kpi-value">{formatINR(summary.totalStockValue)}</div>
          <div className="marg-kpi-label">Total Value</div>
        </div>
        <div className="marg-kpi" style={{ flex: 1 }}>
          <div className="marg-kpi-value" style={{ color: '#CC6600' }}>{summary.lowStockCount}</div>
          <div className="marg-kpi-label">Low Stock</div>
        </div>
        <div className="marg-kpi" style={{ flex: 1 }}>
          <div className="marg-kpi-value" style={{ color: '#CC0000' }}>{summary.expiringSoonCount}</div>
          <div className="marg-kpi-label">Expiring Soon</div>
        </div>
        <div className="marg-kpi" style={{ flex: 1 }}>
          <div className="marg-kpi-value" style={{ color: '#CC0000' }}>{summary.outOfStockCount}</div>
          <div className="marg-kpi-label">Out of Stock</div>
        </div>
      </div>

      {/* ── Tab Filter Strip + Search ────────────────────────────── */}
      <div className="marg-tabstrip" style={{ marginTop: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`marg-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="marg-badge marg-badge-red" style={{ marginLeft: 4, fontSize: '6pt' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3, paddingRight: 4 }}>
          <input
            className="marg-input"
            style={{ width: 150, height: 18 }}
            placeholder="Search batches..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button className="marg-btn" onClick={() => { setPagination(p => ({ ...p, page: 1 })); fetchInventory(); }} style={{ padding: '1px 6px', height: 20 }}>
            <Search style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ── Data Grid ────────────────────────────────────────────── */}
      <div className="marg-panel" style={{ flex: 1, overflow: 'auto', margin: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
            Loading...
          </div>
        ) : batches.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
            No inventory records found
          </div>
        ) : (
          <table className="marg-grid">
            <thead>
              <tr>
                <th style={{ minWidth: 140 }}>Medicine</th>
                <th>Batch #</th>
                <th>Mfg Date</th>
                <th>Exp Date</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
                <th style={{ textAlign: 'right' }}>MRP</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Min Stock</th>
                <th>Status</th>
                <th style={{ width: 50 }}>Adjust</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => {
                const ec = expiryColor(batch.daysUntilExpiry);
                const sc = stockColor(batch.currentStock, batch.medicine.minStockLevel);
                return (
                  <tr
                    key={batch.id}
                    className={selectedBatch?.id === batch.id ? 'selected' : ''}
                    onClick={() => setSelectedBatch(batch)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div>
                        <span style={{ fontWeight: 600 }}>{batch.medicine.name}</span>
                      </div>
                      <div style={{ fontSize: '7pt', color: '#808080', textTransform: 'capitalize' }}>
                        {batch.medicine.form} {batch.medicine.strength ? '| ' + batch.medicine.strength : ''} {batch.medicine.category ? '| ' + batch.medicine.category.name : ''}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{batch.batchNo}</td>
                    <td>{batch.manufacturingDate ? formatDate(batch.manufacturingDate) : '--'}</td>
                    <td>
                      <span style={{ color: ec }}>{formatDate(batch.expiryDate)}</span>
                      <span style={{ color: ec, fontFamily: 'monospace', fontSize: '7pt', marginLeft: 3 }}>
                        {expiryLabel(batch.daysUntilExpiry)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINRFull(batch.costPrice)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINRFull(batch.mrp)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: sc }}>{batch.currentStock}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#808080' }}>{batch.medicine.minStockLevel}</td>
                    <td>{stockBadge(batch.stockStatus)}</td>
                    <td style={{ padding: '1px 3px', textAlign: 'center' }}>
                      <button
                        className="marg-btn"
                        style={{ padding: '1px 6px', height: 18, minWidth: 40, fontSize: '7pt' }}
                        onClick={e => { e.stopPropagation(); openAdjust(batch); }}
                        title="Adjust Stock"
                      >
                        <SlidersHorizontal style={{ width: 10, height: 10 }} /> Adj
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
          Stock Adjustment Dialog
          ═══════════════════════════════════════════════════════════ */}
      {adjustOpen && selectedBatch && (
        <div className="marg-dialog-overlay" onClick={e => e.target === e.currentTarget && setAdjustOpen(false)}>
          <div className="marg-dialog">
            {/* Title Bar */}
            <div className="marg-dialog-titlebar">
              <span>Stock Adjustment</span>
              <button
                onClick={() => setAdjustOpen(false)}
                style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: 0, fontSize: '8pt' }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Body */}
            <div className="marg-dialog-body" style={{ padding: 8 }}>
              {/* Batch Info Summary */}
              <div className="marg-sunken" style={{ padding: '4px 6px', marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: '9pt', color: '#003366', marginBottom: 3 }}>
                  {selectedBatch.medicine.name}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: '8pt' }}>
                  <div>
                    <span style={{ color: '#808080' }}>Batch: </span>
                    <span style={{ fontFamily: 'monospace' }}>{selectedBatch.batchNo}</span>
                  </div>
                  <div>
                    <span style={{ color: '#808080' }}>Expiry: </span>
                    <span style={{ color: expiryColor(selectedBatch.daysUntilExpiry) }}>
                      {formatFullDate(selectedBatch.expiryDate)} ({expiryLabel(selectedBatch.daysUntilExpiry)})
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#808080' }}>Current Stock: </span>
                    <span style={{ fontWeight: 700 }}>{selectedBatch.currentStock}</span>
                  </div>
                  <div>
                    <span style={{ color: '#808080' }}>Batch Value: </span>
                    <span style={{ fontWeight: 700, color: '#003366' }}>{formatINRFull(selectedBatch.currentStock * selectedBatch.costPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Adjustment Fields */}
              <fieldset className="marg-groupbox">
                <legend>Adjustment</legend>
                <div className="marg-field">
                  <span className="marg-label">Reason</span>
                  <select
                    className="marg-input"
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                  >
                    {ADJUST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="marg-field">
                  <span className="marg-label">New Qty</span>
                  <input
                    className="marg-input"
                    style={{ fontWeight: 700 }}
                    type="number"
                    value={newStock}
                    onChange={e => setNewStock(e.target.value)}
                  />
                </div>
                {/* Delta indicator */}
                {newStock && parseInt(newStock) !== selectedBatch.currentStock && (
                  <div style={{ paddingLeft: 94, fontSize: '7pt', padding: '2px 0' }}>
                    {parseInt(newStock) > selectedBatch.currentStock ? (
                      <span style={{ color: '#006600', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <TrendingUp style={{ width: 10, height: 10 }} />
                        +{parseInt(newStock) - selectedBatch.currentStock} units increase
                      </span>
                    ) : (
                      <span style={{ color: '#CC0000', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <TrendingDown style={{ width: 10, height: 10 }} />
                        {parseInt(newStock) - selectedBatch.currentStock} units decrease
                      </span>
                    )}
                  </div>
                )}
                <div className="marg-field">
                  <span className="marg-label">Notes</span>
                  <input
                    className="marg-input"
                    placeholder="Reason details..."
                    value={adjustNotes}
                    onChange={e => setAdjustNotes(e.target.value)}
                  />
                </div>
              </fieldset>
            </div>

            {/* Footer */}
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setAdjustOpen(false)}>Cancel</button>
              <button
                className="marg-btn marg-btn-blue"
                onClick={handleSaveAdjust}
                disabled={saving || !newStock || parseInt(newStock) === selectedBatch.currentStock}
              >
                {saving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
