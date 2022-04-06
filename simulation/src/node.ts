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
import { createGenerator } from './random'
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

  constructor ({ node, id, config }: { node?: TreeNode, id?: number, config: ManagerArguments }) {
    if (!node && !id) return //throw new Error("Initializing a node without id")

    this.id = (node ? node.id : id)!
    this.node = node
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

  receiveMessage(receivedMessage: Message, debug?: boolean): Message[] {
    const messages: Message[] = []

    receivedMessage.delivered = true
    this.localTime = Math.max(this.localTime, receivedMessage.receptionTime)

    if (debug) {
      const nodeOfInterest: number[] = [
        // 193, 226, 225, 420, 328, 192, 193, 194, 195,196,197
        255, 0, 1, 2, 129, 147, 148, 149, 193, 195, 226, 241, 255, 210, 225, 240, 317
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
        messages.push(...this.handleHealthCheckTimeout(receivedMessage))
        break
      case MessageType.ContinueMulticast:
        if (this.continueMulticast) {
          if (!this.node) {
            throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
          }
          if (receivedMessage.content.failedNode === undefined) {
            throw new Error(`${this.id} did not receive failed node`)
          }

          // Multicasting to a group of the backup list
          const sorterGenerator = createGenerator(this.id.toString())
          const multicastTargets = receivedMessage.content.remainingBackups!
            .sort(() => sorterGenerator() - 0.5)
            .slice(0, this.config.multicastSize)

          for (const backup of multicastTargets) {
            const targetGroup = this.node.children.filter(e =>
              e.members.includes(receivedMessage.content.failedNode!)
            )[0]

            messages.push(
              new Message(
                MessageType.ContactBackup,
                this.localTime,
                0, // ASAP
                this.id,
                backup,
                {
                  failedNode: receivedMessage.content.failedNode,
                  targetGroup
                }
              )
            )
          }

          const remainingBackups = this.backupList.filter(e =>
            !multicastTargets.includes(e)
          )
          if (remainingBackups.length > 0) {
            // Reschedule a multicast if there are other backups available and the previously contacted ones didn't answer
            this.continueMulticast = true
            messages.push(
              new Message(
                MessageType.ContinueMulticast,
                this.localTime,
                this.localTime + 2 * this.config.maxLatency,
                this.id,
                this.id,
                {
                  remainingBackups,
                  failedNode: receivedMessage.content.failedNode
                }
              )
            )
          } else {
            throw new Error("Ran out of backups...")
          }
        }
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
        // NotifyGroup messages are ignored if the node does not know its part of the tree.
        // This occurs when 2 nodes are being replaced concurrently in the same group.
        if (this.node && this.node.children.length > 0) {
          if (!receivedMessage.content.targetGroup) {
            throw new Error(`#${this.id} did not receive targetGroup`)
          }
          if (receivedMessage.content.failedNode === undefined) {
            throw new Error(`#${this.id} did not receive failed node from #${receivedMessage.emitterId}`)
          }
          // The node has been notified by a backup that it is joining the group
          // Compare the local members with the received one, keep the newest version
          this.node.members = receivedMessage.content.targetGroup!.members

          messages.push(
            new Message(
              MessageType.SendChildren,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                targetGroup: this.node,
                children: this.node.children,
                role: this.role,
                backupList: this.backupList,
                contributors: this.contributorsList[this.id]
              }
            )
          )
        }
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
