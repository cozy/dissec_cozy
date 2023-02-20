# DARPA-FL Simulator

This repository contains the code of the simulation of the DISSEC-ML protocol.
It focuses on the part of the protocol after the tree has been constructed, so nodes know their parents, group members, children and the backup list.

## Usage

### Requirements

- Install [Node.js](https://nodejs.org/en/)
- Install [Python](https://www.python.org/downloads/)

### Installation

1. Run `yarn` or `npm i` to install Node dependencies
2. Run `pip3 install -r requirements.txt` to install Python dependencies
3. `git clone https://github.com/JulienMirval/dissec_cozy`
4. `cd dissec_cozy/simulation`

### Usage

### Run the simulator and producing results

1. Setup the simulation by preparing configurations in `src/index.ts`
2. Run the simulation `npm start` or `yarn start`. To get the detailed data export, turn on the option in [index.ts](src/index.ts)
3. A file is generated in `outputs/`

### Viewing results

1. `cp example.dissec.config.json dissec.config.json`
2. In the file `dissec.config.json`, set the default graph to your desired simulation output
2. Run the dashboard `npm run dashboard:paper` or `yarn dashboard:paper`

