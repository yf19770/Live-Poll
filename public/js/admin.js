import { initAuth, logout } from './admin/auth.js';
import * as ui from './admin/ui.js';
import * as store from './admin/firestore.js';

// --- STATE & CONFIG ---
let state = {
    currentUserId: null,
    selectedPollId: null,
    currentPollData: null,
    questions: [],
    unsubscribePolls: null,
    unsubscribePoll: null,
    unsubscribeQuestions: null,
    activeCharts: {}
};

const PRESET_COLORS = ['#EF4444', '#F97316', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FBBF24'];

// --- INITIALIZATION ---
function onLogin(uid) {
    state.currentUserId = uid;
    initDashboard();
    state.unsubscribePolls = store.listenForPolls(uid, renderPollsList);
}

function onLogout() {
    state.currentUserId = null;
    if (state.unsubscribePolls) state.unsubscribePolls();
    if (state.unsubscribePoll) state.unsubscribePoll();
    if (state.unsubscribeQuestions) state.unsubscribeQuestions();
    Object.values(state.activeCharts).forEach(chart => chart.destroy());
    ui.showInitialState();
    ui.disconnectPreviewScaler();
}

function initDashboard() {
    document.getElementById('logout-button').addEventListener('click', logout);
    document.getElementById('open-create-poll-modal-btn').addEventListener('click', () => ui.openModal(document.getElementById('create-poll-modal')));
    document.getElementById('modal-backdrop').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-backdrop') || e.target.closest('[data-close-modal]')) ui.closeModal();
    });
    document.getElementById('add-question-btn').addEventListener('click', () => openQuestionEditor(null));
    document.getElementById('create-poll-form').addEventListener('submit', handleCreatePoll);
    document.getElementById('delete-poll-button').addEventListener('click', handleDeletePoll);
    document.getElementById('reset-poll-button').addEventListener('click', handleResetPoll);
    document.querySelectorAll('.tab-button').forEach(tab => tab.addEventListener('click', (e) => ui.switchTab(e.target.dataset.tab)));
    document.getElementById('mobile-menu-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('sidebar').classList.toggle('open');
    });
    document.body.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !e.target.closest('.mobile-menu-btn')) {
            sidebar.classList.remove('open');
        }
    });
    document.getElementById('download-qr-btn').addEventListener('click', handleDownloadQR);
    document.getElementById('copy-join-link-btn').addEventListener('click', handleCopyLink);
}

// --- RENDER FUNCTIONS ---
function renderPollsList(polls) {
    const pollsListEl = document.getElementById('polls-list');
    if (!pollsListEl) return;
    pollsListEl.innerHTML = '';
    if (polls.length === 0) {
        pollsListEl.innerHTML = '<p class="no-items-msg">Create your first poll!</p>';
        return;
    }
    polls.forEach(poll => {
        const pollEl = document.createElement('div');
        pollEl.className = 'list-item';
        pollEl.innerHTML = `<span><i class="fa-solid fa-square-poll-vertical fa-fw"></i> ${poll.title}</span>`;
        pollEl.dataset.id = poll.id;
        if (poll.id === state.selectedPollId) pollEl.classList.add('selected');
        pollEl.addEventListener('click', () => selectPoll(poll.id));
        pollsListEl.appendChild(pollEl);
    });
}

function renderQuestionsList() {
    const container = document.getElementById('questions-list-container');
    container.innerHTML = '';
    if (state.questions.length === 0) {
        container.innerHTML = '<p class="no-items-msg">No questions yet. Add one to get started!</p>';
        return;
    }
    state.questions.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.innerHTML = `
            <span class="q-card-index">${index + 1}.</span>
            <span class="q-card-text">${q.questionText}</span>
            <div class="q-actions">
                <button class="edit-btn" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="delete-btn" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
            </div>`;
        card.querySelector('.edit-btn').addEventListener('click', () => openQuestionEditor(q));
        card.querySelector('.delete-btn').addEventListener('click', () => handleDeleteQuestion(q.id));
        container.appendChild(card);
    });
}

