import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleStop,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useGSAP } from "@gsap/react";
import { api } from "../lib/api.js";
import { gsap } from "../lib/gsap.js";
import { useAuth } from "../context/AuthContext.jsx";

gsap.registerPlugin(useGSAP);

const difficultyLabels = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  advanced: "Advanced",
};
const tutorRequestConfig = { timeout: 100_000 };

function getErrorMessage(error) {
  return error.response?.data?.message ?? error.message ?? "The tutor request failed.";
}

function getCurrentQuestion(session) {
  return [...(session?.questions ?? [])]
    .reverse()
    .find((question) => !question.answeredAt && !question.skipped);
}

export default function AdaptiveTutor({ noteId, resourceType }) {
  const { user } = useAuth();
  const rootRef = useRef(null);
  const conversationRef = useRef(null);
  const questionRef = useRef(null);
  const feedbackRef = useRef(null);
  const [history, setHistory] = useState(null);
  const [session, setSession] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");

  const currentQuestion = getCurrentQuestion(session);
  const questionsAnswered = session?.questions.filter((question) => question.answeredAt).length ?? 0;
  const answeredCorrectly = session?.correctCount ?? 0;
  const accuracy = questionsAnswered
    ? Math.round((answeredCorrectly / questionsAnswered) * 100)
    : 0;
  const recentFeedback = useMemo(
    () => [...(session?.questions ?? [])].reverse().find((question) => question.answeredAt),
    [session],
  );

  useEffect(() => {
    if (user?.role !== "user") return undefined;
    let active = true;
    api.get(`/learning-tutor/notes/${noteId}`)
      .then(({ data }) => {
        if (!active) return;
        setHistory(data);
        if (data.activeSession) {
          setSession(data.activeSession);
          setIsOpen(true);
        }
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError));
      });
    return () => {
      active = false;
    };
  }, [noteId, user?.role]);

  useGSAP(() => {
    const node = questionRef.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    gsap.fromTo(
      node,
      { y: 12, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.42, ease: "power3.out", clearProps: "transform" },
    );
    return undefined;
  }, { scope: rootRef, dependencies: [currentQuestion?.id], revertOnUpdate: true });

  useGSAP(() => {
    const node = feedbackRef.current;
    if (!node || !recentFeedback || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    if (recentFeedback.isCorrect) {
      gsap.fromTo(node, { scale: 0.97, autoAlpha: 0.6 }, {
        scale: 1,
        autoAlpha: 1,
        duration: 0.36,
        ease: "back.out(1.7)",
        clearProps: "transform",
      });
    } else {
      gsap.fromTo(node, { x: -5 }, {
        x: 0,
        duration: 0.34,
        ease: "power2.out",
        keyframes: [{ x: 5 }, { x: -3 }, { x: 0 }],
        clearProps: "transform",
      });
    }
    return undefined;
  }, { scope: rootRef, dependencies: [recentFeedback?.id, recentFeedback?.isCorrect], revertOnUpdate: true });

  useEffect(() => {
    const conversation = conversationRef.current;
    if (!conversation) return;
    conversation.scrollTo({
      top: conversation.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [session?.questions.length, recentFeedback?.id]);

  async function runAction(action, task) {
    setBusy(true);
    setPendingAction(action);
    setError("");
    try {
      await task();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  }

  function startLearning() {
    void runAction("start", async () => {
      const { data } = await api.post(
        `/learning-tutor/notes/${noteId}/start`,
        {},
        tutorRequestConfig,
      );
      if (!data.available) {
        setHistory((current) => ({ ...current, available: false, unavailableMessage: data.message }));
        return;
      }
      setSession(data.session);
      setIsOpen(true);
      setAnswer("");
    });
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (!session || !answer.trim()) return;
    void runAction("answer", async () => {
      const { data } = await api.post(
        `/learning-tutor/sessions/${session.id}/answer`,
        { answer },
        tutorRequestConfig,
      );
      setSession(data.session);
      setAnswer("");
      if (data.nextQuestionError) setError(data.nextQuestionError);
    });
  }

  function requestSessionAction(action) {
    if (!session) return;
    const endpoints = {
      hint: "hint",
      explain: "explain",
      next: "next",
      end: "end",
    };
    void runAction(action, async () => {
      const { data } = await api.post(
        `/learning-tutor/sessions/${session.id}/${endpoints[action]}`,
        {},
        tutorRequestConfig,
      );
      setSession(data.session);
      if (action === "end") {
        setIsOpen(false);
        setHistory((current) => ({
          ...current,
          activeSession: null,
          previousSessions: [
            {
              id: data.session.id,
              correctCount: data.session.correctCount,
              incorrectCount: data.session.incorrectCount,
              questionsAsked: data.session.questions.length,
              strongConcepts: data.session.strongConcepts,
              weakConcepts: data.session.weakConcepts,
              createdAt: data.session.createdAt,
              completedAt: data.session.completedAt,
            },
            ...(current?.previousSessions ?? []).filter((item) => item.id !== data.session.id),
          ].slice(0, 5),
        }));
      }
    });
  }

  const isNote = resourceType === "note" && user?.role === "user";
  if (!isNote) return null;

  return (
    <section aria-label="AI learning tutor" className="ed-tutor" ref={rootRef}>
      <header className="ed-tutor-header">
        <div className="ed-tutor-heading">
          <span aria-hidden="true" className="ed-tutor-icon"><Sparkles size={20} /></span>
          <div>
            <p className="ed-tutor-eyebrow">PERSONAL STUDY COMPANION</p>
            <h2>AI Tutor</h2>
          </div>
        </div>
        {session && (
          <span className={`ed-tutor-level is-${session.currentDifficulty}`}>
            {difficultyLabels[session.currentDifficulty]}
          </span>
        )}
      </header>

      {!isOpen && (
        <div className="ed-tutor-intro">
          <div className="ed-tutor-intro-copy">
            <h3>Learn this note, one question at a time.</h3>
            <p>
              Your tutor uses this note&apos;s extracted text, adapts to your answers, and remembers your progress.
            </p>
          </div>
          {history?.available === false ? (
            <p className="ed-tutor-unavailable" role="status">{history.unavailableMessage}</p>
          ) : (
            <button
              className="ed-tutor-primary"
              disabled={busy}
              onClick={startLearning}
              type="button"
            >
              {busy && pendingAction === "start"
                ? <LoaderCircle aria-hidden="true" className="ed-tutor-spin" size={17} />
                : <MessageCircle aria-hidden="true" size={17} />}
              {history?.activeSession ? "Continue Learning with AI" : "Start Learning with AI"}
            </button>
          )}
        </div>
      )}

      {history?.previousSessions?.length > 0 && !isOpen && (
        <div className="ed-tutor-history">
          <h3><BookOpen aria-hidden="true" size={16} /> Previous learning progress</h3>
          {history.previousSessions.slice(0, 3).map((item) => (
            <div className="ed-tutor-history-row" key={item.id}>
              <span>{new Date(item.completedAt ?? item.createdAt).toLocaleDateString()}</span>
              <span>{item.questionsAsked} questions · {item.correctCount} correct</span>
              <span>{item.strongConcepts.length} strong · {item.weakConcepts.length} to revisit</span>
            </div>
          ))}
        </div>
      )}

      {isOpen && session && (
        <>
          <div className="ed-tutor-progress">
            <div className="ed-tutor-progress-label">
              <span>{questionsAnswered} answered · {accuracy}% accuracy</span>
              <span>{session.strongConcepts.length} strong · {session.weakConcepts.length} to revisit</span>
            </div>
            <div
              aria-label={`Answer accuracy ${accuracy}%`}
              aria-valuemax="100"
              aria-valuemin="0"
              aria-valuenow={accuracy}
              className="ed-tutor-progress-track"
              role="progressbar"
            >
              <span style={{ width: `${accuracy}%` }} />
            </div>
          </div>

          <div aria-live="polite" className="ed-tutor-conversation" ref={conversationRef}>
            {session.questions.map((question) => (
              <div className="ed-tutor-turn" key={question.id}>
                <div className="ed-tutor-bubble ed-tutor-bubble-ai">
                  <span className="ed-tutor-avatar"><Sparkles aria-hidden="true" size={14} /></span>
                  <div>
                    <p className="ed-tutor-message-label">TOPPER TUTOR · {difficultyLabels[question.difficulty]}</p>
                    <p>{question.question}</p>
                    {question.type === "mcq" && question.choices.length > 0 && (
                      <div className="ed-tutor-choices">
                        {question.choices.map((choice, index) => (
                          <button
                            aria-pressed={answer === `${String.fromCharCode(65 + index)}. ${choice}`}
                            disabled={Boolean(question.answeredAt) || busy}
                            key={`${question.id}-${choice}`}
                            onClick={() => setAnswer(`${String.fromCharCode(65 + index)}. ${choice}`)}
                            type="button"
                          >
                            <span>{String.fromCharCode(65 + index)}</span>{choice}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {question.studentAnswer && (
                  <div className="ed-tutor-bubble ed-tutor-bubble-student">
                    <span className="ed-tutor-avatar">YOU</span>
                    <p>{question.studentAnswer}</p>
                  </div>
                )}
                {question.feedback && (
                  <div
                    className={`ed-tutor-feedback ${question.isCorrect ? "is-correct" : "is-incorrect"}`}
                    ref={question.id === recentFeedback?.id ? feedbackRef : undefined}
                  >
                    {question.isCorrect
                      ? <Check aria-hidden="true" size={17} />
                      : <X aria-hidden="true" size={17} />}
                    <div>
                      <strong>{question.feedback}</strong>
                      {!question.isCorrect && question.explanation && <p>{question.explanation}</p>}
                      {!question.isCorrect && question.workedExample && (
                        <p className="ed-tutor-worked-example"><b>Worked example:</b> {question.workedExample}</p>
                      )}
                    </div>
                  </div>
                )}
                {question.hintText && (
                  <p className="ed-tutor-note"><Lightbulb aria-hidden="true" size={16} /> Hint: {question.hintText}</p>
                )}
                {question.explainAgain && (
                  <p className="ed-tutor-note"><BookOpen aria-hidden="true" size={16} /> {question.explainAgain}</p>
                )}
                {question.skipped && <p className="ed-tutor-skipped">Question skipped; the tutor kept your current level.</p>}
              </div>
            ))}
            {currentQuestion && (
              <div className="ed-tutor-question-panel" data-tutor-question ref={questionRef}>
                <form onSubmit={submitAnswer}>
                  <label htmlFor={`tutor-answer-${session.id}`}>Your answer</label>
                  <textarea
                    autoComplete="off"
                    id={`tutor-answer-${session.id}`}
                    maxLength={2000}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="Explain it in your own words…"
                    rows={3}
                    value={answer}
                  />
                  <div className="ed-tutor-actions">
                    <button className="ed-tutor-primary" disabled={busy || !answer.trim()} type="submit">
                      {busy && pendingAction === "answer"
                        ? <LoaderCircle aria-hidden="true" className="ed-tutor-spin" size={16} />
                        : <Send aria-hidden="true" size={16} />}
                      Submit Answer
                    </button>
                    <button
                      className="ed-tutor-secondary"
                      disabled={busy}
                      onClick={() => requestSessionAction("hint")}
                      type="button"
                    >
                      <Lightbulb aria-hidden="true" size={16} /> Hint
                    </button>
                    <button
                      className="ed-tutor-secondary"
                      disabled={busy}
                      onClick={() => requestSessionAction("explain")}
                      type="button"
                    >
                      <RotateCcw aria-hidden="true" size={16} /> Explain Again
                    </button>
                    <button
                      className="ed-tutor-text-button"
                      disabled={busy}
                      onClick={() => requestSessionAction("next")}
                      type="button"
                    >
                      Next Question <ArrowRight aria-hidden="true" size={15} />
                    </button>
                  </div>
                </form>
              </div>
            )}
            {!currentQuestion && session.status === "active" && (
              <div className="ed-tutor-question-panel">
                <p>The last answer is saved. Continue at {difficultyLabels[session.currentDifficulty]} level when you&apos;re ready.</p>
                <button
                  className="ed-tutor-primary"
                  disabled={busy}
                  onClick={() => requestSessionAction("next")}
                  type="button"
                >
                  {busy && pendingAction === "next"
                    ? <LoaderCircle aria-hidden="true" className="ed-tutor-spin" size={16} />
                    : <ArrowRight aria-hidden="true" size={16} />}
                  Try the next question
                </button>
              </div>
            )}
            {error && <p className="ed-tutor-error" role="alert">{error}</p>}
          </div>
          <div className="ed-tutor-footer">
            <span>Questions are grounded in the extracted text of this note.</span>
            <button
              className="ed-tutor-end"
              disabled={busy}
              onClick={() => requestSessionAction("end")}
              type="button"
            >
              <CircleStop aria-hidden="true" size={16} /> End Learning Session
            </button>
          </div>
        </>
      )}

      {!isOpen && error && <p className="ed-tutor-error" role="alert">{error}</p>}
    </section>
  );
}
