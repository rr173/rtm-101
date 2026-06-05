const TICKS_PER_BEAT = 4;
const BEATS_PER_BAR = 4;
const TICKS_PER_BAR = TICKS_PER_BEAT * BEATS_PER_BAR;
const MIN_PITCH = 24;
const MAX_PITCH = 95;
const TOTAL_PITCHES = MAX_PITCH - MIN_PITCH + 1;

const TRACK_COLORS = [
    '#4a9eff', '#ff6b6b', '#ffd93d', '#6bcb77',
    '#9b59b6', '#e67e22', '#1abc9c', '#e84393'
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function isBlackKey(pitch) {
    const note = pitch % 12;
    return [1, 3, 6, 8, 10].includes(note);
}

function getNoteName(pitch) {
    const octave = Math.floor(pitch / 12) - 1;
    const note = NOTE_NAMES[pitch % 12];
    return note + octave;
}

function pitchToFrequency(pitch) {
    return 440 * Math.pow(2, (pitch - 69) / 12);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

class PianoRollEditor {
    constructor() {
        this.tracks = [];
        this.activeTrackId = null;
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;
        
        this.selectedNotes = new Set();
        this.copiedNotes = [];
        
        this.bpm = 120;
        this.isPlaying = false;
        this.isPaused = false;
        this.playTick = 0;
        this.playStartTime = 0;
        this.animationFrameId = null;
        
        this.cellWidth = 40;
        this.cellHeight = 16;
        this.scrollX = 0;
        this.scrollY = 0;
        this.visibleBars = 8;
        
        this.dragState = null;
        this.selectionBox = null;
        this.contextMenuNote = null;
        
        this.audioContext = null;
        this.activeOscillators = new Map();
        
        this.init();
    }
    
    init() {
        this.canvas = document.getElementById('gridCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.rulerCanvas = document.getElementById('rulerCanvas');
        this.rulerCtx = this.rulerCanvas.getContext('2d');
        this.keyboardContainer = document.getElementById('pianoKeyboard');
        this.gridContainer = document.getElementById('gridContainer');
        this.rulerContainer = document.getElementById('rulerContainer');
        
        this.createInitialTracks();
        this.loadDemoMelody();
        this.createKeyboard();
        this.setupEventListeners();
        this.resizeCanvas();
        this.render();
        this.renderTrackList();
        
        setTimeout(() => {
            const targetPitch = 60;
            const targetY = (MAX_PITCH - targetPitch) * this.cellHeight;
            this.gridContainer.scrollTop = Math.max(0, targetY - this.gridContainer.clientHeight / 2);
            if (this.keyboardInner) {
                this.keyboardInner.style.transform = `translateY(${-this.gridContainer.scrollTop}px)`;
            }
        }, 100);
    }
    
    createInitialTracks() {
        this.addTrack('Melody', TRACK_COLORS[0]);
        this.addTrack('Chords', TRACK_COLORS[1]);
        this.activeTrackId = this.tracks[0].id;
    }
    
    addTrack(name, color) {
        if (this.tracks.length >= 8) return;
        
        const track = {
            id: generateId(),
            name: name || `Track ${this.tracks.length + 1}`,
            color: color || TRACK_COLORS[this.tracks.length % TRACK_COLORS.length],
            volume: 80,
            muted: false,
            solo: false,
            notes: []
        };
        this.tracks.push(track);
        return track;
    }
    
    removeTrack(trackId) {
        const index = this.tracks.findIndex(t => t.id === trackId);
        if (index === -1 || this.tracks.length <= 1) return;
        
        const track = this.tracks[index];
        const trackCopy = JSON.parse(JSON.stringify(track));
        
        this.tracks.splice(index, 1);
        if (this.activeTrackId === trackId) {
            this.activeTrackId = this.tracks[0].id;
        }
        this.selectedNotes.clear();
        this.renderTrackList();
        this.render();
        
        this.executeCommand({
            type: 'removeTrack',
            trackIndex: index,
            track: trackCopy,
            trackId,
            undo: () => {
                this.tracks.splice(index, 0, trackCopy);
                this.activeTrackId = trackId;
                this.renderTrackList();
                this.render();
            },
            redo: () => {
                const idx = this.tracks.findIndex(t => t.id === trackId);
                if (idx !== -1) {
                    this.tracks.splice(idx, 1);
                    if (this.activeTrackId === trackId) {
                        this.activeTrackId = this.tracks[0].id;
                    }
                }
                this.selectedNotes.clear();
                this.renderTrackList();
                this.render();
            }
        });
    }
    
    loadDemoMelody() {
        const melodyTrack = this.tracks[0];
        const chordTrack = this.tracks[1];
        
        const melody = [
            [60, 4], [62, 4], [64, 4], [65, 4],
            [67, 4], [69, 4], [71, 4], [72, 4],
            [71, 4], [69, 4], [67, 4], [65, 4],
            [64, 4], [62, 4], [60, 4], [60, 4],
            [62, 4], [64, 4], [65, 4], [67, 4],
            [69, 4], [71, 4], [72, 4], [71, 4],
            [69, 4], [67, 4], [65, 4], [64, 4],
            [62, 4], [60, 8], [64, 4], [60, 4]
        ];
        
        let tick = 0;
        for (const [pitch, duration] of melody) {
            melodyTrack.notes.push({
                id: generateId(),
                track: melodyTrack.id,
                pitch,
                startTick: tick,
                durationTicks: duration,
                velocity: 100
            });
            tick += duration;
        }
        
        const chords = [
            [60, 64, 67],
            [65, 69, 72],
            [67, 71, 74],
            [60, 64, 67],
            [60, 64, 67],
            [65, 69, 72],
            [67, 71, 74],
            [60, 64, 67]
        ];
        
        for (let i = 0; i < chords.length; i++) {
            for (const pitch of chords[i]) {
                chordTrack.notes.push({
                    id: generateId(),
                    track: chordTrack.id,
                    pitch: pitch - 12,
                    startTick: i * 16,
                    durationTicks: 16,
                    velocity: 80
                });
            }
        }
    }
    
    createKeyboard() {
        this.keyboardContainer.innerHTML = '';
        const keyboardInner = document.createElement('div');
        keyboardInner.style.position = 'relative';
        keyboardInner.style.width = '100%';
        keyboardInner.style.height = `${TOTAL_PITCHES * this.cellHeight}px`;
        
        for (let pitch = MAX_PITCH; pitch >= MIN_PITCH; pitch--) {
            const key = document.createElement('div');
            const isBlack = isBlackKey(pitch);
            key.className = `piano-key ${isBlack ? 'black' : 'white'}`;
            key.dataset.pitch = pitch;
            
            if (!isBlack) {
                key.textContent = getNoteName(pitch);
            }
            
            const indexFromTop = MAX_PITCH - pitch;
            key.style.top = `${indexFromTop * this.cellHeight}px`;
            key.style.height = `${this.cellHeight}px`;
            
            if (isBlack) {
                const offset = (this.cellHeight * 0.4);
                key.style.top = `${indexFromTop * this.cellHeight - offset}px`;
                key.style.height = `${this.cellHeight * 1.8}px`;
            }
            
            key.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.playNote(pitch, 100, 0.3);
                key.classList.add('active');
                setTimeout(() => key.classList.remove('active'), 200);
            });
            
            keyboardInner.appendChild(key);
        }
        
        this.keyboardContainer.appendChild(keyboardInner);
        this.keyboardInner = keyboardInner;
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.gridContainer.addEventListener('scroll', () => {
            this.scrollX = this.gridContainer.scrollLeft;
            this.scrollY = this.gridContainer.scrollTop;
            this.rulerContainer.scrollLeft = this.scrollX;
            if (this.keyboardInner) {
                this.keyboardInner.style.transform = `translateY(${-this.scrollY}px)`;
            }
        });
        
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => this.onMouseUp());
        this.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        
        this.rulerCanvas.addEventListener('click', (e) => this.onRulerClick(e));
        
        document.addEventListener('click', () => this.hideContextMenu());
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        document.getElementById('playBtn').addEventListener('click', () => this.play());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('stopBtn').addEventListener('click', () => this.stop());
        document.getElementById('bpmInput').addEventListener('change', (e) => {
            this.bpm = Math.max(40, Math.min(300, parseInt(e.target.value) || 120));
            e.target.value = this.bpm;
        });
        document.getElementById('exportMidiBtn').addEventListener('click', () => this.exportMidi());
        
        document.getElementById('addTrackBtn').addEventListener('click', () => {
            const track = this.addTrack();
            if (track) {
                this.activeTrackId = track.id;
                this.renderTrackList();
                this.render();
            }
        });
        
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleContextMenuAction(action);
            });
        });
        
        const velocitySlider = document.getElementById('velocitySlider');
        const velocityValue = document.getElementById('velocityValue');
        velocitySlider.addEventListener('input', () => {
            velocityValue.textContent = velocitySlider.value;
        });
        
        document.getElementById('velocityOk').addEventListener('click', () => {
            const velocity = parseInt(velocitySlider.value);
            this.setSelectedNotesVelocity(velocity);
            this.hideVelocityDialog();
        });
        
        document.getElementById('velocityCancel').addEventListener('click', () => {
            this.hideVelocityDialog();
        });
    }
    
    resizeCanvas() {
        const containerRect = this.gridContainer.getBoundingClientRect();
        
        let maxTick = 64;
        this.tracks.forEach(track => {
            track.notes.forEach(note => {
                const end = note.startTick + note.durationTicks;
                if (end > maxTick) maxTick = end;
            });
        });
        
        const minWidth = maxTick * this.cellWidth + 200;
        this.canvas.width = Math.max(containerRect.width - 20, minWidth, 3000);
        this.canvas.height = TOTAL_PITCHES * this.cellHeight;
        
        this.rulerCanvas.width = this.canvas.width;
        this.rulerCanvas.height = 30;
        
        this.render();
        this.renderRuler();
    }
    
    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.fillStyle = '#252525';
        ctx.fillRect(0, 0, width, height);
        
        for (let pitch = MAX_PITCH; pitch >= MIN_PITCH; pitch--) {
            const y = (MAX_PITCH - pitch) * this.cellHeight;
            const isBlack = isBlackKey(pitch);
            
            ctx.fillStyle = isBlack ? '#2a2a2a' : '#303030';
            ctx.fillRect(0, y, width, this.cellHeight);
            
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        const totalTicks = Math.ceil(width / this.cellWidth);
        for (let tick = 0; tick <= totalTicks; tick++) {
            const x = tick * this.cellWidth;
            const isBar = tick % TICKS_PER_BAR === 0;
            const isBeat = tick % TICKS_PER_BEAT === 0;
            
            ctx.strokeStyle = isBar ? '#555' : isBeat ? '#444' : '#333';
            ctx.lineWidth = isBar ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        this.tracks.forEach(track => {
            const isActiveTrack = track.id === this.activeTrackId;
            track.notes.forEach(note => {
                this.renderNote(note, track.color, isActiveTrack);
            });
        });
        
        if (this.selectionBox) {
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(
                this.selectionBox.x,
                this.selectionBox.y,
                this.selectionBox.width,
                this.selectionBox.height
            );
            ctx.setLineDash([]);
        }
        
        this.selectedNotes.forEach(noteId => {
            const note = this.findNoteById(noteId);
            if (note) {
                const x = note.startTick * this.cellWidth;
                const y = (MAX_PITCH - note.pitch) * this.cellHeight;
                const w = note.durationTicks * this.cellWidth;
                const h = this.cellHeight;
                
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
                
                const handleX = x + w - 8;
                ctx.fillStyle = '#fff';
                ctx.fillRect(handleX, y + h / 2 - 4, 6, 8);
            }
        });
        
        if (this.dragState && this.dragState.type === 'create') {
            const x = this.dragState.startTick * this.cellWidth;
            const y = (MAX_PITCH - this.dragState.pitch) * this.cellHeight;
            const w = Math.max(1, this.dragState.durationTicks) * this.cellWidth;
            const h = this.cellHeight;
            
            ctx.fillStyle = 'rgba(74, 158, 255, 0.5)';
            this.drawRoundRect(x + 2, y + 2, w - 4, h - 4, 3);
            ctx.fill();
        }
        
        if (this.isPlaying || this.isPaused) {
            const playX = this.playTick * this.cellWidth;
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(playX, 0);
            ctx.lineTo(playX, height);
            ctx.stroke();
        }
    }
    
    renderNote(note, color, isActive) {
        const x = note.startTick * this.cellWidth;
        const y = (MAX_PITCH - note.pitch) * this.cellHeight;
        const w = note.durationTicks * this.cellWidth;
        const h = this.cellHeight;
        
        const alpha = isActive ? 1 : 0.4;
        const brightness = 0.4 + (note.velocity / 127) * 0.6;
        const noteColor = this.adjustColorBrightness(color, brightness);
        
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = noteColor;
        this.drawRoundRect(x + 2, y + 2, w - 4, h - 4, 3);
        this.ctx.fill();
        
        if (isActive && w > 30) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '10px sans-serif';
            this.ctx.fillText(getNoteName(note.pitch), x + 6, y + h / 2 + 3);
        }
        
        this.ctx.globalAlpha = 1;
    }
    
    drawRoundRect(x, y, w, h, r) {
        const ctx = this.ctx;
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
    
    adjustColorBrightness(color, factor) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        const newR = Math.min(255, Math.floor(r * factor));
        const newG = Math.min(255, Math.floor(g * factor));
        const newB = Math.min(255, Math.floor(b * factor));
        
        return `rgb(${newR}, ${newG}, ${newB})`;
    }
    
    renderRuler() {
        const ctx = this.rulerCtx;
        const width = this.rulerCanvas.width;
        const height = this.rulerCanvas.height;
        
        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(0, 0, width, height);
        
        const totalBars = Math.ceil(width / (this.cellWidth * TICKS_PER_BAR));
        
        for (let bar = 0; bar <= totalBars; bar++) {
            const x = bar * TICKS_PER_BAR * this.cellWidth;
            
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            
            ctx.fillStyle = '#aaa';
            ctx.font = '11px sans-serif';
            ctx.fillText(`${bar + 1}`, x + 4, height - 8);
            
            for (let beat = 1; beat < BEATS_PER_BAR; beat++) {
                const beatX = x + beat * TICKS_PER_BEAT * this.cellWidth;
                ctx.strokeStyle = '#444';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(beatX, height - 10);
                ctx.lineTo(beatX, height);
                ctx.stroke();
            }
        }
    }
    
    renderTrackList() {
        const trackList = document.getElementById('trackList');
        trackList.innerHTML = '';
        
        this.tracks.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = `track-item ${track.id === this.activeTrackId ? 'active' : ''}`;
            
            item.innerHTML = `
                <div class="track-top">
                    <div class="track-color" style="background-color: ${track.color}"></div>
                    <span class="track-name">${track.name}</span>
                    <button class="track-delete" data-track-id="${track.id}">×</button>
                </div>
                <div class="track-controls">
                    <input type="range" class="track-volume" min="0" max="100" value="${track.volume}" data-track-id="${track.id}">
                    <span class="track-volume-label">${track.volume}%</span>
                </div>
                <div class="track-buttons">
                    <button class="track-mute ${track.muted ? 'active' : ''}" data-track-id="${track.id}">M</button>
                    <button class="track-solo ${track.solo ? 'active' : ''}" data-track-id="${track.id}">S</button>
                </div>
            `;
            
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('track-delete') ||
                    e.target.classList.contains('track-volume') ||
                    e.target.classList.contains('track-mute') ||
                    e.target.classList.contains('track-solo')) {
                    return;
                }
                this.activeTrackId = track.id;
                this.selectedNotes.clear();
                this.renderTrackList();
                this.render();
            });
            
            item.querySelector('.track-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeTrack(track.id);
            });
            
            item.querySelector('.track-volume').addEventListener('input', (e) => {
                track.volume = parseInt(e.target.value);
                item.querySelector('.track-volume-label').textContent = `${track.volume}%`;
            });
            
            item.querySelector('.track-mute').addEventListener('click', (e) => {
                e.stopPropagation();
                track.muted = !track.muted;
                this.renderTrackList();
            });
            
            item.querySelector('.track-solo').addEventListener('click', (e) => {
                e.stopPropagation();
                track.solo = !track.solo;
                this.renderTrackList();
            });
            
            trackList.appendChild(item);
        });
    }
    
    getMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left + this.scrollX,
            y: e.clientY - rect.top + this.scrollY
        };
    }
    
    pixelToTick(x) {
        return Math.floor(x / this.cellWidth);
    }
    
    pixelToPitch(y) {
        return MAX_PITCH - Math.floor(y / this.cellHeight);
    }
    
    findNoteAt(x, y) {
        const tick = this.pixelToTick(x);
        const pitch = this.pixelToPitch(y);
        
        for (const track of this.tracks) {
            if (track.id !== this.activeTrackId) continue;
            
            for (const note of track.notes) {
                if (note.pitch === pitch &&
                    tick >= note.startTick &&
                    tick < note.startTick + note.durationTicks) {
                    return note;
                }
            }
        }
        return null;
    }
    
    isOnNoteEdge(x, note) {
        const edgeX = (note.startTick + note.durationTicks) * this.cellWidth;
        return Math.abs(x - edgeX) < 10;
    }
    
    findNoteById(id) {
        for (const track of this.tracks) {
            const note = track.notes.find(n => n.id === id);
            if (note) return note;
        }
        return null;
    }
    
    onMouseDown(e) {
        if (e.button !== 0) return;
        
        const pos = this.getMousePosition(e);
        const note = this.findNoteAt(pos.x, pos.y);
        
        if (e.shiftKey && note) {
            if (this.selectedNotes.has(note.id)) {
                this.selectedNotes.delete(note.id);
            } else {
                this.selectedNotes.add(note.id);
            }
            this.render();
            return;
        }
        
        if (note) {
            if (this.selectedNotes.has(note.id)) {
                if (this.isOnNoteEdge(pos.x, note) && this.selectedNotes.size === 1) {
                    this.dragState = {
                        type: 'resize',
                        note,
                        startX: pos.x,
                        startDuration: note.durationTicks
                    };
                } else {
                    this.dragState = {
                        type: 'move',
                        startX: pos.x,
                        startY: pos.y,
                        notePositions: Array.from(this.selectedNotes).map(id => {
                            const n = this.findNoteById(id);
                            return { note: n, startTick: n.startTick, startPitch: n.pitch };
                        })
                    };
                }
            } else {
                this.selectedNotes.clear();
                this.selectedNotes.add(note.id);
                
                if (this.isOnNoteEdge(pos.x, note)) {
                    this.dragState = {
                        type: 'resize',
                        note,
                        startX: pos.x,
                        startDuration: note.durationTicks
                    };
                } else {
                    this.dragState = {
                        type: 'move',
                        startX: pos.x,
                        startY: pos.y,
                        notePositions: [{ note, startTick: note.startTick, startPitch: note.pitch }]
                    };
                }
                this.render();
            }
            return;
        }
        
        this.selectedNotes.clear();
        
        const pitch = this.pixelToPitch(pos.y);
        const startTick = this.pixelToTick(pos.x);
        
        if (pitch >= MIN_PITCH && pitch <= MAX_PITCH && startTick >= 0) {
            this.dragState = {
                type: 'create',
                pitch,
                startTick,
                durationTicks: 1
            };
        } else {
            this.dragState = {
                type: 'select',
                startX: pos.x,
                startY: pos.y
            };
        }
        
        this.render();
    }
    
    onMouseMove(e) {
        if (!this.dragState) return;
        
        const pos = this.getMousePosition(e);
        
        if (this.dragState.type === 'create') {
            const currentTick = this.pixelToTick(pos.x);
            this.dragState.durationTicks = Math.max(1, currentTick - this.dragState.startTick + 1);
            this.render();
        } else if (this.dragState.type === 'move') {
            const deltaTick = this.pixelToTick(pos.x) - this.pixelToTick(this.dragState.startX);
            const deltaPitch = this.pixelToPitch(this.dragState.startY) - this.pixelToPitch(pos.y);
            
            this.dragState.notePositions.forEach(({ note, startTick, startPitch }) => {
                note.startTick = Math.max(0, startTick + deltaTick);
                note.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, startPitch + deltaPitch));
            });
            this.render();
        } else if (this.dragState.type === 'resize') {
            const deltaTick = this.pixelToTick(pos.x) - this.pixelToTick(this.dragState.startX);
            this.dragState.note.durationTicks = Math.max(1, this.dragState.startDuration + deltaTick);
            this.render();
        } else if (this.dragState.type === 'select') {
            this.selectionBox = {
                x: Math.min(this.dragState.startX, pos.x),
                y: Math.min(this.dragState.startY, pos.y),
                width: Math.abs(pos.x - this.dragState.startX),
                height: Math.abs(pos.y - this.dragState.startY)
            };
            
            this.selectedNotes.clear();
            const activeTrack = this.tracks.find(t => t.id === this.activeTrackId);
            if (activeTrack) {
                activeTrack.notes.forEach(note => {
                    const noteX = note.startTick * this.cellWidth;
                    const noteY = (MAX_PITCH - note.pitch) * this.cellHeight;
                    const noteW = note.durationTicks * this.cellWidth;
                    const noteH = this.cellHeight;
                    
                    if (this.rectsIntersect(this.selectionBox, { x: noteX, y: noteY, width: noteW, height: noteH })) {
                        this.selectedNotes.add(note.id);
                    }
                });
            }
            this.render();
        }
    }
    
    onMouseUp(e) {
        if (!this.dragState) return;
        
        if (this.dragState.type === 'create') {
            const note = {
                id: generateId(),
                track: this.activeTrackId,
                pitch: this.dragState.pitch,
                startTick: this.dragState.startTick,
                durationTicks: this.dragState.durationTicks,
                velocity: 100
            };
            
            this.executeCommand({
                type: 'addNote',
                note,
                undo: () => {
                    const track = this.tracks.find(t => t.id === note.track);
                    const idx = track.notes.findIndex(n => n.id === note.id);
                    if (idx !== -1) track.notes.splice(idx, 1);
                    this.selectedNotes.delete(note.id);
                    this.render();
                },
                redo: () => {
                    const track = this.tracks.find(t => t.id === note.track);
                    track.notes.push(note);
                    this.selectedNotes.clear();
                    this.selectedNotes.add(note.id);
                    this.render();
                }
            });
            
            const track = this.tracks.find(t => t.id === this.activeTrackId);
            track.notes.push(note);
            this.selectedNotes.clear();
            this.selectedNotes.add(note.id);
        } else if (this.dragState.type === 'move') {
            const movedNotes = this.dragState.notePositions.map(({ note, startTick, startPitch }) => ({
                note,
                oldTick: startTick,
                oldPitch: startPitch,
                newTick: note.startTick,
                newPitch: note.pitch
            }));
            
            this.executeCommand({
                type: 'moveNotes',
                movedNotes,
                undo: () => {
                    movedNotes.forEach(({ note, oldTick, oldPitch }) => {
                        note.startTick = oldTick;
                        note.pitch = oldPitch;
                    });
                    this.render();
                },
                redo: () => {
                    movedNotes.forEach(({ note, newTick, newPitch }) => {
                        note.startTick = newTick;
                        note.pitch = newPitch;
                    });
                    this.render();
                }
            });
        } else if (this.dragState.type === 'resize') {
            const note = this.dragState.note;
            const oldDuration = this.dragState.startDuration;
            const newDuration = note.durationTicks;
            
            this.executeCommand({
                type: 'resizeNote',
                note,
                oldDuration,
                newDuration,
                undo: () => {
                    note.durationTicks = oldDuration;
                    this.render();
                },
                redo: () => {
                    note.durationTicks = newDuration;
                    this.render();
                }
            });
        }
        
        this.dragState = null;
        this.selectionBox = null;
        this.render();
    }
    
    onContextMenu(e) {
        e.preventDefault();
        
        const pos = this.getMousePosition(e);
        const note = this.findNoteAt(pos.x, pos.y);
        
        if (note) {
            if (!this.selectedNotes.has(note.id)) {
                this.selectedNotes.clear();
                this.selectedNotes.add(note.id);
                this.render();
            }
            this.contextMenuNote = note;
            this.showContextMenu(e.clientX, e.clientY);
        }
    }
    
    showContextMenu(x, y) {
        const menu = document.getElementById('contextMenu');
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';
    }
    
    hideContextMenu() {
        document.getElementById('contextMenu').style.display = 'none';
    }
    
    handleContextMenuAction(action) {
        this.hideContextMenu();
        
        switch (action) {
            case 'velocity':
                this.showVelocityDialog();
                break;
            case 'copy':
                this.copySelectedNotes();
                break;
            case 'paste':
                this.pasteNotes();
                break;
            case 'delete':
                this.deleteSelectedNotes();
                break;
        }
    }
    
    showVelocityDialog() {
        const dialog = document.getElementById('velocityDialog');
        const slider = document.getElementById('velocitySlider');
        
        if (this.selectedNotes.size > 0) {
            const firstNote = this.findNoteById(Array.from(this.selectedNotes)[0]);
            if (firstNote) {
                slider.value = firstNote.velocity;
                document.getElementById('velocityValue').textContent = firstNote.velocity;
            }
        }
        
        dialog.classList.add('show');
    }
    
    hideVelocityDialog() {
        document.getElementById('velocityDialog').classList.remove('show');
    }
    
    setSelectedNotesVelocity(velocity) {
        if (this.selectedNotes.size === 0) return;
        
        const velocityChanges = [];
        this.selectedNotes.forEach(noteId => {
            const note = this.findNoteById(noteId);
            if (note) {
                velocityChanges.push({
                    note,
                    oldVelocity: note.velocity,
                    newVelocity: velocity
                });
                note.velocity = velocity;
            }
        });
        
        this.executeCommand({
            type: 'changeVelocity',
            velocityChanges,
            undo: () => {
                velocityChanges.forEach(({ note, oldVelocity }) => {
                    note.velocity = oldVelocity;
                });
                this.render();
            },
            redo: () => {
                velocityChanges.forEach(({ note, newVelocity }) => {
                    note.velocity = newVelocity;
                });
                this.render();
            }
        });
        
        this.render();
    }
    
    copySelectedNotes() {
        this.copiedNotes = Array.from(this.selectedNotes).map(id => {
            const note = this.findNoteById(id);
            return note ? { ...note } : null;
        }).filter(n => n !== null);
    }
    
    pasteNotes() {
        if (this.copiedNotes.length === 0) return;
        
        const minTick = Math.min(...this.copiedNotes.map(n => n.startTick));
        const offsetTick = this.playTick - minTick;
        
        const newNotes = this.copiedNotes.map(note => ({
            ...note,
            id: generateId(),
            track: this.activeTrackId,
            startTick: Math.max(0, note.startTick + offsetTick)
        }));
        
        const track = this.tracks.find(t => t.id === this.activeTrackId);
        
        this.executeCommand({
            type: 'pasteNotes',
            newNotes,
            trackId: this.activeTrackId,
            undo: () => {
                const t = this.tracks.find(track => track.id === this.activeTrackId);
                newNotes.forEach(note => {
                    const idx = t.notes.findIndex(n => n.id === note.id);
                    if (idx !== -1) t.notes.splice(idx, 1);
                    this.selectedNotes.delete(note.id);
                });
                this.render();
            },
            redo: () => {
                const t = this.tracks.find(track => track.id === this.activeTrackId);
                newNotes.forEach(note => t.notes.push(note));
                this.selectedNotes.clear();
                newNotes.forEach(note => this.selectedNotes.add(note.id));
                this.render();
            }
        });
        
        newNotes.forEach(note => track.notes.push(note));
        this.selectedNotes.clear();
        newNotes.forEach(note => this.selectedNotes.add(note.id));
        this.render();
    }
    
    deleteSelectedNotes() {
        if (this.selectedNotes.size === 0) return;
        
        const deletedNotes = [];
        this.selectedNotes.forEach(noteId => {
            const note = this.findNoteById(noteId);
            if (note) {
                deletedNotes.push({
                    note,
                    trackId: note.track
                });
                const track = this.tracks.find(t => t.id === note.track);
                const idx = track.notes.findIndex(n => n.id === noteId);
                if (idx !== -1) track.notes.splice(idx, 1);
            }
        });
        
        this.executeCommand({
            type: 'deleteNotes',
            deletedNotes,
            undo: () => {
                deletedNotes.forEach(({ note, trackId }) => {
                    const track = this.tracks.find(t => t.id === trackId);
                    track.notes.push(note);
                });
                this.render();
            },
            redo: () => {
                deletedNotes.forEach(({ note, trackId }) => {
                    const track = this.tracks.find(t => t.id === trackId);
                    const idx = track.notes.findIndex(n => n.id === note.id);
                    if (idx !== -1) track.notes.splice(idx, 1);
                });
                this.selectedNotes.clear();
                this.render();
            }
        });
        
        this.selectedNotes.clear();
        this.render();
    }
    
    onWheel(e) {
        e.preventDefault();
        
        if (e.ctrlKey) {
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.cellWidth = Math.max(10, Math.min(160, this.cellWidth * delta));
            this.resizeCanvas();
        } else if (e.shiftKey) {
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.cellHeight = Math.max(8, Math.min(40, this.cellHeight * delta));
            this.createKeyboard();
            this.resizeCanvas();
        } else {
            this.gridContainer.scrollLeft += e.deltaY;
        }
    }
    
    onRulerClick(e) {
        const rect = this.rulerCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left + this.scrollX;
        this.playTick = Math.max(0, this.pixelToTick(x));
        this.render();
    }
    
    onKeyDown(e) {
        if (e.target.tagName === 'INPUT') return;
        
        if (e.key === ' ') {
            e.preventDefault();
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.deleteSelectedNotes();
        } else if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                this.redo();
            } else {
                this.undo();
            }
        } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            this.redo();
        } else if (e.ctrlKey && e.key === 'c') {
            e.preventDefault();
            this.copySelectedNotes();
        } else if (e.ctrlKey && e.key === 'v') {
            e.preventDefault();
            this.pasteNotes();
        } else if (e.key === 'Escape') {
            this.selectedNotes.clear();
            this.render();
        }
    }
    
    executeCommand(command) {
        this.undoStack.push(command);
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }
    
    undo() {
        if (this.undoStack.length === 0) return;
        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);
    }
    
    redo() {
        if (this.redoStack.length === 0) return;
        const command = this.redoStack.pop();
        command.redo();
        this.undoStack.push(command);
    }
    
    rectsIntersect(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }
    
    initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    playNote(pitch, velocity, duration = null, trackId = null) {
        this.initAudio();
        
        const freq = pitchToFrequency(pitch);
        const now = this.audioContext.currentTime;
        
        const gainNode = this.audioContext.createGain();
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        
        osc1.type = 'sine';
        osc1.frequency.value = freq;
        
        osc2.type = 'sine';
        osc2.frequency.value = freq * 3;
        
        const velocityGain = velocity / 127;
        let trackVolume = 1;
        if (trackId) {
            const track = this.tracks.find(t => t.id === trackId);
            if (track) {
                trackVolume = track.volume / 100;
            }
        }
        
        const attack = 0.01;
        const decay = 0.1;
        const sustain = 0.3;
        const release = 0.3;
        
        const totalGain = velocityGain * trackVolume * 0.3;
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(totalGain, now + attack);
        gainNode.gain.linearRampToValueAtTime(totalGain * sustain, now + attack + decay);
        
        const osc1Gain = this.audioContext.createGain();
        osc1Gain.gain.value = 0.6;
        
        const osc2Gain = this.audioContext.createGain();
        osc2Gain.gain.value = 0.2;
        
        osc1.connect(osc1Gain);
        osc2.connect(osc2Gain);
        osc1Gain.connect(gainNode);
        osc2Gain.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        osc1.start(now);
        osc2.start(now);
        
        const key = document.querySelector(`.piano-key[data-pitch="${pitch}"]`);
        if (key) key.classList.add('active');
        
        const stopTime = duration ? now + duration : null;
        const oscId = generateId();
        
        this.activeOscillators.set(oscId, {
            osc1, osc2, gainNode, pitch, stopTime
        });
        
        return oscId;
    }
    
    stopNote(oscId) {
        const oscData = this.activeOscillators.get(oscId);
        if (!oscData) return;
        
        const now = this.audioContext.currentTime;
        const release = 0.3;
        
        oscData.gainNode.gain.cancelScheduledValues(now);
        oscData.gainNode.gain.setValueAtTime(oscData.gainNode.gain.value, now);
        oscData.gainNode.gain.linearRampToValueAtTime(0, now + release);
        
        oscData.osc1.stop(now + release);
        oscData.osc2.stop(now + release);
        
        const key = document.querySelector(`.piano-key[data-pitch="${oscData.pitch}"]`);
        if (key) key.classList.remove('active');
        
        setTimeout(() => {
            this.activeOscillators.delete(oscId);
        }, release * 1000);
    }
    
    play() {
        if (this.isPlaying) return;
        
        this.initAudio();
        this.isPlaying = true;
        this.isPaused = false;
        
        const hasSolo = this.tracks.some(t => t.solo);
        
        const activeNotes = new Map();
        const tickDuration = 60 / (this.bpm * TICKS_PER_BEAT);
        
        this.playStartTime = performance.now() - (this.playTick * tickDuration * 1000);
        
        const animate = () => {
            if (!this.isPlaying) return;
            
            const elapsed = (performance.now() - this.playStartTime) / 1000;
            const newTick = elapsed / tickDuration;
            
            const oldTick = Math.floor(this.playTick);
            const currentTick = Math.floor(newTick);
            
            for (let tick = oldTick + 1; tick <= currentTick; tick++) {
                this.tracks.forEach(track => {
                    if (track.muted) return;
                    if (hasSolo && !track.solo) return;
                    
                    track.notes.forEach(note => {
                        if (note.startTick === tick) {
                            const oscId = this.playNote(note.pitch, note.velocity, null, track.id);
                            activeNotes.set(note.id, oscId);
                        }
                        
                        if (note.startTick + note.durationTicks === tick) {
                            const oscId = activeNotes.get(note.id);
                            if (oscId) {
                                this.stopNote(oscId);
                                activeNotes.delete(note.id);
                            }
                        }
                    });
                });
            }
            
            this.playTick = newTick;
            
            const maxTick = this.getMaxTick();
            if (this.playTick >= maxTick) {
                this.stop();
                return;
            }
            
            this.render();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    pause() {
        this.isPlaying = false;
        this.isPaused = true;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        this.activeOscillators.forEach((_, oscId) => {
            this.stopNote(oscId);
        });
    }
    
    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.playTick = 0;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        this.activeOscillators.forEach((_, oscId) => {
            this.stopNote(oscId);
        });
        
        document.querySelectorAll('.piano-key.active').forEach(key => {
            key.classList.remove('active');
        });
        
        this.render();
    }
    
    getMaxTick() {
        let max = 0;
        this.tracks.forEach(track => {
            track.notes.forEach(note => {
                const end = note.startTick + note.durationTicks;
                if (end > max) max = end;
            });
        });
        return max + TICKS_PER_BAR;
    }
    
    exportMidi() {
        const midiExporter = new MidiExporter(this.tracks, this.bpm);
        midiExporter.export();
    }
}

