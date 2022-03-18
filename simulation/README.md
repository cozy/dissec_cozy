# DISSEC-ML Simulator

This repository contains the code of the simulation of the DISSEC-ML protocol.
It focuses on the part of the protocol after the tree has been constructed, so nodes know their parents, group members, children and the backup list.

## Design

### Assumptions

- Nodes are monothreaded processes. All local processing is done serially, but different nodes can do actions in parallel.
- Once a node fails, either it comes back online before another node notices or it fails until the end of the protocol execution

To simulate the distributed nature of the system each node is represented as an independent data structure that has its own internal clock.
Nodes communicate with each other through messages that are stored in a queue, ordered by time of delivery, and dispatched to corresponding nodes.
The simulation is therefore divided in steps of variable time length
