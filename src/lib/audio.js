// 브라우저 Web Audio API 기반 오디오 처리 유틸 (외부 의존성 없음)

export const round3 = (n) => Math.round(n * 1000) / 1000
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

// 초 → "m:ss.mmm" 표기
export function formatTime(sec) {
  if (!isFinite(sec)) return '0:00.000'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.round((sec - Math.floor(sec)) * 1000)
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

// 파형 그리기용 진폭 피크 추출 (길이 width)
export function computePeaks(buffer, width) {
  const ch0 = buffer.getChannelData(0)
  const step = Math.max(1, Math.floor(ch0.length / width))
  const peaks = new Float32Array(width)
  for (let i = 0; i < width; i++) {
    let peak = 0
    const start = i * step
    for (let j = 0; j < step; j++) {
      const v = Math.abs(ch0[start + j] || 0)
      if (v > peak) peak = v
    }
    peaks[i] = peak
  }
  return peaks
}

// [start, end] 구간만 잘라 새 AudioBuffer 반환
export function sliceBuffer(ctx, buffer, start, end) {
  const sr = buffer.sampleRate
  const s = clamp(Math.floor(start * sr), 0, buffer.length)
  const e = clamp(Math.floor(end * sr), s, buffer.length)
  const len = Math.max(1, e - s)
  const out = ctx.createBuffer(buffer.numberOfChannels, len, sr)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    out.getChannelData(ch).set(buffer.getChannelData(ch).subarray(s, e))
  }
  return out
}

// 여러 버퍼를 순서대로 이어붙임. 모노/스테레오가 섞여 있으면 최대 채널 수에 맞춤.
export function concatBuffers(ctx, buffers) {
  const list = buffers.filter(Boolean)
  if (!list.length) return null
  const numCh = Math.max(...list.map((b) => b.numberOfChannels))
  const sr = list[0].sampleRate
  const totalLen = list.reduce((sum, b) => sum + b.length, 0)
  const out = ctx.createBuffer(numCh, Math.max(1, totalLen), sr)
  let offset = 0
  for (const b of list) {
    for (let ch = 0; ch < numCh; ch++) {
      // 모노 소스를 다채널 출력에 넣을 땐 0번 채널을 복제
      const srcCh = ch < b.numberOfChannels ? ch : 0
      out.getChannelData(ch).set(b.getChannelData(srcCh), offset)
    }
    offset += b.length
  }
  return out
}

// AudioBuffer → 16bit PCM WAV Blob
export function encodeWav(buffer) {
  const numCh = buffer.numberOfChannels
  const sr = buffer.sampleRate
  const len = buffer.length
  const blockAlign = numCh * 2
  const dataSize = len * blockAlign
  const ab = new ArrayBuffer(44 + dataSize)
  const view = new DataView(ab)
  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numCh, true)
  view.setUint32(24, sr, true)
  view.setUint32(28, sr * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  const channels = []
  for (let ch = 0; ch < numCh; ch++) channels.push(buffer.getChannelData(ch))
  let offset = 44
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let s = Math.max(-1, Math.min(1, channels[ch][i]))
      s = s < 0 ? s * 0x8000 : s * 0x7fff
      view.setInt16(offset, s, true)
      offset += 2
    }
  }
  return new Blob([view], { type: 'audio/wav' })
}

// hex 색상에 알파 적용
export function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// Blob 다운로드 트리거
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
