Feature: Compile a template descriptor

  The core renders a JSON template descriptor into a finished mp4 and rejects
  malformed descriptors without throwing.

  Scenario: Render a self-contained color card
    Given the color-card template
    When I compile it to a temp build dir
    Then an mp4 file is produced
    And its probed duration is greater than 0

  Scenario: Reject an invalid template
    Given a template missing required fields
    When I compile the invalid template
    Then compilation fails without throwing
