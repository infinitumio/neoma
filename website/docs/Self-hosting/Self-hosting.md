---
description: The open-source edition is a static app. Serve one folder and you are hosting Neoma.
slug: self-hosting
---

Neoma has no backend. Hosting it means serving files: notes still live in each visitor's browser or chosen folder, never on your server.

**Docker**

```bash
git clone https://github.com/infinitumio/neoma.git
cd neoma
docker compose up -d        # http://localhost:8080
```

**Any static host**

```bash
npm ci
npm run build               # serve the dist/ folder
```

**Under a subpath**, such as `example.org/notes/`:

```bash
NEOMA_BASE=/notes/ npm run build
```

- Serve it over **HTTPS**. Browsers only allow offline mode and folder vaults on secure origins.
- The included `nginx.conf` sets the right caching for the service worker.
- If you change the code and offer it to others over a network, the AGPL asks you to offer them your source too. See [[Open source]].
