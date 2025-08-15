import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { AlertTriangle, Anchor, Book, ExternalLink, Flag, Gavel, MessageSquare, Plus, RefreshCw, Save, Shield, Trash2, Upload, Download, Link as LinkIcon, Info } from "lucide-react";

/**
 * Canada Governance Watch — Civic Defense Dashboard (Netlify-ready)
 * -----------------------------------------------------------------
 * A single-file React app for Next.js/React deployments (works great on Netlify).
 *
 * What's inside (all baked-in):
 *  - Threat-Level theming (subtle, professional) that recolors the whole UI
 *  - Live(ish) tracking of official RSS/Atom feeds (Parliament, OSFI, TBS, Justice, OPC)
 *  - Charter Hub with direct links and a plain-language cheat sheet
 *  - Civic Action hub (MP lookup links, petitions, ATIP/FOI, complaint pathways)
 *  - "Be Aware" briefings scaffolding (fact-box profiles; source-first, non-partisan)
 *  - Significant Developments news column (from feeds)
 *  - Lightweight, optional Forum (localStorage), with moderation tools
 *  - Import/Export JSON config, optional Cloudflare Worker proxy for CORS
 *
 * Styling: Tailwind + shadcn/ui + Framer Motion
 * NOTE: For live feed fetching in the browser, some sources may require a proxy due to CORS.
 */

// === OPTIONAL: set your proxy URL here (Cloudflare Worker from the snippet at bottom) ===
const PROXY_URL = ""; // e.g., "https://your-proxy.yourdomain.workers.dev"; leave blank to fetch directly

// -------------------- Threat-Level Theme --------------------
const THEME_LEVELS = {
  1: {
    name: "Low / Stable",
    bg: "linear-gradient(180deg, #e8f5e9, #c8e6c9)",
    accent: "#2e7d32",
    shadow: "0 2px 8px rgba(46,125,50,0.20)",
    ring: "ring-emerald-200",
  },
  2: {
    name: "Guarded / Watch",
    bg: "linear-gradient(180deg, #fffde7, #fff8e1)",
    accent: "#f9a825",
    shadow: "0 2px 8px rgba(249,168,37,0.20)",
    ring: "ring-amber-200",
  },
  3: {
    name: "Elevated / Concern",
    bg: "linear-gradient(180deg, #fff3e0, #ffe0b2)",
    accent: "#ef6c00",
    shadow: "0 2px 10px rgba(239,108,0,0.22)",
    ring: "ring-orange-200",
  },
  4: {
    name: "High / Alert",
    bg: "linear-gradient(180deg, #ffebee, #ffcdd2)",
    accent: "#c62828",
    shadow: "0 2px 12px rgba(198,40,40,0.24)",
    ring: "ring-rose-200",
  },
  5: {
    name: "Severe / Crisis",
    bg: "linear-gradient(180deg, #f3e5f5, #e1bee7)",
    accent: "#6a1b9a",
    shadow: "0 2px 14px rgba(106,27,154,0.26)",
    ring: "ring-purple-200",
  },
};

function useThreatTheme(level) {
  useEffect(() => {
    const t = THEME_LEVELS[level];
    document.documentElement.style.setProperty("--bg-gradient", t.bg);
    document.documentElement.style.setProperty("--accent-color", t.accent);
    document.documentElement.style.setProperty("--card-shadow", t.shadow);
  }, [level]);
}

// -------------------- Minimal RSS/Atom Parser --------------------
function parseFeed(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const isRSS = xml.querySelector("channel");
  const isAtom = xml.querySelector("feed");
  const items = [];
  if (isRSS) {
    xml.querySelectorAll("item").forEach((it) => {
      items.push({
        title: it.querySelector("title")?.textContent?.trim() || "Untitled",
        link: it.querySelector("link")?.textContent?.trim() || "",
        date: it.querySelector("pubDate")?.textContent?.trim() || it.querySelector("dc\:date")?.textContent?.trim() || "",
        source: xml.querySelector("channel > title")?.textContent?.trim() || "RSS",
      });
    });
  } else if (isAtom) {
    xml.querySelectorAll("entry").forEach((it) => {
      items.push({
        title: it.querySelector("title")?.textContent?.trim() || "Untitled",
        link: it.querySelector("link")?.getAttribute("href") || "",
        date: it.querySelector("updated")?.textContent?.trim() || it.querySelector("published")?.textContent?.trim() || "",
        source: xml.querySelector("feed > title")?.textContent?.trim() || "Atom",
      });
    });
  }
  return items;
}

