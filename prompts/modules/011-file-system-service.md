# 011 — File System Service

**Module ID:** 011-File-System-Service  
**Status:** Architecture Approved  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** packages/core (fs), apps/studio (via IPC)

---

## 1. Purpose

The File System Service provides secure, validated, and scoped access to the underlying file system for all project contents, documentation, prompts, and related artifacts. It serves as the authoritative source of truth for raw file data while enforcing strict boundaries between untrusted layers (UI, AI consumers) and privileged operations.

It exists to enable safe file operations across the platform without exposing raw system access, preventing scope creep into higher-level concerns like watching, parsing, or knowledge storage.

## 2. Responsibilities

- Validate and authorize all file system paths within workspace and project boundaries.
- Perform read, write, list, and metadata operations with appropriate permissions and validation.
- Enforce security constraints (no traversal outside allowed roots, input sanitization).
- Provide consistent file metadata and content access to dependent modules.
- Coordinate with IPC for safe exposure to the Studio Shell and other consumers.
- Support graceful degradation when underlying file system access is limited.

The File System Service owns the contract and implementation of safe file access. It does not own file watching (012), content parsing/ingestion, or the knowledge graph.

## 3. Scope

- Path validation and canonicalization relative to active workspace/project roots.
- Basic file and directory operations (read, write, list, stat, exists) with scoping.
- Access to project source, docs/, prompts/, and local configuration files.
- Error translation and permission-aware responses.
- Integration points for higher modules needing raw file data.

## 4. Non-Goals

- File system watching or change notification (belongs to File Watcher).
- Parsing, indexing, or semantic analysis of file contents (belongs to Ingestion, Tree-sitter Parser, etc.).
- Storage of derived knowledge or entities (belongs to Knowledge / Memory layers).
- Direct UI or command palette exposure (belongs to Studio Shell).
- Cross-workspace or global file system access without explicit scoping.

## 5. Functional Requirements

1. Validate that a requested path is within the active workspace or project root and return a canonical, safe representation.
2. Read file contents or directory listings for authorized paths, returning structured results with metadata.
3. Write or update file contents for authorized paths, ensuring atomicity where possible and proper error handling.
4. Provide file metadata (size, modification time, type) without requiring full content read.
5. Support project-scoped operations that automatically respect the current active project boundaries.
6. Translate low-level file system errors into clear, actionable domain errors.
7. Allow temporary or session-scoped access grants for specific operations.
8. Report availability and capability of the underlying file system to consumers.

## 6. Non-Functional Requirements

- All operations must complete with low latency for typical project files (< 50ms for small reads/writes).
- Must never allow access outside validated roots (strict sandboxing).
- Must be usable from both native/main process and safely proxied to renderer via IPC.
- Must handle large files and directories gracefully (streaming where appropriate).
- Must align with Constitution performance, security, and boundary principles.
- All file operations must be auditable via structured logging.

## 7. Architecture

The File System Service is a foundational Core Platform module that sits at the boundary between the application and the host operating system.

High-level position:

Studio Shell / Consumers (via IPC)
      │ (validated requests)
File System Service (this module)
      │ (safe, scoped operations)
Host Operating System (Electron main process privileged access)
      │
Actual File System (source of truth for code, docs/, prompts/)

It is the single place where raw file system privileges are exercised. All other modules must go through it or its contracts.

Key principles from Constitution:
- Context isolation and explicit boundaries.
- Validation at every trust boundary.
- The file system is the source of truth for raw artifacts; the graph holds references and derived knowledge (see docs/006).
- Loose coupling: higher modules depend on abstract contracts, not direct FS calls.

**Lifecycle**

Startup
↓
Initialize with current workspace/project roots (from Workspace/Project Manager)
↓
Establish privileged access in native host
↓
Register IPC handlers for safe operations
↓
Ready (consumers can request validated access)
↓
On workspace/project change
↓
Update active roots and re-validate pending operations
↓
Shutdown
↓
Flush any pending writes, release handles, clean temporary state

**Failure Dependencies / Resilience**

| Failure                  | Expected Behavior                              |
|--------------------------|------------------------------------------------|
| Workspace unavailable    | No scoped operations                           |
| IPC unavailable          | Service unavailable to renderer                |
| Read-only filesystem     | Read operations only                           |
| Permission denied        | Operation fails gracefully                     |
| Disk full                | Fail without partial persistence               |
| Underlying FS unavailable| Return clear errors; consumers degrade to cached/read-only |

