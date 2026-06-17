import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import Waveform from '../components/Waveform.jsx'
import MixTimeline from '../components/MixTimeline.jsx'
import { useTheme } from '../theme.jsx'
import {
  renderRegion,
  concatBuffers,
  mixBuffersAt,
  encodeWav,
  encodeMp3,
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
  const [result, setResult] = useState(null) // { buffer, base }
  const [useSelection, setUseSelection] = useState(true)
  const [format, setFormat] = useState('mp3') // 'mp3' | 'wav'
  const [bitrate, setBitrate] = useState(192)
  const [busy, setBusy] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [playing, setPlaying] = useState(null) // 재생 중 id (또는 'result')
  const [pos, setPos] = useState(0)

  const getCtx = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext
      ctxRef.current = new AC()
    }
    return ctxRef.current
  }

  useEffect(() => () => stop(), [])

  // ---------- 재생 (볼륨/페이드 반영) ----------
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

  function play(id, opt) {
    const { buffer, start = 0, end = null, volume = 1, fadeIn = 0, fadeOut = 0 } = opt
    const ctx = getCtx()
    ctx.resume?.()
    stop()
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const gain = ctx.createGain()
    src.connect(gain)
    gain.connect(ctx.destination)

    const realEnd = end == null ? buffer.duration : end
    const dur = Math.max(0.01, realEnd - start)
    const now = ctx.currentTime
    const fi = clamp(fadeIn, 0, dur)
    const fo = clamp(fadeOut, 0, dur)
    const g = gain.gain
    g.cancelScheduledValues(now)
    if (fi > 0) {
      g.setValueAtTime(0.0001, now)
      g.linearRampToValueAtTime(volume, now + fi)
    } else {
      g.setValueAtTime(volume, now)
    }
    if (fo > 0) {
      g.setValueAtTime(volume, now + Math.max(0, dur - fo))
      g.linearRampToValueAtTime(0.0001, now + dur)
    }

    src.start(0, start, dur)
    srcRef.current = src
    setPlaying(id)
    setPos(start)
    src.onended = () => stop()
    const t0 = ctx.currentTime
    const tick = () => {
      const el = ctx.currentTime - t0
      setPos(start + el)
      if (el < dur) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const trackOpts = (t) => ({
    buffer: t.buffer,
    start: t.start,
    end: t.end,
    volume: t.volume,
    fadeIn: t.fadeIn,
    fadeOut: t.fadeOut,
  })

  function toggleTrackPlay(t) {
    if (playing === t.id) stop()
    else play(t.id, trackOpts(t))
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
        added.push({
          id: ++idRef.current,
          name: f.name,
          buffer,
          start: 0,
          end: round3(buffer.duration),
          volume: 1,
          fadeIn: 0,
          fadeOut: 0,
          offset: 0,
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
  const patch = (id, fields) =>
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, ...fields } : t)))

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
  const setStart = (id, v, t) => patch(id, { start: clamp(round3(v || 0), 0, t.end) })
  const setEnd = (id, v, t) => patch(id, { end: clamp(round3(v || 0), t.start, t.buffer.duration) })
  const resetSel = (t) => patch(t.id, { start: 0, end: round3(t.buffer.duration) })
  const setFade = (id, key, v, selLen) => patch(id, { [key]: clamp(round3(v || 0), 0, selLen) })

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

  // ---------- 내보내기 ----------
  function renderTrackBuffer(t, whole) {
    return renderRegion(getCtx(), t.buffer, {
      start: whole ? 0 : t.start,
      end: whole ? t.buffer.duration : t.end,
      volume: t.volume,
      fadeIn: t.fadeIn,
      fadeOut: t.fadeOut,
    })
  }

  async function exportBuffer(buffer, base) {
    if (format === 'mp3') {
      setBusy('MP3 인코딩 중…')
      await new Promise((r) => setTimeout(r, 30))
      downloadBlob(await encodeMp3(buffer, bitrate), `${base}.mp3`)
      setBusy(null)
    } else {
      downloadBlob(encodeWav(buffer), `${base}.wav`)
    }
  }

  function cutTrack(t) {
    exportBuffer(renderTrackBuffer(t, false), `${stripExt(t.name)}_${t.start.toFixed(3)}-${t.end.toFixed(3)}`)
  }
  function sendToResult(t) {
    setResult({ buffer: renderTrackBuffer(t, false), base: `${stripExt(t.name)}_cut` })
  }

  async function combine(mode) {
    if (tracks.length < 2) return
    setBusy(mode === 'mix' ? '겹치는 중…' : '이어붙이는 중…')
    await new Promise((r) => setTimeout(r, 30))
    const ctx = getCtx()
    let out
    if (mode === 'mix') {
      const items = tracks.map((t) => ({ buffer: renderTrackBuffer(t, !useSelection), offset: t.offset }))
      out = mixBuffersAt(ctx, items)
    } else {
      out = concatBuffers(ctx, tracks.map((t) => renderTrackBuffer(t, !useSelection)))
    }
    setResult({ buffer: out, base: `${mode === 'mix' ? 'overlay' : 'merged'}_${tracks.length}tracks` })
    setBusy(null)
  }

  // 믹스에 들어가는 클립 길이(초)
  const clipLen = (t) => (useSelection ? t.end - t.start : t.buffer.duration)
  const totalDuration = tracks.reduce((s, t) => s + clipLen(t), 0)
  const mixDuration = tracks.reduce((m, t) => Math.max(m, t.offset + clipLen(t)), 0)

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
            파일을 올려 구간을 자르고(ms 단위), 볼륨·페이드를 조절하고, 여러 곡을 이어붙이거나 겹쳐서
            MP3·WAV로 저장하세요. 모든 처리는 브라우저 안에서만 이뤄집니다.
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

        {/* 내보내기 형식 */}
        {tracks.length > 0 && (
          <div className="toolbar">
            <span className="toolbar-label">내보내기 형식</span>
            <div className="seg">
              <button className={format === 'mp3' ? 'on' : ''} onClick={() => setFormat('mp3')}>
                MP3
              </button>
              <button className={format === 'wav' ? 'on' : ''} onClick={() => setFormat('wav')}>
                WAV
              </button>
            </div>
            {format === 'mp3' && (
              <label className="bitrate">
                품질
                <select value={bitrate} onChange={(e) => setBitrate(Number(e.target.value))}>
                  <option value={128}>128 kbps</option>
                  <option value={192}>192 kbps</option>
                  <option value={256}>256 kbps</option>
                  <option value={320}>320 kbps</option>
                </select>
              </label>
            )}
          </div>
        )}

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
                    길이 {formatTime(t.buffer.duration)} ·{' '}
                    {t.buffer.numberOfChannels === 1 ? '모노' : '스테레오'} ·{' '}
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
                    onChange={(e) => setStart(t.id, parseFloat(e.target.value), t)}
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
                    onChange={(e) => setEnd(t.id, parseFloat(e.target.value), t)}
                  />
                </label>
                <span className="sel-len">선택 {formatTime(Math.max(0, selLen))}</span>
                <div className="track-actions">
                  <button className="btn ghost" onClick={() => resetSel(t)}>
                    전체 선택
                  </button>
                  <button className="btn ghost" onClick={() => toggleTrackPlay(t)}>
                    <Icon name={isPlaying ? 'pause' : 'play'} size={16} /> {isPlaying ? '정지' : '구간 재생'}
                  </button>
                  <button className="btn ghost" onClick={() => sendToResult(t)}>
                    <Icon name="scissors" size={16} /> 결과로 보내기
                  </button>
                  <button className="btn" onClick={() => cutTrack(t)}>
                    <Icon name="download" size={16} /> 잘라서 저장
                  </button>
                </div>
              </div>

              {/* 볼륨 · 페이드 */}
              <div className="track-fx">
                <label className="fx fx-vol">
                  <span>
                    볼륨 <b>{Math.round(t.volume * 100)}%</b>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={t.volume}
                    onChange={(e) => patch(t.id, { volume: Number(e.target.value) })}
                  />
                </label>
                <label className="field">
                  <span>페이드 인 (초)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={selLen}
                    value={t.fadeIn}
                    onChange={(e) => setFade(t.id, 'fadeIn', parseFloat(e.target.value), selLen)}
                  />
                </label>
                <label className="field">
                  <span>페이드 아웃 (초)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={selLen}
                    value={t.fadeOut}
                    onChange={(e) => setFade(t.id, 'fadeOut', parseFloat(e.target.value), selLen)}
                  />
                </label>
              </div>
            </div>
          )
        })}

        {/* 합치기 / 겹치기 */}
        {tracks.length >= 2 && (
          <>
            <div className="merge-bar">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={useSelection}
                  onChange={(e) => setUseSelection(e.target.checked)}
                />
                <span>선택 구간만 사용 (해제 시 곡 전체)</span>
              </label>
              <button className="btn ghost big" onClick={() => combine('concat')}>
                <Icon name="merge" size={18} /> 이어붙이기 ({formatTime(Math.max(0, totalDuration))})
              </button>
            </div>

            <div className="mix-section">
              <div className="mix-head">
                <h3>
                  <Icon name="layers" size={18} /> 겹치기 — 각 트랙 시작 위치
                </h3>
                <span>블록을 드래그하거나 왼쪽 숫자(초·ms)로 위치를 맞추세요</span>
              </div>
              <MixTimeline
                tracks={tracks}
                clipLen={clipLen}
                offsetOf={(t) => t.offset}
                onOffset={(id, v) => patch(id, { offset: v })}
              />
              <div className="mix-foot">
                <span className="merge-info">
                  믹스 길이 약 <strong>{formatTime(Math.max(0, mixDuration))}</strong>
                </span>
                <button className="btn big" onClick={() => combine('mix')}>
                  <Icon name="layers" size={18} /> 겹쳐서 결과 만들기
                </button>
              </div>
            </div>
          </>
        )}

        {/* 결과 */}
        {result && (
          <div className="result" style={{ '--accent': '#22c55e' }}>
            <div className="result-head">
              <h2>
                <Icon name="wave" size={20} /> 결과
              </h2>
              <span>
                {formatTime(result.buffer.duration)} ·{' '}
                {result.buffer.numberOfChannels === 1 ? '모노' : '스테레오'} ·{' '}
                {format.toUpperCase()}
                {format === 'mp3' ? ` ${bitrate}k` : ''}
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
                onClick={() =>
                  playing === 'result'
                    ? stop()
                    : play('result', { buffer: result.buffer, start: 0, end: result.buffer.duration })
                }
              >
                <Icon name={playing === 'result' ? 'pause' : 'play'} size={16} />{' '}
                {playing === 'result' ? '정지' : '재생'}
              </button>
              <button className="btn" onClick={() => exportBuffer(result.buffer, result.base)}>
                <Icon name="download" size={16} /> {format.toUpperCase()} 다운로드
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
