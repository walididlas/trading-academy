import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CURRICULUM } from '../data/curriculum'
import { useProgress } from '../hooks/useProgress'
import { Diagram } from '../components/Diagrams'

// ── Content block renderers ───────────────────────────────────────────────────
function TextBlock({ content }) {
  // Render \n\n as paragraph breaks
  const parts = content.split('\n\n').filter(Boolean)
  return (
    <>
      {parts.map((p, i) => <p key={i} className="lesson-text">{p}</p>)}
    </>
  )
}

function PreLineBlock({ content, className }) {
  // Render content with newline-preserving formatting
  const lines = content.split('\n')
  return (
    <div className={className} style={{ whiteSpace: 'pre-line' }}>
      {lines.map((line, i) => {
        // Bullet points
        if (line.startsWith('• ')) {
          return <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
            <span style={{ color: 'var(--gold)', flexShrink: 0 }}>•</span>
            <span>{line.slice(2)}</span>
          </div>
        }
        // Numbered items like "1. CHECK THE MACRO"
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.*)/)
          return <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, marginTop: i > 0 ? 6 : 0 }}>
            <span style={{
              minWidth: 20, height: 20, borderRadius: '50%',
              background: 'var(--gold)', color: 'var(--bg)',
              fontSize: '0.7rem', fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1,
            }}>{match[1]}</span>
            <span>{match[2]}</span>
          </div>
        }
        // Sub-items (indented with spaces or tabs)
        if (line.startsWith('   ') || line.startsWith('\t')) {
          return <div key={i} style={{ paddingLeft: 28, fontSize: '0.85em', color: 'var(--text-3)', marginBottom: 2 }}>{line.trim()}</div>
        }
        // Blank lines
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />
        return <div key={i} style={{ marginBottom: 2 }}>{line}</div>
      })}
    </div>
  )
}

