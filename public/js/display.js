import { db, doc, onSnapshot } from './app.js';

// DOM Elements
const lobbyScreen = document.getElementById('lobby-screen');
const questionScreen = document.getElementById('question-screen');
const resultsScreen = document.getElementById('results-screen');
const errorScreen = document.getElementById('error-screen');

const lobbyGameTitle = document.getElementById('lobby-game-title');
const qrcodeContainer = document.getElementById('qrcode');
const displayQuestionTitle = document.getElementById('display-question-title');
const optionsDisplayGrid = document.querySelector('.options-display-grid');
const timerEl = document.getElementById('timer');
const resultsQuestionTitle = document.getElementById('results-question-title');
const chartCanvas = document.getElementById('results-chart');
const errorMessageText = document.getElementById('error-message-text');

let currentChart = null;
let countdownInterval = null;
let unsubscribeQuestion = null;
let currentGameId = null;

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentGameId = params.get('game');

    if (!currentGameId) return showError("No Game ID provided in URL.");

    const gameRef = doc(db, 'games', currentGameId);
    onSnapshot(gameRef, (gameDoc) => {
        if (!gameDoc.exists()) return showError("This game does not exist.");
        
        const gameData = gameDoc.data();
        lobbyGameTitle.textContent = gameData.title;

        if (gameData.isArchived) {
            return showError("This game has been archived.");
        } 
        
        if (gameData.currentQuestionId) {
            listenToQuestion(currentGameId, gameData.currentQuestionId);
        } else {
            // No active question, show the lobby
            if (unsubscribeQuestion) unsubscribeQuestion();
            showScreen('lobby');
            generateQRCode(currentGameId);
        }
    });
});

function listenToQuestion(gameId, questionId) {
    if (unsubscribeQuestion) unsubscribeQuestion();

    const questionRef = doc(db, 'games', gameId, 'questions', questionId);
    unsubscribeQuestion = onSnapshot(questionRef, (qDoc) => {
        if (!qDoc.exists()) return; // Question may have been deleted

        const questionData = qDoc.data();
        if (questionData.status === 'results_revealed') {
            renderChart(questionData);
            showScreen('results');
        } else {
            renderQuestionView(questionData);
            showScreen('question');
        }
    });
}

function renderQuestionView(data) {
    if (countdownInterval) clearInterval(countdownInterval);

    displayQuestionTitle.textContent = data.questionText;
    optionsDisplayGrid.innerHTML = data.options.map(opt => 
        `<div class="option-display-item" style="background-color:${opt.color}; border: 3px solid ${opt.color};">${opt.text}</div>`
    ).join('');
    startCountdown(data.duration);
}


function renderChart(data) {
    if (countdownInterval) clearInterval(countdownInterval);
    resultsQuestionTitle.textContent = data.questionText;
    
    const labels = data.options.map(opt => opt.text);
    const colors = data.options.map(opt => opt.color);
    const votes = data.options.map(opt => data.voteCounts[opt.id] || 0);

    if (currentChart) currentChart.destroy();
    
    const ctx = chartCanvas.getContext('2d');
    currentChart = new Chart(ctx, {
        type: data.chartType || 'bar',
        data: {
            labels,
            datasets: [{ 
                label: 'Votes', 
                data: votes, 
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
             responsive: true,
             maintainAspectRatio: false,
             plugins: { 
                legend: { 
                    display: data.chartType !== 'bar', // Hide legend for bar charts
                    position: 'top',
                    labels: { color: '#fff', font: { size: 18 } }
                }
            },
             scales: data.chartType === 'bar' ? { 
                y: { beginAtZero: true, ticks: { color: '#fff', font: {size: 16} } }, 
                x: { ticks: { color: '#fff', font: {size: 14}, stepSize: 1 } } 
            } : {}
        }
    });
}

function startCountdown(duration) {
    let timeLeft = duration;
    timerEl.textContent = timeLeft;
    countdownInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft >= 0 ? timeLeft : 0;
        if (timeLeft < 0) clearInterval(countdownInterval);
    }, 1000);
}

function showScreen(screenName) {
    document.querySelectorAll('.display-state').forEach(s => s.classList.add('hidden'));
    document.getElementById(`${screenName}-screen`).classList.remove('hidden');
}

function generateQRCode(gameId) {
    // Only generate if it doesn't exist
    if (qrcodeContainer.innerHTML.includes('img')) return;
    
    const voteUrl = `${window.location.origin}/vote.html?game=${gameId}`;
    qrcodeContainer.innerHTML = '';
    const qr = qrcode(0, 'M');
    qr.addData(voteUrl);
    qr.make();
    qrcodeContainer.innerHTML = qr.createImgTag(6, 8); // (cellSize, margin)
}

function showError(message) {
    errorMessageText.textContent = message;
    showScreen('error');
    if (unsubscribeQuestion) unsubscribeQuestion();
}