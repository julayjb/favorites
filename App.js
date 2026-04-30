import React, { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import "./styles.css";

const fallbackIndex = [
  {
    slug: "2026-04-10-newsletter-ia",
    title: "Newsletter: IA aplicada no dia a dia",
    date: "2026-04-10",
    source: "Newsletter",
    tags: ["ia", "produtividade"],
    path: "/content/2026/2026-04-10-newsletter-ia.md"
  },
  {
    slug: "2026-03-28-post-produto",
    title: "Post: Como pensar produto com clareza",
    date: "2026-03-28",
    source: "Blog",
    tags: ["produto", "clareza"],
    path: "/content/2026/2026-03-28-post-produto.md"
  }
];

const fallbackDocs = {
  "/content/2026/2026-04-10-newsletter-ia.md": `# Newsletter: IA aplicada no dia a dia

## Resumo

Algumas ideias práticas para usar IA em fluxos pessoais:

- resumir leituras
- criar checklists
- organizar notas por tema
- comparar versões de textos

> Dica: manter um repositório pessoal de referências em markdown facilita muito a busca futura.

## Próximos passos

1. Criar tags consistentes
2. Definir uma rotina de revisão semanal
3. Separar notas permanentes de notas temporárias
`,
  "/content/2026/2026-03-28-post-produto.md": `# Como pensar produto com clareza

Um bom processo começa com perguntas simples:

- Qual problema existe?
- Para quem?
- Como medimos se melhorou?

## Estrutura útil

### Contexto
Descreva o cenário atual.

### Hipótese
Explique o que você acredita que vai funcionar.

### Evidência
Liste sinais reais, mesmo que pequenos.
`
};

marked.setOptions({ breaks: true, gfm: true });

function groupByMonth(items) {
  return items.reduce((acc, item) => {
    const key = item.date?.slice(0, 7) || "Sem data";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function sortByDateDesc(items) {
  return [...items].sort((a, b) => (a.date < b.date ? 1 : -1));
}

async function loadIndex() {
  try {
    const response = await fetch("/content/index.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Falha ao carregar índice");
    return await response.json();
  } catch {
    return fallbackIndex;
  }
}

async function loadMarkdown(path) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error("Falha ao carregar markdown");
    return await response.text();
  } catch {
    return fallbackDocs[path] || "# Documento não encontrado\n\nVerifique se o arquivo existe em `/content/`.";
  }
}

export default function App() {
  const [docs, setDocs] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [selectedContent, setSelectedContent] = useState("");
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("all");
  const [status, setStatus] = useState("Carregando sua biblioteca...");

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const index = sortByDateDesc(await loadIndex());
      if (!active) return;

      setDocs(index);
      setSelectedSlug(index[0]?.slug || "");
      setStatus(index.length ? "Biblioteca pronta." : "Nenhum documento encontrado em /content.");
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const tags = useMemo(() => {
    const tagSet = new Set();
    docs.forEach((doc) => (doc.tags || []).forEach((tag) => tagSet.add(tag)));
    return ["all", ...Array.from(tagSet).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [docs]);

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();

    return docs.filter((doc) => {
      const matchesQuery =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.source?.toLowerCase().includes(q) ||
        (doc.tags || []).some((tag) => tag.toLowerCase().includes(q));

      const matchesTag = activeTag === "all" || (doc.tags || []).includes(activeTag);

      return matchesQuery && matchesTag;
    });
  }, [activeTag, docs, query]);

  const groupedDocs = useMemo(() => groupByMonth(filteredDocs), [filteredDocs]);
  const selectedDoc = docs.find((doc) => doc.slug === selectedSlug) || filteredDocs[0] || null;

  useEffect(() => {
    let active = true;

    async function fetchSelected() {
      if (!selectedDoc?.path) {
        setSelectedContent("");
        return;
      }

      const content = await loadMarkdown(selectedDoc.path);
      if (!active) return;
      setSelectedContent(content);
    }

    fetchSelected();
    return () => {
      active = false;
    };
  }, [selectedDoc]);

  useEffect(() => {
    if (!selectedSlug && filteredDocs[0]?.slug) {
      setSelectedSlug(filteredDocs[0].slug);
      return;
    }

    if (selectedSlug && !filteredDocs.some((doc) => doc.slug === selectedSlug)) {
      setSelectedSlug(filteredDocs[0]?.slug || "");
    }
  }, [filteredDocs, selectedSlug]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="panel brand-panel">
          <p className="eyebrow">Markdown Vault</p>
          <h1>Seu Obsidian pessoal no GitHub</h1>
          <p className="muted">
            Estrutura pronta para repo + deploy grátis. Basta adicionar seus arquivos em <code>/content</code>.
          </p>
        </div>

        <div className="panel helper-panel">
          <h2>Fluxo simples</h2>
          <ol>
            <li>Suba seus arquivos <code>.md</code> para a pasta <code>content/ano/</code>.</li>
            <li>Atualize o <code>content/index.json</code>.</li>
            <li>Faça push no GitHub.</li>
            <li>Vercel publica automaticamente.</li>
          </ol>
        </div>

        <div className="panel controls-panel">
          <input
            className="search-input"
            type="search"
            placeholder="Buscar por título, fonte ou tag..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="tag-row">
            {tags.map((tag) => (
              <button
                key={tag}
                className={`tag-chip ${activeTag === tag ? "active" : ""}`}
                onClick={() => setActiveTag(tag)}
              >
                {tag === "all" ? "todas" : tag}
              </button>
            ))}
          </div>

          <p className="muted small">{status}</p>
        </div>

        <div className="doc-list">
          {filteredDocs.length === 0 ? (
            <div className="panel empty-panel">
              <p>Nenhum documento encontrado com esse filtro.</p>
            </div>
          ) : (
            Object.entries(groupedDocs).map(([month, monthDocs]) => (
              <section key={month} className="month-group">
                <p className="month-label">{month}</p>
                <div className="month-items">
                  {monthDocs.map((doc) => (
                    <button
                      key={doc.slug}
                      className={`doc-item ${selectedDoc?.slug === doc.slug ? "active" : ""}`}
                      onClick={() => setSelectedSlug(doc.slug)}
                    >
                      <span className="doc-title">{doc.title}</span>
                      <span className="doc-meta">{doc.date} • {doc.source || "Sem fonte"}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </aside>

      <main className="content-area">
        {selectedDoc ? (
          <>
            <div className="panel content-header">
              <div>
                <p className="eyebrow">Documento</p>
                <h2>{selectedDoc.title}</h2>
                <p className="muted metadata-line">
                  {selectedDoc.date} • {selectedDoc.source || "Sem fonte"} • {selectedDoc.path}
                </p>
              </div>

              <div className="header-actions">
                {(selectedDoc.tags || []).map((tag) => (
                  <span className="tag-pill" key={tag}>{tag}</span>
                ))}
              </div>
            </div>

            <article
              className="panel markdown-body"
              dangerouslySetInnerHTML={{ __html: marked.parse(selectedContent || "# Carregando...") }}
            />
          </>
        ) : (
          <div className="panel empty-main">
            <h2>Adicione arquivos em /content para começar</h2>
            <p className="muted">
              Este projeto já está estruturado para virar um repositório no GitHub e ser publicado no Vercel.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