function renderLiveControls() {
    const container = document.getElementById('live-questions-list');
    if (!state.selectedPollId || !state.currentPollData || !container) return;
    container.innerHTML = '';
    
    document.getElementById('show-lobby-btn').onclick = () => store.showLobby(state.currentUserId, state.selectedPollId);

    state.questions.forEach(q => {
        const isCurrent = state.currentPollData.currentQuestionId === q.id;
        const isRevealed = q.status === 'results_revealed';
        let statusText = 'Ready';
        if (isCurrent && isRevealed) statusText = 'Results Shown';
        else if (isCurrent) statusText = 'Live';
        const qEl = document.createElement('div');
        qEl.className = `live-question-item ${isCurrent ? 'active' : ''}`;
        qEl.innerHTML = `
            <div class="live-q-status ${statusText.toLowerCase().replace(' ','-')}">${statusText}</div>
            <span class="live-q-text">${q.questionText}</span>
            <div class="live-q-buttons">
                <button class="button-small push-btn" data-q-id="${q.id}" ${isCurrent && !isRevealed ? 'disabled' : ''}>Push</button>
                <button class="button-small reveal-btn" data-q-id="${q.id}" ${!isCurrent || isRevealed ? 'disabled' : ''}>Reveal</button>
            </div>`;
        qEl.querySelector('.push-btn').addEventListener('click', (e) => store.pushQuestion(state.currentUserId, state.selectedPollId, e.target.dataset.qId));
        qEl.querySelector('.reveal-btn').addEventListener('click', (e) => store.revealResults(state.currentUserId, state.selectedPollId, e.target.dataset.qId));
        container.appendChild(qEl);
    });
}

// *** FIXED FUNCTION ***
function renderAnalyticsTab() {
    Object.values(state.activeCharts).forEach(chart => chart.destroy());
    state.activeCharts = {};

    const analyticsContainer = document.getElementById('analytics-container');
    if (!analyticsContainer) return;
    
    const questionsWithVotes = state.questions.filter(q => 
        q.voteCounts && Object.values(q.voteCounts).some(count => count > 0)
    );

    if (questionsWithVotes.length === 0) {
        analyticsContainer.innerHTML = '<div class="placeholder-text-lg" style="text-align: center;"><h2>No Results Yet</h2><p>Push a question live and collect some votes to see the analytics.</p></div>';
        return;
    }

    analyticsContainer.innerHTML = ''; 

    questionsWithVotes.forEach(q => {
        const totalVotes = Object.values(q.voteCounts || {}).reduce((sum, count) => sum + count, 0);

        const optionsHtml = q.options.map(opt => {
            const votes = q.voteCounts[opt.id] || 0;
            const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(0) : 0;
            return `
                <div class="analytics-option-row">
                    <div class="color-legend" style="background-color: ${opt.color};"></div>
                    <div class="option-text">${opt.text}</div>
                    <div class="option-percent">${percentage}%</div>
                    <div class="option-votes">(${votes} votes)</div>
                </div>
            `;
        }).join('');

        const card = document.createElement('div');
        card.className = 'analytics-card';
        card.innerHTML = `
            <div class="analytics-card-header">
                <h4>${q.questionText}</h4>
                <div class="analytics-stats">
                    <strong>${totalVotes}</strong>
                    Total Votes
                </div>
            </div>
            <div class="analytics-card-body">
                <div class="analytics-option-list">
                    ${optionsHtml}
                </div>
                <div class="analytics-chart-container">
                    <canvas id="chart-${q.id}"></canvas>
                </div>
            </div>
        `;

        analyticsContainer.appendChild(card);

        const ctx = document.getElementById(`chart-${q.id}`).getContext('2d');
        if (ctx) {
            const isPieType = q.chartType === 'pie' || q.chartType === 'doughnut';
            
            state.activeCharts[q.id] = new Chart(ctx, {
                type: q.chartType || 'bar',
                data: {
                    labels: q.options.map(opt => opt.text),
                    datasets: [{
                        data: q.options.map(opt => q.voteCounts[opt.id] || 0),
                        backgroundColor: q.options.map(opt => opt.color),
                        borderWidth: isPieType ? 2 : 0,
                        borderColor: isPieType ? 'var(--dark-bg)' : undefined
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: !isPieType ? 'y' : 'x',
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false },
                        datalabels: { display: false }
                    },
                    scales: !isPieType ? {
                        y: { display: false, grid: { display: false } },
                        x: { display: false, grid: { display: false } }
                    } : {}
                }
            });
        }
    });
}


