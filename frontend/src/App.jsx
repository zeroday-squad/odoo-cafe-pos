/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const DEFAULT_SITE = {
  appName: 'Odoo Cafe POS',
  brandName: 'Cafe POS',
  tagline: 'Run every table, ticket, and payment from one fast cafe console.',
  loginHeadline: 'One screen for cafe orders, kitchen flow, and payments.',
  demoAccounts: [],
}

function money(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`
}

function stageLabel(stage) {
  return {
    to_cook: 'To Cook',
    preparing: 'Preparing',
    completed: 'Completed',
  }[stage] || stage
}

function tableOrderLabel(order) {
  if (!order) return ''
  if (order.kitchenTicket?.stage === 'completed') return `Ready to pay ${money(order.total)}`
  if (order.kitchenTicket?.stage) return `${stageLabel(order.kitchenTicket.stage)} ${money(order.total)}`
  return `${order.status} ${money(order.total)}`
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('cafe_token') || '')
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('cafe_user')
    return saved ? JSON.parse(saved) : null
  })
  const [view, setView] = useState(token ? 'session' : 'auth')
  const [message, setMessage] = useState('')
  const [site, setSite] = useState(DEFAULT_SITE)

  useEffect(() => {
    fetch(`${API_URL}/api/public/site`)
      .then((res) => res.json())
      .then((data) => setSite({ ...DEFAULT_SITE, ...data }))
      .catch(() => setSite(DEFAULT_SITE))
  }, [])

  function handleLogin(payload) {
    localStorage.setItem('cafe_token', payload.token)
    localStorage.setItem('cafe_user', JSON.stringify(payload.user))
    setToken(payload.token)
    setUser(payload.user)
    setView('session')
  }

  function logout() {
    localStorage.removeItem('cafe_token')
    localStorage.removeItem('cafe_user')
    setToken('')
    setUser(null)
    setView('auth')
  }

  async function api(path, options = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || 'Request failed')
    return data
  }

  if (!token || view === 'auth') {
    return <AuthScreen onLogin={handleLogin} setMessage={setMessage} message={message} site={site} />
  }

  return (
    <Shell user={user} view={view} setView={setView} logout={logout} message={message} site={site}>
      {view === 'session' && <SessionScreen api={api} setView={setView} setMessage={setMessage} site={site} />}
      {view === 'pos' && <PosTerminal api={api} user={user} setView={setView} setMessage={setMessage} site={site} />}
      {view === 'orders' && <OrdersScreen api={api} setView={setView} site={site} />}
      {view === 'customers' && <CustomersScreen api={api} site={site} />}
      {view === 'admin' && <AdminScreen api={api} site={site} />}
      {view === 'kds' && <KitchenScreen api={api} token={token} site={site} />}
      {view === 'reports' && <ReportsScreen api={api} site={site} />}
    </Shell>
  )
}

function PageTitle({ title, kicker, site = DEFAULT_SITE }) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{kicker || site.appName}</p>
        <h1>{title}</h1>
        <p className="tagline">{site.tagline}</p>
      </div>
    </div>
  )
}

function AuthScreen({ onLogin, setMessage, message, site }) {
  const [mode, setMode] = useState('login')
  const primaryDemo = site.demoAccounts[0]
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  useEffect(() => {
    if (!form.email && primaryDemo) {
      setForm((current) => ({
        ...current,
        email: primaryDemo.email,
      }))
    }
  }, [primaryDemo])

  async function submit(event) {
    event.preventDefault()
    const path = mode === 'login' ? '/api/auth/login' : '/api/auth/signup'
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      onLogin(data)
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="flip-stage" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <p className="eyebrow">{site.appName}</p>
        <h1>{site.loginHeadline}</h1>
        <p>{site.tagline}</p>
        {!!site.demoAccounts.length && (
          <div className="demo-logins">
            {site.demoAccounts.map((account) => (
              <button
                type="button"
                key={account.email}
                onClick={() => setForm({ ...form, email: account.email })}
              >
                {account.role}: {account.email}
              </button>
            ))}
          </div>
        )}
      </section>
      <form className="auth-card" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Signup</button>
        </div>
        {mode === 'signup' && (
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        )}
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        {message && <p className="error">{message}</p>}
        <button className="primary" type="submit">{mode === 'login' ? 'Login' : 'Create Account'}</button>
      </form>
    </main>
  )
}

function Shell({ user, view, setView, logout, children, message, site }) {
  const nav = [
    ['session', 'Session'],
    ['pos', 'POS Order'],
    ['orders', 'Orders'],
    ['customers', 'Customer'],
    ['admin', 'Admin'],
    ['kds', 'KDS'],
    ['reports', 'Reports'],
  ]
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>{site.brandName}</strong>
          <span>{site.tagline}</span>
        </div>
        <nav>
          {nav.map(([key, label]) => (
            <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}</button>
          ))}
        </nav>
        <div className="user-box">
          <strong>{user?.name}</strong>
          <span>{user?.role}</span>
          <button onClick={logout}>Log Out</button>
        </div>
      </aside>
      <main className="workspace">
        {message && <div className="notice">{message}</div>}
        {children}
      </main>
    </div>
  )
}

function SessionScreen({ api, setView, setMessage, site }) {
  const [session, setSession] = useState(null)
  const [summary, setSummary] = useState(null)

  async function openSession() {
    const data = await api('/api/sessions/open')
    setSession(data)
    setMessage('Session opened. Select POS Order to start billing.')
    setView('pos')
  }

  async function closeSession() {
    if (!session) return
    const data = await api(`/api/sessions/${session.id}/close`, {
      method: 'POST',
      body: JSON.stringify({ closingCash: 0 }),
    })
    setSummary(data)
    setSession(null)
  }

  useEffect(() => {
    api('/api/bootstrap').then((data) => setSession(data.openSession)).catch(() => {})
  }, [])

  return (
    <>
      <PageTitle title="Open today's cafe counter" kicker="POS Session" site={site} />
      <section className="metric-grid">
        <div className="metric"><span>Session</span><strong>{session ? 'Open' : 'Ready'}</strong></div>
        <div className="metric"><span>Last opened</span><strong>{session ? new Date(session.openedAt).toLocaleString() : 'No active session'}</strong></div>
        <div className="metric"><span>Closing sales</span><strong>{summary ? money(summary.closingSales) : money(session?.closingSales)}</strong></div>
      </section>
      <div className="action-row">
        <button className="primary" onClick={openSession}>Open Session</button>
        <button onClick={closeSession} disabled={!session}>Close Session</button>
      </div>
      {summary && <div className="panel"><h2>Closing Summary</h2><p>{summary.totalOrders} paid orders, {money(summary.closingSales)} total sales.</p></div>}
    </>
  )
}

function PosTerminal({ api, setMessage, site }) {
  const [data, setData] = useState(null)
  const [session, setSession] = useState(null)
  const [selectedTable, setSelectedTable] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [couponCode, setCouponCode] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [order, setOrder] = useState(null)
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [reference, setReference] = useState('')

  async function refresh() {
    const boot = await api('/api/bootstrap')
    const open = boot.openSession || await api('/api/sessions/open')
    setData(boot)
    setSession(open)
    setPaymentMethodId(boot.paymentMethods.find((m) => m.enabled)?.id || '')
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message))
  }, [])

  function loadOrderIntoCart(savedOrder) {
    setOrder(savedOrder)
    setCustomerId(savedOrder.customerId ? String(savedOrder.customerId) : '')
    setCouponCode(savedOrder.couponCode || '')
    setCashReceived('')
    setReference('')
    setCart(savedOrder.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: item.unitPrice,
      tax: item.product?.tax || item.tax || 0,
      quantity: item.quantity,
      color: item.product?.category?.color || '#3157ff',
    })))
  }

  async function selectTable(table) {
    setSelectedTable(table)
    localStorage.setItem('cafe_current_table_id', String(table.id))
    const activeOrder = table.orders?.[0]
    if (!activeOrder) {
      setOrder(null)
      setCart([])
      setCouponCode('')
      setCustomerId('')
      return
    }

    const orders = await api('/api/orders')
    const savedOrder = orders.find((item) => item.id === activeOrder.id)
    if (savedOrder) {
      loadOrderIntoCart(savedOrder)
      setMessage(`Loaded ${savedOrder.orderNumber} for table ${table.number}.`)
    }
  }

  useEffect(() => {
    if (!data || selectedTable) return
    const tableId = localStorage.getItem('cafe_current_table_id')
    if (!tableId) return
    const savedTable = data.floors.flatMap((floor) => floor.tables).find((table) => String(table.id) === tableId)
    if (savedTable) {
      selectTable(savedTable).catch(() => {})
    }
  }, [data, selectedTable])

  const products = useMemo(() => {
    if (!data) return []
    return data.products.filter((product) => {
      const categoryOk = selectedCategory === 'all' || product.categoryId === Number(selectedCategory)
      const searchOk = product.name.toLowerCase().includes(search.toLowerCase())
      return product.active && categoryOk && searchOk
    })
  }, [data, selectedCategory, search])

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const tax = cart.reduce((sum, item) => sum + item.price * item.quantity * ((item.tax || 0) / 100), 0)
    return { subtotal, tax, total: subtotal + tax }
  }, [cart])

  function addProduct(product) {
    setCart((items) => {
      const existing = items.find((item) => item.productId === product.id)
      if (existing) {
        return items.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...items, { productId: product.id, name: product.name, price: product.price, tax: product.tax, quantity: 1, color: product.category.color }]
    })
  }

  function updateQty(productId, delta) {
    setCart((items) => items
      .map((item) => item.productId === productId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)
      .filter((item) => item.quantity > 0))
  }

  async function saveOrder() {
    if (!selectedTable) return setMessage('Select a table first.')
    if (!cart.length) return setMessage('Add products to cart.')
    const payload = {
      tableId: selectedTable.id,
      customerId: customerId || null,
      sessionId: session?.id,
      couponCode,
      items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    }
    const saved = order
      ? await api(`/api/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : await api('/api/orders', { method: 'POST', body: JSON.stringify(payload) })
    setOrder(saved)
    await refresh()
    setMessage(`Order ${saved.orderNumber} saved.`)
    return saved
  }

  async function sendToKitchen() {
    const saved = order || await saveOrder()
    if (!saved) return
    await api(`/api/orders/${saved.id}/send-to-kitchen`, { method: 'POST' })
    await refresh()
    setMessage('Order sent to Kitchen Display.')
  }

  async function payOrder() {
    const saved = order || await saveOrder()
    if (!saved) return
    const paid = await api(`/api/orders/${saved.id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethodId, receivedAmount: cashReceived, reference }),
    })
    setOrder(paid)
    setCart([])
    setCouponCode('')
    setCustomerId('')
    localStorage.removeItem('cafe_current_table_id')
    await refresh()
    setMessage(`Payment completed for ${paid.orderNumber}.`)
  }

  async function cancelOrder() {
    if (!order) return setMessage('Select an active table order first.')
    await api(`/api/orders/${order.id}/cancel`, { method: 'POST' })
    setOrder(null)
    setCart([])
    setCouponCode('')
    setCustomerId('')
    setCashReceived('')
    setReference('')
    localStorage.removeItem('cafe_current_table_id')
    await refresh()
    setMessage('Order cancelled and table is free.')
  }

  if (!data) return <PageTitle title="Loading POS terminal" site={site} />
  const enabledMethods = data.paymentMethods.filter((method) => method.enabled)
  const selectedMethod = enabledMethods.find((method) => method.id === Number(paymentMethodId))

  return (
    <>
      <PageTitle title="Take orders at table speed" kicker="POS Terminal" site={site} />
      <div className="pos-layout">
        <section className="panel floor-panel">
          <div className="panel-heading">
            <h2>Table View</h2>
            <button type="button" onClick={refresh}>Refresh</button>
          </div>
          {data.floors.map((floor) => (
            <div key={floor.id} className="floor-block">
              <strong>{floor.name}</strong>
              <div className="table-grid">
                {floor.tables.map((table) => {
                  const activeOrder = table.orders?.[0]
                  const className = [
                    'table-card',
                    selectedTable?.id === table.id ? 'active' : '',
                    activeOrder ? 'occupied' : '',
                  ].filter(Boolean).join(' ')
                  return (
                  <button key={table.id} className={className} onClick={() => selectTable(table)}>
                    <span>{table.number}</span>
                    <small>{table.seats} seats</small>
                    {activeOrder && <em>{tableOrderLabel(activeOrder)}</em>}
                  </button>
                )})}
              </div>
            </div>
          ))}
        </section>
        <section className="panel product-panel">
          <div className="toolbar">
            <input placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="current-table">{selectedTable ? `Table ${selectedTable.number}` : 'No table'}</span>
          </div>
          <div className="tabs">
            <button className={selectedCategory === 'all' ? 'active' : ''} onClick={() => setSelectedCategory('all')}>All</button>
            {data.categories.map((category) => (
              <button key={category.id} className={selectedCategory === String(category.id) ? 'active' : ''} style={{ borderColor: category.color }} onClick={() => setSelectedCategory(String(category.id))}>{category.name}</button>
            ))}
          </div>
          <div className="product-grid">
            {products.map((product) => (
              <button key={product.id} className="product-card" onClick={() => addProduct(product)} style={{ borderTopColor: product.category.color }}>
                <strong>{product.name}</strong>
                <span>{product.category.name}</span>
                <b>{money(product.price)}</b>
              </button>
            ))}
          </div>
        </section>
        <section className="panel cart-panel">
          <h2>Cart & Payment</h2>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Walk-in customer</option>
            {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
          <div className="cart-list">
            {cart.map((item) => (
              <div className="cart-item" key={item.productId}>
                <span style={{ borderLeftColor: item.color }}>{item.name}</span>
                <div>
                  <button onClick={() => updateQty(item.productId, -1)}>-</button>
                  <strong>{item.quantity}</strong>
                  <button onClick={() => updateQty(item.productId, 1)}>+</button>
                </div>
                <b>{money(item.price * item.quantity)}</b>
              </div>
            ))}
          </div>
          <div className="coupon-row">
            <input placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} />
            <button onClick={saveOrder}>Apply</button>
          </div>
          <div className="summary">
            <span>Subtotal <b>{money(totals.subtotal)}</b></span>
            <span>Tax <b>{money(totals.tax)}</b></span>
            {order && <span>Discount <b>{money(order.discount)}</b></span>}
            <strong>Total <b>{money(order?.total || totals.total)}</b></strong>
          </div>
          <div className="action-row stack">
            <button onClick={saveOrder}>Save Draft</button>
            <button onClick={sendToKitchen}>Send to Kitchen</button>
          </div>
          {order && order.status !== 'paid' && (
            <button className="danger" onClick={cancelOrder}>Cancel Order / Free Table</button>
          )}
          <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
            {enabledMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
          </select>
          {selectedMethod?.type === 'cash' && <input placeholder="Cash received" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} />}
          {selectedMethod?.type === 'card' && <input placeholder="Transaction reference" value={reference} onChange={(e) => setReference(e.target.value)} />}
          {selectedMethod?.type === 'upi' && <div className="upi-box"><strong>UPI QR</strong><span>{selectedMethod.upiId}</span><small>Show this QR placeholder and confirm after payment.</small></div>}
          <button className="primary" onClick={payOrder}>Complete Payment</button>
          {order && <Receipt order={order} />}
        </section>
      </div>
    </>
  )
}

function Receipt({ order }) {
  const customerName = order.customer?.name || 'Walk-in Customer'
  const tableName = order.table ? `${order.table.floor?.name || 'Floor'} / Table ${order.table.number}` : 'Takeaway'

  return (
    <div className="receipt">
      <div className="receipt-head">
        <div>
          <strong>Cafe POS Invoice</strong>
          <span>{order.orderNumber}</span>
        </div>
        <em>{order.status}</em>
      </div>
      <div className="receipt-meta">
        <span><b>Customer</b>{customerName}</span>
        <span><b>Table</b>{tableName}</span>
        <span><b>Date</b>{new Date(order.createdAt).toLocaleString()}</span>
      </div>
      <div className="receipt-items">
        {order.items?.map((item) => (
          <div key={item.id || item.productId}>
            <span>{item.name}</span>
            <small>{item.quantity} x {money(item.unitPrice)}</small>
            <b>{money(item.lineTotal || item.unitPrice * item.quantity)}</b>
          </div>
        ))}
      </div>
      <div className="receipt-total">
        <span>Subtotal <b>{money(order.subtotal)}</b></span>
        <span>Tax <b>{money(order.tax)}</b></span>
        <span>Discount <b>{money(order.discount)}</b></span>
        <strong>Total <b>{money(order.total)}</b></strong>
      </div>
      <div className="receipt-actions">
        <button onClick={() => window.print()}>Print Receipt</button>
        <button onClick={() => alert('Email receipt mocked for hackathon demo.')}>Send Email</button>
      </div>
    </div>
  )
}

function OrdersScreen({ api, setView, site }) {
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    api('/api/orders').then(setOrders).catch(() => {})
  }, [])

  const filtered = orders.filter((order) => {
    const haystack = `${order.orderNumber} ${order.customer?.name || ''} ${order.status}`.toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  return (
    <>
      <PageTitle title="Review every order in the shift" kicker="Orders" site={site} />
      <div className="panel">
        <input placeholder="Search by customer, order number, or status" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="data-list">
          {filtered.map((order) => (
            <div key={order.id} className="data-row">
              <strong>{order.orderNumber}</strong>
              <span>{order.customer?.name || 'Walk-in'}</span>
              <span>{new Date(order.createdAt).toLocaleString()}</span>
              <b>{money(order.total)}</b>
              <em>{order.status}</em>
              {order.status === 'draft' && <button onClick={() => setView('pos')}>Edit Order</button>}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function CustomersScreen({ api, site }) {
  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({ name: '', email: '', phone: '' })

  async function load() {
    setCustomers(await api('/api/customers'))
  }

  async function create(event) {
    event.preventDefault()
    await api('/api/customers', { method: 'POST', body: JSON.stringify(form) })
    setForm({ name: '', email: '', phone: '' })
    load()
  }

  useEffect(() => { load().catch(() => {}) }, [])

  return (
    <>
      <PageTitle title="Know every regular before checkout" kicker="Customers" site={site} />
      <div className="two-column">
        <form className="panel form-grid" onSubmit={create}>
          <h2>Create Customer</h2>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <button className="primary">Create</button>
        </form>
        <div className="panel data-list">
          {customers.map((customer) => (
            <div className="data-row" key={customer.id}>
              <strong>{customer.name}</strong>
              <span>{customer.email || 'No email'}</span>
              <span>{customer.phone || 'No phone'}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function AdminScreen({ api, site }) {
  const [data, setData] = useState(null)
  const [users, setUsers] = useState([])
  const [product, setProduct] = useState({ name: '', categoryId: '', price: '', unit: 'piece', tax: 5, description: '' })
  const [category, setCategory] = useState({ name: '', color: '#2563eb' })
  const [floor, setFloor] = useState({ name: '' })
  const [table, setTable] = useState({ floorId: '', number: '', seats: 2, active: true })
  const [coupon, setCoupon] = useState({ code: '', discountType: 'percentage', discountValue: 10, active: true })
  const [promotion, setPromotion] = useState({ name: '', scope: 'order', productId: '', minQuantity: 2, minOrderAmount: 500, discountType: 'fixed', discountValue: 50, active: true })
  const [employee, setEmployee] = useState({ name: '', email: '', password: '', role: 'employee' })

  async function load() {
    const [bootstrap, accounts] = await Promise.all([
      api('/api/bootstrap'),
      api('/api/users').catch(() => []),
    ])
    setData(bootstrap)
    setUsers(accounts)
  }

  async function createCategory(event) {
    event.preventDefault()
    await api('/api/categories', { method: 'POST', body: JSON.stringify(category) })
    setCategory({ name: '', color: '#2563eb' })
    load()
  }

  async function createProduct(event) {
    event.preventDefault()
    await api('/api/products', { method: 'POST', body: JSON.stringify(product) })
    setProduct({ name: '', categoryId: product.categoryId, price: '', unit: 'piece', tax: 5, description: '' })
    load()
  }

  async function togglePayment(method) {
    await api(`/api/payment-methods/${method.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !method.enabled }) })
    load()
  }

  async function createFloor(event) {
    event.preventDefault()
    await api('/api/floors', { method: 'POST', body: JSON.stringify(floor) })
    setFloor({ name: '' })
    load()
  }

  async function createTable(event) {
    event.preventDefault()
    await api('/api/tables', { method: 'POST', body: JSON.stringify(table) })
    setTable({ floorId: table.floorId, number: '', seats: 2, active: true })
    load()
  }

  async function createCoupon(event) {
    event.preventDefault()
    await api('/api/coupons', { method: 'POST', body: JSON.stringify({ ...coupon, code: coupon.code.toUpperCase(), discountValue: Number(coupon.discountValue) }) })
    setCoupon({ code: '', discountType: 'percentage', discountValue: 10, active: true })
    load()
  }

  async function createPromotion(event) {
    event.preventDefault()
    const payload = {
      ...promotion,
      productId: promotion.scope === 'product' ? Number(promotion.productId) : null,
      minQuantity: promotion.scope === 'product' ? Number(promotion.minQuantity) : null,
      minOrderAmount: promotion.scope === 'order' ? Number(promotion.minOrderAmount) : null,
      discountValue: Number(promotion.discountValue),
    }
    await api('/api/promotions', { method: 'POST', body: JSON.stringify(payload) })
    setPromotion({ name: '', scope: 'order', productId: '', minQuantity: 2, minOrderAmount: 500, discountType: 'fixed', discountValue: 50, active: true })
    load()
  }

  async function createEmployee(event) {
    event.preventDefault()
    await api('/api/users', { method: 'POST', body: JSON.stringify(employee) })
    setEmployee({ name: '', email: '', password: '', role: 'employee' })
    load()
  }

  async function archiveUser(user) {
    await api(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ status: !user.status }) })
    load()
  }

  useEffect(() => { load().catch(() => {}) }, [])
  if (!data) return <PageTitle title="Loading admin setup" site={site} />

  return (
    <>
      <PageTitle title="Configure the cafe before service starts" kicker="Admin Backend" site={site} />
      <section className="coverage-strip">
        {['Products', 'Category', 'Payment Method', 'Coupon & Promotion', 'Booking', 'User/Employee', 'KDS', 'Reports'].map((item) => (
          <span key={item}>{item}</span>
        ))}
      </section>
      <div className="admin-grid">
        <form className="panel form-grid" onSubmit={createCategory}>
          <h2>Category</h2>
          <input placeholder="Category name" value={category.name} onChange={(e) => setCategory({ ...category, name: e.target.value })} required />
          <input type="color" value={category.color} onChange={(e) => setCategory({ ...category, color: e.target.value })} />
          <button>Create Category</button>
        </form>
        <form className="panel form-grid" onSubmit={createProduct}>
          <h2>Product</h2>
          <input placeholder="Product name" value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} required />
          <select value={product.categoryId} onChange={(e) => setProduct({ ...product, categoryId: e.target.value })} required>
            <option value="">Select category</option>
            {data.categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
          <input placeholder="Price" value={product.price} onChange={(e) => setProduct({ ...product, price: e.target.value })} required />
          <input placeholder="Unit" value={product.unit} onChange={(e) => setProduct({ ...product, unit: e.target.value })} />
          <input placeholder="Tax %" value={product.tax} onChange={(e) => setProduct({ ...product, tax: e.target.value })} />
          <button className="primary">Create Product</button>
        </form>
        <div className="panel">
          <h2>Payment Methods</h2>
          {data.paymentMethods.map((method) => (
            <div className="toggle-row" key={method.id}>
              <span>{method.name}</span>
              <button className={method.enabled ? 'success' : ''} onClick={() => togglePayment(method)}>{method.enabled ? 'Enabled' : 'Disabled'}</button>
            </div>
          ))}
        </div>
        <div className="panel data-list">
          <h2>Products</h2>
          {data.products.map((item) => (
            <div className="data-row" key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.category.name}</span>
              <b>{money(item.price)}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="admin-grid expanded">
        <form className="panel form-grid" onSubmit={createFloor}>
          <h2>Floor Plan</h2>
          <input placeholder="Floor name" value={floor.name} onChange={(e) => setFloor({ name: e.target.value })} required />
          <button>Create Floor</button>
          <div className="mini-list">
            {data.floors.map((item) => <span key={item.id}>{item.name} · {item.tables.length} tables</span>)}
          </div>
        </form>
        <form className="panel form-grid" onSubmit={createTable}>
          <h2>Table Management</h2>
          <select value={table.floorId} onChange={(e) => setTable({ ...table, floorId: e.target.value })} required>
            <option value="">Select floor</option>
            {data.floors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input placeholder="Table number" value={table.number} onChange={(e) => setTable({ ...table, number: e.target.value })} required />
          <input placeholder="Seats" value={table.seats} onChange={(e) => setTable({ ...table, seats: e.target.value })} required />
          <button className="primary">Add Table</button>
        </form>
        <form className="panel form-grid" onSubmit={createCoupon}>
          <h2>Coupon Code</h2>
          <input placeholder="Code e.g. CAFE10" value={coupon.code} onChange={(e) => setCoupon({ ...coupon, code: e.target.value })} required />
          <select value={coupon.discountType} onChange={(e) => setCoupon({ ...coupon, discountType: e.target.value })}>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed Amount</option>
          </select>
          <input placeholder="Discount value" value={coupon.discountValue} onChange={(e) => setCoupon({ ...coupon, discountValue: e.target.value })} required />
          <button>Create Coupon</button>
        </form>
        <form className="panel form-grid" onSubmit={createPromotion}>
          <h2>Automated Promotion</h2>
          <input placeholder="Promotion name" value={promotion.name} onChange={(e) => setPromotion({ ...promotion, name: e.target.value })} required />
          <select value={promotion.scope} onChange={(e) => setPromotion({ ...promotion, scope: e.target.value })}>
            <option value="order">Order Amount</option>
            <option value="product">Product Quantity</option>
          </select>
          {promotion.scope === 'product' ? (
            <>
              <select value={promotion.productId} onChange={(e) => setPromotion({ ...promotion, productId: e.target.value })} required>
                <option value="">Select product</option>
                {data.products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <input placeholder="Minimum quantity" value={promotion.minQuantity} onChange={(e) => setPromotion({ ...promotion, minQuantity: e.target.value })} />
            </>
          ) : (
            <input placeholder="Minimum order amount" value={promotion.minOrderAmount} onChange={(e) => setPromotion({ ...promotion, minOrderAmount: e.target.value })} />
          )}
          <select value={promotion.discountType} onChange={(e) => setPromotion({ ...promotion, discountType: e.target.value })}>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed Amount</option>
          </select>
          <input placeholder="Discount value" value={promotion.discountValue} onChange={(e) => setPromotion({ ...promotion, discountValue: e.target.value })} />
          <button className="primary">Create Promotion</button>
        </form>
      </div>
      <div className="two-column">
        <form className="panel form-grid" onSubmit={createEmployee}>
          <h2>User / Employee</h2>
          <input placeholder="Name" value={employee.name} onChange={(e) => setEmployee({ ...employee, name: e.target.value })} required />
          <input placeholder="Email" value={employee.email} onChange={(e) => setEmployee({ ...employee, email: e.target.value })} required />
          <input placeholder="Password" type="password" value={employee.password} onChange={(e) => setEmployee({ ...employee, password: e.target.value })} required />
          <select value={employee.role} onChange={(e) => setEmployee({ ...employee, role: e.target.value })}>
            <option value="admin">User/Admin</option>
            <option value="employee">Employee/Cashier</option>
          </select>
          <button className="primary">Add Account</button>
        </form>
        <div className="panel data-list">
          <h2>Accounts & Booking Desk</h2>
          <div className="booking-card">
            <strong>Booking / Table Queue</strong>
            <span>Use floor/table status to manage dine-in allocation and active orders.</span>
          </div>
          {users.map((account) => (
            <div className="data-row compact" key={account.id}>
              <strong>{account.name}</strong>
              <span>{account.email}</span>
              <em>{account.role}</em>
              <button onClick={() => archiveUser(account)}>{account.status ? 'Archive' : 'Restore'}</button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function KitchenScreen({ api, token, site }) {
  const [tickets, setTickets] = useState([])
  const [search, setSearch] = useState('')

  async function load() {
    setTickets(await api('/api/kitchen/tickets'))
  }

  useEffect(() => {
    load().catch(() => {})
    const script = document.createElement('script')
    script.src = `${API_URL}/socket.io/socket.io.js`
    script.onload = () => {
      if (window.io) {
        const socket = window.io(API_URL, { auth: { token } })
        socket.on('kitchen:ticket-updated', load)
      }
    }
    document.body.appendChild(script)
    const timer = setInterval(load, 6000)
    return () => {
      clearInterval(timer)
      script.remove()
    }
  }, [])

  async function nextStage(ticket) {
    const stages = ['to_cook', 'preparing', 'completed']
    const stage = stages[Math.min(stages.indexOf(ticket.stage) + 1, stages.length - 1)]
    await api(`/api/kitchen/tickets/${ticket.id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) })
    load()
  }

  async function toggleItem(item) {
    await api(`/api/kitchen/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ completed: !item.completed }) })
    load()
  }

  const filtered = tickets.filter((ticket) => {
    const text = `${ticket.order.orderNumber} ${ticket.items.map((item) => item.orderItem.name).join(' ')}`.toLowerCase()
    return text.includes(search.toLowerCase())
  })

  return (
    <>
      <PageTitle title="Kitchen tickets that move as orders arrive" kicker="Kitchen Display" site={site} />
      <div className="panel">
        <input placeholder="Search ticket, product, or category" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="kds-board">
        {['to_cook', 'preparing', 'completed'].map((stage) => (
          <section className="kds-column" key={stage}>
            <h2>{stageLabel(stage)}</h2>
            {filtered.filter((ticket) => ticket.stage === stage).map((ticket) => (
              <article className="ticket" key={ticket.id}>
                <button className="ticket-head" onClick={() => nextStage(ticket)}>
                  <strong>{ticket.order.orderNumber}</strong>
                  <span>{ticket.order.table?.number || 'Takeaway'}</span>
                </button>
                {ticket.items.map((item) => (
                  <button key={item.id} className={item.completed ? 'done item-line' : 'item-line'} onClick={() => toggleItem(item)}>
                    {item.orderItem.quantity} x {item.orderItem.name}
                  </button>
                ))}
              </article>
            ))}
          </section>
        ))}
      </div>
    </>
  )
}

function ReportsScreen({ api, site }) {
  const [report, setReport] = useState(null)
  const [filter, setFilter] = useState({ period: 'today', employee: 'all', session: 'all', product: 'all' })

  useEffect(() => {
    api('/api/reports/summary').then(setReport).catch(() => {})
  }, [])

  if (!report) return <PageTitle title="Loading reports" site={site} />
  const maxCategory = Math.max(1, ...report.topCategories.map((cat) => cat.revenue))

  return (
    <>
      <PageTitle title="See sales while the shift is still moving" kicker="Reports & Analytics" site={site} />
      <section className="report-filters panel">
        <select value={filter.period} onChange={(e) => setFilter({ ...filter, period: e.target.value })}>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom Range</option>
        </select>
        <select value={filter.employee} onChange={(e) => setFilter({ ...filter, employee: e.target.value })}>
          <option value="all">All Employees</option>
        </select>
        <select value={filter.session} onChange={(e) => setFilter({ ...filter, session: e.target.value })}>
          <option value="all">All Sessions</option>
        </select>
        <select value={filter.product} onChange={(e) => setFilter({ ...filter, product: e.target.value })}>
          <option value="all">All Products</option>
        </select>
        <button onClick={() => window.print()}>Export PDF</button>
        <button onClick={() => alert('XLS export ready for demo; connect SheetJS for production file download.')}>Export XLS</button>
      </section>
      <section className="metric-grid">
        <div className="metric"><span>Total Orders</span><strong>{report.totalOrders}</strong></div>
        <div className="metric"><span>Revenue</span><strong>{money(report.revenue)}</strong></div>
        <div className="metric"><span>Average Order</span><strong>{money(report.averageOrderValue)}</strong></div>
      </section>
      <div className="two-column">
        <div className="panel">
          <h2>Sales Trend</h2>
          <div className="trend-chart">
            {report.trend.map((point, index) => (
              <span key={`${point.label}-${index}`} style={{ height: `${Math.max(8, point.revenue / Math.max(1, report.revenue) * 180)}px` }} title={`${point.label}: ${money(point.revenue)}`} />
            ))}
          </div>
          <h2>Top Categories</h2>
          {report.topCategories.map((cat) => (
            <div className="bar-row" key={cat.name}>
              <span>{cat.name}</span>
              <div><i style={{ width: `${(cat.revenue / maxCategory) * 100}%`, background: cat.color }} /></div>
              <b>{money(cat.revenue)}</b>
            </div>
          ))}
        </div>
        <div className="panel data-list">
          <h2>Top Orders</h2>
          {report.topOrders.map((order) => (
            <div className="data-row compact" key={order.id}>
              <strong>{order.orderNumber}</strong>
              <span>{order.customer?.name || 'Walk-in'}</span>
              <b>{money(order.total)}</b>
            </div>
          ))}
          <h2>Top Products</h2>
          {report.topProducts.map((product) => (
            <div className="data-row" key={product.name}>
              <strong>{product.name}</strong>
              <span>{product.quantity} sold</span>
              <b>{money(product.revenue)}</b>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default App
