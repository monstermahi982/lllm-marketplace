import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import { Plus, UploadCloud, Package, ShoppingBag, RefreshCw, AlertCircle, Edit2, Trash2 } from 'lucide-react';

export default function SellerView({ user }) {
  const [tab, setTab] = useState('inventory'); // 'inventory' | 'orders'
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
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

  // Bulk Product Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkInput, setBulkInput] = useState(
    JSON.stringify(
      [
        { title: 'USB-C Fast Charging Hub', description: '7-in-1 Aluminum Hub', quantity: 30, price: 39.99, discount: 5 },
        { title: 'Wireless Ergonomic Mouse', description: 'Silent click with 2.4G & Bluetooth', quantity: 20, price: 29.5, discount: 10 },
        { title: 'Desk Mat Leather 80x40cm', description: 'Waterproof dual-sided desk pad', quantity: 50, price: 18.0, discount: 0 },
      ],
      null,
      2
    )
  );

  const isApproved = user.status === 'approved';

  useEffect(() => {
    loadSellerData();
  }, []);

  const loadSellerData = async () => {
    setLoading(true);
    try {
      const [prodRes, orderRes] = await Promise.all([
        apiRequest('/products/seller/mine'),
        apiRequest('/orders/seller-orders'),
      ]);
      setProducts(prodRes.products || []);
      setOrders(orderRes.orders || []);
    } catch (err) {
      console.error(err);
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

  const handleBulkUpload = async () => {
    try {
      const items = JSON.parse(bulkInput);
      if (!Array.isArray(items)) throw new Error('Data must be a JSON array of product objects.');
      await apiRequest('/products/bulk', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
      setShowBulkModal(false);
      loadSellerData();
    } catch (err) {
      alert(`Bulk create failed: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
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
          <h1 className="page-title">Seller Hub</h1>
          <p className="page-subtitle">Manage catalog, bulk upload inventory, and fulfill customer orders</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadSellerData}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowBulkModal(true)}
            disabled={!isApproved}
            title={!isApproved ? 'Admin approval required' : ''}
          >
            <UploadCloud size={14} /> Bulk Add
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
            <strong>Account Pending Verification:</strong> Your seller account is currently '{user.status}'. You must be verified by the admin before creating products or managing active inventory.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>
          <Package size={16} /> My Inventory ({products.length})
        </button>
        <button className={`tab-btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          <ShoppingBag size={16} /> Incoming Orders ({orders.length})
        </button>
      </div>

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
                      No products added yet. Click "+ Add Product" or "Bulk Add" above.
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
                  placeholder="Key features and details..."
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

      {/* Bulk Add Modal */}
      {showBulkModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem' }}>Bulk Create Products</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Paste a JSON array of products with title, quantity, price, and optional discount:
            </p>
            <div className="form-group">
              <textarea
                className="input-textarea"
                rows={8}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleBulkUpload}>
                Upload Products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
