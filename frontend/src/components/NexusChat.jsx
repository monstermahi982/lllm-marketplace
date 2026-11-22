import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../api';
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Terminal,
  RefreshCw,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  XCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

// Lightweight Markdown renderer for tables, lists, bold text, and code
function FormattedMessage({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let tableRows = [];
  let inTable = false;
  let inList = false;
  let listItems = [];

  const flushTable = (key) => {
    if (tableRows.length > 0) {
      const headerRow = tableRows[0];
      const dataRows = tableRows.slice(2);
      elements.push(
        <div key={`table-${key}`} className="table-container" style={{ margin: '0.6rem 0' }}>
          <table style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                {headerRow.map((cell, cIdx) => (
                  <th key={cIdx}>{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  };

  const flushList = (key) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key}`} style={{ paddingLeft: '1.25rem', margin: '0.4rem 0' }}>
          {listItems.map((li, lIdx) => (
            <li key={lIdx} dangerouslySetInnerHTML={{ __html: formatInline(li) }} />
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  const formatInline = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(
        /`([^`]+)`/g,
        '<code style="background:var(--bg-subtle);padding:0.1rem 0.35rem;border-radius:3px;font-size:0.85em;font-family:var(--font-mono);">$1</code>'
      );
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Table rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (!inTable) {
        if (inList) flushList(index);
        inTable = true;
      }
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      tableRows.push(cells);
      return;
    } else if (inTable) {
      flushTable(index);
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) inList = true;
      listItems.push(trimmed.slice(2));
      return;
    } else if (inList) {
      flushList(index);
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={index} style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0.6rem 0 0.2rem 0' }}>
          {trimmed.slice(4)}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={index} style={{ fontSize: '0.98rem', fontWeight: 600, margin: '0.75rem 0 0.3rem 0' }}>
          {trimmed.slice(3)}
        </h3>
      );
      return;
    }

    if (!trimmed) {
      elements.push(<div key={index} style={{ height: '0.4rem' }} />);
      return;
    }

    elements.push(
      <p
        key={index}
        style={{ margin: '0.2rem 0' }}
        dangerouslySetInnerHTML={{ __html: formatInline(line) }}
      />
    );
  });

  if (inTable) flushTable('end');
  if (inList) flushList('end');

  return <div>{elements}</div>;
}

export default function NexusChat({ role, onActionCompleted }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedTools, setExpandedTools] = useState({});
  const [showSidebar, setShowSidebar] = useState(true);

  const messagesScrollRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, [role]);

  // Scroll smoothly to bottom when messages or loading changes
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, loading, pendingAction]);

  const loadConversations = async () => {
    try {
      const res = await apiRequest('/ai/conversations');
      const list = res.conversations || [];
      setConversations(list);

      if (list.length > 0) {
        loadConversation(list[0]._id);
      } else {
        handleNewChat();
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  };

  const loadConversation = async (id) => {
    setActiveConvId(id);
    try {
      const res = await apiRequest(`/ai/conversations/${id}`);
      const conv = res.conversation;
      setMessages(conv?.messages || []);
      setPendingAction(conv?.pendingAction || null);
    } catch (err) {
      console.error('Error loading conversation:', err);
    }
  };

  const handleNewChat = async () => {
    try {
      const res = await apiRequest('/ai/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Conversation' }),
      });
      const newConv = res.conversation;
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(newConv._id);
      setMessages(newConv.messages || []);
      setPendingAction(null);
    } catch (err) {
      alert(`Could not create new chat: ${err.message}`);
    }
  };

  const handleDeleteConversation = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation history?')) return;
    try {
      await apiRequest(`/ai/conversations/${id}`, { method: 'DELETE' });
      const filtered = conversations.filter((c) => c._id !== id);
      setConversations(filtered);
      if (activeConvId === id) {
        if (filtered.length > 0) {
          loadConversation(filtered[0]._id);
        } else {
          handleNewChat();
        }
      }
    } catch (err) {
      alert(`Error deleting chat: ${err.message}`);
    }
  };

  const toggleToolExpand = (id) => {
    setExpandedTools((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sendMessage = async (messageText) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading || !activeConvId) return;

    const userMessage = { role: 'user', content: textToSend.trim(), createdAt: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiRequest(`/ai/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: textToSend.trim() }),
      });

      if (res.conversation) {
        setMessages(res.conversation.messages);
        setPendingAction(res.conversation.pendingAction || null);

        // Refresh conversation titles in sidebar
        const updatedList = await apiRequest('/ai/conversations');
        setConversations(updatedList.conversations || []);
      }

      if (res.toolExecutions && res.toolExecutions.length > 0 && onActionCompleted) {
        onActionCompleted();
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Nexus AI Error: ${error.message}`,
          toolExecutions: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handle User Confirmation Decision (Clicking Confirm or Cancel on Write Operation)
  const handleActionDecision = async (confirmed) => {
    if (!activeConvId || actionLoading) return;
    setActionLoading(true);

    try {
      const res = await apiRequest(`/ai/conversations/${activeConvId}/action-decision`, {
        method: 'POST',
        body: JSON.stringify({ confirmed }),
      });

      if (res.conversation) {
        setMessages(res.conversation.messages);
        setPendingAction(null);
      }

      if (confirmed && onActionCompleted) {
        onActionCompleted();
      }
    } catch (err) {
      alert(`Error processing confirmation: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Requested Quick Action options for prompt buttons
  const getQuickOptions = () => {
    if (role === 'admin') {
      return [
        { label: "Show today's users approval", prompt: 'Show users waiting for approval' },
        { label: 'Show new orders', prompt: 'Show new orders' },
        { label: 'Orders to review', prompt: 'Show orders to review' },
        { label: 'Recent products', prompt: 'Show recent products' },
        { label: 'Show platform stats', prompt: 'Show platform statistics' },
        { label: 'Who am I?', prompt: 'Who am I? Tell me about myself.' },
      ];
    }
    if (role === 'seller') {
      return [
        { label: 'Orders to review', prompt: 'Show my orders to review' },
        { label: 'Show new orders', prompt: 'Show new customer orders' },
        { label: 'Recent products', prompt: 'Show recent products' },
        { label: 'Show my earnings', prompt: 'Show my earnings and upcoming revenue' },
        { label: 'List my products', prompt: 'List my products in inventory' },
        { label: 'Who am I?', prompt: 'Who am I? Tell me about myself.' },
      ];
    }
    return [
      { label: 'Recent products', prompt: 'Show recent products in marketplace' },
      { label: 'Show new orders', prompt: 'Show my new orders' },
      { label: 'Orders to review', prompt: 'Show my orders status' },
      { label: 'Browse catalog', prompt: 'Browse products with discounts' },
      { label: 'Who am I?', prompt: 'Who am I? Tell me about myself.' },
    ];
  };

  return (
    <div className="full-chatbox-container">
      {/* Sidebar: Multi-Chat History for all user types */}
      {showSidebar && (
        <div
          style={{
            width: '280px',
            flexShrink: 0,
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-app)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
          }}
        >
          {/* Sidebar Header */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, fontSize: '0.875rem' }}>
              <Sparkles size={16} />
              <span>Conversations</span>
            </div>
            <button
              className="btn btn-primary btn-sm"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              onClick={handleNewChat}
              title="Start a new chat conversation"
            >
              <Plus size={13} /> New Chat
            </button>
          </div>

          {/* Scrollable Conversation List */}
          <div
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              overflowY: 'auto',
              padding: '0.6rem',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, padding: '0.25rem 0.5rem', textTransform: 'uppercase' }}>
              Chat History ({conversations.length})
            </div>
            {conversations.map((c) => {
              const isActive = c._id === activeConvId;
              return (
                <div
                  key={c._id}
                  onClick={() => loadConversation(c._id)}
                  style={{
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '0.35rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: isActive ? 'var(--bg-surface)' : 'transparent',
                    border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                    fontSize: '0.8125rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                    <MessageSquare size={13} style={{ flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                      {c.title || 'Conversation'}
                    </span>
                  </div>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '0.15rem',
                    }}
                    onClick={(e) => handleDeleteConversation(c._id, e)}
                    title="Delete conversation"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Full-Width Chat Area */}
      <div
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          background: 'var(--bg-surface)',
        }}
      >
        {/* Chat Top Header */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.25rem 0.45rem' }}
              title={showSidebar ? 'Hide chat history sidebar' : 'Show chat history sidebar'}
            >
              {showSidebar ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.925rem' }}>Nexus AI Copilot</span>
              <span className="nav-badge" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                LangChain {role} Agent
              </span>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Gemini + LangChain HITL Tools
          </span>
        </div>

        {/* Quick Action Pills Row */}
        <div
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--bg-app)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: '0.45rem',
            overflowX: 'auto',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 500 }}>Quick Actions:</span>
          {getQuickOptions().map((opt, i) => (
            <button
              key={i}
              className="quick-action-chip"
              onClick={() => sendMessage(opt.prompt)}
              disabled={loading || actionLoading}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Messages Stream with Smooth Native Scroll */}
        <div
          ref={messagesScrollRef}
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {messages.map((msg, idx) => {
            const isLastAssistantMsg = msg.role === 'assistant' && idx === messages.length - 1;
            const hasPendingAction = isLastAssistantMsg && pendingAction;

            return (
              <div key={idx} className={`chat-bubble ${msg.role}`} style={{ maxWidth: '85%' }}>
                {/* Clean Formatted Markdown Output */}
                <FormattedMessage content={msg.content} />

                {/* Database Write Confirmation Card if action requires agreement */}
                {hasPendingAction && (
                  <div className="confirmation-card">
                    <div className="confirmation-header">
                      <AlertTriangle size={15} color="#b45309" />
                      <span>{pendingAction.actionName || 'Confirmation Required for Database Update'}</span>
                    </div>
                    <div className="confirmation-summary">
                      {pendingAction.summary}
                    </div>
                    <div className="confirmation-actions">
                      <button
                        className="btn-confirm"
                        onClick={() => handleActionDecision(true)}
                        disabled={actionLoading}
                      >
                        <CheckCircle size={14} />
                        {actionLoading ? 'Applying Changes...' : 'Confirm & Apply Changes'}
                      </button>
                      <button
                        className="btn-cancel-action"
                        onClick={() => handleActionDecision(false)}
                        disabled={actionLoading}
                      >
                        <XCircle size={14} />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Collapsible Executed Tools Drawer */}
                {msg.toolExecutions && msg.toolExecutions.length > 0 && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                    <div
                      style={{
                        fontSize: '0.725rem',
                        fontWeight: 600,
                        marginBottom: '0.35rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Terminal size={12} />
                      <span>Executed LangChain Tools ({msg.toolExecutions.length})</span>
                    </div>
                    {msg.toolExecutions.map((exec, eIdx) => {
                      const toolKey = `${idx}-${eIdx}`;
                      const isExpanded = expandedTools[toolKey];
                      return (
                        <div key={eIdx} className="tool-execution-card">
                          <div
                            onClick={() => toggleToolExpand(toolKey)}
                            style={{
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontWeight: 600,
                            }}
                          >
                            <span>🛠️ {exec.tool}()</span>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </div>
                          {isExpanded && (
                            <div style={{ marginTop: '0.4rem', borderTop: '1px dashed var(--border)', paddingTop: '0.4rem' }}>
                              <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Input Parameters:</div>
                              <pre style={{ margin: 0, overflowX: 'auto', maxHeight: '100px' }}>
                                {JSON.stringify(exec.input, null, 2)}
                              </pre>
                              <div style={{ color: 'var(--text-muted)', marginTop: '0.4rem', marginBottom: '0.2rem' }}>
                                Database Output:
                              </div>
                              <pre style={{ margin: 0, overflowX: 'auto', maxHeight: '160px' }}>
                                {JSON.stringify(exec.output, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="chat-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={14} className="spin" />
              <span>Nexus AI is evaluating tools and database records...</span>
            </div>
          )}
          <div ref={chatEndRef} style={{ height: '1px' }} />
        </div>

        {/* Input Bar */}
        <form
          className="ai-chat-input-row"
          style={{ flexShrink: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <input
            type="text"
            className="input-text"
            placeholder={
              role === 'admin'
                ? 'Ask Nexus to check approvals, inspect orders, block/approve users...'
                : role === 'seller'
                ? 'Ask Nexus to add products, review orders, check revenue...'
                : 'Ask Nexus to search products, purchase items, check order status...'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || actionLoading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || actionLoading || !input.trim()}>
            <Send size={15} />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
