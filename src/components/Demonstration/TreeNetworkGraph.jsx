import React, { useRef, useEffect, useState, useMemo } from 'react'
import * as d3 from 'd3'

const drag = simulation => {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }

  function dragged(event, d) {
    d.fx = event.x
    d.fy = event.y
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0)
    d.fx = null
    d.fy = null
  }

  return d3
    .drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended)
}

function TreeNetworkGraph({
  nodes,
  edges,
  width,
  height,
  onNodeClick = () => {}
}) {
  const nodeRadius = 12
  const ref = useRef()
  const [hoveredNode, setHoveredNode] = useState()
  const [hoveredEdge, setHoveredEdge] = useState()
  const simulationRef = useRef(
    d3
      .forceSimulation()
      .force(
        'link',
        d3
          .forceLink()
          .id(d => `${d.nodeId}`)
          .strength(0.4)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('x', d3.forceX())
      .force(
        'y',
        d3
          .forceY()
          .y(d => {
            return (d.level / depth - 0.5) * 0.8 * height
          })
          .strength(0.8)
      )
  ).current
  const depth = useMemo(() => Math.max(...nodes.map(e => e.level)), [nodes])

  useEffect(() => {
    const svg = d3
      .select(ref.current)
      .attr('viewBox', [-width / 2, -height / 2, width, height])
      .attr('width', width)
      .attr('height', height)

    if (svg.selectAll('.edges').empty()) {
      svg.append('g').classed('edges', true)
    }
    if (svg.selectAll('.nodes').empty()) {
      svg.append('g').classed('nodes', true)
    }
    if (svg.selectAll('.labels').empty()) {
      svg.append('g').classed('labels', true)
    }

    svg
      .selectAll('.edges')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
    svg
      .selectAll('.edges')
      .selectAll('line')
      .data(edges)
      .exit()
      .remove('line')
    let link = svg.selectAll('.edges').selectAll('line')
    link
      .on('mouseover', function(_, edge) {
        setHoveredEdge(edge)
      })
      .on('mouseout', function() {
        setHoveredEdge()
      })
      .call(d3.zoom().transform, d3.zoomIdentity)
      .attr('stroke', '#999')
      .attr('stroke-opacity', e => (e.activeEdge ? 1 : 0.6))
      .attr('stroke-width', e => (e.activeEdge ? 3 : 1))

    svg
      .selectAll('.nodes')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
    svg
      .selectAll('.nodes')
      .selectAll('circle')
      .data(nodes)
      .exit()
      .remove('circle')
    let node = svg.selectAll('.nodes').selectAll('circle')

    node
      .call(drag(simulationRef))
      .on('click', onNodeClick)
      .on('mouseover', function(_, node) {
        setHoveredNode(node)
      })
      .on('mouseout', function() {
        setHoveredNode()
      })
      .attr('r', nodeRadius)
      .attr('fill', n => {
        switch (n.role) {
          case 'Contributor':
            return 'red'
          case 'Leaf':
            return 'green'
          case 'Aggregator':
            return 'magenta'
          case 'Querier':
            return 'blue'
        }
      })
      .attr('stroke', n => {
        return n.startedWorking
          ? n.finishedWorking
            ? 'darkgreen'
            : 'darkred'
          : 'black'
      })
      .attr('mask', n =>
        n.startedWorking && !n.finishedWorking ? 'url(#workMask)' : undefined
      )

    svg
      .selectAll('.labels')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
    svg
      .selectAll('.labels')
      .selectAll('text')
      .data(nodes)
      .exit()
      .remove('text')
    let label = svg.selectAll('.labels').selectAll('text')
    label
      .text(d => `${d.label}`)
      .style('font-size', 'xx-small')
      .style('font-weight', 'bold')
      .style('display', d =>
        d.nodeId === hoveredNode?.nodeId ? 'block' : 'none'
      )

    function zoomed({ transform }) {
      link.attr('transform', () => `scale(${transform.k})`)
      node.attr('transform', () => `scale(${transform.k})`)
      label.attr('transform', () => `scale(${transform.k})`)
    }

    svg.call(
      d3
        .zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([0, 10])
        .on('zoom', zoomed)
    )

    simulationRef.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)
      node.attr('cx', d => d.x).attr('cy', d => d.y)
      label.attr('dx', d => d.x + nodeRadius).attr('dy', d => d.y)
    })
  }, [
    depth,
    edges,
    height,
    hoveredNode,
    nodes,
    onNodeClick,
    ref,
    simulationRef,
    width
  ])

  useEffect(() => {
    simulationRef.nodes(nodes)
    simulationRef.force('link').links(edges)
    simulationRef.force(
      'y',
      d3
        .forceY()
        .y(d => {
          return (d.level / depth - 0.5) * 0.8 * height
        })
        .strength(0.8)
    )
    // simulationRef.alpha(1).restart()
  }, [depth, edges, height, nodes, simulationRef])

  return (
    <svg ref={ref} className="demonstration-frame">
      {hoveredNode ? (
        <text x={-width / 2} y={-height / 2 + 2} fontSize="12" dy="0">
          <tspan x={-width / 2} dy=".6em">
            {hoveredNode.nodeId}
          </tspan>
          <tspan x={-width / 2} dy="1.2em">
            Started working: {String(hoveredNode.startedWorking)}
          </tspan>
          <tspan x={-width / 2} dy="1.2em">
            Finished working: {String(hoveredNode.finishedWorking)}
          </tspan>
        </text>
      ) : null}
      {hoveredEdge ? (
        <text x={-width / 2} y={-height / 2 + 2} fontSize="12" dy="0">
          <tspan x={-width / 2} dy=".6em">
            Source: {hoveredEdge.source.label}
          </tspan>
          <tspan x={-width / 2} dy="1.2em">
            Target: {hoveredEdge.target.label}
          </tspan>
          <tspan x={-width / 2} dy="1.2em">
            Active: {String(hoveredEdge.activeEdge)}
          </tspan>
        </text>
      ) : null}
      <mask id="workMask" maskContentUnits="objectBoundingBox">
        <rect fill="white" x="-50%" y="-50%" width="150%" height="150%" />
        <polygon
          fill="black"
          width="100%"
          height="100%"
          points="0.5,0.2 0.68,0.74 0.21,0.41 0.79,0.41 0.32,0.74"
        />
      </mask>
    </svg>
  )
}

export default TreeNetworkGraph
