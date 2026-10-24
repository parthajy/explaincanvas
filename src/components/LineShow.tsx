"use client";

import { useEffect, useState } from "react";

/**
 * The hero's right-hand picture: a line drawing that draws itself, then switches to the next idea.
 * Pythagoras (3-4-5 with the squares filling in), then the Fibonacci tiling with its spiral.
 * One accent colour on the "answer"; everything else is white line on black. Honours reduced motion.
 */

const ACCENT = "#f5c76a";
const LINE = "#f4f4f5";
const DIM = "#3a3a3d";

const CSS = `
.ls path, .ls line, .ls rect, .ls polygon { fill: none; stroke: ${LINE}; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.ls .d { stroke-dasharray: 1; stroke-dashoffset: 1; animation: ls-draw 0.9s ease forwards; }
.ls .g { stroke: ${DIM}; stroke-width: 1; }
.ls .acc { stroke: ${ACCENT}; }
.ls .fill { fill: ${ACCENT}; fill-opacity: 0; stroke: none; animation: ls-fill 0.8s ease forwards; }
.ls text { fill: ${LINE}; font: 500 13px ui-sans-serif, system-ui, sans-serif; opacity: 0; animation: ls-fade 0.5s ease forwards; }
.ls text.acc { fill: ${ACCENT}; }
.ls text.big { font-size: 18px; letter-spacing: -0.02em; }
.ls .scene { animation: ls-scene 0.6s ease both; }
@keyframes ls-draw { to { stroke-dashoffset: 0; } }
@keyframes ls-fade { to { opacity: 1; } }
@keyframes ls-fill { to { fill-opacity: 0.12; } }
@keyframes ls-scene { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .ls .d { stroke-dashoffset: 0; animation: none; }
  .ls text { opacity: 1; animation: none; }
  .ls .fill { fill-opacity: 0.12; animation: none; }
  .ls .scene { animation: none; }
}
`;

const SCENE_MS = 8000;

function Pythagoras() {
  // Right angle at O; a = 3 units up, b = 4 units right, c = 5 along the hypotenuse. u = 22px.
  const u = 22;
  const O = { x: 150, y: 200 };
  const A = { x: O.x, y: O.y - 3 * u };
  const B = { x: O.x + 4 * u, y: O.y };
  const n = { x: 3 * u, y: -4 * u }; // outward normal of AB with length 5u
  const C1 = { x: B.x + n.x, y: B.y + n.y };
  const C2 = { x: A.x + n.x, y: A.y + n.y };
  const d = (i: number) => ({ animationDelay: `${i}s` }) as React.CSSProperties;
  const gridA = [];
  for (let i = 1; i < 3; i++) {
    gridA.push(<line key={`ah${i}`} className="g d" style={d(1.4)} x1={O.x - 3 * u} y1={A.y + i * u} x2={O.x} y2={A.y + i * u} pathLength={1} />);
    gridA.push(<line key={`av${i}`} className="g d" style={d(1.4)} x1={O.x - i * u} y1={A.y} x2={O.x - i * u} y2={O.y} pathLength={1} />);
  }
  const gridB = [];
  for (let i = 1; i < 4; i++) {
    gridB.push(<line key={`bh${i}`} className="g d" style={d(2.2)} x1={O.x} y1={O.y + i * u} x2={B.x} y2={O.y + i * u} pathLength={1} />);
    gridB.push(<line key={`bv${i}`} className="g d" style={d(2.2)} x1={O.x + i * u} y1={O.y} x2={O.x + i * u} y2={O.y + 4 * u} pathLength={1} />);
  }
  // Grid on the tilted square: lines parallel to AB and to n.
  const gridC = [];
  const ab = { x: (B.x - A.x) / 5, y: (B.y - A.y) / 5 };
  const nn = { x: n.x / 5, y: n.y / 5 };
  for (let i = 1; i < 5; i++) {
    gridC.push(<line key={`ch${i}`} className="g d" style={d(3.2)} x1={A.x + nn.x * i} y1={A.y + nn.y * i} x2={B.x + nn.x * i} y2={B.y + nn.y * i} pathLength={1} />);
    gridC.push(<line key={`cv${i}`} className="g d" style={d(3.2)} x1={A.x + ab.x * i} y1={A.y + ab.y * i} x2={C2.x + ab.x * i} y2={C2.y + ab.y * i} pathLength={1} />);
  }
  return (
    <g className="scene">
      <polygon className="d" style={d(0)} points={`${O.x},${O.y} ${A.x},${A.y} ${B.x},${B.y}`} pathLength={1} />
      <polyline className="d" style={d(0.6)} points={`${O.x + 10},${O.y} ${O.x + 10},${O.y - 10} ${O.x},${O.y - 10}`} pathLength={1} />
      <rect className="d" style={d(1)} x={O.x - 3 * u} y={A.y} width={3 * u} height={3 * u} pathLength={1} />
      {gridA}
      <text style={d(1.8)} x={O.x - 1.5 * u} y={A.y + 1.5 * u + 5} textAnchor="middle">
        a² = 9
      </text>
      <rect className="d" style={d(1.8)} x={O.x} y={O.y} width={4 * u} height={4 * u} pathLength={1} />
      {gridB}
      <text style={d(2.6)} x={O.x + 2 * u} y={O.y + 2 * u + 5} textAnchor="middle">
        b² = 16
      </text>
      <polygon className="fill" style={d(3.6)} points={`${A.x},${A.y} ${B.x},${B.y} ${C1.x},${C1.y} ${C2.x},${C2.y}`} />
      <polygon className="d acc" style={d(2.8)} points={`${A.x},${A.y} ${B.x},${B.y} ${C1.x},${C1.y} ${C2.x},${C2.y}`} pathLength={1} />
      {gridC}
      <text className="acc" style={d(3.8)} x={(A.x + C1.x) / 2} y={(A.y + C1.y) / 2 + 5} textAnchor="middle">
        c² = 25
      </text>
      <text className="big" style={d(4.6)} x={40} y={40}>
        a² + b² = c²
      </text>
      <text style={d(5.2)} x={40} y={62} fill={DIM}>
        9 + 16 = 25
      </text>
    </g>
  );
}

