import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import AudioEditor from './pages/AudioEditor.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tools/audio-editor" element={<AudioEditor />} />
    </Routes>
  )
}
