const GROUP_COLORS = [
    'rgba(74, 158, 255, 0.35)',
    'rgba(107, 203, 119, 0.35)',
    'rgba(255, 217, 61, 0.35)',
    'rgba(255, 159, 67, 0.35)',
    'rgba(155, 89, 182, 0.35)',
    'rgba(236, 64, 122, 0.35)',
    'rgba(26, 188, 156, 0.35)',
    'rgba(230, 126, 34, 0.35)'
];

const GROUP_TEXT_COLORS = [
    '#4a9eff',
    '#6bcb77',
    '#ffd93d',
    '#ff9f43',
    '#9b59b6',
    '#ec407a',
    '#1abc9c',
    '#e67e22'
];

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getFlags() {
    let flags = '';
    if (document.getElementById('flagG').checked) flags += 'g';
    if (document.getElementById('flagI').checked) flags += 'i';
    if (document.getElementById('flagM').checked) flags += 'm';
    if (document.getElementById('flagS').checked) flags += 's';
    return flags;
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (message) {
        el.textContent = message;
        el.classList.add('show');
    } else {
        el.textContent = '';
        el.classList.remove('show');
    }
}

function runMatch() {
    const regexStr = document.getElementById('regexInput').value;
    const testStr = document.getElementById('testInput').value;
    const flags = getFlags();

    showError('regexError', '');
    showError('astError', '');

    const highlightOutput = document.getElementById('highlightOutput');
    const matchesBody = document.getElementById('matchesBody');
    const matchCount = document.getElementById('matchCount');

    matchesBody.innerHTML = '';
    highlightOutput.innerHTML = '';
    matchCount.textContent = '0 个匹配';

    if (!regexStr) {
        highlightOutput.innerHTML = escapeHtml(testStr);
        return;
    }

    try {
        new RegExp(regexStr, flags);
    } catch (e) {
        showError('regexError', '正则语法错误: ' + e.message);
        highlightOutput.innerHTML = escapeHtml(testStr);
        return;
    }

    const matches = [];
    const re = new RegExp(regexStr, flags.includes('g') ? flags : flags + 'g');
    let m;
    while ((m = re.exec(testStr)) !== null) {
        matches.push(m);
        if (!flags.includes('g')) break;
        if (m.index === re.lastIndex) re.lastIndex++;
    }

    renderHighlight(testStr, matches);
    renderMatchesTable(matches);
    matchCount.textContent = matches.length + ' 个匹配';
}

function renderHighlight(text, matches) {
    const output = document.getElementById('highlightOutput');
    if (!text) {
        output.innerHTML = '';
        return;
    }
    if (matches.length === 0) {
        output.innerHTML = escapeHtml(text);
        return;
    }

    const regexStr = document.getElementById('regexInput').value;
    const flags = getFlags();
    let dSupported = true;
    let groupMatches = [];
    try {
        const dre = new RegExp(regexStr, (flags.includes('g') ? flags : flags + 'g') + 'd');
        let dm;
        while ((dm = dre.exec(text)) !== null) {
            groupMatches.push(dm);
            if (!flags.includes('g')) break;
            if (dm.index === dre.lastIndex) dre.lastIndex++;
        }
    } catch (e) {
        dSupported = false;
    }

    const segments = [];
    let lastEnd = 0;

    matches.forEach((match, matchIdx) => {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;
        const matchColorIdx = matchIdx % GROUP_COLORS.length;

        if (matchStart > lastEnd) {
            segments.push({
                start: lastEnd,
                end: matchStart,
                text: text.slice(lastEnd, matchStart),
                type: 'normal'
            });
        }

        const groupSpans = [];
        if (dSupported && groupMatches[matchIdx] && groupMatches[matchIdx].indices) {
            const indices = groupMatches[matchIdx].indices;
            for (let gi = 1; gi < indices.length; gi++) {
                if (indices[gi]) {
                    groupSpans.push({
                        start: indices[gi][0],
                        end: indices[gi][1],
                        groupIndex: gi
                    });
                }
            }
        }

        if (groupSpans.length === 0) {
            segments.push({
                start: matchStart,
                end: matchEnd,
                text: match[0],
                type: 'match',
                colorIdx: matchColorIdx
            });
        } else {
            groupSpans.sort((a, b) => a.start - b.start);
            let cursor = matchStart;
            groupSpans.forEach(gs => {
                if (gs.start > cursor) {
                    segments.push({
                        start: cursor,
                        end: gs.start,
                        text: text.slice(cursor, gs.start),
                        type: 'match',
                        colorIdx: matchColorIdx
                    });
                }
                segments.push({
                    start: gs.start,
                    end: gs.end,
                    text: text.slice(gs.start, gs.end),
                    type: 'group',
                    colorIdx: (gs.groupIndex - 1) % GROUP_COLORS.length,
                    groupIndex: gs.groupIndex
                });
                cursor = gs.end;
            });
            if (cursor < matchEnd) {
                segments.push({
                    start: cursor,
                    end: matchEnd,
                    text: text.slice(cursor, matchEnd),
                    type: 'match',
                    colorIdx: matchColorIdx
                });
            }
        }

        lastEnd = matchEnd;
    });

    if (lastEnd < text.length) {
        segments.push({
            start: lastEnd,
            end: text.length,
            text: text.slice(lastEnd),
            type: 'normal'
        });
    }

    let html = '';
    segments.forEach(seg => {
        if (seg.type === 'normal') {
            html += escapeHtml(seg.text);
        } else if (seg.type === 'match') {
            const c = GROUP_COLORS[seg.colorIdx];
            const tc = GROUP_TEXT_COLORS[seg.colorIdx];
            html += '<mark style="background-color:' + c + '; border-bottom: 2px solid ' + tc + '; border-radius: 2px; padding: 1px 0;">' + escapeHtml(seg.text) + '</mark>';
        } else if (seg.type === 'group') {
            const c = GROUP_COLORS[seg.colorIdx];
            const tc = GROUP_TEXT_COLORS[seg.colorIdx];
            html += '<span style="background-color:' + c + '; color:' + tc + '; border-radius: 2px; padding: 1px 0; border-bottom: 2px solid ' + tc + '; font-weight: 600;" title="捕获组 $' + seg.groupIndex + '">' + escapeHtml(seg.text) + '</span>';
        }
    });

    output.innerHTML = html;
}

function renderMatchesTable(matches) {
    const tbody = document.getElementById('matchesBody');
    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:#555; text-align:center; padding:20px;">无匹配结果</td></tr>';
        return;
    }

    let html = '';
    matches.forEach((match, idx) => {
        const pos = match.index + '-' + (match.index + match[0].length);
        let groupsHtml = '';
        if (match.length > 1) {
            for (let i = 1; i < match.length; i++) {
                const g = match[i];
                if (g !== undefined) {
                    const colorIdx = (i - 1) % GROUP_COLORS.length;
                    groupsHtml += '<span class="capture-group" style="background-color:' + GROUP_COLORS[colorIdx] + '; color:' + GROUP_TEXT_COLORS[colorIdx] + ';">$' + i + ':' + escapeHtml(g) + '</span> ';
                }
            }
        }
        if (!groupsHtml) groupsHtml = '<span style="color:#555;">(无)</span>';

        html += '<tr><td class="col-index">' + (idx + 1) + '</td><td class="col-position">' + pos + '</td><td>' + escapeHtml(match[0]) + '</td><td>' + groupsHtml + '</td></tr>';
    });

    tbody.innerHTML = html;
}

