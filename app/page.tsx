"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Screen = "menu" | "loading" | "game" | "boss" | "result";
type BoxStatus = "active" | "warning" | "danger";
type Mode = "easy" | "hard";

type FloatingBox = {
  id: number;
  word: string;
  elapsedMs: number;
  status: BoxStatus;
  x: number;
  y: number;
};

const WORD_POOL = [
  "box", "apple", "honey", "cloud", "water", "green", "light", "hello",
  "tiger", "smile", "dream", "music", "stone", "river", "happy", "super",
  "flame", "brave", "swift", "quiet", "ocean", "blaze", "frost", "pixel",
  "spark", "lunar", "crisp", "vivid", "gloom", "prism",
];

const ROUND_BOXES = 10;
const POINT_PER_BOX = 100;
const MAX_LIVES = 3;
const LOADING_MS = 1800;

const MODE_CONFIG = {
  easy: {
    spawnIntervalMs: 1400,
    warningMs: 5000,
    dangerMs: 8000,
    expireMs: 10000,
    maxOnScreen: 3,
    bossHp: 3,
    bossComboSize: 3,
    bossTimeMs: 12000,
    label: "Easy",
  },
  hard: {
    spawnIntervalMs: 1000,
    warningMs: 3000,
    dangerMs: 5500,
    expireMs: 7000,
    maxOnScreen: 4,
    bossHp: 3,
    bossComboSize: 4,
    bossTimeMs: 9000,
    label: "Hard",
  },
};

