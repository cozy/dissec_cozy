import plotly_express as px
from dash import html, dcc, dash
import numpy as np
import pandas as pd
import json
from glob import glob

tabs = [
    dict(label="Probabilité de panne", value="failure_probability"),
    dict(label="Profondeur", value="depth"),
    dict(label="Taille de groupe", value="group_size"),
    dict(label="Fanout", value="fanout"),
    dict(label="Taux de panne", value="failure_rate"),
]


def get_data(path):
    if ".json" in path:
        with open(path) as f:
            data = json.load(f)

        df = pd.concat([pd.DataFrame(i) for i in data])
    else:
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
        },
        axis=1,
        inplace=True,
    )
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


def generate_maps(df, x_axis, y_axis, strategies_map, display_failures=False):
    copy_df = df.copy()
    work_min = copy_df["total_work"].max()
    work_max = copy_df["total_work"].min()
    latency_min = copy_df["simulation_length"].max()
    latency_max = df["simulation_length"].min()

    # Failure rate buckets
    buckets = [0, 0.1, 0.2, 0.4, 0.6, 1]
    for i in range(len(buckets) - 1):
        copy_df.loc[
            (copy_df["failure_rate"] >= buckets[i])
            & (copy_df["failure_rate"] <= buckets[i + 1]),
            "failure_rate",
        ] = round(
            copy_df[
                (copy_df["failure_rate"] >= buckets[i])
                & (copy_df["failure_rate"] <= buckets[i + 1])
            ]["failure_rate"].mean(),
            3,
        )

    print(pd.unique(copy_df[x_axis]), pd.unique(copy_df[y_axis]))

    # Map of protocol successes
    maps = dict()
    for strat in strategies_map:
        strat_df = copy_df[copy_df["strategy"] == strat]
        data_runs = []
        data_failure = []
        data_success = []
        data_completeness = []
        data_work = []
        data_latency = []
        for (j, y) in enumerate(pd.unique(copy_df[y_axis])):
            data_runs.append([])
            data_failure.append([])
            data_success.append([])
            data_completeness.append([])
            data_work.append([])
            data_latency.append([])
            for x in pd.unique(copy_df[x_axis]):
                tile = strat_df[(strat_df[y_axis] == y) & (strat_df[x_axis] == x)]
                success_tile = tile[tile["status"] == "Success"]

                data_runs[j].append(
                    len(success_tile) if display_failures else len(tile)
                )
                data_failure[j].append(
                    success_tile["failure_rate"].mean()
                    if display_failures
                    else tile["failure_rate"].mean()
                )
                data_success[j].append(
                    len(tile[tile["status"] == "Success"]) / len(tile)
                    if len(tile) != 0
                    else 0
                )
                data_completeness[j].append(
                    success_tile["completeness"].mean() / 100
                    if display_failures
                    else tile["completeness"].mean() / 100
                )
                data_work[j].append(
                    success_tile["total_work"].mean()
                    if display_failures
                    else tile["total_work"].mean()
                )
                data_latency[j].append(
                    success_tile["simulation_length"].mean()
                    if display_failures
                    else tile["simulation_length"].mean()
                )

                if display_failures:
                    if success_tile["total_work"].mean() < work_min:
                        work_min = success_tile["total_work"].mean()
                    if success_tile["total_work"].mean() > work_max:
                        work_max = success_tile["total_work"].mean()
                    if success_tile["simulation_length"].mean() < latency_min:
                        latency_min = success_tile["simulation_length"].mean()
                    if success_tile["simulation_length"].mean() > latency_max:
                        latency_max = success_tile["simulation_length"].mean()
                else:
                    if tile["total_work"].mean() < work_min:
                        work_min = tile["total_work"].mean()
                    if tile["total_work"].mean() > work_max:
                        work_max = tile["total_work"].mean()
                    if tile["simulation_length"].mean() < latency_min:
                        latency_min = tile["simulation_length"].mean()
                    if tile["simulation_length"].mean() > latency_max:
                        latency_max = tile["simulation_length"].mean()

        print(
            np.array(data_runs).shape,
            pd.unique(copy_df[x_axis]),
            pd.unique(copy_df[y_axis]),
            data_runs,
        )
        maps[f"{strat}_map_runs"] = pd.DataFrame(
            data_runs,
            columns=[f"{x_axis} {x}" for x in pd.unique(copy_df[x_axis])],
            index=[f"{y_axis} {y}" for y in pd.unique(copy_df[y_axis])],
        )
        maps[f"{strat}_map_failure"] = pd.DataFrame(
            data_failure,
            columns=[f"{x_axis} {x}" for x in pd.unique(copy_df[x_axis])],
            index=[f"{y_axis} {y}" for y in pd.unique(copy_df[y_axis])],
        )
        maps[f"{strat}_map_successes"] = pd.DataFrame(
            data_success,
            columns=[f"{x_axis} {x}" for x in pd.unique(copy_df[x_axis])],
            index=[f"{y_axis} {y}" for y in pd.unique(copy_df[y_axis])],
        )
        maps[f"{strat}_map_completeness"] = pd.DataFrame(
            data_completeness,
            columns=[f"{x_axis} {x}" for x in pd.unique(copy_df[x_axis])],
            index=[f"{y_axis} {y}" for y in pd.unique(copy_df[y_axis])],
        )
        maps[f"{strat}_map_work"] = pd.DataFrame(
            data_work,
            columns=[f"{x_axis} {x}" for x in pd.unique(copy_df[x_axis])],
            index=[f"{y_axis} {y}" for y in pd.unique(copy_df[y_axis])],
        )
        maps[f"{strat}_map_latency"] = pd.DataFrame(
            data_latency,
            columns=[f"{x_axis} {x}" for x in pd.unique(copy_df[x_axis])],
            index=[f"{y_axis} {y}" for y in pd.unique(copy_df[y_axis])],
        )

    for strat in strategies_map:
        maps[f"{strat}_map_runs"] = px.imshow(
            maps[f"{strat}_map_runs"],
            text_auto=True,
            title=f"{strategies_map[strat]} number of runs",
            zmin=0,
            zmax=len(tile),
        )
        maps[f"{strat}_map_failure"] = px.imshow(
            maps[f"{strat}_map_failure"],
            text_auto=True,
            title=f"{strategies_map[strat]} Failure rate",
            zmin=0,
            zmax=1,
        )
        maps[f"{strat}_map_successes"] = px.imshow(
            maps[f"{strat}_map_successes"],
            text_auto=True,
            title=f"{strategies_map[strat]} Success rate",
            zmin=0,
            zmax=1,
        )
        maps[f"{strat}_map_completeness"] = px.imshow(
            maps[f"{strat}_map_completeness"],
            text_auto=True,
            title=f"{strategies_map[strat]} Completeness",
            zmin=0,
            zmax=1,
        )
        maps[f"{strat}_map_work"] = px.imshow(
            maps[f"{strat}_map_work"],
            text_auto=True,
            title=f"{strategies_map[strat]} Total Work",
            zmin=work_min,
            zmax=work_max,
        )
        maps[f"{strat}_map_latency"] = px.imshow(
            maps[f"{strat}_map_latency"],
            text_auto=True,
            title=f"{strategies_map[strat]} Latency",
            zmin=latency_min,
            zmax=latency_max,
        )

    return html.Div(
        children=[
            html.H1("Number of runs"),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"{strat}_map_runs",
                        figure=maps[f"{strat}_map_runs"],
                    )
                    for strat in strategies_map
                ],
            ),
            html.H1("Protocol successes"),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"{strat}_map_successes",
                        figure=maps[f"{strat}_map_successes"],
                    )
                    for strat in strategies_map
                ],
            ),
            html.H1("Nodes failure rates"),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"{strat}_map_failure",
                        figure=maps[f"{strat}_map_failure"],
                    )
                    for strat in strategies_map
                ],
            ),
            html.H1("Protocol completeness"),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"{strat}_map_completeness",
                        figure=maps[f"{strat}_map_completeness"],
                    )
                    for strat in strategies_map
                ],
            ),
            html.H1("Total work"),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"{strat}_map_work",
                        figure=maps[f"{strat}_map_work"],
                    )
                    for strat in strategies_map
                ],
            ),
            html.H1("Latency"),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id=f"{strat}_map_latency",
                        figure=maps[f"{strat}_map_latency"],
                    )
                    for strat in strategies_map
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
    strategies_map = dict(EAGER="Eager", OPTI="Optimistic", PESS="Pessimistic")
    for k in set(strategies_map.keys()).difference(strategies):
        del strategies_map[k]

    summary = generate_summary(data, status, strategies)

    default_x = tabs[0]["value"]
    default_y = tabs[1]["value"]
    maps = generate_maps(data, tabs[0]["value"], tabs[1]["value"], strategies_map)

    app = dash.Dash(__name__)

    app.layout = html.Div(
        children=[
            dcc.Store(id="store_file"),
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
                        5,
                        1,
                        value=[3, 5],
                        id="depths-range",
                    ),
                ]
            ),
            html.Div(
                children=[
                    html.Div(
                        style={
                            "display": "flex",
                            "flex-direction": "row",
                            "justify-content": "start",
                        },
                        children=[
                            html.H3("X Axis:"),
                            dcc.Dropdown(
                                style={"width": "100%"},
                                id="x_axis_dropdown",
                                options=[tab["value"] for tab in tabs],
                                value=default_x,
                            ),
                        ],
                    ),
                    html.Div(
                        style={
                            "display": "flex",
                            "flex-direction": "row",
                            "justify-content": "start",
                        },
                        children=[
                            html.H3("Y Axis:"),
                            dcc.Dropdown(
                                style={"width": "100%"},
                                id="y_axis_dropdown",
                                options=[tab["value"] for tab in tabs],
                                value=default_y,
                            ),
                        ],
                    ),
                ]
            ),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "start",
                },
                children=[
                    html.H3("Only display successful runs"),
                    dcc.Checklist(
                        style={
                            "display": "flex",
                            "align-items": "center",
                        },
                        id="display_failures",
                        options=["YES"],
                        value=[],
                    ),
                ],
            ),
            html.Div(id="maps", children=[maps]),
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
            dash.Output(component_id="maps", component_property="children"),
        ],
        [
            dash.Input(
                component_id="failure-probabilities-range", component_property="value"
            ),
            dash.Input(component_id="group-sizes-range", component_property="value"),
            dash.Input(component_id="depths-range", component_property="value"),
            dash.Input(component_id="x_axis_dropdown", component_property="value"),
            dash.Input(component_id="y_axis_dropdown", component_property="value"),
            dash.Input(component_id="display_failures", component_property="value"),
        ],
        dash.State("store_file", "data"),
    )
    def update_graphs(
        selected_failures,
        selected_sizes,
        selected_depths,
        x_axis,
        y_axis,
        display_failures,
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
        strategies_map = dict(EAGER="Eager", OPTI="Optimistic", PESS="Pessimistic")
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

        maps = generate_maps(
            df, x_axis, y_axis, strategies_map, "YES" in display_failures
        )

        return [generate_summary(df, status, strategies), maps]

    app.run_server(debug=True)
