# Know Your Woman Cycle

A relationship wellness application that helps partners understand and support each other through menstrual cycle phases. Built with Next.js, Supabase, and TypeScript.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **Styling**: Tailwind CSS + shadcn/ui
- **Email**: Resend
- **Testing**: Vitest + fast-check (property-based testing)
- **Validation**: Zod
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local development and migrations)
- A Supabase project (free tier works for development)
- A Resend account (for email notifications)

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repository-url>
cd kiro-project2
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file and fill in your values:

```bash
cp .env.local.example .env.local
```

See [Environment Variables](#environment-variables) below for details on each variable.

### 4. Set up the database

```bash
# Start local Supabase (optional, for local development)
supabase start

# Apply migrations
supabase db push
```

### 5. Start the development server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Architecture Overview

```
src/
├── app/                    # Next.js App Router (routes, layouts, pages)
│   ├── api/                # API route handlers (thin layer, delegates to services)
│   ├── auth/               # Auth pages (login, register, invite)
│   ├── dashboard/          # Primary user dashboard pages
│   ├── partner/            # Partner user dashboard pages
│   ├── admin/              # Admin panel pages
│   └── onboarding/         # Onboarding survey flow
├── components/             # Reusable React components
│   ├── ui/                 # shadcn/ui primitives
│   ├── forms/              # Form components (date picker, toggles, survey)
│   ├── dashboard/          # Dashboard-specific components
│   └── layout/             # Layout components (nav, sidebar, responsive shell)
├── services/               # Business logic (framework-agnostic)
│   ├── cycle-service.ts    # Cycle CRUD and validation
│   ├── phase-engine.ts     # Phase calculation algorithm
│   ├── insights-service.ts # Insights generation
│   ├── guidance-service.ts # Partner guidance content
│   ├── notification-service.ts # Email notifications
│   ├── sharing-service.ts  # Partner sharing controls
│   ├── survey-service.ts   # Onboarding survey logic
│   └── admin-service.ts    # Admin operations
├── lib/                    # Shared utilities and configuration
│   ├── supabase/           # Supabase client setup (server/client/middleware)
│   ├── validation/         # Zod schemas and validation functions
│   ├── constants.ts        # Shared constants (phase durations, limits)
│   ├── types.ts            # Shared TypeScript interfaces and enums
│   └── utils.ts            # General utility functions
├── hooks/                  # Custom React hooks
├── test/                   # Test setup and utilities
└── middleware.ts           # Edge Middleware (auth, role routing)
```

### Architecture Principles

1. **Services are framework-agnostic** — Business logic lives in `services/` as pure TypeScript with no dependency on Next.js or React.
2. **API routes are thin** — Route handlers validate input (Zod), call services, and format responses. No business logic in route files.
3. **Components are presentational** — React components receive data via props or hooks. Data fetching happens in server components or dedicated hooks.
4. **Explicit over implicit** — Service dependencies are passed explicitly. Data transformations are traceable.
5. **Single Responsibility** — Each file has one purpose. Services handle one domain.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint checks |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | Yes |
| `RESEND_API_KEY` | Resend API key for email delivery | Yes |
| `RESEND_FROM_EMAIL` | Sender email address for notifications | Yes |
| `NEXT_PUBLIC_APP_URL` | Public application URL | Yes |
| `CRON_SECRET` | Secret for authenticating cron job requests | Yes |

## Development Workflows

### Adding a new feature

1. Create or update service logic in `src/services/`
2. Add Zod validation schemas in `src/lib/validation/`
3. Create API route handler in `src/app/api/`
4. Build UI components in `src/components/`
5. Write tests (unit + property-based) alongside the code

### Running tests

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Run with coverage report (80% minimum for services/ and lib/)
npm run test:coverage
```

### Code quality

Pre-commit hooks automatically run ESLint and Prettier on staged files via Husky + lint-staged.

```bash
# Manual lint check
npm run lint

# Manual format check
npm run format:check

# Auto-fix lint issues
npm run lint:fix

# Auto-format code
npm run format
```

### Database migrations

```bash
# Create a new migration
supabase migration new <migration-name>

# Apply migrations locally
supabase db push

# Reset local database
supabase db reset
```

## Code Quality Standards

- **TypeScript strict mode** enabled — no implicit any, strict null checks
- **ESLint** with `@typescript-eslint/strict` and Next.js recommended rules
- **Prettier** for consistent formatting (2-space indent, single quotes, trailing commas, 100 char width)
- **Import ordering** enforced: external → internal (`@/`) → relative
- **Test coverage** minimum 80% for `services/` and `lib/` directories
- **No `any`** in production code — use proper types or `unknown`
