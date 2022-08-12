# DISSEC-ML Simulator

This repository contains the code of the simulation of the DISSEC-ML protocol.
It focuses on the part of the protocol after the tree has been constructed, so nodes know their parents, group members, children and the backup list.

## Usage

### Requirements

- Install [Node.js](https://nodejs.org/en/)
- Install [Python](https://www.python.org/downloads/)

### Installation

1. Run `yarn` or `npm i` to install Node dependencies
2. Run `pip3 install -r requirements.txt` to install Python dependencies

### Usage

1. Run the simulation `npm start` or `yarn start`. To get the detailed data export, turn on the option in [index.ts](src/index.ts)
2. Run the dashboard `npm run dashboard` or `yarn dashboard`. To get the detailed (but longer to load) dashboard, replace `dashboard` by `dashboard:full`
