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
        renderAst(null);
        return;
    }

    try {
        new RegExp(regexStr, flags);
    } catch (e) {
        showError('regexError', '正则语法错误: ' + e.message);
        highlightOutput.innerHTML = escapeHtml(testStr);
        renderAst(null);
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

    try {
        const ast = parseRegex(regexStr);
        renderAst(ast);
    } catch (e) {
        showError('astError', '解析错误: ' + e.message);
        renderAst(null);
    }
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

    const segments = [];
    let lastEnd = 0;

    matches.forEach((match, matchIdx) => {
        if (match.index > lastEnd) {
            segments.push({
                start: lastEnd,
                end: match.index,
                text: text.slice(lastEnd, match.index),
                type: 'normal'
            });
        }
        segments.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
            type: 'match',
            matchIndex: matchIdx,
            groups: match.slice(1)
        });
        lastEnd = match.index + match[0].length;
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
        } else {
            html += '<mark style="background-color:' + GROUP_COLORS[0] + '; border-bottom: 2px solid ' + GROUP_TEXT_COLORS[0] + '; border-radius: 2px; padding: 1px 0;">' + escapeHtml(seg.text) + '</mark>';
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

document.addEventListener('DOMContentLoaded', function () {
    const regexInput = document.getElementById('regexInput');
    const testInput = document.getElementById('testInput');
    const flagG = document.getElementById('flagG');
    const flagI = document.getElementById('flagI');
    const flagM = document.getElementById('flagM');
    const flagS = document.getElementById('flagS');

    regexInput.value = '(\\w+)@(\\w+)\\.(\\w+)';
    testInput.value = 'Hello world!\nEmail: test@example.com\nAnother: user.name@company.org\nInvalid: not-an-email\nTest: hello123@test456.net';

    function debounce(fn, ms) {
        let t;
        return function () {
            clearTimeout(t);
            t = setTimeout(fn, ms);
        };
    }

    const debouncedRun = debounce(runMatch, 100);

    regexInput.addEventListener('input', debouncedRun);
    testInput.addEventListener('input', debouncedRun);
    flagG.addEventListener('change', runMatch);
    flagI.addEventListener('change', runMatch);
    flagM.addEventListener('change', runMatch);
    flagS.addEventListener('change', runMatch);

    runMatch();
});
