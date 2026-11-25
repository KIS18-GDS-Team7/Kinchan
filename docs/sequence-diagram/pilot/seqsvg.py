#!/usr/bin/env python3
"""シーケンス図のテキスト定義 (src/*.txt) から SVG を書き出す。

使い方:
    python3 seqsvg.py            # src/ の全ファイルを svg/ に書き出す
    python3 seqsvg.py src/UC-302.txt ...

標準ライブラリだけで動く。文字は <text> 要素のまま出力するので、
SVG を検索・diff で読める。書式は README.md を参照。
"""
import html
import re
import sys
import unicodedata
from pathlib import Path

FONT = "'Noto Sans CJK JP','Noto Sans JP','Hiragino Sans','Yu Gothic','Meiryo','IPAGothic',sans-serif"
FS = 13            # メッセージ・ノートの文字サイズ
MARGIN = 30        # 図の枠から内容までの余白
HEAD_H = 70        # ライフラインの頭 (アイコン + 名前) の高さ
MSG_GAP = 34       # メッセージ 1 本の高さ
SELF_H = 22        # 自己メッセージの折り返しの高さ
NOTE_W = 380       # ノートの最大幅
NOTE_GAP = 90      # 最後のライフラインからノート列までの距離
LABEL_W = 430      # メッセージの文字がこれより長いと折り返す
KINDS = ("actor", "boundary", "control", "entity")


def text_width(s, fs=FS):
    w = 0.0
    for ch in s:
        if unicodedata.east_asian_width(ch) in ("W", "F", "A"):
            w += fs
        else:
            w += fs * 0.58
    return w


def wrap(s, max_w, fs=FS):
    """ノートの文字列を max_w に収まるように折り返す。\\n でも改行する。"""
    lines = []
    for para in s.split("\\n"):
        cur = ""
        for ch in para:
            # 閉じ括弧・句読点は行頭に置かない (前の行にはみ出させる)
            if cur and text_width(cur + ch, fs) > max_w and ch not in ")）」』、。,.":
                # 英数字の語 (ADR-0007、UC-310 など) の途中では折り返さない
                k = len(cur)
                while k > 0 and re.match(r"[A-Za-z0-9_\-]", cur[k - 1]) and re.match(r"[A-Za-z0-9_\-]", ch):
                    k -= 1
                    if k > 0 and not re.match(r"[A-Za-z0-9_\-]", cur[k - 1]):
                        break
                if 0 < k < len(cur) and re.match(r"[A-Za-z0-9_\-]", ch):
                    lines.append(cur[:k])
                    cur = cur[k:] + ch
                else:
                    lines.append(cur)
                    cur = ch
            else:
                cur += ch
        lines.append(cur)
    return lines


def esc(s):
    return html.escape(s, quote=True)


# ---------------------------------------------------------------- 構文解析

class Diagram:
    def __init__(self):
        self.title = ""
        self.scope = ""
        self.parts = []          # (id, kind, name)
        self.items = []          # 最上位の要素の列


class Message:
    def __init__(self, src, dst, label, ret):
        self.src, self.dst, self.label, self.ret = src, dst, label, ret
        self.notes = []
        self.num = None


class Fragment:
    def __init__(self, op, guard):
        self.op = op
        self.operands = [(guard, [])]   # (ガード, 要素の列)
        self.notes = []


class Note:
    """メッセージに付かない、単独のノート (区切りの説明など)。"""
    def __init__(self, text):
        self.text = text


MSG_RE = re.compile(r"^(\w+)\s*(-->|->)\s*(\w+)\s*:\s*(.*)$")


def parse(path):
    d = Diagram()
    stack = [d.items]
    frags = []
    last_msg = None
    ids = set()
    for lineno, raw in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        head, _, rest = line.partition(" ")
        rest = rest.strip()

        def fail(msg):
            sys.exit(f"{path}:{lineno}: {msg}: {raw}")

        if head == "title":
            d.title = rest
        elif head == "scope":
            d.scope = rest
        elif head in KINDS:
            pid, _, name = rest.partition(" ")
            if not name:
                fail("ライフラインの名前がない")
            d.parts.append((pid, head, name.strip()))
            ids.add(pid)
        elif head in ("break", "opt", "alt", "loop"):
            f = Fragment(head, rest)
            stack[-1].append(f)
            frags.append(f)
            stack.append(f.operands[-1][1])
            last_msg = None
        elif head == "else":
            if not frags or frags[-1].op != "alt":
                fail("else が alt の中にない")
            stack.pop()
            frags[-1].operands.append((rest, []))
            stack.append(frags[-1].operands[-1][1])
            last_msg = None
        elif head == "end":
            if not frags:
                fail("対応する断片がない end")
            stack.pop()
            last_msg = frags.pop()
        elif head == "note":
            text = rest.lstrip(":").strip()
            if last_msg is None:
                stack[-1].append(Note(text))
            else:
                last_msg.notes.append(text)
        else:
            m = MSG_RE.match(line)
            if not m:
                fail("書式が読めない")
            src, arrow, dst, label = m.groups()
            for p in (src, dst):
                if p not in ids:
                    fail(f"未定義のライフライン {p}")
            last_msg = Message(src, dst, label.strip(), arrow == "-->")
            stack[-1].append(last_msg)
    if frags:
        sys.exit(f"{path}: end が足りない ({frags[-1].op} {frags[-1].operands[0][0]})")
    return d


