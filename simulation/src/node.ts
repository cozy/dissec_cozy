import { Message, MessageType } from './message'
import {
  handleContributionTimeout,
  handleRequestContribution,
  handleSendContribution,
  handleConfirmContributors,
  handleShareContributors,
  handleSendAggregate,
  handleRequestHealthChecks,
  handleHealthCheckTimeout,
  handleContactBackup,
  handleBackupResponse,
  handleConfirmBackup,
  handleSendChildren,
  handleRequestData
} from './messageHandlers'
import TreeNode from './treeNode'

export const arrayEquals = (a: number[], b: number[]): boolean => {
  return JSON.stringify(a.sort()) === JSON.stringify(b.sort())
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
  aggregates: { [nodeId: number]: { counter: number; data: number } }

  handleRequestContribution = handleRequestContribution
  handleSendContribution = handleSendContribution
  handleContributionTimeout = handleContributionTimeout
  handleShareContributors = handleShareContributors
  handleConfirmContributors = handleConfirmContributors
  handleSendAggregate = handleSendAggregate
  handleRequestHealthChecks = handleRequestHealthChecks
  handleHealthCheckTimeout = handleHealthCheckTimeout
  handleContactBackup = handleContactBackup
  handleBackupResponse = handleBackupResponse
  handleConfirmBackup = handleConfirmBackup
  handleSendChildren = handleSendChildren
  handleRequestData = handleRequestData

  constructor({ node, id }: { node?: TreeNode, id?: number }) {
    if (!node && !id) return //throw new Error("Initializing a node without id")

    this.id = (node ? node.id : id)!
    this.node = node
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

  receiveMessage(receivedMessage: Message): Message[] {
    const messages: Message[] = []

    this.localTime = Math.max(this.localTime, receivedMessage.receptionTime)

    const nodeOfInterest: number[] = [0, 1, 2, 255, 495, 498, 282]
    const filters: MessageType[] = [
      // MessageType.CheckHealth,
      // MessageType.ConfirmHealth,
      // MessageType.HealthCheckTimeout
    ]
    if (nodeOfInterest.includes(this.id) || nodeOfInterest.includes(receivedMessage.emitterId) || nodeOfInterest.length === 0)
      receivedMessage.log(this, filters)

    switch (receivedMessage.type) {
      case MessageType.RequestContribution:
        return this.handleRequestContribution(receivedMessage)
      case MessageType.SendContribution:
        return this.handleSendContribution(receivedMessage)
      case MessageType.ContributionTimeout:
        return this.handleContributionTimeout(receivedMessage)
      case MessageType.ShareContributors:
        return this.handleShareContributors(receivedMessage)
      case MessageType.ConfirmContributors:
        return this.handleConfirmContributors(receivedMessage)
      case MessageType.SendAggregate:
        return this.handleSendAggregate(receivedMessage)
      case MessageType.RequestHealthChecks:
        return this.handleRequestHealthChecks(receivedMessage)
      case MessageType.CheckHealth:
        messages.push(
          new Message(
            MessageType.ConfirmHealth,
            this.localTime,
            0, // Don't specify time to let the manager add the latency
            this.id,
            receivedMessage.emitterId,
            {}
          )
        )
        break
      case MessageType.ConfirmHealth:
        delete this.ongoingHealthChecks[receivedMessage.emitterId]
        break
      case MessageType.HealthCheckTimeout:
        return this.handleHealthCheckTimeout(receivedMessage)
      case MessageType.ContinueMulticast:
        // TODO: Implement other rounds of multicasting
        break
      case MessageType.ContactBackup:
        return this.handleContactBackup(receivedMessage)
      case MessageType.BackupResponse:
        return this.handleBackupResponse(receivedMessage)
      case MessageType.ConfirmBackup:
        return this.handleConfirmBackup(receivedMessage)
      case MessageType.NotifyGroup:
        // NotifyGroup messages are ignored if the node does not know its part of the tree.
        // This occurs when 2 nodes are being replaced concurrently in the same group.
        if (this.node) {
          // The node has been notified by a backup that it is joining the group
          this.node.members = this.node.members.map(member => member === receivedMessage.content.failedNode ? receivedMessage.emitterId : member)
          messages.push(
            new Message(
              MessageType.SendChildren,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                children: this.node.children,
                role: this.role,
                backupList: this.backupList,
                contributors: this.contributorsList[this.id]
              }
            )
          )
        }
        break
      case MessageType.SendChildren:
        return this.handleSendChildren(receivedMessage)
      case MessageType.RequestData:
        return this.handleRequestData(receivedMessage)
      default:
        throw new Error('Receiving unknown message type')
    }

    return messages
  }
}

export default Node
