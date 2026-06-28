// Application Configuration & State
const state = {
    apiBase: '', // Local endpoints relative to server
    ollamaHost: 'http://localhost:11434',
    activeModel: '',
    embeddingModel: '',
    chatHistory: [],
    isStreaming: false,
    useRag: false,
    progressData: null,
    activeTopic: null,
    systemPrompt: `You are a patient, encouraging, and highly skilled IT Teacher and Tutor. Your student is a non-IT beginner, so you must explain all technical concepts using simple everyday analogies. Do NOT use heavy IT jargon without explaining it in simple terms first. Keep your tone positive, encouraging, and friendly. Keep your explanations brief and step-by-step. At the end of every response explaining a concept, write a short, 1-question quiz (multiple choice or a simple open-ended question) to test the student's understanding. Ask them to type their answer. If they answer correctly in their next turn, congratulate them and tell them they can mark this topic as complete. If they answer incorrectly, guide them gently to the correct answer.`,
    temperature: 0.7
};

// UI Elements
const elements = {
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    refreshStatusBtn: document.getElementById('refresh-status-btn'),
    llmModelSelect: document.getElementById('llm-model-select'),
    embeddingModelSelect: document.getElementById('embedding-model-select'),
    
    // Learning Journey
    overallPercentage: document.getElementById('overall-percentage'),
    overallProgressFill: document.getElementById('overall-progress-fill'),
    roadmapAccordion: document.getElementById('roadmap-accordion'),
    resetProgressBtn: document.getElementById('reset-progress-btn'),
    
    // Document Upload
    uploadZone: document.getElementById('upload-zone'),
    fileInput: document.getElementById('file-input'),
    uploadProgressContainer: document.getElementById('upload-progress-container'),
    uploadProgressFill: document.getElementById('upload-progress-fill'),
    uploadProgressText: document.getElementById('upload-progress-text'),
    docList: document.getElementById('doc-list'),
    clearDocsBtn: document.getElementById('clear-docs-btn'),
    
    // Chat Area
    sessionTitle: document.getElementById('session-title'),
    activeModelTag: document.getElementById('active-model-tag'),
    ragStatusTag: document.getElementById('rag-status-tag'),
    clearChatBtn: document.getElementById('clear-chat-btn'),
    chatMessagesContainer: document.getElementById('chat-messages-container'),
    welcomeScreen: document.getElementById('welcome-screen'),
    chatTextarea: document.getElementById('chat-textarea'),
    sendBtn: document.getElementById('send-btn'),
    ragToggle: document.getElementById('rag-toggle'),
    
    // Collapsible side panels
    docSectionToggle: document.getElementById('doc-section-toggle'),
    docSectionContent: document.getElementById('doc-section-content'),
    engineSectionToggle: document.getElementById('engine-section-toggle'),
    engineSectionContent: document.getElementById('engine-section-content'),
    
    // Settings Modal
    openSettingsBtn: document.getElementById('open-settings-btn'),
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    settingsOllamaHost: document.getElementById('settings-ollama-host'),
    settingsSystemPrompt: document.getElementById('settings-system-prompt'),
    settingsTemperature: document.getElementById('settings-temperature'),
    settingsMaxTokens: document.getElementById('settings-max-tokens'),
    tempVal: document.getElementById('temp-val'),
    saveSettingsBtn: document.getElementById('save-settings-btn')
};

// Module Meta Icons mapping for visual excellence
const moduleIcons = {
    module1: 'fa-terminal',
    module2: 'fa-network-wired',
    module3: 'fa-code-commit',
    module4: 'fa-cubes'
};

// Initialize Application
window.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await checkOllamaStatus();
    await fetchModels();
    await fetchProgress();
    await fetchDocuments();
    
    // Setup Markdown Renderer options
    marked.setOptions({
        highlight: function(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        langPrefix: 'hljs language-'
    });
});

