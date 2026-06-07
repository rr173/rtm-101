const TICKS_PER_BEAT = 4;
const BEATS_PER_BAR = 4;
const TICKS_PER_BAR = TICKS_PER_BEAT * BEATS_PER_BAR;
const MIN_PITCH = 24;
const MAX_PITCH = 95;
const TOTAL_PITCHES = MAX_PITCH - MIN_PITCH + 1;

const KEYBOARD_WHITE_KEYS = {
    'a': 0, 's': 1, 'd': 2, 'f': 3, 'g': 4, 'h': 5, 'j': 6, 'k': 7, 'l': 8
};
const KEYBOARD_BLACK_KEYS = {
    'w': 0, 'e': 1, 't': 2, 'y': 3, 'u': 4
};
const WHITE_PITCH_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12, 14];
const BLACK_PITCH_OFFSETS = [1, 3, 6, 8, 10];
const BASE_OCTAVE_PITCH = 60;

const TRACK_COLORS = [
    '#4a9eff', '#ff6b6b', '#ffd93d', '#6bcb77',
    '#9b59b6', '#e67e22', '#1abc9c', '#e84393'
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const AUTOMATION_TYPES = {
    volume: {
        name: 'Volume',
        color: '#4a9eff',
        min: 0,
        max: 127,
        default: 127,
        defaultValueLabel: (v) => `${Math.round(v / 127 * 100)}%`,
        center: null
    },
    pan: {
        name: 'Pan',
        color: '#6bcb77',
        min: 0,
        max: 127,
        default: 64,
        defaultValueLabel: (v) => v < 64 ? `L${64 - v}` : v > 64 ? `R${v - 64}` : 'C',
        center: 64
    },
    pitchBend: {
        name: 'Pitch Bend',
        color: '#ffd93d',
        min: 0,
        max: 127,
        default: 64,
        defaultValueLabel: (v) => `${(v - 64) * 2}ct`,
        center: 64
    },
    modulation: {
        name: 'Modulation',
        color: '#e67e22',
        min: 0,
        max: 127,
        default: 0,
        defaultValueLabel: (v) => `${Math.round(v / 127 * 100)}%`,
        center: null
    }
};

const INTERPOLATION_MODES = {
    linear: 'Linear',
    step: 'Step',
    sCurve: 'S-Curve'
};

const CHORD_TYPES = [
    { name: '', intervals: [0, 4, 7], priority: 100 },
    { name: 'm', intervals: [0, 3, 7], priority: 90 },
    { name: '7', intervals: [0, 4, 7, 10], priority: 80 },
    { name: 'm7', intervals: [0, 3, 7, 10], priority: 70 },
    { name: 'dim', intervals: [0, 3, 6], priority: 60 },
    { name: 'aug', intervals: [0, 4, 8], priority: 50 },
    { name: 'maj7', intervals: [0, 4, 7, 11], priority: 40 },
    { name: 'dim7', intervals: [0, 3, 6, 9], priority: 30 },
    { name: 'sus4', intervals: [0, 5, 7], priority: 20 },
    { name: '6', intervals: [0, 4, 7, 9], priority: 10 }
];

function normalizePitchClass(pitches) {
    const set = new Set();
    pitches.forEach(p => set.add(p % 12));
    return Array.from(set).sort((a, b) => a - b);
}

function detectChord(pitches) {
    if (pitches.length < 3) return null;

    const sortedPitches = [...pitches].sort((a, b) => a - b);
    const bassPitch = sortedPitches[0];
    const bassNote = bassPitch % 12;

    const pitchClasses = normalizePitchClass(sortedPitches);
    if (pitchClasses.length < 3) return null;

    let bestMatch = null;
    let bestScore = -1;

    for (let rootIdx = 0; rootIdx < pitchClasses.length; rootIdx++) {
        const root = pitchClasses[rootIdx];
        const intervals = pitchClasses
            .map(p => (p - root + 12) % 12)
            .filter(i => i !== 0)
            .sort((a, b) => a - b);
        const intervalsWithRoot = [0, ...intervals];
        const isInversion = root !== bassNote;

        for (const chordType of CHORD_TYPES) {
            if (intervalsWithRoot.length < chordType.intervals.length) continue;

            let matchCount = 0;
            for (const interval of chordType.intervals) {
                if (intervalsWithRoot.includes(interval)) {
                    matchCount++;
                }
            }

            const matchRatio = matchCount / chordType.intervals.length;
            const extraNotes = intervalsWithRoot.length - chordType.intervals.length;
            const exactMatch = matchCount === chordType.intervals.length && extraNotes === 0;

            let score = matchRatio * 10000 + chordType.intervals.length * 100 + chordType.priority - extraNotes * 50;
            if (exactMatch) score += 5000;
            if (!isInversion) score += 500;

            if (matchRatio >= 0.99 && score > bestScore) {
                bestScore = score;
                const bassNoteName = NOTE_NAMES[bassNote];
                bestMatch = {
                    root,
                    name: NOTE_NAMES[root] + chordType.name,
                    fullName: isInversion ? NOTE_NAMES[root] + chordType.name + '/' + bassNoteName : NOTE_NAMES[root] + chordType.name,
                    type: chordType.name,
                    isInversion,
                    bassNote,
                    matchingPitches: sortedPitches.filter(p => {
                        const interval = (p % 12 - root + 12) % 12;
                        return chordType.intervals.includes(interval);
                    })
                };
            }
        }
    }

    return bestMatch;
}

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

function interpolateLinear(t) {
    return t;
}

function interpolateSCurve(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function getAutomationValueAtTime(channel, tick) {
    const points = channel.points;
    if (points.length === 0) {
        return AUTOMATION_TYPES[channel.type].default;
    }
    if (points.length === 1 || tick <= points[0].tick) {
        return points[0].value;
    }
    if (tick >= points[points.length - 1].tick) {
        return points[points.length - 1].value;
    }
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        if (tick >= p1.tick && tick <= p2.tick) {
            const dt = p2.tick - p1.tick;
            const t = dt === 0 ? 0 : (tick - p1.tick) / dt;
            let interpolated;
            switch (p1.interpolation) {
                case 'step':
                    interpolated = p1.value;
                    break;
                case 'sCurve':
                    interpolated = p1.value + (p2.value - p1.value) * interpolateSCurve(t);
                    break;
                case 'linear':
                default:
                    interpolated = p1.value + (p2.value - p1.value) * interpolateLinear(t);
                    break;
            }
            return interpolated;
        }
    }
    return points[points.length - 1].value;
}

class PianoRollEditor {
    constructor() {
        this.tracks = [];
        this.activeTrackId = null;
        this.activeChannelId = null;
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
        this.automationDragState = null;
        this.contextMenuPoint = null;
        
        this.automationCollapsed = false;
        
        this.audioContext = null;
        this.activeOscillators = new Map();
        
        this.isRecording = false;
        this.recordingStartTick = 0;
        this.recordingActiveNotes = new Map();
        this.recordingCompletedNotes = [];
        this.keyboardOctave = 0;
        this.pressedComputerKeys = new Set();
        
        this.quantizeUnit = 1;
        this.metronomeEnabled = false;
        this.lastMetronomeTick = -1;
        
        this.velocityCollapsed = false;
        this.velocityDragState = null;
        this.velocitySelectionBox = null;
        
        this.snapEnabled = false;
        
        this.pendingMidiFile = null;
        
        this.dialogOpen = false;

        this.chordTrackCanvas = null;
        this.chordTrackCtx = null;
        this.chordTrackContainer = null;
        this.highlightedChordBeat = null;
        this.highlightedNoteIds = new Set();

        this.mixerCollapsed = false;
        this.mixerWidth = 0;
        this.mixerPeaks = new Map();
        this.mixerFaderDragState = null;
        this.mixerPanDragState = null;
        this.mixerResizeState = null;

        this.trackPeakHold = new Map();
        
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
        this.automationCanvas = document.getElementById('automationCanvas');
        this.automationCtx = this.automationCanvas.getContext('2d');
        this.automationCanvasContainer = document.getElementById('automationCanvasContainer');
        this.automationContainer = document.getElementById('automationContainer');
        this.channelSelect = document.getElementById('channelSelect');
        
        this.velocityPanel = document.getElementById('velocityPanel');
        this.velocityCanvas = document.getElementById('velocityCanvas');
        this.velocityCtx = this.velocityCanvas.getContext('2d');
        this.velocityCanvasContainer = document.getElementById('velocityCanvasContainer');

        this.chordTrackCanvas = document.getElementById('chordTrackCanvas');
        this.chordTrackCtx = this.chordTrackCanvas.getContext('2d');
        this.chordTrackContainer = document.getElementById('chordTrackContainer');

        this.mixerPanel = document.getElementById('mixerPanel');
        this.mixerChannels = document.getElementById('mixerChannels');
        this.mixerToggleBtn = document.getElementById('mixerToggleBtn');
        this.mixerResizer = document.getElementById('mixerResizer');

        this.loadMixerState();
        
        this.createInitialTracks();
        this.loadDemoMelody();
        this.createKeyboard();
        this.setupEventListeners();
        this.resizeCanvas();
        this.render();
        this.renderTrackList();
        this.renderChannelSelect();
        
        setTimeout(() => {
            const targetPitch = 60;
            const targetY = (MAX_PITCH - targetPitch) * this.cellHeight;
            this.gridContainer.scrollTop = Math.max(0, targetY - this.gridContainer.clientHeight / 2);
            if (this.keyboardInner) {
                this.keyboardInner.style.transform = `translateY(${-this.gridContainer.scrollTop}px)`;
            }
        }, 100);
        
        setTimeout(() => {
            this.resizeVelocityCanvas();
            this.renderVelocity();
            this.resizeChordTrackCanvas();
            this.renderChordTrack();
            this.renderMixer();
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
            volume: 102,
            muted: false,
            solo: false,
            notes: [],
            automationChannels: [],
            activeChannelId: null
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
            this.activeChannelId = this.tracks[0].activeChannelId;
        }
        this.selectedNotes.clear();
        this.renderTrackList();
        this.renderChannelSelect();
        this.render();
        this.renderVelocity();
        
        this.executeCommand({
            type: 'removeTrack',
            trackIndex: index,
            trackCopy,
            trackId,
            undo: () => {
                this.tracks.splice(index, 0, JSON.parse(JSON.stringify(trackCopy)));
                this.activeTrackId = trackId;
                this.activeChannelId = trackCopy.activeChannelId;
                this.renderTrackList();
                this.renderChannelSelect();
                this.render();
                this.renderVelocity();
            },
            redo: () => {
                const idx = this.tracks.findIndex(t => t.id === trackId);
                if (idx !== -1) {
                    this.tracks.splice(idx, 1);
                    if (this.activeTrackId === trackId && this.tracks.length > 0) {
                        this.activeTrackId = this.tracks[0].id;
                        this.activeChannelId = this.tracks[0].activeChannelId;
                    }
                }
                this.selectedNotes.clear();
                this.renderTrackList();
                this.renderChannelSelect();
                this.render();
                this.renderVelocity();
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
            this.automationCanvasContainer.scrollLeft = this.scrollX;
            this.chordTrackContainer.scrollLeft = this.scrollX;
            if (this.velocityCanvasContainer) {
                this.velocityCanvasContainer.scrollLeft = this.scrollX;
            }
            if (this.keyboardInner) {
                this.keyboardInner.style.transform = `translateY(${-this.scrollY}px)`;
            }
        });
        
        this.automationCanvasContainer.addEventListener('scroll', () => {
            this.scrollX = this.automationCanvasContainer.scrollLeft;
            this.gridContainer.scrollLeft = this.scrollX;
            this.rulerContainer.scrollLeft = this.scrollX;
            this.chordTrackContainer.scrollLeft = this.scrollX;
            if (this.velocityCanvasContainer) {
                this.velocityCanvasContainer.scrollLeft = this.scrollX;
            }
        });
        
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => this.onMouseUp());
        this.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        this.automationCanvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        
        this.automationCanvas.addEventListener('mousedown', (e) => this.onAutomationMouseDown(e));
        this.automationCanvas.addEventListener('mousemove', (e) => this.onAutomationMouseMove(e));
        this.automationCanvas.addEventListener('mouseup', (e) => this.onAutomationMouseUp(e));
        this.automationCanvas.addEventListener('mouseleave', () => this.onAutomationMouseUp());
        this.automationCanvas.addEventListener('dblclick', (e) => this.onAutomationDoubleClick(e));
        this.automationCanvas.addEventListener('contextmenu', (e) => this.onAutomationContextMenu(e));
        
        this.rulerCanvas.addEventListener('click', (e) => this.onRulerClick(e));
        
        document.addEventListener('click', () => {
            this.hideContextMenu();
            this.hideInterpolationMenu();
        });
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
        document.getElementById('metronomeBtn').addEventListener('click', () => this.toggleMetronome());
        document.getElementById('snapBtn').addEventListener('click', () => this.toggleSnap());
        document.getElementById('quantizeSelect').addEventListener('change', (e) => {
            this.quantizeUnit = parseInt(e.target.value) || 0;
        });
        
        document.getElementById('playBtn').addEventListener('click', () => this.play());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopRecordingOrPlayback());
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
                this.renderChannelSelect();
            }
        });
        
        document.querySelectorAll('#contextMenu .menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleContextMenuAction(action);
            });
        });
        
        document.querySelectorAll('#interpolationMenu .menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const mode = item.dataset.interpolation;
                this.handleInterpolationChange(mode);
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
        
        document.getElementById('toggleAutomationBtn').addEventListener('click', () => {
            this.toggleAutomationPanel();
        });
        
        document.getElementById('channelSelect').addEventListener('change', (e) => {
            const track = this.getActiveTrack();
            if (track) {
                track.activeChannelId = e.target.value || null;
                this.activeChannelId = track.activeChannelId;
                this.renderAutomation();
            }
        });
        
        document.getElementById('addChannelBtn').addEventListener('click', () => {
            this.showAddChannelDialog();
        });
        
        document.getElementById('deleteChannelBtn').addEventListener('click', () => {
            this.deleteActiveChannel();
        });
        
        document.getElementById('addChannelOk').addEventListener('click', () => {
            const type = document.getElementById('newChannelType').value;
            this.addAutomationChannel(type);
            this.hideAddChannelDialog();
        });
        
        document.getElementById('addChannelCancel').addEventListener('click', () => {
            this.hideAddChannelDialog();
        });
        
        document.getElementById('importMidiBtn').addEventListener('click', () => {
            document.getElementById('midiFileInput').click();
        });
        
        document.getElementById('midiFileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.pendingMidiFile = file;
                this.showImportMidiDialog();
            }
            e.target.value = '';
        });
        
        document.getElementById('importMidiOk').addEventListener('click', () => {
            this.hideImportMidiDialog();
            if (this.pendingMidiFile) {
                this.importMidiFile(this.pendingMidiFile);
                this.pendingMidiFile = null;
            }
        });
        
        document.getElementById('importMidiCancel').addEventListener('click', () => {
            this.hideImportMidiDialog();
            this.pendingMidiFile = null;
        });
        
        document.getElementById('toggleVelocityBtn').addEventListener('click', () => {
            this.toggleVelocityPanel();
        });
        
        this.velocityCanvas.addEventListener('mousedown', (e) => this.onVelocityMouseDown(e));
        this.velocityCanvas.addEventListener('mousemove', (e) => this.onVelocityMouseMove(e));
        this.velocityCanvas.addEventListener('mouseup', (e) => this.onVelocityMouseUp(e));
        this.velocityCanvas.addEventListener('mouseleave', () => this.onVelocityMouseUp());
        
        this.velocityCanvasContainer.addEventListener('scroll', () => {
            this.scrollX = this.velocityCanvasContainer.scrollLeft;
            this.gridContainer.scrollLeft = this.scrollX;
            this.rulerContainer.scrollLeft = this.scrollX;
            this.automationCanvasContainer.scrollLeft = this.scrollX;
            this.chordTrackContainer.scrollLeft = this.scrollX;
        });

        this.chordTrackCanvas.addEventListener('click', (e) => this.onChordTrackClick(e));

        document.getElementById('exportChordBtn').addEventListener('click', () => this.exportChordProgression());
        
        this.velocityCanvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

        document.getElementById('selectBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown('selectMenu');
        });

        document.getElementById('transformBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown('transformMenu');
        });

        document.querySelectorAll('#selectMenu .menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.select;
                this.handleSelectAction(action);
                this.hideAllDropdowns();
            });
        });

        document.querySelectorAll('#transformMenu .menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.transform;
                this.handleTransformAction(action);
                this.hideAllDropdowns();
            });
        });

        document.addEventListener('click', () => {
            this.hideAllDropdowns();
        });

        document.getElementById('pitchSelectAllBtn').addEventListener('click', () => {
            this.setAllPitchCheckboxes(true);
        });

        document.getElementById('pitchSelectNoneBtn').addEventListener('click', () => {
            this.setAllPitchCheckboxes(false);
        });

        document.getElementById('pitchSelectOk').addEventListener('click', () => {
            this.selectNotesByPitch();
            this.hidePitchSelectDialog();
        });

        document.getElementById('pitchSelectCancel').addEventListener('click', () => {
            this.hidePitchSelectDialog();
        });

        document.getElementById('velocityRangeOk').addEventListener('click', () => {
            const min = parseInt(document.getElementById('velocityMin').value);
            const max = parseInt(document.getElementById('velocityMax').value);
            this.selectNotesByVelocityRange(min, max);
            this.hideVelocityRangeDialog();
        });

        document.getElementById('velocityRangeCancel').addEventListener('click', () => {
            this.hideVelocityRangeDialog();
        });

        document.getElementById('transposeOk').addEventListener('click', () => {
            const amount = parseInt(document.getElementById('transposeAmount').value);
            this.transposeSelectedNotes(amount);
            this.hideTransposeDialog();
        });

        document.getElementById('transposeCancel').addEventListener('click', () => {
            this.hideTransposeDialog();
        });

        document.getElementById('timeShiftOk').addEventListener('click', () => {
            const amount = parseInt(document.getElementById('timeShiftAmount').value);
            this.timeShiftSelectedNotes(amount);
            this.hideTimeShiftDialog();
        });

        document.getElementById('timeShiftCancel').addEventListener('click', () => {
            this.hideTimeShiftDialog();
        });

        this.mixerToggleBtn.addEventListener('click', () => {
            this.toggleMixer();
        });

        this.mixerResizer.addEventListener('mousedown', (e) => {
            this.startMixerResize(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.mixerFaderDragState) {
                this.onMixerFaderDrag(e);
            }
            if (this.mixerPanDragState) {
                this.onMixerPanDrag(e);
            }
            if (this.mixerResizeState) {
                this.onMixerResize(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.mixerFaderDragState) {
                this.mixerFaderDragState = null;
            }
            if (this.mixerPanDragState) {
                this.mixerPanDragState = null;
            }
            if (this.mixerResizeState) {
                this.mixerResizeState = null;
                this.mixerResizer.classList.remove('dragging');
                this.saveMixerState();
            }
        });
    }

    toggleDropdown(menuId) {
        const selectMenu = document.getElementById('selectMenu');
        const transformMenu = document.getElementById('transformMenu');
        const targetMenu = document.getElementById(menuId);

        if (menuId === 'selectMenu') {
            transformMenu.classList.remove('show');
        } else {
            selectMenu.classList.remove('show');
        }

        targetMenu.classList.toggle('show');
    }

    hideAllDropdowns() {
        document.getElementById('selectMenu').classList.remove('show');
        document.getElementById('transformMenu').classList.remove('show');
    }

    handleSelectAction(action) {
        switch (action) {
            case 'all':
                this.selectAllNotes();
                break;
            case 'bypitch':
                this.showPitchSelectDialog();
                break;
            case 'byvelocity':
                this.showVelocityRangeDialog();
                break;
            case 'invert':
                this.invertSelection();
                break;
        }
    }

    handleTransformAction(action) {
        switch (action) {
            case 'transpose':
                this.showTransposeDialog();
                break;
            case 'timeshift':
                this.showTimeShiftDialog();
                break;
            case 'humanize':
                this.humanizeSelectedNotes();
                break;
        }
    }

    selectAllNotes() {
        this.selectedNotes.clear();
        const activeTrack = this.getActiveTrack();
        if (activeTrack) {
            activeTrack.notes.forEach(note => {
                this.selectedNotes.add(note.id);
            });
        }
        this.render();
        this.renderVelocity();
    }

    invertSelection() {
        const activeTrack = this.getActiveTrack();
        if (!activeTrack) return;

        const newSelection = new Set();
        activeTrack.notes.forEach(note => {
            if (!this.selectedNotes.has(note.id)) {
                newSelection.add(note.id);
            }
        });
        this.selectedNotes = newSelection;
        this.render();
        this.renderVelocity();
    }

    showPitchSelectDialog() {
        this.buildPitchSelectGrid();
        document.getElementById('pitchSelectDialog').classList.add('show');
        this.dialogOpen = true;
    }

    hidePitchSelectDialog() {
        document.getElementById('pitchSelectDialog').classList.remove('show');
        this.dialogOpen = false;
    }

    buildPitchSelectGrid() {
        const grid = document.getElementById('pitchSelectGrid');
        grid.innerHTML = '';

        for (let pitch = MAX_PITCH; pitch >= MIN_PITCH; pitch--) {
            const checkbox = document.createElement('div');
            const isBlack = isBlackKey(pitch);
            checkbox.className = `pitch-checkbox ${isBlack ? 'black-key' : ''}`;
            checkbox.dataset.pitch = pitch;
            checkbox.textContent = getNoteName(pitch);

            checkbox.addEventListener('click', () => {
                checkbox.classList.toggle('checked');
            });

            grid.appendChild(checkbox);
        }
    }

    setAllPitchCheckboxes(checked) {
        const checkboxes = document.querySelectorAll('#pitchSelectGrid .pitch-checkbox');
        checkboxes.forEach(cb => {
            if (checked) {
                cb.classList.add('checked');
            } else {
                cb.classList.remove('checked');
            }
        });
    }

    selectNotesByPitch() {
        const selectedPitches = new Set();
        const checkboxes = document.querySelectorAll('#pitchSelectGrid .pitch-checkbox.checked');
        checkboxes.forEach(cb => {
            selectedPitches.add(parseInt(cb.dataset.pitch));
        });

        this.selectedNotes.clear();
        const activeTrack = this.getActiveTrack();
        if (activeTrack) {
            activeTrack.notes.forEach(note => {
                if (selectedPitches.has(note.pitch)) {
                    this.selectedNotes.add(note.id);
                }
            });
        }
        this.render();
        this.renderVelocity();
    }

    showVelocityRangeDialog() {
        document.getElementById('velocityMin').value = 1;
        document.getElementById('velocityMax').value = 127;
        document.getElementById('velocityRangeDialog').classList.add('show');
        this.dialogOpen = true;
    }

    hideVelocityRangeDialog() {
        document.getElementById('velocityRangeDialog').classList.remove('show');
        this.dialogOpen = false;
    }

    selectNotesByVelocityRange(min, max) {
        if (isNaN(min) || isNaN(max)) return;
        min = Math.max(1, Math.min(127, min));
        max = Math.max(1, Math.min(127, max));
        if (min > max) [min, max] = [max, min];

        this.selectedNotes.clear();
        const activeTrack = this.getActiveTrack();
        if (activeTrack) {
            activeTrack.notes.forEach(note => {
                if (note.velocity >= min && note.velocity <= max) {
                    this.selectedNotes.add(note.id);
                }
            });
        }
        this.render();
        this.renderVelocity();
    }

    showTransposeDialog() {
        document.getElementById('transposeAmount').value = 0;
        document.getElementById('transposeDialog').classList.add('show');
        this.dialogOpen = true;
        setTimeout(() => {
            const input = document.getElementById('transposeAmount');
            input.focus();
            input.select();
        }, 50);
    }

    hideTransposeDialog() {
        document.getElementById('transposeDialog').classList.remove('show');
        this.dialogOpen = false;
    }

    transposeSelectedNotes(semitones) {
        if (this.selectedNotes.size === 0 || isNaN(semitones) || semitones === 0) return;

        const transposedNotes = [];
        this.selectedNotes.forEach(noteId => {
            const note = this.findNoteById(noteId);
            if (note) {
                const oldPitch = note.pitch;
                const newPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, note.pitch + semitones));
                if (oldPitch !== newPitch) {
                    transposedNotes.push({
                        noteId: note.id,
                        trackId: note.track,
                        oldPitch,
                        newPitch
                    });
                    note.pitch = newPitch;
                }
            }
        });

        if (transposedNotes.length === 0) return;

        this.executeCommand({
            type: 'transposeNotes',
            transposedNotes,
            undo: () => {
                transposedNotes.forEach(({ noteId, trackId, oldPitch }) => {
                    const track = this.tracks.find(t => t.id === trackId);
                    if (!track) return;
                    const note = track.notes.find(n => n.id === noteId);
                    if (note) note.pitch = oldPitch;
                });
                this.render();
                this.renderVelocity();
            },
            redo: () => {
                transposedNotes.forEach(({ noteId, trackId, newPitch }) => {
                    const track = this.tracks.find(t => t.id === trackId);
                    if (!track) return;
                    const note = track.notes.find(n => n.id === noteId);
                    if (note) note.pitch = newPitch;
                });
                this.render();
                this.renderVelocity();
            }
        });

        this.render();
        this.renderVelocity();
    }

    showTimeShiftDialog() {
        document.getElementById('timeShiftAmount').value = 0;
        document.getElementById('timeShiftDialog').classList.add('show');
        this.dialogOpen = true;
        setTimeout(() => {
            const input = document.getElementById('timeShiftAmount');
            input.focus();
            input.select();
        }, 50);
    }

    hideTimeShiftDialog() {
        document.getElementById('timeShiftDialog').classList.remove('show');
        this.dialogOpen = false;
    }

    timeShiftSelectedNotes(ticks) {
        if (this.selectedNotes.size === 0 || isNaN(ticks) || ticks === 0) return;

        const selectedNoteObjs = [];
        this.selectedNotes.forEach(noteId => {
            const note = this.findNoteById(noteId);
            if (note) selectedNoteObjs.push(note);
        });

        if (selectedNoteObjs.length === 0) return;

        let minShiftedTick = Infinity;
        selectedNoteObjs.forEach(note => {
            const shifted = note.startTick + ticks;
            if (shifted < minShiftedTick) minShiftedTick = shifted;
        });

        const extraShift = minShiftedTick < 0 ? -minShiftedTick : 0;
        const actualShift = ticks + extraShift;

        const shiftedNotes = [];
        selectedNoteObjs.forEach(note => {
            const oldTick = note.startTick;
            const newTick = note.startTick + actualShift;
            if (oldTick !== newTick) {
                shiftedNotes.push({
                    noteId: note.id,
                    trackId: note.track,
                    oldTick,
                    newTick
                });
                note.startTick = newTick;
            }
        });

        if (shiftedNotes.length === 0) return;

        this.executeCommand({
            type: 'timeShiftNotes',
            shiftedNotes,
            undo: () => {
                shiftedNotes.forEach(({ noteId, trackId, oldTick }) => {
                    const track = this.tracks.find(t => t.id === trackId);
                    if (!track) return;
                    const note = track.notes.find(n => n.id === noteId);
                    if (note) note.startTick = oldTick;
                });
                this.render();
                this.renderVelocity();
            },
            redo: () => {
                shiftedNotes.forEach(({ noteId, trackId, newTick }) => {
                    const track = this.tracks.find(t => t.id === trackId);
                    if (!track) return;
                    const note = track.notes.find(n => n.id === noteId);
                    if (note) note.startTick = newTick;
                });
                this.render();
                this.renderVelocity();
            }
        });

        this.render();
        this.renderVelocity();
    }

    humanizeSelectedNotes() {
        if (this.selectedNotes.size === 0) return;

        const humanizedNotes = [];
        this.selectedNotes.forEach(noteId => {
            const note = this.findNoteById(noteId);
            if (note) {
                const oldTick = note.startTick;
                const oldVelocity = note.velocity;

                const tickOffset = Math.floor(Math.random() * 3) - 1;
                const velocityOffset = Math.floor(Math.random() * 21) - 10;

                const newTick = Math.max(0, note.startTick + tickOffset);
                const newVelocity = Math.max(1, Math.min(127, note.velocity + velocityOffset));

                if (oldTick !== newTick || oldVelocity !== newVelocity) {
                    humanizedNotes.push({
                        noteId: note.id,
                        trackId: note.track,
                        oldTick,
                        oldVelocity,
                        newTick,
                        newVelocity
                    });
                    note.startTick = newTick;
                    note.velocity = newVelocity;
                }
            }
        });

        if (humanizedNotes.length === 0) return;

        this.executeCommand({
            type: 'humanizeNotes',
            humanizedNotes,
            undo: () => {
                humanizedNotes.forEach(({ noteId, trackId, oldTick, oldVelocity }) => {
                    const track = this.tracks.find(t => t.id === trackId);
                    if (!track) return;
                    const note = track.notes.find(n => n.id === noteId);
                    if (note) {
                        note.startTick = oldTick;
                        note.velocity = oldVelocity;
                    }
                });
                this.render();
                this.renderVelocity();
            },
            redo: () => {
                humanizedNotes.forEach(({ noteId, trackId, newTick, newVelocity }) => {
                    const track = this.tracks.find(t => t.id === trackId);
                    if (!track) return;
                    const note = track.notes.find(n => n.id === noteId);
                    if (note) {
                        note.startTick = newTick;
                        note.velocity = newVelocity;
                    }
                });
                this.render();
                this.renderVelocity();
            }
        });

        this.render();
        this.renderVelocity();
    }
    
    resizeCanvas() {
        const containerRect = this.gridContainer.getBoundingClientRect();
        const automationRect = this.automationCanvasContainer.getBoundingClientRect();
        
        let maxTick = 64;
        this.tracks.forEach(track => {
            track.notes.forEach(note => {
                const end = note.startTick + note.durationTicks;
                if (end > maxTick) maxTick = end;
            });
            track.automationChannels.forEach(channel => {
                channel.points.forEach(point => {
                    if (point.tick > maxTick) maxTick = point.tick;
                });
            });
        });
        
        const minWidth = maxTick * this.cellWidth + 200;
        this.canvas.width = Math.max(containerRect.width - 20, minWidth, 3000);
        this.canvas.height = TOTAL_PITCHES * this.cellHeight;
        
        this.rulerCanvas.width = this.canvas.width;
        this.rulerCanvas.height = 30;
        
        this.automationCanvas.width = this.canvas.width;
        this.automationCanvas.height = Math.max(automationRect.height, 120);
        
        this.resizeVelocityCanvas();
        this.resizeChordTrackCanvas();
        
        this.render();
        this.renderRuler();
        this.renderAutomation();
        this.renderVelocity();
        this.renderChordTrack();
    }
    
    resizeVelocityCanvas() {
        if (!this.velocityCanvasContainer) return;
        const velocityRect = this.velocityCanvasContainer.getBoundingClientRect();
        
        let maxTick = 64;
        this.tracks.forEach(track => {
            track.notes.forEach(note => {
                const end = note.startTick + note.durationTicks;
                if (end > maxTick) maxTick = end;
            });
        });
        
        const minWidth = maxTick * this.cellWidth + 200;
        this.velocityCanvas.width = Math.max(velocityRect.width, minWidth, 3000);
        this.velocityCanvas.height = Math.max(velocityRect.height, 200);
    }

    resizeChordTrackCanvas() {
        if (!this.chordTrackContainer) return;

        let maxTick = 64;
        this.tracks.forEach(track => {
            track.notes.forEach(note => {
                const end = note.startTick + note.durationTicks;
                if (end > maxTick) maxTick = end;
            });
        });

        const minWidth = maxTick * this.cellWidth + 200;
        this.chordTrackCanvas.width = Math.max(this.chordTrackContainer.clientWidth, minWidth, 3000);
        this.chordTrackCanvas.height = 30;
    }

    getPitchesAtBeat(beatTick) {
        const pitches = [];
        const notes = [];
        this.tracks.forEach(track => {
            track.notes.forEach(note => {
                if (note.startTick <= beatTick && note.startTick + note.durationTicks > beatTick) {
                    pitches.push(note.pitch);
                    notes.push(note);
                }
            });
        });
        return { pitches, notes };
    }

    analyzeAllChords() {
        const results = new Map();
        let maxTick = 0;
        this.tracks.forEach(track => {
            track.notes.forEach(note => {
                const end = note.startTick + note.durationTicks;
                if (end > maxTick) maxTick = end;
            });
        });

        for (let tick = 0; tick <= maxTick; tick += TICKS_PER_BEAT) {
            const { pitches, notes } = this.getPitchesAtBeat(tick);
            const chord = detectChord(pitches);
            results.set(tick, { chord, notes, pitches });
        }
        return results;
    }

    renderChordTrack() {
        if (!this.chordTrackCtx || !this.chordTrackCanvas) return;
        const ctx = this.chordTrackCtx;
        const width = this.chordTrackCanvas.width;
        const height = this.chordTrackCanvas.height;
        if (width === 0 || height === 0) return;

        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(0, 0, width, height);

        const totalTicks = Math.ceil(width / this.cellWidth);
        for (let tick = 0; tick <= totalTicks; tick += TICKS_PER_BEAT) {
            const x = tick * this.cellWidth;
            const isBar = tick % TICKS_PER_BAR === 0;

            ctx.strokeStyle = isBar ? '#555' : '#3d3d3d';
            ctx.lineWidth = isBar ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        const chordData = this.analyzeAllChords();
        this.chordData = chordData;

        chordData.forEach((data, beatTick) => {
            const x = beatTick * this.cellWidth;
            const cellW = TICKS_PER_BEAT * this.cellWidth;
            const isHighlighted = this.highlightedChordBeat === beatTick;

            if (isHighlighted) {
                ctx.fillStyle = 'rgba(74, 158, 255, 0.3)';
                ctx.fillRect(x, 0, cellW, height);
            }

            let label = '?';
            let textColor = '#888';
            if (data.chord) {
                label = data.chord.fullName;
                textColor = data.chord.isInversion ? '#ffd93d' : '#6bcb77';
            }

            if (isHighlighted) {
                textColor = '#fff';
            }

            ctx.fillStyle = textColor;
            ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textWidth = ctx.measureText(label).width;
            const maxWidth = cellW - 8;
            if (textWidth > maxWidth) {
                const fontSize = Math.max(8, 12 * (maxWidth / textWidth));
                ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
            }

            ctx.fillText(label, x + cellW / 2, height / 2);
        });

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

    onChordTrackClick(e) {
        const rect = this.chordTrackCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left + this.chordTrackContainer.scrollLeft;
        const beatTick = Math.floor(x / (this.cellWidth * TICKS_PER_BEAT)) * TICKS_PER_BEAT;

        const isCurrentlyHighlighted = this.highlightedChordBeat === beatTick;

        if (isCurrentlyHighlighted) {
            this.clearChordHighlight();
        } else {
            this.highlightedChordBeat = beatTick;
            this.highlightedNoteIds = new Set();
            const { notes } = this.getPitchesAtBeat(beatTick);
            notes.forEach(note => this.highlightedNoteIds.add(note.id));
        }

        this.renderChordTrack();
        this.render();
    }

    exportChordProgression() {
        let maxTick = 0;
        this.tracks.forEach(track => {
            track.notes.forEach(note => {
                const end = note.startTick + note.durationTicks;
                if (end > maxTick) maxTick = end;
            });
        });

        const totalBars = Math.ceil(maxTick / TICKS_PER_BAR);
        const lines = [];

        for (let bar = 0; bar < totalBars; bar++) {
            const barChords = [];
            for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
                const tick = bar * TICKS_PER_BAR + beat * TICKS_PER_BEAT;
                const { pitches } = this.getPitchesAtBeat(tick);
                const chord = detectChord(pitches);
                barChords.push(chord ? chord.fullName : '?');
            }
            lines.push(`Bar ${bar + 1}: ${barChords.join(' ')}`);
        }

        const text = lines.join('\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chord-progression.txt';
        a.click();
        URL.revokeObjectURL(url);
    }

    refreshChordHighlight() {
        if (this.highlightedChordBeat === null) return;

        const { notes } = this.getPitchesAtBeat(this.highlightedChordBeat);
        this.highlightedNoteIds = new Set(notes.map(n => n.id));
    }

    clearChordHighlight() {
        this.highlightedChordBeat = null;
        this.highlightedNoteIds = new Set();
    }
    
    render() {
        this.refreshChordHighlight();

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
        
        if (this.isRecording) {
            const activeTrack = this.getActiveTrack();
            const trackColor = activeTrack ? activeTrack.color : '#4a9eff';
            
            this.recordingActiveNotes.forEach((noteData, pitch) => {
                const currentTick = this.playTick;
                let startTick = noteData.startTick;
                let durationTicks = currentTick - startTick;
                
                if (this.quantizeUnit > 0) {
                    startTick = this.quantizeTick(startTick);
                    const quantizedEnd = this.quantizeTick(currentTick);
                    durationTicks = Math.max(this.quantizeUnit, quantizedEnd - startTick);
                }
                
                startTick = Math.max(0, startTick);
                durationTicks = Math.max(0.5, durationTicks);
                
                const x = startTick * this.cellWidth;
                const y = (MAX_PITCH - pitch) * this.cellHeight;
                const w = durationTicks * this.cellWidth;
                const h = this.cellHeight;
                
                ctx.fillStyle = 'rgba(255, 107, 107, 0.4)';
                this.drawRoundRect(x + 2, y + 2, w - 4, h - 4, 3);
                ctx.fill();
                
                ctx.strokeStyle = '#ff6b6b';
                ctx.lineWidth = 1;
                this.drawRoundRect(x + 2, y + 2, w - 4, h - 4, 3);
                ctx.stroke();
            });
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
        
        this.renderAutomation();
        this.renderChordTrack();
    }
    
    renderNote(note, color, isActive) {
        const x = note.startTick * this.cellWidth;
        const y = (MAX_PITCH - note.pitch) * this.cellHeight;
        const w = note.durationTicks * this.cellWidth;
        const h = this.cellHeight;
        
        const isHighlighted = this.highlightedNoteIds.has(note.id);
        const alpha = isActive ? 1 : 0.4;
        const brightness = 0.4 + (note.velocity / 127) * 0.6;
        const noteColor = this.adjustColorBrightness(color, brightness);
        
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = noteColor;
        this.drawRoundRect(x + 2, y + 2, w - 4, h - 4, 3);
        this.ctx.fill();

        if (isHighlighted) {
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 3;
            this.drawRoundRect(x + 1, y + 1, w - 2, h - 2, 4);
            this.ctx.stroke();
            this.ctx.lineWidth = 1;
        }
        
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
                    <input type="range" class="track-volume" min="0" max="127" value="${track.volume}" data-track-id="${track.id}">
                    <span class="track-volume-label">${track.volume}</span>
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
                this.activeChannelId = track.activeChannelId;
                this.selectedNotes.clear();
                this.renderTrackList();
                this.renderChannelSelect();
                this.render();
                this.renderVelocity();
            });
            
            item.querySelector('.track-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeTrack(track.id);
            });
            
            item.querySelector('.track-volume').addEventListener('input', (e) => {
                track.volume = parseInt(e.target.value);
                item.querySelector('.track-volume-label').textContent = `${track.volume}`;
                this.updateAutomationPointIfExists(track, 'volume', track.volume);
                this.renderMixer();
            });
            
            item.querySelector('.track-mute').addEventListener('click', (e) => {
                e.stopPropagation();
                track.muted = !track.muted;
                this.renderTrackList();
                this.renderMixer();
            });
            
            item.querySelector('.track-solo').addEventListener('click', (e) => {
                e.stopPropagation();
                track.solo = !track.solo;
                this.renderTrackList();
                this.renderMixer();
            });
            
            trackList.appendChild(item);
        });

        this.renderMixer();
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
        const startTick = this.snapTick(this.pixelToTick(pos.x));
        const snapUnit = Math.max(1, this.getSnapUnit());
        
        if (pitch >= MIN_PITCH && pitch <= MAX_PITCH && startTick >= 0) {
            this.dragState = {
                type: 'create',
                pitch,
                startTick,
                durationTicks: snapUnit
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
            const snapUnit = Math.max(1, this.getSnapUnit());
            const currentTick = this.snapTick(this.pixelToTick(pos.x));
            let rawDuration = currentTick - this.dragState.startTick + snapUnit;
            if (rawDuration < snapUnit) rawDuration = snapUnit;
            const snappedDuration = Math.max(snapUnit, Math.round(rawDuration / snapUnit) * snapUnit);
            this.dragState.durationTicks = snappedDuration;
            this.render();
        } else if (this.dragState.type === 'move') {
            const deltaTick = this.pixelToTick(pos.x) - this.pixelToTick(this.dragState.startX);
            const deltaPitch = this.pixelToPitch(this.dragState.startY) - this.pixelToPitch(pos.y);
            
            this.dragState.notePositions.forEach(({ note, startTick, startPitch }) => {
                const newTick = this.snapTick(startTick + deltaTick);
                note.startTick = Math.max(0, newTick);
                note.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, startPitch + deltaPitch));
            });
            this.render();
        } else if (this.dragState.type === 'resize') {
            const snapUnit = Math.max(1, this.getSnapUnit());
            const endTick = this.snapTick(this.pixelToTick(pos.x));
            let rawDuration = endTick - this.dragState.note.startTick + snapUnit;
            if (rawDuration < snapUnit) rawDuration = snapUnit;
            const snappedDuration = Math.max(snapUnit, Math.round(rawDuration / snapUnit) * snapUnit);
            this.dragState.note.durationTicks = snappedDuration;
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
                noteId: note.id,
                trackId: note.track,
                oldTick: startTick,
                oldPitch: startPitch,
                newTick: note.startTick,
                newPitch: note.pitch
            }));
            
            this.executeCommand({
                type: 'moveNotes',
                movedNotes,
                undo: () => {
                    movedNotes.forEach(({ noteId, trackId, oldTick, oldPitch }) => {
                        const track = this.tracks.find(t => t.id === trackId);
                        if (!track) return;
                        const note = track.notes.find(n => n.id === noteId);
                        if (!note) return;
                        note.startTick = oldTick;
                        note.pitch = oldPitch;
                    });
                    this.render();
                    this.renderVelocity();
                },
                redo: () => {
                    movedNotes.forEach(({ noteId, trackId, newTick, newPitch }) => {
                        const track = this.tracks.find(t => t.id === trackId);
                        if (!track) return;
                        const note = track.notes.find(n => n.id === noteId);
                        if (!note) return;
                        note.startTick = newTick;
                        note.pitch = newPitch;
                    });
                    this.render();
                    this.renderVelocity();
                }
            });
        } else if (this.dragState.type === 'resize') {
            const note = this.dragState.note;
            const noteId = note.id;
            const trackId = note.track;
            const oldDuration = this.dragState.startDuration;
            const newDuration = note.durationTicks;
            
            this.executeCommand({
                type: 'resizeNote',
                noteId,
                trackId,
                oldDuration,
                newDuration,
                undo: () => {
                    const track = this.tracks.find(t => t.id === trackId);
                    if (!track) return;
                    const n = track.notes.find(x => x.id === noteId);
                    if (!n) return;
                    n.durationTicks = oldDuration;
                    this.render();
                    this.renderVelocity();
                },
                redo: () => {
                    const track = this.tracks.find(t => t.id === trackId);
                    if (!track) return;
                    const n = track.notes.find(x => x.id === noteId);
                    if (!n) return;
                    n.durationTicks = newDuration;
                    this.render();
                    this.renderVelocity();
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
        this.dialogOpen = true;
    }
    
    hideVelocityDialog() {
        document.getElementById('velocityDialog').classList.remove('show');
        this.dialogOpen = false;
    }
    
    setSelectedNotesVelocity(velocity) {
        if (this.selectedNotes.size === 0) return;
        
        const velocityChanges = [];
        this.selectedNotes.forEach(noteId => {
            const note = this.findNoteById(noteId);
            if (note) {
                velocityChanges.push({
                    noteId: note.id,
                    trackId: note.track,
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
                velocityChanges.forEach(({ noteId, trackId, oldVelocity }) => {
                    const track = this.tracks.find(t => t.id === trackId);
                    if (!track) return;
                    const n = track.notes.find(x => x.id === noteId);
                    if (!n) return;
                    n.velocity = oldVelocity;
                });
                this.render();
                this.renderVelocity();
            },
            redo: () => {
                velocityChanges.forEach(({ noteId, trackId, newVelocity }) => {
                    const track = this.tracks.find(t => t.id === trackId);
                    if (!track) return;
                    const n = track.notes.find(x => x.id === noteId);
                    if (!n) return;
                    n.velocity = newVelocity;
                });
                this.render();
                this.renderVelocity();
            }
        });
        
        this.render();
        this.renderVelocity();
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
                    noteData: JSON.parse(JSON.stringify(note)),
                    noteId: note.id,
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
                deletedNotes.forEach(({ noteData, trackId }) => {
                    const track = this.tracks.find(t => t.id === trackId);
                    if (!track) return;
                    track.notes.push(JSON.parse(JSON.stringify(noteData)));
                });
                this.render();
                this.renderVelocity();
            },
            redo: () => {
                deletedNotes.forEach(({ noteId, trackId }) => {
                    const track = this.tracks.find(t => t.id === trackId);
                    if (!track) return;
                    const idx = track.notes.findIndex(n => n.id === noteId);
                    if (idx !== -1) track.notes.splice(idx, 1);
                });
                this.selectedNotes.clear();
                this.render();
                this.renderVelocity();
            }
        });
        
        this.selectedNotes.clear();
        this.render();
    }
    
    splitSelectedNotes() {
        if (this.selectedNotes.size === 0) return;
        
        const snapUnit = Math.max(1, this.getSnapUnit());
        let splitTick = this.playTick;
        splitTick = this.snapTick(splitTick);
        
        const splits = [];
        
        this.selectedNotes.forEach(noteId => {
            const note = this.findNoteById(noteId);
            if (!note) return;
            
            const startTick = note.startTick;
            const endTick = note.startTick + note.durationTicks;
            
            if (note.durationTicks < 2 * snapUnit) return;
            if (splitTick <= startTick || splitTick >= endTick) return;
            
            let leftDuration = splitTick - startTick;
            let rightDuration = endTick - splitTick;
            
            if (this.snapEnabled) {
                leftDuration = Math.round(leftDuration / snapUnit) * snapUnit;
                rightDuration = Math.round(rightDuration / snapUnit) * snapUnit;
                
                if (leftDuration < snapUnit) {
                    leftDuration = snapUnit;
                    rightDuration = note.durationTicks - snapUnit;
                } else if (rightDuration < snapUnit) {
                    rightDuration = snapUnit;
                    leftDuration = note.durationTicks - snapUnit;
                }
            }
            
            if (leftDuration < 1 || rightDuration < 1) return;
            
            const actualSplitTick = startTick + leftDuration;
            if (actualSplitTick <= startTick || actualSplitTick >= endTick) return;
            
            const track = this.tracks.find(t => t.id === note.track);
            const idx = track.notes.findIndex(n => n.id === noteId);
            if (idx === -1) return;
            
            const rightNote = {
                id: generateId(),
                track: note.track,
                pitch: note.pitch,
                startTick: actualSplitTick,
                durationTicks: rightDuration,
                velocity: note.velocity
            };
            
            splits.push({
                trackId: note.track,
                originalNoteId: note.id,
                originalNoteData: JSON.parse(JSON.stringify(note)),
                originalIndex: idx,
                leftDuration,
                rightNote,
                rightNoteData: JSON.parse(JSON.stringify(rightNote))
            });
        });
        
        if (splits.length === 0) return;
        
        splits.forEach(split => {
            const track = this.tracks.find(t => t.id === split.trackId);
            const note = track.notes.find(n => n.id === split.originalNoteId);
            if (note) {
                note.durationTicks = split.leftDuration;
            }
            track.notes.push(split.rightNote);
        });
        
        this.executeCommand({
            type: 'splitNotes',
            splits,
            undo: () => {
                splits.forEach(split => {
                    const track = this.tracks.find(t => t.id === split.trackId);
                    if (!track) return;
                    
                    const rightIdx = track.notes.findIndex(n => n.id === split.rightNote.id);
                    if (rightIdx !== -1) track.notes.splice(rightIdx, 1);
                    
                    const note = track.notes.find(n => n.id === split.originalNoteId);
                    if (note) {
                        note.durationTicks = split.originalNoteData.durationTicks;
                    }
                    
                    this.selectedNotes.delete(split.rightNote.id);
                });
                this.selectedNotes.clear();
                splits.forEach(split => this.selectedNotes.add(split.originalNoteId));
                this.render();
                this.renderVelocity();
            },
            redo: () => {
                splits.forEach(split => {
                    const track = this.tracks.find(t => t.id === split.trackId);
                    if (!track) return;
                    
                    const note = track.notes.find(n => n.id === split.originalNoteId);
                    if (note) {
                        note.durationTicks = split.leftDuration;
                    }
                    
                    track.notes.push(JSON.parse(JSON.stringify(split.rightNoteData)));
                });
                this.selectedNotes.clear();
                splits.forEach(split => {
                    this.selectedNotes.add(split.originalNoteId);
                    this.selectedNotes.add(split.rightNote.id);
                });
                this.render();
                this.renderVelocity();
            }
        });
        
        this.selectedNotes.clear();
        splits.forEach(split => {
            this.selectedNotes.add(split.originalNoteId);
            this.selectedNotes.add(split.rightNote.id);
        });
        this.render();
        this.renderVelocity();
    }
    
    mergeSelectedNotes() {
        if (this.selectedNotes.size < 2) return;
        
        const activeTrack = this.getActiveTrack();
        if (!activeTrack) return;
        
        const selectedNoteObjs = [];
        this.selectedNotes.forEach(noteId => {
            const note = this.findNoteById(noteId);
            if (note && note.track === activeTrack.id) {
                selectedNoteObjs.push(note);
            }
        });
        
        if (selectedNoteObjs.length < 2) return;
        
        const pitch = selectedNoteObjs[0].pitch;
        const allSamePitch = selectedNoteObjs.every(n => n.pitch === pitch);
        if (!allSamePitch) return;
        
        selectedNoteObjs.sort((a, b) => a.startTick - b.startTick);
        
        let canMerge = true;
        for (let i = 0; i < selectedNoteObjs.length - 1; i++) {
            const curr = selectedNoteObjs[i];
            const next = selectedNoteObjs[i + 1];
            if (curr.startTick + curr.durationTicks !== next.startTick) {
                canMerge = false;
                break;
            }
        }
        if (!canMerge) return;
        
        const earliestStart = selectedNoteObjs[0].startTick;
        const latestEnd = selectedNoteObjs[selectedNoteObjs.length - 1].startTick + 
                        selectedNoteObjs[selectedNoteObjs.length - 1].durationTicks;
        const totalVelocity = selectedNoteObjs.reduce((sum, n) => sum + n.velocity, 0);
        const avgVelocity = Math.round(totalVelocity / selectedNoteObjs.length);
        
        const mergedNote = {
            id: generateId(),
            track: activeTrack.id,
            pitch,
            startTick: earliestStart,
            durationTicks: latestEnd - earliestStart,
            velocity: avgVelocity
        };
        
        const mergedData = {
            trackId: activeTrack.id,
            mergedNote,
            mergedNoteData: JSON.parse(JSON.stringify(mergedNote)),
            originalNotes: selectedNoteObjs.map(n => ({
                noteData: JSON.parse(JSON.stringify(n)),
                noteId: n.id
            }))
        };
        
        mergedData.originalNotes.forEach(({ noteId }) => {
            const idx = activeTrack.notes.findIndex(n => n.id === noteId);
            if (idx !== -1) activeTrack.notes.splice(idx, 1);
        });
        activeTrack.notes.push(mergedNote);
        
        this.executeCommand({
            type: 'mergeNotes',
            mergedData,
            undo: () => {
                const track = this.tracks.find(t => t.id === mergedData.trackId);
                if (!track) return;
                
                const mergedIdx = track.notes.findIndex(n => n.id === mergedData.mergedNote.id);
                if (mergedIdx !== -1) track.notes.splice(mergedIdx, 1);
                
                mergedData.originalNotes.forEach(({ noteData }) => {
                    track.notes.push(JSON.parse(JSON.stringify(noteData)));
                });
                
                this.selectedNotes.clear();
                mergedData.originalNotes.forEach(({ noteId }) => this.selectedNotes.add(noteId));
                this.render();
                this.renderVelocity();
            },
            redo: () => {
                const track = this.tracks.find(t => t.id === mergedData.trackId);
                if (!track) return;
                
                mergedData.originalNotes.forEach(({ noteId }) => {
                    const idx = track.notes.findIndex(n => n.id === noteId);
                    if (idx !== -1) track.notes.splice(idx, 1);
                });
                
                track.notes.push(JSON.parse(JSON.stringify(mergedData.mergedNoteData)));
                
                this.selectedNotes.clear();
                this.selectedNotes.add(mergedData.mergedNote.id);
                this.render();
                this.renderVelocity();
            }
        });
        
        this.selectedNotes.clear();
        this.selectedNotes.add(mergedNote.id);
        this.render();
        this.renderVelocity();
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
            this.automationCanvasContainer.scrollLeft += e.deltaY;
            this.chordTrackContainer.scrollLeft += e.deltaY;
        }
    }
    
    onRulerClick(e) {
        const rect = this.rulerCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left + this.scrollX;
        this.playTick = Math.max(0, this.pixelToTick(x));
        this.render();
    }
    
    onKeyDown(e) {
        if (this.dialogOpen) return;
        
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
        
        const key = e.key.toLowerCase();
        
        if (this.isRecording) {
            if (key === 'z') {
                e.preventDefault();
                this.keyboardOctave = Math.max(-2, this.keyboardOctave - 1);
                return;
            }
            if (key === 'x') {
                e.preventDefault();
                this.keyboardOctave = Math.min(3, this.keyboardOctave + 1);
                return;
            }
            
            const pitch = this.computerKeyToPitch(key);
            if (pitch !== null && !this.pressedComputerKeys.has(key)) {
                e.preventDefault();
                this.pressedComputerKeys.add(key);
                this.startRecordingNote(pitch);
                return;
            }
        }
        
        if (e.key === ' ') {
            e.preventDefault();
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.toggleRecording();
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
        } else if (!this.isRecording && e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.splitSelectedNotes();
        } else if (!this.isRecording && e.key.toLowerCase() === 'j' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.mergeSelectedNotes();
        }
    }
    
    onKeyUp(e) {
        const key = e.key.toLowerCase();
        
        if (this.isRecording && this.pressedComputerKeys.has(key)) {
            this.pressedComputerKeys.delete(key);
            const pitch = this.computerKeyToPitch(key);
            if (pitch !== null) {
                this.stopRecordingNote(pitch);
            }
        }
    }
    
    computerKeyToPitch(key) {
        if (KEYBOARD_WHITE_KEYS.hasOwnProperty(key)) {
            const idx = KEYBOARD_WHITE_KEYS[key];
            return BASE_OCTAVE_PITCH + this.keyboardOctave * 12 + WHITE_PITCH_OFFSETS[idx];
        }
        if (KEYBOARD_BLACK_KEYS.hasOwnProperty(key)) {
            const idx = KEYBOARD_BLACK_KEYS[key];
            return BASE_OCTAVE_PITCH + this.keyboardOctave * 12 + BLACK_PITCH_OFFSETS[idx];
        }
        return null;
    }
    
    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }
    
    startRecording() {
        this.initAudio();
        this.isRecording = true;
        this.recordingStartTick = this.playTick;
        this.recordingActiveNotes.clear();
        this.recordingCompletedNotes = [];
        this.lastMetronomeTick = -1;
        
        document.getElementById('recordBtn').classList.add('active');
        
        if (!this.isPlaying) {
            this.play(true);
        }
    }
    
    stopRecording() {
        if (!this.isRecording) return;
        
        const activePitches = Array.from(this.recordingActiveNotes.keys());
        activePitches.forEach(pitch => {
            this.stopRecordingNote(pitch);
        });
        
        this.isRecording = false;
        document.getElementById('recordBtn').classList.remove('active');
        
        this.pressedComputerKeys.clear();
        
        document.querySelectorAll('.piano-key.recording-active').forEach(key => {
            key.classList.remove('recording-active');
        });
        
        if (this.recordingCompletedNotes.length > 0) {
            this.commitRecordedNotes();
        }
        
        if (this.isPlaying) {
            this.pause();
        }
    }
    
    stopRecordingOrPlayback() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.stop();
        }
    }
    
    quantizeTick(tick) {
        if (this.quantizeUnit <= 0) return tick;
        return Math.round(tick / this.quantizeUnit) * this.quantizeUnit;
    }
    
    getSnapUnit() {
        if (this.cellWidth >= 80) return 2;
        if (this.cellWidth >= 40) return 1;
        if (this.cellWidth >= 20) return 1;
        if (this.cellWidth >= 10) return 2;
        return 4;
    }
    
    snapTick(tick) {
        if (!this.snapEnabled) return tick;
        const unit = this.getSnapUnit();
        return Math.round(tick / unit) * unit;
    }
    
    toggleSnap() {
        this.snapEnabled = !this.snapEnabled;
        const btn = document.getElementById('snapBtn');
        const stateLabel = btn.querySelector('.snap-state');
        if (this.snapEnabled) {
            btn.classList.add('active');
            stateLabel.textContent = 'On';
        } else {
            btn.classList.remove('active');
            stateLabel.textContent = 'Off';
        }
    }
    
    startRecordingNote(pitch) {
        if (pitch < MIN_PITCH || pitch > MAX_PITCH) return;
        if (this.recordingActiveNotes.has(pitch)) return;
        
        const startTick = this.playTick;
        const oscId = this.playNote(pitch, 100);
        
        this.recordingActiveNotes.set(pitch, {
            startTick,
            oscId
        });
        
        const key = document.querySelector(`.piano-key[data-pitch="${pitch}"]`);
        if (key) key.classList.add('recording-active');
    }
    
    stopRecordingNote(pitch) {
        const activeNote = this.recordingActiveNotes.get(pitch);
        if (!activeNote) return;
        
        const endTick = this.playTick;
        this.stopNote(activeNote.oscId);
        this.recordingActiveNotes.delete(pitch);
        
        let startTick = this.quantizeTick(activeNote.startTick);
        let durationTicks = Math.max(this.quantizeUnit || 1, this.quantizeTick(endTick) - startTick);
        
        startTick = Math.max(0, startTick);
        
        const note = {
            id: generateId(),
            track: this.activeTrackId,
            pitch,
            startTick,
            durationTicks,
            velocity: 100
        };
        
        this.recordingCompletedNotes.push(note);
        
        const key = document.querySelector(`.piano-key[data-pitch="${pitch}"]`);
        if (key) key.classList.remove('recording-active');
    }
    
    commitRecordedNotes() {
        const notes = this.recordingCompletedNotes;
        const trackId = this.activeTrackId;
        
        const track = this.tracks.find(t => t.id === trackId);
        notes.forEach(note => track.notes.push(note));
        
        this.executeCommand({
            type: 'recordNotes',
            notes,
            trackId,
            undo: () => {
                const t = this.tracks.find(tr => tr.id === trackId);
                notes.forEach(note => {
                    const idx = t.notes.findIndex(n => n.id === note.id);
                    if (idx !== -1) t.notes.splice(idx, 1);
                });
                this.selectedNotes.clear();
                this.render();
            },
            redo: () => {
                const t = this.tracks.find(tr => tr.id === trackId);
                notes.forEach(note => t.notes.push(note));
                this.selectedNotes.clear();
                notes.forEach(note => this.selectedNotes.add(note.id));
                this.render();
            }
        });
        
        this.selectedNotes.clear();
        notes.forEach(note => this.selectedNotes.add(note.id));
        this.recordingCompletedNotes = [];
        this.render();
    }
    
    toggleMetronome() {
        this.metronomeEnabled = !this.metronomeEnabled;
        const btn = document.getElementById('metronomeBtn');
        const stateLabel = btn.querySelector('.metronome-state');
        if (this.metronomeEnabled) {
            btn.classList.add('active');
            stateLabel.textContent = 'On';
        } else {
            btn.classList.remove('active');
            stateLabel.textContent = 'Off';
        }
    }
    
    playMetronomeClick(isStrong) {
        this.initAudio();
        const now = this.audioContext.currentTime;
        const duration = 0.1;
        const freq = isStrong ? 1000 : 700;
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'square';
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc.start(now);
        osc.stop(now + duration);
    }
    
    getActiveTrack() {
        return this.tracks.find(t => t.id === this.activeTrackId);
    }
    
    getActiveChannel() {
        const track = this.getActiveTrack();
        if (!track) return null;
        return track.automationChannels.find(c => c.id === track.activeChannelId);
    }
    
    renderChannelSelect() {
        const track = this.getActiveTrack();
        const select = this.channelSelect;
        if (!track) return;
        
        select.innerHTML = '';
        
        if (track.automationChannels.length === 0) {
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '(No channels)';
            select.appendChild(emptyOption);
            select.disabled = true;
            this.activeChannelId = null;
            track.activeChannelId = null;
            return;
        }
        
        select.disabled = false;
        
        track.automationChannels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = AUTOMATION_TYPES[channel.type].name;
            if (channel.id === track.activeChannelId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        if (!track.activeChannelId || !track.automationChannels.find(c => c.id === track.activeChannelId)) {
            track.activeChannelId = track.automationChannels[0].id;
            select.value = track.activeChannelId;
        }
        this.activeChannelId = track.activeChannelId;
    }
    
    toggleAutomationPanel() {
        this.automationCollapsed = !this.automationCollapsed;
        const container = this.automationContainer;
        const btn = document.getElementById('toggleAutomationBtn');
        if (this.automationCollapsed) {
            container.classList.add('collapsed');
            btn.classList.add('collapsed');
        } else {
            container.classList.remove('collapsed');
            btn.classList.remove('collapsed');
            setTimeout(() => this.resizeCanvas(), 50);
        }
    }
    
    showAddChannelDialog() {
        document.getElementById('addChannelDialog').classList.add('show');
        this.dialogOpen = true;
    }
    
    hideAddChannelDialog() {
        document.getElementById('addChannelDialog').classList.remove('show');
        this.dialogOpen = false;
    }
    
    addAutomationChannel(type) {
        const track = this.getActiveTrack();
        if (!track) return;
        
        const existing = track.automationChannels.find(c => c.type === type);
        if (existing) {
            track.activeChannelId = existing.id;
            this.activeChannelId = existing.id;
            this.renderChannelSelect();
            this.renderAutomation();
            return;
        }
        
        const channel = {
            id: generateId(),
            type,
            points: [
                { tick: 0, value: AUTOMATION_TYPES[type].default, interpolation: 'linear' }
            ]
        };
        
        const channelData = JSON.parse(JSON.stringify(channel));
        const trackId = track.id;
        
        track.automationChannels.push(channel);
        track.activeChannelId = channel.id;
        this.activeChannelId = channel.id;
        
        this.executeCommand({
            type: 'addAutomationChannel',
            channelData,
            channelId: channel.id,
            trackId,
            undo: () => {
                const t = this.tracks.find(tr => tr.id === trackId);
                if (!t) return;
                const idx = t.automationChannels.findIndex(c => c.id === channelData.id);
                if (idx !== -1) t.automationChannels.splice(idx, 1);
                t.activeChannelId = t.automationChannels.length > 0 ? t.automationChannels[0].id : null;
                this.activeChannelId = t.activeChannelId;
                this.renderChannelSelect();
                this.renderAutomation();
                this.resizeCanvas();
            },
            redo: () => {
                const t = this.tracks.find(tr => tr.id === trackId);
                if (!t) return;
                t.automationChannels.push(JSON.parse(JSON.stringify(channelData)));
                t.activeChannelId = channelData.id;
                this.activeChannelId = channelData.id;
                this.renderChannelSelect();
                this.renderAutomation();
                this.resizeCanvas();
            }
        });
        
        this.renderChannelSelect();
        this.renderAutomation();
        this.resizeCanvas();
    }
    
    deleteActiveChannel() {
        const track = this.getActiveTrack();
        const channel = this.getActiveChannel();
        if (!track || !channel) return;
        
        const channelIndex = track.automationChannels.findIndex(c => c.id === channel.id);
        const channelCopy = JSON.parse(JSON.stringify(channel));
        const trackId = track.id;
        const channelId = channel.id;
        
        this.executeCommand({
            type: 'deleteAutomationChannel',
            channelCopy,
            channelId,
            trackId,
            channelIndex,
            undo: () => {
                const t = this.tracks.find(tr => tr.id === trackId);
                if (!t) return;
                t.automationChannels.splice(channelIndex, 0, JSON.parse(JSON.stringify(channelCopy)));
                t.activeChannelId = channelId;
                this.activeChannelId = channelId;
                this.renderChannelSelect();
                this.renderAutomation();
                this.resizeCanvas();
            },
            redo: () => {
                const t = this.tracks.find(tr => tr.id === trackId);
                if (!t) return;
                const idx = t.automationChannels.findIndex(c => c.id === channelId);
                if (idx !== -1) t.automationChannels.splice(idx, 1);
                t.activeChannelId = t.automationChannels.length > 0 ? t.automationChannels[0].id : null;
                this.activeChannelId = t.activeChannelId;
                this.renderChannelSelect();
                this.renderAutomation();
                this.resizeCanvas();
            }
        });
        
        track.automationChannels.splice(channelIndex, 1);
        track.activeChannelId = track.automationChannels.length > 0 ? track.automationChannels[0].id : null;
        this.activeChannelId = track.activeChannelId;
        this.renderChannelSelect();
        this.renderAutomation();
        this.resizeCanvas();
    }
    
    valueToY(value, type) {
        const h = Math.max(20, this.automationCanvas.height || 100);
        const cfg = AUTOMATION_TYPES[type];
        const range = cfg.max - cfg.min;
        return h - ((value - cfg.min) / range) * (h - 20) - 10;
    }
    
    yToValue(y, type) {
        const h = Math.max(20, this.automationCanvas.height || 100);
        const cfg = AUTOMATION_TYPES[type];
        const range = cfg.max - cfg.min;
        const clampedY = Math.max(10, Math.min(h - 10, y));
        return cfg.min + ((h - clampedY - 10) / (h - 20)) * range;
    }
    
    renderAutomation() {
        if (!this.automationCtx || !this.automationCanvas) return;
        const ctx = this.automationCtx;
        const width = this.automationCanvas.width;
        const height = this.automationCanvas.height;
        if (width === 0 || height === 0) return;
        const track = this.getActiveTrack();
        
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        for (let v = 0; v <= 127; v += 16) {
            const y = this.valueToY(v, 'volume');
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
            
            ctx.strokeStyle = isBar ? '#444' : isBeat ? '#3a3a3a' : '#2e2e2e';
            ctx.lineWidth = isBar ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        if (!track) return;
        
        const activeChannel = this.getActiveChannel();
        
        track.automationChannels.forEach(channel => {
            const isActive = channel === activeChannel;
            this.drawAutomationCurve(channel, isActive);
        });
        
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
    
    drawAutomationCurve(channel, isActive) {
        const ctx = this.automationCtx;
        const type = channel.type;
        const color = AUTOMATION_TYPES[type].color;
        const points = channel.points;
        
        if (points.length === 0) return;
        
        const alpha = isActive ? 1.0 : 0.3;
        ctx.globalAlpha = alpha;
        
        ctx.strokeStyle = color;
        ctx.fillStyle = color + '33';
        ctx.lineWidth = isActive ? 2 : 1.5;
        
        if (points.length === 1) {
            const x = points[0].tick * this.cellWidth;
            const y = this.valueToY(points[0].value, type);
            const h = this.automationCanvas.height;
            
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.automationCanvas.width, y);
            ctx.stroke();
        } else {
            ctx.beginPath();
            const firstY = this.valueToY(points[0].value, type);
            ctx.moveTo(0, firstY);
            
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const x1 = p1.tick * this.cellWidth;
                const y1 = this.valueToY(p1.value, type);
                ctx.lineTo(x1, y1);
                if (p2) {
                    const x2 = p2.tick * this.cellWidth;
                    const y2 = this.valueToY(p2.value, type);
                    
                    if (p1.interpolation === 'step') {
                        ctx.lineTo(x2, y1);
                        ctx.lineTo(x2, y2);
                    } else if (p1.interpolation === 'sCurve') {
                        const midX = (x1 + x2) / 2;
                        ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
                    } else {
                        ctx.lineTo(x2, y2);
                    }
                } else {
                    ctx.lineTo(this.automationCanvas.width, y1);
                }
            }
            ctx.stroke();
        }
        
        if (isActive) {
            points.forEach((point, idx) => {
                const x = point.tick * this.cellWidth;
                const y = this.valueToY(point.value, type);
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                
                if (idx < points.length - 1) {
                    const modeLabel = point.interpolation === 'step' ? 'S' : point.interpolation === 'sCurve' ? '~' : '';
                    if (modeLabel) {
                        ctx.fillStyle = '#ccc';
                        ctx.font = '9px sans-serif';
                        ctx.fillText(modeLabel, x + 6, y - 6);
                    }
                }
            });
        }
        
        ctx.globalAlpha = 1;
    }
    
    getAutomationMousePosition(e) {
        const rect = this.automationCanvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left + this.automationCanvasContainer.scrollLeft,
            y: e.clientY - rect.top
        };
    }
    
    findControlPointAt(x, y, channel) {
        if (!channel) return null;
        const threshold = 8;
        for (let i = 0; i < channel.points.length; i++) {
            const point = channel.points[i];
            const px = point.tick * this.cellWidth;
            const py = this.valueToY(point.value, channel.type);
            const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
            if (dist < threshold) {
                return { point, index: i };
            }
        }
        return null;
    }
    
    onAutomationMouseDown(e) {
        if (e.button !== 0) return;
        
        const pos = this.getAutomationMousePosition(e);
        const channel = this.getActiveChannel();
        if (!channel) return;
        
        const found = this.findControlPointAt(pos.x, pos.y, channel);
        
        if (found) {
            this.automationDragState = {
                type: 'movePoint',
                point: found.point,
                index: found.index,
                startTick: found.point.tick,
                startValue: found.point.value,
                startX: pos.x,
                startY: pos.y
            };
        } else {
            const tick = Math.max(0, Math.round(pos.x / this.cellWidth));
            const value = Math.round(this.yToValue(pos.y, channel.type));
            const newPoint = {
                tick, value, interpolation: 'linear'
            };
            
            let insertIndex = 0;
            for (let i = 0; i < channel.points.length; i++) {
                if (channel.points[i].tick < tick) {
                    insertIndex = i + 1;
                }
            }
            
            channel.points.splice(insertIndex, 0, newPoint);
            
            this.executeCommand({
                type: 'addControlPoint',
                channelId: channel.id,
                trackId: this.activeTrackId,
                point: newPoint,
                insertIndex,
                tick,
                undo: () => {
                    const t = this.tracks.find(tr => tr.id === trackId);
                    if (!t) return;
                    const ch = t.automationChannels.find(c => c.id === channel.id);
                    if (!ch) return;
                    const idx = ch.points.findIndex(p => p.tick === tick && p.value === newPoint.value);
                    if (idx !== -1) ch.points.splice(idx, 1);
                    this.renderAutomation();
                },
                redo: () => {
                    const t = this.tracks.find(tr => tr.id === trackId);
                    if (!t) return;
                    const ch = t.automationChannels.find(c => c.id === channel.id);
                    if (!ch) return;
                    let idx = 0;
                    for (let i = 0; i < ch.points.length; i++) {
                        if (ch.points[i].tick < tick) idx = i + 1;
                    }
                    ch.points.splice(idx, 0, newPoint);
                    this.renderAutomation();
                }
            });
            
            this.automationDragState = {
                type: 'movePoint',
                point: newPoint,
                index: insertIndex,
                startTick: tick,
                startValue: value,
                startX: pos.x,
                startY: pos.y,
                isNew: true
            };
        }
        
        this.renderAutomation();
    }
    
    onAutomationMouseMove(e) {
        if (!this.automationDragState) return;
        const pos = this.getAutomationMousePosition(e);
        const channel = this.getActiveChannel();
        if (!channel) return;
        
        this.automationDragState.point.tick = Math.max(0, Math.round(pos.x / this.cellWidth));
        this.automationDragState.point.value = Math.max(0, Math.min(127, Math.round(this.yToValue(pos.y, channel.type))));
        
        channel.points.sort((a, b) => a.tick - b.tick);
        
        this.renderAutomation();
    }
    
    onAutomationMouseUp(e) {
        if (!this.automationDragState) return;
        
        const state = this.automationDragState;
        const channel = this.getActiveChannel();
        
        if (state.type === 'movePoint' && !state.isNew && (state.startTick !== state.point.tick || state.startValue !== state.point.value)) {
            const oldTick = state.startTick;
            const oldValue = state.startValue;
            const newTick = state.point.tick;
            const newValue = state.point.value;
            const pointTick = oldTick;
            const pointValue = oldValue;
            
            this.executeCommand({
                type: 'moveControlPoint',
                channelId: channel.id,
                trackId: this.activeTrackId,
                pointTick,
                pointValue,
                oldTick,
                oldValue,
                newTick,
                newValue,
                undo: () => {
                    const t = this.tracks.find(tr => tr.id === this.activeTrackId);
                    if (!t) return;
                    const ch = t.automationChannels.find(c => c.id === channel.id);
                    if (!ch) return;
                    const pt = ch.points.find(p => p.tick === newTick && p.value === newValue);
                    if (pt) {
                        pt.tick = oldTick;
                        pt.value = oldValue;
                    }
                    ch.points.sort((a, b) => a.tick - b.tick);
                    this.renderAutomation();
                },
                redo: () => {
                    const t = this.tracks.find(tr => tr.id === this.activeTrackId);
                    if (!t) return;
                    const ch = t.automationChannels.find(c => c.id === channel.id);
                    if (!ch) return;
                    const pt = ch.points.find(p => p.tick === oldTick && p.value === oldValue);
                    if (pt) {
                        pt.tick = newTick;
                        pt.value = newValue;
                    }
                    ch.points.sort((a, b) => a.tick - b.tick);
                    this.renderAutomation();
                }
            });
        }
        
        this.automationDragState = null;
        this.renderAutomation();
        this.resizeCanvas();
    }
    
    onAutomationDoubleClick(e) {
        const pos = this.getAutomationMousePosition(e);
        const channel = this.getActiveChannel();
        if (!channel || channel.points.length <= 1) return;
        
        const found = this.findControlPointAt(pos.x, pos.y, channel);
        if (!found) return;
        
        const { point, index } = found;
        const pointCopy = { ...point };
        
        this.executeCommand({
            type: 'deleteControlPoint',
            channelId: channel.id,
            trackId: this.activeTrackId,
            point: pointCopy,
            index,
            undo: () => {
                const t = this.tracks.find(tr => tr.id === trackId);
                if (!t) return;
                const ch = t.automationChannels.find(c => c.id === channel.id);
                if (!ch) return;
                ch.points.splice(index, 0, { ...pointCopy });
                ch.points.sort((a, b) => a.tick - b.tick);
                this.renderAutomation();
            },
            redo: () => {
                const t = this.tracks.find(tr => tr.id === trackId);
                if (!t) return;
                const ch = t.automationChannels.find(c => c.id === channel.id);
                if (!ch) return;
                const idx = ch.points.findIndex(p => p.tick === pointCopy.tick && p.value === pointCopy.value);
                if (idx !== -1) ch.points.splice(idx, 1);
                this.renderAutomation();
            }
        });
        
        channel.points.splice(index, 1);
        this.renderAutomation();
    }
    
    onAutomationContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const pos = this.getAutomationMousePosition(e);
        const channel = this.getActiveChannel();
        if (!channel) return;
        
        const found = this.findControlPointAt(pos.x, pos.y, channel);
        if (found && found.index < channel.points.length - 1) {
            this.contextMenuPoint = found.point;
            this.showInterpolationMenu(e.clientX, e.clientY);
        }
    }
    
    showInterpolationMenu(x, y) {
        const menu = document.getElementById('interpolationMenu');
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';
    }
    
    hideInterpolationMenu() {
        document.getElementById('interpolationMenu').style.display = 'none';
    }
    
    handleInterpolationChange(mode) {
        this.hideInterpolationMenu();
        if (!this.contextMenuPoint) return;
        
        const channel = this.getActiveChannel();
        const oldMode = this.contextMenuPoint.interpolation;
        const pointTick = this.contextMenuPoint.tick;
        const pointValue = this.contextMenuPoint.value;
        const trackId = this.activeTrackId;
        const channelId = channel ? channel.id : null;
        
        this.executeCommand({
            type: 'changeInterpolation',
            channelId,
            trackId,
            pointTick,
            pointValue,
            oldMode,
            newMode: mode,
            undo: () => {
                const t = this.tracks.find(tr => tr.id === trackId);
                if (!t) return;
                const ch = t.automationChannels.find(c => c.id === channelId);
                if (!ch) return;
                const pt = ch.points.find(p => p.tick === pointTick && p.value === pointValue);
                if (pt) pt.interpolation = oldMode;
                this.renderAutomation();
            },
            redo: () => {
                const t = this.tracks.find(tr => tr.id === trackId);
                if (!t) return;
                const ch = t.automationChannels.find(c => c.id === channelId);
                if (!ch) return;
                const pt = ch.points.find(p => p.tick === pointTick && p.value === pointValue);
                if (pt) pt.interpolation = mode;
                this.renderAutomation();
            }
        });
        
        if (channel) {
            const pt = channel.points.find(p => p.tick === pointTick && p.value === pointValue);
            if (pt) pt.interpolation = mode;
        }
        this.renderAutomation();
        this.contextMenuPoint = null;
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
        this.refreshChordHighlight();
        this.renderChordTrack();
    }
    
    redo() {
        if (this.redoStack.length === 0) return;
        const command = this.redoStack.pop();
        command.redo();
        this.undoStack.push(command);
        this.refreshChordHighlight();
        this.renderChordTrack();
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
    
    getTrackAutomationValues(track, tick) {
        const values = {
            volume: AUTOMATION_TYPES.volume.default,
            pan: AUTOMATION_TYPES.pan.default,
            pitchBend: AUTOMATION_TYPES.pitchBend.default,
            modulation: AUTOMATION_TYPES.modulation.default
        };
        track.automationChannels.forEach(channel => {
            values[channel.type] = getAutomationValueAtTime(channel, tick);
        });
        return values;
    }
    
    applyAutomationToOsc(oscData, values) {
        const now = this.audioContext.currentTime;
        
        if (oscData.autoVolumeGain) {
            const vol = values.volume / 127;
            oscData.autoVolumeGain.gain.setTargetAtTime(vol, now, 0.02);
        }
        
        if (oscData.panner) {
            const pan = (values.pan - 64) / 64;
            oscData.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.02);
        }
        
        if (oscData.pitchBendGain) {
            const cents = (values.pitchBend - 64) * 2;
            oscData.pitchBendGain.gain.setTargetAtTime(cents, now, 0.02);
        }
        
        if (oscData.lfoGain) {
            const depth = (values.modulation / 127) * 100;
            oscData.lfoGain.gain.setTargetAtTime(depth, now, 0.02);
        }
    }
    
    playNote(pitch, velocity, duration = null, trackId = null, startTick = 0) {
        this.initAudio();
        
        const freq = pitchToFrequency(pitch);
        const now = this.audioContext.currentTime;
        
        const track = trackId ? this.tracks.find(t => t.id === trackId) : null;
        
        const gainNode = this.audioContext.createGain();
        const autoVolumeGain = this.audioContext.createGain();
        const panner = typeof this.audioContext.createStereoPanner === 'function'
            ? this.audioContext.createStereoPanner()
            : null;
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const pitchBendGain = this.audioContext.createGain();
        const lfo = this.audioContext.createOscillator();
        const lfoGain = this.audioContext.createGain();
        
        osc1.type = 'sine';
        osc1.frequency.value = freq;
        
        osc2.type = 'sine';
        osc2.frequency.value = freq * 3;
        
        lfo.type = 'sine';
        lfo.frequency.value = 5;
        lfoGain.gain.value = 0;
        pitchBendGain.gain.value = 0;
        
        pitchBendGain.connect(osc1.detune);
        pitchBendGain.connect(osc2.detune);
        lfo.connect(lfoGain);
        lfoGain.connect(osc1.detune);
        lfoGain.connect(osc2.detune);
        
        const velocityGain = velocity / 127;
        let trackVolume = 1;
        if (track) {
            trackVolume = track.volume / 127;
        }
        
        const attack = 0.01;
        const decay = 0.1;
        const sustain = 0.3;
        const release = 0.3;
        
        const baseGain = velocityGain * trackVolume * 0.3;
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(baseGain, now + attack);
        gainNode.gain.linearRampToValueAtTime(baseGain * sustain, now + attack + decay);
        
        const osc1Gain = this.audioContext.createGain();
        osc1Gain.gain.value = 0.6;
        
        const osc2Gain = this.audioContext.createGain();
        osc2Gain.gain.value = 0.2;
        
        osc1.connect(osc1Gain);
        osc2.connect(osc2Gain);
        osc1Gain.connect(autoVolumeGain);
        osc2Gain.connect(autoVolumeGain);
        
        if (panner) {
            autoVolumeGain.connect(panner);
            panner.connect(gainNode);
        } else {
            autoVolumeGain.connect(gainNode);
        }
        gainNode.connect(this.audioContext.destination);
        
        osc1.start(now);
        osc2.start(now);
        lfo.start(now);
        
        const key = document.querySelector(`.piano-key[data-pitch="${pitch}"]`);
        if (key) key.classList.add('active');
        
        const stopTime = duration ? now + duration : null;
        const oscId = generateId();
        
        const initValues = track ? this.getTrackAutomationValues(track, startTick) : {
            volume: AUTOMATION_TYPES.volume.default,
            pan: AUTOMATION_TYPES.pan.default,
            pitchBend: AUTOMATION_TYPES.pitchBend.default,
            modulation: AUTOMATION_TYPES.modulation.default
        };
        autoVolumeGain.gain.value = initValues.volume / 127;
        if (panner) panner.pan.value = (initValues.pan - 64) / 64;
        pitchBendGain.gain.value = (initValues.pitchBend - 64) * 2;
        lfoGain.gain.value = (initValues.modulation / 127) * 100;
        
        this.activeOscillators.set(oscId, {
            osc1, osc2, gainNode, autoVolumeGain, panner,
            pitchBendGain, lfo, lfoGain,
            pitch, stopTime, trackId
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
        if (oscData.lfo) oscData.lfo.stop(now + release);
        
        const key = document.querySelector(`.piano-key[data-pitch="${oscData.pitch}"]`);
        if (key) key.classList.remove('active');
        
        setTimeout(() => {
            this.activeOscillators.delete(oscId);
        }, release * 1000);
    }
    
    play(isRecordingMode = false) {
        if (this.isPlaying) return;
        
        this.initAudio();
        this.isPlaying = true;
        this.isPaused = false;
        
        const hasSolo = this.tracks.some(t => t.solo);
        
        const activeNotes = new Map();
        const tickDuration = 60 / (this.bpm * TICKS_PER_BEAT);
        
        this.playStartTime = performance.now() - (this.playTick * tickDuration * 1000);
        this.lastMetronomeTick = Math.floor(this.playTick / TICKS_PER_BEAT) - 1;
        
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
                            const oscId = this.playNote(note.pitch, note.velocity, null, track.id, tick);
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
                
                if (this.metronomeEnabled) {
                    const beatIndex = Math.floor(tick / TICKS_PER_BEAT);
                    if (beatIndex > this.lastMetronomeTick) {
                        const isStrong = beatIndex % BEATS_PER_BAR === 0;
                        this.playMetronomeClick(isStrong);
                        this.lastMetronomeTick = beatIndex;
                    }
                }
            }
            
            this.activeOscillators.forEach((oscData) => {
                if (oscData.trackId) {
                    const track = this.tracks.find(t => t.id === oscData.trackId);
                    if (track) {
                        const values = this.getTrackAutomationValues(track, newTick);
                        this.applyAutomationToOsc(oscData, values);
                    }
                }
            });
            
            this.playTick = newTick;
            
            const maxTick = this.getMaxTick();
            if (!this.isRecording && this.playTick >= maxTick) {
                this.stop();
                return;
            }
            
            const currentMaxCanvasTick = Math.floor(this.canvas.width / this.cellWidth);
            if (this.playTick > currentMaxCanvasTick - TICKS_PER_BAR) {
                this.resizeCanvas();
            }
            
            const playX = this.playTick * this.cellWidth;
            const visibleRight = this.scrollX + this.gridContainer.clientWidth - 100;
            if (playX > visibleRight) {
                this.gridContainer.scrollLeft = playX - this.gridContainer.clientWidth + 200;
            }
            
            this.render();
            this.updateMixerMeters(activeNotes);
            this.animationFrameId = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    pause() {
        if (this.isRecording) {
            this.stopRecording();
            return;
        }
        
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
        if (this.isRecording) {
            this.stopRecording();
            this.playTick = 0;
            this.render();
            return;
        }
        
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
        
        this.resetMixerMeters();
        this.render();
    }
    
    getMaxTick() {
        let max = 0;
        this.tracks.forEach(track => {
            track.notes.forEach(note => {
                const end = note.startTick + note.durationTicks;
                if (end > max) max = end;
            });
            track.automationChannels.forEach(channel => {
                channel.points.forEach(point => {
                    if (point.tick > max) max = point.tick;
                });
            });
        });
        if (this.isPlaying || this.isRecording) {
            max = Math.max(max, Math.ceil(this.playTick) + TICKS_PER_BAR * 2);
        }
        return max + TICKS_PER_BAR;
    }
    
    exportMidi() {
        const midiExporter = new MidiExporter(this.tracks, this.bpm);
        midiExporter.export();
    }
    
    showImportMidiDialog() {
        document.getElementById('importMidiDialog').classList.add('show');
        this.dialogOpen = true;
    }
    
    hideImportMidiDialog() {
        document.getElementById('importMidiDialog').classList.remove('show');
        this.dialogOpen = false;
    }
    
    importMidiFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parser = new MidiParser(e.target.result);
                const midiData = parser.parse();
                this.applyMidiData(midiData);
            } catch (err) {
                alert('Failed to parse MIDI file: ' + err.message);
            }
        };
        reader.onerror = () => {
            alert('Failed to read MIDI file');
        };
        reader.readAsArrayBuffer(file);
    }
    
    applyMidiData(midiData) {
        const oldTracks = JSON.parse(JSON.stringify(this.tracks));
        const oldActiveTrackId = this.activeTrackId;
        const oldActiveChannelId = this.activeChannelId;
        
        const midiTicksPerQuarter = midiData.ticksPerQuarter;
        const editorTicksPerQuarter = TICKS_PER_BEAT;
        const tickRatio = editorTicksPerQuarter / midiTicksPerQuarter;
        
        this.tracks = [];
        this.selectedNotes.clear();
        
        let hasNotes = false;
        
        midiData.tracks.forEach((midiTrack, index) => {
            if (midiTrack.notes.length === 0 && this.tracks.length > 0) return;
            
            const track = this.addTrack(
                midiTrack.name || `Track ${index + 1}`,
                TRACK_COLORS[this.tracks.length % TRACK_COLORS.length]
            );
            
            midiTrack.notes.forEach(midiNote => {
                const startTick = Math.max(0, Math.round(midiNote.startTick * tickRatio));
                const durationTicks = Math.max(1, Math.round(midiNote.durationTicks * tickRatio));
                const pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, midiNote.pitch));
                
                track.notes.push({
                    id: generateId(),
                    track: track.id,
                    pitch,
                    startTick,
                    durationTicks,
                    velocity: Math.max(1, Math.min(127, midiNote.velocity))
                });
                hasNotes = true;
            });
        });
        
        if (this.tracks.length === 0) {
            this.addTrack('Track 1', TRACK_COLORS[0]);
        }
        
        this.activeTrackId = this.tracks[0].id;
        this.activeChannelId = this.tracks[0].activeChannelId;
        
        const savedTracks = JSON.parse(JSON.stringify(this.tracks));
        const savedActiveTrackId = this.activeTrackId;
        const savedActiveChannelId = this.activeChannelId;
        
        this.executeCommand({
            type: 'importMidi',
            oldTracks,
            oldActiveTrackId,
            oldActiveChannelId,
            savedTracks,
            savedActiveTrackId,
            savedActiveChannelId,
            undo: () => {
                this.tracks = JSON.parse(JSON.stringify(oldTracks));
                this.activeTrackId = oldActiveTrackId;
                this.activeChannelId = oldActiveChannelId;
                this.selectedNotes.clear();
                this.renderTrackList();
                this.renderChannelSelect();
                this.resizeCanvas();
                this.render();
                this.renderVelocity();
            },
            redo: () => {
                this.tracks = JSON.parse(JSON.stringify(savedTracks));
                this.activeTrackId = savedActiveTrackId;
                this.activeChannelId = savedActiveChannelId;
                this.selectedNotes.clear();
                this.renderTrackList();
                this.renderChannelSelect();
                this.resizeCanvas();
                this.render();
                this.renderVelocity();
            }
        });
        
        this.renderTrackList();
        this.renderChannelSelect();
        this.resizeCanvas();
        this.render();
        this.renderVelocity();
        
        if (hasNotes) {
            setTimeout(() => {
                this.gridContainer.scrollLeft = 0;
                this.velocityCanvasContainer.scrollLeft = 0;
            }, 50);
        }
    }
    
    toggleVelocityPanel() {
        this.velocityCollapsed = !this.velocityCollapsed;
        if (this.velocityCollapsed) {
            this.velocityPanel.classList.add('collapsed');
        } else {
            this.velocityPanel.classList.remove('collapsed');
            setTimeout(() => {
                this.resizeVelocityCanvas();
                this.renderVelocity();
            }, 50);
        }
    }
    
    renderVelocity() {
        if (!this.velocityCtx || !this.velocityCanvas) return;
        const ctx = this.velocityCtx;
        const width = this.velocityCanvas.width;
        const height = this.velocityCanvas.height;
        if (width === 0 || height === 0) return;
        
        const track = this.getActiveTrack();
        
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        for (let v = 0; v <= 127; v += 32) {
            const y = this.velocityToY(v, height);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.fillText('127', 4, 12);
        ctx.fillText('0', 4, height - 4);
        
        const totalTicks = Math.ceil(width / this.cellWidth);
        for (let tick = 0; tick <= totalTicks; tick++) {
            const x = tick * this.cellWidth;
            const isBar = tick % TICKS_PER_BAR === 0;
            const isBeat = tick % TICKS_PER_BEAT === 0;
            
            ctx.strokeStyle = isBar ? '#444' : isBeat ? '#3a3a3a' : '#2e2e2e';
            ctx.lineWidth = isBar ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        if (!track) return;
        
        const sortedNotes = [...track.notes].sort((a, b) => a.startTick - b.startTick);
        
        sortedNotes.forEach(note => {
            const isSelected = this.selectedNotes.has(note.id);
            const barCenterX = (note.startTick + note.durationTicks / 2) * this.cellWidth;
            const maxBarWidth = Math.max(6, this.cellWidth * 0.8);
            const barWidth = Math.min(maxBarWidth, Math.max(6, note.durationTicks * this.cellWidth * 0.6));
            const barX = barCenterX - barWidth / 2;
            const barHeight = (note.velocity / 127) * (height - 20);
            const barY = height - barHeight - 10;
            
            const brightness = 0.4 + (note.velocity / 127) * 0.6;
            const barColor = isSelected ? '#fff' : this.adjustColorBrightness(track.color, brightness);
            
            ctx.fillStyle = barColor;
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            if (isSelected) {
                ctx.strokeStyle = '#4a9eff';
                ctx.lineWidth = 2;
                ctx.strokeRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
            }
            
            ctx.fillStyle = isSelected ? '#4a9eff' : barColor;
            const handleY = barY - 2;
            ctx.fillRect(barX, handleY, barWidth, 4);
        });
        
        if (this.velocitySelectionBox) {
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(
                this.velocitySelectionBox.x,
                this.velocitySelectionBox.y,
                this.velocitySelectionBox.width,
                this.velocitySelectionBox.height
            );
            ctx.setLineDash([]);
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
    
    velocityToY(velocity, height) {
        return height - 10 - (velocity / 127) * (height - 20);
    }
    
    yToVelocity(y, height) {
        const clampedY = Math.max(10, Math.min(height - 10, y));
        return Math.round(((height - clampedY - 10) / (height - 20)) * 127);
    }
    
    getVelocityMousePosition(e) {
        const rect = this.velocityCanvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left + this.velocityCanvasContainer.scrollLeft,
            y: e.clientY - rect.top
        };
    }
    
    getVelocityBarRect(note, height) {
        const barCenterX = (note.startTick + note.durationTicks / 2) * this.cellWidth;
        const maxBarWidth = Math.max(6, this.cellWidth * 0.8);
        const barWidth = Math.min(maxBarWidth, Math.max(6, note.durationTicks * this.cellWidth * 0.6));
        const barX = barCenterX - barWidth / 2;
        const barHeight = (note.velocity / 127) * (height - 20);
        const barY = height - barHeight - 10;
        return { barX, barWidth, barY, barHeight };
    }
    
    findVelocityNoteAt(x, y) {
        const track = this.getActiveTrack();
        if (!track) return null;
        
        const height = this.velocityCanvas.height;
        
        for (const note of track.notes) {
            const { barX, barWidth, barY } = this.getVelocityBarRect(note, height);
            
            if (x >= barX - 5 && x <= barX + barWidth + 5 &&
                y >= barY - 5 && y <= height - 5) {
                return note;
            }
        }
        return null;
    }
    
    isOnVelocityHandle(x, y, note) {
        const height = this.velocityCanvas.height;
        const { barX, barWidth, barY } = this.getVelocityBarRect(note, height);
        
        return y >= barY - 8 && y <= barY + 8 &&
               x >= barX - 5 && x <= barX + barWidth + 5;
    }
    
    onVelocityMouseDown(e) {
        if (e.button !== 0) return;
        
        const pos = this.getVelocityMousePosition(e);
        const note = this.findVelocityNoteAt(pos.x, pos.y);
        
        if (e.shiftKey && note) {
            if (this.selectedNotes.has(note.id)) {
                this.selectedNotes.delete(note.id);
            } else {
                this.selectedNotes.add(note.id);
            }
            this.render();
            this.renderVelocity();
            return;
        }
        
        if (note && this.isOnVelocityHandle(pos.x, pos.y, note)) {
            if (!this.selectedNotes.has(note.id)) {
                this.selectedNotes.clear();
                this.selectedNotes.add(note.id);
            }
            
            const selectedNoteIds = Array.from(this.selectedNotes);
            const velocityChanges = selectedNoteIds.map(id => {
                const n = this.findNoteById(id);
                return n ? { note: n, oldVelocity: n.velocity } : null;
            }).filter(v => v !== null);
            
            this.velocityDragState = {
                type: 'adjustVelocity',
                startY: pos.y,
                velocityChanges,
                startVelocities: velocityChanges.map(v => v.oldVelocity)
            };
            
            this.render();
            this.renderVelocity();
            return;
        }
        
        if (note) {
            if (this.selectedNotes.has(note.id)) {
                this.velocityDragState = {
                    type: 'adjustVelocity',
                    startY: pos.y,
                    velocityChanges: Array.from(this.selectedNotes).map(id => {
                        const n = this.findNoteById(id);
                        return { note: n, oldVelocity: n.velocity };
                    }).filter(v => v !== null),
                    startVelocities: Array.from(this.selectedNotes).map(id => {
                        const n = this.findNoteById(id);
                        return n ? n.velocity : 100;
                    })
                };
            } else {
                this.selectedNotes.clear();
                this.selectedNotes.add(note.id);
                
                this.velocityDragState = {
                    type: 'adjustVelocity',
                    startY: pos.y,
                    velocityChanges: [{ note, oldVelocity: note.velocity }],
                    startVelocities: [note.velocity]
                };
            }
            this.render();
            this.renderVelocity();
            return;
        }
        
        this.selectedNotes.clear();
        this.velocityDragState = {
            type: 'select',
            startX: pos.x,
            startY: pos.y
        };
        
        this.render();
        this.renderVelocity();
    }
    
    onVelocityMouseMove(e) {
        if (!this.velocityDragState) return;
        
        const pos = this.getVelocityMousePosition(e);
        const height = this.velocityCanvas.height;
        
        if (this.velocityDragState.type === 'adjustVelocity') {
            const deltaY = pos.y - this.velocityDragState.startY;
            const deltaVelocity = -Math.round(deltaY / ((height - 20) / 127));
            
            this.velocityDragState.velocityChanges.forEach((vc, i) => {
                const newVelocity = Math.max(1, Math.min(127, this.velocityDragState.startVelocities[i] + deltaVelocity));
                vc.note.velocity = newVelocity;
            });
            
            this.render();
            this.renderVelocity();
        } else if (this.velocityDragState.type === 'select') {
            this.velocitySelectionBox = {
                x: Math.min(this.velocityDragState.startX, pos.x),
                y: Math.min(this.velocityDragState.startY, pos.y),
                width: Math.abs(pos.x - this.velocityDragState.startX),
                height: Math.abs(pos.y - this.velocityDragState.startY)
            };
            
            this.selectedNotes.clear();
            const track = this.getActiveTrack();
            if (track) {
                track.notes.forEach(note => {
                    const { barX, barWidth, barY, barHeight } = this.getVelocityBarRect(note, height);
                    
                    if (this.rectsIntersect(this.velocitySelectionBox, {
                        x: barX,
                        y: barY,
                        width: barWidth,
                        height: barHeight + 10
                    })) {
                        this.selectedNotes.add(note.id);
                    }
                });
            }
            this.renderVelocity();
        }
    }
    
    onVelocityMouseUp(e) {
        if (!this.velocityDragState) return;
        
        if (this.velocityDragState.type === 'adjustVelocity') {
            const velocityChanges = this.velocityDragState.velocityChanges.map(vc => ({
                noteId: vc.note.id,
                trackId: vc.note.track,
                oldVelocity: vc.oldVelocity,
                newVelocity: vc.note.velocity
            })).filter(vc => vc.oldVelocity !== vc.newVelocity);
            
            if (velocityChanges.length > 0) {
                this.executeCommand({
                    type: 'changeVelocity',
                    velocityChanges,
                    undo: () => {
                        velocityChanges.forEach(({ noteId, trackId, oldVelocity }) => {
                            const track = this.tracks.find(t => t.id === trackId);
                            if (!track) return;
                            const n = track.notes.find(x => x.id === noteId);
                            if (!n) return;
                            n.velocity = oldVelocity;
                        });
                        this.render();
                        this.renderVelocity();
                    },
                    redo: () => {
                        velocityChanges.forEach(({ noteId, trackId, newVelocity }) => {
                            const track = this.tracks.find(t => t.id === trackId);
                            if (!track) return;
                            const n = track.notes.find(x => x.id === noteId);
                            if (!n) return;
                            n.velocity = newVelocity;
                        });
                        this.render();
                        this.renderVelocity();
                    }
                });
            }
        }
        
        this.velocityDragState = null;
        this.velocitySelectionBox = null;
        this.render();
        this.renderVelocity();
    }

    loadMixerState() {
        try {
            const saved = localStorage.getItem('midiEditor_mixerState');
            if (saved) {
                const state = JSON.parse(saved);
                this.mixerCollapsed = state.collapsed === true;
                this.mixerWidth = state.width || 0;
            }
        } catch (e) {
            console.warn('Failed to load mixer state', e);
        }
    }

    saveMixerState() {
        try {
            const state = {
                collapsed: this.mixerCollapsed,
                width: this.mixerWidth
            };
            localStorage.setItem('midiEditor_mixerState', JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save mixer state', e);
        }
    }

    applyMixerState() {
        if (this.mixerCollapsed) {
            this.mixerPanel.classList.add('collapsed');
        } else {
            this.mixerPanel.classList.remove('collapsed');
        }
        if (this.mixerWidth > 0 && !this.mixerCollapsed) {
            this.mixerPanel.style.flex = `0 0 ${this.mixerWidth}px`;
        }
    }

    toggleMixer() {
        this.mixerCollapsed = !this.mixerCollapsed;
        if (this.mixerCollapsed) {
            this.mixerPanel.classList.add('collapsed');
        } else {
            this.mixerPanel.classList.remove('collapsed');
            if (this.mixerWidth > 0) {
                this.mixerPanel.style.flex = `0 0 ${this.mixerWidth}px`;
            } else {
                this.mixerPanel.style.flex = '';
            }
        }
        this.saveMixerState();
    }

    startMixerResize(e) {
        if (this.mixerCollapsed) return;
        e.preventDefault();
        this.mixerResizeState = {
            startX: e.clientX,
            startWidth: this.mixerPanel.getBoundingClientRect().width
        };
        this.mixerResizer.classList.add('dragging');
    }

    onMixerResize(e) {
        if (!this.mixerResizeState) return;
        const dx = e.clientX - this.mixerResizeState.startX;
        const bottomPanelWidth = document.querySelector('.bottom-panel').getBoundingClientRect().width;
        const trackPanelWidth = document.querySelector('.track-panel').getBoundingClientRect().width;
        const maxWidth = bottomPanelWidth - trackPanelWidth - 50;
        let newWidth = this.mixerResizeState.startWidth - dx;
        newWidth = Math.max(300, Math.min(maxWidth, newWidth));
        this.mixerWidth = newWidth;
        this.mixerPanel.style.flex = `0 0 ${newWidth}px`;
    }

    panToDisplayValue(pan0To127) {
        const centered = pan0To127 - 64;
        if (centered === 0) return 'C';
        if (centered < 0) return `L${Math.abs(centered)}`;
        return `R${centered}`;
    }

    getTrackPanValue(track) {
        const panChannel = track.automationChannels.find(c => c.type === 'pan');
        if (panChannel && panChannel.points.length > 0) {
            return getAutomationValueAtTime(panChannel, this.playTick);
        }
        return AUTOMATION_TYPES.pan.default;
    }

    getTrackVolumeValue(track) {
        const volChannel = track.automationChannels.find(c => c.type === 'volume');
        if (volChannel && volChannel.points.length > 0) {
            return getAutomationValueAtTime(volChannel, this.playTick);
        }
        return track.volume;
    }

    findAutomationPointAtCurrentTick(channel, tick) {
        if (!channel || !channel.points || channel.points.length === 0) return null;
        const tolerance = TICKS_PER_BEAT / 4;
        for (const point of channel.points) {
            if (Math.abs(point.tick - tick) <= tolerance) {
                return point;
            }
        }
        return null;
    }

    updateAutomationPointIfExists(track, type, value) {
        if (!this.isPlaying && !this.isPaused) return;
        const channel = track.automationChannels.find(c => c.type === type);
        if (!channel) return;
        const point = this.findAutomationPointAtCurrentTick(channel, this.playTick);
        if (point) {
            point.value = Math.max(AUTOMATION_TYPES[type].min,
                Math.min(AUTOMATION_TYPES[type].max, value));
            this.renderAutomation();
        }
    }

    setTrackPan(track, value) {
        value = Math.max(0, Math.min(127, value));
        let panChannel = track.automationChannels.find(c => c.type === 'pan');
        if (!panChannel) {
            const newChannel = {
                id: generateId(),
                type: 'pan',
                points: [
                    { tick: 0, value: value, interpolation: 'linear' }
                ]
            };
            track.automationChannels.push(newChannel);
            if (!track.activeChannelId) {
                track.activeChannelId = newChannel.id;
                this.activeChannelId = newChannel.id;
            }
            this.renderChannelSelect();
        }
        this.updateAutomationPointIfExists(track, 'pan', value);
        if (!this.isPlaying && !this.isPaused && panChannel && panChannel.points.length > 0) {
            panChannel.points[0].value = value;
        }
        if (!this.isPlaying && !this.isPaused && !panChannel) {
        }
        this.renderMixer();
        this.renderAutomation();
    }

    setTrackVolume(track, value) {
        value = Math.max(0, Math.min(127, value));
        track.volume = value;
        this.updateAutomationPointIfExists(track, 'volume', value);
        this.renderTrackList();
    }

    renderMixer() {
        if (!this.mixerChannels) return;
        this.applyMixerState();

        this.mixerChannels.innerHTML = '';
        this.tracks.forEach((track, index) => {
            const channelEl = document.createElement('div');
            channelEl.className = `mixer-channel ${track.id === this.activeTrackId ? 'active' : ''}`;
            channelEl.dataset.trackId = track.id;

            const volumeValue = this.getTrackVolumeValue(track);
            const panValue = this.getTrackPanValue(track);

            channelEl.innerHTML = `
                <div class="mixer-channel-color" style="background-color: ${track.color}"></div>
                <div class="mixer-channel-name" title="${track.name}">${track.name}</div>
                <div class="meter-container" data-track-id="${track.id}">
                    <div class="meter-bar">
                        <div class="meter-fill" data-meter-track="${track.id}"></div>
                        <div class="meter-peak" data-peak-track="${track.id}"></div>
                    </div>
                </div>
                <div class="mixer-solo-mute">
                    <button class="mixer-mute ${track.muted ? 'active' : ''}" data-mixer-track="${track.id}" data-action="mute">M</button>
                    <button class="mixer-solo ${track.solo ? 'active' : ''}" data-mixer-track="${track.id}" data-action="solo">S</button>
                </div>
                <div class="pan-control">
                    <span class="pan-label">PAN</span>
                    <div class="pan-knob-container" data-mixer-track="${track.id}" data-pan-value="${panValue}">
                        <div class="pan-knob">
                            <div class="pan-knob-indicator" style="transform: translateX(-50%) rotate(${(panValue - 64) * 1.4}deg)"></div>
                        </div>
                    </div>
                    <span class="pan-value">${this.panToDisplayValue(panValue)}</span>
                </div>
                <div class="volume-fader-container">
                    <div class="volume-fader-track" data-mixer-track="${track.id}" data-volume-value="${volumeValue}">
                        <div class="volume-fader-fill" style="height: ${(volumeValue / 127) * 100}%"></div>
                        <div class="volume-fader-handle" style="bottom: calc(${(volumeValue / 127) * 100}% - 7px)"></div>
                    </div>
                    <span class="volume-value">${Math.round(volumeValue)}</span>
                </div>
            `;

            channelEl.addEventListener('click', (e) => {
                if (e.target.closest('.mixer-mute') ||
                    e.target.closest('.mixer-solo') ||
                    e.target.closest('.volume-fader-track') ||
                    e.target.closest('.pan-knob-container')) {
                    return;
                }
                this.activeTrackId = track.id;
                this.activeChannelId = track.activeChannelId;
                this.renderTrackList();
                this.renderChannelSelect();
                this.render();
                this.renderVelocity();
                this.renderMixer();
            });

            const muteBtn = channelEl.querySelector('.mixer-mute');
            if (muteBtn) {
                muteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    track.muted = !track.muted;
                    this.renderTrackList();
                    this.renderMixer();
                });
            }

            const soloBtn = channelEl.querySelector('.mixer-solo');
            if (soloBtn) {
                soloBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    track.solo = !track.solo;
                    this.renderTrackList();
                    this.renderMixer();
                });
            }

            const faderTrack = channelEl.querySelector('.volume-fader-track');
            if (faderTrack) {
                const startDrag = (e) => {
                    e.preventDefault();
                    const rect = faderTrack.getBoundingClientRect();
                    this.mixerFaderDragState = {
                        trackId: track.id,
                        rect: rect,
                        startY: e.clientY
                    };
                    this.onMixerFaderDrag(e);
                };
                faderTrack.addEventListener('mousedown', startDrag);
            }

            const panContainer = channelEl.querySelector('.pan-knob-container');
            if (panContainer) {
                panContainer.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    this.mixerPanDragState = {
                        trackId: track.id,
                        startY: e.clientY,
                        startValue: this.getTrackPanValue(track)
                    };
                    this.onMixerPanDrag(e);
                });
            }

            this.mixerChannels.appendChild(channelEl);
        });
    }

    onMixerFaderDrag(e) {
        if (!this.mixerFaderDragState) return;
        const track = this.tracks.find(t => t.id === this.mixerFaderDragState.trackId);
        if (!track) return;
        const rect = this.mixerFaderDragState.rect;
        const trackHeight = rect.height;
        let yFromBottom = (rect.bottom - e.clientY);
        yFromBottom = Math.max(0, Math.min(trackHeight, yFromBottom));
        const value = Math.round((yFromBottom / trackHeight) * 127);
        this.setTrackVolume(track, value);
    }

    onMixerPanDrag(e) {
        if (!this.mixerPanDragState) return;
        const track = this.tracks.find(t => t.id === this.mixerPanDragState.trackId);
        if (!track) return;
        const dy = this.mixerPanDragState.startY - e.clientY;
        const sensitivity = 0.8;
        let value = this.mixerPanDragState.startValue + dy * sensitivity;
        value = Math.max(0, Math.min(127, Math.round(value)));
        this.setTrackPan(track, value);
    }

    updateMixerMeters(activeNotes) {
        if (!this.mixerChannels || this.mixerCollapsed) return;
        const currentTick = this.playTick;
        const hasSolo = this.tracks.some(t => t.solo);

        this.tracks.forEach(track => {
            let level = 0;
            if (!track.muted && (!hasSolo || track.solo)) {
                for (const note of track.notes) {
                    if (note.startTick <= currentTick &&
                        note.startTick + note.durationTicks > currentTick) {
                        const noteProgress = (currentTick - note.startTick) / note.durationTicks;
                        let envMultiplier = 1;
                        if (noteProgress < 0.1) {
                            envMultiplier = noteProgress / 0.1;
                        } else if (noteProgress > 0.8) {
                            envMultiplier = (1 - noteProgress) / 0.2;
                        }
                        level += (note.velocity / 127) * envMultiplier;
                    }
                }
            }
            const volChannel = track.automationChannels.find(c => c.type === 'volume');
            let volMultiplier = track.volume / 127;
            if (volChannel) {
                volMultiplier = getAutomationValueAtTime(volChannel, currentTick) / 127;
            }
            level = Math.min(1, level * 0.5 * volMultiplier);
            const currentPeak = this.trackPeakHold.get(track.id) || 0;
            const newPeak = Math.max(currentPeak * 0.95, level);
            this.trackPeakHold.set(track.id, newPeak);

            const meterFill = document.querySelector(`[data-meter-track="${track.id}"]`);
            const meterPeak = document.querySelector(`[data-peak-track="${track.id}"]`);

            if (meterFill) {
                meterFill.style.height = `${level * 100}%`;
            }
            if (meterPeak) {
                meterPeak.style.bottom = `${newPeak * 100}%`;
            }
        });
    }

    resetMixerMeters() {
        this.trackPeakHold.clear();
        if (!this.mixerChannels) return;
        this.tracks.forEach(track => {
            const meterFill = document.querySelector(`[data-meter-track="${track.id}"]`);
            const meterPeak = document.querySelector(`[data-peak-track="${track.id}"]`);
            if (meterFill) {
                meterFill.style.height = '0%';
            }
            if (meterPeak) {
                meterPeak.style.bottom = '0%';
            }
        });
    }
}

