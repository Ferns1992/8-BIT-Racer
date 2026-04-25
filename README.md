# 🏎️💨 8-Bit Racer

<div align="center">

![Gameplay Screenshot](./screenshot.svg)

</div>

**A fast, polished retro racer with modern polish — now with improved visuals, smooth controls, and responsive gameplay.**

---

## ✨ What's new (Recent improvements)

- ✅ Modern-retro car sprite with metallic shading, highlights, and animated wheels
- ✅ Updated obstacle art: detailed coins, shells and glossy oil slicks with soft shadows
- ✅ Camera shake, particles and speed-lines to add impact and feel
- ✅ Improved lighting, vignette and HUD polish for a more arcade feel
- ✅ Touch controls for mobile and smoother steering with momentum

---

## 🎮 Quick Start

- Install deps: `npm install`
- Dev: `npm run dev` (open http://localhost:3000)
- Docker: `docker-compose up -d --build`

---

## 🧭 How to play

- Move: ← → (Arrow keys) or A / D
- Boost: Space
- Pause: Esc
- Collect coins to increase score, avoid shells and oil slicks.

---

## 🗂️ Changelog (high level)

- Visual overhaul of main canvas drawing (car, obstacles, lighting)
- Added particle system and camera effects
- Audio improvements retained (coin/crash/start cues)
- Leaderboard stored in `scores.json` and served by the Express backend

---

## 📷 Screenshot

Above is an in-repo SVG mock screenshot showing the new look. Replace `screenshot.svg` with a real capture if you have one for higher fidelity.

---

## ❤️ Contribute

PRs welcome. If you want a specific feature (drifting, traffic AI, new tracks), open an issue or a PR with the idea.

---

## 🎉 Enjoy the race!

> Watch out for the green shells 🐢 and oil spills 🛢️ — good luck!


Yes, this app is **100% Docker and Portainer ready**! We configured it to operate flawlessly in any containerized environment. To keep things absolutely lightweight, we swapped out heavy database engines for a fast, file-based `JSON_FS` (JSON File System) storage that persists automatically using Docker Volumes.

---

## ✨ Features

- **🎮 Authentic 8-Bit Feel:** Mushroom Kingdom palette, pixelated rendering, and 8-bit Web Audio API sound effects (no heavy audio files needed!).
- **🪶 Ultra-Lightweight Backend:** Node.js Express server with 0 native database drivers. No SQLite, no PostgreSQL. A simple `scores.json` is used.
- **💾 Auto-Persistence:** High scores and leaderboards survive container reboots.
- **🏎️ Dynamic Animations:** Enjoy kart engine bobbing and wheel spin visual effects!

---

## 🐳 Deploying with Docker Compose (or Portainer)

Your application is pre-configured to bind to **Port 4050** on the host. 

### ▶️ 1. Standard Docker Compose

Simply clone or export this code, open the directory in your terminal, and run:

```bash
docker-compose up -d --build
```
*Your game will now be live at `http://localhost:4050`*

### 🚢 2. Deploying via Portainer 

If you are using **Portainer** to manage your stacks, deployment takes only a few clicks:

1. Open Portainer and go to **Stacks** ➡️ **Add stack**.
2. Name your stack (e.g., `retro-racer`).
3. Under **Web editor**, simply paste the contents of the `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "4050:3000"
    volumes:
      - ./scores.json:/app/scores.json
    environment:
      - NODE_ENV=production
    restart: always
```

4. Since Portainer might be pulling from a GitHub repo, make sure your `.dockerignore` and `Dockerfile` are in the root logic.
5. Click **Deploy the stack**. 
6. 🏁 Access the game by navigating to `<YOUR_SERVER_IP>:4050`.

---

## 📂 Architecture & Persistence

To ensure you never lose your hard-earned high scores, the `docker-compose.yml` explicitly mounts `scores.json`:

```yaml
volumes:
  - ./scores.json:/app/scores.json
```

**⚠️ Important for First Time Setup:** 
If Docker complains that `./scores.json` is a directory instead of a file on your local host, simply create an empty file first before running `docker-compose`:
```bash
echo "[]" > scores.json
docker-compose up -d --build
```

---

## 💻 Local Development

If you want to edit the code locally without Docker:

1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Start the Development Server:**
   ```bash
   npm run dev
   ```
3. **Build for Production:**
   ```bash
   npm run build
   npm start
   ```

---

### 🎉 Enjoy the Race! 
Watch out for the green shells 🐢 and oil spills 🛢️!
