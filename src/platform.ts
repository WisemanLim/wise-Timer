// 브라우저 기능 래퍼: 알림음(Web Audio)·화면 꺼짐 방지(Wake Lock)·전체화면. 미지원 환경에서는 조용히 무시.

let ctx: AudioContext | null = null

/** Safari 는 사용자 조작 안에서 AudioContext 를 열어야 소리가 난다 → 시작 버튼 클릭 시 호출 */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

/** 짧은 비프 n 회 */
export function beep(times = 2) {
  if (!ctx) return
  try {
    const t0 = ctx.currentTime
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.3)
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + i * 0.3 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.3 + 0.2)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0 + i * 0.3)
      osc.stop(t0 + i * 0.3 + 0.22)
    }
  } catch {
    /* 무시 */
  }
}

let lock: WakeLockSentinel | null = null

export async function keepAwake(on: boolean) {
  try {
    if (on) {
      if (!lock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        lock = await navigator.wakeLock.request('screen')
        lock.addEventListener('release', () => (lock = null))
      }
    } else {
      await lock?.release()
      lock = null
    }
  } catch {
    lock = null
  }
}

export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch {
    /* 미지원 */
  }
}
