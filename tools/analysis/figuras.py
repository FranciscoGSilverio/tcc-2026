"""Figuras do artigo -- protocolo, seção 7, item 2.

Lê os números de `node tools/analysis/resumo.mjs --json` em vez de
recalculá-los: a convergência tem uma implementação só (convergencia.mjs),
e uma segunda cópia em Python é como um número e o que ele significa se
separam.

O modelo do artigo (INATEL / Revista Telecomunicações) proíbe cor: tudo é
escala de cinza com hachura, e a identidade de cada série nunca depende só
do tom. Largura de uma coluna (8,5 cm), Times New Roman.

Uso:
    python tools/analysis/figuras.py [--saida DIR]

Escreve cada figura em PDF (vetorial, para o artigo) e PNG (300 dpi, para
slides) em DIR, por padrão `docs/figuras/`. É o único script de
tools/analysis que escreve, e só ali.
"""

import argparse
import json
import subprocess
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.lines import Line2D  # noqa: E402
from matplotlib.ticker import FuncFormatter  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
COL_WIDTH_IN = 8.5 / 2.54

plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "Times", "DejaVu Serif"],
    "font.size": 8,
    "axes.titlesize": 8,
    "axes.labelsize": 8,
    "legend.fontsize": 7,
    "xtick.labelsize": 7.5,
    "ytick.labelsize": 7.5,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.linewidth": 0.6,
    "xtick.major.width": 0.6,
    "ytick.major.width": 0.6,
    "hatch.linewidth": 0.6,
    "pdf.fonttype": 42,
    "svg.fonttype": "none",
})

# Two series per figure at most. Light fill + no hatch against dark fill +
# hatch: the pair stays distinguishable in print, in photocopy, and for a
# reader who cannot tell the two grays apart.
STYLE = {
    "a": {"facecolor": "#d9d9d9", "hatch": "", "edgecolor": "#000000"},
    "b": {"facecolor": "#7f7f7f", "hatch": "////", "edgecolor": "#000000"},
}
POINT = {"s": 9, "facecolor": "white", "edgecolor": "black", "linewidths": 0.6, "zorder": 3}
GRID = {"axis": "y", "color": "#bfbfbf", "linewidth": 0.4, "zorder": 0}
# The run markers and the untouched-seed line are named in the legend
# rather than annotated in the plot, where there is no free space for them.
EXTRA_HANDLES = [
    Line2D([], [], marker="o", linestyle="none", markersize=3.2, markerfacecolor="white", markeredgecolor="black", markeredgewidth=0.6),
    Line2D([], [], color="black", linewidth=0.7, linestyle=(0, (3, 2))),
]
EXTRA_LABELS = ["sessão individual", "semente intocada (13/26)"]
SHORT = {"claude-haiku-4-5": "Haiku 4.5", "claude-sonnet-5": "Sonnet 5", "claude-opus-5": "Opus 5"}


def load(dataset):
    command = ["node", str(REPO / "tools/analysis/resumo.mjs"), "--json"]
    if dataset:
        command += ["--dataset", dataset]
    return json.loads(subprocess.run(command, check=True, capture_output=True, text=True, encoding="utf-8").stdout)


def cell(data, model, task, p, o):
    for c in data["cells"]:
        if (c["model"], c["task"], c["p"], c["o"]) == (model, task, p, o):
            return c
    raise KeyError((model, task, p, o))


def conv(data, model, p, o):
    return data["convergence"][f"{model.removeprefix('claude-')} {p}-{o}"]


def fmt(v, d=2):
    return f"{v:.{d}f}".replace(".", ",")


def grouped(ax, groups, series, values, points=None, ylim=(0, 1.05), label_decimals=2):
    """Two bars per group. `values[s][g]` is the bar; `points[s][g]` the runs."""
    width = 0.36
    for si, name in enumerate(series):
        key = "a" if si == 0 else "b"
        xs = [g + (si - 0.5) * (width + 0.04) for g in range(len(groups))]
        ax.bar(xs, values[si], width, label=name, linewidth=0.6, zorder=2, **STYLE[key])
        for gi, (x, v) in enumerate(zip(xs, values[si])):
            # Above the bar and above every run marker, so the number never
            # sits on top of a point.
            top = max([v] + (list(points[si][gi]) if points else []))
            ax.text(x, top + 0.025 * (ylim[1] - ylim[0]), fmt(v, label_decimals), ha="center", va="bottom", fontsize=6)
        if points:
            for x, runs in zip(xs, points[si]):
                ax.scatter([x] * len(runs), runs, **POINT)
    ax.set_xticks(range(len(groups)))
    ax.set_xticklabels(groups)
    ax.set_ylim(*ylim)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: fmt(v, 1)))
    ax.grid(**GRID)
    ax.set_axisbelow(True)


