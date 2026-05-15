# Phase 3 Visual Reference Analysis

## Screen 1: Main Editor Dashboard

### Layout Structure
- Full-width top toolbar with branding, project title, action buttons
- Three-column layout below toolbar: left sidebar + center canvas + right inspector
- Bottom panel with tabs (Output, Validation, AI Suggestions, Playtest Logs)

### Navigation Areas
- Left primary nav: Project, Maps, Events, Database, Dialogue, Assets, AI Tools, Settings
- Tile Palette panel (collapsible categories: Terrain, Paths, Walls, Water, Objects, Events)
- Bottom-left user/creator avatar area

### Panel Hierarchy
1. Top toolbar (fixed, full-width)
2. Left sidebar (240px, two sections: nav + tile palette)
3. Center canvas (flex-1, map grid with zoom/coordinates)
4. Right inspector (280px, contextual properties)
5. Bottom panel (200px, tabbed output)

### Main Components
- Toolbar: logo, project dropdown, undo/redo, save status, Save/Playtest/Export/AI Assist buttons
- Tile palette: search, categorized tile grid thumbnails
- Map canvas: grid overlay, tile rendering, event markers, selection highlight, zoom controls, coordinate display
- Inspector: object name/icon, General section (Name, Position X/Y, Trigger, Solid, Flag, Commands list), Edit Event Page button
- Bottom panel: validation messages with icons, AI suggestion cards

### Typography
- Sans-serif (Inter or similar)
- Toolbar: 14px medium
- Sidebar nav: 14px regular
- Inspector labels: 12px medium gray
- Inspector values: 14px regular
- Bottom panel: 13px

### Spacing
- Toolbar height: ~48px
- Sidebar width: ~240px
- Inspector width: ~280px
- Bottom panel: ~200px
- Internal padding: 12-16px
- Section gaps: 16-24px

### Color/Accent Usage
- Background: #f8f9fa (light gray)
- Panels: #ffffff
- Borders: #e5e7eb (subtle gray)
- Primary accent: #6366f1 (indigo/violet)
- Active nav: indigo background pill
- Success: #22c55e (green)
- Warning: #f59e0b (amber)
- Buttons: white with border, primary filled indigo
- Export button: coral/red-orange filled

### Interaction Intent
- Click tile in palette → select for painting
- Click on map → place tile or select event
- Click event on map → populate inspector
- Edit inspector fields → update event data
- Save → persist project
- Playtest → switch to playtest screen

### Mandatory for Implementation
- Top toolbar with all buttons
- Left nav with all items
- Tile palette with categories
- Map canvas with grid and event markers
- Inspector with editable fields
- Bottom panel with validation tab
- AI suggestions cards

### Visual Polish Only
- Tile palette actual tile images (use colored placeholders)
- Map canvas actual tile rendering (use colored grid)
- Smooth animations/transitions

### Future Scope
- Real tile painting on canvas
- Undo/redo stack
- Multi-layer editing

---

## Screen 2: Event Editor / Event Inspector

### Layout Structure
- Top toolbar with breadcrumb navigation
- Three-column: left event list + center split (map preview + command stack) + right properties
- Bottom validation panel

### Navigation Areas
- Breadcrumb: Maps / Town / Events / OldMan_NPC
- Left event tree grouped by map
- Bottom tabs: Validation, Event Preview, Notes

### Panel Hierarchy
1. Top toolbar with breadcrumb
2. Left event list (200px, tree structure)
3. Center top: map preview (small, with event highlight)
4. Center bottom: command stack (numbered cards)
5. Right: Event Properties panel (280px)
6. Bottom: validation messages

### Main Components
- Event tree: maps as groups, events as items with icons and context menus
- Map preview: small map with highlighted selected event, tooltip showing type/trigger
- Command cards: numbered, icon + type + description, context menu dots
- Event Properties: Name, Type dropdown, Position X/Y, Trigger, Solid, Direction, Appearance, Dialogue text, AI Actions
- Add Command button, Add Event button
- Re-validate button

### Typography
- Same system as main editor
- Command card titles: 14px semibold
- Command descriptions: 13px regular gray
- Property labels: 12px medium

### Color/Accent Usage
- Same palette as main editor
- Command card icons: colored by type (blue=text, red=flag, green=item, purple=transfer)
- Selected event: indigo highlight in list
- Branch indicators: small colored pills

### Mandatory for Implementation
- Event list with map grouping
- Command stack with real event data
- Event properties panel
- Map preview with event highlight
- Validation panel
- Add Command functionality

### Future Scope
- Drag-reorder commands
- Visual branch editing
- Event preview playback

---

## Screen 3: AI Tools / Provider Connections

### Layout Structure
- Top toolbar with breadcrumb (Settings / AI Tools)
- Two-column: left settings nav + main content area + right routing panel
- Main content: provider cards grid + connection status

### Panel Hierarchy
1. Top toolbar
2. Left settings nav (200px, grouped sections)
3. Center: provider cards (2-3 column grid)
4. Right: Provider Routing + Usage & Safety (280px)
5. Bottom: Connection Status bar

### Main Components
- Settings nav: General, Project, Runtime Settings, Game Data, Editor Preferences, Shortcuts, AI Tools, Asset Generation, GitHub, Security, Audit Log
- Provider cards: logo, name, status badge, capabilities tags, model selector, API key field, Test button, last tested timestamp
- Provider Routing: dropdowns for Code/Dialogue/Image/Embeddings/Fallback
- Usage & Safety: budget input, toggles, security notes
- Connection Status: provider name + status + model info

### Color/Accent Usage
- Connected: green badge
- Not connected: red/orange badge
- Coming later: gray badge
- Capability tags: colored pills (blue, purple, green, orange)
- Cards: white with subtle border, slight shadow on hover

### Mandatory for Implementation
- Provider cards with status
- Model selectors
- API key masked fields
- Test Connection buttons (mock)
- Provider Routing panel
- Usage & Safety toggles
- Connection Status display

### Future Scope
- Real API connections
- Usage tracking
- Audit log

---

## Screen 4: Playtest / Preview Mode

### Layout Structure
- Top toolbar with playtest-specific actions
- Three-column: left controls + center game preview + right state inspector
- Bottom logs panel

### Panel Hierarchy
1. Top toolbar (Stop, Restart, Save/Load State, Open in Runtime, AI Debug Assist)
2. Left: Playtest Controls (180px)
3. Center: Game preview with overlay (FPS, map, position)
4. Right: Runtime State Inspector (280px)
5. Bottom: Logs panel with tabs

### Main Components
- Playtest Controls: directional pad visual, interact button, save/load shortcuts, restart/spawn buttons, tip card
- Game preview: rendered map scene, player, NPCs, dialogue box, debug overlay
- Runtime State Inspector: Current Map, Position, Direction, Flags list, Inventory list, Active Event
- Logs: timestamped entries with level badges (INFO, WARN, ERROR)
- AI Debug Assist: suggestion cards

### Color/Accent Usage
- Stop button: red
- Active/running indicator: green dot
- Log levels: blue=INFO, yellow=WARN, red=ERROR
- State values: monospace, right-aligned
- Flag values: colored badges (true=green, false=gray)

### Mandatory for Implementation
- Playtest controls panel
- Game preview area (simulated or canvas-based)
- Runtime state inspector with real data
- Logs panel
- AI Debug Assist cards
- Toolbar actions

### Future Scope
- Embedded native runtime
- Real-time state sync
- Breakpoints
- Step-through execution
