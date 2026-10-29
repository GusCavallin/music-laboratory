"""Are the ten Feel scales independent (orthogonal)?  Pearson correlations, principal components and variance inflation
factors over every rated song in gems.json.   py -3 correlations.py   -> prints and writes correlations.md
Pure Python (no numpy): Jacobi eigenvalues for the symmetric correlation matrix, Gauss-Jordan for its inverse."""
import json, math, os
HERE = os.path.dirname(os.path.abspath(__file__))
g = json.load(open(os.path.join(HERE, "gems.json"), encoding="utf-8"))
SC = g["scales"]
rows = list(g["songs"].values())


def corr(a, b):
    pairs = [(r[a], r[b]) for r in rows if r[a] is not None and r[b] is not None]
    n = len(pairs)
    ma, mb = sum(x for x, _ in pairs) / n, sum(y for _, y in pairs) / n
    sa = math.sqrt(sum((x - ma) ** 2 for x, _ in pairs)); sb = math.sqrt(sum((y - mb) ** 2 for _, y in pairs))
    return sum((x - ma) * (y - mb) for x, y in pairs) / (sa * sb), n


def matrix(keys, complete):
    global rows
    saved = rows
    if complete:
        rows = [r for r in saved if all(r[k] is not None for k in keys)]
    m = [[1.0 if i == j else corr(a, b)[0] for j, b in enumerate(keys)] for i, a in enumerate(keys)]
    n = len(rows)
    rows = saved
    return m, n


def jacobi(m):
    n = len(m); a = [r[:] for r in m]; v = [[float(i == j) for j in range(n)] for i in range(n)]
    for _ in range(100):
        p, q, big = 0, 1, 0.0
        for i in range(n):
            for j in range(i + 1, n):
                if abs(a[i][j]) > big:
                    big, p, q = abs(a[i][j]), i, j
        if big < 1e-12:
            break
        th = 0.5 * math.atan2(2 * a[p][q], a[q][q] - a[p][p]); c, s = math.cos(th), math.sin(th)
        for k in range(n):
            akp, akq = a[k][p], a[k][q]; a[k][p], a[k][q] = c * akp - s * akq, s * akp + c * akq
        for k in range(n):
            apk, aqk = a[p][k], a[q][k]; a[p][k], a[q][k] = c * apk - s * aqk, s * apk + c * aqk
        for k in range(n):
            vkp, vkq = v[k][p], v[k][q]; v[k][p], v[k][q] = c * vkp - s * vkq, s * vkp + c * vkq
    vals = [a[i][i] for i in range(n)]
    order = sorted(range(n), key=lambda i: -vals[i])
    return [vals[i] for i in order], [[v[k][i] for k in range(n)] for i in order]  # eigenvalues, eigenvectors (rows)


def inverse(m):
    n = len(m); a = [r[:] + [float(i == j) for j in range(n)] for i, r in enumerate(m)]
    for i in range(n):
        piv = max(range(i, n), key=lambda r: abs(a[r][i])); a[i], a[piv] = a[piv], a[i]
        d = a[i][i]; a[i] = [x / d for x in a[i]]
        for r in range(n):
            if r != i:
                f = a[r][i]; a[r] = [x - f * y for x, y in zip(a[r], a[i])]
    return [r[n:] for r in a]


md = ["# Are the ten Feel scales orthogonal?", "",
      f"{len(rows)} rated songs. Ratings are Claude's estimates, so any correlation may partly come from how they were made "
      "(one rater, one pass) as well as from the music itself.", ""]
for title, keys, complete in (("All ten scales (songs that have a maturity score)", SC, True), ("The nine GEMS scales only (all songs)", SC[:9], False)):
    m, n = matrix(keys, complete)
    md += [f"## {title}: n = {n}", "", "### Correlations (Pearson r)", "", "| | " + " | ".join(k[:6] for k in keys) + " |", "|---|" + "---|" * len(keys)]
    for k, r in zip(keys, m):
        md.append(f"| {k} | " + " | ".join(f"{x:+.2f}" for x in r) + " |")
    off = [(abs(m[i][j]), m[i][j], keys[i], keys[j]) for i in range(len(keys)) for j in range(i + 1, len(keys))]
    off.sort(reverse=True)
    md += ["", f"Mean |r| between different scales: {sum(o[0] for o in off) / len(off):.2f}. Pairs with |r| >= 0.5:", ""]
    strong = [o for o in off if o[0] >= 0.5] or [None]
    md += [(f"- {o[2]} and {o[3]}: r = {o[1]:+.2f}" if o else "- none")for o in strong]
    md += ["", "Largest 5 pairs: " + "; ".join(f"{o[2]}/{o[3]} {o[1]:+.2f}" for o in off[:5]), ""]
    vals, vecs = jacobi(m); tot = sum(vals); cum = 0
    md += ["### Principal components (of the correlation matrix)", "", "| PC | eigenvalue | variance | cumulative |", "|---|---|---|---|"]
    for i, ev in enumerate(vals):
        cum += ev / tot
        md.append(f"| {i + 1} | {ev:.2f} | {ev / tot:.1%} | {cum:.1%} |")
    pr = tot ** 2 / sum(v * v for v in vals)
    md += ["", f"Effective number of independent dimensions (participation ratio): **{pr:.1f}** of {len(keys)}.", "",
           "Loadings of the first four components (|loading| >= 0.30 shown):", ""]
    for i in range(4):
        sign = -1 if sum(vecs[i]) < 0 else 1
        parts = [f"{keys[j]} {sign * vecs[i][j]:+.2f}" for j in sorted(range(len(keys)), key=lambda j: -abs(vecs[i][j])) if abs(vecs[i][j]) >= 0.30]
        md.append(f"- PC{i + 1} ({vals[i] / tot:.0%}): " + ", ".join(parts))
    inv = inverse(m)
    md += ["", "### Variance inflation factor (how much of a scale the others predict; 1 = independent, > 5 = heavily overlapping)", "",
           "| Scale | VIF | R² from the others |", "|---|---|---|"]
    md += [f"| {k} | {inv[i][i]:.2f} | {1 - 1 / inv[i][i]:.0%} |" for i, k in enumerate(keys)] + [""]
text = "\n".join(md) + "\n"
open(os.path.join(HERE, "correlations.md"), "w", encoding="utf-8", newline="\n").write(text)
print(text)
