# Aether 3D Asset Inspection Architecture

An independent forensic asset-inspection and library layer for 3D archives belonging to Aether.

## Directory Layout

```
Aether/
└── 3D/
    ├── Archives/                 # Original, immutable archives (read-only)
    ├── Manifests/                # Inspection manifests and indexes
    │   ├── archives/             # Individual archive manifests (archive_*.json / arch_*.json)
    │   ├── assets/               # Individual asset manifests (char_*, model_*, etc.)
    │   ├── archive_index.json    # Complete inventory of discovered archives
    │   ├── index.json            # Master asset lookup index for Aether application
    │   └── schema.json           # JSON Schema definition for all manifests
    ├── tools/                    # Deterministic inspection pipeline engine
    │   ├── types.ts              # TypeScript interfaces and schema types
    │   ├── idGenerator.ts        # Stable deterministic ID derivations
    │   ├── zipParser.ts          # Central Directory & binary ZIP parser
    │   ├── classifier.ts         # Extension & path category classification
    │   ├── dependencyDetector.ts # Texture, material, and relationship detection
    │   ├── manifestManager.ts    # Atomic manifest writes and resume protocol
    │   ├── validator.ts          # Validation engine
    │   └── inspector.ts          # Inspection CLI entrypoint
    └── README.md                 # System documentation
```

## Absolute Data Rules

1. **Original archives are immutable.** Never modify, unpack destructively, or alter original archives.
2. **Stable Deterministic IDs:**
   - Archive IDs are derived directly from the archive's SHA-256 (`arch_<sha12>`) with sequential alias identifiers (`archive_001`).
   - Asset IDs are derived from category, archive SHA-256, and normalized internal path hash (`<cat>_<slug>_<arch6>_<path8>`).
   - IDs are 100% reproducible and remain identical across rescans.
3. **No Fabricated Data:**
   - Explicit confidence levels: `DETECTED`, `INFERRED`, `NOT_DETERMINED`, `UNCONFIRMED`.
4. **Context Safety:**
   - The filesystem is the source of truth.
   - Archives are processed one at a time and persisted to disk immediately.
   - Large raw archive contents are never retained in memory or conversation context.
5. **Resumable Workflow:**
   - Inspection tracks state via `archive_index.json` and persisted manifests. Interrupted runs resume cleanly from the first incomplete archive.

## Pipeline Phases

- **Phase A**: Foundation (schemas, binary parser, ID generator, validation engine)
- **Phase B**: Archive Inventory (discovery, SHA-256 calculation, inventory queue)
- **Phase C**: Forensic Extraction (per-archive file enumeration, CRC32, manifests)
- **Phase D**: Asset Classification (category classification, stable asset IDs)
- **Phase E**: Technical 3D Analysis (mesh, texture, skeleton, format detection)
- **Phase F**: Relationships & Dependencies (mapping models to textures/materials)
- **Phase G**: Master Index (`index.json` & `archive_index.json` generation)
- **Phase H**: Validation (integrity and schema validation report)
- **Phase I**: Aether Handoff (API consumption guide for main Aether application)
