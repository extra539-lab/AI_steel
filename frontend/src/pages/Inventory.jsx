import React, { useState, useEffect } from 'react'
import {
  listInventoryTransactions,
  getInventoryReport,
  listProducts,
  adjustStock,
  formatPKR,
  formatDateTime,
} from '../services/api'

export default function Inventory() {
  const [summaryReport, setSummaryReport] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedProductFilter, setSelectedProductFilter] = useState('')
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('')

  // Manual Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustProductId, setAdjustProductId] = useState('')
  const [adjustType, setAdjustType] = useState('IN')
  const [adjustQty, setAdjustQty] = useState(10)
  const [adjustNotes, setAdjustNotes] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const [report, txns, prodList] = await Promise.all([
        getInventoryReport(),
        listInventoryTransactions({
          product_id: selectedProductFilter || undefined,
          transaction_type: selectedTypeFilter || undefined,
          limit: 150,
        }),
        listProducts(),
      ])
      setSummaryReport(report)
      setTransactions(txns)
      setProducts(prodList)
    } catch (err) {
      console.error('Error loading inventory data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedProductFilter, selectedTypeFilter])

  const handleStockAdjustment = async (e) => {
    e.preventDefault()
    if (!adjustProductId) return

    try {
      await adjustStock(adjustProductId, {
        adjustment_type: adjustType,
        quantity: Number(adjustQty),
        notes: adjustNotes || undefined,
      })
      setShowAdjustModal(false)
      setAdjustNotes('')
      setAdjustQty(10)
      fetchData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error adjusting stock')
    }
  }

  const selectedProductObj = products.find((p) => String(p.id) === String(adjustProductId))

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Inventory & Stock Audit Ledger</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Complete audit trail of every stock addition, deduction, sale, and physical adjustment
          </p>
        </div>
        <button
          onClick={() => {
            if (products.length > 0) setAdjustProductId(products[0].id)
            setShowAdjustModal(true)
          }}
          className="btn btn-primary"
        >
          ⚖️ Manual Stock Adjustment
        </button>
      </div>

      {/* Inventory KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="card" style={{ borderLeft: '4px solid #0ea5e9' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Total Cement Stock</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8', margin: '4px 0' }}>
            {Number(summaryReport?.total_cement_bags || 0).toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Bags</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cement bags in stock</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Total Steel Stock</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fbbf24', margin: '4px 0' }}>
            {Number(summaryReport?.total_steel_kg || 0).toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>KG</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Steel weight in stock</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Total Inventory Asset Value</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#34d399', margin: '4px 0' }}>
            {formatPKR(summaryReport?.total_valuation)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Valuation at purchase cost</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Low Stock Items</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f87171', margin: '4px 0' }}>
            {summaryReport?.low_stock_count || 0} Products
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Needs supplier reorder</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>Filter by Product</label>
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="form-control"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.category} - {p.unit})
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '180px' }}>
            <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>Filter by Movement Type</label>
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="form-control"
            >
              <option value="">All Movement Types</option>
              <option value="SALE">SALE (Sold to Customer)</option>
              <option value="PURCHASE">PURCHASE (Received from Supplier)</option>
              <option value="ADJUSTMENT_IN">ADJUSTMENT_IN (Manual Added)</option>
              <option value="ADJUSTMENT_OUT">ADJUSTMENT_OUT (Manual Deducted)</option>
              <option value="INITIAL_STOCK">INITIAL_STOCK (Opening)</option>
            </select>
          </div>

          <button onClick={fetchData} className="btn btn-outline" style={{ alignSelf: 'flex-end', height: '39px' }}>
            🔄 Refresh Ledger
          </button>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="card">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Product</th>
                <th>Category</th>
                <th>Type</th>
                <th>Reference</th>
                <th style={{ textAlign: 'center' }}>Stock Before</th>
                <th style={{ textAlign: 'center' }}>Change</th>
                <th style={{ textAlign: 'center' }}>Stock After</th>
                <th>Notes / Audit Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '24px' }}>Loading inventory audit trail...</td>
                </tr>
              ) : transactions.length > 0 ? (
                transactions.map((t) => {
                  const isNegative = t.quantity < 0
                  return (
                    <tr key={t.id}>
                      <td>{formatDateTime(t.transaction_date)}</td>
                      <td>
                        <strong>{t.product_name}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.product_code}</div>
                      </td>
                      <td>
                        <span className={`badge ${t.category?.toLowerCase() === 'cement' ? 'badge-cement' : t.category?.toLowerCase() === 'steel' ? 'badge-steel' : 'badge-other'}`}>
                          {t.category} ({t.unit})
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${t.transaction_type === 'SALE' ? 'badge-danger' : t.transaction_type === 'PURCHASE' ? 'badge-success' : 'badge-warning'}`}>
                          {t.transaction_type}
                        </span>
                      </td>
                      <td><strong>{t.reference_id || '-'}</strong></td>
                      <td style={{ textAlign: 'center' }}>{t.stock_before} {t.unit}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: isNegative ? '#f87171' : '#34d399' }}>
                        {isNegative ? `${t.quantity}` : `+${t.quantity}`} {t.unit}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{t.stock_after} {t.unit}</td>
                      <td>{t.notes || '-'}</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                    No inventory movements recorded for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Stock Adjustment Modal */}
      {showAdjustModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Manual Stock Adjustment</h3>
              <button onClick={() => setShowAdjustModal(false)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleStockAdjustment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Product *</label>
                  <select
                    value={adjustProductId}
                    onChange={(e) => setAdjustProductId(e.target.value)}
                    className="form-control"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Current: {p.current_stock} {p.unit})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProductObj && (
                  <div style={{ backgroundColor: 'var(--bg-input)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '14px', fontSize: '13px' }}>
                    Current Stock: <strong style={{ color: '#38bdf8' }}>{selectedProductObj.current_stock} {selectedProductObj.unit}</strong>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Adjustment Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setAdjustType('IN')}
                      className={`btn ${adjustType === 'IN' ? 'btn-success' : 'btn-outline'}`}
                    >
                      ➕ Stock In (Add)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustType('OUT')}
                      className={`btn ${adjustType === 'OUT' ? 'btn-danger' : 'btn-outline'}`}
                    >
                      ➖ Stock Out (Deduct)
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Quantity {selectedProductObj && `(${selectedProductObj.unit})`} *
                  </label>
                  <input
                    type="number"
                    required
                    min="0.1"
                    step="any"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Reason / Audit Remark</label>
                  <input
                    type="text"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    className="form-control"
                    placeholder="e.g. Physical inventory count correction"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAdjustModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
