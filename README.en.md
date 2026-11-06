<div align="center">
  <h1>acgn_journey</h1>

  <p><a href="./README.md">简体中文</a> | <strong>English</strong></p>

  <p><strong>Keep a journey through the anime, comics, games, and novels you have enjoyed.</strong></p>

  <p>
    A local-first personal media library with title search, list and grid views,
    <br>
    activity statistics, physical collection tracking, and privacy-conscious AI taste profiles.
  </p>

  <p>
    <img src="https://img.shields.io/badge/version-v0.9.0-4165b0?style=flat-square" alt="Current version v0.9.0">
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-2f81f7?style=flat-square" alt="MIT License"></a>
    <img src="https://img.shields.io/badge/desktop-Electron_38-47848f?style=flat-square" alt="Electron 38">
    <a href="https://github.com/ChibaRie/acgn_journey/actions/workflows/deploy.yml"><img src="https://github.com/ChibaRie/acgn_journey/actions/workflows/deploy.yml/badge.svg" alt="Deployment status"></a>
  </p>

  <p>
    <a href="https://chibarie.github.io/acgn_journey/"><strong>Live Demo</strong></a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="#running-locally"><strong>Run on Desktop</strong></a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="#features"><strong>Features</strong></a>
  </p>
</div>

> [!IMPORTANT]
> The GitHub Pages demo is a static site that uses browser LocalStorage as its storage fallback. For long-term use, run the desktop app to keep your library, settings, and LLM configuration on your own device.

---

## Running Locally

Start the desktop app with the following commands.

```powershell
npm install
npm run desktop:start
```

The launcher starts these components.

- An Electron desktop window.
- A local frontend runtime at `http://127.0.0.1:5188`, serving the production build from `dist`.
- A local SQLite data service at `http://127.0.0.1:5198`.

Closing the desktop window also stops the local services started by `desktop:start`. The default database locations are listed below.

- Windows uses `%APPDATA%\acgn_journey\acgn_journey.sqlite`.
- macOS uses `~/Library/Application Support/acgn_journey/acgn_journey.sqlite`.
- Linux uses `$XDG_DATA_HOME/acgn_journey/acgn_journey.sqlite`, falling back to `~/.local/share/acgn_journey/acgn_journey.sqlite`.

You can override the data directory.

```powershell
$env:ACGN_DATA_DIR="D:\acgn_journey_data"
npm run desktop:start
```

For browser-based development, run the following command.

```powershell
npm run app
```

Common commands are listed below.

- `npm run desktop:start` starts the desktop app.
- `npm run app` toggles browser development mode on or off.
- `npm run app:start` starts the local data service and Vite, then opens the browser.
- `npm run app:stop` stops this project's development server and local data service.
- `npm run app:restart` restarts the local data service and development server.
- `npm run app:status` shows the current service status.
- `npm run dev` starts Vite alone, with logs in the foreground.

## Live Demo

