import {
  RelativesChart as BaseRelativesChart,
  layOutDescendants,
  getAncestorsTree,
  getChartInfo,
} from 'topola'
import type { HierarchyPointNode } from 'd3-hierarchy'
import type { ChartInfo, ChartOptions, TreeNode } from 'topola'
import type { IndiDetails, FamDetails } from 'topola'

const TOP_PADDING = 40

type RelativesNode = HierarchyPointNode<TreeNode>
type AncestorsRoot = HierarchyPointNode<TreeNode>

export class InvertedRelativesChart extends BaseRelativesChart<
  IndiDetails,
  FamDetails
> {
  constructor(options: ChartOptions) {
    super(options)
  }

  render(): ChartInfo {
    const descendantNodes = layOutDescendants(this.options)
    const startNode = descendantNodes[0]
    if (!startNode) {
      return super.render()
    }

    const ancestorOptions: ChartOptions = {
      ...this.options,
      idGenerator: undefined,
    }
    const ancestorsRoot = getAncestorsTree(ancestorOptions)

    this.syncExpanderState(ancestorsRoot, startNode)
    const ancestorDescendants = this.layOutAncestorDescendants(
      ancestorsRoot,
      startNode,
    )
    const nodes = descendantNodes.concat(ancestorDescendants)

    mirrorAncestorsBelowStart(startNode, nodes)
    pinStartAtTop(startNode, nodes)

    const animationPromise = this.util.renderChart(nodes)
    const info = getChartInfo(nodes)
    this.util.updateSvgDimensions(info)
    return { ...info, animationPromise }
  }

  private syncExpanderState(
    ancestorsRoot: AncestorsRoot,
    startNode: RelativesNode,
  ) {
    if (ancestorsRoot.data.indi?.expander !== undefined) {
      startNode.data.indi = startNode.data.indi || {
        id: ancestorsRoot.data.indi.id,
      }
      startNode.data.indi.expander = ancestorsRoot.data.indi.expander
    }
    if (ancestorsRoot.data.spouse?.expander !== undefined) {
      startNode.data.spouse = startNode.data.spouse || {
        id: ancestorsRoot.data.spouse.id,
      }
      startNode.data.spouse.expander = ancestorsRoot.data.spouse.expander
    }
  }
}

function mirrorAncestorsBelowStart(
  startNode: RelativesNode,
  nodes: RelativesNode[],
) {
  const startY = startNode.y
  const startGeneration = startNode.data.generation ?? 0

  nodes.forEach((node) => {
    if (node.y >= startY) return
    node.y = startY + (startY - node.y)
    if (typeof node.data.generation === 'number') {
      node.data.generation =
        startGeneration + (startGeneration - node.data.generation)
    }
  })
}

function pinStartAtTop(startNode: RelativesNode, nodes: RelativesNode[]) {
  const startHeight = startNode.data.height ?? 0
  const startTop = startNode.y - startHeight / 2
  const offset = TOP_PADDING - startTop
  nodes.forEach((node) => {
    node.y += offset
  })
}
