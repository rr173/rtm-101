const CHORD_TYPES = {
    major: {
        name: '大三和弦',
        intervals: [0, 4, 7],
        symbol: 'maj'
    },
    minor: {
        name: '小三和弦',
        intervals: [0, 3, 7],
        symbol: 'min'
    },
    dominant7: {
        name: '属七和弦',
        intervals: [0, 4, 7, 10],
        symbol: '7'
    },
    minor7: {
        name: '小七和弦',
        intervals: [0, 3, 7, 10],
        symbol: 'm7'
    },
    augmented: {
        name: '增三和弦',
        intervals: [0, 4, 8],
        symbol: 'aug'
    },
    diminished: {
        name: '减三和弦',
        intervals: [0, 3, 6],
        symbol: 'dim'
    }
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const LEVELS = [
    { types: ['major', 'minor'], label: '初级 (大三 / 小三)' },
    { types: ['major', 'minor', 'dominant7', 'minor7'], label: '中级 (加入属七 / 小七)' },
    { types: ['major', 'minor', 'dominant7', 'minor7', 'augmented', 'diminished'], label: '高级 (加入增三 / 减三)' }
];

const TOTAL_QUESTIONS = 10;
const COUNTDOWN_SECONDS = 3;
const CORRECT_SCORE = 10;
const WRONG_SCORE = -5;

let audioCtx = null;
let score = 0;
let questionNumber = 0;
let currentChord = null;
let currentChordNotes = null;
let countdownTimer = null;
let countdownRemaining = 0;
let answerLocked = false;

let typeStats = {};
Object.keys(CHORD_TYPES).forEach(key => {
    typeStats[key] = { correct: 0, total: 0 };
});

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToNoteName(midi) {
    const octave = Math.floor(midi / 12) - 1;
    const noteIdx = midi % 12;
    return NOTE_NAMES[noteIdx] + octave;
}

function getRandomRoot() {
    const minMidi = 48;
    const maxMidi = 71;
    return Math.floor(Math.random() * (maxMidi - minMidi + 1)) + minMidi;
}

function getCurrentLevel() {
    if (questionNumber < 5) return LEVELS[0];
    if (questionNumber < 10) return LEVELS[1];
    return LEVELS[2];
}

function buildChord(rootMidi, chordTypeKey) {
    const chordType = CHORD_TYPES[chordTypeKey];
    return chordType.intervals.map(interval => rootMidi + interval);
}

function playChord(notes) {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const attack = 0.005;
    const decay = 0.05;
    const sustain = 0.4;
    const release = 0.5;
    const sustainDuration = 0.8;
    const peakGain = 0.25;

    notes.forEach((midi, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = midiToFrequency(midi);

        const startTime = now + i * 0.01;
        const peakTime = startTime + attack;
        const decayEndTime = peakTime + decay;
        const sustainEndTime = decayEndTime + sustainDuration;
        const endTime = sustainEndTime + release;

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(peakGain, peakTime);
        gain.gain.linearRampToValueAtTime(peakGain * sustain, decayEndTime);
        gain.gain.setValueAtTime(peakGain * sustain, sustainEndTime);
        gain.gain.linearRampToValueAtTime(0, endTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(endTime + 0.05);
    });
}

function generateNewQuestion() {
    questionNumber++;
    answerLocked = false;

    const level = getCurrentLevel();
    document.getElementById('levelText').textContent = level.label;

    const availableTypes = level.types;
    const chordTypeKey = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    const rootMidi = getRandomRoot();

    currentChord = chordTypeKey;
    currentChordNotes = buildChord(rootMidi, chordTypeKey);

    document.getElementById('questionNumber').textContent = questionNumber;
    document.getElementById('chordDisplay').textContent = '当前和弦：?';
    document.getElementById('feedbackArea').textContent = '';
    document.getElementById('feedbackArea').className = 'feedback-area';
    document.getElementById('replayBtn').disabled = true;

    renderOptions(availableTypes);
    startCountdown();
}

function renderOptions(availableTypes) {
    const grid = document.getElementById('optionsGrid');
    grid.innerHTML = '';

    const shuffled = [...availableTypes].sort(() => Math.random() - 0.5);

    shuffled.forEach(typeKey => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = CHORD_TYPES[typeKey].name;
        btn.dataset.type = typeKey;
        btn.addEventListener('click', () => handleAnswer(typeKey, btn));
        grid.appendChild(btn);
    });
}

function startCountdown() {
    countdownRemaining = COUNTDOWN_SECONDS;
    updateCountdownDisplay();
    updateProgressBar();

    if (countdownTimer) clearInterval(countdownTimer);

    countdownTimer = setInterval(() => {
        countdownRemaining -= 0.1;
        if (countdownRemaining <= 0) {
            countdownRemaining = 0;
            clearInterval(countdownTimer);
            countdownTimer = null;
            handleTimeout();
        }
        updateCountdownDisplay();
        updateProgressBar();
    }, 100);
}

function updateCountdownDisplay() {
    document.getElementById('countdownValue').textContent = countdownRemaining.toFixed(1);
}

function updateProgressBar() {
    const pct = (1 - countdownRemaining / COUNTDOWN_SECONDS) * 100;
    document.getElementById('progressFill').style.width = pct + '%';
}

function stopCountdown() {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
}

function lockOptions() {
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
    });
}

