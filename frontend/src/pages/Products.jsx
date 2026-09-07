import React, { useState, useEffect } from 'react'
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  formatPKR,
} from '../services/api'

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('All') // 'All' | 'Cement' | 'Steel'
  const [search, setSearch] = useState('')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [adjustingProduct, setAdjustingProduct] = useState(null)

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    category: 'Cement',
    unit: 'Bag',
    purchase_price: 0,
    sale_price: 0,
    current_stock: 0,
    minimum_stock: 50,
  })

  // Stock Adjustment State
  const [adjustType, setAdjustType] = useState('IN')
  const [adjustQty, setAdjustQty] = useState(10)
  const [adjustNotes, setAdjustNotes] = useState('')

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const data = await listProducts({
        category: categoryFilter !== 'All' ? categoryFilter : undefined,
        search: search || undefined,
      })
      setProducts(data)
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [categoryFilter, search])

  const handleCategoryChange = (cat) => {
    const defaultUnit = cat === 'Cement' ? 'Bag' : 'KG'
    const defaultMin = cat === 'Cement' ? 50 : 500
    setFormData((prev) => ({
      ...prev,
      category: cat,
      unit: defaultUnit,
      minimum_stock: defaultMin,
    }))
  }

  const handleSaveProduct = async (e) => {
    e.preventDefault()
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
          purchase_price: Number(formData.purchase_price),
          sale_price: Number(formData.sale_price),
          minimum_stock: Number(formData.minimum_stock),
        })
      } else {
        await createProduct({
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
          purchase_price: Number(formData.purchase_price),
          sale_price: Number(formData.sale_price),
          current_stock: Number(formData.current_stock),
          minimum_stock: Number(formData.minimum_stock),
        })
      }

      setShowAddModal(false)
      setEditingProduct(null)
      fetchProducts()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save product')
    }
  }

  const handleOpenEdit = (p) => {
    setEditingProduct(p)
    setFormData({
      name: p.name,
      category: p.category,
      unit: p.unit,
      purchase_price: p.purchase_price,
      sale_price: p.sale_price,
      current_stock: p.current_stock,
      minimum_stock: p.minimum_stock,
    })
    setShowAddModal(true)
  }

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to archive "${name}"?`)) {
      try {
        await deleteProduct(id)
        fetchProducts()
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to delete product')
      }
    }
  }

  const handleStockAdjustment = async (e) => {
    e.preventDefault()
    if (!adjustingProduct) return

    try {
      await adjustStock(adjustingProduct.id, {
        adjustment_type: adjustType,
        quantity: Number(adjustQty),
        notes: adjustNotes || undefined,
      })
      setAdjustingProduct(null)
      setAdjustNotes('')
      setAdjustQty(10)
      fetchProducts()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error adjusting stock')
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Products & Materials Catalog</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Manage Cement (Bags) and Steel (KG) pricing, stock levels, and alert thresholds
          </p>
        </div>
        <button
          onClick={() => {
            setEditingProduct(null)
            setFormData({
              name: '',
              category: 'Cement',
              unit: 'Bag',
              purchase_price: 0,
              sale_price: 0,
              current_stock: 0,
              minimum_stock: 50,
            })
            setShowAddModal(true)
          }}
          className="btn btn-primary"
        >
          + Add New Product
        </button>
      </div>

      {/* Filters & Search */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {['All', 'Cement', 'Steel'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`btn btn-sm ${categoryFilter === cat ? 'btn-primary' : 'btn-outline'}`}
              >
                {cat === 'All' ? '📦 All Materials' : cat === 'Cement' ? '🧱 Cement (Bags)' : '🏗️ Steel (KG)'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ width: '280px' }}>
            <input
              type="text"
              placeholder="🔍 Search product name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
            />
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Purchase Rate</th>
                <th style={{ textAlign: 'right' }}>Sale Rate</th>
                <th style={{ textAlign: 'center' }}>Current Stock</th>
                <th style={{ textAlign: 'center' }}>Stock Health</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '24px' }}>Loading products...</td>
                </tr>
              ) : products.length > 0 ? (
                products.map((p) => {
                  const isLow = p.current_stock <= p.minimum_stock && p.current_stock > 0
                  const isOut = p.current_stock <= 0

                  return (
                    <tr key={p.id}>
                      <td><strong>{p.product_code}</strong></td>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>
                        <span className={`badge ${p.category.toLowerCase() === 'cement' ? 'badge-cement' : 'badge-steel'}`}>
                          {p.category}
                        </span>
                      </td>
                      <td><strong>{p.unit}</strong></td>
                      <td style={{ textAlign: 'right' }}>{formatPKR(p.purchase_price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatPKR(p.sale_price)}</td>
                      <td style={{ textAlign: 'center', fontSize: '15px', fontWeight: 'bold' }}>
                        {Number(p.current_stock).toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)' }}>{p.unit}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isOut ? (
                          <span className="badge badge-danger">Out of Stock</span>
                        ) : isLow ? (
                          <span className="badge badge-warning">Low Stock (Min: {p.minimum_stock})</span>
                        ) : (
                          <span className="badge badge-success">In Stock</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => {
                              setAdjustingProduct(p)
                              setAdjustType('IN')
                              setAdjustQty(10)
                            }}
                            className="btn btn-outline btn-sm"
                            title="Adjust Stock"
                          >
                            ⚖️ Adjust
                          </button>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="btn btn-secondary btn-sm"
                            title="Edit Product"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="btn btn-danger btn-sm"
                            title="Archive Product"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                    No products found. Click "+ Add New Product" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>
                {editingProduct ? `Edit Product: ${editingProduct.product_code}` : 'Add New Product'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => handleCategoryChange('Cement')}
                      className={`btn ${formData.category === 'Cement' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ height: '42px' }}
                    >
                      🧱 Cement (Bag)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCategoryChange('Steel')}
                      className={`btn ${formData.category === 'Steel' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ height: '42px' }}
                    >
                      🏗️ Steel (KG)
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-control"
                    placeholder={formData.category === 'Cement' ? 'e.g. Askari Cement' : 'e.g. Mughal Steel 60 Grade'}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Current Purchase Rate (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                      className="form-control"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Current Sale Rate (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.sale_price}
                      onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>

                {!editingProduct && (
                  <div className="form-group">
                    <label className="form-label">
                      Initial Opening Stock ({formData.unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.current_stock}
                      onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                      className="form-control"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">
                    Minimum Stock Alert Threshold ({formData.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={formData.minimum_stock}
                    onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingProduct && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>
                Stock Adjustment: {adjustingProduct.name}
              </h3>
              <button onClick={() => setAdjustingProduct(null)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleStockAdjustment}>
              <div className="modal-body">
                <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Current Stock on Hand:</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#38bdf8' }}>
                    {adjustingProduct.current_stock} {adjustingProduct.unit}
                  </div>
                </div>

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
                      ➖ Stock Out (Deduct / Waste)
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity ({adjustingProduct.unit}) *</label>
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
                  <label className="form-label">Reason / Notes</label>
                  <input
                    type="text"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    className="form-control"
                    placeholder="e.g. Physical inventory audit recount / damaged bag"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setAdjustingProduct(null)} className="btn btn-secondary">
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
