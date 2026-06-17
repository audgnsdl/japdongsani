// 외부 의존성 없이 쓰는 라인 아이콘 세트.
// 새 아이콘이 필요하면 paths에 한 줄 추가하세요.

const paths = {
  swap: <path d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3" />,
  text: <path d="M4 6h16M4 12h16M4 18h10" />,
  palette: (
    <>
      <path d="M12 21a9 9 0 1 1 9-9c0 1.66-1.34 3-3 3h-1.5a1.5 1.5 0 0 0-1.06 2.56A1.5 1.5 0 0 1 12 21Z" />
      <circle cx="7.5" cy="10.5" r="1" />
      <circle cx="12" cy="7.5" r="1" />
      <circle cx="16.5" cy="10.5" r="1" />
    </>
  ),
  braces: <path d="M8 4c-2 0-2 2-2 4 0 1.5-1 2-2 2 1 0 2 .5 2 2 0 2 0 4 2 4M16 4c2 0 2 2 2 4 0 1.5 1 2 2 2-1 0-2 .5-2 2 0 2 0 4-2 4" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  note: (
    <>
      <path d="M5 4h14v11l-5 5H5z" />
      <path d="M14 20v-5h5" />
    </>
  ),
  qr: (
    <>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
      <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="M11 11l9 9m-3 0 2-2m-5-2 2-2" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="15" cy="15" r="1" />
      <circle cx="15" cy="9" r="1" />
      <circle cx="9" cy="15" r="1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </>
  ),
  moon: <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z" />,
  github: (
    <path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  ),
  arrow: <path d="M5 12h14m0 0-5-5m5 5-5 5" />,
}

export default function Icon({ name, size = 24, strokeWidth = 1.75, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name] ?? null}
    </svg>
  )
}
