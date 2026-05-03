# PaperNow

Preprint literature management & collaboration platform for global researchers.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | UniApp + Vue3 (H5) | Cross-platform web application |
| Backend | Supabase | PostgreSQL, Auth, Storage, Edge Functions |
| Infrastructure | Cloudflare | Pages, DNS, CDN, R2 |
| CI/CD | GitHub Actions | Auto-deploy to Cloudflare Pages |

## Project Structure

```
papernow/
├── src/                          # Application source
│   ├── api/                      # Cloudflare Worker API
│   ├── assets/                   # Static assets (images, styles)
│   ├── components/               # Vue components
│   │   ├── common/               # Shared UI components
│   │   └── business/             # Domain-specific components
│   ├── composables/              # Vue composables (hooks)
│   ├── config/                   # App configuration
│   ├── layouts/                  # Page layouts
│   ├── pages/                    # Page components
│   │   ├── home/                 # Homepage
│   │   ├── search/               # Search page
│   │   ├── detail/               # Paper detail
│   │   ├── collection/           # User collection
│   │   ├── collaboration/        # Collaboration folders
│   │   ├── auth/                 # Login/Register
│   │   └── profile/              # User profile
│   ├── stores/                   # Pinia state stores
│   ├── types/                    # TypeScript type definitions
│   ├── utils/                    # Utility functions
│   ├── App.vue                   # Root component
│   ├── main.ts                   # Entry point
│   ├── manifest.json             # UniApp manifest
│   └── pages.json                # Page routing config
├── database/
│   ├── migrations/               # SQL migration scripts
│   └── seeds/                    # Seed data
├── supabase/
│   ├── config.toml               # Supabase project config
│   └── functions/                # Edge Functions
├── public/                       # Static public files
│   ├── _redirects                # Cloudflare Pages SPA redirect
│   ├── _headers                  # Security headers
│   ├── index.html                # HTML entry
│   └── robots.txt                # SEO
├── tests/                        # Test files
│   ├── unit/                     # Unit tests
│   └── e2e/                      # E2E tests
├── docs/                         # Documentation
├── .codeartsdoer/                # SDD specification docs
├── .github/workflows/            # CI/CD pipelines
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── wrangler.toml                 # Cloudflare Worker config
└── eslint.config.js
```

## Getting Started

### Prerequisites

- Node.js >= 20
- npm >= 10

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Deploy

```bash
npm run deploy:all
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `VITE_APP_TITLE` | Application title | No |
| `VITE_APP_DOMAIN` | Application domain | No |

## License

Private
