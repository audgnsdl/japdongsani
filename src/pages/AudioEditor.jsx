import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import Waveform from '../components/Waveform.jsx'
import { useTheme } from '../theme.jsx'
import {
  sliceBuffer,
  concatBuffers,
  encodeWav,
  downloadBlob,
  formatTime,
  round3,
  clamp,
} from '../lib/audio.js'

const ACCENTS = ['#22c55e', '#6366f1', '#ec4899', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444']
const stripExt = (name) => name.replace(/\.[^.]+$/, '')

export default function AudioEditor() {
  const { theme, setTheme } = useTheme()
  const ctxRef = useRef(null)
  const srcRef = useRef(null)
  const rafRef = useRef(0)
  const idRef = useRef(0)
  const inputRef = useRef(null)

  const [tracks, setTracks] = useState([])
  const [result, setResult] = useState(null)
  const [useSelection, setUseSelection] = useState(true)
  const [busy, setBusy] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [playing, setPlaying] = useState(null) // 재생 중인 id (또는 'result')
  const [pos, setPos] = useState(0)

  const getCtx = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext
      ctxRef.current = new AC()
    }
    return ctxRef.current
  }

  useEffect(() => () => stop(), []) // 언마운트 시 재생 정지

  // ---------- 재생 ----------
  function stop() {
    if (srcRef.current) {
      try {
        srcRef.current.onended = null
        srcRef.current.stop()
      } catch {}
      try {
        srcRef.current.disconnect()
      } catch {}
      srcRef.current = null
    }
    cancelAnimationFrame(rafRef.current)
    setPlaying(null)
  }

  function play(id, buffer, start = 0, end = null) {
    const ctx = getCtx()
    ctx.resume?.()
    stop()
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    const realEnd = end == null ? buffer.duration : end
    const dur = Math.max(0.01, realEnd - start)
    const t0 = ctx.currentTime
    src.start(0, start, dur)
    srcRef.current = src
    setPlaying(id)
    setPos(start)
    src.onended = () => stop()
    const tick = () => {
      const el = ctx.currentTime - t0
      setPos(start + el)
      if (el < dur) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function togglePlay(id, buffer, start, end) {
    if (playing === id) stop()
    else play(id, buffer, start, end)
  }

  // ---------- 파일 추가 ----------
  async function addFiles(fileList) {
    const files = Array.from(fileList).filter(
      (f) => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac|opus)$/i.test(f.name),
    )
    if (!files.length) return
    setBusy('오디오 디코딩 중…')
    const ctx = getCtx()
    const added = []
    for (const f of files) {
      try {
        const arr = await f.arrayBuffer()
        const buffer = await ctx.decodeAudioData(arr)
        const dur = round3(buffer.duration)
        added.push({
          id: ++idRef.current,
          name: f.name,
          buffer,
          start: 0,
          end: dur,
          accent: ACCENTS[idRef.current % ACCENTS.length],
        })
      } catch (err) {
        console.error(err)
        alert(`'${f.name}' 을(를) 읽지 못했어요. 지원하지 않는 형식일 수 있어요.`)
      }
    }
    setTracks((t) => [...t, ...added])
    setBusy(null)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
  }

  // ---------- 트랙 조작 ----------
  function setSelection(id, s, e) {
    setTracks((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t
        const dur = t.buffer.duration
        let ns = clamp(s, 0, dur)
        let ne = clamp(e, 0, dur)
        if (ns > ne) [ns, ne] = [ne, ns]
        return { ...t, start: round3(ns), end: round3(ne) }
      }),
    )
  }
  const setStart = (id, v) =>
    setTracks((ts) =>
      ts.map((t) => (t.id === id ? { ...t, start: clamp(round3(v || 0), 0, t.end) } : t)),
    )
  const setEnd = (id, v) =>
    setTracks((ts) =>
      ts.map((t) =>
        t.id === id ? { ...t, end: clamp(round3(v || 0), t.start, t.buffer.duration) } : t,
      ),
    )
  const resetSel = (id) =>
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, start: 0, end: round3(t.buffer.duration) } : t)))

  function removeTrack(id) {
    if (playing === id) stop()
    setTracks((ts) => ts.filter((t) => t.id !== id))
  }

  function moveTrack(id, dir) {
    setTracks((ts) => {
      const i = ts.findIndex((t) => t.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= ts.length) return ts
      const copy = ts.slice()
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  // ---------- 자르기 / 합치기 ----------
  function cutAndDownload(t) {
    const out = sliceBuffer(getCtx(), t.buffer, t.start, t.end)
    downloadBlob(encodeWav(out), `${stripExt(t.name)}_${t.start.toFixed(3)}-${t.end.toFixed(3)}.wav`)
  }

  function previewResult(t) {
    const out = sliceBuffer(getCtx(), t.buffer, t.start, t.end)
    setResult({ buffer: out, name: `${stripExt(t.name)}_cut.wav` })
  }

  async function mergeTracks() {
    if (tracks.length < 1) return
    setBusy('합치는 중…')
    await new Promise((r) => setTimeout(r, 30))
    const ctx = getCtx()
    const bufs = tracks.map((t) => (useSelection ? sliceBuffer(ctx, t.buffer, t.start, t.end) : t.buffer))
    const out = concatBuffers(ctx, bufs)
    setResult({ buffer: out, name: `merged_${tracks.length}tracks.wav` })
    setBusy(null)
  }

  const totalDuration = tracks.reduce(
    (s, t) => s + (useSelection ? t.end - t.start : t.buffer.duration),
    0,
  )

  return (
    <div className="page">
      <div className="bg-orbs" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-3" />
      </div>

      <header className="header">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <Icon name="back" size={18} />
          </span>
          <span className="brand-text">
            노래 편집기<em>.audio</em>
          </span>
        </Link>
        <nav className="header-actions">
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="테마 전환"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
          </button>
        </nav>
      </header>

      <main className="container editor">
        <div className="editor-head">
          <h1 className="editor-title">
            <span className="gradient-text">노래 편집기</span>
          </h1>
          <p className="editor-sub">
            파일을 올려 파형에서 구간을 드래그하거나 숫자(소수 3자리·ms)로 정확히 자르고, 여러 곡을 순서대로
            이어 붙일 수 있어요. 모든 처리는 브라우저 안에서만 이뤄집니다.
          </p>
        </div>

        {/* 업로드 */}
        <div
          className={`dropzone ${dragOver ? 'is-over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <Icon name="upload" size={30} />
          <strong>노래 파일을 드래그하거나 클릭해서 추가</strong>
          <span>mp3 · wav · m4a · ogg · flac — 여러 개 한꺼번에 가능</span>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {busy && (
          <div className="busy">
            <span className="spinner" /> {busy}
          </div>
        )}

        {/* 트랙 목록 */}
        {tracks.map((t, i) => {
          const isPlaying = playing === t.id
          const selLen = t.end - t.start
          return (
            <div key={t.id} className="track" style={{ '--accent': t.accent }}>
              <div className="track-head">
                <span className="track-no">{i + 1}</span>
                <div className="track-meta">
                  <strong title={t.name}>{t.name}</strong>
                  <span>
                    길이 {formatTime(t.buffer.duration)} · {t.buffer.numberOfChannels === 1 ? '모노' : '스테레오'} ·{' '}
                    {(t.buffer.sampleRate / 1000).toFixed(1)}kHz
                  </span>
                </div>
                <div className="track-order">
                  <button className="mini-btn" onClick={() => moveTrack(t.id, -1)} disabled={i === 0} aria-label="위로">
                    <Icon name="up" size={16} />
                  </button>
                  <button
                    className="mini-btn"
                    onClick={() => moveTrack(t.id, 1)}
                    disabled={i === tracks.length - 1}
                    aria-label="아래로"
                  >
                    <Icon name="down" size={16} />
                  </button>
                  <button className="mini-btn danger" onClick={() => removeTrack(t.id)} aria-label="삭제">
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>

              <Waveform
                buffer={t.buffer}
                start={t.start}
                end={t.end}
                accent={t.accent}
                playhead={isPlaying ? pos : null}
                onChange={(s, e) => setSelection(t.id, s, e)}
              />

              <div className="track-controls">
                <label className="field">
                  <span>시작 (초)</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max={t.buffer.duration}
                    value={t.start}
                    onChange={(e) => setStart(t.id, parseFloat(e.target.value))}
                  />
                </label>
                <label className="field">
                  <span>끝 (초)</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max={t.buffer.duration}
                    value={t.end}
                    onChange={(e) => setEnd(t.id, parseFloat(e.target.value))}
                  />
                </label>
                <span className="sel-len">선택 {formatTime(Math.max(0, selLen))}</span>

                <div className="track-actions">
                  <button className="btn ghost" onClick={() => resetSel(t.id)}>
                    전체 선택
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => togglePlay(t.id, t.buffer, t.start, t.end)}
                  >
                    <Icon name={isPlaying ? 'pause' : 'play'} size={16} /> {isPlaying ? '정지' : '구간 재생'}
                  </button>
                  <button className="btn ghost" onClick={() => previewResult(t)}>
                    <Icon name="scissors" size={16} /> 결과로 보내기
                  </button>
                  <button className="btn" onClick={() => cutAndDownload(t)}>
                    <Icon name="download" size={16} /> 잘라서 저장
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {/* 합치기 */}
        {tracks.length >= 1 && (
          <div className="merge-bar">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={useSelection}
                onChange={(e) => setUseSelection(e.target.checked)}
              />
              <span>선택 구간만 사용 (체크 해제 시 곡 전체)</span>
            </label>
            <span className="merge-info">
              위 순서대로 이어붙이면 약 <strong>{formatTime(Math.max(0, totalDuration))}</strong>
            </span>
            <button className="btn big" onClick={mergeTracks} disabled={tracks.length < 2}>
              <Icon name="merge" size={18} /> {tracks.length}곡 합치기 → 결과 만들기
            </button>
          </div>
        )}

        {/* 결과 */}
        {result && (
          <div className="result" style={{ '--accent': '#22c55e' }}>
            <div className="result-head">
              <h2>
                <Icon name="wave" size={20} /> 결과
              </h2>
              <span>
                {formatTime(result.buffer.duration)} · WAV ·{' '}
                {result.buffer.numberOfChannels === 1 ? '모노' : '스테레오'}
              </span>
            </div>
            <Waveform
              buffer={result.buffer}
              start={0}
              end={result.buffer.duration}
              accent="#22c55e"
              readOnly
              playhead={playing === 'result' ? pos : null}
              onChange={() => {}}
            />
            <div className="result-actions">
              <button
                className="btn ghost"
                onClick={() => togglePlay('result', result.buffer, 0, result.buffer.duration)}
              >
                <Icon name={playing === 'result' ? 'pause' : 'play'} size={16} />{' '}
                {playing === 'result' ? '정지' : '재생'}
              </button>
              <button className="btn" onClick={() => downloadBlob(encodeWav(result.buffer), result.name)}>
                <Icon name="download" size={16} /> WAV 다운로드
              </button>
            </div>
          </div>
        )}

        {tracks.length === 0 && !busy && (
          <p className="hint">⬆️ 위에 노래를 추가하면 편집을 시작할 수 있어요.</p>
        )}
      </main>
    </div>
  )
}
