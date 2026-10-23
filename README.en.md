# wise-Timer

> Exam time-allocation timer — pick an exam, get per-part time defaults, tweak them, and count down. First preset: TOEIC LC+RC (120 min). Requirements: [PRD.md](PRD.md)
> Stack: Node 22 · pnpm · Vite 7 · React 19 · TypeScript · Tailwind 4 · vite-plugin-pwa (static SPA, no server, no DB)
> 한국어: [README.md](README.md)

## Features

| PRD | Feature | How |
|-----|---------|-----|
| F1 | Exam presets | TOEIC L&R · IELTS (Paper) · TOEFL iBT (2026) · TEPS · CSAT (수능). "확인 필요" badge = assumed values pending official confirmation |
| F2 | Allocation editor + rules | Edit part/section minutes in 0.5-min steps. Section overflow or Part 5+6 > 20 min is an **error (start blocked)**; unassigned time or Part 7 > 1 min/question is a **warning**. "Link" keeps Part 5+6 at 20 min (12→8, 13→7). Uncheck sections to practise a subset |
| F3 | Segment countdown | Section remaining + planned part & part remaining + my progress (behind/ahead). Sound + banner + screen-reader alerts on part/section changes |
| F4 | Forced LC | Forced sections cannot be paused or part-completed; RC starts automatically after 45 min; expected question number shown |
| F5 | Install, offline, my presets | Installable PWA, works offline. "Save as my preset", JSON export/import |
| F6 | Session records | Planned vs actual per part (±), review start time, setup time, unanswered count → saved, compared with the previous session |
| F7 | Projector mode | Black background, huge digits, current part + remaining inside the clock card. Preference remembered |

### Shortcuts (timer screen)

| Key | Action |
|-----|--------|
| Space | Start / pause-resume (self-paced sections only) |
| N | Complete current part (advance my-progress pointer) |
| J / Shift+J | Answered +1 / −1 |
| P | Toggle projector mode |
| F | Fullscreen |

### Behaviour

- Time is computed from **absolute timestamps**: background tabs or a sleeping laptop still switch sections exactly on schedule. Screen Wake Lock while running.
- A **planned pointer** (auto-advances with alerts) and a **my-progress pointer** (N key) give "1:20 behind" style feedback and the actual durations in session records.
- Longer marking/review (buffer) time results from finishing earlier parts early, so it is excluded from "over plan".
- A running exam is persisted; after reload or closing the tab you can "resume".
- All data stays in this browser's localStorage (no server, no analytics).

## Adding an exam preset

Add one file `src/presets/<id>.json` (no code change). It is validated by `src/domain/schema.ts`; an invalid preset fails `make test` (E1-01) and errors on app load. See the Korean README for a full example. Key fields: `mode` `forced|self`, `start` `auto|manual`, `parts[].kind: "review"`, constraints `sumMax` (with `linkable`) and `maxSecPerQuestion`. Files exported via "JSON 내보내기" use the same format.

## Run (docker compose)

| Mode | Compose files | Env | Stage | URL |
|------|---------------|-----|-------|-----|
| local | `docker-compose.yml` + `docker-compose.local.yml` | `.env.local` (committed) | `dev` (vite dev, HMR, bind mount, `pnpm install --frozen-lockfile` on start) | http://127.0.0.1:5173/ |
| prod | `docker-compose.yml` + `docker-compose.prod.yml` | `.env.prod` (not committed) | `runtime` (nginx, same `/wise-Timer/` path as Pages) | http://127.0.0.1:8080/wise-Timer/ |

| Env key | local | prod | Meaning |
|---------|-------|------|---------|
| `APP_ENV` | local | prod | image tag |
| `BIND_HOST` | 127.0.0.1 | 127.0.0.1 | port bind |
| `WEB_PORT` | 5173 | 8080 | host port |
| `VITE_BASE` | `/` | `/wise-Timer/` | base path (trailing slash required) |

```bash
make preflight
make local-all      # http://127.0.0.1:5173/
make test           # unit tests (vitest) in the dev container
make pages-check    # prod rehearsal on /wise-Timer/: index, manifest, service worker
make local-stop && make prod-stop
```

There is no server DB; `make db-*` only prints "N/A".

Host (optional): `pnpm install && pnpm dev` · `pnpm test` · `pnpm e2e` (Playwright using the installed Google Chrome, no browser download; runs against the `/wise-Timer/` production build).

## Deploy to GitHub Pages

1. Create a repo (`wise-Timer` recommended; otherwise set `VITE_BASE=/<repo>/` in `.env.prod`/`.env.example` — Actions uses the repo name automatically).
2. **Settings → Pages → Source = GitHub Actions** (once).
3. Push to `main` → `pages` workflow: `pnpm test` → `pnpm build` (base `/<repo>/`) → deploy.
4. URL: `https://<user>.github.io/<repo>/`.

PRs are checked by `ci.yml`: `make preflight` → `make test` → prod image build.

## Install on macOS (PWA)

Chrome/Edge: install icon in the address bar · Safari (macOS 14+): File → Add to Dock. Works offline afterwards.

## Tests

| Area | Iteration | Scope | Verdict | Result |
|------|-----------|-------|---------|--------|
| dev-env | 1st | environment, Pages path | PASS 8 / MANUAL 2 | [result](test/dev-env/result.md) |
| impl | 1st | E1 presets (F1) | PASS 10/10 | [result](test/impl/1st/result.md) |
| impl | 2nd | E2 allocation (F2) | PASS 13/13 | [result](test/impl/2nd/result.md) |
| impl | 3rd | E3 timer engine, forced LC (F3·F4) | PASS 21/21 | [result](test/impl/3rd/result.md) |
| impl | 4th | E4 my presets, JSON, offline (F5) | PASS 8/8 | [result](test/impl/4th/result.md) |
| impl | 5th | E5 session records (F6) | PASS 8/8 | [result](test/impl/5th/result.md) |
| impl | 6th | E6 projector, accessibility (F7) | PASS 4/4 | [result](test/impl/6th/result.md) |

Final regression: `make test` 56/56, `pnpm e2e` 9/9, prod (nginx `/wise-Timer/`) and local start OK.

## Troubleshooting

- **New dependency missing in the container**: `node_modules` is a named volume; `make test`/`make local-all` run `pnpm install --frozen-lockfile` first. If still broken: `docker compose -p wise-timer-local -f docker-compose.yml -f docker-compose.local.yml down -v`.
- **Blank page on Pages (JS 404)**: `VITE_BASE` does not match the repo name (only relevant for manual builds).
- **No beep in Safari**: audio unlocks only inside a user gesture — start with the on-screen "시작" button or Space.

## Remaining

- Manual checks: real Pages deploy, PWA install on macOS, Safari beep.
- Confirm TOEFL/TEPS/CSAT timings against official notices, then set `source.status` to `verified`.
- Replace the placeholder PWA icons.