function randomWords(count: number, exclude: string[] = []): string[] {
  const pool = WORD_POOL.filter((w) => !exclude.includes(w));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function makeBox(id: number, word: string): FloatingBox {
  return {
    id,
    word,
    elapsedMs: 0,
    status: "active",
    x: 8 + Math.random() * 72,
    y: 12 + Math.random() * 62,
  };
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<Mode>("easy");

  // Normal game state
  const [boxes, setBoxes] = useState<FloatingBox[]>([]);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [spawnedCount, setSpawnedCount] = useState(0);
  const [clearedCount, setClearedCount] = useState(0);
  const [nextId, setNextId] = useState(1);

  // Boss state
  const [bossHp, setBossHp] = useState(3);
  const [bossCombo, setBossCombo] = useState<string[]>([]);
  const [bossTyped, setBossTyped] = useState<string[]>([]);
  const [bossElapsedMs, setBossElapsedMs] = useState(0);
  const [bossRound, setBossRound] = useState(0);
  const [bossAttacking, setBossAttacking] = useState(false);
  const [bossInput, setBossInput] = useState("");

  const [resultMessage, setResultMessage] = useState("");

  const cfg = MODE_CONFIG[mode];
  const allSpawned = spawnedCount >= ROUND_BOXES;

  // ─── Loading → Game ───────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "loading") return;
    const t = setTimeout(() => setScreen("game"), LOADING_MS);
    return () => clearTimeout(t);
  }, [screen]);

  // ─── Spawner ──────────────────────────────────────────────────────
  const spawnedRef = useRef(spawnedCount);
  const nextIdRef = useRef(nextId);
  spawnedRef.current = spawnedCount;
  nextIdRef.current = nextId;

  useEffect(() => {
    if (screen !== "game" || allSpawned) return;

    const spawner = setInterval(() => {
      if (spawnedRef.current >= ROUND_BOXES) return;

      setBoxes((prev) => {
        if (prev.length >= cfg.maxOnScreen) return prev;
        const usedWords = prev.map((b) => b.word);
        const [word] = randomWords(1, usedWords);
        if (!word) return prev;
        return [...prev, makeBox(nextIdRef.current, word)];
      });
      setSpawnedCount((p) => Math.min(p + 1, ROUND_BOXES));
      setNextId((p) => p + 1);
    }, cfg.spawnIntervalMs);

    return () => clearInterval(spawner);
  }, [screen, allSpawned, cfg.spawnIntervalMs, cfg.maxOnScreen]);

  // ─── Ticker ───────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "game") return;

    const ticker = setInterval(() => {
      setBoxes((prev) => {
        let expired = 0;
        const next: FloatingBox[] = [];

        for (const box of prev) {
          const elapsed = box.elapsedMs + 100;
          if (elapsed >= cfg.expireMs) {
            expired += 1;
            continue;
          }
          let status: BoxStatus = "active";
          if (elapsed >= cfg.dangerMs) status = "danger";
          else if (elapsed >= cfg.warningMs) status = "warning";
          next.push({ ...box, elapsedMs: elapsed, status });
        }

        if (expired > 0) {
          setLives((l) => Math.max(l - expired, 0));
          setClearedCount((c) => c + expired); // 👈 KEY FIX
        }

        return next;
      });
    }, 100);

    return () => clearInterval(ticker);
  }, [screen, cfg.expireMs, cfg.dangerMs, cfg.warningMs]);

  // ─── Game over / boss transition ─────────────────────────────────
  useEffect(() => {
    if (screen !== "game") return;

    if (lives <= 0) {
      setResultMessage("Game Over! You ran out of lives.");
      setScreen("result");
      return;
    }

    if (spawnedCount >= ROUND_BOXES && boxes.length === 0) {
      // Enter boss fight
      startBossRound(1, cfg.bossHp);
      setScreen("boss");
    }
  }, [screen, lives, clearedCount, boxes.length, allSpawned]);

  // ─── Normal game input ────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const typed = input.trim().toLowerCase();
    if (!typed) return;

    const target = boxes.find((b) => b.word === typed);
    if (target) {
      setBoxes((prev) => prev.filter((b) => b.id !== target.id));
      setScore((s) => s + POINT_PER_BOX);
      setClearedCount((c) => c + 1);
    }
    setInput("");
  };

  // ─── Boss fight logic ─────────────────────────────────────────────
  const startBossRound = (round: number, hp: number) => {
    const words = randomWords(cfg.bossComboSize);
    setBossCombo(words);
    setBossTyped([]);
    setBossElapsedMs(0);
    setBossRound(round);
    setBossHp(hp);
    setBossAttacking(false);
    setBossInput("");
  };

  // Boss ticker
  useEffect(() => {
    if (screen !== "boss" || bossAttacking) return;

    const ticker = setInterval(() => {
      setBossElapsedMs((e) => {
        const next = e + 100;
        if (next >= cfg.bossTimeMs) {
          // Time's up — boss attacks
          clearInterval(ticker);
          triggerBossAttack();
        }
        return next;
      });
    }, 100);

    return () => clearInterval(ticker);
  }, [screen, bossAttacking, bossRound, cfg.bossTimeMs]);

  const triggerBossAttack = () => {
    setBossAttacking(true);
    setLives((l) => {
      const next = Math.max(l - 1, 0);
      if (next <= 0) {
        setTimeout(() => {
          setResultMessage("Game Over! The boss defeated you.");
          setScreen("result");
        }, 800);
      } else {
        setTimeout(() => {
          setBossRound((r) => {
            startBossRound(r + 1, bossHp);
            return r + 1;
          });
        }, 1200);
      }
      return next;
    });
  };

  const handleBossInput = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const typed = bossInput.trim().toLowerCase();
    if (!typed || bossAttacking) return;

    if (bossCombo.includes(typed) && !bossTyped.includes(typed)) {
      const newTyped = [...bossTyped, typed];
      setBossTyped(newTyped);
      setBossInput("");

      if (newTyped.length === bossCombo.length) {
        // All words typed — boss takes damage
        const newHp = bossHp - 1;
        setBossHp(newHp);
        setScore((s) => s + POINT_PER_BOX * cfg.bossComboSize);
        if (newHp <= 0) {
          setResultMessage(`Stage Clear! You defeated the boss! Final score: ${score + POINT_PER_BOX * cfg.bossComboSize}`);
          setTimeout(() => setScreen("result"), 600);
        } else {
          setTimeout(() => startBossRound(bossRound + 1, newHp), 800);
        }
      }
    } else {
      setBossInput("");
    }
  };

  // ─── Return to menu after result ─────────────────────────────────
  useEffect(() => {
    if (screen !== "result") return;
    const t = setTimeout(() => setScreen("menu"), 3500);
    return () => clearTimeout(t);
  }, [screen]);

  const startGame = () => {
    setInput("");
    setBossInput("");
    setScore(0);
    setLives(MAX_LIVES);
    setSpawnedCount(0);
    setClearedCount(0);
    setNextId(1);
    setBoxes([]);
    setResultMessage("");
    setBossHp(cfg.bossHp);
    setScreen("loading");
  };

  const activeWords = useMemo(() => boxes.map((b) => b.word), [boxes]);
  const bossTimePct = Math.max(0, 100 - (bossElapsedMs / cfg.bossTimeMs) * 100);

  return (
    <main className="page">
      {/* ── MENU ─────────────────────────────────────────────── */}
      {screen === "menu" && (
        <section className="menu-card">
          <h1>Type Speed Game</h1>
          <p>Clear 10 words, then defeat the boss. Choose your difficulty:</p>
          <div className="mode-row">
            <button
              className={`mode-btn ${mode === "easy" ? "selected" : ""}`}
              onClick={() => setMode("easy")}
            >
              Easy
            </button>
            <button
              className={`mode-btn ${mode === "hard" ? "selected" : ""}`}
              onClick={() => setMode("hard")}
            >
              Hard
            </button>
          </div>
          <div className="mode-info">
            {mode === "easy"
              ? "3 words per boss combo · 12s timer · slower spawns"
              : "4 words per boss combo · 9s timer · faster spawns"}
          </div>
          <button className="start-btn" onClick={startGame}>
            Start Game
          </button>
        </section>
      )}

      {/* ── LOADING ──────────────────────────────────────────── */}
      {screen === "loading" && (
        <section className="menu-card">
          <h1>Loading…</h1>
          <p>Preparing your {cfg.label} run.</p>
          <div className="loader" />
        </section>
      )}

      {/* ── GAME ─────────────────────────────────────────────── */}
      {screen === "game" && (
        <section className="game-wrap">
          <header className="hud">
            <span>Score: {score}</span>
            <span>
              {"❤️".repeat(lives)}{"🤍".repeat(Math.max(MAX_LIVES - lives, 0))}
            </span>
            <span>
              {clearedCount}/{ROUND_BOXES} cleared
            </span>
          </header>

          <div className="playfield">
            {boxes.map((box) => (
              <div
                key={box.id}
                className={`floating-box ${box.status}`}
                style={{ left: `${box.x}%`, top: `${box.y}%` }}
              >
                {box.word}
                <div className="timer-bar">
                  <div
                    className="timer-fill"
                    style={{
                      width: `${100 - (box.elapsedMs / cfg.expireMs) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {allSpawned && boxes.length === 0 && (
              <div className="floating-box active center-message">
                Entering boss fight…
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="input-wrap">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                activeWords.length > 0
                  ? `Type: ${activeWords[0]}`
                  : "Wait for next box…"
              }
              autoFocus
            />
            <button type="submit">Enter</button>
          </form>
        </section>
      )}

      {/* ── BOSS ─────────────────────────────────────────────── */}
      {screen === "boss" && (
        <section className="game-wrap">
          <header className="hud">
            <span>Score: {score}</span>
            <span>
              {"❤️".repeat(lives)}{"🤍".repeat(Math.max(MAX_LIVES - lives, 0))}
            </span>
            <span className="boss-hp-label">
              Boss HP: {"💀".repeat(bossHp)}{"⬜".repeat(Math.max(cfg.bossHp - bossHp, 0))}
            </span>
          </header>

          <div className="boss-arena">
            <div className={`boss-sprite ${bossAttacking ? "attacking" : ""}`}>
              👾
            </div>

            <div className="boss-timer-bar">
              <div
                className={`boss-timer-fill ${bossTimePct < 30 ? "danger" : ""}`}
                style={{ width: `${bossTimePct}%` }}
              />
            </div>

            <p className="boss-prompt">
              {bossAttacking
                ? "Boss attacks! Brace yourself…"
                : `Type all ${cfg.bossComboSize} words before time runs out!`}
            </p>

            <div className="boss-combo">
              {bossCombo.map((word) => (
                <span
                  key={word}
                  className={`combo-word ${bossTyped.includes(word) ? "done" : ""}`}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>

          <form onSubmit={handleBossInput} className="input-wrap">
            <input
              value={bossInput}
              onChange={(e) => setBossInput(e.target.value)}
              placeholder="Type a boss word…"
              autoFocus
              disabled={bossAttacking}
            />
            <button type="submit" disabled={bossAttacking}>
              Enter
            </button>
          </form>
        </section>
      )}

      {/* ── RESULT ───────────────────────────────────────────── */}
      {screen === "result" && (
        <section className="menu-card">
          <h1>{resultMessage.includes("Clear") ? "🎉 Stage Clear!" : "💀 Game Over"}</h1>
          <p>{resultMessage}</p>
          <p style={{ opacity: 0.6, fontSize: "0.9rem" }}>Returning to menu…</p>
        </section>
      )}
    </main>
  );
}
