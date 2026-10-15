import * as React from "react"
import { cn } from "cn"
import { Tabs as TabsPrimitive } from "radix-ui"

import { useLanguage } from "../../app/LanguageProvider"
import { useIsMobile } from "../../lib/use-mobile"

function Tabs({
  className,
  dir,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  // Radix defaults dir to "ltr" and renders it on the root element, which
  // would override the document's RTL direction for the whole tab subtree —
  // always follow the active locale unless the caller overrides it.
  const { dir: langDir } = useLanguage();
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      dir={dir ?? langDir}
      className={cn("flex flex-col gap-4 max-md:gap-8", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  // Below md the tab bar disappears — every TabsContent renders stacked.
  const mobile = useIsMobile();
  if (mobile) return null;
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none",
        "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  // On small screens every section renders — one continuous page instead
  // of hidden tab panels. Keeps the caller's layout classes intact.
  const mobile = useIsMobile();
  if (mobile) {
    return <div className={className}>{children}</div>;
  }
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    >
      {children}
    </TabsPrimitive.Content>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