Try the [online demo](https://chibarie.github.io/acgn_journey/).

The static site cannot start local application processes on your device. When the local SQLite service is unavailable, it falls back to browser LocalStorage. Clearing browser data can therefore erase records stored by the demo. Use desktop mode for long-term use.

## Project Structure

```text
acgn_journey/
  .github/workflows/  # Automatic GitHub Pages deployment
  docs/              # Local architecture, plans, and validation records, ignored by Git
  electron/          # Electron window entry point
  public/            # Static assets copied to dist during builds
  scripts/           # Desktop and development launchers, plus offline tools
  server/            # Local SQLite / LLM data service and tests
  src/               # React frontend with colocated tests
  worker/            # Optional Cloudflare search proxy and tests
  .runtime/          # Local logs and PID files, ignored by Git
```

`dist/` contains build output, and `node_modules/` contains installed dependencies. The runtime authentication token is stored in `.local-api-token.local` at the project root and is ignored by Git.

## Tech Stack

| Layer | Technology | Details |
| --- | --- | --- |
| Desktop shell | Electron 38 | Local window loading the local application runtime |
| Frontend | React 19 + React DOM | Function components and Hooks |
| Build tooling | Vite 7 + `@vitejs/plugin-react` | Native ESM, fast HMR, and development server proxy |
| Icons | lucide-react | Lightweight and tree-shakable |
| Styling | Plain CSS + CSS variables | Light and dark themes through `data-theme` |
| State and persistence | `useLibrary` Hook + local SQLite / browser fallback | Local disk persistence with a browser fallback for the demo |
| Local data service | Node 24 + `node:sqlite` | SQLite file stored in the user's data directory |
| Automated testing | Vitest + React Testing Library | Statistics, Hook lifecycles, concurrent saves, imports, and launchers |
| Data sources | AGE Anime, Moegirlpedia, MangaBaka, Bangumi, and trace.moe | Title search and screenshot recognition |
| Online deployment | GitHub Pages + GitHub Actions | Hosted demo |

## Features

- **Library overview.** The home dashboard shows title counts, completion rate, personal average rating, covers of titles in progress, media distribution, completion trends, a 26-week completion calendar, and tag preferences. Charts link to library filters.
- **Year in review and backlog draw.** Review yearly activity using actual completion dates, or randomly pick your next title from the backlog for the selected media category.
- **Bright collection interface.** A light, cover-first layout with top navigation, a dark theme, an animation toggle, reduced-motion support, and a fullscreen dashboard.
- **Single-source title search.** Search AGE Anime and Moegirlpedia directly, MangaBaka directly from the browser for light novels, or Bangumi through a proxy with fallback support. Each search displays up to 24 results.
- **trace.moe screenshot recognition.** Upload a screenshot or paste an image URL to find the anime title, episode, timestamp, and similarity score, then add the result to your library.
- **Library management.** Switch between list and grid views, with your preference remembered. Browse 48 titles per page. Edit titles, media types, release years, statuses, dates, ratings, short reviews, and tags. Bulk selection and actions cover the complete filtered result set.
- **Library categories.** Filter by visual novels, light novels, anime, manga, other media, and release year.
- **Personal timeline.** Browse records grouped by year, with filters for year, media type, and status.
- **Detailed statistics.** Explore total and completed title counts, average rating, a tag word cloud, and distributions by media type, release year, record year, status, and rating.
- **Experimental AI taste profiles.** In desktop mode, configure an OpenAI-compatible LLM, fetch available models, test connectivity, and clear the configuration. Generate structured taste profiles from locally aggregated summaries. The online demo provides prompt preview and copying.
- **Data persistence.** Local SQLite uses revision checks and serialized saves. The browser keeps versioned copies per window and supports historical `acgn_journey:records:v1` data. During migration into an empty database or a version conflict, you can select, export, and restore a copy.
- **Exports and backups.** Export JSON, XML, or CSV backups from settings. Import a JSON backup to restore the library by replacement.
- **Custom backgrounds.** Import a local image as the global background and adjust its opacity and blur. Backgrounds are saved to local SQLite when available.
- **Physical collection tracking.** Record purchase price, seller or channel, storage location, limited-edition details, opened status, purchase date, and notes.
- **Bulk import.** Import this project's JSON backups, data from Bangumi, MyAnimeList, AniList, or VNDB, and generic CSV files. MyAnimeList XML is also supported.
- **Optional offline word cloud.** Generate a standalone interactive word cloud HTML file from an exported JSON backup using `scripts/tag_wordcloud.py`.

## Offline Word Cloud

```powershell
pip install pyecharts
python scripts/tag_wordcloud.py path\to\backup.json -o tag-wordcloud.html
```

Export a JSON backup from settings, then run these commands to generate a standalone interactive tag word cloud. If `pyecharts` is unavailable, the script generates a static HTML fallback.

## Changelog

### v0.9.0

- Redesigned all collection pages with 16px body text, supporting text of at least 14px, themes, motion controls, and native modal keyboard behavior.
- Added a dashboard based on library data, a year-in-review view, a backlog draw, and chart-linked filtering. Existing distributions remain available through detailed statistics.
- Fixed edits being overwritten during initialization, concurrent snapshot overwrites, storage quota errors, protocol and authentication checks when reusing services, and copy recovery races.
- Fixed media classification, tag counts, stale import and search results, AI response handling, and configuration initialization.
- Added lazy-loaded pages, library pagination, and page-specific statistics calculation. Validation uses isolated SQLite databases and synthetic data.

### v0.8

- **Experimental AI taste profiles.** Added a desktop-first AI profile view. By default, requests include aggregate statistics and a small selection of representative titles. Full library contents, short reviews, and synopses stay outside the request.
- **LLM configuration.** Added model listing for OpenAI-compatible services, connectivity tests, and one-click configuration clearing. The default temperature is `0.8`, and prompt preview starts collapsed.
- **More search results.** Increased the text search limit from 12 to 24 results across AGE Anime, Moegirlpedia, MangaBaka, and Bangumi.
- **Privacy and online behavior.** Desktop mode can call the local LLM proxy. GitHub Pages provides prompt preview and copying, with API-key-based calls available through desktop mode.
- **Version alignment.** Updated package and exported backup versions to `0.8.0`.

### v0.7.7

- **MangaBaka light novel source.** Added searches by Chinese, Japanese, and English titles, returning covers and structured light novel metadata.
- **Direct browser access.** The MangaBaka API supports CORS, so the frontend accesses the official API directly.
- **Sources and terms.** Updated title search sources to AGE Anime, Moegirlpedia, MangaBaka, and Bangumi. MangaBaka data is used with attribution for non-commercial purposes.
- **Version alignment.** Updated package and exported backup versions to `0.7.7`.

### v0.7.6

- **Library views.** Added list and grid browsing, with a cover-first responsive card layout for the grid.
- **Remembered view preference.** Saved the last selected library view and restored it on the next visit.
- **Consistent actions.** Both views support filtering, editing, deletion, and bulk management.
- **Documentation and versions.** Updated the package, README, progress records, and exported backup version to `v0.7.6`.

### v0.7.5

- **Multiple export formats.** Added a format selector in settings for JSON, XML, and CSV backups.
- **JSON bulk import.** Added support for this project's JSON backups and JSON files containing a records array.
- **Unified confirmation dialogs.** Replaced browser-native `confirm` calls with in-app confirmations for backup replacement, bulk replacement, and deletion.
- **Documentation and versions.** Updated the package, README, progress records, architecture documentation, and exported backup version to `v0.7.5`.

### v0.7.3

- **Cover entry screen.** Added a fullscreen cover inviting users to begin their ACGN journey. Clicking anywhere opens the main interface.
- **In-app confirmation dialogs.** Moved library deletion confirmations into the application.
- **Frontend transitions.** Added consistent transitions for entry, navigation, panels, and dialogs to give the app a desktop feel.
- **Documentation.** Updated the README, progress records, and exported backup version to `v0.7.3`.

### v0.7.0

- **Desktop entry point.** Added an Electron window and `npm run desktop:start` to run the application locally.
- **Local service lifecycle.** The desktop launcher starts the local SQLite service and static application runtime when needed, then stops its child processes when the window closes.
- **Local persistence.** The library, background, and theme preferences are saved to SQLite on the user's device, with browser storage available as a fallback.
- **Documentation.** Updated the README, deployment documentation, architecture documentation, and progress records to describe desktop use and the GitHub Pages demo separately.

### v0.6.0

- Added the local data service, now at `server/local-data-server.mjs`, using `node:sqlite`.
- Added `npm run app` to start the local data service and Vite together.

### v0.5.4

- Rebuilt search around a single-source workflow inspired by anime_trace.
- Set AGE Anime, Moegirlpedia, and Bangumi as the default sources and removed obsolete sources with unstable or unsupported direct access.
- Added trace.moe screenshot recognition.
- Added the tag word cloud and `scripts/tag_wordcloud.py`.
- Added bulk library management.
- Unified the project name, repository, GitHub Pages path, export filename prefix, and documentation under `acgn_journey`.

### v0.4

- Removed the Bilibili search source.
- Added custom backgrounds.

### v0.3

- Integrated AniList, VNDB, and YueMu Galgame.
- Deployed to GitHub Pages with a Cloudflare Worker.
- Introduced Vitest tests.

### v0.2

- Released the first complete feature set with library management, category filtering, a timeline, statistics, physical collection tracking, bulk import, and JSON backups.

## Data Sources

- Title search sources are AGE Anime, Moegirlpedia, MangaBaka, and Bangumi. trace.moe is a separate screenshot recognition service.
- AGE Anime search URLs and the initial parsing approach were informed by the public anime_trace implementation, then rewritten for this project's Web/CORS architecture. [anime_trace](https://github.com/linyi102/anime_trace)
- MangaBaka provides light novel search through its official CORS-enabled API. This project uses its data for non-commercial purposes with attribution. [MangaBaka Terms of Service](https://mangabaka.org/about/terms)
- The trace.moe integration references the upstream project and its public API documentation. [soruly/trace.moe](https://github.com/soruly/trace.moe)

## Documentation

Architecture notes, running guides, progress records, iteration plans, and validation results are kept locally in the Git-ignored `docs/` directory.

## License

MIT License. See [LICENSE](LICENSE).