class RegexParser {
    constructor(input) {
        this.input = input;
        this.pos = 0;
    }

    eof() {
        return this.pos >= this.input.length;
    }

    peek() {
        return this.input[this.pos];
    }

    advance() {
        return this.input[this.pos++];
    }

    expect(ch) {
        if (this.peek() === ch) {
            this.advance();
            return true;
        }
        return false;
    }

    parse() {
        const result = this.parsePattern();
        return { type: 'pattern', children: [result] };
    }

    parsePattern() {
        const alternatives = [];
        alternatives.push(this.parseSequence());
        while (this.peek() === '|') {
            this.advance();
            alternatives.push(this.parseSequence());
        }
        if (alternatives.length === 1) return alternatives[0];
        return { type: 'alternation', alternatives: alternatives };
    }

    parseSequence() {
        const items = [];
        while (!this.eof()) {
            const atom = this.parseAtom();
            if (atom) items.push(atom);
            else break;
        }
        if (items.length === 0) return { type: 'empty' };
        if (items.length === 1) return items[0];
        return { type: 'sequence', items: items };
    }

    parseAtom() {
        if (this.eof()) return null;
        const ch = this.peek();
        if (ch === '|' || ch === ')') return null;

        let atom;

        if (ch === '(') {
            atom = this.parseGroup();
        } else if (ch === '[') {
            atom = this.parseCharacterClass();
        } else if (ch === '\\') {
            atom = this.parseEscape();
        } else if (ch === '^' || ch === '$') {
            this.advance();
            atom = { type: 'anchor', value: ch };
        } else if (ch === '.') {
            this.advance();
            atom = { type: 'dot' };
        } else if (ch === '*' || ch === '+' || ch === '?') {
            return null;
        } else {
            this.advance();
            atom = { type: 'literal', value: ch };
        }

        if (!this.eof()) {
            const q = this.parseQuantifier();
            if (q) {
                q.child = atom;
                return q;
            }
        }
        return atom;
    }

    parseGroup() {
        this.advance();
        if (this.eof()) return { type: 'unsupported', value: '(' };
        let ch = this.peek();
        let kind = 'capture';
        let name = null;

        if (ch === '?') {
            this.advance();
            if (this.eof()) return { type: 'unsupported', value: '(?' };
            ch = this.peek();
            if (ch === ':') {
                this.advance();
                kind = 'non-capture';
            } else if (ch === '=') {
                this.advance();
                kind = 'lookahead';
                const inner = this.parseUntil(')');
                this.expect(')');
                return { type: 'unsupported', value: '(?=...)', kind: 'positive-lookahead', child: inner };
            } else if (ch === '!') {
                this.advance();
                kind = 'negative-lookahead';
                const inner = this.parseUntil(')');
                this.expect(')');
                return { type: 'unsupported', value: '(?!...)', kind: 'negative-lookahead', child: inner };
            } else if (ch === '<') {
                this.advance();
                if (this.peek() === '=') {
                    this.advance();
                    kind = 'lookbehind';
                    const inner = this.parseUntil(')');
                    this.expect(')');
                    return { type: 'unsupported', value: '(?<=...)', kind: 'positive-lookbehind', child: inner };
                } else if (this.peek() === '!') {
                    this.advance();
                    kind = 'negative-lookbehind';
                    const inner = this.parseUntil(')');
                    this.expect(')');
                    return { type: 'unsupported', value: '(?<!...)', kind: 'negative-lookbehind', child: inner };
                } else {
                    name = '';
                    while (!this.eof() && this.peek() !== '>') {
                        name += this.advance();
                    }
                    if (this.expect('>')) {
                        kind = 'named';
                    } else {
                        return { type: 'unsupported', value: '(?<' + name + '...)' };
                    }
                }
            } else {
                return { type: 'unsupported', value: '(?' + ch + '...)' };
            }
        }

        const child = this.parsePattern();
        if (!this.expect(')')) {
            return { type: 'unsupported', value: 'unclosed group' };
        }

        return { type: 'group', kind: kind, name: name, child: child };
    }

    parseUntil(endChar) {
        let content = '';
        while (!this.eof()) {
            if (this.peek() === endChar) {
                break;
            }
            if (this.peek() === '\\' && this.pos + 1 < this.input.length) {
                content += this.advance();
            }
            content += this.advance();
        }
        try {
            const subParser = new RegexParser(content);
            return subParser.parsePattern();
        } catch (e) {
            return { type: 'unsupported', value: content };
        }
    }

    parseCharacterClass() {
        this.advance();
        const result = { type: 'characterClass', negated: false, members: [] };
        if (this.peek() === '^') {
            result.negated = true;
            this.advance();
        }

        while (!this.eof() && this.peek() !== ']') {
            if (this.peek() === '\\') {
                this.advance();
                const esc = this.peek();
                if (esc) {
                    this.advance();
                    result.members.push({ type: 'escape', kind: esc });
                }
            } else {
                const start = this.advance();
                if (this.peek() === '-' && this.pos + 1 < this.input.length && this.input[this.pos + 1] !== ']') {
                    this.advance();
                    const end = this.advance();
                    result.members.push({ type: 'range', start: start, end: end });
                } else {
                    result.members.push({ type: 'literal', value: start });
                }
            }
        }

        if (!this.expect(']')) {
            return { type: 'unsupported', value: '[unclosed class' };
        }
        return result;
    }

    parseEscape() {
        this.advance();
        if (this.eof()) return { type: 'literal', value: '\\' };
        const ch = this.advance();
        const simpleMap = {
            'd': { type: 'escape', kind: 'digit' },
            'D': { type: 'escape', kind: 'non-digit' },
            'w': { type: 'escape', kind: 'word' },
            'W': { type: 'escape', kind: 'non-word' },
            's': { type: 'escape', kind: 'whitespace' },
            'S': { type: 'escape', kind: 'non-whitespace' },
            'b': { type: 'anchor', value: '\\b' },
            'B': { type: 'anchor', value: '\\B' },
            'n': { type: 'literal', value: '\n' },
            't': { type: 'literal', value: '\t' },
            'r': { type: 'literal', value: '\r' },
            'f': { type: 'literal', value: '\f' },
            'v': { type: 'literal', value: '\v' },
            '0': { type: 'literal', value: '\0' }
        };

        if (simpleMap[ch]) {
            return simpleMap[ch];
        }

        if (/[1-9]/.test(ch)) {
            return { type: 'backreference', index: parseInt(ch, 10) };
        }

        return { type: 'literal', value: ch };
    }

