import React, { useState, useEffect } from 'react'
import {
  listPurchases,
  createPurchase,
  listSuppliers,
  createSupplier,
  listProducts,
  formatPKR,
  formatDateTime,
} from '../services/api'

export default function Purchases({ preselectedSupplierId = null }) {
  const [activeTab, setActiveTab] = useState('new_purchase') // 'new_purchase' | 'history'
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [purchaseHistory, setPurchaseHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [historySupplierFilter, setHistorySupplierFilter] = useState('')
  const [historyStartDate, setHistoryStartDate] = useState('')
  const [historyEndDate, setHistoryEndDate] = useState('')

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState(preselectedSupplierId || '')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [itemQuantity, setItemQuantity] = useState(10)
  const [itemPrice, setItemPrice] = useState(0)
  const [billItems, setBillItems] = useState([])
  const [discount, setDiscount] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('Credit')
  const [notes, setNotes] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Quick Supplier Modal
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [newSupName, setNewSupName] = useState('')
  const [newSupPhone, setNewSupPhone] = useState('')
  const [newSupAddr, setNewSupAddr] = useState('')
  const [newSupOpBal, setNewSupOpBal] = useState(0)

  // View Bill Modal
  const [viewingPurchase, setViewingPurchase] = useState(null)

  const loadDependencies = async () => {
    try {
      const [supData, prodData] = await Promise.all([
        listSuppliers({ active_only: true }),
        listProducts({ active_only: true }),
      ])
      setSuppliers(supData)
      setProducts(prodData)
      if (!selectedSupplierId && supData.length > 0) {
        setSelectedSupplierId(supData[0].id)
      }
    } catch (err) {
      console.error('Error loading purchase dependencies:', err)
    }
  }

  const loadHistory = async () => {
    try {
      setHistoryLoading(true)
      const params = {
        search: historySearch || undefined,
        supplier_id: historySupplierFilter || undefined,
        start_date: historyStartDate || undefined,
        end_date: historyEndDate || undefined,
        limit: 200,
      }
      const data = await listPurchases(params)
      setPurchaseHistory(data)
    } catch (err) {
      console.error('Error loading purchase history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadDependencies()
  }, [])

  useEffect(() => {
    if (preselectedSupplierId) setSelectedSupplierId(preselectedSupplierId)
  }, [preselectedSupplierId])

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory()
    }
  }, [activeTab, historySearch])

  const handleProductSelect = (productId) => {
    setSelectedProduct(productId)
    const prod = products.find((p) => String(p.id) === String(productId))
    if (prod) {
      setItemPrice(prod.purchase_price || 0)
    }
  }

  const handleAddItem = (e) => {
    e.preventDefault()
    setErrorMessage('')

    if (!selectedProduct) {
      setErrorMessage('Please select a product.')
      return
    }

    const prod = products.find((p) => String(p.id) === String(selectedProduct))
    if (!prod) return

    const qty = Number(itemQuantity)
    const rate = Number(itemPrice)

    if (qty <= 0) {
      setErrorMessage('Quantity must be greater than 0.')
      return
    }

    const existingIndex = billItems.findIndex((i) => i.product_id === prod.id)
    if (existingIndex >= 0) {
      const updated = [...billItems]
      updated[existingIndex].quantity += qty
      updated[existingIndex].unit_price = rate
      updated[existingIndex].total = updated[existingIndex].quantity * rate
      setBillItems(updated)
    } else {
      setBillItems([
        ...billItems,
        {
          product_id: prod.id,
          product_name: prod.name,
          product_code: prod.product_code,
          category: prod.category,
          unit: prod.unit,
          quantity: qty,
          unit_price: rate,
          total: qty * rate,
        },
      ])
    }

    setSelectedProduct('')
    setItemQuantity(10)
    setItemPrice(0)
  }

  const handleRemoveItem = (index) => {
    const updated = billItems.filter((_, i) => i !== index)
    setBillItems(updated)
  }

  // Calculations
  const subtotal = billItems.reduce((sum, item) => sum + item.total, 0)
  const totalAmount = Math.max(0, subtotal - Number(discount || 0))
  const remainingAmount = totalAmount - Number(paidAmount || 0)

  const selectedSupplierObj = suppliers.find((s) => String(s.id) === String(selectedSupplierId))
  const currentSupplierBalance = selectedSupplierObj ? selectedSupplierObj.current_balance : 0
  const projectedNewSupplierBalance = currentSupplierBalance + remainingAmount

  const handleSavePurchase = async () => {
    setErrorMessage('')
    setSuccessMessage('')

    if (!selectedSupplierId) {
      setErrorMessage('Please select a supplier.')
      return
    }

    if (billItems.length === 0) {
      setErrorMessage('Please add at least one product.')
      return
    }

    try {
      setLoading(true)
      const payload = {
        supplier_id: Number(selectedSupplierId),
        items: billItems.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        discount: Number(discount || 0),
        paid_amount: Number(paidAmount || 0),
        payment_method: paymentMethod,
        notes: notes || undefined,
      }

      const created = await createPurchase(payload)
      setSuccessMessage(`Purchase Bill ${created.purchase_number} recorded successfully! Stock has been added.`)
      setBillItems([])
      setDiscount(0)
      setPaidAmount(0)
      setNotes('')
      loadDependencies()
    } catch (err) {
      console.error('Error saving purchase:', err)
      setErrorMessage(err.response?.data?.detail || 'Failed to save purchase bill.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAddSupplier = async (e) => {
    e.preventDefault()
    if (!newSupName.trim()) return

    try {
      const created = await createSupplier({
        name: newSupName.trim(),
        phone: newSupPhone.trim() || undefined,
        address: newSupAddr.trim() || undefined,
        opening_balance: Number(newSupOpBal || 0),
      })
      await loadDependencies()
      setSelectedSupplierId(created.id)
      setShowAddSupplier(false)
      setNewSupName('')
      setNewSupPhone('')
      setNewSupAddr('')
      setNewSupOpBal(0)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error creating supplier')
    }
  }

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Purchases & Supplier Bills</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Record incoming stock, vendor bills, and supplier payable credit
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('new_purchase')}
            className={`btn ${activeTab === 'new_purchase' ? 'btn-primary' : 'btn-outline'}`}
          >
            📦 New Purchase Bill
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
          >
            📋 Purchase History
          </button>
        </div>
      </div>

      {errorMessage && (
        <div style={{ backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', color: '#fca5a5', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          ❌ {errorMessage}
        </div>
      )}

      {successMessage && (
        <div style={{ backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', color: '#6ee7b7', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          ✅ {successMessage}
        </div>
      )}

      {activeTab === 'new_purchase' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
          {/* Left Column */}
          <div>
            {/* Supplier Selector */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Select Supplier
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddSupplier(true)}
                  className="btn btn-outline btn-sm"
                >
                  + Add New Supplier
                </button>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="form-control"
                  style={{ flex: 1 }}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.supplier_code}) {s.phone ? `- ${s.phone}` : ''}
                    </option>
                  ))}
                </select>
                {selectedSupplierObj && (
                  <div
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      fontSize: '13px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Payable Due: <strong style={{ color: '#f87171' }}>{formatPKR(selectedSupplierObj.current_balance)}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Product Item Selection */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px' }}>Add Products to Purchase</h3>
              <form onSubmit={handleAddItem}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Product</label>
                    <select
                      value={selectedProduct}
                      onChange={(e) => handleProductSelect(e.target.value)}
                      className="form-control"
                    >
                      <option value="">-- Choose Product --</option>
                      <optgroup label="🧱 Cement (Unit: Bag)">
                        {products
                          .filter((p) => p.category.toLowerCase() === 'cement')
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — Current: {p.current_stock} Bags — Buy Rate: {formatPKR(p.purchase_price)}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="🏗️ Steel (Unit: KG)">
                        {products
                          .filter((p) => p.category.toLowerCase() === 'steel')
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — Current: {p.current_stock} KG — Buy Rate: {formatPKR(p.purchase_price)}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      Quantity {selectedProduct && `(${products.find((p) => String(p.id) === String(selectedProduct))?.unit})`}
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      className="form-control"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Purchase Rate (Rs.)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      className="form-control"
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ height: '39px' }}>
                    + Add Item
                  </button>
                </div>
              </form>
            </div>

            {/* Line Items Table */}
            <div className="card">
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px' }}>
                Purchase Items ({billItems.length})
              </h3>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Rate</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billItems.length > 0 ? (
                      billItems.map((item, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>
                            <strong>{item.product_name}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.product_code}</div>
                          </td>
                          <td>
                            <span className={`badge ${item.category.toLowerCase() === 'cement' ? 'badge-cement' : 'badge-steel'}`}>
                              {item.category} ({item.unit})
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <strong>{item.quantity}</strong> {item.unit}
                          </td>
                          <td style={{ textAlign: 'right' }}>{formatPKR(item.unit_price)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatPKR(item.total)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="btn btn-danger btn-sm"
                              title="Delete Item"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                          📦 No items added yet. Select a product above to add.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="card" style={{ position: 'sticky', top: '80px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              Purchase Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                <span style={{ fontWeight: 'bold' }}>{formatPKR(subtotal)}</span>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Discount (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="form-control"
                  placeholder="0"
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#60a5fa',
                  padding: '10px 0',
                  borderTop: '1px solid var(--border-color)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <span>Total Bill Amount:</span>
                <span>{formatPKR(totalAmount)}</span>
              </div>

              {/* Paid Amount */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Paid Amount (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="form-control"
                >
                  <option value="Credit">Credit (Pay Later)</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#f87171' }}>
                <span>Payable Remaining:</span>
                <span style={{ fontWeight: 'bold' }}>{formatPKR(remainingAmount)}</span>
              </div>

              {/* Supplier Projected Balance */}
              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Supplier Prev. Due:</span>
                  <span>{formatPKR(currentSupplierBalance)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#f87171' }}>
                  <span>Supplier New Payable:</span>
                  <span>{formatPKR(projectedNewSupplierBalance)}</span>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Notes / Reference</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="form-control"
                  placeholder="e.g. Truck No. RIA-4521"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={loading || billItems.length === 0}
              onClick={handleSavePurchase}
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              {loading ? 'Processing...' : '💾 Save Purchase Bill'}
            </button>
          </div>
        </div>
      ) : (
        /* Purchase History */
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ width: '260px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search by Purchase #..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="form-control"
                />
              </div>

              <div style={{ width: '220px' }}>
                <select
                  value={historySupplierFilter}
                  onChange={(e) => setHistorySupplierFilter(e.target.value)}
                  className="form-control"
                >
                  <option value="">-- All Suppliers --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="date" value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} className="form-control" />
              <input type="date" value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} className="form-control" />
              <button onClick={() => { setHistorySearch(''); setHistorySupplierFilter(''); setHistoryStartDate(''); setHistoryEndDate(''); loadHistory(); }} className="btn btn-outline btn-sm">
                ⛔ Clear
              </button>
              <button onClick={loadHistory} className="btn btn-outline btn-sm">
                🔄 Refresh List
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Purchase #</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Subtotal</th>
                  <th>Discount</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Remaining</th>
                  <th>Items</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '24px' }}>Loading purchase history...</td>
                  </tr>
                ) : purchaseHistory.length > 0 ? (
                  purchaseHistory.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.purchase_number}</strong></td>
                      <td>{formatDateTime(p.purchase_date)}</td>
                      <td>
                        <strong>{p.supplier_name}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.supplier_code}</div>
                      </td>
                      <td>{formatPKR(p.subtotal)}</td>
                      <td>{p.discount > 0 ? `-${formatPKR(p.discount)}` : '-'}</td>
                      <td><strong>{formatPKR(p.total_amount)}</strong></td>
                      <td>{formatPKR(p.paid_amount)}</td>
                      <td style={{ color: p.remaining_amount > 0 ? '#f87171' : 'inherit', fontWeight: 'bold' }}>
                        {formatPKR(p.remaining_amount)}
                      </td>
                      <td>{p.items?.length || 0} items</td>
                      <td>
                        <button
                          onClick={() => setViewingPurchase(p)}
                          className="btn btn-outline btn-sm"
                        >
                          👁️ View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No purchases found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Add Supplier Modal */}
      {showAddSupplier && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Quick Add New Supplier</h3>
              <button onClick={() => setShowAddSupplier(false)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleQuickAddSupplier}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={newSupName}
                    onChange={(e) => setNewSupName(e.target.value)}
                    className="form-control"
                    placeholder="e.g. Bestway Cement Agency"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    value={newSupPhone}
                    onChange={(e) => setNewSupPhone(e.target.value)}
                    className="form-control"
                    placeholder="0300-1234567"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    value={newSupAddr}
                    onChange={(e) => setNewSupAddr(e.target.value)}
                    className="form-control"
                    placeholder="Rawalpindi / Islamabad"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening Balance Payable (Rs.)</label>
                  <input
                    type="number"
                    value={newSupOpBal}
                    onChange={(e) => setNewSupOpBal(e.target.value)}
                    className="form-control"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddSupplier(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Purchase Bill Details Modal */}
      {viewingPurchase && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>
                Purchase Bill: {viewingPurchase.purchase_number}
              </h3>
              <button onClick={() => setViewingPurchase(null)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px', fontSize: '13px' }}>
                <div><strong>Supplier:</strong> {viewingPurchase.supplier_name}</div>
                <div><strong>Date:</strong> {formatDateTime(viewingPurchase.purchase_date)}</div>
                <div><strong>Payment Method:</strong> {viewingPurchase.payment_method}</div>
                <div><strong>Notes:</strong> {viewingPurchase.notes || '-'}</div>
              </div>

              <div className="table-container" style={{ marginBottom: '16px' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Unit Rate</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingPurchase.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{item.product_name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.category} ({item.unit})</div>
                        </td>
                        <td>{item.quantity} {item.unit}</td>
                        <td>{formatPKR(item.unit_price)}</td>
                        <td><strong>{formatPKR(item.total)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13.5px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>{formatPKR(viewingPurchase.subtotal)}</span>
                </div>
                {viewingPurchase.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f87171' }}>
                    <span>Discount:</span>
                    <span>-{formatPKR(viewingPurchase.discount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}>
                  <span>Total Bill:</span>
                  <span>{formatPKR(viewingPurchase.total_amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Paid:</span>
                  <span>{formatPKR(viewingPurchase.paid_amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#f87171' }}>
                  <span>Payable Due:</span>
                  <span>{formatPKR(viewingPurchase.remaining_amount)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setViewingPurchase(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
