"""Optional local browser check (not part of CI): loads the built game in headless Chromium and reports asset results.

Usage: npm run build && npx vite preview --port 4173 &   then   python3 scripts/browser-check.py [url] [screenshot.png]
Requires: pip install playwright && playwright install chromium
"""
import json
import sys

from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/"
shot = sys.argv[2] if len(sys.argv) > 2 else "browser-check.png"

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    page = browser.new_page(viewport={"width": 430, "height": 900}, device_scale_factor=2)
    errors, bad_responses = [], []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("response", lambda r: bad_responses.append(f"{r.status} {r.url}") if r.status >= 400 else None)
    page.goto(url)
    page.wait_for_function("document.body.dataset.assetsSvg !== undefined", timeout=30000)
    page.wait_for_timeout(500)
    data = page.evaluate("({svg: document.body.dataset.assetsSvg, audio: document.body.dataset.assetsAudio, failed: document.body.dataset.assetsFailed})")
    page.mouse.click(200, 400)  # user gesture: unlocks audio and plays ui-click
    page.wait_for_timeout(400)
    audio = page.evaluate("""async () => {
      const urls = performance.getEntriesByType('resource').map(r => r.name).filter(n => n.endsWith('.wav'));
      const ctx = new AudioContext();
      const out = [];
      for (const u of urls) {
        const buf = await ctx.decodeAudioData(await (await fetch(u)).arrayBuffer());
        out.push({ file: u.split('/').pop(), seconds: +buf.duration.toFixed(2), channels: buf.numberOfChannels, rate: buf.sampleRate });
      }
      return { state: ctx.state, decoded: out };
    }""")
    page.screenshot(path=shot, full_page=True)
    browser.close()

print(json.dumps({"assets": data, "console_errors": errors, "http_errors": bad_responses, "wav_decode": audio}, indent=2))


# --- Persistence check: run, pause (saves), reload, expect the same depot to resume. Uses a fresh browser context. ---
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 430, "height": 900})
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.goto(url)
    page.wait_for_function("document.body.dataset.simTick !== undefined", timeout=30000)
    first_boot = page.evaluate("document.body.dataset.boot")
    page.wait_for_function("Number(document.body.dataset.simTick) >= 3", timeout=15000)
    page.evaluate("""() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    }""")
    page.wait_for_function("document.body.dataset.saveStatus === 'ok'", timeout=5000)
    saved_tick = int(page.evaluate("document.body.dataset.simTick"))
    stored = page.evaluate("Object.keys(localStorage).filter(k => k.startsWith('idle-depot:'))")
    page.reload()
    page.wait_for_function("document.body.dataset.simTick !== undefined", timeout=30000)
    second_boot = page.evaluate("document.body.dataset.boot")
    resumed_tick = int(page.evaluate("document.body.dataset.simTick"))
    browser.close()

print(json.dumps({
    "persistence": {
        "first_boot": first_boot, "saved_at_tick": saved_tick, "storage_keys": stored,
        "second_boot": second_boot, "tick_after_reload": resumed_tick, "errors": errs,
    }
}, indent=2))