function handleAnswer(typeKey, btn) {
    if (answerLocked) return;

    answerLocked = true;
    stopCountdown();
    lockOptions();

    const isCorrect = typeKey === currentChord;
    typeStats[currentChord].total++;

    if (isCorrect) {
        score += CORRECT_SCORE;
        typeStats[currentChord].correct++;
        btn.classList.add('correct');
        showFeedback('✅ 回答正确！+' + CORRECT_SCORE + ' 分', 'correct');
    } else {
        score += WRONG_SCORE;
        btn.classList.add('wrong');
        const correctBtn = document.querySelector(`.option-btn[data-type="${currentChord}"]`);
        if (correctBtn) correctBtn.classList.add('correct');
        showFeedback('❌ 回答错误！正确答案：' + CHORD_TYPES[currentChord].name + ' (' + WRONG_SCORE + ' 分)', 'wrong');
    }

    document.getElementById('scoreValue').textContent = score;
    revealChordName();

    setTimeout(() => {
        if (questionNumber >= TOTAL_QUESTIONS) {
            showResults();
        } else {
            generateNewQuestion();
        }
    }, 1800);
}

function handleTimeout() {
    if (answerLocked) return;

    answerLocked = true;
    lockOptions();
    typeStats[currentChord].total++;

    score += WRONG_SCORE;

    const correctBtn = document.querySelector(`.option-btn[data-type="${currentChord}"]`);
    if (correctBtn) correctBtn.classList.add('correct');

    showFeedback('⏰ 时间到！正确答案：' + CHORD_TYPES[currentChord].name + ' (' + WRONG_SCORE + ' 分)', 'wrong');
    document.getElementById('scoreValue').textContent = score;
    revealChordName();

    setTimeout(() => {
        if (questionNumber >= TOTAL_QUESTIONS) {
            showResults();
        } else {
            generateNewQuestion();
        }
    }, 1800);
}

function revealChordName() {
    const rootMidi = currentChordNotes[0];
    const rootName = midiToNoteName(rootMidi);
    const chordSymbol = CHORD_TYPES[currentChord].symbol;
    document.getElementById('chordDisplay').textContent = '当前和弦：' + rootName + ' ' + chordSymbol + ' (' + CHORD_TYPES[currentChord].name + ')';
}

function showFeedback(msg, type) {
    const area = document.getElementById('feedbackArea');
    area.textContent = msg;
    area.className = 'feedback-area feedback-' + type;
}

function showResults() {
    document.getElementById('finalScore').textContent = score;

    let totalCorrect = 0;
    let totalAnswered = 0;
    Object.keys(typeStats).forEach(key => {
        totalCorrect += typeStats[key].correct;
        totalAnswered += typeStats[key].total;
    });

    const totalAcc = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    document.getElementById('totalAccuracy').textContent = totalAcc + '%';

    const statsContainer = document.getElementById('typeStats');
    statsContainer.innerHTML = '';

    Object.keys(CHORD_TYPES).forEach(key => {
        const stat = typeStats[key];
        if (stat.total > 0) {
            const acc = Math.round((stat.correct / stat.total) * 100);
            const item = document.createElement('div');
            item.className = 'type-stat-item';
            item.innerHTML = `
                <div>
                    <span class="type-stat-name">${CHORD_TYPES[key].name}</span>
                    <div class="type-stat-detail">${stat.correct} / ${stat.total}</div>
                </div>
                <span class="type-stat-accuracy">${acc}%</span>
            `;
            statsContainer.appendChild(item);
        }
    });

    document.getElementById('resultsModal').style.display = 'flex';
}

function resetGame() {
    score = 0;
    questionNumber = 0;
    currentChord = null;
    currentChordNotes = null;
    answerLocked = false;

    Object.keys(CHORD_TYPES).forEach(key => {
        typeStats[key] = { correct: 0, total: 0 };
    });

    document.getElementById('scoreValue').textContent = '0';
    document.getElementById('resultsModal').style.display = 'none';
    document.getElementById('playBtn').disabled = false;
    document.getElementById('playBtn').textContent = '🔊 播放和弦';
    document.getElementById('replayBtn').disabled = true;
    document.getElementById('chordDisplay').textContent = '当前和弦：?';
    document.getElementById('feedbackArea').textContent = '';
    document.getElementById('optionsGrid').innerHTML = '';
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('countdownValue').textContent = '3.0';
}

document.getElementById('playBtn').addEventListener('click', () => {
    if (!currentChordNotes) {
        generateNewQuestion();
        playChord(currentChordNotes);
        document.getElementById('playBtn').textContent = '🔊 下一题';
    } else {
        playChord(currentChordNotes);
    }
    document.getElementById('replayBtn').disabled = false;
});

document.getElementById('replayBtn').addEventListener('click', () => {
    if (currentChordNotes) {
        playChord(currentChordNotes);
    }
});

document.getElementById('restartBtn').addEventListener('click', () => {
    resetGame();
});
