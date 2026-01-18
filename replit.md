# Replit.md

## Overview

This is a city voting leaderboard application that displays ranked cities with their vote counts. The application features an animated, visually engaging leaderboard interface with real-time data fetching capabilities. It follows a full-stack TypeScript architecture with a React frontend and Express backend.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state management
- **Styling**: Tailwind CSS with CSS variables for theming (supports light/dark modes)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Animations**: Framer Motion for page animations and transitions
- **Build Tool**: Vite with React plugin and path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **HTTP Server**: Node.js native http.createServer wrapping Express
- **API Pattern**: RESTful endpoints under /api prefix
- **Logging**: Custom request logging with timing information
- **Development**: Vite dev server integration with HMR support

### Data Layer
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema Validation**: Zod with drizzle-zod integration
- **Database Migrations**: Drizzle Kit (migrations stored in /migrations)
- **Storage Abstraction**: IStorage interface with MemStorage implementation (in-memory fallback)

### Project Structure
```
├── client/           # Frontend React application
│   └── src/
│       ├── components/ui/  # shadcn/ui components
│       ├── hooks/          # Custom React hooks
│       ├── lib/            # Utilities and query client
│       └── pages/          # Page components
├── server/           # Backend Express application
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data storage abstraction
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared types and schemas
│   └── schema.ts     # Zod schemas and TypeScript types
└── script/           # Build scripts
    └── build.ts      # Production build script
```

### Build System
- **Development**: `tsx server/index.ts` with Vite middleware
- **Production Build**: Custom esbuild script that bundles server with selective dependency bundling, Vite builds client to dist/public
- **Output**: Server bundle at dist/index.cjs, static files at dist/public

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires DATABASE_URL environment variable)
- **connect-pg-simple**: Session storage for PostgreSQL

### UI Framework Dependencies
- **Radix UI**: Complete primitive component set (dialog, dropdown, tabs, etc.)
- **Lucide React**: Icon library
- **embla-carousel-react**: Carousel functionality
- **react-day-picker**: Date picker component
- **recharts**: Charting library
- **vaul**: Drawer component

### Development Tools
- **@replit/vite-plugin-runtime-error-modal**: Error overlay for development
- **@replit/vite-plugin-cartographer**: Replit-specific tooling
- **@replit/vite-plugin-dev-banner**: Development banner

### Form & Validation
- **react-hook-form**: Form state management
- **@hookform/resolvers**: Zod resolver for form validation
- **zod**: Schema validation
- **zod-validation-error**: Human-readable validation errors