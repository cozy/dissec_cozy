import cloneDeep from 'lodash/cloneDeep'

import { ManagerArguments } from './manager'
import { Aggregate, Message, MessageType } from './message'
import {
  handleBackupResponse,
  handleConfirmBackup,
  handleConfirmContributors,
  handleContactBackup,
  handleContinueMulticast,
  handleContributionTimeout,
  handleContributorPing,
  handleContributorsPolling,
  handleHealthCheckTimeout,
  handleNotifyGroup,
  handleNotifyGroupTimeout,
  handlePingTimeout,
  handlePrepareContribution,
  handleRequestContribution,
  handleRequestData,
  handleRequestHealthChecks,
  handleSendAggregate,
  handleSendChildren,
  handleSendContribution,
  handleSynchronizationTimeout,
} from './messageHandlers'
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
  node?: TreeNode
  config: ManagerArguments
  localTime: number
  alive: boolean
  deathTime: number
  role: NodeRole
  ongoingHealthChecks: { [nodeId: number]: boolean }
  finishedWorking: boolean
  backupList: number[]
  lookingForBackup: { [nodeId: number]: boolean }
  continueMulticast: boolean
  contactedAsABackup: boolean
  replacedNode?: number
  secretValue: number
  shares: number[]
  pingList: number[] = []
  contributorsList: { [id: number]: number[] | undefined } = {}
  contributions: { [contributor: string]: number }
  queriedNode?: number[]
  confirmContributors: boolean = true
  aggregates: { [nodeId: number]: Aggregate }
  lastSentAggregateId: string
  lastReceivedAggregateId?: string

  handleRequestContribution = handleRequestContribution
  handleContributorPing = handleContributorPing
  handlePingTimeout = handlePingTimeout
  handlePrepareContribution = handlePrepareContribution
  handleSendContribution = handleSendContribution
  handleContributionTimeout = handleContributionTimeout
  handleConfirmContributors = handleConfirmContributors
  handleSynchronizationTimeout = handleSynchronizationTimeout
  handleSendAggregate = handleSendAggregate
  handleRequestHealthChecks = handleRequestHealthChecks
  handleHealthCheckTimeout = handleHealthCheckTimeout
  handleContactBackup = handleContactBackup
  handleContinueMulticast = handleContinueMulticast
  handleBackupResponse = handleBackupResponse
  handleConfirmBackup = handleConfirmBackup
  handleNotifyGroup = handleNotifyGroup
  handleNotifyGroupTimeout = handleNotifyGroupTimeout
  handleContributorsPolling = handleContributorsPolling
  handleSendChildren = handleSendChildren
  handleRequestData = handleRequestData

  constructor({ node, id, config }: { node?: TreeNode; id?: number; config: ManagerArguments }) {
    if (!node && !id) return //throw new Error("Initializing a node without id")

    this.id = (node ? node.id : id)!
    this.node = cloneDeep(node)
    this.config = config
    this.localTime = 0
    this.alive = true
    this.deathTime = 0
    this.role = NodeRole.Aggregator
    this.secretValue = 50 // TODO: Better value, not always 50
    this.ongoingHealthChecks = {}
    this.finishedWorking = false
    this.backupList = []
    this.lookingForBackup = {}
    this.continueMulticast = false
    this.contactedAsABackup = false
    this.contributions = {}
    this.aggregates = {}
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

  receiveMessage(receivedMessage: Message): Message[] {
    const messages: Message[] = []

    // When the node is busy, messages are put back into the queue at the earliest available time
    if (receivedMessage.receptionTime < this.localTime) {
      receivedMessage.receptionTime = this.localTime
      return [receivedMessage]
    }

    receivedMessage.delivered = true
    this.localTime = Math.max(this.localTime, receivedMessage.receptionTime)

    if (this.config.debug) {
      const nodesOfInterest: number[] = [
        255, 0, 1, 2, 3, 4, 5, 6, 8, 37, 38, 51, 53, 52, 66, 99, 114, 115, 129, 134, 147, 148, 149, 162, 192, 194, 195,
        196, 197, 269, 284, 290, 305, 306, 339, 354, 359, 362, 364, 372, 393, 395, 415, 401, 426, 429, 446,
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
      case MessageType.ContributorPing:
        messages.push(...this.handleContributorPing(receivedMessage))
        break
      case MessageType.PingTimeout:
        messages.push(...this.handlePingTimeout())
        break
      case MessageType.PrepareContribution:
        messages.push(...this.handlePrepareContribution(receivedMessage))
        break
      case MessageType.SendContribution:
        messages.push(...this.handleSendContribution(receivedMessage))
        break
      case MessageType.ContributionTimeout:
        messages.push(...this.handleContributionTimeout(receivedMessage))
        break
      case MessageType.ConfirmContributors:
        messages.push(...this.handleConfirmContributors(receivedMessage))
        break
      case MessageType.SynchronizationTimeout:
        messages.push(...this.handleSynchronizationTimeout(receivedMessage))
        break
      case MessageType.SendAggregate:
        messages.push(...this.handleSendAggregate(receivedMessage))
        break
      case MessageType.RequestHealthChecks:
        messages.push(...this.handleRequestHealthChecks(receivedMessage))
        break
      case MessageType.CheckHealth:
        if (this.node && receivedMessage.content.parents) this.node.parents = receivedMessage.content.parents

        messages.push(
          new Message(
            MessageType.ConfirmHealth,
            this.localTime,
            0, // Don't specify time to let the manager add the latency
            this.id,
            receivedMessage.emitterId,
            { members: this.node?.members }
          )
        )
        break
      case MessageType.ConfirmHealth:
        delete this.ongoingHealthChecks[receivedMessage.emitterId]

        // Update the group of the child
        if (this.role !== NodeRole.Querier && receivedMessage.content.members) {
          // Prevent Querier from updating its group
          this.node!.children.find(e => e.members.includes(receivedMessage.emitterId))!.members =
            receivedMessage.content.members!
        }
        break
      case MessageType.HealthCheckTimeout:
        messages.push(...this.handleHealthCheckTimeout(receivedMessage))
        break
      case MessageType.ContinueMulticast:
        messages.push(...this.handleContinueMulticast(receivedMessage))
        break
      case MessageType.ContactBackup:
        messages.push(...this.handleContactBackup(receivedMessage))
        break
      case MessageType.BackupResponse:
        messages.push(...this.handleBackupResponse(receivedMessage))
        break
      case MessageType.ConfirmBackup:
        messages.push(...this.handleConfirmBackup(receivedMessage))
        break
      case MessageType.NotifyGroup:
        messages.push(...this.handleNotifyGroup(receivedMessage))
        break
      case MessageType.NotifyGroupTimeout:
        messages.push(...this.handleNotifyGroupTimeout(receivedMessage))
        break
      case MessageType.ContributorsPolling:
        messages.push(...this.handleContributorsPolling(receivedMessage))
        break
      case MessageType.SendChildren:
        messages.push(...this.handleSendChildren(receivedMessage))
        break
      case MessageType.RequestData:
        messages.push(...this.handleRequestData(receivedMessage))
        break
      default:
        throw new Error('Receiving unknown message type')
    }

    // Invariant: the node is a member of its group
    if (this.node && !this.node.members.includes(this.id)) {
      throw new Error(`#${this.id} is not in its members ([${this.node.members}])`)
    }

    return messages
  }
}

export default Node
