"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Send,
  Search,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  BarChart2,
  TrendingUp,
  Clock,
  Plus,
  Trash2,
  ArrowUpDown,
  ArrowRight,
  Database,
  ShieldCheck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import DayNightBackground from "../../components/ui/DayNightBackground";
import { intelligenceQueryAction, QueryResult } from "../actions/query";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  text?: string;
  result?: QueryResult;
  isLoading?: boolean;
  timestamp: number;
}

interface ChatHistory {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

const fmtUSD = (v: number | string | null | undefined): string => {
  if (v == null || isNaN(Number(v))) return "N/A";
  const n = Number(v);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
};

const fmtPct = (v: number | string | null | undefined): string => {
  if (v == null || isNaN(Number(v))) return "N/A";
  const n = Number(v);
  // If already normalized 0-1, multiply by 100
  const displayVal = n <= 1 && n >= -1 ? n * 100 : n;
  return `${displayVal.toFixed(1)}%`;
};

const formatValue = (val: any, format?: string) => {
  if (val == null) return "—";
  switch (format) {
    case "pct":
      return fmtPct(val);
    case "usd":
      return fmtUSD(val);
    case "number":
      return typeof val === "number" ? val.toLocaleString() : val;
    default:
      return String(val);
  }
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

const DataChart = ({
  result,
  isDayMode,
}: {
  result: QueryResult;
  isDayMode: boolean;
}) => {
  const { chart_type, data, chart_x_key, chart_y_key, chart_title } = result;

  if (chart_type === "none" || !data || data.length === 0) {
    return (
      <div className="h-[280px] w-full flex flex-col items-center justify-center bg-white/5 rounded-xl border border-white/5 border-dashed">
        <BarChart2 size={32} className="text-slate-600 mb-2 opacity-20" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          No chart data available
        </span>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className={`${isDayMode ? "bg-white border-black/10 text-slate-800" : "bg-slate-900 border-white/10 text-white"} p-3 rounded-xl border shadow-xl`}
        >
          <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-50">
            {label}
          </p>
          <p className="text-sm font-mono font-bold">
            {formatValue(
              payload[0].value,
              result.table_columns.find((c) => c.key === chart_y_key)?.format,
            )}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
        {chart_title}
      </h4>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chart_type === "bar" ? (
            <BarChart
              data={data.slice(0, 15)}
              margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
            >
              <XAxis
                dataKey={chart_x_key}
                tick={{ fill: isDayMode ? "#64748b" : "#94a3b8", fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: isDayMode ? "#64748b" : "#94a3b8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) =>
                  formatValue(
                    v,
                    result.table_columns.find((c) => c.key === chart_y_key)
                      ?.format,
                  )
                }
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  fill: isDayMode
                    ? "rgba(0,0,0,0.05)"
                    : "rgba(255,255,255,0.05)",
                }}
              />
              <Bar
                dataKey={chart_y_key}
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
                fillOpacity={0.8}
              />
            </BarChart>
          ) : (
            <LineChart
              data={data.slice(0, 15)}
              margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
            >
              <XAxis
                dataKey={chart_x_key}
                tick={{ fill: isDayMode ? "#64748b" : "#94a3b8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: isDayMode ? "#64748b" : "#94a3b8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) =>
                  formatValue(
                    v,
                    result.table_columns.find((c) => c.key === chart_y_key)
                      ?.format,
                  )
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={chart_y_key}
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: "#6366f1", strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const DataTable = ({
  result,
  isDayMode,
}: {
  result: QueryResult;
  isDayMode: boolean;
}) => {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAll, setShowAll] = useState(false);

  const sortedData = useMemo(() => {
    if (!sortKey) return result.data;
    return [...result.data].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [result.data, sortKey, sortDir]);

  const displayData = showAll ? sortedData : sortedData.slice(0, 15);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (!result.data || result.data.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-white/5 bg-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead
              className={`${isDayMode ? "bg-slate-100" : "bg-white/5"} border-b border-white/5`}
            >
              <tr>
                <th className="px-4 py-3 font-black text-slate-500 uppercase tracking-widest w-12">
                  #
                </th>
                {result.table_columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="px-4 py-3 font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-400 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      <ArrowUpDown
                        size={10}
                        className={
                          sortKey === col.key ? "text-indigo-400" : "opacity-20"
                        }
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displayData.map((row, idx) => (
                <tr
                  key={idx}
                  className={`hover:${isDayMode ? "bg-black/5" : "bg-white/5"} transition-colors`}
                >
                  <td className="px-4 py-3 font-mono text-slate-500">
                    #{idx + 1}
                  </td>
                  {result.table_columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 font-bold font-mono">
                      {formatValue(row[col.key], col.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {result.data.length > 15 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-2"
        >
          {showAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showAll ? "Show Less" : `Show All (${result.data.length} entries)`}
        </button>
      )}
    </div>
  );
};

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function QueryPage() {
  const [input, setInput] = useState("");
  const [chats, setChats] = useState<ChatHistory[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isDayMode, setIsDayMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Night/Day Mode Detection
  useEffect(() => {
    const checkMode = () =>
      setIsDayMode(document.body.classList.contains("day-mode"));
    checkMode();
    const observer = new MutationObserver(checkMode);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId),
    [chats, activeChatId],
  );

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages, scrollToBottom]);

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      text: text.trim(),
      timestamp: Date.now(),
    };

    const loadingMsg: Message = {
      id: Math.random().toString(36).substring(7),
      role: "assistant",
      isLoading: true,
      timestamp: Date.now() + 1,
    };

    let chatId = activeChatId;
    if (!chatId) {
      chatId = Math.random().toString(36).substring(7);
      const newChat: ChatHistory = {
        id: chatId,
        title: text.substring(0, 40),
        messages: [userMsg, loadingMsg],
        updatedAt: Date.now(),
      };
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(chatId);
    } else {
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: [...c.messages, userMsg, loadingMsg],
                updatedAt: Date.now(),
              }
            : c,
        ),
      );
    }

    setInput("");

    try {
      const result = await intelligenceQueryAction(text);

      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.isLoading
                    ? { ...m, isLoading: false, result, timestamp: Date.now() }
                    : m,
                ),
              }
            : c,
        ),
      );
    } catch (err) {
      console.error("Query failed", err);
    }
  };

  const createNewChat = () => {
    setActiveChatId(null);
    setInput("");
  };

  const suggestions = [
    "Which countries have the highest military strength?",
    "Show me top 10 economies by GDP",
    "What are the biggest arms exporters?",
    "Which regions have highest climate risk?",
  ];

  return (
    <main className="flex flex-col h-screen bg-transparent overflow-hidden relative selection:bg-indigo-500/30">
      <DayNightBackground />
      <Navbar activeModule="overview" onModuleChange={() => {}} />
      <Sidebar activeModule="overview" />

      <div className="flex-1 flex pl-[72px] mt-[64px] h-[calc(100vh-64px)] w-full">
        {/* Conversation Sidebar */}
        <div
          className={`w-[280px] h-full flex flex-col border-r ${isDayMode ? "bg-white/80 border-black/5" : "bg-slate-900/40 border-white/5"} backdrop-blur-xl shrink-0`}
        >
          <div className="p-6">
            <h2 className="text-[11px] font-black tracking-[0.2em] text-indigo-400 uppercase mb-6 flex items-center gap-2">
              <Clock size={14} /> Past Queries
            </h2>
            <button
              onClick={createNewChat}
              className={`w-full py-3 rounded-xl border border-dashed ${isDayMode ? "border-black/10 hover:bg-black/5" : "border-white/10 hover:bg-white/5"} transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400`}
            >
              <Plus size={14} /> New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-2">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`w-full p-4 rounded-2xl text-left transition-all group relative overflow-hidden ${
                  activeChatId === chat.id
                    ? isDayMode
                      ? "bg-indigo-50 text-indigo-600"
                      : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    : isDayMode
                      ? "hover:bg-black/5 text-slate-600"
                      : "hover:bg-white/5 text-slate-400"
                }`}
              >
                <p className="text-xs font-bold truncate pr-6">{chat.title}</p>
                <p className="text-[9px] mt-1 opacity-50 font-mono">
                  {new Date(chat.updatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {activeChatId === chat.id && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={14} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full relative">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8"
          >
            <AnimatePresence initial={false}>
              {!activeChat || activeChat.messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center"
                >
                  <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center mb-8 border border-indigo-500/20">
                    <Brain size={40} className="text-indigo-500" />
                  </div>
                  <h1
                    className={`text-4xl font-black ${isDayMode ? "text-slate-800" : "text-white"} mb-4 tracking-tight`}
                  >
                    Intelligence Terminal
                  </h1>
                  <p className="text-slate-500 text-lg mb-12 font-medium">
                    Query the global knowledge graph. Access live rankings,
                    defense data, economic projections, and climate risk
                    assessments.
                  </p>

                  <div className="grid grid-cols-2 gap-4 w-full">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(s)}
                        className={`p-4 rounded-2xl border text-left text-xs font-bold transition-all ${
                          isDayMode
                            ? "bg-white border-black/5 hover:border-indigo-500 hover:shadow-lg"
                            : "bg-white/5 border-white/5 hover:border-indigo-500/50 hover:bg-white/10"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                activeChat.messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={
                      msg.role === "user" ? "flex justify-end" : "flex gap-4"
                    }
                  >
                    {msg.role === "user" ? (
                      <div
                        className={`max-w-[70%] px-6 py-4 rounded-3xl rounded-br-sm text-sm font-medium shadow-xl ${isDayMode ? "bg-indigo-600 text-white" : "bg-indigo-500 text-white"}`}
                      >
                        {msg.text}
                      </div>
                    ) : (
                      <>
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-1 border ${
                            isDayMode
                              ? "bg-indigo-50 border-indigo-100 text-indigo-600"
                              : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                          }`}
                        >
                          <Brain size={20} />
                        </div>
                        <div
                          className={`flex-1 max-w-[85%] rounded-3xl rounded-tl-sm p-6 space-y-6 shadow-2xl border ${
                            isDayMode
                              ? "bg-white border-black/5 text-slate-800"
                              : "bg-slate-800/60 border-white/8 backdrop-blur-sm text-white"
                          }`}
                        >
                          {msg.isLoading ? (
                            <div className="space-y-4">
                              <div className="flex items-center gap-3 text-indigo-400 font-black text-[10px] uppercase tracking-widest animate-pulse">
                                <Search size={14} className="animate-spin" />
                                Routing Intelligence Query...
                              </div>
                              <div className="space-y-2">
                                <div className="h-4 w-full bg-white/5 rounded-lg animate-pulse" />
                                <div className="h-4 w-[80%] bg-white/5 rounded-lg animate-pulse" />
                                <div className="h-4 w-[60%] bg-white/5 rounded-lg animate-pulse" />
                              </div>
                            </div>
                          ) : msg.result?.error ? (
                            <div className="flex items-center gap-3 text-rose-400 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                              <AlertTriangle size={20} />
                              <div className="text-xs font-bold">
                                {msg.result.error}
                              </div>
                            </div>
                          ) : msg.result ? (
                            <>
                              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                <div className="flex items-center gap-2">
                                  <ShieldCheck
                                    size={16}
                                    className="text-emerald-400"
                                  />
                                  <span className="text-[10px] font-black uppercase tracking-widest opacity-50">
                                    Intelligence Report
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                  <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-indigo-500 transition-all duration-1000"
                                      style={{
                                        width: `${msg.result.confidence}%`,
                                      }}
                                    />
                                  </div>
                                  <span>
                                    {msg.result.confidence}% confidence
                                  </span>
                                </div>
                              </div>

                              <div className="prose prose-invert max-w-none">
                                <p className="text-sm leading-relaxed font-medium opacity-90 whitespace-pre-wrap">
                                  {msg.result.summary}
                                </p>
                              </div>

                              {msg.result.data &&
                                msg.result.data.length > 0 && (
                                  <div className="space-y-8 pt-4">
                                    <DataChart
                                      result={msg.result}
                                      isDayMode={isDayMode}
                                    />
                                    <DataTable
                                      result={msg.result}
                                      isDayMode={isDayMode}
                                    />
                                  </div>
                                )}

                              <div className="pt-4 flex flex-wrap gap-2 items-center">
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest mr-2">
                                  <Database size={10} /> Data Sources:
                                </div>
                                {msg.result.endpoints_called.map((ep, i) => (
                                  <span
                                    key={i}
                                    className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20"
                                  >
                                    {ep}
                                  </span>
                                ))}
                                {msg.result.endpoints_called.length === 0 && (
                                  <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                    AI SYNTHETIC KNOWLEDGE
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-3 text-rose-400 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                              <AlertTriangle size={20} />
                              <div className="text-xs font-bold">
                                Intelligence network unreachable. Please ensure
                                the backend is running on port 8000.
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Input Bar */}
          <div
            className={`p-6 border-t ${isDayMode ? "bg-white/80 border-black/5" : "bg-slate-900/40 border-white/5"} backdrop-blur-xl`}
          >
            <div className="max-w-4xl mx-auto">
              <div
                className={`relative flex items-center border transition-all duration-200 group rounded-2xl ${
                  isDayMode
                    ? "bg-white border-black/10 focus-within:border-indigo-500 focus-within:shadow-xl"
                    : "bg-slate-800/60 border-white/10 focus-within:border-indigo-500/50"
                }`}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask anything about global intelligence data..."
                  className={`flex-1 bg-transparent px-6 py-5 text-sm resize-none focus:outline-none custom-scrollbar ${isDayMode ? "text-slate-800" : "text-white"}`}
                  rows={1}
                />
                <button
                  onClick={() => handleSend()}
                  className="m-2 p-3 bg-indigo-500 hover:bg-indigo-400 rounded-xl text-white transition-all active:scale-95 shadow-lg"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-center mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-50">
                GIE INTELLIGENCE PROTOCOL ACTIVE • LLM HYBRID MODE
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
