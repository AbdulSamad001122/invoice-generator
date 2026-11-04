"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, ExternalLink, Palette, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getAvailableTemplates,
  getDefaultTemplate,
  setDefaultTemplate,
} from "@/app/utils/templates/registry";
import { cn } from "@/lib/utils";

// Preview images in /public for each template
const PREVIEW_IMAGES = {
  "blue-modern": "/blue-theme.jpg",
  "yellow-classic": "/yellow-theme.jpg",
  "green-modern": "/green-theme.jpg",
  "green-classic": "/green_classic-theme.jpg",
};

// Small color dot shown next to each template name
const SWATCHES = {
  "blue-modern": "bg-[#1E40AF]",
  "yellow-classic": "bg-[#F5D547]",
  "green-modern": "bg-[#10B981]",
  "green-classic": "bg-[#9ACD32]",
};

const TemplateSelector = ({ selectedTemplate, onTemplateChange, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [defaultTemplate, setDefaultTemplateState] = useState(getDefaultTemplate());
  const templates = getAvailableTemplates();
  const currentTemplate =
    templates.find((t) => t.id === selectedTemplate) ||
    templates.find((t) => t.id === defaultTemplate);

  const handleSelect = (templateId) => {
    onTemplateChange(templateId);
    setIsOpen(false);
  };

  const handleSetAsDefault = (templateId) => {
    if (setDefaultTemplate(templateId)) setDefaultTemplateState(templateId);
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(true);
        }}
      >
        <Palette />
        <span className={cn("size-2.5 rounded-full", SWATCHES[currentTemplate?.id])} />
        <span>{currentTemplate?.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">Change</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Choose a template</DialogTitle>
            <DialogDescription>
              Every template uses the same invoice data, so you can switch at any time.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {templates.map((template) => {
              const isSelected = currentTemplate?.id === template.id;
              const isDefault = defaultTemplate === template.id;
              return (
                <div
                  key={template.id}
                  className={cn(
                    "group overflow-hidden rounded-xl border bg-card transition-colors",
                    isSelected ? "border-primary ring-2 ring-primary/30" : "hover:border-ring/50"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(template.id)}
                    className="relative block aspect-[4/3] w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Use the ${template.name} template`}
                  >
                    <Image
                      src={PREVIEW_IMAGES[template.id]}
                      alt={`${template.name} invoice preview`}
                      fill
                      sizes="(max-width: 640px) 100vw, 420px"
                      className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    {isSelected && (
                      <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm">
                        <Check className="size-3.5" /> Selected
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-3 p-3">
                    <span className={cn("size-3 shrink-0 rounded-full", SWATCHES[template.id])} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {template.name}
                        {isDefault && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                            Default
                          </Badge>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{template.description}</p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      title="Open full-size preview"
                      aria-label={`Open full-size preview of ${template.name}`}
                      onClick={() => window.open(PREVIEW_IMAGES[template.id], "_blank", "noopener")}
                    >
                      <ExternalLink />
                    </Button>
                    {!isDefault && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        title="Set as default for new invoices"
                        aria-label={`Set ${template.name} as default`}
                        onClick={() => handleSetAsDefault(template.id)}
                      >
                        <Star />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={isSelected ? "secondary" : "default"}
                      onClick={() => handleSelect(template.id)}
                    >
                      {isSelected ? "Selected" : "Use"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplateSelector;