// Setup Events
function setupEventListeners() {
    // Refresh Connection Status
    elements.refreshStatusBtn.addEventListener('click', checkOllamaStatus);
    
    // Model Selectors
    elements.llmModelSelect.addEventListener('change', (e) => {
        state.activeModel = e.target.value;
        updateActiveModelTag();
    });
    elements.embeddingModelSelect.addEventListener('change', (e) => {
        state.embeddingModel = e.target.value;
    });

    // Chat Textarea Auto-sizing and Send
    elements.chatTextarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight - 4) + 'px';
        elements.sendBtn.disabled = this.value.trim() === '' || !state.activeModel || state.isStreaming;
    });
    
    elements.chatTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    
    elements.sendBtn.addEventListener('click', sendChatMessage);
    elements.clearChatBtn.addEventListener('click', clearChatConsole);
    
    // RAG Toggle Checkbox
    elements.ragToggle.addEventListener('change', (e) => {
        state.useRag = e.target.checked;
        elements.ragStatusTag.innerHTML = state.useRag 
            ? `<i class="fa-solid fa-circle-nodes" style="color: var(--color-cyan)"></i> RAG: Active` 
            : `<i class="fa-solid fa-circle-nodes"></i> RAG: Off`;
    });

    // Collapsible Panels (Document upload & engine parameters)
    elements.docSectionToggle.addEventListener('click', () => {
        toggleCollapsibleSection(elements.docSectionToggle.parentElement, elements.docSectionContent);
    });
    elements.engineSectionToggle.addEventListener('click', () => {
        toggleCollapsibleSection(elements.engineSectionToggle.parentElement, elements.engineSectionContent);
    });

    // Welcome Cards Trigger Lesson Prompt
    document.querySelectorAll('.prompt-card').forEach(card => {
        card.addEventListener('click', () => {
            const promptText = card.getAttribute('data-prompt');
            elements.chatTextarea.value = promptText;
            elements.chatTextarea.dispatchEvent(new Event('input'));
            sendChatMessage();
        });
    });

    // Reset Progress Action
    elements.resetProgressBtn.addEventListener('click', resetLearningProgress);

    // Settings Modal
    elements.openSettingsBtn.addEventListener('click', openSettingsModal);
    elements.closeSettingsBtn.addEventListener('click', closeSettingsModal);
    elements.settingsTemperature.addEventListener('input', (e) => {
        elements.tempVal.innerText = e.target.value;
    });
    elements.saveSettingsBtn.addEventListener('click', saveSettings);

    // Document Upload Drag & Drop
    elements.uploadZone.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    elements.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadZone.style.borderColor = 'var(--color-cyan)';
        elements.uploadZone.style.backgroundColor = 'hsla(185, 100%, 50%, 0.04)';
    });
    
    elements.uploadZone.addEventListener('dragleave', () => {
        elements.uploadZone.style.borderColor = 'var(--color-border)';
        elements.uploadZone.style.backgroundColor = 'hsla(230, 20%, 9%, 0.4)';
    });
    
    elements.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadZone.style.borderColor = 'var(--color-border)';
        elements.uploadZone.style.backgroundColor = 'hsla(230, 20%, 9%, 0.4)';
        if (e.dataTransfer.files.length > 0) {
            uploadFile(e.dataTransfer.files[0]);
        }
    });

    elements.clearDocsBtn.addEventListener('click', clearDocumentLibrary);
}

// Check Connection Status of Ollama
async function checkOllamaStatus() {
    elements.statusDot.className = 'status-dot disconnected';
    elements.statusText.innerText = 'Connecting...';
    
    try {
        const response = await fetch(`${state.apiBase}/api/status`);
        const data = await response.json();
        
        if (data.status === 'connected') {
            elements.statusDot.className = 'status-dot connected';
            elements.statusText.innerText = 'Ollama Online';
        } else {
            elements.statusDot.className = 'status-dot disconnected';
            elements.statusText.innerText = 'Ollama Offline';
        }
    } catch (error) {
        elements.statusDot.className = 'status-dot disconnected';
        elements.statusText.innerText = 'Server Error';
        console.error('Failed checking Ollama status:', error);
    }
}

