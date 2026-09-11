const net = require('net');

function writeVarInt(val) {
  const buf = [];
  while (true) {
    if ((val & ~0x7F) === 0) {
      buf.push(val);
      return Buffer.from(buf);
    }
    buf.push((val & 0x7F) | 0x80);
    val >>>= 7;
  }
}

function pingMinecraft(host = '127.0.0.1', port = 25565, timeout = 2500) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let socket;

    try {
      socket = net.createConnection({ host, port, timeout }, () => {
        const hostBuf = Buffer.from(host, 'utf8');
        const handshakePayload = Buffer.concat([
          writeVarInt(0x00),
          writeVarInt(765),
          writeVarInt(hostBuf.length),
          hostBuf,
          Buffer.from([(port >> 8) & 0xFF, port & 0xFF]),
          writeVarInt(1)
        ]);
        const handshake = Buffer.concat([writeVarInt(handshakePayload.length), handshakePayload]);
        const statusReq = Buffer.concat([writeVarInt(1), writeVarInt(0x00)]);

        socket.write(Buffer.concat([handshake, statusReq]));
      });
    } catch (e) {
      return resolve({ online: false, error: e.message });
    }

    let data = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      data = Buffer.concat([data, chunk]);
      const jsonStart = data.indexOf('{');
      const jsonEnd = data.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        try {
          const jsonStr = data.slice(jsonStart, jsonEnd + 1).toString('utf8');
          const parsed = JSON.parse(jsonStr);
          socket.destroy();
          resolve({
            online: true,
            latencyMs: Date.now() - startTime,
            version: parsed.version?.name || 'Unknown',
            protocol: parsed.version?.protocol,
            playersOnline: parsed.players?.online || 0,
            playersMax: parsed.players?.max || 0,
            playerSample: (parsed.players?.sample || []).map(p => p.name),
            motd: typeof parsed.description === 'string'
              ? parsed.description
              : (parsed.description?.text || JSON.stringify(parsed.description)),
            favicon: parsed.favicon || null
          });
        } catch (e) {}
      }
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({ online: false });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ online: false });
    });
  });
}

module.exports = { pingMinecraft };
