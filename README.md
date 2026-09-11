# CraftControl - Universal Minecraft Server Manager & Global Host

CraftControl is an open-source, web-based Minecraft server manager with automatic engine provisioning, playit.gg global tunneling, Modrinth mod store integration, real-time telemetry, and an AI server assistant.

---

## ⚡ Quick Start

### Prerequisites
- **Node.js**: [nodejs.org](https://nodejs.org/) (v18+ recommended)
- **Java**: Java 8, 17, 21, or 25 depending on your Minecraft version. CraftControl will automatically scan your system and choose the best matching runtime.

### 1-Click Launch (Windows)
1. Double-click `setup.bat` (or `start.bat`).
2. Your browser will automatically open to `http://localhost:3000`.
3. To run silently in the background with no command prompt window, double-click `start-silent.vbs`.

---

## 🌟 Key Features

- 🎮 **Auto-Egg World Deployer**:
  - Select any singleplayer world folder or create a fresh world.
  - Choose your engine: Paper (PaperMC v3), Purpur, Vanilla, or Fabric.
  - Automatically downloads the correct `.jar`, configures `eula=true` and `server.properties`, and matches the required Java version.
- 🌍 **playit.gg Global Tunneling**:
  - Host publicly without port forwarding or sharing your home IP address.
  - Dual tunnel configuration for both Java Edition (PC) and Bedrock Edition (Mobile / Console).
  - Tunnels are stored independently per server profile.
- 📱 **Bedrock / Geyser Cross-play**:
  - Automatically installs Geyser and Floodgate plugins on Paper/Purpur/Spigot servers.
- 📦 **Modrinth App Store**:
  - 1-click mod search and installation directly from the Modrinth catalog.
  - Toggle installed mods on/off without deleting `.jar` files.
- 🩺 **AI Copilot & Server Doctor**:
  - Connects to local or remote 9Router gateway.
  - Diagnoses server errors, stack traces, and mod conflicts.
- 📊 **Realtime Telemetry & Server List Ping**:
  - Live CPU, RAM, and TPS tracker.
  - Proportional disk analyzer with automated chunk saves and 1-click world backup/restore.

---

## ⚙️ Configuration (Optional)

Create a `.env` file based on `.env.example` if you want to customize dashboard ports or 9Router AI connection:

```env
PORT=3000
NINEROUTER_URL=http://localhost:20128
NINEROUTER_KEY=
NINEROUTER_MODEL=ag/gemini-3.8-flash-low
```

---

## 📄 License
MIT License. Free and open source.
