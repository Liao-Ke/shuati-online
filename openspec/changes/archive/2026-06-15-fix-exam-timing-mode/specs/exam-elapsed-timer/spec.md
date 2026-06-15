## ADDED Requirements

### Requirement: Elapsed timer shows cumulative time
When `timer_mode` is `elapsed`, the exam page SHALL display total elapsed time since exam start (excluding pause duration) instead of a per-question countdown timer.

#### Scenario: Display cumulative time on exam load
- **WHEN** user enters exam page with `timer_mode = "elapsed"`
- **THEN** `#exam-timer` shows `0:00` and starts incrementing every second

#### Scenario: Timer format
- **WHEN** elapsed time reaches 60 seconds
- **THEN** `#exam-timer` displays `1:00`

#### Scenario: Timer continues across question navigation
- **WHEN** user navigates to next question
- **THEN** elapsed timer continues incrementing uninterrupted

### Requirement: No per-question countdown in elapsed mode
When `timer_mode` is `elapsed`, the system SHALL NOT start a per-question countdown timer, SHALL NOT display per-question remaining time, and SHALL NOT auto-submit on timeout.

#### Scenario: No countdown displayed
- **WHEN** a new question loads with `timer_mode = "elapsed"`
- **THEN** `#exam-timer` shows elapsed time, NOT a countdown

#### Scenario: No auto-submit
- **WHEN** user takes longer than any timeout value in `elapsed` mode
- **THEN** answer is NOT automatically submitted

### Requirement: Pause pauses elapsed timer
When user pauses the exam in `elapsed` mode, the elapsed timer SHALL stop incrementing. When user resumes, the timer SHALL continue from the paused value.

#### Scenario: Pause stops timer
- **WHEN** user clicks pause button with 5 minutes elapsed
- **THEN** timer stops and shows `5:00`

#### Scenario: Resume continues timer
- **WHEN** user pauses for 2 minutes, then resumes
- **THEN** timer continues from `5:00` (not `7:00`)

### Requirement: Elapsed total recorded on finish
When exam finishes in `elapsed` mode, `ExamRecord.duration_seconds` SHALL reflect the total elapsed time (calculated from `started_at` and `finished_at`, excluding pauses). The per-answer `time_spent_seconds` SHALL be 0 for all answers in elapsed mode.

#### Scenario: Finish records total elapsed time
- **WHEN** user finishes an elapsed-mode exam after 10 minutes of active time
- **THEN** `ExamRecord.duration_seconds` is approximately 600

#### Scenario: Per-question time_spent is zero
- **WHEN** user submits an answer in `elapsed` mode
- **THEN** `AnswerRecord.time_spent_seconds` is 0

### Requirement: Refresh preserves elapsed state
When user refreshes the exam page in `elapsed` mode, the elapsed timer SHALL restore to the correct cumulative time based on `examStartedAt` from `sessionStorage`.

#### Scenario: Timer restored after refresh
- **WHEN** user refreshes the page 3 minutes into an elapsed-mode exam
- **THEN** `#exam-timer` shows approximately `3:00`
