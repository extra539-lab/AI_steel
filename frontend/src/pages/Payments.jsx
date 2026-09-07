import React, { useState, useEffect } from 'react'
import {
  listCustomerPayments,
  listSupplierPayments,
  createCustomerPayment,
  createSupplierPayment,
  listCustomers,
  listSuppliers,
  formatPKR,
  formatDateTime,
} from '../services/api'

export default function Payments() {
  const [activeTab, setActiveTab] = useState('customers') // 'customers' | 'suppliers'
  const [customerPayments, setCustomerPayments] = useState([])
  const [supplierPayments, setSupplierPayments] = useState([])
  const [customers, setCustomers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [showCustModal, setShowCustModal] = useState(false)
  const [showSupModal, setShowSupModal] = useState(false)

  // Customer Payment Form
  const [selectedCustId, setSelectedCustId] = useState('')
  const [custAmount, setCustAmount] = useState(0)
  const [custMethod, setCustMethod] = useState('Cash')
  const [custRef, setCustRef] = useState('')
  const [custNotes, setCustNotes] = useState('')

  // Supplier Payment Form
  const [selectedSupId, setSelectedSupId] = useState('')
  const [supAmount, setSupAmount] = useState(0)
  const [supMethod, setSupMethod] = useState('Bank Transfer')
  const [supRef, setSupRef] = useState('')
  const [supNotes, setSupNotes] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const [cpList, spList, cList, sList] = await Promise.all([
        listCustomerPayments(),
        listSupplierPayments(),
        listCustomers({ active_only: true }),
        listSuppliers({ active_only: true }),
      ])
      setCustomerPayments(cpList)
      setSupplierPayments(spList)
      setCustomers(cList)
      setSuppliers(sList)

      if (cList.length > 0 && !selectedCustId) setSelectedCustId(cList[0].id)
      if (sList.length > 0 && !selectedSupId) setSelectedSupId(sList[0].id)
    } catch (err) {
      console.error('Error fetching payments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSaveCustPayment = async (e) => {
    e.preventDefault()
    if (!selectedCustId) return

    try {
      await createCustomerPayment({
        customer_id: Number(selectedCustId),
        amount: Number(custAmount),
        payment_method: custMethod,
        reference: custRef || undefined,
        notes: custNotes || undefined,
      })
      setShowCustModal(false)
      setCustAmount(0)
      setCustRef('')
      setCustNotes('')
      fetchData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error saving payment')
    }
  }

  const handleSaveSupPayment = async (e) => {
    e.preventDefault()
    if (!selectedSupId) return

    try {
      await createSupplierPayment({
        supplier_id: Number(selectedSupId),
        amount: Number(supAmount),
        payment_method: supMethod,
        reference: supRef || undefined,
        notes: supNotes || undefined,
      })
      setShowSupModal(false)
      setSupAmount(0)
      setSupRef('')
      setSupNotes('')
      fetchData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error saving payment')
    }
  }

  const totalCustomerReceived = customerPayments.reduce((sum, p) => sum + p.amount, 0)
  const totalSupplierPaid = supplierPayments.reduce((sum, p) => sum + p.amount, 0)
  const netCashFlow = totalCustomerReceived - totalSupplierPaid

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Payments & Cash Flow</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Record and review cash receipts from customers and disbursements to suppliers
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowCustModal(true)} className="btn btn-success">
            💵 + Receive Customer Money
          </button>
          <button onClick={() => setShowSupModal(true)} className="btn btn-danger">
            💸 + Pay Supplier
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Total Customer Receipts (Inflow)</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#34d399', margin: '4px 0' }}>
            {formatPKR(totalCustomerReceived)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cash & bank receipts collected</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Total Supplier Payments (Outflow)</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f87171', margin: '4px 0' }}>
            {formatPKR(totalSupplierPaid)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Disbursements to factories & mills</div>
        </div>

        <div className="card" style={{ borderLeft: `4px solid ${netCashFlow >= 0 ? '#3b82f6' : '#f59e0b'}` }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Net Cash Position</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: netCashFlow >= 0 ? '#60a5fa' : '#fbbf24', margin: '4px 0' }}>
            {formatPKR(netCashFlow)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Customer Receipts minus Supplier Payments</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="card" style={{ marginBottom: '20px', padding: '12px 18px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('customers')}
            className={`btn ${activeTab === 'customers' ? 'btn-primary' : 'btn-outline'}`}
          >
            📥 Customer Receipts ({customerPayments.length})
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`btn ${activeTab === 'suppliers' ? 'btn-primary' : 'btn-outline'}`}
          >
            📤 Supplier Payments ({supplierPayments.length})
          </button>
        </div>
      </div>

      {/* Tables */}
      <div className="card">
        {activeTab === 'customers' ? (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Voucher #</th>
                  <th>Date & Time</th>
                  <th>Customer</th>
                  <th>Payment Method</th>
                  <th>Reference</th>
                  <th style={{ textAlign: 'right' }}>Amount Received</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>Loading payment records...</td>
                  </tr>
                ) : customerPayments.length > 0 ? (
                  customerPayments.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.payment_number}</strong></td>
                      <td>{formatDateTime(p.payment_date)}</td>
                      <td>
                        <strong>{p.customer_name}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.customer_code}</div>
                      </td>
                      <td>
                        <span className="badge badge-success">{p.payment_method}</span>
                      </td>
                      <td>{p.reference || '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#34d399', fontSize: '15px' }}>
                        {formatPKR(p.amount)}
                      </td>
                      <td>{p.notes || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                      No customer payment receipts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Voucher #</th>
                  <th>Date & Time</th>
                  <th>Supplier</th>
                  <th>Payment Method</th>
                  <th>Reference</th>
                  <th style={{ textAlign: 'right' }}>Amount Paid</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>Loading payment records...</td>
                  </tr>
                ) : supplierPayments.length > 0 ? (
                  supplierPayments.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.payment_number}</strong></td>
                      <td>{formatDateTime(p.payment_date)}</td>
                      <td>
                        <strong>{p.supplier_name}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.supplier_code}</div>
                      </td>
                      <td>
                        <span className="badge badge-steel">{p.payment_method}</span>
                      </td>
                      <td>{p.reference || '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#f87171', fontSize: '15px' }}>
                        {formatPKR(p.amount)}
                      </td>
                      <td>{p.notes || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                      No supplier payments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Payment Modal */}
      {showCustModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Receive Customer Payment</h3>
              <button onClick={() => setShowCustModal(false)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleSaveCustPayment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Customer *</label>
                  <select
                    value={selectedCustId}
                    onChange={(e) => setSelectedCustId(e.target.value)}
                    className="form-control"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.customer_code}) - Due: {formatPKR(c.current_balance)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount Received (Rs.) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={custAmount}
                    onChange={(e) => setCustAmount(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select
                    value={custMethod}
                    onChange={(e) => setCustMethod(e.target.value)}
                    className="form-control"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reference</label>
                  <input
                    type="text"
                    value={custRef}
                    onChange={(e) => setCustRef(e.target.value)}
                    className="form-control"
                    placeholder="e.g. Bank Deposit Slip # 12345"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    value={custNotes}
                    onChange={(e) => setCustNotes(e.target.value)}
                    className="form-control"
                    placeholder="e.g. Cleared pending invoice balance"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCustModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  💵 Save Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Payment Modal */}
      {showSupModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Record Supplier Payment</h3>
              <button onClick={() => setShowSupModal(false)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleSaveSupPayment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Supplier *</label>
                  <select
                    value={selectedSupId}
                    onChange={(e) => setSelectedSupId(e.target.value)}
                    className="form-control"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.supplier_code}) - Payable: {formatPKR(s.current_balance)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount Paid (Rs.) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={supAmount}
                    onChange={(e) => setSupAmount(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select
                    value={supMethod}
                    onChange={(e) => setSupMethod(e.target.value)}
                    className="form-control"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reference</label>
                  <input
                    type="text"
                    value={supRef}
                    onChange={(e) => setSupRef(e.target.value)}
                    className="form-control"
                    placeholder="e.g. Online Transfer ID / Cheque #"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    value={supNotes}
                    onChange={(e) => setSupNotes(e.target.value)}
                    className="form-control"
                    placeholder="e.g. Payment for Steel trailer dispatch"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowSupModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  💸 Save Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
