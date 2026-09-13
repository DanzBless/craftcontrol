# 🪐 CraftOrbit — Universal Minecraft Server Manager & Global Host

[![GitHub Release](https://img.shields.io/github/v/release/DanzBless/craftorbit?color=white&label=Release&style=flat-square)](https://github.com/DanzBless/craftorbit/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-white.svg?style=flat-square)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-white.svg?style=flat-square)](https://github.com/DanzBless/craftorbit)
[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-white.svg?style=flat-square)](https://nodejs.org)
[![Cross-Play: Java %2B Bedrock](https://img.shields.io/badge/Cross--Play-Java%20%2B%20Bedrock-white.svg?style=flat-square)](https://geysermc.org)

**CraftOrbit** is a modern, high-performance, open-source web management panel for hosting Minecraft servers effortlessly on your computer and playing with friends worldwide—**zero router port forwarding required**.

Featuring automated server engine downloading (**Forge, NeoForge, Fabric, Paper, and Vanilla**), dual **playit.gg** tunneling (PC + Mobile), 1-click **GeyserMC & Floodgate** cross-play, in-browser **Modrinth** mod store, and real-time hardware telemetry.

---

## ⚡ Quick Start

### 📋 Prerequisites
1. **Node.js** (v18 or newer): Download from [nodejs.org](https://nodejs.org/).
2. **Java Runtime**: CraftOrbit automatically scans and selects your installed Java runtime (`Java 8`, `Java 17`, `Java 21`, or `Java 25` for Minecraft 26.x).

### 🚀 1-Click Launch (Windows)
1. Download **`CraftOrbit-OpenSource-Setup.zip`** from the [Latest Releases](https://github.com/DanzBless/craftorbit/releases/latest).
2. Extract the archive anywhere on your PC.
3. Double-click **`setup.bat`** (or `start.bat`).
4. Your browser will automatically open:
   👉 **`http://localhost:3000`**

*(Optional: Double-click `start-silent.vbs` to run CraftOrbit completely hidden in the background without keeping a Command Prompt window open).*

---

## 🌟 Key Features

| Feature | Description |
| :--- | :--- |
| 🎮 **Auto-Egg Provisioner** | 1-click server creation. Automatically downloads the official `.jar` for **Forge**, **NeoForge**, **Fabric**, **Paper**, or **Vanilla** directly from official APIs. |
| 🌍 **Global Tunneling (playit.gg)** | Host public games without touching router NAT/firewalls or leaking your home IP address. Supports separate dual tunnels for PC and Mobile. |
| 📱 **Java + Bedrock Cross-Play** | Auto-installs **Geyser** and **Floodgate** so friends on Android, iOS, Xbox, PlayStation, and Switch can join your Java Paper server on port `19132`. |
| 📦 **Modrinth Mod & Pack Store** | Search and install mods directly from the Modrinth catalog with 1 click. Includes `.zip` modpack importer for CurseForge/Modrinth server packs. |
| ⏱️ **Real-Time Telemetry & SLP** | Live RAM/CPU charts, native Server List Ping (latency ms & player count), and automated 10-minute world saves (`/save-all`). |
| 🔄 **1-Click Disaster Recovery** | Full world backup creation (`.zip`) with an instant 1-click restore button. |
| 🖥️ **Dual Navigation Layouts** | Switch between an **Argonara / Pterodactyl-style Left Sidebar** and a **Minimalist Topbar** anytime with preference persistence. |
| 🌐 **Multi-Language (i18n)** | Native English display language with 1-click Language Switcher (English US & Bahasa Indonesia). |
| 📊 **Server Hero Card** | Real-time workspace banner with animated CPU, RAM, and Disk storage progress meters and quick control triggers. |
| ⌨️ **Spotlight Command Palette** | Press `Ctrl + K` anywhere to trigger server actions, set world time, clear ground lag, and run console commands. |
| 🔒 **Security Hardened** | Protected against Cross-Site Request Forgery (CSRF/CSWSH), path traversal (CWE-22), and shell command injection. |

---

## 🕹️ Supported Engines & Versions

- **Minecraft Forge**: 1.12.2, 1.16.5, 1.18.2, 1.19.2, 1.20.1 (Automated `--installServer` execution).
- **NeoForge**: 1.20.4, 1.21.1, 1.26 / 26.2 (Automated Maven installer).
- **Fabric**: All versions (Automated Fabric Server Launcher & Fabric-API injection).
- **Paper / Purpur**: High-performance servers with Bukkit/Spigot plugin support.
- **Mojang Vanilla**: Official `server.jar` packages.
- **Minecraft Bedrock**: Native Bedrock Dedicated Server support.

---

## 🤝 Inviting Friends

When your server is online, CraftOrbit provides ready-to-copy join addresses:
- **🌐 Internet (playit.gg)**: Give this domain (`xyz.gl.joinmc.link`) to friends playing outside your house.
- **🏠 Home Wi-Fi (LAN)**: Connect with siblings and housemates on the same network (`192.168.x.x:PORT`).
- **📱 Mobile Bedrock**: Phone and tablet players connect using the Bedrock Server IP and Port.

---

## ❓ Frequently Asked Questions (FAQ)

### How do I host a Minecraft server for free without port forwarding?
CraftOrbit integrates with `playit.gg` to create encrypted global tunnels. Launch your server in CraftOrbit, start the tunnel, and share the generated public domain with your friends. No router configuration or static IP required.

### Can friends on Bedrock (Mobile / Console) join my Java server?
Yes. When deploying a Paper or Purpur server in CraftOrbit, check **Auto-install Geyser & Floodgate**. CraftOrbit handles plugin installation and cross-play translation automatically.

### Does CraftOrbit require paid hosting?
No. CraftOrbit is 100% free and open-source under the MIT license. It runs entirely on your own computer.

---

## 📜 License & Attribution
Distributed under the **MIT License**. Created by [Naze_Tz](https://github.com/DanzBless).
Contributions, issues, and feature requests are welcome on [GitHub](https://github.com/DanzBless/craftorbit).