// --- EVENT HANDLERS & ACTIONS ---
function selectPoll(id) {
    if (state.selectedPollId === id) return;
    state.selectedPollId = id;
    ui.updatePollSelectionUI(id);
    if (state.unsubscribePoll) state.unsubscribePoll();
    if (state.unsubscribeQuestions) state.unsubscribeQuestions();
    state.unsubscribePoll = store.listenForSinglePoll(state.currentUserId, id, doc => {
        if (!doc.exists()) { ui.showInitialState(); return; }
        state.currentPollData = doc.data();
        ui.updatePollHeader(state.currentPollData.title);
        renderLiveControls();
    });
    state.unsubscribeQuestions = store.listenForQuestions(state.currentUserId, id, questions => {
        state.questions = questions;
        renderQuestionsList();
        renderAnalyticsTab();
        renderLiveControls();
    });
    ui.setDisplayLinks(state.currentUserId, id);
    ui.initPreviewScaler();
}

async function handleCreatePoll(e) {
    e.preventDefault();
    const title = e.target['poll-title-input'].value.trim();
    if (title) {
        await store.createPoll(state.currentUserId, title);
        ui.closeModal();
    }
}

async function handleDeletePoll() {
    if (!state.selectedPollId || !state.currentUserId) return;
    if (confirm("DANGER: Are you sure you want to permanently delete this poll and all its questions?")) {
        await store.deletePoll(state.currentUserId, state.selectedPollId);
        ui.showInitialState();
    }
}

async function handleResetPoll() {
    if (!state.selectedPollId || !state.currentUserId) return;
    if (confirm("Are you sure you want to reset all votes for ALL questions in this poll?")) {
        await store.resetPoll(state.currentUserId, state.selectedPollId, state.questions);
        alert("Poll votes have been reset.");
        ui.switchTab('live');
    }
}

function openQuestionEditor(questionData) {
    state.currentQuestionIdToEdit = questionData ? questionData.id : null;
    document.getElementById('question-editor-title').textContent = questionData ? 'Edit Question' : 'Create Question';
    const form = document.getElementById('question-editor-form');
    form.innerHTML = createEditorFormHTML(questionData);
    form.addEventListener('submit', handleSaveQuestion);
    form.querySelector('.add-option-btn').addEventListener('click', () => addOptionInput(form));
    form.querySelectorAll('.color-picker-wrapper').forEach(wrapper => {
        wrapper.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-swatch')) {
                const group = e.target.closest('.color-picker-wrapper');
                group.querySelector('.color-swatch.selected')?.classList.remove('selected');
                e.target.classList.add('selected');
                group.querySelector('input[type="color"]').value = e.target.dataset.color;
            }
        });
    });
    ui.openModal(document.getElementById('question-editor-modal'));
}

function createEditorFormHTML(data) {
    const qText = data ? data.questionText : '';
    const duration = data ? data.duration : 30;
    const chartType = data ? data.chartType : 'bar';
    const resultsDisplay = data ? data.resultsDisplay : 'percentage';
    const options = data ? data.options : [{text:'', color: PRESET_COLORS[0]}, {text:'', color: PRESET_COLORS[1]}];
    let optionsHtml = options.map(opt => `
        <div class="option-input-group">
            <input type="text" value="${opt.text}" placeholder="Option Text" class="option-text" required>
            <div class="color-picker-wrapper">
                ${PRESET_COLORS.map(color => `<div class="color-swatch ${color === opt.color ? 'selected' : ''}" style="background-color: ${color};" data-color="${color}"></div>`).join('')}
                <input type="color" value="${opt.color}" class="option-color">
            </div>
        </div>
    `).join('');
    return `
        <label>Question</label>
        <input type="text" name="questionText" value="${qText}" required placeholder="e.g., What's our next priority?">
        <label>Options (Max 4)</label>
        <div class="options-container">${optionsHtml}</div>
        <button type="button" class="button button-secondary add-option-btn" style="margin-top: 5px; width: auto;"><i class="fa-solid fa-plus"></i> Add Option</button>
        <div class="form-grid-3" style="margin-top: 25px;">
            <div><label>Time (s)</label><input type="number" name="duration" value="${duration}" required></div>
            <div><label>Chart Type</label><select name="chartType"><option value="bar" ${chartType === 'bar' ? 'selected' : ''}>Bar</option><option value="pie" ${chartType === 'pie' ? 'selected' : ''}>Pie</option><option value="doughnut" ${chartType === 'doughnut' ? 'selected' : ''}>Doughnut</option></select></div>
            <div><label>Results Display</label><select name="resultsDisplay"><option value="percentage" ${resultsDisplay === 'percentage' ? 'selected' : ''}>Percentage</option><option value="number" ${resultsDisplay === 'number' ? 'selected' : ''}>Number</option></select></div>
        </div>
        <div class="modal-footer">
            <button type="button" class="button-secondary" data-close-modal>Cancel</button>
            <button type="submit" class="button button-accent">Save Question</button>
        </div>
    `;
}