// Fetch Ollama Models
async function fetchModels() {
    try {
        const response = await fetch(`${state.apiBase}/api/models`);
        const data = await response.json();
        
        elements.llmModelSelect.innerHTML = '';
        elements.embeddingModelSelect.innerHTML = '<option value="">None (Keyword Fallback)</option>';
        
        // 1. Populate LLM chat models
        if (data.chat_models && data.chat_models.length > 0) {
            data.chat_models.forEach(model => {
                const opt = document.createElement('option');
                opt.value = model.name;
                opt.innerText = model.name;
                elements.llmModelSelect.appendChild(opt);
            });
            // Try to find a recommended model (qwen or llama) to set as default, otherwise pick the first one
            const defaultModel = data.chat_models.find(m => m.name.includes('qwen') || m.name.includes('llama')) || data.chat_models[0];
            state.activeModel = defaultModel.name;
            elements.llmModelSelect.value = state.activeModel;
            updateActiveModelTag();
        } else {
            const opt = document.createElement('option');
            opt.value = '';
            opt.innerText = 'No chat models found (pull some)';
            elements.llmModelSelect.appendChild(opt);
            state.activeModel = '';
            updateActiveModelTag();
        }
        
        // 2. Populate Embedding models
        if (data.embedding_models && data.embedding_models.length > 0) {
            data.embedding_models.forEach(model => {
                const opt = document.createElement('option');
                opt.value = model.name;
                opt.innerText = model.name;
                elements.embeddingModelSelect.appendChild(opt);
            });
            // Automatically select bge or nomic model if present
            const defaultEmbed = data.embedding_models.find(m => m.name.includes('bge') || m.name.includes('nomic')) || data.embedding_models[0];
            state.embeddingModel = defaultEmbed.name;
            elements.embeddingModelSelect.value = state.embeddingModel;
        }
    } catch (error) {
        console.error('Failed to fetch models:', error);
    }
}

// Fetch Documents Library
async function fetchDocuments() {
    try {
        const response = await fetch(`${state.apiBase}/api/documents`);
        const data = await response.json();
        
        elements.docList.innerHTML = '';
        const docs = data.documents || {};
        const docNames = Object.keys(docs);
        
        if (docNames.length === 0) {
            elements.docList.innerHTML = `<li style="font-size:0.75rem; color:var(--color-text-muted); text-align:center; padding: 10px 0;">No reference docs uploaded</li>`;
            return;
        }
        
        docNames.forEach(name => {
            const doc = docs[name];
            const li = document.createElement('li');
            li.className = 'doc-item';
            li.innerHTML = `
                <div class="doc-info" title="${name}">
                    <i class="fa-regular fa-file-lines"></i>
                    <span class="doc-name">${name}</span>
                </div>
                <button class="doc-delete-btn" onclick="deleteDocument('${name}')">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            `;
            elements.docList.appendChild(li);
        });
    } catch (error) {
        console.error('Failed fetching document library:', error);
    }
}

// Fetch Progress Data
async function fetchProgress() {
    try {
        const response = await fetch(`${state.apiBase}/api/progress`);
        const data = await response.json();
        state.progressData = data;
        renderRoadmap();
    } catch (error) {
        console.error('Failed to fetch progress:', error);
    }
}

// Render Learning Roadmap Accordion
function renderRoadmap() {
    if (!state.progressData) return;
    
    // Update overall metrics
    const progress = state.progressData.overall_progress;
    elements.overallPercentage.innerText = `${progress}%`;
    elements.overallProgressFill.style.width = `${progress}%`;
    
    elements.roadmapAccordion.innerHTML = '';
    
    const modules = state.progressData.modules;
    Object.keys(modules).forEach(modKey => {
        const mod = modules[modKey];
        const icon = moduleIcons[modKey] || 'fa-folder';
        
        // Compute classes
        let modClass = 'roadmap-module';
        if (mod.status === 'Mastered') modClass += ' completed';
        if (mod.status === 'In Progress') modClass += ' learning';
        
        const moduleEl = document.createElement('div');
        moduleEl.className = modClass;
        moduleEl.id = `mod-${modKey}`;
        
        // Topic Elements generator
        let topicsHtml = '';
        Object.keys(mod.topics).forEach(topicKey => {
            const topic = mod.topics[topicKey];
            let topicClass = 'topic-item';
            if (topic.status === 'Mastered') topicClass += ' mastered';
            if (topic.status === 'In Progress') topicClass += ' learning';
            if (state.activeTopic === topicKey) topicClass += ' active';
            
            topicsHtml += `
                <div class="${topicClass}" data-module="${modKey}" data-topic="${topicKey}" onclick="selectTopic('${modKey}', '${topicKey}', '${topic.name}')">
                    <div class="topic-label">
                        <span class="topic-status-marker"></span>
                        <span>${topic.name}</span>
                    </div>
                    <div class="topic-checkbox" onclick="event.stopPropagation(); toggleTopicMastery('${modKey}', '${topicKey}')"></div>
                </div>
            `;
        });

        moduleEl.innerHTML = `
            <div class="module-header" onclick="toggleModuleAccordion('${modKey}')">
                <div class="module-title-group">
                    <i class="fa-solid ${icon} module-icon"></i>
                    <div class="module-info">
                        <span class="module-name">${mod.name}</span>
                        <span class="module-status">${mod.status}</span>
                    </div>
                </div>
                <span class="module-progress-circle">${mod.score}%</span>
            </div>
            <div class="module-topics" id="topics-${modKey}" style="display: none;">
                ${topicsHtml}
            </div>
        `;
        
        elements.roadmapAccordion.appendChild(moduleEl);
    });
}

