(function (root) {
  async function consumeSSE(body, onEvent) {
    if (!body) throw new Error('没有收到回复数据流。');
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', event = 'message', data = [];
    function dispatch() {
      if (data.length) onEvent({ event, data: data.join('\n') });
      event = 'message'; data = [];
    }
    function line(text) {
      if (!text) return dispatch();
      if (text.startsWith(':')) return;
      const colon = text.indexOf(':');
      const field = colon < 0 ? text : text.slice(0, colon);
      let value = colon < 0 ? '' : text.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'data') data.push(value);
      if (field === 'event') event = value;
    }
    function drain(final = false) {
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        line(buffer.slice(0, index).replace(/\r$/, ''));
        buffer = buffer.slice(index + 1);
      }
      if (buffer.length > 1024 * 1024) throw new Error('回复数据过长。');
      if (final) { if (buffer) line(buffer.replace(/\r$/, '')); dispatch(); }
    }
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }); drain();
      }
      buffer += decoder.decode(); drain(true);
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally { reader.releaseLock(); }
  }

  async function readCompletionStream(body, onDelta = () => {}) {
    const message = { role: 'assistant', content: '' };
    const calls = new Map();
    let finished = false, finishReason = null;
    await consumeSSE(body, ({ data }) => {
      if (data === '[DONE]') { finished = true; return; }
      const chunk = JSON.parse(data);
      if (chunk.error) throw new Error(chunk.error.message || '模型回复中断。');
      const choice = chunk.choices?.find((item) => (item.index || 0) === 0);
      if (!choice) return;
      if (choice.finish_reason) { finishReason = choice.finish_reason; finished = true; }
      const delta = choice.delta || {};
      if (typeof delta.content === 'string' && delta.content) {
        message.content += delta.content; onDelta(delta.content);
      }
      for (const item of delta.tool_calls || []) {
        if (!Number.isInteger(item.index) || item.index < 0 || item.index >= 8) throw new Error('Invalid tool call index');
        const call = calls.get(item.index) || { id: '', type: 'function', function: { name: '', arguments: '' } };
        if (item.id) call.id = item.id;
        if (item.function?.name) call.function.name += item.function.name;
        if (item.function?.arguments) call.function.arguments += item.function.arguments;
        calls.set(item.index, call);
      }
    });
    if (!finished || finishReason === 'length' || finishReason === 'content_filter') throw new Error('模型回复未完成，请重新发送。');
    if (calls.size) message.tool_calls = [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([, call]) => call);
    return { choices: [{ message, finish_reason: finishReason }] };
  }
  const api = { consumeSSE, readCompletionStream };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuittrStream = api;
})(globalThis);
