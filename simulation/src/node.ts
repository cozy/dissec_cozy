import cloneDeep from 'lodash/cloneDeep'

import NodesManager, { ManagerArguments } from './manager'
import { Aggregate, Message, MessageType } from './message'
import {
  handleConfirmChildren,
  handleConfirmContributors,
  handleFinishContribution,
  handleFinishSendingAggregate,
  handleGiveUpChild,
  handleNotifyGroup,
  handleNotifyGroupTimeout,
  handleRequestContribution,
  handleRequestData,
  handleSendAggregate,
  handleSendChildren,
  handleSendContribution,
  handleStartSendingContribution,
  handleSynchronizationTimeout,
} from './messageHandlers/node'
import { handleFailure } from './messageHandlers/node/handleFailure'
import TreeNode from './treeNode'

export enum NodeRole {
  Querier = 'Querier',
  Aggregator = 'Aggregator',
  LeafAggregator = 'LeafAggregator',
  Contributor = 'Contributor',
  Backup = 'Backup',
}

export class Node {
  id: number
  manager: NodesManager
  node?: TreeNode
  config: ManagerArguments
  localTime: number = 0
  deathTime: number = -1
  role = NodeRole.Backup
  ongoingHealthChecks: { [nodeId: number]: boolean }
  finishedWorking: boolean
  propagatedFailure: boolean = false
  lookingForBackup: { [nodeId: number]: boolean }
  continueMulticast: boolean
  contactedAsABackup: boolean
  replacedNode?: number
  secretValue: number
  shares: number[]
  pingList: number[] = []
  sentContributions: { [id: number]: boolean } = {}
  contributorsList: { [id: number]: number[] | undefined } = {}
  contributions: { [contributor: string]: number }
  confirmedChildren: { [member: number]: TreeNode[] } = {}
  queriedNode?: number[]
  confirmContributors: boolean = true

  aggregates: { [nodeId: number]: Aggregate }
  lastSentAggregateId: string
  parentLastReceivedAggregateId?: string
  finalAggregates: { [aggregateId: string]: { [nodeId: number]: Aggregate } } = {}

  handleRequestContribution = handleRequestContribution
  handleFinishContribution = handleFinishContribution
  handleStartSendingContribution = handleStartSendingContribution
  handleSendContribution = handleSendContribution
  handleConfirmContributors = handleConfirmContributors
  handleConfirmChildren = handleConfirmChildren
  handleSynchronizationTimeout = handleSynchronizationTimeout
  handleFinishSendingAggregate = handleFinishSendingAggregate
  handleSendAggregate = handleSendAggregate
  handleFailure = handleFailure
  handleNotifyGroup = handleNotifyGroup
  handleNotifyGroupTimeout = handleNotifyGroupTimeout
  handleSendChildren = handleSendChildren
  handleRequestData = handleRequestData
  handleGiveUpChild = handleGiveUpChild

  constructor({
    manager,
    node,
    id,
    config,
  }: {
    manager: NodesManager
    node?: TreeNode
    id: number
    config: ManagerArguments
  }) {
    if (!node && !id) return //throw new Error("Initializing a node without id")

    this.manager = manager
    this.id = id
    this.node = node
    this.config = config
    this.secretValue = 50 // TODO: Better value, not always 50
    this.ongoingHealthChecks = {}
    this.finishedWorking = false
    this.lookingForBackup = {}
    this.continueMulticast = false
    this.contactedAsABackup = false
    this.contributions = {}
    this.aggregates = {}
  }

