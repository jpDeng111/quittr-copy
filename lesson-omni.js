const narrationModel = 'qwen3.8-omni-flash-realtime';
const directions = '你是课堂配音员。收到朗读稿后，用甜美、温暖、自然的普通话逐字朗读正文。照读每一个字；不要解释、不要补充、不要问候，也不要读出引号。语速平稳，像在轻声讲一节课。';

function words(text) {
  return String(text ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function readOmni({ url, apiKey, voice, text, sampleRate, signal, connect }) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const socket = connect(url, { headers: { Authorization: 'Bearer ' + apiKey } });
    const chunks = [];
    let bytes = 0;
    let transcript;
    let settled = false;
    const fail = (message, code) => finish(new Error(message, { cause: code }));
    const abort = () => fail('Omni narration timed out');
    function finish(error, pcm) {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      socket.close();
      if (error) reject(error);
      else resolve(pcm);
    }
    function send(payload) {
      socket.send(JSON.stringify(payload));
    }
    signal.addEventListener('abort', abort, { once: true });
    socket.addEventListener('close', () => fail('Omni narration closed early'), { once: true });
    socket.addEventListener('error', () => fail('Omni narration connection failed'), { once: true });
    socket.addEventListener('message', event => {
      if (settled) return;
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'session.created':
            send({
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                turn_detection: null,
                instructions: directions,
                audio: { output: { voice, format: { type: 'pcm', sample_rate: sampleRate, sample_format: 's16le', channels: 1 } } }
              }
            });
            break;
          case 'session.updated':
            send({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: [{ type: 'input_text', text: '请直接逐字朗读下面的正文，只说引号内的内容。\n「' + text + '」' }]
              }
            });
            send({ type: 'response.create' });
            break;
          case 'response.audio.delta': {
            const chunk = Buffer.from(message.delta, 'base64');
            bytes += chunk.length;
            if (bytes > sampleRate * 2 * 60) fail('Omni narration exceeds one minute per scene');
            else chunks.push(chunk);
            break;
          }
          case 'response.audio_transcript.done':
            transcript = message.transcript;
            break;
          case 'response.done':
            if (message.response?.status !== 'completed' || !bytes || bytes % 2) fail('Omni narration is incomplete');
            else if (words(transcript) !== words(text)) fail('Omni narration differs from the captions', 'transcript');
            else finish(null, Buffer.concat(chunks, bytes));
            break;
          case 'error':
            fail('Omni narration request failed');
            break;
        }
      } catch {
        fail('Invalid Omni narration event');
      }
    });
  });
}

async function synthesizeOmni(cues, { apiKey, workspace, voice, sampleRate, connect }) {
  if (!/^[a-z0-9-]+$/.test(workspace)) throw new Error('Invalid Bailian workspace');
  const url = 'wss://' + workspace + '.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime?model=' + narrationModel;
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]);
  const render = async ({ narration: text }) => {
    const options = { url, apiKey, voice, text, sampleRate, signal, connect };
    try {
      return await readOmni(options);
    } catch (error) {
      if (error.cause !== 'transcript') throw error;
      return readOmni(options);
    }
  };

  try {
    const clips = [];
    for (let i = 0; i < cues.length; i += 3) {
      clips.push(...await Promise.all(cues.slice(i, i + 3).map(render)));
    }
    return clips;
  } finally {
    controller.abort();
  }
}

module.exports = { synthesizeOmni };
