import { useEffect, useMemo, useState } from 'react'
import Icon from './components/Icon.jsx'
import { tools, categories } from './data/tools.js'

const GITHUB_URL = 'https://github.com/' // 본인 저장소 주소로 바꿔주세요

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('jds-theme')
    if (saved) return saved
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('jds-theme', theme)
  }, [theme])
  return [theme, setTheme]
}

export default function App() {
  const [theme, setTheme] = useTheme()
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tools.filter((t) => {
      const matchCat = activeCat === 'all' || t.category === activeCat
      const matchQuery =
        !q || t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
      return matchCat && matchQuery
    })
  }, [query, activeCat])

  const readyCount = tools.filter((t) => t.status === 'ready').length

  return (
    <div className="page">
      <div className="bg-orbs" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
      </div>

      <header className="header">
        <a className="brand" href="#top">
          <span className="brand-mark">🧰</span>
          <span className="brand-text">
            잡동사니<em>.toolbox</em>
          </span>
        </a>
        <nav className="header-actions">
          <a className="icon-btn" href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="GitHub">
            <Icon name="github" size={20} />
          </a>
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="테마 전환"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
          </button>
        </nav>
      </header>

      <main id="top" className="container">
        <section className="hero">
          <span className="badge">
            <span className="dot" /> {tools.length}개의 잡동사니 · {readyCount}개 사용 가능
          </span>
          <h1 className="title">
            필요할 때 꺼내 쓰는<br />
            <span className="gradient-text">작은 도구들</span>
          </h1>
          <p className="subtitle">
            계산기, 변환기, 메모… 자잘하지만 손에 익으면 편한 미니 도구들을 한곳에 모았어요.
          </p>

          <div className="search">
            <Icon name="search" size={20} className="search-icon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="도구 검색… (예: 변환, 메모, JSON)"
              aria-label="도구 검색"
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')} aria-label="검색어 지우기">
                ✕
              </button>
            )}
          </div>

          <div className="chips">
            {categories.map((c) => (
              <button
                key={c.key}
                className={`chip ${activeCat === c.key ? 'is-active' : ''}`}
                onClick={() => setActiveCat(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid" aria-live="polite">
          {filtered.map((t) => (
            <a
              key={t.id}
              className={`card ${t.status === 'soon' ? 'is-soon' : ''}`}
              href={t.status === 'soon' ? undefined : t.href}
              style={{ '--accent': t.accent }}
            >
              <div className="card-top">
                <span className="card-icon">
                  <Icon name={t.icon} size={24} />
                </span>
                {t.status === 'soon' ? (
                  <span className="tag tag-soon">준비중</span>
                ) : (
                  <span className="tag">열기 <Icon name="arrow" size={14} /></span>
                )}
              </div>
              <h3 className="card-title">{t.title}</h3>
              <p className="card-desc">{t.desc}</p>
              <span className="card-cat">
                #{categories.find((c) => c.key === t.category)?.label ?? t.category}
              </span>
            </a>
          ))}

          {filtered.length === 0 && (
            <div className="empty">
              <span className="empty-emoji">🗃️</span>
              <p>‘{query}’에 맞는 도구가 아직 없어요.</p>
              <button className="chip is-active" onClick={() => { setQuery(''); setActiveCat('all') }}>
                전체 보기
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>🧰 잡동사니 · 필요한 건 직접 만들어 쓰는 중</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">소스 보기 →</a>
      </footer>
    </div>
  )
}
