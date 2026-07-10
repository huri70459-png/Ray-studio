import type ParserType from 'web-tree-sitter';
import type { SyntaxNode, SyntaxTree } from './types.js';

type TsNode = ParserType.SyntaxNode;
type TsTree = ParserType.Tree;
type Language = ParserType.Language;

export class WrappedTree implements SyntaxTree {
  readonly raw: TsTree;
  readonly languageId: string;
  readonly language: Language;

  constructor(raw: TsTree, languageId: string, language: Language) {
    this.raw = raw;
    this.languageId = languageId;
    this.language = language;
  }

  get rootNode(): SyntaxNode {
    return wrapNode(this.raw.rootNode);
  }

  delete(): void {
    this.raw.delete();
  }
}

export function wrapNode(node: TsNode): SyntaxNode {
  return {
    type: node.type,
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    startPosition: {
      row: node.startPosition.row,
      column: node.startPosition.column,
    },
    endPosition: {
      row: node.endPosition.row,
      column: node.endPosition.column,
    },
    childCount: node.childCount,
    hasError: node.hasError,
    isError: node.isError,
    child(index: number): SyntaxNode | null {
      const c = node.child(index);
      return c ? wrapNode(c) : null;
    },
    namedChild(index: number): SyntaxNode | null {
      const c = node.namedChild(index);
      return c ? wrapNode(c) : null;
    },
  };
}

export function collectErrorNodes(root: TsNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  const stack: TsNode[] = [root];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (n.type === 'ERROR' || n.isError) {
      out.push(wrapNode(n));
    }
    for (let i = 0; i < n.childCount; i++) {
      const c = n.child(i);
      if (c) stack.push(c);
    }
  }
  return out;
}

export function countNodes(root: TsNode): number {
  let count = 0;
  const stack: TsNode[] = [root];
  while (stack.length > 0) {
    const n = stack.pop()!;
    count += 1;
    for (let i = 0; i < n.childCount; i++) {
      const c = n.child(i);
      if (c) stack.push(c);
    }
  }
  return count;
}

export function asWrappedTree(tree: SyntaxTree): WrappedTree {
  if (tree instanceof WrappedTree) return tree;
  throw new Error(
    'SyntaxTree must be produced by @ray-studio/ingestion TreeSitterParser',
  );
}
