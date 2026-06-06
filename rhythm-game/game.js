(function () {
    'use strict';

    const CHART = [
        { time: 2000, lane: 0 },
        { time: 2500, lane: 1 },
        { time: 3000, lane: 2 },
        { time: 3500, lane: 3 },
        { time: 4000, lane: 0 },
        { time: 4500, lane: 1 },
        { time: 5000, lane: 2 },
        { time: 5500, lane: 3 },

        { time: 6000, lane: 0 },
        { time: 6000, lane: 2 },
        { time: 6500, lane: 1 },
        { time: 6500, lane: 3 },
        { time: 7000, lane: 0 },
        { time: 7500, lane: 1 },
        { time: 8000, lane: 2 },
        { time: 8500, lane: 3 },
        { time: 9000, lane: 0 },
        { time: 9000, lane: 3 },
        { time: 9500, lane: 1 },
        { time: 9500, lane: 2 },

        { time: 10000, lane: 0 },
        { time: 10250, lane: 1 },
        { time: 10500, lane: 2 },
        { time: 10750, lane: 3 },
        { time: 11000, lane: 0 },
        { time: 11250, lane: 1 },
        { time: 11500, lane: 2 },
        { time: 11750, lane: 3 },
        { time: 12000, lane: 0 },
        { time: 12000, lane: 1 },
        { time: 12500, lane: 2 },
        { time: 12500, lane: 3 },
        { time: 13000, lane: 0 },
        { time: 13000, lane: 3 },
        { time: 13500, lane: 1 },
        { time: 13500, lane: 2 },

        { time: 14000, lane: 0 },
        { time: 14250, lane: 2 },
        { time: 14500, lane: 1 },
        { time: 14750, lane: 3 },
        { time: 15000, lane: 0 },
        { time: 15000, lane: 1 },
        { time: 15500, lane: 2 },
        { time: 15500, lane: 3 },
        { time: 15750, lane: 0 },
        { time: 16000, lane: 1 },
        { time: 16250, lane: 2 },
        { time: 16500, lane: 3 },
        { time: 17000, lane: 0 },
        { time: 17000, lane: 2 },
        { time: 17500, lane: 1 },
        { time: 17500, lane: 3 },

        { time: 18000, lane: 0 },
        { time: 18000, lane: 1 },
        { time: 18000, lane: 2 },
        { time: 18000, lane: 3 }
    ];

    const LANE_KEYS = ['d', 'f', 'j', 'k'];
    const LANE_COLORS = ['#e94560', '#f39c12', '#7cfc00', '#00d4ff'];
    const JUDGE_LINE_Y = 560;
    const NOTE_HEIGHT = 30;
    const NOTE_WIDTH = 100;
    const LANE_WIDTH = 120;
    const FALL_DURATION = 1800;
    const PERFECT_WINDOW = 30;
    const GOOD_WINDOW = 80;

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('scoreValue');
    const comboEl = document.getElementById('comboValue');
    const startOverlay = document.getElementById('startOverlay');
    const resultOverlay = document.getElementById('resultOverlay');
    const speedSlider = document.getElementById('speedSlider');
    const speedLabel = document.getElementById('speedLabel');
    const judgePopup = document.getElementById('judgePopup');
    const restartBtn = document.getElementById('restartBtn');
    const finalScoreEl = document.getElementById('finalScore');
    const perfectCountEl = document.getElementById('perfectCount');
    const goodCountEl = document.getElementById('goodCount');
    const missCountEl = document.getElementById('missCount');
    const maxComboEl = document.getElementById('maxCombo');
    const keyHints = document.querySelectorAll('.key-hint');

    let state = 'idle';
    let score = 0;
    let combo = 0;
    let maxCombo = 0;
    let perfectCount = 0;
    let goodCount = 0;
    let missCount = 0;
    let speed = 1.5;
    let startTime = 0;
    let currentTime = 0;
    let notes = [];
    let animationId = null;

    speedSlider.addEventListener('input', function () {
        speed = parseFloat(speedSlider.value);
        speedLabel.textContent = speed.toFixed(1) + 'x';
    });

    restartBtn.addEventListener('click', function () {
        resetGame();
        showStartScreen();
    });

    document.addEventListener('keydown', function (e) {
        if (e.repeat) return;
        const key = e.key.toLowerCase();

        if (key === ' ' && state === 'idle') {
            e.preventDefault();
            startGame();
            return;
        }

        const laneIdx = LANE_KEYS.indexOf(key);
        if (laneIdx !== -1 && state === 'playing') {
            e.preventDefault();
            highlightKey(laneIdx, true);
            handleHit(laneIdx);
        }
    });

    document.addEventListener('keyup', function (e) {
        const key = e.key.toLowerCase();
        const laneIdx = LANE_KEYS.indexOf(key);
        if (laneIdx !== -1) {
            highlightKey(laneIdx, false);
        }
    });

    function highlightKey(laneIdx, active) {
        if (keyHints[laneIdx]) {
            if (active) {
                keyHints[laneIdx].classList.add('active');
            } else {
                keyHints[laneIdx].classList.remove('active');
            }
        }
    }

    function showStartScreen() {
        state = 'idle';
        startOverlay.classList.remove('hidden');
        resultOverlay.classList.add('hidden');
    }

    function resetGame() {
        score = 0;
        combo = 0;
        maxCombo = 0;
        perfectCount = 0;
        goodCount = 0;
        missCount = 0;
        notes = CHART.map(function (n) {
            return {
                time: n.time,
                lane: n.lane,
                hit: false,
                missed: false
            };
        });
        updateHUD();
    }

    function startGame() {
        resetGame();
        state = 'playing';
        startOverlay.classList.add('hidden');
        resultOverlay.classList.add('hidden');
        startTime = performance.now();
        loop();
    }

    function endGame() {
        state = 'ended';
        cancelAnimationFrame(animationId);
        finalScoreEl.textContent = score;
        perfectCountEl.textContent = perfectCount;
        goodCountEl.textContent = goodCount;
        missCountEl.textContent = missCount;
        maxComboEl.textContent = maxCombo;
        resultOverlay.classList.remove('hidden');
    }

    function updateHUD() {
        scoreEl.textContent = score;
        comboEl.textContent = combo;
    }

    function handleHit(laneIdx) {
        const now = currentTime;
        let bestNote = null;
        let bestDiff = Infinity;

        for (let i = 0; i < notes.length; i++) {
            const n = notes[i];
            if (n.lane !== laneIdx || n.hit || n.missed) continue;
            const diff = Math.abs(n.time - now);
            if (diff < bestDiff && diff <= GOOD_WINDOW) {
                bestDiff = diff;
                bestNote = n;
            }
        }

        if (bestNote) {
            bestNote.hit = true;
            if (bestDiff <= PERFECT_WINDOW) {
                judge('Perfect', '#00d4ff', laneIdx);
                score += 100;
                combo++;
                perfectCount++;
            } else {
                judge('Good', '#7cfc00', laneIdx);
                score += 50;
                combo++;
                goodCount++;
            }
            if (combo > maxCombo) maxCombo = combo;
        } else {
            combo = 0;
            missCount++;
            judge('Miss', '#ff4757', laneIdx);
        }
        updateHUD();
    }

    function checkMisses() {
        for (let i = 0; i < notes.length; i++) {
            const n = notes[i];
            if (!n.hit && !n.missed && currentTime - n.time > GOOD_WINDOW) {
                n.missed = true;
                combo = 0;
                missCount++;
                judge('Miss', '#ff4757', n.lane);
                updateHUD();
            }
        }
    }

    function isGameFinished() {
        const allProcessed = notes.every(function (n) {
            return n.hit || n.missed;
        });
        const lastNoteTime = notes.length > 0 ? notes[notes.length - 1].time : 0;
        return allProcessed && currentTime > lastNoteTime + 1000;
    }

    function judge(text, color, laneIdx) {
        const canvasRect = canvas.getBoundingClientRect();
        const laneCenterX = canvasRect.left + laneIdx * LANE_WIDTH + LANE_WIDTH / 2;
        const judgeY = canvasRect.top + JUDGE_LINE_Y - 40;

        const el = document.createElement('div');
        el.className = 'judge-popup show';
        el.textContent = text;
        el.style.color = color;
        el.style.left = laneCenterX + (Math.random() * 30 - 15) + 'px';
        el.style.top = judgeY + 'px';
        el.style.textShadow = '0 0 15px ' + color;
        document.body.appendChild(el);

        el.addEventListener('animationend', function () {
            el.remove();
        });
    }

    function getNoteY(noteTime) {
        const effectiveFall = FALL_DURATION / speed;
        const progress = (currentTime - noteTime + effectiveFall) / effectiveFall;
        return progress * JUDGE_LINE_Y;
    }

    function drawLanes() {
        for (let i = 0; i < 4; i++) {
            const x = i * LANE_WIDTH + 10;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
    }

    function drawJudgeLine() {
        const gradient = ctx.createLinearGradient(0, JUDGE_LINE_Y - 3, 0, JUDGE_LINE_Y + 3);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, JUDGE_LINE_Y - 3, canvas.width, 6);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(0, JUDGE_LINE_Y, canvas.width, canvas.height - JUDGE_LINE_Y);
    }

    function drawNote(n) {
        const y = getNoteY(n.time);
        if (y < -NOTE_HEIGHT || y > canvas.height) return;

        const x = n.lane * LANE_WIDTH + (LANE_WIDTH - NOTE_WIDTH) / 2;
        const color = LANE_COLORS[n.lane];

        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;

        const gradient = ctx.createLinearGradient(x, y, x, y + NOTE_HEIGHT);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, shadeColor(color, -30));
        ctx.fillStyle = gradient;

        roundRect(ctx, x, y, NOTE_WIDTH, NOTE_HEIGHT, 6);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        roundRect(ctx, x, y, NOTE_WIDTH, NOTE_HEIGHT, 6);
        ctx.stroke();

        ctx.restore();
    }

    function shadeColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = ((num >> 8) & 0x00ff) + amt;
        const B = (num & 0x0000ff) + amt;
        return '#' + (
            0x1000000 +
            (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 0 ? 0 : B) : 255)
        ).toString(16).slice(1);
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawLanes();

        for (let i = 0; i < notes.length; i++) {
            const n = notes[i];
            if (!n.hit && !n.missed) {
                drawNote(n);
            }
        }

        drawJudgeLine();
    }

    function loop() {
        if (state !== 'playing') return;
        currentTime = performance.now() - startTime;
        checkMisses();
        draw();
        if (isGameFinished()) {
            endGame();
            return;
        }
        animationId = requestAnimationFrame(loop);
    }

    draw();
    showStartScreen();
})();