    parseQuantifier() {
        const ch = this.peek();
        let result = null;

        if (ch === '*') {
            this.advance();
            result = { type: 'quantifier', kind: 'star', min: 0, max: Infinity };
        } else if (ch === '+') {
            this.advance();
            result = { type: 'quantifier', kind: 'plus', min: 1, max: Infinity };
        } else if (ch === '?') {
            this.advance();
            result = { type: 'quantifier', kind: 'question', min: 0, max: 1 };
        } else if (ch === '{') {
            this.advance();
            let min = '';
            let max = '';
            let hasComma = false;
            while (!this.eof() && /\d/.test(this.peek())) {
                min += this.advance();
            }
            if (this.peek() === ',') {
                hasComma = true;
                this.advance();
                while (!this.eof() && /\d/.test(this.peek())) {
                    max += this.advance();
                }
            }
            if (this.expect('}')) {
                const minNum = min ? parseInt(min, 10) : 0;
                const maxNum = hasComma ? (max ? parseInt(max, 10) : Infinity) : minNum;
                result = { type: 'quantifier', kind: 'brace', min: minNum, max: maxNum };
            } else {
                return null;
            }
        } else {
            return null;
        }

        if (result && !this.eof() && this.peek() === '?') {
            this.advance();
            result.greedy = false;
        } else if (result) {
            result.greedy = true;
        }
        return result;
    }
}

function parseRegex(str) {
    const parser = new RegexParser(str);
    return parser.parse();
}

function astToHtml(node, indent) {
    if (indent === undefined) indent = 0;
    const pad = '&nbsp;&nbsp;'.repeat(indent);
    if (!node) return '';
    let s = '';

    function wrap(type, rest) {
        if (rest === undefined) rest = '';
        return '<div><span class="ast-type">' + type + '</span>' + rest + '</div>';
    }

    function val(v) {
        return ' <span class="ast-value">' + escapeHtml(v) + '</span>';
    }

    function lit(v) {
        return ' <span class="ast-literal">' + escapeHtml(JSON.stringify(v)) + '</span>';
    }

    function meta(v) {
        return ' <span class="ast-meta">' + escapeHtml(v) + '</span>';
    }

    switch (node.type) {
        case 'pattern':
            s += pad + wrap('Pattern');
            if (node.children) {
                node.children.forEach(function (c) { s += astToHtml(c, indent + 1); });
            }
            return s;
        case 'sequence':
            s += pad + wrap('Sequence');
            node.items.forEach(function (item) { s += astToHtml(item, indent + 1); });
            return s;
        case 'alternation':
            s += pad + wrap('Alternation', meta('(|)'));
            node.alternatives.forEach(function (alt, i) {
                s += '<div>' + '&nbsp;&nbsp;'.repeat(indent + 1) + '<span class="ast-meta">alternative ' + (i + 1) + ':</span></div>';
                s += astToHtml(alt, indent + 2);
            });
            return s;
        case 'literal':
            return pad + wrap('Literal', lit(node.value));
        case 'dot':
            return pad + wrap('Any', meta('(.)'));
        case 'anchor':
            return pad + wrap('Anchor', lit(node.value));
        case 'escape':
            return pad + wrap('Escape', val('\\' + (node.kind || node.value)));
        case 'characterClass':
            s += pad + wrap('Character Class', node.negated ? meta('(negated)') : '');
            node.members.forEach(function (m) { s += astToHtml(m, indent + 1); });
            return s;
        case 'range':
            return pad + wrap('Range', lit(node.start) + meta(' - ') + lit(node.end));
        case 'quantifier': {
            let range;
            if (node.kind === 'star') range = '0..∞';
            else if (node.kind === 'plus') range = '1..∞';
            else if (node.kind === 'question') range = '0..1';
            else range = node.min + '..' + (node.max === Infinity ? '∞' : node.max);
            s += pad + wrap('Quantifier', val(range) + (node.greedy ? meta(' (greedy)') : meta(' (lazy)')));
            s += astToHtml(node.child, indent + 1);
            return s;
        }
        case 'group': {
            let label = 'Group';
            if (node.kind === 'non-capture') label = 'Group (non-capturing)';
            else if (node.kind === 'named') label = 'Group (named: ' + node.name + ')';
            else label = 'Group (capturing)';
            s += pad + wrap(label);
            s += astToHtml(node.child, indent + 1);
            return s;
        }
        case 'backreference':
            return pad + wrap('Backreference', val('\\' + node.index));
        case 'empty':
            return pad + wrap('Empty');
        case 'unsupported':
            s += pad + wrap('Unsupported', lit(node.value) + (node.kind ? meta(' (' + node.kind + ')') : ''));
            if (node.child) s += astToHtml(node.child, indent + 1);
            return s;
        default:
            return pad + wrap(node.type || 'unknown');
    }
}

function renderAst(ast) {
    const output = document.getElementById('astOutput');
    if (!ast) {
        output.innerHTML = '';
        return;
    }
    output.innerHTML = astToHtml(ast, 0);
}

function refreshAst() {
    showError('astError', '');
    const regexStr = document.getElementById('regexInput').value;
    if (!regexStr) {
        renderAst(null);
        return;
    }
    try {
        const ast = parseRegex(regexStr);
        renderAst(ast);
    } catch (e) {
        showError('astError', '解析错误: ' + e.message);
        renderAst(null);
    }
}

// ============================================================
// Step Debugger: NFA Compiler + Backtracking Stepper
// ============================================================

class NFACompiler {
    constructor(regexStr) {
        this.regexStr = regexStr;
        this.instructions = [];
        this.groupCounter = 0;
    }

    emit(type, data, tokenStart, tokenEnd) {
        const instr = { type, data: data || {}, tokenStart, tokenEnd, index: this.instructions.length };
        this.instructions.push(instr);
        return instr.index;
    }

    patch(instrIndex, target) {
        this.instructions[instrIndex].data.target = target;
    }

    patchSplit(instrIndex, target1, target2) {
        if (target1 !== undefined) this.instructions[instrIndex].data.target1 = target1;
        if (target2 !== undefined) this.instructions[instrIndex].data.target2 = target2;
    }

    compile(ast) {
        const end = this.compileNode(ast.children[0]);
        this.emit('MATCH', {}, this.regexStr.length, this.regexStr.length);
        return this.instructions;
    }

    compileNode(node) {
        if (!node) return this.instructions.length;

        switch (node.type) {
            case 'sequence':
                return this.compileSequence(node);
            case 'alternation':
                return this.compileAlternation(node);
            case 'literal':
                return this.compileLiteral(node);
            case 'dot':
                return this.compileDot(node);
            case 'characterClass':
                return this.compileCharacterClass(node);
            case 'escape':
                return this.compileEscape(node);
            case 'quantifier':
                return this.compileQuantifier(node);
            case 'group':
                return this.compileGroup(node);
            case 'anchor':
                return this.compileAnchor(node);
            case 'empty':
                return this.instructions.length;
            default:
                return this.instructions.length;
        }
    }

    compileAnchor(node) {
        const start = node._start !== undefined ? node._start : 0;
        const end = node._end !== undefined ? node._end : 1;
        let anchorType = node.value;
        if (anchorType === '^') {
            return this.emit('ASSERT_START', {}, start, end);
        } else if (anchorType === '$') {
            return this.emit('ASSERT_END', {}, start, end);
        } else if (anchorType === '\\b') {
            return this.emit('ASSERT_WORD_BOUNDARY', {}, start, end);
        } else if (anchorType === '\\B') {
            return this.emit('ASSERT_NON_WORD_BOUNDARY', {}, start, end);
        }
        return this.instructions.length;
    }

