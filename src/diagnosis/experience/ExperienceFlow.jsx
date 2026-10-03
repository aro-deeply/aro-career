// 진단 페이지의 "경험만 있어요" 흐름: 처음 적기 → 일 고르기 → 이야기·질문 → 내용 확인 → 문장 완성.
// 주소(#xp/...)에는 화면과 경험 번호만 담고, 내용은 항상 저장된 최신 상태에서 읽는다.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  NOTE_KEY, createNotebook, restoreNotebook, experienceById, commitEntry, hasSeveralCandidates, addCandidate, pickCandidate,
  experiencesForCandidate, startExperience, assignEngine, recordConsent, commitStory, answerQuestion, editAnswer, renameExperience,
  reviewItem, rewordItem, setDraft, clearDraft, sourcesOf, engineInput, analysisBasis, resultBasis, analysisIsCurrent,
  resultIsCurrent, applyAnalysis, applyResult, displayTitle, stageOf, setAngle, coreMessage, clearResult,
} from "../../../shared/experience/notebook.mjs";
import { ITEM_KINDS, isUsableItem, needsConfirmation, normalizeText } from "../../../shared/experience/evidence.mjs";
import { describeGaps } from "../../../shared/experience/local-engine.mjs";
import { startSession, currentEngine, analyze, compose, EngineError } from "./experience-api.js";
import Turnstile from "./Turnstile.jsx";
import "./experience.css";

export const SEED_KEY = "aro.diagnosis.experience.seed";
const KIND_NAMES = { role: "맡은 역할", action: "내가 한 일", judgment: "왜 그렇게 했는지", criterion: "판단 기준", situation: "그때 상황", result: "확인한 결과" };
const STEPS = ["처음 적기", "일 고르기", "이야기·질문", "핵심 확인", "쓰는 법"];
const ERROR_TEXT = {
  "budget-exhausted": "시험 예산 상한에 닿기 전에 멈췄어요.", refusal: "AI가 이 요청에 답하지 않았어요.",
  "not-fictional": "시험 모드에서는 가상 경험만 보낼 수 있어요.", "rate-limited": "요청이 많아 잠시 거절됐어요. 잠시 후 다시 시도해 주세요.",
  "engine-unavailable": "이 경험은 AI로 정리하던 중이에요. 지금은 AI에 연결할 수 없어요.",
  "monthly-cap": "이번 달 AI 정리 이용량이 모두 찼어요. 다음 달에 다시 열려요.",
  "daily-cap": "오늘 AI 정리 이용량이 모두 찼어요. 내일 다시 이용해 주세요.",
  "ip-daily-cap": "오늘 이용할 수 있는 양을 모두 쓰셨어요. 내일 다시 이용해 주세요.",
  "ip-sessions": "오늘 새로 시작할 수 있는 정리 횟수를 모두 쓰셨어요. 내일 다시 이용해 주세요.",
  "session-calls": "이번 이용에서 쓸 수 있는 횟수를 모두 썼어요. 잠시 후 페이지를 새로 열면 이어서 정리할 수 있어요.",
  "guard-unavailable": "지금은 AI 정리를 이용할 수 없어요. 잠시 후 다시 시도해 주세요.",
};
// Limits that a retry cannot change: no retry button for these.
const FINAL_ERRORS = new Set(["budget-exhausted", "not-fictional", "ledger-corrupt", "ledger-missing", "engine-unavailable",
  "monthly-cap", "daily-cap", "ip-daily-cap", "ip-sessions", "session-calls"]);

// ---------- storage ----------
function loadState() {
  try {
    const raw = window.localStorage.getItem(NOTE_KEY);
    if (raw === null) return { state: createNotebook(), blocked: false };
    const state = restoreNotebook(raw);
    return state ? { state, blocked: false } : { state: createNotebook(), blocked: true };
  } catch { return { state: createNotebook(), blocked: false, unavailable: true }; }
}

// ---------- routing ----------
function parseRoute(hash) {
  const parts = hash.replace(/^#/, "").split("/").filter(Boolean); // ["xp", ...]
  if (parts[1] === "pick") return { screen: "pick" };
  if (parts[1] === "edit") return { screen: "start", editing: true };
  if (parts[1] === "from-diagnosis") return { screen: "seed" };
  if (parts[1]?.startsWith("e")) return { screen: ["review", "result"].includes(parts[2]) ? parts[2] : "exp", id: parts[1] };
  return { screen: "start" };
}
const expHash = (id, tail = "") => `#xp/${id}${tail}`;
const go = hash => { if (window.location.hash !== hash) window.location.hash = hash; };

const ArrowIcon = () => <svg className="xp-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>;
const SendIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
const CheckIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const BackIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>;

function stageLabel(exp) {
  const stage = stageOf(exp);
  if (stage === "story") return "이야기 적기 전";
  if (resultIsCurrent(exp)) return "문장 완성";
  if (stage === "ready") return "질문 끝 · 확인 전";
  return exp.answers.length ? `질문 ${exp.answers.length}개 답함` : "질문 시작 전";
}

// ---------- shared pieces ----------
function AutoTextarea({ value, onChange, minRows = 3, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight + 2, 480) + "px";
  }, [value]);
  return <textarea ref={ref} rows={minRows} value={value} onChange={e => onChange(e.target.value)} {...rest} />;
}

function EditForm({ id, initial, label, onSave, onCancel, onDraft, rows = 3, className = "xp-edit" }) {
  const [error, setError] = useState("");
  return (
    <form className={className} onSubmit={e => { e.preventDefault(); const v = e.currentTarget.elements[0].value; if (!normalizeText(v)) { setError("비울 수는 없어요. 취소를 눌러 주세요."); return; } onSave(v); }}>
      <label htmlFor={id} className="xp-sr">{label}</label>
      <AutoTextarea id={id} value={initial} onChange={onDraft} minRows={rows} autoFocus />
      {error && <p className="xp-error" role="alert">{error}</p>}
      <div className="xp-edit-actions"><button type="button" className="xp-link" onClick={onCancel}>취소</button><button type="submit" className="xp-btn xp-btn--small">저장</button></div>
    </form>
  );
}

