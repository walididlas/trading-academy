import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CURRICULUM } from '../data/curriculum'
import { useProgress } from '../hooks/useProgress'

// ── Progress summary card ─────────────────────────────────────────────────────
function ProgressSummary({ curriculum }) {
  const navigate = useNavigate()
  const { progress, getTotalProgress } = useProgress()
  const { done, total, pct } = getTotalProgress(curriculum)

  // Find the first incomplete lesson
  let resumeLesson = null
  let resumeModule = null
  for (const mod of curriculum) {
    for (const lesson of mod.lessons) {
      if (!progress.completedLessons.includes(lesson.id)) {
        resumeLesson = lesson
        resumeModule = mod
        break
      }
    }
    if (resumeLesson) break
  }

  const xp = progress.totalXP

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(245,166,35,0.03) 100%)',
      border: '1px solid var(--gold-ring)', borderRadius: 'var(--r-lg)',
      padding: '20px 24px', marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Overall</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '1.4rem', color: 'var(--gold)' }}>{pct}%</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{done}/{total} lessons</div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Total XP</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '1.4rem', color: 'var(--text)' }}>{xp.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>points earned</div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Streak</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '1.4rem', color: progress.streak > 0 ? 'var(--green)' : 'var(--text-3)' }}>
              {progress.streak}🔥
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>days in a row</div>
          </div>
        </div>

        {/* Continue button */}
        {resumeLesson && (
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/academy/module/${resumeModule.id}/lesson/${resumeLesson.id}`)}
            style={{ flexShrink: 0 }}
          >
            Continue: {resumeLesson.title} →
          </button>
        )}
        {!resumeLesson && done > 0 && (
          <div style={{ fontSize: '0.85rem', color: 'var(--green)', fontWeight: 700 }}>
            🏆 All lessons complete!
          </div>
        )}
      </div>

      {/* Progress bar */}
      {pct > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="progress-track" style={{ height: 6 }}>
            <div className="progress-fill" style={{ width: `${pct}%`, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Academy Home ──────────────────────────────────────────────────────────────
export function AcademyHome() {
  const navigate = useNavigate()
  const { getModuleProgress, isCompleted, progress } = useProgress()
  const totalQuizzes = CURRICULUM.reduce((a, m) => a + m.lessons.reduce((b, l) => b + (l.quiz?.length || 0), 0), 0)

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">Academy</h1>
        <p className="page-subtitle">
          {CURRICULUM.length} modules · {CURRICULUM.reduce((a, m) => a + m.lessons.length, 0)} lessons · {totalQuizzes} quiz questions
        </p>
      </div>

      <ProgressSummary curriculum={CURRICULUM} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CURRICULUM.map((mod, i) => {
          const mp = getModuleProgress(mod)
          const isLocked = i > 0 && getModuleProgress(CURRICULUM[i - 1]).pct < 50
          const totalDuration = mod.lessons.reduce((a, l) => {
            const mins = parseInt(l.duration) || 0
            return a + mins
          }, 0)

          return (
            <div
              key={mod.id}
              className="card"
              style={{
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.5 : 1,
                borderLeft: `4px solid ${mp.pct === 100 ? 'var(--green)' : mod.color}`,
                transition: 'border-color 0.3s',
              }}
              onClick={() => !isLocked && navigate(`/academy/module/${mod.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  fontSize: '1.8rem', width: 48, height: 48, textAlign: 'center',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--surface-2)', borderRadius: 10, flexShrink: 0,
                }}>
                  {mp.pct === 100 ? '✅' : mod.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Module {i + 1}
                    </span>
                    {isLocked && <span className="tag tag-gray">🔒 Locked</span>}
                    {mp.pct === 100 && <span className="tag tag-green">✓ Complete</span>}
                    {mp.pct > 0 && mp.pct < 100 && <span className="tag tag-gold">In Progress</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 3 }}>{mod.title}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: 8 }}>{mod.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.75rem', color: 'var(--text-3)', flexWrap: 'wrap' }}>
                    <span>{mod.lessons.length} lesson{mod.lessons.length > 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{totalDuration} min</span>
                    <span>·</span>
                    <span>{mod.lessons.reduce((a, l) => a + (l.quiz?.length || 0), 0)} questions</span>
                    {mp.pct > 0 && mp.pct < 100 && (
                      <>
                        <span>·</span>
                        <span style={{ color: 'var(--gold)' }}>{mp.done}/{mp.total} complete</span>
                      </>
                    )}
                  </div>
                </div>
                {mp.pct > 0 && (
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '1.2rem', fontWeight: 800,
                      color: mp.pct === 100 ? 'var(--green)' : 'var(--gold)',
                    }}>{mp.pct}%</div>
                  </div>
                )}
                <div style={{ color: 'var(--text-3)', fontSize: '1.1rem', flexShrink: 0 }}>›</div>
              </div>

              {mp.pct > 0 && mp.pct < 100 && (
                <div className="progress-track" style={{ marginTop: 12, height: 4 }}>
                  <div className="progress-fill" style={{ width: `${mp.pct}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Module Page ───────────────────────────────────────────────────────────────
export function ModulePage() {
  const { moduleId } = useParams()
  const navigate = useNavigate()
  const { isCompleted, progress, getModuleProgress } = useProgress()
  const mod = CURRICULUM.find(m => m.id === moduleId)
  const modIdx = CURRICULUM.findIndex(m => m.id === moduleId)

  if (!mod) return (
    <div className="page">
      <div className="empty-state"><div className="empty-state-title">Module not found</div></div>
    </div>
  )

  const mp = getModuleProgress(mod)
  const totalDuration = mod.lessons.reduce((a, l) => a + (parseInt(l.duration) || 0), 0)

  // First incomplete lesson
  const nextLesson = mod.lessons.find(l => !isCompleted(l.id))

  return (
    <div className="page fade-in">
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }} onClick={() => navigate('/academy')}>
        ← All Modules
      </button>

      {/* Module header */}
      <div style={{
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderLeft: `4px solid ${mod.color}`, borderRadius: 'var(--r-lg)',
        padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ fontSize: '2.5rem', flexShrink: 0 }}>{mod.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 4 }}>Module {modIdx + 1}</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 8 }}>
              {mod.title}
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: 14 }}>{mod.description}</p>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem', color: 'var(--text-3)', flexWrap: 'wrap' }}>
              <span>{mod.lessons.length} lessons · {totalDuration} min total</span>
              {mp.pct > 0 && (
                <span style={{ color: mp.pct === 100 ? 'var(--green)' : 'var(--gold)', fontWeight: 700 }}>
                  {mp.done}/{mp.total} complete
                </span>
              )}
            </div>
            {mp.pct > 0 && (
              <div className="progress-track" style={{ marginTop: 12, height: 5 }}>
                <div className="progress-fill" style={{ width: `${mp.pct}%` }} />
              </div>
            )}
          </div>
        </div>
        {nextLesson && (
          <div style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/academy/module/${moduleId}/lesson/${nextLesson.id}`)}
            >
              {mp.pct === 0 ? 'Start Module →' : 'Continue →'} {nextLesson.title}
            </button>
          </div>
        )}
      </div>

      {/* Lessons list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mod.lessons.map((lesson, i) => {
          const done = isCompleted(lesson.id)
          const quizScore = progress.quizScores[lesson.id]
          const isCurrent = lesson === nextLesson

          return (
            <div
              key={lesson.id}
              className="card"
              style={{
                cursor: 'pointer',
                borderLeft: done
                  ? '3px solid var(--green)'
                  : isCurrent ? `3px solid ${mod.color}` : '3px solid var(--border)',
                background: isCurrent && !done ? 'rgba(245,166,35,0.02)' : undefined,
              }}
              onClick={() => navigate(`/academy/module/${moduleId}/lesson/${lesson.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Lesson number / check */}
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: done ? 'rgba(34,211,165,0.15)' : isCurrent ? `${mod.color}22` : 'var(--surface-2)',
                  border: `2px solid ${done ? 'var(--green)' : isCurrent ? mod.color : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.85rem',
                  color: done ? 'var(--green)' : isCurrent ? mod.color : 'var(--text-3)',
                }}>
                  {done ? '✓' : i + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>{lesson.title}</div>
                  <div style={{ display: 'flex', gap: 10, fontSize: '0.75rem', color: 'var(--text-3)', flexWrap: 'wrap' }}>
                    <span>⏱ {lesson.duration}</span>
                    {lesson.quiz?.length > 0 && <span>· {lesson.quiz.length} questions</span>}
                    {quizScore && (
                      <span style={{ color: quizScore.pct === 100 ? 'var(--green)' : 'var(--gold)' }}>
                        · Quiz {quizScore.pct}%
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isCurrent && !done && (
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: `${mod.color}22`, color: mod.color,
                    }}>Next up</span>
                  )}
                  <div style={{ color: 'var(--text-3)' }}>›</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
