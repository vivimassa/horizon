# Horizon - Project Guide

## Tech Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Database & Auth**: Supabase
- **Package Manager**: npm

## Project Structure

```
horizon/
├── app/                    # Next.js App Router pages and layouts
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and configurations
│   ├── supabase/        # Supabase client configurations
│   │   ├── client.ts    # Browser client
│   │   ├── server.ts    # Server client
│   │   └── middleware.ts # Auth middleware helper
│   └── utils.ts         # General utilities
├── types/               # TypeScript type definitions
│   └── database.ts      # Supabase database types
├── middleware.ts        # Next.js middleware for auth
└── .env.local          # Environment variables (not in git)
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Development Workflow

### Getting Started
```bash
npm install
npm run dev
```

### Adding shadcn/ui Components
```bash
npx shadcn@latest add [component-name]
```

### Generating Database Types
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

## Coding Conventions

### File Naming
- Components: PascalCase (e.g., `UserProfile.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Types: PascalCase (e.g., `Database.ts`)

### Component Structure
- Use Server Components by default
- Add `'use client'` only when needed (interactivity, hooks, etc.)
- Keep components small and focused

### Supabase Usage
- **Client Components**: Use `createClient()` from `@/lib/supabase/client`
- **Server Components**: Use `createClient()` from `@/lib/supabase/server`
- **Middleware**: Already configured for auth session management

## Next Steps

1. Set up Supabase project and update `.env.local`
2. Design database schema in Supabase
3. Generate TypeScript types from schema
4. Build authentication flow
5. Implement core features

## Notes

- This is a foundation setup - no features implemented yet
- All dependencies are installed and configured
- Ready for feature development
