/**
 * Tabs and Tab Components
 *
 * Controlled tabbed content sections with keyboard navigation.
 * Per FR-012: System MUST provide Tabs/Tab components for tabbed content sections.
 * @module preview-frame/components/Tabs
 */

import * as React from 'react';

/**
 * Context for sharing active tab state between Tabs and Tab components.
 */
const TabsContext = React.createContext<{
  activeValue: string;
  setActiveValue: (value: string) => void;
} | null>(null);

/**
 * Hook to access tabs context from Tab children.
 * @throws Error if used outside of Tabs component
 */
function useTabsContext(): {
  activeValue: string;
  setActiveValue: (value: string) => void;
} {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Tab must be used within a Tabs component');
  }
  return context;
}

/**
 * Props for the Tabs component
 */
export interface TabsProps {
  /** Default active tab value */
  readonly defaultValue: string;
  /** Tab elements */
  readonly children: React.ReactNode;
  /** CSS class */
  readonly className?: string;
}

/**
 * Props for the Tab component
 */
export interface TabProps {
  /** Unique identifier for this tab */
  readonly value: string;
  /** Tab button label */
  readonly label: string;
  /** Tab panel content */
  readonly children: React.ReactNode;
}

/**
 * Internal type for extracted tab data from Tab children
 */
interface TabData {
  readonly value: string;
  readonly label: string;
  readonly children: React.ReactNode;
}

/**
 * Extracts tab data from Tab children components.
 * @param children - React children to extract Tab data from
 * @returns Array of extracted TabData objects
 */
function extractTabData(children: React.ReactNode): TabData[] {
  const tabs: TabData[] = [];

  React.Children.forEach(children, (child) => {
    if (React.isValidElement<TabProps>(child) && child.type === Tab) {
      tabs.push({
        value: child.props.value,
        label: child.props.label,
        children: child.props.children,
      });
    }
  });

  return tabs;
}

/**
 * Tabs container component that manages active tab state and renders tab UI.
 * Uses React Context to share state with Tab children.
 * Supports keyboard navigation with arrow keys.
 *
 * @example
 * ```tsx
 * <Tabs defaultValue="npm">
 *   <Tab value="npm" label="npm">npm install pkg</Tab>
 *   <Tab value="pnpm" label="pnpm">pnpm add pkg</Tab>
 *   <Tab value="yarn" label="yarn">yarn add pkg</Tab>
 * </Tabs>
 * ```
 */
export function Tabs({
  defaultValue,
  children,
  className,
}: TabsProps): React.ReactElement {
  const [activeValue, setActiveValue] = React.useState(defaultValue);
  const tabListRef = React.useRef<HTMLDivElement>(null);

  // Extract tab data from children
  const tabs = extractTabData(children);

  // Find the active tab's content
  const activeTab = tabs.find((tab) => tab.value === activeValue);

  /**
   * Handle keyboard navigation within the tab list.
   * Arrow keys move between tabs, Home/End jump to first/last.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const currentIndex = tabs.findIndex((tab) => tab.value === activeValue);
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        break;
      case 'ArrowRight':
        event.preventDefault();
        newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    const newTab = tabs[newIndex];
    if (newIndex !== currentIndex && newTab) {
      setActiveValue(newTab.value);
      // Focus the newly selected tab button
      const tabList = tabListRef.current;
      if (tabList) {
        const buttons = tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons[newIndex]?.focus();
      }
    }
  };

  const containerClasses = ['tabs', className].filter(Boolean).join(' ');

  const contextValue = React.useMemo(
    () => ({ activeValue, setActiveValue }),
    [activeValue]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={containerClasses}>
        {/* Tab list with role="tablist" for accessibility */}
        <div
          ref={tabListRef}
          className="tabs-list"
          role="tablist"
          aria-orientation="horizontal"
          onKeyDown={handleKeyDown}
        >
          {tabs.map((tab) => {
            const isActive = tab.value === activeValue;
            const tabClasses = [
              'tabs-tab',
              isActive && 'tabs-tab--active',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                id={`tab-${tab.value}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.value}`}
                tabIndex={isActive ? 0 : -1}
                className={tabClasses}
                onClick={() => setActiveValue(tab.value)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Active tab panel */}
        {activeTab && (
          <div
            key={activeTab.value}
            role="tabpanel"
            id={`tabpanel-${activeTab.value}`}
            aria-labelledby={`tab-${activeTab.value}`}
            className="tabs-panel"
            tabIndex={0}
          >
            {activeTab.children}
          </div>
        )}
      </div>
    </TabsContext.Provider>
  );
}

/**
 * Tab component representing a single tab with its content.
 * Must be used as a child of Tabs component.
 * This component itself doesn't render anything directly;
 * Tabs extracts its props to build the tab UI.
 *
 * @example
 * ```tsx
 * <Tab value="npm" label="npm">
 *   npm install package-name
 * </Tab>
 * ```
 */
export function Tab(_props: TabProps): React.ReactElement | null {
  // Tab components are processed by the parent Tabs component.
  // They don't render anything directly - the Tabs component
  // extracts their props and renders the appropriate UI.
  // However, we need to access context to ensure proper usage.
  useTabsContext();
  return null;
}

export default Tabs;
