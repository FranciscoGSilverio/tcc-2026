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


# --- Figuras do artigo final -------------------------------------------------
#
# Acrescentadas em 23/11/2026, depois do artigo. As três de cima são da
# análise descritiva (docs/08) e não são as do artigo; o artigo tem cinco
# figuras, a Fig. 1 é um diagrama do processo, sem dados, e as outras
# quatro saíam de números que não tinham script no repositório. Estas
# refazem as Figs. 2 a 5 a partir dos scripts que agora existem, com os
# mesmos dados e no mesmo estilo; o desenho não é cópia do PDF.

MODELS = ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5"]
MARKER = {"claude-haiku-4-5": "s", "claude-sonnet-5": "o", "claude-opus-5": "^"}


def node_json(script, *extra):
    command = ["node", str(REPO / "tools/analysis" / script), "--json", *extra]
    return json.loads(subprocess.run(command, check=True, capture_output=True, text=True, encoding="utf-8").stdout)


def pct(v):
    return f"{round(v * 100)}%"


def fig_artigo2_requisitos(out):
    """Fig. 2: requisitos de T1 atendidos, sem guia (P0) e com guia (P1 e P2)."""
    groups = node_json("requisitos-t1.mjs")["groups"]
    types = [t["label"] for t in groups[0]["types"]]
    rules = ["(1 requisito)", "(4 requisitos)", "(2 requisitos)"]
    fig, ax = plt.subplots(figsize=(COL_WIDTH_IN, 2.2))
    width = 0.36
    for si, group in enumerate(groups):
        key = "a" if si == 0 else "b"
        xs = [g + (si - 0.5) * (width + 0.04) for g in range(len(types))]
        values = [t["ratio"] for t in group["types"]]
        ax.bar(xs, values, width, label=f"{group['label']}, n = {group['n']}", linewidth=0.6, zorder=2, **STYLE[key])
        for x, v in zip(xs, values):
            ax.text(x, v + 0.03, pct(v), ha="center", va="bottom", fontsize=6)
    ax.set_xticks(range(len(types)))
    ax.set_xticklabels([f"{t.replace('Implícito ', 'Implícito\n')}\n{r}" for t, r in zip(types, rules)], fontsize=6.5)
    ax.set_ylim(0, 1.15)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: pct(v)))
    ax.set_ylabel("Requisitos atendidos")
    ax.grid(**GRID)
    ax.set_axisbelow(True)
    ax.legend(loc="lower center", frameon=False, ncol=2, bbox_to_anchor=(0.5, 1.0))
    save(fig, out, "artigo-fig2-requisitos-t1")


def fig_artigo3_custo(data, out):
    """Fig. 3: custo médio por sessão (log) contra resultado, P0-O1 -> P2-O2."""
    fig, (left, right) = plt.subplots(1, 2, figsize=(COL_WIDTH_IN * 2, 2.4))
    panels = [(left, "T1", "taxa_aceitacao", "Taxa de aceitação em T1"),
              (right, "T2", "qualidade", "Qualidade em T2 (0 a 6)")]
    for ax, task, metric, ylabel in panels:
        for m in MODELS:
            a = cell(data, m, task, "P0", "O1")["metrics"]
            b = cell(data, m, task, "P2", "O2")["metrics"]
            xa, ya = a["custo_usd"]["mean"], a[metric]["mean"]
            xb, yb = b["custo_usd"]["mean"], b[metric]["mean"]
            ax.annotate("", xy=(xb, yb), xytext=(xa, ya),
                        arrowprops={"arrowstyle": "->", "color": "black", "linewidth": 0.6, "shrinkA": 4, "shrinkB": 4})
            ax.scatter([xa], [ya], marker=MARKER[m], s=22, facecolor="white", edgecolor="black", linewidths=0.7, zorder=3)
            ax.scatter([xb], [yb], marker=MARKER[m], s=22, facecolor="black", edgecolor="black", linewidths=0.7, zorder=3,
                       label=SHORT[m])
        ax.set_xscale("log")
        ax.set_xticks([0.2, 0.5, 1, 2, 4])
        ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: fmt(v, 2) if v < 1 else f"{v:g}"))
        ax.set_xlabel("Custo médio por sessão (US$, escala log.)")
        ax.set_ylabel(ylabel)
        ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _, d=2 if task == "T1" else 1: fmt(v, d)))
        ax.grid(**GRID)
        ax.set_axisbelow(True)
    left.set_title("P0-O1 (vazado) → P2-O2 (cheio)")
    left.legend(loc="lower right", frameon=False)
    fig.subplots_adjust(wspace=0.25)
    save(fig, out, "artigo-fig3-custo-x-resultado")


