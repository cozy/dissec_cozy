import plotly_express as px
import plotly.graph_objs as go
from dash import html, dcc, dash
import numpy as np
import pandas as pd
import json
from glob import glob
import sys
from itertools import cycle
from plotly.subplots import make_subplots

tabs = [
    dict(label="Probabilité de panne", value="failure_probability"),
    dict(label="Taille de groupe", value="group_size"),
    dict(label="Fanout", value="fanout"),
    dict(label="Profondeur", value="depth"),
]
roles = ["Aggregator", "LeafAggregator", "Contributor", "Backup", "Querier", "Worker"]
statistics = [
    "initial_nodes",
    "final_nodes",
    "failures",
    "work",
    "messages",
    "work_per_node",
    "bandwidth_per_node",
    "delta_nodes",
    "inbound_bandwidth",
    "outbound_bandwidth",
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

    df["name"] = df["name"] + "-g" + df["groupSize"].map(str)
    df.rename(
        mapper={
            "seed": "seed",
            "name": "run_id",
            "buildingBlocks": "strategy",
            "failureRate": "failure_window",
            "observedFailureRate": "failure_rate",
            "observedContributorsFailureRate": "failure_rate_contributors",
            "observedWorkersFailureRate": "failure_rate_workers",
            "emissionTime": "emitter_time",
            "receptionTime": "receiver_time",
            "emitterId": "emitter_id",
            "receiverId": "receiver_id",
            "latency": "simulation_length",
            "work": "total_work",
            "groupSize": "group_size",
            "modelSize": "model_size",
            "circulatingAggregateIds": "circulating_aggregate_ids",
            "currentlyCirculatingVersions": "currently_circulating_ids",
            "inboundBandwidth": "inbound_bandwidth",
            "outboundBandwidth": "outbound_bandwidth",
            "finalInboundBandwidth": "final_inbound_bandwidth",
            "finalOutboundBandwidth": "final_outbound_bandwidth",
        },
        axis=1,
        inplace=True,
    )
    df.drop(
        index=df[df["strategy"] == "LFP,Replace,0Resync,3,NonBlocking"].index,
        inplace=True,
    )
    df.reset_index(inplace=True)
    df.fillna(0, inplace=True)

    strategies = pd.unique(df["strategy"])
    translate_strategies = {
        "FFP,Drop,Stop,1,None": "LowCost",
        "LFP,Replace,Stay,1,NonBlocking": "HighCmpl",
        "LFP,Drop,Stop,1,FullSync": "S&P",
        "LFP,Replace,0Resync,1,NonBlocking": "Hybrid",
        "LFP,Replace,0Resync,1,Leaves": "HyBlock",
    }
    for s in strategies:
        df.loc[df["strategy"] == s, "strategy"] = (
            translate_strategies[s] if s in translate_strategies else s
        )

    for stat in statistics:
        if (
            "work_per_node" in stat
            or "delta_nodes" in stat
            or "bandwidth_per_node" in stat
        ):
            continue

        df[f"{stat}_Worker"] = (
            df[f"{stat}_Aggregator"]
            + df[f"{stat}_LeafAggregator"]
            + df[f"{stat}_Querier"]
        )

    for r in roles:
        df[f"work_per_node_{r}"] = (
            df[f"work_{r}"] / df[f"final_nodes_{r}"]
            if (df[f"final_nodes_{r}"] != 0).any()
            else 0
        )
        df[f"bandwidth_per_node_{r}"] = (
            df[f"inbound_bandwidth_{r}"] / df[f"final_nodes_{r}"]
            if (df[f"final_nodes_{r}"] != 0).any()
            else 0
        )
        df[f"delta_nodes_{r}"] = df[f"final_nodes_{r}"] - df[f"initial_nodes_{r}"]
        df[f"delta_nodes_{r}"] = df[f"delta_nodes_{r}"].abs()

    df.fillna(0, inplace=True)
    for s in statistics:
        df[f"{s}_total"] = 0
        for r in roles:
            df[f"{s}_total"] += df[f"{s}_{r}"]

    if aggregate_message:
        df = df.groupby(["run_id", "status", "strategy"]).mean()
        df.reset_index(inplace=True)

    df.loc[df["failure_window"] == 0, "failure_window"] = np.inf
    df["failure_probability"] = 100 / df["failure_window"]
    df["failure_probability"] = df["failure_probability"].round(5)

    df["has_result"] = df["completeness"] > 0

    # Computing % versions per level
    cols = ["_level_0", "_level_1", "_level_2", "_level_3", "_level_4"]
    for c in cols:
        depth = int(c.split("_")[-1])
        df["versions_percent" + c] = df["versions" + c] / df["fanout"] ** (
            df["depth"] - depth
        )
        df["work_avg" + c] = df["work" + c] / df["fanout"] ** (df["depth"] - depth)

    to_drop = [
        {"seed": "2-3", "depth": 4, "model_size": 1024, "group_size": 5},
        {"seed": "3-6", "depth": 4, "model_size": 1024, "group_size": 5},
    ]
    for d in to_drop:
        df.drop(
            index=df[
                (df["seed"] == d["seed"])
                & (df["depth"] == d["depth"])
                & (df["model_size"] == d["model_size"])
                & (df["group_size"] == d["group_size"])
            ].index,
            inplace=True,
        )

    return df


def generate_summary(data, status, strategies):
    return (
        html.Div(
            style={"justifyContent": "center"},
            children=[
                html.H1("Overview:"),
                html.Ul(
                    children=[
                        html.Li(
                            children=[
                                f"There are {len(data.groupby('run_id'))} simulations. {len(data[data['status'] == 'Success'].groupby('run_id'))} success, {len(data[data['status'] != 'Success'].groupby('run_id'))} failures",
                                html.Ul(
                                    children=[
                                        html.Li(
                                            children=f"""
                            {len(pd.unique(data[data['status'] == i]['run_id']))} have status {i}.
                            Theoretical failure rate (min={round(data[data['status'] == i]['failure_probability'].min() * 100, 2)}%;
                            avg={round(data[data['status'] == i]['failure_probability'].mean() * 100, 2)}%;
                            med={round(data[data['status'] == i]['failure_probability'].median() * 100, 2)}%;
                            max={round(data[data['status'] == i]['failure_probability'].max() * 100, 2)}%).
                            Observed failure rate (min={round(data[data['status'] == i]['failure_rate'].min() * 100, 2)}%;
                            avg={round(data[data['status'] == i]['failure_rate'].mean() * 100, 2)}%;
                            med={round(data[data['status'] == i]['failure_rate'].median() * 100, 2)}%;
                            max={round(data[data['status'] == i]['failure_rate'].max() * 100, 2)}%)
                            """
                                        )
                                        for i in status
                                    ]
                                ),
                            ]
                        ),
                        html.Li(
                            children=[
                                "Different strategies have been used:",
                                html.Ul(
                                    children=[
                                        html.Li(
                                            children=[
                                                f"{len(data[data['strategy'] == i])} runs using {i} strategy, {len(data.loc[(data['status'] == 'Success') & (data['strategy'] == i)])} success"
                                            ]
                                        )
                                        for i in strategies
                                    ]
                                ),
                            ]
                        ),
                    ]
                ),
            ],
        ),
    )


def generate_graphs(data, strategies_map, tab="failure_probability", export=True):
    graphs = dict()

    strategies = pd.unique(data["strategy"])
    failure_probabilities = [0, 0.01, 0.25, 0.5, 1]
    group_sizes = np.sort(pd.unique(data["group_size"]))
    fanouts = np.sort(pd.unique(data["fanout"]))
    depths = np.sort(pd.unique(data["depth"]))
    print("graphing", strategies, failure_probabilities, depths, group_sizes)

    box_points = False
    box_points = "all"

    default_failure = 0.25
    default_window = 400
    default_depth = 4
    default_group = 5
    default_size = 2**10

    completeness_margin = 0.95
    small_tree = 3
    large_tree = 4
    tiny_model = 1
    small_model = 2**10
    large_model = 2**12
    y_maps_values = [
        (small_tree, tiny_model),
        (large_tree, tiny_model),
        (small_tree, small_model),
        (large_tree, small_model),
        (small_tree, large_model),
        (large_tree, large_model),
    ]
    map_completeness = np.zeros(
        (len(y_maps_values), len(failure_probabilities), len(strategies))
    )
    map_work = np.zeros(
        (len(y_maps_values), len(failure_probabilities), len(strategies))
    )
    map_latency = np.zeros(
        (len(y_maps_values), len(failure_probabilities), len(strategies))
    )
    for (j, (depth, model_size)) in enumerate(y_maps_values):
        for (i, failure) in enumerate(failure_probabilities):
            for (k, strat) in enumerate(strategies):
                map_completeness[j, i, k] = data[
                    (data["depth"] == depth)
                    & (data["model_size"] == model_size)
                    & (data["failure_probability"] == failure)
                    & (data["group_size"] == 5)
                    & (data["strategy"] == strat)
                ]["completeness"].mean()
                map_work[j, i, k] = data[
                    (data["depth"] == depth)
                    & (data["model_size"] == model_size)
                    & (data["failure_probability"] == failure)
                    & (data["strategy"] == strat)
                ]["work_per_node_total"].mean()
                map_latency[j, i, k] = data[
                    (data["depth"] == depth)
                    & (data["model_size"] == model_size)
                    & (data["failure_probability"] == failure)
                    & (data["strategy"] == strat)
                ]["simulation_length"].mean()

    np.nan_to_num(map_completeness, False)
    np.nan_to_num(map_work, False)
    np.nan_to_num(map_latency, False)
    best_strat_completeness_labels_map = [
        ["" for i in range(len(failure_probabilities))]
        for j in range(len(y_maps_values))
    ]
    best_strat_completeness_map = [
        ["" for i in range(len(failure_probabilities))]
        for j in range(len(y_maps_values))
    ]
    best_strat_work_labels_map = [
        ["" for i in range(len(failure_probabilities))]
        for j in range(len(y_maps_values))
    ]
    best_strat_work_map = [
        ["" for i in range(len(failure_probabilities))]
        for j in range(len(y_maps_values))
    ]
    best_strat_latency_labels_map = [
        ["" for i in range(len(failure_probabilities))]
        for j in range(len(y_maps_values))
    ]
    best_strat_latency_map = [
        ["" for i in range(len(failure_probabilities))]
        for j in range(len(y_maps_values))
    ]

    strat_symbol = ["LC", "HC", "SP", "Hy", "HyB"]
    for (j, (depth, model_size)) in enumerate(y_maps_values):
        for (i, failure) in enumerate(failure_probabilities):
            complete_strategies = np.where(
                (
                    map_completeness[j, i, :]
                    >= completeness_margin * np.max(map_completeness[j, i, :])
                )
            )[0]

            best_strat_completeness_map[j][i] = np.round(
                np.max(map_completeness[j, i, :]), 2
            )
            best_strat_completeness_labels_map[j][i] = strat_symbol[
                np.where(
                    map_completeness[j, i, :] == np.max(map_completeness[j, i, :])
                )[0][0]
            ]

            best_strat_work_map[j][i] = np.round(np.max(map_work[j, i, :]), 2)

            efficient_strategies = [
                complete_strategies[
                    np.where(
                        map_work[j, i, complete_strategies]
                        == np.min(map_work[j, i, complete_strategies])
                    )[0]
                ]
            ]
            intersect = np.intersect1d(
                complete_strategies,
                efficient_strategies,
            )
            most_efficient_strategy = (
                complete_strategies if len(intersect) == 0 else intersect
            )

            best_strat_work_labels_map[j][i] = ", ".join(
                [strat_symbol[index] for index in most_efficient_strategy]
            )

            best_strat_latency_map[j][i] = np.round(np.max(map_latency[j, i, :]), 2)
            best_strat_latency_labels_map[j][i] = strat_symbol[
                np.where(map_latency[j, i, :] == np.min(map_latency[j, i, :]))[0][0]
            ]

    # Export
    if export:
        dfs_completeness = []
        dfs_work = []
        dfs_latency = []

        def map_to_df(map_data, k, strat):
            df = pd.DataFrame(
                map_data,
                columns=["None", "Few", "Some", "A lot", "Extreme"],
                index=y_maps_values,
            )
            df["strat"] = strat
            df = df[["strat"] + ["None", "Few", "Some", "A lot", "Extreme"]]
            return df

        for (k, strat) in enumerate(strategies):
            dfs_completeness.append(map_to_df(map_completeness[:, :, k], k, strat))
            dfs_work.append(map_to_df(map_work[:, :, k], k, strat))
            dfs_latency.append(map_to_df(map_latency[:, :, k], k, strat))

        pd.concat(dfs_completeness, axis=0).to_csv(
            f"./outputs/final/map_completeness.csv",
            sep=";",
            index=True,
            index_label="(Height, Model size)",
        )
        pd.concat(dfs_work, axis=0).to_csv(
            f"./outputs/final/map_work.csv",
            sep=";",
            index=True,
            index_label="(Height, Model size)",
        )
        pd.concat(dfs_latency, axis=0).to_csv(
            f"./outputs/final/map_latency.csv",
            sep=";",
            index=True,
            index_label="(Height, Model size)",
        )
        pd.DataFrame(
            best_strat_work_labels_map,
            columns=["None", "Few", "Some", "A lot", "Extreme"],
            index=y_maps_values,
        ).to_csv(f"./outputs/final/map_bests.csv", sep=";", index=False)

    graphs["map_completeness"] = go.Figure(
        data=go.Heatmap(
            z=best_strat_completeness_map,
            text=best_strat_completeness_map,
            texttemplate="%{text}",
            textfont={"size": 20},
            x=["None", "Few", "Some", "A lot", "Extreme"],
            y=[
                f"depth{depth} model{model_size}"
                for (depth, model_size) in y_maps_values
            ],
        ),
    ).update_layout(title_text="Completeness")
    graphs["map_work"] = go.Figure(
        data=go.Heatmap(
            z=best_strat_work_map,
            text=best_strat_work_map,
            texttemplate="%{text}",
            textfont={"size": 20},
            x=["None", "Few", "Some", "A lot", "Extreme"],
            y=[
                f"depth{depth} model{model_size}"
                for (depth, model_size) in y_maps_values
            ],
        ),
    ).update_layout(title_text="Work per node (s)")
    graphs["map_latency"] = go.Figure(
        data=go.Heatmap(
            z=best_strat_latency_map,
            text=best_strat_latency_map,
            texttemplate="%{text}",
            textfont={"size": 20},
            x=["None", "Few", "Some", "A lot", "Extreme"],
            y=[
                f"depth{depth} model{model_size}"
                for (depth, model_size) in y_maps_values
            ],
        ),
    ).update_layout(title_text="Execution Latency (s)")
    graphs["map_best"] = go.Figure(
        data=go.Heatmap(
            z=best_strat_completeness_map,
            text=best_strat_work_labels_map,
            texttemplate="%{text}",
            textfont={"size": 20},
            x=["None", "Few", "Some", "A lot", "Extreme"],
            y=[
                f"depth{depth} model{model_size}"
                for (depth, model_size) in y_maps_values
            ],
        ),
    ).update_layout(width=1500, height=600)

    plots_config = [
        dict(
            {
                "name": "some_failure_tiny_model_completeness",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["model_size"] == 1)
                    & (data["group_size"] == default_group)
                ],
                "x": "failure_probability",
                "y": "completeness",
                "range_x": [0.2, 0.55],
                "range_y": [60, 110],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "some_failure_tiny_model_latency",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["model_size"] == 1)
                    & (data["group_size"] == default_group)
                ],
                "x": "failure_probability",
                "y": "simulation_length",
                "range_x": [0.2, 0.55],
                "range_y": [0, 10],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "some_failure_tiny_model_work_per_node",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["model_size"] == 1)
                    & (data["group_size"] == default_group)
                ],
                "x": "failure_probability",
                "y": "work_per_node_total",
                "range_x": [0.2, 0.55],
                "range_y": [0, 15],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "some_failure_tiny_model_bandwidth_per_node",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["model_size"] == 1)
                    & (data["group_size"] == default_group)
                ],
                "x": "failure_probability",
                "y": "inbound_bandwidth_total",
                "range_x": [0.2, 0.55],
                "range_y": [0, 50000],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "some_failure_completeness",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["model_size"] == default_size)
                    & (data["group_size"] == default_group)
                ],
                "x": "failure_probability",
                "y": "completeness",
                "range_x": [0.2, 0.55],
                "range_y": [60, 110],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "some_failure_latency",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["model_size"] == default_size)
                    & (data["group_size"] == default_group)
                ],
                "x": "failure_probability",
                "y": "simulation_length",
                "range_x": [0.2, 0.55],
                "range_y": [0, 10],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "some_failure_work_per_node",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["model_size"] == default_size)
                    & (data["group_size"] == default_group)
                ],
                "x": "failure_probability",
                "y": "work_per_node_total",
                "range_x": [0.2, 0.55],
                "range_y": [0, 15],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "some_failure_bandwidth",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["model_size"] == default_size)
                    & (data["group_size"] == default_group)
                ],
                "x": "failure_probability",
                "y": "inbound_bandwidth_total",
                "range_x": [0.2, 0.55],
                "range_y": [0, 50000000],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "high_failures_completeness",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["model_size"] == default_size)
                    & (data["group_size"] == default_group)
                ],
                "x": "failure_probability",
                "y": "completeness",
                "range_x": [0.45, 1.25],
                "range_y": [0, 110],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "high_failures_latency",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["model_size"] == default_size)
                    & (data["group_size"] == default_group)
                ],
                "x": "failure_probability",
                "y": "simulation_length",
                "range_x": [0.45, 1.25],
                "range_y": [0, 50],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "depth_completeness",
                "data": data[
                    (data["failure_probability"] == default_failure)
                    & (data["model_size"] == default_size)
                    & (data["group_size"] == default_group)
                ],
                "x": "depth",
                "y": "completeness",
                "range_x": [2.5, 5.5],
                "range_y": [0, 110],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "depth_latency",
                "data": data[
                    (data["failure_probability"] == default_failure)
                    & (data["model_size"] == default_size)
                    & (data["group_size"] == default_group)
                ],
                "x": "depth",
                "y": "simulation_length",
                "range_x": [2.5, 5.5],
                "range_y": [0, 120],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "size_completeness",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["failure_probability"] == default_failure)
                    & (data["group_size"] == default_group)
                ],
                "x": "model_size",
                "y": "completeness",
                "range_x": [0.5, 20000],
                "range_y": [0, 110],
                "log_x": True,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "size_latency",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["failure_probability"] == default_failure)
                    & (data["group_size"] == default_group)
                ],
                "x": "model_size",
                "y": "simulation_length",
                "range_x": [0.5, 20000],
                "range_y": [0, 200],
                "log_x": True,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "group_completeness",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["failure_probability"] == default_failure)
                    & (data["model_size"] == default_size)
                ],
                "x": "group_size",
                "y": "completeness",
                "range_x": [3.5, 6.5],
                "range_y": [0, 110],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "group_latency",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["failure_probability"] == default_failure)
                    & (data["model_size"] == default_size)
                ],
                "x": "group_size",
                "y": "simulation_length",
                "range_x": [3.5, 6.5],
                "range_y": [0, 50],
                "log_x": False,
                "log_y": False,
            }
        ),
        dict(
            {
                "name": "group_work",
                "data": data[
                    (data["depth"] == default_depth)
                    & (data["failure_probability"] == default_failure)
                    & (data["model_size"] == default_size)
                ],
                "x": "group_size",
                "y": "work_per_node_total",
                "range_x": [3.5, 6.5],
                "range_y": [0, 50],
                "log_x": False,
                "log_y": False,
            }
        ),
    ]

    def make_final_box_plot(config):
        if len(config["data"]) == 0:
            print(f"{config['x']}_{config['range_x']}-{config['y']} failed to print...")
            return

        # Export
        if True:
            print(
                f"{config['x']}_{config['range_x']}-{config['y']}.csv",
                pd.unique(config["data"]["group_size"]),
            )
            df = pd.DataFrame(index=config["data"].index)
            df[config["x"]] = config["data"][config["x"]]
            df["name"] = config["data"]["run_id"].str.split(pat="-m", expand=True)[1]
            strats = pd.unique(config["data"]["strategy"])
            for strat in strats:
                df[strat] = config["data"][config["data"]["strategy"] == strat][
                    config["y"]
                ]

            df = df.groupby(["name"]).mean()
            df.sort_values(config["x"], inplace=True)
            df.to_csv(
                f"./outputs/final/{config['name']}_{config['x']}_{config['range_x']}-{config['y']}.csv",
                sep=";",
                index=False,
            )

        return px.box(
            config["data"],
            x=config["x"],
            range_x=config["range_x"],
            y=config["y"],
            range_y=config["range_y"],
            color="strategy",
            hover_name="run_id",
            points=box_points,
            log_x=config["log_x"],
            log_y=config["log_y"],
        )

    for conf in plots_config:
        graphs[conf["name"]] = make_final_box_plot(conf)

    graphs[f"count_failure_paper"] = px.box(
        data[(data["depth"] == default_depth) & (data["model_size"] == default_size)],
        x="failure_probability",
        y="initial_nodes_Contributor",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        # log_x=True,
        title=f"Contributors for Failure",
    )
    graphs[f"count_depth_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["model_size"] == default_size)
        ],
        x="depth",
        y="initial_nodes_Contributor",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_y=True,
        title=f"Contributors for depth",
    )
    graphs[f"count_group_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["depth"] == default_depth)
        ],
        x="model_size",
        y="initial_nodes_Contributor",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_x=True,
        title=f"Contributors for model size",
    )

    graphs[f"failures_contributors_failure_paper"] = px.box(
        data[(data["depth"] == default_depth) & (data["model_size"] == default_size)],
        x="failure_probability",
        y="failure_rate_contributors",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        # log_x=True,
        title=f"Observed contributors failures for Failure",
    )
    graphs[f"failures_contributors_depth_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["model_size"] == default_size)
        ],
        x="depth",
        y="failure_rate_contributors",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_y=True,
        title=f"Observed contributors failures for depth",
    )
    graphs[f"failures_contributors_group_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["depth"] == default_depth)
        ],
        x="model_size",
        y="failure_rate_contributors",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_x=True,
        title=f"Observed contributors failures for model size",
    )

    graphs[f"failures_workers_failure_paper"] = px.box(
        data[(data["depth"] == default_depth) & (data["model_size"] == default_size)],
        x="failure_probability",
        y="failure_rate_workers",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        # log_x=True,
        title=f"Observed workers failures for Failure",
    )
    graphs[f"failures_workers_depth_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["model_size"] == default_size)
        ],
        x="depth",
        y="failure_rate_workers",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_y=True,
        title=f"Observed workers failures for depth",
    )
    graphs[f"failures_workers_group_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["depth"] == default_depth)
        ],
        x="model_size",
        y="failure_rate_workers",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_x=True,
        title=f"Observed workers failures for model size",
    )

    graphs[f"work_failure_paper"] = px.box(
        data[(data["depth"] == default_depth) & (data["model_size"] == default_size)],
        x="failure_probability",
        y="work_per_node_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        # log_x=True,
        title=f"Work for Failure",
    )
    graphs[f"work_depth_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["model_size"] == default_size)
        ],
        x="depth",
        y="work_per_node_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_y=True,
        title=f"Work for depth",
    )
    graphs[f"work_group_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["depth"] == default_depth)
        ],
        x="model_size",
        y="work_per_node_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_x=True,
        log_y=True,
        title=f"Work for model size",
    )

    graphs[f"latency_failure_paper"] = px.box(
        data[(data["depth"] == default_depth) & (data["model_size"] == default_size)],
        x="failure_probability",
        y="simulation_length",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        # log_x=True,
        title=f"Latency for Failure",
    )
    graphs[f"latency_depth_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["model_size"] == default_size)
        ],
        x="depth",
        y="simulation_length",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_y=True,
        title=f"Latency for depth",
    )
    graphs[f"latency_group_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["depth"] == default_depth)
        ],
        x="model_size",
        y="simulation_length",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_x=True,
        log_y=True,
        title=f"Latency for model size",
    )

    graphs[f"bandwidth_failure_paper"] = px.box(
        data[(data["depth"] == default_depth) & (data["model_size"] == default_size)],
        x="failure_probability",
        y="inbound_bandwidth_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        # log_x=True,
        title=f"Bandwidth for Failure",
    )
    graphs[f"bandwidth_depth_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["model_size"] == default_size)
        ],
        x="depth",
        y="inbound_bandwidth_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_y=True,
        title=f"Bandwidth for depth",
    )
    graphs[f"bandwidth_group_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["depth"] == default_depth)
        ],
        x="model_size",
        y="inbound_bandwidth_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_x=True,
        log_y=True,
        title=f"Bandwidth for model size",
    )

    graphs[f"completeness_failure_paper"] = px.box(
        data[(data["depth"] == default_depth) & (data["model_size"] == default_size)],
        x="failure_probability",
        y="completeness",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        # log_x=True,
        title=f"Completeness for Failure",
    )
    graphs[f"completeness_depth_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["model_size"] == default_size)
        ],
        x="depth",
        y="completeness",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Completeness for depth",
    )
    graphs[f"completeness_group_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["depth"] == default_depth)
        ],
        x="model_size",
        y="completeness",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_x=True,
        title=f"Completeness for model size",
    )

    graphs[f"versions_failure_paper"] = px.box(
        data[(data["depth"] == default_depth) & (data["model_size"] == default_size)],
        x="failure_probability",
        y="circulating_aggregate_ids",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        # log_x=True,
        title=f"Versions for Failure",
    )
    graphs[f"versions_depth_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["model_size"] == default_size)
        ],
        x="depth",
        y="circulating_aggregate_ids",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Versions for depth",
    )
    graphs[f"versions_group_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["depth"] == default_depth)
        ],
        x="model_size",
        y="circulating_aggregate_ids",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_x=True,
        title=f"Versions for model size",
    )

    avg_data = (
        data[
            (data["depth"] == default_depth)
            & (data["model_size"] == default_size)
            & (data["failure_window"] <= 400)
            & (data["failure_window"] >= 200)
        ]
        .groupby(["strategy", "failure_probability"], as_index=False)
        .mean()
    )
    graphs[f"avg_work_contributors_paper"] = px.line(
        avg_data,
        x="failure_probability",
        y="work_per_node_Contributor",
        color="strategy",
        title=f"Average work per node",
    )
    graphs[f"avg_work_workers_paper"] = px.line(
        avg_data,
        x="failure_probability",
        y="work_per_node_Worker",
        color="strategy",
        title=f"Average work per node",
    )

    graphs[f"failures_line"] = px.line(
        data[(data["model_size"] == default_size) & (data["depth"] == default_depth)]
        .groupby(["strategy", "failure_probability"], as_index=False)
        .mean(),
        x="failure_probability",
        y="has_result",
        color="strategy",
    )

    # Stacked bars
    def create_bars(
        df,
        x_axis,
        x_label,
        y_axis,
        y_label,
        columns=["_Worker", "_Contributor"],
        export=False,
        prefix="",
    ):
        plot_df = df.groupby([x_axis, "strategy"], as_index=False).mean()
        columns = [y_axis + col for col in columns]
        palette = cycle(px.colors.qualitative.Alphabet)
        # palette = cycle(px.colors.sequential.PuBu)
        colors = {c: next(palette) for c in columns}

        # subplot setup
        # fig = make_subplots(rows=1, cols=1)
        fig = go.Figure()
        fig.update_layout(
            template="simple_white",
            xaxis=dict(title_text=x_label),
            yaxis=dict(title_text=y_label),
            # barmode="stack",
            width=800,
            height=730,
        )

        if export:
            dfs = []
            for x in pd.unique(plot_df[x_axis]):
                for cols in columns:
                    tmp = []
                    # strategies = pd.unique(plot_df["strategy"])
                    for strat in strategies:
                        tmp.append(
                            plot_df[
                                (plot_df["strategy"] == strat) & (plot_df[x_axis] == x)
                            ][cols].iloc[0]
                        )

                    dfs.append(
                        pd.DataFrame(
                            [[x, cols.split("_")[-1]] + tmp],
                            columns=[x_label, "Level"] + [s for s in strategies],
                        )
                    )

            pd.concat(dfs, axis=0,).to_csv(
                f"./outputs/final/{prefix}bars_{x_axis}-{y_axis}.csv",
                sep=";",
                index=False,
            )

        # add bars
        for cols in columns:
            fig.add_trace(
                go.Bar(
                    x=[plot_df["strategy"], plot_df[x_axis]],
                    y=plot_df[cols],
                    name=cols,
                    legendgroup=cols,
                    marker_color=colors[cols],
                    showlegend=True,
                )
            )

        return fig

    # Bars per roles
    cols = ["_Aggregator", "_LeafAggregator", "_Contributor", "_Backup", "_Querier"]
    graphs[f"initial_nodes_count_bar"] = create_bars(
        data,
        "depth",
        "Depth",
        "initial_nodes",
        "Initial node counts",
        cols,
    )
    graphs[f"final_nodes_count_bar"] = create_bars(
        data,
        "depth",
        "Depth",
        "final_nodes",
        "Final node counts",
        cols,
    )
    graphs[f"delta_nodes_count_bar"] = create_bars(
        data,
        "depth",
        "Depth",
        "delta_nodes",
        "Delta node counts",
        cols,
    )

    # Bars per level
    cols = ["_level_0", "_level_1", "_level_2", "_level_3", "_level_4"]
    graphs[f"work_level_bar"] = create_bars(
        data,
        "depth",
        "Depth",
        "work",
        "Work",
        cols,
    )
    graphs[f"messages_level_bar"] = create_bars(
        data,
        "depth",
        "Depth",
        "messages",
        "Messages",
        cols,
    )
    graphs[f"bandwidth_level_bar"] = create_bars(
        data,
        "depth",
        "Depth",
        "inbound_bandwidth",
        "Bandwidth",
        cols,
    )

    graphs[f"failures_level_bar"] = create_bars(
        data,
        "depth",
        "Depth",
        "failures",
        "Failures",
        cols,
    )
    graphs[f"versions_level_bar"] = create_bars(
        data,
        "depth",
        "Depth",
        "versions",
        "Versions",
        cols,
    )
    graphs[f"propagation_level_bar"] = create_bars(
        data,
        "depth",
        "Depth",
        "propagation",
        "Propagation",
        cols,
    )

    graphs[f"versions_level_tiny_bar_focus"] = create_bars(
        data[
            (data["depth"] == default_depth)
            & (data["model_size"] == 1)
            & (data["strategy"] != "Min Cost")
        ],
        "failure_probability",
        "Failure rate (%/s)",
        "versions_percent",
        "Versions",
        cols,
        True,
        "tiny_",
    )
    graphs[f"work_level_tiny_bar_focus"] = create_bars(
        data[
            (data["depth"] == default_depth)
            & (data["model_size"] == 1)
            & (data["strategy"] != "Min Cost")
        ],
        "failure_probability",
        "Failure rate (%/s)",
        "work_avg",
        "Average work per node",
        cols,
        True,
        "tiny_",
    )
    graphs[f"versions_level_bar_focus"] = create_bars(
        data[
            (data["depth"] == default_depth)
            & (data["model_size"] == default_size)
            & (data["strategy"] != "Min Cost")
        ],
        "failure_probability",
        "Failure rate (%/s)",
        "versions_percent",
        "Versions",
        cols,
        export,
    )
    graphs[f"work_level_bar_focus"] = create_bars(
        data[
            (data["depth"] == default_depth)
            & (data["model_size"] == default_size)
            & (data["strategy"] != "Min Cost")
        ],
        "failure_probability",
        "Failure rate (%/s)",
        "work_avg",
        "Average work per node",
        cols,
        export,
    )
    graphs[f"versions_level_bar_simpler"] = px.bar(
        data[
            (data["depth"] == default_depth)
            & (data["model_size"] == default_size)
            & (data["failure_window"] <= 400)
            & (data["failure_window"] >= 200)
        ]
        .groupby("strategy", as_index=False)
        .mean(),
        x="strategy",
        y=[
            "versions_level_0",
            "versions_level_1",
            "versions_level_2",
            "versions_level_3",
            "versions_level_4",
        ],
    )

    graphs[f"work_failure_bar"] = create_bars(
        data[(data["depth"] == default_depth) & (data["model_size"] == default_size)],
        "failure_probability",
        "Failures",
        "work_per_node",
        "Work per node type",
    )
    graphs[f"work_depth_bar"] = create_bars(
        data[
            (data["failure_window"] == default_window)
            & (data["model_size"] == default_size)
        ],
        "depth",
        "Depth",
        "work_per_node",
        "Work per node type",
    )
    graphs[f"work_size_bar"] = create_bars(
        data[
            (data["failure_window"] == default_window)
            & (data["depth"] == default_depth)
        ],
        "model_size",
        "Model Size",
        "work_per_node",
        "Work per node type",
    )

    graphs[f"bandwidth_failure_bar"] = create_bars(
        data[(data["depth"] == default_depth) & (data["model_size"] == default_size)],
        "failure_probability",
        "Failures",
        "bandwidth_per_node",
        "Bandwidth per node type",
    )
    graphs[f"bandwidth_depth_bar"] = create_bars(
        data[
            (data["failure_window"] == default_window)
            & (data["model_size"] == default_size)
        ],
        "depth",
        "Depth",
        "bandwidth_per_node",
        "Bandwidth per node type",
    )
    graphs[f"bandwidth_size_bar"] = create_bars(
        data[
            (data["failure_window"] == default_window)
            & (data["depth"] == default_depth)
        ],
        "model_size",
        "Model Size",
        "bandwidth_per_node",
        "Bandwidth per node type",
    )

    graphs[f"completeness_avg_line"] = px.line(
        data[(data["model_size"] == default_size) & (data["depth"] == default_depth)]
        .groupby(["strategy", "failure_probability"], as_index=False)
        .mean(),
        x="failure_probability",
        y="completeness",
        color="strategy",
    )
    graphs[f"bandwidth_avg_line"] = px.line(
        data[(data["model_size"] == default_size) & (data["depth"] == default_depth)]
        .groupby(["strategy", "failure_probability"], as_index=False)
        .mean(),
        x="failure_probability",
        y="inbound_bandwidth_total",
        color="strategy",
    )

    # Update plots
    to_update_plots = [
        "failures_contributors_failure_paper",
        "failures_contributors_depth_paper",
        "failures_contributors_group_paper",
        "work_failure_paper",
        "work_depth_paper",
        "work_group_paper",
        "latency_failure_paper",
        "latency_depth_paper",
        "latency_group_paper",
        "bandwidth_failure_paper",
        "bandwidth_depth_paper",
        "bandwidth_group_paper",
        "completeness_failure_paper",
        "completeness_depth_paper",
        "completeness_group_paper",
    ]
    for plot in to_update_plots:
        # graphs[plot] = graphs[plot].update_traces(marker=dict(opacity=0))
        # graphs[plot] = graphs[plot].update_traces(quartilemethod="exclusive")
        continue

    to_update_plots = [
        "failures_contributors_failure_paper",
        "work_failure_paper",
        "latency_failure_paper",
        "bandwidth_failure_paper",
        "completeness_failure_paper",
    ]
    for plot in to_update_plots:
        graphs[plot] = graphs[plot].update_traces(width=0.05 / 3)
        graphs[plot] = graphs[plot].update_layout(boxgap=0.005, boxgroupgap=0.01)

    for plot in plots_config:
        # graphs[plot['name']] = graphs[plot['name']].update_traces(marker=dict(opacity=0))
        pass

    return html.Div(
        children=[
            html.Div(
                style={
                    "display": "flex",
                    "flex-wrap": "wrap",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        style={
                            "width": "600px",
                        },
                        id=conf["name"],
                        figure=graphs[conf["name"]],
                    )
                    for conf in plots_config
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"map_completeness",
                        figure=graphs["map_completeness"],
                    ),
                    dcc.Graph(
                        id=f"map_work",
                        figure=graphs["map_work"],
                    ),
                    dcc.Graph(
                        id=f"map_latency",
                        figure=graphs["map_latency"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"map_best",
                        figure=graphs["map_best"],
                    )
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"count_failure_paper",
                        figure=graphs["count_failure_paper"],
                    ),
                    dcc.Graph(
                        id=f"count_depth_paper",
                        figure=graphs["count_depth_paper"],
                    ),
                    dcc.Graph(
                        id=f"count_group_paper",
                        figure=graphs["count_group_paper"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"failures_contributors_failure_paper",
                        figure=graphs["failures_contributors_failure_paper"],
                    ),
                    dcc.Graph(
                        id=f"failures_contributors_depth_paper",
                        figure=graphs["failures_contributors_depth_paper"],
                    ),
                    dcc.Graph(
                        id=f"failures_contributors_group_paper",
                        figure=graphs["failures_contributors_group_paper"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"failures_workers_failure_paper",
                        figure=graphs["failures_workers_failure_paper"],
                    ),
                    dcc.Graph(
                        id=f"failures_workers_depth_paper",
                        figure=graphs["failures_workers_depth_paper"],
                    ),
                    dcc.Graph(
                        id=f"failures_workers_group_paper",
                        figure=graphs["failures_workers_group_paper"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"work_failure_paper",
                        figure=graphs["work_failure_paper"],
                    ),
                    dcc.Graph(
                        id=f"work_depth_paper",
                        figure=graphs["work_depth_paper"],
                    ),
                    dcc.Graph(
                        id=f"work_group_paper",
                        figure=graphs["work_group_paper"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"latency_failure_paper",
                        figure=graphs["latency_failure_paper"],
                    ),
                    dcc.Graph(
                        id=f"latency_depth_paper",
                        figure=graphs["latency_depth_paper"],
                    ),
                    dcc.Graph(
                        id=f"latency_group_paper",
                        figure=graphs["latency_group_paper"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"bandwidth_failure_paper",
                        figure=graphs["bandwidth_failure_paper"],
                    ),
                    dcc.Graph(
                        id=f"bandwidth_depth_paper",
                        figure=graphs["bandwidth_depth_paper"],
                    ),
                    dcc.Graph(
                        id=f"bandwidth_group_paper",
                        figure=graphs["bandwidth_group_paper"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"completeness_failure_paper",
                        figure=graphs["completeness_failure_paper"],
                    ),
                    dcc.Graph(
                        id=f"completeness_depth_paper",
                        figure=graphs["completeness_depth_paper"],
                    ),
                    dcc.Graph(
                        id=f"completeness_group_paper",
                        figure=graphs["completeness_group_paper"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"versions_failure_paper",
                        figure=graphs["versions_failure_paper"],
                    ),
                    dcc.Graph(
                        id=f"versions_depth_paper",
                        figure=graphs["versions_depth_paper"],
                    ),
                    dcc.Graph(
                        id=f"versions_group_paper",
                        figure=graphs["versions_group_paper"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"failures_line",
                        figure=graphs["failures_line"],
                    ),
                ],
            ),
            html.H1("Bar plots"),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"work_failure_bar",
                        figure=graphs["work_failure_bar"],
                    ),
                    dcc.Graph(
                        id=f"work_depth_bar",
                        figure=graphs["work_depth_bar"],
                    ),
                    dcc.Graph(
                        id=f"work_size_bar",
                        figure=graphs["work_size_bar"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"bandwidth_failure_bar",
                        figure=graphs["bandwidth_failure_bar"],
                    ),
                    dcc.Graph(
                        id=f"bandwidth_depth_bar",
                        figure=graphs["bandwidth_depth_bar"],
                    ),
                    dcc.Graph(
                        id=f"bandwidth_size_bar",
                        figure=graphs["bandwidth_size_bar"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"initial_nodes_count_bar",
                        figure=graphs["initial_nodes_count_bar"],
                    ),
                    dcc.Graph(
                        id=f"final_nodes_count_bar",
                        figure=graphs["final_nodes_count_bar"],
                    ),
                    dcc.Graph(
                        id=f"delta_nodes_count_bar",
                        figure=graphs["delta_nodes_count_bar"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"work_level_bar",
                        figure=graphs["work_level_bar"],
                    ),
                    dcc.Graph(
                        id=f"messages_level_bar",
                        figure=graphs["messages_level_bar"],
                    ),
                    dcc.Graph(
                        id=f"bandwidth_level_bar",
                        figure=graphs["bandwidth_level_bar"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"failures_level_bar",
                        figure=graphs["failures_level_bar"],
                    ),
                    dcc.Graph(
                        id=f"versions_level_bar",
                        figure=graphs["versions_level_bar"],
                    ),
                    dcc.Graph(
                        id=f"propagation_level_bar",
                        figure=graphs["propagation_level_bar"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"versions_level_bar_simpler",
                        figure=graphs["versions_level_bar_simpler"],
                    ),
                    dcc.Graph(
                        id=f"versions_level_bar_focus",
                        figure=graphs["versions_level_bar_focus"],
                    ),
                    dcc.Graph(
                        id=f"work_level_bar_focus",
                        figure=graphs["work_level_bar_focus"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"versions_level_tiny_bar_focus",
                        figure=graphs["versions_level_tiny_bar_focus"],
                    ),
                    dcc.Graph(
                        id=f"work_level_tiny_bar_focus",
                        figure=graphs["work_level_tiny_bar_focus"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"avg_work_contributors_paper",
                        figure=graphs["avg_work_contributors_paper"],
                    ),
                    dcc.Graph(
                        id=f"avg_work_workers_paper",
                        figure=graphs["avg_work_workers_paper"],
                    ),
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"completeness_avg_line",
                        figure=graphs["completeness_avg_line"],
                    ),
                    dcc.Graph(
                        id=f"bandwidth_avg_line",
                        figure=graphs["bandwidth_avg_line"],
                    ),
                ],
            ),
        ]
    )


if __name__ == "__main__":
    with open("./dissec.config.json") as f:
        config = json.load(f)

    data = get_data(config["defaultGraph"], True if "aggregate" in sys.argv else False)

    run_ids = pd.unique(data["run_id"])
    strategies = pd.unique(data["strategy"])
    status = pd.unique(data["status"])
    # data["failure_probability"] = data["failure_probability"].round(6)
    failure_probabilities = np.sort(pd.unique(data["failure_probability"]))
    failure_rates = np.sort(pd.unique(data["failure_rate"]))

    print(
        "on startup",
        strategies,
        pd.unique(data["depth"]),
        pd.unique(data["group_size"]),
        pd.unique(data["failure_probability"]),
        len(data),
        failure_probabilities,
        np.sort(pd.unique(data["model_size"])),
        np.sort(pd.unique(data["depth"])),
    )

    outputs = glob("./outputs/*")

    # Remove strategies not present in the data
    strategies_map = {
        "FFP-Drop-Stop-None": "Strawman",
        "LFP-Drop-Stop-FullSync": "OneShot",
        "LFP-Replace-Stay-NonBlocking": "Eager",
    }
    for k in set(strategies_map.keys()).difference(strategies):
        del strategies_map[k]

    graphs = generate_graphs(data, strategies_map, False)
    summary = generate_summary(data, status, strategies)

    app = dash.Dash(__name__)

    app.layout = html.Div(
        children=[
            dcc.Store(id="store_file"),
            dcc.Tabs(
                id="tabs",
                value="failure_probability",
                children=[dcc.Tab(label=t["label"], value=t["value"]) for t in tabs],
            ),
            html.Div(
                children=[
                    html.H1(
                        children=f"Simulation  task",
                        style={"textAlign": "center", "color": "#7FDBFF"},
                    ),
                    dcc.Dropdown(
                        id="file-select",
                        options=[
                            dict(label=output.split("/")[-1], value=output)
                            for output in outputs
                        ],
                        value=config["defaultGraph"],
                    ),
                    html.H1(id="file_span", children=f"{config['defaultGraph']}"),
                ]
            ),
            html.Div(id="summary", children=summary),
            html.Div(
                [
                    html.H3("Failure Probabilities"),
                    dcc.RangeSlider(
                        0,
                        1000,
                        10,
                        value=[0, 1000],
                        id="failure-probabilities-range",
                    ),
                    html.H3("Group Sizes"),
                    dcc.RangeSlider(
                        3,
                        8,
                        1,
                        value=[3, 8],
                        id="group-sizes-range",
                    ),
                    html.H3("Depths"),
                    dcc.RangeSlider(
                        3,
                        7,
                        1,
                        value=[3, 7],
                        id="depths-range",
                    ),
                    html.H3("Model size"),
                    dcc.RangeSlider(
                        1,
                        30000,
                        1000,
                        value=[1, 30000],
                        id="model-range",
                    ),
                ]
            ),
            html.Div(
                children=[
                    html.Div(id="export-text", children=["Not exported yet"]),
                    html.Button("Export graphs", id="export-button", n_clicks=0),
                ]
            ),
            html.Div(id="graphs", children=[]),
        ]
    )

    @app.callback(
        dash.Output("export-text", "children"), dash.Input("export-button", "n_clicks")
    )
    def update_output(n_clicks):
        print("clicked")
        return f"Exported {n_clicks}"

    @app.callback(
        [dash.Output("store_file", "data"), dash.Output("file_span", "children")],
        dash.Input(component_id="file-select", component_property="value"),
    )
    def update_file(selected_file):
        return [get_data(selected_file).to_json(), selected_file]

    @app.callback(
        [
            dash.Output(component_id="summary", component_property="children"),
            dash.Output(component_id="graphs", component_property="children"),
        ],
        [
            dash.Input(
                component_id="failure-probabilities-range", component_property="value"
            ),
            dash.Input(component_id="group-sizes-range", component_property="value"),
            dash.Input(component_id="depths-range", component_property="value"),
            dash.Input(component_id="model-range", component_property="value"),
            dash.Input(component_id="tabs", component_property="value"),
        ],
        dash.State("store_file", "data"),
    )
    def update_graphs(
        selected_failures,
        selected_sizes,
        selected_depths,
        selected_model,
        tab,
        store_file,
    ):
        if not store_file:
            df = get_data(
                config["defaultGraph"], True if "aggregate" in sys.argv else False
            )
        else:
            df = pd.read_json(store_file)

        strategies = pd.unique(df["strategy"])
        status = pd.unique(df["status"])
        # df["failure_probability"] = df["failure_probability"].round(6)

        # Remove strategies not present in the data
        strategies_map = {
            "FFP-Drop-Stop-None": "Strawman",
            "LFP-Drop-Stop-FullSync": "OneShot",
            "LFP-Replace-Stay-NonBlocking": "Eager",
        }
        for k in set(strategies_map.keys()).difference(strategies):
            del strategies_map[k]

        print(
            "before filters",
            strategies,
            strategies_map,
            pd.unique(df["depth"]),
            pd.unique(df["group_size"]),
            pd.unique(df["failure_probability"]),
            len(df),
            selected_failures,
            selected_sizes,
            selected_depths,
        )

        df = df[
            (df["failure_probability"] >= selected_failures[0])
            & (df["failure_probability"] <= selected_failures[1])
        ]
        df = df[
            (df["group_size"] >= selected_sizes[0])
            & (df["group_size"] <= selected_sizes[1])
        ]
        df = df[
            (df["depth"] >= selected_depths[0]) & (df["depth"] <= selected_depths[1])
        ]
        df = df[
            (df["model_size"] >= selected_model[0])
            & (df["model_size"] <= selected_model[1])
        ]

        graphs = generate_graphs(df, strategies_map, tab, False)

        return [generate_summary(df, status, strategies), graphs]

    app.run_server(debug=True)
