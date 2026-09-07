import React, { useState, useEffect } from 'react'
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierLedger,
  createSupplierPayment,
  formatPKR,
  formatDate,
} from '../services/api'

export default function Suppliers({ onOpenPurchases }) {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [paymentSupplier, setPaymentSupplier] = useState(null)
  const [ledgerSupplier, setLedgerSupplier] = useState(null)
  const [ledgerData, setLedgerData] = useState(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)

  // Supplier Form
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    opening_balance: 0,
  })

  // Payment Form
  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState('Bank Transfer')
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      const data = await listSuppliers({ search: search || undefined })
      setSuppliers(data)
    } catch (err) {
      console.error('Error loading suppliers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuppliers()
  }, [search])

  const handleSaveSupplier = async (e) => {
    e.preventDefault()
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          name: formData.name,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          opening_balance: Number(formData.opening_balance),
        })
      } else {
        await createSupplier({
          name: formData.name,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          opening_balance: Number(formData.opening_balance),
        })
      }
      setShowAddModal(false)
      setEditingSupplier(null)
      fetchSuppliers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save supplier')
    }
  }

  const handleOpenEdit = (s) => {
    setEditingSupplier(s)
    setFormData({
      name: s.name,
      phone: s.phone || '',
      address: s.address || '',
      opening_balance: s.opening_balance || 0,
    })
    setShowAddModal(true)
  }

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to archive supplier "${name}"?`)) {
      try {
        await deleteSupplier(id)
        fetchSuppliers()
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to archive supplier')
      }
    }
  }

  const handleOpenPayment = (s) => {
    setPaymentSupplier(s)
    setPayAmount(s.current_balance > 0 ? s.current_balance : 0)
    setPayMethod('Bank Transfer')
    setPayRef('')
    setPayNotes('')
  }

  const handleSavePayment = async (e) => {
    e.preventDefault()
    if (!paymentSupplier) return

    try {
      await createSupplierPayment({
        supplier_id: paymentSupplier.id,
        amount: Number(payAmount),
        payment_method: payMethod,
        reference: payRef || undefined,
        notes: payNotes || undefined,
      })
      setPaymentSupplier(null)
      fetchSuppliers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error recording supplier payment')
    }
  }

  const handleOpenLedger = async (s) => {
    setLedgerSupplier(s)
    try {
      setLedgerLoading(true)
      const data = await getSupplierLedger(s.id)
      setLedgerData(data)
    } catch (err) {
      console.error('Error fetching supplier ledger:', err)
    } finally {
      setLedgerLoading(false)
    }
  }

  const totalPayables = suppliers.reduce((sum, s) => sum + (s.current_balance > 0 ? s.current_balance : 0), 0)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Suppliers & Vendor Accounts</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Manage cement factories, steel distributors, accounts payable, and supplier ledgers
          </p>
        </div>
        <button
          onClick={() => {
            setEditingSupplier(null)
            setFormData({ name: '', phone: '', address: '', opening_balance: 0 })
            setShowAddModal(true)
          }}
          className="btn btn-primary"
        >
          + Add New Supplier
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Total Accounts Payable</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f87171', margin: '4px 0' }}>
            {formatPKR(totalPayables)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Amount payable to cement & steel suppliers</div>
        </div>

        <div className="card" style={{ borderLeft: '3px solid #3b82f6' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Registered Suppliers</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa', margin: '4px 0' }}>
            {suppliers.length} Suppliers
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Authorized brand distributors</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ width: '320px' }}>
            <input
              type="text"
              placeholder="🔍 Search supplier name, code, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
            />
          </div>
          <button onClick={fetchSuppliers} className="btn btn-outline btn-sm">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="card">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Supplier / Distributor</th>
                <th>Phone</th>
                <th>Address</th>
                <th style={{ textAlign: 'right' }}>Total Purchases</th>
                <th style={{ textAlign: 'right' }}>Total Paid</th>
                <th style={{ textAlign: 'right' }}>Payable Balance</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>Loading suppliers...</td>
                </tr>
              ) : suppliers.length > 0 ? (
                suppliers.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.supplier_code}</strong></td>
                    <td>
                      <strong>{s.name}</strong>
                    </td>
                    <td>{s.phone || '-'}</td>
                    <td>{s.address || '-'}</td>
                    <td style={{ textAlign: 'right' }}>{formatPKR(s.total_purchases)}</td>
                    <td style={{ textAlign: 'right', color: '#34d399' }}>{formatPKR(s.total_paid)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: s.current_balance > 0 ? '#f87171' : '#34d399' }}>
                      {formatPKR(s.current_balance)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleOpenLedger(s)}
                          className="btn btn-primary btn-sm"
                          title="View Ledger Statement"
                        >
                          📜 Ledger
                        </button>
                        
                        <button
                          onClick={() => onOpenPurchases ? onOpenPurchases(s.id) : null}
                          className="btn btn-outline btn-sm"
                          title="View Supplier Purchases"
                        >
                          📦 Supplies
                        </button>
                        <button
                          onClick={() => handleOpenPayment(s)}
                          className="btn btn-danger btn-sm"
                          title="Pay Supplier"
                        >
                          💸 Pay
                        </button>
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="btn btn-secondary btn-sm"
                          title="Edit Supplier"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          className="btn btn-danger btn-sm"
                          title="Archive Supplier"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                    No suppliers found. Click "+ Add New Supplier" to register one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>
                {editingSupplier ? `Edit Supplier: ${editingSupplier.supplier_code}` : 'Add New Supplier'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleSaveSupplier}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Supplier / Agency Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-control"
                    placeholder="e.g. Fauji Cement Distribution Agency"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="form-control"
                    placeholder="0300-1234567"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Address / Plant Location</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="form-control"
                    placeholder="Rawalpindi / Islamabad"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening Payable Balance (Rs.)</label>
                  <input
                    type="number"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                    className="form-control"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSupplier ? 'Update Supplier' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier Modal */}
      {paymentSupplier && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>
                Make Payment to {paymentSupplier.name}
              </h3>
              <button onClick={() => setPaymentSupplier(null)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleSavePayment}>
              <div className="modal-body">
                <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Current Payable Balance:</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f87171' }}>
                    {formatPKR(paymentSupplier.current_balance)}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Amount (Rs.) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="form-control"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reference (Cheque No / Transfer ID)</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="form-control"
                    placeholder="e.g. Cheque # 445566 Meezan Bank"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="form-control"
                    placeholder="e.g. Payment towards Cement trailer batch"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setPaymentSupplier(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  💸 Record Disbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Ledger Drawer / Modal */}
      {ledgerSupplier && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold' }}>
                  Supplier Ledger Statement: {ledgerSupplier.name}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Code: {ledgerSupplier.supplier_code} | Phone: {ledgerSupplier.phone || '-'} | {ledgerSupplier.address}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.print()} className="btn btn-outline btn-sm no-print">
                  🖨️ Print Statement
                </button>
                <button onClick={() => setLedgerSupplier(null)} className="btn btn-secondary btn-sm no-print">✕</button>
              </div>
            </div>

            <div className="modal-body">
              {ledgerLoading ? (
                <div style={{ textAlign: 'center', padding: '32px' }}>Loading ledger statement...</div>
              ) : ledgerData ? (
                <div>
                  <div className="table-container" style={{ marginBottom: '16px' }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Ref #</th>
                          <th>Description</th>
                          <th style={{ textAlign: 'right' }}>Debit (Paid Out)</th>
                          <th style={{ textAlign: 'right' }}>Credit (Purchased)</th>
                          <th style={{ textAlign: 'right' }}>Payable Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.entries.length > 0 ? (
                          ledgerData.entries.map((entry, idx) => (
                            <tr key={idx}>
                              <td>{formatDate(entry.date)}</td>
                              <td>
                                <span className={`badge ${entry.type === 'PURCHASE' ? 'badge-steel' : entry.type === 'PAYMENT' ? 'badge-success' : 'badge-warning'}`}>
                                  {entry.type}
                                </span>
                              </td>
                              <td><strong>{entry.reference}</strong></td>
                              <td>{entry.notes || '-'}</td>
                              <td style={{ textAlign: 'right', color: '#34d399' }}>
                                {entry.debit > 0 ? formatPKR(entry.debit) : '-'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {entry.credit > 0 ? formatPKR(entry.credit) : '-'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', color: entry.balance > 0 ? '#f87171' : '#34d399' }}>
                                {formatPKR(entry.balance)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>No ledger entries found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', backgroundColor: '#151f30', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Purchases / Credit:</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatPKR(ledgerData.total_credit)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Paid to Supplier:</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#34d399' }}>{formatPKR(ledgerData.total_debit)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Final Payable Due:</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f87171' }}>{formatPKR(ledgerData.final_balance)}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="modal-footer no-print">
              <button onClick={() => setLedgerSupplier(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
