# dev-env 시나리오 / scenario — wise-timer (custom: react 정적 SPA + GitHub Pages)

| id | 목적 / purpose | 명령 / command | 기대 / expected | 우선 |
|----|----------------|----------------|-----------------|------|
| ENV-01 | 도구·설정 점검 | `make preflight` | `Preflight OK` | P0 |
| ENV-02 | local 기동 (vite dev) | `make local-all` | `web` running/healthy | P0 |
| ENV-03 | local 응답 | `curl -fsS http://127.0.0.1:5173/` | HTTP 200, `<div id="root">` | P0 |
| ENV-04 | 테스트 진입점 | `make test` | exit 0 | P0 |
| ENV-05 | Pages 경로 리허설 | `make pages-check` | `Pages 경로 OK: /wise-Timer/ (index·manifest·sw)` | P0 |
| ENV-06 | 서비스워커 scope | `curl -fsS http://127.0.0.1:8080/wise-Timer/registerSW.js` | `scope: '/wise-Timer/'` | P0 |
| ENV-07 | GitHub Pages 배포 | `git push origin main` → Actions `pages` | build·deploy 성공, `https://<user>.github.io/wise-Timer/` 200 | P0 |
| ENV-08 | PWA 설치 (맥) | Chrome 주소창 설치 아이콘 / Safari 파일 → Dock에 추가 | 독립 창으로 실행, 오프라인 재실행 가능 | P1 |
| ENV-09 | DB 타겟 | `make db-ping` | `N/A: 서버 DB 없음` | P1 |
| ENV-10 | 정리 | `make local-stop && make prod-stop` | 컨테이너 없음 | P1 |
