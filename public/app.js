const { createElement: h, useEffect, useState } = React;
const { createRoot } = ReactDOM;

const API_BASE = window.location.port === "8000" ? "http://127.0.0.1:3000" : "";
const ANALYTICS_ENDPOINT = `${API_BASE}/api/quittr/analytics`;
const RELAPSE_ENDPOINT = `${API_BASE}/api/quittr/relapses`;
const URGE_LOG_ENDPOINT = `${API_BASE}/api/quittr/urges`;
const JOURNAL_ENDPOINT = `${API_BASE}/api/quittr/journal`;
const REASONS_ENDPOINT = `${API_BASE}/api/quittr/reasons`;
const MELIUS_CHAT_ENDPOINT = `${API_BASE}/api/melius/chat`;

const milestones = [
  { name: "Sprout", days: "0 days", tone: "mint" },
  { name: "Ember", days: "1 days", tone: "ember" },
  { name: "Kindle", days: "2 days", tone: "berry" },
  { name: "Pioneer", days: "3 days", tone: "aqua" },
  { name: "Spark", days: "5 days", tone: "spark", active: true },
  { name: "Momentum", days: "7 days", tone: "violet" },
  { name: "Fortress", days: "10 days", tone: "plum" },
  { name: "Guardian", days: "14 days", tone: "stone" }
];

const fallbackStats = [
  { label: "Goal", value: "7d", icon: "diamond" },
  { label: "Streak", value: "3h 55m", icon: "streak" },
  { label: "Til Sober", value: "90d", icon: "bars" }
];

const quickActions = [
  { label: "Pledge Now", icon: "hand", active: true, action: "pledge" },
  { label: "Melius", icon: "melius", action: "melius" },
  { label: "Urge", icon: "bolt", action: "urge" },
  { label: "Reset", icon: "undo", action: "reset" }
];

const cards = [
  { title: "Rewire by Quittr", subtitle: "1:1 Help from Professionals", icon: "brain", accent: "green", action: "rewire" },
  { title: "Journal", subtitle: "Take a moment to reflect on your journey.", heading: "How are you feeling?", icon: "journal", badge: "1", buttonLabel: "New Entry", accent: "plain", action: "journal" },
  { title: "Reasons For Quitting", subtitle: "Click here to add a reason why you're quitting", icon: "note", accent: "plain", action: "reasons" },
  { title: "Content Blocker", subtitle: "Tap to learn more", icon: "block", accent: "red", pill: "Upgrade", action: "blocker" },
  { title: "Therapy", subtitle: "Get support from a licensed therapist via BetterHelp.", icon: "therapy", accent: "violet", action: "therapy" }
];

const pledgeBenefits = [
  { title: "Achievable Goal", description: "When pledging, you agree to not relapse for the day only.", icon: "check-circle", tone: "green" },
  { title: "Take it Easy", description: "If you relapse, your streak won't reset. Just get back on track and change your mind tomorrow.", icon: "sparkles", tone: "violet" },
  { title: "Success is Inevitable", description: "Stay strong, the first few days/weeks will be tough but after that it'll get easier.", icon: "crown", tone: "gold" }
];

const libraryShortcuts = [
  { label: "Melius", icon: "melius", action: "melius" },
  { label: "Meditate", icon: "meditate", action: "meditate" },
  { label: "Lifetree", icon: "tree", action: "lifetree" }
];

const soundscapes = [
  { title: "Campfire", tone: "campfire" },
  { title: "Ocean", tone: "ocean" },
  { title: "Rain", tone: "rain" },
  { title: "Forest", tone: "forest" }
];

const lessons = [
  { title: "The Neuroscience of Porn Addictio...", status: "Completed", tone: "completed", icon: "check-circle" },
  { title: "Debunking Common Myths A...", status: "Continue learning", tone: "current", icon: "dot" },
  { title: "Psychological and Environmental F...", status: "Locked", tone: "locked", icon: "lock" }
];

const games = [
  { title: "Memory Recall", icon: "brain", tone: "memory" },
  { title: "Find It Fast", icon: "search", tone: "find" },
  { title: "Word Scramble", icon: "letters", tone: "words" }
];

const leaderboardRows = [
  { rank: 1, tone: "gold", width: "34%" },
  { rank: 2, tone: "silver", width: "31%" },
  { rank: 3, tone: "bronze", width: "27%" }
];

const profileBadges = [
  { label: "Starter badge", tone: "earned" },
  { label: "Locked badge", tone: "locked" },
  { label: "Locked badge", tone: "locked" },
  { label: "Locked badge", tone: "locked" },
  { label: "Locked badge", tone: "locked" },
  { label: "Locked badge", tone: "locked" },
  { label: "Locked badge", tone: "locked" }
];

const achievements = [
  { icon: "streak", tone: "ghost", count: "90" },
  { icon: "streak", tone: "ghost", count: "7" },
  { icon: "music", tone: "music" },
  { icon: "block", tone: "block" },
  { icon: "streak", tone: "ghost", count: "30" }
];

const confettiPalette = ["#ffd84d", "#bc46ff", "#52df6c", "#ff5f7b", "#4db7ff", "#ffffff"];
const confettiPieces = Array.from({ length: 26 }, (_, index) => ({
  x: `${-150 + ((index * 29) % 300)}px`,
  y: `${-320 - ((index * 31) % 260)}px`,
  delay: `${(index % 6) * 0.03}s`,
  duration: `${1.25 + (index % 4) * 0.14}s`,
  rotate: `${-200 + (index * 41) % 400}deg`,
  color: confettiPalette[index % confettiPalette.length],
  shape: index % 3 === 0 ? "dot" : index % 3 === 1 ? "strip" : "diamond"
}));

