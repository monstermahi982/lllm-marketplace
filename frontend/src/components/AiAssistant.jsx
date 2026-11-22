import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../api';
import { Bot, Send, Key, CheckCircle, ChevronDown, ChevronRight, Terminal, RefreshCw } from 'lucide-react';

export default function AiAssistant({ onActionCompleted }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hello Admin! I am your AI Marketplace Agent powered by Gemini with LLM Tool Calling. You can ask me to list users, check pending verifications, approve or block users, inspect orders, check system stats, and more.',
      toolExecutions: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_custom_key') || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [expandedTools, setExpandedTools] = useState({});

  const chatEndRef = useRef(null);

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const checkStatus = async () => {
    try {
      const res = await apiRequest('/ai/status');
      setAiStatus(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('gemini_custom_key', apiKey.trim());
    setShowKeyModal(false);
  };

  const toggleToolExpand = (index) => {
    setExpandedTools((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const sendMessage = async (messageText) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg = { role: 'user', content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiRequest('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(-6),
          customApiKey: apiKey.trim() || undefined,
        }),
      });

      const assistantMsg = {
        role: 'assistant',
        content: res.reply || 'No response generated.',
        toolExecutions: res.toolExecutions || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If tools were executed, trigger refresh of admin tables
      if (res.toolExecutions && res.toolExecutions.length > 0 && onActionCompleted) {
        onActionCompleted();
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error.message}`,
          toolExecutions: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    'Show platform statistics',
    'List all pending users',
    'List all orders',
    'Approve seller@freshgrocers.com',
    'Block bob@example.com',
  ];

  return (
    <div className="card" style={{ padding: 0 }}>
      {/* Header */}
      <div className="ai-chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={18} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Gemini AI Admin Agent</span>
          <span
            className="nav-badge"
            style={{
              fontSize: '0.7rem',
              color: (aiStatus?.hasApiKey || apiKey) ? 'var(--success-text)' : 'var(--warning-text)',
            }}
          >
            {(aiStatus?.hasApiKey || apiKey) ? '● Gemini Connected' : '○ Local Simulation Mode'}
          </span>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowKeyModal(true)}
          title="Configure Gemini API Key"
        >
          <Key size={14} />
          {apiKey ? 'API Key Configured' : 'Set Gemini API Key'}
        </button>
      </div>

      {/* Suggested Quick Prompts */}
      <div
        style={{
          padding: '0.5rem 1rem',
          background: 'var(--bg-app)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quick Prompts:</span>
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => sendMessage(prompt)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem' }}
            disabled={loading}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="ai-chat-messages" style={{ height: '440px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-bubble ${msg.role}`}>
            <div>{msg.content}</div>

            {/* Tool Execution Logs */}
            {msg.toolExecutions && msg.toolExecutions.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    marginBottom: '0.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Terminal size={13} />
                  <span>Executed Tools ({msg.toolExecutions.length})</span>
                </div>
                {msg.toolExecutions.map((exec, eIdx) => {
                  const keyId = `${idx}-${eIdx}`;
                  const isExpanded = expandedTools[keyId];
                  return (
                    <div key={eIdx} className="tool-execution-card">
                      <div
                        onClick={() => toggleToolExpand(keyId)}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ color: 'var(--text-primary)' }}>
                          🛠️ {exec.tool}()
                        </span>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: '0.4rem', borderTop: '1px dashed var(--border)', paddingTop: '0.4rem' }}>
                          <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Input Arguments:</div>
                          <pre style={{ margin: 0, overflowX: 'auto' }}>
                            {JSON.stringify(exec.input, null, 2)}
                          </pre>
                          <div style={{ color: 'var(--text-muted)', marginTop: '0.4rem', marginBottom: '0.2rem' }}>
                            Tool Response:
                          </div>
                          <pre style={{ margin: 0, overflowX: 'auto', maxHeight: '180px' }}>
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
            <span>Agent is reasoning and executing tools...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Row */}
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
          placeholder="Ask AI to inspect users, approve/reject/block, check orders, or view stats..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
          <Send size={15} />
          Send
        </button>
      </form>

      {/* Modal for Setting Gemini API Key */}
      {showKeyModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Configure Gemini API Key</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Enter your free Google Gemini API Key from Google AI Studio. This enables live AI tool calling.
            </p>
            <div className="form-group">
              <label className="form-label">Gemini API Key</label>
              <input
                type="password"
                className="input-text"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowKeyModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveApiKey}>
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
