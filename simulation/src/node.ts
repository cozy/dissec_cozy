import {
  AVERAGE_COMPUTE,
  AVERAGE_CRYPTO,
  HEALTH_CHECK_PERIOD,
  MAX_LATENCY,
  MULTICAST_SIZE
} from './manager'
import { Message, MessageType } from './message'
import { Generator } from './random'
import TreeNode from './treeNode'

const BASE_NOISE = 10000000

export enum NodeRole {
  Querier,
  Aggregator,
  LeafAggregator,
  Contributor
}

class Node {
  id: number
  node?: TreeNode
  localTime: number
  alive: boolean
  role: NodeRole
  ongoingHealthChecks: number[]
  finishedWorking: boolean
  backupList: number[]
  continueMulticast: boolean
  contactedAsABackup: boolean
  shares: number[]
  contributorsList: number[][]
  contributions: { [contributor: string]: number }
  aggregates: { counter: number; data: number }[]

  constructor({node, id}: { node?: TreeNode, id?: number }) {
    if(!node && !id) return //throw new Error("Initializing a node without id")

    this.id = (node ? node.id : id)!
    this.node = node
    this.localTime = 0
    this.alive = true
    this.role = NodeRole.Aggregator
    this.ongoingHealthChecks = []
    this.finishedWorking = false
    this.backupList = []
    this.continueMulticast = false
    this.contactedAsABackup = false
    this.contributorsList = [[]]
    this.contributions = {}
    this.aggregates = []
  }

