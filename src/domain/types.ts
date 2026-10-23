// 시험 프리셋 데이터 모델. 새 시험 = src/presets/<id>.json 1개 추가 (코드 변경 없음).

export interface Part {
  id: string
  name: string
  desc?: string
  questions?: number
  /** 문항 번호 범위 [시작, 끝] */
  range?: [number, number]
  minutes: number
  /** review = 마킹·검토 구간 (세션 KPI 에서 시작 시각 비교) */
  kind?: 'review'
}

export type Constraint =
  | {
      type: 'sumMax'
      parts: string[]
      minutes: number
      label: string
      /** 연동 토글 허용: 켜면 한쪽 수정 시 나머지가 합계를 minutes 로 유지 */
      linkable?: boolean
    }
  | {
      type: 'maxSecPerQuestion'
      parts: string[]
      seconds: number
      label: string
    }

export interface Section {
  id: string
  name: string
  /** forced = 방송/시험 진행에 맞춘 강제 진행(일시정지·파트 완료 없음), self = 자기 페이스 */
  mode: 'forced' | 'self'
  minutes: number
  /** auto = 이전 섹션 종료 즉시 시작, manual = 사용자가 시작 (쉬는 시간 등) */
  start?: 'auto' | 'manual'
  note?: string
  parts: Part[]
  constraints?: Constraint[]
}

export interface PresetSource {
  status: 'verified' | 'assumed'
  checkedAt: string
  urls: string[]
  note?: string
}

export interface Exam {
  id: string
  name: string
  category?: string
  description?: string
  source?: PresetSource
  sections: Section[]
}
