import { useEffect, useRef, useState } from 'react'
import { round3, clamp, formatTime } from '../lib/audio.js'

const NICE_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
function niceStep(dur) {
  const raw = dur / 7
  return NICE_STEPS.find((s) => s >= raw) ?? Math.ceil(raw / 60) * 60
}

// 믹스 타임라인: 트랙별 레인에 클립 블록을 두고 가로 드래그로 시작 위치 조정.
// clipLen(t) = 믹스에 들어가는 길이(초), offsetOf(t)/onOffset 으로 위치 동기화.
export default function MixTimeline({ tracks, clipLen, offsetOf, onOffset }) {
  const laneRef = useRef(null)
  const dragRef = useRef(null)
  const frozenRef = useRef(null) // 드래그 중 스케일 고정
  const [laneW, setLaneW] = useState(600)
  const [, force] = useState(0)

  useEffect(() => {
    const el = laneRef.current
    if (!el) return
    const ro = new ResizeObserver((e) => {
      const w = Math.floor(e[0].contentRect.width)
      if (w > 0) setLaneW(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 타임라인 총 길이(여유 15%)
  const contentEnd = Math.max(
    0.001,
    ...tracks.map((t) => Math.max(0, offsetOf(t)) + clipLen(t)),
  )
  const longest = Math.max(0.001, ...tracks.map((t) => clipLen(t)))
  const idleDur = Math.max(contentEnd, longest) * 1.15
  const dur = frozenRef.current ?? idleDur
  const pps = laneW / dur // px per second
  const step = niceStep(dur)

  function startDrag(e, t) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    frozenRef.current = idleDur
    dragRef.current = { id: t.id, startX: e.clientX, startOffset: offsetOf(t) }
    force((n) => n + 1)
  }
  function onMove(e) {
    const d = dragRef.current
    if (!d) return
    const delta = (e.clientX - d.startX) / pps
    onOffset(d.id, round3(Math.max(0, d.startOffset + delta)))
  }
  function endDrag(e) {
    if (!dragRef.current) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
    dragRef.current = null
    frozenRef.current = null
    force((n) => n + 1)
  }

  const ticks = []
  for (let s = 0; s <= dur; s += step) ticks.push(s)

  return (
    <div className="mixline">
      {/* 눈금자 */}
      <div className="mixline-ruler" ref={laneRef}>
        {ticks.map((s) => (
          <span key={s} className="tick" style={{ left: `${(s / dur) * 100}%` }}>
            {formatTime(s)}
          </span>
        ))}
      </div>

      {/* 트랙 레인 */}
      {tracks.map((t, i) => {
        const len = clipLen(t)
        const off = offsetOf(t)
        const dragging = dragRef.current?.id === t.id
        return (
          <div className="mixline-row" key={t.id}>
            <div className="mixline-side">
              <span className="track-no" style={{ '--accent': t.accent }}>
                {i + 1}
              </span>
              <input
                type="number"
                step="0.001"
                min="0"
                value={off}
                onChange={(e) => onOffset(t.id, Math.max(0, round3(parseFloat(e.target.value) || 0)))}
                aria-label={`${t.name} 시작 위치`}
              />
            </div>
            <div className="mixline-lane">
              <div
                className={`clip ${dragging ? 'is-drag' : ''}`}
                style={{
                  left: `${clamp((off / dur) * 100, 0, 100)}%`,
                  width: `${clamp((len / dur) * 100, 0.5, 100)}%`,
                  '--accent': t.accent,
                }}
                onPointerDown={(e) => startDrag(e, t)}
                onPointerMove={onMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                title={`${t.name} · ${formatTime(off)} ~ ${formatTime(off + len)}`}
              >
                <span className="clip-label">{t.name}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
