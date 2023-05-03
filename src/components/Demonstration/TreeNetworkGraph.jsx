import React, { useRef, useEffect } from 'react'
import * as d3 from 'd3'

function TreeNetworkGraph({ data, width, height, onNodeClick = () => {} }) {
  const ref = useRef()

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

  useEffect(() => {
    const nodes = data.nodes.map(e => ({ ...e, id: e.nodeId }))
    const edges = data.edges

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(edges)
          .id(d => `${d.nodeId}`)
          .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-10))
      .force('x', d3.forceX())
      .force('y', d3.forceY())

    const svg = d3
      .select(ref.current)
      .attr('viewBox', [-width / 2, -height / 2, width, height])
      .attr('width', width)
      .attr('height', height)

    svg.selectAll('g').remove()

    const link = svg
      .append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)

    const node = svg
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(drag(simulation))
      .on('click', onNodeClick)

    const circles = node.append('circle').attr('r', 3.5)

    const label = node
      .append('text')
      .text(d => `${d.label}`)
      .style('font-size', 'xx-small')

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)

      circles.attr('cx', d => d.x).attr('cy', d => d.y)
      label.attr('dx', d => d.x).attr('dy', d => d.y)
    })
  }, [data, height, onNodeClick, width, ref])

  return <svg ref={ref} />
}

export default TreeNetworkGraph