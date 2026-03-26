"use client";

import { useEffect, useMemo, useState } from "react";

type Screen = "menu" | "loading" | "game" | "result";

type BoxStatus = "active" | "warning" | "danger";

type FloatingBox = {
  id: number;
  word: string;
  elapsedMs: number;
  status: BoxStatus;
  x: number;
  y: number;
};

const WORD_POOL = [
  "box",
  "apple",
  "honey",
  "cloud",
  "water",
  "green",
  "light",
  "hello",
  "tiger",
  "smile",
  "dream",
  "music",
  "stone",
  "river",
  "happy",
  "super",
];

const ROUND_BOXES = 10;
const POINT_PER_BOX = 100;
const MAX_LIVES = 3;
const SPAWN_INTERVAL_MS = 1200;
const WARNING_MS = 5000;
const DANGER_MS = 8000;
const EXPIRE_MS = 10000;
const LOADING_MS = 1800;

function randomWord(exclude: string[]) {
  const available = WORD_POOL.filter((word) => !exclude.includes(word));
  if (available.length === 0) {
    return WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)] as string;
  }
  return available[Math.floor(Math.random() * available.length)] as string;
}

function makeBox(id: number, usedWords: string[]): FloatingBox {
  return {
    id,
    word: randomWord(usedWords),
    elapsedMs: 0,
    status: "active",
    x: 10 + Math.random() * 70,
    y: 12 + Math.random() * 60,
  };
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [boxes, setBoxes] = useState<FloatingBox[]>([]);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [spawnedCount, setSpawnedCount] = useState(0);
  const [clearedCount, setClearedCount] = useState(0);
  const [nextId, setNextId] = useState(1);
  const [resultMessage, setResultMessage] = useState("");

  const allSpawned = spawnedCount >= ROUND_BOXES;

  useEffect(() => {
    if (screen !== "loading") {
      return;
    }

    const timer = setTimeout(() => {
      setScreen("game");
    }, LOADING_MS);

    return () => clearTimeout(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== "game" || allSpawned) {
      return;
    }

    const spawner = setInterval(() => {
      setBoxes((prev) => {
        if (prev.length >= 4 || spawnedCount >= ROUND_BOXES) {
          return prev;
        }

        const usedWords = prev.map((box) => box.word);
        return [...prev, makeBox(nextId, usedWords)];
      });
      setSpawnedCount((prev) => Math.min(prev + 1, ROUND_BOXES));
      setNextId((prev) => prev + 1);
    }, SPAWN_INTERVAL_MS);

    return () => clearInterval(spawner);
  }, [screen, allSpawned, nextId, spawnedCount]);

  useEffect(() => {
    if (screen !== "game") {
      return;
    }

    const ticker = setInterval(() => {
      setBoxes((prev) => {
        const next: FloatingBox[] = [];
        let lifeLost = 0;

        for (const box of prev) {
          const elapsedMs = box.elapsedMs + 100;

          if (elapsedMs >= EXPIRE_MS) {
            lifeLost += 1;
            continue;
          }

          let status: BoxStatus = "active";
          if (elapsedMs >= DANGER_MS) {
            status = "danger";
          } else if (elapsedMs >= WARNING_MS) {
            status = "warning";
          }

          next.push({ ...box, elapsedMs, status });
        }

        if (lifeLost > 0) {
          setLives((prevLives) => Math.max(prevLives - lifeLost, 0));
        }

        return next;
      });
    }, 100);

    return () => clearInterval(ticker);
  }, [screen]);

  useEffect(() => {
    if (screen !== "game") {
      return;
    }

    const clearedAll = clearedCount >= ROUND_BOXES;
    const noLivesLeft = lives <= 0;

    if (!clearedAll && !noLivesLeft) {
      return;
    }

    if (clearedAll) {
      setResultMessage("Stage Clear! You typed all 10 boxes.");
    } else {
      setResultMessage("Game Over! You ran out of resources.");
    }

    setScreen("result");
  }, [screen, clearedCount, lives]);

  useEffect(() => {
    if (screen !== "result") {
      return;
    }

    const timer = setTimeout(() => {
      setScreen("menu");
    }, 2800);

    return () => clearTimeout(timer);
  }, [screen]);

  const activeWords = useMemo(() => boxes.map((box) => box.word), [boxes]);

  const startGame = () => {
    setInput("");
    setScore(0);
    setLives(MAX_LIVES);
    setSpawnedCount(0);
    setClearedCount(0);
    setNextId(1);
    setBoxes([]);
    setResultMessage("");
    setScreen("loading");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const typed = input.trim().toLowerCase();
    if (!typed) {
      return;
    }

    const target = boxes.find((box) => box.word === typed);
    if (!target) {
      setInput("");
      return;
    }

    setBoxes((prev) => prev.filter((box) => box.id !== target.id));
    setScore((prev) => prev + POINT_PER_BOX);
    setClearedCount((prev) => prev + 1);
    setInput("");
  };

  return (
    <main className="page">
      {screen === "menu" && (
        <section className="menu-card">
          <h1>Type Speed Game</h1>
          <p>Minimum mode: press start and clear 10 typing boxes.</p>
          <button onClick={startGame}>Game Start</button>
        </section>
      )}

      {screen === "loading" && (
        <section className="menu-card">
          <h1>Loading...</h1>
          <p>Preparing floating boxes for this round.</p>
          <div className="loader" />
        </section>
      )}

      {screen === "game" && (
        <section className="game-wrap">
          <header className="hud">
            <span>Score: {score}</span>
            <span>
              Resource: {"❤️".repeat(lives)}
              {"🤍".repeat(Math.max(MAX_LIVES - lives, 0))}
            </span>
            <span>
              Cleared: {clearedCount}/{ROUND_BOXES}
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
              </div>
            ))}
            {allSpawned && boxes.length === 0 && (
              <div className="floating-box active center-message">Finalizing...</div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="input-wrap">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={activeWords.length > 0 ? `Type: ${activeWords[0]}` : "Wait for next box..."}
              autoFocus
            />
            <button type="submit">Type</button>
          </form>
        </section>
      )}

      {screen === "result" && (
        <section className="menu-card">
          <h1>{resultMessage}</h1>
          <p>Final score: {score}</p>
          <p>Returning to menu...</p>
        </section>
      )}
    </main>
  );
}
