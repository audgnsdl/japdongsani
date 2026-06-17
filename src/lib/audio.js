// 브라우저 Web Audio API 기반 오디오 처리 유틸
// (MP3 인코더는 용량이 커서 실제 내보낼 때 동적 import로 불러옵니다)

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

// 구간을 자른 뒤 볼륨·페이드를 적용한 새 버퍼를 반환.
// opts: { start, end, volume=1, fadeIn=0, fadeOut=0 } (초 단위)
export function renderRegion(ctx, buffer, opts) {
  const { start, end, volume = 1, fadeIn = 0, fadeOut = 0 } = opts
  const out = sliceBuffer(ctx, buffer, start, end)
  const sr = out.sampleRate
  const len = out.length
  const fiN = Math.min(len, Math.max(0, Math.floor(fadeIn * sr)))
  const foN = Math.min(len, Math.max(0, Math.floor(fadeOut * sr)))
  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const data = out.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      let g = volume
      if (fiN > 0 && i < fiN) g *= i / fiN // 페이드 인 (선형)
      if (foN > 0 && i >= len - foN) g *= (len - i) / foN // 페이드 아웃
      data[i] *= g
    }
  }
  return out
}

// 여러 버퍼를 동시에 겹쳐 믹스. 길이는 가장 긴 트랙 기준.
// normalize: 합산 결과가 ±1을 넘으면 전체를 줄여 클리핑(찢어짐)을 방지.
export function mixBuffers(ctx, buffers, { normalize = true } = {}) {
  const list = buffers.filter(Boolean)
  if (!list.length) return null
  const numCh = Math.max(...list.map((b) => b.numberOfChannels))
  const sr = list[0].sampleRate
  const maxLen = Math.max(...list.map((b) => b.length))
  const out = ctx.createBuffer(numCh, Math.max(1, maxLen), sr)
  let peak = 0
  for (let ch = 0; ch < numCh; ch++) {
    const od = out.getChannelData(ch)
    for (const b of list) {
      const srcCh = ch < b.numberOfChannels ? ch : 0
      const sd = b.getChannelData(srcCh)
      for (let i = 0; i < sd.length; i++) od[i] += sd[i]
    }
    for (let i = 0; i < od.length; i++) {
      const a = Math.abs(od[i])
      if (a > peak) peak = a
    }
  }
  if (normalize && peak > 1) {
    const scale = 1 / peak
    for (let ch = 0; ch < numCh; ch++) {
      const od = out.getChannelData(ch)
      for (let i = 0; i < od.length; i++) od[i] *= scale
    }
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

// Float32 샘플 → Int16Array
function floatToInt16(input) {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

// AudioBuffer → MP3 Blob (lamejs). kbps: 128 / 192 / 320 등
export async function encodeMp3(buffer, kbps = 192) {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const numCh = Math.min(2, buffer.numberOfChannels)
  const sr = buffer.sampleRate
  const enc = new Mp3Encoder(numCh, sr, kbps)
  const left = floatToInt16(buffer.getChannelData(0))
  const right = numCh > 1 ? floatToInt16(buffer.getChannelData(1)) : null
  const blockSize = 1152
  const chunks = []
  for (let i = 0; i < left.length; i += blockSize) {
    const l = left.subarray(i, i + blockSize)
    const buf = right
      ? enc.encodeBuffer(l, right.subarray(i, i + blockSize))
      : enc.encodeBuffer(l)
    if (buf.length) chunks.push(new Uint8Array(buf))
  }
  const end = enc.flush()
  if (end.length) chunks.push(new Uint8Array(end))
  return new Blob(chunks, { type: 'audio/mpeg' })
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
