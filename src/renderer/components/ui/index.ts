/**
 * UI Component Library
 * Re-exports all shadcn/ui components for convenient importing.
 */

// Form components
export { Button, buttonVariants, type ButtonProps } from './button';
export { Input } from './input';
export { Textarea } from './textarea';
export { Label } from './label';

// Dialog & Overlay components
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './dialog';

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu';

export { Popover, PopoverContent, PopoverTrigger } from './popover';

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

// Layout components
export { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
export { ScrollArea, ScrollBar } from './scroll-area';
export { Separator } from './separator';

export { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './resizable';

// Command palette
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './command';
