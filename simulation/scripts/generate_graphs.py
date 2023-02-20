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


def generate_graph(o, key, xticks, xticklabels, xlabel=None, ylabel=None, ymax=None):
    plots = "\n".join([generate_tick(o, key, p, i + 1) for (i, p) in enumerate(xticks)])
    start = f"""
    \\nextgroupplot[
        xtick={{{",".join([str(i+1) for i in range(len(xticks))])}}},
        xticklabels={{{",".join(xticklabels)}}},
        {'xlabel=' + xlabel + ',' if xlabel is not None else ''}
        {'ylabel=' + ylabel + ',' if ylabel is not None else ''}
        {'ymax=' + ymax + ',' if ymax is not None else ''}
    ]

    {plots}
"""
    return start


def generate_figure(data, ticks, ticklabels, caption):
    boxes = "\n".join(
        [
            generate_graph(
                data["work"],
                "failures",
                ticks[0],
                ticklabels[0],
                ylabel="Total work",
                ymax="100000000",
            ),
            generate_graph(
                data["work"], "depth", ticks[1], ticklabels[1], ymax="100000000"
            ),
            generate_graph(
                data["work"], "group", ticks[2], ticklabels[2], ymax="100000000"
            ),
            generate_graph(
                data["latency"],
                "failures",
                ticks[3],
                ticklabels[3],
                ylabel="Protocol latency",
            ),
            generate_graph(data["latency"], "depth", ticks[4], ticklabels[4]),
            generate_graph(data["latency"], "group", ticks[5], ticklabels[5]),
            generate_graph(
                data["completeness"],
                "failures",
                ticks[6],
                ticklabels[6],
                xlabel="Maximum expected failures",
                ylabel="Completeness",
            ),
            generate_graph(
                data["completeness"],
                "depth",
                ticks[7],
                ticklabels[7],
                xlabel="Nodes in the tree",
            ),
            generate_graph(
                data["completeness"],
                "group",
                ticks[8],
                ticklabels[8],
                xlabel="Group size",
            ),
        ]
    )
    return f"""
\\begin{{figure*}}
    \\centering
    \\resizebox{{\\textwidth}}{{!}}{{
    \\begin{{tikzpicture}}
        \\begin{{groupplot}}[
            group style={{group size= 3 by 3, group name=perfplots}},
            boxplot/draw direction=y,
            cycle list name=color,
            area legend,
        ]

            {boxes}
        \\end{{groupplot}}
    \\end{{tikzpicture}}
    }}
    \\caption{{{caption}}}
\\end{{figure*}}
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

    with open("./outputs/graphs_1figure.tex", "w") as f:
        # Failure probabilities
        f.write(
            generate_figure(
                res,
                [
                    failure_probabilities,
                    depths,
                    sizes,
                    failure_probabilities,
                    depths,
                    sizes,
                    failure_probabilities,
                    depths,
                    sizes,
                ],
                [
                    ["0.0\%", "3.7\%", "7.2\%", "10.6\%", "13.9\%"],
                    ["1003", "4009", "16033", "64131"],
                    ["3", "4", "5", "6"],
                    ["0.0\%", "3.7\%", "7.2\%", "10.6\%", "13.9\%"],
                    ["1003", "4009", "16033", "64131"],
                    ["3", "4", "5", "6"],
                    ["0.0\%", "3.7\%", "7.2\%", "10.6\%", "13.9\%"],
                    ["1003", "4009", "16033", "64131"],
                    ["3", "4", "5", "6"],
                ],
                "Performances under selected constraints",
            )
        )
