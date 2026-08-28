## ADDED Requirements

### Requirement: Fixed message schema v0
The experience message SHALL use exactly: `role` ("user"), `parts` array where at least one part is `{kind:"text", text:string}` and optional parts `{kind:"data", data:{name?, version?, files?}}`, plus `messageId` (string) and `contextId` fixed to "experience-share". The schema description and a golden sample SHALL live in `examples/` and be treated as the frozen contract for v0.

#### Scenario: Golden sample compliance
- **WHEN** the golden sample file is posted to the endpoint
- **THEN** it validates and round-trips unchanged

### Requirement: Content semantics deferred
The service SHALL NOT validate or interpret the text/data payload semantics (no format gate); structure-only validation applies in v0.

#### Scenario: Arbitrary text accepted
- **WHEN** text part contains any UTF-8 content
- **THEN** it is stored as-is