function App() {
  const [page, setPage] = useState("home");
  const [activeTab, setActiveTab] = useState("overview");
  const [lastAction, setLastAction] = useState("");
  const [isPledgeOpen, setIsPledgeOpen] = useState(false);
  const [urgeFlow, setUrgeFlow] = useState(null);
  const [journalEntries, setJournalEntries] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => {
    document.body.classList.toggle("modal-open", isPledgeOpen);
    return () => document.body.classList.remove("modal-open");
  }, [isPledgeOpen]);

  useEffect(() => {
    loadAnalytics().then(setAnalytics).catch(() => setLastAction("analytics unavailable"));
    loadJournalEntries().then(setJournalEntries).catch(() => setLastAction("journal unavailable"));
    loadReasons().then(setReasons).catch(() => setLastAction("reasons unavailable"));
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function refreshAnalytics() {
    const data = await loadAnalytics();
    setAnalytics(withClientLoadedAt(data));
    return data;
  }

  async function handleAction(action) {
    if (action === "pledge") {
      setIsPledgeOpen(true);
      return;
    }
    if (action === "pledge confirm") {
      setIsPledgeOpen(false);
      launchConfettiBurst();
      showToast("Pledge complete");
      return;
    }
    if (action === "reset") {
      try {
        const data = await recordRelapse();
        setAnalytics(withClientLoadedAt(data));
        setClockNow(Date.now());
        showToast("Relapse recorded");
      } catch {
        showToast("Reset failed");
      }
      return;
    }
    if (action === "urge") {
      setPage("urge");
      setUrgeFlow(createUrgeFlow());
      return;
    }
    if (action === "urge close") {
      setPage("home");
      setUrgeFlow(null);
      return;
    }
    if (action === "urge back") {
      setUrgeFlow((current) => stepUrgeFlow(current, "back"));
      return;
    }
    if (action === "urge continue") {
      setUrgeFlow((current) => stepUrgeFlow(current, "continue"));
      return;
    }
    if (action === "urge guided") {
      setUrgeFlow((current) => stepUrgeFlow(current, "guided"));
      return;
    }
    if (action.startsWith("urge intensity ")) {
      setUrgeFlow((current) => stepUrgeFlow(current, action.slice("urge ".length)));
      return;
    }
    if (action.startsWith("urge context ")) {
      setUrgeFlow((current) => stepUrgeFlow(current, action.slice("urge ".length)));
      return;
    }
    if (action.startsWith("urge alone ")) {
      setUrgeFlow((current) => stepUrgeFlow(current, action.slice("urge ".length)));
      return;
    }
    if (action.startsWith("urge response ")) {
      setUrgeFlow((current) => stepUrgeFlow(current, action.slice("urge ".length)));
      return;
    }
    if (action === "urge done") {
      try {
        const data = await recordUrgeLog(urgeFlow);
        setAnalytics(data.analytics || analytics);
        setUrgeFlow((current) => current ? { ...current, step: "logged", savedAt: new Date().toISOString() } : current);
        showToast("Urge logged");
      } catch {
        showToast("Could not save urge");
      }
      return;
    }
    if (action === "melius") {
      setPage("melius");
      return;
    }
    if (action === "new entry") {
      setPage("journal-entry");
      return;
    }
    if (action === "reasons") {
      setPage("reasons");
      return;
    }
    showToast(`${titleCase(action)} action ready`);
  }

  async function saveJournalEntry(entry) {
    try {
      const data = await createJournalEntry(entry);
      setJournalEntries(data.entries || []);
      setPage("home");
      showToast("Entry saved");
    } catch {
      showToast("Entry save failed");
      throw new Error("Entry save failed");
    }
  }

  async function saveReasons(nextReasons) {
    try {
      const data = await updateReasons(nextReasons);
      setReasons(data.reasons || []);
      showToast("Reasons saved");
    } catch {
      showToast("Reasons save failed");
    }
  }

  function showToast(message) {
    setLastAction(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setLastAction(""), 1500);
  }

  function navigate(nextPage) {
    setPage(nextPage);
    if (nextPage === "analytics") {
      refreshAnalytics().catch(() => showToast("Analytics unavailable"));
    }
  }

  return h(
    "main",
    { className: page === "home" ? "app-shell" : "app-shell page-shell" },
    page === "home" ? h(HomePage, { onAction: handleAction, journalEntries, analytics, clockNow }) : null,
    page === "analytics" ? h(AnalyticsPage, { analytics, activeTab, onTab: setActiveTab, onAction: handleAction }) : null,
    page === "library" ? h(LibraryPage, { onAction: handleAction }) : null,
    page === "profile" ? h(ProfilePage, { onAction: handleAction }) : null,
    page === "melius" ? h(MeliusChatPage, { onBack: () => setPage("analytics") }) : null,
    page === "urge" ? h(UrgeFlowPage, { flow: urgeFlow, onAction: handleAction }) : null,
    page === "journal-entry" ? h(NewEntryPage, { onBack: () => setPage("home"), onSave: saveJournalEntry }) : null,
    page === "reasons" ? h(ReasonsPage, { reasons, onBack: () => setPage("home"), onSave: saveReasons }) : null,
    page === "urge" || page === "journal-entry" || page === "reasons" ? null : h(BottomNav, { page, onNavigate: navigate }),
    isPledgeOpen ? h(PledgeModal, { onClose: () => setIsPledgeOpen(false), onAction: handleAction }) : null,
    lastAction ? h("div", { className: "toast", role: "status" }, lastAction) : null
  );
}

function HomePage({ onAction, journalEntries, analytics, clockNow }) {
  const homeStats = createHomeStats(analytics, clockNow);

  return h(
    React.Fragment,
    null,
    h("section", { className: "milestones", "aria-label": "Milestones" }, milestones.map((item) => h(Milestone, { key: item.name, item, onAction }))),
    h("section", { className: "stats-grid", "aria-label": "Recovery stats" }, homeStats.map((item) => h(StatCard, { key: item.label, item, onAction }))),
    h("section", { className: "quick-grid", "aria-label": "Quick actions" }, quickActions.map((item) => h(QuickAction, { key: item.action, item, onAction }))),
    h(ProgressPill, { onAction }),
    h("section", { className: "card-stack", "aria-label": "Support tools" }, cards.map((card) => h(FeatureCard, { key: card.action, card, onAction, journalEntries }))),
    h(QuoteBlock),
    h("button", { className: "panic-button", type: "button", onClick: () => onAction("panic") }, h(Icon, { name: "warning" }), h("span", null, "Panic Button"))
  );
}

function UrgeFlowPage({ flow, onAction }) {
  if (!flow) return null;

  return h(
    "section",
    { className: "urge-flow" },
    h("header", { className: "urge-topbar" },
      h("button", { className: "icon-button", type: "button", onClick: () => onAction("urge close"), "aria-label": "Close urge flow" }, h(Icon, { name: "close" })),
      h("strong", null, "Urge Tracker"),
      h("span", { className: "urge-topbar-spacer" })
    ),
    h("div", { className: "urge-progress" }, h("span", { style: { width: `${flow.progress}%` } })),
    flow.step === "intensity" ? h(UrgeIntensityStep, { flow, onAction }) : null,
    flow.step === "context" ? h(UrgeContextStep, { flow, onAction }) : null,
    flow.step === "ground" ? h(UrgeGroundStep, { flow, onAction }) : null,
    flow.step === "response" ? h(UrgeResponseStep, { flow, onAction }) : null,
    flow.step === "guided" ? h(UrgeGuidedStep, { flow, onAction }) : null,
    flow.step === "logged" ? h(UrgeLoggedStep, { flow, onAction }) : null
  );
}

function UrgeIntensityStep({ flow, onAction }) {
  return h(
    React.Fragment,
    null,
    h("section", { className: "urge-stage" },
      h("h1", null, "How intense is your urge?"),
      h("div", { className: "urge-orb" },
        h("strong", null, flow.intensityLabel),
        h("small", null, `${flow.intensityValue}%`)
      ),
      h("div", { className: "urge-pills" }, flow.intensityOptions.map((item) =>
        h("button", { key: item.label, type: "button", className: flow.intensityLabel === item.label ? "urge-pill is-active" : "urge-pill", onClick: () => onAction(`urge intensity ${item.label}`) }, item.label)
      )),
      h("div", { className: "urge-slider-block" },
        h("input", {
          className: "urge-slider",
          type: "range",
          min: 10,
          max: 100,
          step: 1,
          value: flow.intensityValue,
          onChange: (event) => onAction(`urge intensity value ${event.target.value}`)
        }),
        h("div", { className: "urge-scale" }, h("span", null, "10%"), h("span", null, "100%"))
      ),
      h("button", { className: "urge-primary", type: "button", onClick: () => onAction("urge continue") }, "Continue", h(Icon, { name: "chevron" }))
    )
  );
}

function UrgeContextStep({ flow, onAction }) {
  return h(
    "section",
    { className: "urge-stage" },
    h("h1", null, "Where are you?"),
    h("p", { className: "urge-subtitle" }, "Helps identify patterns"),
    h("div", { className: "urge-chip-grid" }, flow.contextOptions.map((item) =>
      h("button", { key: item, type: "button", className: flow.context === item ? "urge-chip is-active" : "urge-chip", onClick: () => onAction(`urge context ${item}`) }, item)
    )),
    h("div", { className: "urge-question" },
      h("strong", null, "Are you alone?"),
      h("div", { className: "urge-toggle-row" },
        h("button", { type: "button", className: flow.alone === true ? "urge-toggle is-active" : "urge-toggle", onClick: () => onAction("urge alone yes") }, "Yes"),
        h("button", { type: "button", className: flow.alone === false ? "urge-toggle is-active" : "urge-toggle", onClick: () => onAction("urge alone no") }, "No")
      )
    ),
    h("button", { className: "urge-primary", type: "button", disabled: !flow.context || flow.alone === null, onClick: () => onAction("urge continue") }, "Continue", h(Icon, { name: "chevron" })),
    h("button", { className: "urge-text-button", type: "button", onClick: () => onAction("urge continue") }, "Skip this step")
  );
}

function UrgeGroundStep({ onAction }) {
  return h(
    "section",
    { className: "urge-stage urge-centered" },
    h("h1", null, "Ground Yourself"),
    h("p", { className: "urge-subtitle" }, "Slow breathing calms your nervous system"),
    h("button", { className: "urge-primary", type: "button", onClick: () => onAction("urge continue") }, "Begin", h(Icon, { name: "chevron" })),
    h("button", { className: "urge-text-button", type: "button", onClick: () => onAction("urge continue") }, "Skip this step")
  );
}

function UrgeResponseStep({ flow, onAction }) {
  return h(
    "section",
    { className: "urge-stage" },
    h("h1", null, "How will you respond?"),
    h("p", { className: "urge-subtitle" }, "Choose your action"),
    h("div", { className: "urge-response-list" }, flow.responseOptions.map((item) =>
      h("button", { key: item.title, type: "button", className: flow.response === item.title ? "urge-response is-active" : "urge-response", onClick: () => onAction(`urge response ${item.title}`) },
        h("span", { className: "urge-response-icon" }, h(Icon, { name: item.icon })),
        h("span", { className: "urge-response-copy" }, h("strong", null, item.title), h("small", null, item.subtitle)),
        flow.response === item.title ? h("span", { className: "urge-check" }, "✓") : null
      )
    )),
    h("button", { className: "urge-primary", type: "button", disabled: !flow.response, onClick: () => onAction(flow.guidedActions.includes(flow.response) ? "urge guided" : "urge done") }, "Continue", h(Icon, { name: "chevron" }))
  );
}

function UrgeGuidedStep({ flow, onAction }) {
  return h(
    "section",
    { className: "urge-stage urge-centered" },
    h("h1", null, flow.response),
    h("p", { className: "urge-subtitle" }, "Follow this short guided reset, then log the urge."),
    h("button", { className: "urge-primary", type: "button", onClick: () => onAction("urge done") }, "Done", h(Icon, { name: "chevron" }))
  );
}

function UrgeLoggedStep({ flow, onAction }) {
  return h(
    "section",
    { className: "urge-stage urge-centered" },
    h("div", { className: "urge-logged-mark" }, h(Icon, { name: "check-circle" })),
    h("h1", null, "Urge Logged"),
    h("p", { className: "urge-subtitle" }, "You stayed in control."),
    h("div", { className: "urge-summary" },
      h("div", null, h("span", null, "Intensity"), h("strong", null, flow.intensityLabel)),
      h("div", null, h("span", null, "Response"), h("strong", null, flow.response || "Not set")),
      h("div", null, h("span", null, "Trigger"), h("strong", null, flow.context || "Unknown"))
    ),
    h("button", { className: "urge-primary", type: "button", onClick: () => onAction("urge close") }, "Done")
  );
}

function NewEntryPage({ onBack, onSave }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canSave = title.trim() || body.trim();

  async function handleSave() {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      await onSave({ title, body });
    } finally {
      setIsSaving(false);
    }
  }

  return h(
    "section",
    { className: "journal-entry-page" },
    h("header", { className: "journal-entry-topbar" },
      h("button", { type: "button", className: "journal-nav-button", onClick: onBack, "aria-label": "Back" }, h(Icon, { name: "chevron-left" })),
      h("strong", null, "New Entry"),
      h("button", { type: "button", className: "journal-save-button", disabled: !canSave || isSaving, onClick: handleSave, "aria-label": "Save entry" }, h(Icon, { name: "check" }))
    ),
    h("input", {
      className: "journal-title-input",
      value: title,
      onChange: (event) => setTitle(event.target.value),
      placeholder: "Title",
      autoFocus: true
    }),
    h("textarea", {
      className: "journal-body-input",
      value: body,
      onChange: (event) => setBody(event.target.value),
      placeholder: "Start writing here..."
    })
  );
}

