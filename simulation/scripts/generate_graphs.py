from dash import html
import numpy as np
import pandas as pd
import json
from glob import glob
import matplotlib
from matplotlib.backends.backend_pgf import FigureCanvasPgf

matplotlib.backend_bases.register_backend("pdf", FigureCanvasPgf)

matplotlib.use("pgf")
# matplotlib.rcParams.update(
#     {
#         "pgf.texsystem": "pdflatex",
#         "font.family": "serif",
#         "text.usetex": True,
#         "pgf.rcfonts": False,
#     }
# )

tabs = [
    dict(label="Probabilité de panne", value="failure_probability"),
    dict(label="Taille de groupe", value="group_size"),
    dict(label="Fanout", value="fanout"),
    dict(label="Profondeur", value="depth"),
]
roles = ["Aggregator", "LeafAggregator", "Contributor", "Backup", "Querier"]
statistics = [
    "initial_nodes",
    "final_nodes",
    "failures",
    "work",
    "messages",
    "work_per_node",
    "delta_nodes",
    "bandwidth",
]


def get_data(path, aggregate_message=True):
    if ".json" in path:
        with open(path) as f:
            data = json.load(f)

        df = pd.concat([pd.DataFrame(i) for i in data])
    else:
        df = pd.read_csv(path, sep=";", decimal=",")
        # We used different decimal format, check which one we have
        if "float64" not in df.dtypes.unique():
            df = pd.read_csv(path, sep=";")

    df.rename(
        mapper={
            "seed": "run_id",
            "failureRate": "failure_probability",
            "observedFailureRate": "failure_rate",
            "emissionTime": "emitter_time",
            "receptionTime": "receiver_time",
            "emitterId": "emitter_id",
            "receiverId": "receiver_id",
            "latency": "simulation_length",
            "work": "total_work",
            "groupSize": "group_size",
            "circulatingAggregateIds": "circulating_aggregate_ids",
            "currentlyCirculatingVersions": "currently_circulating_ids",
            "usedBandwidth": "bandwidth",
            "finalUsedBandwidth": "final_bandwidth",
        },
        axis=1,
        inplace=True,
    )
    df.reset_index(inplace=True)
    df.fillna(0, inplace=True)

    df.loc[df["run_id"].str.startswith("OPTI-leader"), "strategy"] = "O_LEADER"
    df.loc[df["run_id"].str.startswith("EAGER-leader"), "strategy"] = "E_LEADER"

    for r in roles:
        df[f"work_per_node_{r}"] = (
            df[f"work_{r}"] / df[f"final_nodes_{r}"]
            if (df[f"final_nodes_{r}"] != 0).any()
            else 0
        )
        df[f"delta_nodes_{r}"] = df[f"final_nodes_{r}"] - df[f"initial_nodes_{r}"]

    df.fillna(0, inplace=True)
    for s in statistics:
        df[f"{s}_total"] = 0
        for r in roles:
            df[f"{s}_total"] += df[f"{s}_{r}"]

    if aggregate_message:
        df = df.groupby(["run_id", "status", "strategy"]).mean()
        df.reset_index(inplace=True)

    return df


def generate_box(quantiles, index):
    if pd.Series(quantiles).hasnans:
        return ""

    return f"""
      \\addplot+[
      pattern=none,
      boxplot prepared={{
        lower whisker={quantiles[0]},
        lower quartile={quantiles[1]},
        median={quantiles[2]},
        upper quartile={quantiles[3]},
        upper whisker={quantiles[4]},
        draw position={index},
        box extend=0.1,
      }},
      ] coordinates {{}};"""


def generate_tick(o, key, tick, index):
    return (
        generate_box(o["STRAW"][f"{key}-{str(tick)}"], index - 0.15)
        + generate_box(o["EAGER"][f"{key}-{str(tick)}"], index)
        + generate_box(o["OPTI"][f"{key}-{str(tick)}"], index + 0.15)
    )


def generate_graph(o, key, params):
    return "\n".join([generate_tick(o, key, p, i + 1) for (i, p) in enumerate(params)])


def generate_figure(o, key, xticks, xticklabels, xlabel, ylabel, caption):
    boxes = generate_graph(o, key, xticks)
    return f"""
\\begin{{figure}}
  \\begin{{tikzpicture}}
    \\begin{{axis}}
      [
      area legend,
      xtick={{{",".join([str(i + 1) for i in range(len(xticklabels))])}}},
      xticklabels={{{",".join(xticklabels)}}},
      xlabel={xlabel},
      ylabel={ylabel},
      boxplot/draw direction=y,
      cycle list name=color,
      legend entries={{Strawman, Tolerant, Resilient}},
      legend style={{
          cells={{anchor=west}},
          legend pos=inner north east,
      }},
      legend image post style={{mark=None,are legend}}
      ]
      {boxes}
      \\end{{axis}}
    \\node[below right] at (border.north east) {{\\ref{{legend}}}};
  \\end{{tikzpicture}}
  \\caption{{{caption}}}
\\end{{figure}}
"""