function prettyDate(d) {
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d || "";
    return dt.toLocaleString();
  } catch {
    return d || "";
  }
}

async function fetchThroughProxy(url) {
  const target = PROXY_URL ? `${PROXY_URL}?url=${encodeURIComponent(url)}` : url;
  const res = await fetch(target);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.text();
}

// -------------------- Default Feeds & Watch Items --------------------
const OFFICIAL_FEEDS = [
  { label: "House of Commons – LEGISinfo (RSS)", url: "https://www.parl.ca/LegisInfo/RSS.aspx", isFeed: true },
  { label: "Senate – Bills (RSS)", url: "https://sencanada.ca/en/rss/bills/", isFeed: true },
  { label: "OSFI – News (RSS)", url: "https://www.osfi-bsif.gc.ca/Eng/rss/Pages/default.aspx", isFeed: true },
  { label: "Treasury Board – News (RSS)", url: "https://www.canada.ca/en/treasury-board-secretariat/news/rss.html", isFeed: true },
  { label: "Justice Canada – News (RSS)", url: "https://www.justice.gc.ca/eng/news-nouv/rss/index.xml", isFeed: true },
  { label: "Privacy Commissioner – News (RSS)", url: "https://www.priv.gc.ca/en/rss/news/", isFeed: true },
];

const DEFAULT_WATCHES = [
  {
    id: crypto.randomUUID(),
    name: "Digital ID – Unified Sign-In / Credentials",
    status: "watching",
    notes: "Mandatory-by-default or cross-dept data sharing would be a red flag.",
    sources: [
      { label: "Treasury Board – Digital Identity", url: "https://www.canada.ca/en/government/system/digital-government/digital-government-innovations/digital-identity.html", isFeed: false },
    ],
    tags: ["Digital ID", "Data Sharing"],
    lastSeenTitles: [],
  },
  {
    id: crypto.randomUUID(),
    name: "Bill C-2 – Strong Borders Act",
    status: "watching",
    notes: "Watch for compelled install/access provisions + broad data taps beyond border context.",
    sources: [
      { label: "LEGISinfo – Bill C-2", url: "https://www.parl.ca/legisinfo/en/bill/44-1/c-2", isFeed: false },
      ...OFFICIAL_FEEDS.filter(f=>f.label.includes("House of Commons"))
    ],
    tags: ["Surveillance", "Law/Policy"],
    lastSeenTitles: [],
  },
  {
    id: crypto.randomUUID(),
    name: "Online Harms – successor to C-63",
    status: "watching",
    notes: "Risk = policing lawful speech via regulator orders or proactive monitoring.",
    sources: [
      { label: "Heritage Canada – News (Atom)", url: "https://www.canada.ca/en/canadian-heritage.atom.xml", isFeed: true },
    ],
    tags: ["Speech", "Regulation"],
    lastSeenTitles: [],
  },
  {
    id: crypto.randomUUID(),
    name: "OSFI B-15 / Climate Risk & ESG in Finance",
    status: "watching",
    notes: "Shift from disclosure to access/control (credit, pricing) would be decisive.",
    sources: [
      ...OFFICIAL_FEEDS.filter(f=>f.label.includes("OSFI"))
    ],
    tags: ["ESG", "Finance"],
    lastSeenTitles: [],
  },
  {
    id: crypto.randomUUID(),
    name: "AI in Government – algorithmic eligibility",
    status: "watching",
    notes: "Look for AI-based eligibility/fraud scoring without human appeal.",
    sources: [
      { label: "Treasury Board – AI", url: "https://www.canada.ca/en/government/system/digital-government/digital-government-innovations/artificial-intelligence.html", isFeed: false },
      ...OFFICIAL_FEEDS.filter(f=>f.label.includes("Treasury Board"))
    ],
    tags: ["AI", "Governance"],
    lastSeenTitles: [],
  },
  {
    id: crypto.randomUUID(),
    name: "Emergency Powers – thresholds & renewals",
    status: "watching",
    notes: "Lower thresholds or automatic renewals would normalize exceptional powers.",
    sources: [
      ...OFFICIAL_FEEDS.filter(f=>f.label.includes("Justice Canada"))
    ],
    tags: ["Emergencies", "Civil Liberties"],
    lastSeenTitles: [],
  },
];