function ReasonsPage({ reasons, onBack, onSave }) {
  const [draftReasons, setDraftReasons] = useState(() => reasons.length ? reasons : [""]);

  useEffect(() => {
    setDraftReasons(reasons.length ? reasons : [""]);
  }, [reasons]);

  function updateReason(index, value) {
    const next = draftReasons.map((reason, reasonIndex) => reasonIndex === index ? value : reason);
    setDraftReasons(next);
    onSave(next);
  }

  function addReason() {
    setDraftReasons([...draftReasons, ""]);
  }

  return h(
    "section",
    { className: "reasons-page" },
    h("header", { className: "reasons-topbar" },
      h("button", { type: "button", className: "reasons-back-button", onClick: onBack, "aria-label": "Back" }, h(Icon, { name: "chevron-left" })),
      h("strong", null, "Quitting Reasons"),
      h("span", null)
    ),
    h("p", { className: "reasons-intro" }, "Remind yourself why you started. Listing specific reasons helps anchor you when things get tough."),
    h("section", { className: "reasons-list", "aria-label": "Reasons for quitting" }, draftReasons.map((reason, index) =>
      h("label", { key: index, className: "reason-row" },
        h("span", { "aria-hidden": "true" }),
        h("input", {
          value: reason,
          onChange: (event) => updateReason(index, event.target.value),
          placeholder: "Enter reason..."
        })
      )
    )),
    h("button", { type: "button", className: "add-reason-button", onClick: addReason }, h(Icon, { name: "plus-circle" }), h("span", null, "Add Another Reason"))
  );
}

function AnalyticsPage({ analytics, activeTab, onTab, onAction }) {
  const data = analytics || createFallbackAnalytics();

  return h(
    "section",
    { className: "analytics-page" },
    h("h1", null, "Analytics"),
    h("div", { className: "analytics-tabs", role: "tablist" }, ["overview", "stats", "urges"].map((tab) =>
      h("button", { key: tab, className: activeTab === tab ? "analytics-tab is-active" : "analytics-tab", type: "button", onClick: () => onTab(tab) }, titleCase(tab))
    )),
    activeTab === "overview"
      ? h(OverviewPanel, { data, onAction })
      : h("section", { className: "coming-soon" }, h("h2", null, titleCase(activeTab)), h("p", null, "This section is ready for the next feature pass."))
  );
}

