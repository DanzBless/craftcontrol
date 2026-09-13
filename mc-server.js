const { spawn, exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const JavaResolver = require('./java-resolver');

class MinecraftServer {
  constructor(serverDir, onLog, onStatusChange, instanceConfig = {}) {
    this.serverDir = serverDir;
    this.onLog = onLog || (() => {});
    this.onStatusChange = onStatusChange || (() => {});
    this.process = null;
    this.status = 'offline'; // 'offline' | 'starting' | 'online' | 'stopping'
    this.logs = [];
    this.maxLogs = 2000;
    this.startTime = null;
    this.players = [];
    this.pid = null;
    this.config = this.loadConfig(instanceConfig);

    this.ensureEula();
  }

  // Switch directory & config on the fly
  setInstance(serverDir, instanceConfig = {}) {
    if (this.status !== 'offline') {
      throw new Error('Cannot switch instance while server is running. Stop server first.');
    }
    this.serverDir = serverDir;
    this.logs = [];
    this.players = [];
    this.startTime = null;
    this.pid = null;
    this.config = this.loadConfig(instanceConfig);
    this.ensureEula();
    this.onStatusChange(this.getStatus());
  }

  ensureEula() {
    try {
      const eulaFile = path.join(this.serverDir, 'eula.txt');
      if (fs.existsSync(this.serverDir)) {
        fs.writeFileSync(eulaFile, 'eula=true\n', 'utf8');
      }
    } catch (e) {}
  }

  // Auto-detect server type
  static detectServerType(dirPath) {
    if (!fs.existsSync(dirPath)) return { type: 'unknown', name: 'Unknown' };

    // 1. Bedrock
    if (
      fs.existsSync(path.join(dirPath, 'bedrock_server.exe')) ||
      fs.existsSync(path.join(dirPath, 'bedrock_server')) ||
      fs.existsSync(path.join(dirPath, 'egg-minecraft-bedrock.json'))
    ) {
      return { type: 'bedrock', name: 'Bedrock Dedicated Server', isBedrock: true };
    }

    // 2. NeoForge
    if (fs.existsSync(path.join(dirPath, 'libraries/net/neoforged'))) {
      return { type: 'neoforge', name: 'NeoForge Server' };
    }

    // 3. Forge (Modern or Legacy)
    if (
      fs.existsSync(path.join(dirPath, 'libraries/net/minecraftforge')) ||
      fs.existsSync(path.join(dirPath, 'forge.jar'))
    ) {
      return { type: 'forge', name: 'Minecraft Forge' };
    }

    // 4. Fabric / Quilt
    if (
      fs.existsSync(path.join(dirPath, 'fabric-server-launcher.jar')) ||
      fs.existsSync(path.join(dirPath, 'fabric-server-launch.jar'))
    ) {
      return { type: 'fabric', name: 'Fabric Server' };
    }
    if (fs.existsSync(path.join(dirPath, 'quilt-server-launch.jar'))) {
      return { type: 'quilt', name: 'Quilt Server' };
    }

    // 5. Paper / Purpur / Spigot
    try {
      const files = fs.readdirSync(dirPath);
      for (const f of files) {
        if (f.startsWith('paper-') && f.endsWith('.jar')) return { type: 'paper', name: 'PaperMC Server', jar: f };
        if (f.startsWith('purpur-') && f.endsWith('.jar')) return { type: 'purpur', name: 'Purpur Server', jar: f };
        if (f.startsWith('spigot-') && f.endsWith('.jar')) return { type: 'spigot', name: 'Spigot Server', jar: f };
      }
    } catch (e) {}

    // 6. Vanilla / Generic server.jar
    if (fs.existsSync(path.join(dirPath, 'server.jar'))) {
      return { type: 'vanilla', name: 'Vanilla / Java Server', jar: 'server.jar' };
    }

    return { type: 'custom', name: 'Custom Server' };
  }

  loadConfig(instanceConfig = {}) {
    const defaultJava = this.detectJava();
    const detected = MinecraftServer.detectServerType(this.serverDir);

    let config = {
      type: detected.type,
      javaPath: defaultJava,
      minRam: '4G',
      maxRam: '6G',
      autoRestart: false,
      port: 25402,
      customJar: detected.jar || '',
      ...instanceConfig
    };

    // Read variables.txt if present (Forge)
    const varFile = path.join(this.serverDir, 'variables.txt');
    if (fs.existsSync(varFile)) {
      try {
        const content = fs.readFileSync(varFile, 'utf8');
        const match = content.match(/JAVA_ARGS=["']?([^"'\r\n]+)/);
        if (match) {
          const args = match[1];
          const xmxMatch = args.match(/-Xmx(\w+)/);
          const xmsMatch = args.match(/-Xms(\w+)/);
          if (xmxMatch) config.maxRam = xmxMatch[1];
          if (xmsMatch) config.minRam = xmsMatch[1];
        }
      } catch (e) {}
    }

    // Read server.properties for port
    const props = this.getServerProperties();
    if (props['server-port']) {
      config.port = parseInt(props['server-port'], 10) || config.port;
    }

    return config;
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.generateJvmArgs();

    // Sync variables.txt if Forge
    const varFile = path.join(this.serverDir, 'variables.txt');
    if (fs.existsSync(varFile)) {
      try {
        let content = fs.readFileSync(varFile, 'utf8');
        content = content.replace(/JAVA_ARGS=.*/, `JAVA_ARGS="-Xmx${this.config.maxRam} -Xms${this.config.minRam}"`);
        fs.writeFileSync(varFile, content, 'utf8');
      } catch (e) {}
    }
  }

  detectJava(mcVersion) {
    if (!mcVersion) {
      mcVersion = this.detectMinecraftVersion();
    }
    return JavaResolver.resolveJava(mcVersion);
  }

  detectMinecraftVersion() {
    // 1. Check versions directory (Paper / Purpur caches)
    const versionsDir = path.join(this.serverDir, 'versions');
    if (fs.existsSync(versionsDir)) {
      try {
        const vFolders = fs.readdirSync(versionsDir);
        if (vFolders.length > 0) return vFolders[0];
      } catch (e) {}
    }

    // 2. Check variables.txt
    const varFile = path.join(this.serverDir, 'variables.txt');
    if (fs.existsSync(varFile)) {
      try {
        const content = fs.readFileSync(varFile, 'utf8');
        const match = content.match(/MINECRAFT_VERSION=([^\r\n]+)/);
        if (match) return match[1].trim();
      } catch (e) {}
    }

    // 3. Check world/level.dat
    const levelDat = path.join(this.serverDir, 'world', 'level.dat');
    if (fs.existsSync(levelDat)) {
      try {
        const buf = fs.readFileSync(levelDat);
        const unzipped = zlib.gunzipSync(buf);
        const str = unzipped.toString('latin1');
        const vCompMatch = str.match(/Version[\s\S]{1,40}Name\x00.([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
        if (vCompMatch) return vCompMatch[1];
        const anyMatch = str.match(/1\.(?:1[6-9]|2[0-9])(?:\.[0-9]+)?/);
        if (anyMatch) return anyMatch[0];
      } catch (e) {}
    }
    return '1.20.1';
  }

  generateJvmArgs() {
    if (!fs.existsSync(this.serverDir)) return;
    const jvmFile = path.join(this.serverDir, 'user_jvm_args.txt');
    const content = `# Generated by CraftOrbit Universal\n-Xms${this.config.minRam} -Xmx${this.config.maxRam}\n`;
    try {
      fs.writeFileSync(jvmFile, content, 'utf8');
    } catch (e) {}
  }

  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      if (newStatus === 'offline') {
        this.startTime = null;
        this.pid = null;
        this.players = [];
      } else if (newStatus === 'online' && !this.startTime) {
        this.startTime = Date.now();
      }
      this.onStatusChange(this.getStatus());
    }
  }

  appendLog(line) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      text: line
    };
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    this.onLog(logEntry);
    this.parseLogLine(line);
  }

  parseLogLine(line) {
    // Online check
    if (
      line.includes('Done (') ||
      line.includes('Time elapsed:') ||
      line.includes('Server started.') ||
      line.includes('IPv4 supported, port:')
    ) {
      this.setStatus('online');
    }

    // Player joins (Java & Bedrock)
    const joinMatch = line.match(/: (\w+) joined the game/) ||
                      line.match(/Player connected: (\w+)/) ||
                      line.match(/Player Spawned: (\w+)/);
    if (joinMatch) {
      const player = joinMatch[1];
      if (!this.players.includes(player)) {
        this.players.push(player);
        this.onStatusChange(this.getStatus());
      }
    }

    // Player leaves (Java & Bedrock)
    const leaveMatch = line.match(/: (\w+) left the game/) ||
                       line.match(/Player disconnected: (\w+)/);
    if (leaveMatch) {
      const player = leaveMatch[1];
      this.players = this.players.filter(p => p !== player);
      this.onStatusChange(this.getStatus());
    }

    // Auto-detect and fix Java version requirement mismatches
    const javaReqMatch = line.match(/requires running the server with Java (\d+) or above/i);
    const classVerMatch = line.match(/class file version (\d+)\.0/i);

    if (javaReqMatch || classVerMatch) {
      const requiredMajor = javaReqMatch ? parseInt(javaReqMatch[1], 10) : (parseInt(classVerMatch[1], 10) - 44);
      this.appendLog(`[CraftOrbit Auto-Fix] Detected Java version mismatch (requires Java ${requiredMajor}+). Resolving matching Java runtime...`);
      const optimalJava = JavaResolver.resolveJavaByMajor(requiredMajor);
      if (optimalJava && optimalJava !== this.config.javaPath) {
        this.appendLog(`[CraftOrbit Auto-Fix] Auto-switching Java path from "${this.config.javaPath}" to "${optimalJava}".`);
        this.saveConfig({ javaPath: optimalJava });
        setTimeout(() => {
          if (this.status === 'offline') {
            this.appendLog('[CraftOrbit Auto-Fix] Relaunching server with correct Java runtime now...');
            this.start();
          }
        }, 1500);
      }
    }

    // Stopping
    if (
      line.includes('Closing Server') ||
      line.includes('Stopping server') ||
      line.includes('Quit correctly')
    ) {
      if (this.status !== 'offline') {
        this.setStatus('stopping');
      }
    }
  }

  start() {
    if (this.status !== 'offline') {
      throw new Error(`Server is already ${this.status}`);
    }

    this.setStatus('starting');
    this.generateJvmArgs();
    this.ensureEula();

    const detected = MinecraftServer.detectServerType(this.serverDir);
    const serverType = this.config.type || detected.type;

    let spawnCmd = '';
    let spawnArgs = [];

    if (serverType === 'bedrock') {
      // Bedrock binary spawn
      const exeName = process.platform === 'win32' ? 'bedrock_server.exe' : './bedrock_server';
      const exePath = path.join(this.serverDir, exeName);

      if (!fs.existsSync(exePath)) {
        throw new Error(`Bedrock executable not found: ${exePath}`);
      }

      spawnCmd = exePath;
      spawnArgs = [];
      this.appendLog(`[CraftOrbit] Starting Bedrock Dedicated Server: ${exePath}`);
    } else {
      // Auto-validate and resolve matching Java runtime
      const detectedMcVersion = this.detectMinecraftVersion();
      const requiredMajor = JavaResolver.getRequiredJavaVersion(detectedMcVersion);
      let javaCmd = this.config.javaPath;
      const currentMajor = JavaResolver.getJavaMajorFromPath(javaCmd);

      if (!javaCmd || !fs.existsSync(javaCmd) || (currentMajor && currentMajor < requiredMajor)) {
        const optimalJava = JavaResolver.resolveJava(detectedMcVersion);
        this.appendLog(`[CraftOrbit Auto-Fix] Selected Java (${currentMajor || 'unknown'}) is incompatible with Minecraft ${detectedMcVersion} (needs Java ${requiredMajor}+). Auto-switching to: ${optimalJava}`);
        javaCmd = optimalJava;
        this.config.javaPath = optimalJava;
        this.saveConfig({ javaPath: optimalJava });
      }

      spawnCmd = javaCmd;

      if (serverType === 'forge' || serverType === 'neoforge') {
        // Find win_args.txt
        let winArgs = '';
        const forgeDir = path.join(this.serverDir, 'libraries/net/minecraftforge/forge');
        const neoDir = path.join(this.serverDir, 'libraries/net/neoforged/forge');
        const searchDir = fs.existsSync(neoDir) ? neoDir : forgeDir;

        if (fs.existsSync(searchDir)) {
          const versions = fs.readdirSync(searchDir);
          for (const v of versions) {
            const potential = path.join(searchDir, v, 'win_args.txt');
            if (fs.existsSync(potential)) {
              winArgs = `@libraries/${path.relative(path.join(this.serverDir, 'libraries'), potential).replace(/\\/g, '/')}`;
              break;
            }
          }
        }

        if (winArgs) {
          spawnArgs = [
            `-Xms${this.config.minRam}`,
            `-Xmx${this.config.maxRam}`,
            '-Dlog4j2.formatMsgNoLookups=true',
            '@user_jvm_args.txt',
            winArgs,
            'nogui'
          ];
        } else if (fs.existsSync(path.join(this.serverDir, 'forge.jar'))) {
          spawnArgs = [`-Xms${this.config.minRam}`, `-Xmx${this.config.maxRam}`, '-jar', 'forge.jar', 'nogui'];
        } else {
          spawnArgs = [`-Xms${this.config.minRam}`, `-Xmx${this.config.maxRam}`, '-jar', 'server.jar', 'nogui'];
        }
      } else if (serverType === 'fabric') {
        const fabricJar = fs.existsSync(path.join(this.serverDir, 'fabric-server-launcher.jar'))
          ? 'fabric-server-launcher.jar'
          : 'fabric-server-launch.jar';
        spawnArgs = [`-Xms${this.config.minRam}`, `-Xmx${this.config.maxRam}`, '-jar', fabricJar, 'nogui'];
      } else if (serverType === 'quilt') {
        spawnArgs = [`-Xms${this.config.minRam}`, `-Xmx${this.config.maxRam}`, '-jar', 'quilt-server-launch.jar', 'nogui'];
      } else {
        // Paper, Purpur, Spigot, Vanilla or custom jar
        const targetJar = this.config.customJar || detected.jar || 'server.jar';
        spawnArgs = [`-Xms${this.config.minRam}`, `-Xmx${this.config.maxRam}`, '-jar', targetJar, 'nogui'];
      }

      this.appendLog(`[CraftOrbit] Starting Java Server (${serverType}): ${javaCmd} ${spawnArgs.join(' ')}`);
    }

    try {
      this.process = spawn(spawnCmd, spawnArgs, {
        cwd: this.serverDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });

      this.pid = this.process.pid;
      this.startTime = Date.now();

      this.process.stdout.on('data', (data) => {
        const lines = data.toString('utf8').split(/\r?\n/);
        for (const line of lines) {
          if (line.trim()) this.appendLog(line);
        }
      });

      this.process.stderr.on('data', (data) => {
        const lines = data.toString('utf8').split(/\r?\n/);
        for (const line of lines) {
          if (line.trim()) this.appendLog(line);
        }
      });

      this.process.on('close', (code) => {
        this.appendLog(`[CraftOrbit] Server process exited with code ${code}`);
        const wasOnline = this.status === 'online';
        this.setStatus('offline');
        this.process = null;

        if (wasOnline && this.config.autoRestart && code !== 0) {
          this.appendLog('[CraftOrbit] Auto-restart enabled. Restarting in 5 seconds...');
          setTimeout(() => {
            if (this.status === 'offline') this.start();
          }, 5000);
        }
      });

      this.process.on('error', (err) => {
        this.appendLog(`[CraftOrbit ERROR] Process failed: ${err.message}`);
        this.setStatus('offline');
        this.process = null;
      });

      return { success: true, pid: this.pid };
    } catch (err) {
      this.setStatus('offline');
      throw err;
    }
  }

  stop() {
    if (this.status === 'offline') {
      return { success: true, message: 'Server is already stopped' };
    }

    this.setStatus('stopping');
    this.appendLog('[CraftOrbit] Sending stop command to server...');

    if (this.process && this.process.stdin && !this.process.stdin.destroyed) {
      try {
        this.process.stdin.write('stop\n');
      } catch (e) {}
    }

    const targetPid = this.pid;
    setTimeout(() => {
      if (this.status === 'stopping' && this.pid === targetPid) {
        this.appendLog('[CraftOrbit] Server graceful shutdown timed out. Terminating...');
        this.kill();
      }
    }, 25000);

    return { success: true, message: 'Stop command sent' };
  }

  kill() {
    if (this.pid) {
      this.appendLog(`[CraftOrbit] Force terminating PID ${this.pid}...`);
      execFile('taskkill', ['/PID', String(this.pid), '/T', '/F'], () => {});
      this.setStatus('offline');
      this.process = null;
      return { success: true };
    }
    this.setStatus('offline');
    return { success: true };
  }

  restart() {
    if (this.status === 'offline') {
      return this.start();
    }
    this.appendLog('[CraftOrbit] Server restart requested...');
    const check = setInterval(() => {
      if (this.status === 'offline') {
        clearInterval(check);
        this.start();
      }
    }, 1000);
    return this.stop();
  }

  sendCommand(cmd) {
    if (this.status !== 'online' && this.status !== 'starting') {
      throw new Error('Server is not running');
    }
    if (!this.process || !this.process.stdin) {
      throw new Error('Process stdin not available');
    }

    const cleanCmd = cmd.trim().replace(/^\//, '').replace(/[\r\n]/g, '');
    this.appendLog(`> /${cleanCmd}`);
    this.process.stdin.write(cleanCmd + '\n');
    return { success: true };
  }

  async getProcessMetrics() {
    if (!this.pid || this.status === 'offline') {
      return { memoryBytes: 0, memoryMB: 0, cpuPercent: 0 };
    }

    return new Promise((resolve) => {
      const cmd = `Get-Process -Id ${this.pid} -ErrorAction SilentlyContinue | Select-Object -Property WorkingSet64, CPU | ConvertTo-Json`;
      exec(`powershell -NoProfile -Command "${cmd}"`, { timeout: 3000 }, (err, stdout) => {
        if (err || !stdout.trim()) {
          return resolve({ memoryBytes: 0, memoryMB: 0, cpuPercent: 0 });
        }
        try {
          const data = JSON.parse(stdout);
          const bytes = data.WorkingSet64 || 0;
          resolve({
            memoryBytes: bytes,
            memoryMB: Math.round(bytes / (1024 * 1024)),
            cpuTime: data.CPU || 0
          });
        } catch (e) {
          resolve({ memoryBytes: 0, memoryMB: 0, cpuPercent: 0 });
        }
      });
    });
  }

  getStatus() {
    const uptimeSec = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
    const detected = MinecraftServer.detectServerType(this.serverDir);
    return {
      status: this.status,
      pid: this.pid,
      uptime: uptimeSec,
      players: this.players,
      playerCount: this.players.length,
      config: this.config,
      serverDir: this.serverDir,
      detectedEngine: detected.name,
      engineType: this.config.type || detected.type
    };
  }

  getServerProperties() {
    const propFile = path.join(this.serverDir, 'server.properties');
    if (!fs.existsSync(propFile)) return {};

    try {
      const content = fs.readFileSync(propFile, 'utf8');
      const props = {};
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        if (line.trim().startsWith('#') || !line.includes('=')) continue;
        const idx = line.indexOf('=');
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        props[key] = val;
      }
      return props;
    } catch (e) {
      return {};
    }
  }

  saveServerProperties(newProps) {
    const propFile = path.join(this.serverDir, 'server.properties');
    let content = '#Minecraft server properties\n';
    content += `#Updated by CraftOrbit Universal on ${new Date().toISOString()}\n`;

    const existing = this.getServerProperties();
    const merged = { ...existing, ...newProps };

    for (const [key, val] of Object.entries(merged)) {
      content += `${key}=${val}\n`;
    }

    fs.writeFileSync(propFile, content, 'utf8');
    return merged;
  }
}

module.exports = MinecraftServer;