The service must fail safely in all cases.

References: Constitution §3, §7 (IPC, Security, Performance), docs/002-system-architecture.md, docs/004-folder-structure.md, docs/006-database-architecture.md, 009 Workspace Manager, 010 Project Manager, the reprioritized Core Platform assessment.

**Relationship to Module 012 (File Watcher)**
Module 012 (File Watcher) depends on this service for validated roots and safe path contracts. The File Watcher must never bypass the File System Service for path validation or access. It requests validated roots, receives safe contracts, detects changes, and publishes events for indexers and other consumers to react.

## 8. Folder Structure

```
packages/core/src/fs/
├── service.ts                 # Core FileSystemService implementation
├── types.ts                   # FilePath, FileMetadata, ReadResult, etc.
├── validator.ts               # Path validation and scoping logic
├── operations.ts              # Read, write, list, stat implementations
├── errors.ts                  # Domain-specific FS errors
└── index.ts
```

The service lives in core and is accessed via IPC contracts from the shell and other modules. Privileged operations execute in the Electron main process.

## 9. Public Interfaces

The File System Service defines the following conceptual contracts (exact TypeScript signatures are reserved for Layer 3 implementation or dedicated API specifications):

**Path Validation Contract**
- Inputs: Raw or relative path, context (workspace/project scope).
- Outputs: Validated canonical path or validation error.
- Lifecycle: Performed on every operation; results may be cached briefly within a scope.
- Ownership: Service owns validation rules and root enforcement.

**Read Contract**
- Inputs: Validated path, optional range or options.
- Outputs: File content (or stream) + metadata, or error.
- Lifecycle: One-shot or streaming; content reflects current disk state at time of read. The File System Service provides streaming primitives only. Buffering strategy belongs to the consuming module.
- Ownership: Service owns safe retrieval; consumers own interpretation.

**Write Contract**
- Inputs: Validated path, content, optional write options (atomic, create dirs).
- Outputs: Success acknowledgment + resulting metadata, or error.
- Lifecycle: Atomic writes are required whenever supported by the underlying platform. When atomic replacement is unavailable, the service must fail safely rather than risking partial file corruption. Triggers events for dependents (e.g. ingestion).
- Ownership: Service owns safe mutation; higher layers own when/what to write.

**Directory Listing & Metadata Contract**
- Inputs: Validated directory path, optional filters.
- Outputs: List of entries with metadata.
- Lifecycle: Snapshot at time of call.
- Ownership: Service owns enumeration; consumers own recursion or filtering.

Consumers must obtain validated paths or operate only through these contracts. No direct system calls.

## 10. Internal Components

- PathValidator: root enforcement, canonicalization, traversal prevention.
- OperationExecutor: privileged read/write/list in native context.
- MetadataProvider: stat and type detection.
- ErrorMapper: translation of OS errors to domain errors.
- ScopeManager: ties operations to current workspace/project from managers.

These components run in the privileged process. External access is strictly through the public contracts and IPC.

## 11. Database Schema

The File System Service does not own knowledge data.

It may maintain transient or lightweight metadata caches (e.g., recent stat results, permission grants) but these are non-authoritative.

The actual file contents and structure on disk are the source of truth (see docs/006). The knowledge graph stores only references and derived information.

No persistent store is owned by this service for project content.

## 12. IPC/API Contracts

All access from the Studio Shell or non-privileged layers occurs exclusively through the IPC Framework.

Representative contracts (to be formalized by the IPC module):

- `fs:validatePath@1.0`
- `fs:readFile@1.0`
- `fs:writeFile@1.0`
- `fs:listDirectory@1.0`
- `fs:getMetadata@1.0`

Contracts are versioned, carry scope context, and are validated on both sides. No raw paths or untrusted input crosses without validation.

## 13. Events

The service may emit (via IPC or internal):

- `fs:file:changed@1.0` (validated path, type of change) — published by the service for integration. Detection of changes belongs exclusively to Module 012 (File Watcher). The File System Service does not detect filesystem changes independently.
- `fs:operation:completed@1.0` (path, operation, success, duration) for observability.

Events are lightweight and only for validated paths within active scope.

## 14. State Management

- Maintains current active workspace and project roots (sourced from 009/010).
- Transient operation state (in-flight reads/writes) for cancellation and error correlation.
- No long-lived mutable state for file contents.

