const NODE_TYPES = {
    source: {
        name: '信号源',
        icon: '◈',
        inputs: [],
        outputs: ['out'],
        defaultParams: { waveform: 'sine', frequency: 440, amplitude: 1 },
        paramDefs: [
            { key: 'waveform', label: '波形', type: 'select', options: [
                { value: 'sine', label: '正弦' },
                { value: 'square', label: '方波' },
                { value: 'sawtooth', label: '锯齿' },
                { value: 'noise', label: '噪声' }
            ]},
            { key: 'frequency', label: '频率(Hz)', type: 'number', min: 1, max: 4000 },
            { key: 'amplitude', label: '幅度', type: 'number', min: 0, max: 10, step: 0.1 }
        ]
    },
    gain: {
        name: '增益',
        icon: '×',
        inputs: ['in'],
        outputs: ['out'],
        defaultParams: { gain: 1 },
        paramDefs: [
            { key: 'gain', label: '系数', type: 'number', min: -10, max: 10, step: 0.1 }
        ]
    },
    adder: {
        name: '加法器',
        icon: 'Σ',
        inputs: ['a', 'b'],
        outputs: ['out'],
        defaultParams: {},
        paramDefs: []
    },
    delay: {
        name: '延迟',
        icon: '⏱',
        inputs: ['in'],
        outputs: ['out'],
        defaultParams: { samples: 100 },
        paramDefs: [
            { key: 'samples', label: '采样数', type: 'number', min: 1, max: 10000 }
        ]
    },
    filter: {
        name: '低通滤波',
        icon: '∿',
        inputs: ['in'],
        outputs: ['out'],
        defaultParams: { cutoff: 1000 },
        paramDefs: [
            { key: 'cutoff', label: '截止频率(Hz)', type: 'number', min: 1, max: 4000 }
        ]
    },
    scope: {
        name: '示波器',
        icon: '📈',
        inputs: ['in'],
        outputs: [],
        defaultParams: {},
        paramDefs: []
    }
};

const SAMPLE_RATE = 8000;
const FRAME_SIZE = 256;
const SCOPE_BUFFER_SIZE = 1024;

let nodes = [];
let wires = [];
let selectedNodeId = null;
let selectedWireId = null;
let nextNodeId = 1;
let nextWireId = 1;
let isRunning = false;
let animationFrameId = null;
let globalSampleIndex = 0;

