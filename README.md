# Market Chart Academy Pro — Cumulative Mastery Edition

All graded questions are randomized-chart multiple choice.

## Curriculum progression
Lesson assessments are curriculum-aware:
- About 70% of each 20-question lesson exam drills the concept introduced in that lesson.
- About 30% reviews concepts from earlier completed lessons.
- A lesson can never ask about material taught in a later lesson.
- Lesson 1 is purely foundational observation/chart-literacy work. It does not ask the learner to predict direction, assign probabilities, interpret RSI/ATR, or use other later concepts.
- Probability questions do not appear until the probability/calibration lesson.
- Risk-context questions do not appear until the risk lesson.
- Integrated whole-chart analysis does not appear until the final course lesson.

Worked examples in each lesson demonstrate that lesson's newly introduced material.

## Mastery
- 16 sequential lessons
- 4 randomized worked chart examples per lesson
- 20 randomized multiple-choice chart questions per lesson
- 95% required to unlock the next lesson
- Progress saved locally

## Final exam
- unlocked after all lessons are passed
- 100 randomized chart-analysis multiple-choice questions
- drawn from a 1,000-question all-course bank
- 80% required to pass

## Deploy
Push to GitHub and connect to Render. The included `render.yaml` builds with Vite and publishes `dist`.

## 3.1 chart-question synchronization
- Every graded item now selects a chart presentation mode from the concept being tested.
- Closing-structure questions use a closing-price line chart rather than hidden EMA state.
- Moving-average questions visibly plot EMA 9/20/50.
- RSI questions include an RSI panel with 30/70 references and the current value.
- ATR/volatility questions include ATR as a percent of price with training thresholds shown.
- Volume questions include visible volume bars and a recent-average reference.
- Support/resistance, range-location, breakout, probability, and integrated-analysis items show the relevant range boundaries and/or indicators used by their answer logic.
- Worked examples use the same synchronized renderer as assessment questions.