class MidiParser {
    constructor(data) {
        this.data = new Uint8Array(data);
        this.offset = 0;
        this.tracks = [];
        this.format = 0;
        this.ticksPerQuarter = 480;
    }

    parse() {
        this.parseHeader();
        this.parseTracks();
        return {
            format: this.format,
            ticksPerQuarter: this.ticksPerQuarter,
            tracks: this.tracks
        };
    }

    readByte() {
        return this.data[this.offset++];
    }

    readBytes(length) {
        const bytes = this.data.slice(this.offset, this.offset + length);
        this.offset += length;
        return bytes;
    }

    readUint16() {
        const value = (this.data[this.offset] << 8) | this.data[this.offset + 1];
        this.offset += 2;
        return value;
    }

    readUint32() {
        const value = (this.data[this.offset] << 24) |
                      (this.data[this.offset + 1] << 16) |
                      (this.data[this.offset + 2] << 8) |
                      this.data[this.offset + 3];
        this.offset += 4;
        return value;
    }

    readVariableLength() {
        let value = 0;
        let byte;
        do {
            byte = this.readByte();
            value = (value << 7) | (byte & 0x7f);
        } while (byte & 0x80);
        return value;
    }

    readString(length) {
        let str = '';
        for (let i = 0; i < length; i++) {
            str += String.fromCharCode(this.readByte());
        }
        return str;
    }

