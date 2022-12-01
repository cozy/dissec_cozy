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

### Implementation choices

#### What is done

- Failures generation
  - Failures on all nodes are generated at the beginning of the simulation.
  - Failures are generated following an exponential distribution
    - This distribution is often used to model memoryless failures (no deterioration), which is reasonnable in our contet because an execution of the protocol is not enough to for devices to deteriorate.
  - This distribution is parameterized by $\lambda$ such that the mean failure time is $\frac{1}{\lambda}$
    - It has a positive skew, meaning that the median is below the mean.
- Failure Detection
  - Failures are planned at the start of the execution according to a random seed
  - Nodes do not monitor each other
  - When a node fails, it triggers a reaction on all its peers with which it had an open channel.
    - This reaction is split into two messages: detecting the failure, which offsets the actual action depending on the building blocks, and the handling of the failure which is treated after the latency.
    - This organization is made so that information like the tree structure is not updated when the failure is onticed, only when it is handled.
    - The latency is calculated when the failure is noticed because it can't be calculated at the beginning of the protocol since the role of the nodes can evolve.
    - The latency is composed of the time for the node to detect the failure (RTT max) + some messages exchanged and crypto operations
- Node Replacement
  - When a node fails, a backup is inserted after a max RTT. Once inserted, all peers are immediatly aware of the new node since the the tree is stored in a shared memory.
- Health checks
  - We do not count health checks in costs
- Sending contributions
  - Contributions are sent in a "merry-go-round" fashion: the contirbutor sends one packet to each packet before repeating that for the next packet.
  - This has the effect that leaf aggregators either receives all the shares of a contributor, or none receive them.
- Failure Propagation
  - FFP
    - When a failure is detected, the simulator increases the time by the amount needed to propagate the failure through the tree, sets all nodes as dead and sends a stop message at the time when the propagation finishes.
    - The propagation latency is currently the time needed for the failure to propagate upward and then go back down in the tree. The downward part may not have to be included.

#### What should be done

- Include maintenance costs
  - Health checks are not included
