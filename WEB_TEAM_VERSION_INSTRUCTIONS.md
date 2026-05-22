# Web Team — Version File Instructions (for Mobile WebView)

Purpose
- Provide a simple, reliable signal the mobile app can fetch before opening its WebView. The app uses this file to detect deployments and decide whether to force a fresh load of the WebView.

File Location & URL
- Place the file at a stable, public path on your site, for example:
  - `/version.json` or
  - `/webview-version.txt`
- Example absolute URL: `https://your-domain.com/version.json`

Format (choose one)

1) JSON (recommended):

```json
{
  "version": "2026-05-22-01",
  "build": "a1b2c3d",
  "timestamp": "2026-05-22T12:34:56Z"
}
```

- The app uses the `version` value (string). Extra fields are optional and for debugging.

2) Plain text (simpler):

```
2026-05-22-01
```

Update rules
- Update the value on every deployment that changes the web app content (new build, assets, or server-side changes that affect the WebView experience).
- The content MUST change when a real deploy happens — use commit SHA, build number, or timestamp to ensure uniqueness.

Caching & Headers (critical)
- The file must not be aggressively cached by CDN or browser. Recommended headers:

```
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

- Alternatively `Cache-Control: max-age=0, must-revalidate` is acceptable if you rely on revalidation.
- If using a CDN, configure it to forward requests to origin or set a very short TTL (e.g., 0–60 seconds) for this specific file path.
- Optionally provide `ETag` and `Last-Modified` headers — they can assist debugging, but the app will parse the `version` value.

CORS
- Native mobile apps typically do not require CORS for fetch. If you expect web clients to fetch this file, add permissive CORS headers:

```
Access-Control-Allow-Origin: *
```

Security
- The version file contains no secret data — keep it public.
- Do not include any PII or credentials.

CDN / Nginx examples

Nginx (serve JSON with no-cache headers):

```nginx
location = /version.json {
  add_header Cache-Control "no-cache, no-store, must-revalidate";
  add_header Pragma "no-cache";
  add_header Expires "0";
  try_files $uri =404;
}
```

Cloudflare (Page Rule):
- Create a Page Rule matching `*your-domain.com/version.json` and set `Cache Level: Bypass` or `Edge Cache TTL: 0`.

GitHub Actions (example step to write version.json using commit SHA)

```yaml
- name: Create version.json
  run: |
    echo "{\"version\": \"${{ github.sha }}\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" }" > public/version.json
- name: Deploy
  run: # your deploy command here
```

Netlify (example):
- Use a build hook or script to write `version.json` into the `public/` directory before deploy.

Validation & Testing
- After deploy, confirm `https://your-domain.com/version.json` returns the new content and the HTTP response contains `Cache-Control: no-cache` (or equivalent) from both the CDN and origin.
- Test from a mobile device (or simulator) by fetching the URL with `curl` or the app to ensure the new value is visible immediately:

```bash
curl -i https://your-domain.com/version.json
```

Acceptance Criteria for the Mobile App
- The file is reachable at the documented URL.
- The file changes value on every web deploy.
- CDN and origin respond with non-cached or revalidated headers so the app receives fresh content.

Debugging tips
- If the app does not detect a change, verify CDN cache rules and check the response headers from the CDN edge.
- For unexpected old values, test with a query string: `https://your-domain.com/version.json?ts=$(date +%s)` to bypass caches during debugging.

Notes for integrators
- If your site has separate domains/paths for `monitoring` vs `maintainance`, provide two version files or include the mode-specific version values in a single endpoint (e.g., `{ "monitoring": "v1", "maintainance": "v2" }`).
- Keep the version file small — it's fetched often.

If you'd like, I can also provide a tiny server-side script (Node, PHP, or a build script) that writes `version.json` during your CI/deploy step. Tell me which stack you use and I’ll add it.