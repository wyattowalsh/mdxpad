# Data Model: Template Library

**Feature**: 016-template-library
**Date**: 2026-01-17
**Phase**: 1 - Design

## Entities

### Template

The core entity representing an MDX document template.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique identifier (slugified name or UUID for custom) |
| name | string | Yes | Display name (max 100 chars) |
| description | string | Yes | Purpose and use case (max 500 chars) |
| category | TemplateCategory | Yes | Organizational grouping |
| tags | string[] | No | Searchable keywords (max 10 tags, 30 chars each) |
| author | string | No | Creator attribution (default: "Custom" for user templates) |
| version | string | Yes | Semantic version (required for change tracking; defaults to "1.0.0" on creation) |
| variables | TemplateVariable[] | No | Dynamic variables for substitution |
| content | string | Yes | MDX document content with placeholders |
| isBuiltIn | boolean | Yes | True if bundled with app, false if user-created |
| createdAt | Date | Yes | Creation timestamp |
| updatedAt | Date | Yes | Last modification timestamp |
| filePath | string | Yes | Absolute path to .mdxt file |

### TemplateVariable

Defines a dynamic variable that prompts user for input during document creation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Variable identifier (alphanumeric, no spaces) |
| description | string | No | Help text shown in dialog |
| default | string | No | Default value if user leaves blank |
| required | boolean | No | If true, user must provide value (default: false) |

#### Special Variable Handling

| Variable Pattern | Behavior | Example |
|------------------|----------|---------|
| `{{date}}` with empty default | Auto-substitutes current date in ISO format (YYYY-MM-DD) | `2026-01-17` |
| `{{datetime}}` with empty default | Auto-substitutes current datetime in ISO format | `2026-01-17T14:30:00Z` |
| `{{author}}` with empty default | Auto-substitutes from user preferences if configured | `Jane Doe` |

Variables with non-empty defaults or explicit values always use the specified value.

### TemplateCategory

Enumeration of template categories.

| Value | Description |
|-------|-------------|
| blog | Blog posts and articles |
| documentation | Technical documentation |
| presentation | Slide decks and presentations |
| notes | Meeting notes and personal notes |
| tutorial | Step-by-step guides |
| custom | User-created templates |

### TemplateMetadata

Subset of Template containing only metadata (used for listing/search without loading full content).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique identifier |
| name | string | Yes | Display name |
| description | string | Yes | Purpose and use case |
| category | TemplateCategory | Yes | Organizational grouping |
| tags | string[] | No | Searchable keywords |
| author | string | No | Creator attribution |
| isBuiltIn | boolean | Yes | True if bundled with app |

## Relationships

```
┌─────────────────────┐
│     Template        │
├─────────────────────┤
│ id                  │
│ name                │
│ description         │
│ category ──────────────────┐
│ tags[]              │      │
│ author              │      │
│ version             │      ▼
│ variables[] ────────┼──► TemplateVariable
│ content             │      │ name
│ isBuiltIn           │      │ description
│ createdAt           │      │ default
│ updatedAt           │      │ required
│ filePath            │
└─────────────────────┘
         │
         │ 1:1
         ▼
┌─────────────────────┐
│ TemplateMetadata    │
│ (projection)        │
└─────────────────────┘
```

## State Transitions

### Template Lifecycle

```
                    ┌─────────────┐
                    │   Created   │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  Valid   │    │ Invalid  │    │ Deleted  │
    └────┬─────┘    └────┬─────┘    └──────────┘
         │               │
         │    fix errors │
         │◄──────────────┘
         │
         ▼
    ┌──────────┐
    │  Saved   │
    └────┬─────┘
         │
         │ edit
         ▼
    ┌──────────┐
    │ Modified │───► (back to Valid or Invalid)
    └──────────┘
```

### Template Import Flow

```
File Selected → Parsing → Validation → Conflict Check → Saved/Replaced
                  │           │              │
                  ▼           ▼              ▼
              Parse Error  Invalid MDX   Name Exists
                  │           │              │
                  ▼           ▼              ▼
              Show Error  Show Error    Prompt Rename/Replace
```

## Validation Rules

### Template

| Rule | Description |
|------|-------------|
| V-T001 | `name` must be 1-100 characters |
| V-T002 | `description` must be 1-500 characters |
| V-T003 | `category` must be valid TemplateCategory value |
| V-T004 | `tags` array max 10 items, each max 30 characters |
| V-T005 | `content` must be valid MDX (compiles without errors) |
| V-T006 | `id` must be unique within template collection |
| V-T007 | `filePath` must be within allowed directories |
| V-T008 | Built-in templates cannot be modified or deleted |

### TemplateVariable

| Rule | Description |
|------|-------------|
| V-V001 | `name` must be alphanumeric with underscores only: `/^[a-zA-Z_][a-zA-Z0-9_]*$/` |
| V-V002 | `name` must be unique within template's variables array |
| V-V003 | If `required: true`, variable must have value during substitution |

## Storage Schema

### .mdxt File Format

```yaml
---
# Required fields
name: "Template Name"
description: "Template description"
category: "blog"

# Optional fields
tags:
  - tag1
  - tag2
author: "Author Name"
version: "1.0.0"
variables:
  - name: "title"
    description: "Document title"
    default: "Untitled"
    required: true
  - name: "date"
    description: "Publication date"
    default: ""  # Empty = use current date
---

# MDX content starts here
# {{title}}

Published on {{date}}

[Your content here...]
```

### File System Layout

```
~/.mdxpad/templates/
├── my-custom-template.mdxt
├── another-template.mdxt
└── ...

/Applications/mdxpad.app/Contents/Resources/templates/
├── blog-post.mdxt
├── documentation.mdxt
├── presentation.mdxt
├── meeting-notes.mdxt
└── tutorial.mdxt
```

## Indexing Strategy

For search performance (< 200ms per SC-004):

| Index | Fields | Purpose |
|-------|--------|---------|
| Primary | id | Unique lookup |
| Search | name, description, tags | Fuse.js fuzzy search |
| Filter | category, isBuiltIn | Category/source filtering |

Index is rebuilt on:
- Application start
- Template save/delete
- Template import

## Data Volume Estimates

| Metric | Value | Notes |
|--------|-------|-------|
| Built-in templates | 5 | Per SC-006 |
| Custom templates (typical) | 10-50 | No hard limit |
| Custom templates (max supported) | 100+ | Per SC-004 search performance |
| Template file size (typical) | 2-10 KB | MDX with frontmatter |
| Template file size (max recommended) | 100 KB | Larger may slow preview |
| Metadata index size | < 1 MB | All templates combined |
