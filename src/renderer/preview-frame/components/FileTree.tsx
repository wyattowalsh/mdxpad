/**
 * FileTree Component
 *
 * Recursive directory structure visualization for MDX preview.
 * Supports expand/collapse, keyboard navigation, and semantic markup.
 * @module preview-frame/components/FileTree
 */

import * as React from 'react';
const { useState, useCallback } = React;

/**
 * Represents a node in the file tree structure.
 */
export interface FileTreeNode {
  /** File or directory name */
  readonly name: string;
  /** Node type */
  readonly type: 'file' | 'directory';
  /** Children for directories */
  readonly children?: FileTreeNode[];
}

/**
 * Props for the FileTree component.
 */
export interface FileTreeProps {
  /** Tree data */
  readonly data: FileTreeNode[];
  /** CSS class */
  readonly className?: string;
}

/**
 * Props for internal TreeNode component.
 */
interface TreeNodeProps {
  /** The node to render */
  readonly node: FileTreeNode;
  /** Depth level for indentation */
  readonly depth: number;
}

/**
 * Renders a single node in the file tree.
 * Handles expand/collapse state for directories.
 */
function TreeNode({ node, depth }: TreeNodeProps): React.ReactElement {
  const [expanded, setExpanded] = useState(true);

  const isDirectory = node.type === 'directory';
  const hasChildren = isDirectory && node.children && node.children.length > 0;

  const handleToggle = useCallback(() => {
    if (isDirectory) {
      setExpanded((prev) => !prev);
    }
  }, [isDirectory]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isDirectory) return;

      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          setExpanded((prev) => !prev);
          break;
        case 'ArrowRight':
          if (!expanded) {
            event.preventDefault();
            setExpanded(true);
          }
          break;
        case 'ArrowLeft':
          if (expanded) {
            event.preventDefault();
            setExpanded(false);
          }
          break;
      }
    },
    [isDirectory, expanded]
  );

  const icon = isDirectory ? (expanded ? '\u{1F4C2}' : '\u{1F4C1}') : '\u{1F4C4}';

  const nodeClassName = [
    'file-tree-node',
    isDirectory ? 'file-tree-node--directory' : 'file-tree-node--file',
    isDirectory && expanded ? 'file-tree-node--expanded' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={nodeClassName} role="treeitem" aria-expanded={isDirectory ? expanded : undefined}>
      <div
        className="file-tree-node-content"
        style={{ paddingLeft: `${depth * 16}px` }}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        tabIndex={isDirectory ? 0 : -1}
        role={isDirectory ? 'button' : undefined}
        aria-label={isDirectory ? `${expanded ? 'Collapse' : 'Expand'} ${node.name}` : node.name}
      >
        <span className="file-tree-node-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="file-tree-node-name">{node.name}</span>
      </div>
      {hasChildren && expanded && (
        <ul className="file-tree-children" role="group">
          {node.children!.map((child, index) => (
            <TreeNode key={`${child.name}-${index}`} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * FileTree component for displaying hierarchical file/directory structures.
 *
 * @example
 * ```tsx
 * const data: FileTreeNode[] = [
 *   {
 *     name: 'src',
 *     type: 'directory',
 *     children: [
 *       { name: 'index.ts', type: 'file' },
 *       { name: 'utils', type: 'directory', children: [] }
 *     ]
 *   }
 * ];
 *
 * <FileTree data={data} className="my-tree" />
 * ```
 */
export function FileTree({ data, className }: FileTreeProps): React.ReactElement {
  const rootClassName = ['file-tree', className].filter(Boolean).join(' ');

  return (
    <ul className={rootClassName} role="tree" aria-label="File tree">
      {data.map((node, index) => (
        <TreeNode key={`${node.name}-${index}`} node={node} depth={0} />
      ))}
    </ul>
  );
}

export default FileTree;