def walk(items):
    for it in items:
        yield it
        if isinstance(it, Fragment):
            for _, sub in it.operands:
                yield from walk(sub)


# ---------------------------------------------------------------- 配置

def layout_x(d):
    idx = {pid: i for i, (pid, _, _) in enumerate(d.parts)}
    n = len(d.parts)
    head_w = [max(90, text_width(":" + name, FS) + 20) for _, _, name in d.parts]
    need = {}   # (i, j) -> 必要な間隔

    def req(i, j, w):
        need[(i, j)] = max(need.get((i, j), 0), w)

    for it in walk(d.items):
        if isinstance(it, Message):
            a, b = idx[it.src], idx[it.dst]
            label = ("99: " if not it.ret else "") + it.label
            w = max(text_width(s) for s in wrap(label, LABEL_W)) + 30
            if a == b:
                # 自己メッセージの文字は右のライフラインに重なってよい (背景を白で塗る)
                if a + 1 < n:
                    req(a, a + 1, min(w + 20, 220))
            else:
                i, j = min(a, b), max(a, b)
                req(i, j, w)
        elif isinstance(it, Fragment):
            pass
    # 左端のライフラインを囲む断片の枠が図の外に出ないよう、入れ子の深さぶん右にずらす
    depth0 = max([frag_span(f, idx)[2] + 1 for f in walk(d.items)
                  if isinstance(f, Fragment) and frag_span(f, idx)[0] == 0] or [0])
    xs = [MARGIN + 20 + max(head_w[0] / 2, 40 + 22 + 12 * depth0)]
    for j in range(1, n):
        x = xs[j - 1] + max(head_w[j - 1] / 2 + head_w[j] / 2 + 30, 130)
        for i in range(j):
            if (i, j) in need:
                x = max(x, xs[i] + need[(i, j)])
        xs.append(x)
    return idx, xs


def frag_span(f, idx):
    """断片が触れるライフラインの範囲と、内側の入れ子の深さ。"""
    lo, hi, depth = 10 ** 6, -1, 0
    for _, sub in f.operands:
        for it in sub:
            if isinstance(it, Message):
                for p in (it.src, it.dst):
                    lo, hi = min(lo, idx[p]), max(hi, idx[p])
                if it.src == it.dst:
                    hi = max(hi, idx[it.src] + 0.5)
            elif isinstance(it, Fragment):
                l2, h2, d2 = frag_span(it, idx)
                lo, hi, depth = min(lo, l2), max(hi, h2), max(depth, d2 + 1)
    return lo, hi, depth


# ---------------------------------------------------------------- 描画

