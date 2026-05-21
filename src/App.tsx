import React, { useState, useEffect } from "react";
import { 
  Database, 
  Book, 
  FileJson, 
  Search, 
  Upload, 
  Zap, 
  ChevronRight,
  Loader2,
  FileText,
  Clock,
  ArrowRight,
  Sparkles,
  Command,
  ArrowUp,
  Trash2,
  Eye,
  Settings,
  Square,
  CheckSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { api } from "./lib/api";
import { gemini } from "./lib/gemini";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { Settings as SettingsComponent } from "./components/Settings";

// --- Types ---
type Tab = "ingest" | "wiki" | "artifacts" | "query" | "settings";

interface Source {
  name: string;
  size: number;
  mtime: string;
}

// --- Layout Components ---

const Header = () => (
  <header className="h-16 border-b border-zinc-200 flex items-center justify-between px-8 bg-white shrink-0">
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 bg-red-700 rounded flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(185,28,28,0.2)]">N</div>
      <h1 className="text-lg font-medium tracking-tight text-zinc-900">Nexus <span className="text-red-700 font-normal">Knowledge Compiler</span></h1>
    </div>
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shadow-[0_0_8px_rgba(5,150,105,0.3)]"></span>
        <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">Build Active: v4.1.0</span>
      </div>
      <div className="hidden md:flex gap-1">
        <div className="px-3 py-1 bg-zinc-100 border border-zinc-200 rounded text-[10px] text-zinc-500">Gemini-2.0-Flash (Wiki)</div>
        <div className="px-3 py-1 bg-zinc-100 border border-zinc-200 rounded text-[10px] text-zinc-500">Gemini-2.0-Flash (Artifacts)</div>
      </div>
    </div>
  </header>
);

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: Tab, setActiveTab: (t: Tab) => void }) => {
  const items = [
    { id: "ingest", label: "Pipeline", icon: Database },
    { id: "wiki", label: "LLM Wiki", icon: Book },
    { id: "artifacts", label: "Artifacts", icon: FileJson },
    { id: "query", label: "Nexus Query", icon: Search },
    { id: "settings", label: "Settings", icon: Settings },
  ] as const;

  return (
    <aside className="w-64 border-r border-zinc-200 bg-zinc-50 p-6 flex flex-col gap-8 shrink-0">
      <div>
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-6">Engine Control</h2>
        <nav className="space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 rounded-lg",
                activeTab === item.id 
                  ? "bg-white text-zinc-900 border border-zinc-200 shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
              )}
            >
              <item.icon size={16} className={activeTab === item.id ? "text-red-700" : ""} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto">
        <div className="p-4 bg-red-700/5 border border-red-700/10 rounded-xl">
          <div className="text-[10px] text-red-700 font-medium uppercase tracking-wider mb-1">Compiler Status</div>
          <div className="text-xl font-light text-zinc-900 flex items-baseline gap-1">
            4.2<span className="text-xs text-zinc-500">M</span>
          </div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Tokens Synthesized</div>
        </div>
      </div>
    </aside>
  );
};

