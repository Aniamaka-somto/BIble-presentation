import { useRef } from 'react'
import { useOperator } from '../store'
import { bgUrl } from '../api'
import { ImageIcon } from './icons'
import type { BackgroundItem } from '../../../shared/types'

function BgCard({ item }: { item: BackgroundItem }) {
  const active = useOperator((s) => s.activeBackground?.fileName === item.fileName)
  const selectBackground = useOperator((s) => s.selectBackground)
  const deleteBackground = useOperator((s) => s.deleteBackground)
  const videoRef = useRef<HTMLVideoElement>(null)

  return (
    <div
      className={'bg-card' + (active ? ' active' : '')}
      onClick={() => selectBackground({ type: item.type, fileName: item.fileName })}
      onMouseEnter={() => videoRef.current?.play().catch(() => {})}
      onMouseLeave={() => {
        if (videoRef.current) {
          videoRef.current.pause()
          videoRef.current.currentTime = 0
        }
      }}
    >
      {item.type === 'video' ? (
        <video ref={videoRef} src={bgUrl(item.fileName)} muted loop playsInline preload="metadata" />
      ) : (
        <img src={bgUrl(item.fileName)} loading="lazy" />
      )}
      <span className="bg-card-name">{item.name}</span>
      <button
        className="bg-card-del"
        onClick={(e) => {
          e.stopPropagation()
          deleteBackground(item.id)
        }}
      >
        ×
      </button>
    </div>
  )
}

export function BackgroundManager() {
  const activeTab = useOperator((s) => s.activeTab)
  const backgrounds = useOperator((s) => s.backgrounds)
  const addBackground = useOperator((s) => s.addBackground)

  return (
    <div className={'bg-manager' + (activeTab === 'themes' ? ' show' : '')}>
      <div className="bg-header">
        <h3>Backgrounds</h3>
        <button className="bg-add-btn" onClick={addBackground}>
          + Add Background
        </button>
      </div>
      <div className="bg-grid">
        {backgrounds.length === 0 ? (
          <div className="bg-empty">
            <ImageIcon />
            No backgrounds yet.
            <br />
            Click "+ Add Background" to import images or videos.
          </div>
        ) : (
          backgrounds.map((b) => <BgCard key={b.id} item={b} />)
        )}
      </div>
    </div>
  )
}