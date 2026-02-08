# Patchright Scraping Fix - Session Documentation

**Date**: 2026-02-02
**Duration**: ~2 hours
**Status**: ✅ Completed

## Session Overview

Successfully diagnosed and fixed a critical bug in the self-hosted Firecrawl/Patchright scraping stack that prevented scraping of client-side rendered websites like clawhub.ai. The root cause was an incorrect method call (`page.timeout()` instead of `page.wait_for_timeout()`) in the upstream patchright-scrape-api image. Implemented a permanent fix using volume mounts in docker-compose.yaml.

## Timeline

### 1. Initial Investigation (22:52-23:15)
- User requested scraping of https://www.clawhub.ai/steipete/gog
- Initial attempt failed with "All scraping engines failed" error
- Investigated potential causes: robots.txt, bot detection, site blocking

**Key Findings:**
- `robots.txt` is fully permissive (no blocking)
- Site hosted on Vercel with no Cloudflare protection
- Site uses TanStack Router with client-side rendering
- Chrome DevTools MCP successfully scraped the page

### 2. Root Cause Analysis (23:15-23:45)
- Analyzed Firecrawl container logs at `docker logs firecrawl`
- Found error in patchright backend: `'Page' object has no attribute 'timeout'`
- Examined patchright-scrape-api source code in container

**Technical Discovery:**
```
File: /app/app.py:374 (in container)
Bug: await page.timeout(request_model.wait_after_load)
Fix: await page.wait_for_timeout(request_model.wait_after_load)
```

**Verification:**
- Confirmed `Page.timeout` method does not exist in patchright API
- Confirmed `Page.wait_for_timeout` is the correct method
- Container using patchright v1.50.0 (8 versions behind v1.58.0)
- Upstream repo still has the bug (checked GitHub main branch)

### 3. Initial Fix Implementation (23:45-00:10)
- Applied fix directly in running container using `docker exec ... sed`
- Restarted container to load patched code
- Successfully scraped clawhub.ai with `--wait-for 5000` flag

**Test Results:**
```bash
pnpm start scrape https://www.clawhub.ai/steipete/gog --wait-for 5000
✅ Full page content retrieved including:
   - Skill metadata (v1.0.0, 37 stars, 8088 downloads)
   - Complete SKILL.md documentation
   - User comments
```

### 4. Permanent Fix Strategy (00:10-00:30)
**Problem:** Fix would be lost on container recreation

**Solution Implemented:**
1. Copied patched app.py from container to project root as `patchright-app.py`
2. Applied fix to the file using Edit tool
3. Added volume mount in `docker-compose.yaml:44`: `./patchright-app.py:/app/app.py:ro`
4. Recreated container with `docker compose up -d firecrawl-playwright`

**Verification:** Container now uses patched file on every restart

### 5. Remote CDP Exploration (00:30-01:15)
Attempted to use browserless for better anti-detection via remote CDP.

**Steps:**
1. Deployed browserless container: `browserless/chrome:latest`
2. Added `REMOTE_CDP: "browserless:3000"` to playwright service
3. Container attempted connection but failed

**Failure Reason:**
```
Error: SSL routines:ssl3_get_record:wrong version number
Issue: patchright hardcodes wss:// protocol but browserless uses ws://
Location: /app/app.py:177
Code: browser = await playwright.chromium.connect_over_cdp(f"wss://{REMOTE_CDP}")
```

**Decision:** Reverted to local Chrome, noted as future improvement opportunity

### 6. Documentation Updates (01:15-01:30)
Updated project documentation to reflect the fix:

**CLAUDE.md Changes:**
- Added "Important Files" section documenting `patchright-app.py`
- Updated "Known Issues" section to show bug is fixed
- Added volume mount explanation

**README.md Changes:**
- Added new "Self-Hosted Setup" section
- Documented all Docker services and ports
- Explained the patchright-app.py fix and why it exists

## Files Modified

| File | Purpose | Key Changes |
|------|---------|-------------|
| `patchright-app.py` | Patched container code | Created with `page.wait_for_timeout()` fix at line 374 |
| `docker-compose.yaml:44` | Container config | Added volume mount: `./patchright-app.py:/app/app.py:ro` |
| `CLAUDE.md:58-59` | Project docs | Added "Important Files" section |
| `CLAUDE.md:120-133` | Project docs | Updated "Known Issues" to reflect fix |
| `README.md:17-37` | User docs | Added "Self-Hosted Setup" section |

## Technical Decisions

### Why Volume Mount vs Custom Image?
**Chose:** Volume mount
**Reasoning:**
- Simpler to maintain (single file change vs Dockerfile + build process)
- Easier to iterate on fixes
- No image registry needed
- Transparent to see exact changes in version control

