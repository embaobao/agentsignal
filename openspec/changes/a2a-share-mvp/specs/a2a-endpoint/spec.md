## ADDED Requirements

### Requirement: Agent card discovery
The service SHALL serve `GET /.well-known/agent-card.json` returning an A2A agent card declaring name "AgentSignal Share" and an `experience-share` skill entry.

#### Scenario: Card discoverable
- **WHEN** a client GETs the well-known path
- **THEN** response is JSON with name and skills fields present

### Requirement: Message/send ingest
The service SHALL accept `POST /` with JSON-RPC 2.0 `method:"message/send"` (v0.3 wire) or `method:"SendMessage"` (SDK v1.0 wire) whose params.message conforms to the Experience-Message Schema v0; valid messages SHALL be persisted as `data/messages/<seq>.json` and the RPC result SHALL return the stored message echo.

#### Scenario: Valid publish round-trip
- **WHEN** a conforming message is posted
- **THEN** response result echoes messageId and seq, and the file exists on disk

#### Scenario: Invalid structure rejected
- **WHEN** message lacks role or a text part
- **THEN** JSON-RPC error response is returned with code -32602 and nothing persisted

### Requirement: Fetch by same structure
The service SHALL serve `GET /messages` (list, newest-first, limit param) and `GET /messages/{id}` returning the stored message in the identical固化 structure used at publish.

#### Scenario: Round-trip fidelity
- **WHEN** a published message is fetched by id
- **THEN** returned JSON equals the persisted structure byte-semantically
