# Local Chromium testing in a restricted container

Verified 2026-10-25 on Ubuntu 24.04 with Node 24 and Playwright 1.64.1.

## Prefer Playwright's matching browser

```bash
npm ci
npx playwright install --with-deps chromium
npx playwright test e2e/network-state-courses.spec.ts --project=chromium
```

Use the browser revision selected by the installed Playwright package. Follow https://playwright.dev/docs/browsers for supported proxy, certificate, timeout, and download-host settings. Do not disable certificate verification or bypass network policy.

In this environment, the requested archive returned HTTP 200 with a 195-byte HTML `Site Unavailable` page. The unzip error was therefore misleading. Check response content type, size, and archive validity before repeatedly retrying. A successful HTTP status alone does not establish a successful browser download.

## Verified fallback: separately packaged headless Chromium

The maintainer documents Playwright support at https://github.com/Sparticuz/chromium#usage-with-playwright. This is an independent Chromium distribution, not Playwright's matching patched browser. Keep the standard CI browser as the compatibility authority.

Install separately so application dependencies and lockfiles remain unchanged:

```bash
npm install --prefix /tmp/homiehouse-browser-tools --no-audit --no-fund --ignore-scripts @sparticuz/chromium@153.0.0
```

The package's automatic extractor attempted an unsupported ownership change (`EINVAL: chown /tmp/fonts`). Manual Brotli extraction plus `tar --no-same-owner` worked:

```bash
mkdir -p /tmp/homiehouse-chromium
node --input-type=module <<'JS'
import fs from 'node:fs';
import zlib from 'node:zlib';
const bin = '/tmp/homiehouse-browser-tools/node_modules/@sparticuz/chromium/bin';
for (const name of ['chromium', 'fonts.tar', 'swiftshader.tar']) {
  fs.writeFileSync('/tmp/homiehouse-chromium/' + name,
    zlib.brotliDecompressSync(fs.readFileSync(bin + '/' + name + '.br')));
}
fs.chmodSync('/tmp/homiehouse-chromium/chromium', 0o755);
JS
tar --no-same-owner -xf /tmp/homiehouse-chromium/fonts.tar -C /tmp/homiehouse-chromium
tar --no-same-owner -xf /tmp/homiehouse-chromium/swiftshader.tar -C /tmp/homiehouse-chromium
/tmp/homiehouse-chromium/chromium --version
```

Result: `Chromium 153.0.8010.0`. Archive presence, executable presence, and actual browser launch were each verified independently.

### Launch options

Use these options in a temporary local Playwright config, alongside the repository's testDir, baseURL, and webServer setup:

```js
import chromium from '/tmp/homiehouse-browser-tools/node_modules/@sparticuz/chromium/build/index.js';

const launchOptions = {
  executablePath: '/tmp/homiehouse-chromium/chromium',
  args: chromium.args.filter(arg => arg !== '--single-process'),
};
```

Removing `--single-process` was necessary: reusing the browser across Playwright contexts otherwise caused `Target page, context or browser has been closed`. The maintainer's serverless flags include reduced sandboxing; use this fallback only for controlled local fixtures, not as a general browser for untrusted sites.

Run with `LD_LIBRARY_PATH=/tmp/homiehouse-chromium` so the extracted graphics libraries resolve. This fallback does not require changing the checked-in CI config or adding browser packages to the app.

### Production-build verification

Public Next.js variables must exist at build time, not only when starting the server:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=ci-mock-project-id \
NEXT_PUBLIC_HYPERSNAP_URL=http://127.0.0.1:3001 \
HYPERSNAP_FALLBACK_URL=http://127.0.0.1:3001 \
npm run build
```

The mock WalletConnect ID is for local rendering only; it does not validate wallet connectivity. Without it, the production client hit the global error boundary before course controls could render.

The temporary config used one worker, headless launch options above, the existing Hypersnap fixture on port 3001, and `npm run start -- --hostname 127.0.0.1` on port 3000. Start the server and browser from the same tool execution network context in isolated environments.

## Course validation results

All three scenarios in `e2e/network-state-courses.spec.ts` passed against the production build in 16.1 seconds:

- Real catalog, reading, plan API, lesson player, source links and quiz feedback at 390px.
- The same flow at 1280px, including no horizontal overflow.
- Failed start, visible retry error, successful retry, and retained completion progress.

The tests dismiss the separately tested migration guide via its normal persisted preference, and identify the first quiz by its question text rather than a duplicated header label. No lesson or plan API is mocked in the happy paths. The retry scenario intentionally mocks the initial 503, then removes the interception.

These results cover guest course flows on a fallback browser. They do not prove authenticated production database/reward claims, wallet connection, or compatibility with Playwright's expected Chromium 156. CI should still run its matching bundled browser.