function addOptionInput(form) {
    const container = form.querySelector('.options-container');
    if (container.children.length >= 4) { alert("A maximum of 4 options are allowed."); return; }
    const newColor = PRESET_COLORS[container.children.length % PRESET_COLORS.length];
    const div = document.createElement('div');
    div.className = 'option-input-group';
    div.innerHTML = `
        <input type="text" value="" placeholder="Option Text" class="option-text" required>
        <div class="color-picker-wrapper">
            ${PRESET_COLORS.map(color => `<div class="color-swatch ${color === newColor ? 'selected' : ''}" style="background-color: ${color};" data-color="${color}"></div>`).join('')}
            <input type="color" value="${newColor}" class="option-color">
        </div>
    `;
    div.querySelector('.color-picker-wrapper').addEventListener('click', (e) => {
        if (e.target.classList.contains('color-swatch')) {
            const group = e.target.closest('.color-picker-wrapper');
            group.querySelector('.color-swatch.selected')?.classList.remove('selected');
            e.target.classList.add('selected');
            group.querySelector('input[type="color"]').value = e.target.dataset.color;
        }
    });
    container.appendChild(div);
}

async function handleSaveQuestion(e) {
    e.preventDefault();
    const form = e.target;
    const options = Array.from(form.querySelectorAll('.option-input-group')).map((group, index) => ({
        id: `opt${index + 1}`, text: group.querySelector('.option-text').value.trim(),
        color: group.querySelector('.option-color').value
    })).filter(opt => opt.text);
    if (options.length < 2) { alert("Please define at least 2 options."); return; }
    const questionData = { 
        questionText: form.questionText.value.trim(), options, 
        duration: parseInt(form.duration.value) || 30, 
        chartType: form.chartType.value,
        resultsDisplay: form.resultsDisplay.value
    };
    await store.saveQuestion(state.currentUserId, state.selectedPollId, state.currentQuestionIdToEdit, questionData);
    ui.closeModal();
}

async function handleDeleteQuestion(questionId) {
    if (confirm("Are you sure you want to delete this question?")) {
        await store.deleteQuestion(state.currentUserId, state.selectedPollId, questionId);
    }
}

function handleDownloadQR() {
    if (!state.currentUserId || !state.selectedPollId) {
        alert("Please select a poll first.");
        return;
    }

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '-9999px'; // Move it off-screen
    document.body.appendChild(tempContainer);

    const voteUrl = `${window.location.origin}/vote.html?user=${state.currentUserId}&poll=${state.selectedPollId}`;
    new QRCode(tempContainer, {
        text: voteUrl,
        width: 256,
        height: 256,
        correctLevel: QRCode.CorrectLevel.H
    });

    setTimeout(() => {
        const canvas = tempContainer.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `intera-poll-qr-${state.selectedPollId}.png`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert("Could not generate QR code. Please try again.");
        }
        document.body.removeChild(tempContainer);
    }, 100); // 100ms delay is usually sufficient
}

function handleCopyLink() {
    if (!state.currentUserId || !state.selectedPollId) return;
    const voteUrl = `${window.location.origin}/vote.html?user=${state.currentUserId}&poll=${state.selectedPollId}`;
    navigator.clipboard.writeText(voteUrl).then(() => {
        const btn = document.getElementById('copy-join-link-btn');
        btn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
        setTimeout(() => { btn.innerHTML = `<i class="fa-solid fa-link"></i> Copy Link`; }, 2000);
    }).catch(err => {
        alert("Failed to copy link.");
        console.error('Copy failed', err);
    });
}

// --- Start the app ---
initAuth(onLogin, onLogout);