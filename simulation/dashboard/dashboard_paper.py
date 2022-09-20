import plotly_express as px
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
        points=False,
        title=f"Failure rate by protocol latency",
    )

    # Boxes
    graphs["work_failure_rate_status"] = px.box(
        data,
        x=tab,
        y="work_total",
        color="status",
        hover_name="run_id",
        points=False,
        title="Travail selon la taille de groupe par status",
    )
    graphs["work_failure_rate_strategy"] = px.box(
        data,
        x=tab,
        y="work_total",
        color="strategy",
        hover_name="run_id",
        points=False,
        title=f"Travail selon {'la probabilité de panne' if tab == 'failure_probability' else 'la taille de groupe'} par stratégie",
    )
    graphs["messages_strategy"] = px.box(
        data,
        x=tab,
        y="messages_total",
        color="strategy",
        hover_name="run_id",
        points=False,
        title=f"Messages selon {'la probabilité de panne' if tab == 'failure_probability' else 'la taille de groupe'} par stratégie",
    )
    graphs["latency_failure_rate_status"] = px.box(
        data,
        x=tab,
        y="simulation_length",
        color="status",
        hover_name="run_id",
        points=False,
        title=f"Latence selon {'la probabilité de panne' if tab == 'failure_probability' else 'la taille de groupe'} par status",
    )
    graphs["latency_failure_rate_strategy"] = px.box(
        data,
        x=tab,
        y="simulation_length",
        color="strategy",
        hover_name="run_id",
        points=False,
        title=f"Latence selon {'la probabilité de panne' if tab == 'failure_probability' else 'la taille de groupe'} par stratégie",
    )
    graphs["observed_failure_rate_per_failure_prob"] = px.box(
        data,
        x=tab,
        y="failure_rate",
        color="strategy",
        hover_name="run_id",
        points=False,
        title=f"Taux de panne pour chaque {'probabilité de panne' if tab == 'failure_probability' else 'taille de groupe'}",
    )
    graphs["observed_failure_rate_per_status"] = px.box(
        data,
        x="status",
        y="failure_rate",
        color="strategy",
        hover_name="run_id",
        points=False,
        title="Taux de panne pour chaque statut d'exécution",
    )

    amps = data.copy()

    for strat in strategies_map:
        amps_strat = amps[amps["strategy"] == strat]
        amps.loc[amps["strategy"] == strat, "work_total"] /= amps_strat.groupby(
            [tab, "strategy"], as_index=False
        ).mean()["work_total"][0]
        amps.loc[amps["strategy"] == strat, "simulation_length"] /= amps_strat.groupby(
            [tab, "simulation_length"], as_index=False
        ).mean()["simulation_length"][0]

    grouped_mean = data.groupby([tab, "strategy"], as_index=False).mean()
    grouped_upper = data.groupby([tab, "strategy"], as_index=False).max()
    grouped_upper["work_total"] /= grouped_mean["work_total"].iloc[0]
    grouped_upper["simulation_length"] /= grouped_mean["simulation_length"].iloc[0]
    grouped_lower = data.groupby([tab, "strategy"], as_index=False).min()
    grouped_lower["work_total"] /= grouped_mean["work_total"].iloc[0]
    grouped_lower["simulation_length"] /= grouped_mean["simulation_length"].iloc[0]
    grouped_mean["work_total"] /= grouped_mean["work_total"].iloc[0]
    grouped_mean["simulation_length"] /= grouped_mean["simulation_length"].iloc[0]

    if tab == "failure_probability":
        x_axis = failure_probabilities
    elif tab == "group_size":
        x_axis = group_sizes
    elif tab == "fanout":
        x_axis = fanouts
    else:
        x_axis = depths

    for strat in strategies_map:
        graphs[f"{strategies_map[strat]}_length_scatter"] = px.scatter(
            data[data["strategy"] == strat],
            x="simulation_length",
            y="failure_rate",
            color="status",
            hover_name="run_id",
            title=f"{strategies_map[strat]} execution latency",
            render_mode="svg",
        )
        graphs[f"{strategies_map[strat]}_work_scatter"] = px.scatter(
            data[data["strategy"] == strat],
            x="simulation_length",
            y="work_total",
            color="status",
            hover_name="run_id",
            title=f"{strategies_map[strat]} total work",
            render_mode="svg",
        )

        graphs[f"{strategies_map[strat]}_latency_amplification_scatter"] = px.scatter(
            amps[amps["strategy"] == strat],
            x=tab,
            y="simulation_length",
            color="status",
            marginal_x="histogram",
            marginal_y="histogram",
            trendline="lowess",
            title=f"{strategies_map[strat]} latency amplification",
            render_mode="svg",
        )
        graphs[f"{strategies_map[strat]}_work_amplification_scatter"] = px.scatter(
            amps[amps["strategy"] == strat],
            x=tab,
            y="work_total",
            color="status",
            marginal_x="histogram",
            marginal_y="histogram",
            trendline="lowess",
            title=f"{strategies_map[strat]} work amplification",
            render_mode="svg",
        )
        graphs[f"{strategies_map[strat]}_completeness_scatter"] = px.scatter(
            amps[amps["strategy"] == strat],
            x=tab,
            y="completeness",
            color="status",
            marginal_x="histogram",
            marginal_y="histogram",
            trendline="lowess",
            title=f"{strategies_map[strat]} completeness",
            render_mode="svg",
        )

        not_empty = len(grouped_mean[grouped_mean["strategy"] == strat]) > 0
        fallback = [0 for _ in failure_probabilities]
        d1 = {}
        d1[tab] = x_axis
        d1["mean"] = (
            grouped_mean[grouped_mean["strategy"] == strat]["simulation_length"]
            if not_empty
            else fallback
        )
        d1["upper"] = (
            grouped_upper[grouped_upper["strategy"] == strat]["simulation_length"]
            if not_empty
            else fallback
        )
        d1["lower"] = (
            grouped_lower[grouped_lower["strategy"] == strat]["simulation_length"]
            if not_empty
            else fallback
        )
        graphs[f"{strategies_map[strat]}_latency_amplification"] = px.line(
            d1,
            x=tab,
            y=["mean", "lower", "upper"],
            markers=True,
            title=f"{strategies_map[strat]} latency amplification",
        )
        d2 = {}
        d2[tab] = x_axis
        d2["mean"] = (
            grouped_mean[grouped_mean["strategy"] == strat]["work_total"]
            if not_empty
            else fallback
        )
        d2["upper"] = (
            grouped_upper[grouped_upper["strategy"] == strat]["work_total"]
            if not_empty
            else fallback
        )
        d2["lower"] = (
            grouped_lower[grouped_lower["strategy"] == strat]["work_total"]
            if not_empty
            else fallback
        )
        graphs[f"{strategies_map[strat]}_work_amplification"] = px.line(
            d2,
            x=tab,
            y=["mean", "lower", "upper"],
            markers=True,
            title=f"{strategies_map[strat]} work amplification",
        )
        d3 = {}
        d3[tab] = x_axis
        d3["mean"] = (
            grouped_mean[grouped_mean["strategy"] == strat]["completeness"]
            if not_empty
            else fallback
        )
        d3["upper"] = (
            grouped_upper[grouped_upper["strategy"] == strat]["completeness"]
            if not_empty
            else fallback
        )
        d3["lower"] = (
            grouped_lower[grouped_lower["strategy"] == strat]["completeness"]
            if not_empty
            else fallback
        )
        graphs[f"{strategies_map[strat]}_completeness"] = px.line(
            d3,
            x=tab,
            y=["mean", "lower", "upper"],
            markers=True,
            title=f"{strategies_map[strat]} completeness",
        )

    graphs[f"latency_amplification_scatter"] = px.scatter(
        amps,
        x=tab,
        y="simulation_length",
        color="strategy",
        marginal_y="histogram",
        title=f"Latency amplification",
        hover_name="run_id",
    )
    graphs[f"work_amplification_scatter"] = px.scatter(
        amps,
        x=tab,
        y="total_work",
        color="strategy",
        marginal_y="histogram",
        title=f"Work amplification",
        hover_name="run_id",
    )
    graphs[f"completeness_scatter"] = px.scatter(
        amps,
        x=tab,
        y="completeness",
        color="strategy",
        marginal_y="histogram",
        title=f"Completeness",
        hover_name="run_id",
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

    graphs["completeness_per_failure_prob"] = px.box(
        data,
        x=tab,
        y="completeness",
        color="strategy",
        hover_name="run_id",
        points=False,
        title=f"Complétude par {'probabilité de panne' if tab == 'failure_probability' else 'taille de groupe'}",
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
            html.H1("Boxes:"),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id="work_failure_rate_status",
                        figure=graphs["work_failure_rate_status"],
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
                        id="latency_failure_rate_status",
                        figure=graphs["latency_failure_rate_status"],
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
                        id="messages_strategy",
                        figure=graphs["messages_strategy"],
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
                        id="observed_failure_rate_per_failure_prob",
                        figure=graphs["observed_failure_rate_per_failure_prob"],
                    ),
                    dcc.Graph(
                        id="observed_failure_rate_per_status",
                        figure=graphs["observed_failure_rate_per_status"],
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
                        f"{strategies_map[strat]}_length_scatter"
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
                        f"{strategies_map[strat]}_work_scatter"
                        for strat in strategies_map.keys()
                    ]
                ],
            ),
            #
            # Amplifications
            #
            html.H1("Amplifications:"),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(id=id, figure=graphs[id])
                    for id in [
                        f"{strategies_map[strat]}_work_amplification"
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
                        f"{strategies_map[strat]}_latency_amplification"
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
                    dcc.Graph(id=id, figure=graphs[id])
                    for id in [
                        f"{strategies_map[strat]}_latency_amplification_scatter"
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
                        f"{strategies_map[strat]}_work_amplification_scatter"
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
                        f"{strategies_map[strat]}_completeness_scatter"
                        for strat in strategies_map.keys()
                    ]
                ],
            ),
            html.H1("Combined plots"),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(id=id, figure=graphs[id])
                    for id in [
                        "completeness_scatter",
                        "latency_amplification_scatter",
                        "work_amplification_scatter",
                    ]
                ],
            ),
            #
            # Rest
            #
            html.H1("Other graphs"),
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
            dcc.Graph(
                id="completeness_per_failure_prob",
                figure=graphs["completeness_per_failure_prob"],
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
            #
            # Boxes
            #
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
                        5,
                        1,
                        value=[3, 5],
                        id="depths-range",
                    ),
                    html.H3("Activate graphs"),
                    dcc.Checklist(
                        id="activate_graphs", options=["Activate graphs"], value=[]
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
            dash.Input(component_id="activate_graphs", component_property="value"),
        ],
        dash.State("store_file", "data"),
    )
    def update_graphs(
        selected_failures,
        selected_sizes,
        selected_depths,
        tab,
        activate_graphs,
        store_file,
    ):
        print(
            "Update Arguments: ",
            selected_failures,
            selected_sizes,
            selected_depths,
            tab,
            activate_graphs,
        )
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

        graphs = (
            generate_graphs(df, strategies_map, tab)
            if "Activate graphs" in activate_graphs
            else html.Div()
        )

        return [generate_summary(df, status, strategies), graphs]

    app.run_server(debug=True)