// ---------- the flow ----------
export default function ExperienceFlow({ onExit }) {
  const initial = useRef(null);
  if (!initial.current) initial.current = loadState();
  const [state, setState] = useState(initial.current.state);
  const [blocked, setBlocked] = useState(initial.current.blocked);
  const [savedAt, setSavedAt] = useState(null);
  const [hash, setHash] = useState(window.location.hash);
  const [pending, setPending] = useState({}); // expId → 'analyze' | 'compose'
  const [errors, setErrors] = useState({}); // expId → code
  const [needGate, setNeedGate] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [toast, setToast] = useState("");
  const stateRef = useRef(state);
  stateRef.current = state;

  const update = useCallback(fn => setState(previous => { const next = fn(previous); return next; }), []);

  // Autosave: every change is written immediately; navigation never depends on saving.
  useEffect(() => {
    if (blocked) return;
    try { window.localStorage.setItem(NOTE_KEY, JSON.stringify(state)); setSavedAt(new Date()); } catch { setSavedAt(null); }
  }, [state, blocked]);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    const onStorage = e => { if (e.key === NOTE_KEY) setBlocked(true); };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("hashchange", onHash); window.removeEventListener("storage", onStorage); };
  }, []);

  let route = parseRoute(hash);
  const exp = route.id ? experienceById(state, route.id) : null;
  const routeValid = route.screen === "seed" || (route.screen === "pick" ? Boolean(state.scope) : route.id ? Boolean(exp) && (route.screen === "exp" || Boolean(exp.story.text)) : true);
  useEffect(() => { if (!routeValid) window.history.replaceState(null, "", "#xp"); }, [routeValid]);
  if (!routeValid) route = { screen: "start" };

  // Arriving from a diagnosis evidence quote: start an experience about that sentence.
  useEffect(() => {
    if (route.screen !== "seed") return;
    let quote = "";
    try { quote = window.sessionStorage.getItem(SEED_KEY) || ""; window.sessionStorage.removeItem(SEED_KEY); } catch { /* none */ }
    if (!quote) { window.history.replaceState(null, "", "#xp"); setHash("#xp"); return; }
    const next = startExperience(stateRef.current, { scopeId: "diagnosis-" + Date.now(), scopeTitle: "진단에서 짚은 문장", scopeEvidence: quote });
    setState(next);
    window.history.replaceState(null, "", expHash(next.activeId));
    setHash(expHash(next.activeId));
  }, [route.screen]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); document.querySelector(".xp h1")?.focus({ preventScroll: true }); }, [hash]);
  useEffect(() => { if (exp && state.activeId !== exp.id) update(s => ({ ...s, activeId: exp.id })); }, [exp?.id]);

  // ---------- engine ----------
  const ensureSession = useCallback(async token => {
    if (currentEngine()) return currentEngine();
    const s = await startSession({ consent: true, turnstileToken: token ?? null });
    return s.engine;
  }, []);

  const runAnalysis = useCallback(async expId => {
    const current = experienceById(stateRef.current, expId);
    if (!current?.story.text || !current.mode || analysisIsCurrent(current)) return;
    const basis = analysisBasis(current);
    setPending(p => ({ ...p, [expId]: "analyze" }));
    try {
      const engine = await ensureSession(turnstileToken);
      if (engine !== current.mode) throw new EngineError("engine-unavailable");
      const result = await analyze(engine, engineInput(current));
      setState(s => applyAnalysis(s, expId, result, basis));
      setNeedGate(false);
    } catch (error) {
      if (error.code === "bot" || error.code === "session") setNeedGate(true);
      else setErrors(e => ({ ...e, [expId]: error.code || "error" }));
    } finally { setPending(p => { const n = { ...p }; delete n[expId]; return n; }); }
  }, [ensureSession, turnstileToken]);

  const runCompose = useCallback(async expId => {
    const current = experienceById(stateRef.current, expId);
    if (!current || !analysisIsCurrent(current) || resultIsCurrent(current)) return;
    const basis = resultBasis(current);
    const usable = current.analysis.items.filter(i => isUsableItem(i, current.reviews));
    setPending(p => ({ ...p, [expId]: "compose" }));
    try {
      const engine = await ensureSession(turnstileToken);
      if (engine !== current.mode) throw new EngineError("engine-unavailable");
      const result = await compose(engine, { title: displayTitle(current), scopeTitle: current.scopeTitle, items: current.analysis.items,
        reviews: current.reviews, sources: sourcesOf(current), answers: current.answers, usable,
        angle: coreMessage(current), unanswered: engineInput(current).unanswered });
      setState(s => applyResult(s, expId, { ...result, gaps: result.gaps || describeGaps(usable, current.answers) }, basis));
      setNeedGate(false);
    } catch (error) {
      if (error.code === "bot" || error.code === "session") setNeedGate(true);
      else setErrors(e => ({ ...e, [expId]: error.code || "error" }));
    } finally { setPending(p => { const n = { ...p }; delete n[expId]; return n; }); }
  }, [ensureSession, turnstileToken]);

  const busy = exp ? pending[exp.id] : null, error = exp ? errors[exp.id] : null;
  useEffect(() => {
    if (!exp || busy || error || needGate) return;
    if (route.screen === "exp" && exp.story.text && !analysisIsCurrent(exp)) runAnalysis(exp.id);
    if (route.screen === "result") { if (!analysisIsCurrent(exp)) runAnalysis(exp.id); else if (!resultIsCurrent(exp)) runCompose(exp.id); }
  });

  // ---------- actions ----------
  const say = text => { setToast(text); setTimeout(() => setToast(""), 2600); };
  const startStory = async (value, consent) => {
    if (!consent && !state.consentAt) return "개인정보 처리에 동의해 주세요.";
    let engine;
    try { engine = await ensureSession(turnstileToken); }
    catch (e) { return e.userMessage || "잠시 후 다시 시도해 주세요."; }
    setState(s => commitStory(assignEngine(recordConsent(s), exp.id, engine), exp.id, value));
    return null;
  };
  const resultText = (part = "all") => {
    const r = exp.result;
    const resume = ["[이력서 문장]", ...r.resume.map(l => "- " + l.text)];
    const interview = ["[면접 답변]", "예상 질문: " + r.interview.question, r.interview.lines.map(l => l.text).join(" "),
      ...(r.followUps?.length ? ["", "[이어서 받을 질문]", ...r.followUps.map(f => `- ${f.question}\n  → ${f.point}`)] : [])];
    if (part === "resume") return resume.join("\n");
    if (part === "interview") return interview.join("\n");
    return [displayTitle(exp), "",
      ...(r.headline ? ["[이 경험이 보여주는 것]", r.headline.text, ""] : []),
      ...(r.useFor?.length ? ["[이럴 때 꺼내 쓰세요]", ...r.useFor.map(u => "- " + u), ""] : []),
      ...resume, "", ...interview, "",
      ...(r.cautions?.length ? ["[평가자에게 이렇게 읽힐 수 있어요]", ...r.cautions.map(c => `- “${c.quote}” → ${c.why} / 이렇게: ${c.instead}`), ""] : []),
      ...(r.strengthen?.length ? ["[더 강해지려면]", ...r.strengthen.map(t => "- " + t), ""] : []),
      "본인이 적은 내용만 근거로 정리했어요. (ARO 경험 정리)"].join("\n");
  };
  const copy = async part => { try { await navigator.clipboard.writeText(resultText(part)); say("복사했어요"); } catch { say("복사가 안 돼요. ‘파일로 저장’을 써 주세요."); } };
  const download = () => {
    const url = URL.createObjectURL(new Blob([resultText()], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "ARO-" + displayTitle(exp).replace(/[\\/:*?"<>|\s]+/g, "-") + ".txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ---------- frame ----------
  const step = { start: 0, pick: 1, exp: 2, review: 3, result: 4 }[route.screen] ?? 0;
  const several = hasSeveralCandidates(state);
  const up = route.screen === "result" ? expHash(exp.id, "/review") : route.screen === "review" ? expHash(exp.id)
    : route.screen === "exp" ? (exp.scopeId.startsWith("diagnosis-") ? null : several ? "#xp/pick" : "#xp")
    : route.screen === "pick" || route.editing ? "#xp" : null;
  const bar = (
    <div className="xp-bar">
      <div className="xp-bar-in">
        {up ? <button type="button" className="xp-icon-btn" aria-label="이전 단계로" onClick={() => go(up)}><BackIcon /></button>
          : <button type="button" className="xp-icon-btn" aria-label="진단 첫 화면으로" onClick={onExit}><BackIcon /></button>}
        <span className="xp-step">{step + 1}/5 · {STEPS[step]}</span>
        <span className="xp-save" role="status" aria-live="polite">{blocked ? <><i className="xp-dot xp-dot--warn" />저장 멈춤</> : savedAt ? <><i className="xp-dot" />자동 저장됨</> : null}</span>
      </div>
      <div className="xp-progress" aria-hidden="true"><i style={{ width: `${(step + 1) * 20}%` }} /></div>
    </div>
  );
  const banner = blocked ? <p className="xp-banner" role="alert">다른 탭에서 기록이 바뀌어 이 탭의 자동 저장을 멈췄어요. 새로고침하면 최신 기록을 볼 수 있어요.</p> : null;

  let screen;
  if (route.screen === "seed") screen = <section className="xp-screen"><p className="xp-sub">불러오는 중…</p></section>;
  else if (route.screen === "pick") screen = <PickView state={state} update={update} />;
  else if (route.screen === "exp") screen = exp.story.text
    ? <ChatView exp={exp} update={update} busy={busy} error={error} needGate={needGate} setToken={setTurnstileToken}
        retry={() => { setErrors(e => { const n = { ...e }; delete n[exp.id]; return n; }); setNeedGate(false); }} />
    : <StoryView exp={exp} update={update} state={state} startStory={startStory} setToken={setTurnstileToken} />;
  else if (route.screen === "review") screen = <ReviewView exp={exp} update={update} />;
  else if (route.screen === "result") screen = <ResultView exp={exp} busy={busy} error={error} needGate={needGate} setToken={setTurnstileToken}
    retry={() => { setErrors(e => { const n = { ...e }; delete n[exp.id]; return n; }); setNeedGate(false); }} copy={copy} download={download} several={several}
    remake={() => setState(s => clearResult(s, exp.id))} />;
  else screen = <StartView state={state} update={update} editing={route.editing} />;

  return (
    <div className="xp">
      {bar}{banner}
      <main className="xp-main">{screen}</main>
      <div className="xp-toast" role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

// ---------- 1. 처음 적기 ----------
function StartView({ state, update, editing }) {
  const [error, setError] = useState("");
  const hasEntry = Boolean(state.entry.text);
  if (hasEntry && !editing) {
    const recent = [...state.experiences].reverse().slice(0, 4);
    return (
      <section className="xp-screen">
        <h1 tabIndex={-1}>이어서 정리할까요?</h1>
        <p className="xp-sub">적어둔 내용은 이 기기에 저장돼 있어요.</p>
        <div className="xp-choices">
          {recent.map(exp => (
            <button type="button" key={exp.id} className="xp-choice" onClick={() => go(expHash(exp.id))}>
              <span className="xp-choice-main"><b>{displayTitle(exp)}</b><small>{stageLabel(exp)}</small></span><ArrowIcon />
            </button>
          ))}
          <button type="button" className="xp-choice xp-choice--ghost" onClick={() => go("#xp/pick")}>
            <span className="xp-choice-main"><b>{recent.length ? "다른 일 정리하기" : "정리할 일 고르기"}</b><small>처음 적은 내용에서 고르기</small></span><ArrowIcon />
          </button>
        </div>
        <p className="xp-aside"><button type="button" className="xp-link" onClick={() => go("#xp/edit")}>처음 적은 내용 고치기</button></p>
      </section>
    );
  }
  const value = state.entryDraft ?? state.entry.text;
  return (
    <section className="xp-screen">
      <h1 tabIndex={-1}>{editing ? "처음 적은 내용을 고쳐 주세요" : "어떤 일을 해오셨어요?"}</h1>
      <p className="xp-sub">여러 일을 한 번에 적어도 돼요. 다음 화면에서 하나씩 골라 정리해요.</p>
      <form className="xp-compose" onSubmit={e => {
        e.preventDefault();
        if (!normalizeText(value)) { setError("한 줄이라도 적어 주세요."); return; }
        const next = commitEntry(state, value);
        if (hasSeveralCandidates(next)) { update(() => next); go("#xp/pick"); return; }
        const picked = pickCandidate(next, next.scope.candidates[0].id);
        update(() => picked); go(expHash(picked.activeId));
      }}>
        <label htmlFor="xp-entry" className="xp-sr">해온 일</label>
        <AutoTextarea id="xp-entry" minRows={5} maxLength={6000} value={value} onChange={v => update(s => setDraft(s, null, "entry", v))}
          placeholder="예) 인사팀에서 채용과 평가를 맡았고, 급여 정산도 했어요." />
        {error && <p className="xp-error" role="alert">{error}</p>}
        <button type="submit" className="xp-btn xp-btn--wide">{editing ? "고친 내용으로 다시 고르기" : "다음"}</button>
      </form>
      <p className="xp-aside">적는 내용은 이 기기에 자동 저장돼요.</p>
    </section>
  );
}

// ---------- 2. 일 고르기 ----------
function PickView({ state, update }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const pickIt = id => { const next = pickCandidate(state, id); update(() => next); go(expHash(next.activeId)); };
  return (
    <section className="xp-screen">
      <h1 tabIndex={-1}>어떤 일부터 정리할까요?</h1>
      <p className="xp-sub">하나만 골라 주세요. 나머지는 나중에 해도 돼요.</p>
      <div className="xp-choices">
        {state.scope.candidates.map(c => {
          const last = experiencesForCandidate(state, c.id).at(-1);
          const quote = c.evidence && normalizeText(c.evidence) !== normalizeText(c.title) ? `“${c.evidence}”` : c.origin === "user-added" ? "직접 추가한 일" : "";
          return (
            <button type="button" key={c.id} className="xp-choice" data-candidate={c.title} onClick={() => pickIt(c.id)}>
              <span className="xp-choice-main"><b>{c.title}</b>{quote && <small>{quote}</small>}{last && <em className="xp-tag">{stageLabel(last)} · 이어서 하기</em>}</span><ArrowIcon />
            </button>
          );
        })}
      </div>
      {adding ? (
        <form className="xp-inline" onSubmit={e => { e.preventDefault(); if (!normalizeText(name)) return; update(s => addCandidate(s, name)); setName(""); setAdding(false); }}>
          <label htmlFor="xp-new" className="xp-sr">추가할 일</label>
          <input id="xp-new" value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="빠진 일의 이름" autoFocus />
          <button type="submit" className="xp-btn xp-btn--small">추가</button>
          <button type="button" className="xp-link" onClick={() => setAdding(false)}>취소</button>
        </form>
      ) : (
        <p className="xp-aside"><button type="button" className="xp-link" onClick={() => setAdding(true)}>목록에 없는 일 추가</button><span aria-hidden="true"> · </span>
          <button type="button" className="xp-link" onClick={() => pickIt("whole")}>나누지 않고 전체를 하나로</button></p>
      )}
    </section>
  );
}

// ---------- 3. 이야기 ----------
function StoryView({ exp, state, update, startStory, setToken }) {
  const [consent, setConsent] = useState(Boolean(state.consentAt));
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const value = exp.drafts.story ?? "";
  const fromDiagnosis = exp.scopeId.startsWith("diagnosis-");
  const given = exp.scopeEvidence && normalizeText(exp.scopeEvidence) !== normalizeText(exp.scopeTitle) ? exp.scopeEvidence : "";
  return (
    <section className="xp-screen">
      <p className="xp-context">{exp.scopeTitle}</p>
      <h1 tabIndex={-1}>{fromDiagnosis ? "이 문장 뒤에 있던 실제 경험을 들려주세요" : "이 일 중 기억나는 경험 하나를 들려주세요"}</h1>
      <p className="xp-sub">말하듯 적으면 돼요. 날짜나 성과는 없어도 괜찮아요.</p>
      {given && <p className="xp-given">{fromDiagnosis ? "진단에서 짚은 문장" : "처음에 적은 내용"} “{given}”{fromDiagnosis ? "" : " · 다시 쓰지 않아도 돼요"}</p>}
      <form className="xp-compose" onSubmit={async e => {
        e.preventDefault();
        if (!normalizeText(value)) { setError("기억나는 내용을 적어 주세요."); return; }
        setSending(true);
        const problem = await startStory(value, consent);
        setSending(false);
        if (problem) setError(problem);
      }}>
        <label htmlFor="xp-story" className="xp-sr">경험 이야기</label>
        <AutoTextarea id="xp-story" minRows={7} maxLength={8000} value={value} onChange={v => update(s => setDraft(s, exp.id, "story", v))}
          placeholder="무슨 일이었고, 내가 무엇을 했는지 생각나는 대로요." />
        {!state.consentAt && (
          <label className="xp-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
            <span><b>(필수)</b> 적은 내용은 경험 정리와 문장 생성에만 쓰여요. 정리할 때 AI(Anthropic)로 전송될 수 있어요. 문의·삭제: <a href="mailto:aro.deeply@gmail.com">aro.deeply@gmail.com</a></span></label>
        )}
        <Turnstile onToken={setToken} />
        {error && <p className="xp-error" role="alert">{error}</p>}
        <button type="submit" className="xp-btn xp-btn--wide" disabled={sending}>{sending ? "확인하는 중…" : "다음"}</button>
      </form>
    </section>
  );
}

// ---------- 3-2. 질문 대화 ----------
function Bubble({ who, children, tools, why, muted, isNew }) {
  return (
    <div className={`xp-msg xp-msg--${who}${muted ? " xp-msg--muted" : ""}${isNew ? " xp-enter" : ""}`}>
      {who === "aro" && <span className="xp-avatar" aria-hidden="true">A</span>}
      <div className="xp-msg-body"><div className="xp-bubble">{children}</div>{why && <p className="xp-why">{why}</p>}{tools && <p className="xp-tools">{tools}</p>}</div>
    </div>
  );
}

function summaryLine(exp) {
  const count = kind => exp.analysis.items.filter(i => i.kind === kind).length;
  const parts = [["action", "한 일"], ["judgment", "이유"], ["criterion", "기준"], ["situation", "상황"]].filter(([k]) => count(k)).map(([k, l]) => `${l} ${count(k)}개`);
  return parts.length ? `읽어봤어요. ${parts.join(", ")}를 찾았어요.` : "읽어봤어요.";
}

function SessionGate({ setToken, retry }) {
  return (
    <div className="xp-notice" role="alert"><p>이어가려면 자동 입력 방지 확인이 한 번 더 필요해요.</p><Turnstile onToken={setToken} />
      <button type="button" className="xp-btn xp-btn--small" onClick={retry}>이어가기</button></div>
  );
}

function ChatView({ exp, update, busy, error, needGate, setToken, retry }) {
  const [expanded, setExpanded] = useState(false);
  const [formError, setFormError] = useState("");
  const shown = useRef(null);
  const tailRef = useRef(null);
  const stage = stageOf(exp);
  const q = stage === "asking" ? exp.analysis.nextQuestion : null;
  const editing = field => Object.hasOwn(exp.drafts, field);
  const bubbles = [];
  bubbles.push(<Bubble key="ask-story" who="aro">{exp.scopeId.startsWith("diagnosis-") ? "진단에서 짚은 문장 뒤의 실제 경험을 들려주세요." : `‘${exp.scopeTitle}’ 중 기억나는 경험 하나를 들려주세요.`}</Bubble>);
  bubbles.push(editing("story")
    ? <div key="story" className="xp-msg xp-msg--me"><div className="xp-msg-body xp-msg-body--wide">
        <EditForm id="xp-story-edit" label="이야기 고치기" initial={exp.drafts.story} rows={5} onDraft={v => update(s => setDraft(s, exp.id, "story", v))}
          onSave={v => update(s => commitStory(s, exp.id, v))} onCancel={() => update(s => clearDraft(s, exp.id, "story"))} /></div></div>
    : <Bubble key="story" who="me" tools={<>{exp.story.text.length > 90 && <><button type="button" className="xp-link" onClick={() => setExpanded(v => !v)}>{expanded ? "접기" : "전체 보기"}</button><span aria-hidden="true"> · </span></>}
        <button type="button" className="xp-link" data-edit="story" onClick={() => update(s => setDraft(s, exp.id, "story", exp.story.text))}>고치기</button></>}>
        <span className={expanded ? "" : "xp-clamp"}>{exp.story.text}</span></Bubble>);
  if (analysisIsCurrent(exp)) bubbles.push(<Bubble key="summary" who="aro">{summaryLine(exp)}{exp.answers.length ? "" : " 몇 가지만 더 여쭤볼게요."}</Bubble>);
  for (const a of exp.answers) {
    bubbles.push(<Bubble key={"q" + a.id} who="aro">{a.question}</Bubble>);
    const field = "answer:" + a.id;
    if (editing(field)) bubbles.push(<div key={"a" + a.id} className="xp-msg xp-msg--me"><div className="xp-msg-body xp-msg-body--wide">
      <EditForm id={"xp-edit-" + a.id} label="답변 고치기" initial={exp.drafts[field]} onDraft={v => update(s => setDraft(s, exp.id, field, v))}
        onSave={v => update(s => editAnswer(s, exp.id, a.id, v))} onCancel={() => update(s => clearDraft(s, exp.id, field))} /></div></div>);
    else bubbles.push(<Bubble key={"a" + a.id} who="me" muted={a.status !== "answered"}
      tools={<button type="button" className="xp-link" data-edit={a.id} onClick={() => update(s => setDraft(s, exp.id, field, a.text))}>{a.status === "answered" ? "고치기" : "지금 답하기"}</button>}>
      {a.status === "answered" ? a.text : a.status === "unknown" ? "기억나지 않아요" : "나중에 답할게요"}</Bubble>);
  }
  if (!busy && !error && !needGate && q) bubbles.push(<Bubble key="current" who="aro" why={q.why}><b>{q.text}</b></Bubble>);
  if (!busy && !error && !needGate && stage === "ready") bubbles.push(<Bubble key="done" who="aro">필요한 건 다 여쭤봤어요. 찾은 내용을 같이 확인해요.</Bubble>);

  // Only messages added since the last render slide in.
  const before = shown.current ?? bubbles.length;
  shown.current = bubbles.length;
  const thread = bubbles.map((b, i) => i >= before ? React.cloneElement(b, { isNew: true }) : b);
  useEffect(() => { if (exp.answers.length || busy) tailRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [bubbles.length, busy]);

  const answer = exp.drafts.answer ?? "";
  const send = status => {
    if (status === "answered" && !normalizeText(answer)) { setFormError("답을 적거나, 아래에서 골라 주세요."); return; }
    setFormError("");
    update(s => answerQuestion(s, exp.id, q, status === "answered" ? { text: answer } : { status }));
  };
  const editingTitle = editing("title");
  return (
    <section className="xp-screen xp-screen--chat">
      <header className="xp-chat-head">
        <p className="xp-context">{exp.scopeTitle}</p>
        {editingTitle ? (
          <form className="xp-inline" onSubmit={e => { e.preventDefault(); update(s => renameExperience(s, exp.id, exp.drafts.title)); }}>
            <label htmlFor="xp-title" className="xp-sr">경험 이름</label>
            <input id="xp-title" value={exp.drafts.title} maxLength={40} onChange={e => update(s => setDraft(s, exp.id, "title", e.target.value))} autoFocus />
            <button type="submit" className="xp-btn xp-btn--small">저장</button><button type="button" className="xp-link" onClick={() => update(s => clearDraft(s, exp.id, "title"))}>취소</button>
          </form>
        ) : (
          <>
            <h1 tabIndex={-1}>{displayTitle(exp)}</h1>
            <p className="xp-head-tools"><button type="button" className="xp-link" onClick={() => update(s => setDraft(s, exp.id, "title", displayTitle(exp)))}>이름 바꾸기</button>
              {stage === "asking" && <><span aria-hidden="true"> · </span><button type="button" className="xp-link" onClick={() => go(expHash(exp.id, "/review"))}>질문 그만하고 정리하기</button></>}</p>
          </>
        )}
      </header>
      <div className="xp-thread">{thread}</div>
      <div ref={tailRef}>
        {needGate ? <SessionGate setToken={setToken} retry={retry} />
          : busy || (stage === "analyzing" && !error) ? <div className="xp-msg xp-msg--aro xp-enter"><span className="xp-avatar" aria-hidden="true">A</span><div className="xp-msg-body"><div className="xp-bubble xp-typing" aria-label="정리하는 중"><i /><i /><i /></div></div></div>
          : error ? <div className="xp-notice" role="alert"><p>{ERROR_TEXT[error] || "응답을 받지 못했어요."} 적은 내용은 저장돼 있어요.</p>{!FINAL_ERRORS.has(error) && <button type="button" className="xp-btn xp-btn--small" onClick={retry}>다시 시도</button>}</div>
          : q ? (
            <form className="xp-composer" onSubmit={e => { e.preventDefault(); send("answered"); }}>
              {q.choices?.length > 0 && <div className="xp-chips" role="group" aria-label="적어 주신 일 중에서 고르기">
                {q.choices.map(c => <button type="button" key={c} className="xp-chip" onClick={() => update(s => setDraft(s, exp.id, "answer", c))}>{c}</button>)}</div>}
              <div className="xp-composer-row">
                <label htmlFor="xp-answer" className="xp-sr">답변</label>
                <AutoTextarea id="xp-answer" minRows={2} maxLength={4000} value={answer} onChange={v => update(s => setDraft(s, exp.id, "answer", v))}
                  placeholder={q.choices?.length ? "위에서 고르거나 직접 적어 주세요" : "기억나는 만큼만 적어 주세요"}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send("answered"); } }} />
                <button type="submit" className="xp-send" aria-label="답변 보내기"><SendIcon /></button>
              </div>
              {formError && <p className="xp-error" role="alert">{formError}</p>}
              <p className="xp-alt"><button type="button" className="xp-pill" onClick={() => send("unknown")}>기억나지 않아요</button><button type="button" className="xp-pill" onClick={() => send("skipped")}>나중에 답할게요</button></p>
              <p className="xp-fine">‘기억나지 않아요’는 문장에 넣지 않아요. ‘나중에’는 위에서 언제든 답할 수 있어요.</p>
            </form>
          ) : stage === "ready" ? (
            <div className="xp-next">
              <AddMore exp={exp} update={update} />
              <button type="button" className="xp-btn xp-btn--wide" onClick={() => go(expHash(exp.id, "/review"))}>핵심 확인하기</button>
            </div>
          ) : null}
      </div>
    </section>
  );
}

// Free addition after the questions: becomes one more answer the engine reads.
function AddMore({ exp, update }) {
  const [open, setOpen] = useState(false);
  const value = exp.drafts.extra ?? "";
  if (!open) return <p className="xp-aside"><button type="button" className="xp-link" onClick={() => setOpen(true)}>더 덧붙이고 싶은 말이 있어요</button></p>;
  return (
    <form className="xp-composer xp-composer--inline" onSubmit={e => {
      e.preventDefault();
      if (!normalizeText(value)) return;
      const n = exp.answers.filter(a => a.slot.startsWith("extra")).length + 1;
      update(s => answerQuestion(clearDraft(s, exp.id, "extra"), exp.id, { slot: "extra-" + n, text: "덧붙인 내용 " + n, why: "" }, { text: value }));
      setOpen(false);
    }}>
      <div className="xp-composer-row">
        <label htmlFor="xp-extra" className="xp-sr">덧붙일 내용</label>
        <AutoTextarea id="xp-extra" minRows={2} value={value} onChange={v => update(s => setDraft(s, exp.id, "extra", v))} placeholder="기억난 결과나 사실을 적어 주세요" autoFocus />
        <button type="submit" className="xp-send" aria-label="덧붙이기"><SendIcon /></button>
      </div>
    </form>
  );
}

// ---------- 4. 핵심 확인 ----------
function ReviewView({ exp, update }) {
  const items = exp.analysis?.items || [];
  const used = items.filter(i => isUsableItem(i, exp.reviews)).length;
  const core = coreMessage(exp);
  const editingCore = Object.hasOwn(exp.drafts, "angle");
  const [openList, setOpenList] = useState(!core);
  const toggle = (item, checked) => update(s => reviewItem(s, exp.id, item.key,
    checked ? (item.basis === "interpretation" ? "confirmed" : null) : (item.basis === "interpretation" ? null : "excluded")));
  const interpretations = items.filter(i => needsConfirmation(i, exp.reviews)).length;
  return (
    <section className="xp-screen">
      <p className="xp-context">{displayTitle(exp)}</p>
      <h1 tabIndex={-1}>{core ? "이 경험의 핵심을 이렇게 봤어요" : "문장에 넣을 내용을 확인해 주세요"}</h1>
      {core && (editingCore ? (
        <EditForm id="xp-angle" label="핵심 한 줄 고치기" initial={exp.drafts.angle} rows={2} className="xp-edit"
          onDraft={v => update(s => setDraft(s, exp.id, "angle", v))} onSave={v => update(s => setAngle(s, exp.id, v))} onCancel={() => update(s => clearDraft(s, exp.id, "angle"))} />
      ) : (
        <div className="xp-core">
          <p className="xp-core-text">{core}</p>
          <p className="xp-fine">평가자가 이 경험에서 눈여겨볼 지점이에요. 결과 문장은 이 한 줄을 중심으로 써요.</p>
          <p className="xp-core-tools">
            <button type="button" className="xp-link" onClick={() => update(s => setDraft(s, exp.id, "angle", core))}>내 말로 고치기</button>
            {exp.angleOverride && <><span aria-hidden="true"> · </span><button type="button" className="xp-link" onClick={() => update(s => setAngle(s, exp.id, ""))}>처음 제안으로 되돌리기</button></>}
          </p>
        </div>
      ))}
      <details className="xp-fold xp-fold--list" open={openList} onToggle={e => setOpenList(e.currentTarget.open)}>
        <summary>근거로 쓸 내용 {used}개{interpretations ? ` · 확인할 해석 ${interpretations}개` : ""}</summary>
        <p className="xp-fine">체크한 것만 문장에 써요. 틀린 건 고쳐 주세요.</p>
        {ITEM_KINDS.map(kind => {
          const list = items.filter(i => i.kind === kind && exp.reviews[i.key]?.decision !== "replaced");
          if (!list.length) return null;
          return (
            <section key={kind} className="xp-group"><h2>{KIND_NAMES[kind]}</h2>
              <ul>{list.map(item => {
                const field = "item:" + item.key;
                if (Object.hasOwn(exp.drafts, field)) return <li key={item.key} className="xp-row xp-row--editing">
                  <EditForm id="xp-reword" label="고쳐 쓰기" initial={exp.drafts[field]} rows={2} className="xp-edit xp-edit--flat"
                    onDraft={v => update(s => setDraft(s, exp.id, field, v))} onSave={v => update(s => rewordItem(s, exp.id, item, v))} onCancel={() => update(s => clearDraft(s, exp.id, field))} /></li>;
                const on = isUsableItem(item, exp.reviews);
                const quote = item.evidence.map(e => e.quote).join(" / ");
                return (
                  <li key={item.key} className={"xp-row" + (on ? "" : " xp-row--off")} data-item={item.text}>
                    <label className="xp-check"><input type="checkbox" checked={on} onChange={e => toggle(item, e.target.checked)} /><span className="xp-box"><CheckIcon /></span>
                      <span className="xp-row-text"><span>{item.text}</span>
                        {item.basis === "interpretation" && <em className="xp-tag xp-tag--ask">AI 해석 · 맞으면 체크</em>}
                        {item.origin === "user" && <em className="xp-tag">내가 고친 문장</em>}
                        {normalizeText(quote) !== normalizeText(item.text) && <small>내가 쓴 말 “{quote}”</small>}</span></label>
                    {item.origin !== "user" && <button type="button" className="xp-link" onClick={() => update(s => setDraft(s, exp.id, field, item.text))}>고치기</button>}
                  </li>
                );
              })}</ul>
            </section>
          );
        })}
      </details>
      <div className="xp-bottom"><button type="button" className="xp-btn" disabled={!used} onClick={() => go(expHash(exp.id, "/result"))}>{core ? "이 핵심으로 문장 만들기" : "문장 만들기"}</button></div>
    </section>
  );
}

// ---------- 5. 결과: 이 경험을 쓰는 법 ----------
function Evidence({ ids, items }) {
  const quotes = [...new Set(ids.map(id => items.find(i => i.id === id)).filter(Boolean).flatMap(i => i.evidence.map(e => e.quote)))];
  if (!quotes.length) return null;
  return <details className="xp-evidence"><summary>근거 {quotes.length}개</summary><ul>{quotes.map(q => <li key={q}>“{q}”</li>)}</ul></details>;
}

function ScriptEvidence({ lines, items }) {
  return (
    <details className="xp-evidence"><summary>문장별 근거</summary>
      <ol className="xp-script-evidence">{lines.map((l, i) => {
        const quotes = [...new Set(l.itemIds.map(id => items.find(it => it.id === id)).filter(Boolean).flatMap(it => it.evidence.map(e => e.quote)))];
        return <li key={i}><p className="xp-script-line">{l.text}</p><p>{quotes.map(q => `“${q}”`).join(" ")}</p></li>;
      })}</ol>
    </details>
  );
}

function ResultView({ exp, busy, error, needGate, setToken, retry, copy, download, several, remake }) {
  const head = <><p className="xp-context">{exp.scopeTitle}</p><h1 tabIndex={-1}>{displayTitle(exp)}</h1></>;
  if (needGate) return <section className="xp-screen">{head}<SessionGate setToken={setToken} retry={retry} /></section>;
  if (error) return <section className="xp-screen">{head}<div className="xp-notice" role="alert"><p>{ERROR_TEXT[error] || "응답을 받지 못했어요."}</p>{!FINAL_ERRORS.has(error) && <button type="button" className="xp-btn xp-btn--small" onClick={retry}>다시 시도</button>}</div></section>;
  if (busy || !resultIsCurrent(exp)) return <section className="xp-screen">{head}<div className="xp-loading" aria-busy="true"><div className="xp-bubble xp-typing"><i /><i /><i /></div><p>평가자 관점으로 정리하고 있어요</p></div></section>;
  const r = exp.result, items = exp.analysis.items;
  const local = r.engine === "local";
  const unconfirmed = items.filter(i => needsConfirmation(i, exp.reviews)).length;
  const left = [...(r.gaps || []), ...(r.held || []).map(h => `뺀 문장 “${h.text}”: ${h.reason}`), ...(unconfirmed ? [`확인하지 않은 AI 해석 ${unconfirmed}개는 넣지 않았어요.`] : [])];
  return (
    <section className="xp-screen xp-result">
      {head}
      {local && <p className="xp-notice xp-notice--flat">지금은 AI 연결 없이 정리해서, 적어 주신 말을 다듬지 않고 모았어요.</p>}

      {r.headline && (
        <article className="xp-hero" id="xp-headline">
          <p className="xp-label">이 경험이 보여주는 것</p>
          <p className="xp-hero-text">{r.headline.text}</p>
          <Evidence ids={r.headline.itemIds} items={items} />
        </article>
      )}

      {r.useFor?.length > 0 && (
        <article className="xp-card" id="xp-usefor"><header><h2>이럴 때 꺼내 쓰세요</h2></header>
          <ul className="xp-use">{r.useFor.map(u => <li key={u}>{u}</li>)}</ul></article>
      )}

      <article className="xp-card" id="xp-resume"><header><h2>이력서 문장</h2><button type="button" className="xp-btn xp-btn--ghost xp-btn--small" onClick={() => copy("resume")}>복사</button></header>
        <p className="xp-fine">그대로 붙여 쓰면 돼요.</p>
        {r.resume.length ? <ul className="xp-lines">{r.resume.map((l, i) => (
          <li key={i} className="xp-line"><span className="xp-dotmark" aria-hidden="true" /><div><p>{l.text}</p><Evidence ids={l.itemIds} items={items} /></div></li>
        ))}</ul> : <p className="xp-fine">근거가 있는 문장이 아직 없어요.</p>}</article>

      <article className="xp-card" id="xp-interview"><header><h2>면접 답변</h2><button type="button" className="xp-btn xp-btn--ghost xp-btn--small" onClick={() => copy("interview")}>복사</button></header>
        <p className="xp-q">“{r.interview.question}”</p>
        {r.interview.lines.length ? (local
          ? <ol className="xp-lines">{r.interview.lines.map((l, i) => <li key={i} className="xp-line"><span className="xp-num">{i + 1}</span><div><p>{l.text}</p><Evidence ids={l.itemIds} items={items} /></div></li>)}</ol>
          : <><p className="xp-script">{r.interview.lines.map(l => l.text).join(" ")}</p>
              <p className="xp-fine">{Math.max(20, Math.round(r.interview.lines.map(l => l.text).join(" ").length / 7.5))}초 안팎으로 말하는 분량이에요. 외우기보다 순서만 기억하세요.</p>
              <ScriptEvidence lines={r.interview.lines} items={items} /></>)
          : <div className="xp-notice xp-notice--flat"><p>면접 답변을 만들지 못했어요. 적은 내용은 그대로예요.</p>
              {!local && <button type="button" className="xp-btn xp-btn--small" onClick={remake}>결과 다시 만들기</button>}</div>}
        {r.followUps?.length > 0 && (
          <div className="xp-follow"><p className="xp-label">이어서 받을 질문</p>
            {r.followUps.map(f => <div key={f.question} className="xp-follow-item"><p className="xp-follow-q">{f.question}</p><p className="xp-follow-a">{f.point}</p></div>)}</div>
        )}
      </article>

      {r.cautions?.length > 0 && (
        <article className="xp-card xp-card--warn" id="xp-cautions"><header><h2>평가자에게 이렇게 읽힐 수 있어요</h2></header>
          {r.cautions.map(c => (
            <div key={c.quote} className="xp-caution">
              <p className="xp-caution-quote">“{c.quote}”</p>
              <p className="xp-caution-why">{c.why}</p>
              <p className="xp-caution-instead"><b>이렇게 말해 보세요</b> {c.instead}</p>
            </div>
          ))}</article>
      )}

      {r.strengthen?.length > 0 && (
        <article className="xp-card" id="xp-strengthen"><header><h2>더 강해지려면</h2></header>
          <p className="xp-fine">아래가 확인되면 문장이 더 단단해져요. 기억나는 게 있으면 덧붙여 주세요.</p>
          <ul className="xp-use">{r.strengthen.map(t => <li key={t}>{t}</li>)}</ul>
          <p className="xp-aside xp-left"><button type="button" className="xp-link" onClick={() => go(expHash(exp.id))}>대화로 돌아가 덧붙이기</button></p></article>
      )}

      {left.length > 0 && <details className="xp-fold"><summary>넣지 않은 내용 {left.length}개</summary><ul>{left.map(g => <li key={g}>{g}</li>)}</ul></details>}
      <div className="xp-bottom"><button type="button" className="xp-btn xp-btn--ghost" onClick={() => go(expHash(exp.id, "/review"))}>핵심 고치기</button>
        <button type="button" className="xp-btn" onClick={() => copy("all")}>전체 복사</button></div>
      <p className="xp-aside">{several && <><button type="button" className="xp-link" onClick={() => go("#xp/pick")}>다른 일도 정리하기</button><span aria-hidden="true"> · </span></>}
        <button type="button" className="xp-link" onClick={download}>파일로 저장</button></p>
      <p className="xp-fine xp-center">본인이 적은 내용만 근거로 썼어요. 사실 여부를 따로 확인하지는 않았어요.</p>
    </section>
  );
}
