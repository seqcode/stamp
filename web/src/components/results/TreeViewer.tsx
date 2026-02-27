"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as d3 from "d3";
import { Button } from "@/components/ui/Button";

interface TreeViewerProps {
  newick: string;
}

interface TreeNode {
  name: string;
  branchLength: number;
  children?: TreeNode[];
  _children?: TreeNode[];
}

/**
 * Parse a Newick format string into a tree structure.
 */
function parseNewick(str: string): TreeNode {
  const s = str.trim().replace(/;$/, "");
  let i = 0;

  function parseNode(): TreeNode {
    const node: TreeNode = { name: "", branchLength: 0 };

    if (s[i] === "(") {
      i++; // skip (
      node.children = [];
      node.children.push(parseNode());
      while (s[i] === ",") {
        i++; // skip ,
        node.children.push(parseNode());
      }
      i++; // skip )
    }

    // Parse name
    let name = "";
    while (i < s.length && s[i] !== ":" && s[i] !== "," && s[i] !== ")" && s[i] !== ";") {
      name += s[i];
      i++;
    }
    node.name = name.trim();

    // Parse branch length
    if (s[i] === ":") {
      i++; // skip :
      let len = "";
      while (i < s.length && s[i] !== "," && s[i] !== ")" && s[i] !== ";") {
        len += s[i];
        i++;
      }
      node.branchLength = parseFloat(len) || 0;
    }

    return node;
  }

  return parseNode();
}

export function TreeViewer({ newick }: TreeViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const treeDataRef = useRef<TreeNode | null>(null);

  // Parse tree once and store in ref
  useEffect(() => {
    if (newick) {
      treeDataRef.current = parseNewick(newick);
    }
  }, [newick]);

  const renderTree = useCallback(() => {
    if (!svgRef.current || !treeDataRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const tree = treeDataRef.current;

    // d3.hierarchy accessor respects collapsed state (only returns children, not _children)
    const root = d3.hierarchy(tree, (d: TreeNode) => d.children);
    const leafCount = root.leaves().length;

    const margin = { top: 20, right: 200, bottom: 20, left: 20 };
    const height = Math.max(400, leafCount * 30);
    const width = dimensions.width;
    setDimensions((d) => ({ ...d, height }));

    const treeLayout = d3
      .cluster<TreeNode>()
      .size([height - margin.top - margin.bottom, width - margin.left - margin.right]);

    treeLayout(root);

    // Add zoom behavior
    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 5]).on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(margin.left, margin.top));

    // Draw links (right-angle elbow)
    g.selectAll(".link")
      .data(root.links())
      .join("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#999")
      .attr("stroke-width", 1.5)
      .attr("d", (d) => {
        return `M${d.source.y},${d.source.x}H${d.target.y}V${d.target.x}`;
      });

    // Draw all nodes
    const allNodes = root.descendants();
    const nodes = g
      .selectAll(".node")
      .data(allNodes)
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.y},${d.x})`);

    // Node circles
    nodes
      .append("circle")
      .attr("r", (d) => {
        if (d.data._children) return 5; // collapsed node
        if (d.children) return 3; // internal node
        return 4; // leaf node
      })
      .attr("fill", (d) => {
        if (d.data._children) return "#ff7f0e"; // collapsed = orange
        if (d.children) return "#999"; // internal
        return "#0074c6"; // leaf
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    // Leaf labels
    nodes
      .filter((d) => !d.children && !d.data._children)
      .append("text")
      .attr("x", 8)
      .attr("dy", "0.35em")
      .attr("font-size", "12px")
      .attr("fill", "#333")
      .text((d) => d.data.name);

    // Collapsed node labels
    nodes
      .filter((d) => !!d.data._children)
      .append("text")
      .attr("x", 8)
      .attr("dy", "0.35em")
      .attr("font-size", "11px")
      .attr("fill", "#ff7f0e")
      .attr("font-style", "italic")
      .text((d) => {
        const count = d.data._children?.length || 0;
        return `${d.data.name || "subtree"} (${count} collapsed)`;
      });

    // Click handler for collapsible nodes (have children OR _children)
    nodes
      .filter((d) => !!d.data.children || !!d.data._children)
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        if (d.data._children) {
          // Expand
          d.data.children = d.data._children;
          d.data._children = undefined;
        } else if (d.data.children) {
          // Collapse
          d.data._children = d.data.children;
          d.data.children = undefined;
        }
        renderTree();
      });
  }, [dimensions.width]);

  // Observe container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions((d) => ({ ...d, width: entry.contentRect.width }));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    renderTree();
  }, [renderTree]);

  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stamp-tree.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportNewick = () => {
    const blob = new Blob([newick], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stamp-tree.nwk";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div ref={containerRef}>
      <div className="flex gap-2 mb-3">
        <Button variant="ghost" size="sm" onClick={handleExportNewick}>
          Download Newick
        </Button>
        <Button variant="ghost" size="sm" onClick={handleExportSvg}>
          Download SVG
        </Button>
      </div>
      <div className="border border-gray-200 rounded-lg overflow-auto bg-white">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="block"
        />
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Scroll to zoom, drag to pan. Click internal nodes to collapse/expand.
      </p>
    </div>
  );
}