  receiveMessage(receivedMessage: Message): Message[] {
    const messages: Message[] = []
    const position = this.node?.members.indexOf(this.id)
    const generator = Generator.get()

    this.localTime = Math.max(this.localTime, receivedMessage.receptionTime)

    switch (receivedMessage.type) {
      case MessageType.RequestContribution:
        if(!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)

        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) received a request for contribution`
        )

        // TODO: Set contributors during initialization
        this.role = NodeRole.Contributor

        // Prepare shares
        this.localTime += AVERAGE_COMPUTE
        // TODO: Better value, not always 50
        this.shares = Array(this.node.members.length).fill(0)
        let accumulator = 0
        for (let i = 0; i < this.node.members.length - 1; i++) {
          this.shares[i] = BASE_NOISE * generator()
          accumulator += this.shares[i]
        }
        this.shares[this.shares.length - 1] = 50 - accumulator

        for (const parent of receivedMessage.content.parents || []) {
          // Open a secure channel
          this.localTime += AVERAGE_CRYPTO

          // Send data to parent
          messages.push(
            new Message(
              MessageType.SendContribution,
              this.localTime,
              0, // Don't specify time to let the manager add the latency
              this.id,
              parent,
              { share: this.shares[this.node.parents.indexOf(parent)] }
            )
          )
        }
        break
      case MessageType.SendContribution:
        console.log(
          `Node #${this.id} (time=${this.localTime}) received a contribution (${
            receivedMessage.content.share
          })`
        )

        if (!receivedMessage.content.share)
          throw new Error('Received a contribution without a share')

        this.contributorsList[0].push(receivedMessage.emitterId) // The first item is the local list
        this.contributions[receivedMessage.emitterId] =
          receivedMessage.content.share
        break
      case MessageType.ContributionTimeout:
        if(!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)

        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) timed out waiting for contributions`
        )

        if (this.id === this.node.members[0]) {
          // The leader aggregates the received contributors lists and confirms them to the group
          const finalContributors = []
          for (const contributor of this.contributorsList[0]) {
            // Checking that a given contributor is in every contributors lists
            if (
              this.contributorsList
                .map(list => list.includes(contributor))
                .every(val => val)
            ) {
              finalContributors.push(contributor)
            }
          }
          this.contributorsList[0] = finalContributors

          for (const member of this.node.members.filter(e => e !== this.id)) {
            messages.push(
              new Message(
                MessageType.ConfirmContributors,
                this.localTime,
                0, // Don't specify time to let the manager add the latency
                this.id,
                member,
                { contributors: finalContributors }
              )
            )
          }

          messages.push(
            new Message(
              MessageType.SendAggregate,
              this.localTime,
              0, // Don't specify time to let the manager add the latency
              this.id,
              this.node.parents[this.node.members.indexOf(this.id)],
              {
                aggregate: {
                  counter: this.contributorsList[0].length,
                  data: Object.values(this.contributions).reduce(
                    (prev, curr) => prev + curr
                  )
                }
              }
            )
          )
        } else {
          // Group members send their contributors list to the first member
          messages.push(
            new Message(
              MessageType.ShareContributors,
              this.localTime,
              0, // Don't specify time to let the manager add the latency
              this.id,
              this.node.members[0],
              { contributors: this.contributorsList[0] }
            )
          )
        }
        break
      case MessageType.ShareContributors:
        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) received contributors from member node #${
            receivedMessage.emitterId
          }:\n${receivedMessage.content.contributors}`
        )

        if (
          !receivedMessage.content.contributors ||
          receivedMessage.content.contributors.length === 0
        )
          throw new Error(
            'Received an empty contributors list, the protocol should stop'
          )

        // TODO: Receiving enough contributors list should trigger the timeout
        this.contributorsList.push(receivedMessage.content.contributors)
        break
      case MessageType.ConfirmContributors:
        if(!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)

        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) received a confirmation of the final contributors list from member node #${
            receivedMessage.emitterId
          }`
        )

        if (
          !receivedMessage.content.contributors ||
          receivedMessage.content.contributors.length === 0
        )
          throw new Error(
            'Received an empty contributors list, the protocol should stop'
          )

        this.contributorsList[0] = receivedMessage.content.contributors

        messages.push(
          new Message(
            MessageType.SendAggregate,
            this.localTime,
            0, // Don't specify time to let the manager add the latency
            this.id,
            this.node.parents[this.node.members.indexOf(this.id)],
            {
              aggregate: {
                counter: this.contributorsList[0].length,
                data: Object.values(this.contributions).reduce(
                  (prev, curr) => prev + curr
                )
              }
            }
          )
        )
        break
      case MessageType.SendAggregate:
        if(!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)

        console.log(
          `${this.role === NodeRole.Querier ? 'Querier' : 'Node'} #${this.id} (time=${
            this.localTime
          }) received an aggregate from child #${receivedMessage.emitterId}`
        )

        if (this.role === NodeRole.Querier) {
          if (!receivedMessage.content.aggregate)
            throw new Error('Received an empty aggregate')

          this.aggregates.push(receivedMessage.content.aggregate)

          this.finishedWorking = true

          if (this.aggregates.length === this.node.members.length) {
            // Received all shares
            const result = this.aggregates.reduce((prev, curr) => ({
              counter: prev.counter + curr.counter,
              data: prev.data + curr.data
            }))
            console.log(
              `Final aggregation result: ${
                result.counter
              } contributions -> ${(result.data / result.counter) *
                this.aggregates.length}\n\n\n`
            )
          }
        } else {
          if (!receivedMessage.content.aggregate)
            throw new Error('Received an empty aggregate')

          this.aggregates.push(receivedMessage.content.aggregate)

          if (this.aggregates.length === this.node.children.length) {
            // Forwarding the result to the parent
            const aggregate = this.aggregates.reduce((prev, curr) => ({
              counter: prev.counter + curr.counter,
              data: prev.data + curr.data
            }))

            // Stop regularly checking children's health
            this.finishedWorking = true

            messages.push(
              new Message(
                MessageType.SendAggregate,
                this.localTime,
                0, // Don't specify time to let the manager add the latency
                this.id,
                this.node.parents[this.node.members.indexOf(this.id)],
                {
                  aggregate
                }
              )
            )
          }
        }
        break
      case MessageType.RequestHealthChecks:
        if(!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)

        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) is requesting health checks from his children [${this.node.children.map(e => '#' + e.members[position!])}]`
        )

        // Check children's health
        for (const child of this.node.children) {
          const msg = new Message(
            MessageType.CheckHealth,
            this.localTime,
            0, // Don't specify time to let the manager add the latency
            this.id,
            child.members[position!],
            {}
          )
          messages.push(msg)
          this.ongoingHealthChecks.push(msg.receiverId)
        }

        // Set a timeout to trigger the recovery procedure for not responding nodes
        messages.push(
          new Message(
            MessageType.HealthCheckTimeout,
            this.localTime,
            this.localTime + 2 * MAX_LATENCY,
            this.id,
            this.id,
            {}
          )
        )

        // Reschedule health checks
        if (!this.finishedWorking) {
          console.log(`Node #${this.id} is rescheduling a health check`)
          messages.push(
            new Message(
              MessageType.RequestHealthChecks,
              this.localTime,
              this.localTime + HEALTH_CHECK_PERIOD,
              this.id,
              this.id,
              {}
            )
          )
        }
        break
      case MessageType.CheckHealth:
        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) received a health check request from parent node #${receivedMessage.emitterId}.`
        )

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
        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) received a health confirmation from child node #${
            receivedMessage.emitterId
          } ([${this.ongoingHealthChecks}]).`
        )

        this.ongoingHealthChecks.splice(this.ongoingHealthChecks.indexOf(receivedMessage.emitterId), 1)
        break
      case MessageType.HealthCheckTimeout:
        if(!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)

        console.log(
          `Node #${this.id} (time=${this.localTime}) timed out health checks. ${
            this.ongoingHealthChecks.length
          } ongoing health checks are unanswered.`
        )

        for (const unansweredHealthCheck of this.ongoingHealthChecks) {
          console.log(
            `Node #${unansweredHealthCheck} did not answer the health check, triggering recovery procedure...`
          )
          // Multicasting to a group of the backup list
          const multicastTargets = this.backupList
            .sort(() => generator() - 0.5)
            .slice(0, MULTICAST_SIZE)
          for (const backup of multicastTargets) {
            messages.push(
              new Message(
                MessageType.ContactBackup,
                this.localTime,
                0, // ASAP
                this.id,
                backup,
                {
                  failedNode: unansweredHealthCheck,
                  targetGroup: this.node.children.filter(e =>
                    e.members.includes(unansweredHealthCheck)
                  )[0]
                }
              )
            )
          }

          const remainingBackups = this.backupList.filter(e =>
            multicastTargets.includes(e)
          )
          if (remainingBackups.length > 0) {
            // Reschedule a multicast if there are other backups available and the previously contacted ones didn't answer
            this.continueMulticast = true
            messages.push(
              new Message(
                MessageType.ContinueMulticast,
                this.localTime,
                this.localTime + 2 * MAX_LATENCY,
                this.id,
                this.id,
                {
                  remainingBackups
                }
              )
            )
          }
        }

        this.ongoingHealthChecks = [] // All children have been handled
        break
      case MessageType.ContinueMulticast:
        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) tries to continue multicasting to backup`
        )
        break
      case MessageType.ContactBackup:
        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) has been contacted to become a backup by node #${receivedMessage.emitterId}`
        )

        if (this.node || this.contactedAsABackup) {
          messages.push(
            new Message(
              MessageType.BackupResponse,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                backupIsAvailable: false
              }
            )
          )
        } else {
          // The backup is available
          this.contactedAsABackup = true
          this.node = receivedMessage.content.targetGroup
          messages.push(
            new Message(
              MessageType.BackupResponse,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                backupIsAvailable: true,
                failedNode: receivedMessage.content.failedNode,
                targetGroup: receivedMessage.content.targetGroup
              }
            )
          )

          // TODO: Schedule a timeout to allow this node to be contacted as a backup again if the node who contacted it fails before telling it it's not used as a backup

          // Start querying members
        }
        break
      case MessageType.BackupResponse:
        if(!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)

        console.log(
          `Node #${this.id} (time=${this.localTime}) received a ${
            receivedMessage.content.backupIsAvailable ? 'positive' : 'negative'
          } response from backup ${receivedMessage.emitterId}`
        )

        if (receivedMessage.content.backupIsAvailable && this.continueMulticast) {
          this.continueMulticast = false

          const child = this.node.children.filter(e =>
            e.members.includes(receivedMessage.content.failedNode!)
          )[0]
          const failedPosition = child.members.indexOf(
            receivedMessage.content.failedNode!
          )

          // Update child group
          child.members[failedPosition] = receivedMessage.emitterId
          child.id = child.members[0]

          messages.push(
            new Message(
              MessageType.ConfirmBackup,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                usedAsBackup: true,
                targetGroup: child
              }
            )
          )
        } else {
          // Tell the backup it's not needed
          messages.push(
            new Message(
              MessageType.ConfirmBackup,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                usedAsBackup: false
              }
            )
          )
        }
        break
      case MessageType.ConfirmBackup:
        console.log(
          `Node #${this.id} (time=${this.localTime}) received a ${
            receivedMessage.content.usedAsBackup ? 'positive' : 'negative'
          } response from the parent`
        )

        if(receivedMessage.content.usedAsBackup) {
          this.node = receivedMessage.content.targetGroup
          this.node!.children = []

          // Contact its members to know the children
          for(const member of this.node!.members.filter(m => m !== this.id)) {
            messages.push(
              new Message(
                MessageType.NotifyGroup,
                this.localTime,
                0, // ASAP
                this.id,
                member,
                {
                  newMembers: this.node?.members
                }
              )
            )
          }
        } else {
          this.contactedAsABackup = false
          delete this.node
        }
        break
      case MessageType.NotifyGroup:
        console.log(
          `Node #${this.id} (time=${this.localTime}) has been contacted by a member to know its children`
        )

        this.node!.members = receivedMessage.content.newMembers!
        messages.push(
          new Message(
            MessageType.SendChildren,
            this.localTime,
            0, // ASAP
            this.id,
            receivedMessage.emitterId,
            {
              children: this.node?.children,
              role: this.role
            }
          )
        )
        break
      case MessageType.SendChildren:
        console.log(
          `Node #${this.id} (time=${this.localTime}) has been notified of new children`
        )

        if(receivedMessage.content.children !== this.node?.children) {
          this.node!.children = receivedMessage.content.children!
          this.role = receivedMessage.content.role!

          // Resume the aggregation by asking for data and checking health
          for(const child of this.node!.children) {
            if(this.role === NodeRole.LeafAggregator) {
              // Query all contributors
              // TODO: Children should not be in the tree
              for(const member of child.members) {
                messages.push(
                  new Message(
                    MessageType.RequestData,
                    this.localTime,
                    0, // ASAP
                    this.id,
                    member,
                    {}
                  )
                )
              }
            } else {
              messages.push(
                new Message(
                  MessageType.RequestData,
                  this.localTime,
                  0, // ASAP
                  this.id,
                  child.members[position!],
                  {}
                )
              )
            }
          }
        }
        break
      case MessageType.RequestData:
        console.log(
          `Node #${this.id} (time=${this.localTime}) has been requested data by a backup joining the tree`
        )
        if(this.role === NodeRole.Contributor) {
          messages.push(
            new Message(
              MessageType.SendContribution,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              { share: this.shares[this.node!.parents.indexOf(receivedMessage.emitterId)] }
            )
          )
        } else if(this.role === NodeRole.LeafAggregator) {
          messages.push(
            new Message(
              MessageType.SendAggregate,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                aggregate: {
                  counter: this.contributorsList[0].length,
                  data: Object.values(this.contributions).reduce(
                    (prev, curr) => prev + curr
                  )
                }
              }
            )
          )
        } else {
          messages.push(
            new Message(
              MessageType.SendAggregate,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                aggregate: this.aggregates.reduce((prev, curr) => ({
                  counter: prev.counter + curr.counter,
                  data: prev.data + curr.data
                }))
              }
            )
          )
        }
        break
      default:
        throw new Error('Receiving unknown message type')
    }

    return messages
  }
}

export default Node
