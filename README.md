# RetailTag Pro — Barcode Label Printer

A complete retail inventory & barcode label printer application.
Built with Node.js + Express + SQLite. Works offline. No cloud needed.

## Features

- 12 built-in categories: Mobiles, TV, Refrigerators, AC, Washing Machines,
  Kitchen Appliances, Furniture, Laptops, Audio, Cameras, Mobile Accessories
- Add unlimited products with brand, model, color, size, MRP, GST, HSN code
- Auto-generates EAN-13 barcodes and SKU codes
- Barcode image generation (CODE128 / EAN-13) via bwip-js
- Print queue: add multiple products, set quantities per product
- Label size options: Small / Medium / Large
- 2 / 3 / 4 labels per row layout
- Toggle MRP and GST display on labels
- Print-ready output (browser Print → works with label printers)
- Print job history with label count tracking
- Dashboard with category-wise product breakdown
- Search, filter by category, paginated product list
- Full CRUD: Add / Edit / Delete products
- Persistent SQLite database (data/retail.db)
- 10 sample products pre-loaded

## Setup

### Requirements
- Node.js 18 or higher (https://nodejs.org)

### Install & Run

1. Unzip the folder
2. Open terminal in the folder
3. Run:

   npm install
   npm start

4. Open browser: http://localhost:3000

### Development mode (auto-restart on changes)
   npm run dev

## Printing Labels

1. Go to Products page → click 🖨 on any product
2. Go to Print Labels page
3. Set quantity for each product
4. Choose label size and columns
5. Click "Generate Preview"
6. Click "Print Now" or use Ctrl+P / Cmd+P

## For Thermal Label Printers (Zebra, Godex, TSC)

- Set paper size in printer driver to match your labels (50x25mm, 75x40mm, etc.)
- In browser print dialog: set margins to None/Minimum
- Disable "Headers and footers"
- Choose correct printer

## File Structure

retail-barcode-app/
├── server.js          — Express server + API routes + barcode gen
├── package.json
├── data/
│   └── retail.db      — SQLite database (auto-created)
└── public/
    ├── index.html     — Main SPA
    ├── css/style.css
    └── js/app.js

## API Endpoints

GET    /api/products          — List products (search, category, page, limit)
GET    /api/products/:id      — Single product
POST   /api/products          — Create product
PUT    /api/products/:id      — Update product
DELETE /api/products/:id      — Delete product
GET    /api/categories        — List categories
GET    /api/barcode/:code     — Barcode PNG image
POST   /api/print-jobs        — Save print job
GET    /api/stats             — Dashboard stats
