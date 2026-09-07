import React, { useState, useEffect } from 'react'
import { getDashboardSummary, formatPKR, formatDate } from '../services/api'

export default function Dashboard({ onNavigate, onOpenReceipt }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      const data = await getDashboardSummary()
      setSummary(data)
      setError(null)
    } catch (err) {
      console.error('Error loading dashboard:', err)
      setError('Could not connect to backend server. Make sure the API server is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>Loading business dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--danger)', marginTop: '20px' }}>
        <h3 style={{ color: 'var(--danger)', marginBottom: '8px' }}>Connection Error</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{error}</p>
        <button onClick={fetchDashboard} className="btn btn-primary">
          🔄 Retry Connection
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Top Header & Quick Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Business Overview</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Real-time sales, purchases, inventory, and customer ledgers
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => onNavigate('sales')} className="btn btn-primary">
            🧾 + New Sale (Bill)
          </button>
          <button onClick={() => onNavigate('purchases')} className="btn btn-secondary">
            📦 + New Purchase
          </button>
          <button onClick={() => onNavigate('customers')} className="btn btn-secondary">
            💵 Receive Payment
          </button>
          <button onClick={fetchDashboard} className="btn btn-outline" title="Refresh">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Low Stock Alert if any */}
      {summary?.low_stock_count > 0 && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <strong style={{ color: '#f87171' }}>Low Stock Warning: </strong>
              <span style={{ color: 'var(--text-primary)', fontSize: '13.5px' }}>
                {summary.low_stock_count} product(s) have reached or fallen below minimum stock limits!
              </span>
            </div>
          </div>
          <button onClick={() => onNavigate('products')} className="btn btn-danger btn-sm">
            View Low Stock
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid-cards" style={{ marginBottom: '24px' }}>
        {/* Today's Sales */}
        <div className="card card-hover" style={{ borderTop: '3px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500' }}>
            <span>Today's Sales</span>
            <span>🧾 {summary?.today_sales_count} bills</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#34d399', margin: '10px 0 4px 0' }}>
            {formatPKR(summary?.today_sales_amount)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cash & Credit sales today</div>
        </div>

        {/* Today's Purchases */}
        <div className="card card-hover" style={{ borderTop: '3px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500' }}>
            <span>Today's Purchases</span>
            <span>📦 {summary?.today_purchases_count} bills</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa', margin: '10px 0 4px 0' }}>
            {formatPKR(summary?.today_purchases_amount)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Stock bought from suppliers today</div>
        </div>

        {/* Total Receivables (Customer Outstanding) */}
        <div className="card card-hover" style={{ borderTop: '3px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500' }}>
            <span>Total Receivable</span>
            <span>👥 {summary?.total_customers} Customers</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fbbf24', margin: '10px 0 4px 0' }}>
            {formatPKR(summary?.total_receivable)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Customer credit to collect</div>
        </div>

        {/* Total Payables (Supplier Outstanding) */}
        <div className="card card-hover" style={{ borderTop: '3px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500' }}>
            <span>Total Payable</span>
            <span>🏭 {summary?.total_suppliers} Suppliers</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f87171', margin: '10px 0 4px 0' }}>
            {formatPKR(summary?.total_payable)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Payable dues to suppliers</div>
        </div>
      </div>

      {/* Stock Summary Section (Cement in Bags vs Steel in KG) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Cement Stock Card */}
        <div className="card" style={{ background: 'linear-gradient(145deg, #1e293b, #0f2744)', borderLeft: '4px solid #0ea5e9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>🧱</span>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#38bdf8' }}>Cement Stock</h3>
                <span className="badge badge-cement">Unit: Bag</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f8fafc' }}>
                {Number(summary?.cement_stock_bags || 0).toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#94a3b8' }}>Bags</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: '12.5px', color: '#94a3b8' }}>
            Total active cement stock available across all brands (Askari, Fauji, Bestway, Cherat, Lucky, etc.)
          </p>
        </div>

        {/* Steel Stock Card */}
        <div className="card" style={{ background: 'linear-gradient(145deg, #1e293b, #3b2812)', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>🏗️</span>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fbbf24' }}>Steel Stock</h3>
                <span className="badge badge-steel">Unit: KG</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f8fafc' }}>
                {Number(summary?.steel_stock_kg || 0).toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#94a3b8' }}>KG</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: '12.5px', color: '#94a3b8' }}>
            Total steel rebar & deformed steel stock available (Mughal, Amreli, Ittehad Grade 60/40, etc.)
          </p>
        </div>
      </div>

      {/* Two Column Layout: Recent Sales & Outstanding Ledgers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Recent Sales Invoices */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Recent Sales Bills</h3>
            <button onClick={() => onNavigate('sales')} className="btn btn-outline btn-sm">
              View All Bills
            </button>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary?.recent_sales?.length > 0 ? (
                  summary.recent_sales.map((sale) => (
                    <tr key={sale.id} style={{ cursor: 'pointer' }} onClick={() => onOpenReceipt(sale)}>
                      <td>
                        <strong>{sale.invoice_number}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(sale.sale_date)}</div>
                      </td>
                      <td>{sale.customer_name}</td>
                      <td><strong>{formatPKR(sale.total_amount)}</strong></td>
                      <td>{formatPKR(sale.paid_amount)}</td>
                      <td>
                        {sale.remaining_amount <= 0 ? (
                          <span className="badge badge-success">Paid</span>
                        ) : sale.paid_amount > 0 ? (
                          <span className="badge badge-warning">Partial</span>
                        ) : (
                          <span className="badge badge-danger">Unpaid</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No recent sales found. Create your first bill!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Outstanding Customers (Ledger Balances) */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Top Customer Balances (Receivables)</h3>
            <button onClick={() => onNavigate('customers')} className="btn btn-outline btn-sm">
              Customer Ledger
            </button>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Total Sales</th>
                  <th>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {summary?.top_outstanding_customers?.length > 0 ? (
                  summary.top_outstanding_customers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.customer_code}</div>
                      </td>
                      <td>{c.phone || '-'}</td>
                      <td>{formatPKR(c.total_sales)}</td>
                      <td style={{ color: '#fbbf24', fontWeight: 'bold' }}>{formatPKR(c.current_balance)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No outstanding customer balances.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
