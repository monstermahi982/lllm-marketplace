import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import NexusChat from './NexusChat';
import { Plus, Package, ShoppingBag, Sparkles, RefreshCw, AlertCircle, Trash2, DollarSign, TrendingUp } from 'lucide-react';

export default function SellerView({ user }) {
  // Chat window shown first/default as requested in spec
  const [tab, setTab] = useState('ai'); // 'ai' | 'inventory' | 'orders'
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Single Product Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title: '',
    description: '',
    quantity: 10,
    price: 49.99,
    discount: 0,
  });

  const isApproved = user.status === 'approved';

  useEffect(() => {
    loadSellerData();
  }, []);

  const loadSellerData = async () => {
    setLoading(true);
    try {
      const [prodRes, orderRes, earningsRes] = await Promise.all([
        apiRequest('/products/seller/mine'),
        apiRequest('/orders/seller-orders'),
        apiRequest('/orders/seller-earnings'),
      ]);
      setProducts(prodRes.products || []);
      setOrders(orderRes.orders || []);
      setEarnings(earningsRes);
    } catch (err) {
      console.error('Error fetching seller data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(newProduct),
      });
      setShowAddModal(false);
      setNewProduct({ title: '', description: '', quantity: 10, price: 49.99, discount: 0 });
      loadSellerData();
    } catch (err) {
      alert(`Error creating product: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Delete this product from your catalog?')) return;
    try {
      await apiRequest(`/products/${id}`, { method: 'DELETE' });
      loadSellerData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await apiRequest(`/orders/${orderId}/seller-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      loadSellerData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Seller Hub & Nexus Copilot</h1>
          <p className="page-subtitle">Manage inventory, fulfill orders, track revenue, and leverage AI to automate store operations</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadSellerData}>
            <RefreshCw size={14} /> Refresh Data
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddModal(true)}
            disabled={!isApproved}
            title={!isApproved ? 'Admin approval required' : ''}
          >
            <Plus size={14} /> Add Product
          </button>
        </div>
      </div>

      {!isApproved && (
        <div className="alert-banner warning">
          <AlertCircle size={16} />
          <span>
            <strong>Account Pending Verification:</strong> Your seller account status is '{user.status}'. You must be approved by the admin before creating products or managing active inventory.
          </span>
        </div>
      )}

      {/* Seller Financial Stats & Earnings Overview */}
      {earnings && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Delivered Earnings</div>
            <div className="stat-value" style={{ color: 'var(--success-text)' }}>
              ${earnings.deliveredEarnings}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Upcoming / Pending Earnings</div>
            <div className="stat-value" style={{ color: '#b45309' }}>
              ${earnings.upcomingPendingEarnings}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Products</div>
            <div className="stat-value">{products.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Orders</div>
            <div className="stat-value">{earnings.pendingOrdersCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Units Sold</div>
            <div className="stat-value">{earnings.totalUnitsSold}</div>
          </div>
        </div>
      )}

      {/* Tabs: Nexus AI Chat first, then Inventory and Orders */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'ai' ? 'active' : ''}`} onClick={() => setTab('ai')}>
          <Sparkles size={16} /> Nexus AI Copilot
        </button>
        <button className={`tab-btn ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>
          <Package size={16} /> Inventory ({products.length})
        </button>
        <button className={`tab-btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          <ShoppingBag size={16} /> Incoming Orders ({orders.length})
        </button>
      </div>

      {/* Tab: Nexus AI Chat */}
      {tab === 'ai' && <NexusChat role="seller" onActionCompleted={loadSellerData} />}

      {/* Tab: Inventory */}
      {tab === 'inventory' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Product Title</th>
                  <th>Stock Quantity</th>
                  <th>Base Price</th>
                  <th>Discount</th>
                  <th>Effective Price</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No products added yet. Click "+ Add Product" or ask Nexus AI to add products!
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const discounted = p.discount > 0 ? (p.price * (1 - p.discount / 100)).toFixed(2) : p.price;
                    return (
                      <tr key={p._id}>
                        <td style={{ fontWeight: 500 }}>
                          <div>{p.title}</div>
                          {p.description && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.description}</div>
                          )}
                        </td>
                        <td>
                          <span
                            className="nav-badge"
                            style={{
                              color: p.quantity === 0 ? 'var(--danger-text)' : 'inherit',
                              background: p.quantity === 0 ? 'var(--danger-bg)' : undefined,
                            }}
                          >
                            {p.quantity} units
                          </span>
                        </td>
                        <td>${Number(p.price).toFixed(2)}</td>
                        <td>
                          {p.discount > 0 ? (
                            <span className="product-discount-tag">{p.discount}% OFF</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>0%</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>${Number(discounted).toFixed(2)}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDeleteProduct(p._id)}
                            title="Delete"
                          >
                            <Trash2 size={13} color="red" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Orders */}
      {tab === 'orders' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Product</th>
                  <th>Buyer</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Seller Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No incoming customer orders yet.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o._id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{o._id.slice(-6)}</td>
                      <td style={{ fontWeight: 500 }}>{o.product?.title || 'Unknown'}</td>
                      <td>{o.buyer?.name || 'Buyer'}</td>
                      <td>{o.quantity}</td>
                      <td style={{ fontWeight: 600 }}>${Number(o.totalPrice).toFixed(2)}</td>
                      <td>
                        <span className={`status-chip ${o.status}`}>{o.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          {o.status === 'pending' && (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleUpdateOrderStatus(o._id, 'approved')}
                              >
                                Accept
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleUpdateOrderStatus(o._id, 'rejected')}
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {o.status === 'approved' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleUpdateOrderStatus(o._id, 'completed')}
                            >
                              Mark Delivered
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem' }}>Add New Product</h3>
            <form onSubmit={handleCreateProduct}>
              <div className="form-group">
                <label className="form-label">Product Title *</label>
                <input
                  type="text"
                  required
                  className="input-text"
                  value={newProduct.title}
                  onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                  placeholder="e.g. Ergonomic Office Chair"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="input-textarea"
                  rows={2}
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  placeholder="Key features and specifications..."
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="input-text"
                    value={newProduct.quantity}
                    onChange={(e) => setNewProduct({ ...newProduct, quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Price ($) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="input-text"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input-text"
                    value={newProduct.discount}
                    onChange={(e) => setNewProduct({ ...newProduct, discount: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
