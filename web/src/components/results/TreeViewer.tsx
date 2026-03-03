"use client";

import { useRef, useEffect, useState } from "react";
import { SequenceLogo } from "@/components/motif/SequenceLogo";
import { Button } from "@/components/ui/Button";
import type { MultipleAlignmentEntry } from "@/types";

interface TreeViewerProps {
  newick: string;
  alignment?: MultipleAlignmentEntry[];
  internalProfiles?: { name: string; id: number; matrix: number[][] }[];
}

interface TreeNode {
  name: string;
  branchLength: number;
  children?: TreeNode[];
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
      i++;
      node.children = [];
      node.children.push(parseNode());
      while (s[i] === ",") {
        i++;
        node.children.push(parseNode());
      }
      i++; // skip )
    }

    let name = "";
    while (i < s.length && s[i] !== ":" && s[i] !== "," && s[i] !== ")" && s[i] !== ";") {
      name += s[i];
      i++;
    }
    node.name = name.trim();

    if (s[i] === ":") {
      i++;
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

/**
 * Get all leaf nodes in left-to-right order.
 */
function getLeaves(node: TreeNode): TreeNode[] {
  if (!node.children || node.children.length === 0) return [node];
  const leaves: TreeNode[] = [];
  for (const child of node.children) {
    leaves.push(...getLeaves(child));
  }
  return leaves;
}

/**
 * Compute max depth (sum of branch lengths from root to deepest leaf).
 */
function getMaxDepth(node: TreeNode, uniform: boolean): number {
  if (!node.children || node.children.length === 0) return 0;
  const edgeLen = uniform ? 1 : undefined;
  return Math.max(
    ...node.children.map((c) => (edgeLen ?? c.branchLength) + getMaxDepth(c, uniform))
  );
}

interface LayoutNode {
  node: TreeNode;
  depthFromRoot: number; // cumulative branch-length distance from root
  y: number;            // vertical position (row index)
  isLeaf: boolean;
  children?: { layoutNode: LayoutNode; treeNode: TreeNode }[];
}

/**
 * Layout the tree. Returns an array of layout nodes with depth and y positions.
 * All leaves are forced to the same depth (maxDepth) for ultrametric display.
 * When `uniform` is true, every edge has length 1 (cladogram mode).
 */
function layoutTree(root: TreeNode, uniform: boolean): { nodes: LayoutNode[]; maxDepth: number } {
  const leaves = getLeaves(root);
  const maxDepth = getMaxDepth(root, uniform);
  const allNodes: LayoutNode[] = [];

  // Assign y positions to leaves (evenly spaced)
  const leafYMap = new Map<TreeNode, number>();
  leaves.forEach((leaf, i) => {
    leafYMap.set(leaf, i);
  });

  function layout(node: TreeNode, depthFromRoot: number): LayoutNode {
    if (!node.children || node.children.length === 0) {
      const y = leafYMap.get(node)!;
      const ln: LayoutNode = {
        node,
        depthFromRoot: maxDepth, // Force ultrametric: all leaves at maxDepth
        y,
        isLeaf: true,
      };
      allNodes.push(ln);
      return ln;
    }

    const childLayouts: { layoutNode: LayoutNode; treeNode: TreeNode }[] = [];
    for (const child of node.children) {
      const edgeLen = uniform ? 1 : child.branchLength;
      const childLayout = layout(child, depthFromRoot + edgeLen);
      childLayouts.push({ layoutNode: childLayout, treeNode: child });
    }

    const childYs = childLayouts.map((c) => c.layoutNode.y);
    const y = (Math.min(...childYs) + Math.max(...childYs)) / 2;

    const ln: LayoutNode = {
      node,
      depthFromRoot,
      y,
      isLeaf: false,
      children: childLayouts,
    };
    allNodes.push(ln);
    return ln;
  }

  layout(root, 0);
  return { nodes: allNodes, maxDepth };
}

export function TreeViewer({
  newick,
  alignment,
  internalProfiles,
}: TreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const [uniformBranches, setUniformBranches] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Parse tree
  const tree = parseNewick(newick);
  const { nodes: layoutNodes, maxDepth } = layoutTree(tree, uniformBranches);
  const leaves = getLeaves(tree);

  // Build lookup maps
  const alignmentMap = new Map<string, MultipleAlignmentEntry>();
  if (alignment) {
    for (const entry of alignment) {
      alignmentMap.set(entry.name, entry);
    }
  }

  const profileMap = new Map<string, number[][]>();
  if (internalProfiles) {
    for (const p of internalProfiles) {
      profileMap.set(p.name, p.matrix);
    }
  }

  // Layout constants
  const leafLogoHeight = 50;
  const leafLogoWidth = 200;
  const internalLogoHeight = 40;
  const internalLogoWidth = 120;
  const leafNameWidth = 100;
  const rowHeight = leafLogoHeight + 12; // logo + spacing
  const treeAreaWidth = Math.max(200, containerWidth - leafNameWidth - leafLogoWidth - 60);
  const leftMargin = leafNameWidth + leafLogoWidth + 20;
  const rightMargin = 40;
  const topMargin = 20;

  const totalHeight = leaves.length * rowHeight + topMargin * 2;
  const treeXScale = maxDepth > 0 ? treeAreaWidth / maxDepth : 1;

  // Convert depth-from-root to pixel x position.
  // Root (depth=0) is on the RIGHT, leaves (depth=maxDepth) on the LEFT.
  function nodeX(depthFromRoot: number): number {
    return leftMargin + treeAreaWidth - depthFromRoot * treeXScale;
  }

  function nodeY(yIndex: number): number {
    return topMargin + yIndex * rowHeight + rowHeight / 2;
  }

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

  // Build SVG paths for the tree branches using proper cladogram elbows:
  // For each internal node:
  //   1. Vertical bar at parent's x, spanning from min to max child y
  //   2. Horizontal line from parent's x to each child's x at the child's y
  const paths: { d: string }[] = [];
  for (const ln of layoutNodes) {
    if (!ln.isLeaf && ln.children) {
      const parentX = nodeX(ln.depthFromRoot);

      // Collect child positions
      const childPositions = ln.children.map((c) => ({
        x: nodeX(c.layoutNode.depthFromRoot),
        y: nodeY(c.layoutNode.y),
      }));

      const childYs = childPositions.map((c) => c.y);
      const minChildY = Math.min(...childYs);
      const maxChildY = Math.max(...childYs);

      // Vertical bar at parent x spanning children's y range
      paths.push({
        d: `M${parentX},${minChildY} V${maxChildY}`,
      });

      // Horizontal branch from parent x to each child's x at child's y
      for (const cp of childPositions) {
        paths.push({
          d: `M${parentX},${cp.y} H${cp.x}`,
        });
      }
    }
  }

  return (
    <div ref={containerRef}>
      <div className="flex gap-2 mb-3 items-center">
        <Button
          variant={uniformBranches ? "ghost" : "secondary"}
          size="sm"
          onClick={() => setUniformBranches(false)}
        >
          Actual Lengths
        </Button>
        <Button
          variant={uniformBranches ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setUniformBranches(true)}
        >
          Uniform Lengths
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={handleExportNewick}>
          Download Newick
        </Button>
        <Button variant="ghost" size="sm" onClick={handleExportSvg}>
          Download SVG
        </Button>
      </div>
      <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
        <div style={{ position: "relative", width: containerWidth, height: totalHeight }}>
          {/* SVG layer for tree branches */}
          <svg
            ref={svgRef}
            width={containerWidth}
            height={totalHeight}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            {paths.map((p, i) => (
              <path
                key={i}
                d={p.d}
                fill="none"
                stroke="#999"
                strokeWidth={1.5}
              />
            ))}

            {/* Node dots */}
            {layoutNodes.map((ln, i) => (
              <circle
                key={i}
                cx={nodeX(ln.depthFromRoot)}
                cy={nodeY(ln.y)}
                r={ln.isLeaf ? 3 : 4}
                fill={ln.isLeaf ? "#0074c6" : "#999"}
                stroke="#fff"
                strokeWidth={1}
              />
            ))}
          </svg>

          {/* HTML layer for leaf labels and logos */}
          {layoutNodes
            .filter((ln) => ln.isLeaf)
            .map((ln) => {
              const yPos = nodeY(ln.y);
              const alignEntry = alignmentMap.get(ln.node.name);

              return (
                <div
                  key={ln.node.name}
                  style={{
                    position: "absolute",
                    top: yPos - leafLogoHeight / 2,
                    left: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    height: leafLogoHeight,
                  }}
                >
                  <div
                    style={{ width: leafNameWidth, textAlign: "right", paddingRight: 4 }}
                    className="text-xs font-medium text-gray-700 truncate"
                    title={ln.node.name}
                  >
                    {ln.node.name}
                  </div>
                  {alignEntry && (
                    <SequenceLogo
                      matrix={alignEntry.alignedMatrix}
                      height={leafLogoHeight}
                      width={leafLogoWidth}
                      showAxes={false}
                      reverseComplement={false}
                    />
                  )}
                </div>
              );
            })}

          {/* Internal node profile logos */}
          {layoutNodes
            .filter((ln) => !ln.isLeaf)
            .map((ln) => {
              const profile = profileMap.get(ln.node.name);
              if (!profile) return null;

              const xPos = nodeX(ln.depthFromRoot);
              const yPos = nodeY(ln.y);

              return (
                <div
                  key={`profile-${ln.node.name}`}
                  style={{
                    position: "absolute",
                    top: yPos - internalLogoHeight / 2,
                    left: xPos + 8,
                    height: internalLogoHeight,
                  }}
                >
                  <SequenceLogo
                    matrix={profile}
                    height={internalLogoHeight}
                    width={internalLogoWidth}
                    showAxes={false}
                    reverseComplement={false}
                  />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
