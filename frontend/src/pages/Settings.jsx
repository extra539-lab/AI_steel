import React, { useState, useEffect } from 'react'
import {
  getSettings,
  updateSettings,
  listBackups,
  createBackup,
  restoreBackup,
  getBackupHealth,
  getDatabaseIntegrity,
} from '../services/api'

export default function Settings({ onSettingsUpdated }) {
  const [settings, setSettings] = useState({
    business_name: 'A1 STEEL & CEMENT DEALER',
    tagline: 'Wholesale & Retail Cement & Steel Suppliers',
    phone: '0300-1234567 / 0312-9876543',
    address: 'Main G.T. Road, Pakistan',
    invoice_footer: 'Thank you for your business! Items once sold cannot be returned without receipt.',
    printer_type: '80mm',
    currency_symbol: 'Rs.',
  })
  const [backups, setBackups] = useState([])
  const [backupHealth, setBackupHealth] = useState(null)
  const [integrityReport, setIntegrityReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const [backupSuccess, setBackupSuccess] = useState('')
  const [backupError, setBackupError] = useState('')

  const fetchSettingsAndBackups = async () => {
    try {
      const [sData, bData, hData] = await Promise.all([
        getSettings(),
        listBackups(),
        getBackupHealth(),
      ])
      setSettings(sData)
      setBackups(bData || [])
      setBackupHealth(hData)
      if (onSettingsUpdated) onSettingsUpdated(sData)
    } catch (err) {
      console.error('Error fetching settings/backups:', err)
    }
  }

  useEffect(() => {
    fetchSettingsAndBackups()
  }, [])

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSaveSuccess('')
    try {
      setLoading(true)
      const updated = await updateSettings(settings)
      setSettings(updated)
      setSaveSuccess('Business profile and printer settings updated successfully!')
      if (onSettingsUpdated) onSettingsUpdated(updated)
      setTimeout(() => setSaveSuccess(''), 4000)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update settings')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async () => {
    setBackupSuccess('')
    setBackupError('')
    try {
      setLoading(true)
      const res = await createBackup()
      setBackupSuccess(`Verified backup created: ${res.filename} (${res.file_size_kb} KB)`)
      fetchSettingsAndBackups()
      setTimeout(() => setBackupSuccess(''), 4000)
    } catch (err) {
      setBackupError(err.response?.data?.detail || 'Failed to create backup.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenBackupFolder = async () => {
    try {
      if (window.electronAPI && window.electronAPI.openBackupFolder) {
        await window.electronAPI.openBackupFolder()
        return
      }
      alert('Backup folder access is only available in the packaged desktop app.')
    } catch (err) {
      console.error('Failed to open backup folder:', err)
    }
  }

  const handleExportBackup = async (filename) => {
    try {
      if (window.electronAPI && window.electronAPI.exportBackupFile) {
        const exportedTo = await window.electronAPI.exportBackupFile(filename)
        if (exportedTo) {
          setBackupSuccess(`Backup exported to: ${exportedTo}`)
          setTimeout(() => setBackupSuccess(''), 4000)
        }
        return
      }
      alert('Export is only available in the packaged desktop app.')
    } catch (err) {
      setBackupError(err.message || 'Failed to export backup.')
    }
  }

  const handleRestore = async (filename) => {
    if (window.confirm(`⚠️ CAUTION: Restoring from ${filename} will replace current database. An automatic safety backup will be created before restore. Continue?`)) {
      setBackupSuccess('')
      setBackupError('')
      try {
        setLoading(true)
        await restoreBackup(filename)
        setBackupSuccess(`Database successfully restored from ${filename}!`)
        fetchSettingsAndBackups()
      } catch (err) {
        setBackupError(err.response?.data?.detail || 'Failed to restore database.')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleRunIntegrityCheck = async () => {
    try {
      setLoading(true)
      const report = await getDatabaseIntegrity()
      setIntegrityReport(report)
    } catch (err) {
      alert('Failed to run integrity check.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Application Settings & Data Security</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Configure shop details, thermal receipt size, verified SQLite online backups, and data integrity audits
        </p>
      </div>

      {saveSuccess && (
        <div style={{ backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', color: '#6ee7b7', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          ✅ {saveSuccess}
        </div>
      )}

      {backupSuccess && (
        <div style={{ backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', color: '#6ee7b7', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          ✅ {backupSuccess}
        </div>
      )}

      {backupError && (
        <div style={{ backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', color: '#fca5a5', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          ❌ {backupError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Business & Printer Profile */}
        <div className="card">
          <h2 style={{ fontSize: '17px', fontWeight: 'bold', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            🏪 Shop & Receipt Profile
          </h2>

          <form onSubmit={handleSaveSettings}>
            <div className="form-group">
              <label className="form-label">Business / Shop Name *</label>
              <input
                type="text"
                required
                value={settings.business_name || ''}
                onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                className="form-control"
                placeholder="e.g. A1 STEEL & CEMENT DEALER"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tagline / Subtitle</label>
              <input
                type="text"
                value={settings.tagline || ''}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="form-control"
                placeholder="e.g. Wholesale & Retail Cement & Steel Suppliers"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Phone Numbers</label>
              <input
                type="text"
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="form-control"
                placeholder="e.g. 0300-1234567 / 0312-9876543"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Shop / Yard Address</label>
              <input
                type="text"
                value={settings.address || ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="form-control"
                placeholder="e.g. Main G.T. Road, Pakistan"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Thermal Receipt Paper Width</label>
              <select
                value={settings.printer_type || '80mm'}
                onChange={(e) => setSettings({ ...settings, printer_type: e.target.value })}
                className="form-control"
              >
                <option value="80mm">80mm (Standard POS Thermal Printer)</option>
                <option value="58mm">58mm (Compact POS Thermal Printer)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Invoice Footer Message</label>
              <textarea
                rows="2"
                value={settings.invoice_footer || ''}
                onChange={(e) => setSettings({ ...settings, invoice_footer: e.target.value })}
                className="form-control"
                placeholder="Thank you for your business!..."
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              {loading ? 'Saving...' : '💾 Save Settings'}
            </button>
          </form>
        </div>

        {/* Right Column: Database Backups & Integrity Audit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 'bold' }}>
                🛡️ Verified Online Backups
              </h2>
              {backupHealth && (
                <span className={`badge ${backupHealth.status === 'HEALTHY' ? 'badge-success' : 'badge-warning'}`}>
                  {backupHealth.status}
                </span>
              )}
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              SQLite Online Backup Engine creates 100% verified, consistent snapshots while the system is actively running.
            </p>

            <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
              <button onClick={handleCreateBackup} disabled={loading} className="btn btn-success" style={{ width: '100%' }}>
                ➕ Create Verified Backup Now (.db)
              </button>
              <button onClick={handleOpenBackupFolder} className="btn btn-outline" style={{ width: '100%' }}>
                📁 Open Backup Folder
              </button>
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>
              Available Local Backups ({backups.length})
            </h3>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Backup File</th>
                    <th>Size</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length > 0 ? (
                    backups.map((b, idx) => (
                      <tr key={idx}>
                        <td><strong style={{ fontSize: '12px' }}>{b.filename}</strong></td>
                        <td>{b.file_size_kb} KB</td>
                        <td>{b.created_at}</td>
                        <td>
                          {b.is_verified ? (
                            <span className="badge badge-success">Verified</span>
                          ) : (
                            <span className="badge badge-warning">Unverified</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleRestore(b.filename)}
                              className="btn btn-outline btn-sm"
                              title="Restore Database"
                            >
                              ↩️ Restore
                            </button>
                            <button
                              onClick={() => handleExportBackup(b.filename)}
                              className="btn btn-outline btn-sm"
                              title="Export Backup"
                            >
                              ⤴️ Export
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>
                        No backups created yet. Click above to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Database Integrity & Financial Audit Card */}
          <div className="card" style={{ borderLeft: '4px solid #38bdf8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold' }}>
                🔍 Financial & Database Audit
              </h3>
              <button
                type="button"
                onClick={handleRunIntegrityCheck}
                disabled={loading}
                className="btn btn-outline btn-sm"
              >
                Run Audit Now
              </button>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Performs SQLite integrity checks, foreign key validation, customer/supplier ledger balances, and inventory reconciliation.
            </p>

            {integrityReport && (
              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  fontSize: '12.5px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Audit Status:</span>
                  <span style={{ fontWeight: 'bold', color: integrityReport.status === 'HEALTHY' ? '#34d399' : '#f87171' }}>
                    {integrityReport.status}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>SQLite PRAGMA Check:</span>
                  <span>{integrityReport.sqlite_integrity}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Foreign Keys:</span>
                  <span>{integrityReport.foreign_keys_status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Ledger Discrepancies:</span>
                  <span>{integrityReport.customer_ledger_discrepancies + integrityReport.supplier_ledger_discrepancies}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Inventory Discrepancies:</span>
                  <span>{integrityReport.inventory_discrepancies}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
