import React, { useState, useEffect } from 'react'
import {
  getSalesReport,
  getPurchasesReport,
  getProfitReport,
  getInventoryReport,
  formatPKR,
  formatDate,
} from '../services/api'

export default function Reports() {
  const [reportType, setReportType] = useState('sales') // 'sales' | 'purchases' | 'profit' | 'inventory'
  const [presetDate, setPresetDate] = useState('month') // 'today' | 'week' | 'month' | 'all'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)

  // Report Data States
  const [salesData, setSalesData] = useState(null)
  const [purchasesData, setPurchasesData] = useState(null)
  const [profitData, setProfitData] = useState(null)
  const [inventoryData, setInventoryData] = useState(null)

  const applyPresetDates = (preset) => {
    setPresetDate(preset)
    const now = new Date()
    let start = new Date()
    let end = new Date()

    if (preset === 'today') {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else if (preset === 'week') {
      const day = now.getDay()
      start.setDate(now.getDate() - day + (day === 0 ? -6 : 1)) // Monday
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else if (preset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    } else if (preset === 'all') {
      setStartDate('')
      setEndDate('')
      return
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  useEffect(() => {
    applyPresetDates('month')
  }, [])

  const fetchCurrentReport = async () => {
    try {
      setLoading(true)
      const params = {}
      if (startDate) params.start_date = new Date(startDate).toISOString()
      if (endDate) {
        const e = new Date(endDate)
        e.setHours(23, 59, 59, 999)
        params.end_date = e.toISOString()
      }

      if (reportType === 'sales') {
        const data = await getSalesReport(params)
        setSalesData(data)
      } else if (reportType === 'purchases') {
        const data = await getPurchasesReport(params)
        setPurchasesData(data)
      } else if (reportType === 'profit') {
        const data = await getProfitReport(params)
        setProfitData(data)
      } else if (reportType === 'inventory') {
        const data = await getInventoryReport()
        setInventoryData(data)
      }
    } catch (err) {
      console.error('Error fetching report:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCurrentReport()
  }, [reportType, startDate, endDate])

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Business Reports & Analytics</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Comprehensive sales, purchases, gross profit margins, and stock asset valuation
          </p>
        </div>
        <button onClick={() => window.print()} className="btn btn-outline">
          🖨️ Print Report
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Report Type Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setReportType('sales')}
              className={`btn btn-sm ${reportType === 'sales' ? 'btn-primary' : 'btn-outline'}`}
            >
              📊 Sales Report
            </button>
            <button
              onClick={() => setReportType('purchases')}
              className={`btn btn-sm ${reportType === 'purchases' ? 'btn-primary' : 'btn-outline'}`}
            >
              📦 Purchases Report
            </button>
            <button
              onClick={() => setReportType('profit')}
              className={`btn btn-sm ${reportType === 'profit' ? 'btn-primary' : 'btn-outline'}`}
            >
              📈 Profit & Margins
            </button>
            <button
              onClick={() => setReportType('inventory')}
              className={`btn btn-sm ${reportType === 'inventory' ? 'btn-primary' : 'btn-outline'}`}
            >
              🧱 Inventory Valuation
            </button>
          </div>

          {/* Date Range Presets */}
          {reportType !== 'inventory' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => applyPresetDates('today')}
                className={`btn btn-sm ${presetDate === 'today' ? 'btn-secondary' : 'btn-outline'}`}
              >
                Today
              </button>
              <button
                onClick={() => applyPresetDates('week')}
                className={`btn btn-sm ${presetDate === 'week' ? 'btn-secondary' : 'btn-outline'}`}
              >
                This Week
              </button>
              <button
                onClick={() => applyPresetDates('month')}
                className={`btn btn-sm ${presetDate === 'month' ? 'btn-secondary' : 'btn-outline'}`}
              >
                This Month
              </button>
              <button
                onClick={() => applyPresetDates('all')}
                className={`btn btn-sm ${presetDate === 'all' ? 'btn-secondary' : 'btn-outline'}`}
              >
                All Time
              </button>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '8px' }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setPresetDate('custom')
                    setStartDate(e.target.value)
                  }}
                  className="form-control"
                  style={{ width: '135px', padding: '4px 8px', fontSize: '12px' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setPresetDate('custom')
                    setEndDate(e.target.value)
                  }}
                  className="form-control"
                  style={{ width: '135px', padding: '4px 8px', fontSize: '12px' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content based on selected Report Type */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          Generating report data...
        </div>
      ) : reportType === 'sales' && salesData ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Gross Subtotal</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399', margin: '4px 0' }}>
                {formatPKR(salesData.total_sales)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{salesData.count} Invoices</div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Net Total Sales</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#60a5fa', margin: '4px 0' }}>
                {formatPKR(salesData.net_sales)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>After Rs. {salesData.total_discount} discount</div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Cash / Paid Amount</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399', margin: '4px 0' }}>
                {formatPKR(salesData.total_paid)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Collected from customers</div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Credit / Remaining</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fbbf24', margin: '4px 0' }}>
                {formatPKR(salesData.total_remaining)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Unpaid customer balance</div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px' }}>Invoices Breakdown</h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                    <th style={{ textAlign: 'right' }}>Discount</th>
                    <th style={{ textAlign: 'right' }}>Net Bill</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                    <th style={{ textAlign: 'right' }}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.sales.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.invoice_number}</strong></td>
                      <td>{formatDate(s.sale_date)}</td>
                      <td>{s.customer_name}</td>
                      <td>{s.items?.length || 0} items</td>
                      <td style={{ textAlign: 'right' }}>{formatPKR(s.subtotal)}</td>
                      <td style={{ textAlign: 'right' }}>{s.discount > 0 ? `-${formatPKR(s.discount)}` : '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatPKR(s.total_amount)}</td>
                      <td style={{ textAlign: 'right', color: '#34d399' }}>{formatPKR(s.paid_amount)}</td>
                      <td style={{ textAlign: 'right', color: s.remaining_amount > 0 ? '#fbbf24' : 'inherit' }}>
                        {formatPKR(s.remaining_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : reportType === 'purchases' && purchasesData ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Purchases</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#60a5fa', margin: '4px 0' }}>
                {formatPKR(purchasesData.net_purchases)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{purchasesData.count} Bills</div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Paid to Suppliers</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399', margin: '4px 0' }}>
                {formatPKR(purchasesData.total_paid)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Disbursed</div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Payable Remaining</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f87171', margin: '4px 0' }}>
                {formatPKR(purchasesData.total_remaining)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Owed to factories & distributors</div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px' }}>Purchases Breakdown</h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Purchase #</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Items</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                    <th style={{ textAlign: 'right' }}>Payable Due</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasesData.purchases.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.purchase_number}</strong></td>
                      <td>{formatDate(p.purchase_date)}</td>
                      <td>{p.supplier_name}</td>
                      <td>{p.items?.length || 0} items</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatPKR(p.total_amount)}</td>
                      <td style={{ textAlign: 'right', color: '#34d399' }}>{formatPKR(p.paid_amount)}</td>
                      <td style={{ textAlign: 'right', color: '#f87171' }}>{formatPKR(p.remaining_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : reportType === 'profit' && profitData ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Sales Revenue</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#60a5fa', margin: '4px 0' }}>
                {formatPKR(profitData.total_sales_revenue)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>From {profitData.total_sales_count} sales</div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Cost of Goods Sold (COGS)</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#f87171', margin: '4px 0' }}>
                {formatPKR(profitData.total_cost_of_goods_sold)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Material purchase cost</div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Gross Profit</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#34d399', margin: '4px 0' }}>
                {formatPKR(profitData.gross_profit)}
              </div>
              <div style={{ fontSize: '12px', color: '#34d399', fontWeight: 'bold' }}>
                Margin: {profitData.profit_margin_percent}%
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="card" style={{ borderLeft: '4px solid #0ea5e9' }}>
              <h4 style={{ color: '#38bdf8', marginBottom: '10px' }}>🧱 Cement Category Revenue</h4>
              <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{formatPKR(profitData.cement_revenue)}</div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Total billing revenue generated from Cement bags
              </p>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <h4 style={{ color: '#fbbf24', marginBottom: '10px' }}>🏗️ Steel Category Revenue</h4>
              <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{formatPKR(profitData.steel_revenue)}</div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Total billing revenue generated from Steel weight (KG)
              </p>
            </div>
          </div>
        </div>
      ) : reportType === 'inventory' && inventoryData ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="card" style={{ borderLeft: '4px solid #0ea5e9' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Cement Stock</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#38bdf8', margin: '4px 0' }}>
                {Number(inventoryData.total_cement_bags).toLocaleString()} Bags
              </div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Steel Stock</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#fbbf24', margin: '4px 0' }}>
                {Number(inventoryData.total_steel_kg).toLocaleString()} KG
              </div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Stock Asset Valuation</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#34d399', margin: '4px 0' }}>
                {formatPKR(inventoryData.total_valuation)}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px' }}>Stock Valuation Table</h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'center' }}>Stock on Hand</th>
                    <th style={{ textAlign: 'right' }}>Purchase Rate</th>
                    <th style={{ textAlign: 'right' }}>Sale Rate</th>
                    <th style={{ textAlign: 'right' }}>Valuation (Cost)</th>
                    <th style={{ textAlign: 'center' }}>Health</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryData.items.map((item) => (
                    <tr key={item.product_id}>
                      <td><strong>{item.product_code}</strong></td>
                      <td><strong>{item.product_name}</strong></td>
                      <td>
                        <span className={`badge ${item.category.toLowerCase() === 'cement' ? 'badge-cement' : 'badge-steel'}`}>
                          {item.category}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {item.current_stock} {item.unit}
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatPKR(item.purchase_price)}</td>
                      <td style={{ textAlign: 'right' }}>{formatPKR(item.sale_price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#34d399' }}>
                        {formatPKR(item.stock_value)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.status === 'OUT_OF_STOCK' ? (
                          <span className="badge badge-danger">Out</span>
                        ) : item.status === 'LOW_STOCK' ? (
                          <span className="badge badge-warning">Low</span>
                        ) : (
                          <span className="badge badge-success">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
