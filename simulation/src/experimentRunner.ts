import fs from 'fs'

import NodesManager from './manager'
import { Message, MessageType, StopStatus } from './message'
import Node, { NodeRole } from './node'
import TreeNode from './treeNode'

export interface RunConfig {
  averageLatency: number;
  maxLatency: number;
  averageCrypto: number;
  averageCompute: number;
  healthCheckPeriod: number;
  multicastSize: number;
  deadline: number;
  failureRate: number;
  depth: number;
  fanout: number;
  groupSize: number;
  seed: string;
}

export interface RunResult {
  status: StopStatus;
  failureRate: number;
  observedFailureRate: number;
  messages: Message[];
}

export class ExperimentRunner {
  runs: RunConfig[];
  debug?: boolean = false;

  constructor (runs: RunConfig[], options: { debug?: boolean } = {}) {
    this.runs = runs;
    this.debug = options.debug;
  }

  run(outputPath: string) {
    const results: RunResult[] = [];
    for (const run of this.runs) {
      console.log(JSON.stringify(run));
      results.push(this.singleRun(run));
      console.log();
    }

    console.log("Success rate:", results.filter(e => e.status === StopStatus.Success).length, '/', results.length)

    if (!fs.existsSync(outputPath)) {
      const components = outputPath.split('/');
      fs.mkdirSync(outputPath.replace(components[components.length - 1], ''), {
        recursive: true
      });
    }
    fs.writeFileSync(outputPath, JSON.stringify(results));
  }

  singleRun(run: RunConfig): RunResult {
    const nodesInTree = run.fanout ** run.depth * run.groupSize;
    const backupListSize = nodesInTree * 1;

    // Create the tree structure
    const { nextId, node: root } = TreeNode.createTree(run.depth, run.fanout, run.groupSize, 0);

    // Adding the querier group
    const querierGroup = new TreeNode(nextId);
    querierGroup.children.push(root);
    querierGroup.members = Array(run.groupSize).fill(nextId);
    root.parents = querierGroup.members;

    const manager = NodesManager.createFromTree(root, {
      ...run,
      debug: this.debug
    });
    const n = manager.addNode(querierGroup, querierGroup.id);
    n.role = NodeRole.Querier;
    // Only the node with the lowest ID sends the message
    manager.transmitMessage(
      new Message(MessageType.RequestHealthChecks, 0, 0, querierGroup.id, querierGroup.id, {})
    );

    // Create a backup list and give it to all the nodes
    const backupListStart = Object.keys(manager.nodes).length;
    const backups = [];
    for (let i = 0; i < backupListSize; i++) {
      const backup = new Node({ id: backupListStart + i, config: manager.config });
      backup.role = NodeRole.Backup;
      manager.nodes[backupListStart + i] = backup;
      backups.push(backup);
    }
    for (let i = 0; i < backupListStart; i++) {
      manager.nodes[i].backupList = backups.map((e) => e.id);
    }

    // All leaves aggregator request data from contributors
    const leavesAggregators = root.selectNodesByDepth(run.depth - 1);
    for (const aggregator of leavesAggregators) {
      for (const member of aggregator.members) {
        manager.nodes[member].role = NodeRole.LeafAggregator;
      }
      // Requesting contributions
      for (const child of aggregator.children.flatMap((e) => e.members)) {
        // Only the node with the lowest ID sends the message
        manager.transmitMessage(
          new Message(MessageType.RequestContribution, 0, 0, aggregator.id, child, {
            parents: aggregator.members
          })
        );
      }

      // Setting contribution collection timeouts on the leaves aggregators
      for (const member of aggregator.members) {
        // TODO: Timeouts should take into account the broadcasts.
        // Currently supposes that contributors are reached in 1 hop
        if (member === aggregator.id) {
          // The first member of the group also waits for the rest of the group
          // Hence the additional latency
          manager.transmitMessage(
            new Message(
              MessageType.ContributionTimeout,
              0,
              3 * run.maxLatency,
              aggregator.id,
              aggregator.id,
              {}
            )
          );
        } else {
          manager.transmitMessage(
            new Message(
              MessageType.ContributionTimeout,
              0,
              2 * run.maxLatency,
              member,
              member,
              {}
            )
          );
        }
      }
    }

    // Upper layers periodically send health checks to their children
    for (let i = 0; i < run.depth - 1; i++) {
      const nodes = root.selectNodesByDepth(i);
      for (const node of nodes) {
        for (const member of node.members) {
          manager.transmitMessage(
            new Message(MessageType.RequestHealthChecks, 0, 0, member, member, {})
          );
        }
      }
    }

    while (manager.messages.length > 0) {
      manager.handleNextMessage();
    }

    console.log(`Simulation finished with status ${manager.status}`);
    console.log(
      `${Object.values(manager.nodes).filter((e) => !e.alive).length /
      Object.values(manager.nodes).length *
      100}% of nodes failed (${Object.values(manager.nodes).filter((e) => !e.alive)
        .length} / ${Object.values(manager.nodes).length})`
    );

    return {
      status: manager.status,
      failureRate: manager.failureRate,
      observedFailureRate:
        Object.values(manager.nodes).filter((e) => !e.alive).length /
        Object.values(manager.nodes).length,
      messages: manager.oldMessages
    };
  }
}