### Why Not Submit PR Upstream?
**Considered but deferred:**
- Upstream repo is actively maintained (loorisr/patchright-scrape-api)
- Bug exists in latest main branch
- Could submit PR for community benefit
- **Action Item:** Consider opening issue/PR after confirming fix works long-term

### Why Not Use Browserless?
**Attempted but blocked:**
- patchright hardcodes `wss://` protocol for CDP connections
- Would require patching app.py further (line 177)
- Local Chrome works well enough for current needs
- Browserless adds complexity without proven benefit yet

## Commands Executed

### Diagnostics
```bash
# Check Firecrawl logs for error details
docker logs firecrawl --tail 100

# Check patchright container logs
docker logs c6ae9b70b227_playwright --tail 100

# Verify patchright version and available methods
docker exec c6ae9b70b227_playwright /app/.venv/bin/python3 -c "from patchright.async_api import Page; print([m for m in dir(Page) if 'timeout' in m.lower()])"
```

### Fix Application
```bash
# Apply fix to running container
docker exec c6ae9b70b227_playwright sed -i 's/await page\.timeout(/await page.wait_for_timeout(/g' /app/app.py

# Verify fix applied
docker exec c6ae9b70b227_playwright grep -n "wait_for_timeout" /app/app.py

# Restart to load patched code
docker restart c6ae9b70b227_playwright
```

### Permanent Fix
```bash
# Copy patched file from container
docker cp firecrawl-playwright:/app/app.py patchright-app.py

# Recreate container with volume mount
docker compose up -d firecrawl-playwright

# Test the fix
pnpm start scrape https://www.clawhub.ai/steipete/gog --wait-for 5000
```

## Key Findings

1. **Patchright Version Gap**
   - Container uses: v1.50.0
   - Latest available: v1.58.0
   - Gap: 8 versions behind
   - **Impact:** Bug may already be fixed in newer versions (not verified)

2. **Upstream Bug Status**
   - Bug exists in loorisr/patchright-scrape-api:latest
   - Checked GitHub main branch: still present
   - No open issues mentioning this bug
   - No forks with the fix

3. **Client-Side Rendering Compatibility**
   - TanStack Router sites work with `--wait-for` flag
   - Chrome DevTools MCP can handle CSR sites better
   - Patchright with proper timeout works for most CSR sites

4. **Remote CDP Limitations**
   - patchright-scrape-api hardcodes `wss://` protocol
   - Not compatible with standard browserless deployment
   - Would need app.py modification to support both `ws://` and `wss://`

## Architecture Context

### Self-Hosted Firecrawl Stack
```
CLI → Firecrawl API (53002) → Patchright (53006) → Chrome
                            ↘ Fetch engine (fallback)
```

**Components:**
- `firecrawl`: Main API (ghcr.io/firecrawl/firecrawl)
- `firecrawl-playwright`: Browser backend (loorisr/patchright-scrape-api)
- `firecrawl-qdrant`: Vector DB (qdrant/qdrant:53333)
- `tei`: Embeddings (ghcr.io/huggingface/tei:53010)

### Volume Mounts
```yaml
firecrawl-playwright:
  volumes:
    - ./patchright-app.py:/app/app.py:ro  # Read-only patched file
```

## Next Steps

### Immediate (Complete)
- ✅ Fix applied and tested
- ✅ Documentation updated
- ✅ Volume mount configured

### Short-term (Recommended)
- [ ] Monitor for patchright-scrape-api updates
- [ ] Consider submitting PR to upstream repo
- [ ] Test on additional CSR sites (Next.js, Remix, etc.)

### Long-term (Optional)
- [ ] Build custom image with fix for better deployment
- [ ] Investigate browserless integration (requires app.py changes)
- [ ] Upgrade to patchright v1.58.0 and verify bug status

## Lessons Learned

1. **Always check container logs first** - The error message in Firecrawl logs pointed directly to patchright
2. **Verify API methods before assuming** - `page.timeout()` doesn't exist in Playwright/Patchright
3. **Volume mounts for quick fixes** - Faster than building custom images during debugging
4. **Test with real sites** - clawhub.ai was a good test case for CSR challenges
5. **Document infrastructure quirks** - Future developers need to know about the patched file

## References

- [Patchright Python GitHub](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-python)
- [Playwright Python Page API](https://playwright.dev/python/docs/api/class-page)
- [patchright-scrape-api Repository](https://github.com/loorisr/patchright-scrape-api)
- [Firecrawl GitHub](https://github.com/mendableai/firecrawl)
