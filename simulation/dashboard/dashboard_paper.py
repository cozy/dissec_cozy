import plotly_express as px
import plotly.graph_objs as go
from dash import html, dcc, dash
import numpy as np
import pandas as pd
import json
from glob import glob

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

    failure_probabilities = np.sort(pd.unique(data["failure_probability"]))
    group_sizes = np.sort(pd.unique(data["group_size"]))
    fanouts = np.sort(pd.unique(data["fanout"]))
    depths = np.sort(pd.unique(data["depth"]))

    box_points = "all"

    graphs["failure_rate_per_latency"] = px.scatter(
        data,
        x="simulation_length",
        y="failure_rate",
        color="failure_probability",
        hover_name="run_id",
        title=f"Failure rate by protocol latency",
        render_mode="svg",
    )

    graphs["failure_rate_per_failure_proba_protocol"] = px.box(
        data,
        x="failure_probability",
        y="failure_rate",
        color="strategy",
        points=box_points,
        title=f"Failure rate by failure probability, by protocol",
    )

    graphs["work_failure_rate_strategy_violin"] = px.violin(
        data,
        x=tab,
        y="work_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Travail selon {'la probabilité de panne' if tab == 'failure_probability' else 'la taille de groupe'} par stratégie",
    )
    graphs["work_failure_rate_strategy"] = px.box(
        data,
        x=tab,
        y="work_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Travail selon {'la probabilité de panne' if tab == 'failure_probability' else 'la taille de groupe'} par stratégie",
    )

    graphs["latency_failure_rate_strategy_violin"] = px.violin(
        data,
        x=tab,
        y="simulation_length",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Latence selon {'la probabilité de panne' if tab == 'failure_probability' else 'la taille de groupe'} par stratégie",
    )
    graphs["latency_failure_rate_strategy"] = px.box(
        data,
        x=tab,
        y="simulation_length",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Latence selon {'la probabilité de panne' if tab == 'failure_probability' else 'la taille de groupe'} par stratégie",
    )

    graphs["messages_strategy_violin"] = px.violin(
        data,
        x=tab,
        y="messages_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Messages selon {'la probabilité de panne' if tab == 'failure_probability' else 'la taille de groupe'} par stratégie",
    )
    graphs["messages_strategy"] = px.box(
        data,
        x=tab,
        y="messages_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Messages selon {'la probabilité de panne' if tab == 'failure_probability' else 'la taille de groupe'} par stratégie",
    )

    for strat in strategies_map:
        strat_df = data[data["strategy"] == strat].copy()
        tmp_mean = strat_df.groupby(
            ["strategy", "failure_probability"], as_index=False
        ).mean()
        tmp_median = strat_df.groupby(
            ["strategy", "failure_probability"], as_index=False
        ).median()
        tmp_lower = strat_df.groupby(
            ["strategy", "failure_probability"], as_index=False
        ).quantile(0.25)
        tmp_upper = strat_df.groupby(
            ["strategy", "failure_probability"], as_index=False
        ).quantile(0.75)
        graphs[f"{strategies_map[strat]}_length_scatter_strategy"] = px.scatter(
            strat_df,
            x="simulation_length",
            y="failure_rate",
            color="status",
            hover_name="run_id",
            title=f"{strategies_map[strat]} execution latency",
            render_mode="svg",
        )
        graphs[f"{strategies_map[strat]}_length_scatter_depth"] = px.scatter(
            strat_df,
            x="simulation_length",
            y="failure_rate",
            color="depth",
            hover_name="run_id",
            title=f"{strategies_map[strat]} execution latency",
            render_mode="svg",
        )
        graphs[f"{strategies_map[strat]}_length_scatter_group"] = px.scatter(
            strat_df,
            x="simulation_length",
            y="failure_rate",
            color="group_size",
            hover_name="run_id",
            title=f"{strategies_map[strat]} execution latency",
            render_mode="svg",
        )

        graphs[f"{strategies_map[strat]}_work_scatter_strategy"] = px.scatter(
            strat_df,
            x="simulation_length",
            y="work_total",
            color="status",
            hover_name="run_id",
            title=f"{strategies_map[strat]} total work",
            render_mode="svg",
        )
        graphs[f"{strategies_map[strat]}_work_scatter_depth"] = px.scatter(
            strat_df,
            x="simulation_length",
            y="work_total",
            color="depth",
            hover_name="run_id",
            title=f"{strategies_map[strat]} total work",
            render_mode="svg",
        )
        graphs[f"{strategies_map[strat]}_work_scatter_group"] = px.scatter(
            strat_df,
            x="simulation_length",
            y="work_total",
            color="group_size",
            hover_name="run_id",
            title=f"{strategies_map[strat]} total work",
            render_mode="svg",
        )

        graphs[f"{strategies_map[strat]}_completeness"] = px.line(
            dict(
                x=tmp_median["failure_probability"],
                mean=tmp_mean["completeness"],
                median=tmp_median["completeness"],
                lower=tmp_lower["completeness"],
                upper=tmp_upper["completeness"],
            ),
            x="x",
            y=["mean", "median", "lower", "upper"],
            range_y=[0, 100],
            markers=True,
            title=f"{strategies_map[strat]} completeness",
        )

    gmean = data.groupby([tab, "strategy"], as_index=False).mean()
    tmp_std = data.groupby([tab, "strategy"], as_index=False).std()
    gmean["total_work_std"] = tmp_std["work_total"]
    gmean["simulation_length_std"] = tmp_std["simulation_length"]
    gmean["completeness_std"] = tmp_std["completeness"]

    graphs["work_failure_prob_strategy"] = px.line(
        gmean,
        x=tab,
        y="work_total",
        error_y="total_work_std",
        color="strategy",
        markers=True,
        title="Average work per strategy",
    )
    graphs["latency_failure_prob_strategy"] = px.line(
        gmean,
        x=tab,
        y="simulation_length",
        error_y="simulation_length_std",
        color="strategy",
        markers=True,
        title="Average latency per strategy",
    )
    graphs["completeness_failure_prob_strategy"] = px.line(
        gmean,
        x=tab,
        y="completeness",
        error_y="completeness_std",
        color="strategy",
        markers=True,
        title="Average completeness per strategy",
    )

    graphs["full_failure_proba_work"] = px.box(
        data[data["strategy"] == "OPTI"][data["depth"] == depths[-1]],
        x="failure_probability",
        y="work_total",
        color="group_size",
        hover_name="run_id",
        points=box_points,
        title="Work by failure probability for different group sizes, full strategy",
    )
    graphs["full_failure_proba_bandwidth"] = px.box(
        data[data["strategy"] == "OPTI"][data["depth"] == depths[-1]],
        x="failure_probability",
        y="bandwidth_total",
        color="group_size",
        hover_name="run_id",
        points=box_points,
        title="Bandwidth by failure probability for different group sizes, full strategy",
    )

    band_plot_width = 0.5
    data_median = data.groupby(
        ["failure_probability", "strategy"], as_index=False
    ).median()
    y_upper = data.groupby(
        ["failure_probability", "strategy"], as_index=False
    ).quantile(0.5 + band_plot_width / 2)
    y_lower = data.groupby(
        ["failure_probability", "strategy"], as_index=False
    ).quantile(0.5 - band_plot_width / 2)
    for strat in strategies_map:
        graphs[f"{strategies_map[strat]}_work_band"] = go.Figure(
            [
                go.Scatter(
                    x=data_median[data_median["strategy"] == strat][
                        "failure_probability"
                    ],
                    y=data_median[data_median["strategy"] == strat]["work_total"],
                    line=dict(color="rgb(0, 100, 80)"),
                    name=strategies_map[strat],
                    mode="lines",
                ),
                go.Scatter(
                    x=pd.concat(
                        [
                            data_median[data_median["strategy"] == strat][
                                "failure_probability"
                            ],
                            data_median[data_median["strategy"] == strat][
                                "failure_probability"
                            ][::-1],
                        ]
                    ),
                    y=pd.concat(
                        [
                            y_lower[y_lower["strategy"] == strat]["work_total"],
                            y_upper[y_upper["strategy"] == strat]["work_total"][::-1],
                        ]
                    ),
                    fill="toself",
                    fillcolor="rgba(0, 100, 80, 0.2)",
                    line=dict(color="rgba(255,255,255,0)"),
                    hoverinfo="skip",
                    showlegend=False,
                ),
            ]
        )
        graphs[f"{strategies_map[strat]}_latency_band"] = go.Figure(
            [
                go.Scatter(
                    x=data_median[data_median["strategy"] == strat][
                        "failure_probability"
                    ],
                    y=data_median[data_median["strategy"] == strat][
                        "simulation_length"
                    ],
                    line=dict(color="rgb(0, 100, 80)"),
                    name=strategies_map[strat],
                    mode="lines",
                ),
                go.Scatter(
                    x=pd.concat(
                        [
                            data_median[data_median["strategy"] == strat][
                                "failure_probability"
                            ],
                            data_median[data_median["strategy"] == strat][
                                "failure_probability"
                            ][::-1],
                        ]
                    ),
                    y=pd.concat(
                        [
                            y_lower[y_lower["strategy"] == strat]["simulation_length"],
                            y_upper[y_upper["strategy"] == strat]["simulation_length"][
                                ::-1
                            ],
                        ]
                    ),
                    fill="toself",
                    fillcolor="rgba(0, 100, 80, 0.2)",
                    line=dict(color="rgba(255,255,255,0)"),
                    hoverinfo="skip",
                    showlegend=False,
                ),
            ]
        )
        graphs[f"{strategies_map[strat]}_completeness_band"] = go.Figure(
            [
                go.Scatter(
                    x=data_median[data_median["strategy"] == strat][
                        "failure_probability"
                    ],
                    y=data_median[data_median["strategy"] == strat]["completeness"],
                    line=dict(color="rgb(0, 100, 80)"),
                    name=strategies_map[strat],
                    mode="lines",
                ),
                go.Scatter(
                    x=pd.concat(
                        [
                            data_median[data_median["strategy"] == strat][
                                "failure_probability"
                            ],
                            data_median[data_median["strategy"] == strat][
                                "failure_probability"
                            ][::-1],
                        ]
                    ),
                    y=pd.concat(
                        [
                            y_lower[y_lower["strategy"] == strat]["completeness"],
                            y_upper[y_upper["strategy"] == strat]["completeness"][::-1],
                        ]
                    ),
                    fill="toself",
                    fillcolor="rgba(0, 100, 80, 0.2)",
                    line=dict(color="rgba(255,255,255,0)"),
                    hoverinfo="skip",
                    showlegend=False,
                ),
            ]
        )

    graphs["completeness_per_failure_prob"] = px.box(
        data,
        x=tab,
        y="completeness",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Complétude par {'probabilité de panne' if tab == 'failure_probability' else 'taille de groupe'}",
    )

    df = data.copy()
    df["failed_fraction"] = (
        (df["initial_nodes_total"] - df["final_nodes_total"])
        / df["initial_nodes_total"]
        * 100
    )
    graphs["initial_nodes"] = px.box(
        data,
        x="depth",
        y="initial_nodes_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Initial number of nodes",
    )

    graphs["final_nodes"] = px.box(
        df,
        x="depth",
        y="failed_fraction",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Percent failed nodes",
    )

    graphs["initial_contributors"] = px.box(
        data,
        x="depth",
        y="initial_nodes_Contributor",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Initial number of contributors",
    )

    graphs["final_contributors"] = px.box(
        data,
        x="depth",
        y="final_nodes_Contributor",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Final number of contributors",
    )

    default_failure = 0.00007
    default_depth = 6
    default_group = 5

    graphs[f"work_failure_paper"] = px.box(
        data[(data["depth"] == default_depth) & (data["group_size"] == default_group)],
        x="failure_probability",
        y="work_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Work for Failure",
    )
    graphs[f"work_depth_paper"] = px.box(
        data[
            (data["failure_probability"] == default_failure)
            & (data["group_size"] == default_group)
        ],
        x="depth",
        y="work_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Work for depth",
    )
    graphs[f"work_group_paper"] = px.box(
        data[
            (data["failure_probability"] == default_failure)
            & (data["depth"] == default_depth)
        ],
        x="group_size",
        y="work_total",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Work for group",
    )

    graphs[f"latency_failure_paper"] = px.box(
        data[(data["depth"] == default_depth) & (data["group_size"] == default_group)],
        x="failure_probability",
        y="simulation_length",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Work for Failure",
    )
    graphs[f"latency_depth_paper"] = px.box(
        data[
            (data["failure_probability"] == default_failure)
            & (data["group_size"] == default_group)
        ],
        x="depth",
        y="simulation_length",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Work for depth",
    )
    graphs[f"latency_group_paper"] = px.box(
        data[
            (data["failure_probability"] == default_failure)
            & (data["depth"] == default_depth)
        ],
        x="group_size",
        y="simulation_length",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Work for group",
    )

    graphs[f"completeness_failure_paper"] = px.box(
        data[(data["depth"] == default_depth) & (data["group_size"] == default_group)],
        x="failure_probability",
        y="completeness",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Work for Failure",
    )
    graphs[f"completeness_depth_paper"] = px.box(
        data[
            (data["failure_probability"] == default_failure)
            & (data["group_size"] == default_group)
        ],
        x="depth",
        y="completeness",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Work for depth",
    )
    graphs[f"completeness_group_paper"] = px.box(
        data[
            (data["failure_probability"] == default_failure)
            & (data["depth"] == default_depth)
        ],
        x="group_size",
        y="completeness",
        color="strategy",
        hover_name="run_id",
        points=box_points,
        title=f"Work for group",
    )

    return html.Div(
        children=[
            html.H1("Failure rate and failure probability:"),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id="failure_rate_per_latency",
                        figure=graphs["failure_rate_per_latency"],
                    ),
                    dcc.Graph(
                        id="failure_rate_per_failure_proba_protocol",
                        figure=graphs["failure_rate_per_failure_proba_protocol"],
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
                        id="work_failure_rate_strategy_violin",
                        figure=graphs["work_failure_rate_strategy_violin"],
                    ),
                    dcc.Graph(
                        id="work_failure_rate_strategy",
                        figure=graphs["work_failure_rate_strategy"],
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
                        id="latency_failure_rate_strategy_violin",
                        figure=graphs["latency_failure_rate_strategy_violin"],
                    ),
                    dcc.Graph(
                        id="latency_failure_rate_strategy",
                        figure=graphs["latency_failure_rate_strategy"],
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
                        id="messages_strategy_violin",
                        figure=graphs["messages_strategy_violin"],
                    ),
                    dcc.Graph(
                        id="messages_strategy",
                        figure=graphs["messages_strategy"],
                    ),
                ],
            ),
            #
            # Scatters
            #
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(id=id, figure=graphs[id])
                    for id in [
                        f"{strategies_map[strat]}_length_scatter_strategy"
                        for strat in strategies_map.keys()
                    ]
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(id=id, figure=graphs[id])
                    for id in [
                        f"{strategies_map[strat]}_length_scatter_depth"
                        for strat in strategies_map.keys()
                    ]
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(id=id, figure=graphs[id])
                    for id in [
                        f"{strategies_map[strat]}_length_scatter_group"
                        for strat in strategies_map.keys()
                    ]
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(id=id, figure=graphs[id])
                    for id in [
                        f"{strategies_map[strat]}_work_scatter_strategy"
                        for strat in strategies_map.keys()
                    ]
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(id=id, figure=graphs[id])
                    for id in [
                        f"{strategies_map[strat]}_work_scatter_depth"
                        for strat in strategies_map.keys()
                    ]
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(id=id, figure=graphs[id])
                    for id in [
                        f"{strategies_map[strat]}_work_scatter_group"
                        for strat in strategies_map.keys()
                    ]
                ],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(id=id, figure=graphs[id])
                    for id in [
                        f"{strategies_map[strat]}_completeness"
                        for strat in strategies_map.keys()
                    ]
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
                        id=id,
                        figure=graphs[id],
                    )
                    for id in [
                        "completeness_failure_prob_strategy",
                        "work_failure_prob_strategy",
                        "latency_failure_prob_strategy",
                    ]
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
                        id="full_failure_proba_work",
                        figure=graphs["full_failure_proba_work"],
                    ),
                    dcc.Graph(
                        id="full_failure_proba_bandwidth",
                        figure=graphs["full_failure_proba_bandwidth"],
                    ),
                ],
            ),
            html.Div(
                children=[
                    html.Div(
                        style={
                            "display": "flex",
                            "flex-direction": "row",
                            "justify-content": "center",
                        },
                        children=[
                            dcc.Graph(
                                id=f"{strategies_map[strat]}{id}",
                                figure=graphs[f"{strategies_map[strat]}{id}"],
                            )
                            for id in [
                                "_work_band",
                                "_latency_band",
                                "_completeness_band",
                            ]
                        ],
                    )
                    for strat in strategies_map
                ]
            ),
            dcc.Graph(
                id="completeness_per_failure_prob",
                figure=graphs["completeness_per_failure_prob"],
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"initial_contributors",
                        figure=graphs["initial_contributors"],
                    ),
                    dcc.Graph(
                        id=f"final_contributors",
                        figure=graphs["final_contributors"],
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
                        id=f"initial_nodes",
                        figure=graphs["initial_nodes"],
                    ),
                    dcc.Graph(
                        id=f"final_nodes",
                        figure=graphs["final_nodes"],
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
        ]
    )