class MidiExporter {
    constructor(tracks, bpm) {
        this.tracks = tracks;
        this.bpm = bpm;
        this.ticksPerQuarter = 480;
        this.ticksPerSixteenth = this.ticksPerQuarter / 4;
    }
    
    export() {
        const chunks = [];
        
        chunks.push(this.writeHeader());
        
        this.tracks.forEach((track, index) => {
            chunks.push(this.writeTrack(track, index));
        });
        
        const midiData = this.concatChunks(chunks);
        
        const blob = new Blob([midiData], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'piano-roll.mid';
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    writeHeader() {
        const format = 1;
        const numTracks = this.tracks.length;
        const division = this.ticksPerQuarter;
        
        const data = new Uint8Array(6);
        data[0] = (format >> 8) & 0xff;
        data[1] = format & 0xff;
        data[2] = (numTracks >> 8) & 0xff;
        data[3] = numTracks & 0xff;
        data[4] = (division >> 8) & 0xff;
        data[5] = division & 0xff;
        
        return this.createChunk('MThd', data);
    }
    
    writeTrack(track, trackIndex) {
        const events = [];
        
        events.push({
            delta: 0,
            data: [0xff, 0x51, 0x03, ...this.microsecondsPerBeat(this.bpm)]
        });
        
        events.push({
            delta: 0,
            data: [0xff, 0x03, track.name.length, ...this.stringToBytes(track.name)]
        });
        
        const noteEvents = [];
        track.notes.forEach(note => {
            const startTick = note.startTick * this.ticksPerSixteenth;
            const endTick = (note.startTick + note.durationTicks) * this.ticksPerSixteenth;
            
            noteEvents.push({
                tick: startTick,
                data: [0x90 + trackIndex, note.pitch, note.velocity]
            });
            
            noteEvents.push({
                tick: endTick,
                data: [0x80 + trackIndex, note.pitch, 0]
            });
        });
        
        noteEvents.sort((a, b) => a.tick - b.tick);
        
        let lastTick = 0;
        noteEvents.forEach(event => {
            events.push({
                delta: event.tick - lastTick,
                data: event.data
            });
            lastTick = event.tick;
        });
        
        events.push({
            delta: 0,
            data: [0xff, 0x2f, 0x00]
        });
        
        const trackData = this.serializeEvents(events);
        return this.createChunk('MTrk', trackData);
    }
    
    serializeEvents(events) {
        const bytes = [];
        events.forEach(event => {
            bytes.push(...this.writeVariableLength(event.delta));
            bytes.push(...event.data);
        });
        return new Uint8Array(bytes);
    }
    
    writeVariableLength(value) {
        const bytes = [];
        let buffer = value & 0x7f;
        
        while ((value >>= 7) > 0) {
            buffer <<= 8;
            buffer |= 0x80;
            buffer += (value & 0x7f);
        }
        
        while (true) {
            bytes.push(buffer & 0xff);
            if (buffer & 0x80) {
                buffer >>= 8;
            } else {
                break;
            }
        }
        
        return bytes;
    }
    
    microsecondsPerBeat(bpm) {
        const usPerBeat = Math.floor(60000000 / bpm);
        return [
            (usPerBeat >> 16) & 0xff,
            (usPerBeat >> 8) & 0xff,
            usPerBeat & 0xff
        ];
    }
    
    stringToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i) & 0xff);
        }
        return bytes;
    }
    
    createChunk(type, data) {
        const header = new Uint8Array(8);
        
        for (let i = 0; i < 4; i++) {
            header[i] = type.charCodeAt(i);
        }
        
        const length = data.length;
        header[4] = (length >> 24) & 0xff;
        header[5] = (length >> 16) & 0xff;
        header[6] = (length >> 8) & 0xff;
        header[7] = length & 0xff;
        
        return this.concatChunks([header, data]);
    }
    
    concatChunks(chunks) {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        
        let offset = 0;
        chunks.forEach(chunk => {
            result.set(chunk, offset);
            offset += chunk.length;
        });
        
        return result;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.editor = new PianoRollEditor();
});
