import { useEffect, useRef } from 'react'
import { useOperator } from '../store'
import { api } from '../api'
import { findBook } from '../../../lib/detection/books'
import type { BookRef } from '../../../shared/types'

type SearchPhase = 'book' | 'chapter' | 'verse'

// EasyWorship-style autocomplete: book → chapter → verse, with Space
// transitioning between phases. Typing invalid chapter/verse numbers is
// silently rejected. Caret/selection handling stays imperative via refs.
export function LibrarySearchInput({ hidden }: { hidden?: boolean }) {
  const currentTranslation = useOperator((s) => s.currentTranslation)
  const loadAndStage = useOperator((s) => s.loadAndStage)

  const inputRef = useRef<HTMLInputElement>(null)
  const booksRef = useRef<BookRef[]>([])
  const phaseRef = useRef<SearchPhase>('book')
  const bookNameRef = useRef('')
  const chapterRef = useRef('')
  const verseRef = useRef('')
  const maxVerseRef = useRef(0)
  const supRef = useRef(false)
  const deletingRef = useRef(false)

  useEffect(() => {
    booksRef.current = []
  }, [currentTranslation])

  function setInput(v: string) {
    supRef.current = true
    if (inputRef.current) inputRef.current.value = v
    supRef.current = false
  }

  function resetSearch() {
    phaseRef.current = 'book'
    bookNameRef.current = ''
    chapterRef.current = ''
    verseRef.current = ''
    maxVerseRef.current = 0
  }

  async function ensureBooks() {
    if (booksRef.current.length === 0) {
      booksRef.current = await api.getBookList(currentTranslation)
    }
  }

  function commitSearch() {
    const ch = parseInt(chapterRef.current || '1', 10)
    const vs = parseInt(verseRef.current || '1', 10)
    if (!bookNameRef.current) return
    const book = booksRef.current.find((b) => b.name === bookNameRef.current)
    if (!book || ch < 1 || ch > book.chapters) {
      resetSearch()
      return
    }
    if (verseRef.current) {
      api
        .getChapter(bookNameRef.current, ch, currentTranslation)
        .then((verses) => {
          if (!verses.find((v) => v.verse <= vs && vs <= (v.endVerse ?? v.verse))) {
            resetSearch()
            return
          }
          loadAndStage(bookNameRef.current, ch, vs)
          resetSearch()
        })
        .catch(() => resetSearch())
    } else {
      loadAndStage(bookNameRef.current, ch, vs)
      resetSearch()
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === ' ') {
      e.preventDefault()
      if (phaseRef.current === 'book' && bookNameRef.current) {
        phaseRef.current = 'chapter'
        setInput(bookNameRef.current + ' ')
        return
      }
      if (phaseRef.current === 'chapter' && chapterRef.current) {
        const ch = parseInt(chapterRef.current, 10)
        const book = booksRef.current.find((b) => b.name === bookNameRef.current)
        if (!book || ch < 1 || ch > book.chapters) return
        maxVerseRef.current = 0
        api
          .getChapter(bookNameRef.current, ch, currentTranslation)
          .then((verses) => {
            maxVerseRef.current = verses.reduce(
              (max, v) => Math.max(max, v.endVerse ?? v.verse),
              0,
            )
          })
          .catch(() => {})
        phaseRef.current = 'verse'
        setInput(bookNameRef.current + ' ' + chapterRef.current + ':')
        return
      }
      if (phaseRef.current === 'verse' && verseRef.current) {
        commitSearch()
        setInput('')
        return
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      commitSearch()
      setInput('')
      return
    }
    if (e.key === 'Backspace') {
      if (phaseRef.current === 'verse' && !verseRef.current && chapterRef.current) {
        phaseRef.current = 'chapter'
        setInput(bookNameRef.current + ' ' + chapterRef.current)
        return
      }
      if (phaseRef.current === 'chapter' && !chapterRef.current && bookNameRef.current) {
        phaseRef.current = 'book'
        setInput(bookNameRef.current)
        return
      }
      deletingRef.current = true
    }
  }

  function onInput(e: React.FormEvent<HTMLInputElement>) {
    if (supRef.current) return
    const el = e.currentTarget
    const val = el.value

    if (phaseRef.current === 'book') {
      const letters = val.replace(/[^a-zA-Z0-9\s]/g, '').trim()
      if (!letters) {
        bookNameRef.current = ''
        return
      }
      const book = findBook(letters, booksRef.current)
      if (!book) {
        const prev = bookNameRef.current || ''
        setInput(prev)
        if (prev && letters.length > 1) {
          const pc = Math.min(letters.length - 1, prev.length)
          inputRef.current?.setSelectionRange(pc, prev.length)
        }
        return
      }
      bookNameRef.current = book.name
      if (deletingRef.current) {
        deletingRef.current = false
        return
      }
      const completed = book.name.slice(letters.length)
      if (completed) {
        setInput(book.name)
        inputRef.current?.setSelectionRange(letters.length, book.name.length)
      } else {
        setInput(book.name)
        inputRef.current?.setSelectionRange(book.name.length, book.name.length)
      }
      return
    }

    if (phaseRef.current === 'chapter') {
      const digits = val.replace(/[^\d]/g, '')
      if (digits) {
        const ch = parseInt(digits, 10)
        const book = booksRef.current.find((b) => b.name === bookNameRef.current)
        if (book && ch > book.chapters) {
          chapterRef.current = digits.slice(0, -1)
        } else {
          chapterRef.current = digits
        }
      } else {
        chapterRef.current = ''
      }
      setInput(bookNameRef.current + ' ' + chapterRef.current)
      const len = inputRef.current?.value.length ?? 0
      inputRef.current?.setSelectionRange(len, len)
      return
    }

    if (phaseRef.current === 'verse') {
      const prefix = bookNameRef.current + ' ' + chapterRef.current + ':'
      const digits = val.slice(prefix.length).replace(/[^\d]/g, '')
      if (digits && maxVerseRef.current > 0) {
        const vs = parseInt(digits, 10)
        verseRef.current = vs > maxVerseRef.current ? digits.slice(0, -1) : digits
      } else {
        verseRef.current = digits
      }
      setInput(prefix + verseRef.current)
      const len = inputRef.current?.value.length ?? 0
      inputRef.current?.setSelectionRange(len, len)
      return
    }
  }

  return (
    <div className={'lib-search' + (hidden ? ' hide' : '')}>
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        placeholder="Reference only — e.g. John 3:16"
        onFocus={ensureBooks}
        onKeyDown={onKeyDown}
        onInput={onInput}
      />
    </div>
  )
}