    parseHeader() {
        const chunkType = this.readString(4);
        if (chunkType !== 'MThd') {
            throw new Error('Invalid MIDI file: missing MThd header');
        }
        const chunkLength = this.readUint32();
        this.format = this.readUint16();
        const numTracks = this.readUint16();
        const division = this.readUint16();

        if (division & 0x8000) {
            throw new Error('SMPTE time code format not supported');
        }
        this.ticksPerQuarter = division & 0x7fff;

        this.numTracks = numTracks;
    }

    parseTracks() {
        for (let i = 0; i < this.numTracks; i++) {
            this.tracks.push(this.parseTrack());
        }
    }

    parseTrack() {
        const chunkType = this.readString(4);
        if (chunkType !== 'MTrk') {
            throw new Error('Invalid MIDI file: missing MTrk chunk');
        }
        const chunkLength = this.readUint32();
        const trackEnd = this.offset + chunkLength;

        const track = {
            name: `Track ${this.tracks.length + 1}`,
            events: [],
            notes: []
        };

        let runningStatus = null;
        let absoluteTick = 0;
        const activeNotes = new Map();

        while (this.offset < trackEnd) {
            const deltaTime = this.readVariableLength();
            absoluteTick += deltaTime;

            let statusByte = this.readByte();

            if (statusByte < 0x80) {
                if (runningStatus === null) {
                    throw new Error('Invalid MIDI: running status without previous status');
                }
                this.offset--;
                statusByte = runningStatus;
            } else {
                runningStatus = statusByte;
            }

            const eventType = statusByte & 0xf0;
            const channel = statusByte & 0x0f;

            if (statusByte === 0xff) {
                this.parseMetaEvent(absoluteTick, track);
            } else if (eventType === 0xf0 || eventType === 0xf7) {
                this.parseSysExEvent();
            } else if (eventType === 0x80) {
                const pitch = this.readByte();
                const velocity = this.readByte();
                this.handleNoteOff(absoluteTick, pitch, activeNotes, track);
            } else if (eventType === 0x90) {
                const pitch = this.readByte();
                const velocity = this.readByte();
                if (velocity === 0) {
                    this.handleNoteOff(absoluteTick, pitch, activeNotes, track);
                } else {
                    this.handleNoteOn(absoluteTick, pitch, velocity, activeNotes, track);
                }
            } else if (eventType === 0xa0) {
                this.readByte();
                this.readByte();
            } else if (eventType === 0xb0) {
                this.readByte();
                this.readByte();
            } else if (eventType === 0xc0) {
                this.readByte();
            } else if (eventType === 0xd0) {
                this.readByte();
            } else if (eventType === 0xe0) {
                this.readByte();
                this.readByte();
            }
        }

        return track;
    }

    parseMetaEvent(tick, track) {
        const metaType = this.readByte();
        const length = this.readVariableLength();

        if (metaType === 0x03) {
            track.name = this.readString(length);
        } else {
            this.readBytes(length);
        }
    }

    parseSysExEvent() {
        const length = this.readVariableLength();
        this.readBytes(length);
    }

    handleNoteOn(tick, pitch, velocity, activeNotes, track) {
        const key = pitch;
        if (activeNotes.has(key)) {
            this.handleNoteOff(tick, pitch, activeNotes, track);
        }
        activeNotes.set(key, {
            tick,
            velocity,
            pitch
        });
    }

    handleNoteOff(tick, pitch, activeNotes, track) {
        const key = pitch;
        if (activeNotes.has(key)) {
            const noteOn = activeNotes.get(key);
            activeNotes.delete(key);
            track.notes.push({
                pitch: noteOn.pitch,
                startTick: noteOn.tick,
                durationTicks: tick - noteOn.tick,
                velocity: noteOn.velocity
            });
        }
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
