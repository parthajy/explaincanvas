import { describe, it, expect } from "vitest";
import { sanitizeSvg, SvgRejectedError } from "@/lib/render/svg";

describe("sanitizeSvg", () => {
  it("keeps presentational SVG", () => {
    const out = sanitizeSvg('<svg viewBox="0 0 800 500"><circle cx="10" cy="10" r="5" fill="#000"/><text x="1" y="2">Cell</text></svg>');
    expect(out).toContain("<circle");
    expect(out).toContain("Cell");
  });

  it("rejects scripts outright", () => {
    expect(() => sanitizeSvg('<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>')).toThrow(SvgRejectedError);
  });

  it("strips event handlers and external hrefs", () => {
    const out = sanitizeSvg('<svg viewBox="0 0 10 10"><rect onclick="x()" width="1" height="1"/><use href="https://evil.example/x.svg#a"/></svg>');
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("evil.example");
  });

  it("rejects foreignObject", () => {
    expect(() => sanitizeSvg('<svg viewBox="0 0 10 10"><foreignObject><div>x</div></foreignObject></svg>')).toThrow(SvgRejectedError);
  });

  it("adds a viewBox when missing", () => {
    expect(sanitizeSvg("<svg><rect width='1' height='1'/></svg>")).toMatch(/viewBox="0 0 800 500"/);
  });

  it("rejects non-svg roots", () => {
    expect(() => sanitizeSvg("<div>hi</div>")).toThrow(SvgRejectedError);
  });
});
