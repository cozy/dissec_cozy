import React from 'react'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell
} from 'cozy-ui/transpiled/react/Table'

const cellStyles = {
  flexGrow: 1
}

const CheckCircle = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="green"
    style={{ width: '32px', height: '32px' }}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
    />
  </svg>
)
const NoSymbol = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="red"
    style={{ width: '32px', height: '32px' }}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
    />
  </svg>
)

function NodesTable({ nodes, hoveredNode }) {
  const sortedNodes = nodes.sort((a, b) => {
    const weight = node => {
      switch (node.role) {
        case 'Querier':
          return 0
        case 'Contributor':
          return 1
        default:
          return 2
      }
    }

    return weight(a) - weight(b)
  })

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader style={cellStyles}>Domain</TableHeader>
          <TableHeader style={cellStyles}>Role</TableHeader>
          <TableHeader style={cellStyles}>Node ID</TableHeader>
          <TableHeader style={cellStyles}>Started working</TableHeader>
          <TableHeader style={cellStyles}>Finished working</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {sortedNodes.map(node => (
          <TableRow
            key={node.nodeId}
            style={{
              backgroundColor:
                node?.nodeId === hoveredNode?.nodeId ? '#7F7F7F' : '#FFFFFF'
            }}
          >
            <TableCell style={cellStyles}>{node.label}</TableCell>
            <TableCell style={cellStyles}>
              {(role => {
                switch (role) {
                  case 'Querier':
                    return 'Final Aggregator'
                  case 'Leaf':
                    return 'Aggregator'
                  default:
                    return role
                }
              })(node.role)}
            </TableCell>
            <TableCell style={cellStyles}>
              {node.nodeId.slice(0, 7) + '...'}
            </TableCell>
            <TableCell style={cellStyles}>
              {node.startedWorking ? <CheckCircle /> : <NoSymbol />}
            </TableCell>
            <TableCell style={cellStyles}>
              {node.finishedWorking ? <CheckCircle /> : <NoSymbol />}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default NodesTable
