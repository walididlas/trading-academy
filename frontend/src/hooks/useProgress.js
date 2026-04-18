import { useState, useEffect } from 'react'

const STORAGE_KEY = 'trading_academy_progress'

const defaultProgress = {
  completedLessons: [],
  quizScores: {},
  moduleProgress: {},
  streak: 0,
  lastStudied: null,
  totalXP: 0,
}

export function useProgress() {
  const [progress, setProgress] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? { ...defaultProgress, ...JSON.parse(stored) } : defaultProgress
    } catch { return defaultProgress }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }, [progress])

  const completeLesson = (lessonId) => {
    setProgress(p => {
      if (p.completedLessons.includes(lessonId)) return p
      const today = new Date().toDateString()
      const wasYesterday = p.lastStudied && new Date(p.lastStudied).toDateString() === new Date(Date.now() - 86400000).toDateString()
      const isToday = p.lastStudied && new Date(p.lastStudied).toDateString() === today
      return {
        ...p,
        completedLessons: [...p.completedLessons, lessonId],
        totalXP: p.totalXP + 100,
        lastStudied: new Date().toISOString(),
        streak: isToday ? p.streak : wasYesterday ? p.streak + 1 : 1,
      }
    })
  }

  const saveQuizScore = (lessonId, score, total) => {
    setProgress(p => ({
      ...p,
      quizScores: { ...p.quizScores, [lessonId]: { score, total, pct: Math.round(score / total * 100) } },
      totalXP: p.totalXP + (score * 50),
    }))
  }

  const isCompleted = (lessonId) => progress.completedLessons.includes(lessonId)

  const getModuleProgress = (module) => {
    const total = module.lessons.length
    const done = module.lessons.filter(l => progress.completedLessons.includes(l.id)).length
    return { done, total, pct: total ? Math.round(done / total * 100) : 0 }
  }

  const getTotalProgress = (curriculum) => {
    const total = curriculum.reduce((a, m) => a + m.lessons.length, 0)
    const done = progress.completedLessons.length
    return { done, total, pct: total ? Math.round(done / total * 100) : 0 }
  }

  return { progress, completeLesson, saveQuizScore, isCompleted, getModuleProgress, getTotalProgress }
}