function LessonContent({ content }) {
  return (
    <div>
      {content.map((block, i) => {
        switch (block.type) {
          case 'text':
            return <TextBlock key={i} content={block.content} />
          case 'subheading':
            return <div key={i} className="lesson-subheading">{block.content}</div>
          case 'highlight':
            return (
              <div key={i} className="lesson-highlight">
                <div className="lesson-highlight-title">⭐ {block.title}</div>
                <PreLineBlock content={block.content} className="lesson-highlight-body" />
              </div>
            )
          case 'concept':
            return (
              <div key={i} className="lesson-concept">
                <div className="lesson-concept-title">💡 {block.title}</div>
                <PreLineBlock content={block.content} className="lesson-concept-body" />
              </div>
            )
          case 'formula':
            return (
              <div key={i} className="lesson-formula">
                <div className="lesson-formula-title">⟨/⟩ {block.title}</div>
                <PreLineBlock content={block.content} className="lesson-formula-body" />
              </div>
            )
          case 'example':
            return (
              <div key={i} className="lesson-example">
                <div className="lesson-example-title">📊 {block.title}</div>
                <PreLineBlock content={block.content} className="lesson-example-body" />
              </div>
            )
          case 'warning':
            return (
              <div key={i} className="lesson-warning">
                <strong>⚠ Important:</strong>{' '}{block.content}
              </div>
            )
          case 'table':
            return (
              <table key={i} className="lesson-table">
                <thead><tr>{block.headers.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>
                <tbody>{block.rows.map((row, j) => <tr key={j}>{row.map((cell, k) => <td key={k}>{cell}</td>)}</tr>)}</tbody>
              </table>
            )
          case 'diagram':
            return <Diagram key={i} id={block.id} />
          default:
            return null
        }
      })}
    </div>
  )
}

// ── XP Popup animation ────────────────────────────────────────────────────────
function XPPopup({ amount, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="xp-popup">+{amount} XP</div>
  )
}

// ── Quiz engine ───────────────────────────────────────────────────────────────
function QuizEngine({ quiz, lessonId, onComplete }) {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [answers, setAnswers] = useState([])   // track per-question results
  const [finished, setFinished] = useState(false)
  const [showXP, setShowXP] = useState(false)
  const { saveQuizScore } = useProgress()

  const q = quiz[current]

  const handleSelect = useCallback((idx) => {
    if (answered) return
    const isCorrect = idx === q.correct
    setSelected(idx)
    setAnswered(true)
    if (isCorrect) setCorrectCount(c => c + 1)
    setAnswers(prev => [...prev, { question: q.question, selected: idx, correct: q.correct, isCorrect }])
  }, [answered, q])

  const handleNext = useCallback(() => {
    if (current + 1 >= quiz.length) {
      // answers[] has all previous, correctCount has all previous correct answers
      // the current question's answer was recorded in handleSelect (correctCount + answers both updated)
      const total = quiz.length
      const allAnswers = [...answers]  // answers state should already include current
      // fallback: count from correctCount which is always up-to-date
      saveQuizScore(lessonId, correctCount, total)
      setFinished(true)
      setShowXP(true)
    } else {
      setCurrent(c => c + 1)
      setSelected(null)
      setAnswered(false)
    }
  }, [current, quiz.length, correctCount, answers, saveQuizScore, lessonId])

  // Keyboard shortcuts: 1/2/3/4 to select, Enter/Space to advance
  useEffect(() => {
    const handleKey = (e) => {
      if (finished) return
      const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3 }
      if (!answered && e.key in keyMap) {
        handleSelect(keyMap[e.key])
      }
      if (answered && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [answered, finished, handleSelect, handleNext])

  if (finished) {
    const score = correctCount   // up-to-date from handleSelect
    const total = quiz.length
    const pct = Math.round(score / total * 100)
    const xpEarned = score * 50 + 100  // quiz XP + lesson completion XP

    return (
      <div className="quiz-container">
        {showXP && <XPPopup amount={xpEarned} onDone={() => setShowXP(false)} />}
        <div style={{ textAlign: 'center', padding: '24px 20px 16px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>
            {score === total ? '🏆' : pct >= 67 ? '✅' : '📚'}
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>
            {score}/{total} Correct
          </div>
          <div style={{
            display: 'inline-block',
            padding: '4px 16px', borderRadius: 20, marginBottom: 16,
            background: pct === 100 ? 'rgba(34,211,165,0.15)' : pct >= 67 ? 'rgba(245,166,35,0.15)' : 'rgba(248,113,113,0.15)',
            color: pct === 100 ? 'var(--green)' : pct >= 67 ? 'var(--gold)' : 'var(--red)',
            fontWeight: 700, fontSize: '0.85rem',
          }}>
            {pct}% · {score * 50} XP earned
          </div>
          <div style={{ color: 'var(--text-2)', marginBottom: 24, fontSize: '0.9rem' }}>
            {score === total ? 'Perfect! You nailed every question.' : pct >= 67 ? 'Good work. Review any missed concepts above.' : 'Re-read the lesson content and try again.'}
          </div>
        </div>

        {/* Wrong answer review */}
        {answers.filter(a => !a.isCorrect).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Review Missed Questions
            </div>
            {answers.filter(a => !a.isCorrect).map((a, i) => {
              const origQ = quiz.find(q => q.question === a.question)
              return (
                <div key={i} style={{
                  background: 'var(--surface-2)', border: '1px solid rgba(248,113,113,0.2)',
                  borderRadius: 8, padding: '12px 14px', marginBottom: 8,
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 8 }}>{a.question}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--red)', display: 'flex', gap: 6 }}>
                      <span>✗</span>
                      <span>Your answer: {origQ?.options[a.selected]}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--green)', display: 'flex', gap: 6 }}>
                      <span>✓</span>
                      <span>Correct: {origQ?.options[a.correct]}</span>
                    </div>
                    {origQ?.explanation && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                        {origQ.explanation}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={onComplete}>
          Complete Lesson & Continue →
        </button>
      </div>
    )
  }

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span className="tag tag-gold">Question {current + 1} of {quiz.length}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {quiz.map((_, i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i < current
                  ? (answers[i]?.isCorrect ? 'var(--green)' : 'var(--red)')
                  : i === current ? 'var(--gold)' : 'var(--surface-4)',
              }} />
            ))}
          </div>
        </div>
        <div className="quiz-question">{q.question}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-4)', marginTop: 4 }}>
          Press 1–{q.options.length} to select · Enter to confirm
        </div>
      </div>
      <div className="quiz-options">
        {q.options.map((opt, i) => {
          let cls = 'quiz-option'
          if (answered) {
            cls += ' disabled'
            if (i === q.correct) cls += ' correct'
            else if (i === selected) cls += ' wrong'
          } else if (i === selected) {
            cls += ' selected'
          }
          return (
            <div key={i} className={cls} onClick={() => handleSelect(i)}>
              <span className="quiz-letter">{i + 1}</span>
              {opt}
            </div>
          )
        })}
      </div>
      {answered && (
        <div>
          <div className="quiz-explanation">{q.explanation}</div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>
              {selected === q.correct ? '✓ Correct! +50 XP' : '✗ Incorrect'}
            </span>
            <button className="btn btn-primary btn-sm" onClick={handleNext}>
              {current + 1 >= quiz.length ? 'See Results →' : 'Next Question →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Reading progress bar ──────────────────────────────────────────────────────
function ReadingProgress({ contentRef }) {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const onScroll = () => {
      const scrollTop = window.scrollY
      const docH = document.documentElement.scrollHeight - window.innerHeight
      setPct(docH > 0 ? Math.min(100, Math.round((scrollTop / docH) * 100)) : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [contentRef])

  return (
    <div className="reading-progress-bar">
      <div className="reading-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Key takeaways (pulled from highlight blocks) ──────────────────────────────
function KeyTakeaways({ content }) {
  const highlights = content.filter(b => b.type === 'highlight').slice(0, 3)
  if (!highlights.length) return null
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(245,166,35,0.08), rgba(245,166,35,0.03))',
      border: '1px solid var(--gold-ring)', borderRadius: 'var(--r-lg)',
      padding: '16px 20px', marginTop: 24, marginBottom: 8,
    }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        Key Takeaways
      </div>
      {highlights.map((h, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < highlights.length - 1 ? 8 : 0 }}>
          <span style={{ color: 'var(--gold)', flexShrink: 0, fontSize: '0.8rem', marginTop: 1 }}>⭐</span>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{h.title}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
              {h.content.split('\n')[0]}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main lesson page ──────────────────────────────────────────────────────────
export default function LessonPage() {
  const { moduleId, lessonId } = useParams()
  const navigate = useNavigate()
  const { completeLesson, isCompleted, progress } = useProgress()
  const [showQuiz, setShowQuiz] = useState(false)
  const [showXP, setShowXP] = useState(false)
  const contentRef = useRef(null)

  const mod = CURRICULUM.find(m => m.id === moduleId)
  const lesson = mod?.lessons.find(l => l.id === lessonId)
  const lessonIdx = mod?.lessons.findIndex(l => l.id === lessonId) ?? 0
  const nextLesson = mod?.lessons[lessonIdx + 1]
  const prevLesson = mod?.lessons[lessonIdx - 1]

  if (!mod || !lesson) return (
    <div className="page">
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-title">Lesson not found</div>
      </div>
    </div>
  )

  const alreadyDone = isCompleted(lessonId)
  const totalQuestions = lesson.quiz?.length ?? 0

  const handleComplete = () => {
    completeLesson(lessonId)
    setShowXP(true)
  }

  return (
    <div className="page fade-in" ref={contentRef}>
      <ReadingProgress contentRef={contentRef} />

      {showXP && <XPPopup amount={100} onDone={() => {
        setShowXP(false)
        if (nextLesson) {
          navigate(`/academy/module/${moduleId}/lesson/${nextLesson.id}`)
        } else {
          navigate(`/academy/module/${moduleId}`)
        }
      }} />}

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: '0.82rem', color: 'var(--text-3)', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/academy')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0 }}>Academy</button>
        <span>›</span>
        <button onClick={() => navigate(`/academy/module/${moduleId}`)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0 }}>{mod.title}</button>
        <span>›</span>
        <span style={{ color: 'var(--text)' }}>{lesson.title}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className="tag tag-gray">⏱ {lesson.duration}</span>
          {totalQuestions > 0 && <span className="tag tag-gray">{totalQuestions} quiz questions</span>}
          {alreadyDone && <span className="tag tag-green">✓ Completed</span>}
          {progress.quizScores[lessonId] && (
            <span className="tag tag-gold">Quiz: {progress.quizScores[lessonId].pct}%</span>
          )}
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 8 }}>
          {lesson.title}
        </h1>

        {/* Prev/next nav at top */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {prevLesson && (
            <button className="btn btn-secondary btn-sm"
              onClick={() => navigate(`/academy/module/${moduleId}/lesson/${prevLesson.id}`)}>
              ← {prevLesson.title}
            </button>
          )}
          {nextLesson && (
            <button className="btn btn-secondary btn-sm"
              onClick={() => navigate(`/academy/module/${moduleId}/lesson/${nextLesson.id}`)}>
              {nextLesson.title} →
            </button>
          )}
        </div>
      </div>

      <div className="divider" />

      {/* Content or Quiz */}
      {!showQuiz ? (
        <div>
          <LessonContent content={lesson.content} />

          <KeyTakeaways content={lesson.content} />

          <div className="divider" style={{ marginTop: 24 }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => navigate(`/academy/module/${moduleId}`)}>
              ← Module Overview
            </button>
            {totalQuestions > 0 ? (
              <button className="btn btn-primary" onClick={() => { setShowQuiz(true); window.scrollTo(0, 0) }}>
                Take Quiz ({totalQuestions} questions) →
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleComplete}>
                {alreadyDone ? '→ Next Lesson' : 'Mark Complete (+100 XP) ✓'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontWeight: 700, marginBottom: 4 }}>Knowledge Check</h2>
            <p style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>
              Answer all questions to complete this lesson and earn XP.
            </p>
          </div>
          <QuizEngine
            quiz={lesson.quiz}
            lessonId={lessonId}
            onComplete={() => {
              handleComplete()
            }}
          />
        </div>
      )}
    </div>
  )
}
