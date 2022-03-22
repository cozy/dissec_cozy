import plotly_express as px
from dash import html, dcc, dash
import numpy as np
import pandas as pd
import json


def get_data():
    with open('./outputs/raw.json') as f:
        data = json.load(f)

    messages = {
        "run_id": [],
        "successful_run": [],
        "type": [],
        "emission_time": [],
        "reception_time": [],
        "emitter_id": [],
        "receiver_id": [],
        "delivered": [],
    }

    for i, run in enumerate(data):
        for message in run["messages"]:
            messages["run_id"].append(i)
            messages["successful_run"].append(run["success"])
            messages["type"].append(message["type"])
            messages["emission_time"].append(message["emissionTime"])
            messages["reception_time"].append(message["receptionTime"])
            messages["emitter_id"].append(message["emitterId"])
            messages["receiver_id"].append(message["receiverId"])
            messages["delivered"].append(message["delivered"])

    df = pd.DataFrame(messages)
    df['latency'] = (df['reception_time'] - df['emission_time']
                     ).apply(lambda x: max(0, x))

    return df


if __name__ == '__main__':
    data = get_data()
    run_ids = pd.unique(data['run_id'])
    types = pd.unique(data['type'])

    app = dash.Dash(__name__)

    fig = px.scatter(data, x="reception_time", y="receiver_id",
                     color="type",
                     hover_name="type")

    app.layout = html.Div(children=[
        html.H1(children=f'Latency vs Reception time',
                style={'textAlign': 'center', 'color': '#7FDBFF'}),
        html.Div(style={'justifyContent': 'center'}, children=[
            html.H3('Y = ?'),
            dcc.Dropdown(
                [{'label': 'Receiver', 'value': 'receiver_id'}, {
                    'label': 'Emitter', 'value': 'emitter_id'}],
                "receiver_id",
                id="y-axis"
            )
        ]),
        html.Div(style={'justifyContent': 'center'}, children=[
            html.H3('Filtrer les run selon leur succès'),
            dcc.Dropdown(
                [{'label': 'Toutes', 'value': 'All'}, {
                    'label': 'Réussies', 'value': 'True'}, {
                    'label': 'Ratées', 'value': 'False'}],
                "All",
                id="runs-success"
            )
        ]),
        html.Div(style={'justifyContent': 'center'}, children=[
            html.H3('Exécutions du protocole:'),
            dcc.Checklist(
                id="runs-list",
                options=run_ids,
                value=run_ids,
                style={'display': 'flex', 'flex-wrap': 'wrap',
                       'flex-direction': 'row'},
                labelStyle={'display': 'flex',
                            'direction': 'row', 'margin': '5px'}
            )
        ]),
        html.Div(style={'justifyContent': 'center'}, children=[
            html.H3('Type de messages à montrer'),
            dcc.Checklist(
                id="types-list",
                options=types,
                value=types,
                style={'display': 'flex', 'flex-wrap': 'wrap',
                       'flex-direction': 'row'},
                labelStyle={'display': 'flex',
                            'direction': 'row', 'margin': '5px'}
            )
        ]),
        dcc.Graph(
            id='graph1',
            figure=fig
        ),
        html.Div(children=[
            f'''The graph above shows messages and their type'''
        ]),
    ])

    @app.callback(
        dash.Output(component_id='graph1', component_property='figure'),
        [
            dash.Input(component_id='y-axis', component_property='value'),
            dash.Input(component_id='runs-success',
                       component_property='value'),
            dash.Input(component_id='runs-list', component_property='value'),
            dash.Input(component_id='types-list', component_property='value')
        ]
    )
    def update_figure(selected_y_axis, selected_runs_success, selected_run_ids, selected_types):
        print(selected_runs_success)
        df = data
        df = df if selected_runs_success == 'All' else df[df['successful_run'] ==
                                                              True] if selected_runs_success == 'True' else df[df['successful_run'] == False]
        df = df[df['run_id'].isin(selected_run_ids)]
        df = df[df['type'].isin(selected_types)]
        return px.scatter(df,
                          x="reception_time",
                          y=selected_y_axis,
                          color="type",
                          hover_name="type")

    app.run_server(debug=True)