function OverviewPanel({ data, onAction }) {
  return h(
    React.Fragment,
    null,
    h(DaysCleanRing, { data }),
    h("button", { className: "melius-card", type: "button", onClick: () => onAction("melius") },
      h("span", { className: "melius-icon" }, h(Icon, { name: "melius" })),
      h("span", { className: "melius-copy" }, h("strong", null, "Talk to Melius"), h("small", null, "Your AI therapist")),
      h("span", { className: "chevron" }, h(Icon, { name: "chevron" }))
    ),
    h(ProgressChart, { points: data.progressPoints }),
    h(StreakJourney, { streaks: data.streaks }),
    h(AnalyticsStats, { stats: data.stats }),
    h("section", { className: "encouragement" }, h("h2", null, data.encouragement.title), h("p", null, data.encouragement.body))
  );
}

function DaysCleanRing({ data }) {
  const days = Number(data.currentStreakDays) || 0;
  const progress = Math.min(0.82, Math.max(0.08, days / 30));
  const circumference = 2 * Math.PI * 84;

  return h(
    "section",
    { className: "days-ring" },
    h("svg", { viewBox: "0 0 220 220", "aria-hidden": "true" },
      h("circle", { className: "ring-track", cx: "110", cy: "110", r: "84" }),
      h("circle", { className: "ring-progress", cx: "110", cy: "110", r: "84", strokeDasharray: `${circumference}`, strokeDashoffset: `${circumference * (1 - progress)}` }),
      h("circle", { className: "ring-dot", cx: "126", cy: "188", r: "11" }),
      h("path", { className: "ring-check", d: "m120 187 5 5 10-12" })
    ),
    h("div", { className: "days-ring-copy" }, h("span", null, "Days Clean"), h("strong", null, data.currentStreakLabel), h("small", null, "Apprentice")),
    h("span", { className: "breakthrough" }, "Breakthrough")
  );
}

function ProgressChart({ points }) {
  const normalized = normalizeChartPoints(points, 360, 170);
  const progressPath = normalized.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return h(
    "section",
    { className: "chart-section" },
    h("h2", null, "Progress"),
    h("div", { className: "legend" }, h("span", { className: "relapse-key" }, "Relapse"), h("span", { className: "progress-key" }, "Progress")),
    h("svg", { className: "progress-chart", viewBox: "0 0 380 190", role: "img", "aria-label": "Progress chart" },
      [70, 130, 190, 250, 310].map((x) => h("line", { key: x, className: "chart-grid", x1: x, x2: x, y1: "15", y2: "172" })),
      h("path", { className: "chart-fill", d: `${progressPath} L 360 175 L 20 175 Z` }),
      h("path", { className: "progress-line", d: progressPath }),
      normalized.filter((point) => point.type === "relapse").map((point) => h("circle", { key: point.id, className: "relapse-point", cx: point.x, cy: point.y, r: "7" })),
      h("path", { className: "chart-arrow", d: "M 344 86 L 360 80 L 356 96" })
    )
  );
}

function StreakJourney({ streaks }) {
  const visible = streaks.slice(-7);
  const max = Math.max(1, ...visible.map((item) => item.days));

  return h(
    "section",
    { className: "journey-section" },
    h("div", { className: "journey-heading" }, h("span", null, h("h2", null, "Streak Journey"), h("small", null, `${streaks.length} streaks tracked`)), h(Icon, { name: "chevron" })),
    h("div", { className: "legend" }, h("span", { className: "streak-key" }, "Streak"), h("span", { className: "relapse-key" }, "Reset")),
    h("div", { className: "journey-chart" }, visible.map((item) =>
      h("span", { key: item.id, className: "journey-bar-wrap" },
        h("i", { className: item.relapseAt ? "reset-dot" : "reset-dot is-current" }),
        h("b", { style: { height: `${Math.max(8, (item.days / max) * 42)}px` } }),
        h("small", null, Math.round(item.days))
      )
    ))
  );
}

function AnalyticsStats({ stats }) {
  return h(
    "section",
    { className: "analytics-stats" },
    h("div", { className: "metric-circle gold" }, h("span", null, h(Icon, { name: "crown" })), h("strong", null, stats.bestStreakLabel), h("small", null, "Best Streak")),
    h("div", { className: "metric-circle green" }, h("span", null, h(Icon, { name: "stats" })), h("strong", null, stats.avgStreakLabel), h("small", null, "Avg Streak")),
    h("div", { className: "metric-circle red" }, h("span", null, h(Icon, { name: "undo" })), h("strong", null, stats.relapseCount), h("small", null, "Relapses")),
    h("div", { className: "metric-card karma" }, h("strong", null, h(Icon, { name: "heart" }), " ", stats.karma), h("small", null, "Karma")),
    h("div", { className: "metric-card rank" }, h("strong", null, h(Icon, { name: "bars" }), " Top ", stats.rankPercent, "%"), h("small", null, "In QUITTR"))
  );
}

function LibraryPage({ onAction }) {
  return h(
    "section",
    { className: "library-page" },
    h("h1", null, "Library"),
    h("section", { className: "library-shortcuts", "aria-label": "Library shortcuts" }, libraryShortcuts.map((item) => h(LibraryShortcut, { key: item.label, item, onAction }))),
    h(LibraryHeader, { title: "Soundscapes", subtitle: "Relax & drift into a different world to help mitigate urges", action: "soundscapes", onAction }),
    h("section", { className: "soundscape-list", "aria-label": "Soundscapes" }, soundscapes.map((item) => h(SoundscapeButton, { key: item.title, item, onAction }))),
    h("button", { className: "mountain-card", type: "button", onClick: () => onAction("progress mountain") },
      h("span", { className: "mountain-copy" }, h("strong", null, "Progress Mountain"), h("small", null, "Climb the mountain with every day of progress")),
      h("span", { className: "mountain-shape", "aria-hidden": "true" })
    ),
    h(LibraryHeader, { title: "Continue Lesson", subtitle: "Pick up exactly where you left off", action: "lessons", onAction }),
    h("section", { className: "lesson-timeline", "aria-label": "Continue Lesson" }, lessons.map((item) => h(LessonItem, { key: item.title, item, onAction }))),
    h(LibraryHeader, { title: "Games", subtitle: "Defeat urges with cognitive exercises", action: "games", onAction }),
    h("section", { className: "games-row", "aria-label": "Games" }, games.map((item) => h(GameCard, { key: item.title, item, onAction }))),
    h(LibraryHeader, { title: "Leaderboard", action: "leaderboard", onAction }),
    h("button", { className: "leaderboard-card", type: "button", onClick: () => onAction("leaderboard") },
      leaderboardRows.map((row) => h("span", { key: row.rank, className: "leaderboard-row" },
        h("i", { className: row.tone }, row.rank),
        h("b", { style: { width: row.width } }),
        h("em")
      ))
    ),
    h("button", { className: "share-card", type: "button", onClick: () => onAction("share quittr") }, h("strong", null, "Share QUITTR"), h("span", null, "and get rewards"), h("i", null, h(Icon, { name: "gift" })))
  );
}

function LibraryHeader({ title, subtitle, action, onAction }) {
  return h(
    "header",
    { className: "library-section-header" },
    h("span", null, h("h2", null, title), subtitle ? h("p", null, subtitle) : null),
    h("button", { type: "button", "aria-label": `${title} details`, onClick: () => onAction(action) }, h(Icon, { name: "chevron" }))
  );
}

function LibraryShortcut({ item, onAction }) {
  return h("button", { className: "library-shortcut", type: "button", onClick: () => onAction(item.action) }, h("span", null, h(Icon, { name: item.icon })), h("strong", null, item.label));
}