const canvasContainer = document.getElementById('canvasContainer');
const nodesLayer = document.getElementById('nodesLayer');
const wireSvg = document.getElementById('wireSvg');
const statusLabel = document.getElementById('statusLabel');
const runBtn = document.getElementById('runBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const paramDialog = document.getElementById('paramDialog');
const paramTitle = document.getElementById('paramTitle');
const paramFields = document.getElementById('paramFields');
const paramOk = document.getElementById('paramOk');
const paramCancel = document.getElementById('paramCancel');
const toast = document.getElementById('toast');

let editingNodeId = null;
let tempParams = {};

let dragging = null;
let wiring = null;
let tempWirePath = null;

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

function createNode(type, x, y) {
    const def = NODE_TYPES[type];
    const node = {
        id: nextNodeId++,
        type: type,
        x: x,
        y: y,
        params: { ...def.defaultParams },
        state: {}
    };
    if (type === 'delay') {
        node.state.buffer = new Array(node.params.samples).fill(0);
        node.state.bufferIndex = 0;
    }
    if (type === 'filter') {
        node.state.prev = 0;
    }
    if (type === 'scope') {
        node.state.buffer = new Array(SCOPE_BUFFER_SIZE).fill(0);
        node.state.bufferIndex = 0;
    }
    nodes.push(node);
    renderNode(node);
    return node;
}

function renderNode(node) {
    const def = NODE_TYPES[node.type];
    const el = document.createElement('div');
    el.className = 'node';
    el.id = `node-${node.id}`;
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';

    const header = document.createElement('div');
    header.className = 'node-header';
    header.innerHTML = `<span class="node-type-icon">${def.icon}</span><span>${def.name}</span>`;
    el.appendChild(header);

    const body = document.createElement('div');
    body.className = 'node-body';

    if (node.type === 'scope') {
        const canvas = document.createElement('canvas');
        canvas.className = 'scope-canvas';
        canvas.width = 150;
        canvas.height = 80;
        canvas.id = `scope-${node.id}`;
        body.appendChild(canvas);
    } else {
        const paramsDiv = document.createElement('div');
        paramsDiv.className = 'node-params';
        const paramTexts = [];
        def.paramDefs.forEach(pd => {
            if (pd.type === 'select') {
                const opt = pd.options.find(o => o.value === node.params[pd.key]);
                paramTexts.push(`${pd.label}: ${opt ? opt.label : node.params[pd.key]}`);
            } else {
                paramTexts.push(`${pd.label}: ${node.params[pd.key]}`);
            }
        });
        paramsDiv.innerHTML = paramTexts.join('<br>') || '&nbsp;';
        body.appendChild(paramsDiv);
    }

    el.appendChild(body);

    def.inputs.forEach((name, i) => {
        const port = document.createElement('div');
        port.className = 'port input';
        port.dataset.nodeId = node.id;
        port.dataset.portName = name;
        port.dataset.portType = 'input';
        const portY = 40 + i * 22;
        port.style.top = portY + 'px';
        el.appendChild(port);

        const label = document.createElement('div');
        label.className = 'port-label input-label';
        label.textContent = name;
        label.style.top = portY + 7 + 'px';
        el.appendChild(label);
    });

    def.outputs.forEach((name, i) => {
        const port = document.createElement('div');
        port.className = 'port output';
        port.dataset.nodeId = node.id;
        port.dataset.portName = name;
        port.dataset.portType = 'output';
        const portY = 40 + i * 22;
        port.style.top = portY + 'px';
        el.appendChild(port);

        const label = document.createElement('div');
        label.className = 'port-label output-label';
        label.textContent = name;
        label.style.top = portY + 7 + 'px';
        el.appendChild(label);
    });

    nodesLayer.appendChild(el);
    attachNodeEvents(node, el);
}

function attachNodeEvents(node, el) {
    el.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('port')) return;
        selectNode(node.id);
        const startX = e.clientX;
        const startY = e.clientY;
        const origX = node.x;
        const origY = node.y;
        dragging = {
            type: 'node',
            node: node,
            startX, startY, origX, origY
        };
        e.preventDefault();
    });

    el.addEventListener('dblclick', (e) => {
        if (e.target.classList.contains('port')) return;
        openParamDialog(node.id);
    });

    el.querySelectorAll('.port').forEach(port => {
        port.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const portType = port.dataset.portType;
            if (portType !== 'output') return;
            startWiring(parseInt(port.dataset.nodeId), port.dataset.portName, e);
        });

        port.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            const portType = port.dataset.portType;
            if (wiring && portType === 'input') {
                finishWiring(parseInt(port.dataset.nodeId), port.dataset.portName);
            }
        });
    });
}

function selectNode(id) {
    selectedNodeId = id;
    selectedWireId = null;
    document.querySelectorAll('.node').forEach(n => n.classList.remove('selected'));
    if (id) {
        const el = document.getElementById(`node-${id}`);
        if (el) el.classList.add('selected');
    }
}

function selectWire(id) {
    selectedWireId = id;
    selectedNodeId = null;
    document.querySelectorAll('.node').forEach(n => n.classList.remove('selected'));
    wireSvg.querySelectorAll('.wire-path').forEach(w => w.setAttribute('stroke', w.dataset.id == id ? '#ff6b6b' : '#6bcb77'));
}