    compileSequence(node) {
        let pos = this.instructions.length;
        for (const item of node.items) {
            this.compileNode(item);
        }
        return pos;
    }

    compileAlternation(node) {
        const alts = node.alternatives;
        const splits = [];
        const ends = [];

        for (let i = 0; i < alts.length - 1; i++) {
            const splitIdx = this.emit('SPLIT', {}, node._start || 0, node._end || 0);
            splits.push(splitIdx);
            const firstAltStart = this.instructions.length;
            this.patchSplit(splitIdx, firstAltStart, undefined);
            this.compileNode(alts[i]);
            const jumpIdx = this.emit('JUMP', {}, node._start || 0, node._end || 0);
            ends.push(jumpIdx);
            const secondAltStart = this.instructions.length;
            this.patchSplit(splitIdx, firstAltStart, secondAltStart);
        }

        this.compileNode(alts[alts.length - 1]);

        const endIdx = this.instructions.length;
        for (const jumpIdx of ends) {
            this.patch(jumpIdx, endIdx);
        }
        return splits[0] || this.instructions.length;
    }

    compileLiteral(node) {
        const start = node._start !== undefined ? node._start : 0;
        const end = node._end !== undefined ? node._end : 1;
        return this.emit('MATCH_CHAR', { char: node.value, caseInsensitive: false }, start, end);
    }

    compileDot(node) {
        const start = node._start !== undefined ? node._start : 0;
        const end = node._end !== undefined ? node._end : 1;
        return this.emit('MATCH_DOT', {}, start, end);
    }

    compileCharacterClass(node) {
        const start = node._start !== undefined ? node._start : 0;
        const end = node._end !== undefined ? node._end : 1;
        return this.emit('MATCH_CLASS', { negated: node.negated, members: node.members }, start, end);
    }

    compileEscape(node) {
        const start = node._start !== undefined ? node._start : 0;
        const end = node._end !== undefined ? node._end : 2;
        const kind = node.kind;
        if (kind === 'digit' || kind === 'non-digit' || kind === 'word' || kind === 'non-word' || kind === 'whitespace' || kind === 'non-whitespace') {
            return this.emit('MATCH_CLASS', { negated: kind.startsWith('non-'), escapeKind: kind }, start, end);
        }
        return this.emit('MATCH_CHAR', { char: node.value, caseInsensitive: false }, start, end);
    }

    compileQuantifier(node) {
        const min = node.min;
        const max = node.max;
        const greedy = node.greedy;

        const start = node._start !== undefined ? node._start : 0;
        const end = node._end !== undefined ? node._end : (this.regexStr.length);

        let prefixEnd = this.instructions.length;
        for (let i = 0; i < min; i++) {
            this.compileNode(node.child);
        }

        if (max === Infinity) {
            const loopStart = this.instructions.length;
            if (greedy) {
                const splitIdx = this.emit('SPLIT', {}, start, end);
                const childStart = this.instructions.length;
                this.compileNode(node.child);
                const jumpIdx = this.emit('JUMP', {}, start, end);
                this.patch(jumpIdx, loopStart);
                const afterLoop = this.instructions.length;
                this.patchSplit(splitIdx, childStart, afterLoop);
            } else {
                const splitIdx = this.emit('SPLIT', {}, start, end);
                const childStart = this.instructions.length;
                this.compileNode(node.child);
                const jumpIdx = this.emit('JUMP', {}, start, end);
                this.patch(jumpIdx, loopStart);
                const afterLoop = this.instructions.length;
                this.patchSplit(splitIdx, afterLoop, childStart);
            }
        } else {
            const optionalCount = max - min;
            for (let i = 0; i < optionalCount; i++) {
                if (greedy) {
                    const splitIdx = this.emit('SPLIT', {}, start, end);
                    const childStart = this.instructions.length;
                    this.compileNode(node.child);
                    const afterChild = this.instructions.length;
                    this.patchSplit(splitIdx, childStart, afterChild);
                } else {
                    const splitIdx = this.emit('SPLIT', {}, start, end);
                    const childStart = this.instructions.length;
                    this.compileNode(node.child);
                    const afterChild = this.instructions.length;
                    this.patchSplit(splitIdx, afterChild, childStart);
                }
            }
        }

        return prefixEnd;
    }

    compileGroup(node) {
        const start = node._start !== undefined ? node._start : 0;
        const end = node._end !== undefined ? node._end : 1;

        if (node.kind === 'capture' || node.kind === 'named') {
            this.groupCounter++;
            const groupNum = this.groupCounter;
            this.emit('SAVE_GROUP_START', { groupNum }, start, start + 1);
            this.compileNode(node.child);
            this.emit('SAVE_GROUP_END', { groupNum }, end - 1, end);
        } else {
            this.compileNode(node.child);
        }
        return this.instructions.length;
    }
}

function annotateAstWithPositions(node, regexStr, pos) {
    if (!node) return pos;

    switch (node.type) {
        case 'pattern':
            node._start = pos;
            pos = annotateAstWithPositions(node.children[0], regexStr, pos);
            node._end = pos;
            return pos;

        case 'sequence': {
            node._start = pos;
            const startPos = pos;
            for (const item of node.items) {
                pos = annotateAstWithPositions(item, regexStr, pos);
            }
            node._end = pos;
            return pos;
        }

        case 'alternation': {
            node._start = pos;
            const startPos = pos;
            for (let i = 0; i < node.alternatives.length; i++) {
                pos = annotateAstWithPositions(node.alternatives[i], regexStr, pos);
                if (i < node.alternatives.length - 1) {
                    if (regexStr[pos] === '|') pos++;
                }
            }
            node._end = pos;
            return pos;
        }

        case 'literal':
            node._start = pos;
            pos += 1;
            node._end = pos;
            return pos;

        case 'dot':
            node._start = pos;
            pos += 1;
            node._end = pos;
            return pos;

        case 'anchor':
            node._start = pos;
            if (node.value === '\\b' || node.value === '\\B') pos += 2;
            else pos += 1;
            node._end = pos;
            return pos;

        case 'escape': {
            node._start = pos;
            pos += 2;
            node._end = pos;
            return pos;
        }

        case 'characterClass': {
            node._start = pos;
            let p = pos;
            p++;
            if (regexStr[p] === '^') p++;
            while (p < regexStr.length && regexStr[p] !== ']') {
                if (regexStr[p] === '\\' && p + 1 < regexStr.length) {
                    p += 2;
                } else {
                    p++;
                }
            }
            if (p < regexStr.length) p++;
            node._end = p;
            return p;
        }

        case 'quantifier': {
            pos = annotateAstWithPositions(node.child, regexStr, pos);
            node._start = node.child._start;
            const qStart = pos;
            if (node.kind === 'star' || node.kind === 'plus' || node.kind === 'question') {
                pos += 1;
            } else if (node.kind === 'brace') {
                while (pos < regexStr.length && regexStr[pos] !== '}') pos++;
                if (pos < regexStr.length) pos++;
            }
            if (pos < regexStr.length && regexStr[pos] === '?') pos++;
            node._end = pos;
            return pos;
        }

        case 'group': {
            node._start = pos;
            let p = pos;
            p++;
            if (regexStr[p] === '?') {
                p++;
                if (regexStr[p] === ':' || regexStr[p] === '=' || regexStr[p] === '!') p++;
                else if (regexStr[p] === '<') {
                    p++;
                    while (p < regexStr.length && regexStr[p] !== '>') p++;
                    if (p < regexStr.length) p++;
                }
            }
            pos = annotateAstWithPositions(node.child, regexStr, p);
            if (pos < regexStr.length && regexStr[pos] === ')') pos++;
            node._end = pos;
            return pos;
        }

        case 'backreference':
            node._start = pos;
            pos += 2;
            node._end = pos;
            return pos;

        case 'empty':
            node._start = pos;
            node._end = pos;
            return pos;

        default:
            return pos;
    }
}

