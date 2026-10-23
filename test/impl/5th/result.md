# 시험 결과 / Test Result — impl 5th (E5)
- 일자 Date: 2026-10-23 / 대상 Target: wise-timer custom(react) / 커밋 Commit: — (git 미초기화)

## 요약 / Summary
- 전체 Total: 8 (단위 7 + E2E 1), 통과 Pass: 8, 실패 Fail: 0 (최종), 최종 Verdict: **PASS**
- 회귀: `make test` 56/56, `pnpm e2e` 5/5

## 케이스 / Cases
| id | 결과 result | 비고 note |
|----|-------------|-----------|
| E5-01 ~ E5-07 | PASS | |
| E5-E1 | PASS (round 4) | logs/e5-result.png, logs/e5-history.png |

## 발견 오류 및 수정 / Bugs & Fixes
| round | 오류 bug | 원인 cause | 수정 fix | 재시험 retest |
|-------|----------|------------|----------|---------------|
| 1 | E5-06 기대 문자열 불일치 | 시험 기대값 열 순서 오류(계획→실제) | 기대값 수정 | PASS |
| 1 | 시간 종료로 끝난 마지막 파트(마킹·검토)가 "미완료" 표시 | 완료(N) 표시가 없는 파트를 모두 미완료로 처리 | 진행 중이던 파트는 섹션 종료 시각까지 실제로 기록(status `cut`, "시간 종료" 표기) | PASS |
| 2 | E5-E1 검토 시작 "74:01" (기대 74:00) | 기록 표시에 카운트다운용 `fmtClock`(초 올림) 사용 | 기록용 `fmtDuration`(반올림) 분리 + E5-07 | PASS |
| 3 | E5-E1 2회차 계획 초과 1:00 (기대 0) | 앞 파트를 일찍 끝내 늘어난 검토(버퍼) 시간이 초과로 합산 | 초과 합계에서 review 파트 제외, 차이 색상 중립 | PASS |
| 4 | 결과 표 "±0:00" 이 빨간색 (스크린샷 검토) | 색상 판정이 ms 단위(수 ms 초과) | 초 반올림 기준 색상, E5-06 에 중립색 단언 추가 | PASS |

## 첨부 / Logs
- logs/make-test.txt, logs/e2e.txt, logs/e5-result.png, logs/e5-history.png
