import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import { Search, ShoppingCart, ShoppingBag, AlertCircle, RefreshCw, X, Check } from 'lucide-react';

export default function BuyerView({ user }) {
  const [tab, setTab] = useState('browse'); // 'browse' | 'orders'
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Buy Modal
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const isApproved = user.status === 'approved';

  useEffect(() => {
    loadProducts();
    loadMyOrders();
  }, [search]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/products?search=${search}&inStockOnly=true`);
      setProducts(res.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMyOrders = async () => {
    try {
      const res = await apiRequest('/orders/my-orders');
      setOrders(res.orders || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenBuyModal = (product) => {
    setSelectedProduct(product);
    setOrderQuantity(1);
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmittingOrder(true);
    try {
      await apiRequest('/orders', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProduct._id,
          quantity: orderQuantity,
        }),
      });
      setSelectedProduct(null);
      loadProducts();
      loadMyOrders();
      setTab('orders');
    } catch (err) {
      alert(`Could not place order: ${err.message}`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Cancel this pending order?')) return;
    try {
      await apiRequest(`/orders/${orderId}/cancel`, { method: 'PATCH' });
      loadMyOrders();
      loadProducts();
    } catch (err) {
      alert(`Error cancelling order: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Marketplace Catalog</h1>
          <p className="page-subtitle">Search curated products, inspect discounts, and track purchases</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { loadProducts(); loadMyOrders(); }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {!isApproved && (
        <div className="alert-banner warning">
          <AlertCircle size={16} />
          <span>
            <strong>Account Verification Pending:</strong> Your buyer account is pending admin approval. You can browse products, but placing orders requires verification.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'browse' ? 'active' : ''}`} onClick={() => setTab('browse')}>
          <ShoppingBag size={16} /> Browse Products ({products.length})
        </button>
        <button className={`tab-btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          <ShoppingCart size={16} /> My Orders ({orders.length})
        </button>
      </div>

      {/* Tab: Browse Products */}
      {tab === 'browse' && (
        <div>
          {/* Search Bar */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', maxWidth: '420px' }}>
              <input
                type="text"
                className="input-text"
                placeholder="Search products by title or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Grid */}
          {products.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No products found matching your search.
            </div>
          ) : (
            <div className="products-grid">
              {products.map((p) => {
                const discountedPrice = p.discount > 0 ? (p.price * (1 - p.discount / 100)).toFixed(2) : p.price;
                return (
                  <div key={p._id} className="product-card">
                    <div>
                      <div className="product-title">{p.title}</div>
                      <div className="product-desc">{p.description || 'No description provided.'}</div>
                    </div>

                    <div>
                      <div className="product-pricing">
                        <span className="product-price">${Number(discountedPrice).toFixed(2)}</span>
                        {p.discount > 0 && (
                          <>
                            <span className="product-original-price">${Number(p.price).toFixed(2)}</span>
                            <span className="product-discount-tag">{p.discount}% OFF</span>
                          </>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.75rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span>Seller: {p.seller?.name || 'Verified Seller'}</span>
                        <span>{p.quantity} in stock</span>
                      </div>

                      <button
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%' }}
                        onClick={() => handleOpenBuyModal(p)}
                        disabled={!isApproved || p.quantity === 0}
                        title={!isApproved ? 'Account approval required to purchase' : ''}
                      >
                        <ShoppingCart size={14} /> Buy Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: My Orders */}
      {tab === 'orders' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Product</th>
                  <th>Seller</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Discount</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      You haven't placed any orders yet. Browse the catalog and place an order!
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o._id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{o._id.slice(-6)}</td>
                      <td style={{ fontWeight: 500 }}>{o.product?.title || 'Unknown Product'}</td>
                      <td>{o.seller?.name || 'Seller'}</td>
                      <td>{o.quantity}</td>
                      <td>${Number(o.unitPrice).toFixed(2)}</td>
                      <td>{o.discount > 0 ? `${o.discount}%` : '-'}</td>
                      <td style={{ fontWeight: 600 }}>${Number(o.totalPrice).toFixed(2)}</td>
                      <td>
                        <span className={`status-chip ${o.status}`}>{o.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {o.status === 'pending' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--danger-text)' }}
                            onClick={() => handleCancelOrder(o._id)}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Buy Modal */}
      {selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem' }}>Place Order</h3>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600 }}>{selectedProduct.title}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Seller: {selectedProduct.seller?.name}
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                Unit Price:{' '}
                <strong>
                  ${(selectedProduct.discount > 0
                    ? selectedProduct.price * (1 - selectedProduct.discount / 100)
                    : selectedProduct.price
                  ).toFixed(2)}
                </strong>
                {selectedProduct.discount > 0 && (
                  <span className="product-discount-tag" style={{ marginLeft: '0.5rem' }}>
                    {selectedProduct.discount}% OFF
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handlePlaceOrder}>
              <div className="form-group">
                <label className="form-label">Order Quantity</label>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct.quantity}
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(Math.max(1, Math.min(selectedProduct.quantity, Number(e.target.value))))}
                  className="input-text"
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Max available: {selectedProduct.quantity} units
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 0',
                  borderTop: '1px solid var(--border)',
                  marginBottom: '1rem',
                }}
              >
                <span style={{ fontWeight: 500 }}>Total Price:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  $
                  {(
                    (selectedProduct.discount > 0
                      ? selectedProduct.price * (1 - selectedProduct.discount / 100)
                      : selectedProduct.price) * orderQuantity
                  ).toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedProduct(null)}
                  disabled={submittingOrder}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingOrder}>
                  {submittingOrder ? 'Processing...' : 'Confirm Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
