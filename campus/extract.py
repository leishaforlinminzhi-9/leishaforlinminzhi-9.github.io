#!/usr/bin/env python3
"""Turns the colour-coded campus map (map.png) into polygons: for every legend colour (teaching buildings, dorms, sports, green, water) the connected areas are
traced to outlines (holes included) and simplified. Orange (the faculty housing) is left out on purpose. Output: campus.json, in map pixels."""
import sys, json
sys.path.insert(0, "/Users/alicelin/treasure-hunt/tools")
import pngio
from collections import deque

W, H, ch, rows = pngio.read("map.png")
STEP = 1  # grid cell = 1 map pixel
X0, Y0, X1, Y1 = 196, 462, 1252, 1852  # the map area
COLORS = {"teach": (163, 119, 166), "dorm": (139, 195, 187), "sport": (231, 220, 50), "green": (178, 208, 146), "water": (153, 182, 215), "orange": (227, 163, 53)}
TOL = {"teach": 34, "dorm": 30, "sport": 34, "green": 22, "water": 26, "orange": 40}
GW, GH = (X1 - X0) // STEP, (Y1 - Y0) // STEP

def inside_legend(x, y):
    return (x < 275 and y < 845) or (x < 395 and y > 1500) or (x < 235)  # the two legend boxes and the strip left of the dashed boundary

grid = [[None] * GW for _ in range(GH)]
for gy in range(GH):
    y = Y0 + gy * STEP
    row = rows[y]
    for gx in range(GW):
        x = X0 + gx * STEP
        if inside_legend(x, y): continue
        i = x * ch
        r, g, b = row[i], row[i + 1], row[i + 2]
        best, bd = None, 999
        for name, (cr, cg, cb) in COLORS.items():
            d = abs(r - cr) + abs(g - cg) + abs(b - cb)
            if d < TOL[name] * 2 and d < bd: best, bd = name, d
        grid[gy][gx] = best

def ground_mask():
    m = [[0] * GW for _ in range(GH)]
    for gy in range(GH):
        y = Y0 + gy * STEP
        for gx in range(GW):
            x = X0 + gx * STEP
            if inside_legend(x, y): continue
            i = x * ch
            if min(rows[y][i], rows[y][i + 1], rows[y][i + 2]) < 236: m[gy][gx] = 1
    return m

def mask_of(name):
    return ground_mask() if name == "ground" else [[1 if grid[y][x] == name else 0 for x in range(GW)] for y in range(GH)]

def close(m, r):  # dilate then erode: fills the text and the thin lines inside a coloured area
    def dil(a):
        out = [[0] * GW for _ in range(GH)]
        for y in range(GH):
            row = a[y]
            for x in range(GW):
                if row[x]:
                    for yy in range(max(0, y - r), min(GH, y + r + 1)):
                        o = out[yy]
                        for xx in range(max(0, x - r), min(GW, x + r + 1)): o[xx] = 1
        return out
    d = dil(m)
    inv = [[1 - v for v in row] for row in d]
    e = dil(inv)
    return [[1 - v for v in row] for row in e]

def components(m, min_cells):
    seen = [[0] * GW for _ in range(GH)]
    comps = []
    for y in range(GH):
        for x in range(GW):
            if m[y][x] and not seen[y][x]:
                q = deque([(x, y)]); seen[y][x] = 1; cells = []
                while q:
                    a, b = q.popleft(); cells.append((a, b))
                    for nx, ny in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                        if 0 <= nx < GW and 0 <= ny < GH and m[ny][nx] and not seen[ny][nx]: seen[ny][nx] = 1; q.append((nx, ny))
                if len(cells) >= min_cells: comps.append(cells)
    return comps

def loops_of(cells):
    s = set(cells); edges = {}
    def add(a, b): edges.setdefault(a, []).append(b)
    for (x, y) in cells:
        if (x, y - 1) not in s: add((x, y), (x + 1, y))
        if (x + 1, y) not in s: add((x + 1, y), (x + 1, y + 1))
        if (x, y + 1) not in s: add((x + 1, y + 1), (x, y + 1))
        if (x - 1, y) not in s: add((x, y + 1), (x, y))
    loops = []
    while edges:
        start = next(iter(edges)); loop = [start]; cur = start
        while True:
            nxt = edges[cur].pop()
            if not edges[cur]: del edges[cur]
            if nxt == start: break
            loop.append(nxt); cur = nxt
            if cur not in edges: break
        if len(loop) >= 4: loops.append(loop)
    return loops

def area(p): return sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p))) / 2

def dp(pts, eps):  # Douglas-Peucker on a closed loop: split at the two farthest points
    def seg(a, b, pts_):
        if len(pts_) < 3: return pts_
        (ax, ay), (bx, by) = a, b; dx, dy = bx - ax, by - ay; L = (dx * dx + dy * dy) ** .5 or 1
        idx, md = -1, 0
        for i, (px, py) in enumerate(pts_[1:-1], 1):
            d = abs(dy * (px - ax) - dx * (py - ay)) / L
            if d > md: md, idx = d, i
        if md > eps: return seg(a, pts_[idx], pts_[:idx + 1])[:-1] + seg(pts_[idx], b, pts_[idx:])
        return [pts_[0], pts_[-1]]
    n = len(pts); j = max(range(n), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
    a = pts[:j + 1]; b = pts[j:] + [pts[0]]
    return seg(a[0], a[-1], a)[:-1] + seg(b[0], b[-1], b)[:-1]

def inpoly(pt, poly):
    x, y = pt; c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-9) + x1: c = not c
    return c

out = {"w": X1 - X0, "h": Y1 - Y0, "x0": X0, "y0": Y0, "step": STEP, "classes": {}}
for name in [c for c in COLORS if c != "orange"] + ["ground"]:
    m = mask_of(name)
    m = close(m, 6 if name == "ground" else 1)
    comps = components(m, {"teach": 140, "dorm": 90, "sport": 160, "green": 350, "water": 220, "ground": 12000}[name])
    polys = []
    for cells in comps:
        loops = [dp([(a, b) for a, b in l], 1.4 if name == 'ground' else 1.0) for l in loops_of(cells)]
        loops = [l for l in loops if len(l) >= 3 and abs(area(l)) >= 20]
        if not loops: continue
        loops.sort(key=lambda l: -abs(area(l)))
        outer = [l for l in loops if True][0]
        holes = [l for l in loops[1:] if inpoly(l[0], outer) and abs(area(l)) >= (150 if name == 'green' else 400)]
        polys.append({"outer": [[a * STEP, b * STEP] for a, b in outer], "holes": [[[a * STEP, b * STEP] for a, b in h] for h in holes], "cells": len(cells)})
    out["classes"][name] = polys
    print(name, len(polys), "polygons,", sum(p["cells"] for p in polys), "cells")
json.dump(out, open("campus.json", "w"), separators=(",", ":"))
print("campus.json", len(open("campus.json").read()) // 1024, "KB; grid", GW, "x", GH)
