import React, { useState, useEffect, useMemo } from 'react'
import {
  listSales,
  createSale,
  listCustomers,
  createCustomer,
  listProducts,
  formatPKR,
  formatDateTime,
} from '../services/api'

export default function Sales({ onOpenReceipt }) {
  const [activeTab, setActiveTab] = useState('new_bill') // 'new_bill' | 'history'
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [salesHistory, setSalesHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearch, setHistorySearch] = useState('')

  // Selected Category filter for adding products
  const [productCategoryFilter, setProductCategoryFilter] = useState('All') // 'All' | 'Cement' | 'Steel'
  const [selectedCategory, setSelectedCategory] = useState('') // 'cement' | 'steel'

  // Bill Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedCementId, setSelectedCementId] = useState('')
  const [selectedSteelId, setSelectedSteelId] = useState('')
  const [activeProductType, setActiveProductType] = useState('') // 'cement' | 'steel'
  const [itemQuantity, setItemQuantity] = useState(1)
  const [itemPrice, setItemPrice] = useState('')
  const [billItems, setBillItems] = useState([])
  const [discount, setDiscount] = useState(0)
  const [mazdori, setMazdori] = useState(0)
  const [paidAmount, setPaidAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Quick Customer Modal
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustAddr, setNewCustAddr] = useState('')
  const [newCustOpBal, setNewCustOpBal] = useState(0)

  const loadData = async () => {
    try {
      const [custData, prodData] = await Promise.all([ 
        listCustomers({ active_only: true }),
        listProducts({ active_only: true }),
      ])
      setCustomers(custData || [])
      setProducts(prodData || [])

      if (custData && custData.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(String(custData[0].id))
      }
    } catch (err) {
      console.error('Error loading sales data:', err)
      setErrorMessage('Could not connect to backend server. Make sure backend is running.')
    }
  }

  const loadHistory = async () => {
    try {
      setHistoryLoading(true)
      const data = await listSales({ search: historySearch || undefined, limit: 100 })
      setSalesHistory(data || [])
    } catch (err) {
      console.error('Error loading history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Derive cement company list from cement products (unique first token), merged with common brands
  const cementCompanies = useMemo(() => {
    try {
      const fromProducts = Array.from(new Set(
        products
          .filter((p) => (p.category || '').toLowerCase() === 'cement')
          .map((p) => (p.name || '').split(/\s+/)[0])
          .filter(Boolean)
      ))
      const common = ['Bestway', 'Lucky', 'Fauji', 'Cherat', 'DG Khan', 'Askari']
      const merged = Array.from(new Set([...fromProducts, ...common])).filter(Boolean)
      return merged
    } catch (e) {
      return ['Bestway', 'Lucky', 'Fauji', 'Cherat']
    }
  }, [products])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory()
    }
  }, [activeTab, historySearch])

  // When a product is selected in the dropdown
  const handleProductChange = (productId) => {
    // legacy single-select handler — keep for compatibility
    setSelectedProductId(productId)
    const prod = products.find((p) => String(p.id) === String(productId))
    if (prod) {
      setItemPrice(prod.sale_price || 0)
      setActiveProductType(prod.category && prod.category.toLowerCase() === 'steel' ? 'steel' : 'cement')
      if ((prod.category || '').toLowerCase() === 'cement') setSelectedCementId(productId)
      else setSelectedSteelId(productId)
    } else {
      setItemPrice('')
    }
  }

  // Quick pick product button
  const handleQuickPickProduct = (prod) => {
    // keep separate selections for cement vs steel while marking active product
    const id = String(prod.id)
    if ((prod.category || '').toLowerCase() === 'cement') {
      setSelectedCementId(id)
      setActiveProductType('cement')
      setSelectedCategory('cement')
    } else {
      setSelectedSteelId(id)
      setActiveProductType('steel')
      setSelectedCategory('steel')
    }
    setSelectedProductId(id)
    setItemPrice(prod.sale_price || 0)
    setItemQuantity(1)
  }

  // Add Item to Bill
  const handleAddItem = (e) => {
    if (e) e.preventDefault()
    setErrorMessage('')

    if (!selectedProductId) {
      setErrorMessage('Please select a Cement or Steel product first.')
      return
    }

    const prod = products.find((p) => String(p.id) === String(selectedProductId))
    if (!prod) {
      setErrorMessage('Selected product not found.')
      return
    }

    const qty = Number(itemQuantity)
    const rate = Number(itemPrice)

    if (!qty || qty <= 0) {
      setErrorMessage('Please enter a valid quantity greater than 0.')
      return
    }
    if (rate < 0) {
      setErrorMessage('Sale rate cannot be negative.')
      return
    }

    // Check available stock
    const existingInCart = billItems.find((i) => i.product_id === prod.id)?.quantity || 0
    if (existingInCart + qty > prod.current_stock) {
      setErrorMessage(
        `Insufficient stock for ${prod.name}! Available: ${prod.current_stock} ${prod.unit}, Already in bill: ${existingInCart} ${prod.unit}`
      )
      return
    }

    // Check if already in bill, update qty
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

    // Reset product selection
    // clear only the active product dropdown so Cement and Steel selections remain independent
    if (activeProductType === 'cement') setSelectedCementId('')
    if (activeProductType === 'steel') setSelectedSteelId('')
    setSelectedProductId('')
    setActiveProductType('')
    setItemQuantity(1)
    setItemPrice('')
  }

  const handleRemoveItem = (index) => {
    setBillItems(billItems.filter((_, i) => i !== index))
  }

  const handleUpdateItemQty = (index, newQty) => {
    if (newQty <= 0) return
    const updated = [...billItems]
    const item = updated[index]
    const prod = products.find((p) => p.id === item.product_id)
    if (prod && newQty > prod.current_stock) {
      alert(`Only ${prod.current_stock} ${prod.unit} available in stock!`)
      return
    }
    item.quantity = newQty
    item.total = item.quantity * item.unit_price
    setBillItems(updated)
  }

  // Calculations
  const subtotal = billItems.reduce((sum, item) => sum + item.total, 0)
  const totalAmount = Math.max(0, subtotal - Number(discount || 0) + Number(mazdori || 0))
  const customerTotal = Math.max(0, subtotal - Number(discount || 0)) // customer-facing total (exclude mazdori)
  const paidValue = paidAmount === '' ? totalAmount : Number(paidAmount || 0)
  // Customer-facing remaining excludes mazdori and is never negative
  const customerRemaining = Math.max(0, customerTotal - paidValue)

  const selectedCustomer = customers.find((c) => String(c.id) === String(selectedCustomerId))
  const oldCustomerBalance = selectedCustomer ? (selectedCustomer.current_balance || 0) : 0
  const newCustomerBalance = oldCustomerBalance + customerRemaining

  const selectedProductObj = products.find((p) => String(p.id) === String(selectedProductId))

  const handleSaveSale = async (andPrint = false) => {
    setErrorMessage('')
    setSuccessMessage('')

    if (!selectedCustomerId) {
      setErrorMessage('Please select or add a customer.')
      return
    }

    if (billItems.length === 0) {
      setErrorMessage('Please add at least one product (Cement / Steel) to the bill.')
      return
    }

    try {
      setLoading(true)
      const payload = {
        customer_id: Number(selectedCustomerId),
        items: billItems.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        discount: Number(discount || 0),
        mazdori: Number(mazdori || 0),
        paid_amount: paidValue,
        payment_method: paymentMethod,
        notes: notes || undefined,
      }

      const createdSale = await createSale(payload)

      setSuccessMessage(`Bill #${createdSale.invoice_number} successfully saved!`)
      setBillItems([])
      setDiscount(0)
      setMazdori(0)
      setPaidAmount('')
      setNotes('')

      await loadData()

      if (andPrint) {
        onOpenReceipt(createdSale)
      }
    } catch (err) {
      console.error('Error creating sale:', err)
      setErrorMessage(err.response?.data?.detail || 'Failed to save bill. Please check stock.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAddCustomer = async (e) => {
    e.preventDefault()
    if (!newCustName.trim()) return

    try {
        // Append selected cement company into address so we keep this info without changing backend schema
        const addressWithCompany = `${newCustAddr.trim() || ''}${newCustCementCompany ? ' | Cement: ' + newCustCementCompany : ''}`.trim()
        const created = await createCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
          address: addressWithCompany || undefined,
        opening_balance: Number(newCustOpBal || 0),
      })
      await loadData()
      setSelectedCustomerId(String(created.id))
      setShowAddCustomer(false)
      setNewCustName('')
      setNewCustPhone('')
      setNewCustAddr('')
      setNewCustOpBal(0)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error creating customer')
    }
  }

  const [newCustCementCompany, setNewCustCementCompany] = useState('')
  const filteredProducts = products.filter((p) => {
    if (productCategoryFilter === 'Cement') return p.category.toLowerCase() === 'cement'
    if (productCategoryFilter === 'Steel') return p.category.toLowerCase() === 'steel'
    return true
  })

  // No brand chips — use filteredProducts directly
  const brandFilteredProducts = filteredProducts

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>🧾 Sales & Billing (Bikri)</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Fast Bill Creation with Live Stock & Customer Khata Balance
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('new_bill')}
            className={`btn ${activeTab === 'new_bill' ? 'btn-primary' : 'btn-outline'}`}
          >
            🧾 New Bill (Naya Bill)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
          >
            📋 Purane Bills (History)
          </button>
        </div>
      </div>

      {errorMessage && (
        <div style={{ backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', color: '#fca5a5', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {successMessage && (
        <div style={{ backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', color: '#6ee7b7', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          ✅ {successMessage}
        </div>
      )}

      {activeTab === 'new_bill' ? (
        <div className="sales-grid">
          {/* Left Column: Customer & Product Adding */}
          <div>
            {/* 1. Customer Selection Card */}
            <div className="card" style={{ marginBottom: '18px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#f8fafc' }}>
                  👤 1. Customer Select Karein
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddCustomer(true)}
                  className="btn btn-success btn-sm"
                >
                  ➕ Naya Customer Add Karein
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="form-control"
                  style={{ flex: 1, fontSize: '15px', fontWeight: '500' }}
                >
                  {customers.length === 0 ? (
                    <option value="">No customers found. Click + Naya Customer</option>
                  ) : (
                    customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} - Due: {formatPKR(c.current_balance)}
                      </option>
                    ))
                  )}
                </select>

                {selectedCustomer && (
                  <div
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Pichla Udhaar (Old Due):</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: oldCustomerBalance > 0 ? '#fbbf24' : '#34d399' }}>
                      {formatPKR(oldCustomerBalance)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Add Product to Bill Card */}
            <div className="card" style={{ marginBottom: '18px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#f8fafc' }}>
                  🧱 2. Product Chunein (Cement / Steel)
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <label style={{ marginRight: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      const v = e.target.value
                      // clear previous product selection when switching category
                      if (v === 'cement') {
                        setSelectedSteelId('')
                        setSelectedProductId('')
                        setActiveProductType('')
                        setItemPrice('')
                      } else if (v === 'steel') {
                        setSelectedCementId('')
                        setSelectedProductId('')
                        setActiveProductType('')
                        setItemPrice('')
                      } else {
                        setSelectedCementId('')
                        setSelectedSteelId('')
                        setSelectedProductId('')
                        setActiveProductType('')
                        setItemPrice('')
                      }
                      setSelectedCategory(v)
                    }}
                    className="form-control"
                    style={{ width: 200 }}
                  >
                    <option value="">-- Select Category --</option>
                    <option value="cement">Cement</option>
                    <option value="steel">Steel</option>
                  </select>
                </div>
              </div>

              {/* Quick Click Product Chips removed — using product selector only */}

              {/* Product Selection Form */}
              <form onSubmit={handleAddItem}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                  {/* Show product dropdown only after category selected */}
                  {selectedCategory === 'cement' && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">CEMENT (Unit: Bag)</label>
                      <select
                        value={selectedCementId}
                        onChange={(e) => {
                          const v = e.target.value
                          setSelectedCementId(v)
                          if (v) handleProductChange(v)
                          else {
                            if (activeProductType === 'cement') { setSelectedProductId(''); setActiveProductType('') }
                          }
                        }}
                        className="form-control"
                      >
                        <option value="">-- Select Cement --</option>
                        {products
                          .filter((p) => (p.category || '').toLowerCase() === 'cement')
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                      </select>
                    </div>
                  )}

                  {selectedCategory === 'steel' && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">STEEL (Unit: KG)</label>
                      <select
                        value={selectedSteelId}
                        onChange={(e) => {
                          const v = e.target.value
                          setSelectedSteelId(v)
                          if (v) handleProductChange(v)
                          else {
                            if (activeProductType === 'steel') { setSelectedProductId(''); setActiveProductType('') }
                          }
                        }}
                        className="form-control"
                      >
                        <option value="">-- Select Steel --</option>
                        {products
                          .filter((p) => (p.category || '').toLowerCase() === 'steel')
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Qty</label>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      required
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      className="form-control"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Rate (Rs.)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      className="form-control"
                      placeholder="0"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ height: '42px', fontWeight: 'bold' }}
                    disabled={!selectedCategory || !selectedProductId || itemQuantity <= 0}
                  >
                    ➕ Add Karein
                  </button>
                </div>

                {selectedProductObj && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span>
                      Unit: <strong>{selectedProductObj.unit}</strong> | Category: <strong>{selectedProductObj.category}</strong>
                    </span>
                    <span style={{ color: selectedProductObj.current_stock > 0 ? '#34d399' : '#f87171', fontWeight: 'bold' }}>
                      Available Stock: {selectedProductObj.current_stock} {selectedProductObj.unit}
                    </span>
                  </div>
                )}
              </form>
            </div>

            {/* 3. Items Added to Bill */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#f8fafc' }}>
                  📋 Bill Items ({billItems.length})
                </span>
                {billItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBillItems([])}
                    className="btn btn-outline btn-sm"
                    style={{ color: '#f87171' }}
                  >
                    Clear Bill
                  </button>
                )}
              </div>

              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>Unit</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Rate (Rs.)</th>
                      <th style={{ textAlign: 'right' }}>Total (Rs.)</th>
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
                          </td>
                          <td>
                            <span className={`badge ${item.category.toLowerCase() === 'cement' ? 'badge-cement' : 'badge-steel'}`}>
                              {item.unit}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, item.quantity - 1)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 6px', height: '24px' }}
                              >
                                -
                              </button>
                              <strong>{item.quantity}</strong>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, item.quantity + 1)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 6px', height: '24px' }}
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>{formatPKR(item.unit_price)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '14.5px' }}>
                            {formatPKR(item.total)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
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
                          🛒 Bill abhi khali hai. Upar se product select karke add karein.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Calculations & Big Checkout Button */}
          <div className="card" style={{ position: 'sticky', top: '80px', padding: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              💰 Bill Calculation
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                <span style={{ fontWeight: 'bold' }}>{formatPKR(subtotal)}</span>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Discount (Riayat) Rs.</label>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="form-control"
                  placeholder="0"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Mazdori / Labour (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  value={mazdori}
                  onChange={(e) => setMazdori(e.target.value)}
                  className="form-control"
                  placeholder="0"
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#34d399',
                  padding: '12px 0',
                  borderTop: '1px solid var(--border-color)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <span>Total Bill:</span>
                <span>{formatPKR(totalAmount)}</span>
              </div>

              {/* Paid Amount */}
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ fontSize: '12px', margin: 0 }}>
                    Wasool Rakam (Paid Cash):
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setPaidAmount(totalAmount)}
                      className="btn btn-success btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                    >
                      Poora Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaidAmount(0)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                    >
                      Baqi / Udhaar
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  value={paidAmount === '' ? (billItems.length > 0 ? totalAmount : '') : paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="form-control"
                  placeholder={String(totalAmount)}
                  style={{ fontSize: '16px', fontWeight: 'bold' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="form-control"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Online">Online (EasyPaisa / JazzCash)</option>
                  <option value="Credit">Udhaar (Credit)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Is Bill Ka Baqi (Remaining):</span>
                <span style={{ fontWeight: 'bold', color: customerRemaining > 0 ? '#f87171' : '#34d399' }}>
                  {formatPKR(customerRemaining)}
                </span>
              </div>

              {/* Customer Total Ledger Due */}
              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  <span>Pichla Udhaar:</span>
                  <span>{formatPKR(oldCustomerBalance)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px', color: '#fbbf24' }}>
                  <span>Kul Baqi (New Balance):</span>
                  <span>{formatPKR(newCustomerBalance)}</span>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Delivery Site / Note</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="form-control"
                  placeholder="e.g. Site # 12, G.T. Road"
                />
              </div>
            </div>

            {/* Big Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                disabled={loading || billItems.length === 0}
                onClick={() => handleSaveSale(true)}
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
              >
                {loading ? 'Processing...' : '🖨️ Bill Save & Print Receipt'}
              </button>
              <button
                type="button"
                disabled={loading || billItems.length === 0}
                onClick={() => handleSaveSale(false)}
                className="btn btn-secondary"
                style={{ width: '100%' }}
              >
                💾 Sirf Save Karein (Bina Print)
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ width: '320px' }}>
              <input
                type="text"
                placeholder="🔍 Bill # ya Customer search karein..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="form-control"
              />
            </div>
            <button onClick={loadHistory} className="btn btn-outline btn-sm">
              🔄 Refresh List
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Waqt / Date</th>
                  <th>Customer Name</th>
                  <th>Total Bill</th>
                  <th>Wasool (Paid)</th>
                  <th>Baqi (Remaining)</th>
                  <th>Payment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>Loading sales history...</td>
                  </tr>
                ) : salesHistory.length > 0 ? (
                  salesHistory.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.invoice_number}</strong></td>
                      <td>{formatDateTime(s.sale_date)}</td>
                      <td>
                        <strong>{s.customer_name}</strong>
                      </td>
                      <td><strong>{formatPKR(s.total_amount)}</strong></td>
                      <td style={{ color: '#34d399' }}>{formatPKR(s.paid_amount)}</td>
                      <td style={{ color: s.remaining_amount > 0 ? '#f87171' : 'inherit', fontWeight: 'bold' }}>
                        {formatPKR(s.remaining_amount)}
                      </td>
                      <td>
                        <span className="badge badge-success">{s.payment_method}</span>
                      </td>
                      <td>
                        <button
                          onClick={() => onOpenReceipt(s)}
                          className="btn btn-outline btn-sm"
                          title="Print Thermal Receipt"
                        >
                          🖨️ Receipt
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      Koi purana bill nahi mila.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      {showAddCustomer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>➕ Naya Customer Add Karein</h3>
              <button onClick={() => setShowAddCustomer(false)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleQuickAddCustomer}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="form-control"
                    placeholder="e.g. Muhammad Ali"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="form-control"
                    placeholder="0300-1234567"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Place</label>
                  <input
                    type="text"
                    value={newCustAddr}
                    onChange={(e) => setNewCustAddr(e.target.value)}
                    className="form-control"
                    placeholder="City / Area"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Cement Company</label>
                  <select
                    value={newCustCementCompany}
                    onChange={(e) => setNewCustCementCompany(e.target.value)}
                    className="form-control"
                  >
                    <option value="">-- Select Company --</option>
                    {cementCompanies.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddCustomer(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
