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
