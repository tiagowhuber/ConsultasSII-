# ConsultasSII — Libro de Compras

Web app for consulting and managing purchase invoices (DTEs) from Chile's SII. Built with Vue 3 + TypeScript, deployed to Netlify.

## Features

- Fetch purchase book data from SII by month/year
- Sortable, filterable table with global search and configurable columns
- Annotate invoices: mark as accounted/paid, set payment method, add comments
- Export to Excel or download official PDFs per invoice (client-side fallback via jsPDF)
- Real-time browser notifications via WebSocket when new records arrive

## Tech stack

Vue 3 · TypeScript · Vite · Pinia · Vue Router · Axios · Socket.IO · jsPDF · SheetJS · Netlify

## Getting started

```bash
npm install
cp .env.example .env   # set VITE_API_BASE_URL
npm run dev
```

## Backend

The backend is a Node.js/Express API that authenticates with SII using a PFX digital certificate, fetches and stores DTE data in a PostgreSQL database, and serves it to this frontend. It also handles real-time WebSocket events and scheduled data pulls. Hosted on Render.
