import plotly_express as px
from dash import html, dcc, dash
import numpy as np
import pandas as pd
import json

roles = ["Aggregator", "LeafAggregator", "Contributor", "Backup", "Querier"]
statistics = [
    "initial_nodes",
    "final_nodes",
    "failures",
    "work",
    "messages",
    "work_per_node",
    "delta_nodes",
    "inbound_bandwidth",
    "outbound_bandwidth",
]


def get_data(path):
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
            "failureRate": "failure_probability",
            "observedFailureRate": "failure_rate",
            "emissionTime": "emitter_time",
            "receptionTime": "receiver_time",
            "emitterId": "emitter_id",
            "receiverId": "receiver_id",
            "latency": "simulation_length",
            "work": "total_work",
            "groupSize": "group_size",
            "circulatingAggregateIds": "circulating_ids",
            "currentlyCirculatingVersions": "currently_circulating_ids",
            "inboundBandwidth": "inbound_bandwidth",
            "outboundBandwidth": "outbound_bandwidth",
            "finalInboundBandwidth": "final_inbound_bandwidth",
            "finalOutboundBandwidth": "final_outbound_bandwidth",
        },
        axis=1,
        inplace=True,
    )
    df.reset_index(inplace=True)
    df.fillna(0, inplace=True)

    df["latency"] = (df["receiver_time"] - df["emitter_time"]).apply(
        lambda x: max(0, x)
    )

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

    return df


