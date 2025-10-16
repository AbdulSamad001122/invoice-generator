"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

export default function SidebarAwareNavbar({ className }) {
  const { isSignedIn, user } = useUser();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className={cn("border-b bg-white dark:bg-gray-900 dark:border-gray-700 sticky top-0 z-40 w-full", className)}>
      <div className="px-4">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <FileText className="h-6 w-6" />
            <span className="font-bold text-xl">Invoice Generator</span>
          </Link>

          {/* Navigation Items */}
          <div className="flex items-center space-x-3">
            {/* Theme Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
            
            {isSignedIn ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  Welcome,{" "}
                  {user.firstName || user.emailAddresses[0].emailAddress}
                </span>
                <UserButton signOutUrl="/" />
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/signin">
                  <Button variant="ghost">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button>
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}