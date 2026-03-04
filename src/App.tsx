import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LayerPage } from './pages/LayerPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <Routes>
          <Route path="/" element={<LayerPage layerName="index" />} />
          <Route path="/:layerName" element={<LayerPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