function characterClassMatches(node, ch, caseInsensitive) {
    caseInsensitive = caseInsensitive || false;
    const testCh = caseInsensitive ? ch.toLowerCase() : ch;
    if (node.escapeKind) {
        const kind = node.escapeKind;
        const isDigit = /\d/.test(ch);
        const isWord = /\w/.test(ch);
        const isWhitespace = /\s/.test(ch);
        switch (kind) {
            case 'digit': return isDigit;
            case 'non-digit': return !isDigit;
            case 'word': return isWord;
            case 'non-word': return !isWord;
            case 'whitespace': return isWhitespace;
            case 'non-whitespace': return !isWhitespace;
            default: return false;
        }
    }
    let matched = false;
    for (const member of node.members) {
        if (member.type === 'literal') {
            const memVal = caseInsensitive ? member.value.toLowerCase() : member.value;
            if (testCh === memVal) { matched = true; break; }
        } else if (member.type === 'range') {
            const rStart = caseInsensitive ? member.start.toLowerCase() : member.start;
            const rEnd = caseInsensitive ? member.end.toLowerCase() : member.end;
            if (testCh >= rStart && testCh <= rEnd) { matched = true; break; }
        } else if (member.type === 'escape') {
            const kind = member.kind;
            const isDigit = /\d/.test(ch);
            const isWord = /\w/.test(ch);
            const isWhitespace = /\s/.test(ch);
            if ((kind === 'd' && isDigit) || (kind === 'D' && !isDigit) ||
                (kind === 'w' && isWord) || (kind === 'W' && !isWord) ||
                (kind === 's' && isWhitespace) || (kind === 'S' && !isWhitespace)) {
                matched = true; break;
            }
        }
    }
    return node.negated ? !matched : matched;
}

class NFAStepper {
    constructor(instructions, text, startPos, regexStr, flags) {
        this.instructions = instructions;
        this.text = text;
        this.startPos = startPos;
        this.regexStr = regexStr;
        this.flags = flags || {};
        this.steps = [];
        this.currentStepIndex = -1;
        this.finished = false;
        this.succeeded = false;
    }

