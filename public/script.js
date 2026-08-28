const chat = document.getElementById('chat');
const emptyState = document.getElementById('emptyState');
const messagesEl = document.getElementById('messages');
const composer = document.getElementById('composer');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const suggestions = document.getElementById('suggestions');
const homeBtn = document.getElementById('homeBtn');

suggestions?.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  input.value = chip.dataset.prompt || '';
  composer.requestSubmit();
});

homeBtn?.addEventListener('click', () => {
  history = [];
  messagesEl.innerHTML = '';
  emptyState.style.display = 'flex';
  input.value = '';
  input.style.height = 'auto';
  input.focus();
});

let history = [];
let isStreaming = false;

// Auto-resize textarea
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    composer.requestSubmit();
  }
});

composer.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || isStreaming) return;

  emptyState.style.display = 'none';
  addMessage('user', text);
  history.push({ role: 'user', content: text });

  input.value = '';
  input.style.height = 'auto';
  setStreaming(true);

  const assistantEl = addMessage('assistant', '');
  assistantEl.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';

  let fullText = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });

    if (!res.ok || !res.body) {
      throw new Error('Réponse serveur invalide');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sawError = false;
    let firstChunk = true;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.text) {
              if (firstChunk) {
                assistantEl.innerHTML = '';
                firstChunk = false;
              }
              fullText += evt.text;
              assistantEl.textContent = fullText;
              chat.scrollTop = chat.scrollHeight;
            }
            if (evt.error) {
              sawError = true;
              assistantEl.textContent = "⚠️ " + evt.error;
            }
          } catch (_) {}
        }
      }
    }

    if (!fullText && !sawError) {
      assistantEl.textContent = "Désolé, je n'ai pas pu générer de réponse.";
    } else if (fullText) {
      history.push({ role: 'assistant', content: fullText });
    }
  } catch (err) {
    assistantEl.textContent = "⚠️ Erreur de connexion au serveur.";
  } finally {
    setStreaming(false);
    chat.scrollTop = chat.scrollHeight;
  }
});

function addMessage(role, text) {
  const wrapper = document.createElement('div');
  wrapper.className = `msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  chat.scrollTop = chat.scrollHeight;
  return bubble;
}

function setStreaming(state) {
  isStreaming = state;
  sendBtn.disabled = state;
  statusDot.classList.toggle('thinking', state);
  statusText.textContent = state ? 'Réflexion en cours…' : 'En ligne';
}
