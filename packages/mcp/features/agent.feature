Feature: Agent drives the leclap MCP server over stdio

  An MCP client connects to the built stdio server and exercises discovery,
  a real render, and a probe — proving the JSON-RPC framing survives a
  pino-heavy render through the forked worker (no fd-1 stdout corruption).

  Background:
    Given a running leclap MCP server

  Scenario: Discover templates
    When the agent lists templates
    Then it receives 16 templates
    When the agent requests the template schema
    Then the schema includes sections

  Scenario: Compose a video from an inline template
    When the agent composes the color-card template
    Then it receives an output path that exists
    And the render has a positive duration and non-zero size

  Scenario: Probe the rendered file
    When the agent composes the color-card template
    And the agent probes the rendered file
    Then it reports a video codec