    run() {
        this.steps = [];
        this.finished = false;
        this.succeeded = false;

        const caseInsensitive = !!this.flags.i;
        const multiline = !!this.flags.m;
        const dotAll = !!this.flags.s;

        const textLen = this.text.length;
        const startPos = this.startPos;

        const backtrackStack = [];
        let pc = 0;
        let sp = startPos;
        let groups = {};

        this.recordStep({
            pc, sp, groups: { ...groups },
            stack: [],
            action: 'init',
            description: `从文本位置 ${startPos} 开始匹配`,
            isBacktrack: false
        });

        const MAX_STEPS = 10000;
        let stepCount = 0;

        while (stepCount < MAX_STEPS) {
            stepCount++;
            if (pc >= this.instructions.length) break;

            const instr = this.instructions[pc];

            switch (instr.type) {
                case 'MATCH_CHAR': {
                    const ch = instr.data.char;
                    if (sp < textLen) {
                        const textCh = this.text[sp];
                        const match = caseInsensitive ? ch.toLowerCase() === textCh.toLowerCase() : ch === textCh;
                        if (match) {
                            const ciStr = caseInsensitive && ch.toLowerCase() !== ch ? ' (忽略大小写)' : '';
                            this.recordStep({
                                pc, sp, groups: { ...groups },
                                stack: this.copyStack(backtrackStack),
                                action: 'match_char',
                                description: `字符匹配${ciStr}: '${escapeForDisplay(textCh)}' == '${escapeForDisplay(ch)}'`,
                                isBacktrack: false,
                                matched: true
                            });
                            pc++;
                            sp++;
                            continue;
                        }
                    }
                    const ciStr = caseInsensitive ? ' (忽略大小写)' : '';
                    this.recordStep({
                        pc, sp, groups: { ...groups },
                        stack: this.copyStack(backtrackStack),
                        action: 'fail_char',
                        description: sp < textLen
                            ? `字符不匹配${ciStr}: '${escapeForDisplay(this.text[sp])}' != '${escapeForDisplay(ch)}'`
                            : `到达文本末尾，期望${ciStr} '${escapeForDisplay(ch)}'`,
                        isBacktrack: false,
                        matched: false
                    });
                    break;
                }

                case 'MATCH_DOT': {
                    if (sp < textLen) {
                        const ch = this.text[sp];
                        const isNewline = (ch === '\n' || ch === '\r');
                        if (dotAll || !isNewline) {
                            this.recordStep({
                                pc, sp, groups: { ...groups },
                                stack: this.copyStack(backtrackStack),
                                action: 'match_dot',
                                description: `点号匹配: '${escapeForDisplay(ch)}'`,
                                isBacktrack: false,
                                matched: true
                            });
                            pc++;
                            sp++;
                            continue;
                        }
                    }
                    this.recordStep({
                        pc, sp, groups: { ...groups },
                        stack: this.copyStack(backtrackStack),
                        action: 'fail_dot',
                        description: sp < textLen ? `点号不匹配换行符` : `到达文本末尾`,
                        isBacktrack: false,
                        matched: false
                    });
                    break;
                }

                case 'MATCH_CLASS': {
                    if (sp < textLen) {
                        const ch = this.text[sp];
                        if (characterClassMatches(instr.data, ch, caseInsensitive)) {
                            const ciStr = caseInsensitive ? ' (忽略大小写)' : '';
                            this.recordStep({
                                pc, sp, groups: { ...groups },
                                stack: this.copyStack(backtrackStack),
                                action: 'match_class',
                                description: `字符类匹配${ciStr}: '${escapeForDisplay(ch)}'`,
                                isBacktrack: false,
                                matched: true
                            });
                            pc++;
                            sp++;
                            continue;
                        }
                    }
                    const ciStr = caseInsensitive ? ' (忽略大小写)' : '';
                    this.recordStep({
                        pc, sp, groups: { ...groups },
                        stack: this.copyStack(backtrackStack),
                        action: 'fail_class',
                        description: sp < textLen
                            ? `字符类不匹配${ciStr}: '${escapeForDisplay(this.text[sp])}'`
                            : `到达文本末尾`,
                        isBacktrack: false,
                        matched: false
                    });
                    break;
                }

                case 'ASSERT_START': {
                    const atStart = (sp === 0) || (multiline && (sp === 0 || this.text[sp - 1] === '\n'));
                    if (atStart) {
                        this.recordStep({
                            pc, sp, groups: { ...groups },
                            stack: this.copyStack(backtrackStack),
                            action: 'assert_start',
                            description: multiline
                                ? `锚点 ^: 行首匹配成功 (位置 ${sp})`
                                : `锚点 ^: 字符串开头匹配成功 (位置 ${sp})`,
                            isBacktrack: false,
                            matched: true
                        });
                        pc++;
                        continue;
                    }
                    this.recordStep({
                        pc, sp, groups: { ...groups },
                        stack: this.copyStack(backtrackStack),
                        action: 'fail_start',
                        description: multiline
                            ? `锚点 ^ 失败: 位置 ${sp} 不是行首`
                            : `锚点 ^ 失败: 位置 ${sp} 不是字符串开头`,
                        isBacktrack: false,
                        matched: false
                    });
                    break;
                }

                case 'ASSERT_END': {
                    const atEnd = (sp === textLen) || (multiline && (sp === textLen || this.text[sp] === '\n'));
                    if (atEnd) {
                        this.recordStep({
                            pc, sp, groups: { ...groups },
                            stack: this.copyStack(backtrackStack),
                            action: 'assert_end',
                            description: multiline
                                ? `锚点 $: 行尾匹配成功 (位置 ${sp})`
                                : `锚点 $: 字符串结尾匹配成功 (位置 ${sp})`,
                            isBacktrack: false,
                            matched: true
                        });
                        pc++;
                        continue;
                    }
                    this.recordStep({
                        pc, sp, groups: { ...groups },
                        stack: this.copyStack(backtrackStack),
                        action: 'fail_end',
                        description: multiline
                            ? `锚点 $ 失败: 位置 ${sp} 不是行尾`
                            : `锚点 $ 失败: 位置 ${sp} 不是字符串结尾`,
                        isBacktrack: false,
                        matched: false
                    });
                    break;
                }

                case 'ASSERT_WORD_BOUNDARY': {
                    const prev = sp > 0 ? this.text[sp - 1] : '';
                    const curr = sp < textLen ? this.text[sp] : '';
                    const prevWord = prev ? /\w/.test(prev) : false;
                    const currWord = curr ? /\w/.test(curr) : false;
                    if (prevWord !== currWord) {
                        this.recordStep({
                            pc, sp, groups: { ...groups },
                            stack: this.copyStack(backtrackStack),
                            action: 'assert_boundary',
                            description: `锚点 \\b: 单词边界匹配成功 (位置 ${sp})`,
                            isBacktrack: false,
                            matched: true
                        });
                        pc++;
                        continue;
                    }
                    this.recordStep({
                        pc, sp, groups: { ...groups },
                        stack: this.copyStack(backtrackStack),
                        action: 'fail_boundary',
                        description: `锚点 \\b 失败: 位置 ${sp} 不是单词边界`,
                        isBacktrack: false,
                        matched: false
                    });
                    break;
                }

                case 'ASSERT_NON_WORD_BOUNDARY': {
                    const prev = sp > 0 ? this.text[sp - 1] : '';
                    const curr = sp < textLen ? this.text[sp] : '';
                    const prevWord = prev ? /\w/.test(prev) : false;
                    const currWord = curr ? /\w/.test(curr) : false;
                    if (prevWord === currWord) {
                        this.recordStep({
                            pc, sp, groups: { ...groups },
                            stack: this.copyStack(backtrackStack),
                            action: 'assert_non_boundary',
                            description: `锚点 \\B: 非单词边界匹配成功 (位置 ${sp})`,
                            isBacktrack: false,
                            matched: true
                        });
                        pc++;
                        continue;
                    }
                    this.recordStep({
                        pc, sp, groups: { ...groups },
                        stack: this.copyStack(backtrackStack),
                        action: 'fail_non_boundary',
                        description: `锚点 \\B 失败: 位置 ${sp} 是单词边界`,
                        isBacktrack: false,
                        matched: false
                    });
                    break;
                }

                case 'SAVE_GROUP_START': {
                    const gn = instr.data.groupNum;
                    groups['start_' + gn] = sp;
                    this.recordStep({
                        pc, sp, groups: { ...groups },
                        stack: this.copyStack(backtrackStack),
                        action: 'group_start',
                        description: `捕获组 ${gn} 起始位置: ${sp}`,
                        isBacktrack: false
                    });
                    pc++;
                    continue;
                }

                case 'SAVE_GROUP_END': {
                    const gn = instr.data.groupNum;
                    groups['end_' + gn] = sp;
                    this.recordStep({
                        pc, sp, groups: { ...groups },
                        stack: this.copyStack(backtrackStack),
                        action: 'group_end',
                        description: `捕获组 ${gn} 结束位置: ${sp} (内容: '${escapeForDisplay(this.text.slice(groups['start_' + gn] || 0, sp))}')`,
                        isBacktrack: false
                    });
                    pc++;
                    continue;
                }

                case 'SPLIT': {
                    const t1 = instr.data.target1;
                    const t2 = instr.data.target2;
                    this.recordStep({
                        pc, sp, groups: { ...groups },
                        stack: this.copyStack(backtrackStack),
                        action: 'split',
                        description: `分支: 尝试主分支 (指令 ${t1})，备用分支 (指令 ${t2}) 压入回溯栈`,
                        isBacktrack: false
                    });
                    backtrackStack.push({
                        pc: t2,
                        sp: sp,
                        groups: { ...groups },
                        reason: '分支回溯'
                    });
                    pc = t1;
                    continue;
                }

                case 'JUMP': {
                    this.recordStep({
                        pc, sp, groups: { ...groups },
                        stack: this.copyStack(backtrackStack),
                        action: 'jump',
                        description: `跳转到指令 ${instr.data.target}`,
                        isBacktrack: false
                    });
                    pc = instr.data.target;
                    continue;
                }

                case 'MATCH': {
                    this.succeeded = true;
                    this.recordStep({
                        pc, sp, groups: { ...groups },
                        stack: this.copyStack(backtrackStack),
                        action: 'success',
                        description: `✅ 匹配成功! 匹配文本: '${escapeForDisplay(this.text.slice(startPos, sp))}'`,
                        isBacktrack: false,
                        matched: true
                    });
                    this.finished = true;
                    return;
                }
            }

            if (backtrackStack.length === 0) {
                this.succeeded = false;
                this.recordStep({
                    pc, sp, groups: { ...groups },
                    stack: [],
                    action: 'fail',
                    description: '❌ 匹配失败: 回溯栈为空，无法继续',
                    isBacktrack: false
                });
                this.finished = true;
                return;
            }

            const bt = backtrackStack.pop();
            this.recordStep({
                pc: bt.pc,
                sp: bt.sp,
                groups: { ...bt.groups },
                stack: this.copyStack(backtrackStack),
                action: 'backtrack',
                description: `🔴 回溯: ${bt.reason || ''} 回退到指令 ${bt.pc}，文本位置 ${bt.sp}`,
                isBacktrack: true
            });
            pc = bt.pc;
            sp = bt.sp;
            groups = { ...bt.groups };
        }

        this.finished = true;
        if (!this.succeeded) {
            this.recordStep({
                pc, sp, groups: { ...groups },
                stack: [],
                action: 'fail',
                description: '❌ 匹配失败: 超过最大步数',
                isBacktrack: false
            });
        }
    }

