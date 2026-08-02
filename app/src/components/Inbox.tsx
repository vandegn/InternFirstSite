'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase, getConversations, getMessagesWith, sendMessage, markMessagesAsRead } from '@/lib/supabase';

type Conversation = {
  otherUserId: string;
  otherName: string;
  otherAvatar: string | null;
  otherRole: string;
  lastMessage: string;
  lastSentAt: string;
  unreadCount: number;
};

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  sent_at: string;
  read: boolean;
  sender: {
    full_name: string;
    avatar_url: string | null;
  };
};

export default function Inbox({ backLink, backLabel }: { backLink: string; backLabel: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  // A recipient we've been pointed at (?to=…) who the user hasn't messaged
  // yet, so there's no conversation row to select. Cleared once the first
  // message lands and the real conversation appears.
  const [pendingRecipient, setPendingRecipient] = useState<{ userId: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const convs = await getConversations(user.id);
      setConversations(convs);

      // Opened from a "Message Employer" button: pre-select the recipient and
      // drop a draft in the composer. Nothing is sent until the user hits Send.
      const params = new URLSearchParams(window.location.search);
      const to = params.get('to');
      if (to && to !== user.id) {
        setSelectedUserId(to);
        const draft = params.get('draft');
        if (draft) setNewMessage(draft);
        if (!convs.some((c) => c.otherUserId === to)) {
          setPendingRecipient({ userId: to, name: params.get('name') || 'New message' });
        }
      }

      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!userId || !selectedUserId) return;
    async function fetchMessages() {
      const msgs = await getMessagesWith(userId!, selectedUserId!);
      setMessages(msgs as Message[]);
      const markedCount = await markMessagesAsRead(userId!, selectedUserId!);
      if (markedCount > 0) {
        // Update unread count in conversations list
        setConversations(prev => prev.map(c =>
          c.otherUserId === selectedUserId ? { ...c, unreadCount: 0 } : c
        ));
        window.dispatchEvent(new Event('messages-read'));
      }
    }
    fetchMessages();
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [userId, selectedUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !selectedUserId || !newMessage.trim()) return;
    setSending(true);
    try {
      await sendMessage(userId, selectedUserId, newMessage.trim());
      setNewMessage('');
      const msgs = await getMessagesWith(userId, selectedUserId);
      setMessages(msgs as Message[]);
      // Update last message in conversations
      const convs = await getConversations(userId);
      setConversations(convs);
      // The thread exists now, so it no longer needs the placeholder row.
      setPendingRecipient(null);
    } catch {
      // silently fail
    } finally {
      setSending(false);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  const selectedConv = conversations.find(c => c.otherUserId === selectedUserId);

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1100px', margin: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Inbox</h2>
        <Link href={backLink} className="btn-secondary" style={{ fontSize: '0.85rem', padding: '8px 16px', textDecoration: 'none' }}>
          {backLabel}
        </Link>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', height: '550px', background: 'var(--bg)' }}>
          {/* Conversation list */}
          <div style={{ width: '320px', borderRight: '1px solid var(--border)', overflowY: 'auto', flexShrink: 0 }}>
            {pendingRecipient && (
              <div
                onClick={() => setSelectedUserId(pendingRecipient.userId)}
                style={{
                  padding: '14px 16px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: selectedUserId === pendingRecipient.userId ? 'var(--primary-light)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--primary-light)', color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700,
                  }}>
                    {pendingRecipient.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{pendingRecipient.name}</span>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', margin: '2px 0 0', fontStyle: 'italic' }}>
                      Draft — not sent yet
                    </p>
                  </div>
                </div>
              </div>
            )}
            {conversations.length === 0 && !pendingRecipient ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', opacity: 0.5 }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                <p style={{ fontSize: '0.9rem' }}>No conversations yet</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.otherUserId}
                  onClick={() => setSelectedUserId(conv.otherUserId)}
                  style={{
                    padding: '14px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: selectedUserId === conv.otherUserId ? 'var(--primary-light)' : 'transparent',
                    transition: 'var(--transition)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img
                        src={conv.otherAvatar || 'https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png'}
                        alt={conv.otherName}
                        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                      />
                      {conv.unreadCount > 0 && (
                        <span style={{
                          position: 'absolute', top: -2, right: -2,
                          width: 18, height: 18, borderRadius: '50%',
                          background: 'var(--primary)', color: 'var(--on-primary)',
                          fontSize: '0.65rem', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: conv.unreadCount > 0 ? 700 : 500, fontSize: '0.9rem' }}>{conv.otherName}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', flexShrink: 0 }}>{timeAgo(conv.lastSentAt)}</span>
                      </div>
                      <p style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        margin: '2px 0 0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: conv.unreadCount > 0 ? 600 : 400,
                      }}>
                        {conv.lastMessage}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Message thread */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {!selectedUserId ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ textAlign: 'center' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', opacity: 0.4 }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <p>Select a conversation to start messaging</p>
                </div>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={selectedConv?.otherAvatar || 'https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png'}
                    alt={selectedConv?.otherName || ''}
                    style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {selectedConv?.otherName ?? pendingRecipient?.name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '8px', textTransform: 'capitalize' }}>
                      {selectedConv?.otherRole}
                    </span>
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {messages.length === 0 && (
                    <p style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '280px', lineHeight: 1.5 }}>
                      No messages yet. Edit the draft below and send when you&apos;re ready.
                    </p>
                  )}
                  {messages.map((msg) => {
                    const isMine = msg.sender_id === userId;
                    return (
                      <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '70%',
                          padding: '10px 14px',
                          borderRadius: '16px',
                          background: isMine ? 'var(--primary)' : 'var(--bg-light)',
                          color: isMine ? 'var(--on-primary)' : 'var(--text)',
                          fontSize: '0.9rem',
                          lineHeight: 1.5,
                        }}>
                          <p style={{ margin: 0 }}>{msg.body}</p>
                          <span style={{
                            fontSize: '0.65rem',
                            opacity: 0.7,
                            display: 'block',
                            marginTop: '4px',
                            textAlign: isMine ? 'right' : 'left',
                          }}>
                            {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '24px', border: '1px solid var(--border)', fontSize: '0.9rem', outline: 'none' }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '24px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: 'var(--on-primary)',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer',
                      opacity: sending || !newMessage.trim() ? 0.6 : 1,
                    }}
                  >
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
