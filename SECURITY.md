# Security Policy

## neoma's security model

neoma is a fully client-side application. There is no server, no account system and no
data transmission — which removes whole classes of risk, but the following still matter:

- **Rendered Markdown** must never execute script. The render pipeline drops raw HTML
  (no `rehype-raw`); rendered output is sanitised by construction.
- **Imported ZIP archives** are untrusted input. Entries with path traversal (`..`) or
  hidden segments are skipped.
- **Vault data at rest** uses the browser's storage (IndexedDB) or the user's own files.
  neoma does not add encryption at rest; use OS-level disk encryption if you need it.
- **The service worker** only ever caches same-origin build assets.

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately:

- Discord: `panda2187`
- Or use GitHub's _Report a vulnerability_ (Security Advisories) on the repository

Please include reproduction steps and the impact you foresee. You should receive an
acknowledgement within 7 days. Please do not open public issues for unpatched
vulnerabilities.

## Scope notes

- XSS via note content (wiki links, embeds, math, callouts, imported files) is in scope
  and treated as high severity.
- Anything requiring a malicious browser extension or compromised OS is out of scope.
