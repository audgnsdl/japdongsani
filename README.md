# 🧰 잡동사니 (Japdongsani) · Toolbox

필요할 때 꺼내 쓰는 작은 미니 도구들을 한곳에 모아두는 웹 프로젝트입니다.
메인 페이지는 도구들을 카드 형태로 보여주는 허브이고, 도구는 하나씩 추가해 나갑니다.

## ✨ 특징

- 최신 UI 트렌드 반영: 다크/라이트 테마, 글래스모피즘 헤더, 그라데이션 오브 배경, 호버 인터랙션
- 실시간 검색 + 카테고리 필터
- 도구 목록을 데이터로 관리 → 한 줄 추가로 카드 생성
- 외부 UI 라이브러리 의존성 없음 (아이콘까지 인라인 SVG)

## 🚀 시작하기

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 빌드 → dist/
npm run preview  # 빌드 결과 미리보기
```

> Node 16 호환을 위해 Vite 4 / React 18로 구성했습니다.

## 🧩 새 도구 추가하기

`src/data/tools.js`의 `tools` 배열에 항목을 추가하면 메인 페이지에 카드가 자동으로 생깁니다.

```js
{
  id: 'my-tool',
  title: '도구 이름',
  desc: '한 줄 설명',
  category: 'convert',      // categories의 key 중 하나
  icon: 'swap',             // src/components/Icon.jsx의 아이콘 이름
  accent: '#6366f1',        // 카드 포인트 색상
  status: 'ready',          // 'ready'(완성) | 'soon'(준비중)
  href: '/tools/my-tool',   // 도구 페이지 경로
}
```

## 📦 폴더 구조

```
src/
├─ components/Icon.jsx   # 인라인 SVG 아이콘 세트
├─ data/tools.js         # 도구 & 카테고리 목록
├─ App.jsx               # 메인 허브 페이지
├─ index.css             # 디자인 시스템 + 스타일
└─ main.jsx              # 엔트리
```

## 🌐 GitHub Pages 배포 메모

`vite.config.js`의 `base`를 저장소 경로에 맞게 바꾼 뒤 `dist/`를 배포하세요.