function Fibonacci() {
  // Squares 1,1,2,3,5,8,13 in a 21 by 13 rectangle; the spiral is a chain of quarter arcs.
  const u = 13.5;
  const ox = 58;
  const oy = 62;
  const X = (x: number) => ox + x * u;
  const Y = (y: number) => oy + y * u;
  const squares: { x: number; y: number; s: number }[] = [
    { x: 15, y: 9, s: 1 },
    { x: 15, y: 8, s: 1 },
    { x: 13, y: 8, s: 2 },
    { x: 13, y: 10, s: 3 },
    { x: 16, y: 8, s: 5 },
    { x: 13, y: 0, s: 8 },
    { x: 0, y: 0, s: 13 },
  ];
  // [from, to, radius] in unit coordinates; all arcs turn the same way.
  const arcs: [number, number, number, number, number][] = [
    [15, 10, 16, 9, 1],
    [16, 9, 15, 8, 1],
    [15, 8, 13, 10, 2],
    [13, 10, 16, 13, 3],
    [16, 13, 21, 8, 5],
    [21, 8, 13, 0, 8],
    [13, 0, 0, 13, 13],
  ];
  const step = 0.45;
  const d = (i: number) => ({ animationDelay: `${i}s` }) as React.CSSProperties;
  return (
    <g className="scene">
      {squares.map((q, i) => (
        <g key={i}>
          <rect className="d" style={d(i * step)} x={X(q.x)} y={Y(q.y)} width={q.s * u} height={q.s * u} pathLength={1} />
          {q.s >= 2 && (
            <text style={d(i * step + 0.5)} x={X(q.x + q.s / 2)} y={Y(q.y + q.s / 2) + 5} textAnchor="middle" fill={DIM}>
              {q.s}
            </text>
          )}
        </g>
      ))}
      <path
        className="d acc"
        style={{ animationDelay: `${squares.length * step + 0.3}s`, animationDuration: "2.4s" }}
        d={arcs.map(([x1, y1, x2, y2, r], i) => `${i === 0 ? `M ${X(x1)} ${Y(y1)}` : ""} A ${r * u} ${r * u} 0 0 0 ${X(x2)} ${Y(y2)}`).join(" ")}
        pathLength={1}
        strokeWidth={2.2}
      />
      <text className="big" style={d(squares.length * step + 2.6)} x={40} y={40}>
        1, 1, 2, 3, 5, 8, 13…
      </text>
      <text style={d(squares.length * step + 3.2)} x={40} y={62} fill={DIM}>
        each number is the sum of the two before it
      </text>
    </g>
  );
}

const SCENES = [Pythagoras, Fibonacci];

export function LineShow() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SCENES.length), SCENE_MS);
    return () => clearInterval(t);
  }, []);
  const Scene = SCENES[i];
  return (
    <div className="ls rounded-3xl border border-[#1f1f1f] bg-[#0f0f0f] p-4" aria-label="Line drawings of Pythagoras theorem and the Fibonacci spiral, drawing themselves">
      <style>{CSS}</style>
      <svg key={i} viewBox="0 0 400 300" className="h-auto w-full" role="img">
        <Scene />
      </svg>
      <div className="mt-2 flex items-center justify-between px-1 text-[12px] text-[#5a5a5e]">
        <span>{i === 0 ? "Pythagoras theorem" : "Fibonacci sequence"}</span>
        <span className="flex gap-1.5">
          {SCENES.map((_, k) => (
            <span key={k} className="h-1 rounded-full transition-all" style={{ width: k === i ? 16 : 6, background: k === i ? LINE : DIM }} />
          ))}
        </span>
      </div>
    </div>
  );
}