// -------------------- Utilities --------------------
function useLocalStorage(key, initial) {
  const [state, setState] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState];
}

// -------------------- Forum (LocalStorage) --------------------
function Forum() {
  const [threads, setThreads] = useLocalStorage("govwatch:threads", []);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const addThread = () => {
    if (!title.trim() || !body.trim()) return toast.message("Title and message required");
    setThreads([{ id: crypto.randomUUID(), title: title.trim(), body: body.trim(), ts: Date.now(), replies: [] }, ...threads]);
    setTitle(""); setBody("");
  };
  const addReply = (id, text) => {
    if (!text.trim()) return;
    setThreads(threads.map(t => t.id === id ? { ...t, replies: [...t.replies, { id: crypto.randomUUID(), text: text.trim(), ts: Date.now() }] } : t));
  };
  const removeThread = (id) => setThreads(threads.filter(t=>t.id!==id));
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl shadow-sm" style={{ boxShadow: "var(--card-shadow)" }}>
        <CardContent className="p-4">
          <h3 className="mb-2 text-lg font-semibold flex items-center gap-2"><MessageSquare className="h-5 w-5"/> Start a discussion</h3>
          <div className="grid gap-2">
            <Input placeholder="Topic title" value={title} onChange={(e)=>setTitle(e.target.value)} />
            <Textarea placeholder="Ask a question, share a resource (keep it factual, non-partisan, and respectful)." value={body} onChange={(e)=>setBody(e.target.value)} />
            <div className="flex justify-end"><Button onClick={addThread}><Plus className="mr-2 h-4 w-4"/>Post</Button></div>
          </div>
          <p className="mt-3 text-xs text-slate-600">Community rules: stay factual, cite sources, no calls to violence or illegal activity. Mods may remove content that breaches these rules.</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {threads.map(t => (
          <Card key={t.id} className="rounded-2xl ring-1 ring-inset bg-white" style={{ boxShadow: "var(--card-shadow)" }}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-semibold">{t.title}</h4>
                  <div className="text-xs text-slate-500">{new Date(t.ts).toLocaleString()}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={()=>removeThread(t.id)}><Trash2 className="h-4 w-4"/></Button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-slate-800">{t.body}</p>
              <Separator className="my-3"/>
              <ThreadReplies thread={t} onReply={addReply} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ThreadReplies({ thread, onReply }) {
  const [text, setText] = useState("");
  return (
    <div>
      <div className="space-y-2">
        {thread.replies.map(r => (
          <div key={r.id} className="rounded-xl border p-3">
            <div className="text-xs text-slate-500">{new Date(r.ts).toLocaleString()}</div>
            <div className="whitespace-pre-wrap">{r.text}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input placeholder="Write a reply…" value={text} onChange={(e)=>setText(e.target.value)} />
        <Button onClick={()=>{ onReply(thread.id, text); setText(""); }}>Reply</Button>
      </div>
    </div>
  );
}

// -------------------- Charter & Action --------------------
const CHARTER_LINKS = [
  { label: "Charter (Official Text)", url: "https://laws-lois.justice.gc.ca/eng/Const/page-12.html" },
  { label: "Charter – Plain Language (Justice Canada)", url: "https://www.justice.gc.ca/eng/csj-sjc/just/05.html" },
  { label: "Download PDF (Constitution Acts)", url: "https://laws-lois.justice.gc.ca/PDF/const_e.pdf" },
];

const CIVIC_ACTION = [
  { icon: <Gavel className="h-4 w-4"/>, label: "Find & Contact Your MP", url: "https://www.ourcommons.ca/members/en" },
  { icon: <Flag className="h-4 w-4"/>, label: "Start/View e-Petitions (Parliament)", url: "https://petitions.ourcommons.ca/en/Home/Index" },
  { icon: <Anchor className="h-4 w-4"/>, label: "Access to Information (ATIP)", url: "https://atip-aiprp.tbs-sct.canada.ca/en/submit-request" },
  { icon: <Shield className="h-4 w-4"/>, label: "Complain to Privacy Commissioner", url: "https://www.priv.gc.ca/en/contact-the-opc/" },
];

// -------------------- Be Aware Briefings (Scaffold) --------------------
/**
 * Important: keep this section sourced and neutral. Avoid naming individuals; focus on behaviours/indicators.
 * Below is example structure. Populate with citations from CSIS, RCMP, academic/NGO reports.
 */
const BRIEFINGS = [
  {
    id: "misinfo-tactics",
    title: "Disinformation Tactics (General)",
    summary: "Common online tactics used to distort debate or intimidate critics.",
    bullets: [
      "Astroturf campaigns (fake grassroots)",
      "Bot amplification & inauthentic accounts",
      "Harassment brigades targeting journalists/activists",
      "Doctored documents and fabricated leaks",
    ],
    sources: [
      { label: "Elections Canada – Online Influence (overview)", url: "https://www.elections.ca/" },
    ],
  },
];

// -------------------- Main App --------------------
export default function GovernanceWatch() {
  const [watches, setWatches] = useLocalStorage("govwatch:watches", DEFAULT_WATCHES);
  const [autoRefresh, setAutoRefresh] = useLocalStorage("govwatch:auto", true);
  const [intervalMin, setIntervalMin] = useLocalStorage("govwatch:int", 15);
  const [level, setLevel] = useLocalStorage("govwatch:level", 2);
  const [news, setNews] = useLocalStorage("govwatch:news", []);
  const [loading, setLoading] = useState(false);
  useThreatTheme(level);

  // Aggregate latest from feeds into "Significant Developments"
  const refreshNews = async () => {
    setLoading(true);
    try {
      const feedSources = new Set();
      watches.forEach(w => (w.sources||[]).forEach(s => s.isFeed && s.url && feedSources.add(s.url)));
      OFFICIAL_FEEDS.forEach(f=>feedSources.add(f.url));
      const all = [];
      for (const url of feedSources) {
        try {
          const xml = await fetchThroughProxy(url);
          const items = parseFeed(xml).slice(0, 5);
          all.push(...items);
        } catch (e) { console.warn("Feed fetch failed", url); }
      }
      const dedup = [];
      const seen = new Set();
      all.sort((a,b)=> new Date(b.date||0) - new Date(a.date||0));
      for (const it of all) {
        const key = `${it.title}|${it.link}`;
        if (!seen.has(key)) { seen.add(key); dedup.push(it); }
      }
      setNews(dedup.slice(0, 50));
      toast.success("News refreshed");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!autoRefresh) return;
    refreshNews();
    const id = setInterval(refreshNews, Math.max(1, Number(intervalMin)) * 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, intervalMin, watches]);

  // Watch item helpers
  const addWatch = () => setWatches([...watches, { id: crypto.randomUUID(), name: "New Watch Item", status: "watching", notes: "", sources: [], tags: [], lastSeenTitles: [] }]);
  const removeWatch = (id) => setWatches(watches.filter((w) => w.id !== id));
  const updateWatch = (id, patch) => setWatches(watches.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ watches, level, intervalMin, autoRefresh }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `govwatch-config-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result.toString());
        if (data.watches) setWatches(data.watches);
        if (typeof data.level === "number") setLevel(data.level);
        if (typeof data.autoRefresh === "boolean") setAutoRefresh(data.autoRefresh);
        if (data.intervalMin) setIntervalMin(data.intervalMin);
        toast.success("Imported settings");
      } catch { toast.error("Invalid JSON file"); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>
      <div className="mx-auto max-w-7xl p-6">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Canada Governance Watch</h1>
            <p className="text-slate-700">Tools, facts, and alerts to help you understand, protect, and use your rights.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(level)} onValueChange={(v)=>setLevel(Number(v))}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Threat Level" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(THEME_LEVELS).map(([k,v])=> (
                  <SelectItem key={k} value={k}>{k}. {v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} /> Auto-refresh
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">Every</span>
              <Input className="w-16" type="number" min={1} value={intervalMin} onChange={(e) => setIntervalMin(e.target.value)} />
              <span className="text-sm text-slate-700">min</span>
            </div>
            <Button onClick={refreshNews} variant="secondary"><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>
            <Button onClick={exportJSON} variant="outline"><Download className="mr-2 h-4 w-4"/>Export</Button>
            <label className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm cursor-pointer">
              <Upload className="h-4 w-4"/> Import
              <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
            </label>
          </div>
        </header>

        <Tabs defaultValue="dashboard">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="charter">Charter Hub</TabsTrigger>
            <TabsTrigger value="action">Civic Action</TabsTrigger>
            <TabsTrigger value="aware">Be Aware</TabsTrigger>
            <TabsTrigger value="news">Developments</TabsTrigger>
            <TabsTrigger value="forum">Forum</TabsTrigger>
            <TabsTrigger value="proxy">Proxy</TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="mt-4">
            <div className="mb-4 rounded-2xl border bg-white/70 p-4 backdrop-blur ring-2" style={{ boxShadow: "var(--card-shadow)", borderColor: THEME_LEVELS[level].accent }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" style={{ color: THEME_LEVELS[level].accent }}/><span className="font-semibold">Threat Level: {THEME_LEVELS[level].name}</span></div>
                <div className="text-sm text-slate-600 flex items-center gap-2"><Info className="h-4 w-4"/>Changes reflect shifts in law, surveillance capability, and speech/finance controls. Always verify primary sources.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {watches.map((w) => (
                <motion.div key={w.id} layout>
                  <Card className="rounded-2xl bg-white/80 ring-1" style={{ boxShadow: "var(--card-shadow)", borderColor: THEME_LEVELS[level].accent }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <input className="w-full bg-transparent text-lg font-semibold outline-none" value={w.name} onChange={(e) => updateWatch(w.id, { name: e.target.value })} />
                          <div className="mt-1 flex flex-wrap items-center gap-2">{w.tags?.map((t, i) => (<Badge key={i} variant="secondary" className="rounded-full">{t}</Badge>))}</div>
                        </div>
                        <Select value={w.status} onValueChange={(v) => updateWatch(w.id, { status: v })}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="watching">Watching</SelectItem>
                            <SelectItem value="escalate">Escalate</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="mt-3"><Textarea placeholder="Notes / what to watch for…" value={w.notes} onChange={(e) => updateWatch(w.id, { notes: e.target.value })} /></div>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between"><h3 className="font-medium">Sources</h3><Button size="sm" variant="ghost" onClick={() => updateWatch(w.id, { sources: [...(w.sources||[]), { label: "New Source", url: "", isFeed: false }] })}><Plus className="mr-2 h-4 w-4"/> Add Source</Button></div>
                        <div className="space-y-3">
                          {(w.sources||[]).map((s, idx) => (
                            <div key={idx} className="rounded-xl border p-3">
                              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                                <Input className="md:w-56" placeholder="Label" value={s.label} onChange={(e) => { const next = [...w.sources]; next[idx] = { ...s, label: e.target.value }; updateWatch(w.id, { sources: next }); }}/>
                                <div className="flex items-center gap-2 w-full">
                                  <LinkIcon className="h-4 w-4 text-slate-500"/>
                                  <Input className="flex-1" placeholder="https://…" value={s.url} onChange={(e) => { const next = [...w.sources]; next[idx] = { ...s, url: e.target.value }; updateWatch(w.id, { sources: next }); }}/>
                                  <label className="flex items-center gap-2 text-sm text-slate-700"><Switch checked={!!s.isFeed} onCheckedChange={(val) => { const next = [...w.sources]; next[idx] = { ...s, isFeed: !!val }; updateWatch(w.id, { sources: next }); }}/> RSS/Atom</label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"><ExternalLink className="h-4 w-4"/> Visit</a>
                                  {s.isFeed ? (
                                    <Button size="icon" variant="ghost" onClick={async () => {
                                      try { const xml = await fetchThroughProxy(s.url); const items = parseFeed(xml).slice(0, 3); toast.success(items[0]?.title || "Feed ok"); }
                                      catch { toast.error("Fetch failed. Set up the proxy if CORS blocks."); }
                                    }}>
                                      <RefreshCw className="h-4 w-4"/>
                                    </Button>
                                  ) : null}
                                  <Button size="icon" variant="ghost" onClick={() => { const next = [...w.sources]; next.splice(idx,1); updateWatch(w.id, { sources: next }); }}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                        <div className="inline-flex items-center gap-2"><span>Status:</span><span className="font-medium capitalize">{w.status}</span></div>
                        <Button size="sm" variant="outline" onClick={() => removeWatch(w.id)}><Trash2 className="mr-2 h-4 w-4"/>Remove</Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
            <div className="mt-4 flex justify-end"><Button onClick={addWatch}><Plus className="mr-2 h-4 w-4"/>Add Watch Item</Button></div>
          </TabsContent>

          {/* Charter Hub */}
          <TabsContent value="charter" className="mt-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="rounded-2xl bg-white/80 lg:col-span-2" style={{ boxShadow: "var(--card-shadow)" }}>
                <CardContent className="p-6">
                  <h2 className="mb-2 text-2xl font-semibold flex items-center gap-2"><Book className="h-5 w-5"/> Canadian Charter of Rights & Freedoms</h2>
                  <p className="text-slate-700">Know your rights. These summaries are non-exhaustive; rely on the official text for legal detail.</p>
                  <ul className="mt-4 list-disc pl-5 space-y-1 text-slate-800">
                    <li>Fundamental freedoms: conscience & religion, thought/belief/opinion/expression, peaceful assembly, association.</li>
                    <li>Democratic rights: vote, run for office, regular elections.</li>
                    <li>Mobility rights: enter, remain in, and leave Canada; move and seek livelihood across provinces.</li>
                    <li>Legal rights: life, liberty, security; protection against unreasonable search/seizure; due process; fair trial.</li>
                    <li>Equality rights: equal protection & benefit of the law without discrimination.</li>
                    <li>Language & minority education rights; Aboriginal rights recognized separately in the Constitution.</li>
                  </ul>
                  <div className="mt-4 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
                    <strong>Note:</strong> Rights can be limited by reasonable limits prescribed by law (Section 1) and subject to the notwithstanding clause (Section 33). Understanding these is essential for effective civic action.
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl bg-white/80" style={{ boxShadow: "var(--card-shadow)" }}>
                <CardContent className="p-6">
                  <h3 className="mb-3 font-semibold">Official Links</h3>
                  <div className="space-y-2">
                    {CHARTER_LINKS.map((l,i)=> (
                      <a key={i} className="flex items-center justify-between rounded-xl border bg-white p-3 text-blue-700 hover:underline" href={l.url} target="_blank" rel="noreferrer">
                        <span>{l.label}</span>
                        <ExternalLink className="h-4 w-4"/>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Civic Action */}
          <TabsContent value="action" className="mt-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="rounded-2xl bg-white/80 lg:col-span-2" style={{ boxShadow: "var(--card-shadow)" }}>
                <CardContent className="p-6">
                  <h2 className="mb-2 text-2xl font-semibold flex items-center gap-2"><Gavel className="h-5 w-5"/> Peaceful, Lawful Civic Pushback</h2>
                  <p className="text-slate-700">Use official channels to challenge policies, demand transparency, and protect freedoms.</p>
                  <ol className="mt-4 list-decimal pl-5 space-y-2 text-slate-800">
                    <li><strong>Contact your MP</strong> with a concise, sourced brief. Ask for a written response and committee follow-up.</li>
                    <li><strong>Submit ATIP/FOI requests</strong> to obtain underlying memos, risk assessments, and impact analyses.</li>
                    <li><strong>Support or launch e-petitions</strong> to force a formal government response.</li>
                    <li><strong>Engage oversight bodies</strong> (Privacy Commissioner, Information Commissioner) with documented complaints.</li>
                  </ol>
                </CardContent>
              </Card>
              <Card className="rounded-2xl bg-white/80" style={{ boxShadow: "var(--card-shadow)" }}>
                <CardContent className="p-6">
                  <h3 className="mb-3 font-semibold">Official Portals</h3>
                  <div className="space-y-2">
                    {CIVIC_ACTION.map((l,i)=> (
                      <a key={i} className="flex items-center justify-between rounded-xl border bg-white p-3 text-blue-700 hover:underline" href={l.url} target="_blank" rel="noreferrer">
                        <span className="inline-flex items-center gap-2">{l.icon}{l.label}</span>
                        <ExternalLink className="h-4 w-4"/>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Be Aware */}
          <TabsContent value="aware" className="mt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {BRIEFINGS.map(b => (
                <Card key={b.id} className="rounded-2xl bg-white/80 ring-1" style={{ boxShadow: "var(--card-shadow)", borderColor: THEME_LEVELS[level].accent }}>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold">{b.title}</h3>
                    <p className="mt-1 text-slate-700">{b.summary}</p>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-800">
                      {b.bullets.map((x,i)=>(<li key={i}>{x}</li>))}
                    </ul>
                    <div className="mt-3 space-y-2">
                      {b.sources.map((s,i)=>(
                        <a key={i} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-700 hover:underline">
                          <ExternalLink className="h-4 w-4"/> {s.label}
                        </a>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">This section is informational. Profiles should cite official or peer‑reviewed sources and avoid partisan framing.</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Developments */}
          <TabsContent value="news" className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Significant Developments</h2>
              <Button onClick={refreshNews} disabled={loading}>{loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}Refresh</Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {news.map((n,i)=> (
                <a key={i} href={n.link} target="_blank" rel="noreferrer" className="block rounded-2xl border bg-white/80 p-4 hover:bg-white" style={{ boxShadow: "var(--card-shadow)" }}>
                  <div className="text-xs text-slate-500">{n.source || "Official Source"}</div>
                  <div className="mt-1 font-medium">{n.title}</div>
                  {n.date ? <div className="mt-1 text-xs text-slate-500">{prettyDate(n.date)}</div> : null}
                </a>
              ))}
            </div>
            {!news.length && (
              <div className="mt-6 rounded-2xl border bg-white/70 p-6 text-center text-slate-600" style={{ boxShadow: "var(--card-shadow)" }}>
                No items yet. Add feeds on the Dashboard, enable Auto-refresh, or click Refresh.
              </div>
            )}
          </TabsContent>

          {/* Forum */}
          <TabsContent value="forum" className="mt-4">
            <Forum />
          </TabsContent>

          {/* Proxy */}
          <TabsContent value="proxy" className="mt-4">
            <Card className="rounded-2xl bg-white/80" style={{ boxShadow: "var(--card-shadow)" }}>
              <CardContent className="prose max-w-none p-6">
                <h2 className="mb-2 text-2xl font-semibold">Optional Cloudflare Worker Proxy</h2>
                <p>Some feeds will fail due to CORS. Deploy this tiny proxy and set <code>PROXY_URL</code> at the top of this file:</p>
                <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-slate-100"><code>{`// filename: worker.js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return new Response('Missing url', { status: 400 });
    const res = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'max-age=120',
      },
    });
  }
};`}</code></pre>
                <ol>
                  <li>Create a new Worker at <em>dash.cloudflare.com</em> → Workers & Pages → Create → Paste the code above.</li>
                  <li>Deploy and copy the URL (e.g., <code>https://your-proxy.yourdomain.workers.dev</code>).</li>
                  <li>Set <code>const PROXY_URL = "https://…"</code> at the top of this file and redeploy your site.</li>
                </ol>
                <h3 className="mt-6 text-xl font-semibold">Security note</h3>
                <p>This proxy is <em>read-only</em> and public; don’t use it for authenticated endpoints. For production, consider an allowlist or a shared secret.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="mt-8 text-center text-xs text-slate-600">
          Built for transparency and accountability. Peaceful, lawful civic action only.
        </footer>
      </div>
    </div>
  );
}