// Accordion Collapse Toggles
function toggleModuleAccordion(modKey) {
    const topicContainer = document.getElementById(`topics-${modKey}`);
    const moduleEl = document.getElementById(`mod-${modKey}`);
    const isVisible = topicContainer.style.display === 'flex';
    
    // Close other accordion blocks
    document.querySelectorAll('.module-topics').forEach(el => {
        el.style.display = 'none';
    });
    document.querySelectorAll('.roadmap-module').forEach(el => {
        el.classList.remove('active');
    });
    
    if (!isVisible) {
        topicContainer.style.display = 'flex';
        moduleEl.classList.add('active');
    }
}

function toggleCollapsibleSection(parentEl, contentEl) {
    const isOpen = parentEl.classList.contains('open');
    if (isOpen) {
        parentEl.classList.remove('open');
        contentEl.style.display = 'none';
    } else {
        parentEl.classList.add('open');
        contentEl.style.display = 'flex';
    }
}

// Select a Topic to Learn (Automatic Prompts)
async function selectTopic(moduleKey, topicKey, topicName) {
    state.activeTopic = topicKey;
    
    // Highlight active topic visually
    document.querySelectorAll('.topic-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`[data-topic="${topicKey}"]`);
    if (activeEl) activeEl.classList.add('active');
    
    // Start progress
    await updateTopicStatus(moduleKey, topicKey, 'In Progress');
    
    // Clear chat and populate console instruction
    clearChatConsole();
    elements.sessionTitle.innerText = `Learning Journey // ${topicName}`;
    
    const promptText = `Let's start the lesson on "${topicName}". Explain this IT concept to me simply using analogies, and then test my understanding with a single multiple-choice or open-ended question at the end!`;
    elements.chatTextarea.value = promptText;
    elements.chatTextarea.dispatchEvent(new Event('input'));
    
    // Scroll text input and automatically submit
    sendChatMessage();
}

// Toggle manual check off of a topic
async function toggleTopicMastery(moduleKey, topicKey) {
    const topic = state.progressData.modules[moduleKey].topics[topicKey];
    const newStatus = topic.status === 'Mastered' ? 'In Progress' : 'Mastered';
    await updateTopicStatus(moduleKey, topicKey, newStatus);
}

// Save topic status to database
async function updateTopicStatus(moduleKey, topicKey, status) {
    try {
        const response = await fetch(`${state.apiBase}/api/progress/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                module_id: moduleKey,
                topic_id: topicKey,
                status: status
            })
        });
        const data = await response.json();
        state.progressData = data;
        renderRoadmap();
    } catch (error) {
        console.error('Failed updating topic progress:', error);
    }
}

// Reset Learning Progress
async function resetLearningProgress() {
    if (!confirm('Are you sure you want to clear your learning journey history? This resets all topics to Not Started.')) return;
    try {
        const response = await fetch(`${state.apiBase}/api/progress/reset`, { method: 'POST' });
        const data = await response.json();
        state.progressData = data;
        state.activeTopic = null;
        elements.sessionTitle.innerText = 'IT Classroom Console';
        clearChatConsole();
        renderRoadmap();
    } catch (error) {
        console.error('Failed to reset progress:', error);
    }
}

// Active Model UI Update
function updateActiveModelTag() {
    elements.activeModelTag.innerHTML = state.activeModel 
        ? `<i class="fa-solid fa-microchip" style="color: var(--color-cyan);"></i> ${state.activeModel}` 
        : `<i class="fa-solid fa-microchip"></i> No Model`;
    elements.sendBtn.disabled = !state.activeModel || elements.chatTextarea.value.trim() === '';
}

// Settings Modal controls
function openSettingsModal() {
    elements.settingsOllamaHost.value = state.ollamaHost;
    elements.settingsSystemPrompt.value = state.systemPrompt;
    elements.settingsTemperature.value = state.temperature;
    elements.tempVal.innerText = state.temperature;
    elements.settingsModal.style.display = 'flex';
}

function closeSettingsModal() {
    elements.settingsModal.style.display = 'none';
}

function saveSettings() {
    state.ollamaHost = elements.settingsOllamaHost.value;
    state.systemPrompt = elements.settingsSystemPrompt.value;
    state.temperature = parseFloat(elements.settingsTemperature.value);
    
    // Save to local storage for persistence across reloads
    localStorage.setItem('tutor_ollama_host', state.ollamaHost);
    localStorage.setItem('tutor_system_prompt', state.systemPrompt);
    localStorage.setItem('tutor_temperature', state.temperature);
    
    closeSettingsModal();
    checkOllamaStatus();
    fetchModels();
}

// Clear chat screen
function clearChatConsole() {
    elements.chatMessagesContainer.innerHTML = '';
    elements.chatMessagesContainer.appendChild(elements.welcomeScreen);
    elements.welcomeScreen.style.display = 'flex';
    state.chatHistory = [];
}

// Handle Send Chat Action
async function sendChatMessage() {
    const text = elements.chatTextarea.value.trim();
    if (!text || state.isStreaming || !state.activeModel) return;
    
    // Hide welcome panel
    elements.welcomeScreen.style.display = 'none';
    
    // Add user message bubble to layout
    appendMessage('user', text);
    
    // Clear textarea
    elements.chatTextarea.value = '';
    elements.chatTextarea.style.height = 'auto';
    elements.sendBtn.disabled = true;
    
    // Record history
    state.chatHistory.push({ role: 'user', content: text });
    
    // Set streaming state
    state.isStreaming = true;
    
    // Append blank bot bubble
    const assistantBubbleId = appendMessage('assistant', '');
    const assistantBubble = document.getElementById(assistantBubbleId);
    const contentContainer = assistantBubble.querySelector('.msg-content');
    contentContainer.innerHTML = `<span class="tutor-typing"><i class="fa-solid fa-spinner fa-spin"></i> Tutor is writing...</span>`;
    
    scrollChatBottom();
    
    // Stream response from API
    try {
        const response = await fetch(`${state.apiBase}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: state.activeModel,
                messages: state.chatHistory,
                use_rag: state.useRag,
                embedding_model: state.embeddingModel,
                system_prompt: state.systemPrompt,
                temperature: state.temperature
            })
        });
        
        if (!response.body) {
            throw new Error("No readable stream in response");
        }
        
        contentContainer.innerHTML = '';
        let assistantText = '';
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            // Keep the last partial line in buffer
            buffer = lines.pop();
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (!dataStr) continue;
                    
                    try {
                        const chunk = JSON.parse(dataStr);
                        
                        if (chunk.error) {
                            contentContainer.innerHTML = `<div class="error-text"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${chunk.error}</div>`;
                            state.isStreaming = false;
                            return;
                        }
                        
                        // Handle sources data chunk
                        if (chunk.sources) {
                            renderSources(assistantBubble, chunk.sources);
                        }
                        
                        // Handle standard content stream
                        if (chunk.content) {
                            assistantText += chunk.content;
                            contentContainer.innerHTML = marked.parse(assistantText);
                            scrollChatBottom();
                        }
                    } catch (e) {
                        // Incomplete JSON or parsing issue, skip
                    }
                }
            }
        }
        
        // Finalize syntax highlighting & history
        state.chatHistory.push({ role: 'assistant', content: assistantText });
        formatCodeBlocks(contentContainer);
        
    } catch (error) {
        contentContainer.innerHTML = `<div class="error-text"><i class="fa-solid fa-triangle-exclamation"></i> Communication error: ${error.message}</div>`;
        console.error('Streaming error:', error);
    } finally {
        state.isStreaming = false;
        elements.chatTextarea.dispatchEvent(new Event('input'));
    }
}

