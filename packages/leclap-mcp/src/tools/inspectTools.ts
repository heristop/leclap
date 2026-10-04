import type { McpServer } from '@modelcontextprotocol/server';

import type { McpConfig } from '../config.js';
import { registerGetTimeline } from './getTimeline.js';
import { registerRenderFrames } from './renderFrames.js';
import { registerReportCatalogGap } from './reportCatalogGap.js';

// The inspection tools: look at a render (render_frames), read its timeline (get_timeline), and report
// what the motion catalog could not answer (report_catalog_gap). Always registered.
export function registerInspectTools(server: McpServer, config: McpConfig): void {
  registerReportCatalogGap(server, config);
  registerGetTimeline(server);
  registerRenderFrames(server, config);
}
