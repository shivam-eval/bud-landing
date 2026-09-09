# mybud.life

Landing page and legal documents for **Bud**, a personal assistant on WhatsApp.

Static, no build step. Netlify publishes the repo root and autodeploys on every
push to `main`.

```
index.html     the page (single file, inline CSS/JS)
privacy.html   privacy policy      -> /privacy
terms.html     terms of service    -> /terms
_redirects     clean URLs (200 rewrites, so the address bar keeps /privacy)
favicon.svg    wordmark
robots.txt     indexable
sitemap.xml
```

## Why the legal pages live here

They are public documents users read, so they belong on the website rather than
behind the API. `/privacy` and `/terms` on this domain are the URLs given to
Google for OAuth verification, so **they must stay reachable, publicly and
without a login** — a 404 there fails the review.

The clean URLs are `200` rewrites, not `301` redirects, so the address bar keeps
showing `/privacy`. That matters because it is the exact URL registered with
Google.

## The claims in these documents are tested against the backend

`privacy.html` makes factual promises — Bud cannot read email, no Drive access,
90-day conversation retention, deletion on request. The backend repo
(`voice-eval/bud`) has `tests/test_policy_claims.py`, which asserts each of
those against what the code actually does, and its CI fetches the live pages
from this site.

**So if you edit a factual claim here, the backend's tests are what catch a
contradiction.** Do not weaken a claim to match the code; change the code, or
fix the claim deliberately and update the test.

## History

Extracted from `english-landing/bud/`, which served the placeholder at
`bud.voiceeval.com`. That domain is retired; this repo serves `mybud.life`.
