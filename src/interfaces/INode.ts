export default interface INode {
  id: string;
  entryId: string;
  name: string;
  customData?: any;
  prefetchNodeIds?: string[];
}
