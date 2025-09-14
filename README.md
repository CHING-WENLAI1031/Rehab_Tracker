# Rehab_Tracker

A multi-role system that enables patients to log their daily rehab exercises and progress, while doctors and physiotherapists can remotely track updates, review records, and leave comments.

## Quick Start

1. **Read CLAUDE.md first** - Contains essential rules for Claude Code
2. Follow the pre-task compliance checklist before starting any work
3. Use proper module structure under `src/main/js/`
4. Commit after every completed task

## Project Structure

**Standard Project Structure:** Full application structure with modular organization

```
Rehab_Tracker/
├── CLAUDE.md              # Essential rules for Claude Code
├── README.md              # Project documentation
├── .gitignore             # Git ignore patterns
├── src/                   # Source code (NEVER put files in root)
│   ├── main/              # Main application code
│   │   ├── js/            # JavaScript code
│   │   │   ├── core/      # Core business logic
│   │   │   ├── utils/     # Utility functions/classes
│   │   │   ├── models/    # Data models/entities
│   │   │   ├── services/  # Service layer
│   │   │   └── api/       # API endpoints/interfaces
│   │   └── resources/     # Non-code resources
│   │       ├── config/    # Configuration files
│   │       └── assets/    # Static assets
│   └── test/              # Test code
│       ├── unit/          # Unit tests
│       └── integration/   # Integration tests
├── docs/                  # Documentation
├── tools/                 # Development tools and scripts
├── examples/              # Usage examples
└── output/                # Generated output files
```

## Development Guidelines

- **Always search first** before creating new files
- **Extend existing** functionality rather than duplicating
- **Use Task agents** for operations >30 seconds
- **Single source of truth** for all functionality
- **Language-agnostic structure** - works with Python, JS, Java, etc.
- **Scalable** - start simple, grow as needed
- **Flexible** - choose complexity level based on project needs

## Features

### For Patients
- Log daily rehabilitation exercises
- Track progress over time
- View exercise history and trends

### For Healthcare Providers
- Remote monitoring of patient progress
- Review patient records and exercise logs
- Leave comments and feedback
- Track multiple patients

## Technology Stack

- **Backend**: Node.js
- **Database**: TBD
- **Frontend**: TBD
- **Authentication**: TBD