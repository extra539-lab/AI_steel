import React, { useState, useEffect } from 'react'
import Sales from './pages/Sales'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Purchases from './pages/Purchases'
import Products from './pages/Products'
import Settings from './pages/Settings'
import ThermalReceipt from './components/ThermalReceipt'
import { getSettings, setApiBase } from './services/api'

export default function App() {
  const [currentPage, setCurrentPage] = useState('sales') // Default to Sales / POS for fast shop access!
  const [settings, setSettings] = useState(null)
  const [activeReceiptSale, setActiveReceiptSale] = useState(null)
  const [purchasesSupplierFilter, setPurchasesSupplierFilter] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString())

  useEffect(() => {
    ;(async () => {
      try {
        // If running inside Electron, ask main for the backend URL and configure API client
        if (window.electronAPI && window.electronAPI.getBackendUrl) {
          const backendRoot = await window.electronAPI.getBackendUrl()
          if (backendRoot) {
            setApiBase(backendRoot)
          }
        }

        const data = await getSettings()
        setSettings(data)
      } catch (err) {
        console.error('Failed to load settings:', err)
      }
    })()


    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const navItems = [
    { id: 'sales', label: 'New Bill (Bikri)', icon: '🧾' },
    { id: 'dashboard', label: 'Dashboard (Summary)', icon: '📊' },
    { id: 'customers', label: 'Customers (Khata)', icon: '👥' },
    { id: 'purchases', label: 'Purchases (Kharidari)', icon: '📦' },
    { id: 'products', label: 'Cement & Steel Stock', icon: '🧱' },
    { id: 'settings', label: 'Settings & Backup', icon: '⚙️' },
  ]

  const handleOpenReceipt = (sale) => {
    setActiveReceiptSale(sale)
  }

  const handleOpenPurchasesForSupplier = (supplierId) => {
    setPurchasesSupplierFilter(supplierId)
    setCurrentPage('purchases')
  }

  const handleCloseReceipt = () => {
    setActiveReceiptSale(null)
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'sales':
        return <Sales onOpenReceipt={handleOpenReceipt} />
      case 'dashboard':
        return <Dashboard onNavigate={(page) => setCurrentPage(page)} onOpenReceipt={handleOpenReceipt} />
      case 'customers':
        return <Customers />
      case 'purchases':
        return <Purchases preselectedSupplierId={purchasesSupplierFilter} />
      case 'products':
        return <Products />
      case 'settings':
        return <Settings onSettingsUpdated={(s) => setSettings(s)} />
       case 'suppliers':
         return <Suppliers onOpenPurchases={handleOpenPurchasesForSupplier} />
      default:
        return <Sales onOpenReceipt={handleOpenReceipt} />
    }
  }

  const businessName = settings?.business_name || 'A1 STEEL & CEMENT'

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar no-print">
        {/* Brand Header */}
        <div style={{ padding: '18px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.45)',
            }}
          >
            🏗️
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#f8fafc', lineHeight: '1.2' }}>
              {businessName}
            </div>
            <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px', fontWeight: '500' }}>
              Single-PC POS System
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '14px 0', overflowY: 'auto' }}>
          {navItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            >
              <span style={{ fontSize: '19px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border-color)', backgroundColor: '#060a12', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span style={{ color: '#34d399', fontWeight: '600' }}>Offline Ready (SQLite)</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Single PC Desktop v1.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>
              {navItems.find((n) => n.id === currentPage)?.icon}
            </span>
            <span style={{ fontWeight: 'bold', fontSize: '17px', color: 'var(--text-primary)' }}>
              {navItems.find((n) => n.id === currentPage)?.label}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🕒</span>
              <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>{currentTime}</span>
            </div>

            {currentPage !== 'sales' && (
              <button onClick={() => setCurrentPage('sales')} className="btn btn-primary btn-sm" style={{ fontWeight: 'bold' }}>
                🧾 + Naya Bill
              </button>
            )}
          </div>
        </header>

        {/* Body */}
        <div className="page-body">
          {renderPage()}
        </div>
      </main>

      {/* Thermal Receipt Modal */}
      {activeReceiptSale && (
        <ThermalReceipt
          sale={activeReceiptSale}
          settings={settings}
          onClose={handleCloseReceipt}
        />
      )}
    </div>
  )
}