function deleteNode(id) {
    wires = wires.filter(w => {
        if (w.fromNode === id || w.toNode === id) {
            return false;
        }
        return true;
    });
    nodes = nodes.filter(n => n.id !== id);
    if (selectedNodeId === id) selectedNodeId = null;
    renderAll();
}

function deleteWire(id) {
    wires = wires.filter(w => w.id !== id);
    if (selectedWireId === id) selectedWireId = null;
    renderWires();
}

function renderAll() {
    nodesLayer.innerHTML = '';
    nodes.forEach(renderNode);
    renderWires();
}

function getPortPosition(nodeId, portType, portName) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const def = NODE_TYPES[node.type];
    const ports = portType === 'input' ? def.inputs : def.outputs;
    const idx = ports.indexOf(portName);
    const portY = 40 + idx * 22 + 7;
    const nodeEl = document.getElementById(`node-${nodeId}`);
    const width = nodeEl ? nodeEl.offsetWidth : 140;
    const portX = portType === 'input' ? 0 : width;
    return { x: node.x + portX, y: node.y + portY };
}

function renderWires() {
    wireSvg.querySelectorAll('.wire-path').forEach(p => p.remove());
    wireSvg.querySelectorAll('.temp-wire').forEach(p => p.remove());

    wires.forEach(wire => {
        const from = getPortPosition(wire.fromNode, 'output', wire.fromPort);
        const to = getPortPosition(wire.toNode, 'input', wire.toPort);
        drawWirePath(from, to, wire.id);
    });
}

function drawWirePath(from, to, wireId) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const dx = Math.max(40, Math.abs(to.x - from.x) * 0.5);
    const d = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
    path.setAttribute('d', d);
    path.setAttribute('stroke', wireId === selectedWireId ? '#ff6b6b' : '#6bcb77');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    path.classList.add('wire-path');
    if (wireId !== undefined) path.dataset.id = wireId;
    path.style.cursor = 'pointer';
    path.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        selectWire(wireId);
    });
    wireSvg.appendChild(path);
    return path;
}

function startWiring(fromNode, fromPort, e) {
    wiring = { fromNode, fromPort };
    const from = getPortPosition(fromNode, 'output', fromPort);
    tempWirePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempWirePath.classList.add('temp-wire');
    tempWirePath.setAttribute('stroke', '#4a9eff');
    tempWirePath.setAttribute('stroke-width', '2');
    tempWirePath.setAttribute('stroke-dasharray', '5,5');
    tempWirePath.setAttribute('fill', 'none');
    wireSvg.appendChild(tempWirePath);
    updateTempWire(e.clientX, e.clientY, from);
}

function updateTempWire(mouseX, mouseY, from) {
    if (!tempWirePath) return;
    const rect = canvasContainer.getBoundingClientRect();
    const to = { x: mouseX - rect.left, y: mouseY - rect.top };
    if (!from) {
        from = getPortPosition(wiring.fromNode, 'output', wiring.fromPort);
    }
    const dx = Math.max(40, Math.abs(to.x - from.x) * 0.5);
    const d = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
    tempWirePath.setAttribute('d', d);
}

function finishWiring(toNode, toPort) {
    if (!wiring) return;
    if (wiring.fromNode === toNode) {
        showToast('不能连接到自身');
        cleanupWiring();
        return;
    }
    const exists = wires.some(w => w.toNode === toNode && w.toPort === toPort);
    if (exists) {
        showToast('该输入端口已有连接');
        cleanupWiring();
        return;
    }
    const testWires = [...wires, {
        id: -1,
        fromNode: wiring.fromNode,
        fromPort: wiring.fromPort,
        toNode: toNode,
        toPort: toPort
    }];
    if (hasCycle(nodes, testWires)) {
        showToast('检测到环路，拒绝连接');
        cleanupWiring();
        return;
    }
    wires.push({
        id: nextWireId++,
        fromNode: wiring.fromNode,
        fromPort: wiring.fromPort,
        toNode: toNode,
        toPort: toPort
    });
    cleanupWiring();
    renderWires();
}

