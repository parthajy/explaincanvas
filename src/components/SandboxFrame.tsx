"use client";

import { useMemo } from "react";

/**
 * Runs model-written browser code inside a sandboxed iframe: no same-origin, no cookies, no
 * storage, no parent access. Used for interactive 3D (Three.js) and web animations.
 * The module must `export default function init(container)`; 3D modules may import "three"
 * and "three/addons/*" through the import map.
 */
const THREE_VERSION = "0.170.0";

export function SandboxFrame({ code, title, height = 420, hint }: { code: string; title: string; height?: number; hint?: string }) {
  const srcDoc = useMemo(() => {
    const safe = code.replace(/<\/script/gi, "<\\/script");
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#fff;overflow:hidden;font-family:system-ui,sans-serif}#c{width:100%;height:100%;position:relative}#c svg,#c canvas{display:block;max-width:100%}#err{position:absolute;left:8px;right:8px;bottom:8px;color:#b91c1c;font-size:12px;background:#fff8;padding:4px 6px;border-radius:6px;display:none}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/"}}</script>
</head><body><div id="c"></div><div id="err"></div>
<script type="module">
const err=document.getElementById('err');
const show=m=>{err.style.display='block';err.textContent='This scene could not start: '+m};
window.addEventListener('error',e=>show(e.message||'error'));
window.addEventListener('unhandledrejection',e=>show((e.reason&&e.reason.message)||'error'));
try{
  const blob=new Blob([${JSON.stringify(safe)}],{type:'text/javascript'});
  const mod=await import(URL.createObjectURL(blob));
  if(typeof mod.default!=='function')throw new Error('no default init(container) export');
  await mod.default(document.getElementById('c'));
}catch(e){show((e&&e.message)||String(e))}
</script></body></html>`;
  }, [code]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <iframe title={title} srcDoc={srcDoc} sandbox="allow-scripts" style={{ height }} className="block w-full" loading="lazy" />
      {hint && <div className="border-t border-border px-3 py-1.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}