    recordStep(step) {
        this.steps.push(step);
    }

    copyStack(stack) {
        return stack.map(s => ({
            pc: s.pc,
            sp: s.sp,
            reason: s.reason,
            groups: { ...s.groups }
        }));
    }

    next() {
        if (this.currentStepIndex < this.steps.length - 1) {
            this.currentStepIndex++;
            return this.steps[this.currentStepIndex];
        }
        return null;
    }

    reset() {
        this.currentStepIndex = -1;
    }

    getCurrentStep() {
        if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
            return this.steps[this.currentStepIndex];
        }
        return null;
    }
}

function escapeForDisplay(ch) {
    if (ch === '\n') return '\\n';
    if (ch === '\r') return '\\r';
    if (ch === '\t') return '\\t';
    if (ch === ' ') return '␣';
    if (ch === undefined) return '';
    return ch;
}

// ============================================================
// Step Debugger UI State
// ============================================================

let stepDebuggerState = {
    stepper: null,
    selectedMatchIndex: -1,
    regexStr: '',
    testStr: ''
};

function makeMatchesSelectable() {
    const tbody = document.getElementById('matchesBody');
    const rows = tbody.querySelectorAll('tr');
    rows.forEach((row, idx) => {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            document.querySelectorAll('.matches-table tbody tr').forEach(r => r.classList.remove('selected-match'));
            row.classList.add('selected-match');
            stepDebuggerState.selectedMatchIndex = idx;
            document.getElementById('startStepBtn').disabled = false;
            const matches = getCurrentMatches();
            if (matches && matches[idx]) {
                document.getElementById('stepStatus').textContent =
                    `已选择匹配 #${idx + 1} (位置 ${matches[idx].index})，点击"逐步执行"开始调试`;
            }
        });
    });
}

let _currentMatches = [];
function getCurrentMatches() {
    return _currentMatches;
}

function renderStepDebuggerRegexDisplay(regexStr, tokenStart, tokenEnd) {
    const el = document.getElementById('stepRegexDisplay');
    if (!regexStr) { el.textContent = ''; return; }
    let html = '';
    for (let i = 0; i < regexStr.length; i++) {
        const inToken = (i >= tokenStart && i < tokenEnd);
        const ch = regexStr[i];
        let displayCh = escapeHtml(ch);
        if (ch === '\n') displayCh = '\\n';
        if (ch === '\t') displayCh = '\\t';
        if (inToken) {
            html += `<span class="regex-token-highlight">${displayCh}</span>`;
        } else {
            html += `<span>${displayCh}</span>`;
        }
    }
    if (tokenEnd >= regexStr.length && tokenStart === tokenEnd) {
        html += `<span class="regex-token-highlight regex-caret">▌</span>`;
    }
    el.innerHTML = html;
}

function renderStepDebuggerTextDisplay(text, textPos, tokenStart, tokenEnd) {
    const el = document.getElementById('stepTextDisplay');
    if (!text) { el.textContent = ''; return; }
    let html = '';
    for (let i = 0; i < text.length; i++) {
        const atCursor = (i === textPos);
        const ch = text[i];
        let displayCh = escapeHtml(ch);
        if (ch === '\n') displayCh = '↵\n';
        else if (ch === '\t') displayCh = '→   ';
        else if (ch === ' ') displayCh = '&nbsp;';
        if (atCursor) {
            html += `<span class="text-cursor">▌</span>`;
        }
        html += `<span class="text-char" data-pos="${i}">${displayCh}</span>`;
    }
    if (textPos >= text.length) {
        html += `<span class="text-cursor">▌</span>`;
    }
    el.innerHTML = html;
}

function renderStepDebuggerStack(stack, groups) {
    const el = document.getElementById('stepStackDisplay');
    let html = '';

    html += '<div class="stack-section-title">分组捕获:</div>';
    const groupNums = new Set();
    for (const key of Object.keys(groups || {})) {
        const m = key.match(/^(start|end)_(\d+)$/);
        if (m) groupNums.add(m[2]);
    }
    const sortedGroupNums = Array.from(groupNums).sort((a, b) => parseInt(a) - parseInt(b));
    if (sortedGroupNums.length === 0) {
        html += '<div class="stack-empty">(无)</div>';
    } else {
        html += '<div class="groups-list">';
        for (const gn of sortedGroupNums) {
            const start = groups['start_' + gn];
            const end = groups['end_' + gn];
            let content = '';
            if (start !== undefined && end !== undefined) {
                content = escapeHtml(stepDebuggerState.testStr.slice(start, end));
            } else if (start !== undefined) {
                content = `<span style="color:#888;">(进行中, 起始: ${start})</span>`;
            }
            const colorIdx = (parseInt(gn) - 1) % GROUP_COLORS.length;
            html += `<div class="group-capture-item" style="border-left-color:${GROUP_TEXT_COLORS[colorIdx]};">
                <span class="group-capture-label" style="color:${GROUP_TEXT_COLORS[colorIdx]}">$${gn}</span>
                <span class="group-capture-value">'${content}'</span>
            </div>`;
        }
        html += '</div>';
    }

    html += '<div class="stack-section-title">回溯栈 (' + (stack ? stack.length : 0) + '):</div>';
    if (!stack || stack.length === 0) {
        html += '<div class="stack-empty">(空)</div>';
    } else {
        html += '<div class="backtrack-stack">';
        for (let i = stack.length - 1; i >= 0; i--) {
            const item = stack[i];
            html += `<div class="stack-item">
                <div class="stack-item-header">帧 ${stack.length - i}: ${escapeHtml(item.reason || '回溯点')}</div>
                <div class="stack-item-details">指令: ${item.pc} | 文本位置: ${item.sp}</div>
            </div>`;
        }
        html += '</div>';
    }

    el.innerHTML = html;
}

function renderStepDebuggerLog(steps, currentIndex) {
    const el = document.getElementById('stepLogDisplay');
    if (!steps || steps.length === 0) {
        el.innerHTML = '<div class="log-empty">暂无执行日志</div>';
        return;
    }
    let html = '';
    const startIdx = Math.max(0, currentIndex - 20);
    for (let i = startIdx; i <= currentIndex && i < steps.length; i++) {
        const step = steps[i];
        const isCurrent = (i === currentIndex);
        let className = 'log-entry';
        if (step.isBacktrack) className += ' log-backtrack';
        if (isCurrent) className += ' log-current';
        const icon = step.isBacktrack ? '🔴' :
            step.action === 'success' ? '✅' :
            step.action === 'fail' ? '❌' :
            step.action === 'split' ? '🔀' :
            step.action === 'jump' ? '➡️' :
            step.action === 'group_start' ? '📌' :
            step.action === 'group_end' ? '🏁' :
            step.matched ? '🟢' : (step.action.startsWith('fail_') ? '🔴' : '▶️');
        html += `<div class="${className}"><span class="log-step-num">${i + 1}.</span> <span class="log-icon">${icon}</span> ${escapeHtml(step.description)}</div>`;
    }
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
}

