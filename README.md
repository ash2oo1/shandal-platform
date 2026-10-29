# Shandal Geological Field Survey System — website

Bilingual (English / Arabic) platform of field, data and laboratory tools for geology, engineering and the environment. The tool list and every count shown on the site come from `ORDER` in `builder/content_tools.py`; adding a tool there updates all pages on the next build.

- `builder/` — static-site generator (Python 3 + Jinja2): page content (`content_*.py`), templates, scientific illustrations (`illus.py`), assets and tool scripts (`src/assets/js/tools/`).
- `docs/` — the generated website, published with GitHub Pages.

Build: `cd builder && python3 build.py` (writes to `docs/`).

Third-party: Leaflet (BSD-2), Plotly.js (MIT), QRCode.js (MIT), Lucide icons (ISC), Simple Icons (CC0), Natural Earth (public domain), Manrope and IBM Plex Sans Arabic fonts (OFL).

© 2026 Ali Shandal Falah Al-Janabi. Registered work no. 2841/ع, National Centre for Protection of Copyright and Related Rights, Ministry of Culture, Iraq. All rights reserved.
