# Music Hub in React and TypeScript

A rebuild of Music Hub (`..\music-hub`, vanilla JavaScript) in React and TypeScript, done slice by slice. The current page stays the one to use
every day until this one matches it. The Python helper (`..\music-hub\server.py`) and `data.js` are not changed: this app reads the same data and
will call the same endpoints.

**Preview, still being built.** This is a rebuild of Music Hub in React and TypeScript, added one slice at a time. Each slice is a tagged commit
(`react-slice-1`, `react-slice-2`, ...), so the history shows how it grew. It is not a release: the page in `..\music-hub` is still the one to use.

## Status

| Slice | What | State |
|---|---|---|
| 1 | Data layer: types, loading `data.js`, search text, Feel scales, filters, sorting, formatters, with tests | done |
| 2 | The table, search box, filters and sorting on screen (windowed rows), iTunes and archive tabs | done |
| 3 | The Feel tabs: paired sliders with links, the graph and the cube | |
| 4 | The player, star rating, Save as playlist | |
| 5 | Presets, session, filter history, column menu, tooltips | |
| 6 | PWA, serving from the helper, public export, docs | |

## Run it

```
npm install            # once
npm test               # the tests (invented library only)
npm run typecheck      # TypeScript, strict
npm run build          # type check, then a production build in dist\
npm run dev            # the app at http://localhost:5173, reading ..\music-hub\data.js (read-only); needs no Python helper
```

`npm run dev` serves the `data.js` of the `music-hub` folder at `/data.js`. To try another library (for example an invented one), set
`$env:MUSICLAB_DATA_JS = "C:\path\to\data.js"` first. In slice 2 the app only reads: rating, playing and Save as playlist need the helper and come in slice 4.

What slice 2 does (the same as the current page, unless noted): search and filters on both tabs, sorting (first click direction per column), a click on an
artist, album or CD cell picks a chip (Ctrl-click keeps the other filters), a click on a path copies it, **Clear filters**, and a windowed table (only the rows
on screen are in the page, so 20,000 rows are fine). Not yet: Raw Feel, Feel Axes, the player, rating, presets, the column menu, tooltips, the history chip.

To check the data layer against your real library (read-only; it asserts no numbers, it compares each filter with a second, naive count from the raw rows):

```
$env:MUSICLAB_DATA_JS = "C:\path\to\music-lab\tools\music-hub\data.js"; npm test
```

## Where the old code went

| Current page (`index.html`) | Here |
|---|---|
| `fold`, `sp`, `jn`, `index`, the search terms | `src/data/text.ts` |
| `objs`, `build`, `FEELSTAT` | `src/data/load.ts` (`buildDataset`, `parseLibraryScript`) |
| `FEEL`, `feelOk`, the ten scales | `src/data/feel.ts` |
| `run()` (filters, playlist order, chips) and the sort | `src/data/filter.ts` (`filterSongs`, `filterArchive`, `sortRows`) |
| `fmt` | `src/data/format.ts` |
| the shape of `window.LIB` | `src/data/types.ts` |
| the decade, country and category menus | `src/data/options.ts` |
| `COLS`, `W`, `HIDE_BY_DEFAULT` and the cell text | `src/columns.ts` |
| the controls' values, `pickFacet`, `resetFilters`, the sort rule | `src/state/uiState.ts` (one reducer) |
| `render()` and the paging ("Show more") | `src/components/DataTable.tsx` (windowed rows) |
| the search row, chips and filter row | `src/components/SearchBar.tsx`, `FilterRow.tsx`, `Tabs.tsx` |
| the `data.js` script tag | `src/hooks/useLibrary.ts` |
| `flash()` | `src/hooks/useFlash.ts` |

## Rules for this folder

- The data layer (`src/data`) and the state (`src/state`) are plain functions with no React in them, so they can be tested without a browser. Components are
  thin: they show state and send actions. Component tests use Testing Library with jsdom (a file opts in with `// @vitest-environment jsdom`).
- Behavior matches the current page, quirks included, until the page is retired (for example a typed word matches anywhere inside the text, and rows
  with no score sort before rows with one). Change behavior in a separate commit, never while porting.
- Tests use the invented library in `src/data/fixture.ts`, never the real one.