function updateStepDebuggerDisplay() {
    const step = stepDebuggerState.stepper ? stepDebuggerState.stepper.getCurrentStep() : null;
    const stepper = stepDebuggerState.stepper;

    const stepCounter = document.getElementById('stepCounter');
    const stepStatus = document.getElementById('stepStatus');

    if (!stepper || !step) {
        stepCounter.textContent = 'Step: 0';
        renderStepDebuggerRegexDisplay(stepDebuggerState.regexStr, 0, 0);
        renderStepDebuggerTextDisplay(stepDebuggerState.testStr, stepper ? stepper.startPos : 0);
        renderStepDebuggerStack([], {});
        document.getElementById('stepLogDisplay').innerHTML = '<div class="log-empty">点击"逐步执行"开始</div>';
        return;
    }

    stepCounter.textContent = `Step: ${stepper.currentStepIndex + 1} / ${stepper.steps.length}`;

    const instr = stepper.instructions[step.pc];
    let tokenStart = 0, tokenEnd = 0;
    if (instr) {
        tokenStart = instr.tokenStart;
        tokenEnd = instr.tokenEnd;
    }

    renderStepDebuggerRegexDisplay(stepDebuggerState.regexStr, tokenStart, tokenEnd);
    renderStepDebuggerTextDisplay(stepDebuggerState.testStr, step.sp, tokenStart, tokenEnd);
    renderStepDebuggerStack(step.stack, step.groups);
    renderStepDebuggerLog(stepper.steps, stepper.currentStepIndex);

    if (step.action === 'success') {
        stepStatus.textContent = '✅ 匹配成功';
        stepStatus.className = 'step-status status-success';
    } else if (step.action === 'fail') {
        stepStatus.textContent = '❌ 匹配失败';
        stepStatus.className = 'step-status status-fail';
    } else if (step.isBacktrack) {
        stepStatus.textContent = '🔴 回溯中...';
        stepStatus.className = 'step-status status-backtrack';
    } else {
        stepStatus.textContent = '▶ 调试中...';
        stepStatus.className = 'step-status';
    }
}

function startStepDebug() {
    const regexStr = document.getElementById('regexInput').value;
    const testStr = document.getElementById('testInput').value;
    const matches = _currentMatches;
    const matchIdx = stepDebuggerState.selectedMatchIndex;
    const flagsStr = getFlags();
    const flags = {
        i: flagsStr.includes('i'),
        m: flagsStr.includes('m'),
        s: flagsStr.includes('s'),
        g: flagsStr.includes('g')
    };

    if (matchIdx < 0 || !matches || !matches[matchIdx]) {
        document.getElementById('stepStatus').textContent = '请先选择一个匹配';
        return;
    }

    const startPos = matches[matchIdx].index;
    stepDebuggerState.regexStr = regexStr;
    stepDebuggerState.testStr = testStr;

    try {
        let ast = parseRegex(regexStr);
        annotateAstWithPositions(ast, regexStr, 0);

        const compiler = new NFACompiler(regexStr);
        const instructions = compiler.compile(ast);

        const stepper = new NFAStepper(instructions, testStr, startPos, regexStr, flags);
        stepper.run();

        stepDebuggerState.stepper = stepper;
        document.getElementById('stepNextBtn').disabled = false;
        document.getElementById('stepResetBtn').disabled = false;

        stepper.next();
        updateStepDebuggerDisplay();
    } catch (e) {
        document.getElementById('stepStatus').textContent = '调试器错误: ' + e.message;
        console.error(e);
    }
}

function stepNext() {
    if (!stepDebuggerState.stepper) return;
    const nextStep = stepDebuggerState.stepper.next();
    updateStepDebuggerDisplay();
    const st = stepDebuggerState.stepper;
    if (st.currentStepIndex >= st.steps.length - 1) {
        document.getElementById('stepNextBtn').disabled = true;
    }
}

function stepReset() {
    if (!stepDebuggerState.stepper) return;
    stepDebuggerState.stepper.reset();
    document.getElementById('stepNextBtn').disabled = false;
    stepDebuggerState.stepper.next();
    updateStepDebuggerDisplay();
}

// ============================================================
// Modified runMatch to track matches and make rows selectable
// ============================================================

const _originalRunMatch = runMatch;
function patchedRunMatch() {
    _originalRunMatch();
    stepDebuggerState.selectedMatchIndex = -1;
    stepDebuggerState.stepper = null;
    document.getElementById('startStepBtn').disabled = true;
    document.getElementById('stepNextBtn').disabled = true;
    document.getElementById('stepResetBtn').disabled = true;
    document.getElementById('stepStatus').textContent = '选择一个匹配后点击"逐步执行"';
    document.getElementById('stepStatus').className = 'step-status';

    const regexStr = document.getElementById('regexInput').value;
    const testStr = document.getElementById('testInput').value;
    const flags = getFlags();

    _currentMatches = [];
    if (regexStr) {
        try {
            const re = new RegExp(regexStr, flags.includes('g') ? flags : flags + 'g');
            let m;
            while ((m = re.exec(testStr)) !== null) {
                _currentMatches.push(m);
                if (!flags.includes('g')) break;
                if (m.index === re.lastIndex) re.lastIndex++;
            }
        } catch (e) { }
    }
    makeMatchesSelectable();
}

document.addEventListener('DOMContentLoaded', function () {
    const regexInput = document.getElementById('regexInput');
    const testInput = document.getElementById('testInput');
    const flagG = document.getElementById('flagG');
    const flagI = document.getElementById('flagI');
    const flagM = document.getElementById('flagM');
    const flagS = document.getElementById('flagS');
    const refreshAstBtn = document.getElementById('refreshAstBtn');
    const startStepBtn = document.getElementById('startStepBtn');
    const stepNextBtn = document.getElementById('stepNextBtn');
    const stepResetBtn = document.getElementById('stepResetBtn');

    regexInput.value = '(\\w+)@(\\w+)\\.(\\w+)';
    testInput.value = 'Hello world!\nEmail: test@example.com\nAnother: user.name@company.org\nInvalid: not-an-email\nTest: hello123@test456.net';

    function debounce(fn, ms) {
        let t;
        return function () {
            clearTimeout(t);
            t = setTimeout(fn, ms);
        };
    }

    const debouncedRun = debounce(patchedRunMatch, 100);

    regexInput.addEventListener('input', debouncedRun);
    testInput.addEventListener('input', debouncedRun);
    flagG.addEventListener('change', patchedRunMatch);
    flagI.addEventListener('change', patchedRunMatch);
    flagM.addEventListener('change', patchedRunMatch);
    flagS.addEventListener('change', patchedRunMatch);
    refreshAstBtn.addEventListener('click', refreshAst);
    startStepBtn.addEventListener('click', startStepDebug);
    stepNextBtn.addEventListener('click', stepNext);
    stepResetBtn.addEventListener('click', stepReset);

    patchedRunMatch();
    refreshAst();
});
