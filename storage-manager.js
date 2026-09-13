const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

class StorageManager {
  constructor(serverDir) {
    this.serverDir = path.resolve(serverDir);
  }

  setDirectory(newDir) {
    this.serverDir = path.resolve(newDir);
  }

  isSafePath(targetPath) {
    const resolvedTarget = path.resolve(this.serverDir, targetPath);
    const rel = path.relative(this.serverDir, resolvedTarget);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  }

  async getDirectorySize(dirPath) {
    let totalSize = 0;
    let fileCount = 0;

    try {
      if (!fs.existsSync(dirPath)) return { size: 0, count: 0 };
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          if (entry.isDirectory()) {
            const sub = await this.getDirectorySize(fullPath);
            totalSize += sub.size;
            fileCount += sub.count;
          } else if (entry.isFile()) {
            const stat = await fs.promises.stat(fullPath);
            totalSize += stat.size;
            fileCount++;
          }
        } catch (e) {}
      }
    } catch (e) {}

    return { size: totalSize, count: fileCount };
  }

  async getDriveStats() {
    try {
      const stats = await fs.promises.statfs(this.serverDir);
      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      const used = total - free;
      return {
        total,
        free,
        used,
        freePercent: Math.round((free / total) * 100),
        usedPercent: Math.round((used / total) * 100)
      };
    } catch (e) {
      return { total: 0, free: 0, used: 0, freePercent: 0, usedPercent: 0 };
    }
  }

  // Universal Storage Overview (Supports Java, Forge, Fabric, Paper, Bedrock)
  async getStorageOverview() {
    const drive = await this.getDriveStats();

    // World directory (Java 'world' or Bedrock 'worlds')
    let worldFolderName = 'world';
    let worldDir = path.join(this.serverDir, 'world');
    if (!fs.existsSync(worldDir) && fs.existsSync(path.join(this.serverDir, 'worlds'))) {
      worldDir = path.join(this.serverDir, 'worlds');
      worldFolderName = 'worlds';
    }

    // Mods or Plugins
    let addonFolderName = 'mods';
    let addonsDir = path.join(this.serverDir, 'mods');
    if (!fs.existsSync(addonsDir) && fs.existsSync(path.join(this.serverDir, 'plugins'))) {
      addonsDir = path.join(this.serverDir, 'plugins');
      addonFolderName = 'plugins';
    }

    const logsDir = path.join(this.serverDir, 'logs');
    const librariesDir = path.join(this.serverDir, 'libraries');
    const configDir = path.join(this.serverDir, 'config');
    const modernfixDir = path.join(this.serverDir, 'modernfix');
    const crashDir = path.join(this.serverDir, 'crash-reports');
    const backupsDir = path.join(this.serverDir, 'backups');

    const [
      worldSize,
      addonsSize,
      logsSize,
      librariesSize,
      configSize,
      modernfixSize,
      crashSize,
      backupsSize
    ] = await Promise.all([
      this.getDirectorySize(worldDir),
      this.getDirectorySize(addonsDir),
      this.getDirectorySize(logsDir),
      this.getDirectorySize(librariesDir),
      this.getDirectorySize(configDir),
      this.getDirectorySize(modernfixDir),
      this.getDirectorySize(crashDir),
      this.getDirectorySize(backupsDir)
    ]);

    // Root ZIPs or archive backups in root
    const rootZipFiles = [];
    try {
      const files = await fs.promises.readdir(this.serverDir, { withFileTypes: true });
      for (const f of files) {
        if (f.isFile() && (f.name.endsWith('.zip') || f.name.endsWith('.tar.gz') || f.name.endsWith('.rar'))) {
          const stat = await fs.promises.stat(path.join(this.serverDir, f.name));
          rootZipFiles.push({
            name: f.name,
            size: stat.size,
            mtime: stat.mtime
          });
        }
      }
    } catch (e) {}

    const rootZipTotal = rootZipFiles.reduce((acc, curr) => acc + curr.size, 0);

    // World breakdown
    let worldBreakdown = {
      overworld: 0,
      nether: 0,
      theEnd: 0,
      playerdata: 0,
      entities: 0,
      other: 0
    };

    if (fs.existsSync(worldDir)) {
      if (worldFolderName === 'world') {
        const [overworld, nether, theEnd, playerdata, entities] = await Promise.all([
          this.getDirectorySize(path.join(worldDir, 'region')),
          this.getDirectorySize(path.join(worldDir, 'DIM-1')),
          this.getDirectorySize(path.join(worldDir, 'DIM1')),
          this.getDirectorySize(path.join(worldDir, 'playerdata')),
          this.getDirectorySize(path.join(worldDir, 'entities'))
        ]);
        const sub = overworld.size + nether.size + theEnd.size + playerdata.size + entities.size;
        worldBreakdown = {
          overworld: overworld.size,
          nether: nether.size,
          theEnd: theEnd.size,
          playerdata: playerdata.size,
          entities: entities.size,
          other: Math.max(0, worldSize.size - sub)
        };
      } else {
        // Bedrock Level DB format
        worldBreakdown = {
          overworld: worldSize.size,
          nether: 0,
          theEnd: 0,
          playerdata: 0,
          entities: 0,
          other: 0
        };
      }
    }

    // Check old logs
    let oldLogsSize = 0;
    let oldLogsCount = 0;
    if (fs.existsSync(logsDir)) {
      try {
        const logFiles = await fs.promises.readdir(logsDir);
        for (const logFile of logFiles) {
          if (logFile.endsWith('.log.gz') || (logFile.endsWith('.log') && logFile !== 'latest.log')) {
            const s = await fs.promises.stat(path.join(logsDir, logFile));
            oldLogsSize += s.size;
            oldLogsCount++;
          }
        }
      } catch (e) {}
    }

    const totalServerSize =
      worldSize.size +
      addonsSize.size +
      logsSize.size +
      librariesSize.size +
      configSize.size +
      modernfixSize.size +
      crashSize.size +
      backupsSize.size +
      rootZipTotal;

    return {
      drive,
      totalServerSize,
      worldFolderName,
      addonFolderName,
      categories: {
        world: { name: 'World Data', size: worldSize.size, count: worldSize.count, breakdown: worldBreakdown },
        mods: { name: addonFolderName === 'plugins' ? 'Plugins' : 'Mods', size: addonsSize.size, count: addonsSize.count },
        archives: { name: 'Setup Archives', size: rootZipTotal, files: rootZipFiles },
        backups: { name: 'Backups', size: backupsSize.size, count: backupsSize.count },
        logs: { name: 'Server Logs', size: logsSize.size, oldLogsSize, oldLogsCount },
        libraries: { name: 'Engine Libraries', size: librariesSize.size, count: librariesSize.count },
        configs: { name: 'Configs & Settings', size: configSize.size + modernfixSize.size, count: configSize.count + modernfixSize.count },
        crashReports: { name: 'Crash Reports', size: crashSize.size, count: crashSize.count }
      }
    };
  }

  async cleanOldLogs() {
    const logsDir = path.join(this.serverDir, 'logs');
    let freedBytes = 0;
    let deletedCount = 0;

    if (!fs.existsSync(logsDir)) return { freedBytes: 0, deletedCount: 0 };

    const files = await fs.promises.readdir(logsDir);
    for (const f of files) {
      if (f.endsWith('.log.gz') || (f.endsWith('.log') && f !== 'latest.log')) {
        try {
          const p = path.join(logsDir, f);
          const stat = await fs.promises.stat(p);
          await fs.promises.unlink(p);
          freedBytes += stat.size;
          deletedCount++;
        } catch (e) {}
      }
    }

    return { freedBytes, deletedCount };
  }

  async cleanCaches() {
    let freedBytes = 0;
    let deletedCount = 0;

    const mixinDir = path.join(this.serverDir, '.mixin.out');
    if (fs.existsSync(mixinDir)) {
      try {
        const sizeInfo = await this.getDirectorySize(mixinDir);
        await fs.promises.rm(mixinDir, { recursive: true, force: true });
        freedBytes += sizeInfo.size;
        deletedCount += sizeInfo.count;
      } catch (e) {}
    }

    const crashDir = path.join(this.serverDir, 'crash-reports');
    if (fs.existsSync(crashDir)) {
      try {
        const reports = await fs.promises.readdir(crashDir);
        const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
        for (const rep of reports) {
          const full = path.join(crashDir, rep);
          const s = await fs.promises.stat(full);
          if (s.mtimeMs < threeDaysAgo) {
            freedBytes += s.size;
            deletedCount++;
            await fs.promises.unlink(full);
          }
        }
      } catch (e) {}
    }

    return { freedBytes, deletedCount };
  }

  async deleteFile(relativePath) {
    if (!this.isSafePath(relativePath)) {
      throw new Error('Access denied: path traversal blocked');
    }
    const safePath = path.resolve(this.serverDir, relativePath);
    if (!fs.existsSync(safePath)) {
      throw new Error('File does not exist');
    }

    const stat = await fs.promises.stat(safePath);
    if (stat.isDirectory()) {
      await fs.promises.rm(safePath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(safePath);
    }
    return { freedBytes: stat.size };
  }

  async createWorldBackup() {
    let targetFolder = 'world';
    if (!fs.existsSync(path.join(this.serverDir, 'world')) && fs.existsSync(path.join(this.serverDir, 'worlds'))) {
      targetFolder = 'worlds';
    }

    const worldDir = path.join(this.serverDir, targetFolder);
    if (!fs.existsSync(worldDir)) {
      throw new Error(`World folder (${targetFolder}) does not exist`);
    }

    const backupsDir = path.join(this.serverDir, 'backups');
    if (!fs.existsSync(backupsDir)) {
      await fs.promises.mkdir(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFileName = `backup-${targetFolder}-${timestamp}.zip`;
    const backupFilePath = path.join(backupsDir, backupFileName);

    await execFilePromise('tar', ['-a', '-c', '-f', backupFilePath, targetFolder], { cwd: this.serverDir });

    const stat = await fs.promises.stat(backupFilePath);
    return {
      fileName: backupFileName,
      size: stat.size,
      filePath: backupFilePath
    };
  }

  async restoreBackup(backupFileName) {
    const cleanFileName = path.basename(backupFileName);
    const backupFilePath = path.join(this.serverDir, 'backups', cleanFileName);
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file not found: ${cleanFileName}`);
    }

    let targetFolder = 'world';
    if (!fs.existsSync(path.join(this.serverDir, 'world')) && fs.existsSync(path.join(this.serverDir, 'worlds'))) {
      targetFolder = 'worlds';
    }

    const worldPath = path.join(this.serverDir, targetFolder);
    const tempBackupWorld = path.join(this.serverDir, `${targetFolder}_pre_restore_${Date.now()}`);

    if (fs.existsSync(worldPath)) {
      try {
        await fs.promises.rename(worldPath, tempBackupWorld);
      } catch (e) {
        await fs.promises.rm(worldPath, { recursive: true, force: true });
      }
    }

    try {
      await execFilePromise('tar', ['-x', '-f', backupFilePath], { cwd: this.serverDir });

      if (fs.existsSync(tempBackupWorld)) {
        await fs.promises.rm(tempBackupWorld, { recursive: true, force: true }).catch(() => {});
      }

      const sizeInfo = await this.getDirectorySize(worldPath);
      return { success: true, fileName: cleanFileName, restoredSize: sizeInfo.size };
    } catch (err) {
      if (fs.existsSync(tempBackupWorld)) {
        await fs.promises.rename(tempBackupWorld, worldPath).catch(() => {});
      }
      throw new Error(`Failed to extract backup: ${err.message}`);
    }
  }

  async listBackups() {
    const backupsDir = path.join(this.serverDir, 'backups');
    if (!fs.existsSync(backupsDir)) return [];

    const files = await fs.promises.readdir(backupsDir, { withFileTypes: true });
    const backups = [];

    for (const file of files) {
      if (file.isFile() && (file.name.endsWith('.zip') || file.name.endsWith('.tar.gz'))) {
        const full = path.join(backupsDir, file.name);
        const stat = await fs.promises.stat(full);
        backups.push({
          name: file.name,
          size: stat.size,
          mtime: stat.mtime
        });
      }
    }
    backups.sort((a, b) => b.mtime - a.mtime);
    return backups;
  }
}

module.exports = StorageManager;