def fig_artigo4_complexidade(out):
    """Fig. 4: complexidade ciclomática das funções criadas ou alteradas."""
    data = node_json("complexidade.mjs", "--do-csv")
    dist = data["distribuicoes"]
    groups = [{"rotulo": "Semente\n(referência)", "valores": dist["semente"], "n": data["semente"]["n"],
               "acima_de_10": data["semente"]["acima"]}]
    for m in MODELS:
        stats = data["por_modelo_extremos"][m]
        groups.append({"rotulo": SHORT[m], "valores": dist[m], "n": stats["n"], "acima_de_10": stats["acima"]})
    fig, ax = plt.subplots(figsize=(COL_WIDTH_IN, 2.3))
    labels = [g["rotulo"] for g in groups]
    ax.boxplot([g["valores"] for g in groups], vert=False, widths=0.5, showfliers=True,
               medianprops={"color": "black", "linewidth": 0.8},
               boxprops={"linewidth": 0.6}, whiskerprops={"linewidth": 0.6}, capprops={"linewidth": 0.6},
               flierprops={"marker": "o", "markersize": 2.5, "markerfacecolor": "white", "markeredgewidth": 0.5})
    ax.set_yticks(range(1, len(groups) + 1))
    ax.set_yticklabels(labels)
    ax.invert_yaxis()
    ax.axvline(10, color="black", linewidth=0.7, linestyle=(0, (3, 2)), zorder=1)
    for i, g in enumerate(groups, start=1):
        ax.text(1.01, i, f"n = {g['n']}\n{pct(g['acima_de_10'] / g['n'] if g['n'] else 0)} > 10",
                transform=ax.get_yaxis_transform(), va="center", fontsize=6)
    ax.set_xlabel("Complexidade ciclomática por função")
    ax.grid(axis="x", color="#bfbfbf", linewidth=0.4, zorder=0)
    save(fig, out, "artigo-fig4-complexidade")


def fig_artigo5_convergencia(out):
    """Fig. 5: convergência oficial (vazado) e substantiva (cheio) por configuração."""
    rows = node_json("convergencia.mjs")
    order = ["haiku-4-5 P0-O1", "haiku-4-5 P2-O2"] + [f"sonnet-5 {c}" for c in
             ["P0-O1", "P0-O2", "P1-O1", "P1-O2", "P2-O1", "P2-O2"]] + ["opus-5 P0-O1", "opus-5 P2-O2"]
    by = {r["cell"]: r for r in rows}
    names = {"haiku-4-5": "Haiku 4.5", "sonnet-5": "Sonnet 5", "opus-5": "Opus 5"}
    fig, ax = plt.subplots(figsize=(COL_WIDTH_IN, 2.8))
    for i, key in enumerate(order):
        r = by[key]
        ax.plot([r["oficial"], r["substantiva"]], [i, i], color="#7f7f7f", linewidth=0.6, zorder=1)
        ax.scatter([r["oficial"]], [i], s=16, facecolor="white", edgecolor="black", linewidths=0.7, zorder=3,
                   label="Oficial (ausente conta como categoria)" if i == 0 else None)
        ax.scatter([r["substantiva"]], [i], s=16, facecolor="black", edgecolor="black", linewidths=0.7, zorder=3,
                   label="Substantiva (só decisões tomadas)" if i == 0 else None)
    model, config = zip(*(k.split(" ") for k in order))
    ax.set_yticks(range(len(order)))
    ax.set_yticklabels([f"{names[m]} {c}" for m, c in zip(model, config)], fontsize=6.5)
    ax.invert_yaxis()
    ax.set_xlim(-0.03, 1.03)
    ax.set_xticks([0, 0.25, 0.5, 0.75, 1])
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: fmt(v, 2) if v not in (0, 1) else f"{v:g}"))
    ax.set_xlabel("Proporção dos 10 pontos de decisão\ncom as 3 repetições em acordo")
    ax.grid(axis="x", color="#bfbfbf", linewidth=0.4, zorder=0)
    ax.legend(loc="lower center", frameon=False, ncol=1, bbox_to_anchor=(0.5, 1.0))
    save(fig, out, "artigo-fig5-convergencia")


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
    if args.dataset is None:
        # As figuras do artigo leem também sessions/ e docs/dados/, que só
        # descrevem o dataset publicado.
        fig_artigo2_requisitos(out)
        fig_artigo3_custo(data, out)
        fig_artigo4_complexidade(out)
        fig_artigo5_convergencia(out)


if __name__ == "__main__":
    main()