if __name__ == "__main__":
    with open("./dissec.config.json") as f:
        config = json.load(f)

    data = get_data(config["defaultGraph"])

    run_ids = pd.unique(data["run_id"])
    strategies = pd.unique(data["strategy"])
    status = pd.unique(data["status"])
    data["failure_probability"] = data["failure_probability"].round(6)
    failure_probabilities = np.sort(pd.unique(data["failure_probability"]))
    failure_rates = np.sort(pd.unique(data["failure_rate"]))

    outputs = glob("./outputs/*")

    # Remove strategies not present in the data
    strategies_map = dict(
        EAGER="Eager", OPTI="Optimistic", PESS="Pessimistic", STRAW="Strawman"
    )
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
                        0.001,
                        0.00001,
                        value=[0, 0.001],
                        id="failure-probabilities-range",
                    ),
                    html.H3("Group Sizes"),
                    dcc.RangeSlider(
                        3,
                        7,
                        2,
                        value=[3, 7],
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
            dash.Input(component_id="tabs", component_property="value"),
        ],
        dash.State("store_file", "data"),
    )
    def update_graphs(
        selected_failures,
        selected_sizes,
        selected_depths,
        tab,
        store_file,
    ):
        if not store_file:
            df = get_data(config["defaultGraph"])
        else:
            df = pd.read_json(store_file)

        strategies = pd.unique(df["strategy"])
        status = pd.unique(df["status"])
        df["failure_probability"] = df["failure_probability"].round(6)

        # Remove strategies not present in the data
        strategies_map = dict(
            EAGER="Eager", OPTI="Optimistic", PESS="Pessimistic", STRAW="Strawman"
        )
        for k in set(strategies_map.keys()).difference(strategies):
            del strategies_map[k]

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
