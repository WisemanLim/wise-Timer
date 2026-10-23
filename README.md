# wise-Timer

> 시험 시간 배분 타이머 — 시험을 고르면 파트별 시간 배분이 채워지고, 세부 시간을 고쳐 바로 카운트다운합니다. 첫 프리셋: TOEIC LC+RC 120분. 요구사항: [PRD.md](PRD.md)
> 스택: Node 22 · pnpm · Vite 7 · React 19 · TypeScript · Tailwind 4 · vite-plugin-pwa (정적 SPA, 서버·DB 없음)
> English: [README.en.md](README.en.md)

## 기능

| PRD | 기능 | 사용법 |
|-----|------|--------|
| F1 | 시험 프리셋 | TOEIC L&R · IELTS(Paper) · TOEFL iBT(2026) · TEPS · 수능. "시간 정보 확인 필요" 배지 = 공식 확인 전 가정치 |
| F2 | 배분 편집·검증 | 파트·섹션 시간을 0.5분 단위로 수정. 섹션 합계 초과·Part 5+6 > 20분이면 **오류 → 시작 차단**, 미배정·Part 7 문항당 1분 초과는 **주의**. "연동"을 켜면 Part 5 를 바꿀 때 Part 6 이 합계 20분을 유지(12→8, 13→7). 섹션 체크 해제로 일부만 연습 |
| F3 | 구간 카운트다운 | 섹션 남은 시간 + 계획상 현재 파트·파트 남은 시간 + 내 진행(지연/앞섬). 파트·섹션 전환 시 소리·배너·스크린리더 알림 |
| F4 | LC 강제 진행 | 강제 진행 섹션은 일시정지·파트 완료 없음, 45분 후 RC 자동 시작, 예상 문항 번호 표시 |
| F5 | 설치·오프라인·내 프리셋 | PWA 설치 후 오프라인 동작. 배분을 "내 프리셋으로 저장", JSON 내보내기/가져오기 |
| F6 | 세션 기록 | 종료 후 파트별 계획 대비 실제(±), 검토 시작 시각, 설정 소요, 미완료 문항 → 저장, 지난 회차 비교 |
| F7 | 프로젝터 모드 | 검정 배경·큰 숫자, 시계 카드 안에 현재 파트·남은 시간 표시. 설정은 브라우저에 기억 |

### 단축키 (실행 화면)

| 키 | 동작 |
|----|------|
| Space | 시작 / 일시정지·재개 (자기 페이스 섹션만) |
| N | 현재 파트 완료 (내 진행 포인터 다음으로) |
| J / Shift+J | 푼 문항 +1 / −1 |
| P | 프로젝터 모드 전환 |
| F | 전체화면 |

### 동작 규칙

- 시간은 **절대 시각 기준**으로 계산합니다. 탭이 백그라운드이거나 노트북이 잠들어도 계획 시각대로 섹션이 넘어갑니다. 실행 중 화면 꺼짐 방지(Wake Lock).
- **계획 포인터**(시간 따라 자동 전환·알림)와 **내 진행 포인터**(N 키)가 따로 있어 "계획보다 1:20 늦음"처럼 표시되고, 세션 기록의 실제 소요가 됩니다.
- 마킹·검토(버퍼) 구간이 늘어난 것은 앞 파트를 일찍 끝낸 결과이므로 "계획 초과"에 넣지 않습니다.
- 진행 중 시험은 브라우저에 저장되어 새로고침·탭 종료 후 "이어하기"가 됩니다.
- 모든 데이터는 이 브라우저 localStorage 에만 저장됩니다(서버 전송·애널리틱스 없음).

## 새 시험 프리셋 추가

`src/presets/<id>.json` 파일 1개를 추가하면 목록에 나타납니다(코드 변경 없음). `src/domain/schema.ts` 로 검증됩니다 — 형식이 틀리면 `make test`(E1-01)가 실패하고 앱 로드 시 오류가 납니다.

