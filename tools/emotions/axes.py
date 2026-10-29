"""Three independent axes for the "Feel Axes" tab (named after their high end, all growing toward the pleasant side): principal components of the nine GEMS scales (all rated songs in gems.json).
    py -3 axes.py      -> writes axes.json (means, std devs, loadings, names) that build_data.py hands to the page.
A song's coordinate on an axis = sum(loading * z-score of each scale) / sqrt(eigenvalue), i.e. unit variance over the rated songs.
Re-run it only when you want the axes recomputed (they stay fixed while ratings are added, so the cube does not shift).
Maturity is not part of the axes: the page shows it as the colour of each dot."""
import json, math, os
HERE = os.path.dirname(os.path.abspath(__file__))
g = json.load(open(os.path.join(HERE, "gems.json"), encoding="utf-8"))
SC = g["scales"][:9]
rows = [r for r in g["songs"].values()]
n = len(rows)
mean = [sum(r[k] for r in rows) / n for k in SC]
sd = [math.sqrt(sum((r[k] - m) ** 2 for r in rows) / (n - 1)) for k, m in zip(SC, mean)]
Z = [[(r[k] - m) / s for k, m, s in zip(SC, mean, sd)] for r in rows]
corr = [[sum(z[i] * z[j] for z in Z) / (n - 1) for j in range(9)] for i in range(9)]


def jacobi(m):
    k = len(m); a = [r[:] for r in m]; v = [[float(i == j) for j in range(k)] for i in range(k)]
    for _ in range(200):
        p, q, big = 0, 1, 0.0
        for i in range(k):
            for j in range(i + 1, k):
                if abs(a[i][j]) > big:
                    big, p, q = abs(a[i][j]), i, j
        if big < 1e-12:
            break
        th = 0.5 * math.atan2(2 * a[p][q], a[q][q] - a[p][p]); c, s = math.cos(th), math.sin(th)
        for r in range(k):
            x, y = a[r][p], a[r][q]; a[r][p], a[r][q] = c * x - s * y, s * x + c * y
        for r in range(k):
            x, y = a[p][r], a[q][r]; a[p][r], a[q][r] = c * x - s * y, s * x + c * y
        for r in range(k):
            x, y = v[r][p], v[r][q]; v[r][p], v[r][q] = c * x - s * y, s * x + c * y
    vals = [a[i][i] for i in range(k)]
    order = sorted(range(k), key=lambda i: -vals[i])
    return [vals[i] for i in order], [[v[r][i] for r in range(k)] for i in order]


vals, vecs = jacobi(corr)
# name each axis by what it measures; flip the sign so the named "high" end is positive
# every axis is named after its HIGH end and grows toward the pleasant side; (name, high end, low end, scale that must load with the given sign)
NAMES = [("Calm", "Calm · tender", "Bright · strong", "peacefulness", +1),
         ("Ease", "Easy · cheerful", "Demanding · intense", "tension", -1),
         ("Awe", "Awe · grandeur", "Everyday", "wonder", +1)]
axes = []
tot = sum(vals)
for i, (name, high, low, anchor, sign) in enumerate(NAMES):
    vec = vecs[i]
    j = SC.index(anchor)
    if vec[j] * sign < 0:
        vec = [-x for x in vec]
    assert max(range(9), key=lambda t: abs(vec[t])) in (j, SC.index("tenderness"), SC.index("transcendence"), SC.index("tension"), SC.index("sadness")), (name, vec)
    axes.append({"name": name, "high": high, "low": low, "loadings": [round(x, 4) for x in vec], "eigenvalue": round(vals[i], 4),
                 "variance": round(vals[i] / tot, 4)})
out = {"scales": SC, "mean": [round(x, 4) for x in mean], "sd": [round(x, 4) for x in sd], "axes": axes, "built_from": n}
open(os.path.join(HERE, "axes.json"), "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
for a in axes:
    top = sorted(zip(SC, a["loadings"]), key=lambda t: -abs(t[1]))[:4]
    print(f'{a["name"]:14s} {a["variance"]:.0%}  ' + ", ".join(f"{k} {v:+.2f}" for k, v in top))
# sanity: the three axes are uncorrelated and have unit variance
def score(z, a): return sum(l * x for l, x in zip(a["loadings"], z)) / math.sqrt(a["eigenvalue"])
S = [[score(z, a) for a in axes] for z in Z]
cc = [[sum(s[i] * s[j] for s in S) / (n - 1) for j in range(3)] for i in range(3)]
print("axis correlations (should be ~0, diagonal ~1):", [[round(x, 3) for x in r] for r in cc])
print("ranges:", [(round(min(s[i] for s in S), 1), round(max(s[i] for s in S), 1)) for i in range(3)])
