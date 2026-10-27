declare module 'draft-js' {
  import { ComponentType } from 'react';
  export type DraftInlineStyle = any;
  export type DraftEditorCommand = string;
  export type DraftHandleValue = 'handled' | 'not-handled';
  export type CompositeDecorator = any;
  export type DraftBlockRenderMap = any;
  export type DraftDragType = string;
  export type DraftStyleMap = any;
  export type EditorCommand = string;

  export interface ContentBlock {
    getKey(): string;
    getType(): string;
    getText(): string;
    getCharacterList(): any;
    getLength(): number;
    getDepth(): number;
    getData(): any;
    getInlineStyleAt(offset: number): any;
    getEntityAt(offset: number): string | null;
    findEntityRanges(
      filterFn: (value: any) => boolean,
      callback: (start: number, end: number) => void
    ): void;
  }

  export interface ContentState {
    getPlainText(): string;
    getBlockMap(): any;
    getBlockForKey(key: string): ContentBlock;
    getBlocksAsArray(): ContentBlock[];
    getFirstBlock(): ContentBlock;
    getLastBlock(): ContentBlock;
  }

  export interface EditorState {
    getCurrentContent(): ContentState;
    getSelection(): SelectionState;
    getCurrentInlineStyle(): any;
    getLastChangeType(): string;
    getRedoStack(): any;
    getUndoStack(): any;
    isInCompositionMode(): boolean;
    mustGetSelection(): SelectionState;
    toJS(): any;
    getAllowUndo(): boolean;
    getNativelyRenderedContent(): any;
    getDirectionMap(): any;
    setInlineStyleOverride(inlineStyle: any): EditorState;
    setEditorState(state: EditorState): EditorState;
  }

  export namespace EditorState {
    export function createEmpty(): EditorState;
    export function createWithContent(content: ContentState): EditorState;
    export function push(editorState: EditorState, content: ContentState, changeType: string): EditorState;
  }

  export interface SelectionState {
    getAnchorKey(): string;
    getAnchorOffset(): number;
    getFocusKey(): string;
    getFocusOffset(): number;
    getHasFocus(): boolean;
    getIsBackward(): boolean;
  }

  export class Editor extends React.Component<any> {
    focus(): void;
    blur(): void;
  }

  export namespace ContentState {
    export function createFromText(text: string): ContentState;
  }

  export function convertToRaw(content: ContentState): any;
  export function convertFromRaw(rawState: any): ContentState;

  export const DefaultDraftBlockRenderMap: any;
}