/**
 * Marketplace Panel Component
 *
 * Template marketplace browser with grid display, search/filter,
 * preview, and install functionality.
 *
 * @module renderer/components/template-marketplace/MarketplacePanel
 */

import * as React from 'react';
import { Search, Download, Loader2, AlertCircle, Store, RefreshCw } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import {
  useMarketplaceStore,
  selectMarketplaceStatus,
  selectMarketplaceError,
  selectFilteredMarketplaceTemplates,
  selectMarketplaceCategories,
  selectIsInstalling,
} from '../../stores/marketplace-store';
import type { MarketplaceTemplate } from '../../stores/marketplace-store';
import { TemplateInstallDialog } from './TemplateInstallDialog';
import { Button } from '@ui/button';

// =============================================================================
// TYPES
// =============================================================================

export interface MarketplacePanelProps {
  readonly className?: string;
}

// =============================================================================
// TEMPLATE CARD
// =============================================================================

interface TemplateCardProps {
  readonly template: MarketplaceTemplate;
  readonly onInstall: (template: MarketplaceTemplate) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onInstall }) => {
  const isInstalling = useMarketplaceStore(selectIsInstalling(template.id));
  const installAvailable = useMarketplaceStore((state) => state.installAvailable);

  return (
    <div className="flex flex-col rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <h4 className="font-semibold">{template.name}</h4>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
          {template.category}
        </span>
      </div>

      <p className="mt-1 flex-1 text-sm text-muted-foreground line-clamp-2">
        {template.description}
      </p>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>by {template.author}</span>
        <span className="flex items-center gap-1">
          <Download className="h-3 w-3" />
          {template.downloads.toLocaleString()}
        </span>
      </div>

      {installAvailable ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={() => onInstall(template)}
          disabled={isInstalling}
        >
          {isInstalling ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Installing...
            </>
          ) : (
            <>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Install
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
};

TemplateCard.displayName = 'TemplateCard';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const MarketplaceHeader: React.FC<{
  readonly status: string;
  readonly onRefresh: () => void;
}> = ({ status, onRefresh }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Store className="h-5 w-5" />
      <h2 className="text-lg font-semibold">Template Marketplace</h2>
    </div>
    <Button variant="ghost" size="sm" onClick={onRefresh} disabled={status === 'loading'}>
      <RefreshCw className={cn('h-4 w-4', status === 'loading' && 'animate-spin')} />
    </Button>
  </div>
);
MarketplaceHeader.displayName = 'MarketplaceHeader';

const SearchFilter: React.FC<{
  readonly searchQuery: string;
  readonly categoryFilter: string | null;
  readonly categories: readonly string[];
  readonly onSearch: (q: string) => void;
  readonly onCategoryChange: (cat: string | null) => void;
}> = ({ searchQuery, categoryFilter, categories, onSearch, onCategoryChange }) => (
  <div className="flex items-center gap-2">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="Search templates..."
        value={searchQuery}
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
    <select
      className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      value={categoryFilter ?? ''}
      onChange={(e) => onCategoryChange(e.target.value || null)}
    >
      <option value="">All Categories</option>
      {categories.map((cat) => (
        <option key={cat} value={cat}>
          {cat.charAt(0).toUpperCase() + cat.slice(1)}
        </option>
      ))}
    </select>
  </div>
);
SearchFilter.displayName = 'SearchFilter';

const ErrorBanner: React.FC<{ readonly error: string }> = ({ error }) => (
  <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
    <AlertCircle className="h-4 w-4 shrink-0" />
    {error}
  </div>
);
ErrorBanner.displayName = 'ErrorBanner';

const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
    <Loader2 className="h-8 w-8 animate-spin" />
    <p className="text-sm">Loading templates...</p>
  </div>
);
LoadingState.displayName = 'LoadingState';

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
    <Store className="h-8 w-8" />
    <p className="text-sm">No templates found</p>
  </div>
);
EmptyState.displayName = 'EmptyState';

const TemplateGrid: React.FC<{
  readonly templates: readonly MarketplaceTemplate[];
  readonly onInstall: (t: MarketplaceTemplate) => void;
}> = ({ templates, onInstall }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {templates.map((template) => (
      <TemplateCard key={template.id} template={template} onInstall={onInstall} />
    ))}
  </div>
);
TemplateGrid.displayName = 'TemplateGrid';

// =============================================================================
// HOOKS
// =============================================================================

function useMarketplaceData() {
  const status = useMarketplaceStore(selectMarketplaceStatus);
  const error = useMarketplaceStore(selectMarketplaceError);
  const filteredTemplates = useMarketplaceStore(selectFilteredMarketplaceTemplates);
  const categories = useMarketplaceStore(selectMarketplaceCategories);
  const fetchTemplates = useMarketplaceStore((s) => s.fetchTemplates);
  const searchTemplates = useMarketplaceStore((s) => s.searchTemplates);
  const setCategoryFilter = useMarketplaceStore((s) => s.setCategoryFilter);
  const searchQuery = useMarketplaceStore((s) => s.searchQuery);
  const categoryFilter = useMarketplaceStore((s) => s.categoryFilter);

  return {
    status,
    error,
    filteredTemplates,
    categories,
    fetchTemplates,
    searchTemplates,
    setCategoryFilter,
    searchQuery,
    categoryFilter,
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const MarketplacePanel: React.FC<MarketplacePanelProps> = ({ className }) => {
  const data = useMarketplaceData();
  const { fetchTemplates } = data;
  const [selectedTemplate, setSelectedTemplate] = React.useState<MarketplaceTemplate | null>(null);
  const [showInstallDialog, setShowInstallDialog] = React.useState(false);

  React.useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const handleInstall = React.useCallback((template: MarketplaceTemplate) => {
    setSelectedTemplate(template);
    setShowInstallDialog(true);
  }, []);

  const handleRefresh = React.useCallback(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <MarketplaceHeader status={data.status} onRefresh={handleRefresh} />
      <SearchFilter
        searchQuery={data.searchQuery}
        categoryFilter={data.categoryFilter}
        categories={data.categories}
        onSearch={data.searchTemplates}
        onCategoryChange={data.setCategoryFilter}
      />
      {data.error ? <ErrorBanner error={data.error} /> : null}
      {data.status === 'loading' && data.filteredTemplates.length === 0 ? <LoadingState /> : null}
      {data.filteredTemplates.length > 0 ? (
        <TemplateGrid templates={data.filteredTemplates} onInstall={handleInstall} />
      ) : data.status !== 'loading' ? (
        <EmptyState />
      ) : null}
      <TemplateInstallDialog
        template={selectedTemplate}
        open={showInstallDialog}
        onOpenChange={setShowInstallDialog}
      />
    </div>
  );
};

MarketplacePanel.displayName = 'MarketplacePanel';
