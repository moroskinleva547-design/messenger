(() => {
  'use strict';

  // ==================== DB (IndexedDB) ====================
  const DB_NAME = 'MessengerDB';
  const DB_VERSION = 1;
  let db = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('users')) d.createObjectStore('users', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('chats')) d.createObjectStore('chats', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('messages')) {
          const s = d.createObjectStore('messages', { keyPath: 'id' });
          s.createIndex('chatId', 'chatId', { unique: false });
        }
        if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = e => reject(e.target.error);
    });
  }

  function dbPut(store, data) {
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(data);
      tx.oncomplete = () => res();
      tx.onerror = e => rej(e.target.error);
    });
  }

  function dbGet(store, key) {
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = e => rej(e.target.error);
    });
  }

  function dbGetAll(store) {
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = e => rej(e.target.error);
    });
  }

  function dbDelete(store, key) {
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => res();
      tx.onerror = e => rej(e.target.error);
    });
  }

  function dbClear() {
    const stores = ['users', 'chats', 'messages', 'settings'];
    return Promise.all(stores.map(s => new Promise((res, rej) => {
      const tx = db.transaction(s, 'readwrite');
      tx.objectStore(s).clear();
      tx.oncomplete = () => res();
      tx.onerror = e => rej(e.target.error);
    })));
  }

  // ==================== STATE ====================
  const state = {
    user: null,
    chats: [],
    currentChatId: null,
    messages: {},
    replyTo: null,
    editingMsg: null,
    settings: {
      theme: 'light',
      chatBg: 'default',
      chatBgCustom: '',
      pushEnabled: false,
      soundEnabled: true
    },
    wsConnected: true,
    typingTimers: {}
  };

  // ==================== WEBSOCKET EMULATOR ====================
  let wsReconnectTimer = null;
  const ws = {
    _handlers: {},
    _connected: true,
    on(event, fn) { (this._handlers[event] = this._handlers[event] || []).push(fn); },
    emit(event, data) {
      setTimeout(() => {
        if (this._handlers[event]) this._handlers[event].forEach(fn => fn(data));
      }, 50 + Math.random() * 150);
    },
    send(type, data) {
      if (!this._connected) return;
      this.emit(type, data);
      if (type === 'message') {
        const msgId = data.id;
        setTimeout(() => {
          this.emit('status', { messageId: msgId, status: 'delivered' });
        }, 400 + Math.random() * 600);
        setTimeout(() => {
          this.emit('status', { messageId: msgId, status: 'read' });
        }, 1500 + Math.random() * 2000);
      }
      if (type === 'typing') {
        const chatId = data.chatId;
        const userId = data.userId;
        setTimeout(() => {
          this.emit('typing_stop', { chatId, userId });
        }, 2000 + Math.random() * 2000);
      }
    },
    simulateDisconnect() {
      this._connected = false;
      state.wsConnected = false;
      updateConnectionStatus();
      wsReconnectTimer = setTimeout(() => {
        this._connected = true;
        state.wsConnected = true;
        updateConnectionStatus();
        toast('Соединение восстановлено');
      }, 3000 + Math.random() * 5000);
    },
    simulateMessage(chatId) {
      if (!this._connected) return;
      const chat = state.chats.find(c => c.id === chatId);
      if (!chat) return;
      const responses = [
        'Понял, спасибо!', 'Хорошо, договорились', 'Да, конечно', 'Интересно, расскажи больше',
        'Окей', 'Сейчас занят, напишу позже', 'Отличная идея!', 'Согласен', 'Нужно подумать',
        'А что думаешь по этому поводу?', 'Звучит здорово!', 'Не уверен, что смогу',
        'Попробуй перезагрузить', 'Мне кажется, это работает', 'Скинь ссылку, посмотрю'
      ];
      const msg = {
        id: generateId(),
        chatId,
        senderId: chat.participantId,
        text: responses[Math.floor(Math.random() * responses.length)],
        timestamp: Date.now(),
        status: 'read',
        type: 'text'
      };
      this.emit('new_message', msg);
      this.emit('typing_stop', { chatId, userId: chat.participantId });
    }
  };

  // ==================== UTILITIES ====================
  let idCounter = 0;
  function generateId() { return `msg_${Date.now()}_${++idCounter}_${Math.random().toString(36).slice(2, 8)}`; }
  function generateChatId() { return `chat_${Date.now()}_${++idCounter}`; }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Сегодня';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' });
  }

  function formatVoiceTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function fileToBase64(file) {
    return new Promise(res => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.readAsDataURL(file);
    });
  }

  // ==================== TOAST ====================
  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 300); }, 3000);
  }

  // ==================== RIPPLE ====================
  function initRipple() {
    document.addEventListener('pointerdown', e => {
      const btn = e.target.closest('.ripple');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const effect = document.createElement('span');
      effect.className = 'ripple-effect';
      effect.style.width = effect.style.height = size + 'px';
      effect.style.left = (e.clientX - rect.left - size / 2) + 'px';
      effect.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(effect);
      setTimeout(() => effect.remove(), 600);
    });
  }

  // ==================== AUTH ====================
  function initAuth() {
    const form = document.getElementById('auth-form');
    const nameInput = document.getElementById('auth-name');
    const passInput = document.getElementById('auth-password');

    form.addEventListener('submit', e => {
      e.preventDefault();
      let valid = true;

      const nameGroup = nameInput.closest('.input-group');
      const passGroup = passInput.closest('.input-group');
      const nameError = document.getElementById('auth-name-error');
      const passError = document.getElementById('auth-password-error');

      nameGroup.classList.remove('error', 'success');
      passGroup.classList.remove('error', 'success');

      if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
        nameGroup.classList.add('error');
        nameError.textContent = 'Минимум 2 символа';
        valid = false;
      } else {
        nameGroup.classList.add('success');
      }

      if (!passInput.value || passInput.value.length < 4) {
        passGroup.classList.add('error');
        passError.textContent = 'Минимум 4 символа';
        valid = false;
      } else {
        passGroup.classList.add('success');
      }

      if (!valid) return;

      state.user = {
        id: 'user_' + Date.now(),
        name: nameInput.value.trim(),
        avatar: '',
        status: 'В сети',
        password: passInput.value
      };

      dbPut('users', state.user).then(() => {
        showMessenger();
      });
    });
  }

  // ==================== DEMO DATA ====================
  async function generateDemoData() {
    const existingChats = await dbGetAll('chats');
    if (existingChats.length > 0) return;

    const contacts = [
      { id: 'u_alice', name: 'Алиса', avatar: '', online: true },
      { id: 'u_bob', name: 'Борис', avatar: '', online: false },
      { id: 'u_carol', name: 'Карина', avatar: '', online: true },
      { id: 'u_danil', name: 'Данил', avatar: '', online: false },
      { id: 'u_elena', name: 'Елена', avatar: '', online: true },
    ];

    for (const c of contacts) {
      await dbPut('users', c);
    }

    const demoMessages = {
      'u_alice': [
        'Привет! Как дела?', 'Нормально, спасибо! А у тебя?', 'Отлично! Давно не виделись',
        'Да, надо встретиться. Когда удобно?', 'Как насчет пятницы?', 'Идеально, договорились!'
      ],
      'u_bob': [
        'Привет, присылай документы', 'Ок, сейчас скину', 'Жду', 'Вот, посмотри',
        'Хорошо, завтра скажу', 'Договорились'
      ],
      'u_carol': [
        'Привет! Видела твой пост, очень круто', 'Спасибо! Ты тоже пишешь?',
        'Да, хотела начать', 'Могу помочь с советами', 'Было бы здорово!'
      ],
      'u_danil': [
        'Бро, есть задача', 'Какая?', 'Нужно сделать дизайн для клиента',
        'Скинь бриф, посмотрю', 'Скинул в почту', 'Ок, посмотрю вечером'
      ],
      'u_elena': [
        'Добрый день! Встреча переносится на 15:00', 'Хорошо, спасибо за информацию',
        'Не за что!', 'Кстати, презентация готова', 'Отлично,准备好了'
      ]
    };

    const now = Date.now();
    for (const contact of contacts) {
      const chatId = generateChatId();
      const msgs = demoMessages[contact.id] || [];
      let ts = now - msgs.length * 300000;

      const chat = {
        id: chatId,
        participantId: contact.id,
        participantName: contact.name,
        participantAvatar: contact.avatar,
        participantOnline: contact.online,
        lastMessage: msgs[msgs.length - 1] || '',
        lastMessageTime: ts,
        unreadCount: Math.floor(Math.random() * 4)
      };

      await dbPut('chats', chat);

      for (const text of msgs) {
        const isUser = msgs.indexOf(text) % 2 === 1;
        const msg = {
          id: generateId(),
          chatId,
          senderId: isUser ? state.user.id : contact.id,
          text,
          timestamp: ts,
          status: 'read',
          type: 'text'
        };
        await dbPut('messages', msg);
        ts += 300000;
      }
    }
  }

  // ==================== SHOW MESSENGER ====================
  async function showMessenger() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('messenger-screen').classList.add('active');
    document.getElementById('auth-screen').style.display = 'none';

    await generateDemoData();
    await loadChats();
    await loadSettings();

    applySettings();
    hideSkeleton();

    document.getElementById('profile-name').value = state.user.name;
    document.getElementById('profile-status').value = state.user.status || 'В сети';
    if (state.user.avatar) {
      const preview = document.getElementById('avatar-preview');
      preview.src = state.user.avatar;
      document.getElementById('avatar-upload').classList.add('has-image');
    }

    initWSHandlers();

    setTimeout(() => ws.simulateDisconnect(), 15000 + Math.random() * 20000);
  }

  // ==================== LOAD CHATS ====================
  async function loadChats() {
    state.chats = await dbGetAll('chats');
    state.chats.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    renderChatList();
  }

  function renderChatList(filter = '') {
    const list = document.getElementById('chat-list');
    const skeleton = document.getElementById('skeleton-list');
    if (skeleton) skeleton.style.display = 'none';

    const filtered = filter
      ? state.chats.filter(c => c.participantName.toLowerCase().includes(filter.toLowerCase()))
      : state.chats;

    const existingItems = list.querySelectorAll('.chat-item');
    existingItems.forEach(el => el.remove());

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'chat-item';
      empty.innerHTML = `<div class="chat-item-info"><div class="chat-item-name" style="color:var(--text-tertiary)">Чатов пока нет</div></div>`;
      list.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const chat of filtered) {
      const el = createChatItem(chat);
      fragment.appendChild(el);
    }
    list.appendChild(fragment);
  }

  function createChatItem(chat) {
    const el = document.createElement('div');
    el.className = 'chat-item' + (state.currentChatId === chat.id ? ' active' : '');
    el.dataset.chatId = chat.id;

    const initials = chat.participantName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const lastTime = chat.lastMessageTime ? formatTime(chat.lastMessageTime) : '';

    el.innerHTML = `
      <div class="chat-item-avatar">
        ${chat.participantAvatar ? `<img src="${chat.participantAvatar}" alt="">` : initials}
        ${chat.participantOnline ? '<div class="online-dot"></div>' : ''}
      </div>
      <div class="chat-item-info">
        <div class="chat-item-top">
          <span class="chat-item-name">${escapeHtml(chat.participantName)}</span>
          <span class="chat-item-time">${lastTime}</span>
        </div>
        <div class="chat-item-bottom">
          <span class="chat-item-last">${escapeHtml(chat.lastMessage || '')}</span>
          ${chat.unreadCount > 0 ? `<span class="chat-item-badge">${chat.unreadCount}</span>` : ''}
        </div>
      </div>`;

    el.addEventListener('click', () => openChat(chat.id));
    return el;
  }

  function hideSkeleton() {
    const sk = document.getElementById('skeleton-list');
    if (sk) sk.style.display = 'none';
  }

  // ==================== OPEN CHAT ====================
  async function openChat(chatId) {
    state.currentChatId = chatId;
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;

    chat.unreadCount = 0;
    await dbPut('chats', chat);

    document.getElementById('header-chat-info').innerHTML = `
      <span class="header-chat-name">${escapeHtml(chat.participantName)}</span>
    `;

    document.getElementById('chat-empty').classList.add('hidden');
    document.getElementById('chat-messages').classList.remove('hidden');
    document.getElementById('chat-input-area').classList.remove('hidden');

    renderChatList();
    await loadMessages(chatId);

    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) sidebar.classList.remove('open');

    cancelReply();
    cancelEdit();
  }

  // ==================== MESSAGES ====================
  async function loadMessages(chatId) {
    const allMsgs = await dbGetAll('messages');
    state.messages[chatId] = allMsgs
      .filter(m => m.chatId === chatId)
      .sort((a, b) => a.timestamp - b.timestamp);

    renderMessages(chatId);
  }

  function renderMessages(chatId) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    const msgs = state.messages[chatId] || [];
    let lastDate = '';

    for (const msg of msgs) {
      const msgDate = formatDate(msg.timestamp);
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        const sep = document.createElement('div');
        sep.className = 'message-date-separator';
        sep.innerHTML = `<span style="background:rgba(0,0,0,.08);padding:4px 12px;border-radius:8px;font-size:12px;color:var(--text-secondary);align-self:center;margin:8px 0">${msgDate}</span>`;
        container.appendChild(sep);
      }
      container.appendChild(createMessageEl(msg));
    }

    scrollToBottom(false);
  }

  function createMessageEl(msg) {
    const isOut = msg.senderId === state.user.id;
    const el = document.createElement('div');
    el.className = `message ${isOut ? 'out' : 'in'}`;
    el.dataset.msgId = msg.id;

    let content = '';

    if (msg.type === 'text') {
      content = `<div class="message-text">${escapeHtml(msg.text)}</div>`;
    } else if (msg.type === 'image') {
      content = `<img class="message-image" src="${msg.fileData}" alt="image" loading="lazy">`;
    } else if (msg.type === 'file') {
      content = `
        <div class="message-file" onclick="window.open('${msg.fileData}','_blank')">
          <div class="message-file-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="message-file-info">
            <div class="message-file-name">${escapeHtml(msg.fileName || 'Файл')}</div>
            <div class="message-file-size">${msg.fileSize || ''}</div>
          </div>
        </div>`;
    } else if (msg.type === 'voice') {
      content = `<div class="message-audio" data-src="${msg.fileData}" data-duration="${msg.duration || 0}"></div>`;
    }

    let replyHtml = '';
    if (msg.replyTo) {
      const orig = (state.messages[msg.chatId] || []).find(m => m.id === msg.replyTo);
      if (orig) {
        replyHtml = `
          <div class="message-reply">
            <span class="message-reply-name">${orig.senderId === state.user.id ? 'Вы' : (state.chats.find(c => c.id === msg.chatId)?.participantName || '')}</span>
            <span class="message-reply-text">${escapeHtml(orig.text || 'Медиа')}</span>
          </div>`;
      }
    }

    let editMark = msg.edited ? ' <span style="font-size:11px;color:var(--text-tertiary)">(ред.)</span>' : '';

    const statusSvg = getStatusSvg(isOut ? msg.status : null);

    el.innerHTML = `
      <div class="message-bubble">
        ${replyHtml}
        ${content}
        ${msg.type === 'text' ? editMark : ''}
        <div class="message-meta">
          <span class="message-time">${formatTime(msg.timestamp)}</span>
          ${statusSvg}
        </div>
      </div>`;

    if (isOut) {
      el.addEventListener('contextmenu', e => showContextMenu(e, msg));
      el.addEventListener('touchstart', e => handleLongPress(e, msg), { passive: true });
      el.addEventListener('touchend', () => clearTimeout(el._longPressTimer));
    } else {
      el.addEventListener('contextmenu', e => showContextMenu(e, msg));
    }

    if (msg.type === 'voice') {
      setTimeout(() => initAudioPlayer(el.querySelector('.message-audio')), 0);
    }

    if (msg.type === 'image') {
      const img = el.querySelector('.message-image');
      if (img) {
        img.addEventListener('click', () => openImageViewer(msg.fileData));
      }
    }

    return el;
  }

  function getStatusSvg(status) {
    if (!status) return '';
    if (status === 'sending') {
      return `<span class="message-status sending"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg></span>`;
    }
    if (status === 'delivered') {
      return `<span class="message-status delivered"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></span>`;
    }
    if (status === 'read') {
      return `<span class="message-status read"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 6 7 17 2 12"/><polyline points="22 6 11 17" transform="translate(2,0)"/></svg></span>`;
    }
    return '';
  }

  function scrollToBottom(smooth = true) {
    const container = document.getElementById('chat-messages');
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant'
      });
    });
  }

  // ==================== INFINITE SCROLL ====================
  function initInfiniteScroll() {
    const container = document.getElementById('chat-messages');
    let loading = false;

    container.addEventListener('scroll', async () => {
      if (loading || !state.currentChatId) return;
      if (container.scrollTop < 100) {
        loading = true;
        const msgs = state.messages[state.currentChatId] || [];
        if (msgs.length > 0) {
          const firstTs = msgs[0].timestamp;
          const allMsgs = await dbGetAll('messages');
          const older = allMsgs
            .filter(m => m.chatId === state.currentChatId && m.timestamp < firstTs)
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-20);

          if (older.length > 0) {
            const prevHeight = container.scrollHeight;
            state.messages[state.currentChatId] = [...older, ...msgs];
            renderMessages(state.currentChatId);
            container.scrollTop = container.scrollHeight - prevHeight;
          }
        }
        loading = false;
      }
    });
  }

  // ==================== SEND MESSAGE ====================
  async function sendMessage(text, type = 'text', extra = {}) {
    if (!state.currentChatId) return;
    if (type === 'text' && (!text || !text.trim())) return;

    const msg = {
      id: generateId(),
      chatId: state.currentChatId,
      senderId: state.user.id,
      text: text || '',
      timestamp: Date.now(),
      status: 'sending',
      type,
      ...extra
    };

    if (state.replyTo) {
      msg.replyTo = state.replyTo;
      cancelReply();
    }

    if (!state.messages[state.currentChatId]) state.messages[state.currentChatId] = [];
    state.messages[state.currentChatId].push(msg);
    await dbPut('messages', msg);

    const chat = state.chats.find(c => c.id === state.currentChatId);
    if (chat) {
      chat.lastMessage = type === 'text' ? text : type === 'image' ? '📷 Фото' : type === 'voice' ? '🎤 Голосовое' : '📎 Файл';
      chat.lastMessageTime = msg.timestamp;
      await dbPut('chats', chat);
    }

    const el = createMessageEl(msg);
    document.getElementById('chat-messages').appendChild(el);
    scrollToBottom();

    const sendBtn = document.getElementById('send-btn');
    sendBtn.classList.add('pulse');
    setTimeout(() => sendBtn.classList.remove('pulse'), 400);

    ws.send('message', msg);

    if (type === 'text') {
      const input = document.getElementById('message-input');
      input.value = '';
      input.style.height = 'auto';
      document.getElementById('send-btn').classList.add('hidden');
    }

    ws.send('typing', { chatId: state.currentChatId, userId: state.user.id });

    setTimeout(() => {
      const replyTexts = [
        'Понял, спасибо!', 'Хорошо', 'Окей', 'Сейчас занят, напишу позже',
        'Отличная идея!', 'Да, конечно', 'Нужно подумать', 'Скинь подробнее'
      ];
      ws.simulateMessage(state.currentChatId);
    }, 2000 + Math.random() * 3000);

    renderChatList();
  }

  // ==================== WEBSOCKET HANDLERS ====================
  function initWSHandlers() {
    ws.on('status', async data => {
      const msgs = state.messages[data.messageId] ||
        Object.values(state.messages).flat().find(m => m.id === data.messageId);
      if (msgs) return;
      for (const chatId of Object.keys(state.messages)) {
        const msg = state.messages[chatId].find(m => m.id === data.messageId);
        if (msg) {
          msg.status = data.status;
          await dbPut('messages', msg);
          const el = document.querySelector(`[data-msg-id="${data.messageId}"] .message-status`);
          if (el) {
            el.outerHTML = getStatusSvg(data.status);
          }
          break;
        }
      }
    });

    ws.on('new_message', async msg => {
      if (!state.messages[msg.chatId]) state.messages[msg.chatId] = [];
      const exists = state.messages[msg.chatId].find(m => m.id === msg.id);
      if (!exists) {
        state.messages[msg.chatId].push(msg);
        await dbPut('messages', msg);

        const chat = state.chats.find(c => c.id === msg.chatId);
        if (chat) {
          chat.lastMessage = msg.text || 'Медиа';
          chat.lastMessageTime = msg.timestamp;
          if (msg.chatId !== state.currentChatId) {
            chat.unreadCount = (chat.unreadCount || 0) + 1;
          }
          await dbPut('chats', chat);
        }

        if (msg.chatId === state.currentChatId) {
          const el = createMessageEl(msg);
          el.classList.add('new-msg-glow');
          document.getElementById('chat-messages').appendChild(el);
          scrollToBottom();
        } else {
          showPushNotification(msg, chat);
        }

        renderChatList();
        if (state.settings.soundEnabled) playNotificationSound();
      }
    });

    ws.on('typing', data => {
      if (data.chatId === state.currentChatId && data.userId !== state.user.id) {
        document.getElementById('typing-indicator').classList.remove('hidden');
      }
    });

    ws.on('typing_stop', data => {
      if (data.chatId === state.currentChatId) {
        document.getElementById('typing-indicator').classList.add('hidden');
      }
    });
  }

  // ==================== CONTEXT MENU ====================
  function showContextMenu(e, msg) {
    e.preventDefault();
    const menu = document.getElementById('context-menu');
    menu.classList.remove('hidden');
    menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 150) + 'px';

    const editBtn = menu.querySelector('[data-action="edit"]');
    editBtn.style.display = msg.senderId === state.user.id ? 'flex' : 'none';

    const deleteBtn = menu.querySelector('[data-action="delete"]');
    deleteBtn.style.display = msg.senderId === state.user.id ? 'flex' : 'none';

    menu.querySelectorAll('.context-item').forEach(btn => {
      btn.onclick = () => {
        handleContextAction(btn.dataset.action, msg);
        menu.classList.add('hidden');
      };
    });
  }

  function handleContextAction(action, msg) {
    if (action === 'reply') {
      state.replyTo = msg.id;
      const preview = document.getElementById('reply-preview');
      preview.classList.remove('hidden');
      preview.querySelector('.reply-name').textContent = msg.senderId === state.user.id ? 'Вы' : (state.chats.find(c => c.id === msg.chatId)?.participantName || '');
      preview.querySelector('.reply-text').textContent = msg.text || 'Медиа';
      document.getElementById('message-input').focus();
    } else if (action === 'edit') {
      state.editingMsg = msg.id;
      const input = document.getElementById('message-input');
      input.value = msg.text;
      input.focus();
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
      document.getElementById('send-btn').classList.remove('hidden');
      const msgEl = document.querySelector(`[data-msg-id="${msg.id}"]`);
      if (msgEl) msgEl.classList.add('editing');
    } else if (action === 'delete') {
      deleteMessage(msg);
    }
  }

  function cancelReply() {
    state.replyTo = null;
    document.getElementById('reply-preview').classList.add('hidden');
  }

  function cancelEdit() {
    if (state.editingMsg) {
      const msgEl = document.querySelector(`[data-msg-id="${state.editingMsg}"]`);
      if (msgEl) msgEl.classList.remove('editing');
      state.editingMsg = null;
      document.getElementById('message-input').value = '';
      document.getElementById('send-btn').classList.add('hidden');
    }
  }

  async function deleteMessage(msg) {
    const el = document.querySelector(`[data-msg-id="${msg.id}"]`);
    if (el) {
      el.classList.add('deleting');
      await new Promise(r => setTimeout(r, 400));
    }

    const chatMsgs = state.messages[msg.chatId];
    if (chatMsgs) {
      const idx = chatMsgs.findIndex(m => m.id === msg.id);
      if (idx > -1) chatMsgs.splice(idx, 1);
    }
    await dbDelete('messages', msg.id);

    const chat = state.chats.find(c => c.id === msg.chatId);
    if (chat && chatMsgs && chatMsgs.length > 0) {
      const last = chatMsgs[chatMsgs.length - 1];
      chat.lastMessage = last.text || 'Медиа';
      chat.lastMessageTime = last.timestamp;
      await dbPut('chats', chat);
    }

    renderChatList();
    if (el) el.remove();
  }

  function handleLongPress(e, msg) {
    const el = e.currentTarget;
    el._longPressTimer = setTimeout(() => {
      const touch = e.touches[0];
      showContextMenu({ preventDefault: () => {}, clientX: touch.clientX, clientY: touch.clientY }, msg);
    }, 500);
  }

  // ==================== TYPING HANDLER ====================
  function initTypingHandler() {
    const input = document.getElementById('message-input');
    let typingTimeout;

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      const sendBtn = document.getElementById('send-btn');
      if (input.value.trim()) {
        sendBtn.classList.remove('hidden');
      } else {
        sendBtn.classList.add('hidden');
      }
      if (!state.editingMsg && state.currentChatId) {
        ws.send('typing', { chatId: state.currentChatId, userId: state.user.id });
      }
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === 'Escape') {
        cancelReply();
        cancelEdit();
      }
    });
  }

  function handleSend() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;

    if (state.editingMsg) {
      editMessage(state.editingMsg, text);
    } else {
      sendMessage(text, 'text');
    }
  }

  async function editMessage(msgId, newText) {
    for (const chatId of Object.keys(state.messages)) {
      const msg = state.messages[chatId].find(m => m.id === msgId);
      if (msg) {
        msg.text = newText;
        msg.edited = true;
        await dbPut('messages', msg);
        const el = document.querySelector(`[data-msg-id="${msgId}"]`);
        if (el) {
          el.classList.remove('editing');
          const textEl = el.querySelector('.message-text');
          if (textEl) textEl.innerHTML = escapeHtml(newText) + ' <span style="font-size:11px;color:var(--text-tertiary)">(ред.)</span>';
        }
        break;
      }
    }
    cancelEdit();
    input.value = '';
    document.getElementById('send-btn').classList.add('hidden');
  }

  // ==================== FILE ATTACHMENTS ====================
  function initFileAttachment() {
    const fileInput = document.getElementById('file-input');
    const attachBtn = document.getElementById('attach-btn');

    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async e => {
      for (const file of e.target.files) {
        await handleFileUpload(file);
      }
      fileInput.value = '';
    });

    // Drag & drop
    const chatArea = document.getElementById('chat-area');
    const overlay = document.getElementById('drag-overlay');
    let dragCounter = 0;

    document.addEventListener('dragenter', e => {
      e.preventDefault();
      dragCounter++;
      if (state.currentChatId) overlay.classList.remove('hidden');
    });

    document.addEventListener('dragleave', e => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        overlay.classList.add('hidden');
      }
    });

    document.addEventListener('dragover', e => e.preventDefault());

    document.addEventListener('drop', async e => {
      e.preventDefault();
      dragCounter = 0;
      overlay.classList.add('hidden');
      if (!state.currentChatId) return;
      for (const file of e.dataTransfer.files) {
        await handleFileUpload(file);
      }
    });
  }

  async function handleFileUpload(file) {
    if (!state.currentChatId) return;
    const data = await fileToBase64(file);
    const isImage = file.type.startsWith('image/');

    if (isImage) {
      sendMessage('', 'image', { fileData: data, fileName: file.name, fileSize: formatFileSize(file.size) });
    } else {
      sendMessage('', 'file', { fileData: data, fileName: file.name, fileSize: formatFileSize(file.size) });
    }
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / 1048576).toFixed(1) + ' МБ';
  }

  // ==================== VOICE RECORDING ====================
  let mediaRecorder = null;
  let audioChunks = [];
  let voiceStream = null;
  let voiceTimer = null;
  let voiceSeconds = 0;
  let audioContext = null;
  let analyser = null;

  function initVoiceRecording() {
    const voiceBtn = document.getElementById('voice-btn');
    const voiceCancel = document.getElementById('voice-cancel');
    const voiceSend = document.getElementById('voice-send');

    voiceBtn.addEventListener('click', toggleVoiceRecording);
    voiceCancel.addEventListener('click', cancelVoiceRecording);
    voiceSend.addEventListener('click', sendVoiceRecording);
  }

  async function toggleVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      stopVoiceRecording();
      return;
    }

    try {
      voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      const source = audioContext.createMediaStreamSource(voiceStream);
      source.connect(analyser);

      mediaRecorder = new MediaRecorder(voiceStream);
      audioChunks = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.start();
      voiceSeconds = 0;

      document.getElementById('input-row').classList.add('hidden');
      document.getElementById('voice-recording').classList.remove('hidden');

      voiceTimer = setInterval(() => {
        voiceSeconds++;
        document.getElementById('voice-timer').textContent = formatVoiceTime(voiceSeconds);
        drawVoiceWave();
      }, 1000);

    } catch (err) {
      toast('Не удалось получить доступ к микрофону', 'error');
    }
  }

  function drawVoiceWave() {
    const wave = document.getElementById('voice-wave');
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    wave.innerHTML = '';
    const barCount = 30;
    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor(i * data.length / barCount);
      const val = data[idx] || 0;
      const bar = document.createElement('div');
      bar.className = 'voice-wave-bar';
      bar.style.height = Math.max(4, val / 8) + 'px';
      wave.appendChild(bar);
    }
  }

  function stopVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    clearInterval(voiceTimer);
    if (voiceStream) {
      voiceStream.getTracks().forEach(t => t.stop());
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
      analyser = null;
    }
    document.getElementById('input-row').classList.remove('hidden');
    document.getElementById('voice-recording').classList.add('hidden');
  }

  function cancelVoiceRecording() {
    stopVoiceRecording();
    audioChunks = [];
  }

  async function sendVoiceRecording() {
    stopVoiceRecording();
    if (audioChunks.length === 0) return;

    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onload = () => {
      sendMessage('', 'voice', { fileData: reader.result, duration: voiceSeconds });
    };
    reader.readAsDataURL(blob);
    audioChunks = [];
  }

  // ==================== AUDIO PLAYER ====================
  function initAudioPlayer(container) {
    if (!container || !container.dataset.src) return;
    const src = container.dataset.src;
    const duration = parseInt(container.dataset.duration) || 0;

    container.innerHTML = `
      <div class="audio-player">
        <button class="audio-play-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
        </button>
        <div class="audio-progress-wrap">
          <div class="audio-progress"><div class="audio-progress-fill"></div></div>
          <div class="audio-time"><span class="audio-current">0:00</span><span class="audio-total">${formatVoiceTime(duration)}</span></div>
        </div>
        <button class="audio-speed">1x</button>
      </div>`;

    const audio = new Audio(src);
    let speedIdx = 0;
    const speeds = [1, 1.5, 2];
    const playBtn = container.querySelector('.audio-play-btn');
    const progressFill = container.querySelector('.audio-progress-fill');
    const progress = container.querySelector('.audio-progress');
    const currentTime = container.querySelector('.audio-current');
    const speedBtn = container.querySelector('.audio-speed');

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        progressFill.style.width = (audio.currentTime / audio.duration * 100) + '%';
        currentTime.textContent = formatVoiceTime(audio.currentTime);
      }
    });

    audio.addEventListener('ended', () => {
      playBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>';
      progressFill.style.width = '0%';
    });

    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        playBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      } else {
        audio.pause();
        playBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>';
      }
    });

    progress.addEventListener('click', e => {
      if (audio.duration) {
        const rect = progress.getBoundingClientRect();
        audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
      }
    });

    speedBtn.addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % speeds.length;
      audio.playbackRate = speeds[speedIdx];
      speedBtn.textContent = speeds[speedIdx] + 'x';
    });
  }

  // ==================== IMAGE VIEWER ====================
  function openImageViewer(src) {
    const viewer = document.getElementById('image-viewer');
    const img = document.getElementById('viewer-image');
    img.src = src;
    viewer.classList.remove('hidden');

    const close = viewer.querySelector('.image-viewer-close');
    const backdrop = viewer.querySelector('.image-viewer-backdrop');

    const closeFn = () => {
      viewer.classList.add('hidden');
      close.removeEventListener('click', closeFn);
      backdrop.removeEventListener('click', closeFn);
    };
    close.addEventListener('click', closeFn);
    backdrop.addEventListener('click', closeFn);
  }

  // ==================== PUSH NOTIFICATIONS ====================
  function showPushNotification(msg, chat) {
    if (!state.settings.pushEnabled) return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(chat ? chat.participantName : 'Новое сообщение', {
        body: msg.text || 'Медиа',
        icon: chat?.participantAvatar || undefined,
        tag: msg.chatId
      });
    } catch (e) {}
  }

  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  // ==================== NOTIFICATION SOUND ====================
  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  }

  // ==================== SETTINGS ====================
  async function loadSettings() {
    const saved = await dbGet('settings', 'app');
    if (saved) {
      Object.assign(state.settings, saved.value);
    }
    if (state.user?.id) {
      const userSettings = await dbGet('settings', 'theme_' + state.user.id);
      if (userSettings?.value) state.settings.theme = userSettings.value.theme || 'light';
    }
  }

  function applySettings() {
    document.body.setAttribute('data-theme', state.settings.theme);
    document.documentElement.setAttribute('data-theme', state.settings.theme);

    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.checked = state.settings.theme === 'dark';

    const pushToggle = document.getElementById('push-toggle');
    pushToggle.checked = state.settings.pushEnabled;

    const soundToggle = document.getElementById('sound-toggle');
    soundToggle.checked = state.settings.soundEnabled;

    applyChatBg(state.settings.chatBg);
  }

  function applyChatBg(bg) {
    const chatArea = document.getElementById('chat-area');
    chatArea.className = 'chat-area';
    if (bg === 'dots') chatArea.classList.add('chat-bg-dots');
    else if (bg === 'gradient1') chatArea.classList.add('chat-bg-gradient1');
    else if (bg === 'gradient2') chatArea.classList.add('chat-bg-gradient2');
    else if (bg === 'custom' && state.settings.chatBgCustom) {
      chatArea.classList.add('chat-bg-custom');
      chatArea.style.backgroundImage = `url(${state.settings.chatBgCustom})`;
    } else {
      chatArea.style.backgroundImage = '';
    }

    document.querySelectorAll('.bg-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.bg === bg);
    });
  }

  function saveSettings() {
    const data = { value: state.settings };
    dbPut('settings', { key: 'app', ...data });
  }

  function initSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    const modal = document.getElementById('settings-modal');
    const closeBtn = modal.querySelector('.modal-close');
    const overlay = modal.querySelector('.modal-overlay');

    settingsBtn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      applySettings();
    });
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    overlay.addEventListener('click', () => modal.classList.add('hidden'));

    document.getElementById('theme-toggle').addEventListener('change', e => {
      state.settings.theme = e.target.checked ? 'dark' : 'light';
      document.body.setAttribute('data-theme', state.settings.theme);
      document.documentElement.setAttribute('data-theme', state.settings.theme);
      saveSettings();
    });

    document.querySelectorAll('.bg-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const bg = opt.dataset.bg;
        if (bg === 'custom') {
          document.getElementById('bg-image-input').click();
          return;
        }
        state.settings.chatBg = bg;
        applyChatBg(bg);
        saveSettings();
      });
    });

    document.getElementById('bg-image-input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const data = await fileToBase64(file);
      state.settings.chatBg = 'custom';
      state.settings.chatBgCustom = data;
      applyChatBg('custom');
      saveSettings();
    });

    document.getElementById('push-toggle').addEventListener('change', e => {
      state.settings.pushEnabled = e.target.checked;
      if (e.target.checked) requestNotificationPermission();
      saveSettings();
    });

    document.getElementById('sound-toggle').addEventListener('change', e => {
      state.settings.soundEnabled = e.target.checked;
      saveSettings();
    });

    document.getElementById('clear-cache-btn').addEventListener('click', async () => {
      if (confirm('Очистить весь кэш?')) {
        await dbClear();
        toast('Кэш очищен');
        setTimeout(() => location.reload(), 500);
      }
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
      if (confirm('Выйти из аккаунта?')) {
        await dbClear();
        state.user = null;
        state.chats = [];
        state.messages = {};
        document.getElementById('messenger-screen').classList.remove('active');
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('auth-screen').classList.add('active');
        modal.classList.add('hidden');
      }
    });

    // Profile
    const avatarUpload = document.getElementById('avatar-upload');
    const avatarInput = document.getElementById('avatar-input');
    const avatarPreview = document.getElementById('avatar-preview');

    avatarUpload.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const data = await fileToBase64(file);
      state.user.avatar = data;
      avatarPreview.src = data;
      avatarUpload.classList.add('has-image');
      await dbPut('users', state.user);
    });

    document.getElementById('profile-name').addEventListener('change', async e => {
      state.user.name = e.target.value.trim();
      await dbPut('users', state.user);
    });

    document.getElementById('profile-status').addEventListener('change', async e => {
      state.user.status = e.target.value.trim();
      await dbPut('users', state.user);
    });
  }

  // ==================== CONNECTION STATUS ====================
  function updateConnectionStatus() {
    const el = document.getElementById('connection-status');
    if (state.wsConnected) {
      el.classList.add('hidden');
    } else {
      el.classList.remove('hidden');
    }
  }

  // ==================== SIDEBAR TOGGLE ====================
  function initSidebar() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      sidebar.parentNode.insertBefore(overlay, sidebar.nextSibling);
    }

    function toggleSidebar() {
      sidebar.classList.toggle('open');
    }

    toggle.addEventListener('click', toggleSidebar);

    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && window.innerWidth <= 768) sidebar.classList.remove('open');
    });

    document.getElementById('chat-search').addEventListener('input', e => {
      renderChatList(e.target.value);
    });

    document.getElementById('new-chat-btn').addEventListener('click', () => {
      createNewChat();
    });
  }

  async function createNewChat() {
    const name = prompt('Имя собеседника:');
    if (!name || !name.trim()) return;

    const chatId = generateChatId();
    const contactId = 'u_' + Date.now();
    const contact = {
      id: contactId,
      name: name.trim(),
      avatar: '',
      online: Math.random() > 0.5,
      status: 'В сети'
    };
    await dbPut('users', contact);

    const chat = {
      id: chatId,
      participantId: contactId,
      participantName: contact.name,
      participantAvatar: '',
      participantOnline: contact.online,
      lastMessage: '',
      lastMessageTime: Date.now(),
      unreadCount: 0
    };
    await dbPut('chats', chat);
    state.chats.unshift(chat);
    renderChatList();
    openChat(chatId);
  }

  // ==================== CONTEXT MENU CLOSE ====================
  document.addEventListener('click', () => {
    document.getElementById('context-menu').classList.add('hidden');
  });

  // ==================== KEYBOARD SHORTCUTS ====================
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.getElementById('context-menu').classList.add('hidden');
      document.getElementById('settings-modal').classList.add('hidden');
      document.getElementById('profile-modal').classList.add('hidden');
      document.getElementById('image-viewer').classList.add('hidden');
      cancelReply();
      cancelEdit();
    }
  });

  // ==================== INIT ====================
  async function init() {
    await openDB();
    initRipple();
    initAuth();
    initSidebar();
    initTypingHandler();
    initFileAttachment();
    initVoiceRecording();
    initInfiniteScroll();
    initSettings();

    // Check for existing user
    const users = await dbGetAll('users');
    const systemUser = users.find(u => u.id && u.id.startsWith('user_') && u.password);
    if (systemUser) {
      state.user = systemUser;
      showMessenger();
    }

    // Auto reconnect simulation
    setInterval(() => {
      if (Math.random() < 0.03 && state.wsConnected) {
        ws.simulateDisconnect();
      }
    }, 30000);
  }

  document.addEventListener('DOMContentLoaded', init);

})();