function cleanupWiring() {
    wiring = null;
    if (tempWirePath) {
        tempWirePath.remove();
        tempWirePath = null;
    }
}

function hasCycle(nodeList, wireList) {
    const adj = {};
    nodeList.forEach(n => adj[n.id] = []);
    wireList.forEach(w => {
        if (adj[w.fromNode]) adj[w.fromNode].push(w.toNode);
    });
    const visited = {};
    const recStack = {};
    function dfs(u) {
        if (recStack[u]) return true;
        if (visited[u]) return false;
        visited[u] = true;
        recStack[u] = true;
        if (adj[u]) {
            for (const v of adj[u]) {
                if (dfs(v)) return true;
            }
        }
        recStack[u] = false;
        return false;
    }
    for (const n of nodeList) {
        if (dfs(n.id)) return true;
    }
    return false;
}

function topoSort() {
    const inDegree = {};
    const adj = {};
    nodes.forEach(n => {
        inDegree[n.id] = 0;
        adj[n.id] = [];
    });
    wires.forEach(w => {
        adj[w.fromNode].push(w.toNode);
        inDegree[w.toNode] = (inDegree[w.toNode] || 0) + 1;
    });
    const queue = [];
    nodes.forEach(n => {
        if (inDegree[n.id] === 0) queue.push(n.id);
    });
    const result = [];
    while (queue.length > 0) {
        const u = queue.shift();
        result.push(u);
        for (const v of adj[u]) {
            inDegree[v]--;
            if (inDegree[v] === 0) queue.push(v);
        }
    }
    return result.map(id => nodes.find(n => n.id === id)).filter(Boolean);
}

document.addEventListener('mousemove', (e) => {
    if (dragging && dragging.type === 'node') {
        const rect = canvasContainer.getBoundingClientRect();
        dragging.node.x = Math.max(0, dragging.origX + (e.clientX - dragging.startX));
        dragging.node.y = Math.max(0, dragging.origY + (e.clientY - dragging.startY));
        const el = document.getElementById(`node-${dragging.node.id}`);
        if (el) {
            el.style.left = dragging.node.x + 'px';
            el.style.top = dragging.node.y + 'px';
        }
        renderWires();
    }
    if (wiring) {
        updateTempWire(e.clientX, e.clientY);
    }
});

document.addEventListener('mouseup', () => {
    dragging = null;
    if (wiring) cleanupWiring();
});

canvasContainer.addEventListener('mousedown', (e) => {
    if (e.target === canvasContainer || e.target === nodesLayer || e.target === wireSvg) {
        selectNode(null);
        selectedWireId = null;
        renderWires();
    }
});

document.addEventListener('keydown', (e) => {
    if (paramDialog.classList.contains('show')) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId !== null) {
            deleteNode(selectedNodeId);
        } else if (selectedWireId !== null) {
            deleteWire(selectedWireId);
        }
    }
});

document.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('nodeType', item.dataset.type);
    });
});

canvasContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
});

canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('nodeType');
    if (!type || !NODE_TYPES[type]) return;
    const rect = canvasContainer.getBoundingClientRect();
    const x = e.clientX - rect.left - 70;
    const y = e.clientY - rect.top - 30;
    createNode(type, x, y);
});

