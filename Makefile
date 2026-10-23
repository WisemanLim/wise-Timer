# wise-timer — custom(react, 정적 SPA) (wise-vibe wds-scaffold 표준 공통 타겟 기반)
# 모드: local(vite dev) | prod(nginx 정적 서빙 = GitHub Pages 리허설) — 실행은 docker compose 전용. make help
# 서버 DB 없음: 데이터는 브라우저 localStorage. db-* 타겟은 표준 호환용 안내만 출력.
PROJECT     := wise-timer
APP_SVC     := web
TEST        ?= pnpm install --frozen-lockfile --prefer-offline >/dev/null && pnpm test

## ===== wds 공통 타겟 / common targets (docker compose 전용 · 모드 = local | prod) =====
# local : docker-compose.yml + docker-compose.local.yml + .env.local  (SQLite, 소스 바인드/핫리로드, dev 스테이지)
# prod  : docker-compose.yml + docker-compose.prod.yml  + .env.prod   (DB_ENGINE 의 RDBMS 컨테이너, runtime 스테이지)
# compose/*.yml (scaffold --extras) 은 두 모드에 자동 포함된다.
ENV   ?= local
MODES := local prod
SVC   ?=
EXTRA_FILES := $(foreach f,$(sort $(wildcard compose/*.yml)),-f $(f))
DC_local := docker compose -p $(PROJECT)-local -f docker-compose.yml -f docker-compose.local.yml $(EXTRA_FILES) --env-file .env.local
DC_prod  := docker compose -p $(PROJECT)-prod  -f docker-compose.yml -f docker-compose.prod.yml  $(EXTRA_FILES) --env-file .env.prod
DC = $(DC_$(ENV))

.PHONY: help preflight test shell deploy pages-check db-ping db-shell db-migrate db-seed db-reset db-fresh \
        $(foreach m,$(MODES),$(m)-all $(m)-build $(m)-logs $(m)-stop $(m)-restart $(m)-ps)

help:  ## 타겟 목록 / list targets
	@grep -hE '^[a-z][a-zA-Z%_-]*:.*## ' $(MAKEFILE_LIST) | sed -E 's/:[^#]*##/\t/' | awk -F'\t' '{printf "  %-14s %s\n", $$1, $$2}'
	@echo "  <mode>-all     [local|prod] 전체 스택 기동 (이미지 없으면 빌드)"
	@echo "  <mode>-build   [local|prod] 이미지 재빌드 후 기동"
	@echo "  <mode>-logs    [local|prod] 로그 추적 (SVC=<service>)"
	@echo "  <mode>-stop    [local|prod] 컨테이너 정리 (볼륨 유지)"
	@echo "  <mode>-restart [local|prod] 재기동 (SVC=<service>)"
	@echo "  <mode>-ps      [local|prod] 컨테이너 상태"
	@echo "  배포: git push main → GitHub Actions(pages.yml) → GitHub Pages"

preflight:  ## Docker·Compose v2·환경 파일 점검 / check docker, compose v2, env files
	@command -v docker >/dev/null 2>&1 || { echo "FAIL: Docker 미설치 / not installed"; exit 1; }
	@docker compose version >/dev/null 2>&1 || { echo "FAIL: docker compose v2 필요 / required"; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "FAIL: Docker 데몬 미기동 / daemon not running"; exit 1; }
	@for f in .env.local .env.prod; do [ -f $$f ] || { echo "FAIL: $$f 없음 — cp .env.example $$f"; exit 1; }; done
	@grep -q 'CHANGE_ME' .env.prod && echo "WARN: .env.prod 에 CHANGE_ME placeholder — 실제 배포 전 Secret Manager 로 주입" || true
	@$(DC_local) config -q && $(DC_prod) config -q && echo "=== Preflight OK (정적 SPA · DB 없음) ==="

## --- 모드별 수명주기 / lifecycle per mode ---
$(MODES:%=%-all): %-all:
	$(DC_$*) up -d
$(MODES:%=%-build): %-build:
	$(DC_$*) up -d --build
$(MODES:%=%-logs): %-logs:
	$(DC_$*) logs -f $(SVC)
$(MODES:%=%-stop): %-stop:
	$(DC_$*) down --remove-orphans
$(MODES:%=%-restart): %-restart:
	$(DC_$*) restart $(SVC)
$(MODES:%=%-ps): %-ps:
	$(DC_$*) ps

## --- 공통 / common ---
test:   ## local dev 컨테이너에서 테스트 실행
	$(DC_local) run --rm --no-deps --entrypoint sh $(APP_SVC) -c '$(TEST)'
shell:  ## 앱 컨테이너 셸 (ENV=local|prod)
	$(DC) exec $(APP_SVC) sh
deploy: ## [자체 호스팅 선택] nginx prod 롤아웃 — 기본 배포는 GitHub Pages(pages.yml)
	@grep -q 'CHANGE_ME' .env.prod && { echo "FAIL: .env.prod 에 CHANGE_ME — 시크릿 주입 후 배포"; exit 1; } || true
	$(DC_prod) up -d --build --remove-orphans

## --- GitHub Pages ---
pages-check:  ## Pages 와 같은 /<repo>/ 경로로 prod 빌드·기동 후 응답 확인
	$(DC_prod) up -d --build
	@for i in $$(seq 1 30); do curl -fsS http://127.0.0.1:8080/health >/dev/null 2>&1 && break; sleep 1; done
	@B=$$(grep '^VITE_BASE=' .env.prod | cut -d= -f2); \
	  curl -fsS "http://127.0.0.1:8080$${B}" | grep -q '<div id="root">' && \
	  curl -fsS "http://127.0.0.1:8080$${B}manifest.webmanifest" >/dev/null && \
	  curl -fsS "http://127.0.0.1:8080$${B}sw.js" >/dev/null && \
	  echo "Pages 경로 OK: $${B} (index·manifest·sw)"

## --- DB (해당 없음 / not applicable) ---
db-ping db-shell db-migrate db-seed db-reset db-fresh:  ## 서버 DB 없음 (브라우저 로컬 저장)
	@echo "N/A: 서버 DB 없음 — 데이터는 브라우저 localStorage (PRD §3 Out of Scope)"
