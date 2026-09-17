import { useOperator, formatVerseNum } from '../store'

export function Filmstrip() {
  const verseData = useOperator((s) => s.verseData)
  const stagedVerse = useOperator((s) => s.stagedVerse)
  const liveVerseNum = useOperator((s) => s.liveVerseNum)
  const lastChapter = useOperator((s) => s.lastChapter)
  const verseCount = useOperator((s) => s.verseCount)
  const stageVerse = useOperator((s) => s.stageVerse)

  const verses = Object.values(verseData).sort((a, b) => a.n - b.n)

  return (
    <div className="filmstrip-wrap">
      <div className="filmstrip-label">
        <span className="chap">
          {lastChapter ? `${lastChapter.book} ${lastChapter.chapter}` : ''}
        </span>
        <span>{verseCount} verses</span>
      </div>
      <div className="filmstrip">
        {verses.map((v) => {
          const isLive = v.n === liveVerseNum
          const isStaged = !isLive && v.n === stagedVerse?.n
          return (
            <div
              key={v.n}
              data-vnum={v.n}
              className={
                'vcard' + (isLive ? ' is-live' : '') + (isStaged ? ' is-staged' : '')
              }
              onClick={() => stageVerse(v.n)}
            >
              <div className="vnum">
                {formatVerseNum(v.n, v.endVerse)}
                {isLive ? ' · live' : ''}
              </div>
              <div className="vtext">{v.text}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}