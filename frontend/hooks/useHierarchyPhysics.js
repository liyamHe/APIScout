/**
 * useHierarchyPhysics.js
 * Custom hook for D3 force-directed physics visualization
 * Handles node positioning, collision, orthogonal routing, and state reconciliation
 */

// This hook encapsulates the physics simulation logic
// USAGE: const { svgRef, selectedNode, setSelectedNode } = useHierarchyPhysics(graphData, hostname);

function useHierarchyPhysics(graphData, hostname) {
  const svgRef = React.useRef(null);
  const simulationRef = React.useRef(null);
  const [selectedNode, setSelectedNode] = React.useState(null);
  const lastGraphDataRef = React.useRef(null);
  const nodePositionsRef = React.useRef(new Map());
  const refreshTimeoutRef = React.useRef(null);
  
  // Orthogonal (Manhattan) path generator for links
  const orthogonalPath = (d) => {
    const x0 = d.source.x || 0;
    const y0 = d.source.y || 0;
    const x1 = d.target.x || 0;
    const y1 = d.target.y || 0;
    
    // Simple Manhattan routing: go vertical first, then horizontal
    const midY = (y0 + y1) / 2;
    return `M${x0},${y0}L${x0},${midY}L${x1},${midY}L${x1},${y1}`;
  };
  
  // Calculate text-based node dimensions
  const getNodeDimensions = (d) => {
    const padding = 12;
    const textLength = (d.label || '').length;
    const width = Math.max(120, textLength * 6 + padding * 2);
    const height = 50;
    return { width, height };
  };
  
  const reheatSimulation = () => {
    if (simulationRef.current) {
      simulationRef.current.alpha(1).restart();
    }
  };
  
  const resetView = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          svg.select('g').attr('transform', event.transform);
        });
      
      // Reset zoom to identity
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    }
  };
  
  const unpinAll = () => {
    if (lastGraphDataRef.current) {
      lastGraphDataRef.current.nodes.forEach(n => {
        n.pinned = false;
        n.fx = null;
        n.fy = null;
      });
    }
    if (simulationRef.current) {
      simulationRef.current.alpha(1).restart();
    }
  };
  
  // Main effect: Initialize and update physics simulation
  React.useEffect(() => {
    // Debounce rapid refreshes
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    
    refreshTimeoutRef.current = setTimeout(() => {
      if (!svgRef.current || graphData.nodes.length === 0) return;
      
      const width = 1200;
      const height = 800;
      const depthSpacing = 120;
      
      const isFirstRender = !simulationRef.current;
      
      const getTargetY = (d) => 80 + d.depth * depthSpacing;
      
      if (isFirstRender) {
        // FIRST RENDER: Initialize from scratch
        d3.select(svgRef.current).selectAll('*').remove();
        
        const svg = d3.select(svgRef.current)
          .attr('width', width)
          .attr('height', height)
          .attr('viewBox', [0, 0, width, height]);
        
        const g = svg.append('g');
        
        const zoom = d3.zoom()
          .scaleExtent([0.1, 4])
          .on('zoom', (event) => g.attr('transform', event.transform));
        
        svg.call(zoom);
        
        // Set initial positions for all nodes
        graphData.nodes.forEach(n => {
          n.x = width / 2 + (Math.random() - 0.5) * 200;
          n.y = getTargetY(n);
        });
        
        // Create force simulation
        const simulation = d3.forceSimulation(graphData.nodes)
          .force('link', d3.forceLink(graphData.links)
            .id(d => d.id)
            .distance(80)
            .strength(0.7))
          .force('charge', d3.forceManyBody()
            .strength(d => -400 - d.depth * 120))
          .force('y', d3.forceY(d => getTargetY(d))
            .strength(d => 0.3 + d.depth * 0.08))
          .force('x', d3.forceX(width / 2)
            .strength(d => d.isRoot ? 1.2 : 0.05))
          .force('collision', d3.forceCollide()
            .radius(d => {
              const dims = getNodeDimensions(d);
              return Math.max(dims.width, dims.height) / 2 + 10;
            })
            .strength(1.0));
        
        simulationRef.current = simulation;
        
        // Links container
        g.append('g').attr('class', 'links');
        // Nodes container
        g.append('g').attr('class', 'nodes');
        
        // Initial link rendering
        const linkInit = g.select('.links')
          .selectAll('path')
          .data(graphData.links, d => `${d.source.id}-${d.target.id}`)
          .join('path')
          .attr('fill', 'none')
          .attr('stroke', '#00D9FF')
          .attr('stroke-opacity', 0.5)
          .attr('stroke-width', 2);
        
        // Initial node rendering with rectangular shapes
        const nodeInit = g.select('.nodes')
          .selectAll('g')
          .data(graphData.nodes, d => d.id)
          .join('g')
          .style('cursor', 'pointer')
          .call(d3.drag()
            .on('start', (event, d) => {
              if (!event.active) simulation.alphaTarget(0.5).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on('drag', (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on('end', (event, d) => {
              if (!event.active) simulation.alphaTarget(0);
              if (!d.pinned) {
                d.fx = null;
                d.fy = null;
              }
            }))
          .on('click', (event, d) => {
            event.stopPropagation();
            setSelectedNode(d);
          })
          .on('dblclick', (event, d) => {
            event.stopPropagation();
            d.pinned = !d.pinned;
            if (d.pinned) {
              d.fx = d.x;
              d.fy = d.y;
              d3.select(event.currentTarget).select('rect')
                .attr('stroke', '#39FF14')
                .attr('stroke-width', 3.5);
            } else {
              d.fx = null;
              d.fy = null;
              d3.select(event.currentTarget).select('rect')
                .attr('stroke', d.isRoot ? '#FF10F0' : '#00D9FF')
                .attr('stroke-width', 2.5);
            }
          });
        
        // Add rectangles
        nodeInit.append('rect')
          .attr('width', d => getNodeDimensions(d).width)
          .attr('height', d => getNodeDimensions(d).height)
          .attr('x', d => -getNodeDimensions(d).width / 2)
          .attr('y', d => -getNodeDimensions(d).height / 2)
          .attr('rx', 4)
          .attr('fill', d => d.isRoot ? '#FF006E' : '#1a1f3a')
          .attr('stroke', d => d.isRoot ? '#FF10F0' : '#00D9FF')
          .attr('stroke-width', 2.5)
          .style('filter', 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))');
        
        // Add text labels inside nodes
        nodeInit.append('text')
          .attr('dy', '0.32em')
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .attr('fill', d => d.isRoot ? '#FFB000' : '#00FF88')
          .attr('pointer-events', 'none')
          .style('user-select', 'none')
          .text(d => d.label);
        
        // Add method indicator squares
        nodeInit.each(function(d) {
          if (d.methods && d.methods.length > 0) {
            const methodGroup = d3.select(this).append('g').attr('class', 'method-indicators');
            const dims = getNodeDimensions(d);
            const methodSize = 5;
            const padding = 3;
            const startX = dims.width / 2 - methodSize - padding;
            const startY = dims.height / 2 - methodSize - padding;
            
            const getMethodColor = (method) => {
              const colorMap = {
                'GET': '#00FF88',
                'POST': '#FF006E',
                'PUT': '#FFB000',
                'DELETE': '#FF0080',
                'PATCH': '#00D9FF'
              };
              return colorMap[method] || '#00D9FF';
            };
            
            d.methods.slice(0, 2).forEach((method, i) => {
              methodGroup.append('rect')
                .attr('x', startX - i * (methodSize + padding))
                .attr('y', startY)
                .attr('width', methodSize)
                .attr('height', methodSize)
                .attr('fill', getMethodColor(method))
                .attr('rx', 1)
                .style('filter', `drop-shadow(0 0 4px ${getMethodColor(method)})`);
            });
          }
        });
        
        simulation.on('tick', () => {
          // Orthogonal routing
          linkInit.attr('d', orthogonalPath);
          
          // Update node positions
          const nodes = g.select('.nodes').selectAll('g');
          nodes.attr('transform', d => `translate(${d.x},${d.y})`);
          
          // Stop simulation after it settles to save CPU/memory
          if (simulation.alpha() < 0.01) {
            simulation.stop();
          }
        });
        
        svg.on('click', () => setSelectedNode(null));
      } else {
        // RECONCILIATION UPDATE: Modify existing simulation
        const simulation = simulationRef.current;
        const svg = d3.select(svgRef.current);
        const g = svg.select('g');
        
        // Reconcile nodes: preserve positions
        const lastNodeMap = new Map();
        if (lastGraphDataRef.current) {
          lastGraphDataRef.current.nodes.forEach(n => {
            lastNodeMap.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy, pinned: n.pinned, fx: n.fx, fy: n.fy });
          });
        }
        
        graphData.nodes.forEach(newNode => {
          const existingNode = lastNodeMap.get(newNode.id);
          if (existingNode && existingNode.x !== undefined) {
            newNode.x = existingNode.x;
            newNode.y = existingNode.y;
            newNode.vx = existingNode.vx || 0;
            newNode.vy = existingNode.vy || 0;
            newNode.pinned = existingNode.pinned;
            newNode.fx = existingNode.fx;
            newNode.fy = existingNode.fy;
          } else {
            // New node: spawn near parent
            const parentLink = graphData.links.find(l => l.target === newNode.id || l.target.id === newNode.id);
            if (parentLink) {
              const parentNode = graphData.nodes.find(n => n.id === parentLink.source || n.id === parentLink.source.id);
              if (parentNode && parentNode.x !== undefined) {
                newNode.x = parentNode.x + (Math.random() - 0.5) * 100;
                newNode.y = parentNode.y + 80;
              }
            }
            if (!newNode.x) {
              newNode.x = width / 2;
              newNode.y = getTargetY(newNode);
            }
          }
        });
        
        // Update links
        const link = g.select('.links')
          .selectAll('path')
          .data(graphData.links, d => `${d.source.id}-${d.target.id}`)
          .join(
            enter => enter.append('path')
              .attr('fill', 'none')
              .attr('stroke', '#00D9FF')
              .attr('stroke-opacity', 0.5)
              .attr('stroke-width', 2),
            update => update,
            exit => exit.remove()
          );
        
        // Update nodes
        const nodeSelection = g.select('.nodes')
          .selectAll('g')
          .data(graphData.nodes, d => d.id);
        
        nodeSelection.exit()
          .transition()
          .duration(300)
          .style('opacity', 0)
          .remove();
        
        nodeSelection.each(function(d) {
          const existing = d3.select(this);
          const dims = getNodeDimensions(d);
          
          existing.select('rect')
            .attr('width', dims.width)
            .attr('height', dims.height)
            .attr('x', -dims.width / 2)
            .attr('y', -dims.height / 2)
            .attr('fill', d.isRoot ? '#FF006E' : '#1a1f3a')
            .attr('stroke', d.isRoot ? '#FF10F0' : '#00D9FF');
          
          existing.select('text').text(d => d.label);
        });
        
        const nodeEnter = nodeSelection.enter()
          .append('g')
          .style('opacity', 0)
          .style('cursor', 'pointer')
          .call(d3.drag()
            .on('start', (event, d) => {
              if (!event.active) simulation.alphaTarget(0.5).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on('drag', (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on('end', (event, d) => {
              if (!event.active) simulation.alphaTarget(0);
              if (!d.pinned) {
                d.fx = null;
                d.fy = null;
              }
            }))
          .on('click', (event, d) => {
            event.stopPropagation();
            setSelectedNode(d);
          })
          .on('dblclick', (event, d) => {
            event.stopPropagation();
            d.pinned = !d.pinned;
            if (d.pinned) {
              d.fx = d.x;
              d.fy = d.y;
              d3.select(event.currentTarget).select('rect')
                .attr('stroke', '#39FF14')
                .attr('stroke-width', 3.5);
            } else {
              d.fx = null;
              d.fy = null;
              d3.select(event.currentTarget).select('rect')
                .attr('stroke', d.isRoot ? '#FF10F0' : '#00D9FF')
                .attr('stroke-width', 2.5);
            }
          });
        
        nodeEnter.append('rect')
          .attr('width', d => getNodeDimensions(d).width)
          .attr('height', d => getNodeDimensions(d).height)
          .attr('x', d => -getNodeDimensions(d).width / 2)
          .attr('y', d => -getNodeDimensions(d).height / 2)
          .attr('rx', 4)
          .attr('fill', d => d.isRoot ? '#FF006E' : '#1a1f3a')
          .attr('stroke', d => d.isRoot ? '#FF10F0' : '#00D9FF')
          .attr('stroke-width', 2.5)
          .style('filter', 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))');
        
        nodeEnter.append('text')
          .attr('dy', '0.32em')
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .attr('fill', d => d.isRoot ? '#FFB000' : '#00FF88')
          .attr('pointer-events', 'none')
          .style('user-select', 'none')
          .text(d => d.label);
        
        const getMethodColor = (method) => {
          const colorMap = {
            'GET': '#00FF88',
            'POST': '#FF006E',
            'PUT': '#FFB000',
            'DELETE': '#FF0080',
            'PATCH': '#00D9FF'
          };
          return colorMap[method] || '#00D9FF';
        };
        
        nodeEnter.each(function(d) {
          if (d.methods && d.methods.length > 0) {
            const methodGroup = d3.select(this).append('g').attr('class', 'method-indicators');
            const dims = getNodeDimensions(d);
            const methodSize = 5;
            const padding = 3;
            const startX = dims.width / 2 - methodSize - padding;
            const startY = dims.height / 2 - methodSize - padding;
            
            d.methods.slice(0, 2).forEach((method, i) => {
              methodGroup.append('rect')
                .attr('x', startX - i * (methodSize + padding))
                .attr('y', startY)
                .attr('width', methodSize)
                .attr('height', methodSize)
                .attr('fill', getMethodColor(method))
                .attr('rx', 1)
                .style('filter', `drop-shadow(0 0 4px ${getMethodColor(method)})`);
            });
          }
        });
        
        nodeEnter.transition().duration(300).style('opacity', 1);
        
        // Warm re-heat instead of full restart
        simulation.nodes(graphData.nodes);
        simulation.force('link').links(graphData.links);
        simulation.alpha(0.3).restart();
        
        // Update tick handler to use current links
        simulation.on('tick', () => {
          g.select('.links').selectAll('path').attr('d', orthogonalPath);
          g.select('.nodes').selectAll('g').attr('transform', d => `translate(${d.x},${d.y})`);
        });
        
        // Auto-stop after settling
        setTimeout(() => {
          if (simulation.alpha() < 0.05) {
            simulation.stop();
          }
        }, 5000);
      }
      
      lastGraphDataRef.current = graphData;
    }, 500); // Debounce 500ms
    
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [graphData]);
  
  // Cleanup simulation on unmount
  React.useEffect(() => {
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      if (svgRef.current) {
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();
        svg.on('.zoom', null);
        svg.on('click', null);
      }
    };
  }, []);
  
  return {
    svgRef,
    selectedNode,
    setSelectedNode,
    resetView,
    unpinAll,
    reheatSimulation
  };
}