def save(fig, out, name):
    out.mkdir(parents=True, exist_ok=True)
    fig.savefig(out / f"{name}.pdf", bbox_inches="tight")
    fig.savefig(out / f"{name}.png", dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"{out / name}.pdf  .png")


def fig_t1_grade(data, out):
    """taxa_aceitacao de T1 na grade principal (Sonnet 5)."""
    m = "claude-sonnet-5"
    levels = ["P0", "P1", "P2"]
    values, points = [], []
    for o in ["O1", "O2"]:
        cells = [cell(data, m, "T1", p, o)["metrics"]["taxa_aceitacao"] for p in levels]
        values.append([c["mean"] for c in cells])
        points.append([c["values"] for c in cells])
    fig, ax = plt.subplots(figsize=(COL_WIDTH_IN, 2.1))
    grouped(ax, ["P0 · sem contexto", "P1 · CLAUDE.md", "P2 · + plugin"], ["O1 · uma chamada", "O2 · quatro etapas"],
            values, points, ylim=(0, 1.12), label_decimals=3)
    ax.axhline(0.5, color="black", linewidth=0.7, linestyle=(0, (3, 2)), zorder=1)
    ax.set_ylabel("taxa_aceitacao (T1)")
    handles, labels = ax.get_legend_handles_labels()
    ax.legend(handles + EXTRA_HANDLES, labels + EXTRA_LABELS, loc="lower center", frameon=False, ncol=2,
              bbox_to_anchor=(0.5, 1.0), columnspacing=1.2, handlelength=1.6)
    save(fig, out, "fig1-t1-taxa-aceitacao-grade")


def fig_t2_grade(data, out):
    """convergência de T2 na grade principal (Sonnet 5)."""
    m = "claude-sonnet-5"
    levels = ["P0", "P1", "P2"]
    values = [[conv(data, m, p, o) for p in levels] for o in ["O1", "O2"]]
    fig, ax = plt.subplots(figsize=(COL_WIDTH_IN, 2.1))
    grouped(ax, ["P0 · sem contexto", "P1 · CLAUDE.md", "P2 · + plugin"], ["O1 · uma chamada", "O2 · quatro etapas"],
            values, ylim=(0, 1.12), label_decimals=1)
    ax.set_ylabel("convergência (T2, 10 pontos)")
    ax.legend(loc="lower center", frameon=False, ncol=2, bbox_to_anchor=(0.5, 1.0))
    save(fig, out, "fig2-t2-convergencia-grade")


def fig_modelo(data, out):
    """Modelo x harness nas duas configurações extremas, T1 e T2 lado a lado."""
    models = ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5"]
    names = [SHORT[m] for m in models]
    series = ["P0-O1 · harness mínimo", "P2-O2 · harness completo"]
    fig, (left, right) = plt.subplots(1, 2, figsize=(COL_WIDTH_IN, 2.3), sharey=True)
    acc = [[cell(data, m, "T1", p, o)["metrics"]["taxa_aceitacao"] for m in models] for p, o in [("P0", "O1"), ("P2", "O2")]]
    grouped(left, names, series, [[c["mean"] for c in s] for s in acc], [[c["values"] for c in s] for s in acc],
            ylim=(0, 1.12), label_decimals=2)
    left.axhline(0.5, color="black", linewidth=0.7, linestyle=(0, (3, 2)), zorder=1)
    left.set_title("(a) T1 · taxa_aceitacao")
    cv = [[conv(data, m, p, o) for m in models] for p, o in [("P0", "O1"), ("P2", "O2")]]
    grouped(right, names, series, cv, ylim=(0, 1.12), label_decimals=1)
    right.set_title("(b) T2 · convergência")
    for ax in (left, right):
        ax.tick_params(axis="x", labelsize=6.5)
    handles, labels = left.get_legend_handles_labels()
    fig.legend(handles + EXTRA_HANDLES, labels + EXTRA_LABELS, loc="lower center", ncol=2, frameon=False,
               bbox_to_anchor=(0.5, -0.12), columnspacing=1.2, handlelength=1.6)
    fig.subplots_adjust(bottom=0.2, wspace=0.12)
    save(fig, out, "fig3-modelo-x-harness")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--saida", default=str(REPO / "docs/figuras"))
    parser.add_argument("--dataset", default=None)
    args = parser.parse_args()
    data = load(args.dataset)
    out = Path(args.saida)
    fig_t1_grade(data, out)
    fig_t2_grade(data, out)
    fig_modelo(data, out)


if __name__ == "__main__":
    main()
