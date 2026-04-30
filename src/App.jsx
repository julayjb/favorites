import React, { useEffect, useMemo, useState } from "react";
import { marked } from "marked";

const FALLBACK_INDEX = [
  {
    id: "2026-04-10-newsletter-ia",
    title: "Newsletter: IA aplicada no dia a dia",
    date: "2026-04-10",
    source: "Newsletter",
    tags: ["ia", "produtividade"],
    path: "/content/2026/2026-04-10-newsletter-ia.md"
  },
  {
    id: "2026-03-28-post-produto",
    title: "Post: Como pensar produto com clareza",
    date: "2026-03-28",
    source: "Blog",
    tags: ["produto", "clareza"],
    path: "/content/2026/2026-03-28-post-produto.md"
  }
];

function sortByDateDesc(items) {
  return [...items].sort((a, b) => (a.date < b.date ? 1 : -1));
}

function groupByMonth(items) {
  return items.reduce((acc, item) => {
    const key = item.date?.slice(0, 7) || "Sem data";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

export default function App() {
  const [index, setIndex] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedContent, setSelectedContent] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Carregando biblioteca...");

  useEffect(() => {
    async function loadIndex() {
      try {
        const response = await fetch("/content/index.json", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Não foi possível carregar o índice.");
        }
        const data = await response.json();
        const sorted = sortByDateDesc(data);
        setIndex(sorted);
        setSelectedId(sorted[0]?.id ?? null);
        setStatus("");
      } catch (error) {
        const sorted = sortByDateDesc(FALLBACK_INDEX);
        setIndex(sorted);
        setSelectedId(sorted[0]?.id ?? null);
        setStatus("Usando conteúdo de exemplo. Verifique se /public/content/index.json existe no projeto.");
      }
    }

    loadIndex();
  }, []);

  const selected = useMemo(
    () => index.find((item) => item.id === selectedId) ?? null,
    [index, selectedId]
  );

  useEffect(() => {
    async function loadMarkdown() {
      if (!selected?.path) {
        setSelectedContent("");
        return;
      }

      try {
        const response = await fetch(selected.path, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Erro ao carregar markdown.");
        }
        const text = await response.text();
        setSelectedContent(text);
      } catch (error) {
        setSelectedContent("# Erro ao carregar arquivo\n\nVerifique se o caminho do markdown existe dentro de `public`.");
      }
    }

    loadMarkdown();
  }, [selected]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return index;

    return index.filter((item) => {
      const haystack = [item.title, item.source, ...(item.tags || [])].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [index, query]);

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="eyebrow">Favorites</p>
          <h1>Seu vault pessoal em markdown</h1>
          <p className="muted">
            Estrutura simples para hospedar no GitHub + Vercel e acessar de qualquer dispositivo.
          </p>
        </div>

        <div className="upload-card">
          <h3>Como adicionar conteúdo</h3>
          <p className="muted small">
            Coloque seus arquivos em <strong>public/content/ano/</strong> e registre cada item no
            <strong> public/content/index.json</strong>.
          </p>
        </div>

        <div className="search-block">
          <input
            className="search-input"
            type="text"
            placeholder="Buscar por título, fonte ou tag"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {status ? <p className="muted small">{status}</p> : null}
        </div>

        <div className="sidebar-scroll">
          {Object.keys(grouped).length === 0 ? (
            <div className="empty-state">Nenhum documento encontrado.</div>
          ) : (
            Object.entries(grouped).map(([month, items]) => (
              <div className="month-group" key={month}>
                <div className="month-label">{month}</div>
                <div className="file-list">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      className={`file-item ${selected?.id === item.id ? "active" : ""}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span className="file-title">{item.title}</span>
                      <span className="file-date">{item.date}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="content-panel">
        {selected ? (
          <>
            <div className="content-toolbar">
              <div>
                <p className="eyebrow">Documento</p>
                <h2>{selected.title}</h2>
                <p className="muted small">
                  {selected.date}
                  {selected.source ? ` • ${selected.source}` : ""}
                  {selected.tags?.length ? ` • ${selected.tags.join(", ")}` : ""}
                </p>
              </div>
            </div>

            <article
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: marked.parse(selectedContent) }}
            />
          </>
        ) : (
          <div className="blank-panel">
            <h2>Nenhum arquivo selecionado</h2>
            <p>Adicione itens ao índice para começar.</p>
          </div>
        )}
      </main>
    </div>
  );
}
