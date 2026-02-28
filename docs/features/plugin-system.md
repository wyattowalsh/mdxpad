# Plugin System

MDXPad has a plugin system for extending editor functionality, themes, and MDX processing.

## Architecture

```
src/main/services/plugin/
├── plugin-registry.ts     # Installed plugin tracking
├── plugin-loader.ts       # Plugin loading and lifecycle
├── plugin-manifest.ts     # Manifest validation
└── plugin-handlers.ts     # IPC handlers for plugin operations

src/renderer/features/plugins/
├── plugin-store.ts        # Plugin state management
├── PluginCard.tsx          # Plugin list item UI
├── PluginMarketplace.tsx   # Browse/install plugins
├── ThemePicker.tsx         # Theme selection UI
├── CssEditorDialog.tsx     # Custom CSS editor
├── theme-manager.ts        # Theme switching logic
├── theme-definitions.ts    # Built-in theme definitions
└── css-injector.ts         # Runtime CSS injection
```

## Plugin Manifest

Every plugin requires a `manifest.json` that conforms to the `PluginManifest` schema (`src/shared/contracts/plugin-schemas.ts`):

```typescript
interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main?: string;           // Entry point
  type: 'theme' | 'extension' | 'remark' | 'rehype';
  permissions?: string[];  // Required permissions
}
```

## Plugin Registry

The `PluginRegistry` (`plugin-registry.ts`) persists plugin state to a JSON file:

```typescript
interface PluginRecord {
  id: string;
  manifest: PluginManifest;
  state: PluginState;      // 'installed' | 'active' | 'disabled' | 'error'
  installedAt: number;
  error?: string;
}
```

Operations:
- `listPlugins()` -- List all installed plugins
- `getPlugin(id)` -- Get a specific plugin
- `addPlugin(id, manifest)` -- Install a plugin
- `removePlugin(id)` -- Uninstall a plugin
- `setState(id, state)` -- Enable/disable a plugin
- `setError(id, error)` -- Mark a plugin as errored

## Plugin Loader

The `PluginLoader` (`plugin-loader.ts`) handles:
- Reading plugin directories
- Validating manifests
- Loading plugin entry points
- Lifecycle management (activate/deactivate)

## Theme System

### Built-in Themes

Theme definitions in `theme-definitions.ts` provide pre-configured editor themes. The `ThemePicker` component lets users select and preview themes.

### Custom CSS

The `CssEditorDialog` allows users to write custom CSS that is injected at runtime via `css-injector.ts`.

### Theme Manager

`theme-manager.ts` handles theme switching by:
1. Loading the theme definition
2. Generating CSS variables
3. Injecting styles into the document

## MDX Plugin Pipeline

The MDX compilation pipeline supports remark and rehype plugins:

- Configuration in `src/renderer/lib/mdx/plugin-pipeline.ts`
- Default plugins: `remark-gfm`, `remark-frontmatter`, `remark-math`, `rehype-highlight`, `rehype-katex`
- Per-plugin enable/disable and options via `pluginConfig.plugins`
- Invalid plugin options fall back to defaults

## Extension Platform

The `ExtensionPlatformService` (`src/main/services/extension-platform-service.ts`) provides:
- Extension directory management
- Extension discovery and validation
- Hot-reload support for development

## IPC API

Plugin operations are exposed via IPC:

```typescript
// Plugin management
window.mdxpad.extensions.listPlugins()
window.mdxpad.extensions.installPlugin({ path })
window.mdxpad.extensions.removePlugin({ id })
window.mdxpad.extensions.setPluginState({ id, state })
```

IPC schemas are in `src/shared/contracts/plugin-schemas.ts`.

## Template Marketplace

The template marketplace (`src/main/services/template-marketplace-service.ts`) extends the plugin concept for document templates:

- `MarketplacePanel` (`src/renderer/components/template-marketplace/MarketplacePanel.tsx`) -- Browse templates
- `TemplateInstallDialog` -- Install confirmation
- `useMarketplaceStore` (`src/renderer/stores/marketplace-store.ts`) -- Marketplace state
