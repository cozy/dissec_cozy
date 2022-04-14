import plotly_express as px
from dash import html, dcc, dash
import numpy as np
import pandas as pd
import json


def get_data(path):
    with open(path) as f:
        data = json.load(f)

    messages = {
        "run_id": [],
        "status": [],
        "failure_rate": [],
        "observed_failure_rate": [],
        "type": [],
        "emitter_time": [],
        "receiver_time": [],
        "emitter_id": [],
        "receiver_id": [],
        "delivered": [],
    }

    for i, run in enumerate(data):
        for message in run["messages"]:
            messages["run_id"].append(i)
            messages["status"].append(run["status"])
            messages["failure_rate"].append(run["failureRate"])
            messages["observed_failure_rate"].append(run["observedFailureRate"])
            messages["type"].append(message["type"])
            messages["emitter_time"].append(message["emissionTime"])
            messages["receiver_time"].append(message["receptionTime"])
            messages["emitter_id"].append(message["emitterId"])
            messages["receiver_id"].append(message["receiverId"])
            messages["delivered"].append(message["delivered"])

    df = pd.DataFrame(messages)
    df["latency"] = (df["receiver_time"] - df["emitter_time"]).apply(
        lambda x: max(0, x)
    )

    df["simulation_length"] = df["receiver_time"]

    maxs = {}
    ids = [i for i in pd.unique(df["run_id"])]
    for i in ids:
        maxs[i] = df[df["run_id"] == i]["receiver_time"].max()

    def simlen(x):
        x["simulation_length"] = maxs[x["run_id"]]
        return x

    df.apply(simlen, axis=1)
    return df


if __name__ == "__main__":
    with open("./dissec.config.json") as f:
        config = json.load(f)

    data = get_data(config["dataPath"])

    run_ids = pd.unique(data["run_id"])
    status = pd.unique(data["status"])
    types = pd.unique(data["type"])
    failure_rates = np.sort(pd.unique(data["failure_rate"]))
    observed_failure_rates = np.sort(pd.unique(data["observed_failure_rate"]))

    app = dash.Dash(__name__)

    message_timeline_fig = px.scatter(
        data, x="receiver_time", y="receiver_id", color="type", hover_name="type"
    )
    failure_map_fig = px.scatter(
        data.groupby(["run_id", "status"], as_index=False).mean(),
        x="failure_rate",
        y="observed_failure_rate",
        color="status",
        hover_name="run_id",
    )
    failure_rate_per_status_fig = px.box(
        data.groupby(["run_id", "status"], as_index=False).mean(),
        x="status",
        y="failure_rate",
        hover_name="run_id",
        points="all",
    )
    observed_failure_rate_per_status_fig = px.box(
        data.groupby(["run_id", "status"], as_index=False).mean(),
        x="status",
        y="observed_failure_rate",
        hover_name="run_id",
        points="all",
    )
    messages_histogram = px.histogram(data, x="receiver_time")
    failure_histogram = px.histogram(
        data[data["delivered"] == True],
        x="failure_rate",
    )
    observed_failure_histogram = px.histogram(
        data[data["delivered"] == True],
        x="observed_failure_rate",
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
                    html.H3("Overview:"),
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
                            Theoretical failure rate (min={round(data[data['status'] == i]['failure_rate'].min() * 100, 2)}%;
                            avg={round(data[data['status'] == i]['failure_rate'].mean() * 100, 2)}%;
                            med={round(data[data['status'] == i]['failure_rate'].median() * 100, 2)}%;
                            max={round(data[data['status'] == i]['failure_rate'].max() * 100, 2)}%).
                            Observed failure rate (min={round(data[data['status'] == i]['observed_failure_rate'].min() * 100, 2)}%;
                            avg={round(data[data['status'] == i]['observed_failure_rate'].mean() * 100, 2)}%;
                            med={round(data[data['status'] == i]['observed_failure_rate'].median() * 100, 2)}%;
                            max={round(data[data['status'] == i]['observed_failure_rate'].max() * 100, 2)}%)
                            """
                                            )
                                            for i in status
                                        ]
                                    ),
                                ]
                            )
                        ]
                    ),
                ],
            ),
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
                    html.H3("Filter on status:"),
                    dcc.Dropdown(
                        [{"label": "Toutes", "value": "All"}]
                        + [{"label": i, "value": i} for i in status],
                        "All",
                        id="runs-success",
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
                [
                    html.H3("Theoretical failure rate"),
                    dcc.RangeSlider(
                        0,
                        failure_rates[-1],
                        failure_rates[1] - failure_rates[0],
                        value=[0, failure_rates[-1]],
                        id="failure-rates-range",
                    ),
                ]
            ),
            html.Div(
                [
                    html.H3("Observed failure rate"),
                    dcc.RangeSlider(
                        0,
                        round(observed_failure_rates[-1], 1) + 0.1,
                        round(observed_failure_rates[-1], 1) / 20,
                        value=[0, round(observed_failure_rates[-1], 1) + 0.1],
                        id="observed-failure-rates-range",
                    ),
                ]
            ),
            dcc.Graph(id="message_timeline", figure=message_timeline_fig),
            dcc.Graph(id="message_histogram", figure=messages_histogram),
            dcc.Graph(id="failure_map", figure=failure_map_fig),
            html.Div(
                style={
                    "display": "flex",
                    "flex-direction": "row",
                    "justify-content": "center",
                },
                children=[
                    dcc.Graph(
                        id="failure_rate_per_status", figure=failure_rate_per_status_fig
                    ),
                    dcc.Graph(
                        id="observed_failure_rate_per_status",
                        figure=observed_failure_rate_per_status_fig,
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
                    dcc.Graph(id="failure_rate_hist", figure=failure_histogram),
                    dcc.Graph(
                        id="observed_failure_hist",
                        figure=observed_failure_histogram,
                    ),
                ],
            ),
        ]
    )

    @app.callback(
        [
            dash.Output(component_id="message_timeline", component_property="figure"),
            dash.Output(component_id="message_histogram", component_property="figure"),
        ],
        [
            dash.Input(component_id="y-axis", component_property="value"),
            dash.Input(component_id="runs-success", component_property="value"),
            dash.Input(component_id="runs-list", component_property="value"),
            dash.Input(component_id="types-list", component_property="value"),
            dash.Input(component_id="failure-rates-range", component_property="value"),
            dash.Input(
                component_id="observed-failure-rates-range", component_property="value"
            ),
        ],
    )
    def update_figure(
        selected_y_axis,
        selected_runs_success,
        selected_run_ids,
        selected_types,
        selected_failures,
        selected_observed_failures,
    ):
        df = data
        if selected_runs_success != "All":
            df = df[df["status"] == selected_runs_success]
        df = df[
            df["failure_rate"].isin(
                [
                    i
                    for i in failure_rates
                    if i <= selected_failures[1] and i >= selected_failures[0]
                ]
            )
        ]
        df = df[
            df["observed_failure_rate"].isin(
                [
                    i
                    for i in observed_failure_rates
                    if i <= selected_observed_failures[1]
                    and i >= selected_observed_failures[0]
                ]
            )
        ]
        if "All" not in selected_run_ids:
            df = df[df["run_id"].isin(selected_run_ids)]
        df = df[df["type"].isin(selected_types)]

        new_message_timeline = px.scatter(
            df,
            x=selected_y_axis + "_time",
            y=selected_y_axis + "_id",
            color="type",
            hover_name="type",
        )
        new_message_histogram = px.histogram(df, x=selected_y_axis + "_time")
        return new_message_timeline, new_message_histogram

    app.run_server(debug=True)