// Append Bubble UI
function appendMessage(role, text) {
    const id = `msg-${Date.now()}`;
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${role}`;
    bubble.id = id;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const senderName = role === 'user' ? 'YOU' : 'IT TUTOR';
    const icon = role === 'user' ? 'fa-user' : 'fa-graduation-cap';
    
    bubble.innerHTML = `
        <div class="msg-header">
            <i class="fa-solid ${icon}"></i>
            <span>${senderName}</span>
            <span>•</span>
            <span>${timestamp}</span>
        </div>
        <div class="msg-content">
            ${role === 'user' ? escapeHTML(text).replace(/\n/g, '<br>') : text}
        </div>
    `;
    
    elements.chatMessagesContainer.appendChild(bubble);
    scrollChatBottom();
    return id;
}

// Render Sources inside Assistant message
function renderSources(messageBubble, sources) {
    let sourcesContainer = messageBubble.querySelector('.message-sources');
    if (!sourcesContainer) {
        sourcesContainer = document.createElement('div');
        sourcesContainer.className = 'message-sources';
        messageBubble.appendChild(sourcesContainer);
    }
    
    let badgetHtml = '<span>Retrieved Context:</span>';
    sources.forEach(src => {
        badgetHtml += `<span class="source-badge"><i class="fa-regular fa-file-lines"></i> ${src}</span>`;
    });
    
    sourcesContainer.innerHTML = badgetHtml;
}

// Escape HTML utility
function escapeHTML(text) {
    return text.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Scroll chat log to bottom
function scrollChatBottom() {
    elements.chatMessagesContainer.scrollTop = elements.chatMessagesContainer.scrollHeight;
}

// Add Copy Buttons and headers to Pre blocks
function formatCodeBlocks(container) {
    container.querySelectorAll('pre').forEach(pre => {
        // If already formatted, skip
        if (pre.querySelector('.code-header')) return;
        
        const code = pre.querySelector('code');
        // Extract language from hljs class
        let lang = 'plaintext';
        if (code) {
            const match = code.className.match(/language-(\w+)/);
            if (match) lang = match[1];
        }
        
        const header = document.createElement('div');
        header.className = 'code-header';
        header.innerHTML = `
            <span>${lang.toUpperCase()}</span>
            <button onclick="copyCode(this)"><i class="fa-regular fa-copy"></i> Copy Code</button>
        `;
        
        pre.insertBefore(header, pre.firstChild);
    });
    
    // Apply highlight js bindings
    hljs.highlightAll();
}

// Copy Code Clipboard
window.copyCode = function(button) {
    const pre = button.closest('pre');
    const code = pre.querySelector('code');
    if (code) {
        navigator.clipboard.writeText(code.innerText).then(() => {
            button.innerHTML = `<i class="fa-solid fa-check" style="color:var(--color-green);"></i> Copied!`;
            setTimeout(() => {
                button.innerHTML = `<i class="fa-regular fa-copy"></i> Copy Code`;
            }, 2000);
        });
    }
};

// Document Upload Selection Handler
function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        uploadFile(e.target.files[0]);
    }
}

// Upload File API
async function uploadFile(file) {
    elements.uploadProgressContainer.style.display = 'block';
    elements.uploadProgressFill.style.width = '0%';
    elements.uploadProgressText.innerText = `Indexing '${file.name}'...`;
    
    const formData = new FormData();
    formData.append('file', file);
    if (state.embeddingModel) {
        formData.append('embedding_model', state.embeddingModel);
    }
    
    // Simulate upload progress UI since local indexing is fast but processing PDFs takes a brief second
    let simProgress = 0;
    const interval = setInterval(() => {
        if (simProgress < 85) {
            simProgress += Math.floor(Math.random() * 15) + 5;
            elements.uploadProgressFill.style.width = `${Math.min(simProgress, 90)}%`;
        }
    }, 150);

    try {
        const response = await fetch(`${state.apiBase}/api/upload`, {
            method: 'POST',
            body: formData
        });
        
        clearInterval(interval);
        
        if (response.ok) {
            elements.uploadProgressFill.style.width = '100%';
            elements.uploadProgressText.innerText = 'Upload & index completed!';
            setTimeout(() => {
                elements.uploadProgressContainer.style.display = 'none';
            }, 2000);
            await fetchDocuments();
        } else {
            const errData = await response.json();
            throw new Error(errData.detail || 'Upload failed');
        }
    } catch (error) {
        clearInterval(interval);
        elements.uploadProgressContainer.style.display = 'none';
        alert(`Error indexing file: ${error.message}`);
        console.error('File upload error:', error);
    }
}

// Delete Document Library File
window.deleteDocument = async function(filename) {
    if (!confirm(`Delete reference document '${filename}' from database?`)) return;
    try {
        const response = await fetch(`${state.apiBase}/api/delete-document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        
        if (response.ok) {
            await fetchDocuments();
        } else {
            const err = await response.json();
            alert(`Error: ${err.detail}`);
        }
    } catch (error) {
        console.error('Delete document error:', error);
    }
};

// Clear All Documents from Library
async function clearDocumentLibrary() {
    if (!confirm('Are you sure you want to clear all uploaded reference documents from your library?')) return;
    try {
        const response = await fetch(`${state.apiBase}/api/clear-index`, { method: 'POST' });
        if (response.ok) {
            await fetchDocuments();
        }
    } catch (error) {
        console.error('Clear library error:', error);
    }
}
