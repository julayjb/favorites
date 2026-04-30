import React, { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { supabase } from "./lib/supabase";
import "./styles.css";

// Parse frontmatter manualmente (sem depender de gray-matter que usa Buffer)
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!match) {
    return { data: {}, content };
  }

  const [, frontmatterText, markdownContent] = match;
  const data = {};

  // Parse simples de YAML
  frontmatterText.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // Remove quotes se existirem
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Parse arrays simples (ex: [tag1, tag2])
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim());
      }

      data[key] = value;
    }
  });

  return { data, content: markdownContent };
}

function slugify(value = "") {
 return value
 .normalize("NFD")
 .replace(/[\u0300-\u036f]/g, "")
 .toLowerCase()
 .trim()
 .replace(/[^a-z0-9]+/g, "-")
 .replace(/(^-|-$)/g, "");
}

function parseDateFromFilename(name) {
 const match = name.match(/^(\d{4}-\d{2}-\d{2})[-_]/);
 return match ? match[1] : null;
}

function parseTitleFromContent(content) {
 const match = content.match(/^#\s+(.+)$/m);
 return match ? match[1].trim() : null;
}

function parseTitleFromFilename(name) {
 return name
 .replace(/\.md$/i, "")
 .replace(/^\d{4}-\d{2}-\d{2}[-_]?/, "")
 .replace(/[-_]+/g, " ")
 .trim()
 .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeTags(tags) {
 if (!tags) return [];
 if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
 if (typeof tags === "string") {
 return tags
 .split(",")
 .map((tag) => tag.trim())
 .filter(Boolean);
 }
 return [];
}

function groupByMonth(files) {
 const grouped = {};

 for (const file of files) {
 const key = file.document_date?.slice(0, 7) || "Sem data";
 if (!grouped[key]) grouped[key] = [];
 grouped[key].push(file);
 }

 return Object.entries(grouped).sort(([a], [b]) => (a < b ? 1 : -1));
}

function AuthScreen() {
 const [email, setEmail] = useState("");
 const [sending, setSending] = useState(false);
 const [message, setMessage] = useState("");
 const [error, setError] = useState("");

 async function handleSubmit(event) {
 event.preventDefault();
 setSending(true);
 setMessage("");
 setError("");

 const { error } = await supabase.auth.signInWithOtp({
 email,
 options: {
 emailRedirectTo: window.location.origin
 }
 });

 setSending(false);

 if (error) {
 setError(error.message);
 return;
 }

 setMessage("Magic link enviado. Confira seu email.");
 }

 return (
 <div className="auth-shell">
 <div className="auth-card">
 <p className="eyebrow">Favorites</p>
 <h1>Entrar com magic link</h1>
 <p className="muted">
 Digite seu email para receber um link de acesso.
 </p>

 <form onSubmit={handleSubmit} className="auth-form">
 <input
 type="email"
 placeholder="voce@exemplo.com"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 required
 />

 <button className="primary-btn" type="submit" disabled={sending}>
 {sending ? "Enviando..." : "Enviar magic link"}
 </button>
 </form>

 {message ? <p className="success-text">{message}</p> : null}
 {error ? <p className="error-text">{error}</p> : null}
 </div>
 </div>
 );
}

export default function App() {
 const fileInputRef = useRef(null);

 const [session, setSession] = useState(null);
 const [documents, setDocuments] = useState([]);
 const [selectedId, setSelectedId] = useState(null);
 const [query, setQuery] = useState("");
 const [loadingDocs, setLoadingDocs] = useState(true);
 const [importing, setImporting] = useState(false);
 const [error, setError] = useState("");
 const [dragOver, setDragOver] = useState(false);

 useEffect(() => {
 supabase.auth.getSession().then(({ data }) => {
 setSession(data.session ?? null);
 });

 const {
 data: { subscription }
 } = supabase.auth.onAuthStateChange((_event, session) => {
 setSession(session ?? null);
 });

 return () => subscription.unsubscribe();
 }, []);

 useEffect(() => {
 if (!session?.user) {
 setDocuments([]);
 setSelectedId(null);
 setLoadingDocs(false);
 return;
 }

 fetchDocuments();
 }, [session?.user?.id]);

 async function fetchDocuments() {
 setLoadingDocs(true);
 setError("");

 const { data, error } = await supabase
 .from("documents")
 .select("*")
 .order("document_date", { ascending: false })
 .order("created_at", { ascending: false });

 setLoadingDocs(false);

 if (error) {
 setError(error.message);
 return;
 }

 setDocuments(data || []);

 if (!selectedId && data?.length) {
 setSelectedId(data[0].id);
 }
 }

 const filteredDocuments = useMemo(() => {
 const q = query.trim().toLowerCase();

 if (!q) return documents;

 return documents.filter((doc) => {
 const haystack = [
 doc.title,
 doc.source,
 ...(doc.tags || []),
 doc.content
 ]
 .join(" ")
 .toLowerCase();

 return haystack.includes(q);
 });
 }, [documents, query]);

 const grouped = useMemo(() => groupByMonth(filteredDocuments), [filteredDocuments]);

 const selected = useMemo(
 () => documents.find((doc) => doc.id === selectedId) ?? null,
 [documents, selectedId]
 );

 async function handleLogout() {
 await supabase.auth.signOut();
 }

 async function importFiles(fileList) {
 const files = Array.from(fileList || []).filter((file) => /\.md$/i.test(file.name));

 if (!files.length) return;

 setImporting(true);
 setError("");

 try {
 const parsedDocs = await Promise.all(
 files.map(async (file) => {
 const raw = await file.text();
 const parsed = parseFrontmatter(raw);
 const frontmatter = parsed.data || {};
 const content = parsed.content?.trim() || "";

 const title =
 frontmatter.title ||
 parseTitleFromContent(content) ||
 parseTitleFromFilename(file.name) ||
 "Sem título";

 const documentDate =
 frontmatter.date ||
 parseDateFromFilename(file.name) ||
 new Date().toISOString().slice(0, 10);

 const tags = normalizeTags(frontmatter.tags);
 const source = frontmatter.source ? String(frontmatter.source) : null;

 return {
 user_id: session.user.id,
 title,
 slug: slugify(title) || crypto.randomUUID(),
 source,
 document_date: documentDate,
 tags,
 content
 };
 })
 );

 const { error } = await supabase.from("documents").upsert(parsedDocs, {
 onConflict: "user_id,slug"
 });

 if (error) {
 throw error;
 }

 await fetchDocuments();
 } catch (err) {
 setError(err.message || "Erro ao importar arquivos.");
 } finally {
 setImporting(false);
 if (fileInputRef.current) {
 fileInputRef.current.value = "";
 }
 }
 }

 async function handleDeleteSelected() {
 if (!selected) return;

 const confirmed = window.confirm(`Excluir "${selected.title}"?`);
 if (!confirmed) return;

 const { error } = await supabase.from("documents").delete().eq("id", selected.id);

 if (error) {
 setError(error.message);
 return;
 }

 const remaining = documents.filter((doc) => doc.id !== selected.id);
 setDocuments(remaining);
 setSelectedId(remaining[0]?.id ?? null);
 }

 function handleDrop(event) {
 event.preventDefault();
 setDragOver(false);
 importFiles(event.dataTransfer.files);
 }

 if (!session) {
 return <AuthScreen />;
 }

 return (
 <div className="app-shell">
 <aside className="sidebar">
 <div className="brand-block">
 <p className="eyebrow">Favorites</p>
 <h1>Seu vault em markdown</h1>
 <p className="muted">
 Organize leituras, newsletters e posts em um só lugar.
 </p>
 </div>

 <div
 className={`upload-card ${dragOver ? "drag-over" : ""}`}
 onDragOver={(e) => {
 e.preventDefault();
 setDragOver(true);
 }}
 onDragLeave={() => setDragOver(false)}
 onDrop={handleDrop}
 >
 <h3>Importar markdown</h3>
 <p className="muted small">
 Arraste arquivos `.md` ou selecione manualmente.
 </p>

 <input
 ref={fileInputRef}
 type="file"
 accept=".md"
 multiple
 hidden
 onChange={(e) => importFiles(e.target.files)}
 />

 <button
 className="primary-btn"
 onClick={() => fileInputRef.current?.click()}
 disabled={importing}
 >
 {importing ? "Importando..." : "Selecionar arquivos"}
 </button>
 </div>

 <div className="search-block">
 <input
 type="text"
 placeholder="Buscar por título, tag ou conteúdo..."
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 />
 </div>

 <div className="sidebar-footer">
 <p className="muted small">
 Logado como <strong>{session.user.email}</strong>
 </p>
 <button className="ghost-btn" onClick={handleLogout}>
 Sair
 </button>
 </div>

 <div className="library-block">
 {loadingDocs ? (
 <div className="empty-state">Carregando documentos...</div>
 ) : grouped.length === 0 ? (
 <div className="empty-state">Nenhum documento encontrado.</div>
 ) : (
 grouped.map(([month, monthFiles]) => (
 <div key={month} className="month-group">
 <div className="month-label">{month}</div>

 <div className="file-list">
 {monthFiles.map((file) => (
 <button
 key={file.id}
 className={`file-item ${selected?.id === file.id ? "active" : ""}`}
 onClick={() => setSelectedId(file.id)}
 >
 <span className="file-title">{file.title}</span>
 <span className="file-date">{file.document_date || "Sem data"}</span>
 {file.tags?.length ? (
 <span className="file-tags">{file.tags.join(" • ")}</span>
 ) : null}
 </button>
 ))}
 </div>
 </div>
 ))
 )}
 </div>
 </aside>

 <main className="content-panel">
 {error ? <div className="error-banner">{error}</div> : null}

 {selected ? (
 <>
 <div className="content-toolbar">
 <div>
 <p className="eyebrow">Documento</p>
 <h2>{selected.title}</h2>
 <p className="muted small">
 {selected.source || "Sem fonte"} • {selected.document_date || "Sem data"}
 </p>

 {selected.tags?.length ? (
 <div className="tag-row">
 {selected.tags.map((tag) => (
 <span key={tag} className="tag-pill">
 {tag}
 </span>
 ))}
 </div>
 ) : null}
 </div>

 <div className="toolbar-actions">
 <button
 className="ghost-btn"
 onClick={() => navigator.clipboard.writeText(selected.content)}
 >
 Copiar MD
 </button>

 <button className="danger-btn" onClick={handleDeleteSelected}>
 Excluir
 </button>
 </div>
 </div>

 <article
 className="markdown-body"
 dangerouslySetInnerHTML={{ __html: marked.parse(selected.content) }}
 />
 </>
 ) : (
 <div className="blank-panel">
 <h2>Nenhum documento selecionado</h2>
 <p>
 Importe seus arquivos markdown para começar a montar seu vault.
 </p>
 </div>
 )}
 </main>
 </div>
 );
}