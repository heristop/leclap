// A BuilderPort over the real pure editor model (createHistory + toEditorState), for the tool-layer
// tests: commits are history steps, undo is the history's own, and confirmations answer from a script.
import { createHistory, toEditorState, type EditorState } from '@leclap/creative-kit/editor';
import type { StoredPartial } from '@/stores/userPartialStore';
import { buildBuilderTools } from './registry';
import type { ActivityInput, BuilderPort, CommitMeta, ConfirmRequest, ToolResult } from './types';

export interface FakePort extends BuilderPort {
  activity: ActivityInput[];
  commits: CommitMeta[];
  confirms: ConfirmRequest[];
  selected: number;
  /** What the next confirmations answer (default true). */
  answers: boolean[];
  visible: boolean;
  ask: boolean;
  partials: StoredPartial[];
  /** A user edit, outside the agent. */
  userSet: (next: EditorState) => void;
  undo: () => void;
}

export const TEST_ORIGIN = 'https://leclap.test';

/** Calls a tool by name through the registry (rate limits, parsing and reporting included). */
export function toolCaller(port: BuilderPort, now: () => number = () => 0) {
  const tools = buildBuilderTools(port, { capabilities: new Set(), origin: TEST_ORIGIN, now });

  return async (name: string, args: unknown = {}): Promise<ToolResult & { data: Record<string, unknown> }> => {
    const tool = tools.find((candidate) => candidate.name === name);

    if (!tool) throw new Error(`no tool ${name}`);

    const result = await tool.execute(args);

    return { ...result, data: result.structuredContent ?? {} };
  };
}

export function createFakePort(initial: EditorState = toEditorState(null)): FakePort {
  const history = createHistory(initial);
  const port: FakePort = {
    activity: [],
    commits: [],
    confirms: [],
    selected: 0,
    answers: [],
    visible: true,
    ask: false,
    partials: [],
    getState: () => history.state,
    getEditor: () => ({ selectedIndex: port.selected, canUndo: history.canUndo, canRedo: history.canRedo }),
    commit: (next, meta) => {
      history.set(next);
      port.commits.push(meta);
    },
    replace: (next, meta) => {
      history.set(next);
      port.commits.push(meta);
    },
    undoIfPresent: (state) => {
      if (history.state !== state) return false;

      history.undo();

      return true;
    },
    selectScene: (position) => {
      port.selected = position;
    },
    confirm: (request) => {
      port.confirms.push(request);

      return Promise.resolve(port.answers.shift() ?? true);
    },
    localPartials: () => port.partials,
    report: (activity) => {
      port.activity.push(activity);
    },
    isDocumentVisible: () => port.visible,
    askBeforeEdit: () => port.ask,
    userSet: (next) => {
      history.set(next);
    },
    undo: () => {
      history.undo();
    },
  };

  return port;
}
