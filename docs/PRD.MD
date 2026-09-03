# PRD — Google Maps Business Scraper
Version: MVP v1.0
Platform: Desktop Windows
Product Type: Source Code / Digital Product

## 1. Overview
Aplikasi desktop untuk mencari dan mengumpulkan informasi bisnis dari Google Maps berdasarkan keyword dan lokasi.

Contoh:
Keyword  : Coffee Shop
Location : Surabaya
Limit    : 100

Hasil dapat dilihat di aplikasi dan diekspor ke CSV/XLSX.

## 2. Target User
- Digital marketer
- Sales / lead generation
- Freelancer
- Agency
- Business researcher
- Developer

## 3. Tech Stack

Frontend:
- Electron
- React
- TypeScript
- Tailwind CSS

Scraping Engine:
- Node.js
- Playwright

Storage:
- SQLite

Export:
- CSV
- XLSX

Packaging:
- Electron Builder
- Windows .exe

## 4. Core Features

### A. Scraper
Input:
- Keyword bisnis
- Lokasi
- Maksimal hasil

Action:
- Start
- Pause
- Stop

Data:
- Business Name
- Category
- Address
- Phone
- Website
- Rating
- Review Count
- Google Maps URL
- Latitude
- Longitude

### B. Results
- Tabel hasil secara real-time
- Search
- Filter
- Sorting
- Select/delete data
- Deduplication
- Detail bisnis

### C. Export
Format:
- CSV
- XLSX

Pilihan:
- Export semua
- Export data terpilih

### D. History
Setiap proses scraping disimpan.

Data:
- Keyword
- Location
- Date
- Total results
- Status

User dapat membuka kembali hasil scraping sebelumnya.

## 5. UI

Sidebar:
- Dashboard
- New Scrape
- Results
- History
- Settings

New Scrape:

Keyword
[ Coffee Shop             ]

Location
[ Surabaya                ]

Max Results
[ 100                     ]

[ Start Scraping ]

Progress
████████████░░░ 72/100

Results:
| Business | Category | Rating | Phone | Website |

[ Export CSV ] [ Export XLSX ]

## 6. Settings

Browser:
- Headless ON/OFF
- Scraping delay
- Timeout

Data:
- Auto deduplicate
- Auto save

Application:
- Export directory
- Clear history

## 7. Application Architecture

Electron
│
├── React UI
│
├── IPC
│
├── Scraping Engine
│   └── Playwright
│       └── Chromium
│
├── Data Processing
│   ├── Parser
│   ├── Deduplication
│   └── Validation
│
├── SQLite
│
└── Export
    ├── CSV
    └── XLSX

## 8. MVP Flow

Open App
   ↓
Enter Keyword + Location
   ↓
Start Scraping
   ↓
Launch Chromium
   ↓
Search Google Maps
   ↓
Collect Business Data
   ↓
Display Results
   ↓
Save to SQLite
   ↓
Export CSV/XLSX

## 9. MVP Scope

Included:
- Single keyword scraping
- Location search
- Result limit
- Business data extraction
- Real-time progress
- SQLite history
- Deduplication
- CSV/XLSX export

Not Included in v1:
- Cloud sync
- User account
- Proxy manager
- Team collaboration
- AI lead scoring
- Multi-device sync

## 10. Future Features

v1.1
- Multi-keyword scraping
- Multi-location
- Advanced filters
- Resume interrupted scraping

v1.2
- Proxy support
- Website/email enrichment
- Lead tagging
- Notes

v2.0
- Lead management/mini CRM
- AI lead scoring
- Analytics
- Optional licensing system

## 11. Product Goal

Membuat Google Maps Business Scraper yang:
- Mudah digunakan non-programmer
- Cepat dan sederhana
- Memiliki UI modern
- Menghasilkan dataset bisnis yang rapi
- Bisa dijadikan portfolio
- Bisa dijual sebagai source code/digital product