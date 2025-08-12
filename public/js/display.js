import { db, doc, onSnapshot } from './app.js';

// DOM Elements
const lobbyScreen = document.getElementById('lobby-screen');
const questionScreen = document.getElementById('question-screen');
const resultsScreen = document.getElementById('results-screen');
const errorScreen = document.getElementById('error-screen');
const lobbyPollTitle = document.getElementById('lobby-poll-title');
const qrcodeContainer = document.getElementById('qrcode');
const displayQuestionTitle = document.getElementById('display-question-title');
const optionsDisplayGrid = document.querySelector('.options-display-grid');
const timerEl = document.getElementById('timer');
const resultsQuestionTitle = document.getElementById('results-question-title');
const chartCanvas = document.getElementById('results-chart');
const errorMessageText = document.getElementById('error-message-text');

// State
let currentChart = null;
let countdownInterval = null;
let unsubscribePoll = null;
let unsubscribeQuestion = null;
let currentUserId = null;
let currentPollId = null;

// Register the datalabels plugin
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentUserId = params.get('user');
    currentPollId = params.get('poll');

    if (!currentPollId || !currentUserId) {
        return showError("Invalid URL. Poll or User information is missing.");
    }

    const pollRef = doc(db, 'users', currentUserId, 'polls', currentPollId);
    unsubscribePoll = onSnapshot(pollRef, (pollDoc) => {
        if (!pollDoc.exists()) return showError("This poll does not exist or has been deleted.");
        
        const pollData = pollDoc.data();
        if (lobbyPollTitle) lobbyPollTitle.textContent = pollData.title;
        
        if (pollData.currentQuestionId) {
            listenToQuestion(currentUserId, currentPollId, pollData.currentQuestionId);
        } else {
            if (unsubscribeQuestion) unsubscribeQuestion();
            showScreen('lobby');
            if (qrcodeContainer) generateQRCode(currentUserId, currentPollId);
        }
    }, (error) => {
        showError("Could not connect to the poll service.");
    });
});

function listenToQuestion(userId, pollId, questionId) {
    if (unsubscribeQuestion) unsubscribeQuestion();

    const questionRef = doc(db, 'users', userId, 'polls', pollId, 'questions', questionId);
    unsubscribeQuestion = onSnapshot(questionRef, (qDoc) => {
        if (!qDoc.exists()) return showError("The current question could not be found.");

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
    if (displayQuestionTitle) displayQuestionTitle.textContent = data.questionText;
    
    // Ensure manual legend is hidden on this screen
    const legend = document.getElementById('display-legend');
    if (legend) legend.style.display = 'none';

    // Reuse the display grid for showing options before voting
    optionsDisplayGrid.style.display = 'grid';
    optionsDisplayGrid.innerHTML = data.options.map(opt => 
        `<div class="option-display-item" style="background-color:${opt.color}; border-color: ${opt.color};">${opt.text}</div>`
    ).join('');
    
    startCountdown(data.duration);
}

// *** FINALIZED FUNCTION ***
function renderChart(data) {
    if (countdownInterval) clearInterval(countdownInterval);
    if (resultsQuestionTitle) resultsQuestionTitle.textContent = data.questionText;
    
    const labels = data.options.map(opt => opt.text);
    const colors = data.options.map(opt => opt.color);
    const votes = data.options.map(opt => data.voteCounts[opt.id] || 0);
    const totalVotes = votes.reduce((sum, count) => sum + count, 0);

    // Hide the grid used for pre-vote options
    optionsDisplayGrid.style.display = 'none';

    // --- Generate and inject the HTML legend ---
    let legend = document.getElementById('display-legend');
    if(!legend) {
        legend = document.createElement('div');
        legend.id = 'display-legend';
        // Insert it right after the chart container
        resultsScreen.querySelector('.chart-container').after(legend);
    }
    
    legend.style.display = 'flex';
    legend.innerHTML = data.options.map(opt => `
        <div class="display-legend-item">
            <div class="display-legend-color" style="background-color: ${opt.color};"></div>
            <span class="display-legend-text">${opt.text}</span>
        </div>
    `).join('');

    // --- Render the Chart ---
    if (currentChart) currentChart.destroy();
    
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) return;
    const isPieType = data.chartType === 'pie' || data.chartType === 'doughnut';

    currentChart = new Chart(ctx, {
        type: data.chartType || 'bar',
        data: {
            labels, // Still needed for tooltips and chart structure
            datasets: [{ 
                data: votes, 
                backgroundColor: colors,
                borderColor: '#0c0a15',
                borderWidth: isPieType ? 4 : 1,
            }]
        },
        options: {
             responsive: true,
             maintainAspectRatio: false,
             indexAxis: data.chartType === 'bar' ? 'y' : 'x',
             plugins: { 
                legend: { display: false }, // Disable default legend
                datalabels: {
                    display: true,
                    color: '#fff',
                    // This is the fix: move the labels to the center
                    anchor: 'center',
                    align: 'center',
                    font: {
                        size: 24,
                        weight: 'bold',
                    },
                    textStrokeColor: 'rgba(0,0,0,0.6)',
                    textStrokeWidth: 2,
                    formatter: (value) => {
                        if (value === 0) return null;
                        if (data.resultsDisplay === 'number') return value;
                        if (totalVotes === 0) return '0%';
                        const percentage = (value / totalVotes * 100).toFixed(0);
                        return `${percentage}%`;
                    }
                }
            },
            // Hide axis labels since we have our custom HTML legend
            scales: isPieType ? {} : { 
                y: { ticks: { display: false }, grid: { drawBorder: false, color: 'rgba(255,255,255,0.1)' } }, 
                x: { ticks: { display: false }, grid: { display: false } } 
            }
        }
    });
}


function startCountdown(duration) {
    let timeLeft = duration;
    if (timerEl) timerEl.textContent = timeLeft;
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        timeLeft--;
        if (timerEl) timerEl.textContent = timeLeft >= 0 ? timeLeft : 0;
        if (timeLeft < 0) clearInterval(countdownInterval);
    }, 1000);
}

function showScreen(screenName) {
    document.querySelectorAll('.display-state').forEach(s => s.classList.add('hidden'));
    document.getElementById(`${screenName}-screen`).classList.remove('hidden');
}

function generateQRCode(userId, pollId) {
    if (!qrcodeContainer) return;
    const voteUrl = `${window.location.origin}/vote.html?user=${userId}&poll=${pollId}`;
    
    qrcodeContainer.innerHTML = "";
    new QRCode(qrcodeContainer, {
        text: voteUrl,
        width: 256,
        height: 256,
        correctLevel: QRCode.CorrectLevel.H
    });
}

function showError(message) {
    if (errorMessageText) errorMessageText.textContent = message;
    showScreen('error');
    if (unsubscribePoll) unsubscribePoll();
    if (unsubscribeQuestion) unsubscribeQuestion();
}