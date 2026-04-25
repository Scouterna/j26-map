# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Dev server at http://localhost:5173/
pnpm build        # Production build with prerendering → dist/
pnpm preview      # Preview build at http://localhost:4173/
pnpm update-ui    # Update @scouterna/* design system packages
```

Linting and formatting are handled by Biome (no separate lint command — Biome runs on save via IDE or `biome check`).

## Architecture

This is a **Jamboree 26 interactive map** built with Preact + TypeScript + Leaflet, bundled by Vite.

### Three entry points

| Entry | Route | Purpose |
|-------|-------|---------|
| `src/map/main.tsx` | `/_services/map` | Main interactive map with search UI |
| `src/preview/main.tsx` | `/preview.html` | Static single-location preview (lat/lng/icon as query params) |
| `src/picker/main.tsx` | `/picker.html` | Coordinate picker tool |

The app is deployed behind a reverse proxy at base path `/_services/map`.

### Map rendering stack

`MapCanvas.tsx` is the central Leaflet wrapper — it creates the map instance, exposes it via `useMap()` context, and runs a RAF loop that tracks animated zoom into a CSS variable `--map-zoom-anim`. All child components access the map through this context.

`BaseLayers.tsx` composes all GeoJSON background layers (outline, forest, villages, districts, roads, tents) into one component mounted inside `MapCanvas`.

`GeoJsonLayer.tsx` is the generic layer primitive. Key features:
- **Zoom-scaled weights:** `geoScale` option scales stroke widths with 2^(zoom − baseZoom)
- **Attribute-driven styles:** `colorAttribute`, `weightAttribute`, etc. read values from GeoJSON feature properties
- **SVG pattern fills:** `patternDef` injects an SVG `<pattern>` element into the DOM
- **Canvas vs SVG:** Canvas renderer used for performance-heavy layers (tents); SVG with padding for crisp vector layers

`MapPane.tsx` wraps Leaflet's custom pane API to control z-ordering and CSS-based show/hide at zoom thresholds — no JS re-renders, pure CSS `opacity: clamp(...)`.

### Location markers

`locationService.ts` fetches `public/locations.json` and transforms it to `Location[]`. `LocationsLayer.tsx` creates Leaflet markers from these, using `marker.tsx` which builds a custom `DivIcon` with an SVG pin shape + Tabler icon overlay. Icons are fetched on-demand from the unpkg Tabler CDN (not bundled).

### Cross-frame communication

The map runs in an iframe inside a parent Scouterna app shell. `use-app-bar-title.ts` uses `window.parent.postMessage()` to set the parent app bar's title and action buttons.

### Static data

- `public/locations.json` — POI markers (id, slug, name, lat, lng, icon, color)
- `public/layers/*.geojson` — Map layers; roads.geojson is drawn as centerlines (see project memory)

### Map bounds

Locked to the jamboree area `[55.971, 14.115]–[55.992, 14.157]`, center `[55.98071, 14.13704]`, zoom 16, range 14–19.