function SoundscapeButton({ item, onAction }) {
  return h("button", { className: `soundscape-card ${item.tone}`, type: "button", onClick: () => onAction(`${item.title} soundscape`) }, h("strong", null, item.title), h("span", null, h(Icon, { name: "play" })));
}

function LessonItem({ item, onAction }) {
  return h(
    "button",
    { className: `lesson-item ${item.tone}`, type: "button", onClick: () => onAction(item.title) },
    h("span", { className: "lesson-step" }, h(Icon, { name: item.icon })),
    h("span", { className: "lesson-copy" }, h("strong", null, item.title), h("small", null, item.status)),
    item.tone === "current" ? h("span", { className: "lesson-next" }, h(Icon, { name: "chevron" })) : null
  );
}

function GameCard({ item, onAction }) {
  return h("button", { className: `game-card ${item.tone}`, type: "button", onClick: () => onAction(item.title) }, h("span", null, h(Icon, { name: item.icon })), h("strong", null, item.title));
}

function ProfilePage({ onAction }) {
  return h(
    "section",
    { className: "profile-page" },
    h("section", { className: "profile-hero", "aria-label": "Profile header" },
      h("div", { className: "profile-actions" },
        h("button", { type: "button", "aria-label": "Share profile", onClick: () => onAction("share profile") }, h(Icon, { name: "share" })),
        h("button", { type: "button", "aria-label": "Profile settings", onClick: () => onAction("profile settings") }, h(Icon, { name: "gear" }))
      ),
      h("div", { className: "profile-avatar-main" }, h(Icon, { name: "profile" }))
    ),
    h("section", { className: "profile-panel" },
      h("button", { className: "edit-profile-button", type: "button", onClick: () => onAction("edit profile") }, "Edit Profile"),
      h("div", { className: "karma-line" }, h(Icon, { name: "diamond" }), h("span", null, "1 Karma")),
      h("section", { className: "badge-row", "aria-label": "Profile badges" }, profileBadges.map((badge, index) =>
        h("button", { key: `${badge.tone}-${index}`, className: `profile-badge ${badge.tone}`, type: "button", "aria-label": badge.label, onClick: () => onAction(badge.label) }, badge.tone === "locked" ? h(Icon, { name: "lock" }) : null)
      )),
      h("header", { className: "profile-section-header" },
        h("h2", null, "Achievements"),
        h("button", { type: "button", "aria-label": "Achievements details", onClick: () => onAction("achievements") }, h(Icon, { name: "chevron" }))
      ),
      h("section", { className: "achievement-row", "aria-label": "Achievements" }, achievements.map((item, index) => h(AchievementBadge, { key: `${item.tone}-${index}`, item, onAction }))),
      h("header", { className: "profile-section-header posts-header" },
        h("span", null, h("h2", null, "My Posts"), h("b", null, "1")),
        h("button", { type: "button", onClick: () => onAction("see all posts") }, "See all ", h(Icon, { name: "chevron" }))
      ),
      h("article", { className: "post-card" },
        h("span", { className: "post-avatar", "aria-hidden": "true" }),
        h("div", { className: "post-body" },
          h("header", null, h("strong", null, "Unknown User"), h("span", null, "·"), h("small", null, "2w ago"), h("button", { type: "button", "aria-label": "Post options", onClick: () => onAction("post options") }, "•••")),
          h("h3", null, "cant stop surfing internet"),
          h("p", null, "whenever i surf the Internet too long the urge come and cant resist"),
          h("footer", null,
            h("button", { type: "button", onClick: () => onAction("comments") }, h(Icon, { name: "comment" }), "0"),
            h("button", { type: "button", onClick: () => onAction("likes") }, h(Icon, { name: "heart-outline" }), "0"),
            h("button", { type: "button", onClick: () => onAction("post stats") }, h(Icon, { name: "stats" }), "1")
          )
        )
      )
    )
  );
}

function AchievementBadge({ item, onAction }) {
  return h(
    "button",
    { className: `achievement-badge ${item.tone}`, type: "button", onClick: () => onAction("achievement") },
    h("span", null, h(Icon, { name: item.icon })),
    item.count ? h("b", null, item.count) : null
  );
}

function MeliusChatPage({ onBack }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setDraft("");
    setIsSending(true);
    try {
      const reply = await sendMeliusMessage(nextMessages);
      setMessages([...nextMessages, { role: "assistant", text: reply }]);
    } catch (error) {
      setMessages([...nextMessages, { role: "assistant", text: getClientErrorMessage(error) }]);
    } finally {
      setIsSending(false);
    }
  }

  return h(
    "section",
    { className: "chat-page" },
    h("header", { className: "chat-header" }, h("button", { type: "button", onClick: onBack, "aria-label": "Back to analytics" }, h(Icon, { name: "chevron-left" })), h("span", null, h("strong", null, "Melius"), h("small", null, "qwen3.7-plus recovery assistant"))),
    h("div", { className: "chat-thread" },
      messages.length === 0 ? h("div", { className: "empty-chat" }, h("strong", null, "What feels hardest right now?"), h("p", null, "Tell Melius about the urge, trigger, or relapse risk. It will help you get through the next few minutes.")) : null,
      messages.map((message, index) => h("p", { key: index, className: `chat-bubble ${message.role}` }, message.text)),
      isSending ? h("p", { className: "chat-bubble assistant is-thinking" }, "Melius is thinking...") : null
    ),
    h("form", { className: "chat-composer", onSubmit: sendMessage }, h("input", { value: draft, onChange: (event) => setDraft(event.target.value), placeholder: "Message Melius..." }), h("button", { type: "submit", disabled: isSending || !draft.trim(), "aria-label": "Send" }, h(Icon, { name: "send" })))
  );
}

function BottomNav({ page, onNavigate }) {
  const navItems = [
    { label: "Home", icon: "home", page: "home" },
    { label: "Chat", icon: "chat", page: "melius" },
    { label: "Stats", icon: "stats", page: "analytics" },
    { label: "Library", icon: "folder", page: "library" },
    { label: "Profile", icon: "profile", page: "profile" }
  ];

  return h("nav", { className: "bottom-nav", "aria-label": "Main navigation" }, navItems.map((item) =>
    h("button", { key: item.label, className: page === item.page ? "nav-button is-active" : "nav-button", type: "button", "aria-label": item.label, onClick: () => onNavigate(item.page) }, h(Icon, { name: item.icon }))
  ));
}

function Milestone({ item, onAction }) {
  return h("button", { className: item.active ? `milestone ${item.tone} is-active` : `milestone ${item.tone}`, type: "button", onClick: () => onAction(item.name.toLowerCase()) }, h("span", { className: "planet" }), h("strong", null, item.name), h("small", null, item.days));
}

function StatCard({ item, onAction }) {
  return h("button", { className: "stat-card", type: "button", onClick: () => onAction(item.label.toLowerCase()) }, h("span", { className: `stat-icon ${item.icon}` }, h(Icon, { name: item.icon })), h("span", { className: "stat-label" }, item.label), h("strong", null, item.value));
}

function QuickAction({ item, onAction }) {
  return h("button", { className: item.active ? "quick-action is-active" : "quick-action", type: "button", onClick: () => onAction(item.action) }, h("span", { className: "quick-orb" }, h(Icon, { name: item.icon })), h("span", { className: "quick-label" }, item.label));
}

function ProgressPill({ onAction }) {
  return h("button", { className: "progress-pill", type: "button", onClick: () => onAction("brain rewiring") }, h("span", null, "Brain Rewiring"), h("span", { className: "progress-track" }, h("span", { className: "progress-bar" })), h("strong", null, "0%"));
}

function FeatureCard({ card, onAction, journalEntries = [] }) {
  const isJournal = Boolean(card.buttonLabel);
  const latestEntry = isJournal ? journalEntries[0] : null;
  const entryCount = isJournal ? journalEntries.length : 0;

  return h(
    "article",
    { className: isJournal ? "feature-card journal-card" : "feature-card" },
    h("button", { className: "feature-main", type: "button", onClick: () => onAction(card.action) },
      h("span", { className: `feature-icon ${card.accent}` }, h(Icon, { name: card.icon })),
      h("span", { className: "feature-copy" },
        h("span", { className: "feature-title-row" }, h("strong", null, card.title), card.pill ? h("em", null, card.pill) : null),
        card.heading ? h("b", null, latestEntry ? "Today's Reflection" : card.heading) : null,
        latestEntry ? h("span", { className: "journal-preview" }, h("strong", null, latestEntry.title), h("small", null, latestEntry.body || "No details yet")) : h("small", null, card.subtitle)
      ),
      card.badge ? h("span", { className: "badge" }, entryCount || card.badge) : h("span", { className: "chevron" }, h(Icon, { name: "chevron" }))
    ),
    isJournal && latestEntry ? h("section", { className: "journal-entry-list", "aria-label": "Journal entries" }, journalEntries.slice(0, 3).map((entry) => h(JournalEntryPreview, { key: entry.id, entry }))) : null,
    card.buttonLabel ? h("button", { className: "entry-button", type: "button", onClick: () => onAction("new entry") }, h(Icon, { name: "edit" }), h("span", null, card.buttonLabel)) : null
  );
}

function JournalEntryPreview({ entry }) {
  return h(
    "article",
    { className: "journal-entry-preview" },
    h("span", null, "Today's Reflection"),
    h("strong", null, entry.title),
    h("p", null, entry.body || "No details yet")
  );
}

function QuoteBlock() {
  return h("section", { className: "quote-block" }, h("span", { className: "quote-mark" }, "\""), h("p", null, "Today marks the beginning of a powerful journey. This decision is a commitment to a better you. Remember, small steps lead to great changes."), h("span", { className: "quote-mark closing" }, "\""));
}

function PledgeModal({ onClose, onAction }) {
  return h("section", { className: "modal-backdrop", role: "dialog", "aria-modal": "true", "aria-label": "Pledge" }, h("div", { className: "pledge-modal" }, h("button", { className: "modal-close", type: "button", "aria-label": "Close pledge dialog", onClick: onClose }, h(Icon, { name: "close" })), h("h2", { className: "modal-title" }, "Pledge"), h("div", { className: "pledge-hero" }, h("span", { className: "pledge-hand" }, h(Icon, { name: "hand" }))), h("div", { className: "pledge-copy" }, h("h3", null, "Pledge Sobriety Today"), h("p", null, "Make a commitment to yourself not to masturbate for today. You'll receive a notification in 24 hours to check in and see how you did.")), h("section", { className: "pledge-benefits" }, pledgeBenefits.map((item) => h(PledgeBenefit, { key: item.title, item }))), h("button", { className: "pledge-cta", type: "button", onClick: () => onAction("pledge confirm") }, "Pledge Now")));
}

function PledgeBenefit({ item }) {
  return h("article", { className: "pledge-benefit" }, h("span", { className: `pledge-benefit-icon ${item.tone}` }, h(Icon, { name: item.icon })), h("span", { className: "pledge-benefit-copy" }, h("strong", null, item.title), h("small", null, item.description)));
}

function createUrgeFlow() {
  return {
    step: "intensity",
    progress: 20,
    intensityValue: 50,
    intensityLabel: "Medium",
    intensityOptions: ["Mild", "Medium", "Strong", "Max"].map((label) => ({ label })),
    context: "",
    contextOptions: ["Bedroom", "Bathroom", "Living Room", "Work", "School", "Car", "Outside", "Other"],
    alone: null,
    response: "",
    responseOptions: [
      { title: "Deep Breathing", subtitle: "Calm your system", icon: "wind" },
      { title: "Exercise", subtitle: "Move your body", icon: "run" },
      { title: "Cold Shower", subtitle: "Reset your mind", icon: "drop" },
      { title: "Call Someone", subtitle: "Get support", icon: "phone" },
      { title: "Meditate", subtitle: "Center yourself", icon: "brain" },
      { title: "Go Outside", subtitle: "Change environment", icon: "leaf" },
      { title: "Journal", subtitle: "Put it into words", icon: "journal" }
    ],
    guidedActions: ["Deep Breathing", "Meditate"],
    savedAt: null
  };
}

function stepUrgeFlow(flow, event) {
  if (!flow) return flow;

  const next = { ...flow };
  if (event === "back") {
    if (next.step === "context") next.step = "intensity";
    else if (next.step === "ground") next.step = "context";
    else if (next.step === "response") next.step = "ground";
    else if (next.step === "guided") next.step = "response";
    next.progress = Math.max(20, next.progress - 20);
    return next;
  }

  if (event === "continue") {
    if (next.step === "intensity") {
      next.step = "context";
      next.progress = 40;
    } else if (next.step === "context") {
      next.step = "ground";
      next.progress = 60;
    } else if (next.step === "ground") {
      next.step = "response";
      next.progress = 80;
    } else if (next.step === "guided") {
      next.step = "logged";
      next.progress = 100;
    }
    return next;
  }

  if (event.startsWith("intensity ")) {
    const value = event.slice("intensity ".length);
    const known = ["Mild", "Medium", "Strong", "Max"].includes(value) ? value : next.intensityLabel;
    next.intensityLabel = known;
    next.intensityValue = { Mild: 20, Medium: 50, Strong: 75, Max: 95 }[known] || 50;
    return next;
  }

  if (event.startsWith("intensity value ")) {
    const value = Number(event.slice("intensity value ".length));
    next.intensityValue = value;
    next.intensityLabel = value < 35 ? "Mild" : value < 65 ? "Medium" : value < 85 ? "Strong" : "Max";
    return next;
  }

  if (event.startsWith("context ")) {
    next.context = event.slice("context ".length);
    return next;
  }

  if (event === "alone yes") {
    next.alone = true;
    return next;
  }

  if (event === "alone no") {
    next.alone = false;
    return next;
  }

  if (event.startsWith("response ")) {
    next.response = event.slice("response ".length);
    return next;
  }

  if (event === "guided") {
    next.step = "guided";
    next.progress = 90;
    return next;
  }

  return next;
}

async function recordUrgeLog(flow) {
  const response = await fetch(URGE_LOG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intensity: flow?.intensityLabel || "",
      intensityValue: flow?.intensityValue || 0,
      context: flow?.context || "",
      alone: flow?.alone,
      response: flow?.response || "",
      savedAt: flow?.savedAt
    })
  });
  if (!response.ok) throw new Error("Urge log request failed");
  return response.json();
}

async function loadJournalEntries() {
  const response = await fetch(JOURNAL_ENDPOINT);
  if (!response.ok) throw new Error("Journal request failed");
  const data = await response.json();
  return data.entries || [];
}

async function createJournalEntry(entry) {
  const response = await fetch(JOURNAL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  });
  if (!response.ok) throw new Error("Journal save failed");
  return response.json();
}