function openParamDialog(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const def = NODE_TYPES[node.type];
    editingNodeId = nodeId;
    tempParams = { ...node.params };
    paramTitle.textContent = `${def.name} 参数`;
    paramFields.innerHTML = '';

    if (def.paramDefs.length === 0) {
        const p = document.createElement('div');
        p.style.color = '#888';
        p.style.fontSize = '13px';
        p.textContent = '此节点无可配置参数';
        paramFields.appendChild(p);
    } else {
        def.paramDefs.forEach(pd => {
            const field = document.createElement('div');
            field.className = 'param-field';
            const label = document.createElement('label');
            label.textContent = pd.label;
            field.appendChild(label);

            let input;
            if (pd.type === 'select') {
                input = document.createElement('select');
                pd.options.forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt.value;
                    o.textContent = opt.label;
                    if (tempParams[pd.key] === opt.value) o.selected = true;
                    input.appendChild(o);
                });
            } else {
                input = document.createElement('input');
                input.type = pd.type;
                if (pd.min !== undefined) input.min = pd.min;
                if (pd.max !== undefined) input.max = pd.max;
                if (pd.step !== undefined) input.step = pd.step;
                input.value = tempParams[pd.key];
            }
            input.addEventListener('change', () => {
                let val = input.value;
                if (pd.type === 'number') val = parseFloat(val);
                tempParams[pd.key] = val;
            });
            field.appendChild(input);
            paramFields.appendChild(field);
        });
    }

    paramDialog.classList.add('show');
}

function closeParamDialog(apply) {
    if (apply && editingNodeId !== null) {
        const node = nodes.find(n => n.id === editingNodeId);
        if (node) {
            node.params = { ...tempParams };
            if (node.type === 'delay') {
                const newSize = Math.max(1, node.params.samples | 0);
                const newBuf = new Array(newSize).fill(0);
                if (node.state.buffer) {
                    const copyLen = Math.min(node.state.buffer.length, newSize);
                    for (let i = 0; i < copyLen; i++) {
                        newBuf[newSize - 1 - i] = node.state.buffer[(node.state.bufferIndex - 1 - i + node.state.buffer.length) % node.state.buffer.length] || 0;
                    }
                }
                node.state.buffer = newBuf;
                node.state.bufferIndex = 0;
            }
            renderAll();
        }
    }
    editingNodeId = null;
    paramDialog.classList.remove('show');
}

paramOk.addEventListener('click', () => closeParamDialog(true));
paramCancel.addEventListener('click', () => closeParamDialog(false));
paramDialog.addEventListener('click', (e) => {
    if (e.target === paramDialog) closeParamDialog(false);
});

function generateSource(node, n) {
    const out = new Array(n);
    const { waveform, frequency, amplitude } = node.params;
    for (let i = 0; i < n; i++) {
        const t = (globalSampleIndex + i) / SAMPLE_RATE;
        let v = 0;
        switch (waveform) {
            case 'sine':
                v = Math.sin(2 * Math.PI * frequency * t);
                break;
            case 'square':
                v = Math.sign(Math.sin(2 * Math.PI * frequency * t)) || 1;
                break;
            case 'sawtooth':
                v = 2 * ((frequency * t) % 1) - 1;
                break;
            case 'noise':
                v = Math.random() * 2 - 1;
                break;
        }
        out[i] = v * amplitude;
    }
    return out;
}

function processGain(node, input) {
    const out = new Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = input[i] * node.params.gain;
    return out;
}

function processAdder(node, inputA, inputB) {
    const n = Math.max(inputA.length, inputB.length);
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
        out[i] = (inputA[i] || 0) + (inputB[i] || 0);
    }
    return out;
}

function processDelay(node, input) {
    const out = new Array(input.length);
    const buf = node.state.buffer;
    for (let i = 0; i < input.length; i++) {
        out[i] = buf[node.state.bufferIndex];
        buf[node.state.bufferIndex] = input[i];
        node.state.bufferIndex = (node.state.bufferIndex + 1) % buf.length;
    }
    return out;
}

function processFilter(node, input) {
    const out = new Array(input.length);
    const dt = 1 / SAMPLE_RATE;
    const rc = 1 / (2 * Math.PI * node.params.cutoff);
    const alpha = dt / (rc + dt);
    let prev = node.state.prev;
    for (let i = 0; i < input.length; i++) {
        prev = prev + alpha * (input[i] - prev);
        out[i] = prev;
    }
    node.state.prev = prev;
    return out;
}

