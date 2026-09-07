import React, { useState, useEffect } from 'react'
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerLedger,
  createCustomerPayment,
  formatPKR,
  formatDate,
  formatDateTime,
} from '../services/api'

export default function Customers({ preselectedCustomerId = null }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [paymentCustomer, setPaymentCustomer] = useState(null)
  const [ledgerCustomer, setLedgerCustomer] = useState(null)
  const [ledgerData, setLedgerData] = useState(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)

  // Customer Form
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    opening_balance: 0,
  })

  // Payment Form
  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState('Cash')
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const data = await listCustomers({ search: search || undefined })
      setCustomers(data)
    } catch (err) {
      console.error('Error loading customers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [search])

  const handleSaveCustomer = async (e) => {
    e.preventDefault()
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, {
          name: formData.name,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          opening_balance: Number(formData.opening_balance),
        })
      } else {
        await createCustomer({
          name: formData.name,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          opening_balance: Number(formData.opening_balance),
        })
      }
      setShowAddModal(false)
      setEditingCustomer(null)
      fetchCustomers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save customer')
    }
  }

  const handleOpenEdit = (c) => {
    setEditingCustomer(c)
    setFormData({
      name: c.name,
      phone: c.phone || '',
      address: c.address || '',
      opening_balance: c.opening_balance || 0,
    })
    setShowAddModal(true)
  }

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to archive customer "${name}"?`)) {
      try {
        await deleteCustomer(id)
        fetchCustomers()
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to archive customer')
      }
    }
  }

  const handleOpenPayment = (c) => {
    setPaymentCustomer(c)
    setPayAmount(c.current_balance > 0 ? c.current_balance : 0)
    setPayMethod('Cash')
    setPayRef('')
    setPayNotes('')
  }

  const handleSavePayment = async (e) => {
    e.preventDefault()
    if (!paymentCustomer) return

    try {
      await createCustomerPayment({
        customer_id: paymentCustomer.id,
        amount: Number(payAmount),
        payment_method: payMethod,
        reference: payRef || undefined,
        notes: payNotes || undefined,
      })
      setPaymentCustomer(null)
      fetchCustomers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error recording customer payment')
    }
  }

  const handleOpenLedger = async (c) => {
    setLedgerCustomer(c)
    try {
      setLedgerLoading(true)
      const data = await getCustomerLedger(c.id)
      setLedgerData(data)
    } catch (err) {
      console.error('Error fetching customer ledger:', err)
    } finally {
      setLedgerLoading(false)
    }
  }

  const totalReceivables = customers.reduce((sum, c) => sum + (c.current_balance > 0 ? c.current_balance : 0), 0)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Customer Accounts & Ledgers</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Track client accounts, credit balances, payment receipts, and complete running ledgers
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCustomer(null)
            setFormData({ name: '', phone: '', address: '', opening_balance: 0 })
            setShowAddModal(true)
          }}
          className="btn btn-primary"
        >
          + Add New Customer
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Total Customer Receivables</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fbbf24', margin: '4px 0' }}>
            {formatPKR(totalReceivables)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pending payment from credit customers</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Total Registered Customers</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa', margin: '4px 0' }}>
            {customers.length} Customers
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active builders and contractors</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ width: '320px' }}>
            <input
              type="text"
              placeholder="🔍 Search customer name, code, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
            />
          </div>
          <button onClick={fetchCustomers} className="btn btn-outline btn-sm">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Customer Name</th>
                <th>Phone</th>
                <th>Address</th>
                <th style={{ textAlign: 'right' }}>Total Purchases</th>
                <th style={{ textAlign: 'right' }}>Total Paid</th>
                <th style={{ textAlign: 'right' }}>Balance Due</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>Loading customers...</td>
                </tr>
              ) : customers.length > 0 ? (
                customers.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.customer_code}</strong></td>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.phone || '-'}</td>
                    <td>{c.address || '-'}</td>
                    <td style={{ textAlign: 'right' }}>{formatPKR(c.total_sales)}</td>
                    <td style={{ textAlign: 'right', color: '#34d399' }}>{formatPKR(c.total_paid)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: c.current_balance > 0 ? '#fbbf24' : '#34d399' }}>
                      {formatPKR(c.current_balance)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleOpenLedger(c)}
                          className="btn btn-primary btn-sm"
                          title="View Ledger Statement"
                        >
                          📜 Ledger
                        </button>
                        <button
                          onClick={() => handleOpenPayment(c)}
                          className="btn btn-success btn-sm"
                          title="Receive Payment"
                        >
                          💵 Receive
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="btn btn-secondary btn-sm"
                          title="Edit Customer"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="btn btn-danger btn-sm"
                          title="Archive Customer"
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
                    No customers found. Click "+ Add New Customer" to register one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>
                {editingCustomer ? `Edit Customer: ${editingCustomer.customer_code}` : 'Add New Customer'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleSaveCustomer}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer / Contractor Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-control"
                    placeholder="e.g. Muhammad Ali Builder"
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
                  <label className="form-label">Address / Delivery City</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="form-control"
                    placeholder="e.g. F-10, Islamabad"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening Receivable Balance (Rs.)</label>
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
                  {editingCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Customer Payment Modal */}
      {paymentCustomer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>
                Receive Payment from {paymentCustomer.name}
              </h3>
              <button onClick={() => setPaymentCustomer(null)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleSavePayment}>
              <div className="modal-body">
                <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Current Outstanding Due:</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fbbf24' }}>
                    {formatPKR(paymentCustomer.current_balance)}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount Received (Rs.) *</label>
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
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online (JazzCash / EasyPaisa / Nayapay)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reference (Cheque # / Bank Slip)</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="form-control"
                    placeholder="e.g. HBL Slip # 998811"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="form-control"
                    placeholder="e.g. Partial recovery for Cement delivery"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setPaymentCustomer(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  💵 Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Ledger Drawer / Modal */}
      {ledgerCustomer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold' }}>
                  Customer Ledger Statement: {ledgerCustomer.name}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Code: {ledgerCustomer.customer_code} | Phone: {ledgerCustomer.phone || '-'} | {ledgerCustomer.address}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.print()} className="btn btn-outline btn-sm no-print">
                  🖨️ Print Statement
                </button>
                <button onClick={() => setLedgerCustomer(null)} className="btn btn-secondary btn-sm no-print">✕</button>
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
                          <th style={{ textAlign: 'right' }}>Debit (Sale)</th>
                          <th style={{ textAlign: 'right' }}>Credit (Paid)</th>
                          <th style={{ textAlign: 'right' }}>Balance Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.entries.length > 0 ? (
                          ledgerData.entries.map((entry, idx) => (
                            <tr key={idx}>
                              <td>{formatDate(entry.date)}</td>
                              <td>
                                <span className={`badge ${entry.type === 'SALE' ? 'badge-danger' : entry.type === 'PAYMENT' ? 'badge-success' : 'badge-warning'}`}>
                                  {entry.type}
                                </span>
                              </td>
                              <td><strong>{entry.reference}</strong></td>
                              <td>{entry.notes || '-'}</td>
                              <td style={{ textAlign: 'right' }}>
                                {entry.debit > 0 ? formatPKR(entry.debit) : '-'}
                              </td>
                              <td style={{ textAlign: 'right', color: '#34d399' }}>
                                {entry.credit > 0 ? formatPKR(entry.credit) : '-'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', color: entry.balance > 0 ? '#fbbf24' : '#34d399' }}>
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
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Sales / Debits:</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatPKR(ledgerData.total_debit)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Recovered / Paid:</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#34d399' }}>{formatPKR(ledgerData.total_credit)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Final Outstanding Due:</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fbbf24' }}>{formatPKR(ledgerData.final_balance)}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="modal-footer no-print">
              <button onClick={() => setLedgerCustomer(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
