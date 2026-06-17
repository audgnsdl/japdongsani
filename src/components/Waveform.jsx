import { useEffect, useMemo, useRef, useState } from 'react'
import { computePeaks, hexToRgba, round3, clamp } from '../lib/audio.js'

const HANDLE_HIT = 9 // 핸들 잡힘 판정 픽셀

// 파형 + 마우스 구간 선택 + 재생 헤드 표시
export default function Waveform({
  buffer,
  start,
  end,
  onChange,
  playhead = null,
  accent = '#8b5cf6',
  readOnly = false,
  height = 92,
}) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const [width, setWidth] = useState(640)
  const duration = buffer.duration

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const peaks = useMemo(() => computePeaks(buffer, Math.max(1, width)), [buffer, width])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const mid = height / 2
    const sx = duration ? (start / duration) * width : 0
    const ex = duration ? (end / duration) * width : width

    // 파형 막대 (선택 구간은 accent, 바깥은 흐리게)
    for (let i = 0; i < peaks.length; i++) {
      const amp = Math.max(1, peaks[i] * (mid - 3))
      ctx.fillStyle = i >= sx && i <= ex ? accent : 'rgba(140,140,165,0.32)'
      ctx.fillRect(i, mid - amp, 1, amp * 2)
    }

    // 선택 오버레이
    ctx.fillStyle = hexToRgba(accent, 0.13)
    ctx.fillRect(sx, 0, ex - sx, height)

    if (!readOnly) {
      ctx.fillStyle = accent
      ctx.fillRect(sx - 1, 0, 2, height)
      ctx.fillRect(ex - 1, 0, 2, height)
      ctx.fillRect(sx - 3, mid - 11, 6, 22)
      ctx.fillRect(ex - 3, mid - 11, 6, 22)
    }

    if (playhead != null && duration) {
      const px = (playhead / duration) * width
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(px - 0.75, 0, 1.5, height)
    }
  }, [peaks, width, height, start, end, playhead, accent, duration, readOnly])

  function xToTime(clientX) {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = clamp(clientX - rect.left, 0, rect.width)
    return round3((x / rect.width) * duration)
  }

  function onPointerDown(e) {
    if (readOnly) return
    const rect = canvasRef.current.getBoundingClientRect()
    const sx = (start / duration) * rect.width
    const ex = (end / duration) * rect.width
    const x = e.clientX - rect.left
    canvasRef.current.setPointerCapture(e.pointerId)

    if (Math.abs(x - sx) <= HANDLE_HIT) {
      dragRef.current = 'start'
    } else if (Math.abs(x - ex) <= HANDLE_HIT) {
      dragRef.current = 'end'
    } else {
      const t = xToTime(e.clientX)
      dragRef.current = { anchor: t }
      onChange(t, t)
    }
  }

  function onPointerMove(e) {
    const d = dragRef.current
    if (!d) return
    const t = xToTime(e.clientX)
    if (d === 'start') onChange(Math.min(t, end), end)
    else if (d === 'end') onChange(start, Math.max(t, start))
    else onChange(Math.min(d.anchor, t), Math.max(d.anchor, t))
  }

  function onPointerUp(e) {
    dragRef.current = null
    try {
      canvasRef.current.releasePointerCapture(e.pointerId)
    } catch {}
  }

  return (
    <div ref={wrapRef} className="wave" style={{ height }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: readOnly ? 'default' : 'ew-resize',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  )
}
