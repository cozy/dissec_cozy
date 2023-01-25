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
        "FFP,Drop,Stop,1,None": "Extrem Perf",
        "LFP,Replace,Stay,1,NonBlocking": "Extreme complete",
        "LFP,Drop,Stop,1,FullSync": "Hybride perf",
        "LFP,Replace,0Resync,1,NonBlocking": "Hybrid complete",
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

    df.loc[df["failure_window"] == 0, "failure_window"] = 3200
    df["failure_window"] = df["failure_window"].round(2)
    df["failure_probability"] = df["initial_nodes_total"] / df["failure_window"]
    df["failure_probability"] = df["failure_probability"].round(2)

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


def generate_graphs(data, strategies_map, tab="failure_probability"):
    graphs = dict()

    strategies = pd.unique(data["strategy"])
    failure_probabilities = [
        i for i in reversed(np.sort(pd.unique(data["failure_probability"])))
    ]
    group_sizes = np.sort(pd.unique(data["group_size"]))
    fanouts = np.sort(pd.unique(data["fanout"]))
    depths = np.sort(pd.unique(data["depth"]))

    box_points = "all"

    default_failure = 33.37
    default_window = 400
    default_depth = 4
    default_group = 5
    default_size = 2**10

    # small_tree = 4
    # large_tree = 4
    # small_model = 2**10
    # large_model = 2**10
    # y_maps_values = [
    #     (small_tree, small_model),
    #     (small_tree, large_model),
    #     (large_tree, small_model),
    #     (large_tree, large_model),
    # ]
    # map_completeness = np.zeros(
    #     (len(y_maps_values), len(failure_probabilities), len(strategies))
    # )
    # map_work = np.zeros(
    #     (len(y_maps_values), len(failure_probabilities), len(strategies))
    # )
    # map_latency = np.zeros(
    #     (len(y_maps_values), len(failure_probabilities), len(strategies))
    # )
    # for (j, (depth, model_size)) in enumerate(y_maps_values):
    #     for (i, failure) in enumerate(failure_probabilities):
    #         for (k, strat) in enumerate(strategies):
    #             map_completeness[j, i, k] = data[
    #                 (data["depth"] == depth)
    #                 & (data["model_size"] == model_size)
    #                 & (data["failure_probability"] == failure)
    #                 & (data["strategy"] == strat)
    #             ]["completeness"].mean()
    #             map_work[j, i, k] = data[
    #                 (data["depth"] == depth)
    #                 & (data["model_size"] == model_size)
    #                 & (data["failure_probability"] == failure)
    #                 & (data["strategy"] == strat)
    #             ]["work_total"].mean()
    #             map_latency[j, i, k] = data[
    #                 (data["depth"] == depth)
    #                 & (data["model_size"] == model_size)
    #                 & (data["failure_probability"] == failure)
    #                 & (data["strategy"] == strat)
    #             ]["simulation_length"].mean()

    # best_strat_completeness_labels_map = [
    #     ["" for i in range(len(failure_probabilities))]
    #     for j in range(len(y_maps_values))
    # ]
    # best_strat_completeness_map = [
    #     ["" for i in range(len(failure_probabilities))]
    #     for j in range(len(y_maps_values))
    # ]
    # best_strat_work_labels_map = [
    #     ["" for i in range(len(failure_probabilities))]
    #     for j in range(len(y_maps_values))
    # ]
    # best_strat_work_map = [
    #     ["" for i in range(len(failure_probabilities))]
    #     for j in range(len(y_maps_values))
    # ]
    # best_strat_latency_labels_map = [
    #     ["" for i in range(len(failure_probabilities))]
    #     for j in range(len(y_maps_values))
    # ]
    # best_strat_latency_map = [
    #     ["" for i in range(len(failure_probabilities))]
    #     for j in range(len(y_maps_values))
    # ]
    # strat_symbol = ["SM", "OS", "OPT", "HY1", "HY3"]
    # for (j, (depth, model_size)) in enumerate(y_maps_values):
    #     for (i, failure) in enumerate(failure_probabilities):
    #         best_strat_completeness_labels_map[j][i] = strat_symbol[
    #             np.where(
    #                 map_completeness[j, i, :] == np.max(map_completeness[j, i, :])
    #             )[0][0]
    #         ]
    #         best_strat_completeness_map[j][i] = np.max(map_completeness[j, i, :])
    #         best_strat_work_map[j][i] = np.max(map_work[j, i, :])
    #         print(
    #             "inner",
    #             map_work[j, i, np.where(map_completeness[j, i, :] > 0)][0],
    #             np.min(map_work[j, i, np.where(map_completeness[j, i, :] > 0)]),
    #             np.where(
    #                 map_work[j, i, :]
    #                 == np.min(map_work[j, i, np.where(map_completeness[j, i, :] > 0)])
    #             )[0],
    #             map_work[j, i, :],
    #             np.min(map_work[j, i, :]),
    #             np.where(map_work[j, i, :] == np.min(map_work[j, i, :]))[0],
    #             np.where(map_completeness[j, i, :] > 0),
    #         )
    #         best_strat_work_labels_map[j][i] = ", ".join(
    #             [
    #                 strat_symbol[index]
    #                 for index in np.where(
    #                     map_work[j, i, :]
    #                     == np.min(
    #                         map_work[j, i, np.where(map_completeness[j, i, :] > 0)][0]
    #                     )
    #                 )[0]
    #             ]
    #         )
    #         np.where((map_completeness[j, i, :] > 0))
    #         best_strat_latency_map[j][i] = np.max(map_latency[j, i, :])
    #         best_strat_latency_labels_map[j][i] = strat_symbol[
    #             np.where(map_latency[j, i, :] == np.min(map_latency[j, i, :]))[0][0]
    #         ]

    # graphs["map_best"] = go.Figure(
    #     data=go.Heatmap(
    #         z=best_strat_completeness_map,
    #         text=best_strat_work_labels_map,
    #         texttemplate="%{text}",
    #         textfont={"size": 20},
    #         x=["None", "Few", "Some", "A lot", "Extreme"],
    #         y=[
    #             f"depth{depth} model{model_size}"
    #             for (depth, model_size) in y_maps_values
    #         ],
    #     )
    # )

    graphs[f"count_failure_paper"] = px.box(
        data[(data["depth"] == default_depth) & (data["model_size"] == default_size)],
        x="failure_probability",
        y="initial_nodes_Contributor",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_x=True,
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
        log_x=True,
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
        log_x=True,
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
        y="work_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        log_x=True,
        title=f"Work for Failure",
    )
    graphs[f"work_depth_paper"] = px.box(
        data[
            (data["failure_window"] == default_window)
            & (data["model_size"] == default_size)
        ],
        x="depth",
        y="work_total",
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
        y="work_total",
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
        log_x=True,
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
        log_x=True,
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
        log_x=True,
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

    # Stacked bars
    def create_bars(
        df, x_axis, x_label, y_axis, y_label, columns=["_Worker", "_Contributor"]
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
            barmode="stack",
            width=800,
            height=730,
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

    return html.Div(
        children=[
            # html.Div(
            #     children=[
            #         dcc.Graph(
            #             id=f"map_best",
            #             figure=graphs["map_best"],
            #         )
            #     ]
            # ),
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
        ]
    )


if __name__ == "__main__":
    with open("./dissec.config.json") as f:
        config = json.load(f)

    data = get_data(config["defaultGraph"], True if "aggregate" in sys.argv else False)

    run_ids = pd.unique(data["run_id"])
    strategies = pd.unique(data["strategy"])
    status = pd.unique(data["status"])
    data["failure_probability"] = data["failure_probability"].round(6)
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

    graphs = generate_graphs(data, strategies_map)
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
                        10**9,
                        10**6,
                        value=[0, 10**9],
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
                        1000000,
                        1000,
                        value=[1, 1000],
                        id="model-range",
                    ),
                ]
            ),
            html.Div(id="graphs", children=[]),
        ]
    )

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
        df["failure_probability"] = df["failure_probability"].round(6)

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

        graphs = generate_graphs(df, strategies_map, tab)

        return [generate_summary(df, status, strategies), graphs]

    app.run_server(debug=True)