const ConfirmDialog = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  isDestructive = true
}: { 
  isOpen: boolean, 
  title: string, 
  message: string, 
  onConfirm: () => void, 
  onCancel: () => void,
  isDestructive?: boolean
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-zinc-200"
      >
        <div className="p-6">
          <h3 className="text-xl font-bold text-zinc-900 mb-2">{title}</h3>
          <p className="text-sm text-zinc-500 leading-relaxed">{message}</p>
        </div>
        <div className="bg-zinc-50 p-4 px-6 flex justify-end gap-3 border-t border-zinc-100">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className={cn(
              "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all",
              isDestructive ? "bg-red-700 text-white hover:bg-red-800 shadow-lg shadow-red-700/20" : "bg-zinc-900 text-white hover:bg-zinc-800"
            )}
          >
            Confirm
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("ingest");
  const [sources, setSources] = useState<Source[]>([]);
  const [embeddedSources, setEmbeddedSources] = useState<string[]>([]);
  const [wikiPages, setWikiPages] = useState<string[]>([]);
  const [artifactNames, setArtifactNames] = useState<string[]>([]);
  const [globalStatus, setGlobalStatus] = useState("");
  const [compiling, setCompiling] = useState(false);

  // Persistent Query State
  const [queryHistory, setQueryHistory] = useState<{q: string, a: string, attachments?: string[]}[]>(() => {
    try {
      const saved = localStorage.getItem("nexus_query_history");
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [querySources, setQuerySources] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("nexus_query_sources");
      return saved ? new Set(JSON.parse(saved)) : new Set(["wiki", "artifacts"]);
    } catch (e) { return new Set(["wiki", "artifacts"]); }
  });

  useEffect(() => {
    localStorage.setItem("nexus_query_history", JSON.stringify(queryHistory));
  }, [queryHistory]);

  useEffect(() => {
    localStorage.setItem("nexus_query_sources", JSON.stringify(Array.from(querySources)));
  }, [querySources]);

  // Modal State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({ isOpen: true, title, message, onConfirm: () => {
      onConfirm();
      setConfirmState(prev => ({ ...prev, isOpen: false }));
    }});
  };

  const refreshSources = async () => {
    try {
      const data = await api.getSources();
      setSources(data);
      const [embeddings, wikis, arts] = await Promise.all([
        api.getEmbeddings(),
        api.getWikiPages(),
        api.getArtifacts()
      ]);
      setEmbeddedSources(embeddings);
      setWikiPages(wikis);
      setArtifactNames(arts);
    } catch (err) {
      console.error("[Client] Failed to refresh source data:", err);
    }
  };

  useEffect(() => {
    refreshSources();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white text-zinc-800 overflow-hidden font-sans">
      <Header />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main className="flex-1 overflow-hidden flex flex-col bg-white">
          <AnimatePresence mode="wait">
              <div className={cn(
                "flex-1 min-h-0 h-full",
                (activeTab === "wiki" || activeTab === "artifacts") ? "overflow-hidden" : "overflow-y-auto custom-scrollbar"
              )}>
                {activeTab === "ingest" && (
                  <IngestView 
                    sources={sources} 
                    embeddedSources={embeddedSources}
                    wikiPages={wikiPages}
                    artifactNames={artifactNames}
                    onRefresh={refreshSources} 
                    setStatus={setGlobalStatus} 
                    confirm={triggerConfirm}
                  />
                )}
                {activeTab === "wiki" && <div className="h-full"><WikiView setStatus={setGlobalStatus} confirm={triggerConfirm} /></div>}
                {activeTab === "artifacts" && <div className="h-full"><ArtifactView confirm={triggerConfirm} /></div>}
                {activeTab === "query" && (
                  <div className="h-full">
                    <QueryView 
                      sources={sources} 
                      history={queryHistory} 
                      setHistory={setQueryHistory} 
                      querySources={querySources}
                      setQuerySources={setQuerySources}
                    />
                  </div>
                )}
                {activeTab === "settings" && <SettingsComponent />}
              </div>
          </AnimatePresence>
        </main>
      </div>

      <Footer />

      {/* Persistence Notifications */}
      <AnimatePresence>
        {globalStatus && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-32 right-8 bg-red-700 text-white px-4 py-2 text-xs font-mono rounded-lg shadow-2xl flex items-center gap-3 z-50 border border-white/20"
          >
            <Loader2 className="animate-spin" size={14} />
            {globalStatus}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <ConfirmDialog 
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        />
      </AnimatePresence>
    </div>
  );
}

const Footer = () => (
  <footer className="h-24 bg-white border-t border-zinc-200 p-6 shrink-0 hidden md:block">
    <div className="max-w-4xl mx-auto flex gap-6">
      <div className="flex-1 relative group">
        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-red-700 transition-colors">
          <Search size={18} />
        </div>
        <input 
          disabled
          type="text" 
          placeholder="Ask the compiler: 'What was the projected 5-year ARR trend?'"
          className="w-full h-12 bg-zinc-50 border border-zinc-200 rounded-full pl-14 pr-24 text-sm focus:outline-none focus:ring-1 focus:ring-red-700 transition-all placeholder:text-zinc-400"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <kbd className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[9px] text-zinc-500 uppercase tracking-widest font-sans">Tab to Switch</kbd>
        </div>
      </div>
      <div className="w-56 flex flex-col justify-center border-l border-zinc-200 pl-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.3)]"></span>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Compiler Edge</span>
        </div>
        <div className="text-[11px] text-zinc-500 italic">Synthetic Knowledge Preferred</div>
      </div>
    </div>
  </footer>
);

// --- Subviews with Updated Styles ---

const IngestView = ({ 
  sources, 
  embeddedSources,
  wikiPages,
  artifactNames,
  onRefresh, 
  setStatus,
  confirm
}: { 
  sources: Source[], 
  embeddedSources: string[],
  wikiPages: string[],
  artifactNames: string[],
  onRefresh: () => void, 
  setStatus: (s: string) => void,
  confirm: (title: string, message: string, onConfirm: () => void) => void
}) => {
  const [compiling, setCompiling] = useState(false);
  const [peekContent, setPeekContent] = useState<{name: string, content: string} | null>(null);
  const [processingSource, setProcessingSource] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  const toggleSource = (name: string) => {
    const next = new Set(selectedSources);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedSources(next);
  };

  const toggleAll = () => {
    if (selectedSources.size === sources.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(sources.map(s => s.name)));
    }
  };

  const isEmbedded = (sourceName: string) => {
    const safeName = sourceName.replace(/\.[^/.]+$/, "") + ".json";
    return embeddedSources.includes(safeName);
  };

  const isSynthesized = (sourceName: string) => {
    const base = sourceName.replace(/\.[^/.]+$/, "");
    return wikiPages.includes(base + ".md") || artifactNames.includes(base + ".json");
  };

  const getSourceStatus = (source: Source) => {
    if (isSynthesized(source.name)) return "Synthesized";
    if (isEmbedded(source.name)) return "Vectorized";
    return "Ingested";
  };

  const embeddedCount = sources.filter(s => isEmbedded(s.name)).length;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileCount = e.target.files.length;
    setStatus(`Preparing ${fileCount} files...`);
    
    try {
      const { results, errors } = await api.uploadSources(e.target.files, (curr, total) => {
        setStatus(`Uploading (${curr}/${total})...`);
      });

      await onRefresh();
      
      if (errors.length > 0) {
        const errorList = errors.map(err => `- ${err.name}: ${err.error}`).join("\n");
        alert(`Upload complete with issues:\n${results.length} files succeeded.\n${errors.length} files failed:\n${errorList}`);
      } else {
        alert(`Success: ${fileCount} files integrated into Nexus.`);
      }
    } catch (err: any) {
      console.error("[Client] Upload failed deeply:", err);
      if (err.message === "AUTH_REQUIRED") {
        alert("SECURITY BLOCK: The platform needs you to re-authenticate. Please click the 'Authenticate' button in the center overlay or open this app in a new tab to refresh your security session.");
      } else if (err.message === "CONNECTION_LOST") {
        alert("Connection Lost: The server is unreachable. Check your network or try opening in a new tab.");
      } else {
        alert(`Upload failed: ${err.message}`);
      }
      await onRefresh();
    } finally {
      setStatus("");
      // Reset input
      if (e.target) e.target.value = "";
    }
  };

  const handlePeek = async (source: Source) => {
    setStatus(`Peeking ${source.name}...`);
    try {
      const { content } = await api.getSourceContent(source.name);
      if (!content || content === "No text content found in PDF.") {
        setPeekContent({ name: source.name, content: "ERROR: Extraction returned empty result. The PDF might be an image-only scan, corrupted, or password protected." });
      } else {
        setPeekContent({ name: source.name, content });
      }
    } catch (err: any) {
      console.error("[Client] Peek failed:", err);
      setPeekContent({ name: source.name, content: `CRITICAL EXTRACTION ERROR: ${err.message}` });
    } finally {
      setStatus("");
    }
  };

  const handleDeleteSource = async (name: string) => {
    console.log("[Client] handleDeleteSource initiated for:", name);
    confirm(
      "Purge Raw Source",
      `Are you sure you want to permanently delete the file: ${name.split('-').slice(1).join('-')}? This action cannot be undone.`,
      async () => {
        setStatus(`Purging ${name}...`);
        try {
          console.log("[Client] Calling api.deleteSource...");
          const res = await api.deleteSource(name);
          console.log("[Client] Delete result success:", res);
          await onRefresh();
        } catch (err: any) {
          console.error("[Client] Delete failed deeply:", err);
          alert(`Critical Delete Failure: ${err.message}`);
        } finally {
          setStatus("");
        }
      }
    );
  };

  const handleCompileWiki = async () => {
    const targetSources = selectedSources.size > 0 
      ? sources.filter(s => selectedSources.has(s.name))
      : sources;

    if (targetSources.length === 0) {
      alert("No sources selected (select via checkboxes in table).");
      return;
    }

    setCompiling(true);
    setStatus("Architecting Nexus Wiki...");
    try {
      const wikiFiles = await api.getWikiPages();
      
      // Build a sampling of Global Index to provide context
      let globalIndex = "";
      try {
        const samples = await Promise.all(wikiFiles.slice(0, 8).map(async f => {
          const res = await api.getWikiContent(f);
          return `CONTEXT [${f}]:\n${res.content.slice(0, 500)}...`;
        }));
        globalIndex = samples.join("\n\n---\n\n");
      } catch (e) {
        console.warn("Failed to sample existing wikis", e);
      }

      let count = 0;
      let successCount = 0;
      for (const source of targetSources) {
        count++;
        setProcessingSource(source.name);
        setStatus(`Nexus Evolving (${count}/${targetSources.length}): ${source.name}`);
        
        try {
          const vectorized = isEmbedded(source.name);
          const isPdf = source.name.toLowerCase().endsWith(".pdf");
          let content = "";
          if (!vectorized) {
            const res = await api.getSourceContent(source.name);
            content = res.content;
          }
          
          if (!vectorized && !isPdf && (!content || content.length < 10)) {
            console.warn(`Insufficient content for ${source.name}`);
            continue;
          }

          const filename = source.name.replace(/\.[^/.]+$/, ".md");
          let existingTargetContent = "";
          
          // Check if this specific entity already exists in the wiki
          if (wikiFiles.includes(filename)) {
            try {
              const res = await api.getWikiContent(filename);
              existingTargetContent = res.content;
              setStatus(`Synthesizing Refinement: ${filename}`);
            } catch (e) { /* ignore */ }
          }

          const wikiContent = await gemini.synthesizeWikiPage(content, globalIndex, source.name, existingTargetContent);
          await api.saveWiki(filename, wikiContent);
          successCount++;
        } catch (itemErr: any) {
          console.error(`Failed to synthesize ${source.name}:`, itemErr);
          if (itemErr.message === "AUTH_REQUIRED") throw itemErr;
        } finally {
          setProcessingSource(null);
        }
      }
      await onRefresh();
      alert(`Nexus Library Evolved. ${successCount} topic paths updated.`);
    } catch (err: any) {
      console.error("Global synthesis error:", err);
      if (err.message === "AUTH_REQUIRED") {
        alert("SECURITY BLOCK during synthesis. Please re-authenticate or refresh in a new tab.");
      } else {
        alert("Critical synthesis error: " + err.message);
      }
    } finally {
      setCompiling(false);
      setStatus("");
    }
  };

  const handleCompileArtifacts = async () => {
    const targetSources = selectedSources.size > 0 
      ? sources.filter(s => selectedSources.has(s.name))
      : sources;

    if (targetSources.length === 0) {
      alert("No sources selected (select via checkboxes in table).");
      return;
    }

    setCompiling(true);
    setStatus("Generating Artifacts...");
    try {
      const existingArtifacts = await api.getArtifacts();
      const taskSpec = "Extract multi-year revenue, expenses, and growth trends. Identify executive summary points.";
      let successCount = 0;
      let count = 0;

      for (const source of targetSources) {
        count++;
        setProcessingSource(source.name);
        setStatus(`Artifact (${count}/${targetSources.length}): ${source.name}`);
        
        const filename = source.name.replace(/\.[^/.]+$/, ".json");
        if (existingArtifacts.includes(filename)) {
          continue;
        }

        try {
          const vectorized = isEmbedded(source.name);
          const isPdf = source.name.toLowerCase().endsWith(".pdf");
          let content = "";
          if (!vectorized) {
            const res = await api.getSourceContent(source.name);
            content = res.content;
          }
          
          if (!vectorized && !isPdf && (!content || content.length < 10)) {
            setProcessingSource(null);
            continue;
          }

          const artifactData = await gemini.compileArtifact(content, taskSpec, source.name);
          await api.saveArtifact(filename, artifactData);
          successCount++;
        } catch (itemErr: any) {
          console.error(`Failed to compile artifact for ${source.name}:`, itemErr);
          // Don't alert here to avoid blocking the loop
        } finally {
          setProcessingSource(null);
        }
      }
      await onRefresh();
      alert(`Artifact extraction complete. ${successCount} new artifacts added.`);
    } catch (err: any) {
      console.error("Global artifact generation error:", err);
      alert("Artifact generation error: " + err.message);
    } finally {
      setCompiling(false);
      setStatus("");
    }
  };

  const handleProcessEmbeddings = async () => {
    const targetSources = selectedSources.size > 0 
      ? sources.filter(s => selectedSources.has(s.name))
      : sources.filter(s => !isEmbedded(s.name));

    if (targetSources.length === 0) {
      alert("All selected sources already vectorized.");
      return;
    }

    setCompiling(true);
    setStatus("Processing Embeddings...");
    try {
      let processed = 0;
      for (const source of targetSources) {
        processed++;
        setProcessingSource(source.name);
        setStatus(`Embedding: ${source.name}`);
        try {
          const { content } = await api.getSourceContent(source.name);
          if (!content || content.length < 10) {
            setProcessingSource(null);
            continue;
          }
          await api.processEmbeddings(source.name, content);
        } catch (err) {
          console.error(`Failed embeddings for ${source.name}:`, err);
        } finally {
          setProcessingSource(null);
        }
      }
      await onRefresh();
      alert(`Vectorization complete. ${processed} records synthesized.`);
    } catch (err: any) {
      alert("Embedding error: " + err.message);
    } finally {
      setCompiling(false);
      setStatus("");
    }
  };

  return (
    <div className="h-full flex flex-col p-8 md:p-12 space-y-12 overflow-y-auto custom-scrollbar">
      <header className="max-w-4xl flex items-start justify-between gap-8">
        <div>
          <div className="text-red-700 font-mono text-[10px] uppercase tracking-[0.3em] mb-4">Pipeline Ingest</div>
          <h2 className="text-4xl font-bold tracking-tight text-zinc-900 mb-4">Compile Raw Sources</h2>
          <p className="text-zinc-500 max-w-2xl text-lg font-light leading-relaxed">
            The Nexus compiler transforms unstructured PDFs, CSVs, and logs into a durable knowledge graph of wiki pages and typed JSON artifacts.
          </p>
        </div>
        <div className="hidden lg:flex flex-col items-end gap-2 bg-zinc-50 border border-zinc-200 p-6 rounded-2xl shrink-0">
          <div className="flex items-center justify-between w-full mb-1">
            <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Vector Coverage</div>
            <button 
              onClick={() => confirm("Factory Reset", "Are you sure you want to permanently delete ALL sources, wiki pages, and embeddings? Settings will be preserved.", async () => {
                setStatus("Purging core data...");
                try {
                  await api.resetSystem();
                  await onRefresh();
                  alert("Nexus data purged.");
                } catch (e: any) {
                  alert("Reset failed: " + e.message);
                } finally {
                  setStatus("");
                }
              })}
              className="text-[10px] font-bold text-red-600 hover:text-red-800 transition-colors flex items-center gap-1 uppercase tracking-tighter"
            >
              <Trash2 size={10} /> Purge All
            </button>
          </div>
          <div className="flex items-center gap-2">
             <div className="w-32 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(embeddedCount / (sources.length || 1)) * 100}%` }}
                  className="h-full bg-red-700" 
                />
             </div>
             <span className="text-xs font-mono font-bold text-zinc-900">{Math.round((embeddedCount / (sources.length || 1)) * 100)}%</span>
          </div>
          <div className="text-[9px] text-zinc-400 uppercase tracking-tighter">
            {embeddedCount} of {sources.length} unique sources vectorized
          </div>
          <p className="text-[10px] text-zinc-400 text-right mt-1 max-w-[220px] leading-tight">
            <strong>Contextual Density:</strong> Higher coverage allows the Nexus Resolver to perform exhaustive semantic retrieval across your entire library during complex reasoning tasks.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
        <label className="border border-zinc-200 bg-zinc-50 p-12 rounded-3xl flex flex-col items-center justify-center border-dashed cursor-pointer hover:bg-zinc-100 hover:border-red-700/50 transition-all group shrink-0">
          <input type="file" multiple className="hidden" onChange={handleFileUpload} />
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm border border-zinc-100">
             <Upload className="text-zinc-500 group-hover:text-red-700" />
          </div>
          <span className="text-lg font-medium text-zinc-900">Drop data sources here</span>
          <span className="text-sm text-zinc-500 mt-2">PDF, CSV, JSON, LOG (Max 50MB)</span>
        </label>

        <div className="space-y-4">
          <button 
             disabled={compiling || sources.length === 0}
             onClick={handleCompileWiki}
             className="w-full bg-red-700 hover:bg-red-800 disabled:opacity-20 disabled:hover:bg-red-700 text-white p-6 rounded-2xl flex items-center justify-between group transition-all shadow-lg shadow-red-700/10"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Book size={20} />
              </div>
              <div className="text-left">
                <div className="text-xs uppercase tracking-widest opacity-60 font-medium text-white">Build Mode 01</div>
                <div className="font-bold text-lg">Synthesize Wiki</div>
              </div>
            </div>
            <ArrowRight className="opacity-40 group-hover:opacity-100 translate-x-0 group-hover:translate-x-2 transition-transform" />
          </button>

          <button 
             disabled={compiling || sources.length === 0}
             onClick={handleCompileArtifacts}
             className="w-full border border-zinc-200 bg-white hover:border-red-700/50 hover:bg-zinc-50 disabled:opacity-20 text-zinc-900 p-6 rounded-2xl flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-red-700/10 rounded-lg flex items-center justify-center text-red-700">
                <FileJson size={20} />
              </div>
              <div className="text-left">
                <div className="text-xs uppercase tracking-widest text-zinc-400 font-medium">Build Mode 02</div>
                <div className="font-bold text-lg">Compile Artifacts</div>
              </div>
            </div>
            <ArrowRight className="opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-2 transition-transform text-red-700" />
          </button>

          <button 
             disabled={compiling || sources.length === 0}
             onClick={handleProcessEmbeddings}
             className="w-full border border-zinc-200 bg-white hover:border-red-700/50 hover:bg-zinc-50 disabled:opacity-20 text-zinc-900 p-6 rounded-2xl flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-red-700/10 rounded-lg flex items-center justify-center text-red-700">
                <Sparkles size={20} />
              </div>
              <div className="text-left">
                <div className="text-xs uppercase tracking-widest text-zinc-400 font-medium">Build Mode 03</div>
                <div className="font-bold text-lg">Synthesize Embeddings</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{embeddedCount} of {sources.length} sources vectorized</div>
              </div>
            </div>
            <ArrowRight className="opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-2 transition-transform text-red-700" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {peekContent && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="max-w-5xl overflow-hidden"
          >
            <div className="bg-zinc-900 text-zinc-400 p-8 rounded-2xl font-mono text-xs relative">
              <button 
                onClick={() => setPeekContent(null)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-white"
              >
                Close [x]
              </button>
              <div className="mb-4 text-red-700 font-bold uppercase tracking-widest">
                Raw Extraction Preview: {peekContent.name.split('-').slice(1).join('-')}
              </div>
              <div className="whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">
                {peekContent.content || "No content extracted."}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl">
        <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database size={14} /> Active Source Manifest
          </div>
          {selectedSources.size > 0 && (
            <button 
              onClick={() => setSelectedSources(new Set())}
              className="text-red-700 hover:text-red-800 transition-colors flex items-center gap-2 font-bold tracking-tighter"
            >
              Clear Selection ({selectedSources.size})
            </button>
          )}
        </h3>
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50">
                <th className="px-6 py-4 w-10">
                  <button onClick={toggleAll} className="text-zinc-400 hover:text-red-700 transition-colors">
                    {selectedSources.size === sources.length && sources.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </th>
                <th className="px-6 py-4 font-medium text-zinc-500 uppercase text-[10px] tracking-widest">Filename</th>
                <th className="px-6 py-4 font-medium text-zinc-500 uppercase text-[10px] tracking-widest">Size</th>
                <th className="px-6 py-4 font-medium text-zinc-500 uppercase text-[10px] tracking-widest">Status</th>
                <th className="px-6 py-4 font-medium text-zinc-500 uppercase text-[10px] tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sources.map(s => (
                <tr 
                  key={s.name} 
                  className={cn(
                    "hover:bg-zinc-50 transition-colors group cursor-pointer",
                    selectedSources.has(s.name) && "bg-red-50/30"
                  )}
                  onClick={() => toggleSource(s.name)}
                >
                  <td className="px-6 py-4">
                    <div className="text-zinc-400 group-hover:text-red-700 transition-colors">
                      {selectedSources.has(s.name) ? <CheckSquare size={16} className="text-red-700" /> : <Square size={16} />}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-700 font-mono text-xs max-w-xs truncate">
                    <div className="flex items-center gap-2">
                      {s.name.split('-').slice(1).join('-')}
                      {isEmbedded(s.name) && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-50 text-[10px] font-bold text-red-700 border border-red-100 shadow-sm animate-in fade-in zoom-in duration-300">
                          <Sparkles size={8} className="fill-red-700" /> VECTORIZED
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 text-xs">{(s.size / 1024).toFixed(1)}KB</td>
                  <td className="px-6 py-4">
                    {(() => {
                      const status = getSourceStatus(s);
                      const isWorking = processingSource === s.name;
                      
                      return (
                        <span className={cn(
                          "flex items-center gap-2 text-[10px] uppercase font-bold tracking-tighter",
                          isWorking ? "text-amber-600 animate-pulse" :
                          status === "Synthesized" ? "text-red-700" :
                          status === "Vectorized" ? "text-cyan-600" :
                          "text-zinc-400"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full shadow-[0_0_5px_rgba(0,0,0,0.3)]",
                            isWorking ? "bg-amber-500 shadow-amber-500/50" :
                            status === "Synthesized" ? "bg-red-700 shadow-red-700/50" :
                            status === "Vectorized" ? "bg-cyan-600 shadow-cyan-600/50" :
                            "bg-zinc-300"
                          )}></span>
                          {isWorking ? "In-Processing" : (status === "Ingested" ? "Uploaded" : status)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handlePeek(s)}
                        className="text-[10px] text-red-700 font-bold uppercase tracking-widest flex items-center gap-1.5 hover:underline"
                      >
                        <Eye size={12} /> Peek
                      </button>
                      <button 
                        onClick={() => handleDeleteSource(s.name)}
                        className="text-[10px] text-zinc-400 hover:text-red-700 font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 size={12} /> Purge
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-zinc-400 italic font-serif">No files in manifest...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const WikiView = ({ 
  setStatus,
  confirm
}: { 
  setStatus: (s: string) => void,
  confirm: (title: string, message: string, onConfirm: () => void) => void
}) => {
  const [pages, setPages] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const refreshPages = () => {
    api.getWikiPages().then(setPages);
  };

  useEffect(() => {
    refreshPages();
  }, []);

  const handleSelectPage = async (name: string) => {
    setLoading(true);
    setSelectedPage(name);
    try {
      const res = await api.getWikiContent(name);
      setContent(res.content);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWiki = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    console.log("[Client] handleDeleteWiki initiated for:", name);
    confirm(
      "Purge Knowledge Segment",
      `Confirm permanent deletion of: ${name}? This will remove it from the compiled library.`,
      async () => {
        setStatus(`Purging knowledge: ${name}`);
        try {
          console.log("[Client] Calling api.deleteWiki...");
          const res = await api.deleteWiki(name);
          console.log("[Client] Wiki delete result success:", res);
          if (selectedPage === name) {
            setSelectedPage(null);
            setContent("");
          }
          refreshPages();
        } catch (err: any) {
          console.error("[Client] Wiki delete failed deeply:", err);
          alert(`Wiki purge failed: ${err.message}`);
        } finally {
          setStatus("");
        }
      }
    );
  };

  return (
    <div className="h-full flex overflow-hidden">
      <div className="w-80 border-r border-zinc-200 bg-zinc-50 p-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
        <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-2">Compiled Wiki</h3>
        <div className="flex flex-col gap-1">
          {pages.map(page => (
            <div 
              key={page}
              onClick={() => handleSelectPage(page)}
              className={cn(
                "group flex flex-col p-4 rounded-xl text-left transition-all cursor-pointer",
                selectedPage === page 
                  ? "bg-red-700/10 border border-red-700/30 text-red-800 shadow-sm" 
                  : "border border-transparent text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-700"
              )}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSelectPage(page);
                }
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 truncate">
                  <FileText size={14} className={selectedPage === page ? "text-red-700" : "opacity-30"} />
                  <span className="text-xs font-mono truncate">{page}</span>
                </div>
                <button 
                  onClick={(e) => handleDeleteWiki(e, page)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-700 transition-all focus:outline-none"
                  aria-label="Delete wiki page"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="text-[10px] opacity-40 uppercase tracking-widest">MDX SYMBOLIC</div>
            </div>
          ))}
          {pages.length === 0 && <div className="p-4 text-xs italic text-zinc-400">Inventory empty...</div>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-12 md:p-16 bg-white">
        {loading ? (
          <div className="h-full flex items-center justify-center text-red-700">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : selectedPage ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            <div className="text-red-700 font-mono text-[10px] uppercase tracking-[0.3em] mb-6">Generated Content</div>
            <div className="markdown-body prose-zinc">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
            <div className="mt-16 pt-8 border-t border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="h-1 w-12 bg-red-700 rounded-full"></div>
                 <div className="h-1 w-8 bg-red-700/20 rounded-full"></div>
                 <div className="text-[10px] text-zinc-400 uppercase tracking-widest">Provenance Confirmed</div>
              </div>
              <Sparkles size={16} className="text-red-700/30" />
            </div>
          </motion.div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-10 grayscale">
            <Book size={120} className="mb-6" />
            <div className="text-2xl font-bold uppercase tracking-[0.2em] text-zinc-900">Select Library Segment</div>
          </div>
        )}
      </div>
    </div>
  );
};

const ArtifactView = ({ 
  confirm 
}: { 
  confirm: (title: string, message: string, onConfirm: () => void) => void 
}) => {
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const refreshArtifacts = () => {
    api.getArtifacts().then(setArtifacts);
  };

  useEffect(() => {
    refreshArtifacts();
  }, []);

  const handleSelectArtifact = async (name: string) => {
    setSelectedArtifact(name);
    const result = await api.getArtifactContent(name);
    setData(result);
  };

  const handleDeleteArtifact = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    console.log("[Client] handleDeleteArtifact initiated for:", name);
    confirm(
      "Purge Artifact Data",
      `Confirm permanent deletion of artifact: ${name}?`,
      async () => {
        setDeleting(name);
        try {
          console.log("[Client] Calling api.deleteArtifact...");
          await api.deleteArtifact(name);
          console.log("[Client] Artifact delete success.");
          if (selectedArtifact === name) {
            setSelectedArtifact(null);
            setData(null);
          }
          refreshArtifacts();
        } catch (err: any) {
          console.error("[Client] Artifact delete failed deeply:", err);
          alert(`Artifact delete failure: ${err.message}`);
        } finally {
          setDeleting(null);
        }
      }
    );
  };

  return (
    <div className="h-full flex overflow-hidden bg-white">
      <div className="w-80 border-r border-zinc-200 bg-zinc-50 p-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar shrink-0">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-2">Artifact Library</h2>
        <div className="flex flex-col gap-3">
          {artifacts.map(art => (
            <div 
              key={art}
              onClick={() => handleSelectArtifact(art)}
              className={cn(
                "group p-4 bg-white border border-zinc-200 rounded-xl text-left transition-all hover:bg-zinc-100/50 shadow-sm cursor-pointer relative",
                selectedArtifact === art ? "border-red-700/40 ring-1 ring-red-700/10" : ""
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={cn("text-xs font-mono truncate mr-6", selectedArtifact === art ? "text-red-700" : "text-zinc-600")}>{art}</span>
                <button 
                  disabled={deleting === art}
                  onClick={(e) => handleDeleteArtifact(e, art)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-700 transition-all disabled:opacity-50"
                  aria-label="Delete artifact"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-zinc-400 uppercase tracking-widest">Type: Typed_JSON</div>
                <div className="w-2 h-2 rounded-full bg-emerald-600 shadow-sm"></div>
              </div>
            </div>
          ))}
          {artifacts.length === 0 && <div className="p-4 text-xs italic text-zinc-400 text-center">No artifacts compiled yet.</div>}
        </div>
      </div>

      <div className="flex-1 p-12 overflow-hidden flex flex-col bg-white min-h-0">
        {data ? (
          <div className="flex-1 flex flex-col space-y-6 min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-700/10 text-red-700 rounded-lg">
                  <FileJson size={18} />
                </div>
                <div>
                   <h2 className="text-xl font-bold text-zinc-900 tracking-tight">{selectedArtifact}</h2>
                   <div className="text-[10px] text-zinc-400 uppercase tracking-[0.2em] mt-1">Compiled JSON Object</div>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-white border border-zinc-200 rounded text-[10px] uppercase tracking-widest shadow-sm">Schema: Artifact_v1</span>
              </div>
            </div>

            <div className="flex-1 bg-zinc-50 border border-zinc-200 rounded-2xl p-8 overflow-auto custom-scrollbar font-mono text-sm text-zinc-800 leading-relaxed shadow-inner min-h-0">
               <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-10 grayscale">
            <FileJson size={120} className="mb-6 text-zinc-900" />
            <div className="text-2xl font-bold uppercase tracking-[0.2em] text-zinc-900">Inspecting Objects</div>
          </div>
        )}
      </div>
    </div>
  );
};

const QueryView = ({ 
  sources, 
  history, 
  setHistory,
  querySources,
  setQuerySources
}: { 
  sources: Source[], 
  history: {q: string, a: string, attachments?: string[]}[], 
  setHistory: (h: any) => void,
  querySources: Set<string>,
  setQuerySources: (s: Set<string>) => void
}) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<{file: File, base64: string}[]>([]);

  const toggleQuerySource = (src: string) => {
    const next = new Set(querySources);
    if (next.has(src)) {
      if (next.size > 1) next.delete(src);
    } else {
      next.add(src);
    }
    setQuerySources(next);
  };

  const suggestions = [
    "What is the 5-year trend for SaaS Subscription Revenue?",
    "Summarize the cumulative Net Income from Year 1 to Year 5.",
    "How did R&D spending change relative to growth in Professional Services?",
    "Compare the Debt-to-Equity ratios between Year 2 and Year 4.",
    "Identify the top 3 expense categories over the entire 5-year period."
  ];

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = (ev.target?.result as string).split(',')[1];
        setAttachments(prev => [...prev, { file, base64 }]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent | string) => {
    if (typeof e !== "string") e.preventDefault();
    const q = typeof e === "string" ? e : query;
    if (!q.trim() && attachments.length === 0) return;
    if (loading) return;

    setLoading(true);
    setQuery(""); // Always clear input immediately
    const currentAttachments = [...attachments];
    setAttachments([]);

    try {
      let context = "";
      let isFallback = false;

      let wikiContent = "";
      if (querySources.has("wiki")) {
        const wikiFiles = await api.getWikiPages();
        if (wikiFiles.length > 0) {
          const wikiResults = await Promise.all(wikiFiles.slice(0, 10).map(f => api.getWikiContent(f)));
          wikiContent = wikiResults.map(r => r.content).join("\n\n---\n\n");
        }
      }

      let artifactContent = "";
      if (querySources.has("artifacts")) {
        const artifactFiles = await api.getArtifacts();
        if (artifactFiles.length > 0) {
          const artifactResults = await Promise.all(artifactFiles.slice(0, 10).map(f => api.getArtifactContent(f)));
          artifactContent = artifactResults.map(r => JSON.stringify(r)).join("\n\n---\n\n");
        }
      }

      context = `WIKI DATABANK:\n${wikiContent}\n\nARTIFACT DATABANK (JSON):\n${artifactContent}`;

      const queryLower = q.toLowerCase();
      if ((!wikiContent && !artifactContent) || queryLower.includes("raw") || queryLower.includes("source") || queryLower.includes("uncompiled")) {
        isFallback = true;
        const sourceResults = await Promise.all(sources.slice(0, 3).map(s => api.getSourceContent(s.name)));
        context = sourceResults.map(r => r.content).join("\n\n---\n\n");
      }

      const attPayload = currentAttachments.map(a => ({
        data: a.base64,
        mimeType: a.file.type
      }));

      const res = await gemini.resolveQuery(q, context, isFallback, attPayload);
      
      setHistory((prev: any) => [{
        q: q || (currentAttachments.length > 0 ? `Analysis of ${currentAttachments.length} attachments` : "Query"), 
        a: res,
        attachments: currentAttachments.map(a => a.file.name)
      }, ...prev]);
    } catch (err) {
      console.error(err);
      setHistory((prev: any) => [{q: q, a: "Error resolving synthetic knowledge query."}, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-[1300px] mx-auto p-4 md:p-8 overflow-hidden bg-white">
      <header className="mb-4 border-b border-zinc-100 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="text-red-700 font-mono text-[10px] uppercase tracking-[0.3em]">Neural Query</div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 italic">Nexus Resolver</h2>
          </div>
          
          <div className="flex items-center gap-4">
            {history.length > 0 && (
              <button 
                onClick={() => setHistory([])}
                className="text-[9px] uppercase tracking-widest text-zinc-300 hover:text-red-700 transition-colors"
                title="Clear History"
              >
                Clear Cache
              </button>
            )}
            <div className="flex bg-zinc-50 p-0.5 rounded-lg border border-zinc-200">
              <button 
                onClick={() => toggleQuerySource("wiki")}
                className={cn(
                  "px-3 py-1 text-[9px] uppercase tracking-widest font-bold rounded-md transition-all",
                  querySources.has("wiki") ? "bg-red-700 text-white shadow-md" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                Wiki
              </button>
              <button 
                onClick={() => toggleQuerySource("artifacts")}
                className={cn(
                  "px-3 py-1 text-[9px] uppercase tracking-widest font-bold rounded-md transition-all",
                  querySources.has("artifacts") ? "bg-red-700 text-white shadow-md" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                Artifacts
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-4">
          <p className="text-zinc-400 text-[10px] font-light max-w-md truncate">
            Sources: {querySources.has("wiki") ? "Wiki" : ""} {querySources.size > 1 ? "&" : ""} {querySources.has("artifacts") ? "Artifacts" : ""}.
          </p>
          <div className="flex flex-wrap gap-1.5 justify-end">
            {suggestions.slice(0, 3).map(s => (
              <button 
                key={s}
                onClick={() => handleSubmit(s)}
                className="text-[9px] bg-zinc-50 border border-zinc-100 text-zinc-400 px-2 py-0.5 rounded-full hover:border-red-700/30 hover:text-red-700 transition-all max-w-[150px] truncate"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar mb-6 pt-2">
        {history.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center py-24 text-center opacity-20 grayscale">
             <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
                <Command size={32} />
             </div>
             <div className="text-2xl font-bold uppercase tracking-[0.1em] italic text-zinc-900">System Idle...</div>
             <p className="text-sm mt-2 font-mono">Awaiting complex query input</p>
          </div>
        )}
        
        {loading && (
          <div className="space-y-6">
            <div className="flex gap-4 items-start">
               <div className="w-8 h-8 rounded-full bg-zinc-100 animate-pulse" />
               <div className="h-8 bg-zinc-100 w-1/2 rounded animate-pulse" />
            </div>
            <div className="pl-12">
               <div className="h-40 bg-zinc-50 w-full rounded-2xl animate-pulse" />
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-12">
          {history.map((item, i) => (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              key={i} 
              className={cn("space-y-6", i > 0 && "opacity-40 hover:opacity-100 transition-opacity")}
            >
              <div className="flex items-start gap-4">
                 <div className="w-10 h-10 rounded-xl bg-red-700/10 border border-red-700/20 flex items-center justify-center shrink-0 text-red-700 shadow-sm">
                    <ArrowUp size={18} className="rotate-45" />
                 </div>
                 <div className="flex-1">
                    <h4 className="text-xl font-bold text-zinc-900 mt-1 leading-tight">{item.q}</h4>
                    {item.attachments && item.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {item.attachments.map(att => (
                          <span key={att} className="text-[9px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded border border-zinc-200">
                             📎 {att}
                          </span>
                        ))}
                      </div>
                    )}
                 </div>
              </div>
              <div className="pl-10">
                 <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 relative shadow-sm">
                    <div className="markdown-body nexus-response">
                      <ReactMarkdown>{item.a}</ReactMarkdown>
                    </div>
                    {item.a.includes("Fallback") && (
                       <div className="absolute top-4 right-6 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                          <span className="text-[9px] uppercase tracking-widest text-amber-700 font-bold">Raw Fallback</span>
                       </div>
                    )}
                 </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="shrink-0 space-y-4">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2">
            {attachments.map((att, i) => (
              <div key={i} className="group relative bg-red-700/5 border border-red-700/20 rounded-lg px-3 py-2 flex items-center gap-3">
                 <FileText size={14} className="text-red-700" />
                 <span className="text-xs font-medium text-zinc-700 truncate max-w-[120px]">{att.file.name}</span>
                 <button 
                  onClick={() => removeAttachment(i)}
                  className="p-1 hover:bg-red-700 hover:text-white rounded transition-colors text-red-700"
                 >
                   <Trash2 size={10} />
                 </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-red-700 to-red-800 rounded-2xl blur opacity-0 group-focus-within:opacity-10 transition-opacity" />
          <div className="relative bg-white border border-zinc-200 rounded-2xl overflow-hidden focus-within:border-red-700/50 transition-colors shadow-2xl">
            <input 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Query compiled engine or attach files..."
              className="w-full bg-transparent py-6 px-16 outline-none text-xl font-medium tracking-tight text-zinc-900 placeholder:text-zinc-300"
            />
            
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center">
              <label className="p-2 text-zinc-400 hover:text-red-700 cursor-pointer transition-colors">
                <Upload size={20} />
                <input type="file" multiple className="hidden" onChange={handleFileAttach} />
              </label>
            </div>

            <button 
              type="submit" 
              disabled={loading || (!query.trim() && attachments.length === 0)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-red-700 text-white rounded-xl flex items-center justify-center hover:bg-red-800 disabled:opacity-20 disabled:hover:bg-red-700 transition-all shadow-lg shadow-red-700/20"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} fill="currentColor" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
