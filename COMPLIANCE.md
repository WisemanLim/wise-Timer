# COMPLIANCE — 교육·에듀테크 (KSIC P)
> 자동 생성 (wds-scaffold). 근거: domains/edtech.yaml + PRD.md. 규제는 변하므로 출처로 재확인.
> **전제**: 서버·계정·애널리틱스 없음, 모든 데이터는 사용자 기기(브라우저)에만 저장(PRD §3 Out of Scope). 이 전제가 바뀌면 이 문서를 재작성한다.

## 분류
KSIC P(교육) · ISIC P · NACE P · NAICS 61. SW 활동은 J(`ict-saas`) 베이스라인.

## 한국 규제 (1순위)
| 규제 | 영향 (edtech.yaml) | 본 프로젝트 적용 |
|------|-------------------|-----------------|
| 개인정보보호법(PIPA) | PII 수명주기(동의·최소·보유·삭제) | **해당 없음** — PII 수집·전송 없음 |
| 아동·청소년 개인정보(만14세 미만, PIPA §22-2) | 보호자 동의 게이트 | **해당 없음** — 가입·식별 정보 없음 |
| 교육 관련 개인정보(학습기록) | 민감 취급, 벤더 공유 제한 | **부분 적용** — 세션 기록은 기기 로컬에만, 외부 전송·제3자 SDK 금지 |
| 웹접근성(KWCAG) | 접근성 + a11y CI | **적용** — KWCAG 2.2 / WCAG 2.2 AA (PRD §7) |

## 국제 기준
COPPA · FERPA · GDPR — 개인정보 미수집·미전송으로 **해당 없음**. 애널리틱스/광고/외부 폰트 CDN 추가 시 재검토.

## 데이터 등급
| 데이터 | 등급 | 처리 |
|--------|------|------|
| 사용자 프리셋(시간 배분) | 일반 | localStorage, JSON 내보내기/가져오기 |
| 세션 기록(계획 대비 실제) | 민감(학습기록) | localStorage(최근 200건), 기기 밖 전송 금지, 기록 화면에서 삭제 |
| 진행 중 시험 상태 | 일반 | localStorage — 새로고침·탭 종료 후 이어하기, 종료 시 삭제 |
| 학습자 PII · 미성년자 정보 · 결제 | — | **수집하지 않음** |

## 인프라 패턴
영상 트랜스코드·WebRTC·버스트 스케일·Redis — **해당 없음**. 정적 호스팅(GitHub Pages, HTTPS) + 서비스워커 오프라인.

## 개발환경 특수 요구
- a11y 게이트: `pnpm e2e` 의 axe-core 검사(WCAG 2.0/2.1/2.2 A·AA, 라이트/다크 7화면) — test/impl/6th PASS.
- 테스트 픽스처에 실제 PII 사용 금지(해당 데이터 자체가 없음).

## 추가 시험 (→ test/dev-env, test/impl)
| 시험 | 결과 |
|------|------|
| KWCAG 자동 검사(axe) 위반 0 | PASS — test/impl/6th E6-E1·E2 |
| 키보드 전용 조작·초점 표시 | PASS — test/impl/6th E6-E4 |
| 네트워크 요청 감사: 자기 origin 외 요청 0 | PASS — test/impl/4th E4-E2 |
| 오프라인 실행 | PASS — test/impl/4th E4-E2 |
| 절전·백그라운드 복귀 시 계획 시각 정확도 | PASS (엔진 단위) — test/impl/3rd E3-04·E3-10 |
| Safari 알림음 | MANUAL — 실제 Safari 에서 시작 버튼 후 파트 전환 비프 확인 |

## 출처
- `wds-recommend/references/domains/edtech.yaml`
- PRD.md §3(Out of Scope), §6, §7