if __name__ == "__main__":
    with open("./dissec.config.json") as f:
        config = json.load(f)

    data = get_data(config["defaultGraph"])

    run_ids = pd.unique(data["run_id"])
    strategies = pd.unique(data["strategy"])
    status = pd.unique(data["status"])
    data["failure_probability"] = data["failure_probability"].round(6)
    depths = np.sort(pd.unique(data["depth"]))
    sizes = np.sort(pd.unique(data["group_size"]))
    failure_probabilities = np.sort(pd.unique(data["failure_probability"]))
    failure_rates = np.sort(pd.unique(data["failure_rate"]))

    outputs = glob("./outputs/*")

    # Remove strategies not present in the data
    strategies_map = dict(STRAW="Strawman", EAGER="Eager", OPTI="Optimistic")

    # Work per strategies
    res = {
        "work": {},
        "latency": {},
        "completeness": {},
    }
    for strategy in strategies_map:
        df = (
            data[data["strategy"] == strategy]
            .groupby(["failure_probability", "run_id"], as_index=False)
            .mean()
        )

        if strategy not in res["work"]:
            res["work"][strategy] = {}
            res["latency"][strategy] = {}
            res["completeness"][strategy] = {}

        for proba in failure_probabilities:
            df2 = df[df["failure_probability"] == proba].copy()
            df2 = df2[df2["depth"] == 6.0]
            df2 = df2[df2["group_size"] == 5.0]
            quantiles = [0, 0.25, 0.5, 0.75, 1]

            res["work"][strategy][f"failures-{str(proba)}"] = [
                quantile["work_total"]
                for quantile in [df2.quantile(q) for q in quantiles]
            ]
            res["latency"][strategy][f"failures-{str(proba)}"] = [
                quantile["simulation_length"]
                for quantile in [df2.quantile(q) for q in quantiles]
            ]
            res["completeness"][strategy][f"failures-{str(proba)}"] = [
                quantile["completeness"]
                for quantile in [df2.quantile(q) for q in quantiles]
            ]

        for d in depths:
            df2 = df[df["depth"] == d].copy()
            df2 = df2[df2["failure_probability"] == 0.00005]
            df2 = df2[df2["group_size"] == 5.0]
            quantiles = [0, 0.25, 0.5, 0.75, 1]

            res["work"][strategy][f"depth-{str(d)}"] = [
                quantile["work_total"]
                for quantile in [df2.quantile(q) for q in quantiles]
            ]
            res["latency"][strategy][f"depth-{str(d)}"] = [
                quantile["simulation_length"]
                for quantile in [df2.quantile(q) for q in quantiles]
            ]
            res["completeness"][strategy][f"depth-{str(d)}"] = [
                quantile["completeness"]
                for quantile in [df2.quantile(q) for q in quantiles]
            ]

        for g in sizes:
            df2 = df[df["group_size"] == g].copy()
            df2 = df2[df2["failure_probability"] == 0.00005]
            df2 = df2[df2["depth"] == 6.0]
            quantiles = [0, 0.25, 0.5, 0.75, 1]

            res["work"][strategy][f"group-{str(g)}"] = [
                quantile["work_total"]
                for quantile in [df2.quantile(q) for q in quantiles]
            ]
            res["latency"][strategy][f"group-{str(g)}"] = [
                quantile["simulation_length"]
                for quantile in [df2.quantile(q) for q in quantiles]
            ]
            res["completeness"][strategy][f"group-{str(g)}"] = [
                quantile["completeness"]
                for quantile in [df2.quantile(q) for q in quantiles]
            ]

    with open("./outputs/graphs.tex", "w") as f:
        # Failure probabilities
        f.write(
            generate_figure(
                res["work"],
                "failures",
                failure_probabilities,
                ["0.0\%", "3.7\%", "7.2\%", "10.6\%", "13.9\%"],
                "Maximum expected failures",
                "Total work",
                "Total work of each strategies at different failure probabilities",
            )
        )
        f.write(
            generate_figure(
                res["latency"],
                "failures",
                failure_probabilities,
                ["0.0\%", "3.7\%", "7.2\%", "10.6\%", "13.9\%"],
                "Maximum Expected Failures",
                "Protocol latency",
                "Protocol latency of each strategies at different failure probabilities",
            )
        )
        f.write(
            generate_figure(
                res["completeness"],
                "failures",
                failure_probabilities,
                ["0.0\%", "3.7\%", "7.2\%", "10.6\%", "13.9\%"],
                "Maximum expected failures",
                "Completeness",
                "Completeness of each strategies at different failure probabilities",
            )
        )

        # Depth
        f.write(
            generate_figure(
                res["work"],
                "depth",
                [4.0, 5.0, 6.0, 7.0],
                ["1003", "4009", "16033", "64131"],
                "Nodes in the tree",
                "Total work",
                "Total work of each strategies at different depth",
            )
        )
        f.write(
            generate_figure(
                res["latency"],
                "depth",
                [4.0, 5.0, 6.0, 7.0],
                ["1003", "4009", "16033", "64131"],
                "Nodes in the tree",
                "Protocol latency",
                "Protocol latency of each strategies at different depth",
            )
        )
        f.write(
            generate_figure(
                res["completeness"],
                "depth",
                [4.0, 5.0, 6.0, 7.0],
                ["1003", "4009", "16033", "64131"],
                "Nodes in the tree",
                "Completeness",
                "Completeness of each strategies at different depth",
            )
        )

        # Group size
        f.write(
            generate_figure(
                res["work"],
                "group",
                [3.0, 4.0, 5.0, 6.0],
                ["3", "4", "5", "6"],
                "Security parameter",
                "Total work",
                "Total work of each strategies at different group size",
            )
        )
        f.write(
            generate_figure(
                res["latency"],
                "group",
                [3.0, 4.0, 5.0, 6.0],
                ["3", "4", "5", "6"],
                "Security parameter",
                "Protocol latency",
                "Protocol latency of each strategies at different group size",
            )
        )
        f.write(
            generate_figure(
                res["completeness"],
                "group",
                [3.0, 4.0, 5.0, 6.0],
                ["3", "4", "5", "6"],
                "Security parameter",
                "Completeness",
                "Completeness of each strategies at different group size",
            )
        )
