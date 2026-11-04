"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

const PAGE_TITLES = [
  { match: (p) => p === "/", title: "Dashboard" },
  { match: (p) => p.startsWith("/dashboard/"), title: "Client" },
  { match: (p) => p.startsWith("/items"), title: "Items" },
  { match: (p) => p.startsWith("/company-setup"), title: "Company profile" },
];

function ThemeMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const Icon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4 mr-2" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4 mr-2" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4 mr-2" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function SidebarAwareNavbar({ className }) {
  const { isSignedIn } = useUser();
  const pathname = usePathname() || "/";
  const title = isSignedIn ? PAGE_TITLES.find((p) => p.match(pathname))?.title : null;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 w-full items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      {isSignedIn && (
        <>
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 h-5" />
        </>
      )}

      {title ? (
        <h1 className="text-sm font-medium text-foreground">{title}</h1>
      ) : (
        <Link href="/" className="text-sm font-semibold">
          Invoice Generator
        </Link>
      )}

      <div className="ml-auto flex items-center gap-2">
        <ThemeMenu />
        {isSignedIn ? (
          <UserButton />
        ) : (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