function processScope(node, input) {
    const buf = node.state.buffer;
    for (let i = 0; i < input.length; i++) {
        buf[node.state.bufferIndex] = input[i];
        node.state.bufferIndex = (node.state.bufferIndex + 1) % buf.length;
    }
    drawScope(node);
}

function drawScope(node) {
    const canvas = document.getElementById(`scope-${node.id}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += W / 8) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
    }
    for (let y = 0; y <= H; y += H / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }

    ctx.strokeStyle = '#334';
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    const buf = node.state.buffer;
    const startIdx = node.state.bufferIndex;
    ctx.strokeStyle = '#6bcb77';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < SCOPE_BUFFER_SIZE; i++) {
        const idx = (startIdx + i) % SCOPE_BUFFER_SIZE;
        const x = (i / SCOPE_BUFFER_SIZE) * W;
        const v = buf[idx];
        const y = H / 2 - (v / 2) * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

function simulationStep() {
    const sorted = topoSort();
    const outputs = {};

    sorted.forEach(node => {
        const def = NODE_TYPES[node.type];
        const inputSignals = {};
        def.inputs.forEach(portName => {
            const wire = wires.find(w => w.toNode === node.id && w.toPort === portName);
            if (wire) {
                const src = outputs[`${wire.fromNode}:${wire.fromPort}`];
                inputSignals[portName] = src || new Array(FRAME_SIZE).fill(0);
            } else {
                inputSignals[portName] = new Array(FRAME_SIZE).fill(0);
            }
        });

        let result;
        switch (node.type) {
            case 'source':
                result = generateSource(node, FRAME_SIZE);
                break;
            case 'gain':
                result = processGain(node, inputSignals['in']);
                break;
            case 'adder':
                result = processAdder(node, inputSignals['a'], inputSignals['b']);
                break;
            case 'delay':
                result = processDelay(node, inputSignals['in']);
                break;
            case 'filter':
                result = processFilter(node, inputSignals['in']);
                break;
            case 'scope':
                processScope(node, inputSignals['in']);
                result = null;
                break;
        }

        if (result) {
            def.outputs.forEach(portName => {
                outputs[`${node.id}:${portName}`] = result;
            });
        }
    });

    globalSampleIndex += FRAME_SIZE;
}

function runLoop() {
    if (!isRunning) return;
    simulationStep();
    animationFrameId = requestAnimationFrame(runLoop);
}

function startSimulation() {
    if (nodes.length === 0) {
        showToast('请先添加节点');
        return;
    }
    if (hasCycle(nodes, wires)) {
        showToast('检测到环路，无法运行');
        return;
    }
    nodes.forEach(node => {
        if (node.type === 'delay') {
            node.state.buffer = new Array(node.params.samples | 0 || 1).fill(0);
            node.state.bufferIndex = 0;
        }
        if (node.type === 'filter') {
            node.state.prev = 0;
        }
        if (node.type === 'scope') {
            node.state.buffer = new Array(SCOPE_BUFFER_SIZE).fill(0);
            node.state.bufferIndex = 0;
            drawScope(node);
        }
    });
    globalSampleIndex = 0;
    isRunning = true;
    statusLabel.textContent = '运行中';
    statusLabel.classList.add('running');
    runBtn.classList.add('running');
    runLoop();
}

function stopSimulation() {
    isRunning = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    statusLabel.textContent = '已停止';
    statusLabel.classList.remove('running');
    runBtn.classList.remove('running');
}

function clearAll() {
    if (isRunning) stopSimulation();
    nodes = [];
    wires = [];
    selectedNodeId = null;
    selectedWireId = null;
    renderAll();
}

runBtn.addEventListener('click', startSimulation);
stopBtn.addEventListener('click', stopSimulation);
clearBtn.addEventListener('click', clearAll);

setInterval(() => {
    if (isRunning) renderWires();
}, 100);