if __name__ == "__main__":
    with open("./dissec.config.json") as f:
        config = json.load(f)

    data = get_data(config["defaultGraph"])

    run_ids = pd.unique(data["run_id"])
    strategies = pd.unique(data["strategy"])
    status = pd.unique(data["status"])
    types = pd.unique(data["type"])
    simulation_lengths = pd.unique(data["simulation_length"])
    data["failure_probability"] = data["failure_probability"].round(6)
    failure_probabilities = np.sort(pd.unique(data["failure_probability"]))
    failure_rates = np.sort(pd.unique(data["failure_rate"]))

    # Remove strategies not present in the data
    strategies_map = dict(
        EAGER="Eager", OPTI="Optimistic", PESS="Pessimistic", STRAW="Strawman"
    )
    for k in set(strategies_map.keys()).difference(strategies):
        del strategies_map[k]

    grouped = data.groupby(["run_id", "status", "strategy"], as_index=False)[
        [
            "simulation_length",
            "total_work",
            "failure_probability",
            "failure_rate",
            "completeness",
        ]
    ].max()
    grouped["failure_probability"] = grouped["failure_probability"].round(5)

    app = dash.Dash(__name__)

    # Timeline
    message_timeline_fig = px.scatter(
        pd.DataFrame(columns=data.columns),
        x="receiver_time",
        y="receiver_id",
        color="type",
        hover_name="type",
        hover_data=[
            "receiver_time",
            "emitter_time",
            "receiver_id",
            "emitter_id",
            "run_id",
            "status",
        ],
    )
    version_timeline_fig = px.scatter(
        pd.DataFrame(columns=data.columns),
        x="receiver_time",
        y="currently_circulating_ids",
        color="run_id",
        hover_name="type",
        hover_data=["receiver_id", "emitter_id", "run_id"],
    )
    bandwidth_timeline_fig = px.scatter(
        pd.DataFrame(columns=data.columns),
        x="receiver_time",
        y="outbound_bandwidth",
        color="run_id",
        hover_name="type",
        hover_data=["receiver_id", "emitter_id", "run_id"],
    )
    work_timeline_fig = px.scatter(
        pd.DataFrame(columns=data.columns),
        x="receiver_time",
        y="work_total",
        color="run_id",
        hover_name="type",
        hover_data=["receiver_id", "emitter_id", "run_id"],
    )
    messages_timeline_fig = px.scatter(
        pd.DataFrame(columns=data.columns),
        x="receiver_time",
        y="messages_total",
        color="run_id",
        hover_name="type",
        hover_data=["receiver_id", "emitter_id", "run_id"],
    )
    completeness_fig = px.scatter(
        pd.DataFrame(columns=data.columns),
        x="receiver_time",
        y="completeness",
        color="run_id",
        hover_name="type",
        hover_data=["receiver_id", "emitter_id", "run_id"],
    )
    message_stats_fig = px.box(
        pd.DataFrame(columns=data.columns),
        x="type",
        y="latency",
        hover_name="type",
        hover_data=["emitter_id"],
        points="all",
    )

    app.layout = html.Div(
        children=[
            html.H1(
                children=f"Latency vs Reception time",
                style={"textAlign": "center", "color": "#7FDBFF"},
            ),
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
                                                    f"{len(grouped[grouped['strategy'] == i])} runs using {i} strategy, {len(grouped[grouped['status'] == 'Success'][grouped['strategy'] == i])} success"
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
            #
            # Timeline
            #
            html.H1("Timeline:"),
            html.Div(
                style={"justifyContent": "center"},
                children=[
                    html.H3("Y = ?"),
                    dcc.Dropdown(
                        [
                            {"label": "Receiver", "value": "receiver"},
                            {"label": "Emitter", "value": "emitter"},
                        ],
                        "receiver",
                        id="y-axis",
                    ),
                ],
            ),
            html.Div(
                style={"justifyContent": "center"},
                children=[
                    html.H3("Protocol executions:"),
                    dcc.Checklist(
                        id="runs-list",
                        options=["All"] + [i for i in run_ids],
                        value=[],
                        style={
                            "display": "flex",
                            "flex-wrap": "wrap",
                            "flex-direction": "row",
                        },
                        labelStyle={
                            "display": "flex",
                            "direction": "row",
                            "margin": "5px",
                        },
                    ),
                ],
            ),
            html.Div(
                style={"justifyContent": "center"},
                children=[
                    html.H3("Message types:"),
                    dcc.Checklist(
                        id="types-list",
                        options=types,
                        value=types,
                        style={
                            "display": "flex",
                            "flexWrap": "wrap",
                            "flexDirection": "row",
                        },
                        labelStyle={
                            "display": "flex",
                            "direction": "row",
                            "margin": "5px",
                        },
                    ),
                ],
            ),
            html.Div(
                [
                    html.H3("Simulation time"),
                    dcc.Slider(
                        0,
                        np.max(simulation_lengths),
                        marks={
                            0: 'Start',
                            0.17: 'Received query',
                            0.60: 'Start sending contributions',
                            1.41: 'Received contributions',
                            1.92: 'Sync',
                            2.22: 'First level received',
                            2.53: 'Second level received',
                            2.93: 'Root received',
                            3.17: 'Querier received',
                        },
                        value=0,
                        id="time-slider",
                    ),
                ]
            ),
            dcc.Graph(id="message_timeline", figure=message_timeline_fig),
            dcc.Graph(id="version_timeline", figure=version_timeline_fig),
            dcc.Graph(id="bandwidth_timeline", figure=version_timeline_fig),
            dcc.Graph(id="work_timeline", figure=work_timeline_fig),
            dcc.Graph(id="completeness_timeline", figure=completeness_fig),
            dcc.Graph(id="messages_timeline", figure=messages_timeline_fig),
            dcc.Graph(id="message_stats", figure=message_stats_fig),
        ]
    )

    @app.callback(
        [
            dash.Output(component_id="message_timeline", component_property="figure"),
            dash.Output(component_id="version_timeline", component_property="figure"),
            dash.Output(component_id="bandwidth_timeline", component_property="figure"),
            dash.Output(component_id="work_timeline", component_property="figure"),
            dash.Output(
                component_id="completeness_timeline", component_property="figure"
            ),
            dash.Output(component_id="messages_timeline", component_property="figure"),
            dash.Output(component_id="message_stats", component_property="figure"),
        ],
        [
            dash.Input(component_id="y-axis", component_property="value"),
            dash.Input(component_id="runs-list", component_property="value"),
            dash.Input(component_id="types-list", component_property="value"),
            dash.Input(
                component_id="time-slider", component_property="value"
            ),
        ],
    )
    def update_timeline(
        selected_y_axis,
        selected_run_ids,
        selected_types,
        current_time,
    ):
        df = data.copy()
        
        if "All" not in selected_run_ids:
            df = df[df["run_id"].isin(selected_run_ids)]
        df = df[df["type"].isin(selected_types)]

        error_x = None
        error_x_minus = None

        print(current_time, len(df[df[selected_y_axis + "_time"] <= current_time]), len(df[df[selected_y_axis + "_time"] > current_time]))
        # Timeline
        new_message_timeline = px.scatter(
            df[df[selected_y_axis + "_time"] <= current_time],
            x=selected_y_axis + "_time",
            error_x=error_x,
            error_x_minus=error_x_minus,
            y=selected_y_axis + "_id",
            color="type",
            hover_name="type",
            hover_data=[
                "receiver_time",
                "emitter_time",
                "receiver_id",
                "emitter_id",
                "run_id",
                "status",
            ],
        )
        version_timeline_fig = px.scatter(
            df,
            x="receiver_time",
            y="currently_circulating_ids",
            color="run_id",
            hover_name="type",
            hover_data=["receiver_id", "emitter_id", "run_id"],
        )
        bandwidth_timeline_fig = px.scatter(
            df,
            x="receiver_time",
            y="outbound_bandwidth",
            color="run_id",
            hover_name="type",
            hover_data=["receiver_id", "emitter_id", "run_id"],
        )
        work_timeline_fig = px.scatter(
            df,
            x="receiver_time",
            y="work_total",
            color="run_id",
            hover_name="type",
            hover_data=["receiver_id", "emitter_id", "run_id"],
        )
        completeness_fig = px.scatter(
            df,
            x="receiver_time",
            y="completeness",
            color="run_id",
            hover_name="type",
            hover_data=["receiver_id", "emitter_id", "run_id"],
        )
        messages_timeline_fig = px.scatter(
            df,
            x="receiver_time",
            y="messages_total",
            color="run_id",
            hover_name="type",
            hover_data=["receiver_id", "emitter_id", "run_id"],
        )
        new_message_stats_fig = px.box(
            df,
            x="type",
            y="latency",
            hover_name="type",
            hover_data=["emitter_id"],
            points="all",
        )

        return [
            new_message_timeline,
            version_timeline_fig,
            bandwidth_timeline_fig,
            work_timeline_fig,
            completeness_fig,
            messages_timeline_fig,
            new_message_stats_fig,
        ]

    app.run_server(debug=True)
