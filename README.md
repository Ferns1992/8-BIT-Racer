# 🏎️💨 Ultra-Light 8-Bit Retro Racer

**A blazingly fast, standalone 8-bit racing game fully optimized for Docker and Portainer.**

<div align="center">
  <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2000&auto=format&fit=crop" alt="8-Bit Arcade Aesthetic" style="border-radius: 12px; border: 4px solid #fff; box-shadow: 8px 8px 0px #E40058; margin-bottom: 24px;" />
  <pre style="background: #000; color: #00FF00; padding: 16px; border-radius: 8px; border: 4px solid #333; display: inline-block;">
      __    __      _         _    __              
    /   \  /  \    (_)       / \   \ \    ___      
   |     ||    |   | |      / _ \   \ \  /___\     
   |  _  ||  _  |  | |     / ___ \   \ \//   \\    
    \_/ \/ \_/ \/  |_|    /_/   \_\   \//     \\   
                                _                  
  8-BIT RETRO RACER       -=[ 🏎️ ]=-               
  </pre>
</div>

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