State is updated on workspace/project activation events.

## 15. Error Handling

- Path outside scope → Specific "AccessDenied" or "InvalidScope" error.
- File not found / permission denied → Translated domain errors with actionable guidance.
- Disk full or I/O error → Clear error; no partial writes left behind where possible.
- All errors include sufficient context for logging and user messaging without leaking system details.

No silent failures. Operations either succeed fully or surface an error.

## 16. Logging

- Structured logs for every operation: path (sanitized), operation type, duration, result.
- Errors with root cause category and scope context.
- Validation failures at warning level for security auditing.
- Lifecycle events (root changes, service ready).

## 17. Security

- All paths are validated against active roots before any operation.
- Symbolic links, junctions, and Windows reparse points that resolve outside an authorized root are rejected even if the original path appears valid. The File System Service owns enforcement of symlink policy.
- Input sanitization on all paths and options.
- Operations execute only in privileged context (Electron main process).
- Secrets or sensitive files are never exposed through this service to untrusted layers.
- Follows Constitution §7 Security and IPC standards.

## 18. Performance Targets

- Path validation: < 5ms.
- Small file read (< 1MB): < 20ms.
- Directory listing (typical project dir): < 50ms.
- Write of small file: < 30ms.
- Memory overhead: minimal; avoid loading entire large files into memory when streaming is possible.

All targets measured with active workspace scoping.

## 19. Dependencies

**Module Maturity:** Architecture Approved

**Required Modules:**
- 013 IPC Framework
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Safe exposure of operations to untrusted layers
- 009 Workspace Manager
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Workspace root for scoping
- 010 Project Manager
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Project root for finer-grained scoping

**Required Services:**
- Privileged native file system access (Electron main process)
- Secure IPC transport

**Required Packages:**
- packages/core (shared FS types and service)

**Required APIs:**
- Typed IPC contracts for validation, read, write, list, and metadata (versioned)

**Provides:**
- Validated, scoped file and directory operations
- File metadata and error translation
- Foundation for safe ingestion and watching

**Consumers:**
- 012 File Watcher (for change detection)
- Ingestion modules (101–105 series and beyond) for source content
- 001 Studio Shell (capture, project views)
- Context Engine and higher layers (for raw file access when needed)
- Any future tools requiring safe FS access

**Other notes:**
- This is one of the most foundational Core Platform modules. Many later modules (watchers, parsers, indexers, context) depend on reliable, secure FS access.
- Must be available early in the platform boot sequence.

## 20. Testing Strategy

- Unit tests for path validation, scoping, and error mapping logic.
- Integration tests with real (sandboxed) file system for read/write/list flows.
- Security tests for traversal prevention and permission enforcement.
- Performance benchmarks for common operations.
- Degradation tests when underlying FS or IPC is unavailable.
- E2E coverage through dependent modules (e.g., workspace open using FS validation).

Full objective Layer 4 validation (including 013 failure matrix, ordering proofs, contract tests) is defined in `prompts/validation/011-file-system-service.validation.md`. This is a foundational gate.

## 21. Acceptance Criteria

- All file operations are rejected if the path is outside the active workspace or project scope.
- Read and write operations succeed for valid paths within scope and produce correct results.
- Errors are clear, categorized, and never leak internal system details to untrusted consumers.
- The service correctly reflects current workspace/project roots from managers.
- Performance targets are met under normal project loads.
- The service reports zero ownership of knowledge graph content.

## 22. Definition of Done

- Satisfies the project-wide Definition of Done in the Ray Studio Engineering Constitution §9.
- This specification has been self-reviewed against the Constitution.
- Architectural consistency with the Core Platform order, docs/002–004, docs/006–007, 009–010, and the reprioritized Layer 2 plan has been verified.
- No placeholder content remains in this specification.
- The spec is committed inside prompts/modules/ following the approved structure.
- Relevant sections of the Constitution were explicitly considered (architecture principles, IPC, security, performance, documentation rules, boundaries).

---

**Notes for Authors:**
- Keep specs focused and reasonably sized.
- Use the exact section headings above.
- All specs must be consistent with the Ray Studio Engineering Constitution (Layer 1).
- When implementing, the Layer 3 prompt will reference this spec + the Constitution.
- Update this spec when requirements or architecture change (via ADR process).