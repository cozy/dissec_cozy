import React, { useRef, useEffect, useMemo } from 'react'
import * as d3 from 'd3'
import { useQuery } from 'cozy-client'
import { recentObservationsQuery } from 'lib/queries'

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

function TreeNetworkGraph({ data, width, height, onNodeClick = () => {} }) {
  const ref = useRef()
  const simulationRef = useRef(
    d3
      .forceSimulation()
      .force(
        'link',
        d3
          .forceLink()
          .id(d => `${d.nodeId}`)
          .strength(0.5)
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
  const depth = useMemo(() => Math.max(...data.nodes.map(e => e.level)), [
    data.nodes
  ])
  const executionId = useMemo(() => data?.nodes[0]?.executionId, [data])
  const query = recentObservationsQuery(executionId)
  const { data: observations } = useQuery(query.definition, query.options)
  const [nodes, edges] = useMemo(() => {
    return [
      data.nodes.map(e => ({ ...e, id: e.nodeId })),
      data.edges.map(e => ({
        ...e,
        activeEdge: !!observations
          ?.filter(o => o.action !== 'receiveShare')
          ?.find(o => o.receiverId === e.target && o.emitterId === e.source)
      }))
    ]
  }, [data.edges, data.nodes, observations])
  console.log('TreeNet', observations, nodes.map(e => e.nodeId), edges)

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

    let link = svg.selectAll('.edges').selectAll('line')
    if (link.empty()) {
      link = svg
        .selectAll('.edges')
        .selectAll('line')
        .call(d3.zoom().transform, d3.zoomIdentity)
        .data(edges)
        .enter()
        .append('line')
    }
    link
      .data(edges)
      .call(d3.zoom().transform, d3.zoomIdentity)
      .attr('stroke', '#999')
      .attr('stroke-opacity', e => (e.activeEdge ? 1 : 0.6))
      .attr('stroke-width', e => (e.activeEdge ? 5 : 1))

    let node = svg.selectAll('.nodes').selectAll('.node')
    if (node.empty()) {
      node = svg
        .selectAll('.nodes')
        .selectAll('.node')
        .data(nodes)
        .enter()
        .append('g')
        .classed('node', true)

      node
        .append('circle')
        .call(drag(simulationRef))
        .on('click', onNodeClick)
        .attr('r', 3.5)
        .attr('fill', node =>
          node.children.length !== 0
            ? node.parents.length > 0
              ? 'green'
              : 'blue'
            : 'red'
        )
        .attr('stroke', node =>
          node.children.length !== 0
            ? node.parents.length > 0
              ? 'darkgreen'
              : 'darkblue'
            : 'darkred'
        )

      node
        .append('text')
        .text(d => `${d.label}`)
        .style('font-size', 'xx-small')
    }

    const circle = node
      .selectAll('circle')
      .call(drag(simulationRef))
      .on('click', onNodeClick)
      .attr('r', 3.5)
      .attr('fill', node =>
        node.children.length !== 0
          ? node.parents.length > 0
            ? 'green'
            : 'blue'
          : 'red'
      )
      .attr('stroke', node =>
        node.children.length !== 0
          ? node.parents.length > 0
            ? 'darkgreen'
            : 'darkblue'
          : 'darkred'
      )
    const label = node
      .selectAll('text')
      .text(d => `${d.label}`)
      .style('font-size', 'xx-small')

    function zoomed({ transform }) {
      node.attr('transform', () => `scale(${transform.k})`)
      link.attr('transform', () => `scale(${transform.k})`)
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

      circle.attr('cx', d => d.x).attr('cy', d => d.y)
      label.attr('dx', d => d.x).attr('dy', d => d.y)
    })
  }, [
    depth,
    edges,
    height,
    nodes,
    observations,
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
    simulationRef.alpha(1).restart()
  }, [depth, edges, height, nodes, observations, simulationRef])

  return <svg ref={ref} className="demonstration-frame" />
}

export default TreeNetworkGraph
