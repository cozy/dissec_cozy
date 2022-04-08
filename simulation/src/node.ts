import cloneDeep from 'lodash/cloneDeep'
import isEqual from 'lodash/isEqual'

import { ManagerArguments } from './manager'
import { Aggregate, Message, MessageType, StopStatus } from './message'
import {
  handleBackupResponse,
  handleConfirmBackup,
  handleConfirmContributors,
  handleContactBackup,
  handleContributionTimeout,
  handleHealthCheckTimeout,
  handleRequestContribution,
  handleRequestData,
  handleRequestHealthChecks,
  handleSendAggregate,
  handleSendChildren,
  handleSendContribution,
  handleShareContributors,
} from './messageHandlers'
import { handleContinueMulticast } from './messageHandlers/continueMulticast'
import { handleNotifyGroup } from './messageHandlers/notifyGroup'
import TreeNode from './treeNode'

export const arrayEquals = (a: number[], b: number[]): boolean => {
  return isEqual(cloneDeep(a).sort(), cloneDeep(b).sort())
}

export enum NodeRole {
  Querier = "Querier",
  Aggregator = "Aggregator",
  LeafAggregator = "LeafAggregator",
  Contributor = "Contributor",
  Backup = "Backup"
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
  secretValue: number
  shares: number[]
  contributorsList: { [nodeId: number]: number[] }
  contributions: { [contributor: string]: number }
  expectedContributors: number[]
  aggregates: { [nodeId: number]: Aggregate }
  lastSentAggregateId: string

  handleRequestContribution = handleRequestContribution
  handleSendContribution = handleSendContribution
  handleContributionTimeout = handleContributionTimeout
  handleShareContributors = handleShareContributors
  handleConfirmContributors = handleConfirmContributors
  handleSendAggregate = handleSendAggregate
  handleRequestHealthChecks = handleRequestHealthChecks
  handleHealthCheckTimeout = handleHealthCheckTimeout
  handleContactBackup = handleContactBackup
  handleContinueMulticast = handleContinueMulticast
  handleBackupResponse = handleBackupResponse
  handleConfirmBackup = handleConfirmBackup
  handleNotifyGroup = handleNotifyGroup
  handleSendChildren = handleSendChildren
  handleRequestData = handleRequestData

  constructor ({ node, id, config }: { node?: TreeNode, id?: number, config: ManagerArguments }) {
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
    this.contributorsList = { [this.id]: [] }
    this.contributions = {}
    this.expectedContributors = []
    this.aggregates = {}
  }

  aggregationId(child: string[]): string {
    const s = cloneDeep(child).sort().join('-')
    return s.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0).toString()
  }

  receiveMessage(receivedMessage: Message): Message[] {
    const messages: Message[] = []

    // When the node is busy, messages are put back into the queue at the earliest available time
    if (receivedMessage.receptionTime < this.localTime) {
      // console.log("bounced", this.id, receivedMessage.emitterId, this.localTime, receivedMessage.receptionTime);
      receivedMessage.receptionTime = this.localTime
      return [receivedMessage]
    }

    receivedMessage.delivered = true
    this.localTime = Math.max(this.localTime, receivedMessage.receptionTime)

    if (this.config.debug) {
      const nodeOfInterest: number[] = [
        255, 0,1,2,3, 4,5,51, 53, 52, 415, 401, 429, 359
        // 255, 0, 1, 2, 3, 4, 6, 22, 66, 129, 147, 148, 149, 193, 195, 226, 241, 255, 210, 225, 240, 267, 317, 359, 376
      ]
      const filters: MessageType[] = [
        // MessageType.CheckHealth,
        // MessageType.ConfirmHealth,
        // MessageType.HealthCheckTimeout
        // MessageType.ContactBackup,
        // MessageType.BackupResponse
      ]
      if (nodeOfInterest.includes(this.id) || nodeOfInterest.includes(receivedMessage.emitterId) || nodeOfInterest.length === 0) {
        receivedMessage.log(this, filters)
      }
    }

    switch (receivedMessage.type) {
      case MessageType.RequestContribution:
        messages.push(...this.handleRequestContribution(receivedMessage))
        break
      case MessageType.SendContribution:
        messages.push(...this.handleSendContribution(receivedMessage))
        break
      case MessageType.ContributionTimeout:
        messages.push(...this.handleContributionTimeout(receivedMessage))
        break
      case MessageType.ShareContributors:
        messages.push(...this.handleShareContributors(receivedMessage))
        break
      case MessageType.ConfirmContributors:
        messages.push(...this.handleConfirmContributors(receivedMessage))
        break
      case MessageType.SendAggregate:
        messages.push(...this.handleSendAggregate(receivedMessage))
        break
      case MessageType.RequestHealthChecks:
        messages.push(...this.handleRequestHealthChecks(receivedMessage))
        break
      case MessageType.CheckHealth:
        if(this.node && receivedMessage.content.parents)
          this.node.parents = receivedMessage.content.parents

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
        if (!this.node?.children.length) {
          // The node still hasn't received children
          // This occurs because others members don't know either, the protocol failed
          messages.push(
            new Message(
              MessageType.StopSimulator,
              this.localTime,
              this.localTime,
              this.id,
              this.id,
              { status: StopStatus.SimultaneousFailures, targetGroup: this.node }
            )
          )
        }
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
    if (this.node && !this.node.members.includes(this.id))
      throw new Error(`#${this.id} is not in its members ([${this.node.members}])`)

    return messages
  }
}

export default Node