class Canvas:
    def __init__(self):
        self.body = []      # 線・図形
        self.front = []     # 文字 (線より上に描く)

    def line(self, x1, y1, x2, y2, dash=False, w=1):
        da = ' stroke-dasharray="6 4"' if dash else ""
        self.body.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#222" stroke-width="{w}"{da}/>')

    def rect(self, x, y, w, h, fill="none", stroke="#222", dash=False, rx=0):
        da = ' stroke-dasharray="6 4"' if dash else ""
        self.body.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" stroke="{stroke}"{da}/>')

    def text(self, x, y, s, anchor="start", size=FS, weight="normal", bg=False):
        if bg:
            w = text_width(s, size)
            x0 = {"start": x, "middle": x - w / 2, "end": x - w}[anchor]
            self.front.append(f'<rect x="{x0 - 2:.1f}" y="{y - size:.1f}" width="{w + 4:.1f}" height="{size + 4:.1f}" fill="#fff"/>')
        wt = f' font-weight="{weight}"' if weight != "normal" else ""
        self.front.append(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" text-anchor="{anchor}"{wt}>{esc(s)}</text>')

    def raw(self, s, front=False):
        (self.front if front else self.body).append(s)


def arrow_head(c, x, y, direction, open_=False):
    dx = -10 * direction
    pts = f"{x:.1f},{y:.1f} {x + dx:.1f},{y - 5:.1f} {x + dx:.1f},{y + 5:.1f}"
    if open_:
        c.raw(f'<polyline points="{x + dx:.1f},{y - 5:.1f} {x:.1f},{y:.1f} {x + dx:.1f},{y + 5:.1f}" fill="none" stroke="#222"/>')
    else:
        c.raw(f'<polygon points="{pts}" fill="#222"/>')


def draw_icon(c, kind, x, y):
    """y はアイコンの中心。"""
    fill = "#fefbd8"
    if kind == "actor":
        c.raw(f'<circle cx="{x}" cy="{y - 12}" r="6" fill="{fill}" stroke="#222"/>')
        c.raw(f'<path d="M{x} {y - 6} V{y + 6} M{x - 10} {y - 1} H{x + 10} M{x} {y + 6} L{x - 8} {y + 16} M{x} {y + 6} L{x + 8} {y + 16}" fill="none" stroke="#222"/>')
    elif kind == "boundary":
        c.raw(f'<circle cx="{x + 5}" cy="{y}" r="13" fill="{fill}" stroke="#222"/>')
        c.raw(f'<path d="M{x - 8} {y} H{x - 18} M{x - 18} {y - 11} V{y + 11}" fill="none" stroke="#222"/>')
    elif kind == "control":
        c.raw(f'<circle cx="{x}" cy="{y}" r="13" fill="{fill}" stroke="#222"/>')
        c.raw(f'<path d="M{x + 1} {y - 13} l6 -5 M{x + 1} {y - 13} l6 5" fill="none" stroke="#222"/>')
    else:
        c.raw(f'<circle cx="{x}" cy="{y - 2}" r="13" fill="{fill}" stroke="#222"/>')
        c.raw(f'<path d="M{x - 13} {y + 13} H{x + 13}" fill="none" stroke="#222"/>')


def render(d):
    idx, xs = layout_x(d)
    c = Canvas()
    note_x = xs[-1] + NOTE_GAP
    top = MARGIN + 34
    y = top + HEAD_H + 20
    note_y = [top]           # ノート列で次に置ける y
    note_boxes = []
    counter = [0]
    max_right = [note_x]

    def place_note(text, anchor_x, anchor_y):
        lines = wrap(text, NOTE_W - 16)
        w = max(text_width(s) for s in lines) + 16
        h = len(lines) * (FS + 5) + 10
        ny = max(anchor_y - 12, note_y[0])
        note_y[0] = ny + h + 8
        note_boxes.append((note_x, ny, w, h, lines))
        max_right[0] = max(max_right[0], note_x + w)
        c.line(anchor_x, anchor_y, note_x, ny + min(12, h / 2), dash=True)
        return ny + h

    def draw_items(items):
        nonlocal y
        for it in items:
            if isinstance(it, Message):
                draw_msg(it)
            elif isinstance(it, Fragment):
                draw_frag(it)
            elif isinstance(it, Note):
                bottom = place_note(it.text, xs[-1], y)
                y += 10

    def draw_msg(m):
        nonlocal y
        a, b = xs[idx[m.src]], xs[idx[m.dst]]
        if not m.ret:
            counter[0] += 1
            m.num = counter[0]
            label = f"{m.num}: {m.label}"
        else:
            label = m.label
        lines = wrap(label, LABEL_W)
        y += MSG_GAP + (len(lines) - 1) * (FS + 4)

        def put(x, anchor):
            for k, s in enumerate(lines):
                c.text(x, y - 6 - (len(lines) - 1 - k) * (FS + 4), s, anchor=anchor, bg=True)

        if a == b:
            put(a + 8, "start")
            c.raw(f'<polyline points="{a},{y} {a + 30},{y} {a + 30},{y + SELF_H} {a + 1},{y + SELF_H}" fill="none" stroke="#222"/>')
            arrow_head(c, a + 1, y + SELF_H, -1)
            end_x, end_y = a + 30, y
            y += SELF_H
        else:
            direction = 1 if b > a else -1
            c.line(a, y, b - direction * 1, y, dash=m.ret)
            arrow_head(c, b, y, direction, open_=m.ret)
            put((a + b) / 2, "middle")
            end_x, end_y = max(a, b), y
        for n in m.notes:
            bottom = place_note(n, end_x, end_y)

    def draw_frag(f):
        nonlocal y
        lo, hi, depth = frag_span(f, idx)
        pad = 22 + 12 * depth
        left = xs[int(lo)] - pad - (40 if lo == 0 else 0)
        right_base = xs[int(hi)] if hi == int(hi) else xs[int(hi)] + 150
        right = right_base + pad + (60 if hi == int(hi) else 0)
        guard0 = f"[{f.operands[0][0]}]"
        right = max(right, left + text_width(guard0) + 70)
        # ノート列にかからないようにする
        right = min(right, note_x - 14)
        y += 22
        y0 = y
        # 見出し (五角形)
        lw = text_width(f.op, FS) + 16
        c.raw(f'<path d="M{left} {y0} H{left + lw + 8} V{y0 + 12} L{left + lw} {y0 + 20} H{left} Z" fill="#fff" stroke="#222"/>')
        c.text(left + 6, y0 + 15, f.op, weight="bold")
        y += 22
        sep = []
        for k, (guard, sub) in enumerate(f.operands):
            if k > 0:
                y += 12
                sep.append(y)
                y += 4
            c.text(left + 8, y + 12, f"[{guard}]", bg=True)
            y += 10
            draw_items(sub)
        y += 16
        c.rect(left, y0, right - left, y - y0)
        for sy in sep:
            c.line(left, sy, right, sy, dash=True)
        for n in f.notes:
            place_note(n, right, y0 + 10)

    draw_items(d.items)
    bottom = max(y + 40, note_y[0] + 10)

    # ライフライン
    for (pid, kind, name), x in zip(d.parts, xs):
        draw_icon(c, kind, x, top + 18)
        c.text(x, top + 56, ":" + name, anchor="middle")
        c.line(x, top + HEAD_H - 4, x, bottom - 10, dash=True)
    # ノート
    for nx, ny, w, h, lines in note_boxes:
        c.raw(f'<path d="M{nx} {ny} H{nx + w - 10} L{nx + w} {ny + 10} V{ny + h} H{nx} Z" fill="#fde2e2" stroke="#222"/>', front=True)
        for k, s in enumerate(lines):
            c.text(nx + 8, ny + 6 + (k + 1) * (FS + 5) - 4, s)
    # 対象フローのノート (右上)
    if d.scope:
        lines = wrap(f"{d.title}\\n({d.scope})", NOTE_W - 16)
        w = max(text_width(s) for s in lines) + 16
        h = len(lines) * (FS + 5) + 10
        sx = max(max_right[0], note_x) + 30
        c.raw(f'<path d="M{sx} {MARGIN + 10} H{sx + w - 10} L{sx + w} {MARGIN + 20} V{MARGIN + 10 + h} H{sx} Z" fill="#fde2e2" stroke="#222"/>', front=True)
        for k, s in enumerate(lines):
            c.text(sx + 8, MARGIN + 16 + (k + 1) * (FS + 5) - 4, s)
        max_right[0] = sx + w
    width = max(max_right[0], xs[-1] + 100) + MARGIN
    height = bottom + MARGIN
    # 図の枠と見出し
    label = f"sd {d.title}"
    lw = text_width(label, FS + 1) + 18
    frame = (f'<rect x="10" y="10" width="{width - 20:.1f}" height="{height - 20:.1f}" fill="none" stroke="#222"/>'
             f'<path d="M10 10 H{10 + lw + 10:.1f} V{24} L{10 + lw:.1f} {34} H10 Z" fill="#fff" stroke="#222"/>')
    head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:.0f}" height="{height:.0f}" '
            f'viewBox="0 0 {width:.0f} {height:.0f}" font-family="{esc(FONT)}">\n'
            f'<title>{esc(d.title)}</title>\n'
            f'<rect width="100%" height="100%" fill="#fff"/>\n')
    title_text = f'<text x="16" y="27" font-size="{FS + 1}"><tspan font-weight="bold">sd</tspan> {esc(d.title)}</text>'
    return head + frame + "\n" + "\n".join(c.body) + "\n" + "\n".join(c.front) + "\n" + title_text + "\n</svg>\n"


def main(argv):
    here = Path(__file__).resolve().parent
    srcs = [Path(a) for a in argv] or sorted((here / "src").glob("*.txt"))
    out = here / "svg"
    out.mkdir(exist_ok=True)
    for s in srcs:
        d = parse(s)
        (out / (s.stem + ".svg")).write_text(render(d), encoding="utf-8")
        print(f"{s.name} -> svg/{s.stem}.svg")


if __name__ == "__main__":
    main(sys.argv[1:])
