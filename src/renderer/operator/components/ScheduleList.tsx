import { useOperator } from '../store'
import { MusicIcon, PlusIcon, ScriptureIcon, SlidesIcon } from './icons'
import type { ScheduleIcon } from '../types'

const ICONS: Record<ScheduleIcon, typeof MusicIcon> = {
  music: MusicIcon,
  scripture: ScriptureIcon,
  slides: SlidesIcon,
}

export function ScheduleList() {
  const schedule = useOperator((s) => s.schedule)
  const activeId = useOperator((s) => s.activeScheduleId)
  const scheduleTitle = useOperator((s) => s.scheduleTitle)
  const addSchedule = useOperator((s) => s.addSchedule)
  const selectSchedule = useOperator((s) => s.selectSchedule)

  return (
    <>
      <div className="panel-head">
        <span className="panel-title">{scheduleTitle}</span>
        <div className="add-btn" onClick={addSchedule}>
          <PlusIcon />
        </div>
      </div>
      <div className="schedule-list">
        {schedule.map((item) => {
          const Icon = ICONS[item.icon]
          const classes = [
            'sched-item',
            activeId === item.id ? 'active' : '',
            item.live ? 'is-live' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <div key={item.id} className={classes} onClick={() => selectSchedule(item.id)}>
              <div className="sched-icon">
                <Icon />
              </div>
              <div className="sched-body">
                <div className="sched-name">{item.name}</div>
                <div className="sched-sub">{item.sub}</div>
              </div>
              {item.live && <span className="sched-live-tag">LIVE</span>}
            </div>
          )
        })}
      </div>
    </>
  )
}