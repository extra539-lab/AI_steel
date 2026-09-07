import axios from 'axios'

const DEFAULT_API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8005/api'

const api = axios.create({
  baseURL: DEFAULT_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const setApiBase = (base) => {
  if (base) api.defaults.baseURL = base
}

// Format currency helper
export const formatPKR = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Rs. 0'
  return `Rs. ${Number(amount).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`
}

// Format date helper
export const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// --- Dashboard ---
export const getDashboardSummary = () => api.get('/dashboard/summary').then((res) => res.data)

// --- Products ---
export const listProducts = (params) => api.get('/products/', { params }).then((res) => res.data)
export const getProduct = (id) => api.get(`/products/${id}`).then((res) => res.data)
export const createProduct = (data) => api.post('/products/', data).then((res) => res.data)
export const updateProduct = (id, data) => api.put(`/products/${id}`, data).then((res) => res.data)
export const deleteProduct = (id) => api.delete(`/products/${id}`).then((res) => res.data)
export const adjustStock = (id, data) => api.post(`/products/${id}/adjust-stock`, data).then((res) => res.data)

// --- Suppliers ---
export const listSuppliers = (params) => api.get('/suppliers/', { params }).then((res) => res.data)
export const getSupplier = (id) => api.get(`/suppliers/${id}`).then((res) => res.data)
export const createSupplier = (data) => api.post('/suppliers/', data).then((res) => res.data)
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data).then((res) => res.data)
export const deleteSupplier = (id) => api.delete(`/suppliers/${id}`).then((res) => res.data)
export const getSupplierLedger = (id) => api.get(`/suppliers/${id}/ledger`).then((res) => res.data)

// --- Customers ---
export const listCustomers = (params) => api.get('/customers/', { params }).then((res) => res.data)
export const getCustomer = (id) => api.get(`/customers/${id}`).then((res) => res.data)
export const createCustomer = (data) => api.post('/customers/', data).then((res) => res.data)
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data).then((res) => res.data)
export const deleteCustomer = (id) => api.delete(`/customers/${id}`).then((res) => res.data)
export const getCustomerLedger = (id) => api.get(`/customers/${id}/ledger`).then((res) => res.data)

// --- Purchases ---
export const listPurchases = (params) => api.get('/purchases/', { params }).then((res) => res.data)
export const getPurchase = (id) => api.get(`/purchases/${id}`).then((res) => res.data)
export const createPurchase = (data) => api.post('/purchases/', data).then((res) => res.data)
export const voidPurchase = (id, data) => api.post(`/purchases/${id}/void`, data).then((res) => res.data)

// --- Sales ---
export const listSales = (params) => api.get('/sales/', { params }).then((res) => res.data)
export const getSale = (id) => api.get(`/sales/${id}`).then((res) => res.data)
export const createSale = (data) => api.post('/sales/', data).then((res) => res.data)
export const voidSale = (id, data) => api.post(`/sales/${id}/void`, data).then((res) => res.data)

// --- Payments ---
export const listCustomerPayments = (params) => api.get('/payments/customers', { params }).then((res) => res.data)
export const createCustomerPayment = (data) => api.post('/payments/customers', data).then((res) => res.data)
export const voidCustomerPayment = (id, data) => api.post(`/payments/customers/${id}/void`, data).then((res) => res.data)
export const listSupplierPayments = (params) => api.get('/payments/suppliers', { params }).then((res) => res.data)
export const createSupplierPayment = (data) => api.post('/payments/suppliers', data).then((res) => res.data)
export const voidSupplierPayment = (id, data) => api.post(`/payments/suppliers/${id}/void`, data).then((res) => res.data)

// --- Inventory ---
export const listInventoryTransactions = (params) => api.get('/inventory/transactions', { params }).then((res) => res.data)
export const getStockSummary = (params) => api.get('/inventory/summary', { params }).then((res) => res.data)
export const getInventoryReconciliation = () => api.get('/inventory/reconciliation').then((res) => res.data)
export const getProductHistory = (id, params) => api.get(`/inventory/product/${id}/history`, { params }).then((res) => res.data)

// --- Reports ---
export const getSalesReport = (params) => api.get('/reports/sales', { params }).then((res) => res.data)
export const getPurchasesReport = (params) => api.get('/reports/purchases', { params }).then((res) => res.data)
export const getInventoryReport = (params) => api.get('/reports/inventory', { params }).then((res) => res.data)
export const getProfitReport = (params) => api.get('/reports/profit', { params }).then((res) => res.data)

// --- Settings & Audit ---
export const getSettings = () => api.get('/settings/').then((res) => res.data)
export const updateSettings = (data) => api.put('/settings/', data).then((res) => res.data)
export const getDatabaseIntegrity = () => api.get('/settings/integrity-check').then((res) => res.data)

// --- Backup ---
export const getBackupHealth = () => api.get('/backup/health').then((res) => res.data)
export const listBackups = () => api.get('/backup/list').then((res) => res.data)
export const createBackup = () => api.post('/backup/create').then((res) => res.data)
export const restoreBackup = (filename) => api.post('/backup/restore', { filename }).then((res) => res.data)

export default api
