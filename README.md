# Favorites

Um vault pessoal em markdown, pronto para GitHub + Vercel.

## Rodando localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Estrutura

- `src/` contém a aplicação React
- `public/content/` contém os arquivos markdown e o índice

## Como adicionar novos conteúdos

1. Crie um `.md` dentro de `public/content/ANO/`
2. Adicione uma entrada em `public/content/index.json`
3. Faça commit e push
4. O Vercel publica automaticamente