async function loadReasons() {
  const response = await fetch(REASONS_ENDPOINT);
  if (!response.ok) throw new Error("Reasons request failed");
  const data = await response.json();
  return data.reasons || [];
}

async function updateReasons(reasons) {
  const response = await fetch(REASONS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reasons })
  });
  if (!response.ok) throw new Error("Reasons save failed");
  return response.json();
}

async function loadAnalytics() {
  const response = await fetch(ANALYTICS_ENDPOINT);
  if (!response.ok) throw new Error("Analytics request failed");
  const data = await response.json();
  return withClientLoadedAt(data);
}

async function recordRelapse() {
  const response = await fetch(RELAPSE_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!response.ok) throw new Error("Relapse request failed");
  return response.json();
}

async function sendMeliusMessage(messages) {
  const response = await fetch(MELIUS_CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Melius is unavailable.");
  }
  return data.reply || "";
}

function getClientErrorMessage(error) {
  return error?.message || "Melius is unavailable right now. Try again in a moment.";
}

function normalizeChartPoints(points, width, height) {
  const items = points && points.length ? points : [{ id: 1, days: 0, type: "progress" }];
  const max = Math.max(1, ...items.map((item) => Number(item.days) || 0));
  return items.map((item, index) => ({
    ...item,
    x: 20 + (index / Math.max(1, items.length - 1)) * (width - 40),
    y: 172 - ((Number(item.days) || 0) / max) * (height - 42)
  }));
}

function createHomeStats(analytics, nowMs) {
  if (!analytics) {
    return fallbackStats;
  }

  const streakValue = Number.isFinite(Number(analytics.currentStreakMs))
    ? formatDurationFromMs(Number(analytics.currentStreakMs) + Math.max(0, nowMs - Number(analytics.loadedAtClientMs || nowMs)))
    : analytics.currentStreakClockLabel || analytics.currentStreakLabel || "0m";

  return [
    { label: "Goal", value: `${analytics.soberGoalDays || 90}d`, icon: "diamond" },
    { label: "Streak", value: streakValue, icon: "streak" },
    { label: "Til Sober", value: analytics.soberGoalRemainingLabel || "90d", icon: "bars" }
  ];
}

function withClientLoadedAt(data) {
  return { ...data, loadedAtClientMs: Date.now() };
}

function formatDurationFromMs(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / (60 * 1000)));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function createFallbackAnalytics() {
  return {
    currentStreakDays: 7,
    currentStreakLabel: "7d",
    progressPoints: [{ id: 1, days: 8, type: "relapse" }, { id: 2, days: 1, type: "relapse" }, { id: 3, days: 4, type: "relapse" }, { id: 4, days: 2, type: "relapse" }, { id: 5, days: 7, type: "progress" }],
    streaks: [{ id: 1, days: 1, relapseAt: true }, { id: 2, days: 0.5, relapseAt: true }, { id: 3, days: 3, relapseAt: true }, { id: 4, days: 0.7, relapseAt: true }, { id: 5, days: 8, relapseAt: true }, { id: 6, days: 0.4, relapseAt: true }, { id: 7, days: 7, relapseAt: null, current: true }],
    stats: { bestStreakLabel: "8d", avgStreakLabel: "3d", relapseCount: 6, rankPercent: 40, karma: 1 },
    encouragement: { title: "One Week Strong!", body: "A full week is a major milestone. Your brain is beginning to heal. You might notice improved focus and energy. This is just the beginning." }
  };
}

