import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import AiAssistant from './AiAssistant';
import { Users, ShoppingBag, ShieldCheck, RefreshCw, Check, X, Ban, Search, DollarSign } from 'lucide-react';

export default function AdminView() {
  const [tab, setTab] = useState('users'); // 'users' | 'orders' | 'ai'
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchUser, setSearchUser] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');

  useEffect(() => {
    loadData();
  }, [roleFilter, statusFilter, orderStatusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, ordersRes] = await Promise.all([
        apiRequest('/admin/stats'),
        apiRequest(`/admin/users?role=${roleFilter}&status=${statusFilter}`),
        apiRequest(`/admin/orders?status=${orderStatusFilter}`),
      ]);
      setStats(statsRes.stats);
      setUsers(usersRes.users);
      setOrders(ordersRes.orders);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserStatus = async (userId, newStatus) => {
    try {
      await apiRequest(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      loadData();
    } catch (err) {
      alert(`Error updating user: ${err.message}`);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await apiRequest(`/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      loadData();
    } catch (err) {
      alert(`Error updating order: ${err.message}`);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchUser) return true;
    const term = searchUser.toLowerCase();
    return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Operations Console</h1>
          <p className="page-subtitle">Verify user profiles, oversee orders, and orchestrate with Gemini AI tools</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Analytics Grid */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Users</div>
            <div className="stat-value">{stats.totalUsers}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Verifications</div>
            <div className="stat-value" style={{ color: stats.pendingUsers > 0 ? '#b45309' : 'inherit' }}>
              {stats.pendingUsers}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Products</div>
            <div className="stat-value">{stats.totalProducts}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Orders</div>
            <div className="stat-value">{stats.totalOrders}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Platform Sales</div>
            <div className="stat-value">${Number(stats.totalSales).toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          <Users size={16} /> User Management ({users.length})
        </button>
        <button className={`tab-btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          <ShoppingBag size={16} /> Orders Oversight ({orders.length})
        </button>
        <button className={`tab-btn ${tab === 'ai' ? 'active' : ''}`} onClick={() => setTab('ai')}>
          <ShieldCheck size={16} /> AI Assistant (LLM Tools)
        </button>
      </div>

      {/* Tab: Users Management */}
      {tab === 'users' && (
        <div className="card" style={{ padding: 0 }}>
          <div
            style={{
              padding: '1rem',
              display: 'flex',
              gap: '0.75rem',
              borderBottom: '1px solid var(--border)',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
              <input
                type="text"
                className="input-text"
                placeholder="Search by user name or email..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
              />
            </div>
            <select
              className="input-select"
              style={{ width: '150px' }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="seller">Sellers</option>
              <option value="buyer">Buyers</option>
              <option value="admin">Admins</option>
            </select>
            <select
              className="input-select"
              style={{ width: '150px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No users match the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u._id}>
                      <td style={{ fontWeight: 500 }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className="nav-badge">{u.role}</span>
                      </td>
                      <td>
                        <span className={`status-chip ${u.status}`}>{u.status}</span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {u.role !== 'admin' && (
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            {u.status !== 'approved' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleUpdateUserStatus(u._id, 'approved')}
                                title="Approve User"
                              >
                                <Check size={13} color="green" /> Approve
                              </button>
                            )}
                            {u.status !== 'rejected' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleUpdateUserStatus(u._id, 'rejected')}
                                title="Reject User"
                              >
                                <X size={13} color="red" /> Reject
                              </button>
                            )}
                            {u.status !== 'blocked' ? (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleUpdateUserStatus(u._id, 'blocked')}
                                title="Block User"
                              >
                                <Ban size={13} /> Block
                              </button>
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleUpdateUserStatus(u._id, 'approved')}
                              >
                                Unblock
                              </button>
                            )}
                          </div>
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

      {/* Tab: Orders Oversight */}
      {tab === 'orders' && (
        <div className="card" style={{ padding: 0 }}>
          <div
            style={{
              padding: '1rem',
              display: 'flex',
              gap: '0.75rem',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center',
            }}
          >
            <select
              className="input-select"
              style={{ width: '180px' }}
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
            >
              <option value="">All Order Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Product</th>
                  <th>Buyer</th>
                  <th>Seller</th>
                  <th>Quantity</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o._id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{o._id.slice(-6)}</td>
                      <td style={{ fontWeight: 500 }}>{o.product?.title || 'Unknown'}</td>
                      <td>{o.buyer?.name || 'Deleted'}</td>
                      <td>{o.seller?.name || 'Deleted'}</td>
                      <td>{o.quantity}</td>
                      <td style={{ fontWeight: 600 }}>${Number(o.totalPrice).toFixed(2)}</td>
                      <td>
                        <span className={`status-chip ${o.status}`}>{o.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          {o.status !== 'approved' && o.status !== 'completed' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleUpdateOrderStatus(o._id, 'approved')}
                            >
                              Approve
                            </button>
                          )}
                          {o.status !== 'rejected' && o.status !== 'cancelled' && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleUpdateOrderStatus(o._id, 'rejected')}
                            >
                              Reject
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

      {/* Tab: AI Assistant */}
      {tab === 'ai' && <AiAssistant onActionCompleted={loadData} />}
    </div>
  );
}
