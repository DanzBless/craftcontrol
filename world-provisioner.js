const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);
const JavaResolver = require('./java-resolver');

class WorldProvisioner {
  // Inspect a world folder and extract metadata + exact version
  static async inspectWorld(folderPath) {
    const resolved = path.resolve(folderPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Directory does not exist: ${resolved}`);
    }

    // Check for level.dat
    let levelDatPath = path.join(resolved, 'level.dat');
    let worldSubfolder = '';

    if (!fs.existsSync(levelDatPath)) {
      if (fs.existsSync(path.join(resolved, 'world', 'level.dat'))) {
        levelDatPath = path.join(resolved, 'world', 'level.dat');
        worldSubfolder = 'world';
      } else if (fs.existsSync(path.join(resolved, 'worlds'))) {
        return {
          worldPath: resolved,
          levelName: path.basename(resolved),
          mcVersion: 'Bedrock Latest',
          isBedrock: true,
          isModded: false,
          recommendedEgg: 'bedrock',
          availableEggs: ['bedrock']
        };
      } else {
        throw new Error('No level.dat or world data found in this folder');
      }
    }

    // Parse level.dat
    const buf = await fs.promises.readFile(levelDatPath);
    let unzipped;
    try {
      unzipped = zlib.gunzipSync(buf);
    } catch (e) {
      unzipped = buf;
    }

    const str = unzipped.toString('latin1');

    // 1. Detect Minecraft Version
    let mcVersion = null;
    // Data.Version.Name
    const vCompMatch = str.match(/Version[\s\S]{1,40}Name\x00.([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
    if (vCompMatch) mcVersion = vCompMatch[1];

    // ModVersion minecraft
    if (!mcVersion) {
      const mcModMatch = str.match(/ModVersion\x00.([0-9]+\.[0-9]+(?:\.[0-9]+)?)\x00\x08\x00\x05ModId\x00\x09minecraft/);
      if (mcModMatch) mcVersion = mcModMatch[1];
    }

    // Fallback standard regex
    if (!mcVersion) {
      const anyMatch = str.match(/1\.(?:1[6-9]|2[0-9])(?:\.[0-9]+)?/);
      mcVersion = anyMatch ? anyMatch[0] : '1.20.1';
    }

    // 2. Detect Level Name
    let levelName = path.basename(resolved);
    const lvlMatch = str.match(/LevelName\x00.([^\x00\x08\x0a\x01-\x1f]{1,40})/);
    if (lvlMatch && lvlMatch[1] && lvlMatch[1].trim()) {
      levelName = lvlMatch[1].trim();
    }

    // 3. Detect Modloader in parent/sibling folders
    let isModded = false;
    let modCount = 0;
    let detectedModloader = 'vanilla';

    const parentDir = path.dirname(resolved);
    const candidateModsDir = fs.existsSync(path.join(resolved, 'mods'))
      ? path.join(resolved, 'mods')
      : fs.existsSync(path.join(parentDir, 'mods'))
      ? path.join(parentDir, 'mods')
      : null;

    if (candidateModsDir) {
      try {
        const modFiles = fs.readdirSync(candidateModsDir);
        const jars = modFiles.filter(f => f.endsWith('.jar'));
        modCount = jars.length;
        if (modCount > 0) {
          isModded = true;
          const hasFabric = jars.some(j => j.toLowerCase().includes('fabric'));
          const hasForge = jars.some(j => j.toLowerCase().includes('forge') || j.toLowerCase().includes('neoforge'));
          detectedModloader = hasFabric && !hasForge ? 'fabric' : 'forge';
        }
      } catch (e) {}
    }

    if (str.includes('forge') || str.includes('fml')) {
      detectedModloader = 'forge';
      isModded = true;
    } else if (str.includes('fabric')) {
      detectedModloader = 'fabric';
      isModded = true;
    }

    // Recommended Egg
    let recommendedEgg = 'paper';
    if (detectedModloader === 'fabric') recommendedEgg = 'fabric';
    else if (detectedModloader === 'forge') recommendedEgg = 'forge';
    else recommendedEgg = 'paper'; // Default high performance for friends

    return {
      worldPath: resolved,
      worldSubfolder,
      levelName,
      mcVersion,
      isModded,
      modCount,
      detectedModloader,
      recommendedEgg,
      availableEggs: [
        {
          id: 'forge',
          name: 'Forge Modpack Egg',
          tag: 'Forge Modpacks (RLCraft/ATM/RPG)',
          desc: 'Automated Forge installer (--installServer) with full mods/ and config/ modpack support.'
        },
        {
          id: 'fabric',
          name: 'Fabric Modpack Egg',
          tag: 'Fabric Modpacks (Cobblemon/BetterMC)',
          desc: 'Lightweight modern modded server. Auto-installs Fabric Server Launcher & Fabric-API.'
        },
        {
          id: 'paper',
          name: 'Paper Egg (PaperMC)',
          tag: 'Most Popular & Optimized',
          desc: 'High-performance Java server with anti-lag & Spigot/Bukkit plugin support. Friends can join with vanilla Minecraft.'
        },
        {
          id: 'purpur',
          name: 'Purpur Egg',
          tag: 'Fast Paper Fork',
          desc: 'Ultra-optimized drop-in replacement for Paper with extra gameplay configs.'
        },
        {
          id: 'vanilla',
          name: 'Vanilla Java Egg',
          tag: 'Official Mojang',
          desc: 'Official Minecraft server.jar directly from Mojang.'
        }
      ]
    };
  }

  // Scan computer for existing singleplayer worlds
  static scanLocalWorlds() {
    const worlds = [];
    const searchDirs = [
      {
        profile: 'Standard Minecraft (.minecraft)',
        path: path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft', 'saves')
      }
    ];

    // Modrinth profiles
    const modrinthProfiles = path.join(os.homedir(), 'AppData', 'Roaming', 'ModrinthApp', 'profiles');
    if (fs.existsSync(modrinthProfiles)) {
      try {
        const profs = fs.readdirSync(modrinthProfiles, { withFileTypes: true });
        for (const p of profs) {
          if (p.isDirectory()) {
            searchDirs.push({
              profile: `Modrinth: ${p.name}`,
              path: path.join(modrinthProfiles, p.name, 'saves')
            });
          }
        }
      } catch (e) {}
    }

    // CurseForge profiles
    const curseforgeInstances = path.join(os.homedir(), 'curseforge', 'minecraft', 'Instances');
    if (fs.existsSync(curseforgeInstances)) {
      try {
        const insts = fs.readdirSync(curseforgeInstances, { withFileTypes: true });
        for (const i of insts) {
          if (i.isDirectory()) {
            searchDirs.push({
              profile: `CurseForge: ${i.name}`,
              path: path.join(curseforgeInstances, i.name, 'saves')
            });
          }
        }
      } catch (e) {}
    }

    // Scan directories
    for (const item of searchDirs) {
      if (fs.existsSync(item.path)) {
        try {
          const entries = fs.readdirSync(item.path, { withFileTypes: true });
          for (const ent of entries) {
            if (ent.isDirectory()) {
              const full = path.join(item.path, ent.name);
              const levelDat = path.join(full, 'level.dat');
              if (fs.existsSync(levelDat)) {
                const stat = fs.statSync(levelDat);
                worlds.push({
                  name: ent.name,
                  path: full,
                  source: item.profile,
                  mtime: stat.mtime
                });
              }
            }
          }
        } catch (e) {}
      }
    }

    worlds.sort((a, b) => b.mtime - a.mtime);
    return worlds;
  }

  static normalizeVersion(v) {
    if (!v) return '26.2';
    const trimmed = String(v).trim();
    if (trimmed === '1.26' || trimmed === '1.26.2') return '26.2';
    if (trimmed === '1.26.1') return '26.1.2';
    return trimmed;
  }

  // Download server jar directly from official APIs based on Egg & Minecraft Version
  static async downloadEggJar(egg, mcVersion, destFolder, onProgress = () => {}) {
    mcVersion = this.normalizeVersion(mcVersion);
    let jarUrl = '';
    let targetFileName = 'server.jar';

    if (egg === 'paper') {
      onProgress(`Querying PaperMC v3 repository for Minecraft ${mcVersion}...`);
      try {
        const vRes = await fetch(`https://fill.papermc.io/v3/projects/paper/versions/${mcVersion}`);
        if (!vRes.ok) throw new Error(`PaperMC v3 API returned HTTP ${vRes.status}`);
        const vData = await vRes.json();
        const builds = vData.builds || [];
        if (builds.length === 0) throw new Error(`No builds found for Paper ${mcVersion}`);
        
        // Find latest build number
        const latestBuild = Math.max(...builds);
        const bRes = await fetch(`https://fill.papermc.io/v3/projects/paper/versions/${mcVersion}/builds/${latestBuild}`);
        if (!bRes.ok) throw new Error(`Failed to fetch build ${latestBuild}`);
        const bData = await bRes.json();
        jarUrl = bData.downloads?.['server:default']?.url || bData.downloads?.['server:mojang']?.url;
        if (!jarUrl) throw new Error(`Download URL missing for Paper build ${latestBuild}`);
        targetFileName = 'server.jar';
        onProgress(`Found Paper build #${latestBuild}. Starting download...`);
      } catch (err) {
        // Fallback to Purpur if Paper build not found for this subversion
        onProgress(`Paper specific build not available, falling back to Purpur Paper fork for ${mcVersion}...`);
        jarUrl = `https://api.purpurmc.org/v2/purpur/${mcVersion}/latest/download`;
        targetFileName = 'server.jar';
      }
    } else if (egg === 'purpur') {
      onProgress(`Connecting to Purpur API for Minecraft ${mcVersion}...`);
      jarUrl = `https://api.purpurmc.org/v2/purpur/${mcVersion}/latest/download`;
      targetFileName = 'server.jar';
    } else if (egg === 'fabric') {
      onProgress(`Querying Fabric Meta API for Minecraft ${mcVersion}...`);
      const metaRes = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
      if (!metaRes.ok) throw new Error(`Fabric not available for Minecraft ${mcVersion}`);
      const metaJson = await metaRes.json();
      if (!metaJson || metaJson.length === 0) throw new Error(`No Fabric loader found for ${mcVersion}`);
      const loaderVer = metaJson[0].loader.version;
      jarUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVer}/1.0.1/server/jar`;
      targetFileName = 'fabric-server-launcher.jar';
      onProgress(`Found Fabric loader v${loaderVer}. Starting download...`);
    } else if (egg === 'vanilla') {
      onProgress(`Querying Mojang Version Manifest for Minecraft ${mcVersion}...`);
      const manifestRes = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
      const manifest = await manifestRes.json();
      const verObj = manifest.versions.find(v => v.id === mcVersion);
      if (!verObj) throw new Error(`Version ${mcVersion} not found in official Mojang manifest`);

      const pkgRes = await fetch(verObj.url);
      const pkg = await pkgRes.json();
      if (!pkg.downloads || !pkg.downloads.server || !pkg.downloads.server.url) {
        throw new Error(`Official server jar not available for ${mcVersion}`);
      }
      jarUrl = pkg.downloads.server.url;
      targetFileName = 'server.jar';
      onProgress(`Found official Mojang server package. Starting download...`);
    } else if (egg === 'forge') {
      onProgress(`Querying Forge Maven promotions for Minecraft ${mcVersion}...`);
      const promoRes = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
      if (!promoRes.ok) throw new Error('Failed to query Forge promotions API');
      const promoData = await promoRes.json();
      const forgeVersion = promoData.promos[`${mcVersion}-recommended`] || promoData.promos[`${mcVersion}-latest`];
      if (!forgeVersion) {
        throw new Error(`No Forge build found for Minecraft ${mcVersion}. Common Forge versions: 1.20.1, 1.19.2, 1.18.2, 1.16.5.`);
      }

      jarUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${forgeVersion}/forge-${mcVersion}-${forgeVersion}-installer.jar`;
      targetFileName = 'forge-installer.jar';
      onProgress(`Found Forge ${mcVersion}-${forgeVersion}. Starting installer download...`);
    } else {
      throw new Error(`Egg '${egg}' requires manual installer setup. Use Paper, Purpur, Fabric, Forge, or Vanilla.`);
    }

    const outPath = path.join(destFolder, targetFileName);
    const res = await fetch(jarUrl);
    if (!res.ok) {
      throw new Error(`Download failed with HTTP ${res.status} from ${jarUrl}`);
    }

    const arrayBuf = await res.arrayBuffer();
    await fs.promises.writeFile(outPath, Buffer.from(arrayBuf));
    onProgress(`Downloaded ${targetFileName} successfully (${Math.round(arrayBuf.byteLength / (1024 * 1024))} MB)`);

    // Post-download setup for Forge and Fabric
    if (egg === 'forge') {
      const javaPath = JavaResolver.resolveJava(mcVersion);
      onProgress(`Running Forge installer: ${javaPath} -jar forge-installer.jar --installServer (takes ~1-2 min)...`);
      try {
        await execFilePromise(javaPath, ['-jar', 'forge-installer.jar', '--installServer'], { cwd: destFolder });
        onProgress('Forge server installation completed successfully!');
        // Clean up installer jar and log
        await fs.promises.unlink(path.join(destFolder, 'forge-installer.jar')).catch(() => {});
        await fs.promises.unlink(path.join(destFolder, 'forge-installer.jar.log')).catch(() => {});
      } catch (err) {
        throw new Error(`Forge installer failed: ${err.message}`);
      }
    } else if (egg === 'fabric') {
      // Auto-install Fabric-API for Fabric modpacks
      try {
        onProgress(`Fetching matching Fabric-API for Minecraft ${mcVersion}...`);
        const fApiRes = await fetch('https://api.modrinth.com/v2/project/fabric-api/version', {
          headers: { 'User-Agent': 'CraftControl-Manager/1.0' }
        });
        if (fApiRes.ok) {
          const versions = await fApiRes.json();
          const match = versions.find(v => v.game_versions.includes(mcVersion) && v.loaders.includes('fabric'));
          const file = match?.files?.find(f => f.primary) || match?.files?.[0];
          if (file && file.url) {
            const modsDir = path.join(destFolder, 'mods');
            if (!fs.existsSync(modsDir)) await fs.promises.mkdir(modsDir, { recursive: true });
            const buf = await (await fetch(file.url)).arrayBuffer();
            await fs.promises.writeFile(path.join(modsDir, file.filename), Buffer.from(buf));
            onProgress(`Auto-installed ${file.filename} into mods folder.`);
          }
        }
      } catch (e) {}
    }

    return { targetFileName, outPath };
  }

  // Extract a modpack ZIP archive into server folder
  static async extractModpackZip(zipFilePath, targetServerDir, onLog = console.log) {
    if (!fs.existsSync(zipFilePath)) {
      throw new Error(`Modpack ZIP file not found: ${zipFilePath}`);
    }
    onLog(`[Modpack Extractor] Extracting modpack archive into ${targetServerDir}...`);
    await execFilePromise('tar', ['-x', '-f', zipFilePath, '-C', targetServerDir]);

    let modCount = 0;
    const modsDir = path.join(targetServerDir, 'mods');
    if (fs.existsSync(modsDir)) {
      const files = await fs.promises.readdir(modsDir);
      modCount = files.filter(f => f.endsWith('.jar') || f.endsWith('.disabled')).length;
    }
    onLog(`[Modpack Extractor] Modpack successfully unpacked (${modCount} mods loaded).`);
    return { success: true, modCount };
  }

  // Install Geyser & Floodgate plugins for Bedrock crossplay
  static async installGeyser(serverDir, onLog = console.log) {
    let pluginsDir = path.join(serverDir, 'plugins');
    if (!fs.existsSync(pluginsDir) && fs.existsSync(path.join(serverDir, 'mods'))) {
      pluginsDir = path.join(serverDir, 'mods');
    }
    if (!fs.existsSync(pluginsDir)) {
      await fs.promises.mkdir(pluginsDir, { recursive: true });
    }

    const geyserDest = path.join(pluginsDir, 'Geyser-Spigot.jar');
    const floodgateDest = path.join(pluginsDir, 'floodgate-spigot.jar');

    // 1. Check local desktop first for fast offline install
    const localDesktop = 'C:\\Users\\msi_9\\OneDrive\\Desktop\\Antigravity IDE\\Dekstop';
    const localGeyser = path.join(localDesktop, 'Geyser-Spigot.jar');
    const localFloodgate = path.join(localDesktop, 'floodgate-spigot.jar');

    if (fs.existsSync(localGeyser) && !fs.existsSync(geyserDest)) {
      onLog('[Geyser Installer] Copying Geyser-Spigot.jar from local desktop cache...');
      await fs.promises.copyFile(localGeyser, geyserDest);
    }
    if (fs.existsSync(localFloodgate) && !fs.existsSync(floodgateDest)) {
      onLog('[Geyser Installer] Copying floodgate-spigot.jar from local desktop cache...');
      await fs.promises.copyFile(localFloodgate, floodgateDest);
    }

    // 2. If not local, download from official GeyserMC API
    if (!fs.existsSync(geyserDest)) {
      onLog('[Geyser Installer] Downloading Geyser-Spigot from official GeyserMC API...');
      try {
        const gRes = await fetch('https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot');
        if (gRes.ok) {
          const buf = await gRes.arrayBuffer();
          await fs.promises.writeFile(geyserDest, Buffer.from(buf));
          onLog('[Geyser Installer] Downloaded Geyser-Spigot.jar successfully.');
        }
      } catch (err) {
        onLog(`[Geyser Installer Error] ${err.message}`);
      }
    }

    if (!fs.existsSync(floodgateDest)) {
      onLog('[Geyser Installer] Downloading Floodgate-Spigot from official GeyserMC API...');
      try {
        const fRes = await fetch('https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/spigot');
        if (fRes.ok) {
          const buf = await fRes.arrayBuffer();
          await fs.promises.writeFile(floodgateDest, Buffer.from(buf));
          onLog('[Geyser Installer] Downloaded floodgate-spigot.jar successfully.');
        }
      } catch (err) {
        onLog(`[Geyser Installer Error] ${err.message}`);
      }
    }

    return {
      geyserInstalled: fs.existsSync(geyserDest),
      floodgateInstalled: fs.existsSync(floodgateDest)
    };
  }

  // 1-Click Provision & Host Server from World or Create Fresh Server
  static async autoHostWorld(options, onLog = console.log) {
    const {
      worldPath,
      serverName,
      egg = 'paper',
      port = 25565,
      maxRam = '4G',
      minRam = '2G',
      seed = '',
      enableGeyser = true
    } = options;
    const mcVersion = this.normalizeVersion(options.mcVersion || '26.2');

    const baseHostingDir = path.resolve('C:\\Users\\msi_9\\OneDrive\\Desktop\\Antigravity IDE\\Dekstop\\hosted-servers');
    if (!fs.existsSync(baseHostingDir)) {
      await fs.promises.mkdir(baseHostingDir, { recursive: true });
    }

    const cleanName = (serverName || (worldPath ? path.basename(worldPath) : `Minecraft-${mcVersion}`)).replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    let serverDir = path.join(baseHostingDir, cleanName);

    if (fs.existsSync(serverDir)) {
      serverDir = `${serverDir}-${Date.now().toString().slice(-4)}`;
    }

    await fs.promises.mkdir(serverDir, { recursive: true });
    onLog(`[Auto-Host] Created server workspace: ${serverDir}`);

    // 1. Copy World into serverDir/world if an existing world was provided
    if (worldPath && fs.existsSync(worldPath)) {
      const targetWorldDir = path.join(serverDir, 'world');
      onLog(`[Auto-Host] Copying existing world files into ${targetWorldDir}...`);
      
      // Robocopy for high speed on Windows using execFile (no shell interpolation)
      try {
        await execFilePromise('robocopy', [worldPath, targetWorldDir, '/E', '/NP', '/NFL', '/NDL', '/NJH', '/NJS']);
      } catch (e) {
        if (e.code > 7) {
          await fs.promises.cp(worldPath, targetWorldDir, { recursive: true });
        }
      }
    } else {
      onLog(`[Auto-Host] Fresh world mode selected. Minecraft will generate a new world on first start (seed: ${seed || 'random'}).`);
    }

    // 2. Download Selected Egg Jar (Paper, Purpur, Fabric, Forge, Vanilla)
    let jarInfo = { targetFileName: 'server.jar' };
    if (egg !== 'bedrock') {
      onLog(`[Auto-Host] Provisioning ${egg.toUpperCase()} egg for Minecraft ${mcVersion}...`);
      jarInfo = await this.downloadEggJar(egg, mcVersion, serverDir, onLog);
    }

    // 2.1 Auto-install Geyser & Floodgate plugins for Bedrock cross-play
    if (enableGeyser !== false && (egg === 'paper' || egg === 'purpur' || egg === 'spigot')) {
      onLog('[Auto-Host] Auto-installing Geyser & Floodgate plugins for Bedrock / Mobile cross-play...');
      await this.installGeyser(serverDir, onLog);
    }

    // 2.2 If a modpack ZIP was provided, extract it into the server
    if (options.modpackZipPath && fs.existsSync(options.modpackZipPath)) {
      onLog(`[Auto-Host] Unpacking modpack archive: ${path.basename(options.modpackZipPath)}...`);
      await this.extractModpackZip(options.modpackZipPath, serverDir, onLog);
    }

    // 3. Write eula.txt
    await fs.promises.writeFile(path.join(serverDir, 'eula.txt'), 'eula=true\n', 'utf8');

    // 4. Write server.properties
    const serverProps = `#Minecraft server properties\n` +
      `#Provisioned automatically by CraftControl Auto-Egg\n` +
      `server-port=${port}\n` +
      `query.port=${port}\n` +
      `motd=CraftControl Server (${path.basename(serverDir)})\n` +
      `level-name=world\n` +
      `level-seed=${seed || ''}\n` +
      `online-mode=false\n` +
      `difficulty=normal\n` +
      `gamemode=survival\n` +
      `max-players=10\n` +
      `pvp=true\n` +
      `enable-command-block=true\n` +
      `sync-chunk-writes=true\n`;
    await fs.promises.writeFile(path.join(serverDir, 'server.properties'), serverProps, 'utf8');

    // 5. Write user_jvm_args.txt
    const jvmArgs = `# JVM Arguments\n-Xms${minRam} -Xmx${maxRam}\n`;
    await fs.promises.writeFile(path.join(serverDir, 'user_jvm_args.txt'), jvmArgs, 'utf8');

    // 6. Detect & Resolve Matching Java Runtime
    const javaPath = JavaResolver.resolveJava(mcVersion);
    onLog(`[Auto-Host] Resolved Java runtime for Minecraft ${mcVersion}: ${javaPath}`);

    // 7. Generate start.bat (supporting Forge run.bat and standard jar launches)
    const startBatContent = `@echo off\ntitle ${cleanName}\ncd /d "%~dp0"\nif exist "run.bat" (\n    call run.bat\n) else (\n    "${javaPath}" -Xms${minRam} -Xmx${maxRam} -jar ${jarInfo.targetFileName} nogui\n)\npause\n`;
    await fs.promises.writeFile(path.join(serverDir, 'start.bat'), startBatContent, 'utf8');

    // 8. Return Instance Config
    const instanceId = 'hosted-' + Date.now();
    const instanceConfig = {
      id: instanceId,
      name: path.basename(serverDir),
      path: serverDir,
      type: egg === 'paper' || egg === 'purpur' ? 'paper' : egg,
      minRam,
      maxRam,
      javaPath,
      autoRestart: false,
      port,
      customJar: jarInfo.targetFileName
    };

    onLog(`[Auto-Host] Server ready! Assigned port: ${port}`);
    return instanceConfig;
  }
}

module.exports = WorldProvisioner;
