import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 깃 저장소 이름에 맞춰 base 경로를 바꾸면 GitHub Pages 배포가 쉬워집니다.
// 예) 저장소가 https://user.github.io/japdongsani 라면 base: '/japdongsani/'
export default defineConfig({
  plugins: [react()],
  base: './',
})
