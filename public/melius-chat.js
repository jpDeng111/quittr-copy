const MELIUS_SESSION_KEY = "quittr-melius-conversation-v1";

function loadMeliusConversation() {
  if (window.QUITTR_ACCOUNT) return window.QUITTR_ACCOUNT.chat.messages;
  try {
    const saved = JSON.parse(sessionStorage.getItem(MELIUS_SESSION_KEY));
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.text === "string" && typeof item.id === "string")
      .map((item) => item.status === "pending" ? { ...item, status: "failed", error: "上次回复中断了，可以重新发送。" } : item.status === "streaming" ? { ...item, status: "interrupted" } : item);
  } catch { return []; }
}

function useMeliusConversation(onUpdated) {
  const [messages, setMessages] = useState(loadMeliusConversation);
  const [isSending, setIsSending] = useState(false);
  const messagesRef = useRef(messages);
  const busyRef = useRef(false);
  const controllerRef = useRef(null);
  const [olderCursor, setOlderCursor] = useState(() => window.QUITTR_ACCOUNT?.chat.nextCursor || null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState('');
  messagesRef.current = messages;
  useEffect(() => {
    if (window.QUITTR_ACCOUNT) return;
    try { sessionStorage.setItem(MELIUS_SESSION_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  async function loadOlder() {
    if (!olderCursor || loadingOlder || busyRef.current) return;
    setLoadingOlder(true); setHistoryError('');
    try {
      const result = await accountRequest(`/api/melius/history?before=${encodeURIComponent(olderCursor)}`);
      setMessages(current => [...result.messages.filter(item => !current.some(existing => existing.id === item.id)), ...current]);
      setOlderCursor(result.nextCursor);
    } catch (error) { setHistoryError(error.message); } finally { setLoadingOlder(false); }
  }

  async function send(text, retryId) {
    if (busyRef.current) return null;
    const history = messagesRef.current;
    const retry = retryId ? history.find((message) => message.id === retryId && message.role === "user" && message.status === "failed") : null;
    if (retryId && !retry) return null;
    const value = (retry ? retry.text : text).trim();
    if (!value) return null;
    const id = retry ? retry.id : crypto.randomUUID();
    const context = retry ? retry.context : [...history.filter((message) => message.role === "assistant" ? !["streaming", "interrupted"].includes(message.status) : message.status === "answered").map(({ role, text }) => ({ role, text })), { role: "user", text: value }].slice(-12);
    const userMessage = { id, role: "user", text: value, status: "pending", context, createdAt: new Date().toISOString() };
    busyRef.current = true;
    setIsSending(true);
    setMessages((current) => retry ? current.filter((message) => message.id !== `${id}-reply`).map((message) => message.id === id ? { ...message, status: "pending", error: "" } : message) : [...current, userMessage]);
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    try {
      const result = await sendMeliusMessage(context, id, controller.signal, (event) => {
        if (controller.signal.aborted) return;
        if (event.type === "reset") {
          setMessages((current) => current.flatMap((message) => message.id !== `${id}-reply` ? [message] : message.actions?.length ? [{ ...message, text: "" }] : []));
          return;
        }
        if (event.type === "card" && event.card?.type === "content_card") {
          setMessages((current) => {
            const existing = current.find((message) => message.id === `${id}-reply`);
            const actions = [...(existing?.actions || []).filter((action) => action.id !== event.card.id), event.card];
            return existing ? current.map((message) => message.id === existing.id ? { ...message, actions } : message)
              : [...current, { id: `${id}-reply`, role: "assistant", text: "", status: "streaming", actions, createdAt: new Date().toISOString() }];
          });
          return;
        }
        if (event.type !== "delta" || !event.text) return;
        setMessages((current) => {
          const existing = current.find((message) => message.id === `${id}-reply`);
          return existing ? current.map((message) => message.id === existing.id ? { ...message, text: message.text + event.text } : message)
            : [...current, { id: `${id}-reply`, role: "assistant", text: event.text, status: "streaming", actions: [], createdAt: new Date().toISOString() }];
        });
      });
      if (!result.reply?.trim()) throw new Error("没有收到有效回复，请重试。");
      setMessages((current) => [
        ...current.filter((message) => message.id !== `${id}-reply`).map((message) => message.id === id ? { ...message, status: "answered", error: "", actions: [] } : message),
        { id: `${id}-reply`, role: "assistant", status: "complete", text: result.reply, actions: result.actions || [], createdAt: new Date().toISOString() }
      ]);
      try { await onUpdated(result.actions || []); } catch {}
      return result;
    } catch (error) {
      const actions = error.actions || [];
      setMessages((current) => current.map((message) => message.id === `${id}-reply` ? { ...message, status: "interrupted" } : message.id === id ? {
        ...message, status: "failed", actions,
        error: error.name === "AbortError" ? "回复已中断，可以重新发送。已保存的记录不会重复。" : getClientErrorMessage(error)
      } : message));
      try { await onUpdated(actions); } catch {}
      return null;
    } finally {
      window.clearTimeout(timeout);
      busyRef.current = false;
      controllerRef.current = null;
      setIsSending(false);
    }
  }
  return { messages, isSending, send, olderCursor, loadingOlder, historyError, loadOlder, stopWaiting: () => controllerRef.current?.abort() };
}

function MeliusArtifactCard({ card, onDiscuss }) {
  const [selected, setSelected] = useState(null);
  const [copyState, setCopyState] = useState('');
  const variants = { plan: { label: '给今天的小计划', english: 'A LITTLE PLAN', icon: '↗' }, insight: { label: '换一个角度看', english: 'A LITTLE INSIGHT', icon: '✧' }, reflection: { label: '把感受轻轻理顺', english: 'A MOMENT TO REFLECT', icon: '◌' } };
  const variant = variants[card.kind] || variants.insight;
  async function copy() {
    try {
      await navigator.clipboard.writeText([card.title, card.body, ...card.items.map((item, i) => `${i + 1}. ${item.title}：${item.body}`), card.takeaway].join('\n\n'));
      setCopyState('已复制');
    } catch { setCopyState('复制失败，可长按文字复制'); }
  }
  return h('article', { className: `melius-artifact artifact-${card.kind}`, 'aria-label': `${variant.label}：${card.title}` },
    h('header', { className: 'artifact-top' }, h('span', { className: 'artifact-brand' }, h('span', { className: 'artifact-spark', 'aria-hidden': true }, '✦'), 'MELIUS'), h('span', { className: 'artifact-type' }, variant.label)),
    h('div', { className: 'artifact-heading' }, h('span', { className: 'artifact-eyebrow' }, variant.english), h('h3', null, card.title), h('p', null, card.body), h('span', { className: 'artifact-emblem', 'aria-hidden': true }, variant.icon)),
    h('div', { className: 'artifact-items' }, card.items.map((item, index) => card.kind === 'plan' ?
      h('button', { key: index, type: 'button', className: `artifact-item${selected === index ? ' is-chosen' : ''}`, 'aria-pressed': selected === index, onClick: () => setSelected(selected === index ? null : index) },
        h('span', { className: 'artifact-number' }, selected === index ? '✓' : String(index + 1).padStart(2, '0')), h('span', null, h('strong', null, item.title), h('span', { className: 'artifact-item-body' }, item.body)), h('span', { className: 'artifact-choice', 'aria-hidden': true })) :
      h('div', { key: index, className: 'artifact-item' }, h('span', { className: 'artifact-number' }, String(index + 1).padStart(2, '0')), h('span', null, h('strong', null, item.title), h('span', { className: 'artifact-item-body' }, item.body))))),
    h('div', { className: 'artifact-takeaway' }, h('span', { 'aria-hidden': true }, '✧'), h('p', null, card.takeaway)),
    card.kind === 'plan' && h('small', { className: 'artifact-selection', role: 'status' }, selected === null ? '选一件，先试试看。' : `想先试试：${card.items[selected].title}`),
    h('footer', { className: 'artifact-footer' }, h('button', { type: 'button', onClick: () => onDiscuss(card), 'aria-label': `继续聊「${card.title}」` }, '继续聊这个', h('span', { 'aria-hidden': true }, '↗')), h('button', { type: 'button', onClick: copy, 'aria-label': '复制卡片' }, copyState || '复制卡片')),
    h('span', { className: 'artifact-note' }, 'Melius 为你整理 · 建议卡片')
  );
}

function ChatActionCard({ action, onAction }) {
  const breathing = action.type === "game" && action.gameId === "breath";
  return h("div", { className: "chat-action-card" },
    h("span", { className: "chat-action-icon" }, h(Icon, { name: breathing ? "wind" : action.type === "game" ? "brain" : "check-circle" })),
    h("div", null, h("strong", null, breathing ? "深呼吸练习" : action.title), h("p", null, action.detail),
      h("button", { type: "button", onClick: () => onAction(action.type === "game" ? `melius game ${action.gameId}` : action.route) },
        breathing ? "进入呼吸练习" : action.type === "game" ? "打开游戏" : action.route === "reasons" ? "查看动力" : action.route === "journal" ? "查看日记" : "查看统计", h(Icon, { name: "chevron" }))
    )
  );
}

function renderChatText(text) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? h("strong", { key: index }, part.slice(2, -2)) : part);
}

function MeliusChatPage({ chat, onAction, onBack }) {
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const recognitionRef = useRef(null);
  const voiceTimerRef = useRef(null);
  const endRef = useRef(null);
  const activeRef = useRef(true);
  const composerRef = useRef(null);
  const { messages, isSending } = chat;
  useEffect(() => {
    const input = composerRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(120, input.scrollHeight)}px`;
  }, [draft]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      window.clearTimeout(voiceTimerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      }
    };
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: isSending ? "auto" : "smooth", block: "end" }); }, [messages, isSending]);
  useEffect(() => {
    setElapsed(0);
    if (!isSending) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isSending]);

  function toggleVoice() {
    if (recognitionRef.current) { recognitionRef.current.stop(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceNotice("当前浏览器不支持语音识别。可在桌面版 Chrome 中使用，或使用 macOS 听写输入。");
      return;
    }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    const prefix = draft.trim();
    recognition.onresult = (event) => {
      if (!activeRef.current) return;
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join("");
      setDraft([prefix, transcript].filter(Boolean).join(" "));
    };
    recognition.onerror = (event) => {
      if (!activeRef.current) return;
      const notices = {
        "not-allowed": "未获得麦克风权限。请允许此应用使用麦克风后重试。",
        "audio-capture": "没有检测到可用的麦克风。",
        network: "语音识别网络连接失败，已识别的文字会保留。",
        "no-speech": "没有听到声音，可以再次点击麦克风。"
      };
      if (event.error !== "aborted") setVoiceNotice(notices[event.error] || "语音识别未完成，可以重试或直接输入。");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      window.clearTimeout(voiceTimerRef.current);
      if (activeRef.current) setIsListening(false);
    };
    try {
      recognition.start();
      setIsListening(true);
      setVoiceNotice("正在听… 再点一次结束。识别文字可编辑，点击发送后才提交。");
      voiceTimerRef.current = window.setTimeout(() => recognition.stop(), 60000);
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceNotice("无法启动麦克风，请稍后重试。");
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (isSending || isListening || !draft.trim()) return;
    const text = draft;
    setDraft("");
    const result = await chat.send(text);
    const game = result?.actions?.find((action) => action.type === "game" && action.autoOpen);
    if (game && activeRef.current) onAction(`melius game ${game.gameId}`);
  }

  async function retry(messageId) {
    const result = await chat.send("", messageId);
    const game = result?.actions?.find((action) => action.type === "game" && action.autoOpen);
    if (game && activeRef.current) onAction(`melius game ${game.gameId}`);
  }

  return h("section", { className: "chat-page" },
    h("header", { className: "chat-header" },
      h("button", { type: "button", onClick: onBack, "aria-label": "Back to analytics" }, h(Icon, { name: "chevron-left" })),
      h("span", null, h("strong", null, "Melius"), h("small", null, "聊一聊，也可以一起做点改变")),
      h("button", { type: "button", className: "chat-journal-link", onClick: () => onAction("journal"), "aria-label": "查看日记" }, h(Icon, { name: "journal" }))
    ),
    h("div", { className: "chat-thread", "aria-label": "Conversation" },
      chat.olderCursor ? h("button", { type: "button", className: "auth-link", disabled: isSending || chat.loadingOlder, onClick: chat.loadOlder }, chat.loadingOlder ? "正在加载…" : "加载更早的对话") : null,
      chat.historyError ? h("p", { role: "alert", className: "auth-error" }, chat.historyError) : null,
      messages.length === 0 ? h("div", { className: "empty-chat" },
        h("span", { className: "chat-welcome-icon" }, h(Icon, { name: "melius" })),
        h("strong", null, "从一句话开始"), h("p", null, "感受、动力或一次小小的进步，都可以告诉我。\n明确的记录会归入日记与统计。"),
        h("div", { className: "chat-suggestions" }, ["给我一张今晚不熬夜的行动卡", "用小卡片讲讲冲动和行动的区别", "做做深呼吸", "帮我复盘今天的感受"].map((text) => h("button", { key: text, type: "button", onClick: () => setDraft(text) }, text)))
      ) : null,
      messages.map((message) => h("div", { key: message.id, className: `chat-message ${message.role}${message.actions?.some((action) => action.type === "content_card") ? " has-artifact" : ""}` },
        message.text ? h("p", { className: `chat-bubble ${message.role}${message.status === "streaming" ? " is-streaming" : ""}` }, message.role === "assistant" ? renderChatText(message.text) : message.text) : null,
        message.status === "interrupted" ? h("small", { className: "chat-interrupted" }, "回复已中断，以上内容可能不完整") : null,
        ...(message.actions || []).map((action) => action.type === "content_card" ? h(MeliusArtifactCard, { key: action.id, card: action, onDiscuss: (card) => setDraft(`关于「${card.title}」，我想继续聊聊。`) }) : h(ChatActionCard, { key: action.id, action, onAction })),
        message.status === "failed" ? h("div", { className: "chat-retry", role: "alert" },
          h("span", null, message.error || "这条消息还没有收到回复。"),
          h("button", { type: "button", disabled: isSending, onClick: () => retry(message.id) }, h(Icon, { name: "undo" }), "重新发送")
        ) : null
      )),
      isSending ? h("div", { className: "chat-pending", role: "status" },
        !messages.some((message) => message.status === "streaming") ? h("p", { className: "chat-bubble assistant is-thinking" }, elapsed >= 20 ? "回复比平时久一点，记录不会重复保存…" : "Melius 正在回复…") : null,
        h("button", { type: "button", onClick: chat.stopWaiting }, "停止输出")
      ) : null,
      h("div", { ref: endRef })
    ),
    h("div", { className: "chat-input-area" },
      voiceNotice ? h("p", { className: `voice-notice${isListening ? " listening" : ""}`, role: "status" }, isListening ? voiceNotice : voiceNotice.startsWith("正在听") ? "语音已结束，检查文字后发送。" : voiceNotice) : null,
      h("form", { className: "chat-composer", onSubmit: submit },
        h("button", { className: `chat-mic${isListening ? " is-listening" : ""}`, type: "button", disabled: isSending, onClick: toggleVoice, "aria-label": isListening ? "Stop voice input" : "Voice input", "aria-pressed": isListening, title: isListening ? "结束语音输入" : "语音输入" }, h(Icon, { name: isListening ? "stop" : "microphone" })),
        h("textarea", { ref: composerRef, value: draft, onChange: (event) => setDraft(event.target.value), placeholder: "说说现在的感受…", "aria-label": "Message Melius", rows: 1, maxLength: 3000, enterKeyHint: 'enter',
          onKeyDown: (event) => { if (window.matchMedia?.('(pointer: coarse)').matches) return; if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !event.isComposing) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } } }),
        h("button", { className: "chat-send", type: "submit", disabled: isSending || isListening || !draft.trim(), "aria-label": "Send" }, h(Icon, { name: "send" }))
      ),
      h("small", { className: "chat-input-hint" }, "语音先转文字，再发送 · 未收到回复可重提")
    )
  );
}

function JournalPage({ entries, onAction, onBack }) {
  const [category, setCategory] = useState("all");
  const labels = { all: "全部", reflection: "日记", motivation: "动力", post_relapse: "破戒复盘", check_in: "未破戒" };
  const visible = entries.filter((entry) => category === "all" || (entry.category || "reflection") === category);
  return h("section", { className: "journal-archive" },
    h("header", { className: "chat-header" }, h("button", { type: "button", onClick: onBack, "aria-label": "Back" }, h(Icon, { name: "chevron-left" })),
      h("span", null, h("strong", null, "Journal"), h("small", null, "把每一步改变留在这里")),
      h("button", { type: "button", className: "chat-journal-link", onClick: () => onAction("new entry"), "aria-label": "New entry" }, h(Icon, { name: "edit" }))
    ),
    h("nav", { className: "journal-filters", "aria-label": "Journal categories" }, Object.entries(labels).map(([key, label]) => h("button", { key, type: "button", className: category === key ? "is-active" : "", "aria-pressed": category === key, onClick: () => setCategory(key) }, label))),
    visible.length ? visible.map((entry) => h("article", { key: entry.id, className: "journal-record" },
      h("header", null, h("span", null, labels[entry.category || "reflection"] || "日记"), h("time", null, new Date(entry.createdAt).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" }))),
      h("h2", null, entry.title), h("p", null, entry.body),
      entry.sourceQuote ? h("details", null, h("summary", null, "查看对话原文"), h("blockquote", null, entry.sourceQuote)) : null
    )) : h("p", { className: "journal-empty" }, "这里还没有记录。你可以在 Melius 里聊聊，或手动写一篇日记。")
  );
}