  receiveMessage(receivedMessage: Message): Message[] | null {
    const messages: Message[] = []

    // When the node is busy, messages are put back into the queue at the earliest available time, except for health checks
    if (receivedMessage.receptionTime < this.localTime) {
      receivedMessage.receptionTime = this.localTime
      return null
    }

    receivedMessage.delivered = true
    this.localTime = Math.max(this.localTime, receivedMessage.receptionTime)

    // Used to measure the work incurred by the processing
    const startTime = this.localTime

    if (this.config.debug) {
      const nodesOfInterest: number[] = [
        // 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 21, 22, 27, 37, 38, 51, 53, 52, 66, 67, 68, 71, 99, 100, 101, 114, 115, 129,
        // 132, 134, 147, 148, 149, 153, 162, 164, 183, 192, 194, 195, 196, 197, 226, 269, 278, 284, 287, 290, 305, 306,
        // 311, 312, 317, 326, 339, 354, 359, 360, 362, 364, 372, 393, 395, 415, 400, 401, 426, 429, 446, 3164, 4597, 6173,
      ]
      const filters: MessageType[] = []
      if (
        nodesOfInterest.includes(this.id) ||
        nodesOfInterest.includes(receivedMessage.emitterId) ||
        nodesOfInterest.length === 0
      ) {
        receivedMessage.log(this, filters)
      }
    }

    switch (receivedMessage.type) {
      case MessageType.RequestContribution:
        messages.push(...this.handleRequestContribution(receivedMessage))
        break
      case MessageType.FinishContribution:
        messages.push(...this.handleFinishContribution(receivedMessage))
        break
      case MessageType.StartSendingContribution:
        messages.push(...this.handleStartSendingContribution(receivedMessage))
        break
      case MessageType.SendContribution:
        messages.push(...this.handleSendContribution(receivedMessage))
        break
      case MessageType.ConfirmContributors:
        messages.push(...this.handleConfirmContributors(receivedMessage))
        break
      case MessageType.ConfirmChildren:
        messages.push(...this.handleConfirmChildren(receivedMessage))
        break
      case MessageType.SynchronizationTimeout:
        messages.push(...this.handleSynchronizationTimeout(receivedMessage))
        break
      case MessageType.FinishSendingAggregate:
        messages.push(...this.handleFinishSendingAggregate(receivedMessage))
        break
      case MessageType.SendAggregate:
        messages.push(...this.handleSendAggregate(receivedMessage))
        break
      case MessageType.HandleFailure:
        messages.push(...this.handleFailure(receivedMessage))
        break
      case MessageType.NotifyGroup:
        messages.push(...this.handleNotifyGroup(receivedMessage))
        break
      case MessageType.NotifyGroupTimeout:
        messages.push(...this.handleNotifyGroupTimeout(receivedMessage))
        break
      case MessageType.SendChildren:
        messages.push(...this.handleSendChildren(receivedMessage))
        break
      case MessageType.RequestData:
        messages.push(...this.handleRequestData(receivedMessage))
        break
      case MessageType.GiveUpChild:
        messages.push(...this.handleGiveUpChild(receivedMessage))
        break
      default:
        throw new Error('Receiving unknown message type')
    }

    receivedMessage.work = this.localTime - startTime

    return messages
  }

  sendAggregate(aggregate: Aggregate) {
    if (!this.node || this.node.members.indexOf(this.id) < 0) {
      throw new Error('Invalid node or parent')
    }

    // Non blocking sync send the result ASAP
    const parent = this.node.parents[this.node.members.indexOf(this.id)]
    const transmissionTime = (this.config.modelSize - 1) / this.config.averageBandwidth
    this.lastSentAggregateId = aggregate.id
    this.finishedWorking = true

    // Reset full synchro
    this.confirmedChildren = {}

    return new Message(
      MessageType.FinishSendingAggregate,
      this.localTime,
      this.localTime + this.config.averageLatency + transmissionTime,
      this.id,
      this.id,
      {
        aggregate,
        targetNode: parent,
      }
    )
  }

  tag() {
    return `[@${this.localTime}] (${this.role}) Node #${this.id}`
  }

  /**
   * Produces a simple non-cryptographic hash because JS does not have a default, easy to use hash function
   * @param children ID for the aggregate sent by each child
   * @returns A new unique ID
   */
  aggregationId(children: string[]): string {
    const s = cloneDeep(children).sort().join('-')
    return s
      .split('')
      .reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0)
        return a & a
      }, 0)
      .toString()
  }

  cryptoLatency(): number {
    return this.config.averageCryptoTime
  }

  intersectChildrenConfirmations() {
    const lists = this.node!.members.map(e => this.confirmedChildren[e] || [])
    const position = this.node!.members.indexOf(this.id)
    let result: TreeNode[] = []

    // TODO: Make it better
    const shortestList = lists.find(list => list.length === Math.min(...lists.map(e => e.length)))!
    for (const element of shortestList) {
      // Checking if each element of the shortest list is included in EVERY other list
      let occurrences = 0
      for (const list of lists) {
        if (list === shortestList) {
          // Do not intersect the list with itself
          continue
        }

        let missing = true
        for (const other of list) {
          if (other.members.includes(element.members[position])) {
            // The element is in the other list
            missing = false
            break
          }
        }

        if (!missing) {
          occurrences += 1
        }
      }
      if (occurrences === lists.length - 1) {
        // The element is in every list
        result.push(element)
      }
    }
    return result
  }
}

export default Node
