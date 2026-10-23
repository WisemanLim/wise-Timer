# 시험 결과 / Test Result — dev-env 1st
- 일자 Date: 2026-10-23
- 대상 Target: wise-timer · profile `custom`(react 정적 SPA + PWA + GitHub Pages)
- 커밋 Commit: — (git 저장소 미초기화)
- 환경: macOS (Darwin 25.6.0) · Docker 29.3.0 · Compose v2 · Node 22 (컨테이너 `node:22-slim`, `nginx:1.27-alpine`)

## 요약 / Summary
- 전체 Total: 10, 통과 Pass: 8, 실패 Fail: 0, 보류 Pending(MANUAL): 2
- 최종 Verdict: **PASS** (로컬 실행 가능한 P0 전부 통과. ENV-07 실제 Pages 배포·ENV-08 PWA 설치는 저장소 생성 후 수동 확인)

## 케이스 / Cases
| id | 결과 result | 비고 note |
|----|-------------|-----------|
| ENV-01 preflight | PASS | `=== Preflight OK (정적 SPA · DB 없음) ===` |
| ENV-02 local-all | PASS | `wise-timer-local-web-1` Up (healthy), 127.0.0.1:5173 |
| ENV-03 local 응답 | PASS | HTTP 200, `<div id="root">` 포함 |
| ENV-04 make test | PASS | dev 컨테이너 vitest 1/1 통과, exit 0 |
| ENV-05 pages-check | PASS | prod 이미지(VITE_BASE=/wise-Timer/) 빌드·기동, `Pages 경로 OK: /wise-Timer/ (index·manifest·sw)` |
| ENV-06 SW scope | PASS | `register('/wise-Timer/sw.js', { scope: '/wise-Timer/' })`, `/health` 200, `/` → 302 `/wise-Timer/`, `sw.js` `Cache-Control: no-cache`, 컨테이너 healthy. headless Chrome 렌더: `<h1>wise-Timer</h1>`, `base: /wise-Timer/` (JS·CSS 하위 경로 로드 확인, 스크린샷 logs/env-06c-prod.png) |
| ENV-07 Pages 배포 | MANUAL | 미실행 — git 저장소·GitHub remote 없음. 절차: 저장소 생성 → Settings → Pages → Source=GitHub Actions → `git push origin main` → Actions `pages` 성공 → `https://<user>.github.io/wise-Timer/` 200 확인 |
| ENV-08 PWA 설치(맥) | MANUAL | 미실행 — HTTPS(Pages) 또는 localhost 필요. 절차: Chrome 주소창 설치 아이콘 / Safari 파일 → Dock에 추가 → 독립 창 실행 → 네트워크 끊고 재실행 |
| ENV-09 db-ping | PASS | `N/A: 서버 DB 없음 …` (설계상 DB 없음) |
| ENV-10 정리 | PASS | local/prod down, 잔여 컨테이너 0 |

## 발견 오류 및 수정 / Bugs & Fixes
| round | 오류 bug | 원인 cause | 수정 fix | 재시험 retest |
|-------|----------|------------|----------|---------------|
| 1 | — | — | — | 오류 없음 |

## 비고 / Notes
- 브라우저 E2E: `claude-in-chrome` 확장 미연결 → 폴백으로 시스템 Chrome `--headless=new --dump-dom/--screenshot` 사용. 서비스워커 실제 등록·오프라인 동작은 ENV-08 수동 확인 범위.
- COMPLIANCE.md 추가 시험(axe 위반 0, 외부 origin 요청 0, 타이머 정확도)은 기능 구현 후 `test/impl/1st` 에서 수행.

## 첨부 / Logs
- logs/ 참조 (`env-01-preflight.txt` … `env-10-stop.txt`, `env-06b-headless-dom.html`, `env-06c-prod.png`) — 비커밋
