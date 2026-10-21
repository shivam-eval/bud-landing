# mybud.life

Landing page and legal documents for **Bud**, nutrition tracking and diet
planning on WhatsApp.

Static, no build step. Netlify publishes the repo root and autodeploys on every
push to `main`.

```
index.html                    the page (single file, inline CSS/JS)
privacy.html                  privacy policy      -> /privacy
terms.html                    terms of service    -> /terms
blog/index.html               the blog            -> /blog
blog/calorie-calculator.html  targets method + calculator -> /blog/calorie-calculator
blog/bmi-calculator.html      BMI method + calculator     -> /blog/bmi-calculator
blog/blog.css, blog/calc.js   shared by the blog pages
_redirects                    clean URLs (200 rewrites, so the address bar keeps /privacy)
favicon.svg                   wordmark
robots.txt                    indexable
llms.txt                      summary for AI assistants and answer engines
sitemap.xml
```

## The calculators must give the bot's numbers

The two blog calculators compute in the browser from a JSON block on each page
(`<script type="application/json" id="bud-method">`), which is a copy of
`body.METHOD` in the backend repo - the code that works out the numbers a user
is shown on WhatsApp, and whose "View sources" buttons open these pages. The
backend's `tests/test_method_on_website.py` fetches both live pages and fails
if that block differs from `body.METHOD`. **Change a constant in the backend
and in these pages together**, and deploy this repo first: the bot links here.

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
