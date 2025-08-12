let previewScaler = null;

// --- MODAL & UI HELPERS ---
export function openModal(modalElement) {
    document.getElementById('modal-backdrop').classList.remove('hidden');
    modalElement.classList.remove('hidden');
}

export function closeModal() {
    document.getElementById('modal-backdrop').classList.add('hidden');
    document.getElementById('create-poll-modal').classList.add('hidden');
    document.getElementById('question-editor-modal').classList.add('hidden');
    document.getElementById('question-editor-form').innerHTML = '';
    document.getElementById('create-poll-form').reset();
}

export function showInitialState() {
    document.getElementById('initial-state').classList.remove('hidden');
    document.getElementById('poll-dashboard').classList.add('hidden');
    document.getElementById('header-info').classList.add('hidden');
    document.querySelectorAll('#polls-list .list-item').forEach(el => el.classList.remove('selected'));
    document.getElementById('sidebar').classList.remove('open');
}

export function switchTab(tabName) {
    document.querySelectorAll('.tab-button').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-content-${tabName}`);
    });
}

export function updatePollSelectionUI(pollId) {
    document.querySelectorAll('#polls-list .list-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.id === pollId);
    });
    document.getElementById('initial-state').classList.add('hidden');
    document.getElementById('poll-dashboard').classList.remove('hidden');
    document.getElementById('header-info').classList.remove('hidden');
    switchTab('live');
    document.getElementById('sidebar').classList.remove('open');
}

export function updatePollHeader(title) {
    document.getElementById('main-poll-title').textContent = title;
}

export function setDisplayLinks(userId, pollId) {
    const displayUrl = `/display.html?user=${userId}&poll=${pollId}`;
    document.getElementById('open-display-btn').href = displayUrl;
    document.getElementById('live-preview-iframe').src = displayUrl;
}

export function initPreviewScaler() {
    if (previewScaler) previewScaler.disconnect();
    const iframe = document.getElementById('live-preview-iframe');
    const previewWrapper = document.querySelector('.preview-wrapper');
    if (!iframe || !previewWrapper) return;
    
    const iframeWidth = 1280;
    const updateScale = () => {
        const containerWidth = previewWrapper.offsetWidth;
        if (containerWidth > 0) {
            const scale = containerWidth / iframeWidth;
            iframe.style.transform = `scale(${scale})`;
        }
    };
    previewScaler = new ResizeObserver(updateScale);
    previewScaler.observe(previewWrapper);
    updateScale();
}

export function disconnectPreviewScaler() {
    if (previewScaler) previewScaler.disconnect();
    previewScaler = null;
}