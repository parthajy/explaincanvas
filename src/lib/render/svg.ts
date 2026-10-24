import sanitizeHtml from "sanitize-html";

/**
 * Model-written SVG is untrusted. Everything is stripped except presentational SVG.
 * No scripts, no event handlers, no external references, no foreignObject.
 */
const SVG_TAGS = [
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "defs", "marker", "linearGradient", "radialGradient", "stop",
  "clipPath", "title", "desc", "pattern", "symbol", "use",
];

const COMMON_ATTRS = [
  "id", "class", "transform", "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width",
  "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-opacity", "opacity",
  "font-size", "font-family", "font-weight", "text-anchor", "dominant-baseline", "letter-spacing",
  "clip-path", "marker-start", "marker-mid", "marker-end", "style",
];

const ATTRS: Record<string, string[]> = {
  svg: ["viewBox", "width", "height", "xmlns", "preserveAspectRatio", "role", "aria-label", ...COMMON_ATTRS],
  g: COMMON_ATTRS,
  path: ["d", ...COMMON_ATTRS],
  rect: ["x", "y", "width", "height", "rx", "ry", ...COMMON_ATTRS],
  circle: ["cx", "cy", "r", ...COMMON_ATTRS],
  ellipse: ["cx", "cy", "rx", "ry", ...COMMON_ATTRS],
  line: ["x1", "y1", "x2", "y2", ...COMMON_ATTRS],
  polyline: ["points", ...COMMON_ATTRS],
  polygon: ["points", ...COMMON_ATTRS],
  text: ["x", "y", "dx", "dy", "rotate", "textLength", ...COMMON_ATTRS],
  tspan: ["x", "y", "dx", "dy", ...COMMON_ATTRS],
  defs: [],
  marker: ["id", "viewBox", "refX", "refY", "markerWidth", "markerHeight", "orient", "markerUnits"],
  linearGradient: ["id", "x1", "y1", "x2", "y2", "gradientUnits", "gradientTransform"],
  radialGradient: ["id", "cx", "cy", "r", "fx", "fy", "gradientUnits"],
  stop: ["offset", "stop-color", "stop-opacity"],
  clipPath: ["id", "clipPathUnits"],
  title: [],
  desc: [],
  pattern: ["id", "x", "y", "width", "height", "patternUnits", "viewBox"],
  symbol: ["id", "viewBox"],
  use: ["href", "x", "y", "width", "height", ...COMMON_ATTRS],
};

const MAX_SVG_BYTES = 60_000;

export class SvgRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SvgRejectedError";
  }
}

/** Returns a sanitised SVG string or throws SvgRejectedError. */
export function sanitizeSvg(input: string): string {
  if (typeof input !== "string" || input.length === 0) throw new SvgRejectedError("empty svg");
  if (Buffer.byteLength(input, "utf8") > MAX_SVG_BYTES) throw new SvgRejectedError("svg too large");

  const trimmed = input.trim();
  if (!/^<svg[\s>]/i.test(trimmed)) throw new SvgRejectedError("not an <svg> root");
  if (/<script|javascript:|data:text\/html|<foreignObject|<iframe|<object|<embed/i.test(trimmed)) {
    throw new SvgRejectedError("disallowed content");
  }

  const clean = sanitizeHtml(trimmed, {
    allowedTags: SVG_TAGS,
    allowedAttributes: ATTRS,
    allowedSchemes: [],
    allowedSchemesByTag: {},
    allowProtocolRelative: false,
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
    // Only same-document fragment references are allowed on <use>.
    transformTags: {
      use: (tagName, attribs) => {
        const href = attribs.href ?? "";
        if (!href.startsWith("#")) {
          const rest = { ...attribs };
          delete rest.href;
          return { tagName, attribs: rest };
        }
        return { tagName, attribs };
      },
    },
    exclusiveFilter: (frame) => {
      // Drop any element whose style tries to load something.
      const style = frame.attribs?.style ?? "";
      return /url\(|expression\(|@import/i.test(style);
    },
  });

  if (!/^<svg[\s>]/i.test(clean.trim())) throw new SvgRejectedError("svg root lost in sanitising");
  if (!/viewBox=/.test(clean)) {
    // Give it a sane default so the player can scale it.
    return clean.replace(/^<svg/, '<svg viewBox="0 0 800 500"');
  }
  return clean;
}
