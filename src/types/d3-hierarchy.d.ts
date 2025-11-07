declare module 'd3-hierarchy' {
  export interface HierarchyPointNode<Datum> {
    data: Datum
    depth: number
    parent: HierarchyPointNode<Datum> | null
    children?: Array<HierarchyPointNode<Datum>>
    x: number
    y: number
  }
}
