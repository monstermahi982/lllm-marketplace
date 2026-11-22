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
  Clock,
} from 'lucide-react';

// Lightweight Markdown to HTML formatter for structured tables, lists, and bold text
function FormattedMessage({ content }) {
  if (!content) return null;

  // Split lines
  const lines = content.split('\n');
  const elements = [];
  let tableRows = [];
  let inTable = false;
  let inList = false;
  let listItems = [];

  const flushTable = (key) => {
    if (tableRows.length > 0) {
      const headerRow = tableRows[0];
      const dataRows = tableRows.slice(2); // Skip separator row
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
      .replace(/`([^`]+)`/g, '<code style="background:var(--bg-subtle);padding:0.1rem 0.3rem;border-radius:3px;font-size:0.85em;">$1</code>');
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Markdown Table Row
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

    // Markdown Bullet List
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        inList = true;
      }
      listItems.push(trimmed.slice(2));
      return;
    } else if (inList) {
      flushList(index);
    }

    // Markdown Heading 3
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={index} style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0.6rem 0 0.2rem 0' }}>
          {trimmed.slice(4)}
        </h4>
      );
      return;
    }

    // Markdown Heading 2
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={index} style={{ fontSize: '0.98rem', fontWeight: 600, margin: '0.75rem 0 0.3rem 0' }}>
          {trimmed.slice(3)}
        </h3>
      );
      return;
    }

    // Empty line
    if (!trimmed) {
      elements.push(<div key={index} style={{ height: '0.4rem' }} />);
      return;
    }

    // Regular line
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
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedTools, setExpandedTools] = useState({});

  const chatEndRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, [role]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadConversations = async () => {
    try {
      const res = await apiRequest('/ai/conversations');
      const list = res.conversations || [];
      setConversations(list);

      if (list.length > 0) {
        loadConversation(list[0]._id);
      } else {
        // Create initial default conversation
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
      setMessages(res.conversation?.messages || []);
    } catch (err) {
      console.error('Error loading conversation messages:', err);
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
    } catch (err) {
      alert(`Could not start new chat: ${err.message}`);
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
        // Refresh conversations list to update title if updated
        const updatedListRes = await apiRequest('/ai/conversations');
        setConversations(updatedListRes.conversations || []);
      }

      // Notify parent to refresh tables/earnings if tool ran
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

  // Quick Prompt Pills tailored by role
  const getQuickPrompts = () => {
    if (role === 'admin') {
      return [
        'Who am I? Tell me about myself',
        'Show platform statistics',
        'List all pending users',
        'List recent orders',
      ];
    }
    if (role === 'seller') {
      return [
        'Who am I? Tell me about myself',
        'Show my earnings & upcoming revenue',
        'List my products & inventory',
        'List my incoming orders',
      ];
    }
    return [
      'Who am I? Tell me about myself',
      'Browse marketplace products',
      'Show my order history',
    ];
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        height: '650px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Sidebar: Multiple Conversations History */}
      <div
        style={{
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-app)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
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
            <span>Nexus AI</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={handleNewChat}
            title="Start new conversation"
          >
            <Plus size={13} /> New
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, padding: '0.35rem 0.5rem', textTransform: 'uppercase' }}>
            Saved Conversations ({conversations.length})
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
                  marginBottom: '0.25rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isActive ? 'var(--bg-surface)' : 'transparent',
                  border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                  fontSize: '0.8125rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                  <MessageSquare size={13} style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                    {c.title || 'Conversation'}
                  </span>
                </div>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.1rem',
                  }}
                  onClick={(e) => handleDeleteConversation(c._id, e)}
                  title="Delete chat"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Pane */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Chat Header */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Nexus AI Copilot</span>
            <span className="nav-badge" style={{ fontSize: '0.65rem' }}>
              {role.toUpperCase()} ASSISTANT
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Gemini Free LLM Tool Calling
          </span>
        </div>

        {/* Quick Prompts */}
        <div
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--bg-app)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: '0.45rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Suggestions:</span>
          {getQuickPrompts().map((p, i) => (
            <button
              key={i}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.725rem', padding: '0.15rem 0.45rem' }}
              onClick={() => sendMessage(p)}
              disabled={loading}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Messages Stream */}
        <div
          style={{
            flex: 1,
            padding: '1.25rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-bubble ${msg.role}`}>
              {/* Formatted Markdown Content */}
              <FormattedMessage content={msg.content} />

              {/* Collapsible Executed Tools */}
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
                    <span>Executed Tools ({msg.toolExecutions.length})</span>
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
                            <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Tool Arguments:</div>
                            <pre style={{ margin: 0, overflowX: 'auto', maxHeight: '100px' }}>
                              {JSON.stringify(exec.input, null, 2)}
                            </pre>
                            <div style={{ color: 'var(--text-muted)', marginTop: '0.4rem', marginBottom: '0.2rem' }}>
                              Tool Database Response:
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
          ))}

          {loading && (
            <div className="chat-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={14} className="spin" />
              <span>Nexus AI is thinking and executing actions...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <form
          className="ai-chat-input-row"
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
                ? 'Ask Nexus to inspect users, approve/reject/block, or check stats...'
                : role === 'seller'
                ? 'Ask Nexus to add products, show earnings, or update orders...'
                : 'Ask Nexus to browse products, buy items, or check your orders...'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
            <Send size={15} />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