function Icon({ name }) {
  const icons = {
    bars: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M5 18h14v2H5v-2Zm1-7h4v5H6v-5Zm6-5h4v10h-4V6Zm6 8h4v2h-4v-2Z" })),
    block: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 3c1.4 0 2.8.4 3.9 1.2l-9.7 9.7A7 7 0 0 1 12 5Zm0 14a7 7 0 0 1-4-1.2l9.8-9.7A7 7 0 0 1 12 19Z" })),
    bolt: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M13 2 4 14h7l-1 8 10-13h-7l0-7Z" })),
    brain: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M8.2 3.7a4 4 0 0 1 6.5 1A4.7 4.7 0 0 1 21 9.1c0 2-.9 3.4-2.2 4.1.1.4.2.8.2 1.2A4.6 4.6 0 0 1 14.4 19H14a3.3 3.3 0 0 1-6.3.3A4.9 4.9 0 0 1 3 14.4c0-1 .3-2 .8-2.8A4.6 4.6 0 0 1 4 4.4a4.8 4.8 0 0 1 4.2-.7Z" })),
    chat: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M4 5.5A4.5 4.5 0 0 1 8.5 1h7A4.5 4.5 0 0 1 20 5.5v5.2a4.5 4.5 0 0 1-4.5 4.5H10l-5.5 4.1c-.8.6-1.9 0-1.9-1V5.5H4Z" })),
    chevron: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m8.8 4.2 7.1 7.1c.4.4.4 1 0 1.4l-7.1 7.1-1.5-1.5 6.4-6.3-6.4-6.3 1.5-1.5Z" })),
    "chevron-left": h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m15.2 4.2 1.5 1.5-6.4 6.3 6.4 6.3-1.5 1.5-7.1-7.1a1 1 0 0 1 0-1.4l7.1-7.1Z" })),
    check: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m9.2 16.2-4-4L3.8 13.6l5.4 5.4L20.7 7.5l-1.4-1.4-10.1 10.1Z" })),
    "check-circle": h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.8 7.5-5.4 6.8a1 1 0 0 1-1.5.1l-2.8-2.7 1.4-1.4 2 2 4.7-5.9 1.6 1.1Z" })),
    close: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M18.3 4.3 12 10.6 5.7 4.3 4.3 5.7l6.3 6.3-6.3 6.3 1.4 1.4 6.3-6.3 6.3 6.3 1.4-1.4-6.3-6.3 6.3-6.3-1.4-1.4Z" })),
    comment: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M5 4h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8l-5 4v-4H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm0 2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3v2l2.4-2H19a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H5Z" })),
    crown: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M3 18h18v2H3v-2Zm1.5-11 4.4 3.8L12 4l3.1 6.8L19.5 7 21 16H3L4.5 7Z" })),
    diamond: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m12 3 7 9-7 9-7-9 7-9Z" })),
    dot: h("svg", { viewBox: "0 0 24 24" }, h("circle", { cx: "12", cy: "12", r: "5" })),
    edit: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M5 17.5V20h2.5L18.8 8.7l-2.5-2.5L5 17.5Z" })),
    folder: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10Z" })),
    gear: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m19.4 13.5 2.1 1.6-2 3.5-2.6-1a7.6 7.6 0 0 1-1.8 1l-.4 2.8h-4l-.4-2.8a7 7 0 0 1-1.8-1l-2.6 1-2-3.5L6 13.5a7.6 7.6 0 0 1 0-2.1L3.9 9.8l2-3.5 2.6 1c.6-.4 1.2-.7 1.8-1l.4-2.8h4l.4 2.8c.7.2 1.3.6 1.8 1l2.6-1 2 3.5-2.1 1.6a7.6 7.6 0 0 1 0 2.1ZM12.7 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" })),
    gift: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M20 8h-2.2A3.4 3.4 0 0 0 12 4.7 3.4 3.4 0 0 0 6.2 8H4a2 2 0 0 0-2 2v3h2v8h16v-8h2v-3a2 2 0 0 0-2-2ZM9.5 6a1.5 1.5 0 0 1 1.4 2H8.5A1.5 1.5 0 0 1 9.5 6Zm5 0a1.5 1.5 0 0 1 1 2h-2.4A1.5 1.5 0 0 1 14.5 6ZM6 13h5v6H6v-6Zm7 6v-6h5v6h-5Z" })),
    hand: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 3a1.5 1.5 0 0 1 1.5 1.5V12h1V6a1.5 1.5 0 0 1 3 0v6h1V8a1.5 1.5 0 0 1 3 0v5.4A7.6 7.6 0 0 1 14 21h-1.1a8 8 0 0 1-5.7-2.4L3 14.4c-.7-.7-.7-1.9 0-2.6.7-.7 1.8-.7 2.5-.1L8 14.1V5.5a1.5 1.5 0 0 1 3 0V12h1V4.5A1.5 1.5 0 0 1 12 3Z" })),
    leaf: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M20 4c-8.2 0-14 4.9-14 11a5 5 0 0 0 5 5c6.1 0 11-5.8 11-14V4h-2Zm-3 3c-2.7 1.3-6 4.7-8 8.2V15c0-3.6 3.3-6.8 8-8Zm-8 8.5c1.2-1.7 3.2-3.8 5.3-5.3-2.8 2.1-5 4.8-5.3 5.3Z" })),
    heart: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 21s-8-4.8-8-11a4.8 4.8 0 0 1 8-3.5A4.8 4.8 0 0 1 20 10c0 6.2-8 11-8 11Z" })),
    "heart-outline": h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 21s-8-4.8-8-11a4.8 4.8 0 0 1 8-3.5A4.8 4.8 0 0 1 20 10c0 6.2-8 11-8 11Zm0-2.4c2-1.4 6-4.8 6-8.6a2.8 2.8 0 0 0-4.7-2.1L12 9.1l-1.3-1.2A2.8 2.8 0 0 0 6 10c0 3.8 4 7.2 6 8.6Z" })),
    home: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m12 2 9 7.6V21h-6v-6H9v6H3V9.6L12 2Z" })),
    journal: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M6 3h11a2 2 0 0 1 2 2v16H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z" })),
    letters: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M4 19 9.4 5h2.3L17 19h-2.3l-1.1-3H7.4l-1.1 3H4Zm4.1-5h4.8l-2.4-6.5L8.1 14ZM18 6h3v13h-2V8h-1V6Z" })),
    lock: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z" })),
    meditate: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-2 2-4 3 1.2 1.6L10 10.5V14l-5 4 1.2 1.6L12 15l5.8 4.6L19 18l-5-4v-3.5l2.8 2.1L18 11l-4-3h-4Zm-8 13h20v2H2v-2Z" })),
    melius: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M9 3a7 7 0 0 1 6.8 8.8A6 6 0 1 1 12.2 22a6.9 6.9 0 0 1-2.7-4H9A7.5 7.5 0 0 1 9 3Zm8.5 11a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" })),
    music: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M15 3h4v12.5A3.5 3.5 0 1 1 17 12.3V7h-4v10.5A3.5 3.5 0 1 1 11 14.3V3h4Z" })),
    note: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M6 3h12v18H6V3Zm2 2v14h8V5H8Z" })),
    play: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M8 5v14l11-7L8 5Z" })),
    "plus-circle": h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Zm1-4a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm0 2a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" })),
    profile: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6Z" })),
    phone: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M6.6 2.8 9 5.2c.7.7.8 1.8.2 2.6L7.9 9.3a16 16 0 0 0 6.8 6.8l1.5-1.3a2 2 0 0 1 2.6.2l2.4 2.4a2 2 0 0 1 0 2.8l-1.3 1.3c-1.1 1.1-2.7 1.6-4.2 1.2C8.6 21.7 2.3 15.4 1.2 7.4c-.4-1.5.1-3.1 1.2-4.2l1.3-1.3a2 2 0 0 1 2.9 0Z" })),
    run: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M13 3.5a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm-1.4 5L8.2 10l-2 5.7 2 .7 1.6-4.6 2.2-.8 2.1 2.1-1.1 3.9h2.1l1.5-4.8-3.2-3.2a2 2 0 0 0-1.8-.5Z" })),
    drop: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 2c4.8 5.6 7 8.9 7 12a7 7 0 1 1-14 0c0-3.1 2.2-6.4 7-12Z" })),
    wind: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M3 8h11a3 3 0 1 0-3-3h2a1 1 0 1 1 1 1H3v2Zm0 5h15a3 3 0 1 1-3 3h2a1 1 0 1 0 1-1H3v-2Zm0 5h8v2H3v-2Z" })),
    search: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.2 4.2-1.4 1.4-4.2-4.2A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" })),
    send: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M2 21 23 12 2 3v7l12 2-12 2v7Z" })),
    share: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M13 3v8h-2V3L7.8 6.2 6.4 4.8 12 0l5.6 4.8-1.4 1.4L13 3ZM5 9h4v2H6v9h12v-9h-3V9h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Z" })),
    sparkles: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m12 2 1.7 4.8L18.5 8l-4.8 1.2L12 14l-1.7-4.8L5.5 8l4.8-1.2L12 2Z" })),
    stats: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M4 13h4v8H4v-8Zm6-10h4v18h-4V3Zm6 6h4v12h-4V9Z" })),
    streak: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M7 14.5a5 5 0 0 0 10 0c0-1.7-.8-3.2-2.4-4.7-.2 1-.9 1.7-1.9 2.3.2-2.4-.7-4.6-2.7-6.6.2 2.5-.7 4.4-2.5 5.7A4.5 4.5 0 0 0 7 14.5Z" })),
    therapy: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M8 9h3.2l2.1 2.1a2 2 0 0 0 2.8 0L19 8.2 17.6 6.8 14.7 9.7 12 7H8v2Z" })),
    tree: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m12 2 6 8h-3l4 6h-5v5h-4v-5H5l4-6H6l6-8Z" })),
    undo: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M9 7V3L2 10l7 7v-4h5.5A4.5 4.5 0 1 1 14.5 4H13V2h1.5a6.5 6.5 0 1 1 0 13H7V7h2Z" })),
    warning: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 3 1.5 21h21L12 3Zm1 14h-2v2h2v-2Zm0-7h-2v6h2v-6Z" }))
  };
  return icons[name] || null;
}

function launchConfettiBurst() {
  const existingLayer = document.querySelector(".confetti-layer");
  if (existingLayer) existingLayer.remove();
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  for (const piece of confettiPieces) {
    const node = document.createElement("span");
    node.className = `confetti-piece ${piece.shape}`;
    node.style.left = "50%";
    node.style.top = "58%";
    node.style.animationDelay = piece.delay;
    node.style.animationDuration = piece.duration;
    node.style.background = piece.color;
    node.style.boxShadow = `0 0 14px ${piece.color}66`;
    node.style.setProperty("--confetti-x", piece.x);
    node.style.setProperty("--confetti-y", piece.y);
    node.style.setProperty("--confetti-rotate", piece.rotate);
    layer.appendChild(node);
  }
  document.body.appendChild(layer);
  window.clearTimeout(launchConfettiBurst.timer);
  launchConfettiBurst.timer = window.setTimeout(() => layer.remove(), 2600);
}

function titleCase(value) {
  return value.split(" ").map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`).join(" ");
}

createRoot(document.getElementById("root")).render(h(App));
