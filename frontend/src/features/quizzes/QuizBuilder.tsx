import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Clock3,
  Eye,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { api } from "../../api";
import type { Event } from "../../types";
import { Modal, PageHead } from "../../shared/components/ui";
import { QuizManager } from "./QuizManager";

type QuizDraftQuestion = { text: string; options: string[]; correct: number };

export function QuizBuilder({ toast }: { toast: (s: string) => void }) {
  const [title, setTitle] = useState("");
  const [eventId, setEventId] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsError, setEventsError] = useState("");
  const [duration, setDuration] = useState(60);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [extra, setExtra] = useState<string[]>([]);
  const [additionalQuestions, setAdditionalQuestions] = useState<
    QuizDraftQuestion[]
  >([]);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void api
      .events({ limit: 100 })
      .then(setEvents)
      .catch((cause: unknown) =>
        setEventsError(
          cause instanceof Error ? cause.message : "Could not load events.",
        ),
      );
  }, []);
  return (
    <>
      <PageHead
        eyebrow="BUILD A LITTLE FRIENDLY COMPETITION"
        title="Quiz builder"
        description="Give curious minds something fun to get into."
        action={
          <button className="btn btn-outline" onClick={() => setPreview(true)}>
            <Eye size={15} /> Preview
          </button>
        }
      />
      <div className="builder-layout">
        <div className="builder-main">
          <div className="builder-settings panel bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800">
            <label>
              QUIZ EVENT
              <select
                className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
                required
              >
                <option value="">Choose an event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
              {eventsError && <small role="alert">{eventsError}</small>}
            </label>
            <label>
              QUIZ TITLE
              <input
                className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              DURATION
              <select
                className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={30}>30 seconds per question</option>
                <option value={60}>60 seconds per question</option>
                <option value={90}>90 seconds per question</option>
              </select>
            </label>
          </div>
          <div className="builder-question panel bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800">
            <div className="builder-question-head">
              <span>QUESTION 01</span>
              <button
                className="icon-button dark:text-zinc-200 dark:hover:bg-zinc-800"
                aria-label="Remove question"
                onClick={() => toast("Keep at least one question in the quiz")}
              >
                <X size={15} />
              </button>
            </div>
            <label className="field-label">
              QUESTION TEXT
              <input
                className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Write a question"
              />
            </label>
            <div className="builder-options-head">
              <span className="field-label">ANSWER OPTIONS</span>
              <span className="correct-caption">SELECT THE CORRECT ANSWER</span>
            </div>
            {options.map((option, i) => (
              <div
                className={`builder-option text-zinc-800 dark:text-zinc-200 dark:border-zinc-700 ${
                  correct === i ? "correct" : ""
                }`}
                key={i}
              >
                <button
                  className="radio-dot"
                  aria-label={`Set option ${i + 1} as correct`}
                  onClick={() => setCorrect(i)}
                />
                <input
                  value={option}
                  className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  onChange={(e) =>
                    setOptions(
                      options.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                />
                {correct === i && (
                  <span>
                    <Check size={12} /> Correct
                  </span>
                )}
              </div>
            ))}
            {extra.map((value, i) => (
              <div
                className="builder-option text-zinc-800 dark:text-zinc-200 dark:border-zinc-700"
                key={`extra-${i}`}
              >
                <i className="radio-dot" />
                <input
                  value={value}
                  className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  onChange={(e) =>
                    setExtra(
                      extra.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                  placeholder={`Option ${options.length + i + 1}`}
                />
                <button
                  className="icon-button dark:text-zinc-200 dark:hover:bg-zinc-800"
                  aria-label="Remove option"
                  onClick={() => setExtra(extra.filter((_, j) => j !== i))}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              className="text-link add-option"
              onClick={() => setExtra([...extra, ""])}
            >
              <Plus size={14} /> Add option
            </button>
          </div>
          {additionalQuestions.map((item, questionIndex) => (
            <div
              className="builder-question panel bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800"
              key={questionIndex}
            >
              <div className="builder-question-head">
                <span>
                  QUESTION {String(questionIndex + 2).padStart(2, "0")}
                </span>
                <button
                  className="icon-button dark:text-zinc-200 dark:hover:bg-zinc-800"
                  aria-label="Remove question"
                  onClick={() =>
                    setAdditionalQuestions((current) =>
                      current.filter((_, index) => index !== questionIndex),
                    )
                  }
                >
                  <X size={15} />
                </button>
              </div>
              <label className="field-label">
                QUESTION TEXT
                <input
                  className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                  value={item.text}
                  onChange={(event) =>
                    setAdditionalQuestions((current) =>
                      current.map((question, index) =>
                        index === questionIndex
                          ? { ...question, text: event.target.value }
                          : question,
                      ),
                    )
                  }
                  placeholder="Write a question"
                />
              </label>
              <div className="builder-options-head">
                <span className="field-label">ANSWER OPTIONS</span>
                <span className="correct-caption">
                  SELECT THE CORRECT ANSWER
                </span>
              </div>
              {item.options.map((option, optionIndex) => (
                <div
                  className={`builder-option text-zinc-800 dark:text-zinc-200 dark:border-zinc-700 ${item.correct === optionIndex ? "correct" : ""}`}
                  key={optionIndex}
                >
                  <button
                    className="radio-dot"
                    aria-label={`Set option ${optionIndex + 1} as correct`}
                    onClick={() =>
                      setAdditionalQuestions((current) =>
                        current.map((question, index) =>
                          index === questionIndex
                            ? { ...question, correct: optionIndex }
                            : question,
                        ),
                      )
                    }
                  />
                  <input
                    value={option}
                    className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    onChange={(event) =>
                      setAdditionalQuestions((current) =>
                        current.map((question, index) =>
                          index === questionIndex
                            ? {
                                ...question,
                                options: question.options.map(
                                  (value, answerIndex) =>
                                    answerIndex === optionIndex
                                      ? event.target.value
                                      : value,
                                ),
                              }
                            : question,
                        ),
                      )
                    }
                  />
                  {item.correct === optionIndex && (
                    <span>
                      <Check size={12} /> Correct
                    </span>
                  )}
                </div>
              ))}
              <button
                className="text-link add-option"
                disabled={item.options.length >= 8}
                onClick={() =>
                  setAdditionalQuestions((current) =>
                    current.map((question, index) =>
                      index === questionIndex
                        ? { ...question, options: [...question.options, ""] }
                        : question,
                    ),
                  )
                }
              >
                <Plus size={14} /> Add option
              </button>
            </div>
          ))}
          <button
            className="btn btn-outline"
            disabled={additionalQuestions.length >= 99}
            onClick={() =>
              setAdditionalQuestions((current) => [
                ...current,
                { text: "", options: ["", "", "", ""], correct: 0 },
              ])
            }
          >
            <Plus size={15} /> Add question
          </button>
          <div className="builder-save">
            <span>
              <ShieldCheck size={15} /> Quiz is published for students
            </span>
            <button
              className="btn btn-dark"
              disabled={saving}
              onClick={() => {
                const choices = [...options, ...extra].map((value) =>
                  value.trim(),
                );
                if (!eventId) {
                  toast("Choose the event participants must register for");
                  return;
                }
                if (
                  !title.trim() ||
                  !question.trim() ||
                  choices.some((value) => !value) ||
                  additionalQuestions.some(
                    (item) =>
                      !item.text.trim() ||
                      item.options.some((value) => !value.trim()),
                  )
                ) {
                  toast(
                    "Complete the title, question, and answer options first",
                  );
                  return;
                }
                setSaving(true);
                void api
                  .createQuiz({
                    eventId,
                    title: title.trim(),
                    durationSeconds: duration,
                    status: "published",
                    questions: [
                      {
                        text: question.trim(),
                        options: choices,
                        correctAnswer: correct,
                      },
                      ...additionalQuestions.map((item) => ({
                        text: item.text.trim(),
                        options: item.options.map((value) => value.trim()),
                        correctAnswer: item.correct,
                      })),
                    ],
                  })
                  .then(() => toast("Quiz published"))
                  .catch((error: unknown) =>
                    toast(
                      error instanceof Error
                        ? error.message
                        : "Could not save quiz.",
                    ),
                  )
                  .finally(() => setSaving(false));
              }}
            >
              {saving ? "Publishing…" : "Publish quiz"} <ArrowRight size={15} />
            </button>
          </div>
        </div>
        <aside className="builder-aside">
          <div className="builder-summary panel bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800">
            <span className="section-kicker">QUIZ SUMMARY</span>
            <h3>{title || "Untitled quiz"}</h3>
            <div>
              <Clock3 /> {duration} seconds per question
            </div>
            <div>
              <CircleHelp /> {1 + additionalQuestions.length} questions
            </div>
            <div>
              <Users /> Registered event participants
            </div>
            <span className="draft-pill">DRAFT · NOT PUBLISHED</span>
          </div>
          <div className="builder-tip dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800">
            <Sparkles />
            <b>Keep it snappy.</b>
            <p>
              Short questions and clear answers make for a better quiz
              experience.
            </p>
          </div>
        </aside>
      </div>
      <QuizManager toast={toast} />
      {preview && (
        <Modal title="Quiz preview" close={() => setPreview(false)}>
          <h2>{title || "Untitled quiz"}</h2>
          <p>{duration} seconds per question</p>
          {[
            { text: question, options: [...options, ...extra] },
            ...additionalQuestions,
          ].map((item, index) => (
            <section key={index}>
              <b>
                {index + 1}. {item.text || "Question text"}
              </b>
              <ol>
                {item.options.map((option, optionIndex) => (
                  <li key={optionIndex}>
                    {option || `Option ${optionIndex + 1}`}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </Modal>
      )}
    </>
  );
}
