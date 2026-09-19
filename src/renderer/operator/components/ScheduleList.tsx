import { useOperator } from '../store'
import { XIcon } from './icons'

export function ScheduleList() {
  const schedule = useOperator((s) => s.schedule)
  const stagedEntryId = useOperator((s) => s.stagedEntryId)
  const liveEntryId = useOperator((s) => s.liveEntryId)
  const setStaged = useOperator((s) => s.setStaged)
  const goLive = useOperator((s) => s.goLive)
  const removeFromSchedule = useOperator((s) => s.removeFromSchedule)
  const clearSchedule = useOperator((s) => s.clearSchedule)

  return (
    <>
      <div className="panel-head">
        <div>
          <div className="panel-title">Schedule</div>
          <div className="panel-sub">
            {schedule.length} ITEM{schedule.length === 1 ? '' : 'S'}
          </div>
        </div>
        <button className="text-link" onClick={clearSchedule}>
          Clear
        </button>
      </div>
      <div className="schedule-hint">Click to preview · double-click to go live</div>
      <div className="schedule-list">
        {schedule.length === 0 && (
          <div className="schedule-empty">
            Nothing scheduled yet.
            <br />
            Add verses from the browser below.
          </div>
        )}
        {schedule.map((entry) => (
          <div
            key={entry.id}
            className={`sched-item${
              liveEntryId === entry.id
                ? ' active-live'
                : stagedEntryId === entry.id
                  ? ' active-preview'
                  : ''
            }`}
            onClick={() => setStaged(entry.slide, entry.id)}
            onDoubleClick={() => {
              setStaged(entry.slide, entry.id)
              goLive()
            }}
            title="Click to preview · double-click to go live"
          >
            <div className="sched-order">{String(entry.order).padStart(2, '0')}</div>
            <div className="sched-main">
              <div className="sched-ref">{entry.slide.label}</div>
              <div className="sched-src">{entry.src}</div>
            </div>
            <button
              className="sched-remove"
              title="Remove"
              aria-label="remove"
              onClick={(e) => {
                e.stopPropagation()
                removeFromSchedule(entry.id)
              }}
            >
              <XIcon />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}