```json
{
  "id": "my-exam", "name": "내 시험", "category": "어학",
  "source": { "status": "assumed", "checkedAt": "2026-10-23", "urls": [] },
  "sections": [
    { "id": "s1", "name": "1교시", "mode": "self", "start": "auto", "minutes": 60,
      "parts": [
        { "id": "a", "name": "A", "questions": 30, "range": [1, 30], "minutes": 55 },
        { "id": "review", "name": "검토", "minutes": 5, "kind": "review" }
      ],
      "constraints": [
        { "type": "sumMax", "parts": ["a"], "minutes": 55, "label": "A ≤ 55분" },
        { "type": "maxSecPerQuestion", "parts": ["a"], "seconds": 120, "label": "문항당 최대 2분" }
      ] }
  ]
}
```

- `mode`: `forced`(방송·시험 진행에 맞춰 강제, 일시정지 없음) / `self`(자기 페이스)
- `start`: `auto`(이전 섹션 종료 즉시) / `manual`(쉬는 시간 후 사용자가 시작)
- `sumMax` 제약은 `"linkable": true` + 파트 2개면 "연동" 토글 제공
- 앱의 "JSON 내보내기"로 받은 파일도 같은 형식이라 템플릿으로 쓸 수 있습니다.

## 실행 (docker compose)

| 모드 | compose 파일 | env | 이미지 스테이지 | 주소 |
|------|--------------|-----|----------------|------|
| local | `docker-compose.yml` + `docker-compose.local.yml` | `.env.local` (커밋) | `dev` (vite dev, HMR, 소스 바인드, 기동 시 `pnpm install --frozen-lockfile`) | http://127.0.0.1:5173/ |
| prod | `docker-compose.yml` + `docker-compose.prod.yml` | `.env.prod` (비커밋) | `runtime` (nginx, Pages 와 같은 `/wise-Timer/` 경로) | http://127.0.0.1:8080/wise-Timer/ |

| env 키 | local | prod | 설명 |
|--------|-------|------|------|
| `APP_ENV` | local | prod | 이미지 태그 |
| `BIND_HOST` | 127.0.0.1 | 127.0.0.1 | 포트 바인딩 |
| `WEB_PORT` | 5173 | 8080 | 호스트 포트 |
| `VITE_BASE` | `/` | `/wise-Timer/` | 배포 경로 (끝 슬래시 필수) |

```bash
make preflight      # Docker·Compose·env 파일 점검
make local-all      # vite dev → http://127.0.0.1:5173/
make test           # dev 컨테이너에서 단위 시험 (vitest)
make pages-check    # Pages 경로(/wise-Timer/) prod 리허설: index·manifest·sw 응답
make local-stop && make prod-stop
make help           # 전체 타겟
```

서버 DB 가 없으므로 `make db-*` 는 "N/A" 안내만 출력합니다.

### 호스트에서 직접 (선택)

```bash
pnpm install
pnpm dev            # http://127.0.0.1:5173/
pnpm test           # 단위 시험
pnpm e2e            # E2E: 설치된 Google Chrome 사용(브라우저 다운로드 없음), /wise-Timer/ 프로덕션 빌드 대상
```

## GitHub Pages 배포

1. GitHub 저장소 생성(이름 `wise-Timer` 권장 — 다른 이름이면 `.env.prod`/`.env.example` 의 `VITE_BASE` 를 `/<repo>/` 로. Actions 빌드는 저장소 이름을 자동 사용).
2. 저장소 **Settings → Pages → Build and deployment → Source = GitHub Actions** (최초 1회).
3. `main` 에 push → `pages` 워크플로가 `pnpm test` → `pnpm build`(base=`/<repo>/`) → Pages 배포.
4. 주소: `https://<user>.github.io/<repo>/` (`<user>.github.io` 저장소면 base `/` 자동. 커스텀 도메인은 base `/` + `public/CNAME`).

PR 은 `ci.yml` 이 docker 기반 `make preflight` → `make test` → prod 이미지 빌드로 검증합니다.

## 맥 설치 (PWA)

- **Chrome/Edge**: 주소창 오른쪽 설치 아이콘 → 설치.
- **Safari (macOS 14+)**: 파일 → Dock에 추가.
- 설치 후 오프라인에서도 실행됩니다(서비스워커 precache).

## 디렉터리

```
src/domain/          순수 로직 — types·schema(프리셋 검증)·allocation(F2)·engine(F3·F4)·session(F6)·customPresets(F5)·format
src/components/      화면 — ExamPicker·AllocationEditor·TimerView·ResultView·HistoryView·PresetControls·MinutesField
src/presets/*.json   내장 시험 프리셋
src/platform.ts      알림음·Wake Lock·전체화면 / src/storage.ts localStorage 래퍼
public/icons/        PWA 아이콘 (placeholder)
docker/              nginx 템플릿 (prod 모드)
test/unit/           vitest 단위 시험 (make test)
test/e2e/            Playwright E2E (pnpm e2e, 호스트 Chrome)
test/dev-env/        표준 환경 검증 / test/impl/<Nth>/ 구현 차수별 시험
```

## 시험

| 영역 | 차수 | 범위 | 판정 | 결과 |
|------|------|------|------|------|
| dev-env | 1st | 환경·Pages 경로 | PASS 8 / MANUAL 2 | [result](test/dev-env/result.md) |
| impl | 1st | E1 프리셋·선택 (F1) | PASS 10/10 | [result](test/impl/1st/result.md) |
| impl | 2nd | E2 배분 편집·검증 (F2) | PASS 13/13 | [result](test/impl/2nd/result.md) |
| impl | 3rd | E3 타이머 엔진·LC 강제 (F3·F4) | PASS 21/21 | [result](test/impl/3rd/result.md) |
| impl | 4th | E4 내 프리셋·JSON·오프라인 (F5) | PASS 8/8 | [result](test/impl/4th/result.md) |
| impl | 5th | E5 세션 기록 (F6) | PASS 8/8 | [result](test/impl/5th/result.md) |
| impl | 6th | E6 프로젝터·접근성 (F7, KWCAG) | PASS 4/4 | [result](test/impl/6th/result.md) |

최종 회귀: `make test` 56/56, `pnpm e2e` 9/9, prod(nginx `/wise-Timer/`)·local 기동 정상.

## 트러블슈팅

- **의존성을 추가했는데 컨테이너에 없음**: dev 컨테이너의 `node_modules` 는 named volume 이라 최초 1회만 채워집니다. `make test`·`make local-all` 은 시작 전에 `pnpm install --frozen-lockfile` 로 동기화합니다. 그래도 꼬이면 `docker compose -p wise-timer-local -f docker-compose.yml -f docker-compose.local.yml down -v`.
- **Pages 에서 화면이 비어 있음(JS 404)**: `VITE_BASE` 가 저장소 이름과 다름. 워크플로는 저장소 이름을 자동 사용하므로 직접 빌드할 때만 확인.
- **알림음이 안 남(Safari)**: 사용자 조작 안에서만 오디오가 열립니다. 반드시 화면의 "시작" 버튼(또는 Space)으로 시작하세요.
- **pnpm 10 `"pnpm" field … ignored` 경고**: 빌드 허용 목록은 `pnpm-workspace.yaml` 의 `onlyBuiltDependencies` 에 있습니다.

## 남은 일

- 수동 확인: 실제 GitHub Pages 배포, PWA 설치(맥), Safari 알림음 ([dev-env result](test/dev-env/result.md), [COMPLIANCE](COMPLIANCE.md)).
- TOEFL·TEPS·수능 프리셋 시간은 공식 공고로 확인 후 `source.status` 를 `verified` 로 변경.
- PWA 아이콘 교체(현재 placeholder).
