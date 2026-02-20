import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import logo from "./assets/logo.png";

const API_BASE = "http://192.168.1.62:8000";

const LS_TOKEN = "token";
const LS_LAST_SEEN = "last_seen_by_convo_v1"; // { [convoId]: lastSeenMessageId }

function loadLastSeen() {
  try {
    return JSON.parse(localStorage.getItem(LS_LAST_SEEN) || "{}") || {};
  } catch {
    return {};
  }
}

function saveLastSeen(map) {
  localStorage.setItem(LS_LAST_SEEN, JSON.stringify(map));
}

function initialsFor(name) {
  const s = (name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || "";
  return (a + b).toUpperCase();
}

function hashColor(name) {
  const s = (name || "user").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 45%)`;
}

function AvatarLetter({ name, size = 36 }) {
  const bg = hashColor(name);
  return (
    <div
      title={name || ""}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: "rgba(255,255,255,0.95)",
        display: "grid",
        placeItems: "center",
        fontWeight: 900,
        letterSpacing: 0.5,
        fontSize: Math.max(12, Math.round(size * 0.38)),
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
        flex: "0 0 auto",
        userSelect: "none",
      }}
    >
      {initialsFor(name)}
    </div>
  );
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function safeJson(res) {
  return res.text().then((t) => {
    try {
      return t ? JSON.parse(t) : {};
    } catch {
      return {};
    }
  });
}

async function api(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await safeJson(res);
  if (!res.ok) {
    const msg = data?.detail || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

const Sidebar = memo(function Sidebar({
  me,
  conversations,
  selectedId,
  loadingConvos,
  newChatName,
  chatError,
  styles,
  onSelectConversation,
  onLogout,
  onNewChatChange,
  onStartChat,
  newChatRef,
  setDrawerOpen,
  convoMeta, // { [id]: { lastText, lastAt, unreadCount } }
}) {
  return (
    <div className="fm-sidebar" style={{ display: "flex", flexDirection: "column" }}>
      <div style={styles.sidebarTop}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={logo} alt="Friendly" style={{ height: 26 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Friendly</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Messenger</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AvatarLetter name={me?.username} size={34} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 13,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {me?.username}
            </div>
            <button onClick={onLogout} style={styles.linkBtn}>
              Log out
            </button>
          </div>
        </div>
      </div>

      <div style={styles.newChat}>
        <input
          ref={newChatRef}
          value={newChatName}
          onChange={(e) => onNewChatChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onStartChat();
            }
          }}
          placeholder="Start chat with… (alex)"
          style={styles.input2}
          autoComplete="off"
          inputMode="text"
        />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onStartChat}
          style={styles.smallBtn}
        >
          Chat
        </button>
      </div>

      {chatError ? (
        <div style={{ ...styles.error, margin: "0 14px 10px" }}>{chatError}</div>
      ) : null}

      <div style={styles.list}>
        {loadingConvos && conversations.length === 0 ? (
          <div style={styles.muted}>Loading conversations…</div>
        ) : null}

        {conversations.map((c) => {
          const active = c.id === selectedId;
          const meta = convoMeta?.[c.id] || {};
          const hasUnread = (meta.unreadCount || 0) > 0;

          return (
            <button
              key={c.id}
              onClick={() => {
                onSelectConversation(c.id);
                if (setDrawerOpen) setDrawerOpen(false);
              }}
              style={{ ...styles.convoRow, ...(active ? styles.convoRowActive : {}) }}
            >
              <div style={{ position: "relative" }}>
                <AvatarLetter name={c.other_username} size={36} />
                {hasUnread ? <span className="fm-unread-dot" /> : null}
              </div>

              <div style={{ textAlign: "left", minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.other_username}
                  </div>

                  {hasUnread ? (
                    <span className="fm-unread-badge">{meta.unreadCount}</span>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 3 }}>
                  <div className="fm-preview">
                    {meta.lastText ? meta.lastText : `Conversation #${c.id}`}
                  </div>
                  {meta.lastAt ? (
                    <div className="fm-time">{formatTime(meta.lastAt)}</div>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}

        {conversations.length === 0 && !loadingConvos ? (
          <div style={styles.muted}>No chats yet. Start one by typing a username above.</div>
        ) : null}
      </div>
    </div>
  );
});

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(LS_TOKEN) || "");
  const [me, setMe] = useState(null);

  const [authMode, setAuthMode] = useState("login");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authError, setAuthError] = useState("");

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [newChatName, setNewChatName] = useState("");
  const [chatError, setChatError] = useState("");

  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [msgError, setMsgError] = useState("");

  const [loadingConvos, setLoadingConvos] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Mobile drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Scroll handling
  const listRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  const newChatRef = useRef(null);

  // Prevent convo jumping
  const selectedIdRef = useRef(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Unread tracking
  const [lastSeenByConvo, setLastSeenByConvo] = useState(() => loadLastSeen());

  // convoMeta: last message preview + unread counts
  const [convoMeta, setConvoMeta] = useState({}); // { [id]: { lastText, lastAt, unreadCount } }

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  function onScrollMessages() {
    const el = listRef.current;
    if (!el) return;
    const threshold = 120;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < threshold;
  }

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  function markConversationSeen(conversationId, messageList) {
    if (!conversationId) return;
    const last = messageList?.length ? messageList[messageList.length - 1] : null;
    if (!last?.id) return;

    setLastSeenByConvo((prev) => {
      const next = { ...prev, [conversationId]: last.id };
      saveLastSeen(next);
      return next;
    });
  }

  // AUTH: load me
  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      if (!token) {
        setMe(null);
        return;
      }
      try {
        const data = await api("/auth/me", { token });
        if (cancelled) return;

        setMe(data);
        setTimeout(() => newChatRef.current?.focus(), 50);
      } catch {
        localStorage.removeItem(LS_TOKEN);
        if (!cancelled) {
          setToken("");
          setMe(null);
        }
      }
    }

    loadMe();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Poll conversations
  useEffect(() => {
    if (!token || !me) return;

    let cancelled = false;
    let timer = null;

    async function tick() {
      try {
        setLoadingConvos(true);
        const data = await api("/conversations", { token });
        if (cancelled) return;

        setConversations(data);

        // only auto-select if nothing selected
        if (data.length > 0 && !selectedIdRef.current) {
          setSelectedId(data[0].id);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingConvos(false);
        timer = setTimeout(tick, 2500);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, me]);

  // Poll messages for selected convo
  useEffect(() => {
    if (!token || !me || !selectedId) return;

    let cancelled = false;
    let timer = null;

    async function tick() {
      try {
        setLoadingMsgs(true);
        const data = await api(`/conversations/${selectedId}/messages`, { token });
        if (cancelled) return;

        setMessages(data);

        // Update meta + unread for this convo based on lastSeen
        const last = data.length ? data[data.length - 1] : null;
        const lastSeen = lastSeenByConvo[selectedId] || 0;

        let unreadCount = 0;
        if (lastSeen) {
          unreadCount = data.filter((m) => Number(m.id) > Number(lastSeen)).length;
        } else {
          // if never opened before, treat as unread unless it's empty
          unreadCount = data.length;
        }

        setConvoMeta((prev) => ({
          ...prev,
          [selectedId]: {
            lastText: last?.text || "",
            lastAt: last?.created_at || "",
            unreadCount: unreadCount,
          },
        }));

        // auto scroll if near bottom
        if (shouldAutoScrollRef.current) {
          requestAnimationFrame(scrollToBottom);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingMsgs(false);
        timer = setTimeout(tick, 1200);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, me, selectedId, lastSeenByConvo]);

  useEffect(() => {
    if (!token || !me || conversations.length === 0) return;

    let cancelled = false;

    async function refreshMetaForAll() {
      try {
        const updates = {};

        for (const c of conversations) {
          const msgs = await api(`/conversations/${c.id}/messages`, { token });
          if (cancelled) return;

          const last = msgs.length ? msgs[msgs.length - 1] : null;
          const lastSeen = lastSeenByConvo[c.id] || 0;

          let unreadCount = 0;
          if (lastSeen) unreadCount = msgs.filter((m) => Number(m.id) > Number(lastSeen)).length;
          else unreadCount = msgs.length;

          updates[c.id] = {
            lastText: last?.text || "",
            lastAt: last?.created_at || "",
            unreadCount,
          };
        }

        if (!cancelled) setConvoMeta(updates);
      } catch {
        // ignore
      }
    }

    refreshMetaForAll();
    const t = setInterval(refreshMetaForAll, 3000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [token, me, conversations, lastSeenByConvo]);

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");

    const username = authUser.trim();
    const password = authPass;

    if (!username || !password) {
      setAuthError("Please enter username and password.");
      return;
    }

    try {
      if (authMode === "register") {
        await api("/auth/register", { method: "POST", body: { username, password } });
      }
      const login = await api("/auth/login", { method: "POST", body: { username, password } });
      localStorage.setItem(LS_TOKEN, login.access_token);
      setToken(login.access_token);
      setAuthPass("");
    } catch (err) {
      setAuthError(err.message || "Auth failed.");
    }
  }

  function logout() {
    localStorage.removeItem(LS_TOKEN);
    setToken("");
    setMe(null);
    setConversations([]);
    setSelectedId(null);
    setMessages([]);
    setDrawerOpen(false);
  }

  async function startChat() {
    setChatError("");
    const username = newChatName.trim();
    if (!username) return;

    try {
      const convo = await api("/conversations", {
        method: "POST",
        token,
        body: { username },
      });

      setNewChatName("");

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === convo.id);
        return exists ? prev : [convo, ...prev];
      });

      setSelectedId(convo.id);
      setDrawerOpen(false);

      setTimeout(() => newChatRef.current?.focus(), 50);
    } catch (err) {
      setChatError(err.message || "Failed to start chat");
    }
  }

  async function sendMessage() {
    setMsgError("");
    const text = msgText.trim();
    if (!text || !selectedId) return;

    try {
      const tempId = `temp-${Date.now()}`;
      const optimistic = {
        id: tempId,
        conversation_id: selectedId,
        sender_username: me.username,
        text,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimistic]);
      setMsgText("");

      shouldAutoScrollRef.current = true;
      requestAnimationFrame(scrollToBottom);

      await api(`/conversations/${selectedId}/messages`, {
        method: "POST",
        token,
        body: { text },
      });
    } catch (err) {
      setMsgError(err.message || "Failed to send");
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    // once it loads, mark as seen
    markConversationSeen(selectedId, messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Also mark as seen when user is at bottom (prevents unread staying forever)
  useEffect(() => {
    if (!selectedId || messages.length === 0) return;
    if (shouldAutoScrollRef.current) {
      markConversationSeen(selectedId, messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // ---------- UI ----------
  if (!token || !me) {
    return (
      <div style={styles.fullCenter}>
        <div style={styles.authCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <img src={logo} alt="Friendly" style={{ height: 36 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Friendly Messenger</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Log in to chat with friends</div>
            </div>
          </div>

          <div style={styles.tabs}>
            <button
              onClick={() => setAuthMode("login")}
              style={{ ...styles.tab, ...(authMode === "login" ? styles.tabActive : {}) }}
            >
              Log in
            </button>
            <button
              onClick={() => setAuthMode("register")}
              style={{ ...styles.tab, ...(authMode === "register" ? styles.tabActive : {}) }}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleAuthSubmit}>
            <label style={styles.label}>Username</label>
            <input
              value={authUser}
              onChange={(e) => setAuthUser(e.target.value)}
              placeholder="e.g. seth"
              style={styles.input}
              autoComplete="username"
            />

            <label style={styles.label}>Password</label>
            <input
              value={authPass}
              onChange={(e) => setAuthPass(e.target.value)}
              placeholder="••••••••"
              style={styles.input}
              type="password"
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
            />

            {authError ? <div style={styles.error}>{authError}</div> : null}

            <button style={styles.primaryBtn} type="submit">
              {authMode === "login" ? "Log in" : "Create account"}
            </button>

            <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 12 }}>
              No tokens. No weird steps. Just log in.
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {drawerOpen ? <div className="fm-overlay" onClick={() => setDrawerOpen(false)} /> : null}

      <div className={`fm-drawer ${drawerOpen ? "open" : ""}`}>
        <Sidebar
          me={me}
          conversations={conversations}
          selectedId={selectedId}
          loadingConvos={loadingConvos}
          newChatName={newChatName}
          chatError={chatError}
          styles={styles}
          onSelectConversation={(id) => {
            setSelectedId(id);
            // mark as seen immediately on open
            const meta = convoMeta[id];
            if (meta && messages.length) markConversationSeen(id, messages);
          }}
          onLogout={logout}
          onNewChatChange={setNewChatName}
          onStartChat={startChat}
          newChatRef={newChatRef}
          setDrawerOpen={setDrawerOpen}
          convoMeta={convoMeta}
        />
      </div>

      <div className="fm-shell">
        <Sidebar
          me={me}
          conversations={conversations}
          selectedId={selectedId}
          loadingConvos={loadingConvos}
          newChatName={newChatName}
          chatError={chatError}
          styles={styles}
          onSelectConversation={(id) => {
            setSelectedId(id);
          }}
          onLogout={logout}
          onNewChatChange={setNewChatName}
          onStartChat={startChat}
          newChatRef={newChatRef}
          setDrawerOpen={null}
          convoMeta={convoMeta}
        />

        <div className="fm-chatpanel">
          <div className="fm-topbar">
            <button className="fm-topbar-btn" onClick={() => setDrawerOpen(true)} aria-label="Open chats">
              ☰
            </button>

            <div className="title">
              <AvatarLetter name={selectedConversation?.other_username || me.username} size={34} />
              <div style={{ minWidth: 0 }}>
                <div className="name">{selectedConversation?.other_username || "Select a chat"}</div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  {selectedConversation ? "Chat" : "Open chats to select"}
                </div>
              </div>
            </div>

            <button className="fm-topbar-btn" onClick={logout} aria-label="Log out">
              ⎋
            </button>
          </div>

          <div style={styles.chatTop}>
            {selectedConversation ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AvatarLetter name={selectedConversation.other_username} size={36} />
                <div>
                  <div style={{ fontWeight: 850, fontSize: 14 }}>{selectedConversation.other_username}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    Messages update automatically (no refresh)
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--muted)" }}>Select a conversation</div>
            )}
          </div>

          <div ref={listRef} onScroll={onScrollMessages} style={styles.messages}>
            {selectedId && loadingMsgs && messages.length === 0 ? (
              <div style={styles.muted}>Loading messages…</div>
            ) : null}

            {!selectedId ? <div style={styles.muted}>Pick a chat (☰ on mobile).</div> : null}

            {messages.map((m) => {
              const mine = m.sender_username?.toLowerCase() === me.username.toLowerCase();
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 12,
                    flexDirection: mine ? "row-reverse" : "row",
                  }}
                >
                  <AvatarLetter name={m.sender_username} size={32} />
                  <div style={{ maxWidth: "72%" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: mine ? "flex-end" : "flex-start",
                        gap: 10,
                        marginBottom: 4,
                      }}
                    >
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{mine ? "You" : m.sender_username}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{formatTime(m.created_at)}</div>
                    </div>

                    <div style={{ ...styles.bubble, ...(mine ? styles.bubbleMine : styles.bubbleTheirs) }}>
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={styles.composer}>
            {msgError ? <div style={{ ...styles.error, marginBottom: 8 }}>{msgError}</div> : null}

            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={selectedId ? "Type a message…" : "Select a conversation first…"}
                style={{ ...styles.input2, flex: 1 }}
                disabled={!selectedId}
              />
              <button onClick={sendMessage} style={styles.smallBtn} disabled={!selectedId || !msgText.trim()}>
                Send
              </button>
            </div>

            <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>
              Tip: Press <b>Enter</b> to send.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  fullCenter: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
  },
  authCard: {
    width: "min(420px, 92vw)",
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "var(--shadow)",
    backdropFilter: "blur(10px)",
  },
  tabs: {
    display: "flex",
    gap: 8,
    background: "var(--panel2)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 6,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    border: "none",
    background: "transparent",
    color: "var(--text)",
    padding: "10px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 750,
  },
  tabActive: {
    background: "var(--brand2)",
    border: "1px solid rgba(79, 124, 255, 0.35)",
  },
  label: {
    display: "block",
    marginTop: 10,
    marginBottom: 6,
    color: "var(--muted)",
    fontSize: 12,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "rgba(0,0,0,0.25)",
    color: "var(--text)",
    outline: "none",
  },
  input2: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "rgba(0,0,0,0.18)",
    color: "var(--text)",
    outline: "none",
  },
  primaryBtn: {
    marginTop: 14,
    width: "100%",
    border: "none",
    borderRadius: 12,
    padding: "12px 12px",
    background: "linear-gradient(180deg, rgba(79,124,255,0.95), rgba(79,124,255,0.75))",
    color: "white",
    fontWeight: 850,
    cursor: "pointer",
  },
  smallBtn: {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    padding: "10px 14px",
    background: "rgba(79,124,255,0.20)",
    color: "var(--text)",
    fontWeight: 850,
    cursor: "pointer",
  },
  error: {
    marginTop: 10,
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255, 80, 80, 0.35)",
    background: "rgba(255, 80, 80, 0.10)",
    color: "rgba(255, 210, 210, 0.95)",
    fontSize: 13,
    fontWeight: 650,
  },
  muted: {
    color: "var(--muted)",
    fontSize: 13,
    padding: 14,
  },
  sidebarTop: {
    padding: 14,
    borderBottom: "1px solid var(--border)",
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
  },
  linkBtn: {
    border: "none",
    background: "transparent",
    color: "var(--muted)",
    padding: 0,
    cursor: "pointer",
    fontSize: 12,
    textDecoration: "underline",
  },
  newChat: {
    padding: 14,
    display: "flex",
    gap: 10,
    borderBottom: "1px solid var(--border)",
  },
  list: {
    overflow: "auto",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  convoRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(0,0,0,0.16)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "var(--text)",
    cursor: "pointer",
  },
  convoRowActive: {
    background: "var(--brand2)",
    border: "1px solid rgba(79, 124, 255, 0.35)",
  },
  chatTop: {
    padding: 14,
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  messages: {
    flex: 1,
    overflow: "auto",
    padding: 16,
  },
  bubble: {
    padding: "10px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    lineHeight: 1.35,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  bubbleMine: {
    background: "var(--mine)",
  },
  bubbleTheirs: {
    background: "var(--theirs)",
  },
  composer: {
    padding: 14,
    borderTop: "1px solid var(--border)",
    background: "rgba(0,0,0,0.10)",
  },
};
