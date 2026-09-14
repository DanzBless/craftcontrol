const fs = require('fs');
const path = require('path');
const os = require('os');

class JavaResolver {
  // Scan system for all available Java installations
  static scanInstalledJavas() {
    const list = [];
    const isWindows = process.platform === 'win32';
    const binName = isWindows ? 'java.exe' : 'java';

    const roots = isWindows ? [
      path.join(os.homedir(), 'AppData', 'Roaming', 'ModrinthApp', 'meta', 'java_versions'),
      'C:\\Program Files\\Java',
      'C:\\Program Files (x86)\\Java',
      path.join(os.homedir(), '.gradle', 'jdks'),
      path.join(os.homedir(), 'curseforge', 'minecraft', 'Install', 'java')
    ] : [
      '/usr/lib/jvm',
      '/opt/java',
      '/opt/jdk',
      '/usr/lib/sdk',
      path.join(os.homedir(), '.sdkman', 'candidates', 'java'),
      path.join(os.homedir(), '.gradle', 'jdks'),
      path.join(os.homedir(), '.local', 'share', 'ModrinthApp', 'meta', 'java_versions')
    ];

    for (const root of roots) {
      if (fs.existsSync(root)) {
        try {
          const entries = fs.readdirSync(root, { withFileTypes: true });
          for (const ent of entries) {
            if (ent.isDirectory()) {
              const javaBin = path.join(root, ent.name, 'bin', binName);
              if (fs.existsSync(javaBin)) {
                const match = ent.name.match(/zulu(\d+)|jdk-?(\d+)|jre-?1\.?(\d+)|jre_?(\d+)|adoptium-?(\d+)|openjdk-?(\d+)|java-(\d+)/i);
                const major = match ? parseInt(match[1] || match[2] || match[3] || match[4] || match[5] || match[6] || match[7], 10) : null;
                list.push({
                  major,
                  path: javaBin,
                  name: ent.name
                });
              }
            }
          }
        } catch (e) {}
      }
    }

    list.sort((a, b) => (b.major || 0) - (a.major || 0));
    return list;
  }

  static getJavaMajorFromPath(javaPath) {
    if (!javaPath) return null;
    const match = javaPath.match(/zulu(\d+)|jdk-?(\d+)|jre-?1\.?(\d+)|jre_?(\d+)|adoptium-?(\d+)/i);
    if (match) {
      return parseInt(match[1] || match[2] || match[3] || match[4] || match[5], 10);
    }
    return null;
  }

  static getRequiredJavaVersion(mcVersion) {
    if (!mcVersion) return 17;
    const vStr = String(mcVersion).trim();

    // 26.x or newer (e.g. 26.1, 26.2, 1.26)
    if (/^2[5-9]/.test(vStr) || vStr.startsWith('1.26') || vStr.startsWith('26.')) {
      return 25;
    }

    // 1.21.x or 1.20.5+
    if (vStr.startsWith('1.21') || vStr.startsWith('1.20.5') || vStr.startsWith('1.20.6')) {
      return 21;
    }

    // 1.17 to 1.20.4
    if (/^1\.(1[7-9]|20)/.test(vStr)) {
      return 17;
    }

    // 1.16.5 and older
    return 8;
  }

  static resolveJavaByMajor(requiredMajor) {
    const javas = this.scanInstalledJavas();
    const exact = javas.find(j => j.major === requiredMajor);
    if (exact) return exact.path;
    const higher = [...javas].reverse().find(j => j.major >= requiredMajor);
    if (higher) return higher.path;
    return javas[0]?.path || 'java';
  }

  static resolveJava(mcVersion) {
    const required = this.getRequiredJavaVersion(mcVersion);
    return this.resolveJavaByMajor(required);
  }
}

module.exports = JavaResolver